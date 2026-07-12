import {
  CAMPSITE_TYPES,
  COMFORT_POLICIES,
  MORALE_BANDS,
  STATUS_THRESHOLDS,
  WARNING_FLAGS
} from "../constants/gameConstants.js";
import { getCampsiteRules, getDrivingStyleOption } from "../state/gameContent.js";

const STREAK_CAP = 3;
const MOMENTUM_CAP = 3;
const WARNING_TRACK_CAP = 6;
const FATIGUE_CAP = 6;
const ENERGY_DEBT_CAP = 6;
const INCIDENT_RISK_CAP = 6;
const PRESSURE_DAY_CAP = 5;

const TRAVEL_COMFORT_MORALE = Object.freeze({
  [COMFORT_POLICIES.FRUGAL]: -1,
  [COMFORT_POLICIES.BALANCED]: 0,
  [COMFORT_POLICIES.COMFORTABLE]: 1,
  [COMFORT_POLICIES.INDULGENT]: 1
});

const OVERNIGHT_COMFORT_MORALE = Object.freeze({
  [COMFORT_POLICIES.FRUGAL]: -2,
  [COMFORT_POLICIES.BALANCED]: 0,
  [COMFORT_POLICIES.COMFORTABLE]: 4,
  [COMFORT_POLICIES.INDULGENT]: 4
});

export function createPassengerPressureState(overrides = {}) {
  return normalizePassengerPressureState({
    recentFrugalDays: 0,
    recentPushMilesDays: 0,
    poorRestStreak: 0,
    recoveryMomentum: 0,
    strainWarningDays: 0,
    breakWarningDays: 0,
    tensionWarningDays: 0,
    poorChargingDays: 0,
    pressureDayStreak: 0,
    fatigueLevel: 0,
    energyDebt: 0,
    incidentRisk: 0,
    ...overrides
  });
}

export function normalizePassengerPressureState(value) {
  const source = typeof value === "object" && value !== null ? value : {};

  return {
    recentFrugalDays: clampCounter(source.recentFrugalDays, STREAK_CAP),
    recentPushMilesDays: clampCounter(source.recentPushMilesDays, STREAK_CAP),
    poorRestStreak: clampCounter(source.poorRestStreak, STREAK_CAP),
    recoveryMomentum: clampCounter(source.recoveryMomentum, MOMENTUM_CAP),
    strainWarningDays: clampCounter(source.strainWarningDays, WARNING_TRACK_CAP),
    breakWarningDays: clampCounter(source.breakWarningDays, WARNING_TRACK_CAP),
    tensionWarningDays: clampCounter(source.tensionWarningDays, WARNING_TRACK_CAP),
    poorChargingDays: clampCounter(source.poorChargingDays, WARNING_TRACK_CAP),
    pressureDayStreak: clampCounter(source.pressureDayStreak, PRESSURE_DAY_CAP),
    fatigueLevel: clampCounter(source.fatigueLevel, FATIGUE_CAP),
    energyDebt: clampCounter(source.energyDebt, ENERGY_DEBT_CAP),
    incidentRisk: clampCounter(source.incidentRisk, INCIDENT_RISK_CAP)
  };
}

export function getPressurePenaltyProfile(runState) {
  const pressure = normalizePassengerPressureState(runState.passengerPressure);
  const fatigueScore = softenCounter(pressure.fatigueLevel, 3, 0.5);
  const pressureScore = softenCounter(pressure.pressureDayStreak, 2, 0.6);
  const breakScore = softenCounter(Math.max(0, pressure.breakWarningDays - 1), 2, 0.45);
  const tensionScore = softenCounter(pressure.tensionWarningDays, 2, 0.55);
  const energyScore = softenCounter(pressure.energyDebt, 2, 0.6);
  const incidentScore = softenCounter(pressure.incidentRisk, 3, 0.5);

  return {
    milesPenalty: Math.round(fatigueScore * 9 + pressureScore * 9 + breakScore * 10),
    fuelPenalty: 0,
    conditionWearPenalty: 0,
    moralePenalty: Math.floor(tensionScore / 1.9) + Math.floor(breakScore / 2.3),
    solarPenalty: Math.floor(energyScore / 1.8) + Math.floor(pressure.poorChargingDays / 4),
    loadPenalty: Math.floor(energyScore / 2.6) + Math.floor(fatigueScore / 4.2),
    recoveryPenalty: Math.floor(fatigueScore / 3.2) + Math.floor(tensionScore / 3),
    eventChanceAdjustment:
      Math.min(
        0.1,
        incidentScore * 0.01 +
          pressureScore * 0.012 +
          energyScore * 0.006
      )
  };
}

