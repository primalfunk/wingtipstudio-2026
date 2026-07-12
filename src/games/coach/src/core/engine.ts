import { createDeck, shuffle } from "./deck";
import type { Actor, EngineAction, GameState, GameStateOptions, LegalActions, ReplayStateSnapshot } from "./types";
import { compareHands, describeHand, evaluate } from "./evaluator";

export interface EngineObserver {
  onStreetAdvanced?: (fromStreet: GameState["street"], toStreet: GameState["street"], snapshot: ReplayStateSnapshot) => void;
  onShowdown?: (snapshot: ReplayStateSnapshot) => void;
}

export function createState(options: GameStateOptions = {}): GameState {
  const startingStack = options.startingStack ?? 1000;
  const bigBlind = options.bb ?? 20;

  return {
    sb: options.sb ?? 10,
    bb: bigBlind,
    startingStack,
    heroStack: startingStack,
    botStack: startingStack,
    heroHole: [],
    botHole: [],
    board: [],
    deck: [],
    pot: 0,
    heroCommitted: 0,
    botCommitted: 0,
    currentBet: 0,
    minRaiseAmount: bigBlind,
    street: "idle",
    toAct: null,
    heroHasActed: false,
    botHasActed: false,
    lastAggressor: null,
    heroIsButton: options.heroIsButton ?? true,
    handOver: false,
    result: null,
    actionHistory: [],
    handNumber: 0
  };
}

export function snapshotState(state: GameState): ReplayStateSnapshot {
  return {
    street: state.street,
    board: [...state.board],
    pot: state.pot,
    heroStack: state.heroStack,
    botStack: state.botStack,
    heroCommitted: state.heroCommitted,
    botCommitted: state.botCommitted,
    currentBet: state.currentBet,
    minRaiseAmount: state.minRaiseAmount,
    toAct: state.toAct,
    heroHasActed: state.heroHasActed,
    botHasActed: state.botHasActed,
    lastAggressor: state.lastAggressor,
    handOver: state.handOver,
    result: state.result
      ? {
          winner: state.result.winner,
          amount: state.result.amount,
          reason: state.result.reason,
          heroHandName: state.result.heroHandName,
          botHandName: state.result.botHandName
        }
      : null
  };
}

export function cloneState(state: GameState): GameState {
  return {
    ...state,
    heroHole: [...state.heroHole],
    botHole: [...state.botHole],
    board: [...state.board],
    deck: [...state.deck],
    actionHistory: state.actionHistory.map((entry) => ({
      street: entry.street,
      actor: entry.actor,
      action: entry.action,
      amount: entry.amount
    })),
    result: state.result
      ? {
          winner: state.result.winner,
          amount: state.result.amount,
          reason: state.result.reason,
          heroHandName: state.result.heroHandName,
          botHandName: state.result.botHandName
        }
      : null
  };
}

export function startHand(state: GameState): void {
  state.handNumber += 1;
  if (state.heroStack < state.bb) {
    state.heroStack = state.startingStack;
  }
  if (state.botStack < state.bb) {
    state.botStack = state.startingStack;
  }

  state.deck = shuffle(createDeck());
  state.heroHole = [state.deck.pop()!, state.deck.pop()!];
  state.botHole = [state.deck.pop()!, state.deck.pop()!];
  state.board = [];
  state.pot = 0;
  state.heroCommitted = 0;
  state.botCommitted = 0;
  state.minRaiseAmount = state.bb;
  state.heroHasActed = false;
  state.botHasActed = false;
  state.lastAggressor = null;
  state.handOver = false;
  state.result = null;
  state.actionHistory = [];
  state.street = "preflop";

  if (state.heroIsButton) {
    postBlind(state, "hero", state.sb);
    postBlind(state, "bot", state.bb);
  } else {
    postBlind(state, "bot", state.sb);
    postBlind(state, "hero", state.bb);
  }

  state.currentBet = state.bb;
  state.toAct = state.heroIsButton ? "hero" : "bot";
}

