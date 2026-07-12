import { DAY_PHASES } from "../constants/gameConstants.js";
import { getCurrentRoutePoint } from "./routeProgress.js";
import {
  cloneGameState,
  finalizeGameState,
  getDerivedStatus
} from "../state/gameState.js";
import {
  getTownDefinitionForRoutePoint,
  getTownRumorDefinition,
  getTownRumorPool,
  getTownServiceDefinition
} from "../state/gameContent.js";
import {
  getV2ConnectedDestinations,
  getV2JourneyNode
} from "../state/v2JourneyGraph.js";
import { applyEventEffects } from "./events/eventEffects.js";
import {
  ROUTE_STOP_TYPES,
  createOrResumeRouteStopState,
  getActiveRouteStop,
  matchesRouteStop
} from "./routeStopState.js";
import { applyTownRecoveryToPassengerPressure } from "./passengerPressure.js";
import { recordServiceAction } from "./coreSystems.js";

const ENTERABLE_TOWN_PHASES = new Set([
  DAY_PHASES.PLAYER_DECISION,
  DAY_PHASES.TRAVEL_RESOLUTION,
  DAY_PHASES.ROUTE_STOP,
  DAY_PHASES.TOWN_STOP
]);

const TOWN_QUIRK_COPY = Object.freeze({
  fuel_cheaper: "Fuel runs a little cheaper here.",
  water_easy: "Water is easy to come by here.",
  repair_pricy: "Repairs cost a bit more than you would like.",
  friendly_showers: "Clean-up stops feel unusually kind here.",
  good_meals: "The meal stop is better than it looks from the road.",
  tourist_markup: "A little tourist markup has found its way into the prices.",
  repair_fair: "Repair work here tends to be practical and fairly priced."
});

export function getTownContext(runState) {
  const selectedDestinationNode = getV2JourneyNode(
    typeof runState.v2?.stay?.selectedDestinationId === "string"
      ? runState.v2.stay.selectedDestinationId.replace(/^destination_/, "")
      : null
  );
  const isAwayFromTownHub =
    selectedDestinationNode !== null &&
    selectedDestinationNode.locationType !== "town_hub" &&
    runState.v2?.journey?.arrivalState !== "not_arrived";

  if (isAwayFromTownHub) {
    return null;
  }

  const currentPoint = getCurrentRoutePoint(runState.journey);
  const town = getTownDefinitionForRoutePoint(currentPoint);

  if (!town) {
    return null;
  }

  return {
    town,
    routePoint: currentPoint,
    activeRouteStop: matchesRouteStop(getActiveRouteStop(runState), ROUTE_STOP_TYPES.TOWN, town.id)
      ? getActiveRouteStop(runState)
      : null
  };
}

export function canEnterTown(runState) {
  if (runState.gameOver || !ENTERABLE_TOWN_PHASES.has(runState.currentPhase)) {
    return false;
  }

  const context = getTownContext(runState);

  if (!context) {
    return false;
  }

  if (context.activeRouteStop?.visitState === "left") {
    return false;
  }

  return true;
}

export function enterTown(runState, options = {}) {
  const nextState = cloneGameState(runState);
  const context = getTownContext(nextState);

  if (!context || !canEnterTown(nextState)) {
    return finalizeGameState(nextState);
  }

  nextState.day.activeRouteStop = createOrResumeTownStop(context, options);
  nextState.currentPhase = DAY_PHASES.ROUTE_STOP;
  nextState.day.selectedTownActionId = null;

  return finalizeGameState(nextState);
}

export function leaveTown(runState) {
  const nextState = cloneGameState(runState);
  const activeRouteStop = getActiveRouteStop(nextState);

  if (
    nextState.currentPhase !== DAY_PHASES.ROUTE_STOP ||
    !activeRouteStop ||
    activeRouteStop.stopType !== ROUTE_STOP_TYPES.TOWN
  ) {
    return finalizeGameState(nextState);
  }

  nextState.day.activeRouteStop = {
    ...activeRouteStop,
    visitState: "left"
  };
  nextState.currentPhase = activeRouteStop.returnPhase ?? DAY_PHASES.PLAYER_DECISION;
  nextState.day.selectedTownActionId = null;

  return finalizeGameState(nextState);
}

