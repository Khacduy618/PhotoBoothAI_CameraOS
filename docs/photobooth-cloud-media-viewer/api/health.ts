import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db } from "../db";
import { r2, R2_BUCKET } from "../lib/r2";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    status: "ok",
    hasDb: Boolean(db),
    hasR2: Boolean(r2),
    bucket: R2_BUCKET,
    time: new Date().toISOString(),
  });
}
