import {
  CAMPSITE_TYPES,
  COMFORT_POLICIES,
  STATUS_THRESHOLDS,
  WARNING_FLAGS
} from "../constants/gameConstants.js";
import {
  getCampsiteLabel,
  getCampsiteRules,
  getDrivingStyleOption
} from "../state/gameContent.js";
import { getPressurePenaltyProfile } from "./passengerPressure.js";
import {
  getEffectiveOvernightModifiers,
  getSelectedCampsiteType
} from "./overnightContext.js";
import { getActiveRouteLegModifiers } from "./routeChoiceLoop.js";

const COMFORT_LOAD_RULES = Object.freeze({
  [COMFORT_POLICIES.FRUGAL]: {
    travel: 1,
    overnight: 2,
    loadBand: "light"
  },
  [COMFORT_POLICIES.BALANCED]: {
    travel: 3,
    overnight: 5,
    loadBand: "moderate"
  },
  [COMFORT_POLICIES.COMFORTABLE]: {
    travel: 6,
    overnight: 9,
    loadBand: "high"
  },
  [COMFORT_POLICIES.INDULGENT]: {
    travel: 6,
    overnight: 9,
    loadBand: "high"
  }
});

const WEATHER_LOAD_RULES = Object.freeze({
  strong: {
    travel: 0,
    overnight: 0
  },
  moderate: {
    travel: 0,
    overnight: 1
  },
  weak: {
    travel: 1,
    overnight: 3
  }
});

export function calculateSolarGeneration(runState, options = {}) {
  const context = options.context ?? "travel";
  const campsiteType = options.campsiteType ?? getSelectedCampsiteType(runState);
  const pressurePenalty = getPressurePenaltyProfile(runState);
  const weatherProfile = getActiveWeatherProfile(runState);

  if (context === "travel") {
    const drivingStyle = getDrivingStyleOption(
      runState.policies.drivingStyle ?? runState.policies.travelMode
    );
    const legModifiers = getActiveRouteLegModifiers(runState);
    const sunlightFactor = clampSunlight(
      runState.environment.sunlightFactor + legModifiers.sunlightFactorAdjustment
    );
    const accessFactor = Number(drivingStyle.travelRule?.solarAccess) || 1;
    const weatherSolarFactor = getWeatherSolarFactor(weatherProfile, "travel");
    const solarGain = Math.max(
      0,
      Math.round(5 * sunlightFactor * accessFactor * weatherSolarFactor) - pressurePenalty.solarPenalty
    );

    return {
      amount: solarGain,
      sunlightFactor,
      source: "travel_solar",
      chargingBand: getChargingBand(sunlightFactor * accessFactor * weatherSolarFactor),
      solarOutlook: weatherProfile.solarOutlook,
      weatherLabel: weatherProfile.label
    };
  }

  const overnightSunlightFactor = getEffectiveOvernightSunlightFactor(runState);
  const siteRule = getCampsiteRules(campsiteType ?? CAMPSITE_TYPES.PARTIAL_SHADE);
  const siteFactor = Number(siteRule.solarFactor) || 0.8;
  const solarFactorAdjustment =
    Number(getEffectiveOvernightModifiers(runState).solarFactorAdjustment) || 0;
  const siteContext = runState.v2?.stay?.site ?? {};
  const exposureFactor = getSiteExposureFactor(siteContext.solarExposure);
  const shelterFactor = getSiteShelterFactor(siteContext.weatherShelter, weatherProfile.severity);
  const weatherSolarFactor = getWeatherSolarFactor(weatherProfile, "overnight");
  const effectiveSiteFactor = Math.max(
    0.2,
    siteFactor * (1 + solarFactorAdjustment) * exposureFactor * shelterFactor
  );

  return {
    amount: 0,
    sunlightFactor: overnightSunlightFactor,
    source: campsiteType ?? CAMPSITE_TYPES.PARTIAL_SHADE,
    chargingBand: getChargingBand(overnightSunlightFactor * effectiveSiteFactor * weatherSolarFactor),
    solarOutlook: weatherProfile.solarOutlook,
    weatherLabel: weatherProfile.label
  };
}

export function calculateElectricalLoad(runState, options = {}) {
  const context = options.context ?? "travel";
  const comfortRule = COMFORT_LOAD_RULES[runState.policies.comfortPolicy] ?? COMFORT_LOAD_RULES.balanced;
  const pressurePenalty = getPressurePenaltyProfile(runState);
  const weatherProfile = getActiveWeatherProfile(runState);
  const sunlightFactor =
    context === "travel"
      ? clampSunlight(runState.environment.sunlightFactor)
      : getEffectiveOvernightSunlightFactor(runState);
  const weatherBand = getWeatherBand(sunlightFactor, weatherProfile);
  const weatherLoad = WEATHER_LOAD_RULES[weatherBand][context];
  const baseLoad = comfortRule[context];
  const overnightLoadAdjustment =
    context === "overnight"
      ? Number(getEffectiveOvernightModifiers(runState).loadAdjustment) || 0
      : 0;
  const pressureLoadAdjustment =
    context === "overnight"
      ? pressurePenalty.loadPenalty
      : Math.max(0, pressurePenalty.loadPenalty - 1);

  return {
    amount: Math.max(0, baseLoad + weatherLoad + overnightLoadAdjustment + pressureLoadAdjustment),
    baseLoad,
    weatherLoad,
    overnightLoadAdjustment,
    pressureLoadAdjustment,
    weatherBand,
    loadBand: comfortRule.loadBand,
    weatherLabel: weatherProfile.label
  };
}

