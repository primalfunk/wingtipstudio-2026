import {
  AdditiveBlending,
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Vector3,
} from "three";
import { TrackPath, TrackSample } from "../world/TrackPath";
import { VisualSettingsState } from "./VisualSettings";

interface PulsePlate {
  mesh: Mesh;
  material: MeshBasicMaterial;
  baseOpacity: number;
}

const up = new Vector3(0, 1, 0);

export class TrackAmbientPulseSystem {
  readonly root = new Group();
  private readonly plates: PulsePlate[] = [];
  private settings: VisualSettingsState;

  constructor(path: TrackPath, settings: VisualSettingsState) {
    this.settings = settings;
    const sampleStep = Math.max(2, Math.floor(path.samples.length / 88));

    for (let i = 0; i < path.samples.length - 1; i += sampleStep) {
      const sample = path.samples[i];
      const next = path.samples[Math.min(path.samples.length - 1, i + sampleStep)];
      const plate = this.createPlate(sample, next);

      this.plates.push(plate);
      this.root.add(plate.mesh);
    }
  }

  setSettings(settings: VisualSettingsState): void {
    this.settings = settings;
    this.root.visible = settings.trackPulse && settings.trackTheme;
  }

  update(elapsedTime: number): void {
    this.root.visible = this.settings.trackPulse && this.settings.trackTheme;

    if (!this.root.visible) {
      return;
    }

    const swell = (Math.sin(elapsedTime * 0.78) + 1) * 0.5;
    const opacity = 0.006 + swell * 0.028;

    for (const plate of this.plates) {
      plate.material.opacity = plate.baseOpacity + opacity;
    }
  }

  private createPlate(sample: TrackSample, next: TrackSample): PulsePlate {
    const forward = sample.tangent.clone().setY(0).normalize();
    const length = Math.max(1.1, sample.point.distanceTo(next.point) * 1.12);
    const material = new MeshBasicMaterial({
      color: 0x85d8ff,
      transparent: true,
      opacity: 0.06,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new Mesh(new BoxGeometry(sample.width * 0.9, 0.026, length), material);

    mesh.position.copy(sample.point.clone().lerp(next.point, 0.5).addScaledVector(up, 0.115));
    mesh.quaternion.copy(getObjectQuaternion(forward));

    return {
      mesh,
      material,
      baseOpacity: 0.004,
    };
  }
}

function getObjectQuaternion(tangent: Vector3): Object3D["quaternion"] {
  const object = new Object3D();
  object.rotation.set(0, Math.atan2(tangent.x, tangent.z), 0);

  return object.quaternion;
}
