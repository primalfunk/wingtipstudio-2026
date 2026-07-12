import {
  CAMPSITE_TYPES,
  COMFORT_POLICIES
} from "../constants/gameConstants.js";
import { getCampsiteLabel, getCampsiteRules } from "../state/gameContent.js";
import { buildEnergyBreakdown } from "./energyModel.js";
import { getCabinFeverResourceMultiplier } from "./coreSystems.js";
import {
  getEffectiveOvernightModifiers,
  getOvernightContext,
  getSelectedCampsiteType
} from "./overnightContext.js";
import {
  calculateOvernightMoraleOutcome,
  getPressurePenaltyProfile,
  normalizePassengerPressureState
} from "./passengerPressure.js";

const COMFORT_OVERNIGHT_RULES = Object.freeze({
  [COMFORT_POLICIES.FRUGAL]: {
    waterDelta: -4
  },
  [COMFORT_POLICIES.BALANCED]: {
    waterDelta: -7
  },
  [COMFORT_POLICIES.COMFORTABLE]: {
    waterDelta: -10
  },
  [COMFORT_POLICIES.INDULGENT]: {
    waterDelta: -11
  }
});

export function calculateOvernightResolution(runState) {
  const overnightContext = getOvernightContext(runState);
  const effectiveModifiers = getEffectiveOvernightModifiers(runState);
  const campsiteType = getSelectedCampsiteType(runState) ?? CAMPSITE_TYPES.PARTIAL_SHADE;
  const campsiteRule = getCampsiteRules(campsiteType);
  const stayEffects = normalizeStayEffects(overnightContext?.v2Effects);
  const comfortRule =
    COMFORT_OVERNIGHT_RULES[runState.policies.comfortPolicy] ??
    COMFORT_OVERNIGHT_RULES[COMFORT_POLICIES.BALANCED];
  const energyBreakdown = buildEnergyBreakdown(runState, {
    context: "overnight",
    campsiteType
  });
  const pressurePenalty = getPressurePenaltyProfile(runState);
  const moraleOutcome = calculateOvernightMoraleOutcome(runState, {
    campsiteType,
    chargingBand: energyBreakdown.chargingBand,
    netBatteryDelta: energyBreakdown.netBatteryDelta,
    hookupSupport: energyBreakdown.hookupSupport,
    moraleAdjustment: effectiveModifiers.moraleDeltaAdjustment,
    restQualityShift: effectiveModifiers.restQualityShift
  });

  const dailyBatteryDelta = energyBreakdown.netBatteryDelta;
  const dailyWaterDelta =
    (Number(campsiteRule.waterDelta) || 0) +
    Math.floor(comfortRule.waterDelta * getCabinFeverResourceMultiplier(runState)) +
    (Number(effectiveModifiers.waterDeltaAdjustment) || 0) +
    getSiteSpecificWaterAdjustment(runState);
  const dailyMoraleDelta =
    moraleOutcome.delta -
    pressurePenalty.recoveryPenalty +
    clampMoraleMirror(stayEffects.hiddenMoraleDelta);
  const dailyCashDelta = 0;
  const dailyConditionDelta = Number(effectiveModifiers.conditionDeltaAdjustment) || 0;
  const passengerPressure = applyOvernightPressureModifiers(
    moraleOutcome.pressureState,
    effectiveModifiers.passengerPressure
  );
  const realizedStayEffects = realizeStayEffects(runState, stayEffects, {
    restQuality: moraleOutcome.restQuality,
    dailyBatteryDelta,
    chargingBand: energyBreakdown.chargingBand,
    weatherProfile: runState.environment.weatherProfile ?? {},
    site: runState.v2?.stay?.site ?? {}
  });
  const adjustedWasteDelta =
    realizedStayEffects.wasteDelta + (Number(effectiveModifiers.wasteDeltaAdjustment) || 0);
  const narrative = buildOvernightNarrative(runState, {
    overnightContext,
    restQuality: moraleOutcome.restQuality,
    dailyMoraleDelta,
    dailyBatteryDelta,
    dailyWaterDelta,
    energyBreakdown,
    v2Changes: {
      tripScoreDelta: realizedStayEffects.tripScoreDelta,
      hiddenMoraleDelta: realizedStayEffects.hiddenMoraleDelta,
      wasteDelta: scalePositiveWaste(adjustedWasteDelta, runState)
    }
  });

  return {
    changes: {
      dailyMilesDriven: 0,
      dailyBatteryDelta,
      dailyFuelDelta: 0,
      dailyWaterDelta,
      dailyMoraleDelta,
      dailyConditionDelta,
      dailyCashDelta
    },
    energyBreakdown,
    passengerPressure,
    restQuality: moraleOutcome.restQuality,
    v2Changes: {
      tripScoreDelta: realizedStayEffects.tripScoreDelta,
      hiddenMoraleDelta: realizedStayEffects.hiddenMoraleDelta,
      wasteDelta: scalePositiveWaste(adjustedWasteDelta, runState)
    },
    scoreContext: {
      kind: "overnight",
      stayType: overnightContext?.siteCategory ?? overnightContext?.locationType ?? ""
    },
    headline: buildOvernightHeadline(overnightContext, dailyBatteryDelta),
    narrative,
    notes: buildOvernightNotes(runState, {
      overnightContext,
      campsiteType,
      dailyBatteryDelta,
      dailyWaterDelta,
      dailyMoraleDelta,
      dailyCashDelta,
      dailyConditionDelta,
      v2Changes: {
        tripScoreDelta: realizedStayEffects.tripScoreDelta,
        hiddenMoraleDelta: realizedStayEffects.hiddenMoraleDelta,
        wasteDelta: scalePositiveWaste(realizedStayEffects.wasteDelta, runState)
      },
      energyBreakdown,
      moraleOutcome
    })
  };
}

