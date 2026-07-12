import { TILE_TYPES } from '../../data/tileTypes.js';

const CARDINALS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 }
];

const MAX_SEARCH_CELLS = 3600;

export class DroidPathfinder {
  static findPath(deck, from, to, options = {}) {
    if (!deck?.tileMap) {
      return [];
    }
    const tileSize = deck.tileMap.tileSize;
    const start = worldToCell(from.x, from.y, tileSize);
    const goal = worldToCell(to.x, to.y, tileSize);
    const rows = deck.tileMap.tiles;
    if (!this.isCellWalkable(deck, start.x, start.y, options) || !this.isCellWalkable(deck, goal.x, goal.y, options)) {
      return [];
    }

    const queue = [start];
    const cameFrom = new Map();
    const startKey = cellKey(start.x, start.y);
    const goalKey = cellKey(goal.x, goal.y);
    cameFrom.set(startKey, null);

    let cursor = 0;
    while (cursor < queue.length && cameFrom.size < MAX_SEARCH_CELLS) {
      const current = queue[cursor];
      cursor += 1;
      if (cellKey(current.x, current.y) === goalKey) {
        break;
      }

      for (const dir of CARDINALS) {
        const next = { x: current.x + dir.x, y: current.y + dir.y };
        if (!rows[next.y]?.[next.x]) {
          continue;
        }
        const key = cellKey(next.x, next.y);
        if (cameFrom.has(key) || !this.isCellWalkable(deck, next.x, next.y, options)) {
          continue;
        }
        cameFrom.set(key, current);
        queue.push(next);
      }
    }

    if (!cameFrom.has(goalKey)) {
      return [];
    }

    const cells = [];
    let current = goal;
    while (current) {
      cells.push(current);
      current = cameFrom.get(cellKey(current.x, current.y));
    }
    cells.reverse();
    return cells.slice(1).map((cell) => cellToWorldCenter(cell.x, cell.y, tileSize));
  }

  static isCellWalkable(deck, x, y, options = {}) {
    const tile = deck.tileMap?.tiles[y]?.[x];
    if (!tile) {
      return false;
    }
    if (tile.tileType === TILE_TYPES.LIFT_PAD) {
      return !options.avoidLiftPads;
    }
    if (options.allowedRoomIds?.size && tile.roomId && !options.allowedRoomIds.has(tile.roomId)) {
      return false;
    }
    if (options.allowedRegionId && !cellBelongsToRegion(deck, tile, options.allowedRegionId)) {
      return false;
    }
    return isDroidWalkableType(tile.tileType);
  }

  static collectRoomCells(deck, roomId) {
    return collectCells(deck, (tile) => tile.roomId === roomId && isDroidWalkableType(tile.tileType));
  }

  static collectRegionCells(deck, regionId) {
    return collectCells(deck, (tile) => cellBelongsToRegion(deck, tile, regionId) && isDroidWalkableType(tile.tileType));
  }

  static collectRoomClusterCells(deck, roomIds) {
    const roomSet = new Set(roomIds);
    return collectCells(deck, (tile) => (
      isDroidWalkableType(tile.tileType) &&
      (roomSet.has(tile.roomId) || tile.corridorId || tile.tileType === TILE_TYPES.DOOR)
    ));
  }

  static findNearestRepairPad(deck, from, options = {}) {
    const pads = (deck.fixtures ?? []).filter((fixture) => fixture.type === 'repair-pad');
    let best = null;
    let bestDistance = Infinity;
    for (const pad of pads) {
      const cell = worldToCell(pad.x, pad.y, deck.tileMap.tileSize);
      if (!this.isCellWalkable(deck, cell.x, cell.y, options)) {
        continue;
      }
      const distance = Math.hypot(pad.x - from.x, pad.y - from.y);
      if (distance < bestDistance) {
        best = pad;
        bestDistance = distance;
      }
    }
    return best;
  }
}

export function worldToCell(x, y, tileSize) {
  return {
    x: Math.floor(x / tileSize),
    y: Math.floor(y / tileSize)
  };
}

export function cellToWorldCenter(x, y, tileSize) {
  return {
    x: x * tileSize + tileSize / 2,
    y: y * tileSize + tileSize / 2
  };
}

function collectCells(deck, predicate) {
  const cells = [];
  const tileSize = deck.tileMap?.tileSize ?? 32;
  const rows = deck.tileMap?.tiles ?? [];
  for (let y = 0; y < rows.length; y += 1) {
    for (let x = 0; x < rows[y].length; x += 1) {
      const tile = rows[y][x];
      if (predicate(tile, x, y)) {
        cells.push({ ...cellToWorldCenter(x, y, tileSize), gridX: x, gridY: y, tile });
      }
    }
  }
  return cells;
}

function cellBelongsToRegion(deck, tile, regionId) {
  const region = deck.regions?.find((item) => item.id === regionId);
  if (!region) {
    return true;
  }
  return (tile.roomId && region.roomIds?.includes(tile.roomId)) ||
    (tile.corridorId && region.hallIds?.includes(tile.corridorId)) ||
    (tile.liftRoomId && region.liftRoomIds?.includes(tile.liftRoomId)) ||
    tile.tileType === TILE_TYPES.DOOR;
}

function isDroidWalkableType(tileType) {
  return tileType === TILE_TYPES.ROOM_FLOOR ||
    tileType === TILE_TYPES.CORRIDOR_FLOOR ||
    tileType === TILE_TYPES.DOOR ||
    tileType === TILE_TYPES.LIFT_ROOM_FLOOR ||
    tileType === TILE_TYPES.TERMINAL ||
    tileType === TILE_TYPES.ALERT_BOX ||
    tileType === TILE_TYPES.REPAIR_PAD;
}

function cellKey(x, y) {
  return `${x},${y}`;
}
