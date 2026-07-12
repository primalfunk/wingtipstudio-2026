import { COMFORT_POLICIES, TRAVEL_MODES } from "../constants/gameConstants.js";

const SCORE_MAX = 10;
const RESOURCE_PENALTY_CAP = 10;
const DECISION_BASELINE = 4;
const EXPECTED_MILES_PER_DAY = 380;
const PRESSURE_SPIKE_THRESHOLD = 70;

export function createScoreState(overrides = {}) {
  const source = typeof overrides === "object" && overrides !== null ? overrides : {};
  return {
    experience: clampScore(source.experience),
    efficiency: clampScore(source.efficiency),
    resources: clampScore(source.resources ?? SCORE_MAX),
    decisions: clampScore(source.decisions ?? DECISION_BASELINE),
    baseScore: clampScore(source.baseScore),
    finalScore: clampScore(source.finalScore),
    totalDays: Math.max(0, Number(source.totalDays) || 0),
    expectedDays: Math.max(1, Number(source.expectedDays) || 0),
    resourcePenalty: Math.max(0, Number(source.resourcePenalty) || 0),
    decisionDelta: Number(source.decisionDelta) || 0,
    efficiencyPenalty: Math.max(0, Number(source.efficiencyPenalty) || 0),
    recoveryStops: Math.max(0, Number(source.recoveryStops) || 0),
    highValueGeneratedStops: Math.max(0, Number(source.highValueGeneratedStops) || 0),
    standoutGeneratedStops: Math.max(0, Number(source.standoutGeneratedStops) || 0),
    controlledRiskStops: Math.max(0, Number(source.controlledRiskStops) || 0),
    timelyRecoveryActions: Math.max(0, Number(source.timelyRecoveryActions) || 0),
    forcedFallbackNights: Math.max(0, Number(source.forcedFallbackNights) || 0),
    legendaryRunBonus: clampNumber(source.legendaryRunBonus, 0, 0.8, 0),
    legendaryRunBonusApplied: Boolean(source.legendaryRunBonusApplied),
    highValueRouteMasteryEfficiencyFloorApplied: Boolean(source.highValueRouteMasteryEfficiencyFloorApplied),
    highValueRouteMasteryEfficiencyFloor: Math.max(0, Number(source.highValueRouteMasteryEfficiencyFloor) || 0),
    finalExperienceBonusApplied: Boolean(source.finalExperienceBonusApplied),
    finalPatternBonusApplied: Boolean(source.finalPatternBonusApplied)
  };
}

export function createCabinFeverState(overrides = {}) {
  const source = typeof overrides === "object" && overrides !== null ? overrides : {};
  return {
    active: Boolean(source.active),
    turnsInBreaking: Math.max(0, Number(source.turnsInBreaking) || 0),
    recoveryCycles: Math.max(0, Number(source.recoveryCycles) || 0)
  };
}

export function createResourcePressureState(overrides = {}) {
  const source = typeof overrides === "object" && overrides !== null ? overrides : {};
  return {
    lowPower: Boolean(source.lowPower),
    lowWater: Boolean(source.lowWater),
    highWaste: Boolean(source.highWaste),
    lowPowerStops: Math.max(0, Number(source.lowPowerStops) || 0),
    lowWaterStops: Math.max(0, Number(source.lowWaterStops) || 0),
    highWasteStops: Math.max(0, Number(source.highWasteStops) || 0),
    resourceFailures: Math.max(0, Number(source.resourceFailures) || 0)
  };
}

export function createOutcomeExplainersState(overrides = {}) {
  const source = typeof overrides === "object" && overrides !== null ? overrides : {};
  return {
    recent: normalizeExplainerList(source.recent),
    major: normalizeExplainerList(source.major),
    unresolved: normalizeExplainerList(source.unresolved)
  };
}

export function normalizePressureValue(value) {
  return clampNumber(value, 0, 100, 0);
}

export function getMoraleScoreBand(hiddenMorale) {
  const value = clampNumber(hiddenMorale, 0, 100, 0);

  if (value >= 85) {
    return { id: "thriving", label: "Thriving", modifier: 1.03 };
  }

  if (value >= 65) {
    return { id: "good", label: "Good", modifier: 1 };
  }

  if (value >= 45) {
    return { id: "strained", label: "Strained", modifier: 0.94 };
  }

  if (value >= 25) {
    return { id: "fractured", label: "Fractured", modifier: 0.82 };
  }

  return { id: "breaking", label: "Breaking", modifier: 0.62 };
}

export function getCabinFeverResourceMultiplier(runState) {
  return runState?.cabinFever?.active ? 1.15 : 1;
}

