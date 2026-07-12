export const GAME_CONFIG = {
  width: 1280,
  height: 720,
  backgroundColor: '#05080c'
};

export const TEXTURE_KEYS = {
  playerDroid: 'droid-player-001'
};

export const COLORS = {
  background: 0x05080c,
  floor: 0x0b1118,
  corridorFloor: 0x09141c,
  panel: 0x14202b,
  wall: 0x78f0ff,
  wallShadow: 0x1e5664,
  door: 0xffd36a,
  lockedDoor: 0xff6f61,
  terminal: 0x79f2c0,
  lift: 0x79f2c0,
  liftCore: 0xffd36a,
  hudText: '#baf7ff',
  hudAccent: '#ffd36a',
  playerFill: 0x102532,
  playerStroke: 0xbaf7ff,
  playerAccent: 0xffd36a
};

export const ROOM = {
  x: 0,
  y: 0,
  width: 1600,
  height: 1000,
  wallThickness: 36,
  panelSpacing: 100
};

export const DEBUG = {
  showHudDetails: false,
  showAllRoomsOnMap: false,
  showRoomLabels: false,
  showCollisionOverlay: false,
  showWallFillCells: false,
  enableHudDetailsToggle: true,
  enableCollisionOverlayToggle: true,
  enableCollisionAudit: true,
  enableWallFillToggle: true,
  enableRegenerate: true,
  enableDeckWarp: true,
  enableClearDebug: true
};

export const SHIP_GENERATION = {
  seed: 'plasmodyne-ship-001',
  deckCount: 10,
  deckNames: [
    'TRANSFER BAY',
    'SERVICE RING',
    'CARGO SPINE',
    'RELAY GALLERIA',
    'SECURITY CONCOURSE',
    'ASSAULT LOCKS',
    'FOUNDRY CORE',
    'HUNTER GRID',
    'DOMINION VAULT',
    'NULL CATHEDRAL'
  ],
  liftRadius: 38,
  liftInteractRange: 110,
  elevatorShaftMin: 6,
  elevatorShaftMax: 8,
  elevatorShaftMaxStops: 4,
  elevatorShaftTargetStops: 3
};

export const DROID_GENERATION = {
  totalMin: 25,
  totalMax: 40,
  radius: 34,
  collisionRadius: 38,
  textureSize: 74,
  roomEdgePadding: 64,
  spawnSpacing: 91,
  startRoomExclusionDeckId: 1,
  maxRoomSpawnAttempts: 80
};

export const DIFFICULTY_LEVELS = {
  easy: {
    label: 'EASY',
    droidTotalMin: 15,
    droidTotalMax: 24,
    minPerDeck: 1
  },
  normal: {
    label: 'NORMAL',
    droidTotalMin: 25,
    droidTotalMax: 40,
    minPerDeck: 2
  },
  hard: {
    label: 'HARD',
    droidTotalMin: 50,
    droidTotalMax: 80,
    minPerDeck: 5
  }
};

export const TRANSFER = {
  range: 280,
  cooldownMs: 900,
  failureDamage: 8,
  baseTimeMs: 8500,
  minTimeMs: 5200
};

export const BODY_STABILITY = {
  warningRatio: 0.3,
  criticalRatio: 0.1,
  damagePenaltyFactor: 0.35,
  ejectedIntegrity: 12
};

export const INTERACTION = {
  range: 96
};

export const DECK_GENERATION = {
  seed: 'plasmodyne-deck-001',
  id: 1,
  name: 'Deck 1 / Generated Deck',
  width: 4480,
  height: 3072,
  margin: 180,
  roomCountMin: 10,
  roomCountMax: 20,
  roomPadding: 90,
  corridorWidth: 128,
  collisionCellSize: 16,
  maxPlacementAttempts: 600,
  maxGenerationAttempts: 160,
  extraLinksMin: 2,
  extraLinksMax: 4
};

export const STARTING_BODY = {
  rank: 1,
  displayId: '001',
  chassisClass: 'Influence',
  // Temporary debug override for early combat testing; canonical 001 is unarmed.
  weaponTier: 'WEAPON_1',
  armorTier: 'ARMOR_1',
  speedTier: 'SPEED_3',
  maxIntegrity: 25,
  integrity: 25,
  speed: 250,
  acceleration: 1350,
  drag: 1250,
  precisionMultiplier: 0.45,
  clearanceLevel: 0,
  weaponType: 'laser-1',
  instability: null,
  stabilityMax: null,
  stabilityCurrent: null,
  stabilityDecayRate: 0,
  bodyFailureState: 'stable'
};

export const PLAYER = {
  radius: 34,
  collisionRadius: 30,
  textureSize: 91,
  cameraLerp: 0.08,
  cameraZoom: 1.16
};
