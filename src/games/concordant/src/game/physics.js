import { CONFIG } from "./config.js";

export const GRAVITY_G = CONFIG.PHYSICS.GRAVITY_G;
const { SOFTENING, DAMPING } = CONFIG.PHYSICS;

export function applyGravity(entity, stars, dt, debugCb = null) {
  for (const star of stars) {
    const dx = star.x - entity.x;
    const dy = star.y - entity.y;
    const r = Math.hypot(dx, dy);
    if (Number.isFinite(star.gravityRadius) && r > star.gravityRadius) {
      continue;
    }

    const r2 = dx * dx + dy * dy + SOFTENING * SOFTENING;
    const rSoft = Math.sqrt(r2);
    const force = (GRAVITY_G * star.mass) / r2;

    const gx = (dx / rSoft) * force;
    const gy = (dy / rSoft) * force;

    entity.vx += gx * dt;
    entity.vy += gy * dt;

    if (debugCb) {
      debugCb(gx, gy);
    }
  }
}

export function computeStarAccelAt(pos, stars, config = null) {
  const gravityG = config?.PHYSICS?.GRAVITY_G ?? GRAVITY_G;
  const softening = config?.PHYSICS?.SOFTENING ?? SOFTENING;
  let ax = 0;
  let ay = 0;
  for (const star of stars) {
    const dx = star.x - pos.x;
    const dy = star.y - pos.y;
    const r = Math.hypot(dx, dy);
    if (Number.isFinite(star.gravityRadius) && r > star.gravityRadius) {
      continue;
    }

    const r2 = dx * dx + dy * dy + softening * softening;
    const rSoft = Math.sqrt(r2);
    const force = (gravityG * star.mass) / r2;
    ax += (dx / rSoft) * force;
    ay += (dy / rSoft) * force;
  }
  return { ax, ay };
}

export function integrate(entity, dt) {
  entity.x += entity.vx * dt;
  entity.y += entity.vy * dt;
}

export function applyDamping(entity, dt) {
  entity.vx *= DAMPING;
  entity.vy *= DAMPING;
}

