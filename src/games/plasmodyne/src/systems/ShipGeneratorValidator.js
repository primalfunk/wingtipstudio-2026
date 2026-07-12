import { TILE_TYPES } from '../data/tileTypes.js';

export const GENERATOR_VALIDATION_TARGETS = {
  targetWalkableCoverageMin: 16,
  targetWalkableCoverageMax: 88,
  maxLargestInteriorSolidRegion: 900,
  maxCorridorRatio: 34,
  maxDeadEndCount: 18,
  minElevatorShafts: 6,
  maxElevatorShafts: 8,
  requiredMainPath: true,
  fixedDeckCount: 10,
  levelRatioWarningMin: 8,
  levelRatioTargetMin: 12,
  levelRatioTargetMax: 20,
  smallestMeaningfulLevelMinCells: 70,
  targetTotalLevelWalkableCells: 6000
};

const LEVEL_AREA_BANDS = {
  tiny: { min: 100, max: 209 },
  small: { min: 210, max: 379 },
  regular: { min: 380, max: 629 },
  large: { min: 630, max: 929 },
  huge: { min: 930, max: 1350 }
};

export class ShipGeneratorValidator {
  validate(ship) {
    const errors = [];
    const warnings = [];
    const deckMetrics = ship.decks.map((deck) => this.validateDeck(deck, errors, warnings));
    const shafts = this.deriveElevatorShafts(ship);
    const reachableDeckIds = this.getReachableDeckIds(ship);
    const inaccessibleDecks = ship.decks.filter((deck) => !reachableDeckIds.has(deck.id)).map((deck) => deck.id);
    const levelMetrics = this.validateLevels(ship, errors, warnings);

    if (ship.decks.length !== GENERATOR_VALIDATION_TARGETS.fixedDeckCount) {
      errors.push(`Ship has ${ship.decks.length} decks; expected ${GENERATOR_VALIDATION_TARGETS.fixedDeckCount}`);
    }
    if (inaccessibleDecks.length) {
      errors.push(`Unreachable decks: ${inaccessibleDecks.join(', ')}`);
    }
    const unreachableLevels = this.getUnreachableLevelIds(ship);
    if (unreachableLevels.length) {
      errors.push(`Unreachable elevator levels: ${unreachableLevels.join(', ')}`);
    }
    if (!reachableDeckIds.has(ship.decks[ship.decks.length - 1]?.id)) {
      errors.push('No main lift path reaches final deck');
    }
    if (shafts.length < GENERATOR_VALIDATION_TARGETS.minElevatorShafts) {
      errors.push(`Too few elevator shafts: ${shafts.length}`);
    }
    if (shafts.length > GENERATOR_VALIDATION_TARGETS.maxElevatorShafts) {
      errors.push(`Too many elevator shafts: ${shafts.length}`);
    }
    this.validateElevatorTopology(ship, shafts, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      shafts,
      metrics: {
        deckCount: ship.decks.length,
        totalRooms: ship.decks.reduce((sum, deck) => sum + deck.rooms.length, 0),
        totalDroids: ship.decks.reduce((sum, deck) => sum + (deck.droids?.length ?? 0), 0),
        totalLifts: ship.decks.reduce((sum, deck) => sum + (deck.lifts?.length ?? 0), 0),
        elevatorShaftCount: shafts.length,
        reachableDeckCount: reachableDeckIds.size,
        inaccessibleDecks,
        highestRequiredClearance: this.getHighestRequiredClearance(ship),
        levels: levelMetrics.levels,
        totalLevels: levelMetrics.levels.length,
        levelAreaBandCounts: levelMetrics.levelAreaBandCounts,
        splitDeckCount: levelMetrics.splitDeckCount,
        interchangeDeckCount: levelMetrics.interchangeDeckCount,
        smallestMeaningfulLevelArea: levelMetrics.smallestMeaningfulArea,
        largestMeaningfulLevelArea: levelMetrics.largestMeaningfulArea,
        largestSmallestMeaningfulLevelRatio: levelMetrics.ratio,
        totalLevelWalkableCells: levelMetrics.totalWalkableCells,
        decks: deckMetrics
      }
    };
  }

