import { hazardConfig, HAZARD_TYPES } from '../config/hazards.js';

export class CognitiveDebtManager {
  constructor({ rng, config = hazardConfig }) {
    this.rng = rng;
    this.config = config;
    this.activeHazards = [];
    this.elapsedMs = 0;
    this.passiveCheckElapsedMs = 0;
    this.lastHazardTriggerSource = '';
    this.hazardId = 0;
  }

  update(deltaMs, context) {
    this.elapsedMs += deltaMs;
    this.passiveCheckElapsedMs += deltaMs;
    const before = this.activeHazards.length;
    this.activeHazards = this.activeHazards.filter((hazard) => hazard.expiresAt > this.elapsedMs);
    const cleared = before - this.activeHazards.length;

    const triggered = [];

    if (this.passiveCheckElapsedMs >= this.config.passiveCheckIntervalMs) {
      this.passiveCheckElapsedMs = 0;
      const passiveHazard = this.maybeTriggerPassiveHazard(context);
      if (passiveHazard) {
        triggered.push(passiveHazard);
      }
    }

    return { cleared, triggered };
  }

  reset() {
    this.activeHazards = [];
    this.elapsedMs = 0;
    this.passiveCheckElapsedMs = 0;
    this.lastHazardTriggerSource = '';
  }

  onWrongKey(context) {
    const triggered = [];

    if (this.roll('wrongKeyStaticBloom', context)) {
      triggered.push(this.addHazard(HAZARD_TYPES.STATIC_BLOOM, context, 'wrongKey'));
    }

    if (this.getBand(context.instability).key !== 'stable' && this.roll('wrongKeyJitter', context)) {
      triggered.push(this.addHazard(HAZARD_TYPES.LETTER_JITTER, context, 'wrongKey'));
    }

    return triggered;
  }

  onPhraseMissed(context) {
    const triggered = [this.addHazard(HAZARD_TYPES.STATIC_BLOOM, context, 'phraseMissed')];

    if (this.roll('missedGhostText', context)) {
      triggered.push(this.addHazard(HAZARD_TYPES.GHOST_TEXT, context, 'phraseMissed'));
    }

    if (this.roll('missedReducedPreview', context)) {
      triggered.push(this.addHazard(HAZARD_TYPES.REDUCED_PREVIEW, context, 'phraseMissed'));
    }

    return triggered;
  }

  onImperfectPhraseCompleted(context) {
    if (!this.roll('riskyRouteCorruptedHint', context)) {
      return [];
    }

    return [this.addHazard(HAZARD_TYPES.CORRUPTED_HINT, context, 'imperfectPhraseCompleted')];
  }

  onRouteResolved({ branch, outcome, context }) {
    const triggered = [];
    const mistakes = branch.validator?.mistakeCount ?? 0;
    const routeType = branch.routeType;
    let instabilityDelta = 0;
    let clearCount = 0;

    if (outcome === 'completed' && routeType === 'safe') {
      instabilityDelta += this.config.routeInstabilityModifiers.safeComplete;
    }

    if (outcome === 'completed' && routeType === 'repair') {
      instabilityDelta += this.config.routeInstabilityModifiers.repairComplete;
      clearCount += 1;
    }

    if (outcome === 'completed' && routeType === 'archive' && mistakes > 0) {
      instabilityDelta += this.config.routeInstabilityModifiers.archiveImperfect;
    }

    if (outcome === 'completed' && routeType === 'corruption' && mistakes > 0) {
      instabilityDelta += this.config.routeInstabilityModifiers.corruptionImperfect;
      if (this.roll('riskyRouteCorruptedHint', context)) {
        triggered.push(this.addHazard(HAZARD_TYPES.CORRUPTED_HINT, context, 'corruptionRouteImperfect'));
      }
    }

    if (outcome === 'missed' && routeType === 'corruption') {
      instabilityDelta += this.config.routeInstabilityModifiers.corruptionMiss;
      triggered.push(this.addHazard(HAZARD_TYPES.GHOST_TEXT, context, 'corruptionRouteMiss'));
      triggered.push(this.addHazard(HAZARD_TYPES.LETTER_JITTER, context, 'corruptionRouteMiss'));
    }

    if (outcome === 'completed' && ['reward', 'archive', 'corruption'].includes(routeType) && mistakes > 0) {
      if (this.roll('riskyRouteCorruptedHint', context)) {
        triggered.push(this.addHazard(HAZARD_TYPES.CORRUPTED_HINT, context, `${routeType}RouteImperfect`));
      }
    }

    return { instabilityDelta, clearCount, triggered };
  }

