import type {
    FrameConfig,
    StyleConfig,
    ThemeConfig,
} from "@/types/theme";
import type { RenderConfig } from "@/types/render-config";

export interface RenderPhotoOutputInput {
    original: Blob;
    theme?: ThemeConfig;
    frame?: FrameConfig;
    style?: StyleConfig;
    renderConfig?: RenderConfig;
}

export function getCanvasFilter(style: StyleConfig): string {
    switch (style.mode) {
        case "grayscale":
            return "grayscale(1)";
        case "warm":
            return "sepia(0.25) saturate(1.2)";
        case "cool":
            return "saturate(1.05) hue-rotate(8deg)";
        case "contrast":
            return "contrast(1.18) saturate(1.05)";
        case "none":
        default:
            return "none";
    }
}

export function getOutputMimeType(originalType: string): string {
    if (originalType === "image/png") {
        return "image/png";
    }

    return "image/jpeg";
}

export function createImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };

        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Không thể đọc ảnh gốc để render."));
        };

        image.src = url;
    });
}

export async function renderPhotoOutput({
    original,
    theme: propTheme,
    frame: propFrame,
    style: propStyle,
    renderConfig,
}: RenderPhotoOutputInput): Promise<Blob> {
    const theme = renderConfig?.theme || propTheme;
    const frame = renderConfig?.frame || propFrame;
    const style = renderConfig?.style || propStyle;

    if (!theme || !frame || !style) {
        throw new Error("Thiếu cấu hình theme, frame hoặc style để render.");
    }
    const image = await createImageFromBlob(original);

    const padding = Math.max(frame.borderWidth, 0);
    const captionHeight = 0;
    const canvas = document.createElement("canvas");

    canvas.width = image.naturalWidth + padding * 2;
    canvas.height = image.naturalHeight + padding * 2 + captionHeight;

    const context = canvas.getContext("2d");

    if (!context) {
        throw new Error("Không thể tạo canvas render output.");
    }

    context.fillStyle = theme.backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);

    if (frame.borderWidth > 0) {
        context.fillStyle = frame.borderColor;
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = theme.backgroundColor;
        context.fillRect(
            padding,
            padding,
            image.naturalWidth,
            image.naturalHeight,
        );
    }

    context.save();
    context.filter = getCanvasFilter(style);
    context.drawImage(
        image,
        padding,
        padding,
        image.naturalWidth,
        image.naturalHeight,
    );
    context.restore();

    // Individual cells are clean photos without cell captions
    const mimeType = getOutputMimeType(original.type);

    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error("Không thể render ảnh output."));
                    return;
                }

                resolve(blob);
            },
            mimeType,
            0.94,
        );
    });
}
