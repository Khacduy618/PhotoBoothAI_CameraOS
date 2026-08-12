import type {
    MomentAICaptureFormat,
    MomentAICaptureFormatId,
    MomentAICustomization,
    MomentAIOutputs,
    MomentAIGuestPhoto,
    MomentAIPrintJob,
    MomentAIGuestSession,
    MomentAISlotAssignment,
    MomentAITemplate,
} from "@/types/momentai-guest-session";
import { createMomentAIGuestSession, MOMENTAI_CAPTURE_FORMATS } from "@/types/momentai-guest-session";

const EVENT_ID = "event_hoi_an_heritage";

export const MOMENTAI_TEMPLATES: readonly MomentAITemplate[] = [
    {
        templateId: "tpl_hoi_an_1_editorial",
        eventId: EVENT_ID,
        captureFormatId: "format_1shot",
        name: "Phố Cổ Editorial",
        status: "PUBLISHED",
        canvas: { width: 1200, height: 1800 },
        slots: [{ slotIndex: 1, x: 8, y: 6, width: 84, height: 72 }],
        assets: { background: "#FDFCFB", overlayColor: "#1A1A1A", textColor: "#1A1A1A" },
        customization: { allowTyping: true, allowDraw: true, textPlaceholder: "Gõ lời nhắn kỉ niệm...", maxLength: 50 },
        printProfile: { paper: "4x6", orientation: "portrait", dpi: 300 },
    },
    {
        templateId: "tpl_hoi_an_2_duo",
        eventId: EVENT_ID,
        captureFormatId: "format_2shot",
        name: "Kí Ức Đôi",
        status: "PUBLISHED",
        canvas: { width: 1200, height: 1800 },
        slots: [
            { slotIndex: 1, x: 8, y: 6, width: 84, height: 38 },
            { slotIndex: 2, x: 8, y: 48, width: 84, height: 38 },
        ],
        assets: { background: "#F5F2EB", overlayColor: "#1A1A1A", textColor: "#1A1A1A" },
        customization: { allowTyping: true, allowDraw: false, textPlaceholder: "Gõ câu chúc...", maxLength: 50 },
        printProfile: { paper: "4x6", orientation: "portrait", dpi: 300 },
    },
    {
        templateId: "tpl_hoi_an_4_strip",
        eventId: EVENT_ID,
        captureFormatId: "format_4shot",
        name: "Dải 1x4 Phố Cổ",
        status: "PUBLISHED",
        canvas: { width: 1200, height: 1800 },
        slots: [
            { slotIndex: 1, x: 8, y: 4, width: 84, height: 18 },
            { slotIndex: 2, x: 8, y: 24, width: 84, height: 18 },
            { slotIndex: 3, x: 8, y: 44, width: 84, height: 18 },
            { slotIndex: 4, x: 8, y: 64, width: 84, height: 18 },
        ],
        assets: { background: "#FDFCFB", overlayColor: "#1A1A1A", textColor: "#1A1A1A" },
        customization: { allowTyping: true, allowDraw: true, textPlaceholder: "Kỉ niệm Phố Cổ Hội An", maxLength: 50 },
        printProfile: { paper: "4x6", orientation: "portrait", dpi: 300 },
    },
    {
        templateId: "tpl_hoi_an_6_grid",
        eventId: EVENT_ID,
        captureFormatId: "format_6shot",
        name: "Lưới 2x3 Di Sản",
        status: "PUBLISHED",
        canvas: { width: 1200, height: 1800 },
        slots: [
            { slotIndex: 1, x: 4, y: 4, width: 44, height: 25 },
            { slotIndex: 2, x: 52, y: 4, width: 44, height: 25 },
            { slotIndex: 3, x: 4, y: 31, width: 44, height: 25 },
            { slotIndex: 4, x: 52, y: 31, width: 44, height: 25 },
            { slotIndex: 5, x: 4, y: 58, width: 44, height: 25 },
            { slotIndex: 6, x: 52, y: 58, width: 44, height: 25 },
        ],
        assets: { background: "#F5F2EB", overlayColor: "#1A1A1A", textColor: "#1A1A1A" },
        customization: { allowTyping: false, allowDraw: false },
        printProfile: { paper: "6x8", orientation: "portrait", dpi: 300 },
    },
] as const;

