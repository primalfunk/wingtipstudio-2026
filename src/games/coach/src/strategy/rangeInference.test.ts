import { describe, expect, it } from "vitest";
import { createState } from "../core/engine";
import type { GameState } from "../core/types";
import { recommend } from "./coach";
import { inferOpponentRangeSummary } from "./rangeInference";

function baseState(): GameState {
  return createState({ sb: 10, bb: 20, startingStack: 1000, heroIsButton: true });
}

describe("range inference", () => {
  it("keeps medium showdown and draws after a flop call line", () => {
    const state = baseState();
    state.street = "turn";
    state.toAct = "hero";
    state.heroIsButton = true;
    state.heroHole = ["Ah", "Qh"];
    state.board = ["Qs", "7h", "6h", "2c"];
    state.pot = 170;
    state.actionHistory = [
      { street: "preflop", actor: "hero", action: "raise", amount: 50 },
      { street: "preflop", actor: "bot", action: "call", amount: 30 },
      { street: "flop", actor: "bot", action: "check" },
      { street: "flop", actor: "hero", action: "bet", amount: 35 },
      { street: "flop", actor: "bot", action: "call", amount: 35 },
      { street: "turn", actor: "bot", action: "check" }
    ];

    const recommendation = recommend(state, "hero");
    expect(recommendation?.inferredRange).toBeDefined();
    expect(recommendation?.inferredRange?.emphasis).toContain("many one-pair and bluff-catching hands");
    expect((recommendation?.inferredRange?.classWeights.strong_draw ?? 0) + (recommendation?.inferredRange?.classWeights.weak_draw ?? 0)).toBeGreaterThan(0.2);
  });

  it("treats a large turn bet as more polarized than a passive line", () => {
    const aggressive = baseState();
    aggressive.street = "turn";
    aggressive.toAct = "hero";
    aggressive.heroIsButton = false;
    aggressive.heroHole = ["As", "Kd"];
    aggressive.board = ["Qh", "9h", "4c", "2h"];
    aggressive.pot = 140;
    aggressive.heroCommitted = 120;
    aggressive.botCommitted = 240;
    aggressive.currentBet = 240;
    aggressive.actionHistory = [
      { street: "preflop", actor: "bot", action: "raise", amount: 60 },
      { street: "preflop", actor: "hero", action: "call", amount: 40 },
      { street: "flop", actor: "hero", action: "check" },
      { street: "flop", actor: "bot", action: "bet", amount: 45 },
      { street: "flop", actor: "hero", action: "call", amount: 45 },
      { street: "turn", actor: "hero", action: "check" },
      { street: "turn", actor: "bot", action: "bet", amount: 240 }
    ];

    const passive = structuredClone(aggressive);
    passive.heroCommitted = 0;
    passive.botCommitted = 0;
    passive.currentBet = 0;
    passive.actionHistory = [
      { street: "preflop", actor: "bot", action: "raise", amount: 60 },
      { street: "preflop", actor: "hero", action: "call", amount: 40 },
      { street: "flop", actor: "hero", action: "check" },
      { street: "flop", actor: "bot", action: "bet", amount: 45 },
      { street: "flop", actor: "hero", action: "call", amount: 45 },
      { street: "turn", actor: "hero", action: "check" },
      { street: "turn", actor: "bot", action: "check" }
    ];

    const aggressiveSummary = inferOpponentRangeSummary(aggressive, "hero").summary;
    const passiveSummary = inferOpponentRangeSummary(passive, "hero").summary;

    expect(aggressiveSummary.flags.polarized).toBe(true);
    expect(passiveSummary.flags.showdownHeavy || passiveSummary.flags.capped).toBe(true);
  });

  it("reads passive lines as capped or showdown heavy", () => {
    const state = baseState();
    state.street = "river";
    state.toAct = "hero";
    state.heroIsButton = false;
    state.heroHole = ["Ac", "7c"];
    state.board = ["Kh", "7d", "3s", "3c", "2d"];
    state.pot = 180;
    state.actionHistory = [
      { street: "preflop", actor: "bot", action: "raise", amount: 50 },
      { street: "preflop", actor: "hero", action: "call", amount: 30 },
      { street: "flop", actor: "hero", action: "check" },
      { street: "flop", actor: "bot", action: "check" },
      { street: "turn", actor: "hero", action: "check" },
      { street: "turn", actor: "bot", action: "check" },
      { street: "river", actor: "hero", action: "check" }
    ];

    const summary = inferOpponentRangeSummary(state, "hero").summary;
    expect(summary.flags.capped || summary.flags.showdownHeavy).toBe(true);
    expect(summary.summaryLabel).toMatch(/passive|showdown-heavy|medium-strength/);
  });

  it("adds simple blocker notes to river bluff-catcher spots", () => {
    const state = baseState();
    state.street = "river";
    state.toAct = "hero";
    state.heroIsButton = false;
    state.heroHole = ["Ah", "5h"];
    state.board = ["Kh", "9h", "5c", "5d", "2s"];
    state.pot = 200;
    state.heroCommitted = 120;
    state.botCommitted = 260;
    state.currentBet = 260;
    state.actionHistory = [
      { street: "preflop", actor: "bot", action: "raise", amount: 60 },
      { street: "preflop", actor: "hero", action: "call", amount: 40 },
      { street: "flop", actor: "hero", action: "check" },
      { street: "flop", actor: "bot", action: "bet", amount: 40 },
      { street: "flop", actor: "hero", action: "call", amount: 40 },
      { street: "turn", actor: "hero", action: "check" },
      { street: "turn", actor: "bot", action: "check" },
      { street: "river", actor: "hero", action: "check" },
      { street: "river", actor: "bot", action: "bet", amount: 260 }
    ];

    const recommendation = recommend(state, "hero");
    expect(recommendation?.inferredRange?.flags.polarized).toBe(true);
    expect(recommendation?.inferredRange?.blockerNotes.length).toBeGreaterThan(0);
  });
});
