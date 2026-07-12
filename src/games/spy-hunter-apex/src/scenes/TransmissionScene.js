import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../data/tuning.js';
import { getTransmission } from '../data/transmissionData.js';
import AudioSystem from '../systems/AudioSystem.js';
import LayoutSystem from '../systems/LayoutSystem.js';
import StorageSystem from '../systems/StorageSystem.js';
import TransmissionManager from '../systems/TransmissionManager.js';
import TypewriterTextRenderer from '../ui/TypewriterTextRenderer.js';

export default class TransmissionScene extends Phaser.Scene {
  constructor() {
    super('TransmissionScene');
  }

  create(data = {}) {
    LayoutSystem.restartOnResize(this, data);
    this.audioSystem = new AudioSystem(this);
    this.audioSystem.stopDrivingMusic();
    this.transmissionId = data.transmissionId ?? 'world-1-after-1-1';
    this.remainingTransmissionIds = data.remainingTransmissionIds ?? [];
    this.nextSceneKey = data.nextSceneKey ?? 'OverworldScene';
    this.nextScenePayload = data.nextScenePayload ?? {};
    this.transmission = getTransmission(this.transmissionId) ?? getTransmission('world-1-after-1-1');
    this.proceeding = false;

    const layout = LayoutSystem.screen(this);
    this.drawAtmosphere(layout);
    this.drawPanel(layout);
    this.startSignalFx(layout);

    this.input.keyboard.on('keydown-ENTER', this.proceed, this);
    this.input.on('pointerdown', this.proceed, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdownScene, this);
  }

  drawAtmosphere(layout) {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x07090b, 1);
    const grid = this.add.graphics().setDepth(1);
    grid.lineStyle(1, 0x14332f, 0.22);
    const spacing = layout.isNarrow ? 38 : 46;
    for (let x = layout.safe.left; x < layout.safe.right; x += spacing) {
      grid.lineBetween(x, layout.safe.top, x, layout.safe.bottom);
    }
    for (let y = layout.safe.top; y < layout.safe.bottom; y += spacing) {
      grid.lineBetween(layout.safe.left, y, layout.safe.right, y);
    }

