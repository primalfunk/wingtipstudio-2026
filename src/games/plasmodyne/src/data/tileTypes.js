export const TILE_TYPES = {
  VOID: 'void',
  SOLID: 'solid',
  WALL_FILL: 'wall-fill',
  ROOM_FLOOR: 'room-floor',
  CORRIDOR_FLOOR: 'corridor-floor',
  DOOR: 'door',
  HALL_FLOOR: 'corridor-floor',
  LIFT_ROOM_FLOOR: 'lift-room-floor',
  LIFT_PAD: 'lift-pad',
  LIFT: 'lift-pad',
  TERMINAL: 'terminal',
  REPAIR_PAD: 'repair-pad',
  ALERT_BOX: 'alert-box',
  OBSTACLE: 'blocked',
  BLOCKED: 'blocked',
  RESERVED: 'reserved'
};

export function isFloorTile(tileType) {
  return tileType === TILE_TYPES.ROOM_FLOOR ||
    tileType === TILE_TYPES.CORRIDOR_FLOOR ||
    tileType === TILE_TYPES.DOOR ||
    tileType === TILE_TYPES.LIFT_ROOM_FLOOR ||
    tileType === TILE_TYPES.LIFT_PAD ||
    tileType === TILE_TYPES.TERMINAL ||
    tileType === TILE_TYPES.ALERT_BOX ||
    tileType === TILE_TYPES.REPAIR_PAD;
}
