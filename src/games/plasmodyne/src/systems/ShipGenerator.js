import { DECK_GENERATION, SHIP_GENERATION } from '../data/constants.js';
import { FloorplanGenerator } from './FloorplanGenerator.js';
import { SeededRandom } from '../utils/seededRandom.js';
import { TILE_TYPES } from '../data/tileTypes.js';
import { getDeckInfo, formatDeckTitle } from '../data/deckNames.js';

export class ShipGenerator {
  constructor(config = DECK_GENERATION) {
    this.config = config;
    this.floorplans = new FloorplanGenerator(config);
  }

  generateShip(seed = SHIP_GENERATION.seed) {
    const elevatorTopology = this.generateElevatorTopology(seed, SHIP_GENERATION.deckCount);
    const levelPlans = this.createLevelPlans(seed, elevatorTopology, SHIP_GENERATION.deckCount);
    const decks = [];
    for (let index = 0; index < SHIP_GENERATION.deckCount; index += 1) {
      const deckId = index + 1;
      const deckSeed = `${seed}:deck-${deckId}`;
      const deck = this.generate(deckSeed, {
        id: deckId,
        name: formatDeckTitle(deckId),
        levelPlan: levelPlans.find((plan) => plan.deckId === deckId)
      });
      deck.deckInfo = getDeckInfo(deckId);
      deck.discovered = deckId === 1;
      decks.push(deck);
    }

    this.addElevatorTopology(decks, elevatorTopology);
    this.markLiftTiles(decks);
    this.assignRegions(decks);
    if (this.repairMissingLevelShaftAccess(decks, elevatorTopology)) {
      this.markLiftTiles(decks);
      this.assignRegions(decks);
    }
    this.assertEveryLevelHasShaftAccess(decks);
    const elevatorShafts = this.deriveElevatorShafts(decks, elevatorTopology);
    const hullSilhouette = this.deriveShipHullSilhouette(decks, elevatorShafts);

    return {
      seed,
      decks,
      elevatorShafts,
      hullSilhouette,
      startDeckId: 1,
      startShaftId: elevatorTopology.shafts[0]?.id ?? null,
      startRegionId: decks[0]?.regions?.find((region) => region.isStartRegion)?.id ?? null,
      currentDeckId: 1,
      totalDroids: 0,
      neutralizedDroids: 0
    };
  }

  generate(seed = this.config.seed, overrides = {}) {
    const deckId = overrides.id ?? this.config.id;
    const random = new SeededRandom(seed);
    return this.floorplans.generate(
      random,
      deckId,
      overrides.name ?? this.config.name,
      seed,
      overrides.levelPlan ?? null
    );
  }

  createLevelPlans(seed, topology, deckCount) {
    const random = new SeededRandom(`${seed}:level-plan`);
    const shaftsByDeck = new Map();
    for (let deckId = 1; deckId <= deckCount; deckId += 1) {
      shaftsByDeck.set(deckId, topology.shafts.filter((shaft) => shaft.servedDeckIds.includes(deckId)));
    }
    const multiDecks = [...shaftsByDeck.entries()]
      .filter(([, shafts]) => shafts.length > 1)
      .map(([deckId]) => deckId);
    const splitDecks = new Set();
    const connectorDecks = new Set([2, 4, 6, 8, 10]);
    for (const deckId of multiDecks) {
      if (connectorDecks.has(deckId) || deckId === 9 || deckId === deckCount) {
        continue;
      }
      const reserveInterchange = multiDecks.length > 2 &&
        (deckId === multiDecks[Math.floor(multiDecks.length * 0.55)] || deckId === multiDecks[multiDecks.length - 1]) &&
        splitDecks.size >= Math.max(2, multiDecks.length - 2);
      if (reserveInterchange) {
        continue;
      }
      const forceSplit = splitDecks.size < Math.min(6, Math.max(2, multiDecks.length - 2));
      if (forceSplit || random.chance(0.76)) {
        splitDecks.add(deckId);
      }
    }

    const plans = [...shaftsByDeck.entries()].map(([deckId, shafts]) => {
      const split = splitDecks.has(deckId);
      const levels = split
        ? shafts.slice(0, 3).map((shaft, index, splitShafts) => this.createPlannedLevel(deckId, [shaft], index, true, splitShafts.length))
        : [this.createPlannedLevel(deckId, shafts, 0, false, 1)];
      return {
        deckId,
        splitPlanned: split,
        interchangePlanned: !split && shafts.length > 1,
        levels
      };
    });
    this.assignPlannedLevelSizeMix(random, plans);
    return plans;
  }

