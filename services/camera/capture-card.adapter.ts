import { boothConfig } from "@/config/booth.config";
import type { CameraAdapter } from "@/types/camera";

export class CaptureCardAdapter
    implements CameraAdapter {
    private stream: MediaStream | null =
        null;

    async connect(
        deviceId?: string,
    ): Promise<MediaStream> {
        this.disconnect();

        this.stream =
            await navigator.mediaDevices.getUserMedia(
                {
                    audio: false,

                    video: {
                        deviceId: deviceId
                            ? {
                                exact: deviceId,
                            }
                            : undefined,

                        width: {
                            ideal:
                                boothConfig.camera
                                    .idealWidth,
                        },

                        height: {
                            ideal:
                                boothConfig.camera
                                    .idealHeight,
                        },

                        frameRate: {
                            ideal:
                                boothConfig.camera
                                    .idealFrameRate,
                        },
                    },
                },
            );

        return this.stream;
    }

    disconnect(): void {
        this.stream
            ?.getTracks()
            .forEach((track) => {
                track.stop();
            });

        this.stream = null;
    }

    getStream(): MediaStream | null {
        return this.stream;
    }

    async capture(
        video: HTMLVideoElement,
    ): Promise<Blob> {
        if (
            !video.videoWidth ||
            !video.videoHeight
        ) {
            throw new Error(
                "Video stream chưa sẵn sàng.",
            );
        }

        const canvas =
            document.createElement("canvas");

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const context =
            canvas.getContext("2d");

        if (!context) {
            throw new Error(
                "Không thể tạo canvas context.",
            );
        }

        context.translate(
            canvas.width,
            0,
        );

        context.scale(-1, 1);

        context.drawImage(
            video,
            0,
            0,
            canvas.width,
            canvas.height,
        );

        return new Promise<Blob>(
            (resolve, reject) => {
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(
                                new Error(
                                    "Không thể tạo ảnh từ camera.",
                                ),
                            );

                            return;
                        }

                        resolve(blob);
                    },
                    "image/jpeg",
                    0.94,
                );
            },
        );
    }
}