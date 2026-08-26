import type { VercelRequest, VercelResponse } from "@vercel/node";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const r2 = getR2Client();
  if (!r2) {
    return res.status(500).json({ error: "Cloudflare R2 is not configured. Missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY." });
  }

  try {
    const { publicToken, fileName, contentType, assetType } = req.body || {};

    if (!publicToken || !fileName || !contentType) {
      return res.status(400).json({ error: "Missing required fields: publicToken, fileName, contentType" });
    }

    const category = (assetType?.includes("RAW") || assetType?.includes("ORIGINAL") || assetType?.includes("PHOTO") || assetType?.includes("CLIP")) && !assetType?.includes("FINAL") ? "originals" : "final";
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
