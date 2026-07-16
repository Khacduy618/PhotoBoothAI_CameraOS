"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { CaptureCardAdapter } from "@/services/camera/capture-card.adapter";
import type { CameraDevice } from "@/types/camera";

export function useCamera() {
    const adapter = useMemo(() => new CaptureCardAdapter(), []);

    const [stream, setStream] = useState<MediaStream | null>(null);
    const [devices, setDevices] = useState<CameraDevice[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);

    const loadDevices = useCallback(async () => {
        const mediaDevices =
            await navigator.mediaDevices.enumerateDevices();

        const videoDevices = mediaDevices
            .filter((device) => device.kind === "videoinput")
            .map((device, index) => ({
                deviceId: device.deviceId,
                label: device.label || `Camera ${index + 1}`,
            }));

        setDevices(videoDevices);
    }, []);

    const connect = useCallback(
        async (deviceId?: string) => {
            try {
                setIsConnecting(true);
                setError(null);

                const cameraStream = await adapter.connect(deviceId);

                setStream(cameraStream);

                await loadDevices();

                return true;
            } catch (cause) {
                setStream(null);
                setError(
                    cause instanceof Error
                        ? cause.message
                        : "Không thể kết nối camera.",
                );

                return false;
            } finally {
                setIsConnecting(false);
            }
        },
        [adapter, loadDevices],
    );

    const disconnect = useCallback(() => {
        adapter.disconnect();
        setStream(null);
    }, [adapter]);

    useEffect(() => {
        return () => {
            adapter.disconnect();
        };
    }, [adapter]);

    return {
        adapter,
        stream,
        devices,
        error,
        isConnecting,
        connect,
        disconnect,
        loadDevices,
    };
}