import Phaser from 'phaser';
import { COLORS, DEBUG } from '../data/constants.js';
import { UI_THEME } from './UiTheme.js';
import { DroidNumerals } from './fonts/DroidNumerals.js';
import { BrandedInfoFrame } from './components/BrandedInfoFrame.js';
import { getDroidVisualKeys } from '../graphics/droidAnimationAssets.js';
import { drawDroidSignalSlotEffect } from './effects/DroidSignalSlotEffect.js';

const COLORS_BY_OWNER = {
  yellow: 0xffd36a,
  purple: 0xa56bff
};
const TEXT_BY_OWNER = {
  yellow: '#ffd36a',
  purple: '#c4a0ff'
};
const BACKGROUND = 0x07070d;
const RAIL = 0x2b3342;
const DIM = 0x526171;
const SELECT_TIMER_MS = 60000;
const MATCH_TIMER_MS = 10000;
const PLUG_CLAIM_MS = 3000;
const FRAME_MARGIN = 14;
const MAX_FRAME_WIDTH = 1280;
const MAX_FRAME_HEIGHT = 820;
const BOARD_SIDE_PADDING = 32;
const BOARD_TOP_PADDING = 142;
const BOARD_BOTTOM_PADDING = 74;

export class TransferOverlay {
  constructor(scene) {
    this.scene = scene;
    this.visible = false;
    this.challenge = null;
    this.state = 'hidden';
    this.sideCursor = 'left';
    this.pulses = [];
    this.captureNodes = [];
    this.senderHotspots = [];
    this.ghostPath = null;
    this.sideHotspots = [];
    this.lastAiAt = 0;
    this.resolved = false;
    this.lastTickSecond = null;
    this.approachBPlayed = false;
    this.ignoreInitialPointerUp = false;
    this.deadlockRetryAt = 0;

    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(1800);
    this.container.setVisible(false);

    this.panel = scene.add.rectangle(0, 0, 1040, 650, BACKGROUND, 0.98);
    this.panel.setStrokeStyle(1, UI_THEME.primaryAccent, 0.9);
    this.frame = new BrandedInfoFrame(scene, { width: 1040, height: 650, title: 'TRANSFER', status: 'TIMER', depth: 1801, panelAlpha: 0 });
    this.board = scene.add.graphics();
    this.fx = scene.add.graphics();
    this.title = scene.add.text(0, -292, 'CIRCUIT CONFLICT', {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '24px',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.subtitle = scene.add.text(0, -262, '', {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '13px',
      color: COLORS.hudText
    }).setOrigin(0.5);
    this.leftStatus = scene.add.text(-480, -286, '', {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '13px',
      color: TEXT_BY_OWNER.yellow,
      lineSpacing: 5
    });
    this.rightStatus = scene.add.text(250, -286, '', {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '13px',
      color: TEXT_BY_OWNER.purple,
      lineSpacing: 5
    });
    this.timerText = scene.add.text(0, -238, '', {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '30px',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.footer = scene.add.text(0, 292, '', {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '13px',
      color: '#8aa4b0'
    }).setOrigin(0.5);
    this.cardText = scene.add.text(0, 70, '', {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '18px',
      color: '#d5dde4',
      lineSpacing: 8,
      wordWrap: { width: 500 }
    }).setOrigin(0, 0.5);
    this.sideTextLeft = scene.add.text(-220, -14, '', {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '20px',
      color: TEXT_BY_OWNER.yellow
    }).setOrigin(0.5);
    this.sideTextRight = scene.add.text(220, -14, '', {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '20px',
      color: TEXT_BY_OWNER.purple
    }).setOrigin(0.5);
    this.sideSummaryLeft = scene.add.text(0, 0, '', {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '11px',
      color: TEXT_BY_OWNER.yellow,
      align: 'center',
      lineSpacing: 4
    }).setOrigin(0.5);
    this.sideSummaryRight = scene.add.text(0, 0, '', {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '11px',
      color: TEXT_BY_OWNER.purple,
      align: 'center',
      lineSpacing: 4
    }).setOrigin(0.5);

    this.hostId = new DroidNumerals(scene, -140, -30, '001', { size: 50, depth: 1801, scrollFactor: 0, fitWidth: 118, fitHeight: 60 });
    this.targetId = new DroidNumerals(scene, 140, -30, '000', { size: 50, depth: 1801, scrollFactor: 0, fitWidth: 118, fitHeight: 60 });
    this.hostSprite = scene.add.sprite(0, 0, 'droid-series-0-sheet', 0);
    this.hostSprite.setDisplaySize(164, 164);
    this.hostSprite.setVisible(false);
    this.targetSprite = scene.add.sprite(0, 0, 'droid-series-0-sheet', 0);
    this.targetSprite.setDisplaySize(164, 164);
    this.targetSprite.setVisible(false);
    this.cardActivity = scene.add.graphics();

    this.container.add([
      this.panel,
      this.frame.container,
      this.board,
      this.fx,
      this.hostSprite,
      this.targetSprite,
      this.cardActivity,
      this.title,
      this.subtitle,
      this.leftStatus,
      this.rightStatus,
      this.timerText,
      this.footer,
      this.cardText,
      this.sideTextLeft,
      this.sideTextRight,
      this.sideSummaryLeft,
      this.sideSummaryRight,
      this.hostId.container,
      this.targetId.container
    ]);

    this.numberKeys = [
      Phaser.Input.Keyboard.KeyCodes.ONE,
      Phaser.Input.Keyboard.KeyCodes.TWO,
      Phaser.Input.Keyboard.KeyCodes.THREE,
      Phaser.Input.Keyboard.KeyCodes.FOUR,
      Phaser.Input.Keyboard.KeyCodes.FIVE,
      Phaser.Input.Keyboard.KeyCodes.SIX,
      Phaser.Input.Keyboard.KeyCodes.SEVEN,
      Phaser.Input.Keyboard.KeyCodes.EIGHT,
      Phaser.Input.Keyboard.KeyCodes.NINE
    ].map((code) => scene.input.keyboard.addKey(code));
    this.enterKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.spaceKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.leftKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.rightKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.aKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.dKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);

    this.scene.input.on('pointerdown', this.handlePointerDown, this);
    this.scene.input.on('pointerup', this.handlePointerUp, this);
    this.handleResize();
    scene.scale.on('resize', this.handleResize, this);
  }

  show(challenge, targetData, playerBody) {
    this.challenge = challenge;
    this.targetData = targetData;
    this.playerBody = playerBody;
    this.state = 'playerCard';
    this.sideCursor = 'left';
    this.pulses = [];
    this.captureNodes = [];
    this.lastAiAt = 0;
    this.resolved = false;
    this.visible = true;
    this.ignoreInitialPointerUp = this.scene.input.activePointer?.leftButtonDown() ?? false;

    this.hostId.setText(playerBody.displayId);
    this.targetId.setText(targetData.displayId);
    this.container.setVisible(true);
    this.destroySideHotspots();
    this.scene.audio?.playTransferApproachA(650);
    this.render();
  }

  destroySideHotspots() {
    for (const hotspot of this.sideHotspots) {
      hotspot.destroy();
    }
    this.sideHotspots = [];
  }

  createSideHotspots() {
    this.destroySideHotspots();
    const layout = this.getSelectionLayout();
    const hotspotWidth = layout.choicePanelWidth + 24;
    const hotspotHeight = Math.max(1, layout.bounds.height - 128);
    const hotspotY = layout.bounds.y + 64 + hotspotHeight / 2;
    for (const side of ['left', 'right']) {
      const panelX = side === 'left' ? layout.choiceLeftX : layout.choiceRightX;
      const x = panelX + layout.choicePanelWidth / 2;
      const hotspot = this.scene.add.rectangle(x, hotspotY, hotspotWidth, hotspotHeight, 0xffffff, 0.001);
      hotspot.setInteractive({ useHandCursor: true });
      hotspot.on('pointerover', () => {
        if (this.state === 'selectingSide') this.sideCursor = side;
      });
      hotspot.on('pointerdown', (pointer) => {
        if (this.state === 'selectingSide') {
          pointer.event?.stopPropagation?.();
          this.selectSide(side);
        }
      });
      this.container.add(hotspot);
      this.sideHotspots.push(hotspot);
    }
  }

  createSenderHotspots() {
    for (const hotspot of this.senderHotspots) {
      hotspot.destroy();
    }
    this.senderHotspots = [];
    const layout = this.getLayout();
    const senders = [...this.challenge.sendersLeft, ...this.challenge.sendersRight];
    for (const sender of senders) {
      const pos = this.senderPosition(sender, layout);
      const hotspot = this.scene.add.circle(pos.x, pos.y, Math.max(18, Math.min(26, layout.slotSpacing * 0.62)), 0xffffff, 0.001);
      hotspot.setInteractive({ useHandCursor: true });
      hotspot.on('pointerdown', (pointer) => {
        pointer.event?.stopPropagation?.();
        this.activateSender(sender);
      });
      this.container.add(hotspot);
      this.senderHotspots.push(hotspot);
    }
  }

  update(time, delta) {
    if (!this.visible || !this.challenge) {
      return;
    }

    if (this.state === 'playerCard' || this.state === 'targetCard') {
      if (this.anyAdvanceKey()) {
        this.advanceCard();
      }
      this.render(time);
      return;
    }

    if (this.state === 'selectingSide') {
      this.handleSideSelectionKeys();
      this.updateTimer(time);
      this.render(time);
      return;
    }

    if (this.state === 'deadlock') {
      if (time >= this.deadlockRetryAt) {
        this.retryDeadlockBoard();
      }
      this.render(time);
      return;
    }

    if (this.state === 'settling') {
      this.updateSlotClaims();
      this.updatePulses(delta / 1000);
      this.captureNodes = this.captureNodes.filter((node) => node.until > time || node.appliedAt);
      if (!this.hasUnresolvedTransferEffects(time)) {
        this.finalizeMatchResolution(time);
        return;
      }
      this.render(time);
      return;
    }

    if (this.state !== 'running') {
      this.render(time);
      return;
    }

    this.updateGhostPath();
    this.handleKeyboardSenders();
    this.updateOpponent(time);
    this.updateSlotClaims();
    this.updatePulses(delta / 1000);
    this.captureNodes = this.captureNodes.filter((node) => node.until > time || node.appliedAt);
    this.updateTimer(time);
    this.render(time);
  }

  anyAdvanceKey() {
    return Phaser.Input.Keyboard.JustDown(this.enterKey) ||
      Phaser.Input.Keyboard.JustDown(this.spaceKey) ||
      Phaser.Input.Keyboard.JustDown(this.leftKey) ||
      Phaser.Input.Keyboard.JustDown(this.rightKey) ||
      Phaser.Input.Keyboard.JustDown(this.aKey) ||
      Phaser.Input.Keyboard.JustDown(this.dKey) ||
      this.numberKeys.some((key) => Phaser.Input.Keyboard.JustDown(key));
  }

  advanceCard() {
    if (this.state === 'playerCard') {
      this.state = 'targetCard';
      if (!this.approachBPlayed) {
        this.scene.audio?.playTransferApproachB();
        this.approachBPlayed = true;
      }
    } else if (this.state === 'targetCard') {
      this.state = 'selectingSide';
      this.challenge.startedAt = this.scene.time.now;
      this.challenge.phaseStartedAt = this.challenge.startedAt;
      this.lastTickSecond = null;
      this.createSideHotspots();
    }
  }

  handlePointerDown(pointer) {
    if (!this.visible || !this.challenge) {
      return;
    }
    pointer.event?.stopPropagation?.();
    this.ignoreInitialPointerUp = true;
    const local = this.pointerToLocal(pointer);
    if (this.state === 'playerCard' || this.state === 'targetCard') {
      this.advanceCard();
      return;
    }
    if (this.state === 'selectingSide') {
      const layout = this.getSelectionLayout();
      const leftInside = this.pointInRect(local.x, local.y, layout.choiceLeftX - 12, layout.bounds.y + 64, layout.choicePanelWidth + 24, layout.bounds.height - 128);
      const rightInside = this.pointInRect(local.x, local.y, layout.choiceRightX - 12, layout.bounds.y + 64, layout.choicePanelWidth + 24, layout.bounds.height - 128);
      if (leftInside || rightInside) {
        this.selectSide(leftInside ? 'left' : 'right');
      }
      return;
    }
    if (this.state === 'running') {
      const path = this.getNearestPlayerPath(local.x, local.y);
      if (path) {
        this.activatePath(path, this.challenge.playerSide, this.challenge.playerColor);
      }
    }
  }

  handlePointerUp(pointer) {
    if (!this.visible || !this.challenge) {
      return;
    }
    this.ignoreInitialPointerUp = false;
    pointer.event?.stopPropagation?.();
  }

  pointerToLocal(pointer) {
    return {
      x: pointer.x - this.container.x,
      y: pointer.y - this.container.y
    };
  }

  pointInRect(x, y, rectX, rectY, rectWidth, rectHeight) {
    return x >= rectX && x <= rectX + rectWidth && y >= rectY && y <= rectY + rectHeight;
  }

  updateGhostPath() {
    if (this.state !== 'running') {
      this.ghostPath = null;
      return;
    }
    const pointer = this.scene.input.activePointer;
    const local = this.pointerToLocal(pointer);
    this.ghostPath = this.getPlayerPathAtLocalPoint(local.x, local.y);
  }

  getPlayerPathAtLocalPoint(x, y) {
    const layout = this.getLayout();
    const side = this.challenge.playerSide;
    const candidates = this.getSidePaths(side);
    const tolerance = Math.max(9, Math.min(16, layout.slotSpacing * 0.28));
    let best = null;
    let bestDistance = Infinity;

    for (const path of candidates) {
      const hitSegments = this.getSelectablePathSegments(path, layout);
      for (const segment of hitSegments) {
        const distance = this.distanceToSegment(x, y, segment.x1, segment.y1, segment.x2, segment.y2);
        if (distance < bestDistance) {
          best = path;
          bestDistance = distance;
        }
      }
    }
    this.ghostProgress = 0;
    return bestDistance <= tolerance ? best : null;
  }

  getNearestPlayerPath(x, y) {
    return this.getPlayerPathAtLocalPoint(x, y);
  }

  getSenderAtLocalPoint(x, y) {
    const layout = this.getLayout();
    const playerSenders = this.getSideSenders(this.challenge.playerSide);
    let best = null;
    let bestDistance = Infinity;
    for (const sender of playerSenders) {
      const pos = this.senderPosition(sender, layout);
      const dx = Math.abs(x - pos.x);
      const dy = Math.abs(y - pos.y);
      if (dx <= 36 && dy <= 24) {
        const distance = dx + dy;
        if (distance < bestDistance) {
          best = sender;
          bestDistance = distance;
        }
      }
    }
    return best;
  }

  handleSideSelectionKeys() {
    if (Phaser.Input.Keyboard.JustDown(this.leftKey) || Phaser.Input.Keyboard.JustDown(this.aKey)) {
      this.sideCursor = 'left';
    }
    if (Phaser.Input.Keyboard.JustDown(this.rightKey) || Phaser.Input.Keyboard.JustDown(this.dKey)) {
      this.sideCursor = 'right';
    }
    if (Phaser.Input.Keyboard.JustDown(this.enterKey) || Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.selectSide(this.sideCursor);
    }
  }

  selectSide(side) {
    this.applySelectedSide(side, this.scene.time.now);
    this.destroySideHotspots();
    this.state = 'running';
    this.createSenderHotspots();
    this.footer.setText('Move mouse over a dotted start port. Click to place a plug. Number keys select ports.');
  }

  applySelectedSide(side, time) {
    this.challenge.playerSide = side;
    this.challenge.opponentSide = side === 'left' ? 'right' : 'left';
    this.challenge.playerColor = side === 'left' ? 'yellow' : 'purple';
    this.challenge.opponentColor = side === 'left' ? 'purple' : 'yellow';
    this.challenge.plugsRemaining.left = side === 'left' ? this.challenge.playerPlugsTotal : this.challenge.opponentPlugsTotal;
    this.challenge.plugsRemaining.right = side === 'right' ? this.challenge.playerPlugsTotal : this.challenge.opponentPlugsTotal;
    if (!this.challenge.startedAt) {
      this.challenge.startedAt = time;
    }
    this.challenge.matchStartedAt = time;
    this.challenge.phaseStartedAt = this.challenge.matchStartedAt;
    this.lastTickSecond = null;
  }

  handleKeyboardSenders() {
    const playerPaths = this.getSidePaths(this.challenge.playerSide);
    for (let i = 0; i < playerPaths.length; i += 1) {
      if (Phaser.Input.Keyboard.JustDown(this.numberKeys[i])) {
        this.activatePath(playerPaths[i], this.challenge.playerSide, this.challenge.playerColor);
      }
    }
  }

  activateSender(sender) {
    const path = this.challenge.paths.find((item) => item.id === sender.pathId);
    return this.activatePath(path, sender.side, this.challenge.playerColor);
  }

  activatePath(path, side, color) {
    if (!path || this.state !== 'running' || side !== this.challenge.playerSide || this.challenge.plugsRemaining[side] <= 0) {
      return false;
    }
    if (this.hasActivePlugOnLane(path, side)) {
      return false;
    }
    this.challenge.plugsRemaining[side] -= 1;
    this.scene.audio?.playSetPlug();
    const now = this.scene.time.now;
    this.placePlugClaim(path, color, now);
    return true;
  }

  updateOpponent(time) {
    if (time < this.lastAiAt + this.challenge.aiDelayMs) {
      return;
    }
    if (this.challenge.plugsRemaining[this.challenge.opponentSide] <= 0) {
      return;
    }
    const path = this.chooseOpponentPath();
    if (path) {
      if (this.hasActivePlugOnLane(path, this.challenge.opponentSide)) {
        this.lastAiAt = time + Phaser.Math.Between(180, 420);
        return;
      }
    this.challenge.plugsRemaining[this.challenge.opponentSide] -= 1;
    this.scene.audio?.playSetPlug();
      this.placePlugClaim(path, this.challenge.opponentColor, time);
    }
    this.lastAiAt = time + Phaser.Math.Between(-220, 220);
  }

  hasActivePlugOnLane(path, side, now = this.scene.time.now) {
    return (path.activePlugClaims ?? []).some((claim) => claim.side === side && claim.until > now);
  }

  placePlugClaim(path, color, now = this.scene.time.now) {
    const claim = this.createPlugClaim(path, color, now);
    if (!claim) return;
    path.contestedUntil = claim.until;
    path.activePlugClaims ??= [];
    path.activePlugClaims.push(claim);
    this.captureNodes.push(claim);
    this.queuePlugClaimForTargets(claim, now);
  }

  createPlugClaim(path, color, now = this.scene.time.now) {
    if (!path) return null;
    let resolvedColor = color;
    let persistent = false;
    for (const switchBox of path.switchBoxes) {
      resolvedColor = resolvedColor === 'yellow' ? 'purple' : 'yellow';
      switchBox.flashUntil = now + 260;
    }
    for (const fixer of path.colorFixers ?? []) {
      resolvedColor = fixer.color;
      fixer.flashUntil = now + 260;
    }
    for (const repeater of path.repeaters ?? []) {
      persistent = true;
      repeater.flashUntil = now + 260;
    }
    for (const arrow of path.persistentArrows) {
      persistent = true;
      arrow.flashUntil = now + 260;
    }
    return {
      id: `plug-${path.id}-${now}-${Math.random()}`,
      pathId: path.id,
      side: path.side,
      color,
      resolvedColor,
      persistent,
      targetSlotIds: [...path.targetSlotIds],
      placedAt: now,
      until: now + PLUG_CLAIM_MS,
      appliedAt: 0
    };
  }

  queuePlugClaimForTargets(claim, now = this.scene.time.now) {
    const path = this.challenge.paths.find((item) => item.id === claim.pathId);
    if (path.terminates || !path.targetSlotIds.length) {
      return;
    }
    for (const slotId of claim.targetSlotIds) {
      const slot = this.challenge.centerSlots[slotId];
      if (!slot || (slot.lockedUntilEnd && slot.owner !== claim.resolvedColor)) {
        if (slot) slot.blockedUntil = now + 260;
        continue;
      }
      slot.pendingPlugClaims ??= [];
      slot.pendingPlugClaims.push(claim);
    }
  }

  chooseOpponentSender() {
    const path = this.chooseOpponentPath();
    return path ? this.getSender(path.senderId) : null;
  }

  chooseOpponentPath() {
    const candidates = this.getSidePaths(this.challenge.opponentSide);
    if (!candidates.length) return null;
    return Phaser.Utils.Array.GetRandom(candidates);
  }

  launchPulse(sender, ownerColor) {
    const path = this.challenge.paths.find((item) => item.id === sender.pathId);
    this.launchPulseForPath(path, ownerColor);
  }

  launchPulseForPath(path, ownerColor) {
    if (!path) return;
    this.pulses.push({
      id: `pulse-${this.scene.time.now}-${Math.random()}`,
      senderId: path.senderId,
      pathId: path.id,
      side: path.side,
      ownerColor,
      displayColor: ownerColor,
      progress: 0,
      speed: this.challenge.pulseSpeed,
      firedAt: this.scene.time.now,
      targetSlotIds: path.targetSlotIds,
      isPersistent: false,
      triggeredSwitchIds: new Set(),
      triggeredArrowIds: new Set()
    });
  }

  updatePulses(dt) {
    this.updateSlotClaims();
    const done = [];
    for (const pulse of this.pulses) {
      const path = this.challenge.paths.find((item) => item.id === pulse.pathId);
      if (!path) {
        done.push(pulse);
        continue;
      }
      pulse.progress = Math.min(1, pulse.progress + pulse.speed * dt);
      for (const switchBox of path.switchBoxes) {
        if (pulse.progress >= switchBox.at && !pulse.triggeredSwitchIds.has(switchBox.id)) {
          pulse.triggeredSwitchIds.add(switchBox.id);
          pulse.displayColor = pulse.displayColor === 'yellow' ? 'purple' : 'yellow';
          switchBox.flashUntil = this.scene.time.now + 180;
        }
      }
      pulse.triggeredFixerIds ??= new Set();
      pulse.triggeredRepeaterIds ??= new Set();
      for (const fixer of path.colorFixers ?? []) {
        if (pulse.progress >= fixer.at && !pulse.triggeredFixerIds.has(fixer.id)) {
          pulse.triggeredFixerIds.add(fixer.id);
          pulse.displayColor = fixer.color;
          fixer.flashUntil = this.scene.time.now + 180;
        }
      }
      for (const repeater of path.repeaters ?? []) {
        if (pulse.progress >= repeater.at && !pulse.triggeredRepeaterIds.has(repeater.id)) {
          pulse.triggeredRepeaterIds.add(repeater.id);
          pulse.isPersistent = true;
          repeater.flashUntil = this.scene.time.now + 180;
        }
      }
      for (const arrow of path.persistentArrows) {
        if (pulse.progress >= arrow.at && !pulse.triggeredArrowIds.has(arrow.id)) {
          pulse.triggeredArrowIds.add(arrow.id);
          pulse.isPersistent = true;
          arrow.flashUntil = this.scene.time.now + 180;
        }
      }
      if (pulse.progress >= 1) {
        this.resolvePulse(pulse);
        done.push(pulse);
      }
    }
    this.pulses = this.pulses.filter((pulse) => !done.includes(pulse));
  }

  resolvePulse(pulse) {
    const now = this.scene.time.now;
    const path = this.challenge.paths.find((item) => item.id === pulse.pathId);
    if (path?.terminates || !pulse.targetSlotIds.length) {
      path.contestedUntil = now + 180;
      return;
    }
    for (const slotId of pulse.targetSlotIds) {
      const slot = this.challenge.centerSlots[slotId];
      if (!slot || (slot.lockedUntilEnd && slot.owner !== pulse.displayColor)) {
        slot.blockedUntil = now + 220;
        continue;
      }
      if (pulse.isPersistent) {
        if (slot.owner !== pulse.displayColor) {
          slot.owner = pulse.displayColor;
          slot.lastChangedTime = now;
        }
        slot.lockedUntilEnd = true;
        slot.activeClaims = [];
      } else {
        slot.activeClaims ??= [];
        slot.activeClaims.push({
          owner: pulse.displayColor,
          until: now + (this.challenge.claimHoldMs ?? 1100),
          firedAt: pulse.firedAt ?? now
        });
        this.applySlotClaimState(slot, now);
      }
    }
  }

  updateTimer(time) {
    const phaseDuration = this.state === 'selectingSide'
      ? this.challenge.selectTimerMs ?? SELECT_TIMER_MS
      : this.challenge.matchTimerMs ?? MATCH_TIMER_MS;
    const phaseStartedAt = this.challenge.phaseStartedAt || this.challenge.startedAt || time;
    const remaining = phaseDuration - (time - phaseStartedAt);
    this.playTimerTick(remaining);
    if (remaining <= 0) {
      if (this.state === 'selectingSide') {
        this.selectSide(this.sideCursor);
        return;
      }
      if (this.hasUnresolvedTransferEffects(time)) {
        this.startSettlingPhase(time);
        return;
      }
      this.finalizeMatchResolution(time);
    }
  }

  startSettlingPhase(time) {
    this.state = 'settling';
    this.challenge.state = 'settling';
    this.ghostPath = null;
    this.lastTickSecond = null;
    this.footer.setText('SIGNAL SETTLING // RESOLVING ACTIVE CLAIMS');
    this.scene.audio?.playTransferTick();
  }

  hasUnresolvedTransferEffects(time = this.scene.time.now) {
    if (!this.challenge) return false;
    if (this.pulses?.length) return true;
    if (this.captureNodes.some((node) => node.until > time && !node.appliedAt)) return true;
    return this.challenge.centerSlots.some((slot) =>
      (slot.pendingPlugClaims ?? []).some((claim) => !claim.appliedAt)
    );
  }

  finalizeMatchResolution(time = this.scene.time.now) {
    this.updateSlotClaims();
    const playerCount = this.countSlots(this.challenge.playerColor);
    const opponentCount = this.countSlots(this.challenge.opponentColor);
    if (playerCount === opponentCount) {
      this.startDeadlockRetry(time);
      return;
    }
    this.resolve(playerCount > opponentCount);
  }

  startDeadlockRetry(time) {
    this.state = 'deadlock';
    this.challenge.state = 'deadlock';
    this.challenge.deadlockCount = (this.challenge.deadlockCount ?? 0) + 1;
    this.deadlockRetryAt = time + 1250;
    this.pulses = [];
    this.captureNodes = [];
    this.ghostPath = null;
    this.scene.audio?.playTransferFail();
    this.footer.setText('DEADLOCK // CIRCUIT DRAW // RETRYING TRANSFER');
  }

  retryDeadlockBoard() {
    const side = this.challenge?.playerSide ?? this.sideCursor ?? 'left';
    const deadlockCount = this.challenge?.deadlockCount ?? 0;
    const target = this.scene.transferSystem?.activeTarget;
    if (!target) {
      this.resolve(false);
      return;
    }
    this.challenge = this.scene.transferSystem.createChallenge(target);
    this.challenge.deadlockCount = deadlockCount;
    this.pulses = [];
    this.captureNodes = [];
    this.ghostPath = null;
    this.resolved = false;
    this.lastAiAt = this.scene.time.now + 420;
    this.applySelectedSide(side, this.scene.time.now);
    this.state = 'running';
  }

  playTimerTick(remainingMs) {
    const second = Math.max(0, Math.ceil(remainingMs / 1000));
    if (this.lastTickSecond === null) {
      this.lastTickSecond = second;
      return;
    }
    if (second !== this.lastTickSecond) {
      this.scene.audio?.playTransferTick();
      this.lastTickSecond = second;
    }
  }

  updateSlotClaims() {
    const now = this.scene.time.now;
    for (const path of this.challenge.paths) {
      path.activePlugClaims = (path.activePlugClaims ?? []).filter((claim) => claim.until > now || !claim.appliedAt);
    }
    for (const slot of this.challenge.centerSlots) {
      this.applySlotClaimState(slot, now);
    }
  }

  applySlotClaimState(slot, now) {
    if (slot.lockedUntilEnd) {
      for (const claim of slot.pendingPlugClaims ?? []) {
        if (claim.until <= now) {
          claim.appliedAt = now;
        }
      }
      slot.pendingPlugClaims = (slot.pendingPlugClaims ?? []).filter((claim) => !claim.appliedAt);
      slot.activeClaims = [];
      return;
    }
    const pendingPlugClaims = (slot.pendingPlugClaims ?? [])
      .filter((claim) => claim.until <= now && !claim.appliedAt)
      .sort((a, b) => a.until - b.until);
    for (const claim of pendingPlugClaims) {
      if (slot.lockedUntilEnd && slot.owner !== claim.resolvedColor) {
        slot.blockedUntil = now + 220;
        continue;
      }
      if (slot.owner !== claim.resolvedColor) {
        slot.owner = claim.resolvedColor;
        slot.lastChangedTime = now;
      }
      claim.appliedAt = now;
      if (claim.persistent) {
        slot.lockedUntilEnd = true;
      }
    }
    slot.pendingPlugClaims = (slot.pendingPlugClaims ?? []).filter((claim) => !claim.appliedAt);
    if (slot.lockedUntilEnd) {
      return;
    }
    slot.activeClaims = (slot.activeClaims ?? []).filter((claim) => claim.until > now);
    if (!slot.activeClaims.length) {
      return;
    }
    const active = [...slot.activeClaims].sort((a, b) => a.firedAt - b.firedAt)[0];
    if (slot.owner !== active.owner) {
      slot.owner = active.owner;
      slot.lastChangedTime = now;
    }
  }

  countSlots(owner) {
    return this.challenge.centerSlots.filter((slot) => slot.owner === owner).length;
  }

  render(time = 0) {
    if (!this.challenge) return;
    this.board.clear();
    this.fx.clear();
    this.cardActivity.clear();
    this.hostId.container.setVisible(false);
    this.targetId.container.setVisible(false);
    this.hostSprite.setVisible(false);
    this.targetSprite.setVisible(false);
    this.cardText.setText('');
    this.sideTextLeft.setText('');
    this.sideTextRight.setText('');
    this.sideSummaryLeft.setText('');
    this.sideSummaryRight.setText('');

    if (this.state === 'playerCard') {
      this.renderIntroCard('CURRENT HOST', this.playerBody, this.hostSprite, this.hostId, 'Click or press any key', time);
      return;
    }
    if (this.state === 'targetCard') {
      this.renderIntroCard('TARGET DROID', this.targetData.template, this.targetSprite, this.targetId, 'Click or press any key', time);
      return;
    }
    if (this.state === 'selectingSide') {
      this.renderSideSelection();
      return;
    }
    if (this.state === 'deadlock') {
      this.renderDeadlock();
      return;
    }
    this.renderBoard(time);
  }

  renderIntroCard(label, body, sprite, numerals, footer, time = 0) {
    const { width: frameWidth, height: frameHeight } = this.getOverlayFrameSize();
    const contentWidth = Math.max(1, Math.min(880, frameWidth - 72));
    const contentHeight = Math.max(1, Math.min(420, frameHeight - 186));
    const left = -contentWidth / 2;
    const top = -contentHeight / 2 + 24;
    const iconX = left + contentWidth * 0.28;
    const iconY = top + contentHeight * 0.52;
    const textX = left + contentWidth * 0.48;
    const textY = top + contentHeight * 0.47;
    const visual = getDroidVisualKeys(body.rank ?? Number.parseInt(body.displayId, 10) ?? 0);
    this.title.setText('TRANSFER HANDSHAKE');
    this.subtitle.setText(label);
    this.timerText.setText('');
    this.leftStatus.setText('');
    this.rightStatus.setText('');
    this.footer.setText(footer);

    this.frame.setTitle('TRANSFER');
    this.frame.setStatus(label);

    this.board.fillStyle(0x02070a, 0.94);
    this.board.fillRoundedRect(left, top, contentWidth, contentHeight, 6);
    this.board.lineStyle(2, UI_THEME.primaryAccent, 0.88);
    this.board.strokeRoundedRect(left, top, contentWidth, contentHeight, 6);
    this.board.fillStyle(0x102533, 0.9);
    this.board.fillRect(textX - 28, top + 58, contentWidth * 0.44, contentHeight - 116);
    this.board.lineStyle(1, 0xb7f6ff, 0.36);
    this.board.strokeRect(textX - 28, top + 58, contentWidth * 0.44, contentHeight - 116);
    this.board.lineStyle(1, 0x78f0ff, 0.07);
    for (let y = top + 72; y < top + contentHeight - 70; y += 10) {
      this.board.lineBetween(textX - 16, y, left + contentWidth - 44, y);
    }
    this.board.lineStyle(2, 0xffd36a, 0.45);
    this.board.lineBetween(left + 28, top + 28, left + 92, top + 28);
    this.board.lineBetween(left + 28, top + 28, left + 28, top + 86);
    this.board.lineStyle(2, 0x78f0ff, 0.45);
    this.board.lineBetween(left + contentWidth - 28, top + contentHeight - 28, left + contentWidth - 92, top + contentHeight - 28);
    this.board.lineBetween(left + contentWidth - 28, top + contentHeight - 28, left + contentWidth - 28, top + contentHeight - 86);

    sprite.setTexture(visual.textureKey, 0);
    sprite.play(visual.animationKey, true);
    sprite.setDisplaySize(164, 164);
    sprite.setPosition(iconX, iconY);
    sprite.setVisible(true);
    numerals.container.setVisible(true);
    numerals.container.setPosition(iconX, iconY + 2);
    numerals.setText(body.displayId ?? '000');
    numerals.setColor(0xd5dde4, 0x333d43);
    if ((body.displayId ?? '000') === '001') {
      const pulse = 0.5 + Math.sin(time * 0.0022) * 0.5;
      drawDroidSignalSlotEffect(this.cardActivity, time, {
        x: iconX,
        y: iconY - 2,
        width: 96,
        height: 36,
        pulse,
        orientation: 'vertical'
      });
    }

    this.cardText.setText([
      `${body.displayId ?? '000'} ${body.name ?? this.getBodyClassLabel(body)}`,
      this.getBodyClassLabel(body),
      '',
      this.getBodyDescription(body)
    ]);
    this.cardText.setPosition(textX, textY);
    this.cardText.setWordWrapWidth(Math.max(300, contentWidth * 0.4));
    this.cardText.setColor('#d5dde4');
  }

  renderSideSelection() {
    const phaseStartedAt = this.challenge.phaseStartedAt || this.challenge.startedAt || this.scene.time.now;
    const remaining = Math.max(0, (this.challenge.selectTimerMs ?? SELECT_TIMER_MS) - (this.scene.time.now - phaseStartedAt));
    this.title.setText('COLOUR');
    this.subtitle.setText('CHOOSE TRANSFER SIGNAL');
    this.timerText.setText(`TIME ${Math.ceil(remaining / 1000).toString().padStart(2, '0')}`);
    this.timerText.setColor(remaining <= 5000 && this.scene.time.now % 500 < 250 ? '#ff6f61' : '#ffffff');
    this.frame.setTitle('TRANSFER');
    this.frame.setStatus(`TIMER ${Math.ceil(remaining / 1000).toString().padStart(2, '0')}`);
    this.leftStatus.setText('');
    this.rightStatus.setText('');
    this.footer.setText('CLICK A SIGNAL PANEL OR USE LEFT / RIGHT THEN ENTER');
    const layout = this.getSelectionLayout();
    this.drawBoardFrame(layout);
    this.drawPaths(layout, this.scene.time.now);
    this.drawCenterSpine(layout, this.scene.time.now);
    this.drawSenders(layout);
    this.drawSideChoicePanels(layout, remaining);
    this.drawSideDroids(layout, this.scene.time.now);
    this.drawSideSelectionHighlight(layout);
    this.sideTextLeft.setText('YELLOW');
    this.sideTextRight.setText('PURPLE');
    this.sideTextLeft.setPosition(layout.choiceLeftX + layout.choicePanelWidth / 2, layout.bounds.y + layout.bounds.height - 54);
    this.sideTextRight.setPosition(layout.choiceRightX + layout.choicePanelWidth / 2, layout.bounds.y + layout.bounds.height - 54);
    this.sideSummaryLeft.setText(this.getSideTopologySummary('left'));
    this.sideSummaryRight.setText(this.getSideTopologySummary('right'));
    this.sideSummaryLeft.setPosition(layout.choiceLeftX + layout.choicePanelWidth / 2, layout.bounds.y + layout.bounds.height - 108);
    this.sideSummaryRight.setPosition(layout.choiceRightX + layout.choicePanelWidth / 2, layout.bounds.y + layout.bounds.height - 108);
    this.sideSummaryLeft.setWordWrapWidth(Math.max(1, layout.choicePanelWidth - 22));
    this.sideSummaryRight.setWordWrapWidth(Math.max(1, layout.choicePanelWidth - 22));
  }

  drawSideChoicePanels(layout, remaining) {
    const panelTop = layout.bounds.y + 76;
    const panelHeight = Math.max(112, layout.bounds.height - 152);
    const panelWidth = layout.choicePanelWidth;
    const leftX = layout.choiceLeftX;
    const rightX = layout.choiceRightX;
    const pulse = 0.5 + Math.sin(this.scene.time.now * 0.006) * 0.5;
    const choices = [
      { side: 'left', x: leftX, color: COLORS_BY_OWNER.yellow, label: 'YELLOW SIGNAL' },
      { side: 'right', x: rightX, color: COLORS_BY_OWNER.purple, label: 'PURPLE SIGNAL' }
    ];

    for (const choice of choices) {
      const selected = this.sideCursor === choice.side;
      if (selected) {
        this.board.fillStyle(choice.color, 0.16 + pulse * 0.06);
        this.board.fillRoundedRect(choice.x - 12, panelTop - 12, panelWidth + 24, panelHeight + 24, 8);
        this.board.lineStyle(3, choice.color, 0.55 + pulse * 0.25);
        this.board.strokeRoundedRect(choice.x - 12, panelTop - 12, panelWidth + 24, panelHeight + 24, 8);
      }
      this.board.fillStyle(selected ? 0x101722 : 0x05080c, selected ? 0.9 : 0.48);
      this.board.fillRoundedRect(choice.x, panelTop, panelWidth, panelHeight, 5);
      this.board.lineStyle(selected ? 4 : 2, choice.color, selected ? 0.95 : 0.42);
      this.board.strokeRoundedRect(choice.x, panelTop, panelWidth, panelHeight, 5);
      this.board.fillStyle(choice.color, selected ? 0.34 + pulse * 0.12 : 0.08);
      this.board.fillRect(choice.x + 12, panelTop + 16, panelWidth - 24, 40);
      this.board.lineStyle(2, choice.color, selected ? 1 : 0.28);
      this.board.strokeRect(choice.x + 12, panelTop + 16, panelWidth - 24, 40);
      this.board.lineStyle(2, choice.color, selected ? 0.9 : 0.45);
      const centerX = choice.x + panelWidth / 2;
      const centerY = panelTop + panelHeight * 0.52;
      this.board.strokeCircle(centerX, centerY, 30);
      this.board.fillStyle(choice.color, selected ? 0.94 : 0.58);
      this.board.fillCircle(centerX, centerY, 10);
      this.board.lineStyle(2, 0xf3f0e3, selected ? 0.9 : 0.36);
      this.board.lineBetween(centerX - 42, centerY, centerX + 42, centerY);
      this.board.lineBetween(centerX, centerY - 42, centerX, centerY + 42);
      if (selected) {
        this.board.fillStyle(choice.color, 0.92);
        this.board.fillTriangle(centerX - 13, panelTop + panelHeight - 36, centerX + 13, panelTop + panelHeight - 36, centerX, panelTop + panelHeight - 18);
        this.board.lineStyle(4, choice.color, 0.88);
        this.board.lineBetween(centerX - 44, panelTop + 70, centerX + 44, panelTop + 70);
      }
    }

    this.board.fillStyle(0xf3f0e3, 0.88);
    this.board.fillRoundedRect(layout.centerX - 68, layout.bounds.y + 20, 136, 28, 4);
    this.board.fillStyle(remaining <= 10000 ? 0xff6f61 : 0x2b1018, 1);
    this.board.fillRect(layout.centerX - 48, layout.bounds.y + 28, 96, 12);
  }

  renderDeadlock() {
    this.title.setText('DEADLOCK');
    this.subtitle.setText('');
    this.timerText.setText('RETRYING TRANSFER');
    this.timerText.setColor('#ff6f61');
    this.leftStatus.setText('');
    this.rightStatus.setText('');
    this.frame.setTitle('TRANSFER');
    this.frame.setStatus('DEADLOCK');
    const layout = this.getLayout();
    this.drawBoardFrame(layout);
    this.drawPaths(layout, this.scene.time.now);
    this.drawCenterSpine(layout, this.scene.time.now);
    this.board.fillStyle(0x05080c, 0.76);
    this.board.fillRoundedRect(-230, -92, 460, 184, 5);
    this.board.lineStyle(3, 0xff6f61, 0.95);
    this.board.strokeRoundedRect(-230, -92, 460, 184, 5);
    this.board.fillStyle(0xff6f61, 0.92);
    this.board.fillRect(-180, -50, 360, 5);
    this.board.fillRect(-180, 50, 360, 5);
    this.board.fillStyle(0xffd36a, 0.35);
    for (let x = -160; x <= 160; x += 34) {
      this.board.fillRect(x, -10, 18, 4);
    }
  }

  drawSideSelectionHighlight(layout) {
    const selectedLeft = this.sideCursor === 'left';
    const selectedColor = selectedLeft ? COLORS_BY_OWNER.yellow : COLORS_BY_OWNER.purple;
    const panelX = selectedLeft ? layout.choiceLeftX : layout.choiceRightX;
    const selectedX = selectedLeft ? layout.leftX : layout.rightX;
    const railX = selectedLeft ? layout.leftX - 22 : layout.rightX + 22;
    const top = layout.startY - 48;
    const bottom = layout.startY + (this.challenge.centerSlots.length - 1) * layout.slotSpacing + 48;
    this.board.lineStyle(8, selectedColor, 0.22);
    this.board.lineBetween(railX, top, railX, bottom);
    this.board.lineStyle(3, selectedColor, 1);
    if (layout.choicePanelWidth) {
      this.board.strokeRoundedRect(panelX - 8, layout.bounds.y + 64, layout.choicePanelWidth + 16, layout.bounds.height - 128, 8);
    } else {
      this.board.strokeRoundedRect(selectedX - 52, top - 10, 104, bottom - top + 20, 8);
    }
    this.board.fillStyle(selectedColor, 0.9);
    const dir = selectedLeft ? 1 : -1;
    this.board.fillTriangle(selectedX - dir * 28, top - 20, selectedX - dir * 28, top + 6, selectedX + dir * 8, top - 7);
  }

  renderBoard(time) {
    const layout = this.getLayout();
    const phaseStartedAt = this.challenge.phaseStartedAt || this.challenge.matchStartedAt || this.scene.time.now;
    const remaining = Math.max(0, (this.challenge.matchTimerMs ?? MATCH_TIMER_MS) - (this.scene.time.now - phaseStartedAt));
    const playerCount = this.countSlots(this.challenge.playerColor);
    const opponentCount = this.countSlots(this.challenge.opponentColor);
    const settling = this.state === 'settling';
    this.title.setText(settling ? 'SIGNAL SETTLING' : 'CIRCUIT CONFLICT');
    this.subtitle.setText('');
    this.timerText.setText(settling ? 'RESOLVING' : `TIME ${Math.ceil(remaining / 1000).toString().padStart(2, '0')}`);
    this.frame.setTitle('TRANSFER');
    this.frame.setStatus(settling ? 'SETTLING' : `TIMER ${Math.ceil(remaining / 1000).toString().padStart(2, '0')}`);
    this.timerText.setColor(settling ? '#d5dde4' : remaining <= 10000 && time % 500 < 250 ? '#ff6f61' : '#ffffff');
    this.leftStatus.setText('');
    this.rightStatus.setText('');

    this.drawBoardFrame(layout);
    this.drawSideDroids(layout, time);
    this.drawPaths(layout, time);
    this.drawPlacedCaptureNodes(layout, time);
    this.drawCenterSpine(layout, time);
    this.drawSenders(layout);
    this.drawPulses(layout);
    if (settling) {
      this.footer.setText(`CONTROL ${playerCount} / ${opponentCount}  //  ACTIVE SIGNALS RESOLVING`);
    } else {
      this.footer.setText(`CONTROL ${playerCount} / ${opponentCount}  //  PLUGS ${this.challenge.plugsRemaining[this.challenge.playerSide]}  //  ${this.challenge.playerColor.toUpperCase()} SIGNAL`);
    }
  }

  renderBoardPreview(time) {
    const layout = this.getLayout();
    this.drawBoardFrame(layout);
    this.drawPaths(layout, time);
    this.drawCenterSpine(layout, time);
    this.drawSenders(layout);
  }

  drawBoardFrame(layout) {
    const bounds = layout.bounds;
    this.board.fillStyle(0x240b13, 1);
    this.board.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    this.board.lineStyle(2, 0xe2eef0, 0.9);
    this.board.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    this.board.fillStyle(0xf3f0e3, 1);
    this.board.fillRoundedRect(bounds.x + 22, bounds.y + 14, bounds.width - 44, 34, 4);
    this.board.lineStyle(1, 0x8b3f2f, 0.8);
    this.board.strokeRoundedRect(bounds.x + 22, bounds.y + 14, bounds.width - 44, 34, 4);
    this.board.fillStyle(0x8b3f2f, 1);
    this.board.fillRect(bounds.x + 62, bounds.y + 24, 92, 14);
    this.board.fillRect(layout.centerX - 55, bounds.y + 24, 110, 14);
    this.board.fillRect(bounds.x + bounds.width - 154, bounds.y + 24, 92, 14);
    this.board.lineStyle(2, 0x101722, 0.92);
    for (let y = layout.startY; y <= layout.startY + (this.challenge.centerSlots.length - 1) * layout.slotSpacing; y += layout.slotSpacing) {
      this.board.lineBetween(layout.leftX, y, layout.rightX, y);
    }
    this.board.fillStyle(COLORS_BY_OWNER.yellow, 0.08);
    this.board.fillRect(layout.leftX - 48, layout.startY - 30, 54, (this.challenge.centerSlots.length - 1) * layout.slotSpacing + 60);
    this.board.fillStyle(COLORS_BY_OWNER.purple, 0.08);
    this.board.fillRect(layout.rightX - 6, layout.startY - 30, 54, (this.challenge.centerSlots.length - 1) * layout.slotSpacing + 60);
    this.board.lineStyle(4, COLORS_BY_OWNER.yellow, 0.9);
    this.board.lineBetween(layout.leftX - 22, layout.startY - 28, layout.leftX - 22, layout.startY + (this.challenge.centerSlots.length - 1) * layout.slotSpacing + 28);
    this.board.lineStyle(4, COLORS_BY_OWNER.purple, 0.9);
    this.board.lineBetween(layout.rightX + 22, layout.startY - 28, layout.rightX + 22, layout.startY + (this.challenge.centerSlots.length - 1) * layout.slotSpacing + 28);
  }

  drawSideDroids(layout, time) {
    if (this.state !== 'running' && this.state !== 'selectingSide') return;
    if (this.state === 'selectingSide') {
      const playerX = this.sideCursor === 'left'
        ? layout.choiceLeftX + layout.choicePanelWidth / 2
        : layout.choiceRightX + layout.choicePanelWidth / 2;
      const markerY = layout.bounds.y + 108;
      this.drawDroidMarker(this.hostSprite, this.hostId, this.playerBody, playerX, markerY, COLORS_BY_OWNER[this.sideCursor === 'left' ? 'yellow' : 'purple'], time);
      return;
    }
    const leftBody = this.challenge.playerSide === 'left' ? this.playerBody : this.targetData.template;
    const rightBody = this.challenge.playerSide === 'right' ? this.playerBody : this.targetData.template;
    const leftSprite = this.challenge.playerSide === 'left' ? this.hostSprite : this.targetSprite;
    const rightSprite = this.challenge.playerSide === 'right' ? this.hostSprite : this.targetSprite;
    const leftNumerals = this.challenge.playerSide === 'left' ? this.hostId : this.targetId;
    const rightNumerals = this.challenge.playerSide === 'right' ? this.hostId : this.targetId;
    const markerY = Math.max(layout.bounds.y + 42, layout.startY - Math.min(52, layout.slotSpacing * 1.3));
    this.drawDroidMarker(leftSprite, leftNumerals, leftBody, layout.leftX + layout.senderOffset + 8, markerY, COLORS_BY_OWNER.yellow, time);
    this.drawDroidMarker(rightSprite, rightNumerals, rightBody, layout.rightX - layout.senderOffset - 8, markerY, COLORS_BY_OWNER.purple, time);
  }

  drawDroidMarker(sprite, numerals, body, x, y, color, time) {
    const visual = getDroidVisualKeys(body.rank ?? Number.parseInt(body.displayId, 10) ?? 0);
    const pulse = 0.5 + Math.sin(time * 0.006) * 0.5;
    this.board.fillStyle(0x060a0e, 0.88);
    this.board.fillCircle(x, y, 42);
    this.board.lineStyle(3, color, 0.62 + pulse * 0.24);
    this.board.strokeCircle(x, y, 45);
    this.board.lineStyle(2, 0xf3f0e3, 0.5);
    this.board.lineBetween(x - 54, y, x + 54, y);
    this.board.lineBetween(x, y - 54, x, y + 54);
    sprite.setTexture(visual.textureKey, 0);
    sprite.play(visual.animationKey, true);
    sprite.setDisplaySize(88, 88);
    sprite.setPosition(x, y);
    sprite.setVisible(true);
    numerals.setText(body.displayId ?? '000');
    numerals.setColor(0xd5dde4, 0x333d43);
    numerals.container.setPosition(x, y + 1);
    numerals.container.setVisible(true);
  }

  drawMiniDroid(x, y, id, color, time) {
    const pulse = 0.5 + Math.sin(time * 0.006) * 0.5;
    this.board.fillStyle(0x060a0e, 0.95);
    this.board.fillCircle(x, y, 16);
    this.board.lineStyle(2, color, 0.65 + pulse * 0.25);
    this.board.strokeCircle(x, y, 18);
    this.board.fillStyle(color, 0.8);
    this.board.fillCircle(x, y, 6);
    this.board.fillStyle(0x2b1018, 1);
    this.board.fillCircle(x, y, 3);
    this.board.lineStyle(3, 0x2b1018, 1);
    this.board.lineBetween(x - 12, y, x + 12, y);
    this.board.lineBetween(x, y - 12, x, y + 12);
    this.board.fillStyle(0xf3f0e3, 0.95);
    this.board.fillRect(x - 14, y + 22, 28, 10);
    this.board.fillStyle(0x2b1018, 1);
    this.board.fillRect(x - 11, y + 24, 22, 6);
    this.board.lineStyle(1, color, 0.8);
    this.board.strokeRect(x - 14, y + 22, 28, 10);
  }

  drawPaths(layout, time) {
    for (const path of this.challenge.paths) {
      const contested = path.contestedUntil > this.scene.time.now;
      const sideColor = COLORS_BY_OWNER[path.side === 'left' ? 'yellow' : 'purple'];
      const previewed = this.ghostPath?.id === path.id;
      const selecting = this.state === 'selectingSide';
      const alpha = selecting ? 0.74 : contested || previewed ? 0.95 : 0.42;
      const color = selecting ? sideColor : contested || previewed ? sideColor : 0x72818a;
      const width = selecting ? (path.hasFork ? 3 : 2) : contested || previewed ? 5 : 2;
      this.drawWirePath(path, layout, color, width, alpha);
      for (const claim of path.activePlugClaims ?? []) {
        if (claim.until > time) {
          this.drawBarberPoleWirePath(path, claim, layout, time);
        }
      }
      for (const switchBox of path.switchBoxes) {
        const pos = this.pathPoint(path, switchBox.at, layout);
        const flash = switchBox.flashUntil > this.scene.time.now;
        this.board.fillStyle(0x05080c, 1);
        this.board.fillRect(pos.x - 14, pos.y - 14, 28, 28);
        this.board.fillStyle(flash ? 0xffffff : COLORS_BY_OWNER.yellow, flash ? 0.95 : 0.88);
        this.board.fillRect(pos.x - 11, pos.y - 11, 11, 22);
        this.board.fillStyle(COLORS_BY_OWNER.purple, flash ? 0.95 : 0.88);
        this.board.fillRect(pos.x, pos.y - 11, 11, 22);
        this.board.lineStyle(2, 0xf3f0e3, 0.86);
        this.board.strokeRect(pos.x - 14, pos.y - 14, 28, 28);
      }
      for (const fixer of path.colorFixers ?? []) {
        const pos = this.pathPoint(path, fixer.at, layout);
        const fixerColor = COLORS_BY_OWNER[fixer.color];
        const flash = fixer.flashUntil > this.scene.time.now;
        this.board.fillStyle(0x05080c, 1);
        this.board.fillRect(pos.x - 15, pos.y - 11, 30, 22);
        this.board.fillStyle(fixerColor, flash ? 1 : 0.86);
        this.board.fillRect(pos.x - 10, pos.y - 6, 20, 12);
        this.board.lineStyle(2, 0xf3f0e3, flash ? 1 : 0.72);
        this.board.strokeRect(pos.x - 15, pos.y - 11, 30, 22);
      }
      for (const repeater of path.repeaters ?? []) {
        const pos = this.pathPoint(path, repeater.at, layout);
        const flash = repeater.flashUntil > this.scene.time.now;
        const dir = path.side === 'left' ? 1 : -1;
        this.board.fillStyle(0x05080c, 1);
        this.board.fillRect(pos.x - 15, pos.y - 12, 30, 24);
        this.board.fillStyle(sideColor, flash || previewed ? 1 : 0.9);
        this.board.fillTriangle(pos.x - dir * 8, pos.y - 10, pos.x - dir * 8, pos.y + 10, pos.x + dir * 11, pos.y);
        this.board.lineStyle(2, 0xf3f0e3, flash || previewed ? 1 : 0.74);
        this.board.strokeTriangle?.(pos.x - dir * 8, pos.y - 10, pos.x - dir * 8, pos.y + 10, pos.x + dir * 11, pos.y);
        this.board.strokeRect(pos.x - 15, pos.y - 12, 30, 24);
      }
      for (const arrow of path.persistentArrows) {
        const pos = this.pathPoint(path, arrow.at, layout);
        const color = path.side === 'left' ? COLORS_BY_OWNER.yellow : COLORS_BY_OWNER.purple;
        this.board.lineStyle(2, color, arrow.flashUntil > time || previewed ? 1 : 0.82);
        this.board.strokeRoundedRect(pos.x - 18, pos.y - 12, 36, 24, 4);
        this.board.fillStyle(color, arrow.flashUntil > time ? 1 : 0.82);
        const dir = path.side === 'left' ? 1 : -1;
        this.board.fillTriangle(pos.x - dir * 9, pos.y - 10, pos.x - dir * 9, pos.y + 10, pos.x + dir * 10, pos.y);
      }
      if (previewed) {
        this.highlightPathTargets(path, layout, sideColor);
      }
    }
  }

  drawWirePath(path, layout, color, width, alpha) {
    this.board.lineStyle(width + 4, 0x05080c, Math.min(0.46, alpha));
    for (const segment of this.getPathSegments(path, layout)) {
      this.board.lineBetween(segment.x1, segment.y1, segment.x2, segment.y2);
    }
    if (this.ghostPath?.id === path.id) {
      this.board.lineStyle(width + 8, color, 0.16);
      for (const segment of this.getPathSegments(path, layout)) {
        this.board.lineBetween(segment.x1, segment.y1, segment.x2, segment.y2);
      }
    }
    this.board.lineStyle(width, color, alpha);
    for (const segment of this.getPathSegments(path, layout)) {
      this.board.lineBetween(segment.x1, segment.y1, segment.x2, segment.y2);
    }
    const branch = this.getPathBranchPoint(path, layout);
    if (path.targetSlotIds.length > 1) {
      this.board.fillStyle(color, Math.min(0.9, alpha + 0.12));
      this.board.fillRect(branch.x - 5, branch.y - 5, 10, 10);
      this.board.lineStyle(2, 0x05080c, 0.88);
      this.board.strokeRect(branch.x - 5, branch.y - 5, 10, 10);
    }
    if (path.terminates || !path.targetSlotIds.length) {
      const sender = this.getSender(path.senderId);
      const senderPos = this.senderPosition(sender, layout);
      const terminalX = this.getBranchX(path, layout) - (path.side === 'left' ? layout.nestedBranchOffset : -layout.nestedBranchOffset);
      this.board.lineStyle(3, 0xf3f0e3, 0.78);
      this.board.lineBetween(terminalX + (path.side === 'left' ? 8 : -8), senderPos.y - 10, terminalX + (path.side === 'left' ? 8 : -8), senderPos.y + 10);
    }
  }

  drawBarberPoleWirePath(path, claim, layout, time) {
    const segments = this.getPathSegments(path, layout);
    const colors = [COLORS_BY_OWNER[claim.color], 0xf3f0e3];
    const pattern = 30;
    const dash = 14;
    const offset = ((time - claim.placedAt) * 0.12) % pattern;
    this.board.lineStyle(10, 0x05080c, 0.48);
    for (const segment of segments) {
      this.board.lineBetween(segment.x1, segment.y1, segment.x2, segment.y2);
    }
    for (const [index, color] of colors.entries()) {
      this.board.lineStyle(5, color, index === 0 ? 0.95 : 0.76);
      for (const segment of segments) {
        const dx = segment.x2 - segment.x1;
        const dy = segment.y2 - segment.y1;
        const length = Math.hypot(dx, dy);
        if (length <= 0) continue;
        const ux = dx / length;
        const uy = dy / length;
        for (let start = -offset + index * dash; start < length; start += pattern) {
          const from = Phaser.Math.Clamp(start, 0, length);
          const to = Phaser.Math.Clamp(start + dash, 0, length);
          if (to <= 0 || from >= length || to <= from) continue;
          this.board.lineBetween(
            segment.x1 + ux * from,
            segment.y1 + uy * from,
            segment.x1 + ux * to,
            segment.y1 + uy * to
          );
        }
      }
    }
  }

  getPathSegments(path, layout) {
    const sender = this.getSender(path.senderId);
    const senderPos = this.senderPosition(sender, layout);
    const branchX = this.getBranchX(path, layout);
    if (path.terminates || !path.targetSlotIds.length) {
      const terminalX = branchX - (path.side === 'left' ? layout.nestedBranchOffset : -layout.nestedBranchOffset);
      return [{ x1: senderPos.x, y1: senderPos.y, x2: terminalX, y2: senderPos.y }];
    }
    const segments = [{ x1: senderPos.x, y1: senderPos.y, x2: branchX, y2: senderPos.y }];
    const targetYs = path.targetSlotIds.map((slotId) => this.slotPosition(slotId, layout).y);
    const minY = Math.min(senderPos.y, ...targetYs);
    const maxY = Math.max(senderPos.y, ...targetYs);
    if (minY !== maxY) {
      segments.push({ x1: branchX, y1: minY, x2: branchX, y2: maxY });
    }
    for (const slotId of path.targetSlotIds) {
      const slotPos = this.slotPosition(slotId, layout);
      segments.push({ x1: branchX, y1: slotPos.y, x2: slotPos.x, y2: slotPos.y });
    }
    return segments;
  }

  getSelectablePathSegments(path, layout) {
    const sender = this.getSender(path.senderId);
    if (!sender) return [];
    const senderPos = this.senderPosition(sender, layout);
    const branchX = this.getBranchX(path, layout);
    if (path.terminates || !path.targetSlotIds.length) {
      const terminalX = branchX - (path.side === 'left' ? layout.nestedBranchOffset : -layout.nestedBranchOffset);
      return [{ x1: senderPos.x, y1: senderPos.y, x2: terminalX, y2: senderPos.y }];
    }
    return [{ x1: senderPos.x, y1: senderPos.y, x2: branchX, y2: senderPos.y }];
  }

  getPathBranchPoint(path, layout) {
    const sender = this.getSender(path.senderId);
    const senderPos = this.senderPosition(sender, layout);
    return { x: this.getBranchX(path, layout), y: senderPos.y };
  }

  getNestedBranchPoint(path, layout) {
    const branch = this.getPathBranchPoint(path, layout);
    const targetIds = path.targetSlotIds.slice(1);
    const targetYs = targetIds.map((slotId) => this.slotPosition(slotId, layout).y);
    return {
      x: branch.x + (path.side === 'left' ? layout.nestedBranchOffset : -layout.nestedBranchOffset),
      y: targetYs[Math.floor(targetYs.length / 2)] ?? branch.y
    };
  }

  distanceToPath(path, layout, x, y) {
    return Math.min(...this.getPathSegments(path, layout).map((segment) => this.distanceToSegment(x, y, segment.x1, segment.y1, segment.x2, segment.y2)));
  }

  distanceToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (dx === 0 && dy === 0) {
      return Phaser.Math.Distance.Between(px, py, x1, y1);
    }
    const t = Phaser.Math.Clamp(((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy), 0, 1);
    return Phaser.Math.Distance.Between(px, py, x1 + dx * t, y1 + dy * t);
  }

  highlightPathTargets(path, layout, color) {
    for (const slotId of path.targetSlotIds) {
      const slot = this.slotPosition(slotId, layout);
      this.board.lineStyle(3, color, 0.95);
      this.board.strokeRect(slot.x - 24, slot.y - 17, 48, 34);
    }
  }

  drawCenterSpine(layout, time) {
    const yellowCount = this.countSlots('yellow');
    const purpleCount = this.countSlots('purple');
    const leader = yellowCount === purpleCount ? null : yellowCount > purpleCount ? 'yellow' : 'purple';
    this.board.fillStyle(leader ? COLORS_BY_OWNER[leader] : 0x000000, 1);
    this.board.fillRect(layout.centerX - 24, layout.startY - 52, 48, 22);
    this.board.lineStyle(1, 0xffffff, 0.65);
    this.board.strokeRect(layout.centerX - 24, layout.startY - 52, 48, 22);
    this.board.lineStyle(4, 0x0c1018, 0.98);
    this.board.lineBetween(layout.centerX - 25, layout.startY - 26, layout.centerX - 25, layout.startY + (this.challenge.centerSlots.length - 1) * layout.slotSpacing + 26);
    this.board.lineBetween(layout.centerX + 25, layout.startY - 26, layout.centerX + 25, layout.startY + (this.challenge.centerSlots.length - 1) * layout.slotSpacing + 26);
    this.board.lineStyle(4, 0x566071, 0.95);
    this.board.lineBetween(layout.centerX, layout.startY - 26, layout.centerX, layout.startY + (this.challenge.centerSlots.length - 1) * layout.slotSpacing + 26);
    for (const slot of this.challenge.centerSlots) {
      const pos = this.slotPosition(slot.index, layout);
      const visual = this.getCenterSlotVisual(slot, time);
      const color = visual.color;
      const flash = slot.lastChangedTime && this.scene.time.now - slot.lastChangedTime < 220;
      this.board.fillStyle(0x030508, 1);
      this.board.fillRect(pos.x - 22, pos.y - 14, 44, 28);
      this.board.fillStyle(color, visual.pending ? 0.88 : flash ? 0.98 : 0.78);
      this.board.fillRect(pos.x - 17, pos.y - 10, 34, 20);
      if (visual.pending) {
        this.drawPendingCenterCell(pos.x, pos.y, visual, time);
      }
      this.board.lineStyle(slot.lockedUntilEnd ? 3 : 1, slot.blockedUntil > time ? 0xffffff : color, 0.95);
      this.board.strokeRect(pos.x - 22, pos.y - 14, 44, 28);
      if (slot.lockedUntilEnd) {
        this.board.lineBetween(pos.x - 22, pos.y - 16, pos.x - 12, pos.y - 16);
        this.board.lineBetween(pos.x + 12, pos.y + 16, pos.x + 22, pos.y + 16);
      }
    }
  }

  getCenterSlotVisual(slot, time) {
    const activePending = (slot.pendingPlugClaims ?? [])
      .filter((claim) => !claim.appliedAt && claim.until > time)
      .sort((a, b) => a.placedAt - b.placedAt);
    if (!activePending.length) {
      return {
        pending: false,
        color: COLORS_BY_OWNER[slot.owner] ?? 0x000000,
        owner: slot.owner
      };
    }

    const pendingColors = new Set(activePending.map((claim) => claim.resolvedColor));
    const latest = activePending[activePending.length - 1];
    return {
      pending: true,
      contested: pendingColors.size > 1,
      owner: latest.resolvedColor,
      color: pendingColors.size > 1 ? 0xb9bec6 : 0xd7e0df,
      edgeColor: pendingColors.size > 1 ? 0xf3f0e3 : COLORS_BY_OWNER[latest.resolvedColor],
      progress: Phaser.Math.Clamp((time - latest.placedAt) / Math.max(1, latest.until - latest.placedAt), 0, 1)
    };
  }

  drawPendingCenterCell(x, y, visual, time) {
    const sweep = ((time * 0.08) % 12);
    this.board.lineStyle(2, 0x030508, 0.42);
    for (let stripeX = x - 28 + sweep; stripeX < x + 28; stripeX += 12) {
      this.board.lineBetween(stripeX, y - 10, stripeX + 10, y + 10);
    }
    this.board.lineStyle(2, visual.edgeColor ?? 0xf3f0e3, visual.contested ? 0.58 : 0.7);
    this.board.strokeRect(x - 18, y - 11, 36, 22);
    this.board.fillStyle(0xffffff, 0.52);
    this.board.fillRect(x - 15, y + 7, 30 * visual.progress, 3);
  }

  drawSenders(layout) {
    for (const sender of this.getAllSenders()) {
      const pos = this.senderPosition(sender, layout);
      const sideColor = sender.side === 'left' ? COLORS_BY_OWNER.yellow : COLORS_BY_OWNER.purple;
      const plugs = this.challenge.plugsRemaining?.[sender.side] ?? 0;
      const isGhost = this.ghostPath?.senderId === sender.id;
      const activeSide = this.state === 'running' && sender.side === this.challenge.playerSide && plugs > 0;
      const laneOwner = this.challenge.centerSlots[sender.laneIndex]?.owner;
      const ownerColor = COLORS_BY_OWNER[laneOwner] ?? sideColor;
      this.board.fillStyle(ownerColor, isGhost ? 1 : activeSide ? 0.86 : 0.58);
      const dir = sender.side === 'left' ? 1 : -1;
      this.board.fillTriangle(pos.x - dir * 16, pos.y - 12, pos.x - dir * 16, pos.y + 12, pos.x + dir * 18, pos.y);
      this.board.lineStyle(isGhost ? 3 : 2, 0xf3f0e3, isGhost ? 1 : activeSide ? 0.78 : 0.42);
      this.board.lineBetween(pos.x - dir * 16, pos.y - 12, pos.x - dir * 16, pos.y + 12);
      this.board.lineBetween(pos.x - dir * 16, pos.y + 12, pos.x + dir * 18, pos.y);
      this.board.lineBetween(pos.x + dir * 18, pos.y, pos.x - dir * 16, pos.y - 12);
    }
  }

  drawDottedPort(x, y, radius, color, alpha) {
    this.board.fillStyle(color, alpha);
    const dots = 12;
    for (let i = 0; i < dots; i += 1) {
      const angle = (i / dots) * Math.PI * 2;
      this.board.fillCircle(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, 2.2);
    }
  }

  drawGhostCaptureNode(layout) {
    if (!this.ghostPath || this.state !== 'running' || this.challenge.plugsRemaining[this.challenge.playerSide] <= 0) {
      return;
    }
    const sender = this.getSender(this.ghostPath.senderId);
    const pos = this.senderPosition(sender, layout);
    const color = COLORS_BY_OWNER[this.challenge.playerColor];
    const dir = this.ghostPath.side === 'left' ? 1 : -1;
    this.fx.fillStyle(color, 0.38);
    this.fx.fillTriangle(pos.x - dir * 12, pos.y - 14, pos.x - dir * 12, pos.y + 14, pos.x + dir * 14, pos.y);
    this.fx.lineStyle(2, color, 0.9);
    this.fx.strokeCircle(pos.x, pos.y, 18);
  }

  drawPulses(layout) {
    for (const pulse of this.pulses) {
      const path = this.challenge.paths.find((item) => item.id === pulse.pathId);
      const pos = this.pathPoint(path, pulse.progress, layout);
      const color = COLORS_BY_OWNER[pulse.displayColor];
      this.board.fillStyle(color, 0.95);
      this.board.fillRect(pos.x - 8, pos.y - 5, 16, 10);
      this.board.lineStyle(1, 0xffffff, pulse.isPersistent ? 0.9 : 0.35);
      this.board.strokeRect(pos.x - 10, pos.y - 7, 20, 14);
    }
  }

  drawPlacedCaptureNodes(layout, time) {
    const stackIndexes = new Map();
    for (const node of this.captureNodes) {
      const path = this.challenge.paths.find((item) => item.id === node.pathId);
      if (!path) continue;
      const sender = this.getSender(path.senderId);
      const pos = this.senderPosition(sender, layout);
      const color = COLORS_BY_OWNER[node.color];
      const dir = path.side === 'left' ? 1 : -1;
      const stackKey = `${path.side}:${sender.laneIndex}`;
      const stackIndex = stackIndexes.get(stackKey) ?? 0;
      stackIndexes.set(stackKey, stackIndex + 1);
      const stackY = pos.y + (stackIndex - 1) * 8;
      const active = node.until > time;
      const progress = Phaser.Math.Clamp((time - node.placedAt) / PLUG_CLAIM_MS, 0, 1);
      const bodyAlpha = active ? 0.95 : 0.42;
      const baseX = pos.x;
      this.board.fillStyle(0x05080c, active ? 0.9 : 0.58);
      this.board.fillTriangle(baseX - dir * 15, stackY - 13, baseX - dir * 15, stackY + 13, baseX + dir * 17, stackY);
      this.board.fillStyle(color, bodyAlpha);
      this.board.fillTriangle(baseX - dir * 11, stackY - 9, baseX - dir * 11, stackY + 9, baseX + dir * 12, stackY);
      this.board.lineStyle(active ? 2 : 1, active ? 0xffffff : color, active ? 0.72 : 0.42);
      this.board.lineBetween(baseX - dir * 15, stackY - 13, baseX - dir * 15, stackY + 13);
      this.board.lineBetween(baseX - dir * 15, stackY + 13, baseX + dir * 17, stackY);
      this.board.lineBetween(baseX + dir * 17, stackY, baseX - dir * 15, stackY - 13);
      this.board.fillStyle(0xf3f0e3, active ? 0.82 : 0.28);
      if (path.side === 'left') {
        this.board.fillRect(baseX - 14, stackY + 16, 28 * (1 - progress), 3);
      } else {
        this.board.fillRect(baseX + 14 - 28 * (1 - progress), stackY + 16, 28 * (1 - progress), 3);
      }
    }
  }

  getBodyClassLabel(body) {
    const id = body.displayId ?? '000';
    const rank = body.rank ?? Number.parseInt(id, 10) ?? 0;
    if (id === '001') return 'PLASMODYNE';
    if (rank < 100) return '0-SERIES EXPERIMENTAL';
    return `${Math.floor(rank / 100)}-SERIES ${body.chassisClass ?? body.name ?? 'DROID'}`.toUpperCase();
  }

  getBodyDescription(body) {
    const id = body.displayId ?? '000';
    const chassis = String(body.chassisClass ?? body.name ?? 'Droid').toLowerCase();
    if (id === '001') {
      return 'Influence device. Built for transfer control, host acquisition, and fleet reclamation.';
    }
    if (chassis.includes('repair')) {
      return 'Service repair platform. Maintains damaged systems and can preserve captured chassis integrity.';
    }
    if (chassis.includes('service')) {
      return 'Ship service unit. Routes through utility spaces and supports local machine systems.';
    }
    if (chassis.includes('worker')) {
      return 'Industrial worker frame. Armored for ship labor and fitted with basic defensive emitters.';
    }
    if (chassis.includes('courier')) {
      return 'Fast relay frame. Built for rapid transit, signal delivery, and evasive movement.';
    }
    if (chassis.includes('security') || chassis.includes('patrol')) {
      return 'Security platform. Patrols protected ship sectors and engages intruders on contact.';
    }
    if (chassis.includes('assault')) {
      return 'Combat platform. Designed for direct engagement with heavy integrated weapons.';
    }
    if (chassis.includes('industrial')) {
      return 'Heavy machinery chassis. Slow, durable, and dangerous in close ship interiors.';
    }
    if (chassis.includes('hunter')) {
      return 'Pursuit unit. Tracks moving targets aggressively across local deck networks.';
    }
    if (chassis.includes('elite') || chassis.includes('dominion') || chassis.includes('core')) {
      return 'High-threat autonomous node. Advanced weapons, stronger control resistance, and command behavior.';
    }
    return 'Autonomous ship droid. Capture profile varies by integrity, class, and control resistance.';
  }

  getAllSenders() {
    return [...this.challenge.sendersLeft, ...this.challenge.sendersRight];
  }

  getSideSenders(side) {
    return side === 'left' ? this.challenge.sendersLeft : this.challenge.sendersRight;
  }

  getSidePaths(side) {
    return this.challenge.paths.filter((path) => path.side === side);
  }

  getSender(id) {
    return this.getAllSenders().find((sender) => sender.id === id);
  }

  senderPosition(sender, layout) {
    return {
      x: sender.side === 'left' ? layout.leftX - layout.senderOffset : layout.rightX + layout.senderOffset,
      y: layout.startY + sender.laneIndex * layout.slotSpacing
    };
  }

  slotPosition(index, layout) {
    return {
      x: layout.centerX,
      y: layout.startY + index * layout.slotSpacing
    };
  }

  pathPoint(path, progress, layout) {
    const sender = this.getSender(path.senderId);
    const start = this.senderPosition(sender, layout);
    const targetIndex = path.targetSlotIds[Math.floor(path.targetSlotIds.length / 2)];
    const target = targetIndex === undefined
      ? { x: path.side === 'left' ? -layout.branchOffset * 0.72 : layout.branchOffset * 0.72, y: start.y }
      : this.slotPosition(targetIndex, layout);
    const midX = this.getBranchX(path, layout);
    if (progress < 0.42) {
      return { x: Phaser.Math.Linear(start.x, midX, progress / 0.42), y: start.y };
    }
    if (progress < 0.68) {
      return { x: midX, y: Phaser.Math.Linear(start.y, target.y, (progress - 0.42) / 0.26) };
    }
    return { x: Phaser.Math.Linear(midX, target.x, (progress - 0.68) / 0.32), y: target.y };
  }

  getBranchX(path, layout = null) {
    const branchOffset = layout?.branchOffset ?? 126;
    return path.side === 'left' ? -branchOffset : branchOffset;
  }

  getLayout() {
    const slotCount = this.challenge?.centerSlots.length ?? 11;
    const { width: frameWidth, height: frameHeight } = this.getOverlayFrameSize();
    const boardWidth = Math.max(1, frameWidth - BOARD_SIDE_PADDING * 2);
    const boardHeight = Math.max(1, frameHeight - BOARD_TOP_PADDING - BOARD_BOTTOM_PADDING);
    const boardY = -frameHeight / 2 + BOARD_TOP_PADDING;
    const availableLaneHeight = Math.max(80, boardHeight - 120);
    const slotSpacing = Math.min(42, availableLaneHeight / Math.max(1, slotCount - 1));
    const laneHeight = (slotCount - 1) * slotSpacing;
    const startY = boardY + 84 + Math.max(0, (availableLaneHeight - laneHeight) / 2);
    const sideInset = Math.min(boardWidth * 0.48, Phaser.Math.Clamp(boardWidth * 0.09, 54, 76));
    const senderOffset = Math.min(Math.max(1, sideInset - 8), Phaser.Math.Clamp(boardWidth * 0.04, 24, 38));
    return {
      bounds: {
        x: -boardWidth / 2,
        y: boardY,
        width: boardWidth,
        height: boardHeight
      },
      leftX: -boardWidth / 2 + sideInset,
      rightX: boardWidth / 2 - sideInset,
      centerX: 0,
      startY,
      slotSpacing,
      senderOffset,
      branchOffset: Phaser.Math.Clamp(boardWidth * 0.22, 110, 190),
      nestedBranchOffset: Phaser.Math.Clamp(boardWidth * 0.062, 34, 54)
    };
  }

  getSelectionLayout() {
    const layout = this.getLayout();
    const edgeInset = Phaser.Math.Clamp(layout.bounds.width * 0.095, 72, 118);
    const panelWidth = Math.max(132, Math.min(178, layout.bounds.width * 0.16));
    const leftPanelX = layout.bounds.x + edgeInset;
    const rightPanelX = layout.bounds.x + layout.bounds.width - edgeInset - panelWidth;
    const leftRailX = leftPanelX + panelWidth / 2;
    const rightRailX = rightPanelX + panelWidth / 2;
    return {
      ...layout,
      leftX: leftRailX,
      rightX: rightRailX,
      senderOffset: 0,
      branchOffset: Phaser.Math.Clamp(layout.bounds.width * 0.18, 94, 150),
      nestedBranchOffset: Phaser.Math.Clamp(layout.bounds.width * 0.048, 30, 48),
      choicePanelWidth: panelWidth,
      choiceLeftX: leftPanelX,
      choiceRightX: rightPanelX
    };
  }

  getOverlayFrameSize() {
    const { width, height } = this.scene.scale;
    return {
      width: Math.max(1, Math.min(MAX_FRAME_WIDTH, width - FRAME_MARGIN * 2)),
      height: Math.max(1, Math.min(MAX_FRAME_HEIGHT, height - FRAME_MARGIN * 2))
    };
  }

  getSideTopologySummary(side) {
    const paths = this.getSidePaths(side);
    const forkCount = paths.filter((path) => path.hasFork).length;
    const switchCount = paths.reduce((sum, path) => sum + path.switchBoxes.length, 0);
    const repeaterCount = paths.reduce((sum, path) => sum + path.repeaters.length, 0);
    const fixerCount = paths.reduce((sum, path) => sum + (path.colorFixers?.length ?? 0), 0);
    const persistentCount = paths.reduce((sum, path) => sum + path.persistentArrows.length, 0);
    const deadEndCount = paths.filter((path) => path.terminates || !path.targetSlotIds.length).length;
    return [
      `FORKS ${forkCount}  REPEAT ${repeaterCount}`,
      `SWITCH ${switchCount}  FIX ${fixerCount}`,
      `HOLD ${persistentCount}  DEAD ${deadEndCount}`
    ].join('\n');
  }

  resolve(success) {
    if (!this.visible || this.resolved) {
      return;
    }
    this.resolved = true;
    this.hide();
    this.scene.transferSystem.complete(success);
  }

  hide() {
    this.visible = false;
    this.state = 'hidden';
    this.container.setVisible(false);
    for (const hotspot of this.senderHotspots) {
      hotspot.destroy();
    }
    this.senderHotspots = [];
    for (const hotspot of this.sideHotspots) {
      hotspot.destroy();
    }
    this.sideHotspots = [];
    this.board.clear();
    this.fx.clear();
    this.challenge = null;
    this.pulses = [];
    this.captureNodes = [];
    this.ignoreInitialPointerUp = false;
  }

  isVisible() {
    return this.visible;
  }

  handleResize() {
    const { width, height } = this.scene.scale;
    const { width: frameWidth, height: frameHeight } = this.getOverlayFrameSize();
    this.container.setPosition(width / 2, height / 2);
    this.panel.setSize(width, height);

    this.frame.width = frameWidth;
    this.frame.height = frameHeight;
    this.frame.panel.setSize(frameWidth, frameHeight);
    this.frame.header.setPosition(0, -frameHeight / 2 + 32);
    this.frame.header.setSize(frameWidth - 18, 42);
    this.frame.leftText.setPosition(-frameWidth / 2 + 24, -frameHeight / 2 + 22);
    this.frame.brand.setPosition(0, -frameHeight / 2 + 18);
    this.frame.brandLogo?.setPosition(0, -frameHeight / 2 + 33);
    this.frame.fitBrandLogo?.(54, 34);
    this.frame.rightText.setPosition(frameWidth / 2 - 24, -frameHeight / 2 + 22);

    this.title.setPosition(0, -frameHeight / 2 + 64);
    this.subtitle.setPosition(0, -frameHeight / 2 + 92);
    this.timerText.setPosition(0, -frameHeight / 2 + 116);
    this.leftStatus.setPosition(-frameWidth / 2 + 30, frameHeight / 2 - 56);
    this.rightStatus.setPosition(frameWidth / 2 - 320, frameHeight / 2 - 56);
    this.footer.setPosition(0, frameHeight / 2 - 34);
    this.footer.setWordWrapWidth(Math.max(1, frameWidth - 72));
    this.subtitle.setWordWrapWidth(Math.max(1, frameWidth - 72));
  }
}