    this.scanlines = this.add.graphics().setDepth(8);
    this.drawScanlines(layout, 0);
    this.time.addEvent({
      delay: 90,
      loop: true,
      callback: () => {
        this.scanlineOffset = ((this.scanlineOffset ?? 0) + 1) % 8;
        this.drawScanlines(layout, this.scanlineOffset);
      },
    });
  }

  drawPanel(layout) {
    const panelWidth = Math.min(layout.contentWidth, Math.max(300, layout.width * (layout.isWide ? 0.48 : 0.72)));
    const panelHeight = Math.min(layout.height - layout.marginTop * 2, Math.max(330, layout.height * (layout.isNarrow ? 0.55 : 0.5)));
    const panelX = layout.centerX - panelWidth / 2;
    const panelY = layout.centerY - panelHeight / 2;
    const frame = this.add.graphics().setDepth(3);
    frame.fillStyle(0x0d1415, 0.92);
    frame.fillRect(panelX, panelY, panelWidth, panelHeight);
    frame.lineStyle(2, 0x86d7c8, 0.78);
    frame.strokeRect(panelX, panelY, panelWidth, panelHeight);
    frame.lineStyle(1, 0xf6e7a8, 0.45);
    frame.lineBetween(panelX + 18, panelY + 54, panelX + panelWidth - 18, panelY + 54);
    frame.lineBetween(panelX + 18, panelY + panelHeight - 58, panelX + panelWidth - 18, panelY + panelHeight - 58);

    const cornerLength = Math.min(42, panelWidth * 0.1);
    frame.lineStyle(3, 0xf6e7a8, 0.55);
    frame.lineBetween(panelX, panelY, panelX + cornerLength, panelY);
    frame.lineBetween(panelX, panelY, panelX, panelY + cornerLength);
    frame.lineBetween(panelX + panelWidth, panelY, panelX + panelWidth - cornerLength, panelY);
    frame.lineBetween(panelX + panelWidth, panelY, panelX + panelWidth, panelY + cornerLength);
    frame.lineBetween(panelX, panelY + panelHeight, panelX + cornerLength, panelY + panelHeight);
    frame.lineBetween(panelX, panelY + panelHeight, panelX, panelY + panelHeight - cornerLength);
    frame.lineBetween(panelX + panelWidth, panelY + panelHeight, panelX + panelWidth - cornerLength, panelY + panelHeight);
    frame.lineBetween(panelX + panelWidth, panelY + panelHeight, panelX + panelWidth, panelY + panelHeight - cornerLength);

    this.headingText = this.add.text(layout.centerX, panelY + 30, this.transmission.heading, {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: layout.isNarrow ? '18px' : '22px',
      color: '#d6f7ef',
      letterSpacing: 0,
    }).setOrigin(0.5).setDepth(4);

    this.add.text(layout.centerX, panelY + 79, `TX ${this.transmission.id.toUpperCase()}`, {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: layout.isNarrow ? '11px' : '12px',
      color: '#6fa89f',
    }).setOrigin(0.5).setDepth(4);

    const bodyWidth = panelWidth - Math.max(42, panelWidth * 0.13);
    const bodyFontSize = layout.isNarrow ? '14px' : '16px';
    this.bodyText = this.add.text(layout.centerX, panelY + panelHeight * 0.36, '', {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: bodyFontSize,
      color: '#d7e0df',
      align: 'center',
      lineSpacing: layout.isNarrow ? 9 : 12,
      wordWrap: { width: bodyWidth },
    }).setOrigin(0.5, 0).setDepth(4);

    this.promptText = this.add.text(layout.centerX, panelY + panelHeight - 31, 'PRESS ENTER / CLICK', {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: layout.isNarrow ? '13px' : '15px',
      color: '#f6e7a8',
    }).setOrigin(0.5).setDepth(4).setAlpha(0);

    this.typewriter = new TypewriterTextRenderer(this, this.bodyText, this.transmission.lines, {
      delayMs: layout.isNarrow ? 15 : 17,
      tick: (index) => {
        if (index % 5 === 0) {
          this.audioSystem.playTone(880 + (index % 3) * 80, 0.018, 'square', 0.012);
        }
      },
    });
    this.typewriter.start();
    this.time.delayedCall(Math.min(1600, this.transmission.lines.join('').length * 20 + 350), () => {
      this.tweens.add({
        targets: this.promptText,
        alpha: 1,
        duration: 220,
      });
    });
  }

  startSignalFx(layout) {
    this.audioSystem.playTone(140, 0.16, 'sawtooth', 0.02);
    this.time.delayedCall(120, () => this.audioSystem.playTone(520, 0.045, 'triangle', 0.026));
    this.flickerTween = this.tweens.add({
      targets: this.headingText,
      alpha: { from: 0.72, to: 1 },
      duration: 95,
      yoyo: true,
      repeat: 5,
      ease: 'Stepped',
    });

    this.sweep = this.add.graphics().setDepth(2);
    this.sweepX = layout.safe.left;
    this.sweepTimer = this.time.addEvent({
      delay: 40,
      loop: true,
      callback: () => {
        this.sweepX += Math.max(12, layout.width * 0.012);
        if (this.sweepX > layout.safe.right) {
          this.sweepX = layout.safe.left;
        }
        this.sweep.clear();
        this.sweep.lineStyle(1, 0x86d7c8, 0.18);
        this.sweep.lineBetween(this.sweepX, layout.safe.top, this.sweepX, layout.safe.bottom);
      },
    });
  }

  drawScanlines(layout, offset) {
    this.scanlines.clear();
    this.scanlines.lineStyle(1, 0xffffff, 0.035);
    for (let y = layout.safe.top + offset; y < layout.safe.bottom; y += 8) {
      this.scanlines.lineBetween(layout.safe.left, y, layout.safe.right, y);
    }
  }

  proceed() {
    if (this.proceeding) {
      return;
    }

    if (!this.typewriter.complete) {
      this.typewriter.skip();
      this.promptText.setAlpha(1);
      this.audioSystem.playTone(620, 0.04, 'triangle', 0.028);
      return;
    }

    this.proceeding = true;
    this.audioSystem.playConfirm();
    const campaignState = StorageSystem.loadCampaign();
    StorageSystem.saveCampaign(TransmissionManager.markViewed(campaignState, this.transmission.id));
    const [nextTransmissionId, ...remainingTransmissionIds] = this.remainingTransmissionIds;
    if (nextTransmissionId && TransmissionManager.hasTransmission(nextTransmissionId)) {
      this.scene.start('TransmissionScene', {
        transmissionId: nextTransmissionId,
        remainingTransmissionIds,
        nextSceneKey: this.nextSceneKey,
        nextScenePayload: this.nextScenePayload,
      });
      return;
    }

    this.scene.start(this.nextSceneKey, this.nextScenePayload);
  }

  shutdownScene() {
    this.typewriter?.destroy();
    this.input.keyboard.off('keydown-ENTER', this.proceed, this);
    this.input.off('pointerdown', this.proceed, this);
  }
}
