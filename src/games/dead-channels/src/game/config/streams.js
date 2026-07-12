export const streamConfig = {
  maxActiveStreams: 2,
  multiStreamEncounterStartIndex: 3,
  multiStreamEncounterFrequency: 4,
  allowForksDuringMultiStream: false,
  secondaryStreamSpawnDelayMs: 1800,
  streamLanePositions: {
    secondary: { x: 640, y: 285 },
    primary: { x: 640, y: 475 }
  },
  focusedStreamVisualScale: 1.08,
  unfocusedStreamAlpha: 0.58,
  streamRoleWeights: {
    hazard: 34,
    repair: 24,
    reward: 26,
    archive: 16
  },
  streamRoleRewards: {
    primary: { score: 25, flow: 5, progress: 1 },
    hazard: { score: 20, instability: -10, clearHazards: 1 },
    repair: { score: 10, integrity: 10, clearHazards: 1 },
    reward: { score: 75, flow: 8 },
    archive: { score: 100, flow: 5, archiveDecoded: 1 }
  },
  streamRolePenalties: {
    primary: { integrity: -10, instability: 8, flowReset: true },
    hazard: { instability: 15, flow: -5, triggerHazard: true },
    repair: { instability: 3 },
    reward: { instability: 2 },
    archive: { instability: 5 }
  },
  roleStyles: {
    primary: { label: 'PRIMARY', color: '#e8fbff' },
    hazard: { label: 'HAZARD', color: '#ff6b72' },
    repair: { label: 'REPAIR', color: '#64d8ff' },
    reward: { label: 'REWARD', color: '#ffd166' },
    archive: { label: 'ARCHIVE', color: '#b388ff' }
  }
};
