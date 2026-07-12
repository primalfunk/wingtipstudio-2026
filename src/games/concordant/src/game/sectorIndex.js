import { CONFIG } from "./config.js";

const SECTOR_INDEX_KEY = CONFIG.STORAGE.SECTOR_INDEX_KEY;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function getSectorKey(sx, sy) {
  return `${sx},${sy}`;
}

export function loadSectorIndex() {
  try {
    const stored = localStorage.getItem(SECTOR_INDEX_KEY);
    if (!stored) {
      return {};
    }
    const parsed = JSON.parse(stored);
    return isPlainObject(parsed) ? parsed : {};
  } catch (err) {
    return {};
  }
}

export function saveSectorIndex(index) {
  try {
    const payload = isPlainObject(index) ? index : {};
    localStorage.setItem(SECTOR_INDEX_KEY, JSON.stringify(payload));
  } catch (err) {
    // Ignore storage failures.
  }
}

export function resetSectorIndex() {
  const empty = {};
  saveSectorIndex(empty);
  return empty;
}

export function getSectorMeta(index, sx, sy) {
  if (!isPlainObject(index)) {
    return null;
  }
  return index[getSectorKey(sx, sy)] ?? null;
}

export function setSectorMeta(index, sx, sy, meta) {
  if (!isPlainObject(index)) {
    return meta;
  }
  index[getSectorKey(sx, sy)] = meta;
  return meta;
}

export function pruneSectorIndex(index, centerSx, centerSy, range) {
  if (!isPlainObject(index)) {
    return false;
  }
  if (!Number.isFinite(centerSx) || !Number.isFinite(centerSy) || !Number.isFinite(range)) {
    return false;
  }
  let changed = false;
  for (const key of Object.keys(index)) {
    const [sxRaw, syRaw] = key.split(",");
    const sx = Number(sxRaw);
    const sy = Number(syRaw);
    if (!Number.isFinite(sx) || !Number.isFinite(sy)) {
      continue;
    }
    if (Math.abs(sx - centerSx) > range || Math.abs(sy - centerSy) > range) {
      delete index[key];
      changed = true;
    }
  }
  return changed;
}
