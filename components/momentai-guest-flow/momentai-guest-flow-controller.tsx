"use client";

import { useEffect, useMemo, useRef, useState } from 'react';

import { AttractScreen } from './components/Guest/AttractScreen';
import { SelectProductScreen } from './components/Guest/SelectProductScreen';
import { AutoCaptureScreen } from './components/Guest/AutoCaptureScreen';
import { ProcessingPhotosScreen } from './components/Guest/ProcessingPhotosScreen';
import { SelectFrameScreen } from './components/Guest/SelectFrameScreen';
import { DrawScreen } from './components/Guest/DrawScreen';
import { PrintQRScreen } from './components/Guest/PrintQRScreen';
import { DoneScreen } from './components/Guest/DoneScreen';
import { compositionEngine } from './services/compositionEngine';
import { isStripTemplate } from './components/UI/frame-previews/FramePreviewCard';
import { cameraService } from './services/cameraService';
import { LocalFrameRegistry } from '@/services/frame/local-frame-registry';
import type { FrameDefinition } from '@/services/frame-import/frame-import.types';
import type { CameraSettings, CaptureConfig, EventConfig, FrameTemplate, LayoutType, PhotoItem, PrinterSettings, SessionData, GuestScreenState } from './types';
import type { MomentAICaptureFormat, MomentAICaptureFormatId, MomentAIGuestSession, MomentAITemplate } from '@/types/momentai-guest-session';
import type { GuestProductConfig } from '@/types/guest-product';
import { resolveTargetProduct, isStripProduct as isStripProductId, canonicalLayoutType, canonicalPreferredPaper, canonicalRenderMode, getCanonicalSlots, normalizeSlotToUnit } from '@/services/frame/resolveTargetProduct';
import { resolvePhysicalPrintPlan } from '@/services/printer/physical-print-plan';

const EVENT_CONFIG: EventConfig = {
  eventName: 'PHỐ CỔ HỘI AN',
  eventDate: '2026-08-11',
  hostName: 'MomentAI CameraOS Platform',
  primaryColor: '#f59e0b',
  accentColor: '#f43f5e',
  theme: 'light',
  customTagline: 'TIỆM ẢNH DI SẢN',
};

const CAPTURE_CONFIG: CaptureConfig = {
  availableCounts: [2, 3, 4, 6],
  defaultCount: 4,
  countdownSeconds: 8,
  intervalSeconds: 2,
  allowRetake: false,
};

const PRINTER_SETTINGS: PrinterSettings = {
  connected: true,
  model: 'CameraOS Print Queue',
  currentPaper: '4x6',
  paperRemaining: 100,
  paperTotal: 100,
  autoPrint: false,
  copiesDefault: 1,
  status: 'READY',
};

const LOCAL_CAPTURE_FORMATS: readonly MomentAICaptureFormat[] = [
  { id: 'format_1shot', label: '1 Shot', shotCount: 1, slotCount: 1, layoutType: 'single' },
  { id: 'format_2shot', label: '2 Shots', shotCount: 2, slotCount: 2, layoutType: 'vertical_2' },
  { id: 'format_4shot', label: '4 Shots', shotCount: 4, slotCount: 4, layoutType: 'vertical_4' },
  { id: 'format_6shot', label: '6 Shots', shotCount: 6, slotCount: 6, layoutType: '2col_3row' },
];

const formatIdByShotCount: Record<number, MomentAICaptureFormatId> = {
  1: 'format_1shot',
  2: 'format_2shot',
  3: 'format_1shot',
  4: 'format_4shot',
  6: 'format_6shot',
};

let localSessionSequence = 0;

interface WindowMiniResult<T> {
  ok: boolean;
  value?: T;
  error?: unknown;
}

interface GuestReadinessSnapshot {
  status: 'READY' | 'DEGRADED' | 'BLOCKED';
  activeEvent: { eventId: string; enabledShotFormats: readonly MomentAICaptureFormatId[] } | null;
  reasons: string[];
}

interface WindowMiniGuestSessionBridge {
  getReadiness?(): Promise<unknown>;
  create(eventId?: string): Promise<unknown>;
  listCaptureFormats(): Promise<unknown>;
  selectFormat(sessionId: string, formatId: string): Promise<unknown>;
  addPhoto(sessionId: string, photo: unknown): Promise<unknown>;
  listTemplates(eventId: string, captureFormatId: string): Promise<unknown>;
  selectTemplate(sessionId: string, templateId: string): Promise<unknown>;
  saveCustomization(sessionId: string, customization: unknown): Promise<unknown>;
  compose(sessionId: string): Promise<unknown>;
  requestPrint(sessionId: string, copies: number): Promise<unknown>;
  complete(sessionId: string): Promise<unknown>;
}

