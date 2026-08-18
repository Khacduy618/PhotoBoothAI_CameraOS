"use client";

import React from "react";
import { AssetManager } from "@/services/platform/asset-manager";

interface StyleSelectorProps {
    value: string;
    onChange: (styleId: string) => void;
    disabled?: boolean;
    compact?: boolean;
}

export function StyleSelector({
    value,
    onChange,
    disabled = false,
    compact = false,
}: StyleSelectorProps) {
    const styleConfigs = AssetManager.getStyleConfigs();

    return (
        <fieldset className="space-y-3" disabled={disabled}>
            <legend className="text-sm font-extrabold text-pink-950 uppercase tracking-wider">
                Chọn Style màu ảnh (Filter)
            </legend>
            <div className={`grid gap-3 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
                {styleConfigs.map((style) => {
                    const selected = value === style.id;
                    return (
                        <label
                            key={style.id}
                            className={`group cursor-pointer rounded-2xl border p-3.5 transition duration-300 text-left flex flex-col justify-between gap-2.5 ${
                                selected
                                    ? "border-pink-500 bg-pink-500/15 ring-2 ring-pink-400/40 text-pink-950 font-bold shadow-md shadow-pink-200/50"
                                    : "border-pink-200/60 bg-white/75 hover:bg-white hover:border-pink-300 text-neutral-800 shadow-sm"
                            }`}
                        >
                            <input
                                type="radio"
                                name="style-selection"
                                value={style.id}
                                checked={selected}
                                onChange={() => onChange(style.id)}
                                className="sr-only"
                                disabled={disabled}
                            />
                            <span className="font-extrabold text-sm block truncate text-pink-950">
                                {style.name}
                            </span>
                            <span className="text-xs text-pink-900/70 block leading-tight font-medium">
                                {style.description}
                            </span>
                        </label>
                    );
                })}
            </div>
        </fieldset>
    );
}
