import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const adapterMocks = vi.hoisted(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    getStream: vi.fn(),
    capture: vi.fn(),
}));

vi.mock("@/services/camera/capture-card.adapter", () => ({
    CaptureCardAdapter: vi.fn(function CaptureCardAdapter() {
        return adapterMocks;
    }),
}));

import { useCamera } from "@/hooks/use-camera";

function createPendingStream() {
    const track = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        stop: vi.fn(),
    };

    return {
        stream: {
            getVideoTracks: vi.fn(() => [track]),
            getTracks: vi.fn(() => [track]),
        } as unknown as MediaStream,
        track,
    };
}

describe("useCamera", () => {
    beforeEach(() => {
        adapterMocks.connect.mockReset();
        adapterMocks.disconnect.mockReset();
        adapterMocks.getStream.mockReset();
        adapterMocks.capture.mockReset();

        vi.stubGlobal("navigator", {
            mediaDevices: {
                enumerateDevices: vi.fn(async () => []),
            },
        });
    });

    it("prevents overlapping connect attempts", async () => {
        const { stream } = createPendingStream();
        let resolveConnect:
            | ((stream: MediaStream) => void)
            | undefined;

        adapterMocks.connect.mockReturnValueOnce(
            new Promise<MediaStream>((resolve) => {
                resolveConnect = resolve;
            }),
        );

        const { result } = renderHook(() => useCamera());

        let firstConnect: Promise<boolean> | undefined;
        let secondConnect: Promise<boolean> | undefined;

        act(() => {
            firstConnect = result.current.connect();
            secondConnect = result.current.connect();
        });

        await expect(secondConnect).resolves.toBe(false);
        expect(adapterMocks.connect).toHaveBeenCalledTimes(1);

        await act(async () => {
            resolveConnect?.(stream);
            await firstConnect;
        });

        expect(result.current.status).toBe("ready");
        expect(result.current.stream).toBe(stream);
    });

    it("stops and ignores a stream that resolves after disconnect", async () => {
        const { stream, track } = createPendingStream();
        let resolveConnect:
            | ((stream: MediaStream) => void)
            | undefined;

        adapterMocks.connect.mockReturnValueOnce(
            new Promise<MediaStream>((resolve) => {
                resolveConnect = resolve;
            }),
        );

        const { result } = renderHook(() => useCamera());

        let connectResult: Promise<boolean> | undefined;

        act(() => {
            connectResult = result.current.connect();
        });

        act(() => {
            result.current.disconnect();
        });

        await act(async () => {
            resolveConnect?.(stream);
            await connectResult;
        });

        await expect(connectResult).resolves.toBe(false);
        expect(track.stop).toHaveBeenCalledTimes(1);
        expect(result.current.status).toBe("idle");
        expect(result.current.stream).toBeNull();
    });

    it("stops a connected stream when device enumeration fails", async () => {
        const { stream, track } = createPendingStream();

        vi.stubGlobal("navigator", {
            mediaDevices: {
                enumerateDevices: vi.fn(async () => {
                    throw new Error("enumerate failed");
                }),
            },
        });

        adapterMocks.connect.mockResolvedValueOnce(stream);

        const { result } = renderHook(() => useCamera());

        await act(async () => {
            await result.current.connect();
        });

        expect(track.stop).toHaveBeenCalledTimes(1);
        expect(adapterMocks.disconnect).toHaveBeenCalledTimes(1);
        expect(result.current.status).toBe("error");
        expect(result.current.stream).toBeNull();
    });

    it("ignores pending connect failures after disconnect", async () => {
        let rejectConnect:
            | ((error: Error) => void)
            | undefined;

        adapterMocks.connect.mockReturnValueOnce(
            new Promise<MediaStream>((_resolve, reject) => {
                rejectConnect = reject;
            }),
        );

        const { result } = renderHook(() => useCamera());

        let connectResult: Promise<boolean> | undefined;

        act(() => {
            connectResult = result.current.connect();
        });

        act(() => {
            result.current.disconnect();
        });

        await act(async () => {
            rejectConnect?.(new Error("permission revoked"));
            await connectResult;
        });

        await expect(connectResult).resolves.toBe(false);
        expect(result.current.status).toBe("idle");
        expect(result.current.error).toBeNull();
    });

    it("ignores pending connect failures after unmount", async () => {
        let rejectConnect:
            | ((error: Error) => void)
            | undefined;

        adapterMocks.connect.mockReturnValueOnce(
            new Promise<MediaStream>((_resolve, reject) => {
                rejectConnect = reject;
            }),
        );

        const { result, unmount } = renderHook(() => useCamera());

        let connectResult: Promise<boolean> | undefined;

        act(() => {
            connectResult = result.current.connect();
        });

        unmount();

        await act(async () => {
            rejectConnect?.(new Error("late failure"));
            await connectResult;
        });

        await expect(connectResult).resolves.toBe(false);
    });

    it("stops and ignores a stream that resolves after unmount", async () => {
        const { stream, track } = createPendingStream();
        let resolveConnect:
            | ((stream: MediaStream) => void)
            | undefined;

        adapterMocks.connect.mockReturnValueOnce(
            new Promise<MediaStream>((resolve) => {
                resolveConnect = resolve;
            }),
        );

        const { result, unmount } = renderHook(() => useCamera());

        let connectResult: Promise<boolean> | undefined;

        act(() => {
            connectResult = result.current.connect();
        });

        unmount();

        await act(async () => {
            resolveConnect?.(stream);
            await connectResult;
        });

        await expect(connectResult).resolves.toBe(false);
        expect(track.stop).toHaveBeenCalledTimes(1);
    });
});
