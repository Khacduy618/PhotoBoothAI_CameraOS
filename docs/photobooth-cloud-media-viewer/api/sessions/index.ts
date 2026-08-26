import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../db";
import { sessions, mediaAssets } from "../../db/schema";
import { eq } from "drizzle-orm";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!db) {
    return res.status(500).json({ error: "Database not configured" });
  }

  try {
    const { publicToken, localSessionId, boothName, productType, requiredShots, asset } = req.body || {};

    if (!publicToken) {
      return res.status(400).json({ error: "publicToken is required" });
    }

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

    return res.status(200).json({ ok: true, session: existing });
  } catch (error: any) {
    console.error("[SESSIONS_API_ERROR]", error);
    return res.status(500).json({ error: error.message });
  }
}
