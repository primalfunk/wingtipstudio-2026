import { TypingValidator } from './TypingValidator.js';
import { calculateDecayDurationFromWpm, signalPanelConfig } from '../config/signalPanels.js';

export const STREAM_PHRASE_STATE = {
  INCOMING: 'incoming',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  MISSED: 'missed',
  FAILED: 'failed'
};

export class StreamPhrase {
  constructor({ text, x, y, speed, activationZoneX, failureZoneX }) {
    this.text = text;
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.activationZoneX = activationZoneX;
    this.failureZoneX = failureZoneX;
    this.state = STREAM_PHRASE_STATE.ACTIVE;
    this.validator = new TypingValidator(text);
    this.decayElapsedMs = 0;
    this.decayDurationMs = this.calculateDecayDuration(speed);
    this.integrity = 100;
    this.corruptionLevel = 0;
  }

  update(deltaMs) {
    if (this.state === STREAM_PHRASE_STATE.COMPLETED || this.state === STREAM_PHRASE_STATE.MISSED) {
      return;
    }

    this.decayDurationMs = this.calculateDecayDuration(this.speed);
    this.decayElapsedMs += deltaMs;
    const ratio = this.getDecayRatio();
    this.integrity = Math.max(0, Math.round((1 - ratio) * 100));
    this.corruptionLevel = ratio;

    if (!this.validator.completed && ratio >= 1) {
      this.state = STREAM_PHRASE_STATE.MISSED;
    }
  }

  processCharacter(character) {
    if (this.state === STREAM_PHRASE_STATE.MISSED || this.state === STREAM_PHRASE_STATE.COMPLETED) {
      return { accepted: false, correct: false, completed: false };
    }

    const result = this.validator.processCharacter(character);

    if (result.completed) {
      this.state = STREAM_PHRASE_STATE.COMPLETED;
    } else if (result.accepted && this.state === STREAM_PHRASE_STATE.INCOMING) {
      this.state = STREAM_PHRASE_STATE.ACTIVE;
    }

    return result;
  }

  backspace() {
    return this.validator.backspace();
  }

  getProgress() {
    return this.validator.getProgress();
  }

  getDecayRatio() {
    return Math.max(0, Math.min(1, this.decayElapsedMs / this.decayDurationMs));
  }

  calculateDecayDuration(speed) {
    return calculateDecayDurationFromWpm({
      text: this.text,
      speed,
      config: signalPanelConfig.singlePanel
    });
  }

  getDebugInfo() {
    return {
      text: this.text,
      state: this.state,
      progressIndex: this.validator.currentIndex,
      speed: this.speed,
      targetWpm: Math.round(this.speed / signalPanelConfig.singlePanel.speedToWpmDivisor),
      decayDurationMs: Math.round(this.decayDurationMs),
      x: Math.round(this.x),
      y: Math.round(this.y),
      mistakes: this.validator.mistakeCount,
      integrity: this.integrity,
      decayRatio: Math.round(this.getDecayRatio() * 100)
    };
  }
}
