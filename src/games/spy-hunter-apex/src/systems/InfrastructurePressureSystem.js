import Phaser from 'phaser';
import { GAME_HEIGHT, ROAD } from '../data/tuning.js';

const PRESSURE_PROFILES = {
  construction: {
    lanes: [0, 3, 1, 2],
    spawnBlockedLanes: [0, 3],
    spacing: 232,
    width: 44,
    height: 96,
    alpha: 0.9,
    activeTopY: 500,
    dynamicSpawnLookaheadY: 260,
    warning: 'LANE CLOSURE',
  },
  tunnel: {
    lanes: [0, 3],
    spawnBlockedLanes: [0, 3],
    spacing: 260,
    width: 26,
    height: 132,
    alpha: 0.68,
    activeTopY: 520,
    dynamicSpawnLookaheadY: 300,
    warning: 'TUNNEL COMPRESSION',
  },
  bridge: {
    lanes: [0, 3],
    spawnBlockedLanes: [],
    spacing: 245,
    width: 24,
    height: 148,
    alpha: 0.62,
    activeTopY: 500,
    dynamicSpawnLookaheadY: 220,
    warning: 'BRIDGE EDGE',
  },
  checkpoint: {
    lanes: [0, 3],
    spawnBlockedLanes: [0, 3],
    spacing: 248,
    width: 52,
    height: 92,
    alpha: 0.84,
    activeTopY: 510,
    dynamicSpawnLookaheadY: 270,
    warning: 'CHECKPOINT CHANNEL',
  },
};

export default class InfrastructurePressureSystem {
  constructor(scene, missionState) {
    this.scene = scene;
    this.missionState = missionState;
    this.currentSegmentId = null;
    this.profileKey = 'none';
    this.profile = null;
    this.hazards = [];
    this.createHazards();
  }

  createHazards() {
    for (let index = 0; index < 7; index += 1) {
      const hazard = this.scene.add.container(0, 0).setDepth(15.2).setVisible(false);
      hazard.seed = index;
      hazard.laneIndex = 0;
      hazard.boundsWidth = 0;
      hazard.boundsHeight = 0;
      hazard.collisionArmed = false;
      this.hazards.push(hazard);
    }
  }

  update(delta) {
    this.syncProfile();
    if (!this.profile) {
      return;
    }

    const scrollDelta = (ROAD.scrollSpeed * delta) / 1000;
    for (const hazard of this.hazards) {
      hazard.y += scrollDelta;
      this.updateHazardCollisionState(hazard);
      if (hazard.y > GAME_HEIGHT + 100) {
        this.resetHazard(hazard, Phaser.Math.Between(-Math.round(GAME_HEIGHT * 1.45), -GAME_HEIGHT));
      }
    }
  }

  syncProfile() {
    const segment = this.missionState.currentSegment;
    if (!segment || segment.id === this.currentSegmentId) {
      return;
    }

    this.currentSegmentId = segment.id;
    this.profileKey = this.resolveProfileKey(segment);
    this.profile = PRESSURE_PROFILES[this.profileKey] ?? null;

    for (const hazard of this.hazards) {
      hazard.removeAll(true);
      hazard.setVisible(Boolean(this.profile));
      if (this.profile) {
        this.resetHazard(hazard, -GAME_HEIGHT - 40 - hazard.seed * this.profile.spacing);
      }
    }
  }

  resolveProfileKey(segment) {
    const tags = segment.tags ?? [];
    if (tags.includes('construction') || tags.includes('diversion')) {
      return 'construction';
    }
    if (tags.includes('tunnel') || tags.includes('compressed')) {
      return 'tunnel';
    }
    if (tags.includes('checkpoint') || tags.includes('fortified')) {
      return 'checkpoint';
    }
    if (tags.includes('bridge') || tags.includes('causeway')) {
      return 'bridge';
    }
    return 'none';
  }

  resetHazard(hazard, y) {
    if (!this.profile) {
      hazard.setVisible(false);
      return;
    }

    hazard.removeAll(true);
    const laneCenters = this.scene.roadSystem?.getLaneCenters() ?? [];
    const lane = this.chooseHazardLane(hazard);
    const x = laneCenters[lane] ?? laneCenters[0] ?? 0;
    hazard.laneIndex = lane;
    hazard.x = x;
    hazard.y = y;
    hazard.boundsWidth = this.profile.width;
    hazard.boundsHeight = this.profile.height;
    hazard.collisionArmed = false;
    hazard.setAlpha(0.62);
    hazard.setVisible(true);
    this.drawTelegraph(hazard);

    if (this.profileKey === 'construction') {
      this.drawConstructionHazard(hazard);
      return;
    }
    if (this.profileKey === 'tunnel') {
      this.drawTunnelHazard(hazard);
      return;
    }
    if (this.profileKey === 'bridge') {
      this.drawBridgeHazard(hazard);
      return;
    }
    this.drawCheckpointHazard(hazard);
  }

  updateHazardCollisionState(hazard) {
    if (!this.profile || !hazard.visible || hazard.collisionArmed) {
      return;
    }

    if (hazard.y < this.profile.activeTopY) {
      return;
    }

    if (!this.hazardCanArmWithoutTrappingPlayer(hazard)) {
      return;
    }

    hazard.collisionArmed = true;
    hazard.setAlpha(1);
  }

  chooseHazardLane(hazard) {
    const startIndex = (hazard.seed + Phaser.Math.Between(0, this.profile.lanes.length - 1)) % this.profile.lanes.length;
    for (let offset = 0; offset < this.profile.lanes.length; offset += 1) {
      const lane = this.profile.lanes[(startIndex + offset) % this.profile.lanes.length];
      if (this.laneChoiceKeepsEscape(lane, hazard)) {
        return lane;
      }
    }
    return this.profile.lanes[startIndex];
  }

