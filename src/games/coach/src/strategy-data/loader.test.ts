import { describe, expect, it } from "vitest";
import { getActionPreferenceRecord, getSizingFamilyDefinition, getSpotStrategyRecord, lookupStrategyData } from "./loader";

describe("strategy data loader", () => {
  it("loads spot, action, and sizing records for covered spots", () => {
    expect(getSpotStrategyRecord("flop_srp_ip_cbet")?.summary).toContain("Single-raised-pot");
    expect(getActionPreferenceRecord("river_bluffcatch_vs_bet", "bluffcatcher")?.preferredActions).toContain("call");
    expect(getSizingFamilyDefinition("large")?.teachingNote).toContain("polarize");
  });

  it("falls back cleanly when a spot or hand class is not yet externalized", () => {
    const strategy = lookupStrategyData("unknown", "air");
    expect(strategy.spot).toBeUndefined();
    expect(strategy.preference).toBeUndefined();
    expect(strategy.confidence).toBe("fallback");
  });
});