export function trackStructuredOutcome(runState, outcome, context = {}) {
  ensureCoreState(runState);

  const score = runState.score;
  const v2Changes = outcome?.v2Changes ?? {};
  const tripDelta = Number(v2Changes.tripScoreDelta) || 0;
  const wasteDelta = Number(v2Changes.wasteDelta) || 0;
  const hiddenMoraleDelta = Number(v2Changes.hiddenMoraleDelta) || 0;
  const changes = outcome?.changes ?? {};
  const kind = context.kind ?? outcome?.scoreContext?.kind ?? "outcome";
  const stayType = context.stayType ?? outcome?.scoreContext?.stayType ?? "";
  const isUtilityStay = stayType === "rv_park" || stayType === "gas_station" || stayType === "town_hub";

  if (kind === "overnight") {
    applyStayExperience(score, stayType, tripDelta);
    applyGeneratedStopScore(runState, stayType);
    if (stayType === "destination" || stayType === "premium_boondock") {
      addDecisionScore(runState, 0.6);
      addOutcomeExplainer(runState, {
        id: `memorable_${stayType}`,
        category: "experience",
        tone: "positive",
        text: "A memorable overnight stop gave the trip more of the kind of story people remember.",
        weight: 3,
        major: true
      });
    } else if (stayType === "scenic_stop" || stayType === "boondock_spot") {
      addDecisionScore(runState, 0.35);
      addOutcomeExplainer(runState, {
        id: `scenic_${stayType}`,
        category: "experience",
        tone: "positive",
        text: "Choosing a place with real character made the trip feel more worth the miles.",
        weight: 2
      });
    }
  } else if (tripDelta > 0) {
    score.experience = clampScore(score.experience + Math.min(0.3, tripDelta * 0.1));
  }

  if (kind === "travel") {
    const drivingStyle = runState.policies?.drivingStyle ?? runState.policies?.travelMode;
    if (drivingStyle === TRAVEL_MODES.SOLAR_FIRST) {
      addPressure(runState, -5);
      if (normalizePressureValue(runState.pressure) >= 45) {
        addDecisionScore(runState, 0.2);
      } else {
        score.efficiencyPenalty += 0.12;
      }
    }
    if (drivingStyle === TRAVEL_MODES.PUSH_MILES) {
      const riskyPush =
        runState.resourcePressure?.lowPower ||
        runState.resourcePressure?.lowWater ||
        runState.resourcePressure?.highWaste ||
        normalizePressureValue(runState.pressure) >= 55 ||
        (Number(runState.v2?.hiddenMorale) || 0) < 45;
      addDecisionScore(runState, riskyPush ? -0.45 : 0.45);
      if (riskyPush) {
        addResourcePenalty(runState, 0.3);
        addOutcomeExplainer(runState, {
          id: "risky_push_cost",
          category: "decision",
          tone: "warning",
          text: "Pushing while the trip was already strained made the day harder to settle back down.",
          weight: 2
        });
      } else if (score.experience >= 5) {
        addDecisionScore(runState, 0.25);
        addOutcomeExplainer(runState, {
          id: "healthy_push_paid",
          category: "decision",
          tone: "positive",
          text: "Pushing from a steady place turned a good day into useful progress.",
          weight: 2
        });
      }
    }
  }

  if (kind === "event" && tripDelta > 0 && hiddenMoraleDelta >= 0) {
    score.experience = clampScore(score.experience + Math.min(0.9, tripDelta * 0.35));
  }

  if (hiddenMoraleDelta > 0 && runState.v2?.hiddenMorale < 45) {
    addDecisionScore(runState, 0.2);
  }

  if (kind === "overnight" && isUtilityStay) {
    score.recoveryStops += 1;
    score.efficiencyPenalty += stayType === "town_hub" ? 0.4 : 0.7;
    if (runState.resourcePressure?.lowPower || runState.resourcePressure?.lowWater || runState.resourcePressure?.highWaste) {
      addDecisionScore(runState, isCriticalResourceState(runState) ? -0.5 : 0.2);
    } else {
      addDecisionScore(runState, stayType === "town_hub" ? -0.2 : -0.45);
      if (score.recoveryStops > 2) {
        addResourcePenalty(runState, 0.45);
      }
    }
  }

  if (kind === "overnight" && stayType === "roadside_fallback") {
    score.forcedFallbackNights += 1;
    addDecisionScore(runState, -0.5);
    addResourcePenalty(runState, 0.6);
  }

  if (wasteDelta < 0 && getWastePercent(runState) < 80) {
    addDecisionScore(runState, getWastePercent(runState) > 45 ? 0.5 : 0.25);
    if (getWastePercent(runState) <= 65) {
      score.resourcePenalty = Math.max(0, score.resourcePenalty - 0.25);
    }
  }

  if ((Number(changes.dailyWaterDelta) || 0) < 0 && runState.resourcePressure?.lowWater) {
    addResourcePenalty(runState, 0.5);
  }

  refreshDerivedScore(runState);
}

export function updateResourcePressure(runState, options = {}) {
  ensureCoreState(runState);

  const pressure = runState.resourcePressure;
  const lowPower = getElectricPercent(runState) < 20;
  const lowWater = getWaterPercent(runState) < 35;
  const highWaste = getWastePercent(runState) > 70;

  if (lowPower && !pressure.lowPower) {
    addResourcePenalty(runState, 0.25);
    addPressure(runState, 8);
    applyHiddenMoraleDelta(runState, -7);
    addOutcomeExplainer(runState, {
      id: "low_power_warning",
      category: "resources",
      tone: "warning",
      text: "Electric ran low enough that the road started to feel less forgiving.",
      weight: 2,
      unresolved: true
    });
  }

  if (lowWater && !pressure.lowWater) {
    addResourcePenalty(runState, 0.35);
    addPressure(runState, 8);
    applyHiddenMoraleDelta(runState, -5);
    addOutcomeExplainer(runState, {
      id: "low_water_warning",
      category: "resources",
      tone: "warning",
      text: "Water ran low enough that everyone had to feel the limits a little.",
      weight: 2,
      unresolved: true
    });
  }

  if (highWaste && !pressure.highWaste) {
    addResourcePenalty(runState, 0.35);
    addPressure(runState, 8);
    applyHiddenMoraleDelta(runState, -5);
    addOutcomeExplainer(runState, {
      id: "high_waste_warning",
      category: "resources",
      tone: "warning",
      text: "Waste built up enough that it needed attention before another night.",
      weight: 2,
      unresolved: true
    });
  }

  pressure.lowPower = lowPower;
  pressure.lowWater = lowWater;
  pressure.highWaste = highWaste;

  if (options.countStop === true) {
    pressure.lowPowerStops = lowPower ? pressure.lowPowerStops + 1 : 0;
    pressure.lowWaterStops = lowWater ? pressure.lowWaterStops + 1 : 0;
    pressure.highWasteStops = highWaste ? pressure.highWasteStops + 1 : 0;
  } else {
    if (!lowPower) pressure.lowPowerStops = 0;
    if (!lowWater) pressure.lowWaterStops = 0;
    if (!highWaste) pressure.highWasteStops = 0;
  }

  updateCabinFever(runState);
  refreshDerivedScore(runState);
}

