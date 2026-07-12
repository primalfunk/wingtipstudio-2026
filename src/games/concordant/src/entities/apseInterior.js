import { CONFIG } from "../game/config.js";

const APSE = CONFIG.SECTOR.APSE ?? {};
const INTERIOR = APSE.INTERIOR ?? {};

const CURVATURE_RADIUS = Number.isFinite(APSE.SPRITE_CURVATURE_RADIUS)
  ? APSE.SPRITE_CURVATURE_RADIUS
  : null;
const CURVATURE_ANCHOR = APSE.SPRITE_CURVATURE_ANCHOR ?? { x: 0, y: 0 };
const SPRITE_ROT_OFFSET = Number.isFinite(APSE.SPRITE_ROT_OFFSET_DEG)
  ? APSE.SPRITE_ROT_OFFSET_DEG * Math.PI / 180
  : 0;

const SPRITE_SOURCES = {
  PRIMARY_WALL: INTERIOR.PRIMARY_SPRITE_SRC ?? "assets/ui/sprites/apse_arc.png",
  SECONDARY_PARTITION: INTERIOR.SECONDARY_SPRITE_SRC ?? "assets/ui/sprites/apse_arc.png",
  ENTRY_LIP: INTERIOR.ENTRY_LIP_SRC ?? "assets/ui/sprites/apse_arc.png"
};

const RENDER_MODE = INTERIOR.RENDER_MODE ?? "FORCEFIELDS";
const FORCEFIELDS = INTERIOR.FORCEFIELDS ?? {};
const FORCEFIELD_PRIMARY = FORCEFIELDS.PRIMARY ?? {
  color: "rgba(120, 220, 200, 0.28)",
  glow: "rgba(120, 220, 200, 0.7)",
  glowBlur: 18,
  stroke: "rgba(200, 255, 240, 0.6)",
  strokeWidth: 1.4
};
const FORCEFIELD_SECONDARY = FORCEFIELDS.SECONDARY ?? {
  color: "rgba(110, 180, 255, 0.22)",
  glow: "rgba(110, 180, 255, 0.6)",
  glowBlur: 14,
  stroke: "rgba(180, 220, 255, 0.55)",
  strokeWidth: 1.2
};
const FORCEFIELD_LIP = FORCEFIELDS.ENTRY_LIP ?? {
  color: "rgba(200, 150, 255, 0.2)",
  glow: "rgba(200, 150, 255, 0.45)",
  glowBlur: 10,
  stroke: "rgba(220, 190, 255, 0.45)",
  strokeWidth: 1.0
};
const METAL = APSE.METAL_TEXTURE ?? {};
const METAL_ENABLED = METAL.ENABLED ?? false;
const METAL_INNER_ALPHA = Number.isFinite(METAL.INNER_ALPHA)
  ? Math.min(1, Math.max(0, METAL.INNER_ALPHA))
  : (Number.isFinite(METAL.ALPHA) ? Math.min(1, Math.max(0, METAL.ALPHA)) : 0.9);
const METAL_RIB_ALPHA = Number.isFinite(METAL.RIB_ALPHA)
  ? Math.min(1, Math.max(0, METAL.RIB_ALPHA))
  : (Number.isFinite(METAL.ALPHA) ? Math.min(1, Math.max(0, METAL.ALPHA)) : 0.82);
const METAL_STROKE = METAL.STROKE ?? "rgba(190, 205, 225, 0.55)";
const METAL_STROKE_WIDTH = Number.isFinite(METAL.STROKE_WIDTH)
  ? METAL.STROKE_WIDTH
  : 1.2;

const ANGLE_DIVS = Math.max(12, Math.floor(INTERIOR.ANGLE_DIVS ?? 36));
const OPENING_GUARD = (INTERIOR.OPENING_GUARD_DEG ?? 6) * Math.PI / 180;

const PRIMARY_ARC_MIN = (INTERIOR.PRIMARY_ARC_MIN_DEG ?? 40) * Math.PI / 180;
const PRIMARY_ARC_MAX = (INTERIOR.PRIMARY_ARC_MAX_DEG ?? 120) * Math.PI / 180;
const SECONDARY_ARC_MIN = (INTERIOR.SECONDARY_ARC_MIN_DEG ?? 12) * Math.PI / 180;
const SECONDARY_ARC_MAX = (INTERIOR.SECONDARY_ARC_MAX_DEG ?? 60) * Math.PI / 180;

