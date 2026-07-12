import { pointInRect } from '../utils/geometry.js';
import { TILE_TYPES } from '../data/tileTypes.js';

const INTERACTION_TILE_TYPES = new Set([
  TILE_TYPES.LIFT_PAD,
  TILE_TYPES.TERMINAL,
  TILE_TYPES.ALERT_BOX,
  TILE_TYPES.REPAIR_PAD
]);

export class MapSystem {
  constructor(deck, options = {}) {
    this.deck = deck;
    this.collisionCellSize = options.collisionCellSize ?? Math.min(deck.collisionCellSize ?? 16, 16);
    this.collisionInset = options.collisionInset ?? 2;
    this.clearanceLevel = options.clearanceLevel ?? 0;
    this.cachedCollisionRects = null;
    this.cachedBoundarySegments = null;
    this.cachedWalkableRows = null;
    this.cachedCollisionAuditWarnings = null;
  }

  setAccessClearance(clearanceLevel) {
    if (clearanceLevel === this.clearanceLevel) {
      return;
    }
    this.clearanceLevel = clearanceLevel;
    this.clearCachedGeometry();
  }

  clearCachedGeometry() {
    this.cachedCollisionRects = null;
    this.cachedBoundarySegments = null;
    this.cachedWalkableRows = null;
    this.cachedCollisionAuditWarnings = null;
  }

  getRoomAt(x, y) {
    const tile = this.getTileAtWorld(x, y);
    if (tile?.roomId) {
      return this.deck.rooms.find((room) => room.id === tile.roomId) ?? null;
    }
    return this.deck.rooms.find((room) => pointInRect(x, y, room)) ?? null;
  }

  getCorridorAt(x, y) {
    const tile = this.getTileAtWorld(x, y);
    if (tile?.corridorId) {
      return this.deck.corridors.find((corridor) => corridor.id === tile.corridorId) ?? null;
    }
    return this.deck.corridors.find((corridor) => corridor.rects.some((rect) => pointInRect(x, y, rect))) ?? null;
  }

  discoverAt(x, y) {
    const room = this.getRoomAt(x, y);
    if (!room) {
      return null;
    }

    if (!room.discovered) {
      room.discovered = true;
    }

    for (const corridor of this.deck.corridors) {
      if (corridor.fromRoomId === room.id || corridor.toRoomId === room.id) {
        corridor.discovered = true;
      }
    }

    return room;
  }

  isTraversableCell(x, y) {
    const tile = this.getTileAtWorld(x, y);
    if (this.deck.tileMap) {
      const tileType = tile?.tileType;
      return tileType === TILE_TYPES.ROOM_FLOOR ||
        tileType === TILE_TYPES.CORRIDOR_FLOOR ||
        tileType === TILE_TYPES.DOOR ||
        tileType === TILE_TYPES.LIFT_ROOM_FLOOR ||
        tileType === TILE_TYPES.LIFT_PAD ||
        tileType === TILE_TYPES.TERMINAL ||
        tileType === TILE_TYPES.ALERT_BOX ||
        tileType === TILE_TYPES.REPAIR_PAD;
    }
    if (this.getRoomAt(x, y)) {
      return true;
    }
    return Boolean(this.getCorridorAt(x, y));
  }

  isBlockedByClosedDoor(x, y, padding = 0) {
    return this.getClosedDoorBlockRects(padding).some((rect) => pointInRect(x, y, rect));
  }

  isWalkableAt(x, y) {
    return this.isTraversableCell(x, y);
  }

  canFitCircleAt(x, y, radius) {
    const openDoor = this.getOpenDoorPassageAt(x, y, radius);
    if (openDoor) {
      return this.canFitThroughOpenDoor(x, y, radius, openDoor);
    }

    if (!this.isWalkableAt(x, y)) {
      return false;
    }

    const interactionAperture = this.getInteractionApertureAt(x, y);
    const sampleRadius = interactionAperture ? Math.min(radius, interactionAperture.radius) : radius;
    const samples = 32;
    for (let i = 0; i < samples; i += 1) {
      const angle = (Math.PI * 2 * i) / samples;
      const sampleX = x + Math.cos(angle) * sampleRadius;
      const sampleY = y + Math.sin(angle) * sampleRadius;
      if (!this.isWalkableAt(sampleX, sampleY) && !this.isDoorFrameForgivenessAt(sampleX, sampleY)) {
        return false;
      }
    }

    return true;
  }

