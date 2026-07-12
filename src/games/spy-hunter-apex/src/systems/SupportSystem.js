import Phaser from 'phaser';
import SupportVan from '../entities/SupportVan.js';
import { ROAD, SUPPORT } from '../data/tuning.js';

export default class SupportSystem {
  constructor(scene, missionState, onAlert) {
    this.scene = scene;
    this.missionState = missionState;
    this.onAlert = onAlert;
    this.vans = [];
    this.group = scene.physics.add.group();
    this.nextSpawnAt = scene.time.now + SUPPORT.initialDelayMs;
    this.laneCenters = this.createLaneCenters();
    this.spawnTarget = 'player_side';
    this.spawnCount = 0;
    this.prioritySpawnConfig = null;
  }

  update(time) {
    this.laneCenters = this.getLaneCenters(this.spawnTarget);
    if (time >= this.nextSpawnAt && this.scene.player?.mode !== 'boat') {
      const priorityConfig = this.prioritySpawnConfig;
      this.prioritySpawnConfig = null;
      const spawned = this.spawnVan(priorityConfig ?? {});
      if (spawned) {
        this.scheduleNextSpawn();
      } else {
        this.prioritySpawnConfig = priorityConfig;
        this.nextSpawnAt = this.scene.time.now + 650;
      }
    } else if (time >= this.nextSpawnAt) {
      this.prioritySpawnConfig = null;
      this.scheduleNextSpawn();
    }

    for (let index = this.vans.length - 1; index >= 0; index -= 1) {
      const van = this.vans[index];
      van.update(this.laneCenters, this.getAvoidanceHazards(van));
      if (!van.sprite.active || van.sprite.y > SUPPORT.despawnY || van.sprite.y < -220) {
        this.removeVanAt(index);
      }
    }
  }

  getAvoidanceHazards(van) {
    return [
      ...this.scene.trafficSystem.vehicles,
      ...this.scene.combatSystem.enemies,
      ...this.vans.filter((candidate) => candidate !== van),
    ];
  }

  createLaneCenters() {
    const laneWidth = (ROAD.right - ROAD.left) / ROAD.laneCount;
    return Array.from({ length: ROAD.laneCount }, (_, index) => ROAD.left + laneWidth * index + laneWidth / 2);
  }

  getLaneCenters(spawnTarget = 'player_side') {
    return this.scene.roadSystem?.getLaneCentersForTarget(spawnTarget, this.scene.player?.sprite.x)
      ?? this.createLaneCenters();
  }

  spawnVan(config = {}) {
    this.laneCenters = this.getLaneCenters(config.spawnTarget ?? this.spawnTarget);
    const openLanes = this.getOpenLanes();
    if (config.lane == null && openLanes.length === 0) {
      return null;
    }

    const requestedLane = this.getLaneNearestX(config.x ?? this.scene.player?.sprite.x);
    const lane = config.lane
      ?? (config.preferPlayerLane && openLanes.includes(requestedLane) ? requestedLane : Phaser.Utils.Array.GetRandom(openLanes));
    const x = config.x ?? this.laneCenters[lane];
    const y = config.y ?? -58;
    const serviceType = config.serviceType ?? this.chooseServiceType();
    const van = new SupportVan(this.scene, x, y, {
      lane,
      isDecoy: Boolean(config.isDecoy),
      serviceType,
      spawnTarget: config.spawnTarget ?? this.spawnTarget,
      tintIndex: config.tintIndex ?? this.spawnCount,
    });
    this.spawnCount += 1;
    this.vans.push(van);
    this.group.add(van.sprite);
    this.onAlert(config.isDecoy
      ? 'SUPPORT: Weapons van deployed.'
      : serviceType === 'ammo'
        ? 'SUPPORT: Ammo truck deployed.'
        : serviceType === 'upgrade'
          ? 'SUPPORT: Upgrade truck deployed.'
          : 'SUPPORT: Repair truck deployed.');
    this.missionState.eventHistory.push({
      type: config.isDecoy ? 'decoySupportSpawned' : 'supportSpawned',
      serviceType,
      lane,
      spawnTarget: config.spawnTarget ?? this.spawnTarget,
      at: this.missionState.elapsedTime,
    });
    return van;
  }

  chooseServiceType() {
    const healthMissing = this.missionState.playerDamage / Math.max(1, this.missionState.maxPlayerDamage);
    const ammoMissing = 1 - (this.missionState.playerAmmo / Math.max(1, this.missionState.maxPlayerAmmo));
    if (this.scene.player?.mode === 'motorcycle') {
      return 'upgrade';
    }
    if (healthMissing >= 0.35 && healthMissing >= ammoMissing * 0.85) {
      return 'repair';
    }
    if (ammoMissing >= 0.3) {
      return 'ammo';
    }
    return this.spawnCount % 2 === 0 ? 'repair' : 'ammo';
  }

  spawnDecoyVan() {
    this.spawnVan({ isDecoy: true });
  }

  getOpenLanes() {
    return this.laneCenters
      .map((_, lane) => lane)
      .filter((lane) => !this.isLaneBlocked(lane));
  }

  isLaneBlocked(lane) {
    const laneX = this.laneCenters[lane];
    if (this.scene.infrastructurePressureSystem?.isLaneBlockedForSpawn(laneX)) {
      return true;
    }

    const hazards = [
      ...this.scene.trafficSystem.vehicles,
      ...this.scene.combatSystem.enemies,
      ...this.vans,
    ];
    return hazards.some((hazard) => {
      return hazard.sprite?.active
        && Math.abs(hazard.sprite.x - laneX) < 38
        && hazard.sprite.y < 190;
    });
  }

  scheduleNextSpawn() {
    const multiplier = this.missionState.getSpawnMultiplier('support')
      * (this.missionState.difficulty.supportSpawnScale ?? 1);
    const delay = Phaser.Math.Between(
      SUPPORT.minSpawnDelayMs,
      SUPPORT.maxSpawnDelayMs,
    ) / multiplier;
    this.nextSpawnAt = this.scene.time.now + delay;
  }

  requestPrioritySupport(delayMs = 1800, config = {}) {
    const scaledDelay = Math.round(delayMs * (this.missionState.difficulty.prioritySupportDelayScale ?? 1));
    this.nextSpawnAt = Math.min(this.nextSpawnAt, this.scene.time.now + scaledDelay);
    this.prioritySpawnConfig = {
      serviceType: this.scene.player?.mode === 'motorcycle' ? 'upgrade' : undefined,
      preferPlayerLane: true,
      spawnTarget: 'player_side',
      ...config,
    };
  }

  getLaneNearestX(x = ROAD.left + (ROAD.right - ROAD.left) / 2) {
    let bestLane = 0;
    let bestDistance = Infinity;
    for (let lane = 0; lane < this.laneCenters.length; lane += 1) {
      const distance = Math.abs(this.laneCenters[lane] - x);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestLane = lane;
      }
    }
    return bestLane;
  }

  removeVan(sprite) {
    const index = this.vans.findIndex((van) => van.sprite === sprite);
    if (index >= 0) {
      this.removeVanAt(index);
    }
  }

  removeVanAt(index) {
    const [van] = this.vans.splice(index, 1);
    van.destroy();
  }
}
