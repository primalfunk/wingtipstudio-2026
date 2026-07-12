import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, ROAD } from '../data/tuning.js';

export default class RoadChoreographySystem {
  constructor(scene, missionState) {
    this.scene = scene;
    this.missionState = missionState;
    this.currentSegmentId = null;
    this.mode = 'none';
    this.markers = [];
    this.createMarkers();
  }

  createMarkers() {
    for (let index = 0; index < 22; index += 1) {
      const marker = this.scene.add.container(0, 0).setDepth(3.4);
      marker.seed = index;
      this.markers.push(marker);
    }
  }

  update(delta) {
    this.syncMode();
    const scrollDelta = (ROAD.scrollSpeed * delta) / 1000;
    for (const marker of this.markers) {
      marker.y += scrollDelta * marker.scrollScale;
      if (marker.y > GAME_HEIGHT + 80) {
        this.resetMarker(marker, Phaser.Math.Between(-240, -40));
      }
    }
  }

  syncMode() {
    const segment = this.missionState.currentSegment;
    if (!segment || segment.id === this.currentSegmentId) {
      return;
    }

    this.currentSegmentId = segment.id;
    this.mode = this.resolveMode(segment);
    for (const marker of this.markers) {
      this.resetMarker(marker, -80 - marker.seed * 58);
    }
  }

  resolveMode(segment) {
    const tags = segment.tags ?? [];
    if (tags.includes('construction') || tags.includes('diversion')) {
      return 'construction';
    }
    if (tags.includes('interchange') || tags.includes('overpass')) {
      return 'interchange';
    }
    if (tags.includes('checkpoint') || tags.includes('fortified')) {
      return 'checkpoint';
    }
    if (tags.includes('tunnel')) {
      return 'tunnel';
    }
    if (tags.includes('bridge') || tags.includes('causeway')) {
      return 'bridge';
    }
    if (tags.includes('flood-channel')) {
      return 'flood';
    }
    if (tags.includes('divided-exit') || tags.includes('divided')) {
      return 'merge';
    }
    return 'none';
  }

  resetMarker(marker, y) {
    marker.removeAll(true);
    marker.y = y;
    marker.scrollScale = Phaser.Math.FloatBetween(0.98, 1.04);
    marker.setVisible(this.mode !== 'none');
    if (!marker.visible) {
      return;
    }

    if (this.mode === 'construction') {
      this.drawConstructionMarker(marker);
      return;
    }

    if (this.mode === 'interchange') {
      this.drawInterchangeMarker(marker);
      return;
    }

    if (this.mode === 'checkpoint') {
      this.drawCheckpointMarker(marker);
      return;
    }

    if (this.mode === 'tunnel') {
      this.drawTunnelMarker(marker);
      return;
    }

    if (this.mode === 'bridge') {
      this.drawBridgeMarker(marker);
      return;
    }

    if (this.mode === 'flood') {
      this.drawFloodMarker(marker);
      return;
    }

    this.drawMergeMarker(marker);
  }

  addChoreoImage(marker, key, width, height, alpha = 0.72, angle = 0) {
    if (!this.scene.textures.exists(key)) {
      return false;
    }

    marker.add(this.scene.add.image(0, 0, key).setDisplaySize(width, height).setAlpha(alpha).setAngle(angle));
    return true;
  }

  drawConstructionMarker(marker) {
    const side = marker.seed % 2 === 0 ? -1 : 1;
    const laneOffset = marker.seed % 4 < 2 ? 74 : 24;
    marker.x = GAME_WIDTH / 2 + side * laneOffset;
    if (marker.seed % 3 === 0) {
      if (this.addChoreoImage(marker, 'transition-temporary-barrier-diagonal', 52, 67, 0.86, side * 14)) {
        return;
      }
      marker.add(this.scene.add.rectangle(0, 0, 34, 9, 0xd99735, 0.86).setAngle(side * 15));
      marker.add(this.scene.add.rectangle(0, 0, 25, 2, 0x171411, 0.7).setAngle(side * 15));
      return;
    }
    if (marker.seed % 5 === 0 && this.addChoreoImage(marker, 'transition-construction-diversion-arrows', 34, 70, 0.7)) {
      return;
    }
    if (marker.seed % 7 === 0 && this.addChoreoImage(marker, 'transition-shoulder-closure-hatch', 34, 70, 0.52, side * 2)) {
      return;
    }
    marker.add(this.scene.add.triangle(0, 0, -7, 10, 0, -10, 7, 10, 0xd99735, 0.86));
    marker.add(this.scene.add.rectangle(0, 4, 12, 2, 0xf6e7a8, 0.72));
  }

