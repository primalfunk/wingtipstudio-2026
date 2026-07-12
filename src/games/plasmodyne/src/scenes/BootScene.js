import Phaser from 'phaser';
import { createFixtureTextures } from '../graphics/fixtureTextures.js';
import { createDroidSeriesAnimations, preloadDroidSpritesheets } from '../graphics/droidAnimationAssets.js';
import { createDeckPatternTextures } from '../graphics/deckPatternTextures.js';
import { loadUiFonts } from '../ui/fonts/FontLoader.js';
import { preloadGameAudio } from '../systems/GameAudio.js';
import { preloadLogoAssets } from '../ui/LogoAssets.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    preloadDroidSpritesheets(this);
    preloadGameAudio(this);
    preloadLogoAssets(this);
  }

  async create() {
    await loadUiFonts();
    createDroidSeriesAnimations(this);
    createFixtureTextures(this);
    createDeckPatternTextures(this);

    const params = new URLSearchParams(window.location.search);
    if (params.get('scene') === 'generator-review') {
      this.scene.start('GeneratorReviewScene', { seed: params.get('seed') ?? undefined });
      return;
    }
    this.scene.start('MainMenuScene');
  }
}
