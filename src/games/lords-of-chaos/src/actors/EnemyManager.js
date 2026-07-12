import { choice, randint } from "../core/random.js";
import { Enemy } from "./Enemy.js";

export class EnemyManager {
  constructor(gameMap, player, words, options = {}) {
    this.gameMap = gameMap;
    this.player = player;
    this.words = words;
    this.firstRunSafety = Boolean(options.firstRunSafety);
    this.realmLevel = options.realmLevel ?? player.level;
    this.spawnCount = this.getSpawnCount(this.realmLevel);
    this.enemies = [];
    this.startDistances = this.graphDistances(player.currentRoom);
    this.spawnEnemies(this.spawnCount, this.realmLevel);
  }

  getSpawnCount(level) {
    if (level === 1) return 3;
    if (level === 2) return 4;
    const roomCount = this.gameMap.rooms.size;
    const latePressure = Math.min(0.065, 0.05 + Math.floor(Math.max(0, level - 40) / 10) * 0.0025);
    const pressure = level <= 5 ? 0.04 : level <= 10 ? 0.035 : level <= 14 ? 0.045 : level <= 20 ? 0.03 : level <= 24 ? 0.03 : level <= 30 ? 0.025 : level <= 40 ? 0.05 : latePressure;
    return Math.max(4, Math.min(16, Math.round(roomCount * pressure)));
  }

  getAggroRadius() {
    if (this.realmLevel === 1) return 3;
    if (this.realmLevel === 2) return 4;
    if (this.realmLevel <= 5) return 4;
    if (this.realmLevel <= 8) return 4;
    if (this.realmLevel <= 20) return 4;
    if (this.realmLevel <= 30) return 3;
    if (this.realmLevel <= 40) return 5;
    return this.realmLevel <= 70 ? 5 : 6;
  }

  getMovementChance() {
    if (this.realmLevel === 1) return this.player.gotRelic ? 0.75 : 0.65;
    if (this.realmLevel === 2) return this.player.gotRelic ? 0.85 : 0.75;
    if (this.realmLevel <= 5) return this.player.gotRelic ? 0.78 : 0.7;
    if (this.realmLevel <= 8) return this.player.gotRelic ? 0.76 : 0.68;
    if (this.realmLevel <= 20) return this.player.gotRelic ? 0.72 : 0.62;
    if (this.realmLevel <= 30) return this.player.gotRelic ? 0.62 : 0.52;
    if (this.realmLevel <= 40) return this.player.gotRelic ? 0.76 : 0.66;
    const lateBonus = Math.min(0.08, Math.floor(Math.max(0, this.realmLevel - 40) / 10) * 0.015);
    return this.player.gotRelic ? 0.76 + lateBonus : 0.66 + lateBonus;
  }

  getOrientationMoves() {
    if (this.realmLevel === 1) return 8;
    if (this.realmLevel === 2) return 5;
    if (this.realmLevel <= 5) return 3;
    return 3;
  }

  spawnEnemies(count, realmLevel) {
    if (realmLevel === 1) {
      this.spawnLevelOneEnemies(count);
      return;
    }
    if (realmLevel === 3) {
      const openingEnemy = this.placeOpeningEnemy(...this.openingEnemyBand(0.18, 0.34), Math.random() < 0.25 ? "strong" : "baseline");
      if (openingEnemy) this.enemies.push(openingEnemy);
    } else if (realmLevel >= 4 && realmLevel <= 10) {
      const openingTier = realmLevel >= 8 && Math.random() < 0.12 ? "strong" : Math.random() < 0.4 ? "weak" : "baseline";
      const openingEnemy = this.placeOpeningEnemy(...this.openingEnemyBand(0.2, 0.4), openingTier);
      if (openingEnemy) this.enemies.push(openingEnemy);
    }
    for (let index = this.enemies.length; index < count; index += 1) {
      let startRoom = null;
      let tier = null;
      for (let tries = 0; tries < 100; tries += 1) {
        tier = this.determineEnemyTier(randint(0, 100), realmLevel);
        const candidate = choice([...this.gameMap.rooms.values()]);
        if (this.isValidSpawn(candidate, tier, realmLevel)) {
          startRoom = candidate;
          break;
        }
      }
      if (!startRoom) continue;
      const enemyLevel = this.determineEnemyLevel(randint(0, 100), this.player.level, tier, realmLevel);
      const enemy = this.createEnemy(startRoom, enemyLevel, tier, index);
      this.enemies.push(enemy);
    }
  }

