import Phaser from 'phaser';
import { CAMPAIGN_WORLDS, getMissionNode } from '../data/campaignData.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../data/tuning.js';
import AudioSystem from '../systems/AudioSystem.js';
import StorageSystem from '../systems/StorageSystem.js';
import LayoutSystem from '../systems/LayoutSystem.js';
import TransmissionManager from '../systems/TransmissionManager.js';

const NODE_COLORS = {
  road: 0x7fc6d7,
  intercept: 0xf2b35d,
  river: 0x4eb6d6,
  fortress: 0xe05c5c,
};

const NODE_SUBTITLES = {
  '1-1': 'OPEN HIGHWAY',
  '1-2': 'CHECKPOINT RUN',
  '1-3': 'NORTH CORRIDOR',
  '1-4': 'CONSTRUCTION DIVERSION',
  '1-5': 'DIVIDED INTERSTATE',
  '1-6': 'FLOOD CHANNEL',
  '1-7': 'INDUSTRIAL CORRIDOR',
  '1-8': 'TUNNEL BATTERY',
  '1-9': 'RELAY STATION',
};

const ENVIRONMENT_MAP_STYLES = {
  domestic_interstate: {
    label: 'INTERSTATE',
    routeColor: 0xb8c7bd,
    nodeColor: 0x7fc6d7,
    accentColor: 0x8fa08e,
    icon: 'highway',
  },
  watched_grid: {
    label: 'WATCHED GRID',
    routeColor: 0xf2b35d,
    nodeColor: 0xf2b35d,
    accentColor: 0xe05c5c,
    icon: 'relay',
  },
  support_corridor: {
    label: 'SUPPORT CORRIDOR',
    routeColor: 0x8fcdda,
    nodeColor: 0x4eb6d6,
    accentColor: 0xd7eef2,
    icon: 'support',
  },
  river_access: {
    label: 'RIVER ACCESS',
    routeColor: 0x4eb6d6,
    nodeColor: 0x4eb6d6,
    accentColor: 0x9ee7f5,
    icon: 'water',
  },
  fortified_border: {
    label: 'FORTIFIED BORDER',
    routeColor: 0xe05c5c,
    nodeColor: 0xe05c5c,
    accentColor: 0xf6e7a8,
    icon: 'fortress',
  },
  default: {
    label: 'ROUTE',
    routeColor: 0xb8c7bd,
    nodeColor: 0x7fc6d7,
    accentColor: 0xf6e7a8,
    icon: 'highway',
  },
};

export default class OverworldScene extends Phaser.Scene {
  constructor() {
    super('OverworldScene');
  }

  init(data = {}) {
    this.autopilot = Boolean(data.autopilot);
  }

  create() {
    LayoutSystem.restartOnResize(this, { autopilot: this.autopilot });
    this.deploying = false;
    this.campaignState = StorageSystem.loadCampaign();
    this.audioSystem = new AudioSystem(this);
    this.audioSystem.playMainMenuMusic();
    this.baseWorld = CAMPAIGN_WORLDS.find((world) => world.id === this.campaignState.currentWorldId) ?? CAMPAIGN_WORLDS[0];
    this.configureMapLayout();
    this.world = this.createResponsiveWorld(this.baseWorld);
    this.campaignState = this.normalizeCampaignState(this.campaignState);
    this.cursorNodeId = this.campaignState.cursorNodeId;
    this.nodeViews = new Map();
    this.routeGraphics = this.add.graphics().setDepth(4);
    this.completedRouteGraphics = this.add.graphics().setDepth(5);
    this.activeRouteGraphics = this.add.graphics().setDepth(6);
    this.routePulseGraphics = this.add.graphics().setDepth(7);
    this.waterFx = [];
    this.relayLights = [];
    this.routePulseOffset = 0;

    this.drawBaseMap();
    this.drawTerrainRegions();
    this.drawInfrastructure();
    this.drawRoutes();
    this.drawNodes();
    this.createPlayerMarker();
    this.createAmbientFx();
    this.createInfoPanel();

    this.input.keyboard.on('keydown', this.handleKeyDown, this);
    this.input.on('pointerdown', this.handlePointerDeploy, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdownInputHandlers, this);
    this.updateCursor();
  }

