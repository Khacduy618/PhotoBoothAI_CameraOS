import { boothConfig } from "@/config/booth.config";
import type { CameraAdapter } from "@/types/camera";

export class CaptureCardAdapter
    implements CameraAdapter {
    private stream: MediaStream | null =
        null;

    private activeDeviceId: string | undefined = undefined;

    async connect(
        deviceId?: string,
    ): Promise<MediaStream> {
        console.log("[CaptureCardAdapter] connect() called with deviceId:", deviceId);
        // Return existing active stream if available for the same device
        if (
            this.stream &&
            this.stream.active &&
            this.stream.getVideoTracks().length > 0 &&
            (deviceId === undefined || deviceId === this.activeDeviceId)
        ) {
            console.log("[CaptureCardAdapter] Reusing active stream:", this.stream.id);
            return this.stream;
        }

        this.disconnect();

        const videoConstraints: MediaTrackConstraints | boolean = deviceId
            ? { deviceId: { exact: deviceId } }
            : {
                  width: { ideal: boothConfig.camera.idealWidth },
                  height: { ideal: boothConfig.camera.idealHeight },
                  frameRate: { ideal: boothConfig.camera.idealFrameRate },
                  facingMode: "user",
              };

        try {
            console.log("[CaptureCardAdapter] Calling getUserMedia with constraints:", videoConstraints);
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: videoConstraints,
            });
            this.activeDeviceId = deviceId;
            console.log("[CaptureCardAdapter] getUserMedia SUCCESS. Stream ID:", this.stream.id, "Tracks:", this.stream.getVideoTracks().map(t => ({ label: t.label, readyState: t.readyState })));
            return this.stream;
        } catch (firstErr) {
            console.warn("[CaptureCardAdapter] getUserMedia initial constraints failed:", firstErr);
            try {
                console.log("[CaptureCardAdapter] Attempting fallback getUserMedia({ audio: false, video: true })");
                this.stream = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: true,
                });
                this.activeDeviceId = deviceId;
                console.log("[CaptureCardAdapter] Fallback getUserMedia SUCCESS. Stream ID:", this.stream.id);
                return this.stream;
            } catch (fallbackErr) {
                console.error("[CaptureCardAdapter] Fallback getUserMedia FAILED:", fallbackErr);
                throw firstErr;
            }
        }
    }

    disconnect(): void {
        this.stream
            ?.getTracks()
            .forEach((track) => {
                track.stop();
            });

        this.stream = null;
        this.activeDeviceId = undefined;
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