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
            onChangeFrame={(frameId, defaultColor) =>
                props.updateSelection({ frameId, frameColor: defaultColor })
            }
            onChangeFrameColor={(frameColor) =>
                props.updateSelection({ frameColor })
            }
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
                const newSticker = {
                    id: `sticker-${Date.now()}-${Math.random()}`,
                    stickerId,
                    x: 0.5,
                    y: 0.5,
                    scale: 1,
                    rotationDegrees: 0,
                };
                props.updateSelection({
                    customization: {
                        ...props.selection.customization,
                        stickerItems: [
                            ...props.selection.customization.stickerItems,
                            newSticker,
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
                    },
                });
            }}
        />
    ),

    text: (props) => (
        <TextSelector
            textLabels={props.selection.customization.textLabels}
            onAddText={(text) => {
                const newText = {
                    id: `text-${Date.now()}-${Math.random()}`,
                    text,
                    x: 0.5,
                    y: 0.9,
                    color: "#ffffff",
                    fontSize: 48,
                    rotationDegrees: 0,
                };
                props.updateSelection({
                    customization: {
                        ...props.selection.customization,
                        textLabels: [
                            ...props.selection.customization.textLabels,
                            newText,
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
