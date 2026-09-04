"use client";

import React, { useState, useEffect } from "react";
import { analyzeImportFrame } from "@/services/frame-import/frame-import-analyzer.service";
import type { FrameImportResult, FrameDefinition, ImportedFrameShotCount } from "@/services/frame-import/frame-import.types";
import { LocalFrameRegistry } from "@/services/frame/local-frame-registry";
import { FrameImportResultCard } from "./FrameImportResultCard";

interface ImageFileState {
    file: File;
    objectUrl: string;
    result?: FrameImportResult;
    error?: string;
    isPublished?: boolean;
}

interface AdminEventRecord {
    eventId: string;
    name: string;
    status: "active" | "archived";
}

type AdminFrameDefinition = FrameDefinition & { eventId?: string };

interface WindowMiniResult<T> {
    ok: boolean;
    value?: T;
    error?: unknown;
}

interface WindowMiniAdminBridge {
    events?: {
        list(): Promise<WindowMiniResult<AdminEventRecord[]>>;
        create(name: string): Promise<WindowMiniResult<AdminEventRecord>>;
    };
    templates?: {
        list(eventId?: string): Promise<WindowMiniResult<unknown[]>>;
        publish(templateId: string, eventId?: string): Promise<WindowMiniResult<void>>;
        archive(templateId: string, eventId?: string): Promise<WindowMiniResult<void>>;
        save?(eventId: string, frame: AdminFrameDefinition): Promise<WindowMiniResult<void>>;
        remove?(eventId: string, templateId: string): Promise<WindowMiniResult<void>>;
        clear?(eventId: string): Promise<WindowMiniResult<void>>;
    };
}

function getAdminBridge(): WindowMiniAdminBridge | null {
    if (typeof window === "undefined") return null;
    return (window.momentai?.admin as WindowMiniAdminBridge | undefined) ?? null;
}

function isElectronAdminRequired() {
    if (typeof window === "undefined") return false;
    const { hostname, port, protocol } = window.location;
    const isLoopback = hostname === "localhost" || hostname === "127.0.0.1";
    return !(protocol === "http:" && isLoopback && (port === "3000" || port === "5173" || port === "5174"));
}

function mapBridgeError(error: unknown, fallback: string) {
    if (error && typeof error === "object" && "technicalMessage" in error) {
        return String((error as { technicalMessage?: unknown }).technicalMessage || fallback);
    }
    if (typeof error === "string") return error;
    return fallback;
}

function mapTemplateSummaryToFrameDefinition(summary: unknown): AdminFrameDefinition {
    const value = summary as Partial<AdminFrameDefinition> & { templateId?: string; captureFormatId?: string };
    const parsedShotCount = Number(value.shotCount ?? String(value.captureFormatId ?? "format_4shot").match(/format_(\d+)shot/)?.[1] ?? 4);
    const shotCount: ImportedFrameShotCount = parsedShotCount === 1 || parsedShotCount === 2 || parsedShotCount === 6 || parsedShotCount === 8 ? parsedShotCount : 4;
    const isStrip = value.targetProduct === "STRIP_2" || value.targetProduct === "STRIP_4" || value.outputPaper === "5x15" || shotCount === 2 || (shotCount === 4 && (!value.outputWidth || !value.outputHeight || value.outputHeight >= value.outputWidth * 2.2));
    const targetProduct = value.targetProduct || (isStrip ? (shotCount === 2 ? "STRIP_2" : "STRIP_4") : (shotCount === 1 ? "PREMIUM_POSTCARD" : shotCount === 6 ? "SHEET_6" : "SHEET_4"));
    const outputPaper = value.outputPaper || (isStrip ? "5x15" : "10x15");
    const outputWidth = value.outputWidth && (!isStrip || value.outputWidth <= (value.outputHeight || 2700) * 0.5) ? value.outputWidth : (isStrip ? 900 : 1800);
    const outputHeight = value.outputHeight ?? 2700;
    const now = new Date().toISOString();
    return {
        id: String(value.id ?? value.templateId ?? `template_${shotCount}shot`),
        name: String(value.name ?? `${shotCount} Shot Template`),
        description: value.description ?? "Electron admin template summary",
        kind: "png-overlay",
        source: value.source ?? "canva",
        assetUrl: value.assetUrl ?? "",
        shotCount,
        targetProduct,
        outputPaper,
        orientation: value.orientation ?? value.photoViewportOrientation ?? "portrait",
        photoViewportOrientation: value.photoViewportOrientation ?? "portrait",
        photoAspectRatio: value.photoAspectRatio ?? "2:3",
        photoFit: value.photoFit ?? "contain",
        outputWidth,
        outputHeight,
        slots: value.slots ?? Array.from({ length: shotCount }, (_, index) => ({ id: `slot_${index + 1}`, index: index + 1, x: 0.1, y: 0.1 + index * (0.75 / shotCount), width: 0.8, height: Math.max(0.1, 0.7 / shotCount), photoViewportOrientation: "portrait" as const, shape: "rect" as const })),
        status: value.status === "private" ? "private" : "published",
        eventId: value.eventId,
        createdAt: value.createdAt ?? now,
        updatedAt: value.updatedAt ?? now,
    };
}

