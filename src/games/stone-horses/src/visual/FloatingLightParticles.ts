import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  PointsMaterial,
  Vector3,
} from "three";
import { createSeededRng } from "../utils/seededRng";
import { TrackPath } from "../world/TrackPath";

interface FloatingLight {
  index: number;
  baseY: number;
  amplitude: number;
  speed: number;
  phase: number;
}

export class FloatingLightParticles {
  readonly root: Points;
  private readonly positions: Float32Array;
  private readonly lights: FloatingLight[] = [];

  constructor(trackPath: TrackPath, seed: string, count = 140) {
    const rng = createSeededRng(`${seed}:floating-lights`);
    const geometry = new BufferGeometry();
    this.positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const center = getTrackCenter(trackPath);
    const trackRadius = getTrackRadius(trackPath, center);
    const spreadRadius = Math.max(44, trackRadius + 26);
    const palette = [new Color(0x42d9ff), new Color(0x7a68ff), new Color(0xd45dff)];

    for (let i = 0; i < count; i += 1) {
      const angle = rng.nextBetween(0, Math.PI * 2);
      const radius = rng.nextBetween(trackRadius + 16, spreadRadius);
      const y = rng.nextBetween(8, 34);
      const color = palette[rng.nextInt(0, palette.length - 1)].clone().multiplyScalar(rng.nextBetween(0.22, 0.48));

      this.positions[i * 3] = center.x + Math.sin(angle) * radius;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = center.z + Math.cos(angle) * radius;
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      this.lights.push({
        index: i,
        baseY: y,
        amplitude: rng.nextBetween(0.18, 0.7),
        speed: rng.nextBetween(0.08, 0.22),
        phase: rng.nextBetween(0, Math.PI * 2),
      });
    }

    geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
    geometry.setAttribute("color", new BufferAttribute(colors, 3));

    this.root = new Points(
      geometry,
      new PointsMaterial({
        size: 0.16,
        transparent: true,
        opacity: 0.42,
        vertexColors: true,
        depthWrite: false,
      }),
    );
    this.root.frustumCulled = false;
  }

  update(elapsedTime: number): void {
    for (const light of this.lights) {
      this.positions[light.index * 3 + 1] = light.baseY + Math.sin(elapsedTime * light.speed + light.phase) * light.amplitude;
    }

    const positionAttribute = this.root.geometry.getAttribute("position");
    positionAttribute.needsUpdate = true;
  }
}

function getTrackCenter(trackPath: TrackPath): Vector3 {
  const center = new Vector3();

  for (const sample of trackPath.samples) {
    center.add(sample.point);
  }

  return center.multiplyScalar(1 / Math.max(1, trackPath.samples.length));
}

function getTrackRadius(trackPath: TrackPath, center: Vector3): number {
  return trackPath.samples.reduce((radius, sample) => {
    return Math.max(radius, Math.hypot(sample.point.x - center.x, sample.point.z - center.z));
  }, 0);
}
