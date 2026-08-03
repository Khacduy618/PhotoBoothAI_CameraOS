export interface LogicalSheet {
    width: number;
    height: number;
}

export const LOGICAL_SHEET_DEFAULT: LogicalSheet = {
    width: 1000,
    height: 1500,
};

export interface NormalizedPoint {
    x: number;
    y: number;
}

export interface LogicalPoint {
    x: number;
    y: number;
}

export interface SurfacePoint {
    x: number;
    y: number;
}

export class LogicalCoordinateService {
    public static validateAspectRatio(
        outputWidth: number,
        outputHeight: number,
        sheet: LogicalSheet = LOGICAL_SHEET_DEFAULT,
        tolerance = 0.001
    ): number {
        const scaleX = outputWidth / sheet.width;
        const scaleY = outputHeight / sheet.height;
        if (Math.abs(scaleX - scaleY) > tolerance) {
            // Non-uniform aspect warning
        }
        return scaleX;
    }

    public static normalizedToLogical(
        point: NormalizedPoint,
        sheet: LogicalSheet = LOGICAL_SHEET_DEFAULT
    ): LogicalPoint {
        return {
            x: point.x * sheet.width,
            y: point.y * sheet.height,
        };
    }

    public static logicalToSurface(
        point: LogicalPoint,
        scale: number
    ): SurfacePoint {
        return {
            x: point.x * scale,
            y: point.y * scale,
        };
    }

    public static normalizedToSurface(
        point: NormalizedPoint,
        surfaceWidth: number,
        surfaceHeight: number
    ): SurfacePoint {
        return {
            x: point.x * surfaceWidth,
            y: point.y * surfaceHeight,
        };
    }
}
