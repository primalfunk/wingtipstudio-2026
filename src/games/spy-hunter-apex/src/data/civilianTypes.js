export const ROAD_CIVILIAN_TYPES = [
  {
    id: 'civilian-car',
    label: 'Civilian Car',
    textureKey: 'civilian-car',
    kind: 'civilian',
    scorePenalty: 75,
    displayWidth: 25,
    displayHeight: 47,
    bodyWidth: 19,
    bodyHeight: 44,
    tintable: true,
  },
  {
    id: 'blue-bike',
    label: 'Blue Motorcycle',
    textureKey: 'civilian-blue-bike',
    kind: 'civilian',
    scorePenalty: 85,
    displayWidth: 20,
    displayHeight: 45,
    bodyWidth: 12,
    bodyHeight: 39,
  },
  {
    id: 'green-bike',
    label: 'Green Motorcycle',
    textureKey: 'civilian-green-bike',
    kind: 'civilian',
    scorePenalty: 85,
    displayWidth: 19,
    displayHeight: 45,
    bodyWidth: 12,
    bodyHeight: 39,
  },
  {
    id: 'red-bike',
    label: 'Red Motorcycle',
    textureKey: 'civilian-red-bike',
    kind: 'civilian',
    scorePenalty: 85,
    displayWidth: 20,
    displayHeight: 45,
    bodyWidth: 12,
    bodyHeight: 39,
  },
];

export const DOMESTIC_ROAD_TYPES = ROAD_CIVILIAN_TYPES;

export const WATCHED_ROAD_TYPES = [
  ROAD_CIVILIAN_TYPES[0],
  ROAD_CIVILIAN_TYPES[1],
  ROAD_CIVILIAN_TYPES[3],
  {
    id: 'surveillance-sedan',
    label: 'Surveillance Sedan',
    textureKey: 'civilian-surveillance-sedan',
    kind: 'civilian',
    scorePenalty: 95,
    displayWidth: 25,
    displayHeight: 49,
    bodyWidth: 19,
    bodyHeight: 45,
  },
];

export const SUPPORT_ROAD_TYPES = [
  ROAD_CIVILIAN_TYPES[0],
  ROAD_CIVILIAN_TYPES[2],
  {
    id: 'utility-van',
    label: 'Utility Van',
    textureKey: 'civilian-utility-van',
    kind: 'civilian',
    scorePenalty: 115,
    displayWidth: 30,
    displayHeight: 58,
    bodyWidth: 23,
    bodyHeight: 53,
  },
  {
    id: 'service-pickup',
    label: 'Service Pickup',
    textureKey: 'civilian-service-pickup',
    kind: 'civilian',
    scorePenalty: 100,
    displayWidth: 27,
    displayHeight: 52,
    bodyWidth: 21,
    bodyHeight: 48,
  },
];

export const INDUSTRIAL_ROAD_TYPES = [
  {
    id: 'freight-truck',
    label: 'Freight Truck',
    textureKey: 'civilian-freight-truck',
    kind: 'civilian',
    scorePenalty: 145,
    displayWidth: 32,
    displayHeight: 74,
    bodyWidth: 25,
    bodyHeight: 68,
    speedMultiplier: 0.82,
  },
  {
    id: 'tanker-truck',
    label: 'Tanker Truck',
    textureKey: 'civilian-tanker-truck',
    kind: 'civilian',
    scorePenalty: 160,
    displayWidth: 34,
    displayHeight: 78,
    bodyWidth: 26,
    bodyHeight: 72,
    speedMultiplier: 0.76,
  },
  {
    id: 'box-hauler',
    label: 'Box Hauler',
    textureKey: 'civilian-box-hauler',
    kind: 'civilian',
    scorePenalty: 130,
    displayWidth: 31,
    displayHeight: 68,
    bodyWidth: 24,
    bodyHeight: 62,
    speedMultiplier: 0.86,
  },
  ROAD_CIVILIAN_TYPES[0],
];

