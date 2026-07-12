import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, ROAD } from '../data/tuning.js';

const ENVIRONMENT_PROFILES = {
  domestic_interstate: {
    density: 16,
    colors: [0x2f4a39, 0x42544b, 0x6f8079, 0x8fa08e],
    kinds: ['forestBlock', 'utilityRun', 'smallTown', 'overpassTrace'],
  },
  watched_grid: {
    density: 14,
    colors: [0x3f4b50, 0x66707c, 0x8f3330, 0xbfc7c8],
    kinds: ['relayTower', 'surveyMast', 'cameraBridge', 'serviceRoad'],
  },
  support_corridor: {
    density: 15,
    colors: [0x4f7882, 0x8fcdda, 0x263d34, 0x9fb7bd],
    kinds: ['serviceBay', 'utilityRun', 'depotLight', 'smallTown'],
  },
  river_access: {
    density: 16,
    colors: [0x123847, 0x2f5f6d, 0x75c6d8, 0x627f83],
    kinds: ['canalTrace', 'dockCluster', 'floodPlain', 'bridgeFooting'],
  },
  fortified_border: {
    density: 17,
    colors: [0x3a2020, 0x776f64, 0xe05c5c, 0xb8a47a],
    kinds: ['fenceGrid', 'watchTower', 'radarDish', 'checkpointBlock'],
  },
  default: {
    density: 10,
    colors: [0x42544b, 0x6f8079, 0x8fa08e],
    kinds: ['forestBlock', 'utilityRun', 'serviceRoad'],
  },
};

export default class WorldEnvironmentSystem {
  constructor(scene, missionState, mission) {
    this.scene = scene;
    this.missionState = missionState;
    this.mission = mission;
    this.profileKey = mission?.environmentProfile ?? 'default';
    this.profile = ENVIRONMENT_PROFILES[this.profileKey] ?? ENVIRONMENT_PROFILES.default;
    this.elements = [];
    this.currentSegmentId = null;
    this.createElements();
  }

  createElements() {
    for (let index = 0; index < 18; index += 1) {
      const element = this.scene.add.container(0, 0).setDepth(0.7);
      element.seed = index;
      element.side = index % 2 === 0 ? -1 : 1;
      element.scrollScale = 0.72;
      this.elements.push(element);
      this.resetElement(element, Phaser.Math.Between(-120, GAME_HEIGHT + 120));
    }
  }

  update(delta) {
    this.syncSegment();
    const scrollDelta = (ROAD.scrollSpeed * delta) / 1000;
    for (const element of this.elements) {
      element.y += scrollDelta * element.scrollScale;
      if (element.y > GAME_HEIGHT + 170) {
        this.resetElement(element, Phaser.Math.Between(-280, -80));
      }
    }
  }

  syncSegment() {
    const segment = this.missionState.currentSegment;
    if (!segment || segment.id === this.currentSegmentId) {
      return;
    }

    this.currentSegmentId = segment.id;
    const segmentProfile = this.resolveSegmentOverride(segment);
    this.profile = segmentProfile ?? ENVIRONMENT_PROFILES[this.profileKey] ?? ENVIRONMENT_PROFILES.default;
    for (const element of this.elements) {
      this.resetElement(element, Phaser.Math.Between(-160, GAME_HEIGHT + 120));
    }
  }

  resolveSegmentOverride(segment) {
    const tags = segment.tags ?? [];
    if (tags.includes('water') || tags.includes('river') || tags.includes('dock') || tags.includes('flood-channel')) {
      return ENVIRONMENT_PROFILES.river_access;
    }
    if (tags.includes('checkpoint') || tags.includes('fortified')) {
      return ENVIRONMENT_PROFILES.fortified_border;
    }
    if (tags.includes('support-rich')) {
      return ENVIRONMENT_PROFILES.support_corridor;
    }
    if (tags.includes('watched')) {
      return ENVIRONMENT_PROFILES.watched_grid;
    }
    return null;
  }

  resetElement(element, y) {
    element.removeAll(true);
    element.y = y;
    element.side = element.seed % 2 === 0 ? -1 : 1;
    element.scrollScale = Phaser.Math.FloatBetween(0.62, 0.82);
    element.setVisible(element.seed < this.profile.density);

    if (!element.visible) {
      return;
    }

    const farEdge = element.side < 0 ? ROAD.left - 132 : ROAD.right + 132;
    element.x = Phaser.Math.Clamp(
      farEdge + Phaser.Math.Between(-60, 44) * element.side,
      14,
      GAME_WIDTH - 14,
    );

    const kind = this.profile.kinds[(element.seed + Phaser.Math.Between(0, this.profile.kinds.length - 1)) % this.profile.kinds.length];
    const color = this.profile.colors[element.seed % this.profile.colors.length];
    this.drawKind(element, kind, color);
  }

