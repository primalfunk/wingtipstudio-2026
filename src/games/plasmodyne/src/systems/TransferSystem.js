import Phaser from 'phaser';
import { TRANSFER } from '../data/constants.js';

export class TransferSystem {
  constructor(scene) {
    this.scene = scene;
    this.cooldownUntil = 0;
    this.activeTarget = null;
  }

  canStart(time) {
    return time >= this.cooldownUntil && !this.scene.transferOverlay.isVisible();
  }

  findTarget(mode = 'cursor', point = null) {
    const pointer = this.scene.input.activePointer;
    const cursor = point ?? this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const player = this.scene.player.sprite;
    const facing = this.scene.player.facingAngle;
    let best = null;
    let bestScore = Infinity;

    for (const droid of this.scene.droids ?? []) {
      if (droid.data.neutralized) {
        continue;
      }
      const distanceToPlayer = Phaser.Math.Distance.Between(player.x, player.y, droid.sprite.x, droid.sprite.y);
      if (distanceToPlayer > TRANSFER.range) {
        continue;
      }
      let score;
      if (mode === 'facing') {
        const angleToDroid = Phaser.Math.Angle.Between(player.x, player.y, droid.sprite.x, droid.sprite.y);
        const angleDelta = Math.abs(Phaser.Math.Angle.Wrap(angleToDroid - facing));
        if (angleDelta > 0.7) {
          continue;
        }
        score = angleDelta * 180 + distanceToPlayer * 0.35;
      } else {
        const cursorDistance = Phaser.Math.Distance.Between(cursor.x, cursor.y, droid.sprite.x, droid.sprite.y);
        score = cursorDistance + distanceToPlayer * 0.25;
      }
      if (score < bestScore) {
        best = droid;
        bestScore = score;
      }
    }

    return best && (mode === 'facing' || bestScore <= 170) ? best : null;
  }

  start(time, mode = 'cursor') {
    if (!this.canStart(time)) {
      return false;
    }

    const target = this.findTarget(mode);
    if (!target) {
      this.scene.showWorldMessage('NO TRANSFER TARGET');
      this.cooldownUntil = time + 350;
      return false;
    }

    this.scene.runStats.transfersAttempted += 1;
    this.activeTarget = target;
    this.scene.combat.clearProjectiles();
    this.scene.freezeTransferEncounter?.(target);
    target.sprite.setTint(0xffd36a);
    this.scene.audio?.playTransferAcquired();
    this.scene.transferOverlay.show(this.createChallenge(target), target.data, this.scene.player.bodyData);
    return true;
  }

  startWithTarget(time, target) {
    if (!target || !this.canStart(time)) {
      return false;
    }
    this.scene.runStats.transfersAttempted += 1;
    this.activeTarget = target;
    this.scene.combat.clearProjectiles();
    this.scene.freezeTransferEncounter?.(target);
    target.sprite.setTint(0xffd36a);
    this.scene.audio?.playTransferAcquired();
    this.scene.transferOverlay.show(this.createChallenge(target), target.data, this.scene.player.bodyData);
    return true;
  }

  getSeriesFromRank(rank) {
    return Phaser.Math.Clamp(Math.floor((rank ?? 0) / 100), 0, 9);
  }

