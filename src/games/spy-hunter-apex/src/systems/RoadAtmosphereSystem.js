import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, ROAD } from '../data/tuning.js';

export default class RoadAtmosphereSystem {
  constructor(scene, missionState) {
    this.scene = scene;
    this.missionState = missionState;
    this.currentSegmentId = null;
    this.mode = 'clear';
    this.pulse = 0;

    this.overlay = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0)
      .setDepth(16);
    this.edgeGlowLeft = scene.add.rectangle(ROAD.left - 22, GAME_HEIGHT / 2, 34, GAME_HEIGHT, 0x9ee7f5, 0)
      .setDepth(3.2);
    this.edgeGlowRight = scene.add.rectangle(ROAD.right + 22, GAME_HEIGHT / 2, 34, GAME_HEIGHT, 0x9ee7f5, 0)
      .setDepth(3.2);
    this.sweep = scene.add.rectangle(GAME_WIDTH / 2, -90, GAME_WIDTH + 80, 42, 0xf6e7a8, 0)
      .setDepth(17)
      .setAngle(-7);
    this.waterLines = Array.from({ length: 8 }, (_, index) => {
      const line = scene.add.rectangle(Phaser.Math.Between(40, GAME_WIDTH - 40), index * 92, Phaser.Math.Between(48, 110), 2, 0x9ee7f5, 0)
        .setDepth(0.8)
        .setAngle(Phaser.Math.Between(-18, 18));
      line.seed = index;
      return line;
    });
  }

  update(delta) {
    this.syncSegment();
    this.pulse += delta / 1000;
    this.updateMode(delta);
  }

  syncSegment() {
    const segment = this.missionState.currentSegment;
    if (!segment || segment.id === this.currentSegmentId) {
      return;
    }

    this.currentSegmentId = segment.id;
    this.mode = this.resolveMode(segment);
    this.applyStaticMode();
  }

  resolveMode(segment) {
    const tags = segment.tags ?? [];
    if (tags.includes('tunnel')) {
      return 'tunnel';
    }
    if (tags.includes('checkpoint') || tags.includes('fortified')) {
      return 'checkpoint';
    }
    if (tags.includes('industrial') || tags.includes('freight')) {
      return 'industrial';
    }
    if (tags.includes('construction') || tags.includes('diversion')) {
      return 'construction';
    }
    if (tags.includes('water') || tags.includes('river') || tags.includes('bridge') || tags.includes('flood-channel')) {
      return 'water';
    }
    return 'clear';
  }

  applyStaticMode() {
    const config = {
      clear: { overlay: 0, glow: 0, color: 0x9ee7f5, sweep: 0 },
      water: { overlay: 0.05, glow: 0.1, color: 0x9ee7f5, sweep: 0.08 },
      industrial: { overlay: 0.09, glow: 0.08, color: 0xd18b3a, sweep: 0.07 },
      construction: { overlay: 0.07, glow: 0.06, color: 0xd99735, sweep: 0.09 },
      checkpoint: { overlay: 0.1, glow: 0.08, color: 0xe05c5c, sweep: 0.12 },
      tunnel: { overlay: 0.26, glow: 0.16, color: 0x9ee7f5, sweep: 0.05 },
    }[this.mode];

    this.overlay.setFillStyle(0x000000, config.overlay);
    this.edgeGlowLeft.setFillStyle(config.color, config.glow);
    this.edgeGlowRight.setFillStyle(config.color, config.glow);
    this.sweep.setFillStyle(config.color, config.sweep);
    for (const line of this.waterLines) {
      line.setVisible(this.mode === 'water');
    }
  }

  updateMode(delta) {
    const scrollDelta = (ROAD.scrollSpeed * delta) / 1000;
    this.sweep.y += scrollDelta * (this.mode === 'checkpoint' ? 1.7 : 1.2);
    this.sweep.setAlpha(this.mode === 'clear' ? 0 : 0.08 + Math.max(0, Math.sin(this.pulse * 3)) * 0.06);
    if (this.sweep.y > GAME_HEIGHT + 90) {
      this.sweep.y = Phaser.Math.Between(-220, -90);
    }

    const flicker = 0.75 + Math.sin(this.pulse * (this.mode === 'tunnel' ? 8 : 3)) * 0.25;
    this.edgeGlowLeft.setAlpha(this.mode === 'clear' ? 0 : flicker);
    this.edgeGlowRight.setAlpha(this.mode === 'clear' ? 0 : flicker);

    for (const line of this.waterLines) {
      if (!line.visible) {
        continue;
      }
      line.y += scrollDelta * 0.82;
      line.setAlpha(0.08 + Math.max(0, Math.sin(this.pulse * 2.4 + line.seed)) * 0.13);
      if (line.y > GAME_HEIGHT + 24) {
        line.y = Phaser.Math.Between(-130, -24);
        line.x = Phaser.Math.Between(34, GAME_WIDTH - 34);
      }
    }
  }
}
