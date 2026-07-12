import { createDefaultProfile } from '../config/defaultProfile.js';
import { persistenceConfig } from '../config/persistence.js';
import { archiveFragments } from '../content/archiveFragments.js';
import { unlockDefinitions } from '../content/unlocks.js';

export class ProfileManager {
  constructor({ config = persistenceConfig, unlocks = unlockDefinitions } = {}) {
    this.config = config;
    this.unlocks = unlocks;
    this.profile = createDefaultProfile();
    this.loaded = false;
    this.storageAvailable = false;
    this.warning = '';
    this.lastSaveAt = '';
    this.lastUnlocks = [];
    this.lastNewArchiveFragments = [];
    this.lastRunWasBestScore = false;
  }

  load() {
    this.storageAvailable = this.checkStorageAvailable();
    if (!this.storageAvailable) {
      this.warning = 'localStorage unavailable; using in-memory profile';
      this.loaded = true;
      return this.profile;
    }

    try {
      const raw = window.localStorage.getItem(this.config.storageKey);
      if (!raw) {
        this.profile = this.repairProfile(createDefaultProfile());
        this.loaded = true;
        this.save();
        return this.profile;
      }

      const parsed = JSON.parse(raw);
      this.profile = this.repairProfile(this.migrateProfile(parsed));
      this.loaded = true;
      this.save();
      return this.profile;
    } catch (error) {
      this.warning = `Profile load failed: ${error.message}`;
      this.backupCorruptedSave();
      this.profile = this.repairProfile(createDefaultProfile());
      this.loaded = true;
      this.save();
      return this.profile;
    }
  }

  migrateProfile(profile) {
    if (!profile || typeof profile !== 'object') {
      return createDefaultProfile();
    }

    if (!Number.isFinite(profile.version)) {
      return { ...createDefaultProfile(), ...profile, version: this.config.saveVersion };
    }

    return { ...profile, version: this.config.saveVersion };
  }

  repairProfile(profile) {
    const defaults = createDefaultProfile();
    const repaired = {
      ...defaults,
      ...profile,
      settings: {
        ...defaults.settings,
        ...(profile.settings ?? {})
      },
      runHistory: Array.isArray(profile.runHistory) ? profile.runHistory : [],
      archiveFragmentsCollected: Array.isArray(profile.archiveFragmentsCollected) ? profile.archiveFragmentsCollected : [],
      unlockedKits: Array.isArray(profile.unlockedKits) ? profile.unlockedKits : defaults.unlockedKits,
      unlockedPowerups: Array.isArray(profile.unlockedPowerups) ? profile.unlockedPowerups : defaults.unlockedPowerups,
      unlockedUpgrades: Array.isArray(profile.unlockedUpgrades) ? profile.unlockedUpgrades : defaults.unlockedUpgrades,
      unlockedModifiers: Array.isArray(profile.unlockedModifiers) ? profile.unlockedModifiers : defaults.unlockedModifiers,
      unlockedVisualThemes: Array.isArray(profile.unlockedVisualThemes) ? profile.unlockedVisualThemes : defaults.unlockedVisualThemes
    };

    for (const unlock of this.unlocks) {
      if (unlock.initiallyUnlocked) {
        this.addUnlockToProfile(repaired, unlock.type, unlock.unlockId);
      }
    }

    if (repaired.totalRuns === 0 && ['standard', 'beginner', 'assist'].includes(repaired.settings.difficultyMode)) {
      repaired.settings.difficultyMode = defaults.settings.difficultyMode;
    }

    repaired.version = this.config.saveVersion;
    return repaired;
  }

  save() {
    this.profile.updatedAt = new Date().toISOString();
    this.lastSaveAt = this.profile.updatedAt;

    if (!this.config.autosaveEnabled || !this.storageAvailable) {
      return false;
    }

    try {
      window.localStorage.setItem(this.config.storageKey, JSON.stringify(this.profile));
      return true;
    } catch (error) {
      this.warning = `Profile save failed: ${error.message}`;
      return false;
    }
  }

