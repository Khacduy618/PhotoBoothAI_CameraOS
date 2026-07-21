"use client";

import React from "react";

export type EditorToolId =
    | "summary"
    | "theme"
    | "frame"
    | "filter"
    | "sticker"
    | "text"
    | "drawing";

export interface EditorToolConfig {
    id: EditorToolId;
    title: string;
    shortLabel: string;
    icon: string;
}

export const EDITOR_TOOLS: readonly EditorToolConfig[] = [
    { id: "summary", title: "📊 Tóm tắt", shortLabel: "Summary", icon: "📊" },
    { id: "theme",   title: "🎨 Theme màu", shortLabel: "Theme",   icon: "🎨" },
    { id: "frame",   title: "🖼️ Khung ảnh", shortLabel: "Frame",   icon: "🖼️" },
    { id: "filter",  title: "✨ Bộ lọc Filter", shortLabel: "Filter", icon: "✨" },
    { id: "sticker", title: "🥳 Nhãn dán Sticker", shortLabel: "Sticker", icon: "🥳" },
    { id: "text",    title: "✍️ Nhãn chữ Text", shortLabel: "Text", icon: "✍️" },
    { id: "drawing", title: "✏️ Vẽ cọ Drawing", shortLabel: "Drawing", icon: "✏️" },
] as const;

interface EditingToolbarProps {
    activeTool: EditorToolId;
    onSelectTool: (toolId: EditorToolId) => void;
}

export function EditingToolbar({ activeTool, onSelectTool }: EditingToolbarProps) {
    return (
        <nav aria-label="Editor Tool Toolbar" className="w-full">
            <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-none snap-x">
                {EDITOR_TOOLS.map((tool) => {
                    const isActive = activeTool === tool.id;
                    return (
                        <button
                            key={tool.id}
                            type="button"
                            onClick={() => onSelectTool(tool.id)}
                            className={`snap-start shrink-0 px-3 py-2 rounded-xl text-xs font-black transition duration-200 flex items-center gap-1.5 ${
                                isActive
                                    ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/25 scale-[1.02]"
                                    : "bg-white/70 hover:bg-white text-pink-950 border border-pink-200/60 shadow-sm"
                            }`}
                        >
                            <span>{tool.icon}</span>
                            <span>{tool.shortLabel}</span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
