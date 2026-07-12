export const CONTENT_CATEGORIES = {
  PHRASE: 'phrase',
  ARCHIVE_FRAGMENT: 'archiveFragment',
  ENCOUNTER_FLAVOR: 'encounterFlavor'
};

export const ROUTE_TYPES = ['safe', 'reward', 'repair', 'archive', 'corruption'];
export const STREAM_ROLES = ['primary', 'hazard', 'repair', 'reward', 'archive'];
export const BIOMES = ['signalArchive', 'staticBloom', 'mirrorConduit', 'deadRelay', 'coreStream'];

export const difficultyBands = {
  1: 'short stable command',
  2: 'medium signal phrase',
  3: 'longer technical phrase',
  4: 'complex archive or hazard phrase',
  5: 'dense finale or corruption phrase'
};

export function createPhraseEntries(prefix, entries, defaults = {}) {
  return entries.map((entry, index) => {
    const value = typeof entry === 'string' ? { text: entry } : entry;
    return normalizeContentEntry({
      id: `${prefix}_${String(index + 1).padStart(3, '0')}`,
      category: CONTENT_CATEGORIES.PHRASE,
      difficulty: 1,
      tags: [],
      minEncounter: 0,
      maxEncounter: 9,
      weight: 1,
      rewardHint: null,
      hazardHint: null,
      loreGroup: null,
      ...defaults,
      ...value
    });
  });
}

export function normalizeContentEntry(entry) {
  return {
    id: entry.id,
    text: entry.text,
    category: entry.category ?? CONTENT_CATEGORIES.PHRASE,
    difficulty: entry.difficulty ?? 1,
    tags: entry.tags ?? [],
    routeType: entry.routeType ?? null,
    streamRole: entry.streamRole ?? null,
    biome: entry.biome ?? 'signalArchive',
    minEncounter: entry.minEncounter ?? 0,
    maxEncounter: entry.maxEncounter ?? 9,
    weight: entry.weight ?? 1,
    rewardHint: entry.rewardHint ?? null,
    hazardHint: entry.hazardHint ?? null,
    loreGroup: entry.loreGroup ?? null,
    emotionalTone: entry.emotionalTone ?? null,
    dangerLevel: entry.dangerLevel ?? 0,
    continuityTags: entry.continuityTags ?? [],
    locationTags: entry.locationTags ?? [],
    corruptionLevel: entry.corruptionLevel ?? 0,
    rarity: entry.rarity ?? 'common',
    voiceType: entry.voiceType ?? null
  };
}
