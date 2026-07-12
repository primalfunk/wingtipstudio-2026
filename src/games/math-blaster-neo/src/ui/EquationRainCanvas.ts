import {
  CATEGORY_COLORS,
  EQUATION_CATEGORIES,
  EQUATION_RAIN_POOL,
  type EquationCategory
} from "./equationRainPool";

type DepthLayer = "far" | "mid" | "near";
type RainIntensity = "low" | "medium" | "high";

type EquationRainEntry = {
  text: string;
  offsetY: number;
  opacity: number;
  isHead: boolean;
  category: EquationCategory;
};

type EquationRainColumn = {
  id: string;
  phase: number;
  x: number;
  y: number;
  speedPxPerSecond: number;
  horizontalDriftPx: number;
  wobbleAmplitudePx: number;
  wobbleFrequency: number;
  fontSizePx: number;
  opacity: number;
  glowColor: string;
  depthLayer: DepthLayer;
  equations: EquationRainEntry[];
};

type IntensityPreset = {
  farColumns: number;
  midColumns: number;
  nearColumns: number;
  opacityMultiplier: number;
};

const INTENSITY_PRESETS: Record<RainIntensity, IntensityPreset> = {
  low: { farColumns: 28, midColumns: 16, nearColumns: 8, opacityMultiplier: 0.75 },
  medium: { farColumns: 48, midColumns: 28, nearColumns: 14, opacityMultiplier: 1 },
  high: { farColumns: 72, midColumns: 44, nearColumns: 24, opacityMultiplier: 1.2 }
};

const LAYER_ORDER: DepthLayer[] = ["far", "mid", "near"];

export class EquationRainCanvas {
  private ctx: CanvasRenderingContext2D;
  private columns: EquationRainColumn[] = [];
  private animationId = 0;
  private lastFrameTime = 0;
  private width = 0;
  private height = 0;
  private destroyed = false;
  private readonly reducedMotion: boolean;
  private readonly intensity: RainIntensity;
  private readonly resizeObserver: ResizeObserver;
  private readonly onVisibilityChange = () => this.handleVisibilityChange();

