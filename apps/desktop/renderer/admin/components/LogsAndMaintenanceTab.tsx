"use client";

import React, { useEffect, useState } from "react";
import type { AdminLogLine } from "@momentai/admin-contract";
import type { MediaCleanupResult, MediaCleanupSummary } from "@momentai/storage-contract";
import type { Result } from "@momentai/shared-types";

interface WindowMiniAdminBridge {
  cleanup?: {
    summary(): Promise<Result<MediaCleanupSummary>>;
    runNow(): Promise<Result<MediaCleanupResult[]>>;
  };
  logs?: {
    tail(limit?: number): Promise<Result<AdminLogLine[]>>;
  };
}

function getAdminBridge(): WindowMiniAdminBridge | null {
  if (typeof window === "undefined") return null;
  return (window.momentai?.admin as WindowMiniAdminBridge | undefined) ?? null;
}

export function LogsAndMaintenanceTab() {
  const [cleanupSummary, setCleanupSummary] = useState<MediaCleanupSummary | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [logs, setLogs] = useState<AdminLogLine[]>([]);
  const [logLimit, setLogLimit] = useState(50);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const bridge = getAdminBridge();
      if (bridge?.cleanup?.summary) {
        const summaryRes = await bridge.cleanup.summary();
        if (summaryRes.ok && summaryRes.value) {
          setCleanupSummary(summaryRes.value);
        }
      }
      if (bridge?.logs?.tail) {
        const logsRes = await bridge.logs.tail(logLimit);
        if (logsRes.ok && Array.isArray(logsRes.value)) {
          setLogs(logsRes.value);
        }
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    void loadData();
    if (!isAutoRefresh) return;
    const interval = setInterval(loadData, 4000);
    return () => clearInterval(interval);
  }, [logLimit, isAutoRefresh]);

  const handleRunCleanup = async () => {
    if (!window.confirm("Chạy dọn dẹp các session và file tạm cũ hơn 20 phút? (Ảnh của các phiên đang hoạt động sẽ được bảo vệ tuyệt đối)")) {
      return;
    }
    setIsCleaning(true);
    setFeedback(null);
    try {
      const bridge = getAdminBridge();
      if (bridge?.cleanup?.runNow) {
        const res = await bridge.cleanup.runNow();
        if (res.ok) {
          setFeedback(`Đã hoàn tất dọn dẹp ${res.value?.length ?? 0} mục dữ liệu hết hạn.`);
          await loadData();
        } else {
          setFeedback("Không thể hoàn tất dọn dẹp.");
        }
      }
    } catch {
      setFeedback("Lỗi khi chạy dọn dẹp.");
    } finally {
      setIsCleaning(false);
    }
  };

  const getLogLevelClass = (level: string) => {
    switch (level) {
      case "error":
        return "text-rose-400 bg-rose-950/30";
      case "warn":
        return "text-amber-400 bg-amber-950/30";
      case "info":
        return "text-sky-400 bg-sky-950/30";
      default:
        return "text-neutral-400 bg-neutral-900";
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      {/* Maintenance & Storage Card */}
      <div className="mb-8 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Media Retention & Disk Safety
            </span>
            <h2 className="mt-1 text-2xl font-black text-neutral-900 dark:text-white">
              Bảo Trì Bộ Nhớ & Dọn Dẹp Ổ Đĩa
            </h2>
            <p className="mt-1 text-xs text-neutral-400">
              Chính sách lưu trữ an toàn: Tự động dọn dẹp phiên ảnh tạm cũ hơn 20 phút. Ảnh gốc được bảo vệ vĩnh viễn.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRunCleanup}
            disabled={isCleaning}
            className="flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-rose-600/20 transition hover:bg-rose-500 active:scale-95 disabled:opacity-50"
          >
            🧹 {isCleaning ? "Đang Dọn Dẹp..." : "Dọn Dẹp Bộ Nhớ Ngay"}
          </button>
        </div>

        {feedback && (
          <div className="mt-4 rounded-xl bg-emerald-500/15 p-3 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            ✓ {feedback}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/40">
            <span className="text-[11px] font-bold text-neutral-500">Tổng Phiên Cần Dọn:</span>
            <p className="mt-1 text-xl font-black text-neutral-900 dark:text-white">
              {cleanupSummary?.eligible ?? 0} phiên
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/40">
            <span className="text-[11px] font-bold text-neutral-500">Dung Lượng Giải Phóng:</span>
            <p className="mt-1 text-xl font-black text-neutral-900 dark:text-white">
              {Math.round(((cleanupSummary?.bytesFreed ?? 0) / (1024 * 1024)) * 10) / 10} MB
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-800/40">
            <span className="text-[11px] font-bold text-neutral-500">Chính Sách Lưu Trữ:</span>
            <p className="mt-1 text-xl font-black text-emerald-600 dark:text-emerald-400">
              20-Min Session TTL
            </p>
          </div>
        </div>
      </div>

      {/* Live Logs Card */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black text-neutral-900 dark:text-white">
              Nhật Ký Hệ Thống Trực Tiếp (Live Shadow Logs)
            </h3>
            <p className="text-xs text-neutral-400">
              Ghi nhận các sự kiện phần cứng, lệnh chụp, và luồng in ấn
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-bold text-neutral-500">
              <input
                type="checkbox"
                checked={isAutoRefresh}
                onChange={(e) => setIsAutoRefresh(e.target.checked)}
                className="h-4 w-4 rounded accent-amber-500"
              />
              Tự động cuộn
            </label>

            <select
              value={logLimit}
              onChange={(e) => setLogLimit(Number(e.target.value))}
              className="rounded-lg border border-neutral-300 bg-transparent px-3 py-1.5 text-xs font-bold text-neutral-700 outline-none dark:border-neutral-700 dark:text-neutral-300"
            >
              <option value={20}>20 dòng</option>
              <option value={50}>50 dòng</option>
              <option value={100}>100 dòng</option>
            </select>

            <button
              type="button"
              onClick={loadData}
              className="rounded-lg border border-neutral-300 p-1.5 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300"
              title="Làm mới log"
            >
              🔄
            </button>
          </div>
        </div>

        <div className="mt-4 max-h-[480px] overflow-y-auto rounded-xl bg-[#111111] p-4 font-mono text-xs text-neutral-300">
          {logs.length === 0 ? (
            <div className="py-8 text-center text-neutral-500">
              Chưa có nhật ký nào được ghi nhận.
            </div>
          ) : (
            <div className="space-y-1.5">
              {logs.map((log, idx) => (
                <div key={idx} className="flex items-start gap-2.5 leading-relaxed">
                  <span className="shrink-0 text-[10px] text-neutral-500">
                    {log.timestamp ? new Date(log.timestamp).toLocaleTimeString("vi-VN") : "--:--:--"}
                  </span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.2 text-[9px] font-black uppercase ${getLogLevelClass(
                      log.level
                    )}`}
                  >
                    {log.level}
                  </span>
                  <span className="shrink-0 font-bold text-amber-400/90">
                    [{log.event}]
                  </span>
                  <span className="break-all text-neutral-300">
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
