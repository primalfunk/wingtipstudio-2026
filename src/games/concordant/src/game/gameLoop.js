import { Ship } from "../entities/ship.js";
import { EnemyShip } from "../entities/enemyShip.js";
import { BeaconRelic } from "../entities/beaconRelic.js";
import { UpgradeStation } from "../entities/upgradeStation.js";
import { UpgradePickup } from "../entities/upgradePickup.js";
import { Camera } from "./camera.js";
import { SectorManager, SECTOR_SIZE, SECTOR_TYPES } from "./sectorManager.js";
import { computeStarAccelAt, integrate } from "./physics.js";
import { applyForcesToEntity } from "./forceFields.js";
import { applyDragToEntity, drawSectorOcclusion, updateSectorOcclusion } from "./sectorModifiers.js";
import { sounds, music } from "./audio.js";
import { getSectorMeta, saveSectorIndex, setSectorMeta } from "./sectorIndex.js";
import { createDefaultGameState, saveGameState } from "./gameState.js";
import { showShipDestroyedModal } from "../ui/shipDestroyedModal.js";
import { showUpgradeStationModal } from "../ui/upgradeStationModal.js";
import { drawRivers } from "./riverRender.js";
import { getRiversForSector } from "./riverNetwork.js";
import { getStationInfoForSector, pickStationPosition } from "./stationSystem.js";
import { createRng, hashInts } from "./rng.js";
import { drawMeridianSpine, projectileHitsMeridian, resolveMeridianCollision } from "./meridian.js";
import { CLUES, CLUE_TOTAL } from "../data/clues.js";
import {
  ALERT,
  BEARING,
  HUD_COLORS,
  HUD_FONT,
  MINIMAP,
  drawAutopilotToggle,
  drawAlerts,
  drawTutorialCallout,
  getAutopilotButtonRect,
  drawBeaconSignalHud,
  drawBearingIndicators,
  drawFuelGauge,
  drawMiniMap,
  drawStationIndicators,
  drawScanPulse,
  drawScoreHud,
  drawStatusHud
} from "./hud.js";
import {
  CONTROL_DISABLE,
  SCORE_POPUP,
  SCORE_POPUP_COLORS,
  TRAIL_COLOR,
  drawBackgroundEvents,
  drawControlDisableOverlay,
  drawParticles,
  drawScorePopups,
  drawScreenEffects,
  drawTrail
} from "./visualEffects.js";
import {
  Particle,
  drawBullets,
  drawEnemies,
  drawEnemyBullets,
  drawFuelPickups,
  drawResourcePickups,
  getEnemySpawnCountForSector,
  handleBulletHits,
  handleFuelPickups,
  handleResourcePickups,
  spawnBullet,
  spawnExplosion,
  updateBullets,
  updateEnemies,
  updateEnemyBullets,
  updateEnemyPings,
  updateFuelPickups,
  updateResourcePickups,
  updateParticles
} from "./combatSystem.js";
import { CONFIG } from "./config.js";

const {
  DEBUG,
  CAMERA,
  GAMEPLAY,
  SCORE,
  BEACON,
  CALIBRATION,
  BACKGROUND,
  EFFECTS,
  INPUT,
  BULLET,
  ENEMY,
  SHIP,
  SECTOR,
  RIVER,
  AUTOPILOT,
  UPGRADES,
  PICKUPS,
  OBJECTS,
  CLUES: CLUE_CONFIG,
  STATION,
  AUDIO,
  ASTEROID
} = CONFIG;

const { ZOOM, SHAKE } = CAMERA;
const {
  ACTIVE_SECTOR_RANGE,
  STARTING_LIVES,
  INVULN_DURATION,
  GAME_OVER_DELAY,
  RESPAWN_DELAY,
  INTRO
} = GAMEPLAY;
const { CHUNK_MULTIPLIER: SCORE_CHUNK_MULTIPLIER, POINTS: SCORE_POINTS } = SCORE;
const { SHIP_RADIUS: CALIBRATION_SHIP_RADIUS, GATE: CALIBRATION_GATE } = CALIBRATION;
const {
  STARFIELD,
  DUSTFIELD,
  FARFIELD,
  SLICE: BACKGROUND_SLICE,
  EVENTS: BACKGROUND_EVENTS,
  PALETTE: PSYCHE_PALETTE,
  NEBULA
} = BACKGROUND;
const MERIDIAN_CONFIG = SECTOR.MERIDIAN ?? {};
const MERIDIAN_CHROMA_STRENGTH = Number.isFinite(MERIDIAN_CONFIG.CHROMA_SPLIT_STRENGTH)
  ? MERIDIAN_CONFIG.CHROMA_SPLIT_STRENGTH
  : 0.55;
const MERIDIAN_CHROMA_HUE = Number.isFinite(MERIDIAN_CONFIG.CHROMA_SPLIT_HUE)
  ? MERIDIAN_CONFIG.CHROMA_SPLIT_HUE
  : 18;
const MERIDIAN_CHROMA_SAT = Number.isFinite(MERIDIAN_CONFIG.CHROMA_SPLIT_SAT)
  ? MERIDIAN_CONFIG.CHROMA_SPLIT_SAT
  : 1.15;
const MERIDIAN_PARALLAX_SHEAR = Number.isFinite(MERIDIAN_CONFIG.PARALLAX_SHEAR)
  ? MERIDIAN_CONFIG.PARALLAX_SHEAR
  : 0.02;
const MERIDIAN_SILENCE_MULT = Number.isFinite(MERIDIAN_CONFIG.SILENCE_BAND_MULTIPLIER)
  ? MERIDIAN_CONFIG.SILENCE_BAND_MULTIPLIER
  : 2.4;
const MERIDIAN_SILENCE_ALPHA = Number.isFinite(MERIDIAN_CONFIG.SILENCE_BAND_ALPHA)
  ? MERIDIAN_CONFIG.SILENCE_BAND_ALPHA
  : 0.35;
const MERIDIAN_SMEAR_MULT = Number.isFinite(MERIDIAN_CONFIG.SMEAR_BAND_MULTIPLIER)
  ? MERIDIAN_CONFIG.SMEAR_BAND_MULTIPLIER
  : 2.8;
const MERIDIAN_SMEAR_STRETCH = Number.isFinite(MERIDIAN_CONFIG.SMEAR_STRETCH)
  ? MERIDIAN_CONFIG.SMEAR_STRETCH
  : 1.7;
const MERIDIAN_SMEAR_ALPHA = Number.isFinite(MERIDIAN_CONFIG.SMEAR_ALPHA)
  ? MERIDIAN_CONFIG.SMEAR_ALPHA
  : 0.18;
const { THRUST_PARTICLES, TRAIL_SPARKS } = EFFECTS;
const { TOUCH } = INPUT;
const START_SAFE_RADIUS = SECTOR.START_SAFE_RADIUS;
const SECTOR_CACHE_RANGE = Number.isFinite(SECTOR.RUNTIME_CACHE_RANGE)
  ? SECTOR.RUNTIME_CACHE_RANGE
  : 3;
const PLAYER_EFFECTIVE_RANGE = BULLET.SPEED * BULLET.LIFE;
const ENEMY_RANGE_SCALE = ENEMY.RANGE_SCALE;
const ENEMY_EFFECTIVE_RANGE = PLAYER_EFFECTIVE_RANGE * ENEMY_RANGE_SCALE;
const ENEMY_FIRE_RANGE = ENEMY_EFFECTIVE_RANGE * 1.1;
const ASTEROID_COLLISION_BOUNCE = Number.isFinite(ASTEROID?.COLLISION_BOUNCE)
  ? ASTEROID.COLLISION_BOUNCE
  : 0.7;
const ASTEROID_COLLISION_DAMPING = Number.isFinite(ASTEROID?.COLLISION_DAMPING)
  ? ASTEROID.COLLISION_DAMPING
  : 0.98;
const ASTEROID_COLLISION_MASS_POWER = Number.isFinite(ASTEROID?.COLLISION_MASS_POWER)
  ? ASTEROID.COLLISION_MASS_POWER
  : 2;
const ASTEROID_RADIUS_MIN = Number.isFinite(ASTEROID?.GENERATION?.RADIUS_MIN)
  ? ASTEROID.GENERATION.RADIUS_MIN
  : 10;
const ASTEROID_RADIUS_MAX = Number.isFinite(ASTEROID?.GENERATION?.RADIUS_MAX)
  ? ASTEROID.GENERATION.RADIUS_MAX
  : 33;
const ASTEROID_SHIP_MASS_MIN = 0.5;
const ASTEROID_SHIP_MASS_MAX = 5.0;
const OBJECTS_CONFIG = OBJECTS ?? {};
const OBJECT_DROPPABLES = OBJECTS_CONFIG.DROPPABLES ?? {};
const OBJECT_EXPLOSION_RING = OBJECTS_CONFIG.EXPLOSION_RING ?? {};
const OBJECT_EXPLOSION_RING_BASE = Number.isFinite(OBJECT_EXPLOSION_RING.BASE_RADIUS)
  ? OBJECT_EXPLOSION_RING.BASE_RADIUS
  : 60;
const OBJECT_EXPLOSION_RING_LIFE = Number.isFinite(OBJECT_EXPLOSION_RING.LIFE)
  ? OBJECT_EXPLOSION_RING.LIFE
  : 0.45;
const OBJECT_EXPLOSION_RING_WIDTH = Number.isFinite(OBJECT_EXPLOSION_RING.WIDTH)
  ? OBJECT_EXPLOSION_RING.WIDTH
  : 6;
const OBJECT_EXPLOSION_RING_COLOR = OBJECT_EXPLOSION_RING.COLOR ?? "rgba(255, 80, 80, 0.4)";
const OBJECT_EXPLOSION_RING_CORE_MULT = Number.isFinite(OBJECT_EXPLOSION_RING.CORE_MULT)
  ? OBJECT_EXPLOSION_RING.CORE_MULT
  : 3.0;
const OBJECT_SPAWN_BUFFER = Number.isFinite(OBJECTS_CONFIG.LURE?.SPAWN_BUFFER)
  ? OBJECTS_CONFIG.LURE.SPAWN_BUFFER
  : 120;
const ENEMY_BULLET_LIFE = BULLET.LIFE * ENEMY_RANGE_SCALE;
const SPECIAL_SECTOR_TYPES = new Set([
  SECTOR_TYPES.APSE,
  SECTOR_TYPES.QUIET_REACH,
  SECTOR_TYPES.MERIDIAN,
  SECTOR_TYPES.PALIMPSEST
]);
const QUIET_REACH_AUDIO = AUDIO?.QUIET_REACH ?? { FADE_OUT_MS: 1200, FADE_IN_MS: 1200 };
const CLUE_LOOKUP = new Map(
  Array.isArray(CLUES)
    ? CLUES.map((clue) => [clue.clue_id, clue])
    : []
);
const ALL_CLUE_IDS = Array.from({ length: CLUE_TOTAL }, (_, index) => index + 1);
const DEFAULT_CLUE_SPEAKER = "Clara";

function getViewRadius(canvas, camera) {
  return (Math.hypot(canvas.width, canvas.height) / 2) / camera.zoom;
}

function getSectorCenter(sx, sy) {
  return {
    x: sx * SECTOR_SIZE + SECTOR_SIZE / 2,
    y: sy * SECTOR_SIZE + SECTOR_SIZE / 2
  };
}

function findActiveSectorForPosition(activeSectorsList, x, y) {
  if (!Array.isArray(activeSectorsList) || activeSectorsList.length === 0) {
    return null;
  }
  for (const activeSector of activeSectorsList) {
    const bounds = activeSector?.bounds;
    if (!bounds) {
      continue;
    }
    if (x >= bounds.x && x <= bounds.x + bounds.size
      && y >= bounds.y && y <= bounds.y + bounds.size) {
      return activeSector;
    }
  }
  return activeSectorsList[0];
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function getHudScale(screenW, screenH) {
  const base = Math.min(screenW, screenH);
  const minScale = base < 420 ? 0.65 : 0.75;
  return Math.min(1, Math.max(minScale, base / 900));
}

function pickPsycheColor() {
  return PSYCHE_PALETTE[Math.floor(Math.random() * PSYCHE_PALETTE.length)];
}

function rgba(color, alpha, scale = 1) {
  const r = Math.max(0, Math.min(255, Math.round(color[0] * scale)));
  const g = Math.max(0, Math.min(255, Math.round(color[1] * scale)));
  const b = Math.max(0, Math.min(255, Math.round(color[2] * scale)));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function createStarfield(width, height, config = STARFIELD) {
  const offscreen = document.createElement("canvas");
  offscreen.width = width;
  offscreen.height = height;
  const octx = offscreen.getContext("2d");
  const imageData = octx.createImageData(width, height);
  const data = imageData.data;
  const density = config?.DENSITY ?? STARFIELD.DENSITY;
  const minBrightness = config?.BRIGHTNESS_MIN ?? STARFIELD.BRIGHTNESS_MIN;
  const maxBrightness = config?.BRIGHTNESS_MAX ?? STARFIELD.BRIGHTNESS_MAX;
  const brightnessSpan = Math.max(0, maxBrightness - minBrightness);
  const count = Math.floor(width * height * density);

  for (let i = 0; i < count; i++) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    const idx = (y * width + x) * 4;
    const brightness = minBrightness + Math.floor(Math.random() * (brightnessSpan + 1));
    data[idx] = brightness;
    data[idx + 1] = brightness;
    data[idx + 2] = brightness;
    data[idx + 3] = 255;
  }

  octx.putImageData(imageData, 0, 0);
  return offscreen;
}

function createRotatingSlice(size, config = BACKGROUND_SLICE) {
  const offscreen = document.createElement("canvas");
  offscreen.width = size;
  offscreen.height = size;
  const octx = offscreen.getContext("2d");
  const center = size / 2;
  const radius = size * 0.32;
  const count = Math.floor(size * size * config.DENSITY);
  const arc = config.ARC ?? Math.PI;
  for (let i = 0; i < count; i++) {
    const angle = (Math.random() - 0.5) * arc;
    const dist = Math.random() * radius;
    const x = center + Math.cos(angle) * dist;
    const y = center + Math.sin(angle) * dist;
    const color = pickPsycheColor();
    const intensity = 0.6 + Math.random() * 0.5;
    octx.fillStyle = rgba(color, 0.85, intensity);
    octx.fillRect(x, y, 1, 1);
  }
  return offscreen;
}

function createNebulaTexture(size, config = NEBULA) {
  const offscreen = document.createElement("canvas");
  offscreen.width = size;
  offscreen.height = size;
  const octx = offscreen.getContext("2d");
  const center = size / 2;
  const radius = size * config.RADIUS_SCALE;
  const ringWidth = radius * config.RING_WIDTH;
  const ringColorA = pickPsycheColor();
  const ringColorB = pickPsycheColor();

  const ringGrad = octx.createRadialGradient(center, center, radius - ringWidth, center, center, radius + ringWidth);
  ringGrad.addColorStop(0, rgba(ringColorA, 0));
  ringGrad.addColorStop(0.5, rgba(ringColorB, 0.26));
  ringGrad.addColorStop(1, rgba(ringColorA, 0));
  octx.fillStyle = ringGrad;
  octx.beginPath();
  octx.arc(center, center, radius + ringWidth, 0, Math.PI * 2);
  octx.fill();

  for (let i = 0; i < config.BLOB_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = radius + (Math.random() - 0.5) * ringWidth * 1.2;
    const x = center + Math.cos(angle) * dist;
    const y = center + Math.sin(angle) * dist;
    const blobRadius = ringWidth * (0.35 + Math.random() * 0.6);
    const blobColor = pickPsycheColor();
    const blob = octx.createRadialGradient(x, y, 0, x, y, blobRadius);
    blob.addColorStop(0, rgba(blobColor, 0.35));
    blob.addColorStop(1, rgba(blobColor, 0));
    octx.fillStyle = blob;
    octx.beginPath();
    octx.arc(x, y, blobRadius, 0, Math.PI * 2);
    octx.fill();
  }

  return offscreen;
}

function drawStarfield(ctx, starfield, offsetX, offsetY, width, height) {
  if (!starfield) {
    return;
  }
  const x = ((offsetX % width) + width) % width;
  const y = ((offsetY % height) + height) % height;
  const ox = -x;
  const oy = -y;

  ctx.drawImage(starfield, ox, oy);
  ctx.drawImage(starfield, ox + width, oy);
  ctx.drawImage(starfield, ox, oy + height);
  ctx.drawImage(starfield, ox + width, oy + height);
}

function worldToScreen(x, y, ship, camera, canvas) {
  return {
    x: (x - ship.x) * camera.zoom + canvas.width / 2 + camera.shakeX,
    y: (y - ship.y) * camera.zoom + canvas.height / 2 + camera.shakeY
  };
}

function clipMeridianHalfPlane(ctx, center, dx, dy, sideSign, extent) {
  const nx = -dy;
  const ny = dx;
  const ax = center.x + dx * extent;
  const ay = center.y + dy * extent;
  const bx = center.x - dx * extent;
  const by = center.y - dy * extent;
  const cx = bx + nx * extent * sideSign;
  const cy = by + ny * extent * sideSign;
  const dx2 = ax + nx * extent * sideSign;
  const dy2 = ay + ny * extent * sideSign;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx, cy);
  ctx.lineTo(dx2, dy2);
  ctx.closePath();
  ctx.clip();
}

function getMeridianIntensityScale(sector, ship) {
  if (!sector?.meridian || !sector?.bounds || !ship) {
    return 1;
  }
  const bounds = sector.bounds;
  const center = sector.meridian.center ?? {
    x: bounds.x + bounds.size / 2,
    y: bounds.y + bounds.size / 2
  };
  const dx = ship.x - center.x;
  const dy = ship.y - center.y;
  const axis = sector.meridian.axisAngle;
  if (!Number.isFinite(axis)) {
    return 1;
  }
  const nx = -Math.sin(axis);
  const ny = Math.cos(axis);
  const dist = Math.abs(dx * nx + dy * ny);
  const falloff = bounds.size * 0.5;
  if (falloff <= 0) {
    return 1;
  }
  const t = Math.min(1, dist / falloff);
  return 1 + (1 - t);
}