export function MomentAIGuestFlowController() {
  const [screenState, setScreenState] = useState<GuestScreenState>('G01_START');
  const [cameraSettings, setCameraSettings] = useState<CameraSettings>(cameraService.getSettings());
  const [captureFormats, setCaptureFormats] = useState<readonly MomentAICaptureFormat[]>([]);
  const [readiness, setReadiness] = useState<GuestReadinessSnapshot>(createLocalReadiness());
  const [backendSession, setBackendSession] = useState<MomentAIGuestSession | null>(null);
  const [currentSession, setCurrentSession] = useState<SessionData | null>(null);
  const [frameTemplates, setFrameTemplates] = useState<FrameTemplate[]>([]);
  const [importedFrameDefinitions, setImportedFrameDefinitions] = useState<readonly FrameDefinition[]>([]);
  const [selectedDrawDataUrl, setSelectedDrawDataUrl] = useState<string>('');
  const navigationLockedRef = useRef(false);

  useEffect(() => {
    const updateImportedFrames = () => {
      setImportedFrameDefinitions(LocalFrameRegistry.getPublishedDefinitions());
    };
    void LocalFrameRegistry.refreshFromAdminDb().then(updateImportedFrames);
    updateImportedFrames();
    return LocalFrameRegistry.subscribe(updateImportedFrames);
  }, []);

  useEffect(() => {
    void loadGuestReadiness()
      .then((snapshot) => {
        setReadiness(snapshot);
        return listGuestCaptureFormats(snapshot);
      })
      .then(setCaptureFormats)
      .catch(() => {
        const fallback = isLocalGuestFallbackAllowed() ? createLocalReadiness() : createBlockedReadiness('READINESS_UNAVAILABLE');
        setReadiness(fallback);
        setCaptureFormats(isLocalGuestFallbackAllowed() ? getFormatsForReadiness(fallback) : []);
      });
  }, []);
  
  const refreshCameraSettings = () => setCameraSettings(cameraService.getSettings());

  const runNavigation = (action: () => void | Promise<void>) => {
    if (navigationLockedRef.current) return;
    navigationLockedRef.current = true;
    void Promise.resolve(action()).finally(() => {
      window.setTimeout(() => {
        navigationLockedRef.current = false;
      }, 900);
    });
  };

  async function api(action: string, body: Record<string, unknown> = {}) {
    const session = await dispatchGuestSessionAction(action, body, backendSession);
    setBackendSession(session);
    return session;
  }

  const startNewSession = async () => {
    const latestReadiness = await loadGuestReadiness().catch(() => readiness);
    setReadiness(latestReadiness);
    if (latestReadiness.status === 'BLOCKED' || !latestReadiness.activeEvent) return;
    const nextBackendSession = await api('start-session', { eventId: latestReadiness.activeEvent.eventId });
    const nextSession: SessionData = {
      sessionId: nextBackendSession.sessionId,
      eventId: nextBackendSession.eventId,
      createdAt: new Date(nextBackendSession.createdAt).toLocaleTimeString('vi-VN'),
      captureCount: CAPTURE_CONFIG.defaultCount,
      photos: [],
      slotAssignments: [],
      printStatus: 'idle',
      copiesPrinted: 0,
      selectedPrintQuantity: 1,
    };
    setSelectedDrawDataUrl('');
    setCurrentSession(nextSession);
    setScreenState('G02_SELECT_PRODUCT');
  };

  const handleSelectProduct = async (product: GuestProductConfig) => {
    if (!backendSession || !currentSession) return;
    const count = product.requiredShots;
    const backendFormat = captureFormats.find((format) => format.shotCount === count);
    const formatId = backendFormat?.id ?? formatIdByShotCount[count] ?? 'format_4shot';
    const nextBackendSession = await api('select-format', { sessionId: backendSession.sessionId, formatId });
    setCurrentSession({
      ...currentSession,
      product,
      captureCount: count,
      selectedPrintQuantity: product.printSheets,
      photos: [],
      slotAssignments: [],
    });
    setBackendSession(nextBackendSession);
    refreshCameraSettings();
    setScreenState('G03_CAPTURE');
  };

  const handlePhotoCaptured = (photo: PhotoItem) => {
    setCurrentSession((prev) => prev ? { ...prev, photos: [...prev.photos, photo] } : prev);
  };

  const handleCaptureCompleted = async (capturedPhotos: PhotoItem[]) => {
    if (!backendSession || !currentSession) return;
    console.log('[GuestFlowController] handleCaptureCompleted with photos:', capturedPhotos.map((p) => ({
      index: p.index,
      dataUrlLength: p.dataUrl?.length,
      preview: p.dataUrl?.slice(0, 40),
    })));

    const sessionWithPhotos: SessionData = {
      ...currentSession,
      photos: capturedPhotos,
      slotAssignments: capturedPhotos,
    };
    setCurrentSession(sessionWithPhotos);
    setScreenState('G03B_PROCESSING_PHOTOS');
    let updatedBackend = backendSession.captureFormat
      ? backendSession
      : await api('select-format', {
        sessionId: backendSession.sessionId,
        formatId: formatIdByShotCount[currentSession.captureCount] ?? 'format_4shot',
      });
    for (const photo of capturedPhotos) {
      updatedBackend = await api('add-photo', {
        sessionId: updatedBackend.sessionId,
        photo: {
          photoId: sanitizePhotoId(photo.id),
          shotIndex: photo.index,
          originalPath: `originals/capture_${String(photo.index).padStart(2, '0')}.jpg`,
          dataUrl: photo.dataUrl,
        },
      });
    }
    if (!updatedBackend.captureFormat) return;
    const templates = await listGuestTemplates(updatedBackend.eventId, updatedBackend.captureFormat.id);
    await LocalFrameRegistry.refreshFromAdminDb(updatedBackend.eventId).catch(() => undefined);
    const latestImportedDefinitions = LocalFrameRegistry.getPublishedDefinitions();
    const isPremiumProduct = currentSession.product?.premium === true || currentSession.product?.id === 'PREMIUM_POSTCARD' || currentSession.product?.group === 'Premium';
    const targetShotCount = currentSession.product?.requiredShots || updatedBackend.captureFormat?.shotCount || 4;
    const currentEventId = updatedBackend.eventId || 'event_hoi_an_heritage';
    const importedTemplates = latestImportedDefinitions
      .filter((definition) => {
        const matchesEvent = !definition.eventId || definition.eventId === currentEventId;
        if (!matchesEvent) return false;
        if (isPremiumProduct) {
          return definition.targetProduct === 'PREMIUM_POSTCARD' || definition.shotCount === 1 || definition.slots?.length === 1;
        }
        if (definition.targetProduct) {
          return definition.targetProduct === currentSession.product?.id;
        }
        return definition.shotCount === targetShotCount;
      })
      .map(mapImportedFrameDefinitionToFrameTemplate);
    const backendTemplates = templates.map(mapTemplateToFrameTemplate);
    const allAvailableTemplates: FrameTemplate[] = importedTemplates.length > 0 ? importedTemplates : backendTemplates;
    const uniqueTemplates = Array.from(new Map(allAvailableTemplates.map((t) => [t.id, t])).values());
    setFrameTemplates(uniqueTemplates);
    setBackendSession(updatedBackend);

    // Trigger Phase A background upload (non-blocking) upon entering frame selection
    if (typeof window !== 'undefined') {
      const cloudBridge = (window as unknown as { momentai?: { guest?: { cloud?: { initSession?: (sid: string, meta?: unknown) => Promise<unknown>; triggerPhaseAUpload?: (sid: string) => Promise<unknown> } } } }).momentai?.guest?.cloud;
      if (cloudBridge?.initSession) {
        void cloudBridge.initSession(updatedBackend.sessionId, {
          productType: currentSession.product?.id,
          requiredShots: currentSession.captureCount,
        });
      }
      if (cloudBridge?.triggerPhaseAUpload) {
        void cloudBridge.triggerPhaseAUpload(updatedBackend.sessionId);
      }
    }

    setScreenState('G04_SELECT_FRAME');
  };

  const handleSelectFrame = async (frame: FrameTemplate, selectedPhotoIndex?: number) => {
    if (!backendSession || !currentSession || !backendSession.captureFormat) return;
    let backendTemplateId = frame.id;
    if (frame.assets.overlay) {
      const templates = await listGuestTemplates(backendSession.eventId, backendSession.captureFormat.id);
      backendTemplateId = templates[0]?.templateId ?? frame.id;
    }
    const nextBackendSession = await api('select-template', { sessionId: backendSession.sessionId, templateId: backendTemplateId });
    
    const isPremium = currentSession.product?.premium === true;
    const photoIdx = selectedPhotoIndex ?? 0;
    const assignments = isPremium && currentSession.photos.length > 0
      ? [currentSession.photos[photoIdx] || currentSession.photos[0]]
      : currentSession.photos.slice(0, frame.layout.slotCount);

    const updatedSession: SessionData = {
      ...currentSession,
      selectedFrame: frame,
      selectedPhotoIndex: photoIdx,
      slotAssignments: assignments,
    };
    setCurrentSession(updatedSession);
    setBackendSession(nextBackendSession);

    if (isPremium) {
      setScreenState('G05_PREMIUM_CUSTOMIZE');
      return;
    }
    await renderAndShowResult(updatedSession, nextBackendSession, '');
  };

  const handleConfirmDraw = async (drawDataUrl: string) => {
    if (!backendSession || !currentSession || !currentSession.selectedFrame) return;
    setSelectedDrawDataUrl(drawDataUrl);
    const nextBackendSession = await api('save-customization', {
      sessionId: backendSession.sessionId,
      customization: { text: [], drawing: [] },
    });
    await renderAndShowResult(currentSession, nextBackendSession, drawDataUrl);
  };

  const renderAndShowResult = async (session: SessionData, backend: MomentAIGuestSession, drawDataUrl: string) => {
    if (!session.selectedFrame) return;
    const isStrip = isStripTemplate(session.selectedFrame);
    const isLandscape = !isStrip && session.selectedFrame.orientation === 'landscape';
    const targetWidth = isStrip ? 5472 : isLandscape ? 16200 : 10944;
    const targetHeight = isStrip ? 16416 : isLandscape ? 10944 : 16200;

    const outputs = await compositionEngine.renderComposition(
      session.selectedFrame,
      session.slotAssignments,
      EVENT_CONFIG,
      undefined,
      drawDataUrl,
      targetWidth,
      targetHeight,
    );
    if (typeof window !== 'undefined' && (window as unknown as { momentai?: { guest?: { storage?: { saveOutput: (sid: string, type: string, file: unknown) => Promise<unknown> } } } }).momentai?.guest?.storage?.saveOutput) {
      try {
        await (window as unknown as { momentai: { guest: { storage: { saveOutput: (sid: string, type: string, file: unknown) => Promise<unknown> } } } }).momentai.guest.storage.saveOutput(backend.sessionId, 'share', {
          dataUrl: outputs.share,
          mimeType: 'image/jpeg',
        });
        await (window as unknown as { momentai: { guest: { storage: { saveOutput: (sid: string, type: string, file: unknown) => Promise<unknown> } } } }).momentai.guest.storage.saveOutput(backend.sessionId, 'master', {
          dataUrl: outputs.master,
          mimeType: 'image/png',
        });
        if (outputs.print) {
          await (window as unknown as { momentai: { guest: { storage: { saveOutput: (sid: string, type: string, file: unknown) => Promise<unknown> } } } }).momentai.guest.storage.saveOutput(backend.sessionId, 'print', {
            dataUrl: outputs.print,
            mimeType: 'image/jpeg',
          });
        }
      } catch (e) {
        console.warn('Storage saveOutput error:', e);
      }
    }

    // Trigger background video composition for the FINAL selected frame
    if (typeof window !== 'undefined' && (window as unknown as { momentai?: { guest?: { media?: { composeVideo: (sid: string, frame: unknown, opts: unknown) => Promise<unknown> } } } }).momentai?.guest?.media?.composeVideo) {
      try {
        void (window as unknown as { momentai: { guest: { media: { composeVideo: (sid: string, frame: unknown, opts: unknown) => Promise<unknown> } } } }).momentai.guest.media.composeVideo(
          backend.sessionId,
          session.selectedFrame,
          {
            drawDataUrl,
            targetWidth,
            targetHeight,
          }
        );
      } catch (e) {
        console.warn('Video compose trigger error:', e);
      }
    }

    // Early QR reservation: get tokenized session share URL
    let qrUrl = '';
    if (typeof window !== 'undefined') {
      const cloudBridge = (window as unknown as { momentai?: { guest?: { cloud?: { getPublicToken?: (sid: string) => Promise<{ ok?: boolean; value?: { publicToken?: string; landingUrl?: string }; publicToken?: string; landingUrl?: string }> } } } }).momentai?.guest?.cloud;
      const mediaBridge = (window as unknown as { momentai?: { guest?: { media?: { getPublicToken?: (sid: string) => Promise<{ ok?: boolean; value?: { publicToken?: string } }> } } } }).momentai?.guest?.media;
      
      if (cloudBridge?.getPublicToken) {
        try {
          const res = await cloudBridge.getPublicToken(backend.sessionId);
          const directUrl = res?.value?.landingUrl || res?.landingUrl;
          const token = res?.value?.publicToken || res?.publicToken;
          if (directUrl) {
            qrUrl = directUrl;
          } else if (token) {
            const baseUrl = (process.env.MOMENTAI_LANDING_BASE_URL || process.env.NEXT_PUBLIC_LANDING_BASE_URL || process.env.MOMENTAI_LANDING_DOMAIN || 'http://localhost:5174').replace(/\/+$/, '');
            qrUrl = `${baseUrl}/s/${token}`;
          }
        } catch {}
      }
      if (!qrUrl && mediaBridge?.getPublicToken) {
        try {
          const tokenRes = await mediaBridge.getPublicToken(backend.sessionId);
          const token = tokenRes?.value?.publicToken;
          if (token) {
            const baseUrl = (process.env.MOMENTAI_LANDING_BASE_URL || process.env.NEXT_PUBLIC_LANDING_BASE_URL || process.env.MOMENTAI_LANDING_DOMAIN || 'http://localhost:5174').replace(/\/+$/, '');
            qrUrl = `${baseUrl}/s/${token}`;
          }
        } catch {}
      }
    }

    const composedBackend = await api('compose', { sessionId: backend.sessionId });
    const qrData = qrUrl ? { status: 'ready' as const, url: qrUrl } : mapBackendQr(composedBackend);

    setCurrentSession({ ...session, drawDataUrl, outputs, qr: qrData, printStatus: 'idle' });
    setBackendSession(composedBackend);
    setScreenState('G06_RESULT');
  };

  const handleConfirmPrint = async () => {
    if (!backendSession || !currentSession) return;
    const productType =
      currentSession.product?.id ||
      (currentSession.selectedFrame ? resolveTargetProduct(currentSession.selectedFrame) : null) ||
      'STRIP_2';
    const isStrip = isStripProductId(productType as any);
    const requestedUnits = isStrip ? 2 : (currentSession.product?.printSheets || 1);
    const plan = resolvePhysicalPrintPlan({
      product: productType,
      requestedQuantity: requestedUnits,
      isLandscape: currentSession.selectedFrame?.orientation === 'landscape',
      sessionId: backendSession.sessionId,
    });
    const printCopies = plan.sheets;

    setCurrentSession({ ...currentSession, printStatus: 'sending' });
    try {
      await api('request-print', { sessionId: backendSession.sessionId, copies: printCopies });
      setCurrentSession((prev) => prev ? { ...prev, printStatus: 'queued' } : prev);
      setScreenState('G08_DONE');
    } catch {
      setCurrentSession((prev) => prev ? { ...prev, printStatus: 'failed' } : prev);
    }
  };

  const handleFinishSession = async () => {
    if (backendSession) await api('complete', { sessionId: backendSession.sessionId }).catch(() => undefined);
    setBackendSession(null);
    setCurrentSession(null);
    setFrameTemplates([]);
    setSelectedDrawDataUrl('');
    setScreenState('G01_START');
  };

  const resultSession = useMemo(() => {
    if (!currentSession || !backendSession) return currentSession;
    return {
      ...currentSession,
      sessionId: backendSession.sessionId,
    };
  }, [backendSession, currentSession]);

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#1A1A1A] font-sans flex flex-col justify-between select-none touch-manipulation">
      <main className="flex-1 relative flex flex-col items-center justify-center overflow-hidden">
        {screenState === 'G01_START' && <AttractScreen eventConfig={EVENT_CONFIG} onStartSession={() => runNavigation(startNewSession)} readinessStatus={readiness.status} readinessReasons={readiness.reasons} />}
        {screenState === 'G02_SELECT_PRODUCT' && <SelectProductScreen defaultProductId={currentSession?.product?.id} onSelectProduct={(product) => runNavigation(() => handleSelectProduct(product))} onBackToStart={() => runNavigation(() => setScreenState('G01_START'))} />}
        {screenState === 'G03_CAPTURE' && currentSession && <AutoCaptureScreen session={currentSession} cameraSettings={cameraSettings} captureConfig={CAPTURE_CONFIG} onPhotoCaptured={handlePhotoCaptured} onCaptureCompleted={(photos) => { void handleCaptureCompleted(photos); }} />}
        {screenState === 'G03B_PROCESSING_PHOTOS' && currentSession && <ProcessingPhotosScreen photos={currentSession.photos} />}
        {screenState === 'G04_SELECT_FRAME' && currentSession && <SelectFrameScreen session={currentSession} customTemplates={frameTemplates} onSelectFrame={(frame, photoIdx) => runNavigation(() => handleSelectFrame(frame, photoIdx))} onBackToShots={() => runNavigation(() => setScreenState('G02_SELECT_PRODUCT'))} />}
        {(screenState === 'G05_PREMIUM_CUSTOMIZE' || screenState === 'G05_DRAW') && currentSession?.selectedFrame && <DrawScreen session={currentSession} template={currentSession.selectedFrame} onConfirmDraw={(drawDataUrl) => runNavigation(() => handleConfirmDraw(drawDataUrl))} onBackToTemplate={() => runNavigation(() => setScreenState('G04_SELECT_FRAME'))} />}
        {(screenState === 'G06_RESULT' || screenState === 'G07_PRINTING' || screenState === 'G07_PRINT_QR' || screenState === 'G08_PRINT_SUCCESS') && resultSession && <PrintQRScreen session={resultSession} printerSettings={PRINTER_SETTINGS} onConfirmPrint={() => runNavigation(handleConfirmPrint)} onFinishSession={() => runNavigation(handleFinishSession)} />}
        {screenState === 'G08_DONE' && <DoneScreen onAutoReset={() => runNavigation(handleFinishSession)} resetDelaySeconds={6} />}
      </main>
    </div>
  );
}

