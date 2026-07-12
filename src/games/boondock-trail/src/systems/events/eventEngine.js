import {
  COMFORT_POLICIES,
  DAY_PHASES,
  WARNING_FLAGS
} from "../../constants/gameConstants.js";
import { getDrivingStyleOption } from "../../state/gameContent.js";
import {
  cloneGameState,
  finalizeGameState,
  getBatteryPercent,
  getMoraleBand
} from "../../state/gameState.js";
import { eventDefinitions } from "./eventDefinitions.js";
import { applyEventEffects, recordResolvedEvent } from "./eventEffects.js";
import { getMoralePressureScore, getPressurePenaltyProfile } from "../passengerPressure.js";
import { normalizePressureValue } from "../coreSystems.js";
import { syncTravelSessionAfterEventState } from "../travelSession.js";
import { getOvernightContext, getSelectedCampsiteType } from "../overnightContext.js";
import { getActiveRouteLegModifiers } from "../routeChoiceLoop.js";

const SUPPORTED_PHASES = new Set([
  DAY_PHASES.MORNING_REVIEW,
  DAY_PHASES.TRAVEL_RESOLUTION,
  DAY_PHASES.CAMP_DECISION,
  DAY_PHASES.OVERNIGHT_RESOLUTION
]);

const PHASE_BASE_CHANCE = Object.freeze({
  [DAY_PHASES.MORNING_REVIEW]: 0.22,
  [DAY_PHASES.TRAVEL_RESOLUTION]: 0.28,
  [DAY_PHASES.CAMP_DECISION]: 0.2,
  [DAY_PHASES.OVERNIGHT_RESOLUTION]: 0.18
});

export function queueEventForCurrentPhase(runState) {
  const nextState = cloneGameState(runState);

  if (
    nextState.gameOver ||
    nextState.events.activeEvent !== null ||
    nextState.day.eventsResolvedCount >= 2 ||
    !SUPPORTED_PHASES.has(nextState.currentPhase)
  ) {
    return finalizeGameState(nextState);
  }

  const selectedEvent = chooseEventForPhase(nextState, nextState.currentPhase);

  if (!selectedEvent) {
    return finalizeGameState(nextState);
  }

  queueSelectedEvent(nextState, selectedEvent);

  return finalizeGameState(nextState);
}

export function queueForcedEventForPhase(runState, phase, options = {}) {
  const nextState = cloneGameState(runState);

  if (nextState.gameOver || nextState.events.activeEvent !== null) {
    return finalizeGameState(nextState);
  }

  if (
    options.respectDailyCap === true &&
    phase === DAY_PHASES.TRAVEL_RESOLUTION &&
    (Number(nextState.day.travelSession?.fullTravelEventsToday) || 0) >= 2
  ) {
    return finalizeGameState(nextState);
  }

  const selectedEvent =
    typeof options.eventId === "string" && options.eventId.length > 0
      ? getEventDefinitionById(options.eventId, phase)
      : chooseEventForPhase(nextState, phase, {
          skipChance: true,
          pickRoll: options.pickRoll
        });

  if (!selectedEvent) {
    return finalizeGameState(nextState);
  }

  queueSelectedEvent(nextState, selectedEvent);

  return finalizeGameState(nextState);
}

export function getEligibleEventsForPhase(runState, phase) {
  const eligible = eventDefinitions.filter(
    (entry) => entry.phase === phase && isEventEligible(runState, entry)
  );

  if (eligible.length === 0) {
    return [];
  }

  const lastEventId = runState.events.recentEvents[0]?.id;
  const recentIds = new Set(runState.events.recentEvents.slice(0, 3).map((entry) => entry.id));
  let filtered = eligible.filter((entry) => entry.id !== lastEventId);

  if (filtered.length >= 3) {
    const recentFiltered = filtered.filter((entry) => !recentIds.has(entry.id));
    if (recentFiltered.length > 0) {
      filtered = recentFiltered;
    }
  }

  return filtered.length > 0 ? filtered : eligible;
}

export function chooseEventForPhase(runState, phase, options = {}) {
  const eligible = getEligibleEventsForPhase(runState, phase).map((entry) => ({
    ...entry,
    effectiveWeight: getStateAwareWeight(runState, entry)
  }));

  if (eligible.length === 0) {
    return null;
  }

  if (!options.skipChance) {
    const fireRoll =
      Number.isFinite(Number(options.fireRoll))
        ? Number(options.fireRoll)
        : deterministicValue(runState, phase, "fire");

    if (fireRoll > getEventChance(runState, phase)) {
      return null;
    }
  }

  const pickRoll =
    Number.isFinite(Number(options.pickRoll))
      ? Number(options.pickRoll)
      : deterministicValue(runState, phase, "pick");

  return weightedPick(eligible, pickRoll);
}

