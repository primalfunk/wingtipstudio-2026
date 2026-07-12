import { TrackPath } from "../TrackPath";
import { SwingingArmSpec, TrackMachineContribution } from "./TrackMachineTypes";

export interface SwingingSideArmsParameters {
  swingAngle: number;
  cycleTime: number;
  phaseOffset: number;
  armLength: number;
  collisionForce: number;
  alternating: boolean;
}

export function createSwingingSideArms(
  path: TrackPath,
  progress: number,
  parameters: SwingingSideArmsParameters,
): TrackMachineContribution {
  const sample = path.getSampleAtProgress(progress);
  const armLength = Math.min(parameters.armLength, sample.width * 0.46);
  const arms: SwingingArmSpec[] = [-1, 1].map((side) => ({
    id: `swing-arm-${Math.round(progress)}-${side}`,
    progress,
    side: side as -1 | 1,
    armLength,
    armThickness: 0.28,
    swingAngle: parameters.swingAngle,
    cycleTime: parameters.cycleTime,
    phaseOffset: parameters.phaseOffset + (parameters.alternating && side === 1 ? parameters.cycleTime * 0.45 : 0),
    collisionForce: parameters.collisionForce,
  }));

  return {
    obstacles: [],
    slowZones: [],
    forceZones: [],
    patches: [{ id: `swing-arm-patch-${Math.round(progress)}`, progress, length: 2.7, width: sample.width * 0.9, color: 0xff9f1c }],
    spinners: [],
    risingPanels: [],
    swingingArms: arms,
    sections: [
      {
        id: `swing-arm-${Math.round(progress)}`,
        sectionType: "swinging_side_arms",
        progress,
        length: 2.7,
        expectedEffects: ["delay", "split", "reorder", "amplify_overtakes"],
        preferredPrevious: ["funnel_compressor", "compression", "slowdown_patches"],
        preferredNext: ["lane_split", "merge", "speed_up_zone"],
      },
    ],
  };
}
