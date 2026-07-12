import {
  BufferAttribute,
  BufferGeometry,
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  RingGeometry,
  Vector3,
} from "three";
import type RAPIER from "@dimforge/rapier3d";
import { createSeededRng, SeededRng } from "../utils/seededRng";
import { Marble } from "./Marble";
import { PhysicsWorld } from "./PhysicsWorld";
import { AntiStallDiagnostic, FeatureUpdateStats, TrackValidationTelemetry } from "./RaceTelemetry";
import { TrackObstacle, TrackObstacleMaterial, TrackSafetyValidator } from "./TrackSafetyValidator";
import { TrackPath, TrackSample } from "./TrackPath";
import { createFunnelBowl } from "./machines/FunnelBowl";
import { createSpeedUpZone, createVariableSlowdownZone } from "./machines/DifferentialSpeedZones";
import { createMultiLaneSplitterMerger } from "./machines/MultiLaneSplitterMerger";
import { createPegboardScatterField } from "./machines/PegboardScatterField";
import { createRisingPanelGate } from "./machines/RisingPanelGate";
import { createRollingDropRamp } from "./machines/RollingDropRamp";
import { createSpinnerGate } from "./machines/SpinnerGate";
import { createSwingingSideArms } from "./machines/SwingingSideArms";
import {
  ActiveMachine,
  BuiltSpinner,
  FlatPatch,
  ForceZone,
  mergeContributions,
  MachineUpdateStats,
  RisingPanelSpec,
  SlowZone,
  SpinnerSpec,
  SwingingArmSpec,
  TrackMachineContribution,
} from "./machines/TrackMachineTypes";
import { marbleRadius, wallHeight } from "./machines/MachineGeometry";

export interface TrackFeatureSystem {
  root: Group;
  validationTelemetry: TrackValidationTelemetry;
  update: (marbles: Marble[], deltaTime: number) => FeatureUpdateStats;
}

export type TrackMachineType = "pegboard" | "funnel" | "spinner" | "splitter" | "ramp" | "panel" | "arms";

export interface TrackFeatureOptions {
  disabledMachines?: Iterable<TrackMachineType>;
  mutation?: TrackMutationConfig;
}

export interface TrackMutationConfig {
  pegDensityMultiplier?: number;
  slowdownVarianceMultiplier?: number;
  speedBoostMultiplier?: number;
  spinnerSpeedMultiplier?: number;
  spinnerProgressOffset?: number;
  suppressRamp?: boolean;
}

const up = new Vector3(0, 1, 0);

export function createTrackFeatureSystem(
  RAPIERApi: typeof RAPIER,
  physics: PhysicsWorld,
  path: TrackPath,
  seed: string,
  options: TrackFeatureOptions = {},
): TrackFeatureSystem {
  const rng = createSeededRng(`${seed}:track-machines`);
  const root = new Group();
  const plannedContribution = mergeContributions(planMachines(path, rng, new Set(options.disabledMachines ?? []), options.mutation ?? {}));
  const localProbeResult = runLocalMachineSafetyProbes(path, plannedContribution.obstacles);
  const contribution: TrackMachineContribution = {
    ...plannedContribution,
    obstacles: plannedContribution.obstacles.filter((obstacle) => !localProbeResult.failedMachineIds.has(getMachineGroupId(obstacle.id))),
    spinners: plannedContribution.spinners.filter((spinner) => !localProbeResult.failedMachineIds.has(spinner.id)),
  };
  const validation = new TrackSafetyValidator(path).validateAndRepair(contribution.obstacles);
  const removedObstacleIds = new Set(validation.removedObstacleIds);
  const activeMachines: ActiveMachine[] = [];
  const antiStallState = new Map<string, { lastProgress: number; lowProgressSeconds: number; reported: boolean }>();
  let elapsedTime = 0;
  let frame = 0;

  for (const patch of contribution.patches) {
    root.add(makeTrackAlignedPatch(path, patch));
  }

  for (const obstacle of validation.obstacles) {
    if (obstacle.material === "spinner") {
      continue;
    }

    buildObstacle(RAPIERApi, physics, root, path, obstacle);
  }

  for (const spinner of contribution.spinners) {
    if (removedObstacleIds.has(`${spinner.id}-safety`)) {
      continue;
    }

    activeMachines.push(buildSpinner(RAPIERApi, physics, root, path, spinner));
  }

  for (const panel of contribution.risingPanels) {
    activeMachines.push(buildRisingPanel(RAPIERApi, physics, root, path, panel));
  }

  for (const arm of contribution.swingingArms) {
    activeMachines.push(buildSwingingArm(RAPIERApi, physics, root, path, arm));
  }

  return {
    root,
    validationTelemetry: {
      machineCount: contribution.patches.length,
      obstacleCount: plannedContribution.obstacles.length,
      repairedObstacleCount: validation.repairedObstacleIds.length,
      removedObstacleCount: validation.removedObstacleIds.length + localProbeResult.removedObstacleCount,
      localProbeFailureCount: localProbeResult.failedMachineIds.size,
      packSections: contribution.sections.map((section) => ({
        id: section.id,
        sectionType: section.sectionType,
        progress: Math.round(section.progress * 100) / 100,
        expectedEffects: section.expectedEffects,
      })),
    },
    update: (marbles: Marble[], deltaTime: number): FeatureUpdateStats => {
      const stats: FeatureUpdateStats = {
        slowZoneHits: 0,
        forceZoneHits: 0,
        variableSlowdownHits: 0,
        speedBoostHits: 0,
        speedVarianceSamples: [],
        paddleContacts: 0,
        paddleLeaderContacts: 0,
        sectionContactCounts: {},
        antiStallNudges: 0,
        antiStallDiagnostics: [],
      };
      elapsedTime += deltaTime;
      frame += 1;

      const leaderId = getLeaderId(path, marbles);

      for (const machine of activeMachines) {
        const machineStats = machine.update(deltaTime, marbles, leaderId);
        stats.paddleContacts += machineStats.paddleContacts;
        stats.paddleLeaderContacts += machineStats.paddleLeaderContacts;
        addSectionContacts(stats.sectionContactCounts, machineStats.sectionContactCounts);
      }

      for (const marble of marbles) {
        const slowResult = applySlowZones(marble, path, contribution.slowZones);
        const forceResult = applyForceZones(marble, path, contribution.forceZones);
        stats.slowZoneHits += slowResult.hits;
        stats.variableSlowdownHits += slowResult.variableHits;
        stats.forceZoneHits += forceResult.hits;
        stats.speedBoostHits += forceResult.boostHits;
        stats.speedVarianceSamples.push(...slowResult.speedSamples, ...forceResult.speedSamples);
        addSectionContacts(stats.sectionContactCounts, slowResult.sectionContactCounts);
        addSectionContacts(stats.sectionContactCounts, forceResult.sectionContactCounts);
        const diagnostic = diagnosePermanentTrap(marble, path, validation.obstacles, antiStallState, frame, elapsedTime, deltaTime);

        if (diagnostic) {
          stats.antiStallNudges += 1;
          stats.antiStallDiagnostics.push(diagnostic);
        }
      }

      return stats;
    },
  };
}

