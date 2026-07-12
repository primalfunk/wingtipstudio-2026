import { CONFIG } from "../game/config.js";

const { SCOREBOARD } = CONFIG.UI;
const SCORE_ENDPOINT = SCOREBOARD.ENDPOINT;
const MIN_QUALIFY_SCORE = SCOREBOARD.MIN_QUALIFY_SCORE;
const NAME_MAX_LENGTH = SCOREBOARD.NAME_MAX_LENGTH;

function qualifies(score, scores) {
  if (score < MIN_QUALIFY_SCORE) {
    return false;
  }
  if (!Array.isArray(scores) || scores.length < 10) {
    return true;
  }
  const tenth = scores[9]?.score ?? 0;
  return score >= tenth;
}

function sanitizeName(value) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "")
    .slice(0, NAME_MAX_LENGTH);
}

function renderLeaderboard(scores) {
  const wrap = document.createElement("div");
  wrap.className = "leaderboard-wrap";

  const title = document.createElement("div");
  title.className = "leaderboard-title";
  title.textContent = "High Scores";
  wrap.appendChild(title);

  const list = document.createElement("div");
  list.className = "leaderboard-list";

  const entries = Array.isArray(scores) ? scores.slice(0, 10) : [];
  const padded = entries.slice();
  while (padded.length < 10) {
    padded.push({ name: "---", score: 0 });
  }

  padded.forEach((entry, index) => {
    const row = document.createElement("div");
    row.className = "leaderboard-row";
    if (entry.isNew) {
      row.classList.add("is-new");
    }

    const rank = document.createElement("div");
    rank.className = "leaderboard-rank";
    rank.textContent = `${index + 1}.`;

    const name = document.createElement("div");
    name.className = "leaderboard-name";
    name.textContent = entry.name || "---";

    const value = document.createElement("div");
    value.className = "leaderboard-score";
    const numericScore = Number(entry.score);
    value.textContent = Number.isFinite(numericScore)
      ? numericScore.toLocaleString("en-US")
      : "0";

    row.appendChild(rank);
    row.appendChild(name);
    row.appendChild(value);
    list.appendChild(row);
  });

  wrap.appendChild(list);
  return wrap;
}

export function showGameOverModal(root, stats, onClose) {
  if (!root) {
    return null;
  }

  const overlay = document.createElement("div");
  overlay.className = "overlay gameover-modal";

  const panel = document.createElement("div");
  panel.className = "gameover-panel";

  const title = document.createElement("div");
  title.className = "gameover-title";
  title.textContent = "Game Over";

  const subtitle = document.createElement("div");
  subtitle.className = "gameover-subtitle";
  subtitle.textContent = "Loading leaderboard...";

  panel.appendChild(title);
  if (stats) {
    const statsWrap = document.createElement("div");
    statsWrap.className = "gameover-stats";

    const scoreLine = document.createElement("div");
    scoreLine.textContent = `Score: ${Math.round(stats.score || 0)}`;

    const distanceLine = document.createElement("div");
    const distance = Math.round(stats.distanceTraveled || 0);
    distanceLine.textContent = `Distance: ${distance}u`;

    const timeLine = document.createElement("div");
    const time = (stats.timeSpent || 0).toFixed(1);
    timeLine.textContent = `Time: ${time}s`;

    const surveyedLine = document.createElement("div");
    surveyedLine.textContent = `Surveyed: ${stats.surveyed || 0}`;

    statsWrap.appendChild(scoreLine);
    statsWrap.appendChild(distanceLine);
    statsWrap.appendChild(timeLine);
    statsWrap.appendChild(surveyedLine);
    panel.appendChild(statsWrap);
  }
  const content = document.createElement("div");
  content.className = "gameover-content";

  panel.appendChild(subtitle);
  panel.appendChild(content);
  overlay.appendChild(panel);
  root.appendChild(overlay);

  let closed = false;
  let canClose = true;
  const close = () => {
    if (closed || !canClose) {
      return;
    }
    closed = true;
    cleanup();
    if (onClose) {
      onClose();
    }
  };

  overlay.addEventListener("pointerdown", close);

  const finalScore = Math.round(stats?.score || 0);

  const showError = (message) => {
    subtitle.textContent = message;
    canClose = true;
  };

  const showLeaderboard = (scores) => {
    content.innerHTML = "";
    content.appendChild(renderLeaderboard(scores));
    subtitle.textContent = "Tap to return";
    canClose = true;
  };

  const showEntryForm = (scores) => {
    canClose = false;
    subtitle.textContent = "New High Score!";
    content.innerHTML = "";

    const entryWrap = document.createElement("div");
    entryWrap.className = "score-entry";

    const label = document.createElement("div");
    label.className = "score-entry-label";
    label.textContent = "Enter Callsign";

    const input = document.createElement("input");
    input.className = "score-entry-input";
    input.type = "text";
    input.maxLength = NAME_MAX_LENGTH;
    input.placeholder = "AAA";
    input.value = "";

    input.addEventListener("input", () => {
      input.value = sanitizeName(input.value);
    });

    const actions = document.createElement("div");
    actions.className = "score-entry-actions";

    const submit = document.createElement("button");
    submit.type = "button";
    submit.className = "score-entry-button";
    submit.textContent = "OK";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "score-entry-button ghost";
    cancel.textContent = "Cancel";

    actions.appendChild(submit);
    actions.appendChild(cancel);

    entryWrap.appendChild(label);
    entryWrap.appendChild(input);
    entryWrap.appendChild(actions);
    content.appendChild(entryWrap);
    content.appendChild(renderLeaderboard(scores));

    input.focus();

    const submitScore = async () => {
      const name = sanitizeName(input.value) || "ANON";
      submit.disabled = true;
      cancel.disabled = true;
      try {
        const res = await fetch(SCORE_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, score: finalScore })
        });
        if (!res.ok) {
          throw new Error("submit failed");
        }
      } catch (err) {
        showError("Score submission failed");
        return;
      }

      let updated = [];
      try {
        const res = await fetch(SCORE_ENDPOINT);
        if (res.ok) {
          updated = await res.json();
        }
      } catch (err) {
        showError("Score submission failed");
        return;
      }

      const highlight = updated.map((entry) => ({ ...entry }));
      const matchIndex = highlight.findIndex(
        (entry) => entry.name === name && entry.score === finalScore
      );
      if (matchIndex >= 0) {
        highlight[matchIndex] = { ...highlight[matchIndex], isNew: true };
      }
      showLeaderboard(highlight);
    };

    submit.addEventListener("click", submitScore);
    cancel.addEventListener("click", () => {
      showLeaderboard(scores);
    });
  };

  const loadLeaderboard = async () => {
    if (finalScore < MIN_QUALIFY_SCORE) {
      subtitle.textContent = `Score below ${MIN_QUALIFY_SCORE}. Tap to return`;
      content.innerHTML = "";
      canClose = true;
      return;
    }

    let scores = [];
    try {
      const res = await fetch(SCORE_ENDPOINT);
      if (!res.ok) {
        throw new Error("fetch failed");
      }
      scores = await res.json();
    } catch (err) {
      showError("Leaderboard unavailable");
      return;
    }

    if (qualifies(finalScore, scores)) {
      showEntryForm(scores);
    } else {
      showLeaderboard(scores);
    }
  };

  loadLeaderboard();

  function cleanup() {
    overlay.removeEventListener("pointerdown", close);
    overlay.remove();
  }

  return {
    destroy: cleanup,
    close
  };
}


