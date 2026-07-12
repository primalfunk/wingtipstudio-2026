import { choice, shuffle } from "../core/random.js";

const DELTAS = {
  n: [0, -1],
  s: [0, 1],
  e: [1, 0],
  w: [-1, 0],
};

export class RoomConnector {
  constructor(gameMap) {
    this.map = gameMap;
    this.rooms = gameMap.rooms;
    this.establishInitialConnections();
    this.ensureConnectivity();
    this.removeInvalidConnections();
  }

  key(x, y) {
    return `${x},${y}`;
  }

  getAdjacentRoom(room, direction) {
    const [dx, dy] = DELTAS[direction];
    return this.rooms.get(this.key(room.x + dx, room.y + dy)) ?? null;
  }

  getAdjacentRooms(room) {
    return Object.keys(DELTAS).map((direction) => this.getAdjacentRoom(room, direction)).filter(Boolean);
  }

  establishInitialConnections() {
    const start = this.rooms.values().next().value;
    if (start) this.randomizedDfs(start, null, 0, new Set());
  }

  randomizedDfs(currentRoom, previousDirection, straightPathCount, visited) {
    visited.add(currentRoom);
    for (const direction of shuffle(["n", "e", "s", "w"])) {
      const nextRoom = this.getAdjacentRoom(currentRoom, direction);
      if (!nextRoom || visited.has(nextRoom)) continue;
      const nextStraightCount = direction === previousDirection ? straightPathCount + 1 : 0;
      if (nextStraightCount <= 4) {
        this.establishConnection(currentRoom, nextRoom);
        this.randomizedDfs(nextRoom, direction, nextStraightCount, visited);
      }
    }
  }

  establishConnection(roomA, roomB) {
    if (roomA === roomB) return;
    if (roomA.x === roomB.x) roomA.connect(roomA.y < roomB.y ? "s" : "n", roomB);
    if (roomA.y === roomB.y) roomA.connect(roomA.x < roomB.x ? "e" : "w", roomB);
  }

  ensureConnectivity() {
    const start = this.rooms.values().next().value;
    if (!start) return;
    const visited = this.walkConnected(start);
    for (const room of this.rooms.values()) {
      if (visited.has(room)) continue;
      const nearest = this.findNearestConnectedRoom(room, visited);
      if (nearest) this.establishConnection(room, nearest);
    }
  }

  walkConnected(start) {
    const visited = new Set();
    const queue = [start];
    while (queue.length) {
      const room = queue.shift();
      if (visited.has(room)) continue;
      visited.add(room);
      Object.values(room.connections).forEach((nextRoom) => {
        if (nextRoom && !visited.has(nextRoom)) queue.push(nextRoom);
      });
    }
    return visited;
  }

  findNearestConnectedRoom(room, connectedRooms) {
    const queue = [room];
    const visited = new Set([room]);
    while (queue.length) {
      const current = queue.shift();
      for (const neighbor of this.getAdjacentRooms(current)) {
        if (visited.has(neighbor)) continue;
        if (connectedRooms.has(neighbor)) return neighbor;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
    return null;
  }

  removeInvalidConnections() {
    for (const room of this.rooms.values()) {
      for (const direction of Object.keys(room.connections)) {
        if (room.connections[direction] && ![...this.rooms.values()].includes(room.connections[direction])) {
          room.connections[direction] = null;
        }
      }
    }
  }

  clearRemainingDeadEnds() {
    const protectedRooms = new Set(this.map.roomsWithKeys);
    const deadEnds = [...this.rooms.values()].filter((room) => {
      return !protectedRooms.has(room) && Object.values(room.connections).filter(Boolean).length === 1;
    });
    for (const room of deadEnds) {
      const potentials = ["n", "s", "e", "w"]
        .map((direction) => [this.getAdjacentRoom(room, direction), direction])
        .filter(([adjacent, direction]) => adjacent && !room.connections[direction]);
      if (potentials.length) this.establishConnection(room, choice(potentials)[0]);
    }
  }
}
