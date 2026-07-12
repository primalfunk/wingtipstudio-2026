import { CAMPSITE_TYPES } from "../constants/gameConstants.js";
import {
  campsiteOptions,
  getAvailableCampsiteOptionsForLocation
} from "../state/gameContent.js";
import { getV2JourneyNode } from "../state/v2JourneyGraph.js";
import { buildRouteProgressSummary, getCurrentRoutePoint } from "./routeProgress.js";
import { getActiveRouteLegModifiers } from "./routeChoiceLoop.js";

export const OVERNIGHT_LOCATION_TYPES = Object.freeze({
  CAMPGROUND: "campground",
  SERVICE_EDGE: "service_edge",
  ROADSIDE: "roadside",
  SCENIC_PULL_OUT: "scenic_pullout"
});

export const DEFAULT_EVENING_ACTION_BUDGET = 1;

const DEFAULT_V2_STAY_EFFECTS = Object.freeze({
  tripScoreDelta: 0,
  hiddenMoraleDelta: 0,
  wasteDelta: 0
});

const OVERNIGHT_MODIFIER_KEYS = Object.freeze([
  "loadAdjustment",
  "solarFactorAdjustment",
  "hookupSupportAdjustment",
  "hookupCashAdjustment",
  "waterDeltaAdjustment",
  "wasteDeltaAdjustment",
  "cashDeltaAdjustment",
  "moraleDeltaAdjustment",
  "conditionDeltaAdjustment",
  "restQualityShift"
]);

const OVERNIGHT_PRESSURE_KEYS = Object.freeze([
  "recentFrugalDays",
  "recentPushMilesDays",
  "poorRestStreak",
  "recoveryMomentum"
]);

const LOCATION_COPY = Object.freeze({
  [OVERNIGHT_LOCATION_TYPES.CAMPGROUND]: {
    label: "Campground Night",
    lead: "A marked stop gives the evening a little more order.",
    setupLine:
      "Marked pads and the low sounds of other rigs make the night feel more settled.",
    flavor:
      "There is enough structure here to settle in well, even if the night still asks for tradeoffs.",
    quirkNotes: [
      "Plug-in spots are likelier here than out on the shoulder.",
      "Traveler notes and posted rules can sometimes help tomorrow."
    ],
    baselineModifiers: {
      restQualityShift: 1
    }
  },
  [OVERNIGHT_LOCATION_TYPES.SERVICE_EDGE]: {
    label: "Service-Edge Night",
    lead: "You are close to help, even if the night is still mostly your own.",
    setupLine:
      "There is more practical help nearby than comfort, but that may be enough tonight.",
    flavor:
      "The evening feels more practical here, with help closer by if you need it.",
    quirkNotes: [
      "Utility help is closer than usual here.",
      "Plug-in spots may be available, but they are rarely free."
    ],
    baselineModifiers: {}
  },
  [OVERNIGHT_LOCATION_TYPES.ROADSIDE]: {
    label: "Roadside Night",
    lead: "This is a make-do stop between named places.",
    setupLine:
      "Everything about the stop feels temporary, from the ground under the tires to the quiet you can hope for.",
    flavor:
      "The road is still close enough to hear. Tonight is about making the best of what you have.",
    quirkNotes: [
      "Options are simpler here than at a formal stop.",
      "A calm evening matters more when the setup is improvised."
    ],
    baselineModifiers: {
      restQualityShift: -1,
      moraleDeltaAdjustment: -1
    }
  },
  [OVERNIGHT_LOCATION_TYPES.SCENIC_PULL_OUT]: {
    label: "Scenic Pullout",
    lead: "The place itself does some of the work tonight, even if it cannot refill a tank or steady a battery.",
    setupLine:
      "The view gives the night something good, even when practical help stays thin.",
    flavor:
      "The stop feels like a real place, but it still asks you to get by with less support.",
    quirkNotes: [
      "The evening can feel kinder here than a plain roadside pull-in.",
      "Formal services are thinner, but the place can still give the cabin a little room."
    ],
    baselineModifiers: {
      moraleDeltaAdjustment: 1
    }
  }
});

