import { TrackPath } from "../TrackPath";
import { createBoxObstacle, getRotatedHalfLength, getRotatedHalfWidth, marbleDiameter, wallThickness } from "./MachineGeometry";
import { TrackMachineContribution } from "./TrackMachineTypes";

export interface FunnelBowlParameters {
  bowlRadius: number;
  bowlDepth: number;
  exitWidth: number;
  exitOffset: number;
  surfaceFriction: number;
  exitBiasStrength: number;
}

export function createFunnelBowl(path: TrackPath, progress: number, parameters: FunnelBowlParameters): TrackMachineContribution {
  const obstacles = [];
  const wallCount = 4;
  const length = parameters.bowlRadius * 0.38;
  const exitWidth = Math.max(parameters.exitWidth, marbleDiameter * 3.5);

  for (let i = 0; i < wallCount; i += 1) {
    const t = i / (wallCount - 1);
    const sample = path.getSampleAtProgress(progress - parameters.bowlRadius * 0.65 + t * parameters.bowlRadius * 1.3);
    const side = i % 2 === 0 ? -1 : 1;
    const laneHalfWidth = Math.max(exitWidth / 2, sample.width * (0.42 - t * 0.1));
    const lateralOffset = side * laneHalfWidth;
    const yaw = side * (0.12 + t * 0.08);
    const halfLength = getRotatedHalfLength(wallThickness / 2, length / 2, yaw);
    const halfWidth = getRotatedHalfWidth(wallThickness / 2, length / 2, yaw);

    obstacles.push(
      createBoxObstacle(
        `funnel-bowl-${Math.round(progress)}-${i}`,
        "funnel",
        sample.progress,
        lateralOffset,
        halfLength,
        halfWidth,
        yaw,
        parameters.surfaceFriction,
        0.18,
      ),
    );
  }

  return {
    obstacles,
    slowZones: [
      {
        id: `funnel-slow-${Math.round(progress)}`,
        progress,
        length: parameters.bowlRadius * 1.25,
        halfWidth: parameters.bowlRadius,
        damping: 0.996,
        effects: ["compress", "merge", "reset_spacing"],
      },
    ],
    forceZones: [
      {
        id: `funnel-exit-${Math.round(progress)}`,
        progress: progress + parameters.bowlRadius * 0.35,
        length: parameters.bowlRadius,
        halfWidth: parameters.bowlRadius,
        forwardImpulse: Math.max(parameters.exitBiasStrength, 0.04),
        lateralImpulse: parameters.exitOffset * 0.004,
        effects: ["merge", "reset_spacing"],
      },
    ],
    patches: [{ id: `funnel-patch-${Math.round(progress)}`, progress, length: parameters.bowlRadius * 2.1, width: parameters.bowlRadius * 2, color: 0x55c98f }],
    spinners: [],
    risingPanels: [],
    swingingArms: [],
    sections: [
      {
        id: `funnel-${Math.round(progress)}`,
        sectionType: "funnel_compressor",
        progress,
        length: parameters.bowlRadius * 2.1,
        expectedEffects: ["compress", "merge", "reset_spacing"],
        preferredPrevious: ["randomizer", "pegboard_scatter_field"],
        preferredNext: ["paddle", "speed_up_zone"],
      },
    ],
  };
}
