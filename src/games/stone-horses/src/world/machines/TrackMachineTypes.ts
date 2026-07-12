import type RAPIER from "@dimforge/rapier3d";
import { Group, Mesh, Vector3 } from "three";
import { Marble } from "../Marble";
import { PhysicsWorld } from "../PhysicsWorld";
import { TrackObstacle } from "../TrackSafetyValidator";
import { TrackPath } from "../TrackPath";

export interface SlowZone {
  id: string;
  progress: number;
  length: number;
  halfWidth: number;
  damping: number;
  lateralCenter?: number;
  stochasticStrength?: number;
  effects?: PackEffect[];
}

export interface ForceZone {
  id: string;
  progress: number;
  length: number;
  halfWidth: number;
  forwardImpulse: number;
  lateralImpulse: number;
  lateralCenter?: number;
  stochasticStrength?: number;
  effects?: PackEffect[];
}

export interface FlatPatch {
  id?: string;
  progress: number;
  length: number;
  width: number;
  color: number;
  lateralCenter?: number;
}

export interface SpinnerSpec {
  id: string;
  progress: number;
  armCount: number;
  armLength: number;
  armThickness: number;
  rotationSpeed: number;
  rotationDirection: 1 | -1;
  phaseOffset: number;
  gapSize: number;
}

export interface RisingPanelSpec {
  id: string;
  progress: number;
  lateralCenter: number;
  width: number;
  thickness: number;
  height: number;
  cycleTime: number;
  upDuration: number;
  riseSpeed: number;
  phaseOffset: number;
}

export interface SwingingArmSpec {
  id: string;
  progress: number;
  side: -1 | 1;
  armLength: number;
  armThickness: number;
  swingAngle: number;
  cycleTime: number;
  phaseOffset: number;
  collisionForce: number;
}

export interface BuiltSpinner {
  meshes: Mesh[];
  bodies: RAPIER.RigidBody[];
  spec: SpinnerSpec;
  center: Vector3;
  baseYaw: number;
}

export interface TrackMachineContribution {
  obstacles: TrackObstacle[];
  slowZones: SlowZone[];
  forceZones: ForceZone[];
  patches: FlatPatch[];
  spinners: SpinnerSpec[];
  risingPanels: RisingPanelSpec[];
  swingingArms: SwingingArmSpec[];
  sections: PackSection[];
}

export type PackEffect =
  | "randomize"
  | "compress"
  | "split"
  | "merge"
  | "delay"
  | "reorder"
  | "deterministic_assign"
  | "amplify_overtakes"
  | "reset_spacing"
  | "create_speed_variance";

export interface PackSection {
  id: string;
  sectionType: string;
  progress: number;
  length: number;
  expectedEffects: PackEffect[];
  preferredPrevious: string[];
  preferredNext: string[];
}

export interface ActiveMachine {
  update: (deltaTime: number, marbles: Marble[], leaderId: string | null) => MachineUpdateStats;
}

export interface MachineUpdateStats {
  paddleContacts: number;
  paddleLeaderContacts: number;
  sectionContactCounts: Record<string, number>;
}

export interface MachineBuildContext {
  RAPIERApi: typeof RAPIER;
  physics: PhysicsWorld;
  root: Group;
  path: TrackPath;
}

export function emptyContribution(): TrackMachineContribution {
  return {
    obstacles: [],
    slowZones: [],
    forceZones: [],
    patches: [],
    spinners: [],
    risingPanels: [],
    swingingArms: [],
    sections: [],
  };
}

export function mergeContributions(contributions: TrackMachineContribution[]): TrackMachineContribution {
  return contributions.reduce<TrackMachineContribution>(
    (merged, contribution) => ({
      obstacles: [...merged.obstacles, ...contribution.obstacles],
      slowZones: [...merged.slowZones, ...contribution.slowZones],
      forceZones: [...merged.forceZones, ...contribution.forceZones],
      patches: [...merged.patches, ...contribution.patches],
      spinners: [...merged.spinners, ...contribution.spinners],
      risingPanels: [...merged.risingPanels, ...contribution.risingPanels],
      swingingArms: [...merged.swingingArms, ...contribution.swingingArms],
      sections: [...merged.sections, ...contribution.sections],
    }),
    emptyContribution(),
  );
}