  validateDeck(deck, errors, warnings) {
    const metrics = deck.validation?.metrics ?? this.computeDeckMetrics(deck);
    const unreachableRooms = deck.validation?.unreachableRooms ?? [];
    const roomsWithoutDoors = [];
    const invalidDoors = this.findInvalidDoors(deck);
    const invalidLifts = this.findInvalidLifts(deck);
    const deadEndCount = this.countDeadEnds(deck);
    const lockedRooms = deck.rooms.filter((room) => (room.doors ?? []).some((door) => door.clearanceRequirement > 0 || door.locked)).length;
    const roomsWithTooManyDoors = [];
    const invalidLiftRooms = this.findInvalidLiftRooms(deck);
    const invalidLevelMetadata = this.findInvalidLevelMetadata(deck);
    const sizes = deck.rooms.map((room) => room.grid.width * room.grid.height);

    if (unreachableRooms.length) errors.push(`Deck ${deck.id}: unreachable rooms ${unreachableRooms.join(', ')}`);
    if (invalidDoors.length) errors.push(`Deck ${deck.id}: invalid doors ${invalidDoors.join(', ')}`);
    if (invalidLifts.length) errors.push(`Deck ${deck.id}: invalid lifts ${invalidLifts.join(', ')}`);
    if (invalidLiftRooms.length) errors.push(`Deck ${deck.id}: invalid lift rooms ${invalidLiftRooms.join(', ')}`);
    if (invalidLevelMetadata.length) errors.push(`Deck ${deck.id}: levels missing metadata ${invalidLevelMetadata.join(', ')}`);
    if (lockedRooms > 0) errors.push(`Deck ${deck.id}: locked traversal doors found`);
    if (metrics.walkableCoveragePercent < GENERATOR_VALIDATION_TARGETS.targetWalkableCoverageMin) warnings.push(`Deck ${deck.id}: low walkable coverage ${metrics.walkableCoveragePercent}%`);
    if (metrics.walkableCoveragePercent > GENERATOR_VALIDATION_TARGETS.targetWalkableCoverageMax) warnings.push(`Deck ${deck.id}: high walkable coverage ${metrics.walkableCoveragePercent}%`);
    if (metrics.corridorFloorPercent > GENERATOR_VALIDATION_TARGETS.maxCorridorRatio) warnings.push(`Deck ${deck.id}: high corridor ratio ${metrics.corridorFloorPercent}%`);
    if (metrics.largestSolidInteriorRegion > GENERATOR_VALIDATION_TARGETS.maxLargestInteriorSolidRegion) warnings.push(`Deck ${deck.id}: large solid region ${metrics.largestSolidInteriorRegion}`);
    if (deadEndCount > GENERATOR_VALIDATION_TARGETS.maxDeadEndCount) warnings.push(`Deck ${deck.id}: high dead-end count ${deadEndCount}`);

    return {
      deckId: deck.id,
      roomCount: deck.rooms.length,
      corridorCount: deck.corridors.length,
      doorCount: deck.doors.length,
      liftCount: deck.lifts.length,
      terminalCount: deck.terminals.length,
      droidCount: deck.droids?.length ?? 0,
      walkableCoveragePercent: metrics.walkableCoveragePercent,
      roomFloorPercent: metrics.roomFloorPercent,
      corridorFloorPercent: metrics.corridorFloorPercent,
      playableDensityPercent: metrics.playableDensityPercent ?? metrics.walkableCoveragePercent,
      corridorAreaPercent: metrics.corridorAreaPercent ?? 0,
      sharedWallRatio: metrics.sharedWallRatio ?? 0,
      loopCount: metrics.loopCount ?? 0,
      roomAdjacencyCount: metrics.roomAdjacencyCount ?? 0,
      solidVoidPercent: Math.round((100 - metrics.walkableCoveragePercent) * 10) / 10,
      largestInteriorSolidRegion: metrics.largestSolidInteriorRegion,
      unreachableRoomCount: unreachableRooms.length,
      deadEndCount,
      averageRoomSize: metrics.averageRoomSize,
      minRoomSize: sizes.length ? Math.min(...sizes) : 0,
      maxRoomSize: sizes.length ? Math.max(...sizes) : 0,
      invalidDoorCount: invalidDoors.length,
      roomsWithoutDoors: roomsWithoutDoors.length,
      clearanceLockedRoomCount: lockedRooms,
      invalidLiftRoomCount: invalidLiftRooms.length,
      regionCount: deck.regions?.length ?? 0,
      levelCount: deck.levels?.length ?? deck.regions?.length ?? 0
    };
  }

