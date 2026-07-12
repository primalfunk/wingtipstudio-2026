import { GAME_HEIGHT, GAME_WIDTH } from '../config.js';
import { fontConfig } from '../config/fonts.js';
import { visualConfig } from '../config/visuals.js';
import { VisualSettings } from './VisualSettings.js';

export class BackgroundRenderer {
  constructor(scene, { depth = -20 } = {}) {
    this.scene = scene;
    this.graphics = scene.add.graphics().setDepth(depth);
    this.scanlines = scene.add.graphics().setDepth(depth + 1);
    this.edgeStatic = scene.add.graphics().setDepth(depth + 2);
    this.glyphs = [];
    this.biome = 'signalArchive';
    this.elapsed = 0;

    for (let index = 0; index < 20; index += 1) {
      const glyph = scene.add.text(
        (index * 67) % GAME_WIDTH,
        110 + ((index * 43) % 460),
        '',
        {
          fontFamily: fontConfig.mono,
          fontSize: '14px',
          color: '#7cdfff'
        }
      ).setAlpha(0.16).setDepth(depth + 3);
      this.glyphs.push(glyph);
    }
  }

  update({ biome = 'signalArchive', instability = 0, flow = 0, finale = false } = {}, delta = 16.67) {
    this.elapsed += VisualSettings.reduceMotion ? 0 : delta;
    this.biome = biome || this.biome;
    const accent = visualConfig.biomeAccents[this.biome] ?? visualConfig.biomeAccents.signalArchive;
    const flowBoost = Math.min(visualConfig.flow.maxBackgroundBoost, flow / 160);
    const instabilityBoost = Math.min(0.22, instability / 420);
    const motion = VisualSettings.reduceMotion ? 0 : this.elapsed / 1000;
    const glowScale = VisualSettings.reduceGlow ? 0.45 : 1;

    this.graphics.clear();
    this.graphics.fillStyle(visualConfig.colors.background, 1);
    this.graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.drawGrid(accent, glowScale);
    this.drawStreams(accent, motion, flowBoost, instabilityBoost, finale, glowScale);
    this.drawBiomeMarks(accent, motion);
    this.drawScanlines(instabilityBoost, glowScale);
    this.updateGlyphs(accent, motion, instabilityBoost);
  }

  drawGrid(accent, glowScale) {
    this.graphics.lineStyle(1, accent.color, (0.035 + accent.lineAlpha * 0.18) * glowScale);
    for (let x = 80; x < GAME_WIDTH; x += 80) {
      this.graphics.lineBetween(x, 0, x, GAME_HEIGHT);
    }
    for (let y = 72; y < GAME_HEIGHT; y += 72) {
      this.graphics.lineBetween(0, y, GAME_WIDTH, y);
    }
  }

  drawStreams(accent, motion, flowBoost, instabilityBoost, finale, glowScale) {
    const centerY = GAME_HEIGHT / 2;
    const streamAlpha = Math.min(0.42, (accent.lineAlpha + flowBoost + (finale ? 0.14 : 0)) * glowScale);

    for (let lane = -2; lane <= 2; lane += 1) {
      const offset = lane * 38;
      const wave = Math.sin(motion * 0.8 + lane) * 10;
      this.graphics.lineStyle(lane === 0 ? 3 : 1, accent.color, lane === 0 ? streamAlpha : streamAlpha * 0.55);
      this.graphics.beginPath();
      this.graphics.moveTo(0, centerY + offset + wave);
      for (let x = 0; x <= GAME_WIDTH; x += 80) {
        const y = centerY + offset + Math.sin(x / 150 + motion + lane) * (12 + instabilityBoost * 22);
        this.graphics.lineTo(x, y);
      }
      this.graphics.strokePath();
    }
  }

  drawBiomeMarks(accent, motion) {
    if (this.biome === 'mirrorConduit') {
      this.graphics.lineStyle(1, accent.color, 0.12);
      this.graphics.lineBetween(0, GAME_HEIGHT / 2 - 92, GAME_WIDTH, GAME_HEIGHT / 2 + 92);
      this.graphics.lineBetween(0, GAME_HEIGHT / 2 + 92, GAME_WIDTH, GAME_HEIGHT / 2 - 92);
    }

    if (this.biome === 'deadRelay') {
      const pulse = VisualSettings.reduceMotion ? 0.08 : 0.08 + Math.max(0, Math.sin(motion * 2)) * 0.08;
      this.graphics.lineStyle(2, accent.color, pulse);
      this.graphics.strokeRect(72, 96, GAME_WIDTH - 144, GAME_HEIGHT - 192);
    }
  }

  drawScanlines(instabilityBoost, glowScale) {
    this.scanlines.clear();
    this.scanlines.lineStyle(1, 0x9bf4ff, visualConfig.hazards.scanlineAlpha * glowScale);
    for (let y = 0; y < GAME_HEIGHT; y += 6) {
      this.scanlines.lineBetween(0, y, GAME_WIDTH, y);
    }

    this.edgeStatic.clear();
    if (instabilityBoost <= 0.02) {
      return;
    }

    const alpha = Math.min(visualConfig.hazards.edgeStaticAlpha, instabilityBoost);
    this.edgeStatic.fillStyle(0xff4966, alpha * 0.55);
    this.edgeStatic.fillRect(0, 0, 8, GAME_HEIGHT);
    this.edgeStatic.fillRect(GAME_WIDTH - 8, 0, 8, GAME_HEIGHT);
  }

  updateGlyphs(accent, motion, instabilityBoost) {
    const glyphSet = accent.glyphs;
    this.glyphs.forEach((glyph, index) => {
      const drift = VisualSettings.reduceMotion ? 0 : motion * (10 + (index % 4) * 3);
      glyph
        .setText(glyphSet[(index + Math.floor(motion * 2)) % glyphSet.length])
        .setColor(VisualSettings.highContrast ? '#ffffff' : accent.textColor)
        .setPosition((index * 67 + drift) % (GAME_WIDTH + 40) - 20, 106 + ((index * 43) % 490))
        .setAlpha(Math.min(0.28, 0.09 + instabilityBoost * 0.45));
    });
  }

  destroy() {
    this.graphics.destroy();
    this.scanlines.destroy();
    this.edgeStatic.destroy();
    this.glyphs.forEach((glyph) => glyph.destroy());
  }
}
