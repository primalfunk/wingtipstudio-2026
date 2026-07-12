import { updateLog, showYesNoChoice, disableTraversalButtons, enableTraversalButtons } from './ui.js';
import { MAX_CLASS_LEVEL } from './classes.js';

export class NPC {
  constructor(name, npcClass, levelThresholds, dialogues, type = "generic") {
    this.name = name;
    this.npcClass = npcClass;
    this.levelThresholds = levelThresholds;
    this.dialogues = dialogues;
    this.type = type;
    this.interacted = false;
  }

  interact(player) {
    let greeting = `${this.name}: Greetings, ${player.class}.`;
    if (player.class === this.npcClass) {
      const level = player.getClassLevel(this.npcClass);
      const xp = player.getClassXP(this.npcClass);
      const nextThreshold = player.getNextClassThreshold(this.npcClass);
      return {
        message: nextThreshold
          ? `${greeting} You are level ${level} with ${xp}/${nextThreshold} class XP.`
          : `${greeting} You have mastered this path.`,
        choice: false
      };
    }

    if (player.class !== this.npcClass && player.class !== "Adventurer") {
      return {
        message: `${greeting} Would you like to change your class to ${this.npcClass}?`,
        choice: true
      };
    }

    return {
      message: `${greeting} Would you like to become a ${this.npcClass}?`,
      choice: true
    };
  }
}

export const npcs = {
  npc1: new NPC(
    "Old Trainer",
    "Warrior",
    { 1: 100 },
    { firstInteraction: "Would you like to become a Warrior?" },
    "classTrainer"
  ),
  npc2: new NPC(
    "Shady Character",
    "Rogue",
    { 1: 100 },
    { firstInteraction: "Would you like to become a Rogue?" },
    "classTrainer"
  ),
  npc3: new NPC(
    "Cranky Wizard",
    "Mage",
    { 1: 100 },
    { firstInteraction: "Would you like to become a Mage?" },
    "classTrainer"
  ),
  npc4: new NPC(
    "Smiling Priest",
    "Cleric",
    { 1: 100 },
    { firstInteraction: "Would you like to become a Cleric?" },
    "classTrainer"
  ),
  npc5: new NPC(
    "Grizzled Veteran",
    "Ranger",
    { 1: 100 },
    { firstInteraction: "Would you like to become a Ranger?" },
    "classTrainer"
  ),
  npc6: new NPC(
    "Ashen Sacrist",
    "Cleric",
    { 1: 100 },
    { firstInteraction: "The reliquary threshold answers best to a steady spirit." },
    "classTrainer"
  )
};

export function getNpc(npcId) {
  return npcs[npcId];
}

export function startNpcInteraction(npc, player, gameState) {
  if (npc && typeof npc.interact === 'function') {
      gameState.setState('conversation');
      gameState.lockInput('dialogue');
      disableTraversalButtons();

      const result = npc.interact(player);
      const dialogueLines = buildDialogueSequence(npc, player);

      // Display dialogue and only show the choice overlay if relevant
      displayDialogueSequence(dialogueLines, () => {
          if (result.choice) {
              showYesNoChoice(npc, player, gameState);
          } else {
              gameState.unlockInput();
              enableTraversalButtons(player, gameState);
          }
          gameState.setState('traversal');
      });
  } else {
      console.error("Invalid NPC or missing interact method.");
  }
}

// Refined buildDialogueSequence to recognize player’s current class
function buildDialogueSequence(npc, player) {
  if (player.class === npc.npcClass) {  // Case: Player is already in the NPC's class
      const level = player.getClassLevel(npc.npcClass);
      const xp = player.getClassXP(npc.npcClass);
      const nextThreshold = player.getNextClassThreshold(npc.npcClass);
      const nextSkill = player.getNextClassSkill(npc.npcClass);
      if (level >= MAX_CLASS_LEVEL) {
          return [
              `${npc.name}: You have reached the end of this path.`,
              `${npc.name}: ${player.getUnlockedClassSkills(npc.npcClass).join(", ")} are yours to carry.`
          ];
      }
      if (nextThreshold && xp >= nextThreshold) {
          return [
              `${npc.name}: Your ${npc.npcClass} training has deepened. You are level ${level}.`,
              `${npc.name}: Next threshold: ${nextThreshold} XP. Next unlock: ${nextSkill || "none"}.`
          ];
      } else {
          const expNeeded = nextThreshold - xp;
          return [
              `${npc.name}: You walk the ${npc.npcClass} path at level ${level}.`,
              `${npc.name}: ${xp}/${nextThreshold} class XP. ${expNeeded} more to unlock ${nextSkill}.`
          ];
      }
  } else {  // Case: Player is not in the NPC's class
      return [
          `${npc.name}: Ah, a ${player.class}. Would you consider becoming a ${npc.npcClass}?`,
          `${npc.name}: I can show you the way, if you're interested.`
      ];
  }
}

function displayDialogueSequence(lines, callback) {
  lines.forEach((line, index) => {
      setTimeout(() => {
          updateLog(line);
          if (index === lines.length - 1 && callback) callback(); // Call callback after final line
      }, index * 2000); // 2-second delay per line
  });
}
