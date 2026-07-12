import {
  DAY_PHASES,
  RV_FULL_TANK_RANGE_MILES,
  TRAVEL_MODES
} from "../constants/gameConstants.js";
import {
  getAuthoredTravelObstacleForSegment,
  getDrivingStyleOption,
  getInteractiveRouteStopForRoutePoint,
  getLandmarkStopDefinition
} from "../state/gameContent.js";
import { getV2JourneyNode } from "../state/v2JourneyGraph.js";
import {
  cloneGameState,
  finalizeGameState,
  getRouteProgressSummary
} from "../state/gameState.js";
import {
  buildReachedRouteNotes,
  getCurrentRoutePoint,
  getNextWaypoint,
  syncJourneyRouteProgress
} from "./routeProgress.js";
import {
  buildTravelOutcomeSummary,
  buildTravelPlanSegment,
  calculateTravelProfile
} from "./travelResolution.js";
import { trackStructuredOutcome, updateResourcePressure } from "./coreSystems.js";

const DAY_CLOCK_START_MINUTES = 7 * 60;
const NIGHT_PUSH_CLOCK_START_MINUTES = 19 * 60;
const NIGHT_PUSH_HOURS = 2.5;
const DEFAULT_ROAD_SPEED_MILES_PER_SECOND = 18;
const TINY_APPROACH_MAX_MILES = 8;
const SHORT_APPROACH_MAX_MILES = 25;
const TINY_APPROACH_DURATION_MS = 450;
const SHORT_APPROACH_MIN_DURATION_MS = 900;
const SHORT_APPROACH_MAX_DURATION_MS = 2200;
const TRAVEL_DEBUG_ENABLED = true;
const INTERRUPTION_TRIGGER_MIN_PROGRESS = 0.1;
const INTERRUPTION_TRIGGER_MAX_PROGRESS = 0.9;
const MIN_TRIGGER_GAP_MILES = 12;
const FLOAT_TOLERANCE = 0.01;
const MAX_FULL_TRAVEL_EVENTS_PER_DAY = 2;
const INTERRUPTION_FULL_EVENT_WEIGHT = 0.6;
const INTERRUPTION_FLAVOR_BEAT_WEIGHT = 0.22;
const MIDDAY_STOP_WINDOW_START_MINUTES = 10 * 60;
const MIDDAY_STOP_WINDOW_END_MINUTES = 16 * 60;
const SESSION_PHASES = Object.freeze({
  DRIVING: "driving",
  PAUSED_FOR_EVENT: "paused_for_event",
  ARRIVED: "arrived",
  DAY_COMPLETE: "day_complete"
});
const INTERRUPTION_OUTCOME_KINDS = Object.freeze({
  EVENT: "event",
  FLAVOR: "flavor",
  NOTHING: "nothing"
});
const FLAVOR_BEAT_LIBRARY = Object.freeze({
  wash_crossing: Object.freeze([
    {
      title: "Wash At The Shoulder",
      body:
        "A pale wash cuts across the shoulder and flashes past the passenger-side windows before it falls away again.",
      summaryNote: "A pale wash crossed close to the shoulder before the road steadied again.",
      tone: "uneasy"
    },
    {
      title: "Dry Runoff Channel",
      body:
        "A dry runoff channel drifts up beside the lane, close enough to notice, then slides back into the desert as you hold the line.",
      summaryNote: "A dry runoff channel slid up beside the lane and then fell away.",
      tone: "neutral"
    }
  ]),
  creek_crossing: Object.freeze([
    {
      title: "Water Near The Road",
      body:
        "A narrow creek edge glints beside the road for a moment. It is close enough to watch, but not enough to change your line.",
      summaryNote: "A narrow creek edge ran close to the road for a moment.",
      tone: "neutral"
    }
  ]),
  camp_pullout: Object.freeze([
    {
      title: "Old Pullout",
      body:
        "An old pullout and its weathered sign come up fast on the shoulder, then disappear behind you before anyone says much.",
      summaryNote: "An old pullout slipped by on the shoulder.",
      tone: "neutral"
    }
  ]),
  town_silhouette: Object.freeze([
    {
      title: "Outbuildings Ahead",
      body:
        "A low cluster of outbuildings and poles shows up ahead, enough to suggest company on the road without interrupting the drive.",
      summaryNote: "A few outbuildings appeared ahead and then settled into the distance.",
      tone: "lift"
    }
  ]),
  roadside_sign: Object.freeze([
    {
      title: "Sign At The Edge",
      body:
        "A roadside sign rises out of the shoulder and is gone again almost immediately, more marker than warning.",
      summaryNote: "A roadside sign flashed by at the edge of the shoulder.",
      tone: "neutral"
    }
  ]),
  default: Object.freeze([
    {
      title: "Something At The Shoulder",
      body:
        "Something on the roadside pulls the eye for a second, but it passes without asking anything from you.",
      summaryNote: "Something along the roadside caught the eye and passed without trouble.",
      tone: "neutral"
    },
    {
      title: "Brief Roadside Stir",
      body:
        "The road hints at a problem, then thinks better of it. A brief stir at the shoulder fades as the miles keep moving.",
      summaryNote: "A brief roadside stir passed without becoming a problem.",
      tone: "uneasy"
    }
  ])
});
const NIGHT_PUSH_FLAVOR_BEATS = Object.freeze([
  {
    title: "Headlights And White Lines",
    body:
      "The town lights fall behind, and the road narrows into headlight range. Everyone gets quieter because there is less room for mistakes now.",
    summaryNote: "The after-dark push made the road feel narrower and the cabin quieter.",
    tone: "uneasy"
  },
  {
    title: "Too Late For A Good Stop",
    body:
      "A few possible pullouts appear and vanish before anyone can read them clearly. Each missed option makes the next one feel less optional.",
    summaryNote: "After dark, even simple pullouts were harder to judge.",
    tone: "uneasy"
  }
]);

const MIDDAY_UTILITY_STOP_TYPES = Object.freeze({
  quick_stop: {
    title: "Roadside Convenience Stop",
    body:
      "A small convenience stop comes up beside the highway. It is not a real reset, but it could take the edge off the day.",
    stopLabel: "Stop Briefly",
    skipLabel: "Keep Driving",
    stopResult: "You take a short break, top off a little water, and let everyone stretch before the road pulls you back in.",
    skipResult: "You pass the stop and keep the day moving.",
    tone: "neutral",
    timeMinutes: 18,
    effects: {
      water: 8,
      hiddenMorale: 2,
      pressure: -3
    },
    skipEffects: {
      pressure: 2
    }
  },
  rest_area: {
    title: "Rest Area Sign",
    body:
      "A rest area appears ahead, close enough for a quick pause without turning the day into a detour.",
    stopLabel: "Take A Break",
    skipLabel: "Keep Driving",
    stopResult: "You stop long enough for fresh air, a bathroom break, and a quieter cabin.",
    skipResult: "You keep rolling and leave the break behind.",
    tone: "lift",
    timeMinutes: 16,
    effects: {
      hiddenMorale: 3,
      pressure: -6
    },
    skipEffects: {
      pressure: 2,
      hiddenMorale: -1
    }
  },
  dump_station: {
    title: "Dump Station Ahead",
    body:
      "A public dump station shows up on a roadside sign. It is practical, not pleasant, and it will cost a little daylight.",
    stopLabel: "Use The Dump Station",
    skipLabel: "Keep Driving",
    stopResult: "You take care of enough waste to make the evening easier, even if nobody loves the stop.",
    skipResult: "You decide the tanks can wait and keep moving.",
    tone: "uneasy",
    timeMinutes: 28,
    effects: {
      waste: -28,
      hiddenMorale: -1,
      pressure: -4
    },
    skipEffects: {
      pressure: 5,
      hiddenMorale: -1,
      waste: 4
    }
  },
  water_fill: {
    title: "Water Spigot",
    body:
      "There is a simple water fill near a small pull-in. It will not top everything off, but it could give the tanks breathing room.",
    stopLabel: "Fill Some Water",
    skipLabel: "Keep Driving",
    stopResult: "You add what you can and get back on the road with a little more margin.",
    skipResult: "You leave the spigot behind and trust the water you have.",
    tone: "neutral",
    timeMinutes: 24,
    effects: {
      water: 18,
      pressure: -3
    },
    skipEffects: {
      pressure: 4,
      hiddenMorale: -1
    }
  },
  scenic_pullout: {
    title: "Picnic Pullout",
    body:
      "A small scenic pullout opens beside the road. It offers a view and a few minutes to breathe, but no real service.",
    stopLabel: "Pull Over",
    skipLabel: "Keep Driving",
    stopResult: "You give the day a short pause and let the view do a little work on the mood.",
    skipResult: "You keep the wheels moving and let the view slide past.",
    tone: "lift",
    timeMinutes: 20,
    effects: {
      hiddenMorale: 4,
      pressure: -4
    },
    skipEffects: {
      pressure: 1
    }
  }
});

const DAY_DELTA_RESOURCE_KEYS = Object.freeze({
  dailyBatteryDelta: "batteryCharge",
  dailyFuelDelta: "fuel",
  dailyWaterDelta: "water",
  dailyCashDelta: "cash",
  dailyConditionDelta: "rvCondition",
  dailyMoraleDelta: "passengerMorale"
});

