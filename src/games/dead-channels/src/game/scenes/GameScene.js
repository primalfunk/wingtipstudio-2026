import Phaser from 'phaser';
import { difficultyConfig } from '../config/difficulty.js';
import { getDifficultyMode } from '../config/difficultyModes.js';
import { forkConfig, routeTypeLabels } from '../config/forks.js';
import { hazardConfig } from '../config/hazards.js';
import { powerupConfig } from '../config/powerups.js';
import { upgradeConfig } from '../config/upgrades.js';
import { visualConfig } from '../config/visuals.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../config.js';
import { fontConfig } from '../config/fonts.js';
import { BackgroundRenderer } from '../systems/BackgroundRenderer.js';
import { CognitiveDebtManager } from '../systems/CognitiveDebtManager.js';
import { ContentSelector } from '../systems/ContentSelector.js';
import { DebugOverlay } from '../systems/DebugOverlay.js';
import { ForkEncounter, FORK_STATE } from '../systems/ForkEncounter.js';
import { GameState } from '../systems/GameState.js';
import { InputManager } from '../systems/InputManager.js';
import { MultiStreamManager } from '../systems/MultiStreamManager.js';
import { PowerupManager } from '../systems/PowerupManager.js';
import { RunManager } from '../systems/RunManager.js';
import { StreamPhrase, STREAM_PHRASE_STATE } from '../systems/StreamPhrase.js';
import { signalPanelConfig } from '../config/signalPanels.js';
import { UpgradeManager } from '../systems/UpgradeManager.js';
import { VisualSettings } from '../systems/VisualSettings.js';
import { validateContent } from '../content/validateContent.js';
import { ForkEncounterView } from '../ui/ForkEncounterView.js';
import { Hud } from '../ui/Hud.js';
import { MultiStreamView } from '../ui/MultiStreamView.js';
import { createPopupPanel } from '../ui/PopupPanel.js';
import { StreamPhraseView } from '../ui/StreamPhraseView.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.inputManager = null;
    this.debugOverlay = null;
    this.hud = null;
    this.backgroundRenderer = null;
    this.gameState = null;
    this.runManager = null;
    this.cognitiveDebtManager = null;
    this.powerupManager = null;
    this.upgradeManager = null;
    this.contentSelector = null;
    this.profileManager = null;
    this.audioManager = null;
    this.profileRunResult = null;
    this.difficultyMode = null;
    this.lastRunSummary = null;
    this.multiStreamManager = null;
    this.rng = null;
    this.activePhrase = null;
    this.phraseView = null;
    this.forkEncounter = null;
    this.forkView = null;
    this.multiStreamView = null;
    this.currentForkHadSplitter = false;
    this.lastPhraseText = '';
    this.lastTyped = '';
    this.isResolvingPhrase = false;
    this.isForkActive = false;
    this.isResolvingFork = false;
    this.isRunEnded = false;
    this.isTransitioning = false;
    this.transitionText = null;
    this.summaryPanel = null;
    this.summaryHeaderText = null;
    this.summaryBodyRows = [];
    this.summaryFooterText = null;
    this.summaryGroups = [];
    this.summaryExpanded = {};
    this.summaryScrollIndex = 0;
    this.staticBloomOverlay = null;
    this.zoneGraphics = null;
    this.isChoosingPowerup = false;
    this.isChoosingUpgrade = false;
    this.isMultiStreamActive = false;
    this.powerupChoiceText = null;
    this.upgradeChoiceText = null;
    this.upgradeChoiceContainer = null;
    this.powerupChoiceContainer = null;
  }

  create(data = {}) {
    this.cameras.main.setBackgroundColor('#05070d');

    const runSeed = data.seed ?? RunManager.createSeed();
    this.profileManager = this.registry.get('profileManager');
    this.audioManager = this.registry.get('audioManager');
    this.audioManager?.playMusic(this, 'gameplay');
    this.difficultyMode = getDifficultyMode(this.profileManager?.profile.settings.difficultyMode);
    this.runManager = new RunManager({ seed: runSeed });
    this.gameState = new GameState(runSeed);
    this.registry.set('gameState', this.gameState);
    this.gameState.currentScene = 'GameScene';
    this.gameState.mode = 'gameplay';
    this.gameState.difficultyMode = this.difficultyMode.label;
    this.rng = this.runManager.rng;
    this.contentSelector = new ContentSelector({ rng: this.rng });
    if (import.meta.env.DEV) {
      const validation = validateContent();
      if (!validation.valid) {
        console.warn('Content validation warnings:', validation.warnings);
      }
    }
    this.cognitiveDebtManager = new CognitiveDebtManager({ rng: this.rng });
    this.powerupManager = new PowerupManager({ rng: this.rng });
    this.upgradeManager = new UpgradeManager({ rng: this.rng });
    const requestedKit = data.kitId ?? this.profileManager?.profile.lastSelectedKit ?? upgradeConfig.startingKits[0].id;
    const kitId = this.profileManager?.isKitUnlocked(requestedKit) ? requestedKit : upgradeConfig.startingKits[0].id;
    this.profileManager?.setLastSelectedKit(kitId);
    this.upgradeManager.applyStartingKit(kitId, {
      gameState: this.gameState,
      powerupManager: this.powerupManager
    });
    this.runManager.start();
    this.syncEncounterState();
    this.upgradeManager.beginEncounter();
    this.gameState.syncPowerupStats(this.powerupManager);
    this.gameState.syncUpgradeStats(this.upgradeManager);

    this.backgroundRenderer = new BackgroundRenderer(this, { depth: -40 });
    this.zoneGraphics = this.add.graphics().setDepth(5);
    this.drawGameplayZones();
    this.staticBloomOverlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x97f7ff, 0)
      .setDepth(650)
      .setScrollFactor(0);

    this.hud = new Hud(this, this.gameState);
    this.debugOverlay = new DebugOverlay(this, this.gameState);
    this.phraseView = new StreamPhraseView(this);
    this.forkEncounter = new ForkEncounter({ rng: this.rng, config: this.getForkConfigForEncounter(), contentSelector: this.contentSelector });
    this.forkView = new ForkEncounterView(this);
    this.multiStreamManager = new MultiStreamManager({ rng: this.rng, contentSelector: this.contentSelector });
    this.multiStreamView = new MultiStreamView(this);
    this.showEncounterTransition(this.runManager.currentEncounter, true);

    this.inputManager = new InputManager(this);
    this.inputManager.onTypedCharacter((character) => {
      this.audioManager?.unlock(this);
      this.lastTyped = `${this.lastTyped}${character}`.slice(-24);
      this.debugOverlay.setLastTyped(this.lastTyped);
      if (this.isChoosingPowerup) {
        this.handlePowerupChoiceInput(character);
        return;
      }
      if (this.isChoosingUpgrade) {
        this.handleUpgradeChoiceInput(character);
        return;
      }
      if (this.isRunEnded) {
        this.handleSummaryInput(character);
        return;
      }
      if (['1', '2', '3'].includes(character) && this.tryActivatePowerup(Number(character) - 1)) {
        return;
      }
      this.handleTypedCharacter(character);
    });
    this.inputManager.onSpecialKey('Backspace', () => {
      this.audioManager?.unlock(this);
      this.lastTyped = this.lastTyped.slice(0, -1);
      this.debugOverlay.setLastTyped(this.lastTyped);
      this.handleBackspace();
    });
    this.inputManager.onSpecialKey('Escape', () => {
      this.audioManager?.unlock(this);
      this.audioManager?.playSfx(this, 'uiCancel');
      this.scene.start('MainMenuScene');
    });
    this.inputManager.onSpecialKey('F3', () => {
      this.debugOverlay.toggle();
    });
    this.inputManager.onSpecialKey('Tab', (event) => {
      if (this.isMultiStreamActive && !this.isRunEnded && !this.isTransitioning) {
        this.audioManager?.playSfx(this, 'uiConfirm', { volume: 0.42 });
        this.multiStreamManager.cycleFocus(event.shiftKey ? -1 : 1);
        this.gameState.totalStreamSwitches = this.multiStreamManager.switchCount;
      }
    });
    this.inputManager.onSpecialKey('ArrowUp', () => {
      if (this.isRunEnded) {
        this.scrollSummary(-1);
        return;
      }
      if (this.isMultiStreamActive && !this.isRunEnded && !this.isTransitioning) {
        this.audioManager?.playSfx(this, 'uiConfirm', { volume: 0.42 });
        this.multiStreamManager.cycleFocus(-1);
        this.gameState.totalStreamSwitches = this.multiStreamManager.switchCount;
      }
    });
    this.inputManager.onSpecialKey('ArrowDown', () => {
      if (this.isRunEnded) {
        this.scrollSummary(1);
        return;
      }
      if (this.isMultiStreamActive && !this.isRunEnded && !this.isTransitioning) {
        this.audioManager?.playSfx(this, 'uiConfirm', { volume: 0.42 });
        this.multiStreamManager.cycleFocus(1);
        this.gameState.totalStreamSwitches = this.multiStreamManager.switchCount;
      }
    });
    this.inputManager.onSpecialKey('Enter', () => {
      return;
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdownInput());
  }

  update(_time, delta) {
    this.gameState.elapsedTime += delta / 1000;
    const modalPaused = this.isModalPaused();
    if (!modalPaused) {
      this.runManager.update(delta);
    }
    this.backgroundRenderer?.update({
      biome: this.gameState.lastContentBiome || 'signalArchive',
      instability: this.gameState.instability,
      flow: this.gameState.flow,
      finale: this.runManager.currentEncounter?.finale ?? false
    }, delta);
    if (!modalPaused) {
      this.powerupManager.update(delta);
    }
    this.gameState.runElapsedMs = this.runManager.elapsedMs;
    this.gameState.highestFlow = Math.max(this.gameState.highestFlow, this.gameState.flow);
    this.updatePowerups(modalPaused ? 0 : delta);
    if (!modalPaused) {
      this.updateHazards(delta);
    }

    this.updateTypingClockState(modalPaused);
    if (this.gameState.typingClockActive) {
      this.gameState.typingElapsedTime += delta / 1000;
    }

    if (this.activePhrase && !this.isResolvingPhrase && !this.isRunEnded && !this.isTransitioning) {
      this.activePhrase.speed = this.getCurrentPhraseSpeed();
      this.activePhrase.update(delta);
      this.phraseView.update(this.cognitiveDebtManager.getRenderState(this.gameState.instability));

      if (this.activePhrase.state === STREAM_PHRASE_STATE.MISSED) {
        this.resolveMissedPhrase();
      }
    }

    if (this.isMultiStreamActive && !this.isRunEnded && !this.isTransitioning) {
      const results = this.multiStreamManager.update(
        delta,
        this.powerupManager.getSpeedMultiplier(),
        this.getCurrentPhraseSpeed()
      );
      this.multiStreamView.update(
        this.multiStreamManager,
        this.cognitiveDebtManager.getRenderState(this.gameState.instability)
      );
      results.forEach((result) => this.resolveMultiStreamResult(result));
      this.updateMultiStreamHudStatus();
    }

    if (this.isForkActive && !this.isResolvingFork && !this.isRunEnded && !this.isTransitioning) {
      this.forkEncounter.update(delta);
      this.forkView.update();
      this.updateForkHudStatus();

      if (this.forkEncounter.result) {
        this.resolveForkResult(this.forkEncounter.result);
      }
    }

    this.hud.update(this.gameState);
    this.debugOverlay.setActivePhraseInfo(this.activePhrase?.getDebugInfo() ?? null);
    this.debugOverlay.setForkInfo(this.forkEncounter?.getDebugInfo() ?? null);
    this.debugOverlay.setRunInfo(this.runManager?.getDebugInfo() ?? null);
    this.debugOverlay.setHazardInfo(this.cognitiveDebtManager?.getDebugInfo(this.gameState.instability) ?? null);
    this.debugOverlay.setPowerupInfo(this.powerupManager?.getDebugInfo() ?? null);
    this.debugOverlay.setUpgradeInfo(this.upgradeManager?.getDebugInfo() ?? null);
    this.debugOverlay.setMultiStreamInfo(this.multiStreamManager?.getDebugInfo() ?? null);
    this.debugOverlay.setContentInfo(this.contentSelector?.getDebugInfo() ?? null);
    this.debugOverlay.setProfileInfo(this.profileManager?.getDebugInfo() ?? null);
    this.debugOverlay.update(delta, this.gameState);
  }

  handleTypedCharacter(character) {
    if (this.isMultiStreamActive) {
      this.handleMultiStreamCharacter(character);
      return;
    }

    if (this.isForkActive) {
      this.handleForkCharacter(character);
      return;
    }

    if (!this.activePhrase || this.isResolvingPhrase || this.isRunEnded || this.isTransitioning) {
      return;
    }

    const result = this.activePhrase.processCharacter(character);
    if (!result.accepted) {
      return;
    }

    this.activateTypingClock();
    this.gameState.totalInputCount += 1;

    if (result.correct) {
      this.audioManager?.playSfx(this, 'correctKey', { volume: 0.18 });
      this.gameState.correctInputCount += 1;
      this.addScore(difficultyConfig.correctCharScore);
      this.gameState.addFlow(1 + this.upgradeManager.getFlowGainBonus());
      this.phraseView.flashCorrect();
    } else {
      this.audioManager?.playSfx(this, 'wrongKey');
      const forgiven = this.powerupManager.forgiveMistake();
      if (!forgiven) {
        this.gameState.mistakeCount += 1;
        this.addInstability(difficultyConfig.wrongKeyInstability * this.powerupManager.getWrongKeyInstabilityMultiplier());
        this.registerHazards(this.cognitiveDebtManager.onWrongKey(this.getHazardContext()));
      }
      this.gameState.setFlow(this.gameState.flow - this.getWrongKeyFlowPenalty());
      this.phraseView.flashMistake();
      this.cameras.main.flash(90, 170, 35, 50, false, null, null);
    }

    if (result.completed) {
      this.resolveCompletedPhrase();
    }
  }

  handleBackspace() {
    if (this.isMultiStreamActive) {
      this.multiStreamManager.backspace();
      return;
    }

    if (this.isForkActive) {
      this.forkEncounter.backspace();
      return;
    }

    if (!this.activePhrase || this.isResolvingPhrase || this.isRunEnded || this.isTransitioning) {
      return;
    }

    this.activePhrase.backspace();
  }

  spawnNextPhrase() {
    if (this.isRunEnded || this.isTransitioning) {
      return;
    }

    if (this.runManager.currentEncounter?.type === 'multiStream') {
      this.startMultiStreamEncounter();
      return;
    }

    if (this.shouldSpawnFork()) {
      this.startForkEncounter();
      return;
    }

    const phrase = this.pickNextPhrase();
    const phraseText = phrase.text;
    this.activePhrase = new StreamPhrase({
      text: phraseText,
      x: signalPanelConfig.singlePanel.x,
      y: signalPanelConfig.singlePanel.y,
      speed: this.getCurrentPhraseSpeed(),
      activationZoneX: difficultyConfig.activationZoneX,
      failureZoneX: difficultyConfig.failureZoneX
    });
    this.activePhrase.contentEntry = phrase;
    this.applyCompressionToActivePhrase();
    this.isResolvingPhrase = false;
    this.phraseView.setPhrase(this.activePhrase);
    this.debugOverlay?.setActivePhraseInfo(this.activePhrase.getDebugInfo());
  }

  shouldSpawnFork() {
    return !this.isForkActive
      && !this.isMultiStreamActive
      && this.runManager.currentEncounter?.type !== 'multiStream'
      && this.gameState.normalPhraseResolutionsSinceFork >= this.getCurrentForkEvery()
      && this.gameState.integrity > 0;
  }

  pickNextPhrase() {
    const encounter = this.runManager.currentEncounter;
    const phrase = encounter?.finale
      ? this.contentSelector.getFinalePhrase({ encounterIndex: encounter.index })
      : this.contentSelector.getPhrase({
        streamRole: 'primary',
        encounterIndex: encounter?.index ?? 0
      });

    this.lastPhraseText = phrase.text;
    this.recordContentSelection(phrase);
    return phrase;
  }

  drawGameplayZones() {
    this.zoneGraphics.clear();
    const bayX = GAME_WIDTH / 2 - 520;
    const bayY = GAME_HEIGHT / 2 - 230;
    const bayWidth = 1040;
    const bayHeight = 460;
    this.zoneGraphics.lineStyle(1, visualConfig.colors.cyan, VisualSettings.reduceGlow ? 0.08 : 0.18);
    this.zoneGraphics.strokeRect(bayX, bayY, bayWidth, bayHeight);
    this.zoneGraphics.lineStyle(2, visualConfig.colors.cyan, VisualSettings.reduceGlow ? 0.06 : 0.12);
    this.zoneGraphics.lineBetween(bayX + 24, bayY + 28, bayX + bayWidth - 24, bayY + 28);
    this.zoneGraphics.lineBetween(bayX + 24, bayY + bayHeight - 28, bayX + bayWidth - 24, bayY + bayHeight - 28);
  }

  resolveCompletedPhrase() {
    if (this.isResolvingPhrase) {
      return;
    }

    this.isResolvingPhrase = true;
    const progress = this.activePhrase.getProgress();
    const perfect = progress.mistakeCount === 0;
    const perfectBonus = progress.mistakeCount === 0 ? difficultyConfig.perfectBonus : 0;
    this.addScore(difficultyConfig.phraseCompleteScore + this.activePhrase.text.length + perfectBonus);
    this.gameState.addFlow(difficultyConfig.completedFlowGain);
    this.gameState.completedPhraseCount += 1;
    this.gameState.phrasesCompleted += 1;
    this.recordContentCompletion(this.activePhrase.contentEntry);
    this.gameState.normalPhraseResolutionsSinceFork += 1;
    this.gameState.streak += 1;
    const powerupResult = this.powerupManager.onPhraseCompleted({
      perfect,
      textLength: this.activePhrase.text.length
    });
    const upgradeResult = this.upgradeManager.onPhraseCompleted({
      perfect,
      textLength: this.activePhrase.text.length,
      encounterType: this.runManager.currentEncounter?.type,
      overclockActive: this.powerupManager.hasActiveEffect('overclock'),
      powerupManager: this.powerupManager
    });
    this.addScore(upgradeResult.scoreBonus);
    this.gameState.addFlow(upgradeResult.flowBonus);
    this.addInstability(upgradeResult.instabilityIncrease - powerupResult.instabilityReduction - upgradeResult.instabilityReduction);
    this.checkEmergencyRepair();
    this.audioManager?.playSfx(this, 'phraseComplete');

    if (progress.mistakeCount > 0) {
      this.registerHazards(this.cognitiveDebtManager.onImperfectPhraseCompleted(this.getHazardContext()));
    }

    this.phraseView.playComplete(() => {
      this.handleContentResolution();
    });
  }

  resolveMissedPhrase() {
    if (this.isResolvingPhrase) {
      return;
    }

    this.deactivateTypingClock();
    this.isResolvingPhrase = true;
    this.gameState.integrity = Math.max(0, this.gameState.integrity - this.getMissIntegrityPenalty(difficultyConfig.missedIntegrityPenalty));
    this.addInstability(difficultyConfig.missedInstabilityPenalty * this.powerupManager.getMissInstabilityMultiplier());
    this.gameState.setFlow(0);
    this.upgradeManager.onMiss({ gameState: this.gameState });
    this.checkEmergencyRepair();
    this.gameState.missedPhraseCount += 1;
    this.gameState.phrasesMissed += 1;
    this.gameState.normalPhraseResolutionsSinceFork += 1;
    this.gameState.streak = 0;
    this.registerHazards(this.cognitiveDebtManager.onPhraseMissed(this.getHazardContext()));
    this.audioManager?.playSfx(this, 'phraseMiss');
    this.cameras.main.flash(180, 180, 20, 40, false, null, null);

    this.phraseView.playMiss(() => {
      if (this.gameState.integrity <= 0) {
        this.endRun('lost');
        return;
      }

      this.handleContentResolution();
    });
  }

  startForkEncounter() {
    this.audioManager?.playSfx(this, 'forkAppears');
    this.activePhrase = null;
    this.isResolvingPhrase = false;
    this.isForkActive = true;
    this.isResolvingFork = false;
    this.gameState.normalPhraseResolutionsSinceFork = 0;
    this.gameState.forkCount += 1;
    this.hud.setForkStatus('BRANCH LATTICE DETECTED');
    this.currentForkHadSplitter = this.powerupManager.nextForkSplit;
    this.forkEncounter = new ForkEncounter({
      rng: this.rng,
      config: this.getForkConfigForEncounter({ consumeForkSplitter: true }),
      contentSelector: this.contentSelector
    });
    this.forkEncounter.start();
    this.forkView.showFork(this.forkEncounter);
  }

  handleForkCharacter(character) {
    if (!this.forkEncounter || this.isResolvingFork || this.isRunEnded || this.isTransitioning) {
      return;
    }

    const previousCommittedBranch = this.forkEncounter.committedBranch;
    const result = this.forkEncounter.processCharacter(character);

    if (!result.accepted) {
      return;
    }

    this.activateTypingClock();
    this.gameState.totalInputCount += 1;

    if (!previousCommittedBranch && this.forkEncounter.committedBranch) {
      this.audioManager?.playSfx(this, 'branchSelect');
      this.forkView.emphasizeCommit(this.forkEncounter.committedBranch);
    }

    if (result.correct) {
      this.audioManager?.playSfx(this, 'correctKey', { volume: 0.18 });
      this.gameState.correctInputCount += 1;
      this.addScore(difficultyConfig.correctCharScore);
      this.gameState.addFlow(1 + this.upgradeManager.getFlowGainBonus());
    } else {
      this.audioManager?.playSfx(this, 'wrongKey');
      const forgiven = this.powerupManager.forgiveMistake();
      if (!forgiven) {
        this.gameState.mistakeCount += 1;
        this.addInstability(difficultyConfig.wrongKeyInstability * this.powerupManager.getWrongKeyInstabilityMultiplier());
        this.registerHazards(this.cognitiveDebtManager.onWrongKey(this.getHazardContext()));
      }
      this.gameState.setFlow(this.gameState.flow - this.getWrongKeyFlowPenalty());
      this.forkView.flashMistake(this.forkEncounter.committedBranch ?? this.forkEncounter.branches[0]);
      this.cameras.main.flash(90, 170, 35, 50, false, null, null);
    }
  }

  resolveForkResult(result) {
    if (this.isResolvingFork) {
      return;
    }

    this.deactivateTypingClock();
    this.isResolvingFork = true;

    if (result.outcome === 'completed') {
      this.audioManager?.playSfx(this, 'routeResolved');
      this.applyRouteConsequence(result.branch, result.consequence, 'completed');
      this.forkView.playComplete(result.consequence, () => this.finishForkEncounter());
      return;
    }

    this.applyRouteConsequence(result.branch, result.consequence, 'missed');
    this.audioManager?.playSfx(this, 'phraseMiss');
    this.cameras.main.flash(160, 180, 20, 40, false, null, null);
    this.forkView.playMiss(result.consequence, () => {
      if (this.gameState.integrity <= 0) {
        this.endRun('lost');
        return;
      }

      this.finishForkEncounter();
    });
  }

  applyRouteConsequence(branch, consequence, outcome) {
    this.gameState.addRouteToHistory(branch.routeType);
    const routeConsequence = { ...consequence };
    if (outcome === 'missed' && routeConsequence.integrity < 0) {
      routeConsequence.integrity = -this.getMissIntegrityPenalty(Math.abs(routeConsequence.integrity));
    }
    if (outcome === 'completed' && this.currentForkHadSplitter) {
      const extraBranchReward = this.upgradeManager.getExtraBranchReward();
      routeConsequence.score = (routeConsequence.score ?? 0) + extraBranchReward.scoreBonus;
      routeConsequence.flow = (routeConsequence.flow ?? 0) + extraBranchReward.flowBonus;
    }
    this.addScore(routeConsequence.score ?? 0);
    this.gameState.integrity = Math.min(100, Math.max(0, this.gameState.integrity + (routeConsequence.integrity ?? 0)));
    this.addInstability(consequence.instability ?? 0);

    const hazardRouteResult = this.cognitiveDebtManager.onRouteResolved({
      branch,
      outcome,
      context: this.getHazardContext()
    });
    this.addInstability(hazardRouteResult.instabilityDelta);
    if (outcome === 'completed' && branch.routeType === 'repair') {
      this.addInstability(-this.upgradeManager.onRepairResolved());
    }
    const clearedHazards = this.cognitiveDebtManager.clearHazards(hazardRouteResult.clearCount);
    this.gameState.hazardsCleared += clearedHazards;
    this.registerHazards(hazardRouteResult.triggered);
    const anchorResult = outcome === 'completed'
      ? this.powerupManager.onRouteCompleted({
        routeType: branch.routeType,
        perfect: (branch.validator?.mistakeCount ?? 0) === 0
      })
      : { instabilityReduction: 0 };
    this.addInstability(-anchorResult.instabilityReduction);
    const displayedConsequence = {
      ...routeConsequence,
      instability: (consequence.instability ?? 0) + hazardRouteResult.instabilityDelta - anchorResult.instabilityReduction
    };

    if (routeConsequence.flow === 'reset') {
      this.gameState.setFlow(0);
    } else {
      this.gameState.addFlow(routeConsequence.flow ?? 0);
    }

    if (outcome === 'completed') {
      this.gameState.completedPhraseCount += 1;
      this.gameState.phrasesCompleted += 1;
      this.recordContentCompletion(branch.contentEntry);
      if (branch.routeType === 'archive') {
        this.decodeArchiveFragment();
      }
      this.gameState.streak += 1;
      const perfect = (branch.validator?.mistakeCount ?? 0) === 0;
      const upgradeResult = this.upgradeManager.onPhraseCompleted({
        perfect,
        textLength: branch.text.length,
        encounterType: this.runManager.currentEncounter?.type,
        overclockActive: this.powerupManager.hasActiveEffect('overclock'),
        powerupManager: this.powerupManager
      });
      this.addScore(upgradeResult.scoreBonus);
      this.gameState.addFlow(upgradeResult.flowBonus);
      this.addInstability(upgradeResult.instabilityIncrease - upgradeResult.instabilityReduction);
    } else {
      this.gameState.missedPhraseCount += 1;
      this.gameState.phrasesMissed += 1;
      this.gameState.streak = 0;
      this.upgradeManager.onMiss({ gameState: this.gameState });
    }
    this.gameState.forksResolved += 1;
    this.checkEmergencyRepair();

    this.gameState.lastRouteConsequence = this.formatRouteConsequence(branch, displayedConsequence, outcome);
    this.time.delayedCall(2200, () => {
      if (this.gameState) {
        this.gameState.lastRouteConsequence = '';
      }
    });
  }

  finishForkEncounter() {
    this.forkEncounter.complete();
    this.forkView.hideStatus();
    this.hud.setForkStatus('');
    this.isForkActive = false;
    this.isResolvingFork = false;
    this.currentForkHadSplitter = false;
    this.handleContentResolution();
  }

  startMultiStreamEncounter() {
    this.activePhrase = null;
    this.isResolvingPhrase = false;
    this.isMultiStreamActive = true;
    this.multiStreamManager.start({
      speed: this.getCurrentPhraseSpeed(),
      encounterIndex: this.runManager.currentEncounter?.index ?? 0
    });
    this.applyCompressionToStream(this.multiStreamManager.getFocusedStream());
    this.updateMultiStreamHudStatus();
  }

  stopMultiStreamEncounter() {
    if (!this.multiStreamManager) {
      return;
    }

    this.isMultiStreamActive = false;
    this.multiStreamManager.reset();
    this.multiStreamView?.clear();
    this.hud?.setMultiStreamStatus('');
  }

  handleMultiStreamCharacter(character) {
    if (!this.multiStreamManager || this.isRunEnded || this.isTransitioning) {
      return;
    }

    const result = this.multiStreamManager.processCharacter(character);
    if (!result.accepted) {
      return;
    }

    this.activateTypingClock();
    this.gameState.totalInputCount += 1;

    if (result.correct) {
      this.audioManager?.playSfx(this, 'correctKey', { volume: 0.18 });
      this.gameState.correctInputCount += 1;
      this.addScore(difficultyConfig.correctCharScore);
      this.gameState.addFlow(1 + this.upgradeManager.getFlowGainBonus());
    } else {
      this.audioManager?.playSfx(this, 'wrongKey');
      const forgiven = this.powerupManager.forgiveMistake();
      if (!forgiven) {
        this.gameState.mistakeCount += 1;
        this.addInstability(difficultyConfig.wrongKeyInstability * this.powerupManager.getWrongKeyInstabilityMultiplier());
        this.registerHazards(this.cognitiveDebtManager.onWrongKey(this.getHazardContext()));
      }
      this.gameState.setFlow(this.gameState.flow - this.getWrongKeyFlowPenalty());
      this.cameras.main.flash(90, 170, 35, 50, false, null, null);
    }

    if (result.completed) {
      this.resolveMultiStreamResult({
        outcome: 'completed',
        stream: result.stream
      });
    }
  }

  resolveMultiStreamResult(result) {
    const stream = result.stream;
    if (!stream || stream.state === 'resolved') {
      return;
    }

    this.deactivateTypingClock();
    const completed = result.outcome === 'completed';
    const consequence = completed ? stream.rewards : stream.penalties;
    this.applyStreamConsequence(stream, consequence, completed);
    this.multiStreamManager.resolveStream(stream.id);

    if (stream.role === 'primary') {
      this.handleMultiStreamPrimaryResolution();
      return;
    }

    if (!this.isRunEnded && !this.isTransitioning && this.isMultiStreamActive && !this.multiStreamManager.getFocusedStream()) {
      this.time.delayedCall(difficultyConfig.spawnDelayMs, () => {
        if (this.isMultiStreamActive && !this.isTransitioning) {
          this.multiStreamManager.spawnPrimary(this.getCurrentPhraseSpeed(), this.powerupManager.consumeCompressionPrefix());
        }
      });
    }
  }

  applyStreamConsequence(stream, consequence, completed) {
    const streamConsequence = { ...consequence };
    if (!completed && streamConsequence.integrity < 0) {
      streamConsequence.integrity = -this.getMissIntegrityPenalty(Math.abs(streamConsequence.integrity));
    }

    this.addScore(streamConsequence.score ?? 0);
    this.gameState.integrity = Math.min(100, Math.max(0, this.gameState.integrity + (streamConsequence.integrity ?? 0)));
    this.addInstability(streamConsequence.instability ?? 0);

    if (streamConsequence.flowReset) {
      this.gameState.setFlow(0);
    } else {
      this.gameState.addFlow(streamConsequence.flow ?? 0);
    }

    if (streamConsequence.clearHazards) {
      this.gameState.hazardsCleared += this.cognitiveDebtManager.clearHazards(streamConsequence.clearHazards);
    }

    if (streamConsequence.triggerHazard) {
      this.registerHazards(this.cognitiveDebtManager.onPhraseMissed(this.getHazardContext()));
    }

    if (completed && stream.role === 'repair') {
      this.addInstability(-this.upgradeManager.onRepairResolved());
    }

    if (stream.role === 'hazard') {
      if (completed) {
        this.gameState.hazardStreamsResolved += 1;
      } else {
        this.gameState.hazardStreamsMissed += 1;
      }
    } else if (completed && stream.role === 'repair') {
      this.gameState.repairStreamsCompleted += 1;
    } else if (completed && stream.role === 'reward') {
      this.gameState.rewardStreamsCompleted += 1;
    } else if (completed && stream.role === 'archive') {
      this.gameState.archiveStreamsDecoded += 1;
      this.decodeArchiveFragment();
    }

    if (completed) {
      this.audioManager?.playSfx(this, 'phraseComplete');
      this.gameState.completedPhraseCount += 1;
      this.gameState.phrasesCompleted += 1;
      this.recordContentCompletion(stream.contentEntry);
      this.gameState.streak += 1;
      const streamBonus = this.upgradeManager.onSecondaryStreamCompleted(stream);
      this.addScore(streamBonus.scoreBonus);
      this.gameState.addFlow(streamBonus.flowBonus);
    } else {
      if (stream.role === 'primary') {
        this.audioManager?.playSfx(this, 'phraseMiss');
      }
      this.gameState.missedPhraseCount += 1;
      this.gameState.phrasesMissed += 1;
      this.gameState.streak = 0;
      this.upgradeManager.onMiss({ gameState: this.gameState });
    }

    if (completed) {
      const perfect = stream.validator.mistakeCount === 0;
      const powerupResult = this.powerupManager.onPhraseCompleted({
        perfect,
        textLength: stream.phrase.length
      });
      const anchorRouteResult = this.powerupManager.onRouteCompleted({
        routeType: stream.role === 'archive' ? 'archive' : stream.role === 'hazard' ? 'corruption' : stream.role,
        perfect
      });
      const upgradeResult = this.upgradeManager.onPhraseCompleted({
        perfect,
        textLength: stream.phrase.length,
        encounterType: this.runManager.currentEncounter?.type,
        overclockActive: this.powerupManager.hasActiveEffect('overclock'),
        powerupManager: this.powerupManager
      });
      this.addScore(upgradeResult.scoreBonus);
      this.gameState.addFlow(upgradeResult.flowBonus);
      this.addInstability(
        upgradeResult.instabilityIncrease
        - powerupResult.instabilityReduction
        - anchorRouteResult.instabilityReduction
        - upgradeResult.instabilityReduction
      );
    }

    this.checkEmergencyRepair();
  }

  handleMultiStreamPrimaryResolution() {
    const progress = this.runManager.recordResolution();
    this.syncEncounterState();

    if (progress.runComplete) {
      this.gameState.encountersCompleted += 1;
      this.endRun('won');
      return;
    }

    if (progress.encounterComplete) {
      this.gameState.encountersCompleted += 1;
      this.gameState.multiStreamEncountersCompleted += 1;
      this.beginEncounterTransition();
      return;
    }

    this.time.delayedCall(difficultyConfig.spawnDelayMs, () => {
      if (this.isMultiStreamActive && !this.isTransitioning && !this.isRunEnded) {
        this.multiStreamManager.spawnPrimary(this.getCurrentPhraseSpeed(), this.powerupManager.consumeCompressionPrefix());
      }
    });
  }

  updateMultiStreamHudStatus() {
    const focused = this.multiStreamManager.getFocusedStream();
    this.hud.setMultiStreamStatus(
      `Streams ${this.multiStreamManager.streams.length}   Focus ${focused?.role?.toUpperCase() ?? 'NONE'}   Tab: Switch Stream`
    );
  }

  updateForkHudStatus() {
    if (!this.forkEncounter) {
      this.hud.setForkStatus('');
      return;
    }

    if (this.forkEncounter.state === FORK_STATE.TELEGRAPHING) {
      this.hud.setForkStatus('FORK DETECTED');
      return;
    }

    if (this.forkEncounter.state === FORK_STATE.SELECTABLE) {
      this.hud.setForkStatus('TYPE A BRANCH TO COMMIT');
      return;
    }

    if (this.forkEncounter.state === FORK_STATE.COMMITTED) {
      this.hud.setForkStatus(`${routeTypeLabels[this.forkEncounter.committedBranch.routeType]} ROUTE SELECTED`);
      return;
    }

    this.hud.setForkStatus('');
  }

  formatRouteConsequence(branch, consequence, outcome) {
    const routeLabel = routeTypeLabels[branch.routeType];
    const parts = [`${routeLabel} ${outcome.toUpperCase()}`];
    if (consequence.score) parts.push(`${consequence.score > 0 ? '+' : ''}${consequence.score} score`);
    if (consequence.integrity) parts.push(`${consequence.integrity > 0 ? '+' : ''}${consequence.integrity} integrity`);
    if (consequence.flow === 'reset') parts.push('flow reset');
    if (Number.isFinite(consequence.flow) && consequence.flow !== 0) parts.push(`${consequence.flow > 0 ? '+' : ''}${consequence.flow} flow`);
    if (consequence.instability) parts.push(`${consequence.instability > 0 ? '+' : ''}${consequence.instability} instability`);
    return parts.join('   ');
  }

  recordContentSelection(entry) {
    if (!entry) {
      return;
    }

    this.gameState.lastContentId = entry.id;
    this.gameState.lastContentBiome = entry.biome;
    this.gameState.addBiome(entry.biome);
  }

  recordContentCompletion(entry) {
    this.gameState.recordCompletedContent(entry);
  }

  decodeArchiveFragment() {
    const fragment = this.contentSelector.getArchiveFragment({
      encounterIndex: this.runManager.currentEncounter?.index ?? 0
    });
    if (!this.gameState.archiveFragmentsDecoded.some((entry) => entry.id === fragment.id)) {
      this.gameState.archiveFragmentsDecoded.push(fragment);
    }
    this.gameState.lastRouteConsequence = fragment.text;
    this.time.delayedCall(2600, () => {
      if (this.gameState?.lastRouteConsequence === fragment.text) {
        this.gameState.lastRouteConsequence = '';
      }
    });
  }

  handleContentResolution() {
    const progress = this.runManager.recordResolution();
    this.syncEncounterState();

    if (progress.runComplete) {
      this.gameState.encountersCompleted += 1;
      this.endRun('won');
      return;
    }

    if (progress.encounterComplete) {
      this.gameState.encountersCompleted += 1;
      this.beginEncounterTransition();
      return;
    }

    this.time.delayedCall(difficultyConfig.spawnDelayMs, () => this.spawnNextPhrase());
  }

  beginEncounterTransition() {
    this.activePhrase = null;
    this.stopMultiStreamEncounter();
    this.isTransitioning = true;
    const nextEncounter = this.runManager.advanceEncounter();
    this.syncEncounterState();
    this.upgradeManager.beginEncounter();
    this.gameState.syncUpgradeStats(this.upgradeManager);
    if (this.shouldOfferUpgradeReward(nextEncounter)) {
      this.showUpgradeChoices();
      return;
    }
    if (this.shouldOfferPowerupReward(nextEncounter)) {
      this.showPowerupChoices();
      return;
    }
    this.showEncounterTransition(nextEncounter);
  }

  showEncounterTransition(encounter, initial = false) {
    this.isTransitioning = true;
    if (encounter.finale) {
      this.audioManager?.playMusic(this, 'finale');
    }
    const message = this.pickTransitionMessage(encounter);
    const title = encounter.finale ? 'SIGNAL CONVERGENCE' : `${message} ${String(encounter.index + 1).padStart(2, '0')}`;

    if (!this.transitionText) {
      this.transitionText = this.add.text(GAME_WIDTH / 2, 172, '', {
        fontFamily: fontConfig.prompt,
        fontSize: '30px',
        color: '#f5fbff',
        align: 'center',
        backgroundColor: 'rgba(4, 10, 18, 0.72)',
        padding: { x: 22, y: 12 }
      }).setOrigin(0.5).setDepth(700);
    }

    this.transitionText.setText([
      title,
      `${encounter.type.toUpperCase()}   ${encounter.requiredResolutions} SIGNALS`
    ]).setAlpha(1);

    if (encounter.finale) {
      this.cameras.main.flash(260, 245, 245, 255, false, null, null);
    }

    this.time.delayedCall(initial ? 900 : this.runManager.config.transitionDelayMs, () => {
      if (this.isRunEnded) {
        return;
      }

      this.transitionText.setAlpha(0);
      this.isTransitioning = false;
      this.spawnNextPhrase();
    });
  }

  pickTransitionMessage(encounter) {
    return this.contentSelector.getEncounterFlavor(encounter.type, {
      encounterIndex: encounter.index
    });
  }

  endRun(result) {
    if (this.isRunEnded) {
      return;
    }

    this.isRunEnded = true;
    this.isTransitioning = false;
    this.gameState.hazardsCleared += this.cognitiveDebtManager.clearAll();
    this.staticBloomOverlay.setAlpha(0);
    if (result === 'won') {
      this.runManager.win();
    } else {
      this.runManager.lose();
    }
    this.audioManager?.stopMusic(this, 700);
    this.audioManager?.playSfx(this, result === 'won' ? 'victorySting' : 'lossSting');
    this.gameState.result = result;
    this.gameState.mode = 'summary';
    this.gameState.currentScene = 'GameScene';
    this.activePhrase = null;
    this.isForkActive = false;
    this.isResolvingFork = false;
    this.stopMultiStreamEncounter();
    this.debugOverlay.setActivePhraseInfo(null);
    this.debugOverlay.setForkInfo(null);
    this.hud.setForkStatus('');
    this.forkView?.hideStatus();
    this.transitionText?.setAlpha(0);

    if (result === 'won') {
      this.cameras.main.flash(360, 120, 255, 210, false, null, null);
    }

    this.gameState.syncPowerupStats(this.powerupManager);
    this.gameState.syncUpgradeStats(this.upgradeManager);
    const summary = this.runManager.getSummary(this.gameState);
    summary.difficultyMode = this.difficultyMode?.label ?? 'Easy';
    summary.lossReason = result === 'lost' ? 'Integrity reached zero' : 'Finale completed';
    this.lastRunSummary = summary;
    this.profileRunResult = this.profileManager?.recordRun(summary) ?? {
      newBestScore: false,
      newArchiveFragments: [],
      newUnlocks: []
    };
    this.summaryGroups = this.createSummaryGroups(summary);
    this.summaryExpanded = Object.fromEntries(this.summaryGroups.map((group, index) => [index, index <= 1]));
    this.summaryScrollIndex = 0;
    this.summaryPanel = createPopupPanel(this, {
      width: 940,
      height: 600,
      accent: result === 'won' ? visualConfig.colors.green : visualConfig.colors.red
    }).setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10).setDepth(899);
    this.summaryHeaderText = this.add.text(GAME_WIDTH / 2, 112, '', {
      fontFamily: fontConfig.prompt,
      fontSize: '28px',
      color: result === 'won' ? '#8dffd2' : '#ff8b91',
      align: 'center'
    }).setOrigin(0.5).setDepth(900).setShadow(0, 0, result === 'won' ? '#43f7b2' : '#ff4966', VisualSettings.reduceGlow ? 0 : 8);
    this.createSummaryBodyRows(result);
    this.summaryFooterText = this.add.text(GAME_WIDTH / 2, 666, '', {
      fontFamily: fontConfig.mono,
      fontSize: '14px',
      color: '#9bf4ff',
      align: 'center'
    }).setOrigin(0.5).setDepth(900);
    this.renderSummary();
    console.info('Dead Channels run report', this.createRunReport(summary));
  }

  handleSummaryInput(character) {
    const key = character.toLowerCase();
    if (/^[1-9]$/.test(key)) {
      this.toggleSummaryGroup(Number(key) - 1);
    } else if (key === 'w') {
      this.scrollSummary(-1);
    } else if (key === 's') {
      this.scrollSummary(1);
    } else if (key === 'r') {
      this.audioManager?.playSfx(this, 'uiConfirm');
      this.scene.restart({ seed: this.runManager.seed, kitId: this.upgradeManager.startingKit?.id });
    } else if (key === 'n') {
      this.audioManager?.playSfx(this, 'uiConfirm');
      this.scene.restart({ seed: RunManager.createSeed(), kitId: this.upgradeManager.startingKit?.id });
    } else if (key === 'c') {
      this.audioManager?.playSfx(this, 'uiConfirm');
      this.copyRunReport();
    }
  }

  createSummaryBodyRows(result) {
    this.summaryBodyRows.forEach((row) => {
      row.header.destroy();
      row.label.destroy();
      row.value.destroy();
    });
    this.summaryBodyRows = [];

    const startX = GAME_WIDTH / 2 - 405;
    const startY = 154;
    const rowHeight = 23;
    for (let index = 0; index < 21; index += 1) {
      const y = startY + index * rowHeight;
      const header = this.add.text(startX, y, '', {
        fontFamily: fontConfig.ui,
        fontSize: '17px',
        color: result === 'won' ? '#8dffd2' : '#ff8b91'
      }).setOrigin(0, 0).setDepth(900).setShadow(0, 0, result === 'won' ? '#43f7b2' : '#ff4966', VisualSettings.reduceGlow ? 0 : 4);
      const label = this.add.text(startX + 28, y, '', {
        fontFamily: fontConfig.ui,
        fontSize: '16px',
        color: '#64d8ff'
      }).setOrigin(0, 0).setDepth(900);
      const value = this.add.text(startX + 292, y, '', {
        fontFamily: fontConfig.ui,
        fontSize: '16px',
        color: '#f5fbff',
        fixedWidth: 520
      }).setOrigin(0, 0).setDepth(900).setShadow(0, 0, '#35dfff', VisualSettings.reduceGlow ? 0 : 3);
      this.summaryBodyRows.push({ header, label, value });
    }
  }

  createSummaryGroups(summary) {
    const title = summary.result === 'stabilized' ? 'SUMMARY OF SUCCESSFUL RUN' : 'SUMMARY OF FAILED RUN';
    const routeCounts = Object.entries(summary.routeCounts)
      .filter(([, count]) => count > 0)
      .map(([route, count]) => `${route}:${count}`)
      .join('  ') || 'none';
    const archetypeScores = Object.entries(summary.archetypeScores)
      .map(([tag, count]) => `${tag}:${count}`)
      .join('  ') || 'none';
    const newUnlocks = this.profileRunResult?.newUnlocks.map((unlock) => unlock.name).join(', ') || 'none';
    const newFragments = this.profileRunResult?.newArchiveFragments.length ?? 0;
    const profile = this.profileManager?.profile;
    this.summaryTitle = title;
    this.summaryNewBest = Boolean(this.profileRunResult?.newBestScore);

    return [
      {
        title: 'RUN',
        lines: [
          `Final Score: ${Math.round(summary.finalScore)}`,
          `Seed: ${summary.seed}`,
          `Difficulty: ${summary.difficultyMode}`,
          `Encounters: ${summary.encountersCompleted}`,
          `Phrases: ${summary.phrasesCompleted}/${summary.phrasesMissed}`,
          `Forks: ${summary.forksResolved}`,
          `Routes: ${routeCounts}`,
          `Accuracy: ${summary.accuracy}%`,
          `WPM: ${summary.wpm}`,
          `Highest Flow: ${this.formatSummaryNumber(summary.highestFlow)}`,
          `Duration: ${Math.floor(summary.runDurationSeconds / 60)}:${String(summary.runDurationSeconds % 60).padStart(2, '0')}`,
          `Outcome: ${summary.lossReason}`
        ]
      },
      {
        title: 'SIGNAL STATE',
        lines: [
          `Instability: ${this.formatSummaryNumber(summary.finalInstability)}`,
          `Max Instability: ${this.formatSummaryNumber(summary.maxInstability)}`,
          `Final Band: ${summary.finalInstabilityBand}`,
          `Hazards: ${summary.hazardsTriggered}/${summary.hazardsCleared}`,
          `Corruption Routes: ${summary.routeCounts.corruption ?? 0}`,
          `Powerups: ${summary.powerupsAcquired} acquired / ${summary.powerupsActivated} activated`,
          `Mistakes Forgiven: ${summary.mistakesForgiven}`,
          `Compression Triggers: ${summary.compressionTriggers}`,
          `Signal Anchor Triggers: ${summary.signalAnchorTriggers}`
        ]
      },
      {
        title: 'BUILD',
        lines: [
          `Class: ${summary.startingKit}`,
          `Dominant Build: ${summary.dominantArchetype}`,
          `Archetype Scores: ${archetypeScores}`,
          `Upgrades: ${summary.upgradesAcquired.join(', ') || 'none'}`,
          `Perfect Bonuses: ${summary.perfectPhraseBonusesEarned}`,
          `Route Rerolls: ${summary.routeRerollsUsed}`,
          `Overclock Extension: +${this.formatSummaryNumber(summary.overclockExtensionSeconds)}s`
        ]
      },
      {
        title: 'STREAMS AND CONTENT',
        lines: [
          `Multi-stream Encounters: ${summary.multiStreamEncountersCompleted}`,
          `Stream Switches: ${summary.totalStreamSwitches}`,
          `Hazard Streams: ${summary.hazardStreamsResolved}/${summary.hazardStreamsMissed}`,
          `Repairs: ${summary.repairStreamsCompleted}`,
          `Rewards: ${summary.rewardStreamsCompleted}`,
          `Archive Streams: ${summary.archiveStreamsDecoded}`,
          `Fragments This Run: ${summary.archiveFragmentsDecoded.length}`,
          `New Archive Fragments: ${newFragments}`,
          `Total Archive: ${profile?.archiveFragmentsCollected.length ?? 0}`,
          `Biomes: ${summary.biomesEncountered.join(', ') || 'none'}`,
          `Hardest Phrase: ${summary.hardestPhraseCompleted}`,
          `Average Difficulty: ${this.formatSummaryNumber(summary.averagePhraseDifficulty)}`
        ]
      },
      {
        title: 'PROFILE UPDATES',
        lines: [
          `New Best Score: ${this.profileRunResult?.newBestScore ? 'YES' : 'NO'}`,
          `New Unlocks: ${newUnlocks}`,
          `Archive Collection: ${profile?.archiveFragmentsCollected.length ?? 0}`,
          `Total Runs: ${profile?.totalRuns ?? 0}`,
          `Best Score: ${profile?.bestScore ?? 0}`
        ]
      }
    ];
  }

  renderSummary() {
    if (!this.summaryHeaderText || !this.summaryFooterText) {
      return;
    }

    const visibleLines = [];
    this.summaryGroups.forEach((group, index) => {
      const expanded = this.summaryExpanded[index];
      visibleLines.push({
        type: 'header',
        text: `${index + 1}. ${expanded ? '[-]' : '[+]'} ${group.title}`
      });
      if (expanded) {
        group.lines.forEach((line) => visibleLines.push(this.createSummaryLine(line)));
      }
    });

    const maxLines = 21;
    const maxScroll = Math.max(0, visibleLines.length - maxLines);
    this.summaryScrollIndex = Math.max(0, Math.min(this.summaryScrollIndex, maxScroll));
    const windowLines = visibleLines.slice(this.summaryScrollIndex, this.summaryScrollIndex + maxLines);
    const scrollText = maxScroll > 0 ? `SCROLL ${this.summaryScrollIndex + 1}-${Math.min(visibleLines.length, this.summaryScrollIndex + maxLines)}/${visibleLines.length}` : 'SCROLL LOCKED';
    this.summaryHeaderText.setText([
      this.summaryTitle,
      this.summaryNewBest ? 'NEW BEST SCORE' : ''
    ].filter(Boolean));
    this.summaryBodyRows.forEach((row, index) => {
      const line = windowLines[index];
      row.header.setText('');
      row.label.setText('');
      row.value.setText('');

      if (!line) {
        return;
      }

      if (line.type === 'header') {
        row.header.setText(line.text);
        return;
      }

      row.label.setText(line.label);
      row.value.setText(line.value);
    });
    this.summaryFooterText.setText(`${scrollText}     1-5 EXPAND/COLLAPSE     W/S OR ARROWS SCROLL     R SAME SEED     N NEW SEED     C COPY     ESC MENU`);
  }

  createSummaryLine(line) {
    const splitIndex = line.indexOf(':');
    if (splitIndex === -1) {
      return { type: 'item', label: line, value: '' };
    }

    return {
      type: 'item',
      label: line.slice(0, splitIndex + 1),
      value: line.slice(splitIndex + 1).trim()
    };
  }

  formatSummaryNumber(value) {
    if (!Number.isFinite(value)) {
      return String(value);
    }

    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  toggleSummaryGroup(index) {
    if (!this.summaryGroups[index]) {
      return;
    }

    this.summaryExpanded[index] = !this.summaryExpanded[index];
    this.audioManager?.playSfx(this, 'uiConfirm', { volume: 0.45 });
    this.renderSummary();
  }

  scrollSummary(direction) {
    if (!this.isRunEnded || !this.summaryGroups.length) {
      return;
    }

    this.summaryScrollIndex += direction * 3;
    this.renderSummary();
  }

  createRunReport(summary) {
    return {
      seed: summary.seed,
      result: summary.result,
      score: summary.finalScore,
      durationSeconds: summary.runDurationSeconds,
      accuracy: summary.accuracy,
      wpm: summary.wpm,
      phrasesCompleted: summary.phrasesCompleted,
      phrasesMissed: summary.phrasesMissed,
      forksResolved: summary.forksResolved,
      streamsResolved: summary.hazardStreamsResolved + summary.repairStreamsCompleted + summary.rewardStreamsCompleted + summary.archiveStreamsDecoded,
      hazardStreamsMissed: summary.hazardStreamsMissed,
      hazardsTriggered: summary.hazardsTriggered,
      powerupsActivated: summary.powerupsActivated,
      upgradesAcquired: summary.upgradesAcquired,
      difficultyMode: summary.difficultyMode,
      finalInstability: summary.finalInstability,
      lossReason: summary.lossReason
    };
  }

  copyRunReport() {
    const report = JSON.stringify(this.createRunReport(this.lastRunSummary), null, 2);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(report).catch(() => console.info('Run report copy failed', report));
    } else {
      console.info('Run report', report);
    }
  }

  syncEncounterState() {
    const encounter = this.runManager.currentEncounter;
    if (!encounter) {
      return;
    }

    this.gameState.encounterIndex = encounter.index;
    this.gameState.encounterType = encounter.type;
    this.gameState.encounterProgress = encounter.progress;
    this.gameState.encounterRequired = encounter.requiredResolutions;
    this.gameState.totalEncounters = this.runManager.encounterManager.getTotalEncounters();
    this.gameState.runSeed = this.runManager.seed;
  }

  getCurrentPhraseSpeed() {
    return Math.round(
      difficultyConfig.phraseSpeed
      * (this.runManager.currentEncounter?.speedMultiplier ?? 1)
      * this.powerupManager.getSpeedMultiplier()
      * (this.difficultyMode?.phraseSpeedMultiplier ?? 1)
    );
  }

  isTypingInputActive(modalPaused = false) {
    if (this.isRunEnded || this.isTransitioning || modalPaused) {
      return false;
    }

    if (this.activePhrase && !this.isResolvingPhrase) {
      return this.activePhrase.state === STREAM_PHRASE_STATE.ACTIVE;
    }

    if (this.isMultiStreamActive) {
      return Boolean(this.multiStreamManager.getFocusedStream());
    }

    if (this.isForkActive && !this.isResolvingFork) {
      return true;
    }

    return false;
  }

  activateTypingClock() {
    this.gameState.hasTyped = true;
    this.gameState.typingClockActive = true;
  }

  deactivateTypingClock() {
    this.gameState.typingClockActive = false;
  }

  updateTypingClockState(modalPaused = false) {
    if (!this.isTypingInputActive(modalPaused)) {
      this.deactivateTypingClock();
    }
  }

  getCurrentForkEvery() {
    return Math.max(2, (this.runManager.currentEncounter?.forkEvery ?? forkConfig.phrasesBetweenForks)
      + (this.difficultyMode?.forkFrequencyOffset ?? 0));
  }

  getForkConfigForEncounter({ consumeForkSplitter = false } = {}) {
    const encounter = this.runManager?.currentEncounter;
    let routeTypes = ['safe', 'reward', 'repair', 'archive', 'corruption'];

    if (encounter && (encounter.type === 'pressure' || encounter.type === 'finale')) {
      routeTypes = ['safe', 'reward', 'repair', 'archive', 'corruption', 'corruption'];
    } else if (encounter?.type === 'recovery') {
      routeTypes = ['safe', 'safe', 'repair', 'repair', 'archive'];
    }

    if (consumeForkSplitter) {
      routeTypes = this.upgradeManager.applyRoutePool(routeTypes);
    }
    const extraBranches = consumeForkSplitter ? this.powerupManager.consumeForkSplitter() : 0;
    const baseMax = forkConfig.branchCountMax + extraBranches;
    const branchCountMax = Math.min(powerupConfig.maxBranchCountWithForkSplitter, baseMax);

    return {
      ...forkConfig,
      branchCountMin: extraBranches ? branchCountMax : forkConfig.branchCountMin,
      branchCountMax,
      maxBranchCount: branchCountMax,
      telegraphDurationMs: forkConfig.telegraphDurationMs
        + this.powerupManager.getForkTelegraphBonusMs()
        + this.upgradeManager.getForkTelegraphBonusMs(),
      selectionTimeoutMs: Math.max(5200, forkConfig.selectionTimeoutMs - (encounter?.index ?? 0) * 220),
      defaultRouteTypes: routeTypes,
      encounterIndex: encounter?.index ?? 0
    };
  }

  updatePowerups(delta) {
    if (!this.powerupManager || this.isRunEnded) {
      return;
    }

    const overclockInstability = this.powerupManager.getOverclockInstabilityPerSecond();
    if (overclockInstability > 0 && !this.isTransitioning && !this.isChoosingPowerup && !this.isChoosingUpgrade) {
      this.addInstability(
        overclockInstability
        * this.upgradeManager.getOverclockInstabilityMultiplier()
        * (delta / 1000)
      );
    }

    this.gameState.syncPowerupStats(this.powerupManager);
    this.gameState.syncUpgradeStats(this.upgradeManager);
    this.hud.setPowerupLines(this.powerupManager.getHudLines());
  }

  addScore(value) {
    this.gameState.score += Math.round(
      value
      * (this.difficultyMode?.scoreMultiplier ?? 1)
      * this.powerupManager.getScoreMultiplier()
      * this.upgradeManager.getScoreMultiplier({
        encounterType: this.runManager.currentEncounter?.type,
        speedMultiplier: this.runManager.currentEncounter?.speedMultiplier ?? 1
      })
    );
  }

  tryActivatePowerup(slotIndex) {
    const activated = this.powerupManager.activateSlot(slotIndex);
    if (!activated) {
      return false;
    }

    this.audioManager?.playSfx(this, 'powerupActive');
    this.gameState.syncPowerupStats(this.powerupManager);
    this.gameState.syncUpgradeStats(this.upgradeManager);
    return true;
  }

  applyCompressionToActivePhrase() {
    const prefixCount = Math.min(
      this.powerupManager.consumeCompressionPrefix(),
      Math.max(0, this.activePhrase.text.length - 1)
    );

    for (let index = 0; index < prefixCount; index += 1) {
      this.activePhrase.processCharacter(this.activePhrase.text[index]);
    }
  }

  applyCompressionToStream(stream) {
    if (!stream) {
      return;
    }

    const prefixCount = Math.min(
      this.powerupManager.consumeCompressionPrefix(),
      Math.max(0, stream.phrase.length - 1)
    );

    for (let index = 0; index < prefixCount; index += 1) {
      stream.processCharacter(stream.phrase[index]);
    }
  }

  shouldOfferPowerupReward(nextEncounter) {
    return !nextEncounter.finale
      && this.gameState.encountersCompleted > 0
      && this.gameState.encountersCompleted % powerupConfig.encounterRewardFrequency === 0;
  }

  shouldOfferUpgradeReward(nextEncounter) {
    return !nextEncounter.finale
      && upgradeConfig.upgradeRewardEncounterIndices.includes(this.gameState.encountersCompleted);
  }

  showUpgradeChoices() {
    this.isChoosingUpgrade = true;
    const choices = this.upgradeManager.generateRewardChoices();
    if (!choices.length) {
      this.isChoosingUpgrade = false;
      this.showEncounterTransition(this.runManager.currentEncounter);
      return;
    }

    if (this.upgradeChoiceContainer) {
      this.upgradeChoiceContainer.destroy(true);
    }

    this.upgradeChoiceContainer = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(890);
    const panel = createPopupPanel(this, { width: 640, height: 300, accent: 0x35dfff });
    const title = this.add.text(0, -102, 'BUILD UPGRADE', {
      fontFamily: fontConfig.title,
      fontSize: '28px',
      color: '#f5fbff',
      align: 'center'
    }).setOrigin(0.5).setShadow(0, 0, '#35dfff', VisualSettings.reduceGlow ? 0 : 8);

    this.upgradeChoiceContainer.add([panel, title]);
    choices.forEach((choice, index) => {
      const choiceText = this.add.text(0, -34 + index * 52, `[${index + 1}] ${choice.name}`, {
        fontFamily: fontConfig.ui,
        fontSize: '26px',
        color: this.getRarityColor(choice.rarity),
        align: 'center'
      }).setOrigin(0.5).setShadow(0, 0, this.getRarityColor(choice.rarity), VisualSettings.reduceGlow ? 0 : 6);
      this.upgradeChoiceContainer.add(choiceText);
    });

    const prompt = this.add.text(0, 116, 'PRESS 1 / 2 / 3', {
      fontFamily: fontConfig.prompt,
      fontSize: '18px',
      color: '#8fb8c7',
      align: 'center'
    }).setOrigin(0.5);
    this.upgradeChoiceContainer.add(prompt);
  }

  handleUpgradeChoiceInput(character) {
    const choiceIndex = Number(character) - 1;
    if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= this.upgradeManager.rewardChoices.length) {
      return;
    }

    const choice = this.upgradeManager.rewardChoices[choiceIndex];
    this.upgradeManager.acquire(choice.id);
    this.audioManager?.playSfx(this, 'uiConfirm');
    this.gameState.syncUpgradeStats(this.upgradeManager);
    this.upgradeChoiceText?.setAlpha(0);
    this.upgradeChoiceContainer?.destroy(true);
    this.upgradeChoiceContainer = null;
    this.isChoosingUpgrade = false;
    this.showEncounterTransition(this.runManager.currentEncounter);
  }

  getRarityColor(rarity) {
    if (rarity === 'rare') return '#ff9f43';
    if (rarity === 'uncommon') return '#43f7b2';
    return '#ffffff';
  }

  showPowerupChoices() {
    this.isChoosingPowerup = true;
    const choices = this.powerupManager.generateRewardChoices();
    if (!choices.length) {
      this.isChoosingPowerup = false;
      this.showEncounterTransition(this.runManager.currentEncounter);
      return;
    }

    if (this.powerupChoiceContainer) {
      this.powerupChoiceContainer.destroy(true);
    }

    this.powerupChoiceContainer = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(880);
    const panel = createPopupPanel(this, { width: 680, height: 320, accent: 0xb388ff });
    const title = this.add.text(0, -112, 'SIGNAL MODIFIER', {
      fontFamily: fontConfig.title,
      fontSize: '28px',
      color: '#f5fbff',
      align: 'center'
    }).setOrigin(0.5).setShadow(0, 0, '#b388ff', VisualSettings.reduceGlow ? 0 : 8);

    this.powerupChoiceContainer.add([panel, title]);
    choices.forEach((choice, index) => {
      const choiceText = this.add.text(0, -42 + index * 54, `[${index + 1}] ${choice.name}`, {
        fontFamily: fontConfig.ui,
        fontSize: '25px',
        color: this.getRarityColor(choice.rarity),
        align: 'center'
      }).setOrigin(0.5).setShadow(0, 0, this.getRarityColor(choice.rarity), VisualSettings.reduceGlow ? 0 : 6);
      this.powerupChoiceContainer.add(choiceText);
    });

    const prompt = this.add.text(0, 122, 'PRESS 1 / 2 / 3', {
      fontFamily: fontConfig.prompt,
      fontSize: '18px',
      color: '#8fb8c7',
      align: 'center'
    }).setOrigin(0.5);
    this.powerupChoiceContainer.add(prompt);
  }

  handlePowerupChoiceInput(character) {
    const choiceIndex = Number(character) - 1;
    if (!Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex >= this.powerupManager.rewardChoices.length) {
      return;
    }

    const choice = this.powerupManager.rewardChoices[choiceIndex];
    this.powerupManager.acquire(choice.id);
    this.audioManager?.playSfx(this, 'powerupActive');
    this.gameState.syncPowerupStats(this.powerupManager);
    this.powerupChoiceText?.setAlpha(0);
    this.powerupChoiceContainer?.destroy(true);
    this.powerupChoiceContainer = null;
    this.isChoosingPowerup = false;
    this.showEncounterTransition(this.runManager.currentEncounter);
  }

  isModalPaused() {
    return this.isChoosingPowerup || this.isChoosingUpgrade;
  }

  updateHazards(delta) {
    if (!this.cognitiveDebtManager || this.isRunEnded) {
      return;
    }

    const band = this.cognitiveDebtManager.getBand(this.gameState.instability);
    this.gameState.instabilityBand = band.label;
    this.gameState.maxInstability = Math.max(this.gameState.maxInstability, this.gameState.instability);
    this.gameState.timeInInstabilityBands[band.key] += delta;

    const result = this.cognitiveDebtManager.update(delta, this.getHazardContext());
    this.gameState.hazardsCleared += result.cleared;
    this.registerHazards(result.triggered);
    this.updateHazardHudStatus();
    this.updateStaticBloom();
  }

  updateHazardHudStatus() {
    const hazards = this.cognitiveDebtManager.getActiveHazards();

    if (!hazards.length) {
      this.hud.setHazardStatus('');
      return;
    }

    const labels = [...new Set(hazards.map((hazard) => {
      if (hazard.type === 'letterJitter') return 'JITTER';
      if (hazard.type === 'ghostText') return 'GHOST';
      if (hazard.type === 'staticBloom') return 'STATIC';
      if (hazard.type === 'reducedPreview') return 'PREVIEW LOSS';
      if (hazard.type === 'corruptedHint') return 'CORRUPT HINT';
      return hazard.type.toUpperCase();
    }))];

    this.hud.setHazardStatus(`Hazards: ${labels.join('  ')}`);
  }

  updateStaticBloom() {
    const bloomHazards = this.cognitiveDebtManager.getActiveHazards('staticBloom');
    if (!bloomHazards.length) {
      this.staticBloomOverlay.setAlpha(0);
      return;
    }

    const strongest = bloomHazards.reduce((max, hazard) => Math.max(max, hazard.intensity), 0);
    const flicker = Math.sin(this.time.now / 32) * 0.025;
    this.staticBloomOverlay.setAlpha(Math.min(0.16, 0.08 + strongest * 0.04 + flicker));
  }

  registerHazards(hazards) {
    const newHazards = (hazards ?? []).filter(Boolean);
    if (!newHazards.length) {
      return;
    }

    this.audioManager?.playSfx(this, 'hazardHit');
    this.gameState.hazardsTriggered += newHazards.length;
    this.gameState.lastHazardType = newHazards[newHazards.length - 1].type;
  }

  addInstability(value) {
    const kitMultiplier = value > 0 ? this.upgradeManager.startingKit?.instabilityGainMultiplier ?? 1 : 1;
    const difficultyMultiplier = value > 0 ? this.difficultyMode?.instabilityPenaltyMultiplier ?? 1 : 1;
    this.gameState.instability = Math.max(0, this.gameState.instability + value * kitMultiplier * difficultyMultiplier);
    this.gameState.maxInstability = Math.max(this.gameState.maxInstability, this.gameState.instability);
    this.gameState.instabilityBand = this.cognitiveDebtManager.getBand(this.gameState.instability).label;
  }

  getHazardContext() {
    return {
      instability: this.gameState.instability,
      encounterType: this.runManager.currentEncounter?.type ?? 'normal',
      encounterMultiplier: (hazardConfig.encounterHazardMultipliers[this.runManager.currentEncounter?.type ?? 'normal'] ?? 1)
        * (this.difficultyMode?.hazardMultiplier ?? 1),
      hazardDurationMultiplier: this.upgradeManager.getHazardDurationMultiplier()
    };
  }

  getWrongKeyFlowPenalty() {
    return difficultyConfig.wrongKeyFlowPenalty * this.upgradeManager.getMistakeFlowPenaltyMultiplier();
  }

  getMissIntegrityPenalty(basePenalty) {
    return Math.round(basePenalty
      * this.upgradeManager.getMissIntegrityMultiplier()
      * (this.difficultyMode?.integrityPenaltyMultiplier ?? 1));
  }

  checkEmergencyRepair() {
    if (this.upgradeManager.tryEmergencyRepair(this.gameState)) {
      this.cameras.main.flash(140, 90, 230, 255, false, null, null);
    }
  }

  shutdownInput() {
    this.cognitiveDebtManager?.clearAll();
    this.backgroundRenderer?.destroy();
    this.backgroundRenderer = null;

    if (this.inputManager) {
      this.inputManager.destroy();
      this.inputManager = null;
    }
  }
}
