import { MathUtils } from "three";
import { TrackPath } from "./TrackPath";

export type TrackObstacleShape = "box" | "cylinder" | "wedge";
export type TrackObstacleMaterial = "split" | "funnel" | "peg" | "chicane" | "spinner" | "lane" | "drop" | "panel" | "arm";

export interface TrackObstacle {
  id: string;
  shape: TrackObstacleShape;
  material: TrackObstacleMaterial;
  progress: number;
  lateralOffset: number;
  halfLength: number;
  halfWidth: number;
  height: number;
  yawOffset: number;
  friction: number;
  restitution: number;
  movingGapSize?: number;
}

export interface SafetyValidationResult {
  obstacles: TrackObstacle[];
  removedObstacleIds: string[];
  repairedObstacleIds: string[];
}

const marbleRadius = 0.34;
const marbleDiameter = marbleRadius * 2;
const minimumClearance = marbleDiameter * 2.5;
const probeStep = 0.72;
const probeOffsets = [-1.8, -1.2, -0.6, 0, 0.6, 1.2, 1.8];

export class TrackSafetyValidator {
  constructor(private readonly path: TrackPath) {}

  validateAndRepair(obstacles: TrackObstacle[]): SafetyValidationResult {
    const repairedObstacleIds = new Set<string>();
    const removedObstacleIds = new Set<string>();
    let safeObstacles = obstacles
      .map((obstacle) => this.repairMovingObstacle(obstacle, repairedObstacleIds, removedObstacleIds))
      .filter((obstacle): obstacle is TrackObstacle => obstacle !== null)
      .map((obstacle) => this.repairWallClearance(obstacle, repairedObstacleIds))
      .filter((obstacle): obstacle is TrackObstacle => obstacle !== null);

    safeObstacles = this.repairObstacleClearance(safeObstacles, repairedObstacleIds, removedObstacleIds);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const stalledObstacleId = this.findSimulationProbeFailure(safeObstacles);

      if (!stalledObstacleId) {
        break;
      }

      removedObstacleIds.add(stalledObstacleId);
      safeObstacles = safeObstacles.filter((obstacle) => obstacle.id !== stalledObstacleId);
    }

