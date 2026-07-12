import Phaser from 'phaser';
import { titleTextStyle } from '../theme/Typography.js';

const TITLE_FONT = '"Arbedo", "Grisha", "MoonRunner", "VakultaTrial", "Ethnocentric", "Neuropol", "Bank Gothic", "Eurostile Extended", "Arial Black", sans-serif';
const SPARK_COLLISION_THRESHOLD = 0.009;
const SPARK_COLLISION_COOLDOWN_MS = 190;
const SPARK_SEPARATION_AMOUNT = 0.018;
const SPARK_SPEED_FAST = 0.000155;
const SPARK_SPEED_MEDIUM = 0.000108;
const SPARK_SPEED_SLOW = 0.000072;
const SPARK_RED_GLOW_MULTIPLIER = 1.35;
const SPARK_PARTICLE_COLORS = [0x8ff0ff, 0xffe45c, 0xff5b5b, 0x8ff0d0, 0xc4a0ff, 0xffffff];
const VAPOR_SWIRL_COUNT = 34;
const VAPOR_COLORS = [0x8ff0ff, 0xb4c1c7, 0x5fdde8, 0xd9f4ff];

export class MenuTitleLogo {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(20);
    this.pieces = [];

    this.backGlow = scene.add.graphics();
    this.vaporFx = scene.add.graphics();
    this.perimeterFx = scene.add.graphics();
    this.glintFx = scene.add.graphics();
    this.vaporWisps = this.createVaporWisps();
    this.perimeterPoints = [
      { x: -76, y: -284 },
      { x: 76, y: -284 },
      { x: 76, y: -45 },
      { x: 430, y: -45 },
      { x: 430, y: 95 },
      { x: 76, y: 95 },
      { x: 76, y: 305 },
      { x: -76, y: 305 },
      { x: -76, y: 95 },
      { x: -430, y: 95 },
      { x: -430, y: -45 },
      { x: -76, y: -45 },
      { x: -76, y: -284 }
    ];
    this.perimeterSegments = this.buildPerimeterSegments();
    this.sparks = [
      {
        id: 'cyan-fast',
        position: 0.04,
        speed: SPARK_SPEED_FAST,
        direction: 1,
        color: 0x8ff0ff,
        alpha: 0.95,
        radius: 3.8,
        glow: 1,
        trail: [],
        passThroughChance: 0.33,
        speedPhase: 0.4,
        speedSwing: 0.34
      },
      {
        id: 'teal-medium',
        position: 0.46,
        speed: SPARK_SPEED_MEDIUM,
        direction: -1,
        color: 0xffe45c,
        alpha: 0.9,
        radius: 3.4,
        glow: 1.08,
        trail: [],
        passThroughChance: 0.33,
        speedPhase: 2.1,
        speedSwing: 0.28
      },
      {
        id: 'red-slow',
        position: 0.78,
        speed: SPARK_SPEED_SLOW,
        direction: -1,
        color: 0xff3b3b,
        alpha: 0.9,
        radius: 4.2,
        glow: SPARK_RED_GLOW_MULTIPLIER,
        trail: [],
        passThroughChance: 0.5,
        speedPhase: 4.6,
        speedSwing: 0.2
      }
    ];
    this.sparkCollisions = new Map();
    this.collisionFlashes = [];
    this.sparkParticles = [];
    this.lastSparkUpdate = null;

    this.backGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.vaporFx.setBlendMode(Phaser.BlendModes.ADD);
    this.perimeterFx.setBlendMode(Phaser.BlendModes.ADD);
    this.glintFx.setBlendMode(Phaser.BlendModes.ADD);

