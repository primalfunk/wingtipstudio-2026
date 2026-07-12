import { randint } from "../core/random.js";
import { Inventory } from "./Inventory.js";

export class Player {
  constructor(startRoom, gameManager, level = 1) {
    this.gameManager = gameManager;
    this.name = "PLAYER";
    this.level = Math.max(level, 1);
    this.currentRoom = startRoom;
    this.x = startRoom.x;
    this.y = startRoom.y;
    this.inCombat = false;
    this.gotRelic = false;
    this.hasMap = false;
    this.hasCompass = false;
    this.visibilityRadius = 3;
    this.previousRooms = [];
    this.mpRegenStepCounter = 0;
    this.mpRegenCombatCounter = 0;
    this.initializeStats();
    this.inventory = new Inventory(this, gameManager);
    this.equippedWeapon = null;
    this.equippedArmor = null;
    this.weaponBonus = 0;
    this.armorBonus = 0;
    this.gearBonuses = new Map();
  }

  initializeStats() {
    this.atk = 10;
    this.defn = 5;
    this.int = 10;
    this.wis = 10;
    this.con = 10;
    this.eva = 10;
    this.exp = 0;
    this.maxHp = 20;
    this.maxMp = 10;
    this.hp = this.maxHp;
    this.mp = this.maxMp;
  }

  canMove(direction) {
    return Boolean(this.currentRoom.connections[direction]) && this.hp > 0;
  }

  moveToRoom(room) {
    if (!this.previousRooms.includes(room) && this.hp < this.maxHp) {
      let healing = 1;
      if (this.gameManager.level === 1) healing = 3;
      else if (this.gameManager.level === 2) healing = 2;
      else if (this.gameManager.level === 3 && Math.random() < 0.5) healing = 2;
      else if (this.gameManager.level <= 10) healing = 2;
      else if (this.gameManager.level <= 20) healing = 3;
      else if (this.gameManager.level <= 30) healing = 4;
      else if (this.gameManager.level <= 40) healing = 4;
      else healing = Math.min(7, 4 + Math.floor((this.gameManager.level - 40) / 20));
      this.hp = Math.min(this.maxHp, this.hp + healing);
    }
    this.previousRooms.push(this.currentRoom);
    if (this.previousRooms.length > 4) this.previousRooms.shift();
    this.currentRoom = room;
    this.x = room.x;
    this.y = room.y;
  }

  regenerateMp(source = "movement") {
    const interval = source === "combat" ? 3 : 2;
    const counterName = source === "combat" ? "mpRegenCombatCounter" : "mpRegenStepCounter";
    this[counterName] += 1;
    if (this[counterName] < interval || this.mp >= this.maxMp) return false;
    this[counterName] = 0;
    this.mp = Math.min(this.maxMp, this.mp + 1);
    return true;
  }

  equipItem(item, category) {
    if (category === "W") {
      if (this.equippedWeapon) this.unequipItem(this.equippedWeapon, "W");
      this.equippedWeapon = item;
      this.weaponBonus = this.getGearBonus(item);
      this.atk += this.weaponBonus;
    }
    if (category === "A") {
      if (this.equippedArmor) this.unequipItem(this.equippedArmor, "A");
      this.equippedArmor = item;
      this.armorBonus = this.getGearBonus(item);
      this.defn += this.armorBonus;
    }
    this.currentRoom.decorations = this.currentRoom.decorations.filter((candidate) => candidate !== item);
  }

  unequipItem(item, category) {
    if (category === "W") {
      this.equippedWeapon = null;
      this.atk -= this.weaponBonus;
      this.weaponBonus = 0;
    }
    if (category === "A") {
      this.equippedArmor = null;
      this.defn -= this.armorBonus;
      this.armorBonus = 0;
    }
    this.currentRoom.decorations.push(item);
  }

  getGearBonus(item) {
    if (!this.gearBonuses.has(item)) this.gearBonuses.set(item, randint(3, 8));
    return this.gearBonuses.get(item);
  }

  checkLevelUp() {
    return this.level < 100 && this.exp >= this.expRequirement();
  }

  expRequirement() {
    const baseExp = 85;
    const targetExpAt100 = 1000000;
    const growth = (targetExpAt100 / baseExp) ** (1 / 98);
    let cumulative = 0;
    for (let lvl = 1; lvl <= this.level; lvl += 1) cumulative += Math.floor(baseExp * growth ** (lvl - 1));
    return cumulative;
  }

  levelUp() {
    this.level += 1;
    const increases = {};
    for (const [stat, initial, max] of [["maxHp", 20, 999], ["maxMp", 10, 999], ["atk", 10, 255], ["defn", 5, 255], ["int", 10, 255], ["wis", 10, 255], ["con", 10, 255], ["eva", 10, 255]]) {
      const growth = (max - initial) / 99;
      const expected = initial + growth * (this.level - 1);
      const increase = Math.max(1, Math.min(max - this[stat], Math.floor(expected - this[stat] + randint(1, 3))));
      this[stat] += increase;
      increases[stat] = increase;
    }
    const conHpBonus = Math.floor(this.con / 5);
    const previousMaxHp = this.maxHp;
    this.maxHp = Math.min(999, this.maxHp + conHpBonus);
    increases.maxHp += this.maxHp - previousMaxHp;
    this.hp = this.maxHp;
    this.mp = this.maxMp;
    return increases;
  }
}
