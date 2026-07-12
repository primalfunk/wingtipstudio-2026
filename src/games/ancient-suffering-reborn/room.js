export class Room {
    constructor(title, description, exits) {
      this.title = title;
      this.description = description;
      this.exits = exits;
      this.npcs = [];
    }
  
    addNPC(npc) {
      this.npcs.push(npc);
    }
  }
  