"use client";

import React, { useState } from "react";
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
    const [isPrinting, setIsPrinting] = useState(false);
    const [showQrModal, setShowQrModal] = useState(false);

    const handlePrint = () => {
        setIsPrinting(true);
        setTimeout(() => {
            window.print();
            setIsPrinting(false);
        }, 500);
    };

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
                                Bạn có thể in ảnh trực tiếp ra máy in Photobooth, quét mã QR để tải ảnh về điện thoại, hoặc lưu file độ phân giải cao.
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-3 pt-2">
                            <button
                                type="button"
                                onClick={handlePrint}
                                disabled={isPrinting}
                                className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-black text-sm shadow-xl shadow-pink-300/50 flex items-center justify-center gap-2.5 transition active:scale-95 disabled:opacity-50"
                            >
                                <span className="text-lg">🖨️</span>
                                <span>{isPrinting ? "Đang gửi lệnh in..." : "In ảnh Photobooth (Print)"}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowQrModal(true)}
                                className="w-full py-3.5 px-5 rounded-2xl bg-white border-2 border-pink-300 hover:border-pink-500 text-pink-950 font-black text-xs shadow-md flex items-center justify-center gap-2 transition active:scale-95"
                            >
                                <span className="text-lg">📲</span>
                                <span>Quét mã QR tải về điện thoại</span>
                            </button>
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

            {/* QR Modal Simple Overlay */}
            {showQrModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 text-center shadow-2xl border border-pink-200">
                        <h3 className="text-lg font-black text-pink-950">📲 Quét mã QR tải ảnh</h3>
                        <div className="w-48 h-48 mx-auto bg-pink-50 border border-pink-200 rounded-2xl flex flex-col items-center justify-center p-3 text-pink-950 shadow-inner">
                            <div className="w-36 h-36 bg-neutral-900 rounded-xl flex items-center justify-center text-white text-xs font-mono">
                                [QR CODE API]
                            </div>
                        </div>
                        <p className="text-xs text-pink-900/70 font-medium">
                            Dùng camera điện thoại quét mã trên để xem và lưu bức ảnh kỷ niệm về máy!
                        </p>
                        <button
                            type="button"
                            onClick={() => setShowQrModal(false)}
                            className="w-full py-2.5 rounded-xl bg-pink-500 text-white font-extrabold text-xs shadow-md hover:bg-pink-600 transition"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
