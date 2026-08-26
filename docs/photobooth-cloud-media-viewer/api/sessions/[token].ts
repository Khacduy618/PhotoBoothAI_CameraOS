import type { VercelRequest, VercelResponse } from "@vercel/node";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { pgTable, text, timestamp, integer, uuid, pgEnum } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const sessionStatusEnum = pgEnum("session_status", [
  "PROCESSING",
  "IMAGE_READY",
  "READY",
  "PARTIAL",
  "FAILED",
]);

export const assetTypeEnum = pgEnum("asset_type", [
  "FINAL_IMAGE",
  "FINAL_VIDEO",
  "RAW_PHOTO",
  "RAW_CLIP",
]);

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  publicToken: text("public_token").notNull().unique(),
  localSessionId: text("local_session_id"),
  status: sessionStatusEnum("status").default("PROCESSING").notNull(),
  boothName: text("booth_name").default("TIỆM ẢNH DI SẢN • MOMENTAI"),
  productType: text("product_type").default("classic_4_shot"),
  requiredShots: integer("required_shots").default(4),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  assetType: assetTypeEnum("asset_type").notNull(),
  storageKey: text("storage_key").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes"),
  width: integer("width"),
  height: integer("height"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

const schema = { sessions, mediaAssets, sessionStatusEnum, assetTypeEnum };

function getDb() {
  const dbUrl = process.env.DATABASE_URL || "";
  return dbUrl ? drizzle(neon(dbUrl), { schema }) : null;
}

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID || "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "";
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

const R2_BUCKET = process.env.R2_BUCKET_NAME || "momentai-media";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = Array.isArray(req.query.token) ? req.query.token[0] : req.query.token;
  if (!token) {
    return res.status(400).json({ error: "Token is required" });
  }

  const db = getDb();
  if (!db) {
    return res.status(500).json({ error: "Database not configured. Missing DATABASE_URL." });
  }

  try {
    const session = await db.query.sessions.findFirst({
      where: eq(sessions.publicToken, token),
    });

    if (!session) {
      return res.status(404).json({ ok: false, error: "Session not found" });
    }

    const assets = await db.query.mediaAssets.findMany({
      where: eq(mediaAssets.sessionId, session.id),
    });

    const r2 = getR2Client();

    const finalImage = assets.find((a) => a.assetType === "FINAL_IMAGE");
    const finalVideo = assets.find((a) => a.assetType === "FINAL_VIDEO");
    const rawPhotos = assets.filter((a) => a.assetType === "RAW_PHOTO");
    const rawClips = assets.filter((a) => a.assetType === "RAW_CLIP");

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
        rawPhotosWithUrls.push({
          ...raw,
          url,
        });
      }
    }

    const rawClipsWithUrls = [];
    if (r2) {
      for (const clip of rawClips) {
        const url = await getSignedUrl(
          r2,
          new GetObjectCommand({ Bucket: R2_BUCKET, Key: clip.storageKey }),
          { expiresIn: 3600 }
        );
        rawClipsWithUrls.push({
          ...clip,
          url,
        });
      }
    }

    return res.status(200).json({
      ok: true,
      session,
      finalImage: finalImage ? { ...finalImage, url: finalImageUrl } : null,
      finalVideo: finalVideo ? { ...finalVideo, url: finalVideoUrl } : null,
      rawPhotos: rawPhotosWithUrls,
      rawClips: rawClipsWithUrls,
    });
  } catch (error: any) {
    console.error("[SESSION_LOOKUP_ERROR]", error);
    return res.status(500).json({ error: error.message });
  }
}
