import { DAY_PHASES } from "../constants/gameConstants.js";
import {
  getCampEveningActionDefinition,
  getCampsiteOption,
  listCampEveningActionDefinitions
} from "../state/gameContent.js";
import { cloneGameState, finalizeGameState } from "../state/gameState.js";
import { applyEventEffects } from "./events/eventEffects.js";
import {
  recordServiceAction,
  recordStayStyleChoice
} from "./coreSystems.js";
import {
  DEFAULT_EVENING_ACTION_BUDGET,
  applyOvernightModifierPatch,
  buildOvernightSiteContext,
  createEmptyOvernightModifiers,
  getAvailableCampsiteOptionsForRun,
  getOvernightContext,
  getSelectedCampsiteType,
  normalizeOvernightContext,
  setSelectedCampsiteTypeOnState
} from "./overnightContext.js";

export function ensureOvernightContextState(runState) {
  const siteContext = buildOvernightSiteContext(runState);
  const existingContext = getOvernightContext(runState);
  const selectedCampsiteType = resolveSelectedCampsiteType(
    siteContext.autoCampsiteType ??
      existingContext?.selectedCampsiteType ??
      getSelectedCampsiteType(runState),
    siteContext.availableCampsiteTypes
  );

  runState.day.overnightContext = normalizeOvernightContext(
    existingContext
      ? {
          ...existingContext,
          ...siteContext,
          selectedCampsiteType,
          availableCampsiteTypes: siteContext.availableCampsiteTypes
        }
        : {
           ...siteContext,
           selectedCampsiteType,
           actionBudget: DEFAULT_EVENING_ACTION_BUDGET,
           actionsRemaining: DEFAULT_EVENING_ACTION_BUDGET,
           actionsTaken: [],
           lastActionResult: null,
           latestRumorId: null,
           baseModifiers: siteContext.baseModifiers,
           modifiers: createEmptyOvernightModifiers(),
           enteredCamp: true,
           committedToSleep: false
         },
    runState
  );

  setSelectedCampsiteTypeOnState(runState, runState.day.overnightContext.selectedCampsiteType);
}

export function getCampContext(runState) {
  const overnightContext = getOvernightContext(runState);

  if (!overnightContext) {
    return null;
  }

  const selectedCampsiteType = getSelectedCampsiteType(runState);

  return {
    overnightContext,
    selectedCampsite:
      selectedCampsiteType !== null ? getCampsiteOption(selectedCampsiteType) : null,
    availableCampsites: getAvailableCampsiteOptionsForRun(runState)
  };
}

export function selectOvernightCampsite(runState, campsiteType) {
  const nextState = cloneGameState(runState);

  ensureOvernightContextState(nextState);

  const overnightContext = nextState.day.overnightContext;

  if (!overnightContext.availableCampsiteTypes.includes(campsiteType)) {
    return finalizeGameState(nextState);
  }

  setSelectedCampsiteTypeOnState(nextState, campsiteType);
  overnightContext.committedToSleep = false;
  nextState.currentPhase = DAY_PHASES.CAMP_DECISION;

  return finalizeGameState(nextState);
}

export function canTurnInForNight(runState) {
  const context = getOvernightContext(runState);
  return (
    context !== null &&
    (context.actionsTaken?.some((entry) => entry.category === "stay_style") ||
      context.actionsTaken?.some((entry) => entry.id === "forced_roadside_sleep"))
  );
}

export function markCommittedToSleepState(runState) {
  ensureOvernightContextState(runState);

  if (runState.day.overnightContext) {
    runState.day.overnightContext.committedToSleep = true;
  }
}

export function getAvailableCampActions(runState) {
  const campContext = getCampContext(runState);

  if (!campContext) {
    return [];
  }

  return listCampEveningActionDefinitions()
    .map((action) => buildCampActionView(runState, campContext, action.id))
    .filter(
      (action) =>
        action &&
        action.availabilityReason !== "Not Offered Here" &&
        action.availabilityReason !== "Pick A Different Campsite"
    );
}

