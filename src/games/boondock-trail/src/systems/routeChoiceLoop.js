import { DAY_PHASES } from "../constants/gameConstants.js";
import {
  getRouteChoiceDefinitionForRoutePoint
} from "../state/gameContent.js";
import { cloneGameState, finalizeGameState } from "../state/gameState.js";
import {
  getCurrentRoutePoint,
  getNextWaypoint,
  syncJourneyRouteProgress
} from "./routeProgress.js";
import {
  ROUTE_STOP_TYPES,
  createOrResumeRouteStopState,
  getActiveRouteStop,
  matchesRouteStop
} from "./routeStopState.js";

const ENTERABLE_ROUTE_CHOICE_PHASES = new Set([
  DAY_PHASES.PLAYER_DECISION,
  DAY_PHASES.TRAVEL_RESOLUTION,
  DAY_PHASES.ROUTE_STOP
]);

const OVERNIGHT_MODIFIER_KEYS = Object.freeze([
  "loadAdjustment",
  "solarFactorAdjustment",
  "hookupSupportAdjustment",
  "hookupCashAdjustment",
  "waterDeltaAdjustment",
  "cashDeltaAdjustment",
  "moraleDeltaAdjustment",
  "conditionDeltaAdjustment",
  "restQualityShift"
]);

const PRESSURE_KEYS = Object.freeze([
  "recentFrugalDays",
  "recentPushMilesDays",
  "poorRestStreak",
  "recoveryMomentum"
]);

export function getRouteChoiceContext(runState) {
  const currentPoint = getCurrentRoutePoint(runState.journey);
  const routeChoice = getRouteChoiceDefinitionForRoutePoint(currentPoint);

  if (!routeChoice) {
    return null;
  }

  const activeRouteStop = getActiveRouteStop(runState);
  const selectedOptionId = getSelectedRouteChoiceOptionId(runState, routeChoice.id);
  const selectedOption =
    routeChoice.options?.find((entry) => entry.id === selectedOptionId) ?? null;

  return {
    routeChoice,
    routePoint: currentPoint,
    activeRouteStop: matchesRouteStop(activeRouteStop, ROUTE_STOP_TYPES.ROUTE_CHOICE, routeChoice.id)
      ? activeRouteStop
      : null,
    selectedOptionId: selectedOption?.id ?? null,
    selectedOption
  };
}

export function canEnterRouteChoiceStop(runState) {
  if (runState.gameOver || !ENTERABLE_ROUTE_CHOICE_PHASES.has(runState.currentPhase)) {
    return false;
  }

  return getRouteChoiceContext(runState) !== null;
}

export function enterRouteChoiceStop(runState, options = {}) {
  const nextState = cloneGameState(runState);
  const context = getRouteChoiceContext(nextState);

  if (!context || !canEnterRouteChoiceStop(nextState)) {
    return finalizeGameState(nextState);
  }

  nextState.day.activeRouteStop = createOrResumeRouteStopState(context.activeRouteStop, {
    stopType: ROUTE_STOP_TYPES.ROUTE_CHOICE,
    stopId: context.routeChoice.id,
    pointId: context.routePoint.id,
    entryReason: options.entryReason === "arrival" ? "arrival" : "location",
    returnPhase:
      options.returnPhase === DAY_PHASES.CAMP_DECISION
        ? DAY_PHASES.CAMP_DECISION
        : DAY_PHASES.PLAYER_DECISION,
    visitBudget: 1
  });
  nextState.currentPhase = DAY_PHASES.ROUTE_STOP;

  return finalizeGameState(nextState);
}

export function getAvailableRouteChoiceOptions(runState) {
  const context = getRouteChoiceContext(runState);

  if (!context) {
    return [];
  }

  return (context.routeChoice.options ?? []).map((option) =>
    buildRouteChoiceOptionView(runState, context, option)
  );
}

