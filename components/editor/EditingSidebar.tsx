"use client";

import React from "react";
import type { BoothSelection, CapturedPhoto } from "@/types/theme";
import { EditingToolbar, type EditorToolId } from "./EditingToolbar";
import { ToolHost } from "./ToolHost";

interface EditingSidebarProps {
    selection: BoothSelection;
    updateSelection: (patch: Partial<BoothSelection>) => void;
    capturedPhotos: CapturedPhoto[];
    activeTool: EditorToolId;
    onSelectTool: (toolId: EditorToolId) => void;
    activePenColor: string | null;
    onSelectPenColor: (color: string | null) => void;
    activePenWidth?: number;
    onSelectPenWidth?: (width: number) => void;
    showSelectionHandles: boolean;
    onToggleExportPreview: () => void;
    onStartCapture: () => void;
    onExportPhoto: () => void;
    onRetake: () => void;
    isExporting?: boolean;
}

export function EditingSidebar({
    selection,
    updateSelection,
    capturedPhotos,
    activeTool,
    onSelectTool,
    activePenColor,
    onSelectPenColor,
    activePenWidth = 9,
    onSelectPenWidth,
    showSelectionHandles,
    onToggleExportPreview,
    onStartCapture,
    onExportPhoto,
    onRetake,
    isExporting = false,
}: EditingSidebarProps) {
    const isPostCapture = capturedPhotos.length > 0;
    const TOOL_ORDER: EditorToolId[] = ["summary", "frame", "drawing"];
    const safeActiveTool: EditorToolId = TOOL_ORDER.includes(activeTool) ? activeTool : "frame";
    const currentIdx = TOOL_ORDER.indexOf(safeActiveTool);
    const prevTool = currentIdx > 0 ? TOOL_ORDER[currentIdx - 1] : null;
    const nextTool = currentIdx < TOOL_ORDER.length - 1 ? TOOL_ORDER[currentIdx + 1] : null;

    const TOOL_NAMES: Record<EditorToolId, string> = {
        summary: "Summary",
        theme: "Theme màu",
        frame: "Frame viền",
        filter: "Style Filter",
        sticker: "Nhãn Sticker",
        text: "Thêm Text",
        drawing: "Vẽ cọ tay",
    };

    return (
        <aside className="flex flex-col h-full min-h-0 justify-between bg-white/60 backdrop-blur-xl rounded-3xl p-5 border border-white/80 shadow-xl relative overflow-hidden">
            {/* Top Toolbar & Active Tool Host */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
                <header className="space-y-1">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-pink-600 flex items-center gap-1">
                        ✨ Studio Workspace 💖
                    </p>
                    <h2 className="text-xl font-black tracking-tight text-pink-950">
                        {isPostCapture ? "Chỉnh sửa & Xuất ảnh" : "Tùy chỉnh trước khi chụp"}
                    </h2>
                </header>

                {/* Setup Step Shell Tabs Toolbar */}
                <EditingToolbar
                    activeTool={safeActiveTool}
                    onSelectTool={onSelectTool}
                />

                {/* Step-by-Step Shell Navigation Bar */}
                <div className="flex items-center justify-between gap-2 py-1.5 px-3 rounded-2xl bg-white/70 border border-pink-200/60 shadow-sm">
                    <button
                        type="button"
                        disabled={!prevTool}
                        onClick={() => prevTool && onSelectTool(prevTool)}
                        className="rounded-xl border border-pink-200/70 bg-white/80 px-2.5 py-1.5 text-xs font-bold text-pink-900 hover:bg-white active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center gap-1 shadow-sm"
                    >
                        <span>←</span> {prevTool ? TOOL_NAMES[prevTool] : "Đầu"}
                    </button>
                    <span className="text-[11px] font-black text-pink-900 uppercase tracking-wider px-2">
                        Bước {currentIdx + 1}/{TOOL_ORDER.length}: <span className="text-pink-600">{TOOL_NAMES[safeActiveTool]}</span>
                    </span>
                    <button
                        type="button"
                        disabled={!nextTool}
                        onClick={() => nextTool && onSelectTool(nextTool)}
                        className="rounded-xl border border-pink-200/70 bg-gradient-to-r from-pink-500 to-rose-500 px-3 py-1.5 text-xs font-bold text-white hover:brightness-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center gap-1 shadow-sm"
                    >
                        {nextTool ? TOOL_NAMES[nextTool] : "Cuối"} <span>→</span>
                    </button>
                </div>

                <div className="pt-1">
                    <ToolHost
                        activeTool={safeActiveTool}
                        selection={selection}
                        updateSelection={updateSelection}
                        capturedPhotos={capturedPhotos}
                        activePenColor={activePenColor}
                        onSelectPenColor={onSelectPenColor}
                        activePenWidth={activePenWidth}
                        onSelectPenWidth={onSelectPenWidth}
                    />
                </div>
            </div>

            {/* Bottom Actions Area */}
            <div className="flex flex-col gap-2.5 border-t border-pink-200/50 pt-4 shrink-0 mt-3">
                {isPostCapture ? (
                    <>
                        <button
                            type="button"
                            onClick={onToggleExportPreview}
                            className={`w-full rounded-2xl px-4 py-2.5 font-bold text-xs transition border shadow-sm flex items-center justify-center gap-2 ${
                                !showSelectionHandles
                                    ? "bg-amber-400/20 text-amber-900 border-amber-300 ring-2 ring-amber-400/40"
                                    : "bg-white/80 hover:bg-white text-neutral-800 border-pink-200"
                            }`}
                        >
                            <span>{!showSelectionHandles ? "✏️ Bật lại khung chỉnh sửa" : "👁️ Xem trước xuất ảnh (Ẩn viền)"}</span>
                        </button>

                        <button
                            type="button"
                            disabled={isExporting}
                            onClick={onExportPhoto}
                            className="w-full text-center rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 px-4 py-3 font-extrabold text-white text-xs md:text-sm shadow-lg shadow-pink-400/30 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                        >
                            <span>📥</span> {isExporting ? "Đang xuất ảnh..." : "Tải ảnh đã xuất"}
                        </button>

                        <button
                            type="button"
                            className="w-full rounded-2xl border border-pink-200/70 bg-white/70 px-4 py-2.5 font-extrabold text-pink-900 hover:bg-white active:scale-95 transition-all text-xs shadow-sm flex items-center justify-center gap-2"
                            onClick={onRetake}
                        >
                            <span>🔄</span> Chụp lại toàn bộ
                        </button>
                    </>
                ) : (
                    <button
                        type="button"
                        onClick={onStartCapture}
                        className="w-full text-center rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 px-4 py-3.5 font-extrabold text-white text-sm shadow-lg shadow-pink-400/30 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        <span>📸</span> Bắt đầu chụp ảnh
                    </button>
                )}
            </div>
        </aside>
    );
}