function normalizeSlotPercent(val: number): number {
  return val <= 1 && val > 0 ? val * 100 : val;
}

function generateFallbackSlots(count: number, isStrip: boolean) {
  if (count === 1) {
    return [{ id: 1, x: 5, y: 5, width: 90, height: 90 }];
  }
  if (count === 2) {
    return [
      { id: 1, x: 6, y: 5, width: 88, height: 42 },
      { id: 2, x: 6, y: 51, width: 88, height: 42 },
    ];
  }
  if (count === 4 && isStrip) {
    return [
      { id: 1, x: 6, y: 3.5, width: 88, height: 21 },
      { id: 2, x: 6, y: 26.5, width: 88, height: 21 },
      { id: 3, x: 6, y: 49.5, width: 88, height: 21 },
      { id: 4, x: 6, y: 72.5, width: 88, height: 21 },
    ];
  }
  if (count === 4) {
    return [
      { id: 1, x: 4, y: 4, width: 44, height: 43 },
      { id: 2, x: 52, y: 4, width: 44, height: 43 },
      { id: 3, x: 4, y: 51, width: 44, height: 43 },
      { id: 4, x: 52, y: 51, width: 44, height: 43 },
    ];
  }
  if (count === 6) {
    return [
      { id: 1, x: 4, y: 3, width: 44, height: 28 },
      { id: 2, x: 52, y: 3, width: 44, height: 28 },
      { id: 3, x: 4, y: 34, width: 44, height: 28 },
      { id: 4, x: 52, y: 34, width: 44, height: 28 },
      { id: 5, x: 4, y: 65, width: 44, height: 28 },
      { id: 6, x: 52, y: 65, width: 44, height: 28 },
    ];
  }
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    x: 5,
    y: Number((i * (90 / count) + 2).toFixed(2)),
    width: 90,
    height: Number((85 / count).toFixed(2)),
  }));
}

