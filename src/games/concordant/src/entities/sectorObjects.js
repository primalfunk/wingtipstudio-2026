import { CONFIG } from "../game/config.js";
import { clamp, createRng, hashInts, randomRange } from "../game/rng.js";

const { OBJECTS } = CONFIG;

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

function drawFallback(ctx, size, fill = "rgba(200, 210, 220, 0.7)") {
  ctx.fillStyle = fill;
  ctx.strokeStyle = "rgba(30, 40, 50, 0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(-size / 2, -size / 2, size, size);
  ctx.fill();
  ctx.stroke();
}

class SectorSpriteObject {
  constructor(x, y, config, seed, options = {}) {
    this.x = x;
    this.y = y;
    this.vx = options.vx ?? 0;
    this.vy = options.vy ?? 0;
    this.radius = Number.isFinite(options.radius) ? options.radius : (config.RADIUS ?? 12);
    this.size = Number.isFinite(options.size) ? options.size : (config.SIZE ?? this.radius * 2);
    this.rotation = options.rotation ?? 0;
    this.rotationSpeed = options.rotationSpeed ?? 0;
    this.seed = seed;
    this.type = options.type ?? "OBJECT";
    this.hitsRemaining = Number.isFinite(options.hitsRemaining) ? options.hitsRemaining : (config.SHOTS_TO_DESTROY ?? 1);
    this.spriteSrc = config.SPRITE_SRC;
    this.sprite = getSprite(this.spriteSrc);
  }

  update(dt) {
    this.rotation += this.rotationSpeed * dt;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    if (this.sprite && this.sprite.complete && this.sprite.naturalWidth > 0) {
      ctx.drawImage(this.sprite, -this.size / 2, -this.size / 2, this.size, this.size);
    } else {
      drawFallback(ctx, this.size);
    }
    ctx.restore();
  }
}

export class CoreObject extends SectorSpriteObject {
  constructor(x, y, seed, options = {}) {
    const rng = createRng(hashInts(seed, 101));
    const speed = randomRange(rng, OBJECTS.CORE.ROT_SPEED_MIN, OBJECTS.CORE.ROT_SPEED_MAX);
    super(x, y, OBJECTS.CORE, seed, {
      ...options,
      rotation: randomRange(rng, 0, Math.PI * 2),
      rotationSpeed: (rng() < 0.5 ? -1 : 1) * speed,
      type: "CORE",
      hitsRemaining: OBJECTS.CORE.SHOTS_TO_DESTROY
    });
  }
}

export class LureObject extends SectorSpriteObject {
  constructor(x, y, seed, options = {}) {
    const rng = createRng(hashInts(seed, 102));
    const speed = randomRange(rng, OBJECTS.LURE.ROT_SPEED_MIN, OBJECTS.LURE.ROT_SPEED_MAX);
    super(x, y, OBJECTS.LURE, seed, {
      ...options,
      rotation: randomRange(rng, 0, Math.PI * 2),
      rotationSpeed: (rng() < 0.5 ? -1 : 1) * speed,
      type: "LURE",
      hitsRemaining: OBJECTS.LURE.SHOTS_TO_DESTROY
    });
    this.triggered = false;
  }
}

export class WreckageObject extends SectorSpriteObject {
  constructor(x, y, seed, options = {}) {
    const rng = createRng(hashInts(seed, 103));
    const speed = randomRange(rng, OBJECTS.WRECKAGE.ROT_SPEED_MIN, OBJECTS.WRECKAGE.ROT_SPEED_MAX);
    super(x, y, OBJECTS.WRECKAGE, seed, {
      ...options,
      rotation: randomRange(rng, 0, Math.PI * 2),
      rotationSpeed: (rng() < 0.5 ? -1 : 1) * speed,
      type: "WRECKAGE",
      hitsRemaining: OBJECTS.WRECKAGE.SHOTS_TO_DESTROY
    });
  }
}

export class ShardObject extends SectorSpriteObject {
  constructor(x, y, seed, options = {}) {
    const rng = createRng(hashInts(seed, 104));
    const speed = randomRange(rng, OBJECTS.SHARD.ROT_SPEED_MIN, OBJECTS.SHARD.ROT_SPEED_MAX);
    super(x, y, OBJECTS.SHARD, seed, {
      ...options,
      rotation: randomRange(rng, 0, Math.PI * 2),
      rotationSpeed: (rng() < 0.5 ? -1 : 1) * speed,
      type: "SHARD",
      hitsRemaining: OBJECTS.SHARD.SHOTS_TO_DESTROY
    });
    this.glowPhase = randomRange(rng, 0, Math.PI * 2);
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() * 0.004 + this.glowPhase);
    const glowScale = (OBJECTS.SHARD.GLOW_SCALE ?? 1.8) * pulse;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = (OBJECTS.SHARD.GLOW_ALPHA ?? 0.35) * pulse;
    ctx.fillStyle = OBJECTS.SHARD.GLOW_COLOR ?? "rgba(180, 220, 255, 0.7)";
    ctx.beginPath();
    ctx.ellipse(0, 0, this.size * 0.6 * glowScale, this.size * 0.4 * glowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (this.sprite && this.sprite.complete && this.sprite.naturalWidth > 0) {
      ctx.drawImage(this.sprite, -this.size / 2, -this.size / 2, this.size, this.size);
    } else {
      drawFallback(ctx, this.size, "rgba(210, 220, 255, 0.85)");
    }
    ctx.restore();
  }
}

