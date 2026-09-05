"use client";

import React, { useEffect, useState } from "react";
import type { AdminEventSummary } from "@momentai/admin-contract";
import { LocalFrameRegistry } from "@/services/frame/local-frame-registry";

interface WindowMiniResult<T> {
  ok: boolean;
  value?: T;
  error?: unknown;
}

interface WindowMiniAdminBridge {
  events?: {
    list(): Promise<WindowMiniResult<AdminEventSummary[]>>;
    create(name: string): Promise<WindowMiniResult<AdminEventSummary>>;
    getActive?(): Promise<WindowMiniResult<string>>;
    setActive?(eventId: string): Promise<WindowMiniResult<void>>;
    setStatus?(eventId: string, status: "active" | "archived"): Promise<WindowMiniResult<AdminEventSummary>>;
    archive?(eventId: string): Promise<WindowMiniResult<void>>;
    rename?(eventId: string, name: string): Promise<WindowMiniResult<AdminEventSummary>>;
  };
}

function getAdminBridge(): WindowMiniAdminBridge | null {
  if (typeof window === "undefined") return null;
  return (window.momentai?.admin as WindowMiniAdminBridge | undefined) ?? null;
}

interface EventsManagementTabProps {
  onSelectEventForFrames?: (eventId: string) => void;
}