function scalePositiveWaste(wasteDelta, runState) {
  const numeric = Number(wasteDelta) || 0;
  return numeric > 0 ? Math.ceil(numeric * getCabinFeverResourceMultiplier(runState)) : numeric;
}

function buildOvernightNotes(runState, details) {
  const campsiteLabel = getCampsiteLabel(details.campsiteType);
  const selectedChoice = getSelectedStayStyle(details.overnightContext);
  const actionLine = buildEveningChoiceNote(details.overnightContext, selectedChoice, details);

  return [
    actionLine,
    `${campsiteLabel} shaped the feel of the night once everything quieted down.`,
    `By morning, electric was ${formatSigned(details.dailyBatteryDelta)}, water was ${formatSigned(details.dailyWaterDelta)}, and waste was ${formatSigned(details.v2Changes?.wasteDelta ?? 0)}.`,
    buildStayScoreFeedbackNote(details.v2Changes),
    `Rest felt ${formatRestQuality(details.moraleOutcome.restQuality)}.`,
    getWeatherNote(runState, details.energyBreakdown.chargingBand, details.campsiteType),
    ...details.moraleOutcome.notes
  ].filter(Boolean);
}

function buildStayScoreFeedbackNote(v2Changes) {
  const tripScoreDelta = Number(v2Changes?.tripScoreDelta) || 0;

  if (tripScoreDelta > 0) {
    return "That stop gave the trip something worth remembering.";
  }

  if (tripScoreDelta < 0) {
    return "That choice made the trip harder.";
  }

  return "The stay kept the trip steady without moving the score much.";
}

function getWeatherNote(runState, chargingBand, campsiteType) {
  const weatherProfile = runState.environment.weatherProfile ?? {};
  if (campsiteType === CAMPSITE_TYPES.PAID_HOOKUP) {
    return "Plug-in power took some pressure off the morning.";
  }
  if (weatherProfile.severity === "severe") {
    return "Storm weather made shelter, site choice, and every watt matter more tonight.";
  }
  if (chargingBand === "poor") {
    return "Morning sun looks weak, so tonight's setup still matters.";
  }
  if (chargingBand === "strong") {
    return "Morning light looks promising if the panels can catch it.";
  }
  return "Morning charging looks fair, so the place itself mattered more tonight.";
}

