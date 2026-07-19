"use client";

import { useEffect, useRef, useState } from "react";

import { BoothSelectionFlow } from "@/components/booth/booth-selection-flow";
import { CameraPreview } from "@/components/camera/camera-preview";
import { defaultBoothSelection } from "@/config/theme.config";
import { useCamera } from "@/hooks/use-camera";
import { SessionService } from "@/services/session/session.service";
import {
    createSessionStorageService,
    type SessionStorageService,
} from "@/services/storage/session-storage.service";
import type { BoothSession } from "@/types/session";
import type { BoothSelection } from "@/types/theme";

type RestoreStatus = "loading" | "ready";

export function BoothExperience() {
    const [selection, setSelection] =
        useState<BoothSelection>(defaultBoothSelection);
    const [selectionComplete, setSelectionComplete] =
        useState(false);
    const [restoreStatus, setRestoreStatus] =
        useState<RestoreStatus>("loading");
    const [restoredSession, setRestoredSession] =
        useState<BoothSession | null>(null);
    const sessionStorageRef =
        useRef<SessionStorageService | null>(null);
    const sessionServiceRef =
        useRef<SessionService | null>(null);
    const camera = useCamera();

    useEffect(() => {
        const storageResult = createSessionStorageService();

        if (!storageResult.ok) {
            const readyTimeoutId = window.setTimeout(
                () => {
                    setRestoreStatus("ready");
                },
                0,
            );

            return () => {
                window.clearTimeout(readyTimeoutId);
            };
        }

        sessionStorageRef.current = storageResult.value;
        sessionServiceRef.current = new SessionService(
            storageResult.value,
        );

        let cancelled = false;

        const restore = async () => {
            const activeSession =
                await storageResult.value.getActiveSession();

            if (cancelled) {
                return;
            }

            if (activeSession.ok && activeSession.value) {
                setRestoredSession(activeSession.value);
                if (activeSession.value.selection) {
                    setSelection(activeSession.value.selection);
                }
            }

            setRestoreStatus("ready");
        };

        void restore();

        return () => {
            cancelled = true;
        };
    }, []);

    const startNewSession = async () => {
        if (restoredSession) {
            await sessionServiceRef.current?.abandonActiveSession();
        }

        setRestoredSession(null);
        setSelectionComplete(false);
    };

    const continueSession = () => {
        setRestoredSession(null);
        setSelectionComplete(true);
    };

    const completeSelection = async () => {
        await sessionServiceRef.current?.startSession({
            selection,
        });
        setSelectionComplete(true);
    };

    if (restoreStatus === "loading") {
        return (
            <section className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center gap-4 text-center">
                <h1 className="text-4xl font-semibold">
                    Đang khôi phục session...
                </h1>
                <p className="text-neutral-400">
                    PhotoBoothAI đang kiểm tra session đang hoạt động trên thiết bị này.
                </p>
            </section>
        );
    }

    if (restoredSession && !selectionComplete) {
        return (
            <section className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center gap-8 text-center">
                <div className="space-y-4">
                    <p className="text-sm uppercase tracking-[0.3em] text-amber-300">
                        Session recovery
                    </p>
                    <h1 className="text-5xl font-bold">
                        Tiếp tục phiên chụp trước?
                    </h1>
                    <p className="text-lg leading-relaxed text-neutral-400">
                        Tìm thấy session đang hoạt động với {restoredSession.photoIds.length} ảnh đã liên kết. Bạn có thể tiếp tục hoặc bắt đầu session mới.
                    </p>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row">
                    <button
                        type="button"
                        className="rounded-full bg-white px-8 py-5 text-xl font-semibold text-black"
                        onClick={continueSession}
                    >
                        Tiếp tục
                    </button>
                    <button
                        type="button"
                        className="rounded-full border border-white/30 px-8 py-5 text-xl font-semibold"
                        onClick={() => {
                            void startNewSession();
                        }}
                    >
                        Bắt đầu mới
                    </button>
                </div>
            </section>
        );
    }

    if (!selectionComplete) {
        return (
            <BoothSelectionFlow
                selection={selection}
                camera={camera}
                onSelectionChange={setSelection}
                onComplete={() => {
                    void completeSelection();
                }}
            />
        );
    }

    return (
        <CameraPreview
            selection={selection}
            camera={camera}
            onBackToSetup={() => {
                setSelectionComplete(false);
            }}
        />
    );
}
