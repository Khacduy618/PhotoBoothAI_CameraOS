import { NextResponse } from "next/server";

import { listLocalPhotosBySession } from "@/services/storage/server/local-media-store";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ sessionId: string }> },
) {
    const { sessionId } = await params;

    try {
        const photos = await listLocalPhotosBySession(sessionId);

        return NextResponse.json({ ok: true, photos });
    } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Unable to list session media.";

        return NextResponse.json(
            { ok: false, error: message },
            { status: 500 },
        );
    }
}
