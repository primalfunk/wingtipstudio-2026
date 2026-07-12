import { choice, shuffle } from "../core/random.js";

export class RegionAssignment {
  constructor(gameMap, locations) {
    this.map = gameMap;
    this.locations = locations;
  }

  assignRegions() {
    const unassigned = new Set(this.map.rooms.keys());
    for (const [region, data] of shuffle(Object.entries(this.locations))) {
      let remaining = Math.min(data.total_zones, unassigned.size);
      while (unassigned.size && remaining > 0) {
        const startPos = choice([...unassigned]);
        remaining -= this.growRegion(startPos, region, unassigned, remaining);
      }
    }
    this.adjustRegionBorders();
  }

  growRegion(startPos, region, unassigned, maxSize) {
    const queue = [startPos];
    let grown = 0;
    while (queue.length && grown < maxSize) {
      const pos = queue.shift();
      if (!unassigned.has(pos)) continue;
      this.assignRoom(pos, region, unassigned);
      grown += 1;
      for (const neighbor of this.getAdjacentPositions(pos)) {
        if (unassigned.has(neighbor)) queue.push(neighbor);
      }
    }
    return grown;
  }

  assignRoom(pos, region, unassigned) {
    const room = this.map.rooms.get(pos);
    room.region = region;
    room.name = choice(this.locations[region].zone_names);
    unassigned.delete(pos);
  }

  adjustRegionBorders() {
    const unassigned = new Set([...this.map.rooms.entries()].filter(([, room]) => !room.region).map(([pos]) => pos));
    let guard = 0;
    while (unassigned.size && guard < this.map.rooms.size) {
      for (const pos of [...unassigned]) this.adjustRoomRegion(pos, unassigned);
      guard += 1;
    }
  }

  adjustRoomRegion(pos, unassigned) {
    let bestRegion = null;
    let maxNeighbors = 0;
    for (const neighborPos of this.getAdjacentPositions(pos)) {
      const neighbor = this.map.rooms.get(neighborPos);
      if (!neighbor?.region) continue;
      const count = this.getAdjacentPositions(neighborPos)
        .map((p) => this.map.rooms.get(p))
        .filter((room) => room?.region === neighbor.region).length;
      if (count > maxNeighbors) {
        maxNeighbors = count;
        bestRegion = neighbor.region;
      }
    }
    if (bestRegion) this.assignRoom(pos, bestRegion, unassigned);
  }

  getAdjacentPositions(pos) {
    const [x, y] = pos.split(",").map(Number);
    return [[x, y - 1], [x, y + 1], [x + 1, y], [x - 1, y]]
      .map(([nx, ny]) => `${nx},${ny}`)
      .filter((key) => this.map.rooms.has(key));
  }
}
