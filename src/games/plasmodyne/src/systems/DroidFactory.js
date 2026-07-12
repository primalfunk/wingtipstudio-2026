import { DIFFICULTY_LEVELS, DROID_GENERATION } from '../data/constants.js';
import { getTemplatesForDeck, DROID_TEMPLATES } from '../data/droidTemplates.js';
import {
  DROID_BEHAVIOR_PROFILES,
  canTemplateUseRepairPads,
  getBehaviorProfileForTemplate
} from './ai/DroidBehaviorProfiles.js';
import { SeededRandom } from '../utils/seededRandom.js';

export class DroidFactory {
  populateShip(ship, options = {}) {
    const random = new SeededRandom(`${ship.seed}:droids`);
    const difficulty = this.getDifficulty(options.difficulty);
    ship.difficulty = difficulty.key;
    const totalTarget = random.integer(difficulty.droidTotalMin, difficulty.droidTotalMax);
    const weights = this.createDeckWeights(ship.decks.length);
    let remaining = totalTarget;

    for (let i = 0; i < ship.decks.length; i += 1) {
      const deck = ship.decks[i];
      const target = i === ship.decks.length - 1 ? remaining : Math.max(difficulty.minPerDeck, Math.round(totalTarget * weights[i]));
      deck.droids = this.populateDeck(deck, target, random);
      remaining -= deck.droids.length;
    }

    this.ensureCoreWarden(ship, random);
    this.captureOriginalAssignments(ship);
    this.updateCounts(ship);
  }

  getDifficulty(key = 'normal') {
    const normalized = String(key ?? 'normal').toLowerCase();
    const config = DIFFICULTY_LEVELS[normalized] ?? DIFFICULTY_LEVELS.normal;
    return { key: DIFFICULTY_LEVELS[normalized] ? normalized : 'normal', ...config };
  }

  captureOriginalAssignments(ship) {
    for (const deck of ship.decks) {
      deck.originalDroidAssignments = deck.droids.map((droid) => this.cloneDroidAssignment(droid));
      deck.resetCount = deck.resetCount ?? 0;
    }
  }

  cloneDroidAssignment(droid) {
    const aiProfile = droid.aiProfile ?? getBehaviorProfileForTemplate(droid.template);
    return {
      ...droid,
      currentIntegrity: droid.template.maxIntegrity,
      state: aiProfile === DROID_BEHAVIOR_PROFILES.GUARD ? 'guard' : 'patrol',
      aiProfile,
      homeRoomId: droid.homeRoomId ?? droid.roomId,
      currentRoomId: droid.homeRoomId ?? droid.roomId,
      canUseDoors: true,
      canUseElevators: false,
      canUseRepairPads: droid.canUseRepairPads ?? canTemplateUseRepairPads(droid.template),
      neutralized: false,
      detectionMemory: 0,
      isAggro: false,
      lastSeenPlayerTime: 0
    };
  }

  createDeckWeights(deckCount) {
    const weights = [];
    let total = 0;
    for (let i = 0; i < deckCount; i += 1) {
      const centerBias = 1 - Math.abs((i / Math.max(1, deckCount - 1)) - 0.5) * 0.35;
      const commandBias = 1 + i * 0.08;
      const weight = centerBias * commandBias;
      weights.push(weight);
      total += weight;
    }
    return weights.map((weight) => weight / total);
  }

  populateDeck(deck, target, random) {
    const droids = [];
    const roomScores = deck.rooms
      .filter((room) => !(deck.id === DROID_GENERATION.startRoomExclusionDeckId && room.id === deck.startRoomId))
      .map((room) => ({ room, capacity: this.roomCapacity(room) }))
      .filter((entry) => entry.capacity > 0);

    let droidIndex = 1;
    let safety = 0;
    while (droids.length < target && safety < target * 12) {
      safety += 1;
      const roomEntry = this.pickRoomEntry(roomScores, random);
      if (!roomEntry || droids.filter((droid) => droid.roomId === roomEntry.room.id).length >= roomEntry.capacity) {
        continue;
      }

      const template = this.pickTemplate(deck, roomEntry.room, random);
      const point = this.pickSpawnPoint(roomEntry.room, droids, random, deck);
      if (!point) {
        continue;
      }
      const aiProfile = getBehaviorProfileForTemplate(template);

      droids.push({
        id: `droid-${deck.id}-${droidIndex}`,
        template,
        rank: template.rank,
        displayId: template.displayId,
        currentIntegrity: template.maxIntegrity,
        deckId: deck.id,
        roomId: roomEntry.room.id,
        homeRoomId: roomEntry.room.id,
        currentRoomId: roomEntry.room.id,
        x: point.x,
        y: point.y,
        state: aiProfile === DROID_BEHAVIOR_PROFILES.GUARD ? 'guard' : 'patrol',
        aiProfile,
        canUseDoors: true,
        canUseElevators: false,
        canUseRepairPads: canTemplateUseRepairPads(template),
        neutralized: false,
        detectionMemory: 0
      });
      droidIndex += 1;
    }

    return droids;
  }

