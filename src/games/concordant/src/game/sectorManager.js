import { Star } from "../entities/star.js";
import { Goal } from "../entities/goal.js";
import { Asteroid } from "../entities/asteroid.js";
import { ApseRing } from "../entities/apseRing.js";
import { ApseBackground } from "../entities/apseBackground.js";
import { generateApseInterior } from "../entities/apseInterior.js";
import { ApseMetalTexture } from "../entities/apseMetalTexture.js";
import { PalimpsestFragment } from "../entities/palimpsestFragment.js";
import { CoreObject, LureObject, NodeObject, ShardObject, WreckageObject } from "../entities/sectorObjects.js";
import { clamp, createRng, hashInts, pickWeighted, randomInt, randomRange } from "./rng.js";
import { getSectorMeta, saveSectorIndex, setSectorMeta, pruneSectorIndex } from "./sectorIndex.js";
import { saveGameState } from "./gameState.js";
import { CONFIG } from "./config.js";
import { getFieldTypeForSector } from "./riverNetwork.js";
import { getStationInfoForSector, pickStationPosition } from "./stationSystem.js";
import { CLUE_TOTAL } from "../data/clues.js";
import { buildSectorModifiers } from "./sectorModifiers.js";

export const SECTOR_SIZE = CONFIG.SECTOR.SIZE;
export const SECTOR_TYPES = CONFIG.SECTOR.TYPES;

const { SECTOR, STAR: STAR_CONFIG, ASTEROID, GOAL, FIELD, STATION, SHIP, OBJECTS } = CONFIG;
const STAR_GEN = STAR_CONFIG.GENERATION;
const STAR = STAR_GEN;
const STAR_WELL = STAR_GEN.WELL;
const STAR_ROTATION = STAR_GEN.ROTATION;
const STAR_PULSE = STAR_GEN.PULSE;
const STAR_TYPES = STAR_GEN.TYPES;
const STAR_PLACEMENT = STAR_GEN.PLACEMENT;
const STAR_MOTION = STAR_CONFIG.MOTION;
const ASTEROIDS = ASTEROID.GENERATION;
const ASTEROID_CLUSTER = ASTEROID.GENERATION.CLUSTER;
const ENTRY_SAFE_RADIUS = SECTOR.ENTRY_SAFE_RADIUS;
const BEACON_SAFE_PADDING = SECTOR.BEACON_SAFE_PADDING;
const MIN_ORIGIN_RING = SECTOR.MIN_ORIGIN_RING;
const ORIGIN_COOLDOWN = SECTOR.ORIGIN_COOLDOWN;
const ECHO_MIN_EXPOSURE = SECTOR.ECHO_MIN_EXPOSURE;
const SECTOR_MOODS = SECTOR.MOODS;
const ANOMALY_MODIFIERS = SECTOR.ANOMALY_MODIFIERS;
const SPAWN_PROFILES = SECTOR.SPAWN_PROFILES;
const SEED_SALT = SECTOR.SEED_SALT;
const STAR_RATE_MULTIPLIER = STAR_GEN.RATE_MULTIPLIER;
const STATION_SAFE_RADIUS = STATION.SAFE_ZONE_RADIUS;
const ZONES = SECTOR.ZONES;
const FIELD_TYPES = FIELD.TYPES;
const PATTERN_VERSION = 1;
const SIGNAL_ORIGIN = SECTOR.SIGNAL_ORIGIN ?? {};
const APSE = SECTOR.APSE ?? {};
const MERIDIAN = SECTOR.MERIDIAN ?? {};
const PALIMPSEST = SECTOR.PALIMPSEST ?? {};
const PALIMPSEST_SINGULARITY = PALIMPSEST.SINGULARITY ?? {};
const PALIMPSEST_FRAGMENTS = PALIMPSEST.FRAGMENTS ?? {};
const OBJECTS_CONFIG = OBJECTS ?? {};
const OBJECT_SPAWN_MARGIN = Number.isFinite(OBJECTS_CONFIG.SPAWN_MARGIN) ? OBJECTS_CONFIG.SPAWN_MARGIN : 160;
const OBJECT_STAR_PADDING = Number.isFinite(OBJECTS_CONFIG.STAR_PADDING) ? OBJECTS_CONFIG.STAR_PADDING : 120;
const SHIP_RADIUS = Number.isFinite(SHIP?.COLLISION_RADIUS) ? SHIP.COLLISION_RADIUS : 12;
const MERIDIAN_SPINE_MULTIPLIER = Number.isFinite(MERIDIAN.SPINE_WIDTH_MULTIPLIER)
  ? MERIDIAN.SPINE_WIDTH_MULTIPLIER
  : 1;
const SPECIAL_TYPES = new Set([
  SECTOR_TYPES.APSE,
  SECTOR_TYPES.QUIET_REACH,
  SECTOR_TYPES.MERIDIAN,
  SECTOR_TYPES.PALIMPSEST
]);
const OBJECT_BLOCKED_SECTORS = new Set([
  ...SPECIAL_TYPES,
  SECTOR_TYPES.SIGNAL_ORIGIN
]);
const APSE_GRID_SIZE = 4;
const APSE_BLOCK_CHANCE = 0.33;
const QUIET_REACH_BLOCK_CHANCE = 0.5;
const MERIDIAN_BLOCK_CHANCE = 0.25;
const PALIMPSEST_BLOCK_CHANCE = 0.15;
const SPECIAL_BLOCK_EXCLUSION = 1;
const QUIET_REACH_BLOCK_SALT = SEED_SALT.SPECIAL + 11;
const QUIET_REACH_OFFSET_SALT = SEED_SALT.SPECIAL + 12;
const MERIDIAN_BLOCK_SALT = SEED_SALT.SPECIAL + 13;
const MERIDIAN_OFFSET_SALT = SEED_SALT.SPECIAL + 14;
const PALIMPSEST_BLOCK_SALT = SEED_SALT.SPECIAL + 15;
const PALIMPSEST_OFFSET_SALT = SEED_SALT.SPECIAL + 16;
const FORCE_APSE_NEAR_ORIGIN = Boolean(APSE.FORCE_NEAR_ORIGIN);
const FORCE_APSE_RING = Number.isFinite(APSE.FORCE_NEAR_ORIGIN_RING)
  ? Math.max(0, Math.floor(APSE.FORCE_NEAR_ORIGIN_RING))
  : 1;
const FORCE_APSE_SECTOR = Number.isFinite(APSE.FORCE_SECTOR?.sx) && Number.isFinite(APSE.FORCE_SECTOR?.sy)
  ? { sx: Math.floor(APSE.FORCE_SECTOR.sx), sy: Math.floor(APSE.FORCE_SECTOR.sy) }
  : null;
let cachedForcedApse = null;
const FORCE_MERIDIAN_NEAR_ORIGIN = Boolean(MERIDIAN.FORCE_NEAR_ORIGIN);
const FORCE_MERIDIAN_SECTOR = Number.isFinite(MERIDIAN.FORCE_SECTOR?.sx) && Number.isFinite(MERIDIAN.FORCE_SECTOR?.sy)
  ? { sx: Math.floor(MERIDIAN.FORCE_SECTOR.sx), sy: Math.floor(MERIDIAN.FORCE_SECTOR.sy) }
  : { sx: 0, sy: -1 };
const FORCE_SIGNAL_ORIGIN_NEAR_ORIGIN = Boolean(SIGNAL_ORIGIN.FORCE_NEAR_ORIGIN);
const FORCE_SIGNAL_ORIGIN_SECTOR = Number.isFinite(SIGNAL_ORIGIN.FORCE_SECTOR?.sx)
  && Number.isFinite(SIGNAL_ORIGIN.FORCE_SECTOR?.sy)
  ? { sx: Math.floor(SIGNAL_ORIGIN.FORCE_SECTOR.sx), sy: Math.floor(SIGNAL_ORIGIN.FORCE_SECTOR.sy) }
  : { sx: 0, sy: -1 };
const FORCE_PALIMPSEST_NEAR_ORIGIN = Boolean(PALIMPSEST.FORCE_NEAR_ORIGIN);
const FORCE_PALIMPSEST_SECTOR = Number.isFinite(PALIMPSEST.FORCE_SECTOR?.sx) && Number.isFinite(PALIMPSEST.FORCE_SECTOR?.sy)
  ? { sx: Math.floor(PALIMPSEST.FORCE_SECTOR.sx), sy: Math.floor(PALIMPSEST.FORCE_SECTOR.sy) }
  : { sx: 0, sy: -1 };


function randomPointInBounds(rng, bounds, margin) {
  return {
    x: randomRange(rng, bounds.x + margin, bounds.x + bounds.size - margin),
    y: randomRange(rng, bounds.y + margin, bounds.y + bounds.size - margin)
  };
}

function pickObjectPosition(rng, bounds, stars, safePoint, safeRadius, station, radius = 0) {
  const margin = OBJECT_SPAWN_MARGIN + radius;
  const starPad = OBJECT_STAR_PADDING + radius;
  for (let tries = 0; tries < 30; tries++) {
    const pos = randomPointInBounds(rng, bounds, margin);
    if (safePoint) {
      const dx = pos.x - safePoint.x;
      const dy = pos.y - safePoint.y;
      if (Math.hypot(dx, dy) < safeRadius + radius + OBJECT_SPAWN_MARGIN * 0.5) {
        continue;
      }
    }
    if (station) {
      const dx = pos.x - station.x;
      const dy = pos.y - station.y;
      if (Math.hypot(dx, dy) < (station.safeRadius ?? STATION_SAFE_RADIUS) + radius + 20) {
        continue;
      }
    }
    let blocked = false;
    for (const star of stars) {
      const dx = pos.x - star.x;
      const dy = pos.y - star.y;
      if (Math.hypot(dx, dy) < star.radius + starPad) {
        blocked = true;
        break;
      }
    }
    if (blocked) {
      continue;
    }
    return pos;
  }
  return null;
}

function applyVariance(rng, value, variance) {
  const factor = 1 - variance + rng() * (variance * 2);
  return value * factor;
}

function buildMeridianParams(seed) {
  const rng = createRng(seed);
  return {
    axisAngle: rng() * Math.PI,
    sideSign: rng() < 0.5 ? -1 : 1
  };
}

