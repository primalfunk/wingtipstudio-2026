import Vehicle from './Vehicle.js';
import { DAMAGE } from '../data/tuning.js';
import { ROAD_CIVILIAN_TYPES } from '../data/civilianTypes.js';
import { pickNpcTint } from '../data/npcTints.js';

export default class CivilianVehicle extends Vehicle {
  constructor(scene, x, y, config = {}) {
    const civilianType = config.civilianType ?? ROAD_CIVILIAN_TYPES[0];
    const isCivilian = civilianType.kind !== 'obstacle';

    super(scene, x, y, civilianType.textureKey, {
      ...config,
      type: isCivilian ? 'civilian' : 'waterObstacle',
      faction: isCivilian ? 'civilian' : 'neutral',
      role: civilianType.kind,
      isCivilian,
      tint: config.tint ?? civilianType.tint ?? (civilianType.tintable ? pickNpcTint('civilian', config.tintIndex ?? 0) : null),
      damageOnCollision: DAMAGE.trafficCollision,
      bounce: 0.9,
      displayWidth: civilianType.displayWidth,
      displayHeight: civilianType.displayHeight,
      bodyWidth: civilianType.bodyWidth,
      bodyHeight: civilianType.bodyHeight,
    });

    this.civilianType = civilianType;
    this.scorePenalty = civilianType.scorePenalty;
    this.personality = config.personality ?? this.resolvePersonality(civilianType);
    this.targetX = config.targetX ?? x;
    this.laneCommitUntil = scene.time.now + this.getLaneCommitDuration();
    this.laneChangeSpeed = this.getLaneChangeSpeed();
    this.isAtmospheric = Boolean(config.atmospheric);
    if (this.isAtmospheric) {
      this.sprite.setAlpha(0.78);
      this.sprite.setDepth(9);
    }
  }

  resolvePersonality(civilianType) {
    if (civilianType.speedMultiplier && civilianType.speedMultiplier < 0.9) {
      return 'freight';
    }
    if (civilianType.id.includes('service') || civilianType.id.includes('utility') || civilianType.id.includes('maintenance')) {
      return 'service';
    }
    return 'commuter';
  }

  getLaneCommitDuration() {
    const durations = {
      aggressive: 900,
      commuter: 1800,
      cautious: 2400,
      freight: 3400,
      service: 2600,
    };
    return durations[this.personality] ?? 1800;
  }

  getLaneChangeSpeed() {
    const speeds = {
      aggressive: 72,
      commuter: 38,
      cautious: 24,
      freight: 16,
      service: 22,
    };
    return speeds[this.personality] ?? 34;
  }

  update() {
    if (this.scene.time.now < this.bounceUntil) {
      return;
    }

    const dx = this.targetX - this.sprite.x;
    const canDrift = this.scene.time.now >= this.laneCommitUntil
      && Math.abs(dx) > 5
      && !this.terrainExplosionPending
      && !this.leavingRoad;
    const xVelocity = canDrift ? Math.sign(dx) * this.laneChangeSpeed : 0;
    this.sprite.body.setVelocity(xVelocity, this.speed);
    if (canDrift && Math.abs(dx) < 8) {
      this.targetX = this.sprite.x;
    }
  }
}
