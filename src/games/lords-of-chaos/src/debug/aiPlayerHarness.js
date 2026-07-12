import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { GameManager } from "../core/GameManager.js";

function createItemCategoryMap(words) {
  return new Map(Object.entries(words.objects).flatMap(([category, items]) => {
    const letter = { tools: "T", weapons: "W", armor: "A", artifacts: "K" }[category];
    return letter ? items.map((item) => [item, letter]) : [];
  }));
}

function createHeadlessServices(words) {
  return {
    ui: {
      itemCategoryMap: createItemCategoryMap(words),
      messages: { add() {}, clear() {} },
      showIntro() {},
      showIntroOverlay() {},
      hideIntroOverlay() {},
      showTutorialPrompt() {},
      sync() {},
    },
    audio: {
      play() {},
      playMusic() {},
    },
  };
}

function validDirections(game) {
  return Object.entries(game.player.currentRoom.connections)
    .filter(([, room]) => room)
    .map(([direction]) => direction);
}

function visibleEnemyRooms(game) {
  return new Set(game.enemyManager.enemies
    .filter((enemy) => enemy.currentRoom.lit > 0)
    .map((enemy) => `${enemy.x},${enemy.y}`));
}

function roomKey(room) {
  return `${room.x},${room.y}`;
}

function directionBetween(from, to) {
  return Object.entries(from.connections).find(([, room]) => room === to)?.[0] ?? null;
}

function findRouteToFrontier(game, visited, enemyRooms) {
  const start = game.player.currentRoom;
  const queue = [start];
  const parent = new Map([[roomKey(start), null]]);
  const roomByKey = new Map([[roomKey(start), start]]);

  while (queue.length) {
    const room = queue.shift();
    const safeUnvisitedNeighbor = Object.values(room.connections).find((neighbor) => {
      if (!neighbor) return false;
      const key = roomKey(neighbor);
      return !visited.has(key) && !enemyRooms.has(key);
    });
    if (safeUnvisitedNeighbor && room !== start) {
      const path = [room];
      let cursorKey = roomKey(room);
      while (parent.get(cursorKey)) {
        cursorKey = parent.get(cursorKey);
        path.unshift(roomByKey.get(cursorKey));
      }
      return path.slice(1);
    }

    for (const neighbor of Object.values(room.connections).filter(Boolean)) {
      const key = roomKey(neighbor);
      if (!visited.has(key) || parent.has(key) || enemyRooms.has(key)) continue;
      parent.set(key, roomKey(room));
      roomByKey.set(key, neighbor);
      queue.push(neighbor);
    }
  }
  return [];
}

function findPathToKnownFrontier(game, visited, enemyRooms, hpRatio) {
  const start = game.player.currentRoom;
  const queue = [start];
  const parent = new Map([[roomKey(start), null]]);
  const roomByKey = new Map([[roomKey(start), start]]);
  const known = (room) => visited.has(roomKey(room)) || room.lit > 0 || room === start;

  while (queue.length) {
    const room = queue.shift();
    const key = roomKey(room);
    if (room !== start && !visited.has(key) && (!enemyRooms.has(key) || hpRatio >= 0.72)) {
      const path = [room];
      let cursorKey = key;
      while (parent.get(cursorKey)) {
        cursorKey = parent.get(cursorKey);
        path.unshift(roomByKey.get(cursorKey));
      }
      return path.slice(1);
    }

    for (const neighbor of Object.values(room.connections).filter(Boolean)) {
      const neighborKey = roomKey(neighbor);
      if (parent.has(neighborKey)) continue;
      if (!known(neighbor) && visited.has(key)) {
        parent.set(neighborKey, key);
        roomByKey.set(neighborKey, neighbor);
        queue.push(neighbor);
        continue;
      }
      if (!known(neighbor)) continue;
      if (enemyRooms.has(neighborKey) && hpRatio < 0.72) continue;
      parent.set(neighborKey, key);
      roomByKey.set(neighborKey, neighbor);
      queue.push(neighbor);
    }
  }
  return [];
}

