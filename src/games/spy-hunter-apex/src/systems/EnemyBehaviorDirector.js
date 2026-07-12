import Phaser from 'phaser';

const ROLE_PROFILES = {
  pursuit: {
    label: 'Pursuit Interceptor',
    laneCommitMs: 900,
    burstMs: 1800,
    restMs: 850,
    lateralScale: 1.06,
    aggressionScale: 1.04,
    speedScale: 1.02,
    fireCooldownScale: 1,
  },
  rammer: {
    label: 'Rammer',
    laneCommitMs: 1250,
    burstMs: 1100,
    restMs: 1400,
    lateralScale: 1.45,
    aggressionScale: 1.38,
    speedScale: 1.13,
    fireCooldownScale: 1,
  },
  scout: {
    label: 'Scout Bike',
    laneCommitMs: 620,
    burstMs: 1450,
    restMs: 650,
    lateralScale: 1.55,
    aggressionScale: 0.82,
    speedScale: 1.18,
    weaveScale: 1.25,
    fireCooldownScale: 0.92,
  },
  shooter: {
    label: 'Shooter Sedan',
    laneCommitMs: 1600,
    burstMs: 2200,
    restMs: 1150,
    lateralScale: 0.78,
    aggressionScale: 0.88,
    speedScale: 0.94,
    fireCooldownScale: 0.92,
  },
  heavy: {
    label: 'Heavy Sedan',
    laneCommitMs: 2100,
    burstMs: 2600,
    restMs: 1300,
    lateralScale: 0.56,
    aggressionScale: 0.68,
    speedScale: 0.82,
    fireCooldownScale: 1.12,
  },
  mineLayer: {
    label: 'Mine Layer',
    laneCommitMs: 1350,
    burstMs: 1800,
    restMs: 1050,
    lateralScale: 0.72,
    aggressionScale: 0.7,
    speedScale: 0.86,
    fireCooldownScale: 0.9,
  },
  supportHunter: {
    label: 'Support Hunter',
    laneCommitMs: 1500,
    burstMs: 2000,
    restMs: 1100,
    lateralScale: 1.08,
    aggressionScale: 1.02,
    speedScale: 1,
    fireCooldownScale: 1,
  },
};

const ROLE_BY_TYPE = {
  'pursuit-interceptor': 'pursuit',
  rammer: 'rammer',
  'scout-bike': 'scout',
  'assassin-bike': 'scout',
  'rocket-bike': 'scout',
  'turret-gunner': 'shooter',
  'missile-launcher': 'shooter',
  'rocket-salvo': 'shooter',
  'cannon-car': 'shooter',
  'armored-sedan': 'heavy',
  'command-car': 'heavy',
  'mine-layer': 'mineLayer',
  'signal-jammer': 'supportHunter',
  'attack-skiff': 'pursuit',
  'rammer-boat': 'rammer',
  'rocket-hydrofoil': 'scout',
  gunboat: 'shooter',
  'command-boat': 'heavy',
  'mine-boat': 'mineLayer',
};

const ENCOUNTER_TYPES = {
  pursuit: {
    label: 'PURSUIT ENCOUNTER',
    roles: ['pursuit', 'scout', 'shooter'],
    roadIds: ['pursuit-interceptor', 'scout-bike', 'turret-gunner'],
    waterIds: ['attack-skiff', 'rocket-hydrofoil', 'gunboat'],
    spawnDelayScale: 0.95,
  },
  compression: {
    label: 'COMPRESSION ENCOUNTER',
    roles: ['rammer', 'pursuit', 'heavy'],
    roadIds: ['rammer', 'pursuit-interceptor', 'armored-sedan'],
    waterIds: ['rammer-boat', 'attack-skiff', 'gunboat'],
    spawnDelayScale: 0.78,
  },
  fireCorridor: {
    label: 'FIRE CORRIDOR',
    roles: ['shooter', 'pursuit'],
    roadIds: ['turret-gunner', 'missile-launcher', 'cannon-car', 'rocket-salvo'],
    waterIds: ['gunboat', 'rocket-hydrofoil'],
    spawnDelayScale: 0.9,
  },
  heavyConvoy: {
    label: 'HEAVY CONVOY',
    roles: ['heavy', 'shooter', 'supportHunter'],
    roadIds: ['armored-sedan', 'command-car', 'signal-jammer', 'cannon-car'],
    waterIds: ['command-boat', 'gunboat', 'rammer-boat'],
    spawnDelayScale: 1.08,
  },
  hazardField: {
    label: 'HAZARD FIELD',
    roles: ['mineLayer', 'shooter', 'pursuit'],
    roadIds: ['mine-layer', 'turret-gunner', 'pursuit-interceptor'],
    waterIds: ['mine-boat', 'gunboat', 'attack-skiff'],
    spawnDelayScale: 1.02,
  },
  waterSwarm: {
    label: 'PATROL SWARM',
    roles: ['scout', 'pursuit', 'shooter'],
    roadIds: ['pursuit-interceptor'],
    waterIds: ['attack-skiff', 'rocket-hydrofoil', 'rammer-boat', 'gunboat'],
    spawnDelayScale: 0.82,
  },
};