export function chooseRouteChoiceOption(runState, optionId) {
  const nextState = cloneGameState(runState);
  const context = getRouteChoiceContext(nextState);
  const activeRouteStop = context?.activeRouteStop ?? getActiveRouteStop(nextState);

  if (
    nextState.currentPhase !== DAY_PHASES.ROUTE_STOP ||
    !context ||
    !activeRouteStop ||
    activeRouteStop.stopType !== ROUTE_STOP_TYPES.ROUTE_CHOICE ||
    typeof optionId !== "string"
  ) {
    return finalizeGameState(nextState);
  }

  const optionView = buildRouteChoiceOptionView(nextState, context, optionId);

  if (!optionView?.canUse) {
    return finalizeGameState(nextState);
  }

  const currentIndex = nextState.journey.routePoints.findIndex(
    (point) => point.id === context.routePoint.id
  );

  if (currentIndex === -1) {
    return finalizeGameState(nextState);
  }

  const updatedChoicePoint = {
    ...nextState.journey.routePoints[currentIndex],
    nextLegLabel: optionView.nextLegLabel ?? nextState.journey.routePoints[currentIndex].nextLegLabel,
    nextLegSummary:
      optionView.nextLegSummary ?? nextState.journey.routePoints[currentIndex].nextLegSummary,
    nextLegModifiers: normalizeRouteLegModifiers(optionView.nextLegModifiers)
  };
  const selectedRoutePoints = cloneGameState(optionView.routePoints ?? []);
  const totalMiles = Math.max(
    updatedChoicePoint.mileMarker,
    Number(optionView.totalMiles) ||
      Number(selectedRoutePoints[selectedRoutePoints.length - 1]?.mileMarker) ||
      nextState.journey.totalMilesToDestination
  );

  nextState.journey.routePoints = [
    ...nextState.journey.routePoints.slice(0, currentIndex),
    updatedChoicePoint,
    ...selectedRoutePoints
  ];
  nextState.journey.totalMilesToDestination = totalMiles;
  nextState.journey.routeChoices = recordRouteChoiceSelection(
    nextState.journey.routeChoices,
    context,
    optionView
  );
  syncJourneyRouteProgress(nextState, { previousMiles: null });

  activeRouteStop.actionsRemaining = 0;
  activeRouteStop.actionsUsed = dedupeStrings([...activeRouteStop.actionsUsed, optionView.id]);
  activeRouteStop.stateFlags = dedupeStrings([
    ...(activeRouteStop.stateFlags ?? []),
    "route_choice_selected",
    `route_choice_option_${optionView.id}`
  ]);

  const resultRecord = {
    id: optionView.id,
    stopType: ROUTE_STOP_TYPES.ROUTE_CHOICE,
    stopId: context.routeChoice.id,
    pointId: context.routePoint.id,
    stopName: context.routeChoice.name,
    label: optionView.label,
    price: 0,
    budgetCost: 1,
    resultText: optionView.resultText,
    effectSummary: optionView.effectSummary,
    intel: null
  };

  nextState.day.routeStopActionsTaken = [...nextState.day.routeStopActionsTaken, resultRecord];
  nextState.day.lastRouteStopActionResult = resultRecord;
  nextState.day.summaryNotes = [...(nextState.day.summaryNotes ?? []), optionView.resultText];

  return finalizeGameState(nextState);
}

export function canLeaveRouteChoiceStop(runState) {
  const context = getRouteChoiceContext(runState);
  const activeRouteStop = context?.activeRouteStop ?? getActiveRouteStop(runState);

  if (!context || !activeRouteStop || activeRouteStop.stopType !== ROUTE_STOP_TYPES.ROUTE_CHOICE) {
    return false;
  }

  return hasSelectedRouteChoice(runState, context.routeChoice.id);
}

