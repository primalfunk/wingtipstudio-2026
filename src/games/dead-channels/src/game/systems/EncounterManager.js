import { runConfig } from '../config/run.js';

export class EncounterManager {
  constructor({ rng, config = runConfig }) {
    this.rng = rng;
    this.config = config;
    this.encounters = this.generateSequence();
    this.currentIndex = 0;
  }

  getCurrentEncounter() {
    return this.encounters[this.currentIndex] ?? null;
  }

  advance() {
    this.currentIndex += 1;
    return this.getCurrentEncounter();
  }

  hasNextEncounter() {
    return this.currentIndex < this.encounters.length - 1;
  }

  getTotalEncounters() {
    return this.encounters.length + 1;
  }

  generateSequence() {
    const sequence = this.config.encounterTypes.slice(0, this.config.totalEncounters);

    while (sequence.length < this.config.totalEncounters) {
      sequence.push(this.rng.pick(['normal', 'fork', 'pressure', 'recovery']));
    }

    return sequence.map((type, index) => this.createEncounter(type, index));
  }

  createEncounter(type, index) {
    const requiredResolutions = this.config.baseEncounterResolutions
      + Math.floor(index * this.config.encounterResolutionGrowth)
      + (type === 'pressure' ? 1 : 0);
    const speedMultiplier = this.config.baseSpeedMultiplier + index * this.config.speedGrowthPerEncounter;

    return {
      index,
      type,
      requiredResolutions,
      progress: 0,
      speedMultiplier,
      forkEvery: this.config.forkFrequencyByEncounter[type] ?? 4,
      finale: false
    };
  }

  createFinale() {
    const index = this.encounters.length;
    return {
      index,
      type: 'finale',
      requiredResolutions: this.config.finaleResolutions,
      progress: 0,
      speedMultiplier: this.config.baseSpeedMultiplier
        + index * this.config.speedGrowthPerEncounter
        + this.config.finaleSpeedBonus,
      forkEvery: this.config.forkFrequencyByEncounter.finale,
      finale: true
    };
  }
}
