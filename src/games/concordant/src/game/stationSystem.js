import { CONFIG } from "./config.js";
import { clamp, createRng, hashInts, randomInt, randomRange } from "./rng.js";

const { STATION, SECTOR, GOAL, BEACON } = CONFIG;
const GRID_SIZE = STATION.UNIQUE_GRID_SIZE;

function getStationSeed(worldSeed, sx, sy) {
  return hashInts(worldSeed, sx, sy, SECTOR.SEED_SALT.STATION);
}

function getStationChance(ring) {
  const base = STATION.PLACEMENT_CHANCE_BASE;
  const scale = STATION.PLACEMENT_CHANCE_RING_SCALE;
  return clamp(base + ring * scale, 0, 0.4);
}

export function getStationInfoForSector(worldSeed, sx, sy, ring) {
  if (sx === 0 && sy === 0) {
    return {
      hasStation: true,
      stationId: `start-${worldSeed}`,
      isStartStation: true,
      tierCap: STATION.START_STATION_TIER_CAP
    };
  }
  const gx = Math.floor(sx / GRID_SIZE);
  const gy = Math.floor(sy / GRID_SIZE);
  const gridSeed = hashInts(worldSeed, gx, gy, SECTOR.SEED_SALT.STATION);
  const rng = createRng(gridSeed);
  if (rng() > getStationChance(ring)) {
    return {
      hasStation: false
    };
  }
  const offsetX = randomInt(rng, 0, GRID_SIZE - 1);
  const offsetY = randomInt(rng, 0, GRID_SIZE - 1);
  const stationSx = gx * GRID_SIZE + offsetX;
  const stationSy = gy * GRID_SIZE + offsetY;
  if (stationSx !== sx || stationSy !== sy) {
    return {
      hasStation: false
    };
  }
  return {
    hasStation: true,
    stationId: `${gridSeed}:${stationSx},${stationSy}`,
    isStartStation: false,
    tierCap: null
  };
}

export function pickStationPosition(rng, bounds, safePoint, safeRadius, beaconPos = null) {
  const margin = GOAL.MARGIN;
  let pos = null;
  for (let tries = 0; tries < 30; tries++) {
    const candidate = {
      x: randomRange(rng, bounds.x + margin, bounds.x + bounds.size - margin),
      y: randomRange(rng, bounds.y + margin, bounds.y + bounds.size - margin)
    };
    if (safePoint) {
      const dx = candidate.x - safePoint.x;
      const dy = candidate.y - safePoint.y;
      if (Math.hypot(dx, dy) < safeRadius + STATION.SAFE_ZONE_RADIUS) {
        continue;
      }
    }
    if (beaconPos) {
      const dx = candidate.x - beaconPos.x;
      const dy = candidate.y - beaconPos.y;
      const minDist = BEACON.MIN_STAR_DIST + STATION.SAFE_ZONE_RADIUS;
      if (Math.hypot(dx, dy) < minDist) {
        continue;
      }
    }
    pos = candidate;
    break;
  }
  if (!pos) {
    pos = {
      x: bounds.x + bounds.size * 0.5 + (rng() - 0.5) * bounds.size * 0.1,
      y: bounds.y + bounds.size * 0.5 + (rng() - 0.5) * bounds.size * 0.1
    };
  }
  return pos;
}
