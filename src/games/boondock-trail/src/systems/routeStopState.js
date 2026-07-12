import { DAY_PHASES } from "../constants/gameConstants.js";

export const ROUTE_STOP_TYPES = Object.freeze({
  TOWN: "town",
  LANDMARK: "landmark",
  ROUTE_CHOICE: "route_choice"
});

const ENTRY_REASONS = new Set(["arrival", "location"]);
const VISIT_STATES = new Set(["active", "left"]);

export function getActiveRouteStop(runState) {
  return typeof runState?.day?.activeRouteStop === "object" && runState.day.activeRouteStop !== null
    ? runState.day.activeRouteStop
    : null;
}

export function matchesRouteStop(activeRouteStop, stopType, stopId) {
  return (
    activeRouteStop?.stopType === stopType &&
    activeRouteStop?.stopId === stopId
  );
}

export function createOrResumeRouteStopState(existingStop, options = {}) {
  const stopType = normalizeStopType(options.stopType);
  const stopId = typeof options.stopId === "string" ? options.stopId : null;
  const pointId = typeof options.pointId === "string" ? options.pointId : null;
  const visitBudget = Math.max(1, Number(options.visitBudget) || 1);

  if (matchesRouteStop(existingStop, stopType, stopId)) {
    return {
      ...normalizeActiveRouteStop(existingStop),
      pointId,
      returnPhase: normalizeReturnPhase(options.returnPhase),
      visitState: "active"
    };
  }

  return {
    stopType,
    stopId,
    pointId,
    entryReason: ENTRY_REASONS.has(options.entryReason) ? options.entryReason : "location",
    returnPhase: normalizeReturnPhase(options.returnPhase),
    visitBudget,
    actionsRemaining: visitBudget,
    actionsUsed: [],
    pendingActionIds: [],
    latestIntelId: null,
    stateFlags: [],
    visitState: "active"
  };
}

export function normalizeActiveRouteStop(activeRouteStop) {
  if (typeof activeRouteStop !== "object" || activeRouteStop === null) {
    return null;
  }

  const visitBudget = Math.max(0, Number(activeRouteStop.visitBudget) || 0);

  return {
    stopType: normalizeStopType(activeRouteStop.stopType),
    stopId: typeof activeRouteStop.stopId === "string" ? activeRouteStop.stopId : null,
    pointId: typeof activeRouteStop.pointId === "string" ? activeRouteStop.pointId : null,
    entryReason: ENTRY_REASONS.has(activeRouteStop.entryReason)
      ? activeRouteStop.entryReason
      : "location",
    returnPhase: normalizeReturnPhase(activeRouteStop.returnPhase),
    visitBudget,
    actionsRemaining: Math.max(0, Number(activeRouteStop.actionsRemaining) || 0),
    actionsUsed: Array.isArray(activeRouteStop.actionsUsed)
      ? activeRouteStop.actionsUsed.filter((entry) => typeof entry === "string" && entry.length > 0)
      : [],
    pendingActionIds: dedupeStrings(activeRouteStop.pendingActionIds),
    latestIntelId:
      typeof activeRouteStop.latestIntelId === "string" ? activeRouteStop.latestIntelId : null,
    stateFlags: dedupeStrings(activeRouteStop.stateFlags),
    visitState: VISIT_STATES.has(activeRouteStop.visitState) ? activeRouteStop.visitState : "active"
  };
}

export function normalizeRouteStopActionRecord(record) {
  if (typeof record !== "object" || record === null) {
    return null;
  }

  const intel =
    typeof record.intel === "object" && record.intel !== null
      ? {
          id: typeof record.intel.id === "string" ? record.intel.id : null,
          label: typeof record.intel.label === "string" ? record.intel.label : "",
          text: typeof record.intel.text === "string" ? record.intel.text : "",
          effectSummary:
            typeof record.intel.effectSummary === "string" ? record.intel.effectSummary : ""
        }
      : null;

  return {
    id: typeof record.id === "string" ? record.id : "route_stop_action",
    stopType: normalizeStopType(record.stopType),
    stopId: typeof record.stopId === "string" ? record.stopId : null,
    pointId: typeof record.pointId === "string" ? record.pointId : null,
    stopName: typeof record.stopName === "string" ? record.stopName : "",
    label: typeof record.label === "string" ? record.label : "",
    price: Number.isFinite(Number(record.price)) ? Number(record.price) : 0,
    budgetCost: Math.max(1, Number(record.budgetCost) || 1),
    resultText: typeof record.resultText === "string" ? record.resultText : "",
    effectSummary: typeof record.effectSummary === "string" ? record.effectSummary : "",
    intel
  };
}

function normalizeStopType(value) {
  return Object.values(ROUTE_STOP_TYPES).includes(value) ? value : ROUTE_STOP_TYPES.LANDMARK;
}

function normalizeReturnPhase(value) {
  return Object.values(DAY_PHASES).includes(value) ? value : DAY_PHASES.PLAYER_DECISION;
}

function dedupeStrings(entries) {
  return Array.isArray(entries)
    ? [...new Set(entries.filter((entry) => typeof entry === "string" && entry.length > 0))]
    : [];
}
