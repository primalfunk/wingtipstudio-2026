import { uiTextStyle } from '../theme/Typography.js';
import { UI_THEME } from '../UiTheme.js';
import { drawTutorialIcon } from './TutorialIcons.js';

export class ControlTipPanel {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(1300);
    this.container.setScrollFactor(0);
    this.container.setAlpha(0);
    this.background = scene.add.graphics();
    this.icons = scene.add.graphics();
    this.title = scene.add.text(0, 0, '', uiTextStyle({
      fontSize: '16px',
      color: '#d9f4ff'
    })).setOrigin(0, 0);
    this.lines = scene.add.text(0, 0, '', uiTextStyle({
      fontSize: '12px',
      color: '#8ff0ff',
      lineSpacing: 5
    })).setOrigin(0, 0);
    this.container.add([this.background, this.icons, this.title, this.lines]);
    this.reflow();
  }

  show(tip) {
    this.tip = tip;
    this.title.setText(tip.title);
    this.lines.setText(tip.lines.join('\n'));
    this.draw();
    this.scene.tweens.killTweensOf(this.container);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 260 });
  }

  hide(onComplete = null) {
    this.scene.tweens.killTweensOf(this.container);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 420,
      onComplete
    });
  }

  draw() {
    const width = 360;
    const height = 118;
    this.background.clear();
    this.background.fillStyle(UI_THEME.panelDark, 0.82);
    this.background.fillRoundedRect(0, 0, width, height, 6);
    this.background.lineStyle(1, UI_THEME.primaryAccent, 0.58);
    this.background.strokeRoundedRect(0, 0, width, height, 6);
    this.background.lineStyle(1, UI_THEME.warningAccent, 0.34);
    this.background.lineBetween(18, height - 18, width - 18, height - 18);

    this.icons.clear();
    const icons = this.tip?.iconIds ?? [];
    icons.forEach((id, index) => drawTutorialIcon(this.icons, id, 34 + index * 42, 34, 26));
    this.title.setPosition(18, 66);
    this.lines.setPosition(154, 18);
  }

  reflow() {
    const { width, height } = this.scene.scale;
    this.container.setPosition(width - 392, height - 154);
  }

  destroy() {
    this.container.destroy(true);
  }
}
