import { handlePickUp, updateRoomAndItems } from "./roomManager.js";
import { getRoom } from "./map.js";
import { getNpc } from "./npcs.js";
import { playClick, playPing } from "./soundEffects.js";

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function formatLabel(value) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function getShortcut(direction) {
  const shortcuts = {
    north: "N",
    east: "E",
    south: "S",
    west: "W"
  };
  return shortcuts[direction] || null;
}

function getDirectionLabel(direction) {
  const labels = {
    north: "↑ North [N]",
    east: "→ East [E]",
    south: "↓ South [S]",
    west: "← West [W]"
  };
  return labels[direction] || formatLabel(direction);
}

function getBaseButtonLabel(button) {
  if (!button.dataset) button.dataset = {};
  if (!button.dataset.baseLabel) {
    button.dataset.baseLabel = button.textContent.replace(/\s+\([A-Z0-9]\)$/, "");
  }
  return button.dataset.baseLabel;
}

function setButtonLabel(button, label) {
  if (!button.dataset) button.dataset = {};
  button.dataset.baseLabel = label;
  button.textContent = label;
}

function isVisibleButton(button) {
  if (button.style?.display === "none" || button.hidden) return false;
  if (typeof getComputedStyle === "function" && getComputedStyle(button).display === "none") return false;
  return true;
}

function getCommandButtons() {
  return [
    ...document.querySelectorAll("#extra-exit-button-container button"),
    ...document.querySelectorAll("#action-button-container button"),
    ...document.querySelectorAll("#character-button-container button"),
    ...document.querySelectorAll("#backtrack-btn")
  ].filter(button => button && !button.disabled && isVisibleButton(button));
}

function chooseHotkey(button, index, usedKeys) {
  const label = getBaseButtonLabel(button);
  const firstWord = label.trim().split(/\s+/)[0] || label;
  const reservedKeys = new Set(["n", "e", "s", "w"]);
  const candidates = [
    firstWord[index],
    ...firstWord,
    ...label.replace(/\s+/g, "")
  ].filter(Boolean);

  for (const candidate of candidates) {
    const key = candidate.toLowerCase();
    if (/^[a-z0-9]$/.test(key) && !usedKeys.has(key) && !reservedKeys.has(key)) {
      return key;
    }
  }
  return null;
}

export function refreshCommandHotkeys() {
  const buttons = getCommandButtons();
  buttons.forEach(button => {
    const baseLabel = getBaseButtonLabel(button);
    button.textContent = baseLabel;
    delete button.dataset.hotkey;
  });

  const usedKeys = new Set();
  const groups = new Map();
  buttons.forEach(button => {
    const firstWord = getBaseButtonLabel(button).trim().split(/\s+/)[0] || "";
    const groupKey = firstWord.charAt(0).toLowerCase();
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(button);
  });

  [...groups.values()].forEach(group => {
    group
      .sort((a, b) => getBaseButtonLabel(a).localeCompare(getBaseButtonLabel(b)))
      .forEach((button, index) => {
        const hotkey = chooseHotkey(button, index, usedKeys);
        if (!hotkey) return;
        usedKeys.add(hotkey);
        button.dataset.hotkey = hotkey;
        button.textContent = `${getBaseButtonLabel(button)} (${hotkey.toUpperCase()})`;
      });
  });
}

export function handleCommandHotkey(key) {
  const normalizedKey = key.toLowerCase();
  const button = getCommandButtons().find(candidate => candidate.dataset.hotkey === normalizedKey);
  if (!button) return false;
  button.click();
  return true;
}

export function handlePromptHotkey(key) {
  const overlayContainer = document.getElementById("overlay-container");
  if (!overlayContainer || overlayContainer.style.display === "none") return false;

  const normalizedKey = key.toLowerCase();
  if (normalizedKey === "y") {
    document.getElementById("yes-btn")?.click();
    return true;
  }
  if (normalizedKey === "n") {
    document.getElementById("no-btn")?.click();
    return true;
  }
  return false;
}

