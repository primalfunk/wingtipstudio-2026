export class AiPlayerMetrics {
  constructor(scene, config = {}) {
    this.scene = scene;
    this.seed = scene.seed;
    this.strategy = config.strategy ?? 'STANDARD_TESTER';
    this.startedAt = scene.time.now;
    this.result = 'running';
    this.events = [];
    this.lastDeckId = scene.currentDeck?.id ?? null;
    this.lastDeaths = scene.runStats.totalDeaths ?? 0;
    this.captureAttempts = 0;
    this.captureSuccesses = 0;
    this.captureFailures = 0;
    this.liftUses = 0;
    this.stuckEvents = 0;
    this.pathFailures = 0;
    this.roomsVisited = new Set();
    this.decksVisited = new Set([this.lastDeckId].filter(Boolean));
    this.highestBody = scene.player?.bodyData?.rank ?? 1;
    this.log('run_start', { strategy: this.strategy });
  }

  update() {
    const deckId = this.scene.currentDeck?.id;
    if (deckId && deckId !== this.lastDeckId) {
      this.decksVisited.add(deckId);
      this.lastDeckId = deckId;
      this.liftUses += 1;
      this.log('deck_entered', { deckId });
    }
    const roomId = this.scene.currentRoom?.id;
    if (roomId) {
      this.roomsVisited.add(`${deckId}:${roomId}`);
    }
    const deaths = this.scene.runStats.totalDeaths ?? 0;
    if (deaths > this.lastDeaths) {
      this.log('player_death', { deaths });
      this.lastDeaths = deaths;
    }
    this.highestBody = Math.max(this.highestBody, this.scene.player?.bodyData?.rank ?? 1);
  }

  log(eventType, details = {}) {
    this.events.push({
      time: Math.round(this.scene.time.now - this.startedAt),
      deckId: this.scene.currentDeck?.id ?? null,
      roomId: this.scene.currentRoom?.id ?? null,
      playerBody: this.scene.player?.bodyData?.displayId ?? null,
      eventType,
      details
    });
  }

  markCaptureAttempt(target) {
    this.captureAttempts += 1;
    this.log('capture_attempt', { target: target?.data?.displayId });
  }

  markStuck(details = {}) {
    this.stuckEvents += 1;
    this.log('stuck_detected', details);
  }

  markPathFailure(details = {}) {
    this.pathFailures += 1;
    this.log('path_failure', details);
  }

  finish(result, reason = '') {
    if (this.result !== 'running') {
      return;
    }
    this.result = result;
    this.reason = reason;
    this.log(result === 'cleared' ? 'ship_cleared' : 'run_finished', { result, reason });
  }

  toJSON() {
    const runStats = this.scene.runStats;
    return {
      seed: this.seed,
      strategy: this.strategy,
      result: this.result,
      reason: this.reason ?? '',
      runtimeMs: Math.round(this.scene.time.now - this.startedAt),
      decksVisited: this.decksVisited.size,
      totalDecks: this.scene.ship?.decks?.length ?? 0,
      roomsVisited: this.roomsVisited.size,
      score: runStats.score,
      deaths: runStats.totalDeaths,
      deckResets: runStats.deckResetCountByDeck,
      droidsNeutralized: runStats.droidsNeutralized,
      totalDroids: runStats.totalDroids,
      capturesAttempted: runStats.transfersAttempted,
      capturesSucceeded: runStats.transfersSucceeded,
      capturesFailed: runStats.transfersFailed,
      highestBody: this.highestBody,
      highestBodyCaptured: runStats.highestRankPossessed,
      highestBodyKilled: runStats.highestRankNeutralized,
      liftUses: this.liftUses,
      stuckEvents: this.stuckEvents,
      pathFailures: this.pathFailures,
      currentDeckId: this.scene.currentDeck?.id ?? null,
      finalBody: this.scene.player?.bodyData?.displayId ?? null,
      remainingHostiles: this.scene.getShipHostileCount?.() ?? null,
      events: this.events
    };
  }
}