function buildPalimpsestSingularity(bounds, seed) {
  const center = {
    x: bounds.x + bounds.size / 2,
    y: bounds.y + bounds.size / 2
  };
  const rng = createRng(seed);
  const type = STAR_TYPES.singularity ?? STAR_TYPES.blue;
  const baseMass = randomRange(rng, STAR.MASS_MIN, STAR.MASS_MAX);
  const mass = baseMass * type.massMultiplier * (PALIMPSEST_SINGULARITY.MASS_MULTIPLIER ?? 1);
  const radius = Math.max(1, bounds.size * (PALIMPSEST_SINGULARITY.RADIUS_RATIO ?? 0.08));
  const gravityRadius = Math.max(radius * 1.1, bounds.size * (PALIMPSEST_SINGULARITY.GRAVITY_RATIO ?? 0.48));
  const rimThickness = radius * (PALIMPSEST_SINGULARITY.RIM_THICKNESS_RATIO ?? 0.12);
  const flashArcSpan = (PALIMPSEST_SINGULARITY.FLASH_ARC_SPAN_DEG ?? 70) * Math.PI / 180;
  return new Star(center.x, center.y, {
    mass,
    bodyRadius: radius,
    gravityRadius,
    bodyColor: type.bodyColor ?? "rgb(12, 12, 18)",
    wellFill: type.wellFill ?? "rgba(20, 22, 30, 0.18)",
    wellStroke: type.wellStroke ?? "rgba(80, 90, 120, 0.22)",
    minimapColor: type.minimapColor ?? "rgb(80, 90, 120)",
    spriteKey: type.spriteKey ?? "singularity",
    rotation: 0,
    rotationSpeed: 0,
    pulseSpeed: PALIMPSEST_SINGULARITY.SHIMMER_SPEED ?? 0.35,
    pulseAmount: PALIMPSEST_SINGULARITY.SHIMMER_AMOUNT ?? 0.45,
    pulsePhase: randomRange(rng, 0, Math.PI * 2),
    special: {
      type: "singularity",
      rimColor: PALIMPSEST_SINGULARITY.RIM_COLOR ?? "rgba(140, 160, 200, 0.6)",
      rimBright: PALIMPSEST_SINGULARITY.RIM_BRIGHT ?? "rgba(210, 230, 255, 0.8)",
      rimThickness,
      shimmerAmount: PALIMPSEST_SINGULARITY.SHIMMER_AMOUNT ?? 0.45,
      flashDuration: PALIMPSEST_SINGULARITY.FLASH_DURATION ?? 0.35,
      flashAlpha: PALIMPSEST_SINGULARITY.FLASH_ALPHA ?? 0.7,
      flashArcSpan,
      flashColors: Array.isArray(PALIMPSEST_SINGULARITY.FLASH_COLORS)
        ? PALIMPSEST_SINGULARITY.FLASH_COLORS
        : []
    }
  });
}

function buildPalimpsestFragments(bounds, seed, center) {
  const rng = createRng(seed);
  const sprites = Array.isArray(PALIMPSEST_FRAGMENTS.SPRITES) ? PALIMPSEST_FRAGMENTS.SPRITES : [];
  const count = Math.max(1, sprites.length || 6);
  const rMax = bounds.size * 0.5;
  const orbitMin = rMax * (PALIMPSEST_FRAGMENTS.ORBIT_MIN_RATIO ?? 0.22);
  const orbitMax = rMax * (PALIMPSEST_FRAGMENTS.ORBIT_MAX_RATIO ?? 0.68);
  const radius = rMax * (PALIMPSEST_FRAGMENTS.RADIUS_RATIO ?? 0.04);
  const minSpacing = radius * 2.2;
  const baseStep = (orbitMax - orbitMin) / Math.max(1, count - 1);
  const step = Math.max(baseStep, minSpacing);
  const span = step * Math.max(0, count - 1);
  const start = orbitMin + Math.max(0, (orbitMax - orbitMin - span) * 0.5);
  const orbitAngle = randomRange(rng, 0, Math.PI * 2);
  const fragments = [];
  for (let i = 0; i < count; i++) {
    const orbitRadius = start + step * i;
    const orbitSpeed = randomRange(rng, PALIMPSEST_FRAGMENTS.ORBIT_SPEED_MIN ?? 0.012, PALIMPSEST_FRAGMENTS.ORBIT_SPEED_MAX ?? 0.028)
      * (rng() < 0.5 ? -1 : 1);
    const spinSpeed = randomRange(rng, PALIMPSEST_FRAGMENTS.SPIN_SPEED_MIN ?? 0.08, PALIMPSEST_FRAGMENTS.SPIN_SPEED_MAX ?? 0.22)
      * (rng() < 0.5 ? -1 : 1);
    const orbitPhase = randomRange(rng, 0, Math.PI * 2);
    const eccentricity = PALIMPSEST_FRAGMENTS.ORBIT_ECCENTRICITY ?? 0.12;
    fragments.push(new PalimpsestFragment({
      center,
      orbitRadius,
      orbitSpeed,
      orbitPhase,
      orbitAngle,
      eccentricity,
      radius,
      spinSpeed,
      spriteIndex: i,
      bounce: PALIMPSEST_FRAGMENTS.BOUNCE ?? 0.82
    }));
  }
  return fragments;
}

function getStarTypeConfig(typeId) {
  return STAR_TYPES[typeId] ?? STAR_TYPES.red;
}

function getStarRotationRange(typeId) {
  if (typeId === "blue") {
    return [STAR_ROTATION.BLUE_MIN, STAR_ROTATION.BLUE_MAX];
  }
  if (typeId === "red") {
    return [STAR_ROTATION.RED_MIN, STAR_ROTATION.RED_MAX];
  }
  return [STAR_ROTATION.YELLOW_MIN, STAR_ROTATION.YELLOW_MAX];
}

function getStarPulseConfig(typeId) {
  if (typeId === "blue") {
    return {
      speedMin: STAR_PULSE.BLUE_SPEED_MIN,
      speedMax: STAR_PULSE.BLUE_SPEED_MAX,
      amount: STAR_PULSE.BLUE_AMOUNT
    };
  }
  if (typeId === "red") {
    return {
      speedMin: STAR_PULSE.RED_SPEED_MIN,
      speedMax: STAR_PULSE.RED_SPEED_MAX,
      amount: STAR_PULSE.RED_AMOUNT
    };
  }
  return {
    speedMin: STAR_PULSE.YELLOW_SPEED_MIN,
    speedMax: STAR_PULSE.YELLOW_SPEED_MAX,
    amount: STAR_PULSE.YELLOW_AMOUNT
  };
}

function getZoneConfig(ring) {
  if (ring === 0) {
    return ZONES.start;
  }
  if (ring === 1) {
    return ZONES.middle;
  }
  return ZONES.outer;
}

function normalizeSectorType(value) {
  return Object.values(SECTOR_TYPES).includes(value) ? value : SECTOR_TYPES.GENERIC;
}

function normalizeSectorMood(value) {
  return SECTOR_MOODS.includes(value) ? value : "NEUTRAL";
}

function getInfluenceBand(exposure) {
  if (exposure < 0.15) return 0;
  if (exposure < 0.35) return 1;
  if (exposure < 0.6) return 2;
  if (exposure < 0.9) return 3;
  return 4;
}

function buildSpawnProfile(sectorType, exposure) {
  const base = SPAWN_PROFILES[sectorType] ?? SPAWN_PROFILES[SECTOR_TYPES.GENERIC];
  const profile = { ...base };
  const band = getInfluenceBand(exposure);
  if (band >= 4) {
    profile.scanPoints *= 0.85;
  }
  return profile;
}

function chooseSectorType(rng, exposure, ring, cooldownReady) {
  const influence = Math.max(0, exposure);
  const echoEligible = influence >= ECHO_MIN_EXPOSURE;
  const band = getInfluenceBand(influence);
  let deadQuiet = 0.08 + 0.18 * influence;
  let derelict = 0.06 + 0.1 * influence;
  let anomaly = 0.04 + 0.22 * influence;
  let echo = echoEligible ? 0.02 + 0.25 * (influence - ECHO_MIN_EXPOSURE) : 0;
  let origin = (ring >= MIN_ORIGIN_RING && cooldownReady) ? (0.01 + 0.02 * influence) : 0;

  if (band >= 1) {
    deadQuiet += 0.03 * band;
  }
  if (band >= 3) {
    anomaly += 0.03 * (band - 2);
  }

  const entries = [
    { id: SECTOR_TYPES.GENERIC, weight: 1.0 },
    { id: SECTOR_TYPES.DEAD_QUIET, weight: Math.max(0, deadQuiet) },
    { id: SECTOR_TYPES.DERELICT_FIELD, weight: Math.max(0, derelict) },
    { id: SECTOR_TYPES.ANOMALY, weight: Math.max(0, anomaly) },
    { id: SECTOR_TYPES.ECHO, weight: Math.max(0, echo) },
    { id: SECTOR_TYPES.SIGNAL_ORIGIN, weight: Math.max(0, origin) }
  ];

  return pickWeighted(rng, entries) ?? SECTOR_TYPES.GENERIC;
}

function chooseSectorMood(rng, sectorType, exposure) {
  if (sectorType === SECTOR_TYPES.DEAD_QUIET) return "QUIET";
  if (sectorType === SECTOR_TYPES.ANOMALY) return "UNSETTLING";
  if (sectorType === SECTOR_TYPES.ECHO) return "FAMILIAR";
  if (sectorType === SECTOR_TYPES.DERELICT_FIELD) return "ARTIFICIAL";
  if (sectorType === SECTOR_TYPES.SIGNAL_ORIGIN) return "UNSETTLING";
  if (sectorType === SECTOR_TYPES.QUIET_REACH) return "QUIET";
  if (sectorType === SECTOR_TYPES.MERIDIAN) return "FAMILIAR";
  if (sectorType === SECTOR_TYPES.PALIMPSEST) return "UNSETTLING";
  if (sectorType === SECTOR_TYPES.APSE) return "ARTIFICIAL";

  const moods = exposure >= 0.6 ? ["NEUTRAL", "QUIET", "FAMILIAR"] : ["NEUTRAL", "QUIET"];
  return moods[randomInt(rng, 0, moods.length - 1)];
}

function pickAnomalyModifier(rng) {
  return ANOMALY_MODIFIERS[randomInt(rng, 0, ANOMALY_MODIFIERS.length - 1)];
}

function scaleCountRange(range, multiplier) {
  const min = Math.max(0, Math.floor(range.min * multiplier));
  const max = Math.max(min, Math.floor(range.max * multiplier));
  return { min, max };
}

function getClueProgress(gameState) {
  const total = Math.max(0, Math.floor(gameState?.clues?.totalCollected ?? 0));
  if (!Number.isFinite(CLUE_TOTAL) || CLUE_TOTAL <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, total / CLUE_TOTAL));
}

function getForcedApseSector(worldSeed) {
  if (!FORCE_APSE_NEAR_ORIGIN) {
    return null;
  }
  if (FORCE_APSE_SECTOR) {
    return { seed: worldSeed, sx: FORCE_APSE_SECTOR.sx, sy: FORCE_APSE_SECTOR.sy };
  }
  if (cachedForcedApse?.seed === worldSeed) {
    return cachedForcedApse;
  }
  const candidates = [];
  for (let sx = -1; sx <= 1; sx++) {
    for (let sy = -1; sy <= 1; sy++) {
      candidates.push({ sx, sy });
    }
  }
  const seed = hashInts(worldSeed, 0, 0, SEED_SALT.SPECIAL + 9);
  const rng = createRng(seed);
  const pick = candidates[randomInt(rng, 0, candidates.length - 1)];
  cachedForcedApse = { seed: worldSeed, sx: pick.sx, sy: pick.sy };
  return cachedForcedApse;
}

function isForcedApseSector(worldSeed, sx, sy, ring) {
  if (!FORCE_APSE_NEAR_ORIGIN) {
    return false;
  }
  if (ring > FORCE_APSE_RING) {
    return false;
  }
  const forced = getForcedApseSector(worldSeed);
  return Boolean(forced && forced.sx === sx && forced.sy === sy);
}

