import { CONFIG } from "../game/config.js";
import { clamp, createRng, hashInts, randomRange } from "../game/rng.js";

const APSE = CONFIG.SECTOR.APSE ?? {};
const BG = APSE.BACKGROUND ?? {};

const TEXTURE_SIZE = Math.max(512, Math.floor(BG.TEXTURE_SIZE ?? 2048));
const DEBUG_BANDS = false;
const PRIMARY_CORE_RADIUS_FRAC = 0.022;
const BLUR_PX = clamp(BG.BLUR_PX ?? 4.0, 0, 16);
const BLUR_ALPHA = clamp(BG.BLUR_ALPHA ?? 0.45, 0, 1);
const PETAL_OUTLINE_COLOR = BG.PETAL_OUTLINE_COLOR ?? "rgb(255, 255, 255)";
const PETAL_OUTLINE_ALPHA = clamp(BG.PETAL_OUTLINE_ALPHA ?? 0.2, 0, 1);
const PETAL_OUTLINE_WIDTH = clamp(BG.PETAL_OUTLINE_WIDTH ?? 1.0, 0, 6);

const CLOCK_TO_CANVAS = -Math.PI / 2;
const TWO_PI = Math.PI * 2;
const SYMMETRY_OPTIONS = [8, 12, 16];

const LEVELS = ["PRIMARY", "SECONDARY", "TERTIARY", "QUATERNARY"];
const LEVEL_EXPRESSIVE_FALLOFF = {
  PRIMARY: 0.55,
  SECONDARY: 0.7,
  TERTIARY: 0.85,
  QUATERNARY: 1.0
};
const LEVEL_SPLIT_BASE = {
  PRIMARY: 0,
  SECONDARY: 0.5,
  TERTIARY: 0.65,
  QUATERNARY: 0
};
const LEVEL_MIN_THICK = {
  PRIMARY: 0.28,
  SECONDARY: 0.12,
  TERTIARY: 0.06,
  QUATERNARY: 0.02
};
const LEVEL_MAX_THICK = {
  PRIMARY: 0.42,
  SECONDARY: 0.22,
  TERTIARY: 0.14,
  QUATERNARY: 0.06
};
const LEVEL_WEIGHTS = {
  PRIMARY: 4.0,
  SECONDARY: 3.0,
  TERTIARY: 2.0,
  QUATERNARY: 0.8
};
const LEVEL_CONTRIB = {
  PRIMARY: 1.0,
  SECONDARY: 1.0,
  TERTIARY: 0.9,
  QUATERNARY: 0.7
};
const LEVEL_FILL_FRAC = {
  PRIMARY: 1.0,
  SECONDARY: 1.0,
  TERTIARY: 1.0,
  QUATERNARY: 0.10
};
const LEVEL_COLOR = {
  PRIMARY: { s: [0.7, 0.85], l: [0.5, 0.62] },
  SECONDARY: { s: [0.55, 0.7], l: [0.38, 0.5] },
  TERTIARY: { s: [0.35, 0.55], l: [0.32, 0.44] },
  QUATERNARY: { s: [0.15, 0.35], l: [0.26, 0.36] }
};

const PATTERNS = {
  UNIFORM: "PATTERN_UNIFORM",
  ALTERNATING: "PATTERN_ALTERNATING",
  GROUPED_2: "PATTERN_GROUPED_2",
  GROUPED_3: "PATTERN_GROUPED_3"
};

const LEAD_BASE_K = 0.018;
const LEAD_FACTORS = {
  PRIMARY: 1.25,
  SECONDARY: 0.78,
  TERTIARY: 0.55,
  QUATERNARY: 0.30
};

function polar(angle, radius) {
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius
  };
}

function hslToRgb({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (h >= 0 && h < 60) {
    r1 = c;
    g1 = x;
  } else if (h < 120) {
    r1 = x;
    g1 = c;
  } else if (h < 180) {
    g1 = c;
    b1 = x;
  } else if (h < 240) {
    g1 = x;
    b1 = c;
  } else if (h < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255)
  };
}