const ENERGY_SCALAR_KEYS = Object.freeze([
  "solarGain",
  "loadUse",
  "travelImpact",
  "hookupSupport",
  "hookupCashDelta",
  "netBatteryDelta"
]);
const MIN_APPROACH_PROP_LEG_MILES = 30;
const APPROACH_PROP_LIBRARY = Object.freeze({
  campfire: Object.freeze({
    kind: "campfire",
    xStart: 930,
    xEnd: 452,
    yBase: 244,
    scaleStart: 0.44,
    scaleEnd: 1.02
  }),
  roadside_sign: Object.freeze({
    kind: "roadside_sign",
    xStart: 942,
    xEnd: 480,
    yBase: 240,
    scaleStart: 0.38,
    scaleEnd: 1.08
  }),
  small_cabin: Object.freeze({
    kind: "small_cabin",
    xStart: 934,
    xEnd: 486,
    yBase: 238,
    scaleStart: 0.4,
    scaleEnd: 1.16
  }),
  ranger_station: Object.freeze({
    kind: "ranger_station",
    xStart: 944,
    xEnd: 500,
    yBase: 236,
    scaleStart: 0.38,
    scaleEnd: 1.12
  }),
  gas_station: Object.freeze({
    kind: "gas_station",
    xStart: 950,
    xEnd: 514,
    yBase: 238,
    scaleStart: 0.36,
    scaleEnd: 1.1
  }),
  radio_tower: Object.freeze({
    kind: "radio_tower",
    xStart: 952,
    xEnd: 528,
    yBase: 228,
    scaleStart: 0.38,
    scaleEnd: 1.06
  }),
  windmill: Object.freeze({
    kind: "windmill",
    xStart: 834,
    xEnd: 616,
    yBase: 220,
    scaleStart: 0.4,
    scaleEnd: 1.04
  }),
  scenic_landmark: Object.freeze({
    kind: "scenic_landmark",
    xStart: 826,
    xEnd: 576,
    yBase: 222,
    scaleStart: 0.44,
    scaleEnd: 1.18
  }),
  wash_crossing: Object.freeze({
    kind: "wash_crossing",
    xStart: 1068,
    xEnd: 520,
    yBase: 248,
    scaleStart: 0.92,
    scaleEnd: 0.92
  }),
  creek_crossing: Object.freeze({
    kind: "creek_crossing",
    xStart: 820,
    xEnd: 580,
    yBase: 226,
    scaleStart: 0.44,
    scaleEnd: 1.14
  }),
  camp_pullout: Object.freeze({
    kind: "camp_pullout",
    xStart: 934,
    xEnd: 474,
    yBase: 242,
    scaleStart: 0.42,
    scaleEnd: 1.14
  }),
  pass_cut: Object.freeze({
    kind: "pass_cut",
    xStart: 832,
    xEnd: 600,
    yBase: 220,
    scaleStart: 0.42,
    scaleEnd: 1.12
  }),
  shelf_overlook: Object.freeze({
    kind: "shelf_overlook",
    xStart: 834,
    xEnd: 590,
    yBase: 220,
    scaleStart: 0.42,
    scaleEnd: 1.16
  }),
  town_silhouette: Object.freeze({
    kind: "town_silhouette",
    xStart: 960,
    xEnd: 500,
    yBase: 234,
    scaleStart: 0.84,
    scaleEnd: 0.84
  })
});

export function startTravelSession(runState, options = {}) {
  const nextState = cloneGameState(runState);
  const travelPeriod = options.travelPeriod === "night_push" ? "night_push" : "day";
  const profile = calculateTravelProfile(nextState);
  const drivingStyle = getDrivingStyleOption(
    nextState.policies.drivingStyle ?? nextState.policies.travelMode
  );
  const targetDestination = normalizeTravelTarget(nextState, options.targetDestination);
  const routeSummary = getRouteProgressSummary(nextState);
  const currentPlan = buildTravelPlanForPeriod(profile, travelPeriod);
  const driveHoursTotal = currentPlan.driveHoursAllocated;
  const interruptionCount = resolveInterruptionCount(options, drivingStyle);
  const interruptionTriggers = resolveInterruptionTriggers(
    options,
    currentPlan.milesPlanned,
    interruptionCount
  ).map((trigger) => trigger + nextState.day.dailyMilesDriven);
  const activeLeg = buildTravelLegState(nextState, { ...options, targetDestination });
  const previousTravelSession = getTravelSession(nextState);
  const dayClockStartMinutes = resolveTravelSessionClockStart(
    previousTravelSession,
    travelPeriod,
    options
  );

  nextState.currentPhase = DAY_PHASES.TRAVEL_RESOLUTION;
  if (nextState.v2?.journey) {
    nextState.v2.journey.travelState = "travelling";
    nextState.v2.journey.arrivalState = "not_arrived";
  }
  nextState.day.travelSession = {
    currentDayPlannedMiles: nextState.day.dailyMilesDriven + currentPlan.milesPlanned,
    dayTravelStartMiles: nextState.day.dailyMilesDriven,
    milesDrivenSoFarToday: nextState.day.dailyMilesDriven,
    milesRemainingToday: currentPlan.milesPlanned,
    milesToNextStop: targetDestination?.distanceMiles ?? routeSummary.nextWaypointMilesAway,
    interruptionCountForToday: interruptionCount,
    interruptionTriggers,
    interruptionsResolved: 0,
    nextInterruptionIndex: 0,
    travelPausedReason: null,
    currentTravelPhase: SESSION_PHASES.DRIVING,
    roadSpeedMilesPerSecond: sanitizeRoadSpeed(options.roadSpeedMilesPerSecond),
    driveHoursTotal,
    driveHoursElapsed: 0,
    driveHoursRemaining: driveHoursTotal,
    dayClockStartMinutes,
    dayClockEndMinutes: dayClockStartMinutes + Math.round(driveHoursTotal * 60),
    travelPeriod,
    currentPlan,
    // The interlude reads from this persistent leg snapshot so remounts resume
    // the same route-leg progress and prop assignments instead of replaying from zero.
    activeLeg,
    targetDestination,
    fullTravelEventsToday: 0,
    travelFlavorBeat: null,
    travelFuelStop: null,
    summaryFinalized: false,
    debugLog: [],
    debugForcedEventIds: Array.isArray(options.debugForcedEventIds)
      ? options.debugForcedEventIds.filter(Boolean)
      : []
  };
  nextState.day.travelSession.activeLeg.fuelStop = buildTravelUtilityStopState(
    nextState,
    nextState.day.travelSession.activeLeg,
    currentPlan,
    drivingStyle,
    travelPeriod
  );

  updateTravelEnergyDescriptors(nextState, profile.energyBreakdown);
  if (travelPeriod === "night_push") {
    nextState.day.summaryNotes = dedupeStrings([
      ...(nextState.day.summaryNotes ?? []),
      "You leave town after dark instead of choosing a proper stay."
    ]);
  }
  logTravel(nextState, "rolled interruption count", {
    drivingStyle: drivingStyle.label,
    travelPeriod,
    interruptionCount,
    triggerMiles: interruptionTriggers
  });

  return finalizeGameState(nextState);
}

export function advanceTravelSession(runState) {
  const nextState = cloneGameState(runState);
  advanceTravelSessionState(nextState);
  return finalizeGameState(nextState);
}

export function resumeTravelSession(runState) {
  const nextState = cloneGameState(runState);
  resumeTravelSessionState(nextState);
  return finalizeGameState(nextState);
}

export function finalizeTravelSession(runState) {
  const nextState = cloneGameState(runState);
  finalizeTravelSessionState(nextState);
  return finalizeGameState(nextState);
}

export function syncTravelSessionAfterEventState(runState) {
  syncTravelSessionAfterPauseState(runState, { countAsInterruption: true });
}

export function syncTravelSessionAfterRouteStopState(runState) {
  syncTravelSessionAfterPauseState(runState, { countAsInterruption: false });
}

function syncTravelSessionAfterPauseState(runState, options = {}) {
  const session = getTravelSession(runState);

  if (!session) {
    return;
  }

  if (options.countAsInterruption === true) {
    session.interruptionsResolved = Math.min(
      session.interruptionCountForToday,
      session.interruptionsResolved + 1
    );
  }
  session.milesDrivenSoFarToday = runState.day.dailyMilesDriven;
  if (isCustomDestinationSession(session)) {
    session.milesToNextStop = Math.max(
      0,
      Number(session.activeLeg?.totalMiles ?? 0) - Number(session.activeLeg?.completedMiles ?? 0)
    );
  } else {
    session.milesToNextStop = getRouteProgressSummary(runState).nextWaypointMilesAway;
  }

  const profile = calculateTravelProfile(runState);
  const travelPeriod = session.travelPeriod === "night_push" ? "night_push" : "day";
  const plannedDriveHours = getDriveHoursForPeriod(profile, travelPeriod);
  session.driveHoursTotal = Math.max(session.driveHoursElapsed, plannedDriveHours);
  session.driveHoursRemaining = Math.max(0, session.driveHoursTotal - session.driveHoursElapsed);
  session.dayClockStartMinutes = Math.max(
    0,
    Number(session.dayClockStartMinutes) || getDefaultClockStartForPeriod(travelPeriod)
  );
  session.dayClockEndMinutes = session.dayClockStartMinutes + Math.round(session.driveHoursTotal * 60);
  syncActiveTravelLegProgress(runState, session);
  setTravelLegStatus(session, SESSION_PHASES.PAUSED_FOR_EVENT);

  if (hasReachedArrival(runState, session)) {
    markTravelArrival(runState, "event resolution");
    return;
  }

  if (session.driveHoursRemaining <= FLOAT_TOLERANCE) {
    markTravelDayComplete(runState, "event resolution");
    return;
  }

  session.currentPlan = buildTravelPlanForPeriod(profile, travelPeriod, session.driveHoursRemaining);
  session.milesRemainingToday = Math.max(0, session.currentPlan.milesPlanned);
  session.currentDayPlannedMiles = session.milesDrivenSoFarToday + session.milesRemainingToday;
  session.currentTravelPhase = SESSION_PHASES.PAUSED_FOR_EVENT;
  session.travelPausedReason = "event";
  trimSpentTriggers(session);
  updateTravelEnergyDescriptors(runState, profile.energyBreakdown);

  if (session.milesRemainingToday <= FLOAT_TOLERANCE) {
    markTravelDayComplete(runState, "post-event plan");
    return;
  }

  logTravel(runState, "paused travel session synced", {
    interruptionsResolved: session.interruptionsResolved,
    milesDrivenSoFarToday: session.milesDrivenSoFarToday,
    milesToNextStop: session.milesToNextStop,
    currentDayPlannedMiles: session.currentDayPlannedMiles,
    driveHoursRemaining: session.driveHoursRemaining
  });
}

export function hasTravelSession(runState) {
  return getTravelSession(runState) !== null;
}