  createPlannedLevel(deckId, shafts, index, splitPlanned, levelCount = 1) {
    const averageXBand = shafts.length
      ? shafts.reduce((sum, shaft) => sum + (shaft.xBand ?? 0.5), 0) / shafts.length
      : 0.5;
    const sizeClass = this.pickPlannedLevelSizeClass(deckId, index, splitPlanned, levelCount, shafts);
    return {
      plannedLevelId: `deck-${deckId}-planned-level-${index + 1}`,
      deckId,
      connectedShaftIds: shafts.map((shaft) => shaft.id),
      xBand: averageXBand,
      sizeClass,
      splitPlanned,
      interchangePlanned: !splitPlanned && shafts.length > 1
    };
  }

  assignPlannedLevelSizeMix(random, plans) {
    const levels = plans.flatMap((plan) => plan.levels);
    if (!levels.length) return;

    const quotas = this.getLevelSizeQuotas(levels.length);
    const unassigned = new Set(levels);
    const assignByScore = (sizeClass, count, scorer) => {
      for (let i = 0; i < count; i += 1) {
        const candidate = [...unassigned]
          .map((level) => ({ level, score: scorer(level) + random.next() * 0.01 }))
          .sort((a, b) => b.score - a.score)[0]?.level;
        if (!candidate) return;
        candidate.sizeClass = sizeClass;
        unassigned.delete(candidate);
      }
    };

    assignByScore('tiny', quotas.tiny, (level) => {
      const shortShaftScore = level.connectedShaftIds.length === 1 ? 1 : 0;
      const edgeScore = level.deckId <= 2 || level.deckId >= SHIP_GENERATION.deckCount - 1 ? 1 : 0;
      return shortShaftScore * 3 + edgeScore * 2 + (level.splitPlanned ? 1 : 0) - Math.abs(level.deckId - 5.5) * 0.12;
    });
    assignByScore('huge', quotas.huge, (level) => {
      const centrality = 1 - Math.min(1, Math.abs(level.deckId - 5.5) / 5);
      return centrality * 4 + (level.interchangePlanned ? 3 : 0) + level.connectedShaftIds.length * 0.5;
    });
    assignByScore('large', quotas.large, (level) => {
      const centrality = 1 - Math.min(1, Math.abs(level.deckId - 5.5) / 5);
      return centrality * 3 + (level.interchangePlanned ? 1.5 : 0) + (level.splitPlanned ? 0.5 : 0);
    });
    assignByScore('small', quotas.small, (level) => {
      const edgeScore = level.deckId <= 3 || level.deckId >= 8 ? 1 : 0;
      return edgeScore * 1.5 + (level.splitPlanned ? 2 : 0) + (level.connectedShaftIds.length === 1 ? 1 : 0);
    });

    for (const level of unassigned) {
      level.sizeClass = 'regular';
    }
  }

  getLevelSizeQuotas(levelCount) {
    return {
      tiny: Math.min(3, Math.max(2, Math.floor(levelCount * 0.14))),
      small: Math.min(4, Math.max(2, Math.round(levelCount * 0.18))),
      regular: 0,
      large: Math.min(4, Math.max(2, Math.round(levelCount * 0.2))),
      huge: Math.min(2, Math.max(1, Math.round(levelCount * 0.12)))
    };
  }

  pickPlannedLevelSizeClass(deckId, index, splitPlanned, levelCount, shafts = []) {
    const shaftCount = shafts.length;
    const shortestShaftStops = Math.min(...shafts.map((shaft) => shaft.servedDeckIds?.length ?? 99), 99);
    if (shaftCount === 1 && shortestShaftStops <= 3 && (deckId <= 3 || deckId >= 9)) return 'tiny';
    if (!splitPlanned) {
      if (deckId === 1 || deckId === SHIP_GENERATION.deckCount) return 'tiny';
      if (deckId === 9) return 'huge';
      if (shaftCount > 1 && deckId >= 4 && deckId <= 8) return deckId === 5 || deckId === 6 ? 'huge' : 'large';
      if (deckId === 3 || deckId === 8) return 'large';
      return 'regular';
    }
    if (levelCount === 2 && deckId >= 2 && deckId <= 3) {
      return index === 0 ? 'small' : 'large';
    }
    if (levelCount >= 3) {
      return index === 1 ? 'regular' : 'small';
    }
    if (deckId >= 5 && deckId <= 8) {
      return index === 0 ? 'regular' : 'large';
    }
    return index === 0 ? 'small' : 'regular';
  }

