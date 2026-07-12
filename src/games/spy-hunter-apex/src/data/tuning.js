export const DESIGN_WIDTH = 480;
export const DESIGN_HEIGHT = 720;
export let GAME_WIDTH = DESIGN_WIDTH;
export let GAME_HEIGHT = DESIGN_HEIGHT;

export const ROAD = {
  left: 82,
  right: 398,
  top: 0,
  bottom: GAME_HEIGHT,
  laneCount: 4,
  scrollSpeed: 280,
};

export const PLAYER = {
  startX: GAME_WIDTH / 2,
  startY: GAME_HEIGHT - 112,
  destroyedRespawnDelayMs: 3000,
  maxSpeedX: 260,
  maxSpeedY: 185,
  boatMaxSpeedX: 220,
  boatMaxSpeedY: 155,
  acceleration: 1250,
  drag: 1800,
  bounce: 0.92,
};

export const PLAYER_MODES = {
  car: {
    label: 'CAR',
    textureKey: 'player-car',
    maxHealth: 6,
    maxAmmo: 40,
    displayWidth: 28,
    displayHeight: 52,
    bodyWidth: 19,
    bodyHeight: 44,
    maxSpeedX: PLAYER.maxSpeedX,
    maxSpeedY: PLAYER.maxSpeedY,
  },
  motorcycle: {
    label: 'BIKE',
    textureKey: 'player-motorcycle',
    maxHealth: 1.5,
    maxAmmo: 20,
    displayWidth: 21,
    displayHeight: 45,
    bodyWidth: 13,
    bodyHeight: 39,
    maxSpeedX: Math.round(PLAYER.maxSpeedX * 1.15),
    maxSpeedY: Math.round(PLAYER.maxSpeedY * 1.08),
    invincibleMsOnSpawn: 3000,
  },
  boat: {
    label: 'BOAT',
    textureKey: 'vehicle-boat',
    maxHealth: 6,
    maxAmmo: 40,
    displayWidth: 32,
    displayHeight: 58,
    bodyWidth: 22,
    bodyHeight: 50,
    maxSpeedX: PLAYER.boatMaxSpeedX,
    maxSpeedY: PLAYER.boatMaxSpeedY,
  },
};

export const DAMAGE = {
  maxPlayerDamage: 3,
  trafficCollision: 0.25,
  enemyCollision: 0.25,
  bulletHit: 0.33,
  cannonHit: 0.67,
  rocketHit: 1,
  mineHit: 2,
  infrastructureCollision: 0.5,
  collisionCooldownMs: 850,
  enemyProjectileCooldownMs: 180,
  bounceVelocity: 260,
};

export const TRAFFIC = {
  initialDelayMs: 900,
  minSpawnDelayMs: 700,
  maxSpawnDelayMs: 1350,
  minVehicleSpeed: 135,
  maxVehicleSpeed: 230,
  safeSpawnGap: 118,
  despawnY: GAME_HEIGHT + 70,
  maxActiveVehicles: 12,
};

export const COMBAT = {
  fireCooldownMs: 220,
  bulletSpeed: 440,
  bulletDespawnY: -30,
  enemyInitialDelayMs: 3200,
  enemyMinSpawnDelayMs: 1600,
  enemyMaxSpawnDelayMs: 2600,
  enemyMinSpeed: 185,
  enemyMaxSpeed: 255,
  enemyScore: 100,
  civilianHitPenalty: 75,
};

export const SUPPORT = {
  initialDelayMs: 9000,
  minSpawnDelayMs: 14500,
  maxSpawnDelayMs: 21000,
  speed: 155,
  avoidanceSpeed: 105,
  maxAmmo: 40,
  startingAmmo: 40,
  repairServiceMs: 1000,
  ammoServiceMs: 1000,
  decoyAmmoAmount: 6,
  trackerAwarenessIncrease: 0.28,
  despawnY: GAME_HEIGHT + 90,
};

export const SIGNALS = {
  firstSignalDelayMs: 1200,
  messageDurationMs: 3600,
  roadSignSpeed: ROAD.scrollSpeed,
  roadSignDespawnY: GAME_HEIGHT + 80,
};

export function setGameSize(width = DESIGN_WIDTH, height = DESIGN_HEIGHT) {
  GAME_WIDTH = Math.max(320, Math.floor(width));
  GAME_HEIGHT = Math.max(480, Math.floor(height));

  const maxRoadWidth = Math.max(240, Math.min(560, GAME_WIDTH - 48));
  const minRoadWidth = Math.min(300, maxRoadWidth);
  const roadWidth = PhaserClamp(GAME_WIDTH * 0.66, minRoadWidth, maxRoadWidth);
  ROAD.left = Math.round((GAME_WIDTH - roadWidth) / 2);
  ROAD.right = Math.round(ROAD.left + roadWidth);
  ROAD.bottom = GAME_HEIGHT;
  ROAD.scrollSpeed = Math.round(280 * PhaserClamp(GAME_HEIGHT / DESIGN_HEIGHT, 0.92, 1.18));

  PLAYER.startX = Math.round(GAME_WIDTH / 2);
  PLAYER.startY = Math.round(GAME_HEIGHT - 112);
  TRAFFIC.despawnY = GAME_HEIGHT + 70;
  SUPPORT.despawnY = GAME_HEIGHT + 90;
  SIGNALS.roadSignDespawnY = GAME_HEIGHT + 80;
}

function PhaserClamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