  validateLevels(ship, errors, warnings) {
    const levels = ship.decks.flatMap((deck) => (deck.levels ?? deck.regions ?? []).map((level) => ({
      deckId: deck.id,
      levelId: level.levelId ?? level.id,
      widthCells: level.widthCells ?? 0,
      heightCells: level.heightCells ?? 0,
      walkableCellCount: level.walkableCellCount ?? 0,
      roomCount: level.roomCount ?? level.roomIds?.length ?? 0,
      hallCellCount: level.hallCellCount ?? 0,
      terminalCount: this.countTerminalsForLevel(deck, level),
      connectedShaftIds: level.connectedShaftIds ?? [],
      isInterchangeLevel: Boolean(level.isInterchangeLevel ?? level.isInterchangeRegion),
      isDisconnected: Boolean(level.isDisconnected ?? level.isDisconnectedRegion)
    })));

    for (const deck of ship.decks) {
      const deckLevels = deck.levels ?? deck.regions ?? [];
      if (deckLevels.length < 1 || deckLevels.length > 3) {
        errors.push(`Deck ${deck.id}: expected 1-3 levels, found ${deckLevels.length}`);
      }
      if (deck.levelPlan?.splitPlanned && deckLevels.length < deck.levelPlan.levels.length) {
        errors.push(`Deck ${deck.id}: planned split levels accidentally connected`);
      }
      if (deck.levelPlan?.interchangePlanned && deckLevels.length > 1) {
        warnings.push(`Deck ${deck.id}: planned interchange level partially split into ${deckLevels.length} levels`);
      }
      for (const level of deckLevels) {
        if (!(level.connectedShaftIds?.length > 0)) {
          errors.push(`Deck ${deck.id}: level ${level.levelId ?? level.id} has no shaft access`);
        }
        const terminalCount = this.countTerminalsForLevel(deck, level);
        const requirement = this.getTerminalRequirementForLevel(level);
        if (terminalCount < requirement.min) {
          errors.push(`Deck ${deck.id}: level ${level.levelId ?? level.id} has ${terminalCount} terminals; expected at least ${requirement.min}`);
        }
        if (terminalCount > requirement.max) {
          warnings.push(`Deck ${deck.id}: level ${level.levelId ?? level.id} has ${terminalCount} terminals; expected ${requirement.min}-${requirement.max}`);
        }
      }
    }

    const meaningful = levels.filter((level) =>
      level.walkableCellCount >= GENERATOR_VALIDATION_TARGETS.smallestMeaningfulLevelMinCells &&
      (level.roomCount > 0 || level.hallCellCount > 0)
    );
    const areas = meaningful.map((level) => level.walkableCellCount);
    const smallestMeaningfulArea = areas.length ? Math.min(...areas) : 0;
    const largestMeaningfulArea = areas.length ? Math.max(...areas) : 0;
    const ratio = smallestMeaningfulArea > 0 ? Math.round((largestMeaningfulArea / smallestMeaningfulArea) * 10) / 10 : 0;

    const levelAreaBandCounts = this.countLevelAreaBands(levels);
    const totalWalkableCells = levels.reduce((sum, level) => sum + (level.walkableCellCount ?? 0), 0);
    if (levelAreaBandCounts.tiny < 2 || levelAreaBandCounts.tiny > 4) {
      warnings.push(`Expected 2-4 tiny levels, found ${levelAreaBandCounts.tiny}`);
    }
    if (levelAreaBandCounts.large < 2 || levelAreaBandCounts.large > 3) {
      warnings.push(`Expected 2-3 large levels, found ${levelAreaBandCounts.large}`);
    }
    if (levelAreaBandCounts.huge < 1 || levelAreaBandCounts.huge > 2) {
      warnings.push(`Expected 1-2 huge levels, found ${levelAreaBandCounts.huge}`);
    }

    if (meaningful.length >= 2 && ratio < GENERATOR_VALIDATION_TARGETS.levelRatioWarningMin) {
      warnings.push(`Largest/smallest meaningful level ratio too low: ${ratio}x`);
    } else if (meaningful.length >= 2 && ratio < GENERATOR_VALIDATION_TARGETS.levelRatioTargetMin) {
      warnings.push(`Level size ratio below broad tiny-to-huge target: ${ratio}x`);
    } else if (ratio > GENERATOR_VALIDATION_TARGETS.levelRatioTargetMax * 1.5) {
      warnings.push(`Level size ratio may be too extreme: ${ratio}x`);
    }
    if (totalWalkableCells < GENERATOR_VALIDATION_TARGETS.targetTotalLevelWalkableCells) {
      warnings.push(`Total level walkable cells below target: ${totalWalkableCells}/${GENERATOR_VALIDATION_TARGETS.targetTotalLevelWalkableCells}`);
    }
    const splitDeckCount = ship.decks.filter((deck) => (deck.levels ?? deck.regions ?? []).length > 1).length;
    const interchangeDeckCount = ship.decks.filter((deck) =>
      (deck.levels ?? deck.regions ?? []).some((level) => (level.connectedShaftIds ?? []).length > 1)
    ).length;
    if (splitDeckCount === 0) {
      warnings.push('No split decks generated');
    } else if (splitDeckCount < 2) {
      warnings.push(`Fewer than 2 split decks generated: ${splitDeckCount}`);
    }

    return {
      levels,
      levelAreaBandCounts,
      totalWalkableCells,
      splitDeckCount,
      interchangeDeckCount,
      smallestMeaningfulArea,
      largestMeaningfulArea,
      ratio
    };
  }

