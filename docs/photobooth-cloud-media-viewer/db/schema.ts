import { pgTable, text, timestamp, integer, uuid, pgEnum } from "drizzle-orm/pg-core";

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

// Table: Photobooth Sessions
export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  publicToken: text("public_token").notNull().unique(), // Token for QR URL: /s/<publicToken>
  localSessionId: text("local_session_id"),
  status: sessionStatusEnum("status").default("PROCESSING").notNull(),
  boothName: text("booth_name").default("TIỆM ẢNH DI SẢN • MOMENTAI"),
  productType: text("product_type").default("classic_4_shot"),
  requiredShots: integer("required_shots").default(4),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

// Table: Cloudflare R2 Media Assets
export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  assetType: assetTypeEnum("asset_type").notNull(),
  storageKey: text("storage_key").notNull(), // R2 Object Key (e.g. sessions/<token>/final/final-image.jpg)
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes"),
  width: integer("width"),
  height: integer("height"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
