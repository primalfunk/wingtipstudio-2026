import { CanvasTexture, Color, SRGBColorSpace, Texture, UVMapping, Vector2 } from "three";
import { createSeededRng, SeededRng } from "../utils/seededRng";

type PatternKind =
  | "stripes"
  | "verticalStripes"
  | "polkaDots"
  | "stars"
  | "halfAndHalf"
  | "quartered"
  | "chevrons"
  | "rings"
  | "checker"
  | "lightning"
  | "sunburst"
  | "confetti";

export interface MarblePattern {
  baseColor: Color;
  previewUrl: string;
  texture: Texture;
}

const patternKinds: PatternKind[] = [
  "stripes",
  "verticalStripes",
  "polkaDots",
  "stars",
  "halfAndHalf",
  "quartered",
  "chevrons",
  "rings",
  "checker",
  "lightning",
  "sunburst",
  "confetti",
];

export function createMarblePattern(seed: string, index: number): MarblePattern {
  const rng = createSeededRng(`${seed}:marble-pattern:${index}`);
  const kind = patternKinds[index % patternKinds.length];
  const palette = createPalette(rng);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not create marble texture context");
  }

  context.fillStyle = palette.base;
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (kind === "stripes") {
    drawDiagonalStripes(context, palette);
  } else if (kind === "verticalStripes") {
    drawVerticalStripes(context, palette);
  } else if (kind === "polkaDots") {
    drawPolkaDots(context, palette);
  } else if (kind === "stars") {
    drawStars(context, palette);
  } else if (kind === "halfAndHalf") {
    drawHalfAndHalf(context, palette);
  } else if (kind === "quartered") {
    drawQuartered(context, palette);
  } else if (kind === "chevrons") {
    drawChevrons(context, palette);
  } else if (kind === "rings") {
    drawRings(context, palette);
  } else if (kind === "checker") {
    drawChecker(context, palette);
  } else if (kind === "lightning") {
    drawLightning(context, palette);
  } else if (kind === "sunburst") {
    drawSunburst(context, palette);
  } else {
    drawConfetti(context, palette, rng);
  }

  addEquatorBand(context, palette);
  addSubtleNoise(context, rng);

  const texture = new CanvasTexture(canvas, UVMapping);
  texture.colorSpace = SRGBColorSpace;
  texture.repeat = new Vector2(1, 1);
  texture.needsUpdate = true;

  return {
    baseColor: new Color(palette.base),
    previewUrl: createPreviewUrl(canvas),
    texture,
  };
}

function createPreviewUrl(source: HTMLCanvasElement): string {
  const preview = document.createElement("canvas");
  preview.width = 96;
  preview.height = 96;
  const context = preview.getContext("2d");

  if (!context) {
    return source.toDataURL();
  }

  context.save();
  context.beginPath();
  context.arc(48, 48, 46, 0, Math.PI * 2);
  context.clip();
  context.drawImage(source, 0, 0, 96, 96);
  context.fillStyle = "rgba(255,255,255,0.22)";
  context.beginPath();
  context.ellipse(34, 28, 18, 9, -0.45, 0, Math.PI * 2);
  context.fill();
  context.restore();
  context.strokeStyle = "rgba(255,255,255,0.58)";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(48, 48, 45, 0, Math.PI * 2);
  context.stroke();

  return preview.toDataURL();
}

function createPalette(rng: SeededRng): { base: string; accent: string; secondary: string; light: string; dark: string } {
  const hue = rng.next();
  const accentHue = (hue + rng.nextBetween(0.28, 0.54)) % 1;
  const secondaryHue = (hue + rng.nextBetween(0.08, 0.2)) % 1;

  return {
    base: hsl(hue, 66, 48),
    accent: hsl(accentHue, 78, 58),
    secondary: hsl(secondaryHue, 72, 38),
    light: hsl(hue, 84, 78),
    dark: hsl(hue, 58, 22),
  };
}

function drawDiagonalStripes(context: CanvasRenderingContext2D, palette: ReturnType<typeof createPalette>): void {
  context.save();
  context.translate(-256, 0);
  context.rotate(-Math.PI / 8);
  for (let x = -128; x < 900; x += 64) {
    context.fillStyle = palette.accent;
    context.fillRect(x, -120, 28, 560);
    context.fillStyle = palette.light;
    context.fillRect(x + 30, -120, 10, 560);
  }
  context.restore();
}

function drawVerticalStripes(context: CanvasRenderingContext2D, palette: ReturnType<typeof createPalette>): void {
  for (let x = 0; x < 512; x += 58) {
    context.fillStyle = palette.accent;
    context.fillRect(x, 0, 24, 256);
    context.fillStyle = palette.dark;
    context.fillRect(x + 26, 0, 8, 256);
  }
}

function drawPolkaDots(context: CanvasRenderingContext2D, palette: ReturnType<typeof createPalette>): void {
  for (let y = 24; y < 256; y += 54) {
    for (let x = 24; x < 512; x += 54) {
      context.fillStyle = (x + y) % 108 === 0 ? palette.light : palette.accent;
      context.beginPath();
      context.arc(x + ((y / 54) % 2) * 24, y, 15, 0, Math.PI * 2);
      context.fill();
    }
  }
}

function drawStars(context: CanvasRenderingContext2D, palette: ReturnType<typeof createPalette>): void {
  context.fillStyle = palette.dark;
  context.fillRect(0, 0, 512, 256);
  for (let y = 32; y < 256; y += 58) {
    for (let x = 32; x < 512; x += 70) {
      drawStar(context, x + ((y / 58) % 2) * 32, y, 16, palette.light);
      drawStar(context, x + 24, y + 18, 8, palette.accent);
    }
  }
}