export function leaveRouteChoiceStop(runState) {
  const nextState = cloneGameState(runState);
  const activeRouteStop = getActiveRouteStop(nextState);

  if (
    nextState.currentPhase !== DAY_PHASES.ROUTE_STOP ||
    !activeRouteStop ||
    activeRouteStop.stopType !== ROUTE_STOP_TYPES.ROUTE_CHOICE ||
    !canLeaveRouteChoiceStop(nextState)
  ) {
    return finalizeGameState(nextState);
  }

  nextState.day.activeRouteStop = {
    ...activeRouteStop,
    visitState: "left"
  };
  nextState.currentPhase = activeRouteStop.returnPhase ?? DAY_PHASES.PLAYER_DECISION;

  return finalizeGameState(nextState);
}

export function getLatestRouteChoiceSelection(runState, choiceId = null) {
  const history = Array.isArray(runState?.journey?.routeChoices?.history)
    ? runState.journey.routeChoices.history
    : [];

  return (
    [...history]
      .reverse()
      .find((entry) => choiceId === null || entry.choiceId === choiceId) ?? null
  );
}

export function getActiveRouteLegModifiers(runState) {
  const currentPoint = getCurrentRoutePoint(runState.journey);
  const nextWaypoint = getNextWaypoint(runState.journey);

  if (!currentPoint || !nextWaypoint) {
    return createEmptyRouteLegModifiers();
  }

  const baseMods = normalizeRouteLegModifiers(currentPoint.nextLegModifiers);
  const intelPatch = runState.routeIntel?.activeRumor?.legModifierPatch;

  if (!intelPatch) {
    return baseMods;
  }

  return {
    ...baseMods,
    travelMilesAdjustment:
      baseMods.travelMilesAdjustment + (Number(intelPatch.travelMilesAdjustment) || 0),
    fuelDeltaAdjustment: 0,
    conditionDeltaAdjustment: 0,
    moraleDeltaAdjustment:
      baseMods.moraleDeltaAdjustment + (Number(intelPatch.moraleDeltaAdjustment) || 0),
    sunlightFactorAdjustment:
      baseMods.sunlightFactorAdjustment + (Number(intelPatch.sunlightFactorAdjustment) || 0)
  };
}

function buildRouteChoiceOptionView(runState, context, optionOrId) {
  const option =
    typeof optionOrId === "string"
      ? context.routeChoice.options?.find((entry) => entry.id === optionOrId) ?? null
      : optionOrId;

  if (!option) {
    return null;
  }

  const selectedOptionId = context.selectedOptionId;
  const selected = selectedOptionId === option.id;
  const routeLocked = typeof selectedOptionId === "string" && selectedOptionId.length > 0;
  const hasBudget = (context.activeRouteStop?.actionsRemaining ?? 0) >= 1;
  const canUse = !routeLocked && hasBudget;
  const usedRecord =
    [...(runState.day.routeStopActionsTaken ?? [])]
      .reverse()
      .find(
        (entry) =>
          entry.stopType === ROUTE_STOP_TYPES.ROUTE_CHOICE &&
          entry.stopId === context.routeChoice.id &&
          entry.id === option.id
      ) ?? null;

  return {
    ...option,
    budgetCost: 1,
    budgetLabel: "1 choice",
    selected,
    canUse,
    stateLabel: selected ? "Chosen" : routeLocked ? "Locked" : hasBudget ? "" : "Unavailable",
    usedRecord
  };
}

function hasSelectedRouteChoice(runState, choiceId) {
  const choice = getRouteChoiceContext(runState)?.routeChoice;

  if (choice?.id === choiceId) {
    return typeof getRouteChoiceContext(runState)?.selectedOptionId === "string";
  }

  const selectedOptionId = getSelectedRouteChoiceOptionId(runState, choiceId);
  return typeof selectedOptionId === "string";
}

function getSelectedRouteChoiceOptionId(runState, choiceId) {
  return typeof runState?.journey?.routeChoices?.selections?.[choiceId] === "string"
    ? runState.journey.routeChoices.selections[choiceId]
    : null;
}

