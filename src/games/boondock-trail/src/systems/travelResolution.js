import { COMFORT_POLICIES } from "../constants/gameConstants.js";
import { getDrivingStyleOption } from "../state/gameContent.js";
import { buildEnergyBreakdown } from "./energyModel.js";
import { getCabinFeverResourceMultiplier } from "./coreSystems.js";
import {
  calculateTravelMoraleOutcome,
  getPressurePenaltyProfile
} from "./passengerPressure.js";
import { getActiveRouteLegModifiers } from "./routeChoiceLoop.js";

const COMFORT_TRAVEL_RULES = Object.freeze({
  [COMFORT_POLICIES.FRUGAL]: {
    waterUse: 3
  },
  [COMFORT_POLICIES.BALANCED]: {
    waterUse: 6
  },
  [COMFORT_POLICIES.COMFORTABLE]: {
    waterUse: 9
  },
  [COMFORT_POLICIES.INDULGENT]: {
    waterUse: 10
  }
});

export function calculateTravelResolution(runState) {
  const profile = calculateTravelProfile(runState);

  return {
    changes: {
      ...profile.changes
    },
    energyBreakdown: {
      ...profile.energyBreakdown
    },
    v2Changes: {
      ...profile.v2Changes
    },
    scoreContext: {
      ...profile.scoreContext
    },
    passengerPressure: profile.passengerPressure,
    headline: buildTravelHeadline(runState, profile.changes.dailyMilesDriven),
    notes: buildTravelNotes(runState, {
      changes: profile.changes,
      energyBreakdown: profile.energyBreakdown,
      v2Changes: profile.v2Changes,
      weatherNote: profile.weatherNote,
      moraleNotes: profile.moraleNotes
    })
  };
}

export function calculateTravelProfile(runState) {
  const drivingStyle = getDrivingStyleOption(
    runState.policies.drivingStyle ?? runState.policies.travelMode
  );
  const modeRule = drivingStyle.travelRule ?? {};
  const comfortRule =
    COMFORT_TRAVEL_RULES[runState.policies.comfortPolicy] ??
    COMFORT_TRAVEL_RULES[COMFORT_POLICIES.BALANCED];
  const weatherAdjustment = getWeatherTravelAdjustment(runState);
  const terrainLoad = Math.max(1, Number(runState.environment.terrainModifier) || 1);
  const legModifiers = getActiveRouteLegModifiers(runState);
  const energyBreakdown = buildEnergyBreakdown(runState, { context: "travel" });
  const pressurePenalty = getPressurePenaltyProfile(runState);
  const moraleOutcome = calculateTravelMoraleOutcome(runState, {
    weatherMorale: weatherAdjustment.morale,
    conditionMorale: 0
  });
  const baseMiles = getBaseMilesForDriveHours(drivingStyle.driveHours, modeRule);

  const dailyMilesDriven = Math.max(
    120,
    Math.round(
      (baseMiles +
        weatherAdjustment.miles +
        legModifiers.travelMilesAdjustment -
        pressurePenalty.milesPenalty) /
        terrainLoad
    )
  );
  const dailyWaterDelta =
    -Math.ceil(
      (comfortRule.waterUse +
        weatherAdjustment.waterUse +
        (Number(modeRule.waterUseAdjustment) || 0)) *
        getCabinFeverResourceMultiplier(runState)
    ) + legModifiers.waterDeltaAdjustment;
  const dailyBatteryDelta = energyBreakdown.netBatteryDelta;
  const dailyMoraleDelta =
    moraleOutcome.delta +
    legModifiers.moraleDeltaAdjustment -
    pressurePenalty.moralePenalty;
  const wasteDelta = Math.ceil(
    calculateTravelWasteDelta(runState, drivingStyle.driveHours, weatherAdjustment, modeRule) *
      getCabinFeverResourceMultiplier(runState)
  );
  const hiddenMoraleDelta = calculateHiddenMoraleTravelDelta(runState, {
    dailyBatteryDelta,
    dailyWaterDelta,
    weatherAdjustment,
    dailyMilesDriven,
    drivingStyle
  });
  const tripScoreDelta = calculateTravelTripScoreDelta(runState, {
    dailyMilesDriven,
    weatherAdjustment,
    hiddenMoraleDelta,
    drivingStyle,
    dailyMoraleDelta
  });

  return {
    driveHoursTotal: drivingStyle.driveHours,
    drivingStyle,
    changes: {
      dailyMilesDriven,
      dailyBatteryDelta,
      dailyFuelDelta: 0,
      dailyWaterDelta,
      dailyMoraleDelta,
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
    },
    energyBreakdown,
    passengerPressure: moraleOutcome.pressureState,
    weatherNote: weatherAdjustment.note,
    moraleNotes: [...moraleOutcome.notes]
  };
}

