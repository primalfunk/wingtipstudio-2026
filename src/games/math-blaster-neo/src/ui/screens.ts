import { gameplayImages } from "../assets/images/gameplay";
import { DEFAULT_SETTINGS } from "../game/SettingsManager";
import { GRADE_LABELS, type GameSnapshot, type GradeLevel, type Profile, type Settings, type StoredData } from "../game/types";

const gradeKeys: GradeLevel[] = ["K", "1", "2", "3", "4", "5", "6"];

export function titleScreen(activeName: string | null): string {
  return `<main class="title-screen">
    <canvas id="equation-rain-canvas" class="equation-rain-canvas" aria-hidden="true"></canvas>
    <div class="title-vignette" aria-hidden="true"></div>
    <div class="title-led-border" aria-hidden="true">${titleLedTrail()}</div>
    <section class="title-content" aria-labelledby="main-title">
      <h1 id="main-title" class="sr-only">Math Blaster Neo</h1>
      <img class="title-menu-art" src="${gameplayImages.menu}" alt="" aria-hidden="true" />
      <div class="title-menu-panel">
        <p class="title-profile">Active profile: <strong>${escapeHtml(activeName ?? "None selected")}</strong></p>
        <div class="title-actions">
          <button class="primary title-play-button" data-action="play">Play</button>
          <button data-action="profiles">Profiles</button>
          <button data-action="settings">Settings</button>
        </div>
      </div>
    </section>
  </main>`;
}

function titleLedTrail(): string {
  const count = 44;
  const inset = 1.2;
  const points: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const p = i / count;
    let left = inset;
    let top = inset;
    if (p < 0.25) {
      left = inset + (100 - inset * 2) * (p / 0.25);
      top = inset;
    } else if (p < 0.5) {
      left = 100 - inset;
      top = inset + (100 - inset * 2) * ((p - 0.25) / 0.25);
    } else if (p < 0.75) {
      left = 100 - inset - (100 - inset * 2) * ((p - 0.5) / 0.25);
      top = 100 - inset;
    } else {
      left = inset;
      top = 100 - inset - (100 - inset * 2) * ((p - 0.75) / 0.25);
    }
    points.push(`<span style="--left:${left.toFixed(3)}%;--top:${top.toFixed(3)}%;--delay:${(-i * 0.075).toFixed(3)}s"></span>`);
  }
  return points.join("");
}

export function profileScreen(data: StoredData): string {
  const profiles = data.profiles.map(profileRow).join("") || `<p class="small">No profiles yet. Create one to start playing.</p>`;
  return `<main class="screen">
    <section class="panel stack">
      <div class="row"><h2>Profiles</h2><button data-action="home">Main Menu</button></div>
      <div class="stack">${profiles}</div>
      <form class="stack" data-form="profile">
        <label>New profile name<input name="name" maxlength="24" autocomplete="off" placeholder="Player name" /></label>
        <button class="primary" type="submit">Create Profile</button>
      </form>
    </section>
  </main>`;
}

function profileRow(profile: Profile): string {
  return `<div class="list-item">
    <div><strong>${escapeHtml(profile.name)}</strong><div class="small">${GRADE_LABELS[profile.selectedGrade]} · ${profile.statsByGrade[profile.selectedGrade].gamesPlayed} games</div></div>
    <button data-action="select-profile" data-id="${profile.id}">Select</button>
    <button class="danger" data-action="delete-profile" data-id="${profile.id}">Delete</button>
  </div>`;
}

export function gradeScreen(selected: GradeLevel): string {
  return `<main class="title-screen grade-select-screen">
    <canvas id="equation-rain-canvas" class="equation-rain-canvas" aria-hidden="true"></canvas>
    <div class="title-vignette" aria-hidden="true"></div>
    <div class="title-led-border" aria-hidden="true">${titleLedTrail()}</div>
    <section class="title-content grade-select-content" aria-labelledby="grade-title">
      <img class="grade-menu-art" src="${gameplayImages.menu}" alt="" aria-hidden="true" />
      <div class="title-menu-panel grade-menu-panel">
        <div class="grade-menu-heading">
          <h2 id="grade-title">Choose Grade</h2>
          <button data-action="home">Main Menu</button>
        </div>
        <div class="grade-actions">
          ${gradeKeys.map((grade) => `<button class="${grade === selected ? "primary" : ""}" data-action="grade" data-grade="${grade}">${GRADE_LABELS[grade]}</button>`).join("")}
        </div>
      </div>
    </section>
  </main>`;
}

export function settingsScreen(settings: Settings): string {
  const all = { ...DEFAULT_SETTINGS, ...settings };
  return `<main class="screen">
    <section class="panel stack">
      <div class="row"><h2>Settings</h2><button data-action="home">Main Menu</button></div>
      ${setting("colorblindSafe", "Colorblind-safe mode", all.colorblindSafe)}
      ${setting("dyslexiaFont", "Dyslexia-friendly font", all.dyslexiaFont)}
      ${setting("audioEnabled", "Audio on", all.audioEnabled)}
      ${setting("reducedMotion", "Reduced motion", all.reducedMotion)}
      ${setting("highContrast", "High contrast", all.highContrast)}
    </section>
  </main>`;
}

function setting(key: keyof Settings, label: string, checked: boolean): string {
  return `<label class="setting"><span>${label}</span><input type="checkbox" data-setting="${key}" ${checked ? "checked" : ""}></label>`;
}

export function gameScreen(snapshot: GameSnapshot): string {
  return `<main class="game-layout">
    <header class="hud" id="hud"></header>
    <section class="canvas-wrap"><canvas id="game-canvas" aria-label="Math Blaster Neo game board"></canvas></section>
    <button class="pause-button" data-action="pause">Pause</button>
  </main>`;
}

export function pauseOverlay(): string {
  return `<div class="pause-overlay" id="pause-overlay">
    <section class="panel stack" style="max-width:420px">
      <h2>Paused</h2>
      <button class="primary" data-action="resume">Resume</button>
      <button data-action="home">Main Menu</button>
    </section>
  </div>`;
}

export function gameOverScreen(snapshot: GameSnapshot, highScore: number): string {
  return `<main class="screen game-over-screen">
    <section class="panel stack game-over-panel">
      <h2>Game Over</h2>
      <div class="grid">
        <p>Final score<br><strong>${snapshot.score}</strong></p>
        <p>High score<br><strong>${highScore}</strong></p>
        <p>Level reached<br><strong>${snapshot.gameLevel}</strong></p>
        <p>Accuracy<br><strong>${snapshot.accuracy}%</strong></p>
        <p>Correct<br><strong>${snapshot.correct}</strong></p>
        <p>Misses<br><strong>${snapshot.misses}</strong></p>
      </div>
      <div class="grid">
        <button class="primary" data-action="play-again">Try Again</button>
        <button data-action="home">Quit to Menu</button>
      </div>
    </section>
  </main>`;
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