function planMachines(
  path: TrackPath,
  rng: SeededRng,
  disabledMachines: Set<TrackMachineType>,
  mutation: TrackMutationConfig,
): TrackMachineContribution[] {
  const progressSlots = createMachineProgressSlots(path, rng);
  const contributions: TrackMachineContribution[] = [];
  const pegDensityMultiplier = mutation.pegDensityMultiplier ?? 1;
  const slowdownVarianceMultiplier = mutation.slowdownVarianceMultiplier ?? 1;
  const speedBoostMultiplier = mutation.speedBoostMultiplier ?? 1;
  const spinnerSpeedMultiplier = mutation.spinnerSpeedMultiplier ?? 1;

  if (!disabledMachines.has("pegboard")) {
    contributions.push(
      createPegboardScatterField(path, progressSlots[0], rng, {
        pegDensity: rng.nextBetween(0.82, 1.05) * pegDensityMultiplier,
        pegRadius: rng.nextBetween(0.085, 0.115),
        fieldLength: rng.nextBetween(7.6, 9.4),
        fieldWidth: 3.6,
        lateralBias: rng.nextBetween(-0.14, 0.14),
        shuffleIntensity: rng.nextBetween(0.06, 0.12),
      }),
    );
  }

  if (!disabledMachines.has("splitter")) {
    contributions.push(
      createMultiLaneSplitterMerger(path, progressSlots[2], {
        laneCount: 2,
        laneWidth: rng.nextBetween(1.85, 2.05),
        laneLengthVariance: rng.nextBetween(0.03, 0.08),
        laneFrictionVariance: rng.nextBetween(0.0005, 0.002),
        mergeAngle: rng.nextBetween(0.1, 0.2),
        laneBias: rng.nextBetween(-0.08, 0.08),
      }),
    );
  }

  contributions.push(
    createVariableSlowdownZone(path, progressSlots[1] + path.finishProgress * 0.06, rng, {
      length: rng.nextBetween(4.6, 6.2),
      width: rng.nextBetween(3.2, 4.2),
      patchCount: rng.nextInt(3, 5),
      baseDamping: rng.nextBetween(0.982, 0.992),
      variance: rng.nextBetween(0.018, 0.034) * slowdownVarianceMultiplier,
    }),
  );

  if (!disabledMachines.has("funnel") && disabledMachines.has("spinner")) {
    contributions.push(
      createFunnelBowl(path, progressSlots[1], {
        bowlRadius: rng.nextBetween(2.2, 2.6),
        bowlDepth: rng.nextBetween(0.12, 0.22),
        exitWidth: rng.nextBetween(2.4, 2.9),
        exitOffset: rng.nextBetween(-0.24, 0.24),
        surfaceFriction: rng.nextBetween(0.58, 0.7),
        exitBiasStrength: rng.nextBetween(0.028, 0.04),
      }),
    );
  } else if (!disabledMachines.has("spinner")) {
    contributions.push(
      createSpinnerGate(path, progressSlots[1] + (mutation.spinnerProgressOffset ?? 0), {
        armCount: 1,
        armLength: rng.nextBetween(4.8, 5.9),
        rotationSpeed: rng.nextBetween(1.15, 1.65) * spinnerSpeedMultiplier,
        rotationDirection: -1,
        phaseOffset: rng.nextBetween(0, Math.PI * 2),
        gapSize: rng.nextBetween(2.1, 2.7),
      }),
    );
    contributions.push(
      createSpinnerGate(path, progressSlots[3] - path.finishProgress * 0.05 + (mutation.spinnerProgressOffset ?? 0) * 0.45, {
        armCount: 1,
        armLength: rng.nextBetween(4.7, 5.7),
        rotationSpeed: rng.nextBetween(1.05, 1.55) * spinnerSpeedMultiplier,
        rotationDirection: -1,
        phaseOffset: rng.nextBetween(0, Math.PI * 2),
        gapSize: rng.nextBetween(2.1, 2.7),
      }),
    );
  }

  if (!mutation.suppressRamp && !disabledMachines.has("ramp") && rng.next() > 0.96) {
    contributions.push(
      createRollingDropRamp(path, progressSlots[3], {
        compressionStrength: rng.nextBetween(0.35, 0.7),
        minimumGap: 2.1,
        meteringSpeed: rng.nextBetween(0.9, 1.35),
        rampSlope: rng.nextBetween(0.35, 0.62),
        releaseWidth: rng.nextBetween(1.35, 1.7),
        maxDelaySeconds: 1.8,
      }),
    );
  }

  contributions.push(
    createSpeedUpZone(path, progressSlots[3] + path.finishProgress * 0.05, rng, {
      length: rng.nextBetween(4.2, 6.4),
      width: rng.nextBetween(3.2, 4.4),
      patchCount: rng.nextInt(3, 5),
      baseImpulse: rng.nextBetween(0.014, 0.024) * speedBoostMultiplier,
      variance: rng.nextBetween(0.006, 0.012) * speedBoostMultiplier,
    }),
  );

  if (!disabledMachines.has("pegboard") && rng.next() > 0.65) {
    contributions.push(
      createPegboardScatterField(path, progressSlots[4], rng, {
        pegDensity: 0.68 * pegDensityMultiplier,
        pegRadius: 0.085,
        fieldLength: 5.8,
        fieldWidth: 3.2,
        lateralBias: rng.nextBetween(-0.14, 0.14),
        shuffleIntensity: 0.07,
      }),
    );
  }

  const disruptorRng = createSeededRng(`${path.finishProgress}:dynamic-disruptors`);

  if (!disabledMachines.has("panel") && disruptorRng.next() > 0.98) {
    contributions.push(
      createRisingPanelGate(path, progressSlots[2] + path.finishProgress * 0.08, {
        cycleTime: disruptorRng.nextBetween(2.2, 3.2),
        upDuration: disruptorRng.nextBetween(0.32, 0.58),
        riseSpeed: disruptorRng.nextBetween(5.2, 7.4),
        height: disruptorRng.nextBetween(0.58, 0.78),
        coverageWidth: disruptorRng.nextBetween(2.8, 3.8),
        phaseOffset: disruptorRng.nextBetween(0, 2.5),
        segments: disruptorRng.next() > 0.45 ? 2 : 3,
      }),
    );
  }

  if (!disabledMachines.has("arms")) {
    contributions.push(
      createSwingingSideArms(path, progressSlots[1] + path.finishProgress * 0.1, {
        swingAngle: disruptorRng.nextBetween(0.9, 1.3125),
        cycleTime: disruptorRng.nextBetween(3.25, 4.75),
        phaseOffset: disruptorRng.nextBetween(0, 2.2),
        armLength: disruptorRng.nextBetween(0.85, 1.22),
        collisionForce: disruptorRng.nextBetween(0.015, 0.026),
        alternating: disruptorRng.next() > 0.35,
      }),
    );
  }

  return contributions.sort((a, b) => getContributionProgress(a) - getContributionProgress(b));
}

