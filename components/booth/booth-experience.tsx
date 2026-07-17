"use client";

import { useState } from "react";

import { BoothSelectionFlow } from "@/components/booth/booth-selection-flow";
import { CameraPreview } from "@/components/camera/camera-preview";
import { defaultBoothSelection } from "@/config/theme.config";
import type { BoothSelection } from "@/types/theme";

export function BoothExperience() {
    const [selection, setSelection] =
        useState<BoothSelection>(defaultBoothSelection);
    const [selectionComplete, setSelectionComplete] =
        useState(false);

    if (!selectionComplete) {
        return (
            <BoothSelectionFlow
                selection={selection}
                onSelectionChange={setSelection}
                onComplete={() => {
                    setSelectionComplete(true);
                }}
            />
        );
    }

    return (
        <CameraPreview
            selection={selection}
            onBackToSetup={() => {
                setSelectionComplete(false);
            }}
        />
    );
}