export function EventsManagementTab({ onSelectEventForFrames }: EventsManagementTabProps) {
  const [events, setEvents] = useState<AdminEventSummary[]>([]);
  const [activeEventId, setActiveEventId] = useState<string>("event_hoi_an_heritage");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadEvents = async () => {
    setLoading(true);
    try {
      const bridge = getAdminBridge();
      if (bridge?.events?.list) {
        const [listRes, activeRes] = await Promise.all([
          bridge.events.list(),
          bridge.events.getActive ? bridge.events.getActive() : Promise.resolve(null),
        ]);

        if (listRes.ok && Array.isArray(listRes.value)) {
          setEvents(listRes.value);
          if (activeRes?.ok && activeRes.value) {
            const raw = activeRes.value as unknown;
            const activeId = typeof raw === "string"
              ? raw
              : (raw && typeof raw === "object" && "eventId" in raw
                ? String((raw as { eventId: unknown }).eventId)
                : "event_hoi_an_heritage");
            setActiveEventId(activeId);
          } else {
            const activeFromList = listRes.value.find((e) => e.isActive);
            if (activeFromList) setActiveEventId(activeFromList.eventId);
          }
        }
      }
    } catch {
      showNotification("error", "Không thể tải danh sách sự kiện qua SQLite IPC.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvents();
  }, []);

  const handleToggleStatus = async (eventId: string, currentStatus: string, eventName: string) => {
    const nextStatus = currentStatus === "active" ? "archived" : "active";
    try {
      const bridge = getAdminBridge();
      if (bridge?.events?.setStatus) {
        const res = await bridge.events.setStatus(eventId, nextStatus);
        if (res.ok) {
          showNotification(
            "success",
            nextStatus === "active"
              ? `Đã bật hoạt động cho sự kiện "${eventName}"!`
              : `Đã tạm ngưng sự kiện "${eventName}".`
          );
          await loadEvents();
          return;
        }
      } else if (bridge?.events?.archive && nextStatus === "archived") {
        const res = await bridge.events.archive(eventId);
        if (res.ok) {
          showNotification("success", `Đã tạm ngưng sự kiện "${eventName}".`);
          await loadEvents();
          return;
        }
      }
      showNotification("error", "Không thể cập nhật trạng thái sự kiện.");
    } catch {
      showNotification("error", "Lỗi khi cập nhật trạng thái sự kiện.");
    }
  };

  const handleSetDefault = async (eventId: string, eventName: string) => {
    try {
      const bridge = getAdminBridge();
      if (bridge?.events?.setActive) {
        const res = await bridge.events.setActive(eventId);
        if (res.ok) {
          setActiveEventId(eventId);
          await LocalFrameRegistry.refreshFromAdminDb(eventId).catch(() => undefined);
          showNotification("success", `Đã đặt "${eventName}" làm sự kiện mặc định!`);
          await loadEvents();
          return;
        }
      }
      showNotification("error", "Không thể đặt sự kiện mặc định.");
    } catch {
      showNotification("error", "Lỗi khi đặt sự kiện mặc định.");
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newEventName.trim();
    if (!trimmed) return;

    try {
      const bridge = getAdminBridge();
      if (bridge?.events?.create) {
        const res = await bridge.events.create(trimmed);
        if (res.ok && res.value) {
          const created = res.value;
          setNewEventName("");
          setIsCreateModalOpen(false);
          showNotification("success", `Đã tạo sự kiện "${trimmed}" (Lưu vĩnh viễn trong SQLite)!`);
          await loadEvents();
          // Optional: immediately jump to manage frames for the new event
          if (onSelectEventForFrames) {
            onSelectEventForFrames(created.eventId);
          }
          return;
        }
      }
      showNotification("error", "Không thể tạo sự kiện.");
    } catch {
      showNotification("error", "Lỗi khi tạo sự kiện.");
    }
  };

  const handleStartRename = (eventId: string, currentName: string) => {
    setEditingEventId(eventId);
    setEditName(currentName);
  };

  const handleSaveRename = async (eventId: string) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    try {
      const bridge = getAdminBridge();
      if (bridge?.events?.rename) {
        const res = await bridge.events.rename(eventId, trimmed);
        if (res.ok) {
          setEditingEventId(null);
          showNotification("success", "Đổi tên sự kiện thành công!");
          await loadEvents();
          return;
        }
      }
      showNotification("error", "Không thể đổi tên sự kiện.");
    } catch {
      showNotification("error", "Lỗi khi đổi tên sự kiện.");
    }
  };

  const filteredEvents = events.filter((event) => {
    const matchesQuery =
      event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.eventId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && event.status === "active") ||
      (statusFilter === "archived" && event.status === "archived");
    return matchesQuery && matchesStatus;
  });

  const activeCount = events.filter((e) => e.status === "active").length;

  return (
    <div className="mx-auto max-w-7xl p-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-5 py-3.5 text-sm font-bold shadow-2xl transition-all ${
            notification.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-rose-600 text-white"
          }`}
        >
          <span>{notification.type === "success" ? "✓" : "⚠️"}</span>
          <span>{notification.message}</span>
        </div>
      )}

      {/* Multi-Event Status Banner */}
      <div className="mb-8 overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-6 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F6C453] text-2xl text-black shadow-lg shadow-amber-500/20">
              🎪
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></span>
                  {activeCount} Sự Kiện Đang Hoạt Động Ngoài Booth
                </span>
              </div>
              <h2 className="mt-1 text-2xl font-black text-neutral-900 dark:text-white">
                Quản Lý Sự Kiện & Khung Ảnh
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                Tất cả sự kiện bật &quot;Hoạt Động&quot; sẽ hiển thị thành các tab bộ lọc trên màn hình khách. Bạn có thể nhấn <strong>&quot;🖼️ Quản Lý Khung&quot;</strong> ở bất kỳ sự kiện nào để thêm khung.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-[#F6C453] px-5 py-3 text-xs font-black uppercase tracking-wider text-neutral-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 active:scale-95"
            >
              + Tạo Sự Kiện Mới
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-1 items-center gap-3">
          <span className="text-neutral-400">🔍</span>
          <input
            type="text"
            placeholder="Tìm theo tên sự kiện hoặc ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full max-w-md bg-transparent text-sm font-medium text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-neutral-500">Lọc:</span>
          {(["all", "active", "archived"] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition ${
                statusFilter === filter
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950"
                  : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400"
              }`}
            >
              {filter === "all" ? "Tất Cả" : filter === "active" ? "Đang Bật" : "Tạm Ngưng"}
            </button>
          ))}
          <button
            type="button"
            onClick={loadEvents}
            disabled={loading}
            className="ml-2 rounded-lg border border-neutral-200 p-1.5 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300"
            title="Làm mới"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {filteredEvents.map((event) => {
          const isDefault = event.eventId === activeEventId;
          const isActive = event.status === "active";
          const isEditing = editingEventId === event.eventId;

          return (
            <div
              key={event.eventId}
              className={`flex flex-col justify-between rounded-2xl border p-5 transition-all shadow-sm ${
                isActive
                  ? "border-emerald-500/40 bg-white dark:border-emerald-500/30 dark:bg-neutral-900"
                  : "border-neutral-200 bg-neutral-50/70 opacity-75 dark:border-neutral-800 dark:bg-neutral-900/60"
              }`}
            >
              <div>
                {/* Header Badges */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(event.eventId, event.status, event.name)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wider transition ${
                        isActive
                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-neutral-200 text-neutral-600 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-400"
                      }`}
                      title="Nhấn để Bật/Tắt hiển thị ngoài Booth"
                    >
                      <span className={`h-2 w-2 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-neutral-400"}`}></span>
                      {isActive ? "ĐANG BẬT" : "TẠM NGƯNG"}
                    </button>

                    {isDefault && (
                      <span className="rounded-md bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-black text-amber-700 dark:text-amber-300">
                        ★ Mặc Định
                      </span>
                    )}
                  </div>

                  <span className="font-mono text-xs font-bold text-neutral-500">
                    {event.frameCount ?? 0} khung ảnh
                  </span>
                </div>

                {/* Event Name */}
                <div className="mt-4">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm font-bold dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRename(event.eventId)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Lưu
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingEventId(null)}
                        className="rounded-lg bg-neutral-200 px-3 py-1.5 text-xs font-bold text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300"
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-xl font-black text-neutral-900 dark:text-white">
                        {event.name}
                      </h3>
                      <button
                        type="button"
                        onClick={() => handleStartRename(event.eventId, event.name)}
                        className="rounded-lg p-1 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                        title="Đổi tên sự kiện"
                      >
                        ✏️
                      </button>
                    </div>
                  )}
                  <p className="mt-1 font-mono text-xs text-neutral-400">
                    ID: {event.eventId}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 border-t border-neutral-100 pt-4 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  {onSelectEventForFrames && (
                    <button
                      type="button"
                      onClick={() => onSelectEventForFrames(event.eventId)}
                      className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-neutral-900 py-2.5 text-xs font-black uppercase tracking-wider text-[#F6C453] shadow transition hover:bg-neutral-800 active:scale-95 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                    >
                      <span>🖼️</span>
                      <span>Quản Lý Khung ({event.frameCount ?? 0})</span>
                    </button>
                  )}

                  {!isDefault && isActive && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(event.eventId, event.name)}
                      className="rounded-xl border border-neutral-200 px-3 py-2.5 text-xs font-bold text-neutral-600 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      title="Đặt làm sự kiện chính ban đầu khi khởi động Booth"
                    >
                      ★ Mặc Định
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredEvents.length === 0 && !loading && (
        <div className="mt-12 text-center">
          <p className="text-4xl">🎪</p>
          <p className="mt-2 text-sm font-bold text-neutral-500">
            Không tìm thấy sự kiện nào phù hợp.
          </p>
        </div>
      )}

      {/* Modal Tạo Sự Kiện Mới */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="text-xl font-black text-neutral-900 dark:text-white">
              Tạo Sự Kiện Mới
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              Nhập tên sự kiện. Sự kiện sẽ được lưu vĩnh viễn vào SQLite và kích hoạt sẵn cho Booth.
            </p>

            <form onSubmit={handleCreateEvent} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                  Tên Sự Kiện *
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Lễ Thành Hôn Duy & Lan 2026"
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-sm font-bold text-neutral-900 outline-none focus:border-amber-500 dark:border-neutral-700 dark:text-white"
                  autoFocus
                  required
                />
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 rounded-xl border border-neutral-300 py-3 text-xs font-bold uppercase tracking-wider text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-[#F6C453] py-3 text-xs font-black uppercase tracking-wider text-neutral-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 active:scale-95"
                >
                  Tạo & Quản Lý Khung
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
