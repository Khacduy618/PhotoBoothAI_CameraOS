"use client";

import { useEffect, useMemo, useState } from 'react';

import { AttractScreen } from './components/Guest/AttractScreen';
import { SelectShotsScreen } from './components/Guest/SelectShotsScreen';
import { AutoCaptureScreen } from './components/Guest/AutoCaptureScreen';
import { SelectPrintQuantityScreen } from './components/Guest/SelectPrintQuantityScreen';
import { SelectFrameScreen } from './components/Guest/SelectFrameScreen';
import { DrawScreen } from './components/Guest/DrawScreen';
import { PrintQRScreen } from './components/Guest/PrintQRScreen';
import { compositionEngine } from './services/compositionEngine';
import { cameraService } from './services/cameraService';
import { LocalFrameRegistry } from '@/services/frame/local-frame-registry';
import type { FrameDefinition } from '@/services/frame-import/frame-import.types';
import type { CameraSettings, CaptureConfig, EventConfig, FrameTemplate, PhotoItem, PrinterSettings, SessionData } from './types';
import type { MomentAICaptureFormat, MomentAICaptureFormatId, MomentAIGuestSession, MomentAITemplate } from '@/types/momentai-guest-session';

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
  availableCounts: [1, 2, 4, 6],
  defaultCount: 4,
  countdownSeconds: 3,
  intervalSeconds: 2,
  allowRetake: false,
};

const PRINTER_SETTINGS: PrinterSettings = {
  connected: true,
  model: 'CameraOS Print Queue',
  currentPaper: '4x6',
  paperRemaining: 100,
  paperTotal: 100,
  autoPrint: true,
  copiesDefault: 1,
  status: 'READY',
};

const formatIdByShotCount: Record<number, MomentAICaptureFormatId> = {
  1: 'format_1shot',
  2: 'format_2shot',
  4: 'format_4shot',
  6: 'format_6shot',
};

