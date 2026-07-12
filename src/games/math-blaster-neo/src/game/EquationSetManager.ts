import { ProblemGenerator } from "./ProblemGenerator";
import type { DifficultyLevelConfig, EquationItem, EquationSet, FallingObject, GradeLevel } from "./types";

type PendingRelease = {
  setId: string;
  target: FallingObject;
  releaseAtMs: number;
};

export class EquationSetManager {
  private generator = new ProblemGenerator();
  private activeSets: EquationSet[] = [];
  private pendingReleases: PendingRelease[] = [];
  private currentEquationId: string | null = null;
  private setIndex = 0;
  private clockMs = 0;
  private lastDebug = "";
  private completedSinceLastRead = 0;

  constructor(private grade: GradeLevel) {}

  get currentEquation(): EquationItem | null {
    return this.unresolvedEquations()[0] ?? null;
  }

  get debugSnapshot() {
    return {
      grade: this.grade,
      setIndex: this.setIndex,
      currentEquationId: this.currentEquation?.id ?? null,
      activeEquations: this.activeSets.flatMap((set) =>
        set.equations.map((equation) => ({
          id: equation.id,
          prompt: equation.prompt,
          answer: equation.answer,
          targetId: equation.targetId,
          resolved: equation.resolved
        }))
      ),
      activeTargets: this.pendingReleases.map((release) => ({
        id: release.target.id,
        label: release.target.label,
        owningEquationId: release.target.owningEquationId
      }))
    };
  }

  reset(): void {
    this.activeSets = [];
    this.pendingReleases = [];
    this.currentEquationId = null;
    this.setIndex = 0;
    this.clockMs = 0;
    this.lastDebug = "";
    this.completedSinceLastRead = 0;
  }

  consumeCompletedSetCount(): number {
    const count = this.completedSinceLastRead;
    this.completedSinceLastRead = 0;
    return count;
  }

  update(args: {
    dtMs: number;
    config: DifficultyLevelConfig;
    laneXs: number[];
    visibleTargets: FallingObject[];
  }): FallingObject[] {
    this.clockMs += args.dtMs;
    const completedBeforeRetire = this.completedSinceLastRead;
    this.retireCompletedSets();
    const completedThisUpdate = this.completedSinceLastRead > completedBeforeRetire;
    if (!completedThisUpdate) {
      this.ensureSetAvailable(args.config, args.laneXs, args.visibleTargets.length);
    }
    const availableSlots = Math.max(0, args.config.maxVisibleTargets - args.visibleTargets.length);
    const released: FallingObject[] = [];
    for (const release of [...this.pendingReleases].sort((a, b) => a.releaseAtMs - b.releaseAtMs)) {
      if (released.length >= availableSlots) break;
      if (release.releaseAtMs > this.clockMs) continue;
      released.push(release.target);
      this.pendingReleases = this.pendingReleases.filter((item) => item !== release);
    }
    this.updateCurrentEquation();
    this.assertInvariants(args.visibleTargets.concat(released));
    this.debugLog(args.config, args.visibleTargets.concat(released));
    return released;
  }

  isCorrectTarget(target: FallingObject): boolean {
    return this.currentEquation?.targetId === target.id;
  }

  resolveTarget(targetId: string): void {
    const equation = this.findEquationByTarget(targetId);
    if (!equation) throw new Error(`Target ${targetId} has no owning equation`);
    equation.resolved = true;
    this.updateCurrentEquation();
  }

  missTarget(targetId: string): void {
    this.resolveTarget(targetId);
  }

  private ensureSetAvailable(config: DifficultyLevelConfig, laneXs: number[], visibleCount: number): void {
    const hasWork = this.unresolvedEquations().length > 0 || this.pendingReleases.length > 0;
    if (!config.allowSetOverlap && hasWork) return;
    if (config.allowSetOverlap && visibleCount + this.pendingReleases.length >= config.maxVisibleTargets) return;
    this.createSet(config, laneXs);
  }