export function applyDailyWarningEscalation(runState) {
  const warnings = new Set(runState.events?.warnings ?? []);
  const pressure = normalizePassengerPressureState(runState.passengerPressure);
  const pressureDay =
    warnings.size >= 2 ||
    warnings.has(WARNING_FLAGS.BEHIND_SCHEDULE) ||
    warnings.has(WARNING_FLAGS.REAL_BREAK_NEEDED);
  const nextPressure = {
    ...pressure,
    tensionWarningDays: updateWarningTrack(
      pressure.tensionWarningDays,
      warnings.has(WARNING_FLAGS.PASSENGERS_TENSE) || warnings.has(WARNING_FLAGS.LOW_MORALE)
    ),
    strainWarningDays: updateWarningTrack(
      pressure.strainWarningDays,
      warnings.has(WARNING_FLAGS.STRAIN_BUILDING)
    ),
    breakWarningDays: updateWarningTrack(
      pressure.breakWarningDays,
      warnings.has(WARNING_FLAGS.REAL_BREAK_NEEDED) || warnings.has(WARNING_FLAGS.MORALE_FRAGILE)
    ),
    poorChargingDays: updateWarningTrack(
      pressure.poorChargingDays,
      warnings.has(WARNING_FLAGS.POOR_CHARGING_CONDITIONS) ||
        warnings.has(WARNING_FLAGS.HOOKUP_RECOMMENDED)
    ),
    pressureDayStreak: pressureDay
      ? clampCounter(pressure.pressureDayStreak + 1, PRESSURE_DAY_CAP)
      : Math.max(0, pressure.pressureDayStreak - 1)
  };

  nextPressure.fatigueLevel = clampCounter(
    pressure.fatigueLevel +
      (warnings.has(WARNING_FLAGS.STRAIN_BUILDING) ? 1 : 0) +
      (warnings.has(WARNING_FLAGS.REAL_BREAK_NEEDED) ? 1 : 0) +
      (pressureDay ? 1 : 0) -
      (pressure.recoveryMomentum >= 2 &&
      !warnings.has(WARNING_FLAGS.STRAIN_BUILDING) &&
      !warnings.has(WARNING_FLAGS.REAL_BREAK_NEEDED)
        ? 1
        : 0),
    FATIGUE_CAP
  );
  nextPressure.energyDebt = clampCounter(
    pressure.energyDebt +
      (warnings.has(WARNING_FLAGS.POOR_CHARGING_CONDITIONS) ? 1 : 0) +
      (warnings.has(WARNING_FLAGS.HOOKUP_RECOMMENDED) ? 1 : 0) -
      (getBatteryPercent(runState) > 45 && !warnings.has(WARNING_FLAGS.POOR_CHARGING_CONDITIONS)
        ? 1
        : 0),
    ENERGY_DEBT_CAP
  );
  nextPressure.incidentRisk = clampCounter(
    pressure.incidentRisk +
      (pressureDay ? 1 : 0) +
      (warnings.has(WARNING_FLAGS.REAL_BREAK_NEEDED) ? 1 : 0) -
      (pressure.recoveryMomentum >= 2 ? 1 : 0),
    INCIDENT_RISK_CAP
  );

  const notes = [];
  let batteryDelta = 0;
  let moraleDelta = 0;
  let extraDayLoss = 0;

  if (nextPressure.tensionWarningDays >= 3) {
    moraleDelta -= 1;
    notes.push("Passenger tension carried into the next morning and cost morale.");
  }

  if (nextPressure.fatigueLevel >= 3) {
    moraleDelta -= 1;
    notes.push("Accumulated fatigue made the cabin less resilient.");
  }

  if (nextPressure.fatigueLevel >= 5) {
    moraleDelta -= 1;
    batteryDelta -= 1;
    notes.push("Several pressure-heavy days in a row left the rig less steady and everyone more worn down.");
  }

  if (nextPressure.energyDebt >= 3) {
    batteryDelta -= 2;
    notes.push("Repeated weak charging left the battery in a worse starting position.");
  }

  if (nextPressure.incidentRisk >= 4) {
    batteryDelta -= 1;
    moraleDelta -= 1;
    notes.push("Compounding risk on the road translated into extra instability.");
  }

  if (
    nextPressure.breakWarningDays >= 5 &&
    nextPressure.fatigueLevel >= 5 &&
    nextPressure.recoveryMomentum <= 0
  ) {
    extraDayLoss = 1;
    nextPressure.breakWarningDays = Math.max(0, nextPressure.breakWarningDays - 2);
    nextPressure.fatigueLevel = Math.max(0, nextPressure.fatigueLevel - 1);
    notes.push("The trip had to give up an extra day to steady itself.");
  }

  runState.passengerPressure = normalizePassengerPressureState(nextPressure);
  runState.resources.batteryCharge += batteryDelta;
  runState.resources.passengerMorale += moraleDelta;

  return {
    batteryDelta,
    fuelDelta: 0,
    moraleDelta,
    conditionDelta: 0,
    extraDayLoss,
    notes: compactNotes(notes)
  };
}

