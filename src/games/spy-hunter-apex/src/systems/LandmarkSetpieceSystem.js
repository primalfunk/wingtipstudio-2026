import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, ROAD } from '../data/tuning.js';

const LANDMARK_PROFILES = {
  industrial: {
    density: 7,
    kinds: ['tankFarm', 'pipeRack', 'freightStacks', 'craneSilhouette'],
  },
  bridge: {
    density: 8,
    kinds: ['bridgePylon', 'cableSpan', 'supportColumns', 'waterEdge'],
  },
  tunnel: {
    density: 9,
    kinds: ['tunnelWall', 'ventCluster', 'emergencyBay', 'lightBank'],
  },
  flood: {
    density: 8,
    kinds: ['channelWall', 'spillwayGate', 'floodBarrier', 'waterControl'],
  },
  checkpoint: {
    density: 8,
    kinds: ['inspectionBooth', 'scannerFrame', 'fenceRun', 'floodlightTower'],
  },
  construction: {
    density: 7,
    kinds: ['workCrane', 'equipmentYard', 'barrierDepot', 'arrowTrailer'],
  },
  divided: {
    density: 6,
    kinds: ['interstateSign', 'medianUtility', 'overpassStub', 'serviceRoad'],
  },
  interchange: {
    density: 8,
    kinds: ['rampLoop', 'overpassColumn', 'signageStack', 'elevatedRamp'],
  },
  none: {
    density: 0,
    kinds: [],
  },
};

export default class LandmarkSetpieceSystem {
  constructor(scene, missionState) {
    this.scene = scene;
    this.missionState = missionState;
    this.currentSegmentId = null;
    this.profile = LANDMARK_PROFILES.none;
    this.landmarks = [];
    this.createLandmarks();
  }

  createLandmarks() {
    for (let index = 0; index < 10; index += 1) {
      const landmark = this.scene.add.container(0, 0).setDepth(1.7);
      landmark.seed = index;
      landmark.side = index % 2 === 0 ? -1 : 1;
      landmark.scrollScale = 1;
      this.landmarks.push(landmark);
    }
  }

