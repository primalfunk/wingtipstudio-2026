import { MathUtils, PerspectiveCamera, Vector3 } from "three";
import { MarbleRaceStatus, RaceState } from "../world/RaceController";
import { TrackPath } from "../world/TrackPath";

export type FollowCameraMode = "pack" | "battle" | "leader" | "event" | "finish";

export interface FollowCameraDirectorState {
  mode: FollowCameraMode;
  eventFocus: Vector3 | null;
  eventInfluence: number;
  heat: number;
}

export class FollowCamera {
  private readonly positionVelocity = new Vector3();
  private readonly target = new Vector3();
  private readonly targetVelocity = new Vector3();
  private elapsedTime = 0;
  private shake = 0;
  private cameraShakeEnabled = true;
  private subjectId: string | null = null;
  private directorState: FollowCameraDirectorState = {
    mode: "pack",
    eventFocus: null,
    eventInfluence: 0,
    heat: 0,
  };

  constructor(private readonly trackPath: TrackPath) {}

  update(camera: PerspectiveCamera, rankings: MarbleRaceStatus[], deltaTime: number, raceState: RaceState = "RUNNING", runningTime = 0): void {
    const stepTime = Math.min(deltaTime, 0.05);
    this.elapsedTime += stepTime;

    const activeRankings = rankings.filter((status) => !status.finished && this.isCameraEligible(status));
    const completedRankings = rankings.filter((status) => status.finished && this.isCameraEligible(status));
    const visibleRankings = activeRankings.length > 0 ? activeRankings : completedRankings;
    const leader = this.getCameraSubject(visibleRankings, raceState, runningTime);

    if (!leader) {
      return;
    }

    const pack = visibleRankings.slice(0, Math.min(visibleRankings.length, 5));
    const leaderPosition = leader.marble.position;
    const packCenter = getPackCenter(pack);
    const packSpread = getPackSpread(pack, packCenter);
    const leaderVelocity = leader.marble.body.linvel();
    const leaderSpeed = Math.hypot(leaderVelocity.x, leaderVelocity.y, leaderVelocity.z);
    const launchGrace = raceState !== "RUNNING" || runningTime < 2.4;
    const tangentPoint = launchGrace ? packCenter : leaderPosition;
    const tangent = this.trackPath.getTangent(tangentPoint).normalize();
    const lateral = new Vector3().crossVectors(new Vector3(0, 1, 0), tangent).normalize();
    const focus = launchGrace
      ? packCenter.clone()
      : leaderPosition.clone().lerp(packCenter, MathUtils.clamp(packSpread / 12, 0.22, 0.5));
    if (!launchGrace && this.directorState.eventFocus) {
      focus.lerp(this.directorState.eventFocus, MathUtils.clamp(this.directorState.eventInfluence * 0.28, 0, 0.32));
    }
    const sideShift = Math.sin(this.elapsedTime * 0.22) * MathUtils.clamp(packSpread * 0.1, 0.2, 0.85);
    const modeDistance = this.getModeDistanceAdjustment();
    const modeHeight = this.getModeHeightAdjustment();
    const launchDistance = launchGrace ? 2.2 : 0;
    const launchHeight = launchGrace ? 0.9 : 0;
    const followDistance = MathUtils.clamp(6.2 + launchDistance + leaderSpeed * 0.2 + packSpread * 0.24 + modeDistance, 6.0, 12.8);
    const height = MathUtils.clamp(3.2 + launchHeight + leaderSpeed * 0.06 + packSpread * 0.16 + modeHeight, 3.0, 7.2);
    const desiredPosition = focus
      .clone()
      .addScaledVector(tangent, -followDistance)
      .addScaledVector(lateral, sideShift)
      .add(new Vector3(0, height, 0));
    const desiredTarget = focus.clone().addScaledVector(tangent, 2.4).add(new Vector3(0, 0.35, 0));
    const desiredFov = MathUtils.clamp(48 + leaderSpeed * 1.15 + packSpread * 1.35 + this.getModeFovAdjustment(), 48, 72);

    if (this.cameraShakeEnabled && !launchGrace && this.shake > 0) {
      desiredPosition
        .addScaledVector(lateral, Math.sin(this.elapsedTime * 48) * this.shake * 0.18)
        .add(new Vector3(0, Math.cos(this.elapsedTime * 41) * this.shake * 0.08, 0));
      this.shake = Math.max(0, this.shake - stepTime * 1.8);
    } else if (launchGrace) {
      this.shake = 0;
    }

    smoothDampVector(camera.position, desiredPosition, this.positionVelocity, launchGrace ? 0.78 : 0.58, stepTime);
    smoothDampVector(this.target, desiredTarget, this.targetVelocity, launchGrace ? 0.62 : 0.46, stepTime);
    camera.fov = MathUtils.damp(camera.fov, desiredFov, launchGrace ? 1.4 : 2.2, stepTime);
    camera.updateProjectionMatrix();
    camera.lookAt(this.target);
  }