function createMachineProgressSlots(path: TrackPath, rng: SeededRng): number[] {
  return [0.18, 0.34, 0.52, 0.68, 0.82].map((slot) => path.finishProgress * (slot + rng.nextBetween(-0.025, 0.025)));
}

function getContributionProgress(contribution: TrackMachineContribution): number {
  return contribution.patches[0]?.progress ?? contribution.obstacles[0]?.progress ?? 0;
}

function getLeaderId(path: TrackPath, marbles: Marble[]): string | null {
  return [...marbles].sort((a, b) => path.getProgress(b.position) - path.getProgress(a.position))[0]?.id ?? null;
}

function addSectionContacts(target: Record<string, number>, source: Record<string, number>): void {
  for (const [sectionId, count] of Object.entries(source)) {
    target[sectionId] = (target[sectionId] ?? 0) + count;
  }
}

function runLocalMachineSafetyProbes(
  path: TrackPath,
  obstacles: TrackObstacle[],
): { failedMachineIds: Set<string>; removedObstacleCount: number } {
  const failedMachineIds = new Set<string>();
  const obstaclesByMachine = new Map<string, TrackObstacle[]>();

  for (const obstacle of obstacles) {
    if (obstacle.material === "spinner") {
      continue;
    }

    const machineId = getMachineGroupId(obstacle.id);
    obstaclesByMachine.set(machineId, [...(obstaclesByMachine.get(machineId) ?? []), obstacle]);
  }

  for (const [machineId, machineObstacles] of obstaclesByMachine) {
    if (!machineProbeCanExit(path, machineObstacles)) {
      failedMachineIds.add(machineId);
    }
  }

  return {
    failedMachineIds,
    removedObstacleCount: obstacles.filter((obstacle) => failedMachineIds.has(getMachineGroupId(obstacle.id))).length,
  };
}

function machineProbeCanExit(path: TrackPath, obstacles: TrackObstacle[]): boolean {
  if (obstacles.length === 0) {
    return true;
  }

  const minProgress = Math.min(...obstacles.map((obstacle) => obstacle.progress - obstacle.halfLength)) - 1;
  const maxProgress = Math.max(...obstacles.map((obstacle) => obstacle.progress + obstacle.halfLength)) + 2;
  const entries = [
    [0],
    [-1.25],
    [1.25],
    [-0.65, 0, 0.65],
  ];

  return entries.every((offsets) =>
    offsets.every((offset) => probeOffsetCanExit(path, obstacles, minProgress, maxProgress, offset)),
  );
}

