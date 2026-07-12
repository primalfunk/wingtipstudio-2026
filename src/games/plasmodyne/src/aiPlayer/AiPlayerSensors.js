import Phaser from 'phaser';

export class AiPlayerSensors {
  constructor(scene, config = {}) {
    this.scene = scene;
    this.usesOmniscience = config.usesOmniscience ?? false;
  }

  read() {
    const player = this.scene.player;
    const body = player.bodyData;
    const position = { x: player.sprite.x, y: player.sprite.y };
    const room = this.scene.mapSystem?.getRoomAt(position.x, position.y) ?? null;
    const visibleDroids = this.getVisibleDroids(position);
    const hostiles = (this.scene.droids ?? []).filter((droid) => !droid.data.neutralized);
    return {
      time: this.scene.time.now,
      seed: this.scene.seed,
      player,
      body,
      position,
      deck: this.scene.currentDeck,
      room,
      isRespawning: this.scene.isRespawning,
      isChangingDeck: this.scene.isChangingDeck,
      isTransferOpen: this.scene.transferOverlay?.isVisible() ?? false,
      isLiftOpen: this.scene.liftOverlay?.isVisible() ?? false,
      integrityRatio: body.integrity / Math.max(1, body.maxIntegrity),
      weaponTier: body.weaponTier ?? 'WEAPON_0',
      weaponType: body.weaponType ?? 'none',
      visibleDroids,
      hostiles,
      nearbyLift: this.scene.getNearbyLift?.() ?? null,
      nearbyTerminal: this.scene.getNearbyTerminal?.() ?? null,
      nearbyDoor: this.scene.getNearbyDoor?.() ?? null,
      repairPads: (this.scene.currentDeck.fixtures ?? []).filter((fixture) => fixture.type === 'repair-pad'),
      score: this.scene.runStats.score,
      deaths: this.scene.runStats.totalDeaths
    };
  }

  getVisibleDroids(position) {
    const droids = (this.scene.droids ?? []).filter((droid) => !droid.data.neutralized);
    if (this.usesOmniscience) {
      return droids;
    }
    return droids.filter((droid) => {
      const distance = Phaser.Math.Distance.Between(position.x, position.y, droid.sprite.x, droid.sprite.y);
      if (distance > 520) {
        return false;
      }
      return this.scene.visionSystem?.canSee(
        position,
        { x: droid.sprite.x, y: droid.sprite.y },
        distance + 4,
        this.scene.player.facingAngle
      ) ?? true;
    });
  }
}
