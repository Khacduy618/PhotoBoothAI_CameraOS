"use client";

import { useEffect, useState } from "react";

import {
    getSharePhoto,
    type SharePhotoRecord,
} from "@/services/sharing/share-photo-storage.service";

interface SharePhotoClientProps {
    photoId: string;
}

export function SharePhotoClient({
    photoId,
}: SharePhotoClientProps) {
    const [photo, setPhoto] =
        useState<SharePhotoRecord | null>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            setPhoto(
                getSharePhoto(
                    window.localStorage,
                    photoId,
                ),
            );
            setLoaded(true);
        }, 0);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [photoId]);

    if (!loaded) {
        return (
            <main className="min-h-screen bg-black px-6 py-10 text-white">
                <section className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center text-center">
                    <h1 className="text-4xl font-semibold">
                        Đang tải ảnh...
                    </h1>
                </section>
            </main>
        );
    }

    if (!photo) {
        return (
            <main className="min-h-screen bg-black px-6 py-10 text-white">
                <section className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center gap-5 text-center">
                    <p className="text-sm uppercase tracking-[0.3em] text-amber-300">
                        Photo unavailable
                    </p>
                    <h1 className="text-5xl font-bold">
                        Ảnh không còn khả dụng
                    </h1>
                    <p className="max-w-xl text-lg leading-relaxed text-neutral-400">
                        Ảnh có thể đã hết hạn, bị xoá, hoặc đang nằm trên thiết bị booth khác. Vui lòng quay lại booth để tải lại hoặc chụp ảnh mới.
                    </p>
                </section>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-black px-5 py-8 text-white">
            <section className="mx-auto flex max-w-3xl flex-col gap-6">
                <header className="space-y-2 text-center">
                    <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">
                        PhotoBoothAI
                    </p>
                    <h1 className="text-4xl font-bold">
                        Ảnh của bạn đã sẵn sàng
                    </h1>
                    <p className="text-neutral-400">
                        Xem trước và tải ảnh về thiết bị của bạn.
                    </p>
                </header>

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={photo.dataUrl}
                    alt="Ảnh PhotoBoothAI đã lưu"
                    className="w-full rounded-3xl border border-white/10 object-contain shadow-2xl"
                />

                <a
                    href={photo.dataUrl}
                    download={`${photo.photoId}.jpg`}
                    className="rounded-full bg-white px-8 py-5 text-center text-xl font-semibold text-black"
                >
                    Tải ảnh
                </a>
            </section>
        </main>
    );
}
