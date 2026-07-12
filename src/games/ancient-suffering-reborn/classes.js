export const CLASS_LEVEL_THRESHOLDS = {
  1: 0,
  2: 50,
  3: 125,
  4: 250,
  5: 450
};

export const MAX_CLASS_LEVEL = 5;

export const CLASS_DEFINITIONS = {
  Adventurer: {
    id: "Adventurer",
    displayName: "Adventurer",
    description: "A survivor with no sworn path, adaptable but unfocused.",
    role: "General survival",
    trainerName: null,
    hazardAffinities: ["minor", "generic"],
    passiveFeatures: ["Versatile", "Quick Study", "Improvised Tools", "Hard Lessons", "Survivor's Luck"],
    skillsByLevel: {
      1: ["Versatile"],
      2: ["Quick Study"],
      3: ["Improvised Tools"],
      4: ["Hard Lessons"],
      5: ["Survivor's Luck"]
    },
    eventTags: ["minor", "generic", "search"]
  },
  Warrior: {
    id: "Warrior",
    displayName: "Warrior",
    description: "A disciplined path built around endurance, nerve, and physical danger.",
    role: "Physical hazard mitigation",
    trainerName: "Old Trainer",
    hazardAffinities: ["physical", "impact", "collapse", "fear"],
    passiveFeatures: ["Iron Nerve", "Brace", "Pain Tolerance", "Hold the Line", "Unbroken"],
    skillsByLevel: {
      1: ["Iron Nerve"],
      2: ["Brace"],
      3: ["Pain Tolerance"],
      4: ["Hold the Line"],
      5: ["Unbroken"]
    },
    eventTags: ["physical", "impact", "collapse", "fear"]
  },
  Rogue: {
    id: "Rogue",
    displayName: "Rogue",
    description: "A path of quiet movement, hidden mechanisms, and dangerous searches.",
    role: "Trap/search consequence avoidance",
    trainerName: "Shady Character",
    hazardAffinities: ["trap", "lock", "ambush", "search"],
    passiveFeatures: ["Trap Sense", "Quiet Step", "Keen Search", "Slip Free", "Vanish from Notice"],
    skillsByLevel: {
      1: ["Trap Sense"],
      2: ["Quiet Step"],
      3: ["Keen Search"],
      4: ["Slip Free"],
      5: ["Vanish from Notice"]
    },
    eventTags: ["trap", "lock", "ambush", "search"]
  },
  Mage: {
    id: "Mage",
    displayName: "Mage",
    description: "A path of warding, pattern-reading, and arcane interpretation.",
    role: "Arcane interpretation and warding",
    trainerName: "Cranky Wizard",
    hazardAffinities: ["arcane", "rune", "mountain_glass", "illusion"],
    passiveFeatures: ["Arcane Sight", "Minor Ward", "Read the Pattern", "Glass Memory", "Sever the Hex"],
    skillsByLevel: {
      1: ["Arcane Sight"],
      2: ["Minor Ward"],
      3: ["Read the Pattern"],
      4: ["Glass Memory"],
      5: ["Sever the Hex"]
    },
    eventTags: ["arcane", "rune", "mountain_glass", "illusion"]
  },
  Cleric: {
    id: "Cleric",
    displayName: "Cleric",
    description: "A sacred path for ash, curses, death, and old rites.",
    role: "Sacred/cursed/ash mitigation",
    trainerName: "Smiling Priest",
    hazardAffinities: ["ash", "reliquary", "cursed", "sacred", "death"],
    passiveFeatures: ["Consecrated Step", "Blessing", "Speak the Rite", "Turn Profane", "Last Prayer"],
    skillsByLevel: {
      1: ["Consecrated Step"],
      2: ["Blessing"],
      3: ["Speak the Rite"],
      4: ["Turn Profane"],
      5: ["Last Prayer"]
    },
    eventTags: ["ash", "reliquary", "cursed", "sacred", "death"]
  },
  Ranger: {
    id: "Ranger",
    displayName: "Ranger",
    description: "A wilderness path for marshes, weather, beasts, and hard travel.",
    role: "Wilderness/swamp/mountain survival",
    trainerName: "Grizzled Veteran",
    hazardAffinities: ["wilderness", "swamp", "weather", "beast", "mountain"],
    passiveFeatures: ["Pathwise", "Forager", "Weather Eye", "Beast Sense", "No Trail Lost"],
    skillsByLevel: {
      1: ["Pathwise"],
      2: ["Forager"],
      3: ["Weather Eye"],
      4: ["Beast Sense"],
      5: ["No Trail Lost"]
    },
    eventTags: ["wilderness", "swamp", "weather", "beast", "mountain"]
  }
};

export function isKnownClass(className) {
  return Boolean(CLASS_DEFINITIONS[className]);
}

export function getClassDefinition(className) {
  return CLASS_DEFINITIONS[className] || CLASS_DEFINITIONS.Adventurer;
}

export function getLevelForXP(xp) {
  let level = 1;
  for (let candidate = 1; candidate <= MAX_CLASS_LEVEL; candidate++) {
    if (xp >= CLASS_LEVEL_THRESHOLDS[candidate]) level = candidate;
  }
  return level;
}

export function getNextThresholdForLevel(level) {
  if (level >= MAX_CLASS_LEVEL) return null;
  return CLASS_LEVEL_THRESHOLDS[level + 1];
}

export function getSkillsForLevel(className, level) {
  const definition = getClassDefinition(className);
  const skills = [];
  for (let current = 1; current <= level; current++) {
    skills.push(...(definition.skillsByLevel[current] || []));
  }
  return skills;
}

export function getNextSkill(className, level) {
  if (level >= MAX_CLASS_LEVEL) return null;
  return getClassDefinition(className).skillsByLevel[level + 1]?.[0] || null;
}