const DESTINATION_STAY_PROFILES = Object.freeze({
  town_hub: {
    stayLabel: "Town Stay",
    stayLead: "A practical night anchored in a real coastal town rather than improvised along the road.",
    staySummary:
      "Town is where the trip regroups: steadier utility access and a cleaner reset than most off-grid stops.",
    supportSummary:
      "Good for recovery and planning, and usually steadier than stopping short on the shoulder.",
    actionBudget: 3,
    autoCampsiteType: CAMPSITE_TYPES.PAID_HOOKUP,
    baseModifiers: {
      waterDeltaAdjustment: 2,
      restQualityShift: 1
    },
    v2Effects: {
      tripScoreDelta: 1,
      hiddenMoraleDelta: 0,
      wasteDelta: -20
    }
  },
  boondock_spot: {
    stayLabel: "Boondock Stay",
    stayLead: "An off-grid stop chosen for place first and infrastructure second.",
    staySummary:
      "This is a solid off-grid stay: modest support, real scenery, and a better trip when the stop lands well.",
    supportSummary:
      "Good for score and trip feel when conditions hold, but still light on formal utility help.",
    actionBudget: 3,
    autoCampsiteType: CAMPSITE_TYPES.PARTIAL_SHADE,
    baseModifiers: {
      moraleDeltaAdjustment: 1
    },
    v2Effects: {
      tripScoreDelta: 3,
      hiddenMoraleDelta: 1,
      wasteDelta: 10
    }
  },
  premium_boondock: {
    stayLabel: "Premium Boondock Stay",
    stayLead: "An off-grid bluff or shelf where the place itself does most of the work.",
    staySummary:
      "Strong scenery and open sky make this the kind of stop the trip is built around, as long as the weather holds.",
    supportSummary:
      "Great for score, strong for trip feel, and often kind to solar. Utility help stays thin.",
    actionBudget: 3,
    autoCampsiteType: CAMPSITE_TYPES.OPEN_SUN,
    baseModifiers: {
      moraleDeltaAdjustment: 2,
      restQualityShift: 1
    },
    v2Effects: {
      tripScoreDelta: 4,
      hiddenMoraleDelta: 1,
      wasteDelta: 12
    }
  },
  poor_boondock: {
    stayLabel: "Rough Boondock Stay",
    stayLead: "An off-grid stop that makes you earn the view and forgive the setup.",
    staySummary:
      "Still off-grid, but weaker in shelter and comfort. It can keep the trip moving without giving much back.",
    supportSummary:
      "Some score, weaker trip feel, and little utility help. Exposure matters more here than at a stronger stop.",
    actionBudget: 1,
    autoCampsiteType: CAMPSITE_TYPES.PARTIAL_SHADE,
    baseModifiers: {
      moraleDeltaAdjustment: -2,
      restQualityShift: -1,
      loadAdjustment: 1
    },
    v2Effects: {
      tripScoreDelta: 1,
      hiddenMoraleDelta: -3,
      wasteDelta: 11
    }
  },
  rv_park: {
    stayLabel: "RV Park Stay",
    stayLead: "A practical overnight with steady infrastructure and very little mystery.",
    staySummary:
      "This is where you reset more than you linger. Utilities matter more than scenery here.",
    supportSummary:
      "Best for electric and water recovery, decent for shelter, but not as strong for the trip's best memories.",
    actionBudget: 1,
    autoCampsiteType: CAMPSITE_TYPES.PAID_HOOKUP,
    baseModifiers: {
      waterDeltaAdjustment: 3,
      restQualityShift: 1
    },
    v2Effects: {
      tripScoreDelta: 1,
      hiddenMoraleDelta: 0,
      wasteDelta: -30
    }
  },
  gas_station: {
    stayLabel: "Utility Stop Stay",
    stayLead: "A practical service-edge stop where help is nearby and atmosphere is not.",
    staySummary:
      "This kind of stop keeps things moving, but it is not the sort of place the trip will remember fondly.",
    supportSummary:
      "Useful for water and waste support, weak for score, and rarely a favorite stop.",
    actionBudget: 1,
    autoCampsiteType: CAMPSITE_TYPES.PAID_HOOKUP,
    baseModifiers: {
      waterDeltaAdjustment: 2,
      moraleDeltaAdjustment: -1
    },
    v2Effects: {
      tripScoreDelta: 0,
      hiddenMoraleDelta: -2,
      wasteDelta: -35
    }
  },
  scenic_stop: {
    stayLabel: "Scenic Stop Stay",
    stayLead: "A place you chose because the coast asked for a pause, not because it promised support.",
    staySummary:
      "The setting can carry the stay, but practical support stays light and recovery is limited.",
    supportSummary:
      "Good for a modest score and a better feeling landing. Utilities stay limited.",
    actionBudget: 1,
    autoCampsiteType: CAMPSITE_TYPES.PARTIAL_SHADE,
    baseModifiers: {
      moraleDeltaAdjustment: 1
    },
    v2Effects: {
      tripScoreDelta: 2,
      hiddenMoraleDelta: 0,
      wasteDelta: 9
    }
  },
  destination: {
    stayLabel: "Headland Stay",
    stayLead: "A destination worthy of the drive, where the place itself validates the effort.",
    staySummary:
      "This kind of stop works like a strong off-grid finale: scenic, exposed, and worth it if the RV handles it well.",
    supportSummary:
      "Strong score, strong trip feel, and very little formal support.",
    actionBudget: 1,
    autoCampsiteType: CAMPSITE_TYPES.OPEN_SUN,
    baseModifiers: {
      moraleDeltaAdjustment: 2,
      restQualityShift: 1
    },
    v2Effects: {
      tripScoreDelta: 5,
      hiddenMoraleDelta: 1,
      wasteDelta: 14
    }
  },
  route_connector: {
    stayLabel: "Connector Stop",
    stayLead: "A progression stop that keeps the coastal run coherent more than cozy.",
    staySummary:
      "This is a continue point first. It can hold the night, but it is not meant to compete with the better stays.",
    supportSummary:
      "Minimal score, steady mood, and enough structure to move the trip onward.",
    actionBudget: 1,
    autoCampsiteType: CAMPSITE_TYPES.PARTIAL_SHADE,
    baseModifiers: {},
    v2Effects: {
      tripScoreDelta: 0,
      hiddenMoraleDelta: 0,
      wasteDelta: 7
    }
  },
  roadside_fallback: {
    stayLabel: "Roadside Fallback",
    stayLead: "A make-do overnight chosen because the road won the argument for tonight.",
    staySummary:
      "This is the fallback stop: enough to get off the road, not enough to feel like a reward for the day.",
    supportSummary:
      "Weak for score, rough on trip feel, and usually only worth it as a fallback.",
    actionBudget: 1,
    autoCampsiteType: CAMPSITE_TYPES.PARTIAL_SHADE,
    baseModifiers: {
      moraleDeltaAdjustment: -2,
      restQualityShift: -2,
      loadAdjustment: 1
    },
    v2Effects: {
      tripScoreDelta: -1,
      hiddenMoraleDelta: -5,
      wasteDelta: 11
    }
  },
  default: {
    stayLabel: "Coastal Stay",
    stayLead: "A specific place on the route where the RV settles according to what the stop can actually offer.",
    staySummary:
      "The stop is serviceable, but what it is matters more than any generic camp routine.",
    supportSummary:
      "Moderate support, modest score potential, and a plain overnight.",
    actionBudget: 1,
    autoCampsiteType: CAMPSITE_TYPES.PARTIAL_SHADE,
    baseModifiers: {},
    v2Effects: {
      tripScoreDelta: 1,
      hiddenMoraleDelta: 0,
      wasteDelta: 7
    }
  }
});

