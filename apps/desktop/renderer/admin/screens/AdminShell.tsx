"use client";

import React, { useEffect, useState } from 'react';

import { FrameImportPanel } from '@/components/frame-import/FrameImportPanel';
import { CP1000ColorTestModal } from '@/components/dev/CP1000ColorTestModal';
import { EventsManagementTab } from '../components/EventsManagementTab';
import { HardwareMonitorTab } from '../components/HardwareMonitorTab';
import { LogsAndMaintenanceTab } from '../components/LogsAndMaintenanceTab';

import { getWindowMiniAdminViewModel } from '../state/windowmini-admin-view-model';

type AdminTab = 'events' | 'frames' | 'hardware' | 'logs';

export function WindowMiniAdminShell() {
  const adminViewModel = getWindowMiniAdminViewModel();
  const [passcode, setPasscode] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isColorTestOpen, setIsColorTestOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('events');
  const [targetEventIdForFrames, setTargetEventIdForFrames] = useState<string | undefined>(undefined);
  // isDev: resolved from Electron main process (app.isPackaged).
  // Falls back to NODE_ENV when running in web/Next.js context.
  const [isDev, setIsDev] = useState<boolean | null>(null);

  useEffect(() => {
    const platformBridge = (window as unknown as {
      momentai?: { platform?: { getInfo?: () => Promise<{ isDev?: boolean }> } }
    }).momentai?.platform;

    if (platformBridge?.getInfo) {
      platformBridge.getInfo()
        .then((info) => setIsDev(Boolean(info?.isDev)))
        .catch(() => setIsDev(process.env.NODE_ENV !== 'production'));
    } else {
      // Web / Next.js fallback: use NODE_ENV
      setIsDev(process.env.NODE_ENV !== 'production');
    }
  }, []);

  const unlock = async () => {
    setError(null);

    // Path 1: Electron IPC — always preferred, works in both dev and prod.
    // Passcode is validated server-side against MOMENTAI_ADMIN_PASSCODE env var.
    if (adminViewModel.api) {
      const result = await adminViewModel.api.auth.unlock(passcode);
      if (result.ok) {
        setToken(result.value.token);
        setPasscode('');
        return;
      }
      setError(result.error.guestMessage);
      return;
    }

    // Path 2: Web/Next.js fallback (no Electron IPC available).
    // Dev-only convenience: accept '0000' so local web dev works without full Electron.
    // In production web context this path never unlocks.
    if (isDev && passcode === '0000') {
      setToken('dev-web-fallback-admin');
      setPasscode('');
      return;
    }

    setError('Mã admin không đúng.');
  };

  const handleSelectEventForFrames = (eventId: string) => {
    setTargetEventIdForFrames(eventId);
    setActiveTab('frames');
  };

  if (!token) {
    return (
      <main className="min-h-screen bg-[#111111] text-[#FDFCFB]">
        <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-10">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#F6C453]">Hidden Operator Surface</p>
          <h1 className="mt-4 font-serif text-4xl font-bold">Mở Admin</h1>
          <p className="mt-3 text-sm text-white/70">
            Nhập passcode operator để quản lý event, frame, thiết bị và trạng thái booth.
            {isDev && (
              <span className="ml-1 font-mono text-xs text-[#F6C453]/70">
                [dev — passcode: <code>MOMENTAI_ADMIN_PASSCODE</code> hoặc <code>0000</code>]
              </span>
            )}
          </p>
          <input
            type="password"
            inputMode="numeric"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void unlock();
            }}
            className="mt-8 rounded-xl border border-white/20 bg-white px-5 py-4 text-center text-3xl font-black tracking-[0.4em] text-[#111111] outline-none focus:border-[#F6C453]"
            aria-label="Admin passcode"
            autoFocus
          />
          {error && <p className="mt-3 rounded-lg bg-red-500/15 px-4 py-3 text-sm font-bold text-red-200">{error}</p>}
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => {
                window.location.hash = '#/guest';
              }}
              className="flex-1 rounded-xl border border-white/20 px-4 py-4 text-xs font-bold uppercase tracking-[0.15em] text-white/80 transition hover:bg-white/10 active:scale-95"
            >
              Quay lại Booth
            </button>
            <button
              type="button"
              onClick={() => void unlock()}
              className="flex-1 rounded-xl bg-[#F6C453] px-4 py-4 text-xs font-black uppercase tracking-[0.2em] text-[#111111] transition active:scale-95"
            >
              Mở Admin
            </button>
          </div>
        </section>
      </main>
    );
  }

  const navTabs: { id: AdminTab; label: string; icon: string }[] = [
    { id: 'events', label: 'Sự Kiện (Events)', icon: '🎪' },
    { id: 'frames', label: 'Mẫu Khung (Frames)', icon: '🖼️' },
    { id: 'hardware', label: 'Thiết Bị (Hardware)', icon: '🖨️' },
    { id: 'logs', label: 'Nhật Ký & Dọn Dẹp', icon: '📊' },
  ];

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-950 dark:bg-[#0A0A0A] dark:text-neutral-100">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 px-6 py-2.5 backdrop-blur dark:border-neutral-800 dark:bg-[#121212]/95">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                window.location.hash = '#/guest';
              }}
              className="flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-xs font-bold text-neutral-800 shadow-sm transition hover:bg-neutral-100 active:scale-95 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            >
              ← Quay Lại Booth
            </button>

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              {navTabs.map((tab) => {
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-black transition ${
                      isSelected
                        ? 'bg-neutral-900 text-[#F6C453] shadow dark:bg-neutral-800 dark:text-[#F6C453]'
                        : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsColorTestOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-amber-800 transition hover:bg-amber-500/20 active:scale-95 dark:text-amber-400"
            >
              🎨 Calibration V2
            </button>
            <div className="text-right text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
              Ctrl + Shift + A
            </div>
          </div>
        </div>
      </header>

      {/* Main Tab Content */}
      <section className="py-2">
        {activeTab === 'events' && (
          <EventsManagementTab onSelectEventForFrames={handleSelectEventForFrames} />
        )}
        {activeTab === 'frames' && (
          <FrameImportPanel
            initialEventId={targetEventIdForFrames}
            onEventChange={(eventId) => setTargetEventIdForFrames(eventId)}
          />
        )}
        {activeTab === 'hardware' && (
          <HardwareMonitorTab onOpenColorTest={() => setIsColorTestOpen(true)} />
        )}
        {activeTab === 'logs' && (
          <LogsAndMaintenanceTab />
        )}
      </section>

      {/* CP1000 Color Test Calibration Modal */}
      <CP1000ColorTestModal
        isOpen={isColorTestOpen}
        onClose={() => setIsColorTestOpen(false)}
      />
    </main>
  );
}

