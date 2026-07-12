import Phaser from 'phaser';
import StorageSystem from '../systems/StorageSystem.js';
import bikeUrl from '../assets/vehicles/bike.png';
import boatUrl from '../assets/vehicles/boat.png';
import carUrl from '../assets/vehicles/car.png';
import planeUrl from '../assets/vehicles/plane.png';
import upgradeTruckClosedUrl from '../assets/vehicles/upgrade-truck-closed.png';
import upgradeTruckOpenUrl from '../assets/vehicles/upgrade-truck-open.png';
import enemyArmoredSedanUrl from '../assets/enemies/armored-sedan.png';
import enemyAssassinBikeUrl from '../assets/enemies/assassin-bike.png';
import enemyCannonCarUrl from '../assets/enemies/cannon-car.png';
import enemyCommandCarUrl from '../assets/enemies/command-car.png';
import enemyMineLayerUrl from '../assets/enemies/mine-layer.png';
import enemyMissileLauncherUrl from '../assets/enemies/missile-launcher.png';
import enemyPursuitInterceptorUrl from '../assets/enemies/pursuit-interceptor.png';
import enemyRammerUrl from '../assets/enemies/rammer.png';
import enemyRocketBikeUrl from '../assets/enemies/rocket-bike.png';
import enemyRocketSalvoUrl from '../assets/enemies/rocket-salvo.png';
import enemyScoutBikeUrl from '../assets/enemies/scout-bike.png';
import enemySignalJammerUrl from '../assets/enemies/signal-jammer.png';
import enemyTurretGunnerUrl from '../assets/enemies/turret-gunner.png';
import enemyAttackSkiffUrl from '../assets/enemies/water/attack-skiff.png';
import enemyCommandBoatUrl from '../assets/enemies/water/command-boat.png';
import enemyGunboatUrl from '../assets/enemies/water/gunboat.png';
import enemyMineBoatUrl from '../assets/enemies/water/mine-boat.png';
import enemyRammerBoatUrl from '../assets/enemies/water/rammer-boat.png';
import enemyRocketHydrofoilUrl from '../assets/enemies/water/rocket-hydrofoil.png';
import civilianBlueBikeUrl from '../assets/civilians/motorcycles/blue-bike.png';
import civilianGreenBikeUrl from '../assets/civilians/motorcycles/green-bike.png';
import civilianRedBikeUrl from '../assets/civilians/motorcycles/red-bike.png';
import civilianWhiteBikeUrl from '../assets/civilians/motorcycles/white-bike.png';
import civilianBoxHaulerUrl from '../assets/civilians/road/box-hauler.png';
import civilianBorderTransportUrl from '../assets/civilians/road/border-transport.png';
import civilianFreightTruckUrl from '../assets/civilians/road/freight-truck.png';
import civilianInspectionVanUrl from '../assets/civilians/road/inspection-van.png';
import civilianMaintenanceTruckUrl from '../assets/civilians/road/maintenance-truck.png';
import civilianServicePickupUrl from '../assets/civilians/road/service-pickup.png';
import civilianSurveillanceSedanUrl from '../assets/civilians/road/surveillance-sedan.png';
import civilianTankerTruckUrl from '../assets/civilians/road/tanker-truck.png';
import civilianUtilityVanUrl from '../assets/civilians/road/utility-van.png';
import civilianWorkCrewCarUrl from '../assets/civilians/road/work-crew-car.png';
import waterCargoSkiffUrl from '../assets/civilians/water/cargo-skiff.png';
import waterFisherUrl from '../assets/civilians/water/fisher.png';
import waterFuelBargeUrl from '../assets/civilians/water/fuel-barge.png';
import waterPatrolTenderUrl from '../assets/civilians/water/patrol-tender.png';
import waterWoodUrl from '../assets/hazards/water/wood.png';
import waterGreenBuoyUrl from '../assets/hazards/water/green-buoy.png';
import waterRedBuoyUrl from '../assets/hazards/water/red-buoy.png';
import explosionSmallUrl from '../assets/effects/explosion-small.png';
import explosionMediumUrl from '../assets/effects/explosion-medium.png';
import explosionLargeUrl from '../assets/effects/explosion-large.png';
import smokeLingerUrl from '../assets/effects/smoke-linger.png';
import mainMenuMusicUrl from '../assets/audio/music/main_menu.mp3';
import drivingMusicUrl from '../assets/audio/music/driving_music.mp3';
import confirmSfxUrl from '../assets/audio/sfx/confirm.mp3';
import crashSfxUrl from '../assets/audio/sfx/crash.mp3';
import explosionSfxUrl from '../assets/audio/sfx/explosion.mp3';
import gameOverSfxUrl from '../assets/audio/sfx/game_over.mp3';
import laserSfxUrl from '../assets/audio/sfx/laser.mp3';
import lostLifeSfxUrl from '../assets/audio/sfx/lost_life.mp3';
import overpassSpanUrl from '../assets/bridges/overpass-span.png';
import bridgePylonLeftUrl from '../assets/bridges/bridge-pylon-left.png';
import bridgePylonRightUrl from '../assets/bridges/bridge-pylon-right.png';
import cloverleafRampLoopUrl from '../assets/infrastructure/cloverleaf-ramp-loop.png';
import checkpointBoothUrl from '../assets/infrastructure/checkpoint-booth.png';
import scannerGantryUrl from '../assets/infrastructure/scanner-gantry.png';
import highwaySignGantryUrl from '../assets/infrastructure/highway-sign-gantry.png';
import constructionBarrierWarningUrl from '../assets/infrastructure/construction-barrier-warning.png';
import pipeGantryUrl from '../assets/industrial/pipe-gantry.png';
import refineryTankClusterUrl from '../assets/industrial/refinery-tank-cluster.png';
import medianGuardrailStripUrl from '../assets/medians/median-guardrail-strip.png';
import tunnelEntranceUrl from '../assets/tunnels/tunnel-entrance.png';
import tunnelRoadWallUrl from '../assets/tunnels/tunnel-road-wall.png';
import floodChannelWallUrl from '../assets/waterways/flood-channel-wall.png';
import spillwayGateUrl from '../assets/waterways/spillway-gate.png';
import surfaceBridgeConcreteUrl from '../assets/roads/surface-bridge-concrete.png';
import surfaceCleanAsphaltUrl from '../assets/roads/surface-clean-asphalt.png';
import surfaceCrackedAsphaltUrl from '../assets/roads/surface-cracked-asphalt.png';
import surfaceFloodChannelUrl from '../assets/roads/surface-flood-channel.png';
import surfaceIndustrialGrimeUrl from '../assets/roads/surface-industrial-grime.png';
import surfaceTunnelPavementUrl from '../assets/roads/surface-tunnel-pavement.png';
import transitionBridgeEdgeReflectorStripUrl from '../assets/transitions/bridge-edge-reflector-strip.png';
import transitionConcreteMedianNoseUrl from '../assets/transitions/concrete-median-nose.png';
import transitionConstructionDiversionArrowsUrl from '../assets/transitions/construction-diversion-arrows.png';
import transitionDividedEntryChevronsUrl from '../assets/transitions/divided-entry-chevrons.png';
import transitionDividedExitMergeChevronsUrl from '../assets/transitions/divided-exit-merge-chevrons.png';
import transitionFloodChannelEdgeStripeUrl from '../assets/transitions/flood-channel-edge-stripe.png';
import transitionGuardrailTaperEndUrl from '../assets/transitions/guardrail-taper-end.png';
import transitionLaneMergeArrowUrl from '../assets/transitions/lane-merge-arrow.png';
import transitionLaneSplitArrowUrl from '../assets/transitions/lane-split-arrow.png';
import transitionShoulderClosureHatchUrl from '../assets/transitions/shoulder-closure-hatch.png';
import transitionTemporaryBarrierDiagonalUrl from '../assets/transitions/temporary-barrier-diagonal.png';
import transitionTunnelLaneLightStripUrl from '../assets/transitions/tunnel-lane-light-strip.png';
import propChannelMarkerPostUrl from '../assets/infrastructure/props/channel-marker-post.png';
import propConcreteBarrierUrl from '../assets/infrastructure/props/concrete-barrier.png';
import propDockPostUrl from '../assets/infrastructure/props/dock-post.png';
import propLightPoleUrl from '../assets/infrastructure/props/light-pole.png';
import propOrangeConeStackUrl from '../assets/infrastructure/props/orange-cone-stack.png';
import propPipeMarkerUrl from '../assets/infrastructure/props/pipe-marker.png';
import propReflectiveMarkerPostUrl from '../assets/infrastructure/props/reflective-marker-post.png';
import propShrubScrubUrl from '../assets/infrastructure/props/shrub-scrub.png';
import propSmallHighwaySignUrl from '../assets/infrastructure/props/small-highway-sign.png';
import propTunnelWallLightUrl from '../assets/infrastructure/props/tunnel-wall-light.png';
import propUtilityBoxUrl from '../assets/infrastructure/props/utility-box.png';
import propUtilityPoleUrl from '../assets/infrastructure/props/utility-pole.png';
import propWarningLampPostUrl from '../assets/infrastructure/props/warning-lamp-post.png';
import propWorkArrowBoardUrl from '../assets/infrastructure/props/work-arrow-board.png';

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    this.load.image('vehicle-car', carUrl);
    this.load.image('vehicle-bike', bikeUrl);
    this.load.image('vehicle-boat', boatUrl);
    this.load.image('vehicle-plane', planeUrl);
    this.load.image('player-car', carUrl);
    this.load.image('player-motorcycle', civilianWhiteBikeUrl);
    this.load.image('civilian-car', carUrl);
    this.load.image('enemy-car', bikeUrl);
    this.load.image('support-van', boatUrl);
    this.load.image('upgrade-truck-closed', upgradeTruckClosedUrl);
    this.load.image('upgrade-truck-open', upgradeTruckOpenUrl);
    this.load.image('enemy-armored-sedan', enemyArmoredSedanUrl);
    this.load.image('enemy-assassin-bike', enemyAssassinBikeUrl);
    this.load.image('enemy-cannon-car', enemyCannonCarUrl);
    this.load.image('enemy-command-car', enemyCommandCarUrl);
    this.load.image('enemy-mine-layer', enemyMineLayerUrl);
    this.load.image('enemy-missile-launcher', enemyMissileLauncherUrl);
    this.load.image('enemy-pursuit-interceptor', enemyPursuitInterceptorUrl);
    this.load.image('enemy-rammer', enemyRammerUrl);
    this.load.image('enemy-rocket-bike', enemyRocketBikeUrl);
    this.load.image('enemy-rocket-salvo', enemyRocketSalvoUrl);
    this.load.image('enemy-scout-bike', enemyScoutBikeUrl);
    this.load.image('enemy-signal-jammer', enemySignalJammerUrl);
    this.load.image('enemy-turret-gunner', enemyTurretGunnerUrl);
    this.load.image('enemy-attack-skiff', enemyAttackSkiffUrl);
    this.load.image('enemy-command-boat', enemyCommandBoatUrl);
    this.load.image('enemy-gunboat', enemyGunboatUrl);
    this.load.image('enemy-mine-boat', enemyMineBoatUrl);
    this.load.image('enemy-rammer-boat', enemyRammerBoatUrl);
    this.load.image('enemy-rocket-hydrofoil', enemyRocketHydrofoilUrl);
    this.load.image('civilian-blue-bike', civilianBlueBikeUrl);
    this.load.image('civilian-green-bike', civilianGreenBikeUrl);
    this.load.image('civilian-red-bike', civilianRedBikeUrl);
    this.load.image('civilian-white-bike', civilianWhiteBikeUrl);
    this.load.image('civilian-box-hauler', civilianBoxHaulerUrl);
    this.load.image('civilian-border-transport', civilianBorderTransportUrl);
    this.load.image('civilian-freight-truck', civilianFreightTruckUrl);
    this.load.image('civilian-inspection-van', civilianInspectionVanUrl);
    this.load.image('civilian-maintenance-truck', civilianMaintenanceTruckUrl);
    this.load.image('civilian-service-pickup', civilianServicePickupUrl);
    this.load.image('civilian-surveillance-sedan', civilianSurveillanceSedanUrl);
    this.load.image('civilian-tanker-truck', civilianTankerTruckUrl);
    this.load.image('civilian-utility-van', civilianUtilityVanUrl);
    this.load.image('civilian-work-crew-car', civilianWorkCrewCarUrl);
    this.load.image('water-cargo-skiff', waterCargoSkiffUrl);
    this.load.image('water-fisher', waterFisherUrl);
    this.load.image('water-fuel-barge', waterFuelBargeUrl);
    this.load.image('water-patrol-tender', waterPatrolTenderUrl);
    this.load.image('water-wood', waterWoodUrl);
    this.load.image('water-green-buoy', waterGreenBuoyUrl);
    this.load.image('water-red-buoy', waterRedBuoyUrl);
    this.load.spritesheet('explosion-small-sheet', explosionSmallUrl, { frameWidth: 96, frameHeight: 96 });
    this.load.spritesheet('explosion-medium-sheet', explosionMediumUrl, { frameWidth: 112, frameHeight: 112 });
    this.load.spritesheet('explosion-large-sheet', explosionLargeUrl, { frameWidth: 128, frameHeight: 128 });
    this.load.spritesheet('smoke-linger-sheet', smokeLingerUrl, { frameWidth: 128, frameHeight: 128 });
    this.load.audio('music-main-menu', mainMenuMusicUrl);
    this.load.audio('music-driving', drivingMusicUrl);
    this.load.audio('sfx-confirm', confirmSfxUrl);
    this.load.audio('sfx-crash', crashSfxUrl);
    this.load.audio('sfx-explosion', explosionSfxUrl);
    this.load.audio('sfx-game-over', gameOverSfxUrl);
    this.load.audio('sfx-laser', laserSfxUrl);
    this.load.audio('sfx-lost-life', lostLifeSfxUrl);
    this.load.image('asset-overpass-span', overpassSpanUrl);
    this.load.image('asset-bridge-pylon-left', bridgePylonLeftUrl);
    this.load.image('asset-bridge-pylon-right', bridgePylonRightUrl);
    this.load.image('asset-cloverleaf-ramp-loop', cloverleafRampLoopUrl);
    this.load.image('asset-checkpoint-booth', checkpointBoothUrl);
    this.load.image('asset-scanner-gantry', scannerGantryUrl);
    this.load.image('asset-highway-sign-gantry', highwaySignGantryUrl);
    this.load.image('asset-construction-barrier-warning', constructionBarrierWarningUrl);
    this.load.image('asset-pipe-gantry', pipeGantryUrl);
    this.load.image('asset-refinery-tank-cluster', refineryTankClusterUrl);
    this.load.image('asset-median-guardrail-strip', medianGuardrailStripUrl);
    this.load.image('asset-tunnel-entrance', tunnelEntranceUrl);
    this.load.image('asset-tunnel-road-wall', tunnelRoadWallUrl);
    this.load.image('asset-flood-channel-wall', floodChannelWallUrl);
    this.load.image('asset-spillway-gate', spillwayGateUrl);
    this.load.image('asset-surface-bridge-concrete', surfaceBridgeConcreteUrl);
    this.load.image('asset-surface-clean-asphalt', surfaceCleanAsphaltUrl);
    this.load.image('asset-surface-cracked-asphalt', surfaceCrackedAsphaltUrl);
    this.load.image('asset-surface-flood-channel', surfaceFloodChannelUrl);
    this.load.image('asset-surface-industrial-grime', surfaceIndustrialGrimeUrl);
    this.load.image('asset-surface-tunnel-pavement', surfaceTunnelPavementUrl);
    this.load.image('transition-bridge-edge-reflector-strip', transitionBridgeEdgeReflectorStripUrl);
    this.load.image('transition-concrete-median-nose', transitionConcreteMedianNoseUrl);
    this.load.image('transition-construction-diversion-arrows', transitionConstructionDiversionArrowsUrl);
    this.load.image('transition-divided-entry-chevrons', transitionDividedEntryChevronsUrl);
    this.load.image('transition-divided-exit-merge-chevrons', transitionDividedExitMergeChevronsUrl);
    this.load.image('transition-flood-channel-edge-stripe', transitionFloodChannelEdgeStripeUrl);
    this.load.image('transition-guardrail-taper-end', transitionGuardrailTaperEndUrl);
    this.load.image('transition-lane-merge-arrow', transitionLaneMergeArrowUrl);
    this.load.image('transition-lane-split-arrow', transitionLaneSplitArrowUrl);
    this.load.image('transition-shoulder-closure-hatch', transitionShoulderClosureHatchUrl);
    this.load.image('transition-temporary-barrier-diagonal', transitionTemporaryBarrierDiagonalUrl);
    this.load.image('transition-tunnel-lane-light-strip', transitionTunnelLaneLightStripUrl);
    this.load.image('prop-channel-marker-post', propChannelMarkerPostUrl);
    this.load.image('prop-concrete-barrier', propConcreteBarrierUrl);
    this.load.image('prop-dock-post', propDockPostUrl);
    this.load.image('prop-light-pole', propLightPoleUrl);
    this.load.image('prop-orange-cone-stack', propOrangeConeStackUrl);
    this.load.image('prop-pipe-marker', propPipeMarkerUrl);
    this.load.image('prop-reflective-marker-post', propReflectiveMarkerPostUrl);
    this.load.image('prop-shrub-scrub', propShrubScrubUrl);
    this.load.image('prop-small-highway-sign', propSmallHighwaySignUrl);
    this.load.image('prop-tunnel-wall-light', propTunnelWallLightUrl);
    this.load.image('prop-utility-box', propUtilityBoxUrl);
    this.load.image('prop-utility-pole', propUtilityPoleUrl);
    this.load.image('prop-warning-lamp-post', propWarningLampPostUrl);
    this.load.image('prop-work-arrow-board', propWorkArrowBoardUrl);
  }

  create() {
    this.createEffectAnimations();
    this.createBulletTexture();
    this.createEnemyProjectileTextures();
    this.createRoadMarkerTexture();
    const params = new URLSearchParams(window.location.search);
    const visualScenario = params.get('visualScenario');
    if (visualScenario === 'transmission') {
      this.scene.start('TransmissionScene', {
        transmissionId: params.get('transmissionId') ?? 'world-1-after-1-5',
        nextSceneKey: 'OverworldScene',
        nextScenePayload: {},
      });
      return;
    }
    if (visualScenario === 'debrief') {
      this.scene.start('DebriefScene', {
        missionId: params.get('missionId') ?? '1-5',
        worldId: params.get('worldId') ?? 'world-1',
        missionComplete: true,
        score: 4200,
        distance: 18,
        elapsedTime: 96,
        enemiesDestroyed: 12,
        autopilot: false,
        eventHistory: [
          { type: 'supportCollected', serviceType: 'repair' },
          { type: 'decoySupportDestroyed' },
        ],
        playerTendencies: { supportCompliance: 0.42 },
      });
      return;
    }
    if (visualScenario) {
      this.scene.start('GameScene', {
        visualScenario,
        aiControlled: true,
        missionId: params.get('missionId') ?? '1-5',
        worldId: params.get('worldId') ?? 'world-1',
      });
      return;
    }

    if (params.get('collisionTest') === '1') {
      this.scene.start('GameScene', {
        collisionTest: true,
      });
      return;
    }

    if (params.get('harness') === '1') {
      const difficulty = params.get('difficulty');
      if (['easy', 'medium', 'hard'].includes(difficulty)) {
        StorageSystem.saveSettings({ difficulty });
      }
      this.scene.start('GameScene', {
        aiControlled: true,
        harness: true,
        worldId: params.get('worldId') ?? 'world-1',
        missionId: params.get('missionId') ?? '1-1',
        harnessState: {
          maxRuns: Number(params.get('runs') ?? 5),
          maxRunSeconds: Number(params.get('seconds') ?? 120),
          difficulty: ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : StorageSystem.loadSettings().difficulty,
          missionId: params.get('missionId') ?? '1-1',
          reportUrl: params.get('reportUrl') ?? null,
          runs: [],
        },
      });
      return;
    }

    this.scene.start('TitleScene');
  }

  createBulletTexture() {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0xfff1a8, 1);
    graphics.fillRect(0, 0, 4, 10);
    graphics.generateTexture('bullet', 4, 10);
    graphics.destroy();
  }

  createEnemyProjectileTextures() {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0xff5c5c, 1);
    graphics.fillRect(0, 0, 5, 12);
    graphics.generateTexture('enemy-bullet', 5, 12);
    graphics.clear();
    graphics.fillStyle(0xffb347, 1);
    graphics.fillRect(3, 4, 6, 16);
    graphics.fillStyle(0xff5c5c, 1);
    graphics.fillTriangle(0, 4, 12, 4, 6, 0);
    graphics.generateTexture('enemy-rocket', 12, 22);
    graphics.clear();
    graphics.fillStyle(0x111316, 1);
    graphics.fillCircle(8, 8, 8);
    graphics.lineStyle(2, 0xffd166, 1);
    graphics.strokeCircle(8, 8, 7);
    graphics.generateTexture('enemy-mine', 16, 16);
    graphics.destroy();
  }

  createEffectAnimations() {
    this.createAnimationOnce('explosion-small', 'explosion-small-sheet', 0, 11, 36);
    this.createAnimationOnce('explosion-medium', 'explosion-medium-sheet', 0, 15, 34);
    this.createAnimationOnce('explosion-large', 'explosion-large-sheet', 0, 19, 30);
    this.createAnimationOnce('smoke-linger', 'smoke-linger-sheet', 0, 11, 24);
  }

  createAnimationOnce(key, sheetKey, start, end, frameRate) {
    if (this.anims.exists(key)) {
      return;
    }

    this.anims.create({
      key,
      frames: this.anims.generateFrameNumbers(sheetKey, { start, end }),
      frameRate,
      repeat: 0,
    });
  }

  createRoadMarkerTexture() {
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0xc8d0d2, 1);
    graphics.fillRect(0, 0, 4, 44);
    graphics.generateTexture('lane-marker', 4, 44);
    graphics.destroy();
  }
}
