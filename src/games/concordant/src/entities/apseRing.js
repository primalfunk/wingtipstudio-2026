import { CONFIG } from "../game/config.js";

const APSE_CONFIG = CONFIG.SECTOR.APSE ?? {};
const ARC_IMAGE = new Image();
ARC_IMAGE.src = APSE_CONFIG.SPRITE_SRC ?? "assets/ui/sprites/apse_arc.png";
const SPRITE_CURVATURE_RADIUS = Number.isFinite(APSE_CONFIG.SPRITE_CURVATURE_RADIUS)
  ? APSE_CONFIG.SPRITE_CURVATURE_RADIUS
  : null;
const SPRITE_CURVATURE_ANCHOR = APSE_CONFIG.SPRITE_CURVATURE_ANCHOR ?? { x: 0, y: 0 };
const SPRITE_ROT_OFFSET = Number.isFinite(APSE_CONFIG.SPRITE_ROT_OFFSET_DEG)
  ? APSE_CONFIG.SPRITE_ROT_OFFSET_DEG * Math.PI / 180
  : 0;
const ARC_GAP_DEG = Number.isFinite(APSE_CONFIG.ARC_GAP_DEG) ? APSE_CONFIG.ARC_GAP_DEG : 10;
const OPENING_ARC_DEG = Number.isFinite(APSE_CONFIG.OPENING_ARC_DEG)
  ? APSE_CONFIG.OPENING_ARC_DEG
  : ARC_GAP_DEG;
const OPENING_COUNT = 3;
const TOTAL_ARC = Math.PI * 2;
const OPENING_ARC = OPENING_ARC_DEG * Math.PI / 180;
const WALL_ARC = (TOTAL_ARC - OPENING_COUNT * OPENING_ARC) / OPENING_COUNT;
const PORTAL_OFFSET_RATIO = Number.isFinite(APSE_CONFIG.PORTAL_OFFSET_RATIO)
  ? APSE_CONFIG.PORTAL_OFFSET_RATIO
  : 1;
const RENDER_MODE = APSE_CONFIG.RENDER_MODE ?? "GEOMETRY";
const GEOMETRY_FILL = APSE_CONFIG.GEOMETRY_FILL ?? "rgba(120, 220, 255, 0.18)";
const GEOMETRY_STROKE = APSE_CONFIG.GEOMETRY_STROKE ?? "rgba(120, 220, 255, 0.7)";
const GEOMETRY_STROKE_WIDTH = APSE_CONFIG.GEOMETRY_STROKE_WIDTH ?? 3.2;
const GEOMETRY_GLOW = APSE_CONFIG.GEOMETRY_GLOW ?? "rgba(120, 220, 255, 0.5)";
const GEOMETRY_GLOW_BLUR = APSE_CONFIG.GEOMETRY_GLOW_BLUR ?? 18;
const METAL = APSE_CONFIG.METAL_TEXTURE ?? {};
const METAL_ENABLED = METAL.ENABLED ?? false;
const METAL_ALPHA = Number.isFinite(METAL.OUTER_ALPHA)
  ? Math.min(1, Math.max(0, METAL.OUTER_ALPHA))
  : (Number.isFinite(METAL.ALPHA) ? Math.min(1, Math.max(0, METAL.ALPHA)) : 0.9);
const METAL_STROKE = METAL.STROKE ?? "rgba(190, 205, 225, 0.55)";
const METAL_STROKE_WIDTH = Number.isFinite(METAL.STROKE_WIDTH)
  ? METAL.STROKE_WIDTH
  : 1.6;
const DEBUG_HIT_TTL = 0.6;
const CLOCK_TO_CANVAS = -Math.PI / 2;

const ARC_CENTERS = Array.from({ length: OPENING_COUNT }, (_, i) => {
  const wallStart = i * (WALL_ARC + OPENING_ARC);
  return wallStart + WALL_ARC / 2;
});

const SPRITE_DATA = {
  ready: false,
  width: 0,
  height: 0,
  alpha: null,
  edge: null,
  minR: null,
  maxR: null
};