  countLevelAreaBands(levels) {
    const counts = {
      tiny: 0,
      small: 0,
      regular: 0,
      large: 0,
      huge: 0,
      other: 0
    };
    for (const level of levels) {
      const area = level.walkableCellCount ?? 0;
      const band = Object.entries(LEVEL_AREA_BANDS)
        .find(([, range]) => area >= range.min && area <= range.max)?.[0] ?? 'other';
      counts[band] += 1;
    }
    return counts;
  }

  countTerminalsForLevel(deck, level) {
    const roomIds = new Set(level.roomIds ?? []);
    return (deck.terminals ?? []).filter((terminal) => roomIds.has(terminal.roomId)).length;
  }

  getTerminalRequirementForLevel(level) {
    const sizeClass = level.sizeClass ?? 'regular';
    if (sizeClass === 'tiny') return { min: 1, max: 1 };
    if (sizeClass === 'small') return { min: 1, max: 2 };
    if (sizeClass === 'large') return { min: 2, max: 3 };
    if (sizeClass === 'huge') return { min: 3, max: 4 };
    return { min: 1, max: 2 };
  }

  deriveElevatorShafts(ship) {
    if (ship.elevatorShafts?.length) {
      return ship.elevatorShafts.map((shaft) => ({
        id: shaft.id,
        label: shaft.label,
        shaftType: shaft.shaftType,
        xBand: shaft.xBand,
        color: shaft.color,
        servedDeckIds: [...new Set(shaft.stops.map((stop) => stop.deckId))].sort((a, b) => a - b),
        clearanceRequirementByStop: Object.fromEntries(shaft.stops.map((stop) => [stop.deckId, 0])),
        isMainPath: shaft.isMainPath,
        isShortcut: !shaft.isMainPath,
        stops: shaft.stops
      }));
    }
    const byId = new Map();
    for (const deck of ship.decks) {
      for (const lift of deck.lifts ?? []) {
        if (!byId.has(lift.networkId)) {
          byId.set(lift.networkId, {
            id: lift.networkId,
            servedDeckIds: new Set(),
            clearanceRequirementByStop: new Map(),
            isMainPath: lift.networkId === 'main-shaft' || lift.networkId === 'main-lift',
            isShortcut: lift.networkId !== 'main-shaft' && lift.networkId !== 'main-lift'
          });
        }
        const shaft = byId.get(lift.networkId);
        shaft.servedDeckIds.add(deck.id);
        for (const id of lift.connectsToDeckIds ?? []) shaft.servedDeckIds.add(id);
        shaft.clearanceRequirementByStop.set(deck.id, lift.clearanceRequirement ?? 0);
      }
    }
    return [...byId.values()].map((shaft) => ({
      ...shaft,
      servedDeckIds: [...shaft.servedDeckIds].sort((a, b) => a - b),
      clearanceRequirementByStop: Object.fromEntries(shaft.clearanceRequirementByStop)
    }));
  }