export function createEmptyOvernightModifiers(overrides = {}) {
  const source = typeof overrides === "object" && overrides !== null ? overrides : {};
  const modifiers = Object.fromEntries(
    OVERNIGHT_MODIFIER_KEYS.map((key) => [key, Number(source[key]) || 0])
  );

  return {
    ...modifiers,
    passengerPressure: normalizeOvernightPressureAdjustment(source.passengerPressure)
  };
}

export function normalizeOvernightModifiers(value) {
  return createEmptyOvernightModifiers(value);
}

export function mergeOvernightModifiers(...modifierSets) {
  const merged = createEmptyOvernightModifiers();

  for (const modifierSet of modifierSets) {
    const next = normalizeOvernightModifiers(modifierSet);

    for (const key of OVERNIGHT_MODIFIER_KEYS) {
      merged[key] += next[key];
    }

    for (const key of OVERNIGHT_PRESSURE_KEYS) {
      merged.passengerPressure[key] += next.passengerPressure[key];
    }
  }

  return merged;
}

export function applyOvernightModifierPatch(currentModifiers, modifierPatch = {}) {
  const nextModifiers = mergeOvernightModifiers(currentModifiers, modifierPatch);
  Object.assign(currentModifiers, nextModifiers);
  return currentModifiers;
}