function buildOvernightHeadline(overnightContext, dailyBatteryDelta) {
  const selectedChoice = getSelectedStayStyle(overnightContext)?.id ?? null;

  if (selectedChoice === "stay_normal") {
    return `${overnightContext?.locationName ?? "This stop"} goes quiet early.`;
  }
  if (selectedChoice === "stay_comfort") {
    return `${overnightContext?.locationName ?? "This stop"} feels easier to live in tonight.`;
  }
  if (selectedChoice === "stay_conserve") {
    return `${overnightContext?.locationName ?? "This stop"} stays simple through the night.`;
  }
  if (selectedChoice === "forced_roadside_sleep") {
    return "The road finally forces you to stop for the night.";
  }
  return `${overnightContext?.locationName ?? "The stop"} carries you through the night.`;
}

function getSelectedStayStyle(overnightContext) {
  return overnightContext?.actionsTaken?.find((entry) => entry.category === "stay_style") ?? null;
}

function applyOvernightPressureModifiers(pressureState, modifierPatch = {}) {
  const nextPressure = {
    ...normalizePassengerPressureState(pressureState)
  };

  for (const key of [
    "recentFrugalDays",
    "recentPushMilesDays",
    "poorRestStreak",
    "recoveryMomentum"
  ]) {
    nextPressure[key] += Number(modifierPatch?.[key]) || 0;
  }

  return normalizePassengerPressureState(nextPressure);
}

function formatComfortPolicy(comfortPolicy) {
  return {
    [COMFORT_POLICIES.FRUGAL]: "Frugal",
    [COMFORT_POLICIES.BALANCED]: "Balanced",
    [COMFORT_POLICIES.COMFORTABLE]: "Comfort-First",
    [COMFORT_POLICIES.INDULGENT]: "Comfort-First"
  }[comfortPolicy];
}

function formatRestQuality(restQuality) {
  return {
    poor: "poor",
    steady: "steady",
    good: "good",
    strong: "strong"
  }[restQuality] ?? "steady";
}

function formatSigned(value) {
  return `${value > 0 ? "+" : ""}${value}`;
}

function normalizeStayEffects(value) {
  const source = typeof value === "object" && value !== null ? value : {};

  return {
    tripScoreDelta: Number(source.tripScoreDelta) || 0,
    hiddenMoraleDelta: Number(source.hiddenMoraleDelta) || 0,
    wasteDelta: Number(source.wasteDelta) || 0
  };
}

function clampMoraleMirror(value) {
  const numericValue = Number(value) || 0;
  return Math.max(-2, Math.min(2, numericValue));
}

