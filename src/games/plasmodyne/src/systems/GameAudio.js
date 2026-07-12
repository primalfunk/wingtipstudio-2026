import Phaser from 'phaser';

export const AUDIO_KEYS = {
  menuMusic: 'audio-music-menu',
  levelCompleteMusic: 'audio-music-level-complete',
  victoryMusic: 'audio-music-victory',
  startGame: 'audio-start-game',
  powerDown: 'audio-power-down',
  droidSpawn: 'audio-droid-spawn',
  droidExplode: 'audio-droid-explode',
  droidHit: 'audio-droid-hit',
  heal: 'audio-heal',
  laser: 'audio-laser',
  wallHit: 'audio-wall-hit',
  bump: 'audio-bump',
  doorOpen: 'audio-door-open',
  doorClose: 'audio-door-close',
  setPlug: 'audio-set-plug',
  typing: 'audio-typing',
  tick: 'audio-transfer-tick',
  transferAcquired: 'audio-transfer-acquired',
  transferApproachA: 'audio-transfer-approach-a',
  transferApproachB: 'audio-transfer-approach-b',
  transferFail: 'audio-transfer-fail',
  transferMode: 'audio-transfer-mode',
  transferSuccess: 'audio-transfer-success',
  levelMusic: Array.from({ length: 10 }, (_, index) => `audio-music-level-${index + 1}`),
  robotNoise: Array.from({ length: 10 }, (_, index) => `audio-robot-noise-${index + 1}`)
};

const AUDIO_PATHS = {
  [AUDIO_KEYS.menuMusic]: './assets/audio/music/plasmodyne_menu.mp3',
  [AUDIO_KEYS.levelCompleteMusic]: './assets/audio/music/level_complete.mp3',
  [AUDIO_KEYS.victoryMusic]: './assets/audio/music/victory.mp3',
  [AUDIO_KEYS.startGame]: './assets/audio/music/start_game.mp3',
  [AUDIO_KEYS.powerDown]: './assets/audio/sfx/power_down.mp3',
  [AUDIO_KEYS.droidSpawn]: './assets/audio/sfx/droid_spawn.mp3',
  [AUDIO_KEYS.droidExplode]: './assets/audio/sfx/droid_explode.mp3',
  [AUDIO_KEYS.droidHit]: './assets/audio/sfx/droid_hit.mp3',
  [AUDIO_KEYS.heal]: './assets/audio/sfx/heal.mp3',
  [AUDIO_KEYS.laser]: './assets/audio/sfx/laser.mp3',
  [AUDIO_KEYS.wallHit]: './assets/audio/sfx/wall_hit.mp3',
  [AUDIO_KEYS.bump]: './assets/audio/sfx/bump.mp3',
  [AUDIO_KEYS.doorOpen]: './assets/audio/sfx/door_open.mp3',
  [AUDIO_KEYS.doorClose]: './assets/audio/sfx/door_close.mp3',
  [AUDIO_KEYS.setPlug]: './assets/audio/sfx/set_plug.mp3',
  [AUDIO_KEYS.typing]: './assets/audio/sfx/typing.mp3',
  [AUDIO_KEYS.tick]: './assets/audio/sfx/tick.mp3',
  [AUDIO_KEYS.transferAcquired]: './assets/audio/sfx/transfer_acquired.mp3',
  [AUDIO_KEYS.transferApproachA]: './assets/audio/sfx/transfer_approach_a.mp3',
  [AUDIO_KEYS.transferApproachB]: './assets/audio/sfx/transfer_approach_b.mp3',
  [AUDIO_KEYS.transferFail]: './assets/audio/sfx/transfer_fail.mp3',
  [AUDIO_KEYS.transferMode]: './assets/audio/sfx/transfer_mode.mp3',
  [AUDIO_KEYS.transferSuccess]: './assets/audio/sfx/transfer_success.mp3',
  ...Object.fromEntries(AUDIO_KEYS.levelMusic.map((key, index) => [key, `./assets/audio/music/plasmodyne_level${index + 1}.mp3`])),
  ...Object.fromEntries(AUDIO_KEYS.robotNoise.map((key, index) => [key, `./assets/audio/ambient/robot_noise_${index + 1}.mp3`]))
};

const VOLUMES = {
  menuMusic: 0.62,
  levelMusic: 0.68,
  levelCompleteMusic: 0.58,
  victoryMusic: 0.76,
  poweredDownMusic: 0.17,
  startGame: 0.88,
  powerDown: 0.84,
  droidSpawn: 0.68,
  droidExplode: 0.72,
  droidHit: 0.52,
  heal: 0.46,
  laser: 0.24,
  wallHit: 0.38,
  bump: 0.34,
  doorOpen: 0.46,
  doorClose: 0.42,
  setPlug: 0.52,
  tick: 0.34,
  transferAcquired: 0.72,
  transferApproach: 0.62,
  transferMode: 0.36,
  transferResolve: 0.72,
  robotNoise: 0.18
};

