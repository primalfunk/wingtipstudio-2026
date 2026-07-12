import { uiTextStyle } from '../theme/Typography.js';
import { MENU_THEME } from '../theme/MenuTheme.js';
import Phaser from 'phaser';

const BUTTON_WIDTH = 360;
const BUTTON_HEIGHT = 58;

export class MenuPrompt {
  constructor(scene) {
    this.scene = scene;
    this.locked = false;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(20);
    this.container.setAlpha(0);

    this.button = scene.add.graphics();
    this.glint = scene.add.graphics();
    this.glint.setBlendMode(Phaser.BlendModes.ADD);
    this.command = scene.add.text(0, 0, 'INITIATE TRANSFER', uiTextStyle({
      fontFamily: '"Arbedo", "Grisha", "MoonRunner", "VakultaTrial", sans-serif',
      fontSize: '22px',
      color: '#aeb7bb',
      fontStyle: '900'
    })).setOrigin(0.5);
    this.command.setShadow(0, 0, '#080b0d', 8, true, true);

    this.container.add([this.button, this.glint, this.command]);
    this.drawButton(0.72);
  }

  drawButton(alpha = 0.72) {
    this.button.clear();
    this.button.fillStyle(0x070b0d, alpha);
    this.button.fillRoundedRect(-BUTTON_WIDTH / 2, -BUTTON_HEIGHT / 2, BUTTON_WIDTH, BUTTON_HEIGHT, 4);
    this.button.fillStyle(0x22292d, alpha * 0.98);
    this.button.fillRoundedRect(-BUTTON_WIDTH / 2 + 4, -BUTTON_HEIGHT / 2 + 4, BUTTON_WIDTH - 8, BUTTON_HEIGHT - 8, 3);
    this.button.fillStyle(0x596167, alpha * 0.34);
    this.button.fillRect(-BUTTON_WIDTH / 2 + 7, -BUTTON_HEIGHT / 2 + 6, BUTTON_WIDTH - 14, 14);
    this.button.fillStyle(0x0f1518, alpha * 0.36);
    this.button.fillRect(-BUTTON_WIDTH / 2 + 7, BUTTON_HEIGHT / 2 - 18, BUTTON_WIDTH - 14, 11);
    this.button.lineStyle(2, 0x8f989d, alpha);
    this.button.strokeRoundedRect(-BUTTON_WIDTH / 2, -BUTTON_HEIGHT / 2, BUTTON_WIDTH, BUTTON_HEIGHT, 4);
    this.button.lineStyle(1, 0xd7dde0, alpha * 0.58);
    this.button.lineBetween(-BUTTON_WIDTH / 2 + 18, -BUTTON_HEIGHT / 2 + 8, BUTTON_WIDTH / 2 - 18, -BUTTON_HEIGHT / 2 + 8);
    this.button.lineStyle(1, 0x05090b, alpha * 0.78);
    this.button.lineBetween(-BUTTON_WIDTH / 2 + 18, BUTTON_HEIGHT / 2 - 8, BUTTON_WIDTH / 2 - 18, BUTTON_HEIGHT / 2 - 8);
  }

  drawGlint(time, boost = false) {
    this.glint.clear();
    const cycle = 2600;
    const progress = ((time + 850) % cycle) / cycle;
    if (progress > 0.17) {
      return;
    }
    const t = progress / 0.17;
    const alpha = Math.sin(t * Math.PI) * (boost ? 0.7 : 0.48);
    const x = -BUTTON_WIDTH / 2 - 32 + t * (BUTTON_WIDTH + 64);
    this.glint.fillStyle(0xffffff, alpha);
    this.glint.fillPoints([
      { x: x - 3, y: -BUTTON_HEIGHT / 2 + 6 },
      { x: x + 6, y: -BUTTON_HEIGHT / 2 + 6 },
      { x: x - 3, y: BUTTON_HEIGHT / 2 - 6 },
      { x: x - 11, y: BUTTON_HEIGHT / 2 - 6 }
    ], true);
    this.glint.fillStyle(0xbfc8cc, alpha * 0.32);
    this.glint.fillRect(x - 21, -BUTTON_HEIGHT / 2 + 9, 4, BUTTON_HEIGHT - 18);
  }

  boot() {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      delay: 1550,
      duration: 520
    });
  }

  update(time, boost = false) {
    if (this.locked) {
      return;
    }
    const pulse = 0.5 + Math.sin(time * MENU_THEME.promptPulseSpeed) * 0.5;
    this.drawButton((boost ? 0.86 : 0.66) + pulse * 0.22);
    this.drawGlint(time, boost);
    this.command.setAlpha(0.78 + pulse * 0.2);
    this.command.setShadow(0, 0, '#d1d9dc', 4 + pulse * 7);
  }

  startLock() {
    this.locked = true;
    this.command.setText('SIGNAL LOCKED');
    this.container.setAlpha(1);
    this.drawButton(1);
    this.glint.clear();
    this.scene.tweens.add({
      targets: this.container,
      scale: 1.08,
      yoyo: true,
      repeat: 2,
      duration: 110
    });
  }

  setPosition(x, y) {
    this.container.setPosition(x, y);
  }

  destroy() {
    this.container.destroy(true);
  }
}