export function mapImportedFrameDefinitionToFrameTemplate(definition: FrameDefinition): FrameTemplate {
  const count = definition.shotCount === 8 ? 6 : definition.shotCount;

  // ── Canonical product resolution ─────────────────────────────────────────
  // Uses: persisted targetProduct → canvas aspect ratio → layout.type (legacy)
  // NEVER uses: slot positions, hasSecondColumn, slot width/height
  const resolvedProduct = resolveTargetProduct({
    targetProduct: definition.targetProduct,
    shotCount: count,
    outputWidth: definition.outputWidth,
    outputHeight: definition.outputHeight,
    layout: (definition as unknown as { layout?: { type?: string } }).layout,
    outputPaper: definition.outputPaper,
  });

  const isStrip = isStripProductId(resolvedProduct) || definition.targetProduct === 'STRIP_2' || definition.targetProduct === 'STRIP_4' || definition.outputPaper === '5x15';
  const targetProduct = resolvedProduct ?? (isStrip ? (count === 2 ? 'STRIP_2' : 'STRIP_4') : (count === 1 ? 'PREMIUM_POSTCARD' : count === 6 ? 'SHEET_6' : 'STRIP_4'));
  const layoutType = canonicalLayoutType(targetProduct);

  // ── Slot normalization (Canonical 0..1 range) ───────────────────────────
  const origH = definition.outputHeight || 2700;
  const origW = isStrip && (definition.outputWidth || 1800) >= origH * 0.45
    ? Math.round(origH / 3)
    : (definition.outputWidth || (isStrip ? 900 : 1800));

  const isLowRes = origH < 1800 || origW < 600;
  const outH = isLowRes ? 2700 : origH;
  const outW = isLowRes ? (isStrip ? 900 : 1800) : origW;

  const rawNormSlots = (definition.slots || []).map((slot, index) => {
    const unit = normalizeSlotToUnit(slot, origW, origH);
    return {
      id: slot.id || index + 1,
      x: unit.x,
      y: unit.y,
      width: unit.width,
      height: unit.height,
    };
  });

  // ── Orientation ──────────────────────────────────────────────────────────
  const isLandscape =
    !isStrip &&
    (definition.orientation === 'landscape' ||
      (definition.outputWidth && definition.outputHeight
        ? definition.outputWidth > definition.outputHeight
        : false));

  // Detect corrupted or dummy full-canvas slots (e.g. {x:0, y:0, w:1, h:1})
  const isFullCanvasSlot = rawNormSlots.length === 1 && rawNormSlots[0].width >= 0.95 && rawNormSlots[0].height >= 0.95 && (rawNormSlots[0].x <= 0.02 && rawNormSlots[0].y <= 0.02);
  const isOverlappingCorrupted = count > 1 && rawNormSlots.length > 1 && (
    rawNormSlots.every((s) => (
      Math.abs(s.x - rawNormSlots[0].x) < 0.005 &&
      Math.abs(s.y - rawNormSlots[0].y) < 0.005 &&
      Math.abs(s.width - rawNormSlots[0].width) < 0.005 &&
      Math.abs(s.height - rawNormSlots[0].height) < 0.005
    )) || (isStrip && rawNormSlots.some((s) => s.height >= 0.80))
  );

  const isCorrupted = isFullCanvasSlot || isOverlappingCorrupted || rawNormSlots.length !== count;

  const normSlots = isCorrupted
    ? getCanonicalSlots(resolvedProduct, isLandscape)
    : rawNormSlots;

  return {
    id: definition.id,
    name: definition.name,
    targetProduct,
    thumbnail: definition.thumbnailUrl || definition.assetUrl || '',
    category: getImportedFrameCategory(definition),
    eventId: definition.eventId,
    shotCount: count,
    allowTyping: true,
    allowDraw: definition.allowDraw ?? true,
    orientation: isLandscape ? 'landscape' : 'portrait',
    outputWidth: outW,
    outputHeight: outH,
    preferredPaper: canonicalPreferredPaper(resolvedProduct),
    supportedPapers: isStrip ? ['2x6-double', '4x6'] : ['4x6'],
    renderMode: canonicalRenderMode(resolvedProduct),
    layout: {
      type: layoutType,
      slotCount: normSlots.length,
    },
    slots: normSlots,
    assets: {
      background: '#FDFCFB',
      overlay: definition.assetUrl,
      overlayColor: 'transparent',
      textColor: '#1A1A1A',
      borderWidth: 0,
    },
    eventBranding: {
      text: '',
      subtext: '',
      showDate: true,
    },
  };
}


