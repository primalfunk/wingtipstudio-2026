import { createPhraseEntries } from '../schema.js';

export const finalePhrases = createPhraseEntries('finale', [
  { text: 'stabilize the final stream', difficulty: 4, biome: 'coreStream' },
  { text: 'align the convergence gate', difficulty: 4, biome: 'coreStream' },
  { text: 'hold the central signal', difficulty: 4, biome: 'coreStream' },
  { text: 'decode the source current', difficulty: 4, biome: 'signalArchive' },
  { text: 'seal the mirror recursion', difficulty: 4, biome: 'mirrorConduit' },
  { text: 'purge the static crown', difficulty: 4, biome: 'staticBloom' },
  { text: 'restore the dead relay chain', difficulty: 4, biome: 'deadRelay' },
  { text: 'preserve the primary stream', difficulty: 4, biome: 'coreStream' },
  { text: 'synchronize final telemetry', difficulty: 4, biome: 'signalArchive' },
  { text: 'anchor the fractured channel', difficulty: 4, biome: 'mirrorConduit' },
  { text: 'resolve the core stream delta', difficulty: 5, biome: 'coreStream' },
  { text: 'decode convergence protocol', difficulty: 5, biome: 'signalArchive' },
  { text: 'seal red recursion at source', difficulty: 5, biome: 'mirrorConduit' },
  { text: 'restore signal from dead silence', difficulty: 5, biome: 'deadRelay' },
  { text: 'thread the final static bloom', difficulty: 5, biome: 'staticBloom' },
  { text: 'align archive memory with flow', difficulty: 5, biome: 'signalArchive' },
  { text: 'hold the core against collapse', difficulty: 5, biome: 'coreStream' },
  { text: 'stabilize mirror conduit zero', difficulty: 5, biome: 'mirrorConduit' },
  { text: 'recover the last transmission', difficulty: 5, biome: 'deadRelay' },
  { text: 'enter the signal river whole', difficulty: 5, biome: 'coreStream' }
], {
  routeType: 'safe',
  streamRole: 'primary',
  tags: ['finale', 'convergence'],
  rewardHint: 'victory',
  minEncounter: 8,
  maxEncounter: 9,
  weight: 1.2
});
