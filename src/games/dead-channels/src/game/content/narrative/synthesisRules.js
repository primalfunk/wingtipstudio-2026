import {
  archiveFindings,
  catastropheReferences,
  corruptionFragments,
  geographicReferences,
  memoryFragments,
  operatorFragments,
  systemOperational
} from './index.js';

const SCRAMBLE_CHARS = ['_', '|'];

export const narrativeVoicePools = {
  systemOperational,
  operatorFragments,
  corruptionFragments,
  memoryFragments,
  catastropheReferences,
  geographicReferences,
  archiveFindings
};

const roleRules = {
  navigation: {
    voices: ['systemOperational', 'geographicReferences'],
    routeType: 'safe',
    streamRole: 'primary',
    templates: [
      '{system}',
      '{system} at {location}',
      '{location} reports carrier drift',
      'no signal beyond {location}'
    ]
  },
  repair: {
    voices: ['operatorFragments', 'systemOperational', 'geographicReferences'],
    routeType: 'repair',
    streamRole: 'repair',
    templates: [
      'restore carrier at {location}',
      'keep {location} powered',
      '{operator}',
      'repair checksum through {location}'
    ]
  },
  reward: {
    voices: ['systemOperational', 'archiveFindings', 'geographicReferences'],
    routeType: 'reward',
    streamRole: 'reward',
    templates: [
      'capture partial archive from {location}',
      'recover signal cache at {location}',
      '{finding}',
      'decode surplus carrier'
    ]
  },
  archive: {
    voices: ['archiveFindings', 'memoryFragments', 'catastropheReferences', 'geographicReferences'],
    routeType: 'archive',
    streamRole: 'archive',
    templates: [
      '{finding}',
      '{memory}',
      '{catastrophe}',
      '{memory} near {location}'
    ]
  },
  corruption: {
    voices: ['corruptionFragments', 'geographicReferences', 'catastropheReferences'],
    routeType: 'corruption',
    streamRole: 'hazard',
    templates: [
      '{corruption}',
      '{location} transmitting without source',
      '{corruption} at {location}',
      'why is {location} still active'
    ]
  },
  finale: {
    voices: ['corruptionFragments', 'catastropheReferences', 'archiveFindings', 'geographicReferences'],
    routeType: 'corruption',
    streamRole: 'primary',
    templates: [
      '{corruption}',
      '{catastrophe}',
      '{location} remains active',
      'the network answers from {location}',
      '{finding}'
    ]
  }
};

export function synthesizeNarrativePhrase({ rng, memory, purpose = 'navigation', difficultyRange = [1, 2], options = {} }) {
  const rule = roleRules[purpose] ?? roleRules.navigation;
  const difficulty = pickDifficulty(rng, difficultyRange);
  const location = pickLocation(rng, memory);
  const selected = {
    system: pickVoice(rng, systemOperational, difficulty),
    operator: pickVoice(rng, operatorFragments, difficulty),
    corruption: pickVoice(rng, corruptionFragments, difficulty),
    memory: pickVoice(rng, memoryFragments, difficulty),
    catastrophe: pickVoice(rng, catastropheReferences, difficulty),
    finding: pickVoice(rng, archiveFindings, difficulty)
  };
  const template = pickTemplate(rng, rule.templates, difficulty);
  let text = template
    .replace('{system}', selected.system.text)
    .replace('{operator}', selected.operator.text)
    .replace('{corruption}', selected.corruption.text)
    .replace('{memory}', selected.memory.text)
    .replace('{catastrophe}', selected.catastrophe.text)
    .replace('{finding}', selected.finding.text)
    .replace('{location}', location.text);

  text = trimForDifficulty(text, difficulty);
  text = maybeMutate(text, difficulty, rng, options);

  const voiceType = inferVoiceType(template, purpose);
  const entry = {
    text,
    difficulty,
    routeType: options.routeType ?? rule.routeType,
    streamRole: options.streamRole ?? rule.streamRole,
    biome: pickBiome(purpose, location),
    tags: [...new Set(['narrative', purpose, voiceType, ...(location.tags ?? [])])],
    emotionalTone: selected[voiceType]?.tone ?? purpose,
    dangerLevel: purpose === 'corruption' || purpose === 'finale' ? difficulty + 1 : difficulty,
    continuityTags: [
      ...(location.tags ?? []),
      purpose === 'archive' ? 'archiveFinding' : null,
      purpose === 'finale' || purpose === 'corruption' ? 'catastropheSignal' : null
    ].filter(Boolean),
    locationTags: location.tags ?? [],
    corruptionLevel: purpose === 'corruption' || purpose === 'finale' ? Math.max(1, difficulty - 2) : 0,
    rarity: selected.finding.rarity ?? 'common',
    voiceType
  };

  return entry;
}

