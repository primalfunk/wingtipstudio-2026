import { describe, expect, it } from "vitest";
import { snapshotState } from "../core/engine";
import type { CoachRecommendation, GameState, SavedDecisionRecord, SavedDrillAttempt, SavedHandHistory } from "../core/types";
import { buildDecisionReview, buildDrillReview, buildHandReviewDetails, collectNeedsReview, findReplayCursorForDecision } from "./review";

function recommendation(): CoachRecommendation {
  return {
    phase: "postflop",
    probs: { bet: 0.65, check: 0.35 },
    sizing: { bet: 60 },
    spot: {
      key: "turn_barrel_after_flop_call",
      label: "Turn Barrel After Flop Call",
      street: "turn",
      position: "ip",
      potType: "srp",
      initiative: "hero",
      facingAction: "check",
      texture: "dry_high",
      priorActionPattern: "flop_cbet_called",
      metadata: {
        street: "turn",
        potType: "srp",
        position: "ip",
        initiative: "hero",
        facingAction: "check",
        texture: "dry_high",
        priorActionPattern: "flop_cbet_called",
        facingBetSize: "none"
      }
    },
    reasoning: {
      situation: "Turn barrel spot.",
      hand: "Two overcards.",
      analysis: "Villain is capped after the flop call.",
      recommendation: "Keep betting often.",
      tip: "Blank turns favor the aggressor.",
      mixLabel: "Bet 65% / Check 35%"
    },
    inferredRange: {
      seed: { sourcePreflopLine: "bb defend", position: "big_blind", initiative: "hero" },
      classWeights: {
        nutted_made: 0.04,
        strong_value: 0.16,
        medium_showdown: 0.34,
        weak_showdown: 0.12,
        strong_draw: 0.18,
        weak_draw: 0.08,
        air: 0.08
      },
      flags: { polarized: false, condensed: true, capped: true, drawHeavy: true, showdownHeavy: false },
      emphasis: ["many one-pair hands", "some draws remain"],
      shapeLabel: "condensed",
      summaryLabel: "condensed continuing range",
      actionNotes: ["Flop call keeps many medium-strength hands."],
      blockerNotes: [{ kind: "bluff", direction: "blocks", label: "You block some natural bluffs." }],
      debugLabel: "debug"
    }
  };
}

function handAndDecision(): { hand: SavedHandHistory; decision: SavedDecisionRecord } {
  const state: GameState = {
    sb: 10,
    bb: 20,
    startingStack: 1000,
    heroStack: 810,
    botStack: 810,
    heroHole: ["Ad", "Kc"],
    botHole: ["7s", "6s"],
    board: ["Qs", "7d", "2c", "4h"],
    deck: [],
    pot: 170,
    heroCommitted: 0,
    botCommitted: 0,
    currentBet: 0,
    minRaiseAmount: 20,
    street: "turn" as const,
    toAct: "hero" as const,
    heroHasActed: false,
    botHasActed: true,
    lastAggressor: "hero" as const,
    heroIsButton: true,
    handOver: false,
    result: null,
    actionHistory: [],
    handNumber: 1
  };

  const recommendationSnapshot = recommendation();
  const decision: SavedDecisionRecord = {
    id: "decision_1",
    version: 1,
    timestamp: "2026-04-18T12:00:00.000Z",
    sourceType: "live",
    handId: "hand_1",
    street: "turn",
    spotKey: "turn_barrel_after_flop_call",
    heroPosition: "ip",
    board: [...state.board],
    heroHand: [...state.heroHole],
    potSize: 170,
    effectiveStack: 810,
    actionOptions: ["check", "bet"],
    userAction: "bet",
    sizingChosen: 110,
    coachRecommendation: {
      mixLabel: recommendationSnapshot.reasoning.mixLabel,
      actionText: recommendationSnapshot.reasoning.recommendation
    },
    coachEvaluation: {
      verdict: "Solid barrel.",
      tone: "good",
      explanation: "Pressure the capped range.",
      probability: 0.65
    },
    explanationSnapshot: "Villain is capped after the flop call. Blank turns favor the aggressor.",
    inferredRangeSummary: recommendationSnapshot.inferredRange,
    tags: []
  };

  const hand: SavedHandHistory = {
    id: "hand_1",
    version: 1,
    timestamp: "2026-04-18T12:05:00.000Z",
    table: { bigBlind: 20, smallBlind: 10, startingStack: 1000, startingStackBb: 50, botStyle: "balanced" },
    players: { heroName: "Hero", villainName: "Bot", heroSeat: "button_sb", villainSeat: "big_blind" },
    initial: {
      heroHole: ["Ad", "Kc"],
      villainHole: ["7s", "6s"],
      board: [],
      state: snapshotState({
        ...state,
        street: "preflop",
        board: [],
        pot: 0,
        heroStack: 990,
        botStack: 980,
        heroCommitted: 10,
        botCommitted: 20,
        currentBet: 20,
        minRaiseAmount: 20,
        toAct: "hero",
        heroHasActed: false,
        botHasActed: false,
        lastAggressor: null,
        actionHistory: []
      })
    },
    events: [
      {
        type: "action",
        index: 0,
        street: "turn",
        actor: "hero",
        action: "bet",
        amount: 110,
        potBefore: 170,
        potAfter: 280,
        boardAfter: [...state.board],
        stateAfter: snapshotState({
          ...state,
          heroStack: 700,
          heroCommitted: 110,
          toAct: "bot",
          heroHasActed: true
        }),
        isHeroDecision: true,
        coachSnapshot: {
          spotKey: "turn_barrel_after_flop_call",
          spotLabel: "Turn Barrel After Flop Call",
          recommendation: recommendationSnapshot
        },
        agreement: { ...decision.coachEvaluation }
      }
    ],
    actionLog: [{ street: "turn", actor: "hero", action: "bet", amount: 110 }],
    summary: {
      outcome: "hero_win",
      resultReason: "fold",
      showdown: false,
      allIn: false,
      winner: "hero",
      finalPot: 170,
      heroDeltaChips: 85,
      villainDeltaChips: -85,
      heroDeltaBb: 4.25,
      villainDeltaBb: -4.25,
      heroFinalStack: 1085,
      villainFinalStack: 915,
      coachAgreement: { good: 1, mixed: 0, bad: 0 }
    },
    tags: { bookmarked: false, spotTags: ["turn_barrel_spot"], reviewTags: [] }
  };

  return { hand, decision };
}

