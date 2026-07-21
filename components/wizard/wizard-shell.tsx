"use client";

import React from "react";

export interface WizardStepConfig {
    id: string;
    title: string;
    shortLabel: string;
}

interface WizardShellProps {
    /** All steps in this wizard instance */
    steps: WizardStepConfig[];
    /** Currently active step ID */
    activeStep: string;
    onStepChange: (stepId: string) => void;
    /** Children receive the current active step ID so they can show/hide panels */
    children: React.ReactNode;
    /** Called when Back is clicked on the first step */
    onFirstStepBack?: () => void;
    /** Called when Continue/Complete is clicked on the last step */
    onComplete: () => void;
    /** Label for the final action button */
    completeLabel?: string;
    /** Whether the Continue / Complete button is enabled */
    canContinue?: boolean;
    /** Optional header slot (e.g. logo, title, wallpaper picker) */
    headerSlot?: React.ReactNode;
    /** Optional left-column slot (e.g. live preview, camera) */
    previewSlot?: React.ReactNode;
}

/**
 * WizardShell — the shared step-navigation shell for:
 *   - BoothSelectionFlow (Setup Wizard)
 *   - CustomizeFlow (Customize Wizard)
 *
 * Both consume the same shell with a different `steps` config array.
 * The content panels are rendered as children; each panel hides itself
 * based on `activeStep` using `className={activeStep === id ? '' : 'hidden'}`.
 */
export function WizardShell({
    steps,
    activeStep,
    onStepChange,
    children,
    onFirstStepBack,
    onComplete,
    completeLabel = "Hoàn tất",
    canContinue = true,
    headerSlot,
    previewSlot,
}: WizardShellProps) {
    const currentIndex = steps.findIndex((s) => s.id === activeStep);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const isFirst = safeIndex === 0;
    const isLast = safeIndex === steps.length - 1;
    const currentStepConfig = steps[safeIndex];

    const handleBack = () => {
        if (isFirst) {
            onFirstStepBack?.();
        } else {
            onStepChange(steps[safeIndex - 1].id);
        }
    };

    const handleNext = () => {
        if (isLast) {
            onComplete();
        } else {
            onStepChange(steps[safeIndex + 1].id);
        }
    };

    return (
        <section className="w-full h-[calc(100vh-3rem)] max-h-[calc(100vh-3rem)] flex flex-col justify-between  p-5 text-neutral-900 relative">
            {headerSlot && (
                <header className="shrink-0 mb-2">
                    {headerSlot}
                </header>
            )}
            
            {/* Main grid: preview left, options right */}
            <div className="flex-1 min-h-0 grid lg:grid-cols-[1.35fr_0.65fr] gap-5 py-3 overflow-hidden">
                {/* Left — Live Preview or Camera */}
                <div className="flex flex-col items-center justify-center bg-white/40 backdrop-blur-xl rounded-3xl p-4 overflow-hidden border border-white/70 shadow-lg h-full relative group">
                    <div className="absolute inset-0 bg-pink-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-3xl blur-3xl" />
                    {previewSlot}
                </div>

                {/* Right — Options sidebar */}
                <div className="flex flex-col h-full min-h-0 justify-between bg-white/60 backdrop-blur-xl rounded-3xl p-5 border border-white/80 shadow-xl relative">
                    <div className="flex-1 overflow-y-auto pr-1 space-y-5">
                        {/* Step title */}
                        <h2 className="text-lg font-black tracking-tight text-pink-950 border-b border-pink-200/50 pb-2">
                            {currentStepConfig?.title}
                        </h2>
                        {children}
                    </div>

                    {/* Navigation buttons */}
                    <div className="flex items-center gap-3 border-t border-pink-200/50 pt-4 mt-3 shrink-0">
                        {!isFirst && (
                            <button
                                type="button"
                                onClick={handleBack}
                                className="flex-1 rounded-2xl border border-pink-200/70 bg-white/70 px-4 py-3 font-extrabold text-pink-900 hover:bg-white active:scale-95 transition-all text-xs md:text-sm shadow-sm"
                            >
                                ← Quay lại
                            </button>
                        )}
                        {onFirstStepBack && isFirst && (
                            <button
                                type="button"
                                onClick={handleBack}
                                className="flex-1 rounded-2xl border border-pink-200/70 bg-white/70 px-4 py-3 font-extrabold text-pink-900 hover:bg-white active:scale-95 transition-all text-xs md:text-sm shadow-sm"
                            >
                                ← Quay lại
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleNext}
                            className={`flex-1 rounded-2xl px-4 py-3 font-extrabold bg-gradient-to-r from-pink-500 via-rose-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white active:scale-95 transition-all text-xs md:text-sm shadow-lg shadow-pink-400/40 ${
                                isLast ? "hidden" : "block"
                            }`}
                        >
                            Tiếp tục
                        </button>

                        <button
                            type="button"
                            onClick={onComplete}
                            disabled={!canContinue}
                            className={`flex-1 rounded-2xl px-4 py-3 font-extrabold bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white active:scale-95 transition-all text-xs md:text-sm shadow-lg shadow-emerald-400/40 disabled:opacity-50 ${
                                isLast ? "block" : "hidden"
                            }`}
                        >
                            {completeLabel}
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}
