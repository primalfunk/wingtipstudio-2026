const FIXED_GROUND_APPROACH_END_X = 408;
const TOWN_SILHOUETTE_APPROACH_END_X = 500;
const TOWN_SILHOUETTE_ROAD_Y = 282;

export function getTravelApproachPose(prop, rawLegProgress) {
  const legProgress = clamp01(rawLegProgress);
  const spawnProgress = clamp01(prop?.spawnProgress);
  const endProgress = Math.max(spawnProgress + 0.001, Number(prop?.endProgress) || 1);
  const kind = typeof prop?.kind === "string" ? prop.kind : "";
  const xStart = Number(prop?.xStart) || 0;
  const authoredXEnd = Number(prop?.xEnd) || 0;
  const xEnd = getFixedGroundEndX(kind, authoredXEnd);
  const yBase = getGroundedYBase(kind, Number(prop?.yBase) || 0);
  const scaleStart = Number(prop?.scaleStart) || 0.5;
  const scaleEnd = Number(prop?.scaleEnd) || 1;
  const horizontalWashApproach = isHorizontalWashApproachKind(kind);
  const stableScale = getStableApproachScale(scaleStart, scaleEnd);

  if (legProgress <= spawnProgress) {
    return {
      x: xStart,
      y: yBase,
      scale: stableScale,
      opacity: getTravelApproachOpacity(kind, 0)
    };
  }

  if (legProgress >= endProgress) {
    return {
      x: xEnd,
      y: yBase,
      scale: stableScale,
      opacity: 0
    };
  }

  const windowProgress = (legProgress - spawnProgress) / (endProgress - spawnProgress);

  if (horizontalWashApproach) {
    const lateralProgress = easeInOutHorizontal(windowProgress);
    const shoulderBob = Math.sin(windowProgress * Math.PI) * 4;

    return {
      x: lerp(xStart, xEnd, lateralProgress),
      y: yBase + shoulderBob,
      scale: stableScale,
      opacity: getTravelApproachOpacity(kind, windowProgress)
    };
  }

  const lateralProgress = easeInOutHorizontal(windowProgress);
  const groundBob = Math.sin(windowProgress * Math.PI) * 3;

  return {
    x: lerp(xStart, xEnd, lateralProgress),
    y: yBase + groundBob,
    scale: stableScale,
    opacity: getTravelApproachOpacity(kind, windowProgress)
  };
}

function isHorizontalWashApproachKind(kind) {
  return kind === "wash_crossing";
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function lerp(start, end, progress) {
  return start + (end - start) * progress;
}

function getFixedGroundEndX(kind, authoredXEnd) {
  if (kind === "town_silhouette") {
    return Number.isFinite(authoredXEnd) && authoredXEnd > 0
      ? Math.max(TOWN_SILHOUETTE_APPROACH_END_X, authoredXEnd)
      : TOWN_SILHOUETTE_APPROACH_END_X;
  }

  if (!Number.isFinite(authoredXEnd) || authoredXEnd <= 0) {
    return FIXED_GROUND_APPROACH_END_X;
  }

  return Math.min(authoredXEnd, FIXED_GROUND_APPROACH_END_X);
}

function getGroundedYBase(kind, authoredYBase) {
  if (kind === "town_silhouette") {
    return TOWN_SILHOUETTE_ROAD_Y;
  }

  return authoredYBase;
}

function easeInOutHorizontal(progress) {
  const value = clamp01(progress);
  return 0.5 - Math.cos(value * Math.PI) / 2;
}

function getStableApproachScale(scaleStart, scaleEnd) {
  return (scaleStart + scaleEnd) / 2;
}

function getTravelApproachOpacity(kind, windowProgress) {
  const value = clamp01(windowProgress);

  if (kind === "town_silhouette") {
    return value <= 0 ? 0 : 0.98;
  }

  const fadeIn = Math.min(1, value / 0.16);
  const fadeOut = Math.min(1, (1 - value) / 0.12);

  return Math.min(fadeIn, fadeOut, 0.98);
}
