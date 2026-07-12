import { getRoom } from './map.js';
import { updateLog } from './ui.js';
import {
  CLASS_DEFINITIONS,
  getClassDefinition,
  getLevelForXP,
  getNextSkill,
  getNextThresholdForLevel,
  getSkillsForLevel,
  isKnownClass,
  MAX_CLASS_LEVEL
} from './classes.js';

function makeClassRecord(defaultValue) {
  return Object.fromEntries(Object.keys(CLASS_DEFINITIONS).map(className => [className, defaultValue]));
}

export class Player {
  constructor() {
    this.name = 'Player1';
    this.class = 'Adventurer';
    this.level = 1;
    this.experience = 0;
    this.hp = 20;
    this.mp = 10;
    this.str = 1;
    this.dex = 1;
    this.int = 1;
    this.wis = 1;
    this.con = 1;
    this.inventory = [];
    this.equippedItems = {};
    this.currentRoom = 'room1';
    this.classLevels = makeClassRecord(0);
    this.classLevels.Adventurer = 1;
    this.classXP = makeClassRecord(0);
    this.hazardMemory = {};
    this.survivorLuckUsed = false;
  }

  pickUpItem(item) {
    this.inventory.push(item);
    updateLog(`You picked up the ${item.name}.`);
  }

  equipItem(item) {
    if (item.type === 'weapon' || item.type === 'armor') {
      this.equippedItems[item.type] = item;
      updateLog(`You equipped the ${item.name}.`);
    }
  }

  unequipItem(item) {
    if (this.equippedItems[item.type] === item) {
      delete this.equippedItems[item.type];
      updateLog(`You unequipped the ${item.name}.`);
    }
  }

  isEquipped(item) {
    return this.equippedItems[item.type] === item;
  }

  dropItem(item) {
    this.inventory = this.inventory.filter(i => i !== item);
    this.dropItemInRoom(item);
  }

  dropItemInRoom(item) {
    const currentRoom = getRoom(this.currentRoom);
    if (!currentRoom.items) {
      currentRoom.items = [];
    }
    currentRoom.items.push(item.id);
    updateLog(`You dropped ${item.name}.`);
  }

  hasItemsInInventory() {
    return this.inventory.length > 0;
  }

  changeClass(newClass) {
    if (!isKnownClass(newClass)) {
      return `The path of ${newClass} is unknown.`;
    }
    this.ensureClassProgress(newClass);
    if (this.classLevels[newClass] === 0) {
      this.classLevels[newClass] = 1;
    }
    this.class = newClass;
    return `You take up the path of the ${newClass}. ${getClassDefinition(newClass).role} becomes your discipline.`;
  }

  ensureClassProgress(className) {
    if (!isKnownClass(className)) return;
    if (!this.classLevels) this.classLevels = makeClassRecord(0);
    if (!this.classXP) this.classXP = makeClassRecord(0);
    if (this.classLevels[className] === undefined) this.classLevels[className] = className === 'Adventurer' ? 1 : 0;
    if (this.classXP[className] === undefined) this.classXP[className] = 0;
  }

  gainClassXP(amount, reason = '') {
    const className = this.class;
    this.ensureClassProgress(className);
    const multiplier = this.hasClassFeature('Quick Study') ? 1.15 : 1;
    const awarded = Math.max(1, Math.round(amount * multiplier));
    this.classXP[className] += awarded;
    const before = this.classLevels[className];
    const after = this.checkClassLevelUp(className);
    return {
      className,
      amount: awarded,
      reason,
      leveledUp: after > before,
      level: after
    };
  }

  getClassLevel(className) {
    this.ensureClassProgress(className);
    return this.classLevels[className] || 0;
  }

  getActiveClassLevel() {
    return this.getClassLevel(this.class);
  }

  getClassXP(className) {
    this.ensureClassProgress(className);
    return this.classXP[className] || 0;
  }

  getNextClassThreshold(className) {
    return getNextThresholdForLevel(this.getClassLevel(className));
  }

  checkClassLevelUp(className) {
    this.ensureClassProgress(className);
    const currentLevel = this.classLevels[className];
    if (currentLevel >= MAX_CLASS_LEVEL) return currentLevel;
    const xpLevel = getLevelForXP(this.classXP[className]);
    this.classLevels[className] = Math.max(currentLevel, Math.min(MAX_CLASS_LEVEL, xpLevel));
    if (this.classLevels[className] === 0 && className === 'Adventurer') this.classLevels[className] = 1;
    return this.classLevels[className];
  }

  getActiveClassDefinition() {
    return getClassDefinition(this.class);
  }

  getUnlockedClassSkills(className = this.class) {
    return getSkillsForLevel(className, this.getClassLevel(className));
  }

  hasClassFeature(featureName, className = this.class) {
    return this.getUnlockedClassSkills(className).includes(featureName);
  }

  hasAnyClassFeature(featureNames, className = this.class) {
    return featureNames.some(featureName => this.hasClassFeature(featureName, className));
  }

  resistsHazard(hazardTag) {
    return this.getActiveClassDefinition().hazardAffinities.includes(hazardTag);
  }

