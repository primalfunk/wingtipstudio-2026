import { CONFIG } from "../game/config.js";
import { sounds } from "../game/audio.js";

const { SHIP, DEBUG } = CONFIG;
const ROT_SPEED = SHIP.ROT_SPEED;     // radians/sec
const THRUST = SHIP.THRUST;
const MAX_FUEL = SHIP.MAX_FUEL;
const THRUST_FUEL_RATE = SHIP.THRUST_FUEL_RATE;
const ROT_FUEL_RATE = SHIP.ROT_FUEL_RATE;

const SHIP_SPRITE = new Image();
SHIP_SPRITE.src = SHIP.SPRITE_SRC;
const SHIP_DRAW_SIZE = SHIP.DRAW_SIZE;
const THRUST_LOOP_SEGMENT = SHIP.THRUST_LOOP_SEGMENT;
const THRUST_LOOP_CROSSFADE = SHIP.THRUST_LOOP_CROSSFADE;
const THRUST_VISUAL = SHIP.THRUST_VISUAL;

const UPGRADE_PALETTES = {
  SHIELD: ["#567EA6", "#6A94BD", "#7EABD3", "#96C2E6", "#B3DAF4"],
  FIRE_RATE: ["#A8794E", "#BC8E5B", "#D1A56A", "#E6BF7C", "#F6D993"],
  FIRE_DISTANCE: ["#5F9E87", "#73B39A", "#89C8AE", "#A4DCC6", "#BDEFD9"],
  FUEL: ["#5E8E74", "#73A586", "#8BBC9B", "#A2D1B2", "#BCE6C9"],
  COLLECTOR: ["#8C6FA6", "#9F82BA", "#B598CF", "#C9B0E2", "#DCC7F0"]
};

const INDICATOR_GEOM = {
  SHIELD_FIELD_INNER: 0.55,
  SHIELD_FIELD_OUTER: 0.9,
  NOSE_TIP_Y: -0.98,
  NOSE_BASE_Y: -0.48,
  NOSE_WIDTH: 0.42,
  COCKPIT_Y: -0.24,
  COCKPIT_W: 0.18,
  COCKPIT_H: 0.12,
  POD_OFFSET_X: 0.24,
  POD_W: 0.13,
  POD_H: 0.09,
  SHIELD_KNOB_Y: -0.02,
  SHIELD_KNOB_R: 0.055,
  FUEL_Y: 0.16,
  FUEL_W: 0.18,
  FUEL_H: 0.16,
  COLLECTOR_CORE_Y: 0.32,
  COLLECTOR_CORE_W: 0.12,
  COLLECTOR_CORE_H: 0.1,
  COLLECTOR_FIELD_INNER: 0.38,
  COLLECTOR_FIELD_OUTER: 0.5
};

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const full = clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean;
  const int = Number.parseInt(full, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255
  };
}

