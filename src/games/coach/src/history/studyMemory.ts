import { legalActions, potTotal } from "../core/engine";
import type {
  CoachEvaluation,
  CoachRecommendation,
  DrillScenario,
  EngineAction,
  GameState,
  SavedDecisionRecord,
  SavedDrillAttempt,
  SavedSessionSummary,
  SpotTag,
  StudyTag
} from "../core/types";

function nowIso(): string {
  return new Date().toISOString();
}

function buildId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function currentActionOptions(state: GameState): EngineAction[] {
  const actions = legalActions(state);
  return (Object.keys(actions) as EngineAction[]).filter((action) => actions[action] !== undefined);
}

function deriveTags(evaluation: CoachEvaluation): StudyTag[] {
  return evaluation.tone === "bad" ? ["mistake", "review_later"] : [];
}

export function createDecisionRecord(params: {
  sourceType: "live" | "drill";
  state: GameState;
  recommendation: CoachRecommendation;
  evaluation: CoachEvaluation;
  action: EngineAction;
  amount?: number;
  handId?: string;
  scenarioId?: string;
  drillSetId?: string;
}): SavedDecisionRecord {
  const effectiveStack = Math.min(
    params.state.heroStack + params.state.heroCommitted,
    params.state.botStack + params.state.botCommitted
  );
  return {
    id: buildId("decision"),
    version: 1,
    timestamp: nowIso(),
    sourceType: params.sourceType,
    handId: params.handId,
    scenarioId: params.scenarioId,
    drillSetId: params.drillSetId,
    street: params.state.street,
    spotKey: params.recommendation.spot?.key ?? "unknown",
    heroPosition: params.recommendation.spot?.position ?? "unknown",
    board: [...params.state.board],
    heroHand: [...params.state.heroHole],
    potSize: potTotal(params.state),
    effectiveStack,
    actionOptions: currentActionOptions(params.state),
    userAction: params.action,
    sizingChosen: params.amount,
    coachRecommendation: {
      mixLabel: params.recommendation.reasoning.mixLabel,
      actionText: params.recommendation.reasoning.recommendation
    },
    coachEvaluation: {
      verdict: params.evaluation.verdict,
      tone: params.evaluation.tone,
      explanation: params.evaluation.explanation,
      probability: params.evaluation.probability
    },
    explanationSnapshot: [params.recommendation.reasoning.analysis, params.recommendation.reasoning.tip]
      .filter(Boolean)
      .join(" "),
    inferredRangeSummary: params.recommendation.inferredRange
      ? {
          seed: { ...params.recommendation.inferredRange.seed },
          classWeights: { ...params.recommendation.inferredRange.classWeights },
          flags: { ...params.recommendation.inferredRange.flags },
          emphasis: [...params.recommendation.inferredRange.emphasis],
          shapeLabel: params.recommendation.inferredRange.shapeLabel,
          summaryLabel: params.recommendation.inferredRange.summaryLabel,
          actionNotes: [...params.recommendation.inferredRange.actionNotes],
          blockerNotes: params.recommendation.inferredRange.blockerNotes.map((note) => ({ ...note })),
          debugLabel: params.recommendation.inferredRange.debugLabel
        }
      : undefined,
    tags: deriveTags(params.evaluation)
  };
}

export function createDrillAttemptRecord(params: {
  scenario: DrillScenario;
  drillSetId?: string;
  recommendation: CoachRecommendation;
  evaluation: CoachEvaluation;
  action: EngineAction;
  amount?: number;
}): SavedDrillAttempt {
  return {
    id: buildId("drill"),
    version: 1,
    timestamp: nowIso(),
    scenarioId: params.scenario.id,
    drillSetId: params.drillSetId,
    spotKey: params.scenario.spotKey,
    userAction: params.action,
    sizingChosen: params.amount,
    coachEvaluation: {
      verdict: params.evaluation.verdict,
      tone: params.evaluation.tone,
      explanation: params.evaluation.explanation,
      probability: params.evaluation.probability
    },
    explanationSnapshot: [params.recommendation.reasoning.analysis, params.recommendation.reasoning.tip]
      .filter(Boolean)
      .join(" "),
    recommendedMix: params.recommendation.reasoning.mixLabel,
    tags: deriveTags(params.evaluation)
  };
}

export function createSessionSummary(mode: "live" | "drill"): SavedSessionSummary {
  const timestamp = nowIso();
  return {
    id: buildId(`${mode}_session`),
    version: 1,
    timestampStart: timestamp,
    timestampEnd: timestamp,
    mode,
    handsPlayed: 0,
    decisionsTracked: 0,
    drillAttempts: 0,
    mistakesFlagged: 0,
    spotBreakdown: {}
  };
}

export function bumpSessionSummary(
  summary: SavedSessionSummary,
  params: {
    spotKey?: SpotTag;
    handsPlayed?: number;
    decisionsTracked?: number;
    drillAttempts?: number;
    mistakesFlagged?: number;
  }
): SavedSessionSummary {
  const nextBreakdown = { ...summary.spotBreakdown };
  if (params.spotKey) {
    nextBreakdown[params.spotKey] = (nextBreakdown[params.spotKey] ?? 0) + 1;
  }
  return {
    ...summary,
    timestampEnd: nowIso(),
    handsPlayed: summary.handsPlayed + (params.handsPlayed ?? 0),
    decisionsTracked: summary.decisionsTracked + (params.decisionsTracked ?? 0),
    drillAttempts: summary.drillAttempts + (params.drillAttempts ?? 0),
    mistakesFlagged: summary.mistakesFlagged + (params.mistakesFlagged ?? 0),
    spotBreakdown: nextBreakdown
  };
}