  getOpenDoorPassageAt(x, y, radius) {
    const padding = Math.max(10, radius * 0.55);
    return this.getAllDoors().find((door) => {
      if (!door.open) {
        return false;
      }
      const passage = this.getOpenDoorPassageRect(door, padding);
      return pointInRect(x, y, passage);
    }) ?? null;
  }

  canFitThroughOpenDoor(x, y, radius, door) {
    const reducedRadius = radius * 0.76;
    if (!this.isWalkableAt(x, y)) {
      return false;
    }

    const passage = this.getOpenDoorPassageRect(door, radius * 0.72);
    const samples = 24;
    for (let i = 0; i < samples; i += 1) {
      const angle = (Math.PI * 2 * i) / samples;
      const sampleX = x + Math.cos(angle) * reducedRadius;
      const sampleY = y + Math.sin(angle) * reducedRadius;
      if (this.isWalkableAt(sampleX, sampleY)) {
        continue;
      }
      if (this.isDoorFrameForgivenessAt(sampleX, sampleY)) {
        continue;
      }
      if (pointInRect(sampleX, sampleY, passage)) {
        continue;
      }
      return false;
    }

    return true;
  }

  getOpenDoorPassageRect(door, padding = 0) {
    const rect = this.getDoorBlockRect(door, 0);
    if (door.orientation === 'vertical') {
      return {
        x: rect.x - padding,
        y: rect.y,
        width: rect.width + padding * 2,
        height: rect.height
      };
    }
    return {
      x: rect.x,
      y: rect.y - padding,
      width: rect.width,
      height: rect.height + padding * 2
    };
  }

  getCollisionRects() {
    if (this.cachedCollisionRects) {
      return this.cachedCollisionRects;
    }

    const cellSize = this.collisionCellSize;
    const columns = Math.ceil(this.deck.bounds.width / cellSize);
    const rows = Math.ceil(this.deck.bounds.height / cellSize);
    const solidRows = [];

    for (let row = 0; row < rows; row += 1) {
      solidRows[row] = [];
      for (let column = 0; column < columns; column += 1) {
        const x = this.deck.bounds.x + column * cellSize + cellSize / 2;
        const y = this.deck.bounds.y + row * cellSize + cellSize / 2;
        solidRows[row][column] = !this.isWalkableAt(x, y) && !this.isDoorFrameForgivenessAt(x, y);
      }
    }

    const rawRects = this.mergeSolidCells(solidRows, cellSize);
    this.cachedCollisionAuditWarnings = this.auditCollisionRects(rawRects, 'WallCollisionLayer/raw');
    this.cachedCollisionRects = this.insetCollisionRects(rawRects, this.collisionInset);
    return this.cachedCollisionRects;
  }

  getCollisionAuditWarnings() {
    if (!this.cachedCollisionAuditWarnings) {
      this.getCollisionRects();
    }
    const finalWarnings = this.auditCollisionRects(this.cachedCollisionRects ?? [], 'WallCollisionLayer');
    return [...(this.cachedCollisionAuditWarnings ?? []), ...finalWarnings];
  }

  getWalkableRows() {
    if (this.cachedWalkableRows) {
      return this.cachedWalkableRows;
    }

    const cellSize = this.collisionCellSize;
    const columns = Math.ceil(this.deck.bounds.width / cellSize);
    const rows = Math.ceil(this.deck.bounds.height / cellSize);
    const walkableRows = [];

    for (let row = 0; row < rows; row += 1) {
      walkableRows[row] = [];
      for (let column = 0; column < columns; column += 1) {
        const x = this.deck.bounds.x + column * cellSize + cellSize / 2;
        const y = this.deck.bounds.y + row * cellSize + cellSize / 2;
        walkableRows[row][column] = this.isWalkableAt(x, y);
      }
    }

    this.cachedWalkableRows = walkableRows;
    return walkableRows;
  }

