import { TrackPath } from "../TrackPath";
import { RisingPanelSpec, TrackMachineContribution } from "./TrackMachineTypes";

export interface RisingPanelGateParameters {
  cycleTime: number;
  upDuration: number;
  riseSpeed: number;
  height: number;
  coverageWidth: number;
  phaseOffset: number;
  segments: number;
}

export function createRisingPanelGate(
  path: TrackPath,
  progress: number,
  parameters: RisingPanelGateParameters,
): TrackMachineContribution {
  const sample = path.getSampleAtProgress(progress);
  const coverageWidth = Math.min(parameters.coverageWidth, sample.width - 0.55);
  const segmentCount = Math.max(1, Math.round(parameters.segments));
  const panelWidth = coverageWidth / segmentCount;
  const panels: RisingPanelSpec[] = [];

  for (let index = 0; index < segmentCount; index += 1) {
    panels.push({
      id: `rising-panel-${Math.round(progress)}-${index}`,
      progress,
      lateralCenter: -coverageWidth / 2 + panelWidth * (index + 0.5),
      width: panelWidth * 0.94,
      thickness: 0.34,
      height: parameters.height,
      cycleTime: parameters.cycleTime,
      upDuration: parameters.upDuration,
      riseSpeed: parameters.riseSpeed,
      phaseOffset: parameters.phaseOffset + index * parameters.cycleTime * 0.18,
    });
  }

  return {
    obstacles: [],
    slowZones: [],
    forceZones: [],
    patches: [{ id: `rising-panel-patch-${Math.round(progress)}`, progress, length: 2.1, width: coverageWidth, color: 0xff6b35 }],
    spinners: [],
    risingPanels: panels,
    swingingArms: [],
    sections: [
      {
        id: `rising-panel-${Math.round(progress)}`,
        sectionType: "rising_panel_gate",
        progress,
        length: 2.1,
        expectedEffects: ["delay", "compress", "reorder", "amplify_overtakes"],
        preferredPrevious: ["funnel_compressor", "randomizer_exit", "merge"],
        preferredNext: ["speed_up_zone", "variable_slowdown_zone", "merge_collision_zone"],
      },
    ],
  };
}
