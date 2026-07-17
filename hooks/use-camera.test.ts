import { describe, expect, it, vi } from "vitest";

import { bindStreamEndedHandlers } from "@/hooks/use-camera";

describe("bindStreamEndedHandlers", () => {
    it("binds ended handlers to video tracks and removes them during cleanup", () => {
        const onEnded = vi.fn();
        const videoTrack = {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        };
        const audioTrack = {
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        };
        const stream = {
            getVideoTracks: vi.fn(() => [videoTrack]),
            getTracks: vi.fn(() => [videoTrack, audioTrack]),
        } as unknown as MediaStream;

        const cleanup = bindStreamEndedHandlers(stream, onEnded);

        expect(stream.getVideoTracks).toHaveBeenCalledTimes(1);
        expect(videoTrack.addEventListener).toHaveBeenCalledWith(
            "ended",
            onEnded,
        );
        expect(audioTrack.addEventListener).not.toHaveBeenCalled();

        cleanup();

        expect(videoTrack.removeEventListener).toHaveBeenCalledWith(
            "ended",
            onEnded,
        );
        expect(audioTrack.removeEventListener).not.toHaveBeenCalled();
    });
});
