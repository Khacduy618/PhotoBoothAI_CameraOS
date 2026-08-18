import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET } from "@/app/s/[sessionId]/route";
import {
    addMomentAIGuestPhoto,
    buildLocalShareUrl,
    composeMomentAIOutputs,
    listMomentAITemplates,
    selectMomentAICaptureFormat,
    selectMomentAITemplate,
    startMomentAIGuestSession,
} from "@/services/momentai-guest-session/momentai-guest-session-orchestrator.service";

function createReadyShareSession() {
    let session = startMomentAIGuestSession();
    session = selectMomentAICaptureFormat(session.sessionId, "format_1shot");
    session = addMomentAIGuestPhoto(session.sessionId, {
        photoId: `photo_route_${Date.now()}`,
        shotIndex: 1,
        originalPath: "originals/capture_01.jpg",
        dataUrl: "data:image/jpeg;base64,AAAA",
    });
    const template = listMomentAITemplates(session.eventId, "format_1shot")[0];
    session = selectMomentAITemplate(session.sessionId, template.templateId);
    return composeMomentAIOutputs(session.sessionId);
}

describe("local share route", () => {
    it("returns final-share JSON for a valid session token", async () => {
        const session = createReadyShareSession();
        const shareUrl = buildLocalShareUrl(session.sessionId, "http://192.168.1.25:3789");
        const request = new NextRequest(shareUrl!);

        const response = await GET(request, { params: Promise.resolve({ sessionId: session.sessionId }) });
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual({
            ok: true,
            sessionId: session.sessionId,
            finalShare: `/outputs/${encodeURIComponent(session.sessionId)}/final-share.jpg`,
        });
        expect(response.headers.get("content-type")).toContain("application/json");
    });

    it("rejects missing or invalid tokens without serving media paths", async () => {
        const session = createReadyShareSession();
        const request = new NextRequest(`http://192.168.1.25:3789/s/${encodeURIComponent(session.sessionId)}?token=bad-token`);

        const response = await GET(request, { params: Promise.resolve({ sessionId: session.sessionId }) });
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body).toEqual({ ok: false, error: "INVALID_SHARE_TOKEN" });
        expect(JSON.stringify(body)).not.toContain("final-share.jpg");
    });

    it("returns not found for valid tokens without a final-share output", async () => {
        const session = startMomentAIGuestSession();
        const shareUrl = buildLocalShareUrl(session.sessionId, "http://192.168.1.25:3789");
        const request = new NextRequest(shareUrl!);

        const response = await GET(request, { params: Promise.resolve({ sessionId: session.sessionId }) });
        const body = await response.json();

        expect(response.status).toBe(404);
        expect(body).toEqual({ ok: false, error: "SHARE_OUTPUT_NOT_FOUND" });
    });
});