  generateElevatorTopology(seed, deckCount) {
    const random = new SeededRandom(`${seed}:elevator-topology`);
    const shaftCount = deckCount >= 10
      ? Math.max(SHIP_GENERATION.elevatorShaftMin, Math.min(SHIP_GENERATION.elevatorShaftMax, 7))
      : deckCount >= 8 && random.chance(0.65) ? 4 : 3;
    const definitions = [
      { id: 'main-shaft', label: 'Main Shaft', shaftType: 'main', xBand: 0.14, isMainPath: true, debugColor: 0x79f2c0 },
      { id: 'industrial-shaft', label: 'Industrial Shaft', shaftType: 'industrial', xBand: 0.28, isMainPath: false, debugColor: 0xff9b42 },
      { id: 'security-shaft', label: 'Security Shaft', shaftType: 'security', xBand: 0.42, isMainPath: false, debugColor: 0xb66bff },
      { id: 'core-shaft', label: 'Core Shaft', shaftType: 'core', xBand: 0.56, isMainPath: false, debugColor: 0xff3b3b },
      { id: 'service-shaft', label: 'Service Shaft', shaftType: 'service', xBand: 0.68, isMainPath: false, debugColor: 0x8ff0ff },
      { id: 'relay-shaft', label: 'Relay Shaft', shaftType: 'relay', xBand: 0.78, isMainPath: false, debugColor: 0xc6ff52 },
      { id: 'spine-shaft', label: 'Spine Shaft', shaftType: 'spine', xBand: 0.86, isMainPath: false, debugColor: 0xffd447 },
      { id: 'null-shaft', label: 'Null Shaft', shaftType: 'null', xBand: 0.93, isMainPath: false, debugColor: 0xf3d9ff }
    ];
    const shafts = definitions.slice(0, shaftCount).map((definition) => ({
      ...definition,
      servedDeckIds: new Set(),
      stops: []
    }));

    const interchangeDecks = [];
    const plannedAccess = shaftCount >= 6 && deckCount === 10
      ? [
        [0, 4],
        [0, 1, 4],
        [0, 2],
        [1, 2],
        [1, 3],
        [2, 3, 6],
        [5, 6],
        [3, 5],
        [5, 6],
        [5]
      ]
      : null;
    if (plannedAccess) {
      plannedAccess.forEach((shaftIndexes, index) => {
        const deckId = index + 1;
        for (const shaftIndex of shaftIndexes) {
          shafts[Math.min(shaftIndex, shafts.length - 1)].servedDeckIds.add(deckId);
        }
        if (shaftIndexes.length > 1) {
          interchangeDecks.push(deckId);
        }
      });
    } else {
      for (let i = 0; i < shaftCount - 1; i += 1) {
        const ideal = Math.round(((i + 1) / shaftCount) * deckCount);
        let deckId = Math.max(2, Math.min(deckCount - 1, ideal + random.integer(-1, 1)));
        while (interchangeDecks.includes(deckId)) {
          deckId = Math.min(deckCount - 1, deckId + 1);
          if (interchangeDecks.includes(deckId) && deckId >= deckCount - 1) {
            deckId = Math.max(2, ideal - 1);
          }
        }
        interchangeDecks.push(deckId);
        shafts[i].servedDeckIds.add(deckId);
        shafts[i + 1].servedDeckIds.add(deckId);
      }

      for (let deckId = 1; deckId <= deckCount; deckId += 1) {
        if (interchangeDecks.includes(deckId)) {
          continue;
        }
        const primary = Math.min(shaftCount - 1, Math.floor(((deckId - 1) / deckCount) * shaftCount));
        shafts[primary].servedDeckIds.add(deckId);
      }

      shafts[0].servedDeckIds.add(1);
      shafts[shaftCount - 1].servedDeckIds.add(deckCount);
    }

    for (let i = 0; i < shafts.length; i += 1) {
      if (shafts[i].servedDeckIds.size < 2) {
        const fallbackDeck = Math.max(1, Math.min(deckCount, Math.round(((i + 0.5) / shaftCount) * deckCount)));
        shafts[i].servedDeckIds.add(fallbackDeck);
        shafts[i].servedDeckIds.add(i === 0 ? 1 : interchangeDecks[i - 1] ?? deckCount);
      }
      if (shafts[i].servedDeckIds.size >= deckCount) {
        shafts[i].servedDeckIds.delete(i === 0 ? deckCount : 1);
      }
      while (shafts[i].servedDeckIds.size > SHIP_GENERATION.elevatorShaftMaxStops) {
        shafts[i].servedDeckIds.delete([...shafts[i].servedDeckIds].sort((a, b) => b - a)[0]);
      }
    }

    return {
      shaftCount,
      interchangeDecks,
      shafts: shafts.map((shaft) => ({
        ...shaft,
        servedDeckIds: [...shaft.servedDeckIds].sort((a, b) => a - b)
      }))
    };
  }