function hslColor(h, s, l) {
  const rgb = hslToRgb({
    h: (h + 360) % 360,
    s: clamp(s, 0, 1),
    l: clamp(l, 0, 1)
  });
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

function clampHueToParent(parentHue, hue, maxDelta) {
  let delta = ((hue - parentHue + 540) % 360) - 180;
  if (Math.abs(delta) > maxDelta) {
    delta = Math.sign(delta) * maxDelta;
  }
  return (parentHue + delta + 360) % 360;
}

function chooseSymmetry(seed) {
  return SYMMETRY_OPTIONS[hashInts(seed, 911) % SYMMETRY_OPTIONS.length];
}

function chooseBandCount(seed) {
  return 9 + (hashInts(seed, 912) % 5);
}

function buildAngles(symmetry) {
  const step = TWO_PI / symmetry;
  const angles = new Array(symmetry + 1);
  for (let i = 0; i <= symmetry; i++) {
    angles[i] = i * step;
  }
  return { angles, step };
}

function allocateLevelCounts(bandCount) {
  const primary = 1;
  const secondary = bandCount >= 11 ? 2 : 1;
  const tertiary = bandCount >= 12 ? 4 : 3;
  const quaternary = Math.max(2, bandCount - primary - secondary - tertiary);
  return {
    PRIMARY: primary,
    SECONDARY: secondary,
    TERTIARY: tertiary,
    QUATERNARY: quaternary
  };
}

function buildLevelList(counts) {
  const levels = [];
  for (const level of LEVELS) {
    for (let i = 0; i < counts[level]; i++) {
      levels.push(level);
    }
  }
  return levels;
}

function computeLevelTotals(counts) {
  const totals = {};
  const minTotals = {};
  const maxTotals = {};
  let totalMin = 0;
  for (const level of LEVELS) {
    minTotals[level] = counts[level] * LEVEL_MIN_THICK[level];
    maxTotals[level] = counts[level] * LEVEL_MAX_THICK[level];
    totalMin += minTotals[level];
  }
  let remaining = Math.max(0, 1 - totalMin);
  for (const level of LEVELS) {
    totals[level] = minTotals[level];
  }
  let guard = 0;
  while (remaining > 1e-6 && guard < 12) {
    guard++;
    let weightSum = 0;
    for (const level of LEVELS) {
      if (maxTotals[level] - totals[level] > 1e-6) {
        weightSum += LEVEL_WEIGHTS[level];
      }
    }
    if (weightSum <= 0) {
      break;
    }
    for (const level of LEVELS) {
      const cap = Math.max(0, maxTotals[level] - totals[level]);
      if (cap <= 0) {
        continue;
      }
      const share = (LEVEL_WEIGHTS[level] / weightSum) * remaining;
      const add = Math.min(cap, share);
      totals[level] += add;
      remaining -= add;
    }
  }
  if (remaining > 1e-6) {
    const fallback = totals.PRIMARY;
    totals.PRIMARY = clamp(fallback + remaining, minTotals.PRIMARY, maxTotals.PRIMARY);
  }
  return { totals, minTotals, maxTotals };
}

function computeAreaShares(bands) {
  const sums = {
    PRIMARY: 0,
    SECONDARY: 0,
    TERTIARY: 0,
    QUATERNARY: 0
  };
  let total = 0;
  for (const band of bands) {
    const area = Math.PI * (band.rOuter * band.rOuter - band.rInner * band.rInner);
    const contrib = area * band.fillFrac * LEVEL_CONTRIB[band.level];
    sums[band.level] += contrib;
    total += contrib;
  }
  if (total <= 0) {
    return {
      PRIMARY: 0,
      SECONDARY: 0,
      TERTIARY: 0,
      QUATERNARY: 0
    };
  }
  return {
    PRIMARY: sums.PRIMARY / total,
    SECONDARY: sums.SECONDARY / total,
    TERTIARY: sums.TERTIARY / total,
    QUATERNARY: sums.QUATERNARY / total
  };
}

function adjustTotalsForArea(levelTotals, limits, counts, symmetry, seed, scale, baseHue) {
  let totals = { ...levelTotals };
  let changed = false;
  for (let iter = 0; iter < 10; iter++) {
    const bands = buildBands(counts, totals, symmetry, seed, scale, baseHue, true);
    const shares = computeAreaShares(bands);
    const primarySecondary = shares.PRIMARY + shares.SECONDARY;
    if (shares.PRIMARY >= 0.35 && shares.SECONDARY >= 0.25 && shares.TERTIARY >= 0.2
      && shares.QUATERNARY <= 0.2 && primarySecondary >= 0.6) {
      break;
    }
    if (shares.QUATERNARY > 0.2) {
      changed = shiftTotals(totals, limits, "QUATERNARY", ["PRIMARY", "SECONDARY", "TERTIARY"], 0.02) || changed;
    }
    if (shares.PRIMARY < 0.35 || primarySecondary < 0.6) {
      changed = shiftTotals(totals, limits, "QUATERNARY", ["PRIMARY"], 0.02) || changed;
      changed = shiftTotals(totals, limits, "TERTIARY", ["PRIMARY"], 0.015) || changed;
    }
    if (shares.SECONDARY < 0.25) {
      changed = shiftTotals(totals, limits, "QUATERNARY", ["SECONDARY"], 0.02) || changed;
      changed = shiftTotals(totals, limits, "TERTIARY", ["SECONDARY"], 0.01) || changed;
    }
    if (shares.TERTIARY < 0.2) {
      changed = shiftTotals(totals, limits, "QUATERNARY", ["TERTIARY"], 0.02) || changed;
    }
  }
  const finalBands = buildBands(counts, totals, symmetry, seed, scale, baseHue, true);
  const finalShares = computeAreaShares(finalBands);
  const finalPrimarySecondary = finalShares.PRIMARY + finalShares.SECONDARY;
  if (finalShares.PRIMARY < 0.35 || finalShares.SECONDARY < 0.25 || finalShares.TERTIARY < 0.2
    || finalShares.QUATERNARY > 0.2 || finalPrimarySecondary < 0.6) {
    changed = shiftTotals(totals, limits, "QUATERNARY", ["PRIMARY"], 0.02) || changed;
  }
  return { totals, changed };
}

function shiftTotals(totals, limits, fromLevel, toLevels, amount) {
  const fromCap = totals[fromLevel] - limits.minTotals[fromLevel];
  if (fromCap <= 1e-6) {
    return false;
  }
  let remaining = Math.min(amount, fromCap);
  let moved = 0;
  for (const toLevel of toLevels) {
    const toCap = limits.maxTotals[toLevel] - totals[toLevel];
    if (toCap <= 1e-6) {
      continue;
    }
    const delta = Math.min(toCap, remaining);
    totals[toLevel] += delta;
    remaining -= delta;
    moved += delta;
    if (remaining <= 1e-6) {
      break;
    }
  }
  totals[fromLevel] -= moved;
  return moved > 0;
}

function buildBands(counts, totals, symmetry, seed, scale, baseHue, forArea = false) {
  const { angles, step } = buildAngles(symmetry);
  const levels = buildLevelList(counts);
  const bandTotals = {};
  for (const level of LEVELS) {
    bandTotals[level] = totals[level] / counts[level];
  }
  const bands = [];
  let cursor = 0;
  for (let i = 0; i < levels.length; i++) {
    const level = levels[i];
    const thickness = bandTotals[level];
    const rInnerNorm = cursor;
    const rOuterNorm = cursor + thickness;
    cursor = rOuterNorm;
    const rng = createRng(hashInts(seed, 3001, i));
    const expressiveScale = LEVEL_EXPRESSIVE_FALLOFF[level] ?? 1;
    let bulgeBase = baseBulgeForLevel(level) * expressiveScale;
    if (level !== "PRIMARY") {
      bulgeBase *= (1 + randomRange(rng, -0.05, 0.05));
    }
    const levelIndex = bands.filter((band) => band.level === level).length;
    const maxIndexForLevel = counts[level] - 1;
    const pattern = patternForBand(level, levelIndex, symmetry, maxIndexForLevel);
    const parentHue = bands.length === 0 ? baseHue : bands[bands.length - 1].hue;
    const hueOffset = bandHueOffset(level, levelIndex) * expressiveScale;
    const hue = clampHueToParent(parentHue, parentHue + hueOffset, 15);
    const splitChance = clamp((LEVEL_SPLIT_BASE[level] ?? 0) * expressiveScale, 0, 1);
    const band = {
      index: i,
      levelIndex,
      maxIndexForLevel,
      level,
      pattern,
      symmetry,
      angles,
      step,
      rInner: rInnerNorm * scale,
      rOuter: rOuterNorm * scale,
      rInnerNorm,
      rOuterNorm,
      thicknessNorm: thickness,
      bulgeBase,
      expressiveScale,
      splitChance,
      hue,
      parentHue,
      fillFrac: forArea ? LEVEL_FILL_FRAC[level] : LEVEL_FILL_FRAC[level],
      seedSalt: 4000 + i * 61
    };
    if (i === levels.length - 1) {
      band.level = "QUATERNARY";
      band.pattern = PATTERNS.UNIFORM;
      band.bulgeBase = 0.12 * (LEVEL_EXPRESSIVE_FALLOFF.QUATERNARY ?? 1);
      band.expressiveScale = LEVEL_EXPRESSIVE_FALLOFF.QUATERNARY ?? 1;
      band.splitChance = clamp((LEVEL_SPLIT_BASE.QUATERNARY ?? 0) * band.expressiveScale, 0, 1);
      band.fillFrac = 0.06;
      band.isFrame = true;
    }
    bands.push(band);
  }
  return bands;
}

function createRingLayout(seed, symmetry, bandCount, scale, baseHue) {
  const counts = allocateLevelCounts(bandCount);
  const { totals, minTotals, maxTotals } = computeLevelTotals(counts);
  const adjusted = adjustTotalsForArea(
    totals,
    { minTotals, maxTotals },
    counts,
    symmetry,
    seed,
    scale,
    baseHue
  );
  let bands = buildBands(counts, adjusted.totals, symmetry, seed, scale, baseHue, false);
  const shares = computeAreaShares(bands);
  const primarySecondary = shares.PRIMARY + shares.SECONDARY;
  if (shares.PRIMARY < 0.35 || shares.SECONDARY < 0.25 || shares.TERTIARY < 0.2
    || shares.QUATERNARY > 0.2 || primarySecondary < 0.6) {
    shiftTotals(adjusted.totals, { minTotals, maxTotals }, "QUATERNARY", ["PRIMARY"], 0.02);
    bands = buildBands(counts, adjusted.totals, symmetry, seed, scale, baseHue, false);
  }
  return { bands, counts };
}

function baseBulgeForLevel(level) {
  switch (level) {
    case "PRIMARY":
      return 0.74;
    case "SECONDARY":
      return 0.52;
    case "TERTIARY":
      return 0.42;
    case "QUATERNARY":
      return 0.22;
    default:
      return 0.5;
  }
}

function patternForBand(level, levelIndex, symmetry, maxIndexForLevel) {
  const expressiveScale = LEVEL_EXPRESSIVE_FALLOFF[level] ?? 1;
  if (level === "PRIMARY") {
    return PATTERNS.UNIFORM;
  }
  if (level === "SECONDARY") {
    const patterns = [PATTERNS.ALTERNATING, PATTERNS.GROUPED_2];
    const count = Math.max(1, Math.floor(patterns.length * expressiveScale));
    return patterns[levelIndex % count];
  }
  if (level === "TERTIARY") {
    if (levelIndex === maxIndexForLevel) {
      return PATTERNS.UNIFORM;
    }
    const patterns = [PATTERNS.GROUPED_2, PATTERNS.ALTERNATING, PATTERNS.GROUPED_3];
    const count = Math.max(1, Math.floor(patterns.length * expressiveScale));
    return patterns[levelIndex % count];
  }
  const patterns = [PATTERNS.ALTERNATING, PATTERNS.GROUPED_2, PATTERNS.UNIFORM];
  const count = Math.max(1, Math.floor(patterns.length * expressiveScale));
  return patterns[levelIndex % count];
}

function patternVariant(pattern, sliceIndex) {
  switch (pattern) {
    case PATTERNS.ALTERNATING:
      return sliceIndex % 2 === 0 ? "A" : "B";
    case PATTERNS.GROUPED_2:
      return Math.floor(sliceIndex / 2) % 2 === 0 ? "A" : "B";
    case PATTERNS.GROUPED_3:
      return Math.floor(sliceIndex / 3) % 2 === 0 ? "A" : "B";
    case PATTERNS.UNIFORM:
    default:
      return "A";
  }
}

function bandHueOffset(level, levelIndex) {
  switch (level) {
    case "PRIMARY":
      return 0;
    case "SECONDARY":
      return levelIndex % 2 === 0 ? 10 : -10;
    case "TERTIARY":
      return levelIndex % 2 === 0 ? 8 : -8;
    case "QUATERNARY":
      return levelIndex % 2 === 0 ? 6 : -6;
    default:
      return 0;
  }
}

function buildPalette(baseHue) {
  return {
    baseHue,
    baseFill: hslColor(baseHue, 0.22, 0.08),
    lead: hslColor(baseHue, 0.08, 0.14)
  };
}

function levelColor(level, hue, variant, parentHue, arcConstraint = false) {
  const range = LEVEL_COLOR[level];
  let s = (range.s[0] + range.s[1]) / 2;
  let l = (range.l[0] + range.l[1]) / 2;
  const variantShift = variant === "A" ? 0.015 : -0.015;
  l = clamp(l + variantShift, range.l[0], range.l[1]);
  const hueShift = variant === "A" ? 8 : -8;
  const baseHue = parentHue ?? hue;
  let desiredHue = hue + hueShift;
  let maxDelta = 15;
  if (level === "SECONDARY" && variant === "B" && (hue | 0) % 2 === 0) {
    const accent1 = (baseHue + 120) % 360;
    const accent2 = (baseHue + 240) % 360;
    desiredHue = hashInts(baseHue | 0, 77) % 2 === 0 ? accent1 : accent2;
    maxDelta = 12;
  }
  const targetHue = clampHueToParent(baseHue, desiredHue, maxDelta);
  if (arcConstraint) {
    s = Math.min(s, 0.22);
    l = Math.min(l, 0.34);
  }
  return hslColor(targetHue, s, l);
}

function shouldSplit(seed, band, sliceIndex) {
  const splitChance = band.splitChance ?? 0;
  if (splitChance <= 0) {
    return false;
  }
  const roll = (hashInts(seed, band.seedSalt, sliceIndex) % 1000) / 1000;
  return roll < splitChance;
}

function drawPetalCell(ctx, angleStart, angleEnd, rInner, rOuter, bulge, outline = null) {
  const span = angleEnd - angleStart;
  const mid = (angleStart + angleEnd) / 2;
  const outerBulge = rOuter * (1 + bulge * 0.16);
  const innerBulge = Math.max(0.001, rInner * (1 - bulge * 0.1));

  const p0 = polar(angleStart, rInner);
  const p3 = polar(angleEnd, rInner);
  const pm = polar(mid, outerBulge);

  const leftCtrl = polar(angleStart + span * 0.32, rOuter);
  const rightCtrl = polar(angleEnd - span * 0.32, rOuter);

  const innerCtrlA = polar(angleEnd - span * 0.28, innerBulge);
  const innerCtrlB = polar(angleStart + span * 0.28, innerBulge);

  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.quadraticCurveTo(leftCtrl.x, leftCtrl.y, pm.x, pm.y);
  ctx.quadraticCurveTo(rightCtrl.x, rightCtrl.y, p3.x, p3.y);
  ctx.bezierCurveTo(innerCtrlA.x, innerCtrlA.y, innerCtrlB.x, innerCtrlB.y, p0.x, p0.y);
  ctx.closePath();
  ctx.fill();
  if (outline && outline.width > 0 && outline.alpha > 0) {
    ctx.save();
    ctx.globalAlpha *= outline.alpha;
    ctx.strokeStyle = outline.color;
    ctx.lineWidth = outline.width;
    ctx.stroke();
    ctx.restore();
  }
}

function drawArcCell(ctx, angleStart, angleEnd, rInner, rOuter, bulge, outline = null) {
  const span = angleEnd - angleStart;
  const mid = (angleStart + angleEnd) / 2;
  const outerBulge = rOuter * (1 + bulge * 0.1);
  const innerBulge = Math.max(0.001, rInner * (1 - bulge * 0.05));

  const p0 = polar(angleStart, rInner);
  const p3 = polar(angleEnd, rInner);
  const pm = polar(mid, outerBulge);

  const leftCtrl = polar(angleStart + span * 0.3, rOuter);
  const rightCtrl = polar(angleEnd - span * 0.3, rOuter);
  const innerCtrlA = polar(angleEnd - span * 0.26, innerBulge);
  const innerCtrlB = polar(angleStart + span * 0.26, innerBulge);

  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.quadraticCurveTo(leftCtrl.x, leftCtrl.y, pm.x, pm.y);
  ctx.quadraticCurveTo(rightCtrl.x, rightCtrl.y, p3.x, p3.y);
  ctx.bezierCurveTo(innerCtrlA.x, innerCtrlA.y, innerCtrlB.x, innerCtrlB.y, p0.x, p0.y);
  ctx.closePath();
  ctx.fill();
  if (outline && outline.width > 0 && outline.alpha > 0) {
    ctx.save();
    ctx.globalAlpha *= outline.alpha;
    ctx.strokeStyle = outline.color;
    ctx.lineWidth = outline.width;
    ctx.stroke();
    ctx.restore();
  }
}

function drawCellWithLead(ctx, angleStart, angleEnd, rInner, rOuter, bulge, leadThickness, leadColor, fillColor, leadBulgeFactor = 0.25, outline = null) {
  const span = rOuter - rInner;
  const thickness = Math.min(leadThickness, span * 0.25);
  if (thickness > 0.001) {
    ctx.fillStyle = leadColor;
    drawPetalCell(ctx, angleStart, angleEnd, rInner, rOuter, bulge * leadBulgeFactor);
  }
  ctx.fillStyle = fillColor;
  const inner = rInner + thickness;
  const outer = rOuter - thickness;
  if (outer > inner) {
    drawPetalCell(ctx, angleStart, angleEnd, inner, outer, bulge, outline);
  }
}

function drawInterBandLead(ctx, radius, thickness, leadColor) {
  if (thickness <= 0) return;

  const rInner = Math.max(0, radius - thickness / 2);
  const rOuter = radius + thickness / 2;

  ctx.fillStyle = leadColor;
  ctx.beginPath();
  ctx.arc(0, 0, rOuter, 0, TWO_PI);
  ctx.arc(0, 0, rInner, TWO_PI, 0, true);
  ctx.closePath();
  ctx.fill();
}

function drawLeadSector(ctx, angleStart, angleEnd, rInner, rOuter, leadColor) {
  if (rOuter <= rInner) {
    return;
  }
  ctx.fillStyle = leadColor;
  ctx.beginPath();
  ctx.arc(0, 0, rOuter, angleStart, angleEnd);
  ctx.arc(0, 0, rInner, angleEnd, angleStart, true);
  ctx.closePath();
  ctx.fill();
}

function drawRingFill(ctx, rInner, rOuter, fillColor) {
  if (rOuter <= rInner) {
    return;
  }
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.arc(0, 0, rOuter, 0, TWO_PI);
  ctx.arc(0, 0, rInner, TWO_PI, 0, true);
  ctx.closePath();
  ctx.fill();
}

function drawFrameBand(ctx, band, palette, leadThickness, drawLeads = true) {
  const frameColor = hslColor(band.hue, 0.06, 0.11);
  drawRingFill(ctx, band.rInner, band.rOuter, frameColor);
  if (drawLeads) {
    const frameLead = leadThickness * 1.45;
    drawInterBandLead(ctx, band.rInner, frameLead, palette.lead);
    drawInterBandLead(ctx, band.rOuter, frameLead, palette.lead);
  }
}

function drawBandDebug(ctx, band) {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, band.rInner, 0, TWO_PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, band.rOuter, 0, TWO_PI);
  ctx.stroke();
  const mid = (band.rInner + band.rOuter) * 0.5;
  const fontSize = Math.max(10, band.scale * 0.015);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(band.level, mid, 0);
  ctx.restore();
}

