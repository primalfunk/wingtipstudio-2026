import { handLabel, RANK_VALUE } from "../core/deck";
import { equityVsRange } from "../core/equity";
import { potTotal, toCall } from "../core/engine";
import type {
  Actor,
  BoardTexture,
  CoachHandClass,
  CoachEvaluation,
  CoachRecommendation,
  EngineAction,
  GameState,
  Rank,
  SizingFamilyKey
} from "../core/types";
import {
  lookupStrategyData
} from "../strategy-data/loader";
import {
  describeHandClass,
  handStrengthFromLabel
} from "./ranges";
import { inferOpponentRangeSummary, weightedRangeCombos } from "./rangeInference";
import { classifySpot } from "./spot";
import { classifyHeroHandForStrategy } from "./strategyHandClass";

function isButton(state: GameState, actor: Actor): boolean {
  return (actor === "hero") === state.heroIsButton;
}

export function describeBoard(board: GameState["board"]): BoardTexture {
  if (!board.length) {
    return { label: "", detail: "", flushRisk: false, straightRisk: false };
  }

  const ranks = board.map((card) => RANK_VALUE[card[0] as Rank]).sort((a, b) => b - a);
  const suits = board.map((card) => card[1]);
  const suitCounts = suits.reduce<Record<string, number>>((counts, suit) => {
    counts[suit] = (counts[suit] || 0) + 1;
    return counts;
  }, {});
  const maxSuit = Math.max(...Object.values(suitCounts));
  const paired = new Set(ranks).size < ranks.length;
  const high = ranks[0];
  const lowestSpan = ranks[0] - ranks[ranks.length - 1];

  const parts: string[] = [];
  if (paired) parts.push("paired");
  if (maxSuit === board.length && board.length >= 3) parts.push("monotone");
  else if (maxSuit >= 2) parts.push("two-tone");
  else parts.push("rainbow");

  if (!paired && lowestSpan <= 4) parts.push("connected");
  if (high >= 12) parts.push("high-card");
  else if (high <= 9) parts.push("low");

  const flushRisk = maxSuit >= (board.length < 5 ? 2 : 3);
  const straightRisk = !paired && lowestSpan <= 4;

  let detail = "";
  if (maxSuit >= 3) detail = "Three cards of the same suit - flushes are possible.";
  else if (maxSuit === 2) detail = "Two cards of the same suit - flush draws are in play.";
  if (paired) detail += `${detail ? " " : ""}A paired board makes full houses and trips possible.`;
  if (straightRisk) detail += `${detail ? " " : ""}Cards are close in rank - straights and draws are common.`;
  if (high >= 13 && !paired && maxSuit < 3) {
    detail += `${detail ? " " : ""}A dry high-card board usually favors the preflop aggressor.`;
  }

  return {
    label: parts.join(", "),
    detail,
    flushRisk,
    straightRisk
  };
}

function cardsStr(cards: GameState["board"]): string {
  const suitMap: Record<string, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };
  return cards
    .map((card) => `${card[0] === "T" ? "10" : card[0]}${suitMap[card[1]]}`)
    .join(" ");
}

function pct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function mixLabel(probabilities: Partial<Record<EngineAction, number>>): string {
  const orderedKeys: EngineAction[] = ["fold", "check", "call", "bet", "raise"];
  return orderedKeys
    .filter((key) => (probabilities[key] ?? 0) > 0)
    .map((key) => `${capitalize(key)} ${pct(probabilities[key] ?? 0)}`)
    .join(" / ");
}

function uniqueSentences(parts: Array<string | undefined | null>): string {
  const seen = new Set<string>();
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => !!part)
    .filter((part) => {
      if (seen.has(part)) return false;
      seen.add(part);
      return true;
    })
    .join(" ");
}

function displayAction(action: string): string {
  if (action === "bet") return "bet";
  if (action === "raise") return "raise";
  if (action === "call") return "call";
  if (action === "check") return "check";
  if (action === "fold") return "fold";
  if (action.startsWith("bet_")) return action.replace("bet_", "bet ");
  return action.replace(/_/g, " ");
}

