import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, ROAD } from '../data/tuning.js';

export default class OverheadInfrastructureSystem {
  constructor(scene, missionState) {
    this.scene = scene;
    this.missionState = missionState;
    this.currentSegmentId = null;
    this.elements = [];
    this.createElements();
  }

  createElements() {
    for (let index = 0; index < 7; index += 1) {
      const element = this.scene.add.container(GAME_WIDTH / 2, -120).setDepth(18);
      element.seed = index;
      this.elements.push(element);
    }
  }

  update(delta) {
    this.syncSegment();
    const scrollDelta = (ROAD.scrollSpeed * delta) / 1000;
    for (const element of this.elements) {
      element.y += scrollDelta * element.scrollScale;
      if (element.y > GAME_HEIGHT + 130) {
        this.resetElement(element, Phaser.Math.Between(-420, -80));
      }
    }
  }

  syncSegment() {
    const segment = this.missionState.currentSegment;
    if (!segment || segment.id === this.currentSegmentId) {
      return;
    }

    this.currentSegmentId = segment.id;
    for (const element of this.elements) {
      this.resetElement(element, Phaser.Math.Between(-160, GAME_HEIGHT + 160));
    }
  }

  resetElement(element, y) {
    const segment = this.missionState.currentSegment;
    const family = this.resolveFamily(segment);
    element.removeAll(true);
    element.x = GAME_WIDTH / 2;
    element.y = y;
    element.scrollScale = Phaser.Math.FloatBetween(0.98, 1.03);
    element.setVisible(family !== 'none' && this.shouldShowElement(family, element.seed));

    if (!element.visible) {
      return;
    }

    if (family === 'bridge') {
      this.drawBridgeShadow(element);
      return;
    }

    if (family === 'industrial') {
      this.drawPipeGantry(element);
      return;
    }

    if (family === 'checkpoint') {
      this.drawCheckpointFloodlights(element);
      return;
    }

    if (family === 'tunnel') {
      this.drawTunnelBands(element);
      return;
    }

    if (family === 'construction') {
      this.drawConstructionSpan(element);
      return;
    }

    if (family === 'interchange') {
      this.drawInterchangeSpan(element);
      return;
    }

    this.drawSignGantry(element);
  }

  resolveFamily(segment) {
    const tags = segment?.tags ?? [];
    if (tags.includes('interchange') || tags.includes('overpass')) {
      return 'interchange';
    }
    if (tags.includes('bridge') || tags.includes('water') || tags.includes('river') || tags.includes('dock') || tags.includes('flood-channel')) {
      return 'bridge';
    }
    if (tags.includes('checkpoint') || tags.includes('fortified') || segment?.id?.includes('fort')) {
      return 'checkpoint';
    }
    if (tags.includes('industrial') || tags.includes('freight') || segment?.surfaceProfile?.accent === 'industrial_grime') {
      return 'industrial';
    }
    if (tags.includes('construction') || tags.includes('diversion')) {
      return 'construction';
    }
    if (tags.includes('tunnel') || segment?.id?.includes('tunnel')) {
      return 'tunnel';
    }
    if (tags.includes('interstate') || tags.includes('divided') || tags.includes('civilian-heavy')) {
      return 'gantry';
    }
    return 'none';
  }

  shouldShowElement(family, seed) {
    const wideBonus = GAME_WIDTH > 900 ? 1 : 0;
    if (family === 'gantry') {
      return seed < 3 + wideBonus;
    }
    if (family === 'bridge' || family === 'industrial' || family === 'construction' || family === 'interchange') {
      return seed < 4 + wideBonus;
    }
    return seed < 5 + wideBonus;
  }

  drawSignGantry(element) {
    const width = ROAD.right - ROAD.left + 54;
    element.add(this.scene.add.rectangle(0, 0, width, 4, 0x9da9a1, 0.54));
    element.add(this.scene.add.rectangle(-width / 2 + 14, 18, 5, 42, 0x7d8c86, 0.48));
    element.add(this.scene.add.rectangle(width / 2 - 14, 18, 5, 42, 0x7d8c86, 0.48));
    element.add(this.scene.add.rectangle(-54, -10, 62, 18, 0x1c3b43, 0.68).setStrokeStyle(1, 0x9ee7f5, 0.22));
    element.add(this.scene.add.rectangle(44, -10, 74, 18, 0x1c3b43, 0.68).setStrokeStyle(1, 0x9ee7f5, 0.22));
  }