  drawKind(element, kind, color) {
    if (kind === 'forestBlock') {
      this.drawForestBlock(element, color);
      return;
    }
    if (kind === 'utilityRun') {
      this.drawUtilityRun(element, color);
      return;
    }
    if (kind === 'smallTown') {
      this.drawSmallTown(element, color);
      return;
    }
    if (kind === 'overpassTrace') {
      this.drawOverpassTrace(element, color);
      return;
    }
    if (kind === 'relayTower') {
      this.drawRelayTower(element, color);
      return;
    }
    if (kind === 'surveyMast') {
      this.drawSurveyMast(element, color);
      return;
    }
    if (kind === 'cameraBridge') {
      this.drawCameraBridge(element, color);
      return;
    }
    if (kind === 'serviceBay') {
      this.drawServiceBay(element, color);
      return;
    }
    if (kind === 'depotLight') {
      this.drawDepotLight(element, color);
      return;
    }
    if (kind === 'canalTrace') {
      this.drawCanalTrace(element, color);
      return;
    }
    if (kind === 'dockCluster') {
      this.drawDockCluster(element, color);
      return;
    }
    if (kind === 'floodPlain') {
      this.drawFloodPlain(element, color);
      return;
    }
    if (kind === 'bridgeFooting') {
      this.drawBridgeFooting(element, color);
      return;
    }
    if (kind === 'fenceGrid') {
      this.drawFenceGrid(element, color);
      return;
    }
    if (kind === 'watchTower') {
      this.drawWatchTower(element, color);
      return;
    }
    if (kind === 'radarDish') {
      this.drawRadarDish(element, color);
      return;
    }
    if (kind === 'checkpointBlock') {
      this.drawCheckpointBlock(element, color);
      return;
    }
    this.drawServiceRoad(element, color);
  }

  drawForestBlock(element, color) {
    for (let index = 0; index < 5; index += 1) {
      const x = Phaser.Math.Between(-30, 30);
      const y = Phaser.Math.Between(-38, 38);
      element.add(this.scene.add.triangle(x, y, x - 9, y + 13, x, y - 12, x + 9, y + 13, color, 0.35));
    }
  }

  drawUtilityRun(element, color) {
    element.add(this.scene.add.rectangle(0, 0, 4, 92, color, 0.42));
    element.add(this.scene.add.rectangle(element.side * -10, -30, 28, 3, 0x9da9a1, 0.22));
    element.add(this.scene.add.rectangle(element.side * -10, 28, 28, 3, 0x9da9a1, 0.18));
  }

  drawSmallTown(element, color) {
    for (let index = 0; index < 4; index += 1) {
      element.add(this.scene.add.rectangle(-18 + index * 13, -18 + (index % 2) * 24, 22, 16, color, 0.28).setStrokeStyle(1, 0x9da9a1, 0.1));
    }
  }

  drawOverpassTrace(element, color) {
    element.add(this.scene.add.rectangle(0, 0, 104, 18, 0x000000, 0.16).setAngle(element.side * -8));
    element.add(this.scene.add.rectangle(0, 0, 96, 4, color, 0.22).setAngle(element.side * -8));
  }

  drawRelayTower(element, color) {
    element.add(this.scene.add.rectangle(0, 8, 6, 92, color, 0.44));
    element.add(this.scene.add.triangle(0, -50, -24, 20, 24, 20, 0, -50, color, 0.18).setStrokeStyle(1, 0xbfc7c8, 0.14));
    element.add(this.scene.add.circle(0, -42, 8, 0x8f3330, 0.28));
  }

  drawSurveyMast(element, color) {
    element.add(this.scene.add.rectangle(0, 0, 4, 76, color, 0.46));
    element.add(this.scene.add.rectangle(0, -28, 42, 3, 0xbfc7c8, 0.2));
    element.add(this.scene.add.circle(element.side * -18, -28, 5, 0x8f3330, 0.26));
  }

  drawCameraBridge(element, color) {
    element.add(this.scene.add.rectangle(0, -8, 92, 6, color, 0.34));
    element.add(this.scene.add.rectangle(-36, 18, 5, 58, color, 0.3));
    element.add(this.scene.add.rectangle(36, 18, 5, 58, color, 0.3));
    element.add(this.scene.add.circle(element.side * 22, -8, 5, 0xe05c5c, 0.24));
  }

