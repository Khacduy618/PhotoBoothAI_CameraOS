import type { FrameConfig } from "@/types/theme";
import type { FrameDefinition } from "@/services/frame-import/frame-import.types";
import { convertFrameDefinitionToRuntimeFrame } from "@/services/frame-import/frame-definition.adapter";
import { punchOutFrameSlots } from "@/services/frame-import/transparent-punchout.service";

const STORAGE_KEY = "photobooth_imported_frames";

type RegistryListener = () => void;

class LocalFrameRegistryService {
    private inMemoryDefinitions: FrameDefinition[] = [];
    private listeners: Set<RegistryListener> = new Set();

    constructor() {
        this.loadFromStorage();
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
                    this.inMemoryDefinitions = parsed;
                    // Asynchronously ensure all loaded definitions have transparent slot cutouts
                    void this.ensureTransparentCutouts();
                }
            }
        } catch {
            this.inMemoryDefinitions = [];
        }
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
            this.inMemoryDefinitions = updated;
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

    public subscribe(listener: RegistryListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    public getAllDefinitions(): readonly FrameDefinition[] {
        return [...this.inMemoryDefinitions];
    }

    public getPublishedDefinitions(): readonly FrameDefinition[] {
        return this.inMemoryDefinitions.filter((item) => item.status !== "private");
    }

    public getPublishedRuntimeFrames(): FrameConfig[] {
        return this.inMemoryDefinitions
            .filter((item) => item.status !== "private")
            .map((definition) => convertFrameDefinitionToRuntimeFrame({ definition }));
    }

    public registerFrame(definition: FrameDefinition): FrameConfig {
        const itemToSave: FrameDefinition = {
            ...definition,
            status: definition.status || "published",
        };

        const existingIndex = this.inMemoryDefinitions.findIndex(
            (item) => item.id === itemToSave.id,
        );

        if (existingIndex >= 0) {
            this.inMemoryDefinitions[existingIndex] = itemToSave;
        } else {
            this.inMemoryDefinitions.push(itemToSave);
        }

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
