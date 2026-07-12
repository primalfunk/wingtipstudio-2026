import Phaser from 'phaser';
import { DROID_GENERATION } from '../data/constants.js';
import { TILE_TYPES } from '../data/tileTypes.js';
import { getDroidVisualKeys } from '../graphics/droidAnimationAssets.js';
import { DroidVisual } from './DroidVisual.js';
import { getWeapon } from '../data/weaponTypes.js';
import { getSeriesDigitColor, DROID_STATE_DIGIT_COLORS } from '../data/droids/droidSeriesColors.js';
import {
  DROID_BEHAVIOR_PROFILES,
  canAggroLeaveHome,
  canTemplateUseRepairPads,
  getBehaviorProfileForTemplate
} from '../systems/ai/DroidBehaviorProfiles.js';
import { DroidPathfinder, worldToCell } from '../systems/ai/DroidPathfinder.js';

const REPAIR_SEEK_THRESHOLD = 0.4;
const REPAIR_STOP_THRESHOLD = 0.85;
const REPATH_MS = 850;

export class Droid {
  constructor(scene, data, room) {
    this.scene = scene;
    this.data = data;
    this.room = room;
    this.state = data.state;
    this.nextDecisionAt = 0;
    this.targetPoint = { x: data.x, y: data.y };
    this.facingAngle = 0;
    this.path = [];
    this.pathGoal = null;
    this.nextRepathAt = 0;
    this.stuckTimer = 0;
    this.lastPathDistance = Infinity;
    this.aiProfile = data.aiProfile ?? getBehaviorProfileForTemplate(data.template);
    this.data.aiProfile = this.aiProfile;
    this.homeRoomId = data.homeRoomId ?? data.roomId ?? room?.id ?? null;
    this.currentRoomId = data.currentRoomId ?? this.homeRoomId;
    this.allowedDeckId = data.allowedDeckId ?? data.deckId;
    this.allowedRegionId = data.allowedRegionId ?? this.findRegionIdForRoom(this.homeRoomId);
    this.canUseDoors = data.canUseDoors ?? true;
    this.canUseElevators = false;
    this.canUseRepairPads = data.canUseRepairPads ?? canTemplateUseRepairPads(data.template);
    this.patrolRoomIds = data.patrolRoomIds ?? this.createPatrolRoomIds();
    this.guardPosition = data.guardPosition ?? { x: data.x, y: data.y };
    this.guardRadius = data.guardRadius ?? this.getDefaultGuardRadius();
    this.repairTarget = null;
    this.repairCooldownUntil = 0;
    this.lastSafePosition = { x: data.x, y: data.y };
    this.baseDigitColor = data.baseDigitColor ?? getSeriesDigitColor(data.template.rank);
    this.data.baseDigitColor = this.baseDigitColor;
    this.data.isAggro = Boolean(data.isAggro);
    this.data.lastSeenPlayerTime = data.lastSeenPlayerTime ?? 0;

    const visualKeys = getDroidVisualKeys(data.template.rank);
    this.sprite = scene.physics.add.sprite(data.x, data.y, visualKeys.textureKey, 0);
    this.sprite.play(visualKeys.animationKey);
    this.sprite.setDisplaySize(DROID_GENERATION.radius * 2, DROID_GENERATION.radius * 2);
    this.applyCollisionCircle();
    this.sprite.body.setAllowGravity(false);
    this.sprite.setBounce(0.2);
    this.sprite.setMaxVelocity(data.template.speed);
    this.sprite.setDepth(8);
    this.visual = new DroidVisual(scene, this.sprite, {
      displayId: data.template.displayId,
      radius: DROID_GENERATION.radius,
      fontSize: 16,
      strokeThickness: 2,
      textDepth: 14,
      capDepth: 12,
      ringDepth: 11,
      ringAlpha: 0.32,
      ringTint: data.template.accentColor,
      numberColor: this.baseDigitColor,
      numberShadowColor: DROID_STATE_DIGIT_COLORS.shadow
    });
    this.visual.setWeaponDefinition(getWeapon(data.template.weaponType));
  }