  addElevatorTopology(decks, topology) {
    for (const shaft of topology.shafts) {
      for (const deckId of shaft.servedDeckIds) {
        const deck = decks.find((item) => item.id === deckId);
        if (!deck) continue;
        const accessIndexOnDeck = deck.lifts.length;
        const preferStartRoom = deck.id === 1 && shaft.isMainPath;
        const room = this.pickLiftRoom(deck, preferStartRoom, null, shaft.xBand, shaft.id);
        const connectsToDeckIds = shaft.servedDeckIds.filter((id) => id !== deck.id);
        deck.lifts.push(this.createLift(deck, room, shaft, connectsToDeckIds, accessIndexOnDeck));
      }
    }
    for (const deck of decks) {
      deck.shaftStopIds = deck.lifts.map((lift) => lift.id);
      deck.isInterchangeDeck = deck.lifts.length > 1;
    }
  }

  addMainLiftNetwork(decks) {
    for (const deck of decks) {
      const connectsToDeckIds = [];
      if (deck.id > 1) connectsToDeckIds.push(deck.id - 1);
      if (deck.id < decks.length) connectsToDeckIds.push(deck.id + 1);
      const room = this.pickLiftRoom(deck, deck.id === 1);
      deck.lifts.push(this.createLift(deck, room, 'main-lift', 'Main Lift', connectsToDeckIds));
    }
  }

  addExpressLiftNetwork(decks) {
    if (decks.length < 5) return;
    const endpoints = [decks[0], decks[Math.floor(decks.length / 2)], decks[decks.length - 1]];
    for (const deck of endpoints) {
      const connectsToDeckIds = endpoints.map((item) => item.id).filter((id) => id !== deck.id);
      const room = this.pickLiftRoom(deck, false, 'main-lift');
      deck.lifts.push(this.createLift(deck, room, 'express-lift', 'Express Lift', connectsToDeckIds));
    }
  }

  pickLiftRoom(deck, preferStartRoom = false, avoidNetworkId = null, xBand = 0.5, shaftId = null) {
    const occupiedRoomIds = new Set(
      deck.lifts
        .filter((lift) => !avoidNetworkId || lift.networkId === avoidNetworkId)
        .map((lift) => lift.roomId)
    );
    const targetX = (deck.footprint?.x ?? 0) + (deck.footprint?.width ?? deck.bounds.width) * xBand;
    const plannedLevel = shaftId
      ? deck.levelPlan?.levels?.find((level) => level.connectedShaftIds?.includes(shaftId))
      : null;
    if (preferStartRoom) {
      const startRoom = deck.rooms.find((room) => room.id === deck.startRoomId);
      if (startRoom && (!plannedLevel || startRoom.plannedLevelId === plannedLevel.plannedLevelId)) {
        return startRoom;
      }
    }
    const candidatePool = plannedLevel
      ? deck.rooms.filter((room) => room.plannedLevelId === plannedLevel.plannedLevelId)
      : deck.rooms;
    const candidates = candidatePool
      .filter((room) => !occupiedRoomIds.has(room.id))
      .sort((a, b) => {
        const clearanceScore = this.clearanceForRoom(a) - this.clearanceForRoom(b);
        if (clearanceScore !== 0) return clearanceScore;
        const typeScore = (a.type === 'security' ? 1 : 0) - (b.type === 'security' ? 1 : 0);
        if (typeScore !== 0) return typeScore;
        return Math.abs(a.centerX - targetX) - Math.abs(b.centerX - targetX);
      });
    return candidates[0] ??
      candidatePool.find((room) => !occupiedRoomIds.has(room.id)) ??
      this.createSyntheticLiftHostRoom(deck, plannedLevel, shaftId) ??
      deck.rooms.find((room) => !occupiedRoomIds.has(room.id)) ??
      deck.rooms[0];
  }

