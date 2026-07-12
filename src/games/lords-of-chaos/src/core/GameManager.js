import { choice } from "./random.js";
import { GameMap } from "../world/Map.js";
import { Player } from "../actors/Player.js";
import { EnemyManager } from "../actors/EnemyManager.js";
import { Combat } from "../combat/Combat.js";
import { Telemetry } from "./Telemetry.js";

const DIRECTIONS = {
  n: "north",
  s: "south",
  e: "east",
  w: "west",
};

const MAP_SIZE_ANCHORS = [
  [1, 10],
  [2, 11],
  [5, 12],
  [10, 13],
  [20, 14],
  [40, 16],
  [70, 18],
  [100, 20],
];

export class GameManager {
  constructor(words, services) {
    this.words = words;
    this.ui = services.ui;
    this.audio = services.audio;
    this.level = 1;
    this.playerMoveCount = 0;
    this.state = "title";
    this.firstRun = true;
    this.tutorialSeen = new Set();
    this.telemetry = new Telemetry();
    this.newLevel();
  }

  getMapSize() {
    const level = Math.max(1, Math.min(100, this.level));
    for (let index = 1; index < MAP_SIZE_ANCHORS.length; index += 1) {
      const [previousLevel, previousSize] = MAP_SIZE_ANCHORS[index - 1];
      const [nextLevel, nextSize] = MAP_SIZE_ANCHORS[index];
      if (level <= nextLevel) {
        const progress = (level - previousLevel) / (nextLevel - previousLevel);
        return Math.round(previousSize + progress * (nextSize - previousSize));
      }
    }
    return 20;
  }

  newLevel(keepPlayerName = true) {
    const previousPlayer = this.player;
    const existingName = previousPlayer?.name;
    this.gameMap = new GameMap(this.getMapSize(), this.words);
    const startRoom = choice([...this.gameMap.rooms.values()]);
    this.player = new Player(startRoom, this);
    if (keepPlayerName && existingName) this.player.name = existingName;
    if (keepPlayerName && previousPlayer) this.carryPlayerProgress(previousPlayer);
    this.placeObjectiveArtifact();
    this.placeEarlyGear();
    this.enemyManager = new EnemyManager(this.gameMap, this.player, this.words, { firstRunSafety: this.firstRun && this.level === 1, realmLevel: this.level });
    this.playerMoveCount = 0;
    this.allConnectionsVisible = false;
    this.relicExpAwardedThisLevel = 0;
    this.telemetry.setLevel(this.level);
    this.updateLighting();
  }

  placeObjectiveArtifact() {
    const relicRoom = [...this.gameMap.rooms.values()].find((room) => room.decorations.some((item) => item.startsWith("reality ")));
    if (!relicRoom) return;
    const relic = relicRoom.decorations.find((item) => item.startsWith("reality "));
    const distances = this.graphDistancesFrom(this.player.currentRoom);
    const maxReach = Math.max(...distances.values());
    const minRatio = this.level <= 2 ? 0.35 : 0.22;
    const maxRatio = this.level <= 2 ? 0.58 : 0.48;
    const minDistance = Math.max(4, Math.floor(maxReach * minRatio));
    const maxDistance = Math.max(minDistance + 2, Math.ceil(maxReach * maxRatio));
    const candidates = [...this.gameMap.rooms.values()].filter((room) => {
      const distance = distances.get(room);
      return distance >= minDistance && distance <= maxDistance && !room.enemies.length;
    });
    if (!candidates.length) return;
    const targetDistance = (minDistance + maxDistance) / 2;
    const targetRoom = candidates
      .map((room) => ({
        room,
        score: (Object.values(room.connections).filter(Boolean).length === 1 ? -3 : 0) + Math.abs(targetDistance - distances.get(room)),
      }))
      .sort((a, b) => a.score - b.score)[0].room;
    relicRoom.decorations = relicRoom.decorations.filter((item) => item !== relic);
    targetRoom.decorations.push(relic);
  }