function variantParams(band, variant) {
  if (band.level === "PRIMARY") {
    return { bulge: band.bulgeBase, innerInset: 0.0, outerInset: 0.0 };
  }
  if (band.level === "TERTIARY" && band.levelIndex === band.maxIndexForLevel) {
    return {
      bulge: Math.min(band.bulgeBase * 0.55, 0.28),
      innerInset: 0.10,
      outerInset: 0.18
    };
  }
  if (band.pattern === PATTERNS.ALTERNATING) {
    const base = band.bulgeBase;
    const bulgeA = clamp(base * 1.05, 0.45, 0.6);
    const bulgeB = clamp(base * 0.85, 0.35, 0.5);
    return {
      bulge: variant === "A" ? bulgeA : bulgeB,
      innerInset: variant === "A" ? 0.04 : 0.09,
      outerInset: variant === "A" ? 0.03 : 0.07
    };
  }
  const bulge = variant === "A" ? band.bulgeBase * 1.05 : band.bulgeBase * 0.8;
  return {
    bulge,
    innerInset: variant === "A" ? 0.05 : 0.1,
    outerInset: variant === "A" ? 0.04 : 0.08
  };
}

function drawBandCells(ctx, band, palette, seed, leadThickness) {
  const level = band.level;
  const step = band.step;
  const span = band.rOuter - band.rInner;
  const coreRadius = PRIMARY_CORE_RADIUS_FRAC * band.scale;
  const leadBulgeBase = level === "PRIMARY" ? 1 : 0.25;
  const leadBulgeFactor = leadBulgeBase * (band.expressiveScale ?? 1);
  const outlineWidth = Math.max(0.6, band.scale * 0.0012 * PETAL_OUTLINE_WIDTH);
  const outline = (PETAL_OUTLINE_ALPHA > 0 && outlineWidth > 0)
    ? { color: PETAL_OUTLINE_COLOR, alpha: PETAL_OUTLINE_ALPHA, width: outlineWidth }
    : null;
  const thinOutline = outline
    ? { color: outline.color, alpha: outline.alpha, width: outline.width * 0.7 }
    : null;
  for (let i = 0; i < band.symmetry; i++) {
    let a0 = band.angles[i];
    let a1 = band.angles[i + 1];
    if (band.level === "TERTIARY" && band.levelIndex === band.maxIndexForLevel) {
      const shrink = (a1 - a0) * 0.18;
      a0 += shrink * 0.5;
      a1 -= shrink * 0.5;
    }
    const spanAngle = a1 - a0;
    if (spanAngle >= TWO_PI - 1e-6) {
      continue;
    }
    const variant = patternVariant(band.pattern, i);
    const params = variantParams(band, variant);
    let insetInner = params.innerInset * span;
    let insetOuter = params.outerInset * span;
    if (band.level === "PRIMARY") {
      insetInner = 0;
      insetOuter = 0;
    }
    const rInner = band.level === "PRIMARY"
      ? Math.max(band.rInner, coreRadius)
      : band.rInner + insetInner;
    const rOuter = band.rOuter - insetOuter;
    const parentHue = band.parentHue ?? band.hue;
    const fillColor = levelColor(level, band.hue, variant, parentHue, level === "QUATERNARY");

    if (level === "PRIMARY") {
      const t = (rOuter - rInner) * 0.08; // subtle taper
      const inner = rInner;
      const outer = rOuter - t;
      drawCellWithLead(
        ctx,
        a0,
        a1,
        inner,
        outer,
        params.bulge * 0.95,
        leadThickness * 1.05,
        palette.lead,
        fillColor,
        leadBulgeFactor,
        outline
      );
      continue;
    }


    const allowSplit = level === "TERTIARY" || (level === "SECONDARY" && band.symmetry >= 12);
    if (allowSplit && shouldSplit(seed, band, i)) {
      const mid = (a0 + a1) / 2;
      drawCellWithLead(ctx, a0, mid, rInner, rOuter, params.bulge, leadThickness, palette.lead, fillColor, leadBulgeFactor, outline);
      drawCellWithLead(ctx, mid, a1, rInner, rOuter, params.bulge * 0.85, leadThickness, palette.lead, fillColor, leadBulgeFactor, outline);
      continue;
    }

    if (level === "QUATERNARY") {
      const mode = hashInts(seed, band.seedSalt, i) % 8;
      if (mode === 0) {
        const arcThicknessMax = 0.025 * band.scale;
        const arcThickness = Math.min((band.rOuter - band.rInner) * 0.35, arcThicknessMax);
        const arcInner = band.rInner + (band.rOuter - band.rInner) * 0.25;
        const arcOuter = Math.min(band.rOuter, arcInner + arcThickness);
        if (arcOuter > arcInner) {
          const leadT = Math.min(leadThickness * 0.35, (band.rOuter - band.rInner) * 0.2);
          const leadInner = Math.max(0, arcInner - leadT * 0.5);
          const leadOuter = arcOuter + leadT * 0.5;
          drawLeadSector(ctx, a0, a1, leadInner, leadOuter, palette.lead);
          ctx.fillStyle = fillColor;
          drawArcCell(ctx, a0, a1, arcInner, arcOuter, params.bulge * 0.4, thinOutline);
        }
      } else {
        const rMid = (band.rInner + band.rOuter) * 0.5;
        const t = Math.min(leadThickness * 0.35, (band.rOuter - band.rInner) * 0.35);
        const rInnerLead = Math.max(0, rMid - t / 2);
        const rOuterLead = rMid + t / 2;
        drawLeadSector(ctx, a0, a1, rInnerLead, rOuterLead, palette.lead);
      }
      continue;
    }

    drawCellWithLead(ctx, a0, a1, rInner, rOuter, params.bulge, leadThickness, palette.lead, fillColor, leadBulgeFactor, outline);
  }
}

