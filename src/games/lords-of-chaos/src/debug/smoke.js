import { readFile } from "node:fs/promises";
import { GameMap } from "../world/Map.js";
import { GameManager } from "../core/GameManager.js";

const words = JSON.parse(await readFile(new URL("../../assets/data/words.json", import.meta.url), "utf8"));
const gameMap = new GameMap(14, words);
const rooms = [...gameMap.rooms.values()];
const regions = new Set(rooms.map((room) => room.region));
const itemRooms = rooms.filter((room) => room.decorations.length);

const ui = {
  messages: { add() {}, clear() {} },
  sync() {},
  showIntro() {},
  showIntroOverlay() {},
  hideIntroOverlay() {},
  showTutorialPrompt() {},
  itemCategoryMap: new Map(Object.entries(words.objects).flatMap(([category, items]) => {
    const letter = { tools: "T", weapons: "W", armor: "A", artifacts: "K" }[category];
    return letter ? items.map((item) => [item, letter]) : [];
  })),
};
const audio = { play() {}, playMusic() {} };
const game = new GameManager(words, { ui, audio });
game.state = "explore";

function roomKey(room) {
  return `${room.x},${room.y}`;
}

function routeExists(start, target) {
  const visited = new Set([roomKey(start)]);
  const queue = [start];
  while (queue.length) {
    const room = queue.shift();
    if (room === target) return true;
    for (const neighbor of Object.values(room.connections).filter(Boolean)) {
      const key = roomKey(neighbor);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push(neighbor);
    }
  }
  return false;
}

const relicRoom = [...game.gameMap.rooms.values()].find((room) => room.decorations.some((item) => item.startsWith("reality ")));
if (!relicRoom) throw new Error("Generated map does not contain a relic.");

game.player.currentRoom = relicRoom;
game.player.x = relicRoom.x;
game.player.y = relicRoom.y;
game.pickUpOrEquip();

const exitRoom = [...game.gameMap.rooms.values()].find((room) => room.isTarget);
if (!exitRoom) throw new Error("Relic pickup did not create an exit target.");
if (!routeExists(game.player.currentRoom, exitRoom)) throw new Error("Relic exit target is unreachable.");

console.log(JSON.stringify({
  generatedRooms: rooms.length,
  generatedRegions: regions.size,
  roomsWithDecorations: itemRooms.length,
  gameLevel: game.level,
  playerRoom: [game.player.x, game.player.y],
  enemies: game.enemyManager.enemies.length,
  exitRoom: [exitRoom.x, exitRoom.y],
}, null, 2));
