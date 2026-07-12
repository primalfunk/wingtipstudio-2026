import { DAY_PHASES, TRAVEL_MODES } from "../constants/gameConstants.js";
import { cloneGameState, finalizeGameState, getDerivedStatus } from "../state/gameState.js";
import { normalizeOvernightContext, OVERNIGHT_LOCATION_TYPES } from "./overnightContext.js";

const NATURAL_FEATURES = Object.freeze([
  "Alder", "Juniper", "Cottonwood", "Sage", "Willow", "Ponderosa", "Redrock", "Coyote",
  "Elk", "Raven", "Mesa", "Basin", "Canyon", "Butte", "Ridge", "Wash", "Creek",
  "Hollow", "Flats", "Springs", "Bend", "Bluff", "Draw", "Pass", "Valley", "Overlook",
  "Tamarack", "Basalt", "Foxglove", "Harbor", "Kestrel", "Pinyon", "Driftwood", "Fogline",
  "Saltgrass", "Bluewater", "Fern", "Granite", "Huckleberry", "Silt", "Timber", "Windbreak"
]);

const PLACE_NOUNS = Object.freeze([
  "Ridge", "Bench", "Hollow", "Crossing", "Wash", "Flats", "Springs", "Pullout", "Camp",
  "Meadow", "Junction", "Outpost", "Landing", "Rest", "Spur", "Turnoff", "Overlook",
  "Lot", "Yard", "Trailhead", "Viewpoint", "Sites", "Fork", "Grade", "Shelf", "Cove"
]);

const MODIFIERS = Object.freeze([
  "North", "South", "Upper", "Lower", "Old", "Little", "Dry", "Hidden", "Quiet", "High",
  "Lone", "Twin", "Painted", "Broken", "Silver", "Dusty", "Windy", "Last", "First",
  "Blue", "Cold", "Wide", "Long", "Soft", "Sheltered", "County", "Faded", "Low"
]);

const PRACTICAL_NAMES = Object.freeze([
  "Mill Road Overnight Lot", "Hawthorne Market Lot", "Old Depot Parking",
  "County Fairground Overflow", "Cedar Street Service Lot", "Harbor Road Overnight",
  "West End Market Lot", "Old Grange Overflow", "County Line Utility Yard",
  "Depot Road Pull-In", "Bayview Service Lot", "Ridge Market Overnight"
]);

const MOTEL_NAMES = Object.freeze([
  "Trail Rest Motel", "Juniper Moon Inn", "County Line Lodge", "The Blue Mesa Motor Court",
  "Harbor Light Motel", "Ponderosa Motor Inn", "Salt Road Lodge", "The Ridgeway Rooms",
  "Willow Bend Motor Court", "Old Spur Motel", "Silver Basin Lodge", "Driftwood Rooms"
]);

