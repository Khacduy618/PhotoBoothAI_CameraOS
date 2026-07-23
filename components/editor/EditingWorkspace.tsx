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
    const [activeTool, setActiveTool] = useState<EditorToolId>("frame");
    const [activePenColor, setActivePenColor] = useState<string | null>(null);
    const [activePenWidth, setActivePenWidth] = useState<number>(9);
    const [showSelectionHandles, setShowSelectionHandles] = useState(true);

    return (
        <section className="w-full h-[calc(100vh-3rem)] max-h-[calc(100vh-3rem)] flex flex-col justify-between p-5 text-neutral-900 relative select-none overflow-hidden bg-[radial-gradient(circle_at_18%_12%,rgba(244,114,182,0.28),transparent_32%),radial-gradient(circle_at_86%_18%,rgba(168,85,247,0.24),transparent_30%),linear-gradient(135deg,#fff7ed_0%,#fdf2f8_42%,#eef2ff_100%)]">
            <div className="flex-1 min-h-0 grid lg:grid-cols-[1.35fr_0.65fr] gap-5 py-2 overflow-hidden">
                {/* Left Slot — Continuous Live Preview / Editable Canvas */}
                <div className="flex flex-col items-center justify-center bg-white/45 backdrop-blur-2xl rounded-[2rem] p-4 overflow-hidden border border-white/80 shadow-2xl shadow-pink-200/30 h-full relative group ring-1 ring-pink-100/50">
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