function findPath(start, target) {
  const queue = [start];
  const parent = new Map([[roomKey(start), null]]);
  const roomByKey = new Map([[roomKey(start), start]]);
  while (queue.length) {
    const room = queue.shift();
    if (room === target) {
      const path = [room];
      let cursorKey = roomKey(room);
      while (parent.get(cursorKey)) {
        cursorKey = parent.get(cursorKey);
        path.unshift(roomByKey.get(cursorKey));
      }
      return path.slice(1);
    }
    for (const neighbor of Object.values(room.connections).filter(Boolean)) {
      const key = roomKey(neighbor);
      if (parent.has(key)) continue;
      parent.set(key, roomKey(room));
      roomByKey.set(key, neighbor);
      queue.push(neighbor);
    }
  }
  return [];
}

function findPathToNearestRoom(start, targets) {
  const targetSet = new Set(targets);
  const queue = [start];
  const parent = new Map([[roomKey(start), null]]);
  const roomByKey = new Map([[roomKey(start), start]]);
  while (queue.length) {
    const room = queue.shift();
    if (targetSet.has(room)) {
      const path = [room];
      let cursorKey = roomKey(room);
      while (parent.get(cursorKey)) {
        cursorKey = parent.get(cursorKey);
        path.unshift(roomByKey.get(cursorKey));
      }
      return path.slice(1);
    }
    for (const neighbor of Object.values(room.connections).filter(Boolean)) {
      const key = roomKey(neighbor);
      if (parent.has(key)) continue;
      parent.set(key, roomKey(room));
      roomByKey.set(key, neighbor);
      queue.push(neighbor);
    }
  }
  return [];
}

function findRoomWithCategory(game, category) {
  return [...game.gameMap.rooms.values()].find((room) => {
    if (category === "K" && room.decorations.some((item) => item.startsWith("reality "))) return true;
    return room.decorations.some((item) => game.ui.itemCategoryMap.get(item) === category);
  }) ?? null;
}

function directionForPath(game, path) {
  return path.length ? directionBetween(game.player.currentRoom, path[0]) : null;
}

function countCarriedGear(game) {
  return Number(Boolean(game.player.equippedWeapon)) + Number(Boolean(game.player.equippedArmor));
}

function hasUsefulProgressItem(game, room) {
  return room.decorations.some((item) => {
    const category = game.ui.itemCategoryMap.get(item);
    if (!category) return false;
    if (category === "K") return !game.player.gotRelic;
    if (category === "W") return !game.player.equippedWeapon;
    if (category === "A") return !game.player.equippedArmor;
    if (category === "T") {
      if (item === "map") return !game.player.hasMap;
      if (item === "compass") return !game.player.hasCompass;
      return game.player.visibilityRadius < 5 && ["lantern", "torch", "table lamp", "flashlight", "glowing rock"].includes(item);
    }
    return false;
  });
}