  update(time, delta, player) {
    if (this.data.neutralized) {
      this.sprite.setVelocity(0, 0);
      return;
    }

    this.updateCurrentRoom();
    const detected = this.canDetectPlayer(player);
    if (detected) {
      this.setAggro(time);
      this.state = this.getAlertState();
    } else {
      this.data.detectionMemory = Math.max(0, this.data.detectionMemory - delta);
      if (this.data.detectionMemory <= 0) {
        this.data.isAggro = false;
      }
      if (this.data.detectionMemory <= 0 && this.isCombatState()) {
        this.state = this.getDefaultState();
        this.clearPath();
      }
    }

    if (this.state === 'pursuing') {
      this.updatePursuit(time, player);
    } else if (this.state === 'fleeing') {
      this.moveAwayFrom(player.sprite.x, player.sprite.y);
      this.face(player.sprite.x, player.sprite.y);
    } else if (this.state === 'alerted') {
      this.updateAlerted(time, player);
    } else if (this.shouldSeekRepair(time)) {
      this.updateRepairBehavior(time, delta);
    } else {
      this.updateProfileBehavior(time);
    }

    this.updateStuckHandling(delta);
    this.updateScanArc(delta);
    this.syncData();
  }

  updateScanArc(delta) {
    this.visual.update(this.sprite.x, this.sprite.y, this.data.template.displayId, 0, this.facingAngle);
    this.visual.setAggroState(
      this.data.isAggro,
      this.baseDigitColor,
      DROID_STATE_DIGIT_COLORS.aggro,
      DROID_STATE_DIGIT_COLORS.aggroFlash,
      DROID_STATE_DIGIT_COLORS.shadow
    );
  }

  applyCollisionCircle() {
    const collisionRadius = DROID_GENERATION.collisionRadius ?? DROID_GENERATION.radius;
    const offset = Math.max(0, this.sprite.width / 2 - collisionRadius);
    this.sprite.setCircle(collisionRadius, offset, offset);
    this.sprite.body?.setBounce(0.2, 0.2);
  }

  getAlertState() {
    if (this.data.template.weaponType === 'none') {
      return 'fleeing';
    }
    if (!canAggroLeaveHome(this.aiProfile, this.data.template)) {
      return 'alerted';
    }
    return 'pursuing';
  }

  getDefaultState() {
    if (this.aiProfile === DROID_BEHAVIOR_PROFILES.GUARD) return 'guard';
    return 'patrol';
  }

  isCombatState() {
    return this.state === 'pursuing' || this.state === 'fleeing' || this.state === 'alerted';
  }

  updatePursuit(time, player) {
    this.followPathTo(player.sprite.x, player.sprite.y, time, 0.82);
    this.face(player.sprite.x, player.sprite.y);
  }

