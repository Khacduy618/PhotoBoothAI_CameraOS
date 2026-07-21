"use client";

import React, { useState } from "react";
import { useBoothSession } from "@/components/booth/booth-session-context";
import { ThemeSelector } from "@/components/selectors/theme-selector";
import { FrameSelector } from "@/components/selectors/frame-selector";
import { StyleSelector } from "@/components/selectors/style-selector";
import { StickerSelector } from "@/components/selectors/sticker-selector";
import { TextSelector } from "@/components/selectors/text-selector";
import { EditablePreview } from "@/components/customize/editable-preview";
import { resolveBoothLayoutConfig } from "@/config/layout.config";
import { resolveThemeConfig, resolveFrameConfig, styleConfigs } from "@/config/theme.config";

export interface CustomizeStepConfig {
    id: string;
    title: string;
    shortLabel: string;
}

const CUSTOMIZE_STEPS: CustomizeStepConfig[] = [
    { id: "theme",   title: "🎨 1. Chọn Theme màu nền",       shortLabel: "Theme" },
    { id: "frame",   title: "🖼️ 2. Tùy chỉnh Khung ảnh",      shortLabel: "Khung" },
    { id: "style",   title: "✨ 3. Bộ lọc màu ảnh (Style)",    shortLabel: "Style" },
    { id: "sticker", title: "🥳 4. Thêm Nhãn dán Sticker",    shortLabel: "Sticker" },
    { id: "text",    title: "✍️ 5. Thêm Nhãn chữ Chúc mừng",  shortLabel: "Text" },
    { id: "draw",    title: "✏️ 6. Vẽ tay lên ảnh",           shortLabel: "Vẽ tay" },
    { id: "review",  title: "💖 7. Xem lại & Xuất ảnh",       shortLabel: "Hoàn tất" },
];

interface CustomizeFlowProps {
    onCompleteCustomize: () => void;
    onBackToCapture?: () => void;
}

import { WizardShell } from "@/components/wizard/wizard-shell";