  configureMapLayout() {
    const layout = LayoutSystem.screen(this);
    const frameTop = Math.max(86, layout.marginTop + 58);
    const frameBottom = layout.height - Math.max(156, layout.bottomBand + 42);
    const frameHeight = Math.max(420, frameBottom - frameTop);
    const frameWidth = Math.max(
      340,
      Math.min(layout.width - layout.marginX * 2, layout.isWide ? 820 : 520),
    );
    const frameLeft = (layout.width - frameWidth) / 2;
    this.mapFrame = {
      left: frameLeft,
      top: frameTop,
      width: frameWidth,
      height: frameHeight,
      scaleX: frameWidth / 420,
      scaleY: frameHeight / 470,
    };
  }

  createResponsiveWorld(world) {
    this.nodeById = new Map();
    const nodes = world.nodes.map((node) => {
      const mapped = {
        ...node,
        x: this.mapX(node.x),
        y: this.mapY(node.y),
      };
      this.nodeById.set(mapped.id, mapped);
      return mapped;
    });
    return {
      ...world,
      nodes,
    };
  }

  getNode(nodeId) {
    return this.nodeById.get(nodeId) ?? getMissionNode(nodeId, this.world.id);
  }

  mapX(x) {
    return this.mapFrame.left + (x - 30) * this.mapFrame.scaleX;
  }

  mapY(y) {
    return this.mapFrame.top + (y - 90) * this.mapFrame.scaleY;
  }

  mapW(width) {
    return width * this.mapFrame.scaleX;
  }

  mapH(height) {
    return height * this.mapFrame.scaleY;
  }

  normalizeCampaignState(campaignState) {
    const validNodeIds = new Set(this.world.nodes.map((node) => node.id));
    const completedNodeIds = (campaignState.completedNodeIds ?? []).filter((nodeId) => validNodeIds.has(nodeId));
    const unlockedNodeIds = (campaignState.unlockedNodeIds ?? []).filter((nodeId) => validNodeIds.has(nodeId));
    if (unlockedNodeIds.length === 0) {
      unlockedNodeIds.push(this.world.nodes[0].id);
    }
    const cursorNodeId = validNodeIds.has(campaignState.cursorNodeId)
      ? campaignState.cursorNodeId
      : unlockedNodeIds[unlockedNodeIds.length - 1];
    return {
      ...campaignState,
      cursorNodeId,
      unlockedNodeIds,
      completedNodeIds,
      bestMissionScores: Object.fromEntries(
        Object.entries(campaignState.bestMissionScores ?? {}).filter(([nodeId]) => validNodeIds.has(nodeId)),
      ),
    };
  }

  update(time, delta) {
    this.routePulseOffset = (this.routePulseOffset + delta * 0.0007) % 1;
    this.updateRoutePulses();
    this.updateWaterFx(time);
    this.updateRelayLights(time);
    if (this.coordinateText) {
      this.coordinateText.setText(`GRID ${Math.floor(time / 90) % 1000}.${Math.floor(time / 17) % 1000} // ROUTE MONITOR`);
    }
  }

