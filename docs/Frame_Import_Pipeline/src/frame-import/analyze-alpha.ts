export function buildAlphaMask(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  alphaThreshold = 16,
): Uint8Array {
  if (rgba.length !== width * height * 4) {
    throw new Error("RGBA buffer size does not match image dimensions.");
  }

  const mask = new Uint8Array(width * height);

  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
    const alpha = rgba[pixelIndex * 4 + 3];
    mask[pixelIndex] = alpha <= alphaThreshold ? 1 : 0;
  }

  return mask;
}
