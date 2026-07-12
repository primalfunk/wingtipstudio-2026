import Phaser from 'phaser';
import { InputManager } from '../systems/InputManager.js';
import { upgradeConfig } from '../config/upgrades.js';
import { difficultyModeOrder, getDifficultyMode, getNextDifficultyMode } from '../config/difficultyModes.js';
import { BackgroundRenderer } from '../systems/BackgroundRenderer.js';
import { visualConfig } from '../config/visuals.js';
import { VisualSettings } from '../systems/VisualSettings.js';
import { archiveFragments } from '../content/archiveFragments.js';
import { createPopupPanel } from '../ui/PopupPanel.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../config.js';
import { fontConfig } from '../config/fonts.js';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
    this.inputManager = null;
    this.isChoosingKit = false;
    this.prompt = null;
    this.kitText = null;
    this.backgroundRenderer = null;
    this.optionsText = null;
    this.profileManager = null;
    this.audioManager = null;
    this.profileStatsText = null;
    this.difficultySelector = null;
    this.difficultyHeader = null;
    this.difficultyTexts = [];
    this.overlayText = null;
    this.overlayPanel = null;
    this.titlePanel = null;
    this.prototypeText = null;
    this.classPanel = null;
    this.classTitle = null;
    this.terminalGraphics = null;
    this.crimsonPulse = null;
    this.commandText = null;
    this.commandTextValue = '';
    this.commandIndex = 0;
    this.commandCharacterIndex = 0;
    this.commandElapsedMs = 0;
    this.backgroundLabels = [];
    this.menuMode = 'main';
    this.resetPending = false;
    this.titleLetters = [];
    this.titleColorEvent = null;
  }

  create() {
    window.requestAnimationFrame(() => window.parent?.postMessage({ type: 'wingtip:game-ready' }, window.location.origin));
    this.resetRuntimeState();
    const gameState = this.registry.get('gameState');
    this.profileManager = this.registry.get('profileManager');
    this.audioManager = this.registry.get('audioManager');
    gameState.currentScene = 'MainMenuScene';
    gameState.mode = 'menu';
    this.audioManager?.playMusic(this, 'menu');

    this.cameras.main.setBackgroundColor('#05070d');
    this.backgroundRenderer = new BackgroundRenderer(this, { depth: -30 });
    this.createTerminalAtmosphere();
    this.titlePanel = createPopupPanel(this, { width: 980, height: 360, accent: 0x35dfff, alpha: 0.72, fill: 0x040a13 })
      .setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2)
      .setDepth(5);

    this.createAnimatedTitle(GAME_WIDTH / 2, 280);

    this.prototypeText = this.add.text(GAME_WIDTH / 2, 354, 'ARCHIVE RECOVERY PROTOCOL', {
      fontFamily: fontConfig.mono,
      fontSize: '18px',
      color: '#7cb7c7',
      align: 'center'
    }).setOrigin(0.5).setShadow(0, 0, '#35dfff', VisualSettings.reduceGlow ? 0 : 3);
    this.prototypeText.setLetterSpacing?.(1.8);

    this.prompt = this.add.text(GAME_WIDTH / 2, 442, 'PRESS ENTER TO RESTORE SIGNAL', {
      fontFamily: fontConfig.prompt,
      fontSize: '24px',
      color: '#e8fbff',
      align: 'center'
    }).setOrigin(0.5).setShadow(0, 0, '#35dfff', VisualSettings.reduceGlow ? 0 : 7);
    this.prompt.setLetterSpacing?.(1.2);

    this.commandText = this.add.text(GAME_WIDTH / 2, 492, '', {
      fontFamily: fontConfig.mono,
      fontSize: '15px',
      color: '#5e8893',
      align: 'center'
    }).setOrigin(0.5).setDepth(8).setAlpha(0.72);
    this.commandText.setLetterSpacing?.(1);

    this.optionsText = this.add.text(30, GAME_HEIGHT - 92, '', {
      fontFamily: fontConfig.mono,
      fontSize: '15px',
      color: '#8fb8c7',
      lineSpacing: 4
    }).setDepth(20).setVisible(false);
    this.updateOptionsText();
    this.profileStatsText = this.add.text(GAME_WIDTH - 32, GAME_HEIGHT - 118, '', {
      fontFamily: fontConfig.ui,
      fontSize: '15px',
      color: '#9bf4ff',
      align: 'right',
      lineSpacing: 4
    }).setOrigin(1, 0).setDepth(20);
    this.updateProfileStatsText();
    this.createDifficultySelector();

    this.tweens.add({
      targets: this.prompt,
      alpha: 0.35,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.inputManager = new InputManager(this);
    this.inputManager.onTypedCharacter((character) => {
      this.audioManager?.unlock(this);
      const lower = character.toLowerCase();
      if (lower === 'm') {
        VisualSettings.toggle('reduceMotion');
        this.updateOptionsText();
        return;
      }
      if (lower === 'g') {
        VisualSettings.toggle('reduceGlow');
        this.updateOptionsText();
        return;
      }
      if (lower === 'h') {
        VisualSettings.toggle('highContrast');
        this.updateOptionsText();
        return;
      }
      if (lower === 'x') {
        const nextScale = VisualSettings.textScale >= 1.2 ? 0.9 : VisualSettings.textScale + 0.1;
        VisualSettings.set({ textScale: Math.round(nextScale * 10) / 10 });
        this.updateOptionsText();
        return;
      }
      if (lower === 's') {
        VisualSettings.toggle('screenShake');
        this.updateOptionsText();
        return;
      }

      if (this.menuMode === 'profile') {
        if (this.resetPending && lower === 'y') {
          this.profileManager.resetProfile();
          this.audioManager?.playSfx(this, 'uiConfirm');
          VisualSettings.set(this.profileManager.profile.settings);
          this.resetPending = false;
          this.showProfileScreen('Profile reset. Local save recreated.');
        }
        return;
      }

      if (this.menuMode === 'archive') {
        return;
      }

      if (!this.isChoosingKit && lower === 'p') {
        this.showProfileScreen();
        this.audioManager?.playSfx(this, 'uiConfirm');
        return;
      }

      if (!this.isChoosingKit && lower === 'a') {
        this.showArchiveScreen();
        this.audioManager?.playSfx(this, 'uiConfirm');
        return;
      }
      if (!this.isChoosingKit && lower === 't') {
        this.audioManager?.playSfx(this, 'uiConfirm');
        this.scene.start('TutorialScene');
        return;
      }
      if (!this.isChoosingKit && lower === 'd') {
        this.cycleDifficulty();
        return;
      }

      if (!this.isChoosingKit || !['1', '2', '3', '4'].includes(character)) {
        return;
      }

      const kit = upgradeConfig.startingKits[Number(character) - 1];
      if (!this.profileManager.isKitUnlocked(kit.id)) {
        this.audioManager?.playSfx(this, 'uiCancel');
        this.prompt.setText(`${kit.name} locked     Escape Back`);
        return;
      }
      this.profileManager.setLastSelectedKit(kit.id);
      this.audioManager?.playSfx(this, 'uiConfirm');
      this.showKitSelection();
    });
    this.inputManager.onSpecialKey('Enter', () => {
      this.audioManager?.unlock(this);
      if (this.menuMode !== 'main') {
        return;
      }
      if (this.isChoosingKit) {
        const kitId = this.profileManager.profile.lastSelectedKit;
        const selectedKit = this.profileManager.isKitUnlocked(kitId) ? kitId : 'flow_runner';
        this.profileManager.setLastSelectedKit(selectedKit);
        this.audioManager?.playSfx(this, 'uiConfirm');
        this.scene.start('GameScene', { kitId: selectedKit });
        return;
      }

      this.audioManager?.playSfx(this, 'uiConfirm');
      this.showKitSelection();
    });
    this.inputManager.onSpecialKey('Escape', () => {
      this.audioManager?.unlock(this);
      if (this.menuMode === 'main') {
        if (this.isChoosingKit) {
          this.audioManager?.playSfx(this, 'uiCancel');
          this.hideKitSelection();
        }
        return;
      }
      this.audioManager?.playSfx(this, 'uiCancel');
      this.hideOverlay();
    });
    this.inputManager.onSpecialKey('Delete', () => {
      if (this.menuMode !== 'profile') {
        return;
      }
      this.resetPending = true;
      this.showProfileScreen('Press Y to confirm profile reset. Escape cancels.');
    });
  }

  resetRuntimeState() {
    this.isChoosingKit = false;
    this.menuMode = 'main';
    this.resetPending = false;
    this.commandTextValue = '';
    this.commandIndex = 0;
    this.commandCharacterIndex = 0;
    this.commandElapsedMs = 0;
    this.difficultyTexts = [];
    this.backgroundLabels = [];
    this.titleLetters = [];
    this.prompt = null;
    this.kitText = null;
    this.backgroundRenderer = null;
    this.optionsText = null;
    this.profileStatsText = null;
    this.difficultySelector = null;
    this.difficultyHeader = null;
    this.overlayText = null;
    this.overlayPanel = null;
    this.titlePanel = null;
    this.prototypeText = null;
    this.classPanel = null;
    this.classTitle = null;
    this.terminalGraphics = null;
    this.crimsonPulse = null;
    this.commandText = null;
    this.titleColorEvent = null;
  }

  createTerminalAtmosphere() {
    this.terminalGraphics = this.add.graphics().setDepth(4);
    this.crimsonPulse = this.add.rectangle(GAME_WIDTH / 2, 282, 1020, 84, 0x5c0d13, 0)
      .setDepth(4)
      .setBlendMode(Phaser.BlendModes.ADD);

    const labels = [
      ['RELAY NODE 04 // OFFLINE', 86, 142],
      ['SIGNAL LOSS: 99.7%', 955, 134],
      ['ARCHIVE INDEX CORRUPTED', 120, 612],
      ['CHANNEL STABILITY: CRITICAL', 884, 596],
      ['LISTENING...', 546, 118],
      ['DEAD BAND DETECTED', 678, 636],
      ['RECOVERY BUFFER EMPTY', 986, 342]
    ];

    this.backgroundLabels = labels.map(([text, x, y]) => this.add.text(x, y, text, {
      fontFamily: fontConfig.mono,
      fontSize: '13px',
      color: '#6bb7c8'
    }).setAlpha(visualConfig.terminal.backgroundLabelOpacity).setDepth(2));
  }

  createAnimatedTitle(centerX, y) {
    const title = 'DEAD CHANNELS';
    const palette = ['#050000', '#180204', '#2a0508', '#3d080d', '#5c0d13', '#7a1118', '#9c1720'];
    const style = {
      fontFamily: fontConfig.title,
      fontSize: '72px',
      fontStyle: 'bold',
      color: '#ffffff',
      align: 'center'
    };

    const letters = [...title].map((character, index) => {
      const letter = this.add.text(0, y, character, style)
        .setOrigin(0.5)
        .setDepth(8)
        .setAlpha(character === ' ' ? 0 : 1);
      letter.titleColorIndex = index;
      return letter;
    });

    const totalWidth = letters.reduce((sum, letter) => sum + letter.width, 0);
    let x = centerX - totalWidth / 2;
    letters.forEach((letter) => {
      letter.setX(x + letter.width / 2);
      letter.baseX = letter.x;
      x += letter.width;
    });

    this.titleLetters = letters;
    this.updateTitleColors(palette, false);

    if (!VisualSettings.reduceMotion && !VisualSettings.highContrast) {
      this.titleColorEvent = this.time.addEvent({
        delay: 1700,
        loop: true,
        callback: () => this.updateTitleColors(palette, true)
      });
    }
  }

  updateTitleColors(palette, animated = false) {
    const t = this.time.now * 0.0012;
    this.titleLetters.forEach((letter, index) => {
      if (letter.text === ' ') {
        return;
      }
      const color = VisualSettings.highContrast
        ? '#ffffff'
        : palette[Math.abs(Math.floor(t + index * 1.15 + Math.sin(t * 0.55 + index) * 1.4)) % palette.length];
      const titleGlitch = !VisualSettings.reduceMotion && Math.random() < visualConfig.terminal.titleGlitchChance;
      const targetScale = VisualSettings.reduceMotion ? 1 : 1 + Math.sin(t * 0.9 + index) * 0.018;
      const targetX = letter.baseX + (titleGlitch ? Phaser.Math.Between(-2, 2) : 0);

      if (!animated || VisualSettings.reduceMotion || VisualSettings.highContrast) {
        this.applyTitleLetterColor(letter, color, index);
        letter.setScale(targetScale);
        letter.setX(targetX);
        return;
      }

      const startColor = Phaser.Display.Color.HexStringToColor(letter.titleColor ?? '#050000');
      const endColor = Phaser.Display.Color.HexStringToColor(color);
      letter.titleTween?.stop();
      letter.titleTween = this.tweens.addCounter({
        from: 0,
        to: 100,
        duration: 1250 + (index % 4) * 110,
        ease: 'Sine.easeInOut',
        onUpdate: (tween) => {
          const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(startColor, endColor, 100, tween.getValue());
          const mixedColor = Phaser.Display.Color.RGBToString(mixed.r, mixed.g, mixed.b, 0, '#');
          this.applyTitleLetterColor(letter, mixedColor, index);
          letter.setScale(Phaser.Math.Linear(letter.scaleX, targetScale, 0.08));
          letter.setX(Phaser.Math.Linear(letter.x, targetX, 0.2));
        }
      });
    });
  }

  applyTitleLetterColor(letter, color, index) {
    letter.titleColor = color;
    letter.setColor(color);
    const shadowColor = color === '#050000' ? '#5c0d13' : color;
    letter.setShadow(0, 0, shadowColor, VisualSettings.reduceGlow ? 0 : 14 + ((index % 3) * 3));
  }

  update(time, delta) {
    this.backgroundRenderer?.update({
      biome: 'deadRelay',
      instability: 18,
      flow: 10
    }, delta);
    this.updateTerminalAtmosphere(time, delta);
    this.updateCommandStrip(delta);
  }

  updateTerminalAtmosphere(time, delta) {
    if (!this.terminalGraphics) {
      return;
    }

    const terminal = visualConfig.terminal;
    const motion = VisualSettings.reduceMotion ? 0 : time / 1000;
    this.terminalGraphics.clear();

    this.terminalGraphics.lineStyle(1, 0x7cdfff, terminal.scanlineOpacity);
    for (let y = 0; y < GAME_HEIGHT; y += 6) {
      this.terminalGraphics.lineBetween(0, y, GAME_WIDTH, y);
    }

    const bandY = VisualSettings.reduceMotion ? 220 : ((motion * 34) % (GAME_HEIGHT + 120)) - 60;
    this.terminalGraphics.fillStyle(0x9bf4ff, 0.018);
    this.terminalGraphics.fillRect(0, bandY, GAME_WIDTH, 28);

    this.terminalGraphics.lineStyle(1, 0x35dfff, terminal.waveformOpacity);
    for (let row = 0; row < 4; row += 1) {
      const y = 128 + row * 128;
      let previousX = 0;
      let previousY = y;
      for (let x = 0; x <= GAME_WIDTH; x += 32) {
        const waveY = y + Math.sin((x * 0.012) + motion * (0.18 + row * 0.04)) * (8 + row * 2);
        this.terminalGraphics.lineBetween(previousX, previousY, x, waveY);
        previousX = x;
        previousY = waveY;
      }
    }

    this.terminalGraphics.lineStyle(1, 0x5c0d13, 0.16);
    this.terminalGraphics.strokeCircle(162, 238, 34 + Math.sin(motion) * 2);
    this.terminalGraphics.strokeCircle(1128, 422, 42 + Math.cos(motion * 0.8) * 2);
    this.terminalGraphics.lineBetween(162, 238, 1128, 422);

    if (!VisualSettings.reduceMotion && Math.random() < 0.18) {
      this.terminalGraphics.fillStyle(0xffffff, terminal.noiseOpacity);
      for (let i = 0; i < 5; i += 1) {
        this.terminalGraphics.fillRect(Phaser.Math.Between(0, GAME_WIDTH), Phaser.Math.Between(0, GAME_HEIGHT), Phaser.Math.Between(1, 3), 1);
      }
    }

    const pulseAlpha = VisualSettings.reduceMotion ? 0 : Math.max(0, Math.sin((time % terminal.crimsonPulseIntervalMs) / terminal.crimsonPulseIntervalMs * Math.PI)) * 0.05;
    this.crimsonPulse?.setAlpha(pulseAlpha);
    const flicker = !VisualSettings.reduceMotion && Math.random() < terminal.frameFlickerChance;
    const titleVisible = this.menuMode === 'main' && !this.isChoosingKit;
    this.titlePanel?.setAlpha(titleVisible ? (flicker ? 0.58 : 0.72) : 0);
    this.titlePanel?.setPosition(GAME_WIDTH / 2 + (titleVisible && flicker ? Phaser.Math.FloatBetween(-0.7, 0.7) : 0), GAME_HEIGHT / 2);
  }

  updateCommandStrip(delta) {
    if (!this.commandText || this.menuMode !== 'main' || this.isChoosingKit) {
      return;
    }

    const commands = [
      'RESTORE SIGNAL',
      'RECOVER ARCHIVE',
      'OPEN DEAD CHANNEL',
      'DECODE TRANSMISSION',
      'SYNC RELAY NODE',
      'PURGE STATIC',
      'REBUILD INDEX'
    ];
    this.commandElapsedMs += delta;
    if (this.commandElapsedMs < visualConfig.terminal.commandTypingSpeedMs) {
      return;
    }

    this.commandElapsedMs = 0;
    const command = commands[this.commandIndex];
    this.commandCharacterIndex += 1;
    if (this.commandCharacterIndex > command.length + 22) {
      this.commandIndex = (this.commandIndex + 1) % commands.length;
      this.commandCharacterIndex = 0;
      return;
    }

    const visible = command.slice(0, Math.min(command.length, this.commandCharacterIndex));
    const corrupt = !VisualSettings.reduceMotion && Math.random() < visualConfig.terminal.commandCorruptChance;
    const suffix = this.commandCharacterIndex <= command.length ? '_' : '';
    const text = corrupt && visible.length > 2
      ? `${visible.slice(0, -1)}${['#', '%', '/', '?'][Phaser.Math.Between(0, 3)]}${suffix}`
      : `${visible}${suffix}`;
    this.commandText.setText(`> ${text}`);
  }

  showKitSelection() {
    this.isChoosingKit = true;
    this.setTitleAreaVisible(false);
    this.profileStatsText?.setVisible(false);
    this.difficultySelector?.setVisible(false);

    if (!this.classPanel) {
      this.classPanel = createPopupPanel(this, { width: 760, height: 430, accent: 0x9c1720, alpha: 0.94 })
        .setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2)
        .setDepth(34)
        .setAlpha(0);
      this.classTitle = this.add.text(GAME_WIDTH / 2, 252, 'CHOOSE CLASS', {
        fontFamily: fontConfig.title,
        fontSize: '34px',
        color: '#fff2f2',
        align: 'center'
      }).setOrigin(0.5).setDepth(35).setAlpha(0).setShadow(0, 0, '#7a1118', VisualSettings.reduceGlow ? 0 : 10);
    }

    if (!this.kitText) {
      this.kitText = this.add.text(GAME_WIDTH / 2, 326, '', {
        fontFamily: fontConfig.ui,
        fontSize: '23px',
        color: '#f4d7d7',
        align: 'center',
        lineSpacing: 18
      }).setOrigin(0.5, 0).setDepth(36);
    }

    this.classPanel.setAlpha(1);
    this.classTitle.setAlpha(1);
    this.kitText.setAlpha(1).setPosition(GAME_WIDTH / 2, 326).setDepth(36);
    this.commandText?.setAlpha(0);
    this.prompt.setText('1-4 SELECT CLASS     ENTER CONFIRM     ESCAPE BACK')
      .setPosition(GAME_WIDTH / 2, 606)
      .setVisible(true)
      .setDepth(36);

    this.kitText.setText([
      ...upgradeConfig.startingKits.map((kit, index) => {
        const locked = !this.profileManager.isKitUnlocked(kit.id);
        const selected = this.profileManager.profile.lastSelectedKit === kit.id;
        return `${selected ? '> ' : '  '}[${index + 1}] ${kit.name}${locked ? ' LOCKED' : ''}${selected ? ' <' : '  '}`;
      })
    ]);
  }

  hideKitSelection() {
    this.isChoosingKit = false;
    this.classPanel?.setAlpha(0);
    this.classTitle?.setAlpha(0);
    this.kitText?.setAlpha(0);
    this.prompt.setText('PRESS ENTER TO RESTORE SIGNAL')
      .setPosition(GAME_WIDTH / 2, 440)
      .setVisible(true)
      .setDepth(8);
    this.setTitleAreaVisible(true);
    this.commandText?.setAlpha(0.72);
    this.profileStatsText?.setVisible(true);
    this.difficultySelector?.setVisible(true);
  }

  setTitleAreaVisible(visible) {
    const alpha = visible ? 1 : 0;
    this.titlePanel?.setAlpha(visible ? 0.78 : 0);
    this.prototypeText?.setAlpha(alpha);
    this.commandText?.setAlpha(visible ? 0.72 : 0);
    this.titleLetters.forEach((letter) => letter.setAlpha(letter.text === ' ' ? 0 : alpha));
  }

  updateOptionsText() {
    this.optionsText?.setText([
      'VISUAL OPTIONS',
      ...VisualSettings.getTextLines(),
      `D Difficulty: ${getDifficultyMode(this.profileManager?.profile.settings.difficultyMode).label}`,
      'Enter Start   T Tutorial   P Profile   A Archive'
    ]);
  }

  updateProfileStatsText() {
    const profile = this.profileManager?.profile;
    if (!profile) {
      return;
    }

    this.profileStatsText?.setText([
      'SYSTEM STATUS',
      `BEST RUN     ${profile.bestScore}`,
      `RUNS         ${profile.totalRuns}`,
      `WINS         ${profile.completedRuns}`,
      `ARCHIVE      ${profile.archiveFragmentsCollected.length}/${archiveFragments.length}`,
      `MODIFIERS    ${profile.unlockedModifiers.length}`,
      `SPEED        ${getDifficultyMode(profile.settings.difficultyMode).label.toUpperCase()} ${getDifficultyMode(profile.settings.difficultyMode).targetWpm} WPM`
    ]);
  }

  createDifficultySelector() {
    this.difficultySelector = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT - 82).setDepth(21);
    this.difficultyHeader = this.add.text(0, -25, 'SELECT [D]IFFICULTY BELOW', {
      fontFamily: fontConfig.mono,
      fontSize: '13px',
      color: '#6f98a4',
      align: 'center'
    }).setOrigin(0.5);
    this.difficultyHeader.setLetterSpacing?.(1.2);
    this.difficultySelector.add(this.difficultyHeader);

    const spacing = 134;
    const startX = -((difficultyModeOrder.length - 1) * spacing) / 2;
    this.difficultyTexts = difficultyModeOrder.map((modeId, index) => {
      const mode = getDifficultyMode(modeId);
      const text = this.add.text(startX + index * spacing, 6, '', {
        fontFamily: fontConfig.ui,
        fontSize: ['professional', 'impossible'].includes(modeId) ? '13px' : '15px',
        color: mode.color,
        align: 'center'
      }).setOrigin(0.5);
      text.setLetterSpacing?.(0.8);
      this.difficultySelector.add(text);
      return { modeId, text };
    });
    this.updateDifficultySelector();
  }

  updateDifficultySelector() {
    const selectedId = this.profileManager?.profile.settings.difficultyMode ?? 'easy';
    const selected = getDifficultyMode(selectedId);
    for (const { modeId, text } of this.difficultyTexts) {
      const mode = getDifficultyMode(modeId);
      const isSelected = mode.id === selected.id;
      text
        .setText(`${isSelected ? '>' : ' '} ${mode.label.toUpperCase()} ${mode.targetWpm} ${isSelected ? '<' : ' '}`)
        .setColor(isSelected ? mode.color : '#54717b')
        .setAlpha(isSelected ? 1 : 0.58)
        .setScale(isSelected ? 1.08 : 1);
      text.setShadow(0, 0, mode.color, VisualSettings.reduceGlow ? 0 : isSelected ? 8 : 2);
    }
  }

  cycleDifficulty() {
    const current = this.profileManager.profile.settings.difficultyMode ?? 'easy';
    const next = getNextDifficultyMode(current);
    this.profileManager.updateSettings({ difficultyMode: next });
    VisualSettings.set(this.profileManager.profile.settings);
    this.updateOptionsText();
    this.updateProfileStatsText();
    this.updateDifficultySelector();
    this.audioManager?.playSfx(this, 'uiConfirm', { volume: 0.55 });
  }

  showProfileScreen(message = '') {
    this.menuMode = 'profile';
    this.isChoosingKit = false;
    this.profileStatsText?.setVisible(false);
    this.difficultySelector?.setVisible(false);
    this.kitText?.setAlpha(0);
    const profile = this.profileManager.profile;
    const recentRuns = profile.runHistory.slice(0, 5)
      .map((run) => `${run.result.toUpperCase()} ${run.score} seed:${run.seed}`)
      .join('\n') || 'none';
    const unlockedCounts = [
      `Classes ${profile.unlockedKits.length}/${upgradeConfig.startingKits.length}`,
      `Powerups ${profile.unlockedPowerups.length}`,
      `Upgrades ${profile.unlockedUpgrades.length}`,
      `Modifiers ${profile.unlockedModifiers.length}`
    ].join('   ');

    this.showOverlay([
      'LOCAL PROFILE',
      '',
      `Profile: ${profile.profileId}`,
      `Runs ${profile.totalRuns}   Wins ${profile.completedRuns}   Losses ${profile.failedRuns}`,
      `Best Score ${profile.bestScore}   Best WPM ${profile.bestWpm}   Best Accuracy ${profile.bestAccuracy}%`,
      `Best Flow ${profile.bestFlow}   Best Seed ${profile.bestRunSeed || 'none'}`,
      `Archives ${profile.archiveFragmentsCollected.length}/${archiveFragments.length}`,
      unlockedCounts,
      '',
      'RECENT RUNS',
      recentRuns,
      '',
      'Delete: Reset profile   Escape: Menu',
      message
    ].filter(Boolean).join('\n'));
  }

  showArchiveScreen() {
    this.menuMode = 'archive';
    this.isChoosingKit = false;
    this.profileStatsText?.setVisible(false);
    this.difficultySelector?.setVisible(false);
    this.kitText?.setAlpha(0);
    const collection = this.profileManager.getArchiveCollection();
    const lines = collection.slice(0, 25).map((fragment) => (
      fragment.collected ? fragment.text : `${fragment.id.toUpperCase()}: ???`
    ));

    this.showOverlay([
      'ARCHIVE COLLECTION',
      '',
      `Collected ${this.profileManager.profile.archiveFragmentsCollected.length}/${archiveFragments.length}`,
      '',
      ...lines,
      '',
      'Escape: Menu'
    ].join('\n'));
  }

  showOverlay(text) {
    this.prompt.setText('TERMINAL QUERY');
    this.commandText?.setAlpha(0);
    if (!this.overlayPanel) {
      this.overlayPanel = createPopupPanel(this, { width: 980, height: 600, accent: 0x35dfff, alpha: 0.94 })
        .setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2)
        .setDepth(59)
        .setAlpha(0);
    }
    if (!this.overlayText) {
      this.overlayText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', {
        fontFamily: fontConfig.ui,
        fontSize: '16px',
        color: '#f5fbff',
        align: 'left',
        padding: { x: 26, y: 22 },
        lineSpacing: 4
      }).setOrigin(0.5).setDepth(60);
    }
    this.overlayPanel.setAlpha(1);
    this.overlayText.setText(text).setAlpha(1);
  }

  hideOverlay() {
    this.menuMode = 'main';
    this.resetPending = false;
    this.overlayPanel?.setAlpha(0);
    this.overlayText?.setAlpha(0);
    this.profileStatsText?.setVisible(true);
    this.difficultySelector?.setVisible(true);
    this.prompt.setText('PRESS ENTER TO RESTORE SIGNAL');
    this.commandText?.setAlpha(0.72);
    this.updateProfileStatsText();
  }

  getKitName(kitId) {
    return upgradeConfig.startingKits.find((kit) => kit.id === kitId)?.name ?? 'Flow Runner';
  }

  shutdownInput() {
    if (this.inputManager) {
      this.inputManager.destroy();
      this.inputManager = null;
    }

    this.backgroundRenderer?.destroy();
    this.backgroundRenderer = null;
    this.titleColorEvent?.remove(false);
    this.titleColorEvent = null;
  }

  shutdown() {
    this.shutdownInput();
  }
}