  validateElevatorTopology(ship, shafts, errors, warnings) {
    const deckCount = ship.decks.length;
    const accessCounts = new Map(ship.decks.map((deck) => [deck.id, 0]));
    for (const shaft of shafts) {
      if (shaft.servedDeckIds.length < 2) {
        errors.push(`Shaft ${shaft.id} has fewer than 2 stops`);
      }
      if (shaft.servedDeckIds.length >= deckCount) {
        errors.push(`Shaft ${shaft.id} serves every deck`);
      }
      if ((shaft.stops?.length ?? shaft.servedDeckIds.length) > 4) {
        errors.push(`Shaft ${shaft.id} has ${shaft.stops?.length ?? shaft.servedDeckIds.length} stops; maximum is 4`);
      }
      for (const deckId of shaft.servedDeckIds) {
        accessCounts.set(deckId, (accessCounts.get(deckId) ?? 0) + 1);
      }
    }

    const zeroAccess = [...accessCounts.entries()].filter(([, count]) => count === 0).map(([deckId]) => deckId);
    const oneAccess = [...accessCounts.values()].filter((count) => count === 1).length;
    const twoAccess = [...accessCounts.values()].filter((count) => count === 2).length;
    const excessiveAccess = [...accessCounts.entries()].filter(([, count]) => count > 3).map(([deckId]) => deckId);

    if (zeroAccess.length) {
      errors.push(`Decks without elevator access: ${zeroAccess.join(', ')}`);
    }
    if (excessiveAccess.length) {
      warnings.push(`Decks with 4+ elevator accesses: ${excessiveAccess.join(', ')}`);
    }
    if (oneAccess < 2) {
      warnings.push('Too few simple single-access decks for dense elevator topology');
    }
    if (twoAccess === 0) {
      warnings.push('No two-shaft interchange decks generated');
    }

    const signatures = shafts.map((shaft) => shaft.servedDeckIds.join(','));
    if (new Set(signatures).size !== signatures.length) {
      warnings.push('Some elevator shafts overlap completely');
    }
    const veryShortCount = shafts.filter((shaft) => {
      const count = shaft.stops?.length ?? shaft.servedDeckIds.length;
      return count >= 2 && count <= 3;
    }).length;
    if (veryShortCount < 3) {
      errors.push(`Expected at least three very short shafts with 2-3 stops, found ${veryShortCount}`);
    }
  }

  getReachableDeckIds(ship) {
    const reached = new Set();
    const queue = [ship.currentDeckId ?? 1];
    while (queue.length) {
      const id = queue.shift();
      if (reached.has(id)) continue;
      reached.add(id);
      const deck = ship.decks.find((item) => item.id === id);
      for (const lift of deck?.lifts ?? []) {
        for (const next of lift.connectsToDeckIds ?? []) {
          if (!reached.has(next)) queue.push(next);
        }
      }
    }
    return reached;
  }

  getUnreachableLevelIds(ship) {
    const levels = ship.decks.flatMap((deck) => (deck.levels ?? deck.regions ?? []).map((level) => ({
      id: level.levelId ?? level.id,
      shaftIds: level.connectedShaftIds ?? []
    })));
    if (!levels.length) return [];
    const byShaft = new Map();
    for (const level of levels) {
      for (const shaftId of level.shaftIds) {
        if (!byShaft.has(shaftId)) byShaft.set(shaftId, []);
        byShaft.get(shaftId).push(level.id);
      }
    }
    const reached = new Set();
    const queue = [levels[0].id];
    while (queue.length) {
      const id = queue.shift();
      if (reached.has(id)) continue;
      reached.add(id);
      const level = levels.find((item) => item.id === id);
      for (const shaftId of level?.shaftIds ?? []) {
        for (const next of byShaft.get(shaftId) ?? []) {
          if (!reached.has(next)) queue.push(next);
        }
      }
    }
    return levels.filter((level) => !reached.has(level.id)).map((level) => level.id);
  }

  findInvalidDoors(deck) {
    return deck.doors.filter((door) => !door.width || !door.height || !['horizontal', 'vertical'].includes(door.orientation)).map((door) => door.id);
  }

  findInvalidLifts(deck) {
    return deck.lifts.filter((lift) => {
      const tile = this.getTile(deck, lift.x, lift.y);
      return !tile || ![TILE_TYPES.LIFT_PAD].includes(tile.tileType);
    }).map((lift) => lift.id);
  }