function isForcedMeridianSector(worldSeed, sx, sy) {
  if (!FORCE_MERIDIAN_NEAR_ORIGIN) {
    return false;
  }
  return sx === FORCE_MERIDIAN_SECTOR.sx && sy === FORCE_MERIDIAN_SECTOR.sy;
}

function isForcedSignalOriginSector(sx, sy) {
  if (!FORCE_SIGNAL_ORIGIN_NEAR_ORIGIN) {
    return false;
  }
  return sx === FORCE_SIGNAL_ORIGIN_SECTOR.sx && sy === FORCE_SIGNAL_ORIGIN_SECTOR.sy;
}

function isForcedPalimpsestSector(worldSeed, sx, sy) {
  if (!FORCE_PALIMPSEST_NEAR_ORIGIN) {
    return false;
  }
  return sx === FORCE_PALIMPSEST_SECTOR.sx && sy === FORCE_PALIMPSEST_SECTOR.sy;
}

function getApseOffset(worldSeed, gx, gy) {
  const seed = hashInts(worldSeed, gx, gy, SEED_SALT.SPECIAL);
  const rng = createRng(seed);
  return {
    ox: randomInt(rng, 0, APSE_GRID_SIZE - 1),
    oy: randomInt(rng, 0, APSE_GRID_SIZE - 1)
  };
}

function getSpecialOffset(worldSeed, gx, gy, salt) {
  const seed = hashInts(worldSeed, gx, gy, salt);
  const rng = createRng(seed);
  return {
    ox: randomInt(rng, 0, APSE_GRID_SIZE - 1),
    oy: randomInt(rng, 0, APSE_GRID_SIZE - 1)
  };
}

function getSpecialBlockValue(worldSeed, gx, gy, salt) {
  const seed = hashInts(worldSeed, gx, gy, salt);
  const rng = createRng(seed);
  return rng();
}

function shouldClaimSpecialBlock(worldSeed, gx, gy, chance, salt) {
  const value = getSpecialBlockValue(worldSeed, gx, gy, salt);
  if (value >= chance) {
    return false;
  }
  for (let dx = -SPECIAL_BLOCK_EXCLUSION; dx <= SPECIAL_BLOCK_EXCLUSION; dx++) {
    for (let dy = -SPECIAL_BLOCK_EXCLUSION; dy <= SPECIAL_BLOCK_EXCLUSION; dy++) {
      if (dx === 0 && dy === 0) {
        continue;
      }
      const neighborValue = getSpecialBlockValue(worldSeed, gx + dx, gy + dy, salt);
      if (neighborValue < value && neighborValue < chance) {
        return false;
      }
    }
  }
  return true;
}

function shouldSpawnApseBlock(worldSeed, gx, gy) {
  return shouldClaimSpecialBlock(worldSeed, gx, gy, APSE_BLOCK_CHANCE, SEED_SALT.SPECIAL + 7);
}

function getSpecialBlockType(worldSeed, gx, gy) {
  if (shouldClaimSpecialBlock(worldSeed, gx, gy, APSE_BLOCK_CHANCE, SEED_SALT.SPECIAL + 7)) {
    return SECTOR_TYPES.APSE;
  }
  if (shouldClaimSpecialBlock(worldSeed, gx, gy, QUIET_REACH_BLOCK_CHANCE, QUIET_REACH_BLOCK_SALT)) {
    return SECTOR_TYPES.QUIET_REACH;
  }
  if (shouldClaimSpecialBlock(worldSeed, gx, gy, MERIDIAN_BLOCK_CHANCE, MERIDIAN_BLOCK_SALT)) {
    return SECTOR_TYPES.MERIDIAN;
  }
  if (shouldClaimSpecialBlock(worldSeed, gx, gy, PALIMPSEST_BLOCK_CHANCE, PALIMPSEST_BLOCK_SALT)) {
    return SECTOR_TYPES.PALIMPSEST;
  }
  return null;
}

function getSpecialOffsetForType(worldSeed, gx, gy, type) {
  switch (type) {
    case SECTOR_TYPES.APSE:
      return getApseOffset(worldSeed, gx, gy);
    case SECTOR_TYPES.QUIET_REACH:
      return getSpecialOffset(worldSeed, gx, gy, QUIET_REACH_OFFSET_SALT);
    case SECTOR_TYPES.MERIDIAN:
      return getSpecialOffset(worldSeed, gx, gy, MERIDIAN_OFFSET_SALT);
    case SECTOR_TYPES.PALIMPSEST:
      return getSpecialOffset(worldSeed, gx, gy, PALIMPSEST_OFFSET_SALT);
    default:
      return { ox: 0, oy: 0 };
  }
}

function isApseSector(worldSeed, sx, sy) {
  const ring = Math.max(Math.abs(sx), Math.abs(sy));
  if (isForcedMeridianSector(worldSeed, sx, sy) || isForcedPalimpsestSector(worldSeed, sx, sy)) {
    return false;
  }
  if (isForcedApseSector(worldSeed, sx, sy, ring)) {
    return true;
  }
  const gx = Math.floor(sx / APSE_GRID_SIZE);
  const gy = Math.floor(sy / APSE_GRID_SIZE);
  if (getSpecialBlockType(worldSeed, gx, gy) !== SECTOR_TYPES.APSE) {
    return false;
  }
  const { ox, oy } = getSpecialOffsetForType(worldSeed, gx, gy, SECTOR_TYPES.APSE);
  return sx === gx * APSE_GRID_SIZE + ox && sy === gy * APSE_GRID_SIZE + oy;
}

function isAdjacentToApse(worldSeed, sx, sy) {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) {
        continue;
      }
      if (isApseSector(worldSeed, sx + dx, sy + dy)) {
        return true;
      }
    }
  }
  return false;
}

function shouldBeQuietReach(worldSeed, sx, sy, ring, progress) {
  if (ring <= 0) {
    return false;
  }
  const gx = Math.floor(sx / APSE_GRID_SIZE);
  const gy = Math.floor(sy / APSE_GRID_SIZE);
  if (getSpecialBlockType(worldSeed, gx, gy) !== SECTOR_TYPES.QUIET_REACH) {
    return false;
  }
  const { ox, oy } = getSpecialOffsetForType(worldSeed, gx, gy, SECTOR_TYPES.QUIET_REACH);
  return sx === gx * APSE_GRID_SIZE + ox && sy === gy * APSE_GRID_SIZE + oy;
}

function pickSpecialSectorType(worldSeed, sx, sy, ring, progress) {
  if (isForcedSignalOriginSector(sx, sy)) {
    return SECTOR_TYPES.SIGNAL_ORIGIN;
  }
  if (isForcedPalimpsestSector(worldSeed, sx, sy)) {
    return SECTOR_TYPES.PALIMPSEST;
  }
  if (isForcedMeridianSector(worldSeed, sx, sy)) {
    return SECTOR_TYPES.MERIDIAN;
  }
  if (isForcedApseSector(worldSeed, sx, sy, ring)) {
    return SECTOR_TYPES.APSE;
  }
  if (ring <= 0) {
    return null;
  }
  const gx = Math.floor(sx / APSE_GRID_SIZE);
  const gy = Math.floor(sy / APSE_GRID_SIZE);
  const blockType = getSpecialBlockType(worldSeed, gx, gy);
  if (!blockType) {
    return null;
  }
  const { ox, oy } = getSpecialOffsetForType(worldSeed, gx, gy, blockType);
  return sx === gx * APSE_GRID_SIZE + ox && sy === gy * APSE_GRID_SIZE + oy
    ? blockType
    : null;
}

function mutateEchoTag(value, rng) {
  if (typeof value !== "string") {
    return null;
  }
  const parts = value.split(",");
  if (parts.length === 2) {
    const sx = Number(parts[0]);
    const sy = Number(parts[1]);
    if (Number.isFinite(sx) && Number.isFinite(sy)) {
      const dx = rng() < 0.5 ? randomInt(rng, -2, 2) : 0;
      const dy = dx === 0 ? randomInt(rng, -2, 2) : 0;
      const nx = sx + (dx === 0 ? 1 : dx);
      const ny = sy + (dy === 0 ? -1 : dy);
      return `${nx},${ny}`;
    }
  }
  const chars = value.split("");
  if (chars.length > 1) {
    const a = randomInt(rng, 0, chars.length - 1);
    const b = (a + randomInt(rng, 1, chars.length - 1)) % chars.length;
    [chars[a], chars[b]] = [chars[b], chars[a]];
    const mutated = chars.join("");
    return mutated === value ? `${value}_` : mutated;
  }
  return `${value}_`;
}

function pickEchoTag(rng, history) {
  const recent = Array.isArray(history?.recentSectors) ? history.recentSectors : [];
  if (recent.length === 0) {
    return null;
  }
  const entry = recent[randomInt(rng, 0, recent.length - 1)];
  const raw = typeof entry === "string" ? entry : entry?.id;
  const mutated = mutateEchoTag(raw, rng);
  return mutated ?? null;
}

function pickBeaconPosition(rng, bounds, safePoint, safeRadius) {
  let pos = null;
  for (let tries = 0; tries < 40; tries++) {
    const candidate = randomPointInBounds(rng, bounds, GOAL.MARGIN);
    const dx = candidate.x - safePoint.x;
    const dy = candidate.y - safePoint.y;
    if (Math.hypot(dx, dy) < safeRadius + BEACON_SAFE_PADDING) {
      continue;
    }
    pos = candidate;
    break;
  }
  if (!pos) {
    pos = randomPointInBounds(rng, bounds, GOAL.MARGIN);
  }
  return pos;
}

function getStarCountsForRing(ring) {
  if (ring === 0) {
    return {
      red: { min: 1, max: 1 },
      yellow: { min: 0, max: 0 },
      blue: { min: 0, max: 0 }
    };
  }
  if (ring === 1) {
    return {
      red: { min: 1, max: 2 },
      yellow: { min: 1, max: 2 },
      blue: { min: 0, max: 0 }
    };
  }
  if (ring === 2) {
    return {
      red: { min: 2, max: 3 },
      yellow: { min: 2, max: 3 },
      blue: { min: 1, max: 1 }
    };
  }
  return {
    red: { min: ring, max: ring + 1 },
    yellow: { min: ring, max: ring + 1 },
    blue: { min: ring - 2, max: ring - 1 }
  };
}

function getPatternBehaviorForField(fieldType) {
  if (fieldType === FIELD_TYPES.GEOMETRIC_LATTICE) return "ORTHOGONAL_BEHAVIOR";
  if (fieldType === FIELD_TYPES.GEOMETRIC_RADIAL) return "RADIAL_BEHAVIOR";
  if (fieldType === FIELD_TYPES.BRAIDED_FLOW) return "LINEAR_BEHAVIOR";
  if (fieldType === FIELD_TYPES.CHAOTIC_CLUSTER) return "CLUSTER_BEHAVIOR";
  if (fieldType === FIELD_TYPES.SPARSE_VOID) return "CHAOTIC_BEHAVIOR";
  return "CHAOTIC_BEHAVIOR";
}

