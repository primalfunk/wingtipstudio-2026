import { PLAYER, PLAYER_MODES } from '../data/tuning.js';

export default class PlayerCar {
  constructor(scene, x, y) {
    this.scene = scene;
    this.mode = 'car';
    const profile = PLAYER_MODES.car;
    this.sprite = scene.physics.add.sprite(x, y, profile.textureKey);
    this.sprite.setDisplaySize(profile.displayWidth, profile.displayHeight);
    this.sprite.setCollideWorldBounds(false);
    this.sprite.setDepth(20);
    this.sprite.body.setSize(profile.bodyWidth, profile.bodyHeight, true);
    this.sprite.body.setMaxVelocity(profile.maxSpeedX, profile.maxSpeedY);
    this.sprite.body.setBounce(PLAYER.bounce, PLAYER.bounce);
    this.sprite.body.setCollideWorldBounds(false);
    this.bounceUntil = 0;
  }

  setMode(mode) {
    const profile = PLAYER_MODES[mode] ?? PLAYER_MODES.car;
    this.mode = mode;
    this.sprite.setTexture(profile.textureKey);
    this.sprite.setDisplaySize(profile.displayWidth, profile.displayHeight);
    this.sprite.setAngle(0);
    this.sprite.body.setSize(profile.bodyWidth, profile.bodyHeight, true);
    this.sprite.body.setMaxVelocity(profile.maxSpeedX, profile.maxSpeedY);
  }

  update(input) {
    if (this.scene.time.now < this.bounceUntil) {
      return;
    }

    const body = this.sprite.body;
    const profile = PLAYER_MODES[this.mode] ?? PLAYER_MODES.car;
    const maxSpeedX = profile.maxSpeedX;
    const maxSpeedY = profile.maxSpeedY;
    const magnitude = Math.hypot(input.x, input.y) || 1;
    body.setAcceleration(0, 0);
    body.setVelocity(
      (input.x / magnitude) * maxSpeedX,
      (input.y / magnitude) * maxSpeedY,
    );
  }
}