export function updatePressureForDay(runState) {
  ensureCoreState(runState);

  const drivingStyle = runState.policies?.drivingStyle ?? runState.policies?.travelMode;
  const comfortPolicy = runState.policies?.comfortPolicy;

  if (drivingStyle === TRAVEL_MODES.PUSH_MILES) {
    const pushStreak = Number(runState.passengerPressure?.recentPushMilesDays) || 0;
    const morale = Number(runState.v2?.hiddenMorale) || 0;
    const frugalPush = comfortPolicy === COMFORT_POLICIES.FRUGAL;
    const strainedPush =
      pushStreak >= 2 ||
      morale < 45 ||
      runState.resourcePressure?.lowPower ||
      runState.resourcePressure?.lowWater ||
      runState.resourcePressure?.highWaste;
    addPressure(runState, strainedPush ? (frugalPush ? 28 : 24) : frugalPush ? 20 : 18);
    applyHiddenMoraleDelta(runState, strainedPush ? (frugalPush ? -5 : -5) : frugalPush ? -4 : -3);
    if (pushStreak >= 3) {
      addDecisionScore(runState, -0.35);
      addResourcePenalty(runState, 0.25);
    }
  }

  const morale = Number(runState.v2?.hiddenMorale) || 0;
  if (morale < 45) {
    addPressure(runState, morale < 25 ? 18 : 8);
  }

  if (runState.resourcePressure?.lowPower || runState.resourcePressure?.lowWater || runState.resourcePressure?.highWaste) {
    addPressure(runState, 14);
    applyHiddenMoraleDelta(runState, -2);
  }

  if (runState.day?.overnightContext?.siteQuality === "rough") {
    addPressure(runState, 12);
    applyHiddenMoraleDelta(runState, -3);
  }

  if ((Number(runState.passengerPressure?.pressureDayStreak) || 0) >= 2) {
    applyHiddenMoraleDelta(runState, -4);
  }
}

export function processCoreDayCycle(runState) {
  ensureCoreState(runState);
  updateCabinFever(runState);
  updateResourcePressure(runState, { countStop: true });
  updatePressureForDay(runState);
  processResourceEscalations(runState);
  processPressureSpike(runState);
  refreshDerivedScore(runState);
}

export function finalizeStructuredScore(runState) {
  ensureCoreState(runState);
  const score = runState.score;
  const totalDays = Math.max(1, Number(runState.dayNumber) || 1);
  const expectedDays = deriveExpectedDays(runState);
  const daysOverExpected = Math.max(0, totalDays - expectedDays);

  score.totalDays = totalDays;
  score.expectedDays = expectedDays;
  score.efficiency = clampScore(10 - daysOverExpected * 1.5 - score.efficiencyPenalty);
  if (!score.finalExperienceBonusApplied && runState.journey?.milesRemaining <= 0 && score.experience >= 8) {
    score.finalExperienceBonusApplied = true;
    score.decisionDelta += score.experience >= 9.5 ? 1.5 : 0.4;
  }
  if (!score.finalPatternBonusApplied && runState.journey?.milesRemaining <= 0) {
    score.finalPatternBonusApplied = true;
    applyEndRunPatternBonuses(runState);
    score.efficiency = clampScore(10 - daysOverExpected * 1.5 - score.efficiencyPenalty);
  }
  refreshDerivedScore(runState);
  applyHighValueRouteMasteryEfficiencyFloor(runState, { totalDays, expectedDays });
  refreshDerivedScore(runState);
  applyLegendaryRunBonus(runState);
  refreshDerivedScore(runState);
  return score;
}

export function refreshDerivedScore(runState) {
  ensureCoreState(runState);
  const score = runState.score;
  const moraleBand = getMoraleScoreBand(runState.v2?.hiddenMorale ?? 0);

  score.resources = clampScore(9.5 - Math.min(RESOURCE_PENALTY_CAP, score.resourcePenalty));
  score.decisions = clampScore(DECISION_BASELINE + score.decisionDelta);
  score.baseScore = roundScore(
    score.experience * 0.45 +
      score.efficiency * 0.2 +
      score.resources * 0.18 +
      score.decisions * 0.17
  );
  score.finalScore = clampScore(score.baseScore * moraleBand.modifier + (Number(score.legendaryRunBonus) || 0));
}

export function getScoreFeedbackForOutcome(outcome, context = {}) {
  const messages = [];
  const tripDelta = Number(outcome?.v2Changes?.tripScoreDelta) || 0;
  const kind = context.kind ?? outcome?.scoreContext?.kind ?? "";

  if (tripDelta > 0 && kind !== "travel") {
    messages.push("That stop gave the trip something worth remembering.");
  }

  if ((Number(outcome?.changes?.dailyMilesDriven) || 0) <= 0 && kind === "event") {
    messages.push("That cost you some time on the road.");
  }

  return messages;
}

