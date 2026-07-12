import { ROAD } from '../data/tuning.js';

const SAFE_DISTANCE_Y = 118;
const LOOKAHEAD_Y = 250;
const LANE_SWITCH_MARGIN = 26;
const LANE_TARGET_DEAD_ZONE = 14;

export default class AiDriver {
  constructor(scene, missionState, player, systems) {
    this.scene = scene;
    this.missionState = missionState;
    this.player = player;
    this.trafficSystem = systems.trafficSystem;
    this.combatSystem = systems.combatSystem;
    this.supportSystem = systems.supportSystem;
    this.laneCenters = this.createLaneCenters();
    this.targetX = player.sprite.x;
    this.targetY = player.sprite.y;
    this.targetLane = 0;
    this.committedCarriageway = null;
  }

  update() {
    this.laneCenters = this.getNavigableLaneCenters();
    const threat = this.findImmediateThreat();
    this.targetLane = this.chooseStableTargetLane(threat);
    this.targetX = this.laneCenters[this.targetLane];
    this.targetY = this.chooseTargetY(threat);

    return {
      x: this.axisToward(this.player.sprite.x, this.targetX, LANE_TARGET_DEAD_ZONE),
      y: this.axisToward(this.player.sprite.y, this.targetY, 10),
      fire: this.shouldFire(),
    };
  }

  createLaneCenters() {
    const laneWidth = (ROAD.right - ROAD.left) / ROAD.laneCount;
    return Array.from({ length: ROAD.laneCount }, (_, index) => ROAD.left + laneWidth * index + laneWidth / 2);
  }

  getNavigableLaneCenters() {
    if (!this.scene.roadSystem?.isDivided?.()) {
      this.committedCarriageway = null;
      return this.scene.roadSystem?.getLaneCentersForTarget?.('player_side', this.player.sprite.x)
        ?? this.createLaneCenters();
    }

    if (!this.committedCarriageway || this.committedCarriageway === 'unified') {
      this.committedCarriageway = this.scene.roadSystem.getCarriagewayForX?.(this.player.sprite.x) ?? 'right';
      if (this.committedCarriageway === 'unified') {
        this.committedCarriageway = this.player.sprite.x < (ROAD.left + ROAD.right) / 2 ? 'left' : 'right';
      }
    }

    return this.scene.roadSystem.getLaneCentersForTarget?.(this.committedCarriageway, this.player.sprite.x)
      ?? this.createLaneCenters();
  }

  chooseObjectiveLane() {
    const preferredServiceType = this.player.mode === 'motorcycle' ? 'upgrade' : null;
    const realSupport = this.supportSystem.vans.find((van) => {
      return !van.isDecoy
        && van.sprite.y > -20
        && (!preferredServiceType || van.serviceType === preferredServiceType);
    }) ?? this.supportSystem.vans.find((van) => {
      return !van.isDecoy
        && van.sprite.y > -20
        && this.player.mode !== 'motorcycle';
    });
    if (realSupport) {
      return this.nearestLane(realSupport.sprite.x);
    }

    const decoy = this.supportSystem.vans.find((van) => van.isDecoy && van.sprite.y > -20);
    if (decoy) {
      return this.nearestLane(decoy.sprite.x);
    }

    const enemyAhead = this.findShootableEnemy();
    if (enemyAhead) {
      return this.nearestLane(enemyAhead.sprite.x);
    }

    return this.chooseSafestLane();
  }

  chooseStableTargetLane(threat) {
    const desiredLane = threat ? this.chooseSafestLane() : this.chooseObjectiveLane();
    if (!Number.isInteger(this.targetLane) || this.targetLane < 0 || this.targetLane >= this.laneCenters.length) {
      return desiredLane;
    }

    if (desiredLane === this.targetLane) {
      return desiredLane;
    }

    const currentLaneX = this.laneCenters[this.targetLane];
    const desiredLaneX = this.laneCenters[desiredLane];
    if (Math.abs(this.player.sprite.x - currentLaneX) > LANE_TARGET_DEAD_ZONE * 1.8) {
      return this.targetLane;
    }

    const currentScore = this.scoreLane(currentLaneX);
    const desiredScore = this.scoreLane(desiredLaneX);
    return desiredScore >= currentScore + LANE_SWITCH_MARGIN ? desiredLane : this.targetLane;
  }