export function calculateTravelMoraleOutcome(runState, adjustments = {}) {
  const drivingStyle = getDrivingStyleOption(
    runState.policies.drivingStyle ?? runState.policies.travelMode
  );
  const pressure = normalizePassengerPressureState(runState.passengerPressure);
  const nextPressure = {
    ...pressure,
    recentFrugalDays: updateStreak(
      pressure.recentFrugalDays,
      runState.policies.comfortPolicy === COMFORT_POLICIES.FRUGAL
    ),
    recentPushMilesDays: updateStreak(
      pressure.recentPushMilesDays,
      drivingStyle.travelRule?.countsAsHardDay === true
    ),
    recoveryMomentum: clampCounter(
      pressure.recoveryMomentum - (isHardTravelDay(runState, drivingStyle) ? 1 : 0),
      MOMENTUM_CAP
    )
  };

  const baseDelta =
    (Number(drivingStyle.travelRule?.travelMoraleDelta) || 0) +
    (TRAVEL_COMFORT_MORALE[runState.policies.comfortPolicy] ?? 0) +
    (Number(adjustments.weatherMorale) || 0) +
    (Number(adjustments.conditionMorale) || 0);

  let historyDelta = 0;
  const notes = [];

  if (nextPressure.recentFrugalDays >= 2) {
    historyDelta -= 1;
    notes.push("Too many frugal days in a row are starting to wear thin.");
  }

  if (nextPressure.recentPushMilesDays >= 2) {
    historyDelta -= 1;
    notes.push("Back-to-back hard drives have shortened everyone's patience.");
  }

  if (pressure.poorRestStreak >= 1) {
    historyDelta -= pressure.poorRestStreak >= 2 ? 2 : 1;
    notes.push(
      pressure.poorRestStreak >= 2
        ? "Several weak nights in a row have made the RV feel less forgiving."
        : "Last night's weak rest carried tension into the drive."
    );
  }

  if (
    getBatteryPercent(runState) <= STATUS_THRESHOLDS.lowResourcePercent &&
    !isComfortFirstPolicy(runState.policies.comfortPolicy)
  ) {
    historyDelta -= 1;
    notes.push("Low battery made the RV feel tighter.");
  }

  if (nextPressure.recoveryMomentum >= 2 && !isHardTravelDay(runState)) {
    historyDelta += 1;
    notes.push("A steadier recent stretch kept the mood from slipping further.");
  }

  return {
    delta: baseDelta + historyDelta,
    pressureState: normalizePassengerPressureState(nextPressure),
    notes: compactNotes(notes)
  };
}

