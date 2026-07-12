export type GradeLevel = "K" | "1" | "2" | "3" | "4" | "5" | "6";

export const GRADE_LABELS: Record<GradeLevel, string> = {
  K: "Kindergarten",
  "1": "Grade 1",
  "2": "Grade 2",
  "3": "Grade 3",
  "4": "Grade 4",
  "5": "Grade 5",
  "6": "Grade 6 / Middle School"
};

export type Settings = {
  colorblindSafe: boolean;
  dyslexiaFont: boolean;
  audioEnabled: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
};

export type GradeStats = {
  highScore: number;
  bestGameLevel: number;
  gamesPlayed: number;
};

export type Profile = {
  id: string;
  name: string;
  createdAt: string;
  selectedGrade: GradeLevel;
  statsByGrade: Record<GradeLevel, GradeStats>;
  settings?: Partial<Settings>;
};

export type StoredData = {
  version: 1;
  activeProfileId: string | null;
  profiles: Profile[];
  globalSettings: Settings;
};

export type Challenge = {
  id: string;
  prompt: string;
  answer: string | number;
  displayMode: AmmoMode;
  difficultyWeight: number;
};

export type AmmoMode = "problemAmmo_answerTargets";

export type EquationItem = {
  id: string;
  prompt: string;
  answer: string;
  targetId: string;
  resolved: boolean;
};

export type EquationSet = {
  id: string;
  index: number;
  equations: EquationItem[];
  completed: boolean;
};

export type Launcher = {
  id: string;
  laneIndex: number;
  x: number;
  y: number;
  selected: boolean;
};

export type FallingObject = {
  id: string;
  laneIndex: number;
  x: number;
  y: number;
  radius: number;
  label: string;
  owningEquationId: string;
  speed: number;
  age: number;
  rotationDirection: -1 | 1;
  rotationSpeed: number;
};

export type FallingTarget = FallingObject;

export type Projectile = {
  id: string;
  x: number;
  y: number;
  startX: number;
  startY: number;
  targetObjectId: string;
  label: string;
  correct: boolean;
  impacted?: boolean;
  speed: number;
};

export type VisualEffect = {
  id: string;
  x: number;
  y: number;
  label?: string;
  kind: "explosion" | "wrong" | "level";
  age: number;
  duration: number;
};

export type LaunchEffect = {
  id: string;
  launcherIndex: number;
  x: number;
  y: number;
  age: number;
  duration: number;
};

export type ImpactFeedback = {
  age: number;
  duration: number;
  intensity: number;
  previousHealth: number;
  currentHealth: number;
};

export type ScreenShake = {
  age: number;
  duration: number;
  intensity: number;
};

export type RuntimeDifficulty = {
  gameLevel: number;
  fallSpeedPxPerSecond: number;
  spawnIntervalMs: number;
  maxActiveFallingObjects: number;
};

export type MathOperation =
  | "addition"
  | "subtraction"
  | "multiplication"
  | "division"
  | "fractions"
  | "algebra";

export type DifficultyLevelConfig = {
  grade: GradeLevel;
  level: number;
  roundInLevel: number;
  roundsPerLevel: number;
  asteroidSetSize: number;
  setSize: number;
  maxVisibleTargets: number;
  fallSpeedMultiplier: number;
  fallSpeedPxPerSecond: number;
  operations: MathOperation[];
  maxProblemNumber: number;
  allowSetOverlap: boolean;
  spawnDelayWithinSetMs: number;
};

export type GameSnapshot = {
  score: number;
  gameLevel: number;
  baseHealth: number;
  streak: number;
  correct: number;
  misses: number;
  accuracy: number;
  grade: GradeLevel;
  ammoLabel: string;
  ammoMode: AmmoMode;
};

export const WORLD_WIDTH = 960;
export const WORLD_HEIGHT = 540;
export const MAX_BASE_HITS = 5;
export const LAUNCHER_WIDTH = 132;
export const LAUNCHER_HEIGHT = 84;
