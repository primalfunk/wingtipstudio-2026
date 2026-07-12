import { getRoom } from './map.js';
import { getItem } from './items.js';
import { getNpc } from './npcs.js';
import { updateLog, updateButtons, showTalkButton, hideTalkButton, showPickUpButtons, hidePickUpButton, showInventoryButton, updateDashboard, showSceneActionButtons, clearSceneActionButtons } from './ui.js';
import { backtrack, move } from './traversal.js';
import { playFail, playPing, playWin } from './soundEffects.js';

export function updateRoom(player, gameState) {
  if (!gameState || !gameState.isTraversal || !gameState.isTraversal()) {
      console.warn('gameState is not in traversal mode. Skipping room update.');
      return;
  }

  const currentRoom = getRoom(player.currentRoom);
  if (!currentRoom) {
      updateLog("The world has not finished loading.");
      return;
  }
  const messageFlag = `seen_message_${currentRoom.id}`;
  if (currentRoom.onEnterMessage && !gameState.hasFlag(messageFlag)) {
      updateLog(currentRoom.onEnterMessage);
      gameState.setFlag(messageFlag);
  }
  updateLog(`*-* ${currentRoom.title} *-*`);
  updateLog(currentRoom.description);
  if (currentRoom.soundDescription) {
      updateLog(currentRoom.soundDescription);
  }

  if (currentRoom.npcs.length > 0) {
      const npc = getNpc(currentRoom.npcs[0]);
      updateLog(`You see ${npc.name} here.`);
      showTalkButton(npc);
  } else {
      hideTalkButton();
  }

  updateButtons(currentRoom.exits, (direction) => {
      if (direction === "__backtrack") {
          backtrack(player, gameState);
          return;
      }
      move(direction, player, gameState);
  });
  showAvailableRoomActions(currentRoom, player, gameState);
  showInventoryButton(player, gameState);
  updateDashboard(player, gameState);
}


export function loadItemsInRoom(player, gameState) {
    const room = getRoom(player.currentRoom);
    const itemsInRoom = room.items.map((itemId) => getItem(itemId)).filter(Boolean);
  
    if (itemsInRoom.length > 0) {
      itemsInRoom.forEach((item) => {
        updateLog(`You see a ${item.name} here.`);
      });
      showPickUpButtons(itemsInRoom, player, gameState);
    } else {
      hidePickUpButton();
    }
  }

  export function updateRoomAndItems(player, gameState) {
    updateRoom(player, gameState);
    loadItemsInRoom(player, gameState);
  }

function hasItem(player, itemId) {
  return player.inventory.some(item => item.id === itemId);
}

function requirementsMet(requirements, player, gameState) {
  if (!requirements) return true;
  if (requirements.item && !hasItem(player, requirements.item)) return false;
  if (requirements.class && player.class !== requirements.class) return false;
  if (requirements.flag && !gameState.hasFlag(requirements.flag)) return false;
  if (requirements.allItems && !requirements.allItems.every(itemId => hasItem(player, itemId))) return false;
  if (requirements.allFlags && !requirements.allFlags.every(flag => gameState.hasFlag(flag))) return false;
  return true;
}

function showAvailableRoomActions(room, player, gameState) {
  const availableActions = (room.actions || []).filter(action => {
    if (action.once && action.grantsFlag && gameState.hasFlag(action.grantsFlag)) return false;
    return requirementsMet(action.requires, player, gameState);
  });
  if (availableActions.length > 0) {
    showSceneActionButtons(availableActions, action => handleRoomAction(action, player, gameState));
  } else {
    clearSceneActionButtons();
  }
}

function getActionEffect(action, player) {
  const baseEffect = action.effect || {};
  const classEffect = action.classEffects?.[player.class] || {};
  const tags = action.hazardTags || [];
  const bestResponse = tags.map(tag => ({ tag, ...player.getHazardResponseDetail(tag) }))
    .find(entry => ["avoid", "transform"].includes(entry.response))
    || tags.map(tag => ({ tag, ...player.getHazardResponseDetail(tag) }))
      .find(entry => ["reduce", "resist", "interpret"].includes(entry.response));

  if (!bestResponse) return { ...baseEffect, ...classEffect };
  if (["avoid", "transform"].includes(bestResponse.response)) {
    return {
      ...baseEffect,
      ...classEffect,
      damage: 0,
      classResponse: bestResponse,
      message: classEffect.message || getActionResponseMessage(player.class, bestResponse.tag, bestResponse.response)
    };
  }
  if (["reduce", "resist"].includes(bestResponse.response) && baseEffect.damage) {
    return {
      ...baseEffect,
      ...classEffect,
      damage: reduceDamage(classEffect.damage ?? baseEffect.damage, bestResponse),
      classResponse: bestResponse,
      message: classEffect.message || getActionResponseMessage(player.class, bestResponse.tag, bestResponse.response)
    };
  }
  return {
    ...baseEffect,
    ...classEffect,
    classResponse: bestResponse,
    message: classEffect.message || baseEffect.message || getActionResponseMessage(player.class, bestResponse.tag, bestResponse.response)
  };
}

