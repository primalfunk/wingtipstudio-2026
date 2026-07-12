import { sounds } from "../game/audio.js";
import { CONFIG } from "../game/config.js";

const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"];

function isImageAsset(value) {
  if (typeof value !== "string") {
    return false;
  }
  if (value.startsWith("data:image/")) {
    return true;
  }
  const lower = value.toLowerCase();
  return IMAGE_EXTS.some((ext) => lower.endsWith(ext));
}

function collectAssetUrls(source, output) {
  if (!source) {
    return;
  }
  if (typeof source === "string") {
    if (isImageAsset(source)) {
      output.add(source);
    }
    return;
  }
  if (Array.isArray(source)) {
    for (const entry of source) {
      collectAssetUrls(entry, output);
    }
    return;
  }
  if (typeof source === "object") {
    for (const entry of Object.values(source)) {
      collectAssetUrls(entry, output);
    }
  }
}

function preloadImages(urls, onProgress) {
  if (!urls.length) {
    if (typeof onProgress === "function") {
      onProgress(1);
    }
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let remaining = urls.length;
    const total = urls.length;
    const done = () => {
      remaining -= 1;
      if (typeof onProgress === "function") {
        onProgress((total - remaining) / total);
      }
      if (remaining <= 0) {
        resolve();
      }
    };
    for (const src of urls) {
      const img = new Image();
      img.onload = done;
      img.onerror = done;
      img.src = src;
    }
  });
}

