import { Vector3 } from "three";
import { FollowCamera } from "../render/FollowCamera";
import { Marble } from "../world/Marble";
import { RaceController } from "../world/RaceController";
import { RaceTelemetry } from "../world/RaceTelemetry";
import { TrackPath } from "../world/TrackPath";
import { VisualIntensityState } from "./VisualIntensitySystem";

export type DirectorCameraMode = "pack" | "battle" | "leader" | "event" | "finish";
export type DirectorEventType =
  | "Near Miss"
  | "Compression Spike"
  | "Speed Burst"
  | "Major Overtake"
  | "Trajectory Split"
  | "Timing Block";

export interface DirectorEvent {
  type: DirectorEventType;
  label: string;
  progress: number;
  position: Vector3;
  intensity: number;
  ttl: number;
}

export interface DirectorState {
  cameraMode: DirectorCameraMode;
  activeEvent: string;
  sectionRole: string;
  eventFeed: string[];
  eventPulse: number;
  focusPoint: Vector3 | null;
}

interface MarbleSnapshot {
  progress: number;
  position: Vector3;
  speed: number;
}

export class RaceDirectorSystem {
  private previousSnapshots = new Map<string, MarbleSnapshot>();
  private previousTopThree = "";
  private previousPackSpread = 0;
  private previousSectionContacts: Record<string, number> = {};
  private activeEvents: DirectorEvent[] = [];
  private eventFeed: string[] = [];
  private state: DirectorState = {
    cameraMode: "pack",
    activeEvent: "None",
    sectionRole: "Gate",
    eventFeed: [],
    eventPulse: 0,
    focusPoint: null,
  };

  constructor(private readonly trackPath: TrackPath) {}

  update(
    deltaTime: number,
    race: RaceController,
    telemetry: RaceTelemetry,
    marbles: Marble[],
    intensity: VisualIntensityState,
    camera: FollowCamera,
  ): DirectorState {
    this.ageEvents(deltaTime);
    this.detectEvents(race, telemetry, marbles, intensity);

    const active = race.rankings.filter((status) => !status.finished && this.isTrackEligible(status.marble, status.progress));
    const progressValues = active.map((status) => status.progress);
    const spread = progressValues.length > 1 ? Math.max(...progressValues) - Math.min(...progressValues) : 0;
    const leaderGap = progressValues.length > 1 ? progressValues[0] - progressValues[1] : 0;
    const focusEvent = this.activeEvents[0] ?? null;
    const leader = active[0] ?? race.rankings[0];
    const finishPressure = race.results.length > 0 || (leader?.progress ?? 0) > this.trackPath.finishProgress * 0.82;

    let cameraMode: DirectorCameraMode = "pack";
    if (finishPressure) cameraMode = "finish";
    else if (focusEvent && focusEvent.ttl > 0.35) cameraMode = "event";
    else if (spread < 7 && active.length >= 3) cameraMode = "battle";
    else if (leaderGap > 10) cameraMode = "leader";

    const focusPoint = focusEvent?.position.clone() ?? null;
    const eventPulse = Math.max(0, ...this.activeEvents.map((event) => event.intensity * Math.min(1, event.ttl)));
    camera.setDirectorState({
      mode: cameraMode,
      eventFocus: focusPoint,
      eventInfluence: eventPulse,
      heat: intensity.heat,
    });

    this.state = {
      cameraMode,
      activeEvent: focusEvent?.type ?? "None",
      sectionRole: this.getActiveSectionRole(telemetry, leader?.progress ?? 0),
      eventFeed: [...this.eventFeed],
      eventPulse,
      focusPoint,
    };

    return this.state;
  }

  getState(): DirectorState {
    return this.state;
  }

  consumeEvents(): DirectorEvent[] {
    return this.activeEvents.filter((event) => event.ttl > 0.55);
  }

  private detectEvents(race: RaceController, telemetry: RaceTelemetry, marbles: Marble[], intensity: VisualIntensityState): void {
    const snapshots = new Map<string, MarbleSnapshot>();
    const active = race.rankings.filter((status) => !status.finished && this.isTrackEligible(status.marble, status.progress));
    const activeMarbleIds = new Set(active.map((status) => status.marble.id));
    const activeMarbles = marbles.filter((marble) => activeMarbleIds.has(marble.id));
    const progressValues = active.map((status) => status.progress);
    const spread = progressValues.length > 1 ? Math.max(...progressValues) - Math.min(...progressValues) : 0;

    for (const marble of activeMarbles) {
      const velocity = marble.body.linvel();
      snapshots.set(marble.id, {
        progress: this.trackPath.getProgress(marble.position),
        position: marble.position.clone(),
        speed: Math.hypot(velocity.x, velocity.y, velocity.z),
      });
    }

    this.detectNearMisses(activeMarbles, snapshots, intensity);
    this.detectSpeedBursts(snapshots, intensity);

    if (this.previousPackSpread > 0 && spread < this.previousPackSpread - 5 && active.length >= 4) {
      this.pushEvent("Compression Spike", "Pack compression", active[0]?.progress ?? 0, getCenter(active.map((status) => status.marble)), 0.7 + intensity.heat * 0.4);
    }

    const topThree = active.slice(0, 3).map((status) => status.marble.id).join(",");
    if (this.previousTopThree && topThree && topThree !== this.previousTopThree) {
      this.pushEvent("Major Overtake", "Top-three shuffle", active[0]?.progress ?? 0, active[0]?.marble.position ?? new Vector3(), 0.85 + intensity.heat * 0.4);
    }

    this.detectTrajectorySplit(active);
    this.detectTimingBlock(telemetry);
    this.previousTopThree = topThree;
    this.previousPackSpread = spread;
    this.previousSnapshots = snapshots;
  }