function drawMeridianBackgroundSplit(ctx, sector, ship, camera, canvas, layers, timeMs, intensityScale = 1) {
  if (!sector?.meridian || !sector?.bounds || MERIDIAN_CHROMA_STRENGTH <= 0) {
    return;
  }
  const bounds = sector.bounds;
  const center = sector.meridian.center ?? {
    x: bounds.x + bounds.size / 2,
    y: bounds.y + bounds.size / 2
  };
  const screenOrigin = worldToScreen(bounds.x, bounds.y, ship, camera, canvas);
  const screenRect = {
    x: screenOrigin.x,
    y: screenOrigin.y,
    width: bounds.size * camera.zoom,
    height: bounds.size * camera.zoom
  };
  const screenCenter = worldToScreen(center.x, center.y, ship, camera, canvas);
  const angle = sector.meridian.axisAngle;
  const dx = Math.cos(angle) * camera.zoom;
  const dy = Math.sin(angle) * camera.zoom;
  const extent = Math.max(canvas.width, canvas.height) * 2 + screenRect.width;
  const smearHalf = (sector.meridian.spineWidth * 0.5) * MERIDIAN_SMEAR_MULT * camera.zoom;

  const scaledChromaStrength = MERIDIAN_CHROMA_STRENGTH * intensityScale;
  const scaledParallaxShear = MERIDIAN_PARALLAX_SHEAR * intensityScale;
  const scaledSmearAlpha = MERIDIAN_SMEAR_ALPHA * intensityScale;

  const drawSmearLayer = (layerCanvas, parallax, sideSign, filter, alpha) => {
    if (!layerCanvas || alpha <= 0 || smearHalf <= 0) {
      return;
    }
    const parallaxScale = 1 + scaledParallaxShear * sideSign;
    ctx.save();
    ctx.beginPath();
    ctx.rect(screenRect.x, screenRect.y, screenRect.width, screenRect.height);
    ctx.clip();
    clipMeridianHalfPlane(ctx, screenCenter, dx, dy, sideSign, extent);
    ctx.save();
    ctx.translate(screenCenter.x, screenCenter.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.rect(-extent, -smearHalf, extent * 2, smearHalf * 2);
    ctx.clip();
    ctx.scale(MERIDIAN_SMEAR_STRETCH, 1);
    ctx.rotate(-angle);
    ctx.translate(-screenCenter.x, -screenCenter.y);
    ctx.globalAlpha = alpha;
    ctx.filter = filter;
    const offsetX = -ship.x * parallax * parallaxScale;
    const offsetY = -ship.y * parallax * parallaxScale;
    drawStarfield(ctx, layerCanvas, offsetX, offsetY, canvas.width, canvas.height);
    ctx.restore();
    ctx.restore();
  };

  const drawSide = (sideSign) => {
    const hueShift = sideSign * MERIDIAN_CHROMA_HUE;
    const parallaxScale = 1 + scaledParallaxShear * sideSign;
    const filter = `hue-rotate(${hueShift}deg) saturate(${MERIDIAN_CHROMA_SAT})`;

    ctx.save();
    ctx.beginPath();
    ctx.rect(screenRect.x, screenRect.y, screenRect.width, screenRect.height);
    ctx.clip();
    clipMeridianHalfPlane(ctx, screenCenter, dx, dy, sideSign, extent);

    if (layers.farfield) {
      ctx.save();
      ctx.globalAlpha = FARFIELD.ALPHA * scaledChromaStrength;
      ctx.filter = filter;
      const offsetX = -ship.x * FARFIELD.PARALLAX * parallaxScale;
      const offsetY = -ship.y * FARFIELD.PARALLAX * parallaxScale;
      drawStarfield(ctx, layers.farfield, offsetX, offsetY, canvas.width, canvas.height);
      ctx.restore();
      drawSmearLayer(
        layers.farfield,
        FARFIELD.PARALLAX,
        sideSign,
        filter,
        FARFIELD.ALPHA * scaledSmearAlpha
      );
    }
    if (layers.dustfield) {
      ctx.save();
      ctx.globalAlpha = DUSTFIELD.ALPHA * scaledChromaStrength;
      ctx.filter = filter;
      const offsetX = -ship.x * DUSTFIELD.PARALLAX * parallaxScale;
      const offsetY = -ship.y * DUSTFIELD.PARALLAX * parallaxScale;
      drawStarfield(ctx, layers.dustfield, offsetX, offsetY, canvas.width, canvas.height);
      ctx.restore();
      drawSmearLayer(
        layers.dustfield,
        DUSTFIELD.PARALLAX,
        sideSign,
        filter,
        DUSTFIELD.ALPHA * scaledSmearAlpha
      );
    }
    if (layers.starfield) {
      ctx.save();
      ctx.globalAlpha = STARFIELD.ALPHA * scaledChromaStrength;
      ctx.filter = filter;
      const offsetX = -ship.x * STARFIELD.PARALLAX * parallaxScale;
      const offsetY = -ship.y * STARFIELD.PARALLAX * parallaxScale;
      drawStarfield(ctx, layers.starfield, offsetX, offsetY, canvas.width, canvas.height);
      ctx.restore();
      drawSmearLayer(
        layers.starfield,
        STARFIELD.PARALLAX,
        sideSign,
        filter,
        STARFIELD.ALPHA * scaledSmearAlpha
      );
    }
    if (layers.sliceField) {
      ctx.save();
      ctx.globalAlpha = BACKGROUND_SLICE.ALPHA * scaledChromaStrength;
      ctx.filter = filter;
      ctx.translate(
        canvas.width / 2 - ship.x * BACKGROUND_SLICE.PARALLAX * parallaxScale,
        canvas.height / 2 - ship.y * BACKGROUND_SLICE.PARALLAX * parallaxScale
      );
      ctx.rotate(timeMs * BACKGROUND_SLICE.ROT_SPEED);
      ctx.drawImage(layers.sliceField, -layers.sliceField.width / 2, -layers.sliceField.height / 2);
      ctx.restore();
    }
    if (layers.nebulaField) {
      ctx.save();
      ctx.globalAlpha = NEBULA.ALPHA * scaledChromaStrength;
      ctx.globalCompositeOperation = "lighter";
      ctx.filter = filter;
      ctx.translate(
        canvas.width / 2 - ship.x * NEBULA.PARALLAX * parallaxScale,
        canvas.height / 2 - ship.y * NEBULA.PARALLAX * parallaxScale
      );
      ctx.rotate(timeMs * NEBULA.ROT_SPEED);
      ctx.drawImage(layers.nebulaField, -layers.nebulaField.width / 2, -layers.nebulaField.height / 2);
      ctx.restore();
    }
    ctx.restore();
  };

  drawSide(1);
  drawSide(-1);
}

function drawMeridianSilenceBand(ctx, sector, ship, camera, canvas, intensityScale = 1) {
  const scaledAlpha = MERIDIAN_SILENCE_ALPHA * intensityScale;
  if (!sector?.meridian || !sector?.bounds || scaledAlpha <= 0) {
    return;
  }
  const bounds = sector.bounds;
  const center = sector.meridian.center ?? {
    x: bounds.x + bounds.size / 2,
    y: bounds.y + bounds.size / 2
  };
  const screenOrigin = worldToScreen(bounds.x, bounds.y, ship, camera, canvas);
  const screenRect = {
    x: screenOrigin.x,
    y: screenOrigin.y,
    width: bounds.size * camera.zoom,
    height: bounds.size * camera.zoom
  };
  const screenCenter = worldToScreen(center.x, center.y, ship, camera, canvas);
  const angle = sector.meridian.axisAngle;
  const halfWidth = (sector.meridian.spineWidth * 0.5) * MERIDIAN_SILENCE_MULT * camera.zoom;
  const extent = Math.max(canvas.width, canvas.height) * 2 + screenRect.width;

  ctx.save();
  ctx.beginPath();
  ctx.rect(screenRect.x, screenRect.y, screenRect.width, screenRect.height);
  ctx.clip();
  ctx.translate(screenCenter.x, screenCenter.y);
  ctx.rotate(angle);
  ctx.fillStyle = `rgba(0, 0, 0, ${scaledAlpha})`;
  ctx.fillRect(-extent, -halfWidth, extent * 2, halfWidth * 2);
  ctx.restore();
}

export function startGame(canvas, ctx, uiRoot, gameState, sectorIndex, onGameOver, options = {}) {
  const demoMode = Boolean(options?.demoMode);
  const autopilotDefault = Boolean(options?.autopilotDefault);
  const onExitToMenu = typeof options?.onExitToMenu === "function" ? options.onExitToMenu : null;
  if (demoMode) {
    gameState = createDefaultGameState(AUTOPILOT.DEMO_SEED);
    sectorIndex = {};
  }
  const allowPersistence = !demoMode;
  sounds.preload();
  sounds.setMuted(demoMode);
  music.start();
  const startX = SECTOR_SIZE / 2;
  const startY = SECTOR_SIZE / 2;
  const originX = startX;
  const originY = startY;
  const ship = new Ship(startX, startY);
  const camera = new Camera(ship);
  const worldSeed = Number.isFinite(gameState?.worldSeed) ? gameState.worldSeed : 0;
  const sectorManager = new SectorManager({
    worldSeed,
    sectorIndex,
    gameState,
    startSafeRadius: START_SAFE_RADIUS,
    persist: allowPersistence
  });
  let sector = sectorManager.getSectorForPosition(
    ship.x,
    ship.y
  );
  let activeSectors = sectorManager.getSectorsAround(
    ship.x,
    ship.y,
    ACTIVE_SECTOR_RANGE
  );
  let farthestSector = { sx: sector.sx, sy: sector.sy, distance: 0 };
  let quietReachAudioActive = false;
  const applyQuietReachAudio = (active, instant = false) => {
    if (!instant && quietReachAudioActive === active) {
      return;
    }
    quietReachAudioActive = active;
    const fadeOutMs = QUIET_REACH_AUDIO.FADE_OUT_MS ?? 1200;
    const fadeInMs = QUIET_REACH_AUDIO.FADE_IN_MS ?? 1200;
    const duration = instant ? 0 : (active ? fadeOutMs : fadeInMs);
    const targetVolume = active ? 0 : 1;
    sounds.fadeMasterVolume(targetVolume, duration);
    if (active) {
      music.fadeTo(0, duration);
    } else {
      music.fadeToBase(duration);
    }
  };
  applyQuietReachAudio(sector?.sectorType === SECTOR_TYPES.QUIET_REACH, true);
  const trail = [];
  const SHIP_RADIUS = SHIP.COLLISION_RADIUS;
  const TRAIL_MAX = SHIP.TRAIL.MAX;
  const TRAIL_MIN_DIST = SHIP.TRAIL.MIN_DIST;
  const TRAIL_FADE_SPEED = SHIP.TRAIL.FADE_SPEED;
  const TRAIL_FADE_STEP = SHIP.TRAIL.FADE_STEP;
  let lastTrailX = null;
  let lastTrailY = null;
  let trailFadeTimer = 0;
  let starfield = null;
  let dustfield = null;
  let farfield = null;
  let sliceField = null;
  let nebulaField = null;
  let starfieldW = 0;
  let starfieldH = 0;
  const STARFIELD_PARALLAX = STARFIELD.PARALLAX;
  const DUSTFIELD_PARALLAX = DUSTFIELD.PARALLAX;
  const FARFIELD_PARALLAX = FARFIELD.PARALLAX;
  const particles = [];
  const bullets = [];
  const enemyBullets = [];
  const enemies = [];
  const fuelPickups = [];
  const resourcePickups = [];
  const upgradePickups = [];
  const impactRings = [];
  const alerts = [];
  const scorePopups = [];
  let stationMarkers = [];

  let lastTime = performance.now();
  let running = true;
  let rafId = null;
  let gameOver = false;
  let pendingGameOver = false;
  let gameOverTimer = 0;
  let cachedGameOverStats = null;
  let shipVisible = true;
  let respawnTimer = 0;
  let upgradeLevels = {
    fireRateLevel: 0,
    fireDistanceLevel: 0,
    scanDistanceLevel: 0,
    hullLevel: 0,
    collectorLevel: 0,
    fuelTankLevel: 0
  };
  let resourceCurrency = 0;
  const clueState = {
    totalCollected: 0,
    collectedIds: new Set(),
    selectedVariants: {}
  };
  let stateDirty = false;
  let lastStateSave = 0;
  if (gameState) {
    if (Number.isFinite(gameState.resourceCurrency)) {
      resourceCurrency = Math.max(0, Math.floor(gameState.resourceCurrency));
    }
    if (gameState.upgrades) {
      upgradeLevels = {
        fireRateLevel: Math.max(0, Math.floor(gameState.upgrades.fireRateLevel ?? 0)),
        fireDistanceLevel: Math.max(0, Math.floor(gameState.upgrades.fireDistanceLevel ?? 0)),
        scanDistanceLevel: Math.max(0, Math.floor(gameState.upgrades.scanDistanceLevel ?? 0)),
        hullLevel: Math.max(0, Math.floor(gameState.upgrades.hullLevel ?? 0)),
        collectorLevel: Math.max(0, Math.floor(gameState.upgrades.collectorLevel ?? 0)),
        fuelTankLevel: Math.max(0, Math.floor(gameState.upgrades.fuelTankLevel ?? 0))
      };
    }
    if (gameState.clues) {
      const rawIds = Array.isArray(gameState.clues.collectedIds)
        ? gameState.clues.collectedIds
        : [];
      clueState.collectedIds = new Set(
        rawIds.filter((id) => Number.isFinite(id) && id >= 1 && id <= CLUE_TOTAL)
      );
      const storedTotal = Number.isFinite(gameState.clues.totalCollected)
        ? Math.floor(gameState.clues.totalCollected)
        : 0;
      clueState.totalCollected = Math.max(clueState.collectedIds.size, storedTotal, 0);
      clueState.selectedVariants = typeof gameState.clues.selectedVariants === "object"
        && gameState.clues.selectedVariants !== null
        ? { ...gameState.clues.selectedVariants }
        : {};
    }
  }
  let zoomLevels = [];
  let zoomIndex = 0;
  let zoomMinIndex = 0;
  let zoomMaxIndex = 0;
  let baseZoomIndex = 0;
  let maxScanDistanceLevel = 0;
  const defaultOutSteps = Number.isFinite(ZOOM.DEFAULT_OUT_STEPS) ? ZOOM.DEFAULT_OUT_STEPS : 0;
  const baseZoom = Math.max(ZOOM.MIN, Math.min(ZOOM.MAX, 1 - ZOOM.WHEEL_STEP * defaultOutSteps));
  const baseOutSteps = Number.isFinite(ZOOM.OUT_STEPS_BASE) ? ZOOM.OUT_STEPS_BASE : 3;

  const buildZoomLevels = (base, min, max, step) => {
    const levels = new Set();
    const clampedBase = Math.max(min, Math.min(max, base));
    levels.add(clampedBase);
    for (let z = clampedBase - step; z > min + 1e-6; z -= step) {
      levels.add(Number(z.toFixed(4)));
    }
    levels.add(min);
    for (let z = clampedBase + step; z < max - 1e-6; z += step) {
      levels.add(Number(z.toFixed(4)));
    }
    levels.add(max);
    return Array.from(levels).sort((a, b) => a - b);
  };

  const findClosestZoomIndex = (levels, target) => {
    let idx = 0;
    let best = Infinity;
    for (let i = 0; i < levels.length; i++) {
      const diff = Math.abs(levels[i] - target);
      if (diff < best) {
        best = diff;
        idx = i;
      }
    }
    return idx;
  };

  const clampZoomIndex = (index) => Math.min(zoomMaxIndex, Math.max(zoomMinIndex, index));

  const setZoomIndex = (index) => {
    zoomIndex = clampZoomIndex(index);
    if (zoomLevels[zoomIndex]) {
      camera.zoom = zoomLevels[zoomIndex];
    }
  };

  const updateZoomBounds = () => {
    const maxZoomOutSteps = baseZoomIndex;
    const allowedOutSteps = Math.min(baseOutSteps + upgradeLevels.scanDistanceLevel, maxZoomOutSteps);
    zoomMinIndex = Math.max(0, baseZoomIndex - allowedOutSteps);
    setZoomIndex(zoomIndex);
  };

  const initZoomLevels = () => {
    zoomLevels = buildZoomLevels(baseZoom, ZOOM.MIN, ZOOM.MAX, ZOOM.WHEEL_STEP);
    zoomMaxIndex = zoomLevels.length - 1;
    baseZoomIndex = findClosestZoomIndex(zoomLevels, baseZoom);
    const maxZoomOutSteps = baseZoomIndex;
    maxScanDistanceLevel = Math.max(0, maxZoomOutSteps - baseOutSteps);
    upgradeLevels.scanDistanceLevel = Math.min(upgradeLevels.scanDistanceLevel, maxScanDistanceLevel);
    zoomIndex = baseZoomIndex;
    updateZoomBounds();
  };
  normalizeOrderedClues();
  ensureClueVariantsSelected();
  initZoomLevels();
  let maxLives = getMaxLives(upgradeLevels.hullLevel);
  let lives = maxLives;
  let maxArmor = getMaxArmor(upgradeLevels.hullLevel);
  let armor = maxArmor;
  if (gameState && Number.isFinite(gameState.armor)) {
    armor = Math.max(0, Math.min(maxArmor, Math.floor(gameState.armor)));
  }
  let maxFuel = getMaxFuel(upgradeLevels.fuelTankLevel);
  ship.maxFuel = maxFuel;
  ship.fuel = ship.maxFuel;
  if (gameState) {
    gameState.resourceCurrency = resourceCurrency;
    gameState.armor = armor;
    gameState.upgrades = {
      fireRateLevel: upgradeLevels.fireRateLevel,
      fireDistanceLevel: upgradeLevels.fireDistanceLevel,
      scanDistanceLevel: upgradeLevels.scanDistanceLevel,
      hullLevel: upgradeLevels.hullLevel,
      collectorLevel: upgradeLevels.collectorLevel,
      fuelTankLevel: upgradeLevels.fuelTankLevel
    };
    gameState.clues = {
      totalCollected: clueState.totalCollected,
      collectedIds: Array.from(clueState.collectedIds),
      selectedVariants: { ...clueState.selectedVariants }
    };
  }
  let surveyed = clueState.totalCollected;
  let invulnTimer = 0;
  let timeSpent = 0;
  let distanceTraveled = 0;
  let scoreMultiplier = 1 + surveyed;
  let score = 0;
  let combatScore = 0;
  let scorePulse = 0;
  let fireCooldown = 0;
  let fireLockout = BULLET.FIRE_LOCKOUT;
  let enemiesSpawned = 0;
  let enemiesInRange = [];
  const enemyPings = [];
  let alertClock = 0;
  const intro = {
    enabled: !demoMode,
    suppressAlerts: !demoMode,
    clock: 0,
    nextAt: 0,
    controlUsed: false,
    firstSurveyComplete: false,
    sectorTransitions: 0,
    lastSectorKey: null,
    releaseAlertsAt: null,
    flags: {
      systems: false,
      goals: false,
      score: false,
      fuel: false,
      weird: false,
      rivers: false,
      stars: false,
      distance: false,
      anomaly: false,
      echo: false,
      movingStars: false,
      station: false
    },
    highlightQueue: [],
    highlights: {
      goal: 0,
      exit: 0,
      score: 0,
      fuel: 0,
      vignette: 0,
      river: 0
    }
  };
  const tutorial = {
    active: true,
    stepIndex: 0,
    stepStarted: false,
    stepStartedAt: 0,
    chevronTimer: 0,
    flags: {
      aimed: false,
      fired: false,
      thrusted: false,
      looted: false,
      chevrons: false
    }
  };
  let shakeTime = 0;
  let shakeDuration = 0;
  let shakeStrength = 0;
  let thrustParticleCarry = 0;
  let trailSparkCarry = 0;
  const backgroundEvents = [];
  const backgroundRecent = [];
  let backgroundClock = 0;
  let nextBackgroundEvent = 0;
  let lastSectorKey = null;
  let lastSectorRef = null;
  let lastTravelSectorRef = null;
  let wasInBeaconZone = false;
  let wasInActiveMotif = false;
  let beaconScanPenalty = 0;
  let calibrationScore = 0;
  let gateSpawnTimer = randomRange(CALIBRATION_GATE.SPAWN_MIN, CALIBRATION_GATE.SPAWN_MAX);
  let activeGates = [];
  let chainProgress = 0;
  let gateCorrection = null;
  let controlsDisabledTimer = 0;
  let deathPauseActive = false;
  let deathModal = null;
  let docked = false;
  let dockStation = null;
  let stationEntryLockId = null;
  let upgradeModal = null;
  let interactPressed = false;
  let autopilotActive = autopilotDefault;
  let autopilotFirePause = 0;
  let autopilotThrustCooldown = 0;
  let autopilotThrustBurst = 0;
  let autopilotTurnBias = 1;
  let autopilotButtonRect = null;
  sounds.setKeyMuted("thrust", autopilotActive);
  sounds.setKeyMuted("thrust_rotate", autopilotActive);
  let autopilotTarget = null;
  const beaconSignal = {
    phase: 0,
    motif: "INVOCATION",
    strength: 0
  };
  const mouse = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    leftDown: false,
    rightDown: false,
    hasMoved: false
  };
  const touch = {
    aimId: null,
    thrustId: null,
    fireId: null,
    aimX: 0,
    aimY: 0,
    thrustStartX: 0,
    thrustStartY: 0,
    thrustX: 0,
    thrustY: 0,
    lastAimAngle: null,
    touches: new Map(),
    isActive: false
  };
  let interactButton = null;
  let exitButton = null;
  let terminateButton = null;
  let terminateRequested = false;
  let mouseAimEnabled = true;
  let wheelZoomStep = 0;
  const pinch = {
    active: false,
    startDist: 0,
    startZoom: 1
  };

  const updateMousePosition = (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
    mouse.x = (event.clientX - rect.left) * scaleX;
    mouse.y = (event.clientY - rect.top) * scaleY;
    mouse.hasMoved = true;
    if (!touch.isActive) {
      touch.lastAimAngle = null;
    }
  };
  const getAutopilotRectScreen = () => {
    if (autopilotButtonRect) {
      return autopilotButtonRect;
    }
    const hudScale = getHudScale(canvas.width, canvas.height);
    const hudW = canvas.width / hudScale;
    const hudH = canvas.height / hudScale;
    const isCompactHud = Math.min(canvas.width, canvas.height) < 820;
    const rect = getAutopilotButtonRect(hudW, hudH, isCompactHud);
    return {
      x: rect.x * hudScale,
      y: rect.y * hudScale,
      width: rect.width * hudScale,
      height: rect.height * hudScale
    };
  };
  const tryToggleAutopilot = (screenX, screenY) => {
    if (docked || deathPauseActive || pendingGameOver) {
      return false;
    }
    const rect = getAutopilotRectScreen();
    if (!rect) {
      return false;
    }
    const hit = screenX >= rect.x && screenX <= rect.x + rect.width
      && screenY >= rect.y && screenY <= rect.y + rect.height;
    if (!hit) {
      return false;
    }
    setAutopilotActive(!autopilotActive, true);
    return true;
  };

  const onMouseMove = (event) => updateMousePosition(event);
  const onMouseDown = (event) => {
    updateMousePosition(event);
    if (event.button === 0) {
      if (tryToggleAutopilot(mouse.x, mouse.y)) {
        return;
      }
      mouse.leftDown = true;
    } else if (event.button === 2) {
      mouse.rightDown = true;
    }
  };
  const onMouseUp = (event) => {
    if (event.button === 0) {
      mouse.leftDown = false;
    } else if (event.button === 2) {
      mouse.rightDown = false;
    }
  };
  const onContextMenu = (event) => {
    event.preventDefault();
  };
  const onWheel = (event) => {
    if (event.deltaY === 0) {
      return;
    }
    event.preventDefault();
    wheelZoomStep += event.deltaY > 0 ? -1 : 1;
  };
  const getTouchPosition = (touchEvent) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
    return {
      x: (touchEvent.clientX - rect.left) * scaleX,
      y: (touchEvent.clientY - rect.top) * scaleY
    };
  };
  const getTouchButtonRadius = (kind) => {
    const minDim = Math.min(canvas.width, canvas.height);
    const scaleMul = Number.isFinite(TOUCH.BUTTON_SCALE) ? TOUCH.BUTTON_SCALE : 1;
    if (kind === "thrust") {
      const min = Number.isFinite(TOUCH.THRUST_RADIUS_MIN) ? TOUCH.THRUST_RADIUS_MIN : 15;
      const max = Number.isFinite(TOUCH.THRUST_RADIUS_MAX) ? TOUCH.THRUST_RADIUS_MAX : 30;
      const scale = Number.isFinite(TOUCH.THRUST_RADIUS_SCALE) ? TOUCH.THRUST_RADIUS_SCALE : 0.04;
      return Math.min(max * scaleMul, Math.max(min * scaleMul, minDim * scale * scaleMul));
    }
    const min = Number.isFinite(TOUCH.FIRE_RADIUS_MIN) ? TOUCH.FIRE_RADIUS_MIN : 15;
    const max = Number.isFinite(TOUCH.FIRE_RADIUS_MAX) ? TOUCH.FIRE_RADIUS_MAX : 30;
    const scale = Number.isFinite(TOUCH.FIRE_RADIUS_SCALE) ? TOUCH.FIRE_RADIUS_SCALE : 0.04;
    return Math.min(max * scaleMul, Math.max(min * scaleMul, minDim * scale * scaleMul));
  };
  const isInCircle = (pos, cx, cy, radius) => {
    const dx = pos.x - cx;
    const dy = pos.y - cy;
    return dx * dx + dy * dy <= radius * radius;
  };
  const isInThrustZone = (pos) => {
    const centerX = canvas.width * (TOUCH.THRUST_HINT_X ?? 0.18);
    const centerY = canvas.height * (TOUCH.THRUST_HINT_Y ?? 0.78);
    const radius = getTouchButtonRadius("thrust");
    return isInCircle(pos, centerX, centerY, radius);
  };
  const isInFireZone = (pos) => {
    const centerX = canvas.width * (TOUCH.FIRE_BUTTON_X ?? 0.82);
    const centerY = canvas.height * (TOUCH.FIRE_BUTTON_Y ?? 0.78);
    const radius = getTouchButtonRadius("fire");
    return isInCircle(pos, centerX, centerY, radius);
  };
  const assignAimTouch = () => {
    if (touch.aimId !== null) {
      return;
    }
    let candidate = null;
    for (const [id, data] of touch.touches.entries()) {
      if (data.role !== "aim") {
        continue;
      }
      if (!candidate || data.startTime < candidate.startTime) {
        candidate = { id, data };
      }
    }
    if (candidate) {
      touch.aimId = candidate.id;
      touch.aimX = candidate.data.x;
      touch.aimY = candidate.data.y;
    }
  };
  const getPinchDistance = (touches) => {
    if (!touches || touches.length < 2) {
      return 0;
    }
    const a = getTouchPosition(touches[0]);
    const b = getTouchPosition(touches[1]);
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const startPinch = (touches) => {
    pinch.active = true;
    pinch.startDist = getPinchDistance(touches);
    pinch.startZoom = camera.zoom;
  };
  const updatePinch = (touches) => {
    if (!pinch.active || touches.length < 2 || pinch.startDist <= 0) {
      return;
    }
    const dist = getPinchDistance(touches);
    const ratio = dist / pinch.startDist;
    const target = pinch.startZoom * ratio;
    const nextIndex = findClosestZoomIndex(zoomLevels, target);
    setZoomIndex(nextIndex);
  };
  const endPinch = (touches) => {
    if (!touches || touches.length < 2) {
      pinch.active = false;
    }
  };
  const onTouchStart = (event) => {
    event.preventDefault();
    for (const t of event.changedTouches) {
      const pos = getTouchPosition(t);
      if (tryToggleAutopilot(pos.x, pos.y)) {
        continue;
      }
      let role = "aim";
      if (isInFireZone(pos) && touch.fireId === null) {
        role = "fire";
        touch.fireId = t.identifier;
      } else if (isInThrustZone(pos) && touch.thrustId === null) {
        role = "thrust";
        touch.thrustId = t.identifier;
        touch.thrustStartX = pos.x;
        touch.thrustStartY = pos.y;
        touch.thrustX = pos.x;
        touch.thrustY = pos.y;
      }
      touch.touches.set(t.identifier, {
        role,
        x: pos.x,
        y: pos.y,
        startX: pos.x,
        startY: pos.y,
        startTime: performance.now()
      });
      if (role === "aim" && touch.aimId === null) {
        touch.aimId = t.identifier;
        touch.aimX = pos.x;
        touch.aimY = pos.y;
      }
    }
    touch.isActive = touch.touches.size > 0;
    if (touch.isActive) {
      mouse.hasMoved = false;
    }
    if (TOUCH.PINCH_ENABLED && !touch.thrustId && !touch.fireId && !pinch.active && event.touches.length >= 2) {
      startPinch(event.touches);
    }
  };
  const onTouchMove = (event) => {
    event.preventDefault();
    for (const t of event.changedTouches) {
      const data = touch.touches.get(t.identifier);
      if (!data) {
        continue;
      }
      const pos = getTouchPosition(t);
      data.x = pos.x;
      data.y = pos.y;
      if (data.role === "thrust" && t.identifier === touch.thrustId) {
        touch.thrustX = pos.x;
        touch.thrustY = pos.y;
      }
      if (data.role === "aim" && t.identifier === touch.aimId) {
        touch.aimX = pos.x;
        touch.aimY = pos.y;
      }
    }
    if (TOUCH.PINCH_ENABLED && !touch.thrustId && !touch.fireId && event.touches.length >= 2) {
      if (!pinch.active) {
        startPinch(event.touches);
      }
      updatePinch(event.touches);
    }
  };
  const onTouchEnd = (event) => {
    event.preventDefault();
    for (const t of event.changedTouches) {
      const data = touch.touches.get(t.identifier);
      if (data) {
        touch.touches.delete(t.identifier);
      }
      if (t.identifier === touch.thrustId) {
        touch.thrustId = null;
      }
      if (t.identifier === touch.fireId) {
        touch.fireId = null;
      }
      if (t.identifier === touch.aimId) {
        touch.aimId = null;
      }
    }
    assignAimTouch();
    touch.isActive = touch.touches.size > 0;
    if (!TOUCH.PINCH_ENABLED || event.touches.length < 2) {
      endPinch(event.touches);
    }
  };
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  canvas.addEventListener("touchstart", onTouchStart, { passive: false });
  canvas.addEventListener("touchmove", onTouchMove, { passive: false });
  canvas.addEventListener("touchend", onTouchEnd, { passive: false });
  canvas.addEventListener("touchcancel", onTouchEnd, { passive: false });
  canvas.addEventListener("contextmenu", onContextMenu);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  if (uiRoot) {
    interactButton = document.createElement("button");
    interactButton.type = "button";
    interactButton.className = "interact-button";
    interactButton.textContent = "INTERACT";
    interactButton.style.display = "none";
    interactButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      interactPressed = true;
    });
    uiRoot.appendChild(interactButton);

    exitButton = document.createElement("button");
    exitButton.type = "button";
    exitButton.className = "exit-button";
    exitButton.textContent = "X";
    exitButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      requestExitToMenu();
    });
    uiRoot.appendChild(exitButton);

    terminateButton = document.createElement("button");
    terminateButton.type = "button";
    terminateButton.className = "terminate-button";
    terminateButton.textContent = "OUT OF FUEL - PRESS TO TERMINATE FLIGHT";
    terminateButton.style.display = "none";
    terminateButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      terminateRequested = true;
    });
    uiRoot.appendChild(terminateButton);
  }

  function cleanupMouseControls() {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mouseup", onMouseUp);
    canvas.removeEventListener("touchstart", onTouchStart);
    canvas.removeEventListener("touchmove", onTouchMove);
    canvas.removeEventListener("touchend", onTouchEnd);
    canvas.removeEventListener("touchcancel", onTouchEnd);
    canvas.removeEventListener("contextmenu", onContextMenu);
    canvas.removeEventListener("wheel", onWheel);
    if (interactButton) {
      interactButton.remove();
      interactButton = null;
    }
    if (exitButton) {
      exitButton.remove();
      exitButton = null;
    }
    if (terminateButton) {
      terminateButton.remove();
      terminateButton = null;
    }
    closeUpgradeModal();
  }

  function respawn() {
    let target = farthestSector ?? { sx: sector?.sx ?? 0, sy: sector?.sy ?? 0, distance: 0 };
    if (sector && SPECIAL_SECTOR_TYPES.has(sector.sectorType) && lastTravelSectorRef) {
      target = { sx: lastTravelSectorRef.sx, sy: lastTravelSectorRef.sy, distance: target.distance ?? 0 };
    }
    const respawnPoint = getSectorCenter(target.sx, target.sy);
    ship.x = respawnPoint.x;
    ship.y = respawnPoint.y;
    ship.vx = 0;
    ship.vy = 0;
    ship.heading = 0;
    ship.fuel = ship.maxFuel;
    armor = maxArmor;
    if (gameState) {
      gameState.armor = armor;
      markStateDirty();
    }
    lastTrailX = null;
    lastTrailY = null;
    trail.length = 0;
    invulnTimer = INVULN_DURATION;
    scoreMultiplier = 1;
    ship.stopThrustLoop();
    sector = sectorManager.getSectorForPosition(ship.x, ship.y);
    if (intro.enabled && sector) {
      const sectorKey = `${sector.sx},${sector.sy}`;
      if (intro.lastSectorKey && intro.lastSectorKey !== sectorKey) {
        intro.sectorTransitions += 1;
      }
      intro.lastSectorKey = sectorKey;
    }
    activeSectors = sectorManager.getSectorsAround(ship.x, ship.y, ACTIVE_SECTOR_RANGE);
  }

  function getScorePopupColor(eventType) {
    return SCORE_POPUP_COLORS[eventType] ?? SCORE_POPUP_COLORS.generic;
  }

  function spawnScorePopup(value, worldPos, eventType, colorOverride = null) {
    if (!worldPos || !Number.isFinite(worldPos.x) || !Number.isFinite(worldPos.y)) {
      return;
    }
    const display = Math.max(0, Math.round(value));
    if (display <= 0) {
      return;
    }
    scorePopups.push({
      value: display,
      x: worldPos.x,
      y: worldPos.y,
      age: 0,
      life: SCORE_POPUP.LIFE,
      color: colorOverride || getScorePopupColor(eventType)
    });
  }

  function addScore(points, applyMultiplier = false, trackCombat = false, worldPos = null, eventType = "generic") {
    const applied = applyMultiplier ? points * scoreMultiplier : points;
    score += applied;
    if (trackCombat) {
      combatScore += points;
    }
    scorePulse = Math.min(2.0, scorePulse + 0.8);
    spawnScorePopup(applied, worldPos, eventType);
  }

  function syncUpgradeState() {
    maxLives = getMaxLives(upgradeLevels.hullLevel);
    const prevMaxArmor = maxArmor;
    maxArmor = getMaxArmor(upgradeLevels.hullLevel);
    if (maxArmor > prevMaxArmor) {
      armor = Math.min(maxArmor, armor + (maxArmor - prevMaxArmor));
    } else {
      armor = Math.min(armor, maxArmor);
    }
    maxFuel = getMaxFuel(upgradeLevels.fuelTankLevel);
    ship.maxFuel = maxFuel;
    ship.fuel = Math.min(ship.fuel, ship.maxFuel);
    upgradeLevels.scanDistanceLevel = Math.min(upgradeLevels.scanDistanceLevel, maxScanDistanceLevel);
    updateZoomBounds();
    if (gameState) {
      gameState.armor = armor;
      gameState.upgrades = {
        fireRateLevel: upgradeLevels.fireRateLevel,
        fireDistanceLevel: upgradeLevels.fireDistanceLevel,
        scanDistanceLevel: upgradeLevels.scanDistanceLevel,
        hullLevel: upgradeLevels.hullLevel,
        collectorLevel: upgradeLevels.collectorLevel,
        fuelTankLevel: upgradeLevels.fuelTankLevel
      };
      markStateDirty();
    }
  }

  function buildUpgradeUiState(station) {
    const tierCap = Number.isFinite(station?.tierCap) ? station.tierCap : null;
    const missingArmor = Math.max(0, maxArmor - armor);
    const missingFuel = Math.max(0, maxFuel - ship.fuel);
    const scanMaxed = upgradeLevels.scanDistanceLevel >= maxScanDistanceLevel;
    return {
      currency: resourceCurrency,
      lives,
      maxLives,
      armor,
      maxArmor,
      fuel: ship.fuel,
      maxFuel,
      tierCap,
      upgrades: {
        fireRateLevel: upgradeLevels.fireRateLevel,
        fireDistanceLevel: upgradeLevels.fireDistanceLevel,
        scanDistanceLevel: upgradeLevels.scanDistanceLevel,
        hullLevel: upgradeLevels.hullLevel,
        collectorLevel: upgradeLevels.collectorLevel,
        fuelTankLevel: upgradeLevels.fuelTankLevel
      },
      gains: {
        fireRate: formatGain(getFireRateGain(upgradeLevels.fireRateLevel), " ms", 0),
        fireDistance: formatGain(getFireDistanceGain(upgradeLevels.fireDistanceLevel), " u", 0),
        scanDistance: scanMaxed ? "Max reached" : "+1 zoom step",
        hull: formatGain(getHullGain(upgradeLevels.hullLevel), " armor", 0),
        collector: getCollectorGain(upgradeLevels.collectorLevel),
        fuelTank: formatGain(getFuelGain(upgradeLevels.fuelTankLevel), " fuel", 0)
      },
      costs: {
        fireRate: getUpgradeCost(UPGRADES.FIRE_RATE.baseCost, UPGRADES.FIRE_RATE.costGrowth, upgradeLevels.fireRateLevel),
        fireDistance: getUpgradeCost(UPGRADES.FIRE_DISTANCE.baseCost, UPGRADES.FIRE_DISTANCE.costGrowth, upgradeLevels.fireDistanceLevel),
        scanDistance: scanMaxed
          ? null
          : getUpgradeCost(UPGRADES.SCAN_DISTANCE.baseCost, UPGRADES.SCAN_DISTANCE.costGrowth, upgradeLevels.scanDistanceLevel),
        fuelTank: getUpgradeCost(UPGRADES.FUEL_TANK.baseCost, UPGRADES.FUEL_TANK.costGrowth, upgradeLevels.fuelTankLevel),
        hull: getUpgradeCost(UPGRADES.HULL.baseCost, UPGRADES.HULL.costGrowth, upgradeLevels.hullLevel),
        collector: getUpgradeCost(UPGRADES.COLLECTOR.baseCost, UPGRADES.COLLECTOR.costGrowth, upgradeLevels.collectorLevel),
        refuel: missingFuel > 0
          ? Math.max(1, Math.ceil(missingFuel * UPGRADES.REFUEL.costPerFuel))
          : null,
        repair: missingArmor > 0
          ? Math.round(UPGRADES.REPAIR.baseCost + missingArmor * UPGRADES.REPAIR.costPerArmor)
          : null
      }
    };
  }

  function closeUpgradeModal() {
    if (upgradeModal) {
      upgradeModal.destroy();
      upgradeModal = null;
    }
  }

  function openUpgradeModal(station) {
    if (!uiRoot || upgradeModal) {
      return;
    }
    upgradeModal = showUpgradeStationModal(uiRoot, buildUpgradeUiState(station), (action) => {
      if (!action) {
        return;
      }
      if (action === "close") {
        docked = false;
        dockStation = null;
        closeUpgradeModal();
        return;
      }
      const state = buildUpgradeUiState(station);
      if (action === "fireRate" && state.costs.fireRate !== null) {
        if (spendResource(state.costs.fireRate)) {
          upgradeLevels.fireRateLevel += 1;
          syncUpgradeState();
          sounds.play("bought");
        }
      } else if (action === "fireDistance" && state.costs.fireDistance !== null) {
        if (spendResource(state.costs.fireDistance)) {
          upgradeLevels.fireDistanceLevel += 1;
          syncUpgradeState();
          sounds.play("bought");
        }
      } else if (action === "scanDistance" && state.costs.scanDistance !== null) {
        if (spendResource(state.costs.scanDistance)) {
          upgradeLevels.scanDistanceLevel += 1;
          syncUpgradeState();
          sounds.play("bought");
        }
      } else if (action === "fuelTank" && state.costs.fuelTank !== null) {
        if (spendResource(state.costs.fuelTank)) {
          upgradeLevels.fuelTankLevel += 1;
          syncUpgradeState();
          sounds.play("bought");
        }
      } else if (action === "hull" && state.costs.hull !== null) {
        if (spendResource(state.costs.hull)) {
          upgradeLevels.hullLevel += 1;
          syncUpgradeState();
          sounds.play("bought");
        }
      } else if (action === "collector" && state.costs.collector !== null) {
        if (spendResource(state.costs.collector)) {
          upgradeLevels.collectorLevel += 1;
          syncUpgradeState();
          sounds.play("bought");
        }
      } else if (action === "refuel" && state.costs.refuel !== null) {
        if (spendResource(state.costs.refuel)) {
          ship.fuel = ship.maxFuel;
          sounds.play("bought");
        }
      } else if (action === "repair" && state.costs.repair !== null) {
        if (spendResource(state.costs.repair)) {
          armor = maxArmor;
          syncUpgradeState();
          sounds.play("bought");
        }
      }
      if (upgradeModal) {
        upgradeModal.update(buildUpgradeUiState(station));
      }
    });
  }

  function queueRespawn() {
    shipVisible = false;
    ship.stopThrustLoop();
    respawnTimer = RESPAWN_DELAY;
  }

  function queueAlert(text, delay = 0, duration = ALERT.DURATION, force = false, options = {}) {
    const kind = options.kind ?? "system";
    if (tutorial.active && kind !== "tutorial") {
      return;
    }
    if (intro.suppressAlerts && !force) {
      return;
    }
    let start = alertClock + delay;
    const end = start + duration;
    if (kind !== "clue") {
      for (const alert of alerts) {
        if (alert.kind !== "clue") {
          continue;
        }
        const clueEnd = alert.start + alert.duration;
        const overlaps = alert.start <= end && clueEnd >= start;
        if (overlaps) {
          return;
        }
      }
    } else {
      for (let i = alerts.length - 1; i >= 0; i--) {
        const alert = alerts[i];
        if (alert.kind === "clue") {
          continue;
        }
        const alertEnd = alert.start + alert.duration;
        const overlaps = alert.start <= end && alertEnd >= start;
        if (overlaps) {
          alerts.splice(i, 1);
        }
      }
    }
    alerts.push({
      text,
      start,
      duration,
      kind,
      background: options.background ?? false,
      textColor: options.textColor ?? null,
      fontSize: options.fontSize ?? null
    });
  }

  function scheduleIntroHighlight(keys, start, duration) {
    if (!intro.enabled) {
      return;
    }
    const list = Array.isArray(keys) ? keys : [keys];
    for (const key of list) {
      intro.highlightQueue.push({
        key,
        start,
        duration
      });
    }
  }

  function triggerIntroHighlight(key, duration) {
    intro.highlights[key] = Math.max(intro.highlights[key] ?? 0, duration);
    if (key === "score") {
      scorePulse = Math.max(scorePulse, 0.8);
    }
  }

  function scheduleIntroAlert(id, text, options = {}) {
    if (tutorial.active) {
      return;
    }
    if (!intro.enabled || intro.flags[id]) {
      return;
    }
    const duration = options.duration ?? INTRO.ALERT_DURATION ?? ALERT.DURATION;
    const start = Math.max(alertClock, intro.nextAt);
    queueAlert(text, start - alertClock, duration, true, {
      textColor: CLUE_CONFIG?.TUTORIAL_COLOR ?? null
    });
    intro.flags[id] = true;
    intro.nextAt = start + duration;
    if (options.highlightKeys) {
      scheduleIntroHighlight(options.highlightKeys, start, options.highlightDuration ?? duration);
    }
    if (options.releaseAlerts) {
      intro.releaseAlertsAt = start + duration;
    }
    if (typeof options.onScheduled === "function") {
      options.onScheduled();
    }
  }

  const tutorialSteps = [
    {
      id: "aim",
      text: "Touch or move the mouse around the ship to change its facing.",
      isComplete: () => tutorial.flags.aimed
    },
    {
      id: "fire",
      text: "Left click / left tap to fire.",
      isComplete: () => tutorial.flags.fired
    },
    {
      id: "thrust",
      text: "Right click / right tap to thrust in the direction you face. Thrust consumes fuel.",
      isComplete: () => tutorial.flags.thrusted
    },
    {
      id: "loot",
      text: "Shoot asteroids to find resources and fuel.",
      isComplete: () => tutorial.flags.looted
    },
    {
      id: "chevrons",
      text: "Green chevrons point toward mysteries.",
      isComplete: () => tutorial.flags.chevrons
    }
  ];

  const startTutorialStep = () => {
    const step = tutorialSteps[tutorial.stepIndex];
    if (!step) {
      return;
    }
    tutorial.stepStarted = true;
    tutorial.stepStartedAt = alertClock;
    queueAlert(step.text, 0, ALERT.DURATION * 1.2, true, {
      kind: "tutorial",
      textColor: CLUE_CONFIG?.TUTORIAL_COLOR ?? null
    });
  };

  const advanceTutorial = () => {
    tutorial.stepIndex += 1;
    tutorial.stepStarted = false;
    tutorial.stepStartedAt = alertClock;
    if (tutorial.stepIndex >= tutorialSteps.length) {
      tutorial.active = false;
      intro.suppressAlerts = false;
      intro.nextAt = Math.max(intro.nextAt ?? 0, alertClock + 0.4);
    }
  };

  const updateTutorial = () => {
    if (!tutorial.active) {
      return;
    }
    intro.suppressAlerts = true;
    const step = tutorialSteps[tutorial.stepIndex];
    if (!step) {
      tutorial.active = false;
      intro.suppressAlerts = false;
      return;
    }
    if (!tutorial.stepStarted) {
      startTutorialStep();
    }
    if (step.isComplete()) {
      advanceTutorial();
    }
  };

  function getTutorialCallout(screenW, screenH, hudScale, isCompactHud) {
    if (!tutorial.active) {
      return null;
    }
    const step = tutorialSteps[tutorial.stepIndex];
    if (!step) {
      return null;
    }
    const shipX = screenW / 2;
    const shipY = screenH / 2;
    const showTouchHints = touch.isActive
      || (TOUCH.SHOW_HINTS && (screenW < 900 || screenH < 700));
    const minDim = Math.min(screenW, screenH);

    const touchThrustRadius = Math.min(
      TOUCH.THRUST_RADIUS_MAX,
      Math.max(TOUCH.THRUST_RADIUS_MIN, minDim * (TOUCH.THRUST_RADIUS_SCALE ?? 0.16))
    );
    const touchThrustX = screenW * (TOUCH.THRUST_HINT_X ?? 0.18);
    const touchThrustY = screenH * (TOUCH.THRUST_HINT_Y ?? 0.78);

    const touchFireRadius = Math.min(
      TOUCH.FIRE_RADIUS_MAX,
      Math.max(TOUCH.FIRE_RADIUS_MIN, minDim * (TOUCH.FIRE_RADIUS_SCALE ?? 0.08))
    );
    const touchFireX = screenW * (TOUCH.FIRE_BUTTON_X ?? 0.82);
    const touchFireY = screenH * (TOUCH.FIRE_BUTTON_Y ?? 0.78);

    const hudW = screenW / hudScale;
    const hudH = screenH / hudScale;
    const edge = isCompactHud ? 12 : 20;
    const basePanelW = Math.min(isCompactHud ? 260 : 320, hudW - edge * 2);
    const panelW = basePanelW * 0.8;
    const panelH = isCompactHud ? 70 : 78;
    const fuelX = (edge + panelW * 0.5) * hudScale;
    const fuelY = (hudH - panelH - (isCompactHud ? 10 : 16) + panelH * 0.5) * hudScale;

    const findAsteroidTarget = () => {
      let best = null;
      let bestDist = Infinity;
      const margin = 50;
      for (const activeSector of activeSectors) {
        for (const asteroid of activeSector.asteroids) {
          const dx = asteroid.x - ship.x;
          const dy = asteroid.y - ship.y;
          const dist = Math.hypot(dx, dy);
          if (dist >= bestDist) {
            continue;
          }
          const screenPos = worldToScreen(asteroid.x, asteroid.y, ship, camera, canvas);
          if (screenPos.x < -margin || screenPos.x > screenW + margin) {
            continue;
          }
          if (screenPos.y < -margin || screenPos.y > screenH + margin) {
            continue;
          }
          bestDist = dist;
          best = {
            x: screenPos.x,
            y: screenPos.y,
            ringRadius: Math.max(12, (asteroid.radius ?? 14) * camera.zoom * 0.85)
          };
        }
      }
      return best;
    };

    switch (step.id) {
      case "aim":
        return { x: shipX, y: shipY, offsetY: -120, ringRadius: 18 };
      case "fire":
        if (showTouchHints) {
          return {
            x: touchFireX,
            y: touchFireY,
            offsetX: -70,
            offsetY: -90,
            ringRadius: touchFireRadius * 0.9
          };
        }
        return { x: shipX, y: shipY, offsetX: 90, offsetY: -80, ringRadius: 18 };
      case "thrust":
        if (showTouchHints) {
          return {
            x: touchThrustX,
            y: touchThrustY,
            offsetX: 70,
            offsetY: -90,
            ringRadius: touchThrustRadius * 0.9
          };
        }
        return { x: fuelX, y: fuelY, offsetX: 90, offsetY: -90, ringRadius: 20 };
      case "loot": {
        const target = findAsteroidTarget();
        return target ?? { x: shipX, y: shipY, offsetY: -120, ringRadius: 18 };
      }
      case "chevrons":
        return {
          x: shipX + (BEARING.RADIUS * hudScale),
          y: shipY,
          offsetX: -70,
          offsetY: -90,
          ringRadius: 14
        };
      default:
        return { x: shipX, y: shipY, offsetY: -120, ringRadius: 18 };
    }
  }

  function setAutopilotActive(next, announce = false) {
    if (autopilotActive === next) {
      return;
    }
    autopilotActive = next;
    autopilotTurnBias = 1;
    sounds.setKeyMuted("thrust", autopilotActive);
    sounds.setKeyMuted("thrust_rotate", autopilotActive);
    if (!next) {
      autopilotFirePause = 0;
      autopilotThrustCooldown = 0;
      autopilotThrustBurst = 0;
      autopilotTarget = null;
    }
    if (announce) {
      const text = next ? AUTOPILOT.ALERTS.ENGAGED : AUTOPILOT.ALERTS.DISENGAGED;
      queueAlert(text, 0, ALERT.DURATION * 1.1);
    }
  }

  function getUpgradeCost(baseCost, costGrowth, currentLevel) {
    return Math.round(baseCost * Math.pow(costGrowth, currentLevel));
  }

  function getQuantizedEffect(maxEffect, effectStep, curveK, level) {
    if (!Number.isFinite(maxEffect) || maxEffect <= 0 || level <= 0) {
      return 0;
    }
    const step = Number.isFinite(effectStep) && effectStep > 0 ? effectStep : maxEffect;
    const k = Number.isFinite(curveK) && curveK > 0 ? curveK : 0;
    if (k <= 0) {
      return 0;
    }
    const raw = maxEffect * (1 - Math.exp(-k * level));
    return Math.floor(raw / step) * step;
  }

  function getDeltaEffect(maxEffect, effectStep, curveK, level) {
    if (level <= 0) {
      return getQuantizedEffect(maxEffect, effectStep, curveK, level);
    }
    return getQuantizedEffect(maxEffect, effectStep, curveK, level)
      - getQuantizedEffect(maxEffect, effectStep, curveK, level - 1);
  }

  function formatGain(value, unit = "", decimals = 0) {
    if (!Number.isFinite(value) || value === 0) {
      return "+0";
    }
    const rounded = Number(value.toFixed(decimals));
    const sign = rounded > 0 ? "+" : "";
    return `${sign}${rounded}${unit}`;
  }

  function getFireCooldownSeconds(level) {
    const effect = UPGRADES.FIRE_RATE.effect;
    const model = effect.model;
    const maxReduction = Math.max(0, effect.cooldownMsBase - effect.cooldownMsMin);
    const reduction = getQuantizedEffect(maxReduction, model.effectStep, model.curveK, level);
    const ms = effect.cooldownMsBase - reduction;
    return Math.max(effect.cooldownMsMin, ms) / 1000;
  }

  function getFireDistanceMultiplier(level) {
    const effect = UPGRADES.FIRE_DISTANCE.effect;
    const model = effect.model;
    const maxBonus = Math.max(0, effect.multiplierMax - effect.multiplierBase);
    const bonus = getQuantizedEffect(maxBonus, model.effectStep, model.curveK, level);
    return effect.multiplierBase + bonus;
  }

  function getPlayerBulletLifeSeconds(level) {
    return BULLET.LIFE * getFireDistanceMultiplier(level);
  }

  function getMaxLives(level) {
    const effect = UPGRADES.HULL.effect;
    return effect.maxLivesBase;
  }

  function getMaxArmor(level) {
    const effect = UPGRADES.HULL.effect;
    const base = Number.isFinite(effect.armorBase) ? effect.armorBase : 0;
    const cap = Number.isFinite(effect.armorMax) ? effect.armorMax : 0;
    const next = base + Math.max(0, level);
    return Math.max(0, Math.min(cap, next));
  }

  function getMaxFuel(level) {
    const model = UPGRADES.FUEL_TANK.effect.extraCapacityModel;
    const extra = getQuantizedEffect(model.maxEffect, model.effectStep, model.curveK, level);
    return Math.max(0, SHIP.MAX_FUEL + extra);
  }

  function getCollectorStats(level) {
    const effect = UPGRADES.COLLECTOR.effect;
    const models = UPGRADES.COLLECTOR.models;
    const radiusExtra = getQuantizedEffect(models.radius.maxEffect, models.radius.effectStep, models.radius.curveK, level);
    const strengthMax = Math.max(0, effect.pullStrengthMax - effect.pullStrengthBase);
    const strengthExtra = getQuantizedEffect(
      Math.min(models.pullStrength.maxEffect, strengthMax),
      models.pullStrength.effectStep,
      models.pullStrength.curveK,
      level
    );
    return {
      radius: effect.radiusBase + radiusExtra,
      strength: Math.min(effect.pullStrengthMax, effect.pullStrengthBase + strengthExtra)
    };
  }

  function syncClueState() {
    if (!gameState) {
      return;
    }
    gameState.clues = {
      totalCollected: clueState.totalCollected,
      collectedIds: Array.from(clueState.collectedIds),
      selectedVariants: { ...clueState.selectedVariants }
    };
    markStateDirty();
  }

  function getClueById(clueId) {
    const clue = CLUE_LOOKUP.get(clueId);
    if (clue) {
      return clue;
    }
    return {
      clue_id: clueId,
      speaker: DEFAULT_CLUE_SPEAKER,
      variants: [`[Clue ${clueId}]`]
    };
  }

  function normalizeOrderedClues() {
    let expected = 1;
    while (clueState.collectedIds.has(expected) && expected <= CLUE_TOTAL) {
      expected += 1;
    }
    const orderedCount = Math.max(0, expected - 1);
    if (clueState.collectedIds.size !== orderedCount) {
      clueState.collectedIds = new Set(
        Array.from({ length: orderedCount }, (_, index) => index + 1)
      );
      const nextVariants = {};
      for (let i = 1; i <= orderedCount; i++) {
        if (Object.prototype.hasOwnProperty.call(clueState.selectedVariants, i)) {
          nextVariants[i] = clueState.selectedVariants[i];
        }
      }
      clueState.selectedVariants = nextVariants;
    }
    clueState.totalCollected = orderedCount;
  }

  function pickUndiscoveredClueId() {
    const nextId = clueState.totalCollected + 1;
    if (nextId >= 1 && nextId <= CLUE_TOTAL && !clueState.collectedIds.has(nextId)) {
      return nextId;
    }
    for (let id = 1; id <= CLUE_TOTAL; id++) {
      if (!clueState.collectedIds.has(id)) {
        return id;
      }
    }
    return null;
  }

  function pickVariantIndex(clueId, variants) {
    if (variants.length === 0) {
      return 0;
    }
    const seed = hashInts(worldSeed, clueId, 8117);
    const rng = createRng(seed);
    return Math.floor(rng() * variants.length);
  }

  function ensureClueVariantsSelected() {
    let changed = false;
    for (let id = 1; id <= CLUE_TOTAL; id++) {
      const clue = CLUE_LOOKUP.get(id);
      const variants = Array.isArray(clue?.variants) ? clue.variants : [];
      const stored = clueState.selectedVariants[id];
      if (Number.isFinite(stored) && variants[stored]) {
        continue;
      }
      clueState.selectedVariants[id] = pickVariantIndex(id, variants);
      changed = true;
    }
    if (changed) {
      syncClueState();
    }
  }

  function selectVariantIndex(clueId, variants) {
    const stored = clueState.selectedVariants[clueId];
    if (Number.isFinite(stored) && variants[stored]) {
      return stored;
    }
    const idx = pickVariantIndex(clueId, variants);
    clueState.selectedVariants[clueId] = idx;
    return idx;
  }

  function resetClueCycle() {
    clueState.collectedIds.clear();
    clueState.selectedVariants = {};
    clueState.totalCollected = 0;
    syncClueState();
  }

  function revealClue() {
    let clueId = pickUndiscoveredClueId();
    if (!clueId) {
      resetClueCycle();
      clueId = pickUndiscoveredClueId();
      if (!clueId) {
        return null;
      }
    }
    const clue = getClueById(clueId);
    const variants = Array.isArray(clue.variants) ? clue.variants : [];
    const variantIndex = selectVariantIndex(clueId, variants);
    const text = variants[variantIndex] ?? `[Clue ${clueId}]`;
    const speaker = typeof clue.speaker === "string" && clue.speaker
      ? clue.speaker
      : DEFAULT_CLUE_SPEAKER;
    const context = typeof clue.context === "string" && clue.context
      ? clue.context
      : "FIELD REPORT";
    const recipient = typeof clue.recipient === "string" && clue.recipient
      ? clue.recipient
      : "ARCHIVE";
    const timestamp = typeof clue.timestamp === "string" && clue.timestamp
      ? clue.timestamp
      : "DAY 00 00:00:00.000 UTC";
    clueState.collectedIds.add(clueId);
    clueState.totalCollected = clueState.collectedIds.size;
    syncClueState();
    return {
      clueId,
      text,
      speaker,
      context,
      recipient,
      timestamp
    };
  }

  function applyFuelPickupEquivalent() {
    const ratio = PICKUPS?.FUEL?.AMOUNT_RATIO ?? 0;
    if (!Number.isFinite(ratio) || ratio <= 0) {
      return;
    }
    const refillAmount = ship.maxFuel * ratio;
    ship.fuel = Math.min(ship.maxFuel, ship.fuel + refillAmount);
    addScore(SCORE_POINTS.FUEL, true, false, { x: ship.x, y: ship.y }, "fuel");
    sounds.play("got_fuel");
  }

  function getFireRateGain(level) {
    const effect = UPGRADES.FIRE_RATE.effect;
    const model = effect.model;
    const maxReduction = Math.max(0, effect.cooldownMsBase - effect.cooldownMsMin);
    return getDeltaEffect(maxReduction, model.effectStep, model.curveK, level + 1);
  }

  function getFireDistanceGain(level) {
    const effect = UPGRADES.FIRE_DISTANCE.effect;
    const model = effect.model;
    const maxBonus = Math.max(0, effect.multiplierMax - effect.multiplierBase);
    const bonus = getDeltaEffect(maxBonus, model.effectStep, model.curveK, level + 1);
    return bonus * BULLET.SPEED * BULLET.LIFE;
  }

  function getHullGain(level) {
    return Math.max(0, getMaxArmor(level + 1) - getMaxArmor(level));
  }

  function getFuelGain(level) {
    const model = UPGRADES.FUEL_TANK.effect.extraCapacityModel;
    return getDeltaEffect(model.maxEffect, model.effectStep, model.curveK, level + 1);
  }

  function getCollectorGain(level) {
    const effect = UPGRADES.COLLECTOR.effect;
    const models = UPGRADES.COLLECTOR.models;
    const radiusGain = getDeltaEffect(models.radius.maxEffect, models.radius.effectStep, models.radius.curveK, level + 1);
    const strengthCap = Math.max(0, effect.pullStrengthMax - effect.pullStrengthBase);
    const strengthMax = Math.min(models.pullStrength.maxEffect, strengthCap);
    const strengthGain = getDeltaEffect(
      strengthMax,
      models.pullStrength.effectStep,
      models.pullStrength.curveK,
      level + 1
    );
    if (radiusGain === 0 && strengthGain === 0) {
      return "+0";
    }
    const parts = [];
    if (radiusGain !== 0) {
      parts.push(`R ${formatGain(radiusGain, "", 0)}`);
    }
    if (strengthGain !== 0) {
      parts.push(`P ${formatGain(strengthGain, "", 3)}`);
    }
    return parts.join(" / ");
  }

  function addResource(amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    resourceCurrency = Math.max(0, Math.floor(resourceCurrency + amount));
    if (gameState) {
      gameState.resourceCurrency = resourceCurrency;
      markStateDirty();
    }
  }

  function spendResource(cost) {
    if (!Number.isFinite(cost) || cost <= 0 || resourceCurrency < cost) {
      return false;
    }
    resourceCurrency = Math.max(0, Math.floor(resourceCurrency - cost));
    if (gameState) {
      gameState.resourceCurrency = resourceCurrency;
      markStateDirty();
    }
    return true;
  }

  function applyCollectorPull(pickups, collector, dt) {
    if (!pickups || pickups.length === 0) {
      return;
    }
    if (!collector || collector.radius <= 0 || collector.strength <= 0) {
      return;
    }
    const radius = collector.radius;
    const strength = collector.strength;
    for (const pickup of pickups) {
      const dx = ship.x - pickup.x;
      const dy = ship.y - pickup.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= 0 || dist > radius) {
        continue;
      }
      const t = 1 - dist / radius;
      const accel = strength * t;
      const nx = dx / dist;
      const ny = dy / dist;
      pickup.vx += nx * accel * dt;
      pickup.vy += ny * accel * dt;
    }
  }

  function drawStationSafeZone(ctx, station, shipInZone, dockedState) {
    if (!station) {
      return;
    }
    const radius = station.safeRadius ?? STATION.SAFE_ZONE_RADIUS;
    const alpha = dockedState ? 0.22 : (shipInZone ? 0.18 : 0.12);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const grad = ctx.createRadialGradient(station.x, station.y, radius * 0.2, station.x, station.y, radius);
    grad.addColorStop(0, `rgba(90, 220, 160, ${alpha})`);
    grad.addColorStop(1, "rgba(90, 220, 160, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(station.x, station.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(120, 240, 190, ${alpha * 0.9})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(station.x, station.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function resolveStationCollision(station) {
    if (!station) {
      return;
    }
    const coreRadius = station.colliderRadius ?? STATION.COLLIDER_RADIUS;
    if (!Number.isFinite(coreRadius) || coreRadius <= 0) {
      return;
    }
    const dx = ship.x - station.x;
    const dy = ship.y - station.y;
    const minDist = coreRadius + SHIP_RADIUS;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) {
      const dirX = Math.sin(ship.heading);
      const dirY = -Math.cos(ship.heading);
      ship.x = station.x + dirX * minDist;
      ship.y = station.y + dirY * minDist;
      return;
    }
    if (dist < minDist) {
      const nx = dx / dist;
      const ny = dy / dist;
      ship.x = station.x + nx * minDist;
      ship.y = station.y + ny * minDist;
      const dot = ship.vx * nx + ship.vy * ny;
      if (dot < 0) {
        ship.vx -= dot * nx;
        ship.vy -= dot * ny;
      }
    }
  }

  function resolveApseRingCollisions(activeSectorsList) {
    if (!activeSectorsList || activeSectorsList.length === 0) {
      return;
    }
    for (const activeSector of activeSectorsList) {
      if (activeSector.apseRing && typeof activeSector.apseRing.resolveCollision === "function") {
        activeSector.apseRing.resolveCollision(ship, SHIP_RADIUS);
      }
      if (activeSector.apseInterior && typeof activeSector.apseInterior.resolveBodyCollision === "function") {
        activeSector.apseInterior.resolveBodyCollision(ship, SHIP_RADIUS);
      }
    }
  }

  function resolveMeridianCollisions(body, radius, activeSectorsList) {
    if (!body || !Array.isArray(activeSectorsList) || activeSectorsList.length === 0) {
      return;
    }
    for (const activeSector of activeSectorsList) {
      if (activeSector?.meridian) {
        resolveMeridianCollision(body, radius, activeSector.meridian);
      }
    }
  }

  function collectApseColliders(sectors) {
    if (!Array.isArray(sectors) || sectors.length === 0) {
      return [];
    }
    const colliders = [];
    for (const sector of sectors) {
      if (!sector?.apseRing && !sector?.apseInterior) {
        continue;
      }
      const ring = sector.apseRing ?? null;
      const interior = sector.apseInterior ?? null;
      const center = ring?.center ?? interior?.center ?? null;
      const thickness = Number.isFinite(ring?.thickness)
        ? ring.thickness
        : (Number.isFinite(sector.apseRingThickness) ? sector.apseRingThickness : 0);
      const outerRadius = Number.isFinite(interior?.outerWallOuterRadius)
        ? interior.outerWallOuterRadius
        : (Number.isFinite(ring?.radius) ? ring.radius + thickness / 2 : null);
      colliders.push({
        ring,
        interior,
        center,
        outerRadius,
        thickness,
        bounds: sector.bounds ?? null
      });
    }
    return colliders;
  }

  function getSectorObjectGroups(sector) {
    if (!sector) {
      return [];
    }
    const groups = [];
    if (Array.isArray(sector.cores)) groups.push(sector.cores);
    if (Array.isArray(sector.lures)) groups.push(sector.lures);
    if (Array.isArray(sector.wreckage)) groups.push(sector.wreckage);
    if (Array.isArray(sector.nodes)) groups.push(sector.nodes);
    if (Array.isArray(sector.shards)) groups.push(sector.shards);
    return groups;
  }

  function integrateWithApseCollisions(body, radius, apseColliders, dt) {
    const colliders = Array.isArray(apseColliders) ? apseColliders : [];
    if (colliders.length === 0) {
      integrate(body, dt);
      return;
    }

    // Steps computed from initial speed (fine), but per-substep motion must use CURRENT velocity
    const vx0 = Number.isFinite(body.vx) ? body.vx : 0;
    const vy0 = Number.isFinite(body.vy) ? body.vy : 0;
    const speed0 = Math.hypot(vx0, vy0);

    let maxThickness = 0;
    for (const collider of colliders) {
      if (Number.isFinite(collider?.thickness)) {
        maxThickness = Math.max(maxThickness, collider.thickness);
      }
    }
    const maxStep = maxThickness > 0 ? maxThickness * 0.35 : 24;
    const steps = Math.max(1, Math.ceil((speed0 * dt) / maxStep));
    const subDt = dt / steps;

    for (let i = 0; i < steps; i++) {
      const vx = Number.isFinite(body.vx) ? body.vx : 0;
      const vy = Number.isFinite(body.vy) ? body.vy : 0;

      body.x += vx * subDt;
      body.y += vy * subDt;

      for (const collider of colliders) {
        const ring = collider?.ring;
        const interior = collider?.interior;
        if (!ring && !interior) {
          continue;
        }
        if (collider.center && Number.isFinite(collider.outerRadius)) {
          const dx = body.x - collider.center.x;
          const dy = body.y - collider.center.y;
          const pad = (collider.thickness ?? 0) + radius;
          if ((dx * dx + dy * dy) > (collider.outerRadius + pad) * (collider.outerRadius + pad)) {
            continue;
          }
        }
        if (ring && typeof ring.resolveCollision === "function") {
          ring.resolveCollision(body, radius);
        }
        if (interior && typeof interior.resolveBodyCollision === "function") {
          interior.resolveBodyCollision(body, radius);
        }
      }
    }
  }

  function removeProjectilesByMeridian(projectiles, activeSectorsList) {
    if (!Array.isArray(projectiles) || projectiles.length === 0) {
      return;
    }
    if (!Array.isArray(activeSectorsList) || activeSectorsList.length === 0) {
      return;
    }
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const projectile = projectiles[i];
      let hit = false;
      for (const activeSector of activeSectorsList) {
        if (activeSector?.meridian && projectileHitsMeridian(projectile, activeSector.meridian, projectile.radius ?? 0)) {
          hit = true;
          break;
        }
      }
      if (hit) {
        projectiles.splice(i, 1);
      }
    }
  }


  function resolveAsteroidCollisions(asteroids) {
    if (!Array.isArray(asteroids) || asteroids.length < 2) {
      return;
    }
    for (let i = 0; i < asteroids.length; i++) {
      const a = asteroids[i];
      if (!Number.isFinite(a?.radius)) {
        continue;
      }
      for (let j = i + 1; j < asteroids.length; j++) {
        const b = asteroids[j];
        if (!Number.isFinite(b?.radius)) {
          continue;
        }
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = a.radius + b.radius;
        if (!Number.isFinite(dist) || dist <= 0 || dist >= minDist) {
          continue;
        }
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist;
        const massA = Math.max(1, Math.pow(a.radius, ASTEROID_COLLISION_MASS_POWER));
        const massB = Math.max(1, Math.pow(b.radius, ASTEROID_COLLISION_MASS_POWER));
        const totalMass = massA + massB;
        const pushA = (massB / totalMass) * overlap;
        const pushB = (massA / totalMass) * overlap;
        a.x -= nx * pushA;
        a.y -= ny * pushA;
        b.x += nx * pushB;
        b.y += ny * pushB;
        const rvx = (b.vx ?? 0) - (a.vx ?? 0);
        const rvy = (b.vy ?? 0) - (a.vy ?? 0);
        const velAlongNormal = rvx * nx + rvy * ny;
        if (velAlongNormal > 0) {
          continue;
        }
        const invMassA = 1 / massA;
        const invMassB = 1 / massB;
        const impulse = -(1 + ASTEROID_COLLISION_BOUNCE) * velAlongNormal / (invMassA + invMassB);
        const ix = impulse * nx;
        const iy = impulse * ny;
        a.vx = (a.vx ?? 0) - ix * invMassA;
        a.vy = (a.vy ?? 0) - iy * invMassA;
        b.vx = (b.vx ?? 0) + ix * invMassB;
        b.vy = (b.vy ?? 0) + iy * invMassB;
        a.vx *= ASTEROID_COLLISION_DAMPING;
        a.vy *= ASTEROID_COLLISION_DAMPING;
        b.vx *= ASTEROID_COLLISION_DAMPING;
        b.vy *= ASTEROID_COLLISION_DAMPING;
      }
    }
  }

  function getAsteroidMassRatio(radius) {
    if (!Number.isFinite(radius)) {
      return ASTEROID_SHIP_MASS_MIN;
    }
    const denom = Math.max(1e-6, ASTEROID_RADIUS_MAX - ASTEROID_RADIUS_MIN);
    const t = clampValue((radius - ASTEROID_RADIUS_MIN) / denom, 0, 1);
    return ASTEROID_SHIP_MASS_MIN + t * (ASTEROID_SHIP_MASS_MAX - ASTEROID_SHIP_MASS_MIN);
  }

  function resolveShipAsteroidCollision(ship, shipRadius, asteroid) {
    if (!asteroid || !Number.isFinite(asteroid.radius)) {
      return false;
    }
    const dx = asteroid.x - ship.x;
    const dy = asteroid.y - ship.y;
    const dist = Math.hypot(dx, dy);
    const minDist = asteroid.radius + shipRadius;
    if (!Number.isFinite(dist) || dist >= minDist) {
      return false;
    }
    const nx = dist > 1e-6 ? dx / dist : 1;
    const ny = dist > 1e-6 ? dy / dist : 0;
    const overlap = Math.max(0, minDist - dist);
    const shipMass = 1;
    const asteroidMass = getAsteroidMassRatio(asteroid.radius);
    const totalMass = shipMass + asteroidMass;
    const pushShip = (asteroidMass / totalMass) * overlap;
    const pushAsteroid = (shipMass / totalMass) * overlap;
    ship.x -= nx * pushShip;
    ship.y -= ny * pushShip;
    asteroid.x += nx * pushAsteroid;
    asteroid.y += ny * pushAsteroid;
    const rvx = (asteroid.vx ?? 0) - (ship.vx ?? 0);
    const rvy = (asteroid.vy ?? 0) - (ship.vy ?? 0);
    const velAlongNormal = rvx * nx + rvy * ny;
    if (velAlongNormal > 0) {
      return true;
    }
    const invShip = 1 / shipMass;
    const invAsteroid = 1 / asteroidMass;
    const impulse = -(1 + ASTEROID_COLLISION_BOUNCE) * velAlongNormal / (invShip + invAsteroid);
    const ix = impulse * nx;
    const iy = impulse * ny;
    ship.vx = (ship.vx ?? 0) - ix * invShip;
    ship.vy = (ship.vy ?? 0) - iy * invShip;
    asteroid.vx = (asteroid.vx ?? 0) + ix * invAsteroid;
    asteroid.vy = (asteroid.vy ?? 0) + iy * invAsteroid;
    ship.vx *= ASTEROID_COLLISION_DAMPING;
    ship.vy *= ASTEROID_COLLISION_DAMPING;
    asteroid.vx *= ASTEROID_COLLISION_DAMPING;
    asteroid.vy *= ASTEROID_COLLISION_DAMPING;
    return true;
  }

  function resolveBodyObjectCollision(body, bodyRadius, obj) {
    if (!body || !obj || !Number.isFinite(bodyRadius)) {
      return false;
    }
    const objRadius = Number.isFinite(obj.radius) ? obj.radius : 0;
    if (objRadius <= 0) {
      return false;
    }
    const dx = body.x - obj.x;
    const dy = body.y - obj.y;
    const dist = Math.hypot(dx, dy);
    const minDist = bodyRadius + objRadius;
    if (!Number.isFinite(dist) || dist >= minDist || dist <= 0) {
      return false;
    }
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;
    body.x += nx * overlap;
    body.y += ny * overlap;
    const vx = body.vx ?? 0;
    const vy = body.vy ?? 0;
    const velAlongNormal = vx * nx + vy * ny;
    if (velAlongNormal < 0) {
      body.vx = vx - (1 + ASTEROID_COLLISION_BOUNCE) * velAlongNormal * nx;
      body.vy = vy - (1 + ASTEROID_COLLISION_BOUNCE) * velAlongNormal * ny;
      body.vx *= ASTEROID_COLLISION_DAMPING;
      body.vy *= ASTEROID_COLLISION_DAMPING;
    }
    return true;
  }

  function resolveBodyObjectCollisions(body, bodyRadius, sectors) {
    if (!Array.isArray(sectors)) {
      return false;
    }
    let hit = false;
    for (const activeSector of sectors) {
      const groups = getSectorObjectGroups(activeSector);
      for (const group of groups) {
        for (const obj of group) {
          if (resolveBodyObjectCollision(body, bodyRadius, obj)) {
            hit = true;
          }
        }
      }
    }
    return hit;
  }

  function collectPalimpsestFragments(activeSectorsList) {
    if (!Array.isArray(activeSectorsList)) {
      return [];
    }
    const fragments = [];
    for (const sector of activeSectorsList) {
      if (Array.isArray(sector?.palimpsestFragments)) {
        fragments.push(...sector.palimpsestFragments);
      }
    }
    return fragments;
  }

  function collectPalimpsestSingularities(activeStarsList) {
    if (!Array.isArray(activeStarsList)) {
      return [];
    }
    return activeStarsList.filter((star) => star?.special?.type === "singularity");
  }

  function resolveBodyFragmentCollision(body, bodyRadius, fragment) {
    if (!body || !fragment || !Number.isFinite(bodyRadius) || !Number.isFinite(fragment.radius)) {
      return false;
    }
    const dx = body.x - fragment.x;
    const dy = body.y - fragment.y;
    const dist = Math.hypot(dx, dy);
    const minDist = bodyRadius + fragment.radius;
    if (!Number.isFinite(dist) || dist >= minDist) {
      return false;
    }
    const nx = dist > 1e-6 ? dx / dist : 1;
    const ny = dist > 1e-6 ? dy / dist : 0;
    const overlap = minDist - dist;
    body.x += nx * overlap;
    body.y += ny * overlap;
    const vx = body.vx ?? 0;
    const vy = body.vy ?? 0;
    const velAlongNormal = vx * nx + vy * ny;
    if (velAlongNormal < 0) {
      const bounce = Number.isFinite(fragment.bounce) ? fragment.bounce : 0.82;
      body.vx = vx - (1 + bounce) * velAlongNormal * nx;
      body.vy = vy - (1 + bounce) * velAlongNormal * ny;
    }
    return true;
  }

  function resolvePalimpsestFragmentCollisions(body, bodyRadius, fragments) {
    if (!Array.isArray(fragments) || fragments.length === 0) {
      return false;
    }
    let hit = false;
    for (const fragment of fragments) {
      if (resolveBodyFragmentCollision(body, bodyRadius, fragment)) {
        hit = true;
      }
    }
    return hit;
  }

  function asteroidHitsSingularity(asteroid, singularities) {
    if (!Array.isArray(singularities) || singularities.length === 0) {
      return null;
    }
    for (const singularity of singularities) {
      const dx = asteroid.x - singularity.x;
      const dy = asteroid.y - singularity.y;
      const dist = Math.hypot(dx, dy);
      if (dist < singularity.radius) {
        const angle = Math.atan2(dy, dx);
        singularity.triggerFlash?.(angle);
        return singularity;
      }
    }
    return null;
  }

  function objectHitsStar(body, radius, stars, includeSingularity = true) {
    if (!Array.isArray(stars) || !body) {
      return false;
    }
    const bodyRadius = Number.isFinite(radius) ? radius : 0;
    for (const star of stars) {
      if (!star || !Number.isFinite(star.radius)) {
        continue;
      }
      if (!includeSingularity && star.special?.type === "singularity") {
        continue;
      }
      const dx = body.x - star.x;
      const dy = body.y - star.y;
      if (Math.hypot(dx, dy) < star.radius + bodyRadius) {
        return true;
      }
    }
    return false;
  }

  function randRange(rng, min, max) {
    return min + rng() * (max - min);
  }

  function spawnUpgradePickup(x, y, type, worldAgeMs, seed = 0) {
    if (!type) {
      return;
    }
    const rng = createRng(hashInts(seed, Math.floor(x), Math.floor(y), Math.floor(worldAgeMs ?? 0)));
    const angle = rng() * Math.PI * 2;
    const speed = randRange(rng, 12, 36);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    upgradePickups.push(new UpgradePickup(x, y, vx, vy, type, worldAgeMs ?? 0, hashInts(seed, 9001, type.length)));
  }

  function spawnLureEnemies(lure, viewRadius) {
    const bounds = sector?.bounds ?? null;
    const rng = createRng(hashInts(Math.floor(lure.x), Math.floor(lure.y), enemies.length));
    const countMin = Math.max(1, Math.floor(OBJECTS_CONFIG.LURE?.ENEMY_MIN ?? 1));
    const countMax = Math.max(countMin, Math.floor(OBJECTS_CONFIG.LURE?.ENEMY_MAX ?? countMin));
    const count = countMin + Math.floor(rng() * (countMax - countMin + 1));
    const baseDist = viewRadius + OBJECT_SPAWN_BUFFER;
    for (let i = 0; i < count; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = baseDist + randRange(rng, 20, 120);
      let x = ship.x + Math.cos(angle) * dist;
      let y = ship.y + Math.sin(angle) * dist;
      if (bounds) {
        const pad = 60;
        x = clampValue(x, bounds.x + pad, bounds.x + bounds.size - pad);
        y = clampValue(y, bounds.y + pad, bounds.y + bounds.size - pad);
      }
      const enemy = new EnemyShip(x, y);
      const dx = ship.x - x;
      const dy = ship.y - y;
      enemy.heading = Math.atan2(dx, -dy);
      enemies.push(enemy);
      enemyPings.push({ x, y, life: 1.2, maxLife: 1.2 });
    }
  }

  function getMaxHullLevel() {
    const effect = UPGRADES.HULL.effect;
    const base = Number.isFinite(effect.armorBase) ? effect.armorBase : 0;
    const cap = Number.isFinite(effect.armorMax) ? effect.armorMax : 0;
    return Math.max(0, cap - base);
  }

  function getMaxLevelForEffect(maxEffect, effectStep, curveK) {
    let level = 0;
    let last = 0;
    for (let i = 1; i <= 200; i++) {
      const current = getQuantizedEffect(maxEffect, effectStep, curveK, i);
      if (current <= last + 1e-6) {
        break;
      }
      last = current;
      level = i;
      if (current >= maxEffect - 1e-6) {
        break;
      }
    }
    return level;
  }

  function getMaxFireRateLevel() {
    const effect = UPGRADES.FIRE_RATE.effect;
    const model = effect.model;
    const maxReduction = Math.max(0, effect.cooldownMsBase - effect.cooldownMsMin);
    return getMaxLevelForEffect(maxReduction, model.effectStep, model.curveK);
  }

  function getMaxFuelTankLevel() {
    const model = UPGRADES.FUEL_TANK.effect.extraCapacityModel;
    return getMaxLevelForEffect(model.maxEffect, model.effectStep, model.curveK);
  }

  function applyUpgradePickup(type) {
    let applied = false;
    let alertText = null;
    if (type === "RELIC") {
      const maxLevel = getMaxHullLevel();
      if (upgradeLevels.hullLevel < maxLevel) {
        upgradeLevels.hullLevel += 1;
        applied = true;
        alertText = "Hull Reinforced!";
      } else {
        alertText = "Hull Max Reached";
      }
    } else if (type === "SHARD") {
      const maxLevel = getMaxFireRateLevel();
      if (upgradeLevels.fireRateLevel < maxLevel) {
        upgradeLevels.fireRateLevel += 1;
        applied = true;
        alertText = "Fire Rate Increased!";
      } else {
        alertText = "Fire Rate Maxed";
      }
    } else if (type === "NODE") {
      const maxLevel = getMaxFuelTankLevel();
      if (upgradeLevels.fuelTankLevel < maxLevel) {
        upgradeLevels.fuelTankLevel += 1;
        applied = true;
        alertText = "Fuel Tank Size Increased!";
      } else {
        alertText = "Fuel Tank Maxed";
      }
    }
    if (applied) {
      syncUpgradeState();
    }
    if (alertText) {
      queueAlert(alertText, 0, ALERT.DURATION * 1.1);
    }
    return applied;
  }

  function updateUpgradePickups(pickups, activeStarsList, activeSectorsList, dt, worldAgeMs, apseColliders, fragments) {
    if (!pickups || pickups.length === 0) {
      return;
    }
    for (let i = pickups.length - 1; i >= 0; i--) {
      const pickup = pickups[i];
      const sectorAt = findActiveSectorForPosition(activeSectorsList, pickup.x, pickup.y);
      const rivers = sectorAt?.runtimeRivers ?? [];
      pickup.update(dt, worldAgeMs);
      applyForcesToEntity(pickup, dt, activeStarsList, rivers, CONFIG);
      applyDragToEntity(pickup, sectorAt, dt);
      integrateWithApseCollisions(pickup, pickup.radius, apseColliders, dt);
      resolveMeridianCollisions(pickup, pickup.radius, activeSectorsList);
      resolvePalimpsestFragmentCollisions(pickup, pickup.radius, fragments);
      if (objectHitsStar(pickup, pickup.radius, activeStarsList, true)) {
        pickups.splice(i, 1);
      }
    }
  }

  function handleUpgradePickups(pickups, shipBody, shipRadius) {
    if (!pickups || pickups.length === 0) {
      return;
    }
    for (let i = pickups.length - 1; i >= 0; i--) {
      const pickup = pickups[i];
      const dx = shipBody.x - pickup.x;
      const dy = shipBody.y - pickup.y;
      if (Math.hypot(dx, dy) < pickup.radius + shipRadius) {
        applyUpgradePickup(pickup.type);
        sounds.play("got_money");
        pickups.splice(i, 1);
      }
    }
  }

  function handleObjectBulletHits(bulletsList, sectors, viewRadius, worldAgeMs) {
    if (!Array.isArray(bulletsList) || bulletsList.length === 0) {
      return;
    }
    const bulletRadius = 3;
    for (let i = bulletsList.length - 1; i >= 0; i--) {
      const bullet = bulletsList[i];
      let hit = false;
      for (const activeSector of sectors) {
        const groups = getSectorObjectGroups(activeSector);
        for (const group of groups) {
          for (let j = group.length - 1; j >= 0; j--) {
            const obj = group[j];
            const radius = Number.isFinite(obj?.radius) ? obj.radius : 0;
            const dx = bullet.x - obj.x;
            const dy = bullet.y - obj.y;
            if (Math.hypot(dx, dy) < radius + bulletRadius) {
              bulletsList.splice(i, 1);
              hit = true;
              if (obj.type === "NODE") {
                break;
              }
              obj.hitsRemaining = Number.isFinite(obj.hitsRemaining) ? obj.hitsRemaining - 1 : 0;
              const destroyed = obj.hitsRemaining <= 0;
              if (obj.type === "LURE") {
                if (!obj.triggered) {
                  obj.triggered = true;
                  spawnLureEnemies(obj, viewRadius);
                }
                group.splice(j, 1);
                spawnExplosion(particles, obj.x, obj.y, "normal");
                spawnImpactRing(obj.x, obj.y, 1);
                sounds.play("explosion");
                break;
              }
              if (!destroyed) {
                break;
              }
              if (obj.type === "CORE") {
                spawnExplosion(particles, obj.x, obj.y, "normal");
                spawnImpactRing(obj.x, obj.y, OBJECT_EXPLOSION_RING_CORE_MULT);
              } else if (obj.type === "WRECKAGE") {
                spawnExplosion(particles, obj.x, obj.y, "normal");
                spawnImpactRing(obj.x, obj.y, 1);
                spawnUpgradePickup(obj.x, obj.y, "RELIC", worldAgeMs, Math.floor(obj.x + obj.y));
              } else if (obj.type === "SHARD") {
                spawnExplosion(particles, obj.x, obj.y, "normal");
                spawnImpactRing(obj.x, obj.y, 1);
                spawnUpgradePickup(obj.x, obj.y, "SHARD", worldAgeMs, Math.floor(obj.x + obj.y));
              } else {
                spawnExplosion(particles, obj.x, obj.y, "normal");
                spawnImpactRing(obj.x, obj.y, 1);
              }
              sounds.play("explosion");
              group.splice(j, 1);
              break;
            }
          }
          if (hit) {
            break;
          }
        }
        if (hit) {
          break;
        }
      }
    }
  }

  function drawCollectorField(ctx, radius) {
    if (!Number.isFinite(radius) || radius <= 0) {
      return;
    }
    ctx.save();
    ctx.strokeStyle = "rgba(120, 220, 180, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function getActiveStations() {
    const stations = [];
    for (const activeSector of activeSectors) {
      if (activeSector.station) {
        stations.push(activeSector.station);
      }
    }
    return stations;
  }

  function isInApseSector(x, y) {
    for (const sector of activeSectors) {
      if (sector.sectorType !== SECTOR_TYPES.APSE) {
        continue;
      }
      const bounds = sector.bounds;
      if (!bounds) {
        continue;
      }
      if (x >= bounds.x && x <= bounds.x + bounds.size
        && y >= bounds.y && y <= bounds.y + bounds.size) {
        return true;
      }
    }
    return false;
  }

  function destroyObjectsInSafeZones(stations) {
    if (!stations || stations.length === 0) {
      return;
    }
    for (const activeSector of activeSectors) {
      if (activeSector.sectorType === SECTOR_TYPES.APSE) {
        continue;
      }
      if (activeSector.asteroids.length === 0) {
        continue;
      }
      for (let i = activeSector.asteroids.length - 1; i >= 0; i--) {
        const asteroid = activeSector.asteroids[i];
        let remove = false;
        for (const station of stations) {
          const dx = asteroid.x - station.x;
          const dy = asteroid.y - station.y;
          if (Math.hypot(dx, dy) <= station.safeRadius) {
            remove = true;
            break;
          }
        }
        if (remove) {
          activeSector.asteroids.splice(i, 1);
        }
      }
    }

    for (let i = fuelPickups.length - 1; i >= 0; i--) {
      const fuel = fuelPickups[i];
      if (isInApseSector(fuel.x, fuel.y)) {
        continue;
      }
      for (const station of stations) {
        const dx = fuel.x - station.x;
        const dy = fuel.y - station.y;
        if (Math.hypot(dx, dy) <= station.safeRadius) {
          fuelPickups.splice(i, 1);
          break;
        }
      }
    }
    for (let i = resourcePickups.length - 1; i >= 0; i--) {
      const pickup = resourcePickups[i];
      if (isInApseSector(pickup.x, pickup.y)) {
        continue;
      }
      for (const station of stations) {
        const dx = pickup.x - station.x;
        const dy = pickup.y - station.y;
        if (Math.hypot(dx, dy) <= station.safeRadius) {
          resourcePickups.splice(i, 1);
          break;
        }
      }
    }
  }

  function repelEnemiesFromStations(stations, dt) {
    if (!stations || stations.length === 0 || enemies.length === 0) {
      return;
    }
    for (const enemy of enemies) {
      for (const station of stations) {
        const dx = enemy.x - station.x;
        const dy = enemy.y - station.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < STATION.ENEMY_REPEL_RADIUS) {
          const strength = STATION.ENEMY_REPEL_STRENGTH * (1 - dist / STATION.ENEMY_REPEL_RADIUS);
          const nx = dx / dist;
          const ny = dy / dist;
          enemy.vx += nx * strength * dt;
          enemy.vy += ny * strength * dt;
          enemy.x += nx * 8;
          enemy.y += ny * 8;
        }
      }
    }
  }

  function getGateWidth(type) {
    const multiplier = CALIBRATION_GATE.WIDTH_MULTIPLIERS[type] ?? 1.6;
    return CALIBRATION_SHIP_RADIUS * 2 * multiplier;
  }

  function getGateColor(type) {
    if (type === CALIBRATION_GATE.TYPES.DISPLACEMENT) return CALIBRATION_GATE.COLORS.DISPLACEMENT;
    if (type === CALIBRATION_GATE.TYPES.EXIT) return CALIBRATION_GATE.COLORS.EXIT;
    if (type === CALIBRATION_GATE.TYPES.SHUTDOWN) return CALIBRATION_GATE.COLORS.SHUTDOWN;
    return CALIBRATION_GATE.COLORS.CHAIN;
  }

  function pickGateType() {
    const types = Object.values(CALIBRATION_GATE.TYPES);
    const weights = CALIBRATION_GATE.WEIGHTS;
    let total = 0;
    for (const type of types) {
      total += Math.max(0, weights?.[type] ?? 0);
    }
    if (total <= 0) {
      return CALIBRATION_GATE.TYPES.CHAIN;
    }
    let roll = Math.random() * total;
    for (const type of types) {
      const weight = Math.max(0, weights?.[type] ?? 0);
      roll -= weight;
      if (roll <= 0) {
        return type;
      }
    }
    return types[types.length - 1];
  }

  function isSectorGateEligible(currentSector) {
    if (!currentSector) {
      return false;
    }
    if (currentSector.sectorType === SECTOR_TYPES.SIGNAL_ORIGIN) {
      return false;
    }
    if (currentSector.sectorType === SECTOR_TYPES.DEAD_QUIET) {
      return false;
    }
    return true;
  }

  function rectContainsPoint(rect, px, py) {
    return px >= rect.x && px <= rect.x + rect.width
      && py >= rect.y && py <= rect.y + rect.height;
  }

  function distanceToRect(rect, px, py) {
    const cx = clampValue(px, rect.x, rect.x + rect.width);
    const cy = clampValue(py, rect.y, rect.y + rect.height);
    return Math.hypot(px - cx, py - cy);
  }

  function getTravelDirection() {
    const speed = Math.hypot(ship.vx, ship.vy);
    if (speed > 1) {
      return { x: ship.vx / speed, y: ship.vy / speed };
    }
    return { x: Math.sin(ship.heading), y: -Math.cos(ship.heading) };
  }

  function normalizeAngle(angle) {
    return ((angle + Math.PI) % (Math.PI * 2)) - Math.PI;
  }

    function getScanTarget() {
      let best = null;
      let fallback = null;
      for (const current of activeSectors) {
        if (!current.goal) {
          continue;
        }
        const tx = current.goal.x + current.goal.width / 2;
        const ty = current.goal.y + current.goal.height / 2;
        const dx = tx - ship.x;
        const dy = ty - ship.y;
        const dist = Math.hypot(dx, dy);
        const weight = current === sector ? 0.7 : 1;
        const score = dist * weight;
        const entry = { x: tx, y: ty, dist, score };
        if (!current.goalDelivered) {
          if (!best || score < best.score) {
            best = entry;
          }
        } else if (!fallback || score < fallback.score) {
          fallback = entry;
        }
      }
      return best ?? fallback;
    }

    function getLockedSurveyTarget() {
      if (autopilotTarget) {
        const dx = autopilotTarget.x - ship.x;
        const dy = autopilotTarget.y - ship.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= AUTOPILOT.TARGET.BRAKE_DISTANCE * 0.6) {
          autopilotTarget = null;
        } else {
          let stillValid = false;
          for (const current of activeSectors) {
            if (!current.goal) {
              continue;
            }
            const tx = current.goal.x + current.goal.width / 2;
            const ty = current.goal.y + current.goal.height / 2;
            if (Math.hypot(tx - autopilotTarget.x, ty - autopilotTarget.y) < 1) {
              stillValid = true;
              break;
            }
          }
          if (!stillValid) {
            autopilotTarget = null;
          }
        }
      }
      if (!autopilotTarget) {
        autopilotTarget = getScanTarget();
      }
      return autopilotTarget;
    }

  function getFuelTarget() {
    let best = null;
    for (const fuel of fuelPickups) {
      const dx = fuel.x - ship.x;
      const dy = fuel.y - ship.y;
      const dist = Math.hypot(dx, dy);
      if (!best || dist < best.dist) {
        best = { x: fuel.x, y: fuel.y, dist };
      }
    }
    return best;
  }

  function getPursuitTarget() {
    if (!enemies || enemies.length === 0) {
      return null;
    }
    const speed = Math.hypot(ship.vx, ship.vy);
    const forward = speed > 8
      ? { x: ship.vx / speed, y: ship.vy / speed }
      : { x: Math.sin(ship.heading), y: -Math.cos(ship.heading) };
    const back = { x: -forward.x, y: -forward.y };
    const coneHalfRad = ((AUTOPILOT.FIRE.PRIORITY_REAR_ANGLE_DEG ?? 120) * Math.PI) / 180 / 2;
    const minDot = Math.cos(coneHalfRad);
    const maxRange = AUTOPILOT.FIRE.PRIORITY_RANGE ?? ENEMY_FIRE_RANGE;
    let best = null;
    for (const enemy of enemies) {
      const dx = enemy.x - ship.x;
      const dy = enemy.y - ship.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= 0 || dist > maxRange) {
        continue;
      }
      const dirX = dx / dist;
      const dirY = dy / dist;
      const backDot = back.x * dirX + back.y * dirY;
      if (backDot < minDot) {
        continue;
      }
      if (!best || dist < best.dist) {
        best = { enemy, x: enemy.x, y: enemy.y, dist };
      }
    }
    return best;
  }

  function closestPointOnSegment(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const denom = abx * abx + aby * aby;
    if (denom === 0) {
      return { x: ax, y: ay, t: 0 };
    }
    let t = (apx * abx + apy * aby) / denom;
    t = clampValue(t, 0, 1);
    return { x: ax + abx * t, y: ay + aby * t, t };
  }

  function getClosestRiverInfo(pos, rivers) {
    let best = null;
    for (const river of rivers) {
      const points = river?.points;
      if (!points || points.length < 2) {
        continue;
      }
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        const hit = closestPointOnSegment(pos.x, pos.y, a.x, a.y, b.x, b.y);
        const dx = pos.x - hit.x;
        const dy = pos.y - hit.y;
        const dist = Math.hypot(dx, dy);
        if (!best || dist < best.dist) {
          const segX = b.x - a.x;
          const segY = b.y - a.y;
          const segLen = Math.hypot(segX, segY) || 1;
          best = {
            dist,
            width: river.width ?? RIVER.WIDTH_MIN,
            closestX: hit.x,
            closestY: hit.y,
            tangentX: segX / segLen,
            tangentY: segY / segLen
          };
        }
      }
    }
    return best;
  }

    function getAutopilotAvoidance(activeStations, activeStars) {
      const avoid = { x: 0, y: 0 };
      let closest = Infinity;

    const addRepulsion = (hx, hy, limit, weight = 1) => {
      if (!Number.isFinite(limit) || limit <= 0) {
        return;
      }
      const dx = ship.x - hx;
      const dy = ship.y - hy;
      const dist = Math.hypot(dx, dy);
      if (dist <= 0 || dist > limit) {
        return;
      }
      const strength = Math.pow(1 - dist / limit, 2) * weight;
      avoid.x += (dx / dist) * strength;
      avoid.y += (dy / dist) * strength;
      if (dist < closest) {
        closest = dist;
      }
    };

      for (const activeSector of activeSectors) {
        if (activeSector.beacon) {
          const radius = activeSector.beacon.radius ?? BEACON.OBSERVER_RADIUS;
          const limit = radius + AUTOPILOT.AVOID.BEACON_BUFFER;
          addRepulsion(activeSector.beacon.x, activeSector.beacon.y, limit, 1.2);
        }
    }

    if (Array.isArray(activeStars)) {
      for (const star of activeStars) {
        const gravityRadius = Number.isFinite(star.gravityRadius) ? star.gravityRadius : 0;
        if (!Number.isFinite(gravityRadius) || gravityRadius <= 0) {
          continue;
        }
        const limit = gravityRadius + AUTOPILOT.AVOID.STAR_BODY_BUFFER;
        addRepulsion(star.x, star.y, limit, 1.3);
      }
    }

    for (const station of activeStations) {
      const limit = (station.safeRadius ?? STATION.SAFE_ZONE_RADIUS) + AUTOPILOT.AVOID.STATION_BUFFER;
      addRepulsion(station.x, station.y, limit, 1.4);
    }

      return { avoid, closest };
    }

    function getAsteroidThreat(asteroid, horizonTime, buffer) {
      const relX = asteroid.x - ship.x;
      const relY = asteroid.y - ship.y;
      const relVx = (asteroid.vx ?? 0) - ship.vx;
      const relVy = (asteroid.vy ?? 0) - ship.vy;
      const speedSq = relVx * relVx + relVy * relVy;
      let t = 0;
      if (speedSq > 0.001) {
        t = -((relX * relVx + relY * relVy) / speedSq);
      }
      if (!Number.isFinite(t) || t < 0 || t > horizonTime) {
        return null;
      }
      const cx = relX + relVx * t;
      const cy = relY + relVy * t;
      const dist = Math.hypot(cx, cy);
      if (dist > buffer) {
        return null;
      }
      return {
        asteroid,
        t,
        dist,
        buffer,
        px: asteroid.x + (asteroid.vx ?? 0) * t,
        py: asteroid.y + (asteroid.vy ?? 0) * t
      };
    }

    function getCourseAvoidance(desiredDir, lookaheadDist, activeStars, asteroidThreats) {
      let closest = Infinity;
      let hazard = null;
      const ax = ship.x;
      const ay = ship.y;
      const bx = ship.x + desiredDir.x * lookaheadDist;
      const by = ship.y + desiredDir.y * lookaheadDist;

      for (const star of activeStars) {
        const bodyRadius = star.radius ?? 0;
        const gravityRadius = Number.isFinite(star.gravityRadius) ? star.gravityRadius : bodyRadius;
        const limit = gravityRadius + AUTOPILOT.AVOID.STAR_BODY_BUFFER + AUTOPILOT.COURSE.CORRIDOR_RADIUS;
        if (!Number.isFinite(limit) || limit <= 0) {
          continue;
        }
        const hit = closestPointOnSegment(star.x, star.y, ax, ay, bx, by);
        const dx = star.x - hit.x;
        const dy = star.y - hit.y;
        const dist = Math.hypot(dx, dy);
        if (dist < limit && dist < closest) {
          closest = dist;
          hazard = { x: star.x, y: star.y };
        }
      }

      for (const threat of asteroidThreats) {
        if (threat.dist < threat.buffer && threat.dist < closest) {
          closest = threat.dist;
          hazard = { x: threat.px, y: threat.py };
        }
      }

      if (!hazard) {
        return { desiredDir, closest };
      }
      const toHx = hazard.x - ship.x;
      const toHy = hazard.y - ship.y;
      const cross = desiredDir.x * toHy - desiredDir.y * toHx;
      const steerSign = cross === 0 ? 1 : Math.sign(cross);
      const steerAngle = (AUTOPILOT.COURSE.AVOID_ANGLE_DEG * Math.PI) / 180;
      const adjusted = rotateVector(desiredDir, -steerSign * steerAngle);
      return { desiredDir: adjusted, closest };
    }

    function getGravityEscape(activeStars) {
      if (!Array.isArray(activeStars)) {
        return null;
      }
      let closest = null;
      for (const star of activeStars) {
        const gravityRadius = Number.isFinite(star.gravityRadius) ? star.gravityRadius : 0;
        if (!Number.isFinite(gravityRadius) || gravityRadius <= 0) {
          continue;
        }
        const dx = ship.x - star.x;
        const dy = ship.y - star.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= 0 || dist > gravityRadius) {
          continue;
        }
        if (!closest || dist < closest.dist) {
          closest = { dx, dy, dist };
        }
      }
      if (!closest) {
        return null;
      }
      const mag = closest.dist || 1;
      return { x: closest.dx / mag, y: closest.dy / mag };
    }

    function computeAutopilotInput(dt, activeStars, activeStations, starAccelOverride = null) {
      const fuelRatio = ship.maxFuel > 0 ? ship.fuel / ship.maxFuel : 0;
      const avoidData = getAutopilotAvoidance(activeStations, activeStars);
      const pursuitTarget = getPursuitTarget();
      const priorityEnemy = pursuitTarget ? pursuitTarget.enemy : null;
      let desired = null;
      let targetDist = 0;
      let escapeMode = false;

    const avoidMag = Math.hypot(avoidData.avoid.x, avoidData.avoid.y);
    if (avoidMag > 0.001) {
      desired = { x: avoidData.avoid.x, y: avoidData.avoid.y };
      targetDist = avoidMag;
    } else if (pursuitTarget) {
      desired = { x: pursuitTarget.x - ship.x, y: pursuitTarget.y - ship.y };
      targetDist = pursuitTarget.dist;
    } else {
        const surveyTarget = getLockedSurveyTarget();
      const fuelTarget = getFuelTarget();

      let target = null;
      if (fuelRatio < AUTOPILOT.FUEL.CRITICAL && fuelTarget) {
        target = fuelTarget;
      } else if (surveyTarget) {
        if (fuelRatio < AUTOPILOT.FUEL.MID && fuelTarget) {
          const toSurvey = { x: surveyTarget.x - ship.x, y: surveyTarget.y - ship.y };
          const toFuel = { x: fuelTarget.x - ship.x, y: fuelTarget.y - ship.y };
          const distFuel = fuelTarget.dist;
          const surveyLen = Math.hypot(toSurvey.x, toSurvey.y) || 1;
          const fuelLen = Math.hypot(toFuel.x, toFuel.y) || 1;
          const dot = (toSurvey.x * toFuel.x + toSurvey.y * toFuel.y) / (surveyLen * fuelLen);
          const angle = Math.acos(clampValue(dot, -1, 1));
          const angleDeg = (angle * 180) / Math.PI;
          if (distFuel <= AUTOPILOT.TARGET.FUEL_RANGE && angleDeg <= AUTOPILOT.TARGET.FUEL_ANGLE_DEG) {
            target = fuelTarget;
          } else {
            target = surveyTarget;
          }
        } else {
          target = surveyTarget;
        }
      } else if (fuelRatio < AUTOPILOT.FUEL.MID && fuelTarget) {
        target = fuelTarget;
      }

      if (target) {
        desired = { x: target.x - ship.x, y: target.y - ship.y };
        targetDist = target.dist ?? Math.hypot(desired.x, desired.y);
      } else {
        const dx = ship.x - originX;
        const dy = ship.y - originY;
        const dist = Math.hypot(dx, dy);
        desired = dist > 1 ? { x: dx, y: dy } : { x: 1, y: 0 };
        targetDist = dist;
      }
    }

      const escapeDir = getGravityEscape(activeStars);
      if (escapeDir) {
        desired = escapeDir;
        targetDist = null;
        escapeMode = true;
      }

      const desiredMag = Math.hypot(desired.x, desired.y) || 1;
      let desiredDir = { x: desired.x / desiredMag, y: desired.y / desiredMag };

      const lookaheadDist = AUTOPILOT.COURSE.LOOKAHEAD_DIST;
      const shipSpeed = Math.hypot(ship.vx, ship.vy);
      const lookaheadTimeRaw = lookaheadDist / Math.max(60, shipSpeed);
      const lookaheadTime = Math.min(AUTOPILOT.COURSE.LOOKAHEAD_TIME_MAX, lookaheadTimeRaw);
      const asteroidThreats = [];
      for (const activeSector of activeSectors) {
        for (const asteroid of activeSector.asteroids) {
          const buffer = (asteroid.radius ?? 0) + SHIP_RADIUS + AUTOPILOT.AVOID.ASTEROID_BODY_BUFFER;
          const threat = getAsteroidThreat(asteroid, lookaheadTime, buffer);
          if (threat) {
            asteroidThreats.push(threat);
          }
        }
      }
      if (!escapeMode) {
        const courseAdjust = getCourseAvoidance(desiredDir, lookaheadDist, activeStars, asteroidThreats);
        desiredDir = courseAdjust.desiredDir;

        const riverInfo = getClosestRiverInfo(ship, sector?.runtimeRivers ?? []);
        if (riverInfo && riverInfo.dist < (riverInfo.width / 2)) {
          const flowDot = desiredDir.x * riverInfo.tangentX + desiredDir.y * riverInfo.tangentY;
          if (flowDot < AUTOPILOT.RIVER.ALIGN_DOT_MIN) {
            const outX = ship.x - riverInfo.closestX;
            const outY = ship.y - riverInfo.closestY;
            const outMag = Math.hypot(outX, outY) || 1;
            desiredDir = { x: outX / outMag, y: outY / outMag };
            targetDist = outMag;
          }
        }
      }

      const starAccel = starAccelOverride ?? computeStarAccelAt(ship, activeStars, CONFIG);
      const accelMag = Math.hypot(starAccel.ax, starAccel.ay);
      if (accelMag > 0) {
        const ax = starAccel.ax / accelMag;
        const ay = starAccel.ay / accelMag;
        const ref = Math.max(1, SHIP.THRUST * AUTOPILOT.GRAVITY.THRUST_RATIO);
        const blend = clampValue(accelMag / ref, 0, AUTOPILOT.GRAVITY.MAX_BLEND);
        desiredDir = {
          x: desiredDir.x - ax * blend * AUTOPILOT.GRAVITY.COMPENSATION,
          y: desiredDir.y - ay * blend * AUTOPILOT.GRAVITY.COMPENSATION
        };
      }

      if (AUTOPILOT.GRAVITY.CLOSE_PUSH > 0) {
        for (const star of activeStars) {
          const dx = ship.x - star.x;
          const dy = ship.y - star.y;
          const dist = Math.hypot(dx, dy);
          const bodyRadius = star.radius ?? 0;
          const limit = bodyRadius + AUTOPILOT.AVOID.STAR_BODY_BUFFER;
          if (dist > 0 && dist < limit) {
            const push = (1 - dist / limit) * AUTOPILOT.GRAVITY.CLOSE_PUSH;
            desiredDir.x += (dx / dist) * push;
            desiredDir.y += (dy / dist) * push;
          }
        }
      }

      const normalizedMag = Math.hypot(desiredDir.x, desiredDir.y) || 1;
      desiredDir = { x: desiredDir.x / normalizedMag, y: desiredDir.y / normalizedMag };

      const baseSpeed = AUTOPILOT.THRUST.CRUISE_SPEED;
      let desiredSpeed = baseSpeed;
      if (Number.isFinite(targetDist)) {
        const coastSpeed = targetDist / Math.max(0.1, AUTOPILOT.THRUST.COAST_TIME);
        desiredSpeed = Math.min(baseSpeed, coastSpeed);
        if (targetDist > AUTOPILOT.TARGET.BRAKE_DISTANCE) {
          desiredSpeed = Math.max(desiredSpeed, AUTOPILOT.THRUST.SPEED_FLOOR);
        }
      }

      const desiredVel = {
        x: desiredDir.x * desiredSpeed,
        y: desiredDir.y * desiredSpeed
      };
      const errorVel = {
        x: desiredVel.x - ship.vx,
        y: desiredVel.y - ship.vy
      };
      const errorMag = Math.hypot(errorVel.x, errorVel.y);
      const errorDir = errorMag > 0
        ? { x: errorVel.x / errorMag, y: errorVel.y / errorMag }
        : desiredDir;
      const errorBlend = clampValue(
        errorMag / Math.max(1, desiredSpeed * AUTOPILOT.COURSE.ERROR_BLEND_RATIO),
        0,
        1
      );
      const steeringRaw = {
        x: desiredDir.x * (1 - errorBlend) + errorDir.x * errorBlend,
        y: desiredDir.y * (1 - errorBlend) + errorDir.y * errorBlend
      };
      const steeringMag = Math.hypot(steeringRaw.x, steeringRaw.y) || 1;
      const steeringDir = { x: steeringRaw.x / steeringMag, y: steeringRaw.y / steeringMag };

      const desiredHeading = Math.atan2(steeringDir.x, -steeringDir.y);
      let angleDiff = normalizeAngle(desiredHeading - ship.heading);
      const turnEpsilon = AUTOPILOT.COURSE.TURN_EPSILON ?? 0.04;
      if (Math.abs(Math.abs(angleDiff) - Math.PI) < turnEpsilon) {
        angleDiff = autopilotTurnBias * (Math.PI - turnEpsilon);
      } else if (angleDiff !== 0) {
        autopilotTurnBias = Math.sign(angleDiff);
      }
      const rotationInput = clampValue(angleDiff / (Math.PI / 4), -1, 1);
      const angleDeg = Math.abs(angleDiff) * (180 / Math.PI);
      let thrustInput = 0;
      let thrustWanted = 0;
      if (angleDeg < AUTOPILOT.TARGET.THRUST_ANGLE_DEG) {
        const errorRatio = baseSpeed > 0 ? errorMag / baseSpeed : 0;
        const errorDeadband = AUTOPILOT.THRUST.ERROR_RATIO_DEADBAND ?? 0;
        const align = Math.max(0, Math.cos(angleDiff));
        if (errorRatio >= errorDeadband) {
          thrustWanted = clampValue(errorRatio, 0, 1);
        } else {
          thrustWanted = 0;
        }
        thrustWanted *= Math.pow(align, AUTOPILOT.THRUST.ALIGN_POWER);
        if (Number.isFinite(targetDist) && targetDist > AUTOPILOT.TARGET.BRAKE_DISTANCE) {
          const minPower = AUTOPILOT.THRUST.MIN_POWER ?? 0;
          if (thrustWanted > 0 && thrustWanted < minPower) {
            thrustWanted = minPower;
          }
        }
      }
      if (thrustWanted > 0) {
        if (AUTOPILOT.THRUST.BURST_COOLDOWN <= 0 || AUTOPILOT.THRUST.BURST_MIN <= 0) {
          autopilotThrustBurst = 0;
          autopilotThrustCooldown = 0;
          thrustInput = thrustWanted;
        } else {
          if (autopilotThrustBurst <= 0 && autopilotThrustCooldown <= 0) {
            autopilotThrustBurst = AUTOPILOT.THRUST.BURST_MIN;
          }
          if (autopilotThrustBurst > 0 && autopilotThrustCooldown <= 0) {
            thrustInput = thrustWanted;
          }
        }
      } else {
        autopilotThrustBurst = 0;
      }

      const hazardClear = avoidData.closest > AUTOPILOT.FIRE.HAZARD_CLEAR_DIST;
      const forward = { x: Math.sin(ship.heading), y: -Math.cos(ship.heading) };
      const coneRad = (AUTOPILOT.FIRE.CONE_DEG * Math.PI) / 180;
      const maxRange = Math.min(ENEMY_FIRE_RANGE, BULLET.SPEED * BULLET.LIFE * AUTOPILOT.FIRE.RANGE_MULT);
      const canFireAt = (dx, dy, dist) => {
        if (dist > maxRange || dist <= 0) {
          return false;
        }
        const dot = (forward.x * dx + forward.y * dy) / dist;
        const angle = Math.acos(clampValue(dot, -1, 1));
        return angle <= coneRad;
      };
      let fire = false;

      if (autopilotFirePause <= 0 && hazardClear) {
        if (priorityEnemy) {
          const dx = priorityEnemy.x - ship.x;
          const dy = priorityEnemy.y - ship.y;
          const dist = Math.hypot(dx, dy);
          fire = canFireAt(dx, dy, dist);
        } else {
          for (const threat of asteroidThreats) {
            const dx = threat.px - ship.x;
            const dy = threat.py - ship.y;
            const dist = Math.hypot(dx, dy);
            if (canFireAt(dx, dy, dist)) {
              fire = true;
              break;
            }
          }
          if (!fire) {
            for (const enemy of enemies) {
              const dx = enemy.x - ship.x;
              const dy = enemy.y - ship.y;
              const dist = Math.hypot(dx, dy);
              if (canFireAt(dx, dy, dist)) {
                fire = true;
                break;
              }
            }
          }
          if (!fire) {
            for (const activeSector of activeSectors) {
              for (const asteroid of activeSector.asteroids) {
                const dx = asteroid.x - ship.x;
                const dy = asteroid.y - ship.y;
                const dist = Math.hypot(dx, dy);
                if (canFireAt(dx, dy, dist)) {
                  fire = true;
                  break;
                }
              }
              if (fire) {
                break;
              }
            }
          }
        }
      }

      return { rotationInput, thrustInput, fire, starAccel };
    }

  function getNearestCalibrationTarget() {
    let best = null;
    for (const current of activeSectors) {
      if (current.goal && !current.goalCollected) {
        const gx = current.goal.x + current.goal.width / 2;
        const gy = current.goal.y + current.goal.height / 2;
        const dist = Math.hypot(gx - ship.x, gy - ship.y);
        if (!best || dist < best.dist) {
          best = { x: gx, y: gy, dist };
        }
      }
    }
    return best;
  }

  function getExitTarget() {
    const target = getNearestCalibrationTarget();
    if (target) {
      return target;
    }
    const dir = getTravelDirection();
    const fallbackDist = SECTOR_SIZE * 0.6;
    return { x: ship.x + dir.x * fallbackDist, y: ship.y + dir.y * fallbackDist };
  }

  function rotateVector(vec, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: vec.x * cos - vec.y * sin,
      y: vec.x * sin + vec.y * cos
    };
  }

  function isWithinBounds(point, bounds, margin) {
    return point.x >= bounds.x + margin
      && point.x <= bounds.x + bounds.size - margin
      && point.y >= bounds.y + margin
      && point.y <= bounds.y + bounds.size - margin;
  }

  function isGateLocationClear(candidate, halfSpan) {
    if (sector.goal && !sector.goalCollected) {
      if (rectContainsPoint(sector.goal, candidate.x, candidate.y)) {
        return false;
      }
      if (distanceToRect(sector.goal, candidate.x, candidate.y) < CALIBRATION_GATE.EXCLUSION_RADIUS) {
        return false;
      }
    }

    for (const star of sector.stars) {
      const starRadius = Number.isFinite(star.gravityRadius) ? star.gravityRadius : 0;
      if (starRadius <= 0) {
        continue;
      }
      const dx = candidate.x - star.x;
      const dy = candidate.y - star.y;
      if (Math.hypot(dx, dy) < starRadius + halfSpan) {
        return false;
      }
    }
    return true;
  }

  function buildGate(type, center, travelDir, width, poleRadius) {
    const mag = Math.hypot(travelDir.x, travelDir.y) || 1;
    const normal = { x: travelDir.x / mag, y: travelDir.y / mag };
    const axis = { x: -normal.y, y: normal.x };
    return {
      type,
      center,
      axis,
      normal,
      width,
      poleRadius,
      color: getGateColor(type),
      thickness: CALIBRATION_GATE.BASE_THICKNESS,
      state: "spawning",
      fadeTimer: 0,
      lifeTimer: 0,
      prevPlane: null,
      resolved: false
    };
  }

  function createSingleGate(viewRadius, type, bounds, dir, margin) {
    const axis = { x: -dir.y, y: dir.x };
    const apertureWidth = getGateWidth(type);
    const poleRadius = apertureWidth * CALIBRATION_GATE.POLE_RATIO;
    const halfSpan = apertureWidth / 2 + poleRadius;
    const maxDist = viewRadius - CALIBRATION_GATE.EDGE_OFFSET - halfSpan;
    if (maxDist <= 0) {
      return null;
    }
    const minDist = Math.max(halfSpan, maxDist * 0.9);

    for (let tries = 0; tries < 12; tries++) {
      const distance = randomRange(minDist, maxDist);
      const lateral = randomRange(-CALIBRATION_GATE.SPAWN_LATERAL, CALIBRATION_GATE.SPAWN_LATERAL);
      const candidate = {
        x: ship.x + dir.x * distance + axis.x * lateral,
        y: ship.y + dir.y * distance + axis.y * lateral
      };
      candidate.x = clampValue(candidate.x, bounds.x + margin, bounds.x + bounds.size - margin);
      candidate.y = clampValue(candidate.y, bounds.y + margin, bounds.y + bounds.size - margin);

      if (!isGateLocationClear(candidate, halfSpan)) {
        continue;
      }

      return buildGate(type, candidate, dir, apertureWidth, poleRadius);
    }
    return null;
  }

  function createChainGateSeries(viewRadius, bounds, dir, margin) {
    const type = CALIBRATION_GATE.TYPES.CHAIN;
    const axis = { x: -dir.y, y: dir.x };
    const apertureWidth = getGateWidth(type);
    const poleRadius = apertureWidth * CALIBRATION_GATE.POLE_RATIO;
    const halfSpan = apertureWidth / 2 + poleRadius;
    const maxDist = viewRadius - CALIBRATION_GATE.EDGE_OFFSET - halfSpan;
    if (maxDist <= 0) {
      return null;
    }
    const minDist = Math.max(halfSpan, maxDist * 0.9);
    const chainCount = Math.floor(
      randomRange(CALIBRATION_GATE.CHAIN_MIN, CALIBRATION_GATE.CHAIN_MAX + 1)
    );

    const turnDir = Math.random() < 0.5 ? -1 : 1;
    for (let attempt = 0; attempt < CALIBRATION_GATE.CHAIN_ATTEMPTS; attempt++) {
      const span = randomRange(CALIBRATION_GATE.CHAIN_ARC_MIN, CALIBRATION_GATE.CHAIN_ARC_MAX);
      const step = chainCount > 1 ? span / (chainCount - 1) : 0;
      const baseDist = minDist;
      const forwardSpan = Math.max(0, maxDist - baseDist);
      const radius = forwardSpan > 0
        ? forwardSpan / Math.max(0.15, Math.sin(span))
        : maxDist;
      const gates = [];
      let valid = true;

      for (let i = 0; i < chainCount; i++) {
        const angle = step * i;
        const forward = baseDist + radius * Math.sin(angle);
        const lateral = radius * (1 - Math.cos(angle)) * turnDir;
        const pathDir = rotateVector(dir, angle * turnDir);
        const candidate = {
          x: ship.x + dir.x * forward + axis.x * lateral,
          y: ship.y + dir.y * forward + axis.y * lateral
        };
        if (!isWithinBounds(candidate, bounds, margin)) {
          valid = false;
          break;
        }
        if (!isGateLocationClear(candidate, halfSpan)) {
          valid = false;
          break;
        }
        const gate = buildGate(type, candidate, pathDir, apertureWidth, poleRadius);
        gate.chainIndex = i;
        gate.chainCount = chainCount;
        gates.push(gate);
      }

      if (valid) {
        return gates;
      }
    }
    return null;
  }

  function createGate(viewRadius) {
    if (!isSectorGateEligible(sector)) {
      return null;
    }
    if (!Number.isFinite(viewRadius) || viewRadius <= 0) {
      return null;
    }
    const bounds = sector.bounds;
    const dir = getTravelDirection();
    const margin = 260;
    const type = pickGateType();

    if (type === CALIBRATION_GATE.TYPES.CHAIN) {
      return createChainGateSeries(viewRadius, bounds, dir, margin);
    }

    const single = createSingleGate(viewRadius, type, bounds, dir, margin);
    return single ? [single] : null;
  }

  function applyGateEffect(gate) {
    const type = gate.type;
    const target = getNearestCalibrationTarget();
    sounds.play("got_gate");
    if (type === CALIBRATION_GATE.TYPES.CHAIN) {
      calibrationScore += 1;
      chainProgress += 1;
      const points = CALIBRATION_GATE.CHAIN_SCORE_BASE * chainProgress;
      addScore(points, false, false, gate.center, "chain");
      return;
    }
    addScore(CALIBRATION_GATE.GATE_SCORE_BASE, false, false, gate.center, "gate");
    if (type === CALIBRATION_GATE.TYPES.DISPLACEMENT) {
      if (!target) {
        return;
      }
      const dx = target.x - ship.x;
      const dy = target.y - ship.y;
      const dist = Math.hypot(dx, dy) || 1;
      const dirX = dx / dist;
      const dirY = dy / dist;
        const offset = Math.max(CALIBRATION_GATE.EXCLUSION_RADIUS, 240);
        ship.x = target.x - dirX * offset;
        ship.y = target.y - dirY * offset;
        lastTrailX = ship.x;
        lastTrailY = ship.y;
      trail.length = 0;
      const heading = Math.atan2(dx, -dy);
      ship.heading = heading;
      const speed = clampValue(Math.hypot(ship.vx, ship.vy), CALIBRATION_GATE.CRUISE_MIN, CALIBRATION_GATE.CRUISE_MAX);
      ship.vx = Math.sin(heading) * speed;
      ship.vy = -Math.cos(heading) * speed;
      gateCorrection = null;
      return;
    }
    if (type === CALIBRATION_GATE.TYPES.SHUTDOWN) {
      controlsDisabledTimer = Math.max(controlsDisabledTimer, CONTROL_DISABLE.DURATION);
      ship.stopThrustLoop();
      ship.stopRotateLoop();
      ship.thrusting = 0;
      return;
    }
    if (type === CALIBRATION_GATE.TYPES.EXIT) {
      const desired = getExitTarget();
      const dx = desired.x - ship.x;
      const dy = desired.y - ship.y;
      const heading = Math.atan2(dx, -dy);
      ship.heading = heading;
      ship.vx = Math.sin(heading) * CALIBRATION_GATE.CRUISE_SPEED;
      ship.vy = -Math.cos(heading) * CALIBRATION_GATE.CRUISE_SPEED;
      gateCorrection = null;
    }
  }

  function updateGate(dt) {
    if (activeGates.length === 0) {
      return;
    }
    const remaining = [];
    for (const gate of activeGates) {
      if (gate.state === "spawning") {
        gate.fadeTimer += dt;
        if (gate.fadeTimer >= CALIBRATION_GATE.FADE_TIME) {
          gate.state = "active";
          gate.fadeTimer = 0;
        }
        remaining.push(gate);
        continue;
      }

      if (gate.state === "active") {
        gate.lifeTimer += dt;
        if (gate.lifeTimer >= CALIBRATION_GATE.LIFETIME) {
          gate.state = "fading";
          gate.fadeTimer = 0;
          remaining.push(gate);
          continue;
        }

        const dx = ship.x - gate.center.x;
        const dy = ship.y - gate.center.y;
        const planeDist = dx * gate.normal.x + dy * gate.normal.y;
        if (gate.prevPlane !== null) {
          if ((gate.prevPlane > 0 && planeDist <= 0) || (gate.prevPlane < 0 && planeDist >= 0)) {
            const lateral = Math.abs(dx * gate.axis.x + dy * gate.axis.y);
            if (lateral <= gate.width / 2) {
              gate.resolved = true;
              applyGateEffect(gate);
            }
            gate.state = "fading";
            gate.fadeTimer = 0;
          }
        }
        gate.prevPlane = planeDist;
        remaining.push(gate);
        continue;
      }

      if (gate.state === "fading") {
        gate.fadeTimer += dt;
        if (gate.fadeTimer < CALIBRATION_GATE.FADE_TIME) {
          remaining.push(gate);
        }
      }
    }
    activeGates = remaining;
  }

  function applyGateCorrection(dt) {
    if (!gateCorrection) {
      return;
    }
    gateCorrection.elapsed += dt;
    const t = clampValue(gateCorrection.elapsed / gateCorrection.duration, 0, 1);
    const heading = lerpAngle(gateCorrection.startHeading, gateCorrection.targetHeading, t);
    const speed = gateCorrection.startSpeed + (gateCorrection.targetSpeed - gateCorrection.startSpeed) * t;
    ship.heading = heading;
    ship.vx = Math.sin(heading) * speed;
    ship.vy = -Math.cos(heading) * speed;
    if (t >= 1) {
      gateCorrection = null;
    }
  }

  function drawGate(ctx) {
    if (activeGates.length === 0) {
      return;
    }
    for (const gate of activeGates) {
      const fade = gate.state === "spawning"
        ? clampValue(gate.fadeTimer / CALIBRATION_GATE.FADE_TIME, 0, 1)
        : gate.state === "fading"
          ? 1 - clampValue(gate.fadeTimer / CALIBRATION_GATE.FADE_TIME, 0, 1)
          : 1;
      if (fade <= 0) {
        continue;
      }

      const axis = gate.axis;
      const normal = gate.normal;
      const half = gate.width / 2;
      const left = {
        x: gate.center.x - axis.x * half,
        y: gate.center.y - axis.y * half
      };
      const right = {
        x: gate.center.x + axis.x * half,
        y: gate.center.y + axis.y * half
      };
      const poleRadius = gate.poleRadius * (gate.type === CALIBRATION_GATE.TYPES.DISPLACEMENT ? 1.15 : 1);
      const color = gate.color;
      let gateAlpha = fade;
      if (gate.type === CALIBRATION_GATE.TYPES.CHAIN) {
        const total = Math.max(1, gate.chainCount ?? 1);
        const progress = Math.max(0, chainProgress ?? 0);
        if (Number.isFinite(gate.chainIndex) && gate.chainIndex >= progress) {
          const remaining = Math.max(1, total - progress);
          const offset = gate.chainIndex - progress;
          const t = remaining > 1 ? offset / (remaining - 1) : 0;
          gateAlpha *= 1 - t * CALIBRATION_GATE.CHAIN_HUE_FALLOFF;
        }
      }

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = gateAlpha;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = gate.thickness;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;

      if (gate.type === CALIBRATION_GATE.TYPES.CHAIN) {
        const offset = gate.thickness * 2;
        ctx.lineWidth = gate.thickness;
        ctx.beginPath();
        ctx.moveTo(left.x + normal.x * offset, left.y + normal.y * offset);
        ctx.lineTo(right.x + normal.x * offset, right.y + normal.y * offset);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(left.x - normal.x * offset, left.y - normal.y * offset);
        ctx.lineTo(right.x - normal.x * offset, right.y - normal.y * offset);
        ctx.stroke();
      } else if (gate.type === CALIBRATION_GATE.TYPES.DISPLACEMENT) {
        ctx.lineWidth = gate.thickness * 2.8;
        ctx.beginPath();
        ctx.moveTo(left.x, left.y);
        ctx.lineTo(right.x, right.y);
        ctx.stroke();
      } else if (gate.type === CALIBRATION_GATE.TYPES.SHUTDOWN) {
        ctx.lineWidth = gate.thickness * 2.4;
        ctx.beginPath();
        ctx.moveTo(left.x, left.y);
        ctx.lineTo(right.x, right.y);
        ctx.stroke();
      } else if (gate.type === CALIBRATION_GATE.TYPES.EXIT) {
        ctx.lineWidth = gate.thickness * 1.4;
        const dashLen = gate.thickness * 4;
        const gap = gate.thickness * 3;
        const total = gate.width;
        let drawn = 0;
        while (drawn < total) {
          const seg = Math.min(dashLen, total - drawn);
          const t0 = drawn / total;
          const t1 = (drawn + seg) / total;
          ctx.beginPath();
          ctx.moveTo(left.x + (right.x - left.x) * t0, left.y + (right.y - left.y) * t0);
          ctx.lineTo(left.x + (right.x - left.x) * t1, left.y + (right.y - left.y) * t1);
          ctx.stroke();
          drawn += seg + gap;
        }
      }

      ctx.lineWidth = 2;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(left.x, left.y, poleRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(right.x, right.y, poleRadius, 0, Math.PI * 2);
      ctx.stroke();

      if (gate.type === CALIBRATION_GATE.TYPES.EXIT) {
        const notchSize = poleRadius * 0.45;
        const notchDir = { x: normal.x, y: normal.y };
        ctx.beginPath();
        ctx.moveTo(left.x + notchDir.x * notchSize, left.y + notchDir.y * notchSize);
        ctx.lineTo(left.x + axis.x * notchSize * 0.4, left.y + axis.y * notchSize * 0.4);
        ctx.lineTo(left.x - axis.x * notchSize * 0.4, left.y - axis.y * notchSize * 0.4);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(right.x + notchDir.x * notchSize, right.y + notchDir.y * notchSize);
        ctx.lineTo(right.x + axis.x * notchSize * 0.4, right.y + axis.y * notchSize * 0.4);
        ctx.lineTo(right.x - axis.x * notchSize * 0.4, right.y - axis.y * notchSize * 0.4);
        ctx.closePath();
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  function markStateDirty() {
    stateDirty = true;
  }

  function saveStateIfNeeded() {
    if (!gameState || !allowPersistence) {
      return;
    }
    if (!stateDirty) {
      return;
    }
    if (timeSpent - lastStateSave < 2) {
      return;
    }
    saveGameState(gameState);
    lastStateSave = timeSpent;
    stateDirty = false;
  }

  function updateSectorRivers(targetSector, shipPos = null) {
    if (!targetSector) {
      return;
    }
    const worldAgeMs = gameState?.worldAgeMs ?? 0;
    const worldAgeTicks = Math.floor(worldAgeMs / 1000);
    if (SPECIAL_SECTOR_TYPES.has(targetSector.sectorType)) {
      targetSector.runtimeRivers = [];
      targetSector.riversTick = worldAgeTicks;
      return;
    }
    if (RIVER.DISABLED_SECTOR_TYPES?.includes(targetSector.sectorType)) {
      targetSector.runtimeRivers = [];
      targetSector.riversTick = worldAgeTicks;
      return;
    }
    if (targetSector.riversTick === worldAgeTicks && Array.isArray(targetSector.runtimeRivers)) {
      return;
    }
    targetSector.runtimeRivers = getRiversForSector(
      sectorManager.worldSeed,
      worldAgeTicks,
      targetSector.sx,
      targetSector.sy,
      targetSector.bounds,
      targetSector.fieldType,
      shipPos
    );
    targetSector.riversTick = worldAgeTicks;
  }

  function pauseForLifeLoss(outcome) {
    if (deathPauseActive) {
      return;
    }
    deathPauseActive = true;
    setAutopilotActive(false, true);
    ship.stopThrustLoop();
    ship.stopRotateLoop();
    sounds.stopLoop("at_station");
    if (deathModal && typeof deathModal.close === "function") {
      deathModal.close();
    }
    deathModal = showShipDestroyedModal(uiRoot, lives, () => {
      deathPauseActive = false;
      deathModal = null;
      if (outcome === "respawn") {
        queueRespawn();
      } else if (outcome === "gameover") {
        endGame();
      }
    });
  }

  function handleLifeLoss(explosionType) {
    if (demoMode) {
      if (explosionType) {
        spawnExplosion(particles, ship.x, ship.y, explosionType);
      }
      lives = maxLives;
      shipVisible = true;
      respawn();
      return;
    }
    triggerShake(SHAKE.HIT);
    if (explosionType) {
      spawnExplosion(particles, ship.x, ship.y, explosionType);
    }
    lives -= 1;
    shipVisible = false;
    if (lives <= 0) {
      sounds.play("game_over");
      pauseForLifeLoss("gameover");
      return;
    }
    sounds.play("lost_life");
    pauseForLifeLoss("respawn");
  }

  function handleShipHit(explosionType) {
    if (demoMode) {
      handleLifeLoss(explosionType);
      return;
    }
    if (invulnTimer > 0 || !shipVisible) {
      return;
    }
    if (armor > 0) {
      armor = Math.max(0, armor - 1);
      invulnTimer = INVULN_DURATION;
      triggerShake(SHAKE.HIT);
      sounds.play("lost_life");
      if (gameState) {
        gameState.armor = armor;
        markStateDirty();
      }
      return;
    }
    handleLifeLoss(explosionType);
  }

  function pushLimited(list, entry, max) {
    if (!Array.isArray(list)) {
      return;
    }
    list.push(entry);
    if (list.length > max) {
      list.splice(0, list.length - max);
    }
  }

  function getSectorKey(sector) {
    return sector ? `${sector.sx},${sector.sy}` : "";
  }

  function ensureStationMetaForSector(sx, sy) {
    if (!Number.isFinite(sx) || !Number.isFinite(sy)) {
      return null;
    }
    const ring = Math.max(Math.abs(sx), Math.abs(sy));
    const existing = getSectorMeta(sectorIndex, sx, sy) ?? {};
    const info = getStationInfoForSector(sectorManager.worldSeed, sx, sy, ring);
    let updated = false;
    if (existing.hasStation === undefined) {
      existing.hasStation = Boolean(info?.hasStation);
      updated = true;
    }
    if (existing.hasStation) {
      if (!existing.stationId && info?.stationId) {
        existing.stationId = info.stationId;
        updated = true;
      }
      if (existing.stationTierCap === undefined) {
        existing.stationTierCap = info?.tierCap ?? null;
        updated = true;
      }
      if (!existing.stationPos) {
        const rng = createRng(sectorManager.getSectorSeed(sx, sy, SECTOR.SEED_SALT.STATION));
        const bounds = sectorManager.getBounds(sx, sy);
        const safePoint = {
          x: bounds.x + bounds.size / 2,
          y: bounds.y + bounds.size / 2
        };
        existing.stationPos = pickStationPosition(rng, bounds, safePoint, SECTOR.ENTRY_SAFE_RADIUS, existing.beaconPosition);
        updated = true;
      }
      if (existing.stationDiscovered === undefined) {
        existing.stationDiscovered = Boolean(info?.isStartStation);
        updated = true;
      }
    } else if (existing.stationDiscovered === undefined) {
      existing.stationDiscovered = false;
      updated = true;
    }
    if (updated) {
      setSectorMeta(sectorIndex, sx, sy, existing);
      if (allowPersistence) {
        saveSectorIndex(sectorIndex);
      }
    }
    return existing;
  }

  function updateStationDiscovery() {
    if (!sector) {
      return [];
    }
    const range = Math.floor(STATION.SCAN_RANGE_CELLS / 2);
    const markers = [];
    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        const sx = sector.sx + dx;
        const sy = sector.sy + dy;
        const meta = ensureStationMetaForSector(sx, sy);
        if (!meta?.hasStation || !meta.stationPos) {
          continue;
        }
        if (!meta.stationDiscovered) {
          meta.stationDiscovered = true;
          setSectorMeta(sectorIndex, sx, sy, meta);
          if (allowPersistence) {
            saveSectorIndex(sectorIndex);
          }
        }
        markers.push({
          x: meta.stationPos.x,
          y: meta.stationPos.y,
          sx,
          sy
        });
      }
    }
    return markers;
  }

  function ensureSectorMeta(sector) {
    if (!sector) {
      return null;
    }
    const meta = getSectorMeta(sectorIndex, sector.sx, sector.sy);
    if (meta) {
      return meta;
    }
      const fallback = {
        sectorType: sector.sectorType ?? SECTOR_TYPES.GENERIC,
        sectorMood: sector.sectorMood ?? "NEUTRAL",
        beaconPlaced: Boolean(sector.beacon),
        beaconPosition: sector.beacon ? { x: sector.beacon.x, y: sector.beacon.y } : null,
        hasStation: Boolean(sector.station),
        stationId: sector.station?.id ?? null,
        stationPos: sector.station ? { x: sector.station.x, y: sector.station.y } : null,
        stationDiscovered: Boolean(sector.station?.discovered),
        stationTierCap: sector.station?.tierCap ?? null,
        generatedAtExposure: Math.max(0, gameState?.beacon?.exposure ?? 0),
        visited: false,
        surveyComplete: false,
        lastVisitedAt: null,
        anomalyModifier: sector.anomalyModifier ?? null,
      echoTag: sector.echoTag ?? null,
      patternId: sector.patternId ?? null,
      patternParamsSeed: Number.isFinite(sector.patternParamsSeed) ? sector.patternParamsSeed : null,
      patternVersion: Number.isFinite(sector.patternVersion) ? sector.patternVersion : null
    };
    setSectorMeta(sectorIndex, sector.sx, sector.sy, fallback);
    if (allowPersistence) {
      saveSectorIndex(sectorIndex);
    }
    return fallback;
  }

  function updateSectorMeta(sector, updater) {
    const meta = ensureSectorMeta(sector);
    if (!meta) {
      return null;
    }
    updater(meta);
    setSectorMeta(sectorIndex, sector.sx, sector.sy, meta);
    if (allowPersistence) {
      saveSectorIndex(sectorIndex);
    }
    return meta;
  }

  function isActiveMotif(motif) {
    return motif === "INVOCATION" || motif === "RESPONSE";
  }

  function updateBeaconSignal(dt, observing) {
    const cycle = BEACON.SIGNAL_CYCLE;
    const step = dt / cycle;
    beaconSignal.phase = (beaconSignal.phase + step) % 1;
    const phase = beaconSignal.phase;
    if (phase < 0.25) {
      beaconSignal.motif = "INVOCATION";
    } else if (phase < 0.5) {
      beaconSignal.motif = "RESPONSE";
    } else if (phase < 0.75) {
      beaconSignal.motif = "DRIFT";
    } else {
      beaconSignal.motif = "FRACTURE";
    }
    const pulseRate = observing ? 3.1 : 2.4;
    const pulse = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2 * pulseRate);
    beaconSignal.strength = 0.35 + 0.65 * pulse;
  }

  function applyBeaconExposure(delta) {
    if (!gameState?.beacon) {
      return;
    }
    gameState.beacon.exposure = Math.max(0, (gameState.beacon.exposure ?? 0) + delta);
    markStateDirty();
  }

  function shouldHedge(exposure) {
    return exposure >= 0.6;
  }

  function hedgeText(text, exposure) {
    if (!shouldHedge(exposure)) {
      return text;
    }
    const hedges = [
      `Signal suggests: ${text}`,
      `Uncertain reading: ${text}`,
      `Appears consistent with: ${text}`
    ];
    const index = Math.floor(((exposure * 10) % hedges.length));
    return hedges[index];
  }

  function getSectorAlert(sector, meta, exposure) {
    if (!sector || !meta) {
      return null;
    }
    const type = meta.sectorType ?? sector.sectorType ?? SECTOR_TYPES.GENERIC;
    if (meta.surveyComplete && type !== SECTOR_TYPES.SIGNAL_ORIGIN) {
      return null;
    }
    if (type === SECTOR_TYPES.GENERIC) {
      return null;
    }
    if (type === SECTOR_TYPES.SIGNAL_ORIGIN) {
      return hedgeText("Signal origin detected.", exposure);
    }
    if (type === SECTOR_TYPES.DEAD_QUIET) {
      return hedgeText("Dead quiet sector.", exposure);
    }
    if (type === SECTOR_TYPES.DERELICT_FIELD) {
      return hedgeText("Derelict field signatures.", exposure);
    }
    if (type === SECTOR_TYPES.ANOMALY) {
      return hedgeText("Anomalous scan return.", exposure);
    }
    if (type === SECTOR_TYPES.ECHO) {
      if (meta.echoTag) {
        return hedgeText(`Echo pattern aligns with ${meta.echoTag}.`, exposure);
      }
      return hedgeText("Echo signatures detected.", exposure);
    }
    return null;
  }

  function getAnomalyEffects(sector, timeMs) {
    if (!sector?.anomalyModifier) {
      return null;
    }
    const t = timeMs * 0.001;
    const modifier = sector.anomalyModifier;
    if (modifier === "SCANNER_JITTER") {
      return {
        jitter: Math.sin(t * 6.2) * 0.06
      };
    }
    if (modifier === "RANGE_DRIFT") {
      return {
        radiusOffset: Math.sin(t * 0.8) * 6,
        rangeScale: 1 + Math.sin(t * 0.6) * 0.04
      };
    }
    if (modifier === "ORIENTATION_DRIFT") {
      return {
        angleOffset: Math.sin(t * 0.35) * 0.08
      };
    }
    if (modifier === "PULSE_GHOSTS") {
      return {
        ghostPulse: 0.5 + 0.5 * Math.sin(t * 2.4)
      };
    }
    return null;
  }

  function triggerShake(strength, duration = SHAKE.DURATION) {
    shakeStrength = Math.max(shakeStrength, strength);
    shakeTime = Math.max(shakeTime, duration);
    shakeDuration = Math.max(shakeDuration, duration);
  }

  function updateShake(dt) {
    if (shakeTime > 0) {
      shakeTime = Math.max(0, shakeTime - dt);
      const fade = shakeDuration > 0 ? shakeTime / shakeDuration : 0;
      const intensity = shakeStrength * fade;
      camera.shakeX = (Math.random() * 2 - 1) * intensity;
      camera.shakeY = (Math.random() * 2 - 1) * intensity;
      if (shakeTime === 0) {
        shakeStrength = 0;
        shakeDuration = 0;
      }
    } else {
      camera.shakeX = 0;
      camera.shakeY = 0;
    }
  }

  function scheduleNextBackgroundEvent(now) {
    nextBackgroundEvent = now + randomRange(BACKGROUND_EVENTS.MIN_INTERVAL, BACKGROUND_EVENTS.MAX_INTERVAL);
  }

  function rollBackgroundType() {
    const typeRoll = Math.random();
    if (typeRoll < 0.2) return "supernova";
    if (typeRoll < 0.4) return "nebulaBurst";
    if (typeRoll < 0.62) return "meteor";
    if (typeRoll < 0.76) return "warp";
    if (typeRoll < 0.88) return "quasar";
    if (typeRoll < 0.92) return "neonRibbon";
    if (typeRoll < 0.96) return "jellySlab";
    return "chromaEddy";
  }

  function pickBackgroundType() {
    let type = rollBackgroundType();
    for (let i = 0; i < 4 && backgroundRecent.includes(type); i++) {
      type = rollBackgroundType();
    }
    backgroundRecent.push(type);
    if (backgroundRecent.length > 3) {
      backgroundRecent.shift();
    }
    return type;
  }

  function buildBackgroundEvent(type, now, posX, posY, scale = 1) {
    const driftAngle = randomRange(0, Math.PI * 2);
    const driftSpeed = randomRange(4, 16) * scale;
    const parallax = randomRange(0.04, 0.1);
    const worldX = ship.x + (posX - canvas.width / 2) / (camera.zoom * parallax);
    const worldY = ship.y + (posY - canvas.height / 2) / (camera.zoom * parallax);
    const base = {
      type,
      start: now,
      duration: randomRange(2.5, 8.5) * scale,
      worldX,
      worldY,
      driftX: Math.cos(driftAngle) * driftSpeed,
      driftY: Math.sin(driftAngle) * driftSpeed,
      parallax,
      colors: [pickPsycheColor(), pickPsycheColor(), pickPsycheColor()]
    };

    if (type === "quasar") {
      base.duration = randomRange(2.8, 4.6) * scale;
      base.angle = randomRange(0, Math.PI * 2);
      base.length = randomRange(420, 900) * scale;
      base.width = randomRange(2, 4) * scale;
    } else if (type === "supernova") {
      base.duration = randomRange(6, 10) * scale;
      base.radius = randomRange(40, 120) * scale;
      base.maxRadius = base.radius + randomRange(180, 320) * scale;
    } else if (type === "nebulaBurst") {
      base.duration = randomRange(4.5, 8) * scale;
      base.radius = randomRange(120, 260) * scale;
      base.rotation = randomRange(0, Math.PI * 2);
    } else if (type === "meteor") {
      base.duration = randomRange(1.6, 2.8) * scale;
      base.angle = randomRange(0, Math.PI * 2);
      base.length = randomRange(140, 260) * scale;
      base.travel = randomRange(220, 420) * scale;
      base.count = Math.max(1, Math.floor(randomRange(2, 5) * scale));
    } else if (type === "warp") {
      base.duration = randomRange(2.2, 4.4) * scale;
      base.radius = randomRange(60, 140) * scale;
      base.maxRadius = base.radius + randomRange(220, 420) * scale;
    } else if (type === "neonRibbon") {
      base.duration = randomRange(7, 12) * scale;
      base.angle = randomRange(0, Math.PI * 2);
      base.length = randomRange(240, 520) * scale;
      base.width = randomRange(10, 20) * scale;
      base.bend = randomRange(18, 52) * scale;
      base.phase = randomRange(0, Math.PI * 2);
    } else if (type === "jellySlab") {
      base.duration = randomRange(8, 14) * scale;
      base.width = randomRange(140, 280) * scale;
      base.height = randomRange(70, 150) * scale;
      base.rotation = randomRange(0, Math.PI * 2);
      base.phase = randomRange(0, Math.PI * 2);
    } else if (type === "chromaEddy") {
      base.duration = randomRange(9, 16) * scale;
      base.radius = randomRange(60, 150) * scale;
      base.orbCount = Math.max(3, Math.floor(randomRange(3, 6)));
      base.orbSize = randomRange(12, 26) * scale;
      base.spin = randomRange(-0.7, 0.7);
      base.phase = randomRange(0, Math.PI * 2);
    }

    return base;
  }

  function spawnBackgroundEvent(now) {
    if (backgroundEvents.length >= BACKGROUND_EVENTS.MAX_ACTIVE) {
      scheduleNextBackgroundEvent(now);
      return;
    }
    const type = pickBackgroundType();
    const margin = BACKGROUND_EVENTS.EDGE_MARGIN;
    const posX = randomRange(margin, canvas.width - margin);
    const posY = randomRange(margin, canvas.height - margin);
    backgroundEvents.push(buildBackgroundEvent(type, now, posX, posY, 1));
    if (Math.random() < BACKGROUND_EVENTS.CLUSTER_CHANCE) {
      const count = Math.floor(randomRange(BACKGROUND_EVENTS.CLUSTER_MIN, BACKGROUND_EVENTS.CLUSTER_MAX + 1));
      for (let i = 0; i < count; i++) {
        if (backgroundEvents.length >= BACKGROUND_EVENTS.MAX_ACTIVE) {
          break;
        }
        const offsetAngle = randomRange(0, Math.PI * 2);
        const offsetDist = randomRange(40, BACKGROUND_EVENTS.CLUSTER_OFFSET);
        const clusterX = posX + Math.cos(offsetAngle) * offsetDist;
        const clusterY = posY + Math.sin(offsetAngle) * offsetDist;
        const clusterScale = randomRange(0.55, 0.85);
        backgroundEvents.push(buildBackgroundEvent(type, now, clusterX, clusterY, clusterScale));
      }
    }
    scheduleNextBackgroundEvent(now);
  }

  function updateBackgroundEvents(dt) {
    backgroundClock += dt;
    if (backgroundClock >= nextBackgroundEvent) {
      spawnBackgroundEvent(backgroundClock);
    }
    for (let i = backgroundEvents.length - 1; i >= 0; i--) {
      const evt = backgroundEvents[i];
      if (backgroundClock > evt.start + evt.duration) {
        backgroundEvents.splice(i, 1);
      }
    }
  }

  scheduleNextBackgroundEvent(0);

  function spawnThrustParticles(dt) {
    const thrust = ship.thrusting;
    const thrustPower = Math.min(1, Math.abs(thrust));
    if (thrustPower <= 0) {
      thrustParticleCarry = 0;
      return;
    }
    const rate = THRUST_PARTICLES.RATE * thrustPower;
    thrustParticleCarry += dt * rate;
    const fx = Math.sin(ship.heading);
    const fy = -Math.cos(ship.heading);
    const baseX = ship.x - fx * THRUST_PARTICLES.OFFSET;
    const baseY = ship.y - fy * THRUST_PARTICLES.OFFSET;
    const sideX = -fy;
    const sideY = fx;
    while (thrustParticleCarry >= 1) {
      const sideOffset = (Math.random() - 0.5) * 5;
      const angle = ship.heading + Math.PI / 2
        + (Math.random() - 0.5) * THRUST_PARTICLES.SPREAD;
      const speed = THRUST_PARTICLES.SPEED_MIN
        + Math.random() * (THRUST_PARTICLES.SPEED_MAX - THRUST_PARTICLES.SPEED_MIN);
      const life = THRUST_PARTICLES.LIFE_MIN
        + Math.random() * (THRUST_PARTICLES.LIFE_MAX - THRUST_PARTICLES.LIFE_MIN);
      const size = THRUST_PARTICLES.SIZE_MIN
        + Math.random() * (THRUST_PARTICLES.SIZE_MAX - THRUST_PARTICLES.SIZE_MIN);
      particles.push(
        new Particle(
          baseX + sideX * sideOffset,
          baseY + sideY * sideOffset,
          angle,
          speed * (0.5 + thrustPower * 0.5),
          life,
          "rgba(120, 200, 190, 0.6)",
          size
        )
      );
      thrustParticleCarry -= 1;
    }
  }

  function spawnTrailSparks(dt, speed) {
    if (speed < 40) {
      trailSparkCarry = 0;
      return;
    }
    const speedRatio = Math.min(1, speed / TRAIL_COLOR.SPEED);
    const rate = TRAIL_SPARKS.RATE * speedRatio;
    trailSparkCarry += dt * rate;
    const dirX = ship.vx / speed;
    const dirY = ship.vy / speed;
    const baseX = ship.x - dirX * TRAIL_SPARKS.OFFSET;
    const baseY = ship.y - dirY * TRAIL_SPARKS.OFFSET;
    const angleBase = Math.atan2(dirY, dirX) + Math.PI;

    while (trailSparkCarry >= 1) {
      const angle = angleBase + (Math.random() - 0.5) * TRAIL_SPARKS.SPREAD;
      const velocity = TRAIL_SPARKS.SPEED_MIN
        + Math.random() * (TRAIL_SPARKS.SPEED_MAX - TRAIL_SPARKS.SPEED_MIN);
      const life = TRAIL_SPARKS.LIFE_MIN
        + Math.random() * (TRAIL_SPARKS.LIFE_MAX - TRAIL_SPARKS.LIFE_MIN);
      const size = TRAIL_SPARKS.SIZE_MIN
        + Math.random() * (TRAIL_SPARKS.SIZE_MAX - TRAIL_SPARKS.SIZE_MIN);
      particles.push(
        new Particle(
          baseX,
          baseY,
          angle,
          velocity,
          life,
          "rgba(160, 210, 200, 0.7)",
          size
        )
      );
      trailSparkCarry -= 1;
    }
  }

  queueAlert("Scan the sector, but watch your fuel!", 0, ALERT.DURATION * 1.5);

  function updateAlerts(dt) {
    alertClock += dt;
    for (let i = alerts.length - 1; i >= 0; i--) {
      const alert = alerts[i];
      if (alertClock > alert.start + alert.duration) {
        alerts.splice(i, 1);
      }
    }
  }

  function updateIntro(dt, activeStars, simulationIsRunning, starAccel = null) {
    if (!intro.enabled || !INTRO || !simulationIsRunning) {
      return;
    }
    intro.clock += dt;

    for (let i = intro.highlightQueue.length - 1; i >= 0; i--) {
      const entry = intro.highlightQueue[i];
      if (alertClock >= entry.start) {
        triggerIntroHighlight(entry.key, entry.duration);
        intro.highlightQueue.splice(i, 1);
      }
    }
    if (intro.releaseAlertsAt !== null && alertClock >= intro.releaseAlertsAt) {
      intro.suppressAlerts = false;
      intro.releaseAlertsAt = null;
    }

    for (const key of Object.keys(intro.highlights)) {
      if (intro.highlights[key] > 0) {
        intro.highlights[key] = Math.max(0, intro.highlights[key] - dt);
      }
    }

    if (!intro.flags.systems && intro.clock >= INTRO.START_DELAY) {
      scheduleIntroAlert("systems", "There were once signs of life in this galaxy.");
    }

    if (!intro.flags.goals && intro.controlUsed) {
      scheduleIntroAlert("goals", "Find the clues to unravel the mystery of what became of them.", {
        highlightKeys: ["goal", "exit"],
        highlightDuration: INTRO.HIGHLIGHT_DURATION
      });
    }

    if (!intro.flags.score && (intro.firstSurveyComplete || intro.clock >= INTRO.SCORE_TIMEOUT)) {
      scheduleIntroAlert("score", "Momentum matters. Chains and distance amplify score.", {
        highlightKeys: ["score"],
        highlightDuration: INTRO.HIGHLIGHT_DURATION
      });
    }

    if (!intro.flags.fuel && ship.maxFuel > 0) {
      const ratio = ship.fuel / ship.maxFuel;
      if (ratio <= INTRO.FUEL_RATIO) {
        scheduleIntroAlert("fuel", "Fuel is freedom. Drift wisely.", {
          highlightKeys: ["fuel"],
          highlightDuration: INTRO.HIGHLIGHT_DURATION
        });
      }
    }

    const ring = Math.max(Math.abs(sector?.sx ?? 0), Math.abs(sector?.sy ?? 0));
    if (!intro.flags.weird && (intro.sectorTransitions >= 1 || ring >= 1)) {
      scheduleIntroAlert("weird", "Space is not uniform. Patterns emerge further out.", {
        highlightKeys: ["vignette"],
        highlightDuration: INTRO.VIGNETTE_DURATION
      });
    }

    if (!intro.flags.rivers) {
      const riverInfo = getClosestRiverInfo(ship, sector?.runtimeRivers ?? []);
      if (riverInfo && riverInfo.dist < (riverInfo.width / 2)) {
        scheduleIntroAlert("rivers", "Currents shape the motion of the skies.", {
          highlightKeys: ["river"],
          highlightDuration: INTRO.RIVER_HIGHLIGHT_DURATION
        });
      }
    }

    if (!intro.flags.stars && Array.isArray(activeStars) && activeStars.length > 0) {
      const accel = starAccel ?? computeStarAccelAt(ship, activeStars, CONFIG);
      const accelMag = Math.hypot(accel.ax, accel.ay);
      if (accelMag >= INTRO.STAR_PULL_ACCEL) {
        scheduleIntroAlert("stars", "Stars bend paths. Disdain their power at your peril.");
      }
    }

    if (!intro.flags.distance && intro.sectorTransitions >= INTRO.LONGRUN_TRANSITIONS) {
      scheduleIntroAlert("distance", "Space is endless and without limit, but it is far from featureless.", {
        highlightKeys: ["score"],
        highlightDuration: INTRO.HIGHLIGHT_DURATION,
        releaseAlerts: true
      });
    }

    if (!intro.flags.anomaly && sector?.sectorType === SECTOR_TYPES.ANOMALY) {
      scheduleIntroAlert("anomaly", "Sometimes things are strange because they were made that way.");
    }
    if (!intro.flags.echo && sector?.sectorType === SECTOR_TYPES.ECHO) {
      scheduleIntroAlert("echo", "The stars whisper to each other. Can you hear them?");
    }
    if (!intro.flags.movingStars && Array.isArray(activeStars) && activeStars.some((star) => star.motion)) {
      scheduleIntroAlert("movingStars", "Even stars cannot always hold still.");
    }
    if (!intro.flags.station && sector?.station) {
      scheduleIntroAlert("station", "Sometimes in the cold vacuum, there is help.");
    }
  }

  function updateScorePopups(dt) {
    if (scorePopups.length === 0) {
      return;
    }
    for (let i = scorePopups.length - 1; i >= 0; i--) {
      const popup = scorePopups[i];
      popup.age += dt;
      if (popup.age >= popup.life) {
        scorePopups.splice(i, 1);
      }
    }
  }

  function spawnImpactRing(x, y, scale = 1) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return;
    }
    impactRings.push({
      x,
      y,
      age: 0,
      life: OBJECT_EXPLOSION_RING_LIFE,
      maxRadius: OBJECT_EXPLOSION_RING_BASE * scale,
      width: OBJECT_EXPLOSION_RING_WIDTH,
      color: OBJECT_EXPLOSION_RING_COLOR
    });
  }

  function updateImpactRings(dt) {
    if (impactRings.length === 0) {
      return;
    }
    for (let i = impactRings.length - 1; i >= 0; i--) {
      const ring = impactRings[i];
      ring.age += dt;
      if (ring.age >= ring.life) {
        impactRings.splice(i, 1);
      }
    }
  }

  function drawImpactRings(ctx) {
    if (impactRings.length === 0) {
      return;
    }
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const ring of impactRings) {
      const t = ring.life > 0 ? clampValue(ring.age / ring.life, 0, 1) : 1;
      const radius = ring.maxRadius * (0.2 + 0.8 * t);
      const alpha = 1 - t;
      ctx.strokeStyle = ring.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = ring.width;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function loop(time) {
    if (!running) {
      return;
    }
    const dt = Math.min((time - lastTime) / 1000, 0.033);
    lastTime = time;

    update(dt);
    if (!running) {
      return;
    }
    render();

    rafId = requestAnimationFrame(loop);
  }

  function update(dt) {
    updateParticles(particles, dt);
    updateEnemyPings(enemyPings, dt);
    updateAlerts(dt);
    updateTutorial();
    updateScorePopups(dt);
    updateImpactRings(dt);
    updateShake(dt);
    updateBackgroundEvents(dt);
    if (controlsDisabledTimer > 0) {
      controlsDisabledTimer = Math.max(0, controlsDisabledTimer - dt);
    }
    const simulationIsRunning = !deathPauseActive && !pendingGameOver && respawnTimer <= 0;
    if (simulationIsRunning && gameState) {
      const dtMs = Math.max(0, Math.round(dt * 1000));
      if (dtMs > 0) {
        gameState.worldAgeMs = (gameState.worldAgeMs ?? 0) + dtMs;
        markStateDirty();
      }
    }
    if (deathPauseActive) {
      saveStateIfNeeded();
      return;
    }
    if (pendingGameOver) {
      gameOverTimer = Math.max(0, gameOverTimer - dt);
      if (gameOverTimer === 0) {
        finalizeGameOver();
      }
      saveStateIfNeeded();
      return;
    }
    if (respawnTimer > 0) {
      respawnTimer = Math.max(0, respawnTimer - dt);
      if (respawnTimer === 0) {
        respawn();
        shipVisible = true;
      }
      saveStateIfNeeded();
      return;
    }
    const controlsDisabled = controlsDisabledTimer > 0 || docked;
    const inputBlocked = controlsDisabledTimer > 0;
    if (autopilotFirePause > 0) {
      autopilotFirePause = Math.max(0, autopilotFirePause - dt);
    }
    if (autopilotThrustBurst > 0) {
      autopilotThrustBurst = Math.max(0, autopilotThrustBurst - dt);
      if (autopilotThrustBurst === 0) {
        autopilotThrustCooldown = AUTOPILOT.THRUST.BURST_COOLDOWN;
      }
    } else if (autopilotThrustCooldown > 0) {
      autopilotThrustCooldown = Math.max(0, autopilotThrustCooldown - dt);
    }
    const autopilotEngaged = autopilotActive && !inputBlocked && !docked;
    let cachedStarAccel = null;
    let externalInput = null;
    let autopilotFire = false;
    let keyboardRotationInput = 0;
    let keyboardThrustInput = 0;
    let shipInSafeZone = false;
    let shipFullyInsideSafeZone = false;
    const touchBlocksMouseAim = touch.isActive || touch.lastAimAngle !== null;
    if (!inputBlocked && !autopilotEngaged) {
      if (!touchBlocksMouseAim && mouseAimEnabled && mouse.hasMoved) {
        const centerX = canvas.width / 2 + camera.shakeX;
        const centerY = canvas.height / 2 + camera.shakeY;
        const worldX = (mouse.x - centerX) / camera.zoom + ship.x;
        const worldY = (mouse.y - centerY) / camera.zoom + ship.y;
        const dx = worldX - ship.x;
        const dy = worldY - ship.y;
        if (keyboardRotationInput === 0) {
          externalInput = externalInput || {};
          externalInput.aimAngle = Math.atan2(dx, -dy);
        }
        if (mouse.rightDown && keyboardThrustInput === 0) {
          externalInput = externalInput || {};
          externalInput.thrustInput = 1;
        }
      }
      if (touch.aimId !== null) {
        const centerX = canvas.width / 2 + camera.shakeX;
        const centerY = canvas.height / 2 + camera.shakeY;
        const dx = touch.aimX - centerX;
        const dy = touch.aimY - centerY;
        if (Math.hypot(dx, dy) > 0.001 && keyboardRotationInput === 0) {
          externalInput = externalInput || {};
          externalInput.aimAngle = Math.atan2(dx, -dy);
          touch.lastAimAngle = externalInput.aimAngle;
        }
      } else if (touch.lastAimAngle !== null && keyboardRotationInput === 0) {
        externalInput = externalInput || {};
        externalInput.aimAngle = touch.lastAimAngle;
      }
      if (touch.thrustId !== null && keyboardThrustInput === 0) {
        externalInput = externalInput || {};
        externalInput.thrustInput = 1;
      }
    }
      if (autopilotEngaged) {
        const autopilotStations = getActiveStations();
        const autopilotStars = activeSectors.flatMap((s) => s.stars);
        const autopilotResult = computeAutopilotInput(dt, autopilotStars, autopilotStations, cachedStarAccel);
        externalInput = {
          rotationInput: autopilotResult.rotationInput,
          thrustInput: autopilotResult.thrustInput
        };
        autopilotFire = autopilotResult.fire;
        cachedStarAccel = autopilotResult.starAccel ?? cachedStarAccel;
      } else if (controlsDisabled) {
        externalInput = { disableControls: true };
      }
      if (intro.enabled && !inputBlocked && !autopilotEngaged) {
        const manualInputUsed = keyboardRotationInput !== 0
          || keyboardThrustInput !== 0
          || (externalInput && (
            externalInput.thrustInput !== undefined
            || externalInput.rotationInput !== undefined
            || Number.isFinite(externalInput.aimAngle)
          ));
        if (manualInputUsed) {
          intro.controlUsed = true;
        }
      }
      if (tutorial.active && !inputBlocked && !autopilotEngaged) {
        if (keyboardRotationInput !== 0 || Number.isFinite(externalInput?.aimAngle)
          || mouse.hasMoved || touch.aimId !== null || touch.lastAimAngle !== null) {
          tutorial.flags.aimed = true;
        }
        if (keyboardThrustInput !== 0 || externalInput?.thrustInput) {
          tutorial.flags.thrusted = true;
        }
      }
      ship.update(dt, externalInput);
    applyGateCorrection(dt);
    spawnThrustParticles(dt);
    timeSpent += dt;
    if (invulnTimer > 0) {
      invulnTimer = Math.max(0, invulnTimer - dt);
    }
    if (fireCooldown > 0) {
      fireCooldown = Math.max(0, fireCooldown - dt);
    }
    if (fireLockout > 0) {
      fireLockout = Math.max(0, fireLockout - dt);
    }
    if (scorePulse > 0) {
      scorePulse = Math.max(0, scorePulse - dt * 2.6);
    }

    sector = sectorManager.getSectorForPosition(ship.x, ship.y);
    activeSectors = sectorManager.getSectorsAround(ship.x, ship.y, ACTIVE_SECTOR_RANGE);
    for (const activeSector of activeSectors) {
      const shipPos = activeSector === sector ? { x: ship.x, y: ship.y } : null;
      updateSectorRivers(activeSector, shipPos);
      updateSectorOcclusion(activeSector, dt);
    }
    sectorManager.pruneOutsideRange(
      Math.floor(ship.x / SECTOR_SIZE),
      Math.floor(ship.y / SECTOR_SIZE),
      SECTOR_CACHE_RANGE
    );
    stationMarkers = updateStationDiscovery();
    const activeStations = getActiveStations();
    const activeStars = activeSectors.flatMap((s) => s.stars);
    updateBullets(bullets, dt, activeSectors, activeStars, activeStations);
    updateEnemyBullets(
      enemyBullets,
      enemies,
      ship,
      SHIP_RADIUS,
      invulnTimer,
      shipVisible,
      handleShipHit,
      dt,
      activeSectors,
      activeStars,
      activeStations
    );
      for (const activeSector of activeSectors) {
        if (activeSector.apseInterior && typeof activeSector.apseInterior.absorbProjectiles === "function") {
          activeSector.apseInterior.absorbProjectiles(bullets);
          activeSector.apseInterior.absorbProjectiles(enemyBullets);
        }
      }
      removeProjectilesByMeridian(bullets, activeSectors);
      removeProjectilesByMeridian(enemyBullets, activeSectors);

    const currentStation = sector?.station ?? null;
    let stationDx = 0;
    let stationDy = 0;
    let stationDist = 0;
    let stationSafeRadius = 0;
    if (currentStation) {
      stationDx = ship.x - currentStation.x;
      stationDy = ship.y - currentStation.y;
      stationDist = Math.hypot(stationDx, stationDy);
      stationSafeRadius = currentStation.safeRadius ?? STATION.SAFE_ZONE_RADIUS;
      shipInSafeZone = stationDist <= stationSafeRadius;
      shipFullyInsideSafeZone = stationDist <= (stationSafeRadius - SHIP_RADIUS);
    }
    if (!shipInSafeZone) {
      stationEntryLockId = null;
    }
    const interactTriggered = Boolean(interactPressed);
    interactPressed = false;

    if (!docked && currentStation && shipFullyInsideSafeZone && stationEntryLockId !== currentStation.id) {
      stationEntryLockId = currentStation.id;
      setAutopilotActive(false, true);
      docked = true;
      dockStation = currentStation;
      const dist = stationDist || 1;
      const dirX = dist > 0 ? stationDx / dist : Math.sin(ship.heading);
      const dirY = dist > 0 ? stationDy / dist : -Math.cos(ship.heading);
      const targetDist = Math.max(0, stationSafeRadius - SHIP_RADIUS - 1);
      ship.x = currentStation.x + dirX * targetDist;
      ship.y = currentStation.y + dirY * targetDist;
      ship.vx = 0;
      ship.vy = 0;
      ship.stopThrustLoop();
      ship.stopRotateLoop();
      ship.thrusting = 0;
      openUpgradeModal(currentStation);
    }

    if (docked) {
      if (!currentStation || dockStation?.id !== currentStation.id) {
        docked = false;
        dockStation = null;
        closeUpgradeModal();
      } else if (interactTriggered) {
        docked = false;
        dockStation = null;
        closeUpgradeModal();
      }
    }
    if (interactButton) {
      interactButton.style.display = docked ? "block" : "none";
    }
    if (shipInSafeZone) {
      sounds.startLoop("at_station", 2, 0.2);
    } else {
      sounds.stopLoop("at_station");
    }

    const collectorStats = getCollectorStats(upgradeLevels.collectorLevel);
    applyCollectorPull(fuelPickups, collectorStats, dt);
    applyCollectorPull(resourcePickups, collectorStats, dt);
    applyCollectorPull(upgradePickups, collectorStats, dt);

    const viewRadius = getViewRadius(canvas, camera);
    if (activeGates.length === 0) {
      gateSpawnTimer -= dt;
      if (gateSpawnTimer <= 0) {
        const spawned = createGate(viewRadius);
        if (Array.isArray(spawned) && spawned.length > 0) {
          activeGates = spawned;
          chainProgress = 0;
        }
        const spawnScale = clampValue(
          viewRadius / CALIBRATION_GATE.BASE_VIEW_RADIUS,
          0.7,
          1.6
        );
        gateSpawnTimer = randomRange(CALIBRATION_GATE.SPAWN_MIN, CALIBRATION_GATE.SPAWN_MAX) * spawnScale;
      }
    }

    const sectorKey = getSectorKey(sector);
    if (sectorKey && sectorKey !== lastSectorKey) {
      const previousSector = lastSectorRef;
      const enteringQuietReach = sector?.sectorType === SECTOR_TYPES.QUIET_REACH;
      if (enteringQuietReach !== quietReachAudioActive) {
        applyQuietReachAudio(enteringQuietReach);
      }
      const sectorCenter = getSectorCenter(sector.sx, sector.sy);
      const sectorDistance = Math.hypot(sectorCenter.x - originX, sectorCenter.y - originY);
      if (!farthestSector || sectorDistance > farthestSector.distance) {
        farthestSector = { sx: sector.sx, sy: sector.sy, distance: sectorDistance };
      }
      if (lastSectorRef && wasInBeaconZone && wasInActiveMotif && lastSectorRef.sectorType === SECTOR_TYPES.SIGNAL_ORIGIN) {
        if (gameState?.beacon) {
          gameState.beacon.leftMidCycleCount = (gameState.beacon.leftMidCycleCount ?? 0) + 1;
          applyBeaconExposure(-BEACON.MIDCYCLE_PENALTY);
        }
      }

      const meta = updateSectorMeta(sector, (entry) => {
        entry.visited = true;
        entry.lastVisitedAt = Date.now();
      });
      const exposure = gameState?.beacon?.exposure ?? 0;
      const alertText = getSectorAlert(sector, meta, exposure);
      if (alertText) {
        queueAlert(alertText, 0, ALERT.DURATION * 1.2);
      }
      if (gameState) {
        gameState.furthestRing = Math.max(gameState.furthestRing ?? 0, sector.ring ?? 0);
        if (!gameState.history) {
          gameState.history = { recentSectors: [], recentSurveys: [], recentBeaconVisits: [] };
        }
        pushLimited(gameState.history.recentSectors, {
          id: sectorKey,
          ring: sector.ring,
          type: sector.sectorType
        }, 20);
        markStateDirty();
      }

      if (previousSector) {
        lastTravelSectorRef = previousSector;
      }
      lastSectorKey = sectorKey;
      lastSectorRef = sector;
    }

    if (beaconScanPenalty > 0) {
      beaconScanPenalty = Math.max(0, beaconScanPenalty - dt);
    }

    let inBeaconZone = false;
    if (sector?.beacon) {
      const dx = ship.x - sector.beacon.x;
      const dy = ship.y - sector.beacon.y;
      const dist = Math.hypot(dx, dy);
      const radius = Number.isFinite(sector.beacon.radius) ? sector.beacon.radius : BEACON.OBSERVER_RADIUS;
      inBeaconZone = dist <= radius;
      updateBeaconSignal(dt, inBeaconZone);

      if (inBeaconZone) {
        if (!wasInBeaconZone) {
          const now = Date.now();
          const lastVisit = gameState?.history?.recentBeaconVisits?.slice(-1)[0];
          const lastTime = Number.isFinite(lastVisit?.at) ? lastVisit.at : 0;
          const cooldownOk = (now - lastTime) / 1000 >= BEACON.VISIT_COOLDOWN;
          if (gameState?.beacon) {
            gameState.beacon.visitCount = (gameState.beacon.visitCount ?? 0) + 1;
            if (cooldownOk) {
              applyBeaconExposure(BEACON.RETURN_BONUS);
            }
          }
          if (gameState?.history) {
            pushLimited(gameState.history.recentBeaconVisits, { id: sectorKey, at: now }, 30);
          }
          markStateDirty();
        }

        if (gameState?.beacon) {
          const penalty = beaconScanPenalty > 0 ? 0.6 : 1;
          gameState.beacon.totalObservedSeconds = (gameState.beacon.totalObservedSeconds ?? 0) + dt;
          applyBeaconExposure(dt * BEACON.OBSERVE_RATE * penalty);
        }
      }
    } else {
      beaconSignal.strength = 0;
    }

    wasInBeaconZone = inBeaconZone;
    wasInActiveMotif = isActiveMotif(beaconSignal.motif);

    const palimpsestFragments = collectPalimpsestFragments(activeSectors);
    const palimpsestSingularities = collectPalimpsestSingularities(activeStars);
    const needsStarAccelForIntro = intro.enabled
      && !intro.flags.stars
      && Array.isArray(activeStars)
      && activeStars.length > 0;
    if (!cachedStarAccel && (needsStarAccelForIntro || DEBUG.VECTORS)) {
      cachedStarAccel = computeStarAccelAt(ship, activeStars, CONFIG);
    }
    updateIntro(dt, activeStars, simulationIsRunning, cachedStarAccel);
    const worldAgeMs = gameState?.worldAgeMs ?? 0;
    const worldAgeSeconds = worldAgeMs / 1000;
    for (let i = fuelPickups.length - 1; i >= 0; i--) {
      const pickup = fuelPickups[i];
      if (pickup.ttlMs !== undefined && pickup.spawnTimeMs !== undefined) {
        if (worldAgeMs - pickup.spawnTimeMs >= pickup.ttlMs) {
          fuelPickups.splice(i, 1);
        }
      }
    }
    for (let i = resourcePickups.length - 1; i >= 0; i--) {
      const pickup = resourcePickups[i];
      if (pickup.ttlMs !== undefined && pickup.spawnTimeMs !== undefined) {
        if (worldAgeMs - pickup.spawnTimeMs >= pickup.ttlMs) {
          resourcePickups.splice(i, 1);
        }
      }
    }
    for (const activeSector of activeSectors) {
      if (activeSector.beacon && !activeSector.beaconEntity) {
        activeSector.beaconEntity = new BeaconRelic(activeSector.beacon.x, activeSector.beacon.y, {
          size: 190,
          shimmerPhase: (activeSector.sx + activeSector.sy) * 0.5
        });
      }
      if (activeSector.station && !activeSector.stationEntity) {
        activeSector.stationEntity = new UpgradeStation(activeSector.station.x, activeSector.station.y, {
          id: activeSector.station.id,
          safeRadius: activeSector.station.safeRadius,
          dockRadius: activeSector.station.dockRadius,
          isStartStation: activeSector.station.isStartStation,
          tierCap: activeSector.station.tierCap
        });
      }
      if (!activeSector.goalCollected && typeof activeSector.goal.update === "function") {
        activeSector.goal.update(dt);
      }
      if (activeSector.apseRing && typeof activeSector.apseRing.update === "function") {
        activeSector.apseRing.update(dt);
      }
      if (activeSector.apseRing && activeSector.apseInterior && typeof activeSector.apseInterior.setOpenings === "function") {
        const openings = activeSector.apseRing.getOpenings ? activeSector.apseRing.getOpenings() : [];
        const ringThickness = activeSector.apseRingThickness ?? activeSector.apseRing.thickness ?? 0;
        activeSector.apseInterior.setOpenings(openings, ringThickness);
      }
      if (activeSector.apseInterior && typeof activeSector.apseInterior.update === "function") {
        activeSector.apseInterior.update(dt);
      }
      if (Array.isArray(activeSector.palimpsestFragments)) {
        for (const fragment of activeSector.palimpsestFragments) {
          if (typeof fragment.update === "function") {
            fragment.update(dt, worldAgeSeconds);
          }
        }
      }
      if (activeSector.beaconEntity && typeof activeSector.beaconEntity.update === "function") {
        activeSector.beaconEntity.update(dt);
      }
    }
    for (const star of activeStars) {
      if (typeof star.update === "function") {
        star.update(dt, worldAgeSeconds);
      }
    }
    if (DEBUG.VECTORS) {
      const accel = cachedStarAccel ?? computeStarAccelAt(ship, activeStars, CONFIG);
      ship.debugGravityX = accel.ax;
      ship.debugGravityY = accel.ay;
    } else {
      ship.debugGravityX = 0;
      ship.debugGravityY = 0;
    }

    const shipRivers = shipInSafeZone ? [] : (sector?.runtimeRivers ?? []);
      if (docked) {
        ship.vx = 0;
        ship.vy = 0;
      } else {
        applyForcesToEntity(ship, dt, activeStars, shipRivers, CONFIG);
        applyDragToEntity(ship, sector, dt);
        if (autopilotEngaged && AUTOPILOT.SPEED_MAX > 0) {
          const speed = Math.hypot(ship.vx, ship.vy);
          if (speed > AUTOPILOT.SPEED_MAX) {
            const scale = AUTOPILOT.SPEED_MAX / speed;
            ship.vx *= scale;
            ship.vy *= scale;
          }
        }
        integrate(ship, dt);
        resolveStationCollision(currentStation);
        resolveApseRingCollisions(activeSectors);
        resolveMeridianCollisions(ship, SHIP_RADIUS, activeSectors);
        resolvePalimpsestFragmentCollisions(ship, SHIP_RADIUS, palimpsestFragments);
      }
    updateGate(dt);
    const shipSpeed = Math.hypot(ship.vx, ship.vy);
    spawnTrailSparks(dt, shipSpeed);
    const distFromOrigin = Math.hypot(ship.x - originX, ship.y - originY);
    if (distFromOrigin > distanceTraveled) {
      distanceTraveled = distFromOrigin;
    }
    const apseColliders = collectApseColliders(activeSectors);
    const objectViewRadius = getViewRadius(canvas, camera);
    for (const activeSector of activeSectors) {
      const groups = getSectorObjectGroups(activeSector);
      if (groups.length === 0) {
        continue;
      }
      for (const group of groups) {
        for (let i = group.length - 1; i >= 0; i--) {
          const obj = group[i];
          if (!obj) {
            continue;
          }
          if (typeof obj.update === "function") {
            obj.update(dt);
          }
          if (obj.type === "NODE") {
            const bounds = activeSector.bounds ?? null;
            obj.updateAI?.(dt, {
              ship,
              viewRadius: objectViewRadius,
              asteroids: activeSector.asteroids ?? [],
              bounds
            });
            applyForcesToEntity(obj, dt, activeStars, activeSector.runtimeRivers ?? [], CONFIG);
            applyDragToEntity(obj, activeSector, dt);
            integrateWithApseCollisions(obj, obj.radius ?? 0, apseColliders, dt);
            resolveMeridianCollisions(obj, obj.radius ?? 0, activeSectors);
            resolvePalimpsestFragmentCollisions(obj, obj.radius ?? 0, palimpsestFragments);
            if (objectHitsStar(obj, obj.radius ?? 0, activeStars, true)) {
              spawnUpgradePickup(obj.x, obj.y, "NODE", worldAgeMs, Math.floor(obj.x + obj.y));
              group.splice(i, 1);
              continue;
            }
            if (obj.mode === "LEAVING" && bounds) {
              const minX = bounds.x - OBJECT_SPAWN_MARGIN;
              const maxX = bounds.x + bounds.size + OBJECT_SPAWN_MARGIN;
              const minY = bounds.y - OBJECT_SPAWN_MARGIN;
              const maxY = bounds.y + bounds.size + OBJECT_SPAWN_MARGIN;
              if (obj.x < minX || obj.x > maxX || obj.y < minY || obj.y > maxY) {
                group.splice(i, 1);
                continue;
              }
            }
          }
        }
      }
    }
    for (const activeSector of activeSectors) {
      for (let i = activeSector.asteroids.length - 1; i >= 0; i--) {
        const asteroid = activeSector.asteroids[i];
        if (asteroid.ttlMs !== undefined && asteroid.spawnTimeMs !== undefined) {
          if (worldAgeMs - asteroid.spawnTimeMs >= asteroid.ttlMs) {
            activeSector.asteroids.splice(i, 1);
            continue;
          }
        }
        if (typeof asteroid.update === "function") {
          asteroid.update(dt);
        }
        applyForcesToEntity(asteroid, dt, activeStars, activeSector.runtimeRivers ?? [], CONFIG);
        applyDragToEntity(asteroid, activeSector, dt);
        const radius = Number.isFinite(asteroid.radius) ? asteroid.radius : 0;
        integrateWithApseCollisions(asteroid, radius, apseColliders, dt);
        resolveMeridianCollisions(asteroid, radius, activeSectors);
        resolvePalimpsestFragmentCollisions(asteroid, radius, palimpsestFragments);
        const objectGroups = getSectorObjectGroups(activeSector);
        for (const group of objectGroups) {
          for (const obj of group) {
            resolveBodyObjectCollision(asteroid, radius, obj);
          }
        }
        if (asteroidHitsSingularity(asteroid, palimpsestSingularities)) {
          activeSector.asteroids.splice(i, 1);
          continue;
        }
        if (objectHitsStar(asteroid, radius, activeStars, false)) {
          activeSector.asteroids.splice(i, 1);
          continue;
        }
      }
      resolveAsteroidCollisions(activeSector.asteroids);
    }
    updateFuelPickups(fuelPickups, activeStars, activeSectors, dt, worldAgeMs);
    updateResourcePickups(resourcePickups, activeStars, activeSectors, dt, worldAgeMs);
    updateUpgradePickups(upgradePickups, activeStars, activeSectors, dt, worldAgeMs, apseColliders, palimpsestFragments);
    enemiesInRange = updateEnemies(
      enemies,
      ship,
      dt,
      activeStars,
      activeSectors,
      MINIMAP.RANGE,
      ENEMY_FIRE_RANGE,
      ENEMY.FIRE_COOLDOWN,
      enemyBullets,
      BULLET.SPEED,
      ENEMY_BULLET_LIFE,
      sounds
    );
    destroyObjectsInSafeZones(activeStations);
    repelEnemiesFromStations(activeStations, dt);
    handleFuelPickups(fuelPickups, ship, SHIP_RADIUS, SCORE_POINTS, addScore, sounds, () => {
      if (tutorial.active) {
        tutorial.flags.looted = true;
      }
    });
    handleResourcePickups(resourcePickups, ship, SHIP_RADIUS, addResource, sounds, (pickup) => {
      spawnScorePopup(pickup.value, { x: pickup.x, y: pickup.y }, "resource", pickup.color);
      if (tutorial.active) {
        tutorial.flags.looted = true;
      }
    });
    handleUpgradePickups(upgradePickups, ship, SHIP_RADIUS);
    handleBulletHits(
      bullets,
      enemies,
      activeSectors,
      SCORE_POINTS,
      SCORE_CHUNK_MULTIPLIER,
      addScore,
      sounds,
      fuelPickups,
      resourcePickups,
      particles,
      worldAgeMs
    );
    handleObjectBulletHits(bullets, activeSectors, viewRadius, worldAgeMs);
    if (tutorial.active) {
      const hasGoals = activeSectors.some((s) => s.goal);
      const hasFuel = fuelPickups.length > 0;
      const hasEnemies = enemiesInRange.length > 0;
      if (hasGoals || hasFuel || hasEnemies) {
        tutorial.chevronTimer += dt;
        if (tutorial.chevronTimer >= 1.2) {
          tutorial.flags.chevrons = true;
        }
      } else {
        tutorial.chevronTimer = 0;
      }
    }
    updateZoom(dt);
    if (lastTrailX === null) {
      lastTrailX = ship.x;
      lastTrailY = ship.y;
      trail.push({ x: ship.x, y: ship.y });
    } else {
      const dx = ship.x - lastTrailX;
      const dy = ship.y - lastTrailY;
      if ((dx * dx + dy * dy) >= (TRAIL_MIN_DIST * TRAIL_MIN_DIST)) {
        trail.push({ x: ship.x, y: ship.y });
        lastTrailX = ship.x;
        lastTrailY = ship.y;
        if (trail.length > TRAIL_MAX) {
          trail.shift();
        }
      }
    }
    const speed = Math.hypot(ship.vx, ship.vy);
    if (speed < TRAIL_FADE_SPEED && trail.length > 0) {
      const fadeRate = 1 - (speed / TRAIL_FADE_SPEED);
      trailFadeTimer += dt * fadeRate;
      const removeCount = Math.floor(trailFadeTimer / TRAIL_FADE_STEP);
      if (removeCount > 0) {
        trail.splice(0, removeCount);
        trailFadeTimer -= removeCount * TRAIL_FADE_STEP;
      }
      if (trail.length < 2) {
        trail.length = 0;
        lastTrailX = null;
        lastTrailY = null;
      }
    } else {
      trailFadeTimer = 0;
    }

    if (!shipInSafeZone) {
      for (const star of activeStars) {
        const dx = ship.x - star.x;
        const dy = ship.y - star.y;
        const dist = Math.hypot(dx, dy);
        if (dist < star.radius) {
          handleLifeLoss("star");
          return;
        }
      }

      resolveBodyObjectCollisions(ship, SHIP_RADIUS, activeSectors);

      for (const activeSector of activeSectors) {
        for (const asteroid of activeSector.asteroids) {
          const dx = ship.x - asteroid.x;
          const dy = ship.y - asteroid.y;
          const dist = Math.hypot(dx, dy);
          if (dist < asteroid.radius + SHIP_RADIUS) {
            const collided = resolveShipAsteroidCollision(ship, SHIP_RADIUS, asteroid);
            if (collided) {
              handleShipHit("normal");
            }
          }
        }
      }
    }

    if (ship.fuel <= 0 && terminateRequested) {
      terminateRequested = false;
      handleLifeLoss("normal");
      return;
    }
    terminateRequested = false;

    const manualFire = (mouseAimEnabled && mouse.leftDown) || touch.fireId !== null;
    const wantsFire = !controlsDisabled && !docked
      && (autopilotEngaged ? autopilotFire : manualFire);
    if (shipVisible && wantsFire && fireCooldown === 0 && fireLockout === 0) {
      spawnBullet(bullets, ship, {
        SPEED: BULLET.SPEED,
        LIFE: getPlayerBulletLifeSeconds(upgradeLevels.fireDistanceLevel)
      });
      sounds.play("laser");
      triggerShake(SHAKE.FIRE, 0.12);
      fireCooldown = getFireCooldownSeconds(upgradeLevels.fireRateLevel);
      if (tutorial.active && manualFire && !autopilotEngaged) {
        tutorial.flags.fired = true;
      }
      if (autopilotEngaged) {
        autopilotFirePause = randomRange(AUTOPILOT.FIRE.PAUSE_MIN, AUTOPILOT.FIRE.PAUSE_MAX);
      }
    }

    if (!sector.goalDelivered && sector.goal.containsPoint(ship.x, ship.y, SHIP_RADIUS)) {
      sector.goalCollected = true;
      sector.goalDelivered = true;
      if (inBeaconZone) {
        beaconScanPenalty = Math.max(beaconScanPenalty, 10);
      }
      const clue = revealClue();
      surveyed = clueState.totalCollected;
      scoreMultiplier = 1 + surveyed;
      addScore(SCORE_POINTS.SURVEY, false, false, { x: ship.x, y: ship.y }, "survey");
      if (intro.enabled) {
        intro.firstSurveyComplete = true;
      }
      if (clue) {
        const speakerColor = CLUE_CONFIG?.SPEAKER_COLORS?.[clue.speaker] ?? null;
        const metaLine = `${clue.context} | TO: ${clue.recipient} | ${clue.timestamp}`;
        const bodyLine = `${clue.speaker}: ${clue.text}`;
        queueAlert(
          `${metaLine}\n${bodyLine}`,
          0,
          CLUE_CONFIG?.ALERT_DURATION ?? ALERT.DURATION * 2,
          true,
          {
            textColor: speakerColor,
            kind: "clue",
            background: true
          }
        );
      } else {
        queueAlert("Signal archived.", 0, ALERT.DURATION, true, {
          textColor: CLUE_CONFIG?.TUTORIAL_COLOR ?? null
        });
      }
      applyFuelPickupEquivalent();
      triggerShake(SHAKE.SURVEY);
      sounds.play("got_survey");
      const wasSurveyed = ensureSectorMeta(sector)?.surveyComplete;
      const meta = updateSectorMeta(sector, (entry) => {
        entry.surveyComplete = true;
        entry.lastVisitedAt = Date.now();
      });
      if (meta?.sectorType === SECTOR_TYPES.SIGNAL_ORIGIN && !wasSurveyed) {
        applyBeaconExposure(BEACON.SURVEY_BONUS);
      }
      if (gameState?.history) {
        pushLimited(gameState.history.recentSurveys, {
          id: getSectorKey(sector),
          ring: sector.ring,
          count: surveyed
        }, 30);
        markStateDirty();
      }
      console.log("[survey] completed", {
        sector: `${sector.sx},${sector.sy}`,
        surveyed
      });
    }

    saveStateIfNeeded();
  }

function render() {
  if (canvas.width !== starfieldW || canvas.height !== starfieldH) {
    starfieldW = canvas.width;
    starfieldH = canvas.height;
    starfield = createStarfield(starfieldW, starfieldH, STARFIELD);
    dustfield = createStarfield(starfieldW, starfieldH, DUSTFIELD);
    farfield = createStarfield(starfieldW, starfieldH, FARFIELD);
    const sliceSize = Math.ceil(Math.max(starfieldW, starfieldH) * 1.5);
    sliceField = createRotatingSlice(sliceSize, BACKGROUND_SLICE);
    const nebulaSize = Math.ceil(Math.max(starfieldW, starfieldH) * 1.4);
    nebulaField = createNebulaTexture(nebulaSize, NEBULA);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (farfield) {
    ctx.save();
    ctx.globalAlpha = FARFIELD.ALPHA;
    const offsetX = -ship.x * FARFIELD_PARALLAX;
    const offsetY = -ship.y * FARFIELD_PARALLAX;
    drawStarfield(ctx, farfield, offsetX, offsetY, canvas.width, canvas.height);
    ctx.restore();
  }
  if (dustfield) {
    ctx.save();
    ctx.globalAlpha = DUSTFIELD.ALPHA;
    const offsetX = -ship.x * DUSTFIELD_PARALLAX;
    const offsetY = -ship.y * DUSTFIELD_PARALLAX;
    drawStarfield(ctx, dustfield, offsetX, offsetY, canvas.width, canvas.height);
    ctx.restore();
  }
  if (starfield) {
    ctx.save();
    ctx.globalAlpha = STARFIELD.ALPHA;
    const offsetX = -ship.x * STARFIELD_PARALLAX;
    const offsetY = -ship.y * STARFIELD_PARALLAX;
    drawStarfield(ctx, starfield, offsetX, offsetY, canvas.width, canvas.height);
    ctx.restore();
  }

  const time = performance.now();
  if (sliceField) {
    ctx.save();
    ctx.globalAlpha = BACKGROUND_SLICE.ALPHA;
    ctx.translate(
      canvas.width / 2 - ship.x * BACKGROUND_SLICE.PARALLAX,
      canvas.height / 2 - ship.y * BACKGROUND_SLICE.PARALLAX
    );
    ctx.rotate(time * BACKGROUND_SLICE.ROT_SPEED);
    ctx.drawImage(sliceField, -sliceField.width / 2, -sliceField.height / 2);
    ctx.restore();
  }

  if (nebulaField) {
    ctx.save();
    ctx.globalAlpha = NEBULA.ALPHA;
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(
      canvas.width / 2 - ship.x * NEBULA.PARALLAX,
      canvas.height / 2 - ship.y * NEBULA.PARALLAX
    );
    ctx.rotate(time * NEBULA.ROT_SPEED);
    ctx.drawImage(nebulaField, -nebulaField.width / 2, -nebulaField.height / 2);
    ctx.restore();
  }

  if (MERIDIAN_CHROMA_STRENGTH > 0) {
    for (const activeSector of activeSectors) {
      if (activeSector?.meridian && activeSector?.bounds) {
        const intensity = getMeridianIntensityScale(activeSector, ship);
        drawMeridianBackgroundSplit(ctx, activeSector, ship, camera, canvas, {
          farfield,
          dustfield,
          starfield,
          sliceField,
          nebulaField
        }, time, intensity);
      }
    }
  }
  if (MERIDIAN_SILENCE_ALPHA > 0) {
    for (const activeSector of activeSectors) {
      if (activeSector?.meridian && activeSector?.bounds) {
        const intensity = getMeridianIntensityScale(activeSector, ship);
        drawMeridianSilenceBand(ctx, activeSector, ship, camera, canvas, intensity);
      }
    }
  }

  drawBackgroundEvents(ctx, backgroundEvents, backgroundClock, ship, canvas.width, canvas.height);

  // World (rotated)
  camera.applyTransform(ctx, canvas);
  const maxViewWidth = canvas.width / ZOOM.MIN;
  const maxViewHeight = canvas.height / ZOOM.MIN;
  const worldAgeMs = gameState?.worldAgeMs ?? 0;
  const worldAgeTicks = Math.floor(worldAgeMs / 1000);
  const maxViewRect = {
    x: ship.x - maxViewWidth / 2,
    y: ship.y - maxViewHeight / 2,
    width: maxViewWidth,
    height: maxViewHeight
  };
  const introHighlight = intro.enabled && INTRO
    ? {
      goal: Math.min(1, intro.highlights.goal / INTRO.HIGHLIGHT_DURATION),
      exit: Math.min(1, intro.highlights.exit / INTRO.HIGHLIGHT_DURATION),
      score: Math.min(1, intro.highlights.score / INTRO.HIGHLIGHT_DURATION),
      fuel: Math.min(1, intro.highlights.fuel / INTRO.HIGHLIGHT_DURATION),
      vignette: Math.min(1, intro.highlights.vignette / INTRO.VIGNETTE_DURATION),
      river: Math.min(1, intro.highlights.river / INTRO.RIVER_HIGHLIGHT_DURATION)
    }
    : {
      goal: 0,
      exit: 0,
      score: 0,
      fuel: 0,
      vignette: 0,
      river: 0
    };
  const rivers = activeSectors.flatMap((activeSector) => activeSector.runtimeRivers ?? []);
  const renderStars = activeSectors.flatMap((activeSector) => activeSector.stars);
  drawRivers(ctx, rivers, maxViewRect, worldAgeTicks, renderStars, worldAgeMs / 1000, introHighlight.river);
  const shipSpeed = Math.hypot(ship.vx, ship.vy);
  drawCollectorField(ctx, getCollectorStats(upgradeLevels.collectorLevel).radius);
  for (const activeSector of activeSectors) {
    if (activeSector.station) {
      const dx = ship.x - activeSector.station.x;
      const dy = ship.y - activeSector.station.y;
      const inZone = Math.hypot(dx, dy) <= (activeSector.station.safeRadius ?? STATION.SAFE_ZONE_RADIUS);
      const isDockedHere = docked && dockStation?.id === activeSector.station.id;
      drawStationSafeZone(ctx, activeSector.station, inZone, isDockedHere);
    }
  }
  drawSectorBounds(ctx, sector);
  drawScanPulse(ctx, ship, activeSectors, time, getViewRadius(canvas, camera));
  const viewRadius = getViewRadius(canvas, camera);
  for (const activeSector of activeSectors) {
    for (const star of activeSector.stars) {
      star.draw(ctx);
    }
    if (Array.isArray(activeSector.palimpsestFragments)) {
      for (const fragment of activeSector.palimpsestFragments) {
        fragment.draw(ctx);
      }
    }
    if (activeSector.apseBackground && typeof activeSector.apseBackground.draw === "function") {
      const rotation = activeSector.apseRing?.rotation ?? 0;
      activeSector.apseBackground.draw(ctx, rotation);
    }
    if (activeSector.apseRing && typeof activeSector.apseRing.draw === "function") {
      activeSector.apseRing.draw(ctx);
    }
    if (activeSector.apseInterior && typeof activeSector.apseInterior.draw === "function") {
      activeSector.apseInterior.draw(ctx);
    }
    if (activeSector.beaconEntity) {
      activeSector.beaconEntity.draw(ctx);
    }
    if (activeSector.stationEntity) {
      activeSector.stationEntity.draw(ctx);
    }
    for (const asteroid of activeSector.asteroids) {
      asteroid.draw(ctx);
    }
    const objectGroups = getSectorObjectGroups(activeSector);
    for (const group of objectGroups) {
      for (const obj of group) {
        if (typeof obj.draw === "function") {
          obj.draw(ctx);
        }
      }
    }
  }
  drawGate(ctx);
  drawFuelPickups(ctx, fuelPickups);
  drawResourcePickups(ctx, resourcePickups);
  for (const pickup of upgradePickups) {
    pickup.draw(ctx);
  }
  drawEnemies(ctx, enemies);
  drawEnemyBullets(ctx, enemyBullets);
  drawBullets(ctx, bullets);
  drawParticles(ctx, particles);
  drawImpactRings(ctx);
  drawTrail(ctx, trail, shipSpeed);
  const shipVisuals = {
    shieldLevel: upgradeLevels.hullLevel,
    shieldRatio: maxArmor > 0 ? armor / maxArmor : 0,
    fireRateLevel: upgradeLevels.fireRateLevel,
    fireCooldownSeconds: getFireCooldownSeconds(upgradeLevels.fireRateLevel),
    fireDistanceLevel: upgradeLevels.fireDistanceLevel,
    scanDistanceLevel: upgradeLevels.scanDistanceLevel,
    fuelTankLevel: upgradeLevels.fuelTankLevel,
    fuelRatio: ship.maxFuel > 0 ? ship.fuel / ship.maxFuel : 0,
    collectorLevel: upgradeLevels.collectorLevel
  };
  if (!sector.goalCollected) {
    sector.goal.draw(ctx);
  }
  for (const activeSector of activeSectors) {
    drawSectorOcclusion(ctx, activeSector, ship);
  }
    if (shipVisible) {
      if (controlsDisabledTimer > 0) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        ship.draw(ctx, shipSpeed, shipVisuals);
        ctx.restore();
      } else {
        ship.draw(ctx, shipSpeed, shipVisuals);
      }
    }
    const viewDiagonal = getViewRadius(canvas, camera);
    for (const activeSector of activeSectors) {
      if (activeSector?.meridian) {
        const bounds = activeSector.bounds;
        if (bounds) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(bounds.x, bounds.y, bounds.size, bounds.size);
          ctx.clip();
          drawMeridianSpine(ctx, activeSector.meridian, viewDiagonal, camera.zoom, time);
          ctx.restore();
        } else {
          drawMeridianSpine(ctx, activeSector.meridian, viewDiagonal, camera.zoom, time);
        }
      }
    }
    camera.resetTransform(ctx);

  if (DEBUG.VECTORS) {
    drawDebugVectors(ctx, ship);
  }
  drawScreenEffects(ctx, canvas.width, canvas.height, introHighlight.vignette);
  if (controlsDisabledTimer > 0 && shipVisible) {
    drawControlDisableOverlay(ctx, canvas, camera, controlsDisabledTimer, CALIBRATION_SHIP_RADIUS);
  }
  drawScorePopups(ctx, canvas, camera, ship, scorePopups);
  const hudScale = getHudScale(canvas.width, canvas.height);
  ctx.save();
  ctx.scale(hudScale, hudScale);
  const hudW = canvas.width / hudScale;
  const hudH = canvas.height / hudScale;
  const isCompactHud = Math.min(canvas.width, canvas.height) < 820;
  const controlLabel = touch.isActive
    ? "INPUT: TOUCH"
    : "INPUT: MOUSE";
  const anomalyEffects = getAnomalyEffects(sector, time);
  const distanceFromOrigin = Math.hypot(ship.x - originX, ship.y - originY);
  drawBearingIndicators(ctx, ship, activeSectors, fuelPickups, enemiesInRange, hudW, hudH, anomalyEffects);
  drawMiniMap(ctx, ship, activeSectors, enemiesInRange, enemyPings, stationMarkers, fuelPickups, resourcePickups, hudW, hudH, isCompactHud, anomalyEffects, introHighlight);
  drawFuelGauge(ctx, ship, hudW, hudH, isCompactHud, introHighlight.fuel);
  if (exitButton) {
    const base = Math.min(hudW, hudH);
    const edge = isCompactHud ? 12 : 20;
    const maxSize = Math.min(hudW - edge * 2, hudH - edge * 2);
    const desiredSize = isCompactHud
      ? Math.min(MINIMAP.SIZE, Math.round(base * 0.28))
      : MINIMAP.SIZE;
    let size = Math.max(120, Math.min(desiredSize, maxSize));
    size = Math.min(maxSize, size * 1.1);
    const x0 = hudW - size - edge;
    const y0 = edge;
    const btnSize = (isCompactHud ? 24 : 30) * hudScale;
    exitButton.style.width = `${btnSize}px`;
    exitButton.style.height = `${btnSize}px`;
    const offsetX = 30;
    const x0Shifted = Math.max(edge, x0 - offsetX);
    exitButton.style.left = `${(x0Shifted + size - btnSize * 0.7) * hudScale}px`;
    exitButton.style.top = `${(y0 - btnSize * 0.4) * hudScale}px`;
    exitButton.style.display = "block";
  }
  if (terminateButton) {
    const edge = isCompactHud ? 12 : 20;
    const basePanelW = Math.min(isCompactHud ? 260 : 320, hudW - edge * 2);
    const panelW = basePanelW * 0.8;
    const panelH = isCompactHud ? 70 : 78;
    const x = edge;
    const y = hudH - panelH - (isCompactHud ? 10 : 16);
    terminateButton.style.left = `${x * hudScale}px`;
    terminateButton.style.top = `${y * hudScale}px`;
    terminateButton.style.width = `${panelW * hudScale}px`;
    terminateButton.style.height = `${panelH * hudScale}px`;
    terminateButton.style.display = ship.fuel <= 0 && !pendingGameOver ? "flex" : "none";
  }
  drawStatusHud(
    ctx,
    ship,
    lives,
    armor,
    maxArmor,
    surveyed,
    timeSpent,
    distanceFromOrigin,
    resourceCurrency,
    hudW,
    hudH,
    controlLabel,
    isCompactHud
  );
  drawScoreHud(ctx, score, scoreMultiplier, scorePulse, hudW, hudH, isCompactHud, introHighlight.score);
  const autoRect = drawAutopilotToggle(ctx, autopilotActive, hudW, hudH, isCompactHud);
  autopilotButtonRect = {
    x: autoRect.x * hudScale,
    y: autoRect.y * hudScale,
    width: autoRect.width * hudScale,
    height: autoRect.height * hudScale
  };
  drawStationIndicators(ctx, ship, stationMarkers, hudW, hudH, camera);
  if (sector?.sectorType === SECTOR_TYPES.SIGNAL_ORIGIN) {
    drawBeaconSignalHud(ctx, beaconSignal.strength, hudW, hudH, isCompactHud);
  }
  drawAlerts(ctx, alerts, alertClock, hudW, hudH);
  ctx.restore();
  drawMouseReticle(ctx, mouse, canvas.width, canvas.height, mouseAimEnabled);
  drawTouchControls(ctx, touch, canvas.width, canvas.height);
  const tutorialCallout = getTutorialCallout(canvas.width, canvas.height, hudScale, isCompactHud);
  drawTutorialCallout(ctx, tutorialCallout, canvas.width, canvas.height);
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function drawDebugVectors(ctx, ship) {
  ctx.save();
  ctx.translate(window.innerWidth / 2, window.innerHeight / 2);

  // Velocity vector (white)
  const vx = ship.vx * 0.2;
  const vy = ship.vy * 0.2;
  const vlen = Math.hypot(vx, vy);
  if (vlen > 0.01) {
    const grad = ctx.createLinearGradient(0, 0, vx, vy);
    grad.addColorStop(0, "rgba(255, 255, 255, 0)");
    grad.addColorStop(0.4, "rgba(200, 220, 255, 0.4)");
    grad.addColorStop(1, "rgba(255, 255, 255, 0.9)");

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(vx, vy);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  // Gravity vector (red)
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(ship.debugGravityX * 0.05, ship.debugGravityY * 0.05);
  ctx.strokeStyle = "red";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

function drawSectorBounds(ctx, sector) {
  if (!sector) {
    return;
  }
  const { x, y, size } = sector.bounds;
  ctx.save();
  if (sector.goalDelivered) {
    ctx.fillStyle = "rgba(120, 255, 140, 0.06)";
    ctx.fillRect(x, y, size, size);
  }
  ctx.strokeStyle = "rgba(0, 200, 255, 0.25)";
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 12]);
  ctx.strokeRect(x, y, size, size);
  ctx.restore();
}

function drawNavHud(ctx, ship, target, label, screenW, screenH) {
  if (!target) {
    return;
  }
  const gx = target.x + target.width / 2;
  const gy = target.y + target.height / 2;
  const dx = gx - ship.x;
  const dy = gy - ship.y;
  const distance = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);
  const trajSpeed = Math.hypot(ship.vx, ship.vy);
  let offsetDeg = 0;
  if (trajSpeed > 0.01) {
    const trajAngle = Math.atan2(ship.vy, ship.vx);
    const delta = angle - trajAngle;
    offsetDeg = ((delta * 180) / Math.PI + 540) % 360 - 180;
  }

  const arrowCenterX = screenW / 2;
  const arrowCenterY = 40;
  const arrowLen = 22;

  ctx.save();
  ctx.translate(arrowCenterX, arrowCenterY);
  ctx.rotate(angle);
  ctx.strokeStyle = "lime";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-arrowLen, 0);
  ctx.lineTo(arrowLen, 0);
  ctx.lineTo(arrowLen - 6, -6);
  ctx.moveTo(arrowLen, 0);
  ctx.lineTo(arrowLen - 6, 6);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "lime";
  ctx.font = `16px ${HUD_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(`${label}: ${Math.round(distance)}u`, arrowCenterX, arrowCenterY + 24);
  const headingLabel = trajSpeed > 0.01
    ? `Offset: ${offsetDeg.toFixed(0)}deg`
    : "Offset: --";
  ctx.fillText(headingLabel, arrowCenterX, arrowCenterY + 42);
  ctx.restore();
}

function normalizeAngle(angle) {
  return ((angle + Math.PI) % (Math.PI * 2)) - Math.PI;
}

function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerpAngle(from, to, t) {
  const delta = normalizeAngle(to - from);
  return from + delta * t;
}

function drawMouseReticle(ctx, mouse, screenW, screenH, active) {
  if (!active || !mouse?.hasMoved) {
    return;
  }
  if (mouse.x < 0 || mouse.y < 0 || mouse.x > screenW || mouse.y > screenH) {
    return;
  }

  const size = 10;
  ctx.save();
  ctx.translate(mouse.x, mouse.y);
  ctx.strokeStyle = HUD_COLORS.ACCENT;
  ctx.globalAlpha = 0.65;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-size, 0);
  ctx.lineTo(-4, 0);
  ctx.moveTo(size, 0);
  ctx.lineTo(4, 0);
  ctx.moveTo(0, -size);
  ctx.lineTo(0, -4);
  ctx.moveTo(0, size);
  ctx.lineTo(0, 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawTouchControls(ctx, touch, screenW, screenH) {
  const minDim = Math.min(screenW, screenH);
  const showHints = touch?.isActive
    || (TOUCH.SHOW_HINTS && (screenW < 900 || screenH < 700));
  if (!showHints && !touch?.aimId) {
    return;
  }

  if (touch?.aimId && TOUCH.RETICLE_ENABLED) {
    const centerX = screenW / 2;
    const centerY = screenH / 2;
    const dx = touch.aimX - centerX;
    const dy = touch.aimY - centerY;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.001) {
      const nx = dx / dist;
      const ny = dy / dist;
      const len = TOUCH.RETICLE_LENGTH ?? 18;
      ctx.save();
      ctx.strokeStyle = HUD_COLORS.ACCENT;
      ctx.globalAlpha = TOUCH.RETICLE_ALPHA ?? 0.22;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + nx * len, centerY + ny * len);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(centerX + nx * len, centerY + ny * len, TOUCH.RETICLE_RADIUS ?? 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  if (showHints) {
    const baseRadius = Math.min(
      TOUCH.THRUST_RADIUS_MAX,
      Math.max(TOUCH.THRUST_RADIUS_MIN, minDim * (TOUCH.THRUST_RADIUS_SCALE ?? 0.16))
    );
    const baseX = screenW * (TOUCH.THRUST_HINT_X ?? 0.18);
    const baseY = screenH * (TOUCH.THRUST_HINT_Y ?? 0.78);

    ctx.save();
    ctx.globalAlpha = touch.thrustId !== null ? TOUCH.ACTIVE_ALPHA : TOUCH.HINT_ALPHA;
    ctx.strokeStyle = HUD_COLORS.ACCENT_SOFT;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(baseX, baseY, baseRadius, 0, Math.PI * 2);
    ctx.stroke();
    if (touch.thrustId !== null) {
      ctx.fillStyle = HUD_COLORS.ACCENT;
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.arc(baseX, baseY, baseRadius * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const fireRadius = Math.min(
      TOUCH.FIRE_RADIUS_MAX,
      Math.max(TOUCH.FIRE_RADIUS_MIN, minDim * (TOUCH.FIRE_RADIUS_SCALE ?? 0.08))
    );
    const fireX = screenW * (TOUCH.FIRE_BUTTON_X ?? 0.82);
    const fireY = screenH * (TOUCH.FIRE_BUTTON_Y ?? 0.78);
    ctx.save();
    ctx.globalAlpha = touch.fireId !== null ? TOUCH.ACTIVE_ALPHA : TOUCH.HINT_ALPHA;
    ctx.strokeStyle = HUD_COLORS.WARNING;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(fireX, fireY, fireRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function spawnEnemyForSurvey() {
  const desired = getEnemySpawnCountForSector(sector);
  if (desired <= 0) {
    return 0;
  }
  let spawned = 0;
  for (let i = 0; i < desired; i++) {
    const spawn = findEnemySpawnPoint();
    if (!spawn) {
      console.log("[enemy] spawn failed", {
        surveyed,
        enemiesSpawned
      });
      break;
    }
    const enemy = new EnemyShip(spawn.x, spawn.y);
    const dx = spawn.targetX - spawn.x;
    const dy = spawn.targetY - spawn.y;
    enemy.heading = Math.atan2(dx, -dy);
    enemies.push(enemy);
    enemyPings.push({ x: spawn.x, y: spawn.y, life: 1.2, maxLife: 1.2 });
    enemiesSpawned += 1;
    spawned += 1;
    console.log("[enemy] spawned", {
      x: spawn.x,
      y: spawn.y,
      sector: `${sector.sx},${sector.sy}`,
      enemiesSpawned
    });
  }
  return spawned;
}

function findEnemySpawnPoint() {
  if (!sector || !sector.goalDelivered) {
    return null;
  }
  const bounds = sector.bounds;
  const viewRadius = getViewRadius(canvas, camera);
  const minDist = viewRadius + ENEMY.SPAWN_MARGIN;
  const maxDist = MINIMAP.RANGE - 120;
  let best = null;

  for (let i = 0; i < 25; i++) {
    const x = bounds.x + Math.random() * bounds.size;
    const y = bounds.y + Math.random() * bounds.size;
    const dx = x - ship.x;
    const dy = y - ship.y;
    const dist = Math.hypot(dx, dy);
    if (dist >= minDist && dist <= maxDist) {
      best = { x, y };
      break;
    }
  }

  if (!best) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.min(maxDist, minDist + 120);
    const x = ship.x + Math.cos(angle) * dist;
    const y = ship.y + Math.sin(angle) * dist;
    best = { x, y };
  }

  return {
    x: best.x,
    y: best.y,
    targetX: ship.x,
    targetY: ship.y
  };
}

requestAnimationFrame(loop);

  function endGame(delayOverride = null) {
    if (gameOver) {
      return;
    }
    ship.stopThrustLoop();
    music.stop();
    setAutopilotActive(false, true);
    sounds.stopLoop("at_station");
    pendingGameOver = true;
    gameOverTimer = Number.isFinite(delayOverride) ? delayOverride : GAME_OVER_DELAY;
    const finalScore = Math.round(score);
    cachedGameOverStats = {
      score: finalScore,
      distanceTraveled,
      timeSpent,
      surveyed
    };
  }

  function finalizeGameOver() {
    if (gameOver) {
      return;
    }
    gameOver = true;
    running = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    cleanupMouseControls();
    if (gameState) {
      if (allowPersistence) {
        saveGameState(gameState);
      }
    }
    if (allowPersistence) {
      saveSectorIndex(sectorIndex);
    }
    if (onGameOver) {
      onGameOver(cachedGameOverStats);
    }
  }

  function requestExitToMenu() {
    if (!running) {
      return;
    }
    exitToMenu();
    if (onExitToMenu) {
      onExitToMenu();
    }
  }

  function exitToMenu() {
    if (!running) {
      return;
    }
    running = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    ship.stopThrustLoop();
    ship.stopRotateLoop();
    music.stop();
    sounds.stopLoop("at_station");
    cleanupMouseControls();
    if (gameState) {
      if (allowPersistence) {
        saveGameState(gameState);
      }
    }
    if (allowPersistence) {
      saveSectorIndex(sectorIndex);
    }
  }

  function updateZoom(dt) {
    const zoomDelta = wheelZoomStep;
    if (zoomDelta === 0) {
      return;
    }
    wheelZoomStep = 0;
    setZoomIndex(zoomIndex + zoomDelta);
  }

  return {
    stop: endGame,
    exitToMenu
  };
}
