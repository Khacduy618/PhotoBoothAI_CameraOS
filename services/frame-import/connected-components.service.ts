import type { RawComponent } from "./frame-import.types";

export function findConnectedComponents(
    mask: Uint8Array,
    width: number,
    height: number,
): RawComponent[] {
    if (mask.length !== width * height) {
        throw new Error("Mask size does not match image dimensions.");
    }

    const visited = new Uint8Array(mask.length);
    const components: RawComponent[] = [];
    const queueX = new Int32Array(mask.length);
    const queueY = new Int32Array(mask.length);
    const directions = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
    ] as const;

    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const startIndex = y * width + x;
            if (mask[startIndex] !== 1 || visited[startIndex] === 1) {
                continue;
            }

            let head = 0;
            let tail = 0;
            queueX[tail] = x;
            queueY[tail] = y;
            tail += 1;
            visited[startIndex] = 1;

            let area = 0;
            let minX = x;
            let minY = y;
            let maxX = x;
            let maxY = y;
            let touchesCanvasEdge = false;

            while (head < tail) {
                const currentX = queueX[head];
                const currentY = queueY[head];
                head += 1;
                area += 1;
                minX = Math.min(minX, currentX);
                minY = Math.min(minY, currentY);
                maxX = Math.max(maxX, currentX);
                maxY = Math.max(maxY, currentY);

                if (
                    currentX === 0 ||
                    currentY === 0 ||
                    currentX === width - 1 ||
                    currentY === height - 1
                ) {
                    touchesCanvasEdge = true;
                }

                for (const [dx, dy] of directions) {
                    const nextX = currentX + dx;
                    const nextY = currentY + dy;
                    if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) {
                        continue;
                    }

                    const nextIndex = nextY * width + nextX;
                    if (mask[nextIndex] === 1 && visited[nextIndex] === 0) {
                        visited[nextIndex] = 1;
                        queueX[tail] = nextX;
                        queueY[tail] = nextY;
                        tail += 1;
                    }
                }
            }

            components.push({
                area,
                minX,
                minY,
                maxX,
                maxY,
                touchesCanvasEdge,
            });
        }
    }

    return components;
}
