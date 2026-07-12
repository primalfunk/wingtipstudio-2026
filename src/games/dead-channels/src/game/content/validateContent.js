import { contentConfig } from '../config/content.js';
import { allPhrases, phraseLibraries } from './phrases/index.js';
import { archiveFragments } from './archiveFragments.js';
import { encounterFlavor } from './encounterFlavor.js';
import { BIOMES, ROUTE_TYPES, STREAM_ROLES } from './schema.js';

export function validateContent({
  phrases = allPhrases,
  fragments = archiveFragments,
  flavor = encounterFlavor,
  config = contentConfig
} = {}) {
  const warnings = [];
  const ids = new Set();
  const routeTypes = new Set(ROUTE_TYPES);
  const streamRoles = new Set(STREAM_ROLES);
  const biomes = new Set(BIOMES);

  for (const entry of [...phrases, ...fragments]) {
    if (!entry.id) warnings.push(`Missing id for "${entry.text ?? '(missing text)'}"`);
    if (ids.has(entry.id)) warnings.push(`Duplicate id: ${entry.id}`);
    ids.add(entry.id);

    if (!entry.text) warnings.push(`Missing text: ${entry.id}`);
    if (!Number.isInteger(entry.difficulty) || entry.difficulty < 1 || entry.difficulty > 5) {
      warnings.push(`Invalid difficulty for ${entry.id}: ${entry.difficulty}`);
    }
    if (entry.routeType && !routeTypes.has(entry.routeType)) warnings.push(`Invalid routeType for ${entry.id}: ${entry.routeType}`);
    if (entry.streamRole && !streamRoles.has(entry.streamRole)) warnings.push(`Invalid streamRole for ${entry.id}: ${entry.streamRole}`);
    if (entry.biome && !biomes.has(entry.biome)) warnings.push(`Invalid biome for ${entry.id}: ${entry.biome}`);
    if (entry.category === 'phrase' && entry.text && entry.text.length > config.maxPhraseLengthWarning) {
      warnings.push(`Long phrase ${entry.id} (${entry.text.length}): ${entry.text}`);
    }
    if (entry.text && /[^a-zA-Z0-9 :,;'+\-?_|\./]/.test(entry.text)) {
      warnings.push(`Unsupported character in ${entry.id}: ${entry.text}`);
    }
  }

  for (const [libraryName, library] of Object.entries(phraseLibraries)) {
    if (!library.length) warnings.push(`Empty phrase library: ${libraryName}`);
  }

  for (const [type, lines] of Object.entries(flavor)) {
    if (!lines.length) warnings.push(`Empty encounter flavor: ${type}`);
  }

  return {
    valid: warnings.length === 0,
    warnings,
    counts: {
      phrases: phrases.length,
      archiveFragments: fragments.length,
      encounterFlavorLines: Object.values(flavor).reduce((sum, lines) => sum + lines.length, 0)
    }
  };
}

if (typeof process !== 'undefined' && process.argv[1]?.replaceAll('\\', '/').endsWith('src/game/content/validateContent.js')) {
  const result = validateContent();
  console.log(`Phrases: ${result.counts.phrases}`);
  console.log(`Archive fragments: ${result.counts.archiveFragments}`);
  console.log(`Encounter flavor lines: ${result.counts.encounterFlavorLines}`);

  if (result.warnings.length) {
    console.warn(result.warnings.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Content validation passed.');
  }
}