  drawServiceBay(element, color) {
    element.add(this.scene.add.rectangle(0, 0, 74, 58, 0x263d34, 0.38).setStrokeStyle(1, color, 0.2));
    element.add(this.scene.add.rectangle(0, -18, 52, 8, color, 0.18));
    element.add(this.scene.add.rectangle(element.side * -24, 18, 10, 24, 0x4eb6d6, 0.2));
  }

  drawDepotLight(element, color) {
    element.add(this.scene.add.rectangle(0, 8, 5, 74, color, 0.38));
    element.add(this.scene.add.circle(element.side * -8, -30, 8, 0x9ee7f5, 0.22));
    element.add(this.scene.add.rectangle(element.side * -22, -14, 58, 16, 0x9ee7f5, 0.05).setAngle(element.side * 8));
  }

  drawCanalTrace(element, color) {
    element.add(this.scene.add.rectangle(0, 0, 94, 120, 0x123847, 0.24).setStrokeStyle(1, color, 0.14));
    for (let index = 0; index < 4; index += 1) {
      element.add(this.scene.add.rectangle(-22 + index * 16, -44 + index * 28, 38, 2, 0x75c6d8, 0.14).setAngle(element.side * 12));
    }
  }

  drawDockCluster(element, color) {
    for (let index = 0; index < 4; index += 1) {
      element.add(this.scene.add.rectangle(-28 + index * 18, 0, 6, 72, color, 0.35));
    }
    element.add(this.scene.add.rectangle(0, -22, 82, 8, 0x627f83, 0.24));
  }

  drawFloodPlain(element, color) {
    element.add(this.scene.add.ellipse(0, 0, 100, 76, 0x123847, 0.14));
    element.add(this.scene.add.rectangle(0, -12, 88, 3, color, 0.14).setAngle(element.side * 9));
    element.add(this.scene.add.rectangle(0, 18, 62, 3, color, 0.1).setAngle(element.side * -11));
  }

  drawBridgeFooting(element, color) {
    element.add(this.scene.add.rectangle(-18, 0, 18, 80, color, 0.28));
    element.add(this.scene.add.rectangle(20, 0, 18, 80, color, 0.24));
    element.add(this.scene.add.rectangle(1, -38, 58, 8, 0x9ee7f5, 0.12));
  }

  drawFenceGrid(element, color) {
    for (let index = 0; index < 5; index += 1) {
      element.add(this.scene.add.rectangle(-40 + index * 20, 0, 4, 88, color, 0.3));
    }
    element.add(this.scene.add.rectangle(0, -26, 92, 3, 0xb8a47a, 0.22));
    element.add(this.scene.add.rectangle(0, 12, 92, 3, 0xb8a47a, 0.18));
  }

  drawWatchTower(element, color) {
    element.add(this.scene.add.rectangle(0, 10, 8, 86, color, 0.38));
    element.add(this.scene.add.rectangle(0, -42, 38, 22, 0x776f64, 0.42).setStrokeStyle(1, 0xe05c5c, 0.2));
    element.add(this.scene.add.circle(element.side * -12, -42, 6, 0xe05c5c, 0.24));
  }

  drawRadarDish(element, color) {
    element.add(this.scene.add.rectangle(0, 18, 5, 64, color, 0.36));
    element.add(this.scene.add.arc(0, -18, 25, 210, 330, false, 0xb8a47a, 0.26));
    element.add(this.scene.add.rectangle(0, -18, 28, 3, 0xe05c5c, 0.16).setAngle(element.side * 18));
  }

  drawCheckpointBlock(element, color) {
    element.add(this.scene.add.rectangle(0, 0, 82, 70, 0x3a2020, 0.34).setStrokeStyle(1, color, 0.18));
    element.add(this.scene.add.rectangle(0, -22, 62, 8, 0xe05c5c, 0.14));
    element.add(this.scene.add.rectangle(element.side * -28, 14, 10, 40, 0xb8a47a, 0.2));
  }

  drawServiceRoad(element, color) {
    element.add(this.scene.add.rectangle(0, 0, 58, 126, 0x202426, 0.22).setStrokeStyle(1, color, 0.1));
    element.add(this.scene.add.rectangle(0, 0, 3, 116, 0xd9dfd3, 0.08));
  }
}
