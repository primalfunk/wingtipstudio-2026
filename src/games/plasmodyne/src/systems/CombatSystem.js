import Phaser from 'phaser';
import { DROID_GENERATION, PLAYER } from '../data/constants.js';
import { getWeapon } from '../data/weaponTypes.js';
import { Projectile } from '../entities/Projectile.js';
import { drawMuzzleFlash, getWeaponEmitterGeometry } from '../rendering/weapons/WeaponEmitterRenderer.js';
import { drawBeamProjectile } from '../rendering/weapons/ProjectileRenderer.js';

export class CombatSystem {
  constructor(scene) {
    this.scene = scene;
    this.playerCooldownUntil = 0;
    this.droidCooldowns = new Map();
    this.projectiles = [];
    this.playerProjectiles = scene.physics.add.group();
    this.hostileProjectiles = scene.physics.add.group();
  }

  attach({ walls, doorGroup, droidGroup, droids, player }) {
    this.detachColliders();
    this.walls = walls;
    this.doorGroup = doorGroup;
    this.droidGroup = droidGroup;
    this.droids = droids;
    this.player = player;

    this.playerWallCollider = this.scene.physics.add.collider(this.playerProjectiles, walls, (projectileSprite) => this.destroyProjectileSprite(projectileSprite));
    this.hostileWallCollider = this.scene.physics.add.collider(this.hostileProjectiles, walls, (projectileSprite) => this.destroyProjectileSprite(projectileSprite));
    if (doorGroup) {
      this.playerDoorCollider = this.scene.physics.add.collider(this.playerProjectiles, doorGroup, (projectileSprite) => this.destroyProjectileSprite(projectileSprite));
      this.hostileDoorCollider = this.scene.physics.add.collider(this.hostileProjectiles, doorGroup, (projectileSprite) => this.destroyProjectileSprite(projectileSprite));
    }
    this.playerHitCollider = this.scene.physics.add.overlap(this.hostileProjectiles, player.sprite, (projectileSprite) => this.hitPlayer(projectileSprite));
    this.droidHitCollider = this.scene.physics.add.overlap(this.playerProjectiles, droidGroup, (projectileSprite, droidSprite) => this.hitDroid(projectileSprite, droidSprite));
  }

  detachColliders() {
    for (const key of ['playerWallCollider', 'hostileWallCollider', 'playerDoorCollider', 'hostileDoorCollider', 'playerHitCollider', 'droidHitCollider']) {
      const collider = this[key];
      this[key] = null;
      if (!collider?.world) {
        continue;
      }
      collider.destroy();
    }
  }

  update(time, delta) {
    this.projectiles = this.projectiles.filter((projectile) => projectile.sprite?.active);
    for (const projectile of this.projectiles) {
      this.resolveSweptProjectileHit(projectile);
      projectile.update(delta);
    }
    this.handleDroidFire(time);
  }

  firePlayerAtPoint(point, time) {
    if (this.scene.areWeaponsEnabled?.(time) === false) {
      return false;
    }
    const weapon = getWeapon(this.player.bodyData.weaponType);
    if (weapon.type === 'none' || time < this.playerCooldownUntil) {
      return false;
    }

    const angle = Phaser.Math.Angle.Between(this.player.sprite.x, this.player.sprite.y, point.x, point.y);
    this.fireWeapon({ owner: 'player', weapon, x: this.player.sprite.x, y: this.player.sprite.y, angle, time });
    this.playerCooldownUntil = time + 1000 / weapon.fireRate;
    return true;
  }

  firePlayerFacing(time) {
    const target = {
      x: this.player.sprite.x + Math.cos(this.player.facingAngle) * 100,
      y: this.player.sprite.y + Math.sin(this.player.facingAngle) * 100
    };
    return this.firePlayerAtPoint(target, time);
  }

  handleDroidFire(time) {
    if (this.scene.areWeaponsEnabled?.(time) === false) {
      return;
    }
    for (const droid of this.droids ?? []) {
      if (droid.data.neutralized || droid.data.detectionMemory <= 0) {
        continue;
      }
      const weapon = getWeapon(droid.data.template.weaponType);
      if (weapon.type === 'none') {
        continue;
      }
      const distance = Phaser.Math.Distance.Between(droid.sprite.x, droid.sprite.y, this.player.sprite.x, this.player.sprite.y);
      if (distance > weapon.range) {
        continue;
      }
      if (this.scene.visionSystem &&
        !this.scene.visionSystem.canSee(
          { x: droid.sprite.x, y: droid.sprite.y },
          { x: this.player.sprite.x, y: this.player.sprite.y },
          Math.min(weapon.range, droid.data.template.sensorRange),
          droid.facingAngle
        )) {
        continue;
      }
      const cooldownUntil = this.droidCooldowns.get(droid.data.id) ?? 0;
      if (time < cooldownUntil) {
        continue;
      }
      const angle = Phaser.Math.Angle.Between(droid.sprite.x, droid.sprite.y, this.player.sprite.x, this.player.sprite.y);
      this.fireWeapon({ owner: 'hostile', weapon, x: droid.sprite.x, y: droid.sprite.y, angle, time, sourceDroid: droid });
      this.droidCooldowns.set(droid.data.id, time + 1000 / weapon.fireRate);
    }
  }

