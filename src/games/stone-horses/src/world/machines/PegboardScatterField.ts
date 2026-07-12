import { SeededRng } from "../../utils/seededRng";
import { TrackPath } from "../TrackPath";
import { createPegObstacle, marbleDiameter, minimumMachineClearance } from "./MachineGeometry";
import { TrackMachineContribution } from "./TrackMachineTypes";

export interface PegboardScatterFieldParameters {
  pegDensity: number;
  pegRadius: number;
  fieldLength: number;
  fieldWidth: number;
  lateralBias: number;
  shuffleIntensity: number;
}

export function createPegboardScatterField(
  path: TrackPath,
  progress: number,
  rng: SeededRng,
  parameters: PegboardScatterFieldParameters,
): TrackMachineContribution {
  const obstacles = [];
  const rowSpacing = Math.max(marbleDiameter * 2.25, 1.3 / parameters.pegDensity);
  const columnSpacing = Math.max(marbleDiameter * 2.35, 1.28 / parameters.pegDensity);
  const rows = Math.max(3, Math.floor(parameters.fieldLength / rowSpacing));

  for (let row = 0; row < rows; row += 1) {
    const rowProgress = progress - parameters.fieldLength / 2 + row * rowSpacing;
    const sample = path.getSampleAtProgress(rowProgress);
    const usableHalfWidth = Math.min(parameters.fieldWidth / 2, sample.width / 2 - minimumMachineClearance);
    const columns = usableHalfWidth < columnSpacing * 0.75 ? 1 : Math.max(2, Math.floor((usableHalfWidth * 2) / columnSpacing));

    for (let column = 0; column < columns; column += 1) {
      const centered = column - (columns - 1) / 2;
      const stagger = row % 2 === 0 ? -columnSpacing * 0.22 : columnSpacing * 0.22;
      const offset =
        centered * columnSpacing +
        stagger +
        parameters.lateralBias +
        rng.nextBetween(-parameters.shuffleIntensity, parameters.shuffleIntensity);

      if (Math.abs(offset) > usableHalfWidth) {
        continue;
      }

      obstacles.push(createPegObstacle(`pegboard-${Math.round(progress)}-${row}-${column}`, sample.progress, offset, parameters.pegRadius));
    }
  }

  return {
    obstacles,
    slowZones: [],
    forceZones: [
      {
        id: `pegboard-flow-${Math.round(progress)}`,
        progress,
        length: parameters.fieldLength + 1.2,
        halfWidth: parameters.fieldWidth * 0.5,
        forwardImpulse: 0.009,
        lateralImpulse: 0,
        effects: ["randomize", "amplify_overtakes"],
      },
    ],
    patches: [{ id: `pegboard-patch-${Math.round(progress)}`, progress, length: parameters.fieldLength, width: parameters.fieldWidth, color: 0x7bdff2 }],
    spinners: [],
    risingPanels: [],
    swingingArms: [],
    sections: [
      {
        id: `pegboard-${Math.round(progress)}`,
        sectionType: "pegboard_scatter_field",
        progress,
        length: parameters.fieldLength,
        expectedEffects: ["randomize", "split", "create_speed_variance", "amplify_overtakes"],
        preferredPrevious: ["deterministic_assigner", "speed_up_zone"],
        preferredNext: ["funnel_compressor", "merge", "paddle"],
      },
    ],
  };
}
