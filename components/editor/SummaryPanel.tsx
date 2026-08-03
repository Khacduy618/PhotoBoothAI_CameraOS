"use client";

import React from "react";
import type { ToolRenderProps } from "./ToolHost";
import { resolveThemeConfig, resolveFrameConfig, resolveStyleConfig } from "@/config/theme.config";
import { resolveBoothLayoutConfig } from "@/config/layout.config";

export function SummaryPanel({ selection }: ToolRenderProps) {
    const layout = resolveBoothLayoutConfig(selection.layoutId);
    const theme = resolveThemeConfig(selection.themeId);
    const frame = resolveFrameConfig(selection.frameId);
    const style = resolveStyleConfig(selection.styleId);

    const stickerCount = selection.customization.stickerItems.length;
    const textCount = selection.customization.textLabels.length;
    const hasDrawing = selection.customization.drawingStrokes.length > 0;

    return (
        <fieldset className="p-4 rounded-2xl bg-white/70 backdrop-blur-md border border-pink-200/60 space-y-3 shadow-sm font-sans text-neutral-900">
            <legend className="text-sm font-black tracking-wide text-pink-950 uppercase border-b border-pink-200/50 pb-2 w-full">
                📊 TÓM TẮT CẤU HÌNH
            </legend>
            <ul className="text-xs space-y-2">
                <li className="flex justify-between border-b border-pink-100/50 pb-1.5">
                    <span className="text-neutral-500 font-medium">Layout:</span>
                    <span className="text-pink-950 font-bold">{layout.name}</span>
                </li>
                <li className="flex justify-between border-b border-pink-100/50 pb-1.5">
                    <span className="text-neutral-500 font-medium">Đếm ngược:</span>
                    <span className="text-pink-950 font-bold">{selection.countdownSeconds} giây</span>
                </li>
                <li className="flex justify-between border-b border-pink-100/50 pb-1.5">
                    <span className="text-neutral-500 font-medium">Theme màu:</span>
                    <span className="text-pink-950 font-bold">{theme.name}</span>
                </li>
                <li className="flex justify-between border-b border-pink-100/50 pb-1.5">
                    <span className="text-neutral-500 font-medium">Khung viền:</span>
                    <span className="text-pink-950 font-bold">
                        {frame.id === "none" ? "Không khung" : `${frame.name} (${selection.frameColor || frame.borderColor})`}
                    </span>
                </li>
                <li className="flex justify-between border-b border-pink-100/50 pb-1.5">
                    <span className="text-neutral-500 font-medium">Style ảnh:</span>
                    <span className="text-pink-950 font-bold">{style.name}</span>
                </li>
                <li className="flex justify-between border-b border-pink-100/50 pb-1.5">
                    <span className="text-neutral-500 font-medium">Stickers:</span>
                    <span className="text-pink-950 font-bold">{stickerCount} đã chọn</span>
                </li>
                <li className="flex justify-between border-b border-pink-100/50 pb-1.5">
                    <span className="text-neutral-500 font-medium">Chữ viết:</span>
                    <span className="text-pink-950 font-bold">{textCount} nhãn chữ</span>
                </li>
                <li className="flex justify-between pb-0.5">
                    <span className="text-neutral-500 font-medium">Vẽ cọ (Drawing):</span>
                    <span className="text-pink-950 font-bold">{hasDrawing ? "Có vẽ tay" : "Không"}</span>
                </li>
            </ul>
        </fieldset>
    );
}