export function updateLog(message, isPreformatted = false) {
  const textLog = document.getElementById("text-log");
  const node = document.createElement(isPreformatted ? "pre" : "p");
  node.textContent = message;
  textLog.appendChild(node);
  if (isPreformatted) {
    node.classList.add("log-preformatted");
  } else {
    node.classList.add("log-line");
  }
  textLog.scrollTop = textLog.scrollHeight;
}

export function clearLog() {
  const textLog = document.getElementById("text-log");
  if (textLog) {
    textLog.replaceChildren();
  }
}

export function updateButtons(exits, moveCallback) {
  const directionalButtonContainer = document.getElementById('directional-button-container');
  const extraExitButtonContainer = document.getElementById('extra-exit-button-container');
  const actionButtonContainer = document.getElementById('action-button-container');
  const characterButtonContainer = document.getElementById('character-button-container');
  const systemButtonContainer = document.getElementById('system-button-container');
  const talkButton = document.getElementById("talk-btn");
  const inventoryButton = document.getElementById("inventory-btn");
  const statusButton = document.getElementById("status-btn");
  const classStatusButton = document.getElementById("class-status-btn");
  const saveButton = document.getElementById("save-btn");
  const loadButton = document.getElementById("load-btn");
  const newGameButton = document.getElementById("new-game-btn");
  const backtrackButton = document.getElementById("backtrack-btn");
  directionalButtonContainer.innerHTML = '';
  if (extraExitButtonContainer) extraExitButtonContainer.innerHTML = '';
  actionButtonContainer.innerHTML = '';
  if (characterButtonContainer) characterButtonContainer.innerHTML = '';
  if (systemButtonContainer) systemButtonContainer.innerHTML = '';

  ["north", "west", "east", "south"].forEach(direction => {
    const button = createDirectionButton(getDirectionLabel(direction), `${direction}-btn`, () => moveCallback(direction));
    button.disabled = !exits[direction];
    button.classList.add("cardinal-btn", `${direction}-control`);
    directionalButtonContainer.appendChild(button);
  });

  Object.keys(exits)
    .filter(direction => !["north", "east", "south", "west"].includes(direction))
    .forEach(direction => {
      const button = createDirectionButton(formatLabel(direction), `${direction}-btn`, () => moveCallback(direction));
      extraExitButtonContainer?.appendChild(button);
    });

  if (talkButton) {
    actionButtonContainer.appendChild(talkButton); 
  }
  if (inventoryButton) {
    characterButtonContainer.appendChild(inventoryButton); 
  }
  if (classStatusButton) {
    characterButtonContainer.appendChild(classStatusButton);
  }
  if (statusButton) {
    characterButtonContainer.appendChild(statusButton);
  }
  if (saveButton) {
    systemButtonContainer.appendChild(saveButton);
  }
  if (loadButton) {
    systemButtonContainer.appendChild(loadButton);
  }
  if (newGameButton) {
    systemButtonContainer.appendChild(newGameButton);
  }
  if (backtrackButton) {
    backtrackButton.onclick = () => moveCallback("__backtrack");
  }
  refreshCommandHotkeys();
}

export function createDirectionButton(direction, id, callback) {
  const button = document.createElement("button");
  button.id = id;
  if (!button.dataset) button.dataset = {};
  button.dataset.direction = id.replace("-btn", "");
  setButtonLabel(button, direction);
  button.addEventListener("click", callback);
  return button;
}

export function showTalkButton(npc = null) {
  const talkButton = document.getElementById("talk-btn");
  if (talkButton) {
    setButtonLabel(talkButton, npc?.name ? `Talk to ${npc.name}` : "Talk");
    talkButton.style.display = "inline-block";
    refreshCommandHotkeys();
  } else {
    console.error("Talk button not found in the DOM when trying to show it.");
  }
}