  addShake(amount: number): void {
    this.shake = Math.min(1, this.shake + amount);
  }

  setCameraShakeEnabled(enabled: boolean): void {
    this.cameraShakeEnabled = enabled;

    if (!enabled) {
      this.shake = 0;
    }
  }

  setDirectorState(state: FollowCameraDirectorState): void {
    this.directorState = state;
  }

  private getCameraSubject(rankings: MarbleRaceStatus[], raceState: RaceState, runningTime: number): MarbleRaceStatus | undefined {
    if (rankings.length === 0) {
      this.subjectId = null;
      return undefined;
    }

    if (raceState !== "RUNNING" || runningTime < 2.4) {
      this.subjectId = rankings[0].marble.id;
      return rankings[0];
    }

    const current = this.subjectId ? rankings.find((status) => status.marble.id === this.subjectId && !status.finished) : undefined;
    const leader = rankings[0];

    if (!current) {
      this.subjectId = leader.marble.id;
      return leader;
    }

    const leaderMargin = leader.progress - current.progress;
    const currentRankStillRelevant = current.rank <= 3 && leaderMargin < 2.2;

    if (leader.marble.id !== current.marble.id && !currentRankStillRelevant) {
      this.subjectId = leader.marble.id;
      return leader;
    }

    return current;
  }

  private isCameraEligible(status: MarbleRaceStatus): boolean {
    if (status.forced) {
      return false;
    }

    if (status.finished) {
      return true;
    }

    const sample = this.trackPath.getSampleAtProgress(status.progress);
    const position = status.marble.position;
    const velocity = status.marble.body.linvel();
    const horizontalDistance = Math.hypot(position.x - sample.point.x, position.z - sample.point.z);
    const dropBelowTrack = sample.point.y - position.y;
    const allowedHorizontalDistance = sample.width * 0.5 + 0.75;

    if (dropBelowTrack > 0.45 && velocity.y < -0.35) {
      return false;
    }

    return horizontalDistance <= allowedHorizontalDistance && dropBelowTrack <= 0.9;
  }

  private getModeDistanceAdjustment(): number {
    if (this.directorState.mode === "battle") return -0.55;
    if (this.directorState.mode === "leader") return -0.25;
    if (this.directorState.mode === "event") return -0.8;
    if (this.directorState.mode === "finish") return -0.45;
    return 0.45;
  }

  private getModeHeightAdjustment(): number {
    if (this.directorState.mode === "pack") return 0.35;
    if (this.directorState.mode === "event") return -0.2;
    if (this.directorState.mode === "finish") return -0.1;
    return 0;
  }

  private getModeFovAdjustment(): number {
    if (this.directorState.mode === "pack") return 3;
    if (this.directorState.mode === "battle") return -1.5;
    if (this.directorState.mode === "leader") return -1;
    if (this.directorState.mode === "event") return -2;
    if (this.directorState.mode === "finish") return 1 + this.directorState.heat * 2;
    return 0;
  }
}

function getPackCenter(rankings: MarbleRaceStatus[]): Vector3 {
  const center = new Vector3();

  for (const status of rankings) {
    center.add(status.marble.position);
  }

  return center.multiplyScalar(1 / Math.max(rankings.length, 1));
}

function getPackSpread(rankings: MarbleRaceStatus[], center: Vector3): number {
  let spread = 0;

  for (const status of rankings) {
    spread = Math.max(spread, status.marble.position.distanceTo(center));
  }

  return spread;
}

function smoothDampVector(
  current: Vector3,
  target: Vector3,
  velocity: Vector3,
  smoothTime: number,
  deltaTime: number,
): void {
  const omega = 2 / Math.max(0.0001, smoothTime);
  const x = omega * deltaTime;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current.clone().sub(target);
  const temp = velocity.clone().addScaledVector(change, omega).multiplyScalar(deltaTime);

  velocity.sub(temp.clone().multiplyScalar(omega)).multiplyScalar(exp);
  current.copy(target.clone().add(change.add(temp).multiplyScalar(exp)));
}
