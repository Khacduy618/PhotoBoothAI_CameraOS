import { NextRequest, NextResponse } from "next/server";

import {
    addMomentAIGuestPhoto,
    completeMomentAIGuestSession,
    composeMomentAIOutputs,
    requestMomentAIPrint,
    getMomentAIGuestSession,
    listMomentAICaptureFormats,
    listMomentAITemplates,
    saveMomentAICustomization,
    selectMomentAICaptureFormat,
    selectMomentAITemplate,
    startMomentAIGuestSession,
} from "@/services/momentai-guest-session/momentai-guest-session-orchestrator.service";
import type { MomentAICaptureFormatId, MomentAICustomization } from "@/types/momentai-guest-session";

export async function GET(request: NextRequest) {
    const sessionId = request.nextUrl.searchParams.get("sessionId");
    const captureFormatId = request.nextUrl.searchParams.get("captureFormatId") as MomentAICaptureFormatId | null;
    const eventId = request.nextUrl.searchParams.get("eventId") || "event_hoi_an_heritage";

    if (sessionId) {
        const session = getMomentAIGuestSession(sessionId);
        return NextResponse.json({ ok: Boolean(session), session });
    }

    if (captureFormatId) {
        return NextResponse.json({ ok: true, templates: listMomentAITemplates(eventId, captureFormatId) });
    }

    return NextResponse.json({ ok: true, captureFormats: listMomentAICaptureFormats() });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as {
            action?: string;
            sessionId?: string;
            eventId?: string;
            formatId?: MomentAICaptureFormatId;
            photo?: {
                photoId: string;
                shotIndex: number;
                originalPath: string;
                dataUrl?: string;
            };
            templateId?: string;
            customization?: MomentAICustomization;
            copies?: number;
        };

        switch (body.action) {
            case "start-session":
                return NextResponse.json({ ok: true, session: startMomentAIGuestSession(body.eventId) });
            case "select-format":
                return NextResponse.json({ ok: true, session: selectMomentAICaptureFormat(requireSessionId(body.sessionId), requireFormatId(body.formatId)) });
            case "add-photo":
                if (!body.photo) throw new Error("photo is required.");
                return NextResponse.json({ ok: true, session: addMomentAIGuestPhoto(requireSessionId(body.sessionId), body.photo) });
            case "select-template":
                if (!body.templateId) throw new Error("templateId is required.");
                return NextResponse.json({ ok: true, session: selectMomentAITemplate(requireSessionId(body.sessionId), body.templateId) });
            case "save-customization":
                if (!body.customization) throw new Error("customization is required.");
                return NextResponse.json({ ok: true, session: saveMomentAICustomization(requireSessionId(body.sessionId), body.customization) });
            case "compose":
                return NextResponse.json({ ok: true, session: composeMomentAIOutputs(requireSessionId(body.sessionId)) });
            case "request-print":
                return NextResponse.json({ ok: true, session: requestMomentAIPrint(requireSessionId(body.sessionId), body.copies ?? 1) });
            case "complete":
                return NextResponse.json({ ok: true, session: completeMomentAIGuestSession(requireSessionId(body.sessionId)) });
            default:
                return NextResponse.json({ ok: false, error: "Unsupported Guest Flow MomentAI action." }, { status: 400 });
        }
    } catch (error) {
        return NextResponse.json(
            {
                ok: false,
                error: error instanceof Error ? error.message : "Unknown Guest Flow MomentAI API error.",
            },
            { status: 400 },
        );
    }
}

function requireSessionId(sessionId?: string): string {
    if (!sessionId) throw new Error("sessionId is required.");
    return sessionId;
}

function requireFormatId(formatId?: MomentAICaptureFormatId): MomentAICaptureFormatId {
    if (!formatId) throw new Error("formatId is required.");
    return formatId;
}