export function recordServiceAction(runState, action = {}, before = {}) {
  ensureCoreState(runState);

  const actionId = String(action.id ?? "");
  const category = String(action.category ?? "");
  const wasCritical =
    before.electricPercent < 20 || before.waterPercent < 35 || before.wastePercent > 70;
  const wasWarning =
    before.electricPercent < 35 || before.waterPercent < 45 || before.wastePercent > 55;
  const isResourceService =
    category === "service" ||
    category === "water" ||
    actionId.includes("dump") ||
    actionId.includes("fill") ||
    actionId.includes("refill") ||
    actionId.includes("charge") ||
    actionId.includes("utility");
  const isSupportService =
    Boolean(action.townId) &&
    (category === "comfort" || category === "repair" || category === "advice");

  if (!isResourceService && !isSupportService) {
    return;
  }

  runState.score.recoveryStops += 1;
  runState.score.efficiencyPenalty += actionId.includes("rv_park") ? 0.45 : 0.25;

  if (isSupportService && !isResourceService) {
    const morale = Number(runState.v2?.hiddenMorale) || 0;
    addDecisionScore(runState, morale < 65 ? 0.05 : -0.15);
    if (runState.score.recoveryStops > 5) {
      addResourcePenalty(runState, 0.15);
      addDecisionScore(runState, -0.2);
    }
    refreshDerivedScore(runState);
    return;
  }

  if (wasCritical) {
    addDecisionScore(runState, -0.35);
    addResourcePenalty(runState, 0.45);
    addPressure(runState, -4);
    addOutcomeExplainer(runState, {
      id: `late_service_${actionId}`,
      category: "decision",
      tone: "negative",
      text: "That service fixed the immediate problem, but the supplies had already gotten too tight.",
      weight: 3,
      major: true
    });
    runState.day.summaryNotes = [
      ...(runState.day.summaryNotes ?? []),
      "That solved the immediate problem, but it cost time and momentum."
    ];
  } else if (wasWarning) {
    runState.score.timelyRecoveryActions += 1;
    addDecisionScore(runState, runState.score.recoveryStops > 5 ? 0.1 : 0.3);
    if (runState.score.recoveryStops > 8) {
      addResourcePenalty(runState, 0.15);
    }
    addPressure(runState, -5);
    addOutcomeExplainer(runState, {
      id: `timely_service_${actionId}`,
      category: "decision",
      tone: "positive",
      text: "Handling service before it became a crisis helped keep the trip stable.",
      weight: 3,
      major: true
    });
    runState.day.summaryNotes = [
      ...(runState.day.summaryNotes ?? []),
      "Good timing - handling that before it became a problem helped the trip stay smooth."
    ];
  } else {
    addDecisionScore(runState, runState.score.recoveryStops > 8 ? -0.25 : -0.1);
    if (runState.score.recoveryStops > 2) {
      addResourcePenalty(runState, 0.2);
    }
  }

  refreshDerivedScore(runState);
}

export function recordStayStyleChoice(runState, styleId) {
  ensureCoreState(runState);

  const morale = Number(runState.v2?.hiddenMorale) || 0;
  const stayType = runState.day?.overnightContext?.siteCategory ?? "";
  const scenicValue = Number(runState.day?.overnightContext?.scenicValue) || 0;
  const tightResources =
    getElectricPercent(runState) < 35 || getWaterPercent(runState) < 45 || getWastePercent(runState) > 60;
  const criticalResources = isCriticalResourceState(runState);

  if (styleId === "stay_conserve") {
    addPressure(runState, morale < 45 ? 8 : 4);
    if (tightResources && morale >= 45) {
      addDecisionScore(runState, 0.2);
      addOutcomeExplainer(runState, {
        id: "conserve_tight_resources",
        category: "decision",
        tone: "positive",
        text: "Conserving supplies while everyone could handle it kept the trip steadier.",
        weight: 2
      });
    }
    if (morale < 25) {
      addDecisionScore(runState, -0.45);
      addResourcePenalty(runState, 0.25);
      addOutcomeExplainer(runState, {
        id: "conserve_breaking_morale",
        category: "morale",
        tone: "negative",
        text: "Conserving while everyone was already worn thin made the cabin feel smaller.",
        weight: 3,
        major: true
      });
    }
  }

  if (styleId === "stay_comfort") {
    addPressure(runState, criticalResources ? 4 : -6);
    if (morale < 45 && !criticalResources) {
      addDecisionScore(runState, 0.35);
      addOutcomeExplainer(runState, {
        id: "comfort_morale_recovery",
        category: "morale",
        tone: "positive",
        text: "Choosing comfort while morale was strained helped the cabin recover.",
        weight: 2,
        major: true
      });
    }
    if (
      morale < 65 &&
      !criticalResources &&
      (stayType === "premium_boondock" || stayType === "destination" || stayType === "scenic_stop" || scenicValue >= 3)
    ) {
      addDecisionScore(runState, 0.55);
    }
    if (criticalResources) {
      addDecisionScore(runState, -0.4);
      addResourcePenalty(runState, 0.35);
      addOutcomeExplainer(runState, {
        id: "comfort_critical_resources",
        category: "resources",
        tone: "negative",
        text: "Comfort helped the mood, but using it while supplies were tight made the trip harder to hold together.",
        weight: 3
      });
    }
  }

  refreshDerivedScore(runState);
}

