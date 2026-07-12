export interface SeededRng {
  next: () => number;
  nextBetween: (min: number, max: number) => number;
  nextInt: (minInclusive: number, maxExclusive: number) => number;
}

export function createSeededRng(seed: string): SeededRng {
  let state = hashSeed(seed);

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    nextBetween: (min: number, max: number): number => min + next() * (max - min),
    nextInt: (minInclusive: number, maxExclusive: number): number =>
      Math.floor(minInclusive + next() * (maxExclusive - minInclusive)),
  };
}

function hashSeed(seed: string): number {
  let hash = 1779033703 ^ seed.length;

  for (let i = 0; i < seed.length; i += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }

  return hash >>> 0;
}
