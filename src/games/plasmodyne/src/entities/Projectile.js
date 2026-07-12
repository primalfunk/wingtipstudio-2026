import Phaser from 'phaser';

export class Projectile {
  constructor(scene, config) {
    this.scene = scene;
    this.owner = config.owner;
    this.killerDisplayId = config.killerDisplayId ?? null;
    this.damage = config.damage;
    this.range = config.range;
    this.distanceTraveled = 0;
    this.previous = { x: config.x, y: config.y };
    this.radius = config.radius;
    this.color = config.color;
    this.angle = config.angle;
    this.speed = config.speed;

    this.glow = scene.add.circle(config.x, config.y, config.radius * 2.4, config.color, 0.2);
    this.glow.setDepth(19);
    this.sprite = scene.add.circle(config.x, config.y, config.radius, config.color, 1);
    this.sprite.setStrokeStyle(Math.max(1, config.radius * 0.32), 0xffffff, 0.72);
    scene.physics.add.existing(this.sprite);
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setCircle(config.radius);
    this.sprite.setDepth(20);
    this.sprite.setData('projectile', this);
  }

  launch() {
    const speed = Number.isFinite(this.speed) && this.speed > 0 ? this.speed : 1;
    this.sprite.body?.setVelocity(Math.cos(this.angle) * speed, Math.sin(this.angle) * speed);
  }

  update() {
    const dx = this.sprite.x - this.previous.x;
    const dy = this.sprite.y - this.previous.y;
    this.distanceTraveled += Math.hypot(dx, dy);
    this.previous.x = this.sprite.x;
    this.previous.y = this.sprite.y;
    this.glow?.setPosition(this.sprite.x, this.sprite.y);

    if (this.distanceTraveled >= this.range) {
      this.destroy();
    }
  }

  destroy() {
    if (this.glow?.active) {
      this.glow.destroy();
    }
    if (this.sprite?.active) {
      this.sprite.destroy();
    }
  }
}