  carryPlayerProgress(previousPlayer) {
    const nextRoom = this.player.currentRoom;
    const preserved = {
      name: previousPlayer.name,
      level: previousPlayer.level,
      exp: previousPlayer.exp,
      atk: previousPlayer.atk,
      defn: previousPlayer.defn,
      int: previousPlayer.int,
      wis: previousPlayer.wis,
      con: previousPlayer.con,
      eva: previousPlayer.eva,
      maxHp: previousPlayer.maxHp,
      maxMp: previousPlayer.maxMp,
      hp: Math.min(previousPlayer.maxHp, Math.max(previousPlayer.hp, Math.ceil(previousPlayer.maxHp * 0.65))),
      mp: previousPlayer.maxMp,
      equippedWeapon: previousPlayer.equippedWeapon,
      equippedArmor: previousPlayer.equippedArmor,
      weaponBonus: previousPlayer.weaponBonus,
      armorBonus: previousPlayer.armorBonus,
      hasMap: previousPlayer.hasMap,
      hasCompass: previousPlayer.hasCompass,
      visibilityRadius: previousPlayer.visibilityRadius,
    };
    Object.assign(this.player, preserved);
    this.player.currentRoom = nextRoom;
    this.player.x = nextRoom.x;
    this.player.y = nextRoom.y;
    this.player.gotRelic = false;
    this.player.inCombat = false;
    this.player.previousRooms = [];
    this.player.gearBonuses = new Map(previousPlayer.gearBonuses);
    this.player.inventory.items = previousPlayer.inventory.items.filter((item) => !item.startsWith("reality "));
    this.player.inventory.full = false;
  }

  placeEarlyGear() {
    if (this.level > 100) return;
    const gearItems = new Set([...this.words.objects.weapons, ...this.words.objects.armor]);
    const gearRoom = [...this.gameMap.rooms.values()].find((room) => room.decorations.some((item) => gearItems.has(item)));
    if (!gearRoom) return;
    const gear = gearRoom.decorations.find((item) => gearItems.has(item));
    const distances = this.graphDistancesFrom(this.player.currentRoom);
    const maxReach = Math.max(...distances.values());
    const minDistance = 1;
    const maxDistance = Math.max(3, Math.ceil(maxReach * 0.22));
    const candidates = [...this.gameMap.rooms.values()].filter((room) => {
      const distance = distances.get(room);
      return distance >= minDistance && distance <= maxDistance && !room.enemies.length;
    });
    if (!candidates.length) return;
    const targetRoom = candidates
      .map((room) => ({
        room,
        score: (Object.values(room.connections).filter(Boolean).length === 1 ? -4 : 0) + Math.abs((minDistance + maxDistance) / 2 - distances.get(room)),
      }))
      .sort((a, b) => a.score - b.score)[0].room;
    gearRoom.decorations = gearRoom.decorations.filter((item) => item !== gear);
    targetRoom.decorations.push(gear);
  }

  graphDistancesFrom(startRoom) {
    const distances = new Map([[startRoom, 0]]);
    const queue = [startRoom];
    while (queue.length) {
      const room = queue.shift();
      const nextDistance = distances.get(room) + 1;
      for (const neighbor of Object.values(room.connections).filter(Boolean)) {
        if (distances.has(neighbor)) continue;
        distances.set(neighbor, nextDistance);
        queue.push(neighbor);
      }
    }
    return distances;
  }

  placeExitTargetFrom(startRoom) {
    for (const room of this.gameMap.rooms.values()) room.isTarget = false;
    const distances = this.graphDistancesFrom(startRoom);
    const maxReach = Math.max(...distances.values());
    const minDistance = Math.max(1, Math.floor(maxReach * 0.5));
    const candidates = [...distances.entries()]
      .filter(([, distance]) => distance >= minDistance)
      .map(([room, distance]) => ({ room, distance }));
    const targetPool = candidates.length ? candidates : [...distances.entries()]
      .filter(([room]) => room !== startRoom)
      .map(([room, distance]) => ({ room, distance }));
    if (!targetPool.length) return null;
    const targetRoom = targetPool.sort((a, b) => b.distance - a.distance)[0].room;
    targetRoom.isTarget = true;
    return targetRoom;
  }

  startGame(playerName) {
    this.telemetry.reset();
    this.telemetry.setLevel(this.level);
    this.tutorialSeen = new Set();
    this.player.name = playerName || "PLAYER";
    this.state = "intro";
    this.audio.playMusic("bgmusic", 0.35);
    this.ui.showIntro(this.level);
    this.ui.sync(this);
    this.ui.showIntroOverlay();
  }

  continueFromIntro() {
    if (this.state !== "intro") return;
    this.state = "explore";
    this.ui.hideIntroOverlay();
    this.checkTutorialTriggers();
    this.ui.sync(this);
  }

  restartGame() {
    const name = this.player.name;
    this.telemetry.finalHP = this.player.hp;
    this.telemetry.printSummary("run restart");
    this.level = 1;
    this.telemetry.reset();
    this.tutorialSeen = new Set();
    this.newLevel(false);
    this.player.name = name;
    this.state = "explore";
    this.ui.showIntro(this.level);
    this.ui.sync(this);
  }