function rgbaFromHex(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function paletteColor(palette, level) {
  if (level <= 0) {
    return null;
  }
  const idx = Math.min(level - 1, palette.length - 1);
  return palette[idx];
}

function levelAlpha(level, min = 0.35, max = 0.9) {
  if (level <= 0) {
    return 0;
  }
  const t = clamp01((level - 1) / 4);
  return min + (max - min) * t;
}

export class Ship {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.heading = 0;
    this.maxFuel = MAX_FUEL;
    this.fuel = MAX_FUEL;
    this.thrusting = 0;
    this.thrustLoopActive = false;
    this.rotateLoopActive = false;
    this.kickTimer = 0;
  }

  stopThrustLoop() {
    if (this.thrustLoopActive) {
      sounds.stopLoop("thrust");
      this.thrustLoopActive = false;
    }
  }

  stopRotateLoop() {
    if (this.rotateLoopActive) {
      sounds.stopLoop("thrust_rotate");
      this.rotateLoopActive = false;
    }
  }

  update(dt, input = null) {
    this.kickTimer = Math.max(0, this.kickTimer - dt);
    const prevThrust = this.thrusting;
    const controlsDisabled = Boolean(input?.disableControls);
    if (controlsDisabled) {
      this.thrusting = 0;
      this.kickTimer = 0;
      this.stopThrustLoop();
      this.stopRotateLoop();
      return;
    }
    let rotationInput = 0;
    let thrustInput = 0;

    let aimAngle = null;
    if (input) {
      if (typeof input.rotationInput === "number") {
        rotationInput = input.rotationInput;
      }
      if (typeof input.thrustInput === "number") {
        thrustInput = input.thrustInput;
      }
      if (Number.isFinite(input.aimAngle)) {
        aimAngle = input.aimAngle;
      }
    }

    const fuelCost = (Math.abs(thrustInput) * THRUST_FUEL_RATE + Math.abs(rotationInput) * ROT_FUEL_RATE) * dt;
    if (fuelCost > 0 && this.fuel <= 0) {
      this.thrusting = 0;
      this.kickTimer = 0;
      this.stopThrustLoop();
      this.stopRotateLoop();
      return;
    }

    let scale = 1;
    if (fuelCost > 0 && this.fuel < fuelCost) {
      scale = this.fuel / fuelCost;
    }

    if (aimAngle !== null) {
      this.heading = aimAngle;
      rotationInput = 0;
      this.stopRotateLoop();
    }

    if (rotationInput !== 0) {
      this.heading += rotationInput * ROT_SPEED * dt * scale;
      if (thrustInput === 0 && !this.rotateLoopActive) {
        sounds.startLoop("thrust_rotate", THRUST_LOOP_SEGMENT, THRUST_LOOP_CROSSFADE);
        this.rotateLoopActive = true;
      }
    } else {
      this.stopRotateLoop();
    }

    if (thrustInput !== 0) {
      const fx = Math.sin(this.heading);
      const fy = -Math.cos(this.heading);

      this.vx += fx * THRUST * thrustInput * dt * scale;
      this.vy += fy * THRUST * thrustInput * dt * scale;
      if (!this.thrustLoopActive) {
        sounds.startLoop("thrust", THRUST_LOOP_SEGMENT, THRUST_LOOP_CROSSFADE);
        this.thrustLoopActive = true;
      }
      if (this.rotateLoopActive) {
        this.stopRotateLoop();
      }
    }

    if (fuelCost > 0) {
      this.fuel = Math.max(0, this.fuel - fuelCost * scale);
    }

    const nextThrust = thrustInput * scale;
    if (nextThrust > 0 && prevThrust <= 0) {
      this.kickTimer = THRUST_VISUAL.KICK_DURATION;
    }
    this.thrusting = nextThrust;
    if (this.thrusting === 0) {
      this.stopThrustLoop();
    }
  }

  draw(ctx, speed = 0, visuals = null) {
    // World-space draw (unused for now)
    this.drawScreen(ctx, this.x, this.y, speed, visuals);
  }

  drawScreen(ctx, sx, sy, speed = 0, visuals = null) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(this.heading);

    const now = performance.now() / 1000;
    this.drawShieldAura(ctx, visuals, now);
    this.drawCollectorField(ctx, visuals, now);
    if (this.thrusting !== 0 || this.kickTimer > 0) {
      this.drawFlames(ctx, this.thrusting, speed);
    }
    this.drawHullFill(ctx);
    this.drawIndicators(ctx, visuals, now);
    this.drawHullLines(ctx);
    if (DEBUG.SHIP_VISUALS) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      this.drawIndicators(ctx, visuals, now);
      ctx.restore();
    }
    ctx.restore();
  }

  drawShieldAura(ctx, visuals, time) {
    const shieldLevel = Math.max(0, visuals?.shieldLevel ?? 0);
    const shieldRatio = clamp01(visuals?.shieldRatio ?? 0);
    if (shieldLevel <= 0 || shieldRatio <= 0) {
      return;
    }
    const color = paletteColor(UPGRADE_PALETTES.SHIELD, shieldLevel);
    if (!color) {
      return;
    }
    const radius = SHIP_DRAW_SIZE * 0.58;
    const inner = SHIP_DRAW_SIZE * INDICATOR_GEOM.SHIELD_FIELD_INNER;
    const outer = SHIP_DRAW_SIZE * INDICATOR_GEOM.SHIELD_FIELD_OUTER;
    const drift = SHIP_DRAW_SIZE * 0.02;
    const offsetX = Math.cos(time * 0.18) * drift;
    const offsetY = Math.sin(time * 0.12) * drift;
    const glow = ctx.createRadialGradient(offsetX, offsetY, inner * 0.9, 0, 0, outer);
    const alpha = clamp01(shieldRatio) * levelAlpha(shieldLevel, 0.35, 0.8);
    glow.addColorStop(0, rgbaFromHex(color, alpha));
    glow.addColorStop(1, rgbaFromHex(color, 0));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(radius, outer), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawCollectorField(ctx, visuals, time) {
    const collectorLevel = Math.max(0, visuals?.collectorLevel ?? 0);
    if (collectorLevel <= 0) {
      return;
    }
    const color = paletteColor(UPGRADE_PALETTES.COLLECTOR, Math.max(1, collectorLevel));
    if (!color) {
      return;
    }
    const levelNorm = clamp01((collectorLevel - 1) / 4);
    const innerR = SHIP_DRAW_SIZE * INDICATOR_GEOM.COLLECTOR_FIELD_INNER;
    const outerR = SHIP_DRAW_SIZE * INDICATOR_GEOM.COLLECTOR_FIELD_OUTER;
    const range = Math.max(1, outerR - innerR);
    const speed = lerp(0.08, 0.22, levelNorm);
    const arcLen = Math.PI / 6;
    const alpha = lerp(0.18, 0.5, levelNorm);
    ctx.save();
    ctx.strokeStyle = rgbaFromHex(color, alpha);
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      const phase = (time * speed + i * 0.2) % 1;
      const r = outerR - phase * range;
      const angle = i * (Math.PI * 2 / 6) + time * 0.08;
      ctx.beginPath();
      ctx.arc(0, 0, r, angle - arcLen * 0.5, angle + arcLen * 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawIndicators(ctx, visuals, time) {
    if (!visuals) {
      return;
    }
    const shieldLevel = Math.max(0, visuals.shieldLevel ?? 0);
    const shieldRatio = clamp01(visuals.shieldRatio ?? 0);
    const fireRateLevel = Math.max(0, visuals.fireRateLevel ?? 0);
    const fireDistanceLevel = Math.max(0, visuals.fireDistanceLevel ?? 0);
    const scanDistanceLevel = Math.max(
      0,
      visuals.scanDistanceLevel ?? visuals.fireDistanceLevel ?? 0
    );
    const fuelTankLevel = Math.max(0, visuals.fuelTankLevel ?? 0);
    const fuelRatio = clamp01(visuals.fuelRatio ?? 0);
    const collectorLevel = Math.max(0, visuals.collectorLevel ?? 0);
    const fireCooldown = Math.max(0.1, visuals.fireCooldownSeconds ?? 0.26);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    this.drawNose(ctx, scanDistanceLevel, time);
    this.drawCockpitCore(ctx);
    this.drawFireRatePod(ctx, fireRateLevel, fireCooldown, time);
    this.drawFireDistancePod(ctx, fireDistanceLevel, time);
    this.drawShieldKnob(ctx, shieldLevel, shieldRatio, time);
    this.drawFuelTank(ctx, fuelTankLevel, fuelRatio, time);
    this.drawCollectorCore(ctx, collectorLevel, time);

    ctx.restore();
  }

  drawNose(ctx, scanDistanceLevel, time) {
    const levelNorm = clamp01((scanDistanceLevel - 1) / 4);
    const tipY = SHIP_DRAW_SIZE * INDICATOR_GEOM.NOSE_TIP_Y;
    const baseY = SHIP_DRAW_SIZE * INDICATOR_GEOM.NOSE_BASE_Y;
    const halfW = SHIP_DRAW_SIZE * INDICATOR_GEOM.NOSE_WIDTH;
    const color = paletteColor(UPGRADE_PALETTES.FIRE_DISTANCE, Math.max(1, scanDistanceLevel)) ?? "#8a8a8a";
    const baseFill = scanDistanceLevel > 0
      ? rgbaFromHex(color, 0.55)
      : "rgba(130, 130, 130, 0.35)";
    const outline = "rgba(0, 0, 0, 0.8)";

    const curvePull = (baseY - tipY) * 0.22;
    ctx.save();
    ctx.fillStyle = baseFill;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-halfW, baseY);
    ctx.quadraticCurveTo(-halfW * 0.15, tipY + curvePull, 0, tipY);
    ctx.quadraticCurveTo(halfW * 0.15, tipY + curvePull, halfW, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const inset = 0.6;
    const innerW = halfW * inset;
    const innerTip = lerp(baseY, tipY, 0.78);
    const speed = lerp(0.2, 0.6, levelNorm);
    const phase = (time * speed) % 1;
    const spread = 0.22;
    const highlight = rgbaFromHex(color, 0.9);
    const baseColor = rgbaFromHex(color, 0.35);
    const grad = ctx.createLinearGradient(0, baseY, 0, tipY);
    const p0 = Math.max(0, phase - spread);
    const p1 = Math.min(1, phase + spread);
    grad.addColorStop(0, baseColor);
    grad.addColorStop(p0, baseColor);
    grad.addColorStop(phase, highlight);
    grad.addColorStop(p1, baseColor);
    grad.addColorStop(1, baseColor);
    ctx.fillStyle = grad;
    const innerBaseY = baseY + (baseY - tipY) * 0.08;
    const innerPull = (innerBaseY - innerTip) * 0.22;
    ctx.beginPath();
    ctx.moveTo(-innerW, innerBaseY);
    ctx.quadraticCurveTo(-innerW * 0.18, innerTip + innerPull, 0, innerTip);
    ctx.quadraticCurveTo(innerW * 0.18, innerTip + innerPull, innerW, innerBaseY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawCockpitCore(ctx) {
    const cx = 0;
    const cy = SHIP_DRAW_SIZE * INDICATOR_GEOM.COCKPIT_Y;
    const w = SHIP_DRAW_SIZE * INDICATOR_GEOM.COCKPIT_W;
    const h = SHIP_DRAW_SIZE * INDICATOR_GEOM.COCKPIT_H;
    ctx.fillStyle = "rgba(70, 78, 86, 0.82)";
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawFireRatePod(ctx, fireRateLevel, fireCooldown, time) {
    const podX = -SHIP_DRAW_SIZE * INDICATOR_GEOM.POD_OFFSET_X;
    const podY = SHIP_DRAW_SIZE * INDICATOR_GEOM.COCKPIT_Y;
    const podW = SHIP_DRAW_SIZE * INDICATOR_GEOM.POD_W;
    const podH = SHIP_DRAW_SIZE * INDICATOR_GEOM.POD_H;
    const connectorStartX = -SHIP_DRAW_SIZE * 0.28;
    const connectorEndX = podX + podW * 0.5;
    const levelNorm = clamp01((fireRateLevel - 1) / 4);
    ctx.save();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(connectorStartX, podY);
    ctx.lineTo(connectorEndX, podY);
    ctx.stroke();
    ctx.translate(podX, podY);
    ctx.fillStyle = "rgba(30, 38, 46, 0.7)";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(0, 0, podW * 0.5, podH * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const color = paletteColor(UPGRADE_PALETTES.FIRE_RATE, Math.max(1, fireRateLevel));
    const alpha = fireRateLevel > 0 ? lerp(0.25, 0.75, levelNorm) : 0.12;
    const arcSpan = lerp(Math.PI * 0.12, Math.PI * 0.45, levelNorm);
    const period = Math.max(0.12, fireCooldown);
    const phase = (time % period) / period;
    const angle = phase * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = rgbaFromHex(color, alpha);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(0, 0, podW * 0.28, angle - arcSpan * 0.5, angle + arcSpan * 0.5);
    ctx.stroke();
    ctx.restore();
  }

  drawFireDistancePod(ctx, fireDistanceLevel, time) {
    const podX = SHIP_DRAW_SIZE * INDICATOR_GEOM.POD_OFFSET_X;
    const podY = SHIP_DRAW_SIZE * INDICATOR_GEOM.COCKPIT_Y;
    const podW = SHIP_DRAW_SIZE * INDICATOR_GEOM.POD_W;
    const podH = SHIP_DRAW_SIZE * INDICATOR_GEOM.POD_H;
    const connectorStartX = SHIP_DRAW_SIZE * 0.28;
    const connectorEndX = podX - podW * 0.5;
    const levelNorm = clamp01((fireDistanceLevel - 1) / 4);
    ctx.save();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(connectorStartX, podY);
    ctx.lineTo(connectorEndX, podY);
    ctx.stroke();
    ctx.translate(podX, podY);
    ctx.fillStyle = "rgba(30, 38, 46, 0.7)";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(0, 0, podW * 0.5, podH * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const color = paletteColor(UPGRADE_PALETTES.FIRE_DISTANCE, Math.max(1, fireDistanceLevel));
    const baseAlpha = fireDistanceLevel > 0 ? lerp(0.18, 0.6, levelNorm) : 0.1;
    const lineStart = podH * 0.35;
    const lineEnd = -podH * 0.35;
    const lineLen = lineStart - lineEnd;
    ctx.strokeStyle = rgbaFromHex(color, baseAlpha * 0.4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, lineStart);
    ctx.lineTo(0, lineEnd);
    ctx.stroke();

    const speed = lerp(0.35, 0.9, levelNorm);
    const phase = (time * speed) % 1;
    const segFrac = lerp(0.2, 0.6, levelNorm);
    const segLen = lineLen * segFrac;
    const segStart = lineStart - phase * (lineLen - segLen);
    const segEnd = segStart - segLen;
    ctx.strokeStyle = rgbaFromHex(color, baseAlpha);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(0, segStart);
    ctx.lineTo(0, segEnd);
    ctx.stroke();

    if (fireDistanceLevel >= 4) {
      const echoOffset = lineLen * 0.28;
      ctx.strokeStyle = rgbaFromHex(color, baseAlpha * 0.45);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, segStart + echoOffset);
      ctx.lineTo(0, segEnd + echoOffset);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawShieldKnob(ctx, shieldLevel, shieldRatio, time) {
    if (shieldLevel <= 0) {
      return;
    }
    const r = SHIP_DRAW_SIZE * INDICATOR_GEOM.SHIELD_KNOB_R;
    const y = SHIP_DRAW_SIZE * INDICATOR_GEOM.SHIELD_KNOB_Y;
    const levelNorm = clamp01((shieldLevel - 1) / 4);
    const color = paletteColor(UPGRADE_PALETTES.SHIELD, Math.max(1, shieldLevel));
    ctx.save();
    ctx.translate(0, y);
    ctx.strokeStyle = rgbaFromHex(color, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    const speed = lerp(0.4, 1.2, levelNorm);
    const span = lerp(Math.PI * 0.35, Math.PI * 1.9, levelNorm);
    const alpha = lerp(0.2, 0.75, levelNorm) * (0.2 + 0.8 * shieldRatio);
    const angle = time * speed;
    ctx.strokeStyle = rgbaFromHex(color, alpha);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, r, angle - span * 0.5, angle + span * 0.5);
    ctx.stroke();
    ctx.restore();
  }

  drawFuelTank(ctx, fuelTankLevel, fuelRatio, time) {
    const color = paletteColor(UPGRADE_PALETTES.FUEL, Math.max(1, fuelTankLevel)) ?? "#7a7a7a";
    const x = -SHIP_DRAW_SIZE * INDICATOR_GEOM.FUEL_W * 0.5;
    const y = SHIP_DRAW_SIZE * INDICATOR_GEOM.FUEL_Y - SHIP_DRAW_SIZE * INDICATOR_GEOM.FUEL_H * 0.5;
    const w = SHIP_DRAW_SIZE * INDICATOR_GEOM.FUEL_W;
    const h = SHIP_DRAW_SIZE * INDICATOR_GEOM.FUEL_H;
    ctx.save();
    ctx.fillStyle = "rgba(20, 26, 30, 0.6)";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.stroke();

    const fillHeight = h * clamp01(fuelRatio);
    if (fillHeight > 0.5) {
      let fillStyle = rgbaFromHex(color, 0.65);
      if (fuelRatio > 0.9) {
        const drift = (time * 0.12) % 1;
        const grad = ctx.createLinearGradient(0, y, 0, y + h);
        const glow = rgbaFromHex(color, 0.85);
        grad.addColorStop(0, rgbaFromHex(color, 0.55));
        grad.addColorStop(Math.max(0, drift - 0.2), rgbaFromHex(color, 0.55));
        grad.addColorStop(drift, glow);
        grad.addColorStop(Math.min(1, drift + 0.2), rgbaFromHex(color, 0.55));
        grad.addColorStop(1, rgbaFromHex(color, 0.55));
        fillStyle = grad;
      }
      ctx.fillStyle = fillStyle;
      ctx.beginPath();
      ctx.rect(x + 1.2, y + 1.2, w - 2.4, fillHeight - 2.4);
      ctx.fill();
    }
    ctx.restore();
  }

  drawCollectorCore(ctx, collectorLevel, time) {
    const color = paletteColor(UPGRADE_PALETTES.COLLECTOR, Math.max(1, collectorLevel)) ?? "#6f6f78";
    const levelNorm = clamp01((collectorLevel - 1) / 4);
    const y = SHIP_DRAW_SIZE * INDICATOR_GEOM.COLLECTOR_CORE_Y;
    const w = SHIP_DRAW_SIZE * INDICATOR_GEOM.COLLECTOR_CORE_W;
    const h = SHIP_DRAW_SIZE * INDICATOR_GEOM.COLLECTOR_CORE_H;
    const speed = lerp(0.6, 1.4, levelNorm);
    const compress = 0.85 + Math.sin(time * speed) * 0.08 * (0.35 + 0.65 * levelNorm);
    const grad = ctx.createLinearGradient(0, y - h * 0.5, 0, y + h * 0.5);
    grad.addColorStop(0, rgbaFromHex(color, 0.2));
    grad.addColorStop(0.5, rgbaFromHex(color, 0.75));
    grad.addColorStop(1, rgbaFromHex(color, 0.2));
    ctx.save();
    ctx.translate(0, y);
    ctx.scale(compress, 1);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.5);
    ctx.lineTo(-w * 0.5, -h * 0.5);
    ctx.lineTo(w * 0.5, -h * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawHullFill(ctx) {
    const half = SHIP_DRAW_SIZE / 2;
    const noseW = SHIP_DRAW_SIZE * 0.22;
    const bodyW = SHIP_DRAW_SIZE * 0.42;
    const tailW = SHIP_DRAW_SIZE * 0.3;
    const noseY = -half * 0.9;
    const shoulderY = -half * 0.55;
    const midY = half * 0.2;
    const tailY = half * 0.58;
    const exhaustY = half * 0.9;
    const hullFill = "rgba(245, 246, 248, 0.95)";
    ctx.save();
    ctx.fillStyle = hullFill;
    ctx.beginPath();
    ctx.moveTo(-noseW, noseY);
    ctx.lineTo(-bodyW, shoulderY);
    ctx.lineTo(-bodyW, midY);
    ctx.lineTo(-tailW, tailY);
    ctx.lineTo(-tailW * 0.6, exhaustY);
    ctx.lineTo(tailW * 0.6, exhaustY);
    ctx.lineTo(tailW, tailY);
    ctx.lineTo(bodyW, midY);
    ctx.lineTo(bodyW, shoulderY);
    ctx.lineTo(noseW, noseY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawHullLines(ctx) {
    const half = SHIP_DRAW_SIZE / 2;
    const noseW = SHIP_DRAW_SIZE * 0.22;
    const bodyW = SHIP_DRAW_SIZE * 0.42;
    const tailW = SHIP_DRAW_SIZE * 0.3;
    const noseY = -half * 0.9;
    const shoulderY = -half * 0.55;
    const midY = half * 0.2;
    const tailY = half * 0.58;
    const exhaustY = half * 0.9;
    const hullEdge = "rgba(0, 0, 0, 0.9)";
    const innerColor = "rgba(130, 130, 130, 0.75)";

    ctx.save();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = hullEdge;
    ctx.beginPath();
    ctx.moveTo(-noseW, noseY);
    ctx.lineTo(-bodyW, shoulderY);
    ctx.lineTo(-bodyW, midY);
    ctx.lineTo(-tailW, tailY);
    ctx.lineTo(-tailW * 0.6, exhaustY);
    ctx.lineTo(tailW * 0.6, exhaustY);
    ctx.lineTo(tailW, tailY);
    ctx.lineTo(bodyW, midY);
    ctx.lineTo(bodyW, shoulderY);
    ctx.lineTo(noseW, noseY);
    ctx.closePath();
    ctx.stroke();

    ctx.strokeStyle = innerColor;
    ctx.lineWidth = 1;

    // Sensor nose / perception arc
    ctx.beginPath();
    ctx.moveTo(-noseW * 0.65, noseY + half * 0.08);
    ctx.lineTo(noseW * 0.65, noseY + half * 0.08);
    ctx.stroke();

    // Navigation spine
    ctx.beginPath();
    ctx.moveTo(0, shoulderY + half * 0.06);
    ctx.lineTo(0, midY - half * 0.08);
    ctx.stroke();

    // Power core
    const coreW = SHIP_DRAW_SIZE * 0.22;
    const coreH = SHIP_DRAW_SIZE * 0.16;
    ctx.strokeRect(-coreW / 2, -coreH / 2, coreW, coreH);

    // Structural frame lines
    ctx.beginPath();
    ctx.moveTo(-bodyW * 0.75, 0);
    ctx.lineTo(bodyW * 0.75, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-bodyW * 0.65, midY - half * 0.02);
    ctx.lineTo(bodyW * 0.65, midY - half * 0.02);
    ctx.stroke();

    // Propulsion bays
    const bayW = SHIP_DRAW_SIZE * 0.18;
    const bayH = SHIP_DRAW_SIZE * 0.14;
    const bayY = half * 0.42;
    ctx.strokeRect(-bodyW * 0.72 - bayW / 2, bayY - bayH / 2, bayW, bayH);
    ctx.strokeRect(bodyW * 0.72 - bayW / 2, bayY - bayH / 2, bayW, bayH);

    // Exhaust plane
    ctx.beginPath();
    ctx.moveTo(-tailW * 0.6, exhaustY);
    ctx.lineTo(tailW * 0.6, exhaustY);
    ctx.stroke();

    ctx.restore();
  }

  drawFlames(ctx, thrusting, speed = 0) {
    const direction = 1;
    const baseY = 10;
    const offsets = [-6, 6];
    const flicker = 0.8 + Math.random() * 0.4;
    const thrustPower = Math.min(1, Math.abs(thrusting));
    const speedRatio = Math.min(1, speed / 520);
    const kickRatio = THRUST_VISUAL.KICK_DURATION > 0
      ? Math.min(1, this.kickTimer / THRUST_VISUAL.KICK_DURATION)
      : 0;
    const widthScale = 0.8 + thrustPower * 0.6 + kickRatio * 0.5;
    const flameLen = (8 + thrustPower * 6) * flicker;
    const outerLen = flameLen * (1.2 + thrustPower * 0.25);
    const heatLen = outerLen * 1.6;
    const plumeLen = THRUST_VISUAL.PLUME_BASE
      + thrustPower * THRUST_VISUAL.PLUME_MAX
      + speedRatio * THRUST_VISUAL.PLUME_SPEED;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    if (thrustPower > 0 || kickRatio > 0) {
      ctx.save();
      ctx.translate(0, baseY);
      ctx.scale(1, direction);

      const flareRadius = THRUST_VISUAL.FLARE_RADIUS * (0.6 + thrustPower * 0.6);
      const flare = ctx.createRadialGradient(0, 2, 0, 0, 2, flareRadius);
      flare.addColorStop(0, `rgba(120, 200, 190, ${THRUST_VISUAL.FLARE_ALPHA + thrustPower * 0.1})`);
      flare.addColorStop(1, "rgba(120, 200, 190, 0)");
      ctx.fillStyle = flare;
      ctx.beginPath();
      ctx.arc(0, 2, flareRadius, 0, Math.PI * 2);
      ctx.fill();

      if (kickRatio > 0) {
        const kickRadius = THRUST_VISUAL.KICK_RADIUS * (0.8 + kickRatio * 0.7);
        const kick = ctx.createRadialGradient(0, 0, 0, 0, 0, kickRadius);
        const kickAlpha = THRUST_VISUAL.KICK_ALPHA * kickRatio;
        kick.addColorStop(0, `rgba(255, 230, 200, ${kickAlpha})`);
        kick.addColorStop(1, "rgba(255, 140, 90, 0)");
        ctx.fillStyle = kick;
        ctx.beginPath();
        ctx.arc(0, 0, kickRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      const plumeWidth = THRUST_VISUAL.PLUME_WIDTH * widthScale;
      const plumeGrad = ctx.createLinearGradient(0, 0, 0, plumeLen);
      plumeGrad.addColorStop(0, `rgba(120, 200, 190, ${0.35 + thrustPower * 0.25})`);
      plumeGrad.addColorStop(1, "rgba(120, 200, 190, 0)");
      ctx.fillStyle = plumeGrad;
      ctx.beginPath();
      ctx.moveTo(-plumeWidth, 0);
      ctx.lineTo(plumeWidth, 0);
      ctx.lineTo(0, plumeLen);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    for (const ox of offsets) {
      ctx.save();
      ctx.translate(ox, baseY);
      ctx.scale(1, direction);

      const time = performance.now();
      ctx.strokeStyle = `rgba(120, 200, 190, ${0.2 + thrustPower * 0.2})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < THRUST_VISUAL.SHIMMER_COUNT; i++) {
        const offsetX = (i - (THRUST_VISUAL.SHIMMER_COUNT - 1) / 2) * THRUST_VISUAL.SHIMMER_WIDTH;
        const wave = Math.sin(time * 0.01 + i) * 2;
        const shimmerLen = heatLen + THRUST_VISUAL.SHIMMER_LENGTH * thrustPower;
        ctx.beginPath();
        ctx.moveTo(offsetX, 2);
        ctx.lineTo(offsetX + wave, shimmerLen);
        ctx.stroke();
      }

      const heatGradient = ctx.createLinearGradient(0, 0, 0, heatLen);
      heatGradient.addColorStop(0, "rgba(255, 200, 140, 0.35)");
      heatGradient.addColorStop(1, "rgba(255, 120, 60, 0)");
      ctx.fillStyle = heatGradient;
      ctx.beginPath();
      ctx.moveTo(-4 * widthScale, 0);
      ctx.lineTo(4 * widthScale, 0);
      ctx.lineTo(0, heatLen);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "rgba(255, 140, 60, 0.85)";
      ctx.beginPath();
      ctx.moveTo(-2 * widthScale, 0);
      ctx.lineTo(2 * widthScale, 0);
      ctx.lineTo(0, outerLen);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "rgba(255, 240, 180, 0.9)";
      ctx.beginPath();
      ctx.moveTo(-1.2 * widthScale, 0);
      ctx.lineTo(1.2 * widthScale, 0);
      ctx.lineTo(0, flameLen);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
    ctx.restore();
  }

}

