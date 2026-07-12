import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import PreloadScene from './scenes/PreloadScene.js';
import TitleScene from './scenes/TitleScene.js';
import OverworldScene from './scenes/OverworldScene.js';
import BriefingScene from './scenes/BriefingScene.js';
import GameScene from './scenes/GameScene.js';
import DebriefScene from './scenes/DebriefScene.js';
import TransmissionScene from './scenes/TransmissionScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import VictoryScene from './scenes/VictoryScene.js';
import DisplaySizeSystem from './systems/DisplaySizeSystem.js';
import { GAME_HEIGHT, GAME_WIDTH, setGameSize } from './data/tuning.js';
import './style.css';

setGameSize(window.visualViewport?.width ?? window.innerWidth, window.visualViewport?.height ?? window.innerHeight);

const harnessParams = new URLSearchParams(window.location.search);
const harnessReportUrl = harnessParams.get('reportUrl');
if (harnessReportUrl) {
  window.__signalHunterHarnessReport = (payload) => {
    try {
      navigator.sendBeacon?.(harnessReportUrl, JSON.stringify(payload));
    } catch {
      // Harness diagnostics should never affect gameplay startup.
    }
  };
  window.addEventListener('error', (event) => {
    window.__signalHunterHarnessReport({
      event: 'error',
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      stack: event.error?.stack,
    });
  });
  window.addEventListener('unhandledrejection', (event) => {
    window.__signalHunterHarnessReport({
      event: 'unhandledrejection',
      message: String(event.reason?.message ?? event.reason ?? 'unknown'),
    });
  });
  window.__signalHunterHarnessReport({ event: 'main-loaded' });
}

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#111316',
  pixelArt: true,
  roundPixels: true,
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: 'game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [
    BootScene,
    PreloadScene,
    TitleScene,
    OverworldScene,
    BriefingScene,
    GameScene,
    DebriefScene,
    TransmissionScene,
    VictoryScene,
    GameOverScene,
  ],
};

const game = new Phaser.Game(config);
const displaySizeSystem = new DisplaySizeSystem(game);
displaySizeSystem.start();
window.__spyHuntedDisplaySizeSystem = displaySizeSystem;
