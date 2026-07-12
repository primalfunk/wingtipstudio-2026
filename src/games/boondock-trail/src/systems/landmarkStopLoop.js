import { DAY_PHASES } from "../constants/gameConstants.js";
import { getCurrentRoutePoint, getNextWaypoint } from "./routeProgress.js";
import { cloneGameState, finalizeGameState, getDerivedStatus } from "../state/gameState.js";
import {
  getLandmarkStopDefinition,
  getLandmarkRumorDefinition,
  getLandmarkRumorPool,
  getLandmarkStopActionDefinition,
  getLandmarkStopDefinitionForRoutePoint
} from "../state/gameContent.js";
import { applyEventEffects } from "./events/eventEffects.js";
import {
  ROUTE_STOP_TYPES,
  createOrResumeRouteStopState,
  getActiveRouteStop,
  matchesRouteStop
} from "./routeStopState.js";

const ENTERABLE_LANDMARK_PHASES = new Set([
  DAY_PHASES.PLAYER_DECISION,
  DAY_PHASES.TRAVEL_RESOLUTION,
  DAY_PHASES.ROUTE_STOP
]);

export function getLandmarkStopContext(runState) {
  const activeRouteStop = getActiveRouteStop(runState);
  const currentPoint = getCurrentRoutePoint(runState.journey);
  const routePointLandmarkStop = getLandmarkStopDefinitionForRoutePoint(currentPoint);
  const landmarkStop =
    (activeRouteStop?.stopType === ROUTE_STOP_TYPES.LANDMARK &&
    activeRouteStop?.visitState !== "left"
      ? getLandmarkStopDefinition(activeRouteStop.stopId)
      : null) ?? routePointLandmarkStop;
  const routePoint =
    activeRouteStop?.pointId && Array.isArray(runState.journey.routePoints)
      ? runState.journey.routePoints.find((point) => point.id === activeRouteStop.pointId) ?? currentPoint
      : currentPoint;

  if (!landmarkStop) {
    return null;
  }

  return {
    landmarkStop,
    routePoint,
    activeRouteStop: matchesRouteStop(activeRouteStop, ROUTE_STOP_TYPES.LANDMARK, landmarkStop.id)
      ? activeRouteStop
      : null
  };
}

export function canEnterLandmarkStop(runState) {
  if (runState.gameOver || !ENTERABLE_LANDMARK_PHASES.has(runState.currentPhase)) {
    return false;
  }

  return getLandmarkStopContext(runState) !== null;
}

export function enterLandmarkStop(runState, options = {}) {
  const nextState = cloneGameState(runState);
  const routePoint =
    typeof options.pointId === "string" && Array.isArray(nextState.journey.routePoints)
      ? nextState.journey.routePoints.find((point) => point.id === options.pointId) ?? null
      : getCurrentRoutePoint(nextState.journey);
  const landmarkStop =
    typeof options.stopId === "string"
      ? getLandmarkStopDefinition(options.stopId)
      : getLandmarkStopDefinitionForRoutePoint(routePoint);
  const existingStop = getActiveRouteStop(nextState);

  if (
    !landmarkStop ||
    nextState.gameOver ||
    !ENTERABLE_LANDMARK_PHASES.has(nextState.currentPhase)
  ) {
    return finalizeGameState(nextState);
  }

  nextState.day.activeRouteStop = createOrResumeRouteStopState(existingStop, {
    stopType: ROUTE_STOP_TYPES.LANDMARK,
    stopId: landmarkStop.id,
    pointId: routePoint?.id ?? null,
    entryReason: options.entryReason === "arrival" ? "arrival" : "location",
    returnPhase:
      options.returnPhase === DAY_PHASES.CAMP_DECISION
        ? DAY_PHASES.CAMP_DECISION
        : DAY_PHASES.PLAYER_DECISION,
    visitBudget: landmarkStop.visitBudget ?? 1
  });
  nextState.currentPhase = DAY_PHASES.ROUTE_STOP;

  return finalizeGameState(nextState);
}

