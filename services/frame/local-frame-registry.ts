import type { FrameConfig } from "@/types/theme";
import type { FrameDefinition, FrameDefinitionSlot } from "@/services/frame-import/frame-import.types";
import { convertFrameDefinitionToRuntimeFrame } from "@/services/frame-import/frame-definition.adapter";
import { normalizeSlotToUnit } from "@/services/frame/resolveTargetProduct";

// v3: Immutable original frame PNGs with canonical 0..1 normalized slot geometry.
const STORAGE_KEY = "photobooth_imported_frames_v3";
const REGISTRY_CHANGED_EVENT = "cameraos-frame-registry-changed";

type RegistryListener = () => void;

function getFrameTimestamp(definition: FrameDefinition): number {
    return Date.parse(definition.updatedAt ?? definition.createdAt ?? "") || 0;
}

function sortByLatestUpdate(definitions: readonly FrameDefinition[]): FrameDefinition[] {
    return [...definitions].sort((a, b) => getFrameTimestamp(b) - getFrameTimestamp(a));
}

function normalizeFrameDefinition(definition: FrameDefinition): FrameDefinition {
    const isExplicitStrip = definition.targetProduct === "STRIP_2" || definition.targetProduct === "STRIP_4" || definition.outputPaper === "5x15" || definition.shotCount === 2;
    const isSingleColumn4 = definition.shotCount === 4 && (
        !definition.outputWidth ||
        !definition.outputHeight ||
        definition.outputHeight >= definition.outputWidth * 1.8 ||
        (Array.isArray(definition.slots) && definition.slots.length === 4 && Math.abs(Math.max(...definition.slots.map((s) => s.x)) - Math.min(...definition.slots.map((s) => s.x))) < 0.15)
    );
    const isStrip = isExplicitStrip || isSingleColumn4;
    const targetProduct = definition.targetProduct || (isStrip ? (definition.shotCount === 2 ? "STRIP_2" : "STRIP_4") : (definition.shotCount === 1 ? "PREMIUM_POSTCARD" : definition.shotCount === 6 ? "SHEET_6" : "SHEET_4"));
    const outputPaper = definition.outputPaper || (isStrip ? "5x15" : "10x15");

    const origH = definition.outputHeight > 0 ? definition.outputHeight : 2700;
    const origW = definition.outputWidth > 0 ? definition.outputWidth : (isStrip ? 900 : 1800);

    const isLowRes = origH < 1800 || origW < 600;
    const isOverSized = origH > 2700 || origW > 2700;
    let height: number;
    let width: number;

    if (isLowRes) {
        height = 2700;
        width = isStrip ? 900 : (definition.orientation === "landscape" ? 2700 : 1800);
    } else if (isOverSized) {
        const scale = 2700 / Math.max(origW, origH);
        width = Math.round(origW * scale);
        height = Math.round(origH * scale);
        if (isStrip && width >= height * 0.45) {
            width = Math.round(height / 3);
        }
    } else {
        height = origH;
        width = origW > 0 && (!isStrip || origW <= height * 0.45)
            ? origW
            : (isStrip ? Math.round(height / 3) : 1800);
    }
    const orientation = isStrip ? "portrait" : (definition.orientation || (width > height ? "landscape" : "portrait"));

    const normalizedSlots: FrameDefinitionSlot[] = (definition.slots || []).map((slot, index) => {
        const unitBounds = normalizeSlotToUnit(slot, origW, origH);
        return {
            ...slot,
            id: slot.id || `slot_${index + 1}`,
            index: typeof slot.index === "number" ? slot.index : index + 1,
            x: unitBounds.x,
            y: unitBounds.y,
            width: unitBounds.width,
            height: unitBounds.height,
        };
    });

    return {
        ...definition,
        targetProduct,
        outputPaper,
        orientation,
        outputWidth: width,
        outputHeight: height,
        slots: normalizedSlots,
    };
}

function isValidFrameDefinition(definition: FrameDefinition): boolean {
    if (!definition.id || !definition.name || definition.kind !== "png-overlay") return false;
    if (
        definition.assetUrl &&
        !definition.assetUrl.startsWith("data:image/") &&
        !definition.assetUrl.startsWith("blob:") &&
        !definition.assetUrl.startsWith("/api/local-media/") &&
        !definition.assetUrl.startsWith("/frames/") &&
        !definition.assetUrl.startsWith("/backgrounds/") &&
        !definition.assetUrl.startsWith("/") &&
        !definition.assetUrl.startsWith("./") &&
        !definition.assetUrl.startsWith("http://") &&
        !definition.assetUrl.startsWith("https://")
    ) return false;
    if (!Number.isFinite(definition.outputWidth) || definition.outputWidth <= 0) return false;
    if (!Number.isFinite(definition.outputHeight) || definition.outputHeight <= 0) return false;
    if (!definition.shotCount || ![1, 2, 4, 6, 8].includes(definition.shotCount)) return false;
    if (!Array.isArray(definition.slots) || definition.slots.length !== definition.shotCount) return false;

    return definition.slots.every((slot) => (
        Number.isFinite(slot.x) &&
        Number.isFinite(slot.y) &&
        Number.isFinite(slot.width) &&
        Number.isFinite(slot.height) &&
        slot.x >= 0 &&
        slot.y >= 0 &&
        slot.width > 0 &&
        slot.height > 0
    ));
}

