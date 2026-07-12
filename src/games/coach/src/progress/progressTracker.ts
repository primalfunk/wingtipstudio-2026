import type {
  ConceptDecisionLink,
  ConceptId,
  ConceptProgressSummary,
  DrillRecommendation,
  ProgressConceptDefinition,
  SavedDecisionRecord
} from "../core/types";
import { readStudyStore } from "../history/studyStore";
import { PROGRESS_CONCEPTS, getConceptDefinition } from "./concepts";

const RECENT_WINDOW = 20;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function uniqueConcepts(values: ConceptId[]): ConceptId[] {
  return [...new Set(values)];
}

function conceptsFromSpot(spotKey: SavedDecisionRecord["spotKey"]): ConceptId[] {
  const derivedConcepts = new Set<ConceptId>([
    "bet_sizing",
    "bluff_selection",
    "overfold_tendency",
    "overcall_tendency"
  ]);
  return PROGRESS_CONCEPTS.filter(
    (concept) => !derivedConcepts.has(concept.id) && concept.relatedSpotKeys.includes(spotKey)
  ).map((concept) => concept.id);
}

function isAggressive(record: SavedDecisionRecord): boolean {
  return record.userAction === "bet" || record.userAction === "raise";
}

function mapDecisionToConceptIds(record: SavedDecisionRecord): ConceptId[] {
  const mapped = conceptsFromSpot(record.spotKey);

  if (record.sizingChosen !== undefined || isAggressive(record)) {
    mapped.push("bet_sizing");
  }

  if (
    isAggressive(record) &&
    (record.spotKey === "flop_srp_ip_cbet" || record.spotKey === "turn_barrel_after_flop_call")
  ) {
    mapped.push("bluff_selection");
  }

  if (
    record.userAction === "fold" &&
    (record.coachEvaluation.tone === "bad" || record.coachEvaluation.tone === "mixed")
  ) {
    mapped.push("overfold_tendency");
  }

  if (
    record.userAction === "call" &&
    (record.coachEvaluation.tone === "bad" || record.coachEvaluation.tone === "mixed")
  ) {
    mapped.push("overcall_tendency");
  }

  return uniqueConcepts(mapped);
}

function toConceptLinks(records: SavedDecisionRecord[]): ConceptDecisionLink[] {
  const ordered = [...records].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  return ordered.flatMap((record) =>
    mapDecisionToConceptIds(record).map((conceptId) => ({
      conceptId,
      decisionId: record.id,
      timestamp: record.timestamp,
      tone: record.coachEvaluation.tone,
      userAction: record.userAction,
      spotKey: record.spotKey
    }))
  );
}

function countByTone(links: ConceptDecisionLink[]) {
  const correctCount = links.filter((link) => link.tone === "good").length;
  const acceptableCount = links.filter((link) => link.tone === "mixed").length;
  const mistakeCount = links.filter((link) => link.tone === "bad").length;
  return { correctCount, acceptableCount, mistakeCount };
}