export function getAvailableLandmarkActions(runState) {
  const context = getLandmarkStopContext(runState);

  if (!context) {
    return [];
  }

  return context.landmarkStop.actionIds
    .map((actionId) => buildLandmarkActionView(runState, context, actionId))
    .filter(Boolean);
}

export function performLandmarkAction(runState, actionId) {
  const nextState = cloneGameState(runState);
  const context = getLandmarkStopContext(nextState);
  const activeRouteStop = context?.activeRouteStop ?? getActiveRouteStop(nextState);

  if (
    nextState.currentPhase !== DAY_PHASES.ROUTE_STOP ||
    !context ||
    !activeRouteStop ||
    activeRouteStop.stopType !== ROUTE_STOP_TYPES.LANDMARK ||
    typeof actionId !== "string"
  ) {
    return finalizeGameState(nextState);
  }

  const actionView = buildLandmarkActionView(nextState, context, actionId);

  if (!actionView?.canUse) {
    return finalizeGameState(nextState);
  }

  const resolvedAction = resolveLandmarkActionResult(nextState, context, actionView);

  applyEventEffects(nextState, resolvedAction.effects, DAY_PHASES.TRAVEL_RESOLUTION);

  activeRouteStop.actionsRemaining = Math.max(
    0,
    activeRouteStop.actionsRemaining - actionView.budgetCost
  );
  activeRouteStop.actionsUsed = dedupeStrings([...activeRouteStop.actionsUsed, actionView.id]);
  applyRouteStopStateChanges(activeRouteStop, resolvedAction.stateChanges);

  const intel = resolveLandmarkActionIntel(nextState, context, actionView, resolvedAction);

  if (intel) {
    const nextLegTarget = getLandmarkNextLegTarget(nextState.journey);

    if (nextLegTarget) {
      nextState.routeIntel.nextLegIntel = {
        id: intel.id,
        sourceType: ROUTE_STOP_TYPES.LANDMARK,
        sourceId: context.landmarkStop.id,
        sourceName: context.landmarkStop.name,
        targetSegmentId: nextLegTarget.targetSegmentId,
        targetPointName: nextLegTarget.targetPointName,
        label: intel.label,
        text: intel.text,
        effectSummary: intel.effectSummary,
        eventWeightAdjustments: { ...(intel.eventWeightAdjustments ?? {}) },
        legModifierPatch: { ...(intel.legModifierPatch ?? {}) }
      };
    } else {
      nextState.routeIntel.activeRumor = {
        id: intel.id,
        sourceType: ROUTE_STOP_TYPES.LANDMARK,
        sourceId: context.landmarkStop.id,
        sourceName: context.landmarkStop.name,
        townId: null,
        townName: "",
        segmentId: nextState.journey.currentSegmentId,
        label: intel.label,
        text: intel.text,
        effectSummary: intel.effectSummary,
        eventWeightAdjustments: { ...(intel.eventWeightAdjustments ?? {}) },
        legModifierPatch: { ...(intel.legModifierPatch ?? {}) }
      };
    }
    activeRouteStop.latestIntelId = intel.id;
  }

  const resultRecord = {
    id: actionView.id,
    stopType: ROUTE_STOP_TYPES.LANDMARK,
    stopId: context.landmarkStop.id,
    pointId: context.routePoint.id,
    stopName: context.landmarkStop.name,
    label: actionView.label,
    price: 0,
    budgetCost: actionView.budgetCost,
    resultText: resolvedAction.resultText,
    effectSummary: resolvedAction.effectSummary,
    intel
  };

  nextState.day.routeStopActionsTaken = [...nextState.day.routeStopActionsTaken, resultRecord];
  nextState.day.lastRouteStopActionResult = resultRecord;

  return finalizeGameState(nextState);
}

