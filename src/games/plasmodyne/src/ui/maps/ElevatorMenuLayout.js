export function createElevatorMenuLayout(model, options = {}) {
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const width = options.width ?? 720;
  const height = options.height ?? 400;
  const rowGap = height / Math.max(1, model.deckRows.length - 1);
  const left = x + width * 0.04;
  const right = x + width * 0.96;
  const availableWidth = right - left;
  const rowYByDeck = new Map();
  const shaftXById = new Map();
  const levelById = new Map();

  for (const row of model.deckRows) {
    rowYByDeck.set(row.deckId, y + row.yIndex * rowGap);
    for (const level of row.levels) {
      levelById.set(level.levelId, level);
    }
  }

  assignShaftPositions(model, levelById, shaftXById, x, width);

  const rects = [];
  for (const row of model.deckRows) {
    const sorted = [...row.levels].sort((a, b) => (a.xBand ?? 0.5) - (b.xBand ?? 0.5));
    for (const level of sorted) {
      const servedShaftXs = (level.connectedShaftIds ?? [])
        .map((shaftId) => shaftXById.get(shaftId))
        .filter((value) => value !== undefined);
      const widthRatio = level.visualSlice?.widthRatio ?? 0.5;
      const minWidth = getLevelMinWidth(level, sorted.length, width);
      const maxWidth = getLevelMaxWidth(level, width);
      const baseWidth = minWidth + (maxWidth - minWidth) * Math.pow(widthRatio, 0.68);
      const shaftSpan = servedShaftXs.length > 1 ? Math.max(...servedShaftXs) - Math.min(...servedShaftXs) : 0;
      const rectWidth = Math.max(minWidth, Math.min(maxWidth, Math.max(baseWidth, shaftSpan + width * 0.12)));
      const rectHeight = getLevelVisualHeight(level, rowGap);
      const rowY = rowYByDeck.get(row.deckId);
      const preferredX = getPreferredLevelX(level, servedShaftXs, rectWidth, left, right);
      rects.push({
        x: preferredX,
        y: rowY - rectHeight / 2,
        width: rectWidth,
        height: rectHeight,
        centerY: rowY,
        row,
        level,
        servedShaftXs
      });
    }
  }

  resolveHorizontalOverlaps(rects, left, right);
  packVerticalComponents(rects, y, y + height);
  keepShaftsInsideServedLevelsOnly(model, rects, shaftXById);
  alignServedLevelsToVerticalShafts(model, rects, shaftXById, left, right);
  for (let i = 0; i < 5; i += 1) {
    sliceUnservedLevelsAwayFromShaftTracks(model, rects, shaftXById, left, right);
    ensureEveryLevelHasVisibleStop(rects, shaftXById, left, right);
  }
  refreshRectShaftXs(model, rects, shaftXById);
  const levelRects = new Map(rects.map((rect) => [rect.level.levelId, rect]));

  return {
    x,
    y,
    width,
    height,
    rowGap,
    rowYByDeck,
    shaftXById,
    levelRects,
    rects
  };
}

export function getLevelVisualHeight(level, rowGap) {
  if (level.sizeClass === 'tiny') return Math.max(15, rowGap * 0.32);
  const ratio = level.visualSlice?.thicknessRatio ?? 0.5;
  const regular = Math.max(24, rowGap * 0.62);
  if (ratio >= 0.9) return Math.min(rowGap * 2.75, regular * 4.8);
  if (ratio >= 0.74) return Math.min(rowGap * 2.08, regular * 3.65);
  if (ratio >= 0.52) return Math.min(rowGap * 1.48, regular * 2.45);
  if (ratio <= 0.16) return Math.max(16, regular * 0.58);
  return regular;
}

function getLevelMinWidth(level, sameDeckLevelCount, width) {
  if (level.sizeClass === 'tiny') return width * 0.12;
  if (level.sizeClass === 'small') return width * 0.18;
  return sameDeckLevelCount >= 3 ? width * 0.12 : sameDeckLevelCount === 2 ? width * 0.16 : width * 0.2;
}

function getLevelMaxWidth(level, width) {
  if (level.sizeClass === 'tiny') return width * 0.28;
  if (level.sizeClass === 'small') return width * 0.42;
  if (level.sizeClass === 'regular') return width * 0.58;
  if (level.sizeClass === 'large') return width * 0.7;
  return width * 0.76;
}