  spawnLevelOneEnemies(count) {
    const openingEnemy = this.placeLevelOneOpeningEnemy();
    if (openingEnemy) this.enemies.push(openingEnemy);
    while (this.enemies.length < count) {
      let startRoom = null;
      let tier = null;
      for (let tries = 0; tries < 120; tries += 1) {
        tier = this.determineEnemyTier(randint(0, 100), 1);
        const candidate = choice([...this.gameMap.rooms.values()]);
        if (this.isValidSpawn(candidate, tier, 1)) {
          startRoom = candidate;
          break;
        }
      }
      if (!startRoom) break;
      this.enemies.push(this.createEnemy(startRoom, 1, tier, this.enemies.length));
    }
  }

  placeLevelOneOpeningEnemy() {
    return this.placeOpeningEnemy(...this.openingEnemyBand(0.32, 0.55), Math.random() < 0.6 ? "weak" : "baseline");
  }

  openingEnemyBand(minRatio, maxRatio) {
    const maxReach = Math.max(...this.startDistances.values());
    const minDistance = Math.max(3, Math.floor(maxReach * minRatio));
    const maxDistance = Math.max(minDistance + 1, Math.ceil(maxReach * maxRatio));
    return [minDistance, maxDistance];
  }

  placeOpeningEnemy(minDistance, maxDistance, tier) {
    const distances = this.graphDistances(this.player.currentRoom);
    const candidates = [...this.gameMap.rooms.values()].filter((room) => {
      const distance = distances.get(room);
      return distance >= minDistance && distance <= maxDistance && !room.enemies.length;
    });
    if (!candidates.length) return null;
    const room = candidates
      .map((candidate) => ({ room: candidate, score: Math.abs((minDistance + maxDistance) / 2 - distances.get(candidate)) }))
      .sort((a, b) => a.score - b.score)[0].room;
    const enemy = this.createEnemy(room, this.determineEnemyLevel(randint(0, 100), this.player.level, tier, this.realmLevel), tier, 0);
    if (this.realmLevel >= 3) enemy.speed = 1;
    return enemy;
  }

  createEnemy(startRoom, enemyLevel, tier, id) {
    const enemy = new Enemy(startRoom, enemyLevel, tier);
    enemy.id = id;
    enemy.name = `${tier} ${choice(this.words.adjectives.enemies)} ${choice(this.words.enemies)} (level ${enemy.level})`.replace(/\b\w/g, (c) => c.toUpperCase());
    return enemy;
  }

  determineEnemyTier(indicator, realmLevel) {
    if (realmLevel === 1) {
      if (this.firstRunSafety) {
        if (indicator < 55) return "weak";
        return "baseline";
      }
      if (indicator < 50) return "weak";
      if (indicator < 90) return "baseline";
      return "strong";
    }
    if (realmLevel === 2) {
      if (indicator < 35) return "weak";
      if (indicator < 85) return "baseline";
      return "strong";
    }
    if (realmLevel === 3) return "baseline";
    if (realmLevel <= 5) {
      if (indicator < 30) return "weak";
      if (indicator < 92) return "baseline";
      return "strong";
    }
    if (realmLevel <= 7) {
      if (indicator < 18) return "weak";
      if (indicator < 82) return "baseline";
      return "strong";
    }
    if (realmLevel <= 20) {
      if (indicator < 24) return "weak";
      if (indicator < 90) return "baseline";
      return "strong";
    }
    if (realmLevel <= 30) {
      if (indicator < 28) return "weak";
      if (indicator < 92) return "baseline";
      return "strong";
    }
    if (realmLevel <= 60) {
      if (indicator < 20) return "weak";
      if (indicator < 85) return "baseline";
      return "strong";
    }
    if (realmLevel <= 80) {
      if (indicator < 18) return "weak";
      if (indicator < 82) return "baseline";
      return "strong";
    }
    if (indicator < 15) return "weak";
    if (indicator < 78) return "baseline";
    return "strong";
  }

