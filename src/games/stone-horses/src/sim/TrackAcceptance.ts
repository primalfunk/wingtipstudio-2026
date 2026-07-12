import {
  DesignDecisionSummary,
  HeadlessRaceReport,
  MachineInteractionCounts,
  RacerPerformanceSummary,
  RacerResultRecord,
  TrackAcceptanceReport,
  TrackAggregateMetrics,
} from "./SimTypes";

const thresholds = {
  maxStallTime: 1.5,
  lowProgressWindowsPerMarble: 3,
  antiStallNudgesPerRace: 1,
  validatorRepairsPerTrack: 10,
  validatorRemovalsPerTrack: 0,
  localProbeFailuresPerTrack: 2,
  averageOvertakes: 20,
  averageLeaderChanges: 4,
  averageOrderChanges: 40,
  meaningfulMachineHits: 24,
  averageSpeedVarianceDelta: 0.006,
  paddleContactsPerRace: 6,
  maxStartSlotWinShare: 0.35,
  maxAverageSpearman: 0.62,
};

export function evaluateTrack(trackSeed: string, races: HeadlessRaceReport[]): TrackAcceptanceReport {
  const aggregateMetrics = aggregateRaceMetrics(races);
  const failureReasons: string[] = [];
  const recommendedTuningNotes: string[] = [];

  if (aggregateMetrics.maxStallTime > thresholds.maxStallTime) {
    failureReasons.push(`max stall time ${aggregateMetrics.maxStallTime}s exceeded ${thresholds.maxStallTime}s`);
    recommendedTuningNotes.push("Open clearance around high-contact machines or add stronger down-track force zones.");
  }

  if (aggregateMetrics.lowProgressWindows > thresholds.lowProgressWindowsPerMarble * 8 * races.length) {
    failureReasons.push("too many low-progress windows");
  }

  if (aggregateMetrics.likelyStuckEvents > 0) {
    failureReasons.push("likely stuck event detected");
    recommendedTuningNotes.push("Regenerate or remove the closest machine near the replay failure point.");
  }

  if (aggregateMetrics.totalDnfs > 0) {
    failureReasons.push(`${aggregateMetrics.totalDnfs} DNF/forced finish result(s)`);
  }

  if (aggregateMetrics.timeoutCount > 0) {
    failureReasons.push(`${aggregateMetrics.timeoutCount} timeout race(s)`);
  }

  if (aggregateMetrics.antiStallNudges > thresholds.antiStallNudgesPerRace * races.length) {
    failureReasons.push("anti-stall nudges exceeded limit");
    recommendedTuningNotes.push("Reduce pinball density or widen exits before relying on nudges.");
  }

  if (aggregateMetrics.validatorRepairs > thresholds.validatorRepairsPerTrack || aggregateMetrics.validatorRemovals > thresholds.validatorRemovalsPerTrack) {
    failureReasons.push("TrackSafetyValidator repaired/removed too much generated geometry");
    recommendedTuningNotes.push("Relax machine density or move machines away from walls before validation.");
  }

  if (aggregateMetrics.localProbeFailures > thresholds.localProbeFailuresPerTrack) {
    failureReasons.push("local machine probes rejected too many machine layouts");
    recommendedTuningNotes.push("Reduce machine obstruction before relying on preflight removal.");
  }

  if (aggregateMetrics.averageOvertakes < thresholds.averageOvertakes) {
    recommendedTuningNotes.push("Increase low-risk machine intensity, especially pegboard and splitter interaction.");
  }

  if (aggregateMetrics.averageLeaderChanges < thresholds.averageLeaderChanges) {
    recommendedTuningNotes.push("Leader changes are below the Tier 2 target; tune after Tier 0 safety is stable.");
  }

  if (aggregateMetrics.averageOrderChanges < thresholds.averageOrderChanges) {
    recommendedTuningNotes.push("Order changes are below the Tier 2 target; keep safety tuning first.");
  }

  if (aggregateMetrics.machineInteractionCounts.forceZoneHits + aggregateMetrics.machineInteractionCounts.slowZoneHits < thresholds.meaningfulMachineHits * races.length) {
    recommendedTuningNotes.push("Place machines closer to the racing line and make visual geometry match the active zones.");
  }

  if (aggregateMetrics.averageSpeedVarianceDelta < thresholds.averageSpeedVarianceDelta) {
    recommendedTuningNotes.push("Speed variance zones are too uniform; increase patch asymmetry or replace the section.");
  }

  if (aggregateMetrics.machineInteractionCounts.paddleContacts < thresholds.paddleContactsPerRace * races.length) {
    recommendedTuningNotes.push("Paddle contact is below target; move it after compression or widen the sweep.");
  }

  const highestStartSlotShare = getHighestShare(aggregateMetrics.startSlotWinDistribution, races.length);

  if (highestStartSlotShare > thresholds.maxStartSlotWinShare) {
    recommendedTuningNotes.push("Reduce start-lane bias or increase early splitter/pegboard variance.");
  }

  if (aggregateMetrics.averageSpearman > thresholds.maxAverageSpearman) {
    recommendedTuningNotes.push("Finish order tracks start order too closely; tune fairness after safety acceptance.");
  }

  const safetyScore = calculateSafetyScore(aggregateMetrics, races.length);
  const excitementScore = calculateExcitementScore(aggregateMetrics);
  const fairnessScore = calculateFairnessScore(aggregateMetrics, races.length);
  const overallTrackScore = round(safetyScore * 0.5 + excitementScore * 0.35 + fairnessScore * 0.15);

  return {
    accepted: failureReasons.length === 0,
    failureReasons,
    safetyScore,
    excitementScore,
    fairnessScore,
    overallTrackScore,
    aggregateMetrics,
    recommendedTuningNotes: [...new Set(recommendedTuningNotes)],
  };
}