export function canResumeTravelSession(runState) {
  const session = getTravelSession(runState);

  return (
    session !== null &&
    session.currentTravelPhase === SESSION_PHASES.PAUSED_FOR_EVENT &&
    (session.travelPausedReason === "event" ||
      session.travelPausedReason === "authored_obstacle" ||
      session.travelPausedReason === "flavor" ||
      session.travelPausedReason === "fuel_stop_result") &&
    session.milesRemainingToday > FLOAT_TOLERANCE &&
    session.milesToNextStop > FLOAT_TOLERANCE
  );
}

export function isTravelSessionComplete(runState) {
  const session = getTravelSession(runState);

  return (
    session !== null &&
    (session.currentTravelPhase === SESSION_PHASES.ARRIVED ||
      session.currentTravelPhase === SESSION_PHASES.DAY_COMPLETE)
  );
}

export function isTravelSessionPausedForEvent(runState) {
  return getTravelSession(runState)?.currentTravelPhase === SESSION_PHASES.PAUSED_FOR_EVENT;
}

export function isTravelSessionAwaitingInterruptionResolution(runState) {
  const session = getTravelSession(runState);
  return (
    session !== null &&
    session.currentTravelPhase === SESSION_PHASES.PAUSED_FOR_EVENT &&
    session.travelPausedReason === "interruption"
  );
}

export function isTravelSessionPausedForAuthoredObstacle(runState) {
  const session = getTravelSession(runState);
  return (
    session !== null &&
    session.currentTravelPhase === SESSION_PHASES.PAUSED_FOR_EVENT &&
    session.travelPausedReason === "authored_obstacle"
  );
}

export function isTravelSessionPausedForUtilityStop(runState) {
  const session = getTravelSession(runState);
  return (
    session !== null &&
    session.currentTravelPhase === SESSION_PHASES.PAUSED_FOR_EVENT &&
    session.travelPausedReason === "fuel_stop"
  );
}

export function hasTravelInterruptionPendingEvent(runState) {
  const session = getTravelSession(runState);
  return (
    session !== null &&
    session.currentTravelPhase === SESSION_PHASES.PAUSED_FOR_EVENT &&
    session.travelPausedReason === "event"
  );
}

export function getTravelFlavorBeat(runState) {
  return getTravelSession(runState)?.travelFlavorBeat ?? null;
}

export function getActiveTravelUtilityStop(runState) {
  return getTravelSession(runState)?.travelFuelStop ?? null;
}

export function getTravelFullEventCount(runState) {
  return Number(getTravelSession(runState)?.fullTravelEventsToday) || 0;
}

export function resolveTravelInterruptionSlot(runState, options = {}) {
  const nextState = cloneGameState(runState);
  const session = getTravelSession(nextState);

  if (!session || session.currentTravelPhase !== SESSION_PHASES.PAUSED_FOR_EVENT) {
    return finalizeGameState(nextState);
  }

  if (session.travelPausedReason !== "interruption") {
    return finalizeGameState(nextState);
  }

  const slotIndex = Math.max(0, session.nextInterruptionIndex - 1);
  const capReached = getTravelFullEventCount(nextState) >= MAX_FULL_TRAVEL_EVENTS_PER_DAY;
  const outcome = selectTravelInterruptionOutcome(nextState, slotIndex, options, capReached);

  session.travelFlavorBeat = null;

  if (outcome === INTERRUPTION_OUTCOME_KINDS.EVENT) {
    session.travelPausedReason = "event";
    return finalizeGameState(nextState);
  }

  if (outcome === INTERRUPTION_OUTCOME_KINDS.FLAVOR) {
    const beat = buildTravelFlavorBeat(nextState, slotIndex);
    session.travelPausedReason = "flavor";
    session.travelFlavorBeat = beat;
    nextState.day.summaryNotes = dedupeStrings([...(nextState.day.summaryNotes ?? []), beat.summaryNote]);
    return finalizeGameState(nextState);
  }

  resumeTravelSessionState(nextState);
  return finalizeGameState(nextState);
}

export function resolveTravelUtilityStop(runState, choice = "skip") {
  const nextState = cloneGameState(runState);
  const session = getTravelSession(nextState);
  const stop = session?.travelFuelStop;

  if (
    !session ||
    session.currentTravelPhase !== SESSION_PHASES.PAUSED_FOR_EVENT ||
    session.travelPausedReason !== "fuel_stop" ||
    !stop
  ) {
    return finalizeGameState(nextState);
  }

  const didStop = choice === "stop";
  applyTravelUtilityStopEffects(nextState, didStop ? stop.effects : stop.skipEffects);
  markTravelFuelStopVisited(session, nextState);
  session.travelPausedReason = "fuel_stop_result";
  session.travelFuelStop = {
    ...stop,
    state: "resolved",
    selectedChoice: didStop ? "stop" : "skip",
    resolvedText: didStop ? stop.stopResult : stop.skipResult
  };

  if (didStop) {
    const stopHours = Math.max(0, Number(stop.timeMinutes) || 0) / 60;
    session.driveHoursElapsed += stopHours;
    session.driveHoursTotal += stopHours;
    session.dayClockEndMinutes += Math.round(stopHours * 60);
  }

  nextState.day.summaryNotes = dedupeStrings([
    ...(nextState.day.summaryNotes ?? []),
    didStop ? stop.stopResult : stop.skipResult
  ]);
  updateResourcePressure(nextState);
  return finalizeGameState(nextState);
}

export function continueAfterTravelUtilityStop(runState) {
  const nextState = cloneGameState(runState);
  const session = getTravelSession(nextState);

  if (!session || session.travelPausedReason !== "fuel_stop_result") {
    return finalizeGameState(nextState);
  }

  session.travelFuelStop = null;
  resumeTravelSessionState(nextState);
  return finalizeGameState(nextState);
}

export function markTravelInterruptionEventQueued(runState) {
  const nextState = cloneGameState(runState);
  const session = getTravelSession(nextState);

  if (!session) {
    return finalizeGameState(nextState);
  }

  session.fullTravelEventsToday = Math.min(
    MAX_FULL_TRAVEL_EVENTS_PER_DAY,
    (Number(session.fullTravelEventsToday) || 0) + 1
  );
  session.travelPausedReason = "event";
  session.travelFlavorBeat = null;

  return finalizeGameState(nextState);
}

export function getTravelChunkPreview(runState) {
  const session = getTravelSession(runState);

  if (!session || session.currentTravelPhase !== SESSION_PHASES.DRIVING) {
    return null;
  }

  const boundary = getNextBoundary(session, getUpcomingInterruptionIndex(session));

  if (!boundary) {
    return null;
  }

  const miles = Math.max(0, boundary.miles);
  const chunkDriveHours =
    session.currentPlan.milesPerDriveHour > 0
      ? miles / session.currentPlan.milesPerDriveHour
      : 0;
  const driveProgressStart =
    session.driveHoursTotal > 0 ? session.driveHoursElapsed / session.driveHoursTotal : 0;
  const driveProgressEnd =
    session.driveHoursTotal > 0
      ? Math.min(1, (session.driveHoursElapsed + chunkDriveHours) / session.driveHoursTotal)
      : 1;
  const isLocalDestination = isCustomDestinationSession(session);
  const baseDurationMs = Math.max(
    0,
    Math.round((miles / Math.max(0.1, session.roadSpeedMilesPerSecond)) * 1000)
  );
  const presentationMode = getTravelChunkPresentationMode(boundary, miles);
  const durationMs = getTravelChunkDurationMs({
    baseDurationMs,
    isLocalDestination,
    presentationMode
  });

  return {
    id: [
      runState.runId,
      runState.dayNumber,
      session.milesDrivenSoFarToday,
      boundary.reason,
      session.nextInterruptionIndex
    ].join("|"),
    reason: boundary.reason,
    presentationMode,
    miles,
    durationMs,
    chunkDriveHours,
    startDistance: session.milesToNextStop,
    endDistance: Math.max(0, session.milesToNextStop - miles),
    startMilesRemaining: runState.journey.milesRemaining,
    endMilesRemaining: Math.max(0, runState.journey.milesRemaining - miles),
    legId: session.activeLeg?.id ?? `${runState.runId}|${runState.dayNumber}|leg`,
    legTotalMiles: session.activeLeg?.totalMiles ?? miles,
    legCompletedMilesStart: session.activeLeg?.completedMiles ?? 0,
    legCompletedMilesEnd: getTravelLegCompletedMilesAfterChunk(session.activeLeg, miles),
    legMilesRemainingStart: session.activeLeg?.remainingMiles ?? session.milesToNextStop,
    legMilesRemainingEnd: getTravelLegRemainingMilesAfterChunk(session.activeLeg, miles),
    legProgressStart: clampProgress(getTravelLegProgress(session.activeLeg)),
    legProgressEnd: clampProgress(getTravelLegProgressAfterChunk(session.activeLeg, miles)),
    approachProps:
      boundary.reason === "arrival"
        ? cloneTravelApproachProps(session.activeLeg?.approachProps)
        : [],
    isLocalDestination,
    dayClockStartMinutes:
      (Number(session.dayClockStartMinutes) || DAY_CLOCK_START_MINUTES) +
      Math.round(session.driveHoursElapsed * 60),
    dayClockEndMinutes:
      (Number(session.dayClockStartMinutes) || DAY_CLOCK_START_MINUTES) +
      Math.round((session.driveHoursElapsed + chunkDriveHours) * 60),
    travelDayProgressStart: clampProgress(driveProgressStart),
    travelDayProgressEnd: clampProgress(driveProgressEnd)
  };
}

function getTravelChunkPresentationMode(boundary, miles) {
  if (boundary?.reason !== "arrival") {
    return "normal";
  }

  if (miles <= TINY_APPROACH_MAX_MILES) {
    return "tiny_approach";
  }

  if (miles <= SHORT_APPROACH_MAX_MILES) {
    return "short_approach";
  }

  return "normal";
}

function getTravelChunkDurationMs({ baseDurationMs, isLocalDestination, presentationMode }) {
  if (presentationMode === "tiny_approach") {
    return TINY_APPROACH_DURATION_MS;
  }

  if (presentationMode === "short_approach") {
    return Math.max(
      SHORT_APPROACH_MIN_DURATION_MS,
      Math.min(SHORT_APPROACH_MAX_DURATION_MS, baseDurationMs)
    );
  }

  return isLocalDestination ? Math.round(baseDurationMs * 3) : baseDurationMs;
}

