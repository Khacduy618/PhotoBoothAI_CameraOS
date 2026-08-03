"use client";

import React, { useState, useEffect } from "react";
import { analyzeImportFrame } from "@/services/frame-import/frame-import-analyzer.service";
import type { FrameImportResult, FrameDefinition } from "@/services/frame-import/frame-import.types";
import { LocalFrameRegistry } from "@/services/frame/local-frame-registry";
import { FrameImportResultCard } from "./FrameImportResultCard";

interface ImageFileState {
    file: File;
    objectUrl: string;
    result?: FrameImportResult;
    error?: string;
    isPublished?: boolean;
}

export function FrameImportPanel() {
    const [fileStates, setFileStates] = useState<ImageFileState[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [filterStatus, setFilterStatus] = useState<"all" | "auto-approved" | "needs-review" | "rejected">("all");
    const [activeTab, setActiveTab] = useState<"import" | "registry">("import");
    const [allDefinitions, setAllDefinitions] = useState<readonly FrameDefinition[]>([]);
    const [registryFilter, setRegistryFilter] = useState<"all" | "published" | "private">("all");

    useEffect(() => {
        const updateRegistryState = () => {
            setAllDefinitions(LocalFrameRegistry.getAllDefinitions());
        };
        updateRegistryState();
        return LocalFrameRegistry.subscribe(updateRegistryState);
    }, []);

    const publishedCount = allDefinitions.filter((d) => d.status !== "private").length;
    const privateCount = allDefinitions.filter((d) => d.status === "private").length;

    const processFiles = async (files: File[]) => {
        const pngFiles = files.filter((f) => f.type === "image/png").slice(0, 25);
        if (pngFiles.length === 0) return;

        setIsAnalyzing(true);
        const newStates: ImageFileState[] = await Promise.all(
            pngFiles.map(async (file) => {
                const dataUrl = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = () => resolve(URL.createObjectURL(file));
                    reader.readAsDataURL(file);
                });
                return {
                    file,
                    objectUrl: dataUrl,
                };
            })
        );

        setFileStates((prev) => [...prev, ...newStates]);

        for (const item of newStates) {
            try {
                const img = new Image();
                img.src = item.objectUrl;
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });

                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");

                if (!ctx) {
                    throw new Error("Canvas 2D context unavailable");
                }

                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, img.width, img.height);

                const result = analyzeImportFrame({
                    fileName: item.file.name,
                    rgba: imageData.data,
                    width: img.width,
                    height: img.height,
                });

                setFileStates((prev) =>
                    prev.map((s) =>
                        s.file.name === item.file.name ? { ...s, result } : s,
                    ),
                );
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : "Failed to analyze image";
                setFileStates((prev) =>
                    prev.map((s) =>
                        s.file.name === item.file.name ? { ...s, error: errorMsg } : s,
                    ),
                );
            }
        }

        setIsAnalyzing(false);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            processFiles(Array.from(e.target.files));
        }
    };

    const handlePublish = (definition: FrameDefinition, fileName: string) => {
        LocalFrameRegistry.registerFrame({
            ...definition,
            status: "published",
        });
        setFileStates((prev) =>
            prev.map((s) => (s.file.name === fileName ? { ...s, isPublished: true } : s)),
        );
    };

    const handleReject = (importId: string) => {
        setFileStates((prev) => prev.filter((s) => s.result?.importId !== importId));
    };

    const handlePublishAllApproved = () => {
        for (const item of fileStates) {
            if (
                item.result &&
                (item.result.status === "auto-approved" || item.result.status === "needs-review") &&
                !item.isPublished
            ) {
                const defaultName = item.file.name
                    .replace(/\.[^/.]+$/, "")
                    .replace(/[-_]/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase());

                const photoViewportOrientation: "portrait" | "landscape" =
                    item.result.image.width > item.result.image.height ? "landscape" : "portrait";

                const definitionSlots = item.result.slots.map((s) => ({
                    id: s.id,
                    index: s.order,
                    x: s.normalizedBounds.x,
                    y: s.normalizedBounds.y,
                    width: s.normalizedBounds.width,
                    height: s.normalizedBounds.height,
                    photoViewportOrientation,
                }));

                const definition: FrameDefinition = {
                    id: `imported-${item.result.importId}`,
                    name: defaultName,
                    description: "Canva imported frame overlay",
                    kind: "png-overlay",
                    source: "canva",
                    assetUrl: item.objectUrl,
                    borderColor: "#ffffff",
                    borderWidth: 0,
                    shotCount: item.result.analysis.detectedShotCount ?? 4,
                    photoViewportOrientation,
                    outputWidth: item.result.image.width,
                    outputHeight: item.result.image.height,
                    slots: definitionSlots,
                    status: "published",
                };

                LocalFrameRegistry.registerFrame(definition);
            }
        }

        setFileStates((prev) =>
            prev.map((s) =>
                s.result && s.result.status !== "rejected" ? { ...s, isPublished: true } : s,
            ),
        );
    };

    const handleClearList = () => {
        fileStates.forEach((s) => URL.revokeObjectURL(s.objectUrl));
        setFileStates([]);
    };

    const counts = {
        total: fileStates.length,
        autoApproved: fileStates.filter((s) => s.result?.status === "auto-approved").length,
        needsReview: fileStates.filter((s) => s.result?.status === "needs-review").length,
        rejected: fileStates.filter((s) => s.result?.status === "rejected").length,
    };

    const filteredStates = fileStates.filter((s) => {
        if (!s.result) return true;
        if (filterStatus === "all") return true;
        return s.result.status === filterStatus;
    });

    const filteredDefinitions = allDefinitions.filter((d) => {
        if (registryFilter === "published") return d.status !== "private";
        if (registryFilter === "private") return d.status === "private";
        return true;
    });

    return (
        <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6">
            <header className="border-b border-pink-100 pb-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-black text-pink-950 uppercase tracking-wide">
                            Canva Frame Import & Registry Tool
                        </h1>
                        <p className="text-xs text-neutral-600 mt-0.5">
                            Phân tích tự động khung Canva PNG và quản lý danh sách Khung Đã Đăng Ký (Local Registry).
                        </p>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-1.5 bg-neutral-200/70 p-1 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setActiveTab("import")}
                            className={`rounded-lg px-3.5 py-1.5 text-xs font-black transition-all cursor-pointer ${
                                activeTab === "import"
                                    ? "bg-white text-pink-950 shadow-sm"
                                    : "text-neutral-600 hover:text-neutral-900"
                            }`}
                        >
                            📥 Nhập Canva PNG
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("registry")}
                            className={`rounded-lg px-3.5 py-1.5 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                                activeTab === "registry"
                                    ? "bg-white text-pink-950 shadow-sm"
                                    : "text-neutral-600 hover:text-neutral-900"
                            }`}
                        >
                            <span>🖼️ Đã Đăng Ký</span>
                            <span className="rounded-full bg-pink-500 text-white px-2 py-0.2 text-[10px] font-bold">
                                {allDefinitions.length}
                            </span>
                        </button>
                    </div>
                </div>
            </header>

            {/* TAB 1: IMPORT CANVA PNG */}
            {activeTab === "import" && (
                <div className="space-y-6 animate-fade-in">
                    <div className="rounded-2xl border-2 border-dashed border-pink-300 bg-pink-50/50 p-8 text-center transition-all hover:bg-pink-50 hover:border-pink-400">
                        <input
                            type="file"
                            accept="image/png"
                            multiple
                            onChange={handleFileChange}
                            className="hidden"
                            id="frame-import-file-input"
                        />
                        <label
                            htmlFor="frame-import-file-input"
                            className="cursor-pointer space-y-3 block"
                        >
                            <div className="mx-auto w-12 h-12 rounded-full bg-pink-100 flex items-center justify-center text-pink-600 text-xl font-bold">
                                ↑
                            </div>
                            <div className="space-y-1">
                                <span className="text-sm font-extrabold text-pink-950 block">
                                    Chọn hoặc kéo thả file Canva PNG (Tối đa 25 file)
                                </span>
                                <span className="text-xs text-neutral-500 block">
                                    Hệ thống sẽ tự động quét kênh Alpha để phát hiện số ô ảnh, tọa độ và thứ tự ô.
                                </span>
                            </div>
                        </label>
                    </div>

                    {fileStates.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                                <div className="flex items-center gap-2">
                                    {(["all", "auto-approved", "needs-review", "rejected"] as const).map((status) => (
                                        <button
                                            key={status}
                                            type="button"
                                            onClick={() => setFilterStatus(status)}
                                            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                                                filterStatus === status
                                                    ? "bg-pink-600 text-white shadow-sm"
                                                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                                            }`}
                                        >
                                            {status === "all" && `Tất cả (${counts.total})`}
                                            {status === "auto-approved" && `Auto-approved (${counts.autoApproved})`}
                                            {status === "needs-review" && `Needs review (${counts.needsReview})`}
                                            {status === "rejected" && `Rejected (${counts.rejected})`}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handlePublishAllApproved}
                                        className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-extrabold shadow-sm active:scale-95 cursor-pointer"
                                    >
                                        Publish All Approved
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleClearList}
                                        className="rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 px-3 py-1.5 text-xs font-bold cursor-pointer"
                                    >
                                        Clear List
                                    </button>
                                </div>
                            </div>

                            {isAnalyzing && (
                                <div className="flex items-center justify-center p-6 bg-pink-50 rounded-xl border border-pink-200 text-pink-900 font-bold text-xs animate-pulse">
                                    Đang phân tích kênh Alpha và ô ảnh...
                                </div>
                            )}

                            <div className="space-y-4">
                                {filteredStates.map((item) => {
                                    if (!item.result) {
                                        return (
                                            <div
                                                key={item.file.name}
                                                className="rounded-xl border border-neutral-200 bg-white p-4 text-xs font-medium text-neutral-500"
                                            >
                                                Đang xử lý {item.file.name}...
                                            </div>
                                        );
                                    }

                                    return (
                                        <FrameImportResultCard
                                            key={item.result.importId}
                                            result={item.result}
                                            imageUrl={item.objectUrl}
                                            isPublished={item.isPublished}
                                            onPublish={(def) => handlePublish(def, item.file.name)}
                                            onReject={handleReject}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: LOCAL REGISTRY MANAGER */}
            {activeTab === "registry" && (
                <div className="space-y-5 animate-fade-in">
                    {/* Header bar for Registry */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setRegistryFilter("all")}
                                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                                    registryFilter === "all"
                                        ? "bg-pink-600 text-white shadow-sm"
                                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                                }`}
                            >
                                Tất cả ({allDefinitions.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setRegistryFilter("published")}
                                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                                    registryFilter === "published"
                                        ? "bg-emerald-600 text-white shadow-sm"
                                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                                }`}
                            >
                                🟢 Published ({publishedCount})
                            </button>
                            <button
                                type="button"
                                onClick={() => setRegistryFilter("private")}
                                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                                    registryFilter === "private"
                                        ? "bg-amber-600 text-white shadow-sm"
                                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                                }`}
                            >
                                🔒 Private ({privateCount})
                            </button>
                        </div>

                        {allDefinitions.length > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (window.confirm("Bạn có chắc chắn muốn xoá TOÀN BỘ khung đã lưu trong Local Registry?")) {
                                        LocalFrameRegistry.clear();
                                    }
                                }}
                                className="rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 px-3.5 py-1.5 text-xs font-bold cursor-pointer"
                            >
                                🧹 Xoá Tất Cả Khung
                            </button>
                        )}
                    </div>

                    {filteredDefinitions.length === 0 ? (
                        <div className="rounded-2xl border border-neutral-200 bg-white p-12 text-center space-y-3">
                            <span className="text-3xl block">🖼️</span>
                            <span className="text-sm font-extrabold text-neutral-800 block">
                                Chức năng Local Registry chưa có khung nào
                            </span>
                            <p className="text-xs text-neutral-500 max-w-md mx-auto">
                                Chuyển qua tab &quot;Nhập Canva PNG&quot; để tải file khung Canva PNG của bạn lên và xuất bản (Publish) vào Registry!
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredDefinitions.map((def) => {
                                const isPrivate = def.status === "private";
                                const isLandscape = def.outputWidth >= def.outputHeight;

                                return (
                                    <div
                                        key={def.id}
                                        className={`rounded-2xl border p-4 bg-white shadow-sm transition-all space-y-3 ${
                                            isPrivate ? "border-amber-300/80 bg-amber-50/20" : "border-neutral-200 hover:border-pink-300"
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2 border-b border-neutral-100 pb-2.5">
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-black text-neutral-900 truncate max-w-[200px]">
                                                        {def.name}
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                                        isLandscape ? "bg-amber-100 text-amber-900 border-amber-300" : "bg-purple-100 text-purple-900 border-purple-300"
                                                    }`}>
                                                        {isLandscape ? "1800x1200" : "1200x1800"}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-neutral-500 truncate max-w-[240px]">
                                                    {def.description || "Canva imported frame overlay"}
                                                </p>
                                            </div>

                                            {isPrivate ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-black text-amber-900 border border-amber-300 shrink-0">
                                                    🔒 Private
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-black text-emerald-900 border border-emerald-300 shrink-0">
                                                    🟢 Published
                                                </span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 items-center">
                                            {/* Preview image */}
                                            <div className="w-full bg-neutral-900 rounded-xl p-1 overflow-hidden border border-neutral-200">
                                                {def.assetUrl ? (
                                                    <img
                                                        src={def.assetUrl}
                                                        alt={def.name}
                                                        className="w-full h-auto object-contain max-h-36 rounded-lg"
                                                    />
                                                ) : (
                                                    <div className="h-24 flex items-center justify-center text-xs font-bold text-neutral-500">
                                                        No preview image
                                                    </div>
                                                )}
                                            </div>

                                            {/* Info & Slot list */}
                                            <div className="space-y-1.5 text-xs">
                                                <div className="flex justify-between text-neutral-600">
                                                    <span>Shots:</span>
                                                    <span className="font-bold text-neutral-900">{def.shotCount} shots</span>
                                                </div>
                                                <div className="flex justify-between text-neutral-600">
                                                    <span>Số Ô (Slots):</span>
                                                    <span className="font-bold text-neutral-900">{def.slots.length} ô</span>
                                                </div>
                                                <div className="flex justify-between text-neutral-600">
                                                    <span>Kích thước:</span>
                                                    <span className="font-mono font-bold text-neutral-900">{def.outputWidth}×{def.outputHeight}</span>
                                                </div>
                                                <div className="flex justify-between text-neutral-600">
                                                    <span>Nguồn:</span>
                                                    <span className="font-bold text-pink-700 uppercase">{def.source}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-100">
                                            <button
                                                type="button"
                                                onClick={() => LocalFrameRegistry.toggleFrameStatus(def.id)}
                                                className={`flex-1 rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all cursor-pointer ${
                                                    isPrivate
                                                        ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                                                        : "bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300"
                                                }`}
                                            >
                                                {isPrivate ? "🟢 Đăng (Publish)" : "🔒 Chuyển Private (Ẩn)"}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (window.confirm(`Bạn có muốn xoá khung "${def.name}" khỏi Local Registry?`)) {
                                                        LocalFrameRegistry.removeFrame(def.id);
                                                    }
                                                }}
                                                className="rounded-xl border border-rose-300 bg-white hover:bg-rose-50 text-rose-700 px-3 py-1.5 text-xs font-bold cursor-pointer"
                                            >
                                                🗑️ Xoá
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