  getHazardResponse(hazardTag) {
    return this.getHazardResponseDetail(hazardTag).response;
  }

  getHazardResponseDetail(hazardTag) {
    if (!hazardTag) return { response: 'none', feature: null };
    if (this.hasClassFeature("Consecrated Step") && hazardTag === "reliquary") return { response: 'avoid', feature: "Consecrated Step" };
    if (this.hasClassFeature("Pathwise") && ["wilderness", "swamp", "mountain"].includes(hazardTag)) return { response: 'reduce', feature: "Pathwise" };
    if (this.hasClassFeature("Trap Sense") && ["dangerous_pickup", "relic_trap", "suspicious_object", "mechanism", "unstable_floor"].includes(hazardTag)) return { response: 'reduce', feature: "Trap Sense", flatReduction: 1 };
    if (this.hasClassFeature("Trap Sense") && ["trap", "lock", "search"].includes(hazardTag)) return { response: 'interpret', feature: "Trap Sense" };
    if (this.hasClassFeature("Slip Free") && ["snare", "grasping", "adhesive", "bloodmoss"].includes(hazardTag)) return { response: 'reduce', feature: "Slip Free", flatReduction: 2 };
    if (this.hasClassFeature("Iron Nerve") && ["physical", "fear", "willpower"].includes(hazardTag)) return { response: 'reduce', feature: "Iron Nerve", flatReduction: 2 };
    if (this.hasClassFeature("Brace") && ["impact", "collapse"].includes(hazardTag)) return { response: 'reduce', feature: "Brace" };
    if (this.hasClassFeature("Arcane Sight") && ["arcane", "rune", "illusion"].includes(hazardTag)) return { response: 'interpret', feature: "Arcane Sight" };
    if (this.hasClassFeature("Minor Ward") && ["arcane", "rune", "fire", "relic"].includes(hazardTag)) return { response: 'reduce', feature: "Minor Ward", flatReduction: 2 };
    if (this.hasClassFeature("Glass Memory") && hazardTag === "mountain_glass") return { response: 'reduce', feature: "Glass Memory" };
    if (this.hasClassFeature("Blessing") && hazardTag === "sacred") return { response: 'reduce', feature: "Blessing", flatReduction: 2 };
    if (this.hasClassFeature("Speak the Rite") && ["sacred", "reliquary"].includes(hazardTag)) return { response: 'interpret', feature: "Speak the Rite" };
    if (this.hasClassFeature("Versatile") && hazardTag === "forced_route" && !this.hazardMemory.versatile_forced_route_used) {
      return { response: 'reduce', feature: "Versatile", flatReduction: 1, memoryFlag: "versatile_forced_route_used" };
    }
    if (this.hasClassFeature("Versatile") && ["minor", "generic"].includes(hazardTag)) return { response: 'reduce', feature: "Versatile" };
    if (this.hasClassFeature("Hard Lessons") && hazardTag === "forced_route" && this.hazardMemory.forced_route && !this.hazardMemory.hard_lessons_forced_route_used) {
      return { response: 'reduce', feature: "Hard Lessons", flatReduction: 1, memoryFlag: "hard_lessons_forced_route_used" };
    }
    return { response: this.resistsHazard(hazardTag) ? 'interpret' : 'none', feature: null };
  }

  rememberHazard(hazardTag) {
    if (hazardTag) this.hazardMemory[hazardTag] = true;
  }

  getNextClassSkill(className = this.class) {
    return getNextSkill(className, this.getClassLevel(className));
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
  }

  takeHazardDamage(amount) {
    if (amount >= this.hp && this.hasClassFeature("Survivor's Luck") && !this.survivorLuckUsed) {
      this.hp = 1;
      this.survivorLuckUsed = true;
      return { survivedByLuck: true };
    }
    this.takeDamage(amount);
    return { survivedByLuck: false };
  }

  heal(amount) {
    this.hp = Math.min(20, this.hp + amount);
  }

  restore(data = {}) {
    this.name = data.name || this.name;
    this.class = data.class || this.class;
    this.level = data.level ?? this.level;
    this.experience = data.experience ?? this.experience;
    this.hp = data.hp ?? this.hp;
    this.mp = data.mp ?? this.mp;
    this.str = data.str ?? this.str;
    this.dex = data.dex ?? this.dex;
    this.int = data.int ?? this.int;
    this.wis = data.wis ?? this.wis;
    this.con = data.con ?? this.con;
    this.currentRoom = data.currentRoom || this.currentRoom;
    this.inventory = data.inventory || [];
    this.equippedItems = data.equippedItems || {};
    this.classLevels = { ...makeClassRecord(0), ...(data.classLevels || {}) };
    this.classXP = { ...makeClassRecord(0), ...(data.classXP || {}) };
    this.hazardMemory = { ...(data.hazardMemory || {}) };
    this.survivorLuckUsed = Boolean(data.survivorLuckUsed);
    if (!this.classLevels.Adventurer) this.classLevels.Adventurer = 1;
    this.ensureClassProgress(this.class);
  }
}
