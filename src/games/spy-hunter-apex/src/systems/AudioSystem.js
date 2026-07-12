import Phaser from 'phaser';
import StorageSystem from './StorageSystem.js';

export default class AudioSystem {
  constructor(scene) {
    this.scene = scene;
    this.settings = StorageSystem.loadSettings();
    this.enabled = this.settings.audioEnabled;
  }

  toggle() {
    this.enabled = !this.enabled;
    this.settings = StorageSystem.saveSettings({ audioEnabled: this.enabled });
    if (!this.enabled) {
      this.stopMusic('music-main-menu');
      this.stopMusic('music-driving');
    }
    return this.enabled;
  }

  playMainMenuMusic() {
    this.playMusic('music-main-menu', { volume: 0.42 });
  }

  playDrivingMusic() {
    this.stopMusic('music-main-menu');
    this.playMusic('music-driving', { volume: 0.38 });
  }

  stopDrivingMusic() {
    this.stopMusic('music-driving');
  }

  playConfirm() {
    this.playSample('sfx-confirm', { volume: 0.65 });
  }

  playFire() {
    if (this.playSample('sfx-laser', { volume: 0.58, seek: 0 })) {
      return;
    }
    this.playTone(420, 0.035, 'square', 0.035);
  }

  playCollision() {
    if (this.playSample('sfx-crash', { volume: 0.68 })) {
      return;
    }
    this.playTone(86, 0.12, 'sawtooth', 0.055);
    this.scene.time.delayedCall(35, () => this.playTone(54, 0.11, 'square', 0.035));
  }

  playSupport(isDecoy = false) {
    if (isDecoy) {
      this.playTone(220, 0.06, 'triangle', 0.04);
      this.scene.time.delayedCall(75, () => this.playTone(180, 0.1, 'sawtooth', 0.025));
      return;
    }

    this.playTone(520, 0.06, 'triangle', 0.035);
    this.scene.time.delayedCall(80, () => this.playTone(720, 0.07, 'triangle', 0.035));
  }

  playDestroyed() {
    this.playTone(760, 0.045, 'square', 0.03);
    this.scene.time.delayedCall(50, () => this.playTone(340, 0.08, 'sawtooth', 0.035));
  }

  playLostLife() {
    if (this.playSample('sfx-lost-life', { volume: 0.76 })) {
      return;
    }
    this.playTone(360, 0.08, 'triangle', 0.045);
    this.scene.time.delayedCall(95, () => this.playTone(220, 0.12, 'triangle', 0.04));
  }

  playGameOver() {
    if (this.playSample('sfx-game-over', { volume: 0.82 })) {
      return;
    }
    this.playTone(180, 0.12, 'triangle', 0.045);
    this.scene.time.delayedCall(150, () => this.playTone(120, 0.18, 'triangle', 0.04));
  }

  playSample(key, config = {}) {
    if (!this.enabled || !this.scene.sound || !this.scene.cache.audio.exists(key)) {
      return false;
    }

    this.scene.sound.play(key, {
      volume: this.getSfxVolume(config.volume ?? 0.7),
      seek: config.seek ?? 0,
      detune: config.detune ?? 0,
    });
    return true;
  }

  playMusic(key, config = {}) {
    if (!this.scene.sound || !this.scene.cache.audio.exists(key)) {
      return;
    }

    const music = this.scene.sound.get(key) ?? this.scene.sound.add(key, {
      loop: true,
      volume: this.getMusicVolume(config.volume ?? 0.4),
    });
    music.setVolume(this.getMusicVolume(config.volume ?? music.volume ?? 0.4));

    if (!this.enabled) {
      music.stop();
      return;
    }

    if (!music.isPlaying) {
      music.play();
    }
  }

  stopMusic(key) {
    const music = this.scene.sound?.get(key);
    if (music?.isPlaying) {
      music.stop();
    }
  }

  playTone(frequency, duration, type, volume) {
    if (!this.enabled || !this.scene.sound?.context) {
      return;
    }

    const context = this.scene.sound.context;
    if (context.state === 'suspended') {
      context.resume().catch(() => {});
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(this.getSfxVolume(volume), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  refreshSettings() {
    this.settings = StorageSystem.loadSettings();
    this.enabled = this.settings.audioEnabled;
  }

  getMainVolume() {
    this.refreshSettings();
    return Phaser.Math.Clamp(this.settings.mainVolume ?? 1, 0, 1);
  }

  getMusicVolume(volume) {
    this.refreshSettings();
    return volume * this.getMainVolume() * Phaser.Math.Clamp(this.settings.musicVolume ?? 1, 0, 1);
  }

  getSfxVolume(volume) {
    this.refreshSettings();
    return volume * this.getMainVolume() * Phaser.Math.Clamp(this.settings.sfxVolume ?? 1, 0, 1);
  }
}
