import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, ROAD } from '../data/tuning.js';

const DETAIL_PROFILES = {
  interstate: {
    colors: [0x9da9a1, 0x6f8079, 0x2f4a39],
    kinds: ['utilityPole', 'reflector', 'smallSign', 'tree'],
    density: 13,
  },
  hostile: {
    colors: [0x8f4c42, 0x6e675b, 0x303638],
    kinds: ['barrier', 'warningLamp', 'scrub', 'reflector'],
    density: 12,
  },
  support: {
    colors: [0x8fcdda, 0x9fb7bd, 0x4f7882],
    kinds: ['lightPole', 'utilityBox', 'smallSign', 'reflector'],
    density: 12,
  },
  waterway: {
    colors: [0x7fa1a7, 0x4fb0ca, 0x2f5f6d],
    kinds: ['channelMarker', 'pylon', 'dockPost', 'reflector'],
    density: 11,
  },
  industrial: {
    colors: [0x8b6a48, 0xa26a38, 0x5d5a52],
    kinds: ['pipeMarker', 'utilityBox', 'barrier', 'warningLamp'],
    density: 14,
  },
  interchange: {
    colors: [0xb8c7bd, 0x8b9992, 0x304b27],
    kinds: ['smallSign', 'lightPole', 'reflector', 'barrier'],
    density: 15,
  },
  checkpoint: {
    colors: [0xb8a47a, 0xe05c5c, 0x776f64],
    kinds: ['barrier', 'warningLamp', 'lightPole', 'smallSign'],
    density: 14,
  },
  tunnel: {
    colors: [0x566168, 0x9ee7f5, 0x303638],
    kinds: ['wallLight', 'reflector', 'barrier'],
    density: 10,
  },
  construction: {
    colors: [0xd99735, 0xe0c166, 0x6e675b],
    kinds: ['coneStack', 'barrier', 'warningLamp', 'smallSign', 'workArrowBoard'],
    density: 16,
  },
  default: {
    colors: [0x9da9a1, 0x687772, 0x42544b],
    kinds: ['utilityPole', 'reflector', 'smallSign'],
    density: 10,
  },
};

export default class RoadsideDetailSystem {
  constructor(scene, missionState) {
    this.scene = scene;
    this.missionState = missionState;
    this.details = [];
    this.currentSegmentId = null;
    this.profile = DETAIL_PROFILES.default;
    this.createDetails();
  }

  createDetails() {
    const wideBonus = Math.max(0, Math.floor((GAME_WIDTH - 640) / 120));
    for (let index = 0; index < 18 + wideBonus * 2; index += 1) {
      const detail = this.scene.add.container(0, 0).setDepth(2.8);
      detail.seed = index;
      detail.side = index % 2 === 0 ? -1 : 1;
      detail.parts = [];
      this.details.push(detail);
    }
  }