function probeOffsetCanExit(path: TrackPath, obstacles: TrackObstacle[], minProgress: number, maxProgress: number, startingOffset: number): boolean {
  let lateralOffset = startingOffset;

  for (let progress = minProgress; progress <= maxProgress; progress += 0.55) {
    const sample = path.getSampleAtProgress(progress);
    const laneLimit = sample.width / 2 - 0.34;
    lateralOffset = Math.max(-laneLimit, Math.min(laneLimit, lateralOffset));

    const blocker = obstacles.find(
      (obstacle) =>
        Math.abs(progress - obstacle.progress) <= obstacle.halfLength + 0.34 &&
        Math.abs(lateralOffset - obstacle.lateralOffset) <= obstacle.halfWidth + 0.34,
    );

    if (!blocker) {
      continue;
    }

    const leftEscape = blocker.lateralOffset - blocker.halfWidth - 0.92;
    const rightEscape = blocker.lateralOffset + blocker.halfWidth + 0.92;
    const leftValid = leftEscape > -laneLimit;
    const rightValid = rightEscape < laneLimit;

    if (!leftValid && !rightValid) {
      return false;
    }

    lateralOffset = leftValid && rightValid ? (Math.abs(leftEscape) < Math.abs(rightEscape) ? leftEscape : rightEscape) : leftValid ? leftEscape : rightEscape;
  }

  return true;
}

function buildObstacle(
  RAPIERApi: typeof RAPIER,
  physics: PhysicsWorld,
  root: Group,
  path: TrackPath,
  obstacle: TrackObstacle,
): void {
  const sample = path.getSampleAtProgress(obstacle.progress);
  const lateral = getLateral(sample.tangent);
  const position = sample.point.clone().addScaledVector(lateral, obstacle.lateralOffset).addScaledVector(up, obstacle.height / 2 + 0.06);
  const quaternion = getObjectQuaternion(sample.tangent, obstacle.yawOffset);
  const material = getObstacleMaterial(obstacle.material);

  if (obstacle.shape === "cylinder") {
    const mesh = new Mesh(new CylinderGeometry(obstacle.halfWidth * 0.9, obstacle.halfWidth, obstacle.height, 18), material);
    mesh.position.copy(position);
    addHazardBase(root, sample, obstacle.lateralOffset, obstacle.halfWidth * 2.7, getHazardBaseColor(obstacle.material));
    addHazardCap(root, position, obstacle.height, obstacle.halfWidth * 0.72, getHazardBaseColor(obstacle.material));
    root.add(mesh);
    physics.addStaticCylinder(obstacle.halfWidth, obstacle.height / 2, position, new Quaternion(), obstacle.friction, obstacle.restitution);
    return;
  }

  if (obstacle.shape === "wedge") {
    const wedge = createWedgeMeshData(obstacle.halfWidth, obstacle.height, obstacle.halfLength, position, quaternion);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(wedge.localVertices, 3));
    geometry.setIndex(new BufferAttribute(wedge.indices, 1));
    geometry.computeVertexNormals();

    const mesh = new Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.quaternion.copy(quaternion);
    addHazardBase(root, sample, obstacle.lateralOffset, Math.max(0.58, obstacle.halfLength * 0.82), getHazardBaseColor(obstacle.material));
    root.add(mesh);
    physics.addStaticTrimesh(wedge.worldVertices, wedge.indices, obstacle.friction, obstacle.restitution);
    return;
  }

  const size = new Vector3(obstacle.halfWidth * 2, obstacle.height, obstacle.halfLength * 2);
  const mesh = new Mesh(new BoxGeometry(size.x, size.y, size.z), material);

  mesh.position.copy(position);
  mesh.quaternion.copy(quaternion);
  addHazardBase(root, sample, obstacle.lateralOffset, Math.max(0.58, obstacle.halfLength * 0.82), getHazardBaseColor(obstacle.material));
  root.add(mesh);
  physics.addStaticCuboid(size.clone().multiplyScalar(0.5), position, quaternion, obstacle.friction, obstacle.restitution);
}

function createWedgeMeshData(
  halfWidth: number,
  height: number,
  halfLength: number,
  position: Vector3,
  quaternion: Quaternion,
): { localVertices: Float32Array; worldVertices: Float32Array; indices: Uint32Array } {
  const yBottom = -height / 2;
  const yTop = height / 2;
  const frontHalfWidth = Math.min(halfWidth * 0.22, 0.025);
  const localPoints = [
    new Vector3(-frontHalfWidth, yBottom, -halfLength),
    new Vector3(frontHalfWidth, yBottom, -halfLength),
    new Vector3(-halfWidth, yBottom, halfLength),
    new Vector3(halfWidth, yBottom, halfLength),
    new Vector3(0, yTop, -halfLength),
    new Vector3(0, yTop, halfLength),
  ];
  const indices = new Uint32Array([
    0, 1, 2,
    1, 3, 2,
    0, 2, 4,
    4, 2, 5,
    3, 1, 4,
    3, 4, 5,
    2, 3, 5,
    1, 0, 4,
  ]);
  const localVertices = new Float32Array(localPoints.flatMap((point) => [point.x, point.y, point.z]));
  const worldVertices = new Float32Array(
    localPoints.flatMap((point) => {
      const worldPoint = point.clone().applyQuaternion(quaternion).add(position);

      return [worldPoint.x, worldPoint.y, worldPoint.z];
    }),
  );

  return { localVertices, worldVertices, indices };
}

function addHazardCap(root: Group, position: Vector3, height: number, radius: number, color: number): void {
  const cap = new Mesh(
    new CylinderGeometry(radius, radius, 0.045, 18),
    new MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.42,
      roughness: 0.22,
      metalness: 0.24,
    }),
  );

  cap.position.copy(position).addScaledVector(up, height * 0.5 + 0.025);
  root.add(cap);
}

