import { Card, RANKS, Rank, SUITS } from "./types";

export const RANK_VALUE: Record<Rank, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14
};

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push(`${rank}${suit}`);
    }
  }
  return deck;
}

export function shuffle(cards: Card[]): Card[] {
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [cards[index], cards[swapIndex]] = [cards[swapIndex], cards[index]];
  }
  return cards;
}

export function handLabel(cardA: Card, cardB: Card): string {
  const rankA = cardA[0] as Rank;
  const suitA = cardA[1];
  const rankB = cardB[0] as Rank;
  const suitB = cardB[1];
  const valueA = RANK_VALUE[rankA];
  const valueB = RANK_VALUE[rankB];
  const [high, low] = valueA >= valueB ? [rankA, rankB] : [rankB, rankA];
  if (rankA === rankB) {
    return `${high}${low}`;
  }
  return `${high}${low}${suitA === suitB ? "s" : "o"}`;
}
