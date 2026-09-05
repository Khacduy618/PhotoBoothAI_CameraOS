import React, { Component, type ErrorInfo, useEffect, useState } from 'react';

import { WindowMiniAdminShell } from '../admin';
import { WindowMiniGuestShell } from '../guest';
import { CP1000ColorTestModal } from '@/components/dev/CP1000ColorTestModal';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class DesktopErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[DESKTOP_RENDERER_ERROR]', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-[#111111] p-8 text-[#FDFCFB]">
          <div className="max-w-2xl rounded-2xl border border-red-500/30 bg-red-950/20 p-8 shadow-2xl backdrop-blur">
            <div className="flex items-center gap-3 text-red-400">
              <span className="text-3xl">⚠️</span>
              <h1 className="text-xl font-bold uppercase tracking-wider">Đã xảy ra lỗi giao diện (Renderer Error)</h1>
            </div>
            <p className="mt-4 text-sm text-neutral-300">
              {this.state.error?.message || 'Lỗi không xác định trong quá trình render.'}
            </p>
            {this.state.error?.stack && (
              <pre className="mt-4 max-h-60 overflow-auto rounded-lg bg-black/60 p-4 font-mono text-xs text-red-200">
                {this.state.error.stack}
              </pre>
            )}
            <div className="mt-6 flex gap-4">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-xl bg-[#F6C453] px-5 py-2.5 text-xs font-black uppercase tracking-wider text-black transition hover:bg-[#e0b040] active:scale-95"
              >
                Tải lại ứng dụng (Reload)
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.hash = '#/guest';
                  this.setState({ hasError: false, error: null, errorInfo: null });
                }}
                className="rounded-xl border border-white/20 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white/80 transition hover:bg-white/10 active:scale-95"
              >
                Về màn hình Booth (#/guest)
              </button>
            </div>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

export function WindowMiniDesktopApp() {
  const [route, setRoute] = useState(() => (typeof window === 'undefined' ? '#/guest' : window.location.hash || '#/guest'));
  const [isColorTestOpen, setIsColorTestOpen] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash || '#/guest');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Global operator shortcuts on Windows & Mac:
  //  - Ctrl + Shift + A: Toggle Admin Shell
  //  - Ctrl + Shift + C: Toggle CP1000 Color Test Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        const nextHash = window.location.hash.includes('admin') ? '#/guest' : '#/admin';
        window.location.hash = nextHash;
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        setIsColorTestOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <DesktopErrorBoundary>
      {route.includes('admin') ? <WindowMiniAdminShell /> : <WindowMiniGuestShell />}
      <CP1000ColorTestModal
        isOpen={isColorTestOpen}
        onClose={() => setIsColorTestOpen(false)}
      />
    </DesktopErrorBoundary>
  );
}
