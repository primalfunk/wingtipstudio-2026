import { RANK_VALUE } from "../core/deck";
import { toCall } from "../core/engine";
import type {
  ActionHistoryEntry,
  Actor,
  BetSizeBand,
  BoardClass,
  FacingAction,
  GameState,
  PositionLabel,
  PotType,
  Rank,
  SpotClassification,
  SpotMetadata,
  SpotTag
} from "../core/types";
import { spotLabel } from "./spotTaxonomy";

function historyForStreet(history: ActionHistoryEntry[], street: GameState["street"]): ActionHistoryEntry[] {
  return history.filter((entry) => entry.street === street);
}

function preflopAggressor(state: GameState): Actor | "neutral" | "unknown" {
  const raises = historyForStreet(state.actionHistory, "preflop").filter(
    (entry) => entry.action === "raise" || entry.action === "bet"
  );
  if (!raises.length) {
    return state.actionHistory.some((entry) => entry.street === "preflop") ? "neutral" : "unknown";
  }
  return raises[raises.length - 1].actor;
}

function inferPotType(state: GameState): PotType {
  const preflop = historyForStreet(state.actionHistory, "preflop");
  const raises = preflop.filter((entry) => entry.action === "raise" || entry.action === "bet").length;
  const calls = preflop.filter((entry) => entry.action === "call").length;

  if (raises === 0 && calls === 0) return "unopened";
  if (raises === 0 && calls > 0) return "limped";
  if (raises === 1 && calls >= 1) return "srp";
  if (raises >= 2) return "3bet_plus";
  return "unknown";
}

function heroPosition(state: GameState): PositionLabel {
  if (state.street === "preflop") {
    return state.heroIsButton ? "button" : "big_blind";
  }
  return state.heroIsButton ? "ip" : "oop";
}

function classifyBoard(board: GameState["board"]): BoardClass {
  if (!board.length) return "unknown";

  const ranks = board.map((card) => RANK_VALUE[card[0] as Rank]).sort((a, b) => b - a);
  const suits = board.map((card) => card[1]);
  const suitCounts = suits.reduce<Record<string, number>>((counts, suit) => {
    counts[suit] = (counts[suit] || 0) + 1;
    return counts;
  }, {});
  const maxSuit = Math.max(...Object.values(suitCounts));
  const paired = new Set(ranks).size < ranks.length;
  const connected = !paired && ranks[0] - ranks[ranks.length - 1] <= 4;
  const highCard = ranks[0] >= 12;

  if (maxSuit === board.length && board.length >= 3) return "monotone";
  if (paired) return "paired";
  if (connected && ranks[0] <= 10) return "low_connected";
  if (maxSuit >= 2 && board.length >= 3) return "two_tone";
  if (highCard && !connected) return "dry_high";
  return "neutral";
}

function facingBetSizeBand(state: GameState): BetSizeBand {
  if (state.toAct !== "hero") return "unknown";
  const owe = toCall(state, "hero");
  if (owe <= 0) return "none";

  const pot = state.pot + state.heroCommitted + state.botCommitted;
  const ratio = owe / Math.max(1, pot);
  if (ratio < 0.33) return "small";
  if (ratio < 0.66) return "medium";
  return "large";
}

function facingAction(state: GameState): FacingAction {
  if (state.toAct !== "hero") return "unknown";
  const streetHistory = historyForStreet(state.actionHistory, state.street);
  const lastAction = streetHistory[streetHistory.length - 1];
  if (!lastAction) return "none";
  if (toCall(state, "hero") > 0) {
    if (lastAction.action === "raise") return "raise";
    return "bet";
  }
  if (lastAction.action === "check") return "check";
  return "none";
}

function priorActionPattern(state: GameState): string {
  const preflop = historyForStreet(state.actionHistory, "preflop");
  const flop = historyForStreet(state.actionHistory, "flop");
  const turn = historyForStreet(state.actionHistory, "turn");

  if (state.street === "preflop") {
    if (!preflop.length) return "unopened";
    return preflop.map((entry) => `${entry.actor}_${entry.action}`).join("_");
  }

  if (state.street === "flop") {
    if (!flop.length) return "flop_start";
    return flop.map((entry) => `${entry.actor}_${entry.action}`).join("_");
  }

  if (state.street === "turn") {
    const flopBetCall =
      flop.some((entry) => entry.actor === "hero" && entry.action === "bet") &&
      flop.some((entry) => entry.actor === "bot" && entry.action === "call");
    if (flopBetCall) {
      return turn.some((entry) => entry.actor === "bot" && entry.action === "check")
        ? "flop_bet_call_turn_check"
        : "flop_bet_call";
    }
  }

  if (state.street === "river") {
    return historyForStreet(state.actionHistory, "river")
      .map((entry) => `${entry.actor}_${entry.action}`)
      .join("_") || "river_start";
  }

  return "generic";
}