  createChallenge(target) {
    const difficulty = this.calculateDifficulty(target);
    const slotCount = Phaser.Math.Clamp(7 + Math.floor(difficulty / 70) * 2, 7, 9);
    const centerSlots = [];
    const defenderBias = Math.floor(difficulty / 55);
    for (let i = 0; i < slotCount; i += 1) {
      const owner = (i + defenderBias) % 2 === 0 ? 'yellow' : 'purple';
      centerSlots.push({
        id: `slot-${i}`,
        index: i,
        owner,
        lockedUntilEnd: false,
        lastChangedTime: 0,
        blockedUntil: 0,
        connectedPathIds: []
      });
    }

    const sendersLeft = [];
    const sendersRight = [];
    const paths = [];
    const forkBudgets = {
      left: Phaser.Math.Clamp(1 + Math.floor(difficulty / 80), 1, 2),
      right: Phaser.Math.Clamp(1 + Math.floor(difficulty / 72), 1, 3)
    };
    const featureBudgets = {
      left: {
        switchBoxes: difficulty >= 35 ? 1 : 0,
        repeaters: 1,
        colorFixers: difficulty >= 90 ? 1 : 0,
        persistentArrows: 0,
        deadEnds: difficulty >= 95 ? 1 : 0
      },
      right: {
        switchBoxes: difficulty >= 50 ? 1 : 0,
        repeaters: difficulty >= 25 ? 1 : 0,
        colorFixers: difficulty >= 85 ? 1 : 0,
        persistentArrows: 0,
        deadEnds: difficulty >= 115 ? 1 : 0
      }
    };
    const usedForkLanes = { left: new Set(), right: new Set() };
    const forkTargetLanes = { left: new Set(), right: new Set() };
    for (const side of ['left', 'right']) {
      for (let i = 0; i < slotCount; i += 1) {
        const sender = {
          id: `${side}-sender-${i}`,
          side,
          laneIndex: i,
          enabled: true
        };
        const path = forkTargetLanes[side].has(i)
          ? this.createDeadEndPath(side, sender, i)
          : this.createPath(side, sender, i, slotCount, difficulty, forkBudgets, usedForkLanes, featureBudgets);
        sender.pathId = path.id;
        if (path.hasFork) {
          for (const targetSlotId of path.targetSlotIds) {
            if (targetSlotId !== i) {
              forkTargetLanes[side].add(targetSlotId);
            }
          }
        }
        for (const slotId of path.targetSlotIds) {
          centerSlots[slotId].connectedPathIds.push(path.id);
        }
        paths.push(path);
        if (side === 'left') {
          sendersLeft.push(sender);
        } else {
          sendersRight.push(sender);
        }
      }
    }

    return {
      difficulty,
      sideSelected: false,
      playerSide: null,
      opponentSide: null,
      playerColor: null,
      opponentColor: null,
      playerPlugsTotal: 3 + this.getSeriesFromRank(this.scene.player.bodyData.rank ?? 1),
      opponentPlugsTotal: 3 + this.getSeriesFromRank(target.data.template.rank),
      plugsRemaining: { left: 0, right: 0 },
      selectTimerMs: 60000,
      matchTimerMs: 10000,
      claimHoldMs: 1100,
      startedAt: 0,
      matchStartedAt: 0,
      phaseStartedAt: 0,
      centerSlots,
      sendersLeft,
      sendersRight,
      paths,
      activePulses: [],
      state: 'selectingSide',
      pulseSpeed: Phaser.Math.Clamp(0.62 + difficulty / 520, 0.62, 0.9),
      aiDelayMs: Phaser.Math.Clamp(3800 - difficulty * 18, 760, 3800)
    };
  }

  createDeadEndPath(side, sender, laneIndex) {
    return {
      id: `${side}-path-${laneIndex}`,
      side,
      senderId: sender.id,
      segments: [],
      targetSlotIds: [],
      hasFork: false,
      nestedFork: false,
      terminates: true,
      contestedUntil: 0,
      switchBoxes: [],
      persistentArrows: [],
      repeaters: [],
      colorFixers: [],
      claimMode: 'regular',
      reservedByFork: true
    };
  }

