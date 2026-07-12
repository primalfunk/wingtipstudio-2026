import { audioConfig } from '../config/audio.js';

export class AudioManager {
  constructor(config = audioConfig) {
    this.config = config;
    this.currentMusic = null;
    this.currentMusicKey = null;
    this.requestedMusicKey = null;
  }

  playMusic(scene, key, { restart = false } = {}) {
    if (!scene?.sound || !this.hasAudio(scene, `music:${key}`)) {
      return;
    }

    this.unlock(scene);
    this.requestedMusicKey = key;

    if (!restart && this.currentMusicKey === key && this.currentMusic?.isPlaying) {
      return;
    }

    const nextMusic = scene.sound.add(`music:${key}`, {
      loop: true,
      volume: 0
    });

    nextMusic.play();
    scene.tweens.add({
      targets: nextMusic,
      volume: this.config.musicVolume,
      duration: this.config.crossfadeMs,
      ease: 'Sine.easeInOut'
    });

    const previousMusic = this.currentMusic;
    if (previousMusic) {
      scene.tweens.add({
        targets: previousMusic,
        volume: 0,
        duration: this.config.crossfadeMs,
        ease: 'Sine.easeInOut',
        onComplete: () => previousMusic.destroy()
      });
    }

    this.currentMusic = nextMusic;
    this.currentMusicKey = key;
  }

  stopMusic(scene, fadeMs = this.config.crossfadeMs) {
    if (!this.currentMusic) {
      return;
    }

    const music = this.currentMusic;
    this.currentMusic = null;
    this.currentMusicKey = null;
    scene?.tweens?.add({
      targets: music,
      volume: 0,
      duration: fadeMs,
      ease: 'Sine.easeOut',
      onComplete: () => music.destroy()
    });
  }

  playSfx(scene, key, options = {}) {
    const audioKey = `sfx:${key}`;
    if (!scene?.sound || !this.hasAudio(scene, audioKey)) {
      return;
    }

    this.unlock(scene);
    scene.sound.play(audioKey, {
      volume: options.volume ?? this.config.sfxVolume,
      detune: options.detune ?? 0,
      rate: options.rate ?? 1
    });
  }

  unlock(scene) {
    const context = scene?.sound?.context;
    if (context?.state === 'suspended') {
      context.resume();
    }
  }

  hasAudio(scene, key) {
    return scene.cache.audio.exists(key);
  }
}