function postBlind(state: GameState, actor: Actor, amount: number): void {
  const stackKey = actor === "hero" ? "heroStack" : "botStack";
  const committedKey = actor === "hero" ? "heroCommitted" : "botCommitted";
  const actualAmount = Math.min(amount, state[stackKey]);
  state[stackKey] -= actualAmount;
  state[committedKey] += actualAmount;
}

export function potTotal(state: GameState): number {
  return state.pot + state.heroCommitted + state.botCommitted;
}

export function toCall(state: GameState, actor: Actor): number {
  return state.currentBet - (actor === "hero" ? state.heroCommitted : state.botCommitted);
}

export function legalActions(state: GameState): LegalActions {
  if (state.handOver || !state.toAct) {
    return {};
  }

  const actor = state.toAct;
  const owe = toCall(state, actor);
  const stack = actor === "hero" ? state.heroStack : state.botStack;
  const committed = actor === "hero" ? state.heroCommitted : state.botCommitted;
  const actions: LegalActions = {};

  if (owe > 0) {
    actions.fold = true;
    actions.call = { amount: Math.min(owe, stack) };
  }
  if (owe === 0) {
    actions.check = true;
  }

  if (stack > 0) {
    if (owe === 0) {
      const minBet = Math.min(state.bb, stack);
      const maxBet = stack;
      if (maxBet >= minBet) {
        actions.bet = { min: minBet, max: maxBet };
      }
    } else if (stack > owe) {
      const minRaiseTo = Math.min(state.currentBet + state.minRaiseAmount, committed + stack);
      const maxRaiseTo = committed + stack;
      if (maxRaiseTo > state.currentBet) {
        actions.raise = { min: minRaiseTo, max: maxRaiseTo };
      }
    }
  }

  return actions;
}

export function applyAction(
  state: GameState,
  actor: Actor,
  action: EngineAction,
  amount?: number,
  observer?: EngineObserver
): void {
  if (state.handOver) {
    throw new Error("Hand is over");
  }
  if (state.toAct !== actor) {
    throw new Error("Not your turn");
  }

  const actorCommittedKey = actor === "hero" ? "heroCommitted" : "botCommitted";
  const actorStackKey = actor === "hero" ? "heroStack" : "botStack";
  const actorHasActedKey = actor === "hero" ? "heroHasActed" : "botHasActed";
  const opponent = actor === "hero" ? "bot" : "hero";
  const opponentCommittedKey = opponent === "hero" ? "heroCommitted" : "botCommitted";
  const opponentStackKey = opponent === "hero" ? "heroStack" : "botStack";
  const opponentHasActedKey = opponent === "hero" ? "heroHasActed" : "botHasActed";

  if (action === "fold") {
    state.actionHistory.push({ street: state.street, actor, action: "fold" });
    const winner = actor === "hero" ? "bot" : "hero";
    state[winner === "hero" ? "heroStack" : "botStack"] += potTotal(state);
    state.handOver = true;
    state.result = { winner, amount: potTotal(state), reason: "fold" };
    state.toAct = null;
    return;
  }

  if (action === "check") {
    if (toCall(state, actor) > 0) {
      throw new Error("Cannot check, must call or fold");
    }
    state.actionHistory.push({ street: state.street, actor, action: "check" });
    state[actorHasActedKey] = true;
  } else if (action === "call") {
    const owe = toCall(state, actor);
    const callAmount = Math.min(owe, state[actorStackKey]);
    state[actorStackKey] -= callAmount;
    state[actorCommittedKey] += callAmount;
    state.actionHistory.push({ street: state.street, actor, action: "call", amount: callAmount });
    state[actorHasActedKey] = true;

    if (state[actorCommittedKey] < state[opponentCommittedKey]) {
      const refund = state[opponentCommittedKey] - state[actorCommittedKey];
      state[opponentCommittedKey] -= refund;
      state[opponentStackKey] += refund;
      state.currentBet = state[actorCommittedKey];
    }
  } else if (action === "bet" || action === "raise") {
    if (amount === undefined || amount === null || !Number.isFinite(amount)) {
      throw new Error("Bet/raise requires a valid numeric amount");
    }
    const newTotal = Math.round(amount);
    const diff = newTotal - state[actorCommittedKey];
    if (diff <= 0) {
      throw new Error("Raise must be larger than current commitment");
    }
    if (diff > state[actorStackKey]) {
      throw new Error("Not enough chips");
    }

    const raiseIncrement = newTotal - state.currentBet;
    const allIn = diff === state[actorStackKey];
    if (raiseIncrement < state.minRaiseAmount && !allIn) {
      throw new Error(`Raise must be at least to ${state.currentBet + state.minRaiseAmount}`);
    }

    state[actorStackKey] -= diff;
    state[actorCommittedKey] = newTotal;
    state.currentBet = newTotal;
    if (raiseIncrement >= state.minRaiseAmount) {
      state.minRaiseAmount = raiseIncrement;
    }
    state.lastAggressor = actor;
    state.actionHistory.push({ street: state.street, actor, action, amount: newTotal });
    state[actorHasActedKey] = true;
    state[opponentHasActedKey] = false;
  } else {
    throw new Error(`Unknown action: ${action satisfies never}`);
  }

  const equal = state.heroCommitted === state.botCommitted;
  const bothActed = state.heroHasActed && state.botHasActed;
  const someoneAllIn = state.heroStack === 0 || state.botStack === 0;

  if (equal && (bothActed || (someoneAllIn && state[actorHasActedKey]))) {
    advanceStreet(state, observer);
  } else {
    state.toAct = opponent;
  }
}

