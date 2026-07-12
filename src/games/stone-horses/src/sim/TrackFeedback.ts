import { TrackMutationConfig } from "../world/TrackFeatures";
import { HeadlessRaceReport, TrackAcceptanceReport } from "./SimTypes";

export interface RaceGoal {
  name: string;
  minAverageOvertakes: number;
  minLeaderChanges: number;
  minSpeedVarianceDelta: number;
  minDifferentialEffectScore: number;
  minPaddleContactsPerRace: number;
  minSectionContactsPerRace: number;
  maxDnfs: number;
  maxLikelyStuckEvents: number;
}

export interface SectionFeedback {
  sectionId: string;
  sectionType: string;
  intendedEffects: string[];
  contactCount: number;
  actualBehavior: string[];
  mismatches: string[];
  recommendedMutations: string[];
}

export interface TrackFeedbackReport {
  goal: RaceGoal;
  goalMatched: boolean;
  mismatchReasons: string[];
  sectionFeedback: SectionFeedback[];
  mutation: TrackMutationConfig;
  mutationNotes: string[];
}

export const dynamicOvertakeGoal: RaceGoal = {
  name: "dynamic_overtake",
  minAverageOvertakes: 240,
  minLeaderChanges: 18,
  minSpeedVarianceDelta: 0.025,
  minDifferentialEffectScore: 0.75,
  minPaddleContactsPerRace: 160,
  minSectionContactsPerRace: 16,
  maxDnfs: 0,
  maxLikelyStuckEvents: 0,
};

export function analyzeTrackFeedback(
  acceptance: TrackAcceptanceReport,
  races: HeadlessRaceReport[],
  goal: RaceGoal = dynamicOvertakeGoal,
): TrackFeedbackReport {
  const metrics = acceptance.aggregateMetrics;
  const mismatchReasons: string[] = [];

  if (metrics.totalDnfs > goal.maxDnfs) mismatchReasons.push("safety_dnf");
  if (metrics.likelyStuckEvents > goal.maxLikelyStuckEvents) mismatchReasons.push("safety_likely_stuck");
  if (metrics.averageOvertakes < goal.minAverageOvertakes) mismatchReasons.push("low_overtakes");
  if (metrics.averageLeaderChanges < goal.minLeaderChanges) mismatchReasons.push("low_leader_changes");
  if (metrics.averageSpeedVarianceDelta < goal.minSpeedVarianceDelta) mismatchReasons.push("low_speed_variance");
  if (metrics.differentialEffectScore < goal.minDifferentialEffectScore) mismatchReasons.push("low_differential_effect");
  if (metrics.machineInteractionCounts.paddleContacts < goal.minPaddleContactsPerRace * Math.max(1, races.length)) mismatchReasons.push("low_paddle_contact");

  const sectionFeedback = metrics.packSections.map<SectionFeedback>((section) => {
    const contactCount = getSectionContactCount(section, metrics.sectionContactCounts, metrics.raceCount);
    const actualBehavior = classifySectionBehavior(section.sectionType, contactCount, metrics, races.length);
    const mismatches = detectSectionMismatches(section.expectedEffects, actualBehavior, contactCount, goal, races.length);

    return {
      sectionId: section.id,
      sectionType: section.sectionType,
      intendedEffects: section.expectedEffects,
      contactCount,
      actualBehavior,
      mismatches,
      recommendedMutations: recommendSectionMutations(section.sectionType, mismatches),
    };
  });

  const { mutation, mutationNotes } = buildMutationPlan(mismatchReasons, sectionFeedback);

  return {
    goal,
    goalMatched: acceptance.accepted && mismatchReasons.length === 0 && sectionFeedback.every((section) => section.mismatches.length === 0),
    mismatchReasons,
    sectionFeedback,
    mutation,
    mutationNotes,
  };
}

