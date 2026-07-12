import type {
  ActionHistoryEntry,
  Card,
  HandHistoryActionEvent,
  HandHistoryEvent,
  InferredRangeSummary,
  SavedDecisionRecord,
  SavedDrillAttempt,
  SavedHandHistory,
  StudyTag
} from "../core/types";
import type { DrillScenario } from "../core/types";
import { getReplayFrame } from "./replay";

export interface DecisionReviewSummary {
  sourceType: "live" | "drill";
  id: string;
  timestamp: string;
  handId?: string;
  scenarioId?: string;
  drillSetId?: string;
  street: SavedDecisionRecord["street"];
  spotKey: SavedDecisionRecord["spotKey"];
  heroPosition: SavedDecisionRecord["heroPosition"];
  heroHand: Card[];
  board: Card[];
  potSize: number;
  effectiveStack: number;
  actionOptions: SavedDecisionRecord["actionOptions"];
  userAction: SavedDecisionRecord["userAction"];
  sizingChosen?: number;
  coachRecommendation: SavedDecisionRecord["coachRecommendation"];
  coachEvaluation: SavedDecisionRecord["coachEvaluation"];
  explanationSnapshot: string;
  inferredRangeSummary?: InferredRangeSummary;
  blockerNotes: string[];
  tags: StudyTag[];
}

export interface ReviewTimelineEntry {
  index: number;
  label: string;
  street: SavedHandHistory["initial"]["state"]["street"];
  actor?: "hero" | "bot";
  isHeroDecision: boolean;
  spotKey?: SavedDecisionRecord["spotKey"];
  verdict?: string;
  tone?: SavedDecisionRecord["coachEvaluation"]["tone"];
}

export interface HandReviewDetails {
  timeline: ReviewTimelineEntry[];
  currentDecision: DecisionReviewSummary | null;
  needsReview: boolean;
}

export interface DrillReviewDetails {
  id: string;
  timestamp: string;
  scenarioId: string;
  drillSetId?: string;
  spotKey: SavedDrillAttempt["spotKey"];
  scenarioTitle: string;
  teachingNote?: string;
  focusArea?: string;
  heroHand: Card[];
  board: Card[];
  potSize: number;
  effectiveStackBb: number;
  actionHistory: ActionHistoryEntry[];
  userAction: SavedDrillAttempt["userAction"];
  sizingChosen?: number;
  coachEvaluation: SavedDrillAttempt["coachEvaluation"];
  explanationSnapshot: string;
  recommendedMix?: string;
  tags: StudyTag[];
}

export interface NeedsReviewItem {
  kind: "decision" | "drill";
  id: string;
  timestamp: string;
  label: string;
  verdict: string;
  tone: SavedDecisionRecord["coachEvaluation"]["tone"];
  tags: StudyTag[];
}