  update(delta) {
    this.syncProfile();
    const scrollDelta = (ROAD.scrollSpeed * delta) / 1000;
    for (const landmark of this.landmarks) {
      landmark.y += scrollDelta * landmark.scrollScale;
      if (landmark.y > GAME_HEIGHT + 170) {
        this.resetLandmark(landmark, Phaser.Math.Between(-360, -120));
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
    for (const landmark of this.landmarks) {
      this.resetLandmark(landmark, Phaser.Math.Between(-160, GAME_HEIGHT + 120));
    }
  }

  resolveProfile(segment) {
    const tags = segment.tags ?? [];
    if (tags.includes('industrial') || tags.includes('freight')) {
      return LANDMARK_PROFILES.industrial;
    }
    if (tags.includes('bridge') || tags.includes('causeway')) {
      return LANDMARK_PROFILES.bridge;
    }
    if (tags.includes('tunnel')) {
      return LANDMARK_PROFILES.tunnel;
    }
    if (tags.includes('flood-channel') || tags.includes('waterway')) {
      return LANDMARK_PROFILES.flood;
    }
    if (tags.includes('checkpoint') || tags.includes('fortified')) {
      return LANDMARK_PROFILES.checkpoint;
    }
    if (tags.includes('construction') || tags.includes('diversion')) {
      return LANDMARK_PROFILES.construction;
    }
    if (tags.includes('interchange') || tags.includes('overpass')) {
      return LANDMARK_PROFILES.interchange;
    }
    if (tags.includes('divided') || tags.includes('divided-exit')) {
      return LANDMARK_PROFILES.divided;
    }
    return LANDMARK_PROFILES.none;
  }

  resetLandmark(landmark, y) {
    landmark.removeAll(true);
    landmark.y = y;
    landmark.side = landmark.seed % 2 === 0 ? -1 : 1;
    landmark.scrollScale = Phaser.Math.FloatBetween(0.88, 0.98);
    landmark.setVisible(landmark.seed < this.profile.density);

    if (!landmark.visible || this.profile.kinds.length === 0) {
      return;
    }

    const sideOffset = landmark.side < 0 ? ROAD.left - 88 : ROAD.right + 88;
    landmark.x = Phaser.Math.Clamp(
      sideOffset + Phaser.Math.Between(-18, 28) * landmark.side,
      34,
      GAME_WIDTH - 34,
    );

    const kind = this.profile.kinds[(landmark.seed + Phaser.Math.Between(0, this.profile.kinds.length - 1)) % this.profile.kinds.length];
    this.drawKind(landmark, kind);
  }

  drawKind(landmark, kind) {
    if (kind === 'tankFarm') {
      this.drawTankFarm(landmark);
      return;
    }
    if (kind === 'pipeRack') {
      this.drawPipeRack(landmark);
      return;
    }
    if (kind === 'freightStacks') {
      this.drawFreightStacks(landmark);
      return;
    }
    if (kind === 'craneSilhouette') {
      this.drawCraneSilhouette(landmark);
      return;
    }
    if (kind === 'bridgePylon') {
      this.drawBridgePylon(landmark);
      return;
    }
    if (kind === 'cableSpan') {
      this.drawCableSpan(landmark);
      return;
    }
    if (kind === 'supportColumns') {
      this.drawSupportColumns(landmark);
      return;
    }
    if (kind === 'waterEdge') {
      this.drawWaterEdge(landmark);
      return;
    }
    if (kind === 'tunnelWall') {
      this.drawTunnelWall(landmark);
      return;
    }
    if (kind === 'ventCluster') {
      this.drawVentCluster(landmark);
      return;
    }
    if (kind === 'emergencyBay') {
      this.drawEmergencyBay(landmark);
      return;
    }
    if (kind === 'lightBank') {
      this.drawLightBank(landmark);
      return;
    }
    if (kind === 'channelWall') {
      this.drawChannelWall(landmark);
      return;
    }
    if (kind === 'spillwayGate') {
      this.drawSpillwayGate(landmark);
      return;
    }
    if (kind === 'floodBarrier') {
      this.drawFloodBarrier(landmark);
      return;
    }
    if (kind === 'waterControl') {
      this.drawWaterControl(landmark);
      return;
    }
    if (kind === 'inspectionBooth') {
      this.drawInspectionBooth(landmark);
      return;
    }
    if (kind === 'scannerFrame') {
      this.drawScannerFrame(landmark);
      return;
    }
    if (kind === 'fenceRun') {
      this.drawFenceRun(landmark);
      return;
    }
    if (kind === 'floodlightTower') {
      this.drawFloodlightTower(landmark);
      return;
    }
    if (kind === 'workCrane') {
      this.drawWorkCrane(landmark);
      return;
    }
    if (kind === 'equipmentYard') {
      this.drawEquipmentYard(landmark);
      return;
    }
    if (kind === 'barrierDepot') {
      this.drawBarrierDepot(landmark);
      return;
    }
    if (kind === 'arrowTrailer') {
      this.drawArrowTrailer(landmark);
      return;
    }
    if (kind === 'interstateSign') {
      this.drawInterstateSign(landmark);
      return;
    }
    if (kind === 'medianUtility') {
      this.drawMedianUtility(landmark);
      return;
    }
    if (kind === 'overpassStub') {
      this.drawOverpassStub(landmark);
      return;
    }
    if (kind === 'rampLoop') {
      this.drawRampLoop(landmark);
      return;
    }
    if (kind === 'overpassColumn') {
      this.drawOverpassColumn(landmark);
      return;
    }
    if (kind === 'signageStack') {
      this.drawSignageStack(landmark);
      return;
    }
    if (kind === 'elevatedRamp') {
      this.drawElevatedRamp(landmark);
      return;
    }
    this.drawServiceRoad(landmark);
  }

  addShadow(landmark, width, height, alpha = 0.24) {
    const shadow = this.scene.add.ellipse(0, height * 0.36, width, Math.max(16, height * 0.28), 0x000000, alpha);
    landmark.add(shadow);
    landmark.sendToBack(shadow);
  }

  addAssetImage(landmark, key, width, height, alpha = 1) {
    if (!this.scene.textures.exists(key)) {
      return false;
    }

    const image = this.scene.add.image(0, 0, key)
      .setDisplaySize(width, height)
      .setAlpha(alpha);
    landmark.add(image);
    return true;
  }

  drawTankFarm(landmark) {
    if (this.addAssetImage(landmark, 'asset-refinery-tank-cluster', 118, 55, 0.88)) {
      this.addShadow(landmark, 112, 58, 0.12);
      return;
    }
    this.addShadow(landmark, 96, 92);
    [-26, 20].forEach((x, index) => {
      landmark.add(this.scene.add.ellipse(x, 4 + index * 8, 42, 62, 0x514c43, 0.78).setStrokeStyle(2, 0xa26a38, 0.4));
      landmark.add(this.scene.add.ellipse(x, -26 + index * 8, 42, 14, 0x8b6a48, 0.36));
      landmark.add(this.scene.add.rectangle(x, 4 + index * 8, 34, 3, 0xc78b46, 0.16));
    });
  }

  drawPipeRack(landmark) {
    if (this.addAssetImage(landmark, 'asset-pipe-gantry', 128, 49, 0.9)) {
      this.addShadow(landmark, 128, 52, 0.12);
      return;
    }
    this.addShadow(landmark, 116, 52, 0.18);
    for (let index = 0; index < 4; index += 1) {
      landmark.add(this.scene.add.rectangle(0, -18 + index * 12, 96, 5, 0x8b6a48, 0.7).setAngle(landmark.side * -6));
    }
    [-42, 0, 42].forEach((x) => {
      landmark.add(this.scene.add.rectangle(x, 0, 4, 54, 0x5d5a52, 0.58));
    });
  }

  drawFreightStacks(landmark) {
    this.addShadow(landmark, 112, 82);
    const colors = [0x5d5a52, 0x8b6a48, 0x3f4b50];
    for (let index = 0; index < 5; index += 1) {
      const x = -42 + (index % 2) * 45;
      const y = -34 + index * 16;
      landmark.add(this.scene.add.rectangle(x, y, 58, 14, colors[index % colors.length], 0.78).setStrokeStyle(1, 0xc78b46, 0.16));
    }
  }

  drawCraneSilhouette(landmark) {
    this.addShadow(landmark, 92, 106, 0.16);
    landmark.add(this.scene.add.rectangle(0, 18, 8, 96, 0x5d5a52, 0.64));
    landmark.add(this.scene.add.rectangle(landmark.side * -25, -32, 72, 5, 0x8b6a48, 0.7).setAngle(landmark.side * 14));
    landmark.add(this.scene.add.rectangle(landmark.side * -55, -14, 4, 36, 0xc78b46, 0.46));
  }

  drawBridgePylon(landmark) {
    if (this.addAssetImage(landmark, landmark.side < 0 ? 'asset-bridge-pylon-left' : 'asset-bridge-pylon-right', 44, 76, 0.88)) {
      this.addShadow(landmark, 58, 88, 0.13);
      return;
    }
    this.addShadow(landmark, 82, 100, 0.2);
    landmark.add(this.scene.add.rectangle(0, 0, 42, 98, 0x566168, 0.72).setStrokeStyle(2, 0x9ee7f5, 0.2));
    landmark.add(this.scene.add.rectangle(0, -26, 58, 8, 0x8fa5aa, 0.42));
    landmark.add(this.scene.add.rectangle(0, 26, 58, 8, 0x8fa5aa, 0.3));
  }

  drawCableSpan(landmark) {
    this.addShadow(landmark, 120, 42, 0.14);
    for (let index = 0; index < 4; index += 1) {
      landmark.add(this.scene.add.rectangle(landmark.side * (-14 + index * 14), -10 + index * 12, 4, 70, 0x9ee7f5, 0.22).setAngle(landmark.side * 18));
    }
    landmark.add(this.scene.add.rectangle(0, 2, 106, 4, 0x8fa5aa, 0.38));
  }

  drawSupportColumns(landmark) {
    this.addShadow(landmark, 96, 86, 0.18);
    [-28, 0, 28].forEach((x) => {
      landmark.add(this.scene.add.rectangle(x, 0, 16, 78, 0x566168, 0.62));
      landmark.add(this.scene.add.ellipse(x, -38, 16, 8, 0x8fa5aa, 0.36));
    });
  }

  drawWaterEdge(landmark) {
    landmark.add(this.scene.add.rectangle(0, 0, 110, 72, 0x123847, 0.24));
    for (let index = 0; index < 4; index += 1) {
      landmark.add(this.scene.add.rectangle(-38 + index * 26, -24 + index * 15, 36, 2, 0x9ee7f5, 0.18).setAngle(landmark.side * 10));
    }
  }

  drawTunnelWall(landmark) {
    if (this.addAssetImage(landmark, 'asset-tunnel-road-wall', 96, 61, 0.88)) {
      this.addShadow(landmark, 96, 70, 0.16);
      return;
    }
    this.addShadow(landmark, 88, 122, 0.28);
    landmark.add(this.scene.add.rectangle(0, 0, 58, 128, 0x111617, 0.86).setStrokeStyle(2, 0x566168, 0.48));
    landmark.add(this.scene.add.rectangle(landmark.side * -16, 0, 6, 118, 0x9ee7f5, 0.14));
  }

  drawVentCluster(landmark) {
    this.addShadow(landmark, 84, 78, 0.2);
    landmark.add(this.scene.add.rectangle(0, 0, 66, 58, 0x202426, 0.8).setStrokeStyle(1, 0x566168, 0.44));
    for (let index = 0; index < 5; index += 1) {
      landmark.add(this.scene.add.rectangle(-20 + index * 10, 0, 4, 44, 0x9ee7f5, 0.14));
    }
  }

  drawEmergencyBay(landmark) {
    this.addShadow(landmark, 84, 84, 0.18);
    landmark.add(this.scene.add.rectangle(0, 0, 62, 70, 0x303638, 0.6).setStrokeStyle(1, 0x9ee7f5, 0.22));
    landmark.add(this.scene.add.rectangle(0, -26, 34, 6, 0xe05c5c, 0.36));
  }

  drawLightBank(landmark) {
    for (let index = 0; index < 6; index += 1) {
      landmark.add(this.scene.add.rectangle(0, -42 + index * 16, 8, 5, 0x9ee7f5, 0.26));
      landmark.add(this.scene.add.rectangle(0, -42 + index * 16, 38, 1, 0x9ee7f5, 0.1));
    }
  }

  drawChannelWall(landmark) {
    if (this.addAssetImage(landmark, 'asset-flood-channel-wall', 112, 50, 0.88)) {
      this.addShadow(landmark, 112, 52, 0.12);
      return;
    }
    landmark.add(this.scene.add.rectangle(0, 0, 52, 134, 0x627f83, 0.46).setStrokeStyle(1, 0x9ee7f5, 0.14));
    for (let index = 0; index < 5; index += 1) {
      landmark.add(this.scene.add.rectangle(0, -52 + index * 26, 48, 2, 0x75c6d8, 0.16));
    }
  }

  drawSpillwayGate(landmark) {
    if (this.addAssetImage(landmark, 'asset-spillway-gate', 112, 59, 0.9)) {
      this.addShadow(landmark, 112, 62, 0.14);
      return;
    }
    this.addShadow(landmark, 100, 74, 0.16);
    landmark.add(this.scene.add.rectangle(0, 0, 92, 50, 0x2f5f6d, 0.64).setStrokeStyle(2, 0x75c6d8, 0.2));
    [-28, 0, 28].forEach((x) => {
      landmark.add(this.scene.add.rectangle(x, 0, 6, 56, 0x9ee7f5, 0.18));
    });
  }

  drawFloodBarrier(landmark) {
    this.addShadow(landmark, 96, 48, 0.14);
    landmark.add(this.scene.add.rectangle(0, 0, 86, 16, 0x627f83, 0.68).setAngle(landmark.side * 7));
    landmark.add(this.scene.add.rectangle(0, 0, 74, 3, 0x75c6d8, 0.22).setAngle(landmark.side * 7));
  }

  drawWaterControl(landmark) {
    this.addShadow(landmark, 92, 86, 0.18);
    landmark.add(this.scene.add.rectangle(0, 0, 62, 72, 0x244a54, 0.64).setStrokeStyle(1, 0x75c6d8, 0.24));
    landmark.add(this.scene.add.circle(0, -14, 17, 0x75c6d8, 0.14));
    landmark.add(this.scene.add.rectangle(0, 18, 46, 5, 0x9ee7f5, 0.18));
  }

  drawInspectionBooth(landmark) {
    if (this.addAssetImage(landmark, 'asset-checkpoint-booth', 92, 50, 0.9)) {
      this.addShadow(landmark, 90, 56, 0.14);
      return;
    }
    this.addShadow(landmark, 82, 92, 0.22);
    landmark.add(this.scene.add.rectangle(0, 0, 52, 74, 0x3a3030, 0.82).setStrokeStyle(2, 0xe05c5c, 0.28));
    landmark.add(this.scene.add.rectangle(0, -16, 38, 14, 0xb8a47a, 0.34));
    landmark.add(this.scene.add.circle(landmark.side * -18, -36, 6, 0xe05c5c, 0.38));
  }

  drawScannerFrame(landmark) {
    if (this.addAssetImage(landmark, 'asset-scanner-gantry', 94, 56, 0.9)) {
      this.addShadow(landmark, 96, 62, 0.14);
      return;
    }
    this.addShadow(landmark, 108, 78, 0.18);
    landmark.add(this.scene.add.rectangle(0, 0, 86, 10, 0x776f64, 0.66));
    landmark.add(this.scene.add.rectangle(-42, 18, 8, 62, 0x776f64, 0.62));
    landmark.add(this.scene.add.rectangle(42, 18, 8, 62, 0x776f64, 0.62));
    landmark.add(this.scene.add.rectangle(0, 16, 64, 2, 0xe05c5c, 0.26));
  }

  drawFenceRun(landmark) {
    for (let index = 0; index < 5; index += 1) {
      landmark.add(this.scene.add.rectangle(-40 + index * 20, 0, 4, 64, 0xb8a47a, 0.42));
    }
    landmark.add(this.scene.add.rectangle(0, -14, 92, 3, 0xb8a47a, 0.36));
    landmark.add(this.scene.add.rectangle(0, 16, 92, 3, 0xb8a47a, 0.32));
  }

  drawFloodlightTower(landmark) {
    this.addShadow(landmark, 64, 98, 0.16);
    landmark.add(this.scene.add.rectangle(0, 12, 6, 92, 0x776f64, 0.68));
    landmark.add(this.scene.add.circle(landmark.side * -6, -38, 8, 0xf6e7a8, 0.34));
    landmark.add(this.scene.add.rectangle(landmark.side * -18, -18, 54, 18, 0xf6e7a8, 0.08).setAngle(landmark.side * 13));
  }

  drawWorkCrane(landmark) {
    this.addShadow(landmark, 92, 96, 0.16);
    landmark.add(this.scene.add.rectangle(0, 12, 7, 88, 0xd99735, 0.68));
    landmark.add(this.scene.add.rectangle(landmark.side * -24, -30, 76, 5, 0xe0c166, 0.54).setAngle(landmark.side * 12));
    landmark.add(this.scene.add.rectangle(landmark.side * -56, -6, 4, 34, 0xe0c166, 0.38));
  }

  drawEquipmentYard(landmark) {
    this.addShadow(landmark, 112, 82, 0.18);
    landmark.add(this.scene.add.rectangle(-22, -14, 54, 28, 0x6e675b, 0.68).setStrokeStyle(1, 0xd99735, 0.22));
    landmark.add(this.scene.add.rectangle(28, 18, 46, 22, 0x8b6a48, 0.62).setStrokeStyle(1, 0xe0c166, 0.18));
    landmark.add(this.scene.add.circle(-44, 6, 8, 0x181713, 0.8));
    landmark.add(this.scene.add.circle(10, 6, 8, 0x181713, 0.8));
  }

  drawBarrierDepot(landmark) {
    if (this.addAssetImage(landmark, 'asset-construction-barrier-warning', 58, 34, 0.94)) {
      this.addShadow(landmark, 64, 36, 0.1);
      return;
    }
    this.addShadow(landmark, 100, 56, 0.16);
    for (let index = 0; index < 4; index += 1) {
      landmark.add(this.scene.add.rectangle(-27 + index * 18, -18 + index * 10, 46, 8, 0xd99735, 0.7).setAngle(landmark.side * 12));
      landmark.add(this.scene.add.rectangle(-27 + index * 18, -18 + index * 10, 34, 2, 0x181713, 0.45).setAngle(landmark.side * 12));
    }
  }

  drawArrowTrailer(landmark) {
    this.addShadow(landmark, 94, 62, 0.16);
    landmark.add(this.scene.add.rectangle(0, 14, 62, 28, 0x6e675b, 0.68).setStrokeStyle(1, 0xe0c166, 0.24));
    landmark.add(this.scene.add.triangle(0, -16, -18, 0, 18, 0, -18, -32, 0xd99735, 0.58).setAngle(landmark.side < 0 ? 0 : 180));
  }

  drawInterstateSign(landmark) {
    if (this.addAssetImage(landmark, 'asset-highway-sign-gantry', 116, 40, 0.86)) {
      this.addShadow(landmark, 118, 44, 0.1);
      return;
    }
    this.addShadow(landmark, 72, 82, 0.14);
    landmark.add(this.scene.add.rectangle(0, 20, 5, 68, 0x8b9992, 0.62));
    landmark.add(this.scene.add.rectangle(0, -22, 58, 28, 0x304b27, 0.76).setStrokeStyle(1, 0xd9dfd3, 0.34));
    landmark.add(this.scene.add.rectangle(0, -22, 40, 4, 0xd9dfd3, 0.2));
  }

  drawMedianUtility(landmark) {
    if (this.addAssetImage(landmark, 'asset-median-guardrail-strip', 112, 25, 0.88)) {
      this.addShadow(landmark, 112, 30, 0.08);
      return;
    }
    this.addShadow(landmark, 82, 72, 0.14);
    landmark.add(this.scene.add.rectangle(0, 0, 32, 58, 0x263d34, 0.62).setStrokeStyle(1, 0x4eb6d6, 0.18));
    landmark.add(this.scene.add.rectangle(0, -8, 20, 5, 0x4eb6d6, 0.22));
    landmark.add(this.scene.add.rectangle(0, 13, 24, 3, 0x9fb7bd, 0.18));
  }

  drawOverpassStub(landmark) {
    if (this.addAssetImage(landmark, 'asset-overpass-span', 124, 84, 0.78)) {
      this.addShadow(landmark, 124, 88, 0.12);
      return;
    }
    landmark.add(this.scene.add.rectangle(0, 0, 118, 34, 0x111315, 0.34).setAngle(landmark.side * -4));
    landmark.add(this.scene.add.rectangle(0, 0, 110, 8, 0x8b9992, 0.28).setAngle(landmark.side * -4));
    [-38, 38].forEach((x) => {
      landmark.add(this.scene.add.rectangle(x, 28, 13, 52, 0x566168, 0.42));
    });
  }

  drawRampLoop(landmark) {
    if (this.addAssetImage(landmark, 'asset-cloverleaf-ramp-loop', 112, 95, 0.82)) {
      this.addShadow(landmark, 118, 100, 0.12);
      return;
    }
    this.addShadow(landmark, 132, 132, 0.18);
    landmark.add(this.scene.add.arc(0, 0, 48, 20, 318, false, 0x2f3435, 0.52));
    landmark.add(this.scene.add.arc(0, 0, 34, 20, 318, false, 0x111a1a, 0.58));
    landmark.add(this.scene.add.rectangle(landmark.side * -28, 46, 56, 8, 0xb8c7bd, 0.2).setAngle(landmark.side * -28));
    landmark.add(this.scene.add.rectangle(landmark.side * 34, -42, 46, 5, 0xd9dfd3, 0.12).setAngle(landmark.side * 16));
  }

  drawOverpassColumn(landmark) {
    this.addShadow(landmark, 96, 112, 0.22);
    [-26, 26].forEach((x) => {
      landmark.add(this.scene.add.rectangle(x, 0, 18, 106, 0x566168, 0.54));
      landmark.add(this.scene.add.ellipse(x, -52, 18, 8, 0xb8c7bd, 0.2));
      landmark.add(this.scene.add.ellipse(x, 52, 18, 8, 0x000000, 0.22));
    });
    landmark.add(this.scene.add.rectangle(0, -34, 104, 7, 0x8b9992, 0.26).setAngle(landmark.side * -8));
  }

  drawSignageStack(landmark) {
    this.addShadow(landmark, 92, 92, 0.14);
    landmark.add(this.scene.add.rectangle(0, 18, 5, 76, 0x8b9992, 0.56));
    landmark.add(this.scene.add.rectangle(-18, -24, 56, 18, 0x1c3b43, 0.7).setStrokeStyle(1, 0xd9dfd3, 0.22));
    landmark.add(this.scene.add.rectangle(20, -2, 60, 18, 0x304b27, 0.68).setStrokeStyle(1, 0xd9dfd3, 0.2));
    landmark.add(this.scene.add.rectangle(-18, -24, 32, 3, 0xd9dfd3, 0.16));
    landmark.add(this.scene.add.rectangle(20, -2, 34, 3, 0xd9dfd3, 0.14));
  }

  drawElevatedRamp(landmark) {
    this.addShadow(landmark, 132, 78, 0.16);
    landmark.add(this.scene.add.rectangle(0, 0, 122, 20, 0x2f3435, 0.58).setAngle(landmark.side * -18));
    landmark.add(this.scene.add.rectangle(0, 0, 110, 3, 0xd9dfd3, 0.16).setAngle(landmark.side * -18));
    [-44, 0, 44].forEach((x) => {
      landmark.add(this.scene.add.rectangle(x, 26, 10, 44, 0x566168, 0.34));
    });
  }

  drawServiceRoad(landmark) {
    landmark.add(this.scene.add.rectangle(0, 0, 74, 126, 0x202426, 0.3).setStrokeStyle(1, 0x8b9992, 0.12));
    landmark.add(this.scene.add.rectangle(0, 0, 3, 116, 0xd9dfd3, 0.12));
  }
}
