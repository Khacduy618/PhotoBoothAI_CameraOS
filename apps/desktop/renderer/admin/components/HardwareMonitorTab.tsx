"use client";

import React, { useEffect, useState } from "react";
import type { DeviceHealthSnapshot, Result } from "@momentai/shared-types";

interface PrintJobInfo {
  id: string;
  session_id: string;
  copies: number;
  status: string;
  last_error?: string;
  created_at: string;
}

interface PrinterConsumablesInfo {
  totalCapacity: number;
  sheetsPrinted: number;
  sheetsRemaining: number;
  isLowPaper: boolean;
  isPaused: boolean;
  lastResetAt?: string;
}

interface PrintQueueStatusInfo {
  queueLength: number;
  isProcessing: boolean;
  isPaused: boolean;
  activeJob?: PrintJobInfo | null;
  recentJobs: PrintJobInfo[];
  consumables: PrinterConsumablesInfo;
}

interface WindowMiniAdminBridge {
  health?: {
    snapshot(): Promise<Result<DeviceHealthSnapshot>>;
  };
  printer?: {
    getStatus(): Promise<Result<PrintQueueStatusInfo>>;
    resetPaper(capacity?: number): Promise<Result<boolean>>;
    pauseQueue(): Promise<Result<boolean>>;
    resumeQueue(): Promise<Result<boolean>>;
    retryJob(jobId: string): Promise<Result<{ ok: boolean }>>;
    cancelJob(jobId: string): Promise<Result<{ ok: boolean }>>;
  };
}

function getAdminBridge(): WindowMiniAdminBridge | null {
  if (typeof window === "undefined") return null;
  return (window.momentai?.admin as WindowMiniAdminBridge | undefined) ?? null;
}

interface HardwareMonitorTabProps {
  onOpenColorTest: () => void;
}

