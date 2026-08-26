import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET } from "../../lib/r2";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!r2) {
    return res.status(500).json({ error: "Cloudflare R2 is not configured" });
  }

  try {
    const { publicToken, fileName, contentType, assetType } = req.body || {};

    if (!publicToken || !fileName || !contentType) {
      return res.status(400).json({ error: "Missing required fields: publicToken, fileName, contentType" });
    }

    const category = assetType?.includes("RAW") ? "originals" : "final";
    const key = `sessions/${publicToken}/${category}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 900 });

    return res.status(200).json({
      ok: true,
      key,
      uploadUrl,
    });
  } catch (error: any) {
    console.error("[R2_PRESIGN_ERROR]", error);
    return res.status(500).json({ error: error.message });
  }
}
