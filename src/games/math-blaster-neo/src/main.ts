import "./styles.css";
import { AudioManager } from "./game/AudioManager";
import { Game } from "./game/Game";
import { ProfileManager } from "./game/ProfileManager";
import { mergeSettings } from "./game/SettingsManager";
import { GRADE_LABELS, type GameSnapshot, type GradeLevel, type Settings } from "./game/types";
import { EquationRainCanvas } from "./ui/EquationRainCanvas";
import { hud } from "./ui/hud";
import {
  gameOverScreen,
  gameScreen,
  gradeScreen,
  pauseOverlay,
  profileScreen,
  settingsScreen,
  titleScreen
} from "./ui/screens";

class App {
  private root = document.querySelector<HTMLDivElement>("#app")!;
  private profiles = new ProfileManager();
  private audio = new AudioManager();
  private game: Game | null = null;
  private equationRain: EquationRainCanvas | null = null;
  private lastSnapshot: GameSnapshot = {
    score: 0,
    gameLevel: 1,
    baseHealth: 5,
    streak: 0,
    correct: 0,
    misses: 0,
    accuracy: 100,
    grade: "K",
    ammoLabel: "",
    ammoMode: "problemAmmo_answerTargets"
  };

  constructor() {
    this.root.addEventListener("click", (event) => this.onClick(event));
    this.root.addEventListener("submit", (event) => this.onSubmit(event));
    this.root.addEventListener("change", (event) => this.onChange(event));
    window.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && document.activeElement instanceof HTMLButtonElement) {
        document.activeElement.click();
      }
    });
    this.renderTitle();
  }

  private settings(): Settings {
    const data = this.profiles.snapshot;
    return mergeSettings(data.globalSettings, this.profiles.activeProfile?.settings);
  }

  private applySettings(): void {
    const settings = this.settings();
    this.audio.setEnabled(settings.audioEnabled);
    this.root.className = `app-shell${settings.highContrast ? " high-contrast" : ""}${settings.dyslexiaFont ? " dyslexia-font" : ""}`;
  }

  private mount(html: string): void {
    this.destroyTitleEffects();
    this.applySettings();
    this.root.innerHTML = html;
  }

  private renderTitle(): void {
    this.destroyGame();
    this.mount(titleScreen(this.profiles.activeProfile?.name ?? null));
    this.startEquationRain();
    this.audio.playMusic();
  }

  private renderProfiles(): void {
    this.destroyGame();
    this.mount(profileScreen(this.profiles.snapshot));
  }

  private renderGrades(): void {
    const profile = this.ensureProfile();
    if (!profile) return;
    this.mount(gradeScreen(profile.selectedGrade));
    this.startEquationRain();
    this.audio.playMusic();
  }

  private renderSettings(): void {
    this.destroyGame();
    this.mount(settingsScreen(this.settings()));
  }

  private startGame(): void {
    const profile = this.ensureProfile();
    if (!profile) return;
    this.destroyGame();
    const grade = profile.selectedGrade;
    this.lastSnapshot = { ...this.lastSnapshot, grade };
    this.mount(gameScreen(this.lastSnapshot));
    const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
    const hudEl = document.querySelector<HTMLElement>("#hud");
    if (!canvas || !hudEl) return;
    this.game = new Game(canvas, grade, this.settings(), {
      onHud: (snapshot) => {
        this.lastSnapshot = snapshot;
        hudEl.innerHTML = hud(snapshot);
      },
      onPause: () => this.showPause(),
      onGameOver: (snapshot) => this.finishGame(snapshot)
    }, this.audio);
    hudEl.innerHTML = hud(this.lastSnapshot);
    this.game.start();
  }

  private showPause(): void {
    if (document.querySelector("#pause-overlay")) return;
    this.root.insertAdjacentHTML("beforeend", pauseOverlay());
  }

  private resumeGame(): void {
    document.querySelector("#pause-overlay")?.remove();
    this.game?.resume();
  }

  private finishGame(snapshot: GameSnapshot): void {
    this.destroyGame(false);
    this.audio.stopMusic();
    this.profiles.recordGame(snapshot.score, snapshot.grade, snapshot.gameLevel);
    const highScore = this.profiles.activeProfile?.statsByGrade[snapshot.grade].highScore ?? snapshot.score;
    this.mount(gameOverScreen(snapshot, highScore));
  }

  private ensureProfile() {
    let profile = this.profiles.activeProfile;
    if (!profile) {
      profile = this.profiles.createProfile("Player 1");
    }
    return profile;
  }

  private destroyGame(clear = true): void {
    this.game?.destroy();
    this.game = null;
    if (clear) document.querySelector("#pause-overlay")?.remove();
  }

  private destroyTitleEffects(): void {
    this.equationRain?.destroy();
    this.equationRain = null;
  }

  private startEquationRain(): void {
    const canvas = document.querySelector<HTMLCanvasElement>("#equation-rain-canvas");
    if (!canvas) return;
    this.equationRain = new EquationRainCanvas(canvas, "medium", this.settings().reducedMotion);
    this.equationRain.start();
  }

  private onClick(event: Event): void {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "home") this.renderTitle();
    if (action === "play") {
      this.audio.play("enter");
      this.renderGrades();
    }
    if (action === "profiles") this.renderProfiles();
    if (action === "settings") this.renderSettings();
    if (action === "pause") {
      this.game?.setPaused(true);
      this.showPause();
    }
    if (action === "resume") this.resumeGame();
    if (action === "grade") {
      this.profiles.setGrade(button.dataset.grade as GradeLevel);
      this.startGame();
    }
    if (action === "select-profile" && button.dataset.id) {
      this.profiles.selectProfile(button.dataset.id);
      this.renderProfiles();
    }
    if (action === "delete-profile" && button.dataset.id && confirm("Delete this local profile?")) {
      this.profiles.deleteProfile(button.dataset.id);
      this.renderProfiles();
    }
    if (action === "play-again") this.startGame();
    if (action === "change-grade") this.renderGrades();
  }

  private onSubmit(event: Event): void {
    const form = event.target as HTMLFormElement;
    if (form.dataset.form !== "profile") return;
    event.preventDefault();
    const data = new FormData(form);
    this.profiles.createProfile(String(data.get("name") ?? "Player"));
    this.renderTitle();
  }

  private onChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const key = input.dataset.setting as keyof Settings | undefined;
    if (!key) return;
    this.profiles.updateSettings({ [key]: input.checked } as Partial<Settings>);
    this.renderSettings();
  }
}

new App();
window.requestAnimationFrame(() => window.parent?.postMessage({ type: 'wingtip:game-ready' }, window.location.origin));
