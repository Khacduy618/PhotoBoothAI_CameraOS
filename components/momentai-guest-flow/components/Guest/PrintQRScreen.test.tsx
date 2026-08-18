import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { PrintQRScreen } from "./PrintQRScreen";
import type { PrinterSettings, SessionData } from "../../types";

const printerSettings: PrinterSettings = {
    connected: true,
    model: "Fake Print Queue",
    currentPaper: "4x6",
    paperRemaining: 20,
    paperTotal: 50,
    autoPrint: false,
    copiesDefault: 1,
    status: "READY",
};

function makeSession(overrides: Partial<SessionData> = {}): SessionData {
    return {
        sessionId: "sess_result_1",
        createdAt: "12:00:00",
        captureCount: 1,
        photos: [],
        selectedFrame: {
            id: "tpl_1",
            name: "Template 1",
            thumbnail: "",
            category: "classic",
            layout: { type: "1x1", slotCount: 1 },
            slots: [{ id: 1, x: 0, y: 0, width: 100, height: 100 }],
            assets: { background: "#fff" },
            supportedPapers: ["4x6"],
            preferredPaper: "4x6",
        },
        slotAssignments: [],
        outputs: {
            share: "data:image/jpeg;base64,share",
            print: "data:image/jpeg;base64,print",
        },
        qr: {
            status: "ready",
            url: "http://192.168.1.25:3789/s/sess_result_1?token=test",
        },
        selectedPrintQuantity: 1,
        printStatus: "idle",
        copiesPrinted: 0,
        ...overrides,
    };
}

describe("PrintQRScreen", () => {
    afterEach(() => cleanup());

    it("does not request print on mount and prints only after guest confirmation", () => {
        const onConfirmPrint = vi.fn();
        render(
            <PrintQRScreen
                session={makeSession()}
                printerSettings={printerSettings}
                onConfirmPrint={onConfirmPrint}
                onFinishSession={() => undefined}
            />,
        );

        expect(onConfirmPrint).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: /XÁC NHẬN IN ẢNH/i }));
        expect(onConfirmPrint).toHaveBeenCalledTimes(1);
    });

    it("shows QR fallback when local QR is unavailable", () => {
        render(
            <PrintQRScreen
                session={makeSession({ qr: { status: "unavailable" } })}
                printerSettings={printerSettings}
                onConfirmPrint={() => undefined}
                onFinishSession={() => undefined}
            />,
        );

        expect(screen.getByText("Mã QR đang chuẩn bị")).toBeDefined();
        expect(screen.getByText(/Ảnh đã được lưu an toàn/i)).toBeDefined();
    });

    it("does not show success styling or allow duplicate requests while queued", () => {
        const onConfirmPrint = vi.fn();
        render(
            <PrintQRScreen
                session={makeSession({ printStatus: "queued" })}
                printerSettings={printerSettings}
                onConfirmPrint={onConfirmPrint}
                onFinishSession={() => undefined}
            />,
        );

        expect(screen.getByText("Đang in lượt 1/1")).toBeDefined();
        const printButton = screen.getByRole("button", { name: /ĐANG XỬ LÝ IN/i });
        expect(printButton).toHaveProperty("disabled", true);
        fireEvent.click(printButton);
        expect(onConfirmPrint).not.toHaveBeenCalled();
    });

    it("allows retry after failed print without hiding the QR/result", () => {
        const onConfirmPrint = vi.fn();
        render(
            <PrintQRScreen
                session={makeSession({ printStatus: "failed" })}
                printerSettings={printerSettings}
                onConfirmPrint={onConfirmPrint}
                onFinishSession={() => undefined}
            />,
        );

        expect(screen.getAllByText(/MÁY IN ĐANG CẦN HỖ TRỢ/i).length).toBeGreaterThan(0);
        expect(screen.getByText("Quét mã QR để tải ảnh số")).toBeDefined();
        fireEvent.click(screen.getByRole("button", { name: /THỬ IN LẠI/i }));
        expect(onConfirmPrint).toHaveBeenCalledTimes(1);
    });
});
