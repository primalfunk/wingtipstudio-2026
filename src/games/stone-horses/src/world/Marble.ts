import { Color, Mesh, MeshStandardMaterial, SphereGeometry, Texture, Vector3 } from "three";
import type RAPIER from "@dimforge/rapier3d";

interface MarbleOptions {
  id: string;
  color: Color;
  texture?: Texture;
  position: Vector3;
  radius: number;
}

const marbleGeometry = new SphereGeometry(1, 32, 24);

export class Marble {
  readonly id: string;
  readonly body: RAPIER.RigidBody;
  readonly mesh: Mesh;
  readonly position = new Vector3();

  constructor(RAPIERApi: typeof RAPIER, world: RAPIER.World, options: MarbleOptions) {
    this.id = options.id;
    this.body = world.createRigidBody(
      RAPIERApi.RigidBodyDesc.dynamic()
        .setTranslation(options.position.x, options.position.y, options.position.z)
        .setCanSleep(false)
        .setCcdEnabled(true),
    );

    world.createCollider(
      RAPIERApi.ColliderDesc.ball(options.radius)
        .setDensity(1.2)
        .setFriction(0.85)
        .setRestitution(0.18),
      this.body,
    );

    this.mesh = new Mesh(
      marbleGeometry,
      new MeshStandardMaterial({
        color: options.color,
        ...(options.texture ? { map: options.texture } : {}),
        emissive: 0x000000,
        emissiveIntensity: 0,
        roughness: 0.38,
        metalness: 0.08,
      }),
    );
    this.mesh.scale.setScalar(options.radius);
    this.syncMesh();
  }

  launch(velocity: Vector3): void {
    this.body.setLinvel({ x: velocity.x, y: velocity.y, z: velocity.z }, true);
  }

  syncMesh(): void {
    const translation = this.body.translation();
    const rotation = this.body.rotation();

    this.position.set(translation.x, translation.y, translation.z);
    this.mesh.position.copy(this.position);
    this.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
  }
}