  updateAlerted(time, player) {
    this.face(player.sprite.x, player.sprite.y);
    if (this.aiProfile === DROID_BEHAVIOR_PROFILES.GUARD &&
      Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.guardPosition.x, this.guardPosition.y) > this.guardRadius) {
      this.followPathTo(this.guardPosition.x, this.guardPosition.y, time, 0.45);
      return;
    }
    this.sprite.setVelocity(0, 0);
  }

  updateProfileBehavior(time) {
    switch (this.aiProfile) {
      case DROID_BEHAVIOR_PROFILES.GUARD:
        this.updateGuard(time);
        break;
      case DROID_BEHAVIOR_PROFILES.SINGLE_ROOM_PATROL:
        this.updateSingleRoomPatrol(time);
        break;
      case DROID_BEHAVIOR_PROFILES.MULTI_ROOM_PATROL:
        this.updateMultiRoomPatrol(time);
        break;
      case DROID_BEHAVIOR_PROFILES.LEVEL_PATROL:
        this.updateLevelPatrol(time);
        break;
      case DROID_BEHAVIOR_PROFILES.WANDER:
      default:
        this.updateWander(time);
        break;
    }
  }

  updateGuard(time) {
    const distance = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.guardPosition.x, this.guardPosition.y);
    if (distance > this.guardRadius * 0.55) {
      this.followPathTo(this.guardPosition.x, this.guardPosition.y, time, 0.46);
      return;
    }
    if (time >= this.nextDecisionAt) {
      this.nextDecisionAt = time + Phaser.Math.Between(1400, 2800);
      this.targetPoint = this.pickPointNear(this.guardPosition, Math.min(80, this.guardRadius * 0.35)) ?? this.guardPosition;
    }
    this.moveOrIdleToward(this.targetPoint, 0.28);
  }

  updateSingleRoomPatrol(time) {
    if (time >= this.nextDecisionAt || this.isNearTarget(16)) {
      this.nextDecisionAt = time + Phaser.Math.Between(1200, 3000);
      this.targetPoint = this.pickRoomPoint(this.homeRoomId);
      this.clearPath();
    }
    this.moveOrIdleToward(this.targetPoint, 0.38);
  }

  updateMultiRoomPatrol(time) {
    if (time >= this.nextDecisionAt || this.isNearTarget(18)) {
      this.nextDecisionAt = time + Phaser.Math.Between(1500, 3400);
      const roomId = Phaser.Utils.Array.GetRandom(this.patrolRoomIds) ?? this.homeRoomId;
      this.targetPoint = this.pickRoomPoint(roomId);
      this.clearPath();
    }
    this.followPathTo(this.targetPoint.x, this.targetPoint.y, time, 0.48);
  }

  updateLevelPatrol(time) {
    if (time >= this.nextDecisionAt || this.isNearTarget(22)) {
      this.nextDecisionAt = time + Phaser.Math.Between(1600, 3600);
      this.targetPoint = this.pickRegionPoint() ?? this.pickRoomPoint(this.homeRoomId);
      this.clearPath();
    }
    this.followPathTo(this.targetPoint.x, this.targetPoint.y, time, 0.54);
  }

  updateWander(time) {
    if (time >= this.nextDecisionAt || this.isNearTarget(16)) {
      this.nextDecisionAt = time + Phaser.Math.Between(1700, 4200);
      this.targetPoint = this.pickPointNear({ x: this.sprite.x, y: this.sprite.y }, 130) ?? this.pickRoomPoint(this.homeRoomId);
      this.clearPath();
    }
    this.followPathTo(this.targetPoint.x, this.targetPoint.y, time, 0.35);
  }

  shouldSeekRepair(time) {
    if (!this.canUseRepairPads || time < this.repairCooldownUntil || this.data.isAggro) {
      return false;
    }
    const health = this.data.currentIntegrity / Math.max(1, this.data.template.maxIntegrity);
    return health > 0 && health < REPAIR_SEEK_THRESHOLD;
  }

  updateRepairBehavior(time, delta) {
    if (!this.repairTarget) {
      this.repairTarget = DroidPathfinder.findNearestRepairPad(this.scene.currentDeck, this.sprite, {
        avoidLiftPads: true,
        allowedRegionId: this.allowedRegionId
      });
      this.clearPath();
      if (!this.repairTarget) {
        this.repairCooldownUntil = time + 7000;
        return;
      }
    }

    const distance = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.repairTarget.x, this.repairTarget.y);
    if (distance > 20) {
      this.followPathTo(this.repairTarget.x, this.repairTarget.y, time, 0.52);
      return;
    }

    this.sprite.setVelocity(0, 0);
    this.face(this.repairTarget.x, this.repairTarget.y);
    this.data.currentIntegrity = Math.min(
      this.data.template.maxIntegrity,
      this.data.currentIntegrity + 8 * (delta / 1000)
    );
    const health = this.data.currentIntegrity / Math.max(1, this.data.template.maxIntegrity);
    if (health >= REPAIR_STOP_THRESHOLD) {
      this.repairTarget = null;
      this.repairCooldownUntil = time + 9000;
      this.nextDecisionAt = 0;
    }
  }

  followPathTo(x, y, time, speedMultiplier = 0.5) {
    const goalChanged = !this.pathGoal ||
      Phaser.Math.Distance.Between(x, y, this.pathGoal.x, this.pathGoal.y) > 28;
    if (goalChanged || time >= this.nextRepathAt || this.path.length === 0) {
      this.pathGoal = { x, y };
      this.path = DroidPathfinder.findPath(this.scene.currentDeck, this.sprite, this.pathGoal, {
        avoidLiftPads: true,
        allowedRegionId: this.allowedRegionId
      });
      this.nextRepathAt = time + REPATH_MS;
    }

    if (this.path.length === 0) {
      this.moveOrIdleToward({ x, y }, speedMultiplier * 0.75);
      return;
    }

    const next = this.path[0];
    this.requestDoorOpenForPoint(next, time);
    if (Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, next.x, next.y) < 10) {
      this.path.shift();
    }
    const target = this.path[0] ?? { x, y };
    this.moveToward(target.x, target.y, speedMultiplier);
    this.face(target.x, target.y);
  }

  requestDoorOpenForPoint(point, time) {
    if (!this.canUseDoors || !this.scene.currentDeck?.tileMap) {
      return;
    }
    const tileSize = this.scene.currentDeck.tileMap.tileSize;
    const cell = worldToCell(point.x, point.y, tileSize);
    const tile = this.scene.currentDeck.tileMap.tiles[cell.y]?.[cell.x];
    if (tile?.tileType !== TILE_TYPES.DOOR && !tile?.doorId) {
      return;
    }
    const doorEntity = this.scene.doorEntities?.find((door) => door.data.id === tile.doorId);
    doorEntity?.forceOpen(time, 1400);
  }

  moveOrIdleToward(point, multiplier) {
    if (!point || Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, point.x, point.y) < 10) {
      this.sprite.setVelocity(0, 0);
      return;
    }
    this.moveToward(point.x, point.y, multiplier);
    this.face(point.x, point.y);
  }

  canDetectPlayer(player) {
    const observer = { x: this.sprite.x, y: this.sprite.y };
    const target = { x: player.sprite.x, y: player.sprite.y };
    if (this.scene.visionSystem) {
      return this.scene.visionSystem.canSee(observer, target, this.data.template.sensorRange, this.facingAngle);
    }
    return Phaser.Math.Distance.Between(observer.x, observer.y, target.x, target.y) <= this.data.template.sensorRange;
  }

  setAggro(time = this.scene.time.now) {
    this.data.isAggro = true;
    this.data.lastSeenPlayerTime = time;
    this.data.detectionMemory = 2400;
    this.repairTarget = null;
  }

  pickRoomPoint(roomId = this.homeRoomId) {
    const cells = DroidPathfinder.collectRoomCells(this.scene.currentDeck, roomId);
    const point = Phaser.Utils.Array.GetRandom(cells);
    if (point) {
      return point;
    }
    const room = this.scene.currentDeck.rooms.find((item) => item.id === roomId) ?? this.room;
    const padding = DROID_GENERATION.roomEdgePadding;
    return {
      x: Phaser.Math.Between(Math.ceil(room.x + padding), Math.floor(room.x + room.width - padding)),
      y: Phaser.Math.Between(Math.ceil(room.y + padding), Math.floor(room.y + room.height - padding))
    };
  }

  pickRegionPoint() {
    const cells = this.allowedRegionId
      ? DroidPathfinder.collectRegionCells(this.scene.currentDeck, this.allowedRegionId)
      : DroidPathfinder.collectRoomClusterCells(this.scene.currentDeck, this.patrolRoomIds);
    return Phaser.Utils.Array.GetRandom(cells) ?? null;
  }

  pickPointNear(origin, radius) {
    const cells = this.allowedRegionId
      ? DroidPathfinder.collectRegionCells(this.scene.currentDeck, this.allowedRegionId)
      : DroidPathfinder.collectRoomCells(this.scene.currentDeck, this.homeRoomId);
    const candidates = cells.filter((cell) => Phaser.Math.Distance.Between(origin.x, origin.y, cell.x, cell.y) <= radius);
    return Phaser.Utils.Array.GetRandom(candidates) ?? null;
  }

  createPatrolRoomIds() {
    if (!this.scene.currentDeck?.regions?.length) {
      return [this.homeRoomId].filter(Boolean);
    }
    const regionId = this.findRegionIdForRoom(this.homeRoomId);
    const region = this.scene.currentDeck.regions.find((item) => item.id === regionId);
    const roomIds = region?.roomIds?.length ? region.roomIds : [this.homeRoomId];
    if (this.aiProfile === DROID_BEHAVIOR_PROFILES.MULTI_ROOM_PATROL) {
      const shuffled = Phaser.Utils.Array.Shuffle([...roomIds]);
      return shuffled.slice(0, Phaser.Math.Clamp(shuffled.length, 2, 4));
    }
    return roomIds;
  }

  findRegionIdForRoom(roomId) {
    return this.scene.currentDeck?.regions?.find((region) => region.roomIds?.includes(roomId))?.id ?? null;
  }

  getDefaultGuardRadius() {
    const series = Math.floor(this.data.template.rank / 100);
    if (series >= 8) return 360;
    if (series >= 6) return 260;
    return 190;
  }

  updateCurrentRoom() {
    const room = this.scene.mapSystem?.getRoomAt(this.sprite.x, this.sprite.y);
    if (room) {
      this.currentRoomId = room.id;
      this.data.currentRoomId = room.id;
      this.data.roomId = room.id;
    }
  }

  updateStuckHandling(delta) {
    if (!this.pathGoal || this.sprite.body.speed < 6) {
      this.stuckTimer += delta;
    } else {
      const distance = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.pathGoal.x, this.pathGoal.y);
      this.stuckTimer = distance >= this.lastPathDistance - 1 ? this.stuckTimer + delta : 0;
      this.lastPathDistance = distance;
    }

    if (this.stuckTimer > 1300) {
      this.clearPath();
      this.nextDecisionAt = 0;
      this.stuckTimer = 0;
      this.repairTarget = null;
    }
  }

  isNearTarget(distance) {
    return Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.targetPoint.x, this.targetPoint.y) < distance;
  }

  clearPath() {
    this.path = [];
    this.pathGoal = null;
    this.nextRepathAt = 0;
    this.lastPathDistance = Infinity;
  }

  moveToward(x, y, multiplier = 1) {
    const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, x, y);
    const speed = this.data.template.speed * multiplier;
    this.sprite.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }

  moveAwayFrom(x, y) {
    const angle = Phaser.Math.Angle.Between(x, y, this.sprite.x, this.sprite.y);
    const speed = this.data.template.speed * 0.85;
    this.sprite.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
  }

  face(x, y) {
    this.facingAngle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, x, y);
  }

  syncData() {
    this.data.x = this.sprite.x;
    this.data.y = this.sprite.y;
    this.data.state = this.state;
    this.data.aiProfile = this.aiProfile;
    this.data.homeRoomId = this.homeRoomId;
    this.data.currentRoomId = this.currentRoomId;
    this.data.allowedRegionId = this.allowedRegionId;
    this.data.patrolRoomIds = this.patrolRoomIds;
    this.data.guardPosition = this.guardPosition;
    this.data.guardRadius = this.guardRadius;
    this.data.canUseDoors = this.canUseDoors;
    this.data.canUseElevators = false;
    this.data.canUseRepairPads = this.canUseRepairPads;
  }

  flash(color = 0xffffff) {
    this.sprite.setTint(color);
    this.scene.time.delayedCall(90, () => {
      if (this.sprite?.active) {
        this.sprite.clearTint();
      }
    });
  }

  dimColor(color, factor = 0.72) {
    const r = Math.round(((color >> 16) & 255) * factor);
    const g = Math.round(((color >> 8) & 255) * factor);
    const b = Math.round((color & 255) * factor);
    return (r << 16) | (g << 8) | b;
  }

  destroy() {
    this.syncData();
    if (this.sprite?.active) {
      this.sprite.destroy();
    }
    this.visual?.destroy();
  }
}
