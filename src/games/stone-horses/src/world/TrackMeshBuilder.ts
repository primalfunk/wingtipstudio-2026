import {
  BufferAttribute,
  BufferGeometry,
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from "three";
import { PhysicsWorld } from "./PhysicsWorld";
import { TrackPath, TrackSample } from "./TrackPath";
import { createRailMaterial, createTrackSurfaceMaterial } from "../visual/TrackMaterials";
import { createRailVisuals } from "../visual/RailVisuals";

interface MeshData {
  vertices: Float32Array;
  indices: Uint32Array;
}

const up = new Vector3(0, 1, 0);
const railHeight = 0.82;
const railWidth = 0.32;
const collectionWallHeight = 1.9;
const collectionWallThickness = 0.42;

export function buildTrackMesh(path: TrackPath, physics: PhysicsWorld): Group {
  const group = new Group();
  const surface = buildSurface(path.samples);
  const leftRail = buildRail(path.samples, -1);
  const rightRail = buildRail(path.samples, 1);
  const visualSamples = createSmoothedVisualSamples(path);
  const visualSurface = buildSurface(createExpandedVisualSurfaceSamples(visualSamples));
  const visualLeftRail = buildRail(visualSamples, -1);
  const visualRightRail = buildRail(visualSamples, 1);
  const railMaterial = createRailMaterial();
  const leftRailMesh = createMesh(visualLeftRail, railMaterial);
  const rightRailMesh = createMesh(visualRightRail, railMaterial);

  group.add(
    createMesh(
      visualSurface,
      createTrackSurfaceMaterial(),
    ),
  );
  leftRailMesh.name = "track-wall-left";
  rightRailMesh.name = "track-wall-right";
  group.userData.trackWallMaterials = [railMaterial];
  group.add(leftRailMesh);
  group.add(rightRailMesh);

  physics.addStaticTrimesh(surface.vertices, surface.indices, 1.08, 0.03);
  physics.addStaticTrimesh(leftRail.vertices, leftRail.indices, 0.72, 0.08);
  physics.addStaticTrimesh(rightRail.vertices, rightRail.indices, 0.72, 0.08);

  addZoneMarker(group, path.samples[0], 0x85d8ff);
  addZoneMarker(group, path.getSampleAtProgress(path.finishProgress), 0xffd166);
  addFinishLine(group, path.getSampleAtProgress(path.finishProgress));
  addCollectionHighWalls(group, physics, path);
  addCollectionEndStop(group, physics, path.samples[path.samples.length - 1]);

  if (typeof window !== "undefined") {
    const railVisuals = createRailVisuals(path, visualSamples);
    group.userData.railVisuals = railVisuals;
    group.add(railVisuals.root);
  }

  return group;
}

function buildSurface(samples: TrackSample[]): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];

  for (const sample of samples) {
    const lateral = getLateral(sample.tangent);
    const halfWidth = sample.width / 2;
    const left = sample.point.clone().addScaledVector(lateral, -halfWidth);
    const right = sample.point.clone().addScaledVector(lateral, halfWidth);

    vertices.push(left.x, left.y, left.z, right.x, right.y, right.z);
  }

  for (let i = 0; i < samples.length - 1; i += 1) {
    const left = i * 2;
    const right = left + 1;
    const nextLeft = left + 2;
    const nextRight = left + 3;

    indices.push(left, nextLeft, right, right, nextLeft, nextRight);
  }

  return toMeshData(vertices, indices);
}

function buildRail(samples: TrackSample[], side: -1 | 1): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];

  for (const sample of samples) {
    const lateral = getLateral(sample.tangent);
    const innerBottom = sample.point
      .clone()
      .addScaledVector(lateral, side * sample.width * 0.5)
      .addScaledVector(up, 0.03);
    const outerBottom = innerBottom.clone().addScaledVector(lateral, side * railWidth);
    const innerTop = innerBottom.clone().addScaledVector(up, railHeight);
    const outerTop = outerBottom.clone().addScaledVector(up, railHeight);

    vertices.push(
      innerBottom.x,
      innerBottom.y,
      innerBottom.z,
      outerBottom.x,
      outerBottom.y,
      outerBottom.z,
      innerTop.x,
      innerTop.y,
      innerTop.z,
      outerTop.x,
      outerTop.y,
      outerTop.z,
    );
  }

  for (let i = 0; i < samples.length - 1; i += 1) {
    const a = i * 4;
    const b = a + 4;

    addQuad(indices, a, b, a + 2, b + 2);
    addQuad(indices, a + 1, a + 3, b + 1, b + 3);
    addQuad(indices, a + 2, b + 2, a + 3, b + 3);
    addQuad(indices, a, a + 1, b, b + 1);
  }

  return toMeshData(vertices, indices);
}

