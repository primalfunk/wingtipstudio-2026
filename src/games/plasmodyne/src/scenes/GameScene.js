import Phaser from 'phaser';
import { BODY_STABILITY, COLORS, DEBUG, DIFFICULTY_LEVELS, DROID_GENERATION, INTERACTION, PLAYER, SHIP_GENERATION, STARTING_BODY, TRANSFER } from '../data/constants.js';
import { PlayerController } from '../entities/PlayerController.js';
import { Droid } from '../entities/Droid.js';
import { Door } from '../entities/Door.js';
import { ShipGenerator } from '../systems/ShipGenerator.js';
import { DroidFactory } from '../systems/DroidFactory.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { TransferSystem } from '../systems/TransferSystem.js';
import { MapSystem } from '../systems/MapSystem.js';
import { VisionSystem } from '../systems/VisionSystem.js';
import { GameAudio } from '../systems/GameAudio.js';
import { LiftOverlay } from '../ui/LiftOverlay.js';
import { TransferOverlay } from '../ui/TransferOverlay.js';
import { TerminalOverlay } from '../ui/TerminalOverlay.js';
import { InteractOrbitEffect } from '../ui/effects/InteractOrbitEffect.js';
import { DamageHealthBar } from '../ui/effects/DamageHealthBar.js';
import { ScoreDisplay } from '../ui/ScoreDisplay.js';
import { DeckArrivalAlert } from '../ui/DeckArrivalAlert.js';
import { StartBriefingCard } from '../ui/StartBriefingCard.js';
import { brightenColor, getClearedDeckPalette, getDeckPalette } from '../graphics/deckPalettes.js';
import { getFloorTileKey, getWallModuleKey } from '../graphics/deckPatternTextures.js';
import { DROID_EXPLOSION } from '../graphics/droidAnimationAssets.js';
import { UI_THEME } from '../ui/UiTheme.js';
import { TILE_TYPES } from '../data/tileTypes.js';
import { footprintToWorldRect } from '../utils/gridGeometry.js';
import { getDeckInfo } from '../data/deckNames.js';
import { AiPlayerController } from '../aiPlayer/AiPlayerController.js';
import { getElevatorShaftColor } from '../ui/ElevatorShaftColors.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create(data = {}) {
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.generator = new ShipGenerator();
    this.droidFactory = new DroidFactory();
    this.combat = new CombatSystem(this);
    this.visionSystem = new VisionSystem(this);
    this.audio = new GameAudio(this);
    this.transferSystem = new TransferSystem(this);
    this.input.mouse?.disableContextMenu();
    this.seed = data.seed ?? SHIP_GENERATION.seed;
    this.difficulty = DIFFICULTY_LEVELS[data.difficulty] ? data.difficulty : 'normal';
    this.showNewGameFocus = Boolean(data.showNewGameFocus);
    this.ship = this.generator.generateShip(this.seed);
    this.droidFactory.populateShip(this.ship, { difficulty: this.difficulty });
    this.runStats = this.createRunStats();
    this.repairScoreDrainAccumulator = 0;
    this.currentDeck = this.getDeckById(this.ship.currentDeckId);
    this.audio.playDeckMusic(this.currentDeck.id, this.currentDeck.cleared);

    this.renderCurrentDeck();
    this.createPlayerAtStart();
    this.createUi();
    this.bindKeys();
    this.aiPlayer = new AiPlayerController(this);
    this.inputState = {
      leftDownAt: null,
      leftHoldStarted: false,
      currentInteractTarget: null,
      suppressLeftUntilRelease: false,
      spaceDownAt: null,
      spaceTransferStarted: false,
      holdMs: 275
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.refreshDeckState();
    this.createOnboarding();
    this.disableWeaponsFor(2000);
  }

  createRunStats() {
    const totalDroids = this.ship.decks.reduce((sum, deck) => sum + (deck.droids?.length ?? 0), 0);
    return {
      seed: this.seed,
      difficulty: this.difficulty,
      startedAt: this.time.now,
      elapsedMs: 0,
      result: 'In Progress',
      cause: '',
      droidsNeutralized: 0,
      totalDroids,
      decksCleared: 0,
      roomsCleared: 0,
      bodiesPossessed: 0,
      highestRankPossessed: 1,
      highestRankNeutralized: 0,
      transfersAttempted: 0,
      transfersSucceeded: 0,
      transfersFailed: 0,
      totalDeaths: 0,
      score: 0,
      deckResetCountByDeck: {},
      longestBodyId: '001',
      currentBodyStartedAt: this.time.now,
      bodyUseMs: { '001': 0 }
    };
  }

  update(time, delta) {
    this.updateWeaponEnableOverlay(time);

    if (this.startBriefingCard?.isVisible()) {
      this.startBriefingCard.update(time);
      this.aiPlayer?.update(time, delta);
      const body = this.player?.sprite?.body;
      body?.setAcceleration(0, 0);
      body?.setVelocity(0, 0);
      this.updateDamageHealthBars(time);
      return;
    }

    if (this.isRespawning) {
      this.aiPlayer?.update(time, delta);
      this.player.update(0);
      this.updateDamageHealthBars(time);
      this.updateRespawnState(time);
      return;
    }

    if (this.isTransferFinalizing) {
      this.updateTransferFinalization(time);
      return;
    }

    if (this.transferOverlay.isVisible()) {
      this.aiPlayer?.update(time, delta);
      this.maintainTransferEncounterLock();
      this.transferOverlay.update(time, delta);
      return;
    }

    if (this.terminalOverlay.isVisible()) {
      this.aiPlayer?.update(time, delta);
      this.player.update(0);
      if (Phaser.Input.Keyboard.JustDown(this.interactKey) || Phaser.Input.Keyboard.JustDown(this.spaceKey) || Phaser.Input.Keyboard.JustDown(this.escKey)) {
        this.terminalOverlay.hide();
        this.disableWeaponsFor(2000);
      }
      return;
    }

    if (this.liftOverlay.isVisible()) {
      this.aiPlayer?.update(time, delta);
      this.player.update(0);
      this.liftOverlay.update(time);
      this.handleLiftSelection();
      return;
    }

    if (this.isChangingDeck) {
      this.player.update(0);
      return;
    }

    this.aiPlayer?.update(time, delta);
    this.player.update(delta);
    this.updateRunTimers(delta);
    this.enforcePlayerContainment();
    this.updateCollisionDebug();
    this.updateDroids(time, delta);
    this.updateDamageHealthBars(time);
    this.combat.update(time, delta);
    this.updateDoors(time);
    this.updateBodyStability(delta);
    this.updateRepairPads(delta);
    this.refreshDeckState();
    this.handleInput();
    if (!this.aiPlayer?.enabled) {
      this.handlePressAndHoldControls(time);
    }
    this.updateOnboarding();
  }

  updateRunTimers(delta) {
    this.runStats.elapsedMs += delta;
    const bodyId = this.player.bodyData.displayId;
    this.runStats.bodyUseMs[bodyId] = (this.runStats.bodyUseMs[bodyId] ?? 0) + delta;
    this.runStats.longestBodyId = Object.entries(this.runStats.bodyUseMs)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? bodyId;
  }

  bindKeys() {
    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.liftUpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.liftDownKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.liftArrowUpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.liftArrowDownKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.regenerateKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.pageUpKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.PAGE_UP);
    this.pageDownKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.PAGE_DOWN);
    this.killDeckKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K);
    this.killShipKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L);
    this.bodyCardKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    this.collisionDebugKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F9);
    this.collisionDebugAltKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.BACKTICK ?? 192);
    this.wallFillDebugKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F10);
    this.hudDebugKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F3);
    this.aiToggleKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F8);
    this.aiExportKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F7);
    this.numberKeys = [
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR)
    ];
  }

  createPlayerAtStart() {
    const startRoom = this.currentDeck.rooms.find((room) => room.id === this.currentDeck.startRoomId);
    startRoom.discovered = true;
    this.player = new PlayerController(this, startRoom.centerX, startRoom.centerY, STARTING_BODY, PLAYER);
    this.attachPlayerCollider();
    this.lastSafePlayerPosition = { x: this.player.sprite.x, y: this.player.sprite.y };

    this.cameras.main.startFollow(this.player.sprite, true, PLAYER.cameraLerp, PLAYER.cameraLerp);
    this.cameras.main.setZoom(PLAYER.cameraZoom);
    this.updateCameraBounds();
  }

  createUi() {
    this.scoreDisplay = new ScoreDisplay(this);
    this.scoreDisplay.setScore(this.runStats.score);
    this.liftOverlay = new LiftOverlay(this);
    this.transferOverlay = new TransferOverlay(this);
    this.terminalOverlay = new TerminalOverlay(this);
    this.interactOrbit = new InteractOrbitEffect(this);
    this.deckArrivalAlert = new DeckArrivalAlert(this);
    this.startBriefingCard = new StartBriefingCard(this);
  }

  createOnboarding() {
    this.onboarding = {
      focusComplete: !this.showNewGameFocus,
      tipsStarted: false
    };
    if (this.showNewGameFocus) {
      this.startBriefingCard.show();
    }
  }

  onStartBriefingDismissed() {
    this.startPlayerFocusMoment();
  }

  startPlayerFocusMoment() {
    const { sprite } = this.player;
    this.cameras.main.centerOn(sprite.x, sprite.y);
    this.audio?.playDroidSpawn();
    this.disableWeaponsFor(2000);

    this.playerFocusFx = this.add.graphics();
    this.playerFocusFx.setDepth(32);
    const activeText = this.add.text(this.scale.width / 2, this.scale.height * 0.68, '>> UNIT 001 ACTIVE', {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '18px',
      color: '#d9f4ff',
      letterSpacing: 1
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1200).setAlpha(0);
    activeText.setShadow(0, 0, '#78f0ff', 9, true, true);
    this.tweens.add({
      targets: activeText,
      alpha: 1,
      duration: 180,
      yoyo: true,
      hold: 2200,
      onComplete: () => activeText.destroy()
    });

    const pulseTimer = this.time.addEvent({
      delay: 280,
      repeat: 10,
      callback: () => {
        if (!this.player?.sprite?.active) {
          return;
        }
        sprite.setTint(0xffffff);
        this.time.delayedCall(110, () => sprite.clearTint());
        this.spawnPlayerFocusRing(sprite.x, sprite.y);
      }
    });

    this.time.delayedCall(3000, () => {
      pulseTimer.remove(false);
      sprite.clearTint();
      this.playerFocusFx?.clear();
      if (this.onboarding) {
        this.onboarding.focusComplete = true;
      }
    });
  }

  freezeTransferEncounter(target) {
    if (!target?.sprite?.active || !this.player?.sprite?.active) {
      return;
    }
    this.transferEncounterLock = {
      target,
      playerX: this.player.sprite.x,
      playerY: this.player.sprite.y,
      targetX: target.sprite.x,
      targetY: target.sprite.y,
      playerBodyWasEnabled: Boolean(this.player.sprite.body?.enable),
      targetBodyWasEnabled: Boolean(target.sprite.body?.enable)
    };
    this.setBodyFrozenAt(this.player.sprite, this.transferEncounterLock.playerX, this.transferEncounterLock.playerY, true);
    this.setBodyFrozenAt(target.sprite, this.transferEncounterLock.targetX, this.transferEncounterLock.targetY, true);
    this.player.visual?.update(this.transferEncounterLock.playerX, this.transferEncounterLock.playerY, this.player.bodyData.displayId);
    target.visual?.update(this.transferEncounterLock.targetX, this.transferEncounterLock.targetY, target.data?.displayId ?? target.data?.template?.displayId);
  }

  maintainTransferEncounterLock() {
    const lock = this.transferEncounterLock;
    if (!lock) {
      return;
    }
    this.setBodyFrozenAt(this.player.sprite, lock.playerX, lock.playerY, true);
    this.player.visual?.update(lock.playerX, lock.playerY, this.player.bodyData.displayId);
    if (lock.target?.sprite?.active) {
      this.setBodyFrozenAt(lock.target.sprite, lock.targetX, lock.targetY, true);
      lock.target.visual?.update(lock.targetX, lock.targetY, lock.target.data?.displayId ?? lock.target.data?.template?.displayId);
    }
  }

  releaseTransferEncounterLock({ restorePlayer = true, restoreTarget = true } = {}) {
    const lock = this.transferEncounterLock;
    this.transferEncounterLock = null;
    if (!lock) {
      return;
    }
    if (restorePlayer && this.player?.sprite?.body) {
      this.player.sprite.body.enable = lock.playerBodyWasEnabled;
      this.player.sprite.body.setVelocity(0, 0);
      this.player.sprite.body.setAcceleration(0, 0);
    }
    if (restoreTarget && lock.target?.sprite?.body) {
      lock.target.sprite.body.enable = lock.targetBodyWasEnabled;
      lock.target.sprite.body.setVelocity(0, 0);
      lock.target.sprite.body.setAcceleration(0, 0);
    }
  }

  setBodyFrozenAt(sprite, x, y, disableBody = false) {
    sprite.setPosition(x, y);
    if (!sprite.body) {
      return;
    }
    sprite.body.setVelocity(0, 0);
    sprite.body.setAcceleration(0, 0);
    if (disableBody) {
      sprite.body.enable = false;
    }
  }

  disableWeaponsFor(durationMs = 2000) {
    const until = this.time.now + durationMs;
    this.weaponDisabledUntil = Math.max(this.weaponDisabledUntil ?? 0, until);
    this.showWeaponEnableOverlay(this.weaponDisabledUntil);
  }

  areWeaponsEnabled(time = this.time.now) {
    return time >= (this.weaponDisabledUntil ?? 0);
  }

  showWeaponEnableOverlay(untilTime) {
    if (!this.weaponEnableContainer) {
      const { width } = this.scale;
      this.weaponEnableContainer = this.add.container(width / 2, 92);
      this.weaponEnableContainer.setScrollFactor(0);
      this.weaponEnableContainer.setDepth(1550);

      const bg = this.add.graphics();
      const text = this.add.text(0, 0, 'ENABLING WEAPONS...', {
        fontFamily: UI_THEME.fontFamily,
        fontSize: '15px',
        color: '#d9f4ff',
        letterSpacing: 1
      }).setOrigin(0.5);
      text.setShadow(0, 0, '#78f0ff', 7, true, true);

      this.weaponEnableContainer.add([bg, text]);
      this.weaponEnableOverlay = { bg, text, untilTime };
      this.scale.on('resize', this.positionWeaponEnableOverlay, this);
      this.positionWeaponEnableOverlay();
    }

    this.weaponEnableOverlay.untilTime = untilTime;
    this.weaponEnableContainer.setVisible(true);
    this.weaponEnableContainer.setAlpha(1);
  }

  positionWeaponEnableOverlay() {
    if (!this.weaponEnableContainer) {
      return;
    }
    this.weaponEnableContainer.setPosition(this.scale.width / 2, 92);
  }

  updateWeaponEnableOverlay(time) {
    if (!this.weaponEnableOverlay || !this.weaponEnableContainer?.visible) {
      return;
    }
    const remaining = Math.max(0, this.weaponEnableOverlay.untilTime - time);
    if (remaining <= 0) {
      this.weaponEnableContainer.setVisible(false);
      return;
    }

    const seconds = Math.ceil(remaining / 1000);
    const pulse = 0.72 + Math.sin(time * 0.012) * 0.18;
    const text = `ENABLING WEAPONS... ${seconds}`;
    this.weaponEnableOverlay.text.setText(text);
    this.weaponEnableContainer.setAlpha(pulse);
    this.weaponEnableOverlay.bg.clear();
    this.weaponEnableOverlay.bg.fillStyle(0x031019, 0.62);
    this.weaponEnableOverlay.bg.fillRoundedRect(-142, -15, 284, 30, 4);
    this.weaponEnableOverlay.bg.lineStyle(1, 0x78f0ff, 0.5);
    this.weaponEnableOverlay.bg.strokeRoundedRect(-142, -15, 284, 30, 4);
    this.weaponEnableOverlay.bg.lineStyle(1, 0xffd447, 0.36);
    this.weaponEnableOverlay.bg.lineBetween(-118, 14, -72, 14);
    this.weaponEnableOverlay.bg.lineBetween(72, 14, 118, 14);
  }

  spawnPlayerFocusRing(x, y) {
    const ring = this.add.circle(x, y, 20, 0xd9f4ff, 0);
    ring.setStrokeStyle(2, 0xd9f4ff, 0.9);
    ring.setDepth(31);
    this.tweens.add({
      targets: ring,
      scale: 3.2,
      alpha: 0,
      duration: 520,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy()
    });
  }

  updateOnboarding() {
    if (!this.onboarding?.focusComplete || this.onboarding.tipsStarted) {
      return;
    }
    if (!this.player?.hasMovementInput()) {
      return;
    }
    this.onboarding.tipsStarted = true;
  }

  resetInputState() {
    if (!this.inputState) {
      return;
    }
    this.inputState.leftDownAt = null;
    this.inputState.leftHoldStarted = false;
    this.inputState.currentInteractTarget = null;
    this.inputState.suppressLeftUntilRelease = false;
    this.inputState.spaceDownAt = null;
    this.inputState.spaceTransferStarted = false;
  }

  handleInput() {
    if (Phaser.Input.Keyboard.JustDown(this.aiToggleKey)) {
      this.aiPlayer?.setEnabled(!this.aiPlayer.enabled);
    }

    if (Phaser.Input.Keyboard.JustDown(this.aiExportKey)) {
      this.aiPlayer?.exportReport();
      this.showWorldMessage('AI REPORT EXPORTED');
    }

    if (DEBUG.enableCollisionOverlayToggle && (
      Phaser.Input.Keyboard.JustDown(this.collisionDebugKey) ||
      Phaser.Input.Keyboard.JustDown(this.collisionDebugAltKey)
    )) {
      DEBUG.showCollisionOverlay = !DEBUG.showCollisionOverlay;
      this.redrawCollisionDebug();
    }

    if (DEBUG.enableWallFillToggle && Phaser.Input.Keyboard.JustDown(this.wallFillDebugKey)) {
      DEBUG.showWallFillCells = !DEBUG.showWallFillCells;
      this.redrawDeckGraphics();
    }

    if (DEBUG.enableHudDetailsToggle && Phaser.Input.Keyboard.JustDown(this.hudDebugKey)) {
      DEBUG.showHudDetails = !DEBUG.showHudDetails;
    }

    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.tryInteract();
    }

    if (DEBUG.enableDeckWarp && Phaser.Input.Keyboard.JustDown(this.pageUpKey)) {
      this.debugWarpDeck(1);
    }

    if (DEBUG.enableDeckWarp && Phaser.Input.Keyboard.JustDown(this.pageDownKey)) {
      this.debugWarpDeck(-1);
    }

    if (DEBUG.enableClearDebug && Phaser.Input.Keyboard.JustDown(this.killDeckKey)) {
      this.debugNeutralizeDeck();
    }

    if (DEBUG.enableClearDebug && Phaser.Input.Keyboard.JustDown(this.killShipKey)) {
      this.debugNeutralizeShip();
    }

    if (DEBUG.enableRegenerate && Phaser.Input.Keyboard.JustDown(this.regenerateKey)) {
      this.scene.restart({ seed: `${SHIP_GENERATION.seed}-${Date.now()}` });
    }

    if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
      this.scene.start('MainMenuScene');
    }
  }

  handlePressAndHoldControls(time) {
    const pointer = this.input.activePointer;
    const leftDown = pointer.leftButtonDown();

    if (this.inputState.suppressLeftUntilRelease) {
      if (!leftDown) {
        this.inputState.suppressLeftUntilRelease = false;
      }
    } else {
      if (leftDown && this.inputState.leftDownAt === null) {
        this.inputState.leftDownAt = time;
        this.inputState.leftHoldStarted = false;
        this.inputState.currentInteractTarget = null;
      }
      if (leftDown && !this.inputState.leftHoldStarted && time - this.inputState.leftDownAt >= this.inputState.holdMs) {
        this.inputState.leftHoldStarted = true;
        this.interactOrbit.show();
        this.audio?.startTransferModeLoop();
      }
      if (leftDown && this.inputState.leftHoldStarted) {
        const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.inputState.currentInteractTarget = this.findInteractTarget(point);
        this.interactOrbit.update(this.player.sprite, this.getInteractTargetPoint(this.inputState.currentInteractTarget), time);
        if (this.tryStartHeldContactInteraction(time)) {
          this.consumeHeldLeftInteractionUntilRelease();
          return;
        }
      }
      if (!leftDown && this.inputState.leftDownAt !== null) {
        if (this.inputState.leftHoldStarted) {
          this.interactOrbit.hide();
          this.audio?.stopTransferModeLoop();
        } else {
          this.handleMouseTap(time);
        }
        this.inputState.leftDownAt = null;
        this.inputState.leftHoldStarted = false;
        this.inputState.currentInteractTarget = null;
      }
    }

    const spaceDown = this.spaceKey.isDown;
    if (spaceDown && this.inputState.spaceDownAt === null) {
      this.inputState.spaceDownAt = time;
      this.inputState.spaceTransferStarted = false;
    }
    if (spaceDown && !this.inputState.spaceTransferStarted && time - this.inputState.spaceDownAt >= this.inputState.holdMs) {
      this.inputState.spaceTransferStarted = true;
      this.audio?.startTransferModeLoop();
      if (this.tryStartContactTransfer(time)) {
        this.audio?.stopTransferModeLoop();
        this.inputState.spaceDownAt = null;
        this.inputState.spaceTransferStarted = false;
        return;
      }
    }
    if (!spaceDown && this.inputState.spaceDownAt !== null) {
      if (this.inputState.spaceTransferStarted) {
        this.transferSystem.start(time, 'facing');
        this.audio?.stopTransferModeLoop();
      } else {
        this.handleSpaceTap(time);
      }
      this.inputState.spaceDownAt = null;
      this.inputState.spaceTransferStarted = false;
    }
  }

  handleMouseTap(time) {
    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.combat.firePlayerAtPoint(worldPoint, time);
  }

  tryStartContactTransfer(time) {
    if (!this.transferSystem?.canStart(time)) {
      return false;
    }
    const target = this.findContactTransferTarget();
    if (!target) {
      return false;
    }
    return this.transferSystem.startWithTarget(time, target);
  }

  findContactTransferTarget() {
    return (this.droids ?? []).find((droid) => (
      !droid.data.neutralized &&
      Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, droid.sprite.x, droid.sprite.y) <= PLAYER.radius + 34
    )) ?? null;
  }

  tryStartContactLift() {
    const lift = this.getNearbyLift();
    if (!lift) {
      return false;
    }
    return this.tryUseLift(lift);
  }

  tryStartHeldContactInteraction(time) {
    if (this.tryStartContactTransfer(time)) {
      return true;
    }
    const lift = this.getNearbyLift();
    if (lift) {
      return this.tryUseLift(lift);
    }
    const terminal = this.getNearbyTerminal();
    if (terminal) {
      return this.tryUseTerminal(terminal);
    }
    return false;
  }

  consumeHeldLeftInteractionUntilRelease() {
    this.interactOrbit.hide();
    this.audio?.stopTransferModeLoop();
    this.inputState.leftDownAt = null;
    this.inputState.leftHoldStarted = false;
    this.inputState.currentInteractTarget = null;
    this.inputState.suppressLeftUntilRelease = true;
  }

  handleSpaceTap(time) {
    this.combat.firePlayerFacing(time);
  }

  handleLiftSelection() {
    if (this.liftTravelConfirming) {
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
      this.liftOverlay.hide();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.liftUpKey) || Phaser.Input.Keyboard.JustDown(this.liftArrowUpKey)) {
      this.liftOverlay.selectNext(-1);
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.liftDownKey) || Phaser.Input.Keyboard.JustDown(this.liftArrowDownKey)) {
      this.liftOverlay.selectNext(1);
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.enterKey) || Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      const destinationDeck = this.liftOverlay.confirmSelection();
      const lift = this.liftOverlay.lift;
      if (destinationDeck && lift) {
        this.confirmLiftTravel(destinationDeck, lift);
      }
      return;
    }

    const clickedDestination = this.liftOverlay.consumePendingDestination();
    if (clickedDestination && this.liftOverlay.lift) {
      const lift = this.liftOverlay.lift;
      this.confirmLiftTravel(clickedDestination, lift);
      return;
    }

    for (const key of this.numberKeys) {
      if (!Phaser.Input.Keyboard.JustDown(key)) {
        continue;
      }
      const destinationDeck = this.liftOverlay.getDestinationForKey(key.keyCode);
      const lift = this.liftOverlay.lift;
      if (destinationDeck && lift) {
        this.confirmLiftTravel(destinationDeck, lift);
      }
      return;
    }
  }

  confirmLiftTravel(destinationDeck, lift) {
    if (!destinationDeck || !lift || this.isChangingDeck || this.liftTravelConfirming) {
      return;
    }

    this.liftTravelConfirming = true;
    this.deckArrivalAlert?.showTraveling(destinationDeck.id);
    this.time.delayedCall(620, () => {
      this.liftTravelConfirming = false;
      this.liftOverlay?.hide();
      this.changeDeck(destinationDeck.id, lift.networkId);
    });
  }

  refreshDeckState() {
    const room = this.mapSystem.discoverAt(this.player.sprite.x, this.player.sprite.y);
    this.currentRoom = room ?? this.mapSystem.getRoomAt(this.player.sprite.x, this.player.sprite.y);
    this.markNearbyLiftsDiscovered();
    this.updateTargetInfoCard();
  }

  updateTargetInfoCard() {
    return;
  }

  renderCurrentDeck() {
    this.clearDeckObjects();
    this.deckPalette = this.currentDeck.cleared ? getClearedDeckPalette() : getDeckPalette(this.currentDeck.id);
    this.mapSystem = new MapSystem(this.currentDeck, {
      clearanceLevel: this.player?.bodyData.clearanceLevel ?? 0,
      collisionInset: 2
    });
    this.physics.world.setBounds(
      this.currentDeck.bounds.x,
      this.currentDeck.bounds.y,
      this.currentDeck.bounds.width,
      this.currentDeck.bounds.height
    );

    this.drawDeck();
    this.createDoorEntities();
    this.createCollision();
    this.redrawCollisionDebug();
    this.spawnCurrentDeckDroids();
    this.attachCombat();
    this.updateCameraBounds();

  }

  clearDeckObjects() {
    this.combat?.detachColliders();
    if (this.lockedDoorCollider) {
      this.lockedDoorCollider.destroy();
      this.lockedDoorCollider = null;
    }
    if (this.droidDoorCollider) {
      this.droidDoorCollider.destroy();
      this.droidDoorCollider = null;
    }
    if (this.playerDroidCollider) {
      this.playerDroidCollider.destroy();
      this.playerDroidCollider = null;
    }
    if (this.droidDroidCollider) {
      this.droidDroidCollider.destroy();
      this.droidDroidCollider = null;
    }
    this.combat?.clearProjectiles();
    if (this.droidWallCollider) {
      this.droidWallCollider.destroy();
      this.droidWallCollider = null;
    }
    if (this.droids) {
      for (const droid of this.droids) {
        droid.destroy();
      }
      this.droids = [];
    }
    if (this.droidGroup) {
      this.droidGroup.destroy(false);
      this.droidGroup = null;
    }
    if (this.playerCollider) {
      this.playerCollider.destroy();
      this.playerCollider = null;
    }
    if (this.walls) {
      this.walls.destroy(true, true);
      this.walls = null;
    }
    if (this.doorEntities) {
      for (const door of this.doorEntities) {
        door.destroy();
      }
      this.doorEntities = [];
    }
    if (this.doorGroup) {
      this.doorGroup.destroy(false);
      this.doorGroup = null;
    }
    if (this.deckGraphics) {
      this.deckGraphics.destroy();
      this.deckGraphics = null;
    }
    if (this.deckLabels) {
      this.deckLabels.destroy(true);
      this.deckLabels = null;
    }
    if (this.deckTextureFills) {
      this.deckTextureFills.destroy(true);
      this.deckTextureFills = null;
    }
    if (this.wallModules) {
      this.wallModules.destroy(true);
      this.wallModules = null;
    }
    if (this.fixtureGraphics) {
      this.fixtureGraphics.destroy();
      this.fixtureGraphics = null;
    }
    if (this.collisionDebugGraphics) {
      this.collisionDebugGraphics.destroy();
      this.collisionDebugGraphics = null;
    }
    if (this.collisionDebugLabel) {
      this.collisionDebugLabel.destroy();
      this.collisionDebugLabel = null;
    }
  }

  drawDeck() {
    this.deckGraphics = this.add.graphics();
    this.deckGraphics.setDepth(-8);
    this.deckLabels = this.add.group();
    this.deckTextureFills = this.add.group();
    this.wallModules = this.add.group();
    if (this.currentDeck.tileMap) {
      this.drawTileFloors();
      this.drawFloorGridOverlay();
    } else {
      for (const corridor of this.currentDeck.corridors) {
        this.drawCorridor(corridor);
      }

      for (const room of this.currentDeck.rooms) {
        this.drawRoom(room);
      }
    }

    if (this.currentDeck.tileMap) {
      this.drawGridWallMasses();
      this.drawWalkableBoundary();
    } else {
      this.drawWalkableBoundary();
    }

    this.drawDoorFrames();

    for (const lift of this.currentDeck.lifts) {
      this.drawLift(lift);
    }

    for (const terminal of this.currentDeck.terminals ?? []) {
      this.drawTerminal(terminal);
    }
    this.drawFixtures();
  }

  drawRoom(room) {
    this.drawTiledFloor(room, 1);

    this.deckGraphics.lineStyle(1, this.deckPalette.floorLine, 0.32);
    for (let x = room.x + 80; x < room.x + room.width; x += 100) {
      this.deckGraphics.lineBetween(x, room.y + 10, x, room.y + room.height - 10);
    }
    for (let y = room.y + 80; y < room.y + room.height; y += 100) {
      this.deckGraphics.lineBetween(room.x + 10, y, room.x + room.width - 10, y);
    }

    this.deckGraphics.lineStyle(1, this.deckPalette.accent, 0.36);
    this.deckGraphics.strokeRect(room.x + 10, room.y + 10, room.width - 20, room.height - 20);

    if (DEBUG.showRoomLabels) {
      const label = this.add.text(room.x + 16, room.y + 12, `${room.id} ${room.label}`, {
        fontFamily: UI_THEME.fontFamily,
        fontSize: '16px',
        color: '#baf7ff'
      }).setDepth(2);
      this.deckLabels.add(label);
    }
  }

  drawTileFloors() {
    const tileSize = this.currentDeck.tileMap.tileSize;
    const rows = this.currentDeck.tileMap.tiles;
    for (let y = 0; y < rows.length; y += 1) {
      let x = 0;
      while (x < rows[y].length) {
        const tile = rows[y][x];
        if (!this.isFloorTile(tile.tileType)) {
          x += 1;
          continue;
        }
        const start = x;
        const type = tile.tileType;
        while (x < rows[y].length && rows[y][x].tileType === type) {
          x += 1;
        }
        const alpha = type === TILE_TYPES.CORRIDOR_FLOOR ? 0.88 : 1;
        this.drawTiledFloor({
          x: start * tileSize,
          y: y * tileSize,
          width: (x - start) * tileSize,
          height: tileSize
        }, alpha);
      }
    }
  }

  drawFloorGridOverlay() {
    const tileSize = this.currentDeck.tileMap.tileSize;
    const rows = this.currentDeck.tileMap.tiles;
    this.deckGraphics.lineStyle(1, this.deckPalette.floorLine, 0.12);
    for (let y = 0; y < rows.length; y += 1) {
      for (let x = 0; x < rows[y].length; x += 1) {
        if (!this.isFloorTile(rows[y]?.[x]?.tileType)) {
          continue;
        }
        const wx = x * tileSize;
        const wy = y * tileSize;
        this.deckGraphics.strokeRect(wx, wy, tileSize, tileSize);
        this.deckGraphics.lineStyle(1, this.deckPalette.accent, 0.07);
        this.deckGraphics.lineBetween(wx + tileSize / 2 - 7, wy + tileSize / 2, wx + tileSize / 2 + 7, wy + tileSize / 2);
        this.deckGraphics.lineBetween(wx + tileSize / 2, wy + tileSize / 2 - 7, wx + tileSize / 2, wy + tileSize / 2 + 7);
        this.deckGraphics.lineStyle(1, this.deckPalette.floorLine, 0.12);
      }
    }
  }

  isFloorTile(tileType) {
    return tileType === TILE_TYPES.ROOM_FLOOR ||
      tileType === TILE_TYPES.CORRIDOR_FLOOR ||
      tileType === TILE_TYPES.DOOR ||
      tileType === TILE_TYPES.LIFT_ROOM_FLOOR ||
      tileType === TILE_TYPES.LIFT_PAD ||
      tileType === TILE_TYPES.TERMINAL ||
      tileType === TILE_TYPES.ALERT_BOX ||
      tileType === TILE_TYPES.REPAIR_PAD;
  }

  drawCorridor(corridor) {
    for (const rect of corridor.rects) {
      this.drawTiledFloor(rect, 0.88);
      this.deckGraphics.lineStyle(1, this.deckPalette.floorLine, 0.2);
      if (rect.width > rect.height) {
        this.deckGraphics.lineBetween(rect.x, rect.y + rect.height / 2, rect.x + rect.width, rect.y + rect.height / 2);
      } else {
        this.deckGraphics.lineBetween(rect.x + rect.width / 2, rect.y, rect.x + rect.width / 2, rect.y + rect.height);
      }
    }
  }

  drawWalkableBoundary() {
    const segments = this.mapSystem.getWalkableBoundarySegments();
    const wallThickness = Math.max(10, Math.round((this.currentDeck.tileMap?.tileSize ?? 32) * 0.42));
    const shadowThickness = wallThickness + 4;

    for (const segment of segments) {
      this.drawWallStrip(segment, shadowThickness, this.deckPalette.wallShadow, 0.98);
    }

    for (const segment of segments) {
      this.drawWallStrip(segment, wallThickness, this.deckPalette.wallBase, 0.98);
    }

    for (const segment of segments) {
      this.drawWallEdge(segment, this.deckPalette.wallHighlight, 0.72, -wallThickness / 2 + 2);
    }

    for (const segment of segments) {
      this.drawWallEdge(segment, this.deckPalette.wallShadow, 0.82, wallThickness / 2 - 2);
    }
    this.drawWallModules(segments);
  }

  drawGridWallMasses() {
    const tileSize = this.currentDeck.tileMap.tileSize;
    const rows = this.currentDeck.tileMap.tiles;
    const wallCells = [];

    for (let y = 0; y < rows.length; y += 1) {
      for (let x = 0; x < rows[y].length; x += 1) {
        if (!this.isStructuralWallRenderTile(rows[y]?.[x]?.tileType)) continue;
        const touchesFloor = this.isFloorTile(rows[y]?.[x + 1]?.tileType) ||
          this.isFloorTile(rows[y]?.[x - 1]?.tileType) ||
          this.isFloorTile(rows[y + 1]?.[x]?.tileType) ||
          this.isFloorTile(rows[y - 1]?.[x]?.tileType);
        if (touchesFloor || rows[y]?.[x]?.tileType === TILE_TYPES.WALL_FILL) {
          wallCells.push({ x, y });
        }
      }
    }

    const wallRects = this.mergeWallCells(wallCells, tileSize);
    for (const rect of wallRects) {
      this.deckGraphics.fillStyle(this.deckPalette.wallShadow, 0.98);
      this.deckGraphics.fillRect(rect.x, rect.y, rect.width, rect.height);
      this.deckGraphics.fillStyle(this.deckPalette.wallBase, 0.98);
      this.deckGraphics.fillRect(rect.x + 4, rect.y + 4, rect.width - 8, rect.height - 8);
    }

    for (const cell of wallCells) {
      const wx = cell.x * tileSize;
      const wy = cell.y * tileSize;
      const tileType = rows[cell.y]?.[cell.x]?.tileType;
      if (DEBUG.showWallFillCells && tileType === TILE_TYPES.WALL_FILL) {
        this.deckGraphics.fillStyle(0xff3bd6, 0.58);
        this.deckGraphics.fillRect(wx + 8, wy + 8, tileSize - 16, tileSize - 16);
      }
      if ((cell.x + cell.y) % 2 === 0) {
        this.deckGraphics.fillStyle(this.deckPalette.wallHighlight, 0.16);
        this.deckGraphics.fillRect(wx + tileSize / 2 - 9, wy + tileSize / 2 - 9, 18, 18);
        this.deckGraphics.fillStyle(this.deckPalette.wallShadow, 0.55);
        this.deckGraphics.fillRect(wx + tileSize / 2 - 5, wy + tileSize / 2 - 5, 18, 18);
        this.deckGraphics.fillStyle(this.deckPalette.wallBase, 0.98);
        this.deckGraphics.fillRect(wx + tileSize / 2 - 7, wy + tileSize / 2 - 7, 16, 16);
      }
    }

    for (const cell of wallCells) {
      const wx = cell.x * tileSize;
      const wy = cell.y * tileSize;
      this.deckGraphics.lineStyle(2, this.deckPalette.wallHighlight, 0.58);
      if (this.isFloorTile(rows[cell.y - 1]?.[cell.x]?.tileType)) this.deckGraphics.lineBetween(wx + 3, wy + 3, wx + tileSize - 3, wy + 3);
      if (this.isFloorTile(rows[cell.y + 1]?.[cell.x]?.tileType)) this.deckGraphics.lineBetween(wx + 3, wy + tileSize - 3, wx + tileSize - 3, wy + tileSize - 3);
      if (this.isFloorTile(rows[cell.y]?.[cell.x - 1]?.tileType)) this.deckGraphics.lineBetween(wx + 3, wy + 3, wx + 3, wy + tileSize - 3);
      if (this.isFloorTile(rows[cell.y]?.[cell.x + 1]?.tileType)) this.deckGraphics.lineBetween(wx + tileSize - 3, wy + 3, wx + tileSize - 3, wy + tileSize - 3);
    }
  }

  isStructuralWallRenderTile(tileType) {
    return tileType === TILE_TYPES.SOLID ||
      tileType === TILE_TYPES.WALL_FILL ||
      tileType === TILE_TYPES.BLOCKED;
  }

  mergeWallCells(cells, tileSize) {
    const cellSet = new Set(cells.map((cell) => `${cell.x},${cell.y}`));
    const visited = new Set();
    const sorted = [...cells].sort((a, b) => a.y - b.y || a.x - b.x);
    const rects = [];

    for (const cell of sorted) {
      const key = `${cell.x},${cell.y}`;
      if (visited.has(key)) {
        continue;
      }
      let widthBlocks = 1;
      while (cellSet.has(`${cell.x + widthBlocks},${cell.y}`) && !visited.has(`${cell.x + widthBlocks},${cell.y}`)) {
        widthBlocks += 1;
      }

      let heightBlocks = 1;
      let canExtend = true;
      while (canExtend) {
        for (let i = 0; i < widthBlocks; i += 1) {
          if (!cellSet.has(`${cell.x + i},${cell.y + heightBlocks}`) || visited.has(`${cell.x + i},${cell.y + heightBlocks}`)) {
            canExtend = false;
            break;
          }
        }
        if (canExtend) {
          heightBlocks += 1;
        }
      }

      for (let yy = 0; yy < heightBlocks; yy += 1) {
        for (let xx = 0; xx < widthBlocks; xx += 1) {
          visited.add(`${cell.x + xx},${cell.y + yy}`);
        }
      }

      rects.push({
        x: cell.x * tileSize,
        y: cell.y * tileSize,
        width: widthBlocks * tileSize,
        height: heightBlocks * tileSize
      });
    }

    return rects;
  }

  drawWallStrip(segment, thickness, color, alpha) {
    this.deckGraphics.fillStyle(color, alpha);
    if (segment.y1 === segment.y2) {
      const x = Math.min(segment.x1, segment.x2);
      const y = segment.y1 - thickness / 2;
      this.deckGraphics.fillRect(x, y, Math.abs(segment.x2 - segment.x1), thickness);
      return;
    }
    const x = segment.x1 - thickness / 2;
    const y = Math.min(segment.y1, segment.y2);
    this.deckGraphics.fillRect(x, y, thickness, Math.abs(segment.y2 - segment.y1));
  }

  drawWallEdge(segment, color, alpha, offset) {
    this.deckGraphics.lineStyle(1, color, alpha);
    if (segment.y1 === segment.y2) {
      this.deckGraphics.lineBetween(segment.x1, segment.y1 + offset, segment.x2, segment.y2 + offset);
      return;
    }
    this.deckGraphics.lineBetween(segment.x1 + offset, segment.y1, segment.x2 + offset, segment.y2);
  }

  drawDoorFrames() {
    for (const door of this.getAllDoors()) {
      this.carveDoorCavity(door);
      if (door.orientation === 'vertical') {
        this.deckGraphics.fillStyle(this.deckPalette.wallShadow, 0.86);
        this.deckGraphics.fillRect(door.x - 4, door.y - 5, door.width + 8, 5);
        this.deckGraphics.fillRect(door.x - 4, door.y + door.height, door.width + 8, 5);
        this.deckGraphics.lineStyle(2, this.deckPalette.wallHighlight, 0.56);
        this.deckGraphics.lineBetween(door.x - 2, door.y + 2, door.x - 2, door.y + 14);
        this.deckGraphics.lineBetween(door.x + door.width + 2, door.y + door.height - 14, door.x + door.width + 2, door.y + door.height - 2);
      } else {
        this.deckGraphics.fillStyle(this.deckPalette.wallShadow, 0.86);
        this.deckGraphics.fillRect(door.x - 5, door.y - 4, 5, door.height + 8);
        this.deckGraphics.fillRect(door.x + door.width, door.y - 4, 5, door.height + 8);
        this.deckGraphics.lineStyle(2, this.deckPalette.wallHighlight, 0.56);
        this.deckGraphics.lineBetween(door.x + 2, door.y - 2, door.x + 14, door.y - 2);
        this.deckGraphics.lineBetween(door.x + door.width - 14, door.y + door.height + 2, door.x + door.width - 2, door.y + door.height + 2);
      }
    }
  }

  carveDoorCavity(door) {
    const cavity = this.getDoorRenderCavity(door);
    this.drawTiledFloor(cavity, 1);
    this.drawFloorGridForRect(cavity);
  }

  drawFloorGridForRect(rect) {
    const tileSize = this.currentDeck.tileMap?.tileSize ?? 64;
    const minX = Math.floor(rect.x / tileSize);
    const maxX = Math.ceil((rect.x + rect.width) / tileSize);
    const minY = Math.floor(rect.y / tileSize);
    const maxY = Math.ceil((rect.y + rect.height) / tileSize);
    this.deckGraphics.lineStyle(1, this.deckPalette.floorLine, 0.12);
    for (let y = minY; y < maxY; y += 1) {
      for (let x = minX; x < maxX; x += 1) {
        const wx = x * tileSize;
        const wy = y * tileSize;
        this.deckGraphics.strokeRect(wx, wy, tileSize, tileSize);
        this.deckGraphics.lineStyle(1, this.deckPalette.accent, 0.07);
        this.deckGraphics.lineBetween(wx + tileSize / 2 - 7, wy + tileSize / 2, wx + tileSize / 2 + 7, wy + tileSize / 2);
        this.deckGraphics.lineBetween(wx + tileSize / 2, wy + tileSize / 2 - 7, wx + tileSize / 2, wy + tileSize / 2 + 7);
        this.deckGraphics.lineStyle(1, this.deckPalette.floorLine, 0.12);
      }
    }
  }

  getDoorRenderCavity(door) {
    return {
      x: door.x,
      y: door.y,
      width: door.width,
      height: door.height
    };
  }

  drawTiledFloor(rect, alpha) {
    if (this.currentDeck.cleared) {
      this.deckGraphics.fillStyle(this.deckPalette.floorBase, alpha);
      this.deckGraphics.fillRect(rect.x, rect.y, rect.width, rect.height);
      return;
    }
    const tile = this.add.tileSprite(rect.x, rect.y, rect.width, rect.height, getFloorTileKey(this.currentDeck.id));
    tile.setOrigin(0, 0);
    tile.setAlpha(alpha);
    tile.setDepth(-12);
    this.deckTextureFills.add(tile);
  }

  drawWallModules(segments) {
    if (this.currentDeck.cleared) {
      return;
    }
    const key = getWallModuleKey(this.currentDeck.id);
    const spacing = 192;
    for (const segment of segments) {
      const length = Phaser.Math.Distance.Between(segment.x1, segment.y1, segment.x2, segment.y2);
      if (length < 96) {
        continue;
      }
      const count = Math.floor(length / spacing);
      const angle = Phaser.Math.Angle.Between(segment.x1, segment.y1, segment.x2, segment.y2);
      for (let i = 0; i < count; i += 1) {
        const t = (i + 0.5) / count;
        const module = this.add.image(
          Phaser.Math.Linear(segment.x1, segment.x2, t),
          Phaser.Math.Linear(segment.y1, segment.y2, t),
          key
        );
        module.setRotation(angle);
        module.setAlpha(0.32);
        module.setDepth(-8);
        this.wallModules.add(module);
      }
    }
  }

  drawLift(lift) {
    const usable = true;
    const color = usable ? this.getLiftShaftColor(lift) : this.deckPalette.hazard;
    const tileSize = this.currentDeck.tileMap?.tileSize ?? 32;
    const size = tileSize * 0.82;
    const x = lift.x - size / 2;
    const y = lift.y - size / 2;
    this.deckGraphics.fillStyle(this.deckPalette.wallShadow, 0.72);
    this.deckGraphics.fillRoundedRect?.(x, y, size, size, 7);
    if (!this.deckGraphics.fillRoundedRect) this.deckGraphics.fillRect(x, y, size, size);
    this.deckGraphics.lineStyle(3, 0xffffff, 0.8);
    this.deckGraphics.strokeRoundedRect?.(x, y, size, size, 7);
    if (!this.deckGraphics.strokeRoundedRect) this.deckGraphics.strokeRect(x, y, size, size);
    this.deckGraphics.lineStyle(3, color, 0.2);
    this.deckGraphics.strokeCircle(lift.x, lift.y, size * 0.41);
    this.deckGraphics.fillStyle(color, usable ? 0.86 : 0.34);
    for (let i = 0; i < 4; i += 1) {
      this.drawWedge(this.deckGraphics, lift.x, lift.y, size * 0.33, i * Math.PI / 2 + 0.2, (i + 1) * Math.PI / 2 - 0.2);
    }
    this.deckGraphics.lineStyle(3, this.deckPalette.wallShadow, 0.92);
    this.deckGraphics.lineBetween(lift.x - size * 0.34, lift.y, lift.x + size * 0.34, lift.y);
    this.deckGraphics.lineBetween(lift.x, lift.y - size * 0.34, lift.x, lift.y + size * 0.34);
    this.deckGraphics.fillStyle(this.deckPalette.wallShadow, 0.95);
    this.deckGraphics.fillCircle(lift.x, lift.y, size * 0.08);
    this.deckGraphics.lineStyle(2, 0xffffff, 0.42);
    const tick = size * 0.18;
    const inset = size * 0.12;
    this.deckGraphics.lineBetween(x + inset, y - inset, x + inset + tick, y - inset);
    this.deckGraphics.lineBetween(x - inset, y + inset, x - inset, y + inset + tick);
    this.deckGraphics.lineBetween(x + size + inset, y + size - inset, x + size + inset, y + size - inset - tick);
    this.deckGraphics.lineBetween(x + size - inset, y + size + inset, x + size - inset - tick, y + size + inset);
  }

  getLiftShaftColor(lift) {
    const shaft = this.ship?.elevatorShafts?.find((item) => item.id === lift.networkId);
    return getElevatorShaftColor(shaft ?? lift, brightenColor(this.deckPalette.accent, 0.38));
  }

  drawWedge(graphics, x, y, radius, start, end) {
    const points = [{ x, y }];
    for (let i = 0; i <= 12; i += 1) {
      const t = start + (end - start) * (i / 12);
      points.push({ x: x + Math.cos(t) * radius, y: y + Math.sin(t) * radius });
    }
    graphics.fillPoints(points, true);
  }

  drawTerminal(terminal) {
    const locked = (this.player?.bodyData.clearanceLevel ?? 0) < terminal.clearanceRequirement;
    const color = locked ? this.deckPalette.hazard : this.deckPalette.terminalGlow;
    const alert = terminal.terminalType === 'ship-alert';
    const rect = this.getFootprintRect(terminal, 1, 1);
    const size = Math.min(rect.width, rect.height);
    const x = rect.x;
    const y = rect.y;
    const wallSide = this.normalizeWallSide(terminal.wallSide ?? terminal.orientation);
    const thick = size * 0.17;
    const inset = size * 0.07;
    const arm = size * 0.86;
    const back = this.consoleBackRect(x, y, size, wallSide, thick, inset);
    const arms = this.consoleArmRects(x, y, size, wallSide, thick, inset, arm);
    this.deckGraphics.fillStyle(this.deckPalette.wallShadow, 0.9);
    for (const part of [back, ...arms]) {
      this.deckGraphics.fillRect(part.x + 2, part.y + 2, part.w, part.h);
    }
    this.deckGraphics.fillStyle(this.deckPalette.wallBase, 0.98);
    for (const part of [back, ...arms]) {
      this.deckGraphics.fillRect(part.x, part.y, part.w, part.h);
    }
    this.deckGraphics.lineStyle(2, this.deckPalette.wallHighlight, 0.78);
    for (const part of [back, ...arms]) {
      this.deckGraphics.strokeRect(part.x, part.y, part.w, part.h);
    }
    const panel = this.consolePanelPoint(x, y, size, wallSide);
    this.drawConsoleInterfaceCurve(x, y, size, wallSide, color, locked);
    this.deckGraphics.lineStyle(1, 0xffffff, 0.48);
    this.deckGraphics.strokeRect(panel.x - size * 0.13, panel.y - size * 0.13, size * 0.26, size * 0.26);
    if (alert) {
      this.deckGraphics.fillStyle(this.deckPalette.hazard, locked ? 0.38 : 0.9);
      this.deckGraphics.fillTriangle(panel.x, panel.y - size * 0.09, panel.x - size * 0.1, panel.y + size * 0.09, panel.x + size * 0.1, panel.y + size * 0.09);
      this.deckGraphics.fillStyle(this.deckPalette.floorBase, 0.92);
      this.deckGraphics.fillRect(panel.x - size * 0.014, panel.y - size * 0.005, size * 0.028, size * 0.07);
      this.deckGraphics.fillCircle(panel.x, panel.y + size * 0.075, size * 0.018);
      return;
    }
    this.deckGraphics.fillStyle(color, locked ? 0.34 : 0.95);
    for (let row = 0; row < 2; row += 1) {
      for (let i = 0; i < 4; i += 1) {
        this.deckGraphics.fillRect(panel.x - size * 0.105 + i * size * 0.065, panel.y - size * 0.055 + row * size * 0.085, Math.max(2, size * 0.035), Math.max(2, size * 0.025));
      }
    }
  }

  normalizeWallSide(side) {
    if (side === 'horizontal') return 'north';
    if (side === 'vertical') return 'west';
    return ['north', 'south', 'west', 'east'].includes(side) ? side : 'north';
  }

  consoleBackRect(x, y, size, side, thick, inset) {
    if (side === 'north') return { x: x + inset, y: y + inset, w: size - inset * 2, h: thick };
    if (side === 'south') return { x: x + inset, y: y + size - inset - thick, w: size - inset * 2, h: thick };
    if (side === 'west') return { x: x + inset, y: y + inset, w: thick, h: size - inset * 2 };
    return { x: x + size - inset - thick, y: y + inset, w: thick, h: size - inset * 2 };
  }

  consoleArmRects(x, y, size, side, thick, inset, arm) {
    if (side === 'north' || side === 'south') {
      const y0 = side === 'north' ? y + inset : y + size - inset - arm;
      return [
        { x: x + inset, y: y0, w: thick, h: arm },
        { x: x + size - inset - thick, y: y0, w: thick, h: arm }
      ];
    }
    const x0 = side === 'west' ? x + inset : x + size - inset - arm;
    return [
      { x: x0, y: y + inset, w: arm, h: thick },
      { x: x0, y: y + size - inset - thick, w: arm, h: thick }
    ];
  }

  consolePanelPoint(x, y, size, side) {
    if (side === 'north') return { x: x + size / 2, y: y + size * 0.32 };
    if (side === 'south') return { x: x + size / 2, y: y + size * 0.68 };
    if (side === 'west') return { x: x + size * 0.32, y: y + size / 2 };
    return { x: x + size * 0.68, y: y + size / 2 };
  }

  drawConsoleInterfaceCurve(x, y, size, side, color, locked) {
    const center = this.consoleInterfacePoint({ x: x + size / 2, y: y + size / 2, wallSide: side });
    const radiusY = size * 0.31;
    const radiusX = radiusY * 2;
    // Draw the socket as a concave receiver: the missing side faces the room/player.
    const startEndBySide = {
      north: [Math.PI * 1.08, Math.PI * 1.92],
      south: [Math.PI * 0.08, Math.PI * 0.92],
      west: [Math.PI * 0.58, Math.PI * 1.42],
      east: [Math.PI * 1.58, Math.PI * 2.42]
    };
    const [start, end] = startEndBySide[side] ?? startEndBySide.north;
    this.deckGraphics.lineStyle(Math.max(2, size * 0.055), color, locked ? 0.32 : 0.86);
    this.strokeEllipseArc(this.deckGraphics, center.x, center.y, radiusX, radiusY, start, end);
    this.deckGraphics.lineStyle(1, 0xffffff, locked ? 0.16 : 0.48);
    this.strokeEllipseArc(this.deckGraphics, center.x, center.y, radiusX * 0.72, radiusY * 0.72, start, end);
  }

  strokeEllipseArc(graphics, x, y, radiusX, radiusY, start, end, steps = 24) {
    const points = [];
    for (let i = 0; i <= steps; i += 1) {
      const t = start + (end - start) * (i / steps);
      points.push({
        x: x + Math.cos(t) * radiusX,
        y: y + Math.sin(t) * radiusY
      });
    }
    graphics.strokePoints(points, false);
  }

  drawFixtures() {
    this.fixtureGraphics = this.add.graphics();
    this.fixtureGraphics.setDepth(-3);
    for (const fixture of this.currentDeck.fixtures ?? []) {
      if (fixture.type === 'repair-pad') {
        this.drawRepairPad(fixture, 0);
      } else {
        this.drawObstacleBlock(fixture);
      }
    }
  }

  drawRepairPad(fixture, time) {
    const g = this.fixtureGraphics;
    const pulse = 0.5 + Math.sin(time * 0.004 + fixture.gridX) * 0.5;
    const rect = this.getFootprintRect(fixture, 1, 1);
    const size = Math.min(rect.width, rect.height);
    const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    const r = size * 0.28 + pulse * 2;
    g.lineStyle(2, 0xffffff, 0.82);
    for (let i = 0; i < 4; i += 1) {
      const start = time * 0.0018 + i * (Math.PI / 2);
      this.drawGraphicsArc(g, center.x, center.y, r, start, start + 0.72, 10);
    }
    g.fillStyle(0xffffff, 0.86);
    for (let i = 0; i < 8; i += 1) {
      const angle = i * (Math.PI / 4);
      const dotSize = 2.7 + pulse * 1.6;
      g.fillCircle(center.x + Math.cos(angle) * (size * 0.42), center.y + Math.sin(angle) * (size * 0.42), dotSize);
    }
  }

  drawObstacleBlock(fixture) {
    const g = this.fixtureGraphics;
    const rect = this.getFootprintRect(fixture, 1, 1);
    const size = Math.min(rect.width, rect.height);
    const x = rect.x;
    const y = rect.y;
    g.fillStyle(this.deckPalette.floorBase, 0.98);
    g.fillRect(x, y, size, size);
    g.lineStyle(4, this.deckPalette.wallBase, 0.95);
    g.strokeRect(x + 3, y + 3, size - 6, size - 6);
    g.lineStyle(1, this.deckPalette.wallHighlight, 0.42);
    g.strokeRect(x + 8, y + 8, size - 16, size - 16);
    g.lineStyle(2, this.deckPalette.wallShadow, 0.95);
    g.lineBetween(x + 12, y + 11, x + size - 12, y + 11);
    g.lineBetween(x + 12, y + size - 11, x + size - 12, y + size - 11);
    g.fillStyle(0xffffff, 0.82);
    for (const yy of [y + 18, y + size - 20]) {
      for (let i = 0; i < 4; i += 1) {
        g.fillRect(x + 18 + i * 8, yy, 4, 4);
      }
    }
    if (fixture.type === 'transformer-line') {
      g.lineStyle(3, 0xffffff, 0.78);
      g.lineBetween(x + 16, y + size / 2, x + size - 16, y + size / 2);
    } else {
      g.fillCircle(x + size / 2 - 8, y + size / 2, 5);
      g.fillCircle(x + size / 2 + 8, y + size / 2, 5);
    }
  }

  getFootprintRect(item, fallbackWidthCells = 1, fallbackHeightCells = 1) {
    const tileSize = this.currentDeck.tileMap?.tileSize ?? 32;
    if (item.footprint) {
      return footprintToWorldRect(item.footprint, tileSize);
    }
    const widthCells = fallbackWidthCells;
    const heightCells = fallbackHeightCells;
    const centerX = Math.floor(item.x / tileSize);
    const centerY = Math.floor(item.y / tileSize);
    return {
      x: (centerX - Math.floor(widthCells / 2)) * tileSize,
      y: (centerY - Math.floor(heightCells / 2)) * tileSize,
      width: widthCells * tileSize,
      height: heightCells * tileSize
    };
  }

  drawGraphicsArc(graphics, x, y, radius, start, end, steps = 12) {
    const points = [];
    for (let i = 0; i <= steps; i += 1) {
      const t = start + (end - start) * (i / steps);
      points.push({ x: x + Math.cos(t) * radius, y: y + Math.sin(t) * radius });
    }
    graphics.strokePoints(points, false);
  }

  updateRepairPads(delta) {
    const repairPads = (this.currentDeck.fixtures ?? []).filter((fixture) => fixture.type === 'repair-pad');
    if (!repairPads.length || !this.player) {
      this.audio?.stopHealLoop();
      return;
    }
    this.fixtureGraphics?.clear();
    for (const fixture of this.currentDeck.fixtures ?? []) {
      if (fixture.type === 'repair-pad') this.drawRepairPad(fixture, this.time.now);
      else this.drawObstacleBlock(fixture);
    }
    const activePad = repairPads.find((fixture) => this.isPlayerInsideInteractionCell(fixture));
    const body = this.player.bodyData;
    if (activePad && body.integrity < body.maxIntegrity) {
      const before = body.integrity;
      body.integrity = Math.min(body.maxIntegrity, body.integrity + 12 * (delta / 1000));
      this.applyRepairScoreDrain(body.integrity - before, body.maxIntegrity);
      this.audio?.startHealLoop();
    } else {
      this.repairScoreDrainAccumulator = 0;
      this.audio?.stopHealLoop();
    }
  }

  createCollision() {
    if (this.playerCollider) {
      this.playerCollider.destroy();
      this.playerCollider = null;
    }
    if (this.droidWallCollider) {
      this.droidWallCollider.destroy();
      this.droidWallCollider = null;
    }
    if (this.walls) {
      this.walls.destroy(true, true);
    }

    this.walls = this.physics.add.staticGroup();
    for (const rect of this.mapSystem.getCollisionRects()) {
      const wall = this.add.rectangle(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, rect.height, 0x000000, 0);
      wall.setName('WallCollisionLayer');
      wall.setData('layerName', rect.layerName ?? 'WallCollisionLayer');
      wall.setData('collisionRole', 'solid-wall');
      this.physics.add.existing(wall, true);
      wall.body.setSize(rect.width, rect.height);
      wall.body.updateFromGameObject();
      this.walls.add(wall);
    }
    this.walls.refresh();
    this.auditWallCollisionLayer();
    this.attachPlayerCollider();
  }

  auditWallCollisionLayer() {
    if (!DEBUG.enableCollisionAudit || !this.mapSystem) {
      return;
    }
    const warnings = this.mapSystem.getCollisionAuditWarnings();
    for (const warning of warnings.slice(0, 12)) {
      console.warn(warning);
    }
    if (warnings.length > 12) {
      console.warn(`Collision audit suppressed ${warnings.length - 12} additional wall collider warnings.`);
    }
  }

  createDoorEntities() {
    if (this.doorEntities) {
      for (const door of this.doorEntities) {
        door.destroy();
      }
      this.doorEntities = [];
    }
    if (this.doorGroup) {
      this.doorGroup.destroy(false);
      this.doorGroup = null;
    }

    this.doorEntities = [];
    this.doorGroup = this.physics.add.staticGroup();
    for (const doorData of this.getAllDoors()) {
      const door = new Door(this, doorData, this.deckPalette);
      this.doorEntities.push(door);
      this.doorGroup.add(door.blocker);
    }
    this.doorGroup.refresh();
  }

  updateDoors(time) {
    if (!this.doorEntities?.length || !this.player) {
      return;
    }
    for (const door of this.doorEntities) {
      door.update(time, this.player, this.droids ?? []);
    }
  }

  spawnCurrentDeckDroids() {
    this.droids = [];
    this.droidGroup = this.physics.add.group();
    const roomById = new Map(this.currentDeck.rooms.map((room) => [room.id, room]));

    for (const droidData of this.currentDeck.droids ?? []) {
      if (droidData.neutralized) {
        continue;
      }
      const room = roomById.get(droidData.roomId);
      if (!room) {
        continue;
      }
      const droid = new Droid(this, droidData, room);
      this.droids.push(droid);
      this.droidGroup.add(droid.sprite);
    }

    if (this.walls) {
      this.droidWallCollider = this.physics.add.collider(this.droidGroup, this.walls);
    }
    if (this.doorGroup) {
      this.droidDoorCollider = this.physics.add.collider(this.droidGroup, this.doorGroup);
    }
    if (this.player) {
      this.playerDroidCollider = this.physics.add.collider(
        this.player.sprite,
        this.droidGroup,
        (playerSprite, droidSprite) => this.handlePlayerDroidCollision(playerSprite, droidSprite)
      );
    }
    this.droidDroidCollider = this.physics.add.collider(
      this.droidGroup,
      this.droidGroup,
      (spriteA, spriteB) => this.handleDroidDroidCollision(spriteA, spriteB)
    );
  }

  attachCombat() {
    if (!this.combat || !this.player || !this.walls || !this.droidGroup) {
      return;
    }
    this.combat.attach({
      walls: this.walls,
      doorGroup: this.doorGroup,
      droidGroup: this.droidGroup,
      droids: this.droids,
      player: this.player
    });
  }

  redrawDeckGraphics() {
    if (this.deckGraphics) {
      this.deckGraphics.destroy();
      this.deckGraphics = null;
    }
    if (this.deckLabels) {
      this.deckLabels.destroy(true);
      this.deckLabels = null;
    }
    if (this.deckTextureFills) {
      this.deckTextureFills.destroy(true);
      this.deckTextureFills = null;
    }
    if (this.wallModules) {
      this.wallModules.destroy(true);
      this.wallModules = null;
    }
    if (this.fixtureGraphics) {
      this.fixtureGraphics.destroy();
      this.fixtureGraphics = null;
    }
    this.drawDeck();
    this.redrawCollisionDebug();
  }

  redrawCollisionDebug() {
    if (this.collisionDebugGraphics) {
      this.collisionDebugGraphics.destroy();
      this.collisionDebugGraphics = null;
    }
    if (this.collisionDebugLabel) {
      this.collisionDebugLabel.destroy();
      this.collisionDebugLabel = null;
    }

    if (!DEBUG.showCollisionOverlay || !this.mapSystem) {
      return;
    }

    this.collisionDebugGraphics = this.add.graphics();
    this.collisionDebugGraphics.setDepth(900);
    this.drawCollisionDebugStatic();
    this.updateCollisionDebug();
  }

  drawCollisionDebugStatic() {
    if (!this.collisionDebugGraphics) {
      return;
    }

    this.collisionDebugGraphics.clear();
    this.collisionDebugGraphics.fillStyle(0x00ff9d, 0.08);
    const rows = this.mapSystem.getWalkableRows();
    const size = this.mapSystem.collisionCellSize;
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      for (let column = 0; column < row.length; column += 1) {
        if (!row[column]) {
          continue;
        }
        this.collisionDebugGraphics.fillRect(
          this.mapSystem.deck.bounds.x + column * size,
          this.mapSystem.deck.bounds.y + rowIndex * size,
          size,
          size
        );
      }
    }

    this.collisionDebugGraphics.fillStyle(0xff3355, 0.18);
    this.collisionDebugGraphics.lineStyle(1, 0xff6f61, 0.45);
    for (const rect of this.mapSystem.getCollisionRects()) {
      this.collisionDebugGraphics.fillRect(rect.x, rect.y, rect.width, rect.height);
      this.collisionDebugGraphics.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }

    const camera = this.cameras.main;
    this.collisionDebugGraphics.fillStyle(0xffffff, 0.86);
    this.collisionDebugGraphics.fillRect(camera.scrollX + 14, camera.scrollY + 14, 210, 34);
    this.collisionDebugGraphics.lineStyle(1, 0xff6f61, 0.8);
    this.collisionDebugGraphics.strokeRect(camera.scrollX + 14, camera.scrollY + 14, 210, 34);
    if (!this.collisionDebugLabel) {
      this.collisionDebugLabel = this.add.text(0, 0, '', {
        fontFamily: UI_THEME.fontFamily,
        fontSize: '11px',
        color: '#05080c'
      }).setDepth(901);
    }
    this.collisionDebugLabel
      .setText('WallCollisionLayer only')
      .setPosition(camera.scrollX + 24, camera.scrollY + 24)
      .setVisible(true);

    this.collisionDebugGraphics.fillStyle(0xffd36a, 0.35);
    for (const rect of this.mapSystem.getLockedDoorBlockRects()) {
      this.collisionDebugGraphics.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
  }

  updateCollisionDebug() {
    if (!DEBUG.showCollisionOverlay || !this.collisionDebugGraphics || !this.player) {
      this.collisionDebugLabel?.setVisible(false);
      return;
    }

    this.drawCollisionDebugStatic();
    this.collisionDebugGraphics.lineStyle(2, 0xffffff, 0.9);
    this.collisionDebugGraphics.strokeCircle(this.player.sprite.x, this.player.sprite.y, PLAYER.collisionRadius ?? PLAYER.radius);
  }

  updateDroids(time, delta) {
    for (const droid of this.droids ?? []) {
      droid.update(time, delta, this.player);
      this.enforceDroidContainment(droid);
    }
  }

  enforceDroidContainment(droid) {
    if (!droid?.sprite?.body || !this.mapSystem) {
      return;
    }
    const radius = DROID_GENERATION.collisionRadius ?? DROID_GENERATION.radius;
    const { sprite } = droid;
    if (this.mapSystem.canFitCircleAt(sprite.x, sprite.y, radius)) {
      droid.lastSafePosition = { x: sprite.x, y: sprite.y };
      return;
    }
    const previous = droid.lastSafePosition ??
      this.findNearestPlayablePoint(sprite.x, sprite.y, radius) ??
      { x: sprite.x, y: sprite.y };
    const body = sprite.body;
    const xOnlyValid = this.mapSystem.canFitCircleAt(sprite.x, previous.y, radius);
    const yOnlyValid = this.mapSystem.canFitCircleAt(previous.x, sprite.y, radius);

    if (xOnlyValid) {
      sprite.setPosition(sprite.x, previous.y);
      body.setVelocityY(-body.velocity.y * 0.22);
      droid.lastSafePosition = { x: sprite.x, y: sprite.y };
      droid.clearPath?.();
      return;
    }

    if (yOnlyValid) {
      sprite.setPosition(previous.x, sprite.y);
      body.setVelocityX(-body.velocity.x * 0.22);
      droid.lastSafePosition = { x: sprite.x, y: sprite.y };
      droid.clearPath?.();
      return;
    }

    sprite.setPosition(previous.x, previous.y);
    body.setVelocity(-body.velocity.x * 0.18, -body.velocity.y * 0.18);
    droid.clearPath?.();
  }

  removeDroidEntity(droid) {
    const index = this.droids.indexOf(droid);
    if (index >= 0) {
      this.droids.splice(index, 1);
    }
    this.droidGroup?.remove(droid.sprite, false, false);
    droid.destroy();
  }

  completeTransferSuccess(target) {
    const template = target.data.template;
    const integrity = Math.max(1, target.data.currentIntegrity);
    const nextBody = {
      ...this.player.bodyData,
      rank: template.rank,
      displayId: template.displayId,
      chassisClass: template.chassisClass,
      weaponTier: template.weaponTier,
      armorTier: template.armorTier,
      speedTier: template.speedTier,
      maxIntegrity: template.maxIntegrity,
      integrity,
      speed: template.speed,
      acceleration: Math.max(900, template.speed * 5),
      drag: Math.max(900, template.speed * 5),
      precisionMultiplier: this.player.bodyData.precisionMultiplier,
      clearanceLevel: template.clearanceLevel,
      weaponType: template.weaponType,
      instability: null,
      stabilityMax: template.instabilityMax,
      stabilityCurrent: template.instabilityMax,
      stabilityDecayRate: template.instabilityDecayRate,
      bodyFailureState: 'normal'
    };

    this.playTransferSuccessSequence(target, nextBody, template);
  }

  playTransferSuccessSequence(target, nextBody, template) {
    if (this.isTransferFinalizing) {
      return;
    }
    this.isTransferFinalizing = true;
    this.resetInputState();
    this.combat?.detachColliders();
    this.combat?.clearProjectiles();
    const lock = this.transferEncounterLock?.target === target ? this.transferEncounterLock : null;

    const oldHostX = lock?.playerX ?? this.player.sprite.x;
    const oldHostY = lock?.playerY ?? this.player.sprite.y;
    const targetX = lock?.targetX ?? target.sprite.x;
    const targetY = lock?.targetY ?? target.sprite.y;
    const controlledWhite = 0xffffff;
    const controlShadow = 0x8ff0ff;

    this.setBodyFrozenAt(this.player.sprite, oldHostX, oldHostY, true);
    this.setBodyFrozenAt(target.sprite, targetX, targetY, true);
    target.visual?.setDroidNumberColor(controlledWhite, controlShadow);
    target.visual?.update(targetX, targetY, target.data?.displayId ?? target.data?.template?.displayId);
    this.player.visual?.update(oldHostX, oldHostY, this.player.bodyData.displayId);
    this.spawnDestructionPulse(targetX, targetY, controlledWhite);
    this.transferFinalization = {
      target,
      nextBody,
      template,
      oldHostX,
      oldHostY,
      targetX,
      targetY,
      startedAt: this.time.now,
      dimmedOldHost: false,
      explodedOldHost: false,
      finished: false
    };
  }

  updateTransferFinalization(time) {
    const state = this.transferFinalization;
    if (!state || state.finished) {
      return;
    }
    const elapsed = time - state.startedAt;
    const deadBlack = 0x000000;
    if (!state.explodedOldHost && this.player?.sprite?.active) {
      this.player.sprite.setPosition(state.oldHostX, state.oldHostY);
      this.player.visual?.update(state.oldHostX, state.oldHostY, this.player.bodyData.displayId);
    }
    if (!state.dimmedOldHost && elapsed >= 500) {
      state.dimmedOldHost = true;
      this.player.visual?.setDroidNumberColor(deadBlack, deadBlack);
      this.player.sprite.setTint(0x303030);
    }
    if (!state.explodedOldHost && elapsed >= 1000) {
      state.explodedOldHost = true;
      this.playDroidExplosion(state.oldHostX, state.oldHostY, () => {
        this.player.sprite.setVisible(false);
        this.player.visual?.setVisible(false);
      });
      this.audio?.playDroidExplode();
    }
    if (elapsed >= 1600) {
      state.finished = true;
      this.finishTransferSuccess(state.target, state.nextBody, state.template, state.targetX, state.targetY);
    }
  }

  finishTransferSuccess(target, nextBody, template, x, y) {
    try {
      const previousBody = { ...this.player.bodyData };
      const safePoint = this.findNearestPlayerSpawnPoint(x, y, PLAYER.collisionRadius ?? PLAYER.radius) ??
        this.findNearestPlayablePoint(x, y, PLAYER.collisionRadius ?? PLAYER.radius) ??
        { x, y };
      target.data.neutralized = true;
      target.data.state = 'possessed';
      target.state = 'possessed';
      if (target.sprite.body) {
        target.sprite.body.enable = true;
      }
      this.removeDroidEntity(target);
      this.player.applyBodyData(nextBody);
      this.player.sprite.setActive(true);
      this.player.sprite.setVisible(true);
      this.player.visual?.setVisible(true);
      this.player.sprite.clearTint();
      this.player.sprite.body.enable = true;
      this.player.sprite.setPosition(safePoint.x, safePoint.y);
      this.player.visual?.update(safePoint.x, safePoint.y, nextBody.displayId);
      this.player.sprite.body.setVelocity(0, 0);
      this.player.sprite.body.setAcceleration(0, 0);
      this.lastSafePlayerPosition = { x: safePoint.x, y: safePoint.y };
      this.spawnDestructionPulse(safePoint.x, safePoint.y, template.accentColor);
      this.runStats.transfersSucceeded += 1;
      this.runStats.bodiesPossessed += 1;
      this.runStats.highestRankPossessed = Math.max(this.runStats.highestRankPossessed, template.rank);
      this.recordDroidNeutralized(target.data, { capture: true, actorBody: previousBody });
      this.refreshAccessCollision();
      this.showWorldMessage(`TRANSFER COMPLETE: ${template.displayId}`);
      this.disableWeaponsFor(800);
    } finally {
      this.isTransferFinalizing = false;
      this.transferFinalization = null;
      this.releaseTransferEncounterLock({ restorePlayer: false, restoreTarget: false });
      this.resetInputState();
    }
  }

  findNearestPlayerSpawnPoint(x, y, radius) {
    if (!this.currentDeck?.tileMap) {
      return this.findNearestPlayablePoint(x, y, radius);
    }
    const tileSize = this.currentDeck.tileMap.tileSize;
    const originX = Math.floor(x / tileSize);
    const originY = Math.floor(y / tileSize);
    const preferredTypes = new Set([
      TILE_TYPES.ROOM_FLOOR,
      TILE_TYPES.CORRIDOR_FLOOR,
      TILE_TYPES.LIFT_ROOM_FLOOR
    ]);
    let best = null;
    let bestDistance = Infinity;
    const maxCells = 6;
    for (let ring = 0; ring <= maxCells; ring += 1) {
      for (let gy = originY - ring; gy <= originY + ring; gy += 1) {
        for (let gx = originX - ring; gx <= originX + ring; gx += 1) {
          if (Math.max(Math.abs(gx - originX), Math.abs(gy - originY)) !== ring) {
            continue;
          }
          const tile = this.currentDeck.tileMap.tiles[gy]?.[gx];
          if (!tile || !preferredTypes.has(tile.tileType)) {
            continue;
          }
          const candidate = {
            x: gx * tileSize + tileSize / 2,
            y: gy * tileSize + tileSize / 2
          };
          if (!this.mapSystem?.canFitCircleAt(candidate.x, candidate.y, radius * 1.18)) {
            continue;
          }
          const distance = Phaser.Math.Distance.Between(x, y, candidate.x, candidate.y);
          if (distance < bestDistance) {
            best = candidate;
            bestDistance = distance;
          }
        }
      }
      if (best) {
        return best;
      }
    }
    return null;
  }

  findNearestPlayablePoint(x, y, radius) {
    if (this.mapSystem?.canFitCircleAt(x, y, radius)) {
      return { x, y };
    }
    const tileSize = this.currentDeck?.tileMap?.tileSize ?? 64;
    const maxRadius = tileSize * 4;
    for (let distance = tileSize * 0.5; distance <= maxRadius; distance += tileSize * 0.5) {
      const samples = Math.max(12, Math.ceil(distance / 8));
      for (let i = 0; i < samples; i += 1) {
        const angle = (Math.PI * 2 * i) / samples;
        const candidate = {
          x: x + Math.cos(angle) * distance,
          y: y + Math.sin(angle) * distance
        };
        if (this.mapSystem?.canFitCircleAt(candidate.x, candidate.y, radius)) {
          return candidate;
        }
      }
    }
    return this.lastSafePlayerPosition ?? null;
  }

  completeTransferFailure(target) {
    target.data.detectionMemory = 3500;
    target.state = target.getAlertState();
    target.flash(0xff6f61);
    this.runStats.transfersFailed += 1;
    this.combat.damagePlayer(TRANSFER.failureDamage);
    this.showWorldMessage(`TRANSFER FAILED: ${target.data.displayId}`);
  }

  attachPlayerCollider() {
    if (!this.player || !this.walls) {
      return;
    }
    if (this.playerCollider) {
      this.playerCollider.destroy();
    }
    this.playerCollider = this.physics.add.collider(
      this.player.sprite,
      this.walls,
      (playerSprite, wall) => this.handlePlayerWallCollision(playerSprite, wall)
    );
    if (this.doorGroup) {
      if (this.lockedDoorCollider) {
        this.lockedDoorCollider.destroy();
      }
      this.lockedDoorCollider = this.physics.add.collider(
        this.player.sprite,
        this.doorGroup,
        (playerSprite, doorBlocker) => this.handlePlayerWallCollision(playerSprite, doorBlocker)
      );
    }
    if (this.droidGroup) {
      if (this.playerDroidCollider) {
        this.playerDroidCollider.destroy();
      }
      this.playerDroidCollider = this.physics.add.collider(
        this.player.sprite,
        this.droidGroup,
        (playerSprite, droidSprite) => this.handlePlayerDroidCollision(playerSprite, droidSprite)
      );
    }
    this.attachCombat();
  }

  handlePlayerDroidCollision(playerSprite, droidSprite) {
    this.resolveCircularBodyOverlap(
      playerSprite,
      droidSprite,
      PLAYER.collisionRadius ?? PLAYER.radius,
      DROID_GENERATION.collisionRadius ?? DROID_GENERATION.radius
    );
    this.playPlayerBump(droidSprite);
  }

  handlePlayerWallCollision(playerSprite, wall) {
    this.trimPlayerVelocityAlongWall(playerSprite, wall);
    this.playPlayerBump();
  }

  trimPlayerVelocityAlongWall(playerSprite, wall) {
    const body = playerSprite?.body;
    const wallBody = wall?.body;
    if (!body || !wallBody) {
      return;
    }

    const left = wallBody.x;
    const right = wallBody.x + wallBody.width;
    const top = wallBody.y;
    const bottom = wallBody.y + wallBody.height;
    const nearestX = Phaser.Math.Clamp(playerSprite.x, left, right);
    const nearestY = Phaser.Math.Clamp(playerSprite.y, top, bottom);
    let normalX = playerSprite.x - nearestX;
    let normalY = playerSprite.y - nearestY;
    let length = Math.hypot(normalX, normalY);

    if (length < 0.001) {
      const distances = [
        { x: -1, y: 0, value: Math.abs(playerSprite.x - left) },
        { x: 1, y: 0, value: Math.abs(right - playerSprite.x) },
        { x: 0, y: -1, value: Math.abs(playerSprite.y - top) },
        { x: 0, y: 1, value: Math.abs(bottom - playerSprite.y) }
      ].sort((a, b) => a.value - b.value);
      normalX = distances[0].x;
      normalY = distances[0].y;
      length = 1;
    }

    normalX /= length;
    normalY /= length;
    const velocityIntoWall = body.velocity.x * normalX + body.velocity.y * normalY;
    if (velocityIntoWall < 0) {
      body.setVelocity(
        body.velocity.x - normalX * velocityIntoWall,
        body.velocity.y - normalY * velocityIntoWall
      );
    }

    const accelerationIntoWall = body.acceleration.x * normalX + body.acceleration.y * normalY;
    if (accelerationIntoWall < 0) {
      body.setAcceleration(
        body.acceleration.x - normalX * accelerationIntoWall,
        body.acceleration.y - normalY * accelerationIntoWall
      );
    }
  }

  handleDroidDroidCollision(spriteA, spriteB) {
    this.resolveCircularBodyOverlap(
      spriteA,
      spriteB,
      DROID_GENERATION.collisionRadius ?? DROID_GENERATION.radius,
      DROID_GENERATION.collisionRadius ?? DROID_GENERATION.radius
    );
  }

  resolveCircularBodyOverlap(spriteA, spriteB, radiusA, radiusB) {
    if (!spriteA?.body?.enable || !spriteB?.body?.enable) {
      return;
    }

    let dx = spriteB.x - spriteA.x;
    let dy = spriteB.y - spriteA.y;
    let distance = Math.hypot(dx, dy);
    const minDistance = radiusA + radiusB;

    if (distance >= minDistance - 0.25) {
      return;
    }

    if (distance < 0.001) {
      dx = 1;
      dy = 0;
      distance = 1;
    }

    const normalX = dx / distance;
    const normalY = dy / distance;
    const overlap = minDistance - distance + 0.5;
    const pushA = overlap * 0.5;
    const pushB = overlap * 0.5;

    this.moveSpriteOutOfOverlap(spriteA, -normalX * pushA, -normalY * pushA, radiusA);
    this.moveSpriteOutOfOverlap(spriteB, normalX * pushB, normalY * pushB, radiusB);
    this.trimVelocityIntoNormal(spriteA.body, normalX, normalY, -1);
    this.trimVelocityIntoNormal(spriteB.body, normalX, normalY, 1);
  }

  moveSpriteOutOfOverlap(sprite, deltaX, deltaY, radius) {
    const nextX = sprite.x + deltaX;
    const nextY = sprite.y + deltaY;

    if (!this.mapSystem) {
      sprite.setPosition(nextX, nextY);
      return true;
    }
    if (this.mapSystem.canFitCircleAt(nextX, nextY, radius)) {
      sprite.setPosition(nextX, nextY);
      return true;
    }
    if (this.mapSystem.canFitCircleAt(nextX, sprite.y, radius)) {
      sprite.setPosition(nextX, sprite.y);
      return true;
    }
    if (this.mapSystem.canFitCircleAt(sprite.x, nextY, radius)) {
      sprite.setPosition(sprite.x, nextY);
      return true;
    }
    return false;
  }

  trimVelocityIntoNormal(body, normalX, normalY, direction) {
    if (!body?.velocity) {
      return;
    }
    const towardNormal = (body.velocity.x * normalX + body.velocity.y * normalY) * direction;
    if (towardNormal <= 0) {
      return;
    }
    body.setVelocity(
      body.velocity.x - normalX * towardNormal * direction,
      body.velocity.y - normalY * towardNormal * direction
    );
  }

  playPlayerBump(otherSprite = null) {
    const now = this.time.now;
    if (now < (this.nextBumpSoundAt ?? 0) || !this.player?.sprite?.body) {
      return;
    }
    const playerVelocity = this.player.sprite.body.velocity;
    let impactSpeed = playerVelocity.length();
    if (otherSprite?.body?.velocity) {
      impactSpeed = Phaser.Math.Distance.Between(
        playerVelocity.x,
        playerVelocity.y,
        otherSprite.body.velocity.x,
        otherSprite.body.velocity.y
      );
    }

    const minSpeed = 95;
    if (impactSpeed < minSpeed) {
      return;
    }

    const volumeScale = Phaser.Math.Clamp((impactSpeed - minSpeed) / 260, 0.35, 1);
    this.audio?.playBump(volumeScale);
    this.nextBumpSoundAt = now + 230;
  }

  tryInteract(point = null) {
    const terminal = this.getNearbyTerminal(point);
    if (terminal) {
      this.tryUseTerminal(terminal);
      return true;
    }

    const door = this.getNearbyDoor(point);
    if (door) {
      this.tryOpenDoor(door);
      return true;
    }

    return this.tryUseLift(point);
  }

  findInteractTarget(point = null) {
    const transferTarget = this.findContactTransferTarget();
    if (transferTarget) {
      return { type: 'transfer', target: transferTarget };
    }
    const lift = this.getNearbyLift();
    if (lift) {
      return { type: 'lift', target: lift };
    }
    const terminal = this.getNearbyTerminal();
    if (terminal) {
      return { type: 'terminal', target: terminal };
    }
    const door = this.getNearbyDoor(point);
    if (door) {
      return { type: 'door', target: door };
    }
    return null;
  }

  getInteractTargetPoint(interactTarget) {
    if (!interactTarget) {
      return null;
    }
    const target = interactTarget.target;
    if (interactTarget.type === 'transfer') {
      return { x: target.sprite.x, y: target.sprite.y, radius: 44 };
    }
    if (interactTarget.type === 'door') {
      return { x: target.x + target.width / 2, y: target.y + target.height / 2, radius: Math.max(target.width, target.height) / 2 + 8 };
    }
    return { x: target.x, y: target.y, radius: target.radius ?? 34 };
  }

  activateInteractTarget(interactTarget, time) {
    if (!interactTarget) {
      this.showWorldMessage('NO SIGNAL TARGET');
      return false;
    }
    if (interactTarget.type === 'transfer') {
      return this.transferSystem.startWithTarget(time, interactTarget.target);
    }
    if (interactTarget.type === 'lift') {
      return this.tryUseLift(interactTarget.target);
    }
    if (interactTarget.type === 'terminal') {
      this.tryUseTerminal(interactTarget.target);
      return true;
    }
    if (interactTarget.type === 'door') {
      this.tryOpenDoor(interactTarget.target);
      return true;
    }
    return false;
  }

  tryUseLift(point = null) {
    const lift = this.getNearbyLift(point);
    if (!lift) {
      return false;
    }
    const destinationDecks = lift.connectsToDeckIds.map((id) => this.getDeckById(id)).filter(Boolean);
    this.liftOverlay.show(lift, destinationDecks, {
      ship: this.ship,
      currentDeck: this.currentDeck
    });
    return true;
  }

  tryOpenDoor(door) {
    door.locked = false;
    door.clearanceRequirement = 0;
    door.open = true;
    const doorEntity = this.doorEntities?.find((entity) => entity.data === door);
    doorEntity?.forceOpen(this.time.now);
    this.showWorldMessage('DOOR OPEN');
  }

  tryUseTerminal(terminal) {
    const clearance = this.player.bodyData.clearanceLevel ?? 0;
    if (clearance < terminal.clearanceRequirement) {
      this.showWorldMessage(`CLEARANCE ${terminal.clearanceRequirement} REQUIRED`);
      return true;
    }
    terminal.used = true;
    terminal.discovered = true;
    this.terminalOverlay.showConsole({
      terminal,
      playerBody: this.player.bodyData,
      deck: this.currentDeck,
      ship: this.ship
    });
    return true;
  }

  getTerminalOutput(terminal) {
    if (terminal.terminalType === 'local-map') {
      for (const room of this.currentDeck.rooms) {
        room.discovered = true;
      }
      for (const corridor of this.currentDeck.corridors) {
        corridor.discovered = true;
      }
      for (const lift of this.currentDeck.lifts) {
        lift.discovered = true;
      }
      return { title: 'LOCAL MAP TERMINAL', lines: ['Deck map uploaded.', `${this.currentDeck.rooms.length} rooms indexed.`, `${this.currentDeck.lifts.length} lift platforms marked.`] };
    }
    if (terminal.terminalType === 'droid-registry') {
      const hostiles = this.currentDeck.droids.filter((droid) => !droid.neutralized);
      const highest = hostiles.reduce((best, droid) => !best || droid.rank > best.rank ? droid : best, null);
      return { title: 'DROID REGISTRY', lines: [`Known hostile signatures: ${hostiles.length}`, highest ? `Highest detected: ${highest.displayId} ${highest.template.name}` : 'No hostile signatures remain.'] };
    }
    if (terminal.terminalType === 'lift-network') {
      for (const lift of this.currentDeck.lifts) {
        lift.discovered = true;
      }
      return { title: 'LIFT NETWORK', lines: this.currentDeck.lifts.map((lift) => `${lift.label}: Deck ${lift.connectsToDeckIds.join(', Deck ')}`) };
    }
    return {
      title: 'SHIP STATUS',
      lines: this.ship.decks.map((deck) => `Deck ${deck.id}: ${deck.droids.filter((droid) => !droid.neutralized).length} hostiles`)
    };
  }

  changeDeck(deckId, networkId) {
    if (this.isChangingDeck) {
      return;
    }
    const nextDeck = this.getDeckById(deckId);
    if (!nextDeck) {
      return;
    }
    this.isChangingDeck = true;
    this.resetInputState();
    this.combat?.clearProjectiles();
    this.liftOverlay?.hide();
    this.cameras.main.fadeOut(380, 2, 5, 7);
    this.time.delayedCall(390, () => this.completeDeckChange(nextDeck, networkId));
  }

  completeDeckChange(nextDeck, networkId) {
    this.currentDeck = nextDeck;
    this.ship.currentDeckId = nextDeck.id;
    this.currentDeck.discovered = true;
    this.audio.playDeckMusic(this.currentDeck.id, this.currentDeck.cleared);
    this.renderCurrentDeck();

    const destinationLift = this.findArrivalLift(networkId, nextDeck.id);
    const fallbackRoom = this.currentDeck.rooms.find((room) => room.id === this.currentDeck.startRoomId);
    const x = destinationLift?.x ?? fallbackRoom.centerX;
    const y = destinationLift?.y ?? fallbackRoom.centerY;
    this.player.sprite.setPosition(x, y);
    this.player.sprite.body.setVelocity(0, 0);
    this.player.sprite.body.setAcceleration(0, 0);
    this.lastSafePlayerPosition = { x, y };

    const room = destinationLift ? this.currentDeck.rooms.find((deckRoom) => deckRoom.id === destinationLift.roomId) : fallbackRoom;
    if (room) {
      room.discovered = true;
    }
    if (destinationLift) {
      destinationLift.discovered = true;
    }

    this.refreshDeckState();
    this.cameras.main.fadeIn(380, 2, 5, 7);
    this.deckArrivalAlert?.show(nextDeck.id);
    this.disableWeaponsFor(2000);
    this.time.delayedCall(390, () => {
      this.isChangingDeck = false;
    });
  }

  spawnHitSpark(x, y, color) {
    const spark = this.add.graphics();
    spark.lineStyle(2, color, 1);
    spark.lineBetween(x - 10, y, x + 10, y);
    spark.lineBetween(x, y - 10, x, y + 10);
    spark.setDepth(30);
    this.tweens.add({
      targets: spark,
      alpha: 0,
      scale: 1.8,
      duration: 140,
      onComplete: () => spark.destroy()
    });
  }

  spawnWallHitSparks(x, y, color, incomingAngle = 0) {
    const sparks = this.add.graphics();
    sparks.setDepth(31);
    const burstCount = Phaser.Math.Between(6, 9);
    const backAngle = incomingAngle + Math.PI;
    const sparkColors = [color, 0xfff2a6, 0xff8a3d, 0x8ff0ff, 0xffffff];
    for (let i = 0; i < burstCount; i += 1) {
      const angle = backAngle + Phaser.Math.FloatBetween(-0.85, 0.85);
      const length = Phaser.Math.Between(3, 9);
      const startJitter = Phaser.Math.FloatBetween(0, 2);
      const sx = x + Math.cos(angle) * startJitter;
      const sy = y + Math.sin(angle) * startJitter;
      const ex = sx + Math.cos(angle) * length;
      const ey = sy + Math.sin(angle) * length;
      const alpha = Phaser.Math.FloatBetween(0.55, 0.95);
      const sparkColor = Phaser.Utils.Array.GetRandom(sparkColors);
      sparks.lineStyle(1, sparkColor, alpha);
      sparks.lineBetween(sx, sy, ex, ey);
      if (i % 2 === 0) {
        sparks.fillStyle(sparkColor, alpha);
        sparks.fillCircle(ex, ey, Phaser.Math.FloatBetween(0.75, 1.6));
      }
    }
    sparks.fillStyle(0xffffff, 0.9);
    sparks.fillCircle(x, y, 2);
    this.tweens.add({
      targets: sparks,
      alpha: 0,
      scale: 1.12,
      duration: 120,
      ease: 'Quad.easeOut',
      onComplete: () => sparks.destroy()
    });
  }

  spawnDestructionPulse(x, y, color) {
    const pulse = this.add.circle(x, y, 18, color, 0);
    pulse.setStrokeStyle(3, color, 1);
    pulse.setDepth(28);
    this.tweens.add({
      targets: pulse,
      alpha: 0,
      scale: 3,
      duration: 260,
      onComplete: () => pulse.destroy()
    });
  }

  playDroidExplosion(x, y, onPeak = null) {
    let peaked = false;
    const explosion = this.add.sprite(x, y, DROID_EXPLOSION.spritesheetKey, 0);
    explosion.setDepth(31);
    explosion.setDisplaySize(DROID_EXPLOSION.displaySize, DROID_EXPLOSION.displaySize);
    explosion.setBlendMode(Phaser.BlendModes.NORMAL);
    explosion.play(DROID_EXPLOSION.animationKey);

    this.time.delayedCall((DROID_EXPLOSION.peakFrame / DROID_EXPLOSION.frameRate) * 1000, () => {
      if (peaked) {
        return;
      }
      peaked = true;
      onPeak?.();
    });
    explosion.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (!peaked) {
        onPeak?.();
      }
      explosion.destroy();
    });
    return explosion;
  }

  flashPlayer() {
    this.player.sprite.setTint(0xff6f61);
    this.time.delayedCall(100, () => {
      if (this.player?.sprite?.active) {
        this.player.sprite.clearTint();
      }
    });
  }

  updateBodyStability(delta) {
    const body = this.player.bodyData;
    if (!body.stabilityMax || body.stabilityCurrent === null || body.stabilityCurrent === undefined) {
      this.player.sprite.setAlpha(1);
      return;
    }

    body.stabilityCurrent = Math.max(0, body.stabilityCurrent - body.stabilityDecayRate * (delta / 1000));
    const ratio = body.stabilityCurrent / body.stabilityMax;
    const previousState = body.bodyFailureState;

    if (ratio <= 0) {
      body.bodyFailureState = 'failing';
    } else if (ratio <= BODY_STABILITY.criticalRatio) {
      body.bodyFailureState = 'critical';
    } else if (ratio <= BODY_STABILITY.warningRatio) {
      body.bodyFailureState = 'warning';
    } else {
      body.bodyFailureState = 'normal';
    }

    this.applyStabilityVisuals(body.bodyFailureState);
    if (previousState !== body.bodyFailureState && body.bodyFailureState !== 'normal') {
      this.showWorldMessage(`BODY ${body.bodyFailureState.toUpperCase()}`);
    }

    if (body.bodyFailureState === 'failing') {
      if (body.rank <= 1) {
        this.handlePlayerDeath();
        return;
      }
      this.ejectToInfluenceBody();
      return;
    }
  }

  applyStabilityVisuals(state) {
    if (state === 'critical') {
      this.player.sprite.setAlpha(this.time.now % 220 < 110 ? 0.45 : 1);
      return;
    }
    if (state === 'warning') {
      this.player.sprite.setAlpha(this.time.now % 420 < 80 ? 0.65 : 1);
      return;
    }
    this.player.sprite.setAlpha(1);
  }

  applyStabilityDamagePenalty(damage) {
    const body = this.player?.bodyData;
    if (!body?.stabilityMax || body.stabilityCurrent === null || body.stabilityCurrent === undefined) {
      return;
    }
    body.stabilityCurrent = Math.max(0, body.stabilityCurrent - damage * BODY_STABILITY.damagePenaltyFactor);
  }

  ejectToInfluenceBody() {
    const x = this.player.sprite.x;
    const y = this.player.sprite.y;
    const ejectedBody = {
      ...STARTING_BODY,
      integrity: Math.min(BODY_STABILITY.ejectedIntegrity, STARTING_BODY.maxIntegrity)
    };

    this.spawnDestructionPulse(x, y, 0xff6f61);
    this.player.applyBodyData(ejectedBody);
    this.player.sprite.setPosition(x, y);
    this.player.sprite.setAlpha(1);
    this.lastSafePlayerPosition = { x, y };
    this.refreshAccessCollision();
    this.showWorldMessage('EJECTED TO 001');
  }

  handlePlayerDeath(killerDisplayId = null) {
    if (this.isRespawning || this.runStats.result !== 'In Progress') {
      return;
    }

    this.isRespawning = true;
    this.runStats.totalDeaths = (this.runStats.totalDeaths ?? 0) + 1;
    this.runStats.deckResetCountByDeck[this.currentDeck.id] = (this.runStats.deckResetCountByDeck[this.currentDeck.id] ?? 0) + 1;
    this.halveScoreForDeath();
    this.player.sprite.body.setVelocity(0, 0);
    this.player.sprite.body.setAcceleration(0, 0);
    this.transferOverlay?.hide();
    this.liftOverlay?.hide();
    this.terminalOverlay?.hide();
    this.targetInfoCard?.hide();
    this.bodyInfoCard?.hide();
    this.interactOrbit?.hide();
    this.audio?.stopTransferModeLoop();
    this.audio?.stopHealLoop();
    this.combat?.detachColliders();
    this.combat?.clearProjectiles();

    const x = this.player.sprite.x;
    const y = this.player.sprite.y;
    this.player.sprite.setTint(0xff3b3b);
    this.cameras.main.flash(120, 255, 59, 59);
    this.showDeathAlert(killerDisplayId);
    this.playDroidExplosion(x, y, () => {
      this.player.sprite.setVisible(false);
    });

    this.deathResetAt = this.time.now + 1050;
    this.respawnFailSafeAt = this.time.now + 2400;
    this.deathResetStarted = false;
  }

  updateRespawnState(time) {
    if (!this.isRespawning || this.deathResetStarted) {
      return;
    }
    if (this.deathResetAt && time >= this.deathResetAt) {
      this.deathResetStarted = true;
      this.safeResetCurrentDeckAfterDeath('death-state');
      return;
    }
    if (this.respawnFailSafeAt && time >= this.respawnFailSafeAt) {
      this.deathResetStarted = true;
      this.safeResetCurrentDeckAfterDeath('failsafe');
    }
  }

  showDeathAlert(killerDisplayId = null) {
    const { width, height } = this.scale;
    const panel = this.add.container(width / 2, height * 0.36);
    panel.setScrollFactor(0);
    panel.setDepth(1600);
    const bg = this.add.graphics();
    bg.fillStyle(0x120608, 0.9);
    bg.fillRect(-250, -62, 500, 124);
    bg.lineStyle(1, 0xff3b3b, 0.85);
    bg.strokeRect(-250, -62, 500, 124);
    const text = this.add.text(0, -24, [
      killerDisplayId ? `UNIT DESTROYED BY ${killerDisplayId}` : 'UNIT DESTROYED',
      '',
      'LOCAL DEFENSES RESET'
    ].join('\n'), {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '20px',
      color: '#ffb6b6',
      align: 'center',
      lineSpacing: 8
    }).setOrigin(0.5);
    text.setShadow(0, 0, '#ff3b3b', 8, true, true);
    panel.add([bg, text]);
    this.tweens.add({
      targets: panel,
      alpha: 0,
      delay: 900,
      duration: 450,
      onComplete: () => panel.destroy(true)
    });
  }

  safeResetCurrentDeckAfterDeath(source = 'timer') {
    if (!this.isRespawning) {
      return;
    }
    try {
      this.resetCurrentDeckAfterDeath();
    } catch (error) {
      console.error(`Player respawn failed during ${source} deck reset`, error);
      this.recoverPlayerAfterRespawnError();
    }
  }

  resetCurrentDeckAfterDeath() {
    const deck = this.currentDeck;
    deck.resetCount = (deck.resetCount ?? 0) + 1;
    deck.cleared = false;
    for (const room of deck.rooms) {
      room.cleared = false;
    }
    for (const door of this.getAllDoors()) {
      door.open = false;
      door.animationState = 'closed';
    }
    deck.droids = (deck.originalDroidAssignments ?? deck.droids).map((droid) => this.droidFactory.cloneDroidAssignment(droid));
    this.runStats.droidsNeutralized = this.ship.decks.reduce((sum, shipDeck) => sum + shipDeck.droids.filter((droid) => droid.neutralized).length, 0);
    this.runStats.decksCleared = this.ship.decks.filter((shipDeck) => shipDeck.cleared).length;
    this.runStats.roomsCleared = this.ship.decks.reduce((sum, shipDeck) => sum + shipDeck.rooms.filter((room) => room.cleared).length, 0);
    this.audio?.playDeckMusic(deck.id, false);

    this.renderCurrentDeck();
    const respawn = this.getRespawnPointForCurrentDeck();
    this.player.applyBodyData({ ...STARTING_BODY });
    this.player.sprite.setActive(true);
    this.player.sprite.setVisible(true);
    this.player.sprite.clearTint();
    this.player.sprite.setAlpha(1);
    this.player.sprite.setPosition(respawn.x, respawn.y);
    this.player.sprite.body.enable = true;
    this.player.sprite.body.setVelocity(0, 0);
    this.player.sprite.body.setAcceleration(0, 0);
    this.lastSafePlayerPosition = { x: respawn.x, y: respawn.y };
    this.refreshDeckState();
    this.attachCombat();
    this.resetInputState();
    this.isRespawning = false;
    this.deathResetAt = null;
    this.deathResetStarted = false;
    this.respawnFailSafeAt = null;
    this.cameras.main.centerOn(respawn.x, respawn.y);
    this.startPlayerFocusMoment();
  }

  recoverPlayerAfterRespawnError() {
    const point = this.lastSafePlayerPosition ??
      this.findNearestPlayablePoint(this.player.sprite.x, this.player.sprite.y, PLAYER.collisionRadius ?? PLAYER.radius) ??
      { x: this.player.sprite.x, y: this.player.sprite.y };
    this.player.applyBodyData({ ...STARTING_BODY });
    this.player.sprite.setActive(true);
    this.player.sprite.setVisible(true);
    this.player.sprite.clearTint();
    this.player.sprite.setAlpha(1);
    this.player.sprite.setPosition(point.x, point.y);
    this.player.sprite.body.enable = true;
    this.player.sprite.body.setVelocity(0, 0);
    this.player.sprite.body.setAcceleration(0, 0);
    this.attachCombat();
    this.resetInputState();
    this.isRespawning = false;
    this.deathResetAt = null;
    this.deathResetStarted = false;
    this.respawnFailSafeAt = null;
    this.cameras.main.centerOn(point.x, point.y);
    this.startPlayerFocusMoment();
  }

  showDamageHealthBar(targetSprite, max, before, after, options = {}) {
    this.damageHealthBars ??= [];
    this.damageHealthBars = this.damageHealthBars.filter((bar) => {
      if (bar.done || bar.targetSprite === targetSprite) {
        bar.destroy();
        return false;
      }
      return true;
    });
    this.damageHealthBars.push(new DamageHealthBar(this, targetSprite, { max, before, after, ...options }));
  }

  updateDamageHealthBars(time) {
    if (!this.damageHealthBars?.length) {
      return;
    }
    for (const bar of this.damageHealthBars) {
      bar.update(time);
    }
    this.damageHealthBars = this.damageHealthBars.filter((bar) => !bar.done);
  }

  getRespawnPointForCurrentDeck() {
    const lift = this.currentDeck.lifts.find((item) => item.discovered) ?? this.currentDeck.lifts[0];
    if (lift) {
      return { x: lift.x, y: lift.y };
    }
    const room = this.currentDeck.rooms.find((item) => item.id === this.currentDeck.startRoomId) ?? this.currentDeck.rooms[0];
    return { x: room.centerX, y: room.centerY };
  }

  triggerVictory() {
    if (this.runStats.result !== 'In Progress') {
      return;
    }
    this.runStats.result = 'Victory';
    this.runStats.cause = 'SHIP SECURED';
    this.showWorldMessage('SHIP SECURED');
    this.audio?.playVictoryMusic();
    this.finishRun(700);
  }

  triggerDefeat(cause) {
    if (this.runStats.result !== 'In Progress') {
      return;
    }
    this.runStats.result = 'Defeat';
    this.runStats.cause = cause;
    this.showWorldMessage(cause);
    this.finishRun(500);
  }

  finishRun(delay = 0) {
    this.combat?.detachColliders();
    this.combat?.clearProjectiles();
    this.player.sprite.body.setVelocity(0, 0);
    this.player.sprite.body.setAcceleration(0, 0);
    this.runStats.elapsedMs = Math.max(this.runStats.elapsedMs, this.time.now - this.runStats.startedAt);
    this.runStats.droidsNeutralized = this.ship.decks.reduce((sum, deck) => sum + deck.droids.filter((droid) => droid.neutralized).length, 0);
    this.runStats.decksCleared = this.ship.decks.filter((deck) => deck.cleared).length;
    this.runStats.roomsCleared = this.ship.decks.reduce((sum, deck) => sum + deck.rooms.filter((room) => room.cleared).length, 0);

    this.time.delayedCall(delay, () => {
      this.scene.start('GameOverScene', {
        stats: { ...this.runStats },
        seed: this.seed
      });
    });
  }

  recordDroidNeutralized(droidData, options = {}) {
    if (this.runStats.result !== 'In Progress') {
      return;
    }
    this.addScore(this.getDroidScoreValue(droidData, options));
    this.runStats.droidsNeutralized = this.ship.decks.reduce((sum, deck) => sum + deck.droids.filter((droid) => droid.neutralized).length, 0);
    this.runStats.highestRankNeutralized = Math.max(this.runStats.highestRankNeutralized, droidData.rank ?? 0);
    this.updateClearingState(droidData.deckId, droidData.roomId);
    const remaining = this.getShipHostileCount();
    if (remaining > 0) {
      this.showWorldMessage(`HOSTILE SIGNALS REMAINING: ${remaining}`);
    } else {
      this.triggerVictory();
    }
  }

  updateClearingState(deckId, roomId) {
    const deck = this.getDeckById(deckId);
    if (!deck) {
      return;
    }

    const room = deck.rooms.find((item) => item.id === roomId);
    if (room && !room.cleared && deck.droids.every((droid) => droid.roomId !== room.id || droid.neutralized)) {
      room.cleared = true;
      this.showWorldMessage('ROOM SECURED');
    }

    if (!deck.cleared && deck.droids.every((droid) => droid.neutralized)) {
      deck.cleared = true;
      const info = getDeckInfo(deck.id);
      this.showWorldMessage(`DECK ${info.displayNumber} SECURED`);
      if (this.currentDeck?.id === deck.id) {
        this.deckPalette = getClearedDeckPalette();
        this.audio.playDeckClearedSequence();
        this.redrawDeckGraphics();
      }
    }

    this.runStats.roomsCleared = this.ship.decks.reduce((sum, item) => sum + item.rooms.filter((roomItem) => roomItem.cleared).length, 0);
    this.runStats.decksCleared = this.ship.decks.filter((item) => item.cleared).length;
  }

  addScore(points) {
    const amount = Math.floor(points);
    if (!amount) {
      return;
    }
    this.runStats.score = Math.max(0, (this.runStats.score ?? 0) + amount);
    if (amount > 0) {
      this.scoreDisplay?.add(amount);
    } else {
      this.scoreDisplay?.subtract(Math.abs(amount));
    }
  }

  getDroidScoreValue(droidData, { capture = false, actorBody = null } = {}) {
    const targetSeries = this.getScoreSeries(droidData);
    const actorSeries = this.getScoreSeries(actorBody ?? this.player?.bodyData);
    return Math.abs(targetSeries - actorSeries) * 50 + (capture ? 50 : 0);
  }

  getScoreSeries(bodyOrDroid) {
    const source = bodyOrDroid ?? {};
    const rank = source.rank ?? Number.parseInt(source.displayId ?? source.template?.displayId ?? '0', 10) ?? 0;
    return Math.max(0, Math.floor(rank / 100));
  }

  halveScoreForDeath() {
    const current = Math.max(0, Math.floor(this.runStats.score ?? 0));
    const penalty = Math.floor(current / 2);
    if (penalty <= 0) {
      return;
    }
    this.addScore(-penalty);
  }

  applyRepairScoreDrain(healedAmount, maxIntegrity) {
    if (!healedAmount || !maxIntegrity) {
      return;
    }
    const quarterHealth = Math.max(1, maxIntegrity / 4);
    this.repairScoreDrainAccumulator = (this.repairScoreDrainAccumulator ?? 0) + healedAmount;
    const drainTicks = Math.floor(this.repairScoreDrainAccumulator / quarterHealth);
    if (drainTicks <= 0) {
      return;
    }
    this.repairScoreDrainAccumulator -= drainTicks * quarterHealth;
    this.addScore(-15 * drainTicks);
  }

  debugWarpDeck(direction) {
    const deckIds = this.ship.decks.map((deck) => deck.id);
    const currentIndex = deckIds.indexOf(this.currentDeck.id);
    const nextIndex = Phaser.Math.Wrap(currentIndex + direction, 0, deckIds.length);
    const currentLift = this.getNearbyLift() ?? this.currentDeck.lifts[0];
    this.changeDeck(deckIds[nextIndex], currentLift?.networkId ?? 'main-lift');
  }

  debugNeutralizeDeck() {
    if (this.runStats.result !== 'In Progress') {
      return;
    }
    for (const droid of [...this.droids]) {
      droid.data.neutralized = true;
      droid.data.state = 'debug-neutralized';
      this.recordDroidNeutralized(droid.data);
      this.removeDroidEntity(droid);
    }
  }

  debugNeutralizeShip() {
    if (this.runStats.result !== 'In Progress') {
      return;
    }
    for (const deck of this.ship.decks) {
      for (const droid of deck.droids) {
        if (!droid.neutralized) {
          droid.neutralized = true;
          droid.state = 'debug-neutralized';
          this.recordDroidNeutralized(droid);
        }
      }
    }
    for (const droid of [...this.droids]) {
      this.removeDroidEntity(droid);
    }
    this.runStats.droidsNeutralized = this.runStats.totalDroids;
    for (const deck of this.ship.decks) {
      for (const room of deck.rooms) {
        room.cleared = true;
      }
      deck.cleared = true;
    }
    this.runStats.roomsCleared = this.ship.decks.reduce((sum, deck) => sum + deck.rooms.length, 0);
    this.runStats.decksCleared = this.ship.decks.length;
    this.triggerVictory();
  }

  findArrivalLift(networkId, deckId) {
    return this.getDeckById(deckId).lifts.find((lift) => lift.networkId === networkId) ??
      this.getDeckById(deckId).lifts[0] ??
      null;
  }

  getNearbyLift(point = null) {
    return this.currentDeck.lifts.find((lift) => this.isPlayerTouchingInteractable(lift, point)) ?? null;
  }

  getNearbyTerminal(point = null) {
    return (this.currentDeck.terminals ?? []).find((terminal) => this.isPlayerTouchingInteractable(terminal, point)) ?? null;
  }

  isPlayerInsideInteractionCell(target) {
    return this.isPlayerTouchingInteractable(target);
  }

  isPlayerTouchingInteractable(target, point = null) {
    if (!target || !this.player?.sprite || !this.mapSystem) {
      return false;
    }
    const center = this.getInteractableContactCircle(target);
    if (!center) {
      return false;
    }
    const origin = point ?? this.player.sprite;
    return Phaser.Math.Distance.Between(origin.x, origin.y, center.x, center.y) <= (PLAYER.radius + center.radius);
  }

  getInteractableContactCircle(target) {
    if (!target || !this.mapSystem) {
      return null;
    }
    if (target.terminalType) {
      return this.consoleInterfacePoint(target);
    }
    const aperture = this.mapSystem.getInteractionApertureAt(target.x, target.y);
    if (!aperture) {
      return null;
    }
    const tileSize = this.currentDeck.tileMap?.tileSize ?? 32;
    const isLift = Boolean(target.connectsToDeckIds);
    return {
      x: aperture.x,
      y: aperture.y,
      radius: isLift ? tileSize * 0.34 : Math.max(aperture.radius, tileSize * 0.24)
    };
  }

  consoleInterfacePoint(terminal) {
    const tileSize = this.currentDeck.tileMap?.tileSize ?? 32;
    const side = this.normalizeWallSide(terminal.wallSide ?? terminal.orientation);
    const offset = tileSize * 0.2;
    const center = { x: terminal.x, y: terminal.y, radius: tileSize * 0.34 };
    if (side === 'north') center.y += offset;
    if (side === 'south') center.y -= offset;
    if (side === 'west') center.x += offset;
    if (side === 'east') center.x -= offset;
    return center;
  }

  getNearbyDoor(point = null) {
    const origin = point ?? this.player.sprite;
    return this.getAllDoors().find((door) => (
      !door.open &&
      Phaser.Math.Distance.Between(origin.x, origin.y, door.x + door.width / 2, door.y + door.height / 2) <= INTERACTION.range
    )) ?? null;
  }

  getAllDoors() {
    if (this.currentDeck.doors?.length) {
      return this.currentDeck.doors;
    }
    return this.currentDeck.rooms.flatMap((room) => room.doors ?? []);
  }

  getInteractionPrompt() {
    if (this.inputState?.leftHoldStarted) {
      const target = this.inputState.currentInteractTarget;
      if (!target) {
        return 'CONTACT TARGET TO ACTIVATE';
      }
      if (target.type === 'transfer') {
        return `CONTACT: Capture ${target.target.data.displayId}`;
      }
      if (target.type === 'lift') {
        return `CONTACT: Use ${target.target.label}`;
      }
      if (target.type === 'terminal') {
        return `CONTACT: Open ${target.target.terminalType}`;
      }
      if (target.type === 'door') {
        return 'Release: Open Door';
      }
    }
    const target = this.transferSystem?.findTarget();
    if (target) {
      return `Hold Left: Capture ${target.data.displayId}`;
    }
    const terminal = this.getNearbyTerminal();
    if (terminal) {
      return this.player.bodyData.clearanceLevel >= terminal.clearanceRequirement
        ? `Hold Left/F: Use ${terminal.terminalType}`
        : `Clearance ${terminal.clearanceRequirement} required`;
    }
    const door = this.getNearbyDoor();
    if (door) {
      return 'Door';
    }
    const lift = this.getNearbyLift();
    if (lift) {
      const destinations = lift.connectsToDeckIds.map((id) => `D${id}`).join('/');
      return `Hold Left/F: Use ${lift.label} (${destinations})`;
    }
    return '';
  }

  markNearbyLiftsDiscovered() {
    for (const lift of this.currentDeck.lifts) {
      const room = this.currentDeck.rooms.find((deckRoom) => deckRoom.id === lift.roomId);
      if (room?.discovered || Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, lift.x, lift.y) <= SHIP_GENERATION.liftInteractRange) {
        lift.discovered = true;
      }
    }
  }

  updateCameraBounds() {
    if (!this.currentDeck) {
      return;
    }
    this.cameras.main.setBounds(
      this.currentDeck.bounds.x,
      this.currentDeck.bounds.y,
      this.currentDeck.bounds.width,
      this.currentDeck.bounds.height
    );
  }

  enforcePlayerContainment() {
    const radius = PLAYER.collisionRadius ?? PLAYER.radius;
    const { sprite } = this.player;

    if (this.mapSystem.canFitCircleAt(sprite.x, sprite.y, radius)) {
      this.lastSafePlayerPosition = { x: sprite.x, y: sprite.y };
      return;
    }

    const body = sprite.body;
    const previous = this.lastSafePlayerPosition;
    const xOnlyValid = this.mapSystem.canFitCircleAt(sprite.x, previous.y, radius);
    const yOnlyValid = this.mapSystem.canFitCircleAt(previous.x, sprite.y, radius);

    if (xOnlyValid) {
      sprite.setPosition(sprite.x, previous.y);
      body.setVelocityY(0);
      this.lastSafePlayerPosition = { x: sprite.x, y: sprite.y };
      return;
    }

    if (yOnlyValid) {
      sprite.setPosition(previous.x, sprite.y);
      body.setVelocityX(0);
      this.lastSafePlayerPosition = { x: sprite.x, y: sprite.y };
      return;
    }

    sprite.setPosition(previous.x, previous.y);
    body.setVelocity(0, 0);
    body.setAcceleration(0, 0);
  }

  getDeckById(deckId) {
    return this.ship.decks.find((deck) => deck.id === deckId) ?? null;
  }

  refreshAccessCollision() {
    this.rebuildAccessGeometry();
    this.redrawDeckGraphics();
  }

  rebuildAccessGeometry() {
    this.mapSystem?.setAccessClearance(this.player?.bodyData.clearanceLevel ?? 0);
    this.mapSystem?.clearCachedGeometry();
    this.createCollision();
    if (this.droidGroup && this.walls) {
      if (this.droidWallCollider) {
        this.droidWallCollider.destroy();
      }
      this.droidWallCollider = this.physics.add.collider(this.droidGroup, this.walls);
    }
  }

  getCurrentDeckHostileCount() {
    return (this.currentDeck.droids ?? []).filter((droid) => !droid.neutralized).length;
  }

  getShipHostileCount() {
    return this.ship.decks.reduce((sum, deck) => sum + (deck.droids ?? []).filter((droid) => !droid.neutralized).length, 0);
  }

  showWorldMessage(message) {
    if (this.worldMessage) {
      this.worldMessage.destroy();
    }
    this.worldMessage = this.add.text(this.player.sprite.x, this.player.sprite.y - 80, message, {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#061018'
    }).setOrigin(0.5).setDepth(100);
    this.tweens.add({
      targets: this.worldMessage,
      y: this.worldMessage.y - 28,
      alpha: 0,
      duration: 900,
      onComplete: () => {
        this.worldMessage?.destroy();
        this.worldMessage = null;
      }
    });
  }

  shutdown() {
    this.scale.off('resize', this.positionWeaponEnableOverlay, this);
    this.weaponEnableContainer?.destroy(true);
    this.audio?.shutdownScene();
    this.combat?.destroy();
    this.interactOrbit?.destroy();
    this.controlTips?.destroy();
    this.scoreDisplay?.destroy();
    this.deckArrivalAlert?.destroy();
    this.startBriefingCard?.destroy();
    for (const bar of this.damageHealthBars ?? []) {
      bar.destroy();
    }
  }
}
