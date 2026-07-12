export interface MachineInteractionCounts {
  slowZoneHits: number;
  forceZoneHits: number;
  variableSlowdownHits: number;
  speedBoostHits: number;
  paddleContacts: number;
  paddleLeaderContacts: number;
  antiStallNudges: number;
}

export interface RaceSafetyMetrics {
  maxStallTime: number;
  lowProgressWindows: number;
  likelyStuckEvents: number;
  antiStallNudges: number;
  validatorRepairs: number;
  validatorRemovals: number;
  localProbeFailures: number;
  timeoutOccurred: boolean;
  dnfCount: number;
}

export interface RaceExcitementMetrics {
  totalOvertakes: number;
  leaderChanges: number;
  orderChanges: number;
  averagePositionDelta: number;
  finalStretchLeaderChanges: number;
  machineInteractionCounts: MachineInteractionCounts;
  speedVarianceDelta: number;
  sectionContactCounts: Record<string, number>;
  paddleContactRate: number;
}

export interface RaceFairnessMetrics {
  winningMarbleId: string | null;
  winningStartSlot: number | null;
  finishTimeSpread: number;
  startFinishSpearman: number;
}

export interface RacePerformanceMetrics {
  simDurationMs: number;
  physicsStepCount: number;
  stepCostMs: number;
  fpsEquivalent: number;
}

export interface ReplayMetadata {
  trackSeed: string;
  raceSeed: string;
  machineSeed: string;
  failureFrame: number;
  failureTime: number;
  failureReason: string;
  marbleId: string | null;
  position: { x: number; y: number; z: number } | null;
  nearbyMachineId: string | null;
  debugUrl: string;
}

export interface HeadlessRaceReport {
  trackSeed: string;
  raceSeed: string;
  machineSeed: string;
  finished: boolean;
  results: {
    marbleId: string;
    startSlot: number;
    place: number;
    finishTime: number;
    progress: number;
    forced: boolean;
  }[];
  safety: RaceSafetyMetrics;
  excitement: RaceExcitementMetrics;
  fairness: RaceFairnessMetrics;
  performance: RacePerformanceMetrics;
  packSections: {
    id: string;
    sectionType: string;
    progress: number;
    expectedEffects: string[];
  }[];
  antiStallDiagnostics: {
    marbleId: string;
    time: number;
    frame: number;
    position: { x: number; y: number; z: number };
    velocity: { x: number; y: number; z: number };
    nearestMachine: string | null;
    nearestObstacle: string | null;
    currentSegment: number;
    recentProgressDelta: number;
  }[];
  replay: ReplayMetadata | null;
}

export interface TrackAggregateMetrics {
  raceCount: number;
  maxStallTime: number;
  totalDnfs: number;
  timeoutCount: number;
  likelyStuckEvents: number;
  lowProgressWindows: number;
  antiStallNudges: number;
  validatorRepairs: number;
  validatorRemovals: number;
  localProbeFailures: number;
  averageOvertakes: number;
  averageLeaderChanges: number;
  averageOrderChanges: number;
  averagePositionDelta: number;
  averageFinalStretchLeaderChanges: number;
  averageFinishTimeSpread: number;
  averageSpearman: number;
  averageStepCostMs: number;
  winDistribution: Record<string, number>;
  startSlotWinDistribution: Record<string, number>;
  machineInteractionCounts: MachineInteractionCounts;
  averageSpeedVarianceDelta: number;
  paddleContactRate: number;
  differentialEffectScore: number;
  overtakeConversionRate: number;
  sectionContactCounts: Record<string, number>;
  packSections: {
    id: string;
    sectionType: string;
    progress: number;
    expectedEffects: string[];
  }[];
  failureHotspots: {
    machineType: string;
    obstacleId: string;
    segment: number;
    count: number;
  }[];
  racerPerformance: RacerPerformanceSummary[];
  designDecisionSummary: DesignDecisionSummary;
}

export interface TrackAcceptanceReport {
  accepted: boolean;
  failureReasons: string[];
  safetyScore: number;
  excitementScore: number;
  fairnessScore: number;
  overallTrackScore: number;
  aggregateMetrics: TrackAggregateMetrics;
  recommendedTuningNotes: string[];
}

export interface RacerResultRecord {
  raceSeed: string;
  marbleId: string;
  startSlot: number;
  place: number;
  finishTime: number;
  progress: number;
  forced: boolean;
}

export interface RacerPerformanceSummary {
  marbleId: string;
  startSlot: number;
  starts: number;
  wins: number;
  places: number;
  shows: number;
  dnfs: number;
  winRate: number;
  placeRate: number;
  showRate: number;
  dnfRate: number;
  averageFinishPlace: number;
  medianFinishPlace: number;
  bestFinishPlace: number;
  worstFinishPlace: number;
  averageFinishTime: number;
  medianFinishTime: number;
  bestFinishTime: number;
  worstFinishTime: number;
  averagePositionDelta: number;
  finishPlaceStdDev: number;
  consistencyScore: number;
  finishPositionDistribution: Record<string, number>;
}

export interface DesignDecisionSummary {
  raceCount: number;
  racerCount: number;
  fairnessVerdict: "balanced" | "watch" | "biased";
  dominantRacer: string | null;
  dominantRacerWinRate: number;
  dominantStartSlot: number | null;
  dominantStartSlotWinRate: number;
  mostConsistentRacer: string | null;
  mostVolatileRacer: string | null;
  dnfRate: number;
  averageFinishSpread: number;
  notes: string[];
}
