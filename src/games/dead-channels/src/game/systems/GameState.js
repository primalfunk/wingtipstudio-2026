export class GameState {
  constructor(seed = `run-${Date.now().toString(36)}`) {
    this.currentScene = 'BootScene';
    this.mode = 'boot';
    this.seed = seed;
    this.runSeed = seed;
    this.runElapsedMs = 0;
    this.encounterIndex = 0;
    this.encounterType = 'normal';
    this.encounterProgress = 0;
    this.encounterRequired = 0;
    this.totalEncounters = 0;
    this.result = '';
    this.score = 0;
    this.integrity = 100;
    this.flow = 0;
    this.instability = 0;
    this.instabilityBand = 'STABLE';
    this.maxInstability = 0;
    this.hazardsTriggered = 0;
    this.hazardsCleared = 0;
    this.lastHazardType = '';
    this.powerupsAcquired = 0;
    this.powerupsActivated = 0;
    this.activePowerups = [];
    this.passivePowerups = [];
    this.mistakesForgiven = 0;
    this.compressionTriggers = 0;
    this.signalAnchorTriggers = 0;
    this.overclockUses = 0;
    this.overclockTimeMs = 0;
    this.forkSplitterUses = 0;
    this.forkSplitterBranchesCreated = 0;
    this.startingKit = 'Flow Runner';
    this.upgradesAcquired = 0;
    this.acquiredUpgrades = [];
    this.dominantArchetype = 'Flow Runner';
    this.archetypeScores = {};
    this.perfectPhraseBonusesEarned = 0;
    this.hazardsReducedByUpgrades = 0;
    this.routeRerollsUsed = 0;
    this.overclockExtensionMs = 0;
    this.upgradeDebug = null;
    this.multiStreamEncountersCompleted = 0;
    this.hazardStreamsResolved = 0;
    this.hazardStreamsMissed = 0;
    this.repairStreamsCompleted = 0;
    this.rewardStreamsCompleted = 0;
    this.archiveStreamsDecoded = 0;
    this.totalStreamSwitches = 0;
    this.archiveFragmentsDecoded = [];
    this.biomesEncountered = [];
    this.hardestPhraseCompleted = 0;
    this.completedPhraseDifficultyTotal = 0;
    this.completedPhraseDifficultyCount = 0;
    this.lastContentId = '';
    this.lastContentBiome = '';
    this.timeInInstabilityBands = {
      stable: 0,
      unsteady: 0,
      corrupted: 0,
      critical: 0
    };
    this.elapsedTime = 0;
    this.typingElapsedTime = 0;
    this.typingClockActive = false;
    this.correctInputCount = 0;
    this.totalInputCount = 0;
    this.mistakeCount = 0;
    this.completedPhraseCount = 0;
    this.missedPhraseCount = 0;
    this.phrasesCompleted = 0;
    this.phrasesMissed = 0;
    this.forksResolved = 0;
    this.encountersCompleted = 0;
    this.normalPhraseResolutionsSinceFork = 0;
    this.forkCount = 0;
    this.routeHistory = [];
    this.routeCounts = {
      safe: 0,
      reward: 0,
      repair: 0,
      archive: 0,
      corruption: 0
    };
    this.lastRouteConsequence = '';
    this.highestFlow = 0;
    this.streak = 0;
    this.hasTyped = false;
  }

  addRouteToHistory(routeType) {
    this.routeHistory = [routeType, ...this.routeHistory].slice(0, 5);
    this.routeCounts[routeType] = (this.routeCounts[routeType] ?? 0) + 1;
  }

  setFlow(value) {
    this.flow = Math.max(0, value);
    this.highestFlow = Math.max(this.highestFlow, this.flow);
  }

  addFlow(value) {
    this.setFlow(this.flow + value);
  }

  syncPowerupStats(powerupManager) {
    const debugInfo = powerupManager.getDebugInfo();
    this.powerupsAcquired = powerupManager.stats.acquired;
    this.powerupsActivated = powerupManager.stats.activated;
    this.activePowerups = powerupManager.activeSlots.map((powerup) => powerup.name);
    this.passivePowerups = powerupManager.passives.map((powerup) => powerup.name);
    this.mistakesForgiven = powerupManager.stats.mistakesForgiven;
    this.compressionTriggers = powerupManager.stats.compressionTriggers;
    this.signalAnchorTriggers = powerupManager.stats.signalAnchorTriggers;
    this.overclockUses = powerupManager.stats.overclockUses;
    this.overclockTimeMs = powerupManager.stats.overclockTimeMs;
    this.forkSplitterUses = powerupManager.stats.forkSplitterUses;
    this.forkSplitterBranchesCreated = powerupManager.stats.forkSplitterBranchesCreated;
    this.powerupDebug = debugInfo;
  }

  syncUpgradeStats(upgradeManager) {
    const debugInfo = upgradeManager.getDebugInfo();
    this.startingKit = debugInfo.startingKit === '(none)' ? this.startingKit : debugInfo.startingKit;
    this.upgradesAcquired = upgradeManager.stats.acquired;
    this.acquiredUpgrades = [...upgradeManager.acquired.values()].map(({ definition, stacks }) => (
      `${definition.name}${stacks > 1 ? ` x${stacks}` : ''}`
    ));
    this.dominantArchetype = debugInfo.dominantArchetype;
    this.archetypeScores = debugInfo.archetypeScores;
    this.perfectPhraseBonusesEarned = upgradeManager.stats.perfectPhraseBonusesEarned;
    this.hazardsReducedByUpgrades = upgradeManager.stats.hazardsReducedByUpgrades;
    this.routeRerollsUsed = upgradeManager.stats.routeRerollsUsed;
    this.overclockExtensionMs = upgradeManager.stats.overclockExtensionMs;
    this.upgradeDebug = debugInfo;
  }

  getWpm() {
    if (this.typingElapsedTime <= 0) {
      return 0;
    }

    return Math.round((this.correctInputCount / 5) / (this.typingElapsedTime / 60));
  }

  getAccuracy() {
    if (this.totalInputCount <= 0) {
      return 100;
    }

    return Math.round((this.correctInputCount / this.totalInputCount) * 100);
  }

  addBiome(biome) {
    if (biome && !this.biomesEncountered.includes(biome)) {
      this.biomesEncountered.push(biome);
    }
  }

  recordCompletedContent(entry) {
    if (!entry) {
      return;
    }

    this.lastContentId = entry.id;
    this.lastContentBiome = entry.biome;
    this.addBiome(entry.biome);
    this.hardestPhraseCompleted = Math.max(this.hardestPhraseCompleted, entry.difficulty ?? 0);
    this.completedPhraseDifficultyTotal += entry.difficulty ?? 0;
    this.completedPhraseDifficultyCount += 1;
  }

  getAveragePhraseDifficulty() {
    if (!this.completedPhraseDifficultyCount) {
      return 0;
    }

    return Math.round((this.completedPhraseDifficultyTotal / this.completedPhraseDifficultyCount) * 10) / 10;
  }
}
