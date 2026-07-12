import { Color, MeshStandardMaterial } from "three";
import { VisualSettingsState } from "./VisualSettings";

const wallColor = new Color();
const wallEmissive = new Color();

export class TrackWallColorCycle {
  private settings: VisualSettingsState;

  constructor(
    private readonly materials: MeshStandardMaterial[],
    settings: VisualSettingsState,
  ) {
    this.settings = settings;
  }

  setSettings(settings: VisualSettingsState): void {
    this.settings = settings;
  }

  update(elapsedTime: number): void {
    if (!this.settings.trackTheme) {
      return;
    }

    const hue = 0.48 + Math.sin(elapsedTime * 0.18) * 0.035;
    wallColor.setHSL(hue, 0.42, 0.075);
    wallEmissive.setHSL(hue, 0.55, 0.03);

    for (const material of this.materials) {
      material.color.copy(wallColor);
      material.emissive.copy(wallEmissive);
      material.emissiveIntensity = 0.16;
    }
  }
}
