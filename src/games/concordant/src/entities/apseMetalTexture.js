import { CONFIG } from "../game/config.js";
import { clamp, createRng, hashInts, randomInt, randomRange } from "../game/rng.js";

const APSE = CONFIG.SECTOR.APSE ?? {};
const METAL = APSE.METAL_TEXTURE ?? {};

const TILE_SIZE = Math.max(64, Math.floor(METAL.TILE_SIZE ?? 256));
const BASE_COLOR = METAL.BASE_COLOR ?? "rgb(80, 92, 110)";
const HIGHLIGHT_COLOR = METAL.HIGHLIGHT_COLOR ?? "rgb(140, 150, 170)";
const SHADOW_COLOR = METAL.SHADOW_COLOR ?? "rgb(40, 50, 70)";
const STREAK_COUNT = Math.max(40, Math.floor(METAL.STREAK_COUNT ?? 220));
const CLOUD_COUNT = Math.max(6, Math.floor(METAL.CLOUD_COUNT ?? 18));
const GRAIN_ALPHA = clamp(METAL.GRAIN_ALPHA ?? 0.18, 0, 1);
const STREAK_ALPHA = clamp(METAL.STREAK_ALPHA ?? 0.12, 0, 1);
const CLOUD_ALPHA = clamp(METAL.CLOUD_ALPHA ?? 0.08, 0, 1);
const SPECKLE_ALPHA = clamp(METAL.SPECKLE_ALPHA ?? 0.1, 0, 1);
const SPECKLE_COUNT = Math.max(50, Math.floor(METAL.SPECKLE_COUNT ?? 420));
const STREAK_SLOPE = METAL.STREAK_SLOPE ?? 0.18;
const BAND_COUNT = Math.max(4, Math.floor(METAL.BAND_COUNT ?? 9));
const BAND_ALPHA = clamp(METAL.BAND_ALPHA ?? 0.08, 0, 1);
const BAND_WARP = clamp(METAL.BAND_WARP ?? 0.12, 0, 1);

function generateMetalTile(seed) {
  const rng = createRng(hashInts(seed, 701));
  const canvas = document.createElement("canvas");
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext("2d");
  const wrapOffsets = [-TILE_SIZE, 0, TILE_SIZE];

  const grad = ctx.createLinearGradient(0, 0, TILE_SIZE, TILE_SIZE);
  grad.addColorStop(0, SHADOW_COLOR);
  grad.addColorStop(0.45, BASE_COLOR);
  grad.addColorStop(1, HIGHLIGHT_COLOR);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

  ctx.save();
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const radius = randomRange(rng, TILE_SIZE * 0.22, TILE_SIZE * 0.6);
    const x = randomRange(rng, -radius * 0.25, TILE_SIZE + radius * 0.25);
    const y = randomRange(rng, -radius * 0.25, TILE_SIZE + radius * 0.25);
    const shade = rng() < 0.5 ? 240 : 20;
    for (const ox of wrapOffsets) {
      for (const oy of wrapOffsets) {
        const px = x + ox;
        const py = y + oy;
        const gradCloud = ctx.createRadialGradient(px, py, radius * 0.15, px, py, radius);
        gradCloud.addColorStop(0, `rgba(${shade}, ${shade}, ${shade}, ${CLOUD_ALPHA})`);
        gradCloud.addColorStop(1, `rgba(${shade}, ${shade}, ${shade}, 0)`);
        ctx.fillStyle = gradCloud;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = BAND_ALPHA;
  const bandSpacing = TILE_SIZE / BAND_COUNT;
  const bandPhase = rng() * Math.PI * 2;
  for (let i = 0; i <= BAND_COUNT; i++) {
    const baseY = i * bandSpacing + randomRange(rng, -bandSpacing * 0.2, bandSpacing * 0.2);
    const amp = bandSpacing * BAND_WARP;
    const freq = randomRange(rng, 0.8, 1.6);
    const shade = rng() < 0.5 ? 230 : 30;
    ctx.strokeStyle = `rgba(${shade}, ${shade}, ${shade}, 0.4)`;
    ctx.lineWidth = randomRange(rng, 0.6, 1.4);
    for (const oy of wrapOffsets) {
      const bandY = baseY + oy;
      ctx.beginPath();
      for (let x = -8; x <= TILE_SIZE + 8; x += 12) {
        const t = (x / TILE_SIZE) * Math.PI * 2 * freq + bandPhase;
        const y = bandY + Math.sin(t) * amp;
        if (x === -8) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = GRAIN_ALPHA;
  for (let i = 0; i < STREAK_COUNT; i++) {
    const x = rng() * TILE_SIZE;
    const y = rng() * TILE_SIZE;
    const angle = (rng() * 2 - 1) * STREAK_SLOPE;
    const len = randomRange(rng, TILE_SIZE * 0.05, TILE_SIZE * 0.2);
    const dx = Math.cos(angle) * len;
    const dy = Math.sin(angle) * len;
    const shade = rng() < 0.5 ? 230 : 25;
    ctx.strokeStyle = `rgba(${shade}, ${shade}, ${shade}, ${STREAK_ALPHA})`;
    ctx.lineWidth = randomRange(rng, 0.4, 1.2);
    for (const ox of wrapOffsets) {
      for (const oy of wrapOffsets) {
        ctx.beginPath();
        ctx.moveTo(x + ox, y + oy);
        ctx.lineTo(x + dx + ox, y + dy + oy);
        ctx.stroke();
      }
    }
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = SPECKLE_ALPHA;
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  for (let i = 0; i < SPECKLE_COUNT; i++) {
    const x = Math.floor(rng() * TILE_SIZE);
    const y = Math.floor(rng() * TILE_SIZE);
    const size = rng() < 0.7 ? 1 : 2;
    for (const ox of wrapOffsets) {
      for (const oy of wrapOffsets) {
        ctx.fillRect(x + ox, y + oy, size, size);
      }
    }
  }
  ctx.restore();

  return canvas;
}

export class ApseMetalTexture {
  constructor(seed) {
    this.seed = seed;
    this.tile = generateMetalTile(seed);
    this.pattern = null;
    this.patternCtx = null;
  }

  getPattern(ctx, transform = null) {
    if (!this.tile) {
      return null;
    }
    if (transform) {
      const pattern = ctx.createPattern(this.tile, "repeat");
      if (pattern && typeof pattern.setTransform === "function") {
        pattern.setTransform(transform);
      }
      return pattern;
    }
    if (this.patternCtx !== ctx) {
      this.pattern = ctx.createPattern(this.tile, "repeat");
      this.patternCtx = ctx;
    }
    return this.pattern;
  }
}