export function buildTravelOutcomeSummary(runState) {
  const changes = {
    dailyMilesDriven: runState.day.dailyMilesDriven,
    dailyBatteryDelta: runState.day.dailyBatteryDelta,
    dailyFuelDelta: runState.day.dailyFuelDelta,
    dailyWaterDelta: runState.day.dailyWaterDelta,
    dailyMoraleDelta: runState.day.dailyMoraleDelta,
    dailyConditionDelta: runState.day.dailyConditionDelta
  };
  const energyBreakdown = runState.day.energy.travel;

  return {
    headline: buildCompletedTravelHeadline(runState),
    notes: buildTravelNotes(runState, {
      changes,
      energyBreakdown,
      v2Changes: { wasteDelta: 0, hiddenMoraleDelta: 0, tripScoreDelta: 0 },
      weatherNote: getWeatherTravelAdjustment(runState).note,
      moraleNotes: []
    })
  };
}

export function buildTravelPlanSegment(profile, driveHours) {
  const totalDriveHours = Math.max(0, Number(profile?.driveHoursTotal) || 0);
  const segmentDriveHours = Math.max(0, Number(driveHours) || 0);
  const scale = totalDriveHours > 0 ? segmentDriveHours / totalDriveHours : 0;

  return {
    driveHoursAllocated: segmentDriveHours,
    driveHoursConsumed: 0,
    milesPerDriveHour:
      totalDriveHours > 0
        ? (Number(profile?.changes?.dailyMilesDriven) || 0) / totalDriveHours
        : 0,
    milesPlanned: scaleSignedValue(profile?.changes?.dailyMilesDriven, scale),
    milesConsumed: 0,
    deltasTotal: {
      dailyBatteryDelta: scaleSignedValue(profile?.changes?.dailyBatteryDelta, scale),
      dailyFuelDelta: 0,
      dailyWaterDelta: scaleSignedValue(profile?.changes?.dailyWaterDelta, scale),
      dailyCashDelta: 0,
      dailyConditionDelta: 0,
      dailyMoraleDelta: scaleSignedValue(profile?.changes?.dailyMoraleDelta, scale)
    },
    v2DeltasTotal: {
      wasteDelta: scaleSignedValue(profile?.v2Changes?.wasteDelta, scale),
      hiddenMoraleDelta: scaleSignedValue(profile?.v2Changes?.hiddenMoraleDelta, scale),
      tripScoreDelta: scaleSignedValue(profile?.v2Changes?.tripScoreDelta, scale)
    },
    appliedDeltas: {
      dailyBatteryDelta: 0,
      dailyFuelDelta: 0,
      dailyWaterDelta: 0,
      dailyCashDelta: 0,
      dailyConditionDelta: 0,
      dailyMoraleDelta: 0
    },
    appliedV2Deltas: {
      wasteDelta: 0,
      hiddenMoraleDelta: 0,
      tripScoreDelta: 0
    },
    energyTotals: scaleEnergyBreakdown(profile?.energyBreakdown, scale),
    appliedEnergy: {
      solarGain: 0,
      loadUse: 0,
      travelImpact: 0,
      hookupSupport: 0,
      hookupCashDelta: 0,
      netBatteryDelta: 0
    }
  };
}

function getWeatherTravelAdjustment(runState) {
  const weatherProfile = runState.environment.weatherProfile ?? {};
  const weatherType = typeof weatherProfile.weatherType === "string" ? weatherProfile.weatherType : "mild";
  const disruption = isWeatherDisruptionDay(runState, weatherProfile);

  const baseByWeather = {
    clear: {
      miles: 18,
      waterUse: 2,
      morale: 1,
      note: "Clear skies made the road feel easier and gave solar a good day."
    },
    marine_clouds: {
      miles: -6,
      waterUse: 0,
      morale: 0,
      note: "Marine clouds softened the charge, but the day still mostly held together."
    },
    broken_clouds: {
      miles: 4,
      waterUse: 0,
      morale: 0,
      note: "Patchy sun kept the day moving, even with charging coming and going."
    },
    overcast: {
      miles: -18,
      waterUse: 1,
      morale: -1,
      note: "Flat gray weather dulled charging and took some ease out of the day."
    },
    rain: {
      miles: -34,
      waterUse: 1,
      morale: -1,
      note: "Rain weakened charging and made the day feel slower than planned."
    },
    storm: {
      miles: -54,
      waterUse: 2,
      morale: -2,
      note: "Storm weather pressed on the drive and left little room to recover."
    },
    mild: {
      miles: 0,
      waterUse: 0,
      morale: 0,
      note: "The weather stayed mild, so the day mostly went as planned."
    }
  }[weatherType] ?? {
    miles: 0,
    waterUse: 0,
    morale: 0,
    note: "The weather stayed mild, so the day mostly followed your plan."
  };

  if (!disruption) {
    return {
      ...baseByWeather,
      disruption: false
    };
  }

  return {
    miles: baseByWeather.miles - 46,
    waterUse: baseByWeather.waterUse + 1,
    morale: baseByWeather.morale - 1,
    note: "A rough squall line shortened the day and made everything feel more careful.",
    disruption: true
  };
}

