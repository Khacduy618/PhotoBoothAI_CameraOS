"use client";

import { useContext, useEffect } from "react";
import { defaultBoothSelection } from "@/config/theme.config";
import { BoothSessionContext } from "@/components/booth/booth-session-context";
import { EditablePreview } from "@/components/customize/editable-preview";
import type { CameraController } from "@/hooks/use-camera";
import type { BoothSelection } from "@/types/theme";

interface LiveSelectionPreviewProps {
    selection?: BoothSelection;
    camera?: CameraController;
    onSelectionChange?: (selection: BoothSelection) => void;
}

export function LiveSelectionPreview({
    selection: propSelection,
    camera: propCamera,
    onSelectionChange: propOnSelectionChange,
}: LiveSelectionPreviewProps = {}) {
    const context = useContext(BoothSessionContext);
    const selection = propSelection || context?.selection || defaultBoothSelection;
    const camera = propCamera || context?.camera;

    const { stream, status, connect } = camera || {
        stream: null,
        status: "idle",
        connect: () => {},
    };

    // Backup connection effect for test compatibility
    useEffect(() => {
        if (stream || !connect) {
            return;
        }
        void connect();
    }, [connect, stream]);

    return (
        <EditablePreview
            selection={selection}
            stream={stream}
            cameraStatus={status}
            className="w-full h-full"
        />
    );
}
