export type PlatformCategory = "mobile-first" | "desktop-optimized";

export type GameRecord = {
  id: string;
  name: string;
  path: string;
  category: string;
  description: string;
  cta: string;
  accent: string;
  platform: PlatformCategory;
  controlsNote: string;
  sortOrder: number;
};

export const games: GameRecord[] = [
  { id: "spy-hunter-apex", name: "Spy Hunter: Apex", path: "/spy-hunter-apex", category: "Vaporwave Pursuit", description: "Run the classified northbound route through traffic, river transfers, and hostile pursuit vehicles.", cta: "Authorize Route", accent: "apex", platform: "desktop-optimized", controlsNote: "Best with a keyboard and larger display.", sortOrder: 1 },
  { id: "plasmodyne", name: "Plasmodyne", path: "/plasmodyne", category: "Droid Infiltration", description: "Board a hostile ship, hunt rogue droids, and transfer into stronger bodies.", cta: "Board Ship", accent: "plasma", platform: "desktop-optimized", controlsNote: "Designed for keyboard and mouse controls.", sortOrder: 2 },
  { id: "concordant", name: "Concordant", path: "/concordant", category: "Arcade Strategy", description: "Explore an abandoned star system, recover logs, and restore failing systems.", cta: "Enter Sector", accent: "teal", platform: "desktop-optimized", controlsNote: "Best on a larger screen with keyboard controls.", sortOrder: 3 },
  { id: "boondock-trail", name: "Boondock Trail", path: "/boondock-trail", category: "Road Trip Survival", description: "Manage supplies, pick your stops, and make the most of life on the road.", cta: "Hit the Road", accent: "sage", platform: "mobile-first", controlsNote: "Touch-friendly controls and a responsive layout.", sortOrder: 4 },
  { id: "stone-horses", name: "Stone Horses", path: "/stone-horses", category: "Physics Racing", description: "A neon marble racing table with betting, unpredictable physics, and machine hazards.", cta: "Place Wager", accent: "rose", platform: "desktop-optimized", controlsNote: "A larger display is recommended for race detail.", sortOrder: 5 },
  { id: "streets-arcana", name: "Streets Arcana", path: "/coach", category: "Poker Coach", description: "Master heads-up hold'em through live drills, opponent reads, and adaptive opponents.", cta: "Take a Seat", accent: "gold", platform: "desktop-optimized", controlsNote: "Best with room for the full table and study panels.", sortOrder: 6 },
  { id: "lords-of-chaos", name: "The Lords of Chaos", path: "/lords-of-chaos", category: "Retro Labyrinth Adventure", description: "A labyrinth adventure where every doorway leads to a different world.", cta: "Enter the Maze", accent: "violet", platform: "desktop-optimized", controlsNote: "Keyboard controls and a larger display are recommended.", sortOrder: 7 },
  { id: "ancient-suffering", name: "Ancient Suffering", path: "/ancient-suffering-reborn", category: "Retro Text Fantasy", description: "A dark text adventure through cursed ruins, strange relics, and impossible choices.", cta: "Descend Below", accent: "ember", platform: "mobile-first", controlsNote: "Button-driven play adapts well to phones and touch.", sortOrder: 8 },
  { id: "math-blaster-neo", name: "Math Blaster Neo", path: "/math-blaster-neo", category: "Math Arcade", description: "Solve falling equations under increasing speed and pressure.", cta: "Begin Defense", accent: "plasma", platform: "mobile-first", controlsNote: "Responsive controls support phone and touch play.", sortOrder: 9 },
  { id: "dead-channels", name: "Dead Channels", path: "/dead-channels", category: "Typing Roguelite", description: "Stabilize signal streams and type under pressure before the channels collapse.", cta: "Tune In", accent: "signal", platform: "desktop-optimized", controlsNote: "Requires a physical keyboard for its typing mechanics.", sortOrder: 10 }
];

export const platformDetails = {
  "mobile-first": { title: "Mobile-First", description: "Designed primarily for phones and touch controls." },
  "desktop-optimized": { title: "Desktop Optimized", description: "Best played with a larger screen, keyboard, or mouse." }
} as const;
