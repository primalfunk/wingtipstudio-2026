import Phaser from 'phaser';
import { COLORS, SHIP_GENERATION } from '../data/constants.js';
import { UI_THEME } from '../ui/UiTheme.js';
import { LOGO_KEYS } from '../ui/LogoAssets.js';

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  create(data = {}) {
    this.stats = data.stats ?? this.createFallbackStats(data.seed);
    this.seed = data.seed ?? this.stats.seed ?? SHIP_GENERATION.seed;
    this.cameras.main.setBackgroundColor('#05080c');

    const { width, height } = this.scale;
    const victory = this.stats.result === 'Victory';
    const title = victory ? 'SHIP SECURED' : 'INFLUENCE LOST';
    const logoKey = victory ? LOGO_KEYS.gold : LOGO_KEYS.grey;

    this.add.image(width / 2, victory ? 82 : 92, logoKey)
      .setDisplaySize(victory ? 150 : 118, victory ? 192 : 150)
      .setAlpha(victory ? 0.95 : 0.32);

    this.add.text(width / 2, victory ? 204 : 176, title, {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '42px',
      color: victory ? '#79f2c0' : '#ff6f61'
    }).setOrigin(0.5);

    const lines = [
      `RESULT: ${this.stats.result}`,
      `CAUSE: ${this.stats.cause || 'Run ended'}`,
      `SEED: ${this.stats.seed}`,
      `TIME: ${formatTime(this.stats.elapsedMs)}`,
      `DROIDS NEUTRALIZED: ${this.stats.droidsNeutralized} / ${this.stats.totalDroids}`,
      `DECKS SECURED: ${this.stats.decksCleared} / ${SHIP_GENERATION.deckCount}`,
      `ROOMS SECURED: ${this.stats.roomsCleared}`,
      `BODIES POSSESSED: ${this.stats.bodiesPossessed}`,
      `HIGHEST POSSESSED: ${String(this.stats.highestRankPossessed).padStart(3, '0')}`,
      `HIGHEST NEUTRALIZED: ${String(this.stats.highestRankNeutralized).padStart(3, '0')}`,
      `TRANSFERS: ${this.stats.transfersSucceeded} success / ${this.stats.transfersFailed} failed / ${this.stats.transfersAttempted} attempted`,
      `LONGEST BODY: ${this.stats.longestBodyId}`
    ];

    this.add.text(width / 2, victory ? 262 : 236, lines.join('\n'), {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '19px',
      color: COLORS.hudText,
      lineSpacing: 8,
      align: 'left'
    }).setOrigin(0.5, 0);

    this.add.text(width / 2, height - 90, 'Enter / Space: Restart Seed    N: New Seed    Esc: Menu', {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '17px',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.newSeedKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.N);
    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.enterKey) || Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.scene.start('GameScene', { seed: this.seed, difficulty: this.stats.difficulty });
    }
    if (Phaser.Input.Keyboard.JustDown(this.newSeedKey)) {
      this.scene.start('GameScene', { seed: `${SHIP_GENERATION.seed}-${Date.now()}`, difficulty: this.stats.difficulty });
    }
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
      this.scene.start('MainMenuScene');
    }
  }

  createFallbackStats(seed) {
    return {
      result: 'Defeat',
      cause: 'Run interrupted',
      seed: seed ?? SHIP_GENERATION.seed,
      elapsedMs: 0,
      droidsNeutralized: 0,
      totalDroids: 0,
      decksCleared: 0,
      roomsCleared: 0,
      bodiesPossessed: 0,
      highestRankPossessed: 1,
      highestRankNeutralized: 0,
      transfersAttempted: 0,
      transfersSucceeded: 0,
      transfersFailed: 0,
      longestBodyId: '001'
    };
  }
}
