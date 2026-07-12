import { Player } from "./player.js";
import { GameStateManager } from "./gameStateManager.js";
import { move } from "./traversal.js";
import { initializeMap, getRoom, getCurrentMapSeed } from "./map.js";
import { getNpc, startNpcInteraction } from "./npcs.js";
import { updateRoomAndItems } from "./roomManager.js";
import { clearLog, handleCommandHotkey, handlePromptHotkey, updateLog, showClassStatus, showPlayerStatus } from "./ui.js";
import { createSaveData, restoreNavigationFromSave, restorePlayerFromSave, restoreRoomsFromSave, validateSaveData } from "./saveManager.js";
import { initializePaneResizers } from "./paneResizer.js";
import { initializeMusic } from "./audioManager.js";
import { playClick, playFail, playPing, playStart } from "./soundEffects.js";

const SAVE_KEY = "ancientSuffering.save.v1";

export const gameState = new GameStateManager();
const player = new Player();

function saveGame() {
  try {
    const saveData = createSaveData(player, gameState);
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
    playPing();
    updateLog("Game saved.");
  } catch (error) {
    playFail();
    updateLog("Save failed.");
    console.error(error);
  }
}

async function loadGame() {
  try {
    const rawSave = localStorage.getItem(SAVE_KEY);
    if (!rawSave) {
      playFail();
      updateLog("No save game was found.");
      return;
    }

    const saveData = JSON.parse(rawSave);
    if (!validateSaveData(saveData)) {
      playFail();
      updateLog("Save data is old or invalid.");
      return;
    }

    gameState.unlockInput();
    gameState.clearTerminalState();
    gameState.setState("traversal");
    gameState.setFlags(saveData.flags || {});
    await initializeMap({ seed: saveData.mapSeed, force: true });
    gameState.setMapSeed(saveData.mapSeed);
    restorePlayerFromSave(player, saveData.player);
    restoreRoomsFromSave(saveData, gameState);
    restoreNavigationFromSave(saveData, gameState);
    gameState.markVisited(player.currentRoom);
    playStart();
    updateLog("Game loaded.");
    updateRoomAndItems(player, gameState);
  } catch (error) {
    playFail();
    updateLog("Load failed. Save data could not be restored.");
    console.error(error);
  }
}

async function newGame() {
  clearLog();
  gameState.unlockInput();
  gameState.clearTerminalState();
  gameState.setState("traversal");
  gameState.setFlags({});
  gameState.setVisitedRooms([]);
  gameState.setRoomHistory([]);
  const rooms = await initializeMap({ force: true });
  gameState.setMapSeed(getCurrentMapSeed());
  player.restore(new Player());
  player.currentRoom = Object.keys(rooms)[0];
  gameState.markVisited(player.currentRoom);
  playStart();
  updateLog("New game started.");
  updateRoomAndItems(player, gameState);
}

function showAsciiArt() {
  fetch("assets/asciiArt.txt")
    .then(response => response.text())
    .then(asciiArt => {
      updateLog(asciiArt, true);
    })
    .catch(error => console.error("Error loading ASCII art:", error));
}

async function initializeGame() {
  showAsciiArt();
  const rooms = await initializeMap();
  gameState.setMapSeed(getCurrentMapSeed());
  player.currentRoom = Object.keys(rooms)[0];
  gameState.markVisited(player.currentRoom);
  updateRoomAndItems(player, gameState);
}

document.getElementById("north-btn").addEventListener("click", () => move("north", player, gameState));
document.getElementById("south-btn").addEventListener("click", () => move("south", player, gameState));
document.getElementById("east-btn").addEventListener("click", () => move("east", player, gameState));
document.getElementById("west-btn").addEventListener("click", () => move("west", player, gameState));

document.getElementById("talk-btn").addEventListener("click", () => {
  if (gameState.isInputLocked()) return;
  const currentRoom = getRoom(player.currentRoom);
  if (currentRoom.npcs.length > 0) {
    playClick();
    const npc = getNpc(currentRoom.npcs[0]);
    startNpcInteraction(npc, player, gameState);
  }
});
document.getElementById("status-btn").addEventListener("click", () => {
  playClick();
  showPlayerStatus(player);
});
document.getElementById("class-status-btn").addEventListener("click", () => {
  playClick();
  showClassStatus(player);
});
document.getElementById("save-btn").addEventListener("click", saveGame);
document.getElementById("load-btn").addEventListener("click", loadGame);
document.getElementById("new-game-btn").addEventListener("click", newGame);

document.getElementById("pick-up-btn").style.display = "none";

document.addEventListener("keydown", event => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const activeTag = document.activeElement?.tagName?.toLowerCase();
  if (activeTag === "input" || activeTag === "textarea" || activeTag === "select") return;

  if (handlePromptHotkey(event.key)) {
    event.preventDefault();
    return;
  }

  const keyDirections = {
    n: "north",
    e: "east",
    s: "south",
    w: "west"
  };
  const direction = keyDirections[event.key.toLowerCase()];
  if (direction) {
    event.preventDefault();
    move(direction, player, gameState);
    return;
  }

  if (handleCommandHotkey(event.key)) {
    event.preventDefault();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  initializePaneResizers();
  initializeMusic();
  window.requestAnimationFrame(() => window.parent?.postMessage({ type: 'wingtip:game-ready' }, window.location.origin));
  document.getElementById("start-game-btn").addEventListener("click", () => {
    playStart();
    document.getElementById("main-menu").classList.add("is-hidden");
    initializeGame().catch(error => {
      playFail();
      updateLog("The world failed to initialize.");
      console.error(error);
    });
  });
});