export function hideTalkButton() {
  const talkButton = document.getElementById("talk-btn");
  if (talkButton) {
    talkButton.style.display = "none";
    refreshCommandHotkeys();
  } else {
    console.error("Talk button not found in the DOM when trying to hide it.");
  }
}
export function showYesNoChoice(npc, player, gameState) {
  const overlayContainer = document.getElementById("overlay-container");
  const overlayMessage = document.getElementById("overlay-message");

  if (gameState) gameState.lockInput("classPrompt");
  overlayContainer.style.display = "flex";
  overlayMessage.textContent = `Would you like to become a ${npc.npcClass}?`;

  const yesBtn = document.getElementById("yes-btn");
  const noBtn = document.getElementById("no-btn");

  yesBtn.onclick = () => handleYesChoice(npc, player, gameState);
  noBtn.onclick = () => handleNoChoice(npc, gameState, player);
}

export function hideYesNoChoice() {
  const overlayContainer = document.getElementById("overlay-container");
  overlayContainer.style.display = "none";
}

export function handleYesChoice(npc, player, gameState) {
  if (npc.type === "classTrainer") {
    playPing();
    updateLog(player.changeClass(npc.npcClass));
  }
  hideYesNoChoice();
  if (gameState) gameState.unlockInput();
  enableTraversalButtons(player, gameState);
  updateDashboard(player, gameState);
}

export function handleNoChoice(npc, gameState, player = null) {
  playClick();
  updateLog("Another time, perhaps.");
  hideYesNoChoice();
  if (gameState) gameState.unlockInput();
  if (player) enableTraversalButtons(player, gameState);
}

export function showPickUpButton(item, player, gameState) {
  showPickUpButtons(item ? [item] : [], player, gameState);
}

export function showPickUpButtons(items, player, gameState) {
  const actionButtonContainer = document.getElementById("action-button-container");
  if (!actionButtonContainer) return;

  actionButtonContainer.querySelectorAll(".pickup-action-btn").forEach(button => button.remove());
  items
    .filter(item => item && item.pickUpAble)
    .forEach(item => {
      const button = document.createElement("button");
      button.classList.add("pickup-action-btn");
      button.dataset.itemId = item.id;
      setButtonLabel(button, `Pick Up ${item.name}`);
      button.onclick = () => handlePickUp(item, player, gameState);
      actionButtonContainer.appendChild(button);
    });

  const legacyPickUpButton = document.getElementById("pick-up-btn");
  if (legacyPickUpButton) legacyPickUpButton.style.display = "none";
  refreshCommandHotkeys();
}

export function hidePickUpButton() {
  document.querySelectorAll(".pickup-action-btn").forEach(button => button.remove());
  const pickUpButton = document.getElementById('pick-up-btn');
  if (pickUpButton) {
    pickUpButton.style.display = 'none';
  }
  refreshCommandHotkeys();
}

export function showInventoryButton(player, gameState) {
  const inventoryButton = document.getElementById("inventory-btn");
  if (inventoryButton) {
    if (player.hasItemsInInventory()) {
      inventoryButton.style.display = "block";
      inventoryButton.onclick = () => {
        playClick();
        showInventoryModal(player, gameState);
      };
    } else {
      inventoryButton.style.display = "none";
    }
    refreshCommandHotkeys();
  } else {
    console.error("Inventory button not found in the DOM.");
  }
}