function applyActionEffect(action, player, gameState) {
  const effect = getActionEffect(action, player);
  if (effect.classResponse) updateClassSkillLog(player, effect.classResponse);
  if (effect.message) updateLog(effect.message);
  if (effect.damage) {
    playFail();
    const damageResult = player.takeHazardDamage(effect.damage);
    updateLog(`You take ${effect.damage} damage. HP: ${player.hp}.`);
    if (damageResult.survivedByLuck) {
      updateLog(`<${player.class} Skill: Survivor's Luck>`);
      updateLog("Luck catches at the edge of death. You remain standing at 1 HP.");
    }
    if (player.hp <= 0) {
      playFail();
      updateLog("You collapse. Load a save or start a new game.");
      gameState.setTerminalState("death");
    }
  }
  if (effect.heal) {
    playPing();
    player.heal(effect.heal);
    updateLog(`You recover ${effect.heal} HP. HP: ${player.hp}.`);
  }
  if (effect.grantsFlag) {
    playPing();
    gameState.setFlag(effect.grantsFlag);
  }
  if (effect.grantsItem) {
    const item = getItem(effect.grantsItem);
    if (item && !hasItem(player, item.id)) {
      player.pickUpItem(item);
    }
  }
  if (effect.classResponse) {
    playPing();
    player.gainClassXP(["avoid", "transform"].includes(effect.classResponse.response) ? 15 : 10, `handled ${effect.classResponse.tag} event`);
    rememberResponseUse(player, effect.classResponse);
  } else if (action.tags?.includes("living_map_event")) {
    playPing();
    player.gainClassXP(5, "resolved an event");
  }
  (action.hazardTags || []).forEach(tag => player.rememberHazard(tag));
}

function getActionResponseMessage(className, tag, response) {
  const messages = {
    Cleric: "Your rite steadies the danger before it can deepen.",
    Ranger: "You read the terrain and choose the safer line.",
    Warrior: "You brace and push through the danger.",
    Rogue: "You notice the tell before the trap fully opens.",
    Mage: "You understand the pattern before it resolves against you.",
    Adventurer: "Hard experience keeps the moment from turning worse."
  };
  return messages[className] || `${response} against ${tag}.`;
}

function updateClassSkillLog(player, response) {
  if (response?.feature) {
    updateLog(`<${player.class} Skill: ${response.feature}>`);
  }
}

function reduceDamage(damage, response) {
  if (response?.flatReduction) return Math.max(0, damage - response.flatReduction);
  return Math.max(0, Math.ceil(damage / 2));
}

function rememberResponseUse(player, response) {
  if (response?.memoryFlag) player.rememberHazard(response.memoryFlag);
}

function getInspectionReduction(effect, player, gameState) {
  if (!effect.inspectedFlag || !gameState?.hasFlag(effect.inspectedFlag)) return 0;
  const classKey = `${player.class.toLowerCase()}InspectedReduction`;
  return (effect.inspectedReduction || 0) + (effect[classKey] || 0);
}

function getBestHazardResponse(tags, player) {
  return tags.map(tag => ({ tag, ...player.getHazardResponseDetail(tag) }))
    .find(entry => ["avoid", "transform"].includes(entry.response))
    || tags.map(tag => ({ tag, ...player.getHazardResponseDetail(tag) }))
      .find(entry => ["reduce", "resist", "interpret"].includes(entry.response));
}