const STOP_TYPE_DEFINITIONS = Object.freeze({
  roadside_pullout: {
    category: "roadside_fallback",
    locationType: OVERNIGHT_LOCATION_TYPES.ROADSIDE,
    qualityTier: "rough",
    comfort: "low",
    description: "A simple pullout with just enough room to get off the road. It is not much, but it can hold the night.",
    stayLabel: "Roadside Pullout",
    serviceAccess: "none",
    waterAccess: false,
    wasteAccess: false,
    electricAccess: false,
    moraleEffect: -3,
    pressureEffect: 8,
    scenicValue: 0,
    cost: 0,
    riskTags: ["rough", "late_fallback"]
  },
  public_land_camp: {
    category: "boondock_spot",
    locationType: OVERNIGHT_LOCATION_TYPES.SCENIC_PULL_OUT,
    qualityTier: "steady",
    comfort: "medium",
    description: "A quiet patch of public land off a dirt spur. No hookups, but enough space to settle in.",
    stayLabel: "Public Land Camp",
    serviceAccess: "none",
    waterAccess: false,
    wasteAccess: false,
    electricAccess: false,
    moraleEffect: 1,
    pressureEffect: -2,
    scenicValue: 2,
    cost: 0,
    riskTags: ["off_grid"]
  },
  boondock_site: {
    category: "premium_boondock",
    locationType: OVERNIGHT_LOCATION_TYPES.SCENIC_PULL_OUT,
    qualityTier: "good",
    comfort: "medium",
    description: "A wide off-grid spot with a real view and no formal support. The place gives back if supplies can handle it.",
    stayLabel: "Boondock Stay",
    serviceAccess: "none",
    waterAccess: false,
    wasteAccess: false,
    electricAccess: false,
    moraleEffect: 2,
    pressureEffect: -4,
    scenicValue: 3,
    cost: 0,
    riskTags: ["scenic", "off_grid"]
  },
  town_lot: {
    category: "gas_station",
    locationType: OVERNIGHT_LOCATION_TYPES.SERVICE_EDGE,
    qualityTier: "practical",
    comfort: "medium",
    description: "A practical overnight lot on the edge of town. Not scenic, but close to the things that keep a trip moving.",
    stayLabel: "Town Overnight Lot",
    serviceAccess: "partial",
    waterAccess: true,
    wasteAccess: true,
    electricAccess: false,
    moraleEffect: -1,
    pressureEffect: -3,
    scenicValue: 0,
    cost: 0,
    riskTags: ["practical", "service_nearby"]
  },
  campground: {
    category: "rv_park",
    locationType: OVERNIGHT_LOCATION_TYPES.CAMPGROUND,
    qualityTier: "steady",
    comfort: "high",
    description: "A small campground with marked sites and a calmer evening shape. It costs a little, but the night would be easier.",
    stayLabel: "Campground Stay",
    serviceAccess: "full",
    waterAccess: true,
    wasteAccess: true,
    electricAccess: true,
    moraleEffect: 1,
    pressureEffect: -6,
    scenicValue: 1,
    cost: 24,
    riskTags: ["comfortable", "service"]
  },
  motel_paid: {
    category: "rv_park",
    locationType: OVERNIGHT_LOCATION_TYPES.SERVICE_EDGE,
    qualityTier: "comfortable",
    comfort: "high",
    description: "A paid stay with clean edges and practical relief. It will not be the trip's best story, but it can reset the room.",
    stayLabel: "Paid Overnight",
    serviceAccess: "full",
    waterAccess: true,
    wasteAccess: true,
    electricAccess: true,
    moraleEffect: 3,
    pressureEffect: -8,
    scenicValue: 0,
    cost: 48,
    riskTags: ["comfortable", "score_cost"]
  },
  service_stop: {
    category: "gas_station",
    locationType: OVERNIGHT_LOCATION_TYPES.SERVICE_EDGE,
    qualityTier: "practical",
    comfort: "low",
    description: "A service-capable stop with lights, pavement, and useful hookups nearby. It solves problems more than it charms anyone.",
    stayLabel: "Service-Edge Stop",
    serviceAccess: "full",
    waterAccess: true,
    wasteAccess: true,
    electricAccess: true,
    moraleEffect: -2,
    pressureEffect: -4,
    scenicValue: 0,
    cost: 12,
    riskTags: ["service", "practical"]
  },
  scenic_inconvenient: {
    category: "scenic_stop",
    locationType: OVERNIGHT_LOCATION_TYPES.SCENIC_PULL_OUT,
    qualityTier: "good",
    comfort: "low",
    description: "A scenic turnoff that asks you to give up convenience for a better view. It is memorable, but not practical.",
    stayLabel: "Scenic Turnoff",
    serviceAccess: "none",
    waterAccess: false,
    wasteAccess: false,
    electricAccess: false,
    moraleEffect: 2,
    pressureEffect: 1,
    scenicValue: 3,
    cost: 0,
    riskTags: ["scenic", "limited_support"]
  }
});