function realizeStayEffects(runState, stayEffects, context) {
  let tripScoreDelta = stayEffects.tripScoreDelta;
  let hiddenMoraleDelta = stayEffects.hiddenMoraleDelta;
  const wasteDelta = stayEffects.wasteDelta;
  const hiddenMorale = Number(runState.v2?.hiddenMorale) || 0;
  const weatherProfile = context.weatherProfile ?? {};
  const weatherShelter = context.site?.weatherShelter ?? "moderate";
  const siteCategory = context.site?.category ?? null;
  const siteNodeId = context.site?.nodeId ?? null;
  const scenicValue = Number(context.site?.scenicValue) || 0;
  const siteQuality = context.site?.quality ?? "steady";
  const eveningChoiceId = getSelectedStayStyle(runState.day.overnightContext)?.id ?? null;
  const priorDestinationVisits = Number(runState.v2?.history?.destinationVisitCounts?.[siteNodeId]) || 0;
  const priorHubStays = Number(runState.v2?.history?.hubStayCounts?.[siteNodeId]) || 0;

  if (hiddenMorale >= 75 && context.restQuality !== "poor") {
    tripScoreDelta += 1;
  }

  if (hiddenMorale <= 30) {
    tripScoreDelta = Math.max(0, tripScoreDelta - 1);
  }

  if (context.restQuality === "strong") {
    hiddenMoraleDelta += 1;
  } else if (context.restQuality === "poor") {
    hiddenMoraleDelta -= 1;
  }

  if (context.dailyBatteryDelta <= -4 && context.chargingBand === "poor") {
    hiddenMoraleDelta -= 1;
  }

  if (weatherProfile.weatherType === "clear" && context.chargingBand === "strong") {
    tripScoreDelta += 1;
  }

  if (weatherProfile.weatherType === "rain") {
    hiddenMoraleDelta -= weatherShelter === "high" ? 0 : 1;
  }

  if (weatherProfile.severity === "severe") {
    hiddenMoraleDelta -= weatherShelter === "high" ? 1 : 2;
    tripScoreDelta = Math.max(0, tripScoreDelta - (weatherShelter === "high" ? 0 : 1));
  }

  if (siteNodeId === "alder_bench") {
    tripScoreDelta = Math.max(1, tripScoreDelta - 1);
    hiddenMoraleDelta -= 1;
  }

  if (priorDestinationVisits > 0 && isRepeatSensitiveStay(siteCategory)) {
    const repeatPenalty = Math.min(2, priorDestinationVisits);
    tripScoreDelta = Math.max(0, tripScoreDelta - repeatPenalty);
    hiddenMoraleDelta -= repeatPenalty;
  }

  if (siteCategory === "town_hub" && priorHubStays === 0) {
    tripScoreDelta += 3;
    hiddenMoraleDelta += 1;
  }

  if (eveningChoiceId === "stay_comfort") {
    if (scenicValue >= 3 || siteQuality === "premium" || siteQuality === "good") {
      tripScoreDelta += 2;
      hiddenMoraleDelta += 2;
    } else if (scenicValue <= 0 || siteQuality === "rough" || siteQuality === "practical") {
      hiddenMoraleDelta += 1;
    } else {
      tripScoreDelta += 1;
      hiddenMoraleDelta += 1;
    }
  }

  if (eveningChoiceId === "stay_conserve") {
    hiddenMoraleDelta -= hiddenMorale <= 45 ? 2 : 0;
  }

  if (eveningChoiceId === "stay_normal" && context.restQuality === "strong") {
    hiddenMoraleDelta += 1;
  }

  return {
    tripScoreDelta,
    hiddenMoraleDelta,
    wasteDelta
  };
}

function getSiteSpecificWaterAdjustment(runState) {
  const siteNodeId = runState.v2?.stay?.site?.nodeId ?? null;

  if (siteNodeId === "alder_bench") {
    return -2;
  }

  return 0;
}

function isRepeatSensitiveStay(siteCategory) {
  return (
    siteCategory === "premium_boondock" ||
    siteCategory === "poor_boondock" ||
    siteCategory === "scenic_stop" ||
    siteCategory === "roadside_fallback"
  );
}

function buildEveningChoiceNote(overnightContext, selectedChoice, details) {
  if (!selectedChoice) {
    return "You let the place carry the night on its own.";
  }

  switch (selectedChoice.id) {
    case "stay_normal":
      return "A balanced night keeps the trip steady without asking too much of the tanks.";
    case "stay_comfort":
      return (overnightContext?.scenicValue ?? 0) >= 3
        ? "Everyone appreciated the comfortable night in a place worth lingering over."
        : "Everyone appreciated the comfortable night.";
    case "stay_conserve":
      return "The supplies lasted, but the cabin felt tense by morning.";
    case "forced_roadside_sleep":
      return "You keep driving until the night wins the argument, then pull over and sleep where you can.";
    default:
      return `You chose ${selectedChoice.label.toLowerCase()} for the night.`;
  }
}

function buildOvernightNarrative(runState, details) {
  return {
    tonight: buildTonightSceneLines(runState, details),
    morning: buildMorningOutcomeLines(details)
  };
}