  movePlayer(direction) {
    if (this.state !== "explore") return;
    if (!this.player.canMove(direction)) {
      this.ui.messages.add("You can't go that way.");
      return;
    }
    const room = this.player.currentRoom.connections[direction];
    this.playerMoveCount += 1;
    this.player.moveToRoom(room);
    this.triggerTutorial("movement");
    this.player.regenerateMp("movement");
    this.updateLighting();
    this.audio.play("travel", 0.35);
    this.ui.messages.add(`Travelled ${DIRECTIONS[direction]} to ${room.name} (${room.x}, ${room.y})`);
    if (room.isTarget) {
      this.advanceLevel();
      return;
    }
    this.enemyManager.moveEnemies(this.playerMoveCount);
    this.checkCombatAutoStart();
    this.checkTutorialTriggers();
    this.ui.sync(this);
  }

  triggerTutorial(id) {
    if (this.state === "intro" || this.tutorialSeen.has(id)) return;
    const prompts = {
      movement: "New rooms mend a little of what the place has taken.",
      enemy: "Something has noticed you.<br>It may follow if it draws near.",
      combat: "Stand your ground, brace yourself, or run.",
      item: "Useful things are scarce.<br>Carry only what you can bear.",
    };
    const text = prompts[id];
    if (!text) return;
    this.tutorialSeen.add(id);
    this.ui.showTutorialPrompt(text);
  }

  checkTutorialTriggers() {
    if (this.state !== "explore") return;
    const room = this.player.currentRoom;
    const hasVisibleEnemy = this.enemyManager.enemies.some((enemy) => enemy.currentRoom.lit > 0);
    if (hasVisibleEnemy) this.triggerTutorial("enemy");
    const hasVisibleItem = [...this.gameMap.rooms.values()].some((candidate) => candidate.lit > 0 && candidate.decorations.some((item) => this.ui.itemCategoryMap.has(item)));
    if (hasVisibleItem || room.decorations.some((item) => this.ui.itemCategoryMap.has(item))) this.triggerTutorial("item");
  }

  advanceLevel() {
    this.telemetry.finalHP = this.player.hp;
    this.telemetry.printSummary(`level ${this.level} complete`);
    this.level += 1;
    this.newLevel();
    this.ui.messages.add(`--------The Chaos Realm (Level ${this.level})---------`);
    this.ui.messages.add("Your enemies have grown stronger.");
    this.ui.sync(this);
  }

  updateLighting() {
    const maxLight = 5;
    if (this.player.hasMap) {
      for (const room of this.gameMap.rooms.values()) room.lit = maxLight;
      return;
    }
    for (let dx = -this.player.visibilityRadius; dx <= this.player.visibilityRadius; dx += 1) {
      for (let dy = -this.player.visibilityRadius; dy <= this.player.visibilityRadius; dy += 1) {
        const distance = Math.hypot(dx, dy);
        if (distance > this.player.visibilityRadius) continue;
        const room = this.gameMap.rooms.get(`${this.player.x + dx},${this.player.y + dy}`);
        if (!room) continue;
        let light = 1;
        if (distance === 0) light = maxLight;
        else if ([3, 4].includes(this.player.visibilityRadius) && distance === 1) light = this.player.visibilityRadius - 1;
        room.lit = Math.max(room.lit, light);
      }
    }
  }

  revealMap() {
    this.player.hasMap = true;
    for (const room of this.gameMap.rooms.values()) room.lit = 5;
  }

  revealConnections() {
    this.player.hasCompass = true;
    this.allConnectionsVisible = true;
  }

  pickUpOrEquip() {
    if (this.state !== "explore") return;
    const item = this.player.currentRoom.decorations.find((candidate) => candidate.startsWith("reality "))
      ?? this.player.currentRoom.decorations.find((candidate) => this.ui.itemCategoryMap.get(candidate));
    if (!item) return;
    const category = this.ui.itemCategoryMap.get(item) ?? (item.startsWith("reality ") ? "K" : "");
    if (category === "T" || category === "K") {
      if (this.player.inventory.addItem(item)) {
        this.triggerTutorial("item");
        this.audio.play("inventory", 0.45);
        this.ui.messages.add(`You picked up the ${item}.`);
      } else {
        this.ui.messages.add("Your inventory is full.");
      }
    } else {
      this.triggerTutorial("item");
      this.player.equipItem(item, category);
      this.audio.play("inventory", 0.45);
      this.ui.messages.add(`You equipped the ${item}.`);
    }
    this.ui.sync(this);
  }

