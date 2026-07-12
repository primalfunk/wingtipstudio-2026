export const upgradeConfig = {
  upgradeChoicesCount: 3,
  upgradeRewardEncounterIndices: [1, 3, 5, 7],
  rarityWeights: {
    common: 68,
    uncommon: 25,
    rare: 7
  },
  archetypeTags: {
    flowRunner: 'Flow Runner',
    stabilizer: 'Stabilizer',
    overclocker: 'Overclocker',
    architect: 'Architect'
  },
  startingKits: [
    {
      id: 'flow_runner',
      name: 'Flow Runner',
      description: 'Preserve flow and convert perfect phrases into momentum.',
      upgradeId: 'flow_memory',
      flowGainBonus: 1
    },
    {
      id: 'stabilizer',
      name: 'Stabilizer',
      description: 'Start sturdier and soften the first layers of failure.',
      upgradeId: 'soft_failure',
      integrityBonus: 10
    },
    {
      id: 'overclocker',
      name: 'Overclocker',
      description: 'Begin with Overclock and score harder at dangerous speed.',
      upgradeId: 'redline_bonus',
      powerupId: 'overclock',
      instabilityGainMultiplier: 1.08
    },
    {
      id: 'architect',
      name: 'Architect',
      description: 'Read forks earlier and start with route-preview tools.',
      upgradeId: 'fork_preview_plus',
      powerupId: 'preview'
    }
  ],
  modifierDefaults: {
    flowMistakePenaltyMultiplier: 1,
    missIntegrityPenaltyMultiplier: 1,
    hazardDurationMultiplier: 1,
    overclockInstabilityMultiplier: 1,
    forkTelegraphBonusMs: 0,
    perfectPhraseScoreBonus: 0,
    perfectPhraseFlowBonus: 0,
    repairInstabilityReductionBonus: 0,
    streamPrioritizerScoreBonus: 0,
    streamPrioritizerFlowBonus: 0
  },
  rhythmLockPerfectsRequired: 3,
  rhythmLockInstabilityReduction: 4,
  emergencyRepairThreshold: 40,
  emergencyRepairAmount: 20,
  surgeWindowExtensionMs: 1500,
  pressureScoreMultiplier: 1.12,
  pressureInstabilityPerResolution: 1,
  redlineBaseSpeed: 1.2,
  redlineScorePerSpeedStep: 0.08,
  routeRerollEncounterUses: 1,
  extraBranchScoreBonus: 25,
  extraBranchFlowBonus: 2
};