function sizingFamilyForAmount(state: GameState, amount: number | undefined, action: "bet" | "raise"): SizingFamilyKey | undefined {
  if (!amount) return undefined;
  const pot = Math.max(1, potTotal(state));
  const baseline = action === "raise" ? Math.max(1, state.currentBet) : 0;
  const added = Math.max(0, amount - baseline);
  const ratio = added / pot;
  if (amount >= Math.max(state.heroStack, state.botStack)) return "all_in";
  if (ratio < 0.4) return "small";
  if (ratio < 0.8) return "medium";
  return "large";
}

function formatHandClassForCoach(handClass: CoachHandClass): string {
  return handClass.replace(/_/g, " ");
}

function preflopRecommendation(state: GameState, actor: Actor): CoachRecommendation {
  const hole = actor === "hero" ? state.heroHole : state.botHole;
  const label = handLabel(hole[0], hole[1]);
  const strength = handStrengthFromLabel(label);
  const handClass = describeHandClass(hole);
  const strategyHandClass = classifyHeroHandForStrategy(state, actor);
  const onButton = isButton(state, actor);
  const positionName = onButton ? "small blind (button)" : "big blind";
  const stackSizeInBigBlinds = Math.round(((actor === "hero" ? state.heroStack : state.botStack) + (actor === "hero" ? state.heroCommitted : state.botCommitted)) / state.bb);
  const owe = toCall(state, actor);
  const facingRaise = owe > state.bb;
  const spot = classifySpot(state);

  let probs: CoachRecommendation["probs"];
  let sizing: CoachRecommendation["sizing"];
  let recommendationText: string;
  let handText: string;
  let tip: string;

  if (!facingRaise) {
    if (strength >= 11) {
      probs = { fold: 0, call: 0.05, raise: 0.95 };
      handText = "This is a premium hand - one of the strongest starting hands in hold'em.";
    } else if (strength >= 8) {
      probs = { fold: 0, call: 0.1, raise: 0.9 };
      handText = "This is a strong hand that plays well as an open-raise.";
    } else if (strength >= 6) {
      probs = { fold: 0.05, call: 0.15, raise: 0.8 };
      handText = "This hand is clearly playable - in heads-up it raises for value.";
    } else if (strength >= 5) {
      probs = { fold: 0.15, call: 0.2, raise: 0.65 };
      handText = "This is a borderline hand. In heads-up 50bb, we still usually raise to apply pressure.";
    } else if (strength >= 3) {
      probs = { fold: 0.55, call: 0.2, raise: 0.25 };
      handText = "This hand is below the standard opening threshold - a mixed decision.";
    } else {
      probs = { fold: 0.9, call: 0.05, raise: 0.05 };
      handText = "This is one of the weakest starting hands - we mostly fold.";
    }

    const totalStack = (actor === "hero" ? state.heroStack : state.botStack) + (actor === "hero" ? state.heroCommitted : state.botCommitted);
    const openSize = Math.min(state.bb * 2 + state.sb, totalStack);
    sizing = { raise: Math.round(openSize) };
    recommendationText = `Our recommended mix is ${mixLabel(probs)}. A typical open-size is about 2.5x the big blind (${sizing.raise} chips).`;
    tip = onButton
      ? "In heads-up poker the small blind is the button - you act first preflop but have position on every later street. That's why the opening range is so wide: having position is a big edge."
      : `You have the option to complete or raise since only ${owe} is owed. Raising from the BB pressures a wide SB range with a stronger hand.`;
  } else {
    if (strength >= 13) {
      probs = { fold: 0, call: 0.2, raise: 0.8 };
      handText = "A premium hand - we happily re-raise for value.";
    } else if (strength >= 10) {
      probs = { fold: 0.05, call: 0.5, raise: 0.45 };
      handText = "A strong hand that can 3-bet or call in a mixed strategy.";
    } else if (strength >= 7) {
      probs = { fold: 0.15, call: 0.75, raise: 0.1 };
      handText = "A solid defending hand - call most of the time, 3-bet occasionally.";
    } else if (strength >= 5) {
      probs = { fold: 0.4, call: 0.55, raise: 0.05 };
      handText = "A marginal defend - playable but borderline.";
    } else if (strength >= 3) {
      probs = { fold: 0.75, call: 0.25, raise: 0 };
      handText = "This hand is below the standard calling threshold most of the time.";
    } else {
      probs = { fold: 0.95, call: 0.05, raise: 0 };
      handText = "A very weak hand - usually fold.";
    }

    const totalStack = (actor === "hero" ? state.heroStack : state.botStack) + (actor === "hero" ? state.heroCommitted : state.botCommitted);
    const threeBetSize = Math.min(state.currentBet * 3, totalStack);
    sizing = { raise: Math.round(threeBetSize) };
    recommendationText = `Our mix is ${mixLabel(probs)}. A standard 3-bet is about 3x the raise (${sizing.raise} chips).`;
    tip = "You're in the big blind facing a raise. In HU you get great pot odds to defend a lot of hands - but you'll be out of position postflop, so 3-betting your better hands keeps the aggression on your side.";
  }

  const preferredSizingKey = sizing.raise ? sizingFamilyForAmount(state, sizing.raise, "raise") : undefined;
  const strategy = lookupStrategyData(spot.key, strategyHandClass, preferredSizingKey);
  const strategyLines = [
    strategy.spot?.summary,
    strategy.spot ? `Strategic objective: ${strategy.spot.objective}` : undefined,
    strategy.preference
      ? `For ${formatHandClassForCoach(strategyHandClass)}, the default plan is ${strategy.preference.preferredActions
          .map(displayAction)
          .join(" or ")}${strategy.preference.fallbackActions.length ? ` with ${strategy.preference.fallbackActions.map(displayAction).join(" or ")} as fallback` : ""}.`
      : undefined,
    strategy.preference?.note,
    strategy.sizingFamily ? `${strategy.sizingFamily.label} sizing: ${strategy.sizingFamily.teachingNote}` : undefined
  ];
  const mistakeNote = strategy.spot?.commonMistakes[0];
  const confidenceNote =
    strategy.confidence !== "fallback" ? `Confidence: ${strategy.confidence}. This is still heuristic coaching, not solver output.` : undefined;

  return {
    phase: "preflop",
    probs,
    sizing,
    spot,
    strategySelection: {
      spotKey: spot.key,
      handClass: strategyHandClass,
      confidence: strategy.confidence,
      sizingFamily: strategy.sizingFamily?.key,
      spotSummary: strategy.spot?.summary,
      preferenceId: strategy.preference?.id
    },
    reasoning: {
      situation: uniqueSentences([
        `Spot: ${spot.label} (${spot.key}).`,
        `You're in the ${positionName} with ${stackSizeInBigBlinds}bb.`,
        onButton ? "You act first preflop, but will have position postflop." : "You're last to act preflop, first to act postflop.",
        strategy.spot?.summary
      ]),
      hand: `Your hand: ${cardsStr(hole)} (${handClass}; strategy bucket: ${formatHandClassForCoach(strategyHandClass)}). ${handText}`,
      analysis: uniqueSentences(strategyLines) || null,
      recommendation: uniqueSentences([
        recommendationText,
        strategy.preference?.caution ? `Caution: ${strategy.preference.caution}` : undefined,
        confidenceNote
      ]),
      tip: uniqueSentences([
        tip,
        mistakeNote ? `Common mistake: ${mistakeNote}` : undefined
      ]),
      mixLabel: mixLabel(probs)
    }
  };
}

