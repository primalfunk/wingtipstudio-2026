import { MathUtils } from "three";
import { TrackObstacle, TrackObstacleMaterial } from "../TrackSafetyValidator";

export const marbleRadius = 0.34;
export const marbleDiameter = marbleRadius * 2;
export const minimumMachineClearance = marbleDiameter * 2.5;
export const wallHeight = 0.72;
export const wallThickness = 0.24;

export function createBoxObstacle(
  id: string,
  material: TrackObstacleMaterial,
  progress: number,
  lateralOffset: number,
  halfLength: number,
  halfWidth: number,
  yawOffset: number,
  friction: number,
  restitution: number,
): TrackObstacle {
  return {
    id,
    shape: "box",
    material,
    progress,
    lateralOffset,
    halfLength,
    halfWidth,
    height: wallHeight,
    yawOffset,
    friction,
    restitution,
  };
}

export function createWedgeObstacle(
  id: string,
  material: TrackObstacleMaterial,
  progress: number,
  lateralOffset: number,
  halfLength: number,
  halfWidth: number,
  yawOffset: number,
  friction: number,
  restitution: number,
): TrackObstacle {
  return {
    id,
    shape: "wedge",
    material,
    progress,
    lateralOffset,
    halfLength,
    halfWidth,
    height: wallHeight,
    yawOffset,
    friction,
    restitution,
  };
}

export function createPegObstacle(
  id: string,
  progress: number,
  lateralOffset: number,
  radius: number,
  friction = 0.38,
  restitution = 0.86,
): TrackObstacle {
  return {
    id,
    shape: "cylinder",
    material: "peg",
    progress,
    lateralOffset,
    halfLength: radius,
    halfWidth: radius,
    height: 0.72,
    yawOffset: 0,
    friction,
    restitution,
  };
}

export function getRotatedHalfLength(halfWidth: number, halfLength: number, yawOffset: number): number {
  return Math.abs(Math.cos(yawOffset)) * halfLength + Math.abs(Math.sin(yawOffset)) * halfWidth;
}

export function getRotatedHalfWidth(halfWidth: number, halfLength: number, yawOffset: number): number {
  return Math.abs(Math.cos(yawOffset)) * halfWidth + Math.abs(Math.sin(yawOffset)) * halfLength;
}

export function clampToLane(lateralOffset: number, halfWidth: number, trackWidth: number): number {
  const limit = Math.max(0, trackWidth / 2 - minimumMachineClearance - halfWidth);

  return MathUtils.clamp(lateralOffset, -limit, limit);
}
