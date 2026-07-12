import { powerupConfig } from '../config/powerups.js';
import { powerupDefinitions } from '../content/powerups.js';

export class PowerupManager {
  constructor({ rng, config = powerupConfig, definitions = powerupDefinitions }) {
    this.rng = rng;
    this.config = config;
    this.definitions = definitions;
    this.acquired = [];
    this.activeSlots = [];
    this.passives = [];
    this.activeEffects = new Map();
    this.cooldowns = new Map();
    this.rewardChoices = [];
    this.compressionPending = false;
    this.nextForkSplit = false;
    this.notification = '';
    this.stats = {
      acquired: 0,
      activated: 0,
      mistakesForgiven: 0,
      compressionTriggers: 0,
      signalAnchorTriggers: 0,
      overclockUses: 0,
      overclockTimeMs: 0,
      forkSplitterUses: 0,
      forkSplitterBranchesCreated: 0
    };
  }

  update(deltaMs) {
    for (const [id, remaining] of this.cooldowns.entries()) {
      this.cooldowns.set(id, Math.max(0, remaining - deltaMs));
    }

    for (const [id, effect] of this.activeEffects.entries()) {
      effect.remainingMs -= deltaMs;
      if (id === 'overclock') {
        this.stats.overclockTimeMs += deltaMs;
      }

      if (effect.remainingMs <= 0 || effect.charges === 0) {
        if (id === 'fork-splitter') {
          this.nextForkSplit = false;
        }
        this.activeEffects.delete(id);
      }
    }
  }

  generateRewardChoices() {
    const ownedIds = new Set(this.acquired.map((powerup) => powerup.id));
    const choices = [];
    const available = this.definitions.filter((definition) => !ownedIds.has(definition.id));

    while (choices.length < this.config.rewardChoicesCount && available.length > 0) {
      const rarity = this.pickRarity();
      const rarityPool = available.filter((definition) => definition.rarity === rarity);
      const pool = rarityPool.length ? rarityPool : available;
      const choice = this.rng.pick(pool);
      choices.push(choice);
      available.splice(available.indexOf(choice), 1);
    }

    this.rewardChoices = choices;
    return choices;
  }

  acquire(powerupId) {
    const definition = this.definitions.find((powerup) => powerup.id === powerupId);
    if (!definition || this.acquired.some((powerup) => powerup.id === powerupId)) {
      return null;
    }

    this.acquired.push(definition);
    this.stats.acquired += 1;
    this.notification = `Acquired ${definition.name}`;

    if (definition.type === 'active' && this.activeSlots.length < this.config.activeSlotCount) {
      this.activeSlots.push(definition);
    } else if (definition.type !== 'active') {
      this.passives.push(definition);
    }

    this.rewardChoices = [];
    return definition;
  }

  activateSlot(slotIndex) {
    const definition = this.activeSlots[slotIndex];
    if (!definition || this.getCooldownMs(definition.id) > 0 || this.activeEffects.has(definition.id)) {
      return null;
    }

    const durationMs = definition.effect.durationMs ?? 0;
    this.activeEffects.set(definition.id, {
      id: definition.id,
      remainingMs: durationMs,
      durationMs,
      charges: definition.effect.mistakeForgiveness ?? null
    });
    this.cooldowns.set(definition.id, definition.effect.cooldownMs ?? 0);
    this.stats.activated += 1;
    this.notification = `${definition.name} active`;

    if (definition.id === 'overclock') {
      this.stats.overclockUses += 1;
    }

    if (definition.id === 'fork-splitter') {
      this.nextForkSplit = true;
      this.stats.forkSplitterUses += 1;
    }

    return definition;
  }

  hasPowerup(id) {
    return this.acquired.some((powerup) => powerup.id === id);
  }

  hasActiveEffect(id) {
    return this.activeEffects.has(id);
  }

  extendActiveEffect(id, durationMs) {
    const effect = this.activeEffects.get(id);
    if (!effect || durationMs <= 0) {
      return false;
    }

    effect.remainingMs += durationMs;
    effect.durationMs += durationMs;
    this.notification = `${this.getDefinition(id)?.name ?? id} extended`;
    return true;
  }

  forgiveMistake() {
    const stabilizer = this.activeEffects.get('stabilizer');
    if (!stabilizer || stabilizer.charges <= 0) {
      return false;
    }

    stabilizer.charges -= 1;
    this.stats.mistakesForgiven += 1;
    this.notification = `Stabilizer absorbed error`;
    return true;
  }

  getWrongKeyInstabilityMultiplier() {
    return this.hasActiveEffect('echo-buffer') ? 0.5 : 1;
  }

  getMissInstabilityMultiplier() {
    return this.hasActiveEffect('echo-buffer') ? 0.5 : 1;
  }

