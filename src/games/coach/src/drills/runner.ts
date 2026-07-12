import { createState, legalActions } from "../core/engine";
import type { DrillPack, DrillResult, DrillScenario, DrillSession, EngineAction, GameState } from "../core/types";
import { classifySpot } from "../strategy/spot";
import { STARTER_SCENARIO_PACKS } from "./packs/starterPack";

export function getDrillPacks(): DrillPack[] {
  return STARTER_SCENARIO_PACKS.filter((pack) => pack.scenarios.length > 0);
}

export function createDrillSession(pack: DrillPack): DrillSession {
  return {
    pack,
    index: 0,
    current: pack.scenarios[0],
    results: [],
    awaitingAdvance: false
  };
}

export function scenarioToState(scenario: DrillScenario): GameState {
  const state = createState({
    sb: scenario.blinds.sb,
    bb: scenario.blinds.bb,
    startingStack: scenario.effectiveStackBb * scenario.blinds.bb,
    heroIsButton: scenario.heroPosition === "button"
  });

  state.heroHole = [...scenario.heroHole];
  state.botHole = [];
  state.board = [...scenario.board];
  state.deck = [];
  state.pot = scenario.pot;
  state.heroCommitted = scenario.heroCommitted;
  state.botCommitted = scenario.botCommitted;
  state.heroStack = scenario.heroStack;
  state.botStack = scenario.botStack;
  state.currentBet = scenario.currentBet;
  state.minRaiseAmount = scenario.minRaiseAmount ?? scenario.blinds.bb;
  state.street = scenario.street;
  state.toAct = scenario.toAct;
  state.heroHasActed = false;
  state.botHasActed = false;
  state.lastAggressor = null;
  state.handOver = false;
  state.result = null;
  state.actionHistory = [...scenario.actionHistory];
  state.handNumber = 1;

  return state;
}

export function validateScenarioLegalActions(scenario: DrillScenario): boolean {
  const state = scenarioToState(scenario);
  const actions = legalActions(state);
  const legal = scenario.legalActions.every((action) => actions[action] !== undefined || (action === "call" && actions.call));
  return legal && classifySpot(state).key === scenario.spotKey;
}

export function recordDrillResult(
  session: DrillSession,
  result: DrillResult
): DrillSession {
  return {
    ...session,
    results: [...session.results, result],
    awaitingAdvance: true
  };
}

export function advanceDrillSession(session: DrillSession): DrillSession | null {
  const nextIndex = session.index + 1;
  if (nextIndex >= session.pack.scenarios.length) {
    return null;
  }
  return {
    pack: session.pack,
    index: nextIndex,
    current: session.pack.scenarios[nextIndex],
    results: session.results,
    awaitingAdvance: false
  };
}

export function drillChoiceSummary(action: EngineAction, amount?: number): string {
  if (action === "bet") return `Bet ${amount}`;
  if (action === "raise") return `Raise to ${amount}`;
  return action.charAt(0).toUpperCase() + action.slice(1);
}