function updateCabinFever(runState) {
  const cabinFever = runState.cabinFever;
  const hiddenMorale = Number(runState.v2?.hiddenMorale) || 0;
  const wasActive = cabinFever.active === true;

  if (hiddenMorale < 25) {
    cabinFever.turnsInBreaking += 1;
    cabinFever.recoveryCycles = 0;
    cabinFever.active = cabinFever.turnsInBreaking >= 1;
    if (!wasActive && cabinFever.active) {
      addOutcomeExplainer(runState, {
        id: "cabin_fever_triggered",
        category: "morale",
        tone: "negative",
        text: "The mood stayed low long enough that everyone needed more space than the RV could give.",
        weight: 4,
        major: true,
        unresolved: true
      });
    }
    return;
  }

  cabinFever.turnsInBreaking = 0;
  if (hiddenMorale >= 45) {
    cabinFever.recoveryCycles += 1;
    if (cabinFever.recoveryCycles >= 1) {
      cabinFever.active = false;
      if (wasActive) {
        addOutcomeExplainer(runState, {
          id: "cabin_fever_recovered",
          category: "morale",
          tone: "positive",
          text: "The mood recovered enough for the cabin to feel livable again.",
          weight: 3,
          major: true
        });
      }
    }
  } else {
    cabinFever.recoveryCycles = 0;
  }
}

function processResourceEscalations(runState) {
  const pressure = runState.resourcePressure;
  const escalations = [
    ["lowPowerStops", 2, "Power trouble forced a hard reset before the day could start."],
    ["lowWaterStops", 2, "Water rationing reached the cabin before anyone could ignore it further."],
    ["highWasteStops", 2, "Waste finally forced an unpleasant practical stop."]
  ];

  escalations.forEach(([key, stopLimit, note]) => {
    if ((Number(pressure[key]) || 0) < stopLimit) {
      return;
    }

    pressure[key] = 0;
    pressure.resourceFailures += 1;
    addResourcePenalty(runState, 1.5);
    addDecisionScore(runState, -0.4);
    addPressure(runState, 12);
    applyHiddenMoraleDelta(runState, -10);
    addOutcomeExplainer(runState, {
      id: `resource_escalation_${key}`,
      category: "resources",
      tone: "negative",
      text: `${note} It had been waiting too long to deal with.`,
      weight: 4,
      major: true
    });
    runState.resources.water = clampNumber((Number(runState.resources.water) || 0) - 4, 0, runState.resources.waterCapacity, 0);
    runState.v2.resources.water.current = runState.resources.water;
    runState.v2.resources.waste.current = clampNumber(
      (Number(runState.v2.resources.waste.current) || 0) + 8,
      0,
      runState.v2.resources.waste.capacity,
      0
    );
    runState.day.summaryNotes = [...(runState.day.summaryNotes ?? []), note, "This cannot wait much longer."];
  });
}

function processPressureSpike(runState) {
  if (normalizePressureValue(runState.pressure) < PRESSURE_SPIKE_THRESHOLD) {
    return;
  }

  runState.pressure = 20;
  addResourcePenalty(runState, 1.4);
  addDecisionScore(runState, -0.5);
  addOutcomeExplainer(runState, {
    id: "pressure_spike",
    category: "morale",
    tone: "negative",
    text: "Built-up pressure turned into a rough morning that cost the trip.",
    weight: 4,
    major: true
  });
  const drivingStyle = runState.policies?.drivingStyle ?? runState.policies?.travelMode;
  const isPush = drivingStyle === TRAVEL_MODES.PUSH_MILES;
  const isFrugalPush = isPush && runState.policies?.comfortPolicy === COMFORT_POLICIES.FRUGAL;
  applyHiddenMoraleDelta(runState, isPush ? (isFrugalPush ? -7 : -7) : -16);
  runState.resources.water = clampNumber(
    (Number(runState.resources.water) || 0) - (isPush ? (isFrugalPush ? 31 : 26) : 12),
    0,
    runState.resources.waterCapacity,
    0
  );
  runState.v2.resources.water.current = runState.resources.water;
  runState.v2.resources.waste.current = clampNumber(
    (Number(runState.v2.resources.waste.current) || 0) + (isPush ? (isFrugalPush ? 45 : 36) : 18),
    0,
    runState.v2.resources.waste.capacity,
    0
  );
  runState.journey.daysRemaining = Math.max(
    0,
    (Number(runState.journey.daysRemaining) || 0) - (isPush ? (isFrugalPush ? 2 : 3) : 1)
  );
  runState.day.summaryNotes = [
    ...(runState.day.summaryNotes ?? []),
    "The pressure in the cabin finally turned into a rough, costly morning.",
    "That cost you some time on the road."
  ];
}