function safeRate(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function trendLabel(delta: number | null): ConceptProgressSummary["trendLabel"] {
  if (delta === null) return "insufficient_data";
  if (delta >= 0.08) return "improving";
  if (delta <= -0.08) return "slipping";
  return "flat";
}

function weakestSignals(definition: ProgressConceptDefinition, links: ConceptDecisionLink[]): string[] {
  const notes: string[] = [];
  const badFolds = links.filter((link) => link.userAction === "fold" && link.tone === "bad").length;
  const badCalls = links.filter((link) => link.userAction === "call" && link.tone === "bad").length;
  const badAggression = links.filter((link) => (link.userAction === "bet" || link.userAction === "raise") && link.tone === "bad").length;

  if (definition.id === "overfold_tendency" && badFolds > 0) notes.push("too many low-quality folds");
  if (definition.id === "overcall_tendency" && badCalls > 0) notes.push("calls are leaking too often");
  if (definition.id === "bet_sizing" && badAggression > 0) notes.push("aggressive choices need cleaner sizing");
  if (!notes.length && links.some((link) => link.tone === "bad")) notes.push("mistake rate is elevated");
  if (!notes.length && links.some((link) => link.tone === "mixed")) notes.push("many close decisions still need polish");
  return notes;
}

export function mapDecisionToConcepts(record: SavedDecisionRecord): ProgressConceptDefinition[] {
  return mapDecisionToConceptIds(record)
    .map((id) => getConceptDefinition(id))
    .filter((concept): concept is ProgressConceptDefinition => !!concept);
}

export function getConceptSummaryFromRecords(
  conceptId: ConceptId,
  records: SavedDecisionRecord[]
): ConceptProgressSummary {
  const definition = getConceptDefinition(conceptId);
  if (!definition) {
    throw new Error(`Unknown concept ${conceptId}`);
  }

  const conceptLinks = toConceptLinks(records).filter((link) => link.conceptId === conceptId);
  const recentLinks = conceptLinks.slice(-RECENT_WINDOW);
  const { correctCount, acceptableCount, mistakeCount } = countByTone(conceptLinks);
  const totalAttempts = conceptLinks.length;
  const successRate = safeRate(correctCount + acceptableCount, totalAttempts);
  const recentCounts = countByTone(recentLinks);
  const recentSuccessRate =
    recentLinks.length >= Math.min(5, totalAttempts) && recentLinks.length > 0
      ? safeRate(recentCounts.correctCount + recentCounts.acceptableCount, recentLinks.length)
      : null;
  const delta = recentSuccessRate === null ? null : recentSuccessRate - successRate;

  return {
    conceptId,
    label: definition.label,
    description: definition.description,
    totalAttempts,
    correctCount,
    acceptableCount,
    mistakeCount,
    successRate,
    mistakeRate: safeRate(mistakeCount, totalAttempts),
    recentSuccessRate,
    trendDelta: delta,
    trendLabel: trendLabel(delta),
    weakestSignals: weakestSignals(definition, conceptLinks),
    relatedSpotKeys: [...definition.relatedSpotKeys],
    recommendedDrillPackIds: [...(definition.drillPackIds ?? [])]
  };
}

export function getAllConceptSummaries(records: SavedDecisionRecord[]): ConceptProgressSummary[] {
  return PROGRESS_CONCEPTS.map((concept) => getConceptSummaryFromRecords(concept.id, records));
}

export function getConceptSummary(conceptId: ConceptId, storage?: StorageLike): ConceptProgressSummary {
  return getConceptSummaryFromRecords(conceptId, readStudyStore(storage).decisions);
}

export function getAllStoredConceptSummaries(storage?: StorageLike): ConceptProgressSummary[] {
  return getAllConceptSummaries(readStudyStore(storage).decisions);
}

export function getWorstConcepts(limit = 3, records?: SavedDecisionRecord[]): ConceptProgressSummary[] {
  const summaries = records ? getAllConceptSummaries(records) : getAllStoredConceptSummaries();
  return summaries
    .filter((summary) => summary.totalAttempts > 0)
    .sort((left, right) => {
      if (right.mistakeRate !== left.mistakeRate) return right.mistakeRate - left.mistakeRate;
      return left.successRate - right.successRate;
    })
    .slice(0, Math.max(0, limit));
}

export function getBestConcepts(limit = 3, records?: SavedDecisionRecord[]): ConceptProgressSummary[] {
  const summaries = records ? getAllConceptSummaries(records) : getAllStoredConceptSummaries();
  return summaries
    .filter((summary) => summary.totalAttempts > 0)
    .sort((left, right) => {
      if (right.successRate !== left.successRate) return right.successRate - left.successRate;
      return left.mistakeRate - right.mistakeRate;
    })
    .slice(0, Math.max(0, limit));
}

export function getDrillRecommendations(records: SavedDecisionRecord[], limit = 3): DrillRecommendation[] {
  return getWorstConcepts(limit, records)
    .filter((summary) => summary.recommendedDrillPackIds.length > 0)
    .map((summary) => ({
      conceptId: summary.conceptId,
      label: summary.label,
      drillPackIds: summary.recommendedDrillPackIds
    }));
}

export function progressDebugEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem("coach.debugProgress") === "1";
}
