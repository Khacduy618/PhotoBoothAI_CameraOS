"use client";

import React, { createContext, useContext, useEffect } from "react";
import { useCamera } from "@/hooks/use-camera";
import type { CameraController } from "@/hooks/use-camera";

export const CameraContext = createContext<CameraController | null>(null);

export function CameraProvider({ children }: { children: React.ReactNode }) {
    const camera = useCamera();
    const { stream, status, connect } = camera;

    useEffect(() => {
        if (!stream && status === "idle") {
            void connect();
        }
    }, [connect, status, stream]);

    return (
        <CameraContext.Provider value={camera}>
            {children}
        </CameraContext.Provider>
    );
}

export function useCameraContext(): CameraController | null {
    return useContext(CameraContext);
}