  roomCapacity(room) {
    return Math.max(1, Math.min(6, Math.floor((room.width * room.height) / 145000)));
  }

  pickRoomEntry(entries, random) {
    const total = entries.reduce((sum, entry) => sum + entry.capacity, 0);
    let roll = random.next() * total;
    for (const entry of entries) {
      roll -= entry.capacity;
      if (roll <= 0) {
        return entry;
      }
    }
    return entries[entries.length - 1] ?? null;
  }

  pickTemplate(deck, room, random) {
    let templates = getTemplatesForDeck(deck.id);
    if (room.type === 'security') {
      templates = templates.filter((template) => template.rank >= 410) ?? templates;
    } else if (room.type === 'command' || room.type === 'data-core') {
      templates = templates.filter((template) => template.rank >= 475) ?? templates;
    } else if (room.type === 'cargo') {
      templates = templates.filter((template) => template.rank >= 230 && template.rank <= 690) ?? templates;
    } else if (room.type === 'maintenance' || room.type === 'utility') {
      templates = templates.filter((template) => template.rank <= 410) ?? templates;
    }

    if (templates.length === 0) {
      templates = getTemplatesForDeck(deck.id);
    }

    const sorted = [...templates].sort((a, b) => a.rank - b.rank);
    const bias = random.next() ** 1.8;
    const index = Math.min(sorted.length - 1, Math.floor(bias * sorted.length));
    return sorted[index];
  }

  pickSpawnPoint(room, existingDroids, random, deck = null) {
    const padding = DROID_GENERATION.roomEdgePadding;
    const roomDroids = existingDroids.filter((droid) => droid.roomId === room.id);

    for (let attempt = 0; attempt < DROID_GENERATION.maxRoomSpawnAttempts; attempt += 1) {
      const x = random.integer(Math.ceil(room.x + padding), Math.floor(room.x + room.width - padding));
      const y = random.integer(Math.ceil(room.y + padding), Math.floor(room.y + room.height - padding));
      if (deck?.tileMap && !this.isSpawnTileClear(deck, x, y)) {
        continue;
      }
      const blocked = roomDroids.some((droid) => Math.hypot(droid.x - x, droid.y - y) < DROID_GENERATION.spawnSpacing);
      if (!blocked) {
        return { x, y };
      }
    }

    return null;
  }

  isSpawnTileClear(deck, x, y) {
    const tileSize = deck.tileMap.tileSize;
    const tile = deck.tileMap.tiles[Math.floor(y / tileSize)]?.[Math.floor(x / tileSize)];
    return tile?.tileType === 'room-floor';
  }

  ensureCoreWarden(ship, random) {
    const commandDeck = ship.decks[ship.decks.length - 1];
    if (!commandDeck || commandDeck.droids.some((droid) => droid.rank === 999)) {
      return;
    }

    const template = DROID_TEMPLATES.find((item) => item.rank === 999);
    const room = commandDeck.rooms.find((item) => item.type === 'reactor' || item.type === 'data-core') ?? commandDeck.rooms[commandDeck.rooms.length - 1];
    const point = this.pickSpawnPoint(room, commandDeck.droids, random, commandDeck) ?? { x: room.centerX, y: room.centerY };
    commandDeck.droids.push({
      id: `droid-${commandDeck.id}-core`,
      template,
      rank: template.rank,
      displayId: template.displayId,
      currentIntegrity: template.maxIntegrity,
      deckId: commandDeck.id,
      roomId: room.id,
      homeRoomId: room.id,
      currentRoomId: room.id,
      x: point.x,
      y: point.y,
      state: 'guard',
      aiProfile: getBehaviorProfileForTemplate(template),
      canUseDoors: true,
      canUseElevators: false,
      canUseRepairPads: canTemplateUseRepairPads(template),
      neutralized: false,
      detectionMemory: 0
    });
  }

  updateCounts(ship) {
    ship.totalDroids = ship.decks.reduce((sum, deck) => sum + deck.droids.filter((droid) => !droid.neutralized).length, 0);
    ship.neutralizedDroids = ship.decks.reduce((sum, deck) => sum + deck.droids.filter((droid) => droid.neutralized).length, 0);
  }
}