function getFieldTypeForPattern(patternId, fallback) {
  if (patternId === "ORTHOGONAL_BEHAVIOR") return FIELD_TYPES.GEOMETRIC_LATTICE;
  if (patternId === "RADIAL_BEHAVIOR") return FIELD_TYPES.GEOMETRIC_RADIAL;
  if (patternId === "LINEAR_BEHAVIOR") return FIELD_TYPES.BRAIDED_FLOW;
  if (patternId === "CLUSTER_BEHAVIOR") return FIELD_TYPES.CHAOTIC_CLUSTER;
  if (patternId === "CHAOTIC_BEHAVIOR") return FIELD_TYPES.SPARSE_VOID;
  return fallback ?? FIELD_TYPES.CHAOTIC_CLUSTER;
}

function getFieldTypeOverride(sectorType, fallback) {
  if (sectorType === SECTOR_TYPES.QUIET_REACH) {
    return FIELD_TYPES.SPARSE_VOID;
  }
  if (sectorType === SECTOR_TYPES.APSE) {
    return FIELD_TYPES.SPARSE_VOID;
  }
  if (sectorType === SECTOR_TYPES.MERIDIAN) {
    return FIELD_TYPES.GEOMETRIC_LATTICE;
  }
  if (sectorType === SECTOR_TYPES.PALIMPSEST) {
    return FIELD_TYPES.CHAOTIC_CLUSTER;
  }
  return fallback;
}

function createStarPattern(rng, bounds, fieldType, patternId) {
  const resolvedField = getFieldTypeForPattern(patternId, fieldType);
  const center = {
    x: bounds.x + bounds.size / 2,
    y: bounds.y + bounds.size / 2
  };
  if (resolvedField === FIELD_TYPES.GEOMETRIC_LATTICE) {
    const gridCount = 3;
    const spacing = bounds.size / (gridCount + 1);
    return {
      type: resolvedField,
      center,
      gridCount,
      spacing,
      jitter: spacing * 0.2
    };
  }
  if (resolvedField === FIELD_TYPES.GEOMETRIC_RADIAL) {
    return {
      type: resolvedField,
      center: {
        x: center.x + (rng() - 0.5) * bounds.size * 0.08,
        y: center.y + (rng() - 0.5) * bounds.size * 0.08
      },
      ringMin: bounds.size * 0.18,
      ringMax: bounds.size * 0.38
    };
  }
  if (resolvedField === FIELD_TYPES.BRAIDED_FLOW) {
    const angle = rng() * Math.PI * 2;
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };
    return {
      type: resolvedField,
      center,
      dir,
      cross: { x: -dir.y, y: dir.x },
      span: bounds.size * 0.35,
      spread: bounds.size * 0.2
    };
  }
  if (resolvedField === FIELD_TYPES.CHAOTIC_CLUSTER) {
    return {
      type: resolvedField,
      center: randomPointInBounds(rng, bounds, STAR.MARGIN),
      clusterRadius: bounds.size * 0.28
    };
  }
  return {
    type: resolvedField,
    center
  };
}

function pickStarCandidate(rng, bounds, margin, pattern, starIndex) {
  const type = pattern?.type;
  if (type === FIELD_TYPES.GEOMETRIC_LATTICE) {
    const col = randomInt(rng, 0, pattern.gridCount - 1);
    const row = randomInt(rng, 0, pattern.gridCount - 1);
    const jitterX = (rng() - 0.5) * pattern.jitter;
    const jitterY = (rng() - 0.5) * pattern.jitter;
    const x = bounds.x + pattern.spacing * (col + 1) + jitterX;
    const y = bounds.y + pattern.spacing * (row + 1) + jitterY;
    return {
      x: clamp(x, bounds.x + margin, bounds.x + bounds.size - margin),
      y: clamp(y, bounds.y + margin, bounds.y + bounds.size - margin)
    };
  }
  if (type === FIELD_TYPES.GEOMETRIC_RADIAL) {
    if (starIndex === 0) {
      return {
        x: clamp(pattern.center.x, bounds.x + margin, bounds.x + bounds.size - margin),
        y: clamp(pattern.center.y, bounds.y + margin, bounds.y + bounds.size - margin)
      };
    }
    const angle = rng() * Math.PI * 2;
    const radius = randomRange(rng, pattern.ringMin, pattern.ringMax);
    const x = pattern.center.x + Math.cos(angle) * radius;
    const y = pattern.center.y + Math.sin(angle) * radius;
    return {
      x: clamp(x, bounds.x + margin, bounds.x + bounds.size - margin),
      y: clamp(y, bounds.y + margin, bounds.y + bounds.size - margin)
    };
  }
  if (type === FIELD_TYPES.BRAIDED_FLOW) {
    const t = randomRange(rng, -1, 1);
    const offset = randomRange(rng, -pattern.spread, pattern.spread);
    const baseX = pattern.center.x + pattern.dir.x * t * pattern.span;
    const baseY = pattern.center.y + pattern.dir.y * t * pattern.span;
    const x = baseX + pattern.cross.x * offset;
    const y = baseY + pattern.cross.y * offset;
    return {
      x: clamp(x, bounds.x + margin, bounds.x + bounds.size - margin),
      y: clamp(y, bounds.y + margin, bounds.y + bounds.size - margin)
    };
  }
  if (type === FIELD_TYPES.CHAOTIC_CLUSTER) {
    const angle = rng() * Math.PI * 2;
    const radius = randomRange(rng, 0, pattern.clusterRadius);
    const x = pattern.center.x + Math.cos(angle) * radius;
    const y = pattern.center.y + Math.sin(angle) * radius;
    return {
      x: clamp(x, bounds.x + margin, bounds.x + bounds.size - margin),
      y: clamp(y, bounds.y + margin, bounds.y + bounds.size - margin)
    };
  }
  return randomPointInBounds(rng, bounds, margin);
}

