import { DAY_PHASES } from "../../constants/gameConstants.js";
import {
  applyEventMoraleImpact,
  normalizePassengerPressureState
} from "../passengerPressure.js";
import { setSelectedCampsiteTypeOnState } from "../overnightContext.js";
import { trackStructuredOutcome, updateResourcePressure } from "../coreSystems.js";
import { syncJourneyRouteProgress } from "../routeProgress.js";

const RESOURCE_TO_DAY_DELTA = Object.freeze({
  batteryCharge: "dailyBatteryDelta",
  electric: "dailyBatteryDelta",
  water: "dailyWaterDelta",
  passengerMorale: "dailyMoraleDelta",
  hiddenMorale: "dailyMoraleDelta",
  waste: "dailyWasteDelta",
  tripScore: "dailyTripScoreDelta"
});

const OBSOLETE_RESOURCE_KEYS = new Set(["fuel", "cash", "rvCondition"]);

export function applyEventEffects(runState, effects = {}, phase) {
  const before = snapshotEventScoreState(runState);

  if (effects.resources) {
    applyResourceEffects(runState, effects.resources, phase);
  }

  if (effects.journey) {
    applyJourneyEffects(runState, effects.journey);
  }

  if (effects.passengerPressure) {
    applyPassengerPressureEffects(runState, effects.passengerPressure);
  }

  if (effects.policies) {
    const policyEffects = { ...effects.policies };

    if (Object.hasOwn(policyEffects, "selectedCampsiteType")) {
      setSelectedCampsiteTypeOnState(runState, policyEffects.selectedCampsiteType ?? null);
      delete policyEffects.selectedCampsiteType;
    }

    if (Object.hasOwn(policyEffects, "travelMode") && !Object.hasOwn(policyEffects, "drivingStyle")) {
      policyEffects.drivingStyle = policyEffects.travelMode;
    }

    if (Object.hasOwn(policyEffects, "drivingStyle") && !Object.hasOwn(policyEffects, "travelMode")) {
      policyEffects.travelMode = policyEffects.drivingStyle;
    }

    Object.assign(runState.policies, policyEffects);
  }

  trackStructuredOutcome(runState, buildEventOutcomeDelta(runState, before), { kind: "event" });
  updateResourcePressure(runState);
}

export function recordResolvedEvent(runState, activeEvent) {
  const record = {
    id: activeEvent.id,
    title: activeEvent.title,
    category: activeEvent.category,
    phase: activeEvent.phase,
    dayNumber: runState.dayNumber,
    resultText: activeEvent.resolvedText
  };

  runState.day.eventLog.push(record);
  runState.events.recentEvents = [record, ...runState.events.recentEvents].slice(0, 6);
}

function applyResourceEffects(runState, resources, phase) {
  for (const [key, delta] of Object.entries(resources)) {
    if (OBSOLETE_RESOURCE_KEYS.has(key)) {
      continue;
    }

    const numericDelta = Number(delta) || 0;

    if (numericDelta === 0) {
      continue;
    }

    applySupportedResourceEffect(runState, key, numericDelta, phase);
  }
}

function applySupportedResourceEffect(runState, key, numericDelta, phase) {
  const dayDeltaKey = RESOURCE_TO_DAY_DELTA[key];
  if (dayDeltaKey) {
    runState.day[dayDeltaKey] += numericDelta;
  }

  if (key === "batteryCharge" || key === "electric") {
    const electricCapacity = Math.max(1, Number(runState.v2?.resources?.electric?.capacity) || 1);
    runState.resources.batteryCharge = clampValue(
      Number(runState.resources.batteryCharge) + numericDelta,
      0,
      Number(runState.resources.batteryCapacity) || electricCapacity
    );
    runState.v2.resources.electric.charge = clampValue(
      Number(runState.v2?.resources?.electric?.charge) + numericDelta,
      0,
      electricCapacity
    );
    adjustEnergyBreakdown(runState, phase, numericDelta);
    return;
  }

  if (key === "water") {
    const capacity = Math.max(1, Number(runState.v2?.resources?.water?.capacity) || Number(runState.resources.waterCapacity) || 1);
    runState.resources.water = clampValue(Number(runState.resources.water) + numericDelta, 0, Number(runState.resources.waterCapacity) || capacity);
    runState.v2.resources.water.current = clampValue(
      Number(runState.v2?.resources?.water?.current) + numericDelta,
      0,
      capacity
    );
    return;
  }

  if (key === "waste") {
    const capacity = Math.max(1, Number(runState.v2?.resources?.waste?.capacity) || 1);
    runState.v2.resources.waste.current = clampValue(
      Number(runState.v2?.resources?.waste?.current) + numericDelta,
      0,
      capacity
    );
    return;
  }

  if (key === "tripScore") {
    runState.v2.resources.tripScore = Math.max(
      0,
      (Number(runState.v2?.resources?.tripScore) || 0) + numericDelta
    );
    return;
  }

  if (key === "passengerMorale" || key === "hiddenMorale") {
    runState.v2.hiddenMorale = clampValue(
      (Number(runState.v2?.hiddenMorale) || 0) + numericDelta,
      0,
      100
    );
    runState.resources.passengerMorale = clampValue(
      (Number(runState.resources.passengerMorale) || 0) + numericDelta,
      0,
      100
    );
    applyEventMoraleImpact(runState, numericDelta);
    return;
  }

  runState.resources[key] += numericDelta;
}

