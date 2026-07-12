import { runConfig } from '../config/run.js';
import { EncounterManager } from './EncounterManager.js';
import { SeededRng } from './SeededRng.js';

export const RUN_STATE = {
  IDLE: 'idle',
  STARTING: 'starting',
  ENCOUNTER: 'encounter',
  ENCOUNTER_COMPLETE: 'encounterComplete',
  FINALE: 'finale',
  WON: 'won',
  LOST: 'lost'
};

export class RunManager {
  constructor({ seed = RunManager.createSeed(), config = runConfig } = {}) {
    this.config = config;
    this.seed = seed;
    this.rng = new SeededRng(seed);
    this.encounterManager = new EncounterManager({ rng: this.rng, config });
    this.state = RUN_STATE.IDLE;
    this.currentEncounter = null;
    this.elapsedMs = 0;
    this.summary = null;
  }

  static createSeed() {
    return `run-${Date.now().toString(36)}`;
  }

  start() {
    this.state = RUN_STATE.STARTING;
    this.elapsedMs = 0;
    this.currentEncounter = this.encounterManager.getCurrentEncounter();
    this.state = RUN_STATE.ENCOUNTER;
    return this.currentEncounter;
  }

  update(deltaMs) {
    if (this.state === RUN_STATE.ENCOUNTER || this.state === RUN_STATE.FINALE) {
      this.elapsedMs += deltaMs;
    }
  }

  recordResolution() {
    if (!this.currentEncounter || this.isEnded()) {
      return { encounterComplete: false, runComplete: false };
    }

    this.currentEncounter.progress += 1;

    if (this.currentEncounter.progress < this.currentEncounter.requiredResolutions) {
      return { encounterComplete: false, runComplete: false };
    }

    if (this.currentEncounter.finale) {
      this.state = RUN_STATE.WON;
      return { encounterComplete: true, runComplete: true, result: 'won' };
    }

    this.state = RUN_STATE.ENCOUNTER_COMPLETE;
    return { encounterComplete: true, runComplete: false };
  }

  advanceEncounter() {
    if (this.encounterManager.hasNextEncounter()) {
      this.currentEncounter = this.encounterManager.advance();
      this.state = RUN_STATE.ENCOUNTER;
      return this.currentEncounter;
    }

    this.currentEncounter = this.encounterManager.createFinale();
    this.state = RUN_STATE.FINALE;
    return this.currentEncounter;
  }

  lose() {
    this.state = RUN_STATE.LOST;
    return { result: 'lost' };
  }

  win() {
    this.state = RUN_STATE.WON;
    return { result: 'won' };
  }

  isEnded() {
    return this.state === RUN_STATE.WON || this.state === RUN_STATE.LOST;
  }

  getSummary(gameState) {
    const durationSeconds = Math.round(this.elapsedMs / 1000);
    return {
      result: this.state === RUN_STATE.WON ? 'stabilized' : 'lost',
      finalScore: gameState.score,
      seed: this.seed,
      encountersCompleted: gameState.encountersCompleted,
      phrasesCompleted: gameState.phrasesCompleted,
      phrasesMissed: gameState.phrasesMissed,
      forksResolved: gameState.forksResolved,
      routeCounts: { ...gameState.routeCounts },
      accuracy: gameState.getAccuracy(),
      wpm: gameState.getWpm(),
      highestFlow: gameState.highestFlow,
      finalInstability: gameState.instability,
      maxInstability: gameState.maxInstability,
      hazardsTriggered: gameState.hazardsTriggered,
      hazardsCleared: gameState.hazardsCleared,
      finalInstabilityBand: gameState.instabilityBand,
      powerupsAcquired: gameState.powerupsAcquired,
      powerupsActivated: gameState.powerupsActivated,
      mistakesForgiven: gameState.mistakesForgiven,
      compressionTriggers: gameState.compressionTriggers,
      signalAnchorTriggers: gameState.signalAnchorTriggers,
      overclockTimeSeconds: Math.round(gameState.overclockTimeMs / 1000),
      forkSplitterBranchesCreated: gameState.forkSplitterBranchesCreated,
      startingKit: gameState.startingKit,
      upgradesAcquired: gameState.acquiredUpgrades,
      dominantArchetype: gameState.dominantArchetype,
      archetypeScores: { ...gameState.archetypeScores },
      perfectPhraseBonusesEarned: gameState.perfectPhraseBonusesEarned,
      hazardsReducedByUpgrades: gameState.hazardsReducedByUpgrades,
      routeRerollsUsed: gameState.routeRerollsUsed,
      overclockExtensionSeconds: Math.round(gameState.overclockExtensionMs / 1000),
      multiStreamEncountersCompleted: gameState.multiStreamEncountersCompleted,
      hazardStreamsResolved: gameState.hazardStreamsResolved,
      hazardStreamsMissed: gameState.hazardStreamsMissed,
      repairStreamsCompleted: gameState.repairStreamsCompleted,
      rewardStreamsCompleted: gameState.rewardStreamsCompleted,
      archiveStreamsDecoded: gameState.archiveStreamsDecoded,
      totalStreamSwitches: gameState.totalStreamSwitches,
      archiveFragmentsDecoded: gameState.archiveFragmentsDecoded,
      biomesEncountered: gameState.biomesEncountered,
      hardestPhraseCompleted: gameState.hardestPhraseCompleted,
      averagePhraseDifficulty: gameState.getAveragePhraseDifficulty(),
      runDurationSeconds: durationSeconds
    };
  }

  getDebugInfo() {
    return {
      state: this.state,
      encounterIndex: this.currentEncounter?.index ?? 0,
      encounterType: this.currentEncounter?.type ?? '(none)',
      encounterProgress: this.currentEncounter?.progress ?? 0,
      encounterRequired: this.currentEncounter?.requiredResolutions ?? 0,
      totalEncounters: this.encounterManager.getTotalEncounters(),
      speedMultiplier: this.currentEncounter?.speedMultiplier ?? 1,
      forkFrequency: this.currentEncounter?.forkEvery ?? 0,
      runSeed: this.seed,
      rngState: this.rng.state,
      finaleActive: this.currentEncounter?.finale ?? false
    };
  }
}
