import { potTotal, snapshotState } from "../core/engine";
import type {
  ActionHistoryEntry,
  BotStyle,
  CoachEvaluation,
  CoachRecommendation,
  GameState,
  HandHistoryActionEvent,
  HandHistoryEvent,
  HandHistoryShowdownEvent,
  HandHistorySpotTag,
  ReplayStateSnapshot,
  ReviewTag,
  SavedCoachSnapshot,
  SavedHandHistory,
  SavedHandSummary,
  SpotClassification
} from "../core/types";
import { clearStudyStore, deleteStudyHand, getHandById, getRecentHands, saveStudyHand, updateStudyHandBookmark } from "./studyStore";

const STORAGE_VERSION = 1;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

interface PendingHeroDecision {
  key: string;
  snapshot: SavedCoachSnapshot;
}

export interface LiveHandRecorder {
  id: string;
  timestamp: string;
  version: number;
  table: SavedHandHistory["table"];
  players: SavedHandHistory["players"];
  initial: SavedHandHistory["initial"];
  events: HandHistoryEvent[];
  actionLog: ActionHistoryEntry[];
  pendingHeroDecision: PendingHeroDecision | null;
}

function cloneActionEntry(entry: ActionHistoryEntry): ActionHistoryEntry {
  return {
    street: entry.street,
    actor: entry.actor,
    action: entry.action,
    amount: entry.amount
  };
}

function cloneRecommendation(recommendation: CoachRecommendation): CoachRecommendation {
  return {
    phase: recommendation.phase,
    probs: { ...recommendation.probs },
    sizing: { ...recommendation.sizing },
    spot: recommendation.spot
      ? {
          key: recommendation.spot.key,
          label: recommendation.spot.label,
          street: recommendation.spot.street,
          position: recommendation.spot.position,
          potType: recommendation.spot.potType,
          initiative: recommendation.spot.initiative,
          facingAction: recommendation.spot.facingAction,
          texture: recommendation.spot.texture,
          priorActionPattern: recommendation.spot.priorActionPattern,
          metadata: {
            street: recommendation.spot.metadata.street,
            potType: recommendation.spot.metadata.potType,
            position: recommendation.spot.metadata.position,
            initiative: recommendation.spot.metadata.initiative,
            facingAction: recommendation.spot.metadata.facingAction,
            texture: recommendation.spot.metadata.texture,
            priorActionPattern: recommendation.spot.metadata.priorActionPattern,
            facingBetSize: recommendation.spot.metadata.facingBetSize
          }
        }
      : undefined,
    equity: recommendation.equity,
    potOdds: recommendation.potOdds,
    pot: recommendation.pot,
    owe: recommendation.owe,
    oppRange: recommendation.oppRange
      ? {
          label: recommendation.oppRange.label,
          combos: recommendation.oppRange.combos.map((combo) => [combo[0], combo[1]])
        }
      : undefined,
    inferredRange: recommendation.inferredRange
      ? {
          seed: {
            sourcePreflopLine: recommendation.inferredRange.seed.sourcePreflopLine,
            position: recommendation.inferredRange.seed.position,
            initiative: recommendation.inferredRange.seed.initiative
          },
          classWeights: { ...recommendation.inferredRange.classWeights },
          flags: { ...recommendation.inferredRange.flags },
          emphasis: [...recommendation.inferredRange.emphasis],
          shapeLabel: recommendation.inferredRange.shapeLabel,
          summaryLabel: recommendation.inferredRange.summaryLabel,
          actionNotes: [...recommendation.inferredRange.actionNotes],
          blockerNotes: recommendation.inferredRange.blockerNotes.map((note) => ({ ...note })),
          debugLabel: recommendation.inferredRange.debugLabel
        }
      : undefined,
    texture: recommendation.texture
      ? {
          label: recommendation.texture.label,
          detail: recommendation.texture.detail,
          flushRisk: recommendation.texture.flushRisk,
          straightRisk: recommendation.texture.straightRisk
        }
      : undefined,
    strategySelection: recommendation.strategySelection
      ? {
          spotKey: recommendation.strategySelection.spotKey,
          handClass: recommendation.strategySelection.handClass,
          confidence: recommendation.strategySelection.confidence,
          sizingFamily: recommendation.strategySelection.sizingFamily,
          spotSummary: recommendation.strategySelection.spotSummary,
          preferenceId: recommendation.strategySelection.preferenceId
        }
      : undefined,
    reasoning: {
      situation: recommendation.reasoning.situation,
      hand: recommendation.reasoning.hand,
      analysis: recommendation.reasoning.analysis,
      recommendation: recommendation.reasoning.recommendation,
      tip: recommendation.reasoning.tip,
      mixLabel: recommendation.reasoning.mixLabel
    }
  };
}

function cloneEvaluation(evaluation: CoachEvaluation): CoachEvaluation {
  return {
    verdict: evaluation.verdict,
    tone: evaluation.tone,
    explanation: evaluation.explanation,
    probability: evaluation.probability
  };
}

