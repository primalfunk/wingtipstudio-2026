function ratio(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
}

function rounded(value) {
  return Math.round(value * 1000) / 1000;
}

export class Telemetry {
  constructor() {
    this.reset();
  }

  reset() {
    this.level = 1;
    this.combatsStarted = 0;
    this.combatsWon = 0;
    this.combatsLost = 0;
    this.enemiesKilled = 0;
    this.playerDamageDealt = 0;
    this.playerDamageTaken = 0;
    this.playerAttacks = 0;
    this.playerHits = 0;
    this.playerCrits = 0;
    this.enemyAttacks = 0;
    this.enemyHits = 0;
    this.enemyCrits = 0;
    this.turnsPerCombat = [];
    this.expGained = 0;
    this.levelUps = 0;
    this.hpAtCombatStart = [];
    this.hpAtCombatEnd = [];
    this.enemyTypesEncountered = [];
    this.finalHP = null;
    this.causeOfDeath = null;
  }

  setLevel(level) {
    this.level = level;
  }

  startCombat(playerHp, enemyName = "unknown enemy") {
    this.combatsStarted += 1;
    this.hpAtCombatStart.push(playerHp);
    this.enemyTypesEncountered.push(enemyName);
  }

  recordAttack({ isPlayer, hit, critical, damage }) {
    if (isPlayer) {
      this.playerAttacks += 1;
      if (hit) this.playerHits += 1;
      if (critical) this.playerCrits += 1;
      this.playerDamageDealt += damage;
    } else {
      this.enemyAttacks += 1;
      if (hit) this.enemyHits += 1;
      if (critical) this.enemyCrits += 1;
      this.playerDamageTaken += damage;
    }
  }

  finishCombat({ playerWon, fled = false, turns, playerHpEnd, enemyName, expGained = 0 }) {
    this.finalHP = playerHpEnd;
    if (playerWon) {
      this.combatsWon += 1;
      this.enemiesKilled += 1;
    } else if (!fled) {
      this.combatsLost += 1;
      this.causeOfDeath = enemyName ? `combat:${enemyName}` : "combat";
    }
    this.turnsPerCombat.push(turns);
    this.hpAtCombatEnd.push(playerHpEnd);
    this.expGained += expGained;
  }

  recordLevelUp() {
    this.levelUps += 1;
  }

  derivedStats() {
    return {
      playerHitRate: rounded(ratio(this.playerHits, this.playerAttacks)),
      enemyHitRate: rounded(ratio(this.enemyHits, this.enemyAttacks)),
      playerCritRate: rounded(ratio(this.playerCrits, this.playerHits)),
      enemyCritRate: rounded(ratio(this.enemyCrits, this.enemyHits)),
      avgTurnsPerCombat: rounded(ratio(this.turnsPerCombat.reduce((sum, turns) => sum + turns, 0), this.turnsPerCombat.length)),
      avgDamageDealtPerCombat: rounded(ratio(this.playerDamageDealt, this.combatsStarted)),
      avgDamageTakenPerCombat: rounded(ratio(this.playerDamageTaken, this.combatsStarted)),
    };
  }

  summary() {
    const { playerHitRate, enemyHitRate, playerCritRate, enemyCritRate, avgTurnsPerCombat, avgDamageDealtPerCombat, avgDamageTakenPerCombat } = this.derivedStats();
    return {
      level: this.level,
      combatsStarted: this.combatsStarted,
      combatsWon: this.combatsWon,
      combatsLost: this.combatsLost,
      enemiesKilled: this.enemiesKilled,
      playerDamageDealt: this.playerDamageDealt,
      playerDamageTaken: this.playerDamageTaken,
      playerAttacks: this.playerAttacks,
      playerHits: this.playerHits,
      playerCrits: this.playerCrits,
      enemyAttacks: this.enemyAttacks,
      enemyHits: this.enemyHits,
      enemyCrits: this.enemyCrits,
      expGained: this.expGained,
      playerLevelUps: this.levelUps,
      enemyTypesEncountered: [...this.enemyTypesEncountered],
      finalHP: this.finalHP,
      playerHitRate,
      enemyHitRate,
      playerCritRate,
      enemyCritRate,
      avgTurnsPerCombat,
      avgDamageDealtPerCombat,
      avgDamageTakenPerCombat,
      causeOfDeath: this.causeOfDeath,
    };
  }

  printSummary(reason) {
    const title = `Balance telemetry: ${reason}`;
    const summary = this.summary();
    const winRate = ratio(this.combatsWon, this.combatsStarted);
    const targetChecks = {
      baselineAvgTurns4To7: summary.avgTurnsPerCombat >= 4 && summary.avgTurnsPerCombat <= 7,
      baselineAvgDamageTaken8To14: summary.avgDamageTakenPerCombat >= 8 && summary.avgDamageTakenPerCombat <= 14,
      earlyPlayerWinRate70To85: winRate >= 0.7 && winRate <= 0.85,
    };
    const liveBalanceSummary = {
      level: summary.level,
      combatsStarted: summary.combatsStarted,
      combatsWon: summary.combatsWon,
      combatsLost: summary.combatsLost,
      enemyTypesEncountered: summary.enemyTypesEncountered.join(", ") || "none",
      avgTurnsPerCombat: summary.avgTurnsPerCombat,
      avgDamageTakenPerCombat: summary.avgDamageTakenPerCombat,
      avgDamageDealtPerCombat: summary.avgDamageDealtPerCombat,
      playerLevelUps: summary.playerLevelUps,
      finalHP: summary.finalHP,
      deathCause: summary.causeOfDeath,
      earlyPlayerWinRate: rounded(winRate),
    };
    console.group(title);
    console.table(liveBalanceSummary);
    console.table(targetChecks);
    console.log("raw counters", summary);
    console.log("turnsPerCombat", [...this.turnsPerCombat]);
    console.log("hpAtCombatStart", [...this.hpAtCombatStart]);
    console.log("hpAtCombatEnd", [...this.hpAtCombatEnd]);
    console.groupEnd();
  }
}
