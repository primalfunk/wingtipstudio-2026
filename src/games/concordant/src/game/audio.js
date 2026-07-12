import { CONFIG } from "./config.js";

const SOUND_DEFS = CONFIG.AUDIO.SOUNDS;

const clampVolume = (value) => Math.max(0, Math.min(1, value));
const AUDIO_SRC_CACHE = new Map();

function resolveAudioSrc(src) {
  if (typeof src !== "string") {
    return src;
  }
  if (!src.startsWith("data:")) {
    return src;
  }
  if (AUDIO_SRC_CACHE.has(src)) {
    return AUDIO_SRC_CACHE.get(src);
  }
  const commaIndex = src.indexOf(",");
  if (commaIndex < 0) {
    return src;
  }
  const meta = src.slice(5, commaIndex);
  if (!meta.includes(";base64")) {
    return src;
  }
  const mime = meta.split(";")[0] || "audio/mpeg";
  try {
    const binary = atob(src.slice(commaIndex + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    AUDIO_SRC_CACHE.set(src, url);
    return url;
  } catch (err) {
    return src;
  }
}

class SoundManager {
  constructor(defs) {
    this.defs = defs;
    this.pool = new Map();
    this.loopHandles = new Map();
    this.preloaded = false;
    this.unlocked = false;
    this.muted = false;
    this.mutedKeys = new Set();
    this.masterVolume = 1;
    this.masterFadeId = null;
  }

  preload() {
    if (this.preloaded) {
      return;
    }
    for (const [key, def] of Object.entries(this.defs)) {
      const audio = new Audio(resolveAudioSrc(def.src));
      audio.preload = "auto";
      const baseVolume = clampVolume(def.volume ?? 1);
      audio._baseVolume = baseVolume;
      audio._volumeBase = baseVolume;
      audio.volume = clampVolume(baseVolume * this.masterVolume);
      this.pool.set(key, [audio]);
    }
    this.preloaded = true;
  }

  unlock() {
    if (this.unlocked) {
      return;
    }
    this.preload();
    this.unlocked = true;
    const warm = (audio) => {
      audio.muted = true;
      audio.currentTime = 0;
      try {
        audio.load();
      } catch (err) {}
      const playResult = audio.play();
      if (playResult && typeof playResult.then === "function") {
        playResult.then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
        }).catch(() => {
          audio.muted = false;
        });
      } else {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
      }
    };
    for (const pool of this.pool.values()) {
      for (const audio of pool) {
        warm(audio);
      }
    }
  }

  play(key) {
    const def = this.defs[key];
    if (!def) {
      return;
    }
    if (this.muted || this.mutedKeys.has(key)) {
      return;
    }
    let pool = this.pool.get(key);
    if (!pool) {
      pool = [];
      this.pool.set(key, pool);
    }
    let audio = pool.find((entry) => entry.paused || entry.ended);
    if (!audio) {
      audio = new Audio(resolveAudioSrc(def.src));
      audio.preload = "auto";
      pool.push(audio);
    }
    const baseVolume = clampVolume(def.volume ?? 1);
    audio._baseVolume = baseVolume;
    audio._volumeBase = baseVolume;
    audio.volume = clampVolume(baseVolume * this.masterVolume);
    audio.currentTime = 0;
    const playResult = audio.play();
    if (playResult && typeof playResult.then === "function") {
      playResult.catch(() => {});
    }
  }

  startLoop(key, segmentSeconds = 0.4, crossfadeSeconds = 0.16) {
    if (this.muted || this.mutedKeys.has(key)) {
      return;
    }
    if (this.loopHandles.has(key)) {
      return;
    }
    const def = this.defs[key];
    if (!def) {
      return;
    }
    const baseVolume = clampVolume(def.volume ?? 1);
    if (def.loopMode === "native") {
      let pool = this.pool.get(key);
      if (!pool) {
        pool = [];
        this.pool.set(key, pool);
      }
      let audio = pool[0];
      if (!audio) {
        audio = new Audio(resolveAudioSrc(def.src));
        audio.preload = "auto";
        pool.push(audio);
      }
      audio.loop = true;
      audio._baseVolume = baseVolume;
      audio._volumeBase = baseVolume;
      audio.volume = clampVolume(baseVolume * this.masterVolume);
      audio.currentTime = 0;
      this.loopHandles.set(key, {
        audio,
        stop: () => {
          audio.loop = false;
          audio.pause();
          audio.currentTime = 0;
        }
      });
      const playResult = audio.play();
      if (playResult && typeof playResult.then === "function") {
        playResult.catch(() => {
          this.stopLoop(key);
        });
      }
      return;
    }
    const fadeMs = Math.max(20, crossfadeSeconds * 1000);
    const segmentMs = Math.max(100, segmentSeconds * 1000);
    const intervalMs = Math.max(40, segmentMs - fadeMs);

    const makeAudio = () => {
      const audio = new Audio(resolveAudioSrc(def.src));
      audio.preload = "auto";
      audio._baseVolume = baseVolume;
      audio._volumeBase = baseVolume;
      audio.volume = clampVolume(baseVolume * this.masterVolume);
      return audio;
    };

    const a = makeAudio();
    const b = makeAudio();
    let active = a;
    let inactive = b;
    let stopped = false;
    const rafIds = new Set();

    const fade = (audio, fromBase, toBase, onDone) => {
      const start = performance.now();
      const step = (time) => {
        if (stopped) {
          return;
        }
        const t = Math.min(1, (time - start) / fadeMs);
        const baseVolume = fromBase + (toBase - fromBase) * t;
        audio._volumeBase = baseVolume;
        audio.volume = clampVolume(baseVolume * this.masterVolume);
        if (t < 1) {
          const id = requestAnimationFrame(step);
          rafIds.add(id);
        } else if (onDone) {
          onDone();
        }
      };
      const id = requestAnimationFrame(step);
      rafIds.add(id);
    };

    const startAudio = (audio, fadeIn) => {
      audio.currentTime = 0;
      const startBase = fadeIn ? 0 : (audio._baseVolume ?? baseVolume);
      audio._volumeBase = startBase;
      audio.volume = clampVolume(startBase * this.masterVolume);
      const playResult = audio.play();
      if (playResult && typeof playResult.then === "function") {
        playResult.catch(() => {
          if (!stopped) {
            this.stopLoop(key);
          }
        });
      }
      if (fadeIn) {
        fade(audio, 0, audio._baseVolume ?? baseVolume);
      }
    };

    const stopAudio = (audio) => {
      const fromBase = Number.isFinite(audio._volumeBase)
        ? audio._volumeBase
        : (audio._baseVolume ?? baseVolume);
      fade(audio, fromBase, 0, () => {
        audio.pause();
        audio.currentTime = 0;
        const resetBase = audio._baseVolume ?? baseVolume;
        audio._volumeBase = resetBase;
        audio.volume = clampVolume(resetBase * this.masterVolume);
      });
    };

    startAudio(active, false);
    const interval = setInterval(() => {
      if (stopped) {
        return;
      }
      startAudio(inactive, true);
      stopAudio(active);
      const next = active;
      active = inactive;
      inactive = next;
    }, intervalMs);

    this.loopHandles.set(key, {
      interval,
      audios: [a, b],
      rafIds,
      stop: () => {
        stopped = true;
        clearInterval(interval);
        for (const id of rafIds) {
          cancelAnimationFrame(id);
        }
        a.pause();
        b.pause();
        a.currentTime = 0;
        b.currentTime = 0;
        const resetBase = a._baseVolume ?? baseVolume;
        a._volumeBase = resetBase;
        a.volume = clampVolume(resetBase * this.masterVolume);
        const resetBaseB = b._baseVolume ?? baseVolume;
        b._volumeBase = resetBaseB;
        b.volume = clampVolume(resetBaseB * this.masterVolume);
      }
    });
  }

  stopLoop(key) {
    const handle = this.loopHandles.get(key);
    if (!handle) {
      return;
    }
    if (typeof handle.stop === "function") {
      handle.stop();
    } else {
      clearInterval(handle.interval);
      handle.audio.pause();
      handle.audio.currentTime = 0;
    }
    this.loopHandles.delete(key);
  }

  applyMasterVolume() {
    const applyVolume = (audio, fallbackBase) => {
      if (!audio) {
        return;
      }
      const base = Number.isFinite(audio._volumeBase)
        ? audio._volumeBase
        : (Number.isFinite(audio._baseVolume) ? audio._baseVolume : fallbackBase);
      audio.volume = clampVolume(base * this.masterVolume);
    };
    for (const [key, pool] of this.pool.entries()) {
      const def = this.defs[key];
      const fallbackBase = clampVolume(def?.volume ?? 1);
      for (const audio of pool) {
        applyVolume(audio, fallbackBase);
      }
    }
    for (const handle of this.loopHandles.values()) {
      if (handle?.audio) {
        applyVolume(handle.audio, handle.audio._baseVolume ?? 1);
      } else if (Array.isArray(handle?.audios)) {
        for (const audio of handle.audios) {
          applyVolume(audio, audio?._baseVolume ?? 1);
        }
      }
    }
  }

  setMasterVolume(value) {
    const next = clampVolume(value);
    if (this.masterVolume === next) {
      return;
    }
    this.masterVolume = next;
    this.applyMasterVolume();
  }

  fadeMasterVolume(target, durationMs = 600, onDone = null) {
    const targetVolume = clampVolume(target);
    if (this.masterFadeId) {
      cancelAnimationFrame(this.masterFadeId);
      this.masterFadeId = null;
    }
    const from = this.masterVolume;
    const duration = Math.max(0, durationMs);
    if (duration === 0) {
      this.masterVolume = targetVolume;
      this.applyMasterVolume();
      if (typeof onDone === "function") {
        onDone();
      }
      return;
    }
    const start = performance.now();
    const step = (time) => {
      const t = Math.min(1, (time - start) / duration);
      this.masterVolume = clampVolume(from + (targetVolume - from) * t);
      this.applyMasterVolume();
      if (t < 1) {
        this.masterFadeId = requestAnimationFrame(step);
      } else {
        this.masterFadeId = null;
        if (typeof onDone === "function") {
          onDone();
        }
      }
    };
    this.masterFadeId = requestAnimationFrame(step);
  }

  setMuted(muted) {
    const next = Boolean(muted);
    if (this.muted === next) {
      return;
    }
    this.muted = next;
    if (this.muted) {
      for (const key of this.loopHandles.keys()) {
        this.stopLoop(key);
      }
    }
  }

  setKeyMuted(key, muted) {
    if (!key) {
      return;
    }
    if (muted) {
      this.mutedKeys.add(key);
      this.stopLoop(key);
    } else {
      this.mutedKeys.delete(key);
    }
  }
}

