import { CONFIG } from "./config.js";

const { RESOURCE } = CONFIG;
const MAX_TIERS = RESOURCE.RARITY_TIERS;
const DROP_SKEW_EXPONENT = RESOURCE.DROP_SKEW_EXPONENT;
const VALUE_BASE = RESOURCE.VALUE_BASE;
const COLOR_ANCHORS = RESOURCE.COLOR_ANCHORS ?? [];
const LOW_TIER_REMAP = RESOURCE.LOW_TIER_REMAP ?? null;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function rollRarityIndex(rng = Math.random) {
  const r = clamp(Number(rng()), 0, 0.999999);
  const tierFloat = Math.pow(r, DROP_SKEW_EXPONENT);
  const raw = clamp(Math.floor(tierFloat * MAX_TIERS), 0, MAX_TIERS - 1);
  if (LOW_TIER_REMAP && Object.prototype.hasOwnProperty.call(LOW_TIER_REMAP, raw)) {
    return clamp(Number(LOW_TIER_REMAP[raw]), 0, MAX_TIERS - 1);
  }
  return raw;
}

export function getRarityValueMultiplier(rarityIndex) {
  const index = clamp(Math.floor(rarityIndex || 0), 0, MAX_TIERS - 1);
  return Math.pow(VALUE_BASE, index);
}

function getAnchorPair(index) {
  if (!COLOR_ANCHORS.length) {
    return [
      { index: 0, hue: 0, sat: 0, val: 0.6 },
      { index: MAX_TIERS - 1, hue: 0, sat: 0.9, val: 1.0 }
    ];
  }
  const sorted = COLOR_ANCHORS.slice().sort((a, b) => a.index - b.index);
  if (index <= sorted[0].index) {
    return [sorted[0], sorted[0]];
  }
  const last = sorted[sorted.length - 1];
  if (index >= last.index) {
    return [last, last];
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (index >= a.index && index <= b.index) {
      return [a, b];
    }
  }
  return [sorted[0], sorted[0]];
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hsvToRgb(h, s, v) {
  const hue = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

export function getRarityColorRgb(rarityIndex) {
  const index = clamp(Math.floor(rarityIndex || 0), 0, MAX_TIERS - 1);
  const [a, b] = getAnchorPair(index);
  if (a.index === b.index) {
    return hsvToRgb(a.hue, a.sat, a.val);
  }
  const t = (index - a.index) / (b.index - a.index);
  const hue = lerp(a.hue, b.hue, t);
  const sat = lerp(a.sat, b.sat, t);
  const val = lerp(a.val, b.val, t);
  return hsvToRgb(hue, sat, val);
}

export function getRarityColorCss(rarityIndex) {
  const rgb = getRarityColorRgb(rarityIndex);
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}