  clearHazards(count = 1) {
    const cleared = this.activeHazards.splice(0, count);
    return cleared.length;
  }

  clearAll() {
    const cleared = this.activeHazards.length;
    this.activeHazards = [];
    return cleared;
  }

  getBand(instability) {
    return this.config.instabilityBands.find((band) => instability >= band.min && instability <= band.max)
      ?? this.config.instabilityBands[this.config.instabilityBands.length - 1];
  }

  getActiveHazards(type) {
    if (!type) {
      return this.activeHazards;
    }

    return this.activeHazards.filter((hazard) => hazard.type === type);
  }

  hasHazard(type) {
    return this.activeHazards.some((hazard) => hazard.type === type);
  }

  getReducedPreviewOffset(instability) {
    const reducedPreviewHazards = this.getActiveHazards(HAZARD_TYPES.REDUCED_PREVIEW);
    if (!reducedPreviewHazards.length) {
      return 0;
    }

    const band = this.getBand(instability);
    return Math.round((this.config.reducedPreviewValues[band.key] ?? 0) * this.getStrongestIntensity(HAZARD_TYPES.REDUCED_PREVIEW));
  }

  getRenderState(instability) {
    return {
      band: this.getBand(instability),
      hazards: this.activeHazards.map((hazard) => ({ ...hazard })),
      letterJitterIntensity: this.getStrongestIntensity(HAZARD_TYPES.LETTER_JITTER),
      ghostTextIntensity: this.getStrongestIntensity(HAZARD_TYPES.GHOST_TEXT),
      corruptedHintIntensity: this.getStrongestIntensity(HAZARD_TYPES.CORRUPTED_HINT),
      reducedPreviewOffset: this.getReducedPreviewOffset(instability)
    };
  }

  getDebugInfo(instability) {
    const band = this.getBand(instability);
    return {
      bandLabel: band.label,
      activeHazardCount: this.activeHazards.length,
      activeHazardTypes: this.activeHazards.map((hazard) => hazard.type).join(', ') || '(none)',
      hazardDurations: this.activeHazards
        .map((hazard) => `${hazard.type}:${Math.max(0, Math.ceil((hazard.expiresAt - this.elapsedMs) / 1000))}s`)
        .join(', ') || '(none)',
      reducedPreviewOffset: this.getReducedPreviewOffset(instability),
      lastHazardTriggerSource: this.lastHazardTriggerSource || '(none)',
      bandHazardChance: band.hazardChance
    };
  }

  maybeTriggerPassiveHazard(context) {
    const band = this.getBand(context.instability);
    if (band.key === 'stable') {
      return null;
    }

    if (!this.roll('passiveMinorHazard', context)) {
      return null;
    }

    return this.addHazard(
      this.rng.next() > 0.5 ? HAZARD_TYPES.LETTER_JITTER : HAZARD_TYPES.CORRUPTED_HINT,
      context,
      'passiveInstability'
    );
  }

  addHazard(type, context, source) {
    const band = this.getBand(context.instability);
    const duration = Math.round(
      this.config.hazardDurations[type]
      * band.durationMultiplier
      * (context.hazardDurationMultiplier ?? 1)
    );
    const hazard = {
      id: `hazard-${this.hazardId++}`,
      type,
      durationMs: duration,
      intensity: band.visualIntensity * (context.encounterMultiplier ?? 1),
      startedAt: this.elapsedMs,
      expiresAt: this.elapsedMs + duration,
      source
    };

    this.activeHazards.push(hazard);
    this.lastHazardTriggerSource = source;
    return hazard;
  }

  roll(chanceKey, context) {
    const band = this.getBand(context.instability);
    const eventChance = this.config.eventTriggerChances[chanceKey] ?? band.hazardChance;
    const encounterMultiplier = context.encounterMultiplier ?? 1;
    return this.rng.next() < Math.min(0.9, eventChance * encounterMultiplier * band.gameplayPenaltyMultiplier);
  }

  getStrongestIntensity(type) {
    return this.getActiveHazards(type).reduce((max, hazard) => Math.max(max, hazard.intensity), 0);
  }
}