function assignShaftPositions(model, levelById, shaftXById, x, width) {
  const left = x + width * 0.08;
  const span = width * 0.84;
  const shaftTargets = model.shafts.map((shaft, index) => {
    const servedBands = (shaft.stops ?? [])
      .map((stop) => levelById.get(stop.levelId)?.xBand)
      .filter((value) => value !== undefined);
    const averageBand = servedBands.length
      ? servedBands.reduce((sum, value) => sum + value, 0) / servedBands.length
      : shaft.xBand ?? (0.14 + index * 0.12);
    const deterministicNudge = (((hashString(shaft.shaftId) % 17) - 8) / 100);
    return {
      shaft,
      target: clamp((averageBand * 0.76) + ((shaft.xBand ?? averageBand) * 0.24) + deterministicNudge, 0.04, 0.96)
    };
  }).sort((a, b) => a.target - b.target);

  const minSpacing = Math.min(width * 0.14, Math.max(width * 0.07, span / Math.max(5, shaftTargets.length + 1)));
  for (let i = 1; i < shaftTargets.length; i += 1) {
    shaftTargets[i].target = Math.max(shaftTargets[i].target, shaftTargets[i - 1].target + minSpacing / span);
  }
  for (let i = shaftTargets.length - 2; i >= 0; i -= 1) {
    shaftTargets[i].target = Math.min(shaftTargets[i].target, shaftTargets[i + 1].target - minSpacing / span);
  }
  for (const item of shaftTargets) {
    shaftXById.set(item.shaft.shaftId, left + clamp(item.target, 0.03, 0.97) * span);
  }
}

function getPreferredLevelX(level, servedShaftXs, rectWidth, left, right) {
  if (servedShaftXs.length > 1) {
    const minShaft = Math.min(...servedShaftXs);
    const maxShaft = Math.max(...servedShaftXs);
    return clamp((minShaft + maxShaft) / 2 - rectWidth / 2, left, right - rectWidth);
  }
  if (servedShaftXs.length === 1) {
    const shaftX = servedShaftXs[0];
    const levelBand = level.xBand ?? 0.5;
    const shaftInset = levelBand < 0.18 ? rectWidth * 0.78 : rectWidth * 0.16;
    return clamp(shaftX - shaftInset, left, right - rectWidth);
  }
  return clamp(left + ((level.xBand ?? 0.5) * (right - left)) - rectWidth / 2, left, right - rectWidth);
}

function resolveHorizontalOverlaps(rects, left, right) {
  const padding = 1;
  const ordered = [...rects].sort((a, b) => (b.width * b.height) - (a.width * a.height));
  for (const rect of ordered) {
    const candidates = buildCandidateXs(rect, left, right);
    let bestX = rect.x;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidateX of candidates) {
      const candidate = { ...rect, x: candidateX };
      const overlapArea = rects
        .filter((other) => other !== rect)
        .reduce((sum, other) => sum + getOverlapArea(candidate, other, padding), 0);
      const shaftPenalty = containsServedShafts(candidate) ? 0 : 100000;
      const driftPenalty = Math.abs(candidateX - rect.x) * 0.2;
      const score = overlapArea + shaftPenalty + driftPenalty;
      if (score < bestScore) {
        bestScore = score;
        bestX = candidateX;
        if (score === 0) break;
      }
    }
    rect.x = bestX;
  }

}

function packVerticalComponents(rects, top, bottom) {
  const components = buildHorizontalComponents(rects);
  for (const component of components) {
    const sorted = component.sort((a, b) => {
      if (a.row.yIndex !== b.row.yIndex) return a.row.yIndex - b.row.yIndex;
      return a.x - b.x;
    });
    const totalHeight = sorted.reduce((sum, rect) => sum + rect.height, 0);
    const availableHeight = bottom - top;
    if (totalHeight > availableHeight) {
      const scale = availableHeight / totalHeight;
      for (const rect of sorted) {
        rect.height = Math.max(10, rect.height * scale);
      }
    }
    const stackHeight = sorted.reduce((sum, rect) => sum + rect.height, 0);
    const desiredCenter = sorted.reduce((sum, rect) => sum + rect.centerY, 0) / Math.max(1, sorted.length);
    let cursor = clamp(desiredCenter - stackHeight / 2, top, bottom - stackHeight);
    for (const rect of sorted) {
      rect.y = cursor;
      rect.centerY = cursor + rect.height / 2;
      cursor += rect.height;
    }
  }
}

function buildHorizontalComponents(rects) {
  const remaining = new Set(rects);
  const components = [];
  while (remaining.size) {
    const first = remaining.values().next().value;
    const component = [];
    const queue = [first];
    remaining.delete(first);
    while (queue.length) {
      const rect = queue.pop();
      component.push(rect);
      for (const other of [...remaining]) {
        if (rangesOverlap(rect.x, rect.x + rect.width, other.x, other.x + other.width)) {
          remaining.delete(other);
          queue.push(other);
        }
      }
    }
    components.push(component);
  }
  return components;
}

