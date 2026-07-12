import { Card, Rank } from "./types";
import { RANK_VALUE } from "./deck";

const CATEGORY_NAMES = [
  "high card",
  "pair",
  "two pair",
  "three of a kind",
  "straight",
  "flush",
  "full house",
  "four of a kind",
  "straight flush"
] as const;

export type HandScore = number[];

function findStraight(values: number[]): number {
  const uniqueValues = [...new Set(values)].sort((a, b) => b - a);
  if (uniqueValues.includes(14)) {
    uniqueValues.push(1);
  }
  for (let index = 0; index <= uniqueValues.length - 5; index += 1) {
    if (uniqueValues[index] - uniqueValues[index + 4] === 4) {
      return uniqueValues[index];
    }
  }
  return 0;
}

export function evaluate(cards: Card[]): HandScore {
  const values = cards.map((card) => RANK_VALUE[card[0] as Rank]);
  const counts: Record<number, number> = {};
  for (const value of values) {
    counts[value] = (counts[value] || 0) + 1;
  }

  const bySuit: Record<string, number[]> = { s: [], h: [], d: [], c: [] };
  for (const card of cards) {
    bySuit[card[1]].push(RANK_VALUE[card[0] as Rank]);
  }

  let flushSuit: string | null = null;
  for (const suit of ["s", "h", "d", "c"]) {
    if (bySuit[suit].length >= 5) {
      flushSuit = suit;
      break;
    }
  }

  if (flushSuit) {
    const straightFlushHigh = findStraight(bySuit[flushSuit]);
    if (straightFlushHigh) {
      return [8, straightFlushHigh];
    }
  }

  const groups = Object.keys(counts)
    .map((key) => [Number.parseInt(key, 10), counts[Number.parseInt(key, 10)]] as const)
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return b[0] - a[0];
    });

  const topCount = groups[0][1];
  const secondCount = groups[1]?.[1] ?? 0;

  if (topCount === 4) {
    const quad = groups[0][0];
    const kicker = Math.max(...values.filter((value) => value !== quad));
    return [7, quad, kicker];
  }

  if (topCount === 3 && secondCount >= 2) {
    return [6, groups[0][0], groups[1][0]];
  }

  if (flushSuit) {
    const topFive = [...bySuit[flushSuit]].sort((a, b) => b - a).slice(0, 5);
    return [5, ...topFive];
  }

  const straightHigh = findStraight(values);
  if (straightHigh) {
    return [4, straightHigh];
  }

  if (topCount === 3) {
    const trips = groups[0][0];
    const kickers = values
      .filter((value) => value !== trips)
      .sort((a, b) => b - a)
      .slice(0, 2);
    return [3, trips, ...kickers];
  }

  if (topCount === 2 && secondCount === 2) {
    const highPair = groups[0][0];
    const lowPair = groups[1][0];
    const kicker = Math.max(...values.filter((value) => value !== highPair && value !== lowPair));
    return [2, highPair, lowPair, kicker];
  }

  if (topCount === 2) {
    const pair = groups[0][0];
    const kickers = values
      .filter((value) => value !== pair)
      .sort((a, b) => b - a)
      .slice(0, 3);
    return [1, pair, ...kickers];
  }

  return [0, ...[...values].sort((a, b) => b - a).slice(0, 5)];
}

export function compareHands(left: HandScore, right: HandScore): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index] || 0;
    const rightValue = right[index] || 0;
    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }
  return 0;
}

export function describeHand(score: HandScore): string {
  const category = score[0];
  const rankName = (value: number): string => {
    const map: Record<number, string> = {
      2: "Twos",
      3: "Threes",
      4: "Fours",
      5: "Fives",
      6: "Sixes",
      7: "Sevens",
      8: "Eights",
      9: "Nines",
      10: "Tens",
      11: "Jacks",
      12: "Queens",
      13: "Kings",
      14: "Aces"
    };
    return map[value] || String(value);
  };

  if (category === 8) return "Straight flush";
  if (category === 7) return `Four ${rankName(score[1])}`;
  if (category === 6) return `Full house, ${rankName(score[1])} over ${rankName(score[2])}`;
  if (category === 5) return "Flush";
  if (category === 4) return "Straight";
  if (category === 3) return `Three ${rankName(score[1])}`;
  if (category === 2) return `Two pair, ${rankName(score[1])} and ${rankName(score[2])}`;
  if (category === 1) return `Pair of ${rankName(score[1])}`;
  return `High card ${rankName(score[1])}`;
}

export { CATEGORY_NAMES };