  fireWeapon({ owner, weapon, x, y, angle, sourceDroid = null }) {
    if (weapon.type === 'none') {
      return;
    }
    this.scene.audio?.playLaser(weapon);
    if (weapon.type === 'beam') {
      this.fireBeam(owner, weapon, x, y, angle, sourceDroid);
      return;
    }
    if (weapon.type === 'shock') {
      this.fireShock(owner, weapon, x, y);
      return;
    }
    if (weapon.type === 'burst') {
      for (const offset of [-weapon.spread, 0, weapon.spread]) {
        this.fireProjectile(owner, weapon, x, y, angle + offset, sourceDroid);
      }
      return;
    }
    this.fireProjectile(owner, weapon, x, y, angle, sourceDroid);
  }

  fireProjectile(owner, weapon, x, y, angle, sourceDroid = null) {
    const emitters = this.getEmitterGeometry(owner, weapon, x, y, angle);
    for (const emitter of emitters) {
      const projectile = new Projectile(this.scene, {
        owner,
        damage: weapon.damage,
        range: weapon.range,
        radius: weapon.radius,
        color: weapon.color,
        speed: weapon.projectileSpeed,
        killerDisplayId: sourceDroid?.data?.template?.displayId ?? null,
        x: emitter.tip.x,
        y: emitter.tip.y,
        angle: emitter.angle
      });
      this.projectiles.push(projectile);
      if (owner === 'player') {
        this.playerProjectiles.add(projectile.sprite);
      } else {
        this.hostileProjectiles.add(projectile.sprite);
      }
      projectile.launch();
    }
  }

  fireBeam(owner, weapon, x, y, angle, sourceDroid = null) {
    const graphics = this.scene.add.graphics();
    graphics.setDepth(25);

    const emitters = this.getEmitterGeometry(owner, weapon, x, y, angle);
    const beamCasts = [];
    let hitWall = false;

    for (const emitter of emitters) {
      const cast = this.castBeamToWall(emitter.tip.x, emitter.tip.y, emitter.angle, weapon.range);
      beamCasts.push({ start: emitter.tip, angle: emitter.angle, ...cast });
      hitWall = hitWall || cast.hitWall;
      drawMuzzleFlash(graphics, emitter, weapon);
      drawBeamProjectile(graphics, emitter.tip, cast.end, weapon);
      if (cast.hitWall) {
        this.scene.spawnWallHitSparks?.(cast.end.x, cast.end.y, weapon.color, emitter.angle);
      }
    }
    this.scene.time.delayedCall(80, () => graphics.destroy());
    if (hitWall) {
      this.scene.time.delayedCall(20, () => this.scene.audio?.playWallHit());
    }

    if (owner === 'player') {
      const target = this.findFirstDroidHitByBeamCasts(beamCasts);
      if (target) {
        this.damageDroid(target, weapon.damage);
      }
    } else if (this.pointHitByBeamCasts(this.player.sprite.x, this.player.sprite.y, beamCasts, PLAYER.radius)) {
      this.damagePlayer(weapon.damage, sourceDroid?.data?.template?.displayId ?? null);
    }
  }

  getEmitterAngles(weapon, angle) {
    const count = weapon.emitterCount ?? 1;
    if (count <= 1) {
      return [angle];
    }
    const spread = weapon.emitterSpread ?? 0.08;
    if (count === 2) {
      return [angle - spread, angle + spread];
    }
    const middle = (count - 1) / 2;
    return Array.from({ length: count }, (_, index) => angle + (index - middle) * spread);
  }

  getEmitterGeometry(owner, weapon, x, y, angle) {
    const shellRadius = owner === 'player' ? PLAYER.radius : DROID_GENERATION.radius;
    return getWeaponEmitterGeometry({ x, y, radius: shellRadius, angle, weapon });
  }

  findFirstDroidHitByEmitters(x, y, angle, weapon, shellRadius) {
    let best = null;
    let bestDistance = Infinity;
    for (const emitterAngle of this.getEmitterAngles(weapon, angle)) {
      const startX = x + Math.cos(emitterAngle) * shellRadius;
      const startY = y + Math.sin(emitterAngle) * shellRadius;
      const target = this.findFirstDroidOnRay(startX, startY, emitterAngle, weapon.range);
      if (!target) {
        continue;
      }
      const distance = Phaser.Math.Distance.Between(startX, startY, target.sprite.x, target.sprite.y);
      if (distance < bestDistance) {
        best = target;
        bestDistance = distance;
      }
    }
    return best;
  }

