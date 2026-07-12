export default class Vehicle {
  constructor(scene, x, y, texture, config = {}) {
    this.scene = scene;
    this.type = config.type ?? 'vehicle';
    this.faction = config.faction ?? 'neutral';
    this.role = config.role ?? 'traffic';
    this.lane = config.lane ?? 0;
    this.speed = config.speed ?? 160;
    this.health = config.health ?? 1;
    this.damageOnCollision = config.damageOnCollision ?? 10;
    this.isCivilian = Boolean(config.isCivilian);
    this.isHostile = Boolean(config.isHostile);
    this.isSupport = Boolean(config.isSupport);
    this.hiddenRole = config.hiddenRole ?? null;
    this.behaviorState = 'cruising';
    this.spawnTime = scene.time.now;
    this.bounceUntil = 0;

    this.sprite = scene.physics.add.sprite(x, y, texture);
    if (config.displayWidth && config.displayHeight) {
      this.sprite.setDisplaySize(config.displayWidth, config.displayHeight);
    }
    if (config.tint) {
      this.sprite.setTint(config.tint);
    }
    this.sprite.setDepth(config.depth ?? 12);
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setVelocityY(this.speed);
    this.sprite.body.setImmovable(Boolean(config.immovable));
    this.sprite.body.setBounce(config.bounce ?? 0.85, config.bounce ?? 0.85);
    this.sprite.body.setSize(config.bodyWidth ?? this.sprite.width - 4, config.bodyHeight ?? this.sprite.height - 5, true);
    this.sprite.vehicle = this;
  }

  update() {
    if (this.scene.time.now < this.bounceUntil) {
      return;
    }

    this.sprite.body.setVelocityY(this.speed);
  }

  destroy() {
    this.sprite.destroy();
  }
}
