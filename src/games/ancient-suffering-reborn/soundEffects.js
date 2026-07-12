const SOUND_EFFECTS = {
  click: { src: "assets/click.mp3", volume: 0.7 },
  fail: { src: "assets/fail.mp3", volume: 0.35 },
  ping: { src: "assets/ping.mp3", volume: 0.7 },
  start: { src: "assets/start.mp3", volume: 0.75 },
  win: { src: "assets/win.mp3", volume: 0.8 }
};

const cache = new Map();

function canPlayAudio() {
  return typeof Audio !== "undefined";
}

function getSound(name) {
  if (!canPlayAudio() || !SOUND_EFFECTS[name]) return null;
  if (!cache.has(name)) {
    const audio = new Audio(SOUND_EFFECTS[name].src);
    audio.preload = "auto";
    audio.volume = SOUND_EFFECTS[name].volume;
    cache.set(name, audio);
  }
  return cache.get(name);
}

export function playSoundEffect(name) {
  const sound = getSound(name);
  if (!sound) return;

  try {
    const instance = sound.cloneNode();
    instance.volume = SOUND_EFFECTS[name].volume;
    instance.play().catch(() => {
      // Browser autoplay rules can reject sound until a user gesture occurs.
    });
  } catch {
    // Sound effects are optional feedback.
  }
}

export const playClick = () => playSoundEffect("click");
export const playFail = () => playSoundEffect("fail");
export const playPing = () => playSoundEffect("ping");
export const playStart = () => playSoundEffect("start");
export const playWin = () => playSoundEffect("win");