function buildTravelHeadline(runState, dailyMilesDriven) {
  if (runState.journey.milesRemaining <= dailyMilesDriven) {
    return "By dusk, the finish feels close.";
  }

  return `${dailyMilesDriven} miles fall behind you before dusk.`;
}

function buildCompletedTravelHeadline(runState) {
  if (runState.day.routeArrivalNotice?.kind === "destination") {
    return runState.day.routeArrivalNotice.title;
  }

  if (runState.day.routeArrivalNotice) {
    return runState.day.routeArrivalNotice.title;
  }

  if (runState.day.dailyMilesDriven <= 0) {
    return "The road gives up little before you stop for the day.";
  }

  return `${runState.day.dailyMilesDriven} miles fall behind you before you stop.`;
}

function buildTravelNotes(runState, { changes, energyBreakdown, v2Changes, weatherNote, moraleNotes = [] }) {
  const drivingStyle = getDrivingStyleOption(
    runState.policies.drivingStyle ?? runState.policies.travelMode
  );

  return [
    `${drivingStyle.label} carried you ${changes.dailyMilesDriven} miles and set the tone for the stop that follows.`,
    buildTravelFeelNote(drivingStyle, changes, v2Changes),
    `Electric changed by ${formatSigned(changes.dailyBatteryDelta)} today. Solar brought ${formatSigned(energyBreakdown.solarGain)} while the RV used ${formatSigned(-energyBreakdown.loadUse)} and road strain added ${formatSigned(energyBreakdown.travelImpact)}.`,
    `Water changed by ${formatSigned(changes.dailyWaterDelta)} and waste changed by ${formatSigned(v2Changes?.wasteDelta ?? 0)} on the road.`,
    buildTripScoreFeedbackNote(v2Changes),
    weatherNote,
    ...moraleNotes
  ];
}

function buildTripScoreFeedbackNote(v2Changes) {
  const tripScoreDelta = Number(v2Changes?.tripScoreDelta) || 0;

  if (tripScoreDelta > 0) {
    return "That helped the trip feel more worthwhile.";
  }

  if (tripScoreDelta < 0) {
    return "That choice made the trip harder.";
  }

  return "The drive did not move the trip score much.";
}

function calculateTravelWasteDelta(runState, driveHours, weatherAdjustment, modeRule = {}) {
  const comfortPolicy = runState.policies.comfortPolicy;
  const baseByComfort = {
    frugal: 5,
    balanced: 7,
    comfortable: 9,
    indulgent: 10
  }[comfortPolicy] ?? 4;
  const driveAdjustment = Math.max(1, Math.round((Number(driveHours) || 0) / 3));
  const heatAdjustment = weatherAdjustment.waterUse > 0 ? 1 : 0;
  const toneAdjustment = Number(modeRule.wasteAdjustment) || 0;

  return Math.max(1, baseByComfort + driveAdjustment + heatAdjustment + toneAdjustment);
}

function calculateHiddenMoraleTravelDelta(
  runState,
  { dailyBatteryDelta, dailyWaterDelta, weatherAdjustment, dailyMilesDriven, drivingStyle }
) {
  let delta = 0;

  if (weatherAdjustment.miles > 0 && dailyBatteryDelta >= 0) {
    delta += 1;
  }

  if (dailyBatteryDelta <= -6) {
    delta -= 2;
  }

  if (runState.v2.resources.water.current + dailyWaterDelta <= runState.v2.resources.water.capacity * 0.4) {
    delta -= 2;
  }

  if (runState.v2.resources.waste.current >= runState.v2.resources.waste.capacity * 0.6) {
    delta -= 2;
  }

  if (
    drivingStyle.id === "solar_first" &&
    dailyBatteryDelta >= -1 &&
    weatherAdjustment.morale >= 0
  ) {
    delta += 1;
  }

  if (drivingStyle.id === "push_miles") {
    delta -= dailyBatteryDelta <= -4 || weatherAdjustment.morale < 0 ? 8 : 6;
  }

  return delta;
}

