import Phaser from 'phaser';
import EnemyVehicle from '../entities/EnemyVehicle.js';
import Projectile from '../entities/Projectile.js';
import { COMBAT, DAMAGE, PLAYER_MODES, ROAD } from '../data/tuning.js';
import { ENEMY_TYPE_BY_ID, WATER_ENEMY_TYPE_BY_ID, getEnemyPool } from '../data/enemyTypes.js';
import EnemyBehaviorDirector from './EnemyBehaviorDirector.js';

export default class CombatSystem {
  constructor(scene, missionState, player, audioSystem = null, effectsSystem = null) {
    this.scene = scene;
    this.missionState = missionState;
    this.player = player;
    this.audioSystem = audioSystem;
    this.effectsSystem = effectsSystem;
    this.enemies = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.enemyGroup = scene.physics.add.group();
    this.projectileGroup = scene.physics.add.group();
    this.enemyProjectileGroup = scene.physics.add.group();
    this.difficulty = missionState.difficulty;
    this.nextEnemySpawnAt = scene.time.now + COMBAT.enemyInitialDelayMs;
    this.lastFireAt = -COMBAT.fireCooldownMs;
    this.laneCenters = this.createLaneCenters();
    this.spawnTarget = 'player_side';
    this.enemySpawnCount = 0;
    this.behaviorDirector = new EnemyBehaviorDirector(scene, missionState);

    scene.physics.add.overlap(
      this.projectileGroup,
      this.enemyGroup,
      this.handleProjectileHit,
      undefined,
      this,
    );
    scene.physics.add.overlap(
      this.enemyProjectileGroup,
      player.sprite,
      this.handleEnemyProjectileHit,
      undefined,
      this,
    );
  }

  update(time, isFiring) {
    this.laneCenters = this.getLaneCenters(this.spawnTarget);
    this.behaviorDirector.update(time);
    if (isFiring) {
      this.tryFire(time);
    }

    if (time >= this.nextEnemySpawnAt) {
      this.spawnEnemy();
      this.scheduleNextEnemy();
    }

    this.updateEnemies();
    this.updateProjectiles();
    this.updateEnemyProjectiles();
  }

  createLaneCenters() {
    const laneWidth = (ROAD.right - ROAD.left) / ROAD.laneCount;
    return Array.from({ length: ROAD.laneCount }, (_, index) => ROAD.left + laneWidth * index + laneWidth / 2);
  }

  getLaneCenters(spawnTarget = 'player_side') {
    return this.scene.roadSystem?.getLaneCentersForTarget(spawnTarget, this.player.sprite.x)
      ?? this.createLaneCenters();
  }

  tryFire(time) {
    if (time - this.lastFireAt < COMBAT.fireCooldownMs || this.missionState.playerAmmo <= 0) {
      return;
    }

    this.lastFireAt = time;
    this.missionState.playerAmmo -= 1;
    this.audioSystem?.playFire();
    const projectile = new Projectile(this.scene, this.player.sprite.x, this.player.sprite.y - 28);
    this.projectiles.push(projectile);
    this.projectileGroup.add(projectile.sprite);
  }

  spawnEnemy(config = {}) {
    this.laneCenters = this.getLaneCenters(config.spawnTarget ?? this.spawnTarget);
    const openLanes = this.getOpenLanes();
    if (openLanes.length === 0) {
      return;
    }

    const enemyPool = getEnemyPool(this.player.mode);
    const enemyType = this.chooseEnemyType(config, enemyPool);
    if (!enemyType) {
      return;
    }

    const lane = config.lane ?? this.chooseEnemyLane(openLanes, enemyType);
    const baseSpeed = config.speed ?? Phaser.Math.Between(COMBAT.enemyMinSpeed, COMBAT.enemyMaxSpeed);
    const behaviorConfig = this.behaviorDirector.getSpawnConfig(enemyType);
    const speed = this.clampEnemySpeed(
      enemyType,
      baseSpeed * this.difficulty.enemySpeedScale * (config.speedScale ?? behaviorConfig.speedScale ?? 1),
    );
    const spawn = this.createEnemySpawn(enemyType, lane, config);
    const enemy = new EnemyVehicle(this.scene, spawn.x, spawn.y, {
      lane,
      speed,
      enemyType,
      targetX: this.laneCenters[lane],
      spawnTarget: config.spawnTarget ?? this.spawnTarget,
      tintIndex: config.tintIndex ?? this.enemySpawnCount,
      behaviorRole: behaviorConfig.behaviorRole,
      behaviorProfile: behaviorConfig.behaviorProfile,
      aggressionScale: this.difficulty.enemyAggressionScale * (config.aggressionScale ?? behaviorConfig.aggressionScale ?? 1),
    });
    this.clampEnemyMobility(enemy);
    this.enemySpawnCount += 1;
    this.enemies.push(enemy);
    this.enemyGroup.add(enemy.sprite);
    this.missionState.eventHistory.push({
      type: 'enemySpawned',
      enemyType: enemyType.id,
      role: behaviorConfig.behaviorRole,
      encounter: this.missionState.currentEnemyEncounter?.key ?? 'none',
      lane,
      spawnTarget: config.spawnTarget ?? this.spawnTarget,
      at: this.missionState.elapsedTime,
    });
  }

