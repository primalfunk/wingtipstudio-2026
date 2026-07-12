import { GRADE_LABELS, type GameSnapshot } from "../game/types";

export function hud(snapshot: GameSnapshot): string {
  void snapshot.ammoMode;
  return `
    <div class="hud-score"><span>Score</span><strong>${snapshot.score}</strong></div>
    <div class="hud-center"><span>${GRADE_LABELS[snapshot.grade]}</span><strong>Level ${snapshot.gameLevel}</strong></div>
    <div class="hud-right">
      <div class="hud-health" aria-label="Health ${snapshot.baseHealth} of 5"><span class="hud-label">Health</span><div class="health-icons">${healthPips(snapshot.baseHealth)}</div></div>
      <div class="hud-mini hud-streak"><span>Streak</span><strong><i aria-hidden="true">⚡</i>${snapshot.streak}</strong></div>
      <div class="hud-mini hud-accuracy"><span>Accuracy</span><strong>${snapshot.accuracy}%</strong></div>
    </div>
  `;
}

function healthPips(health: number): string {
  return Array.from({ length: 5 }, (_, index) => `<span class="${index < health ? "lit" : ""}"></span>`).join("");
}