export function calculateTravelEnergyModifier(runState) {
  const drivingStyle = getDrivingStyleOption(
    runState.policies.drivingStyle ?? runState.policies.travelMode
  );
  const terrainLoad = Math.max(1, Number(runState.environment.terrainModifier) || 1);
  const travelPressure = Number(drivingStyle.travelRule?.energyPressure) || 2;
  const terrainPressure = Math.max(0, Math.round((terrainLoad - 1) * 4));

  return {
    amount: -(travelPressure + terrainPressure),
    travelPressure,
    terrainPressure
  };
}

export function calculateHookupEffect(runState, options = {}) {
  const campsiteType = options.campsiteType ?? getSelectedCampsiteType(runState);
  const siteRule = getCampsiteRules(campsiteType ?? CAMPSITE_TYPES.PARTIAL_SHADE);
  const effectiveModifiers = getEffectiveOvernightModifiers(runState);

  return {
    batterySupport:
      (Number(siteRule.hookupSupport) || 0) +
      (Number(effectiveModifiers.hookupSupportAdjustment) || 0),
    cashCost: 0,
    source: campsiteType ?? "none"
  };
}

export function calculateNetBatteryDelta(energyParts) {
  return (
    (Number(energyParts.solarGain) || 0) -
    (Number(energyParts.loadUse) || 0) +
    (Number(energyParts.travelImpact) || 0) +
    (Number(energyParts.hookupSupport) || 0)
  );
}

export function buildEnergyBreakdown(runState, options = {}) {
  const context = options.context ?? "travel";
  const campsiteType = options.campsiteType ?? getSelectedCampsiteType(runState);
  const solar = calculateSolarGeneration(runState, { context, campsiteType });
  const load = calculateElectricalLoad(runState, { context });
  const travelModifier =
    context === "travel"
      ? calculateTravelEnergyModifier(runState)
      : {
          amount: 0,
          travelPressure: 0,
          terrainPressure: 0
        };
  const hookup = context === "overnight"
    ? calculateHookupEffect(runState, { campsiteType })
    : {
        batterySupport: 0,
        cashCost: 0,
        source: "none"
      };

  const netBatteryDelta = calculateNetBatteryDelta({
    solarGain: solar.amount,
    loadUse: load.amount,
    travelImpact: travelModifier.amount,
    hookupSupport: hookup.batterySupport
  });

  return {
    context,
    sunlightFactor: solar.sunlightFactor,
    solarGain: solar.amount,
    loadUse: load.amount,
    travelImpact: travelModifier.amount,
    hookupSupport: hookup.batterySupport,
    eventAdjustment: 0,
    hookupCashDelta: hookup.cashCost,
    netBatteryDelta,
    chargingBand: solar.chargingBand,
    loadBand: load.loadBand,
    notes: buildEnergyNotes(runState, {
      context,
      campsiteType,
      solar,
      load,
      travelModifier,
      hookup,
      netBatteryDelta
    })
  };
}

export function getEnergyWarnings(runState) {
  const warnings = [];
  const batteryPercent = Math.round(
    (Math.max(0, runState.v2?.resources?.electric?.charge ?? runState.resources.batteryCharge) /
      Math.max(1, runState.v2?.resources?.electric?.capacity ?? runState.resources.batteryCapacity)) *
      100
  );
  const selectedCampsiteType =
    getSelectedCampsiteType(runState) ?? CAMPSITE_TYPES.PARTIAL_SHADE;
  const overnightPreview = buildEnergyBreakdown(runState, {
    context: "overnight",
    campsiteType: selectedCampsiteType
  });

  if (batteryPercent <= STATUS_THRESHOLDS.criticalBatteryPercent) {
    warnings.push(WARNING_FLAGS.CRITICALLY_LOW_BATTERY);
  } else if (batteryPercent <= STATUS_THRESHOLDS.veryLowBatteryPercent) {
    warnings.push(WARNING_FLAGS.VERY_LOW_BATTERY);
  } else if (batteryPercent <= STATUS_THRESHOLDS.lowResourcePercent) {
    warnings.push(WARNING_FLAGS.LOW_BATTERY);
  }

  if (overnightPreview.chargingBand === "poor") {
    warnings.push(WARNING_FLAGS.POOR_CHARGING_CONDITIONS);
  }

  if (overnightPreview.loadUse >= STATUS_THRESHOLDS.highOvernightLoad) {
    warnings.push(WARNING_FLAGS.HIGH_OVERNIGHT_LOAD);
  }

  if (
    selectedCampsiteType !== CAMPSITE_TYPES.PAID_HOOKUP &&
    batteryPercent <= STATUS_THRESHOLDS.hookupRecommendationBatteryPercent &&
    overnightPreview.netBatteryDelta <= 1
  ) {
    warnings.push(WARNING_FLAGS.HOOKUP_RECOMMENDED);
  }

  return warnings;
}