export const sounds = new SoundManager(SOUND_DEFS);

class MusicManager {
  constructor(tracks, volume = 0.5) {
    this.tracks = tracks.map((track) => resolveAudioSrc(track));
    this.baseVolume = clampVolume(volume);
    this.audio = new Audio();
    this.audio.preload = "auto";
    this.audio.volume = this.baseVolume;
    this.index = 0;
    this.playing = false;
    this.unlocked = false;
    this.onEnded = this.onEnded.bind(this);
    this.fadeId = null;
  }

  onEnded() {
    if (!this.playing) {
      return;
    }
    this.index = (this.index + 1) % this.tracks.length;
    this.playCurrent();
  }

  playCurrent() {
    if (!this.tracks.length) {
      return;
    }
    this.audio.src = this.tracks[this.index];
    this.audio.currentTime = 0;
    const playResult = this.audio.play();
    if (playResult && typeof playResult.then === "function") {
      playResult.catch(() => {
        if (this.playing) {
          this.playing = false;
          this.audio.removeEventListener("ended", this.onEnded);
        }
      });
    }
  }

  unlock() {
    if (this.unlocked) {
      return;
    }
    if (!this.tracks.length) {
      return;
    }
    this.unlocked = true;
    if (!this.audio.src) {
      this.audio.src = this.tracks[this.index];
    }
    this.audio.muted = true;
    this.audio.currentTime = 0;
    try {
      this.audio.load();
    } catch (err) {}
    const playResult = this.audio.play();
    if (playResult && typeof playResult.then === "function") {
      playResult.then(() => {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.audio.muted = false;
      }).catch(() => {
        this.audio.muted = false;
      });
    } else {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio.muted = false;
    }
  }

