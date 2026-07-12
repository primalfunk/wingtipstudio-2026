import { CAMPSITE_TYPES, DAY_PHASES } from "../constants/gameConstants.js";
import {
  buildForecastDeck,
  buildPendingEvents,
  defaultSetupSelection,
  getRoutePreset,
  getTravelModeOption,
  getComfortPolicyOption,
  getWeatherAtDay
} from "../state/gameContent.js";
import {
  cloneGameState,
  createEmptyDayState,
  finalizeGameState
} from "../state/gameState.js";
import { getV2JourneyNode } from "../state/v2JourneyGraph.js";
import {
  ensureOvernightContextState,
  markCommittedToSleepState
} from "./campLoop.js";
import { normalizeOvernightContext, OVERNIGHT_LOCATION_TYPES } from "./overnightContext.js";
import { queueEventForCurrentPhase } from "./events/eventEngine.js";
import { calculateOvernightResolution } from "./overnightResolution.js";
import {
  getScoreFeedbackForOutcome,
  processCoreDayCycle,
  trackStructuredOutcome,
  updateResourcePressure
} from "./coreSystems.js";
import { applyDailyWarningEscalation } from "./passengerPressure.js";
import { buildReachedRouteNotes, syncJourneyRouteProgress } from "./routeProgress.js";
import { calculateTravelResolution } from "./travelResolution.js";

export function beginDayDecisionPhase(runState) {
  const nextState = cloneGameState(runState);
  const travelMode = getTravelModeOption(
    nextState.policies.drivingStyle ?? nextState.policies.travelMode
  );
  const comfortPolicy = getComfortPolicyOption(nextState.policies.comfortPolicy);

  nextState.currentPhase = DAY_PHASES.PLAYER_DECISION;
  nextState.day.summaryHeadline = "Set today up, then get back on the road.";
  nextState.day.summaryNotes = [
    `${travelMode.label} is set for today.`,
    `${comfortPolicy.label} living policy is set for the RV.`,
    "Pick your next stop, then head out."
  ];

  return finalizeGameState(nextState);
}

export function commitTravelForDay(runState) {
  const nextState = cloneGameState(runState);
  const outcome = calculateTravelResolution(nextState);

  applyOutcome(nextState, outcome);
  nextState.currentPhase = DAY_PHASES.TRAVEL_RESOLUTION;
  nextState.day.summaryHeadline =
    nextState.day.routeArrivalNotice?.kind === "destination"
      ? nextState.day.routeArrivalNotice.title
      : outcome.headline;
  nextState.day.summaryNotes = [
    ...outcome.notes,
    ...buildReachedRouteNotes(nextState.day.reachedRoutePoints ?? [])
  ];

  return queueEventForCurrentPhase(finalizeGameState(nextState));
}

export function beginCampDecisionPhase(runState, options = {}) {
  const nextState = cloneGameState(runState);
  ensureOvernightContextState(nextState);
  if (options.forcedRoadsideSleep === true) {
    applyForcedRoadsideSleepState(nextState);
  }
  const overnightContext = nextState.day.overnightContext;

  nextState.currentPhase = DAY_PHASES.CAMP_DECISION;
  nextState.v2.journey.arrivalState = "staying";
  nextState.v2.stay.stayStatus = "ready_to_resolve";
  nextState.day.summaryHeadline =
    overnightContext.actionsTaken?.[0]?.id === "forced_roadside_sleep"
      ? "You have to pull over for the night."
      : `${overnightContext.locationName} is where the night will land.`;
  nextState.day.summaryNotes =
    overnightContext.actionsTaken?.[0]?.id === "forced_roadside_sleep"
      ? [
          overnightContext.locationSetupLine,
          overnightContext.staySummary,
          "You pushed too far to keep driving well. There is nothing left to do but sleep where you can."
        ]
      : [
          overnightContext.locationSetupLine,
          overnightContext.staySummary,
          "Decide what kind of evening this will be."
        ];

  return queueEventForCurrentPhase(finalizeGameState(nextState));
}