  clampEnemySpeed(enemyType, speed) {
    if (enemyType.chassis === 'motorcycle') {
      return speed;
    }
    const profile = PLAYER_MODES[this.player.mode] ?? PLAYER_MODES.car;
    return Math.min(speed, profile.maxSpeedY + 55);
  }

  clampEnemyMobility(enemy) {
    if (enemy.enemyType?.chassis === 'motorcycle') {
      return;
    }
    const profile = PLAYER_MODES[this.player.mode] ?? PLAYER_MODES.car;
    enemy.lateralSpeed = Math.min(enemy.lateralSpeed, profile.maxSpeedX * 0.62);
  }

  chooseEnemyType(config, enemyPool) {
    if (config.enemyTypeId) {
      return ENEMY_TYPE_BY_ID[config.enemyTypeId] ?? WATER_ENEMY_TYPE_BY_ID[config.enemyTypeId] ?? null;
    }

    return this.behaviorDirector.chooseEnemyType(
      enemyPool,
      this.enemies,
      (candidate) => this.canSpawnEnemyType(candidate),
    );
  }

  canSpawnEnemyType(enemyType) {
    if (this.enemies.length >= 5) {
      return false;
    }

    const shooterCount = this.enemies.filter((enemy) => enemy.weaponStyle && enemy.weaponStyle !== 'none').length;
    const mineLayerCount = this.enemies.filter((enemy) => enemy.weaponStyle === 'mine').length;

    if (enemyType.weaponStyle && enemyType.weaponStyle !== 'none' && shooterCount >= 2) {
      return false;
    }

    if (enemyType.weaponStyle === 'mine' && mineLayerCount >= 1) {
      return false;
    }

    return true;
  }

  createEnemySpawn(enemyType, lane, config) {
    const laneX = this.laneCenters[lane];
    if (enemyType.spawnStyle === 'side') {
      const fromLeft = Phaser.Math.Between(0, 1) === 0;
      return {
        x: config.x ?? (fromLeft ? ROAD.left - 46 : ROAD.right + 46),
        y: config.y ?? Phaser.Math.Between(90, 330),
      };
    }

    return {
      x: config.x ?? laneX,
      y: config.y ?? -54,
    };
  }

  chooseEnemyLane(openLanes, enemyType) {
    if (!this.player?.sprite?.active || openLanes.length === 1) {
      return Phaser.Utils.Array.GetRandom(openLanes);
    }

    const playerLane = this.getNearestLane(this.player.sprite.x);
    const rolePressure = ['rammer', 'bruiser', 'blocker', 'pursuit', 'flanker'].includes(enemyType.role);
    const weaponPressure = enemyType.weaponStyle && enemyType.weaponStyle !== 'none';

    if (rolePressure || weaponPressure || enemyType.movementStyle === 'lane_hold') {
      return this.behaviorDirector.chooseLane(openLanes, this.laneCenters, this.player, enemyType);
    }

    return Phaser.Utils.Array.GetRandom(openLanes);
  }

  getNearestLane(x) {
    return this.laneCenters.reduce((bestLane, laneX, lane) => (
      Math.abs(laneX - x) < Math.abs(this.laneCenters[bestLane] - x) ? lane : bestLane
    ), 0);
  }