export function calculateOvernightMoraleOutcome(runState, context) {
  const drivingStyle = getDrivingStyleOption(
    runState.policies.drivingStyle ?? runState.policies.travelMode
  );
  const pressure = normalizePassengerPressureState(runState.passengerPressure);
  const campsiteType = context.campsiteType ?? CAMPSITE_TYPES.PARTIAL_SHADE;
  const campsiteRule = getCampsiteRules(campsiteType);
  const chargingBand = context.chargingBand ?? "fair";
  const netBatteryDelta = Number(context.netBatteryDelta) || 0;
  const hookupSupport = Number(context.hookupSupport) || 0;
  const restQuality = getRestQuality(runState, {
    campsiteRule,
    campsiteType,
    chargingBand,
    netBatteryDelta,
    hookupSupport,
    restQualityShift:
      (Number(context.restQualityShift) || 0) +
      (Number(drivingStyle.travelRule?.overnightRestShift) || 0)
  });
  const nextPressure = applyRestQualityToPressure(pressure, restQuality);

  const baseDelta =
    (Number(campsiteRule.moraleDelta) || 0) +
    (Number(context.moraleAdjustment) || 0) +
    (OVERNIGHT_COMFORT_MORALE[runState.policies.comfortPolicy] ?? 0) +
    getChargingMoraleAdjustment(chargingBand, campsiteType) +
    getReserveStressAdjustment(runState, campsiteType, netBatteryDelta);

  let historyDelta = 0;
  const notes = [];

  if (restQuality === "poor" && nextPressure.poorRestStreak >= 2) {
    historyDelta -= 1;
    notes.push("Weak nights are beginning to stack up inside the RV.");
  }

  if (
    pressure.recentFrugalDays >= 2 &&
    runState.policies.comfortPolicy === COMFORT_POLICIES.FRUGAL
  ) {
    historyDelta -= 1;
    notes.push("Another frugal night after several spare days wore on people.");
  }

  if (
    pressure.recentPushMilesDays >= 2 &&
    campsiteType === CAMPSITE_TYPES.OPEN_SUN
  ) {
    historyDelta -= 1;
    notes.push("After several hard driving days, the exposed site felt less restful.");
  }

  if ((Number(drivingStyle.travelRule?.overnightRestShift) || 0) < 0 && restQuality !== "strong") {
    notes.push("Today's hard push left less room for the RV to settle fully overnight.");
  }

  if ((Number(drivingStyle.travelRule?.overnightRestShift) || 0) > 0 && restQuality !== "poor") {
    notes.push("An easier day on the road left a little more room to recover overnight.");
  }

  if (isComfortFirstPolicy(runState.policies.comfortPolicy) && restQuality !== "poor") {
    historyDelta += 1;
    notes.push("Comfort-first living gave the night a little more room to reset.");
  }

  if (nextPressure.recoveryMomentum >= 2 && restQuality !== "poor") {
    historyDelta += 1;
    notes.push("A steadier stretch helped everyone settle by morning.");
  }

  if (
    campsiteType !== CAMPSITE_TYPES.PAID_HOOKUP &&
    getProjectedBatteryPercent(runState, netBatteryDelta) <=
      STATUS_THRESHOLDS.hookupRecommendationBatteryPercent &&
    netBatteryDelta <= 0
  ) {
    historyDelta -= 1;
    notes.push("Low reserve after sunset kept the whole RV on edge.");
  }

  return {
    delta: baseDelta + historyDelta,
    pressureState: normalizePassengerPressureState(nextPressure),
    restQuality,
    notes: compactNotes(notes)
  };
}