export function getOvernightContext(runState) {
  return typeof runState?.day?.overnightContext === "object" && runState.day.overnightContext !== null
    ? runState.day.overnightContext
    : null;
}

export function getEffectiveOvernightModifiers(runState) {
  const overnightContext = getOvernightContext(runState);
  return mergeOvernightModifiers(
    overnightContext?.baseModifiers,
    overnightContext?.modifiers
  );
}

export function getSelectedCampsiteType(runState) {
  return getOvernightContext(runState)?.selectedCampsiteType ?? runState?.policies?.selectedCampsiteType ?? null;
}

export function setSelectedCampsiteTypeOnState(runState, campsiteType) {
  const nextType =
    campsiteType === null
      ? null
      : campsiteOptions.find((entry) => entry.id === campsiteType)?.id ?? null;

  if (runState.day?.overnightContext) {
    runState.day.overnightContext.selectedCampsiteType = nextType;
  }

  // Retained as a compatibility mirror for older helpers and event data.
  runState.policies.selectedCampsiteType = nextType;
  return nextType;
}

export function buildOvernightSiteContext(runState) {
  const routeSummary = buildRouteProgressSummary(runState.journey);
  const currentPoint = getCurrentRoutePoint(runState.journey);
  const activeLegModifiers = getActiveRouteLegModifiers(runState);
  const selectedDestinationId = normalizeDestinationNodeId(runState.v2?.stay?.selectedDestinationId);
  const selectedDestinationNode = getV2JourneyNode(selectedDestinationId);
  const useSelectedDestination =
    selectedDestinationNode !== null &&
    selectedDestinationNode.locationType !== "town_hub" &&
    runState.v2?.journey?.arrivalState !== "not_arrived";
  const activeNode = useSelectedDestination
    ? selectedDestinationNode
    : getV2JourneyNode(currentPoint?.id);
  const locationType =
    useSelectedDestination
      ? mapDestinationNodeToOvernightLocationType(selectedDestinationNode)
      : activeLegModifiers.overnightLocationType ??
        resolveOvernightLocationType(routeSummary, currentPoint);
  const locationCopy = LOCATION_COPY[locationType] ?? LOCATION_COPY[OVERNIGHT_LOCATION_TYPES.ROADSIDE];
  const sourceTag = useSelectedDestination ? selectedDestinationNode.category : currentPoint?.tag ?? null;
  const stayProfile = resolveDestinationStayProfile(activeNode, locationType);
  const availableCampsiteTypes = [stayProfile.autoCampsiteType].filter(Boolean);

  return {
    routePointId: useSelectedDestination ? selectedDestinationNode.id : currentPoint?.id ?? null,
    sourceTag,
    isBetweenWaypoints: useSelectedDestination ? false : Boolean(routeSummary.isBetweenWaypoints),
    locationType,
    locationName: useSelectedDestination ? selectedDestinationNode.name : routeSummary.currentLocationName,
    locationLabel: locationCopy.label,
    locationLead: locationCopy.lead,
    locationSetupLine: locationCopy.setupLine,
    locationFlavor: buildLocationFlavor(locationType, sourceTag, locationCopy.flavor),
    quirkNotes: [...locationCopy.quirkNotes, ...(activeLegModifiers.overnightQuirkNotes ?? [])],
    availableCampsiteTypes:
      availableCampsiteTypes.length > 0
        ? availableCampsiteTypes
        : getAvailableCampsiteOptionsForLocation(locationType).map((entry) => entry.id),
    siteCategory: activeNode?.category ?? null,
    siteType: activeNode?.siteType ?? null,
    siteQuality: activeNode?.quality ?? null,
    solarExposure: activeNode?.solarExposure ?? null,
    weatherShelter: activeNode?.weatherShelter ?? null,
    scenicValue: Number(activeNode?.scenicValue) || 0,
    services: {
      waterFill: Boolean(
        activeNode?.category === "town_hub" ||
          activeNode?.category === "gas_station" ||
          activeNode?.category === "rv_park" ||
          locationType === OVERNIGHT_LOCATION_TYPES.SERVICE_EDGE
      ),
      wasteDump: Boolean(
        activeNode?.category === "town_hub" ||
        activeNode?.category === "gas_station" ||
          activeNode?.category === "rv_park" ||
          locationType === OVERNIGHT_LOCATION_TYPES.SERVICE_EDGE
      ),
      electricHookup: Boolean(
        activeNode?.category === "town_hub" ||
          activeNode?.category === "rv_park" ||
          activeNode?.category === "gas_station" ||
          locationType === OVERNIGHT_LOCATION_TYPES.SERVICE_EDGE
      )
    },
    stayLabel: stayProfile.stayLabel,
    stayLead: stayProfile.stayLead,
    staySummary: stayProfile.staySummary,
    supportSummary: stayProfile.supportSummary,
    actionBudget: stayProfile.actionBudget,
    autoCampsiteType: stayProfile.autoCampsiteType,
    v2Effects: normalizeV2StayEffects(stayProfile.v2Effects),
    baseModifiers: mergeOvernightModifiers(
      locationCopy.baselineModifiers,
      stayProfile.baseModifiers,
      activeLegModifiers.overnightModifierPatch
    )
  };
}

