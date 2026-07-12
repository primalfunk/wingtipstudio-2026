export interface VisualSettingsState {
  trackTheme: boolean;
  trackPulse: boolean;
  reactiveLighting: boolean;
  cameraShake: boolean;
  uiAnimation: boolean;
}

type VisualSettingsListener = (settings: VisualSettingsState) => void;

const storageKey = "stone-horses-visual-settings";
const defaultVisualSettings: VisualSettingsState = {
  trackTheme: true,
  trackPulse: true,
  reactiveLighting: true,
  cameraShake: true,
  uiAnimation: true,
};

export class VisualSettings {
  private settings = readSettings();
  private readonly listeners = new Set<VisualSettingsListener>();

  get value(): VisualSettingsState {
    return { ...this.settings };
  }

  set<K extends keyof VisualSettingsState>(key: K, value: VisualSettingsState[K]): void {
    this.settings = { ...this.settings, [key]: value };
    writeSettings(this.settings);
    this.emit();
  }

  subscribe(listener: VisualSettingsListener): () => void {
    this.listeners.add(listener);
    listener(this.value);

    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const value = this.value;

    for (const listener of this.listeners) {
      listener(value);
    }
  }
}

function readSettings(): VisualSettingsState {
  if (typeof window === "undefined") {
    return { ...defaultVisualSettings };
  }

  try {
    const stored = window.localStorage.getItem(storageKey);

    if (!stored) {
      return { ...defaultVisualSettings };
    }

    const parsed = { ...defaultVisualSettings, ...JSON.parse(stored) } as Partial<VisualSettingsState>;
    return {
      trackTheme: parsed.trackTheme ?? defaultVisualSettings.trackTheme,
      trackPulse: parsed.trackPulse ?? defaultVisualSettings.trackPulse,
      reactiveLighting: parsed.reactiveLighting ?? defaultVisualSettings.reactiveLighting,
      cameraShake: parsed.cameraShake ?? defaultVisualSettings.cameraShake,
      uiAnimation: parsed.uiAnimation ?? defaultVisualSettings.uiAnimation,
    };
  } catch {
    return { ...defaultVisualSettings };
  }
}

function writeSettings(settings: VisualSettingsState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(settings));
}
