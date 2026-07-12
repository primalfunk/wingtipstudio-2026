import { CONFIG } from "./config.js";

const {
  FONT: HUD_FONT,
  ALERT,
  COLORS: HUD_COLORS,
  MINIMAP,
  COMPASS,
  BEARING,
  SCAN_PULSE,
  STATUS
} = CONFIG.HUD;
const { STATION, AUTOPILOT } = CONFIG;

function normalizeAngle(angle) {
  return ((angle + Math.PI) % (Math.PI * 2)) - Math.PI;
}

function drawHudFrame(ctx, x, y, width, height, options = {}) {
  const notch = options.notch ?? 12;
  const fillStart = options.fillStart ?? HUD_COLORS.PANEL_START;
  const fillEnd = options.fillEnd ?? HUD_COLORS.PANEL_END;
  const stroke = options.stroke ?? HUD_COLORS.PANEL_STROKE;
  const glow = options.glow ?? HUD_COLORS.ACCENT_GLOW;
  const glowBlur = options.glowBlur ?? 10;
  const fill = options.fill !== false;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + notch, y);
  ctx.lineTo(x + width, y);
  ctx.lineTo(x + width - notch, y + height);
  ctx.lineTo(x, y + height);
  ctx.closePath();
  if (fill) {
    const grad = ctx.createLinearGradient(x, y, x + width, y + height);
    grad.addColorStop(0, fillStart);
    grad.addColorStop(1, fillEnd);
    ctx.fillStyle = grad;
    ctx.shadowColor = glow;
    ctx.shadowBlur = glowBlur;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.shadowColor = glow;
  ctx.shadowBlur = glowBlur * 0.55;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawHudTick(ctx, x, y, width, inset = 10) {
  ctx.save();
  ctx.strokeStyle = HUD_COLORS.PANEL_TICK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + inset, y);
  ctx.lineTo(x + width - inset, y);
  ctx.stroke();
  ctx.restore();
}

