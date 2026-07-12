import { describe, expect, it } from "vitest";
import { createState, snapshotState } from "../core/engine";
import type { CoachRecommendation, SavedHandHistory } from "../core/types";
import { createDecisionRecord, createDrillAttemptRecord, createSessionSummary, bumpSessionSummary } from "./studyMemory";
import {
  clearStudyStore,
  getDecisionById,
  getDecisionsForHand,
  getDecisionsBySpot,
  getDrillAttemptById,
  getDrillAttemptsBySpot,
  getHandById,
  getRecentDecisions,
  getRecentDrillAttempts,
  getRecentHands,
  getSessionSummaries,
  readStudyStore,
  saveDecisionRecord,
  saveDrillAttemptRecord,
  saveStudyHand,
  upsertSessionSummary
} from "./studyStore";

class MemoryStorage {
  private readonly data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

function recommendation(): CoachRecommendation {
  return {
    phase: "postflop",
    probs: { bet: 0.7, check: 0.3 },
    sizing: { bet: 50 },
    spot: {
      key: "flop_srp_ip_cbet",
      label: "Flop SRP IP C-Bet",
      street: "flop",
      position: "ip",
      potType: "srp",
      initiative: "hero",
      facingAction: "check",
      texture: "dry_high",
      priorActionPattern: "bot_check",
      metadata: {
        street: "flop",
        potType: "srp",
        position: "ip",
        initiative: "hero",
        facingAction: "check",
        texture: "dry_high",
        priorActionPattern: "bot_check",
        facingBetSize: "none"
      }
    },
    reasoning: {
      situation: "Spot text",
      hand: "Hand text",
      analysis: "Range is capped.",
      recommendation: "Bet often.",
      tip: "Use initiative.",
      mixLabel: "Bet 70% / Check 30%"
    },
    inferredRange: {
      seed: { sourcePreflopLine: "button open", position: "button", initiative: "hero" },
      classWeights: {
        nutted_made: 0.05,
        strong_value: 0.2,
        medium_showdown: 0.4,
        weak_showdown: 0.1,
        strong_draw: 0.15,
        weak_draw: 0.05,
        air: 0.05
      },
      flags: { polarized: false, condensed: true, capped: true, drawHeavy: false, showdownHeavy: true },
      emphasis: ["many one-pair hands"],
      shapeLabel: "condensed",
      summaryLabel: "condensed continuing range",
      actionNotes: ["Villain is capped."],
      blockerNotes: [],
      debugLabel: "debug"
    }
  };
}

describe("study store", () => {
  it("stores and retrieves explicit decision, drill, hand, and session records", () => {
    const storage = new MemoryStorage();
    const state = createState({ sb: 10, bb: 20, startingStack: 1000, heroIsButton: true });
    state.street = "flop";
    state.toAct = "hero";
    state.heroHole = ["As", "Kd"];
    state.board = ["Ah", "7d", "2c"];
    state.pot = 100;

    const decision = createDecisionRecord({
      sourceType: "live",
      state,
      recommendation: recommendation(),
      evaluation: { verdict: "Solid play.", tone: "good", explanation: "Best line.", probability: 0.7 },
      action: "bet",
      amount: 50,
      handId: "hand_1"
    });
    saveDecisionRecord(decision, storage);

    const drillAttempt = createDrillAttemptRecord({
      scenario: {
        id: "scenario_1",
        spotKey: "river_bluffcatch_vs_bet",
        title: "River bluff catch",
        effectiveStackBb: 40,
        blinds: { sb: 10, bb: 20 },
        heroPosition: "big_blind",
        villainPosition: "button",
        heroHole: ["Ac", "7d"],
        board: ["Ah", "Tc", "4s", "4d", "2h"],
        pot: 220,
        heroCommitted: 0,
        botCommitted: 190,
        heroStack: 690,
        botStack: 670,
        currentBet: 190,
        street: "river",
        toAct: "hero",
        actionHistory: [],
        legalActions: ["fold", "call", "raise"]
      },
      drillSetId: "pack_1",
      recommendation: recommendation(),
      evaluation: { verdict: "Close - not the top choice.", tone: "mixed", explanation: "Thin call.", probability: 0.2 },
      action: "call"
    });
    saveDrillAttemptRecord(drillAttempt, storage);

    const hand: SavedHandHistory = {
      id: "hand_1",
      version: 1,
      timestamp: "2026-04-18T00:00:00.000Z",
      table: { bigBlind: 20, smallBlind: 10, startingStack: 1000, startingStackBb: 50, botStyle: "balanced" },
      players: { heroName: "Hero", villainName: "Bot", heroSeat: "button_sb", villainSeat: "big_blind" },
      initial: { heroHole: ["As", "Kd"], villainHole: ["Qc", "Qd"], board: [], state: snapshotState(state) },
      events: [],
      actionLog: [],
      summary: {
        outcome: "hero_win",
        resultReason: "fold",
        showdown: false,
        allIn: false,
        winner: "hero",
        finalPot: 100,
        heroDeltaChips: 50,
        villainDeltaChips: -50,
        heroDeltaBb: 2.5,
        villainDeltaBb: -2.5,
        heroFinalStack: 1050,
        villainFinalStack: 950,
        coachAgreement: { good: 1, mixed: 0, bad: 0 }
      },
      tags: { bookmarked: false, spotTags: [], reviewTags: [] }
    };
    saveStudyHand(hand, storage);

    let session = createSessionSummary("live");
    session = bumpSessionSummary(session, { spotKey: "flop_srp_ip_cbet", handsPlayed: 1, decisionsTracked: 1 });
    upsertSessionSummary(session, storage);

    expect(getRecentHands(5, storage)).toHaveLength(1);
    expect(getRecentDecisions(5, storage)).toHaveLength(1);
    expect(getRecentDrillAttempts(5, storage)).toHaveLength(1);
    expect(getSessionSummaries(5, storage)).toHaveLength(1);
    expect(getHandById("hand_1", storage)?.id).toBe("hand_1");
    expect(getDecisionById(decision.id, storage)?.spotKey).toBe("flop_srp_ip_cbet");
    expect(getDecisionsForHand("hand_1", storage)).toHaveLength(1);
    expect(getDrillAttemptById(drillAttempt.id, storage)?.scenarioId).toBe("scenario_1");
    expect(getDecisionsBySpot("flop_srp_ip_cbet", storage)).toHaveLength(1);
    expect(getDrillAttemptsBySpot("river_bluffcatch_vs_bet", storage)).toHaveLength(1);
  });

  it("migrates legacy hand-only storage and tolerates empty data", () => {
    const storage = new MemoryStorage();
    expect(readStudyStore(storage).hands).toEqual([]);
    storage.setItem(
      "coach.handHistory",
      JSON.stringify({
        version: 1,
        hands: [
          {
            id: "legacy_hand",
            version: 1,
            timestamp: "2026-04-18T00:00:00.000Z",
            table: { bigBlind: 20, smallBlind: 10, startingStack: 1000, startingStackBb: 50, botStyle: "balanced" },
            players: { heroName: "Hero", villainName: "Bot", heroSeat: "button_sb", villainSeat: "big_blind" },
            initial: {
              heroHole: ["As", "Kd"],
              villainHole: ["Qc", "Qd"],
              board: [],
              state: {
                street: "preflop",
                board: [],
                pot: 0,
                heroStack: 1000,
                botStack: 1000,
                heroCommitted: 10,
                botCommitted: 20,
                currentBet: 20,
                minRaiseAmount: 20,
                toAct: "hero",
                heroHasActed: false,
                botHasActed: false,
                lastAggressor: null,
                handOver: false,
                result: null
              }
            },
            events: [],
            actionLog: [],
            summary: {
              outcome: "hero_win",
              resultReason: "fold",
              showdown: false,
              allIn: false,
              winner: "hero",
              finalPot: 100,
              heroDeltaChips: 50,
              villainDeltaChips: -50,
              heroDeltaBb: 2.5,
              villainDeltaBb: -2.5,
              heroFinalStack: 1050,
              villainFinalStack: 950,
              coachAgreement: { good: 1, mixed: 0, bad: 0 }
            },
            tags: { bookmarked: false, spotTags: [], reviewTags: [] }
          }
        ]
      })
    );
    expect(readStudyStore(storage).hands[0]?.id).toBe("legacy_hand");
    clearStudyStore(storage);
    expect(readStudyStore(storage).hands).toEqual([]);
  });
});