function chooseDirection(game, visited, pathStack, metrics) {
  const directions = validDirections(game);
  const enemyRooms = visibleEnemyRooms(game);
  const hpRatio = game.player.hp / game.player.maxHp;

  if (game.player.gotRelic) {
    const target = [...game.gameMap.rooms.values()].find((candidate) => candidate.isTarget);
    const direction = target ? directionForPath(game, findPath(game.player.currentRoom, target)) : null;
    if (direction) return direction;
  }

  if (game.player.hasMap && !game.player.gotRelic) {
    const relicRoom = findRoomWithCategory(game, "K");
    const direction = relicRoom ? directionForPath(game, findPath(game.player.currentRoom, relicRoom)) : null;
    if (direction) return direction;
  }

  const safeUnvisited = directions
    .map((direction) => ({ direction, room: game.player.currentRoom.connections[direction] }))
    .filter(({ room }) => {
      const key = roomKey(room);
      return !visited.has(key) && (!enemyRooms.has(key) || hpRatio >= 0.7);
    })
    .sort((a, b) => {
      const aItem = a.room.decorations.some((item) => game.ui.itemCategoryMap.has(item)) ? 1 : 0;
      const bItem = b.room.decorations.some((item) => game.ui.itemCategoryMap.has(item)) ? 1 : 0;
      return bItem - aItem;
    });

  const adjacentGear = safeUnvisited.find(({ room }) => room.decorations.some((item) => game.ui.itemCategoryMap.has(item)));
  if (adjacentGear) {
    pathStack.push(game.player.currentRoom);
    return adjacentGear.direction;
  }

  if (!game.player.gotRelic || countCarriedGear(game) < 2) {
    const visibleItemTargets = [...game.gameMap.rooms.values()].filter((room) => {
      if (room.lit <= 0 || enemyRooms.has(roomKey(room))) return false;
      return hasUsefulProgressItem(game, room);
    });
    const pathToItem = findPathToNearestRoom(game.player.currentRoom, visibleItemTargets);
    if (pathToItem.length) {
      const nextRoom = pathToItem[0];
      if (!enemyRooms.has(roomKey(nextRoom)) || hpRatio >= 0.7) {
        const direction = directionBetween(game.player.currentRoom, nextRoom);
        if (direction) return direction;
      }
    }
  }

  if (!game.player.gotRelic) {
    const route = findPathToKnownFrontier(game, visited, enemyRooms, hpRatio);
    if (route.length) {
      const direction = directionBetween(game.player.currentRoom, route[0]);
      if (direction) return direction;
    }
  }

  const seekEnemyAfterRooms = game.level === 1 ? 10 : game.level === 2 ? 6 : game.level <= 5 ? 8 : game.level <= 10 ? 10 : 14;
  const levelCombats = game.telemetry.combatsStarted - metrics.combatsStartedAtEntry;
  const desiredSeekCombats = game.level === 1 ? 1 : game.level === 2 ? 2 : game.level <= 5 ? 2 : game.level <= 10 ? 3 : 1;
  if (!game.player.gotRelic && levelCombats < desiredSeekCombats && visited.size >= seekEnemyAfterRooms && hpRatio >= 0.7) {
    const visibleEnemyDirection = directions.find((direction) => enemyRooms.has(roomKey(game.player.currentRoom.connections[direction])));
    if (visibleEnemyDirection) return visibleEnemyDirection;
    const visibleEnemyTargets = game.enemyManager.enemies.filter((enemy) => enemy.currentRoom.lit > 0).map((enemy) => enemy.currentRoom);
    const pathToEnemy = findPathToNearestRoom(game.player.currentRoom, visibleEnemyTargets);
    const direction = pathToEnemy.length ? directionBetween(game.player.currentRoom, pathToEnemy[0]) : null;
    if (direction) return direction;
  }

  if ((!game.player.gotRelic || hpRatio < 0.7) && safeUnvisited.length) {
    pathStack.push(game.player.currentRoom);
    return safeUnvisited[0].direction;
  }

  while (!game.player.gotRelic && pathStack.length) {
    const backtrackRoom = pathStack.pop();
    const direction = directionBetween(game.player.currentRoom, backtrackRoom);
    if (direction) return direction;
  }

  const scored = directions.map((direction) => {
    const room = game.player.currentRoom.connections[direction];
    const key = roomKey(room);
    let score = 0;
    if (!visited.has(key)) score += 30;
    if (room.decorations.some((item) => game.ui.itemCategoryMap.has(item))) score += 22;
    if (enemyRooms.has(key)) score -= hpRatio >= 0.7 ? 12 : 100;
    if (game.player.hp < game.player.maxHp && !enemyRooms.has(key)) score += 8;
    return { direction, room, score };
  });
  let candidates = scored.filter((candidate) => candidate.score > -90);
  if (!candidates.length && hpRatio >= 0.5) candidates = scored;
  if (!candidates.length) candidates = scored.filter((candidate) => !enemyRooms.has(roomKey(candidate.room)));
  if (!candidates.length) candidates = scored;
  if (!candidates.length) return null;

  const route = findPathToKnownFrontier(game, visited, enemyRooms, hpRatio);
  if (route.length) {
    const direction = directionBetween(game.player.currentRoom, route[0]);
    if (direction) return direction;
  }

  if (!game.player.gotRelic && metrics.currentStep - metrics.lastNewRoomStep > 150) {
    const relicRoom = findRoomWithCategory(game, "K");
    const relicRoute = relicRoom ? findPath(game.player.currentRoom, relicRoom) : [];
    if (relicRoute.length) {
      const direction = directionBetween(game.player.currentRoom, relicRoute[0]);
      if (direction) return direction;
    }
    const unvisitedTargets = [...game.gameMap.rooms.values()].filter((room) => !visited.has(roomKey(room)));
    const recoveryRoute = findPathToNearestRoom(game.player.currentRoom, unvisitedTargets);
    if (recoveryRoute.length) {
      const direction = directionBetween(game.player.currentRoom, recoveryRoute[0]);
      if (direction) return direction;
    }
  }

  const legacyRoute = findRouteToFrontier(game, visited, enemyRooms);
  if (legacyRoute.length) {
    const direction = directionBetween(game.player.currentRoom, legacyRoute[0]);
    if (direction) return direction;
  }

  candidates.sort((a, b) => b.score - a.score);
  const bestScore = candidates[0].score;
  const best = candidates.filter((candidate) => candidate.score === bestScore);
  return best[Math.floor(Math.random() * best.length)].direction;
}

