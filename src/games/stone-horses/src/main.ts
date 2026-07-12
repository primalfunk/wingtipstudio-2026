import { App } from "./app/App";
import { gameAudio } from "./audio/GameAudio";
import { resetBankroll } from "./betting/BettingSystem";
import "./styles.css";

const canvas = document.querySelector<HTMLCanvasElement>("#app");

if (!canvas) {
  throw new Error("Missing #app canvas");
}

const params = new URLSearchParams(window.location.search);
gameAudio.installGlobalButtonClicks();
installAudioUnlock();

if (params.get("autostart") === "1") {
  void start(canvas);
} else {
  showMainMenu(canvas);
  window.requestAnimationFrame(() => window.parent?.postMessage({ type: 'wingtip:game-ready' }, window.location.origin));
}

async function start(appCanvas: HTMLCanvasElement): Promise<void> {
  gameAudio.unlockAndPlayMusic();
  const app = await App.create(appCanvas);
  app.start();
}

function showMainMenu(appCanvas: HTMLCanvasElement): void {
  const menu = document.createElement("div");
  menu.className = "main-menu";
  menu.innerHTML = `
    <div class="main-menu__atmosphere" aria-hidden="true">
      <div class="main-menu__track">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div class="main-menu__fog main-menu__fog--a"></div>
      <div class="main-menu__fog main-menu__fog--b"></div>
      <div class="main-menu__particles">
        ${Array.from({ length: 96 }, (_, index) => `<i style="${getParticleStyle(index)}"></i>`).join("")}
      </div>
      <div class="main-menu__streaks">
        ${Array.from({ length: 28 }, (_, index) => `<i style="${getStreakStyle(index)}"></i>`).join("")}
      </div>
    </div>
    <main class="main-menu__panel">
      <span>Marble Racing</span>
      <h1>Stone Horses</h1>
      <p>Start a fresh session with $1,000 in the bank.</p>
      <button type="button">Start Game</button>
    </main>
  `;

  const button = menu.querySelector("button");

  if (!button) {
    throw new Error("Missing main menu start button");
  }

  button.addEventListener(
    "click",
    () => {
      resetBankroll();
      menu.remove();
      void start(appCanvas);
    },
    { once: true },
  );

  document.body.append(menu);
}

function installAudioUnlock(): void {
  const unlock = (): void => {
    gameAudio.unlockAndPlayMusic();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };

  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
  window.addEventListener("touchstart", unlock, { passive: true });
}

function getParticleStyle(index: number): string {
  const x = pseudoRandom(index, 1) * 100;
  const y = pseudoRandom(index, 2) * 100;
  const size = 1 + pseudoRandom(index, 3) * 2.8;
  const delay = -pseudoRandom(index, 4) * 14;
  const duration = 13 + pseudoRandom(index, 5) * 20;
  const hue = pseudoRandom(index, 6) > 0.56 ? "255 79 216" : pseudoRandom(index, 7) > 0.08 ? "72 225 255" : "225 238 255";
  const opacity = 0.08 + pseudoRandom(index, 8) * 0.2;

  return `left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;width:${size.toFixed(2)}px;height:${size.toFixed(2)}px;--delay:${delay.toFixed(2)}s;--duration:${duration.toFixed(2)}s;--color:${hue};--opacity:${opacity.toFixed(3)};`;
}

function getStreakStyle(index: number): string {
  const x = 4 + pseudoRandom(index, 11) * 92;
  const y = 3 + pseudoRandom(index, 12) * 78;
  const height = 64 + pseudoRandom(index, 13) * 170;
  const opacity = 0.06 + pseudoRandom(index, 14) * 0.13;
  const delay = -pseudoRandom(index, 15) * 9;
  const color = pseudoRandom(index, 16) > 0.48 ? "72 225 255" : "255 79 216";

  return `left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;height:${height.toFixed(1)}px;--delay:${delay.toFixed(2)}s;--color:${color};--opacity:${opacity.toFixed(3)};`;
}

function pseudoRandom(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;

  return value - Math.floor(value);
}