  getWalkableBoundarySegments() {
    if (this.cachedBoundarySegments) {
      return this.cachedBoundarySegments;
    }

    const cellSize = this.collisionCellSize;
    const rows = this.getWalkableRows();
    const segments = [];
    const isOpen = (row, column) => Boolean(rows[row]?.[column]);

    for (let row = 0; row < rows.length; row += 1) {
      for (let column = 0; column < rows[row].length; column += 1) {
        if (!isOpen(row, column)) {
          continue;
        }

        const x = this.deck.bounds.x + column * cellSize;
        const y = this.deck.bounds.y + row * cellSize;
        if (!isOpen(row - 1, column)) {
          segments.push({ x1: x, y1: y, x2: x + cellSize, y2: y });
        }
        if (!isOpen(row + 1, column)) {
          segments.push({ x1: x, y1: y + cellSize, x2: x + cellSize, y2: y + cellSize });
        }
        if (!isOpen(row, column - 1)) {
          segments.push({ x1: x, y1: y, x2: x, y2: y + cellSize });
        }
        if (!isOpen(row, column + 1)) {
          segments.push({ x1: x + cellSize, y1: y, x2: x + cellSize, y2: y + cellSize });
        }
      }
    }

    this.cachedBoundarySegments = this.mergeBoundarySegments(segments);
    return this.cachedBoundarySegments;
  }

  mergeBoundarySegments(segments) {
    const horizontal = new Map();
    const vertical = new Map();
    for (const segment of segments) {
      if (segment.y1 === segment.y2) {
        const y = segment.y1;
        if (!horizontal.has(y)) horizontal.set(y, []);
        horizontal.get(y).push({
          x1: Math.min(segment.x1, segment.x2),
          x2: Math.max(segment.x1, segment.x2),
          y
        });
      } else {
        const x = segment.x1;
        if (!vertical.has(x)) vertical.set(x, []);
        vertical.get(x).push({
          y1: Math.min(segment.y1, segment.y2),
          y2: Math.max(segment.y1, segment.y2),
          x
        });
      }
    }

    const merged = [];
    const gapTolerance = 1;
    for (const [y, spans] of horizontal.entries()) {
      spans.sort((a, b) => a.x1 - b.x1);
      for (const span of spans) {
        const last = merged[merged.length - 1];
        if (last && last.y1 === y && last.y2 === y && span.x1 <= last.x2 + gapTolerance) {
          last.x2 = Math.max(last.x2, span.x2);
        } else {
          merged.push({ x1: span.x1, y1: y, x2: span.x2, y2: y });
        }
      }
    }
    for (const [x, spans] of vertical.entries()) {
      spans.sort((a, b) => a.y1 - b.y1);
      for (const span of spans) {
        const last = merged[merged.length - 1];
        if (last && last.x1 === x && last.x2 === x && span.y1 <= last.y2 + gapTolerance) {
          last.y2 = Math.max(last.y2, span.y2);
        } else {
          merged.push({ x1: x, y1: span.y1, x2: x, y2: span.y2 });
        }
      }
    }
    return merged;
  }

  getLockedDoorBlockRects(padding = 0) {
    return this.getClosedDoorBlockRects(padding).filter((rect) => rect.locked);
  }

  getClosedDoorBlockRects(padding = 0) {
    const rects = [];
    for (const door of this.getAllDoors()) {
      const locked = false;
      const closed = !door.open;
      if (!closed) {
        continue;
      }
      rects.push({ ...this.getDoorBlockRect(door, padding), locked });
    }
    return rects;
  }

  getAllDoors() {
    if (this.deck.doors?.length) {
      return this.deck.doors;
    }
    return this.deck.rooms.flatMap((room) => room.doors ?? []);
  }

