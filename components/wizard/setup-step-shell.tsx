"use client";

import React from "react";
import { WizardShell, type WizardStepConfig } from "./wizard-shell";

export interface SetupStepShellProps {
    steps: WizardStepConfig[];
    activeStep: string;
    onStepChange: (stepId: string) => void;
    onFirstStepBack?: () => void;
    onComplete: () => void;
    completeLabel?: string;
    canContinue?: boolean;
    headerSlot?: React.ReactNode;
    previewSlot?: React.ReactNode;
    children: React.ReactNode;
}

/**
 * SetupStepShell — the single shared 2-column shell component for all PhotoBooth setup steps (1-8).
 * Guarantees identical layout shell, width ratios (1.35fr : 0.65fr), fixed height bounds,
 * and zero document-level page scrolling across all steps.
 */
export function SetupStepShell({
    steps,
    activeStep,
    onStepChange,
    onFirstStepBack,
    onComplete,
    completeLabel = "Tiếp tục vào camera",
    canContinue = true,
    headerSlot,
    previewSlot,
    children,
}: SetupStepShellProps) {
    return (
        <WizardShell
            steps={steps}
            activeStep={activeStep}
            onStepChange={onStepChange}
            onFirstStepBack={onFirstStepBack}
            onComplete={onComplete}
            completeLabel={completeLabel}
            canContinue={canContinue}
            headerSlot={headerSlot}
            previewSlot={previewSlot}
        >
            {children}
        </WizardShell>
    );
}
