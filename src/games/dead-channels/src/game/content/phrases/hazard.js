import { createPhraseEntries } from '../schema.js';

export const hazardPhrases = createPhraseEntries('hazard', [
  { text: 'suppress static bloom', difficulty: 1, biome: 'staticBloom' },
  { text: 'block the red flare', difficulty: 1, biome: 'staticBloom' },
  { text: 'close the hazard gate', difficulty: 1, biome: 'deadRelay' },
  { text: 'mute the false signal', difficulty: 1, biome: 'mirrorConduit' },
  { text: 'ground the noise field', difficulty: 1, biome: 'staticBloom' },
  { text: 'cut the hostile carrier', difficulty: 1, biome: 'coreStream' },
  { text: 'dampen the surge front', difficulty: 2, biome: 'staticBloom' },
  { text: 'contain the relay spark', difficulty: 2, biome: 'deadRelay' },
  { text: 'mask the mirrored echo', difficulty: 2, biome: 'mirrorConduit' },
  { text: 'vent the pressure fault', difficulty: 2, biome: 'coreStream' },
  { text: 'short the warning loop', difficulty: 2, biome: 'deadRelay' },
  { text: 'isolate the noise bloom', difficulty: 2, biome: 'staticBloom' },
  { text: 'lock the hazard channel', difficulty: 2, biome: 'coreStream' },
  { text: 'freeze the unstable token', difficulty: 2, biome: 'signalArchive' },
  { text: 'break the red reflection', difficulty: 2, biome: 'mirrorConduit' },
  { text: 'quench the open static', difficulty: 2, biome: 'staticBloom' },
  { text: 'collapse the error wake', difficulty: 3, biome: 'coreStream' },
  { text: 'blacklist the hostile packet', difficulty: 3, biome: 'staticBloom' },
  { text: 'contain mirrored interference', difficulty: 3, biome: 'mirrorConduit' },
  { text: 'ground the dead relay arc', difficulty: 3, biome: 'deadRelay' },
  { text: 'stifle the warning cascade', difficulty: 3, biome: 'coreStream' },
  { text: 'purge the unstable header', difficulty: 3, biome: 'signalArchive' },
  { text: 'suppress the ghost packet', difficulty: 3, biome: 'mirrorConduit' },
  { text: 'clamp the static aperture', difficulty: 3, biome: 'staticBloom' },
  { text: 'disconnect the hazard braid', difficulty: 3, biome: 'deadRelay' },
  { text: 'neutralize the bloom engine', difficulty: 4, biome: 'staticBloom' },
  { text: 'deflect mirrored signal debt', difficulty: 4, biome: 'mirrorConduit' },
  { text: 'quarantine relay fault zero', difficulty: 4, biome: 'deadRelay' },
  { text: 'stabilize hostile channel drift', difficulty: 4, biome: 'coreStream' },
  { text: 'silence the archive alarm', difficulty: 4, biome: 'signalArchive' }
], {
  routeType: 'corruption',
  streamRole: 'hazard',
  tags: ['hazard', 'interference'],
  hazardHint: 'instability'
});
