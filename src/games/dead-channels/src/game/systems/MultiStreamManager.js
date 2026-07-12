import { streamConfig } from '../config/streams.js';
import { StreamInstance, STREAM_INSTANCE_STATE } from './StreamInstance.js';

export class MultiStreamManager {
  constructor({ rng, config = streamConfig, contentSelector = null }) {
    this.rng = rng;
    this.config = config;
    this.contentSelector = contentSelector;
    this.streams = [];
    this.focusedIndex = 0;
    this.nextId = 1;
    this.secondaryElapsedMs = 0;
    this.switchCount = 0;
  }

  start({ speed, encounterIndex = 0 }) {
    this.reset();
    this.encounterIndex = encounterIndex;
    this.spawnPrimary(speed);
  }

  reset() {
    this.streams = [];
    this.focusedIndex = 0;
    this.secondaryElapsedMs = 0;
  }

  update(deltaMs, speedMultiplier = 1, baseSpeed = 115) {
    const results = [];
    this.secondaryElapsedMs += deltaMs;

    if (this.secondaryElapsedMs >= this.config.secondaryStreamSpawnDelayMs && this.streams.length < this.config.maxActiveStreams) {
      this.spawnSecondary(baseSpeed);
      this.secondaryElapsedMs = 0;
    }

    for (const stream of this.streams) {
      stream.update(deltaMs, speedMultiplier);

      if (stream.state === STREAM_INSTANCE_STATE.MISSED) {
        results.push({ outcome: 'missed', stream });
      }
    }

    return results;
  }

  processCharacter(character) {
    const stream = this.getFocusedStream();
    if (!stream) {
      return { accepted: false, correct: false, completed: false };
    }

    const result = stream.processCharacter(character);
    if (result.completed) {
      return { ...result, stream, outcome: 'completed' };
    }

    return { ...result, stream };
  }

  backspace() {
    return this.getFocusedStream()?.backspace() ?? false;
  }

  cycleFocus(direction = 1) {
    if (this.streams.length <= 1) {
      return null;
    }

    this.focusedIndex = (this.focusedIndex + direction + this.streams.length) % this.streams.length;
    this.switchCount += 1;
    return this.getFocusedStream();
  }

  resolveStream(streamId) {
    const stream = this.streams.find((candidate) => candidate.id === streamId);
    if (stream) {
      stream.markResolved();
    }

    this.streams = this.streams.filter((candidate) => candidate.id !== streamId);
    this.focusedIndex = Math.min(this.focusedIndex, Math.max(0, this.streams.length - 1));
  }

  spawnPrimary(speed, prefixCount = 0) {
    if (this.streams.some((stream) => stream.role === 'primary') || this.streams.length >= this.config.maxActiveStreams) {
      return null;
    }

    const stream = this.createStream({
      role: 'primary',
      phrase: this.pickPrimaryPhrase(),
      lane: 'primary',
      speed
    });
    this.applyPrefix(stream, prefixCount);
    this.streams.push(stream);
    this.focusedIndex = this.streams.findIndex((candidate) => candidate.id === stream.id);
    return stream;
  }

  spawnSecondary(speed, prefixCount = 0) {
    const secondaryCount = this.streams.filter((stream) => stream.role !== 'primary').length;
    if (this.streams.length >= this.config.maxActiveStreams || secondaryCount >= this.config.maxActiveStreams - 1) {
      return null;
    }

    const role = this.pickSecondaryRole();
    const stream = this.createStream({
      role,
      phrase: this.pickRolePhrase(role),
      lane: 'secondary',
      speed: speed * (role === 'archive' ? 0.9 : 1)
    });
    this.applyPrefix(stream, prefixCount);
    this.streams.push(stream);
    return stream;
  }

  createStream({ role, phrase, lane, speed }) {
    const lanePosition = this.config.streamLanePositions[lane];
    return new StreamInstance({
      id: `stream-${this.nextId++}`,
      role,
      phrase: typeof phrase === 'string' ? phrase : phrase.text,
      contentEntry: typeof phrase === 'string' ? null : phrase,
      difficulty: typeof phrase === 'string' ? (role === 'archive' ? 3 : role === 'hazard' ? 2 : 1) : phrase.difficulty,
      priority: role === 'primary' ? 10 : 4,
      x: lanePosition.x,
      y: lanePosition.y,
      speed,
      failureZoneX: 150,
      rewards: this.config.streamRoleRewards[role],
      penalties: this.config.streamRolePenalties[role]
    });
  }

  getFocusedStream() {
    return this.streams[this.focusedIndex] ?? null;
  }

  getDebugInfo() {
    const focused = this.getFocusedStream();
    return {
      active: this.streams.length > 0,
      activeStreamCount: this.streams.length,
      focusedStreamId: focused?.id ?? '(none)',
      focusedStreamRole: focused?.role ?? '(none)',
      streams: this.streams.map((stream) => stream.getDebugInfo()),
      forksSuppressed: !this.config.allowForksDuringMultiStream,
      switchCount: this.switchCount
    };
  }

  pickPrimaryPhrase() {
    if (this.contentSelector) {
      return this.contentSelector.getStreamPhrase('primary', { encounterIndex: this.encounterIndex ?? 0 });
    }

    return 'follow the quiet channel';
  }

  pickRolePhrase(role) {
    if (this.contentSelector) {
      return this.contentSelector.getStreamPhrase(role, { encounterIndex: this.encounterIndex ?? 0 });
    }

    if (role === 'hazard') return 'suppress static bloom';
    if (role === 'repair') return 'repair the pulse line';
    if (role === 'reward') return 'capture the bright packet';
    return 'read the silent witness';
  }

  pickSecondaryRole() {
    const total = Object.values(this.config.streamRoleWeights).reduce((sum, weight) => sum + weight, 0);
    let roll = this.rng.range(0, total);

    for (const [role, weight] of Object.entries(this.config.streamRoleWeights)) {
      roll -= weight;
      if (roll <= 0) {
        return role;
      }
    }

    return 'hazard';
  }

  applyPrefix(stream, prefixCount) {
    const count = Math.min(prefixCount, Math.max(0, stream.phrase.length - 1));
    for (let index = 0; index < count; index += 1) {
      stream.processCharacter(stream.phrase[index]);
    }
  }
}
