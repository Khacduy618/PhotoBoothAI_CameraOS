import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeSelector } from "./theme-selector";
import { FrameSelector } from "./frame-selector";
import { StyleSelector } from "./style-selector";
import { StickerSelector } from "./sticker-selector";
import { TextSelector } from "./text-selector";

describe("Controlled Selectors Unit Tests", () => {
    describe("ThemeSelector", () => {
        it("renders options and calls onChange with selected theme ID", () => {
            const handleChange = vi.fn();
            render(<ThemeSelector value="classic" onChange={handleChange} />);

            expect(screen.getByText("Classic")).toBeTruthy();
            expect(screen.getByText("Party")).toBeTruthy();

            const partyOption = screen.getByText("Party").closest("label");
            if (partyOption) fireEvent.click(partyOption);

            expect(handleChange).toHaveBeenCalledWith("party");
        });
    });

    describe("FrameSelector", () => {
        it("renders frame options and handles frame & color selection", () => {
            const handleFrameChange = vi.fn();
            const handleColorChange = vi.fn();

            render(
                <FrameSelector
                    frameId="white-border"
                    frameColor="#fbcfe8"
                    onChangeFrame={handleFrameChange}
                    onChangeFrameColor={handleColorChange}
                />,
            );

            expect(screen.getByText("Khung trắng")).toBeTruthy();

            const whiteSwatch = screen.getByTitle("Trắng");
            fireEvent.click(whiteSwatch);
            expect(handleColorChange).toHaveBeenCalledWith("#ffffff");
        });
    });

    describe("StyleSelector", () => {
        it("renders filter options and calls onChange with selected style ID", () => {
            const handleChange = vi.fn();
            render(<StyleSelector value="none" onChange={handleChange} />);

            expect(screen.getByText("Warm")).toBeTruthy();

            const warmOption = screen.getByText("Warm").closest("label");
            if (warmOption) fireEvent.click(warmOption);

            expect(handleChange).toHaveBeenCalledWith("warm");
        });
    });

    describe("StickerSelector", () => {
        it("renders sticker list and triggers add/remove callbacks", () => {
            const handleAdd = vi.fn();
            const handleRemove = vi.fn();

            render(
                <StickerSelector
                    stickerItems={[
                        { id: "st-1", stickerId: "party-popper", x: 0.5, y: 0.5, scale: 1, rotationDegrees: 0 },
                    ]}
                    onAddSticker={handleAdd}
                    onRemoveSticker={handleRemove}
                />,
            );

            expect(screen.getByText("1 đã chọn")).toBeTruthy();
            
            const removeBtn = screen.getByTitle("Xóa sticker");
            fireEvent.click(removeBtn);
            expect(handleRemove).toHaveBeenCalledWith("st-1");
        });
    });

    describe("TextSelector", () => {
        it("renders text label list and handles input text addition", () => {
            const handleAdd = vi.fn();
            const handleRemove = vi.fn();

            render(
                <TextSelector
                    textLabels={[
                        { id: "txt-1", text: "HAPPY DAY", x: 0.5, y: 0.9, color: "#fff", fontSize: 48, rotationDegrees: 0 },
                    ]}
                    onAddText={handleAdd}
                    onRemoveText={handleRemove}
                />,
            );

            expect(screen.getByText('1. "HAPPY DAY"')).toBeTruthy();

            const deleteBtn = screen.getByText("Xóa");
            fireEvent.click(deleteBtn);
            expect(handleRemove).toHaveBeenCalledWith("txt-1");
        });
    });
});
