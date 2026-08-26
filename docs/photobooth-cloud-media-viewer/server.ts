import express, { Request, Response } from "express";
import path from "path";
import cors from "cors";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import * as dotenv from "dotenv";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET } from "./lib/r2";
import { db } from "./db";
import { sessions, mediaAssets } from "./db/schema";
import { eq } from "drizzle-orm";

dotenv.config({ path: ".env.local" });

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5174;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// In-memory fallback if DB not yet configured
const inMemorySessions: Record<string, any> = {};

// 1. Health check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    hasDb: Boolean(db),
    hasR2: Boolean(r2),
    bucket: R2_BUCKET,
    time: new Date().toISOString(),
  });
});

// 2. Presigned Upload URL for CameraOS Electron
app.post("/api/uploads/presign", async (req: Request, res: Response) => {
  try {
    const { publicToken, fileName, contentType, assetType } = req.body || {};

    if (!publicToken || !fileName || !contentType) {
      return res.status(400).json({ error: "Missing required fields: publicToken, fileName, contentType" });
    }

    if (!r2) {
      // Local development dummy presigned url fallback
      return res.json({
        ok: true,
        key: `sessions/${publicToken}/final/${fileName}`,
        uploadUrl: `http://localhost:${PORT}/api/photobooth/dummy-upload`,
      });
    }

    const category = assetType?.includes("RAW") ? "originals" : "final";
    const key = `sessions/${publicToken}/${category}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 900 });

    res.json({
      ok: true,
      key,
      uploadUrl,
    });
  } catch (error: any) {
    console.error("[PRESIGN_ERROR]", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Create or update session metadata in Neon PostgreSQL
app.post("/api/sessions", async (req: Request, res: Response) => {
  try {
    const { publicToken, localSessionId, boothName, productType, requiredShots, asset } = req.body || {};

    if (!publicToken) {
      return res.status(400).json({ error: "publicToken is required" });
    }

    if (db) {
      let existing = await db.query.sessions.findFirst({
        where: eq(sessions.publicToken, publicToken),
      });

      if (!existing) {
        const [newSession] = await db
          .insert(sessions)
          .values({
            publicToken,
            localSessionId,
            boothName: boothName || "TIỆM ẢNH DI SẢN • MOMENTAI",
            productType: productType || "classic_4_shot",
            requiredShots: requiredShots || 4,
            status: "PROCESSING",
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
          })
          .returning();
        existing = newSession;
      }

      if (asset) {
        await db.insert(mediaAssets).values({
          sessionId: existing.id,
          assetType: asset.assetType,
          storageKey: asset.storageKey,
          fileName: asset.fileName,
          contentType: asset.contentType,
          sizeBytes: asset.sizeBytes,
          width: asset.width,
          height: asset.height,
          durationMs: asset.durationMs,
        });

        const assets = await db.query.mediaAssets.findMany({
          where: eq(mediaAssets.sessionId, existing.id),
        });

        const hasFinalImage = assets.some((a) => a.assetType === "FINAL_IMAGE");
        const hasFinalVideo = assets.some((a) => a.assetType === "FINAL_VIDEO");

        let nextStatus: "PROCESSING" | "IMAGE_READY" | "READY" = "PROCESSING";
        if (hasFinalImage && hasFinalVideo) {
          nextStatus = "READY";
        } else if (hasFinalImage) {
          nextStatus = "IMAGE_READY";
        }

        await db
          .update(sessions)
          .set({ status: nextStatus, updatedAt: new Date() })
          .where(eq(sessions.id, existing.id));
      }

      return res.json({ ok: true, session: existing });
    } else {
      // In-memory fallback
      if (!inMemorySessions[publicToken]) {
        inMemorySessions[publicToken] = {
          publicToken,
          localSessionId,
          boothName: boothName || "TIỆM ẢNH DI SẢN • MOMENTAI",
          status: "PROCESSING",
          createdAt: new Date().toISOString(),
          assets: [],
        };
      }
      if (asset) {
        inMemorySessions[publicToken].assets.push(asset);
        const hasImg = inMemorySessions[publicToken].assets.some((a: any) => a.assetType === "FINAL_IMAGE");
        const hasVid = inMemorySessions[publicToken].assets.some((a: any) => a.assetType === "FINAL_VIDEO");
        inMemorySessions[publicToken].status = hasImg && hasVid ? "READY" : hasImg ? "IMAGE_READY" : "PROCESSING";
      }
      return res.json({ ok: true, session: inMemorySessions[publicToken] });
    }
  } catch (error: any) {
    console.error("[SAVE_SESSION_ERROR]", error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Guest QR session lookup -> Returns Presigned GET URLs from R2
app.get("/api/sessions/:token", async (req: Request, res: Response) => {
  try {
    const token = req.params.token;

    if (db) {
      const session = await db.query.sessions.findFirst({
        where: eq(sessions.publicToken, token),
      });

      if (!session) {
        return res.status(404).json({ ok: false, error: "Session not found" });
      }

      const assets = await db.query.mediaAssets.findMany({
        where: eq(mediaAssets.sessionId, session.id),
      });

      const finalImage = assets.find((a) => a.assetType === "FINAL_IMAGE");
      const finalVideo = assets.find((a) => a.assetType === "FINAL_VIDEO");
      const rawPhotos = assets.filter((a) => a.assetType === "RAW_PHOTO");

      let finalImageUrl = "";
      if (finalImage && r2) {
        finalImageUrl = await getSignedUrl(
          r2,
          new GetObjectCommand({ Bucket: R2_BUCKET, Key: finalImage.storageKey }),
          { expiresIn: 3600 }
        );
      }

      let finalVideoUrl = "";
      if (finalVideo && r2) {
        finalVideoUrl = await getSignedUrl(
          r2,
          new GetObjectCommand({ Bucket: R2_BUCKET, Key: finalVideo.storageKey }),
          { expiresIn: 3600 }
        );
      }

      const rawPhotosWithUrls = [];
      if (r2) {
        for (const raw of rawPhotos) {
          const url = await getSignedUrl(
            r2,
            new GetObjectCommand({ Bucket: R2_BUCKET, Key: raw.storageKey }),
            { expiresIn: 3600 }
          );
          rawPhotosWithUrls.push({ ...raw, url });
        }
      }

      return res.json({
        ok: true,
        session,
        finalImage: finalImage ? { ...finalImage, url: finalImageUrl } : null,
        finalVideo: finalVideo ? { ...finalVideo, url: finalVideoUrl } : null,
        rawPhotos: rawPhotosWithUrls,
      });
    } else {
      const mem = inMemorySessions[token];
      if (!mem) return res.status(404).json({ ok: false, error: "Session not found" });
      return res.json({
        ok: true,
        session: mem,
        finalImage: mem.assets.find((a: any) => a.assetType === "FINAL_IMAGE") || null,
        finalVideo: mem.assets.find((a: any) => a.assetType === "FINAL_VIDEO") || null,
      });
    }
  } catch (error: any) {
    console.error("[GET_SESSION_ERROR]", error);
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[PHOTOBOOTH_VIEWER] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
