import { CONFIG } from "./config.js";
import { filterRiversByView } from "./riverNetwork.js";

function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mixColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ];
}

function jitterColor(color, seed, amount) {
  const phase = (seed % 997) * 0.017;
  const jitter = amount * 0.5;
  const r = color[0] + Math.sin(phase) * jitter;
  const g = color[1] + Math.sin(phase + 2.1) * jitter;
  const b = color[2] + Math.sin(phase + 4.2) * jitter;
  return [
    clampValue(Math.round(r), 0, 255),
    clampValue(Math.round(g), 0, 255),
    clampValue(Math.round(b), 0, 255)
  ];
}

function rgba(color, alpha) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

function seededFloat(seed, offset = 0) {
  const x = Math.sin((seed + offset) * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function drawPolyline(ctx, points) {
  if (!points || points.length < 2) {
    return;
  }
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
}

function buildDistances(points) {
  if (!points || points.length === 0) {
    return [];
  }
  const distances = new Array(points.length);
  distances[0] = 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    total += Math.hypot(dx, dy);
    distances[i] = total;
  }
  return distances;
}

function drawScintillatedLine(ctx, points, distances, baseColor, baseAlpha, timeSeconds, scintillation, direction = 1) {
  if (!points || points.length < 2) {
    return;
  }
  const enabled = scintillation?.ENABLED !== false;
  const strength = clampValue(scintillation?.STRENGTH ?? 0, 0, 1);
  if (!enabled || strength <= 0 || !Number.isFinite(timeSeconds)) {
    ctx.strokeStyle = rgba(baseColor, baseAlpha);
    drawPolyline(ctx, points);
    return;
  }
  const wavelength = Math.max(20, scintillation?.WAVELENGTH ?? 240);
  const rate = scintillation?.RATE ?? 0.2;
  const hueShift = clampValue(scintillation?.HUE_SHIFT ?? 0, 0, 1);
  const phaseBase = timeSeconds * rate * direction;
  for (let i = 1; i < points.length; i++) {
    const dist = distances?.[i] ?? 0;
    const phase = (phaseBase + dist / wavelength) * Math.PI * 2;
    const t = 0.5 + 0.5 * Math.sin(phase);
    const alphaScale = 1 - strength + strength * (0.6 + 0.4 * t);
    const color = hueShift > 0 ? mixColor(baseColor, [255, 255, 255], hueShift * t) : baseColor;
    ctx.strokeStyle = rgba(color, baseAlpha * alphaScale);
    ctx.beginPath();
    ctx.moveTo(points[i - 1].x, points[i - 1].y);
    ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
  }
}

function buildUndulatedPoints(points, timeSeconds, wave, phaseOffset) {
  if (!points || points.length < 2) {
    return points;
  }
  const amplitude = wave.WAVE_AMPLITUDE ?? 0;
  const length = wave.WAVE_LENGTH ?? 1;
  const speed = wave.WAVE_SPEED ?? 0;
  if (amplitude <= 0 || length <= 0 || !Number.isFinite(timeSeconds)) {
    return points;
  }
  const totalCount = points.length;
  const out = new Array(totalCount);
  let distance = 0;
  out[0] = { x: points[0].x, y: points[0].y };
  for (let i = 1; i < totalCount; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const segLen = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    distance += segLen;
    const prevIdx = Math.max(0, i - 1);
    const nextIdx = Math.min(totalCount - 1, i + 1);
    const a = points[prevIdx];
    const b = points[nextIdx];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const edgeT = Math.min(i / (totalCount - 1), (totalCount - 1 - i) / (totalCount - 1));
    const edgeScale = clampValue(edgeT / 0.15, 0, 1);
    const phase = (distance / length) * Math.PI * 2 + timeSeconds * speed + phaseOffset;
    const offset = Math.sin(phase) * amplitude * edgeScale;
    out[i] = {
      x: curr.x + nx * offset,
      y: curr.y + ny * offset
    };
  }
  return out;
}

function buildOffsetPoints(points, offset) {
  if (!points || points.length < 2 || offset === 0) {
    return points;
  }
  const totalCount = points.length;
  const out = new Array(totalCount);
  out[0] = { x: points[0].x, y: points[0].y };
  for (let i = 1; i < totalCount; i++) {
    const prevIdx = Math.max(0, i - 1);
    const nextIdx = Math.min(totalCount - 1, i + 1);
    const a = points[prevIdx];
    const b = points[nextIdx];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const edgeT = Math.min(i / (totalCount - 1), (totalCount - 1 - i) / (totalCount - 1));
    const edgeScale = clampValue(edgeT / 0.15, 0, 1);
    const p = points[i];
    out[i] = {
      x: p.x + nx * offset * edgeScale,
      y: p.y + ny * offset * edgeScale
    };
  }
  return out;
}

function collectAnchors(rivers) {
  const anchors = new Map();
  for (const river of rivers) {
    if (!river?.anchors) {
      continue;
    }
    for (const anchor of river.anchors) {
      if (!anchor || anchors.has(anchor.id)) {
        continue;
      }
      anchors.set(anchor.id, { ...anchor });
    }
  }
  return [...anchors.values()];
}

function snapAnchorToStar(anchor, stars) {
  if (!stars || stars.length === 0) {
    return { ...anchor, snapped: false };
  }
  const snapRadius = CONFIG.RIVER.ANCHOR.SNAP_RADIUS;
  let best = null;
  let bestDist = snapRadius;
  for (const star of stars) {
    const dx = anchor.x - star.x;
    const dy = anchor.y - star.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= bestDist) {
      bestDist = dist;
      best = star;
    }
  }
  if (!best) {
    return { ...anchor, snapped: false };
  }
  return {
    ...anchor,
    x: best.x,
    y: best.y,
    snapped: true
  };
}

