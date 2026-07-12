export class SeededRng {
  constructor(seed = Date.now()) {
    this.state = SeededRng.hashSeed(seed);
  }

  static hashSeed(seed) {
    const seedText = String(seed);
    let hash = 2166136261;

    for (let index = 0; index < seedText.length; index += 1) {
      hash ^= seedText.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0 || 1;
  }

  next() {
    this.state += 0x6d2b79f5;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  pick(array) {
    if (!array.length) {
      return undefined;
    }

    return array[this.int(0, array.length - 1)];
  }
}