export function preloadGameAudio(scene) {
  for (const [key, path] of Object.entries(AUDIO_PATHS)) {
    scene.load.audio(key, path);
  }
}

export class GameAudio {
  static currentMusic = null;
  static currentMusicKey = null;
  static ambientTimer = null;
  static ambientScene = null;
  static ambientQueue = [];
  static activeAmbientSound = null;
  static healLoop = null;
  static transferModeLoop = null;

  constructor(scene) {
    this.scene = scene;
  }

  playMenuMusic() {
    this.stopAmbient();
    this.stopHealLoop();
    this.playLoopingMusic(AUDIO_KEYS.menuMusic, VOLUMES.menuMusic);
  }

  playDeckMusic(deckId, poweredDown = false) {
    if (poweredDown) {
      this.playLoopingMusic(AUDIO_KEYS.levelCompleteMusic, VOLUMES.levelCompleteMusic);
      this.stopAmbient();
      return;
    }
    const musicKey = AUDIO_KEYS.levelMusic[deckId - 1] ?? AUDIO_KEYS.levelMusic[0];
    this.playLoopingMusic(musicKey, VOLUMES.levelMusic);
    this.startAmbient();
  }

  playLoopingMusic(key, volume) {
    if (GameAudio.currentMusicKey === key && GameAudio.currentMusic) {
      GameAudio.currentMusic.setVolume(volume);
      if (!GameAudio.currentMusic.isPlaying) {
        GameAudio.currentMusic.play();
      }
      return;
    }

    GameAudio.currentMusic?.stop();
    GameAudio.currentMusic?.destroy();
    GameAudio.currentMusic = this.scene.sound.add(key, { loop: true, volume });
    GameAudio.currentMusicKey = key;
    GameAudio.currentMusic.play();
  }

  reduceCurrentMusicForPoweredDownDeck() {
    GameAudio.currentMusic?.setVolume(VOLUMES.poweredDownMusic);
    this.stopAmbient();
  }

  playStartGame() {
    this.scene.sound.play(AUDIO_KEYS.startGame, { volume: VOLUMES.startGame });
  }

  playPowerDown() {
    this.scene.sound.play(AUDIO_KEYS.powerDown, { volume: VOLUMES.powerDown });
    this.reduceCurrentMusicForPoweredDownDeck();
  }

  playDeckClearedSequence() {
    this.playPowerDown();
    this.scene.time.delayedCall(850, () => {
      if (!this.scene.sys?.isActive()) {
        return;
      }
      this.fadeToLevelCompleteMusic();
    });
  }

  fadeToLevelCompleteMusic() {
    this.stopAmbient();
    GameAudio.currentMusic?.stop();
    GameAudio.currentMusic?.destroy();
    GameAudio.currentMusic = this.scene.sound.add(AUDIO_KEYS.levelCompleteMusic, { loop: true, volume: 0 });
    GameAudio.currentMusicKey = AUDIO_KEYS.levelCompleteMusic;
    GameAudio.currentMusic.play();
    this.scene.tweens.addCounter({
      from: 0,
      to: VOLUMES.levelCompleteMusic,
      duration: 1200,
      onUpdate: (tween) => GameAudio.currentMusic?.setVolume(tween.getValue())
    });
  }

  playVictoryMusic() {
    this.stopAmbient();
    this.stopHealLoop();
    this.stopTransferModeLoop();
    this.playLoopingMusic(AUDIO_KEYS.victoryMusic, VOLUMES.victoryMusic);
  }

  playDroidHit() {
    this.scene.sound.play(AUDIO_KEYS.droidHit, { volume: VOLUMES.droidHit });
  }

  playDroidSpawn() {
    this.scene.sound.play(AUDIO_KEYS.droidSpawn, { volume: VOLUMES.droidSpawn });
  }

  playDroidExplode() {
    this.scene.sound.play(AUDIO_KEYS.droidExplode, { volume: VOLUMES.droidExplode });
  }

  playLaser(weapon = null) {
    this.scene.sound.play(AUDIO_KEYS.laser, {
      volume: VOLUMES.laser * (weapon?.soundVolumeScale ?? 1),
      detune: weapon?.soundDetune ?? 0
    });
  }

  playWallHit() {
    this.scene.sound.play(AUDIO_KEYS.wallHit, { volume: VOLUMES.wallHit });
  }

