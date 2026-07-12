import {
  AdditiveBlending,
  BoxGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from "three";
import { TrackValidationTelemetry } from "../world/RaceTelemetry";
import { TrackPath, TrackSample } from "../world/TrackPath";
import { createSeededRng } from "../utils/seededRng";
import { VisualSettingsState } from "./VisualSettings";

interface AnimatedStrip {
  material: MeshBasicMaterial;
  progress: number;
  baseOpacity: number;
}

const up = new Vector3(0, 1, 0);

export class TrackSurfaceVisuals {
  readonly root = new Group();
  private readonly animatedStrips: AnimatedStrip[] = [];
  private settings: VisualSettingsState;

  constructor(path: TrackPath, validation: TrackValidationTelemetry, seed: string, settings: VisualSettingsState) {
    this.settings = settings;
    this.addPanelSeams(path);
    this.addDirectionalAccents(path, seed);
    this.addCenterChevrons(path);
    this.addVisualZones(path, validation);
    this.addStartMarkings(path);
    this.addFinishLighting(path);
  }

  setSettings(settings: VisualSettingsState): void {
    this.settings = settings;
    this.root.visible = settings.trackTheme;
  }

  update(elapsedTime: number): void {
    this.root.visible = this.settings.trackTheme;

    if (!this.root.visible) {
      return;
    }

    for (const strip of this.animatedStrips) {
      const flow = (Math.sin(elapsedTime * 2.8 - strip.progress * 0.11) + 1) * 0.5;
      strip.material.opacity = strip.baseOpacity + flow * 0.035;
    }
  }

  private addPanelSeams(path: TrackPath): void {
    const step = Math.max(14, Math.floor(path.samples.length / 14));

    for (let i = step; i < path.samples.length - step; i += step) {
      const sample = path.samples[i];
      const width = Math.max(2, sample.width * 0.62);
      const seam = createTrackPlate(sample, width, 0.018, 0x8da5b3, 0.022);
      this.root.add(seam.mesh);
    }
  }

  private addDirectionalAccents(path: TrackPath, seed: string): void {
    const rng = createSeededRng(`${seed}:surface-accents`);
    const step = Math.max(10, Math.floor(path.samples.length / 18));

    for (let i = step; i < path.samples.length - step; i += step) {
      if (rng.next() < 0.34) {
        continue;
      }

      const sample = path.samples[i];
      const lateral = getLateral(sample.tangent);
      const offset = rng.nextBetween(-sample.width * 0.22, sample.width * 0.22);
      const strip = createTrackPlate(sample, rng.nextBetween(0.1, 0.15), rng.nextBetween(0.65, 0.95), rng.next() > 0.5 ? 0x58e4ff : 0xff4fd8, 0.052);
      strip.mesh.position.addScaledVector(lateral, offset);
      this.root.add(strip.mesh);
      this.animatedStrips.push({
        material: strip.material,
        progress: sample.progress,
        baseOpacity: 0.024,
      });
    }
  }

  private addCenterChevrons(path: TrackPath): void {
    const step = Math.max(12, Math.floor(path.samples.length / 18));

    for (let i = step; i < path.samples.length - step; i += step) {
      const sample = path.samples[i];
      for (const side of [-1, 1] as const) {
        const chevron = createAngledTrackPlate(sample, side, 0.11, 0.82, 0x58e4ff, 0.08);
        this.root.add(chevron.mesh);
      }
    }
  }

  private addVisualZones(path: TrackPath, validation: TrackValidationTelemetry): void {
    for (const section of validation.packSections) {
      const sample = path.getSampleAtProgress(section.progress);
      for (const side of [-1, 1] as const) {
        const lateral = getLateral(sample.tangent);
        const zone = createTrackPlate(sample, 0.12, getZoneLength(section.sectionType), getZoneColor(section.sectionType), getZoneOpacity(section.sectionType));
        zone.mesh.position.addScaledVector(lateral, side * sample.width * 0.34);
        this.root.add(zone.mesh);
      }
    }

    const finalStart = path.getSampleAtProgress(path.finishProgress * 0.9);
    for (const side of [-1, 1] as const) {
      const lateral = getLateral(finalStart.tangent);
      const final = createTrackPlate(finalStart, 0.16, 1.8, 0xffd166, 0.09);
      final.mesh.position.addScaledVector(lateral, side * finalStart.width * 0.32);
      this.root.add(final.mesh);
    }
  }

  private addStartMarkings(path: TrackPath): void {
    const start = path.samples[4];
    const lateral = getLateral(start.tangent);

    for (let i = 0; i < 5; i += 1) {
      const stripe = createTrackPlate(start, 0.16, 0.62, i % 2 === 0 ? 0xf2f7ff : 0x58e4ff, 0.11);
      stripe.mesh.position.addScaledVector(lateral, (i - 2) * 0.54);
      this.root.add(stripe.mesh);
    }

    for (const side of [-1, 1] as const) {
      const line = createTrackPlate(start, 0.1, 2.1, 0xff4fd8, 0.12);
      line.mesh.position.addScaledVector(lateral, side * start.width * 0.34);
      this.root.add(line.mesh);
    }
  }

  private addFinishLighting(path: TrackPath): void {
    const finish = path.getSampleAtProgress(path.finishProgress);
    const lateral = getLateral(finish.tangent);

    for (const side of [-1, 1] as const) {
      for (let i = 0; i < 4; i += 1) {
        const sample = path.getSampleAtProgress(path.finishProgress - i * 1.15);
        const light = createTrackPlate(sample, 0.12, 0.56, i % 2 === 0 ? 0xffd166 : 0x58e4ff, 0.14);
        light.mesh.position.addScaledVector(lateral, side * (sample.width * 0.36));
        this.root.add(light.mesh);
        this.animatedStrips.push({
          material: light.material,
          progress: sample.progress + i * 3,
          baseOpacity: 0.075,
        });
      }
    }
  }
}

function createTrackPlate(sample: TrackSample, width: number, length: number, color: number, opacity: number): { mesh: Mesh; material: MeshBasicMaterial } {
  const material = new MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new Mesh(new BoxGeometry(width, 0.022, length), material);

  mesh.position.copy(sample.point).addScaledVector(up, 0.105);
  mesh.quaternion.copy(getTrackPlaneQuaternion(sample.tangent));

  return { mesh, material };
}

function createAngledTrackPlate(sample: TrackSample, side: -1 | 1, width: number, length: number, color: number, opacity: number): { mesh: Mesh; material: MeshBasicMaterial } {
  const material = new MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const tangent = sample.tangent.clone().normalize();
  const lateral = getLateral(tangent);
  const armForward = tangent.clone().multiplyScalar(0.82).addScaledVector(lateral, side * 0.5).normalize();
  const mesh = new Mesh(new BoxGeometry(width, 0.022, length), material);

  mesh.position
    .copy(sample.point)
    .addScaledVector(up, 0.11)
    .addScaledVector(lateral, side * 0.18)
    .addScaledVector(tangent, -0.06);
  mesh.quaternion.copy(getTrackPlaneQuaternionFromForward(armForward));

  return { mesh, material };
}

function getZoneColor(sectionType: string): number {
  if (sectionType.includes("slow")) return 0x8f7bff;
  if (sectionType.includes("speed") || sectionType.includes("boost")) return 0x77ff7a;
  if (sectionType.includes("spinner") || sectionType.includes("panel") || sectionType.includes("arm")) return 0xff9f1c;
  if (sectionType.includes("pegboard") || sectionType.includes("random")) return 0xff4fd8;
  if (sectionType.includes("split") || sectionType.includes("merge")) return 0x58e4ff;
  return 0xffd166;
}

function getZoneOpacity(sectionType: string): number {
  if (sectionType.includes("spinner") || sectionType.includes("panel") || sectionType.includes("arm")) return 0.075;
  if (sectionType.includes("speed") || sectionType.includes("boost")) return 0.065;
  if (sectionType.includes("pegboard") || sectionType.includes("random")) return 0.055;
  return 0.04;
}

function getZoneLength(sectionType: string): number {
  if (sectionType.includes("pegboard")) return 2.8;
  if (sectionType.includes("speed") || sectionType.includes("slow")) return 3.4;
  if (sectionType.includes("split") || sectionType.includes("merge")) return 2.6;
  return 2;
}

function getLateral(tangent: Vector3): Vector3 {
  return new Vector3().crossVectors(up, tangent).normalize();
}

function getTrackPlaneQuaternion(tangent: Vector3): Quaternion {
  const forward = tangent.clone().normalize();
  return getTrackPlaneQuaternionFromForward(forward);
}

function getTrackPlaneQuaternionFromForward(forward: Vector3): Quaternion {
  const lateral = getLateral(forward);
  const normal = new Vector3().crossVectors(forward, lateral).normalize();
  const matrix = new Matrix4().makeBasis(lateral, normal, forward);

  return new Quaternion().setFromRotationMatrix(matrix);
}