export function getAvailableTownActions(runState) {
  const context = getTownContext(runState);

  if (!context) {
    return [];
  }

  return context.town.serviceIds
    .map((serviceId) => buildTownServiceView(runState, context, serviceId))
    .filter(Boolean);
}

export function getAvailableTownDestinations(runState) {
  const context = getTownContext(runState);
  const currentLocation = runState.v2?.currentLocation ?? null;
  const availableDestinations = Array.isArray(runState.v2?.availableDestinations)
    ? runState.v2.availableDestinations
    : [];

  if (!context) {
    return [];
  }

  const destinationEntries =
    currentLocation?.isTownHub === true && availableDestinations.length > 0
      ? availableDestinations
      : getV2ConnectedDestinations(context.town.id);

  return destinationEntries
    .map((entry) => {
      const node = getV2JourneyNode(entry.nodeId);

      if (!node) {
        return null;
      }

      return {
        ...entry,
        category: node.category,
        region: node.region,
        quality: node.quality,
        scenicValue: node.scenicValue,
        description: node.description,
        arrivalText: node.arrivalText,
        isForwardSpine: entry.source === "forward_spine",
        launchesStay: entry.locationType !== "route_connector",
        risk: deriveTownDestinationRisk(node),
        resourceEffects: deriveTownDestinationResourceEffects(node),
        recommendationReason: deriveTownDestinationRecommendation(node)
      };
    })
    .filter(Boolean);
}

export function getSelectedTownDestination(runState) {
  const selectedId = runState.v2?.stay?.selectedDestinationId ?? null;

  return (
    getAvailableTownDestinations(runState).find((entry) => entry.id === selectedId) ?? null
  );
}

export function getDefaultTownDestination(runState) {
  const availableDestinations = getAvailableTownDestinations(runState);

  return (
    availableDestinations.find((entry) => entry.isForwardSpine) ??
    availableDestinations[0] ??
    null
  );
}

export function getDefaultTownStayDestination(runState) {
  const availableDestinations = getAvailableTownDestinations(runState);

  return (
    availableDestinations.find((entry) => !entry.isForwardSpine && entry.launchesStay) ??
    availableDestinations.find((entry) => entry.launchesStay) ??
    getDefaultTownDestination(runState)
  );
}

export function getTownContinueDrivingDestination(runState) {
  return getAvailableTownDestinations(runState).find((entry) => entry.isForwardSpine) ?? null;
}

export function getEffectiveTownDestination(runState) {
  return getSelectedTownDestination(runState) ?? getDefaultTownStayDestination(runState);
}

export function selectTownDestination(runState, destinationId) {
  const nextState = cloneGameState(runState);
  const destination = getAvailableTownDestinations(nextState).find((entry) => entry.id === destinationId);

  if (!destination) {
    return finalizeGameState(nextState);
  }

  nextState.v2 ??= {};
  nextState.v2.journey ??= {};
  nextState.v2.stay ??= {};
  nextState.v2.journey.currentDestinationId = destination.id;
  nextState.v2.journey.travelState = "planning";
  nextState.v2.journey.arrivalState = "not_arrived";
  nextState.v2.stay.selectedDestinationId = destination.id;
  nextState.day.selectedTownActionId = destination.id;
  nextState.day.summaryNotes = dedupeStrings([
    ...(nextState.day.summaryNotes ?? []),
    `${destination.label} is the next chosen stop out of ${nextState.v2?.currentLocation?.nodeName ?? "town"}.`
  ]);

  return finalizeGameState(nextState);
}

export function buildTownDestinationTravelOptions(runState) {
  const destination = getEffectiveTownDestination(runState);

  if (!destination) {
    return null;
  }

  return {
    targetDestination: {
      ...destination
    }
  };
}

export function buildTownContinueDrivingTravelOptions(runState) {
  const destination = getTownContinueDrivingDestination(runState);
  const activeRouteStop = getActiveRouteStop(runState);
  const isNightPush = activeRouteStop?.returnPhase === DAY_PHASES.CAMP_DECISION;

  if (!destination) {
    return null;
  }

  return {
    targetDestination: {
      ...destination
    },
    travelPeriod: isNightPush ? "night_push" : "day_continue",
    nightDriveFromTown: isNightPush,
    interruptionCount: isNightPush ? 1 : undefined
  };
}