const PRIMARY_WALL_MIN = Math.max(1, Math.floor(INTERIOR.PRIMARY_WALL_MIN ?? 3));
const PRIMARY_WALL_MAX = Math.max(PRIMARY_WALL_MIN, Math.floor(INTERIOR.PRIMARY_WALL_MAX ?? 5));
const SECONDARY_MIN = Math.max(0, Math.floor(INTERIOR.SECONDARY_WALL_MIN ?? 0));
const SECONDARY_MAX = Math.max(SECONDARY_MIN, Math.floor(INTERIOR.SECONDARY_WALL_MAX ?? 2));

const SECONDARY_THICKNESS_RATIO = Math.max(0.1, Math.min(0.9, INTERIOR.SECONDARY_THICKNESS_RATIO ?? 0.45));
const BAND_THICKNESS_RATIO = Math.max(0.3, Math.min(1, INTERIOR.BAND_THICKNESS_RATIO ?? 0.7));

const ROT_SPEED_MIN = INTERIOR.ROT_SPEED_MIN ?? -0.002;
const ROT_SPEED_MAX = INTERIOR.ROT_SPEED_MAX ?? 0.002;

const ENTRY_LIP_INSET_RATIO = INTERIOR.ENTRY_LIP_INSET_RATIO ?? 0.08;
const ENTRY_LIP_THICKNESS_RATIO = INTERIOR.ENTRY_LIP_THICKNESS_RATIO ?? 0.6;
const BOUNCE_FACTOR = Number.isFinite(APSE.BOUNCE_FACTOR) ? APSE.BOUNCE_FACTOR : 0.35;
const BOUNCE_DAMPING = Number.isFinite(APSE.BOUNCE_DAMPING) ? APSE.BOUNCE_DAMPING : 0.88;
const INNER_WALL_ENABLED = INTERIOR.INNER_WALL_ENABLED ?? true;

const DEBUG_ALPHA_THRESHOLD = 24;
const DEBUG_HIT_TTL = 0.6;
const CLOCK_TO_CANVAS = -Math.PI / 2;

function normalizeAngle(angle) {
  const twoPi = Math.PI * 2;
  let next = angle % twoPi;
  if (next < 0) {
    next += twoPi;
  }
  return next;
}

function getClockAngle(dx, dy) {
  return normalizeAngle(Math.atan2(dy, dx) + Math.PI / 2);
}

function arcSpan(start, end) {
  const span = end - start;
  return span > 0 ? span : span + Math.PI * 2;
}

function angleInArc(angle, start, span) {
  const rel = normalizeAngle(angle - start);
  return rel >= 0 && rel <= span;
}

function arcOverlaps(aStart, aSpan, bStart, bSpan) {
  const aS = normalizeAngle(aStart);
  const bS = normalizeAngle(bStart);
  const aEnd = normalizeAngle(aS + aSpan);
  const bEnd = normalizeAngle(bS + bSpan);
  return angleInArc(aS, bS, bSpan)
    || angleInArc(bS, aS, aSpan)
    || angleInArc(aEnd, bS, bSpan)
    || angleInArc(bEnd, aS, aSpan);
}

function angleInOpenings(angle, openings) {
  if (!Array.isArray(openings) || openings.length === 0) {
    return false;
  }
  for (const opening of openings) {
    const start = Number.isFinite(opening.start)
      ? opening.start
      : (Number.isFinite(opening.angleStart) ? opening.angleStart : null);
    const end = Number.isFinite(opening.end)
      ? opening.end
      : (Number.isFinite(opening.angleEnd) ? opening.angleEnd : null);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      continue;
    }
    const span = Number.isFinite(opening.width) ? opening.width : arcSpan(start, end);
    if (angleInArc(angle, start, span)) {
      return true;
    }
  }
  return false;
}

function forArcRanges(start, span, cb) {
  const s = normalizeAngle(start);
  const e = s + span;
  const twoPi = Math.PI * 2;
  if (e <= twoPi) {
    cb(s, e);
  } else {
    cb(s, twoPi);
    cb(0, e - twoPi);
  }
}

