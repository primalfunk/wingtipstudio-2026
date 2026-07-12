import { handLabel, RANK_VALUE } from "../core/deck";
import { evaluate } from "../core/evaluator";
import type { Card, CoachHandClass, GameState, Rank } from "../core/types";
import { handStrengthFromLabel } from "./ranges";

function topBoardRanks(board: Card[]): number[] {
  return [...new Set(board.map((card) => RANK_VALUE[card[0] as Rank]))].sort((a, b) => b - a);
}

function suitCounts(cards: Card[]): Record<string, number> {
  return cards.reduce<Record<string, number>>((counts, card) => {
    counts[card[1]] = (counts[card[1]] || 0) + 1;
    return counts;
  }, {});
}

function rankCounts(cards: Card[]): Record<number, number> {
  return cards.reduce<Record<number, number>>((counts, card) => {
    const value = RANK_VALUE[card[0] as Rank];
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function straightDrawFlags(cards: Card[]): { openEnded: boolean; gutshot: boolean } {
  const values = [...new Set(cards.map((card) => RANK_VALUE[card[0] as Rank]))].sort((a, b) => a - b);
  if (values.includes(14)) {
    values.unshift(1);
  }
  let openEnded = false;
  let gutshot = false;
  for (let high = 14; high >= 5; high -= 1) {
    const run = [high - 4, high - 3, high - 2, high - 1, high];
    const present = run.filter((value) => values.includes(value));
    if (present.length === 4) {
      const missing = run.find((value) => !values.includes(value));
      if (missing === run[0] || missing === run[4]) openEnded = true;
      else gutshot = true;
    }
  }
  return { openEnded, gutshot };
}

function classifyPreflop(hole: Card[]): CoachHandClass {
  const strength = handStrengthFromLabel(handLabel(hole[0], hole[1]));
  if (strength >= 11) return "premium_value";
  if (strength >= 8) return "strong_value";
  if (strength >= 5) return "medium_showdown";
  if (strength >= 3) return "weak_showdown";
  return "air";
}

function classifyPairLike(hole: Card[], board: Card[], category: number): CoachHandClass | null {
  if (category !== 1 && category !== 2 && category !== 3) {
    return null;
  }

  const allCards = [...hole, ...board];
  const boardRanks = topBoardRanks(board);
  const counts = rankCounts(allCards);
  const holeRanks = hole.map((card) => RANK_VALUE[card[0] as Rank]).sort((a, b) => b - a);
  const pairRanks = Object.entries(counts)
    .filter(([, count]) => count >= 2)
    .map(([value]) => Number(value))
    .sort((a, b) => b - a);
  const topPair = pairRanks[0] ?? 0;
  const secondBoard = boardRanks[1] ?? boardRanks[0] ?? 0;
  const topBoard = boardRanks[0] ?? 0;
  const pocketPair = holeRanks[0] === holeRanks[1];

  if (category >= 3) return "strong_value";
  if (category === 2) return topPair >= topBoard && (pairRanks[1] ?? 0) >= secondBoard ? "strong_value" : "medium_showdown";
  if (pocketPair && holeRanks[0] > topBoard) return "strong_value";
  if (topPair >= topBoard) {
    return holeRanks[0] >= 12 || pocketPair ? "top_pair_good_kicker" : "medium_showdown";
  }
  if (topPair >= secondBoard) return "medium_showdown";
  return "weak_showdown";
}

export function classifyHeroHandForStrategy(state: GameState, actor: "hero" | "bot"): CoachHandClass {
  const hole = actor === "hero" ? state.heroHole : state.botHole;
  if (!hole.length) return "air";
  if (state.street === "preflop" || !state.board.length) {
    return classifyPreflop(hole);
  }

  const allCards = [...hole, ...state.board];
  const score = evaluate(allCards);
  const category = score[0];
  if (category >= 6) return "premium_value";
  if (category === 5 || category === 4) return "strong_value";

  const suits = suitCounts(allCards);
  const flushDraw = state.board.length < 5 && Object.values(suits).some((count) => count === 4);
  const straightDraw = state.board.length < 5 ? straightDrawFlags(allCards) : { openEnded: false, gutshot: false };
  const pairLike = classifyPairLike(hole, state.board, category);

  if (pairLike) {
    if (state.street === "river" && state.toAct === actor && (pairLike === "medium_showdown" || pairLike === "weak_showdown")) {
      return "bluffcatcher";
    }
    if (pairLike === "weak_showdown" && (flushDraw || straightDraw.openEnded)) {
      return "strong_draw";
    }
    return pairLike;
  }

  if (flushDraw || straightDraw.openEnded) return "strong_draw";
  if (straightDraw.gutshot) return "weak_draw";
  return "air";
}