export function performTownAction(runState, serviceId) {
  const nextState = cloneGameState(runState);
  const context = getTownContext(nextState);
  const activeRouteStop = context?.activeRouteStop ?? getActiveRouteStop(nextState);

  if (
    nextState.currentPhase !== DAY_PHASES.ROUTE_STOP ||
    !context ||
    !activeRouteStop ||
    activeRouteStop.stopType !== ROUTE_STOP_TYPES.TOWN ||
    typeof serviceId !== "string"
  ) {
    return finalizeGameState(nextState);
  }

  const serviceView = buildTownServiceView(nextState, context, serviceId);

  if (!serviceView?.canUse) {
    return finalizeGameState(nextState);
  }

  const beforeResources = snapshotServiceResources(nextState);
  const resolvedEffects = buildResolvedTownServiceEffects(serviceView);
  applyEventEffects(nextState, resolvedEffects, DAY_PHASES.TRAVEL_RESOLUTION);
  recordServiceAction(nextState, serviceView, beforeResources);
  applyTownRecoveryToPassengerPressure(nextState, serviceView.id);

  activeRouteStop.actionsRemaining = Math.max(
    0,
    activeRouteStop.actionsRemaining - serviceView.budgetCost
  );
  activeRouteStop.actionsUsed = dedupeStrings([...activeRouteStop.actionsUsed, serviceView.id]);

  const intel = serviceView.id === "ask_around" ? pickTownRumor(nextState, context) : null;

  if (intel) {
    nextState.routeIntel.activeRumor = {
      id: intel.id,
      sourceType: ROUTE_STOP_TYPES.TOWN,
      sourceId: context.town.id,
      sourceName: context.town.name,
      townId: context.town.id,
      townName: context.town.name,
      segmentId: nextState.journey.currentSegmentId,
      label: intel.label,
      text: intel.text,
      effectSummary: intel.effectSummary,
      eventWeightAdjustments: { ...(intel.eventWeightAdjustments ?? {}) },
      legModifierPatch: { ...(intel.legModifierPatch ?? {}) }
    };
    activeRouteStop.latestIntelId = intel.id;
  }

  const resultRecord = {
    id: serviceView.id,
    stopType: ROUTE_STOP_TYPES.TOWN,
    stopId: context.town.id,
    pointId: context.routePoint.id,
    townId: context.town.id,
    townName: context.town.name,
    stopName: context.town.name,
    label: serviceView.label,
    price: serviceView.price,
    budgetCost: serviceView.budgetCost,
    resultText: intel ? intel.text : serviceView.resultText,
    effectSummary: intel ? intel.effectSummary : serviceView.effectSummary,
    intel,
    rumor: intel
  };

  nextState.day.selectedTownActionId = serviceView.id;
  nextState.day.routeStopActionsTaken = [...nextState.day.routeStopActionsTaken, resultRecord];
  nextState.day.lastRouteStopActionResult = resultRecord;
  nextState.day.townActionsTaken = [...nextState.day.townActionsTaken, resultRecord];
  nextState.day.lastTownActionResult = resultRecord;

  return finalizeGameState(nextState);
}

export function getTownQuirkNotes(town) {
  if (!town || !Array.isArray(town.quirkTags)) {
    return [];
  }

  return town.quirkTags.map((tag) => TOWN_QUIRK_COPY[tag] ?? startCaseTag(tag));
}

function createOrResumeTownStop(context, options) {
  return createOrResumeRouteStopState(context.activeRouteStop, {
    stopType: ROUTE_STOP_TYPES.TOWN,
    stopId: context.town.id,
    pointId: context.routePoint.id,
    entryReason: options.entryReason === "arrival" ? "arrival" : "location",
    returnPhase:
      options.returnPhase === DAY_PHASES.CAMP_DECISION
        ? DAY_PHASES.CAMP_DECISION
        : DAY_PHASES.PLAYER_DECISION,
    visitBudget: Math.max(1, Number(context.town.visitBudget) || 2)
  });
}

