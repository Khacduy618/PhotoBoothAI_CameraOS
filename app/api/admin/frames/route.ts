import { NextRequest, NextResponse } from "next/server";

import {
    clearAdminFrames,
    deleteAdminFrame,
    listAdminFrames,
    listPublishedFrames,
    saveAdminFrame,
    updateAdminFrameStatus,
} from "@/services/admin/server/admin-registry-store";
import type { FrameDefinition } from "@/services/frame-import/frame-import.types";

export async function GET(request: NextRequest) {
    try {
        const eventId = request.nextUrl.searchParams.get("eventId") || undefined;
        const publishedOnly = request.nextUrl.searchParams.get("published") === "1";
        const frames = publishedOnly ? listPublishedFrames(eventId) : listAdminFrames(eventId);
        return NextResponse.json({ ok: true, frames });
    } catch (cause) {
        const error = cause instanceof Error ? cause.message : "Unable to list frames.";
        return NextResponse.json({ ok: false, error }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as { eventId?: string; frame?: FrameDefinition };
        if (!body.frame || !body.eventId) {
            return NextResponse.json({ ok: false, error: "Missing eventId or frame." }, { status: 400 });
        }
        const frame = saveAdminFrame(body.frame, body.eventId);
        return NextResponse.json({ ok: true, frame });
    } catch (cause) {
        const error = cause instanceof Error ? cause.message : "Unable to save frame.";
        return NextResponse.json({ ok: false, error }, { status: 400 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json() as { eventId?: string; frameId?: string; status?: "published" | "private" };
        if (!body.eventId || !body.frameId || (body.status !== "published" && body.status !== "private")) {
            return NextResponse.json({ ok: false, error: "Missing eventId, frameId or valid status." }, { status: 400 });
        }
        updateAdminFrameStatus(body.frameId, body.status, body.eventId);
        return NextResponse.json({ ok: true });
    } catch (cause) {
        const error = cause instanceof Error ? cause.message : "Unable to update frame.";
        return NextResponse.json({ ok: false, error }, { status: 400 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const eventId = request.nextUrl.searchParams.get("eventId") || undefined;
        const frameId = request.nextUrl.searchParams.get("frameId") || undefined;
        if (frameId) {
            if (!eventId) {
                return NextResponse.json({ ok: false, error: "Missing eventId for frame delete." }, { status: 400 });
            }
            deleteAdminFrame(frameId, eventId);
            return NextResponse.json({ ok: true });
        }
        if (eventId) {
            clearAdminFrames(eventId);
            return NextResponse.json({ ok: true });
        }
        return NextResponse.json({ ok: false, error: "Missing frameId or eventId." }, { status: 400 });
    } catch (cause) {
        const error = cause instanceof Error ? cause.message : "Unable to delete frame.";
        return NextResponse.json({ ok: false, error }, { status: 400 });
    }
}