function createSpriteProfile(src) {
  const image = new Image();
  image.src = src;
  const profile = {
    image,
    ready: false,
    width: 0,
    height: 0,
    alpha: null,
    edge: null,
    arcSpan: Math.PI / 2,
    thickness: 1,
    minR: 0,
    maxR: 1
  };

  const init = () => {
    if (profile.ready || !image.complete || image.naturalWidth === 0) {
      return;
    }
    const w = image.naturalWidth;
    const h = image.naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    const alpha = new Uint8ClampedArray(w * h);
    let minAngle = Infinity;
    let maxAngle = -Infinity;
    let minR = Infinity;
    let maxR = 0;
    for (let i = 0, p = 3; i < alpha.length; i++, p += 4) {
      const a = data[p];
      alpha[i] = a;
      if (a <= DEBUG_ALPHA_THRESHOLD) {
        continue;
      }
      const x = i % w;
      const y = Math.floor(i / w);
      const dx = x - CURVATURE_ANCHOR.x;
      const dy = y - CURVATURE_ANCHOR.y;
      const ang = Math.atan2(dy, dx);
      if (ang < minAngle) minAngle = ang;
      if (ang > maxAngle) maxAngle = ang;
      const r = Math.hypot(dx, dy);
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
    }
    const edgeCanvas = document.createElement("canvas");
    edgeCanvas.width = w;
    edgeCanvas.height = h;
    const ectx = edgeCanvas.getContext("2d");
    const edgeData = ectx.createImageData(w, h);
    const edgePixels = edgeData.data;
    const idxFor = (x, y) => y * w + x;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = idxFor(x, y);
        if (alpha[idx] <= DEBUG_ALPHA_THRESHOLD) {
          continue;
        }
        const hasGap = alpha[idxFor(x - 1, y)] <= DEBUG_ALPHA_THRESHOLD
          || alpha[idxFor(x + 1, y)] <= DEBUG_ALPHA_THRESHOLD
          || alpha[idxFor(x, y - 1)] <= DEBUG_ALPHA_THRESHOLD
          || alpha[idxFor(x, y + 1)] <= DEBUG_ALPHA_THRESHOLD;
        if (!hasGap) {
          continue;
        }
        const p = idx * 4;
        edgePixels[p] = 255;
        edgePixels[p + 1] = 120;
        edgePixels[p + 2] = 255;
        edgePixels[p + 3] = 255;
      }
    }
    ectx.putImageData(edgeData, 0, 0);
    profile.ready = true;
    profile.width = w;
    profile.height = h;
    profile.alpha = alpha;
    profile.edge = edgeCanvas;
    if (Number.isFinite(minAngle) && Number.isFinite(maxAngle)) {
      profile.arcSpan = Math.max(0.01, maxAngle - minAngle);
    }
    if (Number.isFinite(minR) && Number.isFinite(maxR) && maxR > minR) {
      profile.minR = minR;
      profile.maxR = maxR;
      profile.thickness = maxR - minR;
    }
  };

  image.addEventListener("load", init);
  if (image.complete && image.naturalWidth > 0) {
    init();
  }
  return profile;
}

const SPRITES = {
  PRIMARY_WALL: createSpriteProfile(SPRITE_SOURCES.PRIMARY_WALL),
  SECONDARY_PARTITION: createSpriteProfile(SPRITE_SOURCES.SECONDARY_PARTITION),
  ENTRY_LIP: createSpriteProfile(SPRITE_SOURCES.ENTRY_LIP)
};

function drawRingSector(ctx, rInner, rOuter, start, span) {
  forArcRanges(start, span, (s, e) => {
    ctx.beginPath();
    ctx.arc(0, 0, rOuter, s, e);
    ctx.arc(0, 0, rInner, e, s, true);
    ctx.closePath();
  });
}

function fillRingSector(ctx, rInner, rOuter, start, span) {
  forArcRanges(start, span, (s, e) => {
    ctx.beginPath();
    ctx.arc(0, 0, rOuter, s, e);
    ctx.arc(0, 0, rInner, e, s, true);
    ctx.closePath();
    ctx.fill();
    if (ctx.lineWidth > 0) {
      ctx.stroke();
    }
  });
}

function drawForcefieldSegment(ctx, segment, center, style) {
  const span = arcSpan(segment.angleStart, segment.angleEnd);
  const start = segment.angleStart + segment.rotation + CLOCK_TO_CANVAS;
  const rInner = segment.radiusCenter - segment.thickness / 2;
  const rOuter = segment.radiusCenter + segment.thickness / 2;
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowColor = style.glow ?? style.color;
  ctx.shadowBlur = style.glowBlur ?? 12;
  ctx.fillStyle = style.color ?? "rgba(120, 220, 200, 0.3)";
  ctx.strokeStyle = style.stroke ?? "rgba(200, 255, 240, 0.5)";
  ctx.lineWidth = style.strokeWidth ?? 1.2;
  fillRingSector(ctx, rInner, rOuter, start, span);
  ctx.restore();
}

function drawMetalSegment(ctx, segment, center, pattern, style) {
  const span = arcSpan(segment.angleStart, segment.angleEnd);
  const start = segment.angleStart + segment.rotation + CLOCK_TO_CANVAS;
  const rInner = segment.radiusCenter - segment.thickness / 2;
  const rOuter = segment.radiusCenter + segment.thickness / 2;
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = style.alpha;
  ctx.fillStyle = pattern;
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = style.strokeWidth;
  fillRingSector(ctx, rInner, rOuter, start, span);
  ctx.restore();
}

