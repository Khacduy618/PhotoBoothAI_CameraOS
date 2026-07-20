"use client";

import { LiveSelectionPreview } from "@/components/booth/live-selection-preview";
import {
    boothLayoutConfigs,
    countdownSecondOptions,
} from "@/config/layout.config";
import {
    stickerConfigs,
    textLabelPresetConfigs,
} from "@/config/sticker.config";
import {
    frameConfigs,
    isBoothSelectionComplete,
    styleConfigs,
    themeConfigs,
} from "@/config/theme.config";
import type { CameraController } from "@/hooks/use-camera";
import type {
    BoothCountdownSeconds,
    BoothOutputCustomization,
} from "@/types/customization";
import type { BoothSelection } from "@/types/theme";

const setupStickerId = "setup-sticker-preset";
const setupTextLabelId = "setup-text-preset";

interface BoothSelectionFlowProps {
    selection: BoothSelection;
    camera: CameraController;
    onSelectionChange: (selection: BoothSelection) => void;
    onComplete: () => void;
}

function replaceSetupSticker(
    customization: BoothOutputCustomization,
    stickerId: string | null,
): BoothOutputCustomization {
    const stickerItems = customization.stickerItems.filter(
        (item) => item.id !== setupStickerId,
    );

    if (!stickerId) {
        return {
            ...customization,
            stickerItems,
        };
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
        return {
            ...customization,
            textLabels,
        };
    }

    return {
        ...customization,
        textLabels: [
            ...textLabels,
            {
                id: setupTextLabelId,
                text: trimmedText.slice(0, 32),
                x: 0.5,
                y: 0.88,
                color: "#ffffff",
                fontSize: 42,
                rotationDegrees: 0,
            },
        ],
    };
}

export function BoothSelectionFlow({
    selection,
    camera,
    onSelectionChange,
    onComplete,
}: BoothSelectionFlowProps) {
    const canContinue = isBoothSelectionComplete(selection);
    const selectedSetupSticker = selection.customization.stickerItems.find(
        (item) => item.id === setupStickerId,
    );
    const selectedSetupText = selection.customization.textLabels.find(
        (label) => label.id === setupTextLabelId,
    );

    return (
        <section className="mx-auto grid w-full max-w-7xl gap-6 rounded-3xl border border-white/10 bg-neutral-950 p-5 text-white shadow-2xl lg:grid-cols-[minmax(0,1.15fr)_minmax(380px,0.85fr)]">
            <div className="space-y-5 lg:sticky lg:top-5 lg:self-start">
                <header className="space-y-2">
                    <p className="text-sm font-medium uppercase tracking-[0.24em] text-emerald-300">
                        Phase 1 realtime setup
                    </p>
                    <h1 className="text-3xl font-semibold">
                        Xem trước layout trước khi chụp
                    </h1>
                    <p className="max-w-3xl text-sm text-neutral-300">
                        Mọi lựa chọn layout, theme, khung, style, sticker và text sẽ cập nhật ngay trong preview. Đây là bản xem trước nhẹ; ảnh cuối vẫn được render sau khi ảnh gốc đã được lưu an toàn.
                    </p>
                </header>

                <LiveSelectionPreview
                    selection={selection}
                    camera={camera}
                />
            </div>

            <div className="space-y-5">
                <SelectionGroup
                    label="1. Layout ảnh"
                    value={selection.layoutId}
                    options={boothLayoutConfigs}
                    onChange={(layoutId) => {
                        onSelectionChange({
                            ...selection,
                            layoutId: layoutId as BoothSelection["layoutId"],
                        });
                    }}
                />

                <CountdownSelectionGroup
                    value={selection.countdownSeconds}
                    onChange={(countdownSeconds) => {
                        onSelectionChange({
                            ...selection,
                            countdownSeconds,
                        });
                    }}
                />

                <SelectionGroup
                    label="3. Theme"
                    value={selection.themeId}
                    options={themeConfigs}
                    onChange={(themeId) => {
                        onSelectionChange({
                            ...selection,
                            themeId,
                        });
                    }}
                />

                <SelectionGroup
                    label="4. Khung ảnh"
                    value={selection.frameId}
                    options={frameConfigs}
                    onChange={(frameId) => {
                        onSelectionChange({
                            ...selection,
                            frameId,
                        });
                    }}
                />

                <SelectionGroup
                    label="5. Style tuỳ chọn"
                    value={selection.styleId}
                    options={styleConfigs}
                    onChange={(styleId) => {
                        onSelectionChange({
                            ...selection,
                            styleId,
                        });
                    }}
                />

                <fieldset className="space-y-3">
                    <legend className="text-lg font-semibold">
                        6. Sticker preset
                    </legend>
                    <div className="grid gap-3 md:grid-cols-2">
                        <PresetButton
                            selected={!selectedSetupSticker}
                            title="Không sticker"
                            description="Giữ preview sạch."
                            onClick={() => {
                                onSelectionChange({
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
                                    onSelectionChange({
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

                <fieldset className="space-y-3">
                    <legend className="text-lg font-semibold">
                        7. Text preset
                    </legend>
                    <div className="grid gap-3 md:grid-cols-2">
                        <PresetButton
                            selected={!selectedSetupText}
                            title="Không text"
                            description="Không thêm nhãn trước khi chụp."
                            onClick={() => {
                                onSelectionChange({
                                    ...selection,
                                    customization: replaceSetupTextLabel(
                                        selection.customization,
                                        null,
                                    ),
                                });
                            }}
                        />
                        {textLabelPresetConfigs.map((preset) => (
                            <PresetButton
                                key={preset.id}
                                selected={selectedSetupText?.text === preset.text}
                                title={preset.text}
                                description={preset.description}
                                onClick={() => {
                                    onSelectionChange({
                                        ...selection,
                                        customization: replaceSetupTextLabel(
                                            selection.customization,
                                            preset.text,
                                        ),
                                    });
                                }}
                            />
                        ))}
                    </div>
                </fieldset>

                <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
                    <p className="max-w-md text-sm text-neutral-400">
                        Setup này sẽ được khoá cho capture hiện tại. Không có print/cloud trong Phase 1.
                    </p>
                    <button
                        type="button"
                        disabled={!canContinue}
                        className="rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={onComplete}
                    >
                        Tiếp tục vào camera
                    </button>
                </footer>
            </div>
        </section>
    );
}

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
                2. Thời gian đếm ngược
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
