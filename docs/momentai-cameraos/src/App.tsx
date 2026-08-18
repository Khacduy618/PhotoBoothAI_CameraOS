import React, { useState } from 'react';
import {
  GuestScreenState,
  SessionData,
  PhotoItem,
  FrameTemplate,
  EventConfig,
  CameraSettings,
  PrinterSettings,
  CaptureConfig,
} from './types';
import { DEFAULT_FRAME_TEMPLATES } from './data/defaultTemplates';
import { HOI_AN_SAMPLE_PHOTOS } from './data/hoianSamplePhotos';
import { cameraService } from './services/cameraService';
import { printerService } from './services/printerService';
import { compositionEngine } from './services/compositionEngine';

// Guest Screens
import { AttractScreen } from './components/Guest/AttractScreen';
import { SelectShotsScreen } from './components/Guest/SelectShotsScreen';
import { SelectPrintQuantityScreen } from './components/Guest/SelectPrintQuantityScreen';
import { AutoCaptureScreen } from './components/Guest/AutoCaptureScreen';
import { SelectFrameScreen } from './components/Guest/SelectFrameScreen';
import { CustomizeScreen } from './components/Guest/CustomizeScreen';
import { PrintQRScreen } from './components/Guest/PrintQRScreen';

// Operator Dashboard
import { OperatorDashboard } from './components/Operator/OperatorDashboard';