function buildMetalPatternTransform(segment, center) {
  if (typeof DOMMatrix === "undefined") {
    return null;
  }
  const angle = segment.angleStart + segment.rotation;
  const offset = segment.radiusCenter * 0.45;
  const tx = Math.cos(angle) * offset + (segment.band ?? 0) * 7;
  const ty = Math.sin(angle) * offset - (segment.band ?? 0) * 5;
  const rot = (angle * 180) / Math.PI;
  return new DOMMatrix().translate(tx + center.x, ty + center.y).rotate(rot);
}

function drawSegmentSprite(ctx, segment, profile, center) {
  if (!profile?.ready || !profile.image) {
    return;
  }
  const span = arcSpan(segment.angleStart, segment.angleEnd);
  const start = segment.angleStart + segment.rotation + CLOCK_TO_CANVAS;
  const centerAngle = start + span / 2;
  const rInner = segment.radiusCenter - segment.thickness / 2;
  const rOuter = segment.radiusCenter + segment.thickness / 2;
  const curvatureRadius = CURVATURE_RADIUS ?? segment.radiusCenter;
  const baseScale = curvatureRadius > 0 ? segment.radiusCenter / curvatureRadius : 1;
  const scaleT = profile.arcSpan > 0 ? span / profile.arcSpan : 1;
  const scaleR = profile.thickness > 0 ? (segment.thickness / (profile.thickness * baseScale)) : 1;

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.save();
  drawRingSector(ctx, rInner, rOuter, start, span);
  ctx.clip();
  ctx.rotate(centerAngle);
  ctx.scale(baseScale, baseScale);
  if (SPRITE_ROT_OFFSET !== 0) {
    ctx.rotate(SPRITE_ROT_OFFSET);
  }
  ctx.scale(scaleT, scaleR);
  ctx.drawImage(profile.image, -CURVATURE_ANCHOR.x, -CURVATURE_ANCHOR.y);
  ctx.restore();
  ctx.restore();
}

function drawSegmentEdges(ctx, segment, profile, center) {
  if (!profile?.ready || !profile.edge) {
    return;
  }
  const span = arcSpan(segment.angleStart, segment.angleEnd);
  const start = segment.angleStart + segment.rotation + CLOCK_TO_CANVAS;
  const centerAngle = start + span / 2;
  const rInner = segment.radiusCenter - segment.thickness / 2;
  const rOuter = segment.radiusCenter + segment.thickness / 2;
  const curvatureRadius = CURVATURE_RADIUS ?? segment.radiusCenter;
  const baseScale = curvatureRadius > 0 ? segment.radiusCenter / curvatureRadius : 1;
  const scaleT = profile.arcSpan > 0 ? span / profile.arcSpan : 1;
  const scaleR = profile.thickness > 0 ? (segment.thickness / (profile.thickness * baseScale)) : 1;

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.save();
  drawRingSector(ctx, rInner, rOuter, start, span);
  ctx.clip();
  ctx.rotate(centerAngle);
  ctx.scale(baseScale, baseScale);
  if (SPRITE_ROT_OFFSET !== 0) {
    ctx.rotate(SPRITE_ROT_OFFSET);
  }
  ctx.scale(scaleT, scaleR);
  ctx.globalAlpha = 0.85;
  ctx.drawImage(profile.edge, -CURVATURE_ANCHOR.x, -CURVATURE_ANCHOR.y);
  ctx.restore();
  ctx.restore();
}

function drawSegmentBounds(ctx, segment, center, color) {
  const span = arcSpan(segment.angleStart, segment.angleEnd);
  const start = segment.angleStart + segment.rotation + CLOCK_TO_CANVAS;
  const rInner = segment.radiusCenter - segment.thickness / 2;
  const rOuter = segment.radiusCenter + segment.thickness / 2;
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  forArcRanges(start, span, (s, e) => {
    ctx.beginPath();
    ctx.arc(0, 0, rOuter, s, e);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, rInner, s, e);
    ctx.stroke();
  });
  ctx.restore();
}

function markArcCells(cells, start, span) {
  forArcRanges(start, span, (s, e) => {
    const total = Math.PI * 2;
    const startIdx = Math.floor((s / total) * ANGLE_DIVS);
    const endIdx = Math.floor((e / total) * ANGLE_DIVS);
    if (endIdx >= startIdx) {
      for (let i = startIdx; i <= endIdx; i++) cells[i % ANGLE_DIVS] = true;
    } else {
      for (let i = startIdx; i < ANGLE_DIVS; i++) cells[i] = true;
      for (let i = 0; i <= endIdx; i++) cells[i] = true;
    }
  });
}