function getImportedFrameCategory(definition: FrameDefinition): string {
  const categorized = definition as FrameDefinition & { category?: string; eventCategory?: string; eventName?: string };
  return categorized.category || categorized.eventCategory || categorized.eventName || definition.layoutFamily || 'Khung đã upload';
}

function mapBackendQr(session: MomentAIGuestSession): SessionData['qr'] {
  if (!session.qr) return { status: 'unavailable' };
  if (session.qr.status === 'ready' && session.qr.url && !isUnsafeQrUrl(session.qr.url)) {
    return { status: 'ready', url: session.qr.url };
  }
  return { status: session.qr.status === 'failed' ? 'failed' : 'unavailable' };
}

function isUnsafeQrUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'file:' || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') return true;
    return !isLocalNetworkHost(parsed.hostname);
  } catch {
    return true;
  }
}

function isLocalNetworkHost(hostname: string) {
  return hostname.endsWith('.local') || /^10\./.test(hostname) || /^192\.168\./.test(hostname) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
}

function mapTemplateToFrameTemplate(template: MomentAITemplate): FrameTemplate {
  const width = template.canvas?.width || (template as unknown as { outputWidth?: number }).outputWidth || 1800;
  const height = template.canvas?.height || (template as unknown as { outputHeight?: number }).outputHeight || 2700;
  const isLandscape = template.printProfile?.orientation === 'landscape' || (template as unknown as { orientation?: string }).orientation === 'landscape' || width > height;

  return {
    id: template.templateId,
    name: template.name,
    thumbnail: '',
    category: template.captureFormatId === 'format_6shot' ? 'GRID' : template.captureFormatId === 'format_4shot' ? 'STRIP' : template.captureFormatId === 'format_2shot' ? '2 PHOTOS' : '1 PHOTO',
    shotCount: template.slots.length,
    allowTyping: false,
    allowDraw: template.customization.allowDraw,
    orientation: isLandscape ? 'landscape' : 'portrait',
    outputWidth: width,
    outputHeight: height,
    layout: {
      type: template.captureFormatId === 'format_6shot' ? '2x3' : template.captureFormatId === 'format_4shot' ? '1x4' : template.captureFormatId === 'format_2shot' ? '1x2' : '1x1',
      slotCount: template.slots.length,
    },
    slots: template.slots.map((slot) => ({
      id: slot.slotIndex,
      x: normalizeSlotPercent(slot.x),
      y: normalizeSlotPercent(slot.y),
      width: normalizeSlotPercent(slot.width),
      height: normalizeSlotPercent(slot.height),
    })),
    assets: {
      background: template.assets.background,
      overlay: template.assets.overlay,
      overlayColor: template.assets.overlayColor,
      textColor: template.assets.textColor,
      borderWidth: 10,
    },
    supportedPapers: [template.printProfile.paper],
    preferredPaper: template.printProfile.paper,
    renderMode: template.printProfile.paper === '2x6-double' ? 'double-strip' : 'standard',
    eventBranding: {
      text: '',
      subtext: '',
      showDate: true,
    },
  };
}

