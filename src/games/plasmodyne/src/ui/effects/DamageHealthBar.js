export class DamageHealthBar {
  constructor(scene, targetSprite, {
    max,
    before,
    after,
    width = 72,
    height = 7,
    yOffset = -48,
    depth = 1400
  }) {
    this.scene = scene;
    this.targetSprite = targetSprite;
    this.max = Math.max(1, max);
    this.beforeRatio = Phaser.Math.Clamp(before / this.max, 0, 1);
    this.afterRatio = Phaser.Math.Clamp(after / this.max, 0, 1);
    this.currentRatio = this.beforeRatio;
    this.damageRatio = this.beforeRatio;
    this.width = width;
    this.height = height;
    this.yOffset = yOffset;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(depth);
    this.graphics.setScrollFactor(1);
    this.startTime = scene.time.now;
    this.duration = 720;
    this.hold = 220;
    this.fade = 420;
    this.done = false;
    this.draw();
  }

  update(time) {
    if (this.done || !this.graphics?.active) {
      return;
    }

    const elapsed = time - this.startTime;
    if (elapsed > this.hold) {
      const t = Phaser.Math.Clamp((elapsed - this.hold) / this.duration, 0, 1);
      this.damageRatio = Phaser.Math.Linear(this.beforeRatio, this.afterRatio, Phaser.Math.Easing.Cubic.Out(t));
    }

    if (elapsed > this.hold + this.duration) {
      const fadeT = Phaser.Math.Clamp((elapsed - this.hold - this.duration) / this.fade, 0, 1);
      this.graphics.setAlpha(1 - fadeT);
      if (fadeT >= 1) {
        this.destroy();
        return;
      }
    }

    this.draw();
  }

  draw() {
    const x = this.targetSprite.x - this.width / 2;
    const y = this.targetSprite.y + this.yOffset;
    const healthWidth = this.width * this.afterRatio;
    const damageWidth = this.width * this.damageRatio;

    this.graphics.clear();
    this.graphics.fillStyle(0x020507, 0.86);
    this.graphics.fillRect(x - 2, y - 2, this.width + 4, this.height + 4);
    this.graphics.lineStyle(1, 0xd9f4ff, 0.72);
    this.graphics.strokeRect(x - 2, y - 2, this.width + 4, this.height + 4);
    this.graphics.fillStyle(0xff3b3b, 0.92);
    this.graphics.fillRect(x, y, damageWidth, this.height);
    this.graphics.fillStyle(this.afterRatio <= 0.3 ? 0xffd447 : 0x6fffc2, 0.98);
    this.graphics.fillRect(x, y, healthWidth, this.height);
  }

  destroy() {
    this.done = true;
    this.graphics?.destroy();
  }
}