function applyJourneyEffects(runState, journey) {
  const milesDelta = Number(journey.milesTraveled) || 0;

  if (milesDelta !== 0) {
    const previousMiles = runState.journey.milesTraveled;
    runState.journey.milesTraveled += milesDelta;
    runState.day.dailyMilesDriven += milesDelta;
    syncJourneyRouteProgress(runState, { previousMiles, recordDayNotes: true });

    if (runState.day.routeArrivalNotice?.kind === "destination") {
      runState.day.summaryHeadline = runState.day.routeArrivalNotice.title;
    }
  }
}

function snapshotEventScoreState(runState) {
  return {
    battery: Number(runState.v2?.resources?.electric?.charge) || 0,
    water: Number(runState.v2?.resources?.water?.current ?? runState.resources?.water) || 0,
    waste: Number(runState.v2?.resources?.waste?.current) || 0,
    hiddenMorale: Number(runState.v2?.hiddenMorale) || 0,
    tripScore: Number(runState.v2?.resources?.tripScore) || 0,
    miles: Number(runState.journey?.milesTraveled) || 0
  };
}

function buildEventOutcomeDelta(runState, before) {
  return {
    changes: {
      dailyMilesDriven: (Number(runState.journey?.milesTraveled) || 0) - before.miles,
      dailyBatteryDelta: (Number(runState.v2?.resources?.electric?.charge) || 0) - before.battery,
      dailyFuelDelta: 0,
      dailyWaterDelta:
        (Number(runState.v2?.resources?.water?.current ?? runState.resources?.water) || 0) -
        before.water,
      dailyMoraleDelta: 0,
      dailyConditionDelta: 0,
      dailyCashDelta: 0
    },
    v2Changes: {
      wasteDelta: (Number(runState.v2?.resources?.waste?.current) || 0) - before.waste,
      hiddenMoraleDelta: (Number(runState.v2?.hiddenMorale) || 0) - before.hiddenMorale,
      tripScoreDelta: (Number(runState.v2?.resources?.tripScore) || 0) - before.tripScore
    },
    scoreContext: {
      kind: "event"
    }
  };
}

function applyPassengerPressureEffects(runState, pressureEffects) {
  const nextPressure = {
    ...normalizePassengerPressureState(runState.passengerPressure)
  };

  for (const key of [
    "recentFrugalDays",
    "recentPushMilesDays",
    "poorRestStreak",
    "recoveryMomentum"
  ]) {
    const delta = Number(pressureEffects?.[key]) || 0;

    if (delta === 0) {
      continue;
    }

    nextPressure[key] = (Number(nextPressure[key]) || 0) + delta;
  }

  runState.passengerPressure = normalizePassengerPressureState(nextPressure);
}

function adjustEnergyBreakdown(runState, phase, batteryDelta) {
  const bucket = getEnergyBucketForPhase(phase);

  runState.day.energy[bucket].eventAdjustment += batteryDelta;
  runState.day.energy[bucket].netBatteryDelta += batteryDelta;
  runState.day.energy.total.eventAdjustment += batteryDelta;
  runState.day.energy.total.netBatteryDelta += batteryDelta;
}

function getEnergyBucketForPhase(phase) {
  if (phase === DAY_PHASES.CAMP_DECISION || phase === DAY_PHASES.OVERNIGHT_RESOLUTION) {
    return "overnight";
  }

  return "travel";
}

function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}