function createSmoothedVisualSamples(path: TrackPath): TrackSample[] {
  const count = Math.max(path.samples.length * 3, Math.ceil(path.length / 0.26));
  const rawSamples: TrackSample[] = [];
  const smoothingRadius = 12;

  for (let i = 0; i < count; i += 1) {
    rawSamples.push(path.getSampleAtProgress((i / (count - 1)) * path.length));
  }

  return rawSamples.map((sample, index) => {
    const pointTotal = new Vector3();
    let widthTotal = 0;
    let tangentTotal = new Vector3();
    let weightTotal = 0;

    for (let offset = -smoothingRadius; offset <= smoothingRadius; offset += 1) {
      const neighbor = rawSamples[Math.min(rawSamples.length - 1, Math.max(0, index + offset))];
      const weight = 1 - Math.abs(offset) / (smoothingRadius + 1);
      pointTotal.addScaledVector(neighbor.point, weight);
      widthTotal += neighbor.width * weight;
      tangentTotal.addScaledVector(neighbor.tangent, weight);
      weightTotal += weight;
    }

    return {
      point: pointTotal.multiplyScalar(1 / weightTotal),
      tangent: tangentTotal.multiplyScalar(1 / weightTotal).normalize(),
      width: widthTotal / weightTotal,
      progress: sample.progress,
    };
  });
}

function createExpandedVisualSurfaceSamples(samples: TrackSample[]): TrackSample[] {
  return samples.map((sample) => ({
    ...sample,
    point: sample.point.clone(),
    tangent: sample.tangent.clone(),
    width: sample.width + railWidth * 1.15,
  }));
}

function createMesh(data: MeshData, material: MeshStandardMaterial): Mesh {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(data.vertices, 3));
  geometry.setIndex(new BufferAttribute(data.indices, 1));
  geometry.computeVertexNormals();

  return new Mesh(geometry, material);
}

function addZoneMarker(group: Group, sample: TrackSample, color: Color | number): void {
  const lateral = getLateral(sample.tangent);
  const markerVertices: number[] = [];
  const markerIndices: number[] = [];
  const halfWidth = sample.width / 2;
  const forward = sample.tangent.clone().setY(0).normalize();
  const center = sample.point.clone().addScaledVector(up, 0.035);
  const a = center.clone().addScaledVector(lateral, -halfWidth).addScaledVector(forward, -0.18);
  const b = center.clone().addScaledVector(lateral, halfWidth).addScaledVector(forward, -0.18);
  const c = center.clone().addScaledVector(lateral, -halfWidth).addScaledVector(forward, 0.18);
  const d = center.clone().addScaledVector(lateral, halfWidth).addScaledVector(forward, 0.18);

  markerVertices.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z);
  markerIndices.push(0, 2, 1, 1, 2, 3);

  group.add(
    createMesh(
      toMeshData(markerVertices, markerIndices),
      new MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.25,
        roughness: 0.45,
      }),
    ),
  );
}

function addFinishLine(group: Group, sample: TrackSample): void {
  const lateral = getLateral(sample.tangent);
  const forward = sample.tangent.clone().setY(0).normalize();
  const stripeCount = 8;
  const stripeLength = sample.width / stripeCount;

  for (let i = 0; i < stripeCount; i += 1) {
    const color = i % 2 === 0 ? 0xf7f7f2 : 0x15191f;
    const center = sample.point
      .clone()
      .addScaledVector(up, 0.075)
      .addScaledVector(lateral, -sample.width / 2 + stripeLength * (i + 0.5));
    const mesh = new Mesh(
      new BoxGeometry(stripeLength, 0.035, 0.55),
      new MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: i % 2 === 0 ? 0.16 : 0,
        roughness: 0.5,
      }),
    );

    mesh.position.copy(center);
    mesh.quaternion.copy(getObjectQuaternion(forward));
    group.add(mesh);
  }
}

