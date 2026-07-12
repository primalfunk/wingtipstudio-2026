import { describe, expect, it } from "vitest";
import { createState } from "../core/engine";
import type { CoachRecommendation } from "../core/types";
import { getBotArchetype, normalizeBotStyle } from "../bot/archetypes";
import { adjustProbabilitiesForArchetype } from "./bot";

function recommendation(overrides?: Partial<CoachRecommendation>): CoachRecommendation {
  return {
    phase: "postflop",
    probs: { fold: 0.2, call: 0.5, raise: 0.3 },
    sizing: { raise: 120 },
    pot: 100,
    owe: 40,
    equity: 0.38,
    reasoning: {
      situation: "Spot",
      hand: "Hand",
      analysis: "Analysis",
      recommendation: "Recommendation",
      tip: "Tip",
      mixLabel: "Call 50 / Raise 30 / Fold 20"
    },
    ...overrides
  };
}

describe("bot archetypes", () => {
  it("normalizes legacy styles to canonical archetypes", () => {
    expect(normalizeBotStyle("balanced")).toBe("straightforward_reg");
    expect(normalizeBotStyle("aggressive")).toBe("maniac");
    expect(getBotArchetype("passive").id).toBe("fit_or_fold");
  });

  it("makes station profiles call more and raise less when facing action", () => {
    const state = createState({ sb: 10, bb: 20, startingStack: 1000, heroIsButton: true });
    state.street = "river";
    state.toAct = "bot";
    state.heroHole = ["As", "Kd"];
    state.botHole = ["Qh", "9d"];
    state.board = ["Qs", "7c", "3d", "2h", "Jc"];
    state.pot = 180;
    state.heroCommitted = 90;
    state.botCommitted = 0;
    state.currentBet = 90;

    const base = adjustProbabilitiesForArchetype(recommendation().probs, state, recommendation(), "straightforward_reg");
    const station = adjustProbabilitiesForArchetype(recommendation().probs, state, recommendation(), "station");

    expect((station.call || 0)).toBeGreaterThan(base.call || 0);
    expect((station.raise || 0)).toBeLessThan(base.raise || 0);
  });

  it("makes maniacs more aggressive and nits tighter preflop", () => {
    const postflop = createState({ sb: 10, bb: 20, startingStack: 1000, heroIsButton: true });
    postflop.street = "flop";
    postflop.toAct = "bot";
    postflop.heroHole = ["As", "Kd"];
    postflop.botHole = ["9h", "6h"];
    postflop.board = ["Kh", "7d", "2c"];
    postflop.pot = 100;
    postflop.currentBet = 0;
    postflop.lastAggressor = "bot";

    const cbetRec = recommendation({
      probs: { check: 0.45, bet: 0.55 },
      sizing: { bet: 45 },
      owe: 0,
      equity: 0.32
    });

    const reg = adjustProbabilitiesForArchetype(cbetRec.probs, postflop, cbetRec, "straightforward_reg");
    const maniac = adjustProbabilitiesForArchetype(cbetRec.probs, postflop, cbetRec, "maniac");
    expect((maniac.bet || 0)).toBeGreaterThan(reg.bet || 0);

    const preflop = createState({ sb: 10, bb: 20, startingStack: 1000, heroIsButton: true });
    preflop.street = "preflop";
    preflop.toAct = "bot";
    preflop.botHole = ["8d", "4c"];
    preflop.heroHole = ["As", "Kd"];
    preflop.currentBet = 50;
    preflop.heroCommitted = 50;
    preflop.botCommitted = 20;
    preflop.pot = 0;

    const defendRec = recommendation({
      phase: "preflop",
      probs: { fold: 0.4, call: 0.45, raise: 0.15 },
      sizing: { raise: 160 },
      equity: undefined,
      owe: undefined,
      pot: undefined
    });

    const nit = adjustProbabilitiesForArchetype(defendRec.probs, preflop, defendRec, "nit");
    expect((nit.fold || 0)).toBeGreaterThan(defendRec.probs.fold || 0);
  });
});