function generateMandalaCanvas(seed) {
  const size = TEXTURE_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  const rMax = size * 0.475;
  const baseRng = createRng(hashInts(seed, 991));
  const symmetry = chooseSymmetry(seed);
  const bandCount = chooseBandCount(seed);
  const scaleJitter = clamp(1 + randomRange(baseRng, -0.03, 0.03), 0.97, 1.03);
  const scale = scaleJitter;

  const baseHue = baseRng() * 360;
  const palette = buildPalette(baseHue);

  const layout = createRingLayout(seed, symmetry, bandCount, scale, baseHue);
  const bands = layout.bands;
  for (const band of bands) {
    band.rInner *= rMax;
    band.rOuter *= rMax;
    band.scale = rMax;
  }

  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.fillStyle = palette.baseFill;
  ctx.beginPath();
  ctx.arc(0, 0, rMax, 0, TWO_PI);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(size / 2, size / 2);
  for (let i = 0; i < bands.length - 1; i++) {
    const current = bands[i];
    const next = bands[i + 1];
    if (current.isFrame || next.isFrame) {
      continue;
    }
    const boundary = current.rOuter;
    const boundaryLevel = current.level;
    const required = boundaryLevel === "PRIMARY" || boundaryLevel === "SECONDARY";
    if (!required && boundaryLevel !== "TERTIARY") {
      continue;
    }
    const baseThickness = rMax * LEAD_BASE_K * (LEAD_FACTORS[boundaryLevel] ?? 0.5);
    const cap = Math.min(baseThickness, (next.rOuter - next.rInner) * 0.35);
    drawInterBandLead(ctx, boundary, cap, palette.lead);
  }
  const primaryBand = bands.find((band) => band.level === "PRIMARY");
  if (primaryBand) {
    const haloR = primaryBand.rOuter;
    const haloT = rMax * LEAD_BASE_K * 0.8;
    drawInterBandLead(ctx, haloR, haloT, palette.lead);
  }
  const frameBand = bands.find((band) => band.isFrame);
  if (frameBand) {
    const leadThickness = rMax * LEAD_BASE_K * (LEAD_FACTORS[frameBand.level] ?? 0.5);
    const frameLead = leadThickness * 1.45;
    drawInterBandLead(ctx, frameBand.rInner, frameLead, palette.lead);
    drawInterBandLead(ctx, frameBand.rOuter, frameLead, palette.lead);
  }
  const oculusRadius = PRIMARY_CORE_RADIUS_FRAC * rMax * 0.92;
  const primaryLead = rMax * LEAD_BASE_K * LEAD_FACTORS.PRIMARY;
  drawInterBandLead(ctx, oculusRadius, primaryLead * 1.1, palette.lead);
  ctx.restore();

  ctx.save();
  ctx.translate(size / 2, size / 2);
  for (let i = bands.length - 1; i >= 0; i--) {
    const band = bands[i];
    const leadThickness = rMax * LEAD_BASE_K * (LEAD_FACTORS[band.level] ?? 0.5);
    if (band.isFrame) {
      drawFrameBand(ctx, band, palette, leadThickness, false);
      if (DEBUG_BANDS) {
        drawBandDebug(ctx, band);
      }
      continue;
    }
    const useLead = band.level !== "QUATERNARY" || band.index % 2 === 0;
    drawBandCells(ctx, band, palette, seed, useLead ? leadThickness : leadThickness * 0.4);
    if (DEBUG_BANDS) {
      drawBandDebug(ctx, band);
    }
  }

  ctx.fillStyle = hslColor(baseHue, 0.18, 0.16);
  ctx.beginPath();
  ctx.arc(0, 0, oculusRadius, 0, TWO_PI);
  ctx.closePath();
  ctx.fill();

  const rosetteSymmetry = Math.max(6, Math.floor(symmetry / 2));
  const rosetteStep = TWO_PI / rosetteSymmetry;
  const rosetteInner = oculusRadius * 0.25;
  const rosetteOuter = oculusRadius * 0.85;
  const rosetteBulge = 0.22 * (LEVEL_EXPRESSIVE_FALLOFF.PRIMARY ?? 1);
  const rosetteOutline = (PETAL_OUTLINE_ALPHA > 0 && PETAL_OUTLINE_WIDTH > 0)
    ? {
      color: PETAL_OUTLINE_COLOR,
      alpha: PETAL_OUTLINE_ALPHA,
      width: Math.max(0.4, rMax * 0.0009 * PETAL_OUTLINE_WIDTH)
    }
    : null;
  ctx.fillStyle = hslColor(baseHue, 0.18, 0.16);
  for (let i = 0; i < rosetteSymmetry; i++) {
    const a0 = i * rosetteStep;
    const a1 = a0 + rosetteStep;
    drawArcCell(ctx, a0, a1, rosetteInner, rosetteOuter, rosetteBulge, rosetteOutline);
  }

  ctx.restore();

  if (BLUR_PX > 0 && BLUR_ALPHA > 0) {
    const temp = document.createElement("canvas");
    temp.width = size;
    temp.height = size;
    const tctx = temp.getContext("2d");
    tctx.drawImage(canvas, 0, 0);
    ctx.save();
    ctx.filter = `blur(${BLUR_PX}px)`;
    ctx.globalAlpha = BLUR_ALPHA;
    ctx.drawImage(temp, 0, 0);
    ctx.restore();
  }

  // Hard circular clip
  ctx.save();
  ctx.globalCompositeOperation = "destination-in";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, rMax, 0, TWO_PI);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  return canvas;
}

export class ApseBackground {
  constructor(center, radius, seed) {
    this.center = center;
    this.radius = radius;
    this.seed = seed;
    this.canvas = generateMandalaCanvas(seed);
  }

  draw(ctx, rotation = 0) {
    if (!this.canvas) {
      return;
    }
    const size = this.canvas.width;
    const textureRadius = size * 0.475;
    const scale = textureRadius > 0 ? this.radius / textureRadius : 1;
    ctx.save();
    ctx.translate(this.center.x, this.center.y);
    ctx.rotate(rotation + CLOCK_TO_CANVAS);
    ctx.scale(scale, scale);
    ctx.drawImage(this.canvas, -size / 2, -size / 2);
    ctx.restore();
  }
}
