import { describe, expect, it } from "vitest";

import { generatePhotoQrCode } from "@/services/sharing/qr-generator.service";
import {
    createSharePath,
    createShareUrl,
} from "@/services/sharing/share-url.service";

describe("share URL service", () => {
    it("creates safe local share paths without local filesystem paths", () => {
        expect(createSharePath("photo-1")).toBe(
            "/share/photo-1",
        );

        expect(
            createShareUrl({ photoId: "photo-1" }),
        ).toEqual({
            photoId: "photo-1",
            path: "/share/photo-1",
            url: "/share/photo-1",
        });
    });

    it("creates http share URLs when an origin is provided", () => {
        expect(
            createShareUrl({
                photoId: "photo-2",
                origin: "https://booth.local:3000",
            }),
        ).toEqual({
            photoId: "photo-2",
            path: "/share/photo-2",
            url: "https://booth.local:3000/share/photo-2",
        });
    });

    it("rejects unsafe path-like photo ids", () => {
        expect(() => createSharePath("../secret")).toThrow(
            "unsafe path",
        );
        expect(() => createSharePath("folder/photo")).toThrow(
            "unsafe path",
        );
    });

    it("rejects non-http origins", () => {
        expect(() =>
            createShareUrl({
                photoId: "photo-3",
                origin: "file:///tmp/photo.jpg",
            }),
        ).toThrow("http or https");
    });
});

describe("generatePhotoQrCode", () => {
    it("generates a scannable QR data URL for the saved photo share route", async () => {
        const startedAt = performance.now();
        const qr = await generatePhotoQrCode({
            photoId: "photo-4",
            origin: "https://booth.local",
        });
        const elapsedMs = performance.now() - startedAt;

        expect(qr).toMatchObject({
            photoId: "photo-4",
            shareUrl: "https://booth.local/share/photo-4",
            sharePath: "/share/photo-4",
            size: 320,
            margin: 4,
        });
        expect(qr.dataUrl).toMatch(
            /^data:image\/png;base64,/,
        );
        expect(elapsedMs).toBeLessThan(1000);
    });
});
