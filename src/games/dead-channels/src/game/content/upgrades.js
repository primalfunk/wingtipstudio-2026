export const upgradeDefinitions = [
  {
    id: 'flow_memory',
    name: 'Flow Memory',
    rarity: 'common',
    category: 'flow',
    archetypeTags: ['flowRunner'],
    description: 'Mistakes drain less flow.',
    stackable: true,
    maxStacks: 3,
    effect: { flowMistakePenaltyMultiplier: 0.82 }
  },
  {
    id: 'perfect_signal',
    name: 'Perfect Signal',
    rarity: 'common',
    category: 'scoring',
    archetypeTags: ['flowRunner'],
    description: 'Perfect phrases grant bonus score and flow.',
    stackable: true,
    maxStacks: 2,
    effect: { perfectPhraseScoreBonus: 18, perfectPhraseFlowBonus: 2 }
  },
  {
    id: 'chain_extension',
    name: 'Chain Extension',
    rarity: 'uncommon',
    category: 'flow',
    archetypeTags: ['flowRunner'],
    description: 'Phrase completion keeps a small flow reserve after misses.',
    stackable: false,
    effect: { missFlowReserve: 4 }
  },
  {
    id: 'rhythm_lock',
    name: 'Rhythm Lock',
    rarity: 'rare',
    category: 'typing',
    archetypeTags: ['flowRunner'],
    description: 'Every third perfect phrase reduces instability.',
    stackable: false,
    effect: { rhythmLock: true }
  },
  {
    id: 'soft_failure',
    name: 'Soft Failure',
    rarity: 'common',
    category: 'stability',
    archetypeTags: ['stabilizer'],
    description: 'Missed phrases deal less integrity damage.',
    stackable: true,
    maxStacks: 3,
    effect: { missIntegrityPenaltyMultiplier: 0.82 }
  },
  {
    id: 'static_filter',
    name: 'Static Filter',
    rarity: 'common',
    category: 'stability',
    archetypeTags: ['stabilizer'],
    description: 'Hazards expire sooner.',
    stackable: true,
    maxStacks: 2,
    effect: { hazardDurationMultiplier: 0.82 }
  },
  {
    id: 'emergency_repair',
    name: 'Emergency Repair',
    rarity: 'uncommon',
    category: 'recovery',
    archetypeTags: ['stabilizer'],
    description: 'Once per run, restore integrity when it drops below 40.',
    stackable: false,
    effect: { emergencyRepair: true }
  },
  {
    id: 'clean_recovery',
    name: 'Clean Recovery',
    rarity: 'rare',
    category: 'recovery',
    archetypeTags: ['stabilizer'],
    description: 'Repair routes and streams clear extra instability.',
    stackable: false,
    effect: { repairInstabilityReductionBonus: 6 }
  },
  {
    id: 'redline_bonus',
    name: 'Redline Bonus',
    rarity: 'common',
    category: 'overclock',
    archetypeTags: ['overclocker'],
    description: 'Higher phrase speed increases score gain.',
    stackable: true,
    maxStacks: 3,
    effect: { redlineScoreScaling: 1 }
  },
  {
    id: 'heat_sink',
    name: 'Heat Sink',
    rarity: 'common',
    category: 'overclock',
    archetypeTags: ['overclocker'],
    description: 'Overclock produces less instability.',
    stackable: true,
    maxStacks: 2,
    effect: { overclockInstabilityMultiplier: 0.72 }
  },
  {
    id: 'dangerous_velocity',
    name: 'Dangerous Velocity',
    rarity: 'uncommon',
    category: 'scoring',
    archetypeTags: ['overclocker'],
    description: 'Pressure encounters score higher but add instability.',
    stackable: false,
    effect: { pressureScoreBonus: true }
  },
  {
    id: 'surge_window',
    name: 'Surge Window',
    rarity: 'rare',
    category: 'overclock',
    archetypeTags: ['overclocker'],
    description: 'Perfect phrases extend active Overclock.',
    stackable: false,
    effect: { surgeWindow: true }
  },
  {
    id: 'fork_preview_plus',
    name: 'Fork Preview+',
    rarity: 'common',
    category: 'fork',
    archetypeTags: ['architect'],
    description: 'Fork routes telegraph earlier.',
    stackable: true,
    maxStacks: 2,
    effect: { forkTelegraphBonusMs: 450 }
  },
  {
    id: 'route_reroll',
    name: 'Route Reroll',
    rarity: 'uncommon',
    category: 'fork',
    archetypeTags: ['architect'],
    description: 'Once per encounter, replace one corruption branch seed with reward.',
    stackable: false,
    effect: { routeReroll: true }
  },
  {
    id: 'extra_branch_value',
    name: 'Extra Branch Value',
    rarity: 'uncommon',
    category: 'fork',
    archetypeTags: ['architect'],
    description: 'Fork Splitter branches pay out more.',
    stackable: false,
    effect: { extraBranchValue: true }
  },
  {
    id: 'stream_prioritizer',
    name: 'Stream Prioritizer',
    rarity: 'rare',
    category: 'stream',
    archetypeTags: ['architect'],
    description: 'Focused secondary streams resolve for bonus score and flow.',
    stackable: false,
    effect: { streamPrioritizerScoreBonus: 25, streamPrioritizerFlowBonus: 3 }
  }
];
