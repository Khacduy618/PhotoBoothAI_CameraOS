"use client";

import React from "react";
import { useBoothSession } from "@/components/booth/booth-session-context";
import { PreviewRenderer } from "@/components/booth/preview-renderer";

interface FinalResultViewProps {
    onBackToCustomize: () => void;
    onStartNewSession: () => void;
}

export function FinalResultView({
    onBackToCustomize,
    onStartNewSession,
}: FinalResultViewProps) {
    const { selection, capturedPhotos } = useBoothSession();
    return (
        <section className="flex flex-col h-full w-full max-w-6xl mx-auto p-4 md:p-6 overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between border-b border-pink-200/50 pb-3 shrink-0 gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-500 flex items-center justify-center text-white text-lg shadow-md shadow-pink-300/50 font-bold">
                        💖
                    </div>
                    <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-pink-600">
                            ✨ PhotoBoothAI Studio 🎉
                        </p>
                        <h1 className="text-lg font-black tracking-tight text-pink-950">
                            Ảnh Photobooth Kỷ niệm đã hoàn tất!
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onBackToCustomize}
                        className="px-3.5 py-2 rounded-2xl border border-pink-300 bg-white/80 hover:bg-white text-pink-950 font-extrabold text-xs shadow-sm transition active:scale-95"
                    >
                        ✏️ Chỉnh sửa lại
                    </button>
                    <button
                        type="button"
                        onClick={onStartNewSession}
                        className="px-3.5 py-2 rounded-2xl bg-pink-100 border border-pink-300 text-pink-950 font-extrabold text-xs hover:bg-pink-200 shadow-sm transition active:scale-95"
                    >
                        🔄 Chụp phiên mới
                    </button>
                </div>
            </header>

            {/* Main Result Display */}
            <div className="flex-1 min-h-0 grid lg:grid-cols-[1.3fr_0.7fr] gap-6 py-4 overflow-hidden">
                {/* Left Photo Composition Result */}
                <div className="flex items-center justify-center bg-white/40 backdrop-blur-xl rounded-3xl p-4 overflow-hidden border border-white/70 shadow-lg h-full">
                    <PreviewRenderer
                        capturedPhotos={capturedPhotos}
                        selection={selection}
                        className="max-h-full max-w-full object-contain shadow-2xl rounded-2xl"
                    />
                </div>

                {/* Right Export Actions */}
                <div className="flex flex-col h-full justify-between bg-white/60 backdrop-blur-xl rounded-3xl p-6 border border-white/80 shadow-xl space-y-6">
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-pink-600">
                                Sẵn sàng xuất file
                            </span>
                            <h2 className="text-xl font-black text-pink-950">
                                Lưu giữ khoảnh khắc của bạn
                            </h2>
                            <p className="text-xs text-pink-900/70 font-medium leading-relaxed">
                                File xuất được tạo cục bộ từ ảnh đã lưu và khung đang chọn. Không dùng cloud, không công khai đường dẫn ảnh và không giả lập trạng thái phần cứng chưa kiểm thử.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-pink-200 bg-white/70 p-4 text-xs font-bold text-pink-950 shadow-sm">
                            Dùng nút <span className="text-pink-700">Tải ảnh</span> trong thanh công cụ để lưu derivative cuối cùng đúng như preview.
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-pink-100/60 border border-pink-200 text-xs text-pink-950 font-bold space-y-1">
                        <p className="flex items-center gap-1">
                            <span>💡</span> <span>Mẹo bảo vệ ảnh:</span>
                        </p>
                        <p className="text-[11px] font-medium text-pink-900/80">
                            Ảnh của bạn được lưu an toàn cục bộ trên thiết bị. Bạn có thể quay lại chỉnh sửa khung mà không lo mất ảnh gốc.
                        </p>
                    </div>
                </div>
            </div>

        </section>
    );
}