function hasOpenCell(cells) {
  for (let i = 0; i < cells.length; i++) {
    if (!cells[i]) return true;
  }
  return false;
}

function overlapsOpenings(start, span, openings) {
  if (!openings || openings.length === 0) return false;
  const testStart = normalizeAngle(start);
  for (const opening of openings) {
    const oStart = opening.start ?? opening.angleStart ?? opening.angle ?? 0;
    const oSpan = opening.width ?? arcSpan(opening.start, opening.end);
    const guardStart = oStart - OPENING_GUARD;
    const guardSpan = oSpan + OPENING_GUARD * 2;
    if (arcOverlaps(testStart, span, guardStart, guardSpan)) {
      return true;
    }
  }
  return false;
}

function buildBlockedRanges(openings) {
  if (!Array.isArray(openings) || openings.length === 0) {
    return [];
  }
  return openings.map((opening) => {
    const oStart = opening.start ?? 0;
    const oSpan = opening.width ?? arcSpan(opening.start, opening.end);
    return {
      start: normalizeAngle(oStart - OPENING_GUARD),
      span: oSpan + OPENING_GUARD * 2
    };
  });
}

function createEntryLips(openings, outerWallOuterRadius, ringThickness) {
  if (!Array.isArray(openings) || openings.length === 0) {
    return [];
  }
  const thickness = ringThickness * ENTRY_LIP_THICKNESS_RATIO;
  const inset = ringThickness * ENTRY_LIP_INSET_RATIO;
  const targetOuterEdge = outerWallOuterRadius - inset;
  return openings.map((opening) => ({
    radiusCenter: targetOuterEdge - thickness / 2,
    thickness,
    angleStart: opening.start ?? 0,
    angleEnd: opening.end ?? (opening.start + opening.width),
    rotation: 0,
    rotationSpeed: 0,
    role: "ENTRY_LIP",
    collision: "NONE"
  }));
}

export function generateApseInterior(center, outerRadius, innerRadius, openings, ringThickness, rng, options = {}) {
  const bandCount = Math.max(2, Math.min(4, options.bandCount ?? INTERIOR.BAND_COUNT ?? 3));
  const bandWidth = (outerRadius - innerRadius) / bandCount;
  const blockedRanges = buildBlockedRanges(openings);
  const segments = [];
  for (let b = 0; b < bandCount; b++) {
    const bandInner = innerRadius + bandWidth * b;
    const bandOuter = bandInner + bandWidth;
    const bandThickness = bandWidth * BAND_THICKNESS_RATIO;
    const radiusCenter = (bandInner + bandOuter) / 2 + (rng() - 0.5) * bandWidth * 0.25;
    const primaryCount = Math.floor((PRIMARY_WALL_MIN + PRIMARY_WALL_MAX) / 2 + rng() * (PRIMARY_WALL_MAX - PRIMARY_WALL_MIN + 1));
    const rotationSpeed = ROT_SPEED_MIN + rng() * (ROT_SPEED_MAX - ROT_SPEED_MIN);
    const cells = new Array(ANGLE_DIVS).fill(false);
    const placedRanges = blockedRanges.slice();
    if (Array.isArray(openings)) {
      for (const opening of openings) {
        const oStart = opening.start ?? 0;
        const oSpan = opening.width ?? arcSpan(opening.start, opening.end);
        markArcCells(cells, oStart, oSpan);
      }
    }
    let attempts = 0;
    while (segments.filter((seg) => seg.band === b && seg.role === "PRIMARY_WALL").length < primaryCount && attempts < 120) {
      attempts++;
      const length = PRIMARY_ARC_MIN + rng() * (PRIMARY_ARC_MAX - PRIMARY_ARC_MIN);
      const start = rng() * Math.PI * 2;
      if (overlapsOpenings(start, length, openings)) {
        continue;
      }
      let overlap = false;
      for (const range of placedRanges) {
        if (arcOverlaps(start, length, range.start, range.span)) {
          overlap = true;
          break;
        }
      }
      if (overlap) {
        continue;
      }
      segments.push({
        band: b,
        radiusCenter,
        thickness: bandThickness,
        angleStart: normalizeAngle(start),
        angleEnd: normalizeAngle(start + length),
        rotation: 0,
        rotationSpeed,
        role: "PRIMARY_WALL",
        collision: "REFLECT"
      });
      placedRanges.push({ start: normalizeAngle(start), span: length });
    }
    for (const seg of segments.filter((seg) => seg.band === b && seg.role === "PRIMARY_WALL")) {
      const span = arcSpan(seg.angleStart, seg.angleEnd);
      markArcCells(cells, seg.angleStart, span);
    }
    if (!hasOpenCell(cells)) {
      // Drop half the segments to force gaps if we overfilled.
      const bandSegments = segments.filter((seg) => seg.band === b && seg.role === "PRIMARY_WALL");
      const dropCount = Math.ceil(bandSegments.length / 2);
      for (let i = 0; i < dropCount; i++) {
        const idx = segments.indexOf(bandSegments[i]);
        if (idx >= 0) segments.splice(idx, 1);
      }
    }

    const secondaryCount = SECONDARY_MIN + Math.floor(rng() * (SECONDARY_MAX - SECONDARY_MIN + 1));
    let secAttempts = 0;
    while (segments.filter((seg) => seg.band === b && seg.role === "SECONDARY_PARTITION").length < secondaryCount && secAttempts < 80) {
      secAttempts++;
      const length = SECONDARY_ARC_MIN + rng() * (SECONDARY_ARC_MAX - SECONDARY_ARC_MIN);
      const start = rng() * Math.PI * 2;
      if (overlapsOpenings(start, length, openings)) {
        continue;
      }
      let overlap = false;
      for (const range of placedRanges) {
        if (arcOverlaps(start, length, range.start, range.span)) {
          overlap = true;
          break;
        }
      }
      if (overlap) {
        continue;
      }
      segments.push({
        band: b,
        radiusCenter: radiusCenter + (rng() - 0.5) * bandWidth * 0.25,
        thickness: bandThickness * SECONDARY_THICKNESS_RATIO,
        angleStart: normalizeAngle(start),
        angleEnd: normalizeAngle(start + length),
        rotation: 0,
        rotationSpeed: rotationSpeed * (0.6 + rng() * 0.4),
        role: "SECONDARY_PARTITION",
        collision: "REFLECT"
      });
      placedRanges.push({ start: normalizeAngle(start), span: length });
    }
  }
  const outerWallOuterRadius = Number.isFinite(options.outerWallOuterRadius)
    ? options.outerWallOuterRadius
    : outerRadius;
  const entryLips = createEntryLips(openings, outerWallOuterRadius, ringThickness);
  return new ApseInterior(center, outerRadius, innerRadius, segments, entryLips, outerWallOuterRadius, openings);
}