export const CONSTRUCTION_ROAD_TYPES = [
  {
    id: 'maintenance-truck',
    label: 'Maintenance Truck',
    textureKey: 'civilian-maintenance-truck',
    kind: 'civilian',
    scorePenalty: 125,
    displayWidth: 31,
    displayHeight: 62,
    bodyWidth: 24,
    bodyHeight: 56,
    speedMultiplier: 0.84,
  },
  {
    id: 'work-crew-car',
    label: 'Work Crew Car',
    textureKey: 'civilian-work-crew-car',
    kind: 'civilian',
    scorePenalty: 105,
    displayWidth: 27,
    displayHeight: 52,
    bodyWidth: 21,
    bodyHeight: 48,
  },
  ROAD_CIVILIAN_TYPES[0],
];

export const CHECKPOINT_ROAD_TYPES = [
  {
    id: 'inspection-van',
    label: 'Inspection Van',
    textureKey: 'civilian-inspection-van',
    kind: 'civilian',
    scorePenalty: 130,
    displayWidth: 31,
    displayHeight: 62,
    bodyWidth: 24,
    bodyHeight: 57,
    speedMultiplier: 0.82,
  },
  {
    id: 'border-transport',
    label: 'Border Transport',
    textureKey: 'civilian-border-transport',
    kind: 'civilian',
    scorePenalty: 150,
    displayWidth: 33,
    displayHeight: 72,
    bodyWidth: 25,
    bodyHeight: 66,
    speedMultiplier: 0.76,
  },
  ROAD_CIVILIAN_TYPES[0],
];

export const WATER_CIVILIAN_TYPES = [
  {
    id: 'fisher',
    label: 'Fishing Boat',
    textureKey: 'water-fisher',
    kind: 'civilian',
    scorePenalty: 90,
    displayWidth: 25,
    displayHeight: 62,
    bodyWidth: 16,
    bodyHeight: 54,
  },
  {
    id: 'cargo-skiff',
    label: 'Cargo Skiff',
    textureKey: 'water-cargo-skiff',
    kind: 'civilian',
    scorePenalty: 110,
    displayWidth: 34,
    displayHeight: 72,
    bodyWidth: 23,
    bodyHeight: 64,
  },
  {
    id: 'fuel-barge',
    label: 'Fuel Barge',
    textureKey: 'water-fuel-barge',
    kind: 'civilian',
    scorePenalty: 150,
    displayWidth: 38,
    displayHeight: 82,
    bodyWidth: 27,
    bodyHeight: 74,
  },
  {
    id: 'patrol-tender',
    label: 'Patrol Tender',
    textureKey: 'water-patrol-tender',
    kind: 'civilian',
    scorePenalty: 120,
    displayWidth: 33,
    displayHeight: 74,
    bodyWidth: 22,
    bodyHeight: 66,
  },
  {
    id: 'wood',
    label: 'Floating Wood',
    textureKey: 'water-wood',
    kind: 'obstacle',
    scorePenalty: 0,
    displayWidth: 34,
    displayHeight: 34,
    bodyWidth: 25,
    bodyHeight: 30,
  },
];

export function getCivilianPool(mode, context = {}) {
  if (mode === 'boat') {
    return WATER_CIVILIAN_TYPES;
  }

  const tags = context.segment?.tags ?? [];
  if (tags.includes('industrial') || tags.includes('freight')) {
    return INDUSTRIAL_ROAD_TYPES;
  }
  if (tags.includes('construction') || tags.includes('diversion')) {
    return CONSTRUCTION_ROAD_TYPES;
  }
  if (tags.includes('checkpoint') || tags.includes('fortified')) {
    return CHECKPOINT_ROAD_TYPES;
  }
  if (tags.includes('support-rich') || context.environmentProfile === 'support_corridor') {
    return SUPPORT_ROAD_TYPES;
  }
  if (tags.includes('watched') || context.environmentProfile === 'watched_grid') {
    return WATCHED_ROAD_TYPES;
  }
  return DOMESTIC_ROAD_TYPES;
}