function keepShaftsInsideServedLevelsOnly(model, rects, shaftXById) {
  for (const shaft of model.shafts) {
    const servedIds = new Set((shaft.stops ?? []).map((stop) => stop.levelId));
    const servedRects = rects.filter((rect) => servedIds.has(rect.level.levelId));
    if (!servedRects.length) continue;
    const minAllowed = Math.max(...servedRects.map((rect) => rect.x + 5));
    const maxAllowed = Math.min(...servedRects.map((rect) => rect.x + rect.width - 5));
    if (minAllowed > maxAllowed) continue;
    const current = clamp(shaftXById.get(shaft.shaftId) ?? (minAllowed + maxAllowed) / 2, minAllowed, maxAllowed);
    const candidates = [
      current,
      minAllowed,
      maxAllowed,
      (minAllowed + maxAllowed) / 2,
      minAllowed + (maxAllowed - minAllowed) * 0.25,
      minAllowed + (maxAllowed - minAllowed) * 0.75
    ];
    const y1 = Math.min(...servedRects.map((rect) => rect.centerY));
    const y2 = Math.max(...servedRects.map((rect) => rect.centerY));
    let bestX = current;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      const passThroughs = rects.filter((rect) =>
        !servedIds.has(rect.level.levelId) &&
        candidate >= rect.x &&
        candidate <= rect.x + rect.width &&
        rangesOverlap(y1, y2, rect.y, rect.y + rect.height)
      ).length;
      const score = passThroughs * 10000 + Math.abs(candidate - current);
      if (score < bestScore) {
        bestScore = score;
        bestX = candidate;
      }
    }
    shaftXById.set(shaft.shaftId, bestX);
  }
}

function alignServedLevelsToVerticalShafts(model, rects, shaftXById, left, right) {
  for (const shaft of model.shafts) {
    const shaftX = shaftXById.get(shaft.shaftId);
    if (shaftX === undefined) continue;
    const servedIds = new Set((shaft.stops ?? []).map((stop) => stop.levelId));
    for (const rect of rects.filter((item) => servedIds.has(item.level.levelId))) {
      if (shaftX >= rect.x + 5 && shaftX <= rect.x + rect.width - 5) continue;
      const inset = (rect.level.xBand ?? 0.5) < (shaft.xBand ?? 0.5) ? rect.width * 0.82 : rect.width * 0.18;
      rect.x = clamp(shaftX - inset, left, right - rect.width);
      if (shaftX < rect.x + 5) rect.x = clamp(shaftX - 5, left, right - rect.width);
      if (shaftX > rect.x + rect.width - 5) rect.x = clamp(shaftX - rect.width + 5, left, right - rect.width);
    }
  }
}

function refreshRectShaftXs(model, rects, shaftXById) {
  const rectByLevel = new Map(rects.map((rect) => [rect.level.levelId, rect]));
  for (const rect of rects) rect.servedShaftXs = [];
  for (const shaft of model.shafts) {
    const shaftX = shaftXById.get(shaft.shaftId);
    if (shaftX === undefined) continue;
    for (const stop of shaft.stops ?? []) {
      const rect = rectByLevel.get(stop.levelId);
      if (rect) rect.servedShaftXs.push(shaftX);
    }
  }
}

