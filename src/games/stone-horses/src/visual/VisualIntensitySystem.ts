import { RaceController } from "../world/RaceController";
import { RaceTelemetry } from "../world/RaceTelemetry";

export interface VisualIntensityState {
  heat: number;
  brightness: number;
  saturation: number;
  glowIntensity: number;
  cameraActivity: number;
}

export class VisualIntensitySystem {
  private previousOvertakes = 0;
  private previousLeaderChanges = 0;
  private overtakePulse = 0;
  private leaderPulse = 0;
  private heat = 0;

  update(deltaTime: number, race: RaceController, telemetry: RaceTelemetry): VisualIntensityState {
    const overtakeDelta = Math.max(0, telemetry.overtakes - this.previousOvertakes);
    const leaderDelta = Math.max(0, telemetry.leaderChanges - this.previousLeaderChanges);
    const packDensity = calculatePackDensity(race);
    const finishPressure = calculateFinishPressure(race);
    const speedVariance = Math.min(1, telemetry.speedVarianceDelta / 0.02);

    this.overtakePulse = Math.max(this.overtakePulse, Math.min(1, overtakeDelta * 0.08));
    this.leaderPulse = Math.max(this.leaderPulse, Math.min(1, leaderDelta * 0.36));
    this.overtakePulse = Math.max(0, this.overtakePulse - deltaTime * 1.8);
    this.leaderPulse = Math.max(0, this.leaderPulse - deltaTime * 1.25);

    const targetHeat = clamp01(packDensity * 0.28 + finishPressure * 0.24 + speedVariance * 0.12 + this.overtakePulse * 0.2 + this.leaderPulse * 0.24);
    this.heat += (targetHeat - this.heat) * Math.min(1, deltaTime * 2.8);
    this.previousOvertakes = telemetry.overtakes;
    this.previousLeaderChanges = telemetry.leaderChanges;

    return {
      heat: round(this.heat),
      brightness: round(0.75 + this.heat * 0.35),
      saturation: round(0.8 + this.heat * 0.4),
      glowIntensity: round(0.5 + this.heat * 1.1),
      cameraActivity: round(this.heat * 0.8 + this.leaderPulse * 0.4),
    };
  }
}

function calculatePackDensity(race: RaceController): number {
  const active = race.rankings.filter((status) => !status.finished).slice(0, 6);

  if (active.length <= 1) {
    return 0;
  }

  const progressValues = active.map((status) => status.progress);
  const spread = Math.max(...progressValues) - Math.min(...progressValues);

  return clamp01(1 - spread / 22);
}

function calculateFinishPressure(race: RaceController): number {
  if (race.state !== "RUNNING") {
    return 0;
  }

  const leader = race.rankings[0];

  if (!leader) {
    return 0;
  }

  return race.results.length > 0 ? 1 : clamp01(leader.progress / 130);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