  spawnProjectileAt(x, y) {
    const projectile = new Projectile(this.scene, x, y);
    this.projectiles.push(projectile);
    this.projectileGroup.add(projectile.sprite);
    return projectile;
  }

  spawnAmbush(count) {
    const lanes = Phaser.Utils.Array.Shuffle(this.laneCenters.map((_, lane) => lane)).slice(0, count);
    lanes.forEach((lane, index) => {
      this.scene.time.delayedCall(index * 240, () => {
        this.spawnEnemy({
          lane,
          spawnTarget: 'player_side',
          speed: COMBAT.enemyMaxSpeed + 25,
        });
      });
    });
  }

  getOpenLanes() {
    return this.laneCenters
      .map((_, lane) => lane)
      .filter((lane) => {
        const blockedByEnemy = this.enemies.some((enemy) => enemy.lane === lane && enemy.sprite.y < 130);
        if (blockedByEnemy) {
          return false;
        }

        const laneX = this.laneCenters[lane];
        if (this.scene.infrastructurePressureSystem?.isLaneBlockedForSpawn(laneX)) {
          return false;
        }

        const blockedByTraffic = this.scene.trafficSystem?.vehicles.some((vehicle) => {
          return vehicle.sprite.active
            && Math.abs(vehicle.sprite.x - laneX) < 40
            && vehicle.sprite.y < 230;
        });
        if (blockedByTraffic) {
          return false;
        }

        return !this.scene.supportSystem?.vans.some((van) => {
          return van.sprite.active
            && Math.abs(van.sprite.x - laneX) < 42
            && van.sprite.y < 230;
        });
      });
  }

  scheduleNextEnemy() {
    const multiplier = this.missionState.getSpawnMultiplier('enemies');
    const delay = Phaser.Math.Between(
      COMBAT.enemyMinSpawnDelayMs,
      COMBAT.enemyMaxSpawnDelayMs,
    ) / (multiplier * this.difficulty.enemySpawnScale);
    this.nextEnemySpawnAt = this.scene.time.now + delay * this.behaviorDirector.getSpawnDelayScale();
  }

