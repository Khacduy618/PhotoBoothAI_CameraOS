import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SelectProductScreen } from "./SelectProductScreen";
import { GUEST_PRODUCTS } from "@/types/guest-product";

describe("SelectProductScreen", () => {
  afterEach(() => cleanup());

  it("renders all 5 product choices and 3 groups correctly", () => {
    const onSelectProduct = vi.fn();
    const onBack = vi.fn();

    render(
      <SelectProductScreen
        defaultProductId="STRIP_4"
        onSelectProduct={onSelectProduct}
        onBackToStart={onBack}
      />
    );

    expect(screen.getByText(/CHỌN LOẠI ẢNH BẠN MUỐN IN/i)).toBeDefined();
    expect(screen.getByRole("heading", { name: /Premium Postcard/i })).toBeDefined();
    expect(screen.getByRole("heading", { name: /Photo Strip 2 Ô/i })).toBeDefined();
    expect(screen.getByRole("heading", { name: /Photo Strip 4 Ô/i })).toBeDefined();
    expect(screen.getByRole("heading", { name: /Photo Sheet 4 Ô/i })).toBeDefined();
    expect(screen.getByRole("heading", { name: /Photo Sheet 6 Ô/i })).toBeDefined();
  });

  it("selects PREMIUM_POSTCARD product and triggers callback with correct 3 shots config", () => {
    const onSelectProduct = vi.fn();
    const onBack = vi.fn();

    render(
      <SelectProductScreen
        onSelectProduct={onSelectProduct}
        onBackToStart={onBack}
      />
    );

    fireEvent.click(screen.getByRole("heading", { name: /Premium Postcard/i }));
    fireEvent.click(screen.getByText(/TIẾP TỤC/i));

    expect(onSelectProduct).toHaveBeenCalledTimes(1);
    expect(onSelectProduct).toHaveBeenCalledWith(GUEST_PRODUCTS.PREMIUM_POSTCARD);
    expect(GUEST_PRODUCTS.PREMIUM_POSTCARD.requiredShots).toBe(3);
    expect(GUEST_PRODUCTS.PREMIUM_POSTCARD.price).toBe(70000);
    expect(GUEST_PRODUCTS.PREMIUM_POSTCARD.premium).toBe(true);
  });

  it("selects SHEET_4 product and passes 80k price config", () => {
    const onSelectProduct = vi.fn();
    const onBack = vi.fn();

    render(
      <SelectProductScreen
        onSelectProduct={onSelectProduct}
        onBackToStart={onBack}
      />
    );

    fireEvent.click(screen.getByRole("heading", { name: /Photo Sheet 4 Ô/i }));
    fireEvent.click(screen.getByText(/TIẾP TỤC/i));

    expect(onSelectProduct).toHaveBeenCalledTimes(1);
    expect(onSelectProduct).toHaveBeenCalledWith(GUEST_PRODUCTS.SHEET_4);
    expect(GUEST_PRODUCTS.SHEET_4.price).toBe(80000);
    expect(GUEST_PRODUCTS.SHEET_4.printSheets).toBe(1);
  });
});
