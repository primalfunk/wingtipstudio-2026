import Phaser from 'phaser';
import { getMissionNode } from '../data/campaignData.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../data/tuning.js';
import AudioSystem from '../systems/AudioSystem.js';
import LayoutSystem from '../systems/LayoutSystem.js';

export default class BriefingScene extends Phaser.Scene {
  constructor() {
    super('BriefingScene');
  }

  init(data = {}) {
    this.deploying = false;
    this.missionId = data.missionId ?? '1-1';
    this.worldId = data.worldId ?? 'world-1';
    this.autopilot = Boolean(data.autopilot);
    this.mission = getMissionNode(this.missionId, this.worldId);
  }

  create() {
    LayoutSystem.restartOnResize(this, {
      missionId: this.missionId,
      worldId: this.worldId,
      autopilot: this.autopilot,
    });
    const layout = LayoutSystem.screen(this);
    this.audioSystem = new AudioSystem(this);
    const titleY = Math.max(110, layout.height * 0.24);
    this.add.text(GAME_WIDTH / 2, titleY, 'BRIEFING', {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '24px',
      color: '#d6f7ef',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, titleY + 48, `${this.mission.label} // ${this.mission.name}`, {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '16px',
      color: '#f6e7a8',
    }).setOrigin(0.5);

    this.add.text(
      GAME_WIDTH / 2,
      titleY + Math.max(118, layout.height * 0.16),
      `${this.mission.briefing}\nTerrain: ${this.mission.terrain.toUpperCase()}\nControl: ${this.autopilot ? 'AUTOPILOT OBSERVER' : 'MANUAL DRIVER'}\nReach extraction before damage reaches critical.`,
      {
        fontFamily: 'Consolas, Courier, monospace',
        fontSize: layout.isNarrow ? '14px' : '16px',
        color: '#bac8c7',
        align: 'center',
        lineSpacing: 10,
      },
    ).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, layout.safe.bottom - Math.max(86, layout.height * 0.12), 'PRESS ENTER / CLICK TO DEPLOY', {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '15px',
      color: '#f6e7a8',
    }).setOrigin(0.5);

    this.input.keyboard.once('keydown-ENTER', () => this.deploy());
    this.input.once('pointerdown', () => this.deploy());
  }

  deploy() {
    if (this.deploying) {
      return;
    }

    this.deploying = true;
    this.audioSystem.playConfirm();
    this.scene.stop('GameScene');
    this.scene.start('GameScene', {
      autopilot: this.autopilot,
      aiControlled: this.autopilot,
      attract: false,
      harness: false,
      collisionTest: false,
      missionId: this.missionId,
      worldId: this.worldId,
    });
  }
}