export function showStartScreen(root, onStart, onReset, options = {}) {
  if (!root) {
    return null;
  }
  const { onReady } = options;
  root.classList.add("start-screen-active");
  const bootScreen = document.getElementById("boot-screen");

  const overlay = document.createElement("div");
  overlay.className = "overlay start-screen";
  if (bootScreen) {
    overlay.style.opacity = "0";
    overlay.style.pointerEvents = "none";
  }

  const panel = document.createElement("div");
  panel.className = "start-panel";

  const title = document.createElement("div");
  title.className = "start-title";
  title.textContent = "Concordant (V0.6)";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "start-button start-capsule";
  button.textContent = "Loading...";
  button.disabled = true;


  const blurb = document.createElement("div");
  blurb.className = "start-blurb";
  blurb.textContent = "Conserve fuel. Uncover a lost civilization.";

  const carousel = document.createElement("div");
  carousel.className = "start-carousel";

  const slides = [];
  const addSlide = (content) => {
    const slide = document.createElement("div");
    slide.className = "start-slide";
    slide.appendChild(content);
    carousel.appendChild(slide);
    slides.push(slide);
  };

  const controls = document.createElement("div");
  controls.className = "start-card start-controls";
  const controlsTitle = document.createElement("div");
  controlsTitle.className = "start-controls-title";
  controlsTitle.textContent = "Flight Controls";
  const controlsList = document.createElement("div");
  controlsList.className = "start-controls-list";
  const controlEntries = [
    { keys: "TOUCH", desc: "Left stick to steer/thrust, right button to fire" },
    { keys: "MOUSE", desc: "Aim / LMB fire / RMB thrust" },
    { keys: "HUD", desc: "Tap X to return to start" }
  ];
  for (const entry of controlEntries) {
    const row = document.createElement("div");
    row.className = "start-controls-item";
    const keys = document.createElement("div");
    keys.className = "start-controls-keys";
    keys.textContent = entry.keys;
    const desc = document.createElement("div");
    desc.className = "start-controls-desc";
    desc.textContent = entry.desc;
    row.appendChild(keys);
    row.appendChild(desc);
    controlsList.appendChild(row);
  }
  controls.appendChild(controlsTitle);
  controls.appendChild(controlsList);
  addSlide(controls);

  const legend = document.createElement("div");
  legend.className = "start-card start-legend";
  const legendTitle = document.createElement("div");
  legendTitle.className = "start-legend-title";
  legendTitle.textContent = "Field Legend";
  legend.appendChild(legendTitle);

  const legendList = document.createElement("div");
  legendList.className = "start-legend-list";
  const pickDistinctHues = () => {
    const hueA = Math.floor(Math.random() * 360);
    let hueB = Math.floor(Math.random() * 360);
    let guard = 0;
    while (Math.abs(hueA - hueB) < 40 && guard < 10) {
      hueB = Math.floor(Math.random() * 360);
      guard += 1;
    }
    return [hueA, hueB];
  };
  const resourceHues = pickDistinctHues();

  const legendEntries = [
    {
      icon: "ship",
      name: "Player - Surveyor Class",
      desc: "Pilot this craft. Dodge hazards, deliver surveys."
    },
    {
      icon: "star",
      name: "Stars - Gravity Wells",
      desc: "Pull you in. Avoid the core."
    },
    {
      icon: "asteroid",
      name: "Asteroids - Drift Rocks",
      desc: "Shoot for points. Fragments still hurt."
    },
    {
      icon: "enemy",
      name: "Enemy Ships - Raiders",
      desc: "Hunt you down. Take them out for bonus."
    },
    {
      icon: "fuel",
      name: "Fuel - Charge Pods",
      desc: "Refill tank to keep thrusting."
    },
    {
      icon: "resource",
      dual: true,
      name: "Resources - Upgrade Currency",
      desc: "Collect crystals to buy upgrades."
    },
    {
      icon: "survey",
      name: "Survey Sites - Drop Zones",
      desc: "Deliver surveys to score and advance."
    }
  ];

  for (const entry of legendEntries) {
    const item = document.createElement("div");
    item.className = "start-legend-item";

    let icon = null;
    if (entry.icon === "resource" && entry.dual) {
      icon = document.createElement("div");
      icon.className = "start-legend-icon legend-resource-duo";
      resourceHues.forEach((hue) => {
        const crystal = document.createElement("div");
        crystal.className = "legend-resource-crystal";
        crystal.style.filter = `sepia(1) saturate(5) hue-rotate(${hue}deg) brightness(1.1)`;
        icon.appendChild(crystal);
      });
    } else {
      icon = document.createElement("div");
      icon.className = `start-legend-icon legend-${entry.icon}`;
    }

    const text = document.createElement("div");
    text.className = "start-legend-text";

    const name = document.createElement("div");
    name.className = "start-legend-name";
    name.textContent = entry.name;

    const desc = document.createElement("div");
    desc.className = "start-legend-desc";
    desc.textContent = entry.desc;

    text.appendChild(name);
    text.appendChild(desc);
    item.appendChild(icon);
    item.appendChild(text);
    legendList.appendChild(item);
  }
  legend.appendChild(legendList);
  addSlide(legend);

  const scores = document.createElement("div");
  scores.className = "start-card start-scores";
  const scoresTitle = document.createElement("div");
  scoresTitle.className = "start-scores-title";
  scoresTitle.textContent = "High Scores";
  const scoresList = document.createElement("div");
  scoresList.className = "start-scores-list";
  const defaultScores = [
    { name: "WINGTIP", score: 75000 },
    { name: "WINGTIP", score: 52000 },
    { name: "WINGTIP", score: 37000 },
    { name: "WINGTIP", score: 23300 },
    { name: "WINGTIP", score: 12500 },
    { name: "WINGTIP", score: 5900 },
    { name: "WINGTIP", score: 3800 },
    { name: "WINGTIP", score: 1400 },
    { name: "WINGTIP", score: 600 },
    { name: "WINGTIP", score: 100 }
  ];

  const renderScores = (entries) => {
    scoresList.innerHTML = "";
    const list = Array.isArray(entries) ? entries.slice(0, 10) : [];
    const padded = list.length ? list.slice() : defaultScores.slice(0, 10);
    while (padded.length < 10) {
      padded.push({ name: "---", score: 0 });
    }

    padded.forEach((entry, index) => {
      const row = document.createElement("div");
      row.className = "start-scores-row";
      const rank = document.createElement("div");
      rank.className = "start-scores-rank";
      rank.textContent = `${index + 1}.`;
      const name = document.createElement("div");
      name.className = "start-scores-name";
      name.textContent = entry.name || "---";
      const value = document.createElement("div");
      value.className = "start-scores-value";
      const numericScore = Number(entry.score);
      value.textContent = Number.isFinite(numericScore)
        ? numericScore.toLocaleString("en-US")
        : "0";
      row.appendChild(rank);
      row.appendChild(name);
      row.appendChild(value);
      scoresList.appendChild(row);
    });
  };

  renderScores(defaultScores);
  scores.appendChild(scoresTitle);
  scores.appendChild(scoresList);
  addSlide(scores);

  const loadScores = async () => {
    try {
      const res = await fetch("/api/score/");
      if (!res.ok) {
        throw new Error("fetch failed");
      }
      const data = await res.json();
      renderScores(data);
    } catch (err) {
      renderScores([]);
    }
  };

  loadScores();

  let slideIndex = 0;
  slides[slideIndex].classList.add("is-active");
  const slideTimer = setInterval(() => {
    slides[slideIndex].classList.remove("is-active");
    slideIndex = (slideIndex + 1) % slides.length;
    slides[slideIndex].classList.add("is-active");
  }, 4200);

  panel.appendChild(title);
  panel.appendChild(carousel);
  panel.appendChild(button);
  panel.appendChild(blurb);
  overlay.appendChild(panel);
  root.appendChild(overlay);

  const bgLayer = document.createElement("div");
  bgLayer.className = "start-bg-layer";
  overlay.appendChild(bgLayer);

  const bgObjects = createBackgroundObjects(bgLayer, 6, 4);

  const hiddenExitButtons = [];
  const hideExitButtons = () => {
    const buttons = root.querySelectorAll(".exit-button");
    buttons.forEach((btn) => {
      if (!btn || btn.dataset.startHidden === "1") {
        return;
      }
      btn.dataset.startHidden = "1";
      hiddenExitButtons.push({
        el: btn,
        display: btn.style.display
      });
      btn.style.display = "none";
    });
  };
  hideExitButtons();

  let started = false;
  const start = (shouldReset = false) => {
    if (started) {
      return;
    }
    started = true;
    if (shouldReset && onReset) {
      onReset();
    }
    sounds.play("start_game");
    cleanup();
    if (onStart) {
      onStart();
    }
  };

  const handleStartClick = () => start(true);
  button.addEventListener("click", handleStartClick);

  let alive = true;
  function cleanup() {
    if (!alive) {
      return;
    }
    alive = false;
    button.removeEventListener("click", handleStartClick);
    for (const obj of bgObjects) {
      obj.stop();
    }
    clearInterval(slideTimer);
    root.classList.remove("start-screen-active");
    for (const entry of hiddenExitButtons) {
      if (!entry?.el) {
        continue;
      }
      entry.el.style.display = entry.display;
      entry.el.dataset.startHidden = "";
    }
    overlay.remove();
  }
  const startPreload = () => {
    const assetUrls = new Set();
    collectAssetUrls(CONFIG, assetUrls);
    sounds.preload();
    const finishBoot = () => {
      if (bootScreen) {
        bootScreen.classList.add("boot-exit");
        window.setTimeout(() => {
          if (bootScreen.parentElement) {
            bootScreen.remove();
          }
        }, 360);
      }
      overlay.style.opacity = "";
      overlay.style.pointerEvents = "auto";
    };

    preloadImages([...assetUrls]).finally(() => {
      if (!alive) {
        return;
      }
      button.disabled = false;
      button.textContent = "Start Game";
      finishBoot();
      if (typeof onReady === "function") {
        onReady();
      }
    });
  };
  requestAnimationFrame(startPreload);

  const destroy = () => cleanup();

  return {
    destroy,
    start
  };
}