export function normalizeOvernightContext(value, runState = null) {
  const source = typeof value === "object" && value !== null ? value : {};
  const siteContext = runState ? buildOvernightSiteContext(runState) : null;
  const locationType = resolveNormalizedLocationType(source.locationType, siteContext?.locationType);
  const locationCopy = LOCATION_COPY[locationType] ?? LOCATION_COPY[OVERNIGHT_LOCATION_TYPES.ROADSIDE];
  const availableCampsiteTypes = normalizeCampsiteIdList(
    source.availableCampsiteTypes,
    siteContext?.availableCampsiteTypes ??
      getAvailableCampsiteOptionsForLocation(locationType).map((entry) => entry.id)
  );
  const selectedCampsiteType = normalizeSelectedCampsiteType(
    source.selectedCampsiteType ??
      siteContext?.autoCampsiteType ??
      runState?.policies?.selectedCampsiteType ??
      null,
    availableCampsiteTypes
  );
  const actionBudget = Math.max(
    1,
    Number(source.actionBudget ?? siteContext?.actionBudget ?? DEFAULT_EVENING_ACTION_BUDGET) ||
      siteContext?.actionBudget ||
      DEFAULT_EVENING_ACTION_BUDGET
  );

  return {
    routePointId:
      typeof source.routePointId === "string"
        ? source.routePointId
        : siteContext?.routePointId ?? null,
    sourceTag:
      typeof source.sourceTag === "string" ? source.sourceTag : siteContext?.sourceTag ?? null,
    isBetweenWaypoints:
      typeof source.isBetweenWaypoints === "boolean"
        ? source.isBetweenWaypoints
        : siteContext?.isBetweenWaypoints ?? false,
    locationType,
    locationName:
      typeof source.locationName === "string" && source.locationName.length > 0
        ? source.locationName
        : siteContext?.locationName ?? "",
    locationLabel:
      typeof source.locationLabel === "string" && source.locationLabel.length > 0
        ? source.locationLabel
        : siteContext?.locationLabel ?? locationCopy.label,
    locationLead:
      typeof source.locationLead === "string" && source.locationLead.length > 0
        ? source.locationLead
        : siteContext?.locationLead ?? locationCopy.lead,
    locationSetupLine:
      typeof source.locationSetupLine === "string" && source.locationSetupLine.length > 0
        ? source.locationSetupLine
        : siteContext?.locationSetupLine ?? locationCopy.setupLine,
    locationFlavor:
      typeof source.locationFlavor === "string" && source.locationFlavor.length > 0
        ? source.locationFlavor
        : siteContext?.locationFlavor ?? locationCopy.flavor,
    quirkNotes: normalizeStringList(source.quirkNotes, siteContext?.quirkNotes ?? locationCopy.quirkNotes),
    availableCampsiteTypes,
    selectedCampsiteType,
    siteCategory:
      typeof source.siteCategory === "string" ? source.siteCategory : siteContext?.siteCategory ?? null,
    siteType: typeof source.siteType === "string" ? source.siteType : siteContext?.siteType ?? null,
    siteQuality:
      typeof source.siteQuality === "string" ? source.siteQuality : siteContext?.siteQuality ?? null,
    solarExposure:
      typeof source.solarExposure === "string"
        ? source.solarExposure
        : siteContext?.solarExposure ?? null,
    weatherShelter:
      typeof source.weatherShelter === "string"
        ? source.weatherShelter
        : siteContext?.weatherShelter ?? null,
    scenicValue: Math.max(0, Number(source.scenicValue ?? siteContext?.scenicValue) || 0),
    services:
      typeof source.services === "object" && source.services !== null
        ? normalizeStayServices(source.services)
        : normalizeStayServices(siteContext?.services),
    stayLabel:
      typeof source.stayLabel === "string" && source.stayLabel.length > 0
        ? source.stayLabel
        : siteContext?.stayLabel ?? "Coastal Stay",
    stayLead:
      typeof source.stayLead === "string" && source.stayLead.length > 0
        ? source.stayLead
        : siteContext?.stayLead ?? locationCopy.lead,
    staySummary:
      typeof source.staySummary === "string" && source.staySummary.length > 0
        ? source.staySummary
        : siteContext?.staySummary ?? locationCopy.flavor,
    supportSummary:
      typeof source.supportSummary === "string" && source.supportSummary.length > 0
        ? source.supportSummary
        : siteContext?.supportSummary ?? "",
    autoCampsiteType: normalizeSelectedCampsiteType(
      source.autoCampsiteType ?? siteContext?.autoCampsiteType ?? selectedCampsiteType,
      availableCampsiteTypes
    ),
    v2Effects: normalizeV2StayEffects(source.v2Effects ?? siteContext?.v2Effects),
    actionBudget,
    actionsRemaining: clampCounter(source.actionsRemaining, 0, actionBudget, actionBudget),
    actionsTaken: Array.isArray(source.actionsTaken)
      ? source.actionsTaken.map(normalizeOvernightActionRecord).filter(Boolean)
      : [],
    lastActionResult:
      typeof source.lastActionResult === "object" && source.lastActionResult !== null
        ? normalizeOvernightActionRecord(source.lastActionResult)
        : null,
    latestRumorId:
      typeof source.latestRumorId === "string" ? source.latestRumorId : null,
    baseModifiers: normalizeOvernightModifiers(source.baseModifiers ?? siteContext?.baseModifiers),
    modifiers: normalizeOvernightModifiers(source.modifiers),
    enteredCamp: source.enteredCamp !== false,
    committedToSleep: source.committedToSleep === true
  };
}

