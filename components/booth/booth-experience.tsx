"use client";

import { useEffect, useRef, useState } from "react";

import { BoothSelectionFlow } from "@/components/booth/booth-selection-flow";
import { BoothSessionProvider, useBoothSession } from "@/components/booth/booth-session-context";
import { CameraPreview } from "@/components/camera/camera-preview";
import {
    defaultBoothSelection,
    normalizeBoothSelection,
} from "@/config/theme.config";
import { SessionService } from "@/services/session/session.service";
import {
    createSessionStorageService,
    type SessionStorageService,
} from "@/services/storage/session-storage.service";
import type { BoothSession } from "@/types/session";
import type { BoothSelection } from "@/types/theme";

type RestoreStatus = "loading" | "ready";

export function BoothExperience() {
    const [initialSelection, setInitialSelection] =
        useState<BoothSelection | null>(null);
    const [restoreStatus, setRestoreStatus] =
        useState<RestoreStatus>("loading");
    const [restoredSession, setRestoredSession] =
        useState<BoothSession | null>(null);
    const sessionStorageRef =
        useRef<SessionStorageService | null>(null);
    const sessionServiceRef =
        useRef<SessionService | null>(null);

    useEffect(() => {
        const storageResult = createSessionStorageService();

        if (!storageResult.ok) {
            setInitialSelection(defaultBoothSelection);
            setRestoreStatus("ready");
            return;
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

            let loadedSelection = defaultBoothSelection;
            if (activeSession.ok && activeSession.value) {
                setRestoredSession(activeSession.value);
                if (activeSession.value.selection) {
                    loadedSelection = normalizeBoothSelection(
                        activeSession.value.selection,
                    );
                }
            }

            setInitialSelection(loadedSelection);
            setRestoreStatus("ready");
        };

        void restore();

        return () => {
            cancelled = true;
        };
    }, []);

    const abandonSession = async () => {
        if (restoredSession) {
            await sessionServiceRef.current?.abandonActiveSession();
        }
        setRestoredSession(null);
    };

    if (restoreStatus === "loading" || !initialSelection) {
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

    return (
        <BoothSessionProvider initialSelection={initialSelection}>
            <BoothInnerExperience
                restoredSession={restoredSession}
                onAbandonSession={abandonSession}
                sessionService={sessionServiceRef.current}
            />
        </BoothSessionProvider>
    );
}

function BoothInnerExperience({
    restoredSession,
    onAbandonSession,
    sessionService,
}: {
    restoredSession: BoothSession | null;
    onAbandonSession: () => Promise<void>;
    sessionService: SessionService | null;
}) {
    const {
        selection,
        selectionComplete,
        setSelectionComplete,
        camera,
    } = useBoothSession();

    const [showRecovery, setShowRecovery] = useState(Boolean(restoredSession));

    const handleStartNew = async () => {
        await onAbandonSession();
        setShowRecovery(false);
        setSelectionComplete(false);
    };

    const handleContinue = () => {
        setShowRecovery(false);
        if (!camera.stream || camera.status !== "ready") {
            void camera.connect();
        }
        setSelectionComplete(true);
    };

    const handleCompleteSelection = async () => {
        await sessionService?.startSession({
            selection,
        });
        setSelectionComplete(true);
    };

    if (showRecovery && restoredSession) {
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
                        onClick={handleContinue}
                    >
                        Tiếp tục
                    </button>
                    <button
                        type="button"
                        className="rounded-full border border-white/30 px-8 py-5 text-xl font-semibold"
                        onClick={handleStartNew}
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
                onComplete={handleCompleteSelection}
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