function drawStatIcon(ctx, type, x, y, size, color, glow) {
  const s = size;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.5, s * 0.12);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = glow;
  ctx.shadowBlur = s * 0.7;

  if (type === "ship") {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.7);
    ctx.lineTo(s * 0.55, s * 0.7);
    ctx.lineTo(0, s * 0.35);
    ctx.lineTo(-s * 0.55, s * 0.7);
    ctx.closePath();
    ctx.stroke();
  } else if (type === "armor") {
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.7);
    ctx.lineTo(s * 0.55, -s * 0.15);
    ctx.lineTo(s * 0.35, s * 0.6);
    ctx.lineTo(0, s * 0.85);
    ctx.lineTo(-s * 0.35, s * 0.6);
    ctx.lineTo(-s * 0.55, -s * 0.15);
    ctx.closePath();
    ctx.stroke();
  } else if (type === "time") {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -s * 0.3);
    ctx.moveTo(0, 0);
    ctx.lineTo(s * 0.25, 0);
    ctx.stroke();
  } else if (type === "survey") {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.35, -Math.PI * 0.3, Math.PI * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(s * 0.35, -s * 0.1, s * 0.08, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "distance") {
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, 0);
    ctx.lineTo(s * 0.7, 0);
    ctx.stroke();
    const ticks = [-0.4, -0.1, 0.2, 0.5];
    for (const t of ticks) {
      ctx.beginPath();
      ctx.moveTo(s * t, -s * 0.2);
      ctx.lineTo(s * t, s * 0.2);
      ctx.stroke();
    }
  } else if (type === "resource") {
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.58, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.2, -s * 0.35);
    ctx.lineTo(-s * 0.2, s * 0.35);
    ctx.stroke();
  } else if (type === "speed") {
    ctx.beginPath();
    ctx.moveTo(-s * 0.7, 0);
    ctx.lineTo(s * 0.4, 0);
    ctx.lineTo(s * 0.15, -s * 0.3);
    ctx.moveTo(s * 0.4, 0);
    ctx.lineTo(s * 0.15, s * 0.3);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawMiniMap(ctx, ship, activeSectors, enemiesInRange, enemyPings, stations, fuelPickups, resourcePickups, screenW, screenH, isCompact, anomalyEffects = null, highlights = null) {
  if (!activeSectors || activeSectors.length === 0) {
    return;
  }
  const base = Math.min(screenW, screenH);
  const edge = isCompact ? 12 : 20;
  const maxSize = Math.min(screenW - edge * 2, screenH - edge * 2);
  const desiredSize = isCompact
    ? Math.min(MINIMAP.SIZE, Math.round(base * 0.28))
    : MINIMAP.SIZE;
  let size = Math.max(120, Math.min(desiredSize, maxSize));
  size = Math.min(maxSize, size * 1.1);
  const range = MINIMAP.RANGE * (anomalyEffects?.rangeScale ?? 1);

  const offsetX = 30;
  const x0 = Math.max(edge, screenW - size - edge - offsetX);
  const y0 = edge;
  const cx = x0 + size / 2;
  const cy = y0 + size / 2;
  const radarRadius = size * 0.46;
  const sweepSpeed = MINIMAP.SWEEP_SPEED ?? 0.0014;
  const sweepWidth = MINIMAP.SWEEP_WIDTH ?? (Math.PI / 12);
  const sweepAngle = (performance.now() * sweepSpeed) % (Math.PI * 2);
  const goalHighlight = highlights?.goal ?? 0;
  const exitHighlight = highlights?.exit ?? 0;
  const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.006);

  ctx.save();

  // background
  ctx.fillStyle = HUD_COLORS.MAP_BG;
  ctx.fillRect(x0, y0, size, size);
  drawHudFrame(ctx, x0, y0, size, size, {
    fill: false,
    notch: isCompact ? 12 : 16,
    glowBlur: 10
  });
  drawHudTick(ctx, x0, y0 + 8, size);

  // radar background
  const radarGrad = ctx.createRadialGradient(cx, cy, radarRadius * 0.1, cx, cy, radarRadius);
  radarGrad.addColorStop(0, "rgba(12, 18, 22, 0.85)");
  radarGrad.addColorStop(1, HUD_COLORS.MAP_BG);
  ctx.fillStyle = radarGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(120, 170, 180, 0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
  ctx.clip();

  // completed sector background tint
  for (const sector of activeSectors) {
    if (!sector.goalDelivered) {
      continue;
    }
    const bx0 = cx + ((sector.bounds.x - ship.x) / range) * radarRadius;
    const by0 = cy + ((sector.bounds.y - ship.y) / range) * radarRadius;
    const bSize = (sector.bounds.size / range) * radarRadius;
    ctx.fillStyle = HUD_COLORS.MAP_COMPLETE;
    ctx.fillRect(bx0, by0, bSize, bSize);
  }

  // ship (center)
  ctx.fillStyle = HUD_COLORS.PANEL_TEXT;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();

  const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radarRadius);
  sweepGrad.addColorStop(0, "rgba(120, 200, 190, 0.25)");
  sweepGrad.addColorStop(1, "rgba(120, 200, 190, 0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = sweepGrad;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, radarRadius, sweepAngle - sweepWidth, sweepAngle + sweepWidth);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const sweepIntensity = (mx, my) => {
    const dx = mx - cx;
    const dy = my - cy;
    const angle = Math.atan2(dy, dx);
    const delta = Math.abs(normalizeAngle(angle - sweepAngle));
    if (delta > sweepWidth) {
      return 0;
    }
    const edge = 1 - delta / sweepWidth;
    const dist = Math.hypot(dx, dy);
    const distFade = 0.35 + 0.65 * (1 - Math.min(1, dist / radarRadius));
    return Math.pow(edge, 1.7) * distFade;
  };

  // enemy spawn pings
  if (enemyPings && enemyPings.length > 0) {
    for (const ping of enemyPings) {
      const dx = ping.x - ship.x;
      const dy = ping.y - ship.y;
      const dist = Math.hypot(dx, dy);
      if (dist > range) continue;
      const mx = cx + (dx / range) * radarRadius;
      const my = cy + (dy / range) * radarRadius;
      const intensity = sweepIntensity(mx, my);
      if (intensity <= 0.01) continue;
      const t = 1 - (ping.life / ping.maxLife);
      const radius = 4 + t * 10;
      ctx.strokeStyle = `rgba(200, 110, 110, ${0.6 * (1 - t) * intensity})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(mx, my, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // stars and asteroids
  for (const sector of activeSectors) {
    for (const star of sector.stars) {
      const dx = star.x - ship.x;
      const dy = star.y - ship.y;
      const dist = Math.hypot(dx, dy);
      if (dist > range) continue;

      const mx = cx + (dx / range) * radarRadius;
      const my = cy + (dy / range) * radarRadius;
      const intensity = sweepIntensity(mx, my);
      if (intensity <= 0.01) continue;

      ctx.fillStyle = star.minimapColor ?? "gold";
      ctx.beginPath();
      ctx.arc(mx, my, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(180, 190, 195, 0.8)";
    for (const asteroid of sector.asteroids) {
      const dx = asteroid.x - ship.x;
      const dy = asteroid.y - ship.y;
      const dist = Math.hypot(dx, dy);
      if (dist > range) continue;

      const mx = cx + (dx / range) * radarRadius;
      const my = cy + (dy / range) * radarRadius;
      const intensity = sweepIntensity(mx, my);
      if (intensity <= 0.01) continue;

      ctx.globalAlpha = intensity;
      ctx.beginPath();
      ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // upgrade stations
  if (Array.isArray(stations)) {
    for (const station of stations) {
      const dx = station.x - ship.x;
      const dy = station.y - ship.y;
      const dist = Math.hypot(dx, dy);
      if (dist > range) {
        continue;
      }
      const mx = cx + (dx / range) * radarRadius;
      const my = cy + (dy / range) * radarRadius;
      const intensity = sweepIntensity(mx, my);
      if (intensity <= 0.01) continue;
      ctx.save();
      ctx.globalAlpha = intensity;
      ctx.fillStyle = "rgba(120, 220, 180, 0.95)";
      ctx.strokeStyle = "rgba(200, 255, 230, 0.9)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(mx, my - 5);
      ctx.lineTo(mx + 4, my);
      ctx.lineTo(mx, my + 5);
      ctx.lineTo(mx - 4, my);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  // pickups
  if (Array.isArray(fuelPickups)) {
    for (const pickup of fuelPickups) {
      const dx = pickup.x - ship.x;
      const dy = pickup.y - ship.y;
      const dist = Math.hypot(dx, dy);
      if (dist > range) continue;
      const mx = cx + (dx / range) * radarRadius;
      const my = cy + (dy / range) * radarRadius;
      const intensity = sweepIntensity(mx, my);
      if (intensity <= 0.01) continue;
      ctx.fillStyle = `rgba(255, 235, 120, ${0.95 * intensity})`;
      ctx.beginPath();
      ctx.arc(mx, my, 2.5 + intensity * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (Array.isArray(resourcePickups)) {
    for (const pickup of resourcePickups) {
      const dx = pickup.x - ship.x;
      const dy = pickup.y - ship.y;
      const dist = Math.hypot(dx, dy);
      if (dist > range) continue;
      const mx = cx + (dx / range) * radarRadius;
      const my = cy + (dy / range) * radarRadius;
      const intensity = sweepIntensity(mx, my);
      if (intensity <= 0.01) continue;
      ctx.fillStyle = `rgba(255, 225, 80, ${0.9 * intensity})`;
      ctx.beginPath();
      ctx.arc(mx, my, 2.2 + intensity * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // enemies
  if (enemiesInRange && enemiesInRange.length > 0) {
    for (const enemy of enemiesInRange) {
      const dx = enemy.x - ship.x;
      const dy = enemy.y - ship.y;
      const dist = Math.hypot(dx, dy);
      if (dist > range) continue;
      const mx = cx + (dx / range) * radarRadius;
      const my = cy + (dy / range) * radarRadius;
      const intensity = sweepIntensity(mx, my);
      if (intensity <= 0.01) continue;
      const pulse = 0.5 + Math.abs(Math.sin(performance.now() / 250));
      ctx.fillStyle = `rgba(200, 110, 110, ${(0.4 + pulse * 0.45) * intensity})`;
      ctx.beginPath();
      ctx.arc(mx, my, 2.5 + pulse, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // end zones + goal pickups
  for (const sector of activeSectors) {
    const { goal, goalDelivered } = sector;
    if (!goalDelivered && goal) {
      const gdx = goal.x + goal.width / 2 - ship.x;
      const gdy = goal.y + goal.height / 2 - ship.y;
      const dist = Math.hypot(gdx, gdy);
      if (dist <= range) {
        const gx = cx + (gdx / range) * radarRadius;
        const gy = cy + (gdy / range) * radarRadius;
        const intensity = sweepIntensity(gx, gy);
        if (intensity <= 0.01) {
          continue;
        }
        ctx.fillStyle = `rgba(120, 200, 190, ${0.9 * intensity})`;
        ctx.beginPath();
        ctx.arc(gx, gy, 3, 0, Math.PI * 2);
        ctx.fill();
        const highlight = Math.max(goalHighlight, exitHighlight);
        if (highlight > 0) {
          const alpha = Math.min(1, highlight) * (0.35 + 0.35 * pulse);
          ctx.strokeStyle = `rgba(160, 230, 220, ${alpha * intensity})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(gx, gy, 6 + 2 * pulse, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
  }

  ctx.restore();
  ctx.restore();
}

function getNearestScanTarget(ship, activeSectors) {
  let nearest = null;
  let fallback = null;
  for (const sector of activeSectors) {
    if (!sector.goal) {
      continue;
    }
    const gx = sector.goal.x + sector.goal.width / 2;
    const gy = sector.goal.y + sector.goal.height / 2;
    const dx = gx - ship.x;
    const dy = gy - ship.y;
    const dist2 = dx * dx + dy * dy;
    if (!sector.goalDelivered) {
      if (!nearest || dist2 < nearest.dist2) {
        nearest = { x: gx, y: gy, dist2 };
      }
    } else if (!fallback || dist2 < fallback.dist2) {
      fallback = { x: gx, y: gy, dist2 };
    }
  }
  return nearest ?? fallback;
}

export function drawScanPulse(ctx, ship, activeSectors, timeMs, viewRadius) {
  if (!activeSectors || activeSectors.length === 0) {
    return;
  }
  const target = getNearestScanTarget(ship, activeSectors);
  if (!target) {
    return;
  }
  const dist = Math.hypot(target.x - ship.x, target.y - ship.y);
  if (dist > viewRadius + SCAN_PULSE.RADIUS_MAX) {
    return;
  }

  const t = (timeMs % SCAN_PULSE.PERIOD) / SCAN_PULSE.PERIOD;
  const radius = SCAN_PULSE.RADIUS_MIN
    + (SCAN_PULSE.RADIUS_MAX - SCAN_PULSE.RADIUS_MIN) * t;
  const alpha = 0.5 * (1 - t);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgba(120, 200, 190, ${alpha})`;
  ctx.lineWidth = SCAN_PULSE.LINE_WIDTH;
  ctx.beginPath();
  ctx.arc(target.x, target.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawBearingIndicators(ctx, ship, activeSectors, fuelPickups, enemiesInRange, screenW, screenH, anomalyEffects = null) {
  if (!activeSectors || activeSectors.length === 0) {
    return;
  }

  const scanTargets = [];
  const fallbackTargets = [];
  for (const sector of activeSectors) {
    if (sector.goal) {
      const gx = sector.goal.x + sector.goal.width / 2;
      const gy = sector.goal.y + sector.goal.height / 2;
      const dx = gx - ship.x;
      const dy = gy - ship.y;
      const entry = { x: gx, y: gy, dist2: dx * dx + dy * dy };
      if (sector.goalDelivered) {
        fallbackTargets.push(entry);
      } else {
        scanTargets.push(entry);
      }
    }
  }
  const targets = scanTargets.length > 0 ? scanTargets : fallbackTargets;
  targets.sort((a, b) => a.dist2 - b.dist2);

  const hasFuel = fuelPickups && fuelPickups.length > 0;
  const hasEnemies = enemiesInRange && enemiesInRange.length > 0;
  if (targets.length === 0 && !hasFuel && !hasEnemies) {
    return;
  }

  const centerX = screenW / 2;
  const centerY = screenH / 2;
  const angleOffset = anomalyEffects?.angleOffset ?? 0;
  const radiusOffset = anomalyEffects?.radiusOffset ?? 0;
  const jitter = anomalyEffects?.jitter ?? 0;
  const ghostPulse = anomalyEffects?.ghostPulse ?? 0;
  const scanColor = HUD_COLORS.ACCENT;
  const scanGlow = HUD_COLORS.ACCENT_GLOW;
  const fuelColor = HUD_COLORS.PANEL_TEXT;
  const dangerColor = HUD_COLORS.ENEMY;
  const dangerGlow = "rgba(255, 90, 90, 0.9)";

  function drawDot(angle, size, alpha, color, glow) {
    const x = centerX + Math.cos(angle + angleOffset) * (BEARING.RADIUS + radiusOffset);
    const y = centerY + Math.sin(angle + angleOffset) * (BEARING.RADIUS + radiusOffset);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    if (glow) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = 10;
    }
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawChevronPair(angle, alpha, scale = 1, phase = 0, style = null) {
    const time = performance.now();
    const pulseBase = style?.pulseBase ?? 0.85;
    const pulseRange = style?.pulseRange ?? 0.15;
    const pulseSpeed = style?.pulseSpeed ?? BEARING.PULSE_SPEED;
    const driftSpeed = style?.driftSpeed ?? BEARING.DRIFT_SPEED;
    const driftAmp = style?.driftAmp ?? BEARING.DRIFT_AMPLITUDE;
    let pulse = pulseBase + pulseRange * Math.sin(time * pulseSpeed + phase);
    if (style?.flickerSpeed) {
      pulse *= 0.75 + 0.25 * Math.sin(time * style.flickerSpeed + phase * 1.7);
    }
    const drift = Math.sin(time * driftSpeed + phase) * driftAmp;
    const radius = BEARING.RADIUS + radiusOffset + drift;
    const x = centerX + Math.cos(angle + angleOffset) * radius;
    const y = centerY + Math.sin(angle + angleOffset) * radius;
    const len = BEARING.CHEVRON_LENGTH * scale;
    const width = BEARING.CHEVRON_WIDTH * scale;
    const gap = BEARING.CHEVRON_GAP * scale;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha * pulse;
    ctx.strokeStyle = style?.color ?? scanColor;
    ctx.lineWidth = style?.lineWidth ?? 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = style?.glow ?? scanGlow;
    ctx.shadowBlur = style?.glowBlur ?? 8;

    const drawChevron = (offset) => {
      ctx.beginPath();
      ctx.moveTo(-len + offset, -width);
      ctx.lineTo(offset, 0);
      ctx.lineTo(-len + offset, width);
      ctx.stroke();
    };

    drawChevron(0);
    drawChevron(-gap);
    ctx.restore();
  }

  const scanStyle = {
    color: scanColor,
    glow: scanGlow,
    lineWidth: 2,
    glowBlur: 8,
    pulseBase: 0.85,
    pulseRange: 0.15,
    pulseSpeed: BEARING.PULSE_SPEED,
    driftSpeed: BEARING.DRIFT_SPEED,
    driftAmp: BEARING.DRIFT_AMPLITUDE
  };
  const dangerStyle = {
    color: dangerColor,
    glow: dangerGlow,
    lineWidth: 2.6,
    glowBlur: 12,
    pulseBase: 0.7,
    pulseRange: 0.4,
    pulseSpeed: BEARING.DANGER_PULSE_SPEED,
    flickerSpeed: BEARING.DANGER_FLICKER_SPEED,
    driftSpeed: BEARING.DANGER_DRIFT_SPEED,
    driftAmp: BEARING.DRIFT_AMPLITUDE * 1.4
  };

  if (targets.length > 0) {
    const primary = targets[0];
    const angle = Math.atan2(primary.y - ship.y, primary.x - ship.x) + jitter;
    drawChevronPair(angle, BEARING.SCAN_PRIMARY_ALPHA, 1, 0, scanStyle);
  }
  if (targets.length > 1) {
    const secondary = targets[1];
    const angle = Math.atan2(secondary.y - ship.y, secondary.x - ship.x) - jitter;
    drawChevronPair(angle, BEARING.SCAN_SECONDARY_ALPHA, 0.85, Math.PI / 2, scanStyle);
  }

  if (ghostPulse > 0.92) {
    const ghostAngle = Math.sin(performance.now() * 0.001) * Math.PI;
    drawChevronPair(ghostAngle, 0.2, 0.7, Math.PI / 3, {
      color: "rgba(120, 200, 190, 0.6)",
      glow: "rgba(120, 200, 190, 0.25)",
      lineWidth: 1.4,
      glowBlur: 6,
      pulseBase: 0.6,
      pulseRange: 0.2,
      pulseSpeed: BEARING.PULSE_SPEED * 1.6
    });
  }

  if (hasEnemies) {
    enemiesInRange.forEach((enemy, index) => {
      const dx = enemy.x - ship.x;
      const dy = enemy.y - ship.y;
      const dist = Math.hypot(dx, dy);
      const distScale = 0.5 + 0.5 * (1 - Math.min(1, dist / MINIMAP.RANGE));
      const angle = Math.atan2(dy, dx);
      const phase = index * (Math.PI / 3);
      drawChevronPair(angle, BEARING.DANGER_ALPHA * distScale, 1.05, phase, dangerStyle);
    });
  }

  if (hasFuel) {
    const nearestFuel = fuelPickups
      .map((fuel) => {
        const dx = fuel.x - ship.x;
        const dy = fuel.y - ship.y;
        return {
          angle: Math.atan2(dy, dx),
          dist2: dx * dx + dy * dy
        };
      })
      .sort((a, b) => a.dist2 - b.dist2)
      .slice(0, BEARING.FUEL_MAX_DOTS);

    for (const fuel of nearestFuel) {
      drawDot(fuel.angle, BEARING.FUEL_SIZE, BEARING.FUEL_ALPHA, fuelColor);
    }
  }
}

export function drawStationIndicators(ctx, ship, stations, screenW, screenH, camera) {
  if (!STATION.MARKER_EDGE_INDICATOR || !Array.isArray(stations) || stations.length === 0) {
    return;
  }
  const centerX = screenW / 2;
  const centerY = screenH / 2;
  const margin = 26;
  const halfW = screenW / 2 - margin;
  const halfH = screenH / 2 - margin;
  for (const station of stations) {
    const sx = (station.x - ship.x) * camera.zoom + centerX + (camera.shakeX ?? 0);
    const sy = (station.y - ship.y) * camera.zoom + centerY + (camera.shakeY ?? 0);
    if (sx >= 0 && sx <= screenW && sy >= 0 && sy <= screenH) {
      continue;
    }
    const dx = sx - centerX;
    const dy = sy - centerY;
    const angle = Math.atan2(dy, dx);
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const tx = Math.abs(dirX) > 0.0001 ? halfW / Math.abs(dirX) : halfW;
    const ty = Math.abs(dirY) > 0.0001 ? halfH / Math.abs(dirY) : halfH;
    const t = Math.min(tx, ty);
    const x = centerX + dirX * t;
    const y = centerY + dirY * t;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = "rgba(120, 220, 180, 0.9)";
    ctx.strokeStyle = "rgba(200, 255, 230, 0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-10, -6);
    ctx.lineTo(-10, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

export function drawFuelGauge(ctx, ship, screenW, screenH, isCompact, highlight = 0) {
  const edge = isCompact ? 12 : 20;
  const basePanelW = Math.min(isCompact ? 260 : 320, screenW - edge * 2);
  const panelW = basePanelW * 0.8;
  const panelH = isCompact ? 70 : 78;
  const x = edge;
  const y = screenH - panelH - (isCompact ? 10 : 16);
  const barW = panelW - 24;
  const barH = isCompact ? 9 : 10;
  const barX = x + 12;
  const barY = y + panelH - (isCompact ? 16 : 18);
  const ratio = ship.maxFuel > 0 ? ship.fuel / ship.maxFuel : 0;
  const fillWidth = Math.max(0, Math.min(1, ratio)) * barW;
  const depleted = ship.fuel <= 0;
  const fuelValue = Math.max(0, ship.fuel).toFixed(1);

  ctx.save();
  drawHudFrame(ctx, x, y, panelW, panelH, { notch: isCompact ? 12 : 16, glowBlur: 10 });
  drawHudTick(ctx, x, y + 8, panelW);

  if (highlight > 0) {
    const alpha = Math.min(1, highlight) * 0.4;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(170, 230, 210, ${alpha})`;
    ctx.shadowColor = "rgba(120, 220, 190, 0.7)";
    ctx.shadowBlur = 18;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x + 4, y + 4, panelW - 8, panelH - 8);
    ctx.restore();
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
  ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);
  ctx.strokeStyle = HUD_COLORS.PANEL_TICK;
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);

  const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  grad.addColorStop(0, "rgba(200, 110, 110, 0.9)");
  grad.addColorStop(0.55, HUD_COLORS.WARM);
  grad.addColorStop(1, "rgba(120, 190, 175, 0.9)");
  ctx.fillStyle = depleted ? "rgba(200, 110, 110, 0.9)" : grad;
  ctx.fillRect(barX, barY, fillWidth, barH);

  ctx.fillStyle = "rgba(245, 250, 250, 0.98)";
  ctx.shadowColor = HUD_COLORS.ACCENT_GLOW;
  ctx.shadowBlur = isCompact ? 6 : 8;
  ctx.font = `${isCompact ? 11 : 12}px ${HUD_FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("FUEL", barX + 20, y + 18);
  ctx.shadowBlur = 0;
  ctx.textAlign = "right";
  ctx.fillStyle = HUD_COLORS.PANEL_TEXT;
  ctx.fillText(fuelValue, x + panelW - 12, y + 18);

  if (depleted) {
    ctx.fillStyle = HUD_COLORS.WARNING;
    ctx.font = `${isCompact ? 10 : 11}px ${HUD_FONT}`;
    ctx.textAlign = "right";
    ctx.fillText("Tap to terminate", x + panelW - 12, y + panelH - 8);
  }
  ctx.restore();
}

export function drawStatusHud(ctx, ship, lives, armor, maxArmor, surveyed, timeSpent, distanceFromOrigin, resourceCurrency, screenW, screenH, controlLabel = "", isCompact = false) {
  const speed = Math.hypot(ship.vx, ship.vy);
  const distance = Number.isFinite(distanceFromOrigin) ? distanceFromOrigin : 0;
  const resource = Number.isFinite(resourceCurrency) ? Math.max(0, Math.floor(resourceCurrency)) : 0;
  const armorValue = maxArmor > 0 ? `${armor}/${maxArmor}` : "0";
  const edge = isCompact ? 12 : 18;
  const lines = [
    { icon: "ship", value: lives },
    { icon: "armor", value: armorValue },
    { icon: "survey", value: surveyed },
    { icon: "time", value: `${timeSpent.toFixed(1)}s` },
    { icon: "distance", value: `${distance.toFixed(0)}u` },
    { icon: "resource", value: resource },
    { icon: "speed", value: speed.toFixed(1) }
  ];
  const showControls = !isCompact && controlLabel;
  const lineH = isCompact ? STATUS.ROW_HEIGHT_COMPACT : STATUS.ROW_HEIGHT;
  const basePad = isCompact ? 12 : 16;
  const basePanelW = Math.min(
    isCompact ? STATUS.PANEL_WIDTH_COMPACT : STATUS.PANEL_WIDTH,
    screenW - edge * 2
  );
  const panelW = basePanelW * 0.6;
  const panelH = basePad * 2 + lineH * lines.length + (showControls ? lineH : 0);
  const x = edge;
  const y = edge;
  const iconSize = isCompact ? STATUS.ICON_SIZE_COMPACT : STATUS.ICON_SIZE;
  const valueFontBase = isCompact ? STATUS.VALUE_FONT_COMPACT : STATUS.VALUE_FONT;
  const valueFont = valueFontBase + (isCompact ? 1 : 2);

  ctx.save();
  drawHudFrame(ctx, x, y, panelW, panelH, { notch: isCompact ? 12 : 16, glowBlur: 12 });
  drawHudTick(ctx, x, y + 8, panelW);

  const iconX = x + basePad + iconSize * 0.4;
  const valueX = x + panelW - basePad;
  let cursorY = y + basePad + lineH * 0.5;
  for (const line of lines) {
    drawStatIcon(ctx, line.icon, iconX, cursorY, iconSize, HUD_COLORS.ACCENT, HUD_COLORS.ACCENT_GLOW);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(245, 250, 250, 0.98)";
    ctx.font = `bold ${valueFont}px ${HUD_FONT}`;
    ctx.shadowColor = HUD_COLORS.ACCENT_GLOW;
    ctx.shadowBlur = STATUS.VALUE_GLOW + (isCompact ? 4 : 6);
    ctx.fillText(line.value, valueX, cursorY);
    ctx.shadowBlur = 0;
    cursorY += lineH;
  }

  if (showControls) {
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = HUD_COLORS.PANEL_MUTED;
    ctx.font = `${isCompact ? 10 : 11}px ${HUD_FONT}`;
    ctx.fillText(controlLabel, x + basePad, cursorY + 2);
  }
  ctx.restore();
}

export function getAutopilotButtonRect(screenW, screenH, isCompact = false) {
  const scale = isCompact ? 0.85 : 1;
  const width = AUTOPILOT.BUTTON.WIDTH * scale;
  const height = AUTOPILOT.BUTTON.HEIGHT * scale;
  const x = screenW / 2 - width / 2;
  const y = screenH - height - AUTOPILOT.BUTTON.Y_OFFSET;
  return { x, y, width, height };
}

export function drawAutopilotToggle(ctx, active, screenW, screenH, isCompact = false) {
  const rect = getAutopilotButtonRect(screenW, screenH, isCompact);
  const colors = AUTOPILOT.COLORS;
  ctx.save();
  drawHudFrame(ctx, rect.x, rect.y, rect.width, rect.height, {
    fillStart: active ? colors.ON_FILL : colors.OFF_FILL,
    fillEnd: active ? colors.ON_FILL : colors.OFF_FILL,
    stroke: colors.BORDER,
    glow: active ? colors.GLOW : HUD_COLORS.ACCENT_GLOW,
    glowBlur: active ? 12 : 8,
    notch: isCompact ? 10 : 12
  });
  drawHudTick(ctx, rect.x, rect.y + 6, rect.width, 12);
  ctx.fillStyle = active ? colors.ON_TEXT : colors.OFF_TEXT;
  ctx.font = `${isCompact ? 11 : 12}px ${HUD_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("AUTOPILOT", rect.x + rect.width / 2, rect.y + rect.height / 2);
  ctx.restore();
  return rect;
}

