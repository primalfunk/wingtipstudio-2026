import CivilianVehicle from '../entities/CivilianVehicle.js';
import Phaser from 'phaser';
import { ROAD, TRAFFIC } from '../data/tuning.js';
import { getCivilianPool } from '../data/civilianTypes.js';
import TrafficFlowDirector from './TrafficFlowDirector.js';

export default class TrafficSystem {
  constructor(scene, missionState) {
    this.scene = scene;
    this.missionState = missionState;
    this.vehicles = [];
    this.group = scene.physics.add.group();
    this.nextSpawnAt = scene.time.now + TRAFFIC.initialDelayMs;
    this.laneCenters = this.createLaneCenters();
    this.spawnTarget = 'player_side';
    this.spawnCount = 0;
    this.flowDirector = new TrafficFlowDirector(scene, missionState);
  }

  update(time) {
    this.laneCenters = this.getLaneCenters(this.spawnTarget);
    this.flowDirector.update();
    if (time >= this.nextSpawnAt) {
      this.trySpawnTrafficFlow();
      this.trySpawnOppositeAtmosphere();
      this.scheduleNextSpawn();
    }

    for (let index = this.vehicles.length - 1; index >= 0; index -= 1) {
      const vehicle = this.vehicles[index];
      vehicle.update();
      if (!vehicle.sprite.active || vehicle.sprite.y > TRAFFIC.despawnY) {
        this.removeVehicleAt(index);
      }
    }
  }

  trySpawnTrafficFlow(config = {}) {
    if (this.vehicles.length >= TRAFFIC.maxActiveVehicles) {
      return;
    }

    const pool = this.getCurrentPool();
    const civilianType = pool[this.spawnCount % pool.length];
    const openLanes = this.getOpenLanes(civilianType);
    if (openLanes.length === 0) {
      return;
    }

    const plan = this.flowDirector.createSpawnPlan({
      pool,
      openLanes,
      laneCenters: this.laneCenters,
      spawnCount: this.spawnCount,
      atmospheric: Boolean(config.atmospheric),
    });

    for (const spawn of plan) {
      this.scene.time.delayedCall(spawn.delayMs, () => {
        if (this.missionState.isGameOver) {
          return;
        }
        this.spawnCivilianFromPlan(spawn, config);
      });
    }
  }

  trySpawnOppositeAtmosphere() {
    if (!this.scene.roadSystem?.isDivided() || this.scene.player?.mode === 'boat') {
      return;
    }

    if (Phaser.Math.FloatBetween(0, 1) > 0.32) {
      return;
    }

    this.trySpawnCivilian({ spawnTarget: 'opposite_side', atmospheric: true });
  }

  getCurrentPool() {
    return getCivilianPool(this.scene.player?.mode, {
      segment: this.missionState.currentSegment,
      environmentProfile: this.missionState.environmentProfile,
    });
  }

  createLaneCenters() {
    const laneWidth = (ROAD.right - ROAD.left) / ROAD.laneCount;
    return Array.from({ length: ROAD.laneCount }, (_, index) => ROAD.left + laneWidth * index + laneWidth / 2);
  }

  getLaneCenters(spawnTarget = 'player_side') {
    return this.scene.roadSystem?.getLaneCentersForTarget(spawnTarget, this.scene.player?.sprite.x)
      ?? this.createLaneCenters();
  }

  trySpawnCivilian(config = {}) {
    if (this.vehicles.length >= TRAFFIC.maxActiveVehicles) {
      return;
    }

    this.laneCenters = this.getLaneCenters(config.spawnTarget ?? this.spawnTarget);
    const pool = this.getCurrentPool();
    const civilianType = pool[this.spawnCount % pool.length];
    const openLanes = this.getOpenLanes(civilianType);
    if (openLanes.length === 0) {
      return;
    }

    const lane = Phaser.Utils.Array.GetRandom(openLanes);
    const baseSpeed = config.atmospheric
      ? Phaser.Math.Between(TRAFFIC.minVehicleSpeed - 20, TRAFFIC.maxVehicleSpeed - 10)
      : Phaser.Math.Between(TRAFFIC.minVehicleSpeed, TRAFFIC.maxVehicleSpeed);
    const speed = baseSpeed * (civilianType.speedMultiplier ?? 1);
    const vehicle = this.spawnCivilianAt(this.laneCenters[lane], -42, {
      lane,
      speed,
      civilianType,
      spawnTarget: config.spawnTarget ?? this.spawnTarget,
      atmospheric: Boolean(config.atmospheric),
      tintIndex: this.spawnCount,
      personality: config.personality,
    });
    this.spawnCount += 1;
    this.missionState.eventHistory.push({
      type: 'trafficSpawned',
      vehicleType: vehicle.type,
      civilianType: civilianType.id,
      lane,
      spawnTarget: config.spawnTarget ?? this.spawnTarget,
      at: this.missionState.elapsedTime,
    });
  }