const sessions = new Map<string, MomentAIGuestSession>();
const processedPrintKeys = new Map<string, MomentAIPrintJob>();

function touch(session: MomentAIGuestSession, status?: MomentAIGuestSession["status"]): MomentAIGuestSession {
    const updated = { ...session, status: status ?? session.status, updatedAt: new Date().toISOString() };
    sessions.set(updated.sessionId, updated);
    return updated;
}

export function startMomentAIGuestSession(eventId = EVENT_ID): MomentAIGuestSession {
    const session = createMomentAIGuestSession(eventId);
    sessions.set(session.sessionId, session);
    return session;
}

export function getMomentAIGuestSession(sessionId: string): MomentAIGuestSession | null {
    return sessions.get(sessionId) ?? null;
}

export function listMomentAICaptureFormats(): readonly MomentAICaptureFormat[] {
    return MOMENTAI_CAPTURE_FORMATS;
}

export function selectMomentAICaptureFormat(sessionId: string, formatId: MomentAICaptureFormatId): MomentAIGuestSession {
    const session = requireSession(sessionId);
    const captureFormat = MOMENTAI_CAPTURE_FORMATS.find((format) => format.id === formatId);
    if (!captureFormat) throw new Error("Invalid capture format.");
    return touch({ ...session, captureFormat, photos: [], selectedTemplate: null, slotAssignments: [], outputs: { master: null, share: null, print: null } }, "READY_TO_CAPTURE");
}

export function addMomentAIGuestPhoto(sessionId: string, photo: Omit<MomentAIGuestPhoto, "sessionId" | "status" | "capturedAt"> & Partial<Pick<MomentAIGuestPhoto, "capturedAt" | "status">>): MomentAIGuestSession {
    const session = requireSession(sessionId);
    if (!session.captureFormat) throw new Error("Capture format is required before capture.");
    if (session.status !== "READY_TO_CAPTURE" && session.status !== "CAPTURING") {
        throw new Error("Session is not accepting captured photos.");
    }
    validatePhotoInput(photo, session.captureFormat.shotCount);
    if (session.photos.some((existing) => existing.photoId === photo.photoId)) return session;
    if (session.photos.some((existing) => existing.shotIndex === photo.shotIndex && existing.status === "valid")) {
        throw new Error("A valid original already exists for this shot index.");
    }
    const nextPhoto: MomentAIGuestPhoto = {
        ...photo,
        sessionId,
        status: photo.status ?? "valid",
        capturedAt: photo.capturedAt ?? new Date().toISOString(),
    };
    const photos = [...session.photos, nextPhoto].sort((a, b) => a.shotIndex - b.shotIndex);
    const nextStatus = photos.filter((p) => p.status === "valid").length >= session.captureFormat.shotCount ? "SELECTING_TEMPLATE" : "CAPTURING";
    return touch({ ...session, photos }, nextStatus);
}

export function listMomentAITemplates(eventId: string, captureFormatId: MomentAICaptureFormatId): readonly MomentAITemplate[] {
    return MOMENTAI_TEMPLATES.filter((template) => template.eventId === eventId && template.captureFormatId === captureFormatId && template.status === "PUBLISHED");
}

export function selectMomentAITemplate(sessionId: string, templateId: string): MomentAIGuestSession {
    const session = requireSession(sessionId);
    if (!session.captureFormat) throw new Error("Capture format is required before template selection.");
    const template = MOMENTAI_TEMPLATES.find((item) => item.templateId === templateId && item.eventId === session.eventId && item.captureFormatId === session.captureFormat?.id && item.status === "PUBLISHED");
    if (!template) throw new Error("Template is not compatible with this session.");
    const slotAssignments = assignSlots(session.photos, template);
    const nextStatus = template.customization.allowTyping || template.customization.allowDraw ? "CUSTOMIZING" : "COMPOSING";
    return touch({ ...session, selectedTemplate: template, slotAssignments }, nextStatus);
}

