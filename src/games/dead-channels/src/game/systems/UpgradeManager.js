import { upgradeConfig } from '../config/upgrades.js';
import { upgradeDefinitions } from '../content/upgrades.js';

export class UpgradeManager {
  constructor({ rng, config = upgradeConfig, definitions = upgradeDefinitions } = {}) {
    this.rng = rng;
    this.config = config;
    this.definitions = definitions;
    this.acquired = new Map();
    this.rewardChoices = [];
    this.startingKit = null;
    this.routeRerollAvailable = false;
    this.notification = '';
    this.stats = {
      acquired: 0,
      perfectPhraseBonusesEarned: 0,
      hazardsReducedByUpgrades: 0,
      routeRerollsUsed: 0,
      overclockExtensionMs: 0,
      emergencyRepairsUsed: 0,
      streamPrioritizerTriggers: 0,
      rhythmLockTriggers: 0
    };
    this.perfectPhraseStreak = 0;
  }

  applyStartingKit(kitId, { gameState, powerupManager } = {}) {
    const kit = this.config.startingKits.find((candidate) => candidate.id === kitId)
      ?? this.config.startingKits[0];
    this.startingKit = kit;
    this.acquire(kit.upgradeId);

    if (kit.powerupId && powerupManager) {
      powerupManager.acquire(kit.powerupId);
    }

    if (gameState) {
      if (kit.integrityBonus) {
        gameState.integrity = Math.min(120, gameState.integrity + kit.integrityBonus);
      }
      gameState.startingKit = kit.name;
    }

    this.notification = `${kit.name} kit loaded`;
    return kit;
  }

  beginEncounter() {
    this.routeRerollAvailable = this.hasUpgrade('route_reroll');
  }

