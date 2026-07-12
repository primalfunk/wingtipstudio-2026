export const difficultyModes = {
  easy: {
    id: 'easy',
    label: 'Easy',
    targetWpm: 15,
    color: '#64d8ff',
    description: 'Opening pace centered around 15 WPM.',
    phraseSpeedMultiplier: 0.75,
    scoreMultiplier: 0.85,
    integrityPenaltyMultiplier: 0.65,
    instabilityPenaltyMultiplier: 0.65,
    hazardMultiplier: 0.72,
    forkFrequencyOffset: 1
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    targetWpm: 30,
    color: '#6fffc7',
    description: 'Opening pace centered around 30 WPM.',
    phraseSpeedMultiplier: 1.5,
    scoreMultiplier: 1,
    integrityPenaltyMultiplier: 1,
    instabilityPenaltyMultiplier: 1,
    hazardMultiplier: 1,
    forkFrequencyOffset: 0
  },
  expert: {
    id: 'expert',
    label: 'Expert',
    targetWpm: 45,
    color: '#fff2a6',
    description: 'Opening pace centered around 45 WPM.',
    phraseSpeedMultiplier: 2.25,
    scoreMultiplier: 1.18,
    integrityPenaltyMultiplier: 1.08,
    instabilityPenaltyMultiplier: 1.12,
    hazardMultiplier: 1.12,
    forkFrequencyOffset: 0
  },
  professional: {
    id: 'professional',
    label: 'Professional',
    targetWpm: 60,
    color: '#ffb86b',
    description: 'Opening pace centered around 60 WPM.',
    phraseSpeedMultiplier: 3,
    scoreMultiplier: 1.35,
    integrityPenaltyMultiplier: 1.14,
    instabilityPenaltyMultiplier: 1.22,
    hazardMultiplier: 1.22,
    forkFrequencyOffset: -1
  },
  master: {
    id: 'master',
    label: 'Master',
    targetWpm: 75,
    color: '#ff6b72',
    description: 'Opening pace centered around 75 WPM.',
    phraseSpeedMultiplier: 3.75,
    scoreMultiplier: 1.55,
    integrityPenaltyMultiplier: 1.22,
    instabilityPenaltyMultiplier: 1.34,
    hazardMultiplier: 1.34,
    forkFrequencyOffset: -1
  },
  wizard: {
    id: 'wizard',
    label: 'Wizard',
    targetWpm: 90,
    color: '#d56bff',
    description: 'Opening pace centered around 90 WPM.',
    phraseSpeedMultiplier: 4.5,
    scoreMultiplier: 1.8,
    integrityPenaltyMultiplier: 1.32,
    instabilityPenaltyMultiplier: 1.48,
    hazardMultiplier: 1.48,
    forkFrequencyOffset: -1
  },
  impossible: {
    id: 'impossible',
    label: 'Impossible',
    targetWpm: 110,
    color: '#ff3151',
    description: 'Opening pace centered around 110 WPM.',
    phraseSpeedMultiplier: 5.5,
    scoreMultiplier: 2.15,
    integrityPenaltyMultiplier: 1.45,
    instabilityPenaltyMultiplier: 1.7,
    hazardMultiplier: 1.7,
    forkFrequencyOffset: -1
  }
};

difficultyModes.beginner = difficultyModes.easy;
difficultyModes.assist = difficultyModes.easy;
difficultyModes.standard = difficultyModes.medium;
difficultyModes.redline = difficultyModes.expert;
difficultyModes.keyboard_god = difficultyModes.wizard;

export const difficultyModeOrder = ['easy', 'medium', 'expert', 'professional', 'master', 'wizard', 'impossible'];

export function normalizeDifficultyModeId(modeId = 'easy') {
  if (modeId === 'beginner' || modeId === 'assist') return 'easy';
  if (modeId === 'standard') return 'medium';
  if (modeId === 'redline') return 'expert';
  if (modeId === 'keyboard_god') return 'wizard';
  return difficultyModes[modeId] ? modeId : 'easy';
}

export function getDifficultyMode(modeId = 'easy') {
  return difficultyModes[normalizeDifficultyModeId(modeId)];
}

export function getNextDifficultyMode(modeId = 'easy') {
  const normalizedModeId = normalizeDifficultyModeId(modeId);
  const index = difficultyModeOrder.indexOf(normalizedModeId);
  return difficultyModeOrder[(index + 1) % difficultyModeOrder.length];
}