function recordRouteChoiceSelection(routeChoices, context, option) {
  const existingSelections =
    typeof routeChoices?.selections === "object" && routeChoices.selections !== null
      ? routeChoices.selections
      : {};
  const existingHistory = Array.isArray(routeChoices?.history) ? routeChoices.history : [];

  return {
    selections: {
      ...existingSelections,
      [context.routeChoice.id]: option.id
    },
    history: [
      ...existingHistory.filter((entry) => entry.choiceId !== context.routeChoice.id),
      {
        choiceId: context.routeChoice.id,
        pointId: context.routePoint.id,
        choiceName: context.routeChoice.name,
        optionId: option.id,
        optionLabel: option.label,
        kicker: option.kicker ?? "",
        resultText: option.resultText ?? ""
      }
    ]
  };
}

function createEmptyRouteLegModifiers() {
  return {
    travelMilesAdjustment: 0,
    fuelDeltaAdjustment: 0,
    waterDeltaAdjustment: 0,
    conditionDeltaAdjustment: 0,
    moraleDeltaAdjustment: 0,
    sunlightFactorAdjustment: 0,
    eventCategoryWeights: {},
    overnightLocationType: null,
    overnightQuirkNotes: [],
    overnightModifierPatch: createEmptyOvernightModifierPatch()
  };
}

function createEmptyOvernightModifierPatch() {
  return {
    ...Object.fromEntries(OVERNIGHT_MODIFIER_KEYS.map((key) => [key, 0])),
    passengerPressure: Object.fromEntries(PRESSURE_KEYS.map((key) => [key, 0]))
  };
}

function normalizeRouteLegModifiers(value) {
  const source = typeof value === "object" && value !== null ? value : {};
  const normalized = createEmptyRouteLegModifiers();

  for (const key of [
    "travelMilesAdjustment",
    "waterDeltaAdjustment",
    "moraleDeltaAdjustment",
    "sunlightFactorAdjustment"
  ]) {
    normalized[key] = Number(source[key]) || 0;
  }

  normalized.fuelDeltaAdjustment = 0;
  normalized.conditionDeltaAdjustment = 0;

  normalized.eventCategoryWeights =
    typeof source.eventCategoryWeights === "object" && source.eventCategoryWeights !== null
      ? Object.fromEntries(
          Object.entries(source.eventCategoryWeights)
            .filter(([key]) => typeof key === "string" && key.length > 0)
            .map(([key, entryValue]) => [key, Number(entryValue) || 0])
        )
      : {};
  normalized.overnightLocationType =
    typeof source.overnightLocationType === "string" ? source.overnightLocationType : null;
  normalized.overnightQuirkNotes = Array.isArray(source.overnightQuirkNotes)
    ? source.overnightQuirkNotes.filter((entry) => typeof entry === "string" && entry.length > 0)
    : [];
  normalized.overnightModifierPatch = normalizeOvernightModifierPatch(source.overnightModifierPatch);

  return normalized;
}

function normalizeOvernightModifierPatch(value) {
  const source = typeof value === "object" && value !== null ? value : {};
  const normalized = createEmptyOvernightModifierPatch();

  for (const key of OVERNIGHT_MODIFIER_KEYS) {
    normalized[key] =
      key === "hookupCashAdjustment" ||
      key === "cashDeltaAdjustment" ||
      key === "conditionDeltaAdjustment"
        ? 0
        : Number(source[key]) || 0;
  }

  for (const key of PRESSURE_KEYS) {
    normalized.passengerPressure[key] = Number(source.passengerPressure?.[key]) || 0;
  }

  return normalized;
}

function dedupeStrings(entries) {
  return Array.isArray(entries)
    ? [...new Set(entries.filter((entry) => typeof entry === "string" && entry.length > 0))]
    : [];
}