  drawConstructionSpan(element) {
    const width = ROAD.right - ROAD.left + 40;
    element.add(this.scene.add.rectangle(0, 0, width, 5, 0xd99735, 0.42));
    element.add(this.scene.add.rectangle(-width / 2 + 24, 20, 7, 40, 0x6e675b, 0.48));
    element.add(this.scene.add.rectangle(width / 2 - 24, 20, 7, 40, 0x6e675b, 0.48));
    element.add(this.scene.add.rectangle(0, -12, 96, 18, 0x2d2c2a, 0.74).setStrokeStyle(1, 0xe0c166, 0.42));
    element.add(this.scene.add.text(0, -12, 'MERGE', {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '10px',
      color: '#e0c166',
    }).setOrigin(0.5));
  }

  drawInterchangeSpan(element) {
    const width = GAME_WIDTH + 80;
    element.add(this.scene.add.rectangle(0, 0, width, 34, 0x05090a, 0.28).setAngle(element.seed % 2 === 0 ? -10 : 10));
    element.add(this.scene.add.rectangle(0, 0, width - 70, 8, 0x8b9992, 0.34).setAngle(element.seed % 2 === 0 ? -10 : 10));
    element.add(this.scene.add.rectangle(-142, 24, 16, 66, 0x566168, 0.26));
    element.add(this.scene.add.rectangle(142, 24, 16, 66, 0x566168, 0.26));
    if (element.seed % 2 === 0) {
      element.add(this.scene.add.rectangle(-44, -18, 66, 16, 0x1c3b43, 0.58).setStrokeStyle(1, 0xd9dfd3, 0.18));
      element.add(this.scene.add.rectangle(48, -18, 74, 16, 0x304b27, 0.54).setStrokeStyle(1, 0xd9dfd3, 0.16));
    }
  }

  drawBridgeShadow(element) {
    element.add(this.scene.add.rectangle(0, 0, GAME_WIDTH, 46, 0x020506, 0.32));
    const pylonOffset = Math.min(GAME_WIDTH * 0.32, ROAD.right - ROAD.left + 80);
    element.add(this.scene.add.rectangle(-pylonOffset, -28, 14, 76, 0xb7c4bd, 0.18));
    element.add(this.scene.add.rectangle(pylonOffset, -28, 14, 76, 0xb7c4bd, 0.18));
    element.add(this.scene.add.rectangle(0, -30, ROAD.right - ROAD.left + 46, 3, 0x9ee7f5, 0.16));
  }

  drawPipeGantry(element) {
    const width = ROAD.right - ROAD.left + 92;
    element.add(this.scene.add.rectangle(0, 0, width, 7, 0x7d7465, 0.42));
    element.add(this.scene.add.rectangle(0, -12, width - 20, 3, 0x9b6a45, 0.38));
    element.add(this.scene.add.rectangle(-width / 2 + 26, 20, 10, 52, 0x5d5a52, 0.48));
    element.add(this.scene.add.rectangle(width / 2 - 26, 20, 10, 52, 0x5d5a52, 0.48));
  }

  drawCheckpointFloodlights(element) {
    const width = ROAD.right - ROAD.left + 68;
    element.add(this.scene.add.rectangle(0, 0, width, 5, 0xa6a99d, 0.46));
    element.add(this.scene.add.circle(-width / 2 + 48, -8, 10, 0xf6e7a8, 0.16));
    element.add(this.scene.add.circle(width / 2 - 48, -8, 10, 0xf6e7a8, 0.16));
    element.add(this.scene.add.rectangle(0, 18, width, 28, 0x000000, 0.12));
  }

  drawTunnelBands(element) {
    element.add(this.scene.add.rectangle(0, 0, ROAD.right - ROAD.left + 44, 34, 0x05080a, 0.42));
    element.add(this.scene.add.rectangle(-ROAD.right / 2 + 34, 0, 6, 44, 0x9ee7f5, 0.22));
    element.add(this.scene.add.rectangle(ROAD.right / 2 - 34, 0, 6, 44, 0x9ee7f5, 0.22));
  }
}