export function getAvailableCampsiteOptionsForRun(runState) {
  const overnightContext = getOvernightContext(runState);
  const allowed = new Set(
    overnightContext?.availableCampsiteTypes ??
      buildOvernightSiteContext(runState).availableCampsiteTypes
  );

  return campsiteOptions.filter((entry) => allowed.has(entry.id));
}

function normalizeOvernightActionRecord(value) {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const rumor =
    typeof value.rumor === "object" && value.rumor !== null
      ? {
          id: typeof value.rumor.id === "string" ? value.rumor.id : null,
          label: typeof value.rumor.label === "string" ? value.rumor.label : "",
          text: typeof value.rumor.text === "string" ? value.rumor.text : "",
          effectSummary:
            typeof value.rumor.effectSummary === "string" ? value.rumor.effectSummary : ""
        }
      : null;

  return {
    id: typeof value.id === "string" ? value.id : "camp_action",
    label: typeof value.label === "string" ? value.label : "",
    category: typeof value.category === "string" ? value.category : "",
    budgetCost: Math.max(1, Number(value.budgetCost) || 1),
    resultText: typeof value.resultText === "string" ? value.resultText : "",
    effectSummary: typeof value.effectSummary === "string" ? value.effectSummary : "",
    rumor
  };
}

function resolveDestinationStayProfile(node, locationType) {
  const profileId =
    node?.category === "town_hub" ||
    node?.category === "premium_boondock" ||
    node?.category === "boondock_spot" ||
    node?.category === "poor_boondock" ||
    node?.category === "rv_park" ||
    node?.category === "gas_station" ||
    node?.category === "scenic_stop" ||
    node?.category === "destination" ||
    node?.category === "roadside_fallback" ||
    node?.category === "route_connector"
      ? node.category
      : node?.locationType === "boondock_site"
        ? "boondock_spot"
      : node?.locationType === "roadside_stop"
        ? "roadside_fallback"
      : locationType === OVERNIGHT_LOCATION_TYPES.CAMPGROUND
        ? "rv_park"
        : locationType === OVERNIGHT_LOCATION_TYPES.SERVICE_EDGE
          ? "gas_station"
          : locationType === OVERNIGHT_LOCATION_TYPES.SCENIC_PULL_OUT
            ? "scenic_stop"
            : "route_connector";

  return DESTINATION_STAY_PROFILES[profileId] ?? DESTINATION_STAY_PROFILES.default;
}

