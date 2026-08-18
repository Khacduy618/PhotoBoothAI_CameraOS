import React from "react";
import { FrameImportPanel } from "@/components/frame-import/FrameImportPanel";

export const metadata = {
    title: "Canva Frame Import Tool | Operator",
    description: "Operator tool to analyze and publish Canva frame overlays to PhotoBoothAI CameraOS",
};

export default function FrameImportOperatorPage() {
    return (
        <main className="min-h-screen bg-neutral-100/60 py-8">
            <FrameImportPanel />
        </main>
    );
}
