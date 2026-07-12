import { CONFIG } from "./config.js";
import { createRng, hashInts, randomInt, randomRange } from "./rng.js";

function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function intersectsRect(a, b) {
  return !(
    a.x + a.width < b.x
    || a.x > b.x + b.width
    || a.y + a.height < b.y
    || a.y > b.y + b.height
  );
}

function computeBounds(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function closestDistanceToPolyline(points, pos) {
  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = pos.x - a.x;
    const apy = pos.y - a.y;
    const denom = abx * abx + aby * aby;
    let t = denom === 0 ? 0 : (apx * abx + apy * aby) / denom;
    t = clampValue(t, 0, 1);
    const cx = a.x + abx * t;
    const cy = a.y + aby * t;
    const dist = Math.hypot(pos.x - cx, pos.y - cy);
    if (dist < best) {
      best = dist;
    }
  }
  return best;
}

function getFieldType(worldSeed, sx, sy) {
  const fieldSize = CONFIG.FIELD.SIZE_SECTORS;
  const fx = Math.floor(sx / fieldSize);
  const fy = Math.floor(sy / fieldSize);
  const seed = hashInts(worldSeed, fx, fy, CONFIG.SECTOR.SEED_SALT.FIELD);
  const rng = createRng(seed);
  const types = Object.values(CONFIG.FIELD.TYPES);
  return types[randomInt(rng, 0, types.length - 1)];
}

function getAnchorCandidates(worldSeed, pos, radiusWorld) {
  const anchors = [];
  const cellSize = CONFIG.RIVER.ANCHOR.CELL_SIZE_SECTORS * CONFIG.SECTOR.SIZE;
  const minX = Math.floor((pos.x - radiusWorld) / cellSize);
  const maxX = Math.floor((pos.x + radiusWorld) / cellSize);
  const minY = Math.floor((pos.y - radiusWorld) / cellSize);
  const maxY = Math.floor((pos.y + radiusWorld) / cellSize);

  for (let cx = minX; cx <= maxX; cx++) {
    for (let cy = minY; cy <= maxY; cy++) {
      const seed = hashInts(worldSeed, cx, cy, CONFIG.SECTOR.SEED_SALT.ANCHOR);
      const rng = createRng(seed);
      const baseX = (cx + 0.5) * cellSize;
      const baseY = (cy + 0.5) * cellSize;
      const jitter = cellSize * 0.25;
      const ax = baseX + (rng() - 0.5) * jitter;
      const ay = baseY + (rng() - 0.5) * jitter;
      const dist = Math.hypot(ax - pos.x, ay - pos.y);
      if (dist <= radiusWorld) {
        anchors.push({
          id: seed,
          x: ax,
          y: ay
        });
      }
    }
  }
  return anchors;
}

function snapAnchor(worldSeed, point, radiusWorld) {
  const anchors = getAnchorCandidates(worldSeed, point, radiusWorld);
  if (anchors.length === 0) {
    return null;
  }
  let best = anchors[0];
  let bestDist = Math.hypot(best.x - point.x, best.y - point.y);
  for (let i = 1; i < anchors.length; i++) {
    const current = anchors[i];
    const dist = Math.hypot(current.x - point.x, current.y - point.y);
    if (dist < bestDist) {
      best = current;
      bestDist = dist;
    }
  }
  return best;
}

function trimPolylineToBounds(points, bounds, margin) {
  if (!points || points.length < 2) {
    return null;
  }
  const trimmed = [];
  let wasInside = false;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const inside = (
      p.x >= bounds.x - margin
      && p.x <= bounds.x + bounds.size + margin
      && p.y >= bounds.y - margin
      && p.y <= bounds.y + bounds.size + margin
    );
    if (inside) {
      if (!wasInside && i > 0) {
        trimmed.push(points[i - 1]);
      }
      trimmed.push(p);
    } else if (wasInside) {
      trimmed.push(p);
    }
    wasInside = inside;
  }
  return trimmed.length >= 2 ? trimmed : null;
}

function buildBackbone(worldSeed, worldAgeTicks, cellX, cellY, density) {
  const seed = hashInts(worldSeed, cellX, cellY, CONFIG.SECTOR.SEED_SALT.RIVER);
  const rng = createRng(seed);
  if (rng() > density) {
    return null;
  }
  const cellSize = CONFIG.FIELD.SIZE_SECTORS * CONFIG.SECTOR.SIZE;
  const centerX = (cellX + 0.5) * cellSize + (rng() - 0.5) * cellSize * 0.4;
  const centerY = (cellY + 0.5) * cellSize + (rng() - 0.5) * cellSize * 0.4;
  const angle = rng() * Math.PI * 2;
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const width = CONFIG.RIVER.WIDTH_MIN + rng() * (CONFIG.RIVER.WIDTH_MAX - CONFIG.RIVER.WIDTH_MIN);
  const phase = rng() * Math.PI * 2;
  const spanCells = CONFIG.RIVER.BACKBONE_SPAN_CELLS;
  const halfLength = cellSize * spanCells;
  const spacing = CONFIG.RIVER.POLYLINE_SPACING;
  const count = Math.max(2, Math.ceil((halfLength * 2) / spacing));
  const points = [];

  for (let i = 0; i <= count; i++) {
    const t = -halfLength + i * spacing;
    const baseX = centerX + dirX * t;
    const baseY = centerY + dirY * t;
    const driftPhase = worldAgeTicks * CONFIG.RIVER.DRIFT_RATE + phase + t * 0.0006;
    const drift = Math.sin(driftPhase) * CONFIG.RIVER.DRIFT_AMPLITUDE;
    const px = baseX + -dirY * drift;
    const py = baseY + dirX * drift;
    points.push({ x: px, y: py });
  }

  return {
    id: seed,
    width,
    points
  };
}