function handleCombat(game, now) {
  if (game.state !== "combat") return;
  if (game.combat?.playerTurn) {
    const hpRatio = game.player.hp / game.player.maxHp;
    const enemyTier = game.combat.enemy.tier ?? "baseline";
    const seasoned = game.level >= 21;
    const strongFleeThreshold = seasoned ? 0.35 : 0.55;
    const baselineFleeThreshold = seasoned ? 0.2 : 0.3;
    const guardThreshold = seasoned ? 0.4 : 0.5;
    if (enemyTier === "strong" && hpRatio < strongFleeThreshold) game.combatFlee();
    else if (enemyTier === "baseline" && hpRatio < baselineFleeThreshold) game.combatFlee();
    else if (hpRatio < guardThreshold && game.combat.roundCount % 4 === 0) game.combatGuard();
    else game.combatAttack();
  }
  game.update(now);
}

function applyExpectedBuild(game, words, startRealmLevel, preset = "baseline") {
  const targetPlayerLevel = Math.max(1, Math.min(100, startRealmLevel));
  while (game.player.level < targetPlayerLevel) game.player.levelUp();
  game.player.exp = Math.max(game.player.exp, Math.max(0, game.player.expRequirement() - Math.round(40 + targetPlayerLevel * 8)));

  const gearBonus = preset === "undergeared" ? 4 : preset === "strong" ? 8 : 6;
  const shouldEquipWeapon = preset !== "undergeared" || startRealmLevel >= 7;
  const shouldEquipArmor = preset !== "undergeared";
  if (shouldEquipWeapon) {
    game.player.equippedWeapon = words.objects.weapons[0] ?? "simulated weapon";
    game.player.weaponBonus = gearBonus;
    game.player.atk += gearBonus;
  }
  if (shouldEquipArmor) {
    game.player.equippedArmor = words.objects.armor[0] ?? "simulated armor";
    game.player.armorBonus = gearBonus;
    game.player.defn += gearBonus;
  }
  if (startRealmLevel >= 21) {
    game.player.inventory.items.push("map", "compass", "glowing rock");
    game.revealMap();
    game.revealConnections();
    game.player.visibilityRadius = 5;
  }

  const hpRatio = preset === "undergeared" ? 0.75 : preset === "strong" ? 1 : 0.9;
  game.player.hp = Math.max(1, Math.floor(game.player.maxHp * hpRatio));
  game.player.mp = game.player.maxMp;
}

