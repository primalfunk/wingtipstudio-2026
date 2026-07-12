import { MENU_THEME } from '../theme/MenuTheme.js';

export class MainMenuAttractLayer {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(5);
    this.scanlineGraphics = scene.add.graphics();
    this.container.add(this.scanlineGraphics);
    this.bursting = false;
  }

  boot() {
    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: MENU_THEME.bootDuration,
      ease: 'Cubic.easeOut'
    });
  }

  startConfirm(onComplete) {
    this.bursting = true;
    this.scene.time.delayedCall(460, onComplete);
  }

  update(time) {
    this.drawScanlines(time);
  }

  reflow() {}

  drawScanlines(time) {
    const { width, height } = this.scene.scale;
    const offset = Math.floor(time * 0.018) % 10;
    this.scanlineGraphics.clear();
    this.scanlineGraphics.lineStyle(1, 0x8defff, MENU_THEME.scanlineAlpha);
    for (let y = offset; y < height; y += 10) {
      this.scanlineGraphics.lineBetween(0, y, width, y);
    }
  }

  destroy() {
    this.container.destroy(true);
  }
}