export default function App() {
  const [screenState, setScreenState] = useState<GuestScreenState>('G01_START');
  const [isOperatorOpen, setIsOperatorOpen] = useState<boolean>(false);

  // Configuration States
  const [eventConfig, setEventConfig] = useState<EventConfig>({
    eventName: 'MOMENTAI PHOTOBOOTH',
    eventDate: '2026-08-11',
    hostName: 'MomentAI CameraOS Platform',
    primaryColor: '#f59e0b',
    accentColor: '#f43f5e',
    theme: 'light',
    customTagline: 'GHI LẠI KHOẢNH KHẮC BẮT MẮT BẰNG CANON 6D',
  });

  const [cameraSettings, setCameraSettings] = useState<CameraSettings>(cameraService.getSettings());
  const [printerSettings, setPrinterSettings] = useState<PrinterSettings>(printerService.getSettings());

  const [captureConfig, setCaptureConfig] = useState<CaptureConfig>({
    availableCounts: [1, 2, 4, 6],
    defaultCount: 4,
    countdownSeconds: 3,
    intervalSeconds: 2,
    allowRetake: true,
  });

  const [frameTemplates, setFrameTemplates] = useState<FrameTemplate[]>(DEFAULT_FRAME_TEMPLATES);

  // Active Guest Session State
  const [currentSession, setCurrentSession] = useState<SessionData | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SessionData[]>([]);

  // Session Handlers
  const startNewSession = () => {
    const newSession: SessionData = {
      sessionId: `session_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toLocaleTimeString('vi-VN'),
      captureCount: captureConfig.defaultCount,
      photos: [],
      slotAssignments: [],
      printStatus: 'idle',
      copiesPrinted: 0,
    };
    setCurrentSession(newSession);
    setScreenState('G02_SELECT_SHOTS');
  };

  const handleSelectShots = (count: number) => {
    if (!currentSession) return;
    setCurrentSession({
      ...currentSession,
      captureCount: count,
      photos: [],
    });
    setScreenState('G02B_SELECT_PRINT_QTY');
  };

  const handleConfirmPrintQuantity = (quantity: number) => {
    if (!currentSession) return;
    setCurrentSession({
      ...currentSession,
      selectedPrintQuantity: quantity,
    });
    setScreenState('G03_CAPTURE');
  };

  const handlePhotoCaptured = (photo: PhotoItem) => {
    if (!currentSession) return;
    setCurrentSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        photos: [...prev.photos, photo],
      };
    });
  };

  const handleCaptureCompleted = () => {
    setScreenState('G04_SELECT_TEMPLATE');
  };

  const handleSelectFrame = async (frame: FrameTemplate) => {
    if (!currentSession) return;
    
    // Auto-assign photos in order, or fallback to Hoi An sample photos if photos were skipped
    const assignments = (currentSession.photos && currentSession.photos.length > 0)
      ? currentSession.photos.slice(0, frame.layout.slotCount)
      : HOI_AN_SAMPLE_PHOTOS.slice(0, frame.layout.slotCount).map((url, i) => ({
          id: `sample-${i}`,
          dataUrl: url,
          timestamp: Date.now(),
        }));

    const updatedSession = {
      ...currentSession,
      selectedFrame: frame,
      slotAssignments: assignments,
    };

    setCurrentSession(updatedSession);

    // Route to Screen 05 (Customize) if template supports typing or drawing, otherwise straight to Screen 06
    if (frame.allowTyping || frame.allowDraw) {
      setScreenState('G05_CUSTOMIZE');
    } else {
      // Render final outputs directly
      const outputs = await compositionEngine.renderComposition(
        frame,
        assignments,
        eventConfig,
        undefined,
        undefined,
        1800,
        2700
      );
      setCurrentSession({
        ...updatedSession,
        outputs,
      });
      setScreenState('G06_FINAL_PREVIEW');
    }
  };

  const handleConfirmCustomization = async (customText: string, drawDataUrl: string) => {
    if (!currentSession || !currentSession.selectedFrame) return;

    const slotCount = currentSession.selectedFrame.layout.slotCount;
    const assignments = (currentSession.slotAssignments && currentSession.slotAssignments.length > 0)
      ? currentSession.slotAssignments
      : HOI_AN_SAMPLE_PHOTOS.slice(0, slotCount).map((url, i) => ({
          id: `sample-${i}`,
          dataUrl: url,
          timestamp: Date.now(),
        }));

    const updatedSession = {
      ...currentSession,
      slotAssignments: assignments,
      customText,
      drawDataUrl,
    };

    // Render final composition with customization
    const outputs = await compositionEngine.renderComposition(
      currentSession.selectedFrame,
      assignments,
      eventConfig,
      customText,
      drawDataUrl,
      1800,
      2700
    );

    setCurrentSession({
      ...updatedSession,
      outputs,
    });

    setScreenState('G06_FINAL_PREVIEW');
  };

  const handleFinishSession = () => {
    if (currentSession) {
      setSessionHistory((prev) => [currentSession, ...prev]);
    }
    setCurrentSession(null);
    setScreenState('G01_START');
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#1A1A1A] font-sans flex flex-col justify-between select-none">
      {/* Main Flow Controller */}
      <main className="flex-1 relative flex flex-col items-center justify-center overflow-hidden">
        {screenState === 'G01_START' && (
          <AttractScreen
            eventConfig={eventConfig}
            onStartSession={startNewSession}
          />
        )}

        {screenState === 'G02_SELECT_SHOTS' && (
          <SelectShotsScreen
            onSelectShots={handleSelectShots}
            onBackToStart={() => setScreenState('G01_START')}
          />
        )}

        {screenState === 'G02B_SELECT_PRINT_QTY' && currentSession && (
          <SelectPrintQuantityScreen
            shotCount={currentSession.captureCount}
            defaultQuantity={currentSession.selectedPrintQuantity || 1}
            onConfirmPrintQuantity={handleConfirmPrintQuantity}
            onBackToShots={() => setScreenState('G02_SELECT_SHOTS')}
          />
        )}

        {screenState === 'G03_CAPTURE' && currentSession && (
          <AutoCaptureScreen
            session={currentSession}
            cameraSettings={cameraSettings}
            captureConfig={captureConfig}
            onPhotoCaptured={handlePhotoCaptured}
            onCaptureCompleted={handleCaptureCompleted}
          />
        )}

        {screenState === 'G04_SELECT_TEMPLATE' && currentSession && (
          <SelectFrameScreen
            session={currentSession}
            customTemplates={frameTemplates}
            onSelectFrame={handleSelectFrame}
            onBackToShots={() => setScreenState('G02_SELECT_SHOTS')}
          />
        )}

        {screenState === 'G05_CUSTOMIZE' && currentSession && currentSession.selectedFrame && (
          <CustomizeScreen
            session={currentSession}
            template={currentSession.selectedFrame}
            onConfirmCustomization={handleConfirmCustomization}
            onBackToTemplate={() => setScreenState('G04_SELECT_TEMPLATE')}
          />
        )}

        {screenState === 'G06_FINAL_PREVIEW' && currentSession && (
          <PrintQRScreen
            session={currentSession}
            printerSettings={printerSettings}
            onFinishSession={handleFinishSession}
          />
        )}
      </main>

      {/* Operator Dashboard Modal */}
      <OperatorDashboard
        isOpen={isOperatorOpen}
        onClose={() => setIsOperatorOpen(false)}
        eventConfig={eventConfig}
        onUpdateEventConfig={setEventConfig}
        cameraSettings={cameraSettings}
        onUpdateCameraSettings={(part) => setCameraSettings((prev) => ({ ...prev, ...part }))}
        printerSettings={printerSettings}
        onUpdatePrinterSettings={(part) => setPrinterSettings((prev) => ({ ...prev, ...part }))}
        captureConfig={captureConfig}
        onUpdateCaptureConfig={setCaptureConfig}
        frameTemplates={frameTemplates}
        onAddFrameTemplate={(newT) => setFrameTemplates((prev) => [...prev, newT])}
        onDeleteFrameTemplate={(id) => setFrameTemplates((prev) => prev.filter((t) => t.id !== id))}
        sessionHistory={sessionHistory}
        onReprintSession={(s) => {
          setCurrentSession(s);
          setIsOperatorOpen(false);
          setScreenState('G06_FINAL_PREVIEW');
        }}
      />
    </div>
  );
}