export function getForcedTravelInterruptionEventId(runState) {
  const session = getTravelSession(runState);

  if (!session) {
    return null;
  }

  return session.debugForcedEventIds[session.interruptionsResolved] ?? null;
}

function advanceTravelSessionState(runState) {
  const session = getTravelSession(runState);

  if (!session || session.currentTravelPhase !== SESSION_PHASES.DRIVING) {
    return;
  }

  trimSpentTriggers(session);

  const boundary = getNextBoundary(session, session.nextInterruptionIndex);

  if (!boundary) {
    if (hasReachedArrival(runState, session)) {
      markTravelArrival(runState, "boundary check");
      return;
    }

    markTravelDayComplete(runState, "boundary check");
    return;
  }

  applyTravelChunk(runState, boundary.miles);

  if (boundary.reason === "interruption") {
    session.nextInterruptionIndex += 1;
    session.currentTravelPhase = SESSION_PHASES.PAUSED_FOR_EVENT;
    session.travelPausedReason = "interruption";
    session.travelFlavorBeat = null;
    setTravelLegStatus(session, SESSION_PHASES.PAUSED_FOR_EVENT);
    logTravel(runState, "interruption fired", {
      milesDrivenSoFarToday: session.milesDrivenSoFarToday,
      milesToNextStop: session.milesToNextStop,
      nextInterruptionIndex: session.nextInterruptionIndex
    });
    return;
  }

  if (boundary.reason === "authored_obstacle") {
    session.currentTravelPhase = SESSION_PHASES.PAUSED_FOR_EVENT;
    session.travelPausedReason = "authored_obstacle";
    session.travelFlavorBeat = null;
    setTravelLegStatus(session, SESSION_PHASES.PAUSED_FOR_EVENT);
    logTravel(runState, "authored obstacle fired", {
      milesDrivenSoFarToday: session.milesDrivenSoFarToday,
      milesToNextStop: session.milesToNextStop,
      landmarkStopId: session.activeLeg?.authoredObstacle?.landmarkStopId ?? null
    });
    return;
  }

  if (boundary.reason === "fuel_stop") {
    session.currentTravelPhase = SESSION_PHASES.PAUSED_FOR_EVENT;
    session.travelPausedReason = "fuel_stop";
    session.travelFlavorBeat = null;
    session.travelFuelStop = buildActiveTravelFuelStopView(session, runState);
    setTravelLegStatus(session, SESSION_PHASES.PAUSED_FOR_EVENT);
    logTravel(runState, "roadside fuel stop reached", {
      milesDrivenSoFarToday: session.milesDrivenSoFarToday,
      milesToNextStop: session.milesToNextStop
    });
    return;
  }

  if (boundary.reason === "arrival" || hasReachedArrival(runState, session)) {
    markTravelArrival(runState, "drive chunk");
    return;
  }

  markTravelDayComplete(runState, "drive chunk");
}

function resumeTravelSessionState(runState) {
  const session = getTravelSession(runState);

  if (!session) {
    return;
  }

  if (session.currentTravelPhase === SESSION_PHASES.ARRIVED) {
    return;
  }

  if (session.currentTravelPhase === SESSION_PHASES.DAY_COMPLETE) {
    return;
  }

  if (session.milesRemainingToday <= FLOAT_TOLERANCE || session.driveHoursRemaining <= FLOAT_TOLERANCE) {
    markTravelDayComplete(runState, "resume check");
    return;
  }

  if (session.milesToNextStop <= FLOAT_TOLERANCE) {
    markTravelArrival(runState, "resume check");
    return;
  }

  session.currentTravelPhase = SESSION_PHASES.DRIVING;
  session.travelPausedReason = null;
  session.travelFlavorBeat = null;
  session.travelFuelStop = null;
  setTravelLegStatus(session, SESSION_PHASES.DRIVING);
  logTravel(runState, "travel resumed", {
    milesDrivenSoFarToday: session.milesDrivenSoFarToday,
    milesToNextStop: session.milesToNextStop,
    milesRemainingToday: session.milesRemainingToday
  });
}

function finalizeTravelSessionState(runState) {
  const session = getTravelSession(runState);

  if (!session || session.summaryFinalized !== false) {
    return;
  }

  if (
    session.currentTravelPhase !== SESSION_PHASES.ARRIVED &&
    session.currentTravelPhase !== SESSION_PHASES.DAY_COMPLETE
  ) {
    return;
  }

  const summary = buildTravelOutcomeSummary(runState);
  const reachedNotes = buildReachedRouteNotes(runState.day.reachedRoutePoints ?? []);

  runState.currentPhase = DAY_PHASES.TRAVEL_RESOLUTION;
  runState.day.summaryHeadline = summary.headline;
  runState.day.summaryNotes = dedupeStrings([
    ...(session.travelPeriod === "night_push"
      ? [
          "You pushed on after dark instead of choosing a town stay.",
          "The night drive leaves no real evening plan, only a forced place to sleep."
        ]
      : []),
    ...summary.notes,
    ...(runState.day.summaryNotes ?? []),
    ...reachedNotes
  ]);
  session.summaryFinalized = true;
}

function applyTravelChunk(runState, milesToAdvance) {
  const session = getTravelSession(runState);
  const currentPlan = session?.currentPlan;

  if (!session || !currentPlan) {
    return;
  }

  const milesAdvanced = Math.max(0, Math.round(Number(milesToAdvance) || 0));

  if (milesAdvanced <= 0) {
    return;
  }

  const previousMiles = runState.journey.milesTraveled;
  const chunkDriveHours =
    currentPlan.milesPerDriveHour > 0 ? milesAdvanced / currentPlan.milesPerDriveHour : 0;
  const driveHoursConsumed = Math.min(
    currentPlan.driveHoursAllocated,
    currentPlan.driveHoursConsumed + chunkDriveHours
  );
  const planProgress =
    currentPlan.driveHoursAllocated > 0
      ? driveHoursConsumed / currentPlan.driveHoursAllocated
      : 1;

  runState.day.dailyMilesDriven += milesAdvanced;
  if (!isCustomDestinationSession(session)) {
    runState.journey.milesTraveled += milesAdvanced;
  }

  currentPlan.driveHoursConsumed = driveHoursConsumed;
  currentPlan.milesConsumed = Math.min(
    currentPlan.milesPlanned,
    (Number(currentPlan.milesConsumed) || 0) + milesAdvanced
  );
  session.driveHoursElapsed += chunkDriveHours;
  session.driveHoursRemaining = Math.max(0, session.driveHoursTotal - session.driveHoursElapsed);
  session.milesDrivenSoFarToday = runState.day.dailyMilesDriven;

  applyScaledTravelDeltas(runState, currentPlan, planProgress);
  if (!isCustomDestinationSession(session)) {
    syncJourneyRouteProgress(runState, { previousMiles });
    session.milesToNextStop = getRouteProgressSummary(runState).nextWaypointMilesAway;
  } else {
    syncActiveTravelLegProgress(runState, session);
    session.milesToNextStop = Math.max(
      0,
      Number(session.activeLeg?.totalMiles ?? 0) - Number(session.activeLeg?.completedMiles ?? 0)
    );
  }
  session.milesRemainingToday = Math.max(0, currentPlan.milesPlanned - currentPlan.milesConsumed);
  session.currentDayPlannedMiles = session.milesDrivenSoFarToday + session.milesRemainingToday;
  if (!isCustomDestinationSession(session)) {
    syncActiveTravelLegProgress(runState, session);
  }

  runState.day.energy.total = buildTotalEnergyBreakdown(runState.day.energy);
}

function applyScaledTravelDeltas(runState, currentPlan, planProgress) {
  for (const [dayKey, resourceKey] of Object.entries(DAY_DELTA_RESOURCE_KEYS)) {
    const targetValue = scaleSignedValue(currentPlan.deltasTotal[dayKey], planProgress);
    const appliedValue = currentPlan.appliedDeltas[dayKey] ?? 0;
    const delta = targetValue - appliedValue;

    if (delta === 0) {
      continue;
    }

    currentPlan.appliedDeltas[dayKey] = targetValue;
    runState.day[dayKey] += delta;
    runState.resources[resourceKey] += delta;
  }

  for (const key of ENERGY_SCALAR_KEYS) {
    const targetValue = scaleSignedValue(currentPlan.energyTotals[key], planProgress);
    const appliedValue = currentPlan.appliedEnergy[key] ?? 0;
    const delta = targetValue - appliedValue;

    if (delta === 0) {
      continue;
    }

    currentPlan.appliedEnergy[key] = targetValue;
    runState.day.energy.travel[key] += delta;
  }

  applyScaledTravelV2Deltas(runState, currentPlan, planProgress);
}

function applyScaledTravelV2Deltas(runState, currentPlan, planProgress) {
  const v2Totals = currentPlan.v2DeltasTotal ?? {};
  const applied = currentPlan.appliedV2Deltas ?? {};
  const wasteDelta = applyScaledV2Delta(v2Totals, applied, "wasteDelta", planProgress);
  const hiddenMoraleDelta = applyScaledV2Delta(v2Totals, applied, "hiddenMoraleDelta", planProgress);
  const tripScoreDelta = applyScaledV2Delta(v2Totals, applied, "tripScoreDelta", planProgress);

  if (wasteDelta === 0 && hiddenMoraleDelta === 0 && tripScoreDelta === 0) {
    return;
  }

  currentPlan.appliedV2Deltas = applied;
  runState.v2.resources.waste.current = Math.max(
    0,
    Math.min(runState.v2.resources.waste.capacity, runState.v2.resources.waste.current + wasteDelta)
  );
  runState.v2.hiddenMorale = Math.max(0, Math.min(100, runState.v2.hiddenMorale + hiddenMoraleDelta));
  runState.resources.passengerMorale = runState.v2.hiddenMorale;
  runState.v2.resources.tripScore = Math.max(0, runState.v2.resources.tripScore + tripScoreDelta);
  runState.day.dailyWasteDelta += wasteDelta;
  runState.day.dailyTripScoreDelta += tripScoreDelta;

  trackStructuredOutcome(
    runState,
    {
      changes: {
        dailyMilesDriven: 0,
        dailyBatteryDelta: 0,
        dailyFuelDelta: 0,
        dailyWaterDelta: 0,
        dailyMoraleDelta: 0,
        dailyConditionDelta: 0,
        dailyCashDelta: 0
      },
      v2Changes: {
        wasteDelta,
        hiddenMoraleDelta,
        tripScoreDelta
      },
      scoreContext: {
        kind: "travel"
      }
    },
    { kind: "travel" }
  );
  updateResourcePressure(runState);
}

