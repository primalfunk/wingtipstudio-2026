const RELICS = new Set(["reality amulet", "reality statue", "reality scroll", "reality gemstone", "reality relic"]);
const LIGHT_4 = new Set(["lantern", "torch", "table lamp"]);
const LIGHT_5 = new Set(["flashlight", "glowing rock"]);

export class Inventory {
  constructor(player, gameManager, maxSize = 5) {
    this.player = player;
    this.gameManager = gameManager;
    this.items = [];
    this.maxSize = maxSize;
    this.full = false;
  }

  addItem(item) {
    if (RELICS.has(item) || item.startsWith("reality ")) {
      this.player.currentRoom.decorations = this.player.currentRoom.decorations.filter((candidate) => candidate !== item);
      this.player.gotRelic = true;
      this.gameManager.awardRelicExp();
      this.gameManager.placeExitTargetFrom(this.player.currentRoom);
      this.gameManager.updateLighting();
      return true;
    }
    if (this.items.length >= this.maxSize) {
      this.full = true;
      return false;
    }
    this.items.push(item);
    this.player.currentRoom.decorations = this.player.currentRoom.decorations.filter((candidate) => candidate !== item);
    this.full = false;

    if (LIGHT_4.has(item)) this.player.visibilityRadius = Math.max(this.player.visibilityRadius, 4);
    if (LIGHT_5.has(item)) this.player.visibilityRadius = Math.max(this.player.visibilityRadius, 5);
    if (item === "map") this.gameManager.revealMap();
    if (item === "compass") this.gameManager.revealConnections();
    this.gameManager.updateLighting();
    return true;
  }

  removeItem(item) {
    const index = this.items.indexOf(item);
    if (index < 0) return false;
    this.items.splice(index, 1);
    this.player.currentRoom.decorations.push(item);
    this.full = false;
    this.updateVisibilityRadius();
    return true;
  }

  updateVisibilityRadius() {
    let radius = 3;
    if (this.items.some((item) => LIGHT_4.has(item))) radius = 4;
    if (this.items.some((item) => LIGHT_5.has(item))) radius = 5;
    this.player.visibilityRadius = radius;
  }
}
