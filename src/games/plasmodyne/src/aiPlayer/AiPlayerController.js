import Phaser from 'phaser';
import { INTERACTION, PLAYER, TRANSFER } from '../data/constants.js';
import { getWeapon } from '../data/weaponTypes.js';
import { AiPlayerSensors } from './AiPlayerSensors.js';
import { AiPlayerStrategy } from './AiPlayerStrategy.js';
import { AiPlayerPathfinder } from './AiPlayerPathfinder.js';
import { AiPlayerMetrics } from './AiPlayerMetrics.js';
import { AiPlayerReporter } from './AiPlayerReporter.js';

const DECISION_MS = 180;
const STUCK_MS = 4200;
const MAX_RUN_MS = 20 * 60 * 1000;

export class AiPlayerController {
  constructor(scene, config = {}) {
    this.scene = scene;
    this.config = {
      strategy: 'STANDARD_TESTER',
      usesOmniscience: false,
      maxRunMs: MAX_RUN_MS,
      ...config
    };
    this.sensors = new AiPlayerSensors(scene, this.config);
    this.strategy = new AiPlayerStrategy(scene);
    this.pathfinder = new AiPlayerPathfinder(scene);
    this.metrics = new AiPlayerMetrics(scene, this.config);
    this.enabled = false;
    this.intent = { type: 'wait' };
    this.path = [];
    this.pathGoal = null;
    this.nextDecisionAt = 0;
    this.lastMovedAt = scene.time.now;
    this.lastPosition = { x: scene.player.sprite.x, y: scene.player.sprite.y };
    this.lastCaptureAt = 0;
    this.lastFireAt = 0;
    this.reportedDone = false;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.scene.player.setAiControlEnabled?.(enabled);
    if (enabled) {
      this.metrics.log('ai_enabled');
      this.scene.showWorldMessage?.('AI PLAYER ENABLED');
    } else {
      this.scene.player.clearAiControl?.();
      this.metrics.log('ai_disabled');
      this.scene.showWorldMessage?.('AI PLAYER DISABLED');
    }
  }

  update(time, delta) {
    if (!this.enabled) {
      return;
    }
    this.metrics.update();
    if (time - this.metrics.startedAt > this.config.maxRunMs) {
      this.finish('timeout', 'Max runtime reached');
      return;
    }
    if (this.scene.getShipHostileCount?.() === 0) {
      this.finish('cleared', 'All hostiles neutralized');
      return;
    }

    const snapshot = this.sensors.read();
    this.driveModalSystems(snapshot, time);
    if (snapshot.isRespawning || snapshot.isChangingDeck || snapshot.isTransferOpen || snapshot.isLiftOpen) {
      this.scene.player.setAiControl?.({ x: 0, y: 0 });
      return;
    }

    if (time >= this.nextDecisionAt) {
      this.intent = this.strategy.chooseIntent(snapshot);
      this.nextDecisionAt = time + DECISION_MS;
      this.updatePathForIntent(snapshot);
    }

    this.executeIntent(snapshot, time);
    this.detectStuck(snapshot, time);
  }

  driveModalSystems(snapshot, time) {
    if (this.scene.transferOverlay?.isVisible()) {
      this.driveTransferOverlay(time);
    }
    if (this.scene.liftOverlay?.isVisible()) {
      this.chooseLiftDestination();
    }
  }

  updatePathForIntent(snapshot) {
    const target = this.getIntentPoint(this.intent);
    if (!target) {
      this.path = [];
      this.pathGoal = null;
      return;
    }
    if (this.pathGoal && Phaser.Math.Distance.Between(target.x, target.y, this.pathGoal.x, this.pathGoal.y) < 24 && this.path.length) {
      return;
    }
    this.pathGoal = target;
    this.path = this.pathfinder.pathTo(target);
    if (!this.path.length && Phaser.Math.Distance.Between(snapshot.position.x, snapshot.position.y, target.x, target.y) > 72) {
      this.metrics.markPathFailure({ intent: this.intent.type, target });
    }
  }

