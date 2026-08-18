import { randomUUID } from "node:crypto";

export type MomentAICaptureFormatId = "format_1shot" | "format_2shot" | "format_4shot" | "format_6shot";

export type MomentAILayoutType = "single" | "vertical_2" | "vertical_4" | "2col_3row";

export type MomentAIGuestSessionStatus =
    | "CREATED"
    | "SELECTING_FORMAT"
    | "READY_TO_CAPTURE"
    | "CAPTURING"
    | "SELECTING_TEMPLATE"
    | "CUSTOMIZING"
    | "COMPOSING"
    | "RESULT_READY"
    | "COMPLETED"
    | "CAMERA_ERROR"
    | "CAPTURE_ERROR"
    | "IMAGE_ERROR"
    | "STORAGE_ERROR"
    | "TEMPLATE_ERROR"
    | "COMPOSITION_ERROR"
    | "QR_ERROR"
    | "PRINT_ERROR";

export interface MomentAICaptureFormat {
    id: MomentAICaptureFormatId;
    label: string;
    shotCount: number;
    slotCount: number;
    layoutType: MomentAILayoutType;
}

export interface MomentAIGuestPhoto {
    photoId: string;
    sessionId: string;
    shotIndex: number;
    originalPath: string;
    status: "valid" | "invalid";
    capturedAt: string;
    dataUrl?: string;
}

export interface MomentAITemplateSlot {
    slotIndex: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface MomentAITemplate {
    templateId: string;
    eventId: string;
    captureFormatId: MomentAICaptureFormatId;
    name: string;
    status: "PUBLISHED" | "DRAFT";
    canvas: {
        width: number;
        height: number;
    };
    slots: MomentAITemplateSlot[];
    assets: {
        background: string;
        overlayColor: string;
        textColor: string;
    };
    customization: {
        allowTyping: boolean;
        allowDraw: boolean;
        textPlaceholder?: string;
        maxLength?: number;
    };
    printProfile: {
        paper: "4x6" | "6x8" | "2x6-double";
        orientation: "portrait" | "landscape";
        dpi: number;
    };
}

export interface MomentAISlotAssignment {
    slotIndex: number;
    photoId: string;
}

export interface MomentAICustomization {
    text: Array<{ regionId: string; value: string }>;
    drawing: Array<{
        strokeId: string;
        points: Array<[number, number]>;
        width: number;
        color: string;
    }>;
}

export interface MomentAIOutputs {
    master: string | null;
    share: string | null;
    print: string | null;
}

export interface MomentAIPrintJob {
    jobId: string;
    sessionId: string;
    templateId: string;
    file: string;
    paper: string;
    copies: number;
    status: "queued" | "printing" | "completed" | "failed";
    createdAt: string;
    attempts: number;
}

export interface MomentAIGuestSession {
    sessionId: string;
    eventId: string;
    captureFormat: MomentAICaptureFormat | null;
    photos: MomentAIGuestPhoto[];
    selectedTemplate: MomentAITemplate | null;
    slotAssignments: MomentAISlotAssignment[];
    customization: MomentAICustomization;
    outputs: MomentAIOutputs;
    qr: { url: string; status: "pending" | "ready" | "failed" } | null;
    printJob: MomentAIPrintJob | null;
    status: MomentAIGuestSessionStatus;
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
}

export const MOMENTAI_CAPTURE_FORMATS: readonly MomentAICaptureFormat[] = [
    { id: "format_1shot", label: "1 Shot", shotCount: 1, slotCount: 1, layoutType: "single" },
    { id: "format_2shot", label: "2 Shots", shotCount: 2, slotCount: 2, layoutType: "vertical_2" },
    { id: "format_4shot", label: "4 Shots", shotCount: 4, slotCount: 4, layoutType: "vertical_4" },
    { id: "format_6shot", label: "6 Shots", shotCount: 6, slotCount: 6, layoutType: "2col_3row" },
] as const;

export function createMomentAIGuestSession(eventId = "event_hoi_an_heritage"): MomentAIGuestSession {
    const now = new Date().toISOString();
    return {
        sessionId: `sess_${Date.now()}_${randomUUID().slice(0, 8)}`,
        eventId,
        captureFormat: null,
        photos: [],
        selectedTemplate: null,
        slotAssignments: [],
        customization: { text: [], drawing: [] },
        outputs: { master: null, share: null, print: null },
        qr: null,
        printJob: null,
        status: "SELECTING_FORMAT",
        createdAt: now,
        updatedAt: now,
    };
}
