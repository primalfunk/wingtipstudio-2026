import { CONFIG } from "./config.js";
import { applyGravity, computeStarAccelAt } from "./physics.js";

function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getRiverStrength(width, riverConfig) {
  const minW = riverConfig.WIDTH_MIN;
  const maxW = riverConfig.WIDTH_MAX;
  const w = clampValue(width, minW, maxW);
  const wn = (w - minW) / Math.max(1, maxW - minW);
  const base = riverConfig.STRENGTH_BASE;
  const multiplier = riverConfig.STRENGTH_MULTIPLIER ?? 1;
  const exponent = riverConfig.STRENGTH_EXPONENT;
  const strength = base * Math.pow(1 / (wn + 0.15), exponent);
  const scaled = strength * multiplier;
  return clampValue(scaled, base * 0.25 * multiplier, base * 6 * multiplier);
}

function closestPointOnSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const denom = abx * abx + aby * aby;
  if (denom === 0) {
    return { x: ax, y: ay, t: 0 };
  }
  let t = (apx * abx + apy * aby) / denom;
  t = clampValue(t, 0, 1);
  return {
    x: ax + abx * t,
    y: ay + aby * t,
    t
  };
}

function findClosestPointOnPolyline(points, pos) {
  let best = null;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const hit = closestPointOnSegment(pos.x, pos.y, a.x, a.y, b.x, b.y);
    const dx = pos.x - hit.x;
    const dy = pos.y - hit.y;
    const dist = Math.hypot(dx, dy);
    if (!best || dist < best.dist) {
      const segX = b.x - a.x;
      const segY = b.y - a.y;
      const segLen = Math.hypot(segX, segY) || 1;
      best = {
        dist,
        tangentX: segX / segLen,
        tangentY: segY / segLen
      };
    }
  }
  return best;
}

export function computeStarAccelMagnitude(pos, stars, config = CONFIG) {
  if (!stars || stars.length === 0) {
    return 0;
  }
  const accel = computeStarAccelAt(pos, stars, config);
  return Math.hypot(accel.ax, accel.ay);
}

export function computeRiverAccel(pos, rivers, config = CONFIG) {
  if (!Array.isArray(rivers) || rivers.length === 0) {
    return { ax: 0, ay: 0 };
  }
  const riverCfg = config.RIVER;
  let ax = 0;
  let ay = 0;

  for (const river of rivers) {
    const points = river?.points;
    if (!points || points.length < 2) {
      continue;
    }
    const width = Number.isFinite(river.width) ? river.width : riverCfg.WIDTH_MIN;
    const halfW = width / 2;
    const closest = findClosestPointOnPolyline(points, pos);
    if (!closest || closest.dist > halfW) {
      continue;
    }
    const r = closest.dist / halfW;
    const edge = Math.pow(1 - r, riverCfg.EDGE_FALLOFF_POWER);
    const strength = Number.isFinite(river.strength)
      ? river.strength * (riverCfg.STRENGTH_MULTIPLIER ?? 1)
      : getRiverStrength(width, riverCfg);
    ax += closest.tangentX * strength * edge;
    ay += closest.tangentY * strength * edge;
  }

  return { ax, ay };
}

export function applyForcesToEntity(entity, dt, stars, rivers, config = CONFIG, flags = {}) {
  if (!entity) {
    return;
  }
  const affectByStars = flags.affectByStars !== false;
  const affectByRivers = flags.affectByRivers !== false;
  let starAccelMag = 0;

  if (affectByRivers) {
    starAccelMag = computeStarAccelMagnitude(entity, stars, config);
  }
  if (affectByStars) {
    applyGravity(entity, stars, dt);
  }
  if (affectByRivers) {
    const riverAccel = computeRiverAccel(entity, rivers, config);
    let ax = riverAccel.ax;
    let ay = riverAccel.ay;
    const mag = Math.hypot(ax, ay);
    if (mag > 0 && starAccelMag > 0) {
      const maxMag = starAccelMag * config.RIVER.VS_STAR_RATIO_MAX;
      if (mag > maxMag) {
        const scale = maxMag / mag;
        ax *= scale;
        ay *= scale;
      }
    }
    if (ax !== 0 || ay !== 0) {
      const timeScale = config.RIVER.TIME_SCALE ?? 1;
      entity.vx += ax * dt * timeScale;
      entity.vy += ay * dt * timeScale;
    }
  }
}
