import { createPhraseEntries } from '../schema.js';

export const repairPhrases = createPhraseEntries('repair', [
  { text: 'patch the archive gate', difficulty: 1, biome: 'signalArchive' },
  { text: 'restore the cracked relay', difficulty: 1, biome: 'deadRelay' },
  { text: 'seal the leaking conduit', difficulty: 1, biome: 'mirrorConduit' },
  { text: 'reset the clear buffer', difficulty: 1, biome: 'coreStream' },
  { text: 'repair the pulse line', difficulty: 1, biome: 'staticBloom' },
  { text: 'mend the quiet circuit', difficulty: 1, biome: 'deadRelay' },
  { text: 'clear the signal valve', difficulty: 2, biome: 'coreStream' },
  { text: 'rebuild the memory latch', difficulty: 2, biome: 'signalArchive' },
  { text: 'stabilize mirror conduit', difficulty: 2, biome: 'mirrorConduit' },
  { text: 'cool the static collector', difficulty: 2, biome: 'staticBloom' },
  { text: 'anchor the loose beacon', difficulty: 2, biome: 'deadRelay' },
  { text: 'restore primary shielding', difficulty: 2, biome: 'coreStream' },
  { text: 'clean the archive contact', difficulty: 2, biome: 'signalArchive' },
  { text: 'join the severed carrier', difficulty: 2, biome: 'deadRelay' },
  { text: 'balance the flow coupler', difficulty: 2, biome: 'mirrorConduit' },
  { text: 'drain the static bloom', difficulty: 2, biome: 'staticBloom' },
  { text: 'replace the silver fuse', difficulty: 3, biome: 'deadRelay' },
  { text: 'rephase the repair signal', difficulty: 3, biome: 'coreStream' },
  { text: 'seal the recursive mirror', difficulty: 3, biome: 'mirrorConduit' },
  { text: 'restore the old checksum', difficulty: 3, biome: 'signalArchive' },
  { text: 'solder the beacon spine', difficulty: 3, biome: 'deadRelay' },
  { text: 'scrub the noisy carrier', difficulty: 3, biome: 'staticBloom' },
  { text: 'align emergency governors', difficulty: 3, biome: 'coreStream' },
  { text: 'repair the archive manifold', difficulty: 3, biome: 'signalArchive' },
  { text: 'brace the conduit hinge', difficulty: 3, biome: 'mirrorConduit' },
  { text: 'purge the cracked capacitor', difficulty: 4, biome: 'deadRelay' },
  { text: 'restore bifurcation control', difficulty: 4, biome: 'coreStream' },
  { text: 'recalibrate mirror ballast', difficulty: 4, biome: 'mirrorConduit' },
  { text: 'seal static intrusion ports', difficulty: 4, biome: 'staticBloom' },
  { text: 'repair archive index seals', difficulty: 4, biome: 'signalArchive' }
], {
  routeType: 'repair',
  streamRole: 'repair',
  tags: ['repair', 'stability'],
  rewardHint: 'integrity'
});