function scoreSegment(segment, bounds, shipPos) {
  const centerX = bounds.x + bounds.size / 2;
  const centerY = bounds.y + bounds.size / 2;
  const center = shipPos ?? { x: centerX, y: centerY };
  const points = segment.points;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x >= bounds.x && p.x <= bounds.x + bounds.size && p.y >= bounds.y && p.y <= bounds.y + bounds.size) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  let spanScore = 0;
  if (minX !== Infinity) {
    const spanX = maxX - minX;
    const spanY = maxY - minY;
    spanScore = Math.max(spanX, spanY) / bounds.size;
  }
  const centerDist = closestDistanceToPolyline(points, { x: centerX, y: centerY });
  if (centerDist <= bounds.size * 0.18) {
    spanScore += 0.35;
  }
  const distToShip = closestDistanceToPolyline(points, center);
  return spanScore * 1000 - distToShip * 0.1 + segment.width * 0.5;
}

export function getRiversForSector(
  worldSeed,
  worldAgeTicks,
  sectorX,
  sectorY,
  bounds,
  fieldType = null,
  shipPos = null
) {
  const resolvedField = fieldType ?? getFieldType(worldSeed, sectorX, sectorY);
  const baseDensity = clampValue(
    CONFIG.RIVER.WORLD_DENSITY + (resolvedField === CONFIG.FIELD.TYPES.SPARSE_VOID ? CONFIG.RIVER.CHANNEL_SECTOR_BIAS : 0),
    0,
    1
  );
  const cellSize = CONFIG.FIELD.SIZE_SECTORS * CONFIG.SECTOR.SIZE;
  const cellX = Math.floor((bounds.x + bounds.size / 2) / cellSize);
  const cellY = Math.floor((bounds.y + bounds.size / 2) / cellSize);
  const baseSpan = CONFIG.RIVER.BACKBONE_SPAN_CELLS + 1;
  const minPerSector = Math.max(0, CONFIG.RIVER.MIN_PER_SECTOR ?? 0);
  const candidates = new Map();

  const collectCandidates = (density, spanBonus) => {
    const span = baseSpan + spanBonus;
    for (let dx = -span; dx <= span; dx++) {
      for (let dy = -span; dy <= span; dy++) {
        const backbone = buildBackbone(worldSeed, worldAgeTicks, cellX + dx, cellY + dy, density);
        if (!backbone) {
          continue;
        }
        const halfW = backbone.width / 2;
        const trimmed = trimPolylineToBounds(backbone.points, bounds, halfW + 200);
        if (!trimmed) {
          continue;
        }
        const anchorRadius = CONFIG.RIVER.ANCHOR.SEARCH_RADIUS * CONFIG.SECTOR.SIZE;
        const headAnchor = snapAnchor(worldSeed, trimmed[0], anchorRadius);
        const tailAnchor = snapAnchor(worldSeed, trimmed[trimmed.length - 1], anchorRadius);
        if (headAnchor) {
          trimmed[0] = { x: headAnchor.x, y: headAnchor.y };
        }
        if (tailAnchor) {
          trimmed[trimmed.length - 1] = { x: tailAnchor.x, y: tailAnchor.y };
        }
        const bbox = computeBounds(trimmed);
        const segment = {
          id: `${backbone.id}:${sectorX},${sectorY}`,
          backboneId: backbone.id,
          width: backbone.width,
          strength: null,
          points: trimmed,
          bbox,
          anchors: [headAnchor, tailAnchor].filter(Boolean)
        };
        segment.score = scoreSegment(segment, bounds, shipPos);
        if (!candidates.has(segment.id)) {
          candidates.set(segment.id, segment);
        }
      }
    }
  };

  collectCandidates(baseDensity, 0);
  if (minPerSector > 0 && candidates.size < minPerSector) {
    collectCandidates(1, 2);
  }

  if (candidates.size === 0) {
    return [];
  }

  const ordered = [...candidates.values()];
  ordered.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.width !== a.width) return b.width - a.width;
    return String(a.backboneId).localeCompare(String(b.backboneId));
  });

  const maxPerSector = Math.max(CONFIG.RIVER.PER_SECTOR_MAX, minPerSector);
  const picked = ordered.slice(0, maxPerSector);
  return picked;
}

export function getFieldTypeForSector(worldSeed, sx, sy) {
  return getFieldType(worldSeed, sx, sy);
}

export function filterRiversByView(rivers, viewRect) {
  if (!Array.isArray(rivers) || rivers.length === 0) {
    return [];
  }
  const margin = CONFIG.RIVER.WIDTH_MAX * 0.6;
  const view = {
    x: viewRect.x - margin,
    y: viewRect.y - margin,
    width: viewRect.width + margin * 2,
    height: viewRect.height + margin * 2
  };
  return rivers.filter((segment) => {
    if (!segment?.bbox) {
      return true;
    }
    return intersectsRect(segment.bbox, view);
  });
}