export class ApseInterior {
  constructor(center, outerRadius, innerRadius, segments = [], entryLips = [], outerWallOuterRadius = outerRadius, openings = []) {
    this.center = center;
    this.outerRadius = outerRadius;
    this.innerRadius = innerRadius;
    this.segments = segments;
    this.entryLips = entryLips;
    this.outerWallOuterRadius = outerWallOuterRadius;
    this.openings = Array.isArray(openings) ? openings : [];
    this.bounce = BOUNCE_FACTOR;
    this.damping = BOUNCE_DAMPING;
    this.metalTexture = null;
    this.debugHit = null;
    this.debugHitLife = 0;
  }

  setOpenings(openings, ringThickness) {
    const outerEdge = Number.isFinite(this.outerWallOuterRadius)
      ? this.outerWallOuterRadius
      : this.outerRadius;
    this.openings = Array.isArray(openings) ? openings : [];
    this.entryLips = createEntryLips(openings, outerEdge, ringThickness);
  }

  update(dt) {
    if (this.debugHitLife > 0) {
      this.debugHitLife = Math.max(0, this.debugHitLife - dt);
    }
    for (const seg of this.segments) {
      if (Number.isFinite(seg.rotationSpeed) && seg.rotationSpeed !== 0) {
        seg.rotation = normalizeAngle(seg.rotation + seg.rotationSpeed * dt);
      }
    }
  }

