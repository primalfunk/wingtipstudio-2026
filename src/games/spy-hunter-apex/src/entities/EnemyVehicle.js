import Phaser from 'phaser';
import Vehicle from './Vehicle.js';
import { DAMAGE, ROAD } from '../data/tuning.js';
import { ENEMY_TYPE_BY_ID, ENEMY_TYPES } from '../data/enemyTypes.js';

function getDefaultEnemyHealth(enemyType) {
  if (enemyType.chassis === 'motorcycle') {
    return 0.5;
  }
  if (enemyType.role === 'blocker' || enemyType.role === 'coordinator') {
    return 4;
  }
  if (enemyType.weaponStyle && enemyType.weaponStyle !== 'none') {
    return 2;
  }
  if (enemyType.role === 'bruiser' || enemyType.role === 'rammer') {
    return 2;
  }
  return 2;
}

export default class EnemyVehicle extends Vehicle {
  constructor(scene, x, y, config = {}) {
    const enemyType = config.enemyType
      ?? ENEMY_TYPE_BY_ID[config.enemyTypeId]
      ?? ENEMY_TYPES[0];
    const bodyWidth = Math.max(10, Math.round(enemyType.displayWidth * 0.64));
    const bodyHeight = Math.max(24, Math.round(enemyType.displayHeight * 0.88));

    super(scene, x, y, enemyType.textureKey, {
      ...config,
      type: 'enemy',
      faction: 'hostile',
      role: enemyType.role,
      isHostile: true,
      damageOnCollision: DAMAGE.enemyCollision,
      bounce: 0.95,
      health: enemyType.health ?? getDefaultEnemyHealth(enemyType),
      displayWidth: enemyType.displayWidth,
      displayHeight: enemyType.displayHeight,
      bodyWidth,
      bodyHeight,
    });

    this.enemyType = enemyType;
    this.scoreValue = enemyType.score;
    this.spawnStyle = enemyType.spawnStyle ?? 'front';
    this.movementStyle = enemyType.movementStyle ?? 'drift_down';
    this.weaponStyle = enemyType.weaponStyle ?? 'none';
    this.behaviorRole = config.behaviorRole ?? null;
    this.behaviorProfile = config.behaviorProfile ?? {};
    this.fireCooldownMs = Math.round((enemyType.fireCooldownMs ?? 1600) * (this.behaviorProfile.fireCooldownScale ?? 1));
    this.lastFireAt = scene.time.now + Phaser.Math.Between(120, 520);
    this.targetX = config.targetX ?? x;
    this.spawnedFrom = this.spawnStyle;
    this.driftDirection = Phaser.Math.Between(0, 1) === 0 ? -1 : 1;
    this.driftSpeed = enemyType.chassis === 'motorcycle' || enemyType.chassis === 'boat'
      ? Phaser.Math.Between(44, 72)
      : Phaser.Math.Between(24, 52);
    this.aggression = (enemyType.aggression ?? this.getDefaultAggression(enemyType)) * (config.aggressionScale ?? 1);
    this.lateralSpeed = this.driftSpeed * (1.2 + this.aggression * 0.9) * (this.behaviorProfile.lateralScale ?? 1);
    this.commitRangeY = enemyType.commitRangeY ?? 460;
    this.laneCommitUntil = scene.time.now + (this.behaviorProfile.laneCommitMs ?? 900);
    this.behaviorBurstUntil = scene.time.now + (this.behaviorProfile.burstMs ?? 1500);
    this.nextBehaviorBurstAt = this.behaviorBurstUntil + (this.behaviorProfile.restMs ?? 900);
    this.weaveSeed = Phaser.Math.FloatBetween(0, Math.PI * 2);
  }

