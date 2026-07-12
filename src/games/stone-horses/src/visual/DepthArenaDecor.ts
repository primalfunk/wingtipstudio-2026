import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  Vector3,
} from "three";
import { createSeededRng } from "../utils/seededRng";
import { TrackPath } from "../world/TrackPath";

interface SpectatorBand {
  points: Points;
  material: PointsMaterial;
  baseOpacity: number;
  flickerSpeed: number;
  phase: number;
}

export class DepthArenaDecor {
  readonly root = new Group();
  private readonly spectatorBands: SpectatorBand[] = [];

  constructor(trackPath: TrackPath, seed: string) {
    const rng = createSeededRng(`${seed}:depth-arena-decor`);
    this.addPlatformSilhouettes(trackPath, rng);
    this.addSpectatorLightBands(trackPath, rng);
    this.root.frustumCulled = false;
  }

  update(elapsedTime: number): void {
    for (const band of this.spectatorBands) {
      band.material.opacity = band.baseOpacity * (0.82 + Math.sin(elapsedTime * band.flickerSpeed + band.phase) * 0.18);
    }
  }

  private addPlatformSilhouettes(trackPath: TrackPath, rng: ReturnType<typeof createSeededRng>): void {
    const material = new MeshBasicMaterial({
      color: 0x071017,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      fog: true,
    });

    const count = 18;
    for (let i = 0; i < count; i += 1) {
      const progress = trackPath.finishProgress * rng.nextBetween(0.06, 0.98);
      const sample = trackPath.getSampleAtProgress(progress);
      const lateral = getLateral(sample.tangent);
      const side = rng.next() > 0.5 ? 1 : -1;
      const width = rng.nextBetween(8, 22);
      const length = rng.nextBetween(5, 17);
      const thickness = rng.nextBetween(0.12, 0.34);
      const lateralOffset = side * rng.nextBetween(sample.width * 0.5 + 14, sample.width * 0.5 + 42);
      const forwardOffset = rng.nextBetween(-7, 10);
      const platformMaterial = material.clone();
      const mesh = new Mesh(new BoxGeometry(width, thickness, length), platformMaterial);

      mesh.position.copy(
        sample.point
          .clone()
          .addScaledVector(lateral, lateralOffset)
          .addScaledVector(sample.tangent, forwardOffset),
      );
      mesh.position.y += rng.nextBetween(-7.5, -2.5);
      mesh.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z) + rng.nextBetween(-0.45, 0.45);
      mesh.scale.x *= rng.nextBetween(0.75, 1.35);
      platformMaterial.opacity = rng.nextBetween(0.28, 0.58);
      mesh.frustumCulled = false;
      this.root.add(mesh);
    }
  }

  private addSpectatorLightBands(trackPath: TrackPath, rng: ReturnType<typeof createSeededRng>): void {
    const palette = [new Color(0x38d9ff), new Color(0x8f63ff), new Color(0xff4fd8)];
    const bandCount = 8;

    for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
      const pointCount = rng.nextInt(22, 40);
      const positions = new Float32Array(pointCount * 3);
      const colors = new Float32Array(pointCount * 3);
      const side = bandIndex % 2 === 0 ? 1 : -1;
      const startT = rng.nextBetween(0.08, 0.86);
      const span = rng.nextBetween(0.06, 0.16);
      const lateralBase = rng.nextBetween(22, 46);

      for (let i = 0; i < pointCount; i += 1) {
        const t = Math.min(0.98, startT + (i / Math.max(1, pointCount - 1)) * span);
        const sample = trackPath.getSampleAtProgress(trackPath.finishProgress * t);
        const lateral = getLateral(sample.tangent);
        const position = sample.point
          .clone()
          .addScaledVector(lateral, side * (sample.width * 0.5 + lateralBase + rng.nextBetween(-2.5, 2.5)))
          .addScaledVector(sample.tangent, rng.nextBetween(-1.6, 1.6));

        position.y += rng.nextBetween(1.4, 6.4);
        positions[i * 3] = position.x;
        positions[i * 3 + 1] = position.y;
        positions[i * 3 + 2] = position.z;

        const color = palette[rng.nextInt(0, palette.length - 1)].clone().multiplyScalar(rng.nextBetween(0.28, 0.68));
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }

      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(positions, 3));
      geometry.setAttribute("color", new BufferAttribute(colors, 3));

      const material = new PointsMaterial({
        size: rng.nextBetween(0.12, 0.22),
        transparent: true,
        opacity: rng.nextBetween(0.28, 0.46),
        vertexColors: true,
        depthWrite: false,
        fog: true,
      });
      const points = new Points(geometry, material);
      points.frustumCulled = false;
      this.root.add(points);
      this.spectatorBands.push({
        points,
        material,
        baseOpacity: material.opacity,
        flickerSpeed: rng.nextBetween(0.12, 0.36),
        phase: rng.nextBetween(0, Math.PI * 2),
      });
    }
  }
}

function getLateral(tangent: Vector3): Vector3 {
  return new Vector3().crossVectors(new Vector3(0, 1, 0), tangent).normalize();
}
