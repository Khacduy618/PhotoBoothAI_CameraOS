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

export type CameraController = ReturnType<typeof useCamera>;

export function useCamera() {
    const adapter = useMemo(() => new CaptureCardAdapter(), []);

    const cleanupStreamEndedHandlersRef =
        useRef<(() => void) | null>(null);
    const isConnectingRef = useRef(false);
    const isDisconnectedRef = useRef(false);
    const connectionRunIdRef = useRef(0);
    const mountedRef = useRef(true);

    const streamRef = useRef<MediaStream | null>(null);
    const statusRef = useRef<CameraStatus>("idle");
    const connectingPromiseRef = useRef<Promise<boolean> | null>(null);
    const activeDeviceIdRef = useRef<string | undefined>(undefined);

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
        async (deviceId?: string): Promise<boolean> => {
            // Return existing active stream if available
            if (
                streamRef.current &&
                streamRef.current.active &&
                streamRef.current.getVideoTracks().some((t) => t.readyState === "live") &&
                (deviceId === undefined || deviceId === activeDeviceIdRef.current)
            ) {
                setStream(streamRef.current);
                if (statusRef.current !== "ready") {
                    setStatus("ready");
                    statusRef.current = "ready";
                }
                return true;
            }

            if (isConnectingRef.current) {
                return false;
            }

            isConnectingRef.current = true;
            isDisconnectedRef.current = false;
            const runId = connectionRunIdRef.current;

            const doConnect = async (): Promise<boolean> => {
                let connectedStream: MediaStream | null = null;

                try {
                    setIsConnecting(true);
                    setStatus("connecting");
                    statusRef.current = "connecting";
                    setError(null);
                    clearStreamEndedHandlers();

                    let timeoutId: NodeJS.Timeout | undefined;
                    const cameraStream = await Promise.race([
                        adapter.connect(deviceId).then((stream) => {
                            if (timeoutId) clearTimeout(timeoutId);
                            return stream;
                        }),
                        new Promise<MediaStream>((_, reject) => {
                            timeoutId = setTimeout(() => {
                                reject(
                                    new Error(
                                        "Không thể khởi động camera (Timeout). Vui lòng kiểm tra quyền camera trên trình duyệt hoặc tắt các ứng dụng đang dùng camera (Zoom, OBS, FaceTime, v.v.) và bấm kết nối lại.",
                                    ),
                                );
                            }, 5000);
                        }),
                    ]);
                    console.log("[useCamera] connect() started. runId:", runId, "deviceId:", deviceId);
                    connectedStream = cameraStream;

                    const isStaleConnection = !mountedRef.current || isDisconnectedRef.current;

                    if (isStaleConnection) {
                        console.warn("[useCamera] Stale connection detected. Stopping tracks.");
                        stopStreamTracks(cameraStream);
                        return false;
                    }

                    setStatus("initializing");
                    statusRef.current = "initializing";

                    cleanupStreamEndedHandlersRef.current =
                        bindStreamEndedHandlers(
                            cameraStream,
                            () => {
                                console.warn("[useCamera] Camera stream ended callback fired!");
                                streamRef.current = null;
                                activeDeviceIdRef.current = undefined;
                                setStream(null);
                                setStatus("disconnected");
                                statusRef.current = "disconnected";
                                setError(
                                    "Camera đã ngắt kết nối. Vui lòng kết nối lại.",
                                );
                            },
                        );

                    streamRef.current = cameraStream;
                    activeDeviceIdRef.current = deviceId;
                    setStream(cameraStream);
                    setStatus("ready");
                    statusRef.current = "ready";
                    console.log("[useCamera] Status set to READY! stream:", cameraStream.id);

                    await loadDevices();

                    return true;
                } catch (cause) {
                    const isStaleConnection = !mountedRef.current || isDisconnectedRef.current;

                    clearStreamEndedHandlers();
                    if (connectedStream) {
                        stopStreamTracks(connectedStream);
                    }
                    adapter.disconnect();

                    if (isStaleConnection) {
                        return false;
                    }

                    streamRef.current = null;
                    activeDeviceIdRef.current = undefined;
                    setStream(null);
                    setStatus("error");
                    statusRef.current = "error";
                    const isPermissionError =
                        cause instanceof DOMException &&
                        (cause.name === "NotAllowedError" ||
                            cause.name === "PermissionDeniedError" ||
                            cause.message.includes("Permission denied"));

                    const errorMessage = isPermissionError
                        ? "Trình duyệt hoặc hệ điều hành đang CHẶN camera. Vui lòng bấm vào biểu tượng 🔒 trên thanh URL (bên trái localhost:3000) -> Chọn Camera -> Đổi thành 'Cho phép' (Allow) rồi bấm nút 'Thử kết nối lại'."
                        : cause instanceof Error
                            ? cause.message
                            : "Không thể kết nối camera.";

                    setError(errorMessage);

                    return false;
                } finally {
                    isConnectingRef.current = false;
                    connectingPromiseRef.current = null;
                    if (
                        mountedRef.current &&
                        connectionRunIdRef.current === runId
                    ) {
                        setIsConnecting(false);
                    }
                }
            };

            const promise = doConnect();
            connectingPromiseRef.current = promise;
            return promise;
        },
        [adapter, clearStreamEndedHandlers, loadDevices],
    );

    const disconnect = useCallback(() => {
        isDisconnectedRef.current = true;
        connectionRunIdRef.current += 1;
        connectingPromiseRef.current = null;
        streamRef.current = null;
        activeDeviceIdRef.current = undefined;
        clearStreamEndedHandlers();
        adapter.disconnect();
        setStream(null);
        setStatus("idle");
        statusRef.current = "idle";
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