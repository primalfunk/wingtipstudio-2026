import type {
  ActionHistoryEntry,
  HandHistoryActionEvent,
  HandHistoryEvent,
  ReplayStateSnapshot,
  SavedHandHistory,
  Street
} from "../core/types";

export interface ReplaySession {
  hand: SavedHandHistory;
  cursor: number;
}

export interface ReplayFrame {
  cursor: number;
  totalSteps: number;
  state: ReplayStateSnapshot;
  board: SavedHandHistory["initial"]["board"];
  shownBoard: SavedHandHistory["initial"]["board"];
  actionHistory: ActionHistoryEntry[];
  currentEvent: HandHistoryEvent | null;
  currentStreet: Street;
  heroDecisionEvent: HandHistoryActionEvent | null;
}

function actionHistoryThroughCursor(hand: SavedHandHistory, cursor: number): ActionHistoryEntry[] {
  if (cursor < 0) return [];
  const entries: ActionHistoryEntry[] = [];
  for (const event of hand.events.slice(0, cursor + 1)) {
    if (event.type === "action") {
      entries.push({
        street: event.street,
        actor: event.actor,
        action: event.action,
        amount: event.amount
      });
    }
  }
  return entries;
}

export function createReplaySession(hand: SavedHandHistory): ReplaySession {
  return { hand, cursor: -1 };
}

export function getReplayFrame(hand: SavedHandHistory, cursor: number): ReplayFrame {
  const boundedCursor = Math.max(-1, Math.min(cursor, hand.events.length - 1));
  const currentEvent = boundedCursor >= 0 ? hand.events[boundedCursor] : null;
  const state = currentEvent ? currentEvent.stateAfter : hand.initial.state;
  const heroDecisionEvent =
    currentEvent && currentEvent.type === "action" && currentEvent.isHeroDecision ? currentEvent : null;

  return {
    cursor: boundedCursor,
    totalSteps: hand.events.length,
    state,
    board: hand.initial.board,
    shownBoard: state.board,
    actionHistory: actionHistoryThroughCursor(hand, boundedCursor),
    currentEvent,
    currentStreet: state.street,
    heroDecisionEvent
  };
}

function firstIndexForStreet(hand: SavedHandHistory, street: Street): number {
  return hand.events.findIndex((event) => event.stateAfter.street === street || (event.type === "action" && event.street === street));
}

function lastIndexForStreet(hand: SavedHandHistory, street: Street): number {
  for (let index = hand.events.length - 1; index >= 0; index -= 1) {
    const event = hand.events[index];
    if (event.stateAfter.street === street || (event.type === "action" && event.street === street)) {
      return index;
    }
  }
  return -1;
}

export function moveReplayCursor(session: ReplaySession, cursor: number): ReplaySession {
  return {
    ...session,
    cursor: Math.max(-1, Math.min(cursor, session.hand.events.length - 1))
  };
}

export function stepReplay(session: ReplaySession, delta: number): ReplaySession {
  return moveReplayCursor(session, session.cursor + delta);
}

export function jumpReplayToStart(session: ReplaySession): ReplaySession {
  return moveReplayCursor(session, -1);
}

export function jumpReplayToEnd(session: ReplaySession): ReplaySession {
  return moveReplayCursor(session, session.hand.events.length - 1);
}

export function jumpReplayStreetForward(session: ReplaySession): ReplaySession {
  const frame = getReplayFrame(session.hand, session.cursor);
  const order: Street[] = ["preflop", "flop", "turn", "river", "showdown"];
  const nextStreet = order[order.indexOf(frame.currentStreet) + 1];
  if (!nextStreet) return session;
  const nextIndex = firstIndexForStreet(session.hand, nextStreet);
  return nextIndex === -1 ? session : moveReplayCursor(session, nextIndex);
}

export function jumpReplayStreetBackward(session: ReplaySession): ReplaySession {
  const frame = getReplayFrame(session.hand, session.cursor);
  const order: Street[] = ["preflop", "flop", "turn", "river", "showdown"];
  const previousStreet = order[Math.max(0, order.indexOf(frame.currentStreet) - 1)];
  if (!previousStreet) return jumpReplayToStart(session);
  const previousIndex = lastIndexForStreet(session.hand, previousStreet);
  if (previousStreet === "preflop" && previousIndex === -1) {
    return jumpReplayToStart(session);
  }
  return previousIndex === -1 ? jumpReplayToStart(session) : moveReplayCursor(session, previousIndex);
}
