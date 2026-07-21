"use client";

import React from "react";
import { AssetManager } from "@/services/platform/asset-manager";

interface ThemeSelectorProps {
    value: string;
    onChange: (themeId: string) => void;
    disabled?: boolean;
    compact?: boolean;
}

export function ThemeSelector({
    value,
    onChange,
    disabled = false,
    compact = false,
}: ThemeSelectorProps) {
    const themeConfigs = AssetManager.getThemes();

    return (
        <fieldset className="space-y-3" disabled={disabled}>
            <legend className="text-sm font-extrabold text-pink-950 uppercase tracking-wider">
                Chọn Theme màu
            </legend>
            <div className={`grid gap-3 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
                {themeConfigs.map((theme) => {
                    const selected = value === theme.id;
                    return (
                        <label
                            key={theme.id}
                            className={`group cursor-pointer rounded-2xl border p-3.5 transition duration-300 text-left flex flex-col justify-between gap-2.5 ${
                                selected
                                    ? "border-pink-500 bg-pink-500/15 ring-2 ring-pink-400/40 text-pink-950 font-bold shadow-md shadow-pink-200/50"
                                    : "border-pink-200/60 bg-white/75 hover:bg-white hover:border-pink-300 text-neutral-800 shadow-sm"
                            }`}
                        >
                            <input
                                type="radio"
                                name="theme-selection"
                                value={theme.id}
                                checked={selected}
                                onChange={() => onChange(theme.id)}
                                className="sr-only"
                                disabled={disabled}
                            />
                            <div className="flex items-center justify-between w-full">
                                <span className="font-extrabold text-sm block truncate">
                                    {theme.name}
                                </span>
                                <span
                                    className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                                    style={{ backgroundColor: theme.backgroundColor }}
                                />
                            </div>
                            <span className="text-xs text-pink-900/70 block leading-tight font-medium">
                                {theme.description}
                            </span>
                        </label>
                    );
                })}
            </div>
        </fieldset>
    );
}
