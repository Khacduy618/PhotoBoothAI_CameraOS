import { NextResponse } from "next/server";

import { readLocalPhotoFile } from "@/services/storage/server/local-media-store";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ photoId: string }> },
) {
    const { photoId } = await params;

    try {
        const result = await readLocalPhotoFile(photoId);

        if (!result) {
            return NextResponse.json(
                { ok: false, error: "Photo not found or expired." },
                { status: 404 },
            );
        }

        return new NextResponse(new Uint8Array(result.bytes), {
            headers: {
                "Content-Type": result.record.mimeType,
                "Cache-Control": "private, max-age=30",
                "Content-Disposition": `inline; filename="${result.record.photoId}"`,
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch (cause) {
        const safePhotoId = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(photoId) ? photoId : "invalid-photo-id";
        console.error("[local-media] Unable to read local media", {
            photoId: safePhotoId,
            cause: cause instanceof Error ? cause.name : typeof cause,
        });

        return NextResponse.json(
            { ok: false, error: "Unable to read local media." },
            { status: 500 },
        );
    }
}
