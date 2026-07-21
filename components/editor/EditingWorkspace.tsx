"use client";

import React, { useState } from "react";
import type { BoothSelection, CapturedPhoto } from "@/types/theme";
import { EditablePreview } from "@/components/customize/editable-preview";
import { EditingSidebar } from "./EditingSidebar";
import type { EditorToolId } from "./EditingToolbar";

interface EditingWorkspaceProps {
    selection: BoothSelection;
    updateSelection: (patch: Partial<BoothSelection>) => void;
    capturedPhotos: CapturedPhoto[];
    onStartCapture: () => void;
    onExportPhoto: () => void;
    onRetake: () => void;
    isExporting?: boolean;
}

export function EditingWorkspace({
    selection,
    updateSelection,
    capturedPhotos,
    onStartCapture,
    onExportPhoto,
    onRetake,
    isExporting = false,
}: EditingWorkspaceProps) {
    const [activeTool, setActiveTool] = useState<EditorToolId>("theme");
    const [activePenColor, setActivePenColor] = useState<string | null>(null);
    const [activePenWidth, setActivePenWidth] = useState<number>(9);
    const [showSelectionHandles, setShowSelectionHandles] = useState(true);

    return (
        <section className="w-full h-[calc(100vh-3rem)] max-h-[calc(100vh-3rem)] flex flex-col justify-between p-5 text-neutral-900 relative select-none">
            <div className="flex-1 min-h-0 grid lg:grid-cols-[1.35fr_0.65fr] gap-5 py-2 overflow-hidden">
                {/* Left Slot — Continuous Live Preview / Editable Canvas */}
                <div className="flex flex-col items-center justify-center bg-white/40 backdrop-blur-xl rounded-3xl p-4 overflow-hidden border border-white/70 shadow-lg h-full relative group">
                    <EditablePreview
                        selection={selection}
                        capturedPhotos={capturedPhotos}
                        showMetadata={false}
                        enableDrawing={Boolean(activePenColor)}
                        activePenColor={activePenColor || "#ffffff"}
                        activePenWidth={activePenWidth}
                        showSelectionHandles={showSelectionHandles}
                    />
                </div>

                {/* Right Slot — Editing Sidebar Host */}
                <EditingSidebar
                    selection={selection}
                    updateSelection={updateSelection}
                    capturedPhotos={capturedPhotos}
                    activeTool={activeTool}
                    onSelectTool={setActiveTool}
                    activePenColor={activePenColor}
                    onSelectPenColor={setActivePenColor}
                    activePenWidth={activePenWidth}
                    onSelectPenWidth={setActivePenWidth}
                    showSelectionHandles={showSelectionHandles}
                    onToggleExportPreview={() => setShowSelectionHandles((prev) => !prev)}
                    onStartCapture={onStartCapture}
                    onExportPhoto={onExportPhoto}
                    onRetake={onRetake}
                    isExporting={isExporting}
                />
            </div>
        </section>
    );
}
