import { getDeckPalette, numberToCss } from './deckPalettes.js';

export function createDeckPatternTextures(scene, maxDecks = 12) {
  for (let deckId = 1; deckId <= maxDecks; deckId += 1) {
    createFloorTileTexture(scene, deckId);
    createWallModuleTexture(scene, deckId);
  }
}

export function getFloorTileKey(deckId) {
  return `floor_tile_deck_${deckId}`;
}

export function getWallModuleKey(deckId) {
  return `wall_module_deck_${deckId}`;
}

function createFloorTileTexture(scene, deckId) {
  const key = getFloorTileKey(deckId);
  if (scene.textures.exists(key)) {
    return key;
  }

  const palette = getDeckPalette(deckId);
  const size = 128;
  const canvas = scene.textures.createCanvas(key, size, size);
  const ctx = canvas.getContext();
  ctx.fillStyle = numberToCss(palette.floorBase);
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = rgba(palette.floorLine, 0.58);
  ctx.lineWidth = 1;
  for (let i = 0; i <= size; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }
  ctx.strokeStyle = rgba(palette.accent, 0.22);
  for (const [x, y] of [[32, 32], [96, 32], [32, 96], [96, 96]]) {
    ctx.beginPath();
    ctx.moveTo(x - 5, y);
    ctx.lineTo(x + 5, y);
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x, y + 5);
    ctx.stroke();
  }
  ctx.strokeStyle = rgba(palette.floorLine, 0.36);
  ctx.strokeRect(8, 8, 48, 48);
  ctx.strokeRect(72, 72, 48, 48);
  canvas.refresh();
  return key;
}

function createWallModuleTexture(scene, deckId) {
  const key = getWallModuleKey(deckId);
  if (scene.textures.exists(key)) {
    return key;
  }

  const palette = getDeckPalette(deckId);
  const width = 96;
  const height = 24;
  const canvas = scene.textures.createCanvas(key, width, height);
  const ctx = canvas.getContext();
  ctx.fillStyle = numberToCss(palette.wallShadow);
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = numberToCss(palette.wallBase);
  ctx.fillRect(2, 4, width - 4, height - 8);
  ctx.strokeStyle = rgba(palette.wallHighlight, 0.58);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(9, 8);
  ctx.lineTo(25, 8);
  ctx.moveTo(38, 16);
  ctx.lineTo(58, 16);
  ctx.moveTo(70, 8);
  ctx.lineTo(88, 8);
  ctx.moveTo(18, 13);
  ctx.lineTo(18, 17);
  ctx.moveTo(78, 13);
  ctx.lineTo(78, 17);
  ctx.stroke();
  ctx.strokeStyle = rgba(palette.wallShadow, 0.92);
  for (let x = 14; x < width; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 5);
    ctx.lineTo(x + 8, 5);
    ctx.stroke();
  }
  canvas.refresh();
  return key;
}

function rgba(color, alpha) {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