function buildTownServiceView(runState, context, serviceId) {
  const baseService = getTownServiceDefinition(serviceId);

  if (!baseService) {
    return null;
  }

  const override = context.town.serviceOverrides?.[serviceId] ?? {};
  const activeRouteStop = context.activeRouteStop ?? null;
  const mergedService = mergeTownService(baseService, override);
  const price = computeTownServicePrice(context.town, mergedService);
  const budgetCost = Math.max(1, Number(mergedService.budgetCost) || 1);
  const used =
    activeRouteStop?.actionsUsed?.includes(serviceId) ||
    runState.day.routeStopActionsTaken.some(
      (entry) =>
        entry.stopType === ROUTE_STOP_TYPES.TOWN &&
        entry.stopId === context.town.id &&
        entry.id === serviceId
    );
  const availability = evaluateTownServiceAvailability(runState, mergedService);
  const hasBudget = (activeRouteStop?.actionsRemaining ?? context.town.visitBudget ?? 2) >= budgetCost;
  const canUse = !used && availability.available && hasBudget;
  const usedRecord =
    [...runState.day.routeStopActionsTaken]
      .reverse()
      .find(
        (entry) =>
          entry.stopType === ROUTE_STOP_TYPES.TOWN &&
          entry.stopId === context.town.id &&
          entry.id === serviceId
      ) ?? null;

  return {
    ...mergedService,
    townId: context.town.id,
    townName: context.town.name,
    price,
    priceLabel: "Free",
    budgetCost,
    budgetLabel: `${budgetCost} action${budgetCost === 1 ? "" : "s"}`,
    used: Boolean(used),
    affordable: true,
    available: availability.available,
    availabilityReason: availability.reason,
    hasBudget,
    canUse,
    stateLabel: resolveTownServiceStateLabel({
      used,
      canAfford: true,
      hasBudget,
      availability
    }),
    usedRecord
  };
}

function mergeTownService(baseService, override) {
  return {
    ...baseService,
    ...override,
    effects: {
      ...(baseService.effects ?? {}),
      ...(override.effects ?? {}),
      resources: {
        ...(baseService.effects?.resources ?? {}),
        ...(override.effects?.resources ?? {})
      },
      passengerPressure: {
        ...(baseService.effects?.passengerPressure ?? {}),
        ...(override.effects?.passengerPressure ?? {})
      }
    },
    availability: {
      ...(baseService.availability ?? {}),
      ...(override.availability ?? {})
    }
  };
}

function computeTownServicePrice(town, service) {
  return 0;
}

function evaluateTownServiceAvailability(runState, service) {
  const derived = getDerivedStatus(runState);
  const rules = service.availability ?? {};
  const batteryMissing = Math.max(
    0,
    runState.resources.batteryCapacity - runState.resources.batteryCharge
  );
  const waterMissing = Math.max(0, runState.resources.waterCapacity - runState.resources.water);

  if (
    Array.isArray(rules.anyMissing) &&
    rules.anyMissing.length > 0 &&
    !rules.anyMissing.some((key) => hasTownNeedForResource(key, rules, {
      batteryMissing,
      waterMissing
    }))
  ) {
    return {
      available: false,
      reason: "You are already mostly set for that kind of stop."
    };
  }

  if (rules.batteryMissingMin && batteryMissing < rules.batteryMissingMin) {
    return {
      available: false,
      reason: "Battery is already near enough to full."
    };
  }

  if (rules.waterMissingMin && waterMissing < rules.waterMissingMin) {
    return {
      available: false,
      reason: "Water is already in a safe range."
    };
  }

  if (rules.moraleBelowPercent && runState.resources.passengerMorale >= rules.moraleBelowPercent) {
    return {
      available: false,
      reason: "The cabin does not need that stop right now."
    };
  }

  if (rules.pressureScoreMin && derived.moralePressureScore < rules.pressureScoreMin) {
    return {
      available: false,
      reason: "That stop matters more once the day feels tighter."
    };
  }

  return {
    available: true,
    reason: ""
  };
}

function hasTownNeedForResource(resourceKey, rules, missing) {
  if (resourceKey === "battery") {
    return missing.batteryMissing >= Math.max(1, Number(rules.batteryMissingMin) || 1);
  }

  if (resourceKey === "water") {
    return missing.waterMissing >= Math.max(1, Number(rules.waterMissingMin) || 1);
  }

  return false;
}