  updateEnemies() {
    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index];
      enemy.update(this.scene.playerHiddenFromEnemies ? null : this.player);
      this.tryEnemyFire(enemy);
      if (!enemy.sprite.active || enemy.sprite.y > this.scene.scale.height + 80 || enemy.sprite.y < -100) {
        this.handleEnemyExit(enemy);
        this.removeEnemyAt(index);
      }
    }
  }

  tryEnemyFire(enemy) {
    if (!enemy.sprite.active
      || enemy.terrainExplosionPending
      || enemy.weaponStyle === 'none'
      || this.scene.playerHiddenFromEnemies
      || !this.behaviorDirector.canEnemyFire(enemy)) {
      return;
    }

    const time = this.scene.time.now;
    if (time - enemy.lastFireAt < enemy.fireCooldownMs || this.enemyProjectiles.length >= 7) {
      return;
    }

    if (enemy.weaponStyle === 'mine') {
      if (this.enemyProjectiles.filter((projectile) => projectile.type === 'mine').length >= 5) {
        return;
      }
      enemy.lastFireAt = time;
      this.spawnEnemyProjectile(enemy, 'mine');
      return;
    }

    const playerBelow = this.player.sprite.y > enemy.sprite.y;
    const aligned = Math.abs(this.player.sprite.x - enemy.sprite.x) < this.getWeaponArc(enemy.weaponStyle);
    if (!playerBelow || !aligned) {
      return;
    }

    enemy.lastFireAt = time;
    this.spawnEnemyProjectile(enemy, enemy.weaponStyle === 'rocket_burst' ? 'rocket' : enemy.weaponStyle);
    if (enemy.weaponStyle === 'rocket_burst') {
      this.scene.time.delayedCall(180, () => {
        if (enemy.sprite.active) {
          this.spawnEnemyProjectile(enemy, 'rocket', -20);
        }
      });
      this.scene.time.delayedCall(360, () => {
        if (enemy.sprite.active) {
          this.spawnEnemyProjectile(enemy, 'rocket', 20);
        }
      });
    }
  }

  getWeaponArc(weaponStyle) {
    if (weaponStyle === 'rocket' || weaponStyle === 'rocket_burst') {
      return 68;
    }
    if (weaponStyle === 'cannon') {
      return 54;
    }
    return 44;
  }

  spawnEnemyProjectile(enemy, projectileType, xOffset = 0) {
    if (projectileType !== 'mine') {
      this.audioSystem?.playFire();
    }
    const roadSpeed = ROAD.scrollSpeed;
    const config = {
      bullet: { texture: 'enemy-bullet', width: 5, height: 12, velocityY: roadSpeed + 260, damage: DAMAGE.bulletHit },
      cannon: { texture: 'enemy-rocket', width: 11, height: 18, velocityY: roadSpeed + 145, damage: DAMAGE.cannonHit },
      rocket: { texture: 'enemy-rocket', width: 12, height: 22, velocityY: roadSpeed + 115, damage: DAMAGE.rocketHit },
      mine: { texture: 'enemy-mine', width: 18, height: 18, velocityY: roadSpeed, damage: DAMAGE.mineHit },
    }[projectileType] ?? { texture: 'enemy-bullet', width: 5, height: 12, velocityY: roadSpeed + 260, damage: DAMAGE.bulletHit };
    const yOffset = projectileType === 'mine' ? enemy.sprite.displayHeight / 2 + 16 : enemy.sprite.displayHeight / 2 + 6;
    const sprite = this.scene.physics.add.sprite(enemy.sprite.x + xOffset, enemy.sprite.y + yOffset, config.texture)
      .setDepth(projectileType === 'mine' ? 17 : 19)
      .setDisplaySize(config.width, config.height);
    sprite.body.setAllowGravity(false);
    sprite.body.setSize(config.width, config.height, true);
    sprite.body.setVelocity(0, config.velocityY);
    const projectile = {
      sprite,
      type: projectileType,
      damage: config.damage,
      velocityY: config.velocityY,
      ownerType: enemy.enemyType?.id,
    };
    sprite.enemyProjectile = projectile;
    this.enemyProjectiles.push(projectile);
    this.enemyProjectileGroup.add(sprite);
  }

  updateEnemyProjectiles() {
    for (let index = this.enemyProjectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.enemyProjectiles[index];
      projectile.sprite.body.setVelocity(0, projectile.velocityY);
      if (projectile.type === 'mine' && this.mineShouldDetonate(projectile)) {
        this.detonateMine(projectile);
        continue;
      }
      if (!projectile.sprite.active || projectile.sprite.y > this.scene.scale.height + 50) {
        this.removeEnemyProjectileAt(index);
      }
    }
  }

  mineShouldDetonate(projectile) {
    if (!this.player.sprite.active) {
      return false;
    }

    const laneWidth = (ROAD.right - ROAD.left) / ROAD.laneCount;
    const triggerRadius = laneWidth / 2;
    return Math.abs(this.player.sprite.x - projectile.sprite.x) <= triggerRadius
      && Math.abs(this.player.sprite.y - projectile.sprite.y) <= triggerRadius;
  }

  detonateMine(projectile) {
    if (!projectile.sprite.active) {
      return;
    }

    const damageResult = this.scene.applyPlayerDamage(projectile.damage, 'mine', 'Mine detonation: vehicle destroyed.');
    if (!damageResult.vehicleFallback && !damageResult.vehicleDestroyed) {
      this.effectsSystem?.playExplosion(projectile.sprite.x, projectile.sprite.y, 'large', {
        scale: 0.92,
        smokeScale: 0.72,
      });
    }
    this.removeEnemyProjectile(projectile.sprite);
    this.audioSystem?.playCollision();
    this.playLostLifeCue(damageResult);
    this.player.sprite.setTint(0xff7777);
    this.scene.time.delayedCall(150, () => this.player.sprite.clearTint());
    this.scene.hud.update();
    if (this.missionState.isGameOver) {
      this.scene.startGameOver();
    }
  }

  handleEnemyProjectileHit(projectileSprite, playerSprite) {
    if (!projectileSprite.active || !playerSprite.active) {
      return;
    }

    if (this.scene.time.now - this.scene.lastEnemyProjectileHitAt < DAMAGE.enemyProjectileCooldownMs) {
      this.removeEnemyProjectile(projectileSprite);
      return;
    }

    this.scene.lastEnemyProjectileHitAt = this.scene.time.now;
    const projectile = projectileSprite.enemyProjectile;
    const damageResult = this.scene.applyPlayerDamage(
      projectile?.damage ?? DAMAGE.bulletHit,
      projectile?.type ?? 'enemyProjectile',
      'Enemy fire: vehicle destroyed.',
    );
    if (!damageResult.vehicleFallback && !damageResult.vehicleDestroyed) {
      this.effectsSystem?.playExplosion(projectileSprite.x, projectileSprite.y, projectile?.type === 'mine' ? 'large' : 'small', {
        scale: projectile?.type === 'mine' ? 0.92 : 0.32,
        smokeScale: projectile?.type === 'mine' ? 0.72 : 0.4,
        smoke: projectile?.type === 'mine',
      });
    }
    this.removeEnemyProjectile(projectileSprite);
    this.audioSystem?.playCollision();
    this.playLostLifeCue(damageResult);
    playerSprite.setTint(0xff7777);
    this.scene.time.delayedCall(120, () => playerSprite.clearTint());
    this.scene.hud.update();
    if (this.missionState.isGameOver) {
      this.scene.startGameOver();
    }
  }

  removeEnemyProjectile(sprite) {
    const index = this.enemyProjectiles.findIndex((projectile) => projectile.sprite === sprite);
    if (index >= 0) {
      this.removeEnemyProjectileAt(index);
    }
  }

  playLostLifeCue(damageResult) {
    if (!damageResult?.lifeLost || damageResult.gameOver || this.scene.isAttract || this.scene.isHarness) {
      return;
    }
    this.audioSystem?.playLostLife();
  }

  removeEnemyProjectileAt(index) {
    const [projectile] = this.enemyProjectiles.splice(index, 1);
    projectile.sprite.destroy();
  }

  handleEnemyExit(enemy) {
    if (enemy.role === 'scout' || enemy.role === 'deception_support') {
      this.missionState.enemyAwareness = Math.min(1, this.missionState.enemyAwareness + 0.08);
      this.missionState.eventHistory.push({
        type: 'enemyEscaped',
        enemyType: enemy.enemyType?.id ?? 'unknown',
        at: this.missionState.elapsedTime,
      });
    }
  }

  updateProjectiles() {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      projectile.update();
      if (!projectile.sprite.active || projectile.sprite.y < COMBAT.bulletDespawnY) {
        this.removeProjectileAt(index);
      }
    }
  }

  handleProjectileHit(projectileSprite, enemySprite) {
    if (!projectileSprite.active || !enemySprite.active) {
      return;
    }

    const enemy = enemySprite.vehicle;
    const damage = projectileSprite.projectile?.damage ?? 1;
    this.removeProjectile(projectileSprite);
    enemy.health -= damage;
    if (enemy.health > 0) {
      enemySprite.setTint(0xffd17a);
      this.scene.time.delayedCall(90, () => enemySprite.clearTint());
      return;
    }
    const score = enemy.scoreValue ?? COMBAT.enemyScore;
    this.effectsSystem?.playExplosion(enemySprite.x, enemySprite.y, 'small', {
      scale: 0.72,
      smokeScale: 0.58,
    });
    this.missionState.addScore(score);
    this.scene.showFloatingScore?.(enemySprite.x, enemySprite.y, score, 'enemy');
    this.removeEnemy(enemySprite);
    this.audioSystem?.playDestroyed();
    this.missionState.enemiesDestroyed += 1;
    this.missionState.eventHistory.push({
      type: 'enemyDestroyed',
      enemyType: enemy.enemyType?.id ?? 'unknown',
      score,
      at: this.missionState.elapsedTime,
    });
  }

  removeEnemy(sprite) {
    const index = this.enemies.findIndex((enemy) => enemy.sprite === sprite);
    if (index >= 0) {
      this.removeEnemyAt(index);
    }
  }

  removeEnemyAt(index) {
    const [enemy] = this.enemies.splice(index, 1);
    enemy.destroy();
  }

  removeProjectile(sprite) {
    const index = this.projectiles.findIndex((projectile) => projectile.sprite === sprite);
    if (index >= 0) {
      this.removeProjectileAt(index);
    }
  }

  consumeProjectile(sprite) {
    this.removeProjectile(sprite);
  }

  removeProjectileAt(index) {
    const [projectile] = this.projectiles.splice(index, 1);
    projectile.destroy();
  }
}
