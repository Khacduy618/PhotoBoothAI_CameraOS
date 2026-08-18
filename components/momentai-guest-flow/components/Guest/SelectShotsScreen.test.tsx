import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SelectShotsScreen } from "./SelectShotsScreen";

describe("SelectShotsScreen enabled formats", () => {
  afterEach(() => cleanup());

  it("renders only event-enabled shot formats and stores selected count", () => {
    const onSelectShots = vi.fn();
    render(
      <SelectShotsScreen
        enabledShotCounts={[1, 2]}
        onSelectShots={onSelectShots}
        onBackToStart={() => undefined}
      />,
    );

    expect(screen.getByText("1 SHOT")).toBeDefined();
    expect(screen.getByText("2 SHOTS")).toBeDefined();
    expect(screen.queryByText("4 SHOTS")).toBeNull();
    expect(screen.queryByText("6 SHOTS")).toBeNull();

    fireEvent.click(screen.getByText("2 SHOTS"));
    fireEvent.click(screen.getByRole("button", { name: /TIẾP TỤC/i }));
    expect(onSelectShots).toHaveBeenCalledWith(2);
  });

  it("keeps Continue unavailable until an enabled format is selected", () => {
    const onSelectShots = vi.fn();
    render(<SelectShotsScreen enabledShotCounts={[4]} onSelectShots={onSelectShots} />);

    fireEvent.click(screen.getByRole("button", { name: /TIẾP TỤC/i }));
    expect(onSelectShots).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("4 SHOTS"));
    fireEvent.click(screen.getByRole("button", { name: /TIẾP TỤC/i }));
    expect(onSelectShots).toHaveBeenCalledWith(4);
  });
});
