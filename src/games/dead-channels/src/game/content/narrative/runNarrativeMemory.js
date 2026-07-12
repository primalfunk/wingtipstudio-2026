export class RunNarrativeMemory {
  constructor() {
    this.locations = [];
    this.relays = [];
    this.catastropheHints = [];
    this.archiveTopics = [];
    this.generatedKeys = [];
  }

  rememberPhrase(entry) {
    for (const tag of entry.locationTags ?? []) {
      this.addUnique(this.locations, tag, 8);
    }
    for (const tag of entry.continuityTags ?? []) {
      if (tag.startsWith('relay')) this.addUnique(this.relays, tag, 6);
      if (tag.startsWith('catastrophe')) this.addUnique(this.catastropheHints, tag, 6);
      if (tag.startsWith('archive')) this.addUnique(this.archiveTopics, tag, 6);
    }
    this.addUnique(this.generatedKeys, entry.text, 12);
  }

  pickRememberedLocation(rng) {
    return rng.pick(this.locations);
  }

  shouldEcho(rng, chance = 0.35) {
    return this.locations.length > 0 && rng.next() < chance;
  }

  addUnique(values, value, limit) {
    if (!value || values.includes(value)) {
      return;
    }
    values.unshift(value);
    values.splice(limit);
  }
}