function sortDecisionRecords(records: SavedDecisionRecord[]): SavedDecisionRecord[] {
  return [...records].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

function heroDecisionEvents(hand: SavedHandHistory): HandHistoryActionEvent[] {
  return hand.events.filter(
    (event): event is HandHistoryActionEvent => event.type === "action" && event.isHeroDecision
  );
}

function decisionSummaryFromRecord(record: SavedDecisionRecord): DecisionReviewSummary {
  return {
    sourceType: record.sourceType,
    id: record.id,
    timestamp: record.timestamp,
    handId: record.handId,
    scenarioId: record.scenarioId,
    drillSetId: record.drillSetId,
    street: record.street,
    spotKey: record.spotKey,
    heroPosition: record.heroPosition,
    heroHand: [...record.heroHand],
    board: [...record.board],
    potSize: record.potSize,
    effectiveStack: record.effectiveStack,
    actionOptions: [...record.actionOptions],
    userAction: record.userAction,
    sizingChosen: record.sizingChosen,
    coachRecommendation: { ...record.coachRecommendation },
    coachEvaluation: { ...record.coachEvaluation },
    explanationSnapshot: record.explanationSnapshot,
    inferredRangeSummary: record.inferredRangeSummary
      ? {
          seed: { ...record.inferredRangeSummary.seed },
          classWeights: { ...record.inferredRangeSummary.classWeights },
          flags: { ...record.inferredRangeSummary.flags },
          emphasis: [...record.inferredRangeSummary.emphasis],
          shapeLabel: record.inferredRangeSummary.shapeLabel,
          summaryLabel: record.inferredRangeSummary.summaryLabel,
          actionNotes: [...record.inferredRangeSummary.actionNotes],
          blockerNotes: record.inferredRangeSummary.blockerNotes.map((note) => ({ ...note })),
          debugLabel: record.inferredRangeSummary.debugLabel
        }
      : undefined,
    blockerNotes: record.inferredRangeSummary?.blockerNotes.map((note) => note.label) ?? [],
    tags: [...record.tags]
  };
}

function fallbackDecisionSummary(event: HandHistoryActionEvent): DecisionReviewSummary | null {
  if (!event.coachSnapshot) return null;
  return {
    sourceType: "live",
    id: `hand_event_${event.index}`,
    timestamp: "",
    street: event.street,
    spotKey: event.coachSnapshot.spotKey,
    heroPosition: event.coachSnapshot.recommendation.spot?.position ?? "unknown",
    heroHand: [],
    board: [...event.boardAfter],
    potSize: event.potBefore,
    effectiveStack: Math.min(
      event.stateAfter.heroStack + event.stateAfter.heroCommitted,
      event.stateAfter.botStack + event.stateAfter.botCommitted
    ),
    actionOptions: [],
    userAction: event.action,
    sizingChosen: event.amount,
    coachRecommendation: {
      mixLabel: event.coachSnapshot.recommendation.reasoning.mixLabel,
      actionText: event.coachSnapshot.recommendation.reasoning.recommendation
    },
    coachEvaluation: event.agreement
      ? { ...event.agreement }
      : {
          verdict: "No saved evaluation",
          tone: "mixed",
          explanation: "This older saved hand does not include a full decision record.",
          probability: 0
        },
    explanationSnapshot:
      event.coachSnapshot.recommendation.reasoning.analysis ??
      event.coachSnapshot.recommendation.reasoning.tip ??
      "",
    inferredRangeSummary: event.coachSnapshot.recommendation.inferredRange
      ? {
          seed: { ...event.coachSnapshot.recommendation.inferredRange.seed },
          classWeights: { ...event.coachSnapshot.recommendation.inferredRange.classWeights },
          flags: { ...event.coachSnapshot.recommendation.inferredRange.flags },
          emphasis: [...event.coachSnapshot.recommendation.inferredRange.emphasis],
          shapeLabel: event.coachSnapshot.recommendation.inferredRange.shapeLabel,
          summaryLabel: event.coachSnapshot.recommendation.inferredRange.summaryLabel,
          actionNotes: [...event.coachSnapshot.recommendation.inferredRange.actionNotes],
          blockerNotes: event.coachSnapshot.recommendation.inferredRange.blockerNotes.map((note) => ({ ...note })),
          debugLabel: event.coachSnapshot.recommendation.inferredRange.debugLabel
        }
      : undefined,
    blockerNotes: event.coachSnapshot.recommendation.inferredRange?.blockerNotes.map((note) => note.label) ?? [],
    tags: event.agreement?.tone === "bad" ? ["mistake", "review_later"] : []
  };
}

function mapHandDecisionsByEventIndex(
  hand: SavedHandHistory,
  decisions: SavedDecisionRecord[]
): Map<number, SavedDecisionRecord> {
  const related = sortDecisionRecords(decisions).filter((record) => record.handId === hand.id);
  const heroEvents = heroDecisionEvents(hand);
  const mapped = new Map<number, SavedDecisionRecord>();
  for (let index = 0; index < heroEvents.length; index += 1) {
    const record = related[index];
    if (record) {
      mapped.set(heroEvents[index].index, record);
    }
  }
  return mapped;
}

function reviewLabel(event: HandHistoryEvent): string {
  if (event.type === "street_transition") {
    return `${event.toStreet} dealt`;
  }
  if (event.type === "showdown") {
    return "showdown";
  }
  if (event.action === "bet") return `${event.actor} bet ${event.amount}`;
  if (event.action === "raise") return `${event.actor} raise ${event.amount}`;
  if (event.action === "call") return `${event.actor} call ${event.amount}`;
  return `${event.actor} ${event.action}`;
}

export function buildHandReviewDetails(
  hand: SavedHandHistory,
  cursor: number,
  decisions: SavedDecisionRecord[]
): HandReviewDetails {
  const frame = getReplayFrame(hand, cursor);
  const decisionMap = mapHandDecisionsByEventIndex(hand, decisions);
  const timeline = hand.events.map((event, index) => {
    const record = decisionMap.get(index);
    return {
      index,
      label: reviewLabel(event),
      street: event.type === "street_transition" ? event.toStreet : event.type === "showdown" ? "showdown" : event.street,
      actor: event.type === "action" ? event.actor : undefined,
      isHeroDecision: event.type === "action" && event.isHeroDecision,
      spotKey: record?.spotKey ?? (event.type === "action" && event.isHeroDecision ? event.coachSnapshot?.spotKey : undefined),
      verdict: record?.coachEvaluation.verdict ?? (event.type === "action" && event.isHeroDecision ? event.agreement?.verdict : undefined),
      tone: record?.coachEvaluation.tone ?? (event.type === "action" && event.isHeroDecision ? event.agreement?.tone : undefined)
    };
  });

  let currentDecision: DecisionReviewSummary | null = null;
  if (frame.currentEvent?.type === "action" && frame.currentEvent.isHeroDecision) {
    currentDecision =
      (decisionMap.has(frame.currentEvent.index)
        ? decisionSummaryFromRecord(decisionMap.get(frame.currentEvent.index)!)
        : fallbackDecisionSummary(frame.currentEvent)) ?? null;
  }

  return {
    timeline,
    currentDecision,
    needsReview: !!currentDecision?.tags.some((tag) => tag === "mistake" || tag === "review_later")
  };
}

export function buildDecisionReview(record: SavedDecisionRecord): DecisionReviewSummary {
  return decisionSummaryFromRecord(record);
}

export function findReplayCursorForDecision(
  hand: SavedHandHistory,
  decisionId: string,
  decisions: SavedDecisionRecord[]
): number {
  const decisionMap = mapHandDecisionsByEventIndex(hand, decisions);
  for (const [eventIndex, record] of decisionMap.entries()) {
    if (record.id === decisionId) {
      return eventIndex;
    }
  }
  return -1;
}

export function buildDrillReview(
  attempt: SavedDrillAttempt,
  scenario?: DrillScenario
): DrillReviewDetails {
  return {
    id: attempt.id,
    timestamp: attempt.timestamp,
    scenarioId: attempt.scenarioId,
    drillSetId: attempt.drillSetId,
    spotKey: attempt.spotKey,
    scenarioTitle: scenario?.title ?? attempt.scenarioId,
    teachingNote: scenario?.teachingNote,
    focusArea: scenario?.focusArea,
    heroHand: [...(scenario?.heroHole ?? [])],
    board: [...(scenario?.board ?? [])],
    potSize: scenario?.pot ?? 0,
    effectiveStackBb: scenario?.effectiveStackBb ?? 0,
    actionHistory: scenario?.actionHistory ? [...scenario.actionHistory] : [],
    userAction: attempt.userAction,
    sizingChosen: attempt.sizingChosen,
    coachEvaluation: { ...attempt.coachEvaluation },
    explanationSnapshot: attempt.explanationSnapshot,
    recommendedMix: attempt.recommendedMix,
    tags: [...attempt.tags]
  };
}

export function collectNeedsReview(
  decisions: SavedDecisionRecord[],
  drillAttempts: SavedDrillAttempt[],
  limit = 8
): NeedsReviewItem[] {
  const decisionItems: NeedsReviewItem[] = decisions
    .filter((record) => record.tags.includes("review_later") || record.coachEvaluation.tone !== "good")
    .map((record) => ({
      kind: "decision",
      id: record.id,
      timestamp: record.timestamp,
      label: record.spotKey,
      verdict: record.coachEvaluation.verdict,
      tone: record.coachEvaluation.tone,
      tags: [...record.tags]
    }));

  const drillItems: NeedsReviewItem[] = drillAttempts
    .filter((record) => record.tags.includes("review_later") || record.coachEvaluation.tone !== "good")
    .map((record) => ({
      kind: "drill",
      id: record.id,
      timestamp: record.timestamp,
      label: record.spotKey,
      verdict: record.coachEvaluation.verdict,
      tone: record.coachEvaluation.tone,
      tags: [...record.tags]
    }));

  return [...decisionItems, ...drillItems]
    .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    .slice(0, Math.max(0, limit));
}
