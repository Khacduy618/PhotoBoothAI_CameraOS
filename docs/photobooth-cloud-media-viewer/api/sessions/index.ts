import type { VercelRequest, VercelResponse } from "@vercel/node";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { pgTable, text, timestamp, integer, uuid, pgEnum } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const db = getDb();
  if (!db) {
    return res.status(500).json({ error: "Database not configured. Missing DATABASE_URL." });
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
      let safeAssetType: "FINAL_IMAGE" | "FINAL_VIDEO" | "RAW_PHOTO" | "RAW_CLIP" = "FINAL_IMAGE";
      if (asset.assetType === "FINAL_VIDEO") safeAssetType = "FINAL_VIDEO";
      else if (asset.assetType === "ORIGINAL_PHOTO" || asset.assetType === "RAW_PHOTO") safeAssetType = "RAW_PHOTO";
      else if (asset.assetType === "ORIGINAL_CLIP" || asset.assetType === "RAW_CLIP") safeAssetType = "RAW_CLIP";

      await db.insert(mediaAssets).values({
        sessionId: existing.id,
        assetType: safeAssetType,
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
