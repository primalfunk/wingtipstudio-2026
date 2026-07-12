import { RegionAssignment } from "./RegionAssignment.js";
import { ObjectDistribution } from "./ObjectDistribution.js";
import { RoomDecoration } from "./RoomDecoration.js";
import { RoomAtmos } from "./RoomAtmos.js";

export class MapElaborator {
  constructor(gameMap, words) {
    this.map = gameMap;
    this.words = words;
  }

  elaborate() {
    new RegionAssignment(this.map, this.words.locations).assignRegions();
    new ObjectDistribution(this.map, this.words.objects).distributeItems();
    new RoomDecoration(this.map, this.words).decorateRooms();
    new RoomAtmos(this.map, this.words).createAtmosphere();
  }
}
