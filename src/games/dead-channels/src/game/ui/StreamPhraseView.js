import { GAME_WIDTH } from '../config.js';
import { signalPanelConfig } from '../config/signalPanels.js';
import { visualConfig } from '../config/visuals.js';
import { VisualSettings } from '../systems/VisualSettings.js';
import { fontConfig } from '../config/fonts.js';

const CHARACTER_STYLE = {
  fontFamily: fontConfig.typing,
  fontSize: '34px'
};

const STATE_COLORS = {
  correct: '#6fffc7',
  current: '#fff2a6',
  remaining: '#e8fbff'
};

const SCRAMBLE_GLYPHS = ['_', '|'];

export class StreamPhraseView {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(100);
    this.characters = [];
    this.hazardState = null;
    this.panel = scene.add.graphics();
    this.headerText = scene.add.text(0, -52, '', {
      fontFamily: fontConfig.ui,
      fontSize: '17px',
      color: '#93e7ff',
      letterSpacing: 1
    }).setOrigin(0.5);
    this.footerText = scene.add.text(0, 52, '', {
      fontFamily: fontConfig.ui,
      fontSize: '15px',
      color: '#8fa6b2',
      letterSpacing: 1
    }).setOrigin(0.5);
    this.currentBracketLeft = scene.add.text(0, 0, '[', {
      ...CHARACTER_STYLE,
      color: '#fff2a6'
    }).setOrigin(0.5).setAlpha(0);
    this.currentBracketRight = scene.add.text(0, 0, ']', {
      ...CHARACTER_STYLE,
      color: '#fff2a6'
    }).setOrigin(0.5).setAlpha(0);
    this.underline = scene.add.rectangle(0, 28, 18, 3, 0xfff2a6, 0.9).setOrigin(0.5).setAlpha(0);
    this.ghostText = scene.add.text(0, 18, '', {
      ...CHARACTER_STYLE,
      color: '#73d7ff'
    }).setOrigin(0.5).setAlpha(0);
    this.errorMarker = scene.add.text(0, -80, '', {
      fontFamily: fontConfig.prompt,
      fontSize: '18px',
      color: '#ff6b72'
    }).setOrigin(0.5).setAlpha(0);

