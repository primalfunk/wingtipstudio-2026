import { describe, expect, it } from "vitest";
import { applyAction, createState, startHand } from "../core/engine";
import type { CoachRecommendation } from "../core/types";
import {
  clearSavedHands,
  createLiveHandRecorder,
  finalizeLiveHand,
  listSavedHands,
  recordAppliedAction,
  recordShowdown,
  recordStreetTransition,
  rememberHeroRecommendation,
  saveCompletedHand,
  updateSavedHandBookmark
} from "./history";
import { createReplaySession, getReplayFrame, jumpReplayToEnd, moveReplayCursor } from "./replay";

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

describe("hand history storage", () => {
  it("ignores malformed storage payloads safely", () => {
    const storage = new MemoryStorage();
    storage.setItem("coach.handHistory", "{not-json");
    expect(listSavedHands(storage)).toEqual([]);
  });

  it("saves, bookmarks, and reloads a recorded hand", () => {
    const storage = new MemoryStorage();
    const state = createState({ sb: 10, bb: 20, startingStack: 200, heroIsButton: true });
    startHand(state);
    state.heroHole = ["As", "Ah"];
    state.botHole = ["Kd", "Kh"];
    state.deck = ["6c", "5s", "4h", "3d", "2c"];

    const recorder = createLiveHandRecorder(state, "balanced");
    const recommendation: CoachRecommendation = {
      phase: "preflop",
      probs: { raise: 1 },
      sizing: { raise: 200 },
      reasoning: {
        situation: "Test spot",
        hand: "Pocket aces",
        analysis: null,
        recommendation: "Jam.",
        tip: "",
        mixLabel: "Raise 100%"
      }
    };
    rememberHeroRecommendation(recorder, state, recommendation, {
      key: "preflop_btn_open_hu",
      label: "Preflop BTN Open HU",
      street: "preflop",
      position: "button",
      potType: "unopened",
      initiative: "unknown",
      facingAction: "none",
      texture: null,
      priorActionPattern: "unopened",
      metadata: {
        street: "preflop",
        potType: "unopened",
        position: "button",
        initiative: "unknown",
        facingAction: "none",
        texture: null,
        priorActionPattern: "unopened",
        facingBetSize: "none"
      }
    });

    const heroBefore = structuredClone(state);
    applyAction(state, "hero", "raise", 200, {
      onStreetAdvanced: (fromStreet, toStreet, snapshot) => recordStreetTransition(recorder, fromStreet, toStreet, snapshot),
      onShowdown: (snapshot) => recordShowdown(recorder, snapshot)
    });
    recordAppliedAction(recorder, {
      beforeState: heroBefore,
      afterState: state,
      actor: "hero",
      action: "raise",
      amount: 200,
      agreement: {
        verdict: "Solid play.",
        tone: "good",
        explanation: "Best hand, best line.",
        probability: 1
      }
    });

    const botBefore = structuredClone(state);
    applyAction(state, "bot", "call", 180, {
      onStreetAdvanced: (fromStreet, toStreet, snapshot) => recordStreetTransition(recorder, fromStreet, toStreet, snapshot),
      onShowdown: (snapshot) => recordShowdown(recorder, snapshot)
    });
    recordAppliedAction(recorder, {
      beforeState: botBefore,
      afterState: state,
      actor: "bot",
      action: "call",
      amount: 180
    });

    const saved = finalizeLiveHand(recorder, state);
    expect(saved).not.toBeNull();
    saveCompletedHand(saved!, storage);

    const [loaded] = listSavedHands(storage);
    expect(loaded.summary.showdown).toBe(true);
    expect(loaded.events.some((event) => event.type === "street_transition" && event.toStreet === "flop")).toBe(true);
    expect(loaded.events.some((event) => event.type === "street_transition" && event.toStreet === "turn")).toBe(true);
    expect(loaded.events.some((event) => event.type === "street_transition" && event.toStreet === "river")).toBe(true);

    updateSavedHandBookmark(loaded.id, true, storage);
    expect(listSavedHands(storage)[0].tags.bookmarked).toBe(true);

    const replay = jumpReplayToEnd(createReplaySession(listSavedHands(storage)[0]));
    const finalFrame = getReplayFrame(replay.hand, replay.cursor);
    expect(finalFrame.shownBoard).toEqual(["2c", "3d", "4h", "5s", "6c"]);
    expect(finalFrame.state.result?.reason).toBe("showdown");

    const flopEventIndex = replay.hand.events.findIndex(
      (event) => event.type === "street_transition" && event.toStreet === "flop"
    );
    const flopFrame = getReplayFrame(replay.hand, moveReplayCursor(replay, flopEventIndex).cursor);
    expect(flopFrame.shownBoard).toEqual(["2c", "3d", "4h"]);

    clearSavedHands(storage);
    expect(listSavedHands(storage)).toEqual([]);
  });
});
