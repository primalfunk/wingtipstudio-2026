import { ARCADE_UI } from './theme/ArcadeUiTheme.js';
import { DroidNumerals } from './fonts/DroidNumerals.js';

export class ScoreDisplay {
  constructor(scene) {
    this.scene = scene;
    this.score = 0;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(ARCADE_UI.z.alert - 100);
    this.backing = scene.add.rectangle(0, 0, 246, 62, ARCADE_UI.colors.dark, 0.88);
    this.backing.setOrigin(0, 0);
    this.backing.setStrokeStyle(2, ARCADE_UI.colors.cyan, 0.7);
    this.label = scene.add.text(0, 0, 'SCORE', {
      fontFamily: ARCADE_UI.fontFamily,
      fontSize: '14px',
      color: ARCADE_UI.colors.amber,
      fontStyle: '900'
    });
    this.value = new DroidNumerals(scene, 120, 40, '00000000', {
      size: 26,
      color: 0xffffff,
      shadowColor: 0x4f6f76,
      depth: ARCADE_UI.z.alert - 99,
      fitWidth: 206,
      fitHeight: 28,
      scrollFactor: 1
    });
    this.label.setPosition(10, 4);
    this.label.setShadow(0, 0, ARCADE_UI.glow.amber, 5, true, true);
    this.container.add([this.backing, this.label, this.value.container]);
    this.layout();
    this.scene.events.on('postupdate', this.layout, this);
  }

  setScore(score) {
    this.score = Math.max(0, Math.floor(score));
    this.value.setText(String(this.score).padStart(8, '0'));
  }

  add(points) {
    if (!points) {
      return;
    }
    this.setScore(this.score + points);
    this.scene.tweens.killTweensOf(this.value.container);
    this.value.container.setScale(1.12);
    this.value.setColor(0xffd36a, 0x604713);
    this.scene.tweens.add({
      targets: this.value.container,
      scale: 1,
      duration: 180,
      onComplete: () => this.value.setColor(0xffffff, 0x4f6f76)
    });
  }

  subtract(points) {
    if (!points) {
      return;
    }
    this.setScore(this.score - points);
    this.scene.tweens.killTweensOf(this.value.container);
    this.value.container.setScale(1.08);
    this.value.setColor(0xff6f61, 0x5c2320);
    this.scene.tweens.add({
      targets: this.value.container,
      scale: 1,
      duration: 160,
      onComplete: () => this.value.setColor(0xffffff, 0x4f6f76)
    });
  }

  layout() {
    const camera = this.scene.cameras?.main;
    if (!camera) {
      this.container.setPosition(24, 34);
      return;
    }
    const zoom = camera.zoom || 1;
    const worldPoint = camera.getWorldPoint(24, 34);
    this.container.setPosition(worldPoint.x, worldPoint.y);
    this.container.setScale(1 / zoom);
  }

  destroy() {
    this.scene.events.off('postupdate', this.layout, this);
    this.container.destroy(true);
  }
}
