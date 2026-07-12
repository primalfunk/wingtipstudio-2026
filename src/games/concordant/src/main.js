import { startGame } from "./game/gameLoop.js";
import { showStartScreen } from "./ui/startScreen.js";
import { showGameOverModal } from "./ui/gameoverModal.js";
import { loadGameState, resetGameState } from "./game/gameState.js";
import { loadSectorIndex, resetSectorIndex } from "./game/sectorIndex.js";
import { sounds, music } from "./game/audio.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const uiRoot = document.getElementById("ui-root");

let audioUnlocked = false;
let audioListenerBound = false;
const unlockAudio = () => {
  if (audioUnlocked) {
    return;
  }
  audioUnlocked = true;
  sounds.unlock();
  music.unlock();
};

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
let gameController = null;
let demoController = null;
let escListener = null;
let gameState = loadGameState();
let sectorIndex = loadSectorIndex();
let appStarted = false;

if (typeof window !== "undefined") {
  window.__WORLD_SEED__ = gameState?.worldSeed;
  if (typeof window.__WORLD_SEED_READY__ === "function") {
    window.__WORLD_SEED_READY__(gameState?.worldSeed);
  }
}

function exitToMenuFromUI() {
  if (escListener) {
    window.removeEventListener("keydown", escListener);
    escListener = null;
  }
  gameController = null;
  showStartScreenWithDemo();
}

function resetWorld() {
  gameState = resetGameState();
  sectorIndex = resetSectorIndex();
}

function stopDemo() {
  if (demoController && typeof demoController.exitToMenu === "function") {
    demoController.exitToMenu();
  }
  demoController = null;
}

function startDemo() {
  stopDemo();
  demoController = startGame(canvas, ctx, uiRoot, null, null, null, {
    demoMode: true,
    autopilotDefault: true,
    onExitToMenu: () => showStartScreenWithDemo()
  });
}

function showStartScreenWithDemo() {
  stopDemo();
  let screen = null;
  screen = showStartScreen(uiRoot, () => {
    stopDemo();
    beginGame();
  }, resetWorld, {
    onReady: () => {
      if (screen) {
        startDemo();
      }
    }
  });
}

function beginGame() {
  stopDemo();
  if (escListener) {
    window.removeEventListener("keydown", escListener);
    escListener = null;
  }
  gameController = startGame(canvas, ctx, uiRoot, gameState, sectorIndex, (stats) => {
    if (escListener) {
      window.removeEventListener("keydown", escListener);
      escListener = null;
    }
    gameController = null;
    showGameOverModal(uiRoot, stats, () => {
      showStartScreenWithDemo();
    });
  }, {
    onExitToMenu: () => exitToMenuFromUI()
  });

  escListener = (event) => {
    if (event.code !== "Escape") {
      return;
    }
    event.preventDefault();
    if (!gameController) {
      return;
    }
    const controller = gameController;
    gameController = null;
    if (escListener) {
      window.removeEventListener("keydown", escListener);
      escListener = null;
    }
    if (typeof controller.exitToMenu === "function") {
      controller.exitToMenu();
    }
    showStartScreenWithDemo();
  };
  window.addEventListener("keydown", escListener);
}

export function startApp() {
  if (appStarted) {
    return;
  }
  appStarted = true;
  if (!canvas || !ctx) {
    return;
  }
  resize();
  if (!audioListenerBound) {
    const handleFirstInput = () => {
      unlockAudio();
      window.removeEventListener("pointerdown", handleFirstInput);
      window.removeEventListener("touchstart", handleFirstInput);
    };
    window.addEventListener("pointerdown", handleFirstInput, { passive: true });
    window.addEventListener("touchstart", handleFirstInput, { passive: true });
    audioListenerBound = true;
  }
  window.addEventListener("resize", resize);
  showStartScreenWithDemo();
  window.requestAnimationFrame(() => window.parent?.postMessage({ type: 'wingtip:game-ready' }, window.location.origin));
}

if (typeof window !== "undefined" && typeof window.__GAME_READY__ === "function") {
  window.__GAME_READY__();
}

