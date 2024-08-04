import { createCanvas, loadImage } from "canvas";

// Common utility functions can go here
export function formatMessage(message) {
  // Implement message formatting logic here
  return message;
}
export async function findColorPixel(imagePath, targetColor) {
  const hexToRgb = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  };

  const { r: targetR, g: targetG, b: targetB } = hexToRgb(targetColor);
  const image = await loadImage(imagePath);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(image, 0, 0, image.width, image.height);
  const imageData = ctx.getImageData(0, 0, image.width, image.height);
  const data = imageData.data;
  const tolerance = 10;

  const isColorMatch = (r, g, b) =>
    Math.abs(r - targetR) <= tolerance &&
    Math.abs(g - targetG) <= tolerance &&
    Math.abs(b - targetB) <= tolerance;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const x = (i / 4) % image.width;
    const y = Math.floor(i / 4 / image.width);

    if (isColorMatch(r, g, b)) {
      return { x, y };
    }
  }

  return null;
}
