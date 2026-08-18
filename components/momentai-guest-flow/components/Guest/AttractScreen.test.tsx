import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { AttractScreen } from "./AttractScreen";

const eventConfig = {
  eventName: "PHỐ CỔ HỘI AN",
  eventDate: "2026-08-11",
  hostName: "MomentAI",
  primaryColor: "#f59e0b",
  accentColor: "#f43f5e",
  theme: "light" as const,
  customTagline: "TIỆM ẢNH DI SẢN",
};

describe("AttractScreen readiness gate", () => {
  afterEach(() => cleanup());

  it("disables Start when there is no active event", () => {
    const onStart = vi.fn();
    render(
      <AttractScreen
        eventConfig={eventConfig}
        onStartSession={onStart}
        readinessStatus="BLOCKED"
        readinessReasons={["NO_ACTIVE_EVENT"]}
      />,
    );

    fireEvent.click(screen.getByText(/TẠM DỪNG BẮT ĐẦU/i));
    expect(onStart).not.toHaveBeenCalled();
    expect(screen.getByText(/Booth đang cần hỗ trợ/i)).toBeDefined();
    expect(screen.getByText(/Operator: NO_ACTIVE_EVENT/i)).toBeDefined();
  });

  it("disables Start when health is blocked", () => {
    const onStart = vi.fn();
    render(
      <AttractScreen
        eventConfig={eventConfig}
        onStartSession={onStart}
        readinessStatus="BLOCKED"
        readinessReasons={["STORAGE_BLOCKED"]}
      />,
    );

    fireEvent.click(screen.getByText(/TẠM DỪNG BẮT ĐẦU/i));
    expect(onStart).not.toHaveBeenCalled();
    expect(screen.getByText(/Operator: STORAGE_BLOCKED/i)).toBeDefined();
  });

  it("allows Start when readiness is ready", () => {
    const onStart = vi.fn();
    render(<AttractScreen eventConfig={eventConfig} onStartSession={onStart} readinessStatus="READY" />);

    fireEvent.click(screen.getByText(/CHẠM ĐỂ CHỤP ẢNH/i));
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
