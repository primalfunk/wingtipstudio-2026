import {
  CAMPSITE_TYPES,
  COMFORT_POLICIES,
  CONDITION_BANDS,
  DAY_PHASES,
  DEFAULT_STARTING_VALUES,
  HOOKUP_CASH_COST,
  LOSS_FLAGS,
  LOSS_LABELS,
  MORALE_BANDS,
  PHASE_LABELS,
  STATUS_THRESHOLDS,
  TRAVEL_MODES,
  WARNING_FLAGS,
  WARNING_LABELS
} from "../constants/gameConstants.js";
import {
  buildForecastDeck,
  buildPendingEvents,
  campsiteOptions,
  comfortPolicyOptions,
  defaultSetupSelection,
  getCampsiteOption,
  getComfortPolicyOption,
  getRoutePreset,
  getStartingCondition,
  getWeatherAtDay,
  getTravelModeOption,
  townAdviceOptions,
  townActionOptions,
  townServiceDefinitions,
  travelModeOptions
} from "./gameContent.js";
import {
  getV2ConnectedDestinations,
  getV2CurrentSpineNode,
  getV2JourneyNode,
  getV2NextSpineNode
} from "./v2JourneyGraph.js";
import { getEnergyWarnings } from "../systems/energyModel.js";
import {
  createPassengerPressureState,
  getMoraleDescriptor as getPassengerMoraleDescriptor,
  getMoralePressureScore,
  getMoralePressureSummary as getPassengerMoralePressureSummary,
  getMoraleWarnings,
  normalizePassengerPressureState
} from "../systems/passengerPressure.js";
import {
  buildRouteProgressSummary as buildStructuredRouteProgressSummary,
  checkForRouteCompletion as checkStructuredRouteCompletion,
  getCurrentRoutePoint,
  normalizeRoutePoints
} from "../systems/routeProgress.js";
import {
  normalizeOvernightContext,
  setSelectedCampsiteTypeOnState
} from "../systems/overnightContext.js";
import {
  normalizeActiveRouteStop,
  normalizeRouteStopActionRecord
} from "../systems/routeStopState.js";
import {
  createCabinFeverState,
  createOutcomeExplainersState,
  createResourcePressureState,
  createScoreState,
  finalizeStructuredScore,
  getMoraleScoreBand,
  normalizePressureValue,
  refreshDerivedScore,
  updateResourcePressure
} from "../systems/coreSystems.js";

const EMPTY_EVENT = Object.freeze({
  id: "no_event",
  title: "Quiet Road",
  flavor: "Nothing much is pressing right now.",
  consequence: "For the moment, the road is calm."
});

const V2_DEFAULTS = Object.freeze({
  wasteCapacity: 100,
  wasteLevel: 18,
  tripScore: 0,
  hiddenMorale: 80
});

export function createDefaultGameState(selection = {}) {
  const resolvedSelection = {
    ...defaultSetupSelection,
    ...selection
  };
  const route = getRoutePreset(resolvedSelection.routePresetId);
  const supportRoute = getRoutePreset(defaultSetupSelection.routePresetId);
  const startingCondition = getStartingCondition(resolvedSelection.startingConditionId);
  const initialWeather = getWeatherAtDay(supportRoute, 1);
  const effectiveDeadlineDays = Math.max(
    1,
    startingCondition.deadlineDays + Number(route.deadlineAdjustmentDays ?? 0)
  );

  return normalizeGameState({
    runId: createRunId(),
    dayNumber: 1,
    currentPhase: DAY_PHASES.MORNING_REVIEW,
    gameOver: false,
    victory: false,
    metadata: {
      routePresetId: route.id,
      startingConditionId: startingCondition.id,
      startDate: route.startDate
    },
    resources: buildV2StartingResources(startingCondition),
    journey: {
      routeName: route.label,
      routeSummary: route.summary,
      originName: route.originName,
      destinationName: route.destinationName,
      totalMilesToDestination: route.totalMiles,
      milesTraveled: 0,
      milesRemaining: route.totalMiles,
      routePoints: cloneGameState(route.routePoints ?? []),
      currentLocationName: route.stops[0],
      nextStopName: route.stops[1] ?? route.stops[0],
      currentStopIndex: 0,
      stops: [...route.stops],
      currentRoutePointId: null,
      nextWaypointId: null,
      currentSegmentId: null,
      currentSegmentLabel: null,
      currentSegmentSummary: null,
      routeProgressSummary: null,
      routeChoices: {
        selections: {},
        history: []
      },
      deadlineDays: effectiveDeadlineDays,
      daysRemaining: effectiveDeadlineDays
    },
    policies: {
      drivingStyle: TRAVEL_MODES.BALANCED,
      travelMode: TRAVEL_MODES.BALANCED,
      comfortPolicy: COMFORT_POLICIES.BALANCED,
      selectedCampsiteType: null
    },
    environment: {
      currentWeather: initialWeather.label,
      weatherProfile: initialWeather,
      forecast: buildForecastDeck(supportRoute, 1),
      sunlightFactor: initialWeather.sunlightFactor,
      terrainModifier: 1
    },
    routeIntel: createEmptyRouteIntelState(),
    passengerPressure: createPassengerPressureState(),
    score: createScoreState({
      expectedDays: Math.max(1, Math.ceil(route.totalMiles / 420))
    }),
    cabinFever: createCabinFeverState(),
    resourcePressure: createResourcePressureState(),
    explainers: createOutcomeExplainersState(),
    pressure: 0,
    day: createEmptyDayState(route.startDate, {
      summaryHeadline: "Morning comes quietly over the rig.",
      summaryNotes: [
        "The trip is just beginning.",
        "Set your day tone, choose how to live today, and then head out."
      ]
    }),
    townTalk: createEmptyTownTalkState(),
    events: {
      pendingEvents: buildPendingEvents(supportRoute, 1),
      recentEvents: [],
      warnings: [],
      activeEvent: null
    }
  });
}

export function resetRun(selection = {}) {
  return createDefaultGameState(selection);
}

export function cloneGameState(runState) {
  if (typeof structuredClone === "function") {
    return structuredClone(runState);
  }

  return JSON.parse(JSON.stringify(runState));
}

export function applyPatchToGameState(runState, patch) {
  return normalizeGameState(deepMerge(cloneGameState(runState), patch));
}

export function finalizeGameState(runState) {
  return normalizeGameState(cloneGameState(runState));
}

export function createEmptyDayState(currentDate, overrides = {}) {
  return {
    currentDate,
    dailyMilesDriven: 0,
    dailyBatteryDelta: 0,
    dailyFuelDelta: 0,
    dailyWaterDelta: 0,
    dailyWasteDelta: 0,
    dailyTripScoreDelta: 0,
    dailyMoraleDelta: 0,
    dailyConditionDelta: 0,
    dailyCashDelta: 0,
    selectedTownActionId: null,
    summaryHeadline: "Morning comes quietly over the rig.",
    summaryNotes: [],
    eventLog: [],
    eventsResolvedCount: 0,
    townActionsTaken: [],
    lastTownActionResult: null,
    reachedRoutePoints: [],
    routeArrivalNotice: null,
    energy: createEmptyDayEnergy(),
    routeStopActionsTaken: [],
    lastRouteStopActionResult: null,
    activeRouteStop: null,
    overnightContext: null,
    overnightNarrative: null,
    generatedStops: null,
    selectedGeneratedStop: null,
    activeTownStop: null,
    travelSession: null,
    ...overrides
  };
}

function createEmptyRouteIntelState() {
  return {
    activeRumor: null,
    nextLegIntel: null
  };
}

function createEmptyTownTalkState() {
  return {
    remainingIds: [],
    cycleCount: 0,
    lastAdviceId: null
  };
}

export function setTravelMode(runState, travelMode) {
  const nextMode =
    travelModeOptions.find((entry) => entry.id === travelMode)?.id ?? TRAVEL_MODES.BALANCED;
  return applyPatchToGameState(runState, {
    currentPhase: DAY_PHASES.PLAYER_DECISION,
    policies: {
      drivingStyle: nextMode,
      travelMode: nextMode
    }
  });
}

export function cycleTravelMode(runState) {
  return setTravelMode(
    runState,
    getNextOptionId(
      travelModeOptions,
      runState.policies.drivingStyle ?? runState.policies.travelMode
    )
  );
}

export function setDrivingStyle(runState, drivingStyle) {
  return setTravelMode(runState, drivingStyle);
}

export function cycleDrivingStyle(runState) {
  return cycleTravelMode(runState);
}

export function setComfortPolicy(runState, comfortPolicy) {
  const nextPolicy = normalizeComfortPolicyId(comfortPolicy);
  return applyPatchToGameState(runState, {
    currentPhase: DAY_PHASES.PLAYER_DECISION,
    policies: {
      comfortPolicy: nextPolicy
    }
  });
}

export function cycleComfortPolicy(runState) {
  return setComfortPolicy(
    runState,
    getNextOptionId(comfortPolicyOptions, runState.policies.comfortPolicy)
  );
}