const STOP_VALUE_TIERS = Object.freeze({
  rough: {
    experienceBonus: 0,
    decisionBonus: -0.45,
    resourcePenalty: 0.45,
    efficiencyPenalty: 0.15,
    pressureEffect: 6,
    scoreUpside: 0
  },
  basic: {
    experienceBonus: 0.15,
    decisionBonus: 0,
    resourcePenalty: 0.08,
    efficiencyPenalty: 0.05,
    pressureEffect: 1,
    scoreUpside: 1
  },
  decent: {
    experienceBonus: 0.35,
    decisionBonus: 0.12,
    resourcePenalty: 0,
    efficiencyPenalty: 0.08,
    pressureEffect: -1,
    scoreUpside: 2
  },
  good: {
    experienceBonus: 0.65,
    decisionBonus: 0.25,
    resourcePenalty: 0,
    efficiencyPenalty: 0.14,
    pressureEffect: -3,
    scoreUpside: 3
  },
  premium: {
    experienceBonus: 1.2,
    decisionBonus: 0.45,
    resourcePenalty: 0.05,
    efficiencyPenalty: 0.22,
    pressureEffect: -4,
    scoreUpside: 4
  },
  standout: {
    experienceBonus: 1.8,
    decisionBonus: 0.8,
    resourcePenalty: 0.15,
    efficiencyPenalty: 0.3,
    pressureEffect: -5,
    scoreUpside: 5
  }
});

export function createGeneratedStopState() {
  return {
    options: [],
    selectedStopId: null,
    discoveryCount: 0,
    pushedPastGoodStops: false,
    forced: false
  };
}

export function getGeneratedStopOptions(runState) {
  return Array.isArray(runState.day?.generatedStops?.options)
    ? runState.day.generatedStops.options
    : [];
}

export function prepareGeneratedStopOptions(runState) {
  const nextState = cloneGameState(runState);
  nextState.day.generatedStops = {
    ...createGeneratedStopState(),
    ...(nextState.day.generatedStops ?? {}),
    options: generateStopOptions(nextState, {
      discoveryCount: nextState.day.generatedStops?.discoveryCount ?? 0
    })
  };
  nextState.currentPhase = DAY_PHASES.CAMP_DECISION;
  nextState.day.summaryNotes = [
    ...(nextState.day.summaryNotes ?? []),
    "By late afternoon, you start watching for somewhere to land."
  ];
  return finalizeGameState(nextState);
}

export function selectGeneratedStop(runState, stopId) {
  const nextState = cloneGameState(runState);
  const stop = getGeneratedStopOptions(nextState).find((entry) => entry.id === stopId) ??
    getGeneratedStopOptions(nextState)[0] ??
    buildForcedRoadsideStop(nextState);

  applyGeneratedStopToState(nextState, stop);
  return finalizeGameState(nextState);
}

export function pushPastGeneratedStops(runState) {
  const nextState = cloneGameState(runState);
  const generatedStops = {
    ...createGeneratedStopState(),
    ...(nextState.day.generatedStops ?? {})
  };
  const nextDiscoveryCount = generatedStops.discoveryCount + 1;
  const currentTime = getStopDiscoveryClockMinutes(nextState, nextDiscoveryCount);
  const derived = getDerivedStatus(nextState);
  const riskyLatePush =
    nextDiscoveryCount >= 2 &&
    (
      currentTime >= 20 * 60 ||
      (Number(nextState.pressure) || 0) >= 62 ||
      derived.electricPercent < 28 ||
      derived.waterPercent < 34 ||
      derived.wastePercent > 72
    );
  const forcedRoll = deterministicUnit(
    nextState.runId,
    nextState.dayNumber,
    nextDiscoveryCount,
    "forced_late_stop"
  );

  if (
    currentTime >= 21 * 60 ||
    nextDiscoveryCount >= 3 ||
    (riskyLatePush && forcedRoll < (nextDiscoveryCount === 2 ? 0.42 : 0.78))
  ) {
    applyLateSearchStrain(nextState, nextDiscoveryCount, { forced: true });
    applyGeneratedStopToState(nextState, buildForcedRoadsideStop(nextState));
    nextState.day.generatedStops.forced = true;
    return finalizeGameState(nextState);
  }

  const pressureGain = nextDiscoveryCount === 1 ? 12 : 24 + nextDiscoveryCount * 8;
  nextState.pressure = Math.min(100, (Number(nextState.pressure) || 0) + pressureGain);
  nextState.v2.hiddenMorale = Math.max(0, (Number(nextState.v2.hiddenMorale) || 0) - (nextDiscoveryCount === 1 ? 2 : 5));
  nextState.resources.passengerMorale = nextState.v2.hiddenMorale;
  applyLateSearchStrain(nextState, nextDiscoveryCount);
  nextState.day.generatedStops = {
    ...generatedStops,
    discoveryCount: nextDiscoveryCount,
    pushedPastGoodStops: true,
    options: generateStopOptions(nextState, { discoveryCount: nextDiscoveryCount })
  };
  nextState.day.summaryNotes = [
    ...(nextState.day.summaryNotes ?? []),
    "You keep looking, but good stops are getting harder to find."
  ];
  return finalizeGameState(nextState);
}

