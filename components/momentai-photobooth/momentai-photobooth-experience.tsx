"use client";

import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { MomentAICaptureFormat, MomentAICaptureFormatId, MomentAIGuestSession, MomentAITemplate } from "@/types/momentai-guest-session";

const cloudBaseUrl = "https://gallery.momentai.vn/s";
const shotFormatByCount: Record<number, MomentAICaptureFormatId> = {
    1: "format_1shot",
    2: "format_2shot",
    4: "format_4shot",
    6: "format_6shot",
};

export function MomentAIPhotoboothExperience() {
    const [screen, setScreen] = useState<"start" | "format" | "capture" | "template" | "customize" | "result">("start");
    const [session, setSession] = useState<MomentAIGuestSession | null>(null);
    const [captureFormats, setCaptureFormats] = useState<readonly MomentAICaptureFormat[]>([]);
    const [templates, setTemplates] = useState<readonly MomentAITemplate[]>([]);
    const [selectedFormatId, setSelectedFormatId] = useState<MomentAICaptureFormatId | null>(null);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [customText, setCustomText] = useState("");
    const [drawStrokes, setDrawStrokes] = useState<Array<Array<[number, number]>>>([]);
    const [printStatus, setPrintStatus] = useState("Đang chuẩn bị ảnh...");
    const [finalPreviewDataUrl, setFinalPreviewDataUrl] = useState<string | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        fetch("/api/momentai-guest-session")
            .then((response) => response.json())
            .then((payload: { captureFormats?: MomentAICaptureFormat[] }) => setCaptureFormats(payload.captureFormats ?? []))
            .catch(() => setCaptureFormats([]));
    }, []);

    const selectedTemplate = useMemo(
        () => templates.find((template) => template.templateId === selectedTemplateId) ?? templates[0] ?? null,
        [selectedTemplateId, templates],
    );

    async function api(action: string, body: Record<string, unknown> = {}) {
        const response = await fetch("/api/momentai-guest-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, ...body }),
        });
        const payload = await response.json() as { ok: boolean; session?: MomentAIGuestSession; error?: string };
        if (!payload.ok || !payload.session) throw new Error(payload.error || "MomentAI Photobooth API failed.");
        setSession(payload.session);
        return payload.session;
    }

    async function startSession() {
        if (busy) return;
        setBusy(true);
        try {
            const nextSession = await api("start-session");
            setSession(nextSession);
            setSelectedFormatId(null);
            setSelectedTemplateId(null);
            setCustomText("");
            setDrawStrokes([]);
            setPrintStatus("Đang chuẩn bị ảnh...");
            setFinalPreviewDataUrl(null);
            setQrDataUrl(null);
            setScreen("format");
        } finally {
            setBusy(false);
        }
    }

    async function continueWithFormat(formatId: MomentAICaptureFormatId) {
        if (!session || busy) return;
        setBusy(true);
        try {
            setSelectedFormatId(formatId);
            await api("select-format", { sessionId: session.sessionId, formatId });
            setScreen("capture");
        } finally {
            setBusy(false);
        }
    }

    async function completeCapture(photos: Array<{ photoId: string; shotIndex: number; originalPath: string; dataUrl: string }>) {
        if (!session || busy) return;
        setBusy(true);
        try {
            let updated = session;
            for (const photo of photos) {
                updated = await api("add-photo", { sessionId: updated.sessionId, photo });
            }
            const response = await fetch(`/api/momentai-guest-session?eventId=${encodeURIComponent(updated.eventId)}&captureFormatId=${encodeURIComponent(updated.captureFormat!.id)}`);
            const payload = await response.json() as { templates?: MomentAITemplate[] };
            setTemplates(payload.templates ?? []);
            setSelectedTemplateId(payload.templates?.[0]?.templateId ?? null);
            setScreen("template");
        } finally {
            setBusy(false);
        }
    }

    async function continueWithTemplate() {
        if (!session || !selectedTemplate || busy) return;
        setBusy(true);
        try {
            const nextSession = await api("select-template", { sessionId: session.sessionId, templateId: selectedTemplate.templateId });
            if (selectedTemplate.customization.allowTyping || selectedTemplate.customization.allowDraw) {
                setScreen("customize");
                return;
            }
            await composeAndShowResult(nextSession);
        } finally {
            setBusy(false);
        }
    }

    async function saveCustomization(drawDataUrl?: string) {
        if (!session || busy) return;
        setBusy(true);
        try {
            const nextSession = await api("save-customization", {
                sessionId: session.sessionId,
                customization: {
                    text: customText.trim() ? [{ regionId: "guest_message", value: customText.trim().slice(0, 50) }] : [],
                    drawing: drawStrokes.map((points, index) => ({ strokeId: `stroke_${index}`, points, width: 6, color: "#1A1A1A" })),
                },
            });
            const withDrawPreview = drawDataUrl ? { ...nextSession, customization: nextSession.customization } : nextSession;
            await composeAndShowResult(withDrawPreview);
        } finally {
            setBusy(false);
        }
    }

    async function composeAndShowResult(current: MomentAIGuestSession) {
        const composed = await api("compose", { sessionId: current.sessionId });
        setFinalPreviewDataUrl(renderFinalCompositionPreview(composed));
        setQrDataUrl(await QRCode.toDataURL(composed.qr?.url || `${cloudBaseUrl}/${encodeURIComponent(composed.sessionId)}`, {
            errorCorrectionLevel: "M",
            margin: 2,
            scale: 8,
            color: { dark: "#1A1A1A", light: "#FFFFFF" },
        }));
        setScreen("result");
        void api("auto-print", { sessionId: composed.sessionId, copies: 1 })
            .then((printed) => setPrintStatus(printed.printJob ? "Đã đưa vào hàng đợi in tự động" : "Đã sẵn sàng tải bản digital"))
            .catch(() => setPrintStatus("Máy in đang cần hỗ trợ"));
    }

    async function finishSession() {
        if (session) {
            await api("complete", { sessionId: session.sessionId }).catch(() => undefined);
        }
        setSession(null);
        setTemplates([]);
        setScreen("start");
    }

    return (
        <div className="min-h-screen bg-[#FDFCFB] text-[#1A1A1A] font-sans select-none">
            {screen === "start" && <AttractScreen onStartSession={() => void startSession()} busy={busy} />}
            {screen === "format" && (
                <SelectShotsScreen
                    formats={captureFormats}
                    selectedFormatId={selectedFormatId}
                    onSelectShots={(formatId) => void continueWithFormat(formatId)}
                    onBackToStart={() => setScreen("start")}
                    busy={busy}
                />
            )}
            {screen === "capture" && session?.captureFormat && (
                <AutoCaptureScreen session={session} onComplete={(photos) => void completeCapture(photos)} />
            )}
            {screen === "template" && session && (
                <SelectFrameScreen
                    session={session}
                    templates={templates}
                    selectedTemplateId={selectedTemplateId}
                    onSelectTemplate={setSelectedTemplateId}
                    onBackToShots={() => setScreen("format")}
                    onContinue={() => void continueWithTemplate()}
                    busy={busy}
                />
            )}
            {screen === "customize" && session && selectedTemplate && (
                <CustomizeScreen
                    session={session}
                    template={selectedTemplate}
                    customText={customText}
                    setCustomText={setCustomText}
                    drawStrokes={drawStrokes}
                    setDrawStrokes={setDrawStrokes}
                    onBackToTemplate={() => setScreen("template")}
                    onDone={(drawDataUrl) => void saveCustomization(drawDataUrl)}
                    busy={busy}
                />
            )}
            {screen === "result" && session && (
                <PrintQRScreen
                    session={session}
                    finalPreviewDataUrl={finalPreviewDataUrl}
                    qrDataUrl={qrDataUrl}
                    printStatus={printStatus}
                    onFinishSession={() => void finishSession()}
                />
            )}
        </div>
    );
}

