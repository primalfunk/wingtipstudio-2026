import type { FallingObject, Projectile } from "./types";

export function projectileHit(projectile: Projectile, object: FallingObject): boolean {
  const dx = projectile.x - object.x;
  const dy = projectile.y - object.y;
  return Math.hypot(dx, dy) <= object.radius + 8;
}
