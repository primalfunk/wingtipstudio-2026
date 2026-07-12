const PHASE_ORDER = ['opening', 'build', 'pressure', 'release', 'setpiece', 'recovery', 'finale'];

const DEFAULT_PHASE_PROFILES = {
  opening: {
    label: 'OPENING',
    spawnProfile: { traffic: 0.82, enemies: 0.42, support: 1.05 },
    alert: null,
  },
  build: {
    label: 'BUILD',
    spawnProfile: { traffic: 1.02, enemies: 0.86, support: 1 },
    alert: null,
  },
  pressure: {
    label: 'PRESSURE',
    spawnProfile: { traffic: 1.08, enemies: 1.18, support: 0.82 },
    alert: 'ROADWAY: Pressure increasing.',
  },
  release: {
    label: 'RELEASE',
    spawnProfile: { traffic: 0.58, enemies: 0.52, support: 1.16 },
    alert: null,
  },
  setpiece: {
    label: 'SETPIECE',
    spawnProfile: { traffic: 0.82, enemies: 1.34, support: 0.72 },
    alert: 'ROADWAY: Major infrastructure ahead.',
  },
  recovery: {
    label: 'RECOVERY',
    spawnProfile: { traffic: 0.62, enemies: 0.62, support: 1.12 },
    alert: null,
  },
  finale: {
    label: 'FINALE',
    spawnProfile: { traffic: 0.86, enemies: 1.48, support: 0.68 },
    alert: 'EXTRACTION: Final push.',
  },
};

export default class MissionPacingDirector {
  constructor(scene, missionState, mission) {
    this.scene = scene;
    this.missionState = missionState;
    this.mission = mission;
    this.phases = this.buildPhases(mission);
    this.currentPhaseId = null;
    this.triggeredPhaseIds = new Set();
  }

  update() {
    if (this.missionState.isGameOver || this.scene.missionComplete || this.phases.length === 0) {
      return;
    }

    const phase = this.getCurrentPhase();
    if (!phase || phase.id === this.currentPhaseId) {
      return;
    }

    this.enterPhase(phase);
  }

  buildPhases(mission) {
    if (mission?.pacing?.length > 0) {
      return mission.pacing.map((phase, index) => this.normalizePhase(phase, index));
    }

    const length = Math.max(60, mission?.lengthSeconds ?? 75);
    const weights = [0.16, 0.16, 0.17, 0.12, 0.17, 0.1, 0.12];
    let cursor = 0;
    return PHASE_ORDER.map((type, index) => {
      const duration = index === PHASE_ORDER.length - 1
        ? length - cursor
        : Math.round(length * weights[index]);
      const phase = this.normalizePhase({ type, at: cursor, duration }, index);
      cursor += duration;
      return phase;
    });
  }

  normalizePhase(phase, index) {
    const profile = DEFAULT_PHASE_PROFILES[phase.type] ?? DEFAULT_PHASE_PROFILES.build;
    return {
      id: phase.id ?? `${phase.type}_${index}`,
      type: phase.type,
      label: phase.label ?? profile.label,
      at: phase.at ?? 0,
      duration: phase.duration ?? 10,
      spawnProfile: {
        ...profile.spawnProfile,
        ...(phase.spawnProfile ?? {}),
      },
      alert: phase.alert === undefined ? profile.alert : phase.alert,
      forceSpawn: phase.forceSpawn ?? null,
    };
  }

  getCurrentPhase() {
    const elapsed = this.missionState.elapsedTime;
    return [...this.phases]
      .reverse()
      .find((phase) => elapsed >= phase.at)
      ?? this.phases[0];
  }

  enterPhase(phase) {
    this.currentPhaseId = phase.id;
    this.missionState.currentPacingPhase = {
      id: phase.id,
      type: phase.type,
      label: phase.label,
      at: phase.at,
      duration: phase.duration,
    };
    this.missionState.pacingSpawnProfile = phase.spawnProfile;

    if (!this.triggeredPhaseIds.has(phase.id)) {
      this.triggeredPhaseIds.add(phase.id);
      this.missionState.eventHistory.push({
        type: 'missionPacingPhase',
        phaseType: phase.type,
        phaseLabel: phase.label,
        at: this.missionState.elapsedTime,
      });

      if (!this.scene.isAttract && phase.alert) {
        this.scene.hud.flashAlert(phase.alert);
      }

      this.applyForcedSpawnPressure(phase);
    }
  }

  applyForcedSpawnPressure(phase) {
    const forceSpawn = phase.forceSpawn;
    if (!forceSpawn) {
      return;
    }

    const now = this.scene.time.now;
    if (forceSpawn.traffic) {
      this.scene.trafficSystem.nextSpawnAt = now + (forceSpawn.trafficDelayMs ?? 0);
    }
    if (forceSpawn.enemies) {
      this.scene.combatSystem.nextEnemySpawnAt = now + (forceSpawn.enemyDelayMs ?? 0);
    }
    if (forceSpawn.support) {
      this.scene.supportSystem.nextSpawnAt = now + (forceSpawn.supportDelayMs ?? 0);
    }
  }
}
