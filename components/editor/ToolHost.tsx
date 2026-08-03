"use client";

import React from "react";
import type { BoothSelection, CapturedPhoto } from "@/types/theme";
import type { EditorToolId } from "./EditingToolbar";
import { SummaryPanel } from "./SummaryPanel";
import { DrawingTools } from "./DrawingTools";
import { ThemeSelector } from "@/components/selectors/theme-selector";
import { FrameSelector } from "@/components/selectors/frame-selector";
import { StyleSelector } from "@/components/selectors/style-selector";
import { StickerSelector } from "@/components/selectors/sticker-selector";
import { TextSelector } from "@/components/selectors/text-selector";
import { resolveBoothLayoutConfig } from "@/config/layout.config";
import { resolveFrameConfig } from "@/config/frame.config";

export interface ToolRenderProps {
    selection: BoothSelection;
    updateSelection: (patch: Partial<BoothSelection>) => void;
    capturedPhotos: CapturedPhoto[];
    activePenColor: string | null;
    onSelectPenColor: (color: string | null) => void;
    activePenWidth?: number;
    onSelectPenWidth?: (width: number) => void;
}

export type ToolRenderer = (props: ToolRenderProps) => React.ReactNode;

export const TOOL_RENDERERS: Record<EditorToolId, ToolRenderer> = {
    summary: (props) => <SummaryPanel {...props} />,

    theme: (props) => (
        <ThemeSelector
            value={props.selection.themeId}
            onChange={(themeId) => props.updateSelection({ themeId })}
        />
    ),

    frame: (props) => (
        <FrameSelector
            frameId={props.selection.frameId}
            frameColor={props.selection.frameColor}
            onChangeFrame={(frameId, defaultColor) => {
                const frameConfig = resolveFrameConfig(frameId);
                const patch: Partial<BoothSelection> = { frameId, frameColor: defaultColor };

                const isLandscape = frameConfig.photoViewportOrientation ? frameConfig.photoViewportOrientation === "landscape" : ((frameConfig.outputWidth || 1800) >= (frameConfig.outputHeight || 1200));
                const shotCount = frameConfig.shotCount || 4;

                let layoutId = props.selection.layoutId;
                if (shotCount === 1) layoutId = isLandscape ? "single-landscape-1800x1200" : "single-portrait-1200x1800";
                else if (shotCount === 2) layoutId = isLandscape ? "two-landscape-1x2" : "two-portrait-1x2";
                else if (shotCount === 4) layoutId = isLandscape ? "four-landscape-2x2" : "four-portrait-2x2";
                else if (shotCount === 6) layoutId = isLandscape ? "six-landscape-2x3" : "six-portrait-2x3";
                else if (shotCount === 8) layoutId = isLandscape ? "eight-landscape-2x4" : "eight-portrait-2x4";

                patch.layoutId = layoutId;
                props.updateSelection(patch);
            }}
            onChangeFrameColor={(frameColor) =>
                props.updateSelection({ frameColor })
            }
            compatibleLayout={resolveBoothLayoutConfig(props.selection.layoutId)}
        />
    ),

    filter: (props) => (
        <StyleSelector
            value={props.selection.styleId}
            onChange={(styleId) => props.updateSelection({ styleId })}
        />
    ),

    sticker: (props) => (
        <StickerSelector
            stickerItems={props.selection.customization.stickerItems}
            onAddSticker={(stickerId) => {
                const newId = `sticker-${Date.now()}-${Math.random()}`;
                const newSticker = {
                    id: newId,
                    stickerId,
                    x: 0.5,
                    y: 0.5,
                    scale: 1,
                    rotationDegrees: 0,
                };
                const newOverlay = {
                    id: newId,
                    type: "sticker" as const,
                    content: stickerId,
                    x: 0.5,
                    y: 0.5,
                    baseWidth: 150,
                    baseHeight: 150,
                    scale: 1,
                    rotationRadians: 0,
                    rotationDegrees: 0,
                    zIndex: 600 + (props.selection.customization.overlays || []).filter((o) => o.type === "sticker").length,
                    opacity: 1,
                };
                props.updateSelection({
                    customization: {
                        ...props.selection.customization,
                        stickerItems: [
                            ...props.selection.customization.stickerItems,
                            newSticker,
                        ],
                        overlays: [
                            ...(props.selection.customization.overlays || []),
                            newOverlay,
                        ],
                    },
                });
            }}
            onRemoveSticker={(id) => {
                props.updateSelection({
                    customization: {
                        ...props.selection.customization,
                        stickerItems: props.selection.customization.stickerItems.filter(
                            (s) => s.id !== id,
                        ),
                        overlays: (props.selection.customization.overlays || []).filter(
                            (o) => o.id !== id,
                        ),
                    },
                });
            }}
        />
    ),

    text: (props) => (
        <TextSelector
            textLabels={props.selection.customization.textLabels}
            onAddText={(text) => {
                const newId = `text-${Date.now()}-${Math.random()}`;
                const newText = {
                    id: newId,
                    text,
                    x: 0.5,
                    y: 0.9,
                    color: "#ffffff",
                    fontSize: 48,
                    rotationDegrees: 0,
                };
                const newOverlay = {
                    id: newId,
                    type: "text" as const,
                    content: text,
                    x: 0.5,
                    y: 0.9,
                    baseWidth: 200,
                    baseHeight: 60,
                    scale: 1,
                    rotationRadians: 0,
                    rotationDegrees: 0,
                    zIndex: 700 + (props.selection.customization.overlays || []).filter((o) => o.type === "text").length,
                    opacity: 1,
                    color: "#ffffff",
                    fontSize: 48,
                };
                props.updateSelection({
                    customization: {
                        ...props.selection.customization,
                        textLabels: [
                            ...props.selection.customization.textLabels,
                            newText,
                        ],
                        overlays: [
                            ...(props.selection.customization.overlays || []),
                            newOverlay,
                        ],
                    },
                });
            }}
            onRemoveText={(id) => {
                props.updateSelection({
                    customization: {
                        ...props.selection.customization,
                        textLabels: props.selection.customization.textLabels.filter(
                            (l) => l.id !== id,
                        ),
                        overlays: (props.selection.customization.overlays || []).filter(
                            (o) => o.id !== id,
                        ),
                    },
                });
            }}
        />
    ),

    drawing: (props) => (
        <DrawingTools
            activePenColor={props.activePenColor}
            onSelectPenColor={props.onSelectPenColor}
            activePenWidth={props.activePenWidth}
            onSelectPenWidth={props.onSelectPenWidth}
        />
    ),
};

interface ToolHostProps extends ToolRenderProps {
    activeTool: EditorToolId;
}

export function ToolHost({ activeTool, ...props }: ToolHostProps) {
    const renderer = TOOL_RENDERERS[activeTool] || TOOL_RENDERERS.summary;
    return <div className="space-y-4">{renderer(props)}</div>;
}
