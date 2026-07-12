import { describe, expect, it } from "vitest";
import { createState, startHand, legalActions } from "./engine";

describe("engine", () => {
  it("starts a playable heads-up hand", () => {
    const state = createState({ sb: 10, bb: 20, startingStack: 1000, heroIsButton: true });
    startHand(state);

    expect(state.street).toBe("preflop");
    expect(state.heroHole).toHaveLength(2);
    expect(state.botHole).toHaveLength(2);
    expect(state.heroCommitted).toBe(10);
    expect(state.botCommitted).toBe(20);
    expect(state.toAct).toBe("hero");
    expect(legalActions(state).call?.amount).toBe(10);
  });
});