function generateStars(
  rng,
  bounds,
  ring,
  starMultiplier,
  safePoint,
  safeRadius,
  fieldType,
  patternInfo = {},
  safetyTargets = null,
  meridian = null
) {
  const stars = [];
  if (!Number.isFinite(starMultiplier) || starMultiplier <= 0) {
    return stars;
  }
  const sectorCenter = {
    x: bounds.x + bounds.size / 2,
    y: bounds.y + bounds.size / 2
  };
  const counts = getStarCountsForRing(ring);
  const rateMultiplier = starMultiplier * STAR_RATE_MULTIPLIER;
  const scaled = {
    red: scaleCountRange(counts.red, rateMultiplier),
    yellow: scaleCountRange(counts.yellow, rateMultiplier),
    blue: scaleCountRange(counts.blue, rateMultiplier)
  };
  const minCounts = {
    red: scaled.red.min,
    yellow: scaled.yellow.min,
    blue: scaled.blue.min
  };
  const targetCounts = {
    red: randomInt(rng, scaled.red.min, scaled.red.max),
    yellow: randomInt(rng, scaled.yellow.min, scaled.yellow.max),
    blue: randomInt(rng, scaled.blue.min, scaled.blue.max)
  };
  const hasMeridian = meridian
    && Number.isFinite(meridian.axisAngle)
    && Number.isFinite(meridian.spineWidth);
  if (hasMeridian) {
    minCounts.red = Math.floor(minCounts.red / 2);
    minCounts.yellow = Math.floor(minCounts.yellow / 2);
    minCounts.blue = Math.floor(minCounts.blue / 2);
    targetCounts.red = Math.floor(targetCounts.red / 2);
    targetCounts.yellow = Math.floor(targetCounts.yellow / 2);
    targetCounts.blue = Math.floor(targetCounts.blue / 2);
  }
  let starBudget = targetCounts.red + targetCounts.yellow + targetCounts.blue;
  const minTotal = minCounts.red + minCounts.yellow + minCounts.blue;
  const isSparseVoid = fieldType === FIELD_TYPES.SPARSE_VOID && ring <= FIELD.VOID_ALLOWED_MAX_RING;

  if (isSparseVoid) {
    if (rng() < FIELD.VOID_ZERO_STAR_PROB) {
      return stars;
    }
    starBudget = 1;
  } else if (starBudget < minTotal) {
    starBudget = minTotal;
  }

  const starPlan = [];
  if (!isSparseVoid) {
    for (const type of ["red", "yellow", "blue"]) {
      for (let i = 0; i < minCounts[type]; i++) {
        starPlan.push(type);
      }
    }
  }
  const remaining = Math.max(0, starBudget - starPlan.length);
  const weightEntries = ["red", "yellow", "blue"].map((type) => {
    const base = targetCounts[type] - (isSparseVoid ? 0 : minCounts[type]);
    return { id: type, weight: Math.max(0, base) };
  });
  let weightTotal = weightEntries.reduce((sum, entry) => sum + entry.weight, 0);
  if (weightTotal <= 0) {
    weightEntries[0].weight = Math.max(1, targetCounts.red);
    weightEntries[1].weight = Math.max(1, targetCounts.yellow);
    weightEntries[2].weight = Math.max(1, targetCounts.blue);
    weightTotal = weightEntries.reduce((sum, entry) => sum + entry.weight, 0);
  }
  for (let i = 0; i < remaining; i++) {
    const nextType = pickWeighted(rng, weightEntries) ?? "red";
    starPlan.push(nextType);
  }

  const patternSeed = Number.isFinite(patternInfo?.patternParamsSeed)
    ? patternInfo.patternParamsSeed
    : hashInts(Math.floor(bounds.x), Math.floor(bounds.y), ring, SEED_SALT.PATTERN);
  const patternRng = createRng(patternSeed);
  const pattern = createStarPattern(patternRng, bounds, fieldType, patternInfo?.patternId);
  let starIndex = 0;
  let failureStreak = 0;
  const meridianCenter = hasMeridian
    ? (meridian.center ?? sectorCenter)
    : null;
  const meridianNx = hasMeridian ? -Math.sin(meridian.axisAngle) : 0;
  const meridianNy = hasMeridian ? Math.cos(meridian.axisAngle) : 0;
  const meridianSide = hasMeridian ? (Math.sign(meridian.sideSign) || 1) : 1;
  const meridianSpineHalf = hasMeridian ? meridian.spineWidth * 0.5 : 0;

  for (const entry of starPlan) {
    const type = getStarTypeConfig(entry);
    const baseMass = randomRange(rng, STAR.MASS_MIN, STAR.MASS_MAX);
    const mass = applyVariance(rng, baseMass * type.massMultiplier, STAR_WELL.VARIANCE);
    const gravityRadius = applyVariance(
      rng,
      STAR_WELL.BASE_RADIUS * type.wellMultiplier,
      STAR_WELL.VARIANCE
    );
    const bodyRadius = STAR.BODY_RADIUS;
    const [rotMin, rotMax] = getStarRotationRange(type.id);
    const rotSpeed = randomRange(rng, rotMin, rotMax) * (rng() < 0.5 ? -1 : 1);
    const pulseCfg = getStarPulseConfig(type.id);
    const pulseSpeed = randomRange(rng, pulseCfg.speedMin, pulseCfg.speedMax);
    const pulseAmount = pulseCfg.amount;
    const pulsePhase = randomRange(rng, 0, Math.PI * 2);
      const rotation = randomRange(rng, 0, Math.PI * 2);
      const motion = null;

      let pos = null;
      let mirrored = null;
      for (let tries = 0; tries < STAR_PLACEMENT.MAX_TRIES_PER_STAR; tries++) {
        const candidate = pickStarCandidate(patternRng, bounds, STAR.MARGIN, pattern, starIndex);
        const centerDx = candidate.x - sectorCenter.x;
        const centerDy = candidate.y - sectorCenter.y;
        if (Math.hypot(centerDx, centerDy) < gravityRadius) {
          continue;
        }
      if (safePoint) {
        const dx = candidate.x - safePoint.x;
        const dy = candidate.y - safePoint.y;
        const minDist = Math.max(safeRadius, gravityRadius + 200);
        if (Math.hypot(dx, dy) < minDist) {
          continue;
        }
      }
      if (safetyTargets && motion) {
        const center = motion.center ?? candidate;
        const radius = motion.radius ?? 0;
        const buffer = STAR_MOTION.SAFETY_BUFFER;
        if (safetyTargets.goal && safetyTargets.goal.minDist !== undefined) {
          const dx = center.x - safetyTargets.goal.x;
          const dy = center.y - safetyTargets.goal.y;
          if (Math.hypot(dx, dy) < safetyTargets.goal.minDist + gravityRadius + radius + buffer) {
            continue;
          }
        }
        if (safetyTargets.beacon && safetyTargets.beacon.minDist !== undefined) {
          const dx = center.x - safetyTargets.beacon.x;
          const dy = center.y - safetyTargets.beacon.y;
          if (Math.hypot(dx, dy) < safetyTargets.beacon.minDist + gravityRadius + radius + buffer) {
            continue;
          }
          }
        }

        if (hasMeridian && meridianCenter) {
          const mx = candidate.x - meridianCenter.x;
          const my = candidate.y - meridianCenter.y;
          const distToLine = mx * meridianNx + my * meridianNy;
          if (distToLine * meridianSide <= meridianSpineHalf + gravityRadius) {
            continue;
          }
          const mirrorX = candidate.x - 2 * distToLine * meridianNx;
          const mirrorY = candidate.y - 2 * distToLine * meridianNy;
          if (mirrorX < bounds.x + STAR.MARGIN
            || mirrorX > bounds.x + bounds.size - STAR.MARGIN
            || mirrorY < bounds.y + STAR.MARGIN
            || mirrorY > bounds.y + bounds.size - STAR.MARGIN) {
            continue;
          }
          const mirrorCenterDx = mirrorX - sectorCenter.x;
          const mirrorCenterDy = mirrorY - sectorCenter.y;
          if (Math.hypot(mirrorCenterDx, mirrorCenterDy) < gravityRadius) {
            continue;
          }
          if (safePoint) {
            const mdx = mirrorX - safePoint.x;
            const mdy = mirrorY - safePoint.y;
            const minDist = Math.max(safeRadius, gravityRadius + 200);
            if (Math.hypot(mdx, mdy) < minDist) {
              continue;
            }
          }
          if (safetyTargets && motion) {
            const center = motion.center ?? candidate;
            const radius = motion.radius ?? 0;
            const buffer = STAR_MOTION.SAFETY_BUFFER;
            if (safetyTargets.goal && safetyTargets.goal.minDist !== undefined) {
              const mdx = mirrorX - safetyTargets.goal.x;
              const mdy = mirrorY - safetyTargets.goal.y;
              if (Math.hypot(mdx, mdy) < safetyTargets.goal.minDist + gravityRadius + radius + buffer) {
                continue;
              }
            }
            if (safetyTargets.beacon && safetyTargets.beacon.minDist !== undefined) {
              const mdx = mirrorX - safetyTargets.beacon.x;
              const mdy = mirrorY - safetyTargets.beacon.y;
              if (Math.hypot(mdx, mdy) < safetyTargets.beacon.minDist + gravityRadius + radius + buffer) {
                continue;
              }
            }
          }
          mirrored = { x: mirrorX, y: mirrorY };
        }

        let overlap = false;
        for (const star of stars) {
          const dx = candidate.x - star.x;
          const dy = candidate.y - star.y;
        const dist = Math.hypot(dx, dy);
        if (dist < bodyRadius + star.radius) {
          overlap = true;
          break;
        }
        const minWellDist = (gravityRadius + star.gravityRadius) * 0.9;
        if (dist < minWellDist) {
          overlap = true;
            break;
          }
        }
        if (!overlap && mirrored) {
          for (const star of stars) {
            const dx = mirrored.x - star.x;
            const dy = mirrored.y - star.y;
            const dist = Math.hypot(dx, dy);
            if (dist < bodyRadius + star.radius) {
              overlap = true;
              break;
            }
            const minWellDist = (gravityRadius + star.gravityRadius) * 0.9;
            if (dist < minWellDist) {
              overlap = true;
              break;
            }
          }
        }
        if (overlap) {
          continue;
        }
        pos = candidate;
        break;
      }
    if (!pos) {
      failureStreak += 1;
      if (failureStreak >= STAR_PLACEMENT.MAX_CONSECUTIVE_FAILURES) {
        break;
      }
      continue;
    }

      stars.push(new Star(pos.x, pos.y, {
        mass,
        bodyRadius,
        gravityRadius,
        bodyColor: type.bodyColor,
        wellFill: type.wellFill,
        wellStroke: type.wellStroke,
        minimapColor: type.minimapColor,
        spriteKey: type.spriteKey,
        rotation: rotation,
        rotationSpeed: rotSpeed,
        pulsePhase,
        pulseSpeed,
        pulseAmount,
        motion
      }));
      if (mirrored) {
        stars.push(new Star(mirrored.x, mirrored.y, {
          mass,
          bodyRadius,
          gravityRadius,
          bodyColor: type.bodyColor,
          wellFill: type.wellFill,
          wellStroke: type.wellStroke,
          minimapColor: type.minimapColor,
          spriteKey: type.spriteKey,
          rotation: rotation,
          rotationSpeed: rotSpeed,
          pulsePhase,
          pulseSpeed,
          pulseAmount,
          motion
        }));
      }
      starIndex += 1;
      failureStreak = 0;
    }
  return stars;
}

function generateGoal(rng, bounds, stars, safePoint, safeRadius, anchor = null, station = null, meridian = null) {
  let goalX = bounds.x + bounds.size / 2 - GOAL.WIDTH / 2;
  let goalY = bounds.y + bounds.size / 2 - GOAL.HEIGHT / 2;
  const anchorRadius = anchor?.radius ?? GOAL.ANCHOR_RADIUS_DEFAULT;
  const meridianSideSign = meridian && Number.isFinite(meridian.sideSign)
    ? Math.sign(meridian.sideSign) || 1
    : (meridian ? (rng() < 0.5 ? -1 : 1) : 1);
  const meridianAxis = meridian?.axisAngle;
  const hasMeridian = meridian && Number.isFinite(meridianAxis) && Number.isFinite(meridian.spineWidth);
  const meridianNx = hasMeridian ? -Math.sin(meridianAxis) : 0;
  const meridianNy = hasMeridian ? Math.cos(meridianAxis) : 0;
  const meridianCenter = hasMeridian
    ? {
      x: meridian.center?.x ?? (bounds.x + bounds.size / 2),
      y: meridian.center?.y ?? (bounds.y + bounds.size / 2)
    }
    : null;
  const meridianClear = hasMeridian ? meridian.spineWidth * 0.5 + GOAL.MARGIN * 0.5 : 0;

  for (let i = 0; i < 20; i++) {
    let pos = null;
    if (anchor?.x !== undefined && anchor?.y !== undefined) {
      const angle = randomRange(rng, 0, Math.PI * 2);
      const dist = randomRange(rng, anchorRadius * 0.4, anchorRadius);
      const ax = anchor.x + Math.cos(angle) * dist;
      const ay = anchor.y + Math.sin(angle) * dist;
      pos = {
        x: clamp(ax, bounds.x + GOAL.MARGIN, bounds.x + bounds.size - GOAL.MARGIN),
        y: clamp(ay, bounds.y + GOAL.MARGIN, bounds.y + bounds.size - GOAL.MARGIN)
      };
    } else {
      pos = randomPointInBounds(rng, bounds, GOAL.MARGIN);
    }
    const gx = pos.x;
    const gy = pos.y;

    if (safePoint) {
      const sx = gx - safePoint.x;
      const sy = gy - safePoint.y;
      if (Math.hypot(sx, sy) < safeRadius) {
        continue;
      }
    }
    if (station) {
      const sx = gx - station.x;
      const sy = gy - station.y;
      if (Math.hypot(sx, sy) < STATION_SAFE_RADIUS) {
        continue;
      }
    }

    if (hasMeridian && meridianCenter) {
      const dx = gx - meridianCenter.x;
      const dy = gy - meridianCenter.y;
      const dist = dx * meridianNx + dy * meridianNy;
      if (dist * meridianSideSign <= meridianClear) {
        continue;
      }
    }

    let tooClose = false;
    for (const star of stars) {
      const dx = gx - star.x;
      const dy = gy - star.y;
      if (Math.hypot(dx, dy) < GOAL.MIN_STAR_DIST) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) {
      continue;
    }

    goalX = gx;
    goalY = gy;
    break;
  }

  const rotation = randomRange(rng, 0, Math.PI * 2);
  const rotationSpeed = randomRange(rng, GOAL.ROT_SPEED_MIN, GOAL.ROT_SPEED_MAX) * (rng() < 0.5 ? -1 : 1);

  return new Goal(goalX, goalY, GOAL.WIDTH, GOAL.HEIGHT, {
    rotation,
    rotationSpeed
  });
}

