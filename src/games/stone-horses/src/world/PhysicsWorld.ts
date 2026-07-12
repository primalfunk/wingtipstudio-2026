import { Quaternion, Vector3 } from "three";
import type RAPIER from "@dimforge/rapier3d";

const fixedStepSeconds = 1 / 60;
const maxSubSteps = 5;

export class PhysicsWorld {
  readonly world: RAPIER.World;
  private accumulator = 0;

  constructor(private readonly RAPIERApi: typeof RAPIER) {
    this.world = new this.RAPIERApi.World({ x: 0, y: -9.81, z: 0 });
    this.world.integrationParameters.dt = fixedStepSeconds;
    this.world.integrationParameters.maxCcdSubsteps = 4;
  }

  step(deltaTime: number): void {
    this.accumulator += deltaTime;
    let steps = 0;

    while (this.accumulator >= fixedStepSeconds && steps < maxSubSteps) {
      this.world.step();
      this.accumulator -= fixedStepSeconds;
      steps += 1;
    }

    if (steps === maxSubSteps) {
      this.accumulator = 0;
    }
  }

  addStaticCuboid(
    halfExtents: Vector3,
    translation: Vector3,
    rotation: Quaternion | { x: number; y: number; z: number; w: number },
    friction: number,
    restitution: number,
  ): void {
    const body = this.world.createRigidBody(
      this.RAPIERApi.RigidBodyDesc.fixed()
        .setTranslation(translation.x, translation.y, translation.z)
        .setRotation(rotation),
    );

    this.world.createCollider(
      this.RAPIERApi.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
        .setFriction(friction)
        .setRestitution(restitution),
      body,
    );
  }

  addStaticCylinder(
    radius: number,
    halfHeight: number,
    translation: Vector3,
    rotation: Quaternion | { x: number; y: number; z: number; w: number },
    friction: number,
    restitution: number,
  ): void {
    const body = this.world.createRigidBody(
      this.RAPIERApi.RigidBodyDesc.fixed()
        .setTranslation(translation.x, translation.y, translation.z)
        .setRotation(rotation),
    );

    this.world.createCollider(
      this.RAPIERApi.ColliderDesc.cylinder(halfHeight, radius)
        .setFriction(friction)
        .setRestitution(restitution),
      body,
    );
  }

  addStaticTrimesh(vertices: Float32Array, indices: Uint32Array, friction: number, restitution: number): void {
    this.world.createCollider(
      this.RAPIERApi.ColliderDesc.trimesh(vertices, indices)
        .setFriction(friction)
        .setRestitution(restitution),
    );
  }

  addKinematicCuboid(
    halfExtents: Vector3,
    translation: Vector3,
    rotation: Quaternion | { x: number; y: number; z: number; w: number },
    friction: number,
    restitution: number,
  ): RAPIER.RigidBody {
    const body = this.world.createRigidBody(
      this.RAPIERApi.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(translation.x, translation.y, translation.z)
        .setRotation(rotation),
    );

    this.world.createCollider(
      this.RAPIERApi.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
        .setFriction(friction)
        .setRestitution(restitution),
      body,
    );

    return body;
  }
}