    this.container.add([this.backGlow, this.vaporFx, this.perimeterFx]);
    this.addTitlePiece('D', 0, -196, 156, 0.98);
    this.addTitlePiece('Y', 0, -87, 150, 0.98);
    this.addTitlePiece('PLASMO', 0, 26, 128, 1.5);
    this.addTitlePiece('N', 0, 126, 148, 0.98);
    this.addTitlePiece('E', 0, 232, 148, 0.98);
    this.container.add(this.glintFx);
  }

  addTitlePiece(text, x, y, fontSize, scaleX = 1) {
    const edgeShadow = this.scene.add.text(x, y + 12, text, this.makeStyle('#030607', fontSize, 9)).setOrigin(0.5);
    const backShadow = this.scene.add.text(x, y + 7, text, this.makeStyle('#141a1d', fontSize, 7)).setOrigin(0.5);
    const lowerShade = this.scene.add.text(x, y + 6, text, this.makeStyle('#22292d', fontSize, 5)).setOrigin(0.5);
    const mainText = this.scene.add.text(x, y, text, this.makeStyle('#4b5559', fontSize, 6)).setOrigin(0.5);
    const topSheen = this.scene.add.text(x, y - 7, text, this.makeStyle('#89979d', fontSize, 4)).setOrigin(0.5);

    for (const layer of [edgeShadow, backShadow, lowerShade, mainText, topSheen]) {
      layer.setScale(scaleX, 1);
    }
    edgeShadow.setAlpha(0.92);
    backShadow.setAlpha(0.82);
    lowerShade.setAlpha(0.38);
    mainText.setShadow(0, 0, '#061012', 12, true, true);
    topSheen.setAlpha(0.46);
    topSheen.setShadow(0, -2, '#d5eef3', 8, true, true);

    this.container.add([edgeShadow, backShadow, lowerShade, mainText, topSheen]);
    this.pieces.push({ text, x, y, fontSize, width: mainText.width * scaleX, height: mainText.height });
  }

  makeStyle(color, fontSize = 164, strokeThickness = 6) {
    return titleTextStyle({
      fontFamily: TITLE_FONT,
      fontSize: `${fontSize}px`,
      color,
      fontStyle: '900',
      stroke: '#0b1114',
      strokeThickness,
      letterSpacing: 4
    });
  }

  boot() {
    this.container.setAlpha(1);
    this.container.setScale(1);
    this.lastSparkUpdate = null;
  }

  update(time) {
    const glowPulse = 0.5 + Math.sin(time * 0.0018) * 0.5;
    this.backGlow.clear();
    this.backGlow.fillStyle(0x8fefff, 0.055 + glowPulse * 0.035);
    this.backGlow.fillEllipse(0, 28, 900, 460);
    this.backGlow.fillStyle(0xb4c1c7, 0.045 + glowPulse * 0.03);
    this.backGlow.fillEllipse(0, 30, 640, 520);
    this.drawVaporField(time);
    this.drawPerimeterEnergy(time);

    this.glintFx.clear();
    const cycle = 3100;
    const progress = (time % cycle) / cycle;
    if (progress < 0.32) {
      return;
    }
    const t = (progress - 0.32) / 0.113;
    if (t > 1) {
      return;
    }
    const alpha = Math.sin(t * Math.PI);
    const sweepX = -720 + t * 1440;
    for (const piece of this.pieces) {
      const halfWidth = piece.width / 2;
      const halfHeight = piece.height * 0.36;
      if (sweepX < piece.x - halfWidth - 16 || sweepX > piece.x + halfWidth + 16) {
        continue;
      }
      this.glintFx.fillStyle(0xf8fdff, 0.54 * alpha);
      this.glintFx.fillPoints([
        { x: sweepX - 5, y: piece.y - halfHeight },
        { x: sweepX + 9, y: piece.y - halfHeight },
        { x: sweepX - 8, y: piece.y + halfHeight },
        { x: sweepX - 22, y: piece.y + halfHeight }
      ], true);
      this.glintFx.fillStyle(0xffffff, 0.68 * alpha);
      this.glintFx.fillRect(sweepX - 4, piece.y - halfHeight + 4, 2, halfHeight * 2 - 8);
    }
  }

  createVaporWisps() {
    const wisps = [];
    for (let i = 0; i < VAPOR_SWIRL_COUNT; i += 1) {
      const seed = Math.sin((i + 1) * 91.17) * 43758.5453;
      const frac = seed - Math.floor(seed);
      const seedB = Math.sin((i + 1) * 47.61) * 19341.475;
      const fracB = seedB - Math.floor(seedB);
      wisps.push({
        offset: frac * Math.PI * 2,
        radiusX: Phaser.Math.Linear(150, 360, frac),
        radiusY: Phaser.Math.Linear(60, 170, fracB),
        speed: Phaser.Math.Linear(0.00018, 0.00043, (frac + fracB) * 0.5),
        phase: fracB * Math.PI * 2,
        length: Phaser.Math.Linear(58, 118, fracB),
        width: Phaser.Math.Linear(4, 10, frac),
        color: VAPOR_COLORS[i % VAPOR_COLORS.length],
        alpha: Phaser.Math.Linear(0.018, 0.052, fracB),
        drift: Phaser.Math.Linear(5, 18, frac)
      });
    }
    return wisps;
  }

  drawVaporField(time) {
    this.vaporFx.clear();
    this.vaporFx.fillStyle(0x8ff0ff, 0.018);
    this.vaporFx.fillEllipse(0, 28, 860, 420);

    for (const wisp of this.vaporWisps) {
      const theta = time * wisp.speed + wisp.offset;
      const wobble = Math.sin(time * 0.00074 + wisp.phase);
      const cx = Math.cos(theta) * (wisp.radiusX + wobble * wisp.drift);
      const cy = 28 + Math.sin(theta * 1.22 + wisp.phase * 0.18) * (wisp.radiusY + wobble * wisp.drift * 0.6);
      const tangent = theta + Math.PI / 2 + Math.sin(time * 0.0005 + wisp.phase) * 0.35;
      const normal = tangent + Math.PI / 2;
      const life = 0.55 + Math.sin(time * 0.0011 + wisp.phase) * 0.45;
      const pointCount = 7;
      const points = [];
      for (let i = 0; i < pointCount; i += 1) {
        const t = (i / (pointCount - 1) - 0.5) * wisp.length;
        const ripple = Math.sin(time * 0.0016 + wisp.phase + i * 0.9) * wisp.width;
        points.push({
          x: cx + Math.cos(tangent) * t + Math.cos(normal) * ripple,
          y: cy + Math.sin(tangent) * t + Math.sin(normal) * ripple
        });
      }

      this.vaporFx.lineStyle(wisp.width * 1.8, wisp.color, wisp.alpha * life * 0.34);
      this.vaporFx.strokePoints(points, false);
      this.vaporFx.lineStyle(wisp.width * 0.62, wisp.color, wisp.alpha * life);
      this.vaporFx.strokePoints(points, false);

      if (life > 0.82) {
        this.vaporFx.fillStyle(wisp.color, wisp.alpha * 0.54);
        this.vaporFx.fillCircle(cx, cy, wisp.width * 1.2);
      }
    }
  }

  drawPerimeterEnergy(time) {
    const slowPulse = 0.5 + Math.sin(time * 0.0009) * 0.5;
    this.perimeterFx.clear();

    this.updateSparks(time);
    for (const spark of this.sparks) {
      this.drawPerimeterSparkTrail(spark, time);
    }
    this.updateSparkParticles(time);
    this.drawSparkParticles(time);
    for (const spark of this.sparks) {
      const redPulse = spark.id === 'red-slow' ? 0.84 + Math.sin(time * 0.0017) * 0.16 : 1;
      this.drawPerimeterSpark(spark, (spark.alpha + slowPulse * 0.1) * redPulse);
    }
    this.drawCollisionFlashes(time);
    this.drawCornerFlickers(time);
  }

  updateSparks(time) {
    if (this.lastSparkUpdate === null) {
      this.lastSparkUpdate = time;
      return;
    }
    const delta = Math.min(50, Math.max(0, time - this.lastSparkUpdate));
    this.lastSparkUpdate = time;

    for (const spark of this.sparks) {
      const speedScale = 1 + Math.sin(time * 0.0011 + spark.speedPhase) * spark.speedSwing;
      spark.currentSpeedScale = speedScale;
      spark.position = this.wrapTrackPosition(spark.position + spark.direction * spark.speed * speedScale * delta);
      const speedRatio = (spark.speed * speedScale) / SPARK_SPEED_FAST;
      const trailSpeedRatio = spark.id === 'red-slow' ? 1 : speedRatio;
      const maxAge = Phaser.Math.Clamp(110 + trailSpeedRatio * 260, 150, 390);
      spark.trail ??= [];
      spark.trail.push({ position: spark.position, time, speedRatio });
      spark.trail = spark.trail.filter((sample) => time - sample.time <= maxAge);
      this.maybeEmitSparkParticle(spark, time, delta, speedRatio);
    }

    for (let a = 0; a < this.sparks.length; a += 1) {
      for (let b = a + 1; b < this.sparks.length; b += 1) {
        this.resolveSparkCollision(this.sparks[a], this.sparks[b], time);
      }
    }
  }

  resolveSparkCollision(a, b, time) {
    const key = [a.id, b.id].sort().join(':');
    const cooldownUntil = this.sparkCollisions.get(key) ?? 0;
    if (time < cooldownUntil) {
      return;
    }

    const distance = this.circularDistance(a.position, b.position);
    if (distance >= SPARK_COLLISION_THRESHOLD) {
      return;
    }

    const passThroughChance = Math.min(a.passThroughChance ?? 0, b.passThroughChance ?? 0);
    this.sparkCollisions.set(key, time + SPARK_COLLISION_COOLDOWN_MS);
    if (Math.random() < passThroughChance) {
      return;
    }

    const collisionPoint = this.midpointOnTrack(a.position, b.position);
    a.direction *= -1;
    b.direction *= -1;
    a.position = this.wrapTrackPosition(a.position + a.direction * SPARK_SEPARATION_AMOUNT);
    b.position = this.wrapTrackPosition(b.position + b.direction * SPARK_SEPARATION_AMOUNT);
    this.collisionFlashes.push({
      position: collisionPoint,
      startedAt: time,
      duration: 180,
      color: a.id === 'red-slow' || b.id === 'red-slow' ? 0xff5b5b : 0xd9f4ff
    });
  }

  drawPerimeterSpark(spark, alpha) {
    const point = this.pointOnPerimeter(spark.position);
    const glow = spark.glow ?? 1;
    this.perimeterFx.fillStyle(spark.color, 0.18 * alpha);
    this.perimeterFx.fillCircle(point.x, point.y, 13 * glow);
    this.perimeterFx.fillStyle(spark.color, 0.34 * alpha);
    this.perimeterFx.fillCircle(point.x, point.y, 8 * glow);
    this.perimeterFx.fillStyle(0xffffff, 0.9 * alpha);
    this.perimeterFx.fillCircle(point.x, point.y, spark.radius);
  }

  drawPerimeterSparkTrail(spark, time) {
    const trail = spark.trail ?? [];
    if (trail.length < 2) {
      return;
    }
    const speedRatio = (spark.speed * (spark.currentSpeedScale ?? 1)) / SPARK_SPEED_FAST;
    const trailSpeedRatio = spark.id === 'red-slow' ? 1 : speedRatio;
    const maxAge = Phaser.Math.Clamp(110 + trailSpeedRatio * 260, 150, 390);
    const glow = spark.glow ?? 1;
    for (let i = 1; i < trail.length; i += 1) {
      const previous = trail[i - 1];
      const current = trail[i];
      if (this.circularDistance(previous.position, current.position) > 0.08) {
        continue;
      }
      const age = time - current.time;
      const life = Phaser.Math.Clamp(1 - age / maxAge, 0, 1);
      if (life <= 0) {
        continue;
      }
      const eased = life * life;
      const a = this.pointOnPerimeter(previous.position);
      const b = this.pointOnPerimeter(current.position);
      this.perimeterFx.lineStyle((9 * glow) * eased, spark.color, 0.058 * eased);
      this.perimeterFx.lineBetween(a.x, a.y, b.x, b.y);
      this.perimeterFx.lineStyle((4 * glow) * eased, spark.color, 0.15 * eased);
      this.perimeterFx.lineBetween(a.x, a.y, b.x, b.y);
    }
  }

  maybeEmitSparkParticle(spark, time, delta, speedRatio) {
    const slowFactor = Phaser.Math.Clamp(1 - speedRatio, 0, 1);
    const ratePerSecond = 2.4 + slowFactor * 8.4;
    if (Math.random() > ratePerSecond * delta / 1000) {
      return;
    }
    const point = this.pointOnPerimeter(spark.position);
    const angle = Math.random() * Math.PI * 2;
    const distance = Phaser.Math.Between(10, 20);
    const lifetime = Phaser.Math.Between(240, 430);
    this.sparkParticles.push({
      x: point.x,
      y: point.y,
      vx: Math.cos(angle) * distance / lifetime,
      vy: Math.sin(angle) * distance / lifetime,
      radius: Phaser.Math.FloatBetween(1.2, 2.4),
      color: Phaser.Utils.Array.GetRandom(SPARK_PARTICLE_COLORS),
      bornAt: time,
      lifetime
    });
  }

  updateSparkParticles(time) {
    this.sparkParticles = this.sparkParticles.filter((particle) => time - particle.bornAt <= particle.lifetime);
  }

  drawSparkParticles(time) {
    for (const particle of this.sparkParticles) {
      const age = time - particle.bornAt;
      const progress = Phaser.Math.Clamp(age / particle.lifetime, 0, 1);
      const x = particle.x + particle.vx * age;
      const y = particle.y + particle.vy * age;
      const alpha = (1 - progress) * 0.82;
      this.perimeterFx.fillStyle(particle.color, alpha * 0.28);
      this.perimeterFx.fillCircle(x, y, particle.radius * 2.4);
      this.perimeterFx.fillStyle(particle.color, alpha);
      this.perimeterFx.fillCircle(x, y, particle.radius);
    }
  }

  drawCollisionFlashes(time) {
    this.collisionFlashes = this.collisionFlashes.filter((flash) => time - flash.startedAt <= flash.duration);
    for (const flash of this.collisionFlashes) {
      const progress = (time - flash.startedAt) / flash.duration;
      const point = this.pointOnPerimeter(flash.position);
      const alpha = Math.sin(progress * Math.PI);
      this.perimeterFx.fillStyle(flash.color, 0.11 * alpha);
      this.perimeterFx.fillCircle(point.x, point.y, 13 + progress * 7);
      this.perimeterFx.lineStyle(1, 0xffffff, 0.22 * alpha);
      this.perimeterFx.lineBetween(point.x - 8, point.y, point.x + 8, point.y);
      this.perimeterFx.lineBetween(point.x, point.y - 8, point.x, point.y + 8);
    }
  }

  drawCornerFlickers(time) {
    const corners = this.perimeterPoints.slice(0, -1);
    const active = Math.floor(time / 740) % corners.length;
    const phase = (time % 740) / 740;
    if (phase > 0.2) {
      return;
    }
    const corner = corners[active];
    const alpha = Math.sin((phase / 0.2) * Math.PI) * 0.72;
    this.perimeterFx.lineStyle(2, 0xeaffff, alpha);
    this.perimeterFx.lineBetween(corner.x - 13, corner.y, corner.x + 13, corner.y);
    this.perimeterFx.lineBetween(corner.x, corner.y - 13, corner.x, corner.y + 13);
    this.perimeterFx.fillStyle(0x8ff7ff, alpha * 0.2);
    this.perimeterFx.fillCircle(corner.x, corner.y, 18);
  }

  pointOnPerimeter(progress) {
    let distance = this.wrapTrackPosition(progress) * this.perimeterLength;
    for (let i = 0; i < this.perimeterSegments.length; i += 1) {
      const { a, b, length } = this.perimeterSegments[i];
      if (distance <= length) {
        const t = distance / length;
        return {
          x: Phaser.Math.Linear(a.x, b.x, t),
          y: Phaser.Math.Linear(a.y, b.y, t)
        };
      }
      distance -= length;
    }
    return this.perimeterPoints[0];
  }

  buildPerimeterSegments() {
    const segments = [];
    this.perimeterLength = 0;
    for (let i = 0; i < this.perimeterPoints.length - 1; i += 1) {
      const a = this.perimeterPoints[i];
      const b = this.perimeterPoints[i + 1];
      const length = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      segments.push({ a, b, length });
      this.perimeterLength += length;
    }
    return segments;
  }

  wrapTrackPosition(position) {
    return ((position % 1) + 1) % 1;
  }

  circularDistance(a, b) {
    const raw = Math.abs(a - b);
    return Math.min(raw, 1 - raw);
  }

  midpointOnTrack(a, b) {
    const raw = b - a;
    let delta = raw;
    if (Math.abs(raw) > 0.5) {
      delta = raw > 0 ? raw - 1 : raw + 1;
    }
    return this.wrapTrackPosition(a + delta / 2);
  }

  startLock() {}

  setPosition(x, y) {
    this.container.setPosition(x, y);
    this.container.setScale(1, 1);
  }

  destroy() {
    this.container.destroy(true);
  }
}