function aggregateRaceMetrics(races: HeadlessRaceReport[]): TrackAggregateMetrics {
  const emptyInteractions: MachineInteractionCounts = {
    slowZoneHits: 0,
    forceZoneHits: 0,
    variableSlowdownHits: 0,
    speedBoostHits: 0,
    paddleContacts: 0,
    paddleLeaderContacts: 0,
    antiStallNudges: 0,
  };

  if (races.length === 0) {
    return {
      raceCount: 0,
      maxStallTime: 0,
      totalDnfs: 0,
      timeoutCount: 0,
      likelyStuckEvents: 0,
      lowProgressWindows: 0,
      antiStallNudges: 0,
      validatorRepairs: 0,
      validatorRemovals: 0,
      localProbeFailures: 0,
      averageOvertakes: 0,
      averageLeaderChanges: 0,
      averageOrderChanges: 0,
      averagePositionDelta: 0,
      averageFinalStretchLeaderChanges: 0,
      averageFinishTimeSpread: 0,
      averageSpearman: 0,
      averageStepCostMs: 0,
      winDistribution: {},
      startSlotWinDistribution: {},
      machineInteractionCounts: emptyInteractions,
      averageSpeedVarianceDelta: 0,
      paddleContactRate: 0,
      differentialEffectScore: 0,
      overtakeConversionRate: 0,
      sectionContactCounts: {},
      packSections: [],
      failureHotspots: [],
      racerPerformance: [],
      designDecisionSummary: {
        raceCount: 0,
        racerCount: 0,
        fairnessVerdict: "watch",
        dominantRacer: null,
        dominantRacerWinRate: 0,
        dominantStartSlot: null,
        dominantStartSlotWinRate: 0,
        mostConsistentRacer: null,
        mostVolatileRacer: null,
        dnfRate: 0,
        averageFinishSpread: 0,
        notes: ["No races were simulated."],
      },
    };
  }

  const winDistribution: Record<string, number> = {};
  const startSlotWinDistribution: Record<string, number> = {};
  const totals = races.reduce(
    (sum, race) => {
      if (race.fairness.winningMarbleId) {
        winDistribution[race.fairness.winningMarbleId] = (winDistribution[race.fairness.winningMarbleId] ?? 0) + 1;
      }

      if (race.fairness.winningStartSlot !== null) {
        const key = race.fairness.winningStartSlot.toString();
        startSlotWinDistribution[key] = (startSlotWinDistribution[key] ?? 0) + 1;
      }

      return {
        maxStallTime: Math.max(sum.maxStallTime, race.safety.maxStallTime),
        totalDnfs: sum.totalDnfs + race.safety.dnfCount,
        timeoutCount: sum.timeoutCount + (race.safety.timeoutOccurred ? 1 : 0),
        likelyStuckEvents: sum.likelyStuckEvents + race.safety.likelyStuckEvents,
        lowProgressWindows: sum.lowProgressWindows + race.safety.lowProgressWindows,
        antiStallNudges: sum.antiStallNudges + race.safety.antiStallNudges,
        validatorRepairs: Math.max(sum.validatorRepairs, race.safety.validatorRepairs),
        validatorRemovals: Math.max(sum.validatorRemovals, race.safety.validatorRemovals),
        localProbeFailures: Math.max(sum.localProbeFailures, race.safety.localProbeFailures),
        overtakes: sum.overtakes + race.excitement.totalOvertakes,
        leaderChanges: sum.leaderChanges + race.excitement.leaderChanges,
        orderChanges: sum.orderChanges + race.excitement.orderChanges,
        positionDelta: sum.positionDelta + race.excitement.averagePositionDelta,
        finalStretchLeaderChanges: sum.finalStretchLeaderChanges + race.excitement.finalStretchLeaderChanges,
        finishTimeSpread: sum.finishTimeSpread + race.fairness.finishTimeSpread,
        spearman: sum.spearman + race.fairness.startFinishSpearman,
        stepCostMs: sum.stepCostMs + race.performance.stepCostMs,
        machineInteractionCounts: {
          slowZoneHits: sum.machineInteractionCounts.slowZoneHits + race.excitement.machineInteractionCounts.slowZoneHits,
          forceZoneHits: sum.machineInteractionCounts.forceZoneHits + race.excitement.machineInteractionCounts.forceZoneHits,
          variableSlowdownHits: sum.machineInteractionCounts.variableSlowdownHits + race.excitement.machineInteractionCounts.variableSlowdownHits,
          speedBoostHits: sum.machineInteractionCounts.speedBoostHits + race.excitement.machineInteractionCounts.speedBoostHits,
          paddleContacts: sum.machineInteractionCounts.paddleContacts + race.excitement.machineInteractionCounts.paddleContacts,
          paddleLeaderContacts: sum.machineInteractionCounts.paddleLeaderContacts + race.excitement.machineInteractionCounts.paddleLeaderContacts,
          antiStallNudges: sum.machineInteractionCounts.antiStallNudges + race.excitement.machineInteractionCounts.antiStallNudges,
        },
        speedVarianceDelta: sum.speedVarianceDelta + race.excitement.speedVarianceDelta,
        paddleContactRate: sum.paddleContactRate + race.excitement.paddleContactRate,
        sectionContactCounts: mergeContactCounts(sum.sectionContactCounts, race.excitement.sectionContactCounts),
      };
    },
    {
      maxStallTime: 0,
      totalDnfs: 0,
      timeoutCount: 0,
      likelyStuckEvents: 0,
      lowProgressWindows: 0,
      antiStallNudges: 0,
      validatorRepairs: 0,
      validatorRemovals: 0,
      localProbeFailures: 0,
      overtakes: 0,
      leaderChanges: 0,
      orderChanges: 0,
      positionDelta: 0,
      finalStretchLeaderChanges: 0,
      finishTimeSpread: 0,
      spearman: 0,
      stepCostMs: 0,
      machineInteractionCounts: emptyInteractions,
      speedVarianceDelta: 0,
      paddleContactRate: 0,
      sectionContactCounts: {},
    },
  );

  const resultLedger = createRacerResultLedger(races);
  const racerPerformance = summarizeRacerPerformance(resultLedger);

  return {
    raceCount: races.length,
    maxStallTime: round(totals.maxStallTime),
    totalDnfs: totals.totalDnfs,
    timeoutCount: totals.timeoutCount,
    likelyStuckEvents: totals.likelyStuckEvents,
    lowProgressWindows: totals.lowProgressWindows,
    antiStallNudges: totals.antiStallNudges,
    validatorRepairs: totals.validatorRepairs,
    validatorRemovals: totals.validatorRemovals,
    localProbeFailures: totals.localProbeFailures,
    averageOvertakes: round(totals.overtakes / races.length),
    averageLeaderChanges: round(totals.leaderChanges / races.length),
    averageOrderChanges: round(totals.orderChanges / races.length),
    averagePositionDelta: round(totals.positionDelta / races.length),
    averageFinalStretchLeaderChanges: round(totals.finalStretchLeaderChanges / races.length),
    averageFinishTimeSpread: round(totals.finishTimeSpread / races.length),
    averageSpearman: round(totals.spearman / races.length),
    averageStepCostMs: round(totals.stepCostMs / races.length),
    winDistribution,
    startSlotWinDistribution,
    machineInteractionCounts: totals.machineInteractionCounts,
    averageSpeedVarianceDelta: round(totals.speedVarianceDelta / races.length),
    paddleContactRate: round(totals.paddleContactRate / races.length),
    differentialEffectScore: calculateDifferentialEffectScore(totals.machineInteractionCounts, totals.speedVarianceDelta / races.length),
    overtakeConversionRate: round(totals.overtakes / Math.max(1, totals.machineInteractionCounts.variableSlowdownHits + totals.machineInteractionCounts.speedBoostHits)),
    sectionContactCounts: totals.sectionContactCounts,
    packSections: races[0]?.packSections ?? [],
    failureHotspots: getFailureHotspots(races),
    racerPerformance,
    designDecisionSummary: createDesignDecisionSummary(races, racerPerformance, startSlotWinDistribution, totals.totalDnfs),
  };
}

