import { Vector3 } from "three";
import { Marble } from "./Marble";
import { TrackPath } from "./TrackPath";

export type RaceState = "PRE_RACE" | "COUNTDOWN" | "RUNNING" | "FINISHED";

export interface MarbleRaceStatus {
  marble: Marble;
  rank: number;
  progress: number;
  finished: boolean;
  forced: boolean;
  finishTime: number | null;
}

export interface RaceResult {
  marbleId: string;
  place: number;
  finishTime: number;
  progress: number;
  forced: boolean;
}

interface RaceControllerOptions {
  launchVelocities: Map<string, Vector3>;
  maxRaceSeconds?: number;
  postFirstFinisherDnfSeconds?: number;
  countdownSeconds?: number;
  seed: string;
}

const defaultMaxRaceSeconds = 195;
const defaultPostFirstFinisherDnfSeconds = 100;
const defaultCountdownSeconds = 3.35;
const finishEpsilon = 0.65;
const offTrackGraceSeconds = 0.18;

interface OffTrackState {
  seconds: number;
}

export class RaceController {
  readonly seed: string;
  state: RaceState = "PRE_RACE";
  elapsedTime = 0;
  runningTime = 0;
  countdownRemaining = 0;
  rankings: MarbleRaceStatus[] = [];
  results: RaceResult[] = [];
  private readonly finishedMarbleIds = new Set<string>();
  private readonly offTrackState = new Map<string, OffTrackState>();

  constructor(
    private readonly marbles: Marble[],
    private readonly trackPath: TrackPath,
    private readonly options: RaceControllerOptions,
  ) {
    this.seed = options.seed;
    this.rankings = this.rankMarbles();
  }

  update(deltaTime: number): void {
    this.elapsedTime += deltaTime;

    if (this.state === "COUNTDOWN") {
      this.countdownRemaining = Math.max(0, this.countdownRemaining - deltaTime);

      if (this.countdownRemaining === 0) {
        this.start();
      }
    } else if (this.state === "RUNNING") {
      this.runningTime += deltaTime;
      this.updateFinishes();
      this.updateOffTrackDnfs(deltaTime);

      if (
        this.results.length === this.marbles.length ||
        this.runningTime >= (this.options.maxRaceSeconds ?? defaultMaxRaceSeconds) ||
        this.hasExceededPostFinisherGrace()
      ) {
        this.finishRace();
      }
    }

    this.rankings = this.rankMarbles();
  }

  startRace(): void {
    if (this.state !== "PRE_RACE") {
      return;
    }

    this.countdownRemaining = this.options.countdownSeconds ?? defaultCountdownSeconds;

    if (this.countdownRemaining <= 0) {
      this.start();
      return;
    }

    this.state = "COUNTDOWN";
  }

  getCountdownLabel(): string {
    if (this.state !== "COUNTDOWN") {
      return "";
    }

    if (this.countdownRemaining <= 0.45) {
      return "START!";
    }

    return Math.ceil(this.countdownRemaining - 0.35).toString();
  }

  getLeader(): Marble {
    return this.rankings[0]?.marble ?? this.marbles[0];
  }

  private start(): void {
    this.state = "RUNNING";
    this.countdownRemaining = 0;

    for (const marble of this.marbles) {
      marble.launch(this.options.launchVelocities.get(marble.id) ?? new Vector3());
    }
  }

  private updateFinishes(): void {
    const finishProgress = this.trackPath.finishProgress - finishEpsilon;
    const newlyFinished = this.rankMarbles()
      .filter((status) => !status.finished && status.progress >= finishProgress)
      .sort(compareRaceStatus);

    for (const status of newlyFinished) {
      this.recordFinish(status.marble, status.progress, false);
    }
  }

