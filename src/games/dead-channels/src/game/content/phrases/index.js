import { navigationPhrases } from './navigation.js';
import { repairPhrases } from './repair.js';
import { hazardPhrases } from './hazard.js';
import { rewardPhrases } from './reward.js';
import { archivePhrases } from './archive.js';
import { corruptionPhrases } from './corruption.js';
import { finalePhrases } from './finale.js';

export const phraseLibraries = {
  navigation: navigationPhrases,
  repair: repairPhrases,
  hazard: hazardPhrases,
  reward: rewardPhrases,
  archive: archivePhrases,
  corruption: corruptionPhrases,
  finale: finalePhrases
};

export const allPhrases = Object.values(phraseLibraries).flat();
