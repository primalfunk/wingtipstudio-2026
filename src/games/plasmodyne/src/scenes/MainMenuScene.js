import Phaser from 'phaser';
import { MainMenuAttractLayer } from '../ui/menu/MainMenuAttractLayer.js';
import { MenuTitleLogo } from '../ui/menu/MenuTitleLogo.js';
import { uiTextStyle } from '../ui/theme/Typography.js';
import { GameAudio } from '../systems/GameAudio.js';
import { DIFFICULTY_LEVELS } from '../data/constants.js';
import { DROID_MODEL_TINTS, DROID_TEMPLATES, getDroidModelTint, getDroidModelVariantIndex } from '../data/droidTemplates.js';
import { getDroidAnimationKey, getDroidVisualKeys } from '../graphics/droidAnimationAssets.js';
import { DroidNumerals } from '../ui/fonts/DroidNumerals.js';
import { drawDroidSignalSlotEffect } from '../ui/effects/DroidSignalSlotEffect.js';
import { LOGO_KEYS } from '../ui/LogoAssets.js';

const MENU_OPTIONS = ['START GAME', 'OPTIONS', 'DROID INDEX', 'BRIEFING', 'CREDITS', 'EXIT'];
const DIFFICULTY_OPTIONS = ['easy', 'normal', 'hard'];
const SOFTWARE_VERSION = '0.5';
const MENU_FONT_FAMILY = '"Arbedo", "Grisha", "MoonRunner", "VakultaTrial", sans-serif';
const CATALOG_FONT_FAMILY = '"Orbitron", "Consolas", monospace';
const OPTIONS_STORAGE_KEY = 'plasmodyne-menu-options';
const DEFAULT_OPTIONS = {
  fixedSeed: false,
  seed: 'plasmodyne-ship-001',
  difficulty: 'normal',
  masterVolume: 1,
  muted: false
};

const BRIEFING_PAGES = [
  {
    title: 'MISSION',
    icon: 'droid',
    text: "You are piloting PLASMODYNE. Clear the ship of rogue droids by destroying them or transferring control to them."
  },
  {
    title: 'MOVE',
    icon: 'move',
    text: 'Hold right mouse to move toward the pointer, or use WASD / arrow keys for direct thrust through rooms, doors, and passages.'
  },
  {
    title: 'AIM / FIRE',
    icon: 'fire',
    text: 'Aim with the mouse. Tap left click to fire, or tap Space to fire in your current facing direction when your body has an active weapon.'
  },
  {
    title: 'TRANSFER',
    icon: 'transfer',
    text: 'Hold left click to enter Interact Mode. Collide with an enemy droid to start a transfer contest. F can also activate nearby interactable systems.'
  },
  {
    title: 'SHIP SYSTEMS',
    icon: 'ship',
    text: 'Touch lift pads and console panels while in Interact Mode to route through the ship and reveal local systems. In lift menus use W/S, arrows, Enter, Space, number keys, or click.'
  },
  {
    title: 'REPAIR',
    icon: 'repair',
    text: 'Move onto a repair pad to restore the body you are piloting. Use repairs before engaging stronger rogue droids.'
  }
];

