import Phaser from 'phaser';

export class AiPlayerStrategy {
  constructor(scene) {
    this.scene = scene;
  }

  chooseIntent(sensors) {
    if (sensors.isRespawning || sensors.isChangingDeck || sensors.isTransferOpen || sensors.isLiftOpen) {
      return { type: 'wait' };
    }

    const repair = this.chooseRepairPad(sensors);
    if (repair) {
      return { type: 'repair', target: repair };
    }

    const captureTarget = this.chooseCaptureTarget(sensors);
    if (captureTarget) {
      return { type: 'capture', target: captureTarget };
    }

    const attackTarget = this.chooseAttackTarget(sensors);
    if (attackTarget) {
      return { type: sensors.weaponType === 'none' ? 'flee' : 'attack', target: attackTarget };
    }

    if (sensors.hostiles.length > 0) {
      const target = this.chooseNearestDroid(sensors.hostiles, sensors.position);
      return { type: 'approach-hostile', target };
    }

    const lift = this.chooseLift(sensors);
    if (lift) {
      return { type: 'lift', target: lift };
    }

    return { type: 'explore', target: this.chooseExplorePoint(sensors) };
  }

  chooseRepairPad(sensors) {
    if (sensors.integrityRatio > 0.42 || !sensors.repairPads.length) {
      return null;
    }
    return sensors.repairPads.reduce((best, pad) => {
      const distance = Phaser.Math.Distance.Between(sensors.position.x, sensors.position.y, pad.x, pad.y);
      return !best || distance < best.distance ? { ...pad, distance } : best;
    }, null);
  }

  chooseCaptureTarget(sensors) {
    if (sensors.body.rank >= 400 && sensors.integrityRatio > 0.55) {
      return null;
    }
    const candidates = sensors.visibleDroids
      .filter((droid) => droid.data.template.rank > sensors.body.rank || sensors.body.weaponType === 'none')
      .filter((droid) => Phaser.Math.Distance.Between(sensors.position.x, sensors.position.y, droid.sprite.x, droid.sprite.y) < 460)
      .sort((a, b) => this.captureScore(b, sensors) - this.captureScore(a, sensors));
    return candidates[0] ?? null;
  }

  chooseAttackTarget(sensors) {
    if (!sensors.visibleDroids.length) {
      return null;
    }
    return this.chooseNearestDroid(sensors.visibleDroids, sensors.position);
  }

  chooseNearestDroid(droids, position) {
    return droids.reduce((best, droid) => {
      const distance = Phaser.Math.Distance.Between(position.x, position.y, droid.sprite.x, droid.sprite.y);
      return !best || distance < best.distance ? { droid, distance } : best;
    }, null)?.droid ?? null;
  }

  chooseLift(sensors) {
    const unclearedDeck = this.scene.ship.decks.find((deck) => !deck.cleared && deck.id !== sensors.deck.id);
    if (!unclearedDeck) {
      return null;
    }
    return sensors.deck.lifts.find((lift) => lift.connectsToDeckIds.includes(unclearedDeck.id)) ??
      sensors.deck.lifts.find((lift) => lift.connectsToDeckIds.some((id) => id !== sensors.deck.id)) ??
      null;
  }

  chooseExplorePoint(sensors) {
    const rooms = sensors.deck.rooms.filter((room) => !room.discovered);
    const room = rooms[0] ?? sensors.deck.rooms[Math.floor((this.scene.time.now / 3000) % Math.max(1, sensors.deck.rooms.length))];
    return room ? { x: room.centerX, y: room.centerY } : { x: sensors.position.x, y: sensors.position.y };
  }

  captureScore(droid, sensors) {
    const rankGain = droid.data.template.rank - sensors.body.rank;
    const damageBonus = 1 - droid.data.currentIntegrity / Math.max(1, droid.data.template.maxIntegrity);
    return rankGain + damageBonus * 120 - droid.data.template.possessionResistance * 0.25;
  }
}
