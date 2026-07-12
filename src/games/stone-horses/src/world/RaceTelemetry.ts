import { Marble } from "./Marble";
import { MarbleRaceStatus, RaceController } from "./RaceController";
import { TrackPath } from "./TrackPath";

export interface FeatureUpdateStats {
  slowZoneHits: number;
  forceZoneHits: number;
  variableSlowdownHits: number;
  speedBoostHits: number;
  speedVarianceSamples: number[];
  paddleContacts: number;
  paddleLeaderContacts: number;
  sectionContactCounts: Record<string, number>;
  antiStallNudges: number;
  antiStallDiagnostics: AntiStallDiagnostic[];
}

export interface AntiStallDiagnostic {
  marbleId: string;
  time: number;
  frame: number;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  nearestMachine: string | null;
  nearestObstacle: string | null;
  currentSegment: number;
  recentProgressDelta: number;
}

export interface TrackValidationTelemetry {
  machineCount: number;
  obstacleCount: number;
  repairedObstacleCount: number;
  removedObstacleCount: number;
  localProbeFailureCount: number;
  packSections: {
    id: string;
    sectionType: string;
    progress: number;
    expectedEffects: string[];
  }[];
}

interface MarbleTelemetry {
  lastProgress: number;
  lowProgressSeconds: number;
  lowProgressWindowOpen: boolean;
  likelyStuckOpen: boolean;
}

export class RaceTelemetry {
  overtakes = 0;
  leaderChanges = 0;
  orderChanges = 0;
  maxLowProgressSeconds = 0;
  currentStallWarnings = 0;
  lowProgressWindows = 0;
  likelyStuckEvents = 0;
  slowZoneHits = 0;
  forceZoneHits = 0;
  variableSlowdownHits = 0;
  speedBoostHits = 0;
  paddleContacts = 0;
  paddleLeaderContacts = 0;
  speedVarianceDelta = 0;
  sectionContactCounts: Record<string, number> = {};
  antiStallNudges = 0;
  antiStallDiagnostics: AntiStallDiagnostic[] = [];
  private lastLeaderId: string | null = null;
  private lastOrder = "";
  private readonly marbleTelemetry = new Map<string, MarbleTelemetry>();

  constructor(
    private readonly marbles: Marble[],
    private readonly trackPath: TrackPath,
    readonly validation: TrackValidationTelemetry,
  ) {
    for (const marble of marbles) {
      this.marbleTelemetry.set(marble.id, {
        lastProgress: trackPath.getProgress(marble.position),
        lowProgressSeconds: 0,
        lowProgressWindowOpen: false,
        likelyStuckOpen: false,
      });
    }
  }

  update(race: RaceController, deltaTime: number, featureStats: FeatureUpdateStats): void {
    if (race.state !== "RUNNING") {
      return;
    }

    this.updateOrderStats(race.rankings);
    this.updateStallStats(deltaTime);
    this.slowZoneHits += featureStats.slowZoneHits;
    this.forceZoneHits += featureStats.forceZoneHits;
    this.variableSlowdownHits += featureStats.variableSlowdownHits;
    this.speedBoostHits += featureStats.speedBoostHits;
    this.paddleContacts += featureStats.paddleContacts;
    this.paddleLeaderContacts += featureStats.paddleLeaderContacts;
    this.speedVarianceDelta = Math.max(this.speedVarianceDelta, calculateVariance(featureStats.speedVarianceSamples));
    for (const [sectionId, count] of Object.entries(featureStats.sectionContactCounts)) {
      this.sectionContactCounts[sectionId] = (this.sectionContactCounts[sectionId] ?? 0) + count;
    }
    this.antiStallNudges += featureStats.antiStallNudges;
    this.antiStallDiagnostics.push(...featureStats.antiStallDiagnostics.slice(0, Math.max(0, 64 - this.antiStallDiagnostics.length)));
  }

  get safetyStatus(): "CLEAR" | "WATCH" | "STUCK" {
    if (this.maxLowProgressSeconds >= 5) {
      return "STUCK";
    }

    if (this.maxLowProgressSeconds >= 2.5 || this.validation.removedObstacleCount > 0) {
      return "WATCH";
    }

    return "CLEAR";
  }

  private updateOrderStats(rankings: MarbleRaceStatus[]): void {
    const order = rankings.map((status) => status.marble.id).join(",");
    const leaderId = rankings[0]?.marble.id ?? null;

    if (this.lastLeaderId !== null && leaderId !== null && leaderId !== this.lastLeaderId) {
      this.leaderChanges += 1;
    }

    if (this.lastOrder !== "" && order !== this.lastOrder) {
      this.orderChanges += 1;
      this.overtakes += countPairwiseOrderChanges(this.lastOrder.split(","), order.split(","));
    }

    this.lastLeaderId = leaderId;
    this.lastOrder = order;
  }

  private updateStallStats(deltaTime: number): void {
    let warnings = 0;

    for (const marble of this.marbles) {
      const state = this.marbleTelemetry.get(marble.id);

      if (!state) {
        continue;
      }

      const progress = this.trackPath.getProgress(marble.position);
      const velocity = marble.body.linvel();
      const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
      const madeProgress = progress - state.lastProgress > 0.025;

      if (!madeProgress && horizontalSpeed < 0.12 && progress < this.trackPath.finishProgress * 0.98) {
        state.lowProgressSeconds += deltaTime;
      } else {
        state.lowProgressSeconds = Math.max(0, state.lowProgressSeconds - deltaTime * 2);
      }

      state.lastProgress = Math.max(state.lastProgress, progress);
      this.maxLowProgressSeconds = Math.max(this.maxLowProgressSeconds, state.lowProgressSeconds);

      if (state.lowProgressSeconds >= 2.5) {
        warnings += 1;
      }

      if (state.lowProgressSeconds >= 1.5 && !state.lowProgressWindowOpen) {
        state.lowProgressWindowOpen = true;
        this.lowProgressWindows += 1;
      }

      if (state.lowProgressSeconds < 0.5) {
        state.lowProgressWindowOpen = false;
      }

      if (state.lowProgressSeconds >= 5 && !state.likelyStuckOpen) {
        state.likelyStuckOpen = true;
        this.likelyStuckEvents += 1;
      }

      if (state.lowProgressSeconds < 1) {
        state.likelyStuckOpen = false;
      }
    }

    this.currentStallWarnings = warnings;
  }
}

function calculateVariance(values: number[]): number {
  if (values.length <= 1) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;

  return Math.round(Math.sqrt(variance) * 1000) / 1000;
}

function countPairwiseOrderChanges(previous: string[], next: string[]): number {
  const previousRank = new Map(previous.map((id, index) => [id, index]));
  let changes = 0;

  for (let i = 0; i < next.length; i += 1) {
    for (let j = i + 1; j < next.length; j += 1) {
      const a = next[i];
      const b = next[j];

      if ((previousRank.get(a) ?? 0) > (previousRank.get(b) ?? 0)) {
        changes += 1;
      }
    }
  }

  return changes;
}
