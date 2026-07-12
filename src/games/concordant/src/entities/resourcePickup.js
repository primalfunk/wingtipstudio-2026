import { CONFIG } from "../game/config.js";
import { getRarityColorCss, getRarityColorRgb } from "../game/resourceRarity.js";

const { RESOURCE } = CONFIG;
const RESOURCE_SPRITE = new Image();
RESOURCE_SPRITE.src = RESOURCE.SPRITE_SRC;
let tintedSprites = null;
let haloSprites = null;
let coreMask = null;
let shadowSprite = null;
let spriteReady = false;
const VISUAL = RESOURCE.VISUAL ?? {};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;

const boostColor = (rgb) => {
  const mult = VISUAL.CORE_BRIGHT_MULT ?? 1.25;
  const add = VISUAL.CORE_ADD ?? 0.05;
  return {
    r: Math.min(255, Math.round(rgb.r * mult + add * 255)),
    g: Math.min(255, Math.round(rgb.g * mult + add * 255)),
    b: Math.min(255, Math.round(rgb.b * mult + add * 255))
  };
};

const rgbToCss = (rgb) => `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function buildCoreMask() {
  if (!spriteReady || coreMask || !RESOURCE_SPRITE.naturalWidth) {
    return;
  }
  const w = RESOURCE_SPRITE.naturalWidth;
  const h = RESOURCE_SPRITE.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(RESOURCE_SPRITE, 0, 0);
  const image = ctx.getImageData(0, 0, w, h);
  const data = image.data;
  const low = VISUAL.HL_THRESH_LOW ?? 0.65;
  const high = VISUAL.HL_THRESH_HIGH ?? 0.9;
  for (let i = 0; i < data.length; i += 4) {
    const lum = data[i] / 255;
    const mask = smoothstep(low, high, lum);
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = Math.round(data[i + 3] * mask);
  }
  ctx.putImageData(image, 0, 0);
  coreMask = canvas;
}

function buildShadowSprite() {
  if (shadowSprite || !RESOURCE_SPRITE.naturalWidth) {
    return;
  }
  const size = Math.max(RESOURCE_SPRITE.naturalWidth, RESOURCE_SPRITE.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const cx = size / 2;
  const cy = size / 2;
  const grad = ctx.createRadialGradient(cx, cy, size * 0.1, cx, cy, size / 2);
  grad.addColorStop(0, "rgba(0, 0, 0, 0.9)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  shadowSprite = canvas;
}

function buildHaloSprites() {
  if (haloSprites || !RESOURCE_SPRITE.naturalWidth) {
    return;
  }
  const total = RESOURCE.RARITY_TIERS ?? 1;
  const size = Math.max(RESOURCE_SPRITE.naturalWidth, RESOURCE_SPRITE.naturalHeight) * 1.6;
  const mask = document.createElement("canvas");
  mask.width = Math.ceil(size);
  mask.height = Math.ceil(size);
  const mctx = mask.getContext("2d");
  const cx = mask.width / 2;
  const cy = mask.height / 2;
  const grad = mctx.createRadialGradient(cx, cy, mask.width * 0.1, cx, cy, mask.width / 2);
  grad.addColorStop(0, "rgba(255, 255, 255, 1)");
  grad.addColorStop(1, "rgba(255, 255, 255, 0)");
  mctx.fillStyle = grad;
  mctx.fillRect(0, 0, mask.width, mask.height);

  haloSprites = new Array(total);
  for (let i = 0; i < total; i++) {
    const canvas = document.createElement("canvas");
    canvas.width = mask.width;
    canvas.height = mask.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(mask, 0, 0);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = getRarityColorCss(i);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    haloSprites[i] = canvas;
  }
}

function buildTintedSprites() {
  if (!spriteReady || tintedSprites || !RESOURCE_SPRITE.naturalWidth) {
    return;
  }
  buildCoreMask();
  buildShadowSprite();
  buildHaloSprites();
  const total = RESOURCE.RARITY_TIERS ?? 1;
  tintedSprites = new Array(total);
  for (let i = 0; i < total; i++) {
    const baseCanvas = document.createElement("canvas");
    baseCanvas.width = RESOURCE_SPRITE.naturalWidth;
    baseCanvas.height = RESOURCE_SPRITE.naturalHeight;
    const bctx = baseCanvas.getContext("2d");
    bctx.drawImage(RESOURCE_SPRITE, 0, 0);
    bctx.globalCompositeOperation = "source-atop";
    bctx.globalAlpha = VISUAL.BASE_TINT_ALPHA ?? 0.7;
    bctx.fillStyle = getRarityColorCss(i);
    bctx.fillRect(0, 0, baseCanvas.width, baseCanvas.height);
    bctx.globalAlpha = 1;
    bctx.globalCompositeOperation = "source-over";

    const coreCanvas = document.createElement("canvas");
    coreCanvas.width = baseCanvas.width;
    coreCanvas.height = baseCanvas.height;
    const cctx = coreCanvas.getContext("2d");
    if (coreMask) {
      cctx.drawImage(coreMask, 0, 0);
      cctx.globalCompositeOperation = "source-in";
      const boosted = boostColor(getRarityColorRgb(i));
      cctx.fillStyle = rgbToCss(boosted);
      cctx.fillRect(0, 0, coreCanvas.width, coreCanvas.height);
      cctx.globalCompositeOperation = "source-over";
    }

    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = baseCanvas.width;
    finalCanvas.height = baseCanvas.height;
    const fctx = finalCanvas.getContext("2d");
    fctx.drawImage(baseCanvas, 0, 0);
    if (coreMask) {
      fctx.globalCompositeOperation = "lighter";
      fctx.globalAlpha = VISUAL.CORE_TINT_ALPHA ?? 0.75;
      fctx.drawImage(coreCanvas, 0, 0);
      fctx.globalAlpha = 1;
      fctx.globalCompositeOperation = "source-over";
    }
    tintedSprites[i] = finalCanvas;
  }
}

RESOURCE_SPRITE.addEventListener("load", () => {
  spriteReady = true;
  buildTintedSprites();
});

function getTintedSprite(index) {
  const total = RESOURCE.RARITY_TIERS ?? 1;
  const safeIndex = Math.max(0, Math.min(total - 1, Math.floor(index || 0)));
  if (!spriteReady || !RESOURCE_SPRITE.naturalWidth) {
    return RESOURCE_SPRITE;
  }
  if (!tintedSprites) {
    buildTintedSprites();
  }
  return tintedSprites?.[safeIndex] ?? RESOURCE_SPRITE;
}

export class ResourcePickup {
  constructor(x, y, vx, vy, value, spawnTimeMs = 0, options = {}) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.value = Math.max(RESOURCE.MIN_DROP_VALUE, Math.round(value));
    this.rarityIndex = Number.isFinite(options.rarityIndex) ? options.rarityIndex : 0;
    this.valueMultiplier = Number.isFinite(options.valueMultiplier) ? options.valueMultiplier : 1;
    this.color = getRarityColorCss(this.rarityIndex);
    this.phaseSeed = Math.random() * Math.PI * 2;
    this.spinDir = Math.random() < 0.5 ? -1 : 1;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() < 0.5 ? -1 : 1) * (0.8 + Math.random() * 0.6);
    this.spawnTimeMs = spawnTimeMs;
    this.ttlMs = RESOURCE.TTL_MS;
    this.ageMs = 0;
  }

  update(dt) {
    const t = (this.ageMs ?? 0) / 1000;
    const rarity01 = clamp(this.rarityIndex / Math.max(1, (RESOURCE.RARITY_TIERS ?? 1) - 1), 0, 1);
    const baseRotAmp = VISUAL.ROT_AMP ?? 0.1;
    const rotAmp = lerp(baseRotAmp, baseRotAmp * 0.65, rarity01);
    const rotFreq = VISUAL.ROT_FREQ ?? 1.1;
    this.rotation = this.spinDir * Math.sin(t * rotFreq + this.phaseSeed) * rotAmp;
  }

  draw(ctx) {
    const size = RESOURCE.PICKUP_RADIUS;
    const t = (this.ageMs ?? 0) / 1000;
    const rarity01 = clamp(this.rarityIndex / Math.max(1, (RESOURCE.RARITY_TIERS ?? 1) - 1), 0, 1);
    const baseBobAmp = VISUAL.BOB_AMP ?? 2;
    const bobAmp = lerp(baseBobAmp, baseBobAmp * 0.75, rarity01);
    const bobFreq = VISUAL.BOB_FREQ ?? 1.6;
    const bob = Math.sin(t * bobFreq + this.phaseSeed) * bobAmp;
    ctx.save();
    ctx.translate(this.x, this.y + bob);
    if (RESOURCE_SPRITE.complete && RESOURCE_SPRITE.naturalWidth > 0) {
      const sprite = getTintedSprite(this.rarityIndex);
      const spriteW = sprite.naturalWidth ?? sprite.width;
      const spriteH = sprite.naturalHeight ?? sprite.height;
      const scale = (size * 2 * 0.6) / spriteW;
      const drawW = spriteW * scale;
      const drawH = spriteH * scale;
      const legendary = this.rarityIndex >= (RESOURCE.LEGENDARY_THRESHOLD ?? 17);
      if (shadowSprite) {
        const shadowScale = VISUAL.SHADOW_SCALE ?? 1.3;
        const shadowSize = (size * 2 * 0.6) * shadowScale;
        ctx.save();
        ctx.globalAlpha = VISUAL.SHADOW_ALPHA ?? 0.18;
        ctx.drawImage(
          shadowSprite,
          -shadowSize / 2,
          -shadowSize / 2,
          shadowSize,
          shadowSize
        );
        ctx.restore();
      }
      if (legendary && haloSprites) {
        const halo = haloSprites[Math.max(0, Math.min(haloSprites.length - 1, this.rarityIndex))];
        const haloPulse = 0.5 + 0.5 * Math.sin(t * (VISUAL.HALO_PULSE_FREQ ?? 0.8) + this.phaseSeed);
        const isMythic = this.rarityIndex >= (RESOURCE.MYTHIC_INDEX ?? 23);
        const haloAlpha = isMythic ? (VISUAL.HALO_ALPHA_MYTHIC ?? 0.3) : (VISUAL.HALO_ALPHA_LEGENDARY ?? 0.2);
        const haloScale = isMythic ? (VISUAL.HALO_SCALE_MYTHIC ?? 1.55) : (VISUAL.HALO_SCALE_LEGENDARY ?? 1.35);
        const haloSize = (size * 2 * 0.6) * haloScale;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = haloAlpha * lerp(0.85, 1.05, haloPulse);
        ctx.drawImage(
          halo,
          -haloSize / 2,
          -haloSize / 2,
          haloSize,
          haloSize
        );
        ctx.restore();
      }
      ctx.rotate(this.rotation);
      if (this.rarityIndex >= (RESOURCE.LEGENDARY_THRESHOLD ?? 17)) {
        const glow = getRarityColorCss(this.rarityIndex);
        const pulse = 0.75 + 0.25 * Math.sin((this.ageMs ?? 0) * 0.006);
        ctx.shadowColor = glow;
        ctx.shadowBlur = 10 + pulse * 8;
      }
      ctx.drawImage(sprite, -drawW / 2, -drawH / 2, drawW, drawH);
    } else {
      ctx.fillStyle = "rgba(120, 220, 180, 0.9)";
      ctx.strokeStyle = "rgba(210, 255, 230, 0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.8, 0);
      ctx.lineTo(0, size);
      ctx.lineTo(-size * 0.8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    if (this.ttlMs && this.ttlMs > 0) {
      const remaining = Math.max(0, this.ttlMs - (this.ageMs ?? 0));
      const ratio = Math.max(0, Math.min(1, remaining / this.ttlMs));
      ctx.rotate(-this.rotation);
      ctx.save();
      ctx.strokeStyle = "rgba(170, 255, 210, 0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, size + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
      ctx.stroke();
      ctx.fillStyle = "rgba(220, 255, 230, 0.9)";
      ctx.font = "10px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(Math.ceil(remaining / 1000), 0, size + 14);
      ctx.restore();
    }
    ctx.restore();
  }
}
