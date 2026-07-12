import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, ROAD } from '../data/tuning.js';
import { ROAD_SEGMENTS } from '../data/roadSegments.js';

const DEFAULT_SURFACE_PROFILE = {
  backgroundColor: 0x17201d,
  roadColor: 0x303438,
  shoulderColor: 0xc6c8b4,
  laneMarkerColor: 0xd8ded8,
  markColor: 0x4f5657,
  accentColor: 0x8fa08e,
  markAlpha: 0.18,
  accent: 'light_cracks',
  textureKey: 'asset-surface-clean-asphalt',
};

const DIVIDED_LAYOUTS = {
  unified: {
    type: 'unified',
    splitTarget: 0,
    medianWidth: 0,
    medianType: 'none',
  },
  divided_entry: {
    type: 'divided_entry',
    splitTarget: 1,
    medianWidth: 82,
    medianType: 'grass_guardrail',
  },
  divided_highway: {
    type: 'divided_highway',
    splitTarget: 1,
    medianWidth: 86,
    medianType: 'concrete_grass',
  },
  divided_exit: {
    type: 'divided_exit',
    splitTarget: 0,
    medianWidth: 0,
    medianType: 'narrowing_guardrail',
  },
};

export default class RoadSystem {
  constructor(scene, missionState) {
    this.scene = scene;
    this.missionState = missionState;
    this.segments = this.createMissionSegments();
    this.markerRows = [];
    this.markerSpacing = 92;
    this.offset = 0;
    this.segmentIndex = -1;
    this.segmentProgress = 0;
    this.surfaceMarks = [];
    this.edgeAccents = [];
    this.layout = DIVIDED_LAYOUTS.unified;
    this.splitProgress = 0;
    this.splitTarget = 0;
    this.medianHazards = [];
    this.medianCollisionArmed = false;
    this.medianWarningIssued = null;
    this.currentLaneCenters = this.getUnifiedLaneCenters();

    this.background = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x17201d)
      .setDepth(0);
    this.road = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, ROAD.right - ROAD.left, GAME_HEIGHT, 0x303438)
      .setDepth(1);
    this.roadTexture = scene.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, ROAD.right - ROAD.left, GAME_HEIGHT, DEFAULT_SURFACE_PROFILE.textureKey)
      .setDepth(1.12)
      .setAlpha(0.24);
    this.leftRoad = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, ROAD.right - ROAD.left, GAME_HEIGHT, 0x303438)
      .setDepth(1)
      .setVisible(false);
    this.leftRoadTexture = scene.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, ROAD.right - ROAD.left, GAME_HEIGHT, DEFAULT_SURFACE_PROFILE.textureKey)
      .setDepth(1.12)
      .setAlpha(0.24)
      .setVisible(false);
    this.rightRoad = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, ROAD.right - ROAD.left, GAME_HEIGHT, 0x303438)
      .setDepth(1)
      .setVisible(false);
    this.rightRoadTexture = scene.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, ROAD.right - ROAD.left, GAME_HEIGHT, DEFAULT_SURFACE_PROFILE.textureKey)
      .setDepth(1.12)
      .setAlpha(0.24)
      .setVisible(false);
    this.median = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 0, GAME_HEIGHT, 0x314928)
      .setDepth(1.6)
      .setVisible(false);
    this.leftMedianRail = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 3, GAME_HEIGHT, 0xb8b09e)
      .setDepth(2.3)
      .setVisible(false);
    this.rightMedianRail = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 3, GAME_HEIGHT, 0xb8b09e)
      .setDepth(2.3)
      .setVisible(false);
    this.leftShoulder = scene.add.rectangle(ROAD.left - 6, GAME_HEIGHT / 2, 8, GAME_HEIGHT, 0xc6c8b4)
      .setDepth(2);
    this.rightShoulder = scene.add.rectangle(ROAD.right + 6, GAME_HEIGHT / 2, 8, GAME_HEIGHT, 0xc6c8b4)
      .setDepth(2);

    this.laneX = this.createMarkerXPositions();

    for (let y = -this.markerSpacing; y < GAME_HEIGHT + this.markerSpacing; y += this.markerSpacing) {
      this.markerRows.push(this.createMarkerRow(y));
    }

    this.createSurfaceMarks();
    this.createEdgeAccents();
    this.medianDetails = this.createMedianDetails();
    this.advanceSegment();
  }

  createMarkerRow(y) {
    return this.laneX.map((x) => this.scene.add.image(x, y, 'lane-marker').setDepth(2));
  }

  createMarkerXPositions() {
    return [ROAD.left + (ROAD.right - ROAD.left) / 4, GAME_WIDTH / 2, ROAD.right - (ROAD.right - ROAD.left) / 4];
  }

  createMedianDetails() {
    const details = [];
    for (let index = 0; index < 10; index += 1) {
      const detail = this.scene.add.rectangle(GAME_WIDTH / 2, -80 + index * 92, 8, 18, 0x405a33, 0.85)
        .setDepth(2.1)
        .setVisible(false);
      detail.seed = index;
      details.push(detail);
    }
    return details;
  }

  update(delta) {
    const scrollDelta = (ROAD.scrollSpeed * delta) / 1000;
    this.segmentProgress += (ROAD.scrollSpeed * delta) / 1000;
    if (this.segmentProgress >= this.missionState.currentSegment.length) {
      this.advanceSegment();
    }

    this.offset += scrollDelta;
    if (this.offset >= this.markerSpacing) {
      this.offset -= this.markerSpacing;
    }

    let rowIndex = 0;
    this.updateLayout(scrollDelta);
    for (let y = -this.markerSpacing + this.offset; y < GAME_HEIGHT + this.markerSpacing; y += this.markerSpacing) {
      const row = this.markerRows[rowIndex];
      const markerXs = this.getMarkerXPositions();
      for (let index = 0; index < row.length; index += 1) {
        const marker = row[index];
        marker.y = y;
        marker.x = markerXs[index];
        marker.setVisible(markerXs[index] != null);
      }
      rowIndex += 1;
    }

    this.updateSurfaceMarks(scrollDelta);
    this.updateEdgeAccents(scrollDelta);
    this.updateMedianDetails(scrollDelta);
    this.updateRoadTexture(scrollDelta);
  }

  updateLayout(scrollDelta) {
    this.background
      .setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2)
      .setSize(GAME_WIDTH, GAME_HEIGHT);
    const step = scrollDelta / 1650;
    this.splitProgress = Phaser.Math.Clamp(
      Phaser.Math.Linear(this.splitProgress, this.splitTarget, step * 5.6),
      0,
      1,
    );

    const unifiedLaneCenters = this.getUnifiedLaneCenters();
    const dividedGeometry = this.getDividedGeometry();
    this.currentLaneCenters = unifiedLaneCenters.map((x, index) => {
      return Phaser.Math.Linear(x, dividedGeometry.laneCenters[index], this.splitProgress);
    });

    const roadColor = this.surfaceProfile?.roadColor ?? DEFAULT_SURFACE_PROFILE.roadColor;
    const shoulderColor = this.surfaceProfile?.shoulderColor ?? DEFAULT_SURFACE_PROFILE.shoulderColor;
    const leftEdge = Phaser.Math.Linear(ROAD.left, dividedGeometry.leftEdge, this.splitProgress);
    const leftRight = Phaser.Math.Linear(GAME_WIDTH / 2, dividedGeometry.leftRight, this.splitProgress);
    const rightLeft = Phaser.Math.Linear(GAME_WIDTH / 2, dividedGeometry.rightLeft, this.splitProgress);
    const rightEdge = Phaser.Math.Linear(ROAD.right, dividedGeometry.rightEdge, this.splitProgress);
    const medianWidth = Math.max(0, rightLeft - leftRight);
    const unifiedAlpha = 1 - this.splitProgress;

    this.road.setVisible(unifiedAlpha > 0.04);
    this.road.setAlpha(unifiedAlpha);
    this.roadTexture
      .setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2)
      .setSize(ROAD.right - ROAD.left, GAME_HEIGHT)
      .setVisible(unifiedAlpha > 0.04)
      .setAlpha(unifiedAlpha * (this.surfaceProfile?.textureAlpha ?? 0.24));
    this.leftRoad
      .setFillStyle(roadColor)
      .setPosition((leftEdge + leftRight) / 2, GAME_HEIGHT / 2)
      .setSize(leftRight - leftEdge, GAME_HEIGHT)
      .setVisible(this.splitProgress > 0.03);
    this.leftRoadTexture
      .setPosition((leftEdge + leftRight) / 2, GAME_HEIGHT / 2)
      .setSize(leftRight - leftEdge, GAME_HEIGHT)
      .setVisible(this.splitProgress > 0.03)
      .setAlpha((this.surfaceProfile?.textureAlpha ?? 0.24) * this.splitProgress);
    this.rightRoad
      .setFillStyle(roadColor)
      .setPosition((rightLeft + rightEdge) / 2, GAME_HEIGHT / 2)
      .setSize(rightEdge - rightLeft, GAME_HEIGHT)
      .setVisible(this.splitProgress > 0.03);
    this.rightRoadTexture
      .setPosition((rightLeft + rightEdge) / 2, GAME_HEIGHT / 2)
      .setSize(rightEdge - rightLeft, GAME_HEIGHT)
      .setVisible(this.splitProgress > 0.03)
      .setAlpha((this.surfaceProfile?.textureAlpha ?? 0.24) * this.splitProgress);

    this.leftShoulder
      .setFillStyle(shoulderColor)
      .setPosition(leftEdge - 6, GAME_HEIGHT / 2);
    this.rightShoulder
      .setFillStyle(shoulderColor)
      .setPosition(rightEdge + 6, GAME_HEIGHT / 2);

    const medianVisible = medianWidth > 12;
    this.median
      .setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2)
      .setSize(medianWidth, GAME_HEIGHT)
      .setVisible(medianVisible)
      .setAlpha(Phaser.Math.Clamp(this.splitProgress, 0, 0.92));
    this.leftMedianRail
      .setPosition(leftRight + 3, GAME_HEIGHT / 2)
      .setFillStyle(shoulderColor)
      .setVisible(medianVisible);
    this.rightMedianRail
      .setPosition(rightLeft - 3, GAME_HEIGHT / 2)
      .setFillStyle(shoulderColor)
      .setVisible(medianVisible);

    if (!medianVisible) {
      this.medianCollisionArmed = false;
      this.medianHazards = [];
      return;
    }

    const medianHazard = { left: leftRight + 4, right: rightLeft - 4, top: ROAD.top, bottom: ROAD.bottom };
    this.updateMedianCollisionState(medianHazard);
    this.medianHazards = this.medianCollisionArmed ? [medianHazard] : [];
  }

  updateMedianCollisionState(medianHazard) {
    if (this.medianCollisionArmed) {
      return;
    }

    if (this.splitProgress < 0.84) {
      return;
    }

    if (!this.playerClearOfMedian(medianHazard)) {
      this.flashMedianWarning('MEDIAN FORMING: MOVE CLEAR');
      return;
    }

    this.medianCollisionArmed = true;
  }

  playerClearOfMedian(medianHazard) {
    const player = this.scene.player?.sprite;
    if (!player?.active) {
      return true;
    }

    const bounds = player.getBounds();
    const clearance = 14;
    return bounds.right < medianHazard.left - clearance || bounds.left > medianHazard.right + clearance;
  }

  flashMedianWarning(message) {
    if (this.medianWarningIssued === message || this.scene.isAttract) {
      return;
    }

    this.medianWarningIssued = message;
    this.scene.hud?.flashAlert(message, 2400);
  }

  getMarkerXPositions() {
    const centers = this.currentLaneCenters;
    const leftMarker = (centers[0] + centers[1]) / 2;
    const centerMarker = Phaser.Math.Linear((centers[1] + centers[2]) / 2, GAME_WIDTH / 2, 1 - this.splitProgress);
    const rightMarker = (centers[2] + centers[3]) / 2;
    return [
      leftMarker,
      this.splitProgress > 0.72 ? null : centerMarker,
      rightMarker,
    ];
  }

  advanceSegment() {
    this.segmentIndex = (this.segmentIndex + 1) % this.segments.length;
    this.segmentProgress = 0;
    const segment = this.segments[this.segmentIndex];
    this.missionState.currentSegment = segment;
    this.missionState.currentSegmentId = segment.id;
    this.missionState.currentRouteTag = segment.tags[0];
    this.applySurfaceProfile(segment.surfaceProfile ?? DEFAULT_SURFACE_PROFILE);
    this.applyRoadLayout(segment.roadLayout ?? 'unified');
    this.missionState.eventHistory.push({
      type: 'segmentStarted',
      segmentId: segment.id,
      tags: segment.tags,
      at: this.missionState.elapsedTime,
    });
  }

  applyRoadLayout(layoutType) {
    const previousTarget = this.splitTarget;
    this.layout = DIVIDED_LAYOUTS[layoutType] ?? DIVIDED_LAYOUTS.unified;
    this.splitTarget = this.layout.splitTarget;
    if (previousTarget <= 0 && this.splitTarget > 0) {
      this.medianCollisionArmed = false;
      this.medianWarningIssued = null;
      this.flashMedianWarning('DIVIDED ROAD AHEAD');
    }
    if (layoutType === 'unified' && this.splitProgress < 0.08) {
      this.splitProgress = 0;
    }
  }

  createMissionSegments() {
    const segmentIds = this.scene.mission?.segmentIds ?? [];
    const selectedSegments = segmentIds
      .map((segmentId) => ROAD_SEGMENTS.find((segment) => segment.id === segmentId))
      .filter(Boolean);
    return selectedSegments.length > 0 ? selectedSegments : ROAD_SEGMENTS;
  }

  createSurfaceMarks() {
    for (let index = 0; index < 30; index += 1) {
      const mark = this.scene.add.rectangle(0, 0, 18, 3, 0x4f5657, 0.18)
        .setDepth(1.35)
        .setVisible(false);
      mark.seed = index;
      this.resetSurfaceMark(mark, Phaser.Math.Between(-120, GAME_HEIGHT + 80));
      this.surfaceMarks.push(mark);
    }
  }

  createEdgeAccents() {
    for (let index = 0; index < 14; index += 1) {
      const left = this.scene.add.rectangle(ROAD.left + 12, 0, 22, 4, 0x4eb6d6, 0.3)
        .setDepth(2.4)
        .setVisible(false);
      const right = this.scene.add.rectangle(ROAD.right - 12, 0, 22, 4, 0x4eb6d6, 0.3)
        .setDepth(2.4)
        .setVisible(false);
      left.side = 'left';
      right.side = 'right';
      this.edgeAccents.push(left, right);
    }
  }

  applySurfaceProfile(profile) {
    this.surfaceProfile = profile;
    this.background.setFillStyle(profile.backgroundColor);
    this.road.setFillStyle(profile.roadColor);
    this.applyRoadTexture(profile.textureKey ?? DEFAULT_SURFACE_PROFILE.textureKey);
    this.leftRoad.setFillStyle(profile.roadColor);
    this.rightRoad.setFillStyle(profile.roadColor);
    this.leftShoulder.setFillStyle(profile.shoulderColor);
    this.rightShoulder.setFillStyle(profile.shoulderColor);
    this.median.setFillStyle(profile.medianColor ?? 0x314928);

    for (const row of this.markerRows) {
      for (const marker of row) {
        marker.setTint(profile.laneMarkerColor);
        marker.setAlpha(profile.accent === 'hostile_scars' ? 0.72 : 0.94);
      }
    }

    this.configureSurfaceMarks(profile);
    this.configureEdgeAccents(profile);
  }

  applyRoadTexture(textureKey) {
    if (!this.scene.textures.exists(textureKey)) {
      return;
    }
    this.roadTexture.setTexture(textureKey);
    this.leftRoadTexture.setTexture(textureKey);
    this.rightRoadTexture.setTexture(textureKey);
    const scale = this.surfaceProfile?.textureScale ?? 0.72;
    this.roadTexture.setTileScale(scale, scale);
    this.leftRoadTexture.setTileScale(scale, scale);
    this.rightRoadTexture.setTileScale(scale, scale);
  }

  configureSurfaceMarks(profile) {
    for (const mark of this.surfaceMarks) {
      mark.setFillStyle(profile.markColor, profile.markAlpha);
      mark.setVisible(true);
      this.resetSurfaceMark(mark, mark.y);
    }
  }

  configureEdgeAccents(profile) {
    const showAccents = profile.accent === 'support_ticks' || profile.accent === 'hostile_scars';
    for (let index = 0; index < this.edgeAccents.length; index += 1) {
      const accent = this.edgeAccents[index];
      accent.setFillStyle(profile.accentColor, showAccents ? 0.42 : 0);
      accent.setVisible(showAccents);
      accent.y = -80 + Math.floor(index / 2) * 118;
      accent.width = profile.accent === 'hostile_scars' ? 34 : 22;
      accent.height = profile.accent === 'hostile_scars' ? 3 : 5;
      accent.angle = profile.accent === 'hostile_scars'
        ? (accent.side === 'left' ? -18 : 18)
        : 0;
    }
  }

  updateSurfaceMarks(scrollDelta) {
    for (const mark of this.surfaceMarks) {
      mark.y += scrollDelta * (mark.scrollMultiplier ?? 1);
      if (mark.y > GAME_HEIGHT + 36) {
        this.resetSurfaceMark(mark, Phaser.Math.Between(-150, -24));
      }
    }
  }

  updateEdgeAccents(scrollDelta) {
    for (const accent of this.edgeAccents) {
      accent.y += scrollDelta;
      if (accent.y > GAME_HEIGHT + 40) {
        accent.y = Phaser.Math.Between(-150, -40);
      }
    }
  }

  updateMedianDetails(scrollDelta) {
    const visible = this.splitProgress > 0.55 && this.medianHazards.length > 0;
    const hazard = this.medianHazards[0];
    for (const detail of this.medianDetails) {
      detail.setVisible(visible);
      if (!visible) {
        continue;
      }
      detail.y += scrollDelta;
      if (detail.y > GAME_HEIGHT + 40) {
        detail.y = Phaser.Math.Between(-170, -40);
      }
      const width = Math.max(10, hazard.right - hazard.left - 12);
      detail.x = GAME_WIDTH / 2 + ((detail.seed % 3) - 1) * Math.min(18, width / 5);
      detail.width = detail.seed % 2 === 0 ? 7 : 12;
      detail.height = detail.seed % 3 === 0 ? 24 : 13;
      detail.setFillStyle(detail.seed % 4 === 0 ? 0x9a8c68 : 0x3e5b31, 0.85);
    }
  }

  updateRoadTexture(scrollDelta) {
    const textureDelta = scrollDelta * 0.9;
    this.roadTexture.tilePositionY -= textureDelta;
    this.leftRoadTexture.tilePositionY -= textureDelta;
    this.rightRoadTexture.tilePositionY -= textureDelta;
  }

  resetSurfaceMark(mark, y) {
    const profile = this.surfaceProfile ?? DEFAULT_SURFACE_PROFILE;
    const centers = this.currentLaneCenters ?? this.getUnifiedLaneCenters();
    const laneWidth = this.splitProgress > 0.65 ? 46 : (ROAD.right - ROAD.left) / ROAD.laneCount;
    const lane = mark.seed % ROAD.laneCount;
    const laneLeft = centers[lane] - laneWidth / 2 + 8;
    const laneRight = centers[lane] + laneWidth / 2 - 8;
    mark.x = Phaser.Math.Between(laneLeft, laneRight);
    mark.y = y;
    mark.scrollMultiplier = Phaser.Math.FloatBetween(0.96, 1.05);

    if (profile.accent === 'commuter_wear') {
      mark.width = Phaser.Math.Between(18, 52);
      mark.height = Phaser.Math.Between(2, 4);
      mark.angle = Phaser.Math.Between(-4, 4);
      mark.setAlpha(profile.markAlpha);
      return;
    }

    if (profile.accent === 'hostile_scars') {
      mark.width = Phaser.Math.Between(22, 64);
      mark.height = Phaser.Math.Between(3, 7);
      mark.angle = Phaser.Math.Between(-22, 22);
      mark.setAlpha(Phaser.Math.FloatBetween(0.22, profile.markAlpha));
      return;
    }

    if (profile.accent === 'support_ticks') {
      mark.width = Phaser.Math.Between(16, 34);
      mark.height = Phaser.Math.Between(2, 5);
      mark.angle = Phaser.Math.Between(-8, 8);
      mark.setAlpha(profile.markAlpha);
      return;
    }

    mark.width = Phaser.Math.Between(10, 32);
    mark.height = Phaser.Math.Between(2, 4);
    mark.angle = Phaser.Math.Between(-12, 12);
    mark.setAlpha(profile.markAlpha);
  }

  getLaneCenters() {
    return [...this.currentLaneCenters];
  }

  getUnifiedLaneCenters() {
    const laneWidth = (ROAD.right - ROAD.left) / ROAD.laneCount;
    return Array.from({ length: ROAD.laneCount }, (_, index) => ROAD.left + laneWidth * (index + 0.5));
  }

  getDividedGeometry() {
    const roadWidth = ROAD.right - ROAD.left;
    const edgeInset = Phaser.Math.Clamp(roadWidth * 0.04, 10, 22);
    const medianWidth = Phaser.Math.Clamp(roadWidth * 0.2, 74, 112);
    const leftEdge = ROAD.left + edgeInset;
    const rightEdge = ROAD.right - edgeInset;
    const leftRight = GAME_WIDTH / 2 - medianWidth / 2;
    const rightLeft = GAME_WIDTH / 2 + medianWidth / 2;
    const leftLaneWidth = (leftRight - leftEdge) / 2;
    const rightLaneWidth = (rightEdge - rightLeft) / 2;
    return {
      leftEdge,
      leftRight,
      rightLeft,
      rightEdge,
      laneCenters: [
        leftEdge + leftLaneWidth * 0.5,
        leftEdge + leftLaneWidth * 1.5,
        rightLeft + rightLaneWidth * 0.5,
        rightLeft + rightLaneWidth * 1.5,
      ],
    };
  }

  getPlayerSideLaneCenters(playerX = GAME_WIDTH / 2) {
    return this.getLaneCentersForTarget('player_side', playerX);
  }

  getLaneCentersForTarget(spawnTarget = 'player_side', playerX = GAME_WIDTH / 2) {
    const centers = this.getLaneCenters();
    if (this.splitProgress < 0.65 || spawnTarget === 'both') {
      return centers;
    }

    const playerOnLeft = playerX < GAME_WIDTH / 2;
    const playerSide = playerOnLeft ? centers.slice(0, 2) : centers.slice(2, 4);
    const oppositeSide = playerOnLeft ? centers.slice(2, 4) : centers.slice(0, 2);

    if (spawnTarget === 'opposite_side') {
      return oppositeSide;
    }

    if (spawnTarget === 'left') {
      return centers.slice(0, 2);
    }

    if (spawnTarget === 'right') {
      return centers.slice(2, 4);
    }

    return playerSide;
  }

  getCarriagewayForX(x) {
    if (this.splitProgress < 0.65) {
      return 'unified';
    }

    return x < GAME_WIDTH / 2 ? 'left' : 'right';
  }

  getMedianHazards() {
    return this.medianHazards.map((hazard) => ({ ...hazard }));
  }

  getRoadLayout() {
    return {
      type: this.isDivided() ? 'divided' : 'unified',
      segmentLayout: this.layout.type,
      splitProgress: this.splitProgress,
      medianWidth: this.medianHazards[0]
        ? this.medianHazards[0].right - this.medianHazards[0].left
        : 0,
      medianType: this.layout.medianType,
      lanePositions: {
        unified: this.isDivided() ? null : this.getLaneCenters(),
        divided: this.isDivided() ? {
          left: this.getLaneCentersForTarget('left'),
          right: this.getLaneCentersForTarget('right'),
        } : null,
      },
    };
  }

  isDivided() {
    return this.splitProgress > 0.65;
  }
}
