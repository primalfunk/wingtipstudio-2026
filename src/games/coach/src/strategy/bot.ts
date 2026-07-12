import { legalActions } from "../core/engine";
import type { BotDecision, BotStyle, CoachRecommendation, EngineAction, GameState, LegalActions } from "../core/types";
import { handStrength } from "./ranges";
import { recommend } from "./coach";
import { getBotArchetype } from "../bot/archetypes";

function normalize(probabilities: Partial<Record<EngineAction, number>>): Partial<Record<EngineAction, number>> {
  const total = Object.values(probabilities).reduce((sum, value) => sum + Math.max(0, value || 0), 0);
  if (total <= 0) {
    return probabilities;
  }

  const next: Partial<Record<EngineAction, number>> = {};
  for (const key of Object.keys(probabilities) as EngineAction[]) {
    next[key] = Math.max(0, probabilities[key] || 0) / total;
  }
  return next;
}

function shiftMass(
  next: Partial<Record<EngineAction, number>>,
  fromKeys: EngineAction[],
  toKey: EngineAction,
  ratio: number
): void {
  let shifted = 0;
  for (const key of fromKeys) {
    const value = next[key] || 0;
    const moved = value * ratio;
    next[key] = Math.max(0, value - moved);
    shifted += moved;
  }
  next[toKey] = (next[toKey] || 0) + shifted;
}

function adjustPreflop(
  probabilities: Partial<Record<EngineAction, number>>,
  state: GameState,
  profile: ReturnType<typeof getBotArchetype>
): Partial<Record<EngineAction, number>> {
  const next = { ...probabilities };
  const strength = handStrength(state.botHole);

  if (strength < 5 && profile.preflopLooseness > 1) {
    const ratio = Math.min(0.55, (profile.preflopLooseness - 1) * 0.8);
    shiftMass(next, ["fold"], next.raise !== undefined ? "raise" : "call", ratio);
    if (next.call !== undefined && next.raise !== undefined) {
      const extraRaise = (next.call || 0) * Math.min(0.22, (profile.raiseFrequencyBias - 1) * 0.25);
      next.call = Math.max(0, (next.call || 0) - extraRaise);
      next.raise = (next.raise || 0) + extraRaise;
    }
  } else if (strength < 8 && profile.preflopLooseness < 1) {
    const ratio = Math.min(0.55, (1 - profile.preflopLooseness) * 0.85);
    shiftMass(next, ["call", "raise"], "fold", ratio);
  }

  return normalize(next);
}

function adjustPostflop(
  probabilities: Partial<Record<EngineAction, number>>,
  state: GameState,
  recommendation: CoachRecommendation,
  profile: ReturnType<typeof getBotArchetype>
): Partial<Record<EngineAction, number>> {
  const next = { ...probabilities };
  const equity = recommendation.equity ?? 0.5;
  const facingBet = (recommendation.owe ?? 0) > 0;
  const hasInitiative = state.lastAggressor === "bot";

  if (!facingBet) {
    if (hasInitiative && next.bet !== undefined) {
      next.bet *= profile.cBetFrequencyBias * profile.aggressionLevel;
    }
    if (next.raise !== undefined) {
      next.raise *= profile.raiseFrequencyBias * profile.aggressionLevel;
    }
    if ((next.bet !== undefined || next.raise !== undefined) && equity < 0.45) {
      const bluffBoost = Math.max(0.7, profile.bluffFrequencyBias);
      if (next.bet !== undefined) next.bet *= bluffBoost;
      if (next.raise !== undefined) next.raise *= bluffBoost;
    }
    if (equity >= 0.58 && next.check !== undefined) {
      next.check *= 1 / Math.max(0.75, profile.aggressionLevel);
    }
  } else {
    if (next.call !== undefined) next.call *= profile.callingTendency;
    if (next.fold !== undefined) next.fold *= profile.foldingTendency;
    if (next.raise !== undefined) next.raise *= profile.raiseFrequencyBias * profile.aggressionLevel;

    if (profile.id === "station") {
      if (next.raise !== undefined) next.raise *= 0.65;
      if (next.call !== undefined) next.call *= 1.18;
    }
    if (profile.id === "fit_or_fold" && equity < 0.5) {
      if (next.fold !== undefined) next.fold *= 1.25;
      if (next.call !== undefined) next.call *= 0.8;
      if (next.raise !== undefined) next.raise *= 0.72;
    }
    if (profile.id === "maniac" && equity < 0.45) {
      if (next.raise !== undefined) next.raise *= 1.22;
      if (next.call !== undefined) next.call *= 0.9;
    }
    if (profile.id === "nit" && equity < 0.55) {
      if (next.fold !== undefined) next.fold *= 1.18;
      if (next.raise !== undefined) next.raise *= 0.74;
    }
  }

  return normalize(next);
}

