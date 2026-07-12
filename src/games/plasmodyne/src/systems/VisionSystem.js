import Phaser from 'phaser';

export class VisionSystem {
  constructor(scene, {
    coneRadians = Phaser.Math.DegToRad(105),
    sampleStep = 24
  } = {}) {
    this.scene = scene;
    this.coneRadians = coneRadians;
    this.sampleStep = sampleStep;
  }

  canSee(observer, target, range, facingAngle = 0) {
    const distance = Phaser.Math.Distance.Between(observer.x, observer.y, target.x, target.y);
    if (distance > range) {
      return false;
    }

    const targetAngle = Phaser.Math.Angle.Between(observer.x, observer.y, target.x, target.y);
    const delta = Math.abs(Phaser.Math.Angle.Wrap(targetAngle - facingAngle));
    if (delta > this.coneRadians / 2) {
      return false;
    }

    return !this.isBlocked(observer.x, observer.y, target.x, target.y, distance);
  }

  isBlocked(x1, y1, x2, y2, distance) {
    const steps = Math.max(1, Math.ceil(distance / this.sampleStep));
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const x = Phaser.Math.Linear(x1, x2, t);
      const y = Phaser.Math.Linear(y1, y2, t);
      if (!this.scene.mapSystem?.isWalkableAt(x, y) || this.scene.mapSystem?.isBlockedByClosedDoor(x, y, 2)) {
        return true;
      }
    }
    return false;
  }
}