  resetProfile() {
    if (this.storageAvailable) {
      window.localStorage.removeItem(this.config.storageKey);
    }
    this.profile = this.repairProfile(createDefaultProfile());
    this.lastUnlocks = [];
    this.lastNewArchiveFragments = [];
    this.lastRunWasBestScore = false;
    this.save();
    return this.profile;
  }

  updateSettings(settings) {
    this.profile.settings = {
      ...this.profile.settings,
      ...settings
    };
    this.save();
  }

  setLastSelectedKit(kitId) {
    if (!this.isKitUnlocked(kitId)) {
      return false;
    }

    this.profile.lastSelectedKit = kitId;
    this.save();
    return true;
  }

  isKitUnlocked(kitId) {
    return this.profile.unlockedKits.includes(kitId);
  }

  getUnlockedModifierDefinitions() {
    return this.unlocks.filter((unlock) => unlock.type === 'modifier' && this.profile.unlockedModifiers.includes(unlock.unlockId));
  }

  recordRun(summary) {
    this.lastUnlocks = [];
    this.lastNewArchiveFragments = [];
    this.lastRunWasBestScore = false;
    const won = summary.result === 'stabilized';
    const archiveIds = summary.archiveFragmentsDecoded.map((fragment) => fragment.id);
    const newFragments = archiveIds.filter((id) => !this.profile.archiveFragmentsCollected.includes(id));

    this.profile.totalRuns += 1;
    this.profile.completedRuns += won ? 1 : 0;
    this.profile.failedRuns += won ? 0 : 1;
    this.profile.totalPhrasesCompleted += summary.phrasesCompleted;
    this.profile.totalPhrasesMissed += summary.phrasesMissed;
    this.profile.totalForksResolved += summary.forksResolved;
    this.profile.totalStreamsResolved += summary.hazardStreamsResolved
      + summary.repairStreamsCompleted
      + summary.rewardStreamsCompleted
      + summary.archiveStreamsDecoded;
    this.profile.totalHazardsSurvived += summary.hazardsTriggered;
    this.profile.totalArchivesDecoded += summary.archiveStreamsDecoded;
    this.profile.archiveFragmentsCollected = [...new Set([...this.profile.archiveFragmentsCollected, ...archiveIds])];

    if (summary.finalScore > this.profile.bestScore) {
      this.profile.bestScore = summary.finalScore;
      this.profile.bestRunSeed = summary.seed;
      this.lastRunWasBestScore = true;
    }

    this.profile.bestFlow = Math.max(this.profile.bestFlow, summary.highestFlow);
    this.profile.bestAccuracy = Math.max(this.profile.bestAccuracy, summary.accuracy);
    this.profile.bestWpm = Math.max(this.profile.bestWpm, summary.wpm);
    this.profile.highestArchiveCount = Math.max(this.profile.highestArchiveCount, archiveIds.length);
    this.profile.highestHazardsSurvived = Math.max(this.profile.highestHazardsSurvived, summary.hazardsTriggered);
    if (won && (!this.profile.fastestWinDurationMs || summary.runDurationSeconds * 1000 < this.profile.fastestWinDurationMs)) {
      this.profile.fastestWinDurationMs = summary.runDurationSeconds * 1000;
    }

    this.profile.runHistory = [
      this.createRunHistoryEntry(summary, archiveIds),
      ...this.profile.runHistory
    ].slice(0, this.config.maxRunHistoryEntries);

    this.lastNewArchiveFragments = newFragments.map((id) => archiveFragments.find((fragment) => fragment.id === id)).filter(Boolean);
    this.lastUnlocks = this.evaluateUnlocks(summary);
    this.save();

    return {
      newBestScore: this.lastRunWasBestScore,
      newArchiveFragments: this.lastNewArchiveFragments,
      newUnlocks: this.lastUnlocks
    };
  }

  createRunHistoryEntry(summary, archiveIds) {
    return {
      runId: `run-${Date.now().toString(36)}`,
      seed: summary.seed,
      result: summary.result,
      score: summary.finalScore,
      durationMs: summary.runDurationSeconds * 1000,
      completedAt: new Date().toISOString(),
      startingKit: summary.startingKit,
      dominantArchetype: summary.dominantArchetype,
      phrasesCompleted: summary.phrasesCompleted,
      phrasesMissed: summary.phrasesMissed,
      forksResolved: summary.forksResolved,
      maxFlow: summary.highestFlow,
      maxInstability: summary.maxInstability,
      accuracy: summary.accuracy,
      wpm: summary.wpm,
      archiveFragmentsFound: archiveIds,
      hazardsTriggered: summary.hazardsTriggered,
      difficultyMode: summary.difficultyMode
    };
  }