function resolveTownServiceStateLabel({ used, canAfford, hasBudget, availability }) {
  if (used) {
    return "Used This Visit";
  }

  if (!availability.available) {
    return availability.reason;
  }

  if (!hasBudget) {
    return "Not Enough Actions";
  }

  return "";
}

function buildResolvedTownServiceEffects(serviceView) {
  return {
    ...(serviceView.effects ?? {}),
    resources: {
      ...(serviceView.effects?.resources ?? {})
    }
  };
}

function snapshotServiceResources(runState) {
  const electric = runState.v2?.resources?.electric ?? {};
  const water = runState.v2?.resources?.water ?? {};
  const waste = runState.v2?.resources?.waste ?? {};

  return {
    electricPercent: percent(electric.charge, electric.capacity),
    waterPercent: percent(water.current, water.capacity),
    wastePercent: percent(waste.current, waste.capacity)
  };
}

function percent(current, capacity) {
  return Math.round((Math.max(0, Number(current) || 0) / Math.max(1, Number(capacity) || 1)) * 100);
}

function pickTownRumor(runState, context) {
  const rumorIds = getTownRumorPool(context.town.rumorPoolId)
    .map((entry) => getTownRumorDefinition(entry))
    .filter(Boolean);

  if (rumorIds.length === 0) {
    return null;
  }

  const previousRumorId = context.activeRouteStop?.latestIntelId ?? null;
  const rotatedPool = rumorIds.filter((entry) => entry.id !== previousRumorId);
  const eligiblePool = rotatedPool.length > 0 ? rotatedPool : rumorIds;
  const index = deterministicTownIndex(runState, context.town.id, eligiblePool.length);

  return eligiblePool[index] ?? eligiblePool[0] ?? null;
}

function deterministicTownIndex(runState, townId, length) {
  if (length <= 1) {
    return 0;
  }

  const seed = `${runState.runId}|${runState.dayNumber}|${townId}|${runState.journey.currentSegmentId}`;
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return hash % length;
}

function dedupeStrings(entries) {
  return [...new Set(entries.filter((entry) => typeof entry === "string" && entry.length > 0))];
}

function startCaseTag(tag) {
  return String(tag)
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function deriveTownDestinationRisk(node) {
  switch (node?.category) {
    case "poor_boondock":
    case "roadside_fallback":
      return "high";
    case "premium_boondock":
    case "scenic_stop":
    case "destination":
      return "medium";
    case "rv_park":
    case "gas_station":
    case "route_connector":
    default:
      return "low";
  }
}

function deriveTownDestinationResourceEffects(node) {
  switch (node?.category) {
    case "premium_boondock":
      return {
        water: "moderate use",
        power: "strong solar upside",
        waste: "no direct relief"
      };
    case "poor_boondock":
    case "roadside_fallback":
      return {
        water: "lean use likely",
        power: "limited recovery",
        waste: "no direct relief"
      };
    case "rv_park":
      return {
        water: "easy recovery",
        power: "hookup support",
        waste: "service access"
      };
    case "gas_station":
      return {
        water: "utility reset",
        power: "practical support",
        waste: "likely dump access"
      };
    case "scenic_stop":
      return {
        water: "steady use",
        power: "mixed recovery",
        waste: "no direct relief"
      };
    case "destination":
      return {
        water: "final stretch pressure",
        power: "finish-line push",
        waste: "carry through arrival"
      };
    case "route_connector":
    default:
      return {
        water: "steady travel draw",
        power: "balanced road use",
        waste: "normal buildup"
      };
  }
}

function deriveTownDestinationRecommendation(node) {
  switch (node?.category) {
    case "premium_boondock":
      return "Best if the run can afford a high-value off-grid night.";
    case "poor_boondock":
    case "roadside_fallback":
      return "Fallback only when getting off the road matters more than quality.";
    case "rv_park":
      return "Best when the trip needs a steadier recovery night.";
    case "gas_station":
      return "Best when utility relief matters more than scenery.";
    case "scenic_stop":
      return "Strong if trip score and flavor matter more than hard recovery.";
    case "destination":
      return "Best when you want to keep the northbound push dominant.";
    case "route_connector":
    default:
      return "Best if you want to keep momentum on the main coastal spine.";
  }
}