export function beginOvernightResolution(runState) {
  const nextState = cloneGameState(runState);
  ensureOvernightContextState(nextState);
  const overnightContext = nextState.day.overnightContext;

  markCommittedToSleepState(nextState);
  const actionLabels = overnightContext.actionsTaken
    .map((entry) => entry.label)
    .filter((entry) => typeof entry === "string" && entry.length > 0);
  const actionCount = actionLabels.length;
  const forcedRoadsideSleep = overnightContext.actionsTaken?.[0]?.id === "forced_roadside_sleep";

  nextState.currentPhase = DAY_PHASES.OVERNIGHT_RESOLUTION;
  nextState.day.summaryHeadline = forcedRoadsideSleep
    ? "You pull over because the road has gone on too long."
    : `${overnightContext.locationName} settles around you for the night.`;
  nextState.day.summaryNotes = forcedRoadsideSleep
    ? [
        overnightContext.locationSetupLine,
        overnightContext.staySummary,
        "There is no real evening plan left. Everyone just needs to get through the night.",
        "Let the night pass and see what morning feels like."
      ]
    : [
        overnightContext.locationSetupLine,
        overnightContext.staySummary,
        actionCount > 0
          ? `You chose ${actionLabels.join(", ")} before turning in.`
          : "You let the place do most of the work tonight.",
        "Let the night pass and see what morning feels like."
      ];

  return queueEventForCurrentPhase(finalizeGameState(nextState));
}

export function resolveOvernightStay(runState) {
  const nextState = cloneGameState(runState);
  const outcome = calculateOvernightResolution(nextState);

  applyOutcome(nextState, outcome);
  recordResolvedStayHistory(nextState);
  nextState.currentPhase = DAY_PHASES.DAY_END;
  nextState.v2.journey.arrivalState = "arrived";
  nextState.v2.stay.stayStatus = "resolved";
  nextState.day.summaryHeadline = outcome.headline;
  nextState.day.overnightNarrative = outcome.narrative ?? null;
  nextState.day.summaryNotes = [...nextState.day.summaryNotes, ...outcome.notes];

  return finalizeGameState(nextState);
}

function applyForcedRoadsideSleepState(runState) {
  const overnightContext = runState.day.overnightContext;

  if (!overnightContext) {
    return;
  }

  const forcedChoice = {
    id: "forced_roadside_sleep",
    label: "Forced To Pull Over",
    budgetCost: 1,
    resultText: "You keep driving until the night makes the decision for you, then pull off and sleep where you can.",
    effectSummary: "A rough roadside night that leaves everyone feeling it by morning.",
    rumor: null
  };

  runState.v2.stay.selectedDestinationId = null;
  runState.v2.journey.currentDestinationId = null;

  runState.day.overnightContext = normalizeOvernightContext(
    {
      ...overnightContext,
      locationType: OVERNIGHT_LOCATION_TYPES.ROADSIDE,
      locationName: "Roadside Pullout",
      locationLabel: "Forced Stop",
      locationLead: "You are not really choosing a place now. You are stopping because the road has gone on too long.",
      locationSetupLine: "The shoulder finally gives you enough room to pull over, and that has to be enough tonight.",
      locationFlavor: "It is a rough, improvised stop made because there is no room left to keep driving well.",
      siteCategory: "roadside_fallback",
      siteType: "roadside_forced",
      siteQuality: "rough",
      scenicValue: 0,
      weatherShelter: "low",
      services: {
        waterFill: false,
        wasteDump: false,
        electricHookup: false
      },
      stayLabel: "Forced Roadside Sleep",
      stayLead: "You kept driving past the point where a proper stop still made sense.",
      staySummary: "This is a rough fallback, not a chosen stay. It is harder on the group and much worse than stopping properly in town.",
      supportSummary: "No real recovery, no practical support, and very little comfort. Everyone will feel the cost in the morning.",
      v2Effects: {
        tripScoreDelta: -2,
        hiddenMoraleDelta: -4,
        wasteDelta: 2
      },
      baseModifiers: {
        ...overnightContext.baseModifiers,
        moraleDeltaAdjustment: (Number(overnightContext.baseModifiers?.moraleDeltaAdjustment) || 0) - 4,
        restQualityShift: (Number(overnightContext.baseModifiers?.restQualityShift) || 0) - 2,
        conditionDeltaAdjustment: (Number(overnightContext.baseModifiers?.conditionDeltaAdjustment) || 0) - 1
      },
      actionsRemaining: 0,
      actionsTaken: [forcedChoice],
      lastActionResult: forcedChoice
    },
    runState
  );
}

