import { PLAYER_MODES } from '../data/tuning.js';
import DifficultySystem from './DifficultySystem.js';

export default class MissionState {
  constructor() {
    this.elapsedTime = 0;
    this.distance = 0;
    this.score = 0;
    this.playerDamage = 0;
    this.playerLives = 3;
    this.playerMode = 'car';
    this.difficulty = DifficultySystem.getPreset();
    this.maxPlayerDamage = PLAYER_MODES.car.maxHealth;
    this.playerFuel = 100;
    this.maxPlayerAmmo = PLAYER_MODES.car.maxAmmo;
    this.playerAmmo = PLAYER_MODES.car.maxAmmo;
    this.enemiesDestroyed = 0;
    this.supportContacts = 0;
    this.currentSegmentId = 'phase1_foundation';
    this.currentSegment = null;
    this.currentPacingPhase = null;
    this.pacingSpawnProfile = {};
    this.supportTrust = 1;
    this.roadSignTrust = 1;
    this.enemyAwareness = 0;
    this.playerTendencies = {};
    this.eventHistory = [];
    this.isGameOver = false;
  }

  update(delta) {
    if (this.isGameOver) {
      return;
    }

    const seconds = delta / 1000;
    this.elapsedTime += seconds;
    this.distance += seconds * 0.14;
  }

  applyDamage(amount, source) {
    if (this.isGameOver) {
      return { damaged: false, lifeLost: false, gameOver: true };
    }

    const previousDamage = this.playerDamage;
    const scaledAmount = amount * this.difficulty.damageScale;
    this.playerDamage = Math.min(this.maxPlayerDamage, this.playerDamage + scaledAmount);
    const previousWholeLifeLost = Math.floor(previousDamage);
    const currentWholeLifeLost = Math.floor(this.playerDamage);
    const lifeLost = currentWholeLifeLost > previousWholeLifeLost;
    this.eventHistory.push({
      type: 'playerDamage',
      amount: scaledAmount,
      source,
      at: this.elapsedTime,
    });

    if (this.playerDamage >= this.maxPlayerDamage) {
      this.isGameOver = true;
    }

    return {
      damaged: scaledAmount > 0,
      lifeLost,
      gameOver: this.isGameOver,
    };
  }

  setPlayerMode(mode, { refillHealth = true, refillAmmo = true } = {}) {
    const profile = PLAYER_MODES[mode] ?? PLAYER_MODES.car;
    this.playerMode = mode;
    this.maxPlayerDamage = Math.max(1, Number((profile.maxHealth * (this.difficulty.playerHealthScale ?? 1)).toFixed(2)));
    this.maxPlayerAmmo = profile.maxAmmo;
    if (refillHealth) {
      this.playerDamage = 0;
    } else {
      this.playerDamage = Math.min(this.playerDamage, this.maxPlayerDamage);
    }
    if (refillAmmo) {
      this.playerAmmo = this.maxPlayerAmmo;
    } else {
      this.playerAmmo = Math.min(this.playerAmmo, this.maxPlayerAmmo);
    }
  }

  loseLife() {
    this.playerLives = Math.max(0, this.playerLives - 1);
    this.eventHistory.push({
      type: 'playerLifeLost',
      livesRemaining: this.playerLives,
      at: this.elapsedTime,
    });
    if (this.playerLives <= 0) {
      this.isGameOver = true;
    }
    return this.playerLives;
  }

  addScore(amount) {
    this.score += amount;
  }

  getSpawnMultiplier(key) {
    return (this.currentSegment?.spawnProfile?.[key] ?? 1)
      * (this.pacingSpawnProfile?.[key] ?? 1);
  }

  applySupportReward({ serviceType }) {
    if (serviceType === 'ammo') {
      this.playerAmmo = this.maxPlayerAmmo;
    } else if (serviceType === 'upgrade') {
      this.setPlayerMode('car');
    } else {
      this.playerDamage = 0;
    }
    this.supportContacts += 1;
    this.eventHistory.push({
      type: 'supportCollected',
      serviceType: ['ammo', 'upgrade'].includes(serviceType) ? serviceType : 'repair',
      at: this.elapsedTime,
    });
  }

  applyDecoySupportPenalty({ ammoAmount, awarenessIncrease }) {
    this.playerAmmo = Math.min(this.maxPlayerAmmo, this.playerAmmo + ammoAmount);
    this.enemyAwareness = Math.min(1, this.enemyAwareness + awarenessIncrease);
    this.supportContacts += 1;
    this.eventHistory.push({
      type: 'decoySupportAccepted',
      ammoAmount,
      awarenessIncrease,
      at: this.elapsedTime,
    });
  }
}
