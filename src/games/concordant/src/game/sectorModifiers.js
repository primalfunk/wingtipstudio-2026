import { CONFIG } from "./config.js";
import { clamp, createRng, hashInts, randomRange } from "./rng.js";

const SECTOR = CONFIG.SECTOR ?? {};
const SECTOR_TYPES = SECTOR.TYPES ?? {};
const OCCLUSION = SECTOR.OCCLUSION ?? {};
const DRAG = SECTOR.DRAG ?? {};
const TWO_PI = Math.PI * 2;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function fade(t) {
  return t * t * (3 - 2 * t);
}

function noise2D(seed, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const xf = x - x0;
  const yf = y - y0;
  const v00 = (hashInts(seed, x0, y0) % 1024) / 1024;
  const v10 = (hashInts(seed, x0 + 1, y0) % 1024) / 1024;
  const v01 = (hashInts(seed, x0, y0 + 1) % 1024) / 1024;
  const v11 = (hashInts(seed, x0 + 1, y0 + 1) % 1024) / 1024;
  const u = fade(xf);
  const v = fade(yf);
  const ix0 = lerp(v00, v10, u);
  const ix1 = lerp(v01, v11, u);
  return lerp(ix0, ix1, v);
}

function hsla(h, s, l, a) {
  const hue = ((h % 360) + 360) % 360;
  const sat = Math.round(clamp(s, 0, 1) * 100);
  const light = Math.round(clamp(l, 0, 1) * 100);
  const alpha = clamp(a, 0, 1);
  return `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
}

function getCluePhase(total) {
  if (total >= 41) {
    return "ACT3_LATE";
  }
  if (total >= 21) {
    return "ACT3";
  }
  if (total >= 10) {
    return "ACT2";
  }
  return "ACT1";
}

function getPhaseConfig(config, phase) {
  if (!config || typeof config !== "object") {
    return {};
  }
  return config.PHASES?.[phase] ?? {};
}

function allowOcclusion(sectorType) {
  if (!OCCLUSION.ENABLED) {
    return false;
  }
  if (Array.isArray(OCCLUSION.DISABLED_SECTOR_TYPES)
    && OCCLUSION.DISABLED_SECTOR_TYPES.includes(sectorType)) {
    return false;
  }
  return true;
}

function allowDrag(sectorType) {
  if (!DRAG.ENABLED) {
    return false;
  }
  if (Array.isArray(DRAG.DISABLED_SECTOR_TYPES)
    && DRAG.DISABLED_SECTOR_TYPES.includes(sectorType)) {
    return false;
  }
  return true;
}

function pickOcclusionType(rng, phase, sectorType) {
  if (!allowOcclusion(sectorType)) {
    return null;
  }
  if (sectorType === SECTOR_TYPES.SIGNAL_ORIGIN) {
    return "PARTIAL";
  }
  const phaseCfg = getPhaseConfig(OCCLUSION, phase);
  const chanceMult = sectorType === SECTOR_TYPES.MERIDIAN
    ? (OCCLUSION.MERIDIAN_CHANCE_MULT ?? 0.4)
    : 1;
  const fullChance = clamp((phaseCfg.FULL ?? 0) * chanceMult, 0, 1);
  const partialChance = clamp((phaseCfg.PARTIAL ?? 0) * chanceMult, 0, 1);
  const roll = rng();
  if (roll < fullChance) {
    return "FULL";
  }
  if (roll < fullChance + partialChance) {
    return "PARTIAL";
  }
  return null;
}

function pickDragMode(rng, phase, sectorType, occlusionType) {
  if (!allowDrag(sectorType)) {
    return null;
  }
  if (sectorType === SECTOR_TYPES.SIGNAL_ORIGIN) {
    return "SINGLE";
  }
  const phaseCfg = getPhaseConfig(DRAG, phase);
  const allowStack = Boolean(phaseCfg.ALLOW_STACK);
  if (!allowStack && occlusionType) {
    return null;
  }
  const chanceMult = sectorType === SECTOR_TYPES.MERIDIAN
    ? (DRAG.MERIDIAN_CHANCE_MULT ?? 0.5)
    : 1;
  const layeredChance = clamp((phaseCfg.LAYERED ?? 0) * chanceMult, 0, 1);
  const singleChance = clamp((phaseCfg.SINGLE ?? 0) * chanceMult, 0, 1);
  const roll = rng();
  if (roll < layeredChance) {
    return "LAYERED";
  }
  if (roll < layeredChance + singleChance) {
    return "SINGLE";
  }
  return null;
}

function pickFogColor(rng) {
  const hue = rng() * 360;
  const sat = randomRange(rng, OCCLUSION.COLOR_SAT_MIN ?? 0.35, OCCLUSION.COLOR_SAT_MAX ?? 0.7);
  const light = randomRange(rng, OCCLUSION.COLOR_LIGHT_MIN ?? 0.45, OCCLUSION.COLOR_LIGHT_MAX ?? 0.7);
  return { h: hue, s: sat, l: light };
}

function spawnFogPatch(rng, bounds, settings) {
  const radius = randomRange(rng, settings.radiusMin, settings.radiusMax);
  const margin = radius * 1.05;
  const x = randomRange(rng, bounds.x + margin, bounds.x + bounds.size - margin);
  const y = randomRange(rng, bounds.y + margin, bounds.y + bounds.size - margin);
  const speed = randomRange(rng, settings.speedMin, settings.speedMax);
  const angle = rng() * TWO_PI;
  const color = pickFogColor(rng);
  return {
    x,
    y,
    radius,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    h: color.h,
    s: color.s,
    l: color.l,
    alpha: settings.alpha,
    rng
  };
}

function buildFogPatches(seed, bounds, settings) {
  const rng = createRng(seed);
  const count = Math.max(0, Math.floor(randomRange(rng, settings.countMin, settings.countMax + 1)));
  const patches = [];
  for (let i = 0; i < count; i++) {
    const patchRng = createRng(hashInts(seed, 2001, i));
    patches.push(spawnFogPatch(patchRng, bounds, settings));
  }
  return patches;
}

function buildOcclusion(bounds, type, seed) {
  const baseSize = bounds.size;
  if (type === "FULL") {
    const settings = {
      countMin: OCCLUSION.FULL_PATCH_MIN ?? 12,
      countMax: OCCLUSION.FULL_PATCH_MAX ?? 18,
      radiusMin: baseSize * (OCCLUSION.FULL_RADIUS_MIN_RATIO ?? 0.18),
      radiusMax: baseSize * (OCCLUSION.FULL_RADIUS_MAX_RATIO ?? 0.4),
      speedMin: baseSize * (OCCLUSION.FULL_SPEED_MIN_RATIO ?? 0.002),
      speedMax: baseSize * (OCCLUSION.FULL_SPEED_MAX_RATIO ?? 0.006),
      alpha: OCCLUSION.FULL_PATCH_ALPHA ?? 0.95
    };
    const patches = buildFogPatches(hashInts(seed, 3101), bounds, settings);
    return {
      type,
      patches,
      settings,
      clearRadius: baseSize * (OCCLUSION.FULL_CLEAR_RADIUS_RATIO ?? 0.08),
      fogRadius: baseSize * (OCCLUSION.FULL_FOG_RADIUS_RATIO ?? 0.6),
      fogAlpha: OCCLUSION.FULL_FOG_ALPHA ?? 0.6,
      fogColor: OCCLUSION.FULL_FOG_COLOR ?? "rgba(10, 12, 18, 1)"
    };
  }
  const settings = {
    countMin: OCCLUSION.PARTIAL_PATCH_MIN ?? 5,
    countMax: OCCLUSION.PARTIAL_PATCH_MAX ?? 8,
    radiusMin: baseSize * (OCCLUSION.PARTIAL_RADIUS_MIN_RATIO ?? 0.12),
    radiusMax: baseSize * (OCCLUSION.PARTIAL_RADIUS_MAX_RATIO ?? 0.28),
    speedMin: baseSize * (OCCLUSION.PARTIAL_SPEED_MIN_RATIO ?? 0.0015),
    speedMax: baseSize * (OCCLUSION.PARTIAL_SPEED_MAX_RATIO ?? 0.004),
    alpha: OCCLUSION.PARTIAL_PATCH_ALPHA ?? 0.9
  };
  const patches = buildFogPatches(hashInts(seed, 3201), bounds, settings);
  return {
    type,
    patches,
    settings,
    clearRadius: baseSize * (OCCLUSION.PARTIAL_CLEAR_RADIUS_RATIO ?? 0.12),
    fadeDistance: baseSize * (OCCLUSION.PARTIAL_FADE_DISTANCE_RATIO ?? 0.35),
    baseFogAlpha: OCCLUSION.PARTIAL_BASE_FOG_ALPHA ?? 0.12,
    fogRadius: baseSize * (OCCLUSION.PARTIAL_FOG_RADIUS_RATIO ?? 0.7)
  };
}

function buildDragFields(seed, bounds, mode) {
  const rng = createRng(seed);
  const baseSize = bounds.size;
  const countMin = mode === "LAYERED"
    ? (DRAG.LAYERED_FIELD_MIN ?? 3)
    : (DRAG.SINGLE_FIELD_MIN ?? 1);
  const countMax = mode === "LAYERED"
    ? (DRAG.LAYERED_FIELD_MAX ?? 5)
    : (DRAG.SINGLE_FIELD_MAX ?? 2);
  const fieldCount = Math.max(0, Math.floor(randomRange(rng, countMin, countMax + 1)));
  const fields = [];
  for (let i = 0; i < fieldCount; i++) {
    const radius = baseSize * randomRange(rng, DRAG.RADIUS_MIN_RATIO ?? 0.18, DRAG.RADIUS_MAX_RATIO ?? 0.5);
    const margin = radius * 1.05;
    const x = randomRange(rng, bounds.x + margin, bounds.x + bounds.size - margin);
    const y = randomRange(rng, bounds.y + margin, bounds.y + bounds.size - margin);
    const dragFactor = randomRange(rng, DRAG.DRAG_MIN ?? 0.94, DRAG.DRAG_MAX ?? 0.985);
    const noiseScale = Math.max(1, radius * (DRAG.NOISE_SCALE_RATIO ?? 0.2));
    fields.push({
      x,
      y,
      radius,
      dragFactor,
      noiseSeed: hashInts(seed, 9001, i),
      noiseScale,
      falloffPower: DRAG.FALLOFF_POWER ?? 1.7
    });
  }
  return fields;
}

export function buildSectorModifiers({ bounds, sectorType, clueCount, seed }) {
  const rng = createRng(hashInts(seed, 1101));
  const phase = getCluePhase(clueCount);
  const occlusionType = pickOcclusionType(rng, phase, sectorType);
  const occlusion = occlusionType ? buildOcclusion(bounds, occlusionType, hashInts(seed, 1201)) : null;
  const dragMode = pickDragMode(rng, phase, sectorType, occlusionType);
  const dragFields = dragMode ? buildDragFields(hashInts(seed, 1301), bounds, dragMode) : [];
  if (sectorType === SECTOR_TYPES.SIGNAL_ORIGIN && dragFields.length > 0) {
    const scale = clamp(DRAG.BEACON_DRAG_SCALE ?? 0.6, 0, 1);
    for (const field of dragFields) {
      field.dragFactor = 1 - (1 - field.dragFactor) * scale;
    }
  }
  return { occlusion, dragFields, dragMode, phase };
}

export function updateSectorOcclusion(sector, dt) {
  const occlusion = sector?.occlusion;
  if (!occlusion || !Array.isArray(occlusion.patches)) {
    return;
  }
  const bounds = sector.bounds;
  for (const patch of occlusion.patches) {
    patch.x += patch.vx * dt;
    patch.y += patch.vy * dt;
    const radius = patch.radius;
    if (patch.x - radius <= bounds.x
      || patch.x + radius >= bounds.x + bounds.size
      || patch.y - radius <= bounds.y
      || patch.y + radius >= bounds.y + bounds.size) {
      const patchRng = patch.rng ?? createRng(hashInts(bounds.x, bounds.y, radius));
      const refreshed = spawnFogPatch(patchRng, bounds, occlusion.settings);
      patch.x = refreshed.x;
      patch.y = refreshed.y;
      patch.radius = refreshed.radius;
      patch.vx = refreshed.vx;
      patch.vy = refreshed.vy;
      patch.h = refreshed.h;
      patch.s = refreshed.s;
      patch.l = refreshed.l;
      patch.alpha = refreshed.alpha;
      patch.rng = patchRng;
    }
  }
}

function drawFogPatch(ctx, patch, distanceFactor) {
  const alpha = clamp(patch.alpha * distanceFactor, 0, 1);
  if (alpha <= 0) {
    return;
  }
  const grad = ctx.createRadialGradient(patch.x, patch.y, 0, patch.x, patch.y, patch.radius);
  grad.addColorStop(0, hsla(patch.h, patch.s, patch.l, alpha));
  grad.addColorStop(1, hsla(patch.h, patch.s, patch.l, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(patch.x, patch.y, patch.radius, 0, TWO_PI);
  ctx.fill();
}

export function drawSectorOcclusion(ctx, sector, ship) {
  const occlusion = sector?.occlusion;
  if (!occlusion || !sector?.bounds || !ship) {
    return;
  }
  const bounds = sector.bounds;
  ctx.save();
  ctx.beginPath();
  ctx.rect(bounds.x, bounds.y, bounds.size, bounds.size);
  ctx.clip();

  if (occlusion.type === "FULL") {
    const clearRadius = occlusion.clearRadius;
    const fogRadius = occlusion.fogRadius;
    const fogAlpha = occlusion.fogAlpha;
    const grad = ctx.createRadialGradient(ship.x, ship.y, clearRadius, ship.x, ship.y, fogRadius);
    grad.addColorStop(0, "rgba(0, 0, 0, 0)");
    grad.addColorStop(1, `rgba(0, 0, 0, ${clamp(fogAlpha, 0, 1)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(bounds.x, bounds.y, bounds.size, bounds.size);
  } else if (occlusion.baseFogAlpha > 0) {
    const clearRadius = occlusion.clearRadius;
    const fogRadius = occlusion.fogRadius;
    const grad = ctx.createRadialGradient(ship.x, ship.y, clearRadius, ship.x, ship.y, fogRadius);
    grad.addColorStop(0, "rgba(0, 0, 0, 0)");
    grad.addColorStop(1, `rgba(0, 0, 0, ${clamp(occlusion.baseFogAlpha, 0, 1)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(bounds.x, bounds.y, bounds.size, bounds.size);
  }

  for (const patch of occlusion.patches) {
    let distanceFactor = 1;
    if (occlusion.type === "PARTIAL") {
      const dist = Math.hypot(patch.x - ship.x, patch.y - ship.y);
      const fade = clamp((dist - occlusion.clearRadius) / Math.max(1, occlusion.fadeDistance), 0, 1);
      distanceFactor = fade;
    }
    drawFogPatch(ctx, patch, distanceFactor);
  }

  ctx.restore();
}

export function applyDragToEntity(entity, sector, dt) {
  if (!entity || !sector?.dragFields || sector.dragFields.length === 0) {
    return 1;
  }
  if (!Number.isFinite(entity.vx) || !Number.isFinite(entity.vy)) {
    return 1;
  }
  let combined = 1;
  for (const field of sector.dragFields) {
    const dx = entity.x - field.x;
    const dy = entity.y - field.y;
    const dist = Math.hypot(dx, dy);
    if (dist >= field.radius) {
      continue;
    }
    const t = 1 - dist / field.radius;
    const falloff = Math.pow(t, field.falloffPower ?? 1.7);
    const noise = noise2D(field.noiseSeed ?? 0, dx / field.noiseScale, dy / field.noiseScale);
    const strength = falloff * (0.6 + 0.4 * noise);
    const factor = 1 - (1 - field.dragFactor) * strength;
    combined *= clamp(factor, 0, 1);
  }
  const timeScale = DRAG.TIME_SCALE ?? 60;
  const exponent = Math.max(0, dt * timeScale);
  const finalFactor = Math.pow(combined, exponent);
  entity.vx *= finalFactor;
  entity.vy *= finalFactor;
  return finalFactor;
}

