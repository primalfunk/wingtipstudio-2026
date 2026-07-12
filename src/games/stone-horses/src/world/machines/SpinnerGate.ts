import { MathUtils } from "three";
import { TrackPath } from "../TrackPath";
import { TrackObstacle } from "../TrackSafetyValidator";
import { marbleDiameter, minimumMachineClearance } from "./MachineGeometry";
import { SpinnerSpec, TrackMachineContribution } from "./TrackMachineTypes";

export interface SpinnerGateParameters {
  armCount: number;
  armLength: number;
  rotationSpeed: number;
  rotationDirection: 1 | -1;
  phaseOffset: number;
  gapSize: number;
}

export function createSpinnerGate(
  path: TrackPath,
  progress: number,
  parameters: SpinnerGateParameters,
): TrackMachineContribution {
  const sample = path.getSampleAtProgress(progress);
  const armLength = MathUtils.clamp(parameters.armLength, marbleDiameter, Math.max(marbleDiameter, sample.width - 0.55));
  const gapSize = Math.max(parameters.gapSize, marbleDiameter * 3);
  const spinner: SpinnerSpec = {
    id: `spinner-${Math.round(progress)}`,
    progress,
    armCount: 1,
    armLength,
    armThickness: 0.46,
    rotationSpeed: Math.min(Math.abs(parameters.rotationSpeed), 1.7),
    rotationDirection: parameters.rotationDirection,
    phaseOffset: parameters.phaseOffset,
    gapSize,
  };

  return {
    obstacles: [
      {
        id: `${spinner.id}-safety`,
        shape: "box",
        material: "spinner",
        progress: spinner.progress,
        lateralOffset: 0,
        halfLength: spinner.armLength,
        halfWidth: Math.min(0.52, spinner.armLength * 0.28),
        height: 0.2,
        yawOffset: 0,
        friction: 0.4,
        restitution: 0.34,
        movingGapSize: gapSize,
      },
    ],
    slowZones: [],
    forceZones: [],
    patches: [{ id: `spinner-patch-${Math.round(progress)}`, progress, length: 2.9, width: sample.width * 0.96, color: 0xf59f00 }],
    spinners: [spinner],
    risingPanels: [],
    swingingArms: [],
    sections: [
      {
        id: `spinner-${Math.round(progress)}`,
        sectionType: "rotating_paddle",
        progress,
        length: 2.9,
        expectedEffects: ["delay", "reorder", "compress", "amplify_overtakes"],
        preferredPrevious: ["funnel_compressor", "lane_merge", "randomizer_exit"],
        preferredNext: ["speed_up_zone", "variable_slowdown_zone", "merge"],
      },
    ],
  };
}
