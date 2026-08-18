export type CameraStatus =
    | "idle"
    | "requesting-permission"
    | "connecting"
    | "initializing"
    | "ready"
    | "disconnected"
    | "error";

export interface CameraDevice {
    deviceId: string;
    label: string;
}

export interface CameraCapabilities {
    iso?: readonly number[];
    aperture?: readonly number[];
    shutterSpeed?: readonly string[];
    whiteBalance?: readonly string[];
}

export interface CameraAdapter {
    connect(deviceId?: string): Promise<MediaStream>;

    disconnect(): void;

    getStream(): MediaStream | null;

    capture(video: HTMLVideoElement): Promise<Blob>;

    getCapabilities?(): Promise<CameraCapabilities>;

    setISO?(value: number): Promise<void>;

    setAperture?(value: number): Promise<void>;

    setShutterSpeed?(value: string): Promise<void>;

    setWhiteBalance?(value: string): Promise<void>;
}