  private detectNearMisses(marbles: Marble[], snapshots: Map<string, MarbleSnapshot>, intensity: VisualIntensityState): void {
    for (let i = 0; i < marbles.length; i += 1) {
      for (let j = i + 1; j < marbles.length; j += 1) {
        const a = snapshots.get(marbles[i].id);
        const b = snapshots.get(marbles[j].id);
        if (!a || !b) continue;
        const distance = a.position.distanceTo(b.position);
        const relativeSpeed = Math.abs(a.speed - b.speed);
        if (distance < 0.82 && relativeSpeed > 1.2) {
          this.pushEvent("Near Miss", "Near miss", Math.max(a.progress, b.progress), a.position.clone().lerp(b.position, 0.5), 0.45 + intensity.heat * 0.3);
          return;
        }
      }
    }
  }

  private detectSpeedBursts(snapshots: Map<string, MarbleSnapshot>, intensity: VisualIntensityState): void {
    const values = [...snapshots.values()];
    const averageSpeed = values.reduce((sum, value) => sum + value.speed, 0) / Math.max(1, values.length);
    const burst = values.find((value) => value.speed > Math.max(3.2, averageSpeed + 1.4));
    if (burst) {
      this.pushEvent("Speed Burst", "Speed burst", burst.progress, burst.position, 0.38 + intensity.heat * 0.3);
    }
  }

  private detectTrajectorySplit(active: RaceController["rankings"]): void {
    if (active.length < 4) return;
    const front = active.slice(0, 5);
    const xs = front.map((status) => status.marble.position.x);
    if (Math.max(...xs) - Math.min(...xs) > 4.4) {
      this.pushEvent("Trajectory Split", "Path split", front[0].progress, getCenter(front.map((status) => status.marble)), 0.42);
    }
  }

  private detectTimingBlock(telemetry: RaceTelemetry): void {
    for (const [sectionId, count] of Object.entries(telemetry.sectionContactCounts)) {
      const previous = this.previousSectionContacts[sectionId] ?? 0;
      if ((sectionId.includes("spinner") || sectionId.includes("panel") || sectionId.includes("swing")) && count - previous >= 3) {
        this.pushEvent("Timing Block", "Timing block", 0, new Vector3(), 0.55);
      }
      this.previousSectionContacts[sectionId] = count;
    }
  }

  private pushEvent(type: DirectorEventType, label: string, progress: number, position: Vector3, intensity: number): void {
    if (this.activeEvents.some((event) => event.type === type && event.ttl > 0.45)) return;
    const event = { type, label, progress, position: position.clone(), intensity: Math.min(1.25, intensity), ttl: 1.2 };
    this.activeEvents.unshift(event);
    this.activeEvents.length = Math.min(this.activeEvents.length, 8);
    this.eventFeed.unshift(label);
    this.eventFeed.length = Math.min(this.eventFeed.length, 3);
  }

  private ageEvents(deltaTime: number): void {
    for (const event of this.activeEvents) {
      event.ttl -= deltaTime;
    }
    this.activeEvents = this.activeEvents.filter((event) => event.ttl > 0);
  }

  private getActiveSectionRole(telemetry: RaceTelemetry, leaderProgress: number): string {
    const closest = telemetry.validation.packSections
      .map((section) => ({ section, distance: Math.abs(section.progress - leaderProgress) }))
      .sort((a, b) => a.distance - b.distance)[0]?.section;
    if (!closest || Math.abs(closest.progress - leaderProgress) > 12) return "Open Track";
    if (closest.sectionType.includes("pegboard")) return "Randomizer";
    if (closest.sectionType.includes("split") || closest.sectionType.includes("merge")) return "Overtake Converter";
    if (closest.sectionType.includes("slow")) return "Slowdown Zone";
    if (closest.sectionType.includes("speed")) return "Speed-Up Zone";
    if (closest.sectionType.includes("spinner") || closest.sectionType.includes("panel") || closest.sectionType.includes("arm")) return "Disruptor";
    if (closest.sectionType.includes("funnel") || closest.sectionType.includes("ramp")) return "Compressor";
    return "Feature Zone";
  }

  private isTrackEligible(marble: Marble, progress: number): boolean {
    const sample = this.trackPath.getSampleAtProgress(progress);
    const velocity = marble.body.linvel();
    const horizontalDistance = Math.hypot(marble.position.x - sample.point.x, marble.position.z - sample.point.z);
    const dropBelowTrack = sample.point.y - marble.position.y;
    const allowedHorizontalDistance = sample.width * 0.5 + 0.75;

    if (dropBelowTrack > 0.45 && velocity.y < -0.35) {
      return false;
    }

    return horizontalDistance <= allowedHorizontalDistance && dropBelowTrack <= 0.9;
  }
}

function getCenter(marbles: Marble[]): Vector3 {
  const center = new Vector3();
  for (const marble of marbles) center.add(marble.position);
  return center.multiplyScalar(1 / Math.max(1, marbles.length));
}
