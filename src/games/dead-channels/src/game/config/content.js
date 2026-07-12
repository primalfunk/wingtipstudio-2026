export const contentConfig = {
  maxPhraseLengthWarning: 44,
  immediateRepeatAvoidanceCount: 6,
  fallbackDifficultyRange: [1, 3],
  finaleDifficultyRange: [4, 5],
  difficultyByEncounter: [
    [1, 2],
    [1, 2],
    [2, 3],
    [2, 3],
    [2, 4],
    [3, 4],
    [3, 4],
    [3, 5],
    [4, 5]
  ],
  biomeWeights: {
    signalArchive: 1,
    staticBloom: 1,
    mirrorConduit: 1,
    deadRelay: 1,
    coreStream: 0.7
  },
  routeTypeWeights: {
    safe: 1,
    reward: 1,
    repair: 1,
    archive: 1,
    corruption: 1
  },
  streamRoleWeights: {
    primary: 1,
    hazard: 1,
    repair: 1,
    reward: 1,
    archive: 1
  }
};