function sliceUnservedLevelsAwayFromShaftTracks(model, rects, shaftXById, left, right) {
  const minWidthByLevel = (level) => getLevelMinWidth(level, 1, right - left) * 0.48;
  for (const shaft of model.shafts) {
    const shaftX = shaftXById.get(shaft.shaftId);
    if (shaftX === undefined) continue;
    const servedIds = new Set((shaft.stops ?? []).map((stop) => stop.levelId));
    const servedRects = rects.filter((rect) => servedIds.has(rect.level.levelId));
    if (!servedRects.length) continue;
    const y1 = Math.min(...servedRects.map((rect) => rect.centerY));
    const y2 = Math.max(...servedRects.map((rect) => rect.centerY));
    for (const rect of rects) {
      if (servedIds.has(rect.level.levelId)) continue;
      if (wouldRemoveOnlyVisibleStop(rect, shaftX, shaftXById)) continue;
      if (shaftX <= rect.x || shaftX >= rect.x + rect.width) continue;
      if (!rangesOverlap(y1, y2, rect.y, rect.y + rect.height)) continue;
      const clearance = 13;
      const leftWidth = shaftX - clearance - rect.x;
      const rightX = shaftX + clearance;
      const rightWidth = rect.x + rect.width - rightX;
      const minWidth = minWidthByLevel(rect.level);
      const ownShaftXs = (rect.level.connectedShaftIds ?? [])
        .map((shaftId) => shaftXById.get(shaftId))
        .filter((value) => value !== undefined);
      const leftContainsOwn = ownShaftXs.some((ownX) => ownX >= rect.x && ownX <= shaftX - clearance);
      const rightContainsOwn = ownShaftXs.some((ownX) => ownX >= rightX && ownX <= rect.x + rect.width);
      if (leftContainsOwn && leftWidth >= minWidth) {
        rect.width = leftWidth;
      } else if (rightContainsOwn && rightWidth >= minWidth) {
        rect.width = rightWidth;
        rect.x = rightX;
      } else if (leftWidth >= minWidth && leftWidth >= rightWidth) {
        rect.width = leftWidth;
      } else if (rightWidth >= minWidth) {
        rect.width = rightWidth;
        rect.x = rightX;
      } else {
        const pushLeft = Math.abs((shaftX - clearance - rect.width) - left);
        const pushRight = Math.abs((shaftX + clearance) - (right - rect.width));
        rect.x = pushLeft < pushRight
          ? clamp(shaftX - clearance - rect.width, left, right - rect.width)
          : clamp(shaftX + clearance, left, right - rect.width);
      }
    }
  }
}

function wouldRemoveOnlyVisibleStop(rect, cutX, shaftXById) {
  const visibleShaftXs = (rect.level.connectedShaftIds ?? [])
    .map((shaftId) => shaftXById.get(shaftId))
    .filter((shaftX) => shaftX !== undefined && shaftX >= rect.x && shaftX <= rect.x + rect.width);
  if (visibleShaftXs.length !== 1) return false;
  return Math.abs(visibleShaftXs[0] - cutX) <= 14;
}

function ensureEveryLevelHasVisibleStop(rects, shaftXById, left, right) {
  for (const rect of rects) {
    const shaftXs = (rect.level.connectedShaftIds ?? [])
      .map((shaftId) => shaftXById.get(shaftId))
      .filter((shaftX) => shaftX !== undefined);
    if (!shaftXs.length) continue;
    if (shaftXs.some((shaftX) => shaftX >= rect.x + 5 && shaftX <= rect.x + rect.width - 5)) continue;
    const nearest = shaftXs
      .map((shaftX) => ({
        shaftX,
        distance: Math.min(Math.abs(shaftX - rect.x), Math.abs(shaftX - (rect.x + rect.width)))
      }))
      .sort((a, b) => a.distance - b.distance)[0].shaftX;
    const inset = nearest < rect.x ? 5 : rect.width - 5;
    rect.x = clamp(nearest - inset, left, right - rect.width);
  }
}

function buildCandidateXs(rect, left, right) {
  const candidates = new Set([round(rect.x), round(left), round(right - rect.width)]);
  const step = Math.max(10, rect.width * 0.16);
  for (let offset = step; offset <= rect.width * 1.8; offset += step) {
    candidates.add(round(clamp(rect.x - offset, left, right - rect.width)));
    candidates.add(round(clamp(rect.x + offset, left, right - rect.width)));
  }
  for (const shaftX of rect.servedShaftXs ?? []) {
    candidates.add(round(clamp(shaftX - rect.width * 0.16, left, right - rect.width)));
    candidates.add(round(clamp(shaftX - rect.width * 0.5, left, right - rect.width)));
    candidates.add(round(clamp(shaftX - rect.width * 0.82, left, right - rect.width)));
  }
  return [...candidates];
}

function hasAnyOverlap(rect, rects, padding) {
  return rects.some((other) => other !== rect && getOverlapArea(rect, other, padding) > 0);
}

function getOverlapArea(a, b, padding = 0) {
  const xOverlap = Math.max(0, Math.min(a.x + a.width + padding, b.x + b.width + padding) - Math.max(a.x - padding, b.x - padding));
  const yOverlap = Math.max(0, Math.min(a.y + a.height + padding, b.y + b.height + padding) - Math.max(a.y - padding, b.y - padding));
  return xOverlap * yOverlap;
}

function containsServedShafts(rect) {
  return (rect.servedShaftXs ?? []).every((shaftX) => shaftX >= rect.x + 4 && shaftX <= rect.x + rect.width - 4);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rangesOverlap(a1, a2, b1, b2) {
  return Math.min(a2, b2) > Math.max(a1, b1);
}

function hashString(value = '') {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function round(value) {
  return Math.round(value * 10) / 10;
}
