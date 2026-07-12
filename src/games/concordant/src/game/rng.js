function mulberry32(seed) {
  let t = seed >>> 0;
  return function rng() {
    t += 0x6d2b79f5;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashInts(...values) {
  let hash = 2166136261;
  for (const value of values) {
    let v = value | 0;
    hash ^= v;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRng(seed) {
  return mulberry32(seed);
}

export function randomRange(rng, min, max) {
  return min + (max - min) * rng();
}

export function randomInt(rng, min, maxInclusive) {
  return Math.floor(randomRange(rng, min, maxInclusive + 1));
}

export function pickWeighted(rng, entries) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) {
    return entries[0]?.id ?? null;
  }
  let roll = rng() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.id;
    }
  }
  return entries[entries.length - 1]?.id ?? null;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

