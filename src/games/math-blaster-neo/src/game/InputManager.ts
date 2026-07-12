import { LAUNCHER_HEIGHT, LAUNCHER_WIDTH, WORLD_HEIGHT, WORLD_WIDTH, type Launcher } from "./types";

export class InputManager {
  private removeFns: Array<() => void> = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private callbacks: {
      move: (delta: number) => void;
      fire: () => void;
      pause: () => void;
      selectLauncher: (index: number) => void;
    }
  ) {}

  attach(getLaunchers: () => Launcher[]): void {
    const key = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        this.callbacks.move(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        this.callbacks.move(1);
      } else if (event.key === " ") {
        event.preventDefault();
        this.callbacks.fire();
      } else if (event.key === "Escape") {
        event.preventDefault();
        this.callbacks.pause();
      } else if (/^[1-5]$/.test(event.key)) {
        this.callbacks.selectLauncher(Number(event.key) - 1);
      }
    };
    const pointer = (event: PointerEvent) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * WORLD_WIDTH;
      const y = ((event.clientY - rect.top) / rect.height) * WORLD_HEIGHT;
      const index = getLaunchers().findIndex((launcher) => (
        x >= launcher.x - LAUNCHER_WIDTH / 2 &&
        x <= launcher.x + LAUNCHER_WIDTH / 2 &&
        y >= launcher.y - LAUNCHER_HEIGHT / 2 &&
        y <= launcher.y + LAUNCHER_HEIGHT / 2
      ));
      if (index >= 0) this.callbacks.selectLauncher(index);
      if (event.type === "pointerdown") this.callbacks.fire();
    };
    window.addEventListener("keydown", key);
    this.canvas.addEventListener("pointermove", pointer);
    this.canvas.addEventListener("pointerdown", pointer);
    this.removeFns = [
      () => window.removeEventListener("keydown", key),
      () => this.canvas.removeEventListener("pointermove", pointer),
      () => this.canvas.removeEventListener("pointerdown", pointer)
    ];
  }

  destroy(): void {
    this.removeFns.forEach((remove) => remove());
    this.removeFns = [];
  }
}
