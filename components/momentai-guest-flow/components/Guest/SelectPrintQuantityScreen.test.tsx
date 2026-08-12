import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SelectPrintQuantityScreen } from "./SelectPrintQuantityScreen";

describe("SelectPrintQuantityScreen", () => {
    afterEach(() => cleanup());
    it("renders two quick print choices and the quantity stepper", () => {
        render(
            <SelectPrintQuantityScreen
                shotCount={4}
                defaultQuantity={1}
                onConfirmPrintQuantity={() => undefined}
                onBackToShots={() => undefined}
            />,
        );

        expect(screen.getByText("1 TẤM IN")).toBeDefined();
        expect(screen.getByText("2 TẤM IN")).toBeDefined();
        expect(screen.queryByText("3 TẤM IN")).toBeNull();
        expect(screen.getByText(/tinh chỉnh thêm số lượng/i)).toBeDefined();
        expect(screen.getByText("Tổng tiền")).toBeDefined();
        expect(screen.getAllByText("50.000đ").length).toBeGreaterThan(0);
        expect(screen.getByRole("button", { name: /Giảm số lượng in/i })).toBeDefined();
        expect(screen.getByRole("button", { name: /Tăng số lượng in/i })).toBeDefined();
    });

    it("confirms quick selections and stepper-adjusted quantities", () => {
        const onConfirm = vi.fn();
        render(
            <SelectPrintQuantityScreen
                shotCount={2}
                defaultQuantity={9}
                onConfirmPrintQuantity={onConfirm}
                onBackToShots={() => undefined}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: /TIẾP TỤC/i }));
        expect(onConfirm).toHaveBeenCalledWith(5);

        fireEvent.click(screen.getByText("2 TẤM IN"));
        expect(screen.getAllByText("70.000đ").length).toBeGreaterThan(0);
        fireEvent.click(screen.getByRole("button", { name: /TIẾP TỤC/i }));
        expect(onConfirm).toHaveBeenLastCalledWith(2);

        fireEvent.click(screen.getByRole("button", { name: /Tăng số lượng in/i }));
        expect(screen.getByText("110.000đ")).toBeDefined();
        fireEvent.click(screen.getByRole("button", { name: /TIẾP TỤC/i }));
        expect(onConfirm).toHaveBeenLastCalledWith(3);
    });
});
