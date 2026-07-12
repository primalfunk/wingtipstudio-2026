import { RANKS, SUITS, type Card, type Rank } from "../core/types";
import { RANK_VALUE, handLabel } from "../core/deck";

export function handStrengthFromLabel(label: string): number {
  const rankA = label[0] as Rank;
  const rankB = label[1] as Rank;
  const valueA = RANK_VALUE[rankA];
  const valueB = RANK_VALUE[rankB];
  const high = Math.max(valueA, valueB);
  const low = Math.min(valueA, valueB);
  const pair = valueA === valueB;
  const suited = !pair && label[2] === "s";

  let score = high === 14 ? 10 : high === 13 ? 8 : high === 12 ? 7 : high === 11 ? 6 : high / 2;

  if (pair) {
    score = Math.max(score * 2, 5);
  }
  if (suited) {
    score += 2;
  }

  if (!pair) {
    const gap = high - low - 1;
    if (gap === 1) score -= 1;
    else if (gap === 2) score -= 2;
    else if (gap === 3) score -= 4;
    else if (gap >= 4) score -= 5;

    if (gap <= 1 && high <= 11) score += 1;
    if (suited && high === 14) score += 1.5;
  }

  return Math.round(score * 10) / 10;
}

export function handStrength(hole: Card[]): number {
  return handStrengthFromLabel(handLabel(hole[0], hole[1]));
}

export function expandLabel(label: string): Array<[Card, Card]> {
  const rankA = label[0] as Rank;
  const rankB = label[1] as Rank;
  const combos: Array<[Card, Card]> = [];

  if (rankA === rankB) {
    for (let first = 0; first < SUITS.length; first += 1) {
      for (let second = first + 1; second < SUITS.length; second += 1) {
        combos.push([`${rankA}${SUITS[first]}`, `${rankB}${SUITS[second]}`]);
      }
    }
    return combos;
  }

  if (label[2] === "s") {
    for (const suit of SUITS) {
      combos.push([`${rankA}${suit}`, `${rankB}${suit}`]);
    }
    return combos;
  }

  for (const suitA of SUITS) {
    for (const suitB of SUITS) {
      if (suitA !== suitB) {
        combos.push([`${rankA}${suitA}`, `${rankB}${suitB}`]);
      }
    }
  }

  return combos;
}

export function labelsToCombos(labels: string[]): Array<[Card, Card]> {
  return labels.flatMap((label) => expandLabel(label));
}

export function allHandLabels(): string[] {
  const labels: string[] = [];
  for (let index = RANKS.length - 1; index >= 0; index -= 1) {
    labels.push(`${RANKS[index]}${RANKS[index]}`);
  }
  for (let high = RANKS.length - 1; high >= 0; high -= 1) {
    for (let low = high - 1; low >= 0; low -= 1) {
      labels.push(`${RANKS[high]}${RANKS[low]}s`);
      labels.push(`${RANKS[high]}${RANKS[low]}o`);
    }
  }
  return labels;
}

const ALL_LABELS = allHandLabels();

function labelsWithStrengthAtLeast(threshold: number): string[] {
  return ALL_LABELS.filter((label) => handStrengthFromLabel(label) >= threshold);
}

function labelsInStrengthRange(minimum: number, maximum: number): string[] {
  return ALL_LABELS.filter((label) => {
    const score = handStrengthFromLabel(label);
    return score >= minimum && score < maximum;
  });
}

export function sbOpenLabels(): string[] {
  return labelsWithStrengthAtLeast(4);
}

export function bbThreeBetLabels(): string[] {
  return labelsWithStrengthAtLeast(9);
}

export function bbCallLabels(): string[] {
  return labelsInStrengthRange(4, 9);
}

export function describeHandClass(hole: Card[]): string {
  const label = handLabel(hole[0], hole[1]);
  const rankA = label[0] as Rank;
  const rankB = label[1] as Rank;
  const valueA = RANK_VALUE[rankA];
  const valueB = RANK_VALUE[rankB];
  const high = Math.max(valueA, valueB);
  const low = Math.min(valueA, valueB);
  const pair = valueA === valueB;
  const suited = !pair && label[2] === "s";

  const rankName: Record<number, string> = {
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

  if (pair) {
    if (high >= 13) return `pocket ${rankName[high]} (premium pair)`;
    if (high >= 10) return `pocket ${rankName[high]} (strong pair)`;
    if (high >= 7) return `pocket ${rankName[high]} (mid pair)`;
    return `small pocket pair (${rankName[high]})`;
  }

  const suffix = suited ? "suited" : "offsuit";
  if (high === 14) {
    if (low >= 11) return `big ace ${suffix} (${rankA}${rankB}${suffix[0]})`;
    if (suited) return `suited ace (A${rankB}s)`;
    return `weak offsuit ace (A${rankB}o)`;
  }
  if (high >= 12 && low >= 10) return `broadway ${suffix}`;
  const gap = high - low - 1;
  if (gap === 0 && suited) return `suited connector (${rankA}${rankB}s)`;
  if (gap === 0) return `offsuit connector (${rankA}${rankB}o)`;
  if (gap <= 2 && suited) return `suited gapper (${rankA}${rankB}s)`;
  return `unconnected ${suffix}`;
}