export function runAiPlayer(words, options = {}) {
  const {
    maxSteps = 60000,
    targetLevel = 11,
    startRealmLevel = 1,
    buildPreset = "baseline",
    name = "AI_TEST",
    printTelemetry = false,
  } = options;

  const services = createHeadlessServices(words);
  const game = new GameManager(words, services);
  const telemetrySummaries = [];
  if (!printTelemetry) {
    game.telemetry.printSummary = (reason) => telemetrySummaries.push({ reason, ...game.telemetry.summary() });
  }
  if (startRealmLevel > 1) {
    game.level = startRealmLevel;
    game.newLevel(false);
    applyExpectedBuild(game, words, startRealmLevel, buildPreset);
    game.telemetry.reset();
    game.telemetry.setLevel(game.level);
  }
  game.startGame(name);
  game.continueFromIntro();

  let visited = new Set([`${game.player.x},${game.player.y}`]);
  let pathStack = [];
  let activeLevel = game.level;
  const perLevel = new Map();
  const makeLevelMetrics = (level, startStep) => ({
    level,
    reached: true,
    completed: false,
    died: false,
    startStep,
    endStep: null,
    roomsExploredBeforeFirstCombat: null,
    turnsToFirstCombat: null,
    hpAtFirstCombat: null,
    gearFoundBeforeFirstCombat: null,
    relicFindTurns: null,
    exitTurnsAfterRelic: null,
    relicPickupExp: 0,
    enemiesEncounteredBeforeRelic: 0,
    combatsAfterRelic: 0,
    levelUpsBeforeExit: 0,
    combatsStartedAtEntry: game.telemetry.combatsStarted,
    damageTakenAtEntry: game.telemetry.playerDamageTaken,
    levelUpsAtEntry: game.telemetry.levelUps,
    combats: 0,
    damageTaken: 0,
    roomsExploredTotal: 0,
    lastNewRoomStep: startStep,
    currentStep: startStep,
    finalized: false,
  });
  perLevel.set(activeLevel, makeLevelMetrics(activeLevel, 0));

  const currentMetrics = () => perLevel.get(activeLevel);
  const countGear = () => Number(Boolean(game.player.equippedWeapon)) + Number(Boolean(game.player.equippedArmor));
  const finalizeMetrics = (metrics, endStep = steps) => {
    if (!metrics) return;
    if (metrics.finalized) return;
    metrics.endStep = metrics.endStep ?? endStep;
    metrics.combats = game.telemetry.combatsStarted - metrics.combatsStartedAtEntry;
    metrics.damageTaken = game.telemetry.playerDamageTaken - metrics.damageTakenAtEntry;
    metrics.roomsExploredTotal = Math.max(metrics.roomsExploredTotal, visited.size);
    if (metrics.roomsExploredBeforeFirstCombat === null) {
      metrics.roomsExploredBeforeFirstCombat = visited.size;
      metrics.turnsToFirstCombat = steps - metrics.startStep;
      metrics.hpAtFirstCombat = game.player.hp;
      metrics.gearFoundBeforeFirstCombat = countGear();
    }
    metrics.finalized = true;
  };
  const enterLevel = (level) => {
    activeLevel = level;
    visited = new Set([`${game.player.x},${game.player.y}`]);
    pathStack = [];
    lastCombatsStarted = game.telemetry.combatsStarted;
    lastLevelUps = game.telemetry.levelUps;
    if (!perLevel.has(level)) perLevel.set(level, makeLevelMetrics(level, steps));
  };
  const updateLevelChange = () => {
    if (game.level === activeLevel) return;
    const previous = currentMetrics();
    previous.completed = true;
    if (previous.relicFindTurns !== null) previous.exitTurnsAfterRelic = steps - previous.startStep - previous.relicFindTurns;
    finalizeMetrics(previous);
    enterLevel(game.level);
  };
  let lastCombatsStarted = 0;
  let lastLevelUps = 0;
  let now = performance.now();
  let steps = 0;
  let stalled = false;

  while (steps < maxSteps && game.state !== "gameover" && game.level < targetLevel) {
    steps += 1;
    now += 800;

    while (game.state === "combat" && game.combat && !game.combat.isOver) {
      const metrics = currentMetrics();
      if (metrics.roomsExploredBeforeFirstCombat === null) {
        metrics.roomsExploredBeforeFirstCombat = visited.size;
        metrics.turnsToFirstCombat = steps - metrics.startStep;
        metrics.hpAtFirstCombat = game.player.hp;
        metrics.gearFoundBeforeFirstCombat = countGear();
      }
      now += 800;
      handleCombat(game, now);
      if (!game.combat && game.state !== "combat") break;
      if (steps++ > maxSteps) break;
    }

    if (game.state !== "explore") {
      game.update(now);
      continue;
    }

    const metrics = currentMetrics();
    metrics.currentStep = steps;
    if (game.telemetry.combatsStarted > lastCombatsStarted) {
      const combatDelta = game.telemetry.combatsStarted - lastCombatsStarted;
      if (!game.player.gotRelic) metrics.enemiesEncounteredBeforeRelic += combatDelta;
      else metrics.combatsAfterRelic += combatDelta;
    }
    lastCombatsStarted = game.telemetry.combatsStarted;
    if (game.telemetry.levelUps > lastLevelUps) {
      metrics.levelUpsBeforeExit += game.telemetry.levelUps - lastLevelUps;
      lastLevelUps = game.telemetry.levelUps;
    }
    if (game.player.gotRelic && metrics.relicFindTurns === null) {
      metrics.relicFindTurns = steps - metrics.startStep;
      metrics.relicPickupExp = game.relicExpAwardedThisLevel;
    }

    const hasActionItem = game.player.currentRoom.decorations.some((item) => services.ui.itemCategoryMap.has(item) || item.startsWith("reality "));
    if (hasActionItem) game.pickUpOrEquip();

    const direction = chooseDirection(game, visited, pathStack, metrics);
    if (!direction) {
      stalled = true;
      break;
    }
    const previousVisitedSize = visited.size;
    game.movePlayer(direction);
    updateLevelChange();
    visited.add(`${game.player.x},${game.player.y}`);
    if (visited.size > previousVisitedSize) currentMetrics().lastNewRoomStep = steps;
    game.update(now);
  }

  const summary = game.telemetry.summary();
  const finalRelicRoom = findRoomWithCategory(game, "K");
  const finalTargetRoom = [...game.gameMap.rooms.values()].find((candidate) => candidate.isTarget) ?? null;
  if (game.state === "gameover") {
    const metrics = currentMetrics();
    if (metrics) metrics.died = true;
  }
  for (const metrics of perLevel.values()) finalizeMetrics(metrics);
  return {
    outcome: game.state === "gameover" ? "death" : game.level >= targetLevel ? "level_complete" : stalled ? "stalled" : "step_limit",
    state: game.state,
    steps,
    level: game.level,
    finalHP: game.player.hp,
    inventoryCount: game.player.inventory.items.length,
    gotRelic: game.player.gotRelic,
    hasMap: game.player.hasMap,
    hasCompass: game.player.hasCompass,
    visibilityRadius: game.player.visibilityRadius,
    relicExists: Boolean(finalRelicRoom),
    relicRouteLength: finalRelicRoom ? findPath(game.player.currentRoom, finalRelicRoom).length : null,
    exitExists: Boolean(finalTargetRoom),
    exitRouteLength: finalTargetRoom ? findPath(game.player.currentRoom, finalTargetRoom).length : null,
    currentRoomDecorations: [...game.player.currentRoom.decorations],
    currentRoomEnemies: game.player.currentRoom.enemies.length,
    equippedWeapon: game.player.equippedWeapon,
    equippedArmor: game.player.equippedArmor,
    telemetry: summary,
    level1Metrics: perLevel.get(1),
    perLevel: Object.fromEntries(perLevel),
    telemetrySummaries,
  };
}

