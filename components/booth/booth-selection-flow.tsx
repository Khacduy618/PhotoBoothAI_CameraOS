"use client";

import React, { useState, useContext, useEffect } from "react";
import { LiveSelectionPreview } from "@/components/booth/live-selection-preview";
import { BoothSessionContext } from "@/components/booth/booth-session-context";
import {
    boothLayoutConfigs,
    countdownSecondOptions,
    resolveBoothLayoutConfig,
} from "@/config/layout.config";
import {
    resolveStickerConfig,
    stickerConfigs,
    textLabelPresetConfigs,
} from "@/config/sticker.config";
import {
    defaultBoothSelection,
    isBoothSelectionComplete,
    resolveFrameConfig,
    resolveThemeConfig,
    styleConfigs,
    themeConfigs,
} from "@/config/theme.config";
import { AssetManager } from "@/services/platform/asset-manager";
import type { CameraController } from "@/hooks/use-camera";
import type {
    BoothCountdownSeconds,
    BoothOutputCustomization,
} from "@/types/customization";
import type { BoothSelection } from "@/types/theme";

const setupStickerId = "setup-sticker-preset";
const setupTextLabelId = "setup-text-preset";

// --- Data-driven wizard step config ---

interface WizardStepConfig {
    id: string;
    title: string;
    shortLabel: string;
}

const WIZARD_STEPS: WizardStepConfig[] = [
    { id: "layout",    title: "1. Chọn Layout ảnh",           shortLabel: "Layout" },
    { id: "countdown", title: "2. Chọn thời gian đếm ngược", shortLabel: "Countdown" },
    { id: "theme",     title: "3. Chọn Theme màu",            shortLabel: "Theme" },
    { id: "frame",     title: "4. Chọn Khung ảnh",            shortLabel: "Frame" },
    { id: "style",     title: "5. Chọn Style ảnh",            shortLabel: "Style" },
    { id: "sticker",   title: "6. Chọn Nhãn dán",             shortLabel: "Sticker" },
    { id: "text",      title: "7. Chọn Nhãn chữ",             shortLabel: "Text" },
    { id: "review",    title: "8. Xác nhận & Bắt đầu",        shortLabel: "Review" },
];

// --- Helpers ---

function replaceSetupSticker(
    customization: BoothOutputCustomization,
    stickerId: string | null,
): BoothOutputCustomization {
    const stickerItems = customization.stickerItems.filter(
        (item) => item.id !== setupStickerId,
    );

    if (!stickerId) {
        return { ...customization, stickerItems };
    }

    return {
        ...customization,
        stickerItems: [
            ...stickerItems,
            {
                id: setupStickerId,
                stickerId,
                x: 0.78,
                y: 0.2,
                scale: 1,
                rotationDegrees: -8,
            },
        ],
    };
}

function replaceSetupTextLabel(
    customization: BoothOutputCustomization,
    text: string | null,
): BoothOutputCustomization {
    const textLabels = customization.textLabels.filter(
        (label) => label.id !== setupTextLabelId,
    );
    const trimmedText = text?.trim() ?? "";

    if (!trimmedText) {
        return { ...customization, textLabels };
    }

    return {
        ...customization,
        textLabels: [
            ...textLabels,
            {
                id: setupTextLabelId,
                text: trimmedText.slice(0, 32),
                x: 0.5,
                y: 0.95,
                color: "#ffffff",
                fontSize: 42,
                rotationDegrees: 0,
            },
        ],
    };
}

// --- Main Component ---

interface BoothSelectionFlowProps {
    selection?: BoothSelection;
    camera?: CameraController;
    onSelectionChange?: (selection: BoothSelection) => void;
    onComplete: () => void;
}