function initSpriteData() {
  if (SPRITE_DATA.ready || !ARC_IMAGE.complete || ARC_IMAGE.naturalWidth === 0) {
    return;
  }
  const w = ARC_IMAGE.naturalWidth;
  const h = ARC_IMAGE.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(ARC_IMAGE, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const alpha = new Uint8ClampedArray(w * h);
  const edgeThreshold = 24;
  let minR = Infinity;
  let maxR = 0;
  for (let i = 0, p = 3; i < alpha.length; i++, p += 4) {
    const a = data[p];
    alpha[i] = a;
    if (a <= edgeThreshold) {
      continue;
    }
    const x = i % w;
    const y = Math.floor(i / w);
    const dx = x - SPRITE_CURVATURE_ANCHOR.x;
    const dy = y - SPRITE_CURVATURE_ANCHOR.y;
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
      if (alpha[idx] <= edgeThreshold) {
        continue;
      }
      const hasGap = alpha[idxFor(x - 1, y)] <= edgeThreshold
        || alpha[idxFor(x + 1, y)] <= edgeThreshold
        || alpha[idxFor(x, y - 1)] <= edgeThreshold
        || alpha[idxFor(x, y + 1)] <= edgeThreshold;
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
  SPRITE_DATA.ready = true;
  SPRITE_DATA.width = w;
  SPRITE_DATA.height = h;
  SPRITE_DATA.alpha = alpha;
  SPRITE_DATA.edge = edgeCanvas;
  SPRITE_DATA.minR = Number.isFinite(minR) ? minR : null;
  SPRITE_DATA.maxR = Number.isFinite(maxR) && maxR > 0 ? maxR : null;
}

ARC_IMAGE.addEventListener("load", initSpriteData);
if (ARC_IMAGE.complete && ARC_IMAGE.naturalWidth > 0) {
  initSpriteData();
}

function normalizeAngle(angle) {
  const twoPi = Math.PI * 2;
  let next = angle % twoPi;
  if (next < 0) {
    next += twoPi;
  }
  return next;
}

function angleDelta(a, b) {
  const twoPi = Math.PI * 2;
  let diff = normalizeAngle(a - b);
  if (diff > Math.PI) {
    diff -= twoPi;
  }
  return diff;
}

function getClockAngle(dx, dy) {
  return normalizeAngle(Math.atan2(dy, dx) + Math.PI / 2);
}

function buildRingPatternTransform(center, angle, radius) {
  if (typeof DOMMatrix === "undefined") {
    return null;
  }
  const offset = radius * 0.6;
  const tx = Math.cos(angle) * offset + center.x;
  const ty = Math.sin(angle) * offset + center.y;
  const rot = (angle * 180) / Math.PI;
  return new DOMMatrix().translate(tx, ty).rotate(rot);
}

export class ApseRing {
  constructor(centerX, centerY, radius, thickness, rotation, rotationSpeed, options = {}) {
    this.center = { x: centerX, y: centerY };
    this.radius = radius;
    this.thickness = thickness;
    this.rotation = rotation;
    this.rotationSpeed = rotationSpeed;
    this.arcSpan = Number.isFinite(options.arcSpan) ? options.arcSpan : WALL_ARC;
    this.arcCenters = Array.isArray(options.arcCenters) && options.arcCenters.length === ARC_CENTERS.length
      ? options.arcCenters
      : ARC_CENTERS;
    this.openingArc = Number.isFinite(options.openingArc) ? options.openingArc : OPENING_ARC;
    this.portalOffsetRatio = Number.isFinite(options.portalOffsetRatio)
      ? options.portalOffsetRatio
      : PORTAL_OFFSET_RATIO;
    this.bounce = Number.isFinite(options.bounce) ? options.bounce : (APSE_CONFIG.BOUNCE_FACTOR ?? 0.35);
    this.damping = Number.isFinite(options.damping) ? options.damping : (APSE_CONFIG.BOUNCE_DAMPING ?? 0.88);
    this.metalTexture = options.metalTexture ?? null;
    this.debugHit = null;
    this.debugHitLife = 0;
    this.portals = [];
    this.updatePortals();
  }

  update(dt) {
    if (!Number.isFinite(this.rotationSpeed) || this.rotationSpeed === 0) {
      if (this.debugHitLife > 0) {
        this.debugHitLife = Math.max(0, this.debugHitLife - dt);
      }
      this.updatePortals();
      return;
    }
    this.rotation = normalizeAngle(this.rotation + this.rotationSpeed * dt);
    if (this.debugHitLife > 0) {
      this.debugHitLife = Math.max(0, this.debugHitLife - dt);
    }
    this.updatePortals();
  }

  updatePortals() {
    const portals = [];
    const openings = [];
    const offset = this.radius * this.portalOffsetRatio;
    for (let i = 0; i < OPENING_COUNT; i++) {
      const wallStart = i * (WALL_ARC + this.openingArc);
      const openingStart = normalizeAngle(this.rotation + wallStart + WALL_ARC);
      const openingEnd = normalizeAngle(openingStart + this.openingArc);
      const openingAngle = normalizeAngle(openingStart + this.openingArc / 2);
      portals.push({
        angle: openingAngle,
        x: this.center.x + Math.sin(openingAngle) * offset,
        y: this.center.y - Math.cos(openingAngle) * offset
      });
      openings.push({
        start: openingStart,
        end: openingEnd,
        center: openingAngle,
        width: this.openingArc
      });
    }
    this.portals = portals;
    this.openings = openings;
  }

  getPortals() {
    return this.portals.slice();
  }

  getOpenings() {
    return this.openings?.slice() ?? [];
  }

  draw(ctx) {
    if (RENDER_MODE === "SPRITE") {
      if (!ARC_IMAGE.complete || ARC_IMAGE.naturalWidth === 0) {
        return;
      }
      const scale = SPRITE_CURVATURE_RADIUS
        ? this.radius / SPRITE_CURVATURE_RADIUS
        : 1;
      const clipRadius = this.radius + this.thickness * 2;
      const clipSpan = this.arcSpan;
      const shouldClip = clipSpan < Math.PI * 2 - 0.0001;

      ctx.save();
      ctx.translate(this.center.x, this.center.y);
      for (const baseAngle of this.arcCenters) {
        const baseRotation = this.rotation + baseAngle;
        ctx.save();
        ctx.rotate(baseRotation + CLOCK_TO_CANVAS);
        if (shouldClip) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, clipRadius, -clipSpan / 2, clipSpan / 2);
          ctx.closePath();
          ctx.clip();
        }
        ctx.scale(scale, scale);
        if (SPRITE_ROT_OFFSET !== 0) {
          ctx.rotate(SPRITE_ROT_OFFSET);
        }
        ctx.drawImage(
          ARC_IMAGE,
          -SPRITE_CURVATURE_ANCHOR.x,
          -SPRITE_CURVATURE_ANCHOR.y
        );
        ctx.restore();
      }
      ctx.restore();
      return;
    }

    const halfSpan = this.arcSpan / 2;
    const rInner = Math.max(0, this.radius - this.thickness / 2);
    const rOuter = this.radius + this.thickness / 2;
    const useMetal = (RENDER_MODE === "METAL" || METAL_ENABLED)
      && this.metalTexture
      && typeof this.metalTexture.getPattern === "function";
    if (useMetal) {
      let drewMetal = false;
      ctx.save();
      ctx.translate(this.center.x, this.center.y);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = METAL_ALPHA;
      ctx.strokeStyle = METAL_STROKE;
      ctx.lineWidth = METAL_STROKE_WIDTH;
      for (const baseAngle of this.arcCenters) {
        const baseRotation = this.rotation + baseAngle;
        const transform = buildRingPatternTransform(this.center, baseRotation, this.radius);
        const metalPattern = this.metalTexture.getPattern(ctx, transform);
        if (!metalPattern) {
          continue;
        }
        ctx.save();
        ctx.rotate(baseRotation + CLOCK_TO_CANVAS);
        ctx.fillStyle = metalPattern;
        ctx.beginPath();
        ctx.arc(0, 0, rOuter, -halfSpan, halfSpan);
        ctx.arc(0, 0, rInner, halfSpan, -halfSpan, true);
        ctx.closePath();
        ctx.fill();
        if (METAL_STROKE_WIDTH > 0) {
          ctx.stroke();
        }
        ctx.restore();
        drewMetal = true;
      }
      ctx.restore();
      if (drewMetal) {
        return;
      }
    }
    ctx.save();
    ctx.translate(this.center.x, this.center.y);
    ctx.globalCompositeOperation = "lighter";
    ctx.shadowColor = GEOMETRY_GLOW;
    ctx.shadowBlur = GEOMETRY_GLOW_BLUR;
    ctx.fillStyle = GEOMETRY_FILL;
    ctx.strokeStyle = GEOMETRY_STROKE;
    ctx.lineWidth = GEOMETRY_STROKE_WIDTH;
    for (const baseAngle of this.arcCenters) {
      const baseRotation = this.rotation + baseAngle;
      ctx.save();
      ctx.rotate(baseRotation + CLOCK_TO_CANVAS);
      ctx.beginPath();
      ctx.arc(0, 0, rOuter, -halfSpan, halfSpan);
      ctx.arc(0, 0, rInner, halfSpan, -halfSpan, true);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  resolveCollision(ship, shipRadius) {
    const radius = Number.isFinite(shipRadius)
      ? shipRadius
      : (Number.isFinite(ship?.radius) ? ship.radius : 0);
    const dx = ship.x - this.center.x;
    const dy = ship.y - this.center.y;
    const dist = Math.hypot(dx, dy);
    if (!Number.isFinite(dist)) {
      return;
    }
    const halfSpan = this.arcSpan / 2;
    const { rInner, rOuter } = this.getCollisionRadii();

    for (const baseAngle of this.arcCenters) {
      const rotation = this.rotation + baseAngle;
      const start = rotation - halfSpan;
      const end = rotation + halfSpan;
      const angle = getClockAngle(dx, dy);
      const centerAngle = normalizeAngle(rotation);
      const delta = angleDelta(angle, centerAngle);
      const caps = [start, end];
      for (const capAngle of caps) {
        const ux = Math.sin(capAngle);
        const uy = -Math.cos(capAngle);
        const px = -uy;
        const py = ux;
        const proj = dx * ux + dy * uy;
        if (proj < rInner - radius || proj > rOuter + radius) {
          continue;
        }
        const distToLine = dx * px + dy * py;
        const absDist = Math.abs(distToLine);
        if (absDist > radius) {
          continue;
        }
        const sign = distToLine === 0 ? 1 : Math.sign(distToLine);
        const nx = px * sign;
        const ny = py * sign;
        const push = radius - absDist;
        ship.x += nx * push;
        ship.y += ny * push;
        const vx = Number.isFinite(ship.vx) ? ship.vx : 0;
        const vy = Number.isFinite(ship.vy) ? ship.vy : 0;
        const dot = vx * nx + vy * ny;
        if (dot <= 0) {
          const impulse = (1 + this.bounce) * dot;
          ship.vx -= impulse * nx;
          ship.vy -= impulse * ny;
          ship.vx *= this.damping;
          ship.vy *= this.damping;
        }
        this.debugHit = {
          x: ship.x,
          y: ship.y,
          nx,
          ny,
          angle,
          centerAngle,
          delta,
          halfSpan,
          rInner,
          rOuter,
          capAngle
        };
        this.debugHitLife = DEBUG_HIT_TTL;
        return;
      }
      if (Math.abs(delta) > halfSpan) {
        continue;
      }
      if (dist < rInner - radius || dist > rOuter + radius) {
        continue;
      }
      const invDist = dist > 0.0001 ? 1 / dist : 1;
      let nx = dx * invDist;
      let ny = dy * invDist;
      if (dist < this.radius) {
        nx = -nx;
        ny = -ny;
      }
      const target = dist >= this.radius
        ? rOuter + radius
        : Math.max(0, rInner - radius);
      ship.x = this.center.x + (dx * invDist) * target;
      ship.y = this.center.y + (dy * invDist) * target;
      const vx = Number.isFinite(ship.vx) ? ship.vx : 0;
      const vy = Number.isFinite(ship.vy) ? ship.vy : 0;
      const dot = vx * nx + vy * ny;
      if (dot <= 0) {
        const impulse = (1 + this.bounce) * dot;
        ship.vx -= impulse * nx;
        ship.vy -= impulse * ny;
        ship.vx *= this.damping;
        ship.vy *= this.damping;
      }
      this.debugHit = {
        x: ship.x,
        y: ship.y,
        nx,
        ny,
        angle,
        centerAngle,
        delta,
        halfSpan,
        rInner,
        rOuter
      };
      this.debugHitLife = DEBUG_HIT_TTL;
      return;
    }
  }

  getCollisionRadii() {
    if (RENDER_MODE === "SPRITE" && SPRITE_DATA.ready && SPRITE_CURVATURE_RADIUS
      && Number.isFinite(SPRITE_DATA.minR)
      && Number.isFinite(SPRITE_DATA.maxR)) {
      const scale = this.radius / SPRITE_CURVATURE_RADIUS;
      if (Number.isFinite(scale) && scale > 0) {
        return {
          rInner: Math.max(0, SPRITE_DATA.minR * scale),
          rOuter: SPRITE_DATA.maxR * scale
        };
      }
    }
    return {
      rInner: this.radius - this.thickness / 2,
      rOuter: this.radius + this.thickness / 2
    };
  }

  drawDebug(ctx) {
    const halfSpan = this.arcSpan / 2;
    const arcRadius = this.radius;
    const { rInner, rOuter } = this.getCollisionRadii();
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(80, 220, 255, 0.7)";
    ctx.beginPath();
    ctx.arc(this.center.x, this.center.y, arcRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(80, 220, 255, 0.35)";
    ctx.beginPath();
    ctx.arc(this.center.x, this.center.y, rOuter, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(this.center.x, this.center.y, rInner, 0, Math.PI * 2);
    ctx.stroke();

    for (const baseAngle of this.arcCenters) {
      const rotation = this.rotation + baseAngle;
      const start = rotation - halfSpan;
      const end = rotation + halfSpan;
      ctx.strokeStyle = "rgba(255, 200, 120, 0.7)";
      ctx.beginPath();
      ctx.moveTo(this.center.x, this.center.y);
      ctx.lineTo(this.center.x + Math.sin(rotation) * rOuter, this.center.y - Math.cos(rotation) * rOuter);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 120, 120, 0.7)";
      ctx.beginPath();
      ctx.moveTo(this.center.x, this.center.y);
      ctx.lineTo(this.center.x + Math.sin(start) * rOuter, this.center.y - Math.cos(start) * rOuter);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(this.center.x, this.center.y);
      ctx.lineTo(this.center.x + Math.sin(end) * rOuter, this.center.y - Math.cos(end) * rOuter);
      ctx.stroke();
    }

    if (RENDER_MODE === "SPRITE" && SPRITE_DATA.edge && SPRITE_DATA.edge.width) {
      const scale = SPRITE_CURVATURE_RADIUS
        ? this.radius / SPRITE_CURVATURE_RADIUS
        : 1;
      const clipRadius = this.radius + this.thickness * 2;
      ctx.save();
      ctx.translate(this.center.x, this.center.y);
      for (const baseAngle of this.arcCenters) {
        const baseRotation = this.rotation + baseAngle;
        ctx.save();
        ctx.rotate(baseRotation + CLOCK_TO_CANVAS);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, clipRadius, -halfSpan, halfSpan);
        ctx.closePath();
        ctx.clip();
        ctx.scale(scale, scale);
        if (SPRITE_ROT_OFFSET !== 0) {
          ctx.rotate(SPRITE_ROT_OFFSET);
        }
        ctx.globalAlpha = 0.85;
        ctx.drawImage(
          SPRITE_DATA.edge,
          -SPRITE_CURVATURE_ANCHOR.x,
          -SPRITE_CURVATURE_ANCHOR.y
        );
        ctx.restore();
      }
      ctx.restore();
    }

    if (this.debugHit && this.debugHitLife > 0) {
      const alpha = Math.min(1, this.debugHitLife / DEBUG_HIT_TTL);
      if (Number.isFinite(this.debugHit.rInner) && Number.isFinite(this.debugHit.rOuter)) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 * alpha})`;
        ctx.beginPath();
        ctx.arc(this.center.x, this.center.y, this.debugHit.rOuter, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(this.center.x, this.center.y, this.debugHit.rInner, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * alpha})`;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * alpha})`;
      ctx.beginPath();
      ctx.arc(this.debugHit.x, this.debugHit.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(120, 255, 160, ${0.9 * alpha})`;
      ctx.beginPath();
      ctx.moveTo(this.debugHit.x, this.debugHit.y);
      ctx.lineTo(
        this.debugHit.x + this.debugHit.nx * 30,
        this.debugHit.y + this.debugHit.ny * 30
      );
      ctx.stroke();
    }
    ctx.restore();
  }
}