function applyScaledV2Delta(v2Totals, applied, key, planProgress) {
  const targetValue = scaleSignedValue(v2Totals[key], planProgress);
  const appliedValue = applied[key] ?? 0;
  const delta = targetValue - appliedValue;
  applied[key] = targetValue;
  return delta;
}

function getNextBoundary(session, nextInterruptionIndex = session.nextInterruptionIndex) {
  if (session.milesToNextStop <= FLOAT_TOLERANCE && shouldStopForArrival(session)) {
    return {
      reason: "arrival",
      miles: 0
    };
  }

  if (session.milesRemainingToday <= FLOAT_TOLERANCE || session.driveHoursRemaining <= FLOAT_TOLERANCE) {
    return {
      reason: "day_complete",
      miles: 0
    };
  }

  const candidates = [
    {
      reason: "day_complete",
      miles: session.milesRemainingToday
    }
  ];

  if (shouldStopForArrival(session)) {
    candidates.push({
      reason: "arrival",
      miles: session.milesToNextStop
    });
  }
  const nextTrigger = session.interruptionTriggers[nextInterruptionIndex];
  const milesUntilTrigger =
    nextTrigger === undefined ? null : nextTrigger - session.milesDrivenSoFarToday;

  if (milesUntilTrigger !== null && milesUntilTrigger > FLOAT_TOLERANCE) {
    candidates.push({
      reason: "interruption",
      miles: milesUntilTrigger
    });
  }

  const milesUntilAuthoredObstacle = getMilesUntilAuthoredObstacle(session);

  if (milesUntilAuthoredObstacle !== null && milesUntilAuthoredObstacle > FLOAT_TOLERANCE) {
    candidates.push({
      reason: "authored_obstacle",
      miles: milesUntilAuthoredObstacle
    });
  }

  const milesUntilFuelStop = getMilesUntilFuelStop(session);

  if (milesUntilFuelStop !== null && milesUntilFuelStop > FLOAT_TOLERANCE) {
    candidates.push({
      reason: "fuel_stop",
      miles: milesUntilFuelStop
    });
  }

  const validCandidates = candidates
    .map((entry) => ({
      ...entry,
      miles: Math.max(0, Math.round(Number(entry.miles) || 0))
    }))
    .filter((entry) => entry.miles >= 0);

  if (validCandidates.length === 0) {
    return null;
  }

  validCandidates.sort((left, right) => left.miles - right.miles);
  return validCandidates[0];
}

function trimSpentTriggers(session) {
  while (
    session.nextInterruptionIndex < session.interruptionTriggers.length &&
    session.interruptionTriggers[session.nextInterruptionIndex] <=
      session.milesDrivenSoFarToday + FLOAT_TOLERANCE
  ) {
    session.nextInterruptionIndex += 1;
  }
}

function getUpcomingInterruptionIndex(session) {
  let nextInterruptionIndex = session.nextInterruptionIndex;

  while (
    nextInterruptionIndex < session.interruptionTriggers.length &&
    session.interruptionTriggers[nextInterruptionIndex] <=
      session.milesDrivenSoFarToday + FLOAT_TOLERANCE
  ) {
    nextInterruptionIndex += 1;
  }

  return nextInterruptionIndex;
}

function markTravelArrival(runState, source) {
  const session = getTravelSession(runState);

  if (!session) {
    return;
  }

  const unusedTriggers = Math.max(
    0,
    session.interruptionCountForToday - session.nextInterruptionIndex
  );

  session.currentTravelPhase = SESSION_PHASES.ARRIVED;
  session.travelPausedReason = null;
  session.milesToNextStop = 0;
  session.milesRemainingToday = 0;
  session.nextInterruptionIndex = session.interruptionCountForToday;
  session.currentDayPlannedMiles = session.milesDrivenSoFarToday;
  completeTravelLeg(session, SESSION_PHASES.ARRIVED);
  if (isCustomDestinationSession(session)) {
    applyCustomDestinationArrival(runState, session);
  } else if (runState.v2?.journey) {
    runState.v2.journey.travelState = "arrived";
    runState.v2.journey.arrivalState = "arriving";
  }

  logTravel(runState, "arrival cut off remaining travel", {
    source,
    milesDrivenSoFarToday: session.milesDrivenSoFarToday,
    unusedTriggersDiscarded: unusedTriggers,
    arrivalOccurredBeforeUnusedTriggers: unusedTriggers > 0
  });
}

function markTravelDayComplete(runState, source) {
  const session = getTravelSession(runState);

  if (!session) {
    return;
  }

  session.currentTravelPhase = SESSION_PHASES.DAY_COMPLETE;
  session.travelPausedReason = null;
  session.milesRemainingToday = 0;
  session.currentDayPlannedMiles = session.milesDrivenSoFarToday;
  session.nextInterruptionIndex = session.interruptionCountForToday;
  syncActiveTravelLegProgress(runState, session);
  setTravelLegStatus(session, SESSION_PHASES.DAY_COMPLETE);
  logTravel(runState, "day drive completed", {
    source,
    milesDrivenSoFarToday: session.milesDrivenSoFarToday,
    milesToNextStop: session.milesToNextStop
  });
}

function resolveInterruptionCount(options, drivingStyle = null) {
  const forcedCount = Number(options.interruptionCount);

  if (Number.isInteger(forcedCount) && forcedCount >= 0 && forcedCount <= 3) {
    return forcedCount;
  }

  const roll = Number.isFinite(Number(options.interruptionRoll))
    ? Number(options.interruptionRoll)
    : Math.random();
  const styleAdjustment = Number(drivingStyle?.travelRule?.interruptionCountAdjustment) || 0;

  if (roll < 0.45) {
    return clampInterruptionCount(0 + styleAdjustment);
  }
  if (roll < 0.8) {
    return clampInterruptionCount(1 + styleAdjustment);
  }
  if (roll < 0.95) {
    return clampInterruptionCount(2 + styleAdjustment);
  }
  return clampInterruptionCount(3 + styleAdjustment);
}

function clampInterruptionCount(value) {
  return Math.max(0, Math.min(3, Math.round(Number(value) || 0)));
}

function resolveInterruptionTriggers(options, plannedMiles, interruptionCount) {
  if (Array.isArray(options.interruptionTriggers) && options.interruptionTriggers.length > 0) {
    return options.interruptionTriggers
      .map((value) => Math.round(Number(value) || 0))
      .filter((value) => value > 0)
      .sort((left, right) => left - right)
      .slice(0, interruptionCount);
  }

  return generateInterruptionTriggers(plannedMiles, interruptionCount);
}

function generateInterruptionTriggers(plannedMiles, interruptionCount) {
  if (interruptionCount <= 0 || plannedMiles <= 0) {
    return [];
  }

  const safeStart = Math.round(plannedMiles * INTERRUPTION_TRIGGER_MIN_PROGRESS);
  const safeEnd = Math.round(plannedMiles * INTERRUPTION_TRIGGER_MAX_PROGRESS);
  const usableSpan = Math.max(1, safeEnd - safeStart);
  const bandWidth = usableSpan / interruptionCount;

  return Array.from({ length: interruptionCount }, (_, index) => {
    const bandStart = safeStart + bandWidth * index;
    const bandEnd = safeStart + bandWidth * (index + 1);
    const jitterStart = bandStart + bandWidth * 0.15;
    const jitterEnd = bandEnd - bandWidth * 0.15;
    const trigger = jitterStart + Math.random() * Math.max(1, jitterEnd - jitterStart);
    const minimumTrigger = index === 0 ? safeStart : safeStart + MIN_TRIGGER_GAP_MILES * index;

    return Math.max(minimumTrigger, Math.round(trigger));
  }).sort((left, right) => left - right);
}

function sanitizeRoadSpeed(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return DEFAULT_ROAD_SPEED_MILES_PER_SECOND;
  }

  return numericValue;
}

function updateTravelEnergyDescriptors(runState, energyBreakdown) {
  runState.day.energy.travel.sunlightFactor = Number(energyBreakdown?.sunlightFactor) || 0;
  runState.day.energy.travel.chargingBand = energyBreakdown?.chargingBand ?? "fair";
  runState.day.energy.travel.loadBand = energyBreakdown?.loadBand ?? "moderate";
  runState.day.energy.travel.notes = Array.isArray(energyBreakdown?.notes)
    ? [...energyBreakdown.notes]
    : [];
}

function buildTravelPlanForPeriod(profile, travelPeriod, driveHoursOverride = null) {
  const driveHours =
    driveHoursOverride === null
      ? getDriveHoursForPeriod(profile, travelPeriod)
      : Math.max(0, Number(driveHoursOverride) || 0);
  const plan = buildTravelPlanSegment(profile, driveHours);

  if (travelPeriod !== "night_push") {
    return plan;
  }

  plan.milesPlanned = Math.max(45, Math.round(plan.milesPlanned * 0.72));
  plan.milesPerDriveHour = driveHours > 0 ? plan.milesPlanned / driveHours : 0;
  plan.deltasTotal.dailyBatteryDelta -= 4;
  plan.deltasTotal.dailyWaterDelta -= 1;
  plan.deltasTotal.dailyConditionDelta -= 2;
  plan.deltasTotal.dailyMoraleDelta -= 4;
  plan.v2DeltasTotal.hiddenMoraleDelta -= 4;
  plan.v2DeltasTotal.tripScoreDelta -= 1;
  plan.v2DeltasTotal.wasteDelta += 1;
  plan.energyTotals.loadUse += 2;
  plan.energyTotals.travelImpact -= 3;
  plan.energyTotals.netBatteryDelta -= 5;

  return plan;
}

