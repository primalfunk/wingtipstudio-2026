import { CONFIG } from "../game/config.js";
import { createRng, hashInts, randomRange } from "../game/rng.js";

const { OBJECTS } = CONFIG;
const DROPPABLES = OBJECTS?.DROPPABLES ?? {};

const spriteCache = new Map();

function getSprite(src) {
  if (!src) {
    return null;
  }
  if (spriteCache.has(src)) {
    return spriteCache.get(src);
  }
  const img = new Image();
  img.src = src;
  spriteCache.set(src, img);
  return img;
}

function resolveDropConfig(type) {
  if (type === "RELIC") return DROPPABLES.RELIC;
  if (type === "SHARD") return DROPPABLES.SHARD;
  if (type === "NODE") return DROPPABLES.NODE;
  return null;
}

export class UpgradePickup {
  constructor(x, y, vx, vy, type, spawnTimeMs = 0, seed = 0) {
    const cfg = resolveDropConfig(type) ?? {};
    this.type = type;
    this.x = x;
    this.y = y;
    this.vx = vx ?? 0;
    this.vy = vy ?? 0;
    this.radius = Number.isFinite(cfg.RADIUS) ? cfg.RADIUS : 16;
    const rng = createRng(hashInts(seed, 501));
    const rotMin = Number.isFinite(cfg.ROT_SPEED_MIN) ? cfg.ROT_SPEED_MIN : 0.6;
    const rotMax = Number.isFinite(cfg.ROT_SPEED_MAX) ? cfg.ROT_SPEED_MAX : 1.2;
    const rotSpeed = randomRange(rng, rotMin, rotMax);
    this.rotation = randomRange(rng, 0, Math.PI * 2);
    this.rotationSpeed = (rng() < 0.5 ? -1 : 1) * rotSpeed;
    this.bobFreq = Number.isFinite(cfg.BOB_FREQ) ? cfg.BOB_FREQ : 1.4;
    this.bobAmp = Number.isFinite(cfg.BOB_AMP) ? cfg.BOB_AMP : 3.0;
    this.phaseSeed = randomRange(rng, 0, Math.PI * 2);
    this.spawnTimeMs = spawnTimeMs;
    this.ageMs = 0;
    this.sprite = getSprite(cfg.SPRITE_SRC);
  }

  update(dt, worldAgeMs = null) {
    if (Number.isFinite(worldAgeMs) && Number.isFinite(this.spawnTimeMs)) {
      this.ageMs = Math.max(0, worldAgeMs - this.spawnTimeMs);
    } else {
      this.ageMs += dt * 1000;
    }
    this.rotation += this.rotationSpeed * dt;
  }

  draw(ctx) {
    const t = (this.ageMs ?? 0) / 1000;
    const bob = Math.sin(t * this.bobFreq + this.phaseSeed) * this.bobAmp;
    ctx.save();
    ctx.translate(this.x, this.y + bob);
    ctx.rotate(this.rotation);
    if (this.sprite && this.sprite.complete && this.sprite.naturalWidth > 0) {
      const size = this.radius * 2;
      ctx.drawImage(this.sprite, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = "rgba(200, 220, 240, 0.9)";
      ctx.strokeStyle = "rgba(40, 50, 70, 0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(-this.radius, -this.radius, this.radius * 2, this.radius * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