  evaluateUnlocks(summary) {
    const newlyUnlocked = [];

    for (const unlock of this.unlocks) {
      if (unlock.initiallyUnlocked || this.isUnlocked(unlock)) {
        continue;
      }

      if (this.unlockConditionMet(unlock.unlockCondition, summary)) {
        this.addUnlockToProfile(this.profile, unlock.type, unlock.unlockId);
        newlyUnlocked.push(unlock);
      }
    }

    return newlyUnlocked;
  }

  unlockConditionMet(condition, summary) {
    if (!condition) {
      return false;
    }

    if (condition.type === 'completedRunsAtLeast') return this.profile.completedRuns >= condition.value;
    if (condition.type === 'totalForksResolvedAtLeast') return this.profile.totalForksResolved >= condition.value;
    if (condition.type === 'totalArchivesDecodedAtLeast') return this.profile.totalArchivesDecoded >= condition.value;
    if (condition.type === 'bestFlowAtLeast') return this.profile.bestFlow >= condition.value;
    if (condition.type === 'winBelowInstability') return summary.result === 'stabilized' && summary.finalInstability < condition.value;
    if (condition.type === 'overclockWinsAtLeast') {
      return summary.result === 'stabilized'
        && summary.overclockTimeSeconds > 0
        && this.profile.completedRuns >= condition.value;
    }

    return false;
  }

  isUnlocked(unlock) {
    if (unlock.type === 'startingKit') return this.profile.unlockedKits.includes(unlock.unlockId);
    if (unlock.type === 'powerup') return this.profile.unlockedPowerups.includes(unlock.unlockId);
    if (unlock.type === 'upgrade') return this.profile.unlockedUpgrades.includes(unlock.unlockId);
    if (unlock.type === 'modifier') return this.profile.unlockedModifiers.includes(unlock.unlockId);
    if (unlock.type === 'visualTheme') return this.profile.unlockedVisualThemes.includes(unlock.unlockId);
    return false;
  }

  addUnlockToProfile(profile, type, unlockId) {
    const key = type === 'startingKit' ? 'unlockedKits'
      : type === 'powerup' ? 'unlockedPowerups'
        : type === 'upgrade' ? 'unlockedUpgrades'
          : type === 'modifier' ? 'unlockedModifiers'
            : 'unlockedVisualThemes';
    profile[key] = [...new Set([...(profile[key] ?? []), unlockId])];
  }

  exportProfile() {
    return JSON.stringify(this.profile, null, 2);
  }

  importProfile(json) {
    const parsed = JSON.parse(json);
    this.profile = this.repairProfile(this.migrateProfile(parsed));
    this.save();
    return this.profile;
  }

  getArchiveCollection() {
    const collected = new Set(this.profile.archiveFragmentsCollected);
    return archiveFragments.map((fragment) => ({
      ...fragment,
      collected: collected.has(fragment.id)
    }));
  }

  getDebugInfo() {
    return {
      loaded: this.loaded,
      version: this.profile.version,
      profileId: this.profile.profileId,
      totalRuns: this.profile.totalRuns,
      bestScore: this.profile.bestScore,
      storageKey: this.config.storageKey,
      lastSaveAt: this.lastSaveAt || '(not saved)',
      storageAvailable: this.storageAvailable,
      warning: this.warning || '(none)',
      pendingUnlocks: this.lastUnlocks.map((unlock) => unlock.name).join(', ') || '(none)'
    };
  }

  checkStorageAvailable() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return false;
      }
      const testKey = `${this.config.storageKey}.test`;
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  backupCorruptedSave() {
    if (!this.storageAvailable) {
      return;
    }

    const raw = window.localStorage.getItem(this.config.storageKey);
    if (raw) {
      window.localStorage.setItem(this.config.corruptedBackupKey, raw);
    }
  }
}