export function adjustProbabilitiesForArchetype(
  probabilities: Partial<Record<EngineAction, number>>,
  state: GameState,
  recommendation: CoachRecommendation,
  style: BotStyle
): Partial<Record<EngineAction, number>> {
  const profile = getBotArchetype(style);
  if (state.street === "preflop") {
    return adjustPreflop(probabilities, state, profile);
  }
  return adjustPostflop(probabilities, state, recommendation, profile);
}

function sample(probabilities: Partial<Record<EngineAction, number>>): EngineAction {
  const roll = Math.random();
  let cumulative = 0;

  for (const [action, value] of Object.entries(probabilities) as Array<[EngineAction, number]>) {
    cumulative += value;
    if (roll <= cumulative) {
      return action;
    }
  }

  return Object.keys(probabilities)[0] as EngineAction;
}

function filterToLegal(
  actions: LegalActions,
  probabilities: Partial<Record<EngineAction, number>>
): Partial<Record<EngineAction, number>> {
  const filtered: Partial<Record<EngineAction, number>> = {};
  let total = 0;

  for (const key of Object.keys(actions) as EngineAction[]) {
    if (probabilities[key] !== undefined) {
      filtered[key] = probabilities[key];
      total += probabilities[key] || 0;
    }
  }

  if (probabilities.bet !== undefined && filtered.bet === undefined && actions.raise) {
    filtered.raise = (filtered.raise || 0) + probabilities.bet;
    total += probabilities.bet;
  }
  if (probabilities.raise !== undefined && filtered.raise === undefined && actions.bet) {
    filtered.bet = (filtered.bet || 0) + probabilities.raise;
    total += probabilities.raise;
  }

  if (total <= 0) {
    return filtered;
  }

  for (const key of Object.keys(filtered) as EngineAction[]) {
    filtered[key] = (filtered[key] || 0) / total;
  }

  return filtered;
}

function adjustedSizing(amount: number | undefined, range: { min: number; max: number }, style: BotStyle): number {
  const profile = getBotArchetype(style);
  const base = amount ?? range.min;
  const midpoint = range.min + (range.max - range.min) * 0.5;
  const aggressionShift = (profile.aggressionLevel - 1) * 0.18 + (profile.raiseFrequencyBias - 1) * 0.12;
  const target = midpoint + (base - midpoint) + (range.max - range.min) * aggressionShift;
  return Math.max(range.min, Math.min(range.max, Math.round(target)));
}

export function decide(state: GameState, style: BotStyle = "straightforward_reg"): BotDecision {
  const recommendation = recommend(state, "bot");
  if (!recommendation) {
    return { action: "fold" };
  }

  const actions = legalActions(state);
  const archetyped = adjustProbabilitiesForArchetype(recommendation.probs, state, recommendation, style);
  const filtered = filterToLegal(actions, archetyped);
  const total = Object.values(filtered).reduce((sum, value) => sum + (value || 0), 0);

  if (total === 0) {
    if (actions.check) return { action: "check" };
    if (actions.call) return { action: "call" };
    if (actions.fold) return { action: "fold" };
    return { action: Object.keys(actions)[0] as EngineAction };
  }

  const choice = sample(filtered);
  const decision: BotDecision = { action: choice };
  if (choice === "bet") decision.amount = recommendation.sizing.bet;
  if (choice === "raise") decision.amount = recommendation.sizing.raise;

  if (choice === "bet" || choice === "raise") {
    const range = actions[choice];
    if (!range || !("min" in range)) {
      if (actions.check) return { action: "check" };
      if (actions.call) return { action: "call" };
      return { action: "fold" };
    }
    decision.amount = adjustedSizing(decision.amount, range, style);
  }

  return decision;
}
