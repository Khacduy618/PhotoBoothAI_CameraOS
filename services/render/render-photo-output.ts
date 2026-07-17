import type {
    FrameConfig,
    StyleConfig,
    ThemeConfig,
} from "@/types/theme";

export interface RenderPhotoOutputInput {
    original: Blob;
    theme: ThemeConfig;
    frame: FrameConfig;
    style: StyleConfig;
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
    theme,
    frame,
    style,
}: RenderPhotoOutputInput): Promise<Blob> {
    const image = await createImageFromBlob(original);

    const padding = Math.max(frame.borderWidth, 0);
    const captionHeight = frame.id === "none" ? 0 : 72;
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

    if (captionHeight > 0) {
        context.fillStyle = theme.backgroundColor;
        context.fillRect(
            padding,
            padding + image.naturalHeight,
            image.naturalWidth,
            captionHeight,
        );
        context.fillStyle = theme.textColor;
        context.font = "28px sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(
            frame.name,
            canvas.width / 2,
            padding + image.naturalHeight + captionHeight / 2,
        );
    }

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