  executeIntent(snapshot, time) {
    if (this.intent.type === 'attack') {
      this.attackTarget(this.intent.target, time);
    } else if (this.intent.type === 'capture') {
      this.captureTarget(this.intent.target, time);
    } else if (this.intent.type === 'flee') {
      this.fleeFrom(this.intent.target);
      return;
    } else if (this.intent.type === 'lift') {
      this.useLift(this.intent.target);
    } else if (this.intent.type === 'repair') {
      if (Phaser.Math.Distance.Between(snapshot.position.x, snapshot.position.y, this.intent.target.x, this.intent.target.y) < 34) {
        this.scene.player.setAiControl?.({ x: 0, y: 0 });
        return;
      }
    }
    this.followPath();
  }

  attackTarget(target, time) {
    if (!target || target.data.neutralized) {
      return;
    }
    const weapon = getWeapon(this.scene.player.bodyData.weaponType);
    if (weapon.type === 'none') {
      return;
    }
    const distance = Phaser.Math.Distance.Between(this.scene.player.sprite.x, this.scene.player.sprite.y, target.sprite.x, target.sprite.y);
    const desired = Math.min(weapon.range * 0.72, 340);
    this.scene.player.facingAngle = Phaser.Math.Angle.Between(this.scene.player.sprite.x, this.scene.player.sprite.y, target.sprite.x, target.sprite.y);
    if (distance <= weapon.range && time - this.lastFireAt > 1000 / Math.max(1, weapon.fireRate)) {
      if (this.scene.combat.firePlayerAtPoint({ x: target.sprite.x, y: target.sprite.y }, time)) {
        this.lastFireAt = time;
      }
    }
    if (distance < desired * 0.55) {
      this.fleeFrom(target, 0.55);
    }
  }

  captureTarget(target, time) {
    if (!target || target.data.neutralized) {
      return;
    }
    const distance = Phaser.Math.Distance.Between(this.scene.player.sprite.x, this.scene.player.sprite.y, target.sprite.x, target.sprite.y);
    if (distance <= TRANSFER.range * 0.86 && time - this.lastCaptureAt > 2800) {
      this.metrics.markCaptureAttempt(target);
      this.scene.transferSystem.startWithTarget(time, target);
      this.lastCaptureAt = time;
      this.scene.player.setAiControl?.({ x: 0, y: 0 });
    }
  }

  useLift(lift) {
    if (!lift) {
      return;
    }
    const distance = Phaser.Math.Distance.Between(this.scene.player.sprite.x, this.scene.player.sprite.y, lift.x, lift.y);
    if (distance <= INTERACTION.range) {
      this.scene.tryUseLift(lift);
      this.scene.player.setAiControl?.({ x: 0, y: 0 });
    }
  }

  chooseLiftDestination() {
    const overlay = this.scene.liftOverlay;
    const destinations = overlay?.destinationDecks ?? [];
    if (!destinations.length || !overlay.lift) {
      return;
    }
    const destination = destinations.find((deck) => !deck.cleared && deck.id !== this.scene.currentDeck.id) ??
      destinations.find((deck) => deck.id !== this.scene.currentDeck.id);
    if (destination) {
      const networkId = overlay.lift.networkId;
      this.metrics.log('lift_used', { from: this.scene.currentDeck.id, to: destination.id, shaft: networkId });
      overlay.hide();
      this.scene.changeDeck(destination.id, networkId);
    }
  }

  driveTransferOverlay(time) {
    const overlay = this.scene.transferOverlay;
    if (!overlay?.visible) {
      return;
    }
    if (!this.nextTransferActionAt) {
      this.nextTransferActionAt = time + 420;
    }
    if (time < this.nextTransferActionAt) {
      return;
    }
    if (overlay.state === 'playerCard' || overlay.state === 'targetCard') {
      overlay.advanceCard();
      this.nextTransferActionAt = time + 360;
      return;
    }
    if (overlay.state === 'selectingSide') {
      overlay.selectSide('left');
      this.nextTransferActionAt = time + 240;
      return;
    }
    if (overlay.state === 'running') {
      const paths = overlay.getSidePaths(overlay.challenge.playerSide)
        .filter((path) => !path.terminates)
        .sort((a, b) => this.pathValue(b) - this.pathValue(a));
      const path = paths[0];
      if (path) {
        overlay.activatePath(path, overlay.challenge.playerSide, overlay.challenge.playerColor);
      }
      this.nextTransferActionAt = time + 520;
    }
  }

