import { CONTENT_CATEGORIES } from './schema.js';

export const archiveFragments = [
  'ARCHIVE 001: the relay operator never evacuated',
  'ARCHIVE 002: nobody claimed channel zero',
  'ARCHIVE 003: the weather station outlived command',
  'ARCHIVE 004: the archive opened after midnight',
  'ARCHIVE 005: final ferry departed without lights',
  'ARCHIVE 006: ridgeway sector logged voices after shutdown',
  'ARCHIVE 007: command burned the inland records',
  'ARCHIVE 008: the timestamp is tomorrow',
  'ARCHIVE 009: blackwater archive rejected the evacuation key',
  'ARCHIVE 010: someone kept transmitting music',
  'ARCHIVE 011: relay seven answered itself',
  'ARCHIVE 012: lower transit reported rain indoors',
  'ARCHIVE 013: the harbor array received no bodies',
  'ARCHIVE 014: dead channels remained active',
  'ARCHIVE 015: the southern repeater heard children counting',
  'ARCHIVE 016: containment maps ended at the floodline',
  'ARCHIVE 017: central requested silence and received prayers',
  'ARCHIVE 018: no operator signed the final bridge report',
  'ARCHIVE 019: the inland observatory saw lights below water',
  'ARCHIVE 020: archive recovery was postponed indefinitely',
  'ARCHIVE 021: the last distress call was marked routine',
  'ARCHIVE 022: mirror conduit stored every unanswered name',
  'ARCHIVE 023: quarantine expanded beyond relay six',
  'ARCHIVE 024: someone stayed behind to answer signals',
  'ARCHIVE 025: the dead channels learned the old routes'
].map((text, index) => ({
  id: `fragment_${String(index + 1).padStart(3, '0')}`,
  text,
  category: CONTENT_CATEGORIES.ARCHIVE_FRAGMENT,
  difficulty: 1,
  tags: ['archive', 'fragment'],
  biome: index % 5 === 0 ? 'signalArchive'
    : index % 5 === 1 ? 'deadRelay'
      : index % 5 === 2 ? 'mirrorConduit'
        : index % 5 === 3 ? 'staticBloom'
          : 'coreStream',
  minEncounter: 0,
  maxEncounter: 9,
  weight: 1,
  loreGroup: 'runArchive'
}));
