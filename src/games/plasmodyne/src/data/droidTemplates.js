export const SPEED_TIERS = {
  SPEED_1: 76,
  SPEED_2: 112,
  SPEED_3: 154,
  SPEED_4: 198,
  SPEED_5: 250
};

export const ARMOR_TIERS = {
  ARMOR_1: 28,
  ARMOR_2: 48,
  ARMOR_3: 78,
  ARMOR_4: 118,
  ARMOR_5: 180
};

export function formatRank(rank) {
  return String(rank).padStart(3, '0');
}

export const DROID_MODEL_TINTS = [
  { name: 'STANDARD', tint: null, color: 0xbaf7ff },
  { name: 'CYAN', tint: 0x8ff0ff, color: 0x8ff0ff },
  { name: 'GOLD', tint: 0xffd36a, color: 0xffd36a },
  { name: 'VIOLET', tint: 0xb66bff, color: 0xb66bff },
  { name: 'RED-ORANGE', tint: 0xff8a3d, color: 0xff8a3d }
];

function template(rank, name, chassisClass, stats) {
  const stability = getDefaultStability(rank, stats);
  return {
    rank,
    displayId: formatRank(rank),
    name,
    chassisClass,
    weaponTier: stats.weaponTier,
    armorTier: stats.armorTier,
    speedTier: stats.speedTier,
    maxIntegrity: stats.maxIntegrity,
    speed: stats.speed,
    weaponType: stats.weaponType ?? 'none',
    damage: stats.damage ?? 0,
    fireRate: stats.fireRate ?? 0,
    range: stats.range ?? 0,
    sensorRange: stats.sensorRange,
    possessionResistance: stats.possessionResistance,
    clearanceLevel: stats.clearanceLevel ?? 0,
    instabilityMax: stats.instabilityMax ?? stability.max,
    instabilityDecayRate: stats.instabilityDecayRate ?? stability.decayRate,
    instabilityBehavior: stats.instabilityBehavior ?? 'eject',
    instabilityRate: stats.instabilityRate ?? stability.decayRate,
    aiProfile: stats.aiProfile,
    fillColor: stats.fillColor,
    strokeColor: stats.strokeColor,
    accentColor: stats.accentColor,
    specialTags: stats.specialTags ?? []
  };
}

function getDefaultStability(rank, stats) {
  if (rank <= 1) {
    return { max: null, decayRate: 0 };
  }
  if (stats.weaponType === 'none' || rank < 200) {
    return { max: 130, decayRate: 1 };
  }
  if (rank < 400) {
    return { max: 112, decayRate: 1 };
  }
  if (rank < 600) {
    return { max: 88, decayRate: 1 };
  }
  if (rank < 800) {
    return { max: 68, decayRate: 1 };
  }
  if (rank < 900) {
    return { max: 54, decayRate: 1 };
  }
  return { max: 40, decayRate: 1 };
}

function stats({
  weaponType = 'none',
  weaponTier = 'WEAPON_0',
  armorTier = 'ARMOR_1',
  speedTier = 'SPEED_3',
  sensorRange = 260,
  possessionResistance = 10,
  clearanceLevel = 0,
  aiProfile = 'wander',
  fillColor = 0x172a32,
  strokeColor = 0xbaf7ff,
  accentColor = 0x79f2c0,
  specialTags = [],
  maxIntegrity = ARMOR_TIERS[armorTier]
}) {
  return {
    weaponType,
    weaponTier,
    armorTier,
    speedTier,
    maxIntegrity,
    speed: SPEED_TIERS[speedTier],
    sensorRange,
    possessionResistance,
    clearanceLevel,
    aiProfile,
    fillColor,
    strokeColor,
    accentColor,
    specialTags
  };
}

