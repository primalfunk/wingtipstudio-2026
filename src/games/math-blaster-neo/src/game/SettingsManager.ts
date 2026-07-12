import type { Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  colorblindSafe: false,
  dyslexiaFont: false,
  audioEnabled: true,
  reducedMotion: false,
  highContrast: false
};

export function mergeSettings(...settings: Array<Partial<Settings> | undefined>): Settings {
  return Object.assign({}, DEFAULT_SETTINGS, ...settings);
}