  start() {
    if (this.playing || this.tracks.length === 0) {
      return;
    }
    this.playing = true;
    this.audio.addEventListener("ended", this.onEnded);
    this.playCurrent();
  }

  stop() {
    if (!this.playing) {
      return;
    }
    this.playing = false;
    this.audio.removeEventListener("ended", this.onEnded);
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  getBaseVolume() {
    return this.baseVolume;
  }

  setBaseVolume(value) {
    this.baseVolume = clampVolume(value);
    this.audio.volume = this.baseVolume;
  }

  fadeTo(target, durationMs = 600, onDone = null) {
    const targetVolume = clampVolume(target);
    if (this.fadeId) {
      cancelAnimationFrame(this.fadeId);
      this.fadeId = null;
    }
    const from = this.audio.volume;
    const duration = Math.max(0, durationMs);
    if (duration === 0) {
      this.audio.volume = targetVolume;
      if (typeof onDone === "function") {
        onDone();
      }
      return;
    }
    const start = performance.now();
    const step = (time) => {
      const t = Math.min(1, (time - start) / duration);
      this.audio.volume = clampVolume(from + (targetVolume - from) * t);
      if (t < 1) {
        this.fadeId = requestAnimationFrame(step);
      } else {
        this.fadeId = null;
        if (typeof onDone === "function") {
          onDone();
        }
      }
    };
    this.fadeId = requestAnimationFrame(step);
  }

  fadeToBase(durationMs = 600, onDone = null) {
    this.fadeTo(this.baseVolume, durationMs, onDone);
  }
}

export const music = new MusicManager(
  CONFIG.AUDIO.MUSIC.TRACKS,
  CONFIG.AUDIO.MUSIC.VOLUME
);