export function setCampsiteType(runState, campsiteType) {
  const nextState = cloneGameState(runState);
  nextState.currentPhase = DAY_PHASES.CAMP_DECISION;
  setSelectedCampsiteTypeOnState(nextState, campsiteType);
  return finalizeGameState(nextState);
}

export function setTownAction(runState, townActionId) {
  const nextTownAction =
    townActionId === null
      ? null
      : townActionOptions.find((entry) => entry.id === townActionId)?.id ?? null;
  return applyPatchToGameState(runState, {
    currentPhase: DAY_PHASES.TOWN_STOP,
    day: {
      selectedTownActionId: nextTownAction
    }
  });
}

export function setPhase(runState, phase) {
  const nextPhase = Object.values(DAY_PHASES).includes(phase)
    ? phase
    : DAY_PHASES.MORNING_REVIEW;

  return applyPatchToGameState(runState, {
    currentPhase: nextPhase
  });
}

export function applyDebugPreset(runState, presetId) {
  const nextWaypointTarget = Math.max(
    0,
    (runState.journey.routePoints?.[1]?.mileMarker ?? Math.round(runState.journey.totalMilesToDestination * 0.2)) -
      20
  );
  const destinationApproachTarget = Math.max(
    0,
    runState.journey.totalMilesToDestination - 40
  );
  const patches = {
    low_battery: {
      resources: {
        batteryCharge: 8
      }
    },
    low_water: {
      resources: {
        water: 10
      }
    },
    high_waste: {
      v2: {
        resources: {
          waste: {
            current: 88
          }
        }
      }
    },
    low_outlook: {
      v2: {
        hiddenMorale: 16
      },
      resources: {
        passengerMorale: 16
      },
      passengerPressure: {
        recentFrugalDays: 2,
        recentPushMilesDays: 1,
        poorRestStreak: 2,
        recoveryMomentum: 0
      }
    },
    strain_building: {
      resources: {
        passengerMorale: 42,
        batteryCharge: 28
      },
      passengerPressure: {
        recentFrugalDays: 2,
        recentPushMilesDays: 2,
        poorRestStreak: 2,
        recoveryMomentum: 0
      }
    },
    recovered_cabin: {
      resources: {
        passengerMorale: 68
      },
      passengerPressure: {
        recentFrugalDays: 0,
        recentPushMilesDays: 0,
        poorRestStreak: 0,
        recoveryMomentum: 2
      }
    },
    milestone_ready: {
      journey: {
        milesTraveled: nextWaypointTarget
      }
    },
    destination_approach: {
      journey: {
        milesTraveled: destinationApproachTarget
      }
    },
    victory_ready: {
      currentPhase: DAY_PHASES.DAY_END,
      resources: {
        batteryCharge: 24,
        passengerMorale: 48
      },
      v2: {
        hiddenMorale: 48,
        resources: {
          waste: {
            current: 28
          },
          tripScore: 22
        }
      },
      journey: {
        milesTraveled: runState.journey.totalMilesToDestination
      }
    },
    clear_placeholders: {
      environment: {
        forecast: []
      },
      events: {
        pendingEvents: [],
        recentEvents: [],
        activeEvent: null
      }
    }
  };

  return applyPatchToGameState(runState, patches[presetId] ?? {});
}

export function getBatteryPercent(runState) {
  return getPercent(runState.v2.resources.electric.charge, runState.v2.resources.electric.capacity);
}

export function getWaterPercent(runState) {
  return getPercent(runState.v2.resources.water.current, runState.v2.resources.water.capacity);
}

export function getWastePercent(runState) {
  return getPercent(runState.v2.resources.waste.current, runState.v2.resources.waste.capacity);
}

export function getMoraleBand(runState) {
  const value = runState.v2.hiddenMorale;

  if (value > STATUS_THRESHOLDS.morale.high) {
    return MORALE_BANDS.HIGH;
  }
  if (value > STATUS_THRESHOLDS.morale.steady) {
    return MORALE_BANDS.STEADY;
  }
  if (value > STATUS_THRESHOLDS.morale.low) {
    return MORALE_BANDS.LOW;
  }
  return MORALE_BANDS.BREAKING;
}

export function getMoraleDescriptor(runState) {
  const band = getMoraleBand(runState);
  const pressureScore = getMoralePressureScore(runState);

  if (band === MORALE_BANDS.HIGH) {
    return pressureScore <= 1 ? "Settled" : "Feeling Good";
  }

  if (band === MORALE_BANDS.STEADY) {
    return pressureScore <= 2 ? "Steady" : "A Bit Tight";
  }

  if (band === MORALE_BANDS.LOW) {
    return pressureScore <= 3 ? "Uneasy" : "Worn";
  }

  return pressureScore <= 4 ? "Worn Down" : "Running Low";
}

export function getMoralePressureSummary(runState) {
  return getPassengerMoralePressureSummary(runState);
}

export function getWarningFlags(runState) {
  const warnings = [...getEnergyWarnings(runState), ...getMoraleWarnings(runState)];
  const waterPercent = getWaterPercent(runState);
  const wastePercent = getWastePercent(runState);
  const requiredMilesPerDay = getRequiredMilesPerDay(runState);

  if (waterPercent <= STATUS_THRESHOLDS.lowResourcePercent) {
    warnings.push(WARNING_FLAGS.LOW_WATER);
  }

  if (wastePercent >= STATUS_THRESHOLDS.criticalWastePercent) {
    warnings.push(WARNING_FLAGS.WASTE_NEAR_LIMIT);
  } else if (wastePercent >= STATUS_THRESHOLDS.highWastePercent) {
    warnings.push(WARNING_FLAGS.HIGH_WASTE);
  }

  if (
    runState.journey.milesRemaining > 0 &&
    runState.journey.daysRemaining > 0 &&
    requiredMilesPerDay >= STATUS_THRESHOLDS.paceWarningMilesPerDay
  ) {
    warnings.push(WARNING_FLAGS.BEHIND_SCHEDULE);
  }

  return [...new Set(warnings)];
}

export function checkLossConditions(runState) {
  const lossConditions = [];

  if (runState.v2.resources.electric.charge <= 0) {
    lossConditions.push(LOSS_FLAGS.BATTERY_DEPLETED);
  }

  if (runState.v2.resources.water.current <= 0) {
    lossConditions.push(LOSS_FLAGS.WATER_DEPLETED);
  }

  if (runState.v2.resources.waste.current >= runState.v2.resources.waste.capacity) {
    lossConditions.push(LOSS_FLAGS.WASTE_OVERFLOW);
  }

  if (runState.v2.hiddenMorale <= 0) {
    lossConditions.push(LOSS_FLAGS.MORALE_COLLAPSED);
  }

  if (runState.journey.daysRemaining <= 0 && runState.journey.milesRemaining > 0) {
    lossConditions.push(LOSS_FLAGS.DEADLINE_MISSED);
  }

  return lossConditions;
}

export function checkVictoryCondition(runState) {
  return runState.journey.milesRemaining <= 0;
}

export function getRouteProgressPercent(runState) {
  return getPercent(
    runState.journey.milesTraveled,
    Math.max(1, runState.journey.totalMilesToDestination)
  );
}

export function getRequiredMilesPerDay(runState) {
  if (runState.journey.milesRemaining <= 0) {
    return 0;
  }

  if (runState.journey.daysRemaining <= 0) {
    return runState.journey.milesRemaining;
  }

  return Math.ceil(runState.journey.milesRemaining / runState.journey.daysRemaining);
}

export function getSchedulePressureLabel(runState) {
  const requiredMilesPerDay = getRequiredMilesPerDay(runState);

  if (requiredMilesPerDay >= STATUS_THRESHOLDS.paceDangerMilesPerDay) {
    return "Urgent";
  }

  if (requiredMilesPerDay >= STATUS_THRESHOLDS.paceWarningMilesPerDay) {
    return "Tight";
  }

  if (requiredMilesPerDay >= STATUS_THRESHOLDS.paceSteadyMilesPerDay) {
    return "Steady";
  }

  return "Easy";
}

export function getRouteProgressSummary(runState) {
  return buildStructuredRouteProgressSummary(runState.journey);
}

export function checkForRouteCompletion(runState) {
  return checkStructuredRouteCompletion(runState);
}

export function getDerivedStatus(runState) {
  const lossConditions = checkLossConditions(runState);
  const victory = checkVictoryCondition(runState);
  const weatherProfile = runState.environment.weatherProfile ?? {};
  const moraleScoreBand = getMoraleScoreBand(runState.v2?.hiddenMorale ?? 0);

  return {
    electricPercent: getBatteryPercent(runState),
    batteryPercent: getBatteryPercent(runState),
    waterPercent: getWaterPercent(runState),
    wastePercent: getWastePercent(runState),
    tripScore: runState.v2.resources.tripScore,
    structuredScore: runState.score,
    finalScore: runState.score?.finalScore ?? 0,
    baseScore: runState.score?.baseScore ?? 0,
    moraleScoreBand,
    solarOutlook:
      typeof weatherProfile.solarOutlook === "string"
        ? weatherProfile.solarOutlook
        : runState.v2.currentConditions?.solarOutlook ?? "Fair",
    weatherLabel:
      typeof weatherProfile.label === "string"
        ? weatherProfile.label
        : runState.environment.currentWeather,
    weatherSummary:
      typeof weatherProfile.forecast === "string"
        ? weatherProfile.forecast
        : runState.v2.currentConditions?.summary ?? "No current conditions note.",
    weatherSeverity:
      typeof weatherProfile.severity === "string"
        ? weatherProfile.severity
        : runState.v2.currentConditions?.severity ?? "normal",
    moraleBand: getMoraleBand(runState),
    moraleDescriptor: getMoraleDescriptor(runState),
    moralePressureSummary: getMoralePressureSummary(runState),
    moralePressureScore: getMoralePressureScore(runState),
    routeProgressPercent: getRouteProgressPercent(runState),
    routeProgressSummary: getRouteProgressSummary(runState),
    requiredMilesPerDay: getRequiredMilesPerDay(runState),
    schedulePressure: getSchedulePressureLabel(runState),
    warnings: getWarningFlags(runState),
    lossConditions,
    victoryEligible: victory,
    isStable: lossConditions.length === 0 && !victory
  };
}