function applyEndRunPatternBonuses(runState) {
  const score = runState.score;
  const hiddenMorale = Number(runState.v2?.hiddenMorale) || 0;
  const resourceFailures = Number(runState.resourcePressure?.resourceFailures) || 0;
  const unresolvedPressure =
    runState.resourcePressure?.lowPower ||
    runState.resourcePressure?.lowWater ||
    runState.resourcePressure?.highWaste;
  const recoveredResources =
    getElectricPercent(runState) >= 25 &&
    getWaterPercent(runState) >= 35 &&
    getWastePercent(runState) <= 75;
  const noHardFailure = resourceFailures === 0 && !runState.gameOver;
  const completed = runState.journey?.milesRemaining <= 0;
  const highExperience = score.experience >= 8.5;

  if (completed && score.experience < 5 && noHardFailure && recoveredResources && hiddenMorale >= 65) {
    addDecisionScore(runState, 4);
    score.resourcePenalty = Math.max(0, score.resourcePenalty - 0.7);
    score.efficiencyPenalty = Math.max(0, score.efficiencyPenalty - 0.3);
    addOutcomeExplainer(runState, {
      id: "prepared_finish",
      category: "decision",
      tone: "positive",
      text: "You reached the finish with the trip in good shape: steady mood, no crisis, and no emergency sleep.",
      weight: 4,
      major: true
    });
  }

  if (!completed || !highExperience) {
    return;
  }

  if (score.experience >= 9.5) {
    score.experience = clampScore(score.experience + 0.5);
    addDecisionScore(runState, 0.6);
    addOutcomeExplainer(runState, {
      id: "memorable_route",
      category: "experience",
      tone: "positive",
      text: "The route became memorable because you kept choosing places that were worth the miles.",
      weight: 4,
      major: true
    });
  }

  if (noHardFailure && recoveredResources && !unresolvedPressure) {
    score.resourcePenalty = Math.max(0, score.resourcePenalty - 1.4);
    addDecisionScore(runState, 0.8);
    addOutcomeExplainer(runState, {
      id: "stable_finish_resources",
      category: "resources",
      tone: "positive",
      text: "Supplies were under control at the finish, which helped the final score hold up.",
      weight: 3,
      major: true
    });
  }

  if (hiddenMorale >= 45 && score.experience >= 9) {
    addDecisionScore(runState, 0.6);
  }

  if (
    score.experience >= 8.8 &&
    hiddenMorale >= 45 &&
    recoveredResources &&
    noHardFailure &&
    !runState.cabinFever?.active &&
    score.recoveryStops <= 7
  ) {
    score.experience = clampScore(score.experience + 0.9);
    score.efficiencyPenalty = Math.max(0, score.efficiencyPenalty - 0.8);
    addDecisionScore(runState, 0.35);
    applyHiddenMoraleDelta(runState, hiddenMorale >= 58 ? 10 : 7);
    addOutcomeExplainer(runState, {
      id: "threaded_late_route",
      category: "decision",
      tone: "positive",
      text: "You took the trip close to the edge and still brought it back under control.",
      weight: 4,
      major: true
    });
  }

  if (score.experience >= 9.5 && hiddenMorale >= 45 && recoveredResources && noHardFailure && !runState.cabinFever?.active) {
    applyHiddenMoraleDelta(runState, hiddenMorale >= 58 ? 8 : 5);
    addOutcomeExplainer(runState, {
      id: "memorable_route_recovery",
      category: "morale",
      tone: "positive",
      text: "The best stops helped the trip recover enough that the hard parts did not define the finish.",
      weight: 4,
      major: true
    });
  }

  if (score.experience >= 9.5 && score.recoveryStops <= 6 && noHardFailure) {
    score.efficiencyPenalty = Math.max(0, score.efficiencyPenalty - 1);
    addDecisionScore(runState, 0.35);
    if (score.resourcePenalty >= 0.5 && score.resourcePenalty <= 3) {
      addDecisionScore(runState, 0.5);
    }
  }

  if (score.experience >= 9.5 && recoveredResources && hiddenMorale >= 65 && noHardFailure) {
    addDecisionScore(runState, 0.5);
    score.resourcePenalty = Math.max(0, score.resourcePenalty - 0.4);
  }

  if (resourceFailures > 0 || hiddenMorale < 45 || !recoveredResources) {
    addDecisionScore(runState, -0.3);
  }

  if (score.recoveryStops > 8) {
    const excessRecovery = score.recoveryStops - 8;
    addDecisionScore(runState, -0.25 * excessRecovery);
    addResourcePenalty(runState, 0.1 * excessRecovery);
  }

  if (score.recoveryStops > 10 && score.efficiency < 6) {
    addDecisionScore(runState, -0.4);
    score.efficiencyPenalty += 0.4 * (score.recoveryStops - 10);
  }

  if (score.recoveryStops > 14 && score.efficiency < 3) {
    addDecisionScore(runState, -1);
  }
}

function applyHighValueRouteMasteryEfficiencyFloor(runState, { totalDays, expectedDays }) {
  const score = runState.score;

  if (score.highValueRouteMasteryEfficiencyFloorApplied) {
    score.efficiency = Math.max(
      score.efficiency,
      Math.max(0, Number(score.highValueRouteMasteryEfficiencyFloor) || 0)
    );
    return;
  }

  if (runState.journey?.milesRemaining > 0 || runState.gameOver) {
    return;
  }

  const hiddenMorale = Number(runState.v2?.hiddenMorale) || 0;
  const daysOverExpected = Math.max(0, Number(totalDays) - Number(expectedDays));
  const qualifies =
    score.experience >= 9.5 &&
    score.decisions >= 9.5 &&
    score.resources >= 6.5 &&
    hiddenMorale >= 55 &&
    score.forcedFallbackNights === 0 &&
    score.highValueGeneratedStops >= 9 &&
    score.timelyRecoveryActions >= 5 &&
    runState.cabinFever?.active !== true;

  if (!qualifies) {
    return;
  }

  const floor = daysOverExpected <= 2 ? 3 : daysOverExpected === 3 ? 1.5 : 0;

  if (floor <= 0 || score.efficiency >= floor) {
    return;
  }

  score.efficiency = Math.max(score.efficiency, floor);
  score.highValueRouteMasteryEfficiencyFloor = floor;
  score.highValueRouteMasteryEfficiencyFloorApplied = true;
  addOutcomeExplainer(runState, {
    id: "high_value_route_mastery",
    category: "decision",
    tone: "positive",
    text: "The route took longer than a clean sprint, but the best stops, timely recovery, and strong final condition kept the trip from feeling wasteful.",
    weight: 4,
    major: true
  });
}