function postflopRecommendation(state: GameState, actor: Actor): CoachRecommendation {
  const hole = actor === "hero" ? state.heroHole : state.botHole;
  const board = state.board;
  const pot = potTotal(state);
  const owe = toCall(state, actor);
  const potAfterCall = pot + owe;
  const potOdds = owe > 0 ? owe / potAfterCall : 0;
  const texture = describeBoard(board);
  const spot = classifySpot(state);
  const strategyHandClass = classifyHeroHandForStrategy(state, actor);
  const { range: opponentRange, summary: inferredRange } = inferOpponentRangeSummary(state, actor);
  const weightedCombos = weightedRangeCombos(inferredRange, opponentRange.combos, board, hole);
  const equity = equityVsRange(hole, board, weightedCombos, 1500);
  const stack = actor === "hero" ? state.heroStack : state.botStack;
  const committed = actor === "hero" ? state.heroCommitted : state.botCommitted;

  let probs: CoachRecommendation["probs"];
  let sizing: CoachRecommendation["sizing"];
  let recommendationText: string;
  let analysis: string;
  let tip: string;

  if (owe > 0) {
    if (equity > potOdds + 0.18) probs = { fold: 0.05, call: 0.55, raise: 0.4 };
    else if (equity > potOdds + 0.07) probs = { fold: 0.1, call: 0.8, raise: 0.1 };
    else if (equity > potOdds) probs = { fold: 0.3, call: 0.65, raise: 0.05 };
    else if (equity > potOdds - 0.05) probs = { fold: 0.7, call: 0.25, raise: 0.05 };
    else probs = { fold: 0.92, call: 0.05, raise: 0.03 };

    const raiseTarget = state.currentBet + Math.round(potAfterCall * 1.2);
    sizing = { raise: Math.min(raiseTarget, committed + stack) };
    analysis =
      `You have about ${pct(equity)} equity against what now looks like a ${inferredRange.summaryLabel}. ` +
      `${inferredRange.actionNotes.join(" ")} ` +
      `You owe ${owe} into a pot of ${pot}, needing ${pct(potOdds)} equity to break even on a call.`;
    recommendationText =
      `Our mix: ${mixLabel(probs)}. ` +
      `${inferredRange.flags.polarized ? "This line is fairly polarized, so bluff-catchers improve when you unblock bluffs." : ""}` +
      `${inferredRange.flags.condensed ? " Their continuing range is condensed, so thin value and disciplined folds matter more." : ""}`;
    const blockerText = inferredRange.blockerNotes.map((note) => note.label).join(" ");
    tip = equity > potOdds + 0.15
      ? `When your equity clearly beats the price, raising some of the time extracts more value and denies free cards. ${blockerText}`.trim()
      : equity > potOdds
        ? `Pot odds are the percentage of the new pot you're risking. If you have more equity than that percentage, a call is profitable in the long run. ${blockerText}`.trim()
        : `Your equity is below the price being offered, so this is mostly a fold unless blockers push the bluff density up. ${blockerText}`.trim();
  } else {
    if (equity > 0.72) probs = { check: 0.1, bet: 0.9 };
    else if (equity > 0.58) probs = { check: 0.3, bet: 0.7 };
    else if (equity > 0.42) probs = { check: 0.6, bet: 0.4 };
    else probs = { check: 0.85, bet: 0.15 };

    const betFraction = equity > 0.7 ? 0.75 : equity > 0.5 ? 0.5 : 0.33;
    const betAmount = Math.max(state.bb, Math.round(pot * betFraction));
    sizing = { bet: Math.min(betAmount, stack) };
    analysis =
      `You have about ${pct(equity)} equity against a ${inferredRange.summaryLabel}. ` +
      `${inferredRange.actionNotes.join(" ")} ` +
      `No bet to face, so the decision is check or bet.`;
    recommendationText =
      `Our mix: ${mixLabel(probs)}. A reasonable bet size here is ${sizing.bet} (~${Math.round(betFraction * 100)}% pot). ` +
      `${inferredRange.flags.capped ? "Passive lines have capped villain, so value betting improves." : ""}`;
    const blockerText = inferredRange.blockerNotes.map((note) => note.label).join(" ");
    tip = equity > 0.6
      ? `With strong equity you should bet for value. ${blockerText}`.trim()
      : equity > 0.42
        ? `Medium equity is tricky: checking and realizing equity is fine against condensed ranges, while small bets pressure overcards and weak draws. ${blockerText}`.trim()
      : `When you're behind, betting turns your hand into a bluff. It works better when villain is capped or holds many weak showdown hands. ${blockerText}`.trim();
  }

  const derivedSizingKey = sizing.bet
    ? sizingFamilyForAmount(state, sizing.bet, "bet")
    : sizing.raise
      ? sizingFamilyForAmount(state, sizing.raise, "raise")
      : undefined;
  const strategy = lookupStrategyData(spot.key, strategyHandClass, derivedSizingKey);
  const mistakeNote = strategy.spot?.commonMistakes[0];
  const confidenceNote =
    strategy.confidence !== "fallback" ? `Confidence: ${strategy.confidence}. This remains broad heuristic guidance.` : undefined;
  const preferenceLine = strategy.preference
    ? `For ${formatHandClassForCoach(strategyHandClass)}, default actions are ${strategy.preference.preferredActions
        .map(displayAction)
        .join(" or ")}${strategy.preference.fallbackActions.length ? ` with ${strategy.preference.fallbackActions.map(displayAction).join(" or ")} as fallback` : ""}.`
    : undefined;
  const sizingLine = strategy.sizingFamily
    ? `${strategy.sizingFamily.label} sizing fits here because ${strategy.sizingFamily.teachingNote.toLowerCase()}`
    : undefined;

  return {
    phase: "postflop",
    probs,
    sizing,
    spot,
    equity,
    potOdds,
    pot,
    owe,
    oppRange: opponentRange,
    inferredRange,
    texture,
    strategySelection: {
      spotKey: spot.key,
      handClass: strategyHandClass,
      confidence: strategy.confidence,
      sizingFamily: strategy.sizingFamily?.key,
      spotSummary: strategy.spot?.summary,
      preferenceId: strategy.preference?.id
    },
    reasoning: {
      situation: uniqueSentences([
        `Spot: ${spot.label} (${spot.key}${spot.texture ? `, ${spot.texture}` : ""}).`,
        `We're on the ${state.street}. Board: ${cardsStr(board)} (${texture.label || "texture n/a"}).`,
        texture.detail,
        `Pot is ${pot}.`,
        strategy.spot?.summary
      ]),
      hand: `Your hand: ${cardsStr(hole)}. Strategy bucket: ${formatHandClassForCoach(strategyHandClass)}.`,
      analysis: uniqueSentences([
        analysis,
        strategy.spot ? `Strategic objective: ${strategy.spot.objective}` : undefined,
        preferenceLine,
        strategy.preference?.note,
        sizingLine
      ]),
      recommendation: uniqueSentences([
        recommendationText,
        strategy.preference?.caution ? `Caution: ${strategy.preference.caution}` : undefined,
        confidenceNote
      ]),
      tip: uniqueSentences([
        tip,
        mistakeNote ? `Common mistake: ${mistakeNote}` : undefined
      ]),
      mixLabel: mixLabel(probs)
    }
  };
}