  constructor(private readonly canvas: HTMLCanvasElement, intensity: RainIntensity = "medium", reducedMotion = false) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Equation rain canvas context unavailable");
    this.ctx = ctx;
    this.intensity = intensity;
    this.reducedMotion = reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  start(): void {
    this.resize();
    if (this.reducedMotion) {
      this.renderStatic();
      return;
    }
    this.lastFrameTime = performance.now();
    this.animationId = requestAnimationFrame((time) => this.frame(time));
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.animationId);
    this.resizeObserver.disconnect();
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
  }

  private handleVisibilityChange(): void {
    if (this.destroyed || this.reducedMotion) return;
    if (document.visibilityState === "hidden") {
      cancelAnimationFrame(this.animationId);
      return;
    }
    this.lastFrameTime = performance.now();
    this.animationId = requestAnimationFrame((time) => this.frame(time));
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.floor(rect.width));
    const nextHeight = Math.max(1, Math.floor(rect.height));
    if (nextWidth === this.width && nextHeight === this.height) return;

    this.width = nextWidth;
    this.height = nextHeight;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.createColumns();
    if (this.reducedMotion) this.renderStatic();
  }

  private createColumns(): void {
    const preset = INTENSITY_PRESETS[this.intensity];
    this.columns = [
      ...this.createLayerColumns("far", preset.farColumns, preset.opacityMultiplier),
      ...this.createLayerColumns("mid", preset.midColumns, preset.opacityMultiplier),
      ...this.createLayerColumns("near", preset.nearColumns, preset.opacityMultiplier)
    ];
  }

  private createLayerColumns(layer: DepthLayer, count: number, opacityMultiplier: number): EquationRainColumn[] {
    return Array.from({ length: count }, (_, index) => this.createColumn(layer, index, opacityMultiplier, true));
  }

  private createColumn(layer: DepthLayer, index: number, opacityMultiplier: number, scatterY = false): EquationRainColumn {
    const fontSizePx = this.randomRange(...this.fontRange(layer));
    const category = this.randomCategory();
    const spacing = fontSizePx * 1.85;
    const entryCount = Math.ceil(this.height / spacing) + 6;
    const opacity = this.randomRange(...this.opacityRange(layer)) * opacityMultiplier;
    const column: EquationRainColumn = {
      id: `${layer}-${index}-${Math.random().toString(16).slice(2)}`,
      phase: Math.random() * Math.PI * 2,
      x: this.randomRange(30, Math.max(31, this.width - 30)),
      y: scatterY ? this.randomRange(-this.height, this.height * 0.7) : this.randomRange(-this.height * 0.8, -80),
      speedPxPerSecond: this.randomRange(...this.speedRange(layer)),
      horizontalDriftPx: this.randomRange(-8, 8),
      wobbleAmplitudePx: this.randomRange(...this.wobbleRange(layer)),
      wobbleFrequency: this.randomRange(0.45, 1.25),
      fontSizePx,
      opacity,
      glowColor: CATEGORY_COLORS[category],
      depthLayer: layer,
      equations: []
    };
    this.fillColumnEquations(column, entryCount, spacing, category);
    return column;
  }

  private fillColumnEquations(
    column: EquationRainColumn,
    entryCount: number,
    spacing: number,
    preferredCategory?: EquationCategory
  ): void {
    column.equations.length = 0;
    for (let i = 0; i < entryCount; i += 1) {
      const category = i === 0 && preferredCategory ? preferredCategory : this.randomCategory();
      const pool = EQUATION_RAIN_POOL[category];
      column.equations.push({
        text: pool[Math.floor(Math.random() * pool.length)],
        offsetY: -i * spacing,
        opacity: Math.max(0.15, 1 - i / entryCount),
        isHead: i === 0,
        category
      });
    }
  }

  private frame(time: number): void {
    if (this.destroyed || document.visibilityState === "hidden") return;
    const dt = Math.min(0.05, (time - this.lastFrameTime) / 1000);
    this.lastFrameTime = time;

    for (const column of this.columns) {
      column.y += column.speedPxPerSecond * dt;
      const tailY = column.y + column.equations[column.equations.length - 1].offsetY;
      if (tailY > this.height + 80) this.resetColumn(column);
    }

    this.draw(time / 1000);
    this.animationId = requestAnimationFrame((nextTime) => this.frame(nextTime));
  }

  private resetColumn(column: EquationRainColumn): void {
    const spacing = column.fontSizePx * 1.85;
    const category = this.randomCategory();
    column.x = this.randomRange(30, Math.max(31, this.width - 30));
    column.y = this.randomRange(-this.height * 0.65, -80);
    column.phase = Math.random() * Math.PI * 2;
    column.horizontalDriftPx = this.randomRange(-8, 8);
    column.glowColor = CATEGORY_COLORS[category];
    this.fillColumnEquations(column, column.equations.length, spacing, category);
  }

  private renderStatic(): void {
    this.draw(0);
  }

  private draw(timeSeconds: number): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
    for (const layer of LAYER_ORDER) {
      for (const column of this.columns) {
        if (column.depthLayer !== layer) continue;
        this.drawColumn(column, timeSeconds);
      }
    }
    this.ctx.fillStyle = "rgba(0, 0, 20, 0.30)";
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  private drawColumn(column: EquationRainColumn, timeSeconds: number): void {
    const drawX =
      column.x +
      Math.sin(timeSeconds * column.wobbleFrequency + column.phase) * column.wobbleAmplitudePx +
      column.horizontalDriftPx;

    for (const entry of column.equations) {
      const y = column.y + entry.offsetY;
      if (y < -60 || y > this.height + 60) continue;
      const color = entry.isHead ? "#f8fbff" : CATEGORY_COLORS[entry.category];
      const opacity = Math.min(
        0.95,
        column.opacity * entry.opacity * (entry.isHead ? 1.45 : 0.95)
      );
      this.drawEquation(entry.text, drawX, y, color, opacity, column.fontSizePx, entry.isHead);
    }
  }

  private drawEquation(text: string, x: number, y: number, color: string, opacity: number, fontSize: number, isHead: boolean): void {
    this.ctx.save();
    this.ctx.globalAlpha = opacity;
    this.ctx.font = `700 ${fontSize}px "Share Tech Mono", "Orbitron", "Rajdhani", monospace`;
    this.ctx.textAlign = "center";
    this.ctx.textBaseline = "middle";
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = fontSize * (isHead ? 0.85 : 0.45);
    this.ctx.fillStyle = color;
    this.ctx.fillText(text, x, y);
    if (isHead) {
      this.ctx.globalAlpha = Math.min(1, opacity * 0.55);
      this.ctx.shadowBlur = fontSize * 1.25;
      this.ctx.fillText(text, x, y);
    }
    this.ctx.restore();
  }

  private randomCategory(): EquationCategory {
    return EQUATION_CATEGORIES[Math.floor(Math.random() * EQUATION_CATEGORIES.length)];
  }

  private fontRange(layer: DepthLayer): [number, number] {
    if (layer === "far") return [12, 16];
    if (layer === "mid") return [18, 26];
    return [28, 40];
  }

  private opacityRange(layer: DepthLayer): [number, number] {
    if (layer === "far") return [0.1, 0.22];
    if (layer === "mid") return [0.25, 0.45];
    return [0.45, 0.7];
  }

  private speedRange(layer: DepthLayer): [number, number] {
    if (layer === "far") return [45, 90];
    if (layer === "mid") return [90, 165];
    return [165, 270];
  }

  private wobbleRange(layer: DepthLayer): [number, number] {
    if (layer === "far") return [2, 6];
    if (layer === "mid") return [4, 10];
    return [6, 16];
  }

  private randomRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }
}
