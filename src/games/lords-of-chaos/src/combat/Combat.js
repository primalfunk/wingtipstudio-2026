import { randint } from "../core/random.js";

export class Combat {
  constructor(player, enemy, messageDisplay, soundManager, telemetry) {
    this.player = player;
    this.enemy = enemy;
    this.messageDisplay = messageDisplay;
    this.soundManager = soundManager;
    this.telemetry = telemetry;
    this.playerTurn = true;
    this.enemyActionAt = null;
    this.guarding = false;
    this.lastUpdate = performance.now();
    this.roundCount = 0;
    this.playerDamage = 0;
    this.isOver = false;
    this.playerWon = false;
    player.inCombat = true;
    enemy.inCombat = true;
    this.telemetry?.startCombat(player.hp, enemy.name);
    this.messageDisplay.add("***** Entering Combat Mode *****", "orange");
    this.messageDisplay.add(`* Combat has started between ${player.name} and ${enemy.name}`, "orange");
  }

  update(now) {
    if (this.isOver || this.playerTurn || this.enemyActionAt === null || now < this.enemyActionAt) return;
    this.attack(this.enemy, this.player);
    this.guarding = false;
    this.playerTurn = true;
    this.enemyActionAt = null;
    this.player.regenerateMp("combat");
    this.lastUpdate = now;
    this.checkEnd();
  }

  playerAttack() {
    if (!this.canPlayerAct()) return false;
    this.attack(this.player, this.enemy);
    this.checkEnd();
    if (!this.isOver) this.queueEnemyAction();
    return true;
  }

  guard() {
    if (!this.canPlayerAct()) return false;
    this.roundCount += 1;
    this.guarding = true;
    this.messageDisplay.add(`* ${this.player.name} guards against the next attack.`, "blue");
    this.queueEnemyAction();
    return true;
  }

  flee() {
    if (!this.canPlayerAct()) return false;
    this.roundCount += 1;
    const fleeChance = Math.max(5, Math.min(95, 50 + (this.player.eva - this.enemy.eva) / 2));
    if (randint(0, 100) <= fleeChance) {
      this.messageDisplay.add(`* ${this.player.name} escapes from ${this.enemy.name}.`, "blue");
      this.player.inCombat = false;
      this.enemy.inCombat = false;
      this.isOver = true;
      this.playerWon = false;
      this.fled = true;
      return true;
    }
    this.messageDisplay.add(`* ${this.player.name} fails to flee.`, "red");
    this.queueEnemyAction();
    return false;
  }

  canPlayerAct() {
    return !this.isOver && this.playerTurn;
  }

  queueEnemyAction() {
    this.playerTurn = false;
    this.enemyActionAt = performance.now() + 550;
  }

  attack(attacker, defender) {
    this.roundCount += 1;
    const isPlayer = attacker === this.player;
    const telemetryResult = { isPlayer, hit: false, critical: false, damage: 0 };
    const hitChance = Math.max(10, Math.min(95, 60 + attacker.int - defender.eva));
    if (randint(0, 100) > hitChance) {
      this.telemetry?.recordAttack(telemetryResult);
      this.messageDisplay.add(isPlayer ? "* You miss. The enemy evades your attack." : "* The enemy misses.", isPlayer ? "blue" : "red");
      return;
    }
    const variance = 0.85 + Math.random() * 0.15;
    let damage = Math.max(1, Math.floor(attacker.atk * variance - defender.defn * 0.6));
    if (!isPlayer && this.guarding) damage = Math.max(1, Math.floor(damage * 0.6));
    const criticalChance = Math.max(5, Math.min(40, 5 + (attacker.wis - defender.wis) / 2));
    if (randint(0, 100) < criticalChance) {
      damage = Math.floor(damage * (2 + Math.random() * 0.5));
      telemetryResult.critical = true;
      this.messageDisplay.add(`* Critical hit! ${attacker.name} does ${damage} damage.`, isPlayer ? "blue" : "red");
    } else {
      this.messageDisplay.add(`* ${attacker.name} hits ${defender.name} for ${damage} damage.`, isPlayer ? "blue" : "red");
    }
    defender.hp -= damage;
    telemetryResult.hit = true;
    telemetryResult.damage = damage;
    this.telemetry?.recordAttack(telemetryResult);
    if (isPlayer) this.playerDamage += damage;
    if (!isPlayer && defender.hp > 0 && defender.hp / defender.maxHp < 0.3) {
      this.messageDisplay.add("* You are badly wounded.", "red");
    }
    this.soundManager.play("round", 0.45);
  }

  checkEnd() {
    if (this.player.hp > 0 && this.enemy.hp > 0) return;
    this.player.inCombat = false;
    this.enemy.inCombat = false;
    this.playerWon = this.player.hp > 0;
    this.isOver = true;
    this.messageDisplay.add(`* Combat has ended. ${this.player.name} ${this.playerWon ? "has won!" : "has lost!"}`, "orange");
    this.messageDisplay.add(`* The battle lasted ${Math.floor(this.roundCount / 2)} rounds; ${this.player.name} dealt ${this.playerDamage} damage.`);
  }
}
