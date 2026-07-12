import badFailAudio from "../../assets/audio/bad_fail.mp3";
import clickAudio from "../../assets/audio/click.mp3";
import confirmAudio from "../../assets/audio/confirm.mp3";
import mainThemeAudio from "../../assets/audio/main_theme.mp3";
import menuMusicAudio from "../../assets/audio/menu_music.mp3";
import neutralAudio from "../../assets/audio/neutral.mp3";
import roadMusicAudio from "../../assets/audio/road_music.mp3";
import selectAudio from "../../assets/audio/select.mp3";
import startAudio from "../../assets/audio/start.mp3";
import successAudio from "../../assets/audio/success.mp3";

const DEFAULT_MUSIC_FADE_MS = 900;
const OPENING_THEME_FADE_MS = 1400;
const MUSIC_VOLUME_SCALE = 0.3;
const SFX_VOLUME_SCALE = 0.7;

const MUSIC_TRACKS = Object.freeze({
  main_theme: { src: mainThemeAudio, volume: 0.52 },
  menu_music: { src: menuMusicAudio, volume: 0.42 },
  road_music: { src: roadMusicAudio, volume: 0.5 }
});

const SFX_TRACKS = Object.freeze({
  bad_fail: { src: badFailAudio, volume: 0.92 },
  click: { src: clickAudio, volume: 0.3 },
  confirm: { src: confirmAudio, volume: 0.84 },
  neutral: { src: neutralAudio, volume: 0.78 },
  select: { src: selectAudio, volume: 0.82 },
  start: { src: startAudio, volume: 0.9 },
  success: { src: successAudio, volume: 0.9 }
});

export function createAudioController() {
  const musicPlayers = new Map(
    Object.entries(MUSIC_TRACKS).map(([cue, track]) => {
      const audio = new Audio(track.src);
      audio.preload = "auto";
      audio.loop = true;
      audio.volume = 0;
      return [cue, audio];
    })
  );
  let armed = false;
  let activeMusicCue = null;
  let activeMusicPlayer = null;
  let fadeToken = 0;

  function arm() {
    armed = true;
  }

  function syncMusic(nextCue, options = {}) {
    const cue = typeof nextCue === "string" && nextCue.length > 0 ? nextCue : null;
    const fadeMs = getMusicFadeDuration(activeMusicCue, cue, options);

    if (!armed) {
      stopMusic();
      return;
    }

    if (cue === activeMusicCue && activeMusicPlayer) {
      if (activeMusicPlayer.paused) {
        playAudio(activeMusicPlayer);
        const token = ++fadeToken;
        fadePlayer(activeMusicPlayer, activeMusicPlayer.volume, getMusicVolume(cue), {
          durationMs: fadeMs,
          isCurrent: () => token === fadeToken
        });
      }
      return;
    }

    const previousPlayer = activeMusicPlayer;
    const nextPlayer = cue ? musicPlayers.get(cue) ?? null : null;
    const token = ++fadeToken;

    activeMusicCue = cue;
    activeMusicPlayer = nextPlayer;

    if (previousPlayer) {
      fadePlayer(previousPlayer, previousPlayer.volume, 0, {
        durationMs: fadeMs,
        isCurrent: () => token === fadeToken,
        onComplete: () => {
          if (token !== fadeToken) {
            return;
          }

          previousPlayer.pause();
          previousPlayer.currentTime = 0;
        }
      });
    }

    if (!nextPlayer) {
      return;
    }

    nextPlayer.pause();
    nextPlayer.currentTime = 0;
    nextPlayer.volume = 0;
    playAudio(nextPlayer);
    fadePlayer(nextPlayer, 0, getMusicVolume(cue), {
      durationMs: fadeMs,
      isCurrent: () => token === fadeToken
    });
  }

  function playSfx(cue) {
    if (!armed || !(cue in SFX_TRACKS)) {
      return;
    }

    const track = SFX_TRACKS[cue];
    const audio = new Audio(track.src);
    audio.preload = "auto";
    audio.volume = clampVolume(track.volume * SFX_VOLUME_SCALE);
    playAudio(audio);
  }

  function stopMusic() {
    fadeToken += 1;
    activeMusicCue = null;
    activeMusicPlayer = null;

    for (const player of musicPlayers.values()) {
      player.pause();
      player.currentTime = 0;
      player.volume = 0;
    }
  }

  return {
    arm,
    playSfx,
    stopMusic,
    syncMusic
  };
}

function fadePlayer(
  player,
  startVolume,
  endVolume,
  { durationMs = DEFAULT_MUSIC_FADE_MS, isCurrent = () => true, onComplete } = {}
) {
  const safeStart = clampVolume(startVolume);
  const safeEnd = clampVolume(endVolume);
  const safeDurationMs = Math.max(1, Number(durationMs) || DEFAULT_MUSIC_FADE_MS);

  if (Math.abs(safeStart - safeEnd) < 0.01) {
    player.volume = safeEnd;
    onComplete?.();
    return;
  }

  const startedAt = window.performance.now();
  player.volume = safeStart;

  function update(now) {
    if (!isCurrent()) {
      return;
    }

    const progress = Math.min(1, Math.max(0, (now - startedAt) / safeDurationMs));
    const easedProgress = easeInOut(progress);
    player.volume = clampVolume(safeStart + (safeEnd - safeStart) * easedProgress);

    if (progress < 1) {
      window.requestAnimationFrame(update);
      return;
    }

    onComplete?.();
  }

  window.requestAnimationFrame(update);
}

function playAudio(audio) {
  const playPromise = audio.play();

  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {});
  }
}

function getMusicVolume(cue) {
  return clampVolume((MUSIC_TRACKS[cue]?.volume ?? 0) * MUSIC_VOLUME_SCALE);
}

function getMusicFadeDuration(previousCue, nextCue, options = {}) {
  if (
    options.openingTripStart === true &&
    previousCue === "main_theme" &&
    nextCue === "menu_music"
  ) {
    return OPENING_THEME_FADE_MS;
  }

  return DEFAULT_MUSIC_FADE_MS;
}

function easeInOut(value) {
  const progress = Math.min(1, Math.max(0, Number(value) || 0));
  return progress * progress * (3 - 2 * progress);
}

function clampVolume(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}