export function applyTownRecoveryToPassengerPressure(runState, actionId) {
  const pressure = normalizePassengerPressureState(runState.passengerPressure);
  const nextPressure = { ...pressure };
  let note = null;

  if (actionId === "rest_up") {
    nextPressure.recoveryMomentum = clampCounter(pressure.recoveryMomentum + 2, MOMENTUM_CAP);
    nextPressure.poorRestStreak = Math.max(0, pressure.poorRestStreak - 2);
    nextPressure.recentFrugalDays = Math.max(0, pressure.recentFrugalDays - 1);
    nextPressure.recentPushMilesDays = Math.max(0, pressure.recentPushMilesDays - 1);
    nextPressure.tensionWarningDays = Math.max(0, pressure.tensionWarningDays - 2);
    nextPressure.strainWarningDays = Math.max(0, pressure.strainWarningDays - 1);
    nextPressure.breakWarningDays = Math.max(0, pressure.breakWarningDays - 2);
    nextPressure.pressureDayStreak = Math.max(0, pressure.pressureDayStreak - 1);
    nextPressure.fatigueLevel = Math.max(0, pressure.fatigueLevel - 2);
    nextPressure.incidentRisk = Math.max(0, pressure.incidentRisk - 1);
    note = "The extra rest eased the strain in the RV.";
  } else if (actionId === "serviced_hookup") {
    nextPressure.recoveryMomentum = clampCounter(pressure.recoveryMomentum + 2, MOMENTUM_CAP);
    nextPressure.poorRestStreak = 0;
    nextPressure.poorChargingDays = Math.max(0, pressure.poorChargingDays - 3);
    nextPressure.energyDebt = Math.max(0, pressure.energyDebt - 2);
    nextPressure.breakWarningDays = Math.max(0, pressure.breakWarningDays - 1);
    nextPressure.fatigueLevel = Math.max(0, pressure.fatigueLevel - 1);
    note = "A plug-in night broke the run of weak rest.";
  } else if (actionId === "repair_rv") {
    nextPressure.recoveryMomentum = clampCounter(pressure.recoveryMomentum + 1, MOMENTUM_CAP);
    nextPressure.incidentRisk = Math.max(0, pressure.incidentRisk - 2);
    note = "Fixing the RV eased some of the strain.";
  } else if (
    actionId === "meal_shower" ||
    actionId === "hot_meal" ||
    actionId === "laundry_shower"
  ) {
    nextPressure.tensionWarningDays = Math.max(0, pressure.tensionWarningDays - 1);
    nextPressure.breakWarningDays = Math.max(0, pressure.breakWarningDays - 1);
    nextPressure.recoveryMomentum = clampCounter(pressure.recoveryMomentum + 1, MOMENTUM_CAP);
  }

  runState.passengerPressure = normalizePassengerPressureState(nextPressure);
  return note;
}

export function applyEventMoraleImpact(runState, moraleDelta) {
  const pressure = normalizePassengerPressureState(runState.passengerPressure);
  const nextPressure = { ...pressure };

  if (moraleDelta >= 3) {
    nextPressure.recoveryMomentum = clampCounter(pressure.recoveryMomentum + 1, MOMENTUM_CAP);
  } else if (moraleDelta <= -2) {
    nextPressure.recoveryMomentum = clampCounter(pressure.recoveryMomentum - 1, MOMENTUM_CAP);
    nextPressure.tensionWarningDays = clampCounter(pressure.tensionWarningDays + 1, WARNING_TRACK_CAP);
    nextPressure.incidentRisk = clampCounter(pressure.incidentRisk + 1, INCIDENT_RISK_CAP);
  }

  runState.passengerPressure = normalizePassengerPressureState(nextPressure);
}

