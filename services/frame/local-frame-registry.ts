import type { FrameConfig } from "@/types/theme";
import type { FrameDefinition } from "@/services/frame-import/frame-import.types";
import { convertFrameDefinitionToRuntimeFrame } from "@/services/frame-import/frame-definition.adapter";
import { punchOutFrameSlots } from "@/services/frame-import/transparent-punchout.service";

const STORAGE_KEY = "photobooth_imported_frames";
const REGISTRY_CHANGED_EVENT = "cameraos-frame-registry-changed";

type RegistryListener = () => void;

function getFrameTimestamp(definition: FrameDefinition): number {
    return Date.parse(definition.updatedAt ?? definition.createdAt ?? "") || 0;
}

function sortByLatestUpdate(definitions: readonly FrameDefinition[]): FrameDefinition[] {
    return [...definitions].sort((a, b) => getFrameTimestamp(b) - getFrameTimestamp(a));
}

function isValidFrameDefinition(definition: FrameDefinition): boolean {
    if (!definition.id || !definition.name || definition.kind !== "png-overlay") return false;
    if (
        definition.assetUrl &&
        !definition.assetUrl.startsWith("data:image/png") &&
        !definition.assetUrl.startsWith("/api/local-media/")
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
        slot.height > 0 &&
        slot.x + slot.width <= 1.001 &&
        slot.y + slot.height <= 1.001
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
                        parsed.filter(isValidFrameDefinition),
                    );
                    // Asynchronously ensure all loaded definitions have transparent slot cutouts
                    void this.ensureTransparentCutouts();
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

    private async ensureTransparentCutouts(): Promise<void> {
        if (typeof window === "undefined") return;

        let changed = false;
        const updated = await Promise.all(
            this.inMemoryDefinitions.map(async (def) => {
                if (def.assetUrl && def.slots && def.slots.length > 0) {
                    const transparentUrl = await punchOutFrameSlots(def.assetUrl, def.slots);
                    if (transparentUrl !== def.assetUrl) {
                        changed = true;
                        return { ...def, assetUrl: transparentUrl };
                    }
                }
                return def;
            })
        );

        if (changed) {
            this.inMemoryDefinitions = sortByLatestUpdate(updated);
            this.saveToStorage();
            this.notify();
        }
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

    public async refreshFromAdminDb(eventId?: string): Promise<void> {
        if (typeof window === "undefined") return;
        const query = eventId ? `?eventId=${encodeURIComponent(eventId)}&published=1` : "?published=1";
        const response = await fetch(`/api/admin/frames${query}`);
        const payload = await response.json() as { ok?: boolean; frames?: FrameDefinition[] };
        if (payload.ok && Array.isArray(payload.frames)) {
            this.inMemoryDefinitions = sortByLatestUpdate(payload.frames.filter(isValidFrameDefinition));
            this.notify();
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
        const itemToSave: FrameDefinition = {
            ...definition,
            status: definition.status || "published",
            photoFit: definition.photoFit ?? "contain",
            createdAt: existing?.createdAt ?? definition.createdAt ?? now,
            updatedAt: now,
        };

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
