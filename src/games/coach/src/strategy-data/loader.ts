import { ACTION_PREFERENCE_RECORDS } from "./actionPreferences";
import type {
  ActionPreferenceRecord,
  CoachHandClass,
  SizingFamilyDefinition,
  SizingFamilyKey,
  SpotStrategyRecord,
  SpotTag,
  StrategyConfidence
} from "../core/types";
import { SIZING_FAMILIES } from "./sizingFamilies";
import { SPOT_STRATEGY_RECORDS } from "./spotStrategy";

const spotMap = new Map<SpotTag, SpotStrategyRecord>(
  SPOT_STRATEGY_RECORDS.map((record) => [record.key, record])
);
const sizingMap = new Map<SizingFamilyKey, SizingFamilyDefinition>(
  SIZING_FAMILIES.map((record) => [record.key, record])
);

export interface StrategyLookupResult {
  spot?: SpotStrategyRecord;
  preference?: ActionPreferenceRecord;
  sizingFamily?: SizingFamilyDefinition;
  confidence: StrategyConfidence | "fallback";
}

export function getSpotStrategyRecord(spotKey: SpotTag): SpotStrategyRecord | undefined {
  return spotMap.get(spotKey);
}

export function getSizingFamilyDefinition(key: SizingFamilyKey | undefined): SizingFamilyDefinition | undefined {
  if (!key) return undefined;
  return sizingMap.get(key);
}

export function getActionPreferenceRecord(
  spotKey: SpotTag,
  handClass: CoachHandClass
): ActionPreferenceRecord | undefined {
  return ACTION_PREFERENCE_RECORDS.find((record) => record.spotKey === spotKey && record.handClass === handClass);
}

export function lookupStrategyData(
  spotKey: SpotTag,
  handClass: CoachHandClass,
  preferredSizing?: SizingFamilyKey
): StrategyLookupResult {
  const spot = getSpotStrategyRecord(spotKey);
  const preference = getActionPreferenceRecord(spotKey, handClass);
  const sizingFamily = getSizingFamilyDefinition(preference?.preferredSizing ?? preferredSizing);
  return {
    spot,
    preference,
    sizingFamily,
    confidence: preference?.confidence ?? spot?.confidence ?? "fallback"
  };
}

export function strategyDebugEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem("coach.debugStrategy") === "1";
}
