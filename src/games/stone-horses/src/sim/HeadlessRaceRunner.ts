import { Color, Vector3 } from "three";
import RAPIERCompat from "@dimforge/rapier3d-compat";
import type RAPIER from "@dimforge/rapier3d";
import { performance } from "node:perf_hooks";
import { createSeededRng } from "../utils/seededRng";
import { Marble } from "../world/Marble";
import { PhysicsWorld } from "../world/PhysicsWorld";
import { FeatureUpdateStats, RaceTelemetry } from "../world/RaceTelemetry";
import { RaceController } from "../world/RaceController";
import { buildTrackMesh } from "../world/TrackMeshBuilder";
import { createTrackFeatureSystem, TrackMutationConfig } from "../world/TrackFeatures";
import { TrackMachineType } from "../world/TrackFeatures";
import { generateTrack } from "../world/TrackGenerator";
import { TrackPath } from "../world/TrackPath";
import { HeadlessRaceReport, ReplayMetadata } from "./SimTypes";

export interface HeadlessRaceOptions {
  trackSeed: string;
  raceSeed: string;
  machineSeed?: string;
  maxRaceSeconds: number;
  fixedStepSeconds?: number;
  disabledMachines?: TrackMachineType[];
  mutation?: TrackMutationConfig;
}

const marbleRadius = 0.34;
const defaultFixedStepSeconds = 1 / 60;
const RAPIERApi = RAPIERCompat as unknown as typeof RAPIER;

export function runHeadlessRace(options: HeadlessRaceOptions): HeadlessRaceReport {
  const fixedStepSeconds = options.fixedStepSeconds ?? defaultFixedStepSeconds;
  const machineSeed = options.machineSeed ?? `${options.trackSeed}:machines`;
  const startTime = performance.now();
  const physics = new PhysicsWorld(RAPIERApi);
  const generatedTrack = generateTrack(options.trackSeed);
  const trackPath = generatedTrack.path;

  buildTrackMesh(trackPath, physics);

  const featureSystem = createTrackFeatureSystem(RAPIERApi, physics, trackPath, machineSeed, {
    disabledMachines: options.disabledMachines,
    mutation: options.mutation,
  });
  const { marbles, launchVelocities, startSlotsByMarbleId } = createHeadlessMarbles(RAPIERApi, physics, trackPath, options.raceSeed);
  const race = new RaceController(marbles, trackPath, {
    launchVelocities,
    countdownSeconds: 0,
    maxRaceSeconds: options.maxRaceSeconds,
    seed: options.raceSeed,
  });
  const telemetry = new RaceTelemetry(marbles, trackPath, featureSystem.validationTelemetry);
  let finalStretchLeaderChanges = 0;
  let previousLeaderId = race.rankings[0]?.marble.id ?? null;
  let stepCount = 0;

  race.startRace();

  while (race.state === "RUNNING" && race.runningTime <= options.maxRaceSeconds + fixedStepSeconds) {
    const featureStats = featureSystem.update(marbles, fixedStepSeconds);
    physics.step(fixedStepSeconds);

    for (const marble of marbles) {
      marble.syncMesh();
    }

    race.update(fixedStepSeconds);
    telemetry.update(race, fixedStepSeconds, featureStats);
    finalStretchLeaderChanges += countFinalStretchLeaderChange(race, trackPath.finishProgress, previousLeaderId);
    previousLeaderId = race.rankings[0]?.marble.id ?? previousLeaderId;
    stepCount += 1;
  }

  const simDurationMs = performance.now() - startTime;
  const results = race.results.map((result) => ({
    ...result,
    startSlot: startSlotsByMarbleId.get(result.marbleId) ?? getStartSlot(result.marbleId) ?? result.place,
  }));
  const forcedResults = results.filter((result) => result.forced);
  const timeoutOccurred = forcedResults.length > 0 || race.runningTime >= options.maxRaceSeconds;
  const replay = createReplayMetadata(options.trackSeed, options.raceSeed, machineSeed, stepCount, race.runningTime, timeoutOccurred, telemetry.likelyStuckEvents, marbles, trackPath);

  return {
    trackSeed: options.trackSeed,
    raceSeed: options.raceSeed,
    machineSeed,
    finished: results.length === marbles.length && forcedResults.length === 0,
    results,
    safety: {
      maxStallTime: round(telemetry.maxLowProgressSeconds),
      lowProgressWindows: telemetry.lowProgressWindows,
      likelyStuckEvents: telemetry.likelyStuckEvents,
      antiStallNudges: telemetry.antiStallNudges,
      validatorRepairs: telemetry.validation.repairedObstacleCount,
      validatorRemovals: telemetry.validation.removedObstacleCount,
      localProbeFailures: telemetry.validation.localProbeFailureCount,
      timeoutOccurred,
      dnfCount: forcedResults.length,
    },
    excitement: {
      totalOvertakes: telemetry.overtakes,
      leaderChanges: telemetry.leaderChanges,
      orderChanges: telemetry.orderChanges,
        averagePositionDelta: round(calculateAveragePositionDelta(results)),
      finalStretchLeaderChanges,
      machineInteractionCounts: {
        slowZoneHits: telemetry.slowZoneHits,
        forceZoneHits: telemetry.forceZoneHits,
        variableSlowdownHits: telemetry.variableSlowdownHits,
        speedBoostHits: telemetry.speedBoostHits,
        paddleContacts: telemetry.paddleContacts,
        paddleLeaderContacts: telemetry.paddleLeaderContacts,
        antiStallNudges: telemetry.antiStallNudges,
      },
      speedVarianceDelta: telemetry.speedVarianceDelta,
      sectionContactCounts: telemetry.sectionContactCounts,
      paddleContactRate: round(telemetry.paddleContacts / Math.max(1, stepCount * marbles.length)),
    },
    fairness: {
        winningMarbleId: results[0]?.marbleId ?? null,
        winningStartSlot: results[0]?.startSlot ?? null,
        finishTimeSpread: round(calculateFinishTimeSpread(results)),
        startFinishSpearman: round(calculateStartFinishSpearman(results)),
    },
    performance: {
      simDurationMs: round(simDurationMs),
      physicsStepCount: stepCount,
      stepCostMs: round(simDurationMs / Math.max(1, stepCount)),
      fpsEquivalent: round(stepCount / Math.max(0.001, simDurationMs / 1000)),
    },
    packSections: telemetry.validation.packSections,
    antiStallDiagnostics: telemetry.antiStallDiagnostics,
    replay,
  };
}

