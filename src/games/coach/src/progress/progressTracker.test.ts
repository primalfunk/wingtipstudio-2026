import { describe, expect, it } from "vitest";
import type { SavedDecisionRecord } from "../core/types";
import {
  getAllConceptSummaries,
  getBestConcepts,
  getDrillRecommendations,
  getWorstConcepts,
  mapDecisionToConcepts
} from "./progressTracker";

function decision(overrides: Partial<SavedDecisionRecord>): SavedDecisionRecord {
  return {
    id: overrides.id ?? `decision_${Math.random().toString(36).slice(2, 8)}`,
    version: 1,
    timestamp: overrides.timestamp ?? "2026-04-18T20:00:00.000Z",
    sourceType: overrides.sourceType ?? "live",
    street: overrides.street ?? "flop",
    spotKey: overrides.spotKey ?? "flop_srp_ip_cbet",
    heroPosition: overrides.heroPosition ?? "ip",
    board: overrides.board ?? ["As", "7d", "2c"],
    heroHand: overrides.heroHand ?? ["Kd", "Qc"],
    potSize: overrides.potSize ?? 100,
    effectiveStack: overrides.effectiveStack ?? 900,
    actionOptions: overrides.actionOptions ?? ["check", "bet"],
    userAction: overrides.userAction ?? "bet",
    sizingChosen: overrides.sizingChosen,
    coachRecommendation: overrides.coachRecommendation ?? {
      mixLabel: "Bet 70% / Check 30%",
      actionText: "Bet often."
    },
    coachEvaluation: overrides.coachEvaluation ?? {
      verdict: "Solid play.",
      tone: "good",
      explanation: "Matches the plan.",
      probability: 0.7
    },
    explanationSnapshot: overrides.explanationSnapshot ?? "Snapshot",
    inferredRangeSummary: overrides.inferredRangeSummary,
    tags: overrides.tags ?? []
  };
}

describe("progress tracker", () => {
  it("maps decisions into spot and tendency concepts", () => {
    const mapped = mapDecisionToConcepts(
      decision({
        spotKey: "river_bluffcatch_vs_bet",
        street: "river",
        userAction: "fold",
        coachEvaluation: {
          verdict: "Too tight.",
          tone: "bad",
          explanation: "Overfold.",
          probability: 0.02
        },
        actionOptions: ["fold", "call", "raise"]
      })
    ).map((concept) => concept.id);

    expect(mapped).toContain("river_bluffcatch");
    expect(mapped).toContain("overfold_tendency");
  });

  it("aggregates concept metrics and identifies weak concepts", () => {
    const records: SavedDecisionRecord[] = [
      decision({
        id: "a",
        timestamp: "2026-04-18T20:00:00.000Z",
        spotKey: "flop_srp_ip_cbet",
        userAction: "bet",
        sizingChosen: 35,
        coachEvaluation: { verdict: "Solid play.", tone: "good", explanation: "Good.", probability: 0.7 }
      }),
      decision({
        id: "b",
        timestamp: "2026-04-18T20:01:00.000Z",
        spotKey: "flop_srp_ip_cbet",
        userAction: "bet",
        sizingChosen: 90,
        coachEvaluation: { verdict: "Too big.", tone: "bad", explanation: "Sizing leak.", probability: 0.02 },
        tags: ["mistake", "review_later"]
      }),
      decision({
        id: "c",
        timestamp: "2026-04-18T20:02:00.000Z",
        spotKey: "river_bluffcatch_vs_bet",
        street: "river",
        userAction: "call",
        actionOptions: ["fold", "call", "raise"],
        coachEvaluation: { verdict: "Close call.", tone: "mixed", explanation: "Okay.", probability: 0.18 }
      })
    ];

    const summaries = getAllConceptSummaries(records);
    const flopCbet = summaries.find((summary) => summary.conceptId === "flop_cbet");
    const sizing = summaries.find((summary) => summary.conceptId === "bet_sizing");

    expect(flopCbet?.totalAttempts).toBe(2);
    expect(flopCbet?.mistakeCount).toBe(1);
    expect(sizing?.totalAttempts).toBe(2);
    expect(getWorstConcepts(2, records).some((summary) => summary.conceptId === "bet_sizing")).toBe(true);
    expect(getBestConcepts(2, records).some((summary) => summary.conceptId === "river_bluffcatch")).toBe(true);
  });

  it("produces drill recommendations from weak concepts", () => {
    const records: SavedDecisionRecord[] = [
      decision({
        id: "x",
        spotKey: "turn_barrel_after_flop_call",
        street: "turn",
        userAction: "check",
        actionOptions: ["check", "bet"],
        coachEvaluation: { verdict: "Missed barrel.", tone: "bad", explanation: "Too passive.", probability: 0.01 }
      }),
      decision({
        id: "y",
        spotKey: "turn_barrel_after_flop_call",
        street: "turn",
        userAction: "check",
        actionOptions: ["check", "bet"],
        coachEvaluation: { verdict: "Missed pressure.", tone: "bad", explanation: "Too passive.", probability: 0.02 }
      })
    ];

    const recommendations = getDrillRecommendations(records, 2);
    expect(recommendations[0].conceptId).toBe("turn_barrel");
    expect(recommendations[0].drillPackIds).toContain("spot-turn_barrel_after_flop_call");
  });
});