  getDoorBlockRect(door, padding = 0) {
    if (door.orientation === 'vertical') {
      const width = Math.max(door.width, 16) + padding * 2;
      const height = Math.max(door.height, 32) + padding * 2;
      return {
        x: door.x + door.width / 2 - width / 2,
        y: door.y + door.height / 2 - height / 2,
        width,
        height
      };
    }
    const width = Math.max(door.width, 32) + padding * 2;
    const height = Math.max(door.height, 16) + padding * 2;
    return {
      x: door.x + door.width / 2 - width / 2,
      y: door.y + door.height / 2 - height / 2,
      width,
      height
    };
  }

  isDoorFrameForgivenessAt(x, y) {
    const tileSize = this.deck.tileMap?.tileSize ?? 64;
    const inset = Math.min(18, tileSize * 0.28);

    for (const door of this.getAllDoors()) {
      const rect = this.getDoorBlockRect(door, 0);
      if (door.orientation === 'vertical') {
        const inDoorWidth = x >= rect.x && x <= rect.x + rect.width;
        const inUpperJamb = y >= rect.y - inset && y < rect.y;
        const inLowerJamb = y > rect.y + rect.height && y <= rect.y + rect.height + inset;
        if (inDoorWidth && (inUpperJamb || inLowerJamb)) {
          return true;
        }
      } else {
        const inDoorHeight = y >= rect.y && y <= rect.y + rect.height;
        const inLeftJamb = x >= rect.x - inset && x < rect.x;
        const inRightJamb = x > rect.x + rect.width && x <= rect.x + rect.width + inset;
        if (inDoorHeight && (inLeftJamb || inRightJamb)) {
          return true;
        }
      }
    }

    return false;
  }

  getTileAtWorld(x, y) {
    if (!this.deck.tileMap) {
      return null;
    }
    const tileSize = this.deck.tileMap.tileSize;
    const gridX = Math.floor(x / tileSize);
    const gridY = Math.floor(y / tileSize);
    return this.deck.tileMap.tiles[gridY]?.[gridX] ?? null;
  }

  getInteractionApertureAt(x, y) {
    const tile = this.getTileAtWorld(x, y);
    if (!tile || !INTERACTION_TILE_TYPES.has(tile.tileType)) {
      return null;
    }
    const tileSize = this.deck.tileMap?.tileSize ?? 32;
    return {
      x: (tile.x + 0.5) * tileSize,
      y: (tile.y + 0.5) * tileSize,
      radius: tileSize * 0.22,
      tileType: tile.tileType
    };
  }

  mergeSolidCells(solidRows, cellSize) {
    const rects = [];
    for (let row = 0; row < solidRows.length; row += 1) {
      let column = 0;
      while (column < solidRows[row].length) {
        if (!solidRows[row][column]) {
          column += 1;
          continue;
        }

        const start = column;
        while (column < solidRows[row].length && solidRows[row][column]) {
          column += 1;
        }

        const run = {
          x: this.deck.bounds.x + start * cellSize,
          y: this.deck.bounds.y + row * cellSize,
          width: (column - start) * cellSize,
          height: cellSize
        };

        const previous = rects.find((rect) => (
          rect.x === run.x &&
          rect.width === run.width &&
          rect.y + rect.height === run.y
        ));

        if (previous) {
          previous.height += cellSize;
        } else {
          rects.push(run);
        }
      }
    }

    return rects;
  }

  insetCollisionRects(rects, inset = 0) {
    if (inset <= 0) {
      return rects.map((rect) => ({ ...rect, layerName: 'WallCollisionLayer' }));
    }
    return rects
      .map((rect) => ({
        x: rect.x + inset,
        y: rect.y + inset,
        width: rect.width - inset * 2,
        height: rect.height - inset * 2,
        layerName: 'WallCollisionLayer',
        sourceRect: rect
      }))
      .filter((rect) => rect.width > 0 && rect.height > 0);
  }

  auditCollisionRects(rects, layerName = 'WallCollisionLayer') {
    return rects
      .filter((rect) => rect.width <= 4 || rect.height <= 4 || rect.width * rect.height <= 64)
      .map((rect) => `Suspicious wall collider: ${Math.round(rect.width)}x${Math.round(rect.height)} at x=${Math.round(rect.x)}, y=${Math.round(rect.y)} on ${layerName}. Decorative wall layer should not collide.`);
  }
}
