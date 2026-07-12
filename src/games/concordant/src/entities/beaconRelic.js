import { CONFIG } from "../game/config.js";

const { BEACON_RELIC } = CONFIG;
const BEACON_SPRITE = new Image();
BEACON_SPRITE.src = BEACON_RELIC.SPRITE_SRC;

export class BeaconRelic {
  constructor(x, y, options = {}) {
    this.x = x;
    this.y = y;
    this.size = Number.isFinite(options.size) ? options.size : BEACON_RELIC.SIZE;
    this.shimmerPhase = Number.isFinite(options.shimmerPhase) ? options.shimmerPhase : 0;
    this.shimmerSpeed = Number.isFinite(options.shimmerSpeed) ? options.shimmerSpeed : BEACON_RELIC.SHIMMER_SPEED;
    this.rotation = Number.isFinite(options.rotation) ? options.rotation : 0;
    this.rotSpeed = Number.isFinite(options.rotSpeed) ? options.rotSpeed : BEACON_RELIC.ROT_SPEED;
    this.pulseAmount = Number.isFinite(options.pulseAmount) ? options.pulseAmount : BEACON_RELIC.PULSE_AMOUNT;
    this.pulseAlpha = Number.isFinite(options.pulseAlpha) ? options.pulseAlpha : BEACON_RELIC.PULSE_ALPHA;
  }

  update(dt) {
    this.shimmerPhase += dt * this.shimmerSpeed;
    this.rotation += dt * this.rotSpeed;
  }

  draw(ctx) {
    const size = this.size;
    const pulse = 0.5 + 0.5 * Math.sin(this.shimmerPhase * Math.PI * 2);
    const scale = 1 + this.pulseAmount * pulse;
    ctx.save();
    ctx.translate(this.x, this.y);

    ctx.save();
    ctx.rotate(this.rotation);
    ctx.scale(scale, scale);
    const sprite = BEACON_SPRITE;
    if (sprite.complete && sprite.naturalWidth > 0) {
      ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = "rgba(12, 16, 20, 0.9)";
      ctx.strokeStyle = "rgba(120, 200, 190, 0.7)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-size * 0.35, -size * 0.45);
      ctx.lineTo(size * 0.28, -size * 0.5);
      ctx.lineTo(size * 0.5, -size * 0.1);
      ctx.lineTo(size * 0.35, size * 0.45);
      ctx.lineTo(-size * 0.15, size * 0.35);
      ctx.lineTo(-size * 0.48, -size * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    ctx.globalCompositeOperation = "lighter";
    const glow = ctx.createRadialGradient(0, 0, size * 0.1, 0, 0, size * 0.8);
    glow.addColorStop(0, `rgba(160, 220, 205, ${this.pulseAlpha * (0.6 + pulse * 0.6)})`);
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