  findInvalidLiftRooms(deck) {
    const invalid = [];
    for (const liftRoom of deck.liftRooms ?? []) {
      let padCount = 0;
      let roomFloorCount = 0;
      let repairCount = 0;
      for (let y = liftRoom.gridY; y < liftRoom.gridY + 3; y += 1) {
        for (let x = liftRoom.gridX; x < liftRoom.gridX + 3; x += 1) {
          const tile = deck.tileMap.tiles[y]?.[x];
          if (tile?.tileType === TILE_TYPES.LIFT_PAD) padCount += 1;
          if (tile?.tileType === TILE_TYPES.LIFT_ROOM_FLOOR) roomFloorCount += 1;
          if (tile?.tileType === TILE_TYPES.REPAIR_PAD) repairCount += 1;
        }
      }
      const doorCount = this.countLiftRoomDoors(deck, liftRoom);
      if (liftRoom.width !== 3 ||
        liftRoom.height !== 3 ||
        padCount !== 1 ||
        roomFloorCount !== 8 ||
        repairCount > 0 ||
        doorCount < 1 ||
        doorCount > 4) {
        invalid.push(liftRoom.id);
      }
    }
    return invalid;
  }

  countLiftRoomDoors(deck, liftRoom) {
    const seen = new Set();
    let openAccessEdges = 0;
    for (let y = liftRoom.gridY; y < liftRoom.gridY + liftRoom.height; y += 1) {
      for (let x = liftRoom.gridX; x < liftRoom.gridX + liftRoom.width; x += 1) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const inside = x + dx >= liftRoom.gridX &&
            x + dx < liftRoom.gridX + liftRoom.width &&
            y + dy >= liftRoom.gridY &&
            y + dy < liftRoom.gridY + liftRoom.height;
          if (inside) continue;
          const tile = deck.tileMap.tiles[y + dy]?.[x + dx];
          if (tile?.tileType === TILE_TYPES.DOOR && tile.doorId) {
            seen.add(tile.doorId);
          } else if (this.isWalkable(tile?.tileType)) {
            openAccessEdges += 1;
          }
        }
      }
    }
    return Math.max(seen.size, openAccessEdges > 0 ? 1 : 0);
  }

  findInvalidLevelMetadata(deck) {
    const required = [
      'levelId',
      'deckId',
      'boundsCells',
      'widthCells',
      'heightCells',
      'walkableCellCount',
      'roomCount',
      'hallCellCount',
      'xBand',
      'connectedShaftIds',
      'liftRoomIds',
      'isDisconnected',
      'isInterchangeLevel'
    ];
    return (deck.levels ?? deck.regions ?? [])
      .filter((level) => required.some((key) => level[key] === undefined || level[key] === null))
      .map((level) => level.levelId ?? level.id ?? 'unknown');
  }

  countDeadEnds(deck) {
    let count = 0;
    for (const row of deck.tileMap.tiles) {
      for (const tile of row) {
        if (!this.isWalkable(tile.tileType)) continue;
        const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => this.isWalkable(deck.tileMap.tiles[tile.y + dy]?.[tile.x + dx]?.tileType)).length;
        if (neighbors === 1) count += 1;
      }
    }
    return count;
  }

  getHighestRequiredClearance(ship) {
    return Math.max(0, ...ship.decks.flatMap((deck) => [
      ...deck.lifts.map((lift) => lift.clearanceRequirement ?? 0),
      ...deck.terminals.map((terminal) => terminal.clearanceRequirement ?? 0)
    ]));
  }

  getTile(deck, x, y) {
    const tileSize = deck.tileMap.tileSize;
    return deck.tileMap.tiles[Math.floor(y / tileSize)]?.[Math.floor(x / tileSize)] ?? null;
  }

  isWalkable(tileType) {
    return [TILE_TYPES.ROOM_FLOOR, TILE_TYPES.CORRIDOR_FLOOR, TILE_TYPES.DOOR, TILE_TYPES.LIFT_ROOM_FLOOR, TILE_TYPES.LIFT_PAD, TILE_TYPES.TERMINAL, TILE_TYPES.ALERT_BOX, TILE_TYPES.REPAIR_PAD].includes(tileType);
  }

  computeDeckMetrics(deck) {
    return deck.validation?.metrics ?? {};
  }
}
