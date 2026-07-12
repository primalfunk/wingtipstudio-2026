import { Vector3 } from "three";

export interface TrackSample {
  point: Vector3;
  tangent: Vector3;
  width: number;
  progress: number;
}

export class TrackPath {
  readonly length: number;

  constructor(
    readonly samples: TrackSample[],
    readonly finishProgress = samples[samples.length - 1]?.progress ?? 0,
  ) {
    this.length = samples[samples.length - 1]?.progress ?? 0;
  }

  getProgress(position: Vector3): number {
    return this.getClosestSample(position).progress;
  }

  getT(position: Vector3): number {
    return this.progressToT(this.getProgress(position));
  }

  progressToT(progress: number): number {
    if (this.length <= 0) {
      return 0;
    }

    return Math.min(1, Math.max(0, progress / this.length));
  }

  tToProgress(t: number): number {
    return Math.min(1, Math.max(0, t)) * this.length;
  }

  getSampleAtT(t: number): TrackSample {
    return this.getSampleAtProgress(this.tToProgress(t));
  }

  getSampleAtProgress(progress: number): TrackSample {
    const clampedProgress = Math.min(Math.max(progress, 0), this.length);

    for (let i = 1; i < this.samples.length; i += 1) {
      const previous = this.samples[i - 1];
      const next = this.samples[i];

      if (next.progress >= clampedProgress) {
        const span = next.progress - previous.progress;
        const t = span === 0 ? 0 : (clampedProgress - previous.progress) / span;

        return {
          point: previous.point.clone().lerp(next.point, t),
          tangent: previous.tangent.clone().lerp(next.tangent, t).normalize(),
          width: previous.width + (next.width - previous.width) * t,
          progress: clampedProgress,
        };
      }
    }

    return this.samples[this.samples.length - 1];
  }

  getTangent(position: Vector3): Vector3 {
    return this.getClosestSample(position).tangent.clone();
  }

  getStartPoint(): Vector3 {
    return this.samples[0].point.clone();
  }

  getFinishPoint(): Vector3 {
    return this.getSampleAtProgress(this.finishProgress).point.clone();
  }

  private getClosestSample(position: Vector3): TrackSample {
    let closest = this.samples[0];
    let closestDistanceSq = Number.POSITIVE_INFINITY;

    for (const sample of this.samples) {
      const distanceSq = sample.point.distanceToSquared(position);

      if (distanceSq < closestDistanceSq) {
        closest = sample;
        closestDistanceSq = distanceSq;
      }
    }

    return closest;
  }
}
