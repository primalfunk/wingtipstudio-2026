import { CONFIG } from "../game/config.js";

const { STAR } = CONFIG;
const STAR_SPRITES = {
  yellow: new Image(),
  red: new Image(),
  blue: new Image()
};
STAR_SPRITES.yellow.src = STAR.SPRITES.yellow;
STAR_SPRITES.red.src = STAR.SPRITES.red;
STAR_SPRITES.blue.src = STAR.SPRITES.blue;

const DEFAULTS = STAR.DEFAULTS;

export class Star {
  constructor(x, y, options = {}) {
    const opts = typeof options === "number" ? { mass: options } : options;
    this.x = x;
    this.y = y;
    this.baseX = x;
    this.baseY = y;
    this.motion = opts.motion ?? null;
    this.mass = opts.mass ?? DEFAULTS.MASS;
    this.radius = opts.bodyRadius ?? DEFAULTS.BODY_RADIUS;
    this.bodyColor = opts.bodyColor ?? DEFAULTS.BODY_COLOR;
    this.wellFill = opts.wellFill ?? DEFAULTS.WELL_FILL;
    this.wellStroke = opts.wellStroke ?? DEFAULTS.WELL_STROKE;
    this.minimapColor = opts.minimapColor ?? DEFAULTS.MINIMAP_COLOR;
    this.spriteKey = opts.spriteKey ?? DEFAULTS.SPRITE_KEY;
    this.gravityRadius = opts.gravityRadius ?? (this.radius * DEFAULTS.GRAVITY_RADIUS_MULTIPLIER);
    this.rotation = opts.rotation ?? 0;
    this.rotationSpeed = opts.rotationSpeed ?? 0;
    this.special = opts.special ?? null;
    this.flashTimer = 0;
    this.flashAngle = 0;
    this.flashDuration = this.special?.flashDuration ?? 0;
    this.pulsePhase = opts.pulsePhase ?? Math.random() * Math.PI * 2;
    this.pulseSpeed = opts.pulseSpeed ?? DEFAULTS.PULSE_SPEED;
    this.pulseAmount = opts.pulseAmount ?? DEFAULTS.PULSE_AMOUNT;
    this.pulseScale = 1;
  }

  update(dt, timeSeconds = null) {
    this.rotation += this.rotationSpeed * dt;
    this.pulsePhase += this.pulseSpeed * dt;
    this.pulseScale = 1 + Math.sin(this.pulsePhase) * this.pulseAmount;
    if (this.flashTimer > 0) {
      this.flashTimer = Math.max(0, this.flashTimer - dt);
    }
    if (this.motion && Number.isFinite(timeSeconds)) {
      if (this.motion.type === "orbit") {
        const angle = (this.motion.phase ?? 0) + timeSeconds * (this.motion.angularSpeed ?? 0);
        const radius = this.motion.radius ?? 0;
        const center = this.motion.center ?? { x: this.baseX, y: this.baseY };
        this.x = center.x + Math.cos(angle) * radius;
        this.y = center.y + Math.sin(angle) * radius;
      }
    } else {
      this.x = this.baseX;
      this.y = this.baseY;
    }
  }

  triggerFlash(angle = 0) {
    if (this.special?.type !== "singularity") {
      return;
    }
    this.flashAngle = angle;
    this.flashDuration = this.special?.flashDuration ?? this.flashDuration ?? 0.35;
    this.flashTimer = this.flashDuration;
  }

  draw(ctx) {
    const gravityRadius = this.gravityRadius;
    if (Number.isFinite(gravityRadius) && gravityRadius > this.radius) {
      ctx.save();
      ctx.fillStyle = this.wellFill;
      ctx.strokeStyle = this.wellStroke;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, gravityRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if (this.special?.type === "singularity") {
      const rimThickness = this.special?.rimThickness ?? (this.radius * 0.12);
      const shimmer = 0.5 + 0.5 * Math.sin(this.pulsePhase);
      ctx.save();
      ctx.fillStyle = this.bodyColor;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.lineWidth = rimThickness;
      ctx.strokeStyle = this.special?.rimColor ?? "rgba(140, 160, 200, 0.6)";
      ctx.globalAlpha = 0.25 + shimmer * (this.special?.shimmerAmount ?? 0.45);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + rimThickness * 0.15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = this.special?.rimBright ?? "rgba(210, 230, 255, 0.8)";
      ctx.globalAlpha = 0.2 + shimmer * 0.6;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + rimThickness * 0.25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      if (this.flashTimer > 0 && this.flashDuration > 0) {
        const t = this.flashTimer / this.flashDuration;
        const colors = this.special?.flashColors;
        const colorIndex = colors?.length
          ? Math.floor((((this.flashAngle % (Math.PI * 2)) + Math.PI * 2) / (Math.PI * 2)) * colors.length) % colors.length
          : 0;
        const flashColor = colors?.length ? colors[colorIndex] : "rgba(255, 200, 160, 0.7)";
        const span = this.special?.flashArcSpan ?? (Math.PI / 2);
        const alpha = (this.special?.flashAlpha ?? 0.6) * t;
        const startAngle = this.flashAngle - span * 0.5;
        const endAngle = this.flashAngle + span * 0.5;
        const ringRadius = this.radius + rimThickness * 0.25;
        const ringWidth = rimThickness * 0.55;
        const segments = 18;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = flashColor;
        ctx.lineWidth = ringWidth;
        for (let i = 0; i < segments; i++) {
          const segStart = startAngle + (span * i) / segments;
          const segEnd = startAngle + (span * (i + 1)) / segments;
          const segT = (i + 0.5) / segments;
          const fade = Math.sin(Math.PI * segT);
          ctx.globalAlpha = alpha * fade;
          ctx.beginPath();
          ctx.arc(this.x, this.y, ringRadius, segStart, segEnd);
          ctx.stroke();
        }
        ctx.restore();
      }
      return;
    }

    const glowAlpha = 0.18 + Math.abs(Math.sin(this.pulsePhase)) * 0.2;
    const glowRadius = this.radius * 2.2 * this.pulseScale;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = glowAlpha;
    const glow = ctx.createRadialGradient(this.x, this.y, this.radius * 0.2, this.x, this.y, glowRadius);
    glow.addColorStop(0, this.bodyColor);
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(this.x, this.y, glowRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const sprite = STAR_SPRITES[this.spriteKey];
    if (sprite && sprite.complete && sprite.naturalWidth > 0) {
      const scale = ((this.radius * 2) / sprite.naturalWidth) * this.pulseScale;
      const drawW = sprite.naturalWidth * scale;
      const drawH = sprite.naturalHeight * scale;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.drawImage(sprite, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * this.pulseScale, 0, Math.PI * 2);
      ctx.fillStyle = this.bodyColor;
      ctx.fill();
    }
  }
}

