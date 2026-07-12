import Phaser from 'phaser';
import { audioConfig } from '../config/audio.js';
import { AudioManager } from '../systems/AudioManager.js';
import { GameState } from '../systems/GameState.js';
import { ProfileManager } from '../systems/ProfileManager.js';
import { VisualSettings } from '../systems/VisualSettings.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    Object.entries(audioConfig.music).forEach(([key, filename]) => {
      this.load.audio(`music:${key}`, `${audioConfig.basePath}${filename}`);
    });
    Object.entries(audioConfig.sfx).forEach(([key, filename]) => {
      this.load.audio(`sfx:${key}`, `${audioConfig.basePath}${filename}`);
    });
  }

  create() {
    const profileManager = new ProfileManager();
    const profile = profileManager.load();
    VisualSettings.set(profile.settings);
    VisualSettings.onChange((settings) => profileManager.updateSettings(settings));
    this.registry.set('profileManager', profileManager);
    this.registry.set('gameState', new GameState());
    this.registry.set('audioManager', new AudioManager());
    this.scene.start('MainMenuScene');
  }
}
