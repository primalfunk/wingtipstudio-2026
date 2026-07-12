export function getWeaponEmitterGeometry({ x, y, radius, angle, weapon }) {
  const count = weapon?.emitterCount ?? 0;
  if (!weapon || count <= 0) {
    return [];
  }
  const spacing = weapon.emitterOffset ?? 0;
  const middle = (count - 1) / 2;
  const nx = Math.cos(angle);
  const ny = Math.sin(angle);
  const px = -ny;
  const py = nx;
  return Array.from({ length: count }, (_, index) => {
    const offset = (index - middle) * spacing;
    const base = {
      x: x + nx * radius + px * offset,
      y: y + ny * radius + py * offset
    };
    return {
      base,
      tip: {
        x: base.x + nx * (weapon.barrelLength ?? 0),
        y: base.y + ny * (weapon.barrelLength ?? 0)
      },
      angle
    };
  });
}

export function drawWeaponBarrels(graphics, emitters, weapon) {
  if (!graphics || !weapon) {
    return;
  }
  for (const emitter of emitters) {
    graphics.lineStyle((weapon.barrelWidth ?? 2) + 5, weapon.barrelColor ?? weapon.color, 0.14);
    graphics.lineBetween(emitter.base.x, emitter.base.y, emitter.tip.x, emitter.tip.y);
    graphics.lineStyle(weapon.barrelWidth ?? 2, weapon.barrelColor ?? weapon.color, 0.9);
    graphics.lineBetween(emitter.base.x, emitter.base.y, emitter.tip.x, emitter.tip.y);
    graphics.fillStyle(weapon.barrelColor ?? weapon.color, 0.92);
    graphics.fillCircle(emitter.tip.x, emitter.tip.y, Math.max(2, (weapon.barrelWidth ?? 2) * 0.72));
  }
}

export function drawMuzzleFlash(graphics, emitter, weapon) {
  const flashRadius = Math.max(3, (weapon.beamWidth ?? 2) * 1.8 + (weapon.tier ?? 0));
  graphics.fillStyle(0xffffff, 0.82);
  graphics.fillCircle(emitter.tip.x, emitter.tip.y, flashRadius * 0.38);
  graphics.lineStyle(Math.max(1, weapon.beamWidth ?? 2), weapon.color, 0.68);
  graphics.lineBetween(
    emitter.tip.x - Math.cos(emitter.angle) * flashRadius,
    emitter.tip.y - Math.sin(emitter.angle) * flashRadius,
    emitter.tip.x + Math.cos(emitter.angle) * flashRadius,
    emitter.tip.y + Math.sin(emitter.angle) * flashRadius
  );
}
