import { shuffle } from "../core/random.js";

export class RoomAtmos {
  constructor(gameMap, data) {
    this.map = gameMap;
    this.colors = data.adjectives.colors;
    this.atmos = data.atmos;
  }

  createAtmosphere() {
    let colors = shuffle(this.colors);
    let atmos = shuffle(this.atmos);
    for (const room of this.map.rooms.values()) {
      if (!colors.length) colors = shuffle(this.colors);
      if (!atmos.length) atmos = shuffle(this.atmos);
      room.color = colors.pop();
      room.atmo = atmos.pop();
    }
  }
}