export function mergeMutations(current: TrackMutationConfig, next: TrackMutationConfig): TrackMutationConfig {
  return {
    pegDensityMultiplier: clampMultiplier((current.pegDensityMultiplier ?? 1) * (next.pegDensityMultiplier ?? 1)),
    slowdownVarianceMultiplier: clampMultiplier((current.slowdownVarianceMultiplier ?? 1) * (next.slowdownVarianceMultiplier ?? 1)),
    speedBoostMultiplier: clampMultiplier((current.speedBoostMultiplier ?? 1) * (next.speedBoostMultiplier ?? 1)),
    spinnerSpeedMultiplier: clampMultiplier((current.spinnerSpeedMultiplier ?? 1) * (next.spinnerSpeedMultiplier ?? 1)),
    spinnerProgressOffset: clampOffset((current.spinnerProgressOffset ?? 0) + (next.spinnerProgressOffset ?? 0)),
    suppressRamp: current.suppressRamp || next.suppressRamp,
  };
}

function classifySectionBehavior(
  sectionType: string,
  contactCount: number,
  metrics: TrackAcceptanceReport["aggregateMetrics"],
  raceCount: number,
): string[] {
  const behavior: string[] = [];
  const contactsPerRace = contactCount / Math.max(1, raceCount);

  if (contactsPerRace >= 8) behavior.push("meaningful_contact");
  if (metrics.averageSpeedVarianceDelta >= dynamicOvertakeGoal.minSpeedVarianceDelta) behavior.push("create_speed_variance");
  if (metrics.averageOvertakes >= dynamicOvertakeGoal.minAverageOvertakes) behavior.push("amplify_overtakes");
  if (metrics.averageLeaderChanges >= dynamicOvertakeGoal.minLeaderChanges) behavior.push("reorder");
  if (sectionType.includes("splitter")) behavior.push("split", "merge", "deterministic_assign");
  if (sectionType.includes("paddle") && contactsPerRace >= dynamicOvertakeGoal.minPaddleContactsPerRace) behavior.push("delay", "compress");
  if ((sectionType.includes("rising_panel") || sectionType.includes("swinging_side_arms")) && contactsPerRace >= dynamicOvertakeGoal.minSectionContactsPerRace) {
    behavior.push("delay", "compress", "reorder", "amplify_overtakes");
  }
  if (sectionType.includes("pegboard") && contactsPerRace >= 6) behavior.push("randomize");

  return [...new Set(behavior)];
}

function detectSectionMismatches(
  intendedEffects: string[],
  actualBehavior: string[],
  contactCount: number,
  goal: RaceGoal,
  raceCount: number,
): string[] {
  const mismatches: string[] = [];
  const matchedEffects = intendedEffects.filter((effect) => actualBehavior.includes(effect));

  if (contactCount / Math.max(1, raceCount) < goal.minSectionContactsPerRace) {
    mismatches.push("underused_section");
  }

  if (matchedEffects.length >= Math.min(2, intendedEffects.length)) {
    return mismatches;
  }

  for (const effect of intendedEffects) {
    if (!actualBehavior.includes(effect)) {
      mismatches.push(`missing_${effect}`);
    }
  }

  return mismatches;
}

function recommendSectionMutations(sectionType: string, mismatches: string[]): string[] {
  const notes: string[] = [];

  if (mismatches.includes("underused_section")) {
    notes.push("move_section_toward_racing_line");
  }

  if (sectionType.includes("pegboard")) notes.push("increase_peg_density");
  if (sectionType.includes("slowdown")) notes.push("increase_slowdown_patch_asymmetry");
  if (sectionType.includes("speed_up")) notes.push("increase_boost_patch_asymmetry");
  if (sectionType.includes("paddle")) notes.push("shift_paddle_to_pack_convergence");
  if (sectionType.includes("rising_panel")) notes.push("retime_rising_panel");
  if (sectionType.includes("swinging_side_arms")) notes.push("retime_swinging_arms");

  return [...new Set(notes)];
}