  spawnCivilianFromPlan(spawn, config = {}) {
    if (this.vehicles.length >= TRAFFIC.maxActiveVehicles) {
      return;
    }

    this.laneCenters = this.getLaneCenters(config.spawnTarget ?? this.spawnTarget);
    if (!this.isLaneOpen(spawn.lane, spawn.civilianType)) {
      return;
    }

    const baseSpeed = config.atmospheric
      ? Phaser.Math.Between(TRAFFIC.minVehicleSpeed - 20, TRAFFIC.maxVehicleSpeed - 10)
      : Phaser.Math.Between(TRAFFIC.minVehicleSpeed, TRAFFIC.maxVehicleSpeed);
    const speed = baseSpeed * (spawn.civilianType.speedMultiplier ?? 1) * (spawn.speedScale ?? 1);
    const vehicle = this.spawnCivilianAt(this.laneCenters[spawn.lane], -42, {
      lane: spawn.lane,
      speed,
      civilianType: spawn.civilianType,
      spawnTarget: config.spawnTarget ?? this.spawnTarget,
      atmospheric: Boolean(config.atmospheric),
      tintIndex: this.spawnCount,
      personality: spawn.personality,
      targetX: this.getLaneTargetForPersonality(spawn.lane, spawn.personality),
    });
    this.spawnCount += 1;
    this.missionState.eventHistory.push({
      type: 'trafficSpawned',
      flow: this.missionState.currentTrafficFlow?.label,
      personality: spawn.personality,
      vehicleType: vehicle.type,
      civilianType: spawn.civilianType.id,
      lane: spawn.lane,
      spawnTarget: config.spawnTarget ?? this.spawnTarget,
      at: this.missionState.elapsedTime,
    });
  }

  getLaneTargetForPersonality(lane, personality) {
    if (!['aggressive', 'commuter', 'service'].includes(personality)) {
      return this.laneCenters[lane];
    }

    const direction = personality === 'service' ? 1 : Phaser.Math.Between(0, 1) === 0 ? -1 : 1;
    const targetLane = Phaser.Math.Clamp(lane + direction, 0, this.laneCenters.length - 1);
    if (targetLane === lane || !this.isLaneOpen(targetLane)) {
      return this.laneCenters[lane];
    }
    return this.laneCenters[targetLane];
  }

  spawnCivilianAt(x, y, config = {}) {
    const vehicle = new CivilianVehicle(this.scene, x, y, config);
    this.vehicles.push(vehicle);
    this.group.add(vehicle.sprite);
    return vehicle;
  }

  getOpenLanes(civilianType = null) {
    return this.laneCenters
      .map((_, lane) => lane)
      .filter((lane) => this.isLaneOpen(lane, civilianType));
  }

  isLaneOpen(lane, civilianType = null) {
    const spawnGap = TRAFFIC.safeSpawnGap + Math.max(0, (civilianType?.bodyHeight ?? 44) - 44);
    const blockedByTraffic = this.vehicles.some((vehicle) => {
      return vehicle.lane === lane && vehicle.sprite.y < spawnGap;
    });
    if (blockedByTraffic) {
      return false;
    }

    const laneX = this.laneCenters[lane];
    if (this.scene.infrastructurePressureSystem?.isLaneBlockedForSpawn(laneX)) {
      return false;
    }

    const blockedByEnemies = this.scene.combatSystem?.enemies.some((enemy) => {
      return enemy.sprite.active
        && Math.abs(enemy.sprite.x - laneX) < 40
        && enemy.sprite.y < spawnGap + 95;
    });
    if (blockedByEnemies) {
      return false;
    }

    return !this.scene.supportSystem?.vans.some((van) => {
      return van.sprite.active
        && Math.abs(van.sprite.x - laneX) < 40
        && van.sprite.y < spawnGap + 95;
    });
  }

  scheduleNextSpawn() {
    const multiplier = this.missionState.getSpawnMultiplier('traffic');
    const delay = Phaser.Math.Between(TRAFFIC.minSpawnDelayMs, TRAFFIC.maxSpawnDelayMs)
      / (multiplier * this.flowDirector.getDelayScale() * (this.missionState.difficulty.trafficSpawnScale ?? 1));
    this.nextSpawnAt = this.scene.time.now + delay;
  }

  removeVehicle(sprite) {
    const index = this.vehicles.findIndex((vehicle) => vehicle.sprite === sprite);
    if (index >= 0) {
      this.removeVehicleAt(index);
    }
  }

  removeVehicleAt(index) {
    const [vehicle] = this.vehicles.splice(index, 1);
    vehicle.destroy();
  }
}
