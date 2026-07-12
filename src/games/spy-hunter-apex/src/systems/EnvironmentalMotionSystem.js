import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, ROAD } from '../data/tuning.js';

const MOTION_PROFILES = {
  bridge: {
    density: 7,
    color: 0x020506,
    accent: 0x9ee7f5,
    kinds: ['bridgeShadow', 'pylonFlicker', 'windStreak'],
  },
  tunnel: {
    density: 10,
    color: 0x9ee7f5,
    accent: 0xe8fbff,
    kinds: ['lightPulse', 'wallStrobe', 'ventSweep'],
  },
  industrial: {
    density: 8,
    color: 0xd18b3a,
    accent: 0xf6b15d,
    kinds: ['sodiumGlow', 'steamDrift', 'warningBlink'],
  },
  checkpoint: {
    density: 8,
    color: 0xe05c5c,
    accent: 0xf6e7a8,
    kinds: ['scanBeam', 'warningBlink', 'gateShadow'],
  },
  water: {
    density: 10,
    color: 0x75c6d8,
    accent: 0x9ee7f5,
    kinds: ['waterSheen', 'buoyBlink', 'channelWake'],
  },
  construction: {
    density: 8,
    color: 0xd99735,
    accent: 0xe0c166,
    kinds: ['arrowPulse', 'workLamp', 'dustSweep'],
  },
  interchange: {
    density: 8,
    color: 0xb8c7bd,
    accent: 0xd9dfd3,
    kinds: ['bridgeShadow', 'windStreak', 'scanBeam'],
  },
  none: {
    density: 0,
    color: 0xffffff,
    accent: 0xffffff,
    kinds: [],
  },
};

export default class EnvironmentalMotionSystem {
  constructor(scene, missionState) {
    this.scene = scene;
    this.missionState = missionState;
    this.currentSegmentId = null;
    this.profile = MOTION_PROFILES.none;
    this.pulse = 0;
    this.effects = [];
    this.createEffects();
  }

  createEffects() {
    for (let index = 0; index < 12; index += 1) {
      const effect = this.scene.add.container(0, 0).setDepth(15.2);
      effect.seed = index;
      effect.scrollScale = 1;
      this.effects.push(effect);
    }
  }

  update(delta) {
    this.syncProfile();
    this.pulse += delta / 1000;
    const scrollDelta = (ROAD.scrollSpeed * delta) / 1000;
    for (const effect of this.effects) {
      effect.y += scrollDelta * effect.scrollScale;
      this.animateEffect(effect);
      if (effect.y > GAME_HEIGHT + 120) {
        this.resetEffect(effect, Phaser.Math.Between(-300, -60));
      }
    }
  }

  syncProfile() {
    const segment = this.missionState.currentSegment;
    if (!segment || segment.id === this.currentSegmentId) {
      return;
    }

    this.currentSegmentId = segment.id;
    this.profile = this.resolveProfile(segment);
    for (const effect of this.effects) {
      this.resetEffect(effect, Phaser.Math.Between(-120, GAME_HEIGHT + 80));
    }
  }

  resolveProfile(segment) {
    const tags = segment.tags ?? [];
    if (tags.includes('tunnel')) {
      return MOTION_PROFILES.tunnel;
    }
    if (tags.includes('checkpoint') || tags.includes('fortified')) {
      return MOTION_PROFILES.checkpoint;
    }
    if (tags.includes('industrial') || tags.includes('freight')) {
      return MOTION_PROFILES.industrial;
    }
    if (tags.includes('construction') || tags.includes('diversion')) {
      return MOTION_PROFILES.construction;
    }
    if (tags.includes('interchange') || tags.includes('overpass')) {
      return MOTION_PROFILES.interchange;
    }
    if (tags.includes('water') || tags.includes('river') || tags.includes('dock') || tags.includes('flood-channel')) {
      return MOTION_PROFILES.water;
    }
    if (tags.includes('bridge') || tags.includes('causeway')) {
      return MOTION_PROFILES.bridge;
    }
    return MOTION_PROFILES.none;
  }