function buildSpinner(
  RAPIERApi: typeof RAPIER,
  physics: PhysicsWorld,
  root: Group,
  path: TrackPath,
  spec: SpinnerSpec,
): ActiveMachine {
  const sample = path.getSampleAtProgress(spec.progress);
  const center = sample.point.clone().addScaledVector(up, wallHeight / 2 + 0.1);
  const baseYaw = getFlatYaw(sample.tangent);
  const meshes: Mesh[] = [];
  const bodies: RAPIER.RigidBody[] = [];
  const size = new Vector3(spec.armThickness, wallHeight, spec.armLength);
  const material = getObstacleMaterial("spinner");

  for (let i = 0; i < spec.armCount; i += 1) {
    const mesh = new Mesh(new BoxGeometry(size.x, size.y, size.z), material);
    const angle = baseYaw + spec.phaseOffset + (i / spec.armCount) * Math.PI * 2;
    const rotation = quaternionFromYaw(angle);

    mesh.position.copy(center);
    mesh.quaternion.copy(rotation);
    addHazardBase(root, sample, 0, Math.max(0.9, spec.armLength * 0.18), 0xffb12f);
    root.add(mesh);
    meshes.push(mesh);
    bodies.push(physics.addKinematicCuboid(size.clone().multiplyScalar(0.5), center, rotation, 0.16, 0.34));
  }

  const built: BuiltSpinner = {
    meshes,
    bodies,
    spec,
    center,
    baseYaw,
  };

  return {
    update: (deltaTime: number, marbles: Marble[], leaderId: string | null): MachineUpdateStats =>
      updateSpinner(built, path, deltaTime, marbles, leaderId),
  };
}

function updateSpinner(
  spinner: BuiltSpinner,
  path: TrackPath,
  deltaTime: number,
  marbles: Marble[],
  leaderId: string | null,
): MachineUpdateStats {
  spinner.spec.phaseOffset += spinner.spec.rotationDirection * spinner.spec.rotationSpeed * deltaTime;
  let paddleContacts = 0;
  let paddleLeaderContacts = 0;

  for (let i = 0; i < spinner.meshes.length; i += 1) {
    const angle = spinner.baseYaw + spinner.spec.phaseOffset + (i / spinner.spec.armCount) * Math.PI * 2;
    const rotation = quaternionFromYaw(angle);
    const mesh = spinner.meshes[i];
    const body = spinner.bodies[i];

    mesh.position.copy(spinner.center);
    mesh.quaternion.copy(rotation);
    body.setNextKinematicTranslation({ x: spinner.center.x, y: spinner.center.y, z: spinner.center.z });
    body.setNextKinematicRotation(rotation);
  }

  for (const marble of marbles) {
    const progress = path.getProgress(marble.position);

    if (Math.abs(progress - spinner.spec.progress) > 0.95) {
      continue;
    }

    const sample = path.getSampleAtProgress(progress);
    const lateralDistance = Math.abs(marble.position.clone().sub(sample.point).dot(getLateral(sample.tangent)));

    if (lateralDistance > spinner.spec.armLength + 0.22) {
      continue;
    }

    const lateral = getLateral(sample.tangent);
    const sweepDirection = spinner.spec.rotationDirection;
    marble.body.applyImpulse(
      {
        x: sample.tangent.x * 0.034 + lateral.x * 0.018 * sweepDirection,
        y: 0.002,
        z: sample.tangent.z * 0.034 + lateral.z * 0.018 * sweepDirection,
      },
      true,
    );
    paddleContacts += 1;
    if (marble.id === leaderId) {
      paddleLeaderContacts += 1;
    }
  }

  return {
    paddleContacts,
    paddleLeaderContacts,
    sectionContactCounts: paddleContacts > 0 ? { [spinner.spec.id]: paddleContacts } : {},
  };
}

function buildRisingPanel(
  RAPIERApi: typeof RAPIER,
  physics: PhysicsWorld,
  root: Group,
  path: TrackPath,
  spec: RisingPanelSpec,
): ActiveMachine {
  const sample = path.getSampleAtProgress(spec.progress);
  const lateral = getLateral(sample.tangent);
  const center = sample.point.clone().addScaledVector(lateral, spec.lateralCenter).addScaledVector(up, 0.08);
  const size = new Vector3(spec.width, spec.height, spec.thickness);
  const material = new MeshStandardMaterial({ color: 0xff6b35, emissive: 0x3d1008, emissiveIntensity: 0.28, roughness: 0.28, metalness: 0.16 });
  const mesh = new Mesh(new BoxGeometry(size.x, size.y, size.z), material);
  const rotation = getObjectQuaternion(sample.tangent, 0);
  const initialPosition = center.clone().addScaledVector(up, spec.height / 2);
  const body = physics.addKinematicCuboid(size.clone().multiplyScalar(0.5), initialPosition, rotation, 0.42, 0.18);
  let elapsed = 0;

  mesh.position.copy(initialPosition);
  mesh.quaternion.copy(rotation);
  addHazardBase(root, sample, spec.lateralCenter, Math.max(0.8, spec.width * 0.34), 0xff6b35);
  root.add(mesh);

  return {
    update: (deltaTime: number, marbles: Marble[], leaderId: string | null): MachineUpdateStats => {
      elapsed += deltaTime;
      const cyclePosition = ((spec.phaseOffset + elapsed) % spec.cycleTime) / spec.cycleTime;
      const targetLift = cyclePosition < spec.upDuration / spec.cycleTime ? spec.height : 0;
      const currentLift = Math.max(0, Math.min(spec.height, mesh.position.y - center.y + spec.height / 2));
      const nextLift = moveToward(currentLift, targetLift, spec.riseSpeed * deltaTime);
      const position = center.clone().addScaledVector(up, nextLift + spec.height / 2);
      let contacts = 0;
      let leaderContacts = 0;

      mesh.position.copy(position);
      body.setNextKinematicTranslation({ x: position.x, y: position.y, z: position.z });
      body.setNextKinematicRotation(rotation);

      if (nextLift > spec.height * 0.35) {
        for (const marble of marbles) {
          const progress = path.getProgress(marble.position);
          if (Math.abs(progress - spec.progress) > 0.85) continue;

          const localSample = path.getSampleAtProgress(progress);
          const localLateral = marble.position.clone().sub(localSample.point).dot(getLateral(localSample.tangent));
          if (Math.abs(localLateral - spec.lateralCenter) > spec.width / 2 + 0.36) continue;

          const velocity = marble.body.linvel();
          marble.body.setLinvel({ x: velocity.x * 0.9, y: velocity.y, z: velocity.z * 0.9 }, true);
          marble.body.applyImpulse(
            {
              x: localSample.tangent.x * 0.042,
              y: 0.004,
              z: localSample.tangent.z * 0.042,
            },
            true,
          );
          contacts += 1;
          if (marble.id === leaderId) leaderContacts += 1;
        }
      }

      return {
        paddleContacts: contacts,
        paddleLeaderContacts: leaderContacts,
        sectionContactCounts: contacts > 0 ? { [spec.id]: contacts } : {},
      };
    },
  };
}

