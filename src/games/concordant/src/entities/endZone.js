
import { CONFIG } from "../game/config.js";

const { END_ZONE } = CONFIG;
const SCAN_SPRITE = new Image();
SCAN_SPRITE.src = END_ZONE.SPRITE_SRC;
const SCAN_ROT_SPEED = END_ZONE.ROT_SPEED;
const SCAN_PULSE_SPEED = END_ZONE.PULSE_SPEED;
const SCAN_PULSE_AMOUNT = END_ZONE.PULSE_AMOUNT;

export class EndZone {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() < 0.5 ? -1 : 1) * SCAN_ROT_SPEED;
    this.pulsePhase = Math.random() * Math.PI * 2;
  }

  update(dt) {
    this.rotation += this.rotationSpeed * dt;
    this.pulsePhase += SCAN_PULSE_SPEED * dt;
  }

  draw(ctx, isComplete = false) {
    ctx.save();
    if (SCAN_SPRITE.complete && SCAN_SPRITE.naturalWidth > 0) {
      const pulse = 1 + Math.sin(this.pulsePhase) * SCAN_PULSE_AMOUNT;
      const alphaPulse = 0.6 + (Math.sin(this.pulsePhase) * 0.2);
      const centerX = this.x + this.width / 2;
      const centerY = this.y + this.height / 2;

      ctx.translate(centerX, centerY);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `rgba(120, 255, 180, ${0.35 + alphaPulse * 0.35})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, (this.width * 0.7) * pulse, (this.height * 0.7) * pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = alphaPulse;
      ctx.rotate(this.rotation);
      ctx.drawImage(
        SCAN_SPRITE,
        -(this.width * pulse) / 2,
        -(this.height * pulse) / 2,
        this.width * pulse,
        this.height * pulse
      );
      ctx.restore();
    } else {
      ctx.fillStyle = isComplete ? "rgba(80, 255, 120, 0.2)" : "rgba(0, 255, 0, 0.15)";
      ctx.strokeStyle = isComplete ? "rgba(80, 255, 120, 0.9)" : "rgba(0, 255, 0, 0.7)";
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

