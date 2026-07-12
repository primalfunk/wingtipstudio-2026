import Phaser from 'phaser';
import { GAME_CONFIG } from './data/constants.js';
import { BootScene } from './scenes/BootScene.js';
import { MainMenuScene } from './scenes/MainMenuScene.js';
import { GameScene } from './scenes/GameScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { GeneratorReviewScene } from './devtools/GeneratorReviewScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: GAME_CONFIG.backgroundColor,
  width: GAME_CONFIG.width,
  height: GAME_CONFIG.height,
  pixelArt: false,
  roundPixels: false,
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
      gravity: { x: 0, y: 0 }
    }
  },
  scene: [BootScene, MainMenuScene, GameScene, GameOverScene, GeneratorReviewScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

new Phaser.Game(config);