class LocalFrameRegistryService {
    private inMemoryDefinitions: FrameDefinition[] = [];
    private listeners: Set<RegistryListener> = new Set();
    private storageListenerAttached = false;

    constructor() {
        this.loadFromStorage();
        this.attachStorageListener();
    }

    private loadFromStorage(): void {
        if (typeof window === "undefined" || !window.localStorage) {
            return;
        }

        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    this.inMemoryDefinitions = sortByLatestUpdate(
                        parsed.filter(isValidFrameDefinition).map(normalizeFrameDefinition),
                    );
                }
            }
        } catch {
            this.inMemoryDefinitions = [];
        }
    }

    private attachStorageListener(): void {
        if (
            this.storageListenerAttached ||
            typeof window === "undefined" ||
            typeof window.addEventListener !== "function"
        ) {
            return;
        }

        this.storageListenerAttached = true;
        window.addEventListener("storage", (event) => {
            if (event.key === STORAGE_KEY) {
                this.loadFromStorage();
                this.notify();
            }
        });
        window.addEventListener(REGISTRY_CHANGED_EVENT, () => {
            this.notify();
        });
    }

    private saveToStorage(): void {
        if (typeof window === "undefined" || !window.localStorage) {
            return;
        }

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.inMemoryDefinitions));
        } catch {
            // Ignore quota or storage errors in restricted contexts
        }
    }

    private notify(): void {
        for (const listener of this.listeners) {
            try {
                listener();
            } catch {
                // Ignore listener exceptions
            }
        }
    }

    public notifyExternalChange(): void {
        this.notify();
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent(REGISTRY_CHANGED_EVENT));
        }
    }

    private hasDefinitionsChanged(incoming: FrameDefinition[]): boolean {
        if (incoming.length !== this.inMemoryDefinitions.length) return true;
        for (let i = 0; i < incoming.length; i += 1) {
            const a = incoming[i];
            const b = this.inMemoryDefinitions[i];
            if (
                a.id !== b.id ||
                a.updatedAt !== b.updatedAt ||
                a.status !== b.status ||
                a.targetProduct !== b.targetProduct ||
                a.outputWidth !== b.outputWidth ||
                a.outputHeight !== b.outputHeight ||
                a.assetUrl !== b.assetUrl ||
                a.slots?.length !== b.slots?.length
            ) {
                return true;
            }
            if (a.slots && b.slots) {
                for (let s = 0; s < a.slots.length; s++) {
                    const sa = a.slots[s];
                    const sb = b.slots[s];
                    if (
                        Math.abs(sa.x - sb.x) > 0.0001 ||
                        Math.abs(sa.y - sb.y) > 0.0001 ||
                        Math.abs(sa.width - sb.width) > 0.0001 ||
                        Math.abs(sa.height - sb.height) > 0.0001
                    ) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    public async refreshFromAdminDb(eventId?: string): Promise<void> {
        if (typeof window === "undefined") return;

        const windowAdmin = (window as unknown as { momentai?: { admin?: { templates?: { list(eventId?: string): Promise<{ ok?: boolean; value?: FrameDefinition[] }> } } } }).momentai?.admin;
        if (windowAdmin?.templates?.list) {
            try {
                const res = await windowAdmin.templates.list(eventId);
                if (res?.ok && Array.isArray(res.value) && res.value.length > 0) {
                    const definitions = res.value
                        .map((t: unknown) => {
                            const item = t as Partial<FrameDefinition> & { templateId?: string };
                            if (!item.id && item.templateId) item.id = item.templateId;
                            if (!item.kind) item.kind = "png-overlay";
                            if (!item.source) item.source = "canva";
                            if (!item.assetUrl && item.assets?.overlay) item.assetUrl = item.assets.overlay;
                            if (!item.assets && item.assetUrl) item.assets = { overlay: item.assetUrl };
                            if (!item.shotCount && item.slots) item.shotCount = item.slots.length as FrameDefinition["shotCount"];
                            return item as FrameDefinition;
                        })
                        .filter(isValidFrameDefinition)
                        .map(normalizeFrameDefinition);

                    const incomingSorted = sortByLatestUpdate(definitions);
                    let nextDefs: FrameDefinition[];
                    if (eventId) {
                        const otherEventDefs = this.inMemoryDefinitions.filter(
                            (d) => d.eventId && d.eventId !== eventId,
                        );
                        nextDefs = sortByLatestUpdate([...otherEventDefs, ...incomingSorted]);
                    } else {
                        nextDefs = incomingSorted;
                    }

                    if (!this.hasDefinitionsChanged(nextDefs)) {
                        return; // Smart cache match!
                    }

                    this.inMemoryDefinitions = nextDefs;
                    this.saveToStorage();
                    this.notify();
                    return;
                }
            } catch {
                // Ignore IPC error and fall back to web fetch
            }
        }

        const query = eventId ? `?eventId=${encodeURIComponent(eventId)}&published=1` : "?published=1";
        try {
            const response = await fetch(`/api/admin/frames${query}`);
            const payload = await response.json() as { ok?: boolean; frames?: FrameDefinition[] };
            if (payload.ok && Array.isArray(payload.frames)) {
                const incomingSorted = sortByLatestUpdate(
                    payload.frames.filter(isValidFrameDefinition).map(normalizeFrameDefinition)
                );
                let nextDefs: FrameDefinition[];
                if (eventId) {
                    const otherEventDefs = this.inMemoryDefinitions.filter(
                        (d) => d.eventId && d.eventId !== eventId,
                    );
                    nextDefs = sortByLatestUpdate([...otherEventDefs, ...incomingSorted]);
                } else {
                    nextDefs = incomingSorted;
                }

                if (!this.hasDefinitionsChanged(nextDefs)) {
                    return; // Smart cache match!
                }
                this.inMemoryDefinitions = nextDefs;
                this.saveToStorage();
                this.notify();
            }
        } catch {
            // Ignore fetch failure in standalone IPC mode
        }
    }

    public async migrateLocalStorageFramesToAdminDb(eventId: string): Promise<void> {
        if (typeof window === "undefined" || !window.localStorage) return;
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch {
            return;
        }
        if (!Array.isArray(parsed)) return;
        const definitions = parsed.filter(isValidFrameDefinition) as FrameDefinition[];
        for (const definition of definitions) {
            await fetch("/api/admin/frames", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ eventId, frame: { ...definition, eventId } }),
            }).catch(() => undefined);
        }
    }

    public subscribe(listener: RegistryListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    public getAllDefinitions(): readonly FrameDefinition[] {
        return sortByLatestUpdate(this.inMemoryDefinitions);
    }

    public getPublishedDefinitions(): readonly FrameDefinition[] {
        return sortByLatestUpdate(
            this.inMemoryDefinitions.filter((item) => item.status !== "private"),
        );
    }

    public getPublishedRuntimeFrames(): FrameConfig[] {
        return this.getPublishedDefinitions()
            .map((definition) => convertFrameDefinitionToRuntimeFrame({ definition }));
    }

    public registerFrame(definition: FrameDefinition): FrameConfig {
        if (!isValidFrameDefinition(definition)) {
            throw new Error("Imported frame definition is invalid or unsafe.");
        }

        const now = new Date().toISOString();
        const existing = this.inMemoryDefinitions.find(
            (item) => item.id === definition.id,
        );
        const itemToSave: FrameDefinition = normalizeFrameDefinition({
            ...definition,
            status: definition.status || "published",
            photoFit: definition.photoFit ?? "contain",
            createdAt: existing?.createdAt ?? definition.createdAt ?? now,
            updatedAt: now,
        });

        const existingIndex = this.inMemoryDefinitions.findIndex(
            (item) => item.id === itemToSave.id,
        );

        if (existingIndex >= 0) {
            this.inMemoryDefinitions[existingIndex] = itemToSave;
        } else {
            this.inMemoryDefinitions.push(itemToSave);
        }

        this.inMemoryDefinitions = sortByLatestUpdate(this.inMemoryDefinitions);
        this.saveToStorage();
        this.notify();

        return convertFrameDefinitionToRuntimeFrame({ definition: itemToSave });
    }

    public toggleFrameStatus(id: string): void {
        const target = this.inMemoryDefinitions.find((item) => item.id === id);
        if (target) {
            target.status = target.status === "private" ? "published" : "private";
            this.saveToStorage();
            this.notify();
        }
    }

    public removeFrame(id: string): void {
        this.inMemoryDefinitions = this.inMemoryDefinitions.filter((item) => item.id !== id);
        this.saveToStorage();
        this.notify();
    }

    public clear(): void {
        this.inMemoryDefinitions = [];
        this.saveToStorage();
        this.notify();
    }
}

export const LocalFrameRegistry = new LocalFrameRegistryService();
