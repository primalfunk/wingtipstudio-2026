import { choice } from "../core/random.js";

export class Room {
  constructor(roomId, x, y, gameMap) {
    this.map = gameMap;
    this.roomId = roomId;
    this.x = x;
    this.y = y;
    this.region = null;
    this.name = "";
    this.connections = { n: null, s: null, e: null, w: null };
    this.lit = 0;
    this.decorations = [];
    this.enemies = [];
    this.atmo = "";
    this.color = "";
    this.isTarget = false;
  }

  connect(direction, room) {
    const opposites = { n: "s", s: "n", e: "w", w: "e" };
    this.connections[direction] = room;
    room.connections[opposites[direction]] = this;
  }

  distanceTo(room) {
    return Math.hypot(this.x - room.x, this.y - room.y);
  }

  getRandomDistantRoom() {
    const minDistance = Math.floor(this.map.size / 2);
    const candidates = [...this.map.rooms.values()].filter((room) => this.distanceTo(room) >= minDistance);
    return candidates.length ? choice(candidates) : null;
  }
}