export function performCampAction(runState, actionId) {
  const nextState = cloneGameState(runState);

  ensureOvernightContextState(nextState);

  if (nextState.currentPhase !== DAY_PHASES.CAMP_DECISION) {
    return finalizeGameState(nextState);
  }

  const campContext = getCampContext(nextState);

  if (!campContext) {
    return finalizeGameState(nextState);
  }

  const actionView = buildCampActionView(nextState, campContext, actionId);

  if (!actionView?.canUse) {
    return finalizeGameState(nextState);
  }
  const beforeResources = snapshotServiceResources(nextState);
  const isStayStyle = actionView.category === "stay_style";

  if (actionView.effects) {
    applyEventEffects(nextState, actionView.effects, DAY_PHASES.CAMP_DECISION);
  }

  if (isStayStyle) {
    nextState.day.overnightContext.modifiers = createEmptyOvernightModifiers();
    applyOvernightModifierPatch(nextState.day.overnightContext.modifiers, actionView.overnightModifiers);
    recordStayStyleChoice(nextState, actionView.id);
  }

  const resultRecord = {
    id: actionView.id,
    label: actionView.label,
    category: actionView.category,
    budgetCost: actionView.budgetCost,
    resultText: actionView.resultText,
    effectSummary: actionView.effectSummary,
    rumor: null
  };

  const previousActions = nextState.day.overnightContext.actionsTaken ?? [];
  nextState.day.overnightContext.actionsTaken = isStayStyle
    ? [...previousActions.filter((entry) => entry.category !== "stay_style"), resultRecord]
    : [...previousActions, resultRecord];
  nextState.day.overnightContext.lastActionResult = resultRecord;
  nextState.day.overnightContext.actionsRemaining = Math.max(
    0,
    nextState.day.overnightContext.actionBudget -
      nextState.day.overnightContext.actionsTaken.reduce(
        (total, entry) => total + Math.max(1, Number(entry.budgetCost) || 1),
        0
      )
  );

  if (!isStayStyle) {
    recordServiceAction(nextState, actionView, beforeResources);
  }

  return finalizeGameState(nextState);
}

function buildCampActionView(runState, campContext, actionId) {
  const action = getCampEveningActionDefinition(actionId);

  if (!action) {
    return null;
  }

  const overnightContext = campContext.overnightContext;
  const budgetCost = Math.max(1, Number(action.budgetCost) || 1);
  const availability = evaluateCampActionAvailability(runState, campContext, action);
  const selectedRecord =
    overnightContext.actionsTaken?.find((entry) => entry.id === action.id) ??
    overnightContext.lastActionResult ??
    null;
  const used = overnightContext.actionsTaken?.some((entry) => entry.id === action.id);
  const replacingStayStyle = action.category === "stay_style" && overnightContext.actionsTaken?.some((entry) => entry.category === "stay_style");
  const hasBudget = replacingStayStyle || (overnightContext.actionsRemaining ?? 0) >= budgetCost;
  const canUse = availability.available && !used && hasBudget;
  const dynamic = buildNarrativeEveningChoice(action, overnightContext, runState);

  return {
    ...action,
    label: dynamic.label ?? action.label,
    description: dynamic.description ?? action.description,
    effectSummary: dynamic.effectSummary ?? action.effectSummary,
    resultText: dynamic.resultText ?? action.resultText,
    effects: dynamic.effects ?? action.effects,
    budgetCost,
    budgetLabel: "Evening Choice",
    used,
    hasBudget,
    available: availability.available,
    availabilityReason: availability.reason,
    canUse,
    stateLabel: resolveCampActionStateLabel({ used, availability, hasBudget }),
    usedRecord: used ? selectedRecord : null,
    overnightModifiers: {
      ...(dynamic.overnightModifiers ?? action.overnightModifiers ?? {})
    }
  };
}

function evaluateCampActionAvailability(runState, campContext, action) {
  const rules = action.availability ?? {};
  const overnightContext = campContext.overnightContext;
  const selectedCampsiteType = campContext.selectedCampsite?.id ?? null;
  if (rules.requiresSelectedCampsite && !selectedCampsiteType) {
    return {
      available: false,
      reason: "Choose A Place First"
    };
  }

  if (
    Array.isArray(rules.locationTypes) &&
    rules.locationTypes.length > 0 &&
    !rules.locationTypes.includes(overnightContext.locationType)
  ) {
    return {
      available: false,
      reason: "Not Available Here"
    };
  }

  if (
    selectedCampsiteType &&
    Array.isArray(rules.requiredCampsiteTypes) &&
    rules.requiredCampsiteTypes.length > 0 &&
    !rules.requiredCampsiteTypes.includes(selectedCampsiteType)
  ) {
    return {
      available: false,
      reason: "Choose A Different Place"
    };
  }

  if (
    selectedCampsiteType &&
    Array.isArray(rules.unavailableCampsiteTypes) &&
    rules.unavailableCampsiteTypes.includes(selectedCampsiteType)
  ) {
    return {
      available: false,
      reason: "That Place Does Not Fit"
    };
  }

  if (
    typeof rules.requiresService === "string" &&
    overnightContext.services?.[rules.requiresService] !== true
  ) {
    return {
      available: false,
      reason: "Not Available Here"
    };
  }

  return {
    available: true,
    reason: ""
  };
}

function resolveCampActionStateLabel({ used, availability, hasBudget = true }) {
  if (used) {
    return "Chosen";
  }

  if (!availability.available) {
    return availability.reason;
  }

  if (!hasBudget) {
    return "No Time Left Tonight";
  }

  return "";
}

function resolveSelectedCampsiteType(value, availableCampsiteTypes) {
  return typeof value === "string" && availableCampsiteTypes.includes(value) ? value : null;
}