export function CustomizeFlow({
    onCompleteCustomize,
    onBackToCapture,
}: CustomizeFlowProps) {
    const {
        selection,
        setSelection,
        setTheme,
        setFrame,
        setFrameColor,
        setStyle,
        addSticker,
        removeSticker,
        addTextLabel,
        removeTextLabel,
        addOverlay,
        removeOverlay,
        updateOverlay,
        undoDrawingStroke,
        clearDrawingStrokes,
        selectedOverlayId,
        setSelectedOverlayId,
        duplicateOverlay,
        bringOverlayToFront,
        sendOverlayToBack,
        capturedPhotos,
    } = useBoothSession();

    const [activeCustomizeStep, setActiveCustomizeStep] = useState<string>("theme");
    const [penColor, setPenColor] = useState<string>("#ffffff");

    const overlays = selection.customization.overlays || [];
    const selectedOverlay = overlays.find((o) => o.id === selectedOverlayId);
    const sortedOverlays = [...overlays].sort((a, b) => b.zIndex - a.zIndex);

    return (
        <WizardShell
            steps={CUSTOMIZE_STEPS}
            activeStep={activeCustomizeStep}
            onStepChange={setActiveCustomizeStep}
            onFirstStepBack={onBackToCapture}
            onComplete={onCompleteCustomize}
            completeLabel="Hoàn tất & Xuất ảnh"
            headerSlot={
                <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-500 flex items-center justify-center text-white text-lg shadow-md shadow-pink-300/50 font-bold">
                        ✨
                     </div>
                     <div className="space-y-0.5">
                        <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-pink-600 flex items-center gap-1.5">
                            <span className="animate-sparkle-shine">✨</span> PhotoBoothAI Customizer <span className="animate-sparkle-shine">💖</span>
                        </p>
                        <h1 className="text-lg font-black tracking-tight text-pink-950">
                            Tùy chỉnh ảnh photobooth sau khi chụp
                        </h1>
                     </div>
                </div>
            }
            previewSlot={
                <EditablePreview
                    className="max-h-full max-w-full object-contain shadow-2xl rounded-2xl"
                />
            }
        >
            {/* Active Overlay Inspector Panel */}
            {selectedOverlayId && selectedOverlay && (
                <div className="p-4 rounded-2xl bg-pink-500/10 border border-pink-300/70 space-y-3 shadow-md text-xs text-pink-950 animate-fade-in mb-4">
                    <div className="flex items-center justify-between border-b border-pink-200/60 pb-2">
                        <h3 className="font-black text-pink-700 uppercase tracking-wider flex items-center gap-1.5">
                            ✨ Đang chọn: {selectedOverlay.type === "sticker" ? `Sticker ${selectedOverlay.content}` : selectedOverlay.type === "text" ? `Chữ "${selectedOverlay.content}"` : "Nét vẽ"}
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                            <button
                                type="button"
                                onClick={() => bringOverlayToFront(selectedOverlayId)}
                                className="px-2 py-1 rounded-lg bg-white hover:bg-neutral-100 font-extrabold border border-pink-200 shadow-sm transition active:scale-95 text-[10px]"
                                title="Lên trên cùng"
                            >
                                🔼 Trên cùng
                            </button>
                            <button
                                type="button"
                                onClick={() => sendOverlayToBack(selectedOverlayId)}
                                className="px-2 py-1 rounded-lg bg-white hover:bg-neutral-100 font-extrabold border border-pink-200 shadow-sm transition active:scale-95 text-[10px]"
                                title="Xuống dưới cùng"
                            >
                                🔽 Dưới cùng
                            </button>
                            <button
                                type="button"
                                onClick={() => duplicateOverlay(selectedOverlayId)}
                                className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold border border-blue-200 shadow-sm transition active:scale-95 text-[10px]"
                                title="Nhân bản nhãn này"
                            >
                                📋 Nhân bản
                            </button>
                            <button
                                type="button"
                                onClick={() => removeOverlay(selectedOverlayId)}
                                className="px-2 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white font-extrabold shadow-sm transition active:scale-95 text-[10px]"
                                title="Xóa nhãn này"
                            >
                                🗑️ Xóa
                            </button>
                        </div>
                    </div>

                    {/* Common Sliders: Scale / Size, Rotation, Opacity */}
                    <div className="grid grid-cols-3 gap-2.5 pt-1">
                        <div className="space-y-1">
                            <label className="font-bold text-pink-900/80 block">Kích thước</label>
                            <input
                                type="range"
                                min={selectedOverlay.type === "sticker" ? 0.3 : 16}
                                max={selectedOverlay.type === "sticker" ? 4 : 120}
                                step={selectedOverlay.type === "sticker" ? 0.1 : 2}
                                value={selectedOverlay.type === "sticker" ? selectedOverlay.scale : selectedOverlay.type === "text" ? (selectedOverlay.fontSize || 48) : 1}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    if (selectedOverlay.type === "sticker") {
                                        updateOverlay(selectedOverlayId, { scale: val });
                                    } else if (selectedOverlay.type === "text") {
                                        updateOverlay(selectedOverlayId, { fontSize: val });
                                    }
                                }}
                                className="w-full accent-pink-600 cursor-pointer"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="font-bold text-pink-900/80 block">Xoay (°)</label>
                            <input
                                type="range"
                                min={-180}
                                max={180}
                                step={5}
                                value={selectedOverlay.rotationDegrees || 0}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    updateOverlay(selectedOverlayId, { rotationDegrees: val });
                                }}
                                className="w-full accent-pink-600 cursor-pointer"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="font-bold text-pink-900/80 block">Độ trong suốt</label>
                            <input
                                type="range"
                                min={0.1}
                                max={1.0}
                                step={0.05}
                                value={selectedOverlay.opacity ?? 1.0}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    updateOverlay(selectedOverlayId, { opacity: val });
                                }}
                                className="w-full accent-pink-600 cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* Sticker Specific Controls: Flip X & Flip Y */}
                    {selectedOverlay.type === "sticker" && (
                        <div className="flex gap-3 pt-1 border-t border-pink-200/40">
                            <button
                                type="button"
                                onClick={() => updateOverlay(selectedOverlayId, { flipX: !selectedOverlay.flipX })}
                                className={`px-3 py-1.5 rounded-xl border font-bold text-xs transition active:scale-95 ${
                                    selectedOverlay.flipX
                                        ? "bg-pink-500 text-white border-pink-600 shadow-sm"
                                        : "bg-white text-pink-950 border-pink-200 hover:bg-pink-50"
                                }`}
                            >
                                ↔️ Lật ngang (Flip X)
                            </button>
                            <button
                                type="button"
                                onClick={() => updateOverlay(selectedOverlayId, { flipY: !selectedOverlay.flipY })}
                                className={`px-3 py-1.5 rounded-xl border font-bold text-xs transition active:scale-95 ${
                                    selectedOverlay.flipY
                                        ? "bg-pink-500 text-white border-pink-600 shadow-sm"
                                        : "bg-white text-pink-950 border-pink-200 hover:bg-pink-50"
                                }`}
                            >
                                ↕️ Lật dọc (Flip Y)
                            </button>
                        </div>
                    )}

                    {/* Text Specific Controls: Content, Font, Color, Outline, Shadow */}
                    {selectedOverlay.type === "text" && (
                        <div className="space-y-2.5 pt-1 border-t border-pink-200/40">
                            <div className="space-y-1">
                                <label className="font-bold text-pink-900/80 block">Nội dung chữ</label>
                                <input
                                    type="text"
                                    maxLength={32}
                                    value={selectedOverlay.content}
                                    onChange={(e) => {
                                        updateOverlay(selectedOverlayId, { content: e.target.value.slice(0, 32) });
                                    }}
                                    className="w-full rounded-xl border border-pink-300 bg-white px-3 py-1.5 text-pink-950 font-bold focus:outline-none focus:ring-2 focus:ring-pink-400"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="font-bold text-pink-900/80 block">Font chữ</label>
                                    <select
                                        value={selectedOverlay.fontFamily || "sans-serif"}
                                        onChange={(e) => updateOverlay(selectedOverlayId, { fontFamily: e.target.value })}
                                        className="w-full rounded-xl border border-pink-300 bg-white px-2.5 py-1.5 font-bold text-pink-950 focus:outline-none focus:ring-2 focus:ring-pink-400"
                                    >
                                        <option value="sans-serif">Sans-Serif (Hiện đại)</option>
                                        <option value="serif">Serif (Cổ điển)</option>
                                        <option value="cursive">Cursive (Nghệ thuật)</option>
                                        <option value="monospace">Monospace (Độc đáo)</option>
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="font-bold text-pink-900/80 block">Bóng đổ (Shadow)</label>
                                    <select
                                        value={selectedOverlay.shadowPreset || "none"}
                                        onChange={(e) => updateOverlay(selectedOverlayId, { shadowPreset: e.target.value as any })}
                                        className="w-full rounded-xl border border-pink-300 bg-white px-2.5 py-1.5 font-bold text-pink-950 focus:outline-none focus:ring-2 focus:ring-pink-400"
                                    >
                                        <option value="none">Không bóng</option>
                                        <option value="soft">Mềm mại (Soft)</option>
                                        <option value="hard">Đậm nét (Hard)</option>
                                        <option value="neon">Neon Rực rỡ</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-2 items-center pt-1">
                                <label className="font-bold text-pink-900/80 shrink-0">Màu chữ:</label>
                                <div className="flex gap-1.5 flex-wrap">
                                    {["#ffffff", "#000000", "#ff4081", "#ffeb3b", "#4caf50", "#00bcd4"].map((c) => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => updateOverlay(selectedOverlayId, { color: c })}
                                            className={`w-6 h-6 rounded-full border border-black/20 transition ${
                                                selectedOverlay.color === c ? "ring-2 ring-pink-500 scale-110" : ""
                                            }`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Objects Panel / Layer Manager */}
            {sortedOverlays.length > 0 && (
                <div className="p-3 rounded-2xl bg-white/80 border border-pink-200/70 space-y-2 shadow-sm mb-4">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-extrabold text-pink-950 uppercase tracking-wider block">
                            📚 Danh sách lớp (Objects Panel - {sortedOverlays.length} đối tượng)
                        </label>
                    </div>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {sortedOverlays.map((item) => {
                            const isSelected = item.id === selectedOverlayId;
                            const labelText = item.type === "sticker"
                                ? `Sticker ${item.content}`
                                : item.type === "text"
                                ? `Chữ "${item.content}"`
                                : "Nét vẽ tay";

                            return (
                                <div
                                    key={item.id}
                                    onClick={() => setSelectedOverlayId(item.id)}
                                    className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition ${
                                        isSelected
                                            ? "border-pink-500 bg-pink-500/10 font-black text-pink-950 ring-1 ring-pink-400"
                                            : "border-pink-200/60 bg-white/60 hover:bg-white text-pink-900 font-bold"
                                    }`}
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        <span className="text-pink-600 font-extrabold">{item.type === "sticker" ? "🥳" : item.type === "text" ? "✍️" : "✏️"}</span>
                                        <span className="truncate">{labelText}</span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                bringOverlayToFront(item.id);
                                            }}
                                            className="px-1.5 py-0.5 rounded bg-pink-100 text-pink-700 hover:bg-pink-200 text-[10px]"
                                            title="Lên trên cùng"
                                        >
                                            ▲
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                sendOverlayToBack(item.id);
                                            }}
                                            className="px-1.5 py-0.5 rounded bg-pink-100 text-pink-700 hover:bg-pink-200 text-[10px]"
                                            title="Xuống dưới cùng"
                                        >
                                            ▼
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removeOverlay(item.id);
                                            }}
                                            className="px-1.5 py-0.5 rounded bg-red-100 text-red-600 hover:bg-red-200 text-[10px]"
                                            title="Xóa đối tượng"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Step: Theme */}
            <div className={activeCustomizeStep === "theme" ? "space-y-4" : "hidden"}>
                <ThemeSelector
                    value={selection.themeId}
                    onChange={(themeId) => setTheme(themeId)}
                />
            </div>

            {/* Step: Frame */}
            <div className={activeCustomizeStep === "frame" ? "space-y-4" : "hidden"}>
                <FrameSelector
                    frameId={selection.frameId}
                    frameColor={selection.frameColor}
                    onChangeFrame={(frameId, defaultColor) => setFrame(frameId, defaultColor)}
                    onChangeFrameColor={(color) => setFrameColor(color)}
                />
            </div>

            {/* Step: Style */}
            <div className={activeCustomizeStep === "style" ? "space-y-4" : "hidden"}>
                <StyleSelector
                    value={selection.styleId}
                    onChange={(styleId) => setStyle(styleId)}
                />
            </div>

            {/* Step: Sticker */}
            <div className={activeCustomizeStep === "sticker" ? "space-y-4" : "hidden"}>
                <StickerSelector
                    stickerItems={selection.customization.stickerItems}
                    onAddSticker={(stickerId) => addSticker(stickerId)}
                    onRemoveSticker={(id) => removeSticker(id)}
                />
            </div>

            {/* Step: Text */}
            <div className={activeCustomizeStep === "text" ? "space-y-4" : "hidden"}>
                <TextSelector
                    textLabels={selection.customization.textLabels}
                    onAddText={(text) => addTextLabel(text)}
                    onRemoveText={(id) => removeTextLabel(id)}
                />
            </div>

            {/* Step: Draw */}
            <div className={activeCustomizeStep === "draw" ? "space-y-4" : "hidden"}>
                <fieldset className="space-y-3">
                    <legend className="text-sm font-extrabold text-pink-950 uppercase tracking-wider">
                        Chọn Màu Bút Vẽ
                    </legend>
                    <div className="flex gap-3">
                        {["#ffffff", "#f59e0b", "#34d399", "#60a5fa", "#f472b6"].map((color) => {
                            const selected = penColor === color;
                            return (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setPenColor(color)}
                                    className={`w-10 h-10 rounded-full border border-black/10 transition-all duration-200 ${
                                        selected
                                            ? "ring-4 ring-pink-500/50 scale-110 shadow-md"
                                            : "hover:scale-105 active:scale-95"
                                    }`}
                                    style={{ backgroundColor: color }}
                                />
                            );
                        })}
                    </div>
                </fieldset>

                <div className="flex gap-3 pt-2">
                    <button
                        type="button"
                        onClick={undoDrawingStroke}
                        className="flex-1 px-4 py-2.5 rounded-2xl border border-pink-200 bg-white hover:bg-pink-50 text-pink-950 text-xs font-extrabold transition shadow-sm hover:border-pink-300 active:scale-95"
                    >
                        ↩️ Hoàn tác (Undo)
                    </button>
                    <button
                        type="button"
                        onClick={clearDrawingStrokes}
                        className="flex-1 px-4 py-2.5 rounded-2xl border border-pink-200 bg-white hover:bg-pink-50 text-pink-950 text-xs font-extrabold transition shadow-sm hover:border-pink-300 active:scale-95"
                    >
                        🗑️ Xóa tất cả (Clear)
                    </button>
                </div>
            </div>

            {/* Step: Review */}
            <div className={activeCustomizeStep === "review" ? "space-y-5" : "hidden"}>
                <div className="p-4 rounded-2xl bg-white/80 border border-pink-200/70 space-y-2.5 shadow-sm text-xs text-pink-950">
                    <h3 className="font-extrabold text-pink-600 uppercase tracking-wide">
                        Tóm tắt cấu hình tùy chỉnh:
                    </h3>
                    <ul className="space-y-1.5 font-bold">
                        <li className="flex justify-between border-b border-pink-200/40 pb-1">
                            <span className="text-pink-900/70">Layout:</span>
                            <span>{resolveBoothLayoutConfig(selection.layoutId).name}</span>
                        </li>
                        <li className="flex justify-between border-b border-pink-200/40 pb-1">
                            <span className="text-pink-900/70">Theme màu:</span>
                            <span>{resolveThemeConfig(selection.themeId).name}</span>
                        </li>
                        <li className="flex justify-between border-b border-pink-200/40 pb-1">
                            <span className="text-pink-900/70">Khung viền:</span>
                            <span>
                                {resolveFrameConfig(selection.frameId).name} {selection.frameColor ? `(${selection.frameColor})` : ""}
                            </span>
                        </li>
                        <li className="flex justify-between border-b border-pink-200/40 pb-1">
                            <span className="text-pink-900/70">Bộ lọc ảnh:</span>
                            <span>{styleConfigs.find((s) => s.id === selection.styleId)?.name ?? "Gốc"}</span>
                        </li>
                        <li className="flex justify-between border-b border-pink-200/40 pb-1">
                            <span className="text-pink-900/70">Sticker:</span>
                            <span>{selection.customization.stickerItems.length} sticker</span>
                        </li>
                        <li className="flex justify-between border-b border-pink-200/40 pb-1">
                            <span className="text-pink-900/70">Nhãn chữ:</span>
                            <span>{selection.customization.textLabels.length} nhãn</span>
                        </li>
                        <li className="flex justify-between">
                            <span className="text-pink-900/70">Đường nét vẽ tay:</span>
                            <span>{(selection.customization.overlays || []).filter(o => o.type === "drawing").length} nét vẽ</span>
                        </li>
                    </ul>
                </div>

                <p className="text-xs text-pink-900/70 leading-relaxed font-medium">
                    Nhấn <strong className="text-pink-950">"Hoàn tất & Xuất ảnh"</strong> để chuyển sang màn hình In ảnh & Tải về.
                </p>
            </div>
        </WizardShell>
    );
}