function AttractScreen({ onStartSession, busy }: { onStartSession: () => void; busy: boolean }) {
    return (
        <button
            type="button"
            onClick={onStartSession}
            disabled={busy}
            className="relative w-full h-screen select-none cursor-pointer overflow-hidden flex flex-col justify-between text-left disabled:cursor-wait"
        >
            <div className="absolute inset-0 w-full h-full z-0 bg-black">
                <img
                    src="/backgrounds/hoian-ancient-town-scenery.jpg"
                    alt="Hội An Ancient Town Scenery"
                    className="w-full h-full object-cover object-center scale-105 brightness-90 saturate-110"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/35 to-black/75" />
            </div>

            <header className="relative z-10 pt-6 px-6 sm:px-10 flex justify-center sm:justify-start items-center text-[#FDFCFB]">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-black/40 backdrop-blur-md border border-white/20 rounded-full text-xs font-mono uppercase tracking-widest text-[#FDFCFB]">
                    <span className="text-[#E6C687]" aria-hidden="true">⌖</span>
                    <span>PHỐ CỔ HỘI AN - TIỆM ẢNH DI SẢN</span>
                </div>
            </header>

            <main className="relative z-10 my-auto px-6 max-w-4xl mx-auto flex flex-col items-center text-center gap-8 py-8">
                <h1 className="text-4xl sm:text-6xl lg:text-7xl font-serif tracking-tight text-[#FDFCFB] leading-tight drop-shadow-lg">
                    Photobooth Tại Phố Cổ Hội An
                </h1>

                <div className="pt-2">
                    <div className="w-full sm:w-[380px] h-[60px] bg-[#FDFCFB] text-[#1A1A1A] border-2 border-[#E6C687] flex items-center justify-between px-8 group cursor-pointer shadow-2xl rounded-sm transition duration-200 hover:scale-105 active:scale-95">
                        <div className="flex items-center gap-3">
                            <span className="text-xl text-[#C85A32]" aria-hidden="true">📷</span>
                            <span className="text-sm uppercase tracking-[0.25em] font-bold">{busy ? "ĐANG TẠO PHIÊN..." : "CHẠM ĐỂ CHỤP ẢNH"}</span>
                        </div>
                        <span className="text-xl text-[#1A1A1A] transition-transform group-hover:translate-x-1.5" aria-hidden="true">→</span>
                    </div>
                </div>
            </main>
        </button>
    );
}

function SelectShotsScreen({ formats, selectedFormatId, onSelectShots, onBackToStart, busy }: { formats: readonly MomentAICaptureFormat[]; selectedFormatId: MomentAICaptureFormatId | null; onSelectShots: (formatId: MomentAICaptureFormatId) => void; onBackToStart: () => void; busy: boolean }) {
    const [localSelected, setLocalSelected] = useState<MomentAICaptureFormatId | null>(selectedFormatId);
    const shotOptions = [1, 2, 4, 6].map((shotCount) => ({
        shotCount,
        label: `${shotCount} SHOT${shotCount > 1 ? "S" : ""}`,
        format: formats.find((item) => item.shotCount === shotCount),
    }));

    return (
        <div className="w-full h-screen flex flex-col justify-between p-6 sm:p-10 bg-[#FDFCFB] text-[#1A1A1A] select-none overflow-y-auto">
            <div className="w-full max-w-6xl mx-auto flex flex-col items-center text-center">
                <h2 className="text-3xl sm:text-5xl font-serif tracking-tight text-[#1A1A1A] mb-2">CHỌN KIỂU ẢNH</h2>
                <p className="text-xs sm:text-sm opacity-70 max-w-md font-sans">Chọn số khoảnh khắc bạn muốn ghi lại trong phiên chụp này.</p>
            </div>

            <div className="w-full max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 my-auto py-4">
                {shotOptions.map((opt) => {
                    const formatId = opt.format?.id ?? shotFormatByCount[opt.shotCount];
                    const isSelected = localSelected === formatId;
                    return (
                        <button
                            key={opt.shotCount}
                            type="button"
                            onClick={() => setLocalSelected(formatId)}
                            className={`relative p-8 sm:p-10 min-h-[300px] border-2 transition-all duration-200 flex flex-col items-center justify-between text-center cursor-pointer bg-[#F4F2EE] text-[#1A1A1A] rounded-sm ${
                                isSelected ? "border-[#1A1A1A] ring-2 ring-[#1A1A1A] shadow-md bg-[#FAF8F5]" : "border-[#1A1A1A]/15 hover:border-[#1A1A1A]/60"
                            }`}
                        >
                            {isSelected && <div className="absolute top-3 right-3 flex items-center gap-1 bg-[#1A1A1A] text-[#FDFCFB] text-[10px] font-bold px-2.5 py-1 tracking-wider uppercase rounded-xs">✓ ĐÃ CHỌN</div>}
                            <div className="my-auto flex items-center justify-center h-full py-2">
                                <ShotLayoutPreview shotCount={opt.shotCount} />
                            </div>
                            <span className="text-2xl font-serif font-bold tracking-tight mt-4">{opt.label}</span>
                        </button>
                    );
                })}
            </div>

            <div className="w-full max-w-5xl mx-auto border-t border-[#1A1A1A]/10 pt-4 flex justify-between items-center">
                <button onClick={onBackToStart} className="px-5 py-2.5 border border-[#1A1A1A]/20 hover:border-[#1A1A1A] text-[11px] font-bold tracking-[0.2em] uppercase flex items-center gap-2 transition-colors cursor-pointer">← QUAY LẠI</button>
                <button
                    disabled={!localSelected || busy}
                    onClick={() => localSelected && onSelectShots(localSelected)}
                    className={`px-8 py-3 text-[11px] font-bold tracking-[0.25em] uppercase flex items-center gap-3 transition-all ${
                        localSelected && !busy ? "bg-[#1A1A1A] text-[#FDFCFB] hover:bg-[#333333] shadow-md cursor-pointer" : "bg-[#E5E3DD] text-[#8C8880] cursor-not-allowed border border-[#1A1A1A]/10"
                    }`}
                >
                    TIẾP TỤC →
                </button>
            </div>
        </div>
    );
}

function ShotLayoutPreview({ shotCount }: { shotCount: number }) {
    if (shotCount === 6) {
        return <div className="w-28 aspect-[2/3] bg-[#FDFCFB] p-2 flex flex-col justify-between gap-1 border border-[#1A1A1A]/30 shadow-sm rounded-xs"><div className="grid grid-cols-2 gap-1 w-full h-[85%]">{[1, 2, 3, 4, 5, 6].map((num) => <div key={num} className="w-full h-full bg-[#1A1A1A]/5 border border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-[10px] font-bold text-[#1A1A1A]/50 rounded-xs">{num}</div>)}</div><div className="text-[8px] font-serif italic text-center text-[#1A1A1A] font-bold tracking-wider pt-0.5 border-t border-[#1A1A1A]/10">PHỐ CỔ HỘI AN</div></div>;
    }
    if (shotCount === 4) {
        return <div className="w-20 aspect-[1/2.2] bg-[#FDFCFB] p-1.5 flex flex-col justify-between gap-1 border border-[#1A1A1A]/30 shadow-sm rounded-xs">{[1, 2, 3, 4].map((num) => <div key={num} className="w-full h-[20%] bg-[#1A1A1A]/5 border border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-[10px] font-bold text-[#1A1A1A]/50 rounded-xs">{num}</div>)}<div className="text-[7px] font-serif italic text-center text-[#1A1A1A] font-bold tracking-wider pt-0.5 border-t border-[#1A1A1A]/10">HỘI AN</div></div>;
    }
    return <div className="w-28 aspect-[2/3] bg-[#FDFCFB] p-2.5 flex flex-col justify-between gap-1.5 border border-[#1A1A1A]/30 shadow-sm rounded-xs">{Array.from({ length: shotCount }).map((_, index) => <div key={index} className={`${shotCount === 1 ? "h-[82%]" : "h-[41%]"} w-full bg-[#1A1A1A]/5 border border-dashed border-[#1A1A1A]/30 flex items-center justify-center font-mono text-xs font-bold text-[#1A1A1A]/50 rounded-xs`}>{index + 1}</div>)}<div className="text-[8px] font-serif italic text-center text-[#1A1A1A] font-bold tracking-wider pt-1 border-t border-[#1A1A1A]/10">PHỐ CỔ HỘI AN</div></div>;
}

function AutoCaptureScreen({ session, onComplete }: { session: MomentAIGuestSession; onComplete: (photos: Array<{ photoId: string; shotIndex: number; originalPath: string; dataUrl: string }>) => void }) {
    const [currentShot, setCurrentShot] = useState(0);
    const [countdown, setCountdown] = useState(3);
    const [isFlashing, setIsFlashing] = useState(false);
    const [capturedPool, setCapturedPool] = useState<Array<{ photoId: string; shotIndex: number; originalPath: string; dataUrl: string }>>([]);
    const runningRef = useRef(false);
    const totalShots = session.captureFormat?.shotCount ?? 1;

    useEffect(() => {
        if (runningRef.current) return;
        runningRef.current = true;
        let cancelled = false;
        const captured: Array<{ photoId: string; shotIndex: number; originalPath: string; dataUrl: string }> = [];
        const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

        async function runCaptureLoop() {
            for (let shot = 0; shot < totalShots; shot += 1) {
                setCurrentShot(shot);
                for (let nextCountdown = 3; nextCountdown > 0; nextCountdown -= 1) {
                    if (cancelled) return;
                    setCountdown(nextCountdown);
                    await wait(1000);
                }
                if (cancelled) return;
                setCountdown(0);
                setIsFlashing(true);
                await wait(200);
                setIsFlashing(false);
                const photo = {
                    photoId: `photo_${session.sessionId}_${shot + 1}`,
                    shotIndex: shot + 1,
                    originalPath: `originals/capture_${String(shot + 1).padStart(2, "0")}.jpg`,
                    dataUrl: makeSimulatedPhoto(shot + 1),
                };
                captured.push(photo);
                setCapturedPool([...captured]);
                await wait(2000);
            }
            if (!cancelled) onComplete(captured);
        }

        void runCaptureLoop();
        return () => {
            cancelled = true;
        };
    }, [onComplete, session.sessionId, totalShots]);

    return (
        <div className="relative w-full h-screen flex flex-col items-center justify-between p-4 sm:p-6 bg-[#FDFCFB] text-[#1A1A1A] select-none overflow-hidden">
            {isFlashing && <div className="fixed inset-0 bg-white z-50 pointer-events-none" />}
            <div className="z-10 text-center mb-1">
                <h3 className="text-[#1A1A1A] font-serif text-lg font-bold uppercase tracking-wider">ĐANG CHỤP ẢNH {Math.min(currentShot + 1, totalShots)} / {totalShots}</h3>
            </div>
            <div className="relative w-full max-w-4xl h-[56vh] sm:h-[62vh] bg-[#1A1A1A] border border-[#1A1A1A] shadow-lg overflow-hidden flex items-center justify-center my-auto">
                <div className="w-full h-full relative bg-[#1A1A1A] text-[#FDFCFB] flex flex-col items-center justify-center">
                    <span className="text-6xl text-[#FDFCFB]/40 animate-pulse" aria-hidden="true">📷</span>
                </div>
                <CanonViewfinderHUD isCapturing={countdown === 0} />
                {countdown > 0 && currentShot < totalShots && <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#1A1A1A]/40 backdrop-blur-[2px]"><div className="w-36 h-36 sm:w-48 sm:h-48 bg-[#FDFCFB] text-[#1A1A1A] border border-[#1A1A1A] flex items-center justify-center font-serif text-7xl sm:text-9xl shadow-2xl">{countdown}</div></div>}
            </div>
            <div className="z-10 w-full max-w-4xl flex items-center justify-between gap-3 py-2.5 px-6 bg-[#F4F2EE] border border-[#1A1A1A]/15">
                <span className="text-[10px] font-mono font-bold tracking-widest uppercase opacity-60">GALLERY ({capturedPool.length}/{totalShots})</span>
                <div className="flex items-center gap-2 overflow-x-auto py-0.5">{Array.from({ length: totalShots }).map((_, idx) => { const photo = capturedPool[idx]; return <div key={idx} className={`w-14 h-10 sm:w-16 sm:h-11 border flex items-center justify-center overflow-hidden transition-all ${photo ? "border-[#1A1A1A] bg-[#FDFCFB]" : idx === currentShot ? "border-[#1A1A1A] bg-[#E8E6E1] animate-pulse" : "border-[#1A1A1A]/15 bg-[#FDFCFB]/50 text-[#1A1A1A]/30"}`}>{photo ? <img src={photo.dataUrl} alt={`Captured ${idx + 1}`} className="w-full h-full object-cover" /> : <span className="text-[10px] font-mono font-bold">#{idx + 1}</span>}</div>; })}</div>
            </div>
        </div>
    );
}

function SelectFrameScreen({ session, templates, selectedTemplateId, onSelectTemplate, onBackToShots, onContinue, busy }: { session: MomentAIGuestSession; templates: readonly MomentAITemplate[]; selectedTemplateId: string | null; onSelectTemplate: (id: string) => void; onBackToShots: () => void; onContinue: () => void; busy: boolean }) {
    const selectedTemplate = templates.find((template) => template.templateId === selectedTemplateId) || templates[0];

    return (
        <div className="w-full h-screen flex flex-col justify-between p-6 sm:p-8 bg-[#FDFCFB] text-[#1A1A1A] select-none overflow-y-auto">
            <div className="w-full max-w-6xl mx-auto flex flex-col items-center text-center">
                <h2 className="text-3xl sm:text-5xl font-serif tracking-tight text-[#1A1A1A]">CHỌN MẪU KHUNG</h2>
                <p className="text-xs sm:text-sm opacity-75 mt-1 font-sans max-w-lg">Xem trước trực tiếp ảnh của bạn theo đúng tỉ lệ và bố cục vị trí khung mẫu.</p>
            </div>
            {templates.length === 0 ? <Recovery title="Không có template phù hợp" detail="Operator cần publish template cho shot format này trước khi tiếp tục." /> : (
                <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 my-auto py-4 items-center">
                    <div className="lg:col-span-5 flex lg:flex-col gap-3.5 overflow-x-auto lg:overflow-y-auto max-h-[460px] p-1">
                        {templates.map((template) => {
                            const isSelected = selectedTemplate?.templateId === template.templateId;
                            return <button key={template.templateId} onClick={() => onSelectTemplate(template.templateId)} className={`relative p-4 border-2 transition-all flex items-center justify-between gap-4 cursor-pointer min-w-[260px] sm:min-w-[300px] lg:min-w-0 rounded-xs ${isSelected ? "border-[#1A1A1A] bg-[#1A1A1A] text-[#FDFCFB] shadow-md ring-2 ring-[#1A1A1A]" : "border-[#1A1A1A]/15 bg-[#F4F2EE] text-[#1A1A1A] hover:border-[#1A1A1A]/60"}`}>
                                <div className="flex items-center gap-3.5 text-left"><div className="w-14 h-18 bg-[#E8E6E1] overflow-hidden border border-[#1A1A1A]/10 flex-shrink-0 shadow-xs"><TemplateThumb template={template} /></div><div><h4 className="font-serif italic text-lg leading-snug font-bold">{template.name}</h4><span className="text-[10px] opacity-70 font-mono tracking-wider block font-medium">PHỐ CỔ HỘI AN • {template.captureFormatId}</span><div className="flex items-center gap-1.5 mt-2 flex-wrap"><span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 tracking-wider uppercase border ${isSelected ? "bg-[#FDFCFB]/20 border-white/30 text-[#FDFCFB]" : "bg-[#E8E6E1] border-[#1A1A1A]/10 text-[#1A1A1A]"}`}>{template.customization.allowTyping || template.customization.allowDraw ? "VẼ & THÊM CHỮ" : "KHUNG CỔ ĐIỂN"}</span></div></div></div>
                                {isSelected && <div className="w-7 h-7 bg-[#FDFCFB] text-[#1A1A1A] flex items-center justify-center flex-shrink-0 rounded-xs shadow-xs">✓</div>}
                            </button>;
                        })}
                    </div>
                    <div className="lg:col-span-7 flex flex-col items-center justify-center">{selectedTemplate && <div className="w-full max-w-md bg-[#F4F2EE] border border-[#1A1A1A]/20 p-6 shadow-xl flex flex-col items-center rounded-xs"><span className="text-[11px] font-mono tracking-[0.2em] uppercase font-bold text-[#1A1A1A] mb-3">✦ BẢN XEM TRƯỚC THEO TỈ LỆ KHUNG</span><TemplatePreview session={session} template={selectedTemplate} />{(selectedTemplate.customization.allowTyping || selectedTemplate.customization.allowDraw) && <div className="mt-4 text-center text-[11px] font-mono text-[#1A1A1A] bg-[#E8E6E1] px-4 py-1.5 border border-[#1A1A1A]/15 font-medium rounded-xs">✨ Mẫu này cho phép vẽ tay & viết câu chúc cá nhân ở bước kế tiếp.</div>}</div>}</div>
                </div>
            )}
            <div className="w-full max-w-6xl mx-auto border-t border-[#1A1A1A]/10 pt-5 flex justify-between items-center"><button onClick={onBackToShots} className="px-6 py-3.5 border border-[#1A1A1A]/30 hover:border-[#1A1A1A] text-xs font-bold tracking-[0.2em] uppercase flex items-center gap-2 transition-colors cursor-pointer">← QUAY LẠI</button><button onClick={onContinue} disabled={!selectedTemplate || busy} className="px-10 py-4 bg-[#1A1A1A] text-[#FDFCFB] hover:bg-[#333333] text-xs font-bold tracking-[0.25em] uppercase flex items-center gap-3 transition-colors shadow-md cursor-pointer rounded-xs disabled:bg-[#E5E3DD] disabled:text-[#8C8880]">TIẾP TỤC →</button></div>
        </div>
    );
}

function CustomizeScreen({ session, template, customText, setCustomText, drawStrokes, setDrawStrokes, onBackToTemplate, onDone, busy }: { session: MomentAIGuestSession; template: MomentAITemplate; customText: string; setCustomText: (value: string) => void; drawStrokes: Array<Array<[number, number]>>; setDrawStrokes: (value: Array<Array<[number, number]>>) => void; onBackToTemplate: () => void; onDone: (drawDataUrl?: string) => void; busy: boolean }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [activeTab, setActiveTab] = useState<"text" | "draw">(template.customization.allowTyping ? "text" : "draw");
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentStroke, setCurrentStroke] = useState<Array<[number, number]>>([]);

    const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (activeTab !== "draw") return;
        const point = getCanvasPoint(event.currentTarget, event.clientX, event.clientY);
        setCurrentStroke([point]);
        setIsDrawing(true);
    };
    const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawing || activeTab !== "draw") return;
        const point = getCanvasPoint(event.currentTarget, event.clientX, event.clientY);
        setCurrentStroke((points) => [...points, point]);
    };
    const stopDrawing = () => {
        if (currentStroke.length > 0) setDrawStrokes([...drawStrokes, currentStroke]);
        setCurrentStroke([]);
        setIsDrawing(false);
    };

    return (
        <div className="w-full h-screen flex flex-col justify-between p-6 sm:p-8 bg-[#FDFCFB] text-[#1A1A1A] select-none overflow-y-auto">
            <div className="w-full max-w-6xl mx-auto flex flex-col items-center text-center"><h2 className="text-3xl sm:text-5xl font-serif tracking-tight text-[#1A1A1A]">THÊM CHỮ & NÉT VẼ</h2><p className="text-xs sm:text-sm opacity-70 mt-1 font-sans">Trang trí thêm câu chúc hoặc nét vẽ cá nhân lên khung ảnh của bạn.</p></div>
            <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 my-auto py-4 items-center">
                <div className="lg:col-span-6 flex flex-col gap-4">
                    <div className="flex border-b border-[#1A1A1A]/15 pb-2 gap-2">{template.customization.allowTyping && <button onClick={() => setActiveTab("text")} className={`px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] border ${activeTab === "text" ? "bg-[#1A1A1A] text-[#FDFCFB]" : "bg-[#F4F2EE]"}`}>GÕ CHỮ</button>}{template.customization.allowDraw && <button onClick={() => setActiveTab("draw")} className={`px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] border ${activeTab === "draw" ? "bg-[#1A1A1A] text-[#FDFCFB]" : "bg-[#F4F2EE]"}`}>VẼ TAY</button>}</div>
                    {activeTab === "text" && template.customization.allowTyping && <div className="bg-[#F4F2EE] border border-[#1A1A1A]/15 p-5 flex flex-col gap-4"><label className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A]">NHẬP LỜI CHÚC / CÂU TẶNG:</label><input type="text" value={customText} onChange={(event) => setCustomText(event.target.value.slice(0, template.customization.maxLength ?? 40))} placeholder={template.customization.textPlaceholder || "Gõ câu chúc ngắn ở đây..."} className="w-full px-4 py-3 bg-[#FDFCFB] border border-[#1A1A1A]/20 text-sm font-sans focus:outline-none focus:border-[#1A1A1A]" /><VirtualKeyboard value={customText} onChange={(value) => setCustomText(value.slice(0, template.customization.maxLength ?? 40))} /></div>}
                    {activeTab === "draw" && template.customization.allowDraw && <div className="bg-[#F4F2EE] border border-[#1A1A1A]/15 p-4"><div className="flex items-center justify-between mb-3"><span className="text-[10px] font-bold uppercase tracking-[0.2em]">VẼ TRỰC TIẾP LÊN KHUNG</span><button onClick={() => setDrawStrokes([])} className="px-3 py-1.5 text-[10px] font-bold uppercase border border-[#1A1A1A]/20">XOÁ</button></div><canvas ref={canvasRef} width={600} height={400} onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={stopDrawing} onPointerLeave={stopDrawing} className="w-full h-64 bg-[#FDFCFB] border border-[#1A1A1A]/20 touch-none" /><p className="mt-2 text-[10px] font-mono opacity-60">Stroke data: {drawStrokes.length} nét</p></div>}
                </div>
                <div className="lg:col-span-6"><TemplatePreview session={session} template={template} customText={customText} drawStrokes={[...drawStrokes, currentStroke].filter((stroke) => stroke.length > 0)} /></div>
            </div>
            <div className="w-full max-w-6xl mx-auto border-t border-[#1A1A1A]/10 pt-5 flex justify-between"><button onClick={onBackToTemplate} className="px-6 py-3.5 border border-[#1A1A1A]/30 text-xs font-bold tracking-[0.2em] uppercase">← QUAY LẠI</button><button onClick={() => onDone(canvasRef.current?.toDataURL("image/png"))} disabled={busy} className="px-10 py-4 bg-[#1A1A1A] text-[#FDFCFB] text-xs font-bold tracking-[0.25em] uppercase disabled:bg-[#E5E3DD] disabled:text-[#8C8880]">HOÀN TẤT →</button></div>
        </div>
    );
}

function PrintQRScreen({ session, finalPreviewDataUrl, qrDataUrl, printStatus, onFinishSession }: { session: MomentAIGuestSession; finalPreviewDataUrl: string | null; qrDataUrl: string | null; printStatus: string; onFinishSession: () => void }) {
    const [secondsRemaining, setSecondsRemaining] = useState(120);
    const downloadUrl = session.qr?.url || `${cloudBaseUrl}/${encodeURIComponent(session.sessionId)}`;

    useEffect(() => {
        const timer = window.setInterval(() => {
            setSecondsRemaining((prev) => {
                if (prev <= 1) {
                    window.clearInterval(timer);
                    void onFinishSession();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => window.clearInterval(timer);
    }, [onFinishSession]);

    return (
        <div className="w-full h-screen flex flex-col justify-between p-6 sm:p-8 bg-[#FDFCFB] text-[#1A1A1A] select-none overflow-y-auto">
            <div className="w-full max-w-6xl mx-auto flex flex-col items-center text-center"><h2 className="text-3xl sm:text-5xl font-serif tracking-tight text-[#1A1A1A]">ẢNH CỦA BẠN</h2><p className="text-xs sm:text-sm opacity-70 mt-1 font-sans">Quét mã QR để lưu ảnh số về điện thoại & nhận bản in tại photobooth.</p></div>
            <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 my-auto py-4 items-center">
                <div className="md:col-span-6 flex flex-col gap-6"><div className="bg-[#F4F2EE] p-6 border border-[#1A1A1A]/15 flex flex-col items-center text-center shadow-xs rounded-xs"><div className="p-3 bg-[#FDFCFB] border border-[#1A1A1A]/15 mb-4 shadow-xs rounded-2xs">{qrDataUrl ? <img src={qrDataUrl} alt="QR cloud download" className="size-[170px]" /> : <MomentAIQRCode value={downloadUrl} size={170} />}</div><h3 className="font-serif italic text-xl font-bold text-[#1A1A1A] mb-1">Quét để tải ảnh số</h3><span className="text-[10px] font-mono opacity-70 font-medium">Ghi lại khoảnh khắc ngay về điện thoại</span></div><div className="bg-[#F4F2EE] p-5 border border-[#1A1A1A]/15 flex items-center justify-between rounded-xs"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-[#1A1A1A] text-[#FDFCFB] flex items-center justify-center flex-shrink-0 rounded-2xs">🖨</div><div><span className="block text-[10px] font-mono uppercase tracking-widest opacity-60">Trạng thái máy in</span><span className="font-serif italic text-base font-bold text-[#1A1A1A]">{printStatus}</span></div></div></div><div className="flex items-center justify-between px-4 py-3 bg-[#E8E6E1] border border-[#1A1A1A]/10 text-xs font-mono rounded-xs"><span>TỰ ĐỘNG RESET SAU:</span><span className="font-bold text-base text-[#1A1A1A]">{formatTimer(secondsRemaining)}</span></div></div>
                <div className="md:col-span-6 flex flex-col items-center"><div className="w-full max-w-xs aspect-[2/3] bg-[#F4F2EE] border border-[#1A1A1A]/20 p-3 shadow-xl overflow-hidden flex items-center justify-center rounded-xs">{finalPreviewDataUrl ? <img src={finalPreviewDataUrl} alt="Final Print Composition" className="w-full h-full object-contain shadow-xs" /> : <div className="text-[10px] font-mono opacity-50">FINAL PHOTO PREVIEW</div>}</div></div>
            </div>
            <div className="w-full max-w-6xl mx-auto border-t border-[#1A1A1A]/10 pt-4 flex justify-center"><button onClick={onFinishSession} className="w-full sm:w-[320px] h-[52px] bg-[#1A1A1A] text-[#FDFCFB] hover:bg-[#333333] font-bold text-xs tracking-[0.25em] uppercase border border-[#1A1A1A] flex items-center justify-center gap-3 transition-colors shadow-md cursor-pointer">HOÀN THÀNH ✓</button></div>
        </div>
    );
}

function VirtualKeyboard({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    const rows = [["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"], ["A", "S", "D", "F", "G", "H", "J", "K", "L"], ["Z", "X", "C", "V", "B", "N", "M"]];
    return <div className="flex flex-col gap-1.5 pt-2"><span className="text-[9px] font-mono opacity-50 uppercase tracking-widest">BÀN PHÍM ẢO CẢM ỨNG:</span>{rows.map((row, index) => <div key={index} className="flex justify-center gap-1">{row.map((char) => <button type="button" key={char} onClick={() => onChange(value + char)} className="w-8 h-9 sm:w-10 sm:h-10 bg-[#FDFCFB] border border-[#1A1A1A]/20 text-xs font-bold hover:bg-[#1A1A1A] hover:text-[#FDFCFB] transition-colors cursor-pointer">{char}</button>)}</div>)}<div className="flex justify-center gap-2 mt-1"><button type="button" onClick={() => onChange(value + " ")} className="px-10 h-9 bg-[#FDFCFB] border border-[#1A1A1A]/20 text-xs font-bold">SPACE</button><button type="button" onClick={() => onChange(value.slice(0, -1))} className="px-4 h-9 bg-[#FDFCFB] border border-[#1A1A1A]/20 text-xs font-bold">⌫</button></div></div>;
}

function CanonViewfinderHUD({ isCapturing }: { isCapturing: boolean }) {
    return <div className="absolute inset-0 pointer-events-none text-[#FDFCFB]/80"><div className="absolute inset-6 border border-white/20" /><div className="absolute left-8 top-8 font-mono text-xs uppercase tracking-[0.2em] text-[#E6C687]">Canon EOS 6D simulation • Live View mock</div><div className="absolute right-8 top-8 font-mono text-xs uppercase tracking-[0.2em]">{isCapturing ? "SAVING" : "READY"}</div></div>;
}

function MomentAIQRCode({ value, size }: { value: string; size: number }) {
    const cells = 21;
    const cellSize = size / cells;
    const hash = Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const modules: ReactNode[] = [];
    const isFinder = (row: number, col: number) => (row < 7 && col < 7) || (row < 7 && col >= cells - 7) || (row >= cells - 7 && col < 7);
    const isFinderInk = (row: number, col: number) => {
        const localRow = row < 7 ? row : row - (cells - 7);
        const localCol = col < 7 ? col : col - (cells - 7);
        return localRow === 0 || localRow === 6 || localCol === 0 || localCol === 6 || (localRow >= 2 && localRow <= 4 && localCol >= 2 && localCol <= 4);
    };
    for (let row = 0; row < cells; row += 1) for (let col = 0; col < cells; col += 1) {
        const filled = isFinder(row, col) ? isFinderInk(row, col) : ((row * 17 + col * 31 + hash) % 4 !== 0);
        if (filled) modules.push(<rect key={`${row}-${col}`} x={col * cellSize} y={row * cellSize} width={cellSize - 0.75} height={cellSize - 0.75} rx={cellSize * 0.18} fill="#1A1A1A" />);
    }
    return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"><title>MomentAI cloud download QR</title><rect width={size} height={size} fill="#ffffff" />{modules}</svg>;
}

function TemplateThumb({ template }: { template: MomentAITemplate }) {
    return <div className="h-full w-full" style={{ background: template.assets.background }}><div className="grid h-full place-items-center font-serif text-xs font-bold opacity-60">{template.name.slice(0, 2)}</div></div>;
}

function TemplatePreview({ session, template, customText, drawStrokes = [] }: { session: MomentAIGuestSession; template: MomentAITemplate; customText?: string; drawStrokes?: Array<Array<[number, number]>> }) {
    return <div className="relative aspect-[2/3] w-full max-w-sm overflow-hidden border border-[#1A1A1A]/25 p-4 shadow-2xl" style={{ backgroundColor: template.assets.background }}>{template.slots.map((slot) => { const photo = session.photos.find((item) => item.shotIndex === slot.slotIndex); return <div key={slot.slotIndex} className="absolute overflow-hidden border border-[#1A1A1A]/15 bg-[#E8E6E1]" style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.width}%`, height: `${slot.height}%` }}>{photo?.dataUrl ? <img alt={`slot ${slot.slotIndex}`} src={photo.dataUrl} className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-xs font-bold opacity-40">P{slot.slotIndex}</span>}</div>; })}<div className="absolute inset-x-0 bottom-8 text-center font-serif text-xl font-bold" style={{ color: template.assets.textColor }}>PHỐ CỔ HỘI AN</div>{customText && <div className="absolute inset-x-0 bottom-16 text-center text-sm font-bold" style={{ color: template.assets.textColor }}>&quot;{customText}&quot;</div>}<svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 360 540">{drawStrokes.map((stroke, index) => <polyline key={index} points={stroke.map(([x, y]) => `${x},${y}`).join(" ")} fill="none" stroke="#1A1A1A" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />)}</svg></div>;
}

function Recovery({ title, detail }: { title: string; detail: string }) {
    return <div className="mx-auto max-w-2xl border border-red-900/20 bg-red-50 p-8 text-center"><h2 className="font-serif text-4xl font-bold">{title}</h2><p className="mt-3 text-sm opacity-70">{detail}</p></div>;
}

function renderFinalCompositionPreview(session: MomentAIGuestSession): string | null {
    const template = session.selectedTemplate;
    if (!template) return null;
    const canvas = template.canvas;
    const textValue = session.customization.text[0]?.value ?? "";
    const photoLayers = template.slots.map((slot) => {
        const photo = session.photos.find((item) => item.shotIndex === slot.slotIndex);
        const x = (slot.x / 100) * canvas.width;
        const y = (slot.y / 100) * canvas.height;
        const width = (slot.width / 100) * canvas.width;
        const height = (slot.height / 100) * canvas.height;
        if (!photo?.dataUrl) return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#E8E6E1" stroke="#1A1A1A" stroke-opacity="0.18"/>`;
        return `<image href="${escapeXml(photo.dataUrl)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="${escapeXml(template.assets.overlayColor)}" stroke-width="6" stroke-opacity="0.65"/>`;
    }).join("");
    const drawingLayers = session.customization.drawing.map((stroke) => `<polyline points="${stroke.points.map(([x, y]) => `${x * canvas.width / 360},${y * canvas.height / 540}`).join(" ")}" fill="none" stroke="${escapeXml(stroke.color)}" stroke-width="${stroke.width * 2}" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas.width} ${canvas.height}"><rect width="${canvas.width}" height="${canvas.height}" fill="${escapeXml(template.assets.background)}"/>${photoLayers}<text x="${canvas.width / 2}" y="${canvas.height - 128}" text-anchor="middle" font-size="52" font-family="serif" font-style="italic" font-weight="700" fill="${escapeXml(template.assets.textColor)}">PHỐ CỔ HỘI AN</text>${textValue ? `<text x="${canvas.width / 2}" y="${canvas.height - 78}" text-anchor="middle" font-size="34" font-family="sans-serif" font-weight="700" fill="${escapeXml(template.assets.textColor)}">&quot;${escapeXml(textValue)}&quot;</text>` : ""}${drawingLayers}</svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function getCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): [number, number] {
    const rect = canvas.getBoundingClientRect();
    return [((clientX - rect.left) / rect.width) * 360, ((clientY - rect.top) / rect.height) * 540];
}

function formatTimer(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? `0${m}` : m}:${s < 10 ? `0${s}` : s}`;
}

function escapeXml(value: string): string {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function makeSimulatedPhoto(index: number): string {
    const color = ["#C85A32", "#E6C687", "#8DAA91", "#A899C4", "#8A9FB4", "#1A1A1A"][index % 6];
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 800;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Browser canvas is required for simulated JPEG capture.");
    context.fillStyle = color;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(253,252,251,0.9)";
    context.beginPath();
    context.arc(600, 310, 130, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(600, 800, 360, 210, 0, Math.PI, Math.PI * 2);
    context.fill();
    context.font = "bold 42px monospace";
    context.fillStyle = "#ffffff";
    context.fillText(`CANON EOS 6D SIM • SHOT ${index}`, 60, 740);
    return canvas.toDataURL("image/jpeg", 0.92);
}
