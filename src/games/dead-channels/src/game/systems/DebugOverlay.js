import { forkConfig } from '../config/forks.js';

export class DebugOverlay {
  constructor(scene, gameState) {
    this.scene = scene;
    this.visible = false;
    this.frameMs = 0;
    this.lastTyped = '';
    this.activePhraseInfo = null;
    this.forkInfo = null;
    this.runInfo = null;
    this.hazardInfo = null;
    this.powerupInfo = null;
    this.upgradeInfo = null;
    this.multiStreamInfo = null;
    this.contentInfo = null;
    this.profileInfo = null;
    this.text = scene.add.text(16, 112, '', {
      fontFamily: 'Consolas, monospace',
      fontSize: '14px',
      color: '#a8f4ff',
      backgroundColor: 'rgba(2, 8, 14, 0.72)',
      padding: { x: 8, y: 6 }
    }).setDepth(1000).setScrollFactor(0);
    this.text.setVisible(false);

    this.update(16.67, gameState);
  }

  setLastTyped(value) {
    this.lastTyped = value;
  }

  setActivePhraseInfo(value) {
    this.activePhraseInfo = value;
  }

  setForkInfo(value) {
    this.forkInfo = value;
  }

  setRunInfo(value) {
    this.runInfo = value;
  }

  setHazardInfo(value) {
    this.hazardInfo = value;
  }

  setPowerupInfo(value) {
    this.powerupInfo = value;
  }

  setUpgradeInfo(value) {
    this.upgradeInfo = value;
  }

  setMultiStreamInfo(value) {
    this.multiStreamInfo = value;
  }

  setContentInfo(value) {
    this.contentInfo = value;
  }

  setProfileInfo(value) {
    this.profileInfo = value;
  }

  toggle() {
    this.visible = !this.visible;
    this.text.setVisible(this.visible);
  }