  draw(ctx) {
    const useMetal = (RENDER_MODE === "METAL" || METAL_ENABLED)
      && this.metalTexture
      && typeof this.metalTexture.getPattern === "function";
    if (useMetal) {
      let drewMetal = false;
      for (const seg of this.segments) {
        const transform = buildMetalPatternTransform(seg, this.center);
        const metalPattern = this.metalTexture.getPattern(ctx, transform);
        if (!metalPattern) {
          continue;
        }
        const style = seg.role === "SECONDARY_PARTITION"
          ? { alpha: METAL_RIB_ALPHA, stroke: METAL_STROKE, strokeWidth: METAL_STROKE_WIDTH }
          : { alpha: METAL_INNER_ALPHA, stroke: METAL_STROKE, strokeWidth: METAL_STROKE_WIDTH };
        drawMetalSegment(ctx, seg, this.center, metalPattern, style);
        drewMetal = true;
      }
      if (drewMetal) {
        for (const lip of this.entryLips) {
          drawForcefieldSegment(ctx, lip, this.center, FORCEFIELD_LIP);
        }
        return;
      }
    }
    if (RENDER_MODE === "FORCEFIELDS" || (useMetal && !metalPattern)) {
      for (const seg of this.segments) {
        const style = seg.role === "SECONDARY_PARTITION"
          ? FORCEFIELD_SECONDARY
          : FORCEFIELD_PRIMARY;
        drawForcefieldSegment(ctx, seg, this.center, style);
      }
      for (const lip of this.entryLips) {
        drawForcefieldSegment(ctx, lip, this.center, FORCEFIELD_LIP);
      }
      return;
    }

    for (const seg of this.segments) {
      const profile = SPRITES[seg.role] ?? SPRITES.PRIMARY_WALL;
      drawSegmentSprite(ctx, seg, profile, this.center);
    }
    for (const lip of this.entryLips) {
      const profile = SPRITES.ENTRY_LIP;
      drawSegmentSprite(ctx, lip, profile, this.center);
    }
  }

