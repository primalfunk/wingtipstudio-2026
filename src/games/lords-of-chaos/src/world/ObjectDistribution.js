import { sample, shuffle } from "../core/random.js";

export class ObjectDistribution {
  constructor(gameMap, objectData) {
    this.map = gameMap;
    this.toolData = objectData.tools;
    this.weaponData = sample(objectData.weapons, 1);
    this.armorData = sample(objectData.armor, 1);
    this.artifactData = sample(objectData.artifacts, 1);
    this.allItems = [...this.artifactData, ...this.weaponData, ...this.armorData, ...shuffle(this.toolData)];
  }

  distributeItems() {
    const deadEnds = shuffle([...this.map.rooms.values()].filter((room) => {
      return Object.values(room.connections).filter(Boolean).length === 1;
    }));
    const nonDeadEnds = shuffle([...this.map.rooms.values()].filter((room) => {
      return Object.values(room.connections).filter(Boolean).length !== 1;
    }));
    const placementRooms = [...nonDeadEnds, ...deadEnds];
    for (const item of this.allItems) {
      const room = placementRooms.pop();
      if (!room) break;
      this.map.roomsWithKeys.push(room);
      room.decorations.push(item);
    }
    this.map.roomConnector.clearRemainingDeadEnds();
  }

  getCategoryLetter(item) {
    if (this.toolData.includes(item)) return "T";
    if (this.weaponData.includes(item)) return "W";
    if (this.armorData.includes(item)) return "A";
    if (this.artifactData.includes(item)) return "K";
    return "";
  }
}