function applyPickupEffect(item, player, gameState) {
  const effect = item.pickupEffect;
  if (!effect || (effect.onceFlag && gameState?.hasFlag(effect.onceFlag))) return;

  const tags = effect.tags || [effect.tag].filter(Boolean);
  const bestResponse = getBestHazardResponse(tags, player);

  if (bestResponse && ["avoid", "transform"].includes(bestResponse.response)) {
    playPing();
    updateClassSkillLog(player, bestResponse);
    updateLog(effect.avoidedMessage || getActionResponseMessage(player.class, bestResponse.tag, bestResponse.response));
    player.gainClassXP(15, `avoided ${bestResponse.tag} pickup hazard`);
    rememberResponseUse(player, bestResponse);
    if (effect.onceFlag) gameState?.setFlag(effect.onceFlag);
    return;
  }

  let damage = effect.damage || 0;
  if (bestResponse && ["reduce", "resist"].includes(bestResponse.response)) {
    damage = reduceDamage(damage, bestResponse);
    playPing();
    updateClassSkillLog(player, bestResponse);
    updateLog(effect.reducedMessage || getActionResponseMessage(player.class, bestResponse.tag, bestResponse.response));
    player.gainClassXP(10, `reduced ${bestResponse.tag} pickup hazard`);
    rememberResponseUse(player, bestResponse);
  } else if (bestResponse?.response === "interpret") {
    playPing();
    updateClassSkillLog(player, bestResponse);
    updateLog(getActionResponseMessage(player.class, bestResponse.tag, bestResponse.response));
    player.gainClassXP(5, `interpreted ${bestResponse.tag} pickup hazard`);
  }

  const inspectionReduction = getInspectionReduction(effect, player, gameState);
  if (inspectionReduction > 0) {
    damage = Math.max(0, damage - inspectionReduction);
    updateLog("Your earlier inspection helps you handle it more safely.");
  }

  if (damage > 0) {
    playFail();
    const damageResult = player.takeHazardDamage(damage);
    updateLog(effect.message || `${item.name} harms you as you take it.`);
    updateLog(`You take ${damage} damage. HP: ${player.hp}.`);
    if (damageResult.survivedByLuck) {
      updateLog(`<${player.class} Skill: Survivor's Luck>`);
      updateLog("Luck catches at the edge of death. You remain standing at 1 HP.");
    }
    player.gainClassXP(5, "survived a pickup hazard");
  } else if (effect.message) {
    updateLog(effect.message);
  }

  tags.forEach(tag => player.rememberHazard(tag));
  if (effect.onceFlag) gameState?.setFlag(effect.onceFlag);

  if (player.hp <= 0) {
    playFail();
    updateLog("You collapse. Load a save or start a new game.");
    gameState?.setTerminalState("death");
  }
}

export function handleRoomAction(action, player, gameState) {
  if (!requirementsMet(action.requires, player, gameState)) {
    playFail();
    updateLog("You are missing something needed for that.");
    return;
  }
  if (action.once && action.grantsFlag && gameState.hasFlag(action.grantsFlag)) {
    playFail();
    updateLog(action.repeatMessage || "There is nothing more to do here.");
    return;
  }

  if (action.grantsFlag) gameState.setFlag(action.grantsFlag);
  if (action.successMessage) updateLog(action.successMessage);
  applyActionEffect(action, player, gameState);
  if (action.terminal) {
    playWin();
    gameState.setTerminalState(action.terminal);
    updateLog("The adventure is complete.");
  } else {
    playPing();
  }
  updateRoomAndItems(player, gameState);
}

  export function pickUpItem(item, player) {
    player.inventory.push(item);
    updateLog(`You picked up a ${item.name}.`);

    const currentRoom = player.currentRoom;
    const room = getRoom(currentRoom);
    room.items = room.items.filter(roomItem => roomItem !== item.id);
  
    if (room.items.length === 0) {
      hidePickUpButton();
    }
  }

  export function handlePickUp(item, player, gameState) {
    const currentRoom = getRoom(player.currentRoom);
    if (!currentRoom || !currentRoom.items.includes(item.id)) {
      playFail();
      updateLog("That item is no longer here.");
      loadItemsInRoom(player, gameState);
      return;
    }

    if (item.id === 'ash_crown_relic') {
      if (gameState && gameState.hasFlag('ash_crown_claimed')) {
        playFail();
        updateLog('Only ash remains on the plinth.');
        return;
      }
      if (gameState) {
        gameState.setFlag('ash_crown_claimed');
        gameState.setFlag('reliquary_opened');
        gameState.setFlag('ash_crown_cursed');
      }
      playWin();
      updateLog('The Ash-Crown Relic settles into your hands, warm as a buried coal. A curse wakes inside it.');
    } else {
      playPing();
    }
    applyPickupEffect(item, player, gameState);
    player.pickUpItem(item);
    currentRoom.items = currentRoom.items.filter(roomItem => roomItem !== item.id);
  
    if (currentRoom.items.length === 0) {
      hidePickUpButton();
    } else {
      loadItemsInRoom(player, gameState);
    }
    if (player.inventory.length > 0) {
      showInventoryButton(player, gameState);
    }
    updateDashboard(player, gameState);
  }
