import { HUD_COLORS, HUD_FONT } from "./hud.js";
import { CONFIG } from "./config.js";

const {
  SCORE: { POPUP: SCORE_POPUP, POPUP_COLORS: SCORE_POPUP_COLORS },
  EFFECTS: { CONTROL_DISABLE, TRAIL_DISPERSE, TRAIL_COLOR }
} = CONFIG;

function lerp(start, end, t) {
  return start + (end - start) * t;
}

function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rgba(color, alpha, scale = 1) {
  const r = Math.max(0, Math.min(255, Math.round(color[0] * scale)));
  const g = Math.max(0, Math.min(255, Math.round(color[1] * scale)));
  const b = Math.max(0, Math.min(255, Math.round(color[2] * scale)));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function drawTrail(ctx, trail, speed = 0) {
  if (!Array.isArray(trail) || trail.length < 2) {
    return;
  }

  const speedRatio = Math.min(1, speed / TRAIL_COLOR.SPEED);
  const trailR = Math.round(lerp(TRAIL_COLOR.SLOW[0], TRAIL_COLOR.FAST[0], speedRatio));
  const trailG = Math.round(lerp(TRAIL_COLOR.SLOW[1], TRAIL_COLOR.FAST[1], speedRatio));
  const trailB = Math.round(lerp(TRAIL_COLOR.SLOW[2], TRAIL_COLOR.FAST[2], speedRatio));

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = TRAIL_DISPERSE.BASE_WIDTH;
  ctx.setLineDash([]);
  const total = trail.length - 1;
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1];
    const b = trail[i];
    const t = i / total;
    const alpha = 0.05 + 0.35 * t;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = `rgba(${trailR}, ${trailG}, ${trailB}, ${alpha})`;
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1];
    const b = trail[i];
    const t = i / (trail.length - 1);
    const alpha = (0.08 + 0.35 * t) * (0.5 + speedRatio * 0.6);
    const width = TRAIL_DISPERSE.BASE_WIDTH + t * TRAIL_DISPERSE.SPREAD;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineWidth = width;
    ctx.strokeStyle = `rgba(${trailR}, ${trailG}, ${trailB}, ${alpha})`;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawBackgroundEvents(ctx, events, clock, ship, screenW, screenH) {
  if (!events || events.length === 0) {
    return;
  }

  const fadeIn = 0.18;
  const fadeOut = 0.18;

  for (const evt of events) {
    const elapsed = clock - evt.start;
    const t = Math.max(0, Math.min(1, elapsed / evt.duration));
    let alpha = 1;
    if (t < fadeIn) {
      alpha = t / fadeIn;
    } else if (t > 1 - fadeOut) {
      alpha = (1 - t) / fadeOut;
    }

    if (alpha <= 0) {
      continue;
    }

    const driftX = evt.driftX * elapsed;
    const driftY = evt.driftY * elapsed;
    const screenX = screenW / 2 + (evt.worldX - ship.x) * evt.parallax + driftX;
    const screenY = screenH / 2 + (evt.worldY - ship.y) * evt.parallax + driftY;
    const wobble = Math.sin((clock + evt.worldX) * 0.25) * 0.15;
    const hueShift = 0.85 + 0.3 * Math.sin((clock + evt.worldY) * 0.2);
    const swapPalette = t > 0.5;
    const [colorA, colorB, colorC] = swapPalette
      ? [evt.colors[1], evt.colors[2], evt.colors[0]]
      : evt.colors;

    if (evt.type === "quasar") {
      ctx.save();
      ctx.globalAlpha = alpha * 0.6;
      ctx.translate(screenX, screenY);
      ctx.rotate(evt.angle + wobble);
      const beamGrad = ctx.createLinearGradient(0, 0, evt.length, 0);
      beamGrad.addColorStop(0, rgba(colorA, 0, hueShift));
      beamGrad.addColorStop(0.5, rgba(colorB, 0.85, hueShift));
      beamGrad.addColorStop(1, rgba(colorA, 0, hueShift));
      ctx.strokeStyle = beamGrad;
      ctx.lineWidth = evt.width;
      ctx.beginPath();
      ctx.moveTo(-evt.length * 0.1, 0);
      ctx.lineTo(evt.length, 0);
      ctx.stroke();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = rgba(colorB, 0.55, hueShift);
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (evt.type === "supernova") {
      const radius = evt.radius + (evt.maxRadius - evt.radius) * t;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha * 0.6;
      const grad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);
      grad.addColorStop(0, rgba(colorA, 0.85, 1.1 * hueShift));
      grad.addColorStop(0.45, rgba(colorB, 0.55, hueShift));
      grad.addColorStop(1, rgba(colorC, 0, hueShift));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (evt.type === "nebulaBurst") {
      const radius = evt.radius * (0.8 + t * 0.6);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha * 0.5;
      ctx.translate(screenX, screenY);
      ctx.rotate(evt.rotation + t * 0.8 + wobble);
      ctx.strokeStyle = rgba(colorA, 0.6, hueShift);
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(0, 0, radius, -Math.PI / 3, Math.PI / 2);
      ctx.stroke();
      ctx.strokeStyle = rgba(colorB, 0.45, hueShift);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.7, Math.PI / 2, Math.PI * 1.1);
      ctx.stroke();
      ctx.restore();
    } else if (evt.type === "meteor") {
      const travel = evt.travel * t;
      const dirX = Math.cos(evt.angle);
      const dirY = Math.sin(evt.angle);
      ctx.save();
      ctx.globalAlpha = alpha * 0.55;
      for (let i = 0; i < evt.count; i++) {
        const offset = (i - (evt.count - 1) / 2) * 18;
        const sx = screenX + dirX * travel + -dirY * offset;
        const sy = screenY + dirY * travel + dirX * offset;
        const ex = sx + dirX * evt.length;
        const ey = sy + dirY * evt.length;
        const streak = ctx.createLinearGradient(sx, sy, ex, ey);
        streak.addColorStop(0, rgba(colorA, 0, hueShift));
        streak.addColorStop(0.6, rgba(colorB, 0.8, hueShift));
        streak.addColorStop(1, rgba(colorA, 0, hueShift));
        ctx.strokeStyle = streak;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
      ctx.restore();
    } else if (evt.type === "warp") {
      const radius = evt.radius + (evt.maxRadius - evt.radius) * t;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha * 0.4;
      ctx.strokeStyle = rgba(colorA, 0.7, hueShift);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = rgba(colorB, 0.4, hueShift);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(screenX, screenY, radius * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (evt.type === "neonRibbon") {
      const wave = Math.sin(clock * 0.35 + evt.phase) * evt.bend;
      const wave2 = Math.cos(clock * 0.25 + evt.phase) * evt.bend * 0.7;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha * 0.5;
      ctx.translate(screenX, screenY);
      ctx.rotate(evt.angle + wobble * 0.7);
      const grad = ctx.createLinearGradient(-evt.length / 2, 0, evt.length / 2, 0);
      grad.addColorStop(0, rgba(colorA, 0, hueShift));
      grad.addColorStop(0.45, rgba(colorB, 0.9, hueShift));
      grad.addColorStop(1, rgba(colorC, 0, hueShift));
      ctx.strokeStyle = grad;
      ctx.lineWidth = evt.width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-evt.length / 2, 0);
      ctx.bezierCurveTo(-evt.length / 6, wave, evt.length / 6, wave2, evt.length / 2, 0);
      ctx.stroke();

      ctx.globalAlpha = alpha * 0.25;
      ctx.strokeStyle = rgba(colorB, 0.6, hueShift);
      ctx.lineWidth = evt.width * 2.1;
      ctx.beginPath();
      ctx.moveTo(-evt.length / 2, 0);
      ctx.bezierCurveTo(-evt.length / 6, wave, evt.length / 6, wave2, evt.length / 2, 0);
      ctx.stroke();
      ctx.restore();
    } else if (evt.type === "jellySlab") {
      const pulse = 0.92 + 0.08 * Math.sin(clock * 0.25 + evt.phase);
      const width = evt.width * pulse;
      const height = evt.height * (0.9 + 0.1 * Math.cos(clock * 0.28 + evt.phase));
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha * 0.45;
      ctx.translate(screenX, screenY);
      ctx.rotate(evt.rotation + wobble * 0.4);
      ctx.save();
      ctx.scale(1, height / width);
      const radius = width / 2;
      const grad = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius);
      grad.addColorStop(0, rgba(colorA, 0.6, hueShift));
      grad.addColorStop(0.6, rgba(colorB, 0.35, hueShift));
      grad.addColorStop(1, rgba(colorC, 0, hueShift));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.globalAlpha = alpha * 0.32;
      ctx.strokeStyle = rgba(colorB, 0.8, hueShift);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-width * 0.35, -height * 0.12);
      ctx.quadraticCurveTo(0, height * 0.05, width * 0.35, height * 0.12);
      ctx.stroke();
      ctx.restore();
    } else if (evt.type === "chromaEddy") {
      const spin = evt.spin * (0.7 + 0.3 * Math.sin(clock * 0.25 + evt.phase));
      const baseAngle = t * Math.PI * 2 * spin + evt.phase;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(screenX, screenY);
      for (let i = 0; i < evt.orbCount; i++) {
        const angle = baseAngle + (i * Math.PI * 2) / evt.orbCount;
        const dist = evt.radius * (0.6 + 0.4 * Math.sin(t * Math.PI * 2 + i));
        const ox = Math.cos(angle) * dist;
        const oy = Math.sin(angle) * dist;
        const size = evt.orbSize * (0.7 + 0.3 * Math.sin(clock * 0.4 + i));
        const orb = ctx.createRadialGradient(ox, oy, 0, ox, oy, size);
        orb.addColorStop(0, rgba(colorA, 0.8, hueShift));
        orb.addColorStop(0.6, rgba(colorB, 0.45, hueShift));
        orb.addColorStop(1, rgba(colorC, 0, hueShift));
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = orb;
        ctx.beginPath();
        ctx.arc(ox, oy, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

export function drawScreenEffects(ctx, screenW, screenH, vignettePulse = 0) {
  const centerX = screenW / 2;
  const centerY = screenH / 2;
  const maxRadius = Math.max(screenW, screenH) * 0.6;
  const minRadius = Math.min(screenW, screenH) * 0.25;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const glow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
  glow.addColorStop(0, "rgba(120, 200, 190, 0.12)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, screenW, screenH);
  ctx.restore();

  ctx.save();
  const vignette = ctx.createRadialGradient(centerX, centerY, minRadius, centerX, centerY, maxRadius);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.45)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, screenW, screenH);
  ctx.restore();

  if (vignettePulse > 0) {
    const alpha = Math.min(1, vignettePulse) * 0.25;
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.005);
    ctx.save();
    ctx.globalAlpha = alpha * pulse;
    const pulseGrad = ctx.createRadialGradient(centerX, centerY, minRadius * 0.7, centerX, centerY, maxRadius);
    pulseGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
    pulseGrad.addColorStop(1, "rgba(0, 0, 0, 0.55)");
    ctx.fillStyle = pulseGrad;
    ctx.fillRect(0, 0, screenW, screenH);
    ctx.restore();
  }
}

export function drawControlDisableOverlay(ctx, canvas, camera, remaining, shipRadius) {
  if (remaining <= 0) {
    return;
  }
  const centerX = canvas.width / 2 + camera.shakeX;
  const centerY = canvas.height / 2 + camera.shakeY;
  const baseRadius = (shipRadius * 0.9) * camera.zoom;
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.01);
  const glowRadius = baseRadius * (1.2 + 0.25 * pulse);
  const alpha = CONTROL_DISABLE.PULSE_MIN
    + (CONTROL_DISABLE.PULSE_MAX - CONTROL_DISABLE.PULSE_MIN) * pulse;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const grad = ctx.createRadialGradient(
    centerX,
    centerY,
    baseRadius * 0.4,
    centerX,
    centerY,
    glowRadius
  );
  grad.addColorStop(0, `rgba(220, 70, 70, ${alpha})`);
  grad.addColorStop(1, "rgba(220, 70, 70, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const labelY = centerY - glowRadius - 12;
  const timerText = `${Math.max(0, remaining).toFixed(1)}s`;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.lineWidth = 3;
  ctx.strokeStyle = HUD_COLORS.ALERT_STROKE;
  ctx.fillStyle = "rgba(235, 90, 90, 0.95)";
  ctx.font = `bold 13px ${HUD_FONT}`;
  ctx.strokeText("Controls Disabled!", centerX, labelY);
  ctx.fillText("Controls Disabled!", centerX, labelY);
  ctx.textBaseline = "top";
  ctx.font = `bold 16px ${HUD_FONT}`;
  ctx.strokeText(timerText, centerX, labelY + 6);
  ctx.fillText(timerText, centerX, labelY + 6);
  ctx.restore();
}

export function drawScorePopups(ctx, canvas, camera, ship, popups) {
  if (!Array.isArray(popups) || popups.length === 0) {
    return;
  }
  const centerX = canvas.width / 2 + camera.shakeX;
  const centerY = canvas.height / 2 + camera.shakeY;
  const maxX = canvas.width / 2 - SCORE_POPUP.EDGE_MARGIN;
  const maxY = canvas.height / 2 - SCORE_POPUP.EDGE_MARGIN;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${SCORE_POPUP.FONT_SIZE}px ${HUD_FONT}`;

  for (const popup of popups) {
    const t = clampValue(popup.age / popup.life, 0, 1);
    const grow = clampValue(t / SCORE_POPUP.GROW_TIME, 0, 1);
    const scale = lerp(SCORE_POPUP.SCALE_START, SCORE_POPUP.SCALE_END, grow);
    const alpha = 1 - t;
    const rise = SCORE_POPUP.RISE * t;

    let sx = (popup.x - ship.x) * camera.zoom + centerX;
    let sy = (popup.y - ship.y) * camera.zoom + centerY;

    if (
      sx < SCORE_POPUP.EDGE_MARGIN
      || sx > canvas.width - SCORE_POPUP.EDGE_MARGIN
      || sy < SCORE_POPUP.EDGE_MARGIN
      || sy > canvas.height - SCORE_POPUP.EDGE_MARGIN
    ) {
      const dx = sx - centerX;
      const dy = sy - centerY;
      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
        const safeDx = Math.abs(dx) > 0.01 ? Math.abs(dx) : 0.01;
        const safeDy = Math.abs(dy) > 0.01 ? Math.abs(dy) : 0.01;
        const scaleClamp = Math.min(maxX / safeDx, maxY / safeDy);
        sx = centerX + dx * scaleClamp;
        sy = centerY + dy * scaleClamp;
      } else {
        sx = centerX;
        sy = centerY;
      }
    }

    ctx.save();
    ctx.translate(sx, sy - rise);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = popup.color;
    ctx.strokeStyle = HUD_COLORS.ALERT_STROKE;
    ctx.lineWidth = 3;
    const text = `+${popup.value}`;
    ctx.strokeText(text, 0, 0);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

export function drawParticles(ctx, particles) {
  if (!particles || particles.length === 0) {
    return;
  }
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of particles) {
    p.draw(ctx);
  }
  for (const p of particles) {
    p.draw(ctx, 2.2, 0.35);
  }
  ctx.restore();
}

export {
  CONTROL_DISABLE,
  SCORE_POPUP,
  SCORE_POPUP_COLORS,
  TRAIL_COLOR,
  TRAIL_DISPERSE
};