function calculateTravelTripScoreDelta(
  runState,
  { dailyMilesDriven, weatherAdjustment, hiddenMoraleDelta, drivingStyle, dailyMoraleDelta }
) {
  let delta = 0;
  const toneSupport = Number(drivingStyle.travelRule?.tripScoreSupport) || 0;

  if (hiddenMoraleDelta > 0) {
    delta += 1;
  }

  if (toneSupport > 0 && hiddenMoraleDelta >= 0 && dailyMoraleDelta >= 0) {
    delta += 1;
  }

  if (toneSupport < 0 && (hiddenMoraleDelta < 0 || dailyMoraleDelta < 0 || weatherAdjustment.morale < 0)) {
    delta -= 1;
  }

  if (dailyMilesDriven >= 320 && drivingStyle.id !== "push_miles" && weatherAdjustment.morale > 0) {
    delta += 1;
  }

  return Math.max(-1, Math.min(2, delta));
}

function getBaseMilesForDriveHours(driveHours, modeRule = {}) {
  const speedLimitMph = 60;
  const effectiveRoadFactor = 0.8;
  const mileageEfficiency = Math.max(0.5, Number(modeRule.mileageEfficiency) || 1);

  return Math.round((Number(driveHours) || 0) * speedLimitMph * effectiveRoadFactor * mileageEfficiency);
}

function buildTravelFeelNote(drivingStyle, changes, v2Changes) {
  if (drivingStyle.id === "solar_first") {
    return changes.dailyMoraleDelta >= 0 && (v2Changes?.hiddenMoraleDelta ?? 0) >= 0
      ? "The day felt easy enough to leave a little more room for recovery."
      : "Even on an easier day, the trip still needed a steady hand.";
  }

  if (drivingStyle.id === "push_miles") {
    return changes.dailyMoraleDelta < 0 || (v2Changes?.hiddenMoraleDelta ?? 0) < 0
      ? "It was a harder push than the group really wanted."
      : "The push kept things moving, but it left less room than an easier day.";
  }

  return changes.dailyMoraleDelta >= 0
    ? "You kept things moving without wearing everyone down too badly."
    : "The day kept momentum, but you could feel a little strain by the stop.";
}

function formatComfortPolicy(comfortPolicy) {
  return {
    [COMFORT_POLICIES.FRUGAL]: "Frugal",
    [COMFORT_POLICIES.BALANCED]: "Balanced",
    [COMFORT_POLICIES.COMFORTABLE]: "Comfort-First",
    [COMFORT_POLICIES.INDULGENT]: "Comfort-First"
  }[comfortPolicy];
}

function formatSigned(value) {
  return `${value > 0 ? "+" : ""}${value}`;
}

function scaleEnergyBreakdown(energyBreakdown, scale) {
  const source = energyBreakdown ?? {};

  return {
    context: source.context ?? "travel",
    sunlightFactor: Number(source.sunlightFactor) || 0,
    solarGain: scaleSignedValue(source.solarGain, scale),
    loadUse: scaleSignedValue(source.loadUse, scale),
    travelImpact: scaleSignedValue(source.travelImpact, scale),
    hookupSupport: scaleSignedValue(source.hookupSupport, scale),
    eventAdjustment: 0,
    hookupCashDelta: 0,
    netBatteryDelta: scaleSignedValue(source.netBatteryDelta, scale),
    chargingBand: source.chargingBand ?? "fair",
    loadBand: source.loadBand ?? "moderate",
    notes: Array.isArray(source.notes) ? [...source.notes] : []
  };
}

function scaleSignedValue(value, scale) {
  return Math.round((Number(value) || 0) * (Number(scale) || 0));
}

function isWeatherDisruptionDay(runState, weatherProfile) {
  if (weatherProfile?.severity !== "severe") {
    return false;
  }

  const travelKey =
    runState.dayNumber +
    Math.floor((Number(runState.journey.milesTraveled) || 0) / 100) +
    (String(runState.v2?.currentLocation?.nodeId ?? "").length % 3);

  return travelKey % 3 === 0;
}