export function toggleLandmarkPreparationAction(runState, actionId) {
  const nextState = cloneGameState(runState);
  const context = getLandmarkStopContext(nextState);
  const activeRouteStop = context?.activeRouteStop ?? getActiveRouteStop(nextState);

  if (
    nextState.currentPhase !== DAY_PHASES.ROUTE_STOP ||
    !context ||
    !activeRouteStop ||
    activeRouteStop.stopType !== ROUTE_STOP_TYPES.LANDMARK ||
    !isObstacleLandmarkStop(context.landmarkStop) ||
    typeof actionId !== "string"
  ) {
    return finalizeGameState(nextState);
  }

  const currentSelection = Array.isArray(activeRouteStop.pendingActionIds)
    ? [...activeRouteStop.pendingActionIds]
    : [];
  const selected = currentSelection.includes(actionId);

  if (selected) {
    activeRouteStop.pendingActionIds = currentSelection.filter((entry) => entry !== actionId);
    return finalizeGameState(nextState);
  }

  const actionView = buildLandmarkActionView(nextState, context, actionId);

  if (!actionView?.canUse || currentSelection.length >= 2) {
    return finalizeGameState(nextState);
  }

  activeRouteStop.pendingActionIds = [...currentSelection, actionId];
  return finalizeGameState(nextState);
}

export function confirmLandmarkPreparation(runState) {
  let nextState = cloneGameState(runState);
  let context = getLandmarkStopContext(nextState);
  let activeRouteStop = context?.activeRouteStop ?? getActiveRouteStop(nextState);
  const selectedActionIds = Array.isArray(activeRouteStop?.pendingActionIds)
    ? [...activeRouteStop.pendingActionIds]
    : [];

  if (
    nextState.currentPhase !== DAY_PHASES.ROUTE_STOP ||
    !context ||
    !activeRouteStop ||
    activeRouteStop.stopType !== ROUTE_STOP_TYPES.LANDMARK ||
    !isObstacleLandmarkStop(context.landmarkStop) ||
    selectedActionIds.length === 0
  ) {
    return finalizeGameState(nextState);
  }

  for (const actionId of selectedActionIds) {
    const actionView = buildLandmarkActionView(nextState, context, actionId);

    if (!actionView?.canUse) {
      continue;
    }

    nextState = performLandmarkAction(nextState, actionId);
    context = getLandmarkStopContext(nextState);
    activeRouteStop = context?.activeRouteStop ?? getActiveRouteStop(nextState);

    if (hasRouteStopFlag(activeRouteStop, "obstacle_resolved")) {
      break;
    }
  }

  activeRouteStop = getActiveRouteStop(nextState);
  if (activeRouteStop?.stopType === ROUTE_STOP_TYPES.LANDMARK) {
    activeRouteStop.pendingActionIds = [];
  }

  return finalizeGameState(nextState);
}

export function leaveLandmarkStop(runState) {
  const nextState = cloneGameState(runState);
  const context = getLandmarkStopContext(nextState);
  const activeRouteStop = getActiveRouteStop(nextState);

  if (
    nextState.currentPhase !== DAY_PHASES.ROUTE_STOP ||
    !activeRouteStop ||
    activeRouteStop.stopType !== ROUTE_STOP_TYPES.LANDMARK
  ) {
    return finalizeGameState(nextState);
  }

  if (isObstacleLandmarkStop(context?.landmarkStop) && !hasRouteStopFlag(activeRouteStop, "obstacle_resolved")) {
    return finalizeGameState(nextState);
  }

  nextState.day.activeRouteStop = {
    ...activeRouteStop,
    pendingActionIds: [],
    visitState: "left"
  };
  nextState.currentPhase = activeRouteStop.returnPhase ?? DAY_PHASES.PLAYER_DECISION;

  return finalizeGameState(nextState);
}

export function getLandmarkQuirkNotes(landmarkStop) {
  return Array.isArray(landmarkStop?.quirkNotes) ? landmarkStop.quirkNotes : [];
}