  pathValue(path) {
    return (path.hasFork ? 60 : 0) +
      (path.persistentArrows?.length ? 45 : 0) -
      (path.switchBoxes?.length ? 18 : 0) +
      (path.targetSlotIds?.length ?? 0) * 12;
  }

  followPath() {
    if (!this.path.length) {
      const target = this.getIntentPoint(this.intent);
      if (!target) {
        this.scene.player.setAiControl?.({ x: 0, y: 0 });
        return;
      }
      this.moveToward(target);
      return;
    }
    const next = this.path[0];
    if (Phaser.Math.Distance.Between(this.scene.player.sprite.x, this.scene.player.sprite.y, next.x, next.y) < 10) {
      this.path.shift();
    }
    this.openNearbyDoor();
    this.moveToward(this.path[0] ?? this.getIntentPoint(this.intent));
  }

  moveToward(point) {
    if (!point) {
      this.scene.player.setAiControl?.({ x: 0, y: 0 });
      return;
    }
    const vector = new Phaser.Math.Vector2(point.x - this.scene.player.sprite.x, point.y - this.scene.player.sprite.y);
    if (vector.lengthSq() < 9) {
      this.scene.player.setAiControl?.({ x: 0, y: 0 });
      return;
    }
    vector.normalize();
    this.scene.player.setAiControl?.({ x: vector.x, y: vector.y });
    this.scene.player.facingAngle = Phaser.Math.Angle.Between(0, 0, vector.x, vector.y);
  }

  fleeFrom(target, scale = 1) {
    const source = target?.sprite ?? target;
    const vector = new Phaser.Math.Vector2(this.scene.player.sprite.x - source.x, this.scene.player.sprite.y - source.y);
    if (vector.lengthSq() < 1) {
      vector.set(1, 0);
    }
    vector.normalize().scale(scale);
    this.scene.player.setAiControl?.({ x: vector.x, y: vector.y });
  }

  openNearbyDoor() {
    const door = this.scene.getNearbyDoor?.();
    if (door) {
      this.scene.tryOpenDoor(door);
    }
  }

  getIntentPoint(intent) {
    if (!intent) {
      return null;
    }
    if (intent.type === 'attack' || intent.type === 'capture' || intent.type === 'approach-hostile' || intent.type === 'flee') {
      return intent.target?.sprite ? { x: intent.target.sprite.x, y: intent.target.sprite.y } : null;
    }
    if (intent.type === 'lift' || intent.type === 'repair' || intent.type === 'explore') {
      return intent.target ? { x: intent.target.x, y: intent.target.y } : null;
    }
    return null;
  }

  detectStuck(snapshot, time) {
    const moved = Phaser.Math.Distance.Between(snapshot.position.x, snapshot.position.y, this.lastPosition.x, this.lastPosition.y);
    if (moved > 18) {
      this.lastMovedAt = time;
      this.lastPosition = { ...snapshot.position };
      return;
    }
    if (time - this.lastMovedAt > STUCK_MS && this.intent.type !== 'wait') {
      this.metrics.markStuck({ intent: this.intent.type, position: snapshot.position });
      this.path = [];
      this.pathGoal = null;
      this.nextDecisionAt = 0;
      this.lastMovedAt = time;
    }
  }

  finish(result, reason) {
    this.metrics.finish(result, reason);
    this.setEnabled(false);
    if (!this.reportedDone) {
      this.reportedDone = true;
      AiPlayerReporter.export(this.metrics);
    }
  }

  exportReport() {
    return AiPlayerReporter.export(this.metrics);
  }
}