  createSyntheticLiftHostRoom(deck, plannedLevel, shaftId) {
    if (!plannedLevel) return null;
    const tileSize = deck.tileMap?.tileSize ?? 64;
    const candidates = [];
    const footprint = deck.playableFootprints?.find((item) => item.plannedLevelId === plannedLevel.plannedLevelId);
    for (const row of deck.tileMap.tiles) {
      for (const tile of row) {
        if (tile.plannedLevelId === plannedLevel.plannedLevelId &&
          [TILE_TYPES.CORRIDOR_FLOOR, TILE_TYPES.ROOM_FLOOR].includes(tile.tileType) &&
          (!footprint || (
            tile.x - 1 >= footprint.x &&
            tile.y - 1 >= footprint.y &&
            tile.x + 2 <= footprint.x + footprint.width &&
            tile.y + 2 <= footprint.y + footprint.height
          ))) {
          candidates.push(tile);
        }
      }
    }
    const tile = candidates.sort((a, b) =>
      Math.abs(a.x / Math.max(1, deck.tileMap.columns) - (plannedLevel.xBand ?? 0.5)) -
      Math.abs(b.x / Math.max(1, deck.tileMap.columns) - (plannedLevel.xBand ?? 0.5))
    )[0];
    if (!tile) return null;
    const id = `synthetic-lift-host-${shaftId}-deck-${deck.id}`;
    const room = {
      id,
      type: 'lift-access',
      label: 'Lift Access',
      color: 0x79f2c0,
      x: (tile.x - 1) * tileSize,
      y: (tile.y - 1) * tileSize,
      width: 3 * tileSize,
      height: 3 * tileSize,
      centerX: tile.x * tileSize + tileSize / 2,
      centerY: tile.y * tileSize + tileSize / 2,
      grid: { x: tile.x - 1, y: tile.y - 1, width: 3, height: 3 },
      plannedLevelId: plannedLevel.plannedLevelId,
      doors: [],
      discovered: false,
      cleared: false
    };
    for (let y = tile.y - 1; y <= tile.y + 1; y += 1) {
      for (let x = tile.x - 1; x <= tile.x + 1; x += 1) {
        const target = deck.tileMap.tiles[y]?.[x];
        if (!target) continue;
        target.tileType = TILE_TYPES.ROOM_FLOOR;
        target.roomId = id;
        target.plannedLevelId = plannedLevel.plannedLevelId;
      }
    }
    deck.rooms.push(room);
    return room;
  }

  createLift(deck, room, shaftOrNetworkId, labelOrConnectsToDeckIds, maybeConnectsToDeckIds, accessIndexOnDeck = 0) {
    const legacy = typeof shaftOrNetworkId === 'string';
    const shaft = legacy ? {
      id: shaftOrNetworkId,
      label: labelOrConnectsToDeckIds,
      shaftType: shaftOrNetworkId,
      xBand: shaftOrNetworkId === 'express-lift' ? 0.35 : 0.65,
      isMainPath: shaftOrNetworkId === 'main-lift'
    } : shaftOrNetworkId;
    const connectsToDeckIds = legacy ? maybeConnectsToDeckIds : labelOrConnectsToDeckIds;
    const targetX = (deck.footprint?.x ?? 0) + (deck.footprint?.width ?? deck.bounds.width) * shaft.xBand;
    const preferredX = Math.max(room.x + 80, Math.min(room.x + room.width - 80, targetX));
    const preferredY = Math.max(room.y + 80, Math.min(room.y + room.height - 80, room.centerY));
    const point = this.findClearLiftPoint(deck, room, preferredX, preferredY);
    return {
      id: `${shaft.id}-deck-${deck.id}`,
      networkId: shaft.id,
      shaftType: shaft.shaftType,
      xBand: shaft.xBand,
      accessIndexOnDeck,
      deckId: deck.id,
      roomId: room.id,
      x: point.x,
      y: point.y,
      radius: SHIP_GENERATION.liftRadius,
      connectsToDeckIds,
      label: shaft.label,
      color: shaft.debugColor,
      clearanceRequirement: 0,
      discovered: deck.id === 1 && room.id === deck.startRoomId
    };
  }

  findClearLiftPoint(deck, room, preferredX, preferredY) {
    const tileSize = deck.tileMap?.tileSize ?? 32;
    const candidates = this.getWallAdjacentLiftCandidates(room, tileSize);
    const snapToCellCenter = (value) => Math.floor(value / tileSize) * tileSize + tileSize / 2;
    candidates.push(
      { x: snapToCellCenter(preferredX), y: snapToCellCenter(preferredY) },
      { x: snapToCellCenter(room.centerX), y: snapToCellCenter(room.centerY) },
      { x: snapToCellCenter(room.centerX - 96), y: snapToCellCenter(room.centerY) },
      { x: snapToCellCenter(room.centerX + 96), y: snapToCellCenter(room.centerY) },
      { x: snapToCellCenter(room.centerX), y: snapToCellCenter(room.centerY - 96) },
      { x: snapToCellCenter(room.centerX), y: snapToCellCenter(room.centerY + 96) }
    );
    for (const candidate of candidates) {
      const gx = Math.floor(candidate.x / tileSize);
      const gy = Math.floor(candidate.y / tileSize);
      if (this.canStampLiftRoom(deck, gx, gy)) {
        return candidate;
      }
    }
    return { x: snapToCellCenter(preferredX), y: snapToCellCenter(preferredY) };
  }