function buildLandmarkActionView(runState, context, actionId) {
  const baseAction = getLandmarkStopActionDefinition(actionId);

  if (!baseAction) {
    return null;
  }

  const override = context.landmarkStop.actionOverrides?.[actionId] ?? {};
  const activeRouteStop = context.activeRouteStop;
  const mergedAction = mergeLandmarkAction(baseAction, override);
  const budgetCost = Math.max(1, Number(mergedAction.budgetCost) || 1);
  const used =
    activeRouteStop?.actionsUsed?.includes(actionId) ||
    runState.day.routeStopActionsTaken.some(
      (entry) =>
        entry.stopType === ROUTE_STOP_TYPES.LANDMARK &&
        entry.stopId === context.landmarkStop.id &&
        entry.id === actionId
    );
  const availability = evaluateLandmarkActionAvailability(runState, mergedAction, activeRouteStop);
  const hasBudget =
    (activeRouteStop?.actionsRemaining ?? context.landmarkStop.visitBudget ?? 1) >= budgetCost;
  const canUse = !used && availability.available && hasBudget;
  const usedRecord =
    [...runState.day.routeStopActionsTaken]
      .reverse()
      .find(
        (entry) =>
          entry.stopType === ROUTE_STOP_TYPES.LANDMARK &&
          entry.stopId === context.landmarkStop.id &&
          entry.id === actionId
      ) ?? null;
  const selected = Boolean(activeRouteStop?.pendingActionIds?.includes(actionId));

  return {
    ...mergedAction,
    budgetCost,
    budgetLabel: `${budgetCost} action${budgetCost === 1 ? "" : "s"}`,
    used,
    available: availability.available,
    stateLabel: resolveLandmarkActionStateLabel({ used, hasBudget, availability }),
    selected,
    hasBudget,
    canUse,
    usedRecord
  };
}

function mergeLandmarkAction(baseAction, override) {
  return {
    ...baseAction,
    ...override,
    effects: {
      ...(baseAction.effects ?? {}),
      ...(override.effects ?? {}),
      resources: {
        ...(baseAction.effects?.resources ?? {}),
        ...(override.effects?.resources ?? {})
      },
      journey: {
        ...(baseAction.effects?.journey ?? {}),
        ...(override.effects?.journey ?? {})
      },
      passengerPressure: {
        ...(baseAction.effects?.passengerPressure ?? {}),
        ...(override.effects?.passengerPressure ?? {})
      },
      policies: {
        ...(baseAction.effects?.policies ?? {}),
        ...(override.effects?.policies ?? {})
      }
    },
    stateChanges: mergeStateChanges(baseAction.stateChanges, override.stateChanges),
    availability: {
      ...(baseAction.availability ?? {}),
      ...(override.availability ?? {})
    }
  };
}

function evaluateLandmarkActionAvailability(runState, action, activeRouteStop) {
  const rules = action.availability ?? {};
  const derived = getDerivedStatus(runState);
  const batteryMissing = Math.max(
    0,
    runState.resources.batteryCapacity - runState.resources.batteryCharge
  );
  const waterMissing = Math.max(0, runState.resources.waterCapacity - runState.resources.water);
  const stateFlags = new Set(activeRouteStop?.stateFlags ?? []);

  if (
    Array.isArray(rules.requiresFlags) &&
    rules.requiresFlags.some((flag) => !stateFlags.has(flag))
  ) {
    return {
      available: false,
      reason: resolveMissingFlagReason(rules.requiresFlags, stateFlags)
    };
  }

  if (
    Array.isArray(rules.blocksFlags) &&
    rules.blocksFlags.some((flag) => stateFlags.has(flag))
  ) {
    return {
      available: false,
      reason: resolveBlockedFlagReason(rules.blocksFlags, stateFlags)
    };
  }

  if (
    Array.isArray(rules.anyMissing) &&
    rules.anyMissing.length > 0 &&
    !rules.anyMissing.some((key) =>
      hasLandmarkNeedForResource(key, rules, { batteryMissing, waterMissing })
    )
  ) {
    return {
      available: false,
      reason: "You are already mostly set for that."
    };
  }

  if (rules.waterMissingMin && waterMissing < rules.waterMissingMin) {
    return {
      available: false,
      reason: "Water is already in a safe range."
    };
  }

  if (rules.batteryMissingMin && batteryMissing < rules.batteryMissingMin) {
    return {
      available: false,
      reason: "Battery is already near enough to full."
    };
  }

  if (rules.pressureScoreMin && derived.moralePressureScore < rules.pressureScoreMin) {
    return {
      available: false,
      reason: "That matters more on a tighter day."
    };
  }

  return {
    available: true,
    reason: ""
  };
}

