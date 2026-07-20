import React from "react";

export interface WizardStep {
    id: string;
    title: string;
    component: React.ComponentType<any>;
    validate?: (session: any) => boolean;
    canSkip?: boolean;
    isVisible?: (session: any) => boolean;
    next?: (session: any) => string;
}

export class PluginRegistry {
    private static steps: WizardStep[] = [];

    static registerStep(step: WizardStep) {
        if (this.steps.some(s => s.id === step.id)) {
            return;
        }
        this.steps.push(step);
    }

    static getSteps(): WizardStep[] {
        return [...this.steps];
    }

    static getVisibleSteps(session: any): WizardStep[] {
        return this.steps.filter(step => !step.isVisible || step.isVisible(session));
    }

    static getStepById(id: string): WizardStep | undefined {
        return this.steps.find(s => s.id === id);
    }

    static clear() {
        this.steps = [];
    }
}
