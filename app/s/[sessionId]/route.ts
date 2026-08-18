import { NextRequest, NextResponse } from "next/server";

import { getLocalSharePayload } from "@/services/momentai-guest-session/momentai-guest-session-orchestrator.service";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> },
) {
    const { sessionId } = await params;
    const token = request.nextUrl.searchParams.get("token");
    const result = getLocalSharePayload(sessionId, token);

    if (!result.ok) {
        return NextResponse.json(
            { ok: false, error: result.error },
            { status: result.status },
        );
    }

    return NextResponse.json({
        ok: true,
        sessionId,
        finalShare: result.dataUrl,
    });
}
