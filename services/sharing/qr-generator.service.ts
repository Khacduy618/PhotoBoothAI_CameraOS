import QRCode from "qrcode";

import {
    createShareUrl,
    type ShareUrlInput,
} from "@/services/sharing/share-url.service";

export interface GeneratePhotoQrInput extends ShareUrlInput {
    size?: number;
    margin?: number;
}

export interface PhotoQrCode {
    photoId: string;
    shareUrl: string;
    sharePath: string;
    dataUrl: string;
    size: number;
    margin: number;
}

export async function generatePhotoQrCode({
    photoId,
    origin,
    size = 320,
    margin = 4,
}: GeneratePhotoQrInput): Promise<PhotoQrCode> {
    const share = createShareUrl({ photoId, origin });

    const dataUrl = await QRCode.toDataURL(share.url, {
        errorCorrectionLevel: "M",
        margin,
        scale: 8,
        width: size,
        color: {
            dark: "#000000",
            light: "#ffffff",
        },
    });

    return {
        photoId,
        shareUrl: share.url,
        sharePath: share.path,
        dataUrl,
        size,
        margin,
    };
}