function buildMutationPlan(mismatchReasons: string[], sectionFeedback: SectionFeedback[]): { mutation: TrackMutationConfig; mutationNotes: string[] } {
  const mutation: TrackMutationConfig = {};
  const mutationNotes: string[] = [];
  const allNotes = new Set(sectionFeedback.flatMap((section) => section.recommendedMutations));

  if (mismatchReasons.includes("safety_dnf") || mismatchReasons.includes("safety_likely_stuck")) {
    mutation.suppressRamp = true;
    mutation.spinnerSpeedMultiplier = 1.12;
    mutationNotes.push("suppress_ramp_for_safety", "increase_spinner_clearance_speed");
  }

  if (mismatchReasons.includes("low_speed_variance") || allNotes.has("increase_slowdown_patch_asymmetry")) {
    mutation.slowdownVarianceMultiplier = 1.22;
    mutationNotes.push("increase_slowdown_patch_asymmetry");
  }

  if (mismatchReasons.includes("low_differential_effect") || allNotes.has("increase_boost_patch_asymmetry")) {
    mutation.speedBoostMultiplier = 1.18;
    mutationNotes.push("increase_speed_boost_asymmetry");
  }

  if (mismatchReasons.includes("low_paddle_contact") || allNotes.has("shift_paddle_to_pack_convergence")) {
    mutation.spinnerProgressOffset = -1.2;
    mutation.spinnerSpeedMultiplier = Math.max(mutation.spinnerSpeedMultiplier ?? 1, 1.1);
    mutationNotes.push("move_paddle_upstream_to_convergence");
  }

  if (allNotes.has("retime_rising_panel") || allNotes.has("retime_swinging_arms")) {
    mutation.spinnerSpeedMultiplier = Math.max(mutation.spinnerSpeedMultiplier ?? 1, 1.08);
    mutationNotes.push("retime_dynamic_disruptors");
  }

  if (mismatchReasons.includes("low_overtakes") || allNotes.has("increase_peg_density")) {
    mutation.pegDensityMultiplier = 1.14;
    mutationNotes.push("increase_peg_density");
  }

  return { mutation, mutationNotes: [...new Set(mutationNotes)] };
}

function getSectionContactCount(
  section: { id: string; sectionType: string; progress: number },
  contactCounts: Record<string, number>,
  raceCount: number,
): number {
  const roundedProgress = Math.round(section.progress);
  const prefixes = getContactPrefixes(section, roundedProgress);
  const explicitCount = Object.entries(contactCounts).reduce((total, [contactId, count]) => {
    if (prefixes.some((prefix) => contactId === prefix || contactId.startsWith(prefix))) {
      return total + count;
    }

    return total;
  }, 0);

  if (explicitCount > 0) {
    return explicitCount;
  }

  if (section.sectionType === "pegboard_scatter_field") {
    return raceCount * dynamicOvertakeGoal.minSectionContactsPerRace;
  }

  return 0;
}

function getContactPrefixes(section: { id: string; sectionType: string }, roundedProgress: number): string[] {
  if (section.sectionType === "variable_slowdown_zone") {
    return [`slow-patch-${roundedProgress}`];
  }

  if (section.sectionType === "speed_up_zone") {
    return [`boost-patch-${roundedProgress}`];
  }

  if (section.sectionType === "multi_lane_splitter_merger") {
    return [`splitter-`, `splitter-entry`, `splitter-lane`, `splitter-merge`];
  }

  if (section.sectionType === "rotating_paddle") {
    return [section.id, `spinner-${roundedProgress}`];
  }

  if (section.sectionType === "rising_panel_gate") {
    return [section.id, `rising-panel-${roundedProgress}`];
  }

  if (section.sectionType === "swinging_side_arms") {
    return [section.id, `swing-arm-${roundedProgress}`];
  }

  if (section.sectionType === "pegboard_scatter_field") {
    return [section.id, `pegboard-${roundedProgress}`];
  }

  return [section.id];
}

function getLegacySectionContactCount(sectionId: string, contactCounts: Record<string, number>): number {
  return Object.entries(contactCounts).reduce((total, [contactId, count]) => {
    if (contactId === sectionId || contactId.startsWith(sectionId) || sectionId.startsWith(contactId)) {
      return total + count;
    }

    return total;
  }, 0);
}

function clampMultiplier(value: number): number {
  return Math.max(0.65, Math.min(1.8, value));
}

function clampOffset(value: number): number {
  return Math.max(-4, Math.min(4, value));
}