function resolveLandmarkActionResult(runState, context, actionView) {
  const outcome = pickLandmarkActionOutcome(runState, context, actionView);

  return {
    resultText: outcome?.resultText ?? actionView.resultText,
    effectSummary: outcome?.effectSummary ?? actionView.effectSummary,
    effects: mergeLandmarkEffects(actionView.effects, outcome?.effects),
    stateChanges: mergeStateChanges(actionView.stateChanges, outcome?.stateChanges),
    grantsRumor: outcome?.grantsRumor ?? actionView.grantsRumor ?? false,
    intelId: outcome?.intelId ?? actionView.intelId ?? null
  };
}

function pickLandmarkActionOutcome(runState, context, actionView) {
  if (!Array.isArray(actionView.outcomes) || actionView.outcomes.length === 0) {
    return null;
  }

  const eligibleOutcomes = actionView.outcomes.filter((entry) =>
    isLandmarkOutcomeEligible(context.activeRouteStop, entry)
  );

  if (eligibleOutcomes.length === 0) {
    return null;
  }

  if (eligibleOutcomes.length === 1) {
    return eligibleOutcomes[0];
  }

  return pickWeightedLandmarkOutcome(runState, context, actionView.id, eligibleOutcomes);
}

function isLandmarkOutcomeEligible(activeRouteStop, outcome) {
  const stateFlags = new Set(activeRouteStop?.stateFlags ?? []);
  const requiredFlags = Array.isArray(outcome?.requiresFlags) ? outcome.requiresFlags : [];
  const blockedFlags = Array.isArray(outcome?.blocksFlags) ? outcome.blocksFlags : [];

  if (requiredFlags.some((flag) => !stateFlags.has(flag))) {
    return false;
  }

  if (blockedFlags.some((flag) => stateFlags.has(flag))) {
    return false;
  }

  return true;
}

function pickWeightedLandmarkOutcome(runState, context, actionId, outcomes) {
  const totalWeight = outcomes.reduce(
    (sum, entry) => sum + Math.max(0.1, Number(entry.weight) || 1),
    0
  );
  const stateKey = [...new Set(context.activeRouteStop?.stateFlags ?? [])].sort().join(",");
  const roll = deterministicLandmarkValue(
    runState,
    context.landmarkStop.id,
    `${actionId}|${stateKey}|${runState.resources.passengerMorale}`
  );
  let threshold = roll * totalWeight;

  for (const outcome of outcomes) {
    threshold -= Math.max(0.1, Number(outcome.weight) || 1);
    if (threshold <= 0) {
      return outcome;
    }
  }

  return outcomes[outcomes.length - 1] ?? null;
}

function resolveLandmarkActionIntel(runState, context, actionView, resolvedAction) {
  const intelId =
    typeof resolvedAction.intelId === "string" ? resolvedAction.intelId : null;

  if (intelId) {
    return getLandmarkRumorDefinition(intelId) ?? null;
  }

  if (resolvedAction.grantsRumor) {
    return pickLandmarkRumor(runState, context);
  }

  return null;
}

function hasLandmarkNeedForResource(resourceKey, rules, missing) {
  if (resourceKey === "battery") {
    return missing.batteryMissing >= Math.max(1, Number(rules.batteryMissingMin) || 1);
  }

  if (resourceKey === "water") {
    return missing.waterMissing >= Math.max(1, Number(rules.waterMissingMin) || 1);
  }

  return false;
}

function resolveLandmarkActionStateLabel({ used, hasBudget, availability }) {
  if (used) {
    return "Used This Stop";
  }

  if (!availability.available) {
    return availability.reason;
  }

  if (!hasBudget) {
    return "No Actions Left";
  }

  return "";
}

function resolveMissingFlagReason(requiredFlags, stateFlags) {
  if (requiredFlags.includes("obstacle_inspected") && !stateFlags.has("obstacle_inspected")) {
    return "Inspect First";
  }

  return "Not Ready Yet";
}