function normalizeV2StayEffects(value) {
  const source = typeof value === "object" && value !== null ? value : {};

  return {
    tripScoreDelta: Number(source.tripScoreDelta) || DEFAULT_V2_STAY_EFFECTS.tripScoreDelta,
    hiddenMoraleDelta:
      Number(source.hiddenMoraleDelta) || DEFAULT_V2_STAY_EFFECTS.hiddenMoraleDelta,
    wasteDelta: Number(source.wasteDelta) || DEFAULT_V2_STAY_EFFECTS.wasteDelta
  };
}

function normalizeStayServices(value) {
  const source = typeof value === "object" && value !== null ? value : {};

  return {
    waterFill: source.waterFill === true,
    wasteDump: source.wasteDump === true,
    electricHookup: source.electricHookup === true
  };
}

function normalizeOvernightPressureAdjustment(value) {
  const source = typeof value === "object" && value !== null ? value : {};

  return Object.fromEntries(
    OVERNIGHT_PRESSURE_KEYS.map((key) => [key, Number(source[key]) || 0])
  );
}

function resolveOvernightLocationType(routeSummary, currentPoint) {
  if (routeSummary.isBetweenWaypoints) {
    return OVERNIGHT_LOCATION_TYPES.ROADSIDE;
  }

  if (
    typeof currentPoint?.townId === "string" ||
    currentPoint?.tag === "service" ||
    currentPoint?.tag === "ferry"
  ) {
    return OVERNIGHT_LOCATION_TYPES.SERVICE_EDGE;
  }

  if (currentPoint?.tag === "camp") {
    return OVERNIGHT_LOCATION_TYPES.CAMPGROUND;
  }

  return OVERNIGHT_LOCATION_TYPES.SCENIC_PULL_OUT;
}

