import { NextRequest, NextResponse } from "next/server";

import {
    cleanupExpiredLocalMedia,
    saveLocalOriginalPhoto,
} from "@/services/storage/server/local-media-store";

export async function POST(request: NextRequest) {
    try {
        await cleanupExpiredLocalMedia();

        const formData = await request.formData();
        const sessionId = String(formData.get("sessionId") || "");
        const photoId = String(formData.get("photoId") || "");
        const capturedAt = String(formData.get("capturedAt") || "");
        const widthValue = formData.get("width");
        const heightValue = formData.get("height");
        const file = formData.get("file");

        if (!sessionId || !photoId || !(file instanceof Blob)) {
            return NextResponse.json(
                { ok: false, error: "Missing sessionId, photoId or file." },
                { status: 400 },
            );
        }

        const record = await saveLocalOriginalPhoto({
            sessionId,
            photoId,
            blob: file,
            capturedAt: capturedAt || undefined,
            width: typeof widthValue === "string" ? Number(widthValue) || undefined : undefined,
            height: typeof heightValue === "string" ? Number(heightValue) || undefined : undefined,
        });

        return NextResponse.json({ ok: true, photo: record });
    } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Unable to save local media.";

        return NextResponse.json(
            { ok: false, error: message },
            { status: 500 },
        );
    }
}