function applyLegendaryRunBonus(runState) {
  const score = runState.score;

  if (score.legendaryRunBonusApplied) {
    return;
  }

  if (runState.journey?.milesRemaining > 0 || runState.gameOver) {
    return;
  }

  const hiddenMorale = Number(runState.v2?.hiddenMorale) || 0;
  const hasLegendaryArc =
    score.experience >= 9.2 &&
    score.decisions >= 8.5 &&
    score.resources >= 8 &&
    hiddenMorale >= 55 &&
    !runState.cabinFever?.active &&
    score.forcedFallbackNights === 0 &&
    score.highValueGeneratedStops >= 1 &&
    score.controlledRiskStops >= 1 &&
    score.timelyRecoveryActions >= 1;

  if (!hasLegendaryArc) {
    return;
  }

  let bonus = 0.3;

  if (score.standoutGeneratedStops >= 1) {
    bonus += 0.2;
  }
  if (score.experience >= 9.8 && score.decisions >= 9.5) {
    bonus += 0.15;
  }
  if (score.resources >= 9 && hiddenMorale >= 65) {
    bonus += 0.15;
  }

  score.legendaryRunBonus = clampNumber(bonus, 0.3, 0.8, 0.3);
  score.legendaryRunBonusApplied = true;
  addOutcomeExplainer(runState, {
    id: "legendary_run_arc",
    category: "experience",
    tone: "positive",
    text: "The trip found a rare arc: memorable stops, controlled risk, timely recovery, and a strong finish.",
    weight: 5,
    major: true
  });
}

function applyStayExperience(score, stayType, tripDelta) {
  if (stayType === "destination") {
    score.experience = clampScore(score.experience + 2.8);
    return;
  }

  if (stayType === "premium_boondock") {
    score.experience = clampScore(score.experience + 2.4);
    return;
  }

  if (stayType === "scenic_stop") {
    score.experience = clampScore(score.experience + 1.9);
    return;
  }

  if (stayType === "boondock_spot") {
    score.experience = clampScore(score.experience + 1.1);
    return;
  }

  if (tripDelta > 0) {
    score.experience = clampScore(score.experience + Math.min(0.2, tripDelta * 0.08));
  }
}

function applyGeneratedStopScore(runState, stayType) {
  const stop = runState.day?.selectedGeneratedStop;
  const generatedScore = stop?.generatedScore;
  if (!generatedScore) {
    return;
  }

  const valueTier = String(stop.valueTier ?? stop.qualityTier ?? "");
  const score = runState.score;
  let experienceBonus = Number(generatedScore.experienceBonus) || 0;
  let decisionBonus = Number(generatedScore.decisionBonus) || 0;
  const resourcePenalty = Number(generatedScore.resourcePenalty) || 0;
  const efficiencyPenalty = Number(generatedScore.efficiencyPenalty) || 0;
  const scenicOrPremium =
    stayType === "premium_boondock" ||
    stayType === "scenic_stop" ||
    Number(stop.scenicValue) >= 4 ||
    valueTier === "premium" ||
    valueTier === "standout";
  const stableEnough =
    getElectricPercent(runState) >= 24 &&
    getWaterPercent(runState) >= 30 &&
    getWastePercent(runState) <= 78;
  const underPressure =
    runState.resourcePressure?.lowPower ||
    runState.resourcePressure?.lowWater ||
    runState.resourcePressure?.highWaste ||
    normalizePressureValue(runState.pressure) >= 55;
  const earlySafePremium =
    (valueTier === "premium" || valueTier === "standout") &&
    !stop.riskTags?.includes("late_day") &&
    normalizePressureValue(runState.pressure) < 20;

  if (scenicOrPremium) {
    score.highValueGeneratedStops += 1;
  }
  if (valueTier === "standout") {
    score.standoutGeneratedStops += 1;
  }

  if (earlySafePremium) {
    experienceBonus = Math.max(0, experienceBonus - 0.45);
    decisionBonus = Math.max(0, decisionBonus - 0.25);
  }

  score.experience = clampScore(score.experience + experienceBonus);
  addDecisionScore(runState, decisionBonus);
  addResourcePenalty(runState, resourcePenalty);
  score.efficiencyPenalty += efficiencyPenalty;

  if (scenicOrPremium && stop.riskTags?.includes("late_day") && stableEnough) {
    score.controlledRiskStops += 1;
    addDecisionScore(runState, valueTier === "standout" ? 0.75 : 0.35);
    addOutcomeExplainer(runState, {
      id: `controlled_generated_risk_${stop.id}`,
      category: "decision",
      tone: "positive",
      text: "You took a later, better stop without letting the trip come apart around it.",
      weight: valueTier === "standout" ? 4 : 3,
      major: valueTier === "standout"
    });
  }

  if (scenicOrPremium && stableEnough && !underPressure) {
    addDecisionScore(runState, valueTier === "standout" ? 0.25 : 0.15);
  }

  if ((valueTier === "premium" || valueTier === "standout") && stableEnough) {
    addDecisionScore(runState, valueTier === "standout" ? 0.25 : 0.1);
    score.resourcePenalty = Math.max(0, score.resourcePenalty - (valueTier === "standout" ? 0.35 : 0.2));
  }

  if (stop.serviceAccess !== "none" && underPressure && !isCriticalResourceState(runState)) {
    addDecisionScore(runState, 0.2);
    score.resourcePenalty = Math.max(0, score.resourcePenalty - 0.2);
  }

  if (valueTier === "rough" || stop.riskTags?.includes("forced")) {
    addOutcomeExplainer(runState, {
      id: `rough_generated_stop_${stop.id}`,
      category: "decision",
      tone: "negative",
      text: "Waiting too long left the night with fewer good choices.",
      weight: stop.riskTags?.includes("forced") ? 4 : 3,
      major: stop.riskTags?.includes("forced")
    });
  } else if (valueTier === "premium" || valueTier === "standout") {
    addOutcomeExplainer(runState, {
      id: `high_value_generated_stop_${stop.id}`,
      category: "experience",
      tone: "positive",
      text: "That stop gave the day a strong finish and made the miles feel more worthwhile.",
      weight: valueTier === "standout" ? 4 : 3,
      major: valueTier === "standout"
    });
  }
}

