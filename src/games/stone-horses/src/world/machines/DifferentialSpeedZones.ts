import { SeededRng } from "../../utils/seededRng";
import { TrackPath } from "../TrackPath";
import { ForceZone, SlowZone, TrackMachineContribution } from "./TrackMachineTypes";

export interface VariableSlowdownZoneParameters {
  length: number;
  width: number;
  patchCount: number;
  baseDamping: number;
  variance: number;
}

export interface SpeedUpZoneParameters {
  length: number;
  width: number;
  patchCount: number;
  baseImpulse: number;
  variance: number;
}

export function createVariableSlowdownZone(
  path: TrackPath,
  progress: number,
  rng: SeededRng,
  parameters: VariableSlowdownZoneParameters,
): TrackMachineContribution {
  const zones: SlowZone[] = [];
  const patches = [];
  const patchWidth = parameters.width / parameters.patchCount;
  const sample = path.getSampleAtProgress(progress);
  const usableWidth = Math.min(parameters.width, sample.width - 0.75);

  for (let i = 0; i < parameters.patchCount; i += 1) {
    const t = parameters.patchCount === 1 ? 0.5 : i / (parameters.patchCount - 1);
    const lateralCenter = -usableWidth / 2 + patchWidth * (i + 0.5);
    const damping = parameters.baseDamping - rng.nextBetween(0, parameters.variance) * (i % 2 === 0 ? 1 : 0.45);
    const id = `slow-patch-${Math.round(progress)}-${i}`;

    zones.push({
      id,
      progress: progress + rng.nextBetween(-0.35, 0.35),
      length: parameters.length * rng.nextBetween(0.42, 0.68),
      halfWidth: patchWidth * rng.nextBetween(0.38, 0.55),
      lateralCenter: lateralCenter + rng.nextBetween(-0.12, 0.12),
      damping: Math.max(0.94, damping),
      stochasticStrength: rng.nextBetween(0.002, 0.008),
      effects: ["randomize", "split", "create_speed_variance", "amplify_overtakes"],
    });
    patches.push({
      id: `${id}-visual`,
      progress: progress + (t - 0.5) * parameters.length * 0.25,
      length: parameters.length * 0.44,
      width: patchWidth * 0.86,
      lateralCenter,
      color: i % 2 === 0 ? 0x5aa9e6 : 0x93c5fd,
    });
  }

  return {
    obstacles: [],
    slowZones: zones,
    forceZones: [],
    patches,
    spinners: [],
    risingPanels: [],
    swingingArms: [],
    sections: [
      {
        id: `variable-slowdown-${Math.round(progress)}`,
        sectionType: "variable_slowdown_zone",
        progress,
        length: parameters.length,
        expectedEffects: ["randomize", "split", "create_speed_variance", "amplify_overtakes"],
        preferredPrevious: ["funnel_compressor", "paddle", "randomizer"],
        preferredNext: ["merge", "overtake_zone", "speed_up_zone"],
      },
    ],
  };
}

export function createSpeedUpZone(
  path: TrackPath,
  progress: number,
  rng: SeededRng,
  parameters: SpeedUpZoneParameters,
): TrackMachineContribution {
  const zones: ForceZone[] = [];
  const patches = [];
  const sample = path.getSampleAtProgress(progress);
  const usableWidth = Math.min(parameters.width, sample.width - 0.75);
  const patchWidth = usableWidth / parameters.patchCount;
  const highValueLane = rng.nextInt(0, parameters.patchCount);

  for (let i = 0; i < parameters.patchCount; i += 1) {
    const lateralCenter = -usableWidth / 2 + patchWidth * (i + 0.5);
    const isHighValue = i === highValueLane;
    const id = `boost-patch-${Math.round(progress)}-${i}`;

    zones.push({
      id,
      progress: progress + rng.nextBetween(-0.45, 0.45),
      length: parameters.length * rng.nextBetween(0.38, 0.62),
      halfWidth: patchWidth * rng.nextBetween(0.34, 0.5),
      lateralCenter: lateralCenter + rng.nextBetween(-0.1, 0.1),
      forwardImpulse: parameters.baseImpulse * (isHighValue ? rng.nextBetween(1.25, 1.7) : rng.nextBetween(0.55, 0.95)),
      lateralImpulse: rng.nextBetween(-0.004, 0.004),
      stochasticStrength: rng.nextBetween(0.002, 0.006),
      effects: ["split", "reorder", "create_speed_variance", "amplify_overtakes"],
    });
    patches.push({
      id: `${id}-visual`,
      progress: progress + rng.nextBetween(-0.25, 0.25),
      length: parameters.length * 0.42,
      width: patchWidth * 0.82,
      lateralCenter,
      color: isHighValue ? 0x7cff6b : 0xb7ff9a,
    });
  }

  return {
    obstacles: [],
    slowZones: [],
    forceZones: zones,
    patches,
    spinners: [],
    risingPanels: [],
    swingingArms: [],
    sections: [
      {
        id: `speed-up-${Math.round(progress)}`,
        sectionType: "speed_up_zone",
        progress,
        length: parameters.length,
        expectedEffects: ["split", "reorder", "create_speed_variance", "amplify_overtakes"],
        preferredPrevious: ["paddle", "slowdown_zone", "deterministic_assigner"],
        preferredNext: ["merge_collision_zone", "narrow_choke", "splitter"],
      },
    ],
  };
}
