import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { init as initRapier } from "@dimforge/rapier3d-compat";
import { TrackMutationConfig } from "../world/TrackFeatures";
import { runHeadlessRace } from "./HeadlessRaceRunner";
import { HeadlessRaceReport, TrackAcceptanceReport } from "./SimTypes";
import { evaluateTrack } from "./TrackAcceptance";
import { analyzeTrackFeedback, dynamicOvertakeGoal, mergeMutations, TrackFeedbackReport } from "./TrackFeedback";

interface CliOptions {
  tracks: number;
  racesPerTrack: number;
  iterations: number;
  seed: string;
  maxRaceSeconds: number;
  output: string;
}

interface FeedbackIterationReport {
  iteration: number;
  machineSeed: string;
  mutation: TrackMutationConfig;
  accepted: boolean;
  goalMatched: boolean;
  score: number;
  aggregateMetrics: TrackAcceptanceReport["aggregateMetrics"];
  failureReasons: string[];
  feedback: TrackFeedbackReport;
  perRaceMetrics: HeadlessRaceReport[];
}

interface FeedbackTrackReport {
  trackSeed: string;
  selectedIteration: number;
  accepted: boolean;
  goalMatched: boolean;
  iterations: FeedbackIterationReport[];
}

const options = parseArgs(process.argv.slice(2));
const reports: FeedbackTrackReport[] = [];

filterRapierCompatInitWarning();
await (initRapier as unknown as (options: object) => Promise<void>)({});

for (let trackIndex = 0; trackIndex < options.tracks; trackIndex += 1) {
  const trackSeed = `${options.seed}_track_${(trackIndex + 1).toString().padStart(3, "0")}`;
  const iterations: FeedbackIterationReport[] = [];
  let mutation: TrackMutationConfig = {};

  for (let iteration = 0; iteration < options.iterations; iteration += 1) {
    const machineSeed = `${trackSeed}:machines:i${iteration}`;
    const races = runRaceSet(trackSeed, machineSeed, mutation, options);
    const acceptance = evaluateTrack(trackSeed, races);
    const feedback = analyzeTrackFeedback(acceptance, races, dynamicOvertakeGoal);

    iterations.push({
      iteration,
      machineSeed,
      mutation,
      accepted: acceptance.accepted,
      goalMatched: feedback.goalMatched,
      score: acceptance.overallTrackScore,
      aggregateMetrics: acceptance.aggregateMetrics,
      failureReasons: acceptance.failureReasons,
      feedback,
      perRaceMetrics: races,
    });

    console.log(
      `[${trackIndex + 1}/${options.tracks}] i${iteration} ${feedback.goalMatched ? "GOAL" : acceptance.accepted ? "ACCEPT" : "RETRY"} ${trackSeed} score=${acceptance.overallTrackScore.toFixed(3)} overtakes=${acceptance.aggregateMetrics.averageOvertakes} variance=${acceptance.aggregateMetrics.averageSpeedVarianceDelta}`,
    );

    if (feedback.goalMatched) {
      break;
    }

    mutation = mergeMutations(mutation, feedback.mutation);
  }

  const selected = selectBestIteration(iterations);
  reports.push({
    trackSeed,
    selectedIteration: selected.iteration,
    accepted: selected.accepted,
    goalMatched: selected.goalMatched,
    iterations,
  });
}

const accepted = reports.filter((report) => report.accepted);
const matched = reports.filter((report) => report.goalMatched);
const output = {
  batchSeed: options.seed,
  generatedAt: new Date().toISOString(),
  goal: dynamicOvertakeGoal,
  options,
  summary: {
    testedTracks: reports.length,
    acceptedTracks: accepted.length,
    goalMatchedTracks: matched.length,
    bestScore: Math.max(0, ...reports.flatMap((report) => report.iterations.map((iteration) => iteration.score))),
  },
  tracks: reports,
};

writeJson(options.output, output);
writeJson(
  "feedback-mutations.json",
  reports.map((report) => {
    const selected = report.iterations[report.selectedIteration];

    return {
      trackSeed: report.trackSeed,
      selectedIteration: report.selectedIteration,
      accepted: report.accepted,
      goalMatched: report.goalMatched,
      mutation: selected.mutation,
      score: selected.score,
      mismatchReasons: selected.feedback.mismatchReasons,
      mutationNotes: selected.feedback.mutationNotes,
    };
  }),
);

console.log(`Feedback complete: ${accepted.length}/${reports.length} accepted, ${matched.length}/${reports.length} goal-matched`);
console.log(`Report: ${resolve(options.output)}`);
console.log(`Mutations: ${resolve("feedback-mutations.json")}`);

function runRaceSet(trackSeed: string, machineSeed: string, mutation: TrackMutationConfig, cliOptions: CliOptions): HeadlessRaceReport[] {
  const races: HeadlessRaceReport[] = [];

  for (let raceIndex = 0; raceIndex < cliOptions.racesPerTrack; raceIndex += 1) {
    const raceSeed = `${trackSeed}_race_${(raceIndex + 1).toString().padStart(3, "0")}`;

    races.push(
      runHeadlessRace({
        trackSeed,
        raceSeed,
        machineSeed,
        maxRaceSeconds: cliOptions.maxRaceSeconds,
        mutation,
      }),
    );
  }

  return races;
}

function selectBestIteration(iterations: FeedbackIterationReport[]): FeedbackIterationReport {
  return [...iterations].sort((a, b) => {
    if (a.goalMatched !== b.goalMatched) return a.goalMatched ? -1 : 1;
    if (a.accepted !== b.accepted) return a.accepted ? -1 : 1;

    return b.score - a.score;
  })[0];
}

function parseArgs(args: string[]): CliOptions {
  return {
    tracks: getNumberArg(args, "--tracks", 4),
    racesPerTrack: getNumberArg(args, "--racesPerTrack", 3),
    iterations: getNumberArg(args, "--iterations", 3),
    seed: getStringArg(args, "--seed", "feedback-test"),
    maxRaceSeconds: getNumberArg(args, "--maxRaceSeconds", 150),
    output: getStringArg(args, "--output", "feedback-results.json"),
  };
}

function getStringArg(args: string[], name: string, fallback: string): string {
  const index = args.indexOf(name);

  if (index === -1 || !args[index + 1]) {
    return fallback;
  }

  return args[index + 1];
}

function getNumberArg(args: string[], name: string, fallback: number): number {
  const value = Number.parseFloat(getStringArg(args, name, fallback.toString()));

  return Number.isFinite(value) ? value : fallback;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(resolve(path), `${JSON.stringify(value, null, 2)}\n`, "utf8");
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