function generateAsteroids(rng, bounds, asteroidMultiplier, safePoint, safeRadius, options = {}) {
  const asteroids = [];
  const targetCount = Math.round(ASTEROIDS.COUNT * asteroidMultiplier);
  if (targetCount <= 0) {
    return asteroids;
  }
  const count = Math.max(1, targetCount);
  const clusterCount = options.cluster
    ? randomInt(rng, ASTEROID_CLUSTER.COUNT_MIN, ASTEROID_CLUSTER.COUNT_MAX)
    : 0;
  const clusters = [];
  if (clusterCount > 0) {
    for (let i = 0; i < clusterCount; i++) {
      let center = null;
      for (let tries = 0; tries < 30; tries++) {
        const candidate = randomPointInBounds(rng, bounds, ASTEROIDS.SPAWN_MARGIN);
        if (safePoint) {
          const dx = candidate.x - safePoint.x;
          const dy = candidate.y - safePoint.y;
          if (Math.hypot(dx, dy) < safeRadius + ASTEROID_CLUSTER.RADIUS_MIN) {
            continue;
          }
        }
        center = candidate;
        break;
      }
      if (center) {
        clusters.push({
          x: center.x,
          y: center.y,
          radius: randomRange(rng, ASTEROID_CLUSTER.RADIUS_MIN, ASTEROID_CLUSTER.RADIUS_MAX)
        });
      }
    }
  }

  for (let i = 0; i < count; i++) {
    let pos = null;
    let vx = 0;
    let vy = 0;
    for (let tries = 0; tries < 40; tries++) {
      let candidate = null;
      if (clusters.length > 0) {
        const cluster = clusters[randomInt(rng, 0, clusters.length - 1)];
        const angle = randomRange(rng, 0, Math.PI * 2);
        const dist = randomRange(rng, 0, cluster.radius);
        candidate = {
          x: clamp(cluster.x + Math.cos(angle) * dist, bounds.x + ASTEROIDS.SPAWN_MARGIN, bounds.x + bounds.size - ASTEROIDS.SPAWN_MARGIN),
          y: clamp(cluster.y + Math.sin(angle) * dist, bounds.y + ASTEROIDS.SPAWN_MARGIN, bounds.y + bounds.size - ASTEROIDS.SPAWN_MARGIN)
        };
      } else {
        candidate = randomPointInBounds(rng, bounds, ASTEROIDS.SPAWN_MARGIN);
      }

      if (safePoint) {
        const dx = candidate.x - safePoint.x;
        const dy = candidate.y - safePoint.y;
        const minSpawnDist = safeRadius + ASTEROIDS.SPAWN_MARGIN;
        if (Math.hypot(dx, dy) < minSpawnDist) {
          continue;
        }
      }

      const travelAngle = randomRange(rng, 0, Math.PI * 2);
      const speed = randomRange(rng, ASTEROIDS.SPEED_MIN, ASTEROIDS.SPEED_MAX) * (options.speedScale ?? 1);
      const testVx = Math.cos(travelAngle) * speed;
      const testVy = Math.sin(travelAngle) * speed;

      if (safePoint) {
        const sx = safePoint.x - candidate.x;
        const sy = safePoint.y - candidate.y;
        const dist = Math.hypot(sx, sy);
        if (dist < safeRadius) {
          continue;
        }
        const dot = testVx * sx + testVy * sy;
        const cos = dist > 0 ? dot / (speed * dist) : 0;
        if (cos > 0.7) {
          continue;
        }
      }

      pos = candidate;
      vx = testVx;
      vy = testVy;
      break;
    }

    if (!pos) {
      pos = randomPointInBounds(rng, bounds, ASTEROIDS.SPAWN_MARGIN);
      const travelAngle = randomRange(rng, 0, Math.PI * 2);
      const speed = randomRange(rng, ASTEROIDS.SPEED_MIN, ASTEROIDS.SPEED_MAX) * (options.speedScale ?? 1);
      vx = Math.cos(travelAngle) * speed;
      vy = Math.sin(travelAngle) * speed;
    }

    const radius = randomRange(rng, ASTEROIDS.RADIUS_MIN, ASTEROIDS.RADIUS_MAX) * (options.radiusScale ?? 1);
    const rotation = randomRange(rng, 0, Math.PI * 2);
    const rotationSpeed = randomRange(rng, 0.05, 0.18) * (rng() < 0.5 ? -1 : 1);

    asteroids.push(new Asteroid(pos.x, pos.y, vx, vy, radius, rotation, rotationSpeed, "asteroid", {
      generation: 0,
      isFragment: false
    }));
  }
  return asteroids;
}

export class SectorManager {
  constructor(options = {}) {
    const opts = options ?? {};
    this.current = null;
    this.sectors = new Map();
    this.worldSeed = Number.isFinite(opts.worldSeed) ? opts.worldSeed : 0;
    this.sectorIndex = opts.sectorIndex ?? {};
    this.gameState = opts.gameState ?? null;
    this.persist = opts.persist !== false;
    this.entrySafeRadius = Number.isFinite(opts.entrySafeRadius) ? opts.entrySafeRadius : ENTRY_SAFE_RADIUS;
    this.startSafeRadius = Number.isFinite(opts.startSafeRadius) ? opts.startSafeRadius : this.entrySafeRadius;
    this.lastPruneKey = null;
    this.lastPruneRange = null;
  }

  getSectorSeed(sx, sy, salt = 0) {
    return hashInts(this.worldSeed, sx, sy, salt);
  }

  getCooldownReady() {
    const lastOrigin = Number.isFinite(this.gameState?.lastSignalOriginStep)
      ? this.gameState.lastSignalOriginStep
      : -1;
    if (lastOrigin < 0) {
      return true;
    }
    return (this.gameState?.newSectorCount ?? 0) - lastOrigin >= ORIGIN_COOLDOWN;
  }

  normalizeSectorMeta(meta, sx, sy, ring, safePoint, safeRadius) {
    const baseSeed = this.getSectorSeed(sx, sy);
    let updated = false;
    const fieldType = getFieldTypeForSector(this.worldSeed, sx, sy);
    const normalized = { ...meta };
    const prevType = normalized.sectorType;
    const prevMood = normalized.sectorMood;
    normalized.sectorType = normalizeSectorType(normalized.sectorType);
    normalized.sectorMood = normalizeSectorMood(normalized.sectorMood);
    if (prevType !== normalized.sectorType || prevMood !== normalized.sectorMood) {
      updated = true;
    }
    if (normalized.generatedAtExposure === undefined || !Number.isFinite(normalized.generatedAtExposure)) {
      normalized.generatedAtExposure = Math.max(0, this.gameState?.beacon?.exposure ?? 0);
      updated = true;
    }
    if (normalized.sectorType === SECTOR_TYPES.ANOMALY && !normalized.anomalyModifier) {
      const rng = createRng(this.getSectorSeed(sx, sy, SEED_SALT.ANOMALY));
      normalized.anomalyModifier = pickAnomalyModifier(rng);
      updated = true;
    }
    if (normalized.sectorType === SECTOR_TYPES.ECHO && !normalized.echoTag) {
      const rng = createRng(this.getSectorSeed(sx, sy, SEED_SALT.ECHO));
      normalized.echoTag = pickEchoTag(rng, this.gameState?.history);
      updated = true;
    }
    if (normalized.sectorType === SECTOR_TYPES.MERIDIAN) {
      if (!Number.isFinite(normalized.meridianAxisAngle) || !Number.isFinite(normalized.meridianSideSign)) {
        const meridianSeed = this.getSectorSeed(sx, sy, SEED_SALT.MERIDIAN);
        const params = buildMeridianParams(meridianSeed);
        normalized.meridianAxisAngle = params.axisAngle;
        normalized.meridianSideSign = params.sideSign;
        updated = true;
      }
    }
    if (normalized.sectorType === SECTOR_TYPES.SIGNAL_ORIGIN) {
      if (!normalized.beaconPlaced) {
        normalized.beaconPlaced = true;
        updated = true;
      }
      if (!normalized.beaconPosition) {
        const rng = createRng(this.getSectorSeed(sx, sy, SEED_SALT.BEACON));
        normalized.beaconPosition = pickBeaconPosition(rng, this.getBounds(sx, sy), safePoint, safeRadius);
        updated = true;
      }
    } else if (normalized.beaconPlaced) {
      normalized.beaconPlaced = false;
      normalized.beaconPosition = null;
      updated = true;
    }
    if (SPECIAL_TYPES.has(normalized.sectorType)) {
      if (normalized.hasStation !== false
        || normalized.stationId
        || normalized.stationPos
        || normalized.stationDiscovered
        || normalized.stationTierCap !== null) {
        normalized.hasStation = false;
        normalized.stationId = null;
        normalized.stationPos = null;
        normalized.stationDiscovered = false;
        normalized.stationTierCap = null;
        updated = true;
      }
    } else {
      const stationInfo = getStationInfoForSector(this.worldSeed, sx, sy, ring);
      if (normalized.hasStation === undefined) {
        normalized.hasStation = Boolean(stationInfo?.hasStation);
        updated = true;
      }
      if (normalized.hasStation) {
        if (!normalized.stationId && stationInfo?.stationId) {
          normalized.stationId = stationInfo.stationId;
          updated = true;
        }
        if (normalized.stationTierCap === undefined) {
          normalized.stationTierCap = stationInfo?.tierCap ?? null;
          updated = true;
        }
        if (!normalized.stationPos) {
          const rng = createRng(this.getSectorSeed(sx, sy, SEED_SALT.STATION));
          normalized.stationPos = pickStationPosition(
            rng,
            this.getBounds(sx, sy),
            safePoint,
            safeRadius,
            normalized.beaconPosition
          );
          updated = true;
        }
        if (normalized.stationDiscovered === undefined) {
          normalized.stationDiscovered = Boolean(stationInfo?.isStartStation);
          updated = true;
        }
      } else {
        if (normalized.stationDiscovered === undefined) {
          normalized.stationDiscovered = false;
          updated = true;
        }
      }
    }
    if (normalized.visited === undefined) {
      normalized.visited = false;
      updated = true;
    }
    if (normalized.surveyComplete === undefined) {
      normalized.surveyComplete = false;
      updated = true;
    }
    if (!normalized.patternId) {
      normalized.patternId = getPatternBehaviorForField(fieldType);
      updated = true;
    }
    if (!Number.isFinite(normalized.patternParamsSeed)) {
      normalized.patternParamsSeed = this.getSectorSeed(sx, sy, SEED_SALT.PATTERN);
      updated = true;
    }
    if (!Number.isFinite(normalized.patternVersion)) {
      normalized.patternVersion = PATTERN_VERSION;
      updated = true;
    }
    if (updated) {
      setSectorMeta(this.sectorIndex, sx, sy, normalized);
      if (this.persist) {
        saveSectorIndex(this.sectorIndex);
      }
    }
    return normalized;
  }