const CREDITS_PAGE = {
  title: 'CREDITS',
  icon: 'ship',
  text: "This project is a wholehearted homage to Andrew Braybrook's Paradroid from 1985, which remains a superior game to this one."
};

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
    this.starting = false;
    this.selectedOption = 0;
  }

  preload() {}

  create() {
    window.requestAnimationFrame(() => window.parent?.postMessage({ type: 'wingtip:game-ready' }, window.location.origin));
    this.starting = false;
    this.cameras.main.setBackgroundColor('#05080c');
    this.menuOptions = this.loadMenuOptions();
    this.optionsOpen = false;
    this.briefingOpen = false;
    this.droidIndexOpen = false;
    this.droidIndexSelection = 0;
    this.creditsOpen = false;
    this.briefingPageIndex = 0;
    this.seedInputActive = false;
    this.draggingVolume = false;
    this.applyMasterVolume();
    this.audio = new GameAudio(this);
    this.audio.playMenuMusic();

    const { width, height } = this.scale;
    this.backgroundFill = this.add.rectangle(width / 2, height / 2, width, height, 0x010405, 1);
    this.backgroundFill.setDepth(-20);
    this.gridFx = this.add.graphics();
    this.gridFx.setDepth(-15);
    this.frameFx = this.add.graphics();
    this.frameFx.setDepth(2);
    this.decorFx = this.add.graphics();
    this.decorFx.setDepth(3);

    this.attractLayer = new MainMenuAttractLayer(this);
    this.titleLogo = new MenuTitleLogo(this);
    this.createDroidShowcase();
    this.createOptionMenu();
    this.createOptionsPanel();
    this.createDroidIndexPanel();
    this.createBriefingPanel();
    this.createSystemLabels();

    this.systemLine = this.add.container(width / 2, height - 58);
    this.systemLine.setDepth(20);
    this.systemLine.setAlpha(0);
    this.systemLineParts = [
      this.add.text(0, 0, 'A RETRO-FUTURISTIC DROID INFILTRATION GAME', uiTextStyle({
        fontSize: '12px',
        color: '#607b83'
      })).setOrigin(0, 0.5)
    ];
    this.systemLineParts.forEach((part) => {
      part.setShadow(0, 0, '#5fdde8', 4, true, true);
    });
    this.systemLine.add(this.systemLineParts);
    this.layoutSystemLine();

    this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.upKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.downKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.leftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.rightKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.wKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.sKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.input.keyboard.on('keydown', this.handleOptionsKeyDown, this);
    this.scale.on('resize', this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.handleResize({ width, height });
    this.playBoot();
  }

  playBoot() {
    this.attractLayer.boot();
    this.titleLogo.boot();
    this.optionContainer.setAlpha(0);
    this.tweens.add({
      targets: this.optionContainer,
      alpha: 1,
      delay: 1350,
      duration: 500
    });
    this.tweens.add({
      targets: this.systemLine,
      alpha: 0.78,
      delay: 1750,
      duration: 520
    });
  }

  update(time) {
    this.attractLayer?.update(time);
    this.titleLogo?.update(time);
    this.updateDroidShowcase(time);
    this.drawMenuGlints(time);

    if (this.droidIndexOpen) {
      this.updateDroidIndexPreview(time);
      if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
        this.closeDroidIndexPanel();
      } else if (Phaser.Input.Keyboard.JustDown(this.leftKey) || Phaser.Input.Keyboard.JustDown(this.upKey) || Phaser.Input.Keyboard.JustDown(this.wKey)) {
        this.selectDroidIndexTemplate(this.droidIndexSelection - 1);
      } else if (
        Phaser.Input.Keyboard.JustDown(this.rightKey)
        || Phaser.Input.Keyboard.JustDown(this.downKey)
        || Phaser.Input.Keyboard.JustDown(this.sKey)
      ) {
        this.selectDroidIndexTemplate(this.droidIndexSelection + 1);
      }
      return;
    }

    if (this.briefingOpen) {
      if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
        this.closeBriefingPanel();
      } else if (!this.creditsOpen && (Phaser.Input.Keyboard.JustDown(this.leftKey) || Phaser.Input.Keyboard.JustDown(this.upKey) || Phaser.Input.Keyboard.JustDown(this.wKey))) {
        this.showBriefingPage(this.briefingPageIndex - 1);
      } else if (!this.creditsOpen && (
        Phaser.Input.Keyboard.JustDown(this.rightKey)
        || Phaser.Input.Keyboard.JustDown(this.downKey)
        || Phaser.Input.Keyboard.JustDown(this.sKey)
        || Phaser.Input.Keyboard.JustDown(this.enterKey)
        || Phaser.Input.Keyboard.JustDown(this.spaceKey)
      )) {
        this.showBriefingPage(this.briefingPageIndex + 1);
      }
      return;
    }

    if (this.optionsOpen) {
      this.refreshOptionsPanel();
      if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
        this.closeOptionsPanel();
      }
      return;
    }

    if (!this.starting && (Phaser.Input.Keyboard.JustDown(this.enterKey) || Phaser.Input.Keyboard.JustDown(this.spaceKey))) {
      this.activateSelectedOption();
    }
    if (Phaser.Input.Keyboard.JustDown(this.upKey) || Phaser.Input.Keyboard.JustDown(this.wKey)) {
      this.selectOption(this.selectedOption - 1);
    }
    if (Phaser.Input.Keyboard.JustDown(this.downKey) || Phaser.Input.Keyboard.JustDown(this.sKey)) {
      this.selectOption(this.selectedOption + 1);
    }
  }

  startGame() {
    if (this.starting) {
      return;
    }
    this.starting = true;
    this.audio.playStartGame();
    this.titleLogo.startLock();
    this.attractLayer.startConfirm(() => {
      this.cameras.main.fadeOut(260, 5, 8, 12);
      this.time.delayedCall(280, () => this.scene.start('GameScene', {
        seed: this.getStartSeed(),
        difficulty: this.getDifficultyKey(),
        showNewGameFocus: true
      }));
    });
  }

  getStartSeed() {
    if (this.menuOptions.fixedSeed && this.menuOptions.seed.trim()) {
      return this.menuOptions.seed.trim();
    }
    return `plasmodyne-${Date.now()}-${Phaser.Math.Between(100000, 999999)}`;
  }

  loadMenuOptions() {
    try {
      const raw = window.localStorage?.getItem(OPTIONS_STORAGE_KEY);
      const options = { ...DEFAULT_OPTIONS, ...(raw ? JSON.parse(raw) : {}) };
      return { ...options, difficulty: DIFFICULTY_LEVELS[options.difficulty] ? options.difficulty : DEFAULT_OPTIONS.difficulty };
    } catch {
      return { ...DEFAULT_OPTIONS };
    }
  }

  getDifficultyKey() {
    return DIFFICULTY_LEVELS[this.menuOptions?.difficulty] ? this.menuOptions.difficulty : DEFAULT_OPTIONS.difficulty;
  }

  saveMenuOptions() {
    try {
      window.localStorage?.setItem(OPTIONS_STORAGE_KEY, JSON.stringify(this.menuOptions));
    } catch {
      // Local storage is optional; fresh defaults still work.
    }
  }

  handleResize(gameSize) {
    const { width, height } = gameSize;
    this.backgroundFill?.setPosition(width / 2, height / 2);
    this.backgroundFill?.setSize(width, height);
    this.drawFrame();
    this.drawGrid();
    this.titleLogo?.setPosition(width / 2, height * 0.48);
    this.positionDroidShowcase();
    this.positionOptionMenu();
    this.positionOptionsPanel();
    this.positionDroidIndexPanel();
    this.positionBriefingPanel();
    this.positionSystemLabels();
    this.systemLine?.setPosition(width / 2, height - 58);
    this.layoutSystemLine();
    this.attractLayer?.reflow();
  }

  drawFrame() {
    const { width, height } = this.scale;
    const margin = 22;
    const corner = 72;
    this.frameFx.clear();
    this.frameFx.lineStyle(2, 0x58e7f4, 0.42);
    this.frameFx.lineBetween(margin, margin, margin + corner, margin);
    this.frameFx.lineBetween(margin, margin, margin, margin + corner);
    this.frameFx.lineBetween(width - margin, margin, width - margin - corner, margin);
    this.frameFx.lineBetween(width - margin, margin, width - margin, margin + corner);
    this.frameFx.lineBetween(margin, height - margin, margin + corner, height - margin);
    this.frameFx.lineBetween(margin, height - margin, margin, height - margin - corner);
    this.frameFx.lineBetween(width - margin, height - margin, width - margin - corner, height - margin);
    this.frameFx.lineBetween(width - margin, height - margin, width - margin, height - margin - corner);

    this.frameFx.lineStyle(1, 0x58e7f4, 0.2);
    this.frameFx.lineBetween(width * 0.23, height - 42, width * 0.43, height - 42);
    this.frameFx.lineBetween(width * 0.57, height - 42, width * 0.77, height - 42);
    this.frameFx.strokeCircle(width / 2, height - 44, 15);

    for (const [x, y] of [[64, 72], [width - 64, 72], [64, height - 72], [width - 64, height - 72]]) {
      this.frameFx.lineStyle(1, 0x58e7f4, 0.3);
      this.frameFx.lineBetween(x - 12, y, x + 12, y);
      this.frameFx.lineBetween(x, y - 12, x, y + 12);
    }
  }

  drawGrid() {
    const { width, height } = this.scale;
    this.gridFx.clear();
    this.gridFx.fillStyle(0x010405, 1);
    this.gridFx.fillRect(0, 0, width, height);
    this.gridFx.lineStyle(1, 0x1a626c, 0.08);
    for (let x = 0; x <= width; x += 72) {
      this.gridFx.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y <= height; y += 54) {
      this.gridFx.lineBetween(0, y, width, y);
    }
    this.gridFx.lineStyle(1, 0x58e7f4, 0.06);
    for (let y = 0; y < height; y += 6) {
      this.gridFx.lineBetween(0, y, width, y);
    }
  }

  createDroidShowcase() {
    this.droidContainer = this.add.container(0, 0);
    this.droidContainer.setDepth(15);
    this.droidGlow = this.add.graphics();
    this.droidSprite = this.add.sprite(0, 0, 'droid-series-0-sheet', 0);
    this.droidSprite.play(getDroidAnimationKey(0));
    this.droidActivity = this.add.graphics();
    this.droidNumber = new DroidNumerals(this, 0, 0, '001', {
      size: 54,
      color: 0x9aa6aa,
      shadowColor: 0x333d43,
      depth: 16,
      fitWidth: 138,
      fitHeight: 82
    });
    this.droidContainer.add([this.droidGlow, this.droidSprite, this.droidActivity, this.droidNumber.container]);
  }

  positionDroidShowcase() {
    const { width, height } = this.scale;
    const x = width * 0.81;
    const y = height * 0.245;
    const size = Math.min(210, Math.max(145, width * 0.145));
    this.droidContainer?.setPosition(x, y);
    this.droidSprite?.setDisplaySize(size, size);
    this.droidNumber?.setPosition(0, -2);
  }

  updateDroidShowcase(time) {
    if (!this.droidGlow) {
      return;
    }
    const pulse = 0.5 + Math.sin(time * 0.0022) * 0.5;
    this.droidGlow.clear();
    this.drawDroidSignalActivity(this.droidActivity, time, pulse, 0, 0, 96, 36, 'vertical');
    this.droidNumber?.setAlpha(0.82 + pulse * 0.18);
    this.updateBriefingDroidActivity(time);
  }

  drawDroidSignalActivity(graphics, time, pulse = 0.5, x = 0, y = 0, width = 96, height = 36, orientation = 'vertical') {
    if (!graphics) {
      return;
    }
    drawDroidSignalSlotEffect(graphics, time, {
      x,
      y,
      width,
      height,
      pulse,
      orientation
    });
  }

  updateBriefingDroidActivity(time) {
    if (!this.briefingDroidActivity) {
      return;
    }
    if (!this.briefingPanel?.visible || !this.briefingDroidSprite?.visible) {
      this.briefingDroidActivity.clear();
      return;
    }
    const pulse = 0.5 + Math.sin(time * 0.0021) * 0.5;
    const position = this.briefingDroidSprite;
    this.drawDroidSignalActivity(this.briefingDroidActivity, time, pulse, position.x, position.y - 2, 96, 36);
  }

  createOptionMenu() {
    this.optionContainer = this.add.container(0, 0);
    this.optionContainer.setDepth(25);
    this.optionGlint = this.add.graphics();
    this.optionGlint.setBlendMode(Phaser.BlendModes.ADD);
    this.optionsPanelBounds = { x: -280, y: -184, width: 560, height: 368 };
    this.optionTexts = MENU_OPTIONS.map((label, index) => {
      const text = this.add.text(0, index * 32, label, uiTextStyle({
        fontFamily: '"Arbedo", "Grisha", "MoonRunner", "VakultaTrial", sans-serif',
        fontSize: '18px',
        color: '#5f8b94',
        fontStyle: '900'
      })).setOrigin(0, 0.5);
      text.setInteractive({ useHandCursor: true });
      text.on('pointerover', () => this.selectOption(index));
      text.on('pointerdown', () => this.activateOption(index));
      return text;
    });
    this.optionContainer.add([this.optionGlint, ...this.optionTexts]);
    this.selectOption(0);
  }

  createOptionsPanel() {
    this.optionsPanel = this.add.container(0, 0);
    this.optionsPanel.setDepth(60);
    this.optionsPanel.setVisible(false);

    this.optionsPanelBg = this.add.graphics();
    this.optionsWatermark = this.add.image(0, 0, LOGO_KEYS.grey)
      .setDisplaySize(140, 178)
      .setAlpha(0.08);
    this.optionsTitle = this.add.text(0, -158, 'OPTIONS', uiTextStyle({
      fontFamily: '"Arbedo", "Grisha", "MoonRunner", "VakultaTrial", sans-serif',
      fontSize: '24px',
      color: '#d9f4ff',
      fontStyle: '900'
    })).setOrigin(0.5);
    this.optionsTitle.setShadow(0, 0, '#78f0ff', 10, true, true);

    this.fixedSeedBox = this.add.rectangle(-190, -104, 22, 22, 0x031019, 0.86)
      .setStrokeStyle(2, 0x78f0ff, 0.75)
      .setInteractive({ useHandCursor: true });
    this.fixedSeedBox.on('pointerdown', () => {
      this.menuOptions.fixedSeed = !this.menuOptions.fixedSeed;
      this.saveMenuOptions();
      this.refreshOptionsPanel();
    });
    this.fixedSeedMark = this.add.text(-190, -104, '', uiTextStyle({
      fontSize: '18px',
      color: '#ffd36a'
    })).setOrigin(0.5);
    this.fixedSeedLabel = this.add.text(-160, -104, 'FIXED SEED', uiTextStyle({
      fontSize: '16px',
      color: '#baf7ff'
    })).setOrigin(0, 0.5);

    this.seedField = this.add.rectangle(0, -58, 420, 38, 0x061018, 0.92)
      .setStrokeStyle(1, 0x78f0ff, 0.62)
      .setInteractive({ useHandCursor: true });
    this.seedField.on('pointerdown', () => {
      this.seedInputActive = true;
      this.refreshOptionsPanel();
    });
    this.seedText = this.add.text(-196, -58, '', uiTextStyle({
      fontSize: '15px',
      color: '#d9f4ff'
    })).setOrigin(0, 0.5);

    this.difficultyLabel = this.add.text(-210, -6, 'DIFFICULTY', uiTextStyle({
      fontSize: '13px',
      color: '#baf7ff'
    })).setOrigin(0, 0.5);
    this.difficultyButtons = DIFFICULTY_OPTIONS.map((difficulty, index) => {
      const x = -56 + index * 98;
      const button = this.add.rectangle(x, -6, 86, 28, 0x061018, 0.92)
        .setStrokeStyle(1, 0x78f0ff, 0.62)
        .setInteractive({ useHandCursor: true });
      const label = this.add.text(x, -6, DIFFICULTY_LEVELS[difficulty].label, uiTextStyle({
        fontSize: '12px',
        color: '#d9f4ff',
        fontStyle: '900'
      })).setOrigin(0.5);
      button.on('pointerdown', () => {
        this.menuOptions.difficulty = difficulty;
        this.saveMenuOptions();
        this.refreshOptionsPanel();
      });
      return { difficulty, button, label };
    });

    this.volumeLabel = this.add.text(-210, 48, 'MASTER VOL', uiTextStyle({
      fontSize: '13px',
      color: '#baf7ff'
    })).setOrigin(0, 0.5);
    this.volumeTrack = this.add.rectangle(42, 48, 252, 8, 0x061018, 0.95)
      .setStrokeStyle(1, 0x78f0ff, 0.52)
      .setInteractive({ useHandCursor: true });
    this.volumeFill = this.add.rectangle(-84, 48, 0, 8, 0xffd36a, 0.78).setOrigin(0, 0.5);
    this.volumeKnob = this.add.rectangle(-84, 48, 14, 24, 0xd9f4ff, 0.92)
      .setStrokeStyle(1, 0x78f0ff, 0.88)
      .setInteractive({ useHandCursor: true });
    this.volumeValueText = this.add.text(194, 48, '', uiTextStyle({
      fontSize: '12px',
      color: '#d9f4ff'
    })).setOrigin(0, 0.5);
    this.volumeTrack.on('pointerdown', (pointer) => this.setVolumeFromPointer(pointer));
    this.volumeKnob.on('pointerdown', (pointer) => {
      this.draggingVolume = true;
      this.setVolumeFromPointer(pointer);
    });
    this.input.on('pointermove', this.handleOptionsPointerMove, this);
    this.input.on('pointerup', this.handleOptionsPointerUp, this);
    this.input.on('pointerdown', this.handleOptionsPointerDown, this);

    this.muteBox = this.add.rectangle(-190, 92, 22, 22, 0x031019, 0.86)
      .setStrokeStyle(2, 0x78f0ff, 0.75)
      .setInteractive({ useHandCursor: true });
    this.muteBox.on('pointerdown', () => {
      this.menuOptions.muted = !this.menuOptions.muted;
      this.saveMenuOptions();
      this.applyMasterVolume();
      this.refreshOptionsPanel();
    });
    this.muteMark = this.add.text(-190, 92, '', uiTextStyle({
      fontSize: '18px',
      color: '#ffd36a'
    })).setOrigin(0.5);
    this.muteLabel = this.add.text(-160, 92, 'MUTE', uiTextStyle({
      fontSize: '16px',
      color: '#baf7ff'
    })).setOrigin(0, 0.5);

    this.optionsHint = this.add.text(0, 132, 'CLICK FIELD TO EDIT  /  ESC TO CLOSE', uiTextStyle({
      fontSize: '11px',
      color: '#5f8b94'
    })).setOrigin(0.5);

    this.optionsClose = this.add.text(0, 162, '[ CLOSE ]', uiTextStyle({
      fontSize: '14px',
      color: '#ffd36a'
    })).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.optionsClose.on('pointerdown', () => this.closeOptionsPanel());

    this.optionsPanel.add([
      this.optionsPanelBg,
      this.optionsWatermark,
      this.optionsTitle,
      this.fixedSeedBox,
      this.fixedSeedMark,
      this.fixedSeedLabel,
      this.seedField,
      this.seedText,
      this.difficultyLabel,
      ...this.difficultyButtons.flatMap((item) => [item.button, item.label]),
      this.volumeLabel,
      this.volumeTrack,
      this.volumeFill,
      this.volumeKnob,
      this.volumeValueText,
      this.muteBox,
      this.muteMark,
      this.muteLabel,
      this.optionsHint,
      this.optionsClose
    ]);
    this.refreshOptionsPanel();
  }

  createBriefingPanel() {
    this.briefingPanel = this.add.container(0, 0);
    this.briefingPanel.setDepth(70);
    this.briefingPanel.setVisible(false);

    this.briefingPanelBg = this.add.graphics();
    this.briefingHeader = this.add.rectangle(0, 0, 1, 32, 0xd8f4f8, 1);
    this.briefingHeader.setStrokeStyle(2, 0x78f0ff, 0.9);
    this.briefingHeaderLeft = this.add.text(0, 0, 'Briefing', uiTextStyle({
      fontFamily: MENU_FONT_FAMILY,
      fontSize: '14px',
      color: '#15313c',
      fontStyle: '900'
    })).setOrigin(0, 0);
    this.briefingBrand = this.add.text(0, 0, 'PLASMODYNE', uiTextStyle({
      fontFamily: MENU_FONT_FAMILY,
      fontSize: '13px',
      color: '#15313c',
      fontStyle: '900'
    })).setOrigin(0.5, 0);
    this.briefingDot = this.add.text(0, 0, 'o', uiTextStyle({
      fontFamily: MENU_FONT_FAMILY,
      fontSize: '14px',
      color: '#15313c'
    })).setOrigin(0.5, 0);

    this.briefingIcon = this.add.graphics();
    this.briefingDroidSprite = this.add.sprite(0, 0, 'droid-series-0-sheet', 0);
    this.briefingDroidSprite.play(getDroidAnimationKey(0));
    this.briefingDroidSprite.setDisplaySize(164, 164);
    this.briefingDroidSprite.setVisible(false);
    this.briefingDroidActivity = this.add.graphics();
    this.briefingDroidNumber = new DroidNumerals(this, 0, 0, '001', {
      size: 42,
      color: 0x9aa6aa,
      shadowColor: 0x333d43,
      depth: 72,
      fitWidth: 114,
      fitHeight: 60,
      scrollFactor: 0
    });
    this.briefingDroidNumber.setVisible(false);
    this.briefingPageTitle = this.add.text(0, 0, '', uiTextStyle({
      fontFamily: MENU_FONT_FAMILY,
      fontSize: '24px',
      color: '#ffd36a',
      fontStyle: '900'
    })).setOrigin(0, 0.5);
    this.briefingBody = this.add.text(0, 0, '', uiTextStyle({
      fontFamily: MENU_FONT_FAMILY,
      fontSize: '22px',
      color: '#d9f4ff',
      fontStyle: '900',
      lineSpacing: 10,
      wordWrap: { width: 560 }
    })).setOrigin(0, 0);
    this.briefingBody.setShadow(0, 0, '#78f0ff', 4, true, true);
    this.briefingCounter = this.add.text(0, 0, '', uiTextStyle({
      fontFamily: MENU_FONT_FAMILY,
      fontSize: '12px',
      color: '#78f0ff',
      fontStyle: '900'
    })).setOrigin(0.5);

    this.briefingPrev = this.add.text(0, 0, '[ PREV ]', uiTextStyle({
      fontFamily: MENU_FONT_FAMILY,
      fontSize: '13px',
      color: '#8ff0ff',
      fontStyle: '900'
    })).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.briefingNext = this.add.text(0, 0, '[ NEXT ]', uiTextStyle({
      fontFamily: MENU_FONT_FAMILY,
      fontSize: '13px',
      color: '#ffd36a',
      fontStyle: '900'
    })).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.briefingClose = this.add.text(0, 0, '[ CLOSE ]', uiTextStyle({
      fontFamily: MENU_FONT_FAMILY,
      fontSize: '13px',
      color: '#8ff0ff',
      fontStyle: '900'
    })).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.briefingPrev.on('pointerdown', () => {
      if (!this.creditsOpen) this.showBriefingPage(this.briefingPageIndex - 1);
    });
    this.briefingNext.on('pointerdown', () => {
      if (!this.creditsOpen) this.showBriefingPage(this.briefingPageIndex + 1);
    });
    this.briefingClose.on('pointerdown', () => this.closeBriefingPanel());

    this.briefingPanel.add([
      this.briefingPanelBg,
      this.briefingHeader,
      this.briefingHeaderLeft,
      this.briefingBrand,
      this.briefingDot,
      this.briefingIcon,
      this.briefingDroidSprite,
      this.briefingDroidActivity,
      this.briefingDroidNumber.container,
      this.briefingPageTitle,
      this.briefingBody,
      this.briefingCounter,
      this.briefingPrev,
      this.briefingNext,
      this.briefingClose
    ]);
    this.showBriefingPage(0);
  }

  createDroidIndexPanel() {
    this.droidIndexPanel = this.add.container(0, 0);
    this.droidIndexPanel.setDepth(68);
    this.droidIndexPanel.setVisible(false);

    this.droidIndexBg = this.add.graphics();
    this.droidIndexHeader = this.add.rectangle(0, 0, 1, 34, 0xd8f4f8, 1);
    this.droidIndexHeader.setStrokeStyle(2, 0x78f0ff, 0.9);
    this.droidIndexHeaderLeft = this.add.text(0, 0, 'DROID INDEX', uiTextStyle({
      fontFamily: CATALOG_FONT_FAMILY,
      fontSize: '12px',
      color: '#15313c',
      fontStyle: '700'
    })).setOrigin(0, 0.5);
    this.droidIndexBrand = this.add.text(0, 0, 'PLASMODYNE', uiTextStyle({
      fontFamily: CATALOG_FONT_FAMILY,
      fontSize: '12px',
      color: '#15313c',
      fontStyle: '700'
    })).setOrigin(0.5);
    this.droidIndexCount = this.add.text(0, 0, `${DROID_TEMPLATES.length} MODELS`, uiTextStyle({
      fontFamily: CATALOG_FONT_FAMILY,
      fontSize: '12px',
      color: '#15313c',
      fontStyle: '700'
    })).setOrigin(1, 0.5);

    this.droidIndexListTitle = this.add.text(0, 0, 'MODEL CATALOG', uiTextStyle({
      fontFamily: CATALOG_FONT_FAMILY,
      fontSize: '13px',
      color: '#8ff0ff',
      fontStyle: '700'
    })).setOrigin(0, 0.5);
    this.droidIndexListItems = DROID_TEMPLATES.map((template, index) => {
      const box = this.add.rectangle(0, 0, 58, 26, 0x061018, 0.92)
        .setStrokeStyle(1, 0x2d7f8b, 0.62)
        .setInteractive({ useHandCursor: true });
      const label = this.add.text(0, 0, template.displayId, uiTextStyle({
        fontFamily: CATALOG_FONT_FAMILY,
        fontSize: '13px',
        color: '#baf7ff',
        fontStyle: '700'
      })).setOrigin(0.5);
      box.on('pointerover', () => this.selectDroidIndexTemplate(index));
      box.on('pointerdown', () => this.selectDroidIndexTemplate(index));
      return { template, box, label };
    });

    this.droidIndexPreviewFx = this.add.graphics();
    this.droidIndexDroidSprite = this.add.sprite(0, 0, 'droid-series-0-sheet', 0);
    this.droidIndexDroidSprite.play(getDroidAnimationKey(0));
    this.droidIndexActivity = this.add.graphics();
    this.droidIndexNumber = new DroidNumerals(this, 0, 0, '001', {
      size: 54,
      color: 0x9aa6aa,
      shadowColor: 0x333d43,
      depth: 69,
      fitWidth: 136,
      fitHeight: 82,
      scrollFactor: 0
    });
    this.droidIndexVariantLabel = this.add.text(0, 0, '', uiTextStyle({
      fontFamily: CATALOG_FONT_FAMILY,
      fontSize: '12px',
      color: '#ffd36a',
      fontStyle: '700'
    })).setOrigin(0.5);

    this.droidIndexTitle = this.add.text(0, 0, '', uiTextStyle({
      fontFamily: CATALOG_FONT_FAMILY,
      fontSize: '21px',
      color: '#ffd36a',
      fontStyle: '700',
      wordWrap: { width: 360 }
    })).setOrigin(0, 0);
    this.droidIndexSubtitle = this.add.text(0, 0, '', uiTextStyle({
      fontFamily: CATALOG_FONT_FAMILY,
      fontSize: '13px',
      color: '#8ff0ff',
      fontStyle: '700'
    })).setOrigin(0, 0);
    this.droidIndexStats = this.add.text(0, 0, '', uiTextStyle({
      fontFamily: CATALOG_FONT_FAMILY,
      fontSize: '12px',
      color: '#d9f4ff',
      lineSpacing: 6,
      wordWrap: { width: 360 }
    })).setOrigin(0, 0);
    this.droidIndexFlavor = this.add.text(0, 0, '', uiTextStyle({
      fontFamily: CATALOG_FONT_FAMILY,
      fontSize: '11px',
      color: '#8aa8ae',
      lineSpacing: 4,
      wordWrap: { width: 360 }
    })).setOrigin(0, 0);

    this.droidIndexTintTitle = this.add.text(0, 0, 'VARIANT TINT ORDER', uiTextStyle({
      fontFamily: CATALOG_FONT_FAMILY,
      fontSize: '11px',
      color: '#5f8b94',
      fontStyle: '700'
    })).setOrigin(0, 0.5);
    this.droidIndexTintChips = DROID_MODEL_TINTS.map((entry) => {
      const swatch = this.add.rectangle(0, 0, 18, 18, entry.color, entry.tint === null ? 0.35 : 0.9)
        .setStrokeStyle(1, entry.color, 0.95);
      const label = this.add.text(0, 0, entry.name, uiTextStyle({
        fontFamily: CATALOG_FONT_FAMILY,
        fontSize: '10px',
        color: '#9fb6bb'
      })).setOrigin(0, 0.5);
      return { swatch, label };
    });

    this.droidIndexHint = this.add.text(0, 0, 'ARROWS: SELECT  /  ESC: CLOSE', uiTextStyle({
      fontFamily: CATALOG_FONT_FAMILY,
      fontSize: '11px',
      color: '#5f8b94'
    })).setOrigin(0.5);
    this.droidIndexClose = this.add.text(0, 0, '[ CLOSE ]', uiTextStyle({
      fontFamily: MENU_FONT_FAMILY,
      fontSize: '13px',
      color: '#ffd36a',
      fontStyle: '900'
    })).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.droidIndexClose.on('pointerdown', () => this.closeDroidIndexPanel());

    this.droidIndexPanel.add([
      this.droidIndexBg,
      this.droidIndexHeader,
      this.droidIndexHeaderLeft,
      this.droidIndexBrand,
      this.droidIndexCount,
      this.droidIndexListTitle,
      ...this.droidIndexListItems.flatMap((item) => [item.box, item.label]),
      this.droidIndexPreviewFx,
      this.droidIndexDroidSprite,
      this.droidIndexActivity,
      this.droidIndexNumber.container,
      this.droidIndexVariantLabel,
      this.droidIndexTitle,
      this.droidIndexSubtitle,
      this.droidIndexStats,
      this.droidIndexFlavor,
      this.droidIndexTintTitle,
      ...this.droidIndexTintChips.flatMap((item) => [item.swatch, item.label]),
      this.droidIndexHint,
      this.droidIndexClose
    ]);
    this.selectDroidIndexTemplate(0);
  }

  positionOptionsPanel() {
    if (!this.optionsPanel) {
      return;
    }
    this.optionsPanel.setPosition(this.scale.width / 2, this.scale.height / 2 + 24);
    this.drawOptionsPanel();
  }

  positionDroidIndexPanel() {
    if (!this.droidIndexPanel) {
      return;
    }
    const { width, height } = this.scale;
    const headerWidth = Math.min(760, width - 80);
    const contentTop = Math.max(86, height * 0.12);
    const contentBottom = height - 86;
    const contentHeight = Math.max(390, contentBottom - contentTop);
    const contentLeft = 36;
    const contentRight = width - 36;
    const gutter = Math.max(28, width * 0.028);
    const columns = width < 980 ? 3 : 4;
    const listBoxWidth = 58;
    const listBoxHeight = 26;
    const colGap = width < 980 ? 62 : 70;
    const rowGap = Math.max(29, Math.min(34, (contentHeight - 104) / Math.ceil(DROID_TEMPLATES.length / columns)));
    const rows = Math.ceil(DROID_TEMPLATES.length / columns);
    const listWidth = columns * listBoxWidth + (columns - 1) * (colGap - listBoxWidth) + 28;
    const listX = contentLeft + 30;
    const listY = contentTop + 66;
    const detailsWidth = Math.min(430, Math.max(330, width * 0.33));
    const detailsX = contentRight - detailsWidth - 26;
    const previewLeft = listX + listWidth + gutter;
    const previewRight = detailsX - gutter;
    const previewX = (previewLeft + previewRight) / 2;
    const previewY = contentTop + contentHeight * 0.48;
    const previewColumnWidth = Math.max(210, previewRight - previewLeft);

    this.droidIndexPanel.setPosition(0, 0);
    this.droidIndexBounds = {
      x: contentLeft,
      y: contentTop,
      width: contentRight - contentLeft,
      height: contentHeight
    };
    this.droidIndexHeader.setPosition(width / 2, 44);
    this.droidIndexHeader.setSize(headerWidth, 34);
    this.droidIndexHeaderLeft.setPosition(width / 2 - headerWidth / 2 + 18, 44);
    this.droidIndexBrand.setPosition(width / 2, 44);
    this.droidIndexCount.setPosition(width / 2 + headerWidth / 2 - 18, 44);
    this.droidIndexListTitle.setPosition(listX, contentTop + 28);

    this.droidIndexListItems.forEach((item, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = listX + col * colGap;
      const y = listY + row * rowGap;
      item.box.setSize(listBoxWidth, listBoxHeight);
      item.box.setPosition(x, y);
      item.label.setPosition(x, y);
    });

    const previewSize = Math.min(220, Math.max(140, previewColumnWidth * 0.55, height * 0.19));
    this.droidIndexDroidSprite.setPosition(previewX, previewY);
    this.droidIndexDroidSprite.setDisplaySize(previewSize, previewSize);
    this.droidIndexNumber.setPosition(previewX, previewY - 2);
    this.droidIndexVariantLabel.setPosition(previewX, previewY + previewSize * 0.54);

    const detailsInnerX = detailsX + 24;
    const detailsInnerWidth = detailsWidth - 48;
    const detailsTop = contentTop + 42;
    const legendTop = contentTop + contentHeight - 118;
    this.droidIndexTitle.setPosition(detailsInnerX, detailsTop);
    this.droidIndexTitle.setWordWrapWidth(detailsInnerWidth);
    this.droidIndexSubtitle.setPosition(detailsInnerX, detailsTop + 46);
    this.droidIndexStats.setPosition(detailsInnerX, detailsTop + 90);
    this.droidIndexStats.setWordWrapWidth(detailsInnerWidth);
    this.droidIndexFlavor.setPosition(detailsInnerX, Math.min(legendTop - 76, detailsTop + 330));
    this.droidIndexFlavor.setWordWrapWidth(detailsInnerWidth);

    this.droidIndexTintTitle.setPosition(detailsInnerX, legendTop);
    this.droidIndexTintChips.forEach((item, index) => {
      const chipColumns = detailsWidth < 390 ? 2 : 3;
      const chipGap = chipColumns === 2 ? 142 : 118;
      const x = detailsInnerX + (index % chipColumns) * chipGap;
      const y = legendTop + 28 + Math.floor(index / chipColumns) * 26;
      item.swatch.setPosition(x, y);
      item.label.setPosition(x + 16, y);
    });

    this.droidIndexHint.setPosition(width / 2, height - 54);
    this.droidIndexClose.setPosition(width / 2, height - 28);
    this.drawDroidIndexPanel({
      contentTop,
      contentHeight,
      contentLeft,
      contentRight,
      listX,
      listY,
      listWidth,
      listHeight: (rows - 1) * rowGap + listBoxHeight + 74,
      columns,
      rows,
      previewX,
      previewY,
      previewRadius: Math.min(128, previewSize * 0.64),
      detailsX,
      detailsWidth,
      detailsTop,
      legendTop
    });
  }

  positionBriefingPanel() {
    if (!this.briefingPanel) {
      return;
    }
    const { width, height } = this.scale;
    this.briefingPanel.setPosition(0, 0);
    this.briefingHeader.setPosition(width / 2, 44);
    this.briefingHeader.setSize(Math.min(620, width - 60), 32);
    this.briefingHeaderLeft.setPosition(width / 2 - Math.min(620, width - 60) / 2 + 18, 34);
    this.briefingBrand.setPosition(width / 2, 32);
    this.briefingDot.setPosition(width / 2 + Math.min(620, width - 60) / 2 - 18, 34);
    this.briefingPageTitle.setPosition(width * 0.42, height * 0.3);
    this.briefingBody.setPosition(width * 0.42, height * 0.36);
    this.briefingBody.setWordWrapWidth(Math.min(560, width * 0.48));
    this.briefingCounter.setPosition(width / 2, height - 110);
    this.briefingPrev.setPosition(width / 2 - 170, height - 66);
    this.briefingNext.setPosition(width / 2, height - 66);
    this.briefingClose.setPosition(width / 2 + 170, height - 66);
    this.drawBriefingPanel();
    this.drawBriefingIcon(BRIEFING_PAGES[this.briefingPageIndex]?.icon);
  }

  drawDroidIndexPanel(layout = {}) {
    if (!this.droidIndexBg) {
      return;
    }
    const { width, height } = this.scale;
    const contentTop = layout.contentTop ?? 112;
    const contentHeight = layout.contentHeight ?? Math.max(360, height - 224);
    const contentBottom = contentTop + contentHeight;
    const contentLeft = layout.contentLeft ?? 28;
    const contentRight = layout.contentRight ?? width - 28;
    const contentWidth = contentRight - contentLeft;
    this.droidIndexBg.clear();
    this.droidIndexBg.fillStyle(0x010405, 1);
    this.droidIndexBg.fillRect(0, 0, width, height);
    this.droidIndexBg.lineStyle(1, 0x1a626c, 0.08);
    for (let x = 0; x <= width; x += 72) {
      this.droidIndexBg.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y <= height; y += 54) {
      this.droidIndexBg.lineBetween(0, y, width, y);
    }
    this.droidIndexBg.fillStyle(0x02070a, 0.92);
    this.droidIndexBg.fillRoundedRect(contentLeft, contentTop, contentWidth, contentHeight, 6);
    this.droidIndexBg.lineStyle(2, 0x78f0ff, 0.62);
    this.droidIndexBg.strokeRoundedRect(contentLeft, contentTop, contentWidth, contentHeight, 6);

    const listWidth = layout.listWidth ?? ((layout.columns ?? 4) * 70 + 22);
    const listHeight = Math.min(contentHeight - 54, layout.listHeight ?? ((layout.rows ?? 8) * 34 + 34));
    this.droidIndexBg.fillStyle(0x061018, 0.82);
    this.droidIndexBg.fillRoundedRect((layout.listX ?? 56) - 26, contentTop + 18, listWidth, listHeight, 4);
    this.droidIndexBg.lineStyle(1, 0x78f0ff, 0.32);
    this.droidIndexBg.strokeRoundedRect((layout.listX ?? 56) - 26, contentTop + 18, listWidth, listHeight, 4);

    const previewX = layout.previewX ?? width * 0.46;
    const previewY = layout.previewY ?? height * 0.5;
    const previewRadius = layout.previewRadius ?? 124;
    this.droidIndexBg.lineStyle(1, 0xffd36a, 0.3);
    this.droidIndexBg.strokeCircle(previewX, previewY, previewRadius);
    this.droidIndexBg.lineBetween(previewX - previewRadius - 20, previewY, previewX + previewRadius + 20, previewY);
    this.droidIndexBg.lineBetween(previewX, previewY - previewRadius - 20, previewX, previewY + previewRadius + 20);

    const detailsX = layout.detailsX ?? width * 0.66;
    const detailsWidth = layout.detailsWidth ?? 360;
    const detailsTop = contentTop + 26;
    const detailsHeight = contentHeight - 52;
    this.droidIndexBg.fillStyle(0x102533, 0.72);
    this.droidIndexBg.fillRoundedRect(detailsX, detailsTop, detailsWidth, detailsHeight, 4);
    this.droidIndexBg.lineStyle(1, 0xb7f6ff, 0.34);
    this.droidIndexBg.strokeRoundedRect(detailsX, detailsTop, detailsWidth, detailsHeight, 4);
    if (layout.legendTop) {
      this.droidIndexBg.lineStyle(1, 0x78f0ff, 0.18);
      this.droidIndexBg.lineBetween(detailsX + 24, layout.legendTop - 18, detailsX + detailsWidth - 24, layout.legendTop - 18);
    }
  }

  openDroidIndexPanel() {
    this.droidIndexOpen = true;
    this.droidIndexOpenedAt = this.time.now;
    this.droidIndexPanel?.setVisible(true);
    this.selectDroidIndexTemplate(this.droidIndexSelection);
  }

  closeDroidIndexPanel() {
    this.droidIndexOpen = false;
    this.droidIndexPanel?.setVisible(false);
  }

  selectDroidIndexTemplate(index) {
    this.droidIndexSelection = Phaser.Math.Wrap(index, 0, DROID_TEMPLATES.length);
    const template = DROID_TEMPLATES[this.droidIndexSelection];
    const tint = getDroidModelTint(template);
    const visual = getDroidVisualKeys(template.rank);
    this.droidIndexDroidSprite?.setTexture(visual.textureKey, 0);
    this.droidIndexDroidSprite?.play(visual.animationKey, true);
    if (tint.tint === null) {
      this.droidIndexDroidSprite?.clearTint();
    } else {
      this.droidIndexDroidSprite?.setTint(tint.tint);
    }
    this.droidIndexNumber?.setText(template.displayId);
    this.droidIndexVariantLabel?.setText(`${tint.name} VARIANT`);
    this.droidIndexTitle?.setText(`${template.displayId} ${template.name}`.toUpperCase());
    this.droidIndexSubtitle?.setText(`${this.getSeriesLabel(template)}  /  ${template.chassisClass.toUpperCase()}`);
    this.droidIndexStats?.setText(this.getDroidIndexStats(template));
    this.droidIndexFlavor?.setText(this.getDroidIndexFlavor(template));

    this.droidIndexListItems?.forEach((item, itemIndex) => {
      const itemTint = getDroidModelTint(item.template);
      const selected = itemIndex === this.droidIndexSelection;
      item.box.setFillStyle(selected ? itemTint.color : 0x061018, selected ? 0.32 : 0.92);
      item.box.setStrokeStyle(selected ? 2 : 1, selected ? itemTint.color : 0x2d7f8b, selected ? 1 : 0.62);
      item.label.setColor(selected ? '#ffffff' : '#baf7ff');
      item.label.setAlpha(selected ? 1 : 0.72);
      item.label.setShadow(0, 0, selected ? '#ffffff' : '#2b7b86', selected ? 7 : 2, true, true);
    });
    this.updateDroidIndexPreview(this.time.now);
  }

  updateDroidIndexPreview(time) {
    if (!this.droidIndexOpen || !this.droidIndexPreviewFx) {
      return;
    }
    const template = DROID_TEMPLATES[this.droidIndexSelection];
    const tint = getDroidModelTint(template);
    const pulse = 0.5 + Math.sin(time * 0.0024) * 0.5;
    const x = this.droidIndexDroidSprite.x;
    const y = this.droidIndexDroidSprite.y;
    const color = tint.color ?? 0xbaf7ff;
    this.droidIndexPreviewFx.clear();
    this.droidIndexPreviewFx.lineStyle(2, color, 0.24 + pulse * 0.26);
    this.droidIndexPreviewFx.strokeCircle(x, y, 120 + pulse * 8);
    this.droidIndexPreviewFx.lineStyle(1, 0x78f0ff, 0.18);
    this.droidIndexPreviewFx.lineBetween(x - 146, y, x + 146, y);
    this.droidIndexPreviewFx.lineBetween(x, y - 146, x, y + 146);
    this.drawDroidSignalActivity(this.droidIndexActivity, time, pulse, x, y - 2, 108, 40);
    this.droidIndexNumber?.setAlpha(0.84 + pulse * 0.16);
  }

  getSeriesLabel(template) {
    const series = Math.max(0, Math.floor(template.rank / 100));
    if (series === 0) {
      return '0-SERIES EXPERIMENTAL';
    }
    return `${series}XX SERIES`;
  }

  getDroidIndexStats(template) {
    const variantNumber = getDroidModelVariantIndex(template) + 1;
    const seriesSize = DROID_TEMPLATES.filter((item) => Math.floor(item.rank / 100) === Math.floor(template.rank / 100)).length;
    return [
      `MODEL       : ${template.displayId}`,
      `VARIANT     : ${variantNumber} / ${Math.max(1, seriesSize)}`,
      `INTEGRITY   : ${template.maxIntegrity}`,
      `SPEED       : ${template.speed}`,
      `WEAPON      : ${template.weaponType.toUpperCase()}`,
      `DAMAGE      : ${template.damage || '-'}`,
      `FIRE RATE   : ${template.fireRate || '-'}`,
      `SENSOR      : ${template.sensorRange}`,
      `CLEARANCE   : ${template.clearanceLevel}`,
      `RESISTANCE  : ${template.possessionResistance}`,
      `AI PROFILE  : ${template.aiProfile.toUpperCase()}`
    ].join('\n');
  }

  getDroidIndexFlavor(template) {
    const tags = template.specialTags.length ? template.specialTags.join(', ') : 'standard hull';
    const weaponNote = template.weaponType === 'none'
      ? 'Unarmed utility chassis. Best understood as a systems body rather than a combat shell.'
      : 'Armed autonomous platform. Capture value rises with clearance, resistance, and installed weapon tier.';
    return `${weaponNote}\nTAGS: ${tags.toUpperCase()}`;
  }

  drawOptionsPanel() {
    if (!this.optionsPanelBg) {
      return;
    }
    this.optionsPanelBg.clear();
    this.optionsPanelBg.fillStyle(0x02070a, 0.96);
    this.optionsPanelBg.fillRoundedRect(-280, -184, 560, 368, 6);
    this.optionsPanelBg.lineStyle(2, 0x78f0ff, 0.68);
    this.optionsPanelBg.strokeRoundedRect(-280, -184, 560, 368, 6);
    this.optionsPanelBg.lineStyle(1, 0xffd36a, 0.38);
    this.optionsPanelBg.lineBetween(-250, -158, -152, -158);
    this.optionsPanelBg.lineBetween(152, -158, 250, -158);
    this.optionsPanelBg.lineStyle(1, 0x78f0ff, 0.18);
    for (let y = -144; y <= 150; y += 12) {
      this.optionsPanelBg.lineBetween(-256, y, 256, y);
    }
  }

  drawBriefingPanel() {
    if (!this.briefingPanelBg) {
      return;
    }
    this.briefingPanelBg.clear();
    const { width, height } = this.scale;
    const margin = 28;
    const contentTop = 98;
    const contentBottom = height - 136;
    const contentHeight = Math.max(260, contentBottom - contentTop);
    const contentWidth = width - margin * 2;
    this.briefingPanelBg.fillStyle(0x02070a, 0.97);
    this.briefingPanelBg.fillRect(0, 0, width, height);
    this.briefingPanelBg.fillStyle(0x010405, 1);
    this.briefingPanelBg.fillRect(0, 0, width, height);
    this.briefingPanelBg.lineStyle(1, 0x1a626c, 0.08);
    for (let x = 0; x <= width; x += 72) {
      this.briefingPanelBg.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y <= height; y += 54) {
      this.briefingPanelBg.lineBetween(0, y, width, y);
    }
    this.briefingPanelBg.fillStyle(0x02070a, 0.92);
    this.briefingPanelBg.fillRoundedRect(margin, contentTop, contentWidth, contentHeight, 6);
    this.briefingPanelBg.lineStyle(2, 0x78f0ff, 0.7);
    this.briefingPanelBg.strokeRoundedRect(margin, contentTop, contentWidth, contentHeight, 6);
    this.briefingPanelBg.fillStyle(0x102533, 0.9);
    this.briefingPanelBg.fillRect(width * 0.38, contentTop + 42, Math.min(650, width * 0.55), contentHeight - 84);
    this.briefingPanelBg.lineStyle(1, 0xb7f6ff, 0.38);
    this.briefingPanelBg.strokeRect(width * 0.38, contentTop + 42, Math.min(650, width * 0.55), contentHeight - 84);
    this.briefingPanelBg.lineStyle(1, 0x78f0ff, 0.08);
    for (let y = contentTop + 54; y <= contentBottom - 54; y += 10) {
      this.briefingPanelBg.lineBetween(width * 0.38 + 12, y, Math.min(width - 58, width * 0.93), y);
    }
    this.briefingPanelBg.lineStyle(1, 0xffd36a, 0.38);
    this.briefingPanelBg.lineBetween(margin + 36, height - 92, width / 2 - 90, height - 92);
    this.briefingPanelBg.lineBetween(width / 2 + 90, height - 92, width - margin - 36, height - 92);
  }

  openBriefingPanel() {
    this.briefingOpen = true;
    this.creditsOpen = false;
    this.briefingPanel?.setVisible(true);
    this.briefingPrev?.setVisible(true);
    this.briefingNext?.setVisible(true);
    this.showBriefingPage(0);
  }

  closeBriefingPanel() {
    this.briefingOpen = false;
    this.creditsOpen = false;
    this.briefingPanel?.setVisible(false);
  }

  openCreditsPanel() {
    this.briefingOpen = true;
    this.creditsOpen = true;
    this.briefingPanel?.setVisible(true);
    this.briefingPrev?.setVisible(false);
    this.briefingNext?.setVisible(false);
    this.showCreditsPage();
  }

  showBriefingPage(index) {
    this.briefingPageIndex = Phaser.Math.Wrap(index, 0, BRIEFING_PAGES.length);
    const page = BRIEFING_PAGES[this.briefingPageIndex];
    this.briefingBody?.setFontFamily(MENU_FONT_FAMILY);
    this.briefingBody?.setFontSize(22);
    this.briefingBody?.setLineSpacing(10);
    this.briefingPageTitle?.setText(page.title);
    this.briefingBody?.setText(page.text);
    this.briefingCounter?.setText(`${this.briefingPageIndex + 1} / ${BRIEFING_PAGES.length}`);
    this.drawBriefingIcon(page.icon);
  }

  showCreditsPage() {
    this.briefingBody?.setFontFamily(CATALOG_FONT_FAMILY);
    this.briefingBody?.setFontSize(20);
    this.briefingBody?.setLineSpacing(9);
    this.briefingPageTitle?.setText(CREDITS_PAGE.title);
    this.briefingBody?.setText(CREDITS_PAGE.text);
    this.briefingCounter?.setText('1 / 1');
    this.drawBriefingIcon(CREDITS_PAGE.icon);
  }

  drawBriefingIcon(icon) {
    if (!this.briefingIcon) {
      return;
    }
    const g = this.briefingIcon;
    const { width, height } = this.scale;
    const cx = width * 0.22;
    const cy = height * 0.48;
    g.clear();
    g.setPosition(cx, cy);
    this.briefingDroidSprite?.setVisible(false);
    this.briefingDroidNumber?.setVisible(false);
    this.briefingDroidActivity?.clear();
    g.lineStyle(2, 0x78f0ff, 0.75);
    g.strokeCircle(0, 0, 78);
    g.lineStyle(1, 0xffd36a, 0.45);
    g.lineBetween(-92, 0, 92, 0);
    g.lineBetween(0, -92, 0, 92);

    if (icon === 'droid' || icon === 'ship') {
      this.drawBriefingAnimatedDroid(cx, cy);
      return;
    }

    if (icon === 'move') {
      g.lineStyle(5, 0x8ff0ff, 0.9);
      g.strokeRoundedRect(-20, -45, 40, 70, 16);
      g.fillStyle(0xffd36a, 0.95);
      g.fillCircle(0, 15, 6);
      g.lineStyle(3, 0xffd36a, 0.9);
      g.lineBetween(25, 14, 62, 38);
      return;
    }

    if (icon === 'fire') {
      g.lineStyle(3, 0x8ff0ff, 0.85);
      g.strokeCircle(-24, 0, 24);
      g.lineBetween(-24, -42, -24, 42);
      g.lineBetween(-66, 0, 18, 0);
      g.lineStyle(5, 0xffd36a, 0.95);
      g.lineBetween(6, 0, 68, -28);
      g.fillStyle(0xffd36a, 1);
      g.fillCircle(74, -30, 7);
      return;
    }

    if (icon === 'transfer') {
      g.fillStyle(0x8ff0d0, 0.9);
      g.fillCircle(-42, -20, 16);
      g.fillCircle(42, 20, 16);
      g.lineStyle(5, 0xffd36a, 0.9);
      g.lineBetween(-24, -12, 24, 12);
      g.lineStyle(1, 0xd9f4ff, 0.75);
      g.strokeCircle(-42, -20, 28);
      g.strokeCircle(42, 20, 28);
      return;
    }

    this.drawBriefingRepairPad(g, 0, 0, 1.35);
  }

  drawBriefingAnimatedDroid(x, y) {
    if (!this.briefingDroidSprite || !this.briefingDroidNumber) {
      return;
    }
    this.briefingDroidSprite.setPosition(x, y);
    this.briefingDroidSprite.setDisplaySize(170, 170);
    this.briefingDroidSprite.setVisible(true);
    this.briefingDroidNumber.setPosition(x, y + 2);
    this.briefingDroidNumber.setVisible(true);
    this.drawDroidSignalActivity(this.briefingDroidActivity, this.time.now, 0.7, x, y - 2, 96, 36);
  }

  drawBriefingDroidIcon(g, x, y, scale = 1) {
    g.fillStyle(0x000000, 0.3);
    g.fillEllipse(x, y + 8 * scale, 76 * scale, 58 * scale);
    g.fillStyle(0x0b1d26, 1);
    g.fillEllipse(x, y, 76 * scale, 60 * scale);
    g.lineStyle(2, 0xc8fbff, 0.9);
    g.strokeEllipse(x, y, 76 * scale, 60 * scale);
    g.lineStyle(1, 0xd8f7ff, 0.75);
    g.lineBetween(x - 34 * scale, y - 18 * scale, x + 34 * scale, y - 18 * scale);
    g.lineBetween(x - 31 * scale, y + 18 * scale, x + 31 * scale, y + 18 * scale);
    g.fillStyle(0x8ff0d0, 0.92);
    g.fillCircle(x, y, 16 * scale);
    g.fillStyle(0x07131a, 0.96);
    g.fillCircle(x, y, 6 * scale);
    g.lineStyle(5 * scale, 0x07131a, 1);
    g.lineBetween(x - 30 * scale, y, x + 30 * scale, y);
    g.lineBetween(x, y - 30 * scale, x, y + 30 * scale);
    g.fillStyle(0xd8f7ff, 1);
    g.fillRect(x - 24 * scale, y + 44 * scale, 48 * scale, 14 * scale);
    g.fillStyle(0x07131a, 1);
    g.fillRect(x - 20 * scale, y + 47 * scale, 40 * scale, 8 * scale);
    g.lineStyle(1, 0x78f0ff, 0.85);
    g.strokeRect(x - 24 * scale, y + 44 * scale, 48 * scale, 14 * scale);
    g.fillStyle(0xd8f7ff, 1);
    g.fillRect(x - 19 * scale, y + 48 * scale, 6 * scale, 6 * scale);
    g.fillRect(x - 3 * scale, y + 48 * scale, 6 * scale, 6 * scale);
    g.fillRect(x + 13 * scale, y + 48 * scale, 6 * scale, 6 * scale);
  }

  drawBriefingLiftPad(g, x, y, scale = 1) {
    g.fillStyle(0x102533, 1);
    g.fillRoundedRect(x - 30 * scale, y - 30 * scale, 60 * scale, 60 * scale, 6 * scale);
    g.lineStyle(2, 0xc8fbff, 0.8);
    g.strokeRoundedRect(x - 30 * scale, y - 30 * scale, 60 * scale, 60 * scale, 6 * scale);
    g.fillStyle(0x8ff0d0, 0.95);
    g.fillCircle(x, y, 17 * scale);
    g.fillStyle(0x102533, 1);
    g.fillCircle(x, y, 6 * scale);
    g.lineStyle(5 * scale, 0x102533, 1);
    g.lineBetween(x - 25 * scale, y, x + 25 * scale, y);
    g.lineBetween(x, y - 25 * scale, x, y + 25 * scale);
  }

  drawBriefingConsole(g, x, y, scale = 1, wallSide = 'west') {
    const size = 66 * scale;
    const thick = size * 0.18;
    const inset = size * 0.12;
    const arm = size * 0.72;
    const left = x - size / 2;
    const top = y - size / 2;
    const back = this.briefingConsoleBackRect(left, top, size, wallSide, thick, inset);
    const arms = this.briefingConsoleArmRects(left, top, size, wallSide, thick, inset, arm);
    g.fillStyle(0x000000, 0.26);
    for (const part of [back, ...arms]) {
      g.fillRect(part.x + 2 * scale, part.y + 2 * scale, part.w, part.h);
    }
    g.fillStyle(0x102533, 1);
    for (const part of [back, ...arms]) {
      g.fillRect(part.x, part.y, part.w, part.h);
    }
    g.lineStyle(2, 0x78f0ff, 0.75);
    for (const part of [back, ...arms]) {
      g.strokeRect(part.x, part.y, part.w, part.h);
    }
    const panel = this.briefingConsolePanelPoint(left, top, size, wallSide);
    g.lineStyle(1, 0xd9f4ff, 0.58);
    g.strokeRect(panel.x - size * 0.14, panel.y - size * 0.14, size * 0.28, size * 0.28);
    g.fillStyle(0x8ff0d0, 0.95);
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        g.fillRect(panel.x - size * 0.11 + col * size * 0.07, panel.y - size * 0.055 + row * size * 0.085, size * 0.038, size * 0.028);
      }
    }
  }

  briefingConsoleBackRect(x, y, size, side, thick, inset) {
    if (side === 'north') return { x: x + inset, y: y + inset, w: size - inset * 2, h: thick };
    if (side === 'south') return { x: x + inset, y: y + size - inset - thick, w: size - inset * 2, h: thick };
    if (side === 'west') return { x: x + inset, y: y + inset, w: thick, h: size - inset * 2 };
    return { x: x + size - inset - thick, y: y + inset, w: thick, h: size - inset * 2 };
  }

  briefingConsoleArmRects(x, y, size, side, thick, inset, arm) {
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

  briefingConsolePanelPoint(x, y, size, side) {
    if (side === 'north') return { x: x + size / 2, y: y + size * 0.32 };
    if (side === 'south') return { x: x + size / 2, y: y + size * 0.68 };
    if (side === 'west') return { x: x + size * 0.32, y: y + size / 2 };
    return { x: x + size * 0.68, y: y + size / 2 };
  }

  drawBriefingRepairPad(g, x, y, scale = 1) {
    g.fillStyle(0x102533, 1);
    g.fillRoundedRect(x - 44 * scale, y - 30 * scale, 88 * scale, 60 * scale, 5 * scale);
    g.lineStyle(2, 0xffd36a, 0.8);
    g.strokeRoundedRect(x - 44 * scale, y - 30 * scale, 88 * scale, 60 * scale, 5 * scale);
    g.fillStyle(0xffd36a, 0.9);
    g.fillRect(x - 6 * scale, y - 20 * scale, 12 * scale, 40 * scale);
    g.fillRect(x - 22 * scale, y - 6 * scale, 44 * scale, 12 * scale);
    g.lineStyle(1, 0x8ff0ff, 0.55);
    g.strokeCircle(x, y, 30 * scale);
  }


  openOptionsPanel() {
    this.optionsOpen = true;
    this.seedInputActive = false;
    this.optionsOpenedAt = this.time.now;
    this.optionsPanel?.setVisible(true);
    this.refreshOptionsPanel();
  }

  closeOptionsPanel() {
    this.optionsOpen = false;
    this.seedInputActive = false;
    this.optionsPanel?.setVisible(false);
    this.saveMenuOptions();
  }

  handleOptionsPointerDown(pointer) {
    if (this.droidIndexOpen && this.droidIndexPanel) {
      if (this.time.now - (this.droidIndexOpenedAt ?? 0) < 120) {
        return;
      }
      const bounds = this.droidIndexBounds;
      const inside = bounds &&
        pointer.x >= bounds.x &&
        pointer.x <= bounds.x + bounds.width &&
        pointer.y >= bounds.y &&
        pointer.y <= bounds.y + bounds.height;
      if (!inside) {
        this.closeDroidIndexPanel();
      }
      return;
    }

    if (!this.optionsOpen || !this.optionsPanel) {
      return;
    }
    if (this.time.now - (this.optionsOpenedAt ?? 0) < 120) {
      return;
    }
    const localX = pointer.x - this.optionsPanel.x;
    const localY = pointer.y - this.optionsPanel.y;
    const bounds = this.optionsPanelBounds;
    const inside = localX >= bounds.x &&
      localX <= bounds.x + bounds.width &&
      localY >= bounds.y &&
      localY <= bounds.y + bounds.height;
    if (!inside) {
      this.closeOptionsPanel();
    }
  }

  refreshOptionsPanel() {
    if (!this.seedText) {
      return;
    }
    this.fixedSeedMark.setText(this.menuOptions.fixedSeed ? 'X' : '');
    this.fixedSeedBox.setStrokeStyle(2, this.menuOptions.fixedSeed ? 0xffd36a : 0x78f0ff, this.menuOptions.fixedSeed ? 0.94 : 0.75);
    this.seedField.setStrokeStyle(1, this.seedInputActive ? 0xffd36a : 0x78f0ff, this.seedInputActive ? 0.95 : 0.62);
    const cursor = this.seedInputActive && Math.floor(this.time.now / 420) % 2 === 0 ? '_' : '';
    this.seedText.setText(`${this.menuOptions.seed}${cursor}`);
    const volume = Phaser.Math.Clamp(Number(this.menuOptions.masterVolume ?? 1), 0, 1);
    const trackLeft = -84;
    const trackWidth = 252;
    this.volumeFill.setSize(trackWidth * volume, 8);
    this.volumeKnob.setPosition(trackLeft + trackWidth * volume, 48);
    this.volumeValueText.setText(`${Math.round(volume * 100)}%`);
    this.volumeTrack.setStrokeStyle(1, this.menuOptions.muted ? 0x5f8b94 : 0x78f0ff, this.menuOptions.muted ? 0.34 : 0.52);
    this.volumeKnob.setFillStyle(this.menuOptions.muted ? 0x5f8b94 : 0xd9f4ff, this.menuOptions.muted ? 0.62 : 0.92);
    this.volumeFill.setFillStyle(this.menuOptions.muted ? 0x5f8b94 : 0xffd36a, this.menuOptions.muted ? 0.42 : 0.78);
    this.muteMark.setText(this.menuOptions.muted ? 'X' : '');
    this.muteBox.setStrokeStyle(2, this.menuOptions.muted ? 0xffd36a : 0x78f0ff, this.menuOptions.muted ? 0.94 : 0.75);
    const selectedDifficulty = this.getDifficultyKey();
    this.difficultyButtons?.forEach((item) => {
      const selected = item.difficulty === selectedDifficulty;
      item.button.setFillStyle(selected ? 0x133443 : 0x061018, selected ? 0.98 : 0.92);
      item.button.setStrokeStyle(1, selected ? 0xffd36a : 0x78f0ff, selected ? 0.94 : 0.62);
      item.label.setColor(selected ? '#ffd36a' : '#d9f4ff');
      item.label.setAlpha(selected ? 1 : 0.72);
    });
  }

  setVolumeFromPointer(pointer) {
    if (!this.optionsOpen || !this.volumeTrack) {
      return;
    }
    const localX = pointer.x - this.optionsPanel.x;
    const trackLeft = -84;
    const trackWidth = 252;
    const volume = Phaser.Math.Clamp((localX - trackLeft) / trackWidth, 0, 1);
    this.menuOptions.masterVolume = Math.round(volume * 100) / 100;
    this.menuOptions.muted = this.menuOptions.masterVolume <= 0;
    this.saveMenuOptions();
    this.applyMasterVolume();
    this.refreshOptionsPanel();
  }

  handleOptionsPointerMove(pointer) {
    if (this.draggingVolume) {
      this.setVolumeFromPointer(pointer);
    }
  }

  handleOptionsPointerUp() {
    this.draggingVolume = false;
  }

  applyMasterVolume() {
    if (!this.sound || !this.menuOptions) {
      return;
    }
    const volume = this.menuOptions.muted ? 0 : Phaser.Math.Clamp(Number(this.menuOptions.masterVolume ?? 1), 0, 1);
    this.sound.volume = volume;
  }

  handleOptionsKeyDown(event) {
    if (!this.optionsOpen) {
      return;
    }
    if (event.code === 'Escape') {
      this.closeOptionsPanel();
      return;
    }
    if (!this.seedInputActive) {
      return;
    }
    if (event.code === 'Enter') {
      this.seedInputActive = false;
      this.saveMenuOptions();
      this.refreshOptionsPanel();
      return;
    }
    if (event.code === 'Backspace') {
      this.menuOptions.seed = this.menuOptions.seed.slice(0, -1);
      this.saveMenuOptions();
      this.refreshOptionsPanel();
      return;
    }
    if (event.key?.length === 1 && this.menuOptions.seed.length < 48 && /[a-zA-Z0-9:_-]/.test(event.key)) {
      this.menuOptions.seed += event.key;
      this.saveMenuOptions();
      this.refreshOptionsPanel();
    }
  }

  positionOptionMenu() {
    const { width, height } = this.scale;
    this.optionContainer?.setPosition(width * 0.755, height * 0.57 + 40);
  }

  selectOption(index) {
    this.selectedOption = Phaser.Math.Wrap(index, 0, MENU_OPTIONS.length);
    this.optionTexts?.forEach((text, i) => {
      const selected = i === this.selectedOption;
      text.setText(`${selected ? '> ' : '  '}${MENU_OPTIONS[i]}`);
      text.setColor(selected ? '#b8c6ca' : '#5f8b94');
      text.setAlpha(selected ? 1 : 0.72);
      text.setShadow(0, 0, selected ? '#9ff7ff' : '#2b7b86', selected ? 8 : 3, true, true);
    });
  }

  activateSelectedOption() {
    this.activateOption(this.selectedOption);
  }

  activateOption(index) {
    this.selectOption(index);
    if (index === 0) {
      this.startGame();
    } else if (index === 1) {
      this.openOptionsPanel();
    } else if (index === 2) {
      this.openDroidIndexPanel();
    } else if (index === 3) {
      this.openBriefingPanel();
    } else if (index === 4) {
      this.openCreditsPanel();
    } else if (index === 5) {
      window.parent?.postMessage({ type: 'wingtip:back-to-arcade' }, window.location.origin);
    }
  }

  drawMenuGlints(time) {
    if (!this.optionGlint || !this.optionTexts?.length) {
      return;
    }
    this.optionGlint.clear();
    const selected = this.optionTexts[this.selectedOption];
    const cycle = 2400;
    const progress = (time % cycle) / cycle;
    if (progress > 0.22) {
      return;
    }
    const t = progress / 0.22;
    const alpha = Math.sin(t * Math.PI) * 0.5;
    const x = -10 + t * Math.max(180, selected.width + 28);
    const y = selected.y;
    this.optionGlint.fillStyle(0xffffff, alpha);
    this.optionGlint.fillRect(x, y - 11, 2, 22);
    this.optionGlint.fillStyle(0xaed7dd, alpha * 0.28);
    this.optionGlint.fillPoints([
      { x: x - 9, y: y - 12 },
      { x: x - 2, y: y - 12 },
      { x: x - 11, y: y + 12 },
      { x: x - 18, y: y + 12 }
    ], true);
  }

  createSystemLabels() {
    this.labelContainer = this.add.container(0, 0);
    this.labelContainer.setDepth(10);
    this.topLabels = [
      { text: this.add.text(0, 0, 'PLASMODYNE SYSTEMS', this.smallLabelStyle()), y: 0 },
      { text: this.add.text(0, 19, 'INFLUENCE PROTOCOL', this.smallLabelStyle()), y: 19 },
      { text: this.add.text(0, 38, 'SERIES: ZERO ZERO ONE', this.smallLabelStyle()), y: 38 },
      { text: this.add.text(0, 57, `VERSION: ${SOFTWARE_VERSION}`, this.smallLabelStyle()), y: 57 }
    ];
    this.bottomLabels = [
      { text: this.add.text(0, 0, 'STATUS', this.smallLabelStyle()), y: 0 },
      { text: this.add.text(0, 23, 'LINK: ACTIVE', this.smallLabelStyle()), y: 23 },
      { text: this.add.text(0, 46, 'BODY: ZERO ZERO ONE', this.smallLabelStyle()), y: 46 },
      { text: this.add.text(0, 69, 'SIGNAL: STABLE', this.smallLabelStyle()), y: 69 }
    ];
    this.labelContainer.add([...this.topLabels, ...this.bottomLabels].map((entry) => entry.text));
  }

  smallLabelStyle() {
    return uiTextStyle({
      fontFamily: '"Arbedo", "Grisha", "MoonRunner", "VakultaTrial", sans-serif',
      fontSize: '11px',
      color: '#2d7f8b',
      fontStyle: '900'
    });
  }

  positionSystemLabels() {
    const { height } = this.scale;
    this.topLabels?.forEach((entry) => entry.text.setPosition(58, 44 + entry.y));
    this.bottomLabels?.forEach((entry) => entry.text.setPosition(42, height - 128 + entry.y));
  }

  layoutSystemLine() {
    if (!this.systemLineParts) {
      return;
    }
    const totalWidth = this.systemLineParts.reduce((sum, part) => sum + part.width, 0);
    let x = -totalWidth / 2;
    for (const part of this.systemLineParts) {
      part.setPosition(x, 0);
      x += part.width;
    }
  }

  shutdown() {
    this.scale.off('resize', this.handleResize, this);
    this.attractLayer?.destroy();
    this.titleLogo?.destroy();
    this.droidContainer?.destroy(true);
    this.optionContainer?.destroy(true);
    this.optionsPanel?.destroy(true);
    this.droidIndexPanel?.destroy(true);
    this.briefingPanel?.destroy(true);
    this.labelContainer?.destroy(true);
    this.input.keyboard.off('keydown', this.handleOptionsKeyDown, this);
    this.input.off('pointermove', this.handleOptionsPointerMove, this);
    this.input.off('pointerup', this.handleOptionsPointerUp, this);
    this.input.off('pointerdown', this.handleOptionsPointerDown, this);
  }
}
