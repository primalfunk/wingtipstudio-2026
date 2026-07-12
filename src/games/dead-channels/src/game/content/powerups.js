export const powerupDefinitions = [
  {
    id: 'stabilizer',
    name: 'Stabilizer',
    type: 'active',
    rarity: 'common',
    description: 'Forgives the next 3 wrong keys for 10 seconds.',
    tags: ['defense', 'typing'],
    effect: {
      mistakeForgiveness: 3,
      durationMs: 10000,
      cooldownMs: 25000
    }
  },
  {
    id: 'preview',
    name: 'Preview',
    type: 'passive',
    rarity: 'common',
    description: 'Fork choices reveal earlier and linger longer.',
    tags: ['fork', 'planning'],
    effect: {
      forkTelegraphBonusMs: 900
    }
  },
  {
    id: 'compression',
    name: 'Compression',
    type: 'triggered',
    rarity: 'uncommon',
    description: 'Perfect phrases pre-complete the next phrase opening.',
    tags: ['typing', 'tempo'],
    effect: {
      prefixCharacters: 2
    }
  },
  {
    id: 'overclock',
    name: 'Overclock',
    type: 'active',
    rarity: 'uncommon',
    description: 'Faster stream, higher score, rising instability.',
    tags: ['risk', 'score'],
    effect: {
      durationMs: 9000,
      cooldownMs: 26000,
      speedMultiplier: 1.35,
      scoreMultiplier: 1.75
    }
  },
  {
    id: 'fork-splitter',
    name: 'Fork Splitter',
    type: 'active',
    rarity: 'rare',
    description: 'Adds one extra branch to the next fork.',
    tags: ['fork', 'route'],
    effect: {
      durationMs: 14000,
      cooldownMs: 32000,
      extraBranches: 1
    }
  },
  {
    id: 'signal-anchor',
    name: 'Signal Anchor',
    type: 'passive',
    rarity: 'uncommon',
    description: 'Skillful hard phrases and risky routes reduce instability.',
    tags: ['stability', 'skill'],
    effect: {
      hardPhraseInstabilityReduction: 4,
      riskyRouteInstabilityReduction: 6
    }
  },
  {
    id: 'echo-buffer',
    name: 'Echo Buffer',
    type: 'active',
    rarity: 'common',
    description: 'Briefly softens wrong-key and miss instability.',
    tags: ['defense', 'hazard'],
    effect: {
      durationMs: 10000,
      cooldownMs: 24000,
      instabilityMultiplier: 0.5
    }
  }
];
