export const forkConfig = {
  phrasesBetweenForks: 4,
  branchCountMin: 2,
  branchCountMax: 3,
  telegraphDurationMs: 1200,
  selectionTimeoutMs: 8000,
  resolveDelayMs: 900,
  branchTextSpeed: 78,
  defaultRouteTypes: ['safe', 'reward', 'repair', 'archive', 'corruption'],
  routeRewardValues: {
    safe: { score: 30, integrity: 0, flow: 2, instability: 0 },
    reward: { score: 80, integrity: 0, flow: 4, instability: 3 },
    repair: { score: 20, integrity: 10, flow: 2, instability: 0 },
    archive: { score: 60, integrity: 0, flow: 10, instability: 0 },
    corruption: { score: 120, integrity: 0, flow: 6, instability: 0, imperfectInstability: 0 }
  },
  routePenaltyValues: {
    safe: { integrity: 4, instability: 3 },
    reward: { integrity: 8, instability: 8 },
    repair: { integrity: 8, instability: 5 },
    archive: { integrity: 6, instability: 8 },
    corruption: { integrity: 14, instability: 15 }
  }
};

export const routeTypeLabels = {
  safe: 'SAFE',
  reward: 'REWARD',
  repair: 'REPAIR',
  archive: 'ARCHIVE',
  corruption: 'CORRUPTION'
};

export const routeTypeColors = {
  safe: 0x69f0ae,
  reward: 0xffd166,
  repair: 0x64d8ff,
  archive: 0xb388ff,
  corruption: 0xff5c77
};
