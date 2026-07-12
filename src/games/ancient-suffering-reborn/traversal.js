import { getRoom } from './map.js';
import { updateLog } from './ui.js';
import { updateRoomAndItems } from './roomManager.js'; 
import { playClick, playFail, playPing } from './soundEffects.js';

function hasRequiredItem(player, itemId) {
  return player.inventory.some(item => item.id === itemId);
}

function requirementMet(requirement, player, gameState) {
  if (!requirement) return true;
  if (requirement.item && !hasRequiredItem(player, requirement.item)) return false;
  if (requirement.class && player.class !== requirement.class) return false;
  if (requirement.flag && !gameState.hasFlag(requirement.flag)) return false;
  return true;
}

function describeRequirement(requirement) {
  if (requirement.item) return `You need ${requirement.item.replaceAll('_', ' ')} to pass.`;
  if (requirement.class) return `Only a ${requirement.class} can pass this way.`;
  if (requirement.flag) return "Something in the world has not yet changed enough to open this path.";
  return "The way is sealed.";
}

function resolveRoomEntry(room, player, gameState) {
  if (room.grantsFlag && !gameState.hasFlag(room.grantsFlag)) {
    gameState.setFlag(room.grantsFlag);
  }

  if (!room.hazard) return;
  const hazard = room.hazard;
  if (hazard.onceFlag && gameState.hasFlag(hazard.onceFlag)) return;
  const tags = hazard.tags || [hazard.tag].filter(Boolean);
  const bestResponse = tags.map(tag => ({ tag, ...player.getHazardResponseDetail(tag) }))
    .find(entry => ["avoid", "transform"].includes(entry.response))
    || tags.map(tag => ({ tag, ...player.getHazardResponseDetail(tag) }))
      .find(entry => ["reduce", "resist", "interpret"].includes(entry.response));

  if (bestResponse && ["avoid", "transform"].includes(bestResponse.response)) {
    playPing();
    updateClassSkillLog(player, bestResponse);
    updateLog(hazard.avoidedMessage || getHazardMessage(player.class, bestResponse.tag, bestResponse.response));
    player.gainClassXP(15, `avoided ${bestResponse.tag} hazard`);
    if (hazard.onceFlag) gameState.setFlag(hazard.onceFlag);
    return;
  }

  let damage = hazard.damage || 0;
  if (bestResponse && ["reduce", "resist"].includes(bestResponse.response)) {
    damage = reduceDamage(damage, bestResponse);
    playPing();
    updateClassSkillLog(player, bestResponse);
    updateLog(hazard.reducedMessage || getHazardMessage(player.class, bestResponse.tag, bestResponse.response));
    player.gainClassXP(10, `reduced ${bestResponse.tag} hazard`);
  } else if (bestResponse?.response === "interpret") {
    playPing();
    updateClassSkillLog(player, bestResponse);
    updateLog(getHazardMessage(player.class, bestResponse.tag, bestResponse.response));
    player.gainClassXP(5, `interpreted ${bestResponse.tag} hazard`);
  }

  const damageResult = player.takeHazardDamage(damage);
  if (damage > 0) playFail();
  updateLog(hazard.message || "The room itself turns against you.");
  updateLog(`You take ${damage} damage. HP: ${player.hp}.`);
  if (damageResult.survivedByLuck) {
    updateLog(`<${player.class} Skill: Survivor's Luck>`);
    updateLog("Luck catches at the edge of death. You remain standing at 1 HP.");
  }
  tags.forEach(tag => player.rememberHazard(tag));
  rememberResponseUse(player, bestResponse);
  if (damage > 0) player.gainClassXP(5, "survived a hazard");
  if (hazard.onceFlag) gameState.setFlag(hazard.onceFlag);

  if (player.hp <= 0) {
    playFail();
    updateLog("You collapse. The reliquary keeps its silence. Load a save or start a new game.");
    gameState.setTerminalState("death");
  }
}

function reduceDamage(damage, response) {
  if (response?.flatReduction) return Math.max(0, damage - response.flatReduction);
  return Math.max(0, Math.ceil(damage / 2));
}

function rememberResponseUse(player, response) {
  if (response?.memoryFlag) player.rememberHazard(response.memoryFlag);
}

function updateClassSkillLog(player, response) {
  if (response?.feature) {
    updateLog(`<${player.class} Skill: ${response.feature}>`);
  }
}

function getHazardMessage(className, tag, response) {
  const messages = {
    Cleric: "Your consecrated training steadies your step. The danger does not take hold.",
    Ranger: "You read the shape of the ground and avoid the worst of it.",
    Warrior: "You brace before the blow lands, taking it on your own terms.",
    Rogue: "Something about the place is wrong. You shift just in time.",
    Mage: "The pattern opens in your mind before it burns.",
    Adventurer: "Hard experience saves you from the worst of it."
  };
  return messages[className] || `${response} against ${tag}.`;
}

export function canUseExit(direction, player, gameState) {
  const currentRoom = getRoom(player.currentRoom);
  if (!currentRoom || !currentRoom.exits[direction]) return false;
  const targetRoom = getRoom(currentRoom.exits[direction]);
  return requirementMet(targetRoom && targetRoom.requires, player, gameState);
}

export function move(direction, player, gameState) {
    if (!gameState || !gameState.isTraversal() || gameState.isInputLocked()) return;

    const currentRoom = getRoom(player.currentRoom);
    const newRoomId = currentRoom && currentRoom.exits[direction];
    if (newRoomId) {
      const targetRoom = getRoom(newRoomId);
      if (!requirementMet(targetRoom && targetRoom.requires, player, gameState)) {
        playFail();
        updateLog(describeRequirement(targetRoom.requires));
        return;
      }

      playClick();
      const previousRoomId = player.currentRoom;
      player.currentRoom = newRoomId;
      gameState.recordMove(previousRoomId, newRoomId);
      updateLog(`You went ${direction}.`);
      updateLog("");
      resolveRoomEntry(targetRoom, player, gameState);
      updateRoomAndItems(player, gameState);
    } else {
      playFail();
      updateLog("You can't go that way!");
    }
  }

export function backtrack(player, gameState) {
    if (!gameState || !gameState.isTraversal() || gameState.isInputLocked()) return;
    const previousRoomId = gameState.popBacktrackRoom();
    if (!previousRoomId || !getRoom(previousRoomId)) {
      playFail();
      updateLog("There is no clear path back.");
      updateRoomAndItems(player, gameState);
      return;
    }

    playClick();
    player.currentRoom = previousRoomId;
    gameState.markVisited(previousRoomId);
    updateLog("You retrace your steps.");
    updateRoomAndItems(player, gameState);
  }
