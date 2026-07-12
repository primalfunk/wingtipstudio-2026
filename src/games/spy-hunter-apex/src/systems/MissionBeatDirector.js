export default class MissionBeatDirector {
  constructor(scene, missionState, mission, systems) {
    this.scene = scene;
    this.missionState = missionState;
    this.mission = mission;
    this.systems = systems;
    this.beats = [...(mission.beats ?? [])].sort((a, b) => a.at - b.at);
    this.triggeredBeatIds = new Set();
  }

  update() {
    if (this.missionState.isGameOver || this.scene.missionComplete) {
      return;
    }

    for (const beat of this.beats) {
      const id = beat.id ?? `${beat.type}_${beat.at}`;
      if (this.triggeredBeatIds.has(id) || this.missionState.elapsedTime < beat.at) {
        continue;
      }

      this.triggeredBeatIds.add(id);
      this.executeBeat(beat, id);
    }
  }

  executeBeat(beat, id) {
    const handlers = {
      alert: () => this.showAlert(beat),
      roadSign: () => this.spawnRoadSign(beat),
      enemyWave: () => this.spawnEnemyWave(beat),
      support: () => this.spawnSupport(beat),
      trafficBurst: () => this.spawnTrafficBurst(beat),
      spawnPressure: () => this.applySpawnPressure(beat),
    };

    handlers[beat.type]?.();
    this.missionState.eventHistory.push({
      type: 'missionBeat',
      beatType: beat.type,
      beatId: id,
      label: beat.label,
      at: this.missionState.elapsedTime,
    });
  }

  showAlert(beat) {
    if (!this.scene.isAttract && beat.message) {
      this.scene.hud.flashAlert(beat.message);
    }
  }

  spawnRoadSign(beat) {
    this.systems.roadSignSystem.spawnRoadSign({
      id: beat.signId ?? `mission_sign_${beat.at}`,
      text: beat.text ?? beat.message ?? 'CHECKPOINT AHEAD',
      truthState: beat.truthState ?? 'true',
    });
  }

  spawnEnemyWave(beat) {
    const enemyTypeIds = beat.enemyTypeIds ?? [];
    const count = beat.count ?? Math.max(1, enemyTypeIds.length);
    for (let index = 0; index < count; index += 1) {
      this.scene.time.delayedCall(index * (beat.spacingMs ?? 260), () => {
        if (this.missionState.isGameOver) {
          return;
        }
        this.systems.combatSystem.spawnEnemy({
          enemyTypeId: enemyTypeIds[index % enemyTypeIds.length],
          spawnTarget: beat.spawnTarget ?? 'player_side',
          speed: beat.speed,
        });
      });
    }
  }

  spawnSupport(beat) {
    this.scene.time.delayedCall(beat.delayMs ?? 0, () => {
      if (this.missionState.isGameOver) {
        return;
      }
      this.systems.supportSystem.spawnVan({
        isDecoy: Boolean(beat.isDecoy),
        serviceType: beat.serviceType,
        spawnTarget: beat.spawnTarget ?? 'player_side',
      });
    });
  }

  spawnTrafficBurst(beat) {
    const count = beat.count ?? 2;
    for (let index = 0; index < count; index += 1) {
      this.scene.time.delayedCall(index * (beat.spacingMs ?? 220), () => {
        if (this.missionState.isGameOver) {
          return;
        }
        this.systems.trafficSystem.trySpawnCivilian({
          spawnTarget: beat.spawnTarget ?? 'player_side',
          atmospheric: Boolean(beat.atmospheric),
        });
      });
    }
  }

  applySpawnPressure(beat) {
    const now = this.scene.time.now;
    if (beat.enemies === 'now') {
      this.systems.combatSystem.nextEnemySpawnAt = now;
    }
    if (beat.traffic === 'now') {
      this.systems.trafficSystem.nextSpawnAt = now;
    }
    if (beat.support === 'now') {
      this.systems.supportSystem.nextSpawnAt = now;
    }
  }
}