function addCollectionEndStop(group: Group, physics: PhysicsWorld, sample: TrackSample): void {
  const forward = sample.tangent.clone().setY(0).normalize();
  const position = sample.point.clone().addScaledVector(forward, 0.35).addScaledVector(up, collectionWallHeight * 0.5);
  const size = new Vector3(sample.width + railWidth * 3.2, collectionWallHeight, 0.48);
  const quaternion = getObjectQuaternion(forward);
  const mesh = new Mesh(
    new BoxGeometry(size.x, size.y, size.z),
    new MeshStandardMaterial({
      color: 0x172631,
      emissive: 0x332409,
      emissiveIntensity: 0.12,
      roughness: 0.34,
      metalness: 0.28,
    }),
  );

  mesh.position.copy(position);
  mesh.quaternion.copy(quaternion);
  group.add(mesh);
  physics.addStaticCuboid(size.clone().multiplyScalar(0.5), position, quaternion, 0.8, 0.12);
}

function addCollectionHighWalls(group: Group, physics: PhysicsWorld, path: TrackPath): void {
  const collectionSamples = path.samples.filter((sample) => sample.progress >= path.finishProgress);
  const material = new MeshStandardMaterial({
    color: 0x15242d,
    emissive: 0x061926,
    emissiveIntensity: 0.14,
    roughness: 0.3,
    metalness: 0.36,
  });
  const visualDataLeft = buildRaisedCollectionWall(collectionSamples, -1);
  const visualDataRight = buildRaisedCollectionWall(collectionSamples, 1);

  group.add(createMesh(visualDataLeft, material));
  group.add(createMesh(visualDataRight, material));

  for (let i = 0; i < collectionSamples.length - 1; i += 2) {
    const start = collectionSamples[i];
    const end = collectionSamples[Math.min(collectionSamples.length - 1, i + 2)];
    const segmentCenter = start.point.clone().lerp(end.point, 0.5);
    const forward = end.point.clone().sub(start.point).setY(0).normalize();
    const tangent = forward.lengthSq() > 0 ? forward : start.tangent.clone().setY(0).normalize();
    const lateral = getLateral(tangent);
    const length = Math.max(0.8, start.point.distanceTo(end.point) + 0.2);
    const quaternion = getObjectQuaternion(tangent);

    for (const side of [-1, 1] as const) {
      const position = segmentCenter
        .clone()
        .addScaledVector(lateral, side * (start.width * 0.5 + collectionWallThickness * 0.5))
        .addScaledVector(up, collectionWallHeight * 0.5);
      const size = new Vector3(collectionWallThickness, collectionWallHeight, length);
      physics.addStaticCuboid(size.clone().multiplyScalar(0.5), position, quaternion, 0.8, 0.1);
    }
  }
}

function buildRaisedCollectionWall(samples: TrackSample[], side: -1 | 1): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];

  for (const sample of samples) {
    const lateral = getLateral(sample.tangent);
    const innerBottom = sample.point
      .clone()
      .addScaledVector(lateral, side * (sample.width * 0.5 + 0.02))
      .addScaledVector(up, 0.02);
    const outerBottom = innerBottom.clone().addScaledVector(lateral, side * collectionWallThickness);
    const innerTop = innerBottom.clone().addScaledVector(up, collectionWallHeight);
    const outerTop = outerBottom.clone().addScaledVector(up, collectionWallHeight);

    vertices.push(
      innerBottom.x,
      innerBottom.y,
      innerBottom.z,
      outerBottom.x,
      outerBottom.y,
      outerBottom.z,
      innerTop.x,
      innerTop.y,
      innerTop.z,
      outerTop.x,
      outerTop.y,
      outerTop.z,
    );
  }

  for (let i = 0; i < samples.length - 1; i += 1) {
    const a = i * 4;
    const b = a + 4;

    addQuad(indices, a, b, a + 2, b + 2);
    addQuad(indices, a + 1, a + 3, b + 1, b + 3);
    addQuad(indices, a + 2, b + 2, a + 3, b + 3);
    addQuad(indices, a, a + 1, b, b + 1);
  }

  return toMeshData(vertices, indices);
}

function addQuad(indices: number[], a: number, b: number, c: number, d: number): void {
  indices.push(a, b, c, c, b, d);
}

function getLateral(tangent: Vector3): Vector3 {
  return new Vector3().crossVectors(up, tangent).normalize();
}

function getObjectQuaternion(tangent: Vector3): Object3D["quaternion"] {
  const object = new Object3D();
  const flatTangent = tangent.clone().setY(0).normalize();

  object.rotation.set(0, Math.atan2(flatTangent.x, flatTangent.z), 0);

  return object.quaternion;
}

function toMeshData(vertices: number[], indices: number[]): MeshData {
  return {
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
  };
}