  createSectorMeta(sx, sy, ring, safePoint, safeRadius) {
    const existing = getSectorMeta(this.sectorIndex, sx, sy);
    const existingHasType = Object.values(SECTOR_TYPES).includes(existing?.sectorType);
    if (existing && existingHasType) {
      return this.normalizeSectorMeta(existing, sx, sy, ring, safePoint, safeRadius);
    }
    const priorStation = existingHasType ? null : existing;

    const fieldType = getFieldTypeForSector(this.worldSeed, sx, sy);
    const influence = Math.max(0, this.gameState?.beacon?.exposure ?? 0);
    const cooldownReady = this.getCooldownReady();
    const clueProgress = getClueProgress(this.gameState);
    const specialType = pickSpecialSectorType(this.worldSeed, sx, sy, ring, clueProgress);
    const typeRng = createRng(this.getSectorSeed(sx, sy, SEED_SALT.TYPE));
    const sectorType = specialType ?? chooseSectorType(typeRng, influence, ring, cooldownReady);
    const moodRng = createRng(this.getSectorSeed(sx, sy, SEED_SALT.MOOD));
    const sectorMood = chooseSectorMood(moodRng, sectorType, influence);
    const anomalyModifier = sectorType === SECTOR_TYPES.ANOMALY
      ? pickAnomalyModifier(createRng(this.getSectorSeed(sx, sy, SEED_SALT.ANOMALY)))
      : null;
      const echoTag = sectorType === SECTOR_TYPES.ECHO
        ? pickEchoTag(createRng(this.getSectorSeed(sx, sy, SEED_SALT.ECHO)), this.gameState?.history)
        : null;
      const meridianParams = sectorType === SECTOR_TYPES.MERIDIAN
        ? buildMeridianParams(this.getSectorSeed(sx, sy, SEED_SALT.MERIDIAN))
        : null;
      const beaconPlaced = sectorType === SECTOR_TYPES.SIGNAL_ORIGIN;
      const beaconPosition = beaconPlaced
        ? pickBeaconPosition(createRng(this.getSectorSeed(sx, sy, SEED_SALT.BEACON)), this.getBounds(sx, sy), safePoint, safeRadius)
        : null;
    const stationInfo = SPECIAL_TYPES.has(sectorType)
      ? { hasStation: false }
      : getStationInfoForSector(this.worldSeed, sx, sy, ring);
    const hasStation = Boolean(stationInfo?.hasStation);
    const stationId = hasStation ? (priorStation?.stationId ?? stationInfo.stationId) : null;
    const stationTierCap = hasStation ? (priorStation?.stationTierCap ?? stationInfo.tierCap) : null;
    const stationDiscovered = hasStation
      ? Boolean(stationInfo?.isStartStation || priorStation?.stationDiscovered)
      : false;
    const stationPos = hasStation
      ? (priorStation?.stationPos ?? pickStationPosition(
        createRng(this.getSectorSeed(sx, sy, SEED_SALT.STATION)),
        this.getBounds(sx, sy),
        safePoint,
        safeRadius,
        beaconPosition
      ))
      : null;
    const patternId = getPatternBehaviorForField(fieldType);
    const patternParamsSeed = this.getSectorSeed(sx, sy, SEED_SALT.PATTERN);

    const meta = {
      sectorType,
      sectorMood,
      beaconPlaced,
      beaconPosition,
      hasStation,
      stationId,
      stationPos,
      stationDiscovered,
      stationTierCap,
      generatedAtExposure: influence,
      visited: false,
      surveyComplete: false,
      lastVisitedAt: null,
        anomalyModifier,
        echoTag,
        meridianAxisAngle: meridianParams?.axisAngle ?? null,
        meridianSideSign: meridianParams?.sideSign ?? null,
        patternId,
        patternParamsSeed,
        patternVersion: PATTERN_VERSION
      };

    setSectorMeta(this.sectorIndex, sx, sy, meta);
    if (this.gameState) {
      this.gameState.newSectorCount = (this.gameState.newSectorCount ?? 0) + 1;
      if (sectorType === SECTOR_TYPES.SIGNAL_ORIGIN) {
        this.gameState.lastSignalOriginStep = this.gameState.newSectorCount;
      }
      if (this.persist) {
        saveGameState(this.gameState);
      }
    }
    if (this.persist) {
      saveSectorIndex(this.sectorIndex);
    }
    return meta;
  }

  getBounds(sx, sy) {
    return {
      x: sx * SECTOR_SIZE,
      y: sy * SECTOR_SIZE,
      size: SECTOR_SIZE
    };
  }