export function getStateInspectorSnapshot(runState) {
  return {
    stateSchemaVersion: runState.stateSchemaVersion,
    runId: runState.runId,
    dayNumber: runState.dayNumber,
    currentPhase: runState.currentPhase,
    gameOver: runState.gameOver,
    victory: runState.victory,
    metadata: runState.metadata,
    resources: runState.resources,
    journey: runState.journey,
    policies: runState.policies,
    environment: runState.environment,
    routeIntel: runState.routeIntel,
    passengerPressure: runState.passengerPressure,
    day: runState.day,
    events: runState.events,
    v2: runState.v2,
    derived: getDerivedStatus(runState)
  };
}

export function getCurrentPendingEvent(runState) {
  return runState.events.pendingEvents[0] ?? EMPTY_EVENT;
}

export function getPhaseLabel(phase) {
  return PHASE_LABELS[phase] ?? PHASE_LABELS[DAY_PHASES.MORNING_REVIEW];
}

export function getWarningLabel(flag) {
  return WARNING_LABELS[flag] ?? flag;
}

export function getLossLabel(flag) {
  return LOSS_LABELS[flag] ?? flag;
}

export function getForecastSummary(runState) {
  if (!Array.isArray(runState.environment.forecast) || runState.environment.forecast.length === 0) {
    return "No sky note yet.";
  }

  return runState.environment.forecast
    .map((entry) => entry.forecast ?? entry.label ?? "No sky note yet")
    .join(" | ");
}