export function createRacerResultLedger(races: HeadlessRaceReport[]): RacerResultRecord[] {
  return races.flatMap((race) =>
    race.results.map((result) => ({
      raceSeed: race.raceSeed,
      marbleId: result.marbleId,
      startSlot: result.startSlot,
      place: result.place,
      finishTime: result.finishTime,
      progress: result.progress,
      forced: result.forced,
    })),
  );
}

function summarizeRacerPerformance(records: RacerResultRecord[]): RacerPerformanceSummary[] {
  const recordsByMarble = new Map<string, RacerResultRecord[]>();

  for (const record of records) {
    const marbleRecords = recordsByMarble.get(record.marbleId) ?? [];
    marbleRecords.push(record);
    recordsByMarble.set(record.marbleId, marbleRecords);
  }

  return [...recordsByMarble.entries()]
    .map(([marbleId, marbleRecords]) => {
      const places = marbleRecords.map((record) => record.place);
      const finishTimes = marbleRecords.map((record) => record.finishTime);
      const averageStartSlot = average(marbleRecords.map((record) => record.startSlot));
      const starts = marbleRecords.length;
      const wins = marbleRecords.filter((record) => record.place === 1).length;
      const placesCount = marbleRecords.filter((record) => record.place <= 2).length;
      const shows = marbleRecords.filter((record) => record.place <= 3).length;
      const dnfs = marbleRecords.filter((record) => record.forced).length;
      const finishPositionDistribution = countBy(places.map(String));
      const finishPlaceStdDev = standardDeviation(places);

      return {
        marbleId,
        startSlot: round(averageStartSlot),
        starts,
        wins,
        places: placesCount,
        shows,
        dnfs,
        winRate: round(wins / Math.max(1, starts)),
        placeRate: round(placesCount / Math.max(1, starts)),
        showRate: round(shows / Math.max(1, starts)),
        dnfRate: round(dnfs / Math.max(1, starts)),
        averageFinishPlace: round(average(places)),
        medianFinishPlace: round(median(places)),
        bestFinishPlace: Math.min(...places),
        worstFinishPlace: Math.max(...places),
        averageFinishTime: round(average(finishTimes)),
        medianFinishTime: round(median(finishTimes)),
        bestFinishTime: round(Math.min(...finishTimes)),
        worstFinishTime: round(Math.max(...finishTimes)),
        averagePositionDelta: round(average(marbleRecords.map((record) => record.startSlot - record.place))),
        finishPlaceStdDev: round(finishPlaceStdDev),
        consistencyScore: round(1 / (1 + finishPlaceStdDev)),
        finishPositionDistribution,
      };
    })
    .sort((a, b) => a.averageFinishPlace - b.averageFinishPlace || b.winRate - a.winRate || a.marbleId.localeCompare(b.marbleId));
}