export function resolveActiveEvent(runState, choiceId = null) {
  const nextState = cloneGameState(runState);
  const activeEvent = nextState.events.activeEvent;

  if (!activeEvent || activeEvent.state === "resolved") {
    return finalizeGameState(nextState);
  }

  const baseResolution =
    activeEvent.type === "choice"
      ? activeEvent.choices.find((entry) => entry.id === choiceId) ?? activeEvent.choices[0]
      : activeEvent;
  const { resolvedResolution, resolvedOutcomeId } = resolveEventResolution(
    nextState,
    activeEvent,
    baseResolution
  );

  applyEventEffects(nextState, resolvedResolution.effects, activeEvent.phase);
  nextState.day.summaryNotes = [...nextState.day.summaryNotes, resolvedResolution.resultText];
  nextState.day.eventsResolvedCount += 1;
  nextState.events.activeEvent = {
    ...activeEvent,
    state: "resolved",
    resolvedBodyText:
      resolvedResolution.resolvedBodyText ?? resolvedResolution.resultText,
    resolvedAudioTone: resolvedResolution.audioTone ?? activeEvent.audioTone ?? "neutral",
    resolvedChoiceId: baseResolution.id ?? null,
    resolvedOutcomeId,
    resolvedText: resolvedResolution.resultText
  };

  if (activeEvent.phase === DAY_PHASES.TRAVEL_RESOLUTION) {
    syncTravelSessionAfterEventState(nextState);
  }

  return finalizeGameState(nextState);
}

function queueSelectedEvent(runState, selectedEvent) {
  runState.events.activeEvent = {
    ...cloneGameState(selectedEvent),
    state: "prompt",
    resolvedText: null,
    resolvedChoiceId: null,
    resolvedOutcomeId: null
  };
}

function getEventDefinitionById(eventId, phase) {
  return (
    eventDefinitions.find((entry) => entry.id === eventId && entry.phase === phase) ?? null
  );
}

function weightedPick(entries, roll) {
  const totalWeight = entries.reduce((sum, entry) => sum + getEffectiveWeight(entry), 0);
  const target = roll * totalWeight;
  let cursor = 0;

  for (const entry of entries) {
    cursor += getEffectiveWeight(entry);
    if (target <= cursor) {
      return entry;
    }
  }

  return entries[entries.length - 1];
}

function resolveEventResolution(runState, activeEvent, resolution) {
  if (!Array.isArray(resolution?.randomOutcomes) || resolution.randomOutcomes.length === 0) {
    return {
      resolvedResolution: resolution,
      resolvedOutcomeId: null
    };
  }

  const branchRoll = deterministicValue(
    runState,
    activeEvent.phase,
    `branch|${activeEvent.id}|${resolution.id ?? "automatic"}`
  );
  const selectedOutcome = weightedPick(
    resolution.randomOutcomes.map((entry) => ({
      ...entry,
      effectiveWeight: entry.weight ?? 1
    })),
    branchRoll
  );

  return {
    resolvedResolution: {
      ...resolution,
      resultText: selectedOutcome.resultText ?? resolution.resultText,
      resolvedBodyText:
        selectedOutcome.resolvedBodyText ??
        selectedOutcome.resultText ??
        resolution.resolvedBodyText ??
        resolution.resultText,
      audioTone: selectedOutcome.audioTone ?? resolution.audioTone ?? "neutral",
      effects: mergeEventEffects(resolution.effects, selectedOutcome.effects)
    },
    resolvedOutcomeId: selectedOutcome.id ?? null
  };
}

