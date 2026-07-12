export const SHIP_ROOM_TYPES = [
  { id: 'bridge', label: 'Bridge', color: 0x4fc3ff },
  { id: 'cargo', label: 'Cargo', color: 0xa6d66d },
  { id: 'engineering', label: 'Engineering', color: 0xffb35c },
  { id: 'security', label: 'Security', color: 0xff6f61 },
  { id: 'maintenance', label: 'Maintenance', color: 0xbaf7ff },
  { id: 'data-core', label: 'Data Core', color: 0xc18cff },
  { id: 'dormitory', label: 'Dormitory', color: 0x8fa7b5 },
  { id: 'reactor', label: 'Reactor', color: 0xffdf6e },
  { id: 'utility', label: 'Utility', color: 0x79f2c0 },
  { id: 'medical', label: 'Medical', color: 0x7bdcff }
];

export const START_ROOM_TYPES = new Set(['maintenance', 'utility']);
