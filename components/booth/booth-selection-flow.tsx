"use client";

import { LiveSelectionPreview } from "@/components/booth/live-selection-preview";
import {
    frameConfigs,
    isBoothSelectionComplete,
    styleConfigs,
    themeConfigs,
} from "@/config/theme.config";
import type { CameraController } from "@/hooks/use-camera";
import type { BoothSelection } from "@/types/theme";

interface BoothSelectionFlowProps {
    selection: BoothSelection;
    camera: CameraController;
    onSelectionChange: (selection: BoothSelection) => void;
    onComplete: () => void;
}

export function BoothSelectionFlow({
    selection,
    camera,
    onSelectionChange,
    onComplete,
}: BoothSelectionFlowProps) {
    const canContinue = isBoothSelectionComplete(selection);

    return (
        <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 rounded-3xl border border-white/10 bg-neutral-950 p-6 text-white shadow-2xl">
            <header className="space-y-2">
                <p className="text-sm font-medium uppercase tracking-[0.24em] text-emerald-300">
                    Phase 1 setup
                </p>
                <h1 className="text-3xl font-semibold">
                    Chọn giao diện trước khi chụp
                </h1>
                <p className="max-w-3xl text-sm text-neutral-300">
                    Theme và khung ảnh là bắt buộc. Style là tuỳ chọn và có thể để mặc định không áp dụng.
                    Sau khi chụp, ảnh gốc sẽ được dùng để render output theo lựa chọn này.
                </p>
            </header>

            <LiveSelectionPreview
                selection={selection}
                camera={camera}
            />

            <SelectionGroup
                label="1. Theme"
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
                label="2. Khung ảnh"
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
                label="3. Style tuỳ chọn"
                value={selection.styleId}
                options={styleConfigs}
                onChange={(styleId) => {
                    onSelectionChange({
                        ...selection,
                        styleId,
                    });
                }}
            />

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
                <p className="text-sm text-neutral-400">
                    Selection sẽ được khoá cho capture hiện tại khi bắt đầu chụp.
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
        </section>
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
