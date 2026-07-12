import { Clock, WebGLRenderer } from "three";
import { createCamera } from "../render/createCamera";
import { createRaceScene, RaceScene } from "../world/createRaceScene";

export class App {
  private readonly clock = new Clock();
  private static readonly maxFrameDelta = 1 / 15;
  private readonly renderer: WebGLRenderer;
  private animationFrameId = 0;

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly scene: RaceScene,
    private readonly camera = createCamera(),
  ) {
    this.renderer = new WebGLRenderer({
      antialias: true,
      canvas: this.canvas,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.resize();

    window.addEventListener("resize", this.resize);
  }

  static async create(canvas: HTMLCanvasElement): Promise<App> {
    return new App(canvas, await createRaceScene());
  }

  start(): void {
    this.clock.start();
    this.tick();
  }

  stop(): void {
    cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener("resize", this.resize);
    this.renderer.dispose();
  }

  private readonly resize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private readonly tick = (): void => {
    const deltaTime = Math.min(this.clock.getDelta(), App.maxFrameDelta);

    this.scene.update(deltaTime, this.camera);
    this.renderer.render(this.scene.root, this.camera);

    this.animationFrameId = requestAnimationFrame(this.tick);
  };
}