function resolveBlockedFlagReason(blockedFlags, stateFlags) {
  if (blockedFlags.includes("obstacle_resolved") && stateFlags.has("obstacle_resolved")) {
    return "Handled";
  }

  return "Not Available";
}

function mergeLandmarkEffects(baseEffects = {}, branchEffects = {}) {
  return {
    resources: {
      ...(baseEffects.resources ?? {}),
      ...(branchEffects.resources ?? {})
    },
    journey: {
      ...(baseEffects.journey ?? {}),
      ...(branchEffects.journey ?? {})
    },
    passengerPressure: {
      ...(baseEffects.passengerPressure ?? {}),
      ...(branchEffects.passengerPressure ?? {})
    },
    policies: {
      ...(baseEffects.policies ?? {}),
      ...(branchEffects.policies ?? {})
    }
  };
}

function mergeStateChanges(baseStateChanges, overrideStateChanges) {
  return {
    setFlags: dedupeStrings([
      ...((baseStateChanges?.setFlags ?? [])),
      ...((overrideStateChanges?.setFlags ?? []))
    ]),
    clearFlags: dedupeStrings([
      ...((baseStateChanges?.clearFlags ?? [])),
      ...((overrideStateChanges?.clearFlags ?? []))
    ])
  };
}

function applyRouteStopStateChanges(activeRouteStop, stateChanges) {
  const stateFlags = new Set(activeRouteStop?.stateFlags ?? []);

  for (const flag of stateChanges?.clearFlags ?? []) {
    stateFlags.delete(flag);
  }

  for (const flag of stateChanges?.setFlags ?? []) {
    stateFlags.add(flag);
  }

  activeRouteStop.stateFlags = [...stateFlags];
}

function hasRouteStopFlag(activeRouteStop, flag) {
  return activeRouteStop?.stateFlags?.includes(flag) ?? false;
}

function isObstacleLandmarkStop(landmarkStop) {
  return landmarkStop?.presentation === "obstacle" && landmarkStop?.obstacle;
}

function pickLandmarkRumor(runState, context) {
  const rumorPool = getLandmarkRumorPool(context.landmarkStop.rumorPoolId)
    .map((entry) => getLandmarkRumorDefinition(entry))
    .filter(Boolean);

  if (rumorPool.length === 0) {
    return null;
  }

  const previousRumorId = context.activeRouteStop?.latestIntelId ?? null;
  const eligiblePool = rumorPool.filter((entry) => entry.id !== previousRumorId);
  const pool = eligiblePool.length > 0 ? eligiblePool : rumorPool;
  const index = deterministicLandmarkIndex(runState, context.landmarkStop.id, pool.length);

  return pool[index] ?? pool[0] ?? null;
}

function deterministicLandmarkIndex(runState, landmarkStopId, length) {
  if (length <= 1) {
    return 0;
  }

  const seed = `${runState.runId}|${runState.dayNumber}|${landmarkStopId}|${runState.journey.currentSegmentId}|landmark`;
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return Math.abs(hash >>> 0) % length;
}

function deterministicLandmarkValue(runState, landmarkStopId, salt) {
  const seed = [
    runState.runId,
    runState.dayNumber,
    landmarkStopId,
    runState.journey.currentSegmentId,
    salt
  ].join("|");
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}

function getLandmarkNextLegTarget(journey) {
  const routePoints = Array.isArray(journey.routePoints) ? journey.routePoints : [];
  const nextWaypoint = getNextWaypoint(journey);

  if (!nextWaypoint) {
    return null;
  }

  const nextIdx = routePoints.findIndex((point) => point.id === nextWaypoint.id);

  if (nextIdx === -1 || nextIdx >= routePoints.length - 1) {
    return null;
  }

  const fromPoint = routePoints[nextIdx];
  const toPoint = routePoints[nextIdx + 1];

  return {
    targetSegmentId: `${fromPoint.id}_to_${toPoint.id}`,
    targetPointName: fromPoint.name
  };
}

function dedupeStrings(entries) {
  return [...new Set(entries.filter((entry) => typeof entry === "string" && entry.length > 0))];
}
