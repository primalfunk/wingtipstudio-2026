import { randint } from "../core/random.js";
import { Room } from "./Room.js";
import { RoomConnector } from "./RoomConnector.js";
import { MapElaborator } from "./MapElaborator.js";

export class GameMap {
  constructor(size, words) {
    this.size = size;
    this.words = words;
    this.rooms = new Map();
    this.roomsWithKeys = [];
    this.generateMap();
    new MapElaborator(this, words).elaborate();
  }

  key(x, y) {
    return `${x},${y}`;
  }

  generateMap() {
    this.populateGrid();
    this.irregularizeOutline();
    this.roomConnector = new RoomConnector(this);
  }

  populateGrid() {
    for (let x = 0; x < this.size; x += 1) {
      for (let y = 0; y < this.size; y += 1) {
        this.createRoom(x, y);
      }
    }
  }

  createRoom(x, y) {
    const room = new Room(this.rooms.size + 1, x, y, this);
    this.rooms.set(this.key(x, y), room);
    return room;
  }

  irregularizeOutline() {
    const edges = [
      [...Array(this.size)].map((_, x) => [x, 0]),
      [...Array(this.size)].map((_, x) => [x, this.size - 1]),
      [...Array(this.size)].map((_, y) => [0, y]),
      [...Array(this.size)].map((_, y) => [this.size - 1, y]),
    ];
    edges.forEach((edge) => this.removeEdgeSegments(edge));
  }

  removeEdgeSegments(edge) {
    const segmentLength = randint(2, Math.max(2, Math.floor(this.size / 4)));
    for (let start = 0; start < edge.length; start += segmentLength) {
      if (Math.random() < 0.5) {
        edge.slice(start, start + segmentLength).forEach(([x, y]) => this.rooms.delete(this.key(x, y)));
      }
    }
  }
}