async function listGuestCaptureFormats(readiness?: GuestReadinessSnapshot): Promise<readonly MomentAICaptureFormat[]> {
  const bridge = getDesktopGuestSessionBridge();
  const allowLocalFallback = isLocalGuestFallbackAllowed();
  if (bridge) {
    const result = await bridge.listCaptureFormats().catch(() => null) as WindowMiniResult<MomentAICaptureFormat[]> | null;
    if (result?.ok && Array.isArray(result.value) && (result.value.length > 0 || !allowLocalFallback)) return result.value;
    if (!allowLocalFallback) throw new Error('Desktop guest capture formats IPC is unavailable.');
  }

  if (allowLocalFallback) return getFormatsForReadiness(readiness ?? createLocalReadiness());

  throw new Error('MomentAI guest capture formats IPC is unavailable.');
}

async function loadGuestReadiness(): Promise<GuestReadinessSnapshot> {
  const bridge = getDesktopGuestSessionBridge();
  const allowLocalFallback = isLocalGuestFallbackAllowed();
  if (bridge?.getReadiness) {
    const result = await bridge.getReadiness().catch(() => null) as WindowMiniResult<GuestReadinessSnapshot> | null;
    if (result?.ok && result.value) return normalizeReadiness(result.value);
    if (!allowLocalFallback) throw new Error('Desktop guest readiness IPC is unavailable.');
  }
  if (allowLocalFallback) return createLocalReadiness();
  return createBlockedReadiness('READINESS_UNAVAILABLE');
}