  laneChoiceKeepsEscape(lane, hazard) {
    if (lane !== 1 && lane !== 2) {
      return true;
    }

    const opposingCenterLane = lane === 1 ? 2 : 1;
    return !this.hazards.some((candidate) => {
      return candidate !== hazard
        && candidate.visible
        && candidate.laneIndex === opposingCenterLane
        && candidate.y > -180
        && candidate.y < GAME_HEIGHT - 80;
    });
  }

  hazardCanArmWithoutTrappingPlayer(hazard) {
    const player = this.scene.player?.sprite;
    const laneCenters = this.scene.roadSystem?.getLaneCenters() ?? [];
    if (!player?.active || laneCenters.length === 0) {
      return true;
    }

    const playerLane = laneCenters.reduce((bestLane, x, lane) => (
      Math.abs(x - player.x) < Math.abs(laneCenters[bestLane] - player.x) ? lane : bestLane
    ), 0);
    if (playerLane !== hazard.laneIndex) {
      return true;
    }

    return Math.abs(hazard.y - player.y) >= 190;
  }

  drawTelegraph(hazard) {
    const laneCenters = this.scene.roadSystem?.getLaneCenters() ?? [];
    const nearestCenter = laneCenters[hazard.laneIndex] ?? hazard.x;
    const roadCenter = laneCenters.length > 0
      ? laneCenters.reduce((sum, x) => sum + x, 0) / laneCenters.length
      : hazard.x;
    const angle = nearestCenter < roadCenter ? 0 : 180;
    const key = hazard.laneIndex < 2 ? 'transition-lane-merge-arrow' : 'transition-lane-split-arrow';
    const lead = this.profileKey === 'bridge' ? -105 : -126;

    if (this.addImage(hazard, key, 30, 58, 0.28, angle, lead)) {
      return;
    }
    hazard.add(this.scene.add.triangle(0, lead, -10, lead + 12, 10, lead, -10, lead - 12, 0xf6e7a8, 0.24)
      .setAngle(angle));
  }

  drawConstructionHazard(hazard) {
    const angle = hazard.laneIndex < 2 ? -8 : 8;
    if (!this.addImage(hazard, 'transition-temporary-barrier-diagonal', 52, 68, this.profile.alpha, angle)) {
      hazard.add(this.scene.add.rectangle(0, 0, 44, 12, 0xd99735, 0.92).setAngle(angle));
      hazard.add(this.scene.add.rectangle(0, 0, 32, 3, 0x171411, 0.75).setAngle(angle));
    }
    this.addImage(hazard, 'prop-warning-lamp-post', 14, 42, 0.82, 0, -22);
  }

  drawTunnelHazard(hazard) {
    if (!this.addImage(hazard, 'transition-tunnel-lane-light-strip', 18, 118, this.profile.alpha)) {
      hazard.add(this.scene.add.rectangle(0, 0, 14, 118, 0x111617, 0.82).setStrokeStyle(1, 0x9ee7f5, 0.3));
    }
  }

  drawBridgeHazard(hazard) {
    if (!this.addImage(hazard, 'transition-bridge-edge-reflector-strip', 18, 130, this.profile.alpha)) {
      hazard.add(this.scene.add.rectangle(0, 0, 14, 130, 0x8fa5aa, 0.54));
    }
  }

  drawCheckpointHazard(hazard) {
    if (!this.addImage(hazard, 'asset-construction-barrier-warning', 54, 36, this.profile.alpha)) {
      hazard.add(this.scene.add.rectangle(0, 0, 50, 18, 0x5b3030, 0.88).setStrokeStyle(1, 0xe05c5c, 0.54));
    }
    hazard.add(this.scene.add.rectangle(0, 30, 4, 52, 0xb8a47a, 0.58));
  }

  addImage(hazard, key, width, height, alpha = 0.8, angle = 0, yOffset = 0) {
    if (!this.scene.textures.exists(key)) {
      return false;
    }

    hazard.add(this.scene.add.image(0, yOffset, key).setDisplaySize(width, height).setAlpha(alpha).setAngle(angle));
    return true;
  }

  getHazardRects() {
    if (!this.profile) {
      return [];
    }

    return this.hazards
      .filter((hazard) => hazard.visible
        && hazard.collisionArmed
        && hazard.y >= this.profile.activeTopY
        && hazard.y <= GAME_HEIGHT + 80)
      .map((hazard) => new Phaser.Geom.Rectangle(
        hazard.x - hazard.boundsWidth / 2,
        hazard.y - hazard.boundsHeight / 2,
        hazard.boundsWidth,
        hazard.boundsHeight,
      ));
  }

  isLaneBlockedForSpawn(laneX) {
    if (!this.profile) {
      return false;
    }

    const laneCenters = this.scene.roadSystem?.getLaneCenters() ?? [];
    if (laneCenters.length === 0) {
      return false;
    }

    const nearestLane = laneCenters.reduce((bestLane, x, lane) => (
      Math.abs(x - laneX) < Math.abs(laneCenters[bestLane] - laneX) ? lane : bestLane
    ), 0);
    if (this.profile.spawnBlockedLanes.includes(nearestLane)) {
      return true;
    }

    return this.hazards.some((hazard) => {
      return hazard.visible
        && hazard.laneIndex === nearestLane
        && hazard.y > -this.profile.dynamicSpawnLookaheadY
        && hazard.y < 210;
    });
  }

  getWarningLabel() {
    return this.profile?.warning ?? null;
  }
}
