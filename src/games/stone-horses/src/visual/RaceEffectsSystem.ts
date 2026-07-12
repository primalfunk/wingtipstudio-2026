import { Group } from "three";
import { FollowCamera } from "../render/FollowCamera";
import { RaceController } from "../world/RaceController";
import { RaceTelemetry } from "../world/RaceTelemetry";
import { RailVisualHandle } from "./RailVisuals";
import { VisualIntensityState } from "./VisualIntensitySystem";
import { DirectorEvent } from "./RaceDirectorSystem";
import { VisualSettingsState } from "./VisualSettings";

export class RaceEffectsSystem {
  readonly root = new Group();
  private previousLeaderChanges = 0;
  private finishTriggered = false;
  private handledDirectorEvents = new Set<string>();
  private settings: VisualSettingsState;

  constructor(
    private readonly race: RaceController,
    private readonly telemetry: RaceTelemetry,
    private readonly railVisuals: RailVisualHandle | null,
    private readonly camera: FollowCamera,
    settings: VisualSettingsState,
  ) {
    this.settings = settings;
  }

  setSettings(settings: VisualSettingsState): void {
    this.settings = settings;
    this.railVisuals?.setEnabled(settings.trackTheme);
  }

  update(deltaTime: number, elapsedTime: number, intensity: VisualIntensityState, directorEvents: DirectorEvent[] = []): void {
    const leader = this.race.rankings[0];

    if (this.settings.reactiveLighting && leader) {
      this.railVisuals?.pulseAtProgress(leader.progress, this.race.state === "RUNNING" ? 0.18 + intensity.glowIntensity * 0.08 : 0.08);
    }

    if (this.telemetry.leaderChanges > this.previousLeaderChanges && leader && this.race.runningTime > 2.4) {
      this.camera.addShake(0.12 + intensity.cameraActivity * 0.12);
      this.railVisuals?.pulseAtProgress(leader.progress, 0.9);
    }

    if (this.race.state === "FINISHED" && !this.finishTriggered) {
      this.finishTriggered = true;
      this.camera.addShake(0.18 + intensity.cameraActivity * 0.12);
      this.railVisuals?.finishBurst();
    }

    for (const event of directorEvents) {
      const key = `${event.type}:${event.progress.toFixed(1)}:${event.ttl.toFixed(1)}`;
      if (this.handledDirectorEvents.has(key)) continue;
      this.handledDirectorEvents.add(key);
      if (this.race.runningTime > 2.4 && (event.type === "Major Overtake" || event.type === "Compression Spike")) {
        this.camera.addShake(0.06 + event.intensity * 0.08);
      }
    }

    this.previousLeaderChanges = this.telemetry.leaderChanges;
    this.railVisuals?.update(deltaTime, elapsedTime);
  }
}