function buildSwingingArm(
  RAPIERApi: typeof RAPIER,
  physics: PhysicsWorld,
  root: Group,
  path: TrackPath,
  spec: SwingingArmSpec,
): ActiveMachine {
  const sample = path.getSampleAtProgress(spec.progress);
  const lateral = getLateral(sample.tangent);
  const hingeInset = 0.46;
  const hinge = sample.point
    .clone()
    .addScaledVector(lateral, spec.side * (sample.width / 2 - hingeInset))
    .addScaledVector(up, wallHeight / 2 + 0.1);
  const armLength = Math.min(spec.armLength, sample.width * 0.32);
  const size = new Vector3(spec.armThickness, wallHeight, armLength);
  const material = new MeshStandardMaterial({ color: 0xff9f1c, emissive: 0x4a2200, emissiveIntensity: 0.28, roughness: 0.26, metalness: 0.18 });
  const mesh = new Mesh(new BoxGeometry(size.x, size.y, size.z), material);
  const hingeGuardRadius = Math.max(spec.armThickness * 0.92, marbleRadius * 0.78);
  const hingeGuard = new Mesh(new CylinderGeometry(hingeGuardRadius, hingeGuardRadius, wallHeight, 20), material);
  const initialYaw = getFlatYaw(sample.tangent) - spec.side * Math.PI / 2;
  const initialRotation = quaternionFromYaw(initialYaw);
  const initialDirection = new Vector3(Math.sin(initialYaw), 0, Math.cos(initialYaw));
  const initialCenter = hinge.clone().addScaledVector(initialDirection, armLength / 2);
  const body = physics.addKinematicCuboid(size.clone().multiplyScalar(0.5), initialCenter, initialRotation, 0.24, 0.32);
  let elapsed = 0;

  addHazardBase(root, sample, spec.side * (sample.width / 2 - hingeInset), Math.max(0.7, armLength * 0.24), 0xff9f1c);
  physics.addStaticCylinder(hingeGuardRadius, wallHeight / 2, hinge, new Quaternion(), 0.32, 0.22);
  hingeGuard.position.copy(hinge);
  mesh.position.copy(initialCenter);
  mesh.quaternion.copy(initialRotation);
  root.add(hingeGuard);
  root.add(mesh);

  return {
    update: (deltaTime: number, marbles: Marble[], leaderId: string | null): MachineUpdateStats => {
      elapsed += deltaTime;
      const cycle = ((spec.phaseOffset + elapsed) % spec.cycleTime) / spec.cycleTime;
      const swing = Math.sin(cycle * Math.PI * 2) * spec.swingAngle;
      const yaw = getFlatYaw(sample.tangent) - spec.side * (Math.PI / 2 - swing);
      const rotation = quaternionFromYaw(yaw);
      const direction = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      const center = hinge.clone().addScaledVector(direction, armLength / 2);
      let contacts = 0;
      let leaderContacts = 0;

      mesh.position.copy(center);
      mesh.quaternion.copy(rotation);
      body.setNextKinematicTranslation({ x: center.x, y: center.y, z: center.z });
      body.setNextKinematicRotation(rotation);

      for (const marble of marbles) {
        const progress = path.getProgress(marble.position);
        if (Math.abs(progress - spec.progress) > 1.05) continue;

        const localSample = path.getSampleAtProgress(progress);
        const offsetFromHinge = marble.position.clone().sub(hinge);
        const alongArm = offsetFromHinge.dot(direction);
        const closestPoint = hinge.clone().addScaledVector(direction, Math.max(0, Math.min(armLength, alongArm)));
        const horizontalDistance = Math.hypot(marble.position.x - closestPoint.x, marble.position.z - closestPoint.z);

        if (alongArm < -0.25 || alongArm > armLength + 0.35 || horizontalDistance > spec.armThickness * 1.8 + 0.34) {
          continue;
        }

        if (spec.collisionForce > 0) {
          marble.body.applyImpulse(
            {
              x: localSample.tangent.x * spec.collisionForce,
              y: 0,
              z: localSample.tangent.z * spec.collisionForce,
            },
            true,
          );
        }
        contacts += 1;
        if (marble.id === leaderId) leaderContacts += 1;
      }

      return {
        paddleContacts: contacts,
        paddleLeaderContacts: leaderContacts,
        sectionContactCounts: contacts > 0 ? { [spec.id]: contacts } : {},
      };
    },
  };
}