function createHeadlessMarbles(
  RAPIERApi: typeof RAPIER,
  physics: PhysicsWorld,
  trackPath: TrackPath,
  raceSeed: string,
): { marbles: Marble[]; launchVelocities: Map<string, Vector3>; startSlotsByMarbleId: Map<string, number> } {
  const rng = createSeededRng(`${raceSeed}:headless-field`);
  const marbles: Marble[] = [];
  const launchVelocities = new Map<string, Vector3>();
  const startSlotsByMarbleId = new Map<string, number>();
  const lateralOffsets = [-1.45, -0.5, 0.5, 1.45];
  const baseSample = trackPath.samples[4];
  const rowForwardOffsets = [-0.42, 0.42];
  const startSlotIds = shuffleStartSlotIds(rng);
  let marbleIndex = 1;

  for (let row = 0; row < rowForwardOffsets.length; row += 1) {
    const sample = baseSample;
    const tangent = sample.tangent.clone().normalize();
    const lateral = new Vector3().crossVectors(new Vector3(0, 1, 0), tangent).normalize();

    for (let column = 0; column < lateralOffsets.length; column += 1) {
      const id = startSlotIds[marbleIndex - 1];
      const position = sample.point
        .clone()
        .addScaledVector(lateral, lateralOffsets[column])
        .addScaledVector(tangent, rowForwardOffsets[row])
        .add(new Vector3(0, marbleRadius + 0.12 + row * 0.04, 0));
      const marble = new Marble(RAPIERApi, physics.world, {
        id,
        color: new Color().setHSL(rng.next(), 0.62, 0.55),
        position,
        radius: marbleRadius,
      });
      const launchSpeed = rng.nextBetween(1.4, 2.1);

      launchVelocities.set(id, tangent.clone().multiplyScalar(launchSpeed));
      startSlotsByMarbleId.set(id, marbleIndex);
      marbles.push(marble);
      marbleIndex += 1;
    }
  }

  return { marbles, launchVelocities, startSlotsByMarbleId };
}

