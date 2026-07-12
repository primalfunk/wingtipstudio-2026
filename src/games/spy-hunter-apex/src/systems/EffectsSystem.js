import Phaser from 'phaser';
import StorageSystem from './StorageSystem.js';

export default class EffectsSystem {
  constructor(scene) {
    this.scene = scene;
  }

  playExplosion(x, y, size = 'medium', config = {}) {
    this.playExplosionSound(config.volume);
    const animationKey = `explosion-${size}`;
    const textureKey = `${animationKey}-sheet`;
    const sprite = this.scene.add.sprite(x, y, textureKey)
      .setDepth(config.depth ?? 70)
      .setScale(config.scale ?? 1)
      .play(animationKey);

    sprite.once('animationcomplete', () => {
      sprite.destroy();
      if (config.smoke !== false) {
        this.playSmoke(x, y, {
          scale: (config.smokeScale ?? config.scale ?? 1) * 0.9,
          depth: (config.depth ?? 70) - 1,
        });
      }
      config.onComplete?.();
    });
  }

  playExplosionSound(volume = 0.68) {
    if (this.scene.isAttract
      || !StorageSystem.loadSettings().audioEnabled
      || !this.scene.sound
      || !this.scene.cache.audio.exists('sfx-explosion')) {
      return;
    }

    const settings = StorageSystem.loadSettings();
    const scaledVolume = volume
      * 0.25
      * Phaser.Math.Clamp(settings.mainVolume ?? 1, 0, 1)
      * Phaser.Math.Clamp(settings.sfxVolume ?? 1, 0, 1);
    this.scene.sound.play('sfx-explosion', { volume: scaledVolume });
  }

  playSmoke(x, y, config = {}) {
    const sprite = this.scene.add.sprite(x, y, 'smoke-linger-sheet')
      .setDepth(config.depth ?? 60)
      .setScale(config.scale ?? 1)
      .setAlpha(0.86)
      .play('smoke-linger');

    sprite.once('animationcomplete', () => sprite.destroy());
  }
}
