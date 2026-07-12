import { randint } from "../core/random.js";

export class Enemy {
  constructor(startRoom, level, tier = "baseline") {
    this.id = 0;
    this.name = "";
    this.level = Math.max(level, 1);
    this.tier = tier;
    this.x = startRoom.x;
    this.y = startRoom.y;
    this.currentRoom = startRoom;
    this.speed = 2;
    this.aggro = false;
    this.inCombat = false;
    this.currentRoom.enemies.push(this);
    this.initializeStatsToLevel(this.level, tier);
  }

  initializeStatsToLevel(level, tier) {
    if (level === 1) {
      const presets = {
        weak: { hp: [10, 12], atk: [8, 9], defn: [3, 4], int: [9, 10], wis: [8, 9], eva: [4, 5] },
        baseline: { hp: [12, 14], atk: [11, 12], defn: [4, 5], int: [11, 12], wis: [10, 11], eva: [5, 6] },
        strong: { hp: [15, 17], atk: [12, 13], defn: [5, 6], int: [12, 13], wis: [11, 12], eva: [6, 7] },
      };
      const preset = presets[tier] ?? presets.baseline;
      this.atk = randint(...preset.atk);
      this.defn = randint(...preset.defn);
      this.int = randint(...preset.int);
      this.wis = randint(...preset.wis);
      this.con = randint(5, 10);
      this.eva = randint(...preset.eva);
      this.maxHp = randint(...preset.hp);
    } else {
      this.atk = randint(5, 10);
      this.defn = randint(5, 10);
      this.int = randint(5, 10);
      this.wis = randint(5, 10);
      this.con = randint(5, 10);
      this.eva = randint(5, 10);
      this.maxHp = 20;
    }
    this.exp = level <= 3 ? randint(20, 25) : 25 * Math.max(1, Math.floor(level / 3));
    this.maxMp = 10;
    for (let lvl = 2; lvl <= level; lvl += 1) {
      for (const [stat, initial, max] of [["maxHp", 18, 1200], ["maxMp", 10, 999], ["atk", 10, 255], ["defn", 10, 255], ["int", 10, 255], ["wis", 10, 255], ["con", 10, 255], ["eva", 10, 200]]) {
        this[stat] += this.calculateStatIncrease(this[stat], initial, max, lvl);
      }
    }
    this.hp = this.maxHp;
    this.mp = this.maxMp;
  }

  calculateStatIncrease(current, initial, max, level) {
    const growth = (max - initial) / 99;
    const expected = initial + growth * (level - 1);
    return Math.max(0, Math.min(max - current, Math.floor(expected - current)));
  }

  canMove(direction) {
    return Boolean(this.currentRoom.connections[direction]);
  }

  moveToRoom(room) {
    this.currentRoom.enemies = this.currentRoom.enemies.filter((enemy) => enemy !== this);
    this.currentRoom = room;
    this.x = room.x;
    this.y = room.y;
    room.enemies.push(this);
  }

  checkAggro(player, radius = 5) {
    this.aggro = Math.hypot(this.x - player.x, this.y - player.y) <= radius;
  }

  findPathToPlayer(player, gameMap) {
    const start = this.currentRoom;
    const target = player.currentRoom;
    const open = new Set([start]);
    const closed = new Set();
    const g = new Map([...gameMap.rooms.values()].map((room) => [room, Infinity]));
    const f = new Map([...gameMap.rooms.values()].map((room) => [room, Infinity]));
    const parent = new Map();
    g.set(start, 0);
    f.set(start, this.heuristic(start, target));
    while (open.size) {
      const current = [...open].sort((a, b) => f.get(a) - f.get(b))[0];
      if (current === target) return this.reconstructPath(parent, current);
      open.delete(current);
      closed.add(current);
      for (const neighbor of Object.values(current.connections).filter(Boolean)) {
        if (closed.has(neighbor)) continue;
        const tentative = g.get(current) + 1;
        if (tentative < g.get(neighbor)) {
          parent.set(neighbor, current);
          g.set(neighbor, tentative);
          f.set(neighbor, tentative + this.heuristic(neighbor, target));
          open.add(neighbor);
        }
      }
    }
    return [];
  }

  heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  reconstructPath(parent, current) {
    const path = [];
    while (current && parent.has(current)) {
      path.push(current);
      current = parent.get(current);
    }
    return path.reverse();
  }
}