export function MomentAIGuestFlowController() {
  const [screenState, setScreenState] = useState<'G01_START' | 'G02_SELECT_SHOTS' | 'G02B_SELECT_PRINT_QTY' | 'G03_CAPTURE' | 'G04_SELECT_TEMPLATE' | 'G05_DRAW' | 'G07_PRINT_QR'>('G01_START');
  const [cameraSettings, setCameraSettings] = useState<CameraSettings>(cameraService.getSettings());
  const [captureFormats, setCaptureFormats] = useState<readonly MomentAICaptureFormat[]>([]);
  const [backendSession, setBackendSession] = useState<MomentAIGuestSession | null>(null);
  const [currentSession, setCurrentSession] = useState<SessionData | null>(null);
  const [frameTemplates, setFrameTemplates] = useState<FrameTemplate[]>([]);
  const [importedFrameDefinitions, setImportedFrameDefinitions] = useState<readonly FrameDefinition[]>([]);
  const [selectedDrawDataUrl, setSelectedDrawDataUrl] = useState<string>('');

  useEffect(() => {
    const updateImportedFrames = () => {
      setImportedFrameDefinitions(LocalFrameRegistry.getPublishedDefinitions());
    };
    void LocalFrameRegistry.refreshFromAdminDb('event_hoi_an_heritage').then(updateImportedFrames);
    updateImportedFrames();
    return LocalFrameRegistry.subscribe(updateImportedFrames);
  }, []);

  useEffect(() => {
    fetch('/api/momentai-guest-session')
      .then((response) => response.json())
      .then((payload: { captureFormats?: MomentAICaptureFormat[] }) => setCaptureFormats(payload.captureFormats ?? []))
      .catch(() => setCaptureFormats([]));
  }, []);

  const refreshCameraSettings = () => setCameraSettings(cameraService.getSettings());

  async function api(action: string, body: Record<string, unknown> = {}) {
    const response = await fetch('/api/momentai-guest-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...body }),
    });
    const payload = await response.json() as { ok: boolean; session?: MomentAIGuestSession; error?: string };
    if (!payload.ok || !payload.session) throw new Error(payload.error || 'MomentAI guest session API failed.');
    setBackendSession(payload.session);
    return payload.session;
  }

  const startNewSession = async () => {
    const nextBackendSession = await api('start-session');
    const nextSession: SessionData = {
      sessionId: nextBackendSession.sessionId,
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
    setScreenState('G02_SELECT_SHOTS');
  };

  const handleSelectShots = async (count: number) => {
    if (!backendSession || !currentSession) return;
    const backendFormat = captureFormats.find((format) => format.shotCount === count);
    const formatId = backendFormat?.id ?? formatIdByShotCount[count];
    const nextBackendSession = await api('select-format', { sessionId: backendSession.sessionId, formatId });
    setCurrentSession({ ...currentSession, captureCount: count, photos: [], slotAssignments: [] });
    setBackendSession(nextBackendSession);
    setScreenState('G02B_SELECT_PRINT_QTY');
  };

  const handleConfirmPrintQuantity = (quantity: number) => {
    if (!currentSession) return;
    const safeQuantity = Math.min(5, Math.max(1, Math.round(quantity)));
    setCurrentSession({ ...currentSession, selectedPrintQuantity: safeQuantity });
    refreshCameraSettings();
    setScreenState('G03_CAPTURE');
  };

  const handlePhotoCaptured = (photo: PhotoItem) => {
    setCurrentSession((prev) => prev ? { ...prev, photos: [...prev.photos, photo] } : prev);
  };

  const handleCaptureCompleted = async (capturedPhotos: PhotoItem[]) => {
    if (!backendSession || !currentSession || !backendSession.captureFormat) return;
    const sessionWithPhotos = { ...currentSession, photos: capturedPhotos };
    setCurrentSession(sessionWithPhotos);
    let updatedBackend = backendSession;
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
    const response = await fetch(`/api/momentai-guest-session?eventId=${encodeURIComponent(updatedBackend.eventId)}&captureFormatId=${encodeURIComponent(updatedBackend.captureFormat.id)}`);
    const payload = await response.json() as { templates?: MomentAITemplate[] };
    await LocalFrameRegistry.refreshFromAdminDb(updatedBackend.eventId);
    const latestImportedDefinitions = LocalFrameRegistry.getPublishedDefinitions();
    const importedTemplates = latestImportedDefinitions
      .filter((definition) => (!definition.eventId || definition.eventId === updatedBackend.eventId) && definition.shotCount === updatedBackend.captureFormat?.shotCount)
      .map(mapImportedFrameDefinitionToFrameTemplate);
    const backendTemplates = (payload.templates ?? []).map(mapTemplateToFrameTemplate);
    setFrameTemplates(importedTemplates.length > 0 ? importedTemplates : backendTemplates);
    setBackendSession(updatedBackend);
    setScreenState('G04_SELECT_TEMPLATE');
  };

  const handleSelectFrame = async (frame: FrameTemplate) => {
    if (!backendSession || !currentSession || !backendSession.captureFormat) return;
    let backendTemplateId = frame.id;
    if (frame.assets.overlay) {
      const response = await fetch(`/api/momentai-guest-session?eventId=${encodeURIComponent(backendSession.eventId)}&captureFormatId=${encodeURIComponent(backendSession.captureFormat.id)}`);
      const payload = await response.json() as { templates?: MomentAITemplate[] };
      backendTemplateId = payload.templates?.[0]?.templateId ?? frame.id;
    }
    const nextBackendSession = await api('select-template', { sessionId: backendSession.sessionId, templateId: backendTemplateId });
    const assignments = currentSession.photos.slice(0, frame.layout.slotCount);
    const updatedSession = { ...currentSession, selectedFrame: frame, slotAssignments: assignments };
    setCurrentSession(updatedSession);
    setBackendSession(nextBackendSession);
    if (frame.allowDraw) {
      setScreenState('G05_DRAW');
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
    const outputs = await compositionEngine.renderComposition(
      session.selectedFrame,
      session.slotAssignments,
      EVENT_CONFIG,
      undefined,
      drawDataUrl,
      1800,
      2700,
    );
    const composedBackend = await api('compose', { sessionId: backend.sessionId });
    const printCopies = Math.min(5, Math.max(1, Math.round(session.selectedPrintQuantity || 1)));
    void api('auto-print', { sessionId: composedBackend.sessionId, copies: printCopies }).catch(() => undefined);
    setCurrentSession({ ...session, outputs, printStatus: 'queued' });
    setBackendSession(composedBackend);
    setScreenState('G07_PRINT_QR');
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
    <div className="min-h-screen bg-[#FDFCFB] text-[#1A1A1A] font-sans flex flex-col justify-between select-none">
      <main className="flex-1 relative flex flex-col items-center justify-center overflow-hidden">
        {screenState === 'G01_START' && <AttractScreen eventConfig={EVENT_CONFIG} onStartSession={() => void startNewSession()} />}
        {screenState === 'G02_SELECT_SHOTS' && <SelectShotsScreen onSelectShots={(count) => void handleSelectShots(count)} onBackToStart={() => setScreenState('G01_START')} />}
        {screenState === 'G02B_SELECT_PRINT_QTY' && currentSession && <SelectPrintQuantityScreen shotCount={currentSession.captureCount} defaultQuantity={currentSession.selectedPrintQuantity || 1} onConfirmPrintQuantity={handleConfirmPrintQuantity} onBackToShots={() => setScreenState('G02_SELECT_SHOTS')} />}
        {screenState === 'G03_CAPTURE' && currentSession && <AutoCaptureScreen session={currentSession} cameraSettings={cameraSettings} captureConfig={CAPTURE_CONFIG} onPhotoCaptured={handlePhotoCaptured} onCaptureCompleted={(photos) => void handleCaptureCompleted(photos)} />}
        {screenState === 'G04_SELECT_TEMPLATE' && currentSession && <SelectFrameScreen session={currentSession} customTemplates={frameTemplates} onSelectFrame={(frame) => void handleSelectFrame(frame)} onBackToShots={() => setScreenState('G02_SELECT_SHOTS')} />}
        {screenState === 'G05_DRAW' && currentSession?.selectedFrame && <DrawScreen session={currentSession} template={currentSession.selectedFrame} onConfirmDraw={(drawDataUrl) => void handleConfirmDraw(drawDataUrl)} onBackToTemplate={() => setScreenState('G04_SELECT_TEMPLATE')} />}
        {screenState === 'G07_PRINT_QR' && resultSession && <PrintQRScreen session={resultSession} printerSettings={PRINTER_SETTINGS} onFinishSession={() => void handleFinishSession()} />}
      </main>
    </div>
  );
}

function mapImportedFrameDefinitionToFrameTemplate(definition: FrameDefinition): FrameTemplate {
  return {
    id: definition.id,
    name: definition.name,
    thumbnail: definition.thumbnailUrl || definition.assetUrl || '',
    category: getImportedFrameCategory(definition),
    shotCount: definition.shotCount === 8 ? 6 : definition.shotCount,
    allowTyping: false,
    allowDraw: Boolean(definition.allowDraw),
    layout: {
      type: definition.shotCount === 6 ? '2x3' : definition.shotCount === 4 ? '1x4' : definition.shotCount === 2 ? '1x2' : '1x1',
      slotCount: definition.slots.length,
    },
    slots: definition.slots.map((slot) => ({
      id: slot.index + 1,
      x: slot.x * 100,
      y: slot.y * 100,
      width: slot.width * 100,
      height: slot.height * 100,
    })),
    assets: {
      background: 'transparent',
      overlay: definition.assetUrl,
      overlayColor: 'transparent',
      textColor: '#1A1A1A',
      borderWidth: 0,
    },
    supportedPapers: ['4x6'],
    preferredPaper: '4x6',
    renderMode: 'standard',
    eventBranding: {
      text: '',
      subtext: '',
      showDate: false,
    },
  };
}

function getImportedFrameCategory(definition: FrameDefinition): string {
  const categorized = definition as FrameDefinition & { category?: string; eventCategory?: string; eventName?: string };
  return categorized.category || categorized.eventCategory || categorized.eventName || definition.layoutFamily || 'Khung đã upload';
}

function mapTemplateToFrameTemplate(template: MomentAITemplate): FrameTemplate {
  return {
    id: template.templateId,
    name: template.name,
    thumbnail: '',
    category: template.captureFormatId === 'format_6shot' ? 'GRID' : template.captureFormatId === 'format_4shot' ? 'STRIP' : template.captureFormatId === 'format_2shot' ? '2 PHOTOS' : '1 PHOTO',
    shotCount: template.slots.length,
    allowTyping: false,
    allowDraw: template.customization.allowDraw,
    layout: {
      type: template.captureFormatId === 'format_6shot' ? '2x3' : template.captureFormatId === 'format_4shot' ? '1x4' : template.captureFormatId === 'format_2shot' ? '1x2' : '1x1',
      slotCount: template.slots.length,
    },
    slots: template.slots.map((slot) => ({ id: slot.slotIndex, x: slot.x, y: slot.y, width: slot.width, height: slot.height })),
    assets: {
      background: template.assets.background,
      overlayColor: template.assets.overlayColor,
      textColor: template.assets.textColor,
      borderWidth: 10,
    },
    supportedPapers: [template.printProfile.paper],
    preferredPaper: template.printProfile.paper,
    renderMode: template.printProfile.paper === '2x6-double' ? 'double-strip' : 'standard',
    eventBranding: {
      text: 'PHỐ CỔ HỘI AN',
      subtext: 'Tiệm Ảnh Di Sản • 2026',
      showDate: true,
    },
  };
}

function sanitizePhotoId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128) || `photo_${Date.now()}`;
}
