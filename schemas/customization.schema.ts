// schemas/customization.schema.ts
import { z } from "zod";

const normalizedCoordinateSchema = z
    .number()
    .finite()
    .min(0)
    .max(1);

const baseOverlaySchema = z.object({
    id: z.string().min(1),
    x: normalizedCoordinateSchema,
    y: normalizedCoordinateSchema,

    rotation: z.number().finite().default(0),
    scaleX: z.number().finite().positive().default(1),
    scaleY: z.number().finite().positive().default(1),

    anchorX: z.number().finite().min(0).max(1).default(0.5),
    anchorY: z.number().finite().min(0).max(1).default(0.5),

    opacity: z.number().finite().min(0).max(1).default(1),
    zIndex: z.number().int().default(0),
    creationOrder: z.number().int().nonnegative(),
});

export const stickerOverlaySchema = baseOverlaySchema.extend({
    type: z.literal("sticker"),
    assetUrl: z.string().min(1),
    width: z.number().positive(),
    height: z.number().positive(),
    flipX: z.boolean().default(false),
    flipY: z.boolean().default(false),
});

export const textOverlaySchema = baseOverlaySchema.extend({
    type: z.literal("text"),
    text: z.string(),
    width: z.number().positive().optional(),

    fontFamily: z.string().min(1),
    fontWeight: z.union([z.number(), z.string()]),
    fontStyle: z.enum(["normal", "italic"]).default("normal"),
    fontSize: z.number().positive(),
    lineHeight: z.number().positive(),
    letterSpacing: z.number().finite().default(0),

    align: z.enum(["left", "center", "right"]).default("center"),

    color: z.string().min(1),
    outlineColor: z.string().min(1),
    outlineWidth: z.number().nonnegative(),

    shadowPreset: z
        .enum(["none", "soft", "hard", "neon", "default"])
        .default("none"),
});

export const overlaySchema = z.discriminatedUnion("type", [
    stickerOverlaySchema,
    textOverlaySchema,
]);