export function saveMomentAICustomization(sessionId: string, customization: MomentAICustomization): MomentAIGuestSession {
    const session = requireSession(sessionId);
    if (!session.selectedTemplate) throw new Error("Template is required before customization.");
    return touch({ ...session, customization }, "COMPOSING");
}

export function composeMomentAIOutputs(sessionId: string): MomentAIGuestSession {
    const session = requireSession(sessionId);
    if (!session.selectedTemplate) throw new Error("Template is required before composition.");
    if (!session.captureFormat) throw new Error("Capture format is required before composition.");
    if (session.photos.filter((photo) => photo.status === "valid").length < session.captureFormat.shotCount) {
        throw new Error("Not enough preserved originals for composition.");
    }
    const safeToken = encodeURIComponent(session.sessionId);
    const outputs: MomentAIOutputs = {
        master: `/outputs/${safeToken}/final-master.png`,
        share: `https://gallery.momentai.vn/s/${safeToken}`,
        print: `/outputs/${safeToken}/final-print.jpg`,
    };
    const qr = { url: outputs.share!, status: "ready" as const };
    return touch({ ...session, outputs, qr }, "RESULT_READY");
}

export function enqueueMomentAIAutoPrint(sessionId: string, copies = 1): MomentAIGuestSession {
    const session = requireSession(sessionId);
    if (!session.selectedTemplate || !session.outputs.print) throw new Error("Print output is required before auto print.");
    const idempotencyKey = `${session.sessionId}_${session.selectedTemplate.templateId}_${session.outputs.print}_${copies}`;
    const existing = processedPrintKeys.get(idempotencyKey);
    if (existing) return touch({ ...session, printJob: existing }, session.status);
    const printJob: MomentAIPrintJob = {
        jobId: `print_${Date.now()}`,
        sessionId,
        templateId: session.selectedTemplate.templateId,
        file: session.outputs.print,
        paper: session.selectedTemplate.printProfile.paper,
        copies,
        status: "queued",
        createdAt: new Date().toISOString(),
        attempts: 1,
    };
    processedPrintKeys.set(idempotencyKey, printJob);
    return touch({ ...session, printJob }, session.status);
}

export function completeMomentAIGuestSession(sessionId: string): MomentAIGuestSession {
    const session = requireSession(sessionId);
    if (session.status !== "RESULT_READY") {
        throw new Error("Session can only complete from RESULT_READY.");
    }
    return touch({ ...session, completedAt: new Date().toISOString() }, "COMPLETED");
}

function validatePhotoInput(
    photo: Omit<MomentAIGuestPhoto, "sessionId" | "status" | "capturedAt">,
    shotCount: number,
): void {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(photo.photoId)) {
        throw new Error("photoId contains unsafe characters.");
    }
    if (!Number.isInteger(photo.shotIndex) || photo.shotIndex < 1 || photo.shotIndex > shotCount) {
        throw new Error("shotIndex is outside the selected capture format.");
    }
    if (!/^originals\/capture_[0-9]{2}\.(jpg|jpeg)$/i.test(photo.originalPath)) {
        throw new Error("originalPath must be a safe originals/capture_## JPEG path.");
    }
    if (!photo.dataUrl || !/^data:image\/jpeg(?:;|,)/.test(photo.dataUrl)) {
        throw new Error("photo dataUrl must be a JPEG image data URL.");
    }
}

function assignSlots(photos: readonly MomentAIGuestPhoto[], template: MomentAITemplate): MomentAISlotAssignment[] {
    return template.slots.map((slot) => {
        const photo = photos.find((item) => item.shotIndex === slot.slotIndex);
        if (!photo) throw new Error(`Missing original photo for slot ${slot.slotIndex}.`);
        return { slotIndex: slot.slotIndex, photoId: photo.photoId };
    });
}

function requireSession(sessionId: string): MomentAIGuestSession {
    const session = sessions.get(sessionId);
    if (!session) throw new Error("Session not found.");
    return session;
}