  getWallAdjacentLiftCandidates(room, tileSize) {
    const candidates = [];
    const minX = room.grid.x + 1;
    const maxX = room.grid.x + room.grid.width - 2;
    const minY = room.grid.y + 1;
    const maxY = room.grid.y + room.grid.height - 2;
    const push = (gx, gy) => candidates.push({ x: gx * tileSize + tileSize / 2, y: gy * tileSize + tileSize / 2 });
    for (let x = minX; x <= maxX; x += 1) {
      push(x, minY);
      push(x, maxY);
    }
    for (let y = minY; y <= maxY; y += 1) {
      push(minX, y);
      push(maxX, y);
    }
    return candidates;
  }

  canStampLiftRoom(deck, centerX, centerY) {
    for (let y = centerY - 1; y <= centerY + 1; y += 1) {
      for (let x = centerX - 1; x <= centerX + 1; x += 1) {
        const tile = deck.tileMap?.tiles[y]?.[x];
        if (!tile || ![TILE_TYPES.ROOM_FLOOR, TILE_TYPES.CORRIDOR_FLOOR].includes(tile.tileType)) {
          return false;
        }
      }
    }
    return true;
  }

  markLiftTiles(decks) {
    for (const deck of decks) {
      deck.liftRooms = [];
      for (const lift of deck.lifts) {
        const tileSize = deck.tileMap.tileSize;
        const centerX = Math.floor(lift.x / tileSize);
        const centerY = Math.floor(lift.y / tileSize);
        const liftRoom = {
          id: `lift-room-${lift.id}`,
          deckId: deck.id,
          roomId: lift.roomId,
          shaftId: lift.networkId,
          gridX: centerX - 1,
          gridY: centerY - 1,
          width: 3,
          height: 3,
          centerGridX: centerX,
          centerGridY: centerY,
          x: (centerX - 1) * tileSize,
          y: (centerY - 1) * tileSize,
          worldX: centerX * tileSize + tileSize / 2,
          worldY: centerY * tileSize + tileSize / 2
        };
        deck.liftRooms.push(liftRoom);
        lift.liftRoomId = liftRoom.id;
        lift.x = liftRoom.worldX;
        lift.y = liftRoom.worldY;
        for (let y = centerY - 1; y <= centerY + 1; y += 1) {
          for (let x = centerX - 1; x <= centerX + 1; x += 1) {
            const tile = deck.tileMap.tiles[y]?.[x];
            if (!tile) continue;
            tile.tileType = x === centerX && y === centerY ? TILE_TYPES.LIFT_PAD : TILE_TYPES.LIFT_ROOM_FLOOR;
            tile.liftId = lift.id;
            tile.liftRoomId = liftRoom.id;
            tile.roomId = lift.roomId;
            tile.plannedLevelId = deck.rooms.find((room) => room.id === lift.roomId)?.plannedLevelId ?? tile.plannedLevelId;
          }
        }
      }
    }
  }

