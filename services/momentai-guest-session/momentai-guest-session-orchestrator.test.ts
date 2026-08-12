import { describe, expect, it } from "vitest";

import {
    addMomentAIGuestPhoto,
    completeMomentAIGuestSession,
    composeMomentAIOutputs,
    enqueueMomentAIAutoPrint,
    listMomentAITemplates,
    saveMomentAICustomization,
    selectMomentAICaptureFormat,
    selectMomentAITemplate,
    startMomentAIGuestSession,
} from "@/services/momentai-guest-session/momentai-guest-session-orchestrator.service";

describe("MomentAI guest session orchestrator", () => {
    it("runs the session from format selection to QR and background print without losing originals", () => {
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
        expect(session.outputs.share).toContain("https://gallery.momentai.vn/s/");
        expect(session.outputs.print).toContain("final-print");
        expect(session.qr?.status).toBe("ready");

        session = enqueueMomentAIAutoPrint(session.sessionId);
        expect(session.printJob?.status).toBe("queued");
        expect(session.photos).toHaveLength(2);
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
        expect(templates).toHaveLength(1);
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