export function formatDisplayDate(dateISO) {
  return new Date(`${dateISO}T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric"
  });
}

function normalizeGameState(runState) {
  const normalized = cloneGameState(runState);
  normalized.resources ??= {};
  normalized.journey ??= {};
  normalized.policies ??= {};
  normalized.environment ??= {};
  normalized.routeIntel ??= {};
  normalized.passengerPressure ??= {};
  normalized.score = createScoreState(normalized.score);
  normalized.cabinFever = createCabinFeverState(normalized.cabinFever);
  normalized.resourcePressure = createResourcePressureState(normalized.resourcePressure);
  normalized.explainers = createOutcomeExplainersState(normalized.explainers);
  normalized.pressure = normalizePressureValue(normalized.pressure);
  normalized.day ??= {};
  normalized.townTalk ??= {};
  normalized.events ??= {};
  normalized.metadata ??= {};
  normalized.v2 ??= {};
  normalized.stateSchemaVersion = 2;

  normalized.dayNumber = Math.max(1, Number(normalized.dayNumber) || 1);
  normalized.currentPhase = Object.values(DAY_PHASES).includes(normalized.currentPhase)
    ? normalized.currentPhase
    : DAY_PHASES.MORNING_REVIEW;

  normalized.resources.batteryCapacity = clampPositive(
    normalized.resources.batteryCapacity,
    DEFAULT_STARTING_VALUES.batteryCapacity
  );
  normalized.resources.fuelCapacity = clampPositive(
    normalized.resources.fuelCapacity,
    DEFAULT_STARTING_VALUES.fuelCapacity
  );
  normalized.resources.waterCapacity = clampPositive(
    normalized.resources.waterCapacity,
    DEFAULT_STARTING_VALUES.waterCapacity
  );

  normalized.resources.batteryCharge = clamp(
    normalized.resources.batteryCharge,
    0,
    normalized.resources.batteryCapacity
  );
  normalized.resources.fuel = clamp(normalized.resources.fuel, 0, normalized.resources.fuelCapacity);
  normalized.resources.water = clamp(
    normalized.resources.water,
    0,
    normalized.resources.waterCapacity
  );
  normalized.resources.cash = Math.max(0, Number(normalized.resources.cash) || 0);
  normalized.resources.rvCondition = clamp(normalized.resources.rvCondition, 0, 100);
  normalized.resources.passengerMorale = clamp(normalized.resources.passengerMorale, 0, 100);

  normalized.journey.totalMilesToDestination = Math.max(
    1,
    Number(normalized.journey.totalMilesToDestination) || 1
  );
  normalized.journey.milesTraveled = clamp(
    normalized.journey.milesTraveled,
    0,
    normalized.journey.totalMilesToDestination
  );
  normalized.journey.milesRemaining = Math.max(
    0,
    normalized.journey.totalMilesToDestination - normalized.journey.milesTraveled
  );
  normalized.journey.deadlineDays = Math.max(
    1,
    Number(normalized.journey.deadlineDays) || 1
  );
  normalized.journey.daysRemaining = Math.max(
    0,
    Number(normalized.journey.daysRemaining) || 0
  );
  normalized.journey.routeChoices = normalizeRouteChoiceState(normalized.journey.routeChoices);

  if (!Array.isArray(normalized.journey.stops) || normalized.journey.stops.length === 0) {
    normalized.journey.stops = ["Start", "First Stop", "Destination"];
  }

  const canonicalRoute = getRoutePreset(normalized.metadata.routePresetId);
  normalized.metadata.routePresetId = canonicalRoute.id;
  normalized.metadata.startDate = canonicalRoute.startDate;
  normalized.journey.routeName = canonicalRoute.label;
  normalized.journey.routeSummary = canonicalRoute.summary;
  normalized.journey.originName = canonicalRoute.originName;
  normalized.journey.destinationName = canonicalRoute.destinationName;
  normalized.journey.totalMilesToDestination = Math.max(
    1,
    Number(canonicalRoute.totalMiles) || 1
  );
  normalized.journey.milesTraveled = clamp(
    normalized.journey.milesTraveled,
    0,
    normalized.journey.totalMilesToDestination
  );
  normalized.journey.milesRemaining = Math.max(
    0,
    normalized.journey.totalMilesToDestination - normalized.journey.milesTraveled
  );
  normalized.journey.routePoints = normalizeRoutePoints(
    canonicalRoute.routePoints,
    normalized.journey.totalMilesToDestination,
    canonicalRoute.stops,
    canonicalRoute.originName,
    canonicalRoute.destinationName
  );
  const currentRoutePoint = getCurrentRoutePoint(normalized.journey);
  const routeProgressSummary = getRouteProgressSummary(normalized);
  normalized.journey.stops = normalized.journey.routePoints.map((point) => point.name);
  normalized.journey.currentStopIndex = clamp(
    currentRoutePoint.index,
    0,
    normalized.journey.stops.length - 1
  );
  normalized.journey.currentLocationName = routeProgressSummary.currentLocationName;
  normalized.journey.currentRoutePointId = routeProgressSummary.currentPointId;
  normalized.journey.nextStopName = routeProgressSummary.nextWaypointName;
  normalized.journey.nextWaypointId = routeProgressSummary.nextWaypointId;
  normalized.journey.currentSegmentId = routeProgressSummary.currentSegmentId;
  normalized.journey.currentSegmentLabel = routeProgressSummary.currentSegmentLabel;
  normalized.journey.currentSegmentSummary = routeProgressSummary.currentSegmentSummary;
  normalized.journey.routeProgressSummary = routeProgressSummary.summaryText;

  normalized.policies.travelMode = travelModeOptions.some(
    (entry) => entry.id === normalized.policies.travelMode
  )
    ? normalized.policies.travelMode
    : TRAVEL_MODES.BALANCED;
  normalized.policies.drivingStyle = travelModeOptions.some(
    (entry) => entry.id === normalized.policies.drivingStyle
  )
    ? normalized.policies.drivingStyle
    : normalized.policies.travelMode;
  normalized.policies.travelMode = normalized.policies.drivingStyle;
  normalized.policies.comfortPolicy = normalizeComfortPolicyId(normalized.policies.comfortPolicy);
  normalized.policies.selectedCampsiteType = campsiteOptions.some(
    (entry) => entry.id === normalized.policies.selectedCampsiteType
  )
    ? normalized.policies.selectedCampsiteType
    : null;

  normalized.environment.currentWeather = normalized.environment.currentWeather || "mild";
  normalized.environment.weatherProfile =
    typeof normalized.environment.weatherProfile === "object" && normalized.environment.weatherProfile !== null
      ? normalized.environment.weatherProfile
      : getWeatherAtDay(defaultSetupSelection.routePresetId, normalized.dayNumber);
  normalized.environment.forecast = Array.isArray(normalized.environment.forecast)
    ? normalized.environment.forecast
    : [];
  normalized.environment.sunlightFactor = clampNumber(
    normalized.environment.sunlightFactor,
    0,
    2,
    1
  );
  normalized.environment.terrainModifier = clampNumber(
    normalized.environment.terrainModifier,
    0.5,
    2,
    1
  );
  normalized.routeIntel = normalizeRouteIntelState(
    normalized.routeIntel,
    routeProgressSummary.currentSegmentId
  );
  normalized.passengerPressure = normalizePassengerPressureState(normalized.passengerPressure);
  delete normalized.metadata.passengerSetId;
  delete normalized.metadata.passengerLabel;
  delete normalized.metadata.routeLabel;

  normalized.day.currentDate = normalized.day.currentDate || normalized.metadata.startDate;
  normalized.day.dailyMilesDriven = Number(normalized.day.dailyMilesDriven) || 0;
  normalized.day.dailyBatteryDelta = Number(normalized.day.dailyBatteryDelta) || 0;
  normalized.day.dailyFuelDelta = Number(normalized.day.dailyFuelDelta) || 0;
  normalized.day.dailyWaterDelta = Number(normalized.day.dailyWaterDelta) || 0;
  normalized.day.dailyMoraleDelta = Number(normalized.day.dailyMoraleDelta) || 0;
  normalized.day.dailyConditionDelta = Number(normalized.day.dailyConditionDelta) || 0;
  normalized.day.dailyCashDelta = Number(normalized.day.dailyCashDelta) || 0;
  const validTownActionIds = new Set([
    ...townActionOptions.map((entry) => entry.id),
    ...townServiceDefinitions.map((entry) => entry.id)
  ]);
  normalized.day.selectedTownActionId = validTownActionIds.has(normalized.day.selectedTownActionId)
    ? normalized.day.selectedTownActionId
    : null;
  normalized.day.summaryHeadline = normalized.day.summaryHeadline || "The road is ready when you are.";
  normalized.day.summaryNotes = Array.isArray(normalized.day.summaryNotes)
    ? normalized.day.summaryNotes
    : [];
  normalized.day.eventLog = Array.isArray(normalized.day.eventLog)
    ? normalized.day.eventLog
    : [];
  normalized.day.eventsResolvedCount = Math.max(0, Number(normalized.day.eventsResolvedCount) || 0);
  normalized.day.townActionsTaken = Array.isArray(normalized.day.townActionsTaken)
    ? normalized.day.townActionsTaken
    : [];
  normalized.day.lastTownActionResult =
    typeof normalized.day.lastTownActionResult === "object" &&
    normalized.day.lastTownActionResult !== null
      ? normalized.day.lastTownActionResult
      : null;
  normalized.day.reachedRoutePoints = Array.isArray(normalized.day.reachedRoutePoints)
    ? normalized.day.reachedRoutePoints
    : [];
  normalized.day.routeArrivalNotice =
    typeof normalized.day.routeArrivalNotice === "object" &&
    normalized.day.routeArrivalNotice !== null
      ? normalized.day.routeArrivalNotice
      : null;
  normalized.day.energy = normalizeDayEnergy(normalized.day.energy);
  normalized.day.routeStopActionsTaken = Array.isArray(normalized.day.routeStopActionsTaken)
    ? normalized.day.routeStopActionsTaken.map(normalizeRouteStopActionRecord).filter(Boolean)
    : [];
  normalized.day.lastRouteStopActionResult =
    typeof normalized.day.lastRouteStopActionResult === "object" &&
    normalized.day.lastRouteStopActionResult !== null
      ? normalizeRouteStopActionRecord(normalized.day.lastRouteStopActionResult)
      : null;
  normalized.day.activeRouteStop = normalizeActiveRouteStop(normalized.day.activeRouteStop);
  normalized.day.overnightContext =
    normalized.day.overnightContext !== null && normalized.day.overnightContext !== undefined
      ? normalizeOvernightContext(normalized.day.overnightContext, normalized)
      : null;
  if (normalized.day.overnightContext !== null) {
    normalized.policies.selectedCampsiteType =
      normalized.day.overnightContext.selectedCampsiteType;
  }
  normalized.day.activeTownStop = normalizeActiveTownStop(normalized.day.activeTownStop);
  normalized.day.travelSession = normalizeTravelSession(normalized.day.travelSession);
  normalized.townTalk = normalizeTownTalkState(normalized.townTalk);

  normalized.events.pendingEvents = Array.isArray(normalized.events.pendingEvents)
    ? normalized.events.pendingEvents
    : [];
  normalized.events.recentEvents = Array.isArray(normalized.events.recentEvents)
    ? normalized.events.recentEvents
    : [];
  normalized.events.activeEvent =
    typeof normalized.events.activeEvent === "object" && normalized.events.activeEvent !== null
      ? normalized.events.activeEvent
      : null;
  normalized.v2 = normalizeV2State(normalized.v2, normalized);
  normalized.resources.passengerMorale = normalized.v2.hiddenMorale;
  updateResourcePressure(normalized);
  if (normalized.journey.milesRemaining <= 0 || normalized.gameOver) {
    finalizeStructuredScore(normalized);
  } else {
    refreshDerivedScore(normalized);
  }
  if (
    normalized.v2?.currentLocation?.locationType &&
    normalized.v2.currentLocation.locationType !== "town_hub" &&
    normalized.v2.currentLocation.locationType !== "route_connector" &&
    normalized.v2.currentLocation.locationType !== "travel_segment"
  ) {
    normalized.journey.currentLocationName =
      normalized.v2.currentLocation.nodeName ?? normalized.journey.currentLocationName;
  }

  const lossConditions = checkLossConditions(normalized);
  normalized.victory = checkVictoryCondition(normalized);
  normalized.gameOver = normalized.victory || lossConditions.length > 0;
  normalized.events.warnings = getWarningFlags(normalized);

  return normalized;
}

function normalizeV2State(v2State, runState) {
  const source = typeof v2State === "object" && v2State !== null ? v2State : {};
  const routeSummary = getRouteProgressSummary(runState);
  const currentPoint = getCurrentRoutePoint(runState.journey);
  const currentLocation = buildV2CurrentLocation(runState, currentPoint, routeSummary, source);
  const activeSite = buildV2ActiveSite(runState, currentPoint, source);
  const history = normalizeV2HistoryState(source.history);
  const availableDestinations = buildV2AvailableDestinations(runState, currentPoint, history);
  const sourceResources =
    typeof source.resources === "object" && source.resources !== null ? source.resources : {};
  const sourceJourney =
    typeof source.journey === "object" && source.journey !== null ? source.journey : {};

  return {
    currentLocation,
    availableDestinations,
    resources: {
      water: {
        current: clamp(runState.resources.water, 0, runState.resources.waterCapacity),
        capacity: clampPositive(runState.resources.waterCapacity, DEFAULT_STARTING_VALUES.waterCapacity)
      },
      waste: {
        current: clamp(sourceResources.waste?.current, 0, getV2WasteCapacity(sourceResources)),
        capacity: getV2WasteCapacity(sourceResources)
      },
      electric: {
        charge: clamp(runState.resources.batteryCharge, 0, runState.resources.batteryCapacity),
        capacity: clampPositive(
          runState.resources.batteryCapacity,
          DEFAULT_STARTING_VALUES.batteryCapacity
        )
      },
      tripScore: Math.max(
        0,
        Number(sourceResources.tripScore ?? source.tripScore ?? V2_DEFAULTS.tripScore) || 0
      )
    },
    hiddenMorale: clamp(
      source.hiddenMorale ?? runState.resources.passengerMorale,
      0,
      100
    ),
    currentConditions: {
      weather: String(runState.environment.currentWeather ?? "").trim() || "mild",
      weatherType:
        typeof runState.environment.weatherProfile?.weatherType === "string"
          ? runState.environment.weatherProfile.weatherType
          : "mild",
      summary:
        String(runState.environment.weatherProfile?.forecast ?? "").trim() ||
        String(runState.environment.forecast?.[0]?.forecast ?? "").trim() ||
        String(runState.environment.currentWeather ?? "").trim() ||
        "No current conditions note.",
      solarOutlook:
        typeof runState.environment.weatherProfile?.solarOutlook === "string"
          ? runState.environment.weatherProfile.solarOutlook
          : "Fair",
      severity:
        typeof runState.environment.weatherProfile?.severity === "string"
          ? runState.environment.weatherProfile.severity
          : "normal",
      sunlightFactor: clampNumber(runState.environment.sunlightFactor, 0, 2, 1),
      terrainModifier: clampNumber(runState.environment.terrainModifier, 0.5, 2, 1),
      forecast: Array.isArray(runState.environment.forecast)
        ? runState.environment.forecast.map((entry) => ({
            label: typeof entry?.label === "string" ? entry.label : "",
            forecast: typeof entry?.forecast === "string" ? entry.forecast : "",
            sunlightFactor: clampNumber(entry?.sunlightFactor, 0, 2, 1),
            weatherType: typeof entry?.weatherType === "string" ? entry.weatherType : "",
            solarOutlook: typeof entry?.solarOutlook === "string" ? entry.solarOutlook : "",
            severity: typeof entry?.severity === "string" ? entry.severity : ""
          }))
        : []
    },
    comfortPolicy: runState.policies.comfortPolicy,
    journey: {
      dayNumber: runState.dayNumber,
      currentDate: runState.day.currentDate,
      daysElapsed: Math.max(0, runState.dayNumber - 1),
      daysRemaining: Math.max(0, Number(runState.journey.daysRemaining) || 0),
      totalJourneyMiles: Math.max(1, Number(runState.journey.totalMilesToDestination) || 1),
      milesTraveled: Math.max(0, Number(runState.journey.milesTraveled) || 0),
      milesRemaining: Math.max(0, Number(runState.journey.milesRemaining) || 0),
      currentLegId: runState.journey.currentSegmentId,
      currentDestinationId:
        typeof sourceJourney.currentDestinationId === "string" &&
        availableDestinations.some((entry) => entry.id === sourceJourney.currentDestinationId)
          ? sourceJourney.currentDestinationId
          : availableDestinations[0]?.id ?? null,
      travelState: normalizeV2TravelState(sourceJourney.travelState, runState),
      arrivalState: normalizeV2ArrivalState(sourceJourney.arrivalState, runState)
    },
    stay: {
      site: activeSite,
      selectedDestinationId:
        typeof source.stay?.selectedDestinationId === "string" &&
        availableDestinations.some((entry) => entry.id === source.stay.selectedDestinationId)
          ? source.stay.selectedDestinationId
          : null,
      stayStatus: normalizeV2StayStatus(source.stay?.stayStatus, runState),
      lastArrivalNodeId:
        runState.day.routeArrivalNotice?.id ??
        (typeof source.stay?.lastArrivalNodeId === "string" ? source.stay.lastArrivalNodeId : null)
    },
    history,
    compatibility: {
      derivesLocationFromLegacyRoute: false,
      derivesElectricFromLegacyBattery: true,
      mirrorsComfortPolicyFromLegacyPolicies: true,
      pendingLegacyRemovals: [
        "resources.fuel",
        "resources.cash",
        "resources.rvCondition",
        "resources.passengerMorale",
        "journey.routePoints",
        "journey.routeChoices",
        "metadata.routePresetId",
        "metadata.startingConditionId"
      ]
    }
  };
}

function getV2WasteCapacity(sourceResources) {
  return clampPositive(sourceResources.waste?.capacity, V2_DEFAULTS.wasteCapacity);
}

function buildV2CurrentLocation(runState, currentPoint, routeSummary, source = {}) {
  const selectedDestinationId = normalizeSelectedDestinationNodeId(
    source.stay?.selectedDestinationId ?? source.journey?.currentDestinationId ?? null
  );
  const selectedDestinationNode = getV2JourneyNode(selectedDestinationId);
  const useSelectedDestination =
    selectedDestinationNode !== null &&
    source.journey?.arrivalState !== "not_arrived" &&
    !routeSummary.isBetweenWaypoints;
  const graphNode = useSelectedDestination
    ? selectedDestinationNode
    : getV2CurrentSpineNode(runState.journey.milesTraveled);
  const pointKind =
    typeof graphNode?.category === "string"
      ? graphNode.category
      : typeof currentPoint?.kind === "string"
        ? currentPoint.kind
        : "waypoint";
  const locationType = routeSummary.isBetweenWaypoints
    ? "travel_segment"
    : graphNode?.locationType ?? "route_connector";

  return {
    nodeId: graphNode?.id ?? currentPoint?.id ?? null,
    nodeName: graphNode?.name ?? currentPoint?.name ?? runState.journey.currentLocationName,
    nodeKind: pointKind,
    locationType,
    label: runState.journey.currentLocationName,
    routeTag: graphNode?.category ?? (typeof currentPoint?.tag === "string" ? currentPoint.tag : null),
    isTownHub: graphNode?.category === "town_hub",
    isDestination: graphNode?.category === "destination"
  };
}

function buildV2AvailableDestinations(runState, currentPoint, history = normalizeV2HistoryState()) {
  const currentNode = getV2CurrentSpineNode(runState.journey.milesTraveled);

  if (runState.journey.currentLocationName?.startsWith?.("Between ")) {
    const nextNode = getV2NextSpineNode(runState.journey.milesTraveled);

    return nextNode
      ? [
          {
            id: `destination_${nextNode.id}`,
            nodeId: nextNode.id,
            label: nextNode.name,
            subtitle: nextNode.description,
            distanceMiles: Math.max(
              0,
              nextNode.mileMarker - Math.max(0, Number(runState.journey.milesTraveled) || 0)
            ),
            locationType: nextNode.locationType,
            siteType: nextNode.siteType,
            isAvailable: true,
            source: "forward_spine"
          }
        ]
      : [];
  }

  return getV2ConnectedDestinations(currentNode?.id ?? currentPoint?.id ?? null)
    .map((entry) => {
      const destinationNode = getV2JourneyNode(entry.nodeId);
      const visitCount = Number(history.destinationVisitCounts?.[entry.nodeId]) || 0;
      const maxVisits = getDestinationRepeatCap(destinationNode);
      const isAvailable = visitCount < maxVisits;

      return {
        ...entry,
        isAvailable
      };
    })
    .filter((entry) => entry.isAvailable);
}

function getDestinationRepeatCap(destinationNode) {
  switch (destinationNode?.category) {
    case "premium_boondock":
    case "poor_boondock":
    case "scenic_stop":
    case "roadside_fallback":
    case "gas_station":
      return 1;
    case "rv_park":
      return 2;
    default:
      return Number.POSITIVE_INFINITY;
  }
}

function buildV2ActiveSite(runState, currentPoint, source = {}) {
  const overnightContext = runState.day.overnightContext;
  const selectedDestinationId = normalizeSelectedDestinationNodeId(
    source.stay?.selectedDestinationId ?? source.journey?.currentDestinationId ?? null
  );
  const graphNode =
    getV2JourneyNode(selectedDestinationId) ??
    getV2JourneyNode(currentPoint?.id) ??
    getV2CurrentSpineNode(runState.journey.milesTraveled);
  const pointTag = graphNode?.category ?? (typeof currentPoint?.tag === "string" ? currentPoint.tag : null);

  return {
    nodeId: graphNode?.id ?? currentPoint?.id ?? null,
    name: overnightContext?.locationName ?? graphNode?.name ?? currentPoint?.name ?? runState.journey.currentLocationName,
    locationType: normalizeV2LocationType(overnightContext?.locationType, currentPoint, runState),
    siteType: overnightContext?.locationType ? deriveSiteTypeFromPoint(currentPoint, overnightContext) : graphNode?.siteType ?? deriveSiteTypeFromPoint(currentPoint, overnightContext),
    category: graphNode?.category ?? null,
    hubId: graphNode?.hubId ?? null,
    quality: graphNode?.quality ?? deriveSiteQuality(currentPoint, overnightContext),
    solarExposure: graphNode?.solarExposure ?? deriveSolarExposure(currentPoint, overnightContext),
    weatherShelter: graphNode?.weatherShelter ?? deriveWeatherShelter(pointTag, overnightContext),
    scenicValue: Number(graphNode?.scenicValue) || deriveScenicValue(pointTag),
    services: {
      waterFill: Boolean(
        graphNode?.category === "town_hub" ||
          overnightContext?.locationType === "service_edge" ||
          graphNode?.category === "gas_station"
      ),
      wasteDump: Boolean(
        graphNode?.category === "town_hub" ||
          graphNode?.category === "gas_station" ||
          overnightContext?.locationType === "service_edge"
      ),
      electricHookup: Boolean(
        graphNode?.category === "rv_park" ||
          overnightContext?.locationType === "campground" ||
          overnightContext?.locationType === "service_edge"
      )
    },
    notes: Array.isArray(overnightContext?.quirkNotes) ? [...overnightContext.quirkNotes] : []
  };
}

function normalizeV2HistoryState(value = {}) {
  const source = typeof value === "object" && value !== null ? value : {};

  return {
    destinationVisitCounts: normalizeV2CountMap(source.destinationVisitCounts),
    hubStayCounts: normalizeV2CountMap(source.hubStayCounts)
  };
}

function normalizeV2CountMap(value) {
  const source = typeof value === "object" && value !== null ? value : {};
  return Object.fromEntries(
    Object.entries(source)
      .filter(([key]) => typeof key === "string" && key.length > 0)
      .map(([key, count]) => [key, Math.max(0, Number(count) || 0)])
  );
}

function normalizeV2LocationType(locationType, currentPoint, runState) {
  if (typeof locationType === "string" && locationType.length > 0) {
    return locationType;
  }

  const graphNode =
    getV2JourneyNode(currentPoint?.id) ?? getV2CurrentSpineNode(runState.journey.milesTraveled);

  if (graphNode?.locationType) {
    return graphNode.locationType;
  }

  if (runState.journey.currentLocationName?.startsWith?.("Between ")) {
    return "travel_segment";
  }

  return "site_node";
}

function normalizeSelectedDestinationNodeId(destinationId) {
  if (typeof destinationId !== "string" || destinationId.length === 0) {
    return null;
  }

  return destinationId.startsWith("destination_")
    ? destinationId.slice("destination_".length)
    : destinationId;
}

function normalizeV2TravelState(value, runState) {
  const allowed = new Set(["idle", "planning", "travelling", "interrupted", "arrived"]);

  if (allowed.has(value)) {
    return value;
  }

  if (runState.day.travelSession) {
    return runState.events.activeEvent ? "interrupted" : "travelling";
  }

  if (runState.day.routeArrivalNotice) {
    return "arrived";
  }

  return "planning";
}

function normalizeV2ArrivalState(value, runState) {
  const allowed = new Set(["not_arrived", "arriving", "arrived", "staying"]);

  if (allowed.has(value)) {
    return value;
  }

  if (runState.day.routeArrivalNotice) {
    return "arriving";
  }

  if (runState.day.overnightContext) {
    return "staying";
  }

  return "not_arrived";
}

function normalizeV2StayStatus(value, runState) {
  const allowed = new Set(["idle", "choosing_destination", "traveling", "ready_to_resolve", "resolved"]);

  if (allowed.has(value)) {
    return value;
  }

  if (runState.day.overnightContext) {
    return "ready_to_resolve";
  }

  if (runState.day.travelSession) {
    return "traveling";
  }

  return "idle";
}

function deriveDestinationLocationType(point) {
  if (point?.townId) {
    return "town_hub";
  }

  if (point?.kind === "destination") {
    return "destination";
  }

  return "site_node";
}

function deriveSiteTypeFromPoint(point, overnightContext = null) {
  if (typeof overnightContext?.locationType === "string") {
    switch (overnightContext.locationType) {
      case "campground":
        return "rv_park";
      case "service_edge":
        return "service_stop";
      case "scenic_pullout":
        return "scenic_stop";
      case "roadside":
      default:
        return "boondock_pullout";
    }
  }

  if (point?.townId || point?.tag === "service" || point?.tag === "ferry") {
    return "service_stop";
  }

  if (point?.tag === "camp") {
    return "rv_park";
  }

  if (point?.tag === "destination") {
    return "destination_stop";
  }

  if (point?.tag === "water" || point?.tag === "timber") {
    return "scenic_stop";
  }

  return "boondock_pullout";
}

function deriveSiteQuality(point, overnightContext) {
  if (typeof overnightContext?.locationType === "string") {
    switch (overnightContext.locationType) {
      case "campground":
        return "good";
      case "service_edge":
        return "fair";
      case "scenic_pullout":
        return "good";
      case "roadside":
      default:
        return "rough";
    }
  }

  if (point?.tag === "destination" || point?.tag === "camp" || point?.tag === "water") {
    return "good";
  }

  if (point?.townId || point?.tag === "service" || point?.tag === "ferry") {
    return "fair";
  }

  return "rough";
}

function deriveSolarExposure(point, overnightContext) {
  if (typeof overnightContext?.locationType === "string") {
    switch (overnightContext.locationType) {
      case "campground":
        return "partial";
      case "service_edge":
        return "mixed";
      case "scenic_pullout":
        return point?.tag === "timber" ? "partial" : "open";
      case "roadside":
      default:
        return point?.tag === "timber" ? "partial" : "open";
    }
  }

  if (point?.tag === "timber" || point?.tag === "camp") {
    return "partial";
  }

  return "open";
}

function deriveWeatherShelter(pointTag, overnightContext) {
  if (overnightContext?.locationType === "campground") {
    return "moderate";
  }

  if (pointTag === "timber" || pointTag === "water") {
    return "moderate";
  }

  if (pointTag === "pass" || pointTag === "shelf" || pointTag === "wash") {
    return "low";
  }

  return "mixed";
}

function deriveScenicValue(pointTag) {
  if (pointTag === "destination") {
    return "high";
  }

  if (pointTag === "timber" || pointTag === "water" || pointTag === "camp") {
    return "high";
  }

  if (pointTag === "pass" || pointTag === "shelf") {
    return "medium";
  }

  return "low";
}

function normalizeTownTalkState(townTalk) {
  const validAdviceIds = new Set(townAdviceOptions.map((entry) => entry.id));

  return {
    remainingIds: Array.isArray(townTalk?.remainingIds)
      ? townTalk.remainingIds.filter((entry) => validAdviceIds.has(entry))
      : [],
    cycleCount: Math.max(0, Number(townTalk?.cycleCount) || 0),
    lastAdviceId:
      typeof townTalk?.lastAdviceId === "string" && validAdviceIds.has(townTalk.lastAdviceId)
        ? townTalk.lastAdviceId
        : null
  };
}

function normalizeRouteChoiceState(routeChoices) {
  const source = typeof routeChoices === "object" && routeChoices !== null ? routeChoices : {};
  const selections =
    typeof source.selections === "object" && source.selections !== null
      ? Object.fromEntries(
          Object.entries(source.selections).filter(
            ([choiceId, optionId]) =>
              typeof choiceId === "string" &&
              choiceId.length > 0 &&
              typeof optionId === "string" &&
              optionId.length > 0
          )
        )
      : {};
  const history = Array.isArray(source.history)
    ? source.history
        .map((entry) => normalizeRouteChoiceHistoryEntry(entry))
        .filter(Boolean)
    : [];

  return {
    selections,
    history
  };
}

function normalizeRouteChoiceHistoryEntry(value) {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const choiceId = typeof value.choiceId === "string" ? value.choiceId : null;
  const optionId = typeof value.optionId === "string" ? value.optionId : null;

  if (!choiceId || !optionId) {
    return null;
  }

  return {
    choiceId,
    pointId: typeof value.pointId === "string" ? value.pointId : null,
    choiceName: typeof value.choiceName === "string" ? value.choiceName : "",
    optionId,
    optionLabel: typeof value.optionLabel === "string" ? value.optionLabel : "",
    kicker: typeof value.kicker === "string" ? value.kicker : "",
    resultText: typeof value.resultText === "string" ? value.resultText : ""
  };
}

function normalizeRouteIntelState(routeIntel, currentSegmentId) {
  const source = typeof routeIntel === "object" && routeIntel !== null ? routeIntel : {};
  let activeRumor = normalizeRouteRumor(source.activeRumor, currentSegmentId);
  let nextLegIntel = normalizeNextLegIntel(source.nextLegIntel);

  if (nextLegIntel && nextLegIntel.targetSegmentId === currentSegmentId) {
    if (!activeRumor) {
      activeRumor = promoteNextLegIntel(nextLegIntel, currentSegmentId);
    }
    nextLegIntel = null;
  }

  return {
    activeRumor,
    nextLegIntel
  };
}

function normalizeRouteRumor(activeRumor, currentSegmentId) {
  if (typeof activeRumor !== "object" || activeRumor === null) {
    return null;
  }

  if (
    typeof activeRumor.segmentId === "string" &&
    typeof currentSegmentId === "string" &&
    activeRumor.segmentId !== currentSegmentId
  ) {
    return null;
  }

  const normalizedAdjustments =
    typeof activeRumor.eventWeightAdjustments === "object" &&
    activeRumor.eventWeightAdjustments !== null
      ? Object.fromEntries(
          Object.entries(activeRumor.eventWeightAdjustments)
            .filter(([key]) => typeof key === "string" && key.length > 0)
            .map(([key, value]) => [key, Number(value) || 0])
        )
      : {};

  return {
    id: typeof activeRumor.id === "string" ? activeRumor.id : "route_rumor",
    sourceType: typeof activeRumor.sourceType === "string" ? activeRumor.sourceType : null,
    sourceId: typeof activeRumor.sourceId === "string" ? activeRumor.sourceId : null,
    sourceName: typeof activeRumor.sourceName === "string" ? activeRumor.sourceName : "",
    townId: typeof activeRumor.townId === "string" ? activeRumor.townId : null,
    townName: typeof activeRumor.townName === "string" ? activeRumor.townName : "",
    segmentId: typeof activeRumor.segmentId === "string" ? activeRumor.segmentId : null,
    label: typeof activeRumor.label === "string" ? activeRumor.label : "",
    text: typeof activeRumor.text === "string" ? activeRumor.text : "",
    effectSummary:
      typeof activeRumor.effectSummary === "string" ? activeRumor.effectSummary : "",
    eventWeightAdjustments: normalizedAdjustments,
    legModifierPatch: normalizeIntelLegModifierPatch(activeRumor.legModifierPatch)
  };
}

function normalizeNextLegIntel(nextLegIntel) {
  if (typeof nextLegIntel !== "object" || nextLegIntel === null) {
    return null;
  }

  const targetSegmentId =
    typeof nextLegIntel.targetSegmentId === "string" ? nextLegIntel.targetSegmentId : null;

  if (!targetSegmentId) {
    return null;
  }

  const normalizedAdjustments =
    typeof nextLegIntel.eventWeightAdjustments === "object" &&
    nextLegIntel.eventWeightAdjustments !== null
      ? Object.fromEntries(
          Object.entries(nextLegIntel.eventWeightAdjustments)
            .filter(([key]) => typeof key === "string" && key.length > 0)
            .map(([key, value]) => [key, Number(value) || 0])
        )
      : {};

  return {
    id: typeof nextLegIntel.id === "string" ? nextLegIntel.id : "next_leg_intel",
    sourceType: typeof nextLegIntel.sourceType === "string" ? nextLegIntel.sourceType : null,
    sourceId: typeof nextLegIntel.sourceId === "string" ? nextLegIntel.sourceId : null,
    sourceName: typeof nextLegIntel.sourceName === "string" ? nextLegIntel.sourceName : "",
    targetSegmentId,
    targetPointName:
      typeof nextLegIntel.targetPointName === "string" ? nextLegIntel.targetPointName : "",
    label: typeof nextLegIntel.label === "string" ? nextLegIntel.label : "",
    text: typeof nextLegIntel.text === "string" ? nextLegIntel.text : "",
    effectSummary:
      typeof nextLegIntel.effectSummary === "string" ? nextLegIntel.effectSummary : "",
    eventWeightAdjustments: normalizedAdjustments,
    legModifierPatch: normalizeIntelLegModifierPatch(nextLegIntel.legModifierPatch)
  };
}

function normalizeIntelLegModifierPatch(patch) {
  const source = typeof patch === "object" && patch !== null ? patch : {};
  return {
    travelMilesAdjustment: Number(source.travelMilesAdjustment) || 0,
    fuelDeltaAdjustment: Number(source.fuelDeltaAdjustment) || 0,
    conditionDeltaAdjustment: Number(source.conditionDeltaAdjustment) || 0,
    moraleDeltaAdjustment: Number(source.moraleDeltaAdjustment) || 0,
    sunlightFactorAdjustment: Number(source.sunlightFactorAdjustment) || 0
  };
}

function promoteNextLegIntel(nextLegIntel, segmentId) {
  return {
    id: nextLegIntel.id,
    sourceType: nextLegIntel.sourceType,
    sourceId: nextLegIntel.sourceId,
    sourceName: nextLegIntel.sourceName,
    townId: nextLegIntel.sourceType === "town" ? nextLegIntel.sourceId : null,
    townName: nextLegIntel.sourceType === "town" ? nextLegIntel.sourceName : "",
    segmentId,
    label: nextLegIntel.label,
    text: nextLegIntel.text,
    effectSummary: nextLegIntel.effectSummary,
    eventWeightAdjustments: nextLegIntel.eventWeightAdjustments,
    legModifierPatch: nextLegIntel.legModifierPatch,
    fromNextLegIntel: true
  };
}

function normalizeActiveTownStop(activeTownStop) {
  if (typeof activeTownStop !== "object" || activeTownStop === null) {
    return null;
  }

  return {
    townId: typeof activeTownStop.townId === "string" ? activeTownStop.townId : null,
    pointId: typeof activeTownStop.pointId === "string" ? activeTownStop.pointId : null,
    entryReason:
      activeTownStop.entryReason === "arrival" || activeTownStop.entryReason === "location"
        ? activeTownStop.entryReason
        : "location",
    returnPhase: Object.values(DAY_PHASES).includes(activeTownStop.returnPhase)
      ? activeTownStop.returnPhase
      : DAY_PHASES.PLAYER_DECISION,
    visitBudget: Math.max(0, Number(activeTownStop.visitBudget) || 0),
    actionsRemaining: Math.max(0, Number(activeTownStop.actionsRemaining) || 0),
    servicesUsed: Array.isArray(activeTownStop.servicesUsed)
      ? activeTownStop.servicesUsed.filter((entry) => typeof entry === "string" && entry.length > 0)
      : [],
    latestRumorId:
      typeof activeTownStop.latestRumorId === "string" ? activeTownStop.latestRumorId : null,
    visitState:
      activeTownStop.visitState === "left" || activeTownStop.visitState === "active"
        ? activeTownStop.visitState
        : "active"
  };
}

function getNextOptionId(options, currentId) {
  const currentIndex = options.findIndex((entry) => entry.id === currentId);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % options.length;
  return options[nextIndex].id;
}

function normalizeComfortPolicyId(value) {
  const resolvedValue =
    value === COMFORT_POLICIES.INDULGENT ? COMFORT_POLICIES.COMFORTABLE : value;

  return comfortPolicyOptions.some((entry) => entry.id === resolvedValue)
    ? resolvedValue
    : COMFORT_POLICIES.BALANCED;
}

function deepMerge(target, patch) {
  if (!isPlainObject(patch)) {
    return cloneGameState(patch);
  }

  const output = isPlainObject(target) ? { ...target } : {};

  for (const [key, value] of Object.entries(patch)) {
    if (Array.isArray(value)) {
      output[key] = cloneGameState(value);
      continue;
    }

    if (isPlainObject(value)) {
      output[key] = deepMerge(output[key], value);
      continue;
    }

    output[key] = value;
  }

  return output;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPercent(value, total) {
  return Math.round((Math.max(0, value) / Math.max(1, total)) * 100);
}

function clamp(value, min, max) {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return min;
  }
  return Math.max(min, Math.min(max, numericValue));
}

function clampPositive(value, fallback) {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue) || numericValue <= 0) {
    return fallback;
  }
  return numericValue;
}

function clampNumber(value, min, max, fallback) {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, numericValue));
}

function clampCounter(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function createEmptyDayEnergy() {
  return {
    travel: createEmptyEnergyBreakdown("travel"),
    overnight: createEmptyEnergyBreakdown("overnight"),
    total: createEmptyEnergyBreakdown("total")
  };
}

function createEmptyEnergyBreakdown(context) {
  return {
    context,
    sunlightFactor: 0,
    solarGain: 0,
    loadUse: 0,
    travelImpact: 0,
    hookupSupport: 0,
    eventAdjustment: 0,
    hookupCashDelta: 0,
    netBatteryDelta: 0,
    chargingBand: "fair",
    loadBand: "moderate",
    notes: []
  };
}

function normalizeDayEnergy(dayEnergy) {
  const fallback = createEmptyDayEnergy();
  const normalized = typeof dayEnergy === "object" && dayEnergy !== null ? { ...dayEnergy } : {};

  normalized.travel = normalizeEnergyBreakdown(normalized.travel, fallback.travel);
  normalized.overnight = normalizeEnergyBreakdown(normalized.overnight, fallback.overnight);
  normalized.total = normalizeEnergyBreakdown(normalized.total, fallback.total);

  return normalized;
}

function normalizeTravelSession(travelSession) {
  if (typeof travelSession !== "object" || travelSession === null) {
    return null;
  }

  const normalized = { ...travelSession };
  normalized.currentDayPlannedMiles = Math.max(0, Number(normalized.currentDayPlannedMiles) || 0);
  normalized.milesDrivenSoFarToday = Number(normalized.milesDrivenSoFarToday) || 0;
  normalized.milesRemainingToday = Math.max(0, Number(normalized.milesRemainingToday) || 0);
  normalized.milesToNextStop = Math.max(0, Number(normalized.milesToNextStop) || 0);
  normalized.interruptionCountForToday = clampCounter(normalized.interruptionCountForToday, 0, 3);
  normalized.interruptionTriggers = Array.isArray(normalized.interruptionTriggers)
    ? normalized.interruptionTriggers
        .map((value) => Math.max(0, Math.round(Number(value) || 0)))
        .sort((left, right) => left - right)
    : [];
  normalized.interruptionsResolved = clampCounter(
    normalized.interruptionsResolved,
    0,
    normalized.interruptionCountForToday
  );
  normalized.nextInterruptionIndex = clampCounter(
    normalized.nextInterruptionIndex,
    0,
    normalized.interruptionTriggers.length
  );
  normalized.travelPausedReason =
    normalized.travelPausedReason === null || typeof normalized.travelPausedReason === "string"
      ? normalized.travelPausedReason
      : null;
  normalized.currentTravelPhase = normalized.currentTravelPhase || "driving";
  normalized.roadSpeedMilesPerSecond = clampNumber(
    normalized.roadSpeedMilesPerSecond,
    0.1,
    999,
    18
  );
  normalized.driveHoursTotal = Math.max(0, Number(normalized.driveHoursTotal) || 0);
  normalized.driveHoursElapsed = Math.max(0, Number(normalized.driveHoursElapsed) || 0);
  normalized.driveHoursRemaining = Math.max(0, Number(normalized.driveHoursRemaining) || 0);
  normalized.dayClockStartMinutes = Math.max(0, Number(normalized.dayClockStartMinutes) || 0);
  normalized.dayClockEndMinutes = Math.max(
    normalized.dayClockStartMinutes,
    Number(normalized.dayClockEndMinutes) || normalized.dayClockStartMinutes
  );
  normalized.summaryFinalized = Boolean(normalized.summaryFinalized);
  normalized.debugLog = Array.isArray(normalized.debugLog) ? normalized.debugLog : [];
  normalized.debugForcedEventIds = Array.isArray(normalized.debugForcedEventIds)
    ? normalized.debugForcedEventIds.filter((value) => typeof value === "string" && value.length > 0)
    : [];
  normalized.currentPlan = normalizeTravelSessionPlan(normalized.currentPlan);
  normalized.activeLeg = normalizeTravelLeg(normalized.activeLeg, normalized.currentTravelPhase);

  return normalized;
}

function normalizeTravelSessionPlan(currentPlan) {
  if (typeof currentPlan !== "object" || currentPlan === null) {
    return null;
  }

  return {
    driveHoursAllocated: Math.max(0, Number(currentPlan.driveHoursAllocated) || 0),
    driveHoursConsumed: Math.max(0, Number(currentPlan.driveHoursConsumed) || 0),
    milesPerDriveHour: Math.max(0, Number(currentPlan.milesPerDriveHour) || 0),
    milesPlanned: Math.max(0, Number(currentPlan.milesPlanned) || 0),
    milesConsumed: Math.max(0, Number(currentPlan.milesConsumed) || 0),
    deltasTotal: normalizeTravelSessionDeltaMap(currentPlan.deltasTotal),
    appliedDeltas: normalizeTravelSessionDeltaMap(currentPlan.appliedDeltas),
    v2DeltasTotal: normalizeTravelSessionV2DeltaMap(currentPlan.v2DeltasTotal),
    appliedV2Deltas: normalizeTravelSessionV2DeltaMap(currentPlan.appliedV2Deltas),
    energyTotals: normalizeTravelEnergyMap(currentPlan.energyTotals),
    appliedEnergy: normalizeTravelEnergyMap(currentPlan.appliedEnergy)
  };
}

function normalizeTravelLeg(activeLeg, fallbackStatus = "driving") {
  if (typeof activeLeg !== "object" || activeLeg === null) {
    return null;
  }

  const normalized = { ...activeLeg };
  normalized.id =
    typeof normalized.id === "string" && normalized.id.length > 0 ? normalized.id : "travel_leg";
  normalized.routeSegmentId =
    normalized.routeSegmentId === null || typeof normalized.routeSegmentId === "string"
      ? normalized.routeSegmentId
      : null;
  normalized.origin = String(normalized.origin ?? "").trim();
  normalized.destination = String(normalized.destination ?? "").trim();
  normalized.originPointId =
    normalized.originPointId === null || typeof normalized.originPointId === "string"
      ? normalized.originPointId
      : null;
  normalized.destinationPointId =
    normalized.destinationPointId === null || typeof normalized.destinationPointId === "string"
      ? normalized.destinationPointId
      : null;
  normalized.originMileMarker = Math.max(0, Number(normalized.originMileMarker) || 0);
  normalized.destinationMileMarker = Math.max(
    normalized.originMileMarker,
    Number(normalized.destinationMileMarker) || normalized.originMileMarker
  );
  normalized.totalMiles = Math.max(0, Number(normalized.totalMiles) || 0);
  normalized.completedMiles = clamp(
    normalized.completedMiles,
    0,
    normalized.totalMiles,
    0
  );
  normalized.remainingMiles = clamp(
    normalized.remainingMiles,
    0,
    normalized.totalMiles,
    Math.max(0, normalized.totalMiles - normalized.completedMiles)
  );
  normalized.status =
    typeof normalized.status === "string" && normalized.status.length > 0
      ? normalized.status
      : fallbackStatus;
  normalized.authoredObstacle = normalizeTravelObstacle(normalized.authoredObstacle);
  normalized.approachProps = Array.isArray(normalized.approachProps)
    ? normalized.approachProps
        .map((entry, index) => normalizeTravelApproachProp(entry, normalized.id, index))
        .sort((left, right) => left.spawnProgress - right.spawnProgress)
    : [];

  return normalized;
}

function normalizeTravelObstacle(authoredObstacle) {
  if (typeof authoredObstacle !== "object" || authoredObstacle === null) {
    return null;
  }

  return {
    id:
      typeof authoredObstacle.id === "string" && authoredObstacle.id.length > 0
        ? authoredObstacle.id
        : "travel_obstacle",
    landmarkStopId:
      typeof authoredObstacle.landmarkStopId === "string" && authoredObstacle.landmarkStopId.length > 0
        ? authoredObstacle.landmarkStopId
        : null,
    triggerMiles: Math.max(0, Number(authoredObstacle.triggerMiles) || 0),
    progress: clamp(Number(authoredObstacle.progress) || 0, 0, 1, 0),
    visited: Boolean(authoredObstacle.visited),
    approachVisual:
      authoredObstacle.approachVisual === null || typeof authoredObstacle.approachVisual === "string"
        ? authoredObstacle.approachVisual
        : null
  };
}

function normalizeTravelApproachProp(approachProp, legId, index) {
  if (typeof approachProp !== "object" || approachProp === null) {
    return {
      id: `${legId}|prop|${index}`,
      kind: "roadside_sign",
      spawnProgress: 0,
      endProgress: 1,
      xStart: 820,
      xEnd: 600,
      yBase: 230,
      scaleStart: 0.45,
      scaleEnd: 1.08,
      linkedEventId: null
    };
  }

  const spawnProgress = clamp(approachProp.spawnProgress, 0, 1, 0);
  const endProgress = clamp(approachProp.endProgress, spawnProgress, 1, 1);

  return {
    id:
      typeof approachProp.id === "string" && approachProp.id.length > 0
        ? approachProp.id
        : `${legId}|prop|${index}`,
    kind:
      typeof approachProp.kind === "string" && approachProp.kind.length > 0
        ? approachProp.kind
        : "roadside_sign",
    spawnProgress,
    endProgress,
    xStart: Number(approachProp.xStart) || 820,
    xEnd: Number(approachProp.xEnd) || 600,
    yBase: Number(approachProp.yBase) || 230,
    scaleStart: Math.max(0.1, Number(approachProp.scaleStart) || 0.45),
    scaleEnd: Math.max(0.1, Number(approachProp.scaleEnd) || 1.08),
    linkedEventId:
      typeof approachProp.linkedEventId === "string" && approachProp.linkedEventId.length > 0
        ? approachProp.linkedEventId
        : null
  };
}

function normalizeTravelSessionDeltaMap(value) {
  const source = typeof value === "object" && value !== null ? value : {};

  return {
    dailyBatteryDelta: Number(source.dailyBatteryDelta) || 0,
    dailyFuelDelta: Number(source.dailyFuelDelta) || 0,
    dailyWaterDelta: Number(source.dailyWaterDelta) || 0,
    dailyCashDelta: Number(source.dailyCashDelta) || 0,
    dailyConditionDelta: Number(source.dailyConditionDelta) || 0,
    dailyMoraleDelta: Number(source.dailyMoraleDelta) || 0
  };
}

function normalizeTravelSessionV2DeltaMap(value) {
  const source = typeof value === "object" && value !== null ? value : {};

  return {
    wasteDelta: Number(source.wasteDelta) || 0,
    hiddenMoraleDelta: Number(source.hiddenMoraleDelta) || 0,
    tripScoreDelta: Number(source.tripScoreDelta) || 0
  };
}

function normalizeTravelEnergyMap(value) {
  const source = typeof value === "object" && value !== null ? value : {};

  return {
    solarGain: Number(source.solarGain) || 0,
    loadUse: Number(source.loadUse) || 0,
    travelImpact: Number(source.travelImpact) || 0,
    hookupSupport: Number(source.hookupSupport) || 0,
    hookupCashDelta: Number(source.hookupCashDelta) || 0,
    netBatteryDelta: Number(source.netBatteryDelta) || 0
  };
}

function normalizeEnergyBreakdown(value, fallback) {
  const normalized = typeof value === "object" && value !== null ? { ...value } : { ...fallback };

  normalized.context = normalized.context || fallback.context;
  normalized.sunlightFactor = Number(normalized.sunlightFactor) || 0;
  normalized.solarGain = Number(normalized.solarGain) || 0;
  normalized.loadUse = Number(normalized.loadUse) || 0;
  normalized.travelImpact = Number(normalized.travelImpact) || 0;
  normalized.hookupSupport = Number(normalized.hookupSupport) || 0;
  normalized.eventAdjustment = Number(normalized.eventAdjustment) || 0;
  normalized.hookupCashDelta = Number(normalized.hookupCashDelta) || 0;
  normalized.netBatteryDelta = Number(normalized.netBatteryDelta) || 0;
  normalized.chargingBand = normalized.chargingBand || fallback.chargingBand;
  normalized.loadBand = normalized.loadBand || fallback.loadBand;
  normalized.notes = Array.isArray(normalized.notes) ? normalized.notes : [];

  return normalized;
}

function createRunId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `run_${timestamp}_${random}`;
}

function buildV2StartingResources(startingCondition) {
  const sourceResources =
    typeof startingCondition?.resources === "object" && startingCondition.resources !== null
      ? startingCondition.resources
      : {};

  return {
    ...DEFAULT_STARTING_VALUES,
    batteryCharge:
      Number(sourceResources.batteryCharge) > 0
        ? Number(sourceResources.batteryCharge)
        : DEFAULT_STARTING_VALUES.batteryCharge,
    water:
      Number(sourceResources.water) > 0
        ? Number(sourceResources.water)
        : DEFAULT_STARTING_VALUES.water
  };
}