function createBackgroundObjects(layer, starCount, asteroidCount) {
  const objects = [];
  const addObject = (className, sizeRange, speedRange) => {
    const el = document.createElement("div");
    el.className = `start-bg-object ${className}`;
    const size = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
    const startX = Math.random() * 120 - 10;
    const startY = Math.random() * 120 - 10;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.left = `${startX}%`;
    el.style.top = `${startY}%`;
    layer.appendChild(el);

    let angle = Math.random() * Math.PI * 2;
    let speed = speedRange[0] + Math.random() * (speedRange[1] - speedRange[0]);
    let driftX = Math.cos(angle) * speed;
    let driftY = Math.sin(angle) * speed;
    let translateX = 0;
    let translateY = 0;
    let lastTime = performance.now();
    let raf = 0;

    const step = (time) => {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      translateX += driftX * dt;
      translateY += driftY * dt;

      if (translateX > 140 || translateX < -140) {
        driftX *= -1;
      }
      if (translateY > 140 || translateY < -140) {
        driftY *= -1;
      }

      el.style.transform = `translate(${translateX}px, ${translateY}px)`;
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);

    return {
      stop: () => cancelAnimationFrame(raf)
    };
  };

  for (let i = 0; i < starCount; i++) {
    objects.push(addObject("bg-star", [6, 16], [6, 14]));
  }
  for (let i = 0; i < asteroidCount; i++) {
    objects.push(addObject("bg-asteroid", [10, 22], [4, 9]));
  }

  return objects;
}