function buildTonightSceneLines(runState, details) {
  const overnightContext = details.overnightContext ?? {};
  const choiceId = getSelectedStayStyle(overnightContext)?.id ?? overnightContext.actionsTaken?.[0]?.id ?? null;
  const scenicValue = Number(overnightContext.scenicValue) || 0;
  const siteQuality = overnightContext.siteQuality ?? "steady";
  const siteCategory = overnightContext.siteCategory ?? "";
  const weatherType = runState.environment.weatherProfile?.weatherType ?? "";
  const weatherShelter = overnightContext.weatherShelter ?? "moderate";
  const lines = [];

  switch (choiceId) {
    case "stay_normal":
      lines.push("You get leveled out, put a few things in place, and let the evening go quiet.");
      break;
    case "stay_comfort":
      lines.push("You use the RV more freely tonight: real cleanup, easier routines, and fewer small refusals.");
      break;
    case "stay_conserve":
      lines.push("You keep the night small: an easy setup, not much fuss, and an early turn inward.");
      break;
    case "forced_roadside_sleep":
      lines.push("You pull off where the shoulder finally gives you room, shut things down fast, and make do with whatever rest the roadside allows.");
      break;
    default:
      lines.push("You get parked, set up for the night, and let the road finally go still.");
      break;
  }

  if (weatherType === "rain") {
    lines.push(
      weatherShelter === "high"
        ? "Once the doors are shut, the place feels sheltered enough to settle into."
        : "The weather keeps you moving with a little more purpose than usual."
    );
  } else if (choiceId === "stay_comfort" && (scenicValue >= 3 || siteQuality === "premium" || siteQuality === "good")) {
    lines.push("The stop gives you a real reason to stay outside for a while longer than planned.");
  } else if (siteCategory === "gas_station" || overnightContext.locationType === "service_edge") {
    lines.push("It is a practical stop, but the lights and nearby help make the night easier to manage.");
  } else if (choiceId === "forced_roadside_sleep") {
    lines.push("No one is pretending this is a good stop. It is simply where the drive had to end.");
  } else if (siteQuality === "rough" || siteCategory === "roadside_fallback") {
    lines.push("It is not much to look at, but it holds well enough once everything is in place.");
  } else if (weatherShelter === "high") {
    lines.push("Once the engine is off, the place feels more sheltered than it did on the way in.");
  } else {
    lines.push("The place is quiet enough to let everyone come down from the day.");
  }

  return lines.slice(0, 2);
}

function buildMorningOutcomeLines(details) {
  const overnightContext = details.overnightContext ?? {};
  const choiceId = getSelectedStayStyle(overnightContext)?.id ?? overnightContext.actionsTaken?.[0]?.id ?? null;
  const restQuality = details.restQuality ?? "steady";
  const tripScoreDelta = Number(details.v2Changes?.tripScoreDelta) || 0;
  const moraleDelta = Number(details.dailyMoraleDelta) || 0;
  const lines = [];

  if (choiceId === "forced_roadside_sleep") {
    lines.push("Morning comes heavy, and everyone feels the cost of pushing too far before finally stopping.");
  } else if (restQuality === "strong" || moraleDelta >= 2) {
    lines.push("Morning comes a little easier, and everyone feels more steady heading into the day.");
  } else if (restQuality === "poor" || moraleDelta <= -2) {
    lines.push("Morning starts a little tight, and no one feels especially refreshed.");
  } else {
    lines.push("By morning, the group feels steady enough to get moving again.");
  }

  if (choiceId === "stay_comfort" && tripScoreDelta > 0) {
    lines.push("The stop ends up feeling worth the drive, not just useful.");
  } else if (choiceId === "stay_conserve") {
    lines.push("Nothing dramatic changed, but the low-key night kept things from getting tighter.");
  } else if (choiceId === "stay_normal") {
    lines.push("Starting early and keeping the night calm leaves a little more room in everyone.");
  } else if (choiceId === "forced_roadside_sleep") {
    lines.push("It is the kind of night that makes a proper stop feel worth protecting next time.");
  }

  return lines.slice(0, 2);
}
