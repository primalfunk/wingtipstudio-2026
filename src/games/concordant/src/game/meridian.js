import { CONFIG } from "./config.js";
import { clamp } from "./rng.js";

const MERIDIAN = CONFIG.SECTOR.MERIDIAN ?? {};
const DEFAULT_BOUNCE = Number.isFinite(MERIDIAN.BOUNCE) ? MERIDIAN.BOUNCE : 0.98;
const CORE_COLOR = MERIDIAN.SPINE_CORE_COLOR ?? "rgba(210, 230, 255, 0.8)";
const EDGE_COLOR = MERIDIAN.SPINE_EDGE_COLOR ?? "rgba(240, 250, 255, 0.95)";
const EDGE_WIDTH = Number.isFinite(MERIDIAN.SPINE_EDGE_WIDTH) ? MERIDIAN.SPINE_EDGE_WIDTH : 2;
const TRACE_ENABLED = MERIDIAN.TRACE_ENABLED ?? true;
const TRACE_BAND_MULT = Number.isFinite(MERIDIAN.TRACE_BAND_MULTIPLIER)
  ? MERIDIAN.TRACE_BAND_MULTIPLIER
  : 0.7;
const TRACE_ALPHA = Number.isFinite(MERIDIAN.TRACE_ALPHA) ? MERIDIAN.TRACE_ALPHA : 0.45;
const TRACE_SPEED = Number.isFinite(MERIDIAN.TRACE_SPEED) ? MERIDIAN.TRACE_SPEED : 18;
const TRACE_SAT = Number.isFinite(MERIDIAN.TRACE_SAT) ? MERIDIAN.TRACE_SAT : 0.85;
const TRACE_LIGHT = Number.isFinite(MERIDIAN.TRACE_LIGHT) ? MERIDIAN.TRACE_LIGHT : 0.68;
const TRACE_LAYER_COUNT = Number.isFinite(MERIDIAN.TRACE_LAYER_COUNT) ? MERIDIAN.TRACE_LAYER_COUNT : 3;

function hsla(h, s, l, a) {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.round(clamp(s, 0, 1) * 100);
  const light = Math.round(clamp(l, 0, 1) * 100);
  return `hsla(${hue}, ${sat}%, ${light}%, ${a})`;
}

function drawTraceBands(ctx, cx, cy, angle, halfLen, halfWidth, timeMs) {
  if (!TRACE_ENABLED || TRACE_ALPHA <= 0) {
    return;
  }
  const bandWidth = halfWidth * TRACE_BAND_MULT;
  if (bandWidth <= 0) {
    return;
  }
  const inner = halfWidth;
  const outer = halfWidth + bandWidth;
  const baseHue = (timeMs * 0.001 * TRACE_SPEED) % 360;
  const lightness = Math.min(TRACE_LIGHT, 0.62);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.globalCompositeOperation = "screen";
  ctx.filter = "none";
  for (let i = 0; i < TRACE_LAYER_COUNT; i++) {
    const hue = baseHue + i * (360 / TRACE_LAYER_COUNT);
    const color = hsla(hue, TRACE_SAT, lightness, TRACE_ALPHA);
    const colorAccent = hsla(hue + 30, TRACE_SAT, lightness * 0.9, TRACE_ALPHA * 0.6);
    const gradPos = ctx.createLinearGradient(0, inner, 0, outer);
    gradPos.addColorStop(0, color);
    gradPos.addColorStop(0.6, colorAccent);
    gradPos.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradPos;
    ctx.fillRect(-halfLen, inner, halfLen * 2, outer - inner);

    const gradNeg = ctx.createLinearGradient(0, -inner, 0, -outer);
    gradNeg.addColorStop(0, color);
    gradNeg.addColorStop(0.6, colorAccent);
    gradNeg.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradNeg;
    ctx.fillRect(-halfLen, -outer, halfLen * 2, outer - inner);
  }
  ctx.restore();
}

export function getMeridianNormal(angle) {
  return {
    nx: -Math.sin(angle),
    ny: Math.cos(angle)
  };
}

