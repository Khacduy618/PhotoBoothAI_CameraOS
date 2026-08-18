"use client";

import React, { useState } from 'react';

import { FrameImportPanel } from '@/components/frame-import/FrameImportPanel';

import { getWindowMiniAdminViewModel } from '../state/windowmini-admin-view-model';

export function WindowMiniAdminShell() {
  const adminViewModel = getWindowMiniAdminViewModel();
  const [passcode, setPasscode] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const unlock = async () => {
    setError(null);
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

    if (passcode === '0000') {
      setToken('next-fallback-admin');
      setPasscode('');
      return;
    }
    setError('Mã admin không đúng.');
  };

  if (!token) {
    return (
      <main className="min-h-screen bg-[#111111] text-[#FDFCFB]">
        <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-10">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#F6C453]">Hidden Operator Surface</p>
          <h1 className="mt-4 font-serif text-4xl font-bold">Mở Admin</h1>
          <p className="mt-3 text-sm text-white/70">
            Nhập passcode operator để quản lý event, frame, thiết bị và trạng thái booth. Mặc định dev: 0000.
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
          <button
            type="button"
            onClick={() => void unlock()}
            className="mt-5 rounded-xl bg-[#F6C453] px-6 py-4 text-xs font-black uppercase tracking-[0.25em] text-[#111111] transition active:scale-95"
          >
            Mở Admin
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-950">
      <div className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 px-4 py-2 text-right text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 backdrop-blur">
        Admin unlocked • {adminViewModel.source}
      </div>
      <FrameImportPanel />
    </main>
  );
}
