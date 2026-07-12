import { COMBAT } from '../data/tuning.js';

export default class Projectile {
  constructor(scene, x, y) {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, 'bullet');
    this.sprite.setDepth(18);
    this.sprite.setDisplaySize(7, 16);
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setVelocityY(-COMBAT.bulletSpeed);
    this.sprite.body.setSize(8, 18, true);
    this.damage = 1;
    this.sprite.projectile = this;
  }

  update() {
    this.sprite.body.setVelocityY(-COMBAT.bulletSpeed);
  }

  destroy() {
    this.sprite.destroy();
  }
}