export function showInventoryModal(player, gameState) {
  const inventoryModal = document.getElementById('inventory-modal');
  const inventoryList = document.getElementById('inventory-list');
  const closeInventoryBtn = document.getElementById('close-inventory-btn');

  if (!inventoryModal || !inventoryList || !closeInventoryBtn || !gameState || !getRoom(player.currentRoom)) {
    updateLog("Inventory cannot be changed until the world is ready.");
    return;
  }

  inventoryList.innerHTML = '';
  player.inventory.forEach(item => {
      // Create the main item button
      const itemButton = document.createElement('button');
      itemButton.textContent = item.name;
      itemButton.classList.add('inventory-item-btn');

      const optionsDiv = document.createElement('div');
      optionsDiv.classList.add('item-options');
      optionsDiv.style.display = 'none';

      if (item.type === 'weapon' || item.type === 'armor') {
          const equipBtn = document.createElement('button');
          equipBtn.classList.add('inventory-item-btn');
          equipBtn.textContent = player.isEquipped(item) ? 'Unequip' : 'Equip';
          equipBtn.onclick = () => {
              if (player.isEquipped(item)) {
                  player.unequipItem(item);
                  equipBtn.textContent = 'Equip';
              } else {
                  player.equipItem(item);
                  equipBtn.textContent = 'Unequip';
              }
              playPing();
              updateDashboard(player, gameState);
          };
          optionsDiv.appendChild(equipBtn);
      }

      const dropBtn = document.createElement('button');
      dropBtn.classList.add('inventory-item-btn');
      dropBtn.textContent = 'Drop';
      dropBtn.onclick = () => {
          playPing();
          player.dropItem(item);
          updateRoomAndItems(player, gameState);
          updateDashboard(player, gameState);
          inventoryModal.style.display = 'none';
      };
      optionsDiv.appendChild(dropBtn);

      itemButton.onclick = () => {
          playClick();
          itemButton.style.display = 'none';
          optionsDiv.style.display = 'flex';
      };

      inventoryList.appendChild(itemButton);
      inventoryList.appendChild(optionsDiv);
  });

  inventoryModal.style.display = 'flex';

  closeInventoryBtn.onclick = () => {
      playClick();
      inventoryModal.style.display = 'none';
  };
}

export function disableTraversalButtons() {
  const buttons = document.querySelectorAll("#directional-button-container button, #extra-exit-button-container button, #backtrack-btn, #talk-btn, #pick-up-btn, .pickup-action-btn, #status-btn, #class-status-btn, #inventory-btn");
  buttons.forEach(button => button.disabled = true);
}

export function showSceneActionButtons(actions, actionCallback) {
  const actionButtonContainer = document.getElementById('action-button-container');
  const talkButton = document.getElementById("talk-btn");
  if (!actionButtonContainer) return;

  actionButtonContainer.querySelectorAll(".room-action-btn").forEach(button => button.remove());
  actions.forEach(action => {
    const button = document.createElement("button");
    button.classList.add("room-action-btn");
    setButtonLabel(button, action.label);
    button.onclick = () => actionCallback(action);
    actionButtonContainer.appendChild(button);
  });

  if (talkButton && talkButton.parentElement !== actionButtonContainer) actionButtonContainer.appendChild(talkButton);
  refreshCommandHotkeys();
}

export function clearSceneActionButtons() {
  document.querySelectorAll(".room-action-btn").forEach(button => button.remove());
  refreshCommandHotkeys();
}

export function enableTraversalButtons(player, gameState) {
  const currentRoom = getRoom(player.currentRoom);
  const exits = currentRoom?.exits || {};
  const directionalButtons = document.querySelectorAll("#directional-button-container button");
  directionalButtons.forEach(button => {
    const direction = button.dataset.direction || button.id.replace("-btn", "");
    button.disabled = !exits[direction];
  });
  const extraExitButtons = document.querySelectorAll("#extra-exit-button-container button");
  extraExitButtons.forEach(button => button.disabled = false);
  const backtrackButton = document.getElementById("backtrack-btn");
  if (backtrackButton) backtrackButton.disabled = !gameState?.canBacktrack?.();
  const statusButton = document.getElementById("status-btn");
  statusButton.disabled = false;
  const classStatusButton = document.getElementById("class-status-btn");
  if (classStatusButton) classStatusButton.disabled = false;
  const talkButton = document.getElementById("talk-btn");
  if (currentRoom && currentRoom.npcs && currentRoom.npcs.length > 0) {
      const npc = getNpc(currentRoom.npcs[0]);
      setButtonLabel(talkButton, npc?.name ? `Talk to ${npc.name}` : "Talk");
      talkButton.style.display = 'block';
      talkButton.disabled = false;
  } else {
      talkButton.style.display = 'none';
  }
  document.querySelectorAll(".pickup-action-btn").forEach(button => {
      button.disabled = false;
  });
  if (!currentRoom || !currentRoom.items || currentRoom.items.length === 0) hidePickUpButton();
  showInventoryButton(player, gameState);
  updateDashboard(player, gameState);
  refreshCommandHotkeys();
}