  determineEnemyLevel(indicator, playerLevel, tier = "baseline", realmLevel = this.realmLevel) {
    if (realmLevel === 1) return 1;
    if (realmLevel === 2) return tier === "strong" ? playerLevel : 1;
    if (realmLevel === 3) return tier === "strong" ? playerLevel : Math.max(1, playerLevel - 1);
    if (realmLevel <= 5) {
      if (tier === "weak") return playerLevel;
      return playerLevel + 2;
    }
    if (realmLevel <= 8) {
      if (tier === "weak") return Math.max(1, playerLevel - 2);
      if (tier === "strong") return realmLevel === 6 ? playerLevel + 1 : playerLevel;
      return realmLevel >= 7 ? playerLevel : Math.max(1, playerLevel - 1);
    }
    if (realmLevel <= 12) {
      if (tier === "weak") return Math.max(1, playerLevel - 2);
      if (tier === "strong") return Math.max(1, playerLevel - 1);
      return Math.max(1, playerLevel - 2);
    }
    if (realmLevel <= 16) {
      if (tier === "weak") return Math.max(1, playerLevel - 3);
      if (tier === "strong") return Math.max(1, playerLevel - 1);
      return Math.max(1, playerLevel - 2);
    }
    if (realmLevel <= 20) {
      if (tier === "weak") return Math.max(1, playerLevel - 3);
      if (tier === "strong") return Math.max(1, playerLevel - 2);
      return Math.max(1, playerLevel - 2);
    }
    if (realmLevel <= 24) {
      if (tier === "weak") return Math.max(1, playerLevel - 8);
      if (tier === "strong") return Math.max(1, playerLevel - 6);
      return Math.max(1, playerLevel - 7);
    }
    if (realmLevel <= 30) {
      if (tier === "weak") return Math.max(1, playerLevel - 10);
      if (tier === "strong") return Math.max(1, playerLevel - 8);
      return Math.max(1, playerLevel - 9);
    }
    if (realmLevel <= 40) {
      if (tier === "weak") return Math.max(1, playerLevel - 9);
      if (tier === "strong") return Math.max(1, playerLevel - 5);
      return Math.max(1, playerLevel - 7);
    }
    const baselineOffset = Math.min(13, 7 + Math.floor((realmLevel - 40) / 10));
    if (tier === "weak") return Math.max(1, playerLevel - (baselineOffset + 2));
    if (tier === "strong") return Math.max(1, playerLevel - Math.max(3, baselineOffset - 2));
    return Math.max(1, playerLevel - baselineOffset);
  }

  manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  graphDistances(startRoom) {
    const distances = new Map([[startRoom, 0]]);
    const queue = [startRoom];
    while (queue.length) {
      const room = queue.shift();
      const nextDistance = distances.get(room) + 1;
      for (const neighbor of Object.values(room.connections).filter(Boolean)) {
        if (distances.has(neighbor)) continue;
        distances.set(neighbor, nextDistance);
        queue.push(neighbor);
      }
    }
    return distances;
  }

  isValidSpawn(room, tier, playerLevel) {
    if (room.decorations.some((item) => item.startsWith("reality "))) return false;
    if (playerLevel === 1) {
      const distanceToPlayer = this.manhattan(room, this.player);
      const graphDistanceToPlayer = this.startDistances.get(room) ?? Infinity;
      const maxReach = Math.max(...this.startDistances.values());
      const minGraphDistance = Math.max(5, Math.floor(maxReach * 0.45));
      const strongGraphDistance = Math.max(minGraphDistance + 2, Math.floor(maxReach * 0.62));
      if (distanceToPlayer < 3) return false;
      if (graphDistanceToPlayer < minGraphDistance) return false;
      if (tier === "strong" && distanceToPlayer < 5) return false;
      if (tier === "strong" && graphDistanceToPlayer < strongGraphDistance) return false;
      if (this.isNearRelic(room, Math.max(2, Math.floor(this.gameMap.size * 0.25))) && graphDistanceToPlayer < Math.floor(maxReach * 0.7)) return false;
      if (this.enemies.some((enemy) => this.manhattan(room, enemy) < 3)) return false;
      return true;
    }
    const spacing = this.gameMap.size <= 12 ? 2 : 3;
    return [this.player, ...this.enemies].every((actor) => Math.abs(room.x - actor.x) > spacing || Math.abs(room.y - actor.y) > spacing);
  }

  isNearRelic(room, distance) {
    const relicRoom = [...this.gameMap.rooms.values()].find((candidate) => candidate.decorations.some((item) => item.startsWith("reality ")));
    return relicRoom ? this.manhattan(room, relicRoom) <= distance : false;
  }

  moveEnemies(moveCount) {
    const pursuingEnabled = moveCount > this.getOrientationMoves();
    this.enemies.forEach((enemy) => enemy.checkAggro(this.player, pursuingEnabled ? this.getAggroRadius() : 0));
    for (const enemy of this.enemies) {
      if (moveCount % enemy.speed !== 0 || Math.random() >= this.getMovementChance()) continue;
      if (enemy.aggro) {
        const next = enemy.findPathToPlayer(this.player, this.gameMap)[0];
        if (next) enemy.moveToRoom(next);
      } else if (enemy.currentRoom !== this.player.currentRoom) {
        const directions = ["n", "s", "e", "w"].filter((direction) => enemy.canMove(direction));
        if (directions.length) enemy.moveToRoom(enemy.currentRoom.connections[choice(directions)]);
      }
    }
  }
}
