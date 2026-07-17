"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CaptureCardAdapter } from "@/services/camera/capture-card.adapter";
import type { CameraDevice, CameraStatus } from "@/types/camera";

export function stopStreamTracks(stream: MediaStream): void {
    stream.getTracks().forEach((track) => {
        track.stop();
    });
}

export function bindStreamEndedHandlers(
    stream: MediaStream,
    onEnded: () => void,
): () => void {
    const tracks = stream.getVideoTracks();

    tracks.forEach((track) => {
        track.addEventListener("ended", onEnded);
    });

    return () => {
        tracks.forEach((track) => {
            track.removeEventListener("ended", onEnded);
        });
    };
}

export function useCamera() {
    const adapter = useMemo(() => new CaptureCardAdapter(), []);

    const cleanupStreamEndedHandlersRef =
        useRef<(() => void) | null>(null);
    const isConnectingRef = useRef(false);
    const connectionRunIdRef = useRef(0);
    const mountedRef = useRef(true);

    const [stream, setStream] = useState<MediaStream | null>(null);
    const [devices, setDevices] = useState<CameraDevice[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] =
        useState<CameraStatus>("idle");
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

    const clearStreamEndedHandlers = useCallback(() => {
        cleanupStreamEndedHandlersRef.current?.();
        cleanupStreamEndedHandlersRef.current = null;
    }, []);

    const connect = useCallback(
        async (deviceId?: string) => {
            if (isConnectingRef.current) {
                return false;
            }

            const runId = connectionRunIdRef.current + 1;
            connectionRunIdRef.current = runId;

            let connectedStream: MediaStream | null = null;

            try {
                isConnectingRef.current = true;
                setIsConnecting(true);
                setStatus("connecting");
                setError(null);
                clearStreamEndedHandlers();

                const cameraStream = await adapter.connect(deviceId);
                connectedStream = cameraStream;

                const isStaleConnection =
                    !mountedRef.current ||
                    connectionRunIdRef.current !== runId;

                if (isStaleConnection) {
                    stopStreamTracks(cameraStream);
                    return false;
                }

                cleanupStreamEndedHandlersRef.current =
                    bindStreamEndedHandlers(
                        cameraStream,
                        () => {
                            setStream(null);
                            setStatus("disconnected");
                            setError(
                                "Camera đã ngắt kết nối. Vui lòng kết nối lại.",
                            );
                        },
                    );

                setStream(cameraStream);
                setStatus("ready");

                await loadDevices();

                return true;
            } catch (cause) {
                const isStaleConnection =
                    !mountedRef.current ||
                    connectionRunIdRef.current !== runId;

                clearStreamEndedHandlers();
                if (connectedStream) {
                    stopStreamTracks(connectedStream);
                }
                adapter.disconnect();

                if (isStaleConnection) {
                    return false;
                }

                setStream(null);
                setStatus("error");
                setError(
                    cause instanceof Error
                        ? cause.message
                        : "Không thể kết nối camera.",
                );

                return false;
            } finally {
                isConnectingRef.current = false;
                if (
                    mountedRef.current &&
                    connectionRunIdRef.current === runId
                ) {
                    setIsConnecting(false);
                }
            }
        },
        [adapter, clearStreamEndedHandlers, loadDevices],
    );

    const disconnect = useCallback(() => {
        connectionRunIdRef.current += 1;
        clearStreamEndedHandlers();
        adapter.disconnect();
        setStream(null);
        setStatus("idle");
    }, [adapter, clearStreamEndedHandlers]);

    useEffect(() => {
        return () => {
            mountedRef.current = false;
            connectionRunIdRef.current += 1;
            clearStreamEndedHandlers();
            adapter.disconnect();
        };
    }, [adapter, clearStreamEndedHandlers]);

    return {
        adapter,
        stream,
        devices,
        error,
        status,
        isConnecting,
        connect,
        disconnect,
        loadDevices,
    };
}