export function HardwareMonitorTab({ onOpenColorTest }: HardwareMonitorTabProps) {
  const [health, setHealth] = useState<DeviceHealthSnapshot | null>(null);
  const [queueStatus, setQueueStatus] = useState<PrintQueueStatusInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>("");

  const refreshData = async () => {
    setLoading(true);
    try {
      const bridge = getAdminBridge();
      if (bridge?.health?.snapshot) {
        const res = await bridge.health.snapshot();
        if (res.ok && res.value) {
          setHealth(res.value);
        }
      }
      if (bridge?.printer?.getStatus) {
        const qRes = await bridge.printer.getStatus();
        if (qRes.ok && qRes.value) {
          setQueueStatus(qRes.value);
        }
      }
      setLastRefreshed(new Date().toLocaleTimeString("vi-VN"));
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshData();
    const interval = setInterval(refreshData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleResetPaper = async () => {
    const bridge = getAdminBridge();
    if (!bridge?.printer?.resetPaper) return;
    setActionLoading(true);
    try {
      await bridge.printer.resetPaper(18);
      await refreshData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleTogglePause = async () => {
    const bridge = getAdminBridge();
    if (!bridge?.printer) return;
    setActionLoading(true);
    try {
      if (queueStatus?.isPaused) {
        await bridge.printer.resumeQueue();
      } else {
        await bridge.printer.pauseQueue();
      }
      await refreshData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    const bridge = getAdminBridge();
    if (!bridge?.printer?.retryJob) return;
    setActionLoading(true);
    try {
      await bridge.printer.retryJob(jobId);
      await refreshData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    const bridge = getAdminBridge();
    if (!bridge?.printer?.cancelJob) return;
    setActionLoading(true);
    try {
      await bridge.printer.cancelJob(jobId);
      await refreshData();
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "ready":
      case "ok":
      case "idle":
      case "completed":
        return "bg-emerald-500 text-emerald-950 dark:text-emerald-100";
      case "busy":
      case "active":
      case "printing":
      case "queued":
        return "bg-amber-500 text-amber-950";
      case "degraded":
      case "paused":
        return "bg-orange-500 text-white";
      case "blocked":
      case "error":
      case "failed":
        return "bg-rose-500 text-white";
      default:
        return "bg-neutral-500 text-white";
    }
  };

  const remainingSheets = queueStatus?.consumables?.sheetsRemaining ?? 18;
  const isLowPaper = queueStatus?.consumables?.isLowPaper || remainingSheets <= 3;

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Hardware Diagnostics & Durable Print Spooler
          </span>
          <h2 className="mt-1 text-2xl font-black text-neutral-900 dark:text-white">
            Giám Sát Thiết Bị & Hàng Đợi In
          </h2>
          <p className="mt-1 text-xs text-neutral-400">
            Tự động cập nhật mỗi 4 giây {lastRefreshed && `(Cập nhật lúc ${lastRefreshed})`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={refreshData}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-neutral-300 px-4 py-2.5 text-xs font-bold text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            🔄 {loading ? "Đang quét..." : "Quét Lại"}
          </button>
          <button
            type="button"
            onClick={onOpenColorTest}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-black shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 active:scale-95"
          >
            🎨 Cân Màu CP1000 V2
          </button>
        </div>
      </div>

      {/* Main Hardware Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Máy Ảnh Canon EOS 6D Card */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-2xl text-blue-500">
                📷
              </div>
              <div>
                <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                  Máy Ảnh Canon EOS 6D
                </h3>
                <p className="font-mono text-xs text-neutral-400">
                  EDSDK 13.17.0 Native Driver (Win32/macOS)
                </p>
              </div>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${getStatusColor(
                health?.camera || "ready"
              )}`}
            >
              {health?.camera || "READY"}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl bg-neutral-50 p-4 dark:bg-neutral-800/50">
            <div>
              <span className="text-[11px] font-bold text-neutral-500">LiveView EVF:</span>
              <p className="mt-0.5 font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                ● 25-30 FPS (Hoạt Động)
              </p>
            </div>
            <div>
              <span className="text-[11px] font-bold text-neutral-500">Độ Phân Giải Gốc:</span>
              <p className="mt-0.5 font-mono text-sm font-bold text-neutral-800 dark:text-neutral-200">
                5472 × 3648 (18.2 MP)
              </p>
            </div>
            <div>
              <span className="text-[11px] font-bold text-neutral-500">Cơ Chế Màn Chập:</span>
              <p className="mt-0.5 font-mono text-sm font-bold text-neutral-800 dark:text-neutral-200">
                Single Shutter (Anti-Double Slap)
              </p>
            </div>
            <div>
              <span className="text-[11px] font-bold text-neutral-500">Giao Thức:</span>
              <p className="mt-0.5 font-mono text-sm font-bold text-neutral-800 dark:text-neutral-200">
                USB 2.0 High-Speed IPC
              </p>
            </div>
          </div>
        </div>

        {/* Máy In Canon SELPHY CP1000 & Consumables Card */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-2xl text-amber-500">
                🖨️
              </div>
              <div>
                <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                  Máy In Canon SELPHY CP1000
                </h3>
                <p className="font-mono text-xs text-neutral-400">
                  Dye-Sublimation Thermal Photo Printer
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {queueStatus?.isPaused && (
                <span className="rounded-full bg-orange-500 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                  TẠM DỪNG
                </span>
              )}
              <span
                className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${getStatusColor(
                  health?.printer || "ready"
                )}`}
              >
                {health?.printer || "READY"}
              </span>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {/* Paper Consumable Bar */}
            <div className={`rounded-xl p-4 ${isLowPaper ? "bg-rose-50 border border-rose-200 dark:bg-rose-950/30 dark:border-rose-900" : "bg-neutral-50 dark:bg-neutral-800/50"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    Khay Giấy CP1000:
                  </span>
                  <div className="mt-0.5 flex items-baseline gap-2">
                    <span className={`text-xl font-black ${isLowPaper ? "text-rose-600 dark:text-rose-400" : "text-neutral-900 dark:text-white"}`}>
                      {remainingSheets} / 18
                    </span>
                    <span className="text-xs text-neutral-500">tờ còn lại</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleResetPaper}
                    disabled={actionLoading}
                    className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                  >
                    + Nạp Giấy (18)
                  </button>
                  <button
                    type="button"
                    onClick={handleTogglePause}
                    disabled={actionLoading}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold ${queueStatus?.isPaused ? "bg-emerald-600 text-white hover:bg-emerald-500" : "bg-orange-500 text-white hover:bg-orange-600"}`}
                  >
                    {queueStatus?.isPaused ? "Tiếp Tục" : "Tạm Dừng"}
                  </button>
                </div>
              </div>
              {isLowPaper && (
                <p className="mt-2 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                  ⚠️ Cảnh báo: Khay giấy sắp hết! Vui lòng nạp thêm giấy vào khay trước khi hết lệnh in.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-neutral-600 dark:text-neutral-400">
              <div className="rounded-lg bg-neutral-50 p-2.5 dark:bg-neutral-800/40">
                <span className="font-semibold">Raster Output:</span>
                <p className="mt-0.5 font-mono font-bold text-neutral-800 dark:text-neutral-200">
                  1800×2700 (450 DPI)
                </p>
              </div>
              <div className="rounded-lg bg-neutral-50 p-2.5 dark:bg-neutral-800/40">
                <span className="font-semibold">Ghép 2-Up Strip:</span>
                <p className="mt-0.5 font-mono font-bold text-neutral-800 dark:text-neutral-200">
                  2 Dải 5×15cm + Vạch Cắt
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Print Queue Table Card */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4 dark:border-neutral-800">
          <div>
            <h3 className="text-lg font-black text-neutral-900 dark:text-white">
              Hàng Đợi Lệnh In Bền Vững (Durable FIFO Spooler)
            </h3>
            <p className="text-xs text-neutral-400">
              Tổng {queueStatus?.recentJobs.length || 0} lệnh in gần nhất ({queueStatus?.queueLength || 0} lệnh đang chờ trong hàng đợi)
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${queueStatus?.isProcessing ? "bg-amber-500 text-amber-950 animate-pulse" : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"}`}>
            {queueStatus?.isProcessing ? "● ĐANG XỬ LÝ LỆNH IN" : "CHỜ LỆNH"}
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          {(!queueStatus?.recentJobs || queueStatus.recentJobs.length === 0) ? (
            <div className="py-8 text-center text-xs text-neutral-400">
              Chưa có lệnh in nào trong phiên làm việc hiện tại.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-100 font-bold text-neutral-400 dark:border-neutral-800">
                  <th className="pb-3">Mã Lệnh (Job ID)</th>
                  <th className="pb-3">Phiên Chụp</th>
                  <th className="pb-3">Số Bản</th>
                  <th className="pb-3">Trạng Thái</th>
                  <th className="pb-3">Thời Gian</th>
                  <th className="pb-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                {queueStatus.recentJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                    <td className="py-3 font-mono font-bold text-neutral-800 dark:text-neutral-200">
                      {job.id.substring(0, 18)}...
                    </td>
                    <td className="py-3 font-mono text-neutral-500">
                      {job.session_id.substring(0, 18)}...
                    </td>
                    <td className="py-3 font-bold text-neutral-700 dark:text-neutral-300">
                      {job.copies} tờ
                    </td>
                    <td className="py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${getStatusColor(job.status)}`}>
                        {job.status}
                      </span>
                      {job.last_error && (
                        <p className="mt-1 max-w-xs truncate text-[10px] text-rose-500 font-mono" title={job.last_error}>
                          {job.last_error}
                        </p>
                      )}
                    </td>
                    <td className="py-3 text-neutral-400 font-mono text-[11px]">
                      {new Date(job.created_at).toLocaleTimeString("vi-VN")}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(job.status === "FAILED" || job.status === "REQUIRES_REVIEW") && (
                          <button
                            type="button"
                            onClick={() => handleRetryJob(job.id)}
                            disabled={actionLoading}
                            className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-black hover:bg-amber-400"
                          >
                            In Lại
                          </button>
                        )}
                        {job.status === "QUEUED" && (
                          <button
                            type="button"
                            onClick={() => handleCancelJob(job.id)}
                            disabled={actionLoading}
                            className="rounded-lg bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-500/20"
                          >
                            Hủy
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