export function BoothSelectionFlow({
    selection: propSelection,
    camera: propCamera,
    onSelectionChange: propOnSelectionChange,
    onComplete,
}: BoothSelectionFlowProps) {
    const context = useContext(BoothSessionContext);
    const selection = propSelection || context?.selection || defaultBoothSelection;
    const setSelection = propOnSelectionChange || context?.setSelection || (() => {});
    const camera = propCamera || context?.camera;

    const [localActiveStep, setLocalActiveStep] = useState("layout");
    const activeStep = context?.activeStep || localActiveStep;
    const setActiveStep = context?.setActiveStep || setLocalActiveStep;
    const canContinue = isBoothSelectionComplete(selection);

    const selectedSetupSticker = selection.customization.stickerItems.find(
        (item) => item.id === setupStickerId,
    );
    const selectedSetupText = selection.customization.textLabels.find(
        (label) => label.id === setupTextLabelId,
    );

    const [customTextVal, setCustomTextVal] = useState(selectedSetupText?.text || "");
    const [extraTextVal, setExtraTextVal] = useState("");

    // Sync input value with external changes (e.g., preset selection or clear)
    React.useEffect(() => {
        setCustomTextVal(selectedSetupText?.text || "");
    }, [selectedSetupText?.text]);

    const currentIndex = WIZARD_STEPS.findIndex(s => s.id === activeStep);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const hasBack = safeIndex > 0;
    const isLastStep = safeIndex === WIZARD_STEPS.length - 1;
    const currentStepConfig = WIZARD_STEPS[safeIndex];

    const handleBack = () => {
        if (hasBack) {
            setActiveStep(WIZARD_STEPS[safeIndex - 1].id);
        }
    };

    const handleNext = () => {
        if (isLastStep) {
            onComplete();
        } else {
            setActiveStep(WIZARD_STEPS[safeIndex + 1].id);
        }
    };

    const handleSelectText = (text: string | null) => {
        setSelection({
            ...selection,
            customization: replaceSetupTextLabel(selection.customization, text),
        });
    };

    // --- Frame packages from Asset Manager ---
    const framePackages = AssetManager.getFramePackages();

    return (
        <section className="w-full h-[calc(100vh-3rem)] max-h-[calc(100vh-3rem)] flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-neutral-900 to-neutral-950 p-5 text-white shadow-2xl">
            <header className="flex flex-wrap items-center justify-between border-b border-white/5 pb-4 shrink-0 gap-4">
                <div className="space-y-0.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-400">
                        MomentAI CameraOS
                    </p>
                    <h1 className="text-lg font-black tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">Xem trước layout trước khi chụp</h1>
                </div>
                {/* Modern progressive timeline step indicator */}
                <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar max-w-full">
                    {WIZARD_STEPS.map((step, idx) => {
                        const active = step.id === activeStep;
                        const done = idx < safeIndex;
                        return (
                            <div key={step.id} className="flex items-center shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setActiveStep(step.id)}
                                    className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold transition duration-300 text-[11px] ${
                                        active
                                            ? "bg-gradient-to-r from-emerald-400 to-teal-500 text-black shadow-lg shadow-emerald-500/20"
                                            : done
                                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                                                : "bg-white/5 text-neutral-400 border border-white/5 hover:border-white/10"
                                    }`}
                                >
                                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                        active
                                            ? "bg-black text-emerald-400"
                                            : done
                                                ? "bg-emerald-400/20 text-emerald-400"
                                                : "bg-white/10 text-neutral-400"
                                    }`}>
                                        {idx + 1}
                                    </span>
                                    <span className="hidden sm:inline">{step.shortLabel}</span>
                                </button>
                                {idx < WIZARD_STEPS.length - 1 && (
                                    <div className={`w-3 h-px ${
                                        done ? "bg-emerald-500/30" : "bg-white/5"
                                    }`} />
                                )}
                            </div>
                        );
                    })}
                </div>
            </header>

            <div className="flex-1 min-h-0 grid lg:grid-cols-[1.1fr_0.9fr] gap-6 py-4 overflow-hidden">
                {/* Left Preview Container with glowing backdrop reflection */}
                <div className="flex flex-col items-center justify-center bg-neutral-950/60 backdrop-blur rounded-3xl p-4 overflow-hidden border border-white/5 h-full relative group">
                    <div className="absolute inset-0 bg-emerald-500/2 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-3xl blur-3xl" />
                    <LiveSelectionPreview
                        selection={selection}
                        camera={camera}
                        onSelectionChange={setSelection}
                    />
                </div>

                {/* Right Options — styled dashboard step options */}
                <div className="flex flex-col h-full min-h-0 justify-between bg-neutral-900/20 backdrop-blur-md rounded-3xl p-5 border border-white/5 shadow-2xl relative">
                    <div className="flex-1 overflow-y-auto pr-1 space-y-6">
                        <h2 className="text-xl font-extrabold tracking-tight text-white mb-2 border-b border-white/5 pb-2">
                            {currentStepConfig.title}
                        </h2>

                        {/* Step: Layout */}
                        <div className={activeStep === "layout" ? "space-y-4" : "hidden"}>
                            <SelectionGroup
                                label="Chọn Layout"
                                value={selection.layoutId}
                                options={boothLayoutConfigs}
                                onChange={(layoutId) => {
                                    setSelection({
                                        ...selection,
                                        layoutId: layoutId as BoothSelection["layoutId"],
                                    });
                                }}
                            />
                        </div>

                        {/* Step: Countdown */}
                        <div className={activeStep === "countdown" ? "space-y-4" : "hidden"}>
                            <CountdownSelectionGroup
                                value={selection.countdownSeconds}
                                onChange={(countdownSeconds) => {
                                    setSelection({
                                        ...selection,
                                        countdownSeconds,
                                    });
                                }}
                            />
                        </div>

                        {/* Step: Theme */}
                        <div className={activeStep === "theme" ? "space-y-4" : "hidden"}>
                            <SelectionGroup
                                label="Chọn Theme"
                                value={selection.themeId}
                                options={themeConfigs}
                                onChange={(themeId) => {
                                    setSelection({
                                        ...selection,
                                        themeId,
                                    });
                                }}
                            />
                        </div>

                        {/* Step: Frame — Visual Card Grid + Custom Color Picker */}
                        <div className={activeStep === "frame" ? "space-y-6" : "hidden"}>
                            <fieldset className="space-y-3">
                                <legend className="text-sm font-bold text-neutral-400 uppercase tracking-wider">1. Thiết kế khung</legend>
                                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4">
                                    {framePackages.map((pkg) => {
                                        const selected = selection.frameId === pkg.id;
                                        return (
                                            <button
                                                key={pkg.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelection({
                                                        ...selection,
                                                        frameId: pkg.id,
                                                        frameColor: pkg.config.borderColor,
                                                    });
                                                }}
                                                className={`group cursor-pointer rounded-2xl border p-3 transition-all duration-300 flex flex-col items-center gap-2 ${
                                                    selected
                                                        ? "border-emerald-400 bg-emerald-400/5 ring-1 ring-emerald-400/20"
                                                        : "border-white/5 bg-white/5 hover:border-white/20 hover:bg-white/10"
                                                }`}
                                            >
                                                {/* Visual thumbnail */}
                                                <div
                                                    className={`w-full aspect-[3/5] rounded-xl ${pkg.thumbnailUrl} flex items-center justify-center overflow-hidden transition duration-500 group-hover:scale-[1.03]`}
                                                >
                                                    <div className="w-[50%] space-y-0.5">
                                                        {Array.from({ length: 3 }).map((_, i) => (
                                                            <div
                                                                key={i}
                                                                className="w-full aspect-[4/3] bg-neutral-600/30 rounded-sm"
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                                <span className="text-[11px] font-bold text-center leading-tight">
                                                    {pkg.metadata.name}
                                                </span>
                                                <span className="text-[9px] text-neutral-500 uppercase tracking-widest font-semibold">
                                                    {pkg.metadata.category}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </fieldset>

                            {selection.frameId !== "none" && (
                                <div className="space-y-3 pt-4 border-t border-white/5 animate-fade-in">
                                    <label className="text-sm font-bold text-neutral-400 uppercase tracking-wider block">2. Tùy chỉnh màu khung</label>
                                    <div className="flex flex-wrap items-center gap-3">
                                        {[
                                            { name: "Trắng", value: "#ffffff" },
                                            { name: "Đen", value: "#111827" },
                                            { name: "Hồng", value: "#fbcfe8" },
                                            { name: "Vàng", value: "#facc15" },
                                            { name: "Xanh Matcha", value: "#d1fae5" },
                                            { name: "Tím Lavender", value: "#e9d5ff" },
                                            { name: "Đỏ Tinder", value: "#f43f5e" },
                                            { name: "Xanh Cyan", value: "#06b6d4" },
                                        ].map((color) => {
                                            const active = selection.frameColor === color.value;
                                            return (
                                                <button
                                                    key={color.value}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelection({
                                                            ...selection,
                                                            frameColor: color.value,
                                                        });
                                                    }}
                                                    className={`w-8 h-8 rounded-full relative border transition-all duration-300 flex items-center justify-center hover:scale-110 shadow-lg ${
                                                        active
                                                            ? "border-emerald-400 scale-105 ring-2 ring-emerald-400/50"
                                                            : "border-white/10"
                                                    }`}
                                                    style={{ backgroundColor: color.value }}
                                                    title={color.name}
                                                >
                                                    {active && (
                                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-1 ring-white" />
                                                    )}
                                                </button>
                                            );
                                        })}

                                        {/* Custom browser color picker */}
                                        <div className="flex items-center gap-2 ml-auto">
                                            <span className="text-xs text-neutral-400 font-medium">Màu tự chọn:</span>
                                            <input
                                                type="color"
                                                value={selection.frameColor || "#ffffff"}
                                                onChange={(e) => {
                                                    setSelection({
                                                        ...selection,
                                                        frameColor: e.target.value,
                                                    });
                                                }}
                                                className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Step: Style */}
                        <div className={activeStep === "style" ? "space-y-4" : "hidden"}>
                            <SelectionGroup
                                label="Chọn Style"
                                value={selection.styleId}
                                options={styleConfigs}
                                onChange={(styleId) => {
                                    setSelection({
                                        ...selection,
                                        styleId,
                                    });
                                }}
                            />
                        </div>

                        {/* Step: Sticker */}
                        <div className={activeStep === "sticker" ? "space-y-4" : "hidden"}>
                            <fieldset className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <legend className="text-sm font-bold text-neutral-400 uppercase tracking-wider">
                                        Chọn Nhãn dán (Tối đa 4 sticker)
                                    </legend>
                                    <span className="text-xs font-semibold text-emerald-400">
                                        {selection.customization.stickerItems.length}/4 đã chọn
                                    </span>
                                </div>
                                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                                    <PresetButton
                                        selected={!selectedSetupSticker}
                                        title="Không sticker"
                                        description="Giữ hình ảnh sạch"
                                        onClick={() => {
                                            setSelection({
                                                ...selection,
                                                customization: replaceSetupSticker(
                                                    selection.customization,
                                                    null,
                                                ),
                                            });
                                        }}
                                    />
                                    {stickerConfigs.map((sticker) => (
                                        <PresetButton
                                            key={sticker.id}
                                            selected={
                                                selectedSetupSticker?.stickerId === sticker.id
                                            }
                                            title={`${sticker.emoji} ${sticker.name}`}
                                            description={sticker.description}
                                            onClick={() => {
                                                setSelection({
                                                    ...selection,
                                                    customization: replaceSetupSticker(
                                                        selection.customization,
                                                        sticker.id,
                                                    ),
                                                });
                                            }}
                                        />
                                    ))}
                                </div>
                            </fieldset>

                            {/* Add more stickers */}
                            <AddStickerControl
                                stickerCount={selection.customization.stickerItems.length}
                                onAdd={(stickerId) => {
                                    if (selection.customization.stickerItems.length >= 4) return;
                                    const offset = (selection.customization.stickerItems.length * 0.1) % 0.3;
                                    const newSticker = {
                                        id: `sticker-${Date.now()}-${Math.random()}`,
                                        stickerId,
                                        x: 0.3 + offset,
                                        y: 0.3 + offset,
                                        scale: 1,
                                        rotationDegrees: Math.floor(Math.random() * 30) - 15,
                                    };
                                    setSelection({
                                        ...selection,
                                        customization: {
                                            ...selection.customization,
                                            stickerItems: [
                                                ...selection.customization.stickerItems,
                                                newSticker,
                                            ],
                                        },
                                    });
                                }}
                            />

                            {selection.customization.stickerItems.length > 0 && (
                                <div className="space-y-2 pt-3 border-t border-white/5">
                                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
                                        Danh sách Sticker trên khung (Kéo thả để di chuyển):
                                    </span>
                                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                        {selection.customization.stickerItems.map((item, idx) => {
                                            const sticker = resolveStickerConfig(item.stickerId);
                                            return (
                                                <div
                                                    key={item.id}
                                                    className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                                                >
                                                    <span className="font-semibold">
                                                        {idx + 1}. {sticker.emoji} {sticker.name}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelection({
                                                                ...selection,
                                                                customization: {
                                                                    ...selection.customization,
                                                                    stickerItems: selection.customization.stickerItems.filter(
                                                                        (s) => s.id !== item.id,
                                                                    ),
                                                                },
                                                            });
                                                        }}
                                                        className="text-red-400 hover:text-red-300 font-bold px-2 py-1 bg-red-500/10 rounded-lg"
                                                    >
                                                        Xóa
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Step: Text — Custom Input + Presets */}
                        <div className={activeStep === "text" ? "space-y-6" : "hidden"}>
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-neutral-400 uppercase tracking-wider block">Tự nhập chữ của bạn (Branding)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={customTextVal}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setCustomTextVal(val);
                                            setSelection({
                                                ...selection,
                                                customization: replaceSetupTextLabel(
                                                    selection.customization,
                                                    val,
                                                ),
                                            });
                                        }}
                                        placeholder="Ví dụ: PHOTOXINHH..."
                                        maxLength={32}
                                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 transition-all placeholder:text-neutral-500 font-semibold"
                                    />
                                    {customTextVal && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCustomTextVal("");
                                                handleSelectText(null);
                                            }}
                                            className="px-4 py-3 bg-red-500/10 text-red-400 border border-red-500/20 font-bold rounded-xl text-sm hover:bg-red-500/20 active:scale-95 transition"
                                        >
                                            Xóa
                                        </button>
                                    )}
                                </div>
                                <p className="text-[10px] text-neutral-500 leading-normal">
                                    * Nhãn chữ tự nhập sẽ hiển thị trực quan ở phần branding bên dưới ảnh (Kéo thả để di chuyển).
                                </p>
                            </div>

                            <div className="space-y-3 pt-3 border-t border-white/5">
                                <label className="text-sm font-bold text-neutral-400 uppercase tracking-wider block">
                                    Thêm chữ trang trí nổi ({selection.customization.textLabels.length}/4)
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={extraTextVal}
                                        onChange={(e) => setExtraTextVal(e.target.value)}
                                        placeholder="Nhập chữ trang trí..."
                                        maxLength={32}
                                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-400 font-semibold placeholder:text-neutral-500"
                                    />
                                    <button
                                        type="button"
                                        disabled={!extraTextVal.trim() || selection.customization.textLabels.length >= 4}
                                        onClick={() => {
                                            const trimmed = extraTextVal.trim();
                                            if (!trimmed || selection.customization.textLabels.length >= 4) return;
                                            const offset = (selection.customization.textLabels.length * 0.08) % 0.25;
                                            const newLabel = {
                                                id: `text-${Date.now()}-${Math.random()}`,
                                                text: trimmed,
                                                x: 0.5 + offset,
                                                y: 0.4 + offset,
                                                color: "#ffffff",
                                                fontSize: 42,
                                                rotationDegrees: 0,
                                            };
                                            setSelection({
                                                ...selection,
                                                customization: {
                                                    ...selection.customization,
                                                    textLabels: [
                                                        ...selection.customization.textLabels,
                                                        newLabel,
                                                    ],
                                                },
                                            });
                                            setExtraTextVal("");
                                        }}
                                        className="px-4 py-3 bg-emerald-400 text-black font-bold rounded-xl text-sm hover:bg-emerald-300 active:scale-95 transition disabled:opacity-40 shrink-0"
                                    >
                                        + Thêm chữ
                                    </button>
                                </div>
                            </div>

                            <fieldset className="space-y-3 pt-4 border-t border-white/5">
                                <legend className="text-sm font-bold text-neutral-400 uppercase tracking-wider">
                                    Hoặc chọn nhãn chữ có sẵn
                                </legend>
                                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                                    <PresetButton
                                        selected={!selectedSetupText}
                                        title="Không text"
                                        description="Không thêm nhãn"
                                        onClick={() => {
                                            setCustomTextVal("");
                                            handleSelectText(null);
                                        }}
                                    />
                                    {textLabelPresetConfigs.map((preset) => (
                                        <PresetButton
                                            key={preset.id}
                                            selected={selectedSetupText?.text === preset.text}
                                            title={preset.text}
                                            description={preset.description}
                                            onClick={() => {
                                                setCustomTextVal(preset.text);
                                                handleSelectText(preset.text);
                                            }}
                                        />
                                    ))}
                                </div>
                            </fieldset>

                            {selection.customization.textLabels.length > 0 && (
                                <div className="space-y-2 pt-3 border-t border-white/5">
                                    <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
                                        Danh sách Nhãn chữ ({selection.customization.textLabels.length}/4):
                                    </span>
                                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                        {selection.customization.textLabels.map((item, idx) => (
                                            <div
                                                key={item.id}
                                                className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                                            >
                                                <span className="font-semibold truncate max-w-[70%]">
                                                    {idx + 1}. "{item.text}"
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (item.id === setupTextLabelId) {
                                                            setCustomTextVal("");
                                                        }
                                                        setSelection({
                                                            ...selection,
                                                            customization: {
                                                                ...selection.customization,
                                                                textLabels: selection.customization.textLabels.filter(
                                                                    (l) => l.id !== item.id,
                                                                ),
                                                            },
                                                        });
                                                    }}
                                                    className="text-red-400 hover:text-red-300 font-bold px-2 py-1 bg-red-500/10 rounded-lg shrink-0"
                                                >
                                                    Xóa
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Step: Review — Full Summary + Confirmation */}
                        <div className={activeStep === "review" ? "space-y-6" : "hidden"}>
                            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3 shadow-inner">
                                <h3 className="font-bold text-emerald-400 tracking-wide text-sm uppercase">Tóm tắt cấu hình:</h3>
                                <ul className="text-sm space-y-2 text-neutral-300">
                                    <li className="flex justify-between border-b border-white/5 pb-1">
                                        <span className="text-neutral-500">Layout:</span>
                                        <span className="text-white font-bold">{resolveBoothLayoutConfig(selection.layoutId).name}</span>
                                    </li>
                                    <li className="flex justify-between border-b border-white/5 pb-1">
                                        <span className="text-neutral-500">Đếm ngược:</span>
                                        <span className="text-white font-bold">{selection.countdownSeconds} giây</span>
                                    </li>
                                    <li className="flex justify-between border-b border-white/5 pb-1">
                                        <span className="text-neutral-500">Theme màu:</span>
                                        <span className="text-white font-bold">{resolveThemeConfig(selection.themeId).name}</span>
                                    </li>
                                    <li className="flex justify-between border-b border-white/5 pb-1">
                                        <span className="text-neutral-500">Khung viền:</span>
                                        <span className="text-white font-bold">
                                            {resolveFrameConfig(selection.frameId).name} {selection.frameColor ? `(${selection.frameColor})` : ""}
                                        </span>
                                    </li>
                                    <li className="flex justify-between border-b border-white/5 pb-1">
                                        <span className="text-neutral-500">Style ảnh:</span>
                                        <span className="text-white font-bold">{styleConfigs.find(s => s.id === selection.styleId)?.name ?? "Gốc"}</span>
                                    </li>
                                    <li className="flex justify-between border-b border-white/5 pb-1">
                                        <span className="text-neutral-500">Nhãn dán:</span>
                                        <span className="text-white font-bold">{selectedSetupSticker ? "Có sử dụng" : "Không"}</span>
                                    </li>
                                    <li className="flex justify-between">
                                        <span className="text-neutral-500">Nhãn chữ:</span>
                                        <span className="text-white font-bold truncate max-w-[200px]">{selectedSetupText ? selectedSetupText.text : "Không"}</span>
                                    </li>
                                </ul>
                            </div>

                            <p className="text-xs text-neutral-400 leading-relaxed">
                                Xem lại toàn bộ cấu hình ở bên trái. Nhấn <strong className="text-white">"Tiếp tục vào camera"</strong> để bắt đầu chụp ảnh.
                            </p>
                        </div>
                    </div>

                    {/* Navigation buttons */}
                    <div className="flex items-center gap-3 border-t border-white/5 pt-4 mt-4 shrink-0">
                        <button
                            type="button"
                            disabled={!hasBack}
                            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white hover:bg-white/10 active:scale-95 transition-all duration-300 disabled:opacity-20 disabled:cursor-not-allowed text-xs md:text-sm"
                            onClick={handleBack}
                        >
                            Quay lại
                        </button>

                        {!isLastStep && (
                            <button
                                type="button"
                                className="flex-1 rounded-xl px-4 py-3 font-bold bg-white text-black hover:bg-neutral-200 active:scale-95 transition-all duration-300 text-xs md:text-sm shadow-md"
                                onClick={handleNext}
                            >
                                Tiếp tục
                            </button>
                        )}

                        <button
                            type="button"
                            disabled={!canContinue}
                            className={`rounded-xl px-4 py-3 font-semibold active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed bg-emerald-400 text-black hover:bg-emerald-300 font-bold shadow-lg shadow-emerald-500/20 ${
                                isLastStep ? "flex-1 block" : "hidden"
                            }`}
                            onClick={onComplete}
                        >
                            Tiếp tục vào camera
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}

// --- Sub-components (unchanged API) ---

interface CountdownSelectionGroupProps {
    value: BoothCountdownSeconds;
    onChange: (value: BoothCountdownSeconds) => void;
}

function CountdownSelectionGroup({
    value,
    onChange,
}: CountdownSelectionGroupProps) {
    return (
        <fieldset className="space-y-3">
            <legend className="text-lg font-semibold">
                Thời gian đếm ngược
            </legend>
            <div className="grid gap-3 md:grid-cols-4">
                {countdownSecondOptions.map((option) => {
                    const selected = value === option;

                    return (
                        <label
                            key={option}
                            className={`cursor-pointer rounded-2xl border p-4 text-center transition ${
                                selected
                                    ? "border-emerald-300 bg-emerald-300/10"
                                    : "border-white/10 bg-white/5 hover:border-white/30"
                            }`}
                        >
                            <input
                                type="radio"
                                name="countdown-seconds"
                                value={option}
                                checked={selected}
                                className="sr-only"
                                onChange={() => {
                                    onChange(option);
                                }}
                            />
                            <span className="block text-2xl font-semibold">
                                {option}s
                            </span>
                            <span className="mt-1 block text-sm text-neutral-300">
                                Đếm {option} giây trước mỗi ảnh
                            </span>
                        </label>
                    );
                })}
            </div>
        </fieldset>
    );
}

interface SelectionOption {
    id: string;
    name: string;
    description: string;
}

interface SelectionGroupProps<TOption extends SelectionOption> {
    label: string;
    value: string;
    options: readonly TOption[];
    onChange: (value: string) => void;
}

function SelectionGroup<TOption extends SelectionOption>({
    label,
    value,
    options,
    onChange,
}: SelectionGroupProps<TOption>) {
    return (
        <fieldset className="space-y-3">
            <legend className="text-lg font-semibold">
                {label}
            </legend>
            <div className="grid gap-3 md:grid-cols-3">
                {options.map((option) => {
                    const selected = value === option.id;

                    return (
                        <label
                            key={option.id}
                            className={`cursor-pointer rounded-2xl border p-4 transition ${
                                selected
                                    ? "border-emerald-300 bg-emerald-300/10"
                                    : "border-white/10 bg-white/5 hover:border-white/30"
                            }`}
                        >
                            <input
                                type="radio"
                                name={label}
                                value={option.id}
                                checked={selected}
                                className="sr-only"
                                onChange={() => {
                                    onChange(option.id);
                                }}
                            />
                            <span className="block font-semibold">
                                {option.name}
                            </span>
                            <span className="mt-1 block text-sm text-neutral-300">
                                {option.description}
                            </span>
                        </label>
                    );
                })}
            </div>
        </fieldset>
    );
}

interface PresetButtonProps {
    selected: boolean;
    title: string;
    description: string;
    onClick: () => void;
}

function PresetButton({
    selected,
    title,
    description,
    onClick,
}: PresetButtonProps) {
    return (
        <button
            type="button"
            className={`rounded-2xl border p-4 text-left transition ${
                selected
                    ? "border-emerald-300 bg-emerald-300/10"
                    : "border-white/10 bg-white/5 hover:border-white/30"
            }`}
            onClick={onClick}
        >
            <span className="block font-semibold">
                {title}
            </span>
            <span className="mt-1 block text-sm text-neutral-300">
                {description}
            </span>
        </button>
    );
}

interface AddStickerControlProps {
    stickerCount: number;
    onAdd: (stickerId: string) => void;
}

function AddStickerControl({ stickerCount, onAdd }: AddStickerControlProps) {
    const [selectedId, setSelectedId] = useState<string>(stickerConfigs[0]?.id ?? "");

    if (stickerCount >= 4) {
        return (
            <p className="text-xs text-neutral-500 italic">
                Đã đạt giới hạn 4 sticker. Xóa sticker hiện có để thêm mới.
            </p>
        );
    }

    return (
        <div className="flex gap-2 items-center pt-2 border-t border-white/5">
            <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-semibold focus:outline-none focus:border-emerald-400 appearance-none"
            >
                {stickerConfigs.map((s) => (
                    <option key={s.id} value={s.id} className="bg-neutral-900 text-white">
                        {s.emoji} {s.name}
                    </option>
                ))}
            </select>
            <button
                type="button"
                onClick={() => {
                    if (selectedId) onAdd(selectedId);
                }}
                className="px-4 py-2.5 bg-emerald-400 text-black font-bold rounded-xl text-sm hover:bg-emerald-300 active:scale-95 transition shrink-0"
            >
                + Thêm sticker
            </button>
        </div>
    );
}