  update(delta, gameState) {
    if (!this.visible) {
      return;
    }

    this.frameMs = this.frameMs === 0 ? delta : this.frameMs * 0.9 + delta * 0.1;
    const fps = this.frameMs > 0 ? Math.round(1000 / this.frameMs) : 0;
    const scale = this.scene.scale;

    this.text.setText([
      `FPS: ${fps}`,
      `Scene: ${gameState.currentScene}`,
      `Seed: ${gameState.seed}`,
      `Score: ${gameState.score}`,
      `Integrity: ${gameState.integrity}`,
      `Flow: ${gameState.flow}`,
      `Instability: ${gameState.instability}`,
      `Instability band: ${this.hazardInfo?.bandLabel ?? gameState.instabilityBand}`,
      `Hazard count: ${this.hazardInfo?.activeHazardCount ?? 0}`,
      `Hazard types: ${this.hazardInfo?.activeHazardTypes ?? '(none)'}`,
      `Hazard durations: ${this.hazardInfo?.hazardDurations ?? '(none)'}`,
      `Reduced preview: ${this.hazardInfo?.reducedPreviewOffset ?? 0}`,
      `Last hazard source: ${this.hazardInfo?.lastHazardTriggerSource ?? '(none)'}`,
      `Band hazard chance: ${this.hazardInfo?.bandHazardChance ?? 0}`,
      `Powerups: ${this.powerupInfo?.acquired ?? '(none)'}`,
      `Active effects: ${this.powerupInfo?.activeEffects ?? '(none)'}`,
      `Cooldowns: ${this.powerupInfo?.cooldowns ?? '(none)'}`,
      `Next fork modified: ${this.powerupInfo?.nextForkModified ?? false}`,
      `Compression pending: ${this.powerupInfo?.compressionPending ?? false}`,
      `Stabilizer charges: ${this.powerupInfo?.stabilizerCharges ?? 0}`,
      `Score multiplier: ${this.powerupInfo?.scoreMultiplier ?? 1}`,
      `Starting kit: ${this.upgradeInfo?.startingKit ?? '(none)'}`,
      `Upgrades: ${this.upgradeInfo?.acquired ?? '(none)'}`,
      `Upgrade stacks: ${this.upgradeInfo?.stackCounts ?? '(none)'}`,
      `Archetypes: ${formatObject(this.upgradeInfo?.archetypeScores)}`,
      `Dominant build: ${this.upgradeInfo?.dominantArchetype ?? '(none)'}`,
      `Upgrade choices pending: ${this.upgradeInfo?.pendingChoices ?? false}`,
      `Route reroll available: ${this.upgradeInfo?.routeRerollAvailable ?? false}`,
      `Upgrade note: ${this.upgradeInfo?.notification ?? '(none)'}`,
      `Content id: ${this.contentInfo?.currentPhraseId ?? '(none)'}`,
      `Content difficulty: ${this.contentInfo?.currentPhraseDifficulty ?? 0}`,
      `Content category: ${this.contentInfo?.currentPhraseCategory ?? '(none)'}`,
      `Content biome: ${this.contentInfo?.currentPhraseBiome ?? '(none)'}`,
      `Content pool size: ${this.contentInfo?.currentContentPoolSize ?? 0}`,
      `Last archive fragment: ${this.contentInfo?.lastArchiveFragment ?? '(none)'}`,
      `Last flavor line: ${this.contentInfo?.lastEncounterFlavor ?? '(none)'}`,
      `Profile loaded: ${this.profileInfo?.loaded ?? false}`,
      `Profile version: ${this.profileInfo?.version ?? 0}`,
      `Profile id: ${this.profileInfo?.profileId ?? '(none)'}`,
      `Profile runs: ${this.profileInfo?.totalRuns ?? 0}`,
      `Profile best score: ${this.profileInfo?.bestScore ?? 0}`,
      `Save key: ${this.profileInfo?.storageKey ?? '(none)'}`,
      `Last save: ${this.profileInfo?.lastSaveAt ?? '(none)'}`,
      `Storage available: ${this.profileInfo?.storageAvailable ?? false}`,
      `Save warning: ${this.profileInfo?.warning ?? '(none)'}`,
      `Pending unlocks: ${this.profileInfo?.pendingUnlocks ?? '(none)'}`,
      `Multi-stream active: ${this.multiStreamInfo?.active ?? false}`,
      `Active streams: ${this.multiStreamInfo?.activeStreamCount ?? 0}`,
      `Focused stream: ${this.multiStreamInfo?.focusedStreamId ?? '(none)'}`,
      `Focused role: ${this.multiStreamInfo?.focusedStreamRole ?? '(none)'}`,
      `Streams: ${this.multiStreamInfo?.streams?.map((stream) => `${stream.role}:${stream.state}:${stream.progressIndex}/${stream.phrase.length}@${stream.speed}`).join(' | ') ?? '(none)'}`,
      `Forks suppressed: ${this.multiStreamInfo?.forksSuppressed ?? false}`,
      `Run state: ${this.runInfo?.state ?? '(none)'}`,
      `Encounter: ${this.runInfo?.encounterIndex ?? 0}/${this.runInfo?.totalEncounters ?? 0}`,
      `Encounter type: ${this.runInfo?.encounterType ?? '(none)'}`,
      `Encounter progress: ${this.runInfo?.encounterProgress ?? 0}/${this.runInfo?.encounterRequired ?? 0}`,
      `Speed multiplier: ${this.runInfo?.speedMultiplier ?? 1}`,
      `Fork frequency: ${this.runInfo?.forkFrequency ?? 0}`,
      `Run seed: ${this.runInfo?.runSeed ?? gameState.runSeed}`,
      `RNG state: ${this.runInfo?.rngState ?? 0}`,
      `Finale active: ${this.runInfo?.finaleActive ?? false}`,
      `Active phrase: ${this.activePhraseInfo?.text ?? '(none)'}`,
      `Phrase state: ${this.activePhraseInfo?.state ?? '(none)'}`,
      `Progress index: ${this.activePhraseInfo?.progressIndex ?? 0}`,
      `Phrase speed: ${this.activePhraseInfo?.speed ?? 0}`,
      `Phrase pos: ${this.activePhraseInfo ? `${this.activePhraseInfo.x},${this.activePhraseInfo.y}` : '(none)'}`,
      `Fork active: ${this.forkInfo?.active ?? false}`,
      `Fork state: ${this.forkInfo?.state ?? '(none)'}`,
      `Branch count: ${this.forkInfo?.branchCount ?? 0}`,
      `Branch routes: ${this.forkInfo?.branchRouteTypes ?? '(none)'}`,
      `Branch phrases: ${this.forkInfo?.branchPhrases ?? '(none)'}`,
      `Committed branch: ${this.forkInfo?.committedBranch ?? '(none)'}`,
      `Fork timer: ${this.forkInfo?.timerMs ?? 0}ms`,
      `Phrases until fork: ${Math.max(0, forkConfig.phrasesBetweenForks - gameState.normalPhraseResolutionsSinceFork)}`,
      `Route history: ${gameState.routeHistory.join(', ') || '(none)'}`,
      `Last typed: ${this.lastTyped || '(none)'}`,
      `Correct inputs: ${gameState.correctInputCount}`,
      `Mistakes: ${gameState.mistakeCount}`,
      `Completed: ${gameState.completedPhraseCount}`,
      `Missed: ${gameState.missedPhraseCount}`,
      `Screen: ${scale.gameSize.width}x${scale.gameSize.height}`
    ]);
  }
}

function formatObject(value) {
  if (!value) {
    return '(none)';
  }

  return Object.entries(value).map(([key, count]) => `${key}:${count}`).join(', ');
}
