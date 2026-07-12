import { DECK_GENERATION, SHIP_GENERATION } from '../data/constants.js';
import { SHIP_ROOM_TYPES, START_ROOM_TYPES } from '../data/shipRoomTypes.js';
import { TILE_TYPES } from '../data/tileTypes.js';
import { rectCenter } from '../utils/geometry.js';

const TILE_SIZE = 64;
const CORRIDOR_WIDTH_TILES = 2;
const DOOR_SPAN_TILES = 1;
const CARDINAL_DIRECTIONS = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
  east: { x: 1, y: 0 }
};

const FOOTPRINT_PROFILES = [
  { width: 18, height: 12 },
  { width: 28, height: 16 },
  { width: 42, height: 24 },
  { width: 54, height: 32 },
  { width: 64, height: 38 },
  { width: 58, height: 34 },
  { width: 64, height: 38 },
  { width: 48, height: 28 },
  { width: 56, height: 34 },
  { width: 22, height: 14 }
];

const LEVEL_SIZE_CLASSES = {
  tiny: { width: 16, height: 12, minRooms: 3, targetRooms: 5, maxRooms: 6, minWalkable: 110, maxWalkable: 179 },
  small: { width: 24, height: 16, minRooms: 5, targetRooms: 8, maxRooms: 10, minWalkable: 220, maxWalkable: 349 },
  regular: { width: 32, height: 22, minRooms: 9, targetRooms: 13, maxRooms: 16, minWalkable: 400, maxWalkable: 599 },
  large: { width: 42, height: 28, minRooms: 13, targetRooms: 18, maxRooms: 22, minWalkable: 650, maxWalkable: 899 },
  huge: { width: 52, height: 34, minRooms: 18, targetRooms: 24, maxRooms: 30, minWalkable: 980, maxWalkable: 1250 }
};

const ROOM_SIZE_CLASSES = {
  verySmall: { maxSum: 8, minSide: 2 },
  small: { maxSum: 10, minSide: 3 },
  regular: { maxSum: 14, minSide: 4 },
  large: { maxSum: 16, minSide: 6 },
  huge: { maxSum: 20, minSide: 7 }
};

const ROOM_SIZE_WEIGHTS_BY_LEVEL = {
  tiny: ['verySmall', 'verySmall', 'small', 'small', 'regular'],
  small: ['verySmall', 'small', 'small', 'regular', 'regular', 'large'],
  regular: ['small', 'small', 'regular', 'regular', 'regular', 'large', 'huge'],
  large: ['small', 'regular', 'regular', 'large', 'large', 'huge', 'huge'],
  huge: ['regular', 'regular', 'large', 'large', 'huge', 'huge', 'huge']
};

const ROOM_TYPE_BY_DECK = [
  ['maintenance', 'utility', 'cargo', 'dormitory', 'medical'],
  ['cargo', 'utility', 'maintenance', 'medical', 'engineering'],
  ['dormitory', 'medical', 'utility', 'cargo', 'security'],
  ['utility', 'medical', 'security', 'data-core', 'cargo'],
  ['security', 'data-core', 'medical', 'utility', 'engineering'],
  ['engineering', 'reactor', 'maintenance', 'security', 'utility'],
  ['engineering', 'reactor', 'maintenance', 'security', 'utility'],
  ['data-core', 'security', 'engineering', 'utility', 'reactor'],
  ['utility', 'bridge', 'data-core', 'security', 'engineering', 'reactor'],
  ['bridge', 'data-core', 'reactor', 'security', 'engineering']
];

export class FloorplanGenerator {
  constructor(config = DECK_GENERATION) {
    this.config = config;
    this.columns = Math.floor(config.width / TILE_SIZE);
    this.rows = Math.floor(config.height / TILE_SIZE);
  }

  generate(random, deckId, name, seed, levelPlan = null) {
    for (let attempt = 0; attempt < this.config.maxGenerationAttempts; attempt += 1) {
      const state = this.createEmptyState(random, deckId, levelPlan);
      this.generateDenseFacilities(state, random, deckId);
      if (!this.hasMinimumRoomsByFootprint(state) || !this.hasWalkableBudgetByFootprint(state)) {
        continue;
      }
      this.placeTerminals(state, random, deckId);
      if (!this.hasTerminalCoverageByFootprint(state)) {
        continue;
      }
      this.placeFixtures(state, random, deckId);
      const startRoom = this.pickStartRoom(state.rooms, deckId);
      const validation = this.validate(state, startRoom);
      if (!validation.valid) {
        continue;
      }
      this.markWallFillCells(state);
      return this.toDeck(state, deckId, name, seed, startRoom, validation);
    }

    throw new Error(`Unable to generate tile floorplan for deck ${deckId}`);
  }

  createEmptyState(random, deckId, levelPlan = null) {
    const profile = FOOTPRINT_PROFILES[deckId - 1] ?? FOOTPRINT_PROFILES[3];
    const playableFootprints = this.createPlayableFootprints(profile, levelPlan);
    const footprint = this.boundingFootprint(playableFootprints);
    const tiles = [];
    for (let y = 0; y < this.rows; y += 1) {
      tiles[y] = [];
      for (let x = 0; x < this.columns; x += 1) {
        tiles[y][x] = {
          x,
          y,
          tileType: TILE_TYPES.SOLID,
          roomId: null,
          corridorId: null,
          doorId: null,
          terminalId: null,
          liftId: null,
          discovered: false
        };
      }
    }
    return {
      random,
      footprint,
      playableFootprints,
      levelPlan,
      tiles,
      rooms: [],
      corridors: [],
      doors: [],
      terminals: [],
      fixtures: [],
      nextRoomIndex: 1
    };
  }

  createPlayableFootprints(profile, levelPlan) {
    const levels = levelPlan?.levels?.length ? levelPlan.levels : [{ xBand: 0.5 }];
    if (levels.length <= 1) {
      const levelSize = this.getLevelSize(levels[0]);
      const width = levelSize.width;
      const height = levelSize.height;
      return [{
        x: Math.floor((this.columns - width) / 2),
        y: Math.floor((this.rows - height) / 2),
        width,
        height,
        plannedLevelId: levels[0].plannedLevelId ?? null,
        xBand: levels[0].xBand ?? 0.5,
        sizeClass: levels[0].sizeClass ?? 'regular'
      }];
    }

    const margin = 3;
    const levelSizes = levels.map((level) => this.getLevelSize(level));
    const maxTotalWidth = this.columns - 4;
    const desiredTotalWidth = levelSizes.reduce((sum, item) => sum + item.width, 0) + margin * (levels.length - 1);
    const widthScale = desiredTotalWidth > maxTotalWidth
      ? (maxTotalWidth - margin * (levels.length - 1)) / Math.max(1, desiredTotalWidth - margin * (levels.length - 1))
      : 1;
    const widths = levelSizes.map((size) => Math.max(14, Math.floor(size.width * widthScale)));
    const totalWidth = widths.reduce((sum, width) => sum + width, 0) + margin * (levels.length - 1);
    const maxHeight = Math.max(...levelSizes.map((size) => size.height), profile.height);
    const baseX = Math.floor((this.columns - totalWidth) / 2);
    const baseY = Math.floor((this.rows - maxHeight) / 2);
    let cursorX = baseX;
    return levels.map((level, index) => {
      const size = levelSizes[index];
      const width = widths[index];
      const height = Math.max(10, Math.min(maxHeight, size.height));
      const yOffset = levels.length === 3 ? (index % 2) * 2 : index % 2;
      const footprint = {
        x: cursorX,
        y: baseY + Math.floor((maxHeight - height) / 2) + yOffset,
        width,
        height,
        plannedLevelId: level.plannedLevelId,
        xBand: level.xBand ?? ((index + 0.5) / levels.length),
        sizeClass: level.sizeClass ?? 'regular'
      };
      cursorX += width + margin;
      return footprint;
    });
  }

  getLevelSize(level) {
    return LEVEL_SIZE_CLASSES[level?.sizeClass] ?? LEVEL_SIZE_CLASSES.regular;
  }