function applySlowZones(
  marble: Marble,
  path: TrackPath,
  slowZones: SlowZone[],
): { hits: number; variableHits: number; speedSamples: number[]; sectionContactCounts: Record<string, number> } {
  const progress = path.getProgress(marble.position);
  let hits = 0;
  let variableHits = 0;
  const speedSamples: number[] = [];
  const sectionContactCounts: Record<string, number> = {};

  for (const zone of slowZones) {
    if (Math.abs(progress - zone.progress) > zone.length / 2) {
      continue;
    }

    const sample = path.getSampleAtProgress(progress);
    const lateralDistance = Math.abs(marble.position.clone().sub(sample.point).dot(getLateral(sample.tangent)) - (zone.lateralCenter ?? 0));

    if (lateralDistance > zone.halfWidth) {
      continue;
    }

    const velocity = marble.body.linvel();
    const stochastic = (hashUnit(`${zone.id}:${marble.id}`) - 0.5) * (zone.stochasticStrength ?? 0);
    const damping = Math.max(0.9, Math.min(0.999, zone.damping + stochastic));
    marble.body.setLinvel({ x: velocity.x * damping, y: velocity.y, z: velocity.z * damping }, true);
    hits += 1;
    if ((zone.effects ?? []).includes("create_speed_variance")) {
      variableHits += 1;
    }
    speedSamples.push(Math.hypot(velocity.x, velocity.z) * (1 - damping));
    sectionContactCounts[zone.id] = (sectionContactCounts[zone.id] ?? 0) + 1;
  }

  return { hits, variableHits, speedSamples, sectionContactCounts };
}

function applyForceZones(
  marble: Marble,
  path: TrackPath,
  forceZones: ForceZone[],
): { hits: number; boostHits: number; speedSamples: number[]; sectionContactCounts: Record<string, number> } {
  const progress = path.getProgress(marble.position);
  let hits = 0;
  let boostHits = 0;
  const speedSamples: number[] = [];
  const sectionContactCounts: Record<string, number> = {};

  for (const zone of forceZones) {
    if (Math.abs(progress - zone.progress) > zone.length / 2) {
      continue;
    }

    const sample = path.getSampleAtProgress(progress);
    const lateral = getLateral(sample.tangent);
    const lateralDistance = Math.abs(marble.position.clone().sub(sample.point).dot(lateral) - (zone.lateralCenter ?? 0));

    if (lateralDistance > zone.halfWidth) {
      continue;
    }

    const stochastic = (hashUnit(`${zone.id}:${marble.id}`) - 0.5) * (zone.stochasticStrength ?? 0);
    const forwardImpulse = Math.max(0, zone.forwardImpulse + stochastic);
    marble.body.applyImpulse(
      {
        x: sample.tangent.x * forwardImpulse + lateral.x * zone.lateralImpulse,
        y: 0.002,
        z: sample.tangent.z * forwardImpulse + lateral.z * zone.lateralImpulse,
      },
      true,
    );
    hits += 1;
    if ((zone.effects ?? []).includes("create_speed_variance") || zone.id.includes("boost")) {
      boostHits += 1;
    }
    speedSamples.push(forwardImpulse);
    sectionContactCounts[zone.id] = (sectionContactCounts[zone.id] ?? 0) + 1;
  }

  return { hits, boostHits, speedSamples, sectionContactCounts };
}

function diagnosePermanentTrap(
  marble: Marble,
  path: TrackPath,
  obstacles: TrackObstacle[],
  stateByMarble: Map<string, { lastProgress: number; lowProgressSeconds: number; reported: boolean }>,
  frame: number,
  elapsedTime: number,
  deltaTime: number,
): AntiStallDiagnostic | null {
  const progress = path.getProgress(marble.position);
  const state = stateByMarble.get(marble.id) ?? {
    lastProgress: progress,
    lowProgressSeconds: 0,
    reported: false,
  };
  const recentProgressDelta = progress - state.lastProgress;

  if (progress < path.finishProgress * 0.04 || progress > path.finishProgress * 0.98) {
    stateByMarble.set(marble.id, { lastProgress: progress, lowProgressSeconds: 0, reported: false });
    return null;
  }

  const velocity = marble.body.linvel();
  const horizontalSpeedSq = velocity.x * velocity.x + velocity.z * velocity.z;

  if (recentProgressDelta > 0.025 || horizontalSpeedSq > 0.045) {
    stateByMarble.set(marble.id, {
      lastProgress: Math.max(state.lastProgress, progress),
      lowProgressSeconds: Math.max(0, state.lowProgressSeconds - deltaTime * 2),
      reported: false,
    });
    return null;
  }

  state.lowProgressSeconds += deltaTime;
  state.lastProgress = Math.max(state.lastProgress, progress);
  stateByMarble.set(marble.id, state);

  if (state.lowProgressSeconds < 1.5 || state.reported) {
    return null;
  }

  state.reported = true;
  const nearestObstacle = findNearestObstacle(path, obstacles, progress, marble.position);

  return {
    marbleId: marble.id,
    time: Math.round(elapsedTime * 1000) / 1000,
    frame,
    position: {
      x: Math.round(marble.position.x * 1000) / 1000,
      y: Math.round(marble.position.y * 1000) / 1000,
      z: Math.round(marble.position.z * 1000) / 1000,
    },
    velocity: {
      x: Math.round(velocity.x * 1000) / 1000,
      y: Math.round(velocity.y * 1000) / 1000,
      z: Math.round(velocity.z * 1000) / 1000,
    },
    nearestMachine: nearestObstacle ? getMachineType(nearestObstacle.id) : null,
    nearestObstacle: nearestObstacle?.id ?? null,
    currentSegment: Math.round(progress),
    recentProgressDelta: Math.round(recentProgressDelta * 1000) / 1000,
  };
}

function findNearestObstacle(path: TrackPath, obstacles: TrackObstacle[], progress: number, position: Vector3): TrackObstacle | null {
  return obstacles
    .map((obstacle) => {
      const sample = path.getSampleAtProgress(obstacle.progress);
      const distance = Math.abs(obstacle.progress - progress) + sample.point.distanceTo(position) * 0.2;

      return { obstacle, distance };
    })
    .sort((a, b) => a.distance - b.distance)[0]?.obstacle ?? null;
}