  drawBaseMap() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x061014).setDepth(0);
    this.add.grid(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 24, 24, 0x0b2028, 0.26, 0x16343d, 0.22)
      .setDepth(0.2);
    this.add.grid(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 96, 96, 0x000000, 0, 0x24434c, 0.18)
      .setDepth(0.25);

    this.add.text(24, 20, 'CLASSIFIED // SPY HUNTER: APEX', {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '14px',
      color: '#d6f7ef',
    }).setDepth(20);
    this.add.text(24, 42, 'SECTOR W1 // DOMESTIC INTERSTATE ROUTE MAP', {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '11px',
      color: '#7fa6aa',
    }).setDepth(20);
    this.add.text(GAME_WIDTH - 24, 22, 'DEPLOYMENT ACTIVE', {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '11px',
      color: '#f6e7a8',
    }).setOrigin(1, 0).setDepth(20);
    this.coordinateText = this.add.text(GAME_WIDTH - 24, 42, 'GRID 000.000 // ROUTE MONITOR', {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '10px',
      color: '#6e8f93',
    }).setOrigin(1, 0).setDepth(20);
  }

  drawTerrainRegions() {
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(0x101c1d, 0.72);
    g.fillRoundedRect(this.mapX(42), this.mapY(112), this.mapW(360), this.mapH(116), 8);
    g.lineStyle(1, 0x31505a, 0.55);
    g.strokeRoundedRect(this.mapX(42), this.mapY(112), this.mapW(360), this.mapH(116), 8);

    g.fillStyle(0x102b35, 0.78);
    g.fillRoundedRect(this.mapX(232), this.mapY(250), this.mapW(132), this.mapH(164), 8);
    g.lineStyle(1, 0x2d6b7a, 0.72);
    g.strokeRoundedRect(this.mapX(232), this.mapY(250), this.mapW(132), this.mapH(164), 8);

    g.fillStyle(0x201715, 0.82);
    g.fillRoundedRect(this.mapX(232), this.mapY(438), this.mapW(168), this.mapH(100), 8);
    g.lineStyle(1, 0x8f4f45, 0.62);
    g.strokeRoundedRect(this.mapX(232), this.mapY(438), this.mapW(168), this.mapH(100), 8);

    this.add.text(this.mapX(56), this.mapY(126), 'INTERSTATE GRID', this.mapLabelStyle()).setDepth(3);
    this.add.text(this.mapX(246), this.mapY(266), 'RIVER ACCESS', this.mapLabelStyle('#9ee7f5')).setDepth(3);
    this.add.text(this.mapX(246), this.mapY(454), 'FORTIFIED ZONE', this.mapLabelStyle('#f0a09a')).setDepth(3);

    this.drawForestMarks(58, 156, 12);
    this.drawCityCluster(132, 146);
    this.drawCityCluster(328, 166);
    this.drawRailCorridor();
    this.drawRiverChannel();
    this.drawFortressGrid();
  }

  mapLabelStyle(color = '#8fb8bd') {
    return {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '10px',
      color,
    };
  }

  drawForestMarks(x, y, count) {
    for (let index = 0; index < count; index += 1) {
      const px = x + (index % 6) * 18;
      const py = y + Math.floor(index / 6) * 22;
      this.add.triangle(this.mapX(px), this.mapY(py), 0, 8, 5, 0, 10, 8, 0x294031, 0.72).setDepth(2);
    }
  }

  drawCityCluster(x, y) {
    for (let index = 0; index < 8; index += 1) {
      this.add.rectangle(this.mapX(x + (index % 4) * 9), this.mapY(y + Math.floor(index / 4) * 10), 5, 7, 0x52666a, 0.62).setDepth(2);
    }
  }

  drawRailCorridor() {
    const g = this.add.graphics().setDepth(2.5);
    g.lineStyle(2, 0x576767, 0.45);
    g.lineBetween(this.mapX(68), this.mapY(212), this.mapX(390), this.mapY(126));
    g.lineStyle(1, 0x93a5a1, 0.26);
    for (let index = 0; index < 12; index += 1) {
      const x = 78 + index * 26;
      g.lineBetween(this.mapX(x), this.mapY(207 - index * 7), this.mapX(x + 10), this.mapY(217 - index * 7));
    }
  }

  drawRiverChannel() {
    const g = this.add.graphics().setDepth(2);
    g.lineStyle(13, 0x0f4b61, 0.76);
    g.beginPath();
    g.moveTo(this.mapX(292), this.mapY(230));
    g.lineTo(this.mapX(326), this.mapY(290));
    g.lineTo(this.mapX(312), this.mapY(366));
    g.lineTo(this.mapX(340), this.mapY(430));
    g.strokePath();
    g.lineStyle(2, 0x8ad8e8, 0.35);
    g.strokePath();
    for (let index = 0; index < 7; index += 1) {
      const shimmer = this.add.rectangle(this.mapX(294 + (index % 3) * 18), this.mapY(274 + index * 22), 20, 1, 0x9ee7f5, 0.16)
        .setDepth(3)
        .setAngle(index % 2 === 0 ? 18 : -14);
      shimmer.baseAlpha = 0.12 + index * 0.01;
      shimmer.phase = index * 0.8;
      this.waterFx.push(shimmer);
    }
  }

  drawFortressGrid() {
    for (let index = 0; index < 5; index += 1) {
      this.add.rectangle(this.mapX(270 + index * 24), this.mapY(504), 12, 22, 0x5f3b37, 0.76)
        .setStrokeStyle(1, 0xb85a51, 0.55)
        .setDepth(2);
    }
  }

  drawInfrastructure() {
    const g = this.add.graphics().setDepth(3);
    g.lineStyle(1, 0x466268, 0.28);
    for (let x = 66; x <= 378; x += 52) {
      g.lineBetween(this.mapX(x), this.mapY(118), this.mapX(x + 16), this.mapY(222));
    }
    for (const tower of [{ x: 394, y: 122 }, { x: 220, y: 286 }, { x: 384, y: 458 }]) {
      this.add.text(this.mapX(tower.x), this.mapY(tower.y), 'Y', {
        fontFamily: 'Consolas, Courier, monospace',
        fontSize: '12px',
        color: '#6b8f91',
      }).setOrigin(0.5).setDepth(3);
      this.relayLights.push(this.add.circle(this.mapX(tower.x), this.mapY(tower.y - 8), 3, 0xf6e7a8, 0.46).setDepth(4));
    }
  }

  drawRoutes() {
    this.routeGraphics.clear();
    this.completedRouteGraphics.clear();
    const completed = new Set(this.campaignState.completedNodeIds);
    for (const node of this.world.nodes) {
      for (const nextNodeId of node.next) {
        const nextNode = this.getNode(nextNodeId);
        const isCleared = completed.has(node.id);
        this.drawRouteSegment(node, nextNode, isCleared);
      }
    }
  }

  drawRouteSegment(from, to, isCleared) {
    const graphics = isCleared ? this.completedRouteGraphics : this.routeGraphics;
    const color = this.getRouteColor(from, to);
    const alpha = isCleared ? 0.35 : 0.72;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = (-dy / length) * 3;
    const ny = (dx / length) * 3;

    graphics.lineStyle(2, color, alpha);
    graphics.lineBetween(from.x + nx, from.y + ny, to.x + nx, to.y + ny);
    graphics.lineBetween(from.x - nx, from.y - ny, to.x - nx, to.y - ny);
    graphics.lineStyle(1, color, alpha * 0.45);
    graphics.lineBetween(from.x, from.y, to.x, to.y);
    this.drawRouteInfrastructureTicks(graphics, from, to, color, alpha);
  }

  drawNodes() {
    const unlocked = new Set(this.campaignState.unlockedNodeIds);
    const completed = new Set(this.campaignState.completedNodeIds);

    for (const node of this.world.nodes) {
      const isUnlocked = unlocked.has(node.id);
      const isCompleted = completed.has(node.id);
      const nodeStyle = this.getNodeStyle(node);
      const color = isUnlocked ? nodeStyle.nodeColor : 0x344245;
      const ring = this.add.rectangle(node.x, node.y, node.type === 'fortress' ? 34 : 29, node.type === 'fortress' ? 34 : 29, 0x071014, 0.92)
        .setStrokeStyle(isCompleted ? 3 : 2, isCompleted ? 0xd6f7ef : color, isUnlocked ? 0.95 : 0.42)
        .setDepth(10);
      const core = this.add.circle(node.x, node.y, node.type === 'fortress' ? 9 : 7, color, isUnlocked ? 0.9 : 0.35)
        .setDepth(11);
      const icon = this.add.container(node.x, node.y).setDepth(12);
      this.drawNodeIcon(icon, nodeStyle, isUnlocked);
      const label = this.add.text(node.x, node.y + 28, `${node.label}\n${NODE_SUBTITLES[node.id] ?? node.name.toUpperCase()}`, {
        fontFamily: 'Consolas, Courier, monospace',
        fontSize: '10px',
        color: isUnlocked ? '#d7e0df' : '#607174',
        align: 'center',
        lineSpacing: 1,
      }).setOrigin(0.5, 0).setDepth(11);
      const state = this.add.text(node.x, node.y - 28, isCompleted ? 'SECURED' : (isUnlocked ? 'READY' : 'LOCKED'), {
        fontFamily: 'Consolas, Courier, monospace',
        fontSize: '8px',
        color: isCompleted ? '#9ff0c1' : (isUnlocked ? '#f6e7a8' : '#516366'),
      }).setOrigin(0.5).setDepth(11);
      const activeHalo = this.add.circle(node.x, node.y, node.type === 'fortress' ? 29 : 25, 0x000000, 0)
        .setStrokeStyle(4, nodeStyle.accentColor, 0)
        .setDepth(9)
        .setVisible(false);
      const activePing = this.add.circle(node.x, node.y, node.type === 'fortress' ? 42 : 36, 0x000000, 0)
        .setStrokeStyle(2, 0xf6e7a8, 0)
        .setDepth(8)
        .setVisible(false);
      const activeCallout = this.add.text(node.x, node.y - 50, 'ACTIVE TARGET', {
        fontFamily: 'Consolas, Courier, monospace',
        fontSize: '9px',
        color: '#07100d',
        backgroundColor: '#f6e7a8',
        padding: { x: 4, y: 2 },
      }).setOrigin(0.5).setDepth(31).setVisible(false);

      this.nodeViews.set(node.id, {
        ring,
        core,
        icon,
        label,
        state,
        activeHalo,
        activePing,
        activeCallout,
        base: {
          ringStrokeWidth: isCompleted ? 3 : 2,
          ringStrokeColor: isCompleted ? 0xd6f7ef : color,
          ringStrokeAlpha: isUnlocked ? 0.95 : 0.42,
          coreRadius: node.type === 'fortress' ? 9 : 7,
          coreAlpha: isUnlocked ? 0.9 : 0.35,
          stateText: isCompleted ? 'SECURED' : (isUnlocked ? 'READY' : 'LOCKED'),
          stateColor: isCompleted ? '#9ff0c1' : (isUnlocked ? '#f6e7a8' : '#516366'),
        },
      });
    }
  }

  getNodeStyle(node) {
    return ENVIRONMENT_MAP_STYLES[node.environmentProfile] ?? {
      ...ENVIRONMENT_MAP_STYLES.default,
      nodeColor: NODE_COLORS[node.type] ?? NODE_COLORS.road,
    };
  }

  getRouteColor(from, to) {
    if (from.type === 'river' || to.type === 'river') {
      return ENVIRONMENT_MAP_STYLES.river_access.routeColor;
    }
    const nextStyle = this.getNodeStyle(to);
    const fromStyle = this.getNodeStyle(from);
    return to.environmentProfile === 'fortified_border'
      ? ENVIRONMENT_MAP_STYLES.fortified_border.routeColor
      : (nextStyle.routeColor ?? fromStyle.routeColor ?? ENVIRONMENT_MAP_STYLES.default.routeColor);
  }

  drawRouteInfrastructureTicks(graphics, from, to, color, alpha) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = (-dy / length) * 5;
    const ny = (dx / length) * 5;
    const tickCount = Math.max(2, Math.floor(length / 58));
    graphics.lineStyle(1, color, alpha * 0.34);
    for (let index = 1; index <= tickCount; index += 1) {
      const t = index / (tickCount + 1);
      const x = Phaser.Math.Linear(from.x, to.x, t);
      const y = Phaser.Math.Linear(from.y, to.y, t);
      graphics.lineBetween(x - nx, y - ny, x + nx, y + ny);
    }
  }

  drawNodeIcon(icon, style, isUnlocked) {
    const alpha = isUnlocked ? 0.85 : 0.22;
    const accent = style.accentColor;
    if (style.icon === 'water') {
      icon.add(this.add.rectangle(-4, -2, 10, 2, accent, alpha).setAngle(-14));
      icon.add(this.add.rectangle(5, 3, 10, 2, accent, alpha * 0.8).setAngle(-14));
      return;
    }
    if (style.icon === 'relay') {
      icon.add(this.add.rectangle(0, 0, 2, 14, accent, alpha));
      icon.add(this.add.triangle(0, -8, -7, 6, 7, 6, 0, -8, accent, alpha * 0.28).setStrokeStyle(1, accent, alpha * 0.35));
      return;
    }
    if (style.icon === 'support') {
      icon.add(this.add.rectangle(0, 0, 13, 4, accent, alpha));
      icon.add(this.add.rectangle(0, 0, 4, 13, accent, alpha));
      return;
    }
    if (style.icon === 'fortress') {
      icon.add(this.add.rectangle(0, 0, 12, 9, accent, alpha * 0.58).setStrokeStyle(1, accent, alpha));
      icon.add(this.add.rectangle(-5, -7, 4, 6, accent, alpha * 0.46));
      icon.add(this.add.rectangle(5, -7, 4, 6, accent, alpha * 0.46));
      return;
    }
    icon.add(this.add.rectangle(0, -2, 14, 2, accent, alpha));
    icon.add(this.add.rectangle(0, 4, 14, 2, accent, alpha * 0.72));
  }

  createPlayerMarker() {
    this.playerIcon = this.add.container(0, 0).setDepth(30);
    const body = this.add.triangle(0, -4, 0, -10, -7, 8, 7, 8, 0xf6e7a8, 0.95)
      .setStrokeStyle(1, 0x1a221f);
    const wake = this.add.rectangle(0, 10, 3, 12, 0xf6e7a8, 0.26);
    const bracketA = this.add.rectangle(-15, 0, 7, 2, 0xf6e7a8, 0.9);
    const bracketB = this.add.rectangle(15, 0, 7, 2, 0xf6e7a8, 0.9);
    this.playerIcon.add([wake, body, bracketA, bracketB]);
    this.tweens.add({
      targets: this.playerIcon,
      alpha: 0.58,
      duration: 460,
      yoyo: true,
      repeat: -1,
    });
  }

  createAmbientFx() {
    this.scanline = this.add.rectangle(GAME_WIDTH / 2, -20, GAME_WIDTH, 2, 0x9ee7f5, 0.16)
      .setDepth(40);
    this.tweens.add({
      targets: this.scanline,
      y: GAME_HEIGHT + 20,
      duration: 4200,
      repeat: -1,
      ease: 'Linear',
    });

    this.radar = this.add.circle(GAME_WIDTH - 62, GAME_HEIGHT - 64, 38, 0x000000, 0)
      .setStrokeStyle(1, 0x4eb6d6, 0.32)
      .setDepth(4);
    this.radarSweep = this.add.rectangle(GAME_WIDTH - 62, GAME_HEIGHT - 64, 36, 1, 0x4eb6d6, 0.42)
      .setOrigin(0, 0.5)
      .setDepth(5);
    this.tweens.add({
      targets: this.radarSweep,
      angle: 360,
      duration: 2800,
      repeat: -1,
      ease: 'Linear',
    });
    this.tweens.add({
      targets: this.radar,
      alpha: { from: 0.32, to: 0.12 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
    });
  }

  createInfoPanel() {
    const layout = LayoutSystem.screen(this);
    const panelHeight = Math.max(96, Math.min(126, layout.bottomBand - 22));
    const panelY = GAME_HEIGHT - panelHeight / 2 - 22;
    this.add.rectangle(GAME_WIDTH / 2, panelY, GAME_WIDTH - layout.marginX * 2, panelHeight, 0x081316, 0.92)
      .setStrokeStyle(1, 0x294950)
      .setDepth(20);
    this.infoText = this.add.text(layout.marginX + 12, panelY - panelHeight / 2 + 14, '', {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '12px',
      color: '#d7e0df',
      lineSpacing: 6,
      wordWrap: { width: GAME_WIDTH - layout.marginX * 2 - 24 },
    }).setDepth(21);
    const prompt = this.autopilot
      ? 'AUTOPILOT ARMED   ARROWS/WASD: SELECT   ENTER/CLICK: WATCH   ESC: TITLE'
      : 'ARROWS/WASD: SELECT NODE   ENTER/CLICK: DEPLOY   ESC: TITLE';
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 26, prompt, {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: GAME_WIDTH < 430 ? '9px' : '10px',
      color: '#7f9695',
      align: 'center',
      wordWrap: { width: GAME_WIDTH - layout.marginX * 2 },
    }).setOrigin(0.5).setDepth(21);
  }

  handleKeyDown(event) {
    if (this.deploying) {
      return;
    }

    if (event.code === 'Enter') {
      this.audioSystem.playConfirm();
      this.deploySelectedNode();
      return;
    }

    if (event.code === 'Escape') {
      this.scene.start('TitleScene');
      return;
    }

    if (['ArrowRight', 'KeyD', 'ArrowDown', 'KeyS'].includes(event.code)) {
      this.moveCursor(1);
    } else if (['ArrowLeft', 'KeyA', 'ArrowUp', 'KeyW'].includes(event.code)) {
      this.moveCursor(-1);
    }
  }

  handlePointerDeploy() {
    if (this.deploying) {
      return;
    }

    this.audioSystem.playConfirm();
    this.deploySelectedNode();
  }

  shutdownInputHandlers() {
    this.input.keyboard.off('keydown', this.handleKeyDown, this);
    this.input.off('pointerdown', this.handlePointerDeploy, this);
  }

  moveCursor(direction) {
    const unlockedNodes = this.world.nodes.filter((node) => this.campaignState.unlockedNodeIds.includes(node.id));
    const currentIndex = unlockedNodes.findIndex((node) => node.id === this.cursorNodeId);
    const nextIndex = Phaser.Math.Clamp(currentIndex + direction, 0, unlockedNodes.length - 1);
    this.cursorNodeId = unlockedNodes[nextIndex]?.id ?? this.cursorNodeId;
    this.campaignState = StorageSystem.saveCampaign({
      ...this.campaignState,
      cursorNodeId: this.cursorNodeId,
    });
    this.updateCursor();
  }

  updateCursor() {
    const node = this.getNode(this.cursorNodeId);
    if (this.playerIcon.x === 0 && this.playerIcon.y === 0) {
      this.playerIcon.setPosition(node.x, node.y - 18);
    } else {
      this.tweens.killTweensOf(this.playerIcon);
      this.tweens.add({
        targets: this.playerIcon,
        x: node.x,
        y: node.y - 18,
        duration: 240,
        ease: 'Sine.easeInOut',
      });
    }
    this.drawActiveRoute(node);
    this.updateActiveNodeMarker(node);
    const bestScore = this.campaignState.bestMissionScores[node.id] ?? 0;
    const status = this.campaignState.completedNodeIds.includes(node.id) ? 'SECURED' : 'AVAILABLE';
    const subtitle = NODE_SUBTITLES[node.id] ?? node.name.toUpperCase();
    const nodeStyle = this.getNodeStyle(node);
    this.infoText.setText([
      `NODE ${node.label} // ${subtitle} // ${status}`,
      `MISSION ${node.type.toUpperCase()}   TERRAIN ${node.terrain.toUpperCase()}   SECTOR ${nodeStyle.label}`,
      this.autopilot ? 'CONTROL MODE AUTOPILOT' : 'CONTROL MODE MANUAL',
      `WINDOW ${node.lengthSeconds}s   END ${node.endType.toUpperCase()}   BEST ${bestScore}`,
    ]);
  }

  drawActiveRoute(node) {
    this.activeRouteGraphics.clear();
    for (const nextNodeId of node.next ?? []) {
      const nextNode = this.getNode(nextNodeId);
      this.activeRouteGraphics.lineStyle(4, this.getRouteColor(node, nextNode), 0.42);
      this.activeRouteGraphics.lineBetween(node.x, node.y, nextNode.x, nextNode.y);
    }
  }

  updateActiveNodeMarker(activeNode) {
    for (const [nodeId, view] of this.nodeViews.entries()) {
      const isActive = nodeId === activeNode.id;
      const node = this.getNode(nodeId);
      const nodeStyle = this.getNodeStyle(node);

      view.activeHalo.setVisible(isActive);
      view.activePing.setVisible(isActive);
      view.activeCallout.setVisible(isActive);

      if (isActive) {
        view.ring.setStrokeStyle(4, nodeStyle.accentColor, 1);
        view.core.setRadius(view.base.coreRadius + 2);
        view.core.setAlpha(1);
        view.state.setText('ACTIVE');
        view.state.setColor('#f6e7a8');
        view.label.setColor('#ffffff');
        this.tweens.killTweensOf([view.activeHalo, view.activePing, view.activeCallout]);
        view.activeHalo.setAlpha(0.95).setScale(1);
        view.activePing.setAlpha(0.85).setScale(1);
        view.activeCallout.setAlpha(1);
        this.tweens.add({
          targets: view.activePing,
          alpha: 0,
          scale: 1.45,
          duration: 860,
          repeat: -1,
          ease: 'Sine.easeOut',
        });
        this.tweens.add({
          targets: view.activeCallout,
          y: node.y - 54,
          duration: 520,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      } else {
        this.tweens.killTweensOf([view.activeHalo, view.activePing, view.activeCallout]);
        view.activeHalo.setAlpha(0).setScale(1);
        view.activePing.setAlpha(0).setScale(1);
        view.activeCallout.setAlpha(1).setY(node.y - 50);
        view.ring.setStrokeStyle(
          view.base.ringStrokeWidth,
          view.base.ringStrokeColor,
          view.base.ringStrokeAlpha,
        );
        view.core.setRadius(view.base.coreRadius);
        view.core.setAlpha(view.base.coreAlpha);
        view.state.setText(view.base.stateText);
        view.state.setColor(view.base.stateColor);
        view.label.setColor(this.campaignState.unlockedNodeIds.includes(nodeId) ? '#d7e0df' : '#607174');
      }
    }
  }

  updateRoutePulses() {
    this.routePulseGraphics.clear();
    const completed = new Set(this.campaignState.completedNodeIds);
    for (const node of this.world.nodes) {
      for (const nextNodeId of node.next ?? []) {
        const nextNode = this.getNode(nextNodeId);
        const isActive = node.id === this.cursorNodeId;
        const isHistorical = completed.has(node.id);
        if (!isActive && !isHistorical) {
          continue;
        }

        const color = isActive ? this.getNodeStyle(node).accentColor : this.getRouteColor(node, nextNode);
        const t = isActive ? this.routePulseOffset : (this.routePulseOffset * 0.55) % 1;
        const x = Phaser.Math.Linear(node.x, nextNode.x, t);
        const y = Phaser.Math.Linear(node.y, nextNode.y, t);
        this.routePulseGraphics.fillStyle(color, isActive ? 0.72 : 0.28);
        this.routePulseGraphics.fillCircle(x, y, isActive ? 3 : 2);
      }
    }
  }

  updateWaterFx(time) {
    for (const shimmer of this.waterFx) {
      shimmer.setAlpha(shimmer.baseAlpha + Math.sin(time * 0.004 + shimmer.phase) * 0.08);
      shimmer.x += Math.sin(time * 0.0015 + shimmer.phase) * 0.02;
    }
  }

  updateRelayLights(time) {
    for (let index = 0; index < this.relayLights.length; index += 1) {
      const light = this.relayLights[index];
      light.setAlpha(0.22 + Math.max(0, Math.sin(time * 0.006 + index * 1.7)) * 0.58);
    }
  }

  deploySelectedNode() {
    const node = this.getNode(this.cursorNodeId);
    if (!this.campaignState.unlockedNodeIds.includes(node.id) || this.deploying) {
      return;
    }

    this.deploying = true;
    const nodeStyle = this.getNodeStyle(node);
    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x020608, 0)
      .setDepth(100);
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `DEPLOYING\n${node.label} // ${NODE_SUBTITLES[node.id] ?? node.name.toUpperCase()}\n${nodeStyle.label}`, {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '16px',
      color: '#d6f7ef',
      align: 'center',
      lineSpacing: 10,
    }).setOrigin(0.5).setAlpha(0).setDepth(101);
    this.tweens.add({
      targets: this.playerIcon,
      scale: 1.35,
      duration: 220,
      yoyo: true,
      repeat: 1,
    });
    this.tweens.add({
      targets: [overlay, text],
      alpha: 1,
      duration: 520,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        const briefingPayload = {
          missionId: node.id,
          worldId: this.world.id,
          autopilot: this.autopilot,
        };
        const mission = { ...node, worldId: this.world.id };
        const campaignState = StorageSystem.loadCampaign();
        const preDeploymentTransmissionId = TransmissionManager.getUnviewedPreDeploymentId(campaignState, mission);
        if (preDeploymentTransmissionId) {
          StorageSystem.saveCampaign(TransmissionManager.unlockPreDeployment(campaignState, mission));
          this.scene.start('TransmissionScene', {
            transmissionId: preDeploymentTransmissionId,
            nextSceneKey: 'BriefingScene',
            nextScenePayload: briefingPayload,
          });
          return;
        }

        this.scene.start('BriefingScene', briefingPayload);
      },
    });
  }
}
