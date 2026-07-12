import { getCurrentMapSeed, getRooms } from "./map.js";
import { getItem } from "./items.js";

export const SAVE_VERSION = 1;

export function createSaveData(player, gameState) {
  const equippedItems = {};
  Object.keys(player.equippedItems).forEach(slot => {
    equippedItems[slot] = player.equippedItems[slot].id;
  });

  const roomItems = {};
  Object.entries(getRooms()).forEach(([roomId, room]) => {
    roomItems[roomId] = [...(room.items || [])];
  });

  return {
    saveVersion: SAVE_VERSION,
    mapSeed: getCurrentMapSeed(),
    player: {
      name: player.name,
      class: player.class,
      level: player.level,
      experience: player.experience,
      hp: player.hp,
      mp: player.mp,
      str: player.str,
      dex: player.dex,
      int: player.int,
      wis: player.wis,
      con: player.con,
      currentRoom: player.currentRoom,
      classLevels: player.classLevels,
      classXP: player.classXP,
      hazardMemory: player.hazardMemory,
      survivorLuckUsed: player.survivorLuckUsed,
      inventory: player.inventory.map(item => item.id),
      equippedItems
    },
    flags: gameState.getFlags(),
    terminalState: gameState.getTerminalState(),
    navigation: {
      visitedRooms: gameState.getVisitedRooms(),
      roomHistory: gameState.getRoomHistory()
    },
    rooms: { roomItems }
  };
}

export function validateSaveData(saveData) {
  return Boolean(saveData && saveData.saveVersion === SAVE_VERSION && saveData.mapSeed && saveData.player);
}

export function restorePlayerFromSave(player, data) {
  const inventory = (data.inventory || []).map(itemId => getItem(itemId)).filter(Boolean);
  const equippedItems = {};
  Object.keys(data.equippedItems || {}).forEach(slot => {
    const item = getItem(data.equippedItems[slot]);
    if (item) equippedItems[slot] = item;
  });

  player.restore({
    ...data,
    inventory,
    equippedItems
  });
}

export function restoreRoomsFromSave(saveData, gameState) {
  const allRooms = getRooms();
  Object.entries(saveData.rooms?.roomItems || {}).forEach(([roomId, items]) => {
    if (allRooms[roomId]) {
      allRooms[roomId].items = [...items];
    }
  });

  if (gameState.hasFlag("ash_crown_claimed") && allRooms.sealed_reliquary) {
    allRooms.sealed_reliquary.items = allRooms.sealed_reliquary.items.filter(itemId => itemId !== "ash_crown_relic");
  }
}

export function restoreNavigationFromSave(saveData, gameState) {
  gameState.setVisitedRooms(saveData.navigation?.visitedRooms || []);
  gameState.setRoomHistory(saveData.navigation?.roomHistory || []);
  if (saveData.terminalState) {
    gameState.setTerminalState(saveData.terminalState);
  } else {
    gameState.clearTerminalState();
  }
}
