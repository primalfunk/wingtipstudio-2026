import { createPhraseEntries } from '../schema.js';

export const rewardPhrases = createPhraseEntries('reward', [
  { text: 'capture the bright packet', difficulty: 1, biome: 'coreStream' },
  { text: 'collect the clean signal', difficulty: 1, biome: 'signalArchive' },
  { text: 'harvest the blue current', difficulty: 1, biome: 'coreStream' },
  { text: 'claim the bonus carrier', difficulty: 1, biome: 'staticBloom' },
  { text: 'catch the silver pulse', difficulty: 1, biome: 'mirrorConduit' },
  { text: 'open the reward lane', difficulty: 1, biome: 'deadRelay' },
  { text: 'decode the bonus carrier', difficulty: 2, biome: 'signalArchive' },
  { text: 'pull from the bright archive', difficulty: 2, biome: 'signalArchive' },
  { text: 'route the gold packet', difficulty: 2, biome: 'coreStream' },
  { text: 'skim the charged signal', difficulty: 2, biome: 'staticBloom' },
  { text: 'take the mirrored bounty', difficulty: 2, biome: 'mirrorConduit' },
  { text: 'recover the bonus ledger', difficulty: 2, biome: 'signalArchive' },
  { text: 'draw from the rich current', difficulty: 2, biome: 'coreStream' },
  { text: 'claim the relay dividend', difficulty: 2, biome: 'deadRelay' },
  { text: 'open the amber cache', difficulty: 2, biome: 'signalArchive' },
  { text: 'gather the pulse surplus', difficulty: 2, biome: 'staticBloom' },
  { text: 'extract the rare checksum', difficulty: 3, biome: 'signalArchive' },
  { text: 'steal the clean bandwidth', difficulty: 3, biome: 'deadRelay' },
  { text: 'split the mirror dividend', difficulty: 3, biome: 'mirrorConduit' },
  { text: 'capture compressed signal', difficulty: 3, biome: 'coreStream' },
  { text: 'decode the reward lattice', difficulty: 3, biome: 'signalArchive' },
  { text: 'collect the bloom residue', difficulty: 3, biome: 'staticBloom' },
  { text: 'route around bonus static', difficulty: 3, biome: 'staticBloom' },
  { text: 'claim the encrypted payout', difficulty: 3, biome: 'signalArchive' },
  { text: 'recover the stored current', difficulty: 3, biome: 'deadRelay' },
  { text: 'extract high-value telemetry', difficulty: 4, biome: 'coreStream' },
  { text: 'capture mirrored reward cache', difficulty: 4, biome: 'mirrorConduit' },
  { text: 'decode surplus archive light', difficulty: 4, biome: 'signalArchive' },
  { text: 'harvest unstable signal yield', difficulty: 4, biome: 'staticBloom' },
  { text: 'claim abandoned relay credit', difficulty: 4, biome: 'deadRelay' }
], {
  routeType: 'reward',
  streamRole: 'reward',
  tags: ['reward', 'signal'],
  rewardHint: 'score'
});