function getDriveHoursForPeriod(profile, travelPeriod) {
  if (travelPeriod === "night_push") {
    return Math.min(NIGHT_PUSH_HOURS, Math.max(1.5, (Number(profile?.driveHoursTotal) || 0) * 0.35));
  }

  return Number(profile?.driveHoursTotal) || 0;
}

function resolveTravelSessionClockStart(previousSession, travelPeriod, options = {}) {
  const explicitStart = Number(options.dayClockStartMinutes);

  if (Number.isFinite(explicitStart)) {
    return Math.max(0, explicitStart);
  }

  if (travelPeriod === "night_push") {
    return NIGHT_PUSH_CLOCK_START_MINUTES;
  }

  if (previousSession && previousSession.travelPeriod !== "night_push") {
    return Math.max(
      DAY_CLOCK_START_MINUTES,
      Math.round(
        (Number(previousSession.dayClockStartMinutes) || DAY_CLOCK_START_MINUTES) +
          (Number(previousSession.driveHoursElapsed) || 0) * 60
      )
    );
  }

  return DAY_CLOCK_START_MINUTES;
}

function getDefaultClockStartForPeriod(travelPeriod) {
  return travelPeriod === "night_push" ? NIGHT_PUSH_CLOCK_START_MINUTES : DAY_CLOCK_START_MINUTES;
}

function hasReachedArrival(runState, session) {
  return shouldStopForArrival(session) &&
    (Boolean(runState.day.routeArrivalNotice) || session.milesToNextStop <= FLOAT_TOLERANCE);
}

function shouldStopForArrival(session) {
  if (!session) {
    return false;
  }

  if (isCustomDestinationSession(session)) {
    return true;
  }

  return session.activeLeg?.destinationPointKind === "destination";
}

function buildTravelLegState(runState, options = {}) {
  const targetDestination = normalizeTravelTarget(runState, options.targetDestination);
  if (targetDestination) {
    const totalMiles = Math.max(1, Number(targetDestination.distanceMiles) || 0);
    const id = [
      runState.runId,
      runState.dayNumber,
      `destination_${targetDestination.nodeId}`
    ].join("|");

    return {
      id,
      routeSegmentId: `town_destination_${targetDestination.nodeId}`,
      origin: runState.v2?.currentLocation?.nodeName ?? runState.journey.currentLocationName,
      destination: targetDestination.label,
      originPointId: runState.journey.currentRoutePointId ?? null,
      destinationPointId: targetDestination.nodeId,
      originMileMarker: 0,
      destinationMileMarker: totalMiles,
      totalMiles,
      completedMiles: 0,
      remainingMiles: totalMiles,
      status: SESSION_PHASES.DRIVING,
      progressionMode:
        targetDestination.source === "forward_spine" ? "spine_target" : "local_destination",
      authoredObstacle: null,
      fuelStop: null,
      approachProps: resolveTravelApproachProps(runState, {
        id,
        totalMiles,
        destinationPointId: targetDestination.nodeId,
        destination: targetDestination.label,
        fuelStop: null
      }, options),
      nightDriveFromTown: options.nightDriveFromTown === true,
      targetDestination: {
        ...targetDestination
      }
    };
  }

  const currentPoint = getCurrentRoutePoint(runState.journey);
  const nextWaypoint = getNextWaypoint(runState.journey);
  const originMileMarker = Math.max(0, Number(currentPoint?.mileMarker) || 0);
  const destinationMileMarker = Math.max(
    originMileMarker,
    Number(nextWaypoint?.mileMarker) || originMileMarker
  );
  const totalMiles = Math.max(0, destinationMileMarker - originMileMarker);
  const completedMiles = clampMiles(
    (Number(runState.journey.milesTraveled) || 0) - originMileMarker,
    0,
    totalMiles
  );
  const id = [
    runState.runId,
    runState.dayNumber,
    runState.journey.currentSegmentId ??
      `${currentPoint?.id ?? "origin"}_to_${nextWaypoint?.id ?? "destination"}`
  ].join("|");
  const legState = {
    id,
    routeSegmentId: runState.journey.currentSegmentId ?? null,
    origin: currentPoint?.name ?? runState.journey.currentLocationName,
    destination: nextWaypoint?.name ?? runState.journey.destinationName,
    originPointId: currentPoint?.id ?? null,
    destinationPointId: nextWaypoint?.id ?? null,
    destinationPointKind: nextWaypoint?.kind ?? null,
    originMileMarker,
    destinationMileMarker,
    totalMiles,
    completedMiles,
    remainingMiles: Math.max(0, totalMiles - completedMiles),
    status: SESSION_PHASES.DRIVING,
    progressionMode: "spine_target",
    authoredObstacle: buildAuthoredTravelObstacleState(runState, {
      routeSegmentId: runState.journey.currentSegmentId ?? null,
      totalMiles,
      completedMiles
    }),
    fuelStop: buildTravelFuelStopState({
      legId: id,
      totalMiles
    }),
    approachProps: []
  };

  legState.approachProps = resolveTravelApproachProps(runState, legState, options);
  return legState;
}

function resolveTravelApproachProps(runState, legState, options = {}) {
  const forcedProps = Array.isArray(options.debugApproachProps)
    ? options.debugApproachProps
    : Array.isArray(options.approachProps)
      ? options.approachProps
      : null;

  if (forcedProps) {
    return forcedProps.map((entry, index) => sanitizeTravelApproachProp(entry, legState, index));
  }

  if (legState.totalMiles < MIN_APPROACH_PROP_LEG_MILES || legState.destinationPointId === null) {
    return [];
  }

  const propKey = `${legState.id}|approach`;
  const pool = buildApproachPropPool(runState, legState);
  const kind = pool[Math.floor(deterministicUnit(propKey, "kind") * pool.length)] ?? "roadside_sign";
  const template = APPROACH_PROP_LIBRARY[kind] ?? APPROACH_PROP_LIBRARY.roadside_sign;
  const isTownSilhouette = kind === "town_silhouette";
  const spawnProgress = isTownSilhouette
    ? 0.01
    : clampProgress(0.16 + deterministicUnit(propKey, "spawn") * 0.2);
  const endProgress = isTownSilhouette
    ? 0.985
    : clampProgress(
        Math.min(0.94, spawnProgress + 0.38 + deterministicUnit(propKey, "window") * 0.16)
      );
  const prop = {
    id: `${legState.id}|prop|0`,
    kind,
    spawnProgress,
    endProgress,
    xStart: isTownSilhouette
      ? template.xStart
      : template.xStart + interpolate(-20, 20, deterministicUnit(propKey, "x-start")),
    xEnd: isTownSilhouette
      ? template.xEnd
      : template.xEnd + interpolate(-16, 16, deterministicUnit(propKey, "x-end")),
    yBase: isTownSilhouette
      ? template.yBase
      : template.yBase + interpolate(-6, 6, deterministicUnit(propKey, "y-base")),
    scaleStart: clampScale(
      template.scaleStart + interpolate(-0.04, 0.04, deterministicUnit(propKey, "scale-start"))
    ),
    scaleEnd: clampScale(
      template.scaleEnd + interpolate(-0.06, 0.06, deterministicUnit(propKey, "scale-end"))
    ),
    linkedEventId: null
  };

  return [sanitizeTravelApproachProp(prop, legState, 0)];
}

function buildApproachPropPool(runState, legState) {
  if (legState.fuelStop && legState.fuelStop.visited !== true) {
    return ["gas_station"];
  }

  if (legState.targetDestination) {
    const node = getV2JourneyNode(legState.targetDestination.nodeId);
    const category = node?.category ?? "route_connector";

    if (category === "town_hub") {
      return ["town_silhouette"];
    }
    if (category === "gas_station") {
      return ["gas_station", "roadside_sign"];
    }
    if (category === "rv_park") {
      return ["small_cabin", "campfire", "roadside_sign"];
    }
    if (category === "premium_boondock" || category === "scenic_stop" || category === "destination") {
      return ["scenic_landmark", "roadside_sign", "campfire"];
    }
  }

  const nextWaypoint = getNextWaypoint(runState.journey);
  const interactiveStop = getInteractiveRouteStopForRoutePoint(nextWaypoint);
  const tag = nextWaypoint?.tag ?? "destination";
  const isTownApproach =
    interactiveStop?.stopType === "town" ||
    typeof nextWaypoint?.townId === "string" ||
    nextWaypoint?.approachVisual === "town";
  const interactiveLandmarkPool =
    interactiveStop?.stopType === "landmark"
      ? getApproachPropPoolForVisual(
          interactiveStop.approachVisual ?? nextWaypoint?.approachVisual ?? null
        )
      : [];

  if (isTownApproach) {
    return ["town_silhouette"];
  }

  if (interactiveLandmarkPool.length > 0) {
    return interactiveLandmarkPool;
  }

  if (tag === "camp" || tag === "timber") {
    return ["campfire", "small_cabin", "ranger_station", "roadside_sign"];
  }

  if (tag === "service" || tag === "ferry") {
    return ["roadside_sign", "gas_station", "radio_tower"];
  }

  if (tag === "pass" || tag === "shelf" || tag === "water" || tag === "wash") {
    return ["scenic_landmark", "windmill", "radio_tower", "roadside_sign"];
  }

  if (legState.destination === runState.journey.destinationName) {
    if (runState.metadata.routePresetId === "rain_coast") {
      return ["scenic_landmark", "radio_tower", "roadside_sign"];
    }

    if (runState.metadata.routePresetId === "basin_lakes") {
      return ["scenic_landmark", "small_cabin", "windmill"];
    }
  }

  if (runState.metadata.routePresetId === "rain_coast") {
    return ["roadside_sign", "gas_station", "radio_tower", "scenic_landmark"];
  }

  if (runState.metadata.routePresetId === "basin_lakes") {
    return ["small_cabin", "campfire", "windmill", "scenic_landmark"];
  }

  return ["roadside_sign", "gas_station", "ranger_station", "windmill", "scenic_landmark"];
}

