import menuSongUrl from "../assets/audio/menu_song.mp3";
import cleanTickUrl from "../assets/audio/clean_tick.mp3";
import cleanGoUrl from "../assets/audio/clean_go.mp3";

class StoneHorsesAudio {
  private readonly music = new Audio(menuSongUrl);
  private readonly tickPool = this.createPool(cleanTickUrl, 6);
  private readonly goPool = this.createPool(cleanGoUrl, 3);
  private unlocked = false;
  private clickListenerBound = false;

  constructor() {
    this.music.loop = true;
    this.music.volume = 0.38;
    this.music.preload = "auto";
  }

  installGlobalButtonClicks(): void {
    if (this.clickListenerBound) {
      return;
    }

    document.addEventListener(
      "click",
      (event) => {
        if ((event.target as Element | null)?.closest("button")) {
          this.playTick();
        }
      },
      true,
    );
    this.clickListenerBound = true;
  }

  unlockAndPlayMusic(): void {
    this.unlocked = true;
    this.tickPool.forEach((audio) => audio.load());
    this.goPool.forEach((audio) => audio.load());
    void this.playMusic();
  }

  async playMusic(): Promise<void> {
    try {
      await this.music.play();
    } catch {
      // Browser autoplay policies can block this until a user gesture unlocks audio.
    }
  }

  playTick(): void {
    this.playFromPool(this.tickPool, 0.72);
  }

  playGo(): void {
    this.playFromPool(this.goPool, 0.82);
  }

  private createPool(url: string, count: number): HTMLAudioElement[] {
    return Array.from({ length: count }, () => {
      const audio = new Audio(url);
      audio.preload = "auto";
      return audio;
    });
  }

  private playFromPool(pool: HTMLAudioElement[], volume: number): void {
    if (!this.unlocked) {
      return;
    }

    const audio = pool.find((candidate) => candidate.paused || candidate.ended) ?? pool[0];
    audio.pause();
    audio.currentTime = 0;
    audio.volume = volume;
    void audio.play().catch(() => {});
  }
}

export const gameAudio = new StoneHorsesAudio();
