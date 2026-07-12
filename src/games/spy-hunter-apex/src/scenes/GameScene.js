import Phaser from 'phaser';
import { getMissionNode } from '../data/campaignData.js';
import { ROAD_SEGMENTS } from '../data/roadSegments.js';
import PlayerCar from '../entities/PlayerCar.js';
import Hud from '../ui/Hud.js';
import MissionState from '../systems/MissionState.js';
import RoadSystem from '../systems/RoadSystem.js';
import TrafficSystem from '../systems/TrafficSystem.js';
import CombatSystem from '../systems/CombatSystem.js';
import SupportSystem from '../systems/SupportSystem.js';
import RoadSignSystem from '../systems/RoadSignSystem.js';
import WorldEnvironmentSystem from '../systems/WorldEnvironmentSystem.js';
import RoadsideDetailSystem from '../systems/RoadsideDetailSystem.js';
import OverheadInfrastructureSystem from '../systems/OverheadInfrastructureSystem.js';
import RoadAtmosphereSystem from '../systems/RoadAtmosphereSystem.js';
import EnvironmentalMotionSystem from '../systems/EnvironmentalMotionSystem.js';
import RoadChoreographySystem from '../systems/RoadChoreographySystem.js';
import InfrastructurePressureSystem from '../systems/InfrastructurePressureSystem.js';
import LandmarkSetpieceSystem from '../systems/LandmarkSetpieceSystem.js';
import MissionEndSetpieceSystem from '../systems/MissionEndSetpieceSystem.js';
import MissionBeatDirector from '../systems/MissionBeatDirector.js';
import MissionPacingDirector from '../systems/MissionPacingDirector.js';
import PlayerBeliefModel from '../systems/PlayerBeliefModel.js';
import AudioSystem from '../systems/AudioSystem.js';
import AiDriver from '../systems/AiDriver.js';
import CollisionDiagnostics from '../systems/CollisionDiagnostics.js';
import EffectsSystem from '../systems/EffectsSystem.js';
import LayoutSystem from '../systems/LayoutSystem.js';
import DebugOverlay from '../ui/DebugOverlay.js';
import HarnessOverlay from '../ui/HarnessOverlay.js';
import { COMBAT, DAMAGE, GAME_HEIGHT, GAME_WIDTH, PLAYER, PLAYER_MODES, ROAD, SUPPORT } from '../data/tuning.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init(data = {}) {
    this.sceneConfig = {
      aiControlled: false,
      autopilot: false,
      attract: false,
      harness: false,
      collisionTest: false,
      ...data,
    };
    this.isAutopilot = Boolean(this.sceneConfig.autopilot);
    this.aiControlled = Boolean(this.sceneConfig.aiControlled || this.isAutopilot);
    this.isHarness = Boolean(this.sceneConfig.harness);
    this.isAttract = Boolean(this.sceneConfig.attract);
    this.isCollisionTest = Boolean(this.sceneConfig.collisionTest);
    this.visualScenario = this.sceneConfig.visualScenario ?? null;
    this.harnessState = this.sceneConfig.harnessState ?? null;
    this.worldId = this.sceneConfig.worldId ?? 'world-1';
    this.missionId = this.sceneConfig.missionId ?? '1-1';
    this.mission = getMissionNode(this.missionId, this.worldId);
    this.missionComplete = false;
    this.gameOverPending = false;
    this.completedTransitions = new Set();
  }

  create() {
    LayoutSystem.updateFromScale(this.scale);
    LayoutSystem.onResize(this, () => this.handleLayoutResize());
    this.input.keyboard.enabled = true;
    this.input.keyboard.resetKeys();
    this.controlLocked = false;
    this.playerHiddenFromEnemies = false;
    this.missionState = new MissionState();
    this.missionState.worldId = this.worldId;
    this.missionState.missionId = this.missionId;
    this.missionState.environmentProfile = this.mission?.environmentProfile ?? 'default';
    this.worldEnvironmentSystem = new WorldEnvironmentSystem(this, this.missionState, this.mission);
    this.roadSystem = new RoadSystem(this, this.missionState);
    this.roadsideDetailSystem = new RoadsideDetailSystem(this, this.missionState);
    this.overheadInfrastructureSystem = new OverheadInfrastructureSystem(this, this.missionState);
    this.roadAtmosphereSystem = new RoadAtmosphereSystem(this, this.missionState);
    this.environmentalMotionSystem = new EnvironmentalMotionSystem(this, this.missionState);
    this.roadChoreographySystem = new RoadChoreographySystem(this, this.missionState);
    this.infrastructurePressureSystem = new InfrastructurePressureSystem(this, this.missionState);
    this.landmarkSetpieceSystem = new LandmarkSetpieceSystem(this, this.missionState);
    this.missionEndSetpieceSystem = new MissionEndSetpieceSystem(this, this.missionState, this.mission);
    this.player = new PlayerCar(this, PLAYER.startX, PLAYER.startY);
    this.missionState.setPlayerMode('car');
    this.trafficSystem = new TrafficSystem(this, this.missionState);
    this.audioSystem = new AudioSystem(this);
    this.effectsSystem = new EffectsSystem(this);
    if (this.isAttract) {
      this.audioSystem.enabled = false;
    } else {
      this.audioSystem.playDrivingMusic();
    }
    this.combatSystem = new CombatSystem(
      this,
      this.missionState,
      this.player,
      this.audioSystem,
      this.effectsSystem,
    );
    this.hud = new Hud(this, this.missionState);
    this.supportSystem = new SupportSystem(this, this.missionState, (message) => {
      if (!this.isAttract) {
        this.hud.flashAlert(message);
      }
    });
    this.roadSignSystem = new RoadSignSystem(this);
    this.playerBeliefModel = new PlayerBeliefModel(this.missionState);
    this.debugOverlay = new DebugOverlay(this, this.missionState);
    this.missionPacingDirector = new MissionPacingDirector(this, this.missionState, this.mission);
    this.missionBeatDirector = new MissionBeatDirector(this, this.missionState, this.mission, {
      combatSystem: this.combatSystem,
      supportSystem: this.supportSystem,
      trafficSystem: this.trafficSystem,
      roadSignSystem: this.roadSignSystem,
    });
    this.aiDriver = this.aiControlled
      ? new AiDriver(this, this.missionState, this.player, {
        trafficSystem: this.trafficSystem,
        combatSystem: this.combatSystem,
        supportSystem: this.supportSystem,
      })
      : null;
    this.harnessOverlay = this.isHarness ? new HarnessOverlay(this, this.harnessState) : null;
    this.collisionDiagnostics = this.isCollisionTest ? new CollisionDiagnostics(this) : null;
    this.lastCollisionAt = -DAMAGE.collisionCooldownMs;
    this.lastInfrastructureHitAt = -DAMAGE.collisionCooldownMs;
    this.lastEnemyProjectileHitAt = -DAMAGE.enemyProjectileCooldownMs;
    this.lastLostLifeSoundAt = -Infinity;

    if (this.isAttract) {
      this.hud.text.setVisible(false);
      this.hud.status.setVisible(false);
      this.hud.alert.setVisible(false);
    } else if (this.isAutopilot) {
      this.hud.flashAlert('AUTOPILOT ENGAGED: AI driving.');
    }

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      fire: Phaser.Input.Keyboard.KeyCodes.SPACE,
      mute: Phaser.Input.Keyboard.KeyCodes.M,
      debug: Phaser.Input.Keyboard.KeyCodes.F1,
      restart: Phaser.Input.Keyboard.KeyCodes.R,
    });
    this.moveState = {
      up: false,
      down: false,
      left: false,
      right: false,
    };
    this.pointerMoveInput = { active: false, x: 0, y: 0 };
    this.input.keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.W,
      Phaser.Input.Keyboard.KeyCodes.A,
      Phaser.Input.Keyboard.KeyCodes.S,
      Phaser.Input.Keyboard.KeyCodes.D,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    ]);
    this.input.keyboard.on('keydown', this.handleMovementKeyDown, this);
    this.input.keyboard.on('keyup', this.handleMovementKeyUp, this);
    this.input.on('pointerdown', this.handlePointerMoveInput, this);
    this.input.on('pointermove', this.handlePointerMoveInput, this);
    this.input.on('pointerup', this.clearPointerMoveInput, this);
    this.input.on('pointerupoutside', this.clearPointerMoveInput, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdownInputHandlers, this);

    this.keys.debug.on('down', () => this.debugOverlay.toggle());
    this.keys.mute.on('down', () => {
      const enabled = this.audioSystem.toggle();
      this.hud.flashAlert(`AUDIO: ${enabled ? 'Enabled' : 'Muted'}.`);
    });
    this.keys.restart.on('down', () => this.restartCurrentMode());

    this.physics.add.overlap(
      this.combatSystem.projectileGroup,
      this.supportSystem.group,
      this.handleSupportShot,
      undefined,
      this,
    );

    this.collisionDiagnostics?.start();
    this.setupVisualScenario();
  }

  setupVisualScenario() {
    if (!this.visualScenario) {
      return;
    }

    Phaser.Math.RND.sow([`visual-${this.visualScenario}`]);
    this.audioSystem.enabled = false;
    this.missionPacingDirector.currentPhaseIndex = 1;
    this.missionState.pacingSpawnProfile = { traffic: 0.55, enemies: 0.45 };

    const scenarios = {
      divided: () => {
        this.forceRoadSegment('divided_guardrail_run', { splitProgress: 1 });
        this.populateVisualTraffic();
      },
      tunnel: () => {
        this.forceRoadSegment('tunnel_run');
        this.populateVisualTraffic();
      },
      bridge: () => {
        this.forceRoadSegment('bridge_crossing');
        this.populateVisualTraffic();
      },
      construction: () => {
        this.forceRoadSegment('construction_diversion');
        this.populateVisualTraffic();
      },
      finish: () => {
        this.forceRoadSegment('checkpoint_gate');
        this.missionState.elapsedTime = Math.max(0, (this.mission?.lengthSeconds ?? 80) - 4.2);
        this.missionEndSetpieceSystem.spawn();
      },
      'support-repair': () => this.setupSupportVisualScenario('repair'),
      'support-ammo': () => this.setupSupportVisualScenario('ammo'),
      'support-upgrade': () => {
        this.setPlayerMode('motorcycle', { invincible: true });
        this.setupSupportVisualScenario('upgrade');
      },
    };

    scenarios[this.visualScenario]?.();
  }

  forceRoadSegment(segmentId, config = {}) {
    let index = this.roadSystem.segments.findIndex((segment) => segment.id === segmentId);
    if (index < 0) {
      const segment = ROAD_SEGMENTS.find((candidate) => candidate.id === segmentId);
      if (!segment) {
        return;
      }
      this.roadSystem.segments.push(segment);
      index = this.roadSystem.segments.length - 1;
    }

    this.roadSystem.segmentIndex = index - 1;
    this.roadSystem.advanceSegment();
    if (config.splitProgress != null) {
      this.roadSystem.splitProgress = config.splitProgress;
      this.roadSystem.splitTarget = config.splitProgress;
      this.roadSystem.updateLayout(0);
    }
    this.trafficSystem.nextSpawnAt = Number.POSITIVE_INFINITY;
    this.combatSystem.nextEnemySpawnAt = Number.POSITIVE_INFINITY;
    this.supportSystem.nextSpawnAt = Number.POSITIVE_INFINITY;
  }

  populateVisualTraffic() {
    const lanes = this.roadSystem.getLaneCentersForTarget('both');
    const yPositions = [128, 252, 392, 540];
    lanes.forEach((x, lane) => {
      if (lane % 2 === 0) {
        this.trafficSystem.spawnCivilianAt(x, yPositions[lane] ?? 220, {
          lane,
          speed: 105,
          tintIndex: lane,
        });
      } else {
        this.combatSystem.spawnEnemy({
          x,
          y: yPositions[lane] ?? 260,
          lane,
          speed: 90,
          enemyTypeId: lane === 1 ? 'pursuit-interceptor' : 'turret-gunner',
        });
      }
    });
  }

  setupSupportVisualScenario(serviceType) {
    this.forceRoadSegment('support_corridor');
    const laneCenters = this.roadSystem.getLaneCentersForTarget('player_side');
    const lane = Math.min(1, laneCenters.length - 1);
    const x = laneCenters[lane] ?? PLAYER.startX;
    this.player.sprite.setPosition(x, GAME_HEIGHT - 120);
    const van = this.supportSystem.spawnVan({
      x,
      y: GAME_HEIGHT - 254,
      lane,
      speed: 0,
      serviceType,
    });
    if (!van) {
      return;
    }
    van.sprite.body.setVelocity(0, 0);
    this.time.delayedCall(180, () => {
      if (van.sprite.active) {
        this.beginSupportDocking(van.sprite);
      }
    });
  }

  handleLayoutResize() {
    if (this.player?.sprite?.active) {
      this.player.sprite.x = Phaser.Math.Clamp(
        this.player.sprite.x,
        ROAD.left + this.player.sprite.displayWidth / 2,
        ROAD.right - this.player.sprite.displayWidth / 2,
      );
      this.player.sprite.y = Phaser.Math.Clamp(
        this.player.sprite.y,
        this.player.sprite.displayHeight / 2 + 18,
        GAME_HEIGHT - this.player.sprite.displayHeight / 2 - 18,
      );
    }
  }

  update(time, delta) {
    if (this.missionState.isGameOver) {
      return;
    }

    this.missionState.update(delta);
    if (this.isCollisionTest) {
      this.combatSystem.updateProjectiles();
      this.resolveProjectileVehicleHits();
      this.resolveAllSolidBodyContacts();
      this.resolveCollisionTestSupportContacts();
      this.collisionDiagnostics.update();
      this.hud.update();
      return;
    }

    if (this.isHarness && this.missionState.elapsedTime >= this.harnessState.maxRunSeconds) {
      this.finishHarnessRun('timeout');
      return;
    }

    if (this.isAttract && this.missionState.elapsedTime >= 55) {
      this.scene.restart(this.sceneConfig);
      return;
    }

    if (!this.isHarness && !this.isAttract && !this.isCollisionTest) {
      this.updateMissionProgress();
      if (this.missionComplete) {
        return;
      }
    }

    this.worldEnvironmentSystem.update(delta);
    this.roadSystem.update(delta);
    this.roadsideDetailSystem.update(delta);
    this.overheadInfrastructureSystem.update(delta);
    this.roadAtmosphereSystem.update(delta);
    this.environmentalMotionSystem.update(delta);
    this.roadChoreographySystem.update(delta);
    this.infrastructurePressureSystem.update(delta);
    this.landmarkSetpieceSystem.update(delta);
    this.missionEndSetpieceSystem.update(delta);
    this.missionPacingDirector.update();
    this.missionBeatDirector.update();
    this.roadSignSystem.update(time, delta);
    this.trafficSystem.update(time);
    const aiInput = this.aiDriver?.update() ?? { x: 0, y: 0, fire: false };
    const currentInput = this.controlLocked
      ? { x: 0, y: 0, fire: false }
      : (this.aiControlled ? aiInput : this.getInputVector());
    this.combatSystem.update(time, !this.controlLocked && (this.aiControlled ? aiInput.fire : this.keys.fire.isDown));
    this.supportSystem.update(time);
    this.resolveProjectileVehicleHits();
    this.resolveAllSolidBodyContacts();
    this.resolveInfrastructureHazards();
    this.resolveRoadExitDestruction();
    this.resolveMedianHazardDestruction();
    if (this.controlLocked) {
      this.player.sprite.body.reset(this.player.sprite.x, this.player.sprite.y);
      this.player.sprite.body.setVelocity(0, 0);
      this.player.sprite.body.setAcceleration(0, 0);
    } else {
      this.player.update(currentInput, delta);
    }
    this.constrainPlayer();
    this.resolveAllSolidBodyContacts();
    this.hud.update();
    this.debugOverlay.update();
    this.harnessOverlay?.update(this.missionState);
  }

  getInputVector() {
    const left = this.moveState.left || this.cursors.left.isDown || this.keys.left.isDown;
    const right = this.moveState.right || this.cursors.right.isDown || this.keys.right.isDown;
    const up = this.moveState.up || this.cursors.up.isDown || this.keys.up.isDown;
    const down = this.moveState.down || this.cursors.down.isDown || this.keys.down.isDown;
    const keyboardX = Number(right) - Number(left);
    const keyboardY = Number(down) - Number(up);

    if (keyboardX !== 0 || keyboardY !== 0) {
      return { x: keyboardX, y: keyboardY };
    }

    if (this.pointerMoveInput.active) {
      const dx = this.pointerMoveInput.x - this.player.sprite.x;
      const dy = this.pointerMoveInput.y - this.player.sprite.y;
      const deadzone = 10;
      return {
        x: Math.abs(dx) > deadzone ? Phaser.Math.Clamp(dx / 80, -1, 1) : 0,
        y: Math.abs(dy) > deadzone ? Phaser.Math.Clamp(dy / 80, -1, 1) : 0,
      };
    }

    return {
      x: 0,
      y: 0,
    };
  }

  handlePointerMoveInput(pointer) {
    if (this.aiControlled || this.controlLocked || this.missionState?.isGameOver) {
      return;
    }

    this.pointerMoveInput.active = pointer.isDown;
    this.pointerMoveInput.x = pointer.worldX;
    this.pointerMoveInput.y = pointer.worldY;
  }

  clearPointerMoveInput() {
    this.pointerMoveInput.active = false;
  }

  shutdownInputHandlers() {
    this.input.keyboard.off('keydown', this.handleMovementKeyDown, this);
    this.input.keyboard.off('keyup', this.handleMovementKeyUp, this);
    this.input.off('pointerdown', this.handlePointerMoveInput, this);
    this.input.off('pointermove', this.handlePointerMoveInput, this);
    this.input.off('pointerup', this.clearPointerMoveInput, this);
    this.input.off('pointerupoutside', this.clearPointerMoveInput, this);
    this.keys?.debug?.off('down');
    this.keys?.mute?.off('down');
    this.keys?.restart?.off('down');
    this.input.keyboard.resetKeys();
  }

  updateMissionProgress() {
    for (const transition of this.mission.transitions ?? []) {
      if (!this.completedTransitions.has(transition.atSeconds)
        && this.missionState.elapsedTime >= transition.atSeconds) {
        this.completedTransitions.add(transition.atSeconds);
        this.startVehicleTransition(transition);
      }
    }

    if (this.missionState.elapsedTime >= this.mission.lengthSeconds) {
      this.completeMission();
    }
  }

  startVehicleTransition(transition) {
    this.controlLocked = true;
    this.player.sprite.body.setVelocity(0, 0);
    this.player.sprite.body.setAcceleration(0, 0);
    if (!this.isAttract) {
      this.hud.flashAlert(`${transition.label ?? 'TRANSITION'}: ${transition.mode.toUpperCase()} MODE.`);
    }

    const overlayColor = transition.mode === 'boat' ? 0x9fe7f5 : 0xc6c8b4;
    const flash = this.add.circle(this.player.sprite.x, this.player.sprite.y, 8, overlayColor, 0.5)
      .setDepth(90);
    this.tweens.add({
      targets: flash,
      scale: 4.2,
      alpha: 0,
      duration: 520,
      ease: 'Sine.easeOut',
      onComplete: () => flash.destroy(),
    });

    this.time.delayedCall(260, () => {
      this.player.setMode(transition.mode);
      this.missionState.playerMode = transition.mode;
    });

    this.time.delayedCall(720, () => {
      this.player.sprite.body.reset(this.player.sprite.x, this.player.sprite.y);
      this.player.sprite.body.setVelocity(0, 0);
      this.player.sprite.body.setAcceleration(0, 0);
      this.controlLocked = false;
    });
  }

  completeMission() {
    this.missionComplete = true;
    this.controlLocked = true;
    this.player.sprite.body.setVelocity(0, 0);
    this.player.sprite.body.setAcceleration(0, 0);
    this.missionEndSetpieceSystem.complete();
    if (!this.isAttract) {
      this.hud.flashAlert('EXTRACTION: Mission complete.');
    }
    this.time.delayedCall(850, () => {
      this.scene.start('DebriefScene', this.createDebriefPayload(true));
    });
  }

  createDebriefPayload(missionComplete = false) {
    return {
      missionComplete,
      autopilot: this.isAutopilot,
      missionId: this.missionId,
      worldId: this.worldId,
      score: this.missionState.score,
      distance: this.missionState.distance,
      elapsedTime: this.missionState.elapsedTime,
      enemiesDestroyed: this.missionState.enemiesDestroyed,
      eventHistory: this.missionState.eventHistory,
      playerTendencies: this.missionState.playerTendencies,
    };
  }

  handleMovementKeyDown(event) {
    this.setMovementKey(event.code, true);
  }

  handleMovementKeyUp(event) {
    this.setMovementKey(event.code, false);
  }

  setMovementKey(code, isDown) {
    switch (code) {
      case 'ArrowUp':
      case 'KeyW':
        this.moveState.up = isDown;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.moveState.down = isDown;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.moveState.left = isDown;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.moveState.right = isDown;
        break;
      default:
        break;
    }
  }

  constrainPlayer() {
    const body = this.player.sprite.body;
    const halfHeight = this.player.sprite.displayHeight / 2;
    const minX = this.player.sprite.displayWidth / 2;
    const maxX = GAME_WIDTH - this.player.sprite.displayWidth / 2;
    const minY = 116 + halfHeight;
    const maxY = GAME_HEIGHT - halfHeight - 18;

    if (!Number.isFinite(this.player.sprite.x) || !Number.isFinite(this.player.sprite.y)) {
      body.reset(PLAYER.startX, PLAYER.startY);
      body.setVelocity(0, 0);
      body.setAcceleration(0, 0);
      return;
    }

    const clampedX = Phaser.Math.Clamp(this.player.sprite.x, minX, maxX);
    const clampedY = Phaser.Math.Clamp(this.player.sprite.y, minY, maxY);

    if (clampedX !== this.player.sprite.x) {
      this.player.sprite.x = clampedX;
      body.setVelocityX(0);
    }

    if (clampedY !== this.player.sprite.y) {
      this.player.sprite.y = clampedY;
      body.setVelocityY(0);
    }
  }

  handleTrafficCollision(playerSprite, vehicleSprite) {
    if (this.controlLocked) {
      return;
    }

    if (this.time.now - this.lastCollisionAt < DAMAGE.collisionCooldownMs) {
      return;
    }

    this.lastCollisionAt = this.time.now;
    const vehicle = vehicleSprite.vehicle;
    const damageResult = this.applyPlayerDamage(vehicle.damageOnCollision, vehicle.type, 'Collision: civilian vehicle.');
    this.audioSystem.playCollision();
    if (damageResult.vehicleFallback || damageResult.vehicleDestroyed) {
      this.hud.update();
      return;
    }
    this.playLostLifeCue(damageResult);
    this.applyCollisionBounce(vehicleSprite);
    this.cameras.main.shake(140, 0.006);
    playerSprite.setTint(0xfff1a8);
    this.time.delayedCall(120, () => playerSprite.clearTint());
    this.hud.update();

    if (damageResult.gameOver && this.missionState.isGameOver) {
      this.startGameOver('Collision: civilian vehicle.');
    }
  }

  handleEnemyCollision(playerSprite, enemySprite) {
    if (this.controlLocked) {
      return;
    }

    if (this.time.now - this.lastCollisionAt < DAMAGE.collisionCooldownMs) {
      return;
    }

    this.lastCollisionAt = this.time.now;
    const enemy = enemySprite.vehicle;
    const damageResult = this.applyPlayerDamage(enemy.damageOnCollision, enemy.type, 'Collision: hostile vehicle.');
    this.audioSystem.playCollision();
    if (damageResult.vehicleFallback || damageResult.vehicleDestroyed) {
      this.hud.update();
      return;
    }
    this.playLostLifeCue(damageResult);
    this.applyCollisionBounce(enemySprite);
    this.cameras.main.shake(180, 0.008);
    playerSprite.setTint(0xff7777);
    this.time.delayedCall(140, () => playerSprite.clearTint());
    this.hud.update();

    if (damageResult.gameOver && this.missionState.isGameOver) {
      this.startGameOver('Collision: hostile vehicle.');
    }
  }

  handleSupportVehicleCollision(supportSprite, otherSprite) {
    const van = supportSprite.vehicle;
    if (!van || !supportSprite.body || !otherSprite.body) {
      return;
    }

    const direction = Math.sign(otherSprite.x - supportSprite.x) || (Phaser.Math.Between(0, 1) === 0 ? -1 : 1);
    if (!van.isDocking && !van.isCollected) {
      supportSprite.body.setVelocityX(-direction * SUPPORT.avoidanceSpeed);
    }
    otherSprite.body.setVelocityX(direction * 230);
    this.markCollisionDeflection(otherSprite.vehicle, 260);
    this.separateVehicleFromSupport(supportSprite, otherSprite);
  }

  resolveAllSolidBodyContacts() {
    const entries = this.getSolidBodyEntries();
    for (let pass = 0; pass < 2; pass += 1) {
      for (let firstIndex = 0; firstIndex < entries.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < entries.length; secondIndex += 1) {
          const first = entries[firstIndex];
          const second = entries[secondIndex];
          if (!first.sprite.active || !second.sprite.active) {
            continue;
          }
          if (!this.spritesIntersect(first.sprite, second.sprite, 0)) {
            continue;
          }
          this.resolveSolidBodyPair(first, second);
          if (this.controlLocked) {
            return;
          }
        }
      }
    }
  }

  getSolidBodyEntries() {
    const entries = [];
    if (this.player?.sprite?.active && !this.controlLocked) {
      entries.push({
        kind: 'player',
        sprite: this.player.sprite,
        entity: this.player,
        immovable: false,
      });
    }

    for (const vehicle of this.trafficSystem.vehicles) {
      if (vehicle.sprite.active && !vehicle.leavingRoad && !vehicle.terrainExplosionPending) {
        if (vehicle.isAtmospheric && this.roadSystem.getCarriagewayForX(vehicle.sprite.x) !== this.roadSystem.getCarriagewayForX(this.player.sprite.x)) {
          continue;
        }
        entries.push({
          kind: 'traffic',
          sprite: vehicle.sprite,
          entity: vehicle,
          immovable: false,
        });
      }
    }

    for (const enemy of this.combatSystem.enemies) {
      if (enemy.sprite.active && !enemy.leavingRoad && !enemy.terrainExplosionPending) {
        entries.push({
          kind: 'enemy',
          sprite: enemy.sprite,
          entity: enemy,
          immovable: false,
        });
      }
    }

    for (const support of this.supportSystem.vans) {
      if (support.sprite.active && !support.terrainExplosionPending) {
        entries.push({
          kind: 'support',
          sprite: support.sprite,
          entity: support,
          immovable: support.isDocking || support.isCollected,
        });
      }
    }

    return entries;
  }

  resolveSolidBodyPair(first, second) {
    const playerEntry = first.kind === 'player' ? first : (second.kind === 'player' ? second : null);
    const otherEntry = playerEntry === first ? second : first;

    if (playerEntry && otherEntry.kind === 'support') {
      const support = otherEntry.entity;
      if (!support.isCollected && !support.isDocking && !support.isReceding
        && !this.isCollisionTest && this.canDockWithSupport(otherEntry.sprite)) {
        this.beginSupportDocking(otherEntry.sprite);
        return;
      }
      if (support.isCollected || support.isDocking || support.isReceding) {
        return;
      }
      this.handleSupportPlayerCollision(otherEntry.sprite);
      return;
    }

    if (playerEntry && otherEntry.kind === 'traffic') {
      this.resolveSpriteSeparation(playerEntry, otherEntry);
      this.handleTrafficCollision(playerEntry.sprite, otherEntry.sprite);
      return;
    }

    if (playerEntry && otherEntry.kind === 'enemy') {
      this.resolveSpriteSeparation(playerEntry, otherEntry);
      this.handleEnemyCollision(playerEntry.sprite, otherEntry.sprite);
      return;
    }

    if (first.kind === 'support' || second.kind === 'support') {
      const supportEntry = first.kind === 'support' ? first : second;
      const vehicleEntry = supportEntry === first ? second : first;
      this.handleSupportVehicleCollision(supportEntry.sprite, vehicleEntry.sprite);
      return;
    }

    this.resolveSpriteSeparation(first, second);
  }

  resolveSupportVehicleContacts() {
    for (const van of this.supportSystem.vans) {
      if (!van.sprite.active || !van.sprite.body?.enable) {
        continue;
      }

      for (const vehicle of this.trafficSystem.vehicles) {
        if (vehicle.sprite.active && !vehicle.terrainExplosionPending && this.spritesIntersect(van.sprite, vehicle.sprite, 0)) {
          this.handleSupportVehicleCollision(van.sprite, vehicle.sprite);
        }
      }

      for (const enemy of this.combatSystem.enemies) {
        if (enemy.sprite.active && !enemy.terrainExplosionPending && this.spritesIntersect(van.sprite, enemy.sprite, 0)) {
          this.handleSupportVehicleCollision(van.sprite, enemy.sprite);
        }
      }
    }
  }

  resolveSpriteSeparation(first, second) {
    const firstBounds = first.sprite.getBounds();
    const secondBounds = second.sprite.getBounds();
    const overlapX = Math.min(firstBounds.right, secondBounds.right) - Math.max(firstBounds.left, secondBounds.left);
    const overlapY = Math.min(firstBounds.bottom, secondBounds.bottom) - Math.max(firstBounds.top, secondBounds.top);

    if (overlapX <= 0 || overlapY <= 0) {
      return;
    }

    const firstCenterX = firstBounds.x + firstBounds.width / 2;
    const secondCenterX = secondBounds.x + secondBounds.width / 2;
    const firstCenterY = firstBounds.y + firstBounds.height / 2;
    const secondCenterY = secondBounds.y + secondBounds.height / 2;
    const pushX = firstCenterX <= secondCenterX ? -1 : 1;
    const pushY = firstCenterY <= secondCenterY ? -1 : 1;
    const firstWeight = first.immovable ? 0 : (second.immovable ? 1 : 0.5);
    const secondWeight = second.immovable ? 0 : (first.immovable ? 1 : 0.5);

    const isHorizontalSideContact = overlapX <= overlapY;
    const ordinaryKnockbackScale = isHorizontalSideContact ? 1 : 0.5;

    if (isHorizontalSideContact) {
      const separation = overlapX + 3;
      first.sprite.x += pushX * separation * firstWeight;
      second.sprite.x -= pushX * separation * secondWeight;
      this.applySeparationVelocity(first.sprite, pushX, 0, firstWeight, ordinaryKnockbackScale);
      this.applySeparationVelocity(second.sprite, -pushX, 0, secondWeight, ordinaryKnockbackScale);
    } else {
      const separation = overlapY + 3;
      first.sprite.y += pushY * separation * firstWeight;
      second.sprite.y -= pushY * separation * secondWeight;
      this.applySeparationVelocity(first.sprite, 0, pushY, firstWeight, ordinaryKnockbackScale);
      this.applySeparationVelocity(second.sprite, 0, -pushY, secondWeight, ordinaryKnockbackScale);
    }

    this.syncSpriteBody(first.sprite);
    this.syncSpriteBody(second.sprite);
    this.markCollisionDeflection(first.entity, (first.kind === 'player' ? 140 : 220) * ordinaryKnockbackScale);
    this.markCollisionDeflection(second.entity, (second.kind === 'player' ? 140 : 220) * ordinaryKnockbackScale);
  }

  applySeparationVelocity(sprite, xDirection, yDirection, weight, knockbackScale = 1) {
    if (!sprite.body || weight === 0) {
      return;
    }

    if (xDirection !== 0) {
      sprite.body.setVelocityX(xDirection * Math.max(110, Math.abs(sprite.body.velocity.x)) * knockbackScale);
    }
    if (yDirection !== 0) {
      const ySpeed = yDirection < 0 ? -160 : Math.max(150, sprite.body.velocity.y);
      sprite.body.setVelocityY(ySpeed * knockbackScale);
    }
  }

  syncSpriteBody(sprite) {
    if (sprite.body) {
      sprite.body.updateFromGameObject();
    }
  }

  markCollisionDeflection(entity, durationMs = 220) {
    if (!entity || entity.isDocking || entity.isCollected) {
      return;
    }

    entity.bounceUntil = Math.max(entity.bounceUntil ?? 0, this.time.now + durationMs);
  }

  separateVehicleFromSupport(supportSprite, otherSprite) {
    const supportBounds = supportSprite.getBounds();
    const otherBounds = otherSprite.getBounds();
    const overlapX = Math.min(supportBounds.right, otherBounds.right) - Math.max(supportBounds.left, otherBounds.left);
    const overlapY = Math.min(supportBounds.bottom, otherBounds.bottom) - Math.max(supportBounds.top, otherBounds.top);

    if (overlapX <= 0 || overlapY <= 0) {
      return;
    }

    if (overlapX < overlapY) {
      const pushLeft = (otherBounds.x + otherBounds.width / 2) < (supportBounds.x + supportBounds.width / 2);
      const targetX = pushLeft
        ? supportBounds.left - otherBounds.width / 2 - 3
        : supportBounds.right + otherBounds.width / 2 + 3;
      otherSprite.x = Phaser.Math.Clamp(targetX, ROAD.left - 54, ROAD.right + 54);
    } else {
      const pushUp = (otherBounds.y + otherBounds.height / 2) < (supportBounds.y + supportBounds.height / 2);
      otherSprite.y = pushUp
        ? supportBounds.top - otherBounds.height / 2 - 3
        : supportBounds.bottom + otherBounds.height / 2 + 3;
      otherSprite.body.setVelocityY(pushUp ? -Math.max(120, Math.abs(otherSprite.body.velocity.y)) : Math.max(160, otherSprite.body.velocity.y));
    }

    otherSprite.body.updateFromGameObject();
    this.markCollisionDeflection(otherSprite.vehicle, 260);
  }

  resolvePlayerVehicleContacts() {
    if (this.controlLocked || this.time.now - this.lastCollisionAt < DAMAGE.collisionCooldownMs) {
      return;
    }

    const traffic = this.trafficSystem.vehicles.find((candidate) => {
      return candidate.sprite.active && this.physicsBodiesIntersect(this.player.sprite, candidate.sprite, 0);
    });

    if (traffic) {
      this.handleTrafficCollision(this.player.sprite, traffic.sprite);
      return;
    }

    const enemy = this.combatSystem.enemies.find((candidate) => {
      return candidate.sprite.active && this.physicsBodiesIntersect(this.player.sprite, candidate.sprite, 0);
    });

    if (enemy) {
      this.handleEnemyCollision(this.player.sprite, enemy.sprite);
    }
  }

  resolveProjectileVehicleHits() {
    for (const projectile of [...this.combatSystem.projectiles]) {
      if (!projectile.sprite.active) {
        continue;
      }

      const projectileBounds = projectile.sprite.getBounds();
      const enemy = this.combatSystem.enemies.find((candidate) => {
        return candidate.sprite.active
          && this.rectIntersectsSprite(projectileBounds, candidate.sprite, 0);
      });

      if (enemy) {
        this.combatSystem.handleProjectileHit(projectile.sprite, enemy.sprite);
        continue;
      }

      const support = this.supportSystem.vans.find((candidate) => {
        return !candidate.isCollected
          && candidate.sprite.active
          && this.rectIntersectsSprite(projectileBounds, candidate.sprite, 0);
      });

      if (support) {
        this.handleSupportShot(projectile.sprite, support.sprite);
        continue;
      }

      const civilian = this.trafficSystem.vehicles.find((candidate) => {
        return candidate.sprite.active
          && this.rectIntersectsSprite(projectileBounds, candidate.sprite, 0);
      });

      if (civilian) {
        this.handleCivilianShot(projectile.sprite, civilian.sprite);
      }
    }
  }

  resolveSupportDockingContacts() {
    if (this.controlLocked || this.isCollisionTest) {
      return;
    }

    const support = this.supportSystem.vans.find((candidate) => {
      return !candidate.isCollected
        && candidate.sprite.active
        && this.spritesIntersect(this.player.sprite, candidate.sprite, 0);
    });

    if (!support) {
      return;
    }

    if (this.canDockWithSupport(support.sprite)) {
      this.beginSupportDocking(support.sprite);
      return;
    }

    this.handleSupportPlayerCollision(support.sprite);
  }

  handleSupportPlayerCollision(supportSprite) {
    if (this.controlLocked) {
      return;
    }

    this.separateVehicleFromSupport(supportSprite, this.player.sprite);
    const direction = new Phaser.Math.Vector2(
      this.player.sprite.x - supportSprite.x,
      this.player.sprite.y - supportSprite.y,
    );
    if (direction.lengthSq() === 0) {
      direction.set(0, 1);
    }
    direction.normalize();
    this.player.bounceUntil = this.time.now + 180;
    this.player.sprite.body.setVelocity(
      direction.x * DAMAGE.bounceVelocity * 0.78,
      direction.y * DAMAGE.bounceVelocity * 0.78,
    );
  }

  resolveRoadExitDestruction() {
    if (this.player.mode === 'boat') {
      return;
    }

    this.updatePlayerRoadExit();

    for (const vehicle of [...this.trafficSystem.vehicles]) {
      this.updateRoadExitVehicle(vehicle, (sprite) => {
        this.scheduleTerrainExplosion(vehicle, {
          delayMs: 320,
          size: 'medium',
          scale: 0.62,
          smokeScale: 0.5,
          explosionPoint: this.getRoadExitExplosionPoint(sprite),
          remove: () => this.trafficSystem.removeVehicle(sprite),
          event: () => ({
            type: 'vehicleRoadExitDestroyed',
            vehicleType: vehicle.civilianType?.id ?? vehicle.type,
            at: this.missionState.elapsedTime,
          }),
        });
      });
    }

    for (const enemy of [...this.combatSystem.enemies]) {
      if (enemy.enemyType?.chassis === 'boat') {
        continue;
      }
      this.updateRoadExitVehicle(enemy, (sprite) => {
        this.scheduleTerrainExplosion(enemy, {
          delayMs: 300,
          size: 'medium',
          scale: 0.72,
          smokeScale: 0.58,
          explosionPoint: this.getRoadExitExplosionPoint(sprite),
          remove: () => this.combatSystem.removeEnemy(sprite),
          event: () => ({
            type: 'enemyRoadExitDestroyed',
            enemyType: enemy.enemyType?.id ?? 'unknown',
            at: this.missionState.elapsedTime,
          }),
        });
      });
    }
  }

  updatePlayerRoadExit() {
    if (this.controlLocked || this.gameOverPending || this.missionState.isGameOver) {
      return;
    }

    if (this.player.leavingRoad) {
      if (this.isFullyOffRoad(this.player.sprite)) {
        this.destroyPlayerOffRoad();
      }
      return;
    }

    const bounds = this.player.sprite.getBounds();
    const leftHalfOut = this.player.sprite.x < ROAD.left && bounds.right > ROAD.left;
    const rightHalfOut = this.player.sprite.x > ROAD.right && bounds.left < ROAD.right;
    if (!leftHalfOut && !rightHalfOut) {
      return;
    }

    const direction = leftHalfOut ? -1 : 1;
    this.player.leavingRoad = true;
    this.player.bounceUntil = this.time.now + 1800;
    this.player.sprite.body.setVelocity(direction * 280, Math.max(110, this.player.sprite.body.velocity.y));
    this.player.sprite.setAngle(direction * 14);
    if (!this.isAttract) {
      this.hud.flashAlert('ROAD EDGE: Vehicle leaving roadway.');
    }
  }

  resolveMedianHazardDestruction() {
    const hazards = this.roadSystem.getMedianHazards();
    if (hazards.length === 0 || this.player.mode === 'boat') {
      return;
    }

    if (!this.controlLocked && this.spriteCommittedToMedian(this.player.sprite, hazards)) {
      this.destroyPlayerInMedian();
      return;
    }

    for (const vehicle of [...this.trafficSystem.vehicles]) {
      if (vehicle.sprite.active && this.spriteCommittedToMedian(vehicle.sprite, hazards)) {
        this.scheduleTerrainExplosion(vehicle, {
          delayMs: 360,
          size: 'medium',
          scale: 0.68,
          smokeScale: 0.52,
          remove: () => this.trafficSystem.removeVehicle(vehicle.sprite),
          event: () => ({
            type: 'vehicleMedianDestroyed',
            vehicleType: vehicle.civilianType?.id ?? vehicle.type,
            at: this.missionState.elapsedTime,
          }),
        });
      }
    }

    for (const enemy of [...this.combatSystem.enemies]) {
      if (enemy.sprite.active && this.spriteCommittedToMedian(enemy.sprite, hazards)) {
        this.scheduleTerrainExplosion(enemy, {
          delayMs: 340,
          size: 'medium',
          scale: 0.78,
          smokeScale: 0.58,
          remove: () => this.combatSystem.removeEnemy(enemy.sprite),
          event: () => ({
            type: 'enemyMedianDestroyed',
            enemyType: enemy.enemyType?.id ?? 'unknown',
            at: this.missionState.elapsedTime,
          }),
        });
      }
    }

    for (const van of [...this.supportSystem.vans]) {
      if (van.sprite.active && !van.isDocking && this.spriteCommittedToMedian(van.sprite, hazards)) {
        this.scheduleTerrainExplosion(van, {
          delayMs: 360,
          size: 'medium',
          scale: 0.86,
          smokeScale: 0.68,
          remove: () => this.supportSystem.removeVan(van.sprite),
          event: () => ({
            type: 'supportMedianDestroyed',
            isDecoy: van.isDecoy,
            at: this.missionState.elapsedTime,
          }),
        });
      }
    }
  }

  resolveInfrastructureHazards() {
    const hazards = this.infrastructurePressureSystem?.getHazardRects() ?? [];
    if (hazards.length === 0 || this.player.mode === 'boat') {
      return;
    }

    if (!this.controlLocked && !this.gameOverPending) {
      const hitHazard = hazards.find((hazard) => this.rectIntersectsSprite(hazard, this.player.sprite, -3));
      if (hitHazard) {
        this.handlePlayerInfrastructureHit(hitHazard);
      }
    }

    for (const vehicle of [...this.trafficSystem.vehicles]) {
      if (!vehicle.sprite.active || vehicle.terrainExplosionPending) {
        continue;
      }
      if (hazards.some((hazard) => this.rectIntersectsSprite(hazard, vehicle.sprite, -2))) {
        this.scheduleTerrainExplosion(vehicle, {
          delayMs: 220,
          size: 'medium',
          scale: 0.64,
          smokeScale: 0.52,
          remove: () => this.trafficSystem.removeVehicle(vehicle.sprite),
          event: () => ({
            type: 'vehicleInfrastructureDestroyed',
            vehicleType: vehicle.civilianType?.id ?? vehicle.type,
            segmentId: this.missionState.currentSegmentId,
            at: this.missionState.elapsedTime,
          }),
        });
      }
    }

    for (const enemy of [...this.combatSystem.enemies]) {
      if (!enemy.sprite.active || enemy.terrainExplosionPending) {
        continue;
      }
      if (hazards.some((hazard) => this.rectIntersectsSprite(hazard, enemy.sprite, -2))) {
        this.scheduleTerrainExplosion(enemy, {
          delayMs: 200,
          size: 'medium',
          scale: 0.72,
          smokeScale: 0.58,
          remove: () => this.combatSystem.removeEnemy(enemy.sprite),
          event: () => ({
            type: 'enemyInfrastructureDestroyed',
            enemyType: enemy.enemyType?.id ?? 'unknown',
            segmentId: this.missionState.currentSegmentId,
            at: this.missionState.elapsedTime,
          }),
        });
      }
    }

    for (const van of [...this.supportSystem.vans]) {
      if (!van.sprite.active || van.isDocking || van.isCollected || van.terrainExplosionPending) {
        continue;
      }
      if (hazards.some((hazard) => this.rectIntersectsSprite(hazard, van.sprite, -2))) {
        this.scheduleTerrainExplosion(van, {
          delayMs: 220,
          size: 'medium',
          scale: 0.86,
          smokeScale: 0.68,
          remove: () => this.supportSystem.removeVan(van.sprite),
          event: () => ({
            type: 'supportInfrastructureDestroyed',
            isDecoy: van.isDecoy,
            segmentId: this.missionState.currentSegmentId,
            at: this.missionState.elapsedTime,
          }),
        });
      }
    }
  }

  handlePlayerInfrastructureHit(hazard) {
    if (this.time.now - this.lastInfrastructureHitAt < DAMAGE.collisionCooldownMs) {
      return;
    }

    this.lastInfrastructureHitAt = this.time.now;
    const damageResult = this.applyPlayerDamage(DAMAGE.infrastructureCollision, 'infrastructure', 'Infrastructure impact: vehicle destroyed.');
    this.audioSystem.playCollision();
    if (damageResult.vehicleFallback || damageResult.vehicleDestroyed) {
      this.hud.update();
      return;
    }
    this.playLostLifeCue(damageResult);
    this.effectsSystem.playExplosion(this.player.sprite.x, this.player.sprite.y - 8, 'small', {
      scale: 0.42,
      smokeScale: 0.34,
      smoke: false,
    });

    const hazardCenterX = hazard.x + hazard.width / 2;
    const pushDirection = this.player.sprite.x < hazardCenterX ? -1 : 1;
    this.player.bounceUntil = this.time.now + 220;
    this.player.sprite.body.setVelocity(pushDirection * DAMAGE.bounceVelocity * 0.78, 150);
    this.player.sprite.setTint(0xffd17a);
    this.time.delayedCall(130, () => this.player.sprite.clearTint());
    if (!this.isAttract) {
      this.hud.flashAlert(`${this.infrastructurePressureSystem.getWarningLabel() ?? 'OBSTRUCTION'}: Impact.`);
    }
    this.hud.update();

    if (damageResult.gameOver && this.missionState.isGameOver) {
      this.startGameOver('Infrastructure impact: vehicle destroyed.');
    }
  }

  scheduleTerrainExplosion(vehicle, config = {}) {
    const sprite = vehicle.sprite;
    if (!sprite?.active || vehicle.terrainExplosionPending) {
      return;
    }

    const explosionPoint = config.explosionPoint ?? { x: sprite.x, y: sprite.y };
    vehicle.terrainExplosionPending = true;
    vehicle.leavingRoad = true;
    vehicle.bounceUntil = this.time.now + (config.delayMs ?? 320) + 600;
    if (sprite.body) {
      sprite.body.checkCollision.none = true;
      sprite.body.setVelocity(
        Phaser.Math.Clamp(sprite.body.velocity.x * 0.35, -90, 90),
        Phaser.Math.Clamp(sprite.body.velocity.y * 0.25, -80, 120),
      );
    }
    sprite.setTint(0xffb36b);

    this.time.delayedCall(config.delayMs ?? 320, () => {
      if (!sprite.active) {
        return;
      }

      this.effectsSystem.playExplosion(explosionPoint.x, explosionPoint.y, config.size ?? 'medium', {
        scale: config.scale ?? 0.72,
        smokeScale: config.smokeScale ?? 0.58,
      });
      config.remove?.();
      const event = config.event?.();
      if (event) {
        this.missionState.eventHistory.push(event);
      }
    });
  }

  getRoadExitExplosionPoint(sprite) {
    const bounds = sprite.getBounds();
    const exitingLeft = bounds.right < ROAD.left || sprite.x < ROAD.left;
    const exitingRight = bounds.left > ROAD.right || sprite.x > ROAD.right;
    const edgeX = exitingLeft ? ROAD.left + 10 : exitingRight ? ROAD.right - 10 : sprite.x;
    return {
      x: Phaser.Math.Clamp(edgeX, ROAD.left + 10, ROAD.right - 10),
      y: Phaser.Math.Clamp(sprite.y, 56, GAME_HEIGHT - 56),
    };
  }

  spriteCommittedToMedian(sprite, hazards) {
    const bounds = sprite.getBounds();
    return hazards.some((hazard) => {
      const overlapX = Math.min(bounds.right, hazard.right) - Math.max(bounds.left, hazard.left);
      if (overlapX <= 0) {
        return false;
      }
      const centerX = bounds.x + bounds.width / 2;
      return (centerX > hazard.left && centerX < hazard.right)
        || overlapX >= bounds.width * 0.42;
    });
  }

  destroyPlayerInMedian() {
    const damageResult = this.applyPlayerDamage(this.missionState.maxPlayerDamage, 'median', 'Median impact: vehicle destroyed.');
    this.audioSystem.playCollision();
    this.playLostLifeCue(damageResult);
    this.hud.update();
    if (damageResult.gameOver) {
      this.startGameOver('Median impact: vehicle destroyed.');
    }
  }

  destroyPlayerOffRoad() {
    const damageResult = this.applyPlayerDamage(this.missionState.maxPlayerDamage, 'roadExit', 'Road departure: vehicle destroyed.');
    this.audioSystem.playCollision();
    this.playLostLifeCue(damageResult);
    this.hud.update();
    if (damageResult.gameOver) {
      this.startGameOver('Road departure: vehicle destroyed.');
    }
  }

  updateRoadExitVehicle(vehicle, onDestroyed) {
    if (!vehicle.sprite.active || vehicle.leavingRoad) {
      if (vehicle.leavingRoad && this.isFullyOffRoad(vehicle.sprite)) {
        onDestroyed(vehicle.sprite);
      }
      return;
    }

    const bounds = vehicle.sprite.getBounds();
    const leftHalfOut = vehicle.sprite.x < ROAD.left && bounds.right > ROAD.left;
    const rightHalfOut = vehicle.sprite.x > ROAD.right && bounds.left < ROAD.right;
    if (!leftHalfOut && !rightHalfOut) {
      return;
    }

    const direction = leftHalfOut ? -1 : 1;
    vehicle.leavingRoad = true;
    vehicle.bounceUntil = this.time.now + 1800;
    vehicle.sprite.body.checkCollision.none = true;
    vehicle.sprite.body.setVelocity(direction * 250, Math.max(130, vehicle.sprite.body.velocity.y));
    vehicle.sprite.setAngle(direction * 14);
  }

  isFullyOffRoad(sprite) {
    const bounds = sprite.getBounds();
    return bounds.right < ROAD.left || bounds.left > ROAD.right;
  }

  resolveCollisionTestSupportContacts() {
    const support = this.supportSystem.vans.find((candidate) => {
      return !candidate.isCollected
        && candidate.sprite.active
        && this.spritesIntersect(this.player.sprite, candidate.sprite, -4);
    });

    if (support) {
      this.handleSupportPickup(this.player.sprite, support.sprite);
    }
  }

  rectIntersectsSprite(rectangle, sprite, padding = 0) {
    const bounds = sprite.getBounds();
    Phaser.Geom.Rectangle.Inflate(bounds, padding, padding);
    return Phaser.Geom.Intersects.RectangleToRectangle(rectangle, bounds);
  }

  spritesIntersect(firstSprite, secondSprite, padding = 0) {
    const firstBounds = firstSprite.getBounds();
    const secondBounds = secondSprite.getBounds();
    Phaser.Geom.Rectangle.Inflate(firstBounds, padding, padding);
    Phaser.Geom.Rectangle.Inflate(secondBounds, padding, padding);
    return Phaser.Geom.Intersects.RectangleToRectangle(firstBounds, secondBounds);
  }

  physicsBodiesIntersect(firstSprite, secondSprite, padding = 0) {
    const firstBounds = this.getBodyBounds(firstSprite);
    const secondBounds = this.getBodyBounds(secondSprite);
    Phaser.Geom.Rectangle.Inflate(firstBounds, padding, padding);
    Phaser.Geom.Rectangle.Inflate(secondBounds, padding, padding);
    return Phaser.Geom.Intersects.RectangleToRectangle(firstBounds, secondBounds);
  }

  getBodyBounds(sprite) {
    const body = sprite.body;
    return new Phaser.Geom.Rectangle(body.x, body.y, body.width, body.height);
  }

  getFrontContactPoint(sprite) {
    const bounds = sprite.getBounds();
    return {
      x: bounds.centerX,
      y: bounds.top,
    };
  }

  handleCivilianShot(projectileSprite, vehicleSprite) {
    if (!projectileSprite.active || !vehicleSprite.active) {
      return;
    }

    this.combatSystem.consumeProjectile(projectileSprite);
    this.effectsSystem.playExplosion(vehicleSprite.x, vehicleSprite.y, 'medium', {
      scale: 0.72,
      smokeScale: 0.62,
    });
    const vehicle = vehicleSprite.vehicle;
    const scoreDelta = vehicle?.scorePenalty ? -vehicle.scorePenalty : 0;
    this.trafficSystem.removeVehicle(vehicleSprite);
    this.missionState.addScore(scoreDelta);
    if (scoreDelta !== 0) {
      this.showFloatingScore(vehicleSprite.x, vehicleSprite.y, scoreDelta, 'civilian');
    }
    this.missionState.eventHistory.push({
      type: vehicle?.isCivilian ? 'civilianDestroyed' : 'obstacleDestroyed',
      vehicleType: vehicle?.civilianType?.id ?? 'unknown',
      score: scoreDelta,
      at: this.missionState.elapsedTime,
    });
    if (vehicle?.isCivilian && !this.isAttract) {
      this.hud.flashAlert('CIVILIAN: Unauthorized fire.');
    }
  }

  applyCollisionBounce(otherSprite) {
    const playerBody = this.player.sprite.body;
    const otherBody = otherSprite.body;
    this.player.bounceUntil = this.time.now + 220;
    if (otherSprite.vehicle) {
      this.markCollisionDeflection(otherSprite.vehicle, 320);
    }
    const direction = new Phaser.Math.Vector2(
      this.player.sprite.x - otherSprite.x,
      this.player.sprite.y - otherSprite.y,
    );

    if (direction.lengthSq() === 0) {
      direction.set(Phaser.Math.Between(0, 1) === 0 ? -1 : 1, -0.35);
    }

    direction.normalize();
    playerBody.setVelocity(
      direction.x * DAMAGE.bounceVelocity,
      direction.y * DAMAGE.bounceVelocity,
    );
    otherBody.setVelocity(
      -direction.x * DAMAGE.bounceVelocity * 0.75,
      Math.max(120, -direction.y * DAMAGE.bounceVelocity * 0.75),
    );
  }

  showFloatingScore(x, y, amount, source) {
    const isPenalty = amount < 0;
    const text = this.add.text(x, y, `${amount > 0 ? '+' : ''}${amount}`, {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '16px',
      color: isPenalty ? '#ff5c5c' : '#79ff9b',
      stroke: '#07100d',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(120);

    text.setAlpha(source === 'civilian' ? 0.96 : 1);
    this.tweens.add({
      targets: text,
      y: y - 34,
      alpha: 0,
      scale: source === 'civilian' ? 0.92 : 1.08,
      duration: 850,
      ease: 'Sine.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  startGameOver(causeText = null) {
    if (this.gameOverPending) {
      return;
    }
    this.gameOverPending = true;

    if (this.isHarness) {
      this.finishHarnessRun('destroyed');
      return;
    }

    if (this.isAttract) {
      this.scene.restart(this.sceneConfig);
      return;
    }

    this.controlLocked = true;
    this.player.sprite.body.setVelocity(0, 0);
    this.player.sprite.body.setAcceleration(0, 0);
    this.player.sprite.setVisible(false);
    this.audioSystem.playGameOver();
    this.showDeathAlert(causeText ?? this.getGameOverCauseText());
    this.effectsSystem.playExplosion(this.player.sprite.x, this.player.sprite.y, 'large', {
      scale: 1.05,
      smokeScale: 0.82,
      depth: 120,
      onComplete: () => {
        this.time.delayedCall(650, () => {
          this.scene.start('DebriefScene', {
            ...this.createDebriefPayload(false),
          });
        });
      },
    });
  }

  applyPlayerDamage(amount, source, causeText = null) {
    if (this.playerInvincibleUntil && this.time.now < this.playerInvincibleUntil) {
      return { damaged: false, lifeLost: false, gameOver: false, invincible: true };
    }

    const damageResult = this.missionState.applyDamage(amount, source);
    if (!damageResult.gameOver) {
      return damageResult;
    }

    if (this.player.mode === 'boat') {
      return damageResult;
    }

    this.missionState.isGameOver = false;
    if (this.player.mode === 'car') {
      this.beginCarDestroyedFallback(causeText);
      return { ...damageResult, lifeLost: false, gameOver: false, vehicleFallback: true };
    }

    if (this.player.mode === 'motorcycle') {
      this.beginMotorcycleDestroyed(causeText);
      return { ...damageResult, lifeLost: false, gameOver: false, vehicleDestroyed: true };
    }

    return damageResult;
  }

  beginCarDestroyedFallback(causeText = null) {
    if (this.playerTransitioning) {
      return;
    }
    this.playerTransitioning = true;
    this.controlLocked = true;
    const { x, y } = this.player.sprite;
    this.prepareDestroyedPlayer();
    this.effectsSystem.playExplosion(x, y, 'large', {
      scale: 1.02,
      smokeScale: 0.78,
      depth: 120,
    });
    this.hud.flashAlert('Player Vehicle Destroyed', PLAYER.destroyedRespawnDelayMs);
    this.missionState.eventHistory.push({
      type: 'playerVehicleFallback',
      from: 'car',
      to: 'motorcycle',
      at: this.missionState.elapsedTime,
    });
    this.time.delayedCall(PLAYER.destroyedRespawnDelayMs, () => {
      const spawnLane = this.getPlayerRespawnLane('motorcycle');
      const spawnX = this.getRoadLaneCenters()[spawnLane] ?? PLAYER.startX;
      const supportLane = this.getAdjacentSupportLane(spawnLane);
      this.player.sprite.setPosition(spawnX, PLAYER.startY);
      this.setPlayerMode('motorcycle', { invincible: true });
      this.supportSystem.requestPrioritySupport(650, {
        lane: supportLane,
        x: this.getRoadLaneCenters()[supportLane],
      });
      this.playerTransitioning = false;
      this.controlLocked = false;
      this.hud.flashAlert('EMERGENCY BIKE: Find upgrade truck.');
    });
  }

  getPlayerRespawnLane(mode = this.player.mode) {
    const laneCenters = this.getRoadLaneCenters();
    if (mode === 'motorcycle') {
      return Math.min(laneCenters.length - 1, Math.ceil(laneCenters.length / 2));
    }

    return this.getNearestRoadLane(PLAYER.startX);
  }

  getAdjacentSupportLane(playerLane) {
    const laneCenters = this.getRoadLaneCenters();
    if (laneCenters.length <= 1) {
      return playerLane;
    }

    return playerLane > 0 ? playerLane - 1 : playerLane + 1;
  }

  getNearestRoadLane(x) {
    const laneCenters = this.getRoadLaneCenters();
    return laneCenters.reduce((bestLane, laneX, lane) => (
      Math.abs(laneX - x) < Math.abs(laneCenters[bestLane] - x) ? lane : bestLane
    ), 0);
  }

  getRoadLaneCenters() {
    return this.roadSystem?.getLaneCentersForTarget('player_side', PLAYER.startX)
      ?? Array.from({ length: ROAD.laneCount }, (_, index) => (
        ROAD.left + ((ROAD.right - ROAD.left) / ROAD.laneCount) * (index + 0.5)
      ));
  }

  beginMotorcycleDestroyed(causeText = null) {
    if (this.playerTransitioning) {
      return;
    }
    this.playerTransitioning = true;
    this.controlLocked = true;
    const { x, y } = this.player.sprite;
    this.prepareDestroyedPlayer();
    this.effectsSystem.playExplosion(x, y, 'medium', {
      scale: 0.86,
      smokeScale: 0.58,
      depth: 120,
    });
    const livesRemaining = this.missionState.loseLife();
    this.audioSystem.playLostLife();
    this.hud.update();
    this.hud.flashAlert('Player Vehicle Destroyed', PLAYER.destroyedRespawnDelayMs);
    if (livesRemaining <= 0) {
      this.missionState.isGameOver = false;
      this.time.delayedCall(PLAYER.destroyedRespawnDelayMs, () => {
        this.missionState.isGameOver = true;
        this.startGameOver(causeText ?? 'Motorcycle destroyed.');
      });
      return;
    }
    this.time.delayedCall(PLAYER.destroyedRespawnDelayMs, () => {
      this.player.sprite.setPosition(PLAYER.startX, PLAYER.startY);
      this.setPlayerMode('car', { invincible: true });
      this.playerTransitioning = false;
      this.controlLocked = false;
      this.hud.flashAlert('RESPAWN: Interceptor deployed.');
    });
  }

  prepareDestroyedPlayer() {
    const body = this.player.sprite.body;
    this.player.sprite.setVisible(false);
    this.player.sprite.clearTint();
    this.player.sprite.setAlpha(1);
    this.player.sprite.setAngle(0);
    this.player.sprite.body.setVelocity(0, 0);
    this.player.sprite.body.setAcceleration(0, 0);
    body.checkCollision.none = true;
    body.enable = false;
    this.clearPointerMoveInput();
  }

  setPlayerMode(mode, { invincible = false } = {}) {
    this.player.setMode(mode);
    this.missionState.setPlayerMode(mode);
    this.player.sprite.setVisible(true);
    this.player.sprite.clearTint();
    this.player.sprite.setAngle(0);
    this.player.sprite.body.enable = true;
    this.player.sprite.body.checkCollision.none = false;
    this.player.sprite.body.reset(this.player.sprite.x, this.player.sprite.y);
    this.player.sprite.body.setVelocity(0, 0);
    this.player.sprite.body.setAcceleration(0, 0);
    this.player.leavingRoad = false;
    this.player.bounceUntil = 0;
    if (invincible) {
      this.startPlayerInvincibility(PLAYER_MODES[mode]?.invincibleMsOnSpawn ?? 1600);
    } else {
      this.playerInvincibleUntil = 0;
      this.invincibilityTween?.stop();
      this.player.sprite.setAlpha(1);
    }
    this.hud.update();
  }

  startPlayerInvincibility(durationMs) {
    this.playerInvincibleUntil = this.time.now + durationMs;
    this.invincibilityTween?.stop();
    this.player.sprite.setAlpha(1);
    this.invincibilityTween = this.tweens.add({
      targets: this.player.sprite,
      alpha: 0.32,
      duration: 110,
      yoyo: true,
      repeat: Math.max(1, Math.floor(durationMs / 220)),
      onComplete: () => {
        this.player.sprite.setAlpha(1);
        this.playerInvincibleUntil = 0;
      },
    });
  }

  playLostLifeCue(damageResult) {
    if (!damageResult?.lifeLost || damageResult.gameOver || this.isAttract || this.isHarness) {
      return;
    }
    if (this.time.now - this.lastLostLifeSoundAt < 350) {
      return;
    }
    this.lastLostLifeSoundAt = this.time.now;
    this.audioSystem.playLostLife();
  }

  showDeathAlert(message) {
    const panel = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 330, 84, 0x120f0f, 0.9)
      .setDepth(220)
      .setStrokeStyle(2, 0xff5c5c, 0.95);
    const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `VEHICLE LOST\n${message}`, {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '15px',
      color: '#ffd7d7',
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5).setDepth(221);

    this.tweens.add({
      targets: [panel, text],
      alpha: { from: 0, to: 1 },
      duration: 180,
      ease: 'Sine.easeOut',
    });
  }

  getGameOverCauseText() {
    const lastDamage = [...this.missionState.eventHistory]
      .reverse()
      .find((event) => event.type === 'playerDamage');
    const source = lastDamage?.source ?? 'unknown';
    const causes = {
      median: 'Median impact: vehicle destroyed.',
      mine: 'Mine detonation: vehicle destroyed.',
      enemyProjectile: 'Hostile fire: vehicle destroyed.',
      bullet: 'Hostile gunfire: vehicle destroyed.',
      cannon: 'Cannon impact: vehicle destroyed.',
      rocket: 'Rocket impact: vehicle destroyed.',
      infrastructure: 'Infrastructure impact: vehicle destroyed.',
      civilian: 'Collision: civilian vehicle.',
      enemy: 'Collision: hostile vehicle.',
      supportFriendlyFire: 'Support reprisal: vehicle destroyed.',
    };
    return causes[source] ?? 'Critical damage: vehicle destroyed.';
  }

  restartCurrentMode() {
    if (this.isHarness) {
      this.finishHarnessRun('manualRestart');
      return;
    }

    this.scene.restart(this.sceneConfig);
  }

  finishHarnessRun(reason) {
    const summary = this.createRunSummary(reason);
    this.harnessState.runs.push(summary);
    console.log('[AI Harness] run complete', summary);
    this.reportHarnessRun(summary);

    if (this.harnessState.runs.length >= this.harnessState.maxRuns) {
      this.showHarnessSummary();
      this.scene.pause();
      return;
    }

    this.scene.restart({
      ...this.sceneConfig,
      aiControlled: true,
      harness: true,
      harnessState: this.harnessState,
    });
  }

  reportHarnessRun(summary) {
    if (!this.harnessState?.reportUrl) {
      return;
    }

    try {
      const body = JSON.stringify(summary);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(this.harnessState.reportUrl, body);
        return;
      }
      fetch(this.harnessState.reportUrl, {
        method: 'POST',
        mode: 'no-cors',
        body,
      });
    } catch (error) {
      console.warn('[AI Harness] report failed', error);
    }
  }

  createRunSummary(reason) {
    return {
      reason,
      difficulty: this.missionState.difficulty.label,
      missionId: this.missionId,
      score: this.missionState.score,
      distance: Math.floor(this.missionState.distance),
      elapsedTime: Number(this.missionState.elapsedTime.toFixed(2)),
      damage: this.missionState.playerDamage,
      maxDamage: this.missionState.maxPlayerDamage,
      livesRemaining: this.missionState.playerLives,
      finalMode: this.missionState.playerMode,
      enemiesDestroyed: this.missionState.enemiesDestroyed,
      supportContacts: this.missionState.supportContacts,
      lifeLosses: this.missionState.eventHistory.filter((event) => event.type === 'playerLifeLost').length,
      vehicleFallbacks: this.missionState.eventHistory.filter((event) => event.type === 'playerVehicleFallback').length,
      upgrades: this.missionState.eventHistory.filter((event) => event.type === 'supportCollected' && event.serviceType === 'upgrade').length,
      decoysAccepted: this.missionState.eventHistory.filter((event) => event.type === 'decoySupportAccepted').length,
      decoysDestroyed: this.missionState.eventHistory.filter((event) => event.type === 'decoySupportDestroyed').length,
      collisions: this.missionState.eventHistory.filter((event) => event.type === 'playerDamage').length,
      lastDamageSource: [...this.missionState.eventHistory].reverse().find((event) => event.type === 'playerDamage')?.source ?? null,
    };
  }

  showHarnessSummary() {
    const runs = this.harnessState.runs;
    const average = (key) => runs.reduce((sum, run) => sum + run[key], 0) / Math.max(1, runs.length);
    const count = (predicate) => runs.filter(predicate).length;
    const completed = count((run) => run.reason === 'timeout' || run.reason === 'missionComplete');
    const destroyed = count((run) => run.reason === 'destroyed');
    const summary = [
      'AI HARNESS COMPLETE',
      `DIFFICULTY ${(this.harnessState.difficulty ?? runs[0]?.difficulty ?? 'medium').toUpperCase()}`,
      `MISSION ${this.harnessState.missionId ?? this.missionId}`,
      `RUNS ${runs.length}`,
      `SURVIVED ${completed}/${runs.length}`,
      `DESTROYED ${destroyed}/${runs.length}`,
      `AVG DIST ${Math.floor(average('distance'))} MI`,
      `AVG DAMAGE ${average('damage').toFixed(1)}`,
      `AVG LIVES ${average('livesRemaining').toFixed(1)}`,
      `AVG LIFE LOSSES ${average('lifeLosses').toFixed(1)}`,
      `AVG FALLBACKS ${average('vehicleFallbacks').toFixed(1)}`,
      `AVG COLLISIONS ${average('collisions').toFixed(1)}`,
      `AVG UPGRADES ${average('upgrades').toFixed(1)}`,
      `DECOYS ACCEPTED ${runs.reduce((sum, run) => sum + run.decoysAccepted, 0)}`,
      `DECOYS DESTROYED ${runs.reduce((sum, run) => sum + run.decoysDestroyed, 0)}`,
    ];

    console.table(runs);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 360, 250, 0x07100d, 0.94)
      .setDepth(300)
      .setStrokeStyle(1, 0x64d68a);
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 92, summary.join('\n'), {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '15px',
      color: '#c8f7d5',
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5, 0).setDepth(301);
  }

  handleSupportPickup(playerSprite, vanSprite) {
    const van = vanSprite.vehicle;
    if (van.isCollected || this.controlLocked) {
      return;
    }

    if (this.isCollisionTest) {
      van.openDoors();
      this.completeSupportService(van, { spawnAmbush: false });
      this.supportSystem.removeVan(vanSprite);
      this.hud.update();
      return;
    }

    if (!this.canDockWithSupport(vanSprite)) {
      return;
    }

    this.beginSupportDocking(vanSprite);
  }

  canDockWithSupport(vanSprite) {
    const vanBounds = vanSprite.getBounds();
    const playerFront = this.getFrontContactPoint(this.player.sprite);
    const vanBackY = vanBounds.bottom;
    const xTolerance = this.isHarness || this.aiControlled ? 44 : 30;
    const rearSlackFront = this.isHarness || this.aiControlled ? 36 : 24;
    const rearSlackBack = this.isHarness || this.aiControlled ? 72 : 48;
    const centeredEnough = Math.abs(playerFront.x - vanBounds.centerX) <= xTolerance;
    const approachingRear = this.player.sprite.y > vanSprite.y
      && playerFront.y <= vanBackY + rearSlackFront
      && playerFront.y >= vanBackY - rearSlackBack;

    return centeredEnough && approachingRear;
  }

  beginSupportDocking(vanSprite) {
    const van = vanSprite.vehicle;
    const playerSprite = this.player.sprite;
    const playerBody = playerSprite.body;
    const rearY = vanSprite.y + vanSprite.displayHeight / 2 + playerSprite.displayHeight / 2 - 10;
    const exitY = vanSprite.y + vanSprite.displayHeight / 2 + playerSprite.displayHeight / 2 + 8;
    const serviceY = vanSprite.y + 42;

    this.controlLocked = true;
    this.playerHiddenFromEnemies = true;
    this.moveState.up = false;
    this.moveState.down = false;
    this.moveState.left = false;
    this.moveState.right = false;
    this.player.bounceUntil = 0;
    playerBody.checkCollision.none = true;
    playerBody.setVelocity(0, 0);
    playerBody.setAcceleration(0, 0);

    if (!van.openDoors()) {
      this.abortSupportDocking(playerSprite, playerBody);
      return;
    }
    vanSprite.setDepth(34);
    van.label.setDepth(35);
    playerSprite.setDepth(28);
    van.setRampDepth(playerSprite.depth - 1);

    if (!this.isAttract) {
      this.hud.flashAlert(van.isDecoy ? 'SUPPORT: Vehicle marking mismatch.' : `${this.getSupportServiceLabel(van)}: Docking.`);
    }

    this.tweens.add({
      targets: playerSprite,
      x: vanSprite.x,
      y: rearY,
      duration: 420,
      ease: 'Sine.easeOut',
      onUpdate: () => this.updateSupportDockingPlayerCrop(playerSprite, vanSprite),
      onComplete: () => {
        if (!this.isSupportDockingLive(van, vanSprite, playerSprite)) {
          this.abortSupportDocking(playerSprite, playerBody);
          return;
        }
        this.updateSupportDockingPlayerCrop(playerSprite, vanSprite);
        this.tweens.add({
          targets: playerSprite,
          x: vanSprite.x,
          y: serviceY,
          duration: 1100,
          ease: 'Sine.easeInOut',
          onUpdate: () => this.updateSupportDockingPlayerCrop(playerSprite, vanSprite),
          onComplete: () => {
            if (!this.isSupportDockingLive(van, vanSprite, playerSprite) || !van.setDoorsClosed()) {
              this.abortSupportDocking(playerSprite, playerBody);
              return;
            }
            playerSprite.setVisible(false);
            if (!this.isAttract) {
              this.hud.flashAlert(van.isDecoy ? 'SUPPORT: Cargo verification failed.' : `${this.getSupportServiceLabel(van)}: Servicing.`);
            }
            this.time.delayedCall(this.getSupportServiceDuration(van), () => {
              if (!this.isSupportDockingLive(van, vanSprite, playerSprite)) {
                this.abortSupportDocking(playerSprite, playerBody);
                return;
              }
              this.completeSupportService(van, { spawnAmbush: false });
              if (!van.setDoorsOpen()) {
                this.abortSupportDocking(playerSprite, playerBody);
                return;
              }
              this.tweens.add({
                targets: playerSprite,
                x: vanSprite.x,
                y: exitY,
                duration: 980,
                ease: 'Sine.easeInOut',
                onStart: () => this.updateSupportDockingPlayerCrop(playerSprite, vanSprite),
                onUpdate: () => this.updateSupportDockingPlayerCrop(playerSprite, vanSprite),
                onComplete: () => {
                  if (!this.isSupportDockingLive(van, vanSprite, playerSprite)) {
                    this.abortSupportDocking(playerSprite, playerBody);
                    return;
                  }
                  this.clearSupportDockingPlayerCrop(playerSprite);
                  playerSprite.setDepth(20);
                  playerBody.reset(playerSprite.x, playerSprite.y);
                  playerBody.checkCollision.none = false;
                  playerBody.setVelocity(0, 0);
                  playerBody.setAcceleration(0, 0);
                  this.player.bounceUntil = 0;
                  this.controlLocked = false;
                  this.playerHiddenFromEnemies = false;
                  van.recede();
                  if (van.isDecoy) {
                    this.combatSystem.spawnAmbush(1);
                  }
                },
              });
            });
          },
        });
      },
    });
  }

  updateSupportDockingPlayerCrop(playerSprite, vanSprite) {
    if (!playerSprite?.active || !vanSprite?.active) {
      return;
    }

    const playerBounds = playerSprite.getBounds();
    const vanBounds = vanSprite.getBounds();
    const visiblePixels = playerBounds.bottom - vanBounds.bottom;

    if (visiblePixels <= 1) {
      playerSprite.setVisible(false);
      return;
    }

    const visibleRatio = Phaser.Math.Clamp(visiblePixels / playerBounds.height, 0, 1);
    if (visibleRatio >= 0.98) {
      this.clearSupportDockingPlayerCrop(playerSprite);
      return;
    }

    const frameWidth = playerSprite.frame?.width ?? playerSprite.width;
    const frameHeight = playerSprite.frame?.height ?? playerSprite.height;
    const cropHeight = Math.max(1, Math.round(frameHeight * visibleRatio));
    playerSprite
      .setVisible(true)
      .setCrop(0, frameHeight - cropHeight, frameWidth, cropHeight);
  }

  clearSupportDockingPlayerCrop(playerSprite) {
    if (!playerSprite?.active) {
      return;
    }
    playerSprite.setVisible(true);
    if (typeof playerSprite.resetCrop === 'function') {
      playerSprite.resetCrop();
    } else {
      playerSprite.setCrop();
    }
  }

  getSupportServiceLabel(van) {
    return van?.serviceType === 'ammo' ? 'AMMO TRUCK' : van?.serviceType === 'upgrade' ? 'UPGRADE TRUCK' : 'REPAIR TRUCK';
  }

  getSupportServiceDuration(van) {
    return van?.serviceType === 'ammo' ? SUPPORT.ammoServiceMs : SUPPORT.repairServiceMs;
  }

  isSupportDockingLive(van, vanSprite, playerSprite) {
    return !this.missionState.isGameOver
      && van
      && !van.isDestroyed
      && vanSprite
      && vanSprite.active
      && vanSprite.scene
      && playerSprite
      && playerSprite.active
      && playerSprite.scene;
  }

  abortSupportDocking(playerSprite, playerBody) {
    if (playerSprite?.active && playerBody) {
      this.clearSupportDockingPlayerCrop(playerSprite);
      playerSprite.setDepth(20);
      playerBody.checkCollision.none = false;
      playerBody.setVelocity(0, 0);
      playerBody.setAcceleration(0, 0);
      this.player.bounceUntil = 0;
    }
    this.controlLocked = false;
    this.playerHiddenFromEnemies = false;
  }

  completeSupportService(van, config = {}) {
    if (van.isDecoy) {
      this.missionState.applyDecoySupportPenalty({
        ammoAmount: SUPPORT.decoyAmmoAmount,
        awarenessIncrease: SUPPORT.trackerAwarenessIncrease,
      });
      this.playerBeliefModel.recordSupportPickup(true);
      if (!this.isAttract) {
        this.hud.flashAlert('SUPPORT: Decoy cargo received.');
      }
      this.audioSystem.playSupport(true);
      if (config.spawnAmbush !== false && !this.isCollisionTest) {
        this.combatSystem.spawnAmbush(1);
      }
    } else {
      this.missionState.applySupportReward({
        serviceType: van.serviceType,
      });
      if (van.serviceType === 'upgrade') {
        this.setPlayerMode('car', { invincible: true });
      }
      this.playerBeliefModel.recordSupportPickup(false);
      if (!this.isAttract) {
        this.hud.flashAlert(van.serviceType === 'ammo' ? 'AMMO RESTORED' : van.serviceType === 'upgrade' ? 'CAR RESTORED' : 'REPAIRED');
      }
      this.audioSystem.playSupport(false);
    }
    this.hud.update();
  }

  handleSupportShot(projectileSprite, vanSprite) {
    if (!projectileSprite.active || !vanSprite.active) {
      return;
    }

    const van = vanSprite.vehicle;
    if (van.isCollected || van.isDocking || van.isReceding) {
      return;
    }

    this.combatSystem.consumeProjectile(projectileSprite);
    this.effectsSystem.playExplosion(vanSprite.x, vanSprite.y, van.isDecoy ? 'medium' : 'medium', {
      scale: van.isDecoy ? 0.82 : 0.9,
      smokeScale: 0.7,
    });
    this.supportSystem.removeVan(vanSprite);
    this.playerBeliefModel.recordSupportAttack(van.isDecoy);

    if (van.isDecoy) {
      this.missionState.addScore(150);
      this.audioSystem.playDestroyed();
      this.missionState.eventHistory.push({
        type: 'decoySupportDestroyed',
        at: this.missionState.elapsedTime,
      });
      this.hud.flashAlert('SUPPORT: Decoy vehicle destroyed.');
    } else {
      this.missionState.eventHistory.push({
        type: 'realSupportDestroyed',
        at: this.missionState.elapsedTime,
      });
      const damageResult = this.applyPlayerDamage(DAMAGE.bulletHit, 'supportFriendlyFire');
      this.audioSystem.playCollision();
      if (damageResult.vehicleFallback || damageResult.vehicleDestroyed) {
        this.hud.update();
        return;
      }
      this.playLostLifeCue(damageResult);
      this.hud.flashAlert('SUPPORT: Friendly unit destroyed.');
    }

    if (this.missionState.isGameOver) {
      this.startGameOver();
    }
  }
}
