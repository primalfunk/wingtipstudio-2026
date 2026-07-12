export const HAZARD_TYPES = {
  LETTER_JITTER: 'letterJitter',
  GHOST_TEXT: 'ghostText',
  STATIC_BLOOM: 'staticBloom',
  REDUCED_PREVIEW: 'reducedPreview',
  CORRUPTED_HINT: 'corruptedHint',
  FALSE_ECHO: 'falseEcho'
};

export const hazardConfig = {
  instabilityBands: [
    { key: 'stable', label: 'STABLE', min: 0, max: 24, hazardChance: 0.03, durationMultiplier: 0.8, visualIntensity: 0.35, gameplayPenaltyMultiplier: 0.75 },
    { key: 'unsteady', label: 'UNSTEADY', min: 25, max: 49, hazardChance: 0.11, durationMultiplier: 1, visualIntensity: 0.65, gameplayPenaltyMultiplier: 1 },
    { key: 'corrupted', label: 'CORRUPTED', min: 50, max: 74, hazardChance: 0.22, durationMultiplier: 1.15, visualIntensity: 0.9, gameplayPenaltyMultiplier: 1.15 },
    { key: 'critical', label: 'CRITICAL', min: 75, max: Infinity, hazardChance: 0.34, durationMultiplier: 1.28, visualIntensity: 1.15, gameplayPenaltyMultiplier: 1.3 }
  ],
  eventTriggerChances: {
    wrongKeyStaticBloom: 0.28,
    wrongKeyJitter: 0.18,
    missedGhostText: 0.65,
    missedReducedPreview: 0.8,
    riskyRouteCorruptedHint: 0.7,
    passiveMinorHazard: 0.22
  },
  hazardDurations: {
    [HAZARD_TYPES.LETTER_JITTER]: 2200,
    [HAZARD_TYPES.GHOST_TEXT]: 3000,
    [HAZARD_TYPES.STATIC_BLOOM]: 420,
    [HAZARD_TYPES.REDUCED_PREVIEW]: 5200,
    [HAZARD_TYPES.CORRUPTED_HINT]: 1800,
    [HAZARD_TYPES.FALSE_ECHO]: 1600
  },
  reducedPreviewValues: {
    stable: 0,
    unsteady: 70,
    corrupted: 130,
    critical: 190
  },
  routeInstabilityModifiers: {
    safeComplete: -3,
    repairComplete: -10,
    archiveImperfect: 3,
    corruptionImperfect: 8,
    corruptionMiss: 15
  },
  encounterHazardMultipliers: {
    normal: 1,
    fork: 1,
    recovery: 0.65,
    pressure: 1.35,
    finalePrep: 1.2,
    finale: 1.55
  },
  passiveCheckIntervalMs: 1800,
  corruptedHintGlyphs: ['#', '%', '&', '?', '~']
};
