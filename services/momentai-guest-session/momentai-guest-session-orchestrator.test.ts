import { afterEach, describe, expect, it } from "vitest";

import {
    addMomentAIGuestPhoto,
    buildLocalShareUrl,
    completeMomentAIGuestSession,
    composeMomentAIOutputs,
    getLocalSharePayload,
    getMomentAIReadiness,
    requestMomentAIPrint,
    listMomentAICaptureFormats,
    listMomentAITemplates,
    resetMomentAIReadinessForTesting,
    saveMomentAICustomization,
    selectMomentAICaptureFormat,
    setMomentAIEventConfigForTesting,
    setMomentAIHealthForTesting,
    selectMomentAITemplate,
    startMomentAIGuestSession,
} from "@/services/momentai-guest-session/momentai-guest-session-orchestrator.service";

describe("MomentAI guest session orchestrator", () => {
    afterEach(() => resetMomentAIReadinessForTesting());

    it("runs the session from format selection to QR and guest-confirmed print request without losing originals", () => {
        let session = startMomentAIGuestSession();

        session = selectMomentAICaptureFormat(session.sessionId, "format_2shot");
        expect(session.status).toBe("READY_TO_CAPTURE");
        expect(session.captureFormat?.shotCount).toBe(2);

        session = addMomentAIGuestPhoto(session.sessionId, {
            photoId: "photo_test_1",
            shotIndex: 1,
            originalPath: "originals/capture_01.jpg",
            dataUrl: "data:image/jpeg;base64,AAAA",
        });
        expect(session.status).toBe("CAPTURING");

        session = addMomentAIGuestPhoto(session.sessionId, {
            photoId: "photo_test_2",
            shotIndex: 2,
            originalPath: "originals/capture_02.jpg",
            dataUrl: "data:image/jpeg;base64,AAAA",
        });
        expect(session.status).toBe("SELECTING_TEMPLATE");
        expect(session.photos.map((photo) => photo.originalPath)).toEqual([
            "originals/capture_01.jpg",
            "originals/capture_02.jpg",
        ]);

        const template = listMomentAITemplates(session.eventId, "format_2shot")[0];
        session = selectMomentAITemplate(session.sessionId, template.templateId);
        expect(session.status).toBe("CUSTOMIZING");
        expect(session.slotAssignments).toEqual([
            { slotIndex: 1, photoId: "photo_test_1" },
            { slotIndex: 2, photoId: "photo_test_2" },
        ]);

        session = saveMomentAICustomization(session.sessionId, {
            text: [{ regionId: "guest_message", value: "Happy Wedding" }],
            drawing: [],
        });
        expect(session.status).toBe("COMPOSING");

        session = composeMomentAIOutputs(session.sessionId);
        expect(session.status).toBe("RESULT_READY");
        expect(session.outputs.master).toContain("final-master");
        expect(session.outputs.share).toContain("final-share");
        expect(session.outputs.share).not.toContain("https://");
        expect(session.outputs.print).toContain("final-print");
        expect(session.qr?.status).toBe("failed");

        session = requestMomentAIPrint(session.sessionId);
        expect(session.printJob?.status).toBe("queued");
        expect(session.photos).toHaveLength(2);
    });

    it("can mark QR ready when a configured local share endpoint is safe", () => {
        const previousBaseUrl = process.env.MOMENTAI_LOCAL_SHARE_BASE_URL;
        process.env.MOMENTAI_LOCAL_SHARE_BASE_URL = "http://192.168.1.25:3789";
        try {
            let session = startMomentAIGuestSession();
            session = selectMomentAICaptureFormat(session.sessionId, "format_1shot");
            session = addMomentAIGuestPhoto(session.sessionId, {
                photoId: "photo_qr_1",
                shotIndex: 1,
                originalPath: "originals/capture_01.jpg",
                dataUrl: "data:image/jpeg;base64,AAAA",
            });
            const template = listMomentAITemplates(session.eventId, "format_1shot")[0];
            session = selectMomentAITemplate(session.sessionId, template.templateId);
            session = composeMomentAIOutputs(session.sessionId);

            expect(session.qr?.status).toBe("ready");
            expect(session.qr?.url).toContain("http://192.168.1.25:3789/s/");
            expect(session.qr?.url).toContain("token=");
        } finally {
            if (previousBaseUrl === undefined) delete process.env.MOMENTAI_LOCAL_SHARE_BASE_URL;
            else process.env.MOMENTAI_LOCAL_SHARE_BASE_URL = previousBaseUrl;
        }
    });

    it("builds only tokenized local-network share URLs", () => {
        const localUrl = buildLocalShareUrl("sess_local_1", "http://192.168.1.25:3789");
        expect(localUrl).toContain("http://192.168.1.25:3789/s/sess_local_1");
        const token = new URL(localUrl!).searchParams.get("token");
        expect(token).toBeTruthy();
        expect(token).not.toBe(Buffer.from("local:sess_local_1").toString("base64url"));
        expect(localUrl).not.toContain("localhost");

        expect(buildLocalShareUrl("sess_local_1", "http://localhost:3789")).toBeNull();
        expect(buildLocalShareUrl("sess_local_1", "https://gallery.momentai.vn")).toBeNull();
        expect(buildLocalShareUrl("sess_local_1", "file:///tmp/photo.jpg")).toBeNull();
    });

    it("retrieves only the final-share output for a valid local share token", () => {
        let session = startMomentAIGuestSession();
        session = selectMomentAICaptureFormat(session.sessionId, "format_1shot");
        session = addMomentAIGuestPhoto(session.sessionId, {
            photoId: "photo_share_1",
            shotIndex: 1,
            originalPath: "originals/capture_01.jpg",
            dataUrl: "data:image/jpeg;base64,AAAA",
        });
        const template = listMomentAITemplates(session.eventId, "format_1shot")[0];
        session = selectMomentAITemplate(session.sessionId, template.templateId);
        session = composeMomentAIOutputs(session.sessionId);
        const shareUrl = buildLocalShareUrl(session.sessionId, "http://192.168.1.25:3789");
        const token = new URL(shareUrl!).searchParams.get("token");

        expect(getLocalSharePayload(session.sessionId, token)).toEqual({
            ok: true,
            dataUrl: `/outputs/${encodeURIComponent(session.sessionId)}/final-share.jpg`,
        });
        expect(getLocalSharePayload(session.sessionId, "bad-token")).toEqual({
            ok: false,
            status: 403,
            error: "INVALID_SHARE_TOKEN",
        });
    });

    it("does not expose arbitrary files through local share retrieval", () => {
        const missing = getLocalSharePayload("sess_missing", new URL(buildLocalShareUrl("sess_missing", "http://192.168.1.25:3789")!).searchParams.get("token"));
        expect(missing).toEqual({ ok: false, status: 404, error: "SHARE_OUTPUT_NOT_FOUND" });

        const arbitraryPathUrl = buildLocalShareUrl("../secret", "http://192.168.1.25:3789");
        expect(arbitraryPathUrl).toContain("/s/..%2Fsecret");
        const arbitraryToken = new URL(arbitraryPathUrl!).searchParams.get("token");
        expect(getLocalSharePayload("../secret", arbitraryToken)).toEqual({
            ok: false,
            status: 404,
            error: "SHARE_OUTPUT_NOT_FOUND",
        });
    });

    it("deduplicates repeated guest-confirmed print requests for the same output", () => {
        let session = startMomentAIGuestSession();
        session = selectMomentAICaptureFormat(session.sessionId, "format_1shot");
        session = addMomentAIGuestPhoto(session.sessionId, {
            photoId: "photo_print_1",
            shotIndex: 1,
            originalPath: "originals/capture_01.jpg",
            dataUrl: "data:image/jpeg;base64,AAAA",
        });
        const template = listMomentAITemplates(session.eventId, "format_1shot")[0];
        session = selectMomentAITemplate(session.sessionId, template.templateId);
        session = composeMomentAIOutputs(session.sessionId);

        const firstRequest = requestMomentAIPrint(session.sessionId, 2);
        const secondRequest = requestMomentAIPrint(session.sessionId, 2);

        expect(firstRequest.printJob?.jobId).toBeDefined();
        expect(secondRequest.printJob?.jobId).toBe(firstRequest.printJob?.jobId);
        expect(secondRequest.printJob?.copies).toBe(2);
    });

    it("blocks composition until enough preserved originals exist", () => {
        let session = startMomentAIGuestSession();
        session = selectMomentAICaptureFormat(session.sessionId, "format_4shot");
        session = addMomentAIGuestPhoto(session.sessionId, {
            photoId: "photo_partial_1",
            shotIndex: 1,
            originalPath: "originals/capture_01.jpg",
            dataUrl: "data:image/jpeg;base64,AAAA",
        });

        expect(() => composeMomentAIOutputs(session.sessionId)).toThrow("Template is required before composition.");
    });

    it("filters templates by event and capture format", () => {
        const session = selectMomentAICaptureFormat(startMomentAIGuestSession().sessionId, "format_6shot");
        const templates = listMomentAITemplates(session.eventId, "format_6shot");
        expect(templates.length).toBeGreaterThanOrEqual(1);
        expect(templates[0].captureFormatId).toBe("format_6shot");
    });

    it("rejects duplicate valid originals for the same shot index", () => {
        let session = startMomentAIGuestSession();
        session = selectMomentAICaptureFormat(session.sessionId, "format_2shot");
        session = addMomentAIGuestPhoto(session.sessionId, {
            photoId: "photo_dup_1",
            shotIndex: 1,
            originalPath: "originals/capture_01.jpg",
            dataUrl: "data:image/jpeg;base64,AAAA",
        });

        expect(() => addMomentAIGuestPhoto(session.sessionId, {
            photoId: "photo_dup_2",
            shotIndex: 1,
            originalPath: "originals/capture_01.jpg",
            dataUrl: "data:image/jpeg;base64,AAAA",
        })).toThrow("A valid original already exists for this shot index.");
    });

    it("rejects unsafe original paths and out-of-order completion", () => {
        let session = startMomentAIGuestSession();
        expect(() => completeMomentAIGuestSession(session.sessionId)).toThrow("Session can only complete from RESULT_READY.");
        session = selectMomentAICaptureFormat(session.sessionId, "format_1shot");

        expect(() => addMomentAIGuestPhoto(session.sessionId, {
            photoId: "photo_safe_1",
            shotIndex: 1,
            originalPath: "../secret.jpg",
        })).toThrow("originalPath must be a safe originals/capture_## JPEG path.");
    });

    it("blocks guest start when there is no active event or health is blocked", () => {
        expect(getMomentAIReadiness().status).toBe("DEGRADED");

        setMomentAIEventConfigForTesting(null);
        expect(getMomentAIReadiness()).toMatchObject({ status: "BLOCKED", reasons: ["NO_ACTIVE_EVENT"] });
        expect(() => startMomentAIGuestSession()).toThrow("Guest start blocked");

        resetMomentAIReadinessForTesting();
        setMomentAIHealthForTesting({ storage: "blocked" });
        expect(getMomentAIReadiness()).toMatchObject({ status: "BLOCKED", reasons: ["STORAGE_BLOCKED"] });
        expect(() => startMomentAIGuestSession()).toThrow("STORAGE_BLOCKED");

        resetMomentAIReadinessForTesting();
        setMomentAIHealthForTesting({ storage: "degraded" });
        expect(getMomentAIReadiness().status).toBe("DEGRADED");
        expect(getMomentAIReadiness().reasons).toContain("STORAGE_DEGRADED");
        expect(() => startMomentAIGuestSession()).toThrow("STORAGE_DEGRADED");
    });

    it("returns defensive readiness snapshots", () => {
        const readiness = getMomentAIReadiness();
        readiness.health.storage = "blocked";
        readiness.activeEvent?.enabledShotFormats.includes("format_1shot");
        expect(getMomentAIReadiness().health.storage).toBe("ready");
    });

    it("uses active event enabled shot formats and rejects disabled selections", () => {
        setMomentAIEventConfigForTesting({
            eventId: "event_small",
            name: "Small Event",
            status: "active",
            enabledShotFormats: ["format_1shot", "format_2shot"],
            timeoutSeconds: 120,
            printPolicy: "GUEST_CONFIRM",
            shareMode: "LOCAL_NETWORK_URL",
            allowGuestRetake: false,
            maxRetakesPerShot: 0,
        });
        setMomentAIHealthForTesting({ printer: "ready", shareNetwork: "ready" });

        expect(getMomentAIReadiness().status).toBe("READY");
        expect(listMomentAICaptureFormats().map((format) => format.id)).toEqual(["format_1shot", "format_2shot"]);
        const session = startMomentAIGuestSession("event_small");
        expect(() => selectMomentAICaptureFormat(session.sessionId, "format_4shot")).toThrow("Invalid capture format.");
    });

    it("accepts only JPEG media data URLs for captured originals", () => {
        let session = startMomentAIGuestSession();
        session = selectMomentAICaptureFormat(session.sessionId, "format_1shot");

        expect(() => addMomentAIGuestPhoto(session.sessionId, {
            photoId: "photo_png_data_url",
            shotIndex: 1,
            originalPath: "originals/capture_01.jpg",
            dataUrl: "data:image/png;base64,AAAA",
        })).toThrow("photo dataUrl must be a JPEG image data URL.");

        expect(() => addMomentAIGuestPhoto(session.sessionId, {
            photoId: "photo_jpg_alias_data_url",
            shotIndex: 1,
            originalPath: "originals/capture_01.jpg",
            dataUrl: "data:image/jpg;base64,AAAA",
        })).toThrow("photo dataUrl must be a JPEG image data URL.");

        expect(() => addMomentAIGuestPhoto(session.sessionId, {
            photoId: "photo_missing_data_url",
            shotIndex: 1,
            originalPath: "originals/capture_01.jpg",
        })).toThrow("photo dataUrl must be a JPEG image data URL.");

        expect(() => addMomentAIGuestPhoto(session.sessionId, {
            photoId: "photo_uppercase_jpeg_data_url",
            shotIndex: 1,
            originalPath: "originals/capture_01.jpg",
            dataUrl: "data:image/JPEG;base64,AAAA",
        })).toThrow("photo dataUrl must be a JPEG image data URL.");

        session = addMomentAIGuestPhoto(session.sessionId, {
            photoId: "photo_jpeg_data_url",
            shotIndex: 1,
            originalPath: "originals/capture_01.jpg",
            dataUrl: "data:image/jpeg;base64,AAAA",
        });

        expect(session.status).toBe("SELECTING_TEMPLATE");
    });
});