export function getMoraleDescriptor(runState) {
  const pressureScore = getMoralePressureScore(runState);
  const moraleBand = getMoraleBandFromValue(getTrackedMoraleValue(runState));

  if (moraleBand === MORALE_BANDS.HIGH) {
    return pressureScore <= 1 ? "At ease" : "Upbeat";
  }

  if (moraleBand === MORALE_BANDS.STEADY) {
    return pressureScore <= 1 ? "Doing well" : "Holding up";
  }

  if (moraleBand === MORALE_BANDS.LOW) {
    return pressureScore <= 3 ? "Tense" : "Running thin";
  }

  return pressureScore <= 4 ? "Shaky" : "Worn out";
}

export function getMoralePressureSummary(runState) {
  const pressure = normalizePassengerPressureState(runState.passengerPressure);
  const moraleBand = getMoraleBandFromValue(getTrackedMoraleValue(runState));
  const pressureScore = getMoralePressureScore(runState);

  if (
    pressure.poorRestStreak >= 2 &&
    pressure.recentFrugalDays >= 2 &&
    pressure.recentPushMilesDays >= 2
  ) {
    return "Hard driving, frugal living, and poor nights are all adding strain.";
  }

  if (pressure.poorRestStreak >= 2) {
    return "Poor nights are making everyone short with each other.";
  }

  if (pressure.fatigueLevel >= 4 && pressure.breakWarningDays >= 3) {
    return "The cabin is borrowing from tomorrow now, and everyone feels it.";
  }

  if (pressure.energyDebt >= 3) {
    return "Repeated weak charging is making even simple plans feel less secure.";
  }

  if (pressure.recentPushMilesDays >= 2 && pressure.recentFrugalDays >= 2) {
    return "The riders feel both the hard drives and the frugal living plan.";
  }

  if (pressure.recentPushMilesDays >= 2) {
    return "Too many hard driving days are wearing people down.";
  }

  if (pressure.recentFrugalDays >= 2) {
    return "Too many frugal days in a row are getting old.";
  }

  if (pressure.recoveryMomentum >= 2) {
    return "A steadier stretch is helping everyone settle down.";
  }

  if (pressureScore >= 4 || moraleBand === MORALE_BANDS.BREAKING) {
    return "People need a real break soon, not just one more hard day.";
  }

  if (moraleBand === MORALE_BANDS.HIGH) {
    return "The riders are still doing well together.";
  }

  if (moraleBand === MORALE_BANDS.STEADY) {
    return "Things are steady, but the mood needs watching.";
  }

  return "Things feel tight enough that small choices matter right now.";
}

export function getMoraleWarnings(runState) {
  const pressure = normalizePassengerPressureState(runState.passengerPressure);
  const pressureScore = getMoralePressureScore(runState);
  const moraleBand = getMoraleBandFromValue(getTrackedMoraleValue(runState));
  const warnings = [];

  if (getTrackedMoraleValue(runState) <= STATUS_THRESHOLDS.lowResourcePercent) {
    warnings.push(WARNING_FLAGS.LOW_MORALE);
  }

  if (pressureScore >= 2 || moraleBand === MORALE_BANDS.LOW || moraleBand === MORALE_BANDS.BREAKING) {
    warnings.push(WARNING_FLAGS.PASSENGERS_TENSE);
  }

  if (
    pressure.recentFrugalDays >= 2 ||
    pressure.recentPushMilesDays >= 2 ||
    pressure.poorRestStreak >= 2 ||
    pressureScore >= 3 ||
    pressure.fatigueLevel >= 3 ||
    pressure.pressureDayStreak >= 2
  ) {
    warnings.push(WARNING_FLAGS.STRAIN_BUILDING);
  }

  if (
    moraleBand === MORALE_BANDS.BREAKING ||
    runState.resources.passengerMorale <= 25 ||
    pressureScore >= 5
  ) {
    warnings.push(WARNING_FLAGS.MORALE_FRAGILE);
  }

  if (
    pressure.poorRestStreak >= 2 ||
    (pressure.recentFrugalDays >= 2 && pressure.recentPushMilesDays >= 2) ||
    pressureScore >= 6 ||
    pressure.breakWarningDays >= 3 ||
    pressure.fatigueLevel >= 4
  ) {
    warnings.push(WARNING_FLAGS.REAL_BREAK_NEEDED);
  }

  return [...new Set(warnings)];
}

