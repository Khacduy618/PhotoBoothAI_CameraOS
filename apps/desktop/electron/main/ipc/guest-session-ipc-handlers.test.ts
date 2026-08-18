import { describe, expect, it } from "vitest";

import { registerWindowMiniGuestSessionIpcHandlers } from "./guest-session-ipc-handlers";
import { WINDOWMINI_IPC_CHANNELS } from "./windowmini-ipc-contracts";

interface RegisteredHandler {
  channel: string;
  handler: (...args: unknown[]) => Promise<unknown> | unknown;
}

function createFakeIpcMain() {
  const handlers: RegisteredHandler[] = [];
  return {
    ipcMain: {
      handle(channel: string, handler: (...args: unknown[]) => Promise<unknown> | unknown) {
        handlers.push({ channel, handler });
      },
    },
    handlers,
  };
}

describe("WindowMini guest session IPC handlers", () => {
  it("registers readiness and enabled-format channels", async () => {
    const fake = createFakeIpcMain();
    const registration = registerWindowMiniGuestSessionIpcHandlers(fake.ipcMain);

    expect(registration.channels).toContain(WINDOWMINI_IPC_CHANNELS.guestGetReadiness);
    expect(registration.channels).toContain(WINDOWMINI_IPC_CHANNELS.guestListCaptureFormats);
    expect(registration.channels).toContain(WINDOWMINI_IPC_CHANNELS.guestStartSession);

    const readinessHandler = fake.handlers.find((item) => item.channel === WINDOWMINI_IPC_CHANNELS.guestGetReadiness)?.handler;
    const formatsHandler = fake.handlers.find((item) => item.channel === WINDOWMINI_IPC_CHANNELS.guestListCaptureFormats)?.handler;
    expect(readinessHandler).toBeDefined();
    expect(formatsHandler).toBeDefined();

    const readiness = await readinessHandler?.({});
    expect(readiness).toMatchObject({ ok: true, value: { activeEvent: { eventId: "event_hoi_an_heritage" } } });

    const formats = await formatsHandler?.({});
    expect(formats).toMatchObject({ ok: true });
    expect((formats as { value?: unknown[] }).value?.map((format) => (format as { id: string }).id)).toEqual([
      "format_1shot",
      "format_2shot",
      "format_4shot",
      "format_6shot",
    ]);
  });
});
