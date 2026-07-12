import { visualConfig } from '../config/visuals.js';
import { VisualSettings } from '../systems/VisualSettings.js';
import { GAME_WIDTH } from '../config.js';
import { fontConfig } from '../config/fonts.js';

export class Hud {
  constructor(scene, gameState) {
    this.scene = scene;
    this.forkStatus = '';
    this.hazardStatus = '';
    this.powerupLines = [];
    this.multiStreamStatus = '';
    this.panel = scene.add.rectangle(0, 0, GAME_WIDTH, 58, 0x040a13, 0.78)
      .setOrigin(0, 0)
      .setDepth(499)
      .setScrollFactor(0);
    this.border = scene.add.rectangle(0, 0, GAME_WIDTH, 58)
      .setOrigin(0, 0)
      .setStrokeStyle(1, visualConfig.colors.cyan, 0.36)
      .setDepth(500)
      .setScrollFactor(0);
    this.flowLine = scene.add.rectangle(0, 57, 0, 2, visualConfig.colors.green, 0.75)
      .setOrigin(0, 0.5)
      .setDepth(501)
      .setScrollFactor(0);
    this.scoreText = scene.add.text(26, 8, '', {
      fontFamily: fontConfig.prompt,
      fontSize: '34px',
      color: VisualSettings.highContrast ? '#ffffff' : '#fff2a6',
      letterSpacing: 1
    }).setOrigin(0, 0).setDepth(502).setScrollFactor(0);
    this.scoreText.setShadow(0, 0, '#ff3151', VisualSettings.reduceGlow ? 0 : 8);
    this.text = scene.add.text(GAME_WIDTH / 2 + 100, 9, '', {
      fontFamily: fontConfig.ui,
      fontSize: '17px',
      color: VisualSettings.highContrast ? '#ffffff' : '#e8f8ff',
      align: 'center',
      lineSpacing: 2
    }).setOrigin(0.5, 0).setDepth(500).setScrollFactor(0);
    this.text.setShadow(0, 0, '#35dfff', VisualSettings.reduceGlow ? 0 : 3);

    this.update(gameState);
  }

  setForkStatus(value) {
    this.forkStatus = value;
  }

  setHazardStatus(value) {
    this.hazardStatus = value;
  }

  setPowerupLines(lines) {
    this.powerupLines = lines;
  }

  setMultiStreamStatus(value) {
    this.multiStreamStatus = value;
  }

  update(gameState) {
    const encounterType = gameState.encounterType.toUpperCase();
    const progress = `${gameState.encounterProgress}/${gameState.encounterRequired}`;
    const coreLine = [
      `CORE ${gameState.integrity}`,
      `FLOW ${Math.round(gameState.flow)}`,
      `STATIC ${Math.round(gameState.instability)} ${gameState.instabilityBand}`,
      `NODE ${gameState.encounterIndex + 1}/${gameState.totalEncounters} ${encounterType} ${progress}`,
      `WPM ${gameState.getWpm()}`,
      `ACC ${gameState.getAccuracy()}%`
    ].join('   ');

    const activePowerupLine = this.powerupLines
      .find((line) => line.startsWith('Powerups:') && !line.includes('Empty'));
    const contextParts = [];
    if (this.multiStreamStatus) {
      contextParts.push(this.multiStreamStatus.replace('STREAMS ', 'STREAM '));
    } else if (this.forkStatus) {
      contextParts.push('BRANCH LATTICE ACTIVE');
    }
    if (this.hazardStatus) {
      contextParts.push(this.hazardStatus);
    }
    if (activePowerupLine) {
      contextParts.push(activePowerupLine.replace('Powerups: ', 'PWR '));
    }

    const lines = contextParts.length > 0
      ? [coreLine, contextParts.slice(0, 2).join('   ')]
      : [coreLine];

    this.scoreText.setText(`SCORE ${gameState.score}`);
    this.text.setText(lines);
    this.flowLine.setSize(Math.min(GAME_WIDTH, 80 + gameState.flow * 7), gameState.flow >= visualConfig.flow.highThreshold ? 4 : 2);
    this.flowLine.setFillStyle(gameState.flow >= visualConfig.flow.highThreshold ? visualConfig.colors.gold : visualConfig.colors.green, 0.8);

    if (!VisualSettings.reduceGlow && gameState.instabilityBand === 'CRITICAL') {
      this.border.setStrokeStyle(2, visualConfig.colors.red, 0.75);
    } else {
      this.border.setStrokeStyle(1, visualConfig.colors.cyan, VisualSettings.reduceGlow ? 0.2 : 0.32);
    }
  }
}

function formatTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}