function advanceStreet(state: GameState, observer?: EngineObserver): void {
  const fromStreet = state.street;
  state.pot += state.heroCommitted + state.botCommitted;
  state.heroCommitted = 0;
  state.botCommitted = 0;
  state.currentBet = 0;
  state.minRaiseAmount = state.bb;
  state.heroHasActed = false;
  state.botHasActed = false;
  state.lastAggressor = null;

  const order: GameState["street"][] = ["preflop", "flop", "turn", "river", "showdown"];
  const nextStreet = order[order.indexOf(state.street) + 1];
  state.street = nextStreet;

  if (nextStreet === "flop") {
    state.board = [state.deck.pop()!, state.deck.pop()!, state.deck.pop()!];
  } else if (nextStreet === "turn") {
    state.board.push(state.deck.pop()!);
  } else if (nextStreet === "river") {
    state.board.push(state.deck.pop()!);
  } else if (nextStreet === "showdown") {
    resolveShowdown(state, observer);
    return;
  }

  observer?.onStreetAdvanced?.(fromStreet, nextStreet, snapshotState(state));

  if (state.heroStack === 0 || state.botStack === 0) {
    state.heroHasActed = true;
    state.botHasActed = true;
    advanceStreet(state, observer);
    return;
  }

  state.toAct = state.heroIsButton ? "bot" : "hero";
}

function resolveShowdown(state: GameState, observer?: EngineObserver): void {
  const heroScore = evaluate([...state.heroHole, ...state.board]);
  const botScore = evaluate([...state.botHole, ...state.board]);
  const comparison = compareHands(heroScore, botScore);
  state.handOver = true;
  state.toAct = null;

  if (comparison > 0) {
    state.heroStack += state.pot;
    state.result = {
      winner: "hero",
      amount: state.pot,
      reason: "showdown",
      heroHandName: describeHand(heroScore),
      botHandName: describeHand(botScore)
    };
    observer?.onShowdown?.(snapshotState(state));
    return;
  }

  if (comparison < 0) {
    state.botStack += state.pot;
    state.result = {
      winner: "bot",
      amount: state.pot,
      reason: "showdown",
      heroHandName: describeHand(heroScore),
      botHandName: describeHand(botScore)
    };
    observer?.onShowdown?.(snapshotState(state));
    return;
  }

  const half = Math.floor(state.pot / 2);
  const oddChip = state.pot - half * 2;
  state.heroStack += half;
  state.botStack += half + oddChip;
  state.result = {
    winner: "tie",
    amount: state.pot,
    reason: "showdown",
    heroHandName: describeHand(heroScore),
    botHandName: describeHand(botScore)
  };
  observer?.onShowdown?.(snapshotState(state));
}

export function switchButton(state: GameState): void {
  state.heroIsButton = !state.heroIsButton;
}