function getFormatsForReadiness(readiness: GuestReadinessSnapshot): readonly MomentAICaptureFormat[] {
  const enabled = readiness.activeEvent?.enabledShotFormats ?? [];
  return LOCAL_CAPTURE_FORMATS.filter((format) => enabled.includes(format.id));
}

function normalizeReadiness(snapshot: GuestReadinessSnapshot): GuestReadinessSnapshot {
  return {
    status: snapshot.status === 'READY' || snapshot.status === 'DEGRADED' || snapshot.status === 'BLOCKED' ? snapshot.status : 'BLOCKED',
    activeEvent: snapshot.activeEvent ? { eventId: snapshot.activeEvent.eventId, enabledShotFormats: [...snapshot.activeEvent.enabledShotFormats] } : null,
    reasons: Array.isArray(snapshot.reasons) ? snapshot.reasons.map(String) : [],
  };
}

function createLocalReadiness(): GuestReadinessSnapshot {
  return { status: 'READY', activeEvent: { eventId: 'event_hoi_an_heritage', enabledShotFormats: LOCAL_CAPTURE_FORMATS.map((format) => format.id) }, reasons: [] };
}

function createBlockedReadiness(reason: string): GuestReadinessSnapshot {
  return { status: 'BLOCKED', activeEvent: null, reasons: [reason] };
}

async function listGuestTemplates(eventId: string, captureFormatId: MomentAICaptureFormatId): Promise<MomentAITemplate[]> {
  const bridge = getDesktopGuestSessionBridge();
  const allowLocalFallback = isLocalGuestFallbackAllowed();
  if (bridge) {
    const result = await bridge.listTemplates(eventId, captureFormatId).catch(() => null) as WindowMiniResult<MomentAITemplate[]> | null;
    if (result?.ok && Array.isArray(result.value)) return result.value;
    if (!allowLocalFallback) throw new Error('Desktop guest templates IPC is unavailable.');
  }

  return [];
}

async function dispatchGuestSessionAction(action: string, body: Record<string, unknown>, previous: MomentAIGuestSession | null): Promise<MomentAIGuestSession> {
  const bridge = getDesktopGuestSessionBridge();
  const allowLocalFallback = isLocalGuestFallbackAllowed();
  const desktopResult = bridge ? await invokeDesktopGuestAction(bridge, action, body).catch(() => null) as WindowMiniResult<Partial<MomentAIGuestSession>> | null : null;
  if (desktopResult?.ok && desktopResult.value && hasUsableDesktopSession(action, desktopResult.value)) {
    return allowLocalFallback ? normalizeSession(desktopResult.value, previous, action, body) : requireCompleteDesktopSession(desktopResult.value);
  }
  if (bridge && !allowLocalFallback) {
    throw new Error(`Desktop guest IPC action failed: ${action}`);
  }

  if (allowLocalFallback) return applyLocalGuestAction(action, body, previous);

  throw new Error(`Desktop guest IPC action unavailable: ${action}`);
}

function getDesktopGuestSessionBridge(): WindowMiniGuestSessionBridge | null {
  if (typeof window === 'undefined') return null;
  return (window.momentai?.guest?.session as WindowMiniGuestSessionBridge | undefined) ?? null;
}

function invokeDesktopGuestAction(bridge: WindowMiniGuestSessionBridge, action: string, body: Record<string, unknown>): Promise<unknown> {
  switch (action) {
    case 'start-session':
      return bridge.create(body.eventId as string | undefined);
    case 'select-format':
      return bridge.selectFormat(String(body.sessionId || ''), String(body.formatId || ''));
    case 'add-photo':
      return bridge.addPhoto(String(body.sessionId || ''), body.photo);
    case 'select-template':
      return bridge.selectTemplate(String(body.sessionId || ''), String(body.templateId || ''));
    case 'save-customization':
      return bridge.saveCustomization(String(body.sessionId || ''), body.customization);
    case 'compose':
      return bridge.compose(String(body.sessionId || ''));
    case 'request-print':
      return bridge.requestPrint(String(body.sessionId || ''), Number(body.copies || 1));
    case 'complete':
      return bridge.complete(String(body.sessionId || ''));
    default:
      return Promise.resolve({ ok: false, error: 'UNKNOWN_GUEST_ACTION' });
  }
}

function hasUsableDesktopSession(action: string, value: Partial<MomentAIGuestSession>) {
  return action === 'start-session' ? Boolean(value.sessionId) : Boolean(value.sessionId && value.eventId);
}