  boundingFootprint(footprints) {
    const minX = Math.min(...footprints.map((item) => item.x));
    const minY = Math.min(...footprints.map((item) => item.y));
    const maxX = Math.max(...footprints.map((item) => item.x + item.width));
    const maxY = Math.max(...footprints.map((item) => item.y + item.height));
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  generateDenseFacilities(state, random, deckId) {
    for (const [index, footprint] of state.playableFootprints.entries()) {
      this.generateDenseFacilityForFootprint(state, random, deckId, footprint, index);
    }
  }

  generateDenseFacilityForFootprint(state, random, deckId, footprint, footprintIndex) {
    const levelSize = this.getLevelSize(footprint);
    const targetWalkable = random.integer(levelSize.minWalkable, levelSize.maxWalkable);
    const roomAreaDivisor = footprint.sizeClass === 'tiny'
      ? random.integer(20, 28)
      : random.integer(38, 54);
    const targetRooms = Math.max(
      levelSize.minRooms,
      Math.min(levelSize.maxRooms, Math.round(targetWalkable / roomAreaDivisor))
    );
    const mass = this.createDenseMassRect(footprint, targetWalkable);
    const roomRects = this.applyAsymmetricRoomShape(random, this.subdivideDenseMass(random, mass, targetRooms), mass, footprint);
    const rooms = [];

    for (const rect of roomRects) {
      const candidate = {
        corridor: { id: `dense-${footprintIndex + 1}`, plannedLevelId: footprint.plannedLevelId },
        roomRect: rect
      };
      const type = this.pickRoomType(random, state.rooms.length, deckId);
      const room = this.carveDenseRoom(state, candidate, type, state.nextRoomIndex);
      state.nextRoomIndex += 1;
      rooms.push(room);
    }

    this.connectDenseRooms(state, rooms, footprint, random, deckId);
    this.addDenseLoopConnections(state, rooms, footprint, random, deckId);
  }

  createDenseMassRect(footprint, targetWalkable) {
    const targetArea = Math.ceil(targetWalkable / 0.78);
    const aspect = footprint.width / Math.max(1, footprint.height);
    let width = Math.ceil(Math.sqrt(targetArea * aspect));
    let height = Math.ceil(targetArea / Math.max(1, width));
    width = Math.max(5, Math.min(footprint.width, width));
    height = Math.max(5, Math.min(footprint.height, height));
    while (width * height < targetArea && (width < footprint.width || height < footprint.height)) {
      if ((width / Math.max(1, height)) < aspect && width < footprint.width) width += 1;
      else if (height < footprint.height) height += 1;
      else width += 1;
    }
    return {
      x: footprint.x + Math.floor((footprint.width - width) / 2),
      y: footprint.y + Math.floor((footprint.height - height) / 2),
      width,
      height
    };
  }

  subdivideDenseMass(random, rect, targetRooms) {
    let leaves = [rect];
    let safety = 0;
    while (leaves.length < targetRooms && safety < targetRooms * 8) {
      safety += 1;
      const index = leaves
        .map((leaf, i) => ({ leaf, i, area: leaf.width * leaf.height }))
        .filter((item) => item.leaf.width >= 7 || item.leaf.height >= 7)
        .sort((a, b) => b.area - a.area)[0]?.i;
      if (index === undefined) break;
      const leaf = leaves.splice(index, 1)[0];
      const vertical = leaf.width > leaf.height ? true : leaf.height > leaf.width ? false : random.chance(0.5);
      const split = this.splitDenseRect(random, leaf, vertical);
      if (!split) {
        leaves.push(leaf);
        break;
      }
      leaves.push(split.a, split.b);
    }
    return leaves.filter((leaf) => leaf.width >= 3 && leaf.height >= 3);
  }

  splitDenseRect(random, rect, vertical) {
    if (vertical) {
      if (rect.width < 7) return null;
      const splitX = random.integer(rect.x + 3, rect.x + rect.width - 4);
      return {
        a: { x: rect.x, y: rect.y, width: splitX - rect.x, height: rect.height },
        b: { x: splitX + 1, y: rect.y, width: rect.x + rect.width - splitX - 1, height: rect.height }
      };
    }
    if (rect.height < 7) return null;
    const splitY = random.integer(rect.y + 3, rect.y + rect.height - 4);
    return {
      a: { x: rect.x, y: rect.y, width: rect.width, height: splitY - rect.y },
      b: { x: rect.x, y: splitY + 1, width: rect.width, height: rect.y + rect.height - splitY - 1 }
    };
  }

  applyAsymmetricRoomShape(random, rects, mass, footprint) {
    if (rects.length < 3) return rects;
    const shaped = rects.map((rect) => ({ ...rect }));
    const edgeRects = shaped.filter((rect) =>
      rect.x === mass.x ||
      rect.y === mass.y ||
      rect.x + rect.width === mass.x + mass.width ||
      rect.y + rect.height === mass.y + mass.height
    );
    const cuts = Math.min(edgeRects.length, footprint.sizeClass === 'tiny' ? 2 : footprint.sizeClass === 'small' ? 3 : 5);
    for (const rect of this.shuffle(random, edgeRects).slice(0, cuts)) {
      const canCutLeft = rect.x === mass.x && rect.width >= 6;
      const canCutRight = rect.x + rect.width === mass.x + mass.width && rect.width >= 6;
      const canCutTop = rect.y === mass.y && rect.height >= 6;
      const canCutBottom = rect.y + rect.height === mass.y + mass.height && rect.height >= 6;
      const options = [
        canCutLeft ? 'left' : null,
        canCutRight ? 'right' : null,
        canCutTop ? 'top' : null,
        canCutBottom ? 'bottom' : null
      ].filter(Boolean);
      if (!options.length) continue;
      const side = random.choice(options);
      const amount = random.integer(1, Math.min(4, side === 'left' || side === 'right' ? rect.width - 3 : rect.height - 3));
      if (side === 'left') {
        rect.x += amount;
        rect.width -= amount;
      } else if (side === 'right') {
        rect.width -= amount;
      } else if (side === 'top') {
        rect.y += amount;
        rect.height -= amount;
      } else if (side === 'bottom') {
        rect.height -= amount;
      }
    }
    return shaped.filter((rect) => rect.width >= 3 && rect.height >= 3);
  }

  carveDenseRoom(state, candidate, type, index) {
    const id = `room-${index}`;
    const worldRect = this.toWorldRect(candidate.roomRect);
    const center = rectCenter(worldRect);
    const room = {
      id,
      type: type.id,
      label: type.label,
      color: type.color,
      ...worldRect,
      centerX: center.x,
      centerY: center.y,
      grid: { ...candidate.roomRect },
      plannedLevelId: candidate.corridor?.plannedLevelId ?? null,
      doors: [],
      discovered: false,
      cleared: false
    };
    for (let y = candidate.roomRect.y; y < candidate.roomRect.y + candidate.roomRect.height; y += 1) {
      for (let x = candidate.roomRect.x; x < candidate.roomRect.x + candidate.roomRect.width; x += 1) {
        this.setTile(state, x, y, TILE_TYPES.ROOM_FLOOR, { roomId: id, plannedLevelId: room.plannedLevelId });
      }
    }
    state.rooms.push(room);
    return room;
  }

  connectDenseRooms(state, rooms, footprint, random, deckId) {
    const edges = this.findDenseRoomAdjacencies(rooms);
    const connected = new Set([rooms[0]?.id].filter(Boolean));
    const pending = new Set(rooms.slice(1).map((room) => room.id));

    while (pending.size) {
      const edge = this.shuffle(random, edges).find((item) =>
        (connected.has(item.a.id) && pending.has(item.b.id)) ||
        (connected.has(item.b.id) && pending.has(item.a.id))
      );
      if (!edge) break;
      this.createDenseOpening(state, edge, deckId, true);
      connected.add(edge.a.id);
      connected.add(edge.b.id);
      pending.delete(edge.a.id);
      pending.delete(edge.b.id);
    }

    for (const edge of this.shuffle(random, edges)) {
      if (random.chance(0.34)) {
        this.createDenseOpening(state, edge, deckId, true);
      }
    }
  }

  addDenseLoopConnections(state, rooms, footprint, random, deckId) {
    const edges = this.findDenseRoomAdjacencies(rooms).filter((edge) => !edge.opened);
    const levelSize = this.getLevelSize(footprint);
    const desiredLoops = levelSize.maxWalkable >= 250 ? random.integer(2, 4) : levelSize.maxWalkable >= 150 ? 1 : 0;
    let added = 0;
    for (const edge of this.shuffle(random, edges)) {
      if (added >= desiredLoops) break;
      this.createDenseOpening(state, edge, deckId, false);
      added += 1;
    }
  }

  findDenseRoomAdjacencies(rooms) {
    const edges = [];
    for (let i = 0; i < rooms.length; i += 1) {
      for (let j = i + 1; j < rooms.length; j += 1) {
        const edge = this.getDenseRoomAdjacency(rooms[i], rooms[j]);
        if (edge) edges.push(edge);
      }
    }
    return edges;
  }

  getDenseRoomAdjacency(a, b) {
    const ar = a.grid;
    const br = b.grid;
    const overlapY = Math.min(ar.y + ar.height, br.y + br.height) - Math.max(ar.y, br.y);
    if (overlapY >= 2 && (ar.x + ar.width === br.x - 1 || br.x + br.width === ar.x - 1)) {
      return { a, b, orientation: 'vertical', wallX: ar.x + ar.width === br.x - 1 ? ar.x + ar.width : br.x + br.width, min: Math.max(ar.y, br.y), max: Math.min(ar.y + ar.height, br.y + br.height) - 1, opened: false };
    }
    const overlapX = Math.min(ar.x + ar.width, br.x + br.width) - Math.max(ar.x, br.x);
    if (overlapX >= 2 && (ar.y + ar.height === br.y - 1 || br.y + br.height === ar.y - 1)) {
      return { a, b, orientation: 'horizontal', wallY: ar.y + ar.height === br.y - 1 ? ar.y + ar.height : br.y + br.height, min: Math.max(ar.x, br.x), max: Math.min(ar.x + ar.width, br.x + br.width) - 1, opened: false };
    }
    return null;
  }

  createDenseOpening(state, edge, deckId, asDoor = true) {
    const span = Math.max(1, Math.min(2, edge.max - edge.min));
    const anchor = Math.floor((edge.min + edge.max) / 2);
    const id = `dense-door-${deckId}-${state.doors.length + 1}`;
    const cells = [];
    for (let offset = 0; offset < span; offset += 1) {
      const value = anchor + offset;
      cells.push(edge.orientation === 'vertical'
        ? { x: edge.wallX, y: value }
        : { x: value, y: edge.wallY });
    }
    const rect = edge.orientation === 'vertical'
      ? { x: edge.wallX, y: cells[0].y, width: 1, height: cells.length }
      : { x: cells[0].x, y: edge.wallY, width: cells.length, height: 1 };
    if (!cells.every((cell) => this.getTile(state, cell.x, cell.y)?.tileType === TILE_TYPES.SOLID)) {
      edge.opened = true;
      return;
    }
    const world = this.gridToWorld(rect.x, rect.y);
    const tileType = asDoor ? TILE_TYPES.DOOR : TILE_TYPES.ROOM_FLOOR;
    for (const cell of cells) {
      this.setTile(state, cell.x, cell.y, tileType, {
        doorId: asDoor ? id : null,
        roomId: edge.a.id,
        plannedLevelId: edge.a.plannedLevelId
      });
    }
    if (!asDoor) {
      edge.opened = true;
      return;
    }
    const door = {
      id,
      deckId,
      roomId: edge.a.id,
      gridX: rect.x,
      gridY: rect.y,
      gridRect: rect,
      x: world.x,
      y: world.y,
      width: rect.width * TILE_SIZE,
      height: rect.height * TILE_SIZE,
      orientation: edge.orientation,
      boundarySide: edge.orientation === 'horizontal' ? 'north-south' : 'east-west',
      openingWidthCells: Math.max(rect.width, rect.height),
      wallThicknessPx: TILE_SIZE,
      cavityRectWorld: { x: world.x, y: world.y, width: rect.width * TILE_SIZE, height: rect.height * TILE_SIZE },
      closedPanelRectWorld: { x: world.x, y: world.y, width: rect.width * TILE_SIZE, height: rect.height * TILE_SIZE },
      adjacentWalkableCellsA: [],
      adjacentWalkableCellsB: [],
      retractSide: edge.orientation === 'horizontal' ? 'left' : 'up',
      connectsA: edge.a.id,
      connectsB: edge.b.id,
      clearanceRequirement: 0,
      locked: false,
      open: false,
      isOpen: false,
      animationState: 'closed',
      autoCloseDelay: 800,
      discovered: false
    };
    edge.a.doors.push(door);
    edge.b.doors.push(door);
    state.doors.push(door);
    edge.opened = true;
  }

  carveHallways(state, random, deckId) {
    for (const [index, footprint] of state.playableFootprints.entries()) {
      this.carveFootprintHallways(state, random, deckId, footprint, index);
    }
  }

  carveFootprintHallways(state, random, deckId, fp, footprintIndex = 0) {
    const corridorOffset = Math.floor(CORRIDOR_WIDTH_TILES / 2);
    const mainY = Math.round(fp.y + Math.floor(fp.height / 2) + random.integer(-1, 1));
    const inset = Math.max(3, Math.min(6, Math.floor(fp.width * 0.18)));
    const left = fp.x + inset;
    const right = fp.x + fp.width - inset - 1;
    const prefix = `level-${footprintIndex + 1}`;
    this.carveCorridorRect(state, `${prefix}-corridor-main-spine`, left, mainY - corridorOffset, right - left + 1, CORRIDOR_WIDTH_TILES, 'spine', fp, fp.plannedLevelId);

    const crossCount = fp.width >= 40 ? 5 : fp.width >= 34 ? 4 : fp.width >= 20 ? 2 : 1;
    for (let i = 0; i < crossCount; i += 1) {
      const x = Math.round(left + ((i + 1) / (crossCount + 1)) * (right - left)) + random.integer(-1, 1);
      const verticalInset = Math.max(3, Math.min(6, Math.floor(fp.height * 0.2)));
      const top = fp.y + verticalInset + random.integer(0, Math.min(2, verticalInset - 2));
      const bottom = fp.y + fp.height - verticalInset - 1 - random.integer(0, Math.min(2, verticalInset - 2));
      this.carveCorridorRect(state, `${prefix}-corridor-cross-${i + 1}`, x - corridorOffset, top, CORRIDOR_WIDTH_TILES, bottom - top + 1, 'cross', fp, fp.plannedLevelId);
    }

    if (fp.height < 15 || fp.width < 20) {
      return;
    }
    const serviceBands = fp.width >= 36
      ? [0.18, 0.3, 0.42, 0.58, 0.7, 0.82]
      : [0.28, 0.72];
    for (const [index, y] of serviceBands.map((ratio) => fp.y + Math.floor(fp.height * ratio)).entries()) {
      const branchY = Math.round(y + random.integer(-1, 1));
      const branchInset = Math.max(5, Math.min(10, Math.floor(fp.width * 0.24))) + random.integer(0, 2);
      this.carveCorridorRect(state, `${prefix}-corridor-service-${index + 1}`, fp.x + branchInset, branchY - corridorOffset, fp.width - branchInset * 2, CORRIDOR_WIDTH_TILES, 'branch', fp, fp.plannedLevelId);
    }
  }

  carveCorridorRect(state, id, x, y, width, height, role, footprint = state.footprint, plannedLevelId = null) {
    const rect = this.clampGridRect({ x, y, width, height }, footprint);
    const corridor = {
      id,
      role,
      grid: { ...rect },
      rects: [this.toWorldRect(rect)],
      fromRoomId: null,
      toRoomId: null,
      connectedRoomIds: [],
      plannedLevelId,
      discovered: false
    };
    state.corridors.push(corridor);
    for (let yy = rect.y; yy < rect.y + rect.height; yy += 1) {
      for (let xx = rect.x; xx < rect.x + rect.width; xx += 1) {
          this.setTile(state, xx, yy, TILE_TYPES.CORRIDOR_FLOOR, { corridorId: id, plannedLevelId });
      }
    }
  }

  placeRooms(state, random, deckId) {
    const candidates = this.createRoomCandidates(state, random);
    const target = random.integer(this.getTargetRoomCount(deckId, state), this.getMaximumRoomCount(deckId, state));

    for (const candidate of candidates) {
      if (state.rooms.length >= target) {
        break;
      }
      if (!this.canPlaceRoom(state, candidate.roomRect, candidate.door)) {
        continue;
      }
      const type = this.pickRoomType(random, state.rooms.length, deckId);
      const room = this.carveRoom(state, candidate, type, state.nextRoomIndex, deckId);
      candidate.corridor.connectedRoomIds.push(room.id);
      state.nextRoomIndex += 1;
    }
  }

  ensureRoomInEachFootprint(state, random, deckId) {
    for (const footprint of state.playableFootprints ?? [state.footprint]) {
      let roomCount = this.countRoomsInFootprint(state, footprint);
      const requiredRooms = this.getRequiredRoomCountForFootprint(footprint);
      if (roomCount >= requiredRooms) continue;
      const corridors = state.corridors.filter((corridor) => corridor.plannedLevelId === footprint.plannedLevelId);
      const candidates = [];
      for (const corridor of corridors) {
        const c = corridor.grid;
        const horizontal = c.width >= c.height;
        const slots = horizontal
          ? [0.22, 0.38, 0.55, 0.72].map((ratio) => Math.floor(c.x + c.width * ratio))
          : [0.22, 0.38, 0.55, 0.72].map((ratio) => Math.floor(c.y + c.height * ratio));
        for (const slot of slots) {
          const roomSize = roomCount < requiredRooms ? { width: 3, height: 3 } : this.pickRoomDimensions(random, footprint.sizeClass ?? 'regular', footprint);
          if (horizontal) {
            for (const side of ['top', 'bottom']) {
              const roomRect = { x: slot - Math.floor(roomSize.width / 2), y: side === 'top' ? c.y - roomSize.height - 1 : c.y + c.height + 1, width: roomSize.width, height: roomSize.height };
              const door = { x: slot, y: side === 'top' ? c.y - 1 : c.y + c.height, orientation: 'horizontal', plannedLevelId: corridor.plannedLevelId };
              candidates.push({ corridor, side, roomRect, door });
            }
          } else {
            for (const side of ['left', 'right']) {
              const roomRect = { x: side === 'left' ? c.x - roomSize.width - 1 : c.x + c.width + 1, y: slot - Math.floor(roomSize.height / 2), width: roomSize.width, height: roomSize.height };
              const door = { x: side === 'left' ? c.x - 1 : c.x + c.width, y: slot, orientation: 'vertical', plannedLevelId: corridor.plannedLevelId };
              candidates.push({ corridor, side, roomRect, door });
            }
          }
        }
      }
      for (const candidate of this.shuffle(random, candidates)) {
        if (roomCount >= requiredRooms) break;
        if (!this.canPlaceRoom(state, candidate.roomRect, candidate.door)) continue;
        const type = this.pickRoomType(random, state.rooms.length, deckId);
        const room = this.carveRoom(state, candidate, type, state.nextRoomIndex, deckId);
        candidate.corridor.connectedRoomIds.push(room.id);
        state.nextRoomIndex += 1;
        roomCount += 1;
      }
    }
  }

  fillInteriorSolidRegions(state, random, deckId) {
    const maxRooms = this.getMaximumRoomCount(deckId, state);
    let safety = 0;
    while (this.getWalkableCoverage(state) < 0.55 && state.rooms.length < maxRooms && safety < 6) {
      safety += 1;
      const regions = this.findSolidRegions(state)
        .filter((region) => region.width >= 6 && region.height >= 6 && region.cells.length >= 48)
        .sort((a, b) => b.cells.length - a.cells.length);
      let carvedAny = false;

      for (const region of regions) {
        if (this.getWalkableCoverage(state) >= 0.58 || state.rooms.length >= maxRooms) {
          break;
        }
        const maxWidth = Math.min(region.width - 2, 14);
        const maxHeight = Math.min(region.height - 2, 10, 20 - maxWidth);
        const roomRect = {
          x: region.x + 1 + Math.max(0, Math.floor((region.width - 2 - maxWidth) / 2)),
          y: region.y + 1 + Math.max(0, Math.floor((region.height - 2 - maxHeight) / 2)),
          width: maxWidth,
          height: maxHeight
        };
        if (roomRect.width < 4 || roomRect.height < 4) {
          continue;
        }
        const door = this.findDoorForPackedRoom(state, roomRect, random);
        if (!door) {
          continue;
        }
        if (!this.canPlaceRoom(state, roomRect, door)) {
          continue;
        }
        const type = this.pickRoomType(random, state.rooms.length, deckId);
        const corridor = state.corridors.find((item) => item.id === door.corridorId);
        const room = this.carveRoom(state, {
          corridor,
          side: 'packed',
          roomRect,
          door
        }, type, state.nextRoomIndex, deckId);
        corridor.connectedRoomIds.push(room.id);
        state.nextRoomIndex += 1;
        carvedAny = true;
      }

      if (!carvedAny) {
        break;
      }
    }
  }

  findDoorForPackedRoom(state, roomRect, random) {
    const candidates = [];
    const addHorizontal = (x, y, corridorY) => {
      const cells = this.getDoorCells({ x, y, orientation: 'horizontal' });
      if (!cells.every((cell) => this.getTile(state, cell.x, cell.y)?.tileType === TILE_TYPES.SOLID)) return;
      const corridorTiles = cells.map((cell) => this.getTile(state, cell.x, corridorY));
      const corridorId = corridorTiles.find((tile) => tile?.corridorId)?.corridorId;
      if (!corridorId || !corridorTiles.every((tile) => tile?.tileType === TILE_TYPES.CORRIDOR_FLOOR)) return;
      candidates.push({ x, y, orientation: 'horizontal', corridorId });
    };
    const addVertical = (x, y, corridorX) => {
      const cells = this.getDoorCells({ x, y, orientation: 'vertical' });
      if (!cells.every((cell) => this.getTile(state, cell.x, cell.y)?.tileType === TILE_TYPES.SOLID)) return;
      const corridorTiles = cells.map((cell) => this.getTile(state, corridorX, cell.y));
      const corridorId = corridorTiles.find((tile) => tile?.corridorId)?.corridorId;
      if (!corridorId || !corridorTiles.every((tile) => tile?.tileType === TILE_TYPES.CORRIDOR_FLOOR)) return;
      candidates.push({ x, y, orientation: 'vertical', corridorId });
    };

    for (let x = roomRect.x + 1; x < roomRect.x + roomRect.width - 1; x += 1) {
      addHorizontal(x, roomRect.y - 1, roomRect.y - 2);
      addHorizontal(x, roomRect.y + roomRect.height, roomRect.y + roomRect.height + 1);
    }
    for (let y = roomRect.y + 1; y < roomRect.y + roomRect.height - 1; y += 1) {
      addVertical(roomRect.x - 1, y, roomRect.x - 2);
      addVertical(roomRect.x + roomRect.width, y, roomRect.x + roomRect.width + 1);
    }

    return candidates.length ? random.choice(candidates) : null;
  }

  createRoomCandidates(state, random) {
    const candidates = [];
    for (const corridor of state.corridors) {
      const c = corridor.grid;
      const horizontal = c.width >= c.height;
      const length = horizontal ? c.width : c.height;
      const slots = Math.max(5, Math.floor(length / 2.5));
      for (let i = 0; i < slots; i += 1) {
        const t = (i + 0.5) / slots;
        for (const side of this.shuffle(random, ['a', 'b'])) {
          const footprint = this.getFootprintForPlannedLevel(state, corridor.plannedLevelId) ?? state.footprint;
          const roomSize = this.pickRoomDimensions(random, footprint.sizeClass ?? 'regular', footprint);
          const roomWidth = roomSize.width;
          const roomHeight = roomSize.height;
          if (horizontal) {
            const rawCenterX = Math.round(c.x + c.width * t + random.integer(-2, 2));
            const centerX = rawCenterX;
            const x = centerX - Math.floor(roomWidth / 2);
            const wallY = side === 'a' ? c.y - 1 : c.y + c.height;
            const y = side === 'a' ? wallY - roomHeight : wallY + 1;
            candidates.push({
              corridor,
              side,
              roomRect: { x, y, width: roomWidth, height: roomHeight },
              door: { x: centerX, y: wallY, orientation: 'horizontal', plannedLevelId: corridor.plannedLevelId }
            });
          } else {
            const rawCenterY = Math.round(c.y + c.height * t + random.integer(-2, 2));
            const centerY = rawCenterY;
            const wallX = side === 'a' ? c.x - 1 : c.x + c.width;
            const x = side === 'a' ? wallX - roomWidth : wallX + 1;
            const y = centerY - Math.floor(roomHeight / 2);
            candidates.push({
              corridor,
              side,
              roomRect: { x, y, width: roomWidth, height: roomHeight },
              door: { x: wallX, y: centerY, orientation: 'vertical', plannedLevelId: corridor.plannedLevelId }
            });
          }
        }
      }
    }
    return this.shuffle(random, candidates);
  }

  canPlaceRoom(state, roomRect, door) {
    const doorCells = this.getDoorCells(door);
    const doorKeys = new Set(doorCells.map((cell) => `${cell.x},${cell.y}`));
    const requiredFootprint = this.getFootprintForPlannedLevel(state, door.plannedLevelId);
    if (requiredFootprint) {
      if (!this.gridRectInsideFootprint(roomRect, requiredFootprint) ||
        !doorCells.every((cell) => this.inFootprint(cell.x, cell.y, requiredFootprint))) {
        return false;
      }
    } else if (!this.gridRectInsidePlayableFootprints(roomRect, state)) {
      return false;
    }
    for (const cell of doorCells) {
      if (!this.inPlayableFootprint(cell.x, cell.y, state)) {
        return false;
      }
      if (this.getTile(state, cell.x, cell.y)?.tileType !== TILE_TYPES.SOLID) {
        return false;
      }
    }
    if (!this.doorHasRoomAndCorridorSides(state, roomRect, door)) {
      return false;
    }
    for (let y = roomRect.y; y < roomRect.y + roomRect.height; y += 1) {
      for (let x = roomRect.x; x < roomRect.x + roomRect.width; x += 1) {
        const tile = this.getTile(state, x, y);
        if (!tile || tile.tileType !== TILE_TYPES.SOLID) {
          return false;
        }
      }
    }
    for (let y = roomRect.y - 1; y <= roomRect.y + roomRect.height; y += 1) {
      for (let x = roomRect.x - 1; x <= roomRect.x + roomRect.width; x += 1) {
        const onRoomInterior = x >= roomRect.x &&
          x < roomRect.x + roomRect.width &&
          y >= roomRect.y &&
          y < roomRect.y + roomRect.height;
        if (onRoomInterior || doorKeys.has(`${x},${y}`)) {
          continue;
        }
        const onPerimeter = x === roomRect.x - 1 ||
          x === roomRect.x + roomRect.width ||
          y === roomRect.y - 1 ||
          y === roomRect.y + roomRect.height;
        if (!onPerimeter) {
          continue;
        }
        const tile = this.getTile(state, x, y);
        if (!tile || tile.tileType !== TILE_TYPES.SOLID) {
          return false;
        }
      }
    }
    return true;
  }

  carveRoom(state, candidate, type, index, deckId) {
    const id = `room-${index}`;
    const worldRect = this.toWorldRect(candidate.roomRect);
    const center = rectCenter(worldRect);
    const room = {
      id,
      type: type.id,
      label: type.label,
      color: type.color,
      ...worldRect,
      centerX: center.x,
      centerY: center.y,
      grid: { ...candidate.roomRect },
      plannedLevelId: candidate.corridor?.plannedLevelId ?? null,
      doors: [],
      discovered: false,
      cleared: false
    };

    for (let y = candidate.roomRect.y; y < candidate.roomRect.y + candidate.roomRect.height; y += 1) {
      for (let x = candidate.roomRect.x; x < candidate.roomRect.x + candidate.roomRect.width; x += 1) {
        this.setTile(state, x, y, TILE_TYPES.ROOM_FLOOR, { roomId: id, plannedLevelId: room.plannedLevelId });
      }
    }

    const door = this.createDoor(state, room, candidate, deckId);
    room.doors.push(door);
    state.doors.push(door);
    state.rooms.push(room);
    return room;
  }

  createDoor(state, room, candidate, deckId) {
    const doorRect = this.getDoorGridRect(candidate.door);
    const world = this.gridToWorld(doorRect.x, doorRect.y);
    const adjacent = this.getDoorAdjacentCells(candidate.door);
    const door = {
      id: `${room.id}-${candidate.corridor.id}`,
      deckId,
      roomId: room.id,
      gridX: candidate.door.x,
      gridY: candidate.door.y,
      gridRect: doorRect,
      x: world.x,
      y: world.y,
      width: doorRect.width * TILE_SIZE,
      height: doorRect.height * TILE_SIZE,
      orientation: candidate.door.orientation,
      boundarySide: candidate.door.orientation === 'horizontal' ? 'north-south' : 'east-west',
      openingWidthCells: DOOR_SPAN_TILES,
      wallThicknessPx: TILE_SIZE,
      cavityRectWorld: { x: world.x, y: world.y, width: doorRect.width * TILE_SIZE, height: doorRect.height * TILE_SIZE },
      closedPanelRectWorld: { x: world.x, y: world.y, width: doorRect.width * TILE_SIZE, height: doorRect.height * TILE_SIZE },
      adjacentWalkableCellsA: adjacent.sideA,
      adjacentWalkableCellsB: adjacent.sideB,
      retractSide: candidate.door.orientation === 'horizontal' ? 'left' : 'up',
      connectsA: room.id,
      connectsB: candidate.corridor.id,
      clearanceRequirement: 0,
      locked: false,
      open: false,
      isOpen: false,
      animationState: 'closed',
      autoCloseDelay: 800,
      discovered: false
    };
    for (const cell of this.getDoorCells(candidate.door)) {
      this.setTile(state, cell.x, cell.y, TILE_TYPES.DOOR, {
        doorId: door.id,
        roomId: room.id,
        corridorId: candidate.corridor.id,
        plannedLevelId: room.plannedLevelId,
        clearanceRequirement: 0
      });
    }
    return door;
  }

  getDoorGridRect(door) {
    const half = Math.floor(DOOR_SPAN_TILES / 2);
    if (door.orientation === 'horizontal') {
      return { x: door.x - half, y: door.y, width: DOOR_SPAN_TILES, height: 1 };
    }
    return { x: door.x, y: door.y - half, width: 1, height: DOOR_SPAN_TILES };
  }

  getDoorCells(door) {
    const rect = this.getDoorGridRect(door);
    const cells = [];
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        cells.push({ x, y });
      }
    }
    return cells;
  }

  doorHasRoomAndCorridorSides(state, roomRect, door) {
    const adjacent = this.getDoorAdjacentCells(door);
    const sideHasRoom = (cells) => cells.every((cell) => this.pointInGridRect(cell, roomRect));
    const sideHasCorridor = (cells) => cells.every((cell) => this.getTile(state, cell.x, cell.y)?.tileType === TILE_TYPES.CORRIDOR_FLOOR);
    return (sideHasRoom(adjacent.sideA) && sideHasCorridor(adjacent.sideB)) ||
      (sideHasRoom(adjacent.sideB) && sideHasCorridor(adjacent.sideA));
  }

  getDoorAdjacentCells(door) {
    const cells = this.getDoorCells(door);
    if (door.orientation === 'horizontal') {
      return {
        sideA: cells.map((cell) => ({ x: cell.x, y: cell.y - 1 })),
        sideB: cells.map((cell) => ({ x: cell.x, y: cell.y + 1 }))
      };
    }
    return {
      sideA: cells.map((cell) => ({ x: cell.x - 1, y: cell.y })),
      sideB: cells.map((cell) => ({ x: cell.x + 1, y: cell.y }))
    };
  }

  pointInGridRect(point, rect) {
    return point.x >= rect.x &&
      point.x < rect.x + rect.width &&
      point.y >= rect.y &&
      point.y < rect.y + rect.height;
  }

  placeTerminals(state, random, deckId) {
    const types = ['local-map', 'droid-registry', 'lift-network', 'ship-status'];
    for (const footprint of state.playableFootprints ?? [state.footprint]) {
      const rooms = this.getRoomsForFootprint(state, footprint)
        .sort((a, b) => b.width * b.height - a.width * a.height);
      const quota = this.getTerminalQuotaForFootprint(random, footprint);
      let placed = 0;
      for (let i = 0; i < quota && placed < quota; i += 1) {
        const room = rooms[i % Math.max(1, rooms.length)];
        if (!room) continue;
        const terminalType = types[state.terminals.length % types.length];
        if (this.placeTerminalInRoom(state, random, deckId, room, terminalType)) {
          placed += 1;
        }
      }
      if (placed === 0 && rooms[0]) {
        this.placeTerminalInRoom(state, random, deckId, rooms[0], types[state.terminals.length % types.length], true);
      }
    }
  }

  getTerminalQuotaForFootprint(random, footprint) {
    const sizeClass = footprint.sizeClass ?? 'regular';
    if (sizeClass === 'tiny') return 1;
    if (sizeClass === 'small') return random.integer(1, 2);
    if (sizeClass === 'large') return random.integer(2, 3);
    if (sizeClass === 'huge') return random.integer(3, 4);
    return 2;
  }

  placeTerminalInRoom(state, random, deckId, room, terminalType, allowNearDoor = false) {
    const point = this.findTerminalPoint(state, room, random, allowNearDoor);
    if (!point) return false;
    const gridX = Math.floor(point.x / TILE_SIZE);
    const gridY = Math.floor(point.y / TILE_SIZE);
    const tile = this.getTile(state, gridX, gridY);
    if (!tile || tile.tileType !== TILE_TYPES.ROOM_FLOOR) return false;
    const terminal = {
      id: `terminal-${deckId}-${state.terminals.length + 1}`,
      deckId,
      roomId: room.id,
      x: point.x,
      y: point.y,
      terminalType,
      orientation: point.orientation,
      wallSide: point.wallSide ?? point.orientation,
      mouthDirection: point.mouthDirection,
      footprint: point.footprint,
      clearanceRequirement: terminalType === 'ship-status' || terminalType === 'ship-alert' ? Math.min(4, deckId) : Math.max(0, this.clearanceForRoom(room) - 1),
      used: false,
      discovered: false
    };
    state.terminals.push(terminal);
    this.setTile(state, gridX, gridY, terminal.terminalType === 'ship-alert' ? TILE_TYPES.ALERT_BOX : TILE_TYPES.TERMINAL, {
      roomId: room.id,
      terminalId: terminal.id,
      clearanceRequirement: terminal.clearanceRequirement,
      plannedLevelId: room.plannedLevelId
    });
    return true;
  }

  findTerminalPoint(state, room, random, allowNearDoor = false) {
    for (let radius = allowNearDoor ? 0 : 3; radius >= 0; radius -= 1) {
      for (let attempt = 0; attempt < 18; attempt += 1) {
        const point = this.findWallAdjacentVisualPoint(state, room, random, [TILE_TYPES.ROOM_FLOOR]);
        if (!point) break;
        if (radius > 0 && this.nearDoor(state, point.gx, point.gy, radius)) continue;
        if (!this.hasConsoleAccessBay(state, room, point)) continue;
        return point;
      }
    }
    const fallback = this.findInteriorWallPoint(room, random);
    const gx = Math.floor(fallback.x / TILE_SIZE);
    const gy = Math.floor(fallback.y / TILE_SIZE);
    return this.getTile(state, gx, gy)?.tileType === TILE_TYPES.ROOM_FLOOR &&
      this.hasConsoleAccessBay(state, room, { ...fallback, gx, gy })
      ? fallback
      : null;
  }

  findInteriorWallPoint(room, random) {
    const side = random.choice(['left', 'right', 'top', 'bottom']);
    const gx = side === 'left' ? room.grid.x + 1 : side === 'right' ? room.grid.x + room.grid.width - 2 : random.integer(room.grid.x + 1, room.grid.x + room.grid.width - 2);
    const gy = side === 'top' ? room.grid.y + 1 : side === 'bottom' ? room.grid.y + room.grid.height - 2 : random.integer(room.grid.y + 1, room.grid.y + room.grid.height - 2);
    const world = this.gridToWorld(gx, gy);
    return {
      x: world.x + TILE_SIZE / 2,
      y: world.y + TILE_SIZE / 2,
      orientation: side === 'left' ? 'west' : side === 'right' ? 'east' : side === 'top' ? 'north' : 'south',
      wallSide: side === 'left' ? 'west' : side === 'right' ? 'east' : side === 'top' ? 'north' : 'south',
      mouthDirection: side === 'left' ? 'east' : side === 'right' ? 'west' : side === 'top' ? 'south' : 'north'
    };
  }

  placeFixtures(state, random, deckId) {
    this.placeRepairPads(state, random, deckId);
    this.placeObstacleBlocks(state, random, deckId);
  }

  placeRepairPads(state, random, deckId) {
    const preferred = state.rooms
      .filter((room) => ['maintenance', 'medical', 'engineering', 'utility'].includes(room.type))
      .sort((a, b) => b.width * b.height - a.width * a.height);
    const fallback = state.rooms.sort((a, b) => b.width * b.height - a.width * a.height);
    const rooms = preferred.length ? preferred : fallback;
    const count = Math.min(3, Math.max(1, Math.floor(state.rooms.length / 8)));
    let placed = 0;
    for (const room of rooms) {
      if (placed >= count) break;
      const point = this.findWallAdjacentVisualPoint(state, room, random, [TILE_TYPES.ROOM_FLOOR]);
      if (!point) continue;
      const { gx, gy } = point;
      const cells = this.getFixtureCells(point.baseX, point.baseY, 1, 1);
      if (!cells.every((cell) => this.getTile(state, cell.x, cell.y)?.tileType === TILE_TYPES.ROOM_FLOOR && !this.nearDoor(state, cell.x, cell.y, 3))) continue;
      const fixture = {
        id: `repair-${deckId}-${placed + 1}`,
        type: 'repair-pad',
        deckId,
        roomId: room.id,
        gridX: gx,
        gridY: gy,
        x: point.x,
        y: point.y,
        radius: TILE_SIZE,
        orientation: point.orientation,
        footprint: point.footprint,
        blocksMovement: false,
        interactable: false
      };
      state.fixtures.push(fixture);
      for (const cell of cells) {
        this.setTile(state, cell.x, cell.y, TILE_TYPES.REPAIR_PAD, { roomId: room.id, fixtureId: fixture.id });
      }
      placed += 1;
    }
  }

  placeObstacleBlocks(state, random, deckId) {
    const rooms = [...state.rooms]
      .filter((room) => room.grid.width >= 6 && room.grid.height >= 6)
      .sort((a, b) => b.width * b.height - a.width * a.height);
    const target = Math.min(12, Math.max(4, Math.floor(state.rooms.length * 0.55) + Math.floor(deckId / 2)));
    let placed = 0;
    for (let attempt = 0; attempt < target * 10 && placed < target; attempt += 1) {
      const room = random.choice(rooms);
      if (!room) break;
      const point = this.findWallAdjacentVisualPoint(state, room, random, [TILE_TYPES.ROOM_FLOOR]);
      if (!point || this.nearDoor(state, point.gx, point.gy, 3)) continue;
      const cells = this.getFixtureCells(point.baseX, point.baseY, 1, 1);
      if (!cells.every((cell) => this.getTile(state, cell.x, cell.y)?.tileType === TILE_TYPES.ROOM_FLOOR && !this.nearDoor(state, cell.x, cell.y, 3))) continue;
      if (this.blocksConsoleAccess(state, cells)) continue;
      const fixture = {
        id: `obstacle-${deckId}-${placed + 1}`,
        type: placed % 2 === 0 ? 'transformer-dots' : 'transformer-line',
        deckId,
        roomId: room.id,
        gridX: point.gx,
        gridY: point.gy,
        x: point.x,
        y: point.y,
        width: TILE_SIZE,
        height: TILE_SIZE,
        orientation: point.orientation,
        footprint: point.footprint,
        blocksMovement: true,
        interactable: false
      };
      for (const cell of cells) {
        this.setTile(state, cell.x, cell.y, TILE_TYPES.BLOCKED, { roomId: room.id, fixtureId: fixture.id });
      }
      if (!this.quickConnectivityValid(state)) {
        for (const cell of cells) {
          this.setTile(state, cell.x, cell.y, TILE_TYPES.ROOM_FLOOR, { roomId: room.id, fixtureId: null });
        }
        continue;
      }
      if (!this.allConsolesHaveAccess(state)) {
        for (const cell of cells) {
          this.setTile(state, cell.x, cell.y, TILE_TYPES.ROOM_FLOOR, { roomId: room.id, fixtureId: null });
        }
        continue;
      }
      state.fixtures.push(fixture);
      placed += 1;
    }
  }

  hasConsoleAccessBay(state, room, point) {
    const accessCells = this.getConsoleAccessCells(point);
    if (!accessCells.length) {
      return false;
    }
    const [primaryAccess, ...sideAccess] = accessCells;
    const primaryTile = this.getTile(state, primaryAccess.x, primaryAccess.y);
    if (!primaryTile || primaryTile.roomId !== room.id || !this.isReachableTile(primaryTile.tileType)) {
      return false;
    }
    if (sideAccess.some((cell) => {
      const tile = this.getTile(state, cell.x, cell.y);
      return !tile || tile.roomId !== room.id || !this.isReachableTile(tile.tileType);
    })) {
      return false;
    }

    const sideClearanceCells = this.getConsoleSideClearanceCells(point);
    return sideClearanceCells.every((cell) => {
      const tile = this.getTile(state, cell.x, cell.y);
      return tile?.roomId === room.id && this.isReachableTile(tile.tileType);
    });
  }

  allConsolesHaveAccess(state) {
    return state.terminals.every((terminal) => {
      const room = state.rooms.find((item) => item.id === terminal.roomId);
      if (!room) return false;
      const point = {
        gx: Math.floor(terminal.x / TILE_SIZE),
        gy: Math.floor(terminal.y / TILE_SIZE),
        mouthDirection: terminal.mouthDirection,
        wallSide: terminal.wallSide ?? terminal.orientation
      };
      return this.hasConsoleAccessBay(state, room, point);
    });
  }

  blocksConsoleAccess(state, cells) {
    const blocked = new Set(cells.map((cell) => `${cell.x},${cell.y}`));
    return state.terminals.some((terminal) => {
      const point = {
        gx: Math.floor(terminal.x / TILE_SIZE),
        gy: Math.floor(terminal.y / TILE_SIZE),
        mouthDirection: terminal.mouthDirection,
        wallSide: terminal.wallSide ?? terminal.orientation
      };
      return [
        ...this.getConsoleAccessCells(point),
        ...this.getConsoleSideClearanceCells(point)
      ].some((cell) => blocked.has(`${cell.x},${cell.y}`));
    });
  }

  getConsoleAccessCells(point) {
    const direction = CARDINAL_DIRECTIONS[point.mouthDirection];
    if (!direction) return [];
    const lateral = { x: direction.y, y: direction.x };
    const accessX = point.gx + direction.x;
    const accessY = point.gy + direction.y;
    return [
      { x: accessX, y: accessY },
      { x: accessX + lateral.x, y: accessY + lateral.y },
      { x: accessX - lateral.x, y: accessY - lateral.y }
    ];
  }

  getConsoleSideClearanceCells(point) {
    const wallDirection = CARDINAL_DIRECTIONS[point.wallSide];
    if (!wallDirection) return [];
    const lateral = { x: wallDirection.y, y: wallDirection.x };
    return [
      { x: point.gx + lateral.x, y: point.gy + lateral.y },
      { x: point.gx - lateral.x, y: point.gy - lateral.y }
    ];
  }

  markWallFillCells(state) {
    let changed = true;
    let passes = 0;
    while (changed && passes < 3) {
      changed = false;
      passes += 1;
      const fillCells = [];
      for (let y = state.footprint.y; y < state.footprint.y + state.footprint.height; y += 1) {
        for (let x = state.footprint.x; x < state.footprint.x + state.footprint.width; x += 1) {
          const tile = this.getTile(state, x, y);
          if (!tile || tile.tileType !== TILE_TYPES.SOLID) {
            continue;
          }
          if (this.shouldFillWallCorner(state, x, y)) {
            fillCells.push(tile);
          }
        }
      }
      for (const tile of fillCells) {
        tile.tileType = TILE_TYPES.WALL_FILL;
        tile.wallFill = true;
        changed = true;
      }
    }
  }

  shouldFillWallCorner(state, x, y) {
    if (this.hasCardinalWalkableNeighbor(state, x, y)) {
      return false;
    }

    const diagonalWalkable = [
      this.isWalkableForWallFill(state, x - 1, y - 1),
      this.isWalkableForWallFill(state, x + 1, y - 1),
      this.isWalkableForWallFill(state, x - 1, y + 1),
      this.isWalkableForWallFill(state, x + 1, y + 1)
    ].filter(Boolean).length;
    if (diagonalWalkable === 0) {
      return false;
    }

    const structuralNeighbors = [
      this.isStructuralWallCell(state, x - 1, y),
      this.isStructuralWallCell(state, x + 1, y),
      this.isStructuralWallCell(state, x, y - 1),
      this.isStructuralWallCell(state, x, y + 1)
    ].filter(Boolean).length;

    const diagonalStructuralPairs = [
      this.isStructuralWallCell(state, x - 1, y) && this.isStructuralWallCell(state, x, y - 1),
      this.isStructuralWallCell(state, x + 1, y) && this.isStructuralWallCell(state, x, y - 1),
      this.isStructuralWallCell(state, x - 1, y) && this.isStructuralWallCell(state, x, y + 1),
      this.isStructuralWallCell(state, x + 1, y) && this.isStructuralWallCell(state, x, y + 1)
    ].some(Boolean);

    return structuralNeighbors >= 2 || diagonalStructuralPairs;
  }

  hasCardinalWalkableNeighbor(state, x, y) {
    return this.isWalkableForWallFill(state, x - 1, y) ||
      this.isWalkableForWallFill(state, x + 1, y) ||
      this.isWalkableForWallFill(state, x, y - 1) ||
      this.isWalkableForWallFill(state, x, y + 1);
  }

  isWalkableForWallFill(state, x, y) {
    const tile = this.getTile(state, x, y);
    return Boolean(tile && this.isReachableTile(tile.tileType));
  }

  isStructuralWallCell(state, x, y) {
    const tile = this.getTile(state, x, y);
    return tile?.tileType === TILE_TYPES.SOLID ||
      tile?.tileType === TILE_TYPES.WALL_FILL ||
      tile?.tileType === TILE_TYPES.BLOCKED;
  }

  findWallAdjacentVisualPoint(state, room, random, allowedTypes = [TILE_TYPES.ROOM_FLOOR]) {
    const candidates = [];
    const addCandidate = (baseX, baseY, wallSide) => {
      const cells = this.getFixtureCells(baseX, baseY, 1, 1);
      if (!cells.every((cell) => {
        const tile = this.getTile(state, cell.x, cell.y);
        return tile?.roomId === room.id && allowedTypes.includes(tile.tileType);
      })) {
        return;
      }
      candidates.push({
        baseX,
        baseY,
        gx: baseX,
        gy: baseY,
        x: baseX * TILE_SIZE + TILE_SIZE / 2,
        y: baseY * TILE_SIZE + TILE_SIZE / 2,
        footprint: { gridX: baseX, gridY: baseY, widthCells: 1, heightCells: 1, orientation: wallSide },
        orientation: wallSide,
        wallSide,
        mouthDirection: wallSide === 'north' ? 'south' : wallSide === 'south' ? 'north' : wallSide === 'west' ? 'east' : 'west'
      });
    };

    const minX = room.grid.x;
    const maxX = room.grid.x + room.grid.width - 1;
    const minY = room.grid.y;
    const maxY = room.grid.y + room.grid.height - 1;
    for (let x = minX; x <= maxX; x += 1) {
      addCandidate(x, minY, 'north');
      addCandidate(x, maxY, 'south');
    }
    for (let y = minY; y <= maxY; y += 1) {
      addCandidate(minX, y, 'west');
      addCandidate(maxX, y, 'east');
    }
    return candidates.length ? random.choice(candidates) : null;
  }

  getFixtureCells(baseX, baseY, width = 1, height = 1) {
    const cells = [];
    for (let y = baseY; y < baseY + height; y += 1) {
      for (let x = baseX; x < baseX + width; x += 1) {
        cells.push({ x, y });
      }
    }
    return cells;
  }

  nearDoor(state, gx, gy, radius) {
    return state.doors.some((door) => Math.abs(door.gridX - gx) <= radius && Math.abs(door.gridY - gy) <= radius);
  }

  quickConnectivityValid(state) {
    const start = state.rooms[0];
    if (!start) return false;
    const reachable = new Set();
    const queue = this.getReachabilityStarts(state, start);
    while (queue.length > 0) {
      const current = queue.shift();
      const key = `${current.x},${current.y}`;
      if (reachable.has(key)) continue;
      const tile = this.getTile(state, current.x, current.y);
      if (!tile || !this.isReachableTile(tile.tileType)) continue;
      reachable.add(key);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        queue.push({ x: current.x + dx, y: current.y + dy });
      }
    }
    return state.rooms.every((room) => reachable.has(`${Math.floor(room.centerX / TILE_SIZE)},${Math.floor(room.centerY / TILE_SIZE)}`));
  }

  findSolidRegions(state) {
    const visited = new Set();
    const regions = [];
    for (const fp of state.playableFootprints ?? [state.footprint]) {
      for (let y = fp.y; y < fp.y + fp.height; y += 1) {
        for (let x = fp.x; x < fp.x + fp.width; x += 1) {
        const key = `${x},${y}`;
        if (visited.has(key) || this.getTile(state, x, y)?.tileType !== TILE_TYPES.SOLID) {
          continue;
        }
        const cells = [];
        const queue = [{ x, y }];
        visited.add(key);
        while (queue.length > 0) {
          const current = queue.shift();
          cells.push(current);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = current.x + dx;
            const ny = current.y + dy;
            const nextKey = `${nx},${ny}`;
            if (visited.has(nextKey) || !this.inFootprint(nx, ny, fp) || this.getTile(state, nx, ny)?.tileType !== TILE_TYPES.SOLID) {
              continue;
            }
            visited.add(nextKey);
            queue.push({ x: nx, y: ny });
          }
        }
        const xs = cells.map((cell) => cell.x);
        const ys = cells.map((cell) => cell.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        regions.push({
          x: minX,
          y: minY,
          width: maxX - minX + 1,
          height: maxY - minY + 1,
          cells
        });
      }
    }
    }
    return regions;
  }

  getWalkableCoverage(state) {
    const metrics = this.computeMetrics(state);
    return metrics.walkableCoveragePercent / 100;
  }

  computeMetrics(state) {
    const footprintArea = (state.playableFootprints ?? [state.footprint])
      .reduce((sum, footprint) => sum + footprint.width * footprint.height, 0);
    let walkable = 0;
    let room = 0;
    let corridor = 0;
    for (const footprint of state.playableFootprints ?? [state.footprint]) {
      for (let y = footprint.y; y < footprint.y + footprint.height; y += 1) {
        for (let x = footprint.x; x < footprint.x + footprint.width; x += 1) {
        const type = this.getTile(state, x, y)?.tileType;
        if (this.isReachableTile(type)) {
          walkable += 1;
        }
        if (type === TILE_TYPES.ROOM_FLOOR || type === TILE_TYPES.LIFT_ROOM_FLOOR || type === TILE_TYPES.LIFT_PAD || type === TILE_TYPES.TERMINAL || type === TILE_TYPES.ALERT_BOX || type === TILE_TYPES.REPAIR_PAD) {
          room += 1;
        }
        if (type === TILE_TYPES.CORRIDOR_FLOOR) {
          corridor += 1;
        }
      }
    }
    }
    const solidRegions = this.findSolidRegions(state);
    const largestSolidInteriorRegion = solidRegions.reduce((max, region) => Math.max(max, region.cells.length), 0);
    const totalRoomArea = state.rooms.reduce((sum, item) => sum + (item.grid.width * item.grid.height), 0);
    const roomAdjacencyCount = this.findDenseRoomAdjacencies(state.rooms).length;
    const loopCount = Math.max(0, state.doors.length - Math.max(0, state.rooms.length - 1));
    return {
      walkableCoveragePercent: Math.round((walkable / footprintArea) * 1000) / 10,
      playableDensityPercent: Math.round((walkable / footprintArea) * 1000) / 10,
      roomFloorPercent: Math.round((room / footprintArea) * 1000) / 10,
      corridorFloorPercent: Math.round((corridor / footprintArea) * 1000) / 10,
      corridorAreaPercent: walkable ? Math.round((corridor / walkable) * 1000) / 10 : 0,
      sharedWallRatio: state.rooms.length > 1 ? Math.round((roomAdjacencyCount / state.rooms.length) * 100) / 100 : 0,
      loopCount,
      roomAdjacencyCount,
      largestSolidInteriorRegion,
      roomCount: state.rooms.length,
      averageRoomSize: state.rooms.length ? Math.round(totalRoomArea / state.rooms.length) : 0,
      doorCount: state.doors.length,
      corridorCount: state.corridors.length
    };
  }

  validate(state, startRoom) {
    const reachable = new Set();
    const queue = this.getReachabilityStarts(state, startRoom);
    while (queue.length > 0) {
      const current = queue.shift();
      const key = `${current.x},${current.y}`;
      if (reachable.has(key)) continue;
      const tile = this.getTile(state, current.x, current.y);
      if (!tile || !this.isReachableTile(tile.tileType)) continue;
      reachable.add(key);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        queue.push({ x: current.x + dx, y: current.y + dy });
      }
    }
    const unreachableRooms = state.rooms.filter((room) => !reachable.has(`${Math.floor(room.centerX / TILE_SIZE)},${Math.floor(room.centerY / TILE_SIZE)}`));
    const roomsWithoutDoors = [];
    const roomsWithTooManyDoors = [];
    const roomsWithOpenEdges = [];
    const inaccessibleConsoles = state.terminals
      .filter((terminal) => {
        const room = state.rooms.find((item) => item.id === terminal.roomId);
        if (!room) return true;
        return !this.hasConsoleAccessBay(state, room, {
          gx: Math.floor(terminal.x / TILE_SIZE),
          gy: Math.floor(terminal.y / TILE_SIZE),
          mouthDirection: terminal.mouthDirection,
          wallSide: terminal.wallSide ?? terminal.orientation
        });
      })
      .map((terminal) => terminal.id);
    const metrics = this.computeMetrics(state);
    const coverageMin = (state.playableFootprints?.length ?? 1) > 1 ? 16 : 25;
    const coverageValid = metrics.walkableCoveragePercent >= coverageMin && metrics.walkableCoveragePercent <= 88;
    return {
      valid: unreachableRooms.length === 0 &&
        coverageValid &&
        inaccessibleConsoles.length === 0,
      reachableTiles: reachable.size,
      unreachableRooms: unreachableRooms.map((room) => room.id),
      inaccessibleConsoles,
      roomsWithoutDoors: roomsWithoutDoors.map((room) => room.id),
      roomsWithTooManyDoors: roomsWithTooManyDoors.map((room) => room.id),
      roomsWithOpenEdges: roomsWithOpenEdges.map((room) => room.id),
      doorCount: state.doors.length,
      roomCount: state.rooms.length,
      corridorCount: state.corridors.length,
      metrics
    };
  }

  getReachabilityStarts(state, startRoom) {
    const starts = [];
    const pushRoom = (room) => {
      if (!room) return;
      starts.push({ x: Math.floor(room.centerX / TILE_SIZE), y: Math.floor(room.centerY / TILE_SIZE) });
    };
    pushRoom(startRoom);
    for (const fp of state.playableFootprints ?? []) {
      const room = state.rooms.find((item) =>
        item.grid.x >= fp.x &&
        item.grid.y >= fp.y &&
        item.grid.x + item.grid.width <= fp.x + fp.width &&
        item.grid.y + item.grid.height <= fp.y + fp.height
      );
      pushRoom(room);
    }
    return starts;
  }

  roomHasUncontrolledOpening(state, room) {
    const doorKeys = new Set((room.doors ?? []).flatMap((door) => {
      const keys = [];
      for (let y = door.gridRect.y; y < door.gridRect.y + door.gridRect.height; y += 1) {
        for (let x = door.gridRect.x; x < door.gridRect.x + door.gridRect.width; x += 1) {
          keys.push(`${x},${y}`);
        }
      }
      return keys;
    }));

    for (let y = room.grid.y; y < room.grid.y + room.grid.height; y += 1) {
      for (let x = room.grid.x; x < room.grid.x + room.grid.width; x += 1) {
        const current = this.getTile(state, x, y);
        if (current?.roomId !== room.id) {
          continue;
        }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          const neighbor = this.getTile(state, nx, ny);
          if (!neighbor || neighbor.roomId === room.id) {
            continue;
          }
          if (doorKeys.has(`${nx},${ny}`)) {
            continue;
          }
          if (this.isReachableTile(neighbor.tileType)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  isReachableTile(tileType) {
    return tileType === TILE_TYPES.ROOM_FLOOR ||
      tileType === TILE_TYPES.CORRIDOR_FLOOR ||
      tileType === TILE_TYPES.DOOR ||
      tileType === TILE_TYPES.LIFT_ROOM_FLOOR ||
      tileType === TILE_TYPES.LIFT_PAD ||
      tileType === TILE_TYPES.TERMINAL ||
      tileType === TILE_TYPES.ALERT_BOX ||
      tileType === TILE_TYPES.REPAIR_PAD;
  }

  toDeck(state, deckId, name, seed, startRoom, validation) {
    this.finalizeCorridors(state.corridors);
    return {
      id: deckId,
      name,
      seed,
      footprint: this.toWorldRect(state.footprint),
      playableFootprints: state.playableFootprints.map((footprint) => ({ ...footprint })),
      tileMap: {
        tileSize: TILE_SIZE,
        columns: this.columns,
        rows: this.rows,
        tiles: state.tiles
      },
      rooms: state.rooms,
      corridors: state.corridors,
      doors: state.doors,
      lifts: [],
      terminals: state.terminals,
      fixtures: state.fixtures,
      levelPlan: state.levelPlan,
      bounds: { x: 0, y: 0, width: this.config.width, height: this.config.height },
      startRoomId: startRoom.id,
      discovered: false,
      cleared: false,
      collisionCellSize: TILE_SIZE,
      validation
    };
  }

  finalizeCorridors(corridors) {
    for (const corridor of corridors) {
      corridor.fromRoomId = corridor.connectedRoomIds[0] ?? null;
      corridor.toRoomId = corridor.connectedRoomIds[corridor.connectedRoomIds.length - 1] ?? corridor.fromRoomId;
    }
  }

  pickRoomType(random, index, deckId) {
    if (deckId === 1 && index === 0) return this.getRoomTypeById('maintenance');
    if (deckId === SHIP_GENERATION.deckCount && index === 0) return this.getRoomTypeById('utility');
    if (deckId === SHIP_GENERATION.deckCount && index === 1) return this.getRoomTypeById('bridge');
    const deckTypes = ROOM_TYPE_BY_DECK[deckId - 1] ?? ROOM_TYPE_BY_DECK[0];
    return this.getRoomTypeById(random.choice(deckTypes)) ?? random.choice(SHIP_ROOM_TYPES);
  }

  pickStartRoom(rooms, deckId) {
    if (deckId === 1) {
      return rooms.find((room) => START_ROOM_TYPES.has(room.type)) ?? rooms[0];
    }
    return rooms.find((room) => room.type === 'maintenance' || room.type === 'utility') ?? rooms[0];
  }

  getMinimumRoomCount(deckId, state = null) {
    if (state?.playableFootprints?.length) {
      return state.playableFootprints.reduce((sum, footprint) => sum + this.getRequiredRoomCountForFootprint(footprint), 0);
    }
    const profile = FOOTPRINT_PROFILES[deckId - 1] ?? FOOTPRINT_PROFILES[3];
    const largest = FOOTPRINT_PROFILES.reduce((max, item) => item.width * item.height > max.width * max.height ? item : max, FOOTPRINT_PROFILES[0]);
    const areaRatio = (profile.width * profile.height) / (largest.width * largest.height);
    return Math.max(3, Math.round(3 + areaRatio * 9));
  }

  getTargetRoomCount(deckId, state = null) {
    if (state?.playableFootprints?.length) {
      return state.playableFootprints.reduce((sum, footprint) => sum + this.getLevelSize(footprint).targetRooms, 0);
    }
    return this.getMinimumRoomCount(deckId, state) + 3;
  }

  getMaximumRoomCount(deckId, state = null) {
    if (state?.playableFootprints?.length) {
      return state.playableFootprints.reduce((sum, footprint) => sum + this.getLevelSize(footprint).maxRooms, 0);
    }
    const profile = FOOTPRINT_PROFILES[deckId - 1] ?? FOOTPRINT_PROFILES[3];
    const largest = FOOTPRINT_PROFILES.reduce((max, item) => item.width * item.height > max.width * max.height ? item : max, FOOTPRINT_PROFILES[0]);
    const areaRatio = (profile.width * profile.height) / (largest.width * largest.height);
    return Math.round(8 + areaRatio * 18);
  }

  hasMinimumRoomsByFootprint(state) {
    return (state.playableFootprints ?? [state.footprint]).every((footprint) =>
      this.countRoomsInFootprint(state, footprint) >= this.getRequiredRoomCountForFootprint(footprint)
    );
  }

  hasWalkableBudgetByFootprint(state) {
    return (state.playableFootprints ?? [state.footprint]).every((footprint) => {
      const size = this.getLevelSize(footprint);
      const walkable = this.countWalkableInFootprint(state, footprint);
      return walkable >= size.minWalkable && walkable <= Math.ceil(size.maxWalkable * 1.12);
    });
  }

  countWalkableInFootprint(state, footprint) {
    let walkable = 0;
    for (let y = footprint.y; y < footprint.y + footprint.height; y += 1) {
      for (let x = footprint.x; x < footprint.x + footprint.width; x += 1) {
        if (this.isReachableTile(this.getTile(state, x, y)?.tileType)) {
          walkable += 1;
        }
      }
    }
    return walkable;
  }

  getRequiredRoomCountForFootprint(footprint) {
    const size = this.getLevelSize(footprint);
    if (footprint.width < 18 && footprint.sizeClass !== 'tiny') {
      return 2;
    }
    const practicalCapacity = Math.max(3, Math.floor((footprint.width * footprint.height) / 130));
    const designFloor = Math.max(3, Math.ceil(size.minRooms * 0.72));
    return Math.min(size.minRooms, practicalCapacity, designFloor);
  }

  countRoomsInFootprint(state, footprint) {
    return state.rooms.filter((room) => room.plannedLevelId === footprint.plannedLevelId ||
      (!footprint.plannedLevelId && this.gridRectInsideFootprint(room.grid, footprint))).length;
  }

  hasTerminalCoverageByFootprint(state) {
    return (state.playableFootprints ?? [state.footprint]).every((footprint) => {
      const roomIds = new Set(this.getRoomsForFootprint(state, footprint).map((room) => room.id));
      return state.terminals.some((terminal) => roomIds.has(terminal.roomId));
    });
  }

  getRoomsForFootprint(state, footprint) {
    return state.rooms.filter((room) => room.plannedLevelId === footprint.plannedLevelId ||
      (!footprint.plannedLevelId && this.gridRectInsideFootprint(room.grid, footprint)));
  }

  pickRoomDimensions(random, levelSizeClass, footprint) {
    const weights = ROOM_SIZE_WEIGHTS_BY_LEVEL[levelSizeClass] ?? ROOM_SIZE_WEIGHTS_BY_LEVEL.regular;
    const classId = random.choice(weights);
    const rule = ROOM_SIZE_CLASSES[classId] ?? ROOM_SIZE_CLASSES.regular;
    const maxWidth = Math.max(3, Math.min(20, footprint.width - 4, rule.maxSum - rule.minSide));
    const maxHeight = Math.max(3, Math.min(12, footprint.height - 4, rule.maxSum - rule.minSide));
    const minWidth = Math.min(maxWidth, rule.minSide);
    const minHeight = Math.min(maxHeight, rule.minSide);
    let width = random.integer(minWidth, maxWidth);
    let height = random.integer(minHeight, maxHeight);
    if (width + height > rule.maxSum) {
      const overflow = width + height - rule.maxSum;
      if (width >= height) width = Math.max(minWidth, width - overflow);
      else height = Math.max(minHeight, height - overflow);
    }
    return { width, height };
  }

  getRoomTypeById(id) {
    return SHIP_ROOM_TYPES.find((type) => type.id === id) ?? null;
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

  setTile(state, x, y, tileType, data = {}) {
    const tile = this.getTile(state, x, y);
    if (!tile) return;
    Object.assign(tile, data, { tileType });
  }

  getTile(state, x, y) {
    return state.tiles[y]?.[x] ?? null;
  }

  inFootprint(x, y, footprint) {
    return x >= footprint.x && x < footprint.x + footprint.width && y >= footprint.y && y < footprint.y + footprint.height;
  }

  inPlayableFootprint(x, y, state) {
    return (state.playableFootprints ?? [state.footprint]).some((footprint) => this.inFootprint(x, y, footprint));
  }

  gridRectInsideFootprint(rect, footprint) {
    return rect.x >= footprint.x &&
      rect.y >= footprint.y &&
      rect.x + rect.width <= footprint.x + footprint.width &&
      rect.y + rect.height <= footprint.y + footprint.height;
  }

  gridRectInsidePlayableFootprints(rect, state) {
    return (state.playableFootprints ?? [state.footprint]).some((footprint) => this.gridRectInsideFootprint(rect, footprint));
  }

  getFootprintForPlannedLevel(state, plannedLevelId) {
    if (!plannedLevelId) return null;
    return (state.playableFootprints ?? []).find((footprint) => footprint.plannedLevelId === plannedLevelId) ?? null;
  }

  clampGridRect(rect, footprint) {
    const x = Math.max(footprint.x, rect.x);
    const y = Math.max(footprint.y, rect.y);
    const right = Math.min(footprint.x + footprint.width, rect.x + rect.width);
    const bottom = Math.min(footprint.y + footprint.height, rect.y + rect.height);
    return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
  }

  toWorldRect(rect) {
    return {
      x: rect.x * TILE_SIZE,
      y: rect.y * TILE_SIZE,
      width: rect.width * TILE_SIZE,
      height: rect.height * TILE_SIZE
    };
  }

  gridToWorld(x, y) {
    return { x: x * TILE_SIZE, y: y * TILE_SIZE };
  }

  shuffle(random, items) {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = random.integer(0, i);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