export const DROID_TEMPLATES = [
  template(1, 'Influence Device', 'Influence', stats({
    weaponTier: 'WEAPON_0',
    armorTier: 'ARMOR_1',
    speedTier: 'SPEED_3',
    maxIntegrity: 25,
    sensorRange: 180,
    possessionResistance: 5,
    aiProfile: 'utility',
    fillColor: 0x102532,
    strokeColor: 0xbaf7ff,
    accentColor: 0xffd36a,
    specialTags: ['transfer-compatible', 'stable']
  })),
  template(45, 'Utility Skimmer', 'Experimental', stats({
    armorTier: 'ARMOR_1',
    speedTier: 'SPEED_3',
    sensorRange: 210,
    possessionResistance: 10,
    aiProfile: 'utility',
    fillColor: 0x123028,
    strokeColor: 0x79f2c0,
    accentColor: 0xffd36a
  })),
  template(88, 'Maintenance Tick', 'Experimental', stats({
    armorTier: 'ARMOR_1',
    speedTier: 'SPEED_2',
    sensorRange: 220,
    possessionResistance: 13,
    aiProfile: 'utility',
    fillColor: 0x172a32,
    strokeColor: 0xbaf7ff,
    accentColor: 0x79f2c0
  })),

  template(120, 'Utility Frame', 'Service', stats({
    armorTier: 'ARMOR_2',
    speedTier: 'SPEED_2',
    sensorRange: 230,
    possessionResistance: 18,
    aiProfile: 'utility',
    fillColor: 0x1f2d20,
    strokeColor: 0xa6d66d,
    accentColor: 0xbaf7ff
  })),
  template(145, 'Repair Node', 'Repair', stats({
    armorTier: 'ARMOR_1',
    speedTier: 'SPEED_2',
    sensorRange: 235,
    possessionResistance: 20,
    aiProfile: 'utility',
    fillColor: 0x1a2e35,
    strokeColor: 0x7bdcff,
    accentColor: 0xa6d66d,
    specialTags: ['self-repair']
  })),
  template(175, 'Systems Attendant', 'Service', stats({
    armorTier: 'ARMOR_2',
    speedTier: 'SPEED_3',
    sensorRange: 250,
    possessionResistance: 24,
    clearanceLevel: 1,
    aiProfile: 'utility',
    fillColor: 0x24301f,
    strokeColor: 0xa6d66d,
    accentColor: 0xffd36a,
    specialTags: ['utility-access']
  })),

  template(210, 'Cargo Handler', 'Worker', stats({
    weaponType: 'laser-1',
    weaponTier: 'WEAPON_1',
    armorTier: 'ARMOR_3',
    speedTier: 'SPEED_2',
    sensorRange: 300,
    possessionResistance: 30,
    clearanceLevel: 1,
    aiProfile: 'guard',
    fillColor: 0x302a19,
    strokeColor: 0xffb35c,
    accentColor: 0xbaf7ff
  })),
  template(230, 'Inspection Unit', 'Worker', stats({
    weaponType: 'laser-1',
    weaponTier: 'WEAPON_1',
    armorTier: 'ARMOR_2',
    speedTier: 'SPEED_3',
    sensorRange: 330,
    possessionResistance: 32,
    clearanceLevel: 1,
    aiProfile: 'patrol',
    fillColor: 0x1e2838,
    strokeColor: 0x8fa7ff,
    accentColor: 0x7bdcff
  })),
  template(275, 'Dock Servitor', 'Worker', stats({
    weaponType: 'laser-1',
    weaponTier: 'WEAPON_1',
    armorTier: 'ARMOR_2',
    speedTier: 'SPEED_3',
    sensorRange: 315,
    possessionResistance: 35,
    clearanceLevel: 1,
    aiProfile: 'patrol',
    fillColor: 0x292a21,
    strokeColor: 0xffd36a,
    accentColor: 0xbaf7ff
  })),

  template(302, 'Messenger Droid', 'Courier', stats({
    weaponType: 'laser-2',
    weaponTier: 'WEAPON_2',
    armorTier: 'ARMOR_1',
    speedTier: 'SPEED_5',
    sensorRange: 350,
    possessionResistance: 42,
    clearanceLevel: 2,
    aiProfile: 'patrol',
    fillColor: 0x172431,
    strokeColor: 0x4fc3ff,
    accentColor: 0xfff2a6
  })),
  template(330, 'Relay Runner', 'Courier', stats({
    weaponType: 'laser-2',
    weaponTier: 'WEAPON_2',
    armorTier: 'ARMOR_1',
    speedTier: 'SPEED_5',
    sensorRange: 370,
    possessionResistance: 45,
    clearanceLevel: 2,
    aiProfile: 'patrol',
    fillColor: 0x182a34,
    strokeColor: 0x7bdcff,
    accentColor: 0xfff2a6
  })),
  template(375, 'Signal Courier', 'Courier', stats({
    weaponType: 'laser-2',
    weaponTier: 'WEAPON_2',
    armorTier: 'ARMOR_2',
    speedTier: 'SPEED_5',
    sensorRange: 390,
    possessionResistance: 50,
    clearanceLevel: 2,
    aiProfile: 'hunter',
    fillColor: 0x1f2238,
    strokeColor: 0x8fa7ff,
    accentColor: 0xffd36a
  })),

  template(410, 'Patrol Unit', 'Patrol', stats({
    weaponType: 'laser-6',
    weaponTier: 'WEAPON_3',
    armorTier: 'ARMOR_3',
    speedTier: 'SPEED_3',
    sensorRange: 410,
    possessionResistance: 58,
    clearanceLevel: 2,
    aiProfile: 'patrol',
    fillColor: 0x20283b,
    strokeColor: 0x4fc3ff,
    accentColor: 0xffd36a
  })),
  template(450, 'Security Sentry', 'Security', stats({
    weaponType: 'laser-3',
    weaponTier: 'WEAPON_3',
    armorTier: 'ARMOR_4',
    speedTier: 'SPEED_2',
    sensorRange: 430,
    possessionResistance: 64,
    clearanceLevel: 3,
    aiProfile: 'guard',
    fillColor: 0x331c20,
    strokeColor: 0xff6f61,
    accentColor: 0xffd36a
  })),
  template(475, 'Enforcement Node', 'Security', stats({
    weaponType: 'laser-3',
    weaponTier: 'WEAPON_3',
    armorTier: 'ARMOR_3',
    speedTier: 'SPEED_4',
    sensorRange: 440,
    possessionResistance: 68,
    clearanceLevel: 3,
    aiProfile: 'hunter',
    fillColor: 0x292037,
    strokeColor: 0xc18cff,
    accentColor: 0xffd36a
  })),

  template(520, 'Response Drone', 'Assault', stats({
    weaponType: 'laser-4',
    weaponTier: 'WEAPON_4',
    armorTier: 'ARMOR_3',
    speedTier: 'SPEED_4',
    sensorRange: 470,
    possessionResistance: 76,
    clearanceLevel: 3,
    aiProfile: 'hunter',
    fillColor: 0x2d1d27,
    strokeColor: 0xff6f61,
    accentColor: 0xff8a3d
  })),
  template(575, 'Assault Disc', 'Assault', stats({
    weaponType: 'laser-4',
    weaponTier: 'WEAPON_4',
    armorTier: 'ARMOR_4',
    speedTier: 'SPEED_3',
    sensorRange: 485,
    possessionResistance: 82,
    clearanceLevel: 3,
    aiProfile: 'hunter',
    fillColor: 0x351b1b,
    strokeColor: 0xff6f61,
    accentColor: 0xffffff
  })),
  template(590, 'Breach Unit', 'Assault', stats({
    weaponType: 'laser-4',
    weaponTier: 'WEAPON_4',
    armorTier: 'ARMOR_4',
    speedTier: 'SPEED_2',
    sensorRange: 465,
    possessionResistance: 86,
    clearanceLevel: 3,
    aiProfile: 'guard',
    fillColor: 0x3a2118,
    strokeColor: 0xff8a3d,
    accentColor: 0xff6f61
  })),

  template(620, 'Industrial Cutter', 'Industrial Combat', stats({
    weaponType: 'laser-3',
    weaponTier: 'WEAPON_3',
    armorTier: 'ARMOR_5',
    speedTier: 'SPEED_2',
    sensorRange: 430,
    possessionResistance: 90,
    clearanceLevel: 3,
    aiProfile: 'guard',
    fillColor: 0x2c2d32,
    strokeColor: 0x8fa7b5,
    accentColor: 0xffd36a,
    specialTags: ['tank']
  })),
  template(660, 'Furnace Guard', 'Industrial Combat', stats({
    weaponType: 'laser-6',
    weaponTier: 'WEAPON_2',
    armorTier: 'ARMOR_5',
    speedTier: 'SPEED_1',
    sensorRange: 400,
    possessionResistance: 94,
    clearanceLevel: 3,
    aiProfile: 'guard',
    fillColor: 0x352711,
    strokeColor: 0xffb35c,
    accentColor: 0xff6f61,
    specialTags: ['tank']
  })),
  template(690, 'Siege Worker', 'Industrial Combat', stats({
    weaponType: 'laser-6',
    weaponTier: 'WEAPON_3',
    armorTier: 'ARMOR_5',
    speedTier: 'SPEED_1',
    sensorRange: 410,
    possessionResistance: 98,
    clearanceLevel: 3,
    aiProfile: 'guard',
    fillColor: 0x362a15,
    strokeColor: 0xffb35c,
    accentColor: 0xff6f61,
    specialTags: ['tank']
  })),

  template(735, 'Hunter Unit', 'Hunter', stats({
    weaponType: 'laser-7',
    weaponTier: 'WEAPON_4',
    armorTier: 'ARMOR_3',
    speedTier: 'SPEED_5',
    sensorRange: 560,
    possessionResistance: 108,
    clearanceLevel: 4,
    aiProfile: 'hunter',
    fillColor: 0x21192f,
    strokeColor: 0xc18cff,
    accentColor: 0xff6f61
  })),
  template(760, 'Pursuit Shell', 'Hunter', stats({
    weaponType: 'laser-7',
    weaponTier: 'WEAPON_4',
    armorTier: 'ARMOR_3',
    speedTier: 'SPEED_5',
    sensorRange: 580,
    possessionResistance: 112,
    clearanceLevel: 4,
    aiProfile: 'hunter',
    fillColor: 0x171d36,
    strokeColor: 0x8fa7ff,
    accentColor: 0xff6f61
  })),
  template(790, 'Interceptor', 'Hunter', stats({
    weaponType: 'laser-7',
    weaponTier: 'WEAPON_4',
    armorTier: 'ARMOR_4',
    speedTier: 'SPEED_5',
    sensorRange: 600,
    possessionResistance: 118,
    clearanceLevel: 4,
    aiProfile: 'hunter',
    fillColor: 0x1b2139,
    strokeColor: 0x8fa7ff,
    accentColor: 0xffd36a
  })),

  template(840, 'Elite Guard', 'Elite', stats({
    weaponType: 'laser-5',
    weaponTier: 'WEAPON_5',
    armorTier: 'ARMOR_4',
    speedTier: 'SPEED_4',
    sensorRange: 620,
    possessionResistance: 128,
    clearanceLevel: 4,
    aiProfile: 'guard',
    fillColor: 0x2b2136,
    strokeColor: 0xc18cff,
    accentColor: 0xffffff
  })),
  template(880, 'Command Hunter', 'Elite', stats({
    weaponType: 'laser-5',
    weaponTier: 'WEAPON_5',
    armorTier: 'ARMOR_4',
    speedTier: 'SPEED_4',
    sensorRange: 640,
    possessionResistance: 136,
    clearanceLevel: 4,
    aiProfile: 'hunter',
    fillColor: 0x321522,
    strokeColor: 0xff4fd8,
    accentColor: 0xffffff
  })),
  template(895, 'Dominion Unit', 'Elite', stats({
    weaponType: 'laser-5',
    weaponTier: 'WEAPON_5',
    armorTier: 'ARMOR_5',
    speedTier: 'SPEED_4',
    sensorRange: 660,
    possessionResistance: 142,
    clearanceLevel: 4,
    aiProfile: 'hunter',
    fillColor: 0x291432,
    strokeColor: 0xc18cff,
    accentColor: 0xff4fd8
  })),

  template(910, 'Core Sentinel', 'Core', stats({
    weaponType: 'laser-5-plus',
    weaponTier: 'WEAPON_5_PLUS',
    armorTier: 'ARMOR_5',
    speedTier: 'SPEED_4',
    sensorRange: 700,
    possessionResistance: 154,
    clearanceLevel: 5,
    aiProfile: 'guard',
    fillColor: 0x112b34,
    strokeColor: 0x4fc3ff,
    accentColor: 0xf4e9ff
  })),
  template(950, 'Autonomous Nexus', 'Core', stats({
    weaponType: 'laser-5-plus',
    weaponTier: 'WEAPON_5_PLUS',
    armorTier: 'ARMOR_5',
    speedTier: 'SPEED_5',
    sensorRange: 720,
    possessionResistance: 166,
    clearanceLevel: 5,
    aiProfile: 'hunter',
    fillColor: 0x1c1838,
    strokeColor: 0x8fa7ff,
    accentColor: 0xff4fd8
  })),
  template(999, 'Plasmodyne Core', 'Core', stats({
    weaponType: 'laser-5-plus',
    weaponTier: 'WEAPON_5_PLUS',
    armorTier: 'ARMOR_5',
    speedTier: 'SPEED_5',
    sensorRange: 760,
    possessionResistance: 180,
    clearanceLevel: 5,
    aiProfile: 'hunter',
    fillColor: 0x321522,
    strokeColor: 0xffffff,
    accentColor: 0xff2f64,
    specialTags: ['apex']
  }))
];

export function getDroidModelVariantIndex(templateItem, templates = DROID_TEMPLATES) {
  const rank = Number(templateItem?.rank ?? templateItem);
  const series = Math.max(0, Math.floor(rank / 100));
  const seriesTemplates = templates
    .filter((item) => Math.max(0, Math.floor(item.rank / 100)) === series)
    .sort((a, b) => a.rank - b.rank);
  return Math.max(0, seriesTemplates.findIndex((item) => item.rank === rank));
}

export function getDroidModelTint(templateItem, templates = DROID_TEMPLATES) {
  const index = getDroidModelVariantIndex(templateItem, templates);
  return DROID_MODEL_TINTS[index % DROID_MODEL_TINTS.length] ?? DROID_MODEL_TINTS[0];
}

export function getTemplatesForDeck(deckId) {
  const ranges = {
    1: [45, 230],
    2: [88, 330],
    3: [120, 475],
    4: [210, 590],
    5: [302, 690],
    6: [410, 790],
    7: [520, 840],
    8: [620, 910],
    9: [735, 950],
    10: [840, 999]
  };
  const [min, max] = ranges[deckId] ?? ranges[1];
  return DROID_TEMPLATES.filter((item) => item.rank >= min && item.rank <= max);
}