  awardRelicExp() {
    const bonus = {
      1: 40,
      2: 30,
      3: 20,
      4: 25,
      5: 25,
      6: 30,
      7: 30,
      8: 35,
      9: 35,
      10: 40,
      11: 40,
      12: 45,
      13: 45,
      14: 50,
      15: 50,
      16: 70,
      17: 75,
      18: 80,
      19: 85,
      20: 90,
      21: 95,
      22: 100,
      23: 105,
      24: 110,
      25: 115,
      26: 120,
      27: 125,
      28: 130,
      29: 135,
      30: 140,
      31: 145,
      32: 150,
      33: 155,
      34: 160,
      35: 165,
      36: 170,
      37: 175,
      38: 180,
      39: 185,
      40: 190,
    }[this.level] ?? (this.level <= 100 ? 190 + (this.level - 40) * 6 : 0);
    if (!bonus || this.relicExpAwardedThisLevel) return 0;
    this.relicExpAwardedThisLevel = bonus;
    this.player.exp += bonus;
    this.telemetry.expGained += bonus;
    this.ui.messages.add(`* ${this.player.name} gains ${bonus} experience from the relic.`);
    if (this.player.checkLevelUp()) {
      const increases = this.player.levelUp();
      this.telemetry.recordLevelUp();
      Object.entries(increases).forEach(([stat, increase]) => this.ui.messages.add(`# ${stat} increased by ${increase}.`, "green"));
    }
    return bonus;
  }

  dropItem(item) {
    if (this.player.inventory.removeItem(item)) {
      this.ui.messages.add(`You dropped the ${item} on the ground.`);
      this.ui.sync(this);
    }
  }

  attack() {
    const enemy = this.player.currentRoom.enemies[0];
    if (!enemy || this.state !== "explore") return;
    this.state = "combat";
    this.triggerTutorial("combat");
    this.audio.play("notification", 0.45);
    this.audio.playMusic("battlemusic", 0.65);
    this.combat = new Combat(this.player, enemy, this.ui.messages, this.audio, this.telemetry);
    this.ui.sync(this);
  }

  combatAttack() {
    if (this.state !== "combat" || !this.combat?.playerTurn) return;
    this.combat.playerAttack();
    this.ui.sync(this);
  }

  combatGuard() {
    if (this.state !== "combat" || !this.combat?.playerTurn) return;
    this.combat.guard();
    this.ui.sync(this);
  }

  combatFlee() {
    if (this.state !== "combat" || !this.combat?.playerTurn) return;
    this.combat.flee();
    if (this.combat?.isOver) this.finishCombat();
    this.ui.sync(this);
  }

  checkCombatAutoStart() {
    const enemy = this.player.currentRoom.enemies[0];
    if (enemy) this.attack();
  }

  update(now) {
    if (this.state === "combat" && this.combat) {
      this.combat.update(now);
      if (this.combat.isOver) this.finishCombat();
      this.ui.sync(this);
    }
  }

  finishCombat() {
    const defeated = this.combat.playerWon ? this.combat.enemy : null;
    const expGained = defeated ? defeated.exp : 0;
    this.telemetry.finishCombat({
      playerWon: this.combat.playerWon,
      fled: this.combat.fled,
      turns: this.combat.roundCount,
      playerHpEnd: this.player.hp,
      enemyName: this.combat.enemy.name,
      expGained,
    });
    if (this.combat.fled) {
      this.audio.playMusic("bgmusic", 0.35);
      this.state = "explore";
    } else if (defeated) {
      this.enemyManager.enemies = this.enemyManager.enemies.filter((enemy) => enemy !== defeated);
      defeated.currentRoom.enemies = defeated.currentRoom.enemies.filter((enemy) => enemy !== defeated);
      this.player.currentRoom.decorations.push(`corpse (${defeated.name})`);
      this.player.exp += expGained;
      this.ui.messages.add(`* ${this.player.name} gains ${expGained} experience.`);
      if (this.player.checkLevelUp()) {
        const increases = this.player.levelUp();
        this.telemetry.recordLevelUp();
        Object.entries(increases).forEach(([stat, increase]) => this.ui.messages.add(`# ${stat} increased by ${increase}.`, "green"));
      }
      this.audio.play("win", 0.55);
      this.audio.playMusic("bgmusic", 0.35);
      this.state = "explore";
    } else {
      this.audio.play("gameover", 0.6);
      this.ui.messages.add("* Game over. Press R to restart.", "red");
      this.state = "gameover";
      this.telemetry.printSummary("player death");
    }
    if (this.state === "explore" || this.state === "gameover") this.firstRun = false;
    this.combat = null;
  }

  mapLitPercent() {
    const max = this.gameMap.rooms.size * 5;
    const lit = [...this.gameMap.rooms.values()].reduce((sum, room) => sum + room.lit, 0);
    return max ? (100 * lit) / max : 0;
  }
}
