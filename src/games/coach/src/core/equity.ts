import { Card } from "./types";
import { createDeck } from "./deck";
import { compareHands, evaluate } from "./evaluator";

export function equityVsRange(hero: Card[], board: Card[], rangeCombos: Array<[Card, Card]>, iterations = 1500): number {
  if (!rangeCombos.length) {
    return 0.5;
  }

  const deadCards = new Set([...hero, ...board]);
  const usableRange = rangeCombos.filter(([cardA, cardB]) => !deadCards.has(cardA) && !deadCards.has(cardB));
  if (!usableRange.length) {
    return 0.5;
  }

  const fullDeck = createDeck();
  let wins = 0;
  let ties = 0;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const opponent = usableRange[(Math.random() * usableRange.length) | 0];
    const blockedCards = new Set(deadCards);
    blockedCards.add(opponent[0]);
    blockedCards.add(opponent[1]);

    const remainingDeck = fullDeck.filter((card) => !blockedCards.has(card));
    const neededCards = 5 - board.length;
    const runout = [...board];

    for (let count = 0; count < neededCards; count += 1) {
      const drawIndex = (Math.random() * remainingDeck.length) | 0;
      runout.push(remainingDeck[drawIndex]);
      remainingDeck[drawIndex] = remainingDeck[remainingDeck.length - 1];
      remainingDeck.pop();
    }

    const heroScore = evaluate([...hero, ...runout]);
    const opponentScore = evaluate([...opponent, ...runout]);
    const comparison = compareHands(heroScore, opponentScore);

    if (comparison > 0) {
      wins += 1;
    } else if (comparison === 0) {
      ties += 1;
    }
  }

  return (wins + ties / 2) / iterations;
}
