import { contentConfig } from '../config/content.js';
import { allPhrases } from '../content/phrases/index.js';
import { archiveFragments } from '../content/archiveFragments.js';
import { encounterFlavor } from '../content/encounterFlavor.js';
import { normalizeContentEntry } from '../content/schema.js';
import { RunNarrativeMemory } from '../content/narrative/runNarrativeMemory.js';
import { synthesizeNarrativePhrase } from '../content/narrative/synthesisRules.js';

export class ContentSelector {
  constructor({ rng, config = contentConfig, phrases = allPhrases, fragments = archiveFragments, flavor = encounterFlavor }) {
    this.rng = rng;
    this.config = config;
    this.phrases = phrases;
    this.fragments = fragments;
    this.flavor = flavor;
    this.recentIds = [];
    this.lastSelectionInfo = null;
    this.lastArchiveFragment = null;
    this.lastEncounterFlavor = '';
    this.narrativeMemory = new RunNarrativeMemory();
    this.generatedCount = 0;
  }

  getPhrase(options = {}) {
    return this.selectPhrase(options);
  }

  getRoutePhrase(routeType, options = {}) {
    return this.selectPhrase({ ...options, routeType });
  }

  getStreamPhrase(streamRole, options = {}) {
    if (streamRole === 'primary') {
      return this.selectPhrase({ ...options, streamRole: 'primary' });
    }

    if (streamRole === 'hazard') {
      return this.selectPhrase({ ...options, streamRole: 'hazard' });
    }

    return this.selectPhrase({ ...options, streamRole });
  }

  getFinalePhrase(options = {}) {
    return this.selectPhrase({
      ...options,
      categoryKey: 'finale',
      difficultyRange: options.difficultyRange ?? this.config.finaleDifficultyRange
    });
  }

  getArchiveFragment(options = {}) {
    const pool = this.filterByCommonOptions(this.fragments, options);
    const fragment = this.pickWeighted(pool.length ? pool : this.fragments);
    this.narrativeMemory.rememberPhrase(fragment);
    this.lastArchiveFragment = fragment;
    return fragment;
  }

  getEncounterFlavor(encounterType, options = {}) {
    const lines = this.flavor[encounterType] ?? this.flavor.normal;
    const line = this.rng.pick(lines);
    this.lastEncounterFlavor = line;
    this.lastSelectionInfo = {
      id: `flavor_${encounterType}`,
      text: line,
      category: 'encounterFlavor',
      difficulty: 1,
      biome: options.biome ?? '(none)',
      poolSize: lines.length
    };
    return line;
  }

  selectPhrase(options = {}) {
    const generatedPhrase = this.createNarrativePhrase(options);
    if (generatedPhrase) {
      this.remember(generatedPhrase.id);
      this.lastSelectionInfo = {
        id: generatedPhrase.id,
        text: generatedPhrase.text,
        category: generatedPhrase.category,
        difficulty: generatedPhrase.difficulty,
        routeType: generatedPhrase.routeType,
        streamRole: generatedPhrase.streamRole,
        biome: generatedPhrase.biome,
        poolSize: -1,
        voiceType: generatedPhrase.voiceType
      };
      return generatedPhrase;
    }

    const strictPool = this.filterPhrases(this.phrases, options, true);
    const relaxedPool = strictPool.length ? strictPool : this.filterPhrases(this.phrases, options, false);
    const fallbackPool = relaxedPool.length ? relaxedPool : this.phrases;
    const phrase = this.pickWeighted(fallbackPool);
    this.remember(phrase.id);
    this.lastSelectionInfo = {
      id: phrase.id,
      text: phrase.text,
      category: phrase.category,
      difficulty: phrase.difficulty,
      routeType: phrase.routeType,
      streamRole: phrase.streamRole,
      biome: phrase.biome,
      poolSize: fallbackPool.length
    };
    return phrase;
  }

