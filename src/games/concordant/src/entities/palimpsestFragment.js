import { CONFIG } from "../game/config.js";

const PALIMPSEST = CONFIG.SECTOR.PALIMPSEST ?? {};
const FRAGMENTS = PALIMPSEST.FRAGMENTS ?? {};
const FALLBACK_SPRITES = [
  "assets/ui/sprites/pal_1.png",
  "assets/ui/sprites/pal_2.png",
  "assets/ui/sprites/pal_3.png",
  "assets/ui/sprites/pal_4.png",
  "assets/ui/sprites/pal_5.png",
  "assets/ui/sprites/pal_6.png"
];
const SPRITE_SOURCES = Array.isArray(FRAGMENTS.SPRITES) && FRAGMENTS.SPRITES.length > 0
  ? FRAGMENTS.SPRITES
  : FALLBACK_SPRITES;
const SPRITES = SPRITE_SOURCES.map((src) => {
  const img = new Image();
  img.src = src;
  return img;
});

export class PalimpsestFragment {
  constructor(options) {
    const opts = options ?? {};
    this.center = opts.center ?? { x: 0, y: 0 };
    this.orbitRadius = opts.orbitRadius ?? 0;
    this.orbitSpeed = opts.orbitSpeed ?? 0;
    this.orbitPhase = opts.orbitPhase ?? 0;
    this.orbitAngle = opts.orbitAngle ?? 0;
    this.eccentricity = opts.eccentricity ?? 0;
    this.rotation = opts.rotation ?? 0;
    this.spinSpeed = opts.spinSpeed ?? 0;
    this.radius = opts.radius ?? 40;
    this.bounce = opts.bounce ?? 0.8;
    this.spriteIndex = Number.isFinite(opts.spriteIndex) ? opts.spriteIndex : 0;
    this.sprite = SPRITES[this.spriteIndex % SPRITES.length];
    this.x = opts.x ?? this.center.x;
    this.y = opts.y ?? this.center.y;
  }

  update(dt, timeSeconds = 0) {
    const angle = this.orbitPhase + this.orbitSpeed * timeSeconds;
    const major = this.orbitRadius;
    const minor = this.orbitRadius * (1 - this.eccentricity);
    const localX = Math.cos(angle) * major;
    const localY = Math.sin(angle) * minor;
    const ca = Math.cos(this.orbitAngle);
    const sa = Math.sin(this.orbitAngle);
    this.x = this.center.x + localX * ca - localY * sa;
    this.y = this.center.y + localX * sa + localY * ca;
    this.rotation += this.spinSpeed * dt;
  }

  draw(ctx) {
    const sprite = this.sprite;
    const size = this.radius * 2;
    if (sprite && sprite.complete && sprite.naturalWidth > 0) {
      const scale = size / sprite.naturalWidth;
      const drawW = sprite.naturalWidth * scale;
      const drawH = sprite.naturalHeight * scale;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.drawImage(sprite, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.fillStyle = "rgba(180, 180, 190, 0.8)";
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  }
}