function mergeEventEffects(baseEffects = {}, branchEffects = {}) {
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

function getEffectiveWeight(entry) {
  return entry.effectiveWeight ?? entry.weight ?? 1;
}

function getStateAwareWeight(runState, entry) {
  const warnings = new Set(runState.events.warnings);
  const pressureScore = getMoralePressureScore(runState);
  const activeRumor = runState.routeIntel?.activeRumor ?? null;
  const comfortPolicy = runState.policies.comfortPolicy;
  const legModifiers = getActiveRouteLegModifiers(runState);
  const cabinFeverActive = runState.cabinFever?.active === true;
  const corePressure = normalizePressureValue(runState.pressure);
  let weight = entry.weight ?? 1;

  if (cabinFeverActive && (entry.category === "morale" || entry.presentation === "human_trouble")) {
    weight += 1.5;
  }

  if (
    (runState.resourcePressure?.lowPower || runState.resourcePressure?.lowWater || runState.resourcePressure?.highWaste) &&
    (entry.category === "resources" || entry.category === "maintenance")
  ) {
    weight += 1.2;
  }

  if (corePressure >= 70 && entry.category !== "recovery") {
    weight += 1;
  }

  if (
    entry.category === "morale" &&
    (pressureScore >= 3 ||
      warnings.has(WARNING_FLAGS.PASSENGERS_TENSE) ||
      warnings.has(WARNING_FLAGS.STRAIN_BUILDING))
  ) {
    weight += 2;
  }

  if (
    entry.category === "recovery" &&
    (warnings.has(WARNING_FLAGS.REAL_BREAK_NEEDED) ||
      warnings.has(WARNING_FLAGS.HOOKUP_RECOMMENDED))
  ) {
    weight += 1;
  }

  if (
    entry.category === "morale" &&
    (runState.passengerPressure?.recoveryMomentum ?? 0) >= 2 &&
    pressureScore <= 1
  ) {
    weight += 1;
  }

  if (comfortPolicy === COMFORT_POLICIES.FRUGAL) {
    if (entry.category === "morale") {
      weight += 0.8;
    }

    if (entry.presentation === "human_trouble") {
      weight += 0.4;
    }

    if (entry.category === "recovery") {
      weight -= 0.25;
    }
  }

  if (
    comfortPolicy === COMFORT_POLICIES.COMFORTABLE ||
    comfortPolicy === COMFORT_POLICIES.INDULGENT
  ) {
    if (entry.category === "recovery") {
      weight += 0.8;
    }

    if (entry.category === "morale") {
      weight -= 0.35;
    }

    if (entry.presentation === "human_trouble") {
      weight -= 0.15;
    }
  }

  if (
    entry.phase === DAY_PHASES.TRAVEL_RESOLUTION &&
    activeRumor &&
    activeRumor.segmentId === runState.journey.currentSegmentId
  ) {
    weight += Number(activeRumor.eventWeightAdjustments?.[entry.id]) || 0;
  }

  if (entry.phase === DAY_PHASES.TRAVEL_RESOLUTION) {
    weight += Number(legModifiers.eventCategoryWeights?.[entry.category]) || 0;
  }

  return Math.max(0.1, weight);
}

function deterministicValue(runState, phase, salt) {
  const recentKey = runState.events.recentEvents.slice(0, 3).map((entry) => entry.id).join(",");
  const key = [
    runState.runId,
    runState.dayNumber,
    phase,
    salt,
    runState.journey.milesTraveled,
    runState.v2?.resources?.electric?.charge ?? runState.resources.batteryCharge,
    runState.v2?.hiddenMorale ?? runState.resources.passengerMorale,
    runState.day.eventsResolvedCount,
    recentKey
  ].join("|");

  let hash = 2166136261;

  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}

export function finalizeActiveEvent(runState) {
  const nextState = cloneGameState(runState);
  const activeEvent = nextState.events.activeEvent;

  if (!activeEvent || activeEvent.state !== "resolved") {
    return finalizeGameState(nextState);
  }

  recordResolvedEvent(nextState, activeEvent);
  nextState.events.activeEvent = null;

  return finalizeGameState(nextState);
}

function isEventEligible(runState, definition) {
  const trigger = definition.triggerConditions ?? {};
  const batteryPercent = getBatteryPercent(runState);
  const waterPercent = Math.round(
    (Math.max(0, runState.v2?.resources?.water?.current ?? runState.resources.water) /
      Math.max(1, runState.v2?.resources?.water?.capacity ?? runState.resources.waterCapacity)) *
      100
  );
  const moraleBand = getMoraleBand(runState);
  const currentSunlight = Number(runState.environment.sunlightFactor) || 1;
  const forecastSunlight = Number(runState.environment.forecast?.[0]?.sunlightFactor ?? currentSunlight);
  const warnings = new Set(runState.events.warnings);
  const pressure = runState.passengerPressure ?? {};
  const pressureScore = getMoralePressureScore(runState);
  const overnightLocationType = getOvernightContext(runState)?.locationType ?? null;

  if (trigger.minDay && runState.dayNumber < trigger.minDay) {
    return false;
  }
  if (trigger.maxDay && runState.dayNumber > trigger.maxDay) {
    return false;
  }
  if (trigger.batteryPercentMax && batteryPercent > trigger.batteryPercentMax) {
    return false;
  }
  if (trigger.batteryPercentMin && batteryPercent < trigger.batteryPercentMin) {
    return false;
  }
  if (trigger.waterPercentMax && waterPercent > trigger.waterPercentMax) {
    return false;
  }
  if (trigger.waterPercentMin && waterPercent < trigger.waterPercentMin) {
    return false;
  }
  if (trigger.sunlightMax && currentSunlight > trigger.sunlightMax) {
    return false;
  }
  if (trigger.sunlightMin && currentSunlight < trigger.sunlightMin) {
    return false;
  }
  if (trigger.forecastSunlightMax && forecastSunlight > trigger.forecastSunlightMax) {
    return false;
  }
  if (trigger.forecastSunlightMin && forecastSunlight < trigger.forecastSunlightMin) {
    return false;
  }
  if (trigger.pressureScoreMin && pressureScore < trigger.pressureScoreMin) {
    return false;
  }
  if (trigger.pressureScoreMax && pressureScore > trigger.pressureScoreMax) {
    return false;
  }
  if (
    trigger.recentFrugalDaysMin &&
    (Number(pressure.recentFrugalDays) || 0) < trigger.recentFrugalDaysMin
  ) {
    return false;
  }
  if (
    trigger.recentPushMilesDaysMin &&
    (Number(pressure.recentPushMilesDays) || 0) < trigger.recentPushMilesDaysMin
  ) {
    return false;
  }
  if (
    trigger.poorRestStreakMin &&
    (Number(pressure.poorRestStreak) || 0) < trigger.poorRestStreakMin
  ) {
    return false;
  }
  if (
    trigger.recoveryMomentumMin &&
    (Number(pressure.recoveryMomentum) || 0) < trigger.recoveryMomentumMin
  ) {
    return false;
  }
  if (
    trigger.travelModes &&
    !trigger.travelModes.includes(runState.policies.drivingStyle ?? runState.policies.travelMode)
  ) {
    return false;
  }
  if (trigger.comfortPolicies && !trigger.comfortPolicies.includes(runState.policies.comfortPolicy)) {
    return false;
  }
  if (
    trigger.campsiteTypes &&
    !trigger.campsiteTypes.includes(getSelectedCampsiteType(runState))
  ) {
    return false;
  }
  if (
    trigger.overnightLocationTypes &&
    !trigger.overnightLocationTypes.includes(overnightLocationType)
  ) {
    return false;
  }
  if (trigger.moraleBandAny && !trigger.moraleBandAny.includes(moraleBand)) {
    return false;
  }
  if (
    trigger.warningsAny &&
    !trigger.warningsAny.some((flag) => warnings.has(flag))
  ) {
    return false;
  }
  if (
    trigger.warningsNone &&
    trigger.warningsNone.some((flag) => warnings.has(flag))
  ) {
    return false;
  }

  return true;
}

function getEventChance(runState, phase) {
  const warnings = new Set(runState.events.warnings);
  const drivingStyle = getDrivingStyleOption(
    runState.policies.drivingStyle ?? runState.policies.travelMode
  );
  const pressurePenalty = getPressurePenaltyProfile(runState);
  const corePressure = normalizePressureValue(runState.pressure);
  let chance = PHASE_BASE_CHANCE[phase] ?? 0.3;

  if (runState.day.eventsResolvedCount >= 1) {
    chance -= 0.16;
  }

  if (
    warnings.has(WARNING_FLAGS.LOW_BATTERY) ||
    warnings.has(WARNING_FLAGS.VERY_LOW_BATTERY) ||
    warnings.has(WARNING_FLAGS.CRITICALLY_LOW_BATTERY) ||
    warnings.has(WARNING_FLAGS.LOW_MORALE) ||
    warnings.has(WARNING_FLAGS.PASSENGERS_TENSE) ||
    warnings.has(WARNING_FLAGS.MORALE_FRAGILE) ||
    warnings.has(WARNING_FLAGS.REAL_BREAK_NEEDED) ||
    warnings.has(WARNING_FLAGS.HOOKUP_RECOMMENDED) ||
    warnings.has(WARNING_FLAGS.HIGH_WASTE) ||
    warnings.has(WARNING_FLAGS.WASTE_NEAR_LIMIT) ||
    warnings.has(WARNING_FLAGS.LOW_WATER)
  ) {
    chance += 0.05;
  }

  if (phase === DAY_PHASES.TRAVEL_RESOLUTION) {
    chance += Number(drivingStyle.travelRule?.travelEventChanceAdjustment) || 0;
    chance += pressurePenalty.eventChanceAdjustment;
  }

  if (runState.cabinFever?.active === true) {
    chance += 0.06;
  }

  if (corePressure >= 70) {
    chance += 0.08;
  }

  return Math.max(0.08, Math.min(0.45, chance));
}