  private createSet(config: DifficultyLevelConfig, laneXs: number[]): void {
    const equations = this.generator.createEquationItems(this.grade, config.asteroidSetSize, config);
    const set: EquationSet = {
      id: crypto.randomUUID(),
      index: this.setIndex + 1,
      equations,
      completed: false
    };
    this.setIndex = set.index;
    this.activeSets.push(set);
    const laneOrder = this.shuffledLaneIndexes(laneXs.length);
    equations.forEach((equation, index) => {
      const laneIndex = laneOrder[index % laneOrder.length];
      const target: FallingObject = {
        id: equation.targetId,
        laneIndex,
        x: laneXs[laneIndex],
        y: 126,
        radius: 66,
        label: equation.answer,
        owningEquationId: equation.id,
        speed: config.fallSpeedPxPerSecond,
        age: 0,
        rotationDirection: Math.random() < 0.5 ? -1 : 1,
        rotationSpeed: 0.45 + Math.random() * 0.75
      };
      this.pendingReleases.push({
        setId: set.id,
        target,
        releaseAtMs: this.clockMs + config.spawnDelayWithinSetMs * index
      });
    });
    this.updateCurrentEquation();
  }

  private shuffledLaneIndexes(count: number): number[] {
    return Array.from({ length: count }, (_, index) => index).sort(() => Math.random() - 0.5);
  }

  private retireCompletedSets(): void {
    for (const set of this.activeSets) {
      const completedNow = !set.completed && set.equations.every((equation) => equation.resolved);
      if (completedNow) {
        set.completed = true;
        this.completedSinceLastRead += 1;
      }
    }
    this.activeSets = this.activeSets.filter((set) => !set.completed);
  }

  private unresolvedEquations(): EquationItem[] {
    return this.activeSets.flatMap((set) => set.equations).filter((equation) => !equation.resolved);
  }

  private updateCurrentEquation(): void {
    const currentStillValid = this.currentEquationId
      ? this.unresolvedEquations().some((equation) => equation.id === this.currentEquationId)
      : false;
    if (!currentStillValid) {
      this.currentEquationId = this.unresolvedEquations()[0]?.id ?? null;
    }
  }

  private findEquationByTarget(targetId: string): EquationItem | null {
    return this.activeSets.flatMap((set) => set.equations).find((equation) => equation.targetId === targetId) ?? null;
  }

  private assertInvariants(visibleTargets: FallingObject[]): void {
    const equations = this.activeSets.flatMap((set) => set.equations);
    const targetIds = new Set<string>();
    for (const equation of equations) {
      if (!equation.targetId) throw new Error(`Equation ${equation.id} has no targetId`);
      if (targetIds.has(equation.targetId)) throw new Error(`Duplicate target ownership for ${equation.targetId}`);
      targetIds.add(equation.targetId);
    }
    for (const target of visibleTargets.concat(this.pendingReleases.map((release) => release.target))) {
      const owner = equations.find((equation) => equation.id === target.owningEquationId && equation.targetId === target.id);
      if (!owner) throw new Error(`Target ${target.id} has no valid owning equation`);
    }
    const current = this.currentEquation;
    if (current && current.resolved) throw new Error("Current ammo points to a resolved equation");
  }

  private debugLog(config: DifficultyLevelConfig, visibleTargets: FallingObject[]): void {
    const snapshot = JSON.stringify({
      config,
      setIndex: this.setIndex,
      currentAmmo: this.currentEquation?.prompt ?? null,
      activeEquations: this.activeSets.flatMap((set) => set.equations.map((equation) => `${equation.prompt}=${equation.answer}${equation.resolved ? ":done" : ""}`)),
      activeTargets: visibleTargets.map((target) => `${target.label}->${target.owningEquationId}`)
    });
    if (snapshot !== this.lastDebug) {
      console.debug("[Math Blaster Neo] equation-set-state", JSON.parse(snapshot));
      this.lastDebug = snapshot;
    }
  }
}
