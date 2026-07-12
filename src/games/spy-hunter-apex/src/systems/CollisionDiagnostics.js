import { DAMAGE } from '../data/tuning.js';

export default class CollisionDiagnostics {
  constructor(scene) {
    this.scene = scene;
    this.results = [];
    this.started = false;
    this.finished = false;
    this.overlay = scene.add.text(12, 12, 'COLLISION TEST STARTING', {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '12px',
      color: '#f6e7a8',
      backgroundColor: '#14100a',
      padding: { x: 8, y: 7 },
    }).setDepth(400).setScrollFactor(0);
  }

  start() {
    if (this.started) {
      return;
    }

    this.started = true;
    this.scene.time.delayedCall(250, () => this.testTrafficCollision());
    this.scene.time.delayedCall(1350, () => this.testEnemyCollision());
    this.scene.time.delayedCall(2450, () => this.testEnemyProjectile());
    this.scene.time.delayedCall(3550, () => this.testRealSupportPickup());
    this.scene.time.delayedCall(4650, () => this.testDecoySupportPickup());
    this.scene.time.delayedCall(5750, () => this.testDecoySupportShot());
    this.scene.time.delayedCall(6850, () => this.finish());
  }

  update() {
    this.overlay.setText([
      'COLLISION TEST',
      ...this.results.map((result) => `${result.pass ? 'PASS' : 'FAIL'} ${result.name}`),
      this.finished ? 'DONE' : 'RUNNING',
    ]);
  }

  testTrafficCollision() {
    const beforeDamage = this.scene.missionState.playerDamage;
    this.scene.trafficSystem.spawnCivilianAt(
      this.scene.player.sprite.x,
      this.scene.player.sprite.y,
      { lane: 0, speed: 0 },
    );
    this.afterPhysics('traffic damages player and bounces', () => {
      const damageDelta = this.scene.missionState.playerDamage - beforeDamage;
      const trafficDamageLogged = this.scene.missionState.eventHistory.some((event) => {
        return event.type === 'playerDamage' && event.source === 'civilian';
      });
      return damageDelta === DAMAGE.trafficCollision
        && trafficDamageLogged
        && Math.abs(this.scene.player.sprite.body.velocity.x) + Math.abs(this.scene.player.sprite.body.velocity.y) > 0;
    });
  }

  testEnemyCollision() {
    const beforeDamage = this.scene.missionState.playerDamage;
    this.scene.combatSystem.spawnEnemy({
      x: this.scene.player.sprite.x,
      y: this.scene.player.sprite.y,
      lane: 0,
      speed: 0,
    });
    this.afterPhysics('enemy damages player and bounces', () => {
      const damageDelta = this.scene.missionState.playerDamage - beforeDamage;
      const enemyDamageLogged = this.scene.missionState.eventHistory.some((event) => {
        return event.type === 'playerDamage' && event.source === 'enemy';
      });
      return damageDelta === DAMAGE.enemyCollision
        && enemyDamageLogged
        && Math.abs(this.scene.player.sprite.body.velocity.x) + Math.abs(this.scene.player.sprite.body.velocity.y) > 0;
    });
  }

  testEnemyProjectile() {
    const beforeScore = this.scene.missionState.score;
    const enemyY = this.scene.player.sprite.y - 110;
    this.scene.combatSystem.spawnEnemy({
      x: this.scene.player.sprite.x,
      y: enemyY,
      lane: 0,
      speed: 0,
    });
    this.scene.combatSystem.spawnProjectileAt(this.scene.player.sprite.x, enemyY);
    this.afterPhysics('projectile destroys enemy', () => {
      return this.scene.missionState.score > beforeScore
        && this.scene.missionState.enemiesDestroyed > 0
        && this.scene.combatSystem.enemies.length === 0;
    });
  }

  testRealSupportPickup() {
    const beforeContacts = this.scene.missionState.supportContacts;
    this.scene.missionState.playerDamage = Math.max(1, this.scene.missionState.playerDamage);
    this.scene.supportSystem.spawnVan({
      x: this.scene.player.sprite.x,
      y: this.scene.player.sprite.y,
      lane: 0,
      serviceType: 'repair',
    });
    this.afterPhysics('real support pickup rewards player', () => {
      return this.scene.missionState.playerDamage === 0
        && this.scene.missionState.supportContacts === beforeContacts + 1
        && this.scene.supportSystem.vans.length === 0;
    }, 3200);
  }

  testDecoySupportPickup() {
    const beforeAwareness = this.scene.missionState.enemyAwareness;
    this.scene.supportSystem.spawnVan({
      x: this.scene.player.sprite.x,
      y: this.scene.player.sprite.y,
      lane: 0,
      isDecoy: true,
    });
    this.afterPhysics('decoy support pickup raises awareness', () => {
      return this.scene.missionState.enemyAwareness > beforeAwareness
        && this.scene.missionState.eventHistory.some((event) => event.type === 'decoySupportAccepted')
        && this.scene.supportSystem.vans.length === 0;
    }, 3200);
  }

  testDecoySupportShot() {
    const beforeScore = this.scene.missionState.score;
    const y = this.scene.player.sprite.y - 120;
    this.scene.supportSystem.spawnVan({
      x: this.scene.player.sprite.x,
      y,
      lane: 0,
      isDecoy: true,
    });
    this.scene.combatSystem.spawnProjectileAt(this.scene.player.sprite.x, y);
    this.afterPhysics('projectile destroys decoy support', () => {
      return this.scene.missionState.score > beforeScore
        && this.scene.missionState.eventHistory.some((event) => event.type === 'decoySupportDestroyed')
        && this.scene.supportSystem.vans.length === 0;
    });
  }

  afterPhysics(name, assertion, delayMs = 120) {
    this.scene.time.delayedCall(delayMs, () => {
      let pass = false;
      try {
        pass = Boolean(assertion());
      } catch {
        pass = false;
      }
      this.results.push({ name, pass });
      console.log(`[CollisionDiagnostics] ${pass ? 'PASS' : 'FAIL'} ${name}`);
    });
  }

  finish() {
    this.finished = true;
    const failed = this.results.filter((result) => !result.pass);
    console.table(this.results);
    console.log(`[CollisionDiagnostics] ${failed.length === 0 ? 'all checks passed' : `${failed.length} checks failed`}`);
  }
}