function shuffleStartSlotIds(rng: ReturnType<typeof createSeededRng>): string[] {
  const ids = Array.from({ length: 8 }, (_, index) => `M${(index + 1).toString().padStart(2, "0")}`);

  for (let i = ids.length - 1; i > 0; i -= 1) {
    const swapIndex = rng.nextInt(0, i);
    [ids[i], ids[swapIndex]] = [ids[swapIndex], ids[i]];
  }

  return ids;
}

function countFinalStretchLeaderChange(race: RaceController, finishProgress: number, previousLeaderId: string | null): number {
  const leader = race.rankings[0];

  if (!leader || leader.progress < finishProgress * 0.8 || previousLeaderId === null || leader.marble.id === previousLeaderId) {
    return 0;
  }

  return 1;
}

function calculateAveragePositionDelta(results: HeadlessRaceReport["results"]): number {
  if (results.length === 0) {
    return 0;
  }

  const total = results.reduce((sum, result) => sum + Math.abs((result.startSlot ?? getStartSlot(result.marbleId) ?? result.place) - result.place), 0);

  return total / results.length;
}

function calculateFinishTimeSpread(results: HeadlessRaceReport["results"]): number {
  if (results.length <= 1) {
    return 0;
  }

  const finishTimes = results.map((result) => result.finishTime);

  return Math.max(...finishTimes) - Math.min(...finishTimes);
}

function calculateStartFinishSpearman(results: HeadlessRaceReport["results"]): number {
  if (results.length <= 1) {
    return 0;
  }

  const n = results.length;
  const sumD2 = results.reduce((sum, result) => {
    const startSlot = result.startSlot ?? getStartSlot(result.marbleId) ?? result.place;
    const delta = startSlot - result.place;

    return sum + delta * delta;
  }, 0);

  return 1 - (6 * sumD2) / (n * (n * n - 1));
}

function createReplayMetadata(
  trackSeed: string,
  raceSeed: string,
  machineSeed: string,
  stepCount: number,
  runningTime: number,
  timeoutOccurred: boolean,
  likelyStuckEvents: number,
  marbles: Marble[],
  trackPath: TrackPath,
): ReplayMetadata | null {
  const reason = timeoutOccurred ? "timeout_or_dnf" : likelyStuckEvents > 0 ? "likely_stuck" : null;

  if (!reason) {
    return null;
  }

  const marble = marbles
    .map((candidate) => ({ marble: candidate, progress: trackPath.getProgress(candidate.position) }))
    .sort((a, b) => a.progress - b.progress)[0]?.marble ?? null;
  const debugParams = new URLSearchParams({
    trackSeed,
    raceSeed,
    machineSeed,
    debugFrame: stepCount.toString(),
  });

  if (marble) {
    debugParams.set("debugX", round(marble.position.x).toString());
    debugParams.set("debugY", round(marble.position.y).toString());
    debugParams.set("debugZ", round(marble.position.z).toString());
  }

  return {
    trackSeed,
    raceSeed,
    machineSeed,
    failureFrame: stepCount,
    failureTime: round(runningTime),
    failureReason: reason,
    marbleId: marble?.id ?? null,
    position: marble
      ? {
          x: round(marble.position.x),
          y: round(marble.position.y),
          z: round(marble.position.z),
        }
      : null,
    nearbyMachineId: null,
    debugUrl: `http://127.0.0.1:5173/?${debugParams.toString()}`,
  };
}

function getStartSlot(marbleId: string | null): number | null {
  if (!marbleId) {
    return null;
  }

  const parsed = Number.parseInt(marbleId.replace("M", ""), 10);

  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