  createPath(side, sender, laneIndex, slotCount, difficulty, forkBudgets, usedForkLanes, featureBudgets) {
    const sideFeatures = featureBudgets[side];
    let terminates = false;
    const targetSlotIds = [laneIndex];
    const canForkDown = laneIndex < slotCount - 1;
    const canForkUp = laneIndex > 0;
    const forkLaneA = canForkDown ? laneIndex : laneIndex - 1;
    const forkLaneB = forkLaneA + 1;
    const forkClear = forkLaneA >= 0 &&
      forkLaneB < slotCount &&
      !usedForkLanes[side].has(forkLaneA - 1) &&
      !usedForkLanes[side].has(forkLaneA) &&
      !usedForkLanes[side].has(forkLaneB) &&
      !usedForkLanes[side].has(forkLaneB + 1);
    const forkPattern = side === 'left'
      ? laneIndex % 4 === 1
      : laneIndex % 4 === 2;
    if (forkBudgets[side] > 0 && forkClear && forkPattern && (canForkDown || canForkUp)) {
      targetSlotIds.length = 0;
      targetSlotIds.push(forkLaneA, forkLaneB);
      forkBudgets[side] -= 1;
      usedForkLanes[side].add(forkLaneA);
      usedForkLanes[side].add(forkLaneB);
    }
    const deadEndPattern = side === 'left' ? laneIndex % 6 === 4 : laneIndex % 6 === 1;
    if (!targetSlotIds.length || (sideFeatures.deadEnds > 0 && deadEndPattern && !targetSlotIds.includes(Math.floor(slotCount / 2)))) {
      terminates = true;
      targetSlotIds.length = 0;
      sideFeatures.deadEnds -= 1;
    }

    const path = {
      id: `${side}-path-${laneIndex}`,
      side,
      senderId: sender.id,
      segments: [],
      targetSlotIds: [...new Set(targetSlotIds)].sort((a, b) => a - b),
      hasFork: targetSlotIds.length > 1,
      nestedFork: false,
      terminates,
      contestedUntil: 0,
      switchBoxes: [],
      persistentArrows: [],
      repeaters: [],
      colorFixers: [],
      claimMode: 'regular'
    };
    this.decoratePath(path, laneIndex, slotCount, sideFeatures);
    return path;
  }

  decoratePath(path, laneIndex, slotCount, sideFeatures) {
    if (!path.targetSlotIds.length) {
      return;
    }
    const stagger = path.side === 'left' ? laneIndex : slotCount - 1 - laneIndex;
    if (sideFeatures.repeaters > 0 && stagger % 4 === 0) {
      path.repeaters.push({ at: 0.42, flashUntil: 0 });
      sideFeatures.repeaters -= 1;
    }
    if (sideFeatures.switchBoxes > 0 && stagger % 4 === 1) {
      path.switchBoxes.push({ at: 0.48, flashUntil: 0 });
      sideFeatures.switchBoxes -= 1;
    }
    if (sideFeatures.colorFixers > 0 && stagger % 4 === 2) {
      path.colorFixers.push({
        at: 0.54,
        color: path.side === 'left' ? 'purple' : 'yellow',
        flashUntil: 0
      });
      sideFeatures.colorFixers -= 1;
    }
    if (sideFeatures.persistentArrows > 0 && stagger % 4 === 3) {
      path.persistentArrows.push({ at: 0.58, flashUntil: 0 });
      sideFeatures.persistentArrows -= 1;
    }
  }

  calculateDifficulty(target) {
    const targetTemplate = target.data.template;
    const playerRank = this.scene.player.bodyData.rank ?? 1;
    const rankJump = Math.max(0, targetTemplate.rank - playerRank);
    const damagePercent = 1 - target.data.currentIntegrity / targetTemplate.maxIntegrity;
    return Phaser.Math.Clamp(targetTemplate.possessionResistance + rankJump * 0.05 - damagePercent * 30, 8, 160);
  }

  complete(success) {
    const target = this.activeTarget;
    this.activeTarget = null;
    this.cooldownUntil = this.scene.time.now + TRANSFER.cooldownMs;

    if (!target || target.data.neutralized) {
      this.scene.releaseTransferEncounterLock?.();
      return;
    }

    target.sprite.clearTint();
    if (success) {
      this.scene.audio?.playTransferSuccess();
      this.scene.completeTransferSuccess(target);
    } else {
      this.scene.audio?.playTransferFail();
      this.scene.completeTransferFailure(target);
      this.scene.releaseTransferEncounterLock?.();
    }
  }

  cancel() {
    if (this.activeTarget?.sprite?.active) {
      this.activeTarget.sprite.clearTint();
    }
    this.scene.releaseTransferEncounterLock?.();
    this.activeTarget = null;
    this.cooldownUntil = this.scene.time.now + TRANSFER.cooldownMs;
  }
}