const PHASE_ENCOUNTERS = {
  opening: ['pursuit'],
  build: ['pursuit', 'fireCorridor'],
  pressure: ['compression', 'hazardField', 'fireCorridor'],
  release: ['pursuit'],
  setpiece: ['compression', 'heavyConvoy', 'hazardField'],
  recovery: ['pursuit'],
  finale: ['fireCorridor', 'compression', 'heavyConvoy'],
};

export default class EnemyBehaviorDirector {
  constructor(scene, missionState) {
    this.scene = scene;
    this.missionState = missionState;
    this.currentEncounterKey = null;
    this.currentEncounter = null;
    this.nextEncounterAt = 0;
    this.spawnIndex = 0;
  }

  update(time) {
    if (time < this.nextEncounterAt && this.currentEncounter) {
      return;
    }

    const key = this.chooseEncounterKey();
    this.setEncounter(key, time);
  }

  chooseEncounterKey() {
    const tags = this.missionState.currentSegment?.tags ?? [];
    if (this.scene.player?.mode === 'boat') {
      if (tags.includes('water') || tags.includes('river') || tags.includes('dock')) {
        return tags.includes('flood-channel') ? 'hazardField' : 'waterSwarm';
      }
    }

    if (tags.includes('tunnel') || tags.includes('compressed') || tags.includes('construction') || tags.includes('diversion')) {
      return 'compression';
    }
    if (tags.includes('bridge') || tags.includes('causeway')) {
      return 'fireCorridor';
    }
    if (tags.includes('industrial') || tags.includes('freight') || tags.includes('fortified') || tags.includes('checkpoint')) {
      return Phaser.Utils.Array.GetRandom(['heavyConvoy', 'fireCorridor', 'hazardField']);
    }
    if (tags.includes('divided') || tags.includes('median')) {
      return Phaser.Utils.Array.GetRandom(['hazardField', 'fireCorridor']);
    }

    const phaseType = this.missionState.currentPacingPhase?.type ?? 'opening';
    return Phaser.Utils.Array.GetRandom(PHASE_ENCOUNTERS[phaseType] ?? ['pursuit']);
  }

  setEncounter(key, time) {
    this.currentEncounterKey = key;
    this.currentEncounter = ENCOUNTER_TYPES[key] ?? ENCOUNTER_TYPES.pursuit;
    this.nextEncounterAt = time + Phaser.Math.Between(10500, 16500);
    this.spawnIndex = 0;
    this.missionState.currentEnemyEncounter = {
      key,
      label: this.currentEncounter.label,
      roles: this.currentEncounter.roles,
    };
    this.missionState.eventHistory.push({
      type: 'enemyEncounterChanged',
      encounter: key,
      label: this.currentEncounter.label,
      segmentId: this.missionState.currentSegmentId,
      phase: this.missionState.currentPacingPhase?.type ?? 'none',
      at: this.missionState.elapsedTime,
    });
  }

