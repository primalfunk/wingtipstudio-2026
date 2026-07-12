export function drawBeamProjectile(graphics, start, end, weapon) {
  graphics.lineStyle(weapon.glowWidth ?? weapon.beamWidth * 3, weapon.color, 0.18);
  graphics.lineBetween(start.x, start.y, end.x, end.y);
  graphics.lineStyle(weapon.beamWidth ?? weapon.projectileWidth ?? 3, weapon.color, 0.92);
  graphics.lineBetween(start.x, start.y, end.x, end.y);
}