function getApproachPropPoolForVisual(approachVisual) {
  switch (approachVisual) {
    case "wash_crossing":
      return ["wash_crossing"];
    case "creek_crossing":
      return ["creek_crossing"];
    case "camp_pullout":
      return ["camp_pullout"];
    case "pass_cut":
      return ["pass_cut"];
    case "shelf_overlook":
      return ["shelf_overlook"];
    default:
      return [];
  }
}

function buildTravelFuelStopState({ legId, totalMiles }) {
  return null;
}

function buildTravelUtilityStopState(runState, legState, currentPlan, drivingStyle, travelPeriod) {
  if (travelPeriod === "night_push" || !legState || !currentPlan) {
    return null;
  }

  const driveHoursTotal = Number(currentPlan.driveHoursAllocated) || 0;
  const plannedMiles = Number(currentPlan.milesPlanned) || 0;

  if (driveHoursTotal < 4 || plannedMiles < 120) {
    return null;
  }

  const styleId = runState.policies?.drivingStyle ?? runState.policies?.travelMode;
  const styleChance =
    styleId === TRAVEL_MODES.SOLAR_FIRST ? 0.72 :
    styleId === TRAVEL_MODES.PUSH_MILES ? 0.32 :
    0.52;
  const seedKey = `${runState.runId}|${runState.dayNumber}|midday_utility`;
  const firstRoll = deterministicUnit(seedKey, "first");

  if (firstRoll > styleChance) {
    return null;
  }

  const secondRoll = deterministicUnit(seedKey, "second");
  const secondChance =
    styleId === TRAVEL_MODES.SOLAR_FIRST ? 0.34 :
    styleId === TRAVEL_MODES.PUSH_MILES ? 0.08 :
    0.18;
  const stopCount = secondRoll < secondChance ? 2 : 1;
  const opportunities = Array.from({ length: stopCount }, (_, index) => {
    const windowStart = index === 0 ? MIDDAY_STOP_WINDOW_START_MINUTES : 13 * 60;
    const windowEnd = index === 0 ? 12.5 * 60 : MIDDAY_STOP_WINDOW_END_MINUTES;
    const targetClock = windowStart + deterministicUnit(seedKey, "clock", index) * (windowEnd - windowStart);
    const driveHour = Math.max(0.8, (targetClock - DAY_CLOCK_START_MINUTES) / 60);
    const progress = Math.min(0.82, Math.max(0.18, driveHour / driveHoursTotal));
    const triggerMiles = Math.round((Number(runState.day?.dailyMilesDriven) || 0) + plannedMiles * progress);
    const stopType = selectMiddayUtilityStopType(runState, seedKey, index, styleId);
    const definition = MIDDAY_UTILITY_STOP_TYPES[stopType] ?? MIDDAY_UTILITY_STOP_TYPES.rest_area;

    return {
      id: `${legState.id}|midday|${index}|${stopType}`,
      type: stopType,
      triggerMiles,
      visited: false,
      state: "prompt",
      title: definition.title,
      body: definition.body,
      stopLabel: definition.stopLabel,
      skipLabel: definition.skipLabel,
      stopResult: definition.stopResult,
      skipResult: definition.skipResult,
      tone: definition.tone,
      timeMinutes: definition.timeMinutes,
      effects: scaleMiddayUtilityEffects(definition.effects, styleId),
      skipEffects: scaleMiddayUtilityEffects(definition.skipEffects, styleId, { skipped: true })
    };
  }).sort((left, right) => left.triggerMiles - right.triggerMiles);

  return {
    kind: "midday_utility",
    opportunities
  };
}

function buildAuthoredTravelObstacleState(runState, legState) {
  return null;
}

function selectFuelStopFraction(legId, totalMiles) {
  return 0.5;
}

function getMilesUntilFuelStop(session) {
  const nextStop = getNextUnvisitedUtilityStop(session?.activeLeg?.fuelStop);
  if (!nextStop) {
    return null;
  }
  return nextStop.triggerMiles - (Number(session.milesDrivenSoFarToday) || 0);
}

function getMilesUntilAuthoredObstacle(session) {
  const obstacle = session?.activeLeg?.authoredObstacle;

  if (!obstacle || obstacle.visited === true) {
    return null;
  }

  return obstacle.triggerMiles - (session.activeLeg?.completedMiles ?? 0);
}

function buildActiveTravelFuelStopView(session, runState) {
  const stop = getNextUnvisitedUtilityStop(session?.activeLeg?.fuelStop);
  if (!stop) {
    return null;
  }

  return {
    ...stop,
    routeLabel: runState.journey.currentSegmentLabel,
    nextStopName: runState.journey.nextStopName
  };
}

function formatFuelStopFraction(fraction) {
  return "Roadside";
}

function markTravelFuelStopVisited(session, runState) {
  const stopState = session?.activeLeg?.fuelStop;
  if (!stopState) {
    return;
  }

  const activeStopId = session.travelFuelStop?.id;
  const stop = stopState.opportunities?.find((entry) => entry.id === activeStopId) ??
    getNextUnvisitedUtilityStop(stopState);
  if (stop) {
    stop.visited = true;
  }
  session.activeLeg.approachProps = resolveTravelApproachProps(runState, session.activeLeg);
}

function getNextUnvisitedUtilityStop(stopState) {
  if (!Array.isArray(stopState?.opportunities)) {
    return null;
  }
  return stopState.opportunities.find((entry) => entry.visited !== true) ?? null;
}

function selectMiddayUtilityStopType(runState, seedKey, index, styleId) {
  const waterPercent = getResourcePercent(runState.v2?.resources?.water?.current, runState.v2?.resources?.water?.capacity);
  const wastePercent = getResourcePercent(runState.v2?.resources?.waste?.current, runState.v2?.resources?.waste?.capacity);
  const pressure = Number(runState.pressure) || 0;
  const pool = [];
  const add = (type, weight) => {
    for (let cursor = 0; cursor < weight; cursor += 1) {
      pool.push(type);
    }
  };

  add("quick_stop", styleId === TRAVEL_MODES.PUSH_MILES ? 1 : 3);
  add("rest_area", pressure >= 45 ? 4 : 3);
  add("scenic_pullout", styleId === TRAVEL_MODES.SOLAR_FIRST ? 3 : 2);
  add("water_fill", waterPercent < 45 ? 4 : 1);
  add("dump_station", wastePercent > 58 ? 3 : 1);

  if (styleId === TRAVEL_MODES.PUSH_MILES) {
    add("rest_area", 1);
  }

  return pool[Math.floor(deterministicUnit(seedKey, "type", index) * pool.length)] ?? "rest_area";
}

function scaleMiddayUtilityEffects(effects = {}, styleId, options = {}) {
  const scale =
    options.skipped === true
      ? styleId === TRAVEL_MODES.PUSH_MILES ? 1.35 : 1
      : styleId === TRAVEL_MODES.SOLAR_FIRST ? 1.12 : styleId === TRAVEL_MODES.PUSH_MILES ? 0.82 : 1;
  const output = {};

  for (const [key, value] of Object.entries(effects)) {
    output[key] = Math.round((Number(value) || 0) * scale);
  }

  return output;
}

function applyTravelUtilityStopEffects(runState, effects = {}) {
  const waterDelta = Number(effects.water) || 0;
  const wasteDelta = Number(effects.waste) || 0;
  const electricDelta = Number(effects.electric ?? effects.batteryCharge) || 0;
  const moraleDelta = Number(effects.hiddenMorale ?? effects.passengerMorale) || 0;
  const pressureDelta = Number(effects.pressure) || 0;

  if (waterDelta !== 0) {
    const capacity = Math.max(1, Number(runState.v2?.resources?.water?.capacity) || Number(runState.resources.waterCapacity) || 1);
    runState.resources.water = clampNumber((Number(runState.resources.water) || 0) + waterDelta, 0, capacity);
    runState.v2.resources.water.current = clampNumber((Number(runState.v2.resources.water.current) || 0) + waterDelta, 0, capacity);
    runState.day.dailyWaterDelta += waterDelta;
  }

  if (wasteDelta !== 0) {
    const capacity = Math.max(1, Number(runState.v2?.resources?.waste?.capacity) || 1);
    runState.v2.resources.waste.current = clampNumber((Number(runState.v2.resources.waste.current) || 0) + wasteDelta, 0, capacity);
    runState.day.dailyWasteDelta += wasteDelta;
  }

  if (electricDelta !== 0) {
    const capacity = Math.max(1, Number(runState.v2?.resources?.electric?.capacity) || Number(runState.resources.batteryCapacity) || 1);
    runState.resources.batteryCharge = clampNumber((Number(runState.resources.batteryCharge) || 0) + electricDelta, 0, capacity);
    runState.v2.resources.electric.charge = clampNumber((Number(runState.v2.resources.electric.charge) || 0) + electricDelta, 0, capacity);
    runState.day.dailyBatteryDelta += electricDelta;
    runState.day.energy.travel.eventAdjustment += electricDelta;
    runState.day.energy.travel.netBatteryDelta += electricDelta;
    runState.day.energy.total.eventAdjustment += electricDelta;
    runState.day.energy.total.netBatteryDelta += electricDelta;
  }

  if (moraleDelta !== 0) {
    runState.v2.hiddenMorale = clampNumber((Number(runState.v2.hiddenMorale) || 0) + moraleDelta, 0, 100);
    runState.resources.passengerMorale = runState.v2.hiddenMorale;
    runState.day.dailyMoraleDelta += moraleDelta;
  }

  if (pressureDelta !== 0) {
    runState.pressure = clampNumber((Number(runState.pressure) || 0) + pressureDelta, 0, 100);
  }
}

