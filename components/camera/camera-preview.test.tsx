import { describe, expect, it, vi } from "vitest";

import { performRetake } from "@/components/camera/camera-preview";

describe("performRetake", () => {
    it("clears photo and resets without reconnecting for manual retake", async () => {
        const connect = vi.fn(async () => true);
        const clearPhoto = vi.fn();
        const reset = vi.fn();

        const completed = await performRetake({
            reconnectCamera: false,
            selectedDeviceId: "camera-1",
            connect,
            clearPhoto,
            reset,
        });

        expect(completed).toBe(true);
        expect(connect).not.toHaveBeenCalled();
        expect(clearPhoto).toHaveBeenCalledTimes(1);
        expect(reset).toHaveBeenCalledTimes(1);
    });

    it("reconnects default camera before clearing photo for gesture retake", async () => {
        const connect = vi.fn(async (deviceId?: string) => {
            expect(deviceId).toBeUndefined();
            return true;
        });
        const calls: string[] = [];

        const completed = await performRetake({
            reconnectCamera: true,
            selectedDeviceId: "",
            connect: async (deviceId) => {
                calls.push(`connect:${deviceId ?? "default"}`);
                return connect(deviceId);
            },
            clearPhoto: () => {
                calls.push("clearPhoto");
            },
            reset: () => {
                calls.push("reset");
            },
        });

        expect(completed).toBe(true);
        expect(connect).toHaveBeenCalledWith(undefined);
        expect(calls).toEqual([
            "connect:default",
            "clearPhoto",
            "reset",
        ]);
    });

    it("reconnects the selected camera before clearing photo", async () => {
        const connect = vi.fn(async () => true);
        const clearPhoto = vi.fn();
        const reset = vi.fn();

        const completed = await performRetake({
            reconnectCamera: true,
            selectedDeviceId: "camera-2",
            connect,
            clearPhoto,
            reset,
        });

        expect(completed).toBe(true);
        expect(connect).toHaveBeenCalledWith("camera-2");
        expect(clearPhoto).toHaveBeenCalledTimes(1);
        expect(reset).toHaveBeenCalledTimes(1);
    });

    it("keeps the captured photo when reconnect fails", async () => {
        const connect = vi.fn(async () => false);
        const clearPhoto = vi.fn();
        const reset = vi.fn();

        const completed = await performRetake({
            reconnectCamera: true,
            selectedDeviceId: "camera-2",
            connect,
            clearPhoto,
            reset,
        });

        expect(completed).toBe(false);
        expect(connect).toHaveBeenCalledWith("camera-2");
        expect(clearPhoto).not.toHaveBeenCalled();
        expect(reset).not.toHaveBeenCalled();
    });
});