function getMachineType(id: string): string {
  if (id.startsWith("pegboard")) return "pegboard";
  if (id.startsWith("funnel")) return "funnel";
  if (id.startsWith("spinner")) return "spinner";
  if (id.startsWith("lane")) return "splitter";
  if (id.startsWith("drop")) return "ramp";

  return "unknown";
}

function getMachineGroupId(id: string): string {
  if (id.startsWith("pegboard")) {
    return id.split("-").slice(0, 2).join("-");
  }

  if (id.startsWith("funnel-bowl")) {
    return id.split("-").slice(0, 3).join("-");
  }

  if (id.startsWith("spinner")) {
    return id.replace("-safety", "");
  }

  if (id.startsWith("lane-split") || id.startsWith("lane-merge")) {
    return id.split("-").slice(0, 3).join("-");
  }

  if (id.startsWith("drop-ramp")) {
    return id.split("-").slice(0, 3).join("-");
  }

  return id;
}

function makeTrackAlignedPatch(path: TrackPath, patch: FlatPatch): Mesh {
  const geometry = new BufferGeometry();
  const vertices: number[] = [];
  const indices: number[] = [];
  const segmentCount = Math.max(4, Math.ceil(patch.length / 0.8));
  const startProgress = patch.progress - patch.length / 2;

  for (let i = 0; i <= segmentCount; i += 1) {
    const progress = startProgress + (i / segmentCount) * patch.length;
    const sample = path.getSampleAtProgress(progress);
    const lateral = getLateral(sample.tangent);
    const halfWidth = Math.min(patch.width, sample.width - 0.55) / 2;
    const center = sample.point.clone().addScaledVector(up, 0.065).addScaledVector(lateral, patch.lateralCenter ?? 0);
    const left = center.clone().addScaledVector(lateral, -halfWidth);
    const right = center.clone().addScaledVector(lateral, halfWidth);

    vertices.push(left.x, left.y, left.z, right.x, right.y, right.z);
  }

  for (let i = 0; i < segmentCount; i += 1) {
    const left = i * 2;
    const right = left + 1;
    const nextLeft = left + 2;
    const nextRight = left + 3;

    indices.push(left, nextLeft, right, right, nextLeft, nextRight);
  }

  geometry.setAttribute("position", new BufferAttribute(new Float32Array(vertices), 3));
  geometry.setIndex(new BufferAttribute(new Uint32Array(indices), 1));
  geometry.computeVertexNormals();

  const material = new MeshStandardMaterial({
    color: patch.color,
    emissive: patch.color,
    emissiveIntensity: 0.18,
    roughness: 0.7,
    side: DoubleSide,
  });

  return new Mesh(geometry, material);
}

function addHazardBase(root: Group, sample: TrackSample, lateralOffset: number, radius: number, color: number): void {
  const lateral = getLateral(sample.tangent);
  const material = new MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.16,
    roughness: 0.42,
    metalness: 0.14,
  });
  const mesh = new Mesh(new RingGeometry(radius * 0.72, radius, 32), material);

  mesh.position.copy(sample.point.clone().addScaledVector(lateral, lateralOffset).addScaledVector(up, 0.082));
  mesh.rotation.x = -Math.PI / 2;
  root.add(mesh);
}

function getHazardBaseColor(material: TrackObstacleMaterial): number {
  if (material === "peg") return 0xff5d72;
  if (material === "spinner") return 0xffb12f;
  if (material === "funnel") return 0x5fd8a1;
  if (material === "split" || material === "lane") return 0x58e4ff;
  if (material === "drop") return 0xcdb4db;
  return 0xf0b85a;
}

function getObstacleMaterial(material: TrackObstacleMaterial): MeshStandardMaterial {
  if (material === "split" || material === "lane") {
    return new MeshStandardMaterial({ color: 0x9fb7c8, emissive: 0x102431, emissiveIntensity: 0.2, roughness: 0.34, metalness: 0.18 });
  }

  if (material === "funnel") {
    return new MeshStandardMaterial({ color: 0x5fd8a1, emissive: 0x0b3325, emissiveIntensity: 0.22, roughness: 0.38, metalness: 0.14 });
  }

  if (material === "peg") {
    return new MeshStandardMaterial({ color: 0xff5d72, emissive: 0x421018, emissiveIntensity: 0.25, roughness: 0.3, metalness: 0.18 });
  }

  if (material === "spinner") {
    return new MeshStandardMaterial({ color: 0xffb12f, emissive: 0x4a2200, emissiveIntensity: 0.3, roughness: 0.24, metalness: 0.28 });
  }

  if (material === "drop") {
    return new MeshStandardMaterial({ color: 0xcdb4db, emissive: 0x251336, emissiveIntensity: 0.2, roughness: 0.38, metalness: 0.12 });
  }

  return new MeshStandardMaterial({ color: 0xf0b85a, emissive: 0x372409, emissiveIntensity: 0.18, roughness: 0.36, metalness: 0.16 });
}

function hashUnit(input: string): number {
  let hash = 2166136261;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}

function moveToward(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) {
    return target;
  }

  return current + Math.sign(target - current) * maxDelta;
}

function getObjectQuaternion(tangent: Vector3, yawOffset: number): Quaternion {
  return quaternionFromYaw(getFlatYaw(tangent) + yawOffset);
}

function quaternionFromYaw(yaw: number): Quaternion {
  const object = new Object3D();
  object.rotation.set(0, yaw, 0);

  return object.quaternion.clone();
}

function getFlatYaw(tangent: Vector3): number {
  const flatTangent = tangent.clone().setY(0).normalize();

  return Math.atan2(flatTangent.x, flatTangent.z);
}

function getLateral(tangent: Vector3): Vector3 {
  return new Vector3().crossVectors(up, tangent).normalize();
}
