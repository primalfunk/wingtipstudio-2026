import { describe, expect, it } from "vitest";
import { createState } from "../core/engine";
import type { GameState } from "../core/types";
import { classifySpot } from "./spot";

function baseState(): GameState {
  return createState({ sb: 10, bb: 20, startingStack: 1000, heroIsButton: true });
}

describe("spot classifier", () => {
  it("classifies preflop button open", () => {
    const state = baseState();
    state.street = "preflop";
    state.toAct = "hero";
    state.heroIsButton = true;
    state.heroCommitted = 10;
    state.botCommitted = 20;
    state.currentBet = 20;

    const spot = classifySpot(state);
    expect(spot.key).toBe("preflop_btn_open_hu");
    expect(spot.position).toBe("button");
    expect(spot.facingAction).toBe("none");
  });

  it("classifies preflop bb defend versus open", () => {
    const state = baseState();
    state.street = "preflop";
    state.toAct = "hero";
    state.heroIsButton = false;
    state.heroCommitted = 20;
    state.botCommitted = 50;
    state.currentBet = 50;
    state.actionHistory = [{ street: "preflop", actor: "bot", action: "raise", amount: 50 }];

    const spot = classifySpot(state);
    expect(spot.key).toBe("preflop_bb_defend_hu");
    expect(spot.initiative).toBe("bot");
    expect(spot.facingAction).toBe("raise");
  });

  it("classifies flop srp ip cbet", () => {
    const state = baseState();
    state.street = "flop";
    state.toAct = "hero";
    state.heroIsButton = true;
    state.board = ["As", "7d", "2c"];
    state.pot = 100;
    state.actionHistory = [
      { street: "preflop", actor: "hero", action: "raise", amount: 50 },
      { street: "preflop", actor: "bot", action: "call", amount: 30 },
      { street: "flop", actor: "bot", action: "check" }
    ];

    const spot = classifySpot(state);
    expect(spot.key).toBe("flop_srp_ip_cbet");
    expect(spot.texture).toBe("dry_high");
  });

  it("classifies flop srp oop defend versus cbet", () => {
    const state = baseState();
    state.street = "flop";
    state.toAct = "hero";
    state.heroIsButton = false;
    state.board = ["Th", "7h", "6c"];
    state.pot = 100;
    state.botCommitted = 50;
    state.currentBet = 50;
    state.actionHistory = [
      { street: "preflop", actor: "bot", action: "raise", amount: 50 },
      { street: "preflop", actor: "hero", action: "call", amount: 30 },
      { street: "flop", actor: "hero", action: "check" },
      { street: "flop", actor: "bot", action: "bet", amount: 50 }
    ];

    const spot = classifySpot(state);
    expect(spot.key).toBe("flop_srp_oop_defend_vs_cbet");
    expect(spot.texture).toBe("low_connected");
  });

  it("classifies turn barrel after flop call", () => {
    const state = baseState();
    state.street = "turn";
    state.toAct = "hero";
    state.heroIsButton = true;
    state.board = ["Qs", "7d", "2c", "4h"];
    state.pot = 170;
    state.actionHistory = [
      { street: "preflop", actor: "hero", action: "raise", amount: 50 },
      { street: "preflop", actor: "bot", action: "call", amount: 30 },
      { street: "flop", actor: "bot", action: "check" },
      { street: "flop", actor: "hero", action: "bet", amount: 35 },
      { street: "flop", actor: "bot", action: "call", amount: 35 },
      { street: "turn", actor: "bot", action: "check" }
    ];

    expect(classifySpot(state).key).toBe("turn_barrel_after_flop_call");
  });

  it("classifies river bluffcatch versus bet", () => {
    const state = baseState();
    state.street = "river";
    state.toAct = "hero";
    state.heroIsButton = false;
    state.board = ["Kc", "9d", "5h", "5c", "2d"];
    state.pot = 200;
    state.botCommitted = 170;
    state.currentBet = 170;
    state.actionHistory = [
      { street: "river", actor: "hero", action: "check" },
      { street: "river", actor: "bot", action: "bet", amount: 170 }
    ];

    const spot = classifySpot(state);
    expect(spot.key).toBe("river_bluffcatch_vs_bet");
    expect(spot.facingAction).toBe("bet");
  });

  it("classifies turn checkback after cbet on wetter textures", () => {
    const state = baseState();
    state.street = "turn";
    state.toAct = "hero";
    state.heroIsButton = true;
    state.board = ["Kh", "9h", "7c", "6h"];
    state.pot = 200;
    state.actionHistory = [
      { street: "preflop", actor: "hero", action: "raise", amount: 50 },
      { street: "preflop", actor: "bot", action: "call", amount: 30 },
      { street: "flop", actor: "bot", action: "check" },
      { street: "flop", actor: "hero", action: "bet", amount: 50 },
      { street: "flop", actor: "bot", action: "call", amount: 50 },
      { street: "turn", actor: "bot", action: "check" }
    ];

    const spot = classifySpot(state);
    expect(spot.key).toBe("turn_checkback_after_cbet");
    expect(spot.texture).toBe("two_tone");
  });

  it("classifies river value bet opportunity", () => {
    const state = baseState();
    state.street = "river";
    state.toAct = "hero";
    state.heroIsButton = true;
    state.board = ["Ah", "8d", "4c", "4h", "2s"];
    state.pot = 220;
    state.actionHistory = [
      { street: "preflop", actor: "hero", action: "raise", amount: 50 },
      { street: "preflop", actor: "bot", action: "call", amount: 30 },
      { street: "flop", actor: "bot", action: "check" },
      { street: "flop", actor: "hero", action: "bet", amount: 35 },
      { street: "flop", actor: "bot", action: "call", amount: 35 },
      { street: "turn", actor: "bot", action: "check" },
      { street: "turn", actor: "hero", action: "check" },
      { street: "river", actor: "bot", action: "check" }
    ];

    const spot = classifySpot(state);
    expect(spot.key).toBe("river_value_bet_opportunity");
    expect(spot.facingAction).toBe("check");
  });

  it("returns unknown for unsupported states", () => {
    const state = baseState();
    state.street = "turn";
    state.toAct = "hero";
    state.heroIsButton = false;
    state.board = ["Ac", "Kd", "Th", "9s"];
    state.pot = 320;
    state.botCommitted = 120;
    state.currentBet = 120;
    state.actionHistory = [
      { street: "preflop", actor: "bot", action: "raise", amount: 60 },
      { street: "preflop", actor: "hero", action: "raise", amount: 180 }
    ];

    expect(classifySpot(state).key).toBe("unknown");
  });
});