function createDesignDecisionSummary(
  races: HeadlessRaceReport[],
  racerPerformance: RacerPerformanceSummary[],
  startSlotWinDistribution: Record<string, number>,
  totalDnfs: number,
): DesignDecisionSummary {
  const raceCount = races.length;
  const racerCount = racerPerformance.length;
  const dominantRacer = [...racerPerformance].sort((a, b) => b.winRate - a.winRate)[0] ?? null;
  const dominantSlotEntry = Object.entries(startSlotWinDistribution).sort((a, b) => b[1] - a[1])[0];
  const dominantStartSlot = dominantSlotEntry ? Number(dominantSlotEntry[0]) : null;
  const dominantStartSlotWinRate = dominantSlotEntry ? round(dominantSlotEntry[1] / Math.max(1, raceCount)) : 0;
  const mostConsistentRacer = [...racerPerformance].sort((a, b) => b.consistencyScore - a.consistencyScore)[0] ?? null;
  const mostVolatileRacer = [...racerPerformance].sort((a, b) => b.finishPlaceStdDev - a.finishPlaceStdDev)[0] ?? null;
  const dnfRate = round(totalDnfs / Math.max(1, raceCount * Math.max(1, racerCount)));
  const dominantRacerWinRate = dominantRacer?.winRate ?? 0;
  const fairnessVerdict = getFairnessVerdict(dominantRacerWinRate, dominantStartSlotWinRate, dnfRate);
  const notes = createDecisionNotes(fairnessVerdict, dominantRacer, dominantStartSlot, dominantStartSlotWinRate, dnfRate);

  return {
    raceCount,
    racerCount,
    fairnessVerdict,
    dominantRacer: dominantRacer?.marbleId ?? null,
    dominantRacerWinRate,
    dominantStartSlot,
    dominantStartSlotWinRate,
    mostConsistentRacer: mostConsistentRacer?.marbleId ?? null,
    mostVolatileRacer: mostVolatileRacer?.marbleId ?? null,
    dnfRate,
    averageFinishSpread: round(average(races.map((race) => race.fairness.finishTimeSpread))),
    notes,
  };
}

