import { ROOM_SOUND_DESCRIPTIONS } from "./roomSounds.js";
import { getItemVariant, initializeItemVariants } from "./items.js";

let roomTemplates = null;
let outerTemplates = null;
let rooms = {};
let currentMapSeed = null;
let initialized = false;
let adventureAnchors = {};

const directions = ["north", "south", "east", "west"];
const oppositeDirection = {
  north: "south",
  south: "north",
  east: "west",
  west: "east"
};

function hashSeed(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seed) {
  let state = hashSeed(seed) || 1;
  return function random() {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createMapSeed() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `seed-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function shuffleArray(array, rng) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function choose(array, rng) {
  return array[Math.floor(rng() * array.length)];
}

function chooseUnused(candidates, used, rng) {
  const available = candidates.filter(candidate => !used.has(candidate));
  if (available.length === 0) return null;
  const selected = choose(available, rng);
  used.add(selected);
  return selected;
}

function cloneArray(value) {
  return Array.isArray(value) ? [...value] : [];
}

function cloneObject(value) {
  return value && typeof value === "object" ? structuredClone(value) : value;
}

function getRandomRoomData(roomType, rng, templateType = "core", specificRoom = null) {
  const templates = templateType === "outer" ? outerTemplates : roomTemplates;
  let template;

  if (templateType === "outer") {
    if (specificRoom && templates[roomType] && templates[roomType][specificRoom]) {
      template = templates[roomType][specificRoom];
    } else {
      throw new Error(`Missing or malformed template for room type "${roomType}" or specific room "${specificRoom}" in outer templates.`);
    }
  } else {
    template = templates[roomType];
  }

  const roomData = {
    id: null,
    title: choose(template.titles, rng),
    description: choose(template.descriptions, rng),
    npcs: cloneArray(template.npcs),
    items: cloneArray(template.items),
    exits: {},
    tags: cloneArray(template.tags),
    difficulty: template.difficulty || 0,
    requires: cloneObject(template.requires),
    grantsFlag: template.grantsFlag || null,
    secrets: cloneArray(template.secrets),
    encounterTable: cloneArray(template.encounterTable),
    lockedExit: cloneObject(template.lockedExit),
    hazard: cloneObject(template.hazard),
    onEnterMessage: template.onEnterMessage || null,
    soundDescription: template.soundDescription || null,
    actions: cloneArray(template.actions)
  };
  if (templateType === "outer") {
    roomData.sourceZone = roomType;
    roomData.sourceRoom = specificRoom;
    roomData.tags = [...new Set([...roomData.tags, roomType, specificRoom].filter(Boolean))];
  } else {
    roomData.sourceZone = "core";
    roomData.sourceRoom = roomType;
    roomData.tags = [...new Set([...roomData.tags, roomType].filter(Boolean))];
  }
  return roomData;
}

function getAdjacentPositions(position) {
  if (!position || typeof position !== "string") {
    throw new Error(`Invalid position: ${position}`);
  }

  const [x, y] = position.split(",").map(Number);
  return {
    north: `${x},${y - 1}`,
    south: `${x},${y + 1}`,
    east: `${x + 1},${y}`,
    west: `${x - 1},${y}`
  };
}

function placeCoreRoomsOnGrid(rng) {
  const grid = {};
  const positions = ["0,0", "0,1", "0,2", "1,0", "1,1", "1,2", "2,1"];
  const shuffledPositions = shuffleArray(positions, rng);
  const roomKeys = ["chapel", "garden", "alley", "library", "gym", "church", "outpost"];
  const placedRooms = {};

  roomKeys.forEach((roomKey, index) => {
    const position = shuffledPositions[index];
    const roomId = `room${index + 1}`;
    grid[position] = roomId;
    placedRooms[roomId] = getRandomRoomData(roomKey, rng);
    placedRooms[roomId].id = roomId;
  });

  return { rooms: placedRooms, grid };
}

function placeOuterRoomsOnGrid(grid, existingRooms, rng) {
  const outerRoomZones = ["forest", "castle", "temple", "swamp", "mountain", "plain"];
  const zoneClusters = {
    forest: 8,
    castle: 10,
    temple: 9,
    swamp: 12,
    mountain: 11,
    plain: 9
  };
  const placedRooms = existingRooms;
  let roomCounter = Object.keys(placedRooms).length + 1;

  outerRoomZones.forEach(zoneType => {
    const clusterSize = zoneClusters[zoneType];
    let clusterPosition = getClusterStartingPosition(grid, rng);

    if (!clusterPosition) {
      return;
    }

    for (let i = 0; i < clusterSize; i++) {
      const newRoomKey = `outerRoom${roomCounter}`;
      grid[clusterPosition] = newRoomKey;
      const specificRoom = getRandomSpecificRoomForZone(zoneType, rng);
      placedRooms[newRoomKey] = getRandomRoomData(zoneType, rng, "outer", specificRoom);
      placedRooms[newRoomKey].id = newRoomKey;

      clusterPosition = getNextClusterPosition(clusterPosition, grid, rng);
      roomCounter++;
      if (!clusterPosition) {
        break;
      }
    }
  });

  return { rooms: placedRooms, grid };
}

function getClusterStartingPosition(grid, rng) {
  const outerPositions = [
    "-4,-3", "-4,-2", "-4,-1", "-4,0", "-4,1", "-4,2", "-4,3", "-4,4",
    "-3,-3", "-3,3", "-3,4",
    "-2,-3", "-2,4",
    "-1,4", "0,4", "1,4", "2,4", "3,3", "3,4"
  ];
  const availablePositions = outerPositions.filter(pos => !grid[pos]);

  if (availablePositions.length === 0) {
    return null;
  }

  return choose(availablePositions, rng);
}

function getNextClusterPosition(currentPosition, grid, rng) {
  const adjPositions = getAdjacentPositions(currentPosition);
  const availablePositions = Object.values(adjPositions).filter(pos => !grid[pos]);

  if (availablePositions.length === 0) {
    return getClusterStartingPosition(grid, rng);
  }

  return choose(availablePositions, rng);
}

function getRandomSpecificRoomForZone(zoneType, rng) {
  const specificRooms = {
    forest: ["glen", "vale"],
    castle: ["portcullis", "throne_room"],
    temple: ["altar", "sanctum"],
    swamp: ["bog", "marsh"],
    mountain: ["peak", "cave"],
    plain: ["meadow", "hill"]
  };
  return choose(specificRooms[zoneType], rng);
}

function generateRoomExits(placedRooms, grid) {
  Object.keys(grid).forEach(position => {
    const roomKey = grid[position];
    const adjPositions = getAdjacentPositions(position);

    Object.keys(adjPositions).forEach(direction => {
      const adjPosition = adjPositions[direction];
      const adjRoomKey = grid[adjPosition];
      if (adjRoomKey) {
        placedRooms[roomKey].exits[direction] = adjRoomKey;
        placedRooms[adjRoomKey].exits[oppositeDirection[direction]] = roomKey;
      }
    });
  });
}

function makeRoom(id, data) {
  return {
    id,
    npcs: [],
    items: [],
    exits: {},
    tags: [],
    difficulty: 0,
    secrets: [],
    encounterTable: [],
    actions: [],
    ...data
  };
}

function findFirstRoomByZone(placedRooms, zone, fallbackId = "room1") {
  return Object.values(placedRooms).find(room => room.sourceZone === zone)?.id || fallbackId;
}

function addUnique(array, value) {
  if (!array.includes(value)) array.push(value);
}

function injectSealedReliquarySlice(placedRooms) {
  const keyVariant = getItemVariant("reliquary_key");
  const startRoom = placedRooms.room1;
  startRoom.tags = [...new Set([...(startRoom.tags || []), "reliquary_rumor"])];
  startRoom.onEnterMessage = `A cracked pilgrim marker mentions the Sealed Reliquary beyond the old threshold. It says the ${keyVariant.rumorName || "Reliquary Key"} was hidden in the garden.`;

  if (placedRooms.room2 && !placedRooms.room2.items.includes("reliquary_key")) {
    placedRooms.room2.items.push("reliquary_key");
    placedRooms.room2.tags = [...new Set([...(placedRooms.room2.tags || []), "reliquary_key_site"])];
    placedRooms.room2.onEnterMessage = "Something cold glints beneath a neglected stone basin.";
  }

  if (placedRooms.room4 && !placedRooms.room4.npcs.includes("npc6")) {
    placedRooms.room4.npcs.push("npc6");
    placedRooms.room4.tags = [...new Set([...(placedRooms.room4.tags || []), "reliquary_trainer"])];
  }

  placedRooms.reliquary_threshold = makeRoom("reliquary_threshold", {
    title: "Cursed Threshold",
    description: "A narrow stair descends beneath old stone. Ash gathers in the grooves of the floor, though no fire burns nearby.",
    exits: {
      west: "room1",
      east: "sealed_reliquary"
    },
    tags: ["reliquary_path"],
    difficulty: 1,
    requires: { item: "reliquary_key" },
    hazard: {
      id: "ash_threshold",
      tags: ["forced_route", "reliquary", "sacred", "ash", "cursed"],
      damage: 5,
      onceFlag: "ash_threshold_survived",
      message: "Ash rises from the threshold and burns through your lungs.",
      avoidedMessage: "The ash stirs, then settles before your training."
    }
  });

  placedRooms.sealed_reliquary = makeRoom("sealed_reliquary", {
    title: "The Sealed Reliquary",
    description: "The chamber is small, airless, and blackened by an ancient fire. A cracked plinth waits in the center.",
    exits: {
      west: "reliquary_threshold"
    },
    tags: ["reliquary"],
    items: ["ash_crown_relic"],
    grantsFlag: "reliquary_opened",
    onEnterMessage: "The reliquary seal breaks with a dry, final sound."
  });

  startRoom.exits.reliquary = "reliquary_threshold";
}

function injectAshCrownCurseAdventure(placedRooms) {
  const bloodVariant = getItemVariant("bloodmoss_clump");
  const oathVariant = getItemVariant("oath_silver");
  const cinderVariant = getItemVariant("cinder_ember");
  const anchors = {
    curse_archive: findFirstRoomByZone(placedRooms, "temple"),
    bloodmoss_mire: findFirstRoomByZone(placedRooms, "swamp"),
    oath_gatehouse: findFirstRoomByZone(placedRooms, "castle"),
    cinder_peak: findFirstRoomByZone(placedRooms, "mountain"),
    final_seal: "room1"
  };

  const archive = placedRooms[anchors.curse_archive];
  archive.title = "Archive of Cindered Names";
  archive.description = "Scorched tablets line the walls. Every name carved here seems to have been erased by heat, then written again in ash.";
  archive.tags = [...new Set([...(archive.tags || []), "adventure_anchor", "curse_archive"])];
  archive.actions = [
    {
      id: "study_ash_crown",
      label: "Study the Ash-Crown",
      requires: { item: "ash_crown_relic" },
      grantsFlag: "ash_crown_identified",
      once: true,
      successMessage: `The tablets name the relic as a crown of remembrance. It will bind itself to a living bearer unless sealed with ${bloodVariant.name || "Bloodmoss Clump"}, ${oathVariant.name || "Oath-Silver Ring"}, and ${cinderVariant.name || "Cinder Ember"}.`,
      repeatMessage: "The archive has already yielded the crown's true name."
    }
  ];

  const mire = placedRooms[anchors.bloodmoss_mire];
  mire.title = bloodVariant.siteTitle || "Mire of Bloodmoss";
  mire.description = bloodVariant.siteDescription || "Red moss crawls over drowned stones. The air is sweet, wet, and wrong.";
  mire.tags = [...new Set([...(mire.tags || []), "adventure_anchor", "bloodmoss_site"])];
  addUnique(mire.items, "bloodmoss_clump");
  mire.hazard = {
    id: "bloodmoss_fumes",
    tags: ["forced_route", "wilderness", "swamp", "organic", "cursed", "bloodmoss", "grasping", "snare"],
    damage: 4,
    onceFlag: "bloodmoss_fumes_survived",
    message: "The mire exhales a red vapor that leaves your chest tight and burning.",
    avoidedMessage: "Your fieldcraft keeps you above the worst of the red vapor."
  };

  const gatehouse = placedRooms[anchors.oath_gatehouse];
  gatehouse.title = oathVariant.siteTitle || "Oath-Silver Gatehouse";
  gatehouse.description = oathVariant.siteDescription || "A ruined gatehouse stands under a torn banner. Silver oath-rings hang from hooks where soldiers once swore themselves to dead kings.";
  gatehouse.tags = [...new Set([...(gatehouse.tags || []), "adventure_anchor", "oath_silver_site"])];
  addUnique(gatehouse.items, "oath_silver");
  delete gatehouse.hazard;
  gatehouse.actions = [
    ...(gatehouse.actions || []),
    {
      id: "inspect_oath_silver",
      label: oathVariant.inspectLabel || "Inspect the Oath-Silver",
      grantsFlag: oathVariant.inspectedFlag || "oath_silver_inspected",
      once: true,
      successMessage: oathVariant.inspectMessage || "You study the oath-rings before touching them. The old vows pull tight when disturbed, but the worst tension can be avoided.",
      hazardTags: ["sacred", "relic", "suspicious_object"],
      effect: { message: oathVariant.inspectEffectMessage || "You mark the ring least bound to the dead king's command." },
      classEffects: {
        Rogue: { message: "You spot the trapped ring by its cleaner shadow." },
        Mage: { message: "The relic's binding pattern becomes legible." },
        Cleric: { message: "The old oath resolves into a rite you can handle carefully." }
      }
    }
  ];

  const peak = placedRooms[anchors.cinder_peak];
  peak.title = cinderVariant.siteTitle || "Cinder-Glass Peak";
  peak.description = cinderVariant.siteDescription || "Black glass cuts through the mountain path. A coal-bright ember pulses inside a stone split by old lightning.";
  peak.tags = [...new Set([...(peak.tags || []), "adventure_anchor", "cinder_ember_site"])];
  addUnique(peak.items, "cinder_ember");
  delete peak.hazard;
  peak.actions = [
    ...(peak.actions || []),
    {
      id: "inspect_cinder_ember",
      label: cinderVariant.inspectLabel || "Inspect the Cinder Ember",
      grantsFlag: cinderVariant.inspectedFlag || "cinder_ember_inspected",
      once: true,
      successMessage: cinderVariant.inspectMessage || "You study the glass around the ember and find the places where it wants to cut.",
      hazardTags: ["fire", "arcane", "relic", "dangerous_pickup"],
      effect: { message: cinderVariant.inspectEffectMessage || "The ember can be pried free, but not safely by force alone." },
      classEffects: {
        Rogue: { message: "You find a narrow grip between the glass teeth." },
        Mage: { message: "The ember's heat follows a pattern you can briefly interrupt." },
        Cleric: { message: "Ash clings to the ember like a failed blessing." }
      }
    }
  ];

  const finalRoom = placedRooms[anchors.final_seal];
  finalRoom.tags = [...new Set([...(finalRoom.tags || []), "adventure_anchor", "final_seal"])];
  finalRoom.actions = [
    ...(finalRoom.actions || []),
    {
      id: "seal_ash_crown",
      label: "Seal the Ash-Crown",
      requires: {
        item: "ash_crown_relic",
        allItems: ["bloodmoss_clump", "oath_silver", "cinder_ember"],
        allFlags: ["ash_crown_identified"]
      },
      grantsFlag: "victory_sealed_relic",
      once: true,
      terminal: "victory",
      successMessage: `${bloodVariant.sealPhrase || "Bloodmoss darkens"}, ${oathVariant.sealPhrase || "oath-silver rings"}, and ${cinderVariant.sealPhrase || "the ember dies white"}. The Ash-Crown forgets the dead empire at last.`,
      repeatMessage: "The Ash-Crown has already been sealed."
    }
  ];

  adventureAnchors = anchors;
}

function makeEventAction(zone, roomId, index, data) {
  const eventId = `${zone}_${roomId}_${index}`;
  return {
    once: true,
    grantsFlag: `event_${eventId}`,
    tags: ["living_map_event", zone],
    ...data,
    id: data.id || eventId
  };
}

const zoneEventTemplates = {
  forest: [
    {
      label: "Scout the Trail",
      successMessage: "You read bent grass, snapped twigs, and old footprints in the loam.",
      effect: { message: "The route ahead feels less hostile now." },
      hazardTags: ["wilderness", "search"],
      classEffects: {
        Ranger: { message: "Your ranger's eye turns the forest into a readable map." }
      }
    },
    {
      label: "Search the Hollow",
      successMessage: "You search the hollow beneath the roots.",
      effect: { damage: 1, message: "Thorns bite into your wrist before you pull free." },
      hazardTags: ["search", "trap", "minor"],
      classEffects: {
        Rogue: { message: "You slip your hand through the thorns without a scratch." }
      }
    }
  ],
  castle: [
    {
      label: "Inspect the Armory",
      successMessage: "Rusty blades and cracked shields lie in ordered rows.",
      effect: { damage: 2, message: "A brittle weapon rack collapses across your shoulder." },
      hazardTags: ["physical", "collapse", "impact"],
      classEffects: {
        Warrior: { message: "You brace the rack before it falls and salvage the room's lesson." }
      }
    },
    {
      label: "Read the Old Oath",
      successMessage: "The oath still carries weight, though the kingdom is long dead.",
      effect: { message: "A cold respect settles over the hall." },
      hazardTags: ["sacred", "fear"],
      classEffects: {
        Cleric: { message: "You hear the grief beneath the oath and answer it with a blessing." }
      }
    }
  ],
  temple: [
    {
      label: "Inspect the Sigils",
      successMessage: "The sigils describe bindings, names, and memory worn into stone.",
      effect: { message: "A fragment of ritual logic becomes clear." },
      hazardTags: ["arcane", "rune"],
      classEffects: {
        Mage: { message: "The sigils align in your mind as a complete sentence of power." }
      }
    },
    {
      label: "Offer a Prayer",
      successMessage: "The prayer is swallowed by old stone, then returned as warmth.",
      effect: { heal: 3, message: "A little strength returns to you." },
      hazardTags: ["sacred"],
      classEffects: {
        Cleric: { heal: 5, message: "The old shrine answers your practiced rite." }
      }
    }
  ],
  swamp: [
    {
      label: "Probe the Mire",
      successMessage: "The mud gives way in slow, hungry folds.",
      effect: { damage: 2, message: "Your leg sinks deep before you wrench it free." },
      hazardTags: ["swamp", "wilderness"],
      classEffects: {
        Ranger: { message: "You find the firm patches by instinct and stay clean of the worst mud." }
      }
    },
    {
      label: "Listen to the Reeds",
      successMessage: "The reeds hiss with breath that is not wind.",
      effect: { damage: 1, message: "A sour vapor catches in your throat." },
      hazardTags: ["swamp", "beast"],
      classEffects: {
        Mage: { message: "You hear the pattern in the reed-song and avoid the poisoned breath." }
      }
    }
  ],
  mountain: [
    {
      label: "Climb the Glass Path",
      successMessage: "The path gives a view of broken country and black stone.",
      effect: { damage: 2, message: "Loose glass cuts through your palm." },
      hazardTags: ["mountain", "mountain_glass", "physical"],
      classEffects: {
        Warrior: { damage: 1, message: "You take the cut and keep your footing." }
      }
    },
    {
      label: "Study the Wind",
      successMessage: "The wind moves through the peak like breath through teeth.",
      effect: { message: "You learn where the mountain wants travelers to fall." },
      hazardTags: ["mountain", "weather"],
      classEffects: {
        Ranger: { message: "The wind gives away a safer line along the ridge." }
      }
    }
  ],
  plain: [
    {
      label: "Survey the Horizon",
      successMessage: "The open land offers no cover, but many ways forward.",
      effect: { message: "You fix a few distant landmarks in memory." },
      hazardTags: ["wilderness", "weather"],
      classEffects: {
        Ranger: { message: "The horizon resolves into usable bearings." }
      }
    },
    {
      label: "Rest in the Grass",
      successMessage: "You take a short rest under the wide sky.",
      effect: { heal: 2, message: "Your breathing steadies." },
      hazardTags: ["wilderness", "minor"],
      classEffects: {
        Cleric: { heal: 4, message: "You turn the rest into a small rite of recovery." }
      }
    }
  ]
};

function injectLivingMapEvents(placedRooms) {
  Object.entries(zoneEventTemplates).forEach(([zone, templates]) => {
    const zoneRooms = Object.values(placedRooms)
      .filter(room => room.sourceZone === zone && !(room.tags || []).includes("adventure_anchor"))
      .slice(0, templates.length);

    zoneRooms.forEach((room, index) => {
      room.actions = [
        ...(room.actions || []),
        makeEventAction(zone, room.id, index + 1, templates[index])
      ];
      room.tags = [...new Set([...(room.tags || []), "living_map_event"])];
    });
  });
}

function assignSoundDescriptions(placedRooms, rng) {
  const used = new Set();
  Object.values(placedRooms)
    .filter(room => room.id && !room.id.startsWith("__"))
    .forEach((room, index) => {
      if (index % 2 !== 0 || room.soundDescription) return;
      const zone = room.tags?.includes("reliquary") ? "reliquary" : room.sourceZone;
      const candidates = [
        ...(ROOM_SOUND_DESCRIPTIONS[zone] || []),
        ...(ROOM_SOUND_DESCRIPTIONS.generic || [])
      ];
      const soundDescription = chooseUnused(candidates, used, rng);
      if (soundDescription) {
        room.soundDescription = soundDescription;
      }
    });
}

function collectReachable(placedRooms, startRoomId, visited = new Set()) {
  const queue = [startRoomId];
  visited.add(startRoomId);

  while (queue.length) {
    const roomId = queue.shift();
    Object.values(placedRooms[roomId].exits).forEach(nextRoomId => {
      if (placedRooms[nextRoomId] && !visited.has(nextRoomId)) {
        visited.add(nextRoomId);
        queue.push(nextRoomId);
      }
    });
  }

  return visited;
}

function ensureConnectedMap(placedRooms) {
  const startRoomId = "room1";
  let visited = collectReachable(placedRooms, startRoomId);
  let trailCount = 1;

  Object.keys(placedRooms).forEach(roomId => {
    if (visited.has(roomId)) return;

    const outDirection = `trail${trailCount}`;
    const backDirection = `return${trailCount}`;
    placedRooms[startRoomId].exits[outDirection] = roomId;
    placedRooms[roomId].exits[backDirection] = startRoomId;
    trailCount++;
    visited = collectReachable(placedRooms, startRoomId, visited);
  });
}

async function loadTemplates(options) {
  if (options.roomTemplates && options.outerTemplates) {
    roomTemplates = options.roomTemplates;
    outerTemplates = options.outerTemplates;
    return;
  }

  const [coreResponse, outerResponse] = await Promise.all([
    fetch("./roomTemplates.json"),
    fetch("./outerTemplates.json")
  ]);
  roomTemplates = await coreResponse.json();
  outerTemplates = await outerResponse.json();
}

export async function initializeMap(options = {}) {
  const { force = false } = options;
  if (initialized && !force) {
    throw new Error("Map is already initialized. Pass { force: true } to intentionally reset it.");
  }

  currentMapSeed = options.seed || createMapSeed();
  const rng = createRng(currentMapSeed);
  initializeItemVariants(createRng(`${currentMapSeed}:items`));
  await loadTemplates(options);

  const { rooms: coreRooms, grid: coreGrid } = placeCoreRoomsOnGrid(rng);
  const { rooms: fullMapRooms, grid: fullGrid } = placeOuterRoomsOnGrid(coreGrid, coreRooms, rng);
  generateRoomExits(fullMapRooms, fullGrid);
  injectSealedReliquarySlice(fullMapRooms);
  injectAshCrownCurseAdventure(fullMapRooms);
  injectLivingMapEvents(fullMapRooms);
  assignSoundDescriptions(fullMapRooms, rng);
  ensureConnectedMap(fullMapRooms);

  rooms = fullMapRooms;
  initialized = true;
  return rooms;
}

export function getRoom(roomId) {
  return rooms[roomId];
}

export function getRooms() {
  return rooms;
}

export function getCurrentMapSeed() {
  return currentMapSeed;
}

export function getAdventureAnchors() {
  return { ...adventureAnchors };
}
