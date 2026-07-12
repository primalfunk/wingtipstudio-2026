import type { DifficultyLevelConfig, GradeLevel, MathOperation, RuntimeDifficulty } from "./types";

export const ROUNDS_PER_LEVEL = 3;
export const MAX_LEVEL = 18;
const LOWEST_DIFFICULTY_SPEED_MULTIPLIER = 0.75;
const UPPER_GRADE_FALL_SPEED_MULTIPLIER = 0.5;

type Tier = 1 | 2 | 3;

function difficultyTierForGrade(grade: GradeLevel): Tier {
  if (grade === "2") return 2;
  if (grade === "3" || grade === "4" || grade === "5" || grade === "6") return 3;
  return 1;
}

function speedFor(tier: Tier, level: number): number {
  return baseFallSpeedForTier(tier) * LOWEST_DIFFICULTY_SPEED_MULTIPLIER * getFallSpeedMultiplierForLevel(level);
}

function fallSpeedMultiplierForGrade(grade: GradeLevel): number {
  return grade === "5" || grade === "6" ? UPPER_GRADE_FALL_SPEED_MULTIPLIER : 1;
}

function baseFallSpeedForTier(tier: Tier): number {
  if (tier === 1) return 18;
  if (tier === 2) return 42;
  return 60;
}

export function getAsteroidSetSizeForLevel(level: number): number {
  const safeLevel = Math.min(MAX_LEVEL, Math.max(1, level));
  if (safeLevel <= 4) return 2;
  if (safeLevel <= 8) return 3;
  if (safeLevel <= 12) return 4;
  return 5;
}

export function getFallSpeedMultiplierForLevel(level: number): number {
  const safeLevel = Math.min(MAX_LEVEL, Math.max(1, level));
  if (safeLevel <= MAX_LEVEL - 5) return 1;
  return 1 + (safeLevel - (MAX_LEVEL - 5)) * 0.01;
}

export function getKindergartenMaxProblemNumber(level: number): number {
  return getLeveledMaxProblemNumber(level, 30, 20, 25);
}

function getLeveledMaxProblemNumber(level: number, cap: number, early: number, middle: number): number {
  const safeLevel = Math.min(MAX_LEVEL, Math.max(1, level));
  if (safeLevel <= 6) return Math.min(cap, early);
  if (safeLevel <= 12) return Math.min(cap, middle);
  return cap;
}

function getOperationsForGradeLevel(grade: GradeLevel): MathOperation[] {
  if (grade === "K") return ["addition", "subtraction"];
  if (grade === "1" || grade === "2") return ["addition", "subtraction"];
  if (grade === "3") return ["addition", "subtraction", "multiplication", "division", "fractions"];
  if (grade === "4" || grade === "5") return ["addition", "subtraction", "multiplication", "division", "fractions"];
  return ["addition", "subtraction", "multiplication", "division", "fractions", "algebra"];
}

function getMaxProblemNumberForGradeLevel(grade: GradeLevel, level: number): number {
  if (grade === "K") return getKindergartenMaxProblemNumber(level);
  if (grade === "1") return getLeveledMaxProblemNumber(level, 40, 20, 30);
  if (grade === "2") return getLeveledMaxProblemNumber(level, 50, 30, 40);
  return 50;
}

export function difficultyConfigFor(
  grade: GradeLevel,
  gameLevel: number,
  roundInLevel = 1
): DifficultyLevelConfig {
  const tier = difficultyTierForGrade(grade);
  const level = Math.min(MAX_LEVEL, Math.max(1, gameLevel));
  const asteroidSetSize = getAsteroidSetSizeForLevel(level);
  const gradeFallSpeedMultiplier = fallSpeedMultiplierForGrade(grade);
  const fallSpeedMultiplier = getFallSpeedMultiplierForLevel(level) * gradeFallSpeedMultiplier;
  return {
    grade,
    level,
    roundInLevel: Math.min(ROUNDS_PER_LEVEL, Math.max(1, roundInLevel)),
    roundsPerLevel: ROUNDS_PER_LEVEL,
    asteroidSetSize,
    setSize: asteroidSetSize,
    maxVisibleTargets: asteroidSetSize,
    fallSpeedMultiplier,
    fallSpeedPxPerSecond: speedFor(tier, gameLevel) * gradeFallSpeedMultiplier,
    operations: getOperationsForGradeLevel(grade),
    maxProblemNumber: getMaxProblemNumberForGradeLevel(grade, level),
    allowSetOverlap: false,
    spawnDelayWithinSetMs: 0
  };
}

export function difficultyForLevel(gameLevel: number): RuntimeDifficulty {
  const config = difficultyConfigFor("1", gameLevel, 1);
  return {
    gameLevel,
    fallSpeedPxPerSecond: config.fallSpeedPxPerSecond,
    spawnIntervalMs: config.spawnDelayWithinSetMs,
    maxActiveFallingObjects: config.maxVisibleTargets
  };
}
