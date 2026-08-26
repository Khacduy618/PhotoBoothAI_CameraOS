import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../../db";
import { sessions, mediaAssets } from "../../db/schema";
import { eq } from "drizzle-orm";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET } from "../../lib/r2";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = Array.isArray(req.query.token) ? req.query.token[0] : req.query.token;

  if (!token) {
    return res.status(400).json({ error: "Token is required" });
  }

  if (!db) {
    return res.status(500).json({ error: "Database not configured" });
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
        rawPhotosWithUrls.push({
          ...raw,
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
    });
  } catch (error: any) {
    console.error("[SESSION_LOOKUP_ERROR]", error);
    return res.status(500).json({ error: error.message });
  }
}
