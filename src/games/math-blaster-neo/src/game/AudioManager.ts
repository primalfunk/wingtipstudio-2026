import enterUrl from "../assets/sound/enter.mp3";
import explosionUrl from "../assets/sound/explosion.mp3";
import failUrl from "../assets/sound/fail.mp3";
import loseUrl from "../assets/sound/lose.mp3";
import musicUrl from "../assets/sound/math_blaster_neo.mp3";
import shotUrl from "../assets/sound/shot.mp3";

type AudioKind = "enter" | "fire" | "correct" | "wrong" | "impact" | "level" | "gameover";

const SOUND_URLS: Partial<Record<AudioKind, string>> = {
  enter: enterUrl,
  fire: shotUrl,
  correct: explosionUrl,
  impact: failUrl,
  gameover: loseUrl
};

export class AudioManager {
  private context: AudioContext | null = null;
  private music: HTMLAudioElement;
  enabled = true;

  constructor() {
    this.music = new Audio(musicUrl);
    this.music.loop = true;
    this.music.volume = 0.34;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.music.pause();
      this.music.currentTime = 0;
    }
  }

  playMusic(): void {
    if (!this.enabled) return;
    this.music.play().catch(() => {
      // Browsers block autoplay until a user gesture; later button clicks retry.
    });
  }

  stopMusic(): void {
    this.music.pause();
    this.music.currentTime = 0;
  }

  private getContext(): AudioContext | null {
    if (!this.enabled) return null;
    this.context ??= new AudioContext();
    return this.context;
  }

  play(kind: AudioKind): void {
    if (!this.enabled) return;
    const url = SOUND_URLS[kind];
    if (url) {
      const sound = new Audio(url);
      sound.volume = kind === "correct" ? 0.82 : 0.72;
      sound.play().catch(() => {});
      return;
    }
    const ctx = this.getContext();
    if (!ctx) return;
    const map = {
      enter: [520, 0.08],
      fire: [360, 0.05],
      correct: [720, 0.09],
      wrong: [150, 0.13],
      impact: [95, 0.18],
      level: [880, 0.18],
      gameover: [70, 0.35]
    } as const;
    const [freq, duration] = map[kind];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = kind === "wrong" || kind === "impact" ? "sawtooth" : "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }
}