  drawDebug(ctx) {
    for (const seg of this.segments) {
      const color = seg.role === "SECONDARY_PARTITION"
        ? "rgba(120, 200, 255, 0.7)"
        : "rgba(255, 200, 120, 0.7)";
      drawSegmentBounds(ctx, seg, this.center, color);
      drawSegmentEdges(ctx, seg, SPRITES[seg.role] ?? SPRITES.PRIMARY_WALL, this.center);
    }
    for (const lip of this.entryLips) {
      drawSegmentBounds(ctx, lip, this.center, "rgba(200, 160, 255, 0.5)");
    }
    if (this.debugHit && this.debugHitLife > 0) {
      const alpha = Math.min(1, this.debugHitLife / DEBUG_HIT_TTL);
      ctx.save();
      ctx.translate(this.center.x, this.center.y);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 * alpha})`;
      if (Number.isFinite(this.debugHit.rOuter) && Number.isFinite(this.debugHit.rInner)) {
        ctx.beginPath();
        ctx.arc(0, 0, this.debugHit.rOuter, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, this.debugHit.rInner, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (Number.isFinite(this.debugHit.start) && Number.isFinite(this.debugHit.span)) {
        ctx.strokeStyle = `rgba(255, 120, 255, ${0.8 * alpha})`;
        const start = this.debugHit.start + CLOCK_TO_CANVAS;
        forArcRanges(start, this.debugHit.span, (s, e) => {
          ctx.beginPath();
          ctx.arc(0, 0, this.debugHit.rOuter ?? this.outerRadius, s, e);
          ctx.stroke();
        });
      }
      ctx.restore();

      ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * alpha})`;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * alpha})`;
      ctx.beginPath();
      ctx.arc(this.debugHit.x, this.debugHit.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 120, 255, ${0.9 * alpha})`;
      ctx.beginPath();
      ctx.moveTo(this.debugHit.x, this.debugHit.y);
      ctx.lineTo(
        this.debugHit.x + (this.debugHit.nx ?? 0) * 30,
        this.debugHit.y + (this.debugHit.ny ?? 0) * 30
      );
      ctx.stroke();
    }
  }

  resolveBodyCollision(body, bodyRadius) {
    const radius = Number.isFinite(bodyRadius)
      ? bodyRadius
      : (Number.isFinite(body?.radius) ? body.radius : 0);
    const dx = body.x - this.center.x;
    const dy = body.y - this.center.y;
    const dist = Math.hypot(dx, dy);
    if (!Number.isFinite(dist) || dist <= 0.001) {
      return false;
    }
    const angle = getClockAngle(dx, dy);
    for (const seg of this.segments) {
      if (seg.collision !== "REFLECT") {
        continue;
      }
      const span = arcSpan(seg.angleStart, seg.angleEnd);
      const start = seg.angleStart + seg.rotation;
      if (!angleInArc(angle, start, span)) {
        continue;
      }
      const rInner = seg.radiusCenter - seg.thickness / 2 - radius;
      const rOuter = seg.radiusCenter + seg.thickness / 2 + radius;
      if (dist < rInner || dist > rOuter) {
        continue;
      }
      const rx = dx / dist;
      const ry = dy / dist;
      let nx = rx;
      let ny = ry;
      if (dist < seg.radiusCenter) {
        nx = -rx;
        ny = -ry;
      }
      const target = dist >= seg.radiusCenter ? rOuter : rInner;
      body.x = this.center.x + rx * target;
      body.y = this.center.y + ry * target;
      const vx = Number.isFinite(body.vx) ? body.vx : 0;
      const vy = Number.isFinite(body.vy) ? body.vy : 0;
      const dot = vx * nx + vy * ny;
      if (Number.isFinite(dot) && dot <= 0) {
        const impulse = (1 + this.bounce) * dot;
        body.vx -= impulse * nx;
        body.vy -= impulse * ny;
        body.vx *= this.damping;
        body.vy *= this.damping;
      }
      this.debugHit = {
        x: body.x,
        y: body.y,
        nx,
        ny,
        start,
        span,
        rInner,
        rOuter,
        role: seg.role
      };
      this.debugHitLife = DEBUG_HIT_TTL;
      return true;
    }
    const openings = this.openings?.length ? this.openings : this.entryLips;
    const inOpening = angleInOpenings(angle, openings);
    const invDist = dist > 0.0001 ? 1 / dist : 1;
    const ox = dx * invDist;
    const oy = dy * invDist;
    const outerWall = Number.isFinite(this.outerWallOuterRadius)
      ? this.outerWallOuterRadius
      : this.outerRadius;
    const outerDelta = dist - outerWall;
    if (!inOpening && Math.abs(outerDelta) <= radius) {
      const nx = outerDelta >= 0 ? ox : -ox;
      const ny = outerDelta >= 0 ? oy : -oy;
      const push = radius - Math.abs(outerDelta);
      body.x += nx * push;
      body.y += ny * push;
      const vx = Number.isFinite(body.vx) ? body.vx : 0;
      const vy = Number.isFinite(body.vy) ? body.vy : 0;
      const dot = vx * nx + vy * ny;
      if (Number.isFinite(dot) && dot <= 0) {
        const impulse = (1 + this.bounce) * dot;
        body.vx -= impulse * nx;
        body.vy -= impulse * ny;
        body.vx *= this.damping;
        body.vy *= this.damping;
      }
      this.debugHit = {
        x: body.x,
        y: body.y,
        nx,
        ny,
        start: null,
        span: null,
        rInner: outerWall - radius,
        rOuter: outerWall + radius,
        role: "OUTER_WALL"
      };
      this.debugHitLife = DEBUG_HIT_TTL;
      return true;
    }
    if (INNER_WALL_ENABLED && Number.isFinite(this.innerRadius) && this.innerRadius > 0) {
      const innerDelta = dist - this.innerRadius;
      if (Math.abs(innerDelta) <= radius) {
        const nx = innerDelta >= 0 ? ox : -ox;
        const ny = innerDelta >= 0 ? oy : -oy;
        const push = radius - Math.abs(innerDelta);
        body.x += nx * push;
        body.y += ny * push;
        const vx = Number.isFinite(body.vx) ? body.vx : 0;
        const vy = Number.isFinite(body.vy) ? body.vy : 0;
        const dot = vx * nx + vy * ny;
        if (Number.isFinite(dot) && dot <= 0) {
          const impulse = (1 + this.bounce) * dot;
          body.vx -= impulse * nx;
          body.vy -= impulse * ny;
          body.vx *= this.damping;
          body.vy *= this.damping;
        }
        this.debugHit = {
          x: body.x,
          y: body.y,
          nx,
          ny,
          start: null,
          span: null,
          rInner: this.innerRadius - radius,
          rOuter: this.innerRadius + radius,
          role: "INNER_WALL"
        };
        this.debugHitLife = DEBUG_HIT_TTL;
        return true;
      }
    }
    return false;
  }

  absorbProjectiles(projectiles) {
    if (!Array.isArray(projectiles) || projectiles.length === 0) {
      return;
    }
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      const dx = p.x - this.center.x;
      const dy = p.y - this.center.y;
      const dist = Math.hypot(dx, dy);
      if (!Number.isFinite(dist)) {
        continue;
      }
      const angle = getClockAngle(dx, dy);
      let hit = false;
      for (const seg of this.segments) {
        if (seg.collision !== "REFLECT") {
          continue;
        }
        const span = arcSpan(seg.angleStart, seg.angleEnd);
        const start = seg.angleStart + seg.rotation;
        if (!angleInArc(angle, start, span)) {
          continue;
        }
        const rInner = seg.radiusCenter - seg.thickness / 2;
        const rOuter = seg.radiusCenter + seg.thickness / 2;
        if (dist >= rInner && dist <= rOuter) {
          hit = true;
          break;
        }
      }
      if (hit) {
        projectiles.splice(i, 1);
      }
    }
  }
}