function applyLateSearchStrain(runState, discoveryCount, options = {}) {
  const forced = options.forced === true;
  const waterLoss = forced ? 14 + discoveryCount * 4 : discoveryCount === 1 ? 4 : 9 + discoveryCount * 3;
  const wasteGain = forced ? 18 + discoveryCount * 6 : discoveryCount === 1 ? 6 : 12 + discoveryCount * 4;
  const electricLoss = forced ? 8 : discoveryCount >= 2 ? 5 : 2;

  runState.resources.water = Math.max(0, (Number(runState.resources.water) || 0) - waterLoss);
  runState.v2.resources.water.current = runState.resources.water;
  runState.v2.resources.waste.current = Math.min(
    runState.v2.resources.waste.capacity,
    (Number(runState.v2.resources.waste.current) || 0) + wasteGain
  );
  runState.v2.resources.electric.charge = Math.max(
    0,
    (Number(runState.v2.resources.electric.charge) || 0) - electricLoss
  );
  runState.resources.batteryCharge = runState.v2.resources.electric.charge;
  runState.day.dailyWaterDelta -= waterLoss;
  runState.day.dailyWasteDelta += wasteGain;
  runState.day.dailyBatteryDelta -= electricLoss;

  if (forced) {
    runState.v2.hiddenMorale = Math.max(0, (Number(runState.v2.hiddenMorale) || 0) - 8);
    runState.resources.passengerMorale = runState.v2.hiddenMorale;
  }
}

function generateStopOptions(runState, options = {}) {
  const discoveryCount = Math.max(0, Number(options.discoveryCount) || 0);
  const style = runState.policies?.drivingStyle ?? runState.policies?.travelMode ?? TRAVEL_MODES.BALANCED;
  const endMinutes = getStopDiscoveryClockMinutes(runState, discoveryCount);
  const derived = getDerivedStatus(runState);
  const pressure = Number(runState.pressure) || 0;
  const stableResources =
    derived.electricPercent >= 35 &&
    derived.waterPercent >= 35 &&
    derived.wastePercent <= 70;
  const seedBase = [
    runState.runId,
    runState.dayNumber,
    Math.round(runState.journey?.milesTraveled ?? 0),
    style,
    discoveryCount
  ].join("|");
  const pool = buildStopTypePool({
    style,
    endMinutes,
    pressure,
    stableResources,
    warnings: derived.warnings
  });
  const count = style === TRAVEL_MODES.PUSH_MILES || endMinutes >= 20 * 60 ? 2 : 3;
  const selectedTypes = pickUnique(pool, count, seedBase);

  return selectedTypes.map((type, index) => buildGeneratedStop(runState, type, {
    index,
    seedBase,
    endMinutes,
    discoveryCount
  }));
}

