import { PerspectiveCamera } from "three";

export function createCamera(): PerspectiveCamera {
  const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 240);
  camera.position.set(0, 1.5, 5);
  camera.lookAt(0, 0, 0);

  return camera;
}