  chooseEnemyType(enemyPool, activeEnemies, canSpawn) {
    const encounter = this.currentEncounter ?? ENCOUNTER_TYPES.pursuit;
    const ids = this.scene.player?.mode === 'boat' ? encounter.waterIds : encounter.roadIds;
    const candidates = ids
      .map((id) => enemyPool.find((type) => type.id === id))
      .filter(Boolean);
    const fallback = enemyPool.filter((type) => encounter.roles.includes(this.getRoleKey(type)));
    const pool = candidates.length > 0 ? candidates : fallback;

    for (let offset = 0; offset < pool.length; offset += 1) {
      const candidate = pool[(this.spawnIndex + offset) % pool.length];
      if (this.respectsComposition(candidate, activeEnemies) && canSpawn(candidate)) {
        this.spawnIndex += offset + 1;
        return candidate;
      }
    }

    return enemyPool.find((type) => canSpawn(type)) ?? null;
  }

  chooseLane(openLanes, laneCenters, player, enemyType) {
    if (!player?.sprite?.active || openLanes.length <= 1) {
      return Phaser.Utils.Array.GetRandom(openLanes);
    }

    const role = this.getRoleKey(enemyType);
    const playerLane = laneCenters.reduce((bestLane, laneX, lane) => (
      Math.abs(laneX - player.sprite.x) < Math.abs(laneCenters[bestLane] - player.sprite.x) ? lane : bestLane
    ), 0);

    if (role === 'scout') {
      const sorted = [...openLanes].sort((a, b) => Math.abs(b - playerLane) - Math.abs(a - playerLane));
      return sorted[0];
    }

    if (role === 'shooter' || role === 'mineLayer') {
      const sorted = [...openLanes].sort((a, b) => Math.abs(laneCenters[a] - player.sprite.x) - Math.abs(laneCenters[b] - player.sprite.x));
      return sorted[0];
    }

    if (role === 'rammer' || role === 'pursuit') {
      const sorted = [...openLanes].sort((a, b) => Math.abs(a - playerLane) - Math.abs(b - playerLane));
      return sorted[0];
    }

    return Phaser.Utils.Array.GetRandom(openLanes);
  }

  getSpawnConfig(enemyType) {
    const roleKey = this.getRoleKey(enemyType);
    const profile = this.getRoleProfile(enemyType);
    const tags = this.missionState.currentSegment?.tags ?? [];
    const roadwayPressure = tags.includes('tunnel') || tags.includes('construction') || tags.includes('bridge') || tags.includes('checkpoint');
    const pressureScale = roadwayPressure && (roleKey === 'rammer' || roleKey === 'shooter') ? 1.14 : 1;
    return {
      behaviorRole: roleKey,
      behaviorProfile: profile,
      speedScale: profile.speedScale * pressureScale,
      aggressionScale: profile.aggressionScale * pressureScale,
    };
  }

  canEnemyFire(enemy) {
    const role = enemy.behaviorRole;
    if (role === 'rammer' || role === 'scout') {
      return enemy.isAggressionBurstActive();
    }
    if (role === 'mineLayer') {
      return true;
    }
    return enemy.isAggressionBurstActive() || role === 'shooter';
  }

  getSpawnDelayScale() {
    return this.currentEncounter?.spawnDelayScale ?? 1;
  }

  getRoleKey(enemyType) {
    if (ROLE_BY_TYPE[enemyType.id]) {
      return ROLE_BY_TYPE[enemyType.id];
    }
    if (enemyType.weaponStyle === 'mine') {
      return 'mineLayer';
    }
    if (enemyType.weaponStyle && enemyType.weaponStyle !== 'none') {
      return 'shooter';
    }
    if (enemyType.chassis === 'motorcycle' || enemyType.role === 'scout' || enemyType.role === 'flanker') {
      return 'scout';
    }
    if (enemyType.role === 'bruiser' || enemyType.role === 'rammer') {
      return 'rammer';
    }
    if (enemyType.role === 'blocker' || enemyType.role === 'coordinator') {
      return 'heavy';
    }
    return 'pursuit';
  }

  getRoleProfile(enemyType) {
    return {
      ...ROLE_PROFILES[this.getRoleKey(enemyType)],
    };
  }

  respectsComposition(enemyType, activeEnemies) {
    const role = this.getRoleKey(enemyType);
    const roleCount = activeEnemies.filter((enemy) => enemy.behaviorRole === role).length;
    if (role === 'mineLayer') {
      return roleCount < 1;
    }
    if (role === 'shooter') {
      return roleCount < 2;
    }
    if (role === 'rammer') {
      return roleCount < 2;
    }
    return true;
  }
}
