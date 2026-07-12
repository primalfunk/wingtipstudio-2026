import { randint } from "../core/random.js";

function cloneStats(stats) {
  return {
    name: stats.name ?? "combatant",
    hp: stats.hp ?? stats.maxHp,
    maxHp: stats.maxHp ?? stats.hp,
    atk: stats.atk,
    defn: stats.defn,
    int: stats.int,
    wis: stats.wis,
    eva: stats.eva,
  };
}

function attack(attacker, defender) {
  const hitChance = Math.max(10, Math.min(95, 60 + attacker.int - defender.eva));
  if (randint(0, 100) > hitChance) return { hit: false, crit: false, damage: 0 };

  const variance = 0.85 + Math.random() * 0.15;
  let damage = Math.max(1, Math.floor(attacker.atk * variance - defender.defn * 0.6));
  const critChance = Math.max(5, Math.min(40, 5 + (attacker.wis - defender.wis) / 2));
  const crit = randint(0, 100) < critChance;
  if (crit) damage = Math.floor(damage * (2 + Math.random() * 0.5));

  defender.hp -= damage;
  return { hit: true, crit, damage };
}

export function simulateCombat(playerStats, enemyStats) {
  const player = cloneStats(playerStats);
  const enemy = cloneStats(enemyStats);
  let turns = 0;
  let damageDealt = 0;
  let damageTaken = 0;

  while (player.hp > 0 && enemy.hp > 0 && turns < 1000) {
    const playerAttack = attack(player, enemy);
    turns += 1;
    damageDealt += playerAttack.damage;
    if (enemy.hp <= 0) break;

    const enemyAttack = attack(enemy, player);
    turns += 1;
    damageTaken += enemyAttack.damage;
  }

  return {
    playerWon: player.hp > 0 && enemy.hp <= 0,
    turns,
    damageDealt,
    damageTaken,
    playerHpEnd: Math.max(0, player.hp),
    enemyHpEnd: Math.max(0, enemy.hp),
  };
}

export function simulateMultipleCombats(playerStats, enemyStats, iterations = 1000, options = {}) {
  const results = [];
  for (let index = 0; index < iterations; index += 1) {
    results.push(simulateCombat(playerStats, enemyStats));
  }

  const wins = results.filter((result) => result.playerWon).length;
  const totals = results.reduce((sum, result) => {
    sum.turns += result.turns;
    sum.damageDealt += result.damageDealt;
    sum.damageTaken += result.damageTaken;
    return sum;
  }, { turns: 0, damageDealt: 0, damageTaken: 0 });

  const summary = {
    iterations,
    winRate: wins / iterations,
    avgTurns: totals.turns / iterations,
    avgDamageDealt: totals.damageDealt / iterations,
    avgDamageTaken: totals.damageTaken / iterations,
  };

  if (!options.silent) {
    console.group("Combat simulation");
    console.table(summary);
    console.groupEnd();
  }
  return summary;
}
