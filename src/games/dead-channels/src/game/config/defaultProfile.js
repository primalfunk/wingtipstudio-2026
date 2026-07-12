import { persistenceConfig } from './persistence.js';

export function createDefaultProfile() {
  const now = new Date().toISOString();
  return {
    version: persistenceConfig.saveVersion,
    profileId: `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: now,
    updatedAt: now,
    totalRuns: 0,
    completedRuns: 0,
    failedRuns: 0,
    bestScore: 0,
    bestFlow: 0,
    bestAccuracy: 0,
    bestWpm: 0,
    fastestWinDurationMs: null,
    highestArchiveCount: 0,
    highestHazardsSurvived: 0,
    bestRunSeed: '',
    totalPhrasesCompleted: 0,
    totalPhrasesMissed: 0,
    totalForksResolved: 0,
    totalStreamsResolved: 0,
    totalHazardsSurvived: 0,
    totalArchivesDecoded: 0,
    archiveFragmentsCollected: [],
    unlockedKits: ['flow_runner', 'stabilizer', 'overclocker', 'architect'],
    unlockedPowerups: ['stabilizer', 'preview', 'compression', 'overclock', 'fork-splitter', 'signal-anchor'],
    unlockedUpgrades: ['flow_memory', 'soft_failure', 'redline_bonus', 'fork_preview_plus'],
    unlockedModifiers: [],
    unlockedVisualThemes: [],
    settings: {
      reduceMotion: false,
      reduceGlow: false,
      highContrast: false,
      textScale: 1,
      screenShake: true,
      difficultyMode: 'easy'
    },
    selectedModifier: null,
    lastSelectedKit: 'flow_runner',
    runHistory: []
  };
}
