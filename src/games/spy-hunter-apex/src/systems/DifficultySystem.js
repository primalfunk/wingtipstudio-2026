import StorageSystem from './StorageSystem.js';

export const DIFFICULTY_PRESETS = {
  easy: {
    label: 'EASY',
    maxPlayerDamage: 4,
    playerHealthScale: 1.45,
    damageScale: 0.55,
    enemySpeedScale: 0.82,
    enemyAggressionScale: 0.6,
    enemySpawnScale: 0.58,
    trafficSpawnScale: 0.72,
    supportSpawnScale: 1.35,
    prioritySupportDelayScale: 0.85,
  },
  medium: {
    label: 'MEDIUM',
    maxPlayerDamage: 3,
    playerHealthScale: 1,
    damageScale: 1,
    enemySpeedScale: 1,
    enemyAggressionScale: 1,
    enemySpawnScale: 1,
    trafficSpawnScale: 1,
    supportSpawnScale: 1.12,
    prioritySupportDelayScale: 1,
  },
  hard: {
    label: 'HARD',
    maxPlayerDamage: 2.5,
    playerHealthScale: 0.78,
    damageScale: 1.35,
    enemySpeedScale: 1.1,
    enemyAggressionScale: 1.28,
    enemySpawnScale: 1.35,
    trafficSpawnScale: 1.12,
    supportSpawnScale: 0.78,
    prioritySupportDelayScale: 1.45,
  },
};

export default class DifficultySystem {
  static getPreset() {
    const settings = StorageSystem.loadSettings();
    return DIFFICULTY_PRESETS[settings.difficulty] ?? DIFFICULTY_PRESETS.medium;
  }
}