  chooseSafestLane() {
    let bestLane = 0;
    let bestScore = -Infinity;
    for (let lane = 0; lane < this.laneCenters.length; lane += 1) {
      const laneX = this.laneCenters[lane];
      const score = this.scoreLane(laneX);
      if (score > bestScore) {
        bestScore = score;
        bestLane = lane;
      }
    }

    return bestLane;
  }

  scoreLane(laneX) {
    let score = -Math.abs(laneX - this.player.sprite.x) * 0.01;
    const median = this.scene.roadSystem?.getMedianHazards?.()[0];
    if (median) {
      const laneClearance = Math.min(Math.abs(laneX - median.left), Math.abs(laneX - median.right));
      if (laneX > median.left && laneX < median.right) {
        score -= 1000;
      } else if (laneClearance < 34) {
        score -= 180;
      }
    }
    const hazards = [
      ...this.trafficSystem.vehicles,
      ...this.combatSystem.enemies,
      ...this.supportSystem.vans.filter((van) => van.isDecoy),
    ];

    for (const hazard of hazards) {
      const dy = hazard.sprite.y - this.player.sprite.y;
      if (dy < -LOOKAHEAD_Y || dy > SAFE_DISTANCE_Y) {
        continue;
      }

      const xDistance = Math.abs(hazard.sprite.x - laneX);
      if (xDistance < 34) {
        score -= 220 - Math.abs(dy);
      } else if (xDistance < 68) {
        score -= 45;
      }
    }

    return score;
  }

  chooseTargetY(threat) {
    if (threat && threat.sprite.y < this.player.sprite.y) {
      return this.player.sprite.y + 72;
    }

    const support = this.supportSystem.vans.find((van) => !van.isDecoy && Math.abs(van.sprite.x - this.targetX) < 34);
    if (support && support.sprite.y > 40 && support.sprite.y < this.player.sprite.y) {
      return support.sprite.y + 42;
    }

    return this.scene.scale.height - 125;
  }

  shouldFire() {
    const decoy = this.supportSystem.vans.find((van) => {
      return van.isDecoy && this.isAlignedAhead(van.sprite, 34, 310);
    });
    if (decoy) {
      return true;
    }

    return Boolean(this.findShootableEnemy());
  }

  findShootableEnemy() {
    return this.combatSystem.enemies.find((enemy) => this.isAlignedAhead(enemy.sprite, 28, 360));
  }

  findImmediateThreat() {
    const hazards = [
      ...this.trafficSystem.vehicles,
      ...this.combatSystem.enemies,
      ...this.supportSystem.vans.filter((van) => van.isDecoy),
    ];

    return hazards.find((hazard) => {
      const dy = hazard.sprite.y - this.player.sprite.y;
      return dy > -LOOKAHEAD_Y && dy < SAFE_DISTANCE_Y && Math.abs(hazard.sprite.x - this.player.sprite.x) < 32;
    });
  }

  isAlignedAhead(sprite, xTolerance, yRange) {
    const dy = this.player.sprite.y - sprite.y;
    return dy > 0 && dy < yRange && Math.abs(sprite.x - this.player.sprite.x) < xTolerance;
  }

  nearestLane(x) {
    let nearest = 0;
    let bestDistance = Infinity;
    for (let lane = 0; lane < this.laneCenters.length; lane += 1) {
      const distance = Math.abs(this.laneCenters[lane] - x);
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = lane;
      }
    }
    return nearest;
  }

  axisToward(current, target, deadZone) {
    if (Math.abs(current - target) <= deadZone) {
      return 0;
    }

    return current < target ? 1 : -1;
  }
}