function flopIsIpCbetSpot(state: GameState, metadata: SpotMetadata): boolean {
  const flopActions = historyForStreet(state.actionHistory, "flop");
  return (
    state.street === "flop" &&
    state.toAct === "hero" &&
    metadata.position === "ip" &&
    metadata.potType === "srp" &&
    metadata.initiative === "hero" &&
    metadata.facingAction !== "bet" &&
    (flopActions.length === 0 || (flopActions.length === 1 && flopActions[0].actor === "bot" && flopActions[0].action === "check"))
  );
}

function flopIsOopDefendSpot(state: GameState, metadata: SpotMetadata): boolean {
  return (
    state.street === "flop" &&
    state.toAct === "hero" &&
    metadata.position === "oop" &&
    metadata.potType === "srp" &&
    metadata.initiative === "bot" &&
    metadata.facingAction === "bet"
  );
}

function isTurnBarrelSpot(state: GameState, metadata: SpotMetadata): boolean {
  const flopActions = historyForStreet(state.actionHistory, "flop");
  const turnActions = historyForStreet(state.actionHistory, "turn");
  const sawFlopBetCall =
    flopActions.some((entry) => entry.actor === "hero" && entry.action === "bet") &&
    flopActions.some((entry) => entry.actor === "bot" && entry.action === "call");

  return (
    state.street === "turn" &&
    state.toAct === "hero" &&
    metadata.potType === "srp" &&
    metadata.initiative === "hero" &&
    sawFlopBetCall &&
    metadata.facingAction !== "bet" &&
    (turnActions.length === 0 || (turnActions.length === 1 && turnActions[0].actor === "bot" && turnActions[0].action === "check"))
  );
}

function isTurnCheckbackSpot(state: GameState, metadata: SpotMetadata): boolean {
  return (
    isTurnBarrelSpot(state, metadata) &&
    (metadata.texture === "paired" ||
      metadata.texture === "two_tone" ||
      metadata.texture === "monotone" ||
      metadata.texture === "low_connected")
  );
}

function isRiverBluffcatchSpot(state: GameState, metadata: SpotMetadata): boolean {
  return state.street === "river" && state.toAct === "hero" && metadata.facingAction === "bet";
}

function isRiverValueBetOpportunity(state: GameState, metadata: SpotMetadata): boolean {
  const riverActions = historyForStreet(state.actionHistory, "river");
  return (
    state.street === "river" &&
    state.toAct === "hero" &&
    metadata.facingAction !== "bet" &&
    (riverActions.length === 0 || (riverActions.length === 1 && riverActions[0].actor === "bot" && riverActions[0].action === "check"))
  );
}

export function classifySpot(state: GameState): SpotClassification {
  const metadata: SpotMetadata = {
    street: state.street,
    potType: inferPotType(state),
    position: heroPosition(state),
    initiative: preflopAggressor(state),
    facingAction: facingAction(state),
    texture: state.street === "preflop" ? null : classifyBoard(state.board),
    priorActionPattern: priorActionPattern(state),
    facingBetSize: facingBetSizeBand(state)
  };

  let key: SpotTag = "unknown";

  if (
    state.street === "preflop" &&
    state.toAct === "hero" &&
    state.heroIsButton &&
    state.actionHistory.length === 0 &&
    toCall(state, "hero") === state.bb - state.sb
  ) {
    key = "preflop_btn_open_hu";
  } else if (
    state.street === "preflop" &&
    state.toAct === "hero" &&
    !state.heroIsButton &&
    metadata.initiative === "bot" &&
    toCall(state, "hero") > 0
  ) {
    key = "preflop_bb_defend_hu";
  } else if (flopIsIpCbetSpot(state, metadata)) {
    key = "flop_srp_ip_cbet";
  } else if (flopIsOopDefendSpot(state, metadata)) {
    key = "flop_srp_oop_defend_vs_cbet";
  } else if (isTurnCheckbackSpot(state, metadata)) {
    key = "turn_checkback_after_cbet";
  } else if (isTurnBarrelSpot(state, metadata)) {
    key = "turn_barrel_after_flop_call";
  } else if (isRiverBluffcatchSpot(state, metadata)) {
    key = "river_bluffcatch_vs_bet";
  } else if (isRiverValueBetOpportunity(state, metadata)) {
    key = "river_value_bet_opportunity";
  }

  return {
    key,
    label: spotLabel(key),
    street: state.street,
    position: metadata.position,
    potType: metadata.potType,
    initiative: metadata.initiative,
    facingAction: metadata.facingAction,
    texture: metadata.texture,
    priorActionPattern: metadata.priorActionPattern,
    metadata
  };
}

export function spotDebugLabel(spot: SpotClassification): string {
  return `${spot.key}${spot.texture ? ` (${spot.texture})` : ""}`;
}