export function synthesizeArchiveFragment({ rng, memory, index }) {
  const location = pickLocation(rng, memory);
  const finding = pickVoice(rng, archiveFindings, 5);
  const memoryLine = pickVoice(rng, memoryFragments, 4);
  const templates = [
    `ARCHIVE ${index}: ${finding.text}`,
    `ARCHIVE ${index}: ${memoryLine.text} near ${location.text}`,
    `ARCHIVE ${index}: ${location.text} logged a voice after evacuation`,
    `ARCHIVE ${index}: nobody signed the final ${location.text} report`
  ];
  const text = rng.pick(templates);
  return {
    text,
    biome: pickBiome('archive', location),
    tags: ['archive', 'fragment', ...(location.tags ?? [])],
    loreGroup: 'transmissionArchive'
  };
}

function pickDifficulty(rng, range) {
  return rng.int(range[0] ?? 1, range[1] ?? 3);
}

function pickVoice(rng, pool, difficulty) {
  const candidates = pool.filter((entry) => (entry.difficulty ?? 1) <= Math.max(1, difficulty + 1));
  return weightedPick(rng, candidates.length ? candidates : pool);
}

function pickLocation(rng, memory) {
  if (memory.shouldEcho(rng)) {
    const tag = memory.pickRememberedLocation(rng);
    const remembered = geographicReferences.find((entry) => entry.tags?.includes(tag));
    if (remembered) return remembered;
  }
  return weightedPick(rng, geographicReferences);
}

function pickTemplate(rng, templates, difficulty) {
  if (difficulty <= 1) {
    return templates[0];
  }
  return rng.pick(templates);
}

function trimForDifficulty(text, difficulty) {
  const words = text.split(' ');
  const maxWords = difficulty <= 1 ? 5 : difficulty === 2 ? 6 : difficulty === 3 ? 7 : 9;
  return words.slice(0, maxWords).join(' ');
}

function maybeMutate(text, difficulty, rng, options) {
  if (difficulty < 4 || rng.next() > 0.18 || options.disableMutation) {
    return text;
  }

  const characters = [...text];
  const mutations = difficulty >= 5 ? 2 : 1;
  for (let i = 0; i < mutations; i += 1) {
    const index = rng.int(2, Math.max(2, characters.length - 2));
    if (characters[index] !== ' ') {
      characters[index] = rng.pick(SCRAMBLE_CHARS);
    }
  }
  return characters.join('');
}

function inferVoiceType(template, purpose) {
  if (template.includes('{operator}')) return 'operator';
  if (template.includes('{corruption}')) return 'corruption';
  if (template.includes('{memory}')) return 'memory';
  if (template.includes('{catastrophe}')) return 'catastrophe';
  if (template.includes('{finding}')) return 'finding';
  if (template.includes('{system}')) return 'system';
  return purpose;
}

function pickBiome(purpose, location) {
  if (purpose === 'corruption' || purpose === 'finale') return 'staticBloom';
  if (purpose === 'archive') return 'signalArchive';
  if (location.tags?.some((tag) => tag.includes('harbor') || tag.includes('floodline'))) return 'deadRelay';
  return 'mirrorConduit';
}

function weightedPick(rng, pool) {
  const total = pool.reduce((sum, entry) => sum + (entry.weight ?? 1), 0);
  let roll = rng.range(0, total);
  for (const entry of pool) {
    roll -= entry.weight ?? 1;
    if (roll <= 0) return entry;
  }
  return pool[pool.length - 1];
}