function getFairnessVerdict(dominantRacerWinRate: number, dominantStartSlotWinRate: number, dnfRate: number): DesignDecisionSummary["fairnessVerdict"] {
  if (dnfRate > 0 || dominantStartSlotWinRate > 0.45 || dominantRacerWinRate > 0.45) {
    return "biased";
  }

  if (dominantStartSlotWinRate > 0.35 || dominantRacerWinRate > 0.35) {
    return "watch";
  }

  return "balanced";
}

function createDecisionNotes(
  fairnessVerdict: DesignDecisionSummary["fairnessVerdict"],
  dominantRacer: RacerPerformanceSummary | null,
  dominantStartSlot: number | null,
  dominantStartSlotWinRate: number,
  dnfRate: number,
): string[] {
  const notes: string[] = [];

  if (fairnessVerdict === "balanced") {
    notes.push("Win distribution is within the current balance target.");
  } else if (fairnessVerdict === "watch") {
    notes.push("Distribution is playable but should be watched over larger samples.");
  } else {
    notes.push("Distribution is outside the current balance target and should be tuned before relying on this track.");
  }

  if (dominantRacer) {
    notes.push(`${dominantRacer.marbleId} has the highest win rate at ${(dominantRacer.winRate * 100).toFixed(1)}%.`);
  }

  if (dominantStartSlot !== null) {
    notes.push(`Start slot ${dominantStartSlot} wins ${(dominantStartSlotWinRate * 100).toFixed(1)}% of races.`);
  }

  if (dnfRate > 0) {
    notes.push(`DNF rate is ${(dnfRate * 100).toFixed(2)}%; safety or timeout tuning is required.`);
  }

  return notes;
}

