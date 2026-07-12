import Phaser from 'phaser';
import { getWorld } from '../data/campaignData.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../data/tuning.js';
import AudioSystem from '../systems/AudioSystem.js';
import StorageSystem from '../systems/StorageSystem.js';
import LayoutSystem from '../systems/LayoutSystem.js';

export default class VictoryScene extends Phaser.Scene {
  constructor() {
    super('VictoryScene');
  }

  create(data = {}) {
    LayoutSystem.restartOnResize(this, data);
    const layout = LayoutSystem.screen(this);
    this.audioSystem = new AudioSystem(this);
    this.audioSystem.stopDrivingMusic();
    this.audioSystem.playMainMenuMusic();
    this.records = StorageSystem.loadRecords();
    this.campaignState = StorageSystem.loadCampaign();
    this.world = getWorld(data.worldId ?? this.campaignState.currentWorldId);
    this.returning = false;

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05080a, 1);
    this.createSweepBackdrop();

    const titleY = layout.marginTop + 64;
    this.add.text(GAME_WIDTH / 2, titleY, 'OPERATION COMPLETE', {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '27px',
      color: '#f6e7a8',
    }).setOrigin(0.5).setDepth(20);

    this.add.text(GAME_WIDTH / 2, titleY + 44, `${this.world.label.toUpperCase()} SECURED`, {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '15px',
      color: '#d6f7ef',
    }).setOrigin(0.5).setDepth(20);

    this.createCompletionGrid();

    const totalScore = Object.values(this.campaignState.bestMissionScores ?? {})
      .reduce((sum, score) => sum + score, 0);
    const summary = [
      `FINAL SORTIE SCORE ${data.score ?? 0}`,
      `CAMPAIGN NODE SCORE ${totalScore}`,
      `HOSTILES DESTROYED ${data.enemiesDestroyed ?? 0}`,
      `RECORD SCORE ${this.records.bestScore}`,
      `RECORD DIST ${Math.floor(this.records.bestDistance)} MI`,
      `RUNS LOGGED ${this.records.totalRuns}`,
    ];
    this.add.text(GAME_WIDTH / 2, Math.min(layout.height - 260, titleY + Math.max(300, layout.height * 0.38)), summary.join('\n'), {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '15px',
      color: '#d7e0df',
      align: 'center',
      lineSpacing: 10,
    }).setOrigin(0.5).setDepth(20);

    this.add.text(GAME_WIDTH / 2, layout.safe.bottom - 96, 'NETWORK DISRUPTED // ROUTE CONTROL RESTORED', {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '12px',
      color: '#9ff0c1',
    }).setOrigin(0.5).setDepth(20);

    this.add.text(GAME_WIDTH / 2, layout.safe.bottom - 58, 'ENTER / CLICK: TITLE   R: REPLAY CAMPAIGN', {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '13px',
      color: '#f6e7a8',
    }).setOrigin(0.5).setDepth(20);

    this.input.keyboard.on('keydown-ENTER', this.returnToTitle, this);
    this.input.keyboard.on('keydown-R', this.replayCampaign, this);
    this.input.on('pointerdown', this.returnToTitle, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdownInputHandlers, this);
  }

  createSweepBackdrop() {
    for (let index = 0; index < 8; index += 1) {
      this.add.rectangle(GAME_WIDTH / 2, 54 + index * 72, GAME_WIDTH - 72, 1, 0x4eb6d6, 0.12)
        .setDepth(2);
    }
    for (let index = 0; index < 5; index += 1) {
      this.add.rectangle(58 + index * 92, GAME_HEIGHT / 2, 1, GAME_HEIGHT - 100, 0x4eb6d6, 0.08)
        .setDepth(2);
    }

    this.scanline = this.add.rectangle(GAME_WIDTH / 2, -10, GAME_WIDTH, 3, 0x9ee7f5, 0.18)
      .setDepth(4);
    this.tweens.add({
      targets: this.scanline,
      y: GAME_HEIGHT + 10,
      duration: 3200,
      repeat: -1,
      ease: 'Linear',
    });
  }

  createCompletionGrid() {
    const completed = new Set(this.campaignState.completedNodeIds);
    const startX = GAME_WIDTH / 2 - 114;
    const startY = 208;
    this.world.nodes.forEach((node, index) => {
      const x = startX + (index % 3) * 114;
      const y = startY + Math.floor(index / 3) * 54;
      const isComplete = completed.has(node.id);
      this.add.rectangle(x, y, 82, 34, isComplete ? 0x102f24 : 0x181f21, 0.94)
        .setStrokeStyle(1, isComplete ? 0x9ff0c1 : 0x516366, isComplete ? 0.95 : 0.5)
        .setDepth(10);
      this.add.text(x, y - 6, `NODE ${node.label}`, {
        fontFamily: 'Consolas, Courier, monospace',
        fontSize: '10px',
        color: isComplete ? '#d6f7ef' : '#607174',
      }).setOrigin(0.5).setDepth(11);
      this.add.text(x, y + 8, isComplete ? 'SECURED' : 'OPEN', {
        fontFamily: 'Consolas, Courier, monospace',
        fontSize: '8px',
        color: isComplete ? '#9ff0c1' : '#607174',
      }).setOrigin(0.5).setDepth(11);
    });
  }

  returnToTitle() {
    if (this.returning) {
      return;
    }
    this.returning = true;
    this.audioSystem.playConfirm();
    this.scene.start('TitleScene');
  }

  replayCampaign() {
    if (this.returning) {
      return;
    }
    this.returning = true;
    StorageSystem.resetCampaign();
    this.audioSystem.playConfirm();
    this.scene.start('OverworldScene');
  }

  shutdownInputHandlers() {
    this.input.keyboard.off('keydown-ENTER', this.returnToTitle, this);
    this.input.keyboard.off('keydown-R', this.replayCampaign, this);
    this.input.off('pointerdown', this.returnToTitle, this);
  }
}
