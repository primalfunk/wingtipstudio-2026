import { CONFIG } from "../game/config.js";

const { GOAL } = CONFIG;

export class Goal {
  constructor(x, y, width, height, options = {}) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.sprite = new Image();
    this.sprite.src = GOAL.SPRITE_SRC;
    const rotation = Number.isFinite(options.rotation)
      ? options.rotation
      : Math.random() * Math.PI * 2;
    const speed = Number.isFinite(options.rotationSpeed)
      ? Math.abs(options.rotationSpeed)
      : GOAL.ROT_SPEED_MIN + Math.random() * (GOAL.ROT_SPEED_MAX - GOAL.ROT_SPEED_MIN);
    this.rotation = rotation;
    this.rotationSpeed = Number.isFinite(options.rotationSpeed)
      ? options.rotationSpeed
      : (Math.random() < 0.5 ? -1 : 1) * speed;
  }

  update(dt) {
    this.rotation += this.rotationSpeed * dt;
  }

  draw(ctx) {
    ctx.save();
    if (this.sprite.complete && this.sprite.naturalWidth > 0) {
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate(this.rotation);
      const glowColor = GOAL.GLOW_COLOR ?? "rgba(120, 200, 255, 0.85)";
      const glowAlpha = Number.isFinite(GOAL.GLOW_ALPHA) ? GOAL.GLOW_ALPHA : 0.85;
      const glowBlur = Number.isFinite(GOAL.GLOW_BLUR)
        ? GOAL.GLOW_BLUR
        : Math.max(this.width, this.height) * 0.8;
      const glowScale = Number.isFinite(GOAL.GLOW_SCALE) ? GOAL.GLOW_SCALE : 1.2;
      const pulseSpeed = Number.isFinite(GOAL.GLOW_PULSE_SPEED) ? GOAL.GLOW_PULSE_SPEED : 0;
      const pulseAmount = Number.isFinite(GOAL.GLOW_PULSE_AMOUNT) ? GOAL.GLOW_PULSE_AMOUNT : 0;
      const pulse = (pulseSpeed !== 0 && pulseAmount !== 0)
        ? 1 + Math.sin(performance.now() * pulseSpeed) * pulseAmount
        : 1;
      if (glowAlpha > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = glowAlpha;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = glowBlur * pulse;
        const glowW = this.width * glowScale * pulse;
        const glowH = this.height * glowScale * pulse;
        ctx.drawImage(this.sprite, -glowW / 2, -glowH / 2, glowW, glowH);
        ctx.restore();
      }
      ctx.drawImage(this.sprite, -this.width / 2, -this.height / 2, this.width, this.height);
    } else {
      ctx.fillStyle = "rgba(0, 255, 0, 0.25)";
      ctx.strokeStyle = "lime";
      ctx.lineWidth = 2;
      ctx.fillRect(this.x, this.y, this.width, this.height);
      ctx.strokeRect(this.x, this.y, this.width, this.height);
    }
    ctx.restore();
  }

  containsPoint(px, py, margin = 0) {
    return (
      px >= this.x - margin &&
      px <= this.x + this.width + margin &&
      py >= this.y - margin &&
      py <= this.y + this.height + margin
    );
  }
}