  playBump(volumeScale = 1) {
    this.scene.sound.play(AUDIO_KEYS.bump, { volume: VOLUMES.bump * volumeScale });
  }

  playDoorOpen() {
    this.scene.sound.play(AUDIO_KEYS.doorOpen, { volume: VOLUMES.doorOpen });
  }

  playDoorClose() {
    this.scene.sound.play(AUDIO_KEYS.doorClose, { volume: VOLUMES.doorClose });
  }

  playSetPlug() {
    this.scene.sound.play(AUDIO_KEYS.setPlug, { volume: VOLUMES.setPlug });
  }

  playTransferTick() {
    this.scene.sound.play(AUDIO_KEYS.tick, { volume: VOLUMES.tick });
  }

  playTransferAcquired() {
    this.scene.sound.play(AUDIO_KEYS.transferAcquired, { volume: VOLUMES.transferAcquired });
  }

  playTransferApproachA(delay = 0) {
    this.playDelayed(AUDIO_KEYS.transferApproachA, VOLUMES.transferApproach, delay);
  }

  playTransferApproachB() {
    this.scene.sound.play(AUDIO_KEYS.transferApproachB, { volume: VOLUMES.transferApproach });
  }

  playTransferSuccess() {
    this.scene.sound.play(AUDIO_KEYS.transferSuccess, { volume: VOLUMES.transferResolve });
  }

  playTransferFail() {
    this.scene.sound.play(AUDIO_KEYS.transferFail, { volume: VOLUMES.transferResolve });
  }

  startTransferModeLoop() {
    if (GameAudio.transferModeLoop?.isPlaying) {
      return;
    }
    if (!GameAudio.transferModeLoop) {
      GameAudio.transferModeLoop = this.scene.sound.add(AUDIO_KEYS.transferMode, { loop: true, volume: VOLUMES.transferMode });
    }
    GameAudio.transferModeLoop.play();
  }

  stopTransferModeLoop() {
    GameAudio.transferModeLoop?.stop();
  }

  playDelayed(key, volume, delay = 0) {
    if (delay <= 0) {
      this.scene.sound.play(key, { volume });
      return;
    }
    this.scene.time.delayedCall(delay, () => {
      if (this.scene.sys?.isActive()) {
        this.scene.sound.play(key, { volume });
      }
    });
  }

  startHealLoop() {
    if (GameAudio.healLoop?.isPlaying) {
      return;
    }
    if (!GameAudio.healLoop) {
      GameAudio.healLoop = this.scene.sound.add(AUDIO_KEYS.heal, { loop: true, volume: VOLUMES.heal });
    }
    GameAudio.healLoop.play();
  }

  stopHealLoop() {
    GameAudio.healLoop?.stop();
  }

  startAmbient() {
    this.stopAmbient();
    GameAudio.ambientScene = this.scene;
    if (!GameAudio.ambientQueue.length) {
      GameAudio.ambientQueue = this.shuffle(AUDIO_KEYS.robotNoise);
    }
    this.scheduleNextAmbient();
  }

  stopAmbient() {
    GameAudio.ambientTimer?.remove(false);
    GameAudio.ambientTimer = null;
    GameAudio.ambientScene = null;
    GameAudio.activeAmbientSound?.stop();
    GameAudio.activeAmbientSound?.destroy();
    GameAudio.activeAmbientSound = null;
  }

  scheduleNextAmbient() {
    const delay = Phaser.Math.Between(10000, 40000);
    GameAudio.ambientTimer = this.scene.time.delayedCall(delay, () => {
      if (GameAudio.ambientScene !== this.scene) {
        return;
      }
      if (!GameAudio.ambientQueue.length) {
        GameAudio.ambientQueue = this.shuffle(AUDIO_KEYS.robotNoise);
      }
      const key = GameAudio.ambientQueue.shift();
      GameAudio.activeAmbientSound?.destroy();
      GameAudio.activeAmbientSound = this.scene.sound.add(key, { volume: VOLUMES.robotNoise });
      GameAudio.activeAmbientSound.once('complete', () => {
        GameAudio.activeAmbientSound?.destroy();
        GameAudio.activeAmbientSound = null;
      });
      GameAudio.activeAmbientSound.play();
      this.scheduleNextAmbient();
    });
  }

  shuffle(items) {
    const queue = [...items];
    for (let i = queue.length - 1; i > 0; i -= 1) {
      const j = Phaser.Math.Between(0, i);
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    return queue;
  }

  shutdownScene() {
    this.stopAmbient();
    this.stopHealLoop();
    this.stopTransferModeLoop();
  }
}
