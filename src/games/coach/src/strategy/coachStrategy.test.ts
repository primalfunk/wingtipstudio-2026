import { describe, expect, it } from "vitest";
import { createState } from "../core/engine";
import { recommend } from "./coach";

describe("coach strategy data integration", () => {
  it("uses externalized spot and action guidance in a covered flop c-bet spot", () => {
    const state = createState({ sb: 10, bb: 20, startingStack: 1000, heroIsButton: true });
    state.street = "flop";
    state.toAct = "hero";
    state.heroHole = ["Kd", "Qc"];
    state.board = ["As", "7d", "2c"];
    state.pot = 100;
    state.heroCommitted = 0;
    state.botCommitted = 0;
    state.currentBet = 0;
    state.minRaiseAmount = 20;
    state.botHole = ["Jh", "Ts"];
    state.actionHistory = [
      { street: "preflop", actor: "hero", action: "raise", amount: 50 },
      { street: "preflop", actor: "bot", action: "call", amount: 30 },
      { street: "flop", actor: "bot", action: "check" }
    ];

    const recommendation = recommend(state, "hero");

    expect(recommendation?.spot?.key).toBe("flop_srp_ip_cbet");
    expect(recommendation?.strategySelection?.spotKey).toBe("flop_srp_ip_cbet");
    expect(recommendation?.strategySelection?.confidence).not.toBe("fallback");
    expect(recommendation?.reasoning.situation).toContain("Single-raised-pot in-position c-bet");
    expect(recommendation?.reasoning.analysis).toContain("default actions are");
    expect(recommendation?.reasoning.tip).toContain("Common mistake");
  });

  it("keeps fallback behavior for unsupported spots", () => {
    const state = createState({ sb: 10, bb: 20, startingStack: 1000, heroIsButton: true });
    state.street = "turn";
    state.toAct = "hero";
    state.heroHole = ["9c", "8c"];
    state.board = ["Kh", "Qd", "7s", "6h"];
    state.pot = 140;
    state.currentBet = 0;
    state.minRaiseAmount = 20;
    state.botHole = ["Ad", "Jd"];
    state.actionHistory = [
      { street: "preflop", actor: "hero", action: "call", amount: 10 },
      { street: "preflop", actor: "bot", action: "check" },
      { street: "flop", actor: "bot", action: "check" },
      { street: "flop", actor: "hero", action: "check" },
      { street: "turn", actor: "bot", action: "check" }
    ];

    const recommendation = recommend(state, "hero");

    expect(recommendation).not.toBeNull();
    expect(recommendation?.strategySelection?.confidence).toBe("fallback");
  });
});