function snapshotServiceResources(runState) {
  const electric = runState.v2?.resources?.electric ?? {};
  const water = runState.v2?.resources?.water ?? {};
  const waste = runState.v2?.resources?.waste ?? {};

  return {
    electricPercent: percent(electric.charge, electric.capacity),
    waterPercent: percent(water.current, water.capacity),
    wastePercent: percent(waste.current, waste.capacity)
  };
}

function percent(current, capacity) {
  return Math.round((Math.max(0, Number(current) || 0) / Math.max(1, Number(capacity) || 1)) * 100);
}

function buildNarrativeEveningChoice(action, overnightContext, runState) {
  const scenicValue = Number(overnightContext?.scenicValue) || 0;
  const siteQuality = overnightContext?.siteQuality ?? "steady";
  const weatherShelter = overnightContext?.weatherShelter ?? "moderate";
  const weatherSeverity = runState.environment.weatherProfile?.severity ?? "normal";
  const lowResources =
    (runState.v2?.resources?.water?.current ?? runState.resources.water) <= 35 ||
    (runState.v2?.resources?.electric?.charge ?? runState.resources.batteryCharge) <= 35;

  switch (action.id) {
    case "stay_conserve":
    case "stay_normal":
    case "stay_comfort":
      return {
        overnightModifiers: action.overnightModifiers
      };
    case "service_dump_waste":
      return {
        effectSummary:
          overnightContext.siteCategory === "rv_park"
            ? "Clears the waste tank, costs time at a practical stop"
            : "Clears most waste, costs a little time",
        effects: {
          resources: {
            waste: overnightContext.siteCategory === "rv_park" ? -100 : overnightContext.siteCategory === "gas_station" ? -60 : -80,
            hiddenMorale: overnightContext.siteCategory === "gas_station" ? -1 : 0
          }
        },
        overnightModifiers: action.overnightModifiers
      };
    case "service_refill_water":
      return {
        effectSummary:
          overnightContext.siteCategory === "rv_park"
            ? "Tops up fresh water, costs practical time"
            : "Adds fresh water, costs a little time",
        effects: {
          resources: {
            water: overnightContext.siteCategory === "rv_park" ? 100 : overnightContext.siteCategory === "gas_station" ? 35 : 50
          }
        },
        overnightModifiers: action.overnightModifiers
      };
    case "service_charge_electric":
      return {
        effectSummary:
          overnightContext.siteCategory === "rv_park"
            ? "Strong shore-power recharge, costs practical time"
            : "Adds power, but uses practical time",
        effects: {
          resources: {
            batteryCharge: overnightContext.siteCategory === "rv_park" ? 100 : overnightContext.siteCategory === "gas_station" ? 25 : 45
          }
        },
        overnightModifiers: action.overnightModifiers
      };
    case "settle_in":
      return {
        effectSummary: "Better rest, with a small lift in mood",
        overnightModifiers: action.overnightModifiers
      };
    case "take_care_of_things":
      return {
        effectSummary:
          overnightContext?.services?.electricHookup || overnightContext?.services?.waterFill
            ? "Gets the RV in better order and makes practical support easier to use"
            : "Gets the RV in better order and helps tomorrow start cleaner",
        overnightModifiers: {
          ...action.overnightModifiers,
          restQualityShift:
            overnightContext?.services?.electricHookup || weatherShelter === "high" ? 1 : 0
        }
      };
    case "make_something_of_it": {
      const strongPlace =
        scenicValue >= 3 || siteQuality === "premium" || siteQuality === "good";
      const weakPlace = scenicValue === 0 || siteQuality === "rough" || siteQuality === "practical";
        return {
          effectSummary: strongPlace
            ? "A good place to spend real time outside and come away feeling better"
            : weakPlace
              ? "Still worth a few quiet minutes outside, even if the place can only do so much"
              : "Can make the stop feel better if the place opens up a little",
          resultText: strongPlace
            ? "You spend some time outside, and the stop turns out to be worth staying with."
            : weakPlace
              ? "You spend a little time outside, even if the stop only has so much to offer."
              : action.resultText,
        overnightModifiers: {
          ...action.overnightModifiers,
          moraleDeltaAdjustment: strongPlace ? 2 : weakPlace ? 0 : 1,
          restQualityShift: strongPlace ? 1 : 0,
          waterDeltaAdjustment: lowResources ? 0 : -1
        }
      };
    }
    case "keep_it_simple":
      return {
        effectSummary:
          weatherSeverity === "severe" || lowResources
            ? "Low effort, useful for holding things together on a tight night"
            : "Low effort and easy on the group",
        overnightModifiers: {
          ...action.overnightModifiers,
          moraleDeltaAdjustment: lowResources ? 0 : 1,
          restQualityShift: weatherSeverity === "severe" ? 1 : 0
        }
      };
    default:
      return {
        overnightModifiers: action.overnightModifiers
      };
  }
}