  getSpeedMultiplier() {
    return this.hasActiveEffect('overclock') ? this.config.overclockSpeedMultiplier : 1;
  }

  getScoreMultiplier() {
    return this.hasActiveEffect('overclock') ? this.config.overclockScoreMultiplier : 1;
  }

  getOverclockInstabilityPerSecond() {
    return this.hasActiveEffect('overclock') ? this.config.overclockInstabilityPerSecond : 0;
  }

  onPhraseCompleted({ perfect, textLength }) {
    let instabilityReduction = 0;

    if (this.hasPowerup('compression') && perfect) {
      this.compressionPending = true;
      this.stats.compressionTriggers += 1;
      this.notification = 'Compression primed';
    }

    if (this.hasPowerup('signal-anchor') && perfect && textLength >= this.config.signalAnchorHardPhraseLength) {
      instabilityReduction += this.getDefinition('signal-anchor').effect.hardPhraseInstabilityReduction;
      this.stats.signalAnchorTriggers += 1;
      this.notification = 'Signal Anchor stabilized stream';
    }

    return { instabilityReduction };
  }

  onRouteCompleted({ routeType, perfect }) {
    if (!this.hasPowerup('signal-anchor') || !perfect || !['reward', 'archive', 'corruption'].includes(routeType)) {
      return { instabilityReduction: 0 };
    }

    this.stats.signalAnchorTriggers += 1;
    this.notification = 'Signal Anchor locked route';
    return {
      instabilityReduction: this.getDefinition('signal-anchor').effect.riskyRouteInstabilityReduction
    };
  }

  consumeCompressionPrefix() {
    if (!this.compressionPending) {
      return 0;
    }

    this.compressionPending = false;
    return this.getDefinition('compression')?.effect.prefixCharacters ?? this.config.compressionPrefixCharacters;
  }

  consumeForkSplitter() {
    if (!this.nextForkSplit) {
      return 0;
    }

    this.nextForkSplit = false;
    this.stats.forkSplitterBranchesCreated += 1;
    return 1;
  }

  getForkTelegraphBonusMs() {
    return this.hasPowerup('preview') ? this.getDefinition('preview').effect.forkTelegraphBonusMs : 0;
  }

  getCooldownMs(id) {
    return this.cooldowns.get(id) ?? 0;
  }

  getDefinition(id) {
    return this.definitions.find((definition) => definition.id === id);
  }

  getHudLines() {
    const slotLines = [];
    for (let index = 0; index < this.config.activeSlotCount; index += 1) {
      const powerup = this.activeSlots[index];
      if (!powerup) {
        slotLines.push(`[${index + 1}] Empty`);
        continue;
      }

      const active = this.activeEffects.get(powerup.id);
      const cooldownSeconds = Math.ceil(this.getCooldownMs(powerup.id) / 1000);
      if (active) {
        slotLines.push(`[${index + 1}] ${powerup.name} ${Math.ceil(active.remainingMs / 1000)}s`);
      } else if (cooldownSeconds > 0) {
        slotLines.push(`[${index + 1}] ${powerup.name} CD ${cooldownSeconds}s`);
      } else {
        slotLines.push(`[${index + 1}] ${powerup.name} READY`);
      }
    }

    const passiveNames = this.passives.map((powerup) => powerup.name).join(', ') || 'none';
    return [
      `Powerups: ${slotLines.join('   ')}`,
      `Passives: ${passiveNames}`,
      this.notification ? `Powerup: ${this.notification}` : ''
    ].filter(Boolean);
  }

  getDebugInfo() {
    return {
      acquired: this.acquired.map((powerup) => powerup.name).join(', ') || '(none)',
      activeEffects: [...this.activeEffects.values()]
        .map((effect) => `${effect.id}:${Math.ceil(effect.remainingMs / 1000)}s${effect.charges !== null ? `/${effect.charges}` : ''}`)
        .join(', ') || '(none)',
      cooldowns: this.activeSlots
        .map((powerup) => `${powerup.id}:${Math.ceil(this.getCooldownMs(powerup.id) / 1000)}s`)
        .join(', ') || '(none)',
      nextForkModified: this.nextForkSplit,
      compressionPending: this.compressionPending,
      stabilizerCharges: this.activeEffects.get('stabilizer')?.charges ?? 0,
      scoreMultiplier: this.getScoreMultiplier(),
      stats: { ...this.stats }
    };
  }

  pickRarity() {
    const total = Object.values(this.config.rarityWeights).reduce((sum, weight) => sum + weight, 0);
    let roll = this.rng.range(0, total);

    for (const [rarity, weight] of Object.entries(this.config.rarityWeights)) {
      roll -= weight;
      if (roll <= 0) {
        return rarity;
      }
    }

    return 'common';
  }
}