export async function runAiBatch(options = {}) {
  const words = JSON.parse(await readFile(new URL("../../assets/data/words.json", import.meta.url), "utf8"));
  const iterations = options.iterations ?? 100;
  const results = [];
  for (let index = 0; index < iterations; index += 1) {
    results.push(runAiPlayer(words, { ...options, name: `AI_${index + 1}` }));
  }

  const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const round = (value) => value === null ? null : Number(value.toFixed(3));
  const startRealmLevel = options.startRealmLevel ?? 1;
  const targetLevel = options.targetLevel ?? 11;
  const levelsToReport = Array.from({ length: Math.max(0, targetLevel - startRealmLevel) }, (_, index) => startRealmLevel + index);
  const levelRows = levelsToReport.map((level) => {
    const reached = results.map((result) => result.perLevel[level]).filter(Boolean);
    const completed = reached.filter((metrics) => metrics.completed).length;
    const deaths = reached.filter((metrics) => metrics.died).length;
    const relicTurns = reached.map((metrics) => metrics.relicFindTurns).filter((value) => value !== null);
    const exitTurns = reached.map((metrics) => metrics.exitTurnsAfterRelic).filter((value) => value !== null);
    return {
      level,
      reachedRuns: reached.length,
      levelCompletionRate: reached.length ? round(completed / reached.length) : null,
      deathRate: reached.length ? round(deaths / reached.length) : null,
      avgCombats: round(average(reached.map((metrics) => metrics.combats))),
      avgDamageTaken: round(average(reached.map((metrics) => metrics.damageTaken))),
      avgRoomsExploredTotal: round(average(reached.map((metrics) => metrics.roomsExploredTotal))),
      avgRoomsExploredBeforeFirstCombat: round(average(reached.map((metrics) => metrics.roomsExploredBeforeFirstCombat))),
      avgTurnsToFirstCombat: round(average(reached.map((metrics) => metrics.turnsToFirstCombat))),
      avgHPAtFirstCombat: round(average(reached.map((metrics) => metrics.hpAtFirstCombat))),
      avgLevelUpsBeforeExit: round(average(reached.map((metrics) => metrics.levelUpsBeforeExit))),
      avgGearFoundBeforeFirstCombat: round(average(reached.map((metrics) => metrics.gearFoundBeforeFirstCombat))),
      percentRunsWithLevelUpBeforeExit: reached.length ? round(reached.filter((metrics) => metrics.levelUpsBeforeExit > 0).length / reached.length) : null,
      avgEnemiesEncounteredBeforeRelic: round(average(reached.map((metrics) => metrics.enemiesEncounteredBeforeRelic))),
      avgCombatsBeforeRelic: round(average(reached.map((metrics) => metrics.enemiesEncounteredBeforeRelic))),
      avgCombatsAfterRelic: round(average(reached.map((metrics) => metrics.combatsAfterRelic))),
      avgRelicPickupExp: round(average(reached.map((metrics) => metrics.relicPickupExp))),
      avgRelicFindTurns: round(average(relicTurns)),
      avgExitTurnsAfterRelic: round(average(exitTurns)),
    };
  });

  const outcomes = {
    iterations,
    startRealmLevel,
    targetLevel,
    buildPreset: options.buildPreset ?? "baseline",
    completedThroughTarget: results.filter((result) => result.outcome === "level_complete").length,
    deaths: results.filter((result) => result.outcome === "death").length,
    stepLimits: results.filter((result) => result.outcome === "step_limit").length,
    stalled: results.filter((result) => result.outcome === "stalled").length,
  };

  console.group("AI player harness");
  console.table(outcomes);
  console.table(levelRows);
  console.groupEnd();
  return { summary: { outcomes, levels: levelRows }, results };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const positionalIterations = Number(args.find((arg) => !arg.startsWith("--")));
  const optionValue = (name, fallback) => {
    const prefix = `--${name}=`;
    const inline = args.find((arg) => arg.startsWith(prefix));
    if (inline) return inline.slice(prefix.length);
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : fallback;
  };
  const iterations = Number(optionValue("iterations", Number.isFinite(positionalIterations) && positionalIterations > 0 ? positionalIterations : 100));
  const startRealmLevel = Number(optionValue("start", 1));
  const targetLevel = Number(optionValue("target", startRealmLevel > 1 ? startRealmLevel + 1 : 11));
  const maxSteps = Number(optionValue("maxSteps", 60000));
  const buildPreset = optionValue("preset", "baseline");
  await runAiBatch({
    iterations: Number.isFinite(iterations) && iterations > 0 ? iterations : 100,
    startRealmLevel: Number.isFinite(startRealmLevel) && startRealmLevel > 0 ? startRealmLevel : 1,
    targetLevel: Number.isFinite(targetLevel) && targetLevel > 0 ? targetLevel : 11,
    maxSteps: Number.isFinite(maxSteps) && maxSteps > 0 ? maxSteps : 60000,
    buildPreset,
  });
}