describe("review helpers", () => {
  it("pairs saved hand decisions into the replay review frame", () => {
    const { hand, decision } = handAndDecision();
    const details = buildHandReviewDetails(hand, 0, [decision]);

    expect(details.timeline).toHaveLength(1);
    expect(details.timeline[0].spotKey).toBe("turn_barrel_after_flop_call");
    expect(details.currentDecision?.coachEvaluation.verdict).toBe("Solid barrel.");
    expect(details.currentDecision?.blockerNotes).toEqual(["You block some natural bluffs."]);
    expect(findReplayCursorForDecision(hand, decision.id, [decision])).toBe(0);
  });

  it("builds standalone decision and drill review summaries", () => {
    const { decision } = handAndDecision();
    const drillAttempt: SavedDrillAttempt = {
      id: "drill_1",
      version: 1,
      timestamp: "2026-04-18T12:10:00.000Z",
      scenarioId: "river_bluffcatch_01",
      drillSetId: "river_pack",
      spotKey: "river_bluffcatch_vs_bet",
      userAction: "call",
      sizingChosen: 90,
      coachEvaluation: {
        verdict: "Thin but acceptable.",
        tone: "mixed",
        explanation: "Close bluff-catch.",
        probability: 0.42
      },
      explanationSnapshot: "Villain is polarized enough that bluff-catching is plausible.",
      recommendedMix: "Call 45% / Fold 55%",
      tags: ["review_later"]
    };

    const drillReview = buildDrillReview(drillAttempt, {
      id: "river_bluffcatch_01",
      spotKey: "river_bluffcatch_vs_bet",
      title: "River Bluffcatch vs Medium Bet",
      effectiveStackBb: 38,
      blinds: { sb: 10, bb: 20 },
      heroPosition: "big_blind",
      villainPosition: "button",
      heroHole: ["Qh", "9d"],
      board: ["Qs", "7c", "3d", "2h", "Jc"],
      pot: 180,
      heroCommitted: 0,
      botCommitted: 90,
      heroStack: 670,
      botStack: 650,
      currentBet: 90,
      street: "river",
      toAct: "hero",
      actionHistory: [{ street: "river", actor: "bot", action: "bet", amount: 90 }],
      legalActions: ["fold", "call", "raise"]
    });

    expect(buildDecisionReview(decision).coachRecommendation.mixLabel).toBe("Bet 65% / Check 35%");
    expect(drillReview.scenarioTitle).toBe("River Bluffcatch vs Medium Bet");
    expect(drillReview.actionHistory).toHaveLength(1);
  });

  it("surfaces tagged or non-good records for review", () => {
    const { decision } = handAndDecision();
    const needsReview = collectNeedsReview(
      [{ ...decision, id: "decision_bad", coachEvaluation: { ...decision.coachEvaluation, tone: "bad", verdict: "Clear mistake." }, tags: ["mistake", "review_later"] }],
      [
        {
          id: "drill_1",
          version: 1,
          timestamp: "2026-04-18T12:10:00.000Z",
          scenarioId: "river_bluffcatch_01",
          spotKey: "river_bluffcatch_vs_bet",
          userAction: "fold",
          coachEvaluation: {
            verdict: "Too tight.",
            tone: "mixed",
            explanation: "You overfolded.",
            probability: 0.25
          },
          explanationSnapshot: "Missed bluff-catching opportunity.",
          tags: ["review_later"]
        }
      ]
    );

    expect(needsReview).toHaveLength(2);
    expect(needsReview[0].kind).toBe("drill");
    expect(needsReview[1].kind).toBe("decision");
  });
});