function buildStopTypePool({ style, endMinutes, pressure, stableResources, warnings }) {
  const pool = [];
  const add = (type, weight) => {
    for (let index = 0; index < weight; index += 1) {
      pool.push(type);
    }
  };

  add("roadside_pullout", endMinutes >= 19 * 60 || pressure >= 65 ? 5 : 1);
  add("public_land_camp", style === TRAVEL_MODES.SOLAR_FIRST ? 4 : 3);
  add("boondock_site", stableResources ? 3 : 1);
  add("town_lot", warnings.length > 0 ? 4 : 2);
  add("campground", style === TRAVEL_MODES.PUSH_MILES ? 1 : 3);
  add("motel_paid", pressure >= 50 ? 3 : 1);
  add("service_stop", warnings.length > 0 ? 4 : 2);
  add("scenic_inconvenient", stableResources && endMinutes < 19 * 60 ? 3 : 1);

  if (stableResources && endMinutes >= 17 * 60 && endMinutes < 20 * 60 && pressure < 65) {
    add("boondock_site", 2);
    add("scenic_inconvenient", 2);
  }

  if (style === TRAVEL_MODES.PUSH_MILES || endMinutes >= 20 * 60) {
    add("roadside_pullout", 7);
    add("service_stop", 2);
  }

  if (endMinutes >= 20 * 60 || pressure >= 75) {
    add("roadside_pullout", 6);
    add("town_lot", 1);
    add("motel_paid", 1);
  }

  return pool;
}

function buildGeneratedStop(runState, type, { index, seedBase, endMinutes, discoveryCount }) {
  const definition = STOP_TYPE_DEFINITIONS[type] ?? STOP_TYPE_DEFINITIONS.roadside_pullout;
  const name = generateStopName(type, `${seedBase}|${type}|${index}`, runState);
  const late = endMinutes >= 19 * 60 || discoveryCount > 0;
  const tooLateForGoodOffGrid = endMinutes >= 20 * 60 || discoveryCount >= 2;
  const worsened = tooLateForGoodOffGrid && ["boondock_site", "scenic_inconvenient", "public_land_camp"].includes(type);
  const stopValue = resolveStopValueTier(runState, type, {
    endMinutes,
    discoveryCount,
    late,
    worsened,
    seedKey: `${seedBase}|${type}|${index}`
  });
  const category = worsened && type !== "scenic_inconvenient" ? "boondock_spot" : definition.category;
  const generatedScore = buildGeneratedScore(definition, stopValue, {
    type,
    category,
    late,
    worsened,
    discoveryCount
  });

  return {
    id: `generated_stop_${runState.dayNumber}_${discoveryCount}_${index}_${type}`,
    name,
    label: name,
    distanceMiles: 0,
    type,
    category,
    description: definition.description,
    discoveredAtTime: formatClockMinutes(endMinutes),
    discoveredAtMinutes: endMinutes,
    valueTier: stopValue,
    qualityTier: stopValue,
    quality: stopValue,
    comfort: definition.comfort,
    serviceAccess: definition.serviceAccess,
    waterAccess: definition.waterAccess,
    wasteAccess: definition.wasteAccess,
    electricAccess: definition.electricAccess,
    cost: definition.cost,
    moraleEffect: definition.moraleEffect + getTierMoraleShift(stopValue) + (late ? -1 : 0),
    pressureEffect: definition.pressureEffect + STOP_VALUE_TIERS[stopValue].pressureEffect + (late ? 3 : 0),
    riskTags: [
      ...definition.riskTags,
      stopValue,
      ...(late ? ["late_day"] : []),
      ...(stopValue === "standout" ? ["standout"] : [])
    ],
    generatedScore,
    generatedStop: true,
    generatedFromRegion: getRegionLabel(runState),
    seedKey: `${seedBase}|${type}|${index}`,
    locationType: definition.locationType,
    stayLabel: definition.stayLabel,
    siteQuality: stopValue === "rough" ? "rough" : stopValue === "basic" ? "steady" : stopValue,
    scenicValue: Math.max(0, definition.scenicValue + getTierScenicShift(stopValue) + (worsened ? -1 : 0)),
    services: {
      waterFill: definition.waterAccess,
      wasteDump: definition.wasteAccess,
      electricHookup: definition.electricAccess
    }
  };
}

