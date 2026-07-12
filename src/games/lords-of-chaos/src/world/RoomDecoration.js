import { choice } from "../core/random.js";

const URBAN = new Set(["clockwork_city", "coastal_town", "farming_village", "suburban_neighborhood", "downtown_city", "haunted_mansion", "cyberpunk_city", "steampunk_metropolis", "pirate_haven", "abandoned_city", "treetop_village", "frostbound_village"]);
const OUTDOOR = new Set(["fiery_chasm", "nomadic_steppe", "frozen_wasteland", "volcanic_valley", "cursed_woods", "mirage_oasis", "labyrinth_gardens", "pine_forest", "dense_jungle", "quiet_lake", "grassy_plains", "mountain_campsite", "forest"]);
const MAGICAL = new Set(["enchanted_forest", "crystal_caves", "mushroom_kingdom", "enchanted_valley", "crystal_canyon", "wizards_academy", "dwarven_kingdom", "ancient_temple", "magical_menagerie"]);

export class RoomDecoration {
  constructor(gameMap, data) {
    this.map = gameMap;
    this.data = data;
    this.adjectives = data.adjectives.things;
  }

  decorateRooms() {
    for (const room of this.map.rooms.values()) {
      if (room.decorations.length || Math.random() >= 0.33) continue;
      const decoration = this.selectDecoration(this.determineRoomType(room.region));
      if (decoration) room.decorations.push(`${choice(this.adjectives)} ${decoration}`);
    }
  }

  determineRoomType(region) {
    if (URBAN.has(region)) return "urban";
    if (OUTDOOR.has(region)) return "outdoor";
    if (MAGICAL.has(region)) return "magical";
    return "any";
  }

  selectDecoration(roomType) {
    if (Math.random() >= 0.13) return choice(this.data.objects.daily_life_items);
    if (roomType === "urban") return choice(this.data.objects.furniture);
    if (roomType === "outdoor") return choice([...this.data.objects.wildlife, ...this.data.objects.natural_elements]);
    if (roomType === "magical") return choice(this.data.objects.mystic_items);
    return choice(this.data.objects.daily_life_items);
  }
}