function getFailureHotspots(races: HeadlessRaceReport[]): TrackAggregateMetrics["failureHotspots"] {
  const counts = new Map<string, TrackAggregateMetrics["failureHotspots"][number]>();

  for (const race of races) {
    for (const diagnostic of race.antiStallDiagnostics) {
      const machineType = diagnostic.nearestMachine ?? "unknown";
      const obstacleId = diagnostic.nearestObstacle ?? "unknown";
      const segment = diagnostic.currentSegment;
      const key = `${machineType}:${obstacleId}:${segment}`;
      const existing = counts.get(key);

      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, {
          machineType,
          obstacleId,
          segment,
          count: 1,
        });
      }
    }
  }

  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 12);
}

function calculateSafetyScore(metrics: TrackAggregateMetrics, raceCount: number): number {
  if (metrics.totalDnfs > 0 || metrics.timeoutCount > 0 || metrics.likelyStuckEvents > 0 || metrics.maxStallTime > thresholds.maxStallTime) {
    return 0;
  }

  const stallScore = 1 - metrics.maxStallTime / thresholds.maxStallTime;
  const nudgePenalty = Math.min(0.35, metrics.antiStallNudges / Math.max(1, raceCount * 10));
  const repairPenalty = Math.min(0.25, metrics.validatorRepairs / 40 + metrics.validatorRemovals * 0.2);

  return round(clamp01(0.75 + stallScore * 0.25 - nudgePenalty - repairPenalty));
}

function calculateExcitementScore(metrics: TrackAggregateMetrics): number {
  const overtakeScore = clamp01(metrics.averageOvertakes / thresholds.averageOvertakes);
  const leaderScore = clamp01(metrics.averageLeaderChanges / thresholds.averageLeaderChanges);
  const orderScore = clamp01(metrics.averageOrderChanges / thresholds.averageOrderChanges);
  const positionScore = clamp01(metrics.averagePositionDelta / 3);
  const varianceScore = clamp01(metrics.averageSpeedVarianceDelta / thresholds.averageSpeedVarianceDelta);

  return round((overtakeScore + leaderScore + orderScore + positionScore + varianceScore) / 5);
}

function calculateFairnessScore(metrics: TrackAggregateMetrics, raceCount: number): number {
  const slotDominance = getHighestShare(metrics.startSlotWinDistribution, raceCount);
  const dominanceScore = 1 - clamp01((slotDominance - 0.125) / (thresholds.maxStartSlotWinShare - 0.125));
  const rankScore = 1 - clamp01(Math.max(0, metrics.averageSpearman) / thresholds.maxAverageSpearman);

  return round((dominanceScore * 0.65 + rankScore * 0.35));
}

function getHighestShare(distribution: Record<string, number>, total: number): number {
  if (total === 0) {
    return 0;
  }

  return Math.max(0, ...Object.values(distribution)) / total;
}

function mergeContactCounts(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const merged = { ...a };

  for (const [sectionId, count] of Object.entries(b)) {
    merged[sectionId] = (merged[sectionId] ?? 0) + count;
  }

  return merged;
}

function calculateDifferentialEffectScore(interactions: MachineInteractionCounts, speedVarianceDelta: number): number {
  const differentialHits = interactions.variableSlowdownHits + interactions.speedBoostHits + interactions.paddleContacts;
  const totalHits = interactions.slowZoneHits + interactions.forceZoneHits + interactions.paddleContacts;
  const differentialRatio = totalHits === 0 ? 0 : differentialHits / totalHits;

  return round(clamp01(differentialRatio * 0.65 + speedVarianceDelta / thresholds.averageSpeedVarianceDelta * 0.35));
}

function getStartSlot(marbleId: string): number {
  const value = Number.parseInt(marbleId.replace(/\D/g, ""), 10);

  return Number.isFinite(value) ? value : 0;
}

function countBy(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }

  return counts;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[midpoint - 1] + sorted[midpoint]) / 2 : sorted[midpoint];
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));

  return Math.sqrt(variance);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