function applyGeneratedStopToState(runState, stop) {
  runState.day.generatedStops = {
    ...createGeneratedStopState(),
    ...(runState.day.generatedStops ?? {}),
    selectedStopId: stop.id
  };
  runState.day.selectedGeneratedStop = stop;
  runState.pressure = Math.max(0, Math.min(100, (Number(runState.pressure) || 0) + (Number(stop.pressureEffect) || 0)));
  runState.currentPhase = DAY_PHASES.CAMP_DECISION;
  runState.v2.stay.selectedDestinationId = null;
  runState.v2.journey.currentDestinationId = null;
  runState.v2.journey.arrivalState = "arrived";
  runState.day.overnightContext = normalizeOvernightContext({
    routePointId: runState.journey.currentRoutePointId ?? null,
    sourceTag: stop.type,
    isBetweenWaypoints: true,
    locationType: stop.locationType,
    locationName: stop.name,
    locationLabel: stop.stayLabel,
    locationLead: buildLocationLead(stop),
    locationSetupLine: stop.description,
    locationFlavor: stop.description,
    quirkNotes: buildStopQuirkNotes(stop),
    availableCampsiteTypes: [],
    siteCategory: stop.category,
    siteType: stop.type,
    siteQuality: stop.siteQuality,
    solarExposure: stop.type === "boondock_site" || stop.type === "scenic_inconvenient" ? "open" : "mixed",
    weatherShelter: stop.comfort === "high" ? "high" : stop.comfort === "medium" ? "moderate" : "low",
    scenicValue: stop.scenicValue,
    services: stop.services,
    stayLabel: stop.stayLabel,
    stayLead: buildStayLead(stop),
    staySummary: stop.description,
    supportSummary: buildSupportSummary(stop),
    actionBudget: stop.serviceAccess === "full" ? 3 : stop.serviceAccess === "partial" ? 2 : 1,
    v2Effects: {
      tripScoreDelta: getStopTripScoreDelta(stop),
      hiddenMoraleDelta: stop.moraleEffect,
      wasteDelta: getStopWasteDelta(stop)
    },
    baseModifiers: {
      moraleDeltaAdjustment: stop.moraleEffect,
      restQualityShift: stop.comfort === "high" ? 1 : stop.comfort === "low" ? -1 : 0,
      cashDeltaAdjustment: stop.cost > 0 ? -stop.cost : 0,
      wasteDeltaAdjustment: stop.category === "rv_park" || stop.category === "gas_station" ? -8 : 0
    }
  }, runState);
  runState.day.summaryNotes = [
    ...(runState.day.summaryNotes ?? []),
    `${stop.name} is where the day finally lands.`
  ];
}

function buildForcedRoadsideStop(runState) {
  const seedBase = `${runState.runId}|${runState.dayNumber}|forced_roadside`;
  return {
    ...buildGeneratedStop(runState, "roadside_pullout", {
      index: 0,
      seedBase,
      endMinutes: 21 * 60 + 15,
      discoveryCount: 3
    }),
    id: `generated_forced_roadside_${runState.dayNumber}`,
    name: generateStopName("roadside_pullout", `${seedBase}|forced`, runState),
    label: generateStopName("roadside_pullout", `${seedBase}|forced`, runState),
    description: "The road finally gives you a shoulder wide enough to stop. It is a fallback, not a chosen night.",
    qualityTier: "rough",
    valueTier: "rough",
    comfort: "low",
    moraleEffect: -12,
    pressureEffect: 24,
    riskTags: ["forced", "late_fallback", "rough"],
    generatedScore: {
      experienceBonus: 0,
      decisionBonus: -1.2,
      resourcePenalty: 1.2,
      efficiencyPenalty: 0.6,
      scoreUpside: 0
    }
  };
}

