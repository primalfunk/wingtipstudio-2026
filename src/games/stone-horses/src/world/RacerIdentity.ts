import { createSeededRng } from "../utils/seededRng";

export interface RacerIdentity {
  id: string;
  name: string;
  previewUrl: string;
}

const racerNames = [
  "Aurora Dash",
  "Brass Comet",
  "Cinder Belle",
  "Copper Rocket",
  "Crimson Skip",
  "Disco Pebble",
  "Echo Flash",
  "Fable Twist",
  "Glitter Jack",
  "Harbor Bolt",
  "Indigo Ace",
  "Jasper Pop",
  "Kilo Spark",
  "Lemon Drift",
  "Mango Riot",
  "Nimbus Fox",
  "Opal Zoom",
  "Pepper Flick",
  "Quartz Queen",
  "Rocket June",
  "Silver Pip",
  "Tango Star",
  "Ultra Violet",
  "Velvet Zip",
  "Willow Whirl",
  "X-Ray Ruby",
  "Yonder Blue",
  "Zigzag Gold",
  "Bingo Nova",
  "Lucky Circuit",
  "Pixel Thunder",
  "Turbo Clover",
];

export function assignRacerNames(seed: string, racerIds: string[], previews: Map<string, string>): RacerIdentity[] {
  const rng = createSeededRng(`${seed}:racer-names`);
  const names = [...racerNames];

  for (let i = names.length - 1; i > 0; i -= 1) {
    const swapIndex = rng.nextInt(0, i + 1);
    [names[i], names[swapIndex]] = [names[swapIndex], names[i]];
  }

  return racerIds.map((id, index) => ({
    id,
    name: names[index % names.length],
    previewUrl: previews.get(id) ?? "",
  }));
}