function getResourcePercent(value, capacity) {
  return Math.round((Number(value) || 0) / Math.max(1, Number(capacity) || 1) * 100);
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

export function markTravelAuthoredObstacleVisited(runState) {
  const nextState = cloneGameState(runState);
  const session = getTravelSession(nextState);

  if (!session?.activeLeg?.authoredObstacle) {
    return finalizeGameState(nextState);
  }

  session.activeLeg.authoredObstacle.visited = true;
  return finalizeGameState(nextState);
}

function selectTravelInterruptionOutcome(runState, slotIndex, options = {}, capReached = false) {
  const override = typeof options.outcomeKind === "string" ? options.outcomeKind : null;
  const session = getTravelSession(runState);

  if (session?.travelPeriod === "night_push") {
    return INTERRUPTION_OUTCOME_KINDS.FLAVOR;
  }

  if (override === INTERRUPTION_OUTCOME_KINDS.EVENT && !capReached) {
    return INTERRUPTION_OUTCOME_KINDS.EVENT;
  }
  if (override === INTERRUPTION_OUTCOME_KINDS.FLAVOR) {
    return INTERRUPTION_OUTCOME_KINDS.FLAVOR;
  }
  if (override === INTERRUPTION_OUTCOME_KINDS.NOTHING) {
    return INTERRUPTION_OUTCOME_KINDS.NOTHING;
  }

  const roll = Number.isFinite(Number(options.materializationRoll))
    ? Number(options.materializationRoll)
    : deterministicUnit(`${runState.runId}|${runState.dayNumber}|travel-slot|${slotIndex}`, "materialize");

  if (capReached) {
    return roll < 0.55 ? INTERRUPTION_OUTCOME_KINDS.FLAVOR : INTERRUPTION_OUTCOME_KINDS.NOTHING;
  }

  if (roll < INTERRUPTION_FULL_EVENT_WEIGHT) {
    return INTERRUPTION_OUTCOME_KINDS.EVENT;
  }
  if (roll < INTERRUPTION_FULL_EVENT_WEIGHT + INTERRUPTION_FLAVOR_BEAT_WEIGHT) {
    return INTERRUPTION_OUTCOME_KINDS.FLAVOR;
  }
  return INTERRUPTION_OUTCOME_KINDS.NOTHING;
}

function buildTravelFlavorBeat(runState, slotIndex) {
  const session = getTravelSession(runState);

  if (session?.travelPeriod === "night_push") {
    const beat =
      NIGHT_PUSH_FLAVOR_BEATS[
        Math.floor(
          deterministicUnit(`${runState.runId}|${runState.dayNumber}|night-push|${slotIndex}`, "pick") *
            NIGHT_PUSH_FLAVOR_BEATS.length
        )
      ] ?? NIGHT_PUSH_FLAVOR_BEATS[0];

    return {
      ...beat,
      id: `${runState.runId}|${runState.dayNumber}|night-push|${slotIndex}`,
      routeLabel: runState.journey.currentSegmentLabel,
      nextStopName: runState.journey.nextStopName
    };
  }

  const nextWaypoint = getNextWaypoint(runState.journey);
  const interactiveStop = getInteractiveRouteStopForRoutePoint(nextWaypoint);
  const approachVisual = interactiveStop?.approachVisual ?? nextWaypoint?.approachVisual ?? "default";
  const pool = FLAVOR_BEAT_LIBRARY[approachVisual] ?? FLAVOR_BEAT_LIBRARY.default;
  const poolIndex = Math.floor(
    deterministicUnit(`${runState.runId}|${runState.dayNumber}|travel-beat|${slotIndex}`, "pick") * pool.length
  );
  const beat = pool[poolIndex] ?? FLAVOR_BEAT_LIBRARY.default[0];

  return {
    ...beat,
    id: `${runState.runId}|${runState.dayNumber}|travel-beat|${slotIndex}`,
    routeLabel: runState.journey.currentSegmentLabel,
    nextStopName: runState.journey.nextStopName
  };
}

function sanitizeTravelApproachProp(value, legState, index) {
  const source = typeof value === "object" && value !== null ? value : {};
  const template =
    APPROACH_PROP_LIBRARY[source.kind] ??
    APPROACH_PROP_LIBRARY[source.id] ??
    APPROACH_PROP_LIBRARY.roadside_sign;
  const spawnProgress = clampProgress(source.spawnProgress ?? 0.18);
  const endProgress = clampProgress(
    Math.max(spawnProgress + 0.08, Number(source.endProgress) || 0.62)
  );

  return {
    id:
      typeof source.id === "string" && source.id.length > 0
        ? source.id
        : `${legState.id}|prop|${index}`,
    kind: template.kind,
    spawnProgress,
    endProgress,
    xStart: Number(source.xStart ?? template.xStart) || template.xStart,
    xEnd: Number(source.xEnd ?? template.xEnd) || template.xEnd,
    yBase: Number(source.yBase ?? template.yBase) || template.yBase,
    scaleStart: clampScale(source.scaleStart ?? template.scaleStart),
    scaleEnd: clampScale(source.scaleEnd ?? template.scaleEnd),
    linkedEventId:
      typeof source.linkedEventId === "string" && source.linkedEventId.length > 0
        ? source.linkedEventId
        : null
  };
}

function syncActiveTravelLegProgress(runState, session) {
  const leg = session?.activeLeg;

  if (!leg) {
    return;
  }

  const completedMiles = isCustomDestinationSession(session)
    ? clampMiles(
        Number(session.milesDrivenSoFarToday) - Number(session.dayTravelStartMiles ?? 0),
        0,
        leg.totalMiles
      )
    : clampMiles(
        (Number(runState.journey.milesTraveled) || 0) - leg.originMileMarker,
        0,
        leg.totalMiles
      );

  leg.completedMiles = completedMiles;
  leg.remainingMiles = Math.max(0, leg.totalMiles - completedMiles);
}

function isCustomDestinationSession(session) {
  return session?.activeLeg?.progressionMode === "local_destination";
}

function normalizeTravelTarget(runState, targetDestination) {
  if (!targetDestination || typeof targetDestination !== "object") {
    return null;
  }

  const node = getV2JourneyNode(targetDestination.nodeId);

  if (!node) {
    return null;
  }

  return {
    id: typeof targetDestination.id === "string" ? targetDestination.id : `destination_${node.id}`,
    nodeId: node.id,
    label: targetDestination.label ?? node.name,
    subtitle: targetDestination.subtitle ?? node.description,
    distanceMiles: Math.max(1, Number(targetDestination.distanceMiles) || 0),
    locationType: targetDestination.locationType ?? node.locationType,
    siteType: targetDestination.siteType ?? node.siteType,
    source: targetDestination.source ?? "local_branch"
  };
}

function applyCustomDestinationArrival(runState, session) {
  const target = session?.targetDestination ?? session?.activeLeg?.targetDestination ?? null;
  const node = getV2JourneyNode(target?.nodeId);

  if (!target || !node) {
    return;
  }

  runState.day.routeArrivalNotice = {
    id: node.id,
    title: node.name,
    body: node.arrivalText,
    kind: "site_destination",
    tag: node.category,
    routeStopType: null,
    routeStopId: null,
    routeStopTitle: node.name,
    routeStopSubtitle: node.description,
    isTownStop: false,
    isInteractiveStop: false,
    isDestinationChoice: true,
    locationType: node.locationType,
    siteType: node.siteType
  };
  runState.journey.currentLocationName = node.name;
  if (runState.v2?.journey) {
    runState.v2.journey.travelState = "arrived";
    runState.v2.journey.arrivalState = "arrived";
  }
}

function completeTravelLeg(session, status) {
  const leg = session?.activeLeg;

  if (!leg) {
    return;
  }

  leg.completedMiles = leg.totalMiles;
  leg.remainingMiles = 0;
  leg.status = status;
}

function setTravelLegStatus(session, status) {
  if (session?.activeLeg) {
    session.activeLeg.status = status;
  }
}

function getTravelLegProgress(leg) {
  if (!leg || leg.totalMiles <= FLOAT_TOLERANCE) {
    return 1;
  }

  return clampMiles(leg.completedMiles, 0, leg.totalMiles) / leg.totalMiles;
}

function getTravelLegProgressAfterChunk(leg, miles) {
  if (!leg || leg.totalMiles <= FLOAT_TOLERANCE) {
    return 1;
  }

  return getTravelLegCompletedMilesAfterChunk(leg, miles) / leg.totalMiles;
}

function getTravelLegCompletedMilesAfterChunk(leg, miles) {
  if (!leg) {
    return Math.max(0, Number(miles) || 0);
  }

  return clampMiles(
    clampMiles(leg.completedMiles, 0, leg.totalMiles) + Math.max(0, Number(miles) || 0),
    0,
    leg.totalMiles
  );
}

function getTravelLegRemainingMilesAfterChunk(leg, miles) {
  if (!leg) {
    return 0;
  }

  return Math.max(0, leg.totalMiles - getTravelLegCompletedMilesAfterChunk(leg, miles));
}

function cloneTravelApproachProps(approachProps) {
  return Array.isArray(approachProps) ? approachProps.map((entry) => ({ ...entry })) : [];
}

function convertFuelUnitsToGallons(fuelUnits, fuelCapacity) {
  return 0;
}

function convertGallonsToFuelUnits(gallons, fuelCapacity) {
  return 0;
}

function getTravelSession(runState) {
  return typeof runState?.day?.travelSession === "object" && runState.day.travelSession !== null
    ? runState.day.travelSession
    : null;
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

function scaleSignedValue(value, progress) {
  return Math.round((Number(value) || 0) * (Number(progress) || 0));
}

function deterministicUnit(key, salt = "") {
  const text = `${key}|${salt}`;
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return ((hash >>> 0) % 1000) / 1000;
}

function interpolate(min, max, progress) {
  return min + (max - min) * clampProgress(progress);
}

function clampMiles(value, min, max) {
  const numericValue = Number(value) || 0;
  return Math.max(min, Math.min(max, numericValue));
}

function clampScale(value) {
  return Math.max(0.1, Number(value) || 0.1);
}

function clampProgress(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function dedupeStrings(values) {
  const seen = new Set();
  const output = [];

  for (const value of values) {
    const text = String(value ?? "").trim();

    if (!text || seen.has(text)) {
      continue;
    }

    seen.add(text);
    output.push(text);
  }

  return output;
}

function logTravel(runState, message, details = {}) {
  const session = getTravelSession(runState);
  const payload = {
    day: runState.dayNumber,
    message,
    ...details
  };
  const serialized = `[travel] ${message} ${JSON.stringify(payload)}`;

  if (session) {
    session.debugLog.push(serialized);
  }

  if (TRAVEL_DEBUG_ENABLED) {
    console.debug(serialized);
  }
}
