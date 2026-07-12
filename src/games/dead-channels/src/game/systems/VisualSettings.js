import { visualConfig } from '../config/visuals.js';

const state = { ...visualConfig.accessibilityDefaults };
const listeners = new Set();

export const VisualSettings = {
  get reduceMotion() {
    return state.reduceMotion;
  },

  get reduceGlow() {
    return state.reduceGlow;
  },

  get highContrast() {
    return state.highContrast;
  },

  get textScale() {
    return state.textScale ?? 1;
  },

  get screenShake() {
    return state.screenShake ?? true;
  },

  toggle(key) {
    if (!(key in state)) {
      return false;
    }

    state[key] = !state[key];
    this.notify();
    return true;
  },

  set(settings = {}) {
    for (const key of Object.keys(state)) {
      if (typeof state[key] === 'boolean' && typeof settings[key] === 'boolean') {
        state[key] = settings[key];
      } else if (typeof state[key] === 'number' && Number.isFinite(settings[key])) {
        state[key] = settings[key];
      } else if (typeof state[key] === 'string' && typeof settings[key] === 'string') {
        state[key] = settings[key];
      }
    }
    this.notify();
  },

  getState() {
    return { ...state };
  },

  onChange(handler) {
    listeners.add(handler);
    return () => listeners.delete(handler);
  },

  notify() {
    const snapshot = this.getState();
    listeners.forEach((handler) => handler(snapshot));
  },

  getTextLines() {
    return [
      `M Reduce Motion: ${state.reduceMotion ? 'ON' : 'OFF'}`,
      `G Reduce Glow: ${state.reduceGlow ? 'ON' : 'OFF'}`,
      `H High Contrast: ${state.highContrast ? 'ON' : 'OFF'}`,
      `X Text Scale: ${Math.round((state.textScale ?? 1) * 100)}%`,
      `S Screen Shake: ${state.screenShake ? 'ON' : 'OFF'}`
    ];
  }
};