  getSectorAt(sx, sy) {
    const key = `${sx},${sy}`;
    if (this.sectors.has(key)) {
      const cached = this.sectors.get(key);
      if (cached) {
        if (!cached.fieldType) {
          cached.fieldType = getFieldTypeForSector(this.worldSeed, sx, sy);
        }
        if (!cached.patternId) {
          cached.patternId = getPatternBehaviorForField(cached.fieldType);
        }
        if (!Number.isFinite(cached.patternParamsSeed)) {
          cached.patternParamsSeed = this.getSectorSeed(sx, sy, SEED_SALT.PATTERN);
        }
        if (!Number.isFinite(cached.patternVersion)) {
          cached.patternVersion = PATTERN_VERSION;
        }
        if (cached.sectorType === SECTOR_TYPES.MERIDIAN && !cached.meridian) {
          const params = buildMeridianParams(this.getSectorSeed(sx, sy, SEED_SALT.MERIDIAN));
          const spineWidth = SHIP_RADIUS * 2 * MERIDIAN_SPINE_MULTIPLIER;
          cached.meridian = {
            center: {
              x: cached.bounds?.x + cached.bounds?.size / 2,
              y: cached.bounds?.y + cached.bounds?.size / 2
            },
            axisAngle: params.axisAngle,
            spineWidth,
            sideSign: params.sideSign,
            bounds: cached.bounds ?? null
          };
        }
      if (cached.sectorType === SECTOR_TYPES.PALIMPSEST) {
        const center = {
          x: cached.bounds?.x + cached.bounds?.size / 2,
          y: cached.bounds?.y + cached.bounds?.size / 2
        };
          if (!cached.palimpsestSingularity || !Array.isArray(cached.stars) || cached.stars.length === 0) {
            const seed = this.getSectorSeed(sx, sy, SEED_SALT.SPECIAL + 17);
            const singularity = buildPalimpsestSingularity(cached.bounds, seed);
            cached.palimpsestSingularity = singularity;
            cached.stars = singularity ? [singularity] : [];
          }
          if (!cached.palimpsestFragments) {
            const seed = this.getSectorSeed(sx, sy, SEED_SALT.SPECIAL + 18);
            cached.palimpsestFragments = buildPalimpsestFragments(cached.bounds, seed, center);
        }
      }
      if (cached.occlusion === undefined && cached.dragFields === undefined) {
        if (!cached.bounds) {
          cached.bounds = this.getBounds(sx, sy);
        }
        const clueCount = Math.max(0, Math.floor(this.gameState?.clues?.totalCollected ?? 0));
        const modifierSeed = Math.floor(Math.random() * 1e9);
        const modifiers = buildSectorModifiers({
          bounds: cached.bounds,
          sectorType: cached.sectorType,
          clueCount,
          seed: modifierSeed
        });
        cached.occlusion = modifiers.occlusion;
        cached.dragFields = modifiers.dragFields;
      }
    }
    return cached;
  }

    const ring = Math.max(Math.abs(sx), Math.abs(sy));
    const bounds = this.getBounds(sx, sy);
    const baseFieldType = getFieldTypeForSector(this.worldSeed, sx, sy);
    const zone = getZoneConfig(ring);
    const entryOrigin = {
      x: bounds.x + bounds.size / 2,
      y: bounds.y + bounds.size / 2
    };
    const safeRadius = ring === 0 ? this.startSafeRadius : this.entrySafeRadius;
    const meta = this.createSectorMeta(sx, sy, ring, entryOrigin, safeRadius);
    const fieldType = getFieldTypeOverride(meta.sectorType, baseFieldType);
    const influence = Math.max(0, meta.generatedAtExposure ?? 0);
    const spawnProfile = buildSpawnProfile(meta.sectorType, influence);
    const fieldMultiplier = FIELD.STAR_MULTIPLIERS[fieldType] ?? 1;
    const patternId = SPECIAL_TYPES.has(meta.sectorType)
      ? getPatternBehaviorForField(fieldType)
      : (meta.patternId ?? getPatternBehaviorForField(fieldType));
      const patternParamsSeed = Number.isFinite(meta.patternParamsSeed)
        ? meta.patternParamsSeed
        : this.getSectorSeed(sx, sy, SEED_SALT.PATTERN);
      const patternVersion = Number.isFinite(meta.patternVersion)
        ? meta.patternVersion
        : PATTERN_VERSION;
      const meridianSeed = this.getSectorSeed(sx, sy, SEED_SALT.MERIDIAN);
      const meridianParams = meta.sectorType === SECTOR_TYPES.MERIDIAN
        ? buildMeridianParams(meridianSeed)
        : null;
      const meridianForStars = meta.sectorType === SECTOR_TYPES.MERIDIAN
        ? {
          center: { x: bounds.x + bounds.size / 2, y: bounds.y + bounds.size / 2 },
          axisAngle: Number.isFinite(meta.meridianAxisAngle) ? meta.meridianAxisAngle : meridianParams?.axisAngle,
          spineWidth: SHIP_RADIUS * 2 * MERIDIAN_SPINE_MULTIPLIER,
          sideSign: Number.isFinite(meta.meridianSideSign) ? meta.meridianSideSign : meridianParams?.sideSign,
          bounds
        }
        : null;
      const isPalimpsest = meta.sectorType === SECTOR_TYPES.PALIMPSEST;
      const palimpsestCenter = {
        x: bounds.x + bounds.size / 2,
        y: bounds.y + bounds.size / 2
      };
      const palimpsestSingularity = isPalimpsest
        ? buildPalimpsestSingularity(bounds, this.getSectorSeed(sx, sy, SEED_SALT.SPECIAL + 17))
        : null;
      const palimpsestFragments = isPalimpsest
        ? buildPalimpsestFragments(bounds, this.getSectorSeed(sx, sy, SEED_SALT.SPECIAL + 18), palimpsestCenter)
        : null;
      const starRng = createRng(this.getSectorSeed(sx, sy, SEED_SALT.STARS));
      const stars = isPalimpsest
        ? (palimpsestSingularity ? [palimpsestSingularity] : [])
        : generateStars(
          starRng,
          bounds,
          ring,
          spawnProfile.stars * fieldMultiplier,
          ring === 0 ? entryOrigin : null,
          ring === 0 ? safeRadius : 0,
          fieldType,
          {
            patternId,
            patternParamsSeed,
            patternVersion
          },
          null,
          meridianForStars
        );
    const station = meta.hasStation && meta.stationPos
      ? {
        id: meta.stationId ?? `${sx},${sy}`,
        x: meta.stationPos.x,
        y: meta.stationPos.y,
        safeRadius: STATION.SAFE_ZONE_RADIUS,
        colliderRadius: STATION.COLLIDER_RADIUS,
        dockRadius: STATION.DOCK_RADIUS,
        isStartStation: Boolean(meta.stationTierCap === STATION.START_STATION_TIER_CAP),
        tierCap: meta.stationTierCap ?? null,
        discovered: Boolean(meta.stationDiscovered)
      }
      : null;
      const goalAnchor = meta.sectorType === SECTOR_TYPES.SIGNAL_ORIGIN && meta.beaconPosition
        ? { x: meta.beaconPosition.x, y: meta.beaconPosition.y, radius: 520 }
        : null;
      const goalRng = createRng(this.getSectorSeed(sx, sy, SEED_SALT.GOAL));
      const meridian = meta.sectorType === SECTOR_TYPES.MERIDIAN
        ? {
          center: { x: bounds.x + bounds.size / 2, y: bounds.y + bounds.size / 2 },
          axisAngle: Number.isFinite(meta.meridianAxisAngle) ? meta.meridianAxisAngle : meridianParams?.axisAngle,
          spineWidth: SHIP_RADIUS * 2 * MERIDIAN_SPINE_MULTIPLIER,
          sideSign: Number.isFinite(meta.meridianSideSign)
            ? Math.sign(meta.meridianSideSign) || 1
            : meridianParams?.sideSign,
          bounds
        }
        : null;
      const apseScanCentered = meta.sectorType === SECTOR_TYPES.APSE
        && (APSE.SCAN_POINT_CENTERED ?? false);
      const goal = meta.sectorType === SECTOR_TYPES.QUIET_REACH || apseScanCentered
        ? new Goal(
          bounds.x + bounds.size / 2 - GOAL.WIDTH / 2,
          bounds.y + bounds.size / 2 - GOAL.HEIGHT / 2,
          GOAL.WIDTH,
          GOAL.HEIGHT,
          { rotation: 0, rotationSpeed: 0 }
        )
        : generateGoal(goalRng, bounds, stars, entryOrigin, safeRadius, goalAnchor, station, meridian);
    const apseMetalTexture = meta.sectorType === SECTOR_TYPES.APSE && APSE.METAL_TEXTURE?.ENABLED
      ? new ApseMetalTexture(this.getSectorSeed(sx, sy, SEED_SALT.SPECIAL + 6))
      : null;
    const apseRing = meta.sectorType === SECTOR_TYPES.APSE
      ? (() => {
        const ringRadius = bounds.size * (APSE.RING_RADIUS_RATIO ?? 0.35);
        const ringThickness = bounds.size * (APSE.RING_THICKNESS_RATIO ?? 0.06);
        const speedMin = Number.isFinite(APSE.ROT_SPEED_MIN) ? APSE.ROT_SPEED_MIN : 0.003;
        const speedMax = Number.isFinite(APSE.ROT_SPEED_MAX) ? APSE.ROT_SPEED_MAX : 0.008;
        const speed = Math.max(0, randomRange(createRng(this.getSectorSeed(sx, sy, SEED_SALT.SPECIAL + 3)), speedMin, speedMax));
        const ring = new ApseRing(
          bounds.x + bounds.size / 2,
          bounds.y + bounds.size / 2,
          ringRadius,
          ringThickness,
          0,
          speed
        );
        ring.ringThickness = ringThickness;
        ring.metalTexture = apseMetalTexture;
        return ring;
      })()
      : null;
    const apseBackground = meta.sectorType === SECTOR_TYPES.APSE
      ? (() => {
        if (!apseRing) {
          return null;
        }
        const ringRadius = apseRing.radius;
        const ringThickness = apseRing.ringThickness ?? (bounds.size * (APSE.RING_THICKNESS_RATIO ?? 0.06));
        const innerEdgeRadius = ringRadius - ringThickness / 2;
        const seed = this.getSectorSeed(sx, sy, SEED_SALT.SPECIAL + 5);
        return new ApseBackground(
          { x: bounds.x + bounds.size / 2, y: bounds.y + bounds.size / 2 },
          innerEdgeRadius,
          seed
        );
      })()
      : null;
    const apseInterior = meta.sectorType === SECTOR_TYPES.APSE
      ? (() => {
        if (!apseRing) {
          return null;
        }
        const ringRadius = apseRing.radius;
        const ringThickness = apseRing.ringThickness ?? (bounds.size * (APSE.RING_THICKNESS_RATIO ?? 0.06));
        const innerRatio = APSE.INTERIOR?.INNER_RADIUS_RATIO ?? 0.28;
        const outerInsetRatio = APSE.INTERIOR?.OUTER_INSET_RATIO ?? 0.55;
        const innerRadius = ringRadius * innerRatio;
        const outerRadius = ringRadius - ringThickness * outerInsetRatio;
        const outerWallOuterRadius = ringRadius + ringThickness / 2;
        const rng = createRng(this.getSectorSeed(sx, sy, SEED_SALT.SPECIAL + 4));
        const openings = apseRing.getOpenings ? apseRing.getOpenings() : [];
        const interior = generateApseInterior(
          { x: bounds.x + bounds.size / 2, y: bounds.y + bounds.size / 2 },
          outerRadius,
          innerRadius,
          openings,
          ringThickness,
          rng,
          { bandCount: APSE.INTERIOR?.BAND_COUNT, outerWallOuterRadius }
        );
        if (interior) {
          interior.metalTexture = apseMetalTexture;
        }
        return interior;
      })()
      : null;
    const asteroidMultiplier = zone.asteroidMultiplier * spawnProfile.asteroids;
    const asteroidRng = createRng(this.getSectorSeed(sx, sy, SEED_SALT.ASTEROIDS));
    const asteroidOptions = {
      cluster: meta.sectorType === SECTOR_TYPES.DERELICT_FIELD,
      speedScale: meta.sectorType === SECTOR_TYPES.DERELICT_FIELD ? 0.6 : 1,
      radiusScale: meta.sectorType === SECTOR_TYPES.DERELICT_FIELD ? 1.1 : 1
    };
    const asteroids = generateAsteroids(
      asteroidRng,
      bounds,
      asteroidMultiplier,
      entryOrigin,
      safeRadius,
      asteroidOptions
    );

    const blockObjects = OBJECT_BLOCKED_SECTORS.has(meta.sectorType);
    const coreSeed = this.getSectorSeed(sx, sy, SEED_SALT.OBJECTS_CORE);
    const lureSeed = this.getSectorSeed(sx, sy, SEED_SALT.OBJECTS_LURE);
    const wreckSeed = this.getSectorSeed(sx, sy, SEED_SALT.OBJECTS_WRECKAGE);
    const nodeSeed = this.getSectorSeed(sx, sy, SEED_SALT.OBJECTS_NODE);
    const shardSeed = this.getSectorSeed(sx, sy, SEED_SALT.OBJECTS_SHARD);

    const cores = [];
    if (!blockObjects && OBJECTS_CONFIG.CORE?.SPAWN_CHANCE > 0) {
      const rng = createRng(coreSeed);
      if (rng() < OBJECTS_CONFIG.CORE.SPAWN_CHANCE) {
        const pos = pickObjectPosition(rng, bounds, stars, entryOrigin, safeRadius, station, OBJECTS_CONFIG.CORE.RADIUS ?? 0);
        if (pos) {
          cores.push(new CoreObject(pos.x, pos.y, coreSeed));
        }
      }
    }

    const lures = [];
    if (!blockObjects && OBJECTS_CONFIG.LURE?.SPAWN_CHANCE > 0) {
      const rng = createRng(lureSeed);
      if (rng() < OBJECTS_CONFIG.LURE.SPAWN_CHANCE) {
        const pos = pickObjectPosition(rng, bounds, stars, entryOrigin, safeRadius, station, OBJECTS_CONFIG.LURE.RADIUS ?? 0);
        if (pos) {
          lures.push(new LureObject(pos.x, pos.y, lureSeed));
        }
      }
    }

    const wreckage = [];
    if (OBJECTS_CONFIG.WRECKAGE?.SPAWN_CHANCE > 0) {
      const rng = createRng(wreckSeed);
      if (rng() < OBJECTS_CONFIG.WRECKAGE.SPAWN_CHANCE) {
        const pos = pickObjectPosition(rng, bounds, stars, entryOrigin, safeRadius, station, OBJECTS_CONFIG.WRECKAGE.RADIUS ?? 0);
        if (pos) {
          wreckage.push(new WreckageObject(pos.x, pos.y, wreckSeed));
        }
      }
    }

    const nodes = [];
    if (!blockObjects && OBJECTS_CONFIG.NODE?.SPAWN_CHANCE > 0) {
      const rng = createRng(nodeSeed);
      if (rng() < OBJECTS_CONFIG.NODE.SPAWN_CHANCE) {
        const pos = pickObjectPosition(rng, bounds, stars, entryOrigin, safeRadius, station, OBJECTS_CONFIG.NODE.RADIUS ?? 0);
        if (pos) {
          nodes.push(new NodeObject(pos.x, pos.y, nodeSeed));
        }
      }
    }

    const shards = [];
    if (!blockObjects && OBJECTS_CONFIG.SHARD?.SPAWN_CHANCE > 0) {
      const rng = createRng(shardSeed);
      if (rng() < OBJECTS_CONFIG.SHARD.SPAWN_CHANCE) {
        const pos = pickObjectPosition(rng, bounds, stars, entryOrigin, safeRadius, station, OBJECTS_CONFIG.SHARD.RADIUS ?? 0);
        if (pos) {
          shards.push(new ShardObject(pos.x, pos.y, shardSeed));
        }
      }
    }

    const clueCount = Math.max(0, Math.floor(this.gameState?.clues?.totalCollected ?? 0));
    const modifierSeed = Math.floor(Math.random() * 1e9);
    const modifiers = buildSectorModifiers({
      bounds,
      sectorType: meta.sectorType,
      clueCount,
      seed: modifierSeed
    });
    const sector = {
      sx,
      sy,
      bounds,
      zone: zone.id,
      ring,
      fieldType,
      patternId,
      patternParamsSeed,
      patternVersion,
      sectorType: meta.sectorType,
      sectorMood: meta.sectorMood,
      anomalyModifier: meta.anomalyModifier ?? null,
      echoTag: meta.echoTag ?? null,
      spawnProfile,
      beacon: meta.beaconPlaced ? {
        x: meta.beaconPosition?.x ?? bounds.x + bounds.size / 2,
        y: meta.beaconPosition?.y ?? bounds.y + bounds.size / 2,
        radius: 900
      } : null,
        station,
        stars,
        palimpsestSingularity,
        palimpsestFragments,
        goal,
        meridian,
        apseRing,
        apseBackground,
        apseInterior,
      apseRingThickness: apseRing?.ringThickness ?? null,
      asteroids,
      cores,
      lures,
      wreckage,
      nodes,
      shards,
      occlusion: modifiers.occlusion,
      dragFields: modifiers.dragFields,
      goalCollected: meta.surveyComplete ? true : false,
      goalDelivered: meta.surveyComplete ? true : false
    };
    this.sectors.set(key, sector);
    return sector;
  }

  getSectorForPosition(x, y) {
    const sx = Math.floor(x / SECTOR_SIZE);
    const sy = Math.floor(y / SECTOR_SIZE);
    this.current = this.getSectorAt(sx, sy);
    return this.current;
  }

  getSectorsAround(x, y, range = 1) {
    const sx = Math.floor(x / SECTOR_SIZE);
    const sy = Math.floor(y / SECTOR_SIZE);
    const sectors = [];
    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        sectors.push(this.getSectorAt(sx + dx, sy + dy));
      }
    }
    return sectors;
  }

  pruneOutsideRange(centerSx, centerSy, range = 3) {
    if (!Number.isFinite(centerSx) || !Number.isFinite(centerSy) || !Number.isFinite(range)) {
      return;
    }
    const pruneKey = `${centerSx},${centerSy}`;
    if (this.lastPruneKey === pruneKey && this.lastPruneRange === range) {
      return;
    }
    this.lastPruneKey = pruneKey;
    this.lastPruneRange = range;
    for (const key of this.sectors.keys()) {
      const [sxRaw, syRaw] = key.split(",");
      const sx = Number(sxRaw);
      const sy = Number(syRaw);
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) {
        continue;
      }
      if (Math.abs(sx - centerSx) > range || Math.abs(sy - centerSy) > range) {
        this.sectors.delete(key);
      }
    }
    const prunedIndex = pruneSectorIndex(this.sectorIndex, centerSx, centerSy, range);
    if (prunedIndex && this.persist) {
      saveSectorIndex(this.sectorIndex);
    }
  }
}