  drawInterchangeMarker(marker) {
    const side = marker.seed % 2 === 0 ? -1 : 1;
    marker.x = GAME_WIDTH / 2 + side * Phaser.Math.Between(54, 118);
    if (marker.seed % 4 === 0) {
      marker.add(this.scene.add.rectangle(0, 0, 68, 4, 0xb8c7bd, 0.22).setAngle(side * 24));
      marker.add(this.scene.add.rectangle(0, 11, 42, 3, 0xd9dfd3, 0.14).setAngle(side * 24));
      return;
    }
    if (marker.seed % 3 === 0) {
      marker.add(this.scene.add.arc(0, 0, 22, side < 0 ? 205 : -25, side < 0 ? 320 : 140, false, 0xb8c7bd, 0.18));
      return;
    }
    marker.add(this.scene.add.rectangle(0, 0, 20, 3, 0xd9dfd3, 0.18).setAngle(side * 16));
  }

  drawCheckpointMarker(marker) {
    const side = marker.seed % 2 === 0 ? -1 : 1;
    marker.x = GAME_WIDTH / 2 + side * Phaser.Math.Between(48, 118);
    if (marker.seed % 4 === 0) {
      marker.add(this.scene.add.rectangle(0, 0, 38, 12, 0x5b3030, 0.86).setStrokeStyle(1, 0xe05c5c, 0.45));
      marker.add(this.scene.add.circle(side * 16, -9, 4, 0xe05c5c, 0.58));
      return;
    }
    marker.add(this.scene.add.rectangle(0, 0, 8, 36, 0xb8a47a, 0.62));
    marker.add(this.scene.add.rectangle(0, -16, 22, 4, 0xf6e7a8, 0.36));
  }

  drawTunnelMarker(marker) {
    const side = marker.seed % 2 === 0 ? -1 : 1;
    marker.x = side < 0 ? ROAD.left + 16 : ROAD.right - 16;
    if (this.addChoreoImage(marker, 'transition-tunnel-lane-light-strip', 17, 68, 0.58)) {
      return;
    }
    marker.add(this.scene.add.rectangle(0, 0, 5, 54, 0x9ee7f5, 0.18 + (marker.seed % 3) * 0.05));
  }

  drawBridgeMarker(marker) {
    const side = marker.seed % 2 === 0 ? -1 : 1;
    marker.x = side < 0 ? ROAD.left - 14 : ROAD.right + 14;
    if (this.addChoreoImage(marker, 'transition-bridge-edge-reflector-strip', 17, 70, 0.6)) {
      return;
    }
    marker.add(this.scene.add.rectangle(0, 0, 10, 62, 0x8fa5aa, 0.28));
    marker.add(this.scene.add.rectangle(0, -26, 22, 3, 0xc2e2e8, 0.22));
  }

  drawFloodMarker(marker) {
    const side = marker.seed % 2 === 0 ? -1 : 1;
    marker.x = GAME_WIDTH / 2 + side * Phaser.Math.Between(94, 142);
    if (this.addChoreoImage(marker, 'transition-flood-channel-edge-stripe', 34, 74, 0.66, side * 2)) {
      return;
    }
    marker.add(this.scene.add.rectangle(0, 0, 42, 3, 0x75c6d8, 0.28).setAngle(side * 12));
    if (marker.seed % 3 === 0) {
      marker.add(this.scene.add.rectangle(0, 13, 28, 4, 0x627f83, 0.34).setAngle(side * 12));
    }
  }

  drawMergeMarker(marker) {
    const side = marker.seed % 2 === 0 ? -1 : 1;
    marker.x = GAME_WIDTH / 2 + side * Phaser.Math.Between(24, 86);
    if (marker.seed % 4 === 0) {
      if (this.addChoreoImage(marker, marker.seed % 8 === 0 ? 'transition-lane-split-arrow' : 'transition-lane-merge-arrow', 36, 68, 0.42, side < 0 ? 0 : 180)) {
        return;
      }
      marker.add(this.scene.add.triangle(0, 0, -12, 12, 12, 0, -12, -12, 0xf6e7a8, 0.38).setAngle(side < 0 ? 0 : 180));
      return;
    }
    if (marker.seed % 5 === 0 && this.addChoreoImage(marker, side < 0 ? 'transition-divided-entry-chevrons' : 'transition-divided-exit-merge-chevrons', 30, 70, 0.38)) {
      return;
    }
    if (marker.seed % 6 === 0 && this.addChoreoImage(marker, 'transition-guardrail-taper-end', 18, 70, 0.44, side * 3)) {
      return;
    }
    if (marker.seed % 7 === 0 && this.addChoreoImage(marker, 'transition-concrete-median-nose', 30, 64, 0.42, side * 2)) {
      return;
    }
    marker.add(this.scene.add.rectangle(0, 0, 24, 3, 0xf6e7a8, 0.18).setAngle(side * 18));
  }
}
