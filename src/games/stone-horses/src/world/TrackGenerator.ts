import { CatmullRomCurve3, Vector3 } from "three";
import { createSeededRng } from "../utils/seededRng";
import { TrackPath, TrackSample } from "./TrackPath";

export interface GeneratedTrack {
  path: TrackPath;
  seed: string;
}

const sampleCount = 220;
const courseLengthMultiplier = 2.9575;
const collectionAreaLength = 10;
const maxHeadingAngle = Math.PI / 2;

export function generateTrack(seed: string): GeneratedTrack {
  const rng = createSeededRng(seed);
  const controlPoints: Vector3[] = [];
  const controlPointCount = 20;
  const horizontalLength = 62 * courseLengthMultiplier;
  const elevationDrop = 11.5 * courseLengthMultiplier;
  const stepLength = horizontalLength / (controlPointCount - 1);
  let x = 0;
  let z = -10;
  let heading = 0;
  let turnTarget = 0;

  for (let i = 0; i < controlPointCount; i += 1) {
    const t = i / (controlPointCount - 1);
    const y = 4.4 - t * elevationDrop;

    if (i > 0) {
      if (i % 3 === 1) {
        turnTarget = rng.nextBetween(-maxHeadingAngle, maxHeadingAngle);
      }

      heading += (turnTarget - heading) * rng.nextBetween(0.28, 0.46);
      heading += rng.nextBetween(-0.18, 0.18);
      heading = clamp(heading, -maxHeadingAngle, maxHeadingAngle);
      x += Math.sin(heading) * stepLength;
      z += Math.cos(heading) * stepLength;
    }

    controlPoints.push(new Vector3(x, y, z));
  }

  const curve = new CatmullRomCurve3(controlPoints, false, "centripetal", 0.35);
  const samples: TrackSample[] = [];
  let progress = 0;
  let previousPoint = curve.getPoint(0);

  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / (sampleCount - 1);
    const point = curve.getPoint(t);

    if (i > 0) {
      progress += point.distanceTo(previousPoint);
    }

    const widthNoise = Math.sin(t * Math.PI * 6 + rng.nextBetween(-0.8, 0.8)) * 0.35;
    const width = 4.6 + widthNoise + rng.nextBetween(-0.28, 0.28);
    const tangent = curve.getTangent(t).normalize();

    samples.push({
      point,
      tangent,
      width: clamp(width, 3.7, 5.5),
      progress,
    });

    previousPoint = point;
  }

  const finishProgress = progress;
  const finishSample = samples[samples.length - 1];
  const collectionTangent = finishSample.tangent.clone().setY(0).normalize();
  const collectionSamples = 18;

  for (let i = 1; i <= collectionSamples; i += 1) {
    const t = i / collectionSamples;
    const point = finishSample.point
      .clone()
      .addScaledVector(collectionTangent, collectionAreaLength * t)
      .add(new Vector3(0, -0.3 * t, 0));

    progress += point.distanceTo(samples[samples.length - 1].point);
    samples.push({
      point,
      tangent: collectionTangent.clone(),
      width: 6.2,
      progress,
    });
  }

  return {
    path: new TrackPath(samples, finishProgress),
    seed,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