  findFirstDroidHitByBeamCasts(beamCasts) {
    let best = null;
    let bestDistance = Infinity;
    for (const cast of beamCasts) {
      const target = this.findFirstDroidOnRay(cast.start.x, cast.start.y, cast.angle, cast.distance);
      if (!target) {
        continue;
      }
      const distance = Phaser.Math.Distance.Between(cast.start.x, cast.start.y, target.sprite.x, target.sprite.y);
      if (distance < bestDistance) {
        best = target;
        bestDistance = distance;
      }
    }
    return best;
  }

  pointHitByEmitters(px, py, x, y, angle, weapon, shellRadius, radius) {
    return this.getEmitterAngles(weapon, angle).some((emitterAngle) => {
      const startX = x + Math.cos(emitterAngle) * shellRadius;
      const startY = y + Math.sin(emitterAngle) * shellRadius;
      return this.pointNearRay(px, py, startX, startY, emitterAngle, weapon.range, radius);
    });
  }

  pointHitByBeamCasts(px, py, beamCasts, radius) {
    return beamCasts.some((cast) => this.pointNearRay(px, py, cast.start.x, cast.start.y, cast.angle, cast.distance, radius));
  }

  castBeamToWall(x, y, angle, range) {
    const step = 6;
    let lastX = x;
    let lastY = y;
    for (let distance = step; distance <= range; distance += step) {
      const sampleX = x + Math.cos(angle) * distance;
      const sampleY = y + Math.sin(angle) * distance;
      if (this.beamBlockedAt(sampleX, sampleY)) {
        return {
          end: { x: lastX, y: lastY },
          distance: Math.max(0, distance - step),
          hitWall: true
        };
      }
      lastX = sampleX;
      lastY = sampleY;
    }
    return {
      end: {
        x: x + Math.cos(angle) * range,
        y: y + Math.sin(angle) * range
      },
      distance: range,
      hitWall: false
    };
  }

  beamBlockedAt(x, y) {
    const map = this.scene.mapSystem;
    if (!map) {
      return false;
    }
    return !map.isWalkableAt(x, y) || map.isBlockedByClosedDoor(x, y, 2);
  }

  fireShock(owner, weapon, x, y) {
    const graphics = this.scene.add.graphics();
    graphics.lineStyle(2, weapon.color, 0.85);
    graphics.strokeCircle(x, y, weapon.range);
    graphics.setDepth(25);
    this.scene.time.delayedCall(100, () => graphics.destroy());

    if (owner === 'player') {
      for (const droid of this.droids) {
        if (!droid.data.neutralized && Phaser.Math.Distance.Between(x, y, droid.sprite.x, droid.sprite.y) <= weapon.range) {
          this.damageDroid(droid, weapon.damage);
        }
      }
    } else if (Phaser.Math.Distance.Between(x, y, this.player.sprite.x, this.player.sprite.y) <= weapon.range) {
      this.damagePlayer(weapon.damage);
    }
  }

  hitDroid(projectileSprite, droidSprite) {
    const projectile = projectileSprite.getData('projectile');
    const droid = this.droids.find((item) => item.sprite === droidSprite);
    if (!projectile || !droid || droid.data.neutralized) {
      return;
    }
    this.damageDroid(droid, projectile.damage);
    projectile.destroy();
  }

  hitPlayer(projectileSprite) {
    const projectile = projectileSprite.getData('projectile');
    if (!projectile) {
      return;
    }
    this.damagePlayer(projectile.damage, projectile.killerDisplayId);
    projectile.destroy();
  }

  resolveSweptProjectileHit(projectile) {
    if (!projectile?.sprite?.active) {
      return;
    }
    const start = projectile.previous;
    const end = { x: projectile.sprite.x, y: projectile.sprite.y };
    if (!start || (start.x === end.x && start.y === end.y)) {
      return;
    }

    if (projectile.owner === 'player') {
      const hit = this.findDroidHitByProjectileSegment(start, end, projectile.radius);
      if (!hit) {
        return;
      }
      this.damageDroid(hit, projectile.damage);
      projectile.destroy();
      return;
    }

    if (this.player?.sprite?.active && this.pointNearSegment(
      this.player.sprite.x,
      this.player.sprite.y,
      start.x,
      start.y,
      end.x,
      end.y,
      (PLAYER.radius ?? 18) + projectile.radius
    )) {
      this.damagePlayer(projectile.damage, projectile.killerDisplayId);
      projectile.destroy();
    }
  }

