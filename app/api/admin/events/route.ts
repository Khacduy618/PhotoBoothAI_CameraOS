import { NextRequest, NextResponse } from "next/server";

import { createAdminEvent, listAdminEvents } from "@/services/admin/server/admin-registry-store";

export async function GET() {
    try {
        return NextResponse.json({ ok: true, events: listAdminEvents() });
    } catch (cause) {
        const error = cause instanceof Error ? cause.message : "Unable to list events.";
        return NextResponse.json({ ok: false, error }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as { name?: string };
        const event = createAdminEvent(String(body.name || ""));
        return NextResponse.json({ ok: true, event });
    } catch (cause) {
        const error = cause instanceof Error ? cause.message : "Unable to create event.";
        return NextResponse.json({ ok: false, error }, { status: 400 });
    }
}