  update(player = null) {
    if (this.scene.time.now < this.bounceUntil) {
      return;
    }

    const halfWidth = this.sprite.displayWidth / 2;
    let minX = ROAD.left + halfWidth + 8;
    let maxX = ROAD.right - halfWidth - 8;
    const median = this.scene.roadSystem?.getMedianHazards?.()[0];
    if (median) {
      if (this.targetX < (median.left + median.right) / 2) {
        maxX = median.left - halfWidth - 8;
      } else {
        minX = median.right + halfWidth + 8;
      }
    }

    if (this.movementStyle === 'rear_chase') {
      this.updateRearChase(player, minX, maxX);
      return;
    }

    if (this.movementStyle === 'side_merge') {
      this.updateSideMerge(player, minX, maxX);
      return;
    }

    if (this.movementStyle === 'evade_escape') {
      this.updateEvadeEscape(player, minX, maxX);
      return;
    }

    if (this.movementStyle === 'lane_hold' || this.movementStyle === 'mine_layer') {
      this.updateLaneHold(player, minX, maxX);
      return;
    }

    this.updateAggressiveDrift(player, minX, maxX);
  }

  updateRearChase(player, minX, maxX) {
    const role = this.getBehaviorRole();
    const burstActive = this.isAggressionBurstActive();
    const desiredX = player?.sprite.x ?? this.targetX;
    const dx = Phaser.Math.Clamp(desiredX - this.sprite.x, -1, 1);
    const roleLateralScale = role === 'rammer' && burstActive ? 1.45 : role === 'scout' ? 1.18 : 1;
    const xVelocity = Math.abs(desiredX - this.sprite.x) < 6 ? 0 : dx * Math.max(105, this.lateralSpeed * 1.35 * roleLateralScale);
    const distanceBehind = this.sprite.y - (player?.sprite.y ?? 520);
    const chargeScale = role === 'rammer' && burstActive ? 1.18 : 1;
    const yVelocity = distanceBehind > 70
      ? -Math.max(235, (this.speed + 35) * chargeScale)
      : -Math.max(130, this.speed * (role === 'rammer' ? 0.8 : 0.72));
    this.sprite.body.setVelocity(xVelocity, yVelocity);
    this.sprite.x = Phaser.Math.Clamp(this.sprite.x, minX, maxX);
  }

  updateSideMerge(player, minX, maxX) {
    const desiredX = this.getAggressiveTargetX(player, minX, maxX, 0.95);
    const dx = Phaser.Math.Clamp(desiredX - this.sprite.x, -1, 1);
    const xVelocity = Math.abs(desiredX - this.sprite.x) < 8 ? 0 : dx * Math.max(112, this.lateralSpeed);
    this.sprite.body.setVelocity(xVelocity, this.speed * 0.88);
    this.sprite.x = Phaser.Math.Clamp(this.sprite.x, minX - 44, maxX + 44);
    if (Math.abs(desiredX - this.sprite.x) < 10) {
      this.targetX = desiredX;
      this.movementStyle = this.weaponStyle === 'none' ? 'drift_down' : 'lane_hold';
    }
  }

  updateEvadeEscape(player, minX, maxX) {
    const role = this.getBehaviorRole();
    const avoidX = player ? Math.sign(this.sprite.x - player.sprite.x || this.driftDirection) : this.driftDirection;
    const weave = role === 'scout'
      ? Math.sin(this.scene.time.now / 165 + this.weaveSeed) * 0.65 * (this.behaviorProfile.weaveScale ?? 1)
      : 0;
    const yVelocity = this.spawnStyle === 'rear' ? -Math.max(210, this.speed * (role === 'scout' ? 1.08 : 1)) : this.speed * 0.9;
    this.sprite.body.setVelocity((avoidX + weave) * this.driftSpeed, yVelocity);
    this.sprite.x = Phaser.Math.Clamp(this.sprite.x, minX, maxX);
  }

  updateLaneHold(player, minX, maxX) {
    const role = this.getBehaviorRole();
    const lockStrength = role === 'shooter' ? 0.9 : this.weaponStyle === 'mine' ? 0.58 : 0.72;
    const desiredX = this.getAggressiveTargetX(player, minX, maxX, lockStrength);
    const dx = Phaser.Math.Clamp(desiredX - this.sprite.x, -1, 1);
    const committed = this.scene.time.now < this.laneCommitUntil;
    const xVelocity = committed || Math.abs(desiredX - this.sprite.x) < 6 ? 0 : dx * Math.max(64, this.lateralSpeed);
    const yScale = role === 'heavy' ? 0.72 : role === 'mineLayer' ? 0.64 : this.weaponStyle === 'none' ? 0.78 : 0.58;
    this.sprite.body.setVelocity(xVelocity, this.speed * yScale);
    this.sprite.x = Phaser.Math.Clamp(this.sprite.x, minX, maxX);
    if (!committed && Math.abs(desiredX - this.sprite.x) < 8) {
      this.laneCommitUntil = this.scene.time.now + (this.behaviorProfile.laneCommitMs ?? 1000);
    }
  }