  findDroidHitByProjectileSegment(start, end, projectileRadius = 0) {
    let best = null;
    let bestDistance = Infinity;
    for (const droid of this.droids ?? []) {
      if (droid.data.neutralized || !droid.sprite?.active) {
        continue;
      }
      const hitRadius = DROID_GENERATION.radius + projectileRadius;
      if (!this.pointNearSegment(droid.sprite.x, droid.sprite.y, start.x, start.y, end.x, end.y, hitRadius)) {
        continue;
      }
      const distance = Phaser.Math.Distance.Between(start.x, start.y, droid.sprite.x, droid.sprite.y);
      if (distance < bestDistance) {
        best = droid;
        bestDistance = distance;
      }
    }
    return best;
  }

  damageDroid(droid, damage) {
    const before = droid.data.currentIntegrity;
    droid.data.currentIntegrity = Math.max(0, droid.data.currentIntegrity - damage);
    this.scene.showDamageHealthBar(droid.sprite, droid.data.template.maxIntegrity, before, droid.data.currentIntegrity);
    droid.setAggro?.(this.scene.time.now);
    droid.flash(0xfff2a6);
    this.scene.spawnHitSpark(droid.sprite.x, droid.sprite.y, droid.data.template.accentColor);
    if (droid.data.currentIntegrity <= 0) {
      this.neutralizeDroid(droid);
    } else {
      this.scene.audio?.playDroidHit();
    }
  }

  neutralizeDroid(droid) {
    droid.data.neutralized = true;
    droid.data.state = 'neutralized';
    const x = droid.sprite.x;
    const y = droid.sprite.y;
    this.scene.playDroidExplosion(x, y, () => {
      this.scene.removeDroidEntity(droid);
      this.scene.recordDroidNeutralized(droid.data);
    });
    this.scene.audio?.playDroidExplode();
    this.droidCooldowns.delete(droid.data.id);
  }

  damagePlayer(damage, killerDisplayId = null) {
    if (this.scene.isRespawning) {
      return;
    }
    const before = this.player.bodyData.integrity;
    this.player.bodyData.integrity = Math.max(0, this.player.bodyData.integrity - damage);
    this.scene.showDamageHealthBar(this.player.sprite, this.player.bodyData.maxIntegrity, before, this.player.bodyData.integrity, {
      yOffset: -54,
      width: 78
    });
    this.scene.applyStabilityDamagePenalty(damage);
    this.scene.spawnHitSpark(this.player.sprite.x, this.player.sprite.y, 0xff6f61);
    this.scene.flashPlayer();
    this.scene.hud?.update?.();
    if (this.scene.bodyInfoCard?.isVisible?.()) {
      this.scene.bodyInfoCard.showBody(this.player.bodyData, this.scene.runStats);
    }
    if (this.player.bodyData.integrity <= 0) {
      this.scene.handlePlayerDeath(killerDisplayId);
    }
  }

  findFirstDroidOnRay(x, y, angle, range) {
    let best = null;
    let bestDistance = Infinity;
    for (const droid of this.droids) {
      if (droid.data.neutralized) {
        continue;
      }
      if (!this.pointNearRay(droid.sprite.x, droid.sprite.y, x, y, angle, range, DROID_GENERATION.radius)) {
        continue;
      }
      const distance = Phaser.Math.Distance.Between(x, y, droid.sprite.x, droid.sprite.y);
      if (distance < bestDistance) {
        best = droid;
        bestDistance = distance;
      }
    }
    return best;
  }

  pointNearRay(px, py, x, y, angle, range, radius) {
    const vx = px - x;
    const vy = py - y;
    const projection = vx * Math.cos(angle) + vy * Math.sin(angle);
    if (projection < 0 || projection > range) {
      return false;
    }
    const closestX = x + Math.cos(angle) * projection;
    const closestY = y + Math.sin(angle) * projection;
    return Phaser.Math.Distance.Between(px, py, closestX, closestY) <= radius + 8;
  }

  pointNearSegment(px, py, x1, y1, x2, y2, radius) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (dx === 0 && dy === 0) {
      return Phaser.Math.Distance.Between(px, py, x1, y1) <= radius;
    }
    const t = Phaser.Math.Clamp(((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy), 0, 1);
    return Phaser.Math.Distance.Between(px, py, x1 + dx * t, y1 + dy * t) <= radius;
  }

  destroyProjectileSprite(projectileSprite) {
    const projectile = projectileSprite.getData('projectile');
    projectile?.destroy();
  }

  clearProjectiles() {
    for (const projectile of this.projectiles) {
      projectile.destroy();
    }
    this.projectiles = [];
    this.playerProjectiles.clear(true, true);
    this.hostileProjectiles.clear(true, true);
  }

  destroy() {
    this.detachColliders();
    this.clearProjectiles();
    this.playerProjectiles.destroy(true);
    this.hostileProjectiles.destroy(true);
  }
}