function drawHalfAndHalf(context: CanvasRenderingContext2D, palette: ReturnType<typeof createPalette>): void {
  context.fillStyle = palette.accent;
  context.fillRect(256, 0, 256, 256);
  context.fillStyle = palette.light;
  context.fillRect(246, 0, 20, 256);
}

function drawQuartered(context: CanvasRenderingContext2D, palette: ReturnType<typeof createPalette>): void {
  context.fillStyle = palette.accent;
  context.fillRect(256, 0, 256, 128);
  context.fillRect(0, 128, 256, 128);
  context.fillStyle = palette.dark;
  context.fillRect(256, 128, 256, 128);
}

function drawChevrons(context: CanvasRenderingContext2D, palette: ReturnType<typeof createPalette>): void {
  context.strokeStyle = palette.accent;
  context.lineWidth = 24;
  for (let x = -80; x < 560; x += 96) {
    context.beginPath();
    context.moveTo(x, 256);
    context.lineTo(x + 48, 128);
    context.lineTo(x, 0);
    context.stroke();
  }
  context.strokeStyle = palette.light;
  context.lineWidth = 8;
  for (let x = -56; x < 560; x += 96) {
    context.beginPath();
    context.moveTo(x, 256);
    context.lineTo(x + 48, 128);
    context.lineTo(x, 0);
    context.stroke();
  }
}

function drawRings(context: CanvasRenderingContext2D, palette: ReturnType<typeof createPalette>): void {
  context.strokeStyle = palette.accent;
  context.lineWidth = 16;
  for (let x = 40; x < 512; x += 76) {
    for (let y = 32; y < 256; y += 72) {
      context.beginPath();
      context.arc(x, y, 22, 0, Math.PI * 2);
      context.stroke();
    }
  }
}

function drawChecker(context: CanvasRenderingContext2D, palette: ReturnType<typeof createPalette>): void {
  const size = 32;
  for (let y = 0; y < 256; y += size) {
    for (let x = 0; x < 512; x += size) {
      context.fillStyle = (x / size + y / size) % 2 === 0 ? palette.accent : palette.dark;
      context.fillRect(x, y, size, size);
    }
  }
}

function drawLightning(context: CanvasRenderingContext2D, palette: ReturnType<typeof createPalette>): void {
  context.fillStyle = palette.dark;
  context.fillRect(0, 0, 512, 256);
  for (let x = 20; x < 512; x += 96) {
    context.fillStyle = palette.light;
    context.beginPath();
    context.moveTo(x + 42, 18);
    context.lineTo(x + 4, 130);
    context.lineTo(x + 42, 130);
    context.lineTo(x + 16, 238);
    context.lineTo(x + 82, 100);
    context.lineTo(x + 44, 100);
    context.closePath();
    context.fill();
  }
}

function drawSunburst(context: CanvasRenderingContext2D, palette: ReturnType<typeof createPalette>): void {
  const centerX = 256;
  const centerY = 128;
  for (let i = 0; i < 28; i += 1) {
    context.fillStyle = i % 2 === 0 ? palette.accent : palette.base;
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.arc(centerX, centerY, 340, (i / 28) * Math.PI * 2, ((i + 1) / 28) * Math.PI * 2);
    context.closePath();
    context.fill();
  }
}

function drawConfetti(context: CanvasRenderingContext2D, palette: ReturnType<typeof createPalette>, rng: SeededRng): void {
  const colors = [palette.accent, palette.secondary, palette.light, palette.dark];
  for (let i = 0; i < 90; i += 1) {
    context.fillStyle = colors[rng.nextInt(0, colors.length)];
    context.save();
    context.translate(rng.nextBetween(0, 512), rng.nextBetween(0, 256));
    context.rotate(rng.nextBetween(0, Math.PI));
    context.fillRect(-5, -2, rng.nextBetween(8, 18), rng.nextBetween(4, 10));
    context.restore();
  }
}

function addEquatorBand(context: CanvasRenderingContext2D, palette: ReturnType<typeof createPalette>): void {
  context.fillStyle = "rgba(255,255,255,0.16)";
  context.fillRect(0, 121, 512, 5);
  context.fillStyle = palette.dark;
  context.globalAlpha = 0.35;
  context.fillRect(0, 128, 512, 8);
  context.globalAlpha = 1;
}

function addSubtleNoise(context: CanvasRenderingContext2D, rng: SeededRng): void {
  const imageData = context.getImageData(0, 0, 512, 256);

  for (let i = 0; i < imageData.data.length; i += 4) {
    const noise = rng.nextInt(-10, 11);
    imageData.data[i] = clampColor(imageData.data[i] + noise);
    imageData.data[i + 1] = clampColor(imageData.data[i + 1] + noise);
    imageData.data[i + 2] = clampColor(imageData.data[i + 2] + noise);
  }

  context.putImageData(imageData, 0, 0);
}

function drawStar(context: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
  context.fillStyle = color;
  context.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const pointRadius = i % 2 === 0 ? radius : radius * 0.42;
    const px = x + Math.cos(angle) * pointRadius;
    const py = y + Math.sin(angle) * pointRadius;

    if (i === 0) {
      context.moveTo(px, py);
    } else {
      context.lineTo(px, py);
    }
  }
  context.closePath();
  context.fill();
}

function hsl(hue: number, saturation: number, lightness: number): string {
  return `hsl(${Math.round(hue * 360)} ${saturation}% ${lightness}%)`;
}

function clampColor(value: number): number {
  return Math.max(0, Math.min(255, value));
}
