import { CONFIG } from "../game/config.js";

const { STATION } = CONFIG;
const STATION_SPRITE = new Image();
STATION_SPRITE.src = STATION.SPRITE_SRC;

export class UpgradeStation {
  constructor(x, y, options = {}) {
    this.x = x;
    this.y = y;
    this.id = options.id ?? `${x},${y}`;
    this.safeRadius = options.safeRadius ?? STATION.SAFE_ZONE_RADIUS;
    this.dockRadius = options.dockRadius ?? STATION.DOCK_RADIUS;
    this.isStartStation = Boolean(options.isStartStation);
    this.tierCap = options.tierCap ?? null;
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    const baseSize = Math.max(70, this.safeRadius * 0.8);
    const scaleFactor = STATION.SPRITE_SCALE ?? 1;
    const size = baseSize * scaleFactor;
    if (STATION_SPRITE.complete && STATION_SPRITE.naturalWidth > 0) {
      const scale = size / STATION_SPRITE.naturalWidth;
      const drawW = STATION_SPRITE.naturalWidth * scale;
      const drawH = STATION_SPRITE.naturalHeight * scale;
      ctx.drawImage(STATION_SPRITE, -drawW / 2, -drawH / 2, drawW, drawH);
    } else {
      ctx.fillStyle = "rgba(80, 200, 140, 0.85)";
      ctx.strokeStyle = "rgba(180, 255, 210, 0.85)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 32 * scaleFactor, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const period = STATION.WAVE_PERIOD ?? 2.4;
    const expand = STATION.WAVE_EXPAND_RATIO ?? 0.2;
    const alpha = STATION.WAVE_ALPHA ?? 0.22;
    const startRadius = size * 0.55;
    for (let i = 0; i < 2; i++) {
      const phase = ((performance.now() / 1000) / period + i * 0.5) % 1;
      const radius = startRadius * (1 + expand * phase);
      const fade = Math.pow(1 - phase, 2) * alpha;
      if (fade <= 0.01) {
        continue;
      }
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = `rgba(130, 240, 200, ${fade})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
}