function anchorHuePhase(anchorId, worldAgeTicks) {
  const base = (anchorId % 997) * 0.013;
  return base + worldAgeTicks * 0.01;
}

export function drawRivers(ctx, rivers, viewRect, worldAgeTicks, activeStars = [], timeSeconds = null, highlight = 0) {
  if (!Array.isArray(rivers) || rivers.length === 0) {
    return;
  }

  const visible = viewRect ? filterRiversByView(rivers, viewRect) : rivers;
  if (visible.length === 0) {
    return;
  }

  const shimmerRate = CONFIG.RIVER.RENDER.SHIMMER_RATE;
  const baseColors = [
    [90, 210, 255],
    [200, 120, 255],
    [120, 180, 255]
  ];
  const wave = CONFIG.RIVER.RENDER;
  const chroma = wave.CHROMA_SPLIT;
  const flowDash = wave.FLOW_DASH;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const river of visible) {
    const width = clampValue(river.width ?? CONFIG.RIVER.WIDTH_MIN, 40, CONFIG.RIVER.WIDTH_MAX);
    const phase = (river.backboneId % 1024) * 0.005 + worldAgeTicks * shimmerRate;
    const wavePhase = (river.backboneId % 2048) * 0.003;
    const waveTime = Number.isFinite(timeSeconds) ? timeSeconds : worldAgeTicks;
    const basePulse = 1 - (wave.PULSE_AMOUNT ?? 0) * 0.5
      + Math.sin(waveTime * (wave.PULSE_RATE ?? 0.35) + phase) * (wave.PULSE_AMOUNT ?? 0);
    const pulseBoost = 1 + Math.max(0, Math.min(1, highlight)) * 0.5;
    const pulse = clampValue(basePulse * pulseBoost, 0, 2.2);
    const cacheTick = Math.floor(waveTime);
    if (!river._renderCache || river._renderCache.tick !== cacheTick) {
      const undulated = buildUndulatedPoints(river.points, cacheTick, wave, wavePhase);
      river._renderCache = {
        tick: cacheTick,
        points: undulated,
        distances: buildDistances(undulated),
        offsets: new Map()
      };
    }
    const points = river._renderCache.points;
    const distances = river._renderCache.distances;
    const shift = 0.5 + 0.5 * Math.sin(phase);
    const variance = wave.BASE_COLOR_VARIANCE ?? 0;
    const baseGlow = mixColor(baseColors[0], baseColors[1], shift);
    const baseCore = mixColor(baseColors[2], baseColors[1], 1 - shift);
    const glow = variance > 0 ? jitterColor(baseGlow, river.backboneId, variance) : baseGlow;
    const core = variance > 0 ? jitterColor(baseCore, river.backboneId + 19, variance) : baseCore;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (chroma?.OFFSETS?.length && chroma?.COLORS?.length) {
      const chromaAlpha = chroma.ALPHA ?? 0.08;
      const chromaWidth = chroma.WIDTH_SCALE ?? 0.2;
      for (let i = 0; i < chroma.OFFSETS.length; i++) {
        const offsetFactor = chroma.OFFSETS[i];
        const baseColor = chroma.COLORS[i % chroma.COLORS.length];
        const color = variance > 0 ? jitterColor(baseColor, river.backboneId + i * 37, variance) : baseColor;
        const offset = width * offsetFactor;
        const offsetKey = `${offset.toFixed(2)}:${chromaWidth.toFixed(2)}`;
        let offsetPoints = river._renderCache.offsets.get(offsetKey);
        if (!offsetPoints) {
          offsetPoints = buildOffsetPoints(points, offset);
          river._renderCache.offsets.set(offsetKey, offsetPoints);
        }
        ctx.lineWidth = Math.max(3, width * chromaWidth);
        ctx.strokeStyle = rgba(color, chromaAlpha * pulse);
        drawPolyline(ctx, offsetPoints);
      }
    }

    ctx.lineWidth = width * 0.7;
    ctx.strokeStyle = rgba(glow, CONFIG.RIVER.RENDER.OUTER_ALPHA * (0.75 + shift * 0.35) * pulse);
    drawPolyline(ctx, points);

    const scintillation = CONFIG.RIVER.RENDER.SCINTILLATION;
    const direction = river.backboneId % 2 === 0 ? 1 : -1;
    ctx.lineWidth = Math.max(10, width * 0.32);
    drawScintillatedLine(
      ctx,
      points,
      distances,
      core,
      CONFIG.RIVER.RENDER.MID_ALPHA * (0.8 + shift * 0.25) * pulse,
      waveTime,
      scintillation,
      direction
    );

    ctx.lineWidth = Math.max(4, width * 0.12);
    drawScintillatedLine(
      ctx,
      points,
      distances,
      core,
      CONFIG.RIVER.RENDER.CORE_ALPHA * pulse,
      waveTime,
      scintillation,
      direction
    );

    if (flowDash) {
      const dashLen = flowDash.LENGTH ?? 120;
      const gap = flowDash.GAP ?? 200;
      const speed = flowDash.SPEED ?? 0.5;
      ctx.save();
      ctx.lineWidth = Math.max(1.5, flowDash.WIDTH ?? 2);
      ctx.strokeStyle = rgba(flowDash.COLOR ?? core, (flowDash.ALPHA ?? 0.2) * pulse);
      ctx.setLineDash([dashLen, gap]);
      ctx.lineDashOffset = -(waveTime * speed * (dashLen + gap));
      drawPolyline(ctx, points);
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  const anchors = collectAnchors(visible);
  for (const anchor of anchors) {
    const snapped = snapAnchorToStar(anchor, activeStars);
    const phase = anchorHuePhase(anchor.id, worldAgeTicks);
    const t = 0.5 + 0.5 * Math.sin(phase);
    const colorSeed = seededFloat(anchor.id, 5.7);
    const altSeed = seededFloat(anchor.id, 11.3);
    const idxA = Math.floor(colorSeed * baseColors.length) % baseColors.length;
    const idxB = (idxA + 1 + Math.floor(altSeed * (baseColors.length - 1))) % baseColors.length;
    const outerColor = mixColor(baseColors[idxA], baseColors[idxB], t);
    const innerColor = mixColor(baseColors[idxB], baseColors[idxA], 1 - t);
    const sizeSeed = seededFloat(anchor.id, 2.4);
    const baseRadius = 80 + sizeSeed * 90;
    const radius = baseRadius * (snapped.snapped ? 1.25 : 1);
    const outerAlpha = CONFIG.RIVER.RENDER.OUTER_ALPHA;
    const midAlpha = CONFIG.RIVER.RENDER.MID_ALPHA;
    const coreAlpha = CONFIG.RIVER.RENDER.CORE_ALPHA * (snapped.snapped ? 0.9 : 1);

    ctx.save();
    const gradOuter = ctx.createRadialGradient(
      snapped.x,
      snapped.y,
      0,
      snapped.x,
      snapped.y,
      radius * 1.8
    );
    gradOuter.addColorStop(0, rgba(outerColor, outerAlpha));
    gradOuter.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradOuter;
    ctx.beginPath();
    ctx.arc(snapped.x, snapped.y, radius * 1.8, 0, Math.PI * 2);
    ctx.fill();

    const gradMid = ctx.createRadialGradient(
      snapped.x,
      snapped.y,
      0,
      snapped.x,
      snapped.y,
      radius
    );
    gradMid.addColorStop(0, rgba(innerColor, midAlpha));
    gradMid.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradMid;
    ctx.beginPath();
    ctx.arc(snapped.x, snapped.y, radius, 0, Math.PI * 2);
    ctx.fill();

    const gradCore = ctx.createRadialGradient(
      snapped.x,
      snapped.y,
      0,
      snapped.x,
      snapped.y,
      radius * 0.5
    );
    gradCore.addColorStop(0, rgba(innerColor, coreAlpha));
    gradCore.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradCore;
    ctx.beginPath();
    ctx.arc(snapped.x, snapped.y, radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}
