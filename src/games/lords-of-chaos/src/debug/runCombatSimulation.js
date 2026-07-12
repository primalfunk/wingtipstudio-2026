import { simulateMultipleCombats } from "./combatSimulation.js";
import { Enemy } from "../actors/Enemy.js";
import { Player } from "../actors/Player.js";

const level1Player = {
  name: "PLAYER",
  maxHp: 20,
  atk: 10,
  defn: 5,
  int: 10,
  wis: 10,
  eva: 10,
};

const level1WeakEnemy = {
  name: "Weak Enemy",
  maxHp: 12,
  atk: 9,
  defn: 3,
  int: 10,
  wis: 9,
  eva: 4,
};

const level1BaselineEnemy = {
  name: "Baseline Enemy",
  maxHp: 13,
  atk: 12,
  defn: 4,
  int: 12,
  wis: 11,
  eva: 5,
};

const level1StrongEnemy = {
  name: "Strong Enemy",
  maxHp: 16,
  atk: 13,
  defn: 5,
  wis: 12,
  int: 13,
  eva: 7,
};

const presets = [
  ["Weak Enemy", level1WeakEnemy],
  ["Baseline Enemy", level1BaselineEnemy],
  ["Strong Enemy", level1StrongEnemy],
];

const rows = presets.map(([label, enemyStats]) => {
  const result = simulateMultipleCombats(level1Player, enemyStats, 1000, { silent: true });
  return {
    enemy: label,
    winRate: Number(result.winRate.toFixed(3)),
    avgTurns: Number(result.avgTurns.toFixed(3)),
    avgDamageDealt: Number(result.avgDamageDealt.toFixed(3)),
    avgDamageTaken: Number(result.avgDamageTaken.toFixed(3)),
  };
});

console.group("Level 1 combat simulation presets");
console.table(rows);
console.groupEnd();

function createDummyRoom() {
  return {
    x: 0,
    y: 0,
    enemies: [],
    decorations: [],
    connections: {},
  };
}

function createExpectedPlayerStats(level, gearBonus = 6) {
  const player = new Player(createDummyRoom(), { level }, 1);
  while (player.level < level) player.levelUp();
  player.atk += gearBonus;
  player.defn += gearBonus;
  return {
    name: `Level ${level} Player`,
    maxHp: player.maxHp,
    atk: player.atk,
    defn: player.defn,
    int: player.int,
    wis: player.wis,
    eva: player.eva,
  };
}

function createEnemyStats(level, tier) {
  const enemy = new Enemy(createDummyRoom(), level, tier);
  return {
    name: `${tier} level ${level} enemy`,
    maxHp: enemy.maxHp,
    atk: enemy.atk,
    defn: enemy.defn,
    int: enemy.int,
    wis: enemy.wis,
    eva: enemy.eva,
  };
}

function enemyLevelForDiagnostic(playerLevel, tier, realmLevel) {
  if (realmLevel <= 24) {
    if (tier === "weak") return Math.max(1, playerLevel - 8);
    if (tier === "strong") return Math.max(1, playerLevel - 6);
    return Math.max(1, playerLevel - 7);
  }
  if (realmLevel <= 30) {
    if (tier === "weak") return Math.max(1, playerLevel - 10);
    if (tier === "strong") return Math.max(1, playerLevel - 8);
    return Math.max(1, playerLevel - 9);
  }
  if (realmLevel <= 40) {
    if (tier === "weak") return Math.max(1, playerLevel - 9);
    if (tier === "strong") return Math.max(1, playerLevel - 5);
    return Math.max(1, playerLevel - 7);
  }
  const baselineOffset = Math.min(13, 7 + Math.floor((realmLevel - 40) / 10));
  if (tier === "weak") return Math.max(1, playerLevel - (baselineOffset + 2));
  if (tier === "strong") return Math.max(1, playerLevel - Math.max(3, baselineOffset - 2));
  return Math.max(1, playerLevel - baselineOffset);
}

function runLevelRangeCombatDiagnostics(startLevel, targetLevel) {
  const rows = [];
  for (let level = startLevel; level < targetLevel; level += 1) {
    const player = createExpectedPlayerStats(level);
    const enemyLevels = {
      weak: enemyLevelForDiagnostic(level, "weak", level),
      baseline: enemyLevelForDiagnostic(level, "baseline", level),
      strong: enemyLevelForDiagnostic(level, "strong", level),
    };
    for (const [tier, enemyLevel] of Object.entries(enemyLevels)) {
      const result = simulateMultipleCombats(player, createEnemyStats(enemyLevel, tier), 500, { silent: true });
      rows.push({
        level,
        tier,
        enemyLevel,
        winRate: Number(result.winRate.toFixed(3)),
        avgTurns: Number(result.avgTurns.toFixed(3)),
        avgDamageTaken: Number(result.avgDamageTaken.toFixed(3)),
      });
    }
  }
  console.group(`Combat diagnostics levels ${startLevel}-${targetLevel - 1}`);
  console.table(rows);
  console.groupEnd();
}

const args = process.argv.slice(2);
const optionValue = (name) => {
  const prefix = `--${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : null;
};
const startLevel = Number(optionValue("start"));
const targetLevel = Number(optionValue("target"));
if (Number.isFinite(startLevel) && Number.isFinite(targetLevel) && targetLevel > startLevel) {
  runLevelRangeCombatDiagnostics(startLevel, targetLevel);
}
