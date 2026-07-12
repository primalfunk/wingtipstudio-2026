import { VisualSettings } from '../systems/VisualSettings.js';

export function createPopupPanel(scene, {
  width = 680,
  height = 320,
  accent = 0x35dfff,
  fill = 0x06111d,
  alpha = 0.92
} = {}) {
  const container = scene.add.container(0, 0);
  const graphics = scene.add.graphics();
  const corner = 28;
  const notch = 96;
  const left = -width / 2;
  const right = width / 2;
  const top = -height / 2;
  const bottom = height / 2;

  graphics.fillStyle(fill, alpha);
  graphics.fillRoundedRect(left, top, width, height, 4);

  const frameSegments = [
    [left + corner, top, left + width * 0.39, top, 0.64],
    [left + width * 0.43, top, right - corner, top, 0.76],
    [right - corner, top, right, top + corner, 0.62],
    [right, top + corner + 12, right, bottom - corner - 38, 0.54],
    [right, bottom - corner - 22, right, bottom - corner, 0.7],
    [right, bottom - corner, right - corner, bottom, 0.62],
    [right - corner, bottom, left + width * 0.57, bottom, 0.73],
    [left + width * 0.51, bottom, left + corner, bottom, 0.55],
    [left + corner, bottom, left, bottom - corner, 0.69],
    [left, bottom - corner - 16, left, top + corner + 28, 0.48],
    [left, top + corner + 12, left, top + corner, 0.72],
    [left, top + corner, left + corner, top, 0.64]
  ];

  frameSegments.forEach(([x1, y1, x2, y2, lineAlpha]) => {
    graphics.lineStyle(2, accent, lineAlpha);
    graphics.lineBetween(x1, y1, x2, y2);
  });

  graphics.lineStyle(3, accent, VisualSettings.reduceGlow ? 0.35 : 0.9);
  graphics.lineBetween(-notch / 2, top - 2, notch / 2, top - 2);
  graphics.lineBetween(-notch / 2, bottom + 2, notch / 2, bottom + 2);

  graphics.lineStyle(1, 0x5c0d13, 0.42);
  graphics.lineBetween(left + 72, bottom - 22, right - 72, bottom - 22);
  graphics.lineStyle(1, accent, 0.18);
  graphics.strokeRect(left + 14, top + 14, width - 28, height - 28);

  graphics.lineStyle(1, accent, 0.38);
  for (let x = left + 86; x < right - 80; x += 88) {
    graphics.lineBetween(x, top + 9, x + 14, top + 9);
    graphics.lineBetween(x + 30, bottom - 9, x + 44, bottom - 9);
  }
  for (let y = top + 64; y < bottom - 48; y += 54) {
    graphics.lineBetween(left + 8, y, left + 8, y + 12);
    graphics.lineBetween(right - 8, y + 18, right - 8, y + 30);
  }

  container.add(graphics);
  return container;
}
