export const unlockDefinitions = [
  {
    id: 'kit_flow_runner',
    unlockId: 'flow_runner',
    type: 'startingKit',
    name: 'Flow Runner Class',
    description: 'Begin with flow-preserving upgrades.',
    initiallyUnlocked: true,
    unlockCondition: null
  },
  {
    id: 'kit_stabilizer',
    unlockId: 'stabilizer',
    type: 'startingKit',
    name: 'Stabilizer Class',
    description: 'Begin with defensive stability tools.',
    initiallyUnlocked: true,
    unlockCondition: null
  },
  {
    id: 'kit_overclocker',
    unlockId: 'overclocker',
    type: 'startingKit',
    name: 'Overclocker Class',
    description: 'Begin with speed and score pressure.',
    initiallyUnlocked: true,
    unlockCondition: null
  },
  {
    id: 'kit_architect',
    unlockId: 'architect',
    type: 'startingKit',
    name: 'Architect Class',
    description: 'Begin with stronger fork control.',
    initiallyUnlocked: true,
    unlockCondition: null
  },
  {
    id: 'modifier_clean_signal',
    unlockId: 'clean_signal',
    type: 'modifier',
    name: 'Clean Signal',
    description: 'Foundation modifier: fewer hazards, lower scoring later.',
    initiallyUnlocked: false,
    unlockCondition: { type: 'completedRunsAtLeast', value: 1 }
  },
  {
    id: 'modifier_mirror_drift',
    unlockId: 'mirror_drift',
    type: 'modifier',
    name: 'Mirror Drift',
    description: 'Future modifier for stranger branch pressure.',
    initiallyUnlocked: false,
    unlockCondition: { type: 'totalForksResolvedAtLeast', value: 25 }
  },
  {
    id: 'modifier_archive_hunt',
    unlockId: 'archive_hunt',
    type: 'modifier',
    name: 'Archive Hunt',
    description: 'Future modifier for archive-heavy routes.',
    initiallyUnlocked: false,
    unlockCondition: { type: 'totalArchivesDecodedAtLeast', value: 10 }
  },
  {
    id: 'modifier_flow_surge',
    unlockId: 'flow_surge',
    type: 'modifier',
    name: 'Flow Surge',
    description: 'Future modifier for high-flow run texture.',
    initiallyUnlocked: false,
    unlockCondition: { type: 'bestFlowAtLeast', value: 80 }
  },
  {
    id: 'modifier_low_noise',
    unlockId: 'low_noise',
    type: 'modifier',
    name: 'Low Noise Victory',
    description: 'Future modifier for clean instability play.',
    initiallyUnlocked: false,
    unlockCondition: { type: 'winBelowInstability', value: 25 }
  },
  {
    id: 'modifier_redline_mode',
    unlockId: 'redline_mode',
    type: 'modifier',
    name: 'Redline Mode',
    description: 'Future modifier for faster streams and higher score.',
    initiallyUnlocked: false,
    unlockCondition: { type: 'overclockWinsAtLeast', value: 1 }
  }
];

export const challengeModifiers = [
  {
    id: 'clean_signal',
    name: 'Clean Signal',
    description: 'Fewer hazards, lower score multiplier. Structure only in this phase.'
  },
  {
    id: 'mirror_drift',
    name: 'Mirror Drift',
    description: 'Future branch text pressure modifier.'
  },
  {
    id: 'static_weather',
    name: 'Static Weather',
    description: 'Future hazard frequency modifier.'
  },
  {
    id: 'redline_mode',
    name: 'Redline Mode',
    description: 'Future speed and scoring modifier.'
  },
  {
    id: 'archive_hunt',
    name: 'Archive Hunt',
    description: 'Future archive route density modifier.'
  }
];
