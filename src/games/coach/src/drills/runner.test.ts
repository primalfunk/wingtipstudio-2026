import { describe, expect, it } from "vitest";
import { getDrillPacks, recordDrillResult, scenarioToState, validateScenarioLegalActions } from "./runner";

describe("drill runner", () => {
  it("builds grouped drill packs by spot", () => {
    const packs = getDrillPacks();
    expect(packs.length).toBeGreaterThan(1);
    expect(packs.some((pack) => pack.spotKey === "flop_srp_ip_cbet")).toBe(true);
    expect(packs.some((pack) => pack.spotKey === "river_bluffcatch_vs_bet")).toBe(true);
  });

  it("validates scenario legal actions and spot alignment", () => {
    const mixedPack = getDrillPacks().find((pack) => pack.spotKey === "mixed");
    expect(mixedPack).toBeDefined();
    for (const scenario of mixedPack!.scenarios) {
      expect(validateScenarioLegalActions(scenario)).toBe(true);
      expect(scenarioToState(scenario).toAct).toBe("hero");
    }
  });

  it("records drill feedback with spot and verdict context", () => {
    const pack = getDrillPacks()[0];
    const session = {
      pack,
      index: 0,
      current: pack.scenarios[0],
      results: [],
      awaitingAdvance: false
    };

    const updated = recordDrillResult(session, {
      scenarioId: pack.scenarios[0].id,
      spotKey: pack.scenarios[0].spotKey,
      action: "raise",
      amount: 50,
      tone: "good",
      verdict: "Solid play.",
      explanation: "This matches the plan.",
      recommendedMix: "Raise 90%"
    });

    expect(updated.awaitingAdvance).toBe(true);
    expect(updated.results[0].spotKey).toBe(pack.scenarios[0].spotKey);
    expect(updated.results[0].verdict).toBe("Solid play.");
  });
});