function recommendationKey(state: GameState): string {
  return `${state.street}:${state.actionHistory.length}:${state.toAct ?? "none"}:${state.board.join("")}:${state.heroCommitted}:${state.botCommitted}:${state.currentBet}`;
}

function handSummaryOutcome(state: GameState): SavedHandSummary["outcome"] {
  if (state.result?.winner === "hero") return "hero_win";
  if (state.result?.winner === "bot") return "villain_win";
  return "split";
}

function toBb(chips: number, bb: number): number {
  return Number((chips / Math.max(1, bb)).toFixed(2));
}

function actionEntries(events: HandHistoryEvent[]): HandHistoryActionEvent[] {
  return events.filter((event): event is HandHistoryActionEvent => event.type === "action");
}

function deriveSpotTags(hand: Omit<SavedHandHistory, "tags">): HandHistorySpotTag[] {
  const tags = new Set<HandHistorySpotTag>();
  const preflopRaises = hand.actionLog.filter((entry) => entry.street === "preflop" && (entry.action === "raise" || entry.action === "bet")).length;
  const preflopCalls = hand.actionLog.filter((entry) => entry.street === "preflop" && entry.action === "call").length;
  if (preflopRaises === 1 && preflopCalls >= 1) tags.add("single_raised_pot");
  if (preflopRaises === 0 && preflopCalls > 0) tags.add("limped_pot");
  if (preflopRaises >= 2) tags.add("3bet_pot");
  if (hand.summary.showdown) tags.add("showdown");
  if (hand.summary.allIn && hand.actionLog.some((entry) => entry.street === "preflop")) tags.add("all_in_preflop");

  for (const event of actionEntries(hand.events)) {
    const spotKey = event.coachSnapshot?.spotKey;
    if (spotKey === "flop_srp_ip_cbet") tags.add("flop_cbet_spot");
    if (spotKey === "turn_barrel_after_flop_call") tags.add("turn_barrel_spot");
    if (spotKey === "river_bluffcatch_vs_bet") tags.add("river_bluffcatch_spot");
  }

  return [...tags];
}

function deriveReviewTags(hand: Omit<SavedHandHistory, "tags">): ReviewTag[] {
  const tags = new Set<ReviewTag>();
  if (hand.summary.showdown) tags.add("showdown");
  if (hand.summary.allIn && hand.actionLog.some((entry) => entry.street === "preflop")) tags.add("all_in_preflop");
  if (hand.summary.resultReason === "fold") {
    if (hand.summary.winner === "hero") tags.add("villain_folded");
    if (hand.summary.winner === "bot") tags.add("hero_folded");
  }

  const actions = actionEntries(hand.events).filter((event) => event.isHeroDecision && event.agreement);
  if (actions.some((event) => event.agreement?.tone === "bad")) tags.add("coach_disagreement");
  if (actions.some((event) => event.agreement?.tone === "mixed")) tags.add("coach_mixed");
  if (actions.length > 0 && actions.every((event) => event.agreement?.tone === "good")) tags.add("coach_aligned");
  return [...tags];
}

