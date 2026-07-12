import { gameplayImages } from "../assets/images/gameplay";
import type { AmmoMode, FallingObject, ImpactFeedback, Launcher, LaunchEffect, Projectile, ScreenShake, Settings, VisualEffect } from "./types";
import { LAUNCHER_HEIGHT, LAUNCHER_WIDTH, MAX_BASE_HITS, WORLD_HEIGHT, WORLD_WIDTH } from "./types";

function imageFromUrl(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

const LANE_COLORS = ["#18c7ff", "#44e667", "#ff375f", "#ffbf36", "#8c5cff"];

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private backgroundImage = imageFromUrl(gameplayImages.background);
  private asteroidImage = imageFromUrl(gameplayImages.asteroid);
  private bulletImage = imageFromUrl(gameplayImages.bullet);
  private explosionSheet = imageFromUrl(gameplayImages.explosion.url);
  private launcherImages = gameplayImages.launchers.map(imageFromUrl);
  private launchSheet = imageFromUrl(gameplayImages.launchAnimation.url);
  private lastAmmoLabel = "";
  private ammoChangedAt = performance.now();
  private resizeObserver: ResizeObserver;
  private backingWidth = 0;
  private backingHeight = 0;
  private scaleX = 1;
  private scaleY = 1;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    this.ctx = ctx;
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(canvas);
    this.resizeCanvas();
  }

  destroy(): void {
    this.resizeObserver.disconnect();
  }

  render(args: {
    launchers: Launcher[];
    objects: FallingObject[];
    projectiles: Projectile[];
    effects: VisualEffect[];
    launchEffects: LaunchEffect[];
    impactFeedback: ImpactFeedback | null;
    screenShake: ScreenShake | null;
    level: number;
    health: number;
    settings: Settings;
    feedback: string | null;
    ammoLabel: string;
    ammoMode: AmmoMode;
  }): void {
    const { ctx } = this;
    this.resizeCanvas();
    this.applyWorldTransform();
    if (args.ammoLabel !== this.lastAmmoLabel) {
      this.lastAmmoLabel = args.ammoLabel;
      this.ammoChangedAt = performance.now();
    }
    ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.save();
    this.applyShake(args.impactFeedback, args.screenShake, args.settings);
    this.background(args.level, args.settings);
    for (const launcher of args.launchers) this.drawLane(launcher, args.settings);
    for (const object of args.objects) this.drawObject(object, args.level, args.settings);
    for (const projectile of args.projectiles) this.drawProjectile(projectile);
    for (const effect of args.effects) this.drawEffect(effect, args.settings);
    for (const launcher of args.launchers) this.drawLauncher(launcher, args.level, args.settings);
    for (const effect of args.launchEffects) this.drawLaunchEffect(effect, args.settings);
    this.drawAmmo(args.ammoLabel, args.ammoMode, args.settings);
    this.drawHealth(args.health, args.impactFeedback);
    if (args.feedback) this.drawFeedback(args.feedback);
    ctx.restore();
    this.drawImpactFlash(args.impactFeedback, args.settings);
  }

  private resizeCanvas(): void {
    const rect = this.canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, rect.width || WORLD_WIDTH);
    const cssHeight = Math.max(1, rect.height || WORLD_HEIGHT);
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const nextWidth = Math.round(cssWidth * dpr);
    const nextHeight = Math.round(cssHeight * dpr);

    if (nextWidth === this.backingWidth && nextHeight === this.backingHeight) return;

    this.backingWidth = nextWidth;
    this.backingHeight = nextHeight;
    this.canvas.width = nextWidth;
    this.canvas.height = nextHeight;
    this.scaleX = nextWidth / WORLD_WIDTH;
    this.scaleY = nextHeight / WORLD_HEIGHT;
    this.applyWorldTransform();
  }

  private applyWorldTransform(): void {
    this.ctx.setTransform(this.scaleX, 0, 0, this.scaleY, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
  }

  private background(level: number, settings: Settings): void {
    const { ctx } = this;
    this.drawImageCover(this.backgroundImage, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    if (settings.highContrast) {
      ctx.fillStyle = "rgba(0,0,0,.38)";
      ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    }
    const hue = settings.colorblindSafe ? 202 : (205 + level * 10) % 360;
    const overlay = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
    overlay.addColorStop(0, `hsla(${hue} 90% 8% / .36)`);
    overlay.addColorStop(0.45, "rgba(0,0,0,.08)");
    overlay.addColorStop(1, "rgba(0,0,0,.42)");
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    const nebula = ctx.createRadialGradient(760, 160, 20, 760, 160, 420);
    nebula.addColorStop(0, "rgba(255, 67, 204, .13)");
    nebula.addColorStop(0.45, "rgba(50, 221, 255, .07)");
    nebula.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    const starCount = settings.reducedMotion ? 70 : 95 + level * 5;
    ctx.fillStyle = settings.highContrast ? "#fff" : "rgba(247,251,255,.82)";
    for (let i = 0; i < starCount; i++) {
      const x = (i * 73 + level * 11) % WORLD_WIDTH;
      const y = (i * 41 + level * 7) % 360;
      const size = i % 9 === 0 ? 2 : 1;
      ctx.fillRect(x, y, size, size);
    }
    if (level >= 6 && !settings.reducedMotion) {
      ctx.strokeStyle = "rgba(88,220,255,.16)";
      for (let i = 0; i < 20; i++) {
        const x = (i * 57 + performance.now() / 22 + level * 19) % WORLD_WIDTH;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x - 42, 118);
        ctx.stroke();
      }
    }
  }

  private applyShake(impact: ImpactFeedback | null, shake: ScreenShake | null, settings: Settings): void {
    if (settings.reducedMotion) return;
    const impactAmount = impact ? 9 * impact.intensity * (1 - Math.min(1, impact.age / impact.duration)) : 0;
    const shakeAmount = shake ? 7 * shake.intensity * (1 - Math.min(1, shake.age / shake.duration)) : 0;
    const amount = impactAmount + shakeAmount;
    if (amount <= 0) return;
    const age = impact?.age ?? shake?.age ?? 0;
    const x = Math.sin(age * 95) * amount;
    const y = Math.cos(age * 131) * amount * 0.62;
    this.ctx.translate(x, y);
  }

  private drawImpactFlash(impact: ImpactFeedback | null, settings: Settings): void {
    if (!impact) return;
    const t = Math.min(1, impact.age / impact.duration);
    const alpha = (settings.reducedMotion ? 0.16 : 0.28) * (1 - t) * impact.intensity;
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = `rgba(255, 32, 42, ${Math.min(0.42, alpha)})`;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.strokeStyle = `rgba(255, 70, 70, ${Math.min(0.9, alpha * 3)})`;
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, WORLD_WIDTH - 14, WORLD_HEIGHT - 14);
    ctx.restore();
  }

  private drawPlayfieldFrame(settings: Settings): void {
    const { ctx } = this;
    ctx.save();
    ctx.strokeStyle = settings.highContrast ? "#fff" : "rgba(154,215,255,.34)";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(28, 92, WORLD_WIDTH - 56, 336);
    const gradient = ctx.createLinearGradient(0, 92, 0, 428);
    gradient.addColorStop(0, "rgba(79,209,197,.045)");
    gradient.addColorStop(1, "rgba(255,207,90,.03)");
    ctx.fillStyle = gradient;
    ctx.fillRect(29, 93, WORLD_WIDTH - 58, 334);
    ctx.restore();
  }

  private drawHealth(health: number, impact: ImpactFeedback | null): void {
    const { ctx } = this;
    const impactT = impact ? Math.min(1, impact.age / impact.duration) : 1;
    const pulse = impact ? Math.sin(impactT * Math.PI) : 0;
    for (let i = 0; i < MAX_BASE_HITS; i++) {
      const wasLost = impact ? i < impact.previousHealth && i >= impact.currentHealth : false;
      const scale = wasLost ? 1 + pulse * 1.15 : 1;
      ctx.save();
      ctx.translate(54 + i * 22, 424);
      ctx.scale(scale, scale);
      ctx.shadowColor = wasLost ? "#ff2f2f" : i < health ? "#7ee787" : "transparent";
      ctx.shadowBlur = wasLost ? 20 : i < health ? 7 : 0;
      ctx.fillStyle = wasLost ? "#ff3b3b" : i < health ? "#7ee787" : "#5b1f2a";
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      if (wasLost) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawLauncher(launcher: Launcher, level: number, settings: Settings): void {
    const { ctx } = this;
    const img = this.launcherImages[launcher.laneIndex % this.launcherImages.length];
    const pulse = settings.reducedMotion ? 0 : Math.sin(performance.now() / 180) * 2;
    const bob = settings.reducedMotion ? 0 : Math.sin(performance.now() / 520 + launcher.laneIndex) * 2.2;
    ctx.save();
    ctx.translate(0, bob);
    const laneColor = LANE_COLORS[launcher.laneIndex % LANE_COLORS.length];
    ctx.fillStyle = launcher.selected ? `${laneColor}42` : "rgba(55, 235, 255, .12)";
    ctx.shadowColor = launcher.selected ? laneColor : "#38d5ff";
    ctx.shadowBlur = launcher.selected ? 24 : 12;
    ctx.beginPath();
    ctx.ellipse(launcher.x, launcher.y + 34, launcher.selected ? 62 + pulse : 46, launcher.selected ? 14 : 9, 0, 0, Math.PI * 2);
    ctx.fill();
    if (launcher.selected) {
      ctx.shadowColor = settings.highContrast ? "#fff" : laneColor;
      ctx.shadowBlur = 24 + level + pulse * 2;
      ctx.strokeStyle = settings.highContrast ? "#fff" : laneColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(launcher.x, launcher.y + 26, 64 + pulse * 1.5, 15 + pulse * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(255,255,255,.88)";
      ctx.beginPath();
      ctx.ellipse(launcher.x, launcher.y + 26, 47 + pulse, 10, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    const scale = launcher.selected ? 1.08 : 1;
    ctx.globalAlpha = launcher.selected ? 1 : 0.78;
    const drawWidth = 76 * scale;
    const drawHeight = 92 * scale;
    ctx.drawImage(img, launcher.x - drawWidth / 2, launcher.y - drawHeight / 2, drawWidth, drawHeight);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  private drawLane(launcher: Launcher, settings: Settings): void {
    const { ctx } = this;
    ctx.save();
    const top = 82;
    const bottom = 436;
    const laneColor = LANE_COLORS[launcher.laneIndex % LANE_COLORS.length];
    const beam = ctx.createLinearGradient(launcher.x, top, launcher.x, bottom);
    beam.addColorStop(0, launcher.selected ? `${laneColor}2f` : "rgba(56,213,255,.035)");
    beam.addColorStop(0.68, launcher.selected ? `${laneColor}14` : "rgba(56,213,255,.02)");
    beam.addColorStop(1, launcher.selected ? `${laneColor}52` : "rgba(56,213,255,.08)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(launcher.x - 58, bottom);
    ctx.lineTo(launcher.x - 16, top);
    ctx.lineTo(launcher.x + 16, top);
    ctx.lineTo(launcher.x + 58, bottom);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = launcher.selected
      ? (settings.highContrast ? "#fff" : "rgba(255,207,90,.62)")
      : "rgba(100,238,255,.11)";
    ctx.lineWidth = launcher.selected ? 2.5 : 1.2;
    ctx.beginPath();
    ctx.moveTo(launcher.x - 54, bottom);
    ctx.lineTo(launcher.x + 54, bottom);
    ctx.stroke();
    if (launcher.selected) {
      ctx.shadowColor = "#ffcf5a";
      ctx.shadowBlur = 22;
      ctx.strokeStyle = laneColor;
      ctx.beginPath();
      ctx.moveTo(launcher.x, bottom);
      ctx.lineTo(launcher.x, top + 28);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawAmmo(label: string, mode: AmmoMode, settings: Settings): void {
    const { ctx } = this;
    const pulse = settings.reducedMotion ? 0 : Math.sin(performance.now() / 420) * 0.5 + 0.5;
    const changedT = Math.min(1, (performance.now() - this.ammoChangedAt) / 260);
    const pop = settings.reducedMotion ? 1 : 1 + Math.sin((1 - changedT) * Math.PI) * 0.12;
    ctx.save();
    ctx.translate(WORLD_WIDTH / 2, 68 + pulse * 2);
    ctx.scale(pop, pop);
    ctx.shadowColor = settings.highContrast ? "#fff" : "#38d5ff";
    ctx.shadowBlur = 28 + pulse * 12;
    const streak = ctx.createLinearGradient(-250, 24, 250, 24);
    streak.addColorStop(0, "rgba(56,213,255,0)");
    streak.addColorStop(0.18, "rgba(56,213,255,.9)");
    streak.addColorStop(0.5, "rgba(255,255,255,.92)");
    streak.addColorStop(0.82, "rgba(255,92,225,.9)");
    streak.addColorStop(1, "rgba(255,92,225,0)");
    ctx.strokeStyle = streak;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-250, 30);
    ctx.lineTo(250, 30);
    ctx.stroke();
    ctx.shadowBlur = 18;
    ctx.strokeStyle = "rgba(255,92,225,.86)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-150, 40);
    ctx.lineTo(150, 40);
    ctx.stroke();
    ctx.shadowColor = "#38d5ff";
    ctx.shadowBlur = 24;
    this.label(label, 0, -3, 310, 50, "#fff", 62, 28);
    void mode;
    ctx.restore();
  }

  private drawObject(object: FallingObject, level: number, settings: Settings): void {
    const { ctx } = this;
    void level;
    const radius = object.radius;
    const spawn = Math.min(1, object.age / 0.25);
    const scale = settings.reducedMotion ? 1 : 0.72 + spawn * 0.28;
    const bob = settings.reducedMotion ? 0 : Math.sin(object.age * 4.2 + object.laneIndex) * 2.5;
    ctx.save();
    ctx.translate(object.x, object.y + bob);
    ctx.scale(scale, scale);
    if (!settings.reducedMotion) ctx.rotate(object.age * object.rotationSpeed * object.rotationDirection);
    ctx.shadowColor = settings.highContrast ? "#fff" : "rgba(154,215,255,.72)";
    ctx.shadowBlur = settings.highContrast ? 3 : 13;
    ctx.drawImage(this.asteroidImage, -radius, -radius, radius * 2, radius * 2);
    ctx.restore();

    ctx.save();
    ctx.translate(object.x, object.y + bob);
    ctx.scale(scale, scale);
    const rimPulse = settings.reducedMotion ? 0 : Math.sin(object.age * 5.5) * 0.5 + 0.5;
    ctx.fillStyle = "#02060b";
    ctx.strokeStyle = settings.highContrast ? "#fff" : `rgba(125,249,255,${0.76 + rimPulse * 0.2})`;
    ctx.shadowColor = settings.highContrast ? "#fff" : "#38d5ff";
    ctx.shadowBlur = 10 + rimPulse * 8;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    this.label(object.label, 0, 1, radius * 0.9, 32, "#fff", 40, 22);
    ctx.restore();
  }

  private drawProjectile(projectile: Projectile): void {
    const { ctx } = this;
    ctx.save();
    const trail = ctx.createLinearGradient(projectile.x, projectile.y + 44, projectile.x, projectile.y - 28);
    trail.addColorStop(0, "rgba(255,207,90,0)");
    trail.addColorStop(0.55, "rgba(255,207,90,.42)");
    trail.addColorStop(1, "rgba(255,255,255,.72)");
    ctx.strokeStyle = trail;
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(projectile.x, projectile.y + 48);
    ctx.lineTo(projectile.x, projectile.y + 6);
    ctx.stroke();
    ctx.shadowColor = "#ffcf5a";
    ctx.shadowBlur = 18;
    ctx.translate(projectile.x, projectile.y);
    ctx.drawImage(this.bulletImage, -11, -38, 22, 76);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  private drawLaunchEffect(effect: LaunchEffect, settings: Settings): void {
    const { ctx } = this;
    const config = gameplayImages.launchAnimation;
    const frame = Math.min(config.frameCount - 1, Math.floor((effect.age / effect.duration) * config.frameCount));
    const col = frame % config.columns;
    const row = Math.floor(frame / config.columns);
    const alpha = Math.max(0, 1 - effect.age / effect.duration);
    const width = 72;
    const height = 84;
    ctx.save();
    ctx.globalAlpha = settings.reducedMotion ? alpha * 0.75 : alpha;
    ctx.drawImage(
      this.launchSheet,
      col * config.frameWidth,
      row * config.frameHeight,
      config.frameWidth,
      config.frameHeight,
      effect.x - width / 2,
      effect.y - height / 2,
      width,
      height
    );
    ctx.restore();
  }

  private drawEffect(effect: VisualEffect, settings: Settings): void {
    const { ctx } = this;
    const t = Math.min(1, effect.age / effect.duration);
    const alpha = 1 - t;
    if (effect.kind === "explosion") {
      this.drawExplosionEffect(effect, alpha);
      return;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = effect.kind === "wrong" ? "#ff9a9a" : settings.highContrast ? "#fff" : "#7ee787";
    ctx.fillStyle = effect.kind === "wrong" ? "#ff9a9a" : "#7ee787";
    ctx.lineWidth = 3;
    const radius = effect.kind === "wrong" ? 12 + t * 24 : 18 + t * 34;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const inner = 12 + t * 10;
      const outer = 24 + t * 36;
      ctx.beginPath();
      ctx.moveTo(effect.x + Math.cos(angle) * inner, effect.y + Math.sin(angle) * inner);
      ctx.lineTo(effect.x + Math.cos(angle) * outer, effect.y + Math.sin(angle) * outer);
      ctx.stroke();
    }
    if (effect.label) this.label(effect.label, effect.x, effect.y - 34 * t, 180, 24, ctx.fillStyle.toString(), effect.kind === "wrong" ? 20 : 22, 14);
    ctx.restore();
  }

  private drawExplosionEffect(effect: VisualEffect, alpha: number): void {
    const { ctx } = this;
    const config = gameplayImages.explosion;
    const frame = Math.min(config.frameCount - 1, Math.floor((effect.age / effect.duration) * config.frameCount));
    const col = frame % config.columns;
    const row = Math.floor(frame / config.columns);
    const t = Math.min(1, effect.age / effect.duration);
    const size = 190 + t * 44;
    const glowSize = size * 1.35;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const flash = ctx.createRadialGradient(effect.x, effect.y, 0, effect.x, effect.y, glowSize * 0.46);
    flash.addColorStop(0, `rgba(255,255,255,${0.52 * alpha})`);
    flash.addColorStop(0.18, `rgba(255,210,75,${0.42 * alpha})`);
    flash.addColorStop(0.48, `rgba(255,88,26,${0.22 * alpha})`);
    flash.addColorStop(1, "rgba(255,88,26,0)");
    ctx.fillStyle = flash;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, glowSize * 0.5, 0, Math.PI * 2);
    ctx.fill();

    this.drawExplosionSprite(col, row, glowSize, effect.x + 5, effect.y - 4, alpha * 0.42, Math.PI * 0.18);
    this.drawExplosionSprite(col, row, size, effect.x, effect.y, alpha, 0);
    this.drawExplosionSparks(effect, t, alpha);
    this.drawExplosionFragments(effect, t, alpha);
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = `rgba(255, 236, 154, ${0.72 * alpha})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = "#ff9d2e";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(effect.x, effect.y, 24 + t * 74, 0, Math.PI * 2);
    ctx.stroke();
    if (effect.label) this.label(effect.label, effect.x, effect.y - 68 * (1 - alpha), 190, 28, "#fff16e", 28, 16);
    ctx.restore();
  }

  private drawExplosionSprite(col: number, row: number, size: number, x: number, y: number, alpha: number, rotation: number): void {
    const config = gameplayImages.explosion;
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.drawImage(
      this.explosionSheet,
      col * config.frameWidth,
      row * config.frameHeight,
      config.frameWidth,
      config.frameHeight,
      -size / 2,
      -size / 2,
      size,
      size
    );
    ctx.restore();
  }

  private drawExplosionSparks(effect: VisualEffect, t: number, alpha: number): void {
    const { ctx } = this;
    const seed = this.hash(effect.id);
    ctx.save();
    ctx.lineCap = "round";
    for (let i = 0; i < 22; i += 1) {
      const angle = seed + i * 2.399;
      const variance = 0.72 + ((this.hash(`${effect.id}-${i}`) % 100) / 100) * 0.72;
      const inner = 18 + t * 22;
      const outer = (72 + t * 86) * variance;
      const x1 = effect.x + Math.cos(angle) * inner;
      const y1 = effect.y + Math.sin(angle) * inner;
      const x2 = effect.x + Math.cos(angle) * outer;
      const y2 = effect.y + Math.sin(angle) * outer;
      const spark = ctx.createLinearGradient(x1, y1, x2, y2);
      spark.addColorStop(0, `rgba(255,255,255,${0.9 * alpha})`);
      spark.addColorStop(0.35, `rgba(255,204,68,${0.72 * alpha})`);
      spark.addColorStop(1, "rgba(255,82,18,0)");
      ctx.strokeStyle = spark;
      ctx.lineWidth = i % 3 === 0 ? 3 : 1.6;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawExplosionFragments(effect: VisualEffect, t: number, alpha: number): void {
    const { ctx } = this;
    const seed = this.hash(effect.id);
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < 10; i += 1) {
      const localSeed = this.hash(`${effect.id}-fragment-${i}`);
      const angle = seed * 0.001 + i * 0.628 + (localSeed % 37) * 0.01;
      const speed = 38 + (localSeed % 62);
      const drift = speed * Math.sin(t * Math.PI * 0.72);
      const spin = t * Math.PI * (2.5 + (localSeed % 5));
      const size = 5 + (localSeed % 7);
      const x = effect.x + Math.cos(angle) * drift;
      const y = effect.y + Math.sin(angle) * drift + t * t * 22;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + spin);
      ctx.globalAlpha = alpha * (0.35 + (localSeed % 50) / 100);
      ctx.fillStyle = i % 3 === 0 ? "#6b5b4c" : i % 3 === 1 ? "#9c8a74" : "#3c3330";
      ctx.strokeStyle = "rgba(255, 210, 110, 0.48)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.82, size * 0.64);
      ctx.lineTo(-size * 0.72, size * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  private hash(text: string): number {
    let value = 0;
    for (let i = 0; i < text.length; i += 1) value = (value * 31 + text.charCodeAt(i)) >>> 0;
    return value;
  }

  private drawFeedback(text: string): void {
    this.label(text, WORLD_WIDTH / 2, 112, 420, 34, text.includes("Correct") ? "#7ee787" : "#ff9a9a", 26);
  }

  private measureLabelWidth(text: string, size: number): number {
    this.ctx.font = `800 ${size}px system-ui, sans-serif`;
    return this.ctx.measureText(text).width;
  }

  private drawImageCover(image: HTMLImageElement, x: number, y: number, width: number, height: number): void {
    if (!image.naturalWidth || !image.naturalHeight) {
      this.ctx.fillStyle = "#07111e";
      this.ctx.fillRect(x, y, width, height);
      return;
    }
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    this.ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
  }

  private label(text: string, x: number, y: number, maxWidth: number, lineHeight: number, color: string, maxSize = 22, minSize = 12): void {
    const { ctx } = this;
    let size = maxSize;
    const explicitLines = text.split("\n");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 ${size}px system-ui, sans-serif`;
    while (Math.max(...explicitLines.map((line) => ctx.measureText(line).width)) > maxWidth && size > minSize) {
      size -= 1;
      ctx.font = `800 ${size}px system-ui, sans-serif`;
    }
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(3, size * 0.16);
    ctx.strokeStyle = "rgba(0,0,0,.82)";
    if (explicitLines.length > 1) {
      const startY = y - ((explicitLines.length - 1) * lineHeight) / 2;
      for (let i = 0; i < explicitLines.length; i += 1) {
        ctx.strokeText(explicitLines[i], x, startY + i * lineHeight);
        ctx.fillText(explicitLines[i], x, startY + i * lineHeight);
      }
      return;
    }
    const words = text.split(" ");
    if (ctx.measureText(text).width <= maxWidth || words.length === 1) {
      ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);
      return;
    }
    const mid = Math.ceil(words.length / 2);
    ctx.strokeText(words.slice(0, mid).join(" "), x, y - lineHeight / 2);
    ctx.fillText(words.slice(0, mid).join(" "), x, y - lineHeight / 2);
    ctx.strokeText(words.slice(mid).join(" "), x, y + lineHeight / 2);
    ctx.fillText(words.slice(mid).join(" "), x, y + lineHeight / 2);
  }
}
