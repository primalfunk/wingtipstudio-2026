const SOUND_FILES = {
  win: "bvictory.wav",
  arcane: "arcane.wav",
  round: "attack_round.wav",
  danger: "enemysighted.wav",
  inventory: "found_something_nice.wav",
  gameover: "gameover.wav",
  travel: "movement.wav",
  notification: "notif.wav",
};

const MUSIC_FILES = {
  bgmusic: "bgmusic.mp3",
  battlemusic: "battlemusic.mp3",
};

export class SoundManager {
  constructor() {
    this.sounds = new Map(Object.entries(SOUND_FILES).map(([key, file]) => [key, new Audio(`assets/sounds/${file}`)]));
    this.music = new Audio();
    this.music.loop = true;
    this.enabled = true;
  }

  play(name, volume = 0.5) {
    if (!this.enabled || !this.sounds.has(name)) return;
    const audio = this.sounds.get(name).cloneNode();
    audio.volume = volume;
    audio.play().catch(() => {});
  }

  playMusic(name, volume = 0.35) {
    if (!this.enabled || !MUSIC_FILES[name]) return;
    const src = `assets/music/${MUSIC_FILES[name]}`;
    if (!this.music.src.endsWith(src)) this.music.src = src;
    this.music.volume = volume;
    this.music.play().catch(() => {});
  }
}
