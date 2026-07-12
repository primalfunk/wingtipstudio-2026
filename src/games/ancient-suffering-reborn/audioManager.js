const MUSIC_SRC = "assets/ancient_suffering_groove.mp3";
const STORAGE_KEY = "ancientSuffering.musicEnabled.v1";

let music = null;
let enabled = true;
let toggleButton = null;

function updateButton() {
  if (!toggleButton) return;
  toggleButton.textContent = enabled ? "Music On" : "Music Off";
}

async function playMusic() {
  if (!music || !enabled) return;
  try {
    await music.play();
  } catch {
    // Browser autoplay policies may require a user gesture.
  }
}

function pauseMusic() {
  if (music) music.pause();
}

function persistPreference() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(enabled));
  } catch {
    // Preference persistence is optional.
  }
}

function readPreference() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : JSON.parse(stored);
  } catch {
    return true;
  }
}

export function initializeMusic() {
  enabled = readPreference();
  music = new Audio(MUSIC_SRC);
  music.loop = true;
  music.volume = 0.45;

  toggleButton = document.getElementById("music-btn");
  if (toggleButton) {
    toggleButton.onclick = () => {
      enabled = !enabled;
      persistPreference();
      updateButton();
      if (enabled) {
        playMusic();
      } else {
        pauseMusic();
      }
    };
  }
  updateButton();
  playMusic();

  document.addEventListener("pointerdown", playMusic, { once: true });
  document.addEventListener("keydown", playMusic, { once: true });
}

export function stopMusic() {
  pauseMusic();
}
