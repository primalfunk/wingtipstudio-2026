import { MeshStandardMaterial } from "three";
import { casinoTrackTheme } from "./TrackVisualTheme";

export function createTrackSurfaceMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: 0x18212a,
    emissive: 0x050b12,
    emissiveIntensity: 0.1,
    roughness: 0.42,
    metalness: 0.22,
  });
}

export function createRailMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: 0x0c171b,
    emissive: 0x031217,
    emissiveIntensity: 0.16,
    roughness: 0.32,
    metalness: 0.42,
  });
}

export function createGoldMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: casinoTrackTheme.gold,
    emissive: 0x2d210b,
    emissiveIntensity: 0.18,
    roughness: 0.24,
    metalness: 0.72,
  });
}