export function getEffectiveOvernightSunlightFactor(runState) {
  const currentSunlight = clampSunlight(runState.environment.sunlightFactor);
  const forecastSunlight = clampSunlight(
    runState.environment.forecast?.[0]?.sunlightFactor ?? currentSunlight
  );

  return Number(((currentSunlight * 0.4) + (forecastSunlight * 0.6)).toFixed(2));
}

function buildEnergyNotes(runState, parts) {
  const drivingStyle = getDrivingStyleOption(
    runState.policies.drivingStyle ?? runState.policies.travelMode
  );
  const comfortLabel = formatComfortPolicy(runState.policies.comfortPolicy);
  const weatherProfile = getActiveWeatherProfile(runState);

  if (parts.context === "travel") {
    return [
      `${weatherProfile.label} set a ${parts.solar.solarOutlook.toLowerCase()} solar outlook and added ${parts.solar.amount} battery while you drove.`,
      `${comfortLabel} living used ${parts.load.amount} battery during the day.`,
      `${drivingStyle.label} and the terrain added ${Math.abs(
        parts.travelModifier.amount
      )} battery strain.`
    ];
  }

  const campsiteLabel = getCampsiteLabel(parts.campsiteType ?? CAMPSITE_TYPES.PARTIAL_SHADE);

  return [
    `${campsiteLabel} sets up a ${parts.solar.chargingBand} charging start for tomorrow under ${weatherProfile.label.toLowerCase()}.`,
    `${comfortLabel} living used ${parts.load.amount} battery overnight.`,
    parts.hookup.batterySupport > 0
      ? `Plug-in power added ${parts.hookup.batterySupport} battery overnight.`
      : "No plug-in was used overnight."
  ];
}

function getChargingBand(value) {
  if (value >= 1) {
    return "strong";
  }
  if (value >= STATUS_THRESHOLDS.poorChargingSunlightFactor) {
    return "fair";
  }
  return "poor";
}

function getWeatherBand(sunlightFactor, weatherProfile = {}) {
  if (weatherProfile.severity === "severe") {
    return "weak";
  }
  if (sunlightFactor >= 0.95) {
    return "strong";
  }
  if (sunlightFactor <= STATUS_THRESHOLDS.poorChargingSunlightFactor) {
    return "weak";
  }
  return "moderate";
}

function clampSunlight(value) {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return 1;
  }
  return Math.max(0.35, Math.min(1.15, numericValue));
}

function getActiveWeatherProfile(runState) {
  const profile = runState.environment.weatherProfile ?? {};
  const sunlightFactor = clampSunlight(runState.environment.sunlightFactor);

  return {
    label: typeof profile.label === "string" ? profile.label : String(runState.environment.currentWeather ?? "Mild weather"),
    solarOutlook:
      typeof profile.solarOutlook === "string"
        ? profile.solarOutlook
        : sunlightFactor >= 0.95
          ? "Strong"
          : sunlightFactor <= STATUS_THRESHOLDS.poorChargingSunlightFactor
            ? "Weak"
            : "Fair",
    weatherType: typeof profile.weatherType === "string" ? profile.weatherType : "mild",
    severity: typeof profile.severity === "string" ? profile.severity : "normal"
  };
}

function getWeatherSolarFactor(weatherProfile, context) {
  const factors = {
    clear: { travel: 1.08, overnight: 1.12 },
    marine_clouds: { travel: 0.94, overnight: 0.92 },
    broken_clouds: { travel: 0.98, overnight: 0.97 },
    overcast: { travel: 0.86, overnight: 0.82 },
    rain: { travel: 0.74, overnight: 0.7 },
    storm: { travel: 0.55, overnight: 0.52 },
    mild: { travel: 1, overnight: 1 }
  };

  return factors[weatherProfile.weatherType]?.[context] ?? 1;
}

function getSiteExposureFactor(solarExposure) {
  return {
    open: 1.08,
    mixed: 1,
    partial: 0.88,
    sheltered: 0.78
  }[solarExposure] ?? 1;
}

function getSiteShelterFactor(weatherShelter, severity) {
  if (severity !== "rough" && severity !== "severe") {
    return 1;
  }

  return {
    low: 0.86,
    moderate: 0.94,
    high: 1.02
  }[weatherShelter] ?? 0.92;
}


function formatComfortPolicy(value) {
  return {
    [COMFORT_POLICIES.FRUGAL]: "Frugal",
    [COMFORT_POLICIES.BALANCED]: "Balanced",
    [COMFORT_POLICIES.COMFORTABLE]: "Comfort-First",
    [COMFORT_POLICIES.INDULGENT]: "Comfort-First"
  }[value];
}