  createNarrativePhrase(options = {}) {
    const encounterIndex = options.encounterIndex ?? 0;
    const difficultyRange = options.difficultyRange ?? this.getDifficultyRange(encounterIndex);
    const purpose = this.getNarrativePurpose(options);

    if (!purpose) {
      return null;
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const generated = synthesizeNarrativePhrase({
        rng: this.rng,
        memory: this.narrativeMemory,
        purpose,
        difficultyRange,
        options
      });
      const entry = normalizeContentEntry({
        id: `narrative_${String(++this.generatedCount).padStart(5, '0')}`,
        category: 'phrase',
        minEncounter: 0,
        maxEncounter: 9,
        weight: 1,
        ...generated
      });

      if (!this.narrativeMemory.generatedKeys.includes(entry.text)) {
        this.narrativeMemory.rememberPhrase(entry);
        return entry;
      }
    }

    return null;
  }

  getNarrativePurpose(options = {}) {
    if (options.categoryKey === 'finale') return 'finale';
    if (options.routeType === 'repair' || options.streamRole === 'repair') return 'repair';
    if (options.routeType === 'reward' || options.streamRole === 'reward') return 'reward';
    if (options.routeType === 'archive' || options.streamRole === 'archive') return 'archive';
    if (options.routeType === 'corruption' || options.streamRole === 'hazard') return 'corruption';
    if (options.routeType === 'safe' || options.streamRole === 'primary' || !options.routeType) return 'navigation';
    return null;
  }

  filterPhrases(phrases, options, strict) {
    const encounterIndex = options.encounterIndex ?? 0;
    const difficultyRange = options.difficultyRange ?? this.getDifficultyRange(encounterIndex);

    return phrases.filter((phrase) => {
      if (strict && this.recentIds.includes(phrase.id)) return false;
      if (options.categoryKey && !phrase.id.startsWith(`${options.categoryKey}_`)) return false;
      if (options.routeType && phrase.routeType !== options.routeType) return false;
      if (options.streamRole && phrase.streamRole !== options.streamRole) return false;
      if (options.biome && phrase.biome !== options.biome) return false;
      if (phrase.minEncounter > encounterIndex) return false;
      if (phrase.maxEncounter < encounterIndex) return false;
      if (difficultyRange && (phrase.difficulty < difficultyRange[0] || phrase.difficulty > difficultyRange[1])) return false;
      return true;
    });
  }

  filterByCommonOptions(entries, options) {
    const encounterIndex = options.encounterIndex ?? 0;
    return entries.filter((entry) => {
      if (options.biome && entry.biome !== options.biome) return false;
      if ((entry.minEncounter ?? 0) > encounterIndex) return false;
      if ((entry.maxEncounter ?? 9) < encounterIndex) return false;
      return true;
    });
  }

  getDifficultyRange(encounterIndex = 0) {
    return this.config.difficultyByEncounter[encounterIndex]
      ?? this.config.difficultyByEncounter[this.config.difficultyByEncounter.length - 1]
      ?? this.config.fallbackDifficultyRange;
  }

  pickWeighted(pool) {
    const total = pool.reduce((sum, entry) => sum + (entry.weight ?? 1), 0);
    let roll = this.rng.range(0, total);

    for (const entry of pool) {
      roll -= entry.weight ?? 1;
      if (roll <= 0) {
        return entry;
      }
    }

    return pool[pool.length - 1];
  }

  remember(id) {
    this.recentIds = [id, ...this.recentIds].slice(0, this.config.immediateRepeatAvoidanceCount);
  }

  getDebugInfo() {
    return {
      currentPhraseId: this.lastSelectionInfo?.id ?? '(none)',
      currentPhraseDifficulty: this.lastSelectionInfo?.difficulty ?? 0,
      currentPhraseCategory: this.lastSelectionInfo?.category ?? '(none)',
      currentPhraseBiome: this.lastSelectionInfo?.biome ?? '(none)',
      currentContentPoolSize: this.lastSelectionInfo?.poolSize ?? 0,
      currentVoiceType: this.lastSelectionInfo?.voiceType ?? '(none)',
      lastArchiveFragment: this.lastArchiveFragment?.text ?? '(none)',
      lastEncounterFlavor: this.lastEncounterFlavor || '(none)',
      rememberedLocations: this.narrativeMemory.locations.join(', ') || '(none)'
    };
  }
}