  update(delta) {
    this.syncProfile();
    const scrollDelta = (ROAD.scrollSpeed * delta) / 1000;
    for (const detail of this.details) {
      detail.y += scrollDelta * detail.scrollScale;
      if (detail.y > GAME_HEIGHT + 70) {
        this.resetDetail(detail, Phaser.Math.Between(-220, -40));
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
    for (const detail of this.details) {
      this.resetDetail(detail, Phaser.Math.Between(-80, GAME_HEIGHT + 40));
    }
  }

  resolveProfile(segment) {
    const tags = segment.tags ?? [];
    if (tags.includes('water') || tags.includes('river') || tags.includes('dock') || tags.includes('river-approach')) {
      return DETAIL_PROFILES.waterway;
    }
    if (tags.includes('industrial') || tags.includes('freight')) {
      return DETAIL_PROFILES.industrial;
    }
    if (tags.includes('interchange') || tags.includes('overpass')) {
      return DETAIL_PROFILES.interchange;
    }
    if (tags.includes('checkpoint') || tags.includes('fortified')) {
      return DETAIL_PROFILES.checkpoint;
    }
    if (tags.includes('tunnel')) {
      return DETAIL_PROFILES.tunnel;
    }
    if (tags.includes('construction') || tags.includes('diversion')) {
      return DETAIL_PROFILES.construction;
    }
    if (tags.includes('enemy-heavy') || segment.surfaceProfile?.accent === 'hostile_scars') {
      return DETAIL_PROFILES.hostile;
    }
    if (tags.includes('support-rich') || segment.surfaceProfile?.accent === 'support_ticks') {
      return DETAIL_PROFILES.support;
    }
    if (tags.includes('interstate') || tags.includes('divided') || tags.includes('civilian-heavy')) {
      return DETAIL_PROFILES.interstate;
    }
    return DETAIL_PROFILES.default;
  }

  resetDetail(detail, y) {
    detail.removeAll(true);
    detail.y = y;
    detail.side = detail.seed % 2 === 0 ? -1 : 1;
    const marginWidth = detail.side < 0 ? ROAD.left : GAME_WIDTH - ROAD.right;
    const shoulderOffset = Phaser.Math.Clamp(marginWidth * 0.42, 34, 118);
    const shoulderX = detail.side < 0 ? ROAD.left - shoulderOffset : ROAD.right + shoulderOffset;
    detail.x = shoulderX + Phaser.Math.Between(-18, 24) * detail.side;
    detail.scrollScale = Phaser.Math.FloatBetween(0.95, 1.08);
    const densityBonus = Math.max(0, Math.floor((GAME_WIDTH - 620) / 180));
    detail.setVisible(detail.seed < this.profile.density + densityBonus);

    const kind = this.profile.kinds[(detail.seed + Phaser.Math.Between(0, this.profile.kinds.length - 1)) % this.profile.kinds.length];
    const color = this.profile.colors[detail.seed % this.profile.colors.length];
    this.drawKind(detail, kind, color);
  }

  addPropImage(detail, key, width, height, alpha = 0.9) {
    if (!this.scene.textures.exists(key)) {
      return false;
    }

    detail.add(this.scene.add.image(0, 0, key).setDisplaySize(width, height).setAlpha(alpha));
    return true;
  }

  drawKind(detail, kind, color) {
    if (kind === 'utilityPole') {
      if (this.addPropImage(detail, 'prop-utility-pole', 24, 61, 0.82)) {
        return;
      }
      detail.add(this.scene.add.rectangle(0, 0, 5, 44, color, 0.72));
      detail.add(this.scene.add.rectangle(detail.side * 9, -14, 18, 3, 0x8b9992, 0.52));
      return;
    }

    if (kind === 'lightPole') {
      if (this.addPropImage(detail, 'prop-light-pole', 22, 56, 0.82)) {
        return;
      }
      detail.add(this.scene.add.rectangle(0, 0, 4, 40, color, 0.68));
      detail.add(this.scene.add.circle(detail.side * 7, -18, 4, 0x9fe7f5, 0.34));
      return;
    }

    if (kind === 'smallSign') {
      if (this.addPropImage(detail, 'prop-small-highway-sign', 50, 41, 0.82)) {
        return;
      }
      detail.add(this.scene.add.rectangle(0, 10, 3, 24, 0xb8b09e, 0.7));
      detail.add(this.scene.add.rectangle(0, -5, 24, 14, color, 0.74).setStrokeStyle(1, 0xd6d0aa, 0.38));
      return;
    }

    if (kind === 'barrier') {
      if (this.addPropImage(detail, 'prop-concrete-barrier', 50, 23, 0.86)) {
        return;
      }
      detail.add(this.scene.add.rectangle(0, 0, 30, 10, color, 0.82).setAngle(detail.side * 8));
      detail.add(this.scene.add.rectangle(0, 0, 23, 2, 0xe0c166, 0.62).setAngle(detail.side * 8));
      return;
    }

    if (kind === 'warningLamp') {
      if (this.addPropImage(detail, 'prop-warning-lamp-post', 16, 55, 0.9)) {
        return;
      }
      detail.add(this.scene.add.rectangle(0, 8, 4, 24, color, 0.68));
      detail.add(this.scene.add.circle(0, -8, 5, 0xf6b15d, 0.42));
      return;
    }

    if (kind === 'channelMarker') {
      if (this.addPropImage(detail, 'prop-channel-marker-post', 20, 52, 0.86)) {
        return;
      }
      detail.add(this.scene.add.rectangle(0, 0, 10, 36, color, 0.64));
      detail.add(this.scene.add.triangle(0, -24, -8, 0, 8, 0, 0, -12, 0x9ee7f5, 0.62));
      return;
    }

    if (kind === 'pylon' || kind === 'dockPost') {
      if (this.addPropImage(detail, kind === 'dockPost' ? 'prop-dock-post' : 'prop-channel-marker-post', 20, 54, 0.82)) {
        return;
      }
      detail.add(this.scene.add.rectangle(0, 0, 12, 46, color, 0.66));
      detail.add(this.scene.add.rectangle(0, -18, 18, 5, 0xb7c4bd, 0.38));
      return;
    }

    if (kind === 'utilityBox') {
      if (this.addPropImage(detail, 'prop-utility-box', 32, 52, 0.84)) {
        return;
      }
      detail.add(this.scene.add.rectangle(0, 0, 20, 18, color, 0.72).setStrokeStyle(1, 0xb7c4bd, 0.25));
      return;
    }

    if (kind === 'pipeMarker') {
      if (this.addPropImage(detail, 'prop-pipe-marker', 17, 50, 0.84)) {
        return;
      }
      detail.add(this.scene.add.rectangle(0, 0, 30, 5, color, 0.72));
      detail.add(this.scene.add.rectangle(0, -9, 22, 4, 0xc78b46, 0.38));
      return;
    }

    if (kind === 'wallLight') {
      if (this.addPropImage(detail, 'prop-tunnel-wall-light', 34, 52, 0.82)) {
        return;
      }
      detail.add(this.scene.add.rectangle(0, 0, 7, 30, color, 0.5));
      detail.add(this.scene.add.rectangle(0, -6, 3, 18, 0x9ee7f5, 0.36));
      return;
    }

    if (kind === 'reflector') {
      if (this.addPropImage(detail, 'prop-reflective-marker-post', 14, 41, 0.82)) {
        return;
      }
      detail.add(this.scene.add.rectangle(0, 0, 5, 18, color, 0.56));
      return;
    }

    if (kind === 'workArrowBoard') {
      if (this.addPropImage(detail, 'prop-work-arrow-board', 38, 38, 0.9)) {
        return;
      }
      detail.add(this.scene.add.rectangle(0, 0, 28, 18, 0x303638, 0.78).setStrokeStyle(1, 0xd99735, 0.56));
      detail.add(this.scene.add.triangle(4, 0, -6, -6, -6, 6, 8, 0, 0xd99735, 0.86));
      return;
    }

    if (kind === 'coneStack') {
      if (this.addPropImage(detail, 'prop-orange-cone-stack', 26, 50, 0.9)) {
        return;
      }
      detail.add(this.scene.add.triangle(-6, 0, -13, 10, -6, -8, 1, 10, 0xd99735, 0.86));
      detail.add(this.scene.add.triangle(8, 4, 1, 14, 8, -4, 15, 14, 0xd99735, 0.78));
      detail.add(this.scene.add.rectangle(1, 8, 25, 2, 0xf6e7a8, 0.55));
      return;
    }

    if (kind === 'tree' || kind === 'scrub') {
      if (this.addPropImage(detail, 'prop-shrub-scrub', 34, 38, 0.78)) {
        return;
      }
      detail.add(this.scene.add.triangle(0, 0, -9, 10, 0, -10, 9, 10, color, 0.62));
      return;
    }

    detail.add(this.scene.add.rectangle(0, 0, 5, 18, color, 0.56));
  }
}