export function advanceToNextDay(runState) {
  const nextState = cloneGameState(runState);

  if (nextState.gameOver) {
    return finalizeGameState(nextState);
  }

  const route = getRoutePreset(defaultSetupSelection.routePresetId);
  const nextDate = addDays(nextState.day.currentDate, 1);
  const nextDayNumber = nextState.dayNumber + 1;
  const nextWeather = getWeatherAtDay(route, nextDayNumber);
  const solarReadinessBonus = Math.max(
    0,
    Number(nextState.day.overnightContext?.modifiers?.solarFactorAdjustment) || 0
  );
  const escalation = applyDailyWarningEscalation(nextState);
  transitionAfterResolvedStay(nextState);

  nextState.dayNumber = nextDayNumber;
  nextState.currentPhase = DAY_PHASES.MORNING_REVIEW;
  nextState.journey.daysRemaining = Math.max(
    0,
    nextState.journey.daysRemaining - 1 - (Number(escalation.extraDayLoss) || 0)
  );
  nextState.policies.selectedCampsiteType = null;

  const morningIntelNotes = buildMorningIntelNotes(nextState.routeIntel);
  nextState.day = createEmptyDayState(nextDate, {
    summaryHeadline: "A new morning settles in.",
    summaryNotes: [
      "A new day is here.",
      "Set the tone for the road, decide how you want to live today, and then head out.",
      ...(solarReadinessBonus > 0 ? ["Last night's prep left the RV better ready for morning sun."] : []),
      ...escalation.notes,
      ...morningIntelNotes
    ]
  });
  processCoreDayCycle(nextState);
  nextState.environment.currentWeather = nextWeather.label;
  nextState.environment.weatherProfile = nextWeather;
  nextState.environment.sunlightFactor = clampSunlightFactor(nextWeather.sunlightFactor + solarReadinessBonus);
  nextState.environment.forecast = buildForecastDeck(route, nextDayNumber);
  if (nextState.environment.forecast[0]) {
    nextState.environment.forecast[0].sunlightFactor = clampSunlightFactor(
      nextState.environment.forecast[0].sunlightFactor + solarReadinessBonus
    );
  }
  nextState.events.pendingEvents = buildPendingEvents(route, nextDayNumber);
  nextState.v2.journey.travelState = "planning";
  nextState.v2.stay.stayStatus = "idle";

  return finalizeGameState(nextState);
}

function applyOutcome(runState, outcome) {
  const changes = outcome.changes;
  const previousMiles = runState.journey.milesTraveled;
  runState.journey.milesTraveled += changes.dailyMilesDriven;

  runState.resources.batteryCharge += changes.dailyBatteryDelta;
  runState.resources.water += changes.dailyWaterDelta;
  runState.resources.passengerMorale += changes.dailyMoraleDelta;
  runState.resources.rvCondition = Math.max(
    0,
    Math.min(100, runState.resources.rvCondition + changes.dailyConditionDelta)
  );
  runState.v2.resources.waste.current = Math.max(
    0,
    Math.min(
      runState.v2.resources.waste.capacity,
      runState.v2.resources.waste.current + (Number(outcome.v2Changes?.wasteDelta) || 0)
    )
  );
  runState.v2.resources.tripScore = Math.max(
    0,
    runState.v2.resources.tripScore + (Number(outcome.v2Changes?.tripScoreDelta) || 0)
  );
  runState.v2.hiddenMorale = Math.max(
    0,
    Math.min(100, runState.v2.hiddenMorale + (Number(outcome.v2Changes?.hiddenMoraleDelta) || 0))
  );
  runState.resources.passengerMorale = runState.v2.hiddenMorale;

  runState.day.dailyMilesDriven += changes.dailyMilesDriven;
  runState.day.dailyBatteryDelta += changes.dailyBatteryDelta;
  runState.day.dailyFuelDelta += 0;
  runState.day.dailyWaterDelta += changes.dailyWaterDelta;
  runState.day.dailyWasteDelta += Number(outcome.v2Changes?.wasteDelta) || 0;
  runState.day.dailyTripScoreDelta += Number(outcome.v2Changes?.tripScoreDelta) || 0;
  runState.day.dailyCashDelta += 0;
  runState.day.dailyConditionDelta += changes.dailyConditionDelta;
  runState.day.dailyMoraleDelta += changes.dailyMoraleDelta;

  if (outcome.energyBreakdown?.context === "travel") {
    runState.day.energy.travel = cloneGameState(outcome.energyBreakdown);
  }

  if (outcome.energyBreakdown?.context === "overnight") {
    runState.day.energy.overnight = cloneGameState(outcome.energyBreakdown);
  }

  if (outcome.passengerPressure) {
    runState.passengerPressure = cloneGameState(outcome.passengerPressure);
  }

  trackStructuredOutcome(runState, outcome, {
    kind: outcome.scoreContext?.kind ?? (changes.dailyMilesDriven > 0 ? "travel" : "overnight"),
    stayType: outcome.scoreContext?.stayType ?? runState.day.overnightContext?.siteCategory
  });
  updateResourcePressure(runState);
  runState.day.summaryNotes = [
    ...(runState.day.summaryNotes ?? []),
    ...getScoreFeedbackForOutcome(outcome, {
      kind: outcome.scoreContext?.kind ?? (changes.dailyMilesDriven > 0 ? "travel" : "overnight"),
      stayType: outcome.scoreContext?.stayType ?? runState.day.overnightContext?.siteCategory
    })
  ];

  if (changes.dailyMilesDriven !== 0) {
    syncJourneyRouteProgress(runState, { previousMiles });
  }

  runState.day.energy.total = buildTotalEnergyBreakdown(runState.day.energy);
}