export function getMoralePressureScore(runState) {
  const pressure = normalizePassengerPressureState(runState.passengerPressure);
  let score = 0;

  if (pressure.recentFrugalDays >= 2) {
    score += 1;
  }

  if (pressure.recentPushMilesDays >= 2) {
    score += 1;
  }

  score += pressure.poorRestStreak;

  if (getBatteryPercent(runState) <= STATUS_THRESHOLDS.lowResourcePercent) {
    score += 1;
  }

  if (getTrackedMoraleValue(runState) <= STATUS_THRESHOLDS.morale.low) {
    score += 1;
  }

  if (getTrackedMoraleValue(runState) <= 10) {
    score += 1;
  }

  score += Math.floor(pressure.fatigueLevel / 2);
  score += Math.floor(pressure.energyDebt / 3);
  score += Math.floor(pressure.tensionWarningDays / 3);

  score -= pressure.recoveryMomentum;

  return Math.max(0, Math.min(7, score));
}

function getRestQuality(runState, context) {
  const campsiteRule =
    context.campsiteRule ?? getCampsiteRules(context.campsiteType ?? CAMPSITE_TYPES.PARTIAL_SHADE);
  let baseQuality = "steady";

  if ((Number(campsiteRule.hookupSupport) || 0) > 0 || context.hookupSupport > 0) {
    baseQuality = "strong";
  } else if (
    context.chargingBand === "poor" &&
    context.netBatteryDelta <= 0
  ) {
    baseQuality = "poor";
  } else if (
    getBatteryPercent(runState) <= STATUS_THRESHOLDS.hookupRecommendationBatteryPercent &&
    context.netBatteryDelta < 2
  ) {
    baseQuality = "poor";
  } else if (
    runState.policies.comfortPolicy === COMFORT_POLICIES.FRUGAL &&
    campsiteRule.shelter === "open"
  ) {
    baseQuality = "poor";
  } else if (
    campsiteRule.shelter === "sheltered" ||
    context.netBatteryDelta >= 4 ||
    context.chargingBand === "strong"
  ) {
    baseQuality = "good";
  }

  return shiftRestQuality(
    baseQuality,
    (Number(campsiteRule.restQualityShift) || 0) +
      (Number(context.restQualityShift) || 0) +
      getComfortRestQualityShift(runState, {
        campsiteRule,
        chargingBand: context.chargingBand,
        netBatteryDelta: context.netBatteryDelta,
        hookupSupport: context.hookupSupport
      })
  );
}

function getComfortRestQualityShift(runState, context) {
  if (runState.policies.comfortPolicy === COMFORT_POLICIES.FRUGAL) {
    if (
      context.campsiteRule.shelter === "open" ||
      context.chargingBand === "poor" ||
      context.netBatteryDelta <= 0
    ) {
      return -1;
    }

    return 0;
  }

  if (isComfortFirstPolicy(runState.policies.comfortPolicy)) {
    if (
      (Number(context.campsiteRule.hookupSupport) || 0) > 0 ||
      context.hookupSupport > 0 ||
      context.campsiteRule.shelter === "sheltered" ||
      context.chargingBand === "strong" ||
      context.netBatteryDelta >= 2
    ) {
      return 1;
    }
  }

  return 0;
}

function applyRestQualityToPressure(pressure, restQuality) {
  if (restQuality === "poor") {
    return {
      ...pressure,
      poorRestStreak: clampCounter(pressure.poorRestStreak + 1, STREAK_CAP),
      recoveryMomentum: clampCounter(pressure.recoveryMomentum - 1, MOMENTUM_CAP)
    };
  }

  if (restQuality === "strong") {
    return {
      ...pressure,
      poorRestStreak: 0,
      recoveryMomentum: clampCounter(pressure.recoveryMomentum + 2, MOMENTUM_CAP)
    };
  }

  if (restQuality === "good") {
    return {
      ...pressure,
      poorRestStreak: Math.max(0, pressure.poorRestStreak - 1),
      recoveryMomentum: clampCounter(pressure.recoveryMomentum + 1, MOMENTUM_CAP)
    };
  }

  return {
    ...pressure,
    poorRestStreak: Math.max(0, pressure.poorRestStreak - 1)
  };
}

