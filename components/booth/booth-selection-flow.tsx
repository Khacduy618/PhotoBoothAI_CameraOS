"use client";

import React, { useState, useContext, useEffect } from "react";
import { LiveSelectionPreview } from "@/components/booth/live-selection-preview";
import { SetupStepShell } from "@/components/wizard/setup-step-shell";
import { BoothSessionContext } from "@/components/booth/booth-session-context";
import {
    boothLayoutConfigs,
    countdownSecondOptions,
    resolveBoothLayoutConfig,
} from "@/config/layout.config";
import {
    defaultBoothSelection,
    isBoothSelectionComplete,
} from "@/config/theme.config";
import { AssetManager } from "@/services/platform/asset-manager";
import { stickerConfigs } from "@/config/sticker.config";
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
    { id: "layout", title: "📸 Chọn số ảnh", shortLabel: "Shots" },
    { id: "review", title: "⏱️ Xác nhận đếm ngược 8 giây", shortLabel: "Ready" },
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
    const safeActiveStep = WIZARD_STEPS.some((step) => step.id === activeStep)
        ? activeStep
        : "layout";
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

    const currentIndex = WIZARD_STEPS.findIndex(s => s.id === safeActiveStep);
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

    const [systemWallpaper, setSystemWallpaper] = useState<string>("/backgrounds/system-bg.jpg");

    const WALLPAPERS = [
        { id: "pink-bokeh", name: "💖 Pink Bokeh", url: "/backgrounds/system-bg.jpg" },
        { id: "korean-sunset", name: "🌸 Sunset Cloud", url: "/backgrounds/korean-sunset.jpg" },
        { id: "starry-night", name: "🌌 Starry Sky", url: "/backgrounds/starry-night.jpg" },
    ];

    useEffect(() => {
        if (typeof document !== "undefined") {
            document.body.style.backgroundImage = `radial-gradient(circle at center, rgba(13, 9, 20, 0.45), rgba(13, 9, 20, 0.88)), url('${systemWallpaper}')`;
        }
    }, [systemWallpaper]);

    return (
        <>
            {/* Simplified attendee flow starts directly at shot selection. */}

            <SetupStepShell
                steps={WIZARD_STEPS}
                activeStep={safeActiveStep}
                onStepChange={setActiveStep}
                onComplete={onComplete}
                completeLabel="Tiếp tục vào camera"
                canContinue={canContinue}
            headerSlot={
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-500 flex items-center justify-center text-white text-lg shadow-md shadow-pink-300/50 font-bold">
                            📸
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-pink-600 flex items-center gap-1.5">
                                <span className="animate-sparkle-shine">✨</span> PhotoBoothAI Studio <span className="animate-sparkle-shine">💖</span>
                            </p>
                            <h1 className="text-lg font-black tracking-tight text-pink-950">
                                Chọn số ảnh, khung có lề vẽ 60px
                            </h1>
                        </div>
                    </div>

                    {/* Compact Wallpaper Picker Pills */}
                    <div className="flex items-center gap-1.5 bg-white/70 backdrop-blur-md border border-pink-200/80 p-1 rounded-full text-[10px] shadow-sm">
                        <span className="text-pink-900/70 pl-2 font-bold">🖼️ Nền 4K:</span>
                        {WALLPAPERS.map((wp) => (
                            <button
                                key={wp.id}
                                type="button"
                                onClick={() => setSystemWallpaper(wp.url)}
                                className={`px-2.5 py-1 rounded-full font-extrabold transition-all ${
                                    systemWallpaper === wp.url
                                        ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-sm"
                                        : "text-pink-950 hover:bg-pink-100/60"
                                }`}
                            >
                                {wp.name}
                            </button>
                        ))}
                    </div>
                </div>
            }
            previewSlot={
                <LiveSelectionPreview
                    selection={selection}
                    camera={camera}
                    onSelectionChange={setSelection}
                />
            }
        >
            {/* Step: Layout */}
            <div className={safeActiveStep === "layout" ? "space-y-4" : "hidden"}>
                <SelectionGroup
                    label="Chọn Layout"
                    value={selection.layoutId}
                    options={boothLayoutConfigs}
                    onChange={(layoutId) => {
                        setSelection({
                            ...selection,
                            layoutId: layoutId as BoothSelection["layoutId"],
                            countdownSeconds: 8,
                            customization: {
                                ...selection.customization,
                                stickerItems: [],
                                textLabels: [],
                                overlays: selection.customization.overlays?.filter((item) => item.type === "drawing") ?? [],
                            },
                        });
                    }}
                />
            </div>

            {/* Step: Countdown */}
            <div className={safeActiveStep === "countdown" ? "space-y-4" : "hidden"}>
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

            {/* Step: Review — fixed 8s countdown summary */}
            <div className={safeActiveStep === "review" ? "space-y-4" : "hidden"}>
                <div className="rounded-3xl border border-pink-200/70 bg-white/75 p-5 shadow-sm backdrop-blur-md">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] text-pink-600">
                        Capture plan
                    </p>
                    <h3 className="mt-2 text-2xl font-black text-pink-950">
                        {resolveBoothLayoutConfig(selection.layoutId).shotCount} ảnh · Đếm ngược 8 giây
                    </h3>
                    <ul className="mt-4 space-y-2 text-sm text-neutral-800">
                        <li className="flex justify-between border-b border-pink-100 pb-2">
                            <span className="font-medium text-neutral-500">Layout 4x6:</span>
                            <span className="font-bold text-pink-950">{resolveBoothLayoutConfig(selection.layoutId).name}</span>
                        </li>
                        <li className="flex justify-between border-b border-pink-100 pb-2">
                            <span className="font-medium text-neutral-500">Countdown:</span>
                            <span className="font-bold text-pink-950">8 giây / ảnh</span>
                        </li>
                        <li className="flex justify-between">
                            <span className="font-medium text-neutral-500">Customize sau capture:</span>
                            <span className="font-bold text-pink-950">Khung Canva PNG + bút vẽ</span>
                        </li>
                    </ul>
                </div>

                <p className="text-[12px] font-medium leading-relaxed text-pink-900/80">
                    Nhãn dán và chữ trang trí đã được tắt trong flow mới. Khung sẽ chọn sau khi lưu đủ ảnh gốc, rồi ảnh cuối được render từ derivative đã lưu.
                </p>
            </div>
        </SetupStepShell>
        </>
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
            <legend className="text-lg font-extrabold text-pink-950">
                Thời gian đếm ngược
            </legend>
            <div className="grid gap-3 md:grid-cols-4">
                {countdownSecondOptions.map((option) => {
                    const selected = value === option;

                    return (
                        <label
                            key={option}
                            className={`cursor-pointer rounded-2xl border p-4 text-center transition duration-300 ${
                                selected
                                    ? "border-pink-500 bg-pink-500/15 ring-2 ring-pink-400/40 text-pink-950 font-bold shadow-md shadow-pink-200/50"
                                    : "border-pink-200/60 bg-white/70 hover:bg-white hover:border-pink-300 text-neutral-800 shadow-sm"
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
                            <span className="block text-2xl font-black text-pink-950">
                                {option}s
                            </span>
                            <span className="mt-1 block text-xs font-medium text-pink-900/70">
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
            <legend className="text-lg font-extrabold text-pink-950">
                {label}
            </legend>
            <div className="grid gap-3 md:grid-cols-3">
                {options.map((option) => {
                    const selected = value === option.id;

                    return (
                        <label
                            key={option.id}
                            className={`cursor-pointer rounded-2xl border p-4 transition duration-300 ${
                                selected
                                    ? "border-pink-500 bg-pink-500/15 ring-2 ring-pink-400/40 text-pink-950 font-bold shadow-md shadow-pink-200/50"
                                    : "border-pink-200/60 bg-white/70 hover:bg-white hover:border-pink-300 text-neutral-800 shadow-sm"
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
                            <span className="block font-black text-pink-950">
                                {option.name}
                            </span>
                            <span className="mt-1 block text-xs font-medium text-pink-900/70">
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
            className={`rounded-2xl border p-4 text-left transition duration-300 ${
                selected
                    ? "border-pink-500 bg-pink-500/15 ring-2 ring-pink-400/40 text-pink-950 font-bold shadow-md shadow-pink-200/50"
                    : "border-pink-200/60 bg-white/70 hover:bg-white hover:border-pink-300 text-neutral-800 shadow-sm"
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