  private updateOffTrackDnfs(deltaTime: number): void {
    const dnfProgressLimit = this.trackPath.finishProgress - finishEpsilon;

    for (const marble of this.marbles) {
      if (this.finishedMarbleIds.has(marble.id)) {
        continue;
      }

      const progress = this.trackPath.getProgress(marble.position);
      if (progress >= dnfProgressLimit) {
        this.offTrackState.delete(marble.id);
        continue;
      }

      const state = this.offTrackState.get(marble.id) ?? { seconds: 0 };
      state.seconds = this.isOffTrackBeforeFinish(marble, progress) ? state.seconds + deltaTime : 0;
      this.offTrackState.set(marble.id, state);

      if (state.seconds >= offTrackGraceSeconds) {
        this.recordFinish(marble, progress, true);
      }
    }
  }

  private finishRace(): void {
    const unfinished = this.rankMarbles()
      .filter((status) => !status.finished)
      .sort(compareRaceStatus);

    for (const status of unfinished) {
      this.recordFinish(status.marble, status.progress, true);
    }

    this.results.sort(compareResults);
    this.results = this.results.map((result, index) => ({
      ...result,
      place: index + 1,
    }));
    this.state = "FINISHED";
  }

  private recordFinish(marble: Marble, progress: number, forced: boolean): void {
    if (this.finishedMarbleIds.has(marble.id)) {
      return;
    }

    this.finishedMarbleIds.add(marble.id);
    this.results.push({
      marbleId: marble.id,
      place: this.results.length + 1,
      finishTime: this.runningTime + this.results.length * 0.001,
      progress,
      forced,
    });
  }

  private hasExceededPostFinisherGrace(): boolean {
    if (this.results.length === 0 || this.results.length === this.marbles.length) {
      return false;
    }

    const lastFinishTime = Math.max(...this.results.map((result) => result.finishTime));

    return this.runningTime - lastFinishTime >= (this.options.postFirstFinisherDnfSeconds ?? defaultPostFirstFinisherDnfSeconds);
  }

  private rankMarbles(): MarbleRaceStatus[] {
    const finishedById = new Map(this.results.map((result) => [result.marbleId, result]));
    const statuses = this.marbles.map((marble) => {
      const result = finishedById.get(marble.id);

      return {
        marble,
        rank: 0,
        progress: result?.progress ?? this.trackPath.getProgress(marble.position),
        finished: result !== undefined,
        forced: result?.forced ?? false,
        finishTime: result?.finishTime ?? null,
      };
    });

    statuses.sort(compareRaceStatus);

    return statuses.map((status, index) => ({
      ...status,
      rank: index + 1,
    }));
  }

  private isOffTrackBeforeFinish(marble: Marble, progress: number): boolean {
    const sample = this.trackPath.getSampleAtProgress(progress);
    const position = marble.position;
    const horizontalDistance = Math.hypot(position.x - sample.point.x, position.z - sample.point.z);
    const dropBelowTrack = sample.point.y - position.y;
    const allowedHorizontalDistance = sample.width * 0.5 + 1.6;

    return horizontalDistance > allowedHorizontalDistance || dropBelowTrack > 1.6;
  }
}

function compareRaceStatus(a: MarbleRaceStatus, b: MarbleRaceStatus): number {
  if (a.finished || b.finished) {
    if (a.finished && !b.finished) {
      return a.forced ? 1 : -1;
    }

    if (!a.finished && b.finished) {
      return b.forced ? -1 : 1;
    }

    if (a.finished && b.finished) {
      if (a.forced !== b.forced) {
        return a.forced ? 1 : -1;
      }

      const timeDelta = (a.finishTime ?? 0) - (b.finishTime ?? 0);

      if (timeDelta !== 0) {
        return timeDelta;
      }
    }
  }

  const progressDelta = b.progress - a.progress;

  if (progressDelta !== 0) {
    return progressDelta;
  }

  return a.marble.id.localeCompare(b.marble.id);
}

function compareResults(a: RaceResult, b: RaceResult): number {
  if (a.forced !== b.forced) {
    return a.forced ? 1 : -1;
  }

  const timeDelta = a.finishTime - b.finishTime;

  if (timeDelta !== 0) {
    return timeDelta;
  }

  const progressDelta = b.progress - a.progress;

  if (progressDelta !== 0) {
    return progressDelta;
  }

  return a.marbleId.localeCompare(b.marbleId);
}
