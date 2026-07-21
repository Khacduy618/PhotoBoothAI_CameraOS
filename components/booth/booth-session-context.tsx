"use client";

import React, { createContext, useContext, useState } from "react";
import { CameraProvider, useCameraContext } from "@/components/camera/camera-provider";
import type { CameraController } from "@/hooks/use-camera";
import type { BoothSelection, CapturedPhoto } from "@/types/theme";

// String-based step IDs — no hardcoded union type.
// Steps are registered via the PluginRegistry or inline config.
export type SetupStep = string;

interface BoothSessionContextValue {
    selection: BoothSelection;
    setSelection: (selection: BoothSelection) => void;
    activeStep: SetupStep;
    setActiveStep: (step: SetupStep) => void;
    selectionComplete: boolean;
    setSelectionComplete: (complete: boolean) => void;
    capturedPhotos: CapturedPhoto[];
    setCapturedPhotos: React.Dispatch<React.SetStateAction<CapturedPhoto[]>>;
    camera: CameraController;
}

export const BoothSessionContext = createContext<BoothSessionContextValue | null>(null);

interface BoothSessionProviderProps {
    initialSelection: BoothSelection;
    children: React.ReactNode;
}

function InnerBoothSessionProvider({
    initialSelection,
    children,
}: BoothSessionProviderProps) {
    const [selection, setSelection] = useState<BoothSelection>(initialSelection);
    const [activeStep, setActiveStep] = useState<SetupStep>("layout");
    const [selectionComplete, setSelectionComplete] = useState(false);
    const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
    
    const camera = useCameraContext()!;

    return (
        <BoothSessionContext.Provider
            value={{
                selection,
                setSelection,
                activeStep,
                setActiveStep,
                selectionComplete,
                setSelectionComplete,
                capturedPhotos,
                setCapturedPhotos,
                camera,
            }}
        >
            {children}
        </BoothSessionContext.Provider>
    );
}

export function BoothSessionProvider({
    initialSelection,
    children,
}: BoothSessionProviderProps) {
    const cameraContext = useCameraContext();

    if (!cameraContext) {
        return (
            <CameraProvider>
                <InnerBoothSessionProvider initialSelection={initialSelection}>
                    {children}
                </InnerBoothSessionProvider>
            </CameraProvider>
        );
    }

    return (
        <InnerBoothSessionProvider initialSelection={initialSelection}>
            {children}
        </InnerBoothSessionProvider>
    );
}

export function useBoothSession() {
    const context = useContext(BoothSessionContext);
    if (!context) {
        throw new Error("useBoothSession must be used within a BoothSessionProvider");
    }
    return context;
}
