import { TypingValidator } from './TypingValidator.js';
import { calculateDecayDurationFromWpm, signalPanelConfig } from '../config/signalPanels.js';

export const STREAM_INSTANCE_STATE = {
  INCOMING: 'incoming',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  MISSED: 'missed',
  EXPIRED: 'expired',
  RESOLVED: 'resolved'
};

export class StreamInstance {
  constructor({ id, role, phrase, contentEntry = null, difficulty = 1, priority = 1, x, y, speed, failureZoneX, rewards, penalties }) {
    this.id = id;
    this.role = role;
    this.phrase = phrase;
    this.contentEntry = contentEntry;
    this.difficulty = difficulty;
    this.priority = priority;
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.failureZoneX = failureZoneX;
    this.rewards = rewards;
    this.penalties = penalties;
    this.state = STREAM_INSTANCE_STATE.ACTIVE;
    this.validator = new TypingValidator(phrase);
    this.decayElapsedMs = 0;
    this.decayDurationMs = this.calculateDecayDuration(speed);
    this.integrity = 100;
    this.corruptionLevel = 0;
  }

  update(deltaMs, speedMultiplier = 1) {
    if (this.isResolved()) {
      return;
    }

    this.decayDurationMs = this.calculateDecayDuration(this.speed * speedMultiplier);
    this.decayElapsedMs += deltaMs;
    const ratio = this.getDecayRatio();
    this.integrity = Math.max(0, Math.round((1 - ratio) * 100));
    this.corruptionLevel = ratio;

    if (!this.validator.completed && ratio >= 1) {
      this.state = STREAM_INSTANCE_STATE.MISSED;
    }
  }

  processCharacter(character) {
    if (this.isResolved()) {
      return { accepted: false, correct: false, completed: false };
    }

    const result = this.validator.processCharacter(character);

    if (result.completed) {
      this.state = STREAM_INSTANCE_STATE.COMPLETED;
    }

    return result;
  }

  backspace() {
    return this.validator.backspace();
  }

  isResolved() {
    return this.state === STREAM_INSTANCE_STATE.COMPLETED
      || this.state === STREAM_INSTANCE_STATE.MISSED
      || this.state === STREAM_INSTANCE_STATE.EXPIRED
      || this.state === STREAM_INSTANCE_STATE.RESOLVED;
  }

  markResolved() {
    this.state = STREAM_INSTANCE_STATE.RESOLVED;
  }

  getProgress() {
    return this.validator.getProgress();
  }

  getDecayRatio() {
    return Math.max(0, Math.min(1, this.decayElapsedMs / this.decayDurationMs));
  }

  calculateDecayDuration(speed) {
    const roleMultiplier = signalPanelConfig.streams.roleDecayMultiplier[this.role] ?? 1;
    return calculateDecayDurationFromWpm({
      text: this.phrase,
      speed,
      config: signalPanelConfig.streams,
      durationMultiplier: roleMultiplier
    });
  }

  getDebugInfo() {
    return {
      id: this.id,
      role: this.role,
      state: this.state,
      phrase: this.phrase,
      progressIndex: this.validator.currentIndex,
      speed: this.speed,
      targetWpm: Math.round(this.speed / signalPanelConfig.streams.speedToWpmDivisor),
      decayDurationMs: Math.round(this.decayDurationMs),
      x: Math.round(this.x),
      y: Math.round(this.y),
      integrity: this.integrity,
      decayRatio: Math.round(this.getDecayRatio() * 100)
    };
  }
}