function addResourcePenalty(runState, amount) {
  runState.score.resourcePenalty = Math.max(
    0,
    (Number(runState.score.resourcePenalty) || 0) + Math.max(0, Number(amount) || 0)
  );
}

function addDecisionScore(runState, amount) {
  runState.score.decisionDelta += Number(amount) || 0;
}

function addOutcomeExplainer(runState, entry = {}) {
  runState.explainers = createOutcomeExplainersState(runState.explainers);
  const day = Math.max(1, Number(runState.dayNumber) || 1);
  const id = String(entry.id ?? entry.text ?? "").trim();
  const text = String(entry.text ?? "").trim();

  if (!id || !text) {
    return;
  }

  const normalized = {
    id: `${day}:${id}`,
    day,
    category: normalizeExplainerCategory(entry.category),
    tone: normalizeExplainerTone(entry.tone),
    text,
    weight: clampNumber(entry.weight, 1, 5, 1)
  };

  runState.explainers.recent = upsertExplainer(runState.explainers.recent, normalized, 16);

  if (entry.major === true || normalized.weight >= 3) {
    runState.explainers.major = upsertExplainer(runState.explainers.major, normalized, 24);
  }

  if (entry.unresolved === true) {
    runState.explainers.unresolved = upsertExplainer(runState.explainers.unresolved, normalized, 10);
  }
}

function normalizeExplainerList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const source = typeof entry === "object" && entry !== null ? entry : {};
      const text = String(source.text ?? "").trim();

      if (!text) {
        return null;
      }

      const day = Math.max(1, Number(source.day) || 1);
      const id = String(source.id ?? `${day}:${text}`).trim();

      return {
        id,
        day,
        category: normalizeExplainerCategory(source.category),
        tone: normalizeExplainerTone(source.tone),
        text,
        weight: clampNumber(source.weight, 1, 5, 1)
      };
    })
    .filter(Boolean);
}

function upsertExplainer(list, entry, limit) {
  const output = list.filter((item) => item.id !== entry.id);
  output.push(entry);
  return output
    .sort((left, right) => left.day - right.day || left.weight - right.weight)
    .slice(-limit);
}

function normalizeExplainerCategory(value) {
  return ["experience", "resources", "morale", "decision", "efficiency", "failure"].includes(value)
    ? value
    : "decision";
}

function normalizeExplainerTone(value) {
  return ["positive", "warning", "negative", "neutral"].includes(value) ? value : "neutral";
}

function addPressure(runState, amount) {
  runState.pressure = normalizePressureValue((Number(runState.pressure) || 0) + (Number(amount) || 0));
}

function applyHiddenMoraleDelta(runState, amount) {
  runState.v2.hiddenMorale = clampNumber((Number(runState.v2.hiddenMorale) || 0) + (Number(amount) || 0), 0, 100, 0);
  runState.resources.passengerMorale = runState.v2.hiddenMorale;
}

function deriveExpectedDays(runState) {
  const totalMiles = Math.max(1, Number(runState.journey?.totalMilesToDestination) || 1);
  return Math.max(1, Math.ceil(totalMiles / EXPECTED_MILES_PER_DAY));
}

function isCriticalResourceState(runState) {
  return getElectricPercent(runState) < 20 || getWaterPercent(runState) < 35 || getWastePercent(runState) > 70;
}

function getElectricPercent(runState) {
  const electric = runState.v2?.resources?.electric ?? {};
  return getPercent(electric.charge, electric.capacity);
}

function getWaterPercent(runState) {
  const water = runState.v2?.resources?.water ?? {};
  return getPercent(water.current, water.capacity);
}

function getWastePercent(runState) {
  const waste = runState.v2?.resources?.waste ?? {};
  return getPercent(waste.current, waste.capacity);
}

function getPercent(current, capacity) {
  return Math.round((Math.max(0, Number(current) || 0) / Math.max(1, Number(capacity) || 1)) * 100);
}

function ensureCoreState(runState) {
  runState.score = createScoreState(runState.score);
  runState.cabinFever = createCabinFeverState(runState.cabinFever);
  runState.resourcePressure = createResourcePressureState(runState.resourcePressure);
  runState.explainers = createOutcomeExplainersState(runState.explainers);
  runState.pressure = normalizePressureValue(runState.pressure);
}

function clampScore(value) {
  return roundScore(clampNumber(value, 0, SCORE_MAX, 0));
}

function roundScore(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, numeric));
}