export function showPlayerStatus(player) {
  const statsTable = `
Stat               : Value
-------------------:------
Name               : ${player.name || "Unknown"}
Class              : ${player.class}
Level              : ${player.level}
Experience Points  : ${player.experience}
HP                 : ${player.hp}
MP                 : ${player.mp}
Strength           : ${player.str}
Dexterity          : ${player.dex}
Intelligence       : ${player.int}
Wisdom             : ${player.wis}
Constitution       : ${player.con}
  `;
  updateLog(statsTable, true);  // Output as preformatted text
}

export function showClassStatus(player) {
  const className = player.class;
  const level = player.getClassLevel(className);
  const xp = player.getClassXP(className);
  const nextThreshold = player.getNextClassThreshold(className);
  const unlocked = player.getUnlockedClassSkills(className);
  const nextSkill = player.getNextClassSkill(className);
  const knownPaths = Object.entries(player.classLevels)
    .filter(([, knownLevel]) => knownLevel > 0)
    .map(([knownClass, knownLevel]) => `- ${knownClass} Level ${knownLevel}`)
    .join("\n");
  const classTable = `
Current Class: ${className}, Level ${level}
Class XP     : ${nextThreshold ? `${xp} / ${nextThreshold}` : `${xp} / MAX`}

Unlocked Skills:
${unlocked.map(skill => `- ${skill}`).join("\n") || "- None"}

Known Paths:
${knownPaths || "- Adventurer Level 1"}

Next Unlock:
${nextSkill ? `- Level ${level + 1}: ${nextSkill}` : "- Mastered"}
  `;
  updateLog(classTable, true);
}

export function updateDashboard(player, gameState) {
  const currentRoom = getRoom(player.currentRoom);
  if (currentRoom) {
    gameState?.markVisited?.(player.currentRoom);
    setText("room-heading", currentRoom.title);
    setText("current-room-name", currentRoom.title);
    updateBacktrackButton(gameState);
  }
  renderCharacterStats(player, gameState);
  renderInventorySummary(player);
}

function updateBacktrackButton(gameState) {
  const backtrackButton = document.getElementById("backtrack-btn");
  if (backtrackButton) {
    backtrackButton.disabled = !gameState?.canBacktrack?.() || gameState?.isInputLocked?.();
  }
}

function renderCharacterStats(player, gameState) {
  const stats = document.getElementById("character-stats");
  if (!stats) return;

  const rows = [
    ["Name", player.name || "Unknown"],
    ["Class", player.class],
    ["Path Lv", player.getActiveClassLevel()],
    ["Level", player.level],
    ["EXP", player.experience],
    ["HP", player.hp],
    ["MP", player.mp],
    ["STR", player.str],
    ["DEX", player.dex],
    ["INT", player.int],
    ["WIS", player.wis],
    ["CON", player.con]
  ];

  if (gameState && gameState.isInputLocked()) {
    rows.push(["State", formatLabel(gameState.activeOverlay || "locked")]);
  }

  stats.innerHTML = "";
  rows.forEach(([label, value]) => {
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    stats.appendChild(term);
    stats.appendChild(description);
  });
}

function renderInventorySummary(player) {
  const inventorySummary = document.getElementById("inventory-summary");
  if (!inventorySummary) return;

  inventorySummary.innerHTML = "";
  if (!player.inventory.length) {
    const empty = document.createElement("li");
    empty.textContent = "Empty";
    inventorySummary.appendChild(empty);
    return;
  }

  player.inventory.forEach(item => {
    const row = document.createElement("li");
    const equipped = player.isEquipped(item) ? " [equipped]" : "";
    row.textContent = `${item.name}${equipped}`;
    inventorySummary.appendChild(row);
  });
}