  generateRewardChoices() {
    const choices = [];
    const available = this.definitions.filter((definition) => this.canAcquire(definition));

    while (choices.length < this.config.upgradeChoicesCount && available.length > 0) {
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

  acquire(upgradeId) {
    const definition = this.definitions.find((upgrade) => upgrade.id === upgradeId);
    if (!definition || !this.canAcquire(definition)) {
      return null;
    }

    const existing = this.acquired.get(upgradeId);
    if (existing) {
      existing.stacks += 1;
    } else {
      this.acquired.set(upgradeId, { definition, stacks: 1 });
    }

    this.stats.acquired += 1;
    this.notification = `Upgrade acquired: ${definition.name}`;
    this.rewardChoices = [];
    return definition;
  }

  canAcquire(definition) {
    const existing = this.acquired.get(definition.id);
    if (!existing) {
      return true;
    }

    return definition.stackable && existing.stacks < (definition.maxStacks ?? 1);
  }

  hasUpgrade(id) {
    return this.acquired.has(id);
  }

  getStackCount(id) {
    return this.acquired.get(id)?.stacks ?? 0;
  }

  getMultiplier(key, baseValue = 1) {
    let value = baseValue;
    for (const { definition, stacks } of this.acquired.values()) {
      if (Number.isFinite(definition.effect[key])) {
        value *= definition.effect[key] ** stacks;
      }
    }
    return value;
  }

  getAdditive(key, baseValue = 0) {
    let value = baseValue;
    for (const { definition, stacks } of this.acquired.values()) {
      if (Number.isFinite(definition.effect[key])) {
        value += definition.effect[key] * stacks;
      }
    }
    return value;
  }

  getFlowGainBonus() {
    return this.startingKit?.flowGainBonus ?? 0;
  }

  getMistakeFlowPenaltyMultiplier() {
    return this.getMultiplier('flowMistakePenaltyMultiplier', this.config.modifierDefaults.flowMistakePenaltyMultiplier);
  }

  getMissIntegrityMultiplier() {
    return this.getMultiplier('missIntegrityPenaltyMultiplier', this.config.modifierDefaults.missIntegrityPenaltyMultiplier);
  }

  getHazardDurationMultiplier() {
    return this.getMultiplier('hazardDurationMultiplier', this.config.modifierDefaults.hazardDurationMultiplier);
  }

  getOverclockInstabilityMultiplier() {
    return this.getMultiplier('overclockInstabilityMultiplier', this.config.modifierDefaults.overclockInstabilityMultiplier);
  }

  getForkTelegraphBonusMs() {
    return this.getAdditive('forkTelegraphBonusMs', this.config.modifierDefaults.forkTelegraphBonusMs);
  }

  getScoreMultiplier({ encounterType, speedMultiplier } = {}) {
    let multiplier = 1;

    if (this.hasUpgrade('redline_bonus') && speedMultiplier > this.config.redlineBaseSpeed) {
      const steps = Math.floor((speedMultiplier - this.config.redlineBaseSpeed) / 0.1) + 1;
      multiplier += steps * this.config.redlineScorePerSpeedStep * this.getStackCount('redline_bonus');
    }

    if (this.hasUpgrade('dangerous_velocity') && encounterType === 'pressure') {
      multiplier *= this.config.pressureScoreMultiplier;
    }

    return multiplier;
  }

  onPhraseCompleted({ perfect, textLength, encounterType, overclockActive, powerupManager }) {
    const result = {
      scoreBonus: 0,
      flowBonus: 0,
      instabilityReduction: 0,
      instabilityIncrease: 0
    };

    if (perfect) {
      this.perfectPhraseStreak += 1;
      result.scoreBonus += this.getAdditive('perfectPhraseScoreBonus');
      result.flowBonus += this.getAdditive('perfectPhraseFlowBonus');

      if (result.scoreBonus || result.flowBonus) {
        this.stats.perfectPhraseBonusesEarned += 1;
        this.notification = 'Perfect Signal bonus';
      }

      if (this.hasUpgrade('rhythm_lock') && this.perfectPhraseStreak % this.config.rhythmLockPerfectsRequired === 0) {
        result.instabilityReduction += this.config.rhythmLockInstabilityReduction;
        this.stats.rhythmLockTriggers += 1;
        this.notification = 'Rhythm Lock stabilized signal';
      }

      if (this.hasUpgrade('surge_window') && overclockActive && powerupManager?.extendActiveEffect('overclock', this.config.surgeWindowExtensionMs)) {
        this.stats.overclockExtensionMs += this.config.surgeWindowExtensionMs;
        this.notification = 'Surge Window extended Overclock';
      }
    } else {
      this.perfectPhraseStreak = 0;
    }

    if (this.hasUpgrade('dangerous_velocity') && encounterType === 'pressure') {
      result.instabilityIncrease += this.config.pressureInstabilityPerResolution;
    }

    return result;
  }

  onMiss({ gameState } = {}) {
    this.perfectPhraseStreak = 0;

    if (this.hasUpgrade('chain_extension') && gameState) {
      gameState.setFlow(Math.max(gameState.flow, this.getDefinition('chain_extension').effect.missFlowReserve));
    }
  }

  onRepairResolved() {
    const reduction = this.getAdditive('repairInstabilityReductionBonus');
    if (reduction > 0) {
      this.stats.hazardsReducedByUpgrades += reduction;
      this.notification = 'Clean Recovery reduced instability';
    }
    return reduction;
  }

  onSecondaryStreamCompleted(stream) {
    if (!this.hasUpgrade('stream_prioritizer') || stream.role === 'primary') {
      return { scoreBonus: 0, flowBonus: 0 };
    }

    this.stats.streamPrioritizerTriggers += 1;
    this.notification = 'Stream Prioritizer bonus';
    return {
      scoreBonus: this.getAdditive('streamPrioritizerScoreBonus'),
      flowBonus: this.getAdditive('streamPrioritizerFlowBonus')
    };
  }

  tryEmergencyRepair(gameState) {
    if (!this.hasUpgrade('emergency_repair') || this.stats.emergencyRepairsUsed > 0) {
      return false;
    }

    if (gameState.integrity > 0 && gameState.integrity < this.config.emergencyRepairThreshold) {
      gameState.integrity = Math.min(100, gameState.integrity + this.config.emergencyRepairAmount);
      this.stats.emergencyRepairsUsed += 1;
      this.notification = 'Emergency Repair restored integrity';
      return true;
    }

    return false;
  }

  applyRoutePool(routeTypes) {
    if (!this.routeRerollAvailable || !routeTypes.includes('corruption')) {
      return routeTypes;
    }

    const nextTypes = routeTypes.slice();
    const index = nextTypes.indexOf('corruption');
    nextTypes[index] = 'reward';
    this.routeRerollAvailable = false;
    this.stats.routeRerollsUsed += 1;
    this.notification = 'Route Reroll softened a fork';
    return nextTypes;
  }

  getExtraBranchReward() {
    if (!this.hasUpgrade('extra_branch_value')) {
      return { scoreBonus: 0, flowBonus: 0 };
    }

    return {
      scoreBonus: this.config.extraBranchScoreBonus,
      flowBonus: this.config.extraBranchFlowBonus
    };
  }

  getArchetypeScores() {
    const scores = {};
    for (const tag of Object.keys(this.config.archetypeTags)) {
      scores[tag] = 0;
    }

    for (const { definition, stacks } of this.acquired.values()) {
      for (const tag of definition.archetypeTags) {
        scores[tag] = (scores[tag] ?? 0) + stacks;
      }
    }

    return scores;
  }

  getDominantArchetype() {
    const scores = this.getArchetypeScores();
    const [tag] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0] ?? ['flowRunner'];
    return this.config.archetypeTags[tag] ?? 'Mixed';
  }

  getDefinition(id) {
    return this.definitions.find((definition) => definition.id === id);
  }

  getDebugInfo() {
    const upgrades = [...this.acquired.values()];
    return {
      startingKit: this.startingKit?.name ?? '(none)',
      acquired: upgrades.map(({ definition, stacks }) => `${definition.name}${stacks > 1 ? ` x${stacks}` : ''}`).join(', ') || '(none)',
      stackCounts: upgrades.map(({ definition, stacks }) => `${definition.id}:${stacks}`).join(', ') || '(none)',
      archetypeScores: this.getArchetypeScores(),
      dominantArchetype: this.getDominantArchetype(),
      routeRerollAvailable: this.routeRerollAvailable,
      pendingChoices: this.rewardChoices.length > 0,
      notification: this.notification,
      stats: { ...this.stats },
      modifiers: {
        flowMistakePenaltyMultiplier: this.getMistakeFlowPenaltyMultiplier(),
        missIntegrityPenaltyMultiplier: this.getMissIntegrityMultiplier(),
        hazardDurationMultiplier: this.getHazardDurationMultiplier(),
        forkTelegraphBonusMs: this.getForkTelegraphBonusMs(),
        overclockInstabilityMultiplier: this.getOverclockInstabilityMultiplier()
      }
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
