import {
  Group,
  Sprite,
  SpriteMaterial,
  Vector3,
} from "three";
import { createSeededRng } from "../utils/seededRng";
import { TrackPath } from "../world/TrackPath";

interface LightStreak {
  sprite: Sprite;
  baseY: number;
  amplitude: number;
  driftSpeed: number;
  flickerSpeed: number;
  phase: number;
  baseOpacity: number;
}

export class VerticalLightStreaks {
  readonly root = new Group();
  private readonly streaks: LightStreak[] = [];

  constructor(trackPath: TrackPath, seed: string, count = 86) {
    const rng = createSeededRng(`${seed}:vertical-light-streaks`);

    for (let i = 0; i < count; i += 1) {
      const progress = trackPath.finishProgress * rng.nextBetween(0.08, 0.96);
      const sample = trackPath.getSampleAtProgress(progress);
      const lateral = new Vector3().crossVectors(new Vector3(0, 1, 0), sample.tangent).normalize();
      const side = rng.next() > 0.5 ? 1 : -1;
      const lateralOffset = side * rng.nextBetween(sample.width * 0.5 + 8, sample.width * 0.5 + 30);
      const forwardOffset = rng.nextBetween(-5, 12);
      const height = rng.nextBetween(8.5, 26);
      const width = rng.nextBetween(0.1, 0.26);
      const baseY = sample.point.y + rng.nextBetween(8, 30);
      const color = rng.next() > 0.44 ? 0x48e1ff : 0xff4fd8;
      const baseOpacity = rng.nextBetween(0.22, 0.46);
      const material = new SpriteMaterial({
        color,
        transparent: true,
        opacity: baseOpacity,
        depthWrite: false,
        fog: false,
      });
      const sprite = new Sprite(material);
      const position = sample.point
        .clone()
        .addScaledVector(lateral, lateralOffset)
        .addScaledVector(sample.tangent, forwardOffset);
      position.y = baseY;

      sprite.position.copy(position);
      sprite.scale.set(width, height, 1);
      this.root.add(sprite);
      this.streaks.push({
        sprite,
        baseY,
        amplitude: rng.nextBetween(0.2, 0.85),
        driftSpeed: rng.nextBetween(0.025, 0.065),
        flickerSpeed: rng.nextBetween(0.18, 0.52),
        phase: rng.nextBetween(0, Math.PI * 2),
        baseOpacity,
      });
    }

    this.root.frustumCulled = false;
  }

  update(elapsedTime: number): void {
    for (const streak of this.streaks) {
      streak.sprite.position.y = streak.baseY + Math.sin(elapsedTime * streak.driftSpeed + streak.phase) * streak.amplitude;
      streak.sprite.material.opacity =
        streak.baseOpacity * (0.78 + Math.sin(elapsedTime * streak.flickerSpeed + streak.phase) * 0.22);
    }
  }
}
