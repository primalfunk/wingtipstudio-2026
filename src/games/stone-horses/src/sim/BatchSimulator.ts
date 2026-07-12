import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { init as initRapier } from "@dimforge/rapier3d-compat";
import { runHeadlessRace } from "./HeadlessRaceRunner";
import { createRacerResultLedger, evaluateTrack } from "./TrackAcceptance";
import { HeadlessRaceReport, RacerResultRecord, TrackAcceptanceReport } from "./SimTypes";
import { TrackMachineType } from "../world/TrackFeatures";

interface CliOptions {
  tracks: number;
  racesPerTrack: number;
  seed: string;
  trackSeed: string | null;
  maxRaceSeconds: number;
  output: string;
  disabledMachines: TrackMachineType[];
}

interface BatchTrackReport extends TrackAcceptanceReport {
  trackSeed: string;
  raceSeeds: string[];
  perRaceMetrics: HeadlessRaceReport[];
  resultLedger: RacerResultRecord[];
  replayFailures: NonNullable<HeadlessRaceReport["replay"]>[];
}

const options = parseArgs(process.argv.slice(2));
const startedAt = new Date().toISOString();
const tracks: BatchTrackReport[] = [];

filterRapierCompatInitWarning();
await (initRapier as unknown as (options: object) => Promise<void>)({});

for (let trackIndex = 0; trackIndex < options.tracks; trackIndex += 1) {
  const trackSeed =
    options.trackSeed && options.tracks === 1
      ? options.trackSeed
      : `${options.seed}_track_${(trackIndex + 1).toString().padStart(3, "0")}`;
  const machineSeed = `${trackSeed}:machines`;
  const races: HeadlessRaceReport[] = [];

  for (let raceIndex = 0; raceIndex < options.racesPerTrack; raceIndex += 1) {
    const raceSeed = `${trackSeed}_race_${(raceIndex + 1).toString().padStart(3, "0")}`;

    races.push(
      runHeadlessRace({
        trackSeed,
        raceSeed,
        machineSeed,
        maxRaceSeconds: options.maxRaceSeconds,
        disabledMachines: options.disabledMachines,
      }),
    );
  }

  const acceptance = evaluateTrack(trackSeed, races);
  const trackReport: BatchTrackReport = {
    trackSeed,
    raceSeeds: races.map((race) => race.raceSeed),
    ...acceptance,
    perRaceMetrics: races,
    resultLedger: createRacerResultLedger(races),
    replayFailures: races.map((race) => race.replay).filter((replay): replay is NonNullable<HeadlessRaceReport["replay"]> => replay !== null),
  };

  tracks.push(trackReport);
  printTrackProgress(trackReport, trackIndex + 1, options.tracks);
}

const acceptedTracks = tracks
  .filter((track) => track.accepted)
  .sort((a, b) => b.overallTrackScore - a.overallTrackScore)
  .map((track) => ({
    trackSeed: track.trackSeed,
    score: track.overallTrackScore,
    averageOvertakes: track.aggregateMetrics.averageOvertakes,
    averageLeaderChanges: track.aggregateMetrics.averageLeaderChanges,
    maxStallTime: track.aggregateMetrics.maxStallTime,
    machineMix: track.perRaceMetrics[0]
      ? {
          machineSeed: track.perRaceMetrics[0].machineSeed,
          slowZoneHits: track.aggregateMetrics.machineInteractionCounts.slowZoneHits,
          forceZoneHits: track.aggregateMetrics.machineInteractionCounts.forceZoneHits,
        }
      : null,
    estimatedRaceDuration: calculateEstimatedRaceDuration(track.perRaceMetrics),
    debugUrl: `http://127.0.0.1:5173/?trackSeed=${encodeURIComponent(track.trackSeed)}`,
  }));