export interface FrameImportPanelProps {
    initialEventId?: string;
    onEventChange?: (eventId: string) => void;
}

export function FrameImportPanel({ initialEventId, onEventChange }: FrameImportPanelProps = {}) {
    const [fileStates, setFileStates] = useState<ImageFileState[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [filterStatus, setFilterStatus] = useState<"all" | "auto-approved" | "needs-review" | "rejected">("all");
    const [activeTab, setActiveTab] = useState<"import" | "registry">("import");
    const [allDefinitions, setAllDefinitions] = useState<readonly AdminFrameDefinition[]>([]);
    const [events, setEvents] = useState<readonly AdminEventRecord[]>([]);
    const [selectedEventId, setSelectedEventId] = useState(initialEventId || "event_hoi_an_heritage");
    const [newEventName, setNewEventName] = useState("");
    const [registryFilter, setRegistryFilter] = useState<"all" | "published" | "private">("all");
    const [isPublishing, setIsPublishing] = useState(false);

    useEffect(() => {
        if (initialEventId && initialEventId !== selectedEventId) {
            setSelectedEventId(initialEventId);
        }
    }, [initialEventId]);

    const refreshAdminRegistry = async (eventId = selectedEventId) => {
        const bridge = getAdminBridge();
        const [eventsResult, templatesResult] = await Promise.all([
            bridge?.events?.list(),
            bridge?.templates?.list(eventId),
        ]);
        if (eventsResult?.ok && templatesResult?.ok) {
            const nextEvents = eventsResult.value ?? [];
            setEvents(nextEvents);
            setAllDefinitions((templatesResult.value ?? []).map(mapTemplateSummaryToFrameDefinition));
            if (!nextEvents.some((event) => event.eventId === eventId) && nextEvents[0]) {
                setSelectedEventId(nextEvents[0].eventId);
            }
            return;
        }

        if (isElectronAdminRequired()) {
            throw new Error(mapBridgeError(eventsResult?.error ?? templatesResult?.error, "Electron admin preload is unavailable."));
        }

        try {
            const [eventsRes, framesRes] = await Promise.all([
                fetch("/api/admin/events"),
                fetch(`/api/admin/frames?eventId=${encodeURIComponent(eventId)}`),
            ]);
            const eventsPayload = await eventsRes.json() as { ok?: boolean; events?: AdminEventRecord[] };
            const framesPayload = await framesRes.json() as { ok?: boolean; frames?: AdminFrameDefinition[] };
            if (eventsPayload.ok && Array.isArray(eventsPayload.events) && eventsPayload.events.length > 0) {
                setEvents(eventsPayload.events);
                const targetEventId = eventsPayload.events.some((e) => e.eventId === eventId) ? eventId : eventsPayload.events[0].eventId;
                if (targetEventId !== selectedEventId) {
                    setSelectedEventId(targetEventId);
                }
            } else {
                setEvents([{ eventId: "event_hoi_an_heritage", name: "Phố Cổ Hội An", status: "active" }]);
            }

            if (framesPayload.ok && Array.isArray(framesPayload.frames)) {
                setAllDefinitions(framesPayload.frames);
                return;
            }
        } catch {
            // Fallback to LocalFrameRegistry if server API fails
        }

        const fallbackEvent = { eventId, name: "Local Dev Event", status: "active" as const };
        setEvents([fallbackEvent]);
        setAllDefinitions(LocalFrameRegistry.getAllDefinitions().map((definition) => ({ ...definition, eventId })));
    };

    useEffect(() => {
        void refreshAdminRegistry();
    }, []);

    useEffect(() => {
        void refreshAdminRegistry(selectedEventId);
        onEventChange?.(selectedEventId);
    }, [selectedEventId]);

    const selectedEvent = events.find((event) => event.eventId === selectedEventId);
    const publishedCount = allDefinitions.filter((d) => d.status !== "private").length;
    const privateCount = allDefinitions.filter((d) => d.status === "private").length;

    const processFiles = async (files: File[]) => {
        const pngFiles = files.filter((f) => f.type === "image/png").slice(0, 25);
        if (pngFiles.length === 0) return;

        setIsAnalyzing(true);
        const newStates: ImageFileState[] = await Promise.all(
            pngFiles.map(async (file) => {
                const dataUrl = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = () => resolve(URL.createObjectURL(file));
                    reader.readAsDataURL(file);
                });
                return {
                    file,
                    objectUrl: dataUrl,
                };
            })
        );

        setFileStates((prev) => [...prev, ...newStates]);

        for (const item of newStates) {
            try {
                const img = new Image();
                img.src = item.objectUrl;
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });

                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");

                if (!ctx) {
                    throw new Error("Canvas 2D context unavailable");
                }

                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, img.width, img.height);

                const result = analyzeImportFrame({
                    fileName: item.file.name,
                    rgba: imageData.data,
                    width: img.width,
                    height: img.height,
                });

                setFileStates((prev) =>
                    prev.map((s) =>
                        s.file.name === item.file.name ? { ...s, result } : s,
                    ),
                );
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : "Failed to analyze image";
                setFileStates((prev) =>
                    prev.map((s) =>
                        s.file.name === item.file.name ? { ...s, error: errorMsg } : s,
                    ),
                );
            }
        }

        setIsAnalyzing(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            processFiles(Array.from(e.target.files));
        }
    };

    const handleCreateEvent = async () => {
        const trimmed = newEventName.trim();
        if (!trimmed) return;
        const bridge = getAdminBridge();
        const result = await bridge?.events?.create(trimmed);
        if (result?.ok && result.value) {
            setNewEventName("");
            setSelectedEventId(result.value.eventId);
            await refreshAdminRegistry(result.value.eventId);
            return;
        }
        if (isElectronAdminRequired()) {
            window.alert(mapBridgeError(result?.error, "Không tạo được event qua Electron admin preload."));
            return;
        }

        try {
            const res = await fetch("/api/admin/events", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: trimmed }),
            });
            const payload = await res.json() as { ok?: boolean; event?: AdminEventRecord; error?: string };
            if (payload.ok && payload.event) {
                setNewEventName("");
                setSelectedEventId(payload.event.eventId);
                await refreshAdminRegistry(payload.event.eventId);
                return;
            }
            if (payload.error) {
                window.alert(`Không tạo được sự kiện: ${payload.error}`);
                return;
            }
        } catch {
            // Fallback to local state if fetch fails
        }

        const localEvent = { eventId: `event_${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "_") || "local"}`, name: trimmed || "Local Event", status: "active" as const };
        setEvents((prev) => [...prev, localEvent]);
        setNewEventName("");
        setSelectedEventId(localEvent.eventId);
    };

    const saveFrameToSelectedEvent = async (definition: FrameDefinition, targetEventId?: string, shouldRefresh = true) => {
        const eventIdToUse = targetEventId || selectedEventId;
        const cleanId = String(definition.id || "").replace(/[^a-zA-Z0-9_-]/g, "_").replace(/^_+|_+$/g, "") || "frame_id";
        const cleanEventId = String(eventIdToUse || "").replace(/[^a-zA-Z0-9_-]/g, "_").replace(/^_+|_+$/g, "") || "event";
        const definitionWithEvent = {
            ...definition,
            id: cleanId,
            eventId: cleanEventId,
            status: "published" as const,
        };
        const bridge = getAdminBridge();
        const result = await bridge?.templates?.save?.(cleanEventId, definitionWithEvent);
        if (result?.ok) {
            LocalFrameRegistry.notifyExternalChange();
            if (shouldRefresh) {
                await refreshAdminRegistry(cleanEventId);
            }
            return;
        }
        if (isElectronAdminRequired()) {
            throw new Error(mapBridgeError(result?.error, "Không lưu được khung qua Electron admin preload."));
        }
        try {
            await fetch("/api/admin/frames", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ eventId: cleanEventId, frame: definitionWithEvent }),
            });
        } catch {
            // Ignore web fetch failures in local storage fallback mode
        }
        LocalFrameRegistry.registerFrame(definitionWithEvent);
        LocalFrameRegistry.notifyExternalChange();
        if (shouldRefresh) {
            await refreshAdminRegistry(cleanEventId);
        }
    };

    const handlePublish = async (definition: FrameDefinition, fileName: string, targetEventId?: string) => {
        try {
            await saveFrameToSelectedEvent(definition, targetEventId, true);
            setFileStates((prev) =>
                prev.map((s) => (s.file.name === fileName ? { ...s, isPublished: true } : s)),
            );
        } catch (cause) {
            window.alert(cause instanceof Error ? cause.message : "Không publish được khung.");
        }
    };

    const handleToggleFrameStatus = async (frame: AdminFrameDefinition) => {
        const nextStatus = frame.status === "private" ? "published" : "private";
        const bridge = getAdminBridge();
        const result = nextStatus === "published"
            ? await bridge?.templates?.publish(frame.id, selectedEventId)
            : await bridge?.templates?.archive(frame.id, selectedEventId);
        if (result?.ok) {
            LocalFrameRegistry.notifyExternalChange();
            await refreshAdminRegistry(selectedEventId);
            return;
        }
        if (isElectronAdminRequired()) {
            window.alert(mapBridgeError(result?.error, "Không đổi được trạng thái khung qua Electron admin preload."));
            return;
        }
        LocalFrameRegistry.toggleFrameStatus(frame.id);
        LocalFrameRegistry.notifyExternalChange();
        await refreshAdminRegistry(selectedEventId);
    };

    const handleDeleteFrame = async (frame: AdminFrameDefinition) => {
        if (!window.confirm(`Bạn có muốn xoá khung "${frame.name}" khỏi SQLite Registry?`)) return;
        const bridge = getAdminBridge();
        if (bridge?.templates?.remove) {
            await bridge.templates.remove(selectedEventId, frame.id).catch(() => undefined);
            LocalFrameRegistry.removeFrame(frame.id);
            LocalFrameRegistry.notifyExternalChange();
            await refreshAdminRegistry(selectedEventId);
            return;
        }
        if (isElectronAdminRequired()) {
            LocalFrameRegistry.removeFrame(frame.id);
            LocalFrameRegistry.notifyExternalChange();
            await refreshAdminRegistry(selectedEventId);
            return;
        }
        try {
            await fetch(`/api/admin/frames?eventId=${encodeURIComponent(selectedEventId)}&frameId=${encodeURIComponent(frame.id)}`, {
                method: "DELETE",
            });
        } catch (err) {
            console.warn("Error deleting frame via web API:", err);
        }
        LocalFrameRegistry.removeFrame(frame.id);
        LocalFrameRegistry.notifyExternalChange();
        await refreshAdminRegistry(selectedEventId);
    };

    const handleClearSelectedEventFrames = async () => {
        if (!window.confirm("Bạn có chắc chắn muốn xoá TOÀN BỘ khung trong event đang chọn khỏi SQLite Registry?")) return;
        const bridge = getAdminBridge();
        if (bridge?.templates?.clear) {
            await bridge.templates.clear(selectedEventId).catch(() => undefined);
            LocalFrameRegistry.clear();
            LocalFrameRegistry.notifyExternalChange();
            await refreshAdminRegistry(selectedEventId);
            return;
        }
        if (isElectronAdminRequired()) {
            LocalFrameRegistry.clear();
            LocalFrameRegistry.notifyExternalChange();
            await refreshAdminRegistry(selectedEventId);
            return;
        }
        try {
            await fetch(`/api/admin/frames?eventId=${encodeURIComponent(selectedEventId)}`, {
                method: "DELETE",
            });
        } catch (err) {
            console.warn("Error clearing frames via web API:", err);
        }
        LocalFrameRegistry.clear();
        LocalFrameRegistry.notifyExternalChange();
        await refreshAdminRegistry(selectedEventId);
    };

    const handleReject = (importId: string) => {
        setFileStates((prev) => prev.filter((s) => s.result?.importId !== importId));
    };

    const handlePublishAllApproved = async () => {
        if (isPublishing) return;
        setIsPublishing(true);
        try {
            for (const item of fileStates) {
                if (
                    item.result &&
                    (item.result.status === "auto-approved" || item.result.status === "needs-review") &&
                    !item.isPublished
                ) {
                    try {
                        const defaultName = item.file.name
                            .replace(/\.[^/.]+$/, "")
                            .replace(/[-_]/g, " ")
                            .replace(/\b\w/g, (c) => c.toUpperCase());

                        const photoViewportOrientation: "portrait" | "landscape" =
                            item.result.image.width > item.result.image.height ? "landscape" : "portrait";
                        const photoAspectRatio = photoViewportOrientation === "landscape" ? "3:2" : "2:3";
                        const supportedShotCounts = [1, 2, 4, 6, 8] as const;
                        const detectedShotCount = (supportedShotCounts.find((count) => count === item.result!.slots.length) || item.result!.slots.length || 1) as 1 | 2 | 4 | 6 | 8;
                        const isStrip = detectedShotCount === 2 || (detectedShotCount === 4 && item.result.image.height >= item.result.image.width * 2.2);
                        const targetProduct = (isStrip ? (detectedShotCount === 2 ? "STRIP_2" : "STRIP_4") : (detectedShotCount === 1 ? "PREMIUM_POSTCARD" : detectedShotCount === 6 ? "SHEET_6" : "SHEET_4")) as "STRIP_2" | "STRIP_4" | "PREMIUM_POSTCARD" | "SHEET_4" | "SHEET_6";
                        const outputPaper = targetProduct === "STRIP_2" || targetProduct === "STRIP_4" ? "5x15" : "10x15";

                        const definitionSlots = item.result.slots.map((s) => ({
                            id: s.id,
                            index: s.order,
                            x: s.normalizedBounds.x,
                            y: s.normalizedBounds.y,
                            width: s.normalizedBounds.width,
                            height: s.normalizedBounds.height,
                            photoViewportOrientation,
                            shape: s.shape ?? "rect",
                            points: s.points,
                        }));

                        const definition: FrameDefinition = {
                            id: `imported-${item.result.importId}`,
                            name: defaultName,
                            description: "Canva imported frame overlay",
                            kind: "png-overlay",
                            source: "canva",
                            assetUrl: item.objectUrl,
                            assets: {
                                overlay: item.objectUrl,
                                background: "#ffffff",
                            },
                            shotCount: detectedShotCount,
                            targetProduct,
                            outputPaper,
                            orientation: photoViewportOrientation,
                            photoViewportOrientation,
                            photoAspectRatio,
                            photoFit: "contain",
                            outputWidth: item.result.image.width,
                            outputHeight: item.result.image.height,
                            slots: definitionSlots,
                            status: "published",
                        };

                        await saveFrameToSelectedEvent(definition, selectedEventId, false);
                        setFileStates((prev) =>
                            prev.map((s) => (s.file.name === item.file.name ? { ...s, isPublished: true } : s)),
                        );
                    } catch (err) {
                        console.warn(`Lỗi khi publish khung ${item.file.name}:`, err);
                    }
                }
            }
            await refreshAdminRegistry(selectedEventId);
        } finally {
            setIsPublishing(false);
        }
    };

    const handleClearList = () => {
        fileStates.forEach((s) => URL.revokeObjectURL(s.objectUrl));
        setFileStates([]);
    };

    const filteredStates = fileStates.filter((s) => {
        if (filterStatus === "all") return true;
        return s.result?.status === filterStatus;
    });

    const filteredDefinitions = allDefinitions.filter((d) => {
        if (registryFilter === "all") return true;
        if (registryFilter === "published") return d.status !== "private";
        return d.status === "private";
    });

    const counts = {
        total: fileStates.length,
        autoApproved: fileStates.filter((s) => s.result?.status === "auto-approved").length,
        needsReview: fileStates.filter((s) => s.result?.status === "needs-review").length,
        rejected: fileStates.filter((s) => s.result?.status === "rejected").length,
    };

    return (
        <div className="space-y-6">
            <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-xs">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.24em] text-pink-600">Frame Import Console</p>
                        <h2 className="mt-2 text-3xl font-black tracking-tight text-neutral-950">Canva frame registry</h2>
                        <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-neutral-600">
                            Import PNG overlay frames, detect transparent photo slots, and publish them through the Electron admin preload boundary.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-bold text-neutral-700">
                        Event: <span className="text-neutral-950">{selectedEvent?.name ?? selectedEventId}</span>
                    </div>
                </div>
            </div>

            <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-xs">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setActiveTab("import")} className={`rounded-2xl px-4 py-2 text-sm font-black ${activeTab === "import" ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-700"}`}>Import</button>
                        <button type="button" onClick={() => setActiveTab("registry")} className={`rounded-2xl px-4 py-2 text-sm font-black ${activeTab === "registry" ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-700"}`}>Registry ({allDefinitions.length})</button>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <select value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)} className="rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm font-bold text-neutral-800">
                            {events.map((event) => <option key={event.eventId} value={event.eventId}>{event.name}</option>)}
                        </select>
                        <input value={newEventName} onChange={(event) => setNewEventName(event.target.value)} placeholder="New event name" className="rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm font-bold text-neutral-800" />
                        <button type="button" onClick={() => void handleCreateEvent()} className="rounded-2xl bg-pink-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50" disabled={newEventName.trim().length < 2}>Create event</button>
                    </div>
                </div>
            </div>

            {activeTab === "import" ? (
                <div className="space-y-5">
                    <div className="rounded-3xl border-2 border-dashed border-neutral-300 bg-white p-8 text-center shadow-xs">
                        <input type="file" multiple accept="image/png" onChange={handleFileChange} className="mx-auto block max-w-sm rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-sm font-bold" />
                        <p className="mt-4 text-sm font-semibold text-neutral-600">PNG only · max 25 files per batch · analysis happens in renderer memory</p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-4">
                        <Stat label="Total" value={counts.total} />
                        <Stat label="Auto approved" value={counts.autoApproved} />
                        <Stat label="Needs review" value={counts.needsReview} />
                        <Stat label="Rejected" value={counts.rejected} />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {(["all", "auto-approved", "needs-review", "rejected"] as const).map((status) => (
                            <button key={status} type="button" onClick={() => setFilterStatus(status)} className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide ${filterStatus === status ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-700"}`}>{status}</button>
                        ))}
                        <button
                            type="button"
                            onClick={() => void handlePublishAllApproved()}
                            disabled={isPublishing || !fileStates.some((s) => s.result && s.result.status !== "rejected" && !s.isPublished)}
                            className="ml-auto rounded-full bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:bg-emerald-700 disabled:opacity-40"
                        >
                            {isPublishing ? "Đang xuất bản..." : "Publish approved"}
                        </button>
                        <button type="button" onClick={handleClearList} className="rounded-full bg-neutral-100 px-4 py-2 text-xs font-black uppercase tracking-wide text-neutral-700">Clear list</button>
                    </div>

                    {isAnalyzing && <div className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">Analyzing frame transparency and slot geometry…</div>}

                    <div className="flex flex-col gap-6 w-full">
                        {filteredStates.map((item) => item.result ? (
                            <FrameImportResultCard
                                key={item.file.name}
                                imageUrl={item.objectUrl}
                                result={item.result}
                                events={events}
                                selectedEventId={selectedEventId}
                                isPublished={item.isPublished}
                                onPublish={(definition, targetEventId) => void handlePublish(definition, item.file.name, targetEventId)}
                                onReject={handleReject}
                            />
                        ) : (
                            <div key={item.file.name} className="rounded-3xl border border-neutral-200 bg-white p-5 text-sm font-bold text-neutral-600">
                                {item.error ? `Không phân tích được ${item.file.name}: ${item.error}` : `Đang chờ phân tích ${item.file.name}...`}
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-5">
                    <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-xs">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h3 className="text-xl font-black text-neutral-950">Published registry</h3>
                                <p className="mt-1 text-sm font-semibold text-neutral-600">Published: {publishedCount} · Private: {privateCount}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(["all", "published", "private"] as const).map((status) => (
                                    <button key={status} type="button" onClick={() => setRegistryFilter(status)} className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide ${registryFilter === status ? "bg-neutral-950 text-white" : "bg-neutral-100 text-neutral-700"}`}>{status}</button>
                                ))}
                                <button type="button" onClick={() => void handleClearSelectedEventFrames()} className="rounded-full bg-rose-100 px-4 py-2 text-xs font-black uppercase tracking-wide text-rose-700">Clear event frames</button>
                            </div>
                        </div>
                    </div>

                    {filteredDefinitions.length === 0 ? (
                        <div className="rounded-3xl border border-neutral-200 bg-white p-8 text-center text-sm font-bold text-neutral-500">No frames in this registry view.</div>
                    ) : (
                        <div className="grid gap-4 xl:grid-cols-2">
                            {filteredDefinitions.map((def) => {
                                const isPrivate = def.status === "private";
                                return (
                                    <div key={def.id} className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-xs">
                                        <div className="mb-3 flex items-start justify-between gap-3">
                                            <div>
                                                <h4 className="font-black text-neutral-950">{def.name}</h4>
                                                <p className="text-xs font-bold text-neutral-500">{def.id}</p>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="inline-flex items-center gap-1 rounded-full border border-pink-200 bg-pink-50 px-2.5 py-0.5 text-xs font-bold text-pink-950">
                                                    🏷️ {events.find((e) => e.eventId === def.eventId)?.name ?? def.eventId ?? selectedEventId}
                                                </span>
                                                {isPrivate ? (
                                                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-900">Private</span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2.5 py-0.5 text-xs font-black text-emerald-900">Published</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 items-center">
                                            <div
                                                className="mx-auto overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 p-1 flex items-center justify-center relative bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:8px_8px]"
                                                style={{
                                                    maxHeight: "180px",
                                                    aspectRatio: def.outputWidth && def.outputHeight ? `${def.outputWidth} / ${def.outputHeight}` : "2 / 3",
                                                }}
                                            >
                                                {def.assetUrl ? (
                                                    <img src={def.assetUrl} alt={def.name} className="h-full w-full rounded-lg object-contain" />
                                                ) : (
                                                    <div className="flex h-24 items-center justify-center text-xs font-bold text-neutral-500">No preview image</div>
                                                )}
                                            </div>

                                            <div className="space-y-1.5 text-xs">
                                                <Info label="Shots" value={`${def.shotCount} shots`} />
                                                <Info label="Slots" value={`${def.slots.length} ô`} />
                                                <Info label="Size" value={`${def.outputWidth}×${def.outputHeight}`} />
                                                <Info label="Source" value={def.source} />
                                            </div>
                                        </div>

                                        <div className="mt-4 flex items-center justify-between gap-2 border-t border-neutral-100 pt-3">
                                            <button type="button" onClick={() => void handleToggleFrameStatus(def)} className={`flex-1 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all ${isPrivate ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200"}`}>{isPrivate ? "Đăng publish" : "Chuyển private"}</button>
                                            <button type="button" onClick={() => void handleDeleteFrame(def)} className="rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50">Xoá</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function Stat({ label, value }: { label: string; value: number }) {
    return <div className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-xs"><p className="text-xs font-black uppercase tracking-wide text-neutral-500">{label}</p><p className="mt-1 text-3xl font-black text-neutral-950">{value}</p></div>;
}

function Info({ label, value }: { label: string; value: string }) {
    return <div className="flex justify-between text-neutral-600"><span>{label}:</span><span className="font-bold text-neutral-900">{value}</span></div>;
}