  assignRegions(decks) {
    for (const deck of decks) {
      const visited = new Set();
      const regions = [];
      for (const row of deck.tileMap.tiles) {
        for (const tile of row) {
          const key = `${tile.x},${tile.y}`;
          if (visited.has(key) || !this.isRegionWalkable(tile.tileType)) continue;
          const cells = [];
          const roomIds = new Set();
          const hallIds = new Set();
          const liftRoomIds = new Set();
          const connectedShaftIds = new Set();
          const queue = [tile];
          visited.add(key);
          while (queue.length) {
            const current = queue.shift();
            cells.push(current);
            if (current.roomId) roomIds.add(current.roomId);
            if (current.corridorId) hallIds.add(current.corridorId);
            if (current.liftRoomId) liftRoomIds.add(current.liftRoomId);
            if (current.liftId) {
              const lift = deck.lifts.find((item) => item.id === current.liftId);
              if (lift) connectedShaftIds.add(lift.networkId);
            }
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const next = deck.tileMap.tiles[current.y + dy]?.[current.x + dx];
              const nextKey = next ? `${next.x},${next.y}` : '';
              if (!next || visited.has(nextKey) || !this.isRegionWalkable(next.tileType)) continue;
              if (current.plannedLevelId && next.plannedLevelId && current.plannedLevelId !== next.plannedLevelId) continue;
              visited.add(nextKey);
              queue.push(next);
            }
          }
          const xs = cells.map((cell) => cell.x);
          const ys = cells.map((cell) => cell.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);
          if (liftRoomIds.size === 0 && (roomIds.size === 0 || cells.length < 8)) {
            for (const cell of cells) {
              cell.tileType = TILE_TYPES.WALL_FILL;
              cell.wallFill = true;
            }
            continue;
          }
          const id = `deck-${deck.id}-region-${regions.length + 1}`;
          const startRoom = deck.rooms.find((room) => room.id === deck.startRoomId);
          const isStartRegion = deck.id === 1 && startRoom && cells.some((cell) => cell.roomId === startRoom.id);
          const roomIdList = [...roomIds];
          const hallIdList = [...hallIds];
          const liftRoomIdList = [...liftRoomIds];
          const connectedShaftIdList = [...connectedShaftIds];
          const widthCells = maxX - minX + 1;
          const heightCells = maxY - minY + 1;
          const hallCellCount = cells.filter((cell) => cell.corridorId).length;
          const footprintWidth = Math.max(1, deck.footprint?.width ?? deck.bounds.width);
          const xBand = Math.max(0, Math.min(1, ((minX + maxX + 1) * deck.tileMap.tileSize / 2 - (deck.footprint?.x ?? 0)) / footprintWidth));
          const plannedLevel = deck.levelPlan?.levels?.find((level) =>
            [...connectedShaftIds].some((shaftId) => level.connectedShaftIds?.includes(shaftId))
          ) ?? deck.levelPlan?.levels?.find((level) =>
            roomIdList.some((roomId) => deck.rooms.find((room) => room.id === roomId)?.plannedLevelId === level.plannedLevelId)
          ) ?? null;
          const shapeProfile = this.pickLevelShapeProfile(widthCells, heightCells, cells.length, deck.id);
          regions.push({
            id,
            levelId: id,
            plannedLevelId: plannedLevel?.plannedLevelId ?? null,
            deckId: deck.id,
            roomIds: roomIdList,
            hallIds: hallIdList,
            liftRoomIds: liftRoomIdList,
            boundsCells: {
              minX,
              maxX,
              minY,
              maxY
            },
            widthCells,
            heightCells,
            bounds: {
              x: minX * deck.tileMap.tileSize,
              y: minY * deck.tileMap.tileSize,
              width: widthCells * deck.tileMap.tileSize,
              height: heightCells * deck.tileMap.tileSize
            },
            walkableCellCount: cells.length,
            roomCount: roomIdList.length,
            hallCellCount,
            xBand,
            connectedShaftIds: connectedShaftIdList,
            isStartRegion,
            isDisconnected: false,
            isDisconnectedRegion: false,
            splitPlanned: Boolean(plannedLevel?.splitPlanned),
            interchangePlanned: Boolean(plannedLevel?.interchangePlanned),
            sizeClass: plannedLevel?.sizeClass ?? 'regular',
            levelShapeProfile: shapeProfile,
            shapeProfile,
            isInterchangeLevel: connectedShaftIdList.length > 1,
            isInterchangeRegion: connectedShaftIdList.length > 1
          });
        }
      }
      if (regions.length > 1) {
        for (const region of regions) {
          region.isDisconnected = true;
          region.isDisconnectedRegion = true;
        }
      }
      deck.regions = regions;
      deck.levels = regions;
      for (const lift of deck.lifts) {
        const region = regions.find((item) => item.liftRoomIds.includes(lift.liftRoomId));
        lift.regionId = region?.id ?? null;
      }
    }
  }

  repairMissingLevelShaftAccess(decks, topology) {
    let addedLift = false;
    for (const deck of decks) {
      for (const region of deck.regions ?? []) {
        if (region.connectedShaftIds?.length) continue;
        const plannedLevel = deck.levelPlan?.levels?.find((level) => level.plannedLevelId === region.plannedLevelId);
        const shaftId = plannedLevel?.connectedShaftIds?.[0];
        const shaft = topology?.shafts?.find((item) => item.id === shaftId);
        const room = deck.rooms.find((item) => region.roomIds?.includes(item.id));
        if (!shaft || !room) continue;
        const connectsToDeckIds = shaft.servedDeckIds.filter((id) => id !== deck.id);
        deck.lifts.push(this.createLift(deck, room, shaft, connectsToDeckIds, deck.lifts.length));
        addedLift = true;
      }
      deck.shaftStopIds = deck.lifts.map((lift) => lift.id);
      deck.isInterchangeDeck = deck.lifts.length > 1;
    }
    return addedLift;
  }

  assertEveryLevelHasShaftAccess(decks) {
    const orphanLevels = [];
    for (const deck of decks) {
      for (const region of deck.regions ?? []) {
        if (!(region.connectedShaftIds?.length > 0)) {
          orphanLevels.push(`deck ${deck.id} ${region.id}`);
        }
      }
    }
    if (orphanLevels.length) {
      throw new Error(`Generated levels without elevator access: ${orphanLevels.join(', ')}`);
    }
  }

  pickLevelShapeProfile(widthCells, heightCells, walkableCellCount, deckId) {
    const aspect = widthCells / Math.max(1, heightCells);
    if (walkableCellCount >= 420) return 'BULKHEAD';
    if (heightCells >= 22 && walkableCellCount >= 260) return 'STACKED';
    if (aspect >= 1.9 && (deckId <= 2 || deckId >= 9)) return 'TAPERED';
    if (walkableCellCount >= 150 || heightCells >= 15) return 'STEPPED';
    return 'RECT';
  }

  deriveElevatorShafts(decks, topology = null) {
    const shafts = new Map();
    for (const shaft of topology?.shafts ?? []) {
      shafts.set(shaft.id, {
        id: shaft.id,
        label: shaft.label,
        shaftType: shaft.shaftType,
        xBand: shaft.xBand,
        isMainPath: shaft.isMainPath,
        color: shaft.debugColor,
        servedDeckIds: shaft.servedDeckIds,
        stops: []
      });
    }
    for (const deck of decks) {
      for (const lift of deck.lifts) {
        if (!shafts.has(lift.networkId)) {
          shafts.set(lift.networkId, {
            id: lift.networkId,
            label: lift.label,
            shaftType: lift.shaftType,
            xBand: lift.xBand,
            isMainPath: lift.networkId === 'main-shaft' || lift.networkId === 'main-lift',
            servedDeckIds: [],
            stops: []
          });
        }
        shafts.get(lift.networkId).stops.push({
          shaftId: lift.networkId,
          deckId: deck.id,
          regionId: lift.regionId,
          liftRoomId: lift.liftRoomId,
          gridX: Math.floor(lift.x / deck.tileMap.tileSize),
          gridY: Math.floor(lift.y / deck.tileMap.tileSize),
          accessIndexOnDeck: lift.accessIndexOnDeck ?? 0
        });
      }
    }
    return [...shafts.values()].map((shaft) => ({
      ...shaft,
      servedDeckIds: [...new Set([
        ...(shaft.servedDeckIds ?? []),
        ...shaft.stops.map((stop) => stop.deckId)
      ])].sort((a, b) => a - b),
      stops: shaft.stops.sort((a, b) => a.deckId - b.deckId)
    }));
  }

  deriveShipHullSilhouette(decks, elevatorShafts = []) {
    const cellByKey = new Map();
    for (const deck of decks) {
      for (const row of deck.tileMap.tiles) {
        for (const tile of row) {
          if (!this.isRegionWalkable(tile.tileType)) continue;
          const key = `${tile.x},${tile.y}`;
          const existing = cellByKey.get(key);
          if (existing) {
            existing.deckIds.push(deck.id);
            existing.weight += 1;
          } else {
            cellByKey.set(key, {
              x: tile.x,
              y: tile.y,
              deckIds: [deck.id],
              weight: 1
            });
          }
        }
      }
    }
    const cells = [...cellByKey.values()];
    const boundsCells = cells.length
      ? {
        minX: Math.min(...cells.map((cell) => cell.x)),
        maxX: Math.max(...cells.map((cell) => cell.x)),
        minY: Math.min(...cells.map((cell) => cell.y)),
        maxY: Math.max(...cells.map((cell) => cell.y))
      }
      : { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const shaftMarkers = elevatorShafts.map((shaft) => {
      const stops = shaft.stops ?? [];
      return {
        shaftId: shaft.id,
        shaftType: shaft.shaftType,
        xBand: shaft.xBand,
        gridX: stops.length ? stops.reduce((sum, stop) => sum + stop.gridX, 0) / stops.length : 0,
        gridY: stops.length ? stops.reduce((sum, stop) => sum + stop.gridY, 0) / stops.length : 0,
        stopCount: stops.length
      };
    });
    return {
      boundsCells,
      cells,
      shaftMarkers
    };
  }

  isRegionWalkable(tileType) {
    return tileType === TILE_TYPES.ROOM_FLOOR ||
      tileType === TILE_TYPES.CORRIDOR_FLOOR ||
      tileType === TILE_TYPES.DOOR ||
      tileType === TILE_TYPES.LIFT_ROOM_FLOOR ||
      tileType === TILE_TYPES.LIFT_PAD ||
      tileType === TILE_TYPES.TERMINAL ||
      tileType === TILE_TYPES.ALERT_BOX ||
      tileType === TILE_TYPES.REPAIR_PAD;
  }

  clearanceForRoom(room) {
    const byType = {
      maintenance: 0,
      utility: 0,
      dormitory: 0,
      cargo: 1,
      medical: 1,
      engineering: 2,
      security: 3,
      bridge: 3,
      reactor: 4,
      'data-core': 4
    };
    return byType[room.type] ?? 0;
  }
}
