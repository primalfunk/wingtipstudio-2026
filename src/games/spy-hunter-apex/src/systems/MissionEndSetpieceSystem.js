import { GAME_HEIGHT, GAME_WIDTH, ROAD } from '../data/tuning.js';

const END_CONFIG = {
  checkpoint: {
    label: 'CHECKPOINT',
    color: 0xb8a47a,
    accent: 0xf6e7a8,
    alert: 'CHECKPOINT APPROACH',
  },
  port: {
    label: 'PORT ENTRY',
    color: 0x75c6d8,
    accent: 0x9ee7f5,
    alert: 'PORT ENTRY',
  },
  fortress: {
    label: 'FORTRESS GATE',
    color: 0xe05c5c,
    accent: 0xf6e7a8,
    alert: 'FORTRESS GATE',
  },
  extraction: {
    label: 'EXTRACTION',
    color: 0x8fcdda,
    accent: 0xd7eef2,
    alert: 'EXTRACTION POINT',
  },
};

export default class MissionEndSetpieceSystem {
  constructor(scene, missionState, mission) {
    this.scene = scene;
    this.missionState = missionState;
    this.mission = mission;
    this.spawned = false;
    this.announced = false;
    this.completed = false;
    this.container = scene.add.container(GAME_WIDTH / 2, -190)
      .setDepth(19)
      .setVisible(false);
  }

  update(delta) {
    if (this.completed || this.missionState.isGameOver || !this.mission?.lengthSeconds) {
      return;
    }

    const remaining = this.mission.lengthSeconds - this.missionState.elapsedTime;
    if (!this.spawned && remaining <= 4.5) {
      this.spawn();
    }

    if (!this.spawned) {
      return;
    }

    const scrollDelta = (ROAD.scrollSpeed * delta) / 1000;
    this.container.y += scrollDelta * 1.02;
    const alpha = Math.min(1, Math.max(0.35, 1 - Math.abs(this.container.y - 160) / 760));
    this.container.setAlpha(alpha);
  }

  spawn() {
    this.spawned = true;
    this.container.setVisible(true);
    this.container.removeAll(true);
    const config = this.getConfig();
    this.drawApproach(config);
    if (!this.scene.isAttract && !this.announced) {
      this.announced = true;
      this.scene.hud?.flashAlert(`${config.alert}: Hold route.`);
    }
  }

  complete() {
    this.completed = true;
    if (!this.spawned) {
      this.spawn();
    }
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      y: this.container.y + 80,
      duration: 550,
      ease: 'Sine.easeIn',
      onComplete: () => this.container.destroy(),
    });
  }

  getConfig() {
    return END_CONFIG[this.mission.endType] ?? END_CONFIG.extraction;
  }

  drawApproach(config) {
    this.container.add(this.scene.add.rectangle(0, 0, GAME_WIDTH + 80, 42, 0x000000, 0.3));
    this.drawFinishLine(config);
    this.container.add(this.scene.add.rectangle(0, -48, ROAD.right - ROAD.left + 96, 10, config.color, 0.52));
    this.container.add(this.scene.add.rectangle(0, -36, ROAD.right - ROAD.left + 76, 3, config.accent, 0.38));
    this.container.add(this.scene.add.rectangle(-ROAD.right / 2 - 10, 8, 18, 108, config.color, 0.58));
    this.container.add(this.scene.add.rectangle(ROAD.right / 2 + 10, 8, 18, 108, config.color, 0.58));
    this.container.add(this.scene.add.rectangle(0, 36, ROAD.right - ROAD.left + 30, 26, 0x000000, 0.18));
    this.container.add(this.scene.add.text(0, -48, config.label, {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '13px',
      color: `#${config.accent.toString(16).padStart(6, '0')}`,
      letterSpacing: 0,
    }).setOrigin(0.5));

    const lowerColor = this.mission.endType === 'port' ? 0x123847 : 0x11191d;
    this.container.add(this.scene.add.rectangle(0, 84, ROAD.right - ROAD.left + 58, 48, lowerColor, 0.32));

    if (this.mission.endType === 'fortress') {
      this.drawFortressDetails(config);
      return;
    }
    if (this.mission.endType === 'port') {
      this.drawPortDetails(config);
      return;
    }
    this.drawCheckpointDetails(config);
  }

  drawFinishLine(config) {
    const lineY = 4;
    const tileSize = 12;
    const roadWidth = ROAD.right - ROAD.left;
    const columns = Math.ceil(roadWidth / tileSize);
    const startX = -roadWidth / 2;

    this.container.add(this.scene.add.rectangle(0, lineY, roadWidth + 18, 34, 0x050708, 0.72)
      .setStrokeStyle(1, config.accent, 0.72));

    for (let row = 0; row < 2; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const isLight = (row + column) % 2 === 0;
        const x = startX + column * tileSize + tileSize / 2;
        const y = lineY - 6 + row * tileSize;
        this.container.add(this.scene.add.rectangle(
          x,
          y,
          tileSize,
          tileSize,
          isLight ? 0xf2f6ef : 0x11191d,
          isLight ? 0.95 : 0.98,
        ));
      }
    }

    this.container.add(this.scene.add.rectangle(0, lineY - 23, roadWidth + 30, 4, config.accent, 0.88));
    this.container.add(this.scene.add.rectangle(0, lineY + 23, roadWidth + 30, 4, config.accent, 0.88));
  }

  drawCheckpointDetails(config) {
    const edgeOffset = (ROAD.right - ROAD.left) / 2 + 24;
    [-edgeOffset, edgeOffset].forEach((x) => {
      this.container.add(this.scene.add.circle(x, -64, 9, config.accent, 0.22));
      this.container.add(this.scene.add.rectangle(x, -24, 7, 70, config.color, 0.48));
      this.container.add(this.scene.add.rectangle(x, 18, 52, 9, config.color, 0.28));
    });
    for (let index = 0; index < 4; index += 1) {
      const x = -96 + index * 64;
      this.container.add(this.scene.add.rectangle(x, 64, 34, 6, config.accent, 0.18));
    }
  }

  drawPortDetails(config) {
    const edgeOffset = (ROAD.right - ROAD.left) / 2 + 24;
    [-edgeOffset - 18, -edgeOffset + 6, edgeOffset - 6, edgeOffset + 18].forEach((x) => {
      this.container.add(this.scene.add.rectangle(x, 20, 8, 116, config.color, 0.42));
      this.container.add(this.scene.add.rectangle(x, -42, 20, 5, config.accent, 0.24));
    });
    for (let index = 0; index < 5; index += 1) {
      this.container.add(this.scene.add.rectangle(-72 + index * 36, 84 + (index % 2) * 8, 42, 2, config.accent, 0.13));
    }
  }

  drawFortressDetails(config) {
    const edgeOffset = (ROAD.right - ROAD.left) / 2 + 34;
    [-edgeOffset, edgeOffset].forEach((x) => {
      this.container.add(this.scene.add.rectangle(x, -10, 34, 126, 0x3a2020, 0.68).setStrokeStyle(1, config.color, 0.32));
      this.container.add(this.scene.add.circle(x, -76, 8, config.accent, 0.24));
      this.container.add(this.scene.add.rectangle(x, -54, 52, 4, config.color, 0.28));
    });
    this.container.add(this.scene.add.rectangle(0, 70, ROAD.right - ROAD.left + 42, 8, config.color, 0.26));
    this.container.add(this.scene.add.rectangle(0, 86, ROAD.right - ROAD.left + 12, 5, config.accent, 0.16));
  }
}
