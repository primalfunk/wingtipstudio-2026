import Phaser from 'phaser';

const FLOW_STATES = {
  open: {
    label: 'OPEN_FLOW',
    densityScale: 0.72,
    groupMin: 1,
    groupMax: 1,
    spacingMs: 0,
    speedScale: 1.08,
    personalities: ['commuter', 'cautious'],
  },
  commuter: {
    label: 'COMMUTER_FLOW',
    densityScale: 1,
    groupMin: 1,
    groupMax: 2,
    spacingMs: 340,
    speedScale: 1,
    personalities: ['commuter', 'commuter', 'cautious', 'aggressive'],
  },
  freight: {
    label: 'FREIGHT_FLOW',
    densityScale: 0.78,
    groupMin: 2,
    groupMax: 3,
    spacingMs: 460,
    speedScale: 0.84,
    personalities: ['freight', 'freight', 'service'],
    preferLarge: true,
    laneBias: 'right',
  },
  compressed: {
    label: 'COMPRESSED_FLOW',
    densityScale: 1.15,
    groupMin: 1,
    groupMax: 2,
    spacingMs: 420,
    speedScale: 0.86,
    personalities: ['cautious', 'freight', 'service'],
    avoidEdgeLanes: true,
  },
  surge: {
    label: 'SURGE_FLOW',
    densityScale: 1.25,
    groupMin: 2,
    groupMax: 3,
    spacingMs: 250,
    speedScale: 1.12,
    personalities: ['aggressive', 'commuter', 'aggressive'],
  },
  waterOpen: {
    label: 'OPEN_CHANNEL',
    densityScale: 0.68,
    groupMin: 1,
    groupMax: 1,
    spacingMs: 0,
    speedScale: 0.92,
    personalities: ['cautious', 'service'],
  },
  waterCargo: {
    label: 'CARGO_CHANNEL',
    densityScale: 0.86,
    groupMin: 1,
    groupMax: 2,
    spacingMs: 520,
    speedScale: 0.78,
    personalities: ['freight', 'service'],
    preferLarge: true,
  },
};

const PHASE_FLOW = {
  opening: 'open',
  build: 'commuter',
  pressure: 'compressed',
  release: 'open',
  setpiece: 'surge',
  recovery: 'open',
  finale: 'surge',
};

export default class TrafficFlowDirector {
  constructor(scene, missionState) {
    this.scene = scene;
    this.missionState = missionState;
    this.currentStateKey = 'open';
    this.currentState = FLOW_STATES.open;
    this.lastSignature = '';
  }

  update() {
    const stateKey = this.resolveStateKey();
    const phase = this.missionState.currentPacingPhase?.type ?? 'none';
    const segmentId = this.missionState.currentSegmentId ?? 'none';
    const signature = `${stateKey}:${phase}:${segmentId}`;
    if (signature === this.lastSignature) {
      return;
    }

    this.currentStateKey = stateKey;
    this.currentState = FLOW_STATES[stateKey] ?? FLOW_STATES.open;
    this.lastSignature = signature;
    this.missionState.currentTrafficFlow = {
      key: stateKey,
      label: this.currentState.label,
    };
    this.missionState.eventHistory.push({
      type: 'trafficFlowChanged',
      flow: this.currentState.label,
      phase,
      segmentId,
      at: this.missionState.elapsedTime,
    });
  }

  resolveStateKey() {
    if (this.scene.player?.mode === 'boat') {
      const tags = this.missionState.currentSegment?.tags ?? [];
      return tags.includes('water') || tags.includes('river') ? 'waterOpen' : 'waterCargo';
    }

    const tags = this.missionState.currentSegment?.tags ?? [];
    if (tags.includes('industrial') || tags.includes('freight')) {
      return 'freight';
    }
    if (tags.includes('construction') || tags.includes('diversion') || tags.includes('tunnel') || tags.includes('checkpoint')) {
      return 'compressed';
    }
    if (tags.includes('civilian-heavy') || tags.includes('watched')) {
      return 'commuter';
    }
    return PHASE_FLOW[this.missionState.currentPacingPhase?.type] ?? 'open';
  }

  createSpawnPlan({ pool, openLanes, laneCenters, spawnCount, atmospheric = false }) {
    this.update();
    const state = this.currentState;
    const count = atmospheric ? 1 : Phaser.Math.Between(state.groupMin, state.groupMax);
    const usedLanes = new Set();
    const spawns = [];

    for (let index = 0; index < count; index += 1) {
      const civilianType = this.chooseCivilianType(pool, spawnCount + index, state);
      const lane = this.chooseLane(openLanes, laneCenters, usedLanes, state);
      if (lane == null) {
        break;
      }
      usedLanes.add(lane);
      const personality = this.choosePersonality(civilianType, state);
      spawns.push({
        civilianType,
        lane,
        personality,
        delayMs: index * state.spacingMs,
        speedScale: state.speedScale * this.getPersonalitySpeedScale(personality),
      });
    }

    return spawns;
  }

  chooseCivilianType(pool, index, state) {
    if (!state.preferLarge) {
      return pool[index % pool.length];
    }

    const large = pool.filter((candidate) => (
      candidate.displayHeight >= 60 || candidate.id.includes('truck') || candidate.id.includes('tanker') || candidate.id.includes('barge')
    ));
    return (large.length > 0 ? large : pool)[index % Math.max(1, large.length || pool.length)];
  }

  chooseLane(openLanes, laneCenters, usedLanes, state) {
    let candidates = openLanes.filter((lane) => !usedLanes.has(lane));
    if (state.avoidEdgeLanes && candidates.some((lane) => lane > 0 && lane < laneCenters.length - 1)) {
      candidates = candidates.filter((lane) => lane > 0 && lane < laneCenters.length - 1);
    }
    if (state.laneBias === 'right' && candidates.some((lane) => lane >= Math.floor(laneCenters.length / 2))) {
      candidates = candidates.filter((lane) => lane >= Math.floor(laneCenters.length / 2));
    }
    return candidates.length > 0 ? Phaser.Utils.Array.GetRandom(candidates) : null;
  }

  choosePersonality(civilianType, state) {
    if (civilianType.speedMultiplier && civilianType.speedMultiplier < 0.9) {
      return 'freight';
    }
    if (civilianType.id.includes('utility') || civilianType.id.includes('service') || civilianType.id.includes('maintenance')) {
      return 'service';
    }
    return Phaser.Utils.Array.GetRandom(state.personalities);
  }

  getPersonalitySpeedScale(personality) {
    const scales = {
      aggressive: 1.14,
      commuter: 1,
      cautious: 0.9,
      freight: 0.84,
      service: 0.92,
    };
    return scales[personality] ?? 1;
  }

  getDelayScale() {
    this.update();
    return this.currentState.densityScale;
  }
}