export class NodeObject extends SectorSpriteObject {
  constructor(x, y, seed, options = {}) {
    const rng = createRng(hashInts(seed, 105));
    const speed = randomRange(rng, OBJECTS.NODE.ROT_SPEED_MIN, OBJECTS.NODE.ROT_SPEED_MAX);
    super(x, y, OBJECTS.NODE, seed, {
      ...options,
      rotation: randomRange(rng, 0, Math.PI * 2),
      rotationSpeed: (rng() < 0.5 ? -1 : 1) * speed,
      type: "NODE",
      hitsRemaining: Number.POSITIVE_INFINITY
    });
    this.mode = "INVESTIGATE";
    this.followTimer = 0;
    this.targetTimer = 0;
    this.leaveDir = null;
    this.rng = rng;
  }

  pickTarget(asteroids) {
    if (!Array.isArray(asteroids) || asteroids.length === 0) {
      return null;
    }
    const idx = Math.max(0, Math.min(asteroids.length - 1, Math.floor(this.rng() * asteroids.length)));
    return asteroids[idx] ?? null;
  }

  updateAI(dt, context) {
    const ship = context?.ship;
    const viewRadius = context?.viewRadius ?? 0;
    const asteroids = context?.asteroids ?? [];
    const bounds = context?.bounds ?? null;
    const maxSpeed = OBJECTS.NODE.MAX_SPEED ?? 90;
    const accel = OBJECTS.NODE.ACCEL ?? 140;
    const turnRate = OBJECTS.NODE.TURN_RATE ?? 1.6;
    const minDistance = OBJECTS.NODE.MIN_DISTANCE ?? 30;
    const followLimit = OBJECTS.NODE.FOLLOW_TIME_SEC ?? 300;

    let target = null;
    if (ship) {
      const dx = ship.x - this.x;
      const dy = ship.y - this.y;
      const dist = Math.hypot(dx, dy);
      const shipVisible = dist <= viewRadius;
      if (shipVisible && this.mode !== "LEAVING") {
        this.mode = "FOLLOW";
      } else if (!shipVisible && this.mode !== "LEAVING") {
        this.mode = "INVESTIGATE";
      }
      if (this.mode === "FOLLOW") {
        this.followTimer += dt;
        if (this.followTimer >= followLimit) {
          this.mode = "LEAVING";
        }
      }
      if (this.mode === "FOLLOW") {
        target = ship;
      }
    }

    if (this.mode === "INVESTIGATE") {
      this.targetTimer -= dt;
      if (!this.target || this.targetTimer <= 0 || !asteroids.includes(this.target)) {
        this.target = this.pickTarget(asteroids);
        this.targetTimer = OBJECTS.NODE.INVESTIGATE_TIME_SEC ?? 10;
      }
      target = this.target;
    }

    if (this.mode === "LEAVING") {
      if (!this.leaveDir) {
        if (bounds) {
          const centerX = bounds.x + bounds.size / 2;
          const centerY = bounds.y + bounds.size / 2;
          let dx = this.x - centerX;
          let dy = this.y - centerY;
          let dist = Math.hypot(dx, dy);
          if (!Number.isFinite(dist) || dist < 1e-4) {
            const angle = this.rng() * Math.PI * 2;
            dx = Math.cos(angle);
            dy = Math.sin(angle);
          } else {
            dx /= dist;
            dy /= dist;
          }
          this.leaveDir = { x: dx, y: dy };
        } else {
          const angle = this.rng() * Math.PI * 2;
          this.leaveDir = { x: Math.cos(angle), y: Math.sin(angle) };
        }
      }
      const leaveSpeed = OBJECTS.NODE.LEAVE_SPEED ?? 120;
      const targetVx = this.leaveDir.x * leaveSpeed;
      const targetVy = this.leaveDir.y * leaveSpeed;
      this.vx += (targetVx - this.vx) * clamp(turnRate * dt, 0, 1);
      this.vy += (targetVy - this.vy) * clamp(turnRate * dt, 0, 1);
      return;
    }

    if (target) {
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 1e-6) {
        const dirX = dx / dist;
        const dirY = dy / dist;
        const desired = dist > minDistance ? maxSpeed : -maxSpeed * 0.6;
        const targetVx = dirX * desired;
        const targetVy = dirY * desired;
        this.vx += (targetVx - this.vx) * clamp(turnRate * dt, 0, 1);
        this.vy += (targetVy - this.vy) * clamp(turnRate * dt, 0, 1);
      }
    } else {
      const drift = 0.2;
      this.vx += (this.rng() - 0.5) * accel * drift * dt;
      this.vy += (this.rng() - 0.5) * accel * drift * dt;
    }
  }
}