function transitionAfterResolvedStay(runState) {
  const selectedDestinationId = runState.v2?.stay?.selectedDestinationId;

  if (typeof selectedDestinationId !== "string") {
    runState.v2.journey.arrivalState = "not_arrived";
    return;
  }

  const destinationNode = getV2JourneyNode(selectedDestinationId.replace(/^destination_/, ""));

  if (!destinationNode) {
    runState.v2.journey.arrivalState = "not_arrived";
    runState.v2.stay.selectedDestinationId = null;
    runState.v2.journey.currentDestinationId = null;
    return;
  }

  runState.v2.stay.lastArrivalNodeId = destinationNode.id;

  if (destinationNode.hubId && destinationNode.locationType !== "town_hub") {
    const hubNode = getV2JourneyNode(destinationNode.hubId);

    runState.v2.journey.arrivalState = "not_arrived";
    runState.v2.stay.selectedDestinationId = null;
    runState.v2.journey.currentDestinationId = null;

    if (hubNode) {
      runState.journey.currentLocationName = hubNode.name;
    }

    return;
  }

  runState.v2.journey.arrivalState = "arrived";
  runState.v2.journey.currentDestinationId = selectedDestinationId;
}

function recordResolvedStayHistory(runState) {
  const site = runState.v2?.stay?.site ?? null;
  const nodeId = typeof site?.nodeId === "string" ? site.nodeId : null;

  if (!nodeId) {
    return;
  }

  runState.v2.history ??= {
    destinationVisitCounts: {},
    hubStayCounts: {}
  };
  runState.v2.history.destinationVisitCounts ??= {};
  runState.v2.history.hubStayCounts ??= {};
  runState.v2.history.destinationVisitCounts[nodeId] =
    (Number(runState.v2.history.destinationVisitCounts[nodeId]) || 0) + 1;

  if (site.category === "town_hub") {
    runState.v2.history.hubStayCounts[nodeId] =
      (Number(runState.v2.history.hubStayCounts[nodeId]) || 0) + 1;
  }
}

function buildTotalEnergyBreakdown(dayEnergy) {
  return {
    context: "total",
    sunlightFactor: Math.max(dayEnergy.travel.sunlightFactor, dayEnergy.overnight.sunlightFactor),
    solarGain: dayEnergy.travel.solarGain + dayEnergy.overnight.solarGain,
    loadUse: dayEnergy.travel.loadUse + dayEnergy.overnight.loadUse,
    travelImpact: dayEnergy.travel.travelImpact + dayEnergy.overnight.travelImpact,
    hookupSupport: dayEnergy.travel.hookupSupport + dayEnergy.overnight.hookupSupport,
    eventAdjustment: dayEnergy.travel.eventAdjustment + dayEnergy.overnight.eventAdjustment,
    hookupCashDelta: dayEnergy.travel.hookupCashDelta + dayEnergy.overnight.hookupCashDelta,
    netBatteryDelta: dayEnergy.travel.netBatteryDelta + dayEnergy.overnight.netBatteryDelta,
    chargingBand:
      dayEnergy.overnight.chargingBand !== "fair"
        ? dayEnergy.overnight.chargingBand
        : dayEnergy.travel.chargingBand,
    loadBand:
      dayEnergy.overnight.loadUse >= dayEnergy.travel.loadUse
        ? dayEnergy.overnight.loadBand
        : dayEnergy.travel.loadBand,
    notes: [...dayEnergy.travel.notes, ...dayEnergy.overnight.notes]
  };
}

function buildMorningIntelNotes(routeIntel) {
  const notes = [];
  const activeRumor = routeIntel?.activeRumor;
  const nextLegIntel = routeIntel?.nextLegIntel;

  if (activeRumor?.label && activeRumor?.effectSummary) {
    const source = activeRumor.sourceName ? ` (${activeRumor.sourceName})` : "";
    notes.push(`Road intel${source}: ${activeRumor.label}. ${activeRumor.effectSummary}`);
  }

  if (nextLegIntel?.label && nextLegIntel?.effectSummary) {
    const ahead = nextLegIntel.targetPointName
      ? `Past ${nextLegIntel.targetPointName}`
      : "Further ahead";
    notes.push(`${ahead}: ${nextLegIntel.label}. ${nextLegIntel.effectSummary}`);
  }

  return notes;
}

function addDays(dateISO, days) {
  const date = new Date(`${dateISO}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function clampSunlightFactor(value) {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return 1;
  }

  return Math.max(0.35, Math.min(1.15, numericValue));
}