export function recommend(state: GameState, actor: Actor): CoachRecommendation | null {
  if (state.handOver) {
    return null;
  }
  return state.street === "preflop" ? preflopRecommendation(state, actor) : postflopRecommendation(state, actor);
}

export function evaluateAction(action: EngineAction, recommendation: CoachRecommendation): CoachEvaluation {
  let probability: number | undefined;
  if (action === "bet" && recommendation.probs.raise !== undefined) probability = recommendation.probs.raise;
  else if (action === "raise" && recommendation.probs.bet !== undefined) probability = recommendation.probs.bet;
  else if (action === "check" && recommendation.probs.call !== undefined && recommendation.probs.check === undefined) probability = recommendation.probs.call;
  else probability = recommendation.probs[action];
  probability = probability ?? 0;

  if (probability >= 0.55) {
    return { verdict: "Solid play.", tone: "good", explanation: "This matches the most common line here.", probability };
  }
  if (probability >= 0.3) {
    return { verdict: "Reasonable.", tone: "good", explanation: "This is a secondary but defensible option.", probability };
  }
  if (probability >= 0.12) {
    return { verdict: "Close - not the top choice.", tone: "mixed", explanation: "Playable, but a different line is usually a touch better.", probability };
  }
  if (probability >= 0.04) {
    return { verdict: "Thin.", tone: "mixed", explanation: "This play exists in a balanced mix but shouldn't be your default here.", probability };
  }
  return { verdict: "Suboptimal.", tone: "bad", explanation: "We'd almost always choose differently in this spot.", probability };
}