export function createLiveHandRecorder(state: GameState, botStyle: BotStyle): LiveHandRecorder {
  const timestamp = new Date().toISOString();
  return {
    id: `hand_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp,
    version: STORAGE_VERSION,
    table: {
      bigBlind: state.bb,
      smallBlind: state.sb,
      startingStack: state.startingStack,
      startingStackBb: toBb(state.startingStack, state.bb),
      botStyle
    },
    players: {
      heroName: "Hero",
      villainName: "Bot",
      heroSeat: state.heroIsButton ? "button_sb" : "big_blind",
      villainSeat: state.heroIsButton ? "big_blind" : "button_sb"
    },
    initial: {
      heroHole: [...state.heroHole],
      villainHole: [...state.botHole],
      board: [...state.board],
      state: snapshotState(state)
    },
    events: [],
    actionLog: [],
    pendingHeroDecision: null
  };
}

export function rememberHeroRecommendation(
  recorder: LiveHandRecorder | null,
  state: GameState,
  recommendation: CoachRecommendation,
  spot: SpotClassification
): void {
  if (!recorder || state.toAct !== "hero") return;
  const key = recommendationKey(state);
  if (recorder.pendingHeroDecision?.key === key) return;
  recorder.pendingHeroDecision = {
      key,
      snapshot: {
        spotKey: spot.key,
        spotLabel: spot.label,
        recommendation: cloneRecommendation(recommendation)
      }
    };
}

export function recordAppliedAction(
  recorder: LiveHandRecorder | null,
  params: {
    beforeState: GameState;
    afterState: GameState;
    actor: "hero" | "bot";
    action: ActionHistoryEntry["action"];
    amount?: number;
    agreement?: CoachEvaluation;
  }
): void {
  if (!recorder) return;
  const beforePot = potTotal(params.beforeState);
  const lastAction = params.afterState.actionHistory[params.afterState.actionHistory.length - 1];
  if (!lastAction) return;

  const event: HandHistoryActionEvent = {
    type: "action",
    index: recorder.events.length,
    street: lastAction.street,
    actor: params.actor,
    action: params.action,
    amount: params.amount,
    potBefore: beforePot,
    potAfter: potTotal(params.afterState),
    boardAfter: [...params.afterState.board],
    stateAfter: snapshotState(params.afterState),
    isHeroDecision: params.actor === "hero",
    coachSnapshot: params.actor === "hero" ? recorder.pendingHeroDecision?.snapshot : undefined,
    agreement: params.actor === "hero" && params.agreement ? cloneEvaluation(params.agreement) : undefined
  };

  recorder.events.push(event);
  recorder.actionLog.push(cloneActionEntry(lastAction));
  if (params.actor === "hero") {
    recorder.pendingHeroDecision = null;
  }
}

export function recordStreetTransition(
  recorder: LiveHandRecorder | null,
  fromStreet: GameState["street"],
  toStreet: GameState["street"],
  snapshot: ReplayStateSnapshot
): void {
  if (!recorder) return;
  recorder.events.push({
    type: "street_transition",
    index: recorder.events.length,
    fromStreet,
    toStreet,
    boardAfter: [...snapshot.board],
    stateAfter: {
      ...snapshot,
      board: [...snapshot.board],
      result: snapshot.result
        ? {
            winner: snapshot.result.winner,
            amount: snapshot.result.amount,
            reason: snapshot.result.reason,
            heroHandName: snapshot.result.heroHandName,
            botHandName: snapshot.result.botHandName
          }
        : null
    }
  });
}

export function recordShowdown(recorder: LiveHandRecorder | null, snapshot: ReplayStateSnapshot): void {
  if (!recorder) return;
  const event: HandHistoryShowdownEvent = {
    type: "showdown",
    index: recorder.events.length,
    street: "showdown",
    boardAfter: [...snapshot.board],
    stateAfter: {
      ...snapshot,
      board: [...snapshot.board],
      result: snapshot.result
        ? {
            winner: snapshot.result.winner,
            amount: snapshot.result.amount,
            reason: snapshot.result.reason,
            heroHandName: snapshot.result.heroHandName,
            botHandName: snapshot.result.botHandName
          }
        : null
    }
  };
  recorder.events.push(event);
}

export function finalizeLiveHand(recorder: LiveHandRecorder | null, state: GameState): SavedHandHistory | null {
  if (!recorder) return null;
  const heroStart = recorder.table.startingStack;
  const villainStart = recorder.table.startingStack;
  const heroDelta = state.heroStack - heroStart;
  const villainDelta = state.botStack - villainStart;
  const heroActionEvents = actionEntries(recorder.events).filter((event) => event.isHeroDecision && event.agreement);
  const summary: SavedHandSummary = {
    outcome: handSummaryOutcome(state),
    resultReason: state.result?.reason ?? "unknown",
    showdown: state.result?.reason === "showdown",
    allIn: state.heroStack === 0 || state.botStack === 0 || recorder.events.some((event) => event.type === "street_transition" && event.stateAfter.handOver),
    winner: state.result?.winner ?? "unknown",
    finalPot: state.result?.amount ?? state.pot,
    heroDeltaChips: heroDelta,
    villainDeltaChips: villainDelta,
    heroDeltaBb: toBb(heroDelta, state.bb),
    villainDeltaBb: toBb(villainDelta, state.bb),
    heroFinalStack: state.heroStack,
    villainFinalStack: state.botStack,
    heroHandName: state.result?.heroHandName,
    villainHandName: state.result?.botHandName,
    coachAgreement: {
      good: heroActionEvents.filter((event) => event.agreement?.tone === "good").length,
      mixed: heroActionEvents.filter((event) => event.agreement?.tone === "mixed").length,
      bad: heroActionEvents.filter((event) => event.agreement?.tone === "bad").length
    }
  };

  const baseHand: Omit<SavedHandHistory, "tags"> = {
    id: recorder.id,
    version: recorder.version,
    timestamp: recorder.timestamp,
    table: recorder.table,
    players: recorder.players,
    initial: recorder.initial,
    events: recorder.events,
    actionLog: recorder.actionLog,
    summary
  };

  return {
    ...baseHand,
    tags: {
      bookmarked: false,
      spotTags: deriveSpotTags(baseHand),
      reviewTags: deriveReviewTags(baseHand)
    }
  };
}

export function listSavedHands(storage?: StorageLike): SavedHandHistory[] {
  return getRecentHands(60, storage);
}

export function loadSavedHand(id: string, storage?: StorageLike): SavedHandHistory | null {
  return getHandById(id, storage);
}

export function saveCompletedHand(hand: SavedHandHistory, storage?: StorageLike): void {
  saveStudyHand(hand, storage);
}

export function deleteSavedHand(id: string, storage?: StorageLike): void {
  deleteStudyHand(id, storage);
}

export function updateSavedHandBookmark(id: string, bookmarked: boolean, storage?: StorageLike): void {
  updateStudyHandBookmark(id, bookmarked, storage);
}

export function clearSavedHands(storage?: StorageLike): void {
  clearStudyStore(storage);
}

export { STORAGE_VERSION };