    this.container.add([
      this.panel,
      this.ghostText,
      this.underline,
      this.currentBracketLeft,
      this.currentBracketRight,
      this.headerText,
      this.footerText,
      this.errorMarker
    ]);
  }

  setPhrase(streamPhrase) {
    this.clearCharacters();
    this.streamPhrase = streamPhrase;
    this.panelWidth = this.getPanelWidth(streamPhrase.text);
    this.container.setPosition(streamPhrase.x, streamPhrase.y);
    this.container.setAlpha(0);
    this.container.setScale(0.985);
    this.container.setAngle(0);
    this.ghostText.setAlpha(0);
    this.renderCharacters();
    this.renderPanel();
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: VisualSettings.reduceMotion ? 1 : 180,
      ease: 'Sine.easeOut'
    });
  }

  update(hazardState = null) {
    if (!this.streamPhrase) {
      return;
    }

    this.hazardState = hazardState;
    const jitter = (this.hazardState?.letterJitterIntensity ?? 0) * visualConfig.hazards.jitterScale;
    const jitterX = jitter > 0 ? Math.sin(this.scene.time.now / 130) * Math.min(2, jitter) : 0;
    const jitterY = jitter > 0 ? Math.cos(this.scene.time.now / 150) * Math.min(1.5, jitter) : 0;
    this.container.setPosition(this.streamPhrase.x + jitterX, this.streamPhrase.y + jitterY);
    this.renderPanel();
    this.renderCharacters();
    this.renderGhostText();
  }

  flashCorrect() {
    this.scene.tweens.add({
      targets: this.underline,
      alpha: 1,
      duration: 45,
      yoyo: true,
      ease: 'Sine.easeOut'
    });
  }

  flashMistake() {
    this.errorMarker.setText('DECODE ERROR').setAlpha(1);
    this.scene.tweens.add({
      targets: this.container,
      x: this.container.x + 8,
      duration: VisualSettings.reduceMotion ? 1 : 45,
      yoyo: true,
      repeat: VisualSettings.reduceMotion ? 0 : 2,
      ease: 'Sine.easeInOut'
    });
    this.scene.tweens.add({
      targets: this.errorMarker,
      alpha: 0,
      duration: 260,
      ease: 'Sine.easeOut'
    });
  }

  playComplete(onComplete) {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      scaleX: 1.025,
      scaleY: 1.025,
      duration: 260,
      ease: 'Sine.easeOut',
      onComplete
    });
  }

  playMiss(onComplete) {
    this.errorMarker.setText('SIGNAL LOST').setAlpha(1);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      y: this.container.y + 18,
      duration: 320,
      ease: 'Cubic.easeIn',
      onComplete
    });
  }

  destroy() {
    this.container.destroy();
  }

  renderPanel() {
    const width = this.panelWidth ?? signalPanelConfig.singlePanel.minWidth;
    const height = signalPanelConfig.singlePanel.height;
    const decay = this.streamPhrase.getDecayRatio();
    const accent = decay > signalPanelConfig.corruption.criticalThreshold
      ? visualConfig.colors.red
      : decay > signalPanelConfig.corruption.warningThreshold
        ? visualConfig.colors.gold
        : visualConfig.colors.cyan;
    const alphaPulse = VisualSettings.reduceMotion ? 0 : Math.sin(this.scene.time.now / 230) * 0.04;

    this.panel.clear();
    this.panel.fillStyle(0x020810, 0.82);
    this.panel.fillRect(-width / 2, -height / 2, width, height);
    this.panel.lineStyle(1, accent, VisualSettings.reduceGlow ? 0.38 : 0.56 + alphaPulse);
    this.panel.strokeRect(-width / 2, -height / 2, width, height);
    this.panel.lineStyle(2, accent, VisualSettings.reduceGlow ? 0.22 : 0.34);
    this.panel.lineBetween(-width / 2 + 18, -height / 2 + 28, width / 2 - 18, -height / 2 + 28);
    this.panel.lineStyle(3, accent, 0.65);
    this.panel.lineBetween(-width / 2 + 18, height / 2 - 14, -width / 2 + 18 + (width - 36) * (1 - decay), height / 2 - 14);

    const label = decay > signalPanelConfig.corruption.criticalThreshold
      ? 'DEGRADED'
      : decay > signalPanelConfig.corruption.warningThreshold
        ? 'UNSTABLE'
        : 'RECOVERABLE';
    this.headerText
      .setText(`RELAY FEED // ${label}`)
      .setColor(decay > signalPanelConfig.corruption.criticalThreshold ? '#ff6b72' : '#93e7ff');
    this.footerText.setText(`SIGNAL INTEGRITY ${this.streamPhrase.integrity}%`);
  }

  renderCharacters() {
    const states = this.streamPhrase.validator.getCharacterStates();
    const progressIndex = this.streamPhrase.validator.currentIndex;
    const corrupt = Math.max(
      this.hazardState?.corruptedHintIntensity ?? 0,
      this.streamPhrase.corruptionLevel > signalPanelConfig.corruption.warningThreshold ? this.streamPhrase.corruptionLevel * 0.45 : 0
    );
    const step = this.getCharacterStep(states.length);

    while (this.characters.length < states.length) {
      const textObject = this.scene.add.text(0, 0, '', CHARACTER_STYLE).setOrigin(0.5);
      this.characters.push(textObject);
      this.container.add(textObject);
    }

    for (let index = 0; index < this.characters.length; index += 1) {
      const textObject = this.characters[index];
      const state = states[index];
      textObject.setVisible(Boolean(state));

      if (!state) {
        continue;
      }

      const canCorrupt = corrupt > 0
        && index > progressIndex
        && state.character !== ' '
        && (index + Math.floor(this.scene.time.now / 360)) % 7 === 0;
      const displayCharacter = canCorrupt
        ? SCRAMBLE_GLYPHS[(index + Math.floor(this.scene.time.now / 420)) % SCRAMBLE_GLYPHS.length]
        : state.character;
      textObject.setText(displayCharacter === ' ' ? ' ' : displayCharacter);
      textObject.setColor(VisualSettings.highContrast && state.state === 'remaining' ? '#ffffff' : STATE_COLORS[state.state]);
      textObject.setAlpha(state.state === 'remaining' ? 0.82 : 1);
      textObject.setStyle({
        ...CHARACTER_STYLE,
        backgroundColor: state.state === 'current' ? 'rgba(255, 242, 166, 0.20)' : undefined
      });
      textObject.setShadow(0, 0, state.state === 'current' ? '#fff2a6' : '#35dfff', VisualSettings.reduceGlow ? 0 : state.state === 'current' ? 8 : 3);
      textObject.setPosition((index - (states.length - 1) / 2) * step, 4);
    }

    const current = this.characters[progressIndex];
    if (current?.visible) {
      this.currentBracketLeft.setPosition(current.x - 15, current.y).setAlpha(1);
      this.currentBracketRight.setPosition(current.x + 15, current.y).setAlpha(1);
      this.underline.setPosition(current.x, current.y + 29).setAlpha(0.88);
    } else {
      this.currentBracketLeft.setAlpha(0);
      this.currentBracketRight.setAlpha(0);
      this.underline.setAlpha(0);
    }
  }

  renderGhostText() {
    const ghostIntensity = this.hazardState?.ghostTextIntensity ?? 0;

    if (!ghostIntensity || !this.streamPhrase) {
      this.ghostText.setAlpha(0);
      return;
    }

    this.ghostText
      .setText(this.streamPhrase.text)
      .setPosition(10 + ghostIntensity * 5, 20 + ghostIntensity * 4)
      .setAlpha(Math.min(0.18, 0.06 + ghostIntensity * 0.06));
  }

  getPanelWidth(text) {
    return Math.min(
      signalPanelConfig.singlePanel.maxWidth,
      Math.max(signalPanelConfig.singlePanel.minWidth, text.length * 22 + 120, GAME_WIDTH * 0.58)
    );
  }

  getCharacterStep(length) {
    const width = (this.panelWidth ?? signalPanelConfig.singlePanel.minWidth) - 120;
    return Math.min(20, width / Math.max(1, length));
  }

  clearCharacters() {
    this.characters.forEach((character) => character.destroy());
    this.characters = [];
  }
}