    return {
      obstacles: safeObstacles,
      removedObstacleIds: [...removedObstacleIds],
      repairedObstacleIds: [...repairedObstacleIds],
    };
  }

  private repairWallClearance(obstacle: TrackObstacle, repairedObstacleIds: Set<string>): TrackObstacle | null {
    if (obstacle.lateralOffset === 0 && obstacle.material === "split") {
      return obstacle;
    }

    const sample = this.path.getSampleAtProgress(obstacle.progress);
    const maxOffset = sample.width / 2 - minimumClearance - obstacle.halfWidth;

    if (maxOffset < 0) {
      return null;
    }

    const clampedOffset = MathUtils.clamp(obstacle.lateralOffset, -maxOffset, maxOffset);

    if (Math.abs(clampedOffset - obstacle.lateralOffset) > 0.001) {
      repairedObstacleIds.add(obstacle.id);

      return {
        ...obstacle,
        lateralOffset: clampedOffset,
        yawOffset: obstacle.yawOffset * 0.72,
      };
    }

    return obstacle;
  }

  private repairMovingObstacle(
    obstacle: TrackObstacle,
    repairedObstacleIds: Set<string>,
    removedObstacleIds: Set<string>,
  ): TrackObstacle | null {
    if (obstacle.material !== "spinner") {
      return obstacle;
    }

    const sample = this.path.getSampleAtProgress(obstacle.progress);
    const minimumMovingGap = marbleDiameter * 3;
    const declaredGap = obstacle.movingGapSize ?? 0;

    if (declaredGap < minimumMovingGap) {
      removedObstacleIds.add(obstacle.id);

      return null;
    }

    const maxHalfLength = Math.max(marbleRadius, sample.width / 2 - minimumClearance);

    if (obstacle.halfLength > maxHalfLength) {
      repairedObstacleIds.add(obstacle.id);

      return {
        ...obstacle,
        halfLength: maxHalfLength,
      };
    }

    return obstacle;
  }

  private repairObstacleClearance(
    obstacles: TrackObstacle[],
    repairedObstacleIds: Set<string>,
    removedObstacleIds: Set<string>,
  ): TrackObstacle[] {
    const repaired = obstacles.map((obstacle) => ({ ...obstacle }));

    for (let i = 0; i < repaired.length; i += 1) {
      for (let j = i + 1; j < repaired.length; j += 1) {
        const a = repaired[i];
        const b = repaired[j];

        if (isContinuousDivider(a) && isContinuousDivider(b)) {
          continue;
        }

        if (!progressRangesOverlap(a, b)) {
          continue;
        }

        const lateralGap = Math.abs(a.lateralOffset - b.lateralOffset) - a.halfWidth - b.halfWidth;

        if (lateralGap >= minimumClearance) {
          continue;
        }

        if (a.material === "peg" || b.material === "peg") {
          const removed = a.material === "peg" ? a : b;
          removedObstacleIds.add(removed.id);
          continue;
        }

        const push = (minimumClearance - lateralGap) / 2;
        const aDirection = a.lateralOffset <= b.lateralOffset ? -1 : 1;
        repaired[i] = this.repairWallClearance(
          { ...a, lateralOffset: a.lateralOffset + push * aDirection },
          repairedObstacleIds,
        ) ?? a;
        repaired[j] = this.repairWallClearance(
          { ...b, lateralOffset: b.lateralOffset - push * aDirection },
          repairedObstacleIds,
        ) ?? b;
        repairedObstacleIds.add(a.id);
        repairedObstacleIds.add(b.id);
      }
    }

    return repaired.filter((obstacle) => !removedObstacleIds.has(obstacle.id));
  }

  private findSimulationProbeFailure(obstacles: TrackObstacle[]): string | null {
    const maxProgress = this.path.finishProgress * 0.96;

    for (let progress = this.path.finishProgress * 0.06; progress < maxProgress; progress += probeStep) {
      const sample = this.path.getSampleAtProgress(progress);
      const legalOffsets = probeOffsets.filter((offset) => Math.abs(offset) < sample.width / 2 - marbleRadius);
      const hasEscape = legalOffsets.some((offset) => this.probeCanAdvance(progress, offset, obstacles));

      if (hasEscape) {
        continue;
      }

      return (
        obstacles
          .filter((obstacle) => Math.abs(obstacle.progress - progress) <= obstacle.halfLength + probeStep)
          .sort((a, b) => Math.abs(a.progress - progress) - Math.abs(b.progress - progress))[0]?.id ?? null
      );
    }

    return null;
  }

  private probeCanAdvance(startProgress: number, startOffset: number, obstacles: TrackObstacle[]): boolean {
    let offset = startOffset;

    for (let step = 0; step < 12; step += 1) {
      const progress = startProgress + step * probeStep;
      const sample = this.path.getSampleAtProgress(progress);
      const laneLimit = sample.width / 2 - marbleRadius;
      offset = MathUtils.clamp(offset, -laneLimit, laneLimit);

      const blocker = obstacles.find((obstacle) => containsProbe(obstacle, progress, offset));

      if (!blocker) {
        continue;
      }

      const leftEscape = blocker.lateralOffset - blocker.halfWidth - minimumClearance / 2;
      const rightEscape = blocker.lateralOffset + blocker.halfWidth + minimumClearance / 2;
      const leftValid = leftEscape > -laneLimit;
      const rightValid = rightEscape < laneLimit;

      if (!leftValid && !rightValid) {
        return false;
      }

      offset = leftValid && rightValid ? (Math.abs(leftEscape) < Math.abs(rightEscape) ? leftEscape : rightEscape) : leftValid ? leftEscape : rightEscape;
    }

    return true;
  }
}

function isContinuousDivider(obstacle: TrackObstacle): boolean {
  return obstacle.material === "split" || obstacle.material === "lane";
}

function progressRangesOverlap(a: TrackObstacle, b: TrackObstacle): boolean {
  return Math.abs(a.progress - b.progress) < a.halfLength + b.halfLength + minimumClearance * 0.35;
}

function containsProbe(obstacle: TrackObstacle, progress: number, lateralOffset: number): boolean {
  return (
    Math.abs(progress - obstacle.progress) <= obstacle.halfLength + marbleRadius &&
    Math.abs(lateralOffset - obstacle.lateralOffset) <= obstacle.halfWidth + marbleRadius
  );
}