const report = {
  batchSeed: options.seed,
  generatedAt: startedAt,
  options,
  summary: {
    testedTracks: tracks.length,
    acceptedTracks: acceptedTracks.length,
    rejectedTracks: tracks.length - acceptedTracks.length,
    bestScore: acceptedTracks[0]?.score ?? 0,
  },
  tracks,
};
const racerPerformanceReport = tracks.map((track) => ({
  trackSeed: track.trackSeed,
  accepted: track.accepted,
  raceCount: track.aggregateMetrics.raceCount,
  designDecisionSummary: track.aggregateMetrics.designDecisionSummary,
  racerPerformance: track.aggregateMetrics.racerPerformance,
  resultLedger: track.resultLedger,
}));

writeJson(options.output, report);
writeJson("accepted-tracks.json", acceptedTracks);
writeJson("racer-performance.json", racerPerformanceReport);
writeJson("safe-tracks.json", acceptedTracks);
writeJson("safe-machine-configs.json", acceptedTracks.map((track) => ({
  trackSeed: track.trackSeed,
  disabledMachines: options.disabledMachines,
  score: track.score,
  machineMix: track.machineMix,
})));

console.log(`Batch complete: ${acceptedTracks.length}/${tracks.length} accepted`);
console.log(`Report: ${resolve(options.output)}`);
console.log(`Leaderboard: ${resolve("accepted-tracks.json")}`);
console.log(`Racer performance: ${resolve("racer-performance.json")}`);

function parseArgs(args: string[]): CliOptions {
  return {
    tracks: getNumberArg(args, "--tracks", 10),
    racesPerTrack: getNumberArg(args, "--racesPerTrack", 5),
    seed: getStringArg(args, "--seed", "batch-test"),
    trackSeed: getNullableStringArg(args, "--trackSeed"),
    maxRaceSeconds: getNumberArg(args, "--maxRaceSeconds", 180),
    output: getStringArg(args, "--output", "sim-results.json"),
    disabledMachines: parseDisabledMachines(getStringArg(args, "--disableMachines", process.env.SIM_DISABLED_MACHINES ?? "")),
  };
}

function getStringArg(args: string[], name: string, fallback: string): string {
  const index = args.indexOf(name);

  if (index === -1 || !args[index + 1]) {
    return fallback;
  }

  return args[index + 1];
}

function getNullableStringArg(args: string[], name: string): string | null {
  const index = args.indexOf(name);

  if (index === -1 || !args[index + 1]) {
    return null;
  }

  return args[index + 1].trim() || null;
}

function getNumberArg(args: string[], name: string, fallback: number): number {
  const value = Number.parseFloat(getStringArg(args, name, fallback.toString()));

  return Number.isFinite(value) ? value : fallback;
}

function parseDisabledMachines(value: string): TrackMachineType[] {
  const allowed = new Set<TrackMachineType>(["pegboard", "funnel", "spinner", "splitter", "ramp", "panel", "arms"]);

  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is TrackMachineType => allowed.has(part as TrackMachineType));
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(resolve(path), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function printTrackProgress(track: BatchTrackReport, completed: number, total: number): void {
  const status = track.accepted ? "ACCEPT" : "REJECT";
  const reasons = track.failureReasons.length > 0 ? `: ${track.failureReasons.slice(0, 2).join("; ")}` : "";

  console.log(
    `[${completed}/${total}] ${status} ${track.trackSeed} score=${track.overallTrackScore.toFixed(3)} overtakes=${track.aggregateMetrics.averageOvertakes} leaders=${track.aggregateMetrics.averageLeaderChanges}${reasons}`,
  );
}

function calculateEstimatedRaceDuration(races: HeadlessRaceReport[]): number {
  if (races.length === 0) {
    return 0;
  }

  const total = races.reduce((sum, race) => {
    const duration = Math.max(0, ...race.results.map((result) => result.finishTime));

    return sum + duration;
  }, 0);

  return Math.round((total / races.length) * 1000) / 1000;
}

function filterRapierCompatInitWarning(): void {
  const originalWarn = console.warn.bind(console);

  console.warn = (...args: unknown[]): void => {
    const message = args.map((arg) => String(arg)).join(" ");

    if (message.includes("using deprecated parameters for the initialization function")) {
      return;
    }

    originalWarn(...args);
  };
}