function resolveStopValueTier(runState, type, { endMinutes, discoveryCount, late, worsened, seedKey }) {
  if (type === "roadside_pullout") {
    return "rough";
  }

  if (worsened || endMinutes >= 20.5 * 60) {
    if (type === "service_stop" || type === "town_lot") {
      return "basic";
    }
    return "rough";
  }

  const derived = getDerivedStatus(runState);
  const stableResources =
    derived.electricPercent >= 38 &&
    derived.waterPercent >= 40 &&
    derived.wastePercent <= 62;
  const roll = deterministicUnit(seedKey, "value_tier");

  if (type === "scenic_inconvenient" || type === "boondock_site") {
    if (stableResources && discoveryCount === 1 && roll > 0.34 && endMinutes < 19.75 * 60) {
      return "standout";
    }
    if (stableResources && roll > 0.22) {
      return "premium";
    }
    return late ? "decent" : "good";
  }

  if (type === "campground") {
    return roll > 0.78 ? "good" : "decent";
  }

  if (type === "motel_paid") {
    return roll > 0.72 ? "decent" : "basic";
  }

  if (type === "public_land_camp") {
    return stableResources && roll > 0.62 ? "good" : "decent";
  }

  if (type === "service_stop" || type === "town_lot") {
    return derived.warnings.length > 0 ? "decent" : "basic";
  }

  return "basic";
}

function buildGeneratedScore(definition, valueTier, { type, category, late, worsened, discoveryCount }) {
  const tier = STOP_VALUE_TIERS[valueTier] ?? STOP_VALUE_TIERS.basic;
  const scenicUpside =
    category === "premium_boondock" ? 0.45 :
    category === "scenic_stop" ? 0.55 :
    category === "boondock_spot" ? 0.2 :
    0;
  const utilityCost = category === "rv_park" || category === "gas_station" ? 0.08 : 0;
  const controlledRiskBonus =
    (type === "scenic_inconvenient" || type === "boondock_site") && discoveryCount > 0 && !worsened ? 0.25 : 0;

  return {
    experienceBonus: Math.max(0, tier.experienceBonus + scenicUpside - (worsened ? 0.35 : 0)),
    decisionBonus: tier.decisionBonus + controlledRiskBonus - (late && valueTier === "rough" ? 0.2 : 0),
    resourcePenalty: Math.max(0, tier.resourcePenalty + utilityCost),
    efficiencyPenalty: Math.max(0, tier.efficiencyPenalty + (late ? 0.08 : 0)),
    scoreUpside: tier.scoreUpside
  };
}

function getTierScenicShift(valueTier) {
  return {
    rough: -1,
    basic: 0,
    decent: 0,
    good: 1,
    premium: 1,
    standout: 2
  }[valueTier] ?? 0;
}

function getTierMoraleShift(valueTier) {
  return {
    rough: -1,
    basic: 0,
    decent: 0,
    good: 1,
    premium: 2,
    standout: 4
  }[valueTier] ?? 0;
}

function generateStopName(type, seedKey, runState) {
  if (type === "town_lot" || type === "service_stop") {
    return pick(PRACTICAL_NAMES, seedKey, "practical");
  }

  if (type === "motel_paid") {
    return pick(MOTEL_NAMES, seedKey, "motel");
  }

  const modifier = pick(MODIFIERS, seedKey, "modifier");
  const feature = pick(NATURAL_FEATURES, seedKey, "feature");
  const noun = pick(PLACE_NOUNS, seedKey, "noun");
  const region = getRegionLabel(runState);

  if (type === "campground") {
    return `${feature} ${noun === "Camp" ? "Bend" : noun} Campground`;
  }

  if (type === "scenic_inconvenient") {
    return `${modifier} ${feature} ${["Overlook", "Viewpoint", "Turnoff"][Math.floor(deterministicUnit(seedKey, "scenic") * 3)]}`;
  }

  if (type === "roadside_pullout") {
    return `${modifier} ${feature} ${["Pullout", "Shoulder", "Turnoff"][Math.floor(deterministicUnit(seedKey, "roadside") * 3)]}`;
  }

  if (type === "public_land_camp") {
    return `${modifier} ${feature} ${["Spur", "Wash", "Camp"][Math.floor(deterministicUnit(seedKey, "public") * 3)]}`;
  }

  if (region === "coast" && deterministicUnit(seedKey, "region") > 0.62) {
    return `${modifier} ${feature} Cove`;
  }

  return `${modifier} ${feature} ${noun}`;
}