function requireCompleteDesktopSession(value: Partial<MomentAIGuestSession>): MomentAIGuestSession {
  if (!value.sessionId || !value.eventId || !value.status || !value.createdAt || !value.updatedAt) {
    throw new Error('Desktop guest IPC returned an incomplete session.');
  }
  return {
    sessionId: value.sessionId,
    eventId: value.eventId,
    captureFormat: value.captureFormat ?? null,
    photos: value.photos ?? [],
    selectedTemplate: value.selectedTemplate ?? null,
    slotAssignments: value.slotAssignments ?? [],
    customization: value.customization ?? { text: [], drawing: [] },
    outputs: value.outputs ?? { master: null, share: null, print: null },
    qr: value.qr ?? null,
    printJob: value.printJob ?? null,
    status: value.status,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    completedAt: value.completedAt,
  };
}

function isLocalGuestFallbackAllowed() {
  if (typeof window === 'undefined') return false;
  const { hostname, port, protocol } = window.location;
  const isLoopback = hostname === 'localhost' || hostname === '127.0.0.1';
  return protocol === 'http:' && isLoopback && (port === '5173' || port === '5174' || port === '3000');
}

function normalizeSession(partial: Partial<MomentAIGuestSession>, previous: MomentAIGuestSession | null, action: string, body: Record<string, unknown>): MomentAIGuestSession {
  const fallback = previous ?? createLocalSession(body.eventId as string | undefined);
  const localResult = applyLocalGuestAction(action, body, { ...fallback, ...partial });
  return {
    ...localResult,
    ...partial,
    sessionId: partial.sessionId || localResult.sessionId,
    eventId: partial.eventId || localResult.eventId,
  };
}

function applyLocalGuestAction(action: string, body: Record<string, unknown>, previous: MomentAIGuestSession | null): MomentAIGuestSession {
  const now = new Date().toISOString();
  const session = previous ?? createLocalSession(body.eventId as string | undefined);

  switch (action) {
    case 'start-session':
      return previous ? { ...previous, status: 'SELECTING_FORMAT', updatedAt: now } : createLocalSession(body.eventId as string | undefined);
    case 'select-format': {
      const format = LOCAL_CAPTURE_FORMATS.find((item) => item.id === body.formatId) ?? LOCAL_CAPTURE_FORMATS[2];
      return { ...session, captureFormat: format, status: 'READY_TO_CAPTURE', updatedAt: now };
    }
    case 'add-photo': {
      const photo = body.photo as { photoId?: string; shotIndex?: number; originalPath?: string; dataUrl?: string } | undefined;
      if (!photo?.photoId || typeof photo.shotIndex !== 'number' || !photo.originalPath) return { ...session, status: 'STORAGE_ERROR', updatedAt: now };
      const nextPhoto = {
        photoId: photo.photoId,
        sessionId: session.sessionId,
        shotIndex: photo.shotIndex,
        originalPath: photo.originalPath,
        status: 'valid' as const,
        capturedAt: now,
        dataUrl: photo.dataUrl,
      };
      return { ...session, photos: [...session.photos, nextPhoto], status: 'SELECTING_TEMPLATE', updatedAt: now };
    }
    case 'select-template': {
      const templateId = String(body.templateId || 'template_local');
      const template = (body.template as MomentAITemplate) ?? {
        templateId,
        eventId: session.eventId,
        captureFormatId: session.captureFormat?.id ?? 'format_4shot',
        name: 'Imported Frame',
        status: 'PUBLISHED',
        canvas: { width: 1800, height: 2700 },
        slots: session.photos.map((_, i) => ({ slotIndex: i + 1, x: 0, y: 0, width: 100, height: 100 })),
        assets: { background: 'transparent' },
        customization: { allowTyping: false, allowDraw: true },
        printProfile: { paper: '4x6', orientation: 'portrait', dpi: 300 },
      };
      return {
        ...session,
        selectedTemplate: template,
        slotAssignments: session.photos.slice(0, template.slots.length).map((photo, index) => ({ slotIndex: index + 1, photoId: photo.photoId })),
        status: template.customization.allowDraw || template.customization.allowTyping ? 'CUSTOMIZING' : 'COMPOSING',
        updatedAt: now,
      };
    }
    case 'save-customization':
      return { ...session, customization: body.customization as MomentAIGuestSession['customization'] ?? session.customization, status: 'COMPOSING', updatedAt: now };
    case 'compose':
      return { ...session, outputs: { master: 'local-master', share: 'local-share', print: 'local-print' }, qr: { url: '', status: 'failed' }, status: 'RESULT_READY', updatedAt: now };
    case 'request-print':
      return { ...session, printJob: { jobId: `print_${session.sessionId}`, sessionId: session.sessionId, templateId: session.selectedTemplate?.templateId ?? 'template_local', file: 'local-print', paper: session.selectedTemplate?.printProfile.paper ?? '4x6', copies: Number(body.copies || 1), status: 'queued', createdAt: now, attempts: 0 }, updatedAt: now };
    case 'complete':
      return { ...session, status: 'COMPLETED', completedAt: now, updatedAt: now };
    default:
      return session;
  }
}

function createLocalSession(eventId = 'event_hoi_an_heritage'): MomentAIGuestSession {
  localSessionSequence += 1;
  const now = new Date().toISOString();
  const uniqueId = `desktop_session_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  return {
    sessionId: uniqueId,
    eventId,
    captureFormat: null,
    photos: [],
    selectedTemplate: null,
    slotAssignments: [],
    customization: { text: [], drawing: [] },
    outputs: { master: null, share: null, print: null },
    qr: null,
    printJob: null,
    status: 'SELECTING_FORMAT',
    createdAt: now,
    updatedAt: now,
  };
}


function sanitizePhotoId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128) || `photo_${localSessionSequence}`;
}
