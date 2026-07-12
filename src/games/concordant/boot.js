(() => {
  const canvas = document.getElementById("game");
  if (!canvas) {
    return;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const bootSeed = Date.now() * (typeof performance !== "undefined" ? performance.now() : 1);
  const TWO_PI = Math.PI * 2;
  const baseAngleStep = Math.PI / 60;
  const inputClamp = 4;
  const anchorRadius = 18;
  const anchorLineLength = 34;
  const anchorThickness = 1.2;
  const voidColor = "rgb(5, 7, 8)";

  let width = 0;
  let height = 0;
  let centerX = 0;
  let centerY = 0;
  let rafId = null;
  let handoffStart = null;
  let handoffComplete = false;

  const inputState = {
    offsetX: 0,
    offsetY: 0,
    targetX: 0,
    targetY: 0,
    rotation: 0,
    pulse: 0
  };

  const agreements = {
    core: false,
    seed: false,
    assets: false
  };

  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    centerX = width * 0.5;
    centerY = height * 0.5;
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const hash = (value) => {
    const s = Math.sin(value + bootSeed * 0.000001) * 43758.5453;
    return s - Math.floor(s);
  };

  const onMove = (event) => {
    const dx = (event.clientX - centerX) / (width || 1);
    const dy = (event.clientY - centerY) / (height || 1);
    inputState.targetX = clamp(dx * inputClamp * 6, -inputClamp, inputClamp);
    inputState.targetY = clamp(dy * inputClamp * 6, -inputClamp, inputClamp);
  };

  const onKey = () => {
    inputState.rotation += baseAngleStep;
  };

  const onClick = () => {
    inputState.pulse = 1;
  };

  const detachInputs = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mousedown", onClick);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", resize);
  };

  const attachInputs = () => {
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mousedown", onClick, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", resize);
  };

  const loadImage = (src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });

  const loadFonts = () => {
    if (!document.fonts || !document.fonts.load) {
      return Promise.resolve();
    }
    return Promise.all([
      document.fonts.load("500 16px Oxanium"),
      document.fonts.load("700 16px Oxanium")
    ]);
  };

  const preloadTierAssets = () => {
    const urls = [
      "assets/ui/sprites/ship.png",
      "assets/ui/sprites/yellow_star.png",
      "assets/ui/sprites/asteroid.png",
      "assets/ui/sprites/enemy_ship.png",
      "assets/ui/sprites/fuel.png",
      "assets/ui/sprites/crystal.png",
      "assets/ui/sprites/scan_point.png"
    ];
    return Promise.allSettled([
      loadFonts(),
      ...urls.map(loadImage)
    ]);
  };

  const coreReady = new Promise((resolve) => {
    let resolved = false;
    window.__GAME_READY__ = () => {
      if (resolved) {
        return;
      }
      resolved = true;
      agreements.core = true;
      resolve();
    };
  });

  const seedReady = new Promise((resolve) => {
    let resolved = false;
    window.__WORLD_SEED_READY__ = () => {
      if (resolved) {
        return;
      }
      resolved = true;
      agreements.seed = true;
      resolve();
    };
    if (Number.isFinite(window.__WORLD_SEED__)) {
      agreements.seed = true;
      resolve();
    }
  });

  const assetsReady = preloadTierAssets().then(() => {
    agreements.assets = true;
  });

  const allReady = Promise.all([coreReady, seedReady, assetsReady]).then(() => {
    handoffStart = performance.now();
  });

  const bundleCandidates = ["game.bundle.js", "dist/game.bundle.js"];
  const injectScript = (src) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    document.body.appendChild(script);
  };
  const looksLikeHtml = (text) => {
    const trimmed = text.trimStart();
    return trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html") || trimmed.startsWith("<");
  };
  const loadBundle = async () => {
    for (const candidate of bundleCandidates) {
      try {
        const res = await fetch(candidate, { cache: "no-store" });
        if (!res.ok) {
          continue;
        }
        const text = await res.text();
        if (!text || looksLikeHtml(text)) {
          continue;
        }
        const blob = new Blob([text], { type: "text/javascript" });
        const url = URL.createObjectURL(blob);
        const script = document.createElement("script");
        script.src = url;
        script.async = true;
        script.onload = () => URL.revokeObjectURL(url);
        document.body.appendChild(script);
        return;
      } catch (err) {
        // Try next candidate.
      }
    }
    injectScript(bundleCandidates[0]);
  };
  void loadBundle();

  const getPhase = () => {
    if (!agreements.core) {
      return 0;
    }
    if (!agreements.seed) {
      return 1;
    }
    if (!agreements.assets) {
      return 2;
    }
    return 3;
  };

  const drawAnchor = (time, phase, alphaScale, rotation) => {
    const t = time * 0.001;
    const pulse = inputState.pulse;
    const progress = Math.min(1, Math.max(0.08, (phase + 1) / 4));
    const logoY = centerY - 26 + inputState.offsetY;
    const orbitRadius = Math.min(width, height) * 0.09;
    const glow = 0.5 + Math.sin(t * 2.2) * 0.12 + pulse * 0.12;
    const sweep = ((t * 0.24) % 1) * Math.PI * 2;

    ctx.save();
    ctx.globalAlpha = alphaScale;
    ctx.fillStyle = voidColor;
    ctx.fillRect(0, 0, width, height);

    const bgGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width, height) * 0.55);
    bgGradient.addColorStop(0, `rgba(120, 200, 190, ${0.13 * alphaScale})`);
    bgGradient.addColorStop(0.28, `rgba(45, 90, 100, ${0.08 * alphaScale})`);
    bgGradient.addColorStop(1, "rgba(5, 7, 8, 0)");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(centerX + inputState.offsetX * 0.8, logoY);
    ctx.rotate(rotation * 0.18);

    ctx.strokeStyle = `rgba(120, 200, 190, ${0.24 + glow * 0.18})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, orbitRadius, sweep, sweep + Math.PI * 1.25);
    ctx.stroke();

    ctx.strokeStyle = `rgba(210, 185, 150, ${0.18 + glow * 0.14})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, orbitRadius * 0.62, -sweep * 0.7, -sweep * 0.7 + Math.PI * 0.92);
    ctx.stroke();

    for (let i = 0; i < 6; i++) {
      const angle = t * 0.45 + i * (TWO_PI / 6);
      const radius = orbitRadius * (0.78 + hash(i) * 0.22);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      ctx.fillStyle = i % 3 === 0
        ? "rgba(210, 185, 150, 0.78)"
        : "rgba(120, 200, 190, 0.55)";
      ctx.beginPath();
      ctx.arc(x, y, i % 3 === 0 ? 2.4 : 1.5, 0, TWO_PI);
      ctx.fill();
    }

    ctx.shadowColor = "rgba(120, 220, 210, 0.32)";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "rgba(232, 242, 242, 0.96)";
    ctx.font = "700 42px Oxanium, Orbitron, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("CONCORDANT", 0, 0);
    ctx.shadowBlur = 0;

    const metricsWidth = Math.min(340, width * 0.54);
    const shineX = -metricsWidth * 0.55 + ((t * 42) % (metricsWidth * 1.1));
    const shine = ctx.createLinearGradient(shineX - 40, -28, shineX + 40, 28);
    shine.addColorStop(0, "rgba(255, 255, 255, 0)");
    shine.addColorStop(0.5, "rgba(255, 255, 255, 0.18)");
    shine.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = shine;
    ctx.fillRect(-metricsWidth * 0.58, -31, metricsWidth * 1.16, 62);
    ctx.restore();

    ctx.save();
    ctx.translate(centerX, centerY + 74);
    ctx.fillStyle = "rgba(170, 188, 194, 0.78)";
    ctx.font = "500 13px Oxanium, Orbitron, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const dots = ".".repeat(1 + Math.floor(t * 1.5) % 3);
    ctx.fillText(`LOADING${dots}`, 0, 0);

    const railW = Math.min(300, width * 0.48);
    ctx.fillStyle = "rgba(120, 170, 180, 0.16)";
    ctx.fillRect(-railW / 2, 28, railW, 2);
    const fillW = railW * progress;
    const railGradient = ctx.createLinearGradient(-railW / 2, 0, railW / 2, 0);
    railGradient.addColorStop(0, "rgba(120, 200, 190, 0.8)");
    railGradient.addColorStop(1, "rgba(210, 185, 150, 0.9)");
    ctx.fillStyle = railGradient;
    ctx.fillRect(-railW / 2, 28, fillW, 2);

    ctx.fillStyle = "rgba(120, 170, 180, 0.56)";
    ctx.font = "500 10px Oxanium, Orbitron, Consolas, monospace";
    const phaseText = phase === 0
      ? "fetching star charts"
      : phase === 1
        ? "aligning world seed"
        : phase === 2
          ? "warming survey systems"
          : "launching";
    ctx.fillText(phaseText.toUpperCase(), 0, 52);
    ctx.restore();

    ctx.restore();
  };

  const draw = (time) => {
    ctx.fillStyle = voidColor;
    ctx.fillRect(0, 0, width, height);

    const phase = getPhase();
    const alphaScale = 0.9;
    const rotation = inputState.rotation;
    drawAnchor(time, phase, alphaScale, rotation);
  };

  const loop = (time) => {
    if (handoffComplete) {
      return;
    }

    inputState.offsetX += (inputState.targetX - inputState.offsetX) * 0.18;
    inputState.offsetY += (inputState.targetY - inputState.offsetY) * 0.18;
    inputState.pulse = Math.max(0, inputState.pulse - 0.035);

    if (handoffStart !== null) {
      const elapsed = time - handoffStart;
      const progress = clamp(elapsed / 750, 0, 1);
      const scale = 1 + progress * 3.2;
      const fade = 1 - progress;
      ctx.fillStyle = voidColor;
      ctx.fillRect(0, 0, width, height);
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(scale, scale);
      ctx.translate(-centerX, -centerY);
      drawAnchor(time, 3, fade, inputState.rotation);
      ctx.restore();
      if (progress >= 1 && !handoffComplete) {
        handoffComplete = true;
        detachInputs();
        if (typeof window.startApp === "function") {
          window.startApp();
        }
        return;
      }
    } else {
      draw(time);
    }

    rafId = requestAnimationFrame(loop);
  };

  resize();
  attachInputs();
  draw(performance.now());
  rafId = requestAnimationFrame(loop);
  void allReady;
})();
