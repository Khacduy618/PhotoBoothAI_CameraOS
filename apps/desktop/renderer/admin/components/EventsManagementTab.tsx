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
  const [setAsActiveOnCreate, setSetAsActiveOnCreate] = useState(true);
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
            const activeId = typeof raw === 'string'
              ? raw
              : (raw && typeof raw === 'object' && 'eventId' in raw
                ? String((raw as { eventId: unknown }).eventId)
                : 'event_hoi_an_heritage');
            setActiveEventId(activeId);
          } else {
            const activeFromList = listRes.value.find((e) => e.isActive);
            if (activeFromList) setActiveEventId(activeFromList.eventId);
          }
        }
      }
    } catch {
      showNotification("error", "Không thể tải danh sách sự kiện qua IPC.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvents();
  }, []);

  const handleSetActive = async (eventId: string, eventName: string) => {
    try {
      const bridge = getAdminBridge();
      if (bridge?.events?.setActive) {
        const res = await bridge.events.setActive(eventId);
        if (res.ok) {
          setActiveEventId(eventId);
          await LocalFrameRegistry.refreshFromAdminDb(eventId).catch(() => undefined);
          showNotification("success", `Đã kích hoạt sự kiện "${eventName}" cho Photo Booth!`);
          await loadEvents();
          return;
        }
      }
      showNotification("error", "Không thể kích hoạt sự kiện.");
    } catch {
      showNotification("error", "Lỗi khi kích hoạt sự kiện.");
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
          if (setAsActiveOnCreate && bridge.events.setActive) {
            await bridge.events.setActive(created.eventId);
            setActiveEventId(created.eventId);
            await LocalFrameRegistry.refreshFromAdminDb(created.eventId).catch(() => undefined);
          }
          setNewEventName("");
          setIsCreateModalOpen(false);
          showNotification("success", `Đã tạo sự kiện "${trimmed}" thành công!`);
          await loadEvents();
          return;
        }
      }
      showNotification("error", "Không thể tạo sự kiện.");
    } catch {
      showNotification("error", "Lỗi khi tạo sự kiện.");
    }
  };

  const handleArchive = async (eventId: string, eventName: string) => {
    if (eventId === activeEventId) {
      alert("Không thể lưu trữ sự kiện đang kích hoạt cho Booth. Hãy chọn sự kiện khác làm Active trước.");
      return;
    }
    if (!window.confirm(`Bạn có chắc muốn lưu trữ sự kiện "${eventName}"?`)) return;

    try {
      const bridge = getAdminBridge();
      if (bridge?.events?.archive) {
        const res = await bridge.events.archive(eventId);
        if (res.ok) {
          showNotification("success", `Đã lưu trữ sự kiện "${eventName}".`);
          await loadEvents();
          return;
        }
      }
      showNotification("error", "Không thể lưu trữ sự kiện.");
    } catch {
      showNotification("error", "Lỗi khi lưu trữ sự kiện.");
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

  const currentActiveEvent = events.find((e) => e.eventId === activeEventId);

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

      {/* Active Event Banner */}
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
                  Đang Kích Hoạt Ngoài Booth
                </span>
                <span className="font-mono text-xs text-neutral-400">
                  ID: {activeEventId}
                </span>
              </div>
              <h2 className="mt-1 text-2xl font-black text-neutral-900 dark:text-white">
                {currentActiveEvent?.name || "Chưa chọn sự kiện"}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentActiveEvent && onSelectEventForFrames && (
              <button
                type="button"
                onClick={() => onSelectEventForFrames(activeEventId)}
                className="flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-xs font-bold text-white shadow transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-900"
              >
                🖼️ Quản Lý Khung Cho Sự Kiện Này
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-[#F6C453] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-neutral-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 active:scale-95"
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
              {filter === "all" ? "Tất Cả" : filter === "active" ? "Hoạt Động" : "Lưu Trữ"}
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredEvents.map((event) => {
          const isActive = event.eventId === activeEventId;
          const isEditing = editingEventId === event.eventId;

          return (
            <div
              key={event.eventId}
              className={`flex flex-col justify-between rounded-2xl border p-5 transition-all ${
                isActive
                  ? "border-amber-500 bg-amber-500/5 shadow-md shadow-amber-500/10 dark:border-amber-500/60"
                  : "border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900"
              }`}
            >
              <div>
                {/* Header Badge */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] font-bold ${
                      isActive
                        ? "bg-amber-500 text-black font-black"
                        : event.status === "active"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                    }`}
                  >
                    {isActive ? "★ ACTIVE BOOTH" : event.status === "active" ? "Hoạt Động" : "Đã Lưu Trữ"}
                  </span>
                  <span className="font-mono text-[11px] text-neutral-400">
                    {event.frameCount ?? 0} mẫu khung
                  </span>
                </div>

                {/* Event Name */}
                <div className="mt-3">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full rounded-lg border border-neutral-300 px-2 py-1 text-sm font-bold dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRename(event.eventId)}
                        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white"
                      >
                        Lưu
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingEventId(null)}
                        className="rounded-lg bg-neutral-200 px-2 py-1 text-xs font-bold text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300"
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                      {event.name}
                    </h3>
                  )}
                  <p className="mt-1 font-mono text-xs text-neutral-500">
                    ID: {event.eventId}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 border-t border-neutral-100 pt-4 dark:border-neutral-800">
                <div className="flex items-center justify-between gap-2">
                  {isActive ? (
                    <span className="flex items-center gap-1.5 text-xs font-black text-amber-600 dark:text-amber-400">
                      ✓ Đang kích hoạt
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetActive(event.eventId, event.name)}
                      className="flex-1 rounded-xl bg-neutral-900 py-2 text-xs font-black uppercase tracking-wider text-[#F6C453] transition hover:bg-neutral-800 active:scale-95 dark:bg-neutral-800 dark:hover:bg-neutral-700"
                    >
                      Kích Hoạt
                    </button>
                  )}

                  {onSelectEventForFrames && (
                    <button
                      type="button"
                      onClick={() => onSelectEventForFrames(event.eventId)}
                      className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                      title="Xem & thêm khung ảnh"
                    >
                      🖼️ Khung
                    </button>
                  )}

                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => handleStartRename(event.eventId, event.name)}
                      className="rounded-xl border border-neutral-200 px-2.5 py-2 text-xs text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-400"
                      title="Đổi tên sự kiện"
                    >
                      ✏️
                    </button>
                  )}

                  {event.status === "active" && !isActive && (
                    <button
                      type="button"
                      onClick={() => handleArchive(event.eventId, event.name)}
                      className="rounded-xl border border-neutral-200 px-2.5 py-2 text-xs text-rose-500 hover:bg-rose-50 dark:border-neutral-700 dark:hover:bg-rose-950/20"
                      title="Lưu trữ sự kiện"
                    >
                      📦
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
              Nhập tên sự kiện để gán vào các mẫu khung và thiết lập phiên chụp.
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

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="setActiveCheckbox"
                  checked={setAsActiveOnCreate}
                  onChange={(e) => setSetAsActiveOnCreate(e.target.checked)}
                  className="h-4 w-4 rounded accent-amber-500"
                />
                <label
                  htmlFor="setActiveCheckbox"
                  className="text-xs font-medium text-neutral-700 dark:text-neutral-300"
                >
                  Kích hoạt cho Booth ngay sau khi tạo
                </label>
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
                  Tạo Sự Kiện
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