  resetEffect(effect, y) {
    effect.removeAll(true);
    effect.y = y;
    effect.scrollScale = Phaser.Math.FloatBetween(0.94, 1.08);
    effect.kind = this.profile.kinds.length > 0
      ? this.profile.kinds[(effect.seed + Phaser.Math.Between(0, this.profile.kinds.length - 1)) % this.profile.kinds.length]
      : 'none';
    effect.setVisible(effect.seed < this.profile.density && effect.kind !== 'none');

    if (!effect.visible) {
      return;
    }

    this.drawEffect(effect, effect.kind);
    this.animateEffect(effect);
  }

  drawEffect(effect, kind) {
    if (kind === 'bridgeShadow') {
      effect.x = GAME_WIDTH / 2;
      effect.add(this.scene.add.rectangle(0, 0, GAME_WIDTH + 80, 34, this.profile.color, 0.22).setAngle(-8));
      effect.add(this.scene.add.rectangle(0, -18, GAME_WIDTH + 80, 4, this.profile.accent, 0.08).setAngle(-8));
      return;
    }

    if (kind === 'pylonFlicker') {
      this.placeAtRoadEdge(effect);
      effect.add(this.scene.add.rectangle(0, 0, 18, 96, this.profile.accent, 0.08));
      effect.add(this.scene.add.circle(0, -42, 7, this.profile.accent, 0.18));
      return;
    }

    if (kind === 'windStreak') {
      effect.x = Phaser.Math.Between(26, GAME_WIDTH - 26);
      effect.add(this.scene.add.rectangle(0, 0, Phaser.Math.Between(54, 140), 2, this.profile.accent, 0.08).setAngle(Phaser.Math.Between(-10, 10)));
      return;
    }

    if (kind === 'lightPulse') {
      this.placeInsideRoad(effect);
      effect.add(this.scene.add.rectangle(0, 0, 6, 80, this.profile.color, 0.22));
      effect.add(this.scene.add.rectangle(0, 0, 42, 2, this.profile.accent, 0.12));
      return;
    }

    if (kind === 'wallStrobe') {
      this.placeAtRoadEdge(effect);
      effect.add(this.scene.add.rectangle(0, 0, 12, 118, this.profile.color, 0.12));
      return;
    }

    if (kind === 'ventSweep') {
      effect.x = GAME_WIDTH / 2;
      effect.add(this.scene.add.rectangle(0, 0, ROAD.right - ROAD.left + 70, 20, this.profile.accent, 0.06).setAngle(6));
      return;
    }

    if (kind === 'sodiumGlow') {
      this.placeAtRoadEdge(effect, 62);
      effect.add(this.scene.add.circle(0, 0, 34, this.profile.color, 0.08));
      effect.add(this.scene.add.circle(0, 0, 9, this.profile.accent, 0.18));
      return;
    }

    if (kind === 'steamDrift') {
      this.placeAtRoadEdge(effect, 86);
      effect.add(this.scene.add.ellipse(0, 0, 86, 26, 0xded0b8, 0.06).setAngle(Phaser.Math.Between(-18, 18)));
      effect.add(this.scene.add.ellipse(24 * effect.side, -14, 58, 18, 0xded0b8, 0.045));
      return;
    }

    if (kind === 'warningBlink') {
      this.placeAtRoadEdge(effect, 54);
      effect.add(this.scene.add.rectangle(0, 12, 5, 38, this.profile.color, 0.18));
      effect.add(this.scene.add.circle(0, -10, 8, this.profile.accent, 0.28));
      return;
    }

    if (kind === 'scanBeam') {
      effect.x = GAME_WIDTH / 2;
      effect.add(this.scene.add.rectangle(0, 0, GAME_WIDTH + 120, 18, this.profile.accent, 0.07).setAngle(Phaser.Math.Between(-14, 14)));
      return;
    }

    if (kind === 'gateShadow') {
      effect.x = GAME_WIDTH / 2;
      effect.add(this.scene.add.rectangle(0, 0, ROAD.right - ROAD.left + 86, 28, 0x000000, 0.22));
      effect.add(this.scene.add.rectangle(-128, 0, 10, 64, this.profile.color, 0.12));
      effect.add(this.scene.add.rectangle(128, 0, 10, 64, this.profile.color, 0.12));
      return;
    }

    if (kind === 'waterSheen') {
      effect.x = Phaser.Math.Between(34, GAME_WIDTH - 34);
      effect.add(this.scene.add.rectangle(0, 0, Phaser.Math.Between(62, 130), 2, this.profile.accent, 0.1).setAngle(Phaser.Math.Between(-18, 18)));
      return;
    }

    if (kind === 'buoyBlink') {
      this.placeAtRoadEdge(effect, 42);
      effect.add(this.scene.add.circle(0, 0, 7, this.profile.color, 0.18));
      effect.add(this.scene.add.circle(0, -2, 3, this.profile.accent, 0.34));
      return;
    }

    if (kind === 'channelWake') {
      effect.x = GAME_WIDTH / 2 + Phaser.Math.Between(-96, 96);
      effect.add(this.scene.add.rectangle(0, 0, 78, 2, this.profile.accent, 0.08).setAngle(Phaser.Math.Between(-26, 26)));
      effect.add(this.scene.add.rectangle(18, 12, 46, 2, this.profile.accent, 0.055).setAngle(Phaser.Math.Between(-26, 26)));
      return;
    }

    if (kind === 'arrowPulse') {
      this.placeInsideRoad(effect);
      effect.add(this.scene.add.triangle(0, 0, -14, 12, 14, 0, -14, -12, this.profile.accent, 0.18).setAngle(effect.x < GAME_WIDTH / 2 ? 0 : 180));
      return;
    }

    if (kind === 'workLamp') {
      this.placeAtRoadEdge(effect, 48);
      effect.add(this.scene.add.circle(0, -6, 9, this.profile.accent, 0.2));
      effect.add(this.scene.add.rectangle(effect.side * -18, 4, 58, 16, this.profile.color, 0.05).setAngle(effect.side * 10));
      return;
    }

    if (kind === 'dustSweep') {
      effect.x = GAME_WIDTH / 2 + Phaser.Math.Between(-120, 120);
      effect.add(this.scene.add.ellipse(0, 0, 86, 22, 0xc6b27a, 0.055).setAngle(Phaser.Math.Between(-16, 16)));
    }
  }

  animateEffect(effect) {
    if (!effect.visible) {
      return;
    }
    const flicker = 0.55 + Math.max(0, Math.sin(this.pulse * (2.8 + effect.seed * 0.17) + effect.seed)) * 0.45;
    const slow = 0.65 + Math.max(0, Math.sin(this.pulse * 1.35 + effect.seed)) * 0.35;
    const isBlink = ['warningBlink', 'buoyBlink', 'workLamp', 'pylonFlicker'].includes(effect.kind);
    const isSweep = ['scanBeam', 'ventSweep', 'bridgeShadow', 'gateShadow'].includes(effect.kind);
    effect.setAlpha(isBlink ? flicker : isSweep ? slow : 0.78 + slow * 0.22);
  }

  placeAtRoadEdge(effect, offset = 32) {
    effect.side = effect.seed % 2 === 0 ? -1 : 1;
    effect.x = effect.side < 0 ? ROAD.left - offset : ROAD.right + offset;
  }

  placeInsideRoad(effect) {
    const centers = this.scene.roadSystem?.getLaneCenters?.() ?? [GAME_WIDTH / 2];
    effect.x = centers[effect.seed % centers.length];
  }
}