function getChargingMoraleAdjustment(chargingBand, campsiteType) {
  if ((Number(getCampsiteRules(campsiteType).hookupSupport) || 0) > 0) {
    return 1;
  }

  if (chargingBand === "poor") {
    return -1;
  }

  if (chargingBand === "strong") {
    return 1;
  }

  return 0;
}

function getReserveStressAdjustment(runState, campsiteType, netBatteryDelta) {
  if ((Number(getCampsiteRules(campsiteType).hookupSupport) || 0) > 0) {
    return 0;
  }

  if (
    getProjectedBatteryPercent(runState, netBatteryDelta) <= STATUS_THRESHOLDS.lowResourcePercent &&
    netBatteryDelta <= 0
  ) {
    return -1;
  }

  return 0;
}

function getProjectedBatteryPercent(runState, batteryDelta) {
  const projected = Math.max(
    0,
    Math.min(
      runState.resources.batteryCapacity,
      runState.resources.batteryCharge + batteryDelta
    )
  );

  return Math.round((projected / Math.max(1, runState.resources.batteryCapacity)) * 100);
}

function isHardTravelDay(runState, drivingStyle = null) {
  const resolvedDrivingStyle =
    drivingStyle ??
    getDrivingStyleOption(runState.policies.drivingStyle ?? runState.policies.travelMode);

  return (
    resolvedDrivingStyle.travelRule?.countsAsHardDay === true ||
    runState.policies.comfortPolicy === COMFORT_POLICIES.FRUGAL
  );
}

function isComfortFirstPolicy(comfortPolicy) {
  return (
    comfortPolicy === COMFORT_POLICIES.COMFORTABLE ||
    comfortPolicy === COMFORT_POLICIES.INDULGENT
  );
}

function getBatteryPercent(runState) {
  return Math.round(
    (Math.max(0, runState.resources.batteryCharge) /
      Math.max(1, runState.resources.batteryCapacity)) *
      100
  );
}

function getTrackedMoraleValue(runState) {
  return Number(runState?.v2?.hiddenMorale ?? runState?.resources?.passengerMorale ?? 0);
}

function getMoraleBandFromValue(value) {
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

function compactNotes(notes) {
  return [...new Set(notes)].slice(0, 2);
}

function shiftRestQuality(restQuality, shift) {
  const shiftAmount = Math.trunc(Number(shift) || 0);
  const qualityOrder = ["poor", "steady", "good", "strong"];
  const currentIndex = qualityOrder.indexOf(restQuality);
  const nextIndex = Math.max(0, Math.min(qualityOrder.length - 1, currentIndex + shiftAmount));
  return qualityOrder[nextIndex] ?? restQuality;
}

function updateStreak(currentValue, active) {
  if (active) {
    return clampCounter(currentValue + 1, STREAK_CAP);
  }

  return Math.max(0, clampCounter(currentValue, STREAK_CAP) - 1);
}

function updateWarningTrack(currentValue, active) {
  if (active) {
    return clampCounter(currentValue + 1, WARNING_TRACK_CAP);
  }

  return Math.max(0, clampCounter(currentValue, WARNING_TRACK_CAP) - 1);
}

function clampCounter(value, max) {
  return Math.max(0, Math.min(max, Number(value) || 0));
}

function softenCounter(value, softCap, extraWeight) {
  const numericValue = Math.max(0, Number(value) || 0);
  if (numericValue <= softCap) {
    return numericValue;
  }

  return softCap + (numericValue - softCap) * extraWeight;
}