  updateAggressiveDrift(player, minX, maxX) {
    const role = this.getBehaviorRole();
    const desiredX = this.getAggressiveTargetX(player, minX, maxX, role === 'heavy' ? 0.34 : 0.62);
    const shouldCommit = player && Math.abs(desiredX - this.targetX) > 3;

    if (!shouldCommit) {
      if (this.sprite.x <= minX) {
        this.driftDirection = 1;
      } else if (this.sprite.x >= maxX) {
        this.driftDirection = -1;
      }
      this.sprite.body.setVelocity(this.driftDirection * this.driftSpeed, this.speed);
      return;
    }

    const dx = Phaser.Math.Clamp(desiredX - this.sprite.x, -1, 1);
    const committed = this.scene.time.now < this.laneCommitUntil;
    const xVelocity = committed || Math.abs(desiredX - this.sprite.x) < 8 ? 0 : dx * Math.max(54, this.lateralSpeed * 0.82);
    this.sprite.body.setVelocity(xVelocity, this.speed * (role === 'heavy' ? 0.78 : 0.92));
    this.sprite.x = Phaser.Math.Clamp(this.sprite.x, minX, maxX);
    if (!committed && Math.abs(desiredX - this.sprite.x) < 10) {
      this.laneCommitUntil = this.scene.time.now + (this.behaviorProfile.laneCommitMs ?? 900);
    }
  }

  getAggressiveTargetX(player, minX, maxX, strength = 1) {
    if (!player?.sprite?.active) {
      return Phaser.Math.Clamp(this.targetX, minX, maxX);
    }

    const dy = player.sprite.y - this.sprite.y;
    const canPressurePlayer = this.spawnStyle === 'rear'
      || (dy > -90 && dy < this.commitRangeY);
    if (!canPressurePlayer) {
      return Phaser.Math.Clamp(this.targetX, minX, maxX);
    }

    const rolePressure = ['rammer', 'bruiser', 'blocker', 'pursuit', 'flanker'].includes(this.enemyType.role);
    const weaponPressure = this.weaponStyle !== 'none';
    const commitStrength = rolePressure || weaponPressure
      ? Math.max(strength, 0.88)
      : strength * 0.68;
    return Phaser.Math.Clamp(
      Phaser.Math.Linear(this.targetX, player.sprite.x, commitStrength),
      minX,
      maxX,
    );
  }

  getDefaultAggression(enemyType) {
    if (enemyType.spawnStyle === 'rear') {
      return 0.92;
    }
    if (enemyType.weaponStyle && enemyType.weaponStyle !== 'none') {
      return 0.82;
    }
    if (['rammer', 'bruiser', 'blocker', 'pursuit', 'flanker'].includes(enemyType.role)) {
      return 0.76;
    }
    if (enemyType.role === 'scout' || enemyType.role === 'deception_support') {
      return 0.44;
    }
    return 0.62;
  }

  isAggressionBurstActive() {
    const now = this.scene.time.now;
    if (now > this.behaviorBurstUntil && now >= this.nextBehaviorBurstAt) {
      this.behaviorBurstUntil = now + (this.behaviorProfile.burstMs ?? 1500);
      this.nextBehaviorBurstAt = this.behaviorBurstUntil + (this.behaviorProfile.restMs ?? 900);
    }
    return now <= this.behaviorBurstUntil;
  }

  getBehaviorRole() {
    if (this.behaviorRole) {
      return this.behaviorRole;
    }
    if (this.weaponStyle === 'mine') {
      return 'mineLayer';
    }
    if (this.weaponStyle !== 'none') {
      return 'shooter';
    }
    if (this.enemyType.chassis === 'motorcycle') {
      return 'scout';
    }
    if (this.enemyType.role === 'blocker' || this.enemyType.role === 'coordinator') {
      return 'heavy';
    }
    if (this.enemyType.role === 'bruiser' || this.enemyType.role === 'rammer') {
      return 'rammer';
    }
    return 'pursuit';
  }
}
