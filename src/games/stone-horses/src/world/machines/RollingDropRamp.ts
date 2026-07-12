import { TrackPath } from "../TrackPath";
import { marbleDiameter } from "./MachineGeometry";
import { TrackMachineContribution } from "./TrackMachineTypes";

export interface RollingDropRampParameters {
  compressionStrength: number;
  minimumGap: number;
  meteringSpeed: number;
  rampSlope: number;
  releaseWidth: number;
  maxDelaySeconds: number;
}

export function createRollingDropRamp(
  path: TrackPath,
  progress: number,
  parameters: RollingDropRampParameters,
): TrackMachineContribution {
  const length = 4.4;
  const minimumGap = Math.max(parameters.minimumGap, marbleDiameter * 3);

  return {
    obstacles: [],
    slowZones: [
      {
        id: `drop-ramp-slow-${Math.round(progress)}`,
        progress,
        length,
        halfWidth: parameters.releaseWidth + parameters.compressionStrength,
        damping: 0.996,
        effects: ["compress", "delay"],
      },
    ],
    forceZones: [
      {
        id: `drop-ramp-release-${Math.round(progress)}`,
        progress: progress + length * 0.36,
        length: length * 0.45,
        halfWidth: parameters.releaseWidth + parameters.compressionStrength,
        forwardImpulse: Math.max(0.024, parameters.meteringSpeed * 0.012 + parameters.rampSlope * 0.02),
        lateralImpulse: 0,
        effects: ["reset_spacing", "create_speed_variance"],
      },
      {
        id: `drop-ramp-through-flow-${Math.round(progress)}`,
        progress,
        length,
        halfWidth: minimumGap,
        forwardImpulse: 0.012,
        lateralImpulse: 0,
        effects: ["compress", "delay", "reset_spacing"],
      },
    ],
    patches: [{ id: `drop-ramp-patch-${Math.round(progress)}`, progress, length, width: parameters.releaseWidth * 2 + parameters.compressionStrength * 2, color: 0xcdb4db }],
    spinners: [],
    risingPanels: [],
    swingingArms: [],
    sections: [
      {
        id: `drop-ramp-${Math.round(progress)}`,
        sectionType: "rolling_drop_ramp",
        progress,
        length,
        expectedEffects: ["compress", "delay", "reset_spacing"],
        preferredPrevious: ["speed_variance_zone", "randomizer"],
        preferredNext: ["speed_up_zone", "merge"],
      },
    ],
  };
}
