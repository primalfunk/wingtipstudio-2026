export const runConfig = {
  totalEncounters: 8,
  baseEncounterResolutions: 4,
  encounterResolutionGrowth: 0.45,
  finaleResolutions: 6,
  transitionDelayMs: 1400,
  baseSpeedMultiplier: 1,
  speedGrowthPerEncounter: 0.06,
  finaleSpeedBonus: 0.14,
  instabilityIncreasePerEncounter: 0,
  forkFrequencyByEncounter: {
    normal: 4,
    fork: 2,
    recovery: 5,
    pressure: 3,
    finalePrep: 3,
    finale: 2,
    multiStream: 99
  },
  encounterTypes: ['normal', 'normal', 'fork', 'multiStream', 'recovery', 'fork', 'pressure', 'multiStream'],
  transitionMessages: {
    normal: ['ENTERING CHANNEL', 'SIGNAL PATH OPEN'],
    fork: ['BRANCH DENSITY RISING', 'FORK LATTICE DETECTED'],
    recovery: ['REPAIR CURRENT AVAILABLE', 'STABILITY WINDOW OPEN'],
    pressure: ['STATIC DENSITY RISING', 'ARCHIVE PRESSURE INCREASING'],
    multiStream: ['PARALLEL STREAMS DETECTED', 'PRIORITY SPLIT FORMING'],
    finalePrep: ['SIGNAL DRIFT DETECTED', 'FINAL STREAM ALIGNING'],
    finale: ['SIGNAL CONVERGENCE', 'FINAL STREAM APPROACHING']
  }
};