export function drawScoreHud(ctx, score, multiplier, pulse, screenW, screenH, isCompact, highlight = 0) {
  const displayScore = Math.max(0, Math.floor(score));
  const scoreText = displayScore.toString().padStart(7, "0");
  const edge = isCompact ? 12 : 18;
  const basePanelW = Math.min(isCompact ? 260 : 320, screenW - edge * 2);
  const panelW = basePanelW * 0.6 + 50;
  const panelH = isCompact ? 70 : 78;
  const autopilotRect = getAutopilotButtonRect(screenW, screenH, isCompact);
  const fuelBasePanelW = Math.min(isCompact ? 260 : 320, screenW - edge * 2);
  const fuelPanelW = fuelBasePanelW * 0.8;
  const minGap = isCompact ? 8 : 12;
  let gapLeft = autopilotRect
    ? autopilotRect.x - (edge + fuelPanelW)
    : minGap;
  if (!Number.isFinite(gapLeft)) {
    gapLeft = minGap;
  }
  gapLeft = Math.max(minGap, gapLeft);
  const maxRight = screenW - edge;
  let x = autopilotRect
    ? autopilotRect.x + autopilotRect.width + gapLeft
    : screenW - panelW - edge;
  if (x + panelW > maxRight) {
    x = Math.max(
      autopilotRect ? autopilotRect.x + autopilotRect.width + minGap : edge,
      maxRight - panelW
    );
  }
  const y = screenH - panelH - (isCompact ? 10 : 16);
  const labelX = x + (isCompact ? 18 : 22);
  const labelY = y + (isCompact ? 16 : 18);
  const scoreFont = isCompact ? 24 : 28;
  const labelFont = isCompact ? 11 : 12;
  const badgeFont = isCompact ? 14 : 16;
  const badgeLabelFont = isCompact ? 9 : 10;
  const time = performance.now();
  const ringPulse = 0.4 + 0.6 * Math.abs(Math.sin(time / 220));
  const ringRatio = Math.min(1, (multiplier - 1) / 6);

  ctx.save();
  drawHudFrame(ctx, x, y, panelW, panelH, { notch: isCompact ? 16 : 24, glowBlur: 12 });
  drawHudTick(ctx, x, y + 8, panelW);

  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(245, 250, 250, 0.98)";
  ctx.shadowColor = HUD_COLORS.ACCENT_GLOW;
  ctx.shadowBlur = isCompact ? 6 : 8;
  ctx.font = `${labelFont}px ${HUD_FONT}`;
  ctx.fillText("SCORE", labelX, labelY);
  ctx.shadowBlur = 0;

  ctx.font = `bold ${scoreFont}px ${HUD_FONT}`;
  const scoreMetrics = ctx.measureText(scoreText);
  const platePadX = isCompact ? 18 : 22;
  const platePadY = isCompact ? 8 : 10;
  const plateW = scoreMetrics.width + platePadX * 2;
  const plateH = scoreFont + platePadY * 2;
  const minScoreX = x + 16 + platePadX;
  const maxScoreX = x + panelW - 16 - plateW + platePadX;
  ctx.textAlign = "left";
  let scoreX = labelX + platePadX;
  scoreX = Math.max(minScoreX, Math.min(maxScoreX, scoreX));
  const scoreY = y + (isCompact ? 50 : 54);
  const highlightPulse = Math.max(0, Math.min(1, highlight));
  const pulseT = Math.min(1, pulse / 1.2);
  const pulseEase = Math.pow(pulseT, 0.75);
  const pulseScale = 1 + pulseEase * 0.26 + highlightPulse * 0.18;
  const glow = 14 + pulseEase * 60 + pulse * 12 + highlightPulse * 40;
  if (pulseT > 0) {
    const barW = 220 + pulseEase * 180;
    const barH = 14 + pulseEase * 10;
    const barX = scoreX - 16;
    const barY = scoreY - 30 - pulseEase * 14;
    const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    barGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
    barGrad.addColorStop(0.5, `rgba(120, 200, 190, ${0.7 * pulseEase + 0.25})`);
    barGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = barGrad;
    ctx.fillRect(barX, barY, barW, barH);

    const bar2W = 140 + pulseEase * 120;
    const bar2H = 8 + pulseEase * 6;
    const bar2X = scoreX - 6;
    const bar2Y = scoreY + 8 + pulseEase * 6;
    const bar2Grad = ctx.createLinearGradient(bar2X, 0, bar2X + bar2W, 0);
    bar2Grad.addColorStop(0, "rgba(0, 0, 0, 0)");
    bar2Grad.addColorStop(0.5, `rgba(170, 210, 205, ${0.55 * pulseEase + 0.2})`);
    bar2Grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = bar2Grad;
    ctx.fillRect(bar2X, bar2Y, bar2W, bar2H);
  }

  const plateX = scoreX - platePadX;
  const plateY = scoreY - scoreFont - platePadY + 4;
  const plateGrad = ctx.createLinearGradient(plateX, plateY, plateX + plateW, plateY + plateH);
  plateGrad.addColorStop(0, "rgba(6, 10, 12, 0.92)");
  plateGrad.addColorStop(1, "rgba(12, 18, 22, 0.88)");
  ctx.fillStyle = plateGrad;
  ctx.fillRect(plateX, plateY, plateW, plateH);
  ctx.strokeStyle = "rgba(220, 235, 235, 0.3)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(plateX, plateY, plateW, plateH);

  ctx.save();
  ctx.shadowColor = "rgba(255, 240, 200, 0.95)";
  ctx.shadowBlur = glow + 10;
  ctx.fillStyle = "rgba(255, 250, 230, 1)";
  ctx.translate(scoreX, scoreY);
  ctx.scale(pulseScale, pulseScale);
  ctx.fillText(scoreText, 0, 0);
  ctx.restore();

  ctx.save();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(255, 250, 230, 1)";
  ctx.translate(scoreX, scoreY);
  ctx.scale(pulseScale, pulseScale);
  ctx.fillText(scoreText, 0, 0);
  ctx.restore();
  ctx.strokeStyle = "rgba(255, 230, 180, 0.6)";
  ctx.lineWidth = 1.6;
  ctx.save();
  ctx.translate(scoreX, scoreY);
  ctx.scale(pulseScale, pulseScale);
  ctx.strokeText(scoreText, 0, 0);
  ctx.restore();

  const badgeScale = 1 + highlightPulse * 0.18;
  const badgeR = (isCompact ? 13 : 15) * badgeScale;
  let badgeX = x + panelW - (isCompact ? 34 : 38);
  badgeX = Math.min(badgeX, x + panelW - badgeR - 10);
  const badgeY = y + panelH / 2 + 6;
  const badgeGrad = ctx.createRadialGradient(
    badgeX - 4,
    badgeY - 4,
    4,
    badgeX,
    badgeY,
    badgeR
  );
  badgeGrad.addColorStop(0, "rgba(220, 200, 170, 0.95)");
  badgeGrad.addColorStop(1, "rgba(170, 130, 100, 0.95)");

  ctx.beginPath();
  ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
  ctx.fillStyle = badgeGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(230, 235, 235, 0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = `rgba(190, 200, 190, ${0.35 + ringPulse * 0.5})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(
    badgeX,
    badgeY,
    badgeR + 6,
    -Math.PI / 2,
    -Math.PI / 2 + Math.PI * 2 * ringRatio
  );
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(8, 12, 16, 0.9)";
  ctx.font = `${badgeFont}px ${HUD_FONT}`;
  ctx.fillText(`x${multiplier}`, badgeX, badgeY + 6);
  ctx.fillStyle = "rgba(245, 250, 250, 0.98)";
  ctx.shadowColor = HUD_COLORS.ACCENT_GLOW;
  ctx.shadowBlur = isCompact ? 6 : 8;
  ctx.font = `${badgeLabelFont}px ${HUD_FONT}`;
  ctx.fillText("MULTI", badgeX, labelY);
  ctx.shadowBlur = 0;

  ctx.restore();
}

export function drawBeaconSignalHud(ctx, strength, screenW, screenH, isCompact) {
  const edge = isCompact ? 12 : 18;
  const panelH = isCompact ? 70 : 78;
  const baseY = screenH - panelH - edge;
  const width = isCompact ? 120 : 150;
  const height = isCompact ? 8 : 10;
  const x = screenW - width - edge;
  const y = baseY - (isCompact ? 18 : 22);
  const fill = Math.max(0, Math.min(1, strength));

  ctx.save();
  ctx.fillStyle = "rgba(6, 10, 12, 0.75)";
  ctx.strokeStyle = "rgba(120, 200, 190, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.fillRect(x, y, width, height);
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = "rgba(120, 200, 190, 0.75)";
  ctx.fillRect(x + 1, y + 1, Math.max(0, (width - 2) * fill), height - 2);
  ctx.font = `${isCompact ? 8 : 9}px ${HUD_FONT}`;
  ctx.fillStyle = "rgba(220, 235, 235, 0.75)";
  ctx.textAlign = "right";
  ctx.fillText("CARRIER", x + width, y - 4);
  ctx.restore();
}

export function drawCompassHud(ctx, ship, activeSectors, enemies, fuelPickups, screenW, screenH, anomalyEffects = null) {
  if (!activeSectors || activeSectors.length === 0) {
    return;
  }

  const rangeScale = anomalyEffects?.rangeScale ?? 1;
  const range = MINIMAP.RANGE * rangeScale;
  const width = Math.min(COMPASS.WIDTH, screenW - 100);
  if (width < 200) {
    return;
  }
  const height = COMPASS.HEIGHT;
  const centerX = screenW / 2;
  const centerY = screenH - COMPASS.Y_OFFSET;
  const halfWidth = width / 2;
  const halfFov = COMPASS.FOV / 2;
  const top = centerY - height / 2;
  const bottom = centerY + height / 2;
  const notch = 18;

  ctx.save();
  const panelGrad = ctx.createLinearGradient(centerX - halfWidth, top, centerX + halfWidth, bottom);
  panelGrad.addColorStop(0, HUD_COLORS.PANEL_START);
  panelGrad.addColorStop(1, HUD_COLORS.PANEL_END);

  ctx.beginPath();
  ctx.moveTo(centerX - halfWidth + notch, top);
  ctx.lineTo(centerX + halfWidth, top);
  ctx.lineTo(centerX + halfWidth - notch, bottom);
  ctx.lineTo(centerX - halfWidth, bottom);
  ctx.closePath();
  ctx.fillStyle = panelGrad;
  ctx.fill();
  ctx.strokeStyle = HUD_COLORS.PANEL_STROKE;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = HUD_COLORS.PANEL_TICK;
  ctx.lineWidth = 1;
  for (let deg = -90; deg <= 90; deg += COMPASS.TICK_DEG) {
    const rel = (deg * Math.PI) / 180;
    const x = centerX + (rel / halfFov) * halfWidth;
    const major = deg % 30 === 0;
    const len = major ? 12 : 7;
    ctx.beginPath();
    ctx.moveTo(x, centerY - len / 2);
    ctx.lineTo(x, centerY + len / 2);
    ctx.stroke();
  }

  ctx.strokeStyle = HUD_COLORS.ACCENT;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(centerX, top + 6);
  ctx.lineTo(centerX, bottom - 6);
  ctx.stroke();
  ctx.restore();

  const laneFuel = centerY - 24;
  const laneEnd = centerY - 12;
  const laneEnemy = centerY + 2;
  const laneStar = centerY + 14;
  const laneAsteroid = centerY + 22;

  function drawMark(tx, ty, laneY, baseAlpha, drawFn) {
    const dx = tx - ship.x;
    const dy = ty - ship.y;
    const dist = Math.hypot(dx, dy);
    if (dist > range) {
      return;
    }
    const rel = normalizeAngle(Math.atan2(dx, -dy) - (ship.heading + (anomalyEffects?.angleOffset ?? 0)));
    if (Math.abs(rel) > halfFov) {
      return;
    }
    const x = centerX + (rel / halfFov) * halfWidth;
    const falloff = 0.4 + 0.6 * (1 - dist / range);
    const alpha = baseAlpha * Math.max(0, Math.min(1, falloff));
    drawFn(x, laneY, alpha);
  }

  function drawEnemyMark(x, y, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.shadowColor = "rgba(200, 110, 110, 0.8)";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "rgba(200, 110, 110, 0.95)";
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(7, 7);
    ctx.lineTo(-7, 7);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(230, 235, 235, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawStarMark(x, y, alpha, color) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-3, -3, 6, 6);
    ctx.restore();
  }

  function drawAsteroidMark(x, y, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.strokeStyle = HUD_COLORS.ASTEROID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-3, 0);
    ctx.lineTo(3, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawEndZoneMark(x, y, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.fillStyle = HUD_COLORS.ACCENT;
    ctx.strokeStyle = "rgba(40, 90, 80, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(-5, -5, 10, 10);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawFuelMark(x, y, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.fillStyle = HUD_COLORS.WARM;
    ctx.strokeStyle = "rgba(230, 235, 235, 0.6)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-4, -6);
    ctx.lineTo(4, -6);
    ctx.arc(4, 0, 6, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(-4, 6);
    ctx.arc(-4, 0, 6, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = "rgba(90, 70, 50, 0.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-2, -1);
    ctx.lineTo(2, -1);
    ctx.stroke();
    ctx.restore();
  }

  for (const enemy of enemies) {
    drawMark(enemy.x, enemy.y, laneEnemy, 1, drawEnemyMark);
  }

  for (const sector of activeSectors) {
    if (!sector.goalDelivered && sector.goal) {
      const goal = sector.goal;
      const gx = goal.x + goal.width / 2;
      const gy = goal.y + goal.height / 2;
      drawMark(gx, gy, laneEnd, 0.95, drawEndZoneMark);
    }
  }

  for (const fuel of fuelPickups) {
    drawMark(fuel.x, fuel.y, laneFuel, 0.95, drawFuelMark);
  }

  for (const sector of activeSectors) {
    for (const star of sector.stars) {
      const color = star.minimapColor ?? star.bodyColor ?? "white";
      drawMark(star.x, star.y, laneStar, 0.55, (x, y, alpha) => {
        drawStarMark(x, y, alpha, color);
      });
    }
  }

  for (const sector of activeSectors) {
    for (const asteroid of sector.asteroids) {
      drawMark(asteroid.x, asteroid.y, laneAsteroid, 0.25, drawAsteroidMark);
    }
  }
}

export function drawAlerts(ctx, alerts, alertClock, screenW, screenH) {
  if (!alerts || alerts.length === 0) {
    return;
  }
  let active = null;
  for (const alert of alerts) {
    if (alertClock >= alert.start && alertClock <= alert.start + alert.duration) {
      if (!active || alert.start > active.start) {
        active = alert;
      }
    }
  }
  if (!active) {
    return;
  }

  const elapsed = alertClock - active.start;
  const fadeWindow = Math.min(ALERT.FADE, active.duration / 2);
  let alpha = 1;
  if (elapsed < fadeWindow) {
    alpha = elapsed / fadeWindow;
  } else if (elapsed > active.duration - fadeWindow) {
    alpha = (active.duration - elapsed) / fadeWindow;
  }

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  const fontSize = Number.isFinite(active.fontSize) ? active.fontSize : 18;
  const lineHeight = fontSize * 1.25;
  ctx.font = `${fontSize}px ${HUD_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const x = screenW * 0.5;
  const y = screenH * 0.5;
  const lines = String(active.text ?? "").split("\n");
  let textWidth = 0;
  for (const line of lines) {
    const metrics = ctx.measureText(line);
    textWidth = Math.max(textWidth, metrics.width);
  }
  const textHeight = lineHeight * Math.max(1, lines.length);
  const time = performance.now();
  const pulse = 0.6 + 0.4 * Math.sin(time * 0.004);
  const firstLineY = y - (textHeight - lineHeight) / 2;

  if (active.background) {
    const paddingX = fontSize * 0.9;
    const paddingY = fontSize * 0.6;
    const left = x - textWidth / 2 - paddingX;
    const top = y - textHeight / 2 - paddingY;
    const width = textWidth + paddingX * 2;
    const height = textHeight + paddingY * 2;
    ctx.save();
    ctx.fillStyle = "rgba(10, 14, 20, 0.55)";
    ctx.fillRect(left, top, width, height);
    ctx.restore();
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const haloRadius = Math.max(textWidth, textHeight) * (0.7 + pulse * 0.2);
  const halo = ctx.createRadialGradient(
    x,
    y - textHeight * 0.1,
    textHeight * 0.2,
    x,
    y,
    haloRadius
  );
  halo.addColorStop(0, "rgba(120, 200, 190, 0.45)");
  halo.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, haloRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.lineWidth = 2;
  ctx.strokeStyle = HUD_COLORS.ALERT_STROKE;
  ctx.fillStyle = active.textColor ?? HUD_COLORS.PANEL_TEXT;
  for (let i = 0; i < lines.length; i++) {
    const lineY = firstLineY + i * lineHeight;
    ctx.strokeText(lines[i], x, lineY);
    ctx.fillText(lines[i], x, lineY);
  }

  ctx.save();
  ctx.globalAlpha *= 0.35;
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = HUD_COLORS.ACCENT_SOFT;
  const jitter = Math.sin(time * 0.02 + elapsed * 6) * 1.5;
  for (let i = 0; i < lines.length; i++) {
    const lineY = firstLineY + i * lineHeight;
    ctx.fillText(lines[i], x + jitter, lineY);
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  ctx.globalAlpha *= 0.25 + pulse * 0.12;
  const left = x - textWidth / 2 - 6;
  const top = y - textHeight / 2 - 6;
  const width = textWidth + 12;
  const scanGap = 6;
  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  for (let iy = 0; iy <= textHeight; iy += scanGap) {
    const scanJitter = Math.sin(time * 0.03 + iy * 0.6) * 6;
    ctx.fillRect(left + scanJitter, top + iy, width, 2);
  }
  ctx.restore();

  const flareDuration = 0.6;
  if (elapsed < flareDuration) {
    const flareT = Math.max(0, Math.min(1, elapsed / flareDuration));
    const sweepStart = x - textWidth * 0.7;
    const sweepEnd = x + textWidth * 0.7;
    const sweepX = sweepStart + (sweepEnd - sweepStart) * flareT;
    const flareW = textWidth * 0.45;
    const flareH = textHeight * 0.6;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.beginPath();
    ctx.rect(left, y - textHeight * 0.9, width, textHeight * 1.4);
    ctx.clip();
    const flare = ctx.createLinearGradient(sweepX - flareW / 2, y, sweepX + flareW / 2, y);
    flare.addColorStop(0, "rgba(255, 255, 255, 0)");
    flare.addColorStop(0.5, "rgba(255, 240, 200, 0.75)");
    flare.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = flare;
    ctx.fillRect(sweepX - flareW / 2, y - flareH / 2, flareW, flareH);
    ctx.restore();
  }
  ctx.restore();
}

export function drawTutorialCallout(ctx, callout, screenW, screenH) {
  if (!callout) {
    return;
  }
  const x = callout.x ?? screenW * 0.5;
  const y = callout.y ?? screenH * 0.5;
  const offsetX = callout.offsetX ?? 0;
  const offsetY = callout.offsetY ?? -90;
  const labelX = x + offsetX;
  const labelY = y + offsetY;
  const time = performance.now();
  const pulse = 0.6 + 0.4 * Math.sin(time * 0.006);
  const color = callout.color ?? HUD_COLORS.ACCENT;
  const glow = callout.glow ?? HUD_COLORS.ACCENT_GLOW;
  const ringR = callout.ringRadius ?? 16;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = glow;
  ctx.shadowBlur = 10;
  ctx.globalAlpha = 0.6 + pulse * 0.3;
  ctx.beginPath();
  ctx.moveTo(labelX, labelY);
  ctx.lineTo(x, y);
  ctx.stroke();

  const angle = Math.atan2(y - labelY, x - labelX);
  const headLen = 10;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - Math.cos(angle - Math.PI / 6) * headLen, y - Math.sin(angle - Math.PI / 6) * headLen);
  ctx.lineTo(x - Math.cos(angle + Math.PI / 6) * headLen, y - Math.sin(angle + Math.PI / 6) * headLen);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.4 + pulse * 0.35;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, ringR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export {
  ALERT,
  BEARING,
  COMPASS,
  HUD_COLORS,
  HUD_FONT,
  MINIMAP,
  SCAN_PULSE
};