function resolveNormalizedLocationType(value, fallback) {
  return Object.values(OVERNIGHT_LOCATION_TYPES).includes(value)
    ? value
    : fallback ?? OVERNIGHT_LOCATION_TYPES.ROADSIDE;
}

function normalizeCampsiteIdList(value, fallback) {
  const allowedIds = new Set(campsiteOptions.map((entry) => entry.id));
  const source = Array.isArray(value) && value.length > 0 ? value : fallback;

  return [...new Set(source.filter((entry) => allowedIds.has(entry)))];
}

function normalizeSelectedCampsiteType(value, availableCampsiteTypes) {
  return typeof value === "string" && availableCampsiteTypes.includes(value) ? value : null;
}

function normalizeStringList(value, fallback = []) {
  const source = Array.isArray(value) && value.length > 0 ? value : fallback;
  return source.filter((entry) => typeof entry === "string" && entry.length > 0);
}

function buildLocationFlavor(locationType, sourceTag, fallback) {
  if (locationType === OVERNIGHT_LOCATION_TYPES.SCENIC_PULL_OUT) {
    if (sourceTag === "timber" || sourceTag === "camp") {
      return "Trees and softer air make the stop feel more sheltered than most, even without much formal help.";
    }

    if (sourceTag === "water") {
      return "The air is a little cooler here, and the place feels worth slowing down for even without services.";
    }

    if (sourceTag === "wash" || sourceTag === "pass" || sourceTag === "shelf") {
      return "The place feels borrowed from the road itself, but it is still better than pushing on in the dark.";
    }
  }

  return fallback;
}

function normalizeDestinationNodeId(destinationId) {
  if (typeof destinationId !== "string" || destinationId.length === 0) {
    return null;
  }

  return destinationId.startsWith("destination_")
    ? destinationId.slice("destination_".length)
    : destinationId;
}

function mapDestinationNodeToOvernightLocationType(node) {
  switch (node?.category) {
    case "town_hub":
      return OVERNIGHT_LOCATION_TYPES.SERVICE_EDGE;
    case "rv_park":
      return OVERNIGHT_LOCATION_TYPES.CAMPGROUND;
    case "gas_station":
      return OVERNIGHT_LOCATION_TYPES.SERVICE_EDGE;
    case "roadside_fallback":
      return OVERNIGHT_LOCATION_TYPES.ROADSIDE;
    case "premium_boondock":
    case "poor_boondock":
    case "scenic_stop":
    case "destination":
      return OVERNIGHT_LOCATION_TYPES.SCENIC_PULL_OUT;
    default:
      return OVERNIGHT_LOCATION_TYPES.ROADSIDE;
  }
}

function clampCounter(value, min, max, fallback) {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, numericValue));
}