function pickUnique(pool, count, seedBase) {
  const output = [];
  const used = new Set();
  let guard = 0;

  while (output.length < count && guard < 40) {
    guard += 1;
    const type = pool[Math.floor(deterministicUnit(seedBase, "pick", guard) * pool.length)] ?? pool[0];
    if (used.has(type) && used.size < new Set(pool).size) {
      continue;
    }
    used.add(type);
    output.push(type);
  }

  return output;
}

function pick(list, seedKey, salt) {
  return list[Math.floor(deterministicUnit(seedKey, salt) * list.length)] ?? list[0];
}

function getStopDiscoveryClockMinutes(runState, discoveryCount = 0) {
  const sessionEnd = Number(runState.day?.travelSession?.dayClockEndMinutes) || 17 * 60;
  const style = runState.policies?.drivingStyle ?? runState.policies?.travelMode;
  const styleAdjustment =
    style === TRAVEL_MODES.SOLAR_FIRST ? -45 :
    style === TRAVEL_MODES.PUSH_MILES ? 65 :
    0;
  return Math.max(15 * 60, sessionEnd + styleAdjustment + discoveryCount * 70);
}

function buildLocationLead(stop) {
  if (stop.riskTags.includes("forced")) {
    return "You are stopping because the road has gone on too long.";
  }
  if (stop.serviceAccess !== "none") {
    return "The stop is practical before it is beautiful.";
  }
  if (stop.scenicValue >= 3) {
    return "The place itself gives the evening a reason to feel worthwhile.";
  }
  return "The day has gone far enough, and this is a place where the night can land.";
}

function buildStayLead(stop) {
  return `${stop.name} appeared around ${stop.discoveredAtTime}, with ${stop.comfort} comfort and ${stop.serviceAccess} service support.`;
}

function buildSupportSummary(stop) {
  if (stop.serviceAccess === "full") {
    return "Good utility support is available here, though it costs time and opportunity.";
  }
  if (stop.serviceAccess === "partial") {
    return "Some practical support is nearby, but this is still a modest stop.";
  }
  return "No formal services here. The stop is about place, timing, and getting through the night.";
}

function buildStopQuirkNotes(stop) {
  return [
    stop.discoveredAtTime ? `Found around ${stop.discoveredAtTime}.` : null,
    stop.riskTags.includes("late_day") ? "Arriving this late narrows the options." : null,
    stop.serviceAccess !== "none" ? "Service choices should still make sense here." : "Supplies need to carry the night here."
  ].filter(Boolean);
}

function getStopTripScoreDelta(stop) {
  if (stop.riskTags.includes("forced")) {
    return -1;
  }
  if (stop.category === "premium_boondock") {
    return 3;
  }
  if (stop.category === "scenic_stop") {
    return 2;
  }
  if (stop.category === "boondock_spot") {
    return 1;
  }
  return 0;
}

function getStopWasteDelta(stop) {
  if (stop.category === "rv_park" || stop.category === "gas_station") {
    return -15;
  }
  if (stop.category === "premium_boondock" || stop.category === "scenic_stop") {
    return 10;
  }
  return 7;
}

function getRegionLabel(runState) {
  const routeId = runState.metadata?.routePresetId ?? "";
  if (routeId.includes("coast") || String(runState.journey?.routeName ?? "").toLowerCase().includes("coast")) {
    return "coast";
  }
  if (routeId.includes("basin") || routeId.includes("lakes")) {
    return "basin";
  }
  return "mesa";
}

function deterministicUnit(...parts) {
  const key = parts.join("|");
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000000) / 1000000;
}

function formatClockMinutes(totalMinutes) {
  const normalizedMinutes = Math.max(0, Math.round(Number(totalMinutes) || 0));
  const hours = Math.floor(normalizedMinutes / 60) % 24;
  const minutes = normalizedMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
