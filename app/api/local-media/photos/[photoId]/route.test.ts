import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { readLocalPhotoFile } = vi.hoisted(() => ({
    readLocalPhotoFile: vi.fn(),
}));

vi.mock("@/services/storage/server/local-media-store", () => ({
    readLocalPhotoFile,
}));

import { GET } from "./route";

describe("local media photo route", () => {
    beforeEach(() => {
        readLocalPhotoFile.mockReset();
        vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns a generic client error when file read fails without exposing local paths", async () => {
        readLocalPhotoFile.mockRejectedValue(
            new Error("ENOENT: no such file or directory, open '/private/tmp/.cameraos-data/sessions/session_1/originals/photo_1.jpg'"),
        );

        const response = await GET(new Request("http://localhost/api/local-media/photos/photo_1"), {
            params: Promise.resolve({ photoId: "photo_1" }),
        });
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toEqual({ ok: false, error: "Unable to read local media." });
        expect(JSON.stringify(body)).not.toContain(".cameraos-data");
        expect(JSON.stringify(body)).not.toContain("/private/tmp");
    });
});
