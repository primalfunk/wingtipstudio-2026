import { AudioManager } from "./AudioManager";
import { projectileHit } from "./CollisionSystem";
import { EquationSetManager } from "./EquationSetManager";
import { InputManager } from "./InputManager";
import { difficultyConfigFor, MAX_LEVEL, ROUNDS_PER_LEVEL } from "./LevelManager";
import { Renderer } from "./Renderer";
import type { FallingObject, GameSnapshot, GradeLevel, ImpactFeedback, Launcher, LaunchEffect, Projectile, ScreenShake, Settings, VisualEffect } from "./types";
import { MAX_BASE_HITS, WORLD_HEIGHT, WORLD_WIDTH } from "./types";

type GameCallbacks = {
  onHud: (snapshot: GameSnapshot) => void;
  onPause: () => void;
  onGameOver: (snapshot: GameSnapshot) => void;
};

export class Game {
  private renderer: Renderer;
  private input: InputManager;
  private setManager: EquationSetManager;
  private launchers: Launcher[] = [];
  private objects: FallingObject[] = [];
  private projectiles: Projectile[] = [];
  private effects: VisualEffect[] = [];
  private launchEffects: LaunchEffect[] = [];
  private impactFeedback: ImpactFeedback | null = null;
  private screenShake: ScreenShake | null = null;
  private selectedIndex = 0;
  private score = 0;
  private gameLevel = 1;
  private roundsCompletedThisLevel = 0;
  private health = MAX_BASE_HITS;
  private streak = 0;
  private correct = 0;
  private misses = 0;
  private lastTime = 0;
  private raf = 0;
  private paused = false;
  private over = false;
  private feedback: string | null = null;
  private feedbackTimer = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private grade: GradeLevel,
    private settings: Settings,
    private callbacks: GameCallbacks,
    private audio = new AudioManager()
  ) {
    this.renderer = new Renderer(canvas);
    this.setManager = new EquationSetManager(grade);
    this.input = new InputManager(canvas, {
      move: (delta) => this.move(delta),
      fire: () => this.fire(),
      pause: () => this.togglePause(),
      selectLauncher: (index) => this.select(index)
    });
    this.audio.setEnabled(settings.audioEnabled);
    this.resetLaunchers();
  }

  start(): void {
    this.audio.setEnabled(this.settings.audioEnabled);
    this.audio.playMusic();
    this.input.attach(() => this.launchers);
    this.releaseTargets(0);
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.input.destroy();
    this.renderer.destroy();
  }

  resume(): void {
    if (this.over) return;
    this.paused = false;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  private resetLaunchers(): void {
    const spacing = WORLD_WIDTH / 6;
    this.launchers = Array.from({ length: 5 }, (_, i) => ({
      id: `launcher-${i}`,
      laneIndex: i,
      x: spacing * (i + 1),
      y: 468,
      selected: i === this.selectedIndex
    }));
  }

  private loop = (time: number): void => {
    if (this.paused || this.over) return;
    const dt = Math.min(0.05, (time - this.lastTime) / 1000);
    this.lastTime = time;
    this.update(dt);
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    for (const object of this.objects) {
      object.y += object.speed * dt;
      object.age += dt;
    }
    for (const projectile of this.projectiles) {
      const target = this.objects.find((object) => object.id === projectile.targetObjectId);
      if (target) {
        projectile.y -= projectile.speed * dt;
      } else {
        projectile.y -= projectile.speed * dt;
      }
    }
    for (const effect of this.effects) effect.age += dt;
    this.effects = this.effects.filter((effect) => effect.age < effect.duration);
    for (const effect of this.launchEffects) effect.age += dt;
    this.launchEffects = this.launchEffects.filter((effect) => effect.age < effect.duration);
    if (this.impactFeedback) {
      this.impactFeedback.age += dt;
      if (this.impactFeedback.age >= this.impactFeedback.duration) this.impactFeedback = null;
    }
    if (this.screenShake) {
      this.screenShake.age += dt;
      if (this.screenShake.age >= this.screenShake.duration) this.screenShake = null;
    }
    this.releaseTargets(dt * 1000);
    this.resolveProjectiles();
    this.resolveBaseHits();
    if (this.feedbackTimer > 0) {
      this.feedbackTimer -= dt;
      if (this.feedbackTimer <= 0) this.feedback = null;
    }
    this.callbacks.onHud(this.snapshot());
  }

  private render(): void {
    this.renderer.render({
      launchers: this.launchers,
      objects: this.objects,
      projectiles: this.projectiles,
      effects: this.effects,
      launchEffects: this.launchEffects,
      impactFeedback: this.impactFeedback,
      screenShake: this.screenShake,
      level: this.gameLevel,
      health: this.health,
      settings: this.settings,
      feedback: this.feedback,
      ammoLabel: this.setManager.currentEquation?.prompt ?? "",
      ammoMode: "problemAmmo_answerTargets"
    });
  }

  private releaseTargets(dtMs: number): void {
    const config = difficultyConfigFor(this.grade, this.gameLevel, this.roundsCompletedThisLevel + 1);
    const released = this.setManager.update({
      dtMs,
      config,
      laneXs: this.launchers.map((launcher) => launcher.x),
      visibleTargets: this.objects
    });
    this.objects.push(...released);
    this.advanceCompletedRounds();
  }

  private advanceCompletedRounds(): void {
    const completed = this.setManager.consumeCompletedSetCount();
    if (completed === 0) return;
    this.roundsCompletedThisLevel += completed;
    while (this.roundsCompletedThisLevel >= ROUNDS_PER_LEVEL) {
      this.roundsCompletedThisLevel -= ROUNDS_PER_LEVEL;
      const previousLevel = this.gameLevel;
      this.gameLevel = Math.min(MAX_LEVEL, this.gameLevel + 1);
      if (this.gameLevel !== previousLevel) {
        this.effects.push({ id: crypto.randomUUID(), x: WORLD_WIDTH / 2, y: 130, label: `Level ${this.gameLevel}`, kind: "level", age: 0, duration: 1.1 });
        this.audio.play("level");
      }
    }
  }

  private fire(): void {
    if (this.paused || this.over) return;
    const launcher = this.launchers[this.selectedIndex];
    const target = this.targetInLane(launcher.laneIndex);
    if (!target) {
      this.showFeedback("No target in lane");
      return;
    }
    this.audio.play("fire");
    this.projectiles.push({
      id: crypto.randomUUID(),
      x: launcher.x,
      y: launcher.y - 38,
      startX: launcher.x,
      startY: launcher.y - 38,
      targetObjectId: target.id,
      label: this.setManager.currentEquation?.prompt ?? "",
      correct: this.setManager.isCorrectTarget(target),
      speed: 380
    });
    this.screenShake = {
      age: 0,
      duration: this.settings.reducedMotion ? 0.08 : 0.16,
      intensity: 0.35
    };
    this.launchEffects.push({
      id: crypto.randomUUID(),
      launcherIndex: launcher.laneIndex,
      x: launcher.x,
      y: launcher.y - 56,
      age: 0,
      duration: this.settings.reducedMotion ? 0.18 : 0.36
    });
  }

  private resolveProjectiles(): void {
    for (const projectile of [...this.projectiles]) {
      const target = this.objects.find((object) => object.id === projectile.targetObjectId);
      if (!target || projectile.y < -20) {
        this.projectiles = this.projectiles.filter((item) => item.id !== projectile.id);
        continue;
      }
      if (projectileHit(projectile, target)) {
        if (!projectile.correct) {
          if (!projectile.impacted) {
            projectile.impacted = true;
            this.streak = 0;
            this.misses += 1;
            this.effects.push({ id: crypto.randomUUID(), x: target.x, y: target.y, label: "WRONG", kind: "wrong", age: 0, duration: this.settings.reducedMotion ? 0.25 : 0.42 });
            this.showFeedback("Wrong target");
            this.audio.play("wrong");
            this.screenShake = {
              age: 0,
              duration: this.settings.reducedMotion ? 0.08 : 0.18,
              intensity: 0.45
            };
          }
          continue;
        }
        this.projectiles = this.projectiles.filter((item) => item.id !== projectile.id);
        const heightBonus = Math.round(Math.max(0, (WORLD_HEIGHT - target.y) / WORLD_HEIGHT) * 50);
        this.streak += 1;
        this.correct += 1;
        this.score += 100 + heightBonus + (this.streak % 5 === 0 ? this.streak * 10 : 0);
        this.setManager.resolveTarget(target.id);
        this.objects = this.objects.filter((object) => object.id !== target.id);
        this.effects.push({ id: crypto.randomUUID(), x: target.x, y: target.y, label: "+100", kind: "explosion", age: 0, duration: this.settings.reducedMotion ? 0.35 : 0.7 });
        this.screenShake = {
          age: 0,
          duration: this.settings.reducedMotion ? 0.1 : 0.24,
          intensity: 0.55
        };
        this.showFeedback("Correct hit!");
        this.audio.play("correct");
      }
    }
  }

  private resolveBaseHits(): void {
    const hits = this.objects.filter((object) => object.y + object.radius >= 430);
    if (hits.length === 0) return;
    for (const hit of hits) this.setManager.missTarget(hit.id);
    this.objects = this.objects.filter((object) => !hits.includes(object));
    const previousHealth = this.health;
    this.health = Math.max(0, this.health - hits.length);
    for (const hit of hits) {
      this.effects.push({
        id: crypto.randomUUID(),
        x: hit.x,
        y: 414,
        label: undefined,
        kind: "explosion",
        age: 0,
        duration: this.settings.reducedMotion ? 0.35 : 0.75
      });
    }
    this.impactFeedback = {
      age: 0,
      duration: this.settings.reducedMotion ? 0.25 : 0.55,
      intensity: Math.min(1.6, 0.8 + hits.length * 0.25),
      previousHealth,
      currentHealth: this.health
    };
    this.streak = 0;
    this.misses += hits.length;
    this.showFeedback("Base hit");
    this.audio.play("impact");
    if (this.health <= 0) this.gameOver();
  }

  private move(delta: number): void {
    this.select((this.selectedIndex + delta + this.launchers.length) % this.launchers.length);
  }

  private targetInLane(laneIndex: number): FallingObject | undefined {
    return this.objects
      .filter((object) => object.laneIndex === laneIndex)
      .sort((a, b) => b.y - a.y || b.age - a.age)[0];
  }

  private select(index: number): void {
    this.selectedIndex = Math.max(0, Math.min(this.launchers.length - 1, index));
    this.launchers.forEach((launcher, i) => {
      launcher.selected = i === this.selectedIndex;
    });
    this.render();
  }

  private togglePause(): void {
    if (this.over) return;
    this.paused = !this.paused;
    if (this.paused) {
      cancelAnimationFrame(this.raf);
      this.callbacks.onPause();
    } else {
      this.resume();
    }
  }

  private gameOver(): void {
    this.over = true;
    cancelAnimationFrame(this.raf);
    this.audio.play("gameover");
    this.callbacks.onGameOver(this.snapshot());
  }

  private showFeedback(text: string): void {
    this.feedback = text;
    this.feedbackTimer = 0.75;
  }

  private snapshot(): GameSnapshot {
    const total = this.correct + this.misses;
    return {
      score: this.score,
      gameLevel: this.gameLevel,
      baseHealth: this.health,
      streak: this.streak,
      correct: this.correct,
      misses: this.misses,
      accuracy: total === 0 ? 100 : Math.round((this.correct / total) * 100),
      grade: this.grade,
      ammoLabel: this.setManager.currentEquation?.prompt ?? "",
      ammoMode: "problemAmmo_answerTargets"
    };
  }
}
