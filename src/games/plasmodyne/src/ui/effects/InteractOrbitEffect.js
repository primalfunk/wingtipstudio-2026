export class InteractOrbitEffect {
  constructor(scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(35);
    this.graphics.setVisible(false);
    this.target = null;
    this.state = 'none';
  }

  show() {
    this.graphics.setVisible(true);
  }

  hide() {
    this.graphics.clear();
    this.graphics.setVisible(false);
    this.target = null;
    this.state = 'none';
  }

  update(playerSprite, target = null, time = 0) {
    if (!this.graphics.visible || !playerSprite) {
      return;
    }
    this.target = target;
    this.state = target ? 'valid' : 'none';
    const color = target ? 0x79f2ff : 0x6f8794;
    const alpha = target ? 0.95 : 0.42;
    const radius = target ? 58 : 50;
    const spin = time / 220;

    this.graphics.clear();
    this.graphics.lineStyle(2, color, alpha);
    this.graphics.strokeCircle(playerSprite.x, playerSprite.y, radius);
    this.graphics.lineStyle(3, color, alpha);
    this.drawArc(playerSprite.x, playerSprite.y, radius + 8, spin, spin + 1.15);
    this.drawArc(playerSprite.x, playerSprite.y, radius + 8, spin + Math.PI, spin + Math.PI + 0.72);

    for (let i = 0; i < 3; i += 1) {
      const angle = spin * 1.4 + i * ((Math.PI * 2) / 3);
      this.graphics.fillStyle(color, alpha);
      this.graphics.fillCircle(playerSprite.x + Math.cos(angle) * (radius + 13), playerSprite.y + Math.sin(angle) * (radius + 13), target ? 4 : 3);
    }

    if (target?.x !== undefined && target?.y !== undefined) {
      this.graphics.lineStyle(1, color, 0.68);
      this.graphics.lineBetween(playerSprite.x, playerSprite.y, target.x, target.y);
      this.graphics.strokeCircle(target.x, target.y, target.radius ?? 36);
    }
  }

  drawArc(x, y, radius, start, end) {
    const points = [];
    const steps = 18;
    for (let i = 0; i <= steps; i += 1) {
      const t = start + (end - start) * (i / steps);
      points.push({ x: x + Math.cos(t) * radius, y: y + Math.sin(t) * radius });
    }
    this.graphics.strokePoints(points, false);
  }

  destroy() {
    this.graphics.destroy();
  }
}