export function resolveMeridianCollision(body, radius, meridian, bounce = DEFAULT_BOUNCE) {
  if (!body || !meridian || !Number.isFinite(meridian.axisAngle) || !Number.isFinite(meridian.spineWidth)) {
    return false;
  }
  const bounds = meridian.bounds;
  if (bounds
    && (body.x < bounds.x || body.x > bounds.x + bounds.size
      || body.y < bounds.y || body.y > bounds.y + bounds.size)) {
    return false;
  }
  const cx = meridian.center?.x ?? 0;
  const cy = meridian.center?.y ?? 0;
  const dx = body.x - cx;
  const dy = body.y - cy;
  const { nx, ny } = getMeridianNormal(meridian.axisAngle);
  const dist = dx * nx + dy * ny;
  const limit = meridian.spineWidth * 0.5 + radius;
  if (Math.abs(dist) >= limit) {
    return false;
  }
  const sign = dist >= 0 ? 1 : -1;
  const push = Math.max(0, limit - Math.abs(dist)) + 0.001;
  body.x += nx * push * sign;
  body.y += ny * push * sign;

  const vx = Number.isFinite(body.vx) ? body.vx : 0;
  const vy = Number.isFinite(body.vy) ? body.vy : 0;
  const vdot = vx * nx + vy * ny;
  if (vdot * dist < 0) {
    const impulse = (1 + bounce) * vdot;
    body.vx = vx - impulse * nx;
    body.vy = vy - impulse * ny;
  }
  return true;
}

export function projectileHitsMeridian(projectile, meridian, radius = 0) {
  if (!projectile || !meridian || !Number.isFinite(meridian.axisAngle) || !Number.isFinite(meridian.spineWidth)) {
    return false;
  }
  const bounds = meridian.bounds;
  if (bounds
    && (projectile.x < bounds.x || projectile.x > bounds.x + bounds.size
      || projectile.y < bounds.y || projectile.y > bounds.y + bounds.size)) {
    return false;
  }
  const cx = meridian.center?.x ?? 0;
  const cy = meridian.center?.y ?? 0;
  const dx = projectile.x - cx;
  const dy = projectile.y - cy;
  const { nx, ny } = getMeridianNormal(meridian.axisAngle);
  const dist = dx * nx + dy * ny;
  const limit = meridian.spineWidth * 0.5 + radius;
  return Math.abs(dist) < limit;
}

export function drawMeridianSpine(ctx, meridian, viewDiagonal, zoom = 1, timeMs = 0) {
  if (!meridian || !Number.isFinite(meridian.axisAngle) || !Number.isFinite(meridian.spineWidth)) {
    return;
  }
  const bounds = meridian.bounds;
  const halfLen = bounds
    ? Math.hypot(bounds.size, bounds.size)
    : Math.max(1, viewDiagonal * 2);
  const halfWidth = meridian.spineWidth * 0.5;
  const angle = meridian.axisAngle;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nx = -dy;
  const ny = dx;
  const cx = meridian.center?.x ?? 0;
  const cy = meridian.center?.y ?? 0;

  const ax = cx - dx * halfLen;
  const ay = cy - dy * halfLen;
  const bx = cx + dx * halfLen;
  const by = cy + dy * halfLen;

  const wx = nx * halfWidth;
  const wy = ny * halfWidth;

  ctx.save();
  ctx.fillStyle = CORE_COLOR;
  ctx.beginPath();
  ctx.moveTo(ax - wx, ay - wy);
  ctx.lineTo(bx - wx, by - wy);
  ctx.lineTo(bx + wx, by + wy);
  ctx.lineTo(ax + wx, ay + wy);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = EDGE_COLOR;
  ctx.lineWidth = EDGE_WIDTH / Math.max(zoom, 1e-6);
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(ax + wx, ay + wy);
  ctx.lineTo(bx + wx, by + wy);
  ctx.moveTo(ax - wx, ay - wy);
  ctx.lineTo(bx - wx, by - wy);
  ctx.stroke();
  if (TRACE_ENABLED) {
    drawTraceBands(ctx, cx, cy, angle, halfLen, halfWidth, timeMs);
  }
  ctx.restore();
}
