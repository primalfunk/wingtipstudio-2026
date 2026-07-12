export function drawDroidSignalSlotEffect(graphics, time, {
  x = 0,
  y = 0,
  width = 96,
  height = 36,
  pulse = 0.5,
  alpha = 1,
  showBackground = true,
  showOutline = true,
  orientation = 'horizontal'
} = {}) {
  if (!graphics) {
    return;
  }

  const left = x - width / 2;
  const top = y - height / 2;

  graphics.clear();
  if (showBackground) {
    graphics.fillStyle(0x0b2630, (0.34 + pulse * 0.08) * alpha);
    graphics.fillRect(left, top, width, height);
    graphics.fillStyle(0x78f0ff, (0.035 + pulse * 0.025) * alpha);
    graphics.fillRect(left + 3, top + 3, width - 6, height - 6);
  }

  if (orientation === 'vertical') {
    const sweepY = top + ((time * 0.018) % (height + 34)) - 17;
    graphics.lineStyle(4, 0x8ff0ff, 0.075 * alpha);
    graphics.lineBetween(left + 3, sweepY - 4, left + width - 3, sweepY + 8);
    graphics.lineStyle(2, 0xd8ffff, 0.18 * alpha);
    graphics.lineBetween(left + 3, sweepY, left + width - 3, sweepY + 12);

    for (let band = 0; band < 4; band += 1) {
      const bandX = left + 12 + band * Math.max(8, (width - 24) / 3) + Math.sin(time * 0.0015 + band * 1.9) * 2.4;
      const phase = time * (0.0011 + band * 0.0002) + band * 2.4;
      const points = [];
      for (let i = 0; i <= 12; i += 1) {
        const pointY = top + 7 + i * ((height - 14) / 12);
        points.push({
          x: bandX + Math.sin(phase + i * 0.85) * (1.7 + band * 0.28),
          y: pointY
        });
      }
      graphics.lineStyle(3, band === 1 ? 0xffd36a : 0x78f0ff, (band === 1 ? 0.045 : 0.055) * alpha);
      graphics.strokePoints(points, false);
      graphics.lineStyle(1, band === 1 ? 0xffd36a : 0xa8fbff, (band === 1 ? 0.22 : 0.34) * alpha);
      graphics.strokePoints(points, false);
    }
  } else {
    const sweepX = left + ((time * 0.018) % (width + 34)) - 17;
    graphics.lineStyle(4, 0x8ff0ff, 0.075 * alpha);
    graphics.lineBetween(sweepX - 4, top + 3, sweepX + 8, top + height - 3);
    graphics.lineStyle(2, 0xd8ffff, 0.18 * alpha);
    graphics.lineBetween(sweepX, top + 3, sweepX + 12, top + height - 3);

    for (let band = 0; band < 4; band += 1) {
      const bandY = top + 6 + band * 8 + Math.sin(time * 0.0015 + band * 1.9) * 2.4;
      const phase = time * (0.0011 + band * 0.0002) + band * 2.4;
      const points = [];
      for (let i = 0; i <= 12; i += 1) {
        const pointX = left + 7 + i * ((width - 14) / 12);
        points.push({
          x: pointX,
          y: bandY + Math.sin(phase + i * 0.85) * (1.7 + band * 0.28)
        });
      }
      graphics.lineStyle(3, band === 1 ? 0xffd36a : 0x78f0ff, (band === 1 ? 0.045 : 0.055) * alpha);
      graphics.strokePoints(points, false);
      graphics.lineStyle(1, band === 1 ? 0xffd36a : 0xa8fbff, (band === 1 ? 0.22 : 0.34) * alpha);
      graphics.strokePoints(points, false);
    }
  }

  const arcGate = Math.floor(time / 180) % 9;
  if (arcGate === 0 || arcGate === 2 || arcGate === 5) {
    const localT = (time % 180) / 180;
    const intensity = Math.sin(localT * Math.PI) * 0.74 * alpha;
    const startX = left + 18 + (Math.floor(time / 180) % 4) * 17;
    const startY = top + 9 + (Math.floor(time / 360) % 3) * 7;
    const points = orientation === 'vertical'
      ? [
          { x: startX, y: startY },
          { x: startX + 5, y: startY + 8 },
          { x: startX - 1, y: startY + 16 },
          { x: startX + 6, y: startY + 26 }
        ]
      : [
          { x: startX, y: startY },
          { x: startX + 8, y: startY + 5 },
          { x: startX + 16, y: startY - 1 },
          { x: startX + 26, y: startY + 6 }
        ];
    graphics.lineStyle(2, arcGate === 0 ? 0x78f0ff : 0xffd36a, intensity);
    graphics.strokePoints(points, false);
    graphics.lineStyle(5, arcGate === 0 ? 0x78f0ff : 0xffd36a, intensity * 0.24);
    graphics.strokePoints(points, false);
  }

  for (let i = 0; i < 8; i += 1) {
    const seed = Math.sin((Math.floor(time / 260) + i * 37) * 12.9898) * 43758.5453;
    const frac = seed - Math.floor(seed);
    const age = ((time + i * 72) % 620) / 620;
    const pointAlpha = Math.max(0, 1 - age * 1.3) * 0.52 * alpha;
    if (pointAlpha <= 0) {
      continue;
    }
    const pointX = left + 8 + ((frac * 97) % (width - 16));
    const pointY = top + 7 + (((frac * 173) % 1) * (height - 14));
    graphics.fillStyle(i % 3 === 0 ? 0xffd36a : 0x8ff0ff, pointAlpha);
    graphics.fillCircle(pointX, pointY, 1.5 + (1 - age) * 1.1);
  }

  if (showOutline) {
    graphics.lineStyle(2, 0x78f0ff, 0.28 * alpha);
    graphics.strokeRect(left, top, width, height);
  }
}
