export const TRAVEL_MODES = Object.freeze({
  SOLAR_FIRST: "solar_first",
  BALANCED: "balanced",
  PUSH_MILES: "push_miles"
});

export const COMFORT_POLICIES = Object.freeze({
  FRUGAL: "frugal",
  BALANCED: "balanced",
  COMFORTABLE: "comfortable",
  INDULGENT: "indulgent"
});

export const CAMPSITE_TYPES = Object.freeze({
  OPEN_SUN: "open_sun",
  PARTIAL_SHADE: "partial_shade",
  FULL_SHADE: "full_shade",
  PAID_HOOKUP: "paid_hookup"
});

export const DAY_PHASES = Object.freeze({
  MORNING_REVIEW: "morning_review",
  PLAYER_DECISION: "player_decision",
  ROUTE_STOP: "route_stop",
  TOWN_STOP: "town_stop",
  TRAVEL_RESOLUTION: "travel_resolution",
  CAMP_DECISION: "camp_decision",
  OVERNIGHT_RESOLUTION: "overnight_resolution",
  DAY_END: "day_end"
});

export const CONDITION_BANDS = Object.freeze({
  GOOD: "good",
  WORN: "worn",
  POOR: "poor",
  CRITICAL: "critical"
});

export const MORALE_BANDS = Object.freeze({
  HIGH: "high",
  STEADY: "steady",
  LOW: "low",
  BREAKING: "breaking"
});

export const WARNING_FLAGS = Object.freeze({
  LOW_BATTERY: "low_battery",
  VERY_LOW_BATTERY: "very_low_battery",
  CRITICALLY_LOW_BATTERY: "critically_low_battery",
  POOR_CHARGING_CONDITIONS: "poor_charging_conditions",
  HIGH_OVERNIGHT_LOAD: "high_overnight_load",
  HOOKUP_RECOMMENDED: "hookup_recommended",
  BEHIND_SCHEDULE: "behind_schedule",
  LOW_FUEL: "low_fuel",
  LOW_WATER: "low_water",
  HIGH_WASTE: "high_waste",
  WASTE_NEAR_LIMIT: "waste_near_limit",
  LOW_MORALE: "low_morale",
  PASSENGERS_TENSE: "passengers_tense",
  STRAIN_BUILDING: "strain_building",
  MORALE_FRAGILE: "morale_fragile",
  REAL_BREAK_NEEDED: "real_break_needed",
  RV_CONDITION_CRITICAL: "rv_condition_critical",
  CASH_DANGEROUSLY_LOW: "cash_dangerously_low"
});

export const LOSS_FLAGS = Object.freeze({
  BATTERY_DEPLETED: "battery_depleted",
  FUEL_DEPLETED: "fuel_depleted",
  WATER_DEPLETED: "water_depleted",
  WASTE_OVERFLOW: "waste_overflow",
  RV_CONDITION_FAILED: "rv_condition_failed",
  MORALE_COLLAPSED: "morale_collapsed",
  DEADLINE_MISSED: "deadline_missed"
});

export const DEFAULT_STARTING_VALUES = Object.freeze({
  batteryCharge: 70,
  batteryCapacity: 100,
  fuel: 80,
  fuelCapacity: 100,
  water: 75,
  waterCapacity: 100,
  cash: 1200,
  rvCondition: 85,
  passengerMorale: 80
});

export const RV_FUEL_TANK_GALLONS = 80;
export const RV_MILES_PER_GALLON = 10;
export const RV_FULL_TANK_RANGE_MILES = RV_FUEL_TANK_GALLONS * RV_MILES_PER_GALLON;

export const HOOKUP_CASH_COST = 42;

export const STATUS_THRESHOLDS = Object.freeze({
  lowResourcePercent: 35,
  veryLowBatteryPercent: 15,
  criticalBatteryPercent: 8,
  cashDangerThreshold: 180,
  poorChargingSunlightFactor: 0.78,
  hookupRecommendationBatteryPercent: 30,
  highOvernightLoad: 8,
  highWastePercent: 70,
  criticalWastePercent: 90,
  paceSteadyMilesPerDay: 320,
  paceWarningMilesPerDay: 380,
  paceDangerMilesPerDay: 520,
  condition: {
    good: 70,
    worn: 45,
    poor: 20
  },
  morale: {
    high: 75,
    steady: 45,
    low: 20
  },
  victory: {
    batteryMinimum: 10,
    moraleMinimum: 25
  }
});

export const PHASE_LABELS = Object.freeze({
  [DAY_PHASES.MORNING_REVIEW]: "Morning",
  [DAY_PHASES.PLAYER_DECISION]: "Plan The Day",
  [DAY_PHASES.ROUTE_STOP]: "At Stop",
  [DAY_PHASES.TOWN_STOP]: "In Town",
  [DAY_PHASES.TRAVEL_RESOLUTION]: "On The Road",
  [DAY_PHASES.CAMP_DECISION]: "Settle In",
  [DAY_PHASES.OVERNIGHT_RESOLUTION]: "Night",
  [DAY_PHASES.DAY_END]: "Evening"
});

export const WARNING_LABELS = Object.freeze({
  [WARNING_FLAGS.LOW_BATTERY]: "Electric is getting low",
  [WARNING_FLAGS.VERY_LOW_BATTERY]: "Electric is getting uncomfortably low",
  [WARNING_FLAGS.CRITICALLY_LOW_BATTERY]: "Electric cannot wait much longer",
  [WARNING_FLAGS.POOR_CHARGING_CONDITIONS]: "Charging may stay weak today",
  [WARNING_FLAGS.HIGH_OVERNIGHT_LOAD]: "Tonight may use a lot of power",
  [WARNING_FLAGS.HOOKUP_RECOMMENDED]: "A plug-in stop would help",
  [WARNING_FLAGS.BEHIND_SCHEDULE]: "The trip is starting to slip behind",
  [WARNING_FLAGS.LOW_FUEL]: "Fuel is low",
  [WARNING_FLAGS.LOW_WATER]: "Water is running low",
  [WARNING_FLAGS.HIGH_WASTE]: "Waste is building up",
  [WARNING_FLAGS.WASTE_NEAR_LIMIT]: "Waste cannot wait much longer",
  [WARNING_FLAGS.LOW_MORALE]: "The mood is low",
  [WARNING_FLAGS.PASSENGERS_TENSE]: "People are on edge",
  [WARNING_FLAGS.STRAIN_BUILDING]: "Things are starting to feel strained",
  [WARNING_FLAGS.MORALE_FRAGILE]: "The mood is getting fragile",
  [WARNING_FLAGS.REAL_BREAK_NEEDED]: "A real break would help",
  [WARNING_FLAGS.RV_CONDITION_CRITICAL]: "The RV needs attention soon",
  [WARNING_FLAGS.CASH_DANGEROUSLY_LOW]: "Cash is running thin"
});

export const LOSS_LABELS = Object.freeze({
  [LOSS_FLAGS.BATTERY_DEPLETED]: "Electric ran too thin to keep going safely",
  [LOSS_FLAGS.FUEL_DEPLETED]: "Fuel ran out before the end",
  [LOSS_FLAGS.WATER_DEPLETED]: "Water ran out before the next stop",
  [LOSS_FLAGS.WASTE_OVERFLOW]: "Waste backed up too far to ignore",
  [LOSS_FLAGS.RV_CONDITION_FAILED]: "The RV could not keep going safely",
  [LOSS_FLAGS.MORALE_COLLAPSED]: "The trip had worn everyone down too far",
  [LOSS_FLAGS.DEADLINE_MISSED]: "The trip ran out of days before the finish"
});
