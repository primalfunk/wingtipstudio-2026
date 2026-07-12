import { TrackPath } from "../TrackPath";
import { createWedgeObstacle, wallThickness } from "./MachineGeometry";
import { SlowZone, TrackMachineContribution } from "./TrackMachineTypes";

export interface MultiLaneSplitterMergerParameters {
  laneCount: number;
  laneWidth: number;
  laneLengthVariance: number;
  laneFrictionVariance: number;
  mergeAngle: number;
  laneBias: number;
}

export function createMultiLaneSplitterMerger(
  path: TrackPath,
  progress: number,
  parameters: MultiLaneSplitterMergerParameters,
): TrackMachineContribution {
  const laneCount = Math.max(2, Math.min(4, Math.round(parameters.laneCount)));
  const baseLength = 7;
  const obstacles = [];
  const slowZones: SlowZone[] = [];

  for (let lane = 1; lane < laneCount; lane += 1) {
    const dividerOffset = (lane - laneCount / 2) * parameters.laneWidth + parameters.laneBias;
    const lengthVariance = 1 + parameters.laneLengthVariance * Math.sin(lane * 2.1);
    const splitterLength = baseLength * 0.72 * lengthVariance;
    const splitterCenter = progress - baseLength * 0.5 + splitterLength * 0.5;
    const sample = path.getSampleAtProgress(splitterCenter);

    obstacles.push(
      createWedgeObstacle(
        `lane-split-${Math.round(progress)}-${lane}`,
        "lane",
        sample.progress,
        dividerOffset,
        splitterLength * 0.5,
        wallThickness / 3,
        0,
        0.28,
        0.22,
      ),
    );
  }

  for (let lane = 0; lane < laneCount; lane += 1) {
    const laneOffset = (lane - (laneCount - 1) / 2) * parameters.laneWidth + parameters.laneBias;
    slowZones.push({
      id: `splitter-lane-slow-${Math.round(progress)}-${lane}`,
      progress,
      length: baseLength * (1 + parameters.laneLengthVariance * 0.25),
      halfWidth: parameters.laneWidth * 0.42,
      damping: 0.985 - lane * parameters.laneFrictionVariance,
      lateralCenter: laneOffset,
      effects: ["split", "create_speed_variance"],
    });
  }

  return {
    obstacles,
    slowZones,
    forceZones: [
      {
        id: `splitter-entry-left-${Math.round(progress)}`,
        progress: progress - baseLength * 0.38,
        length: 3.6,
        halfWidth: parameters.laneWidth * 0.34,
        lateralCenter: -parameters.laneWidth * 0.32,
        forwardImpulse: 0.018,
        lateralImpulse: -0.018,
        effects: ["split", "deterministic_assign", "create_speed_variance"],
      },
      {
        id: `splitter-entry-right-${Math.round(progress)}`,
        progress: progress - baseLength * 0.38,
        length: 3.6,
        halfWidth: parameters.laneWidth * 0.34,
        lateralCenter: parameters.laneWidth * 0.32,
        forwardImpulse: 0.018,
        lateralImpulse: 0.018,
        effects: ["split", "deterministic_assign", "create_speed_variance"],
      },
      {
        id: `splitter-merge-${Math.round(progress)}`,
        progress: progress + baseLength * 0.42,
        length: 2.4,
        halfWidth: parameters.laneWidth * laneCount,
        forwardImpulse: 0.028,
        lateralImpulse: 0,
        effects: ["merge", "amplify_overtakes"],
      },
      {
        id: `splitter-through-flow-${Math.round(progress)}`,
        progress,
        length: baseLength + 1.8,
        halfWidth: parameters.laneWidth * laneCount * 0.55,
        forwardImpulse: 0.01,
        lateralImpulse: 0,
        effects: ["split", "merge", "amplify_overtakes"],
      },
    ],
    patches: [{ id: `splitter-patch-${Math.round(progress)}`, progress, length: baseLength + 2.2, width: parameters.laneWidth * laneCount, color: 0xa0c4ff }],
    spinners: [],
    risingPanels: [],
    swingingArms: [],
    sections: [
      {
        id: `splitter-${Math.round(progress)}`,
        sectionType: "multi_lane_splitter_merger",
        progress,
        length: baseLength + 2.2,
        expectedEffects: ["split", "deterministic_assign", "merge", "amplify_overtakes"],
        preferredPrevious: ["slowdown_patches", "pegboard_scatter_field"],
        preferredNext: ["paddle", "speed_up_zone", "merge_collision_zone"],
      },
    ],
  };
}
