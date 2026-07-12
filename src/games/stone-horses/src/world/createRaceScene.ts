import {
  AmbientLight,
  Fog,
  Mesh,
  MeshBasicMaterial,
  Color,
  DirectionalLight,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector3,
} from "three";
import RAPIER from "@dimforge/rapier3d";
import { FollowCamera } from "../render/FollowCamera";
import { Marble } from "./Marble";
import { PhysicsWorld } from "./PhysicsWorld";
import { RaceController } from "./RaceController";
import { buildTrackMesh } from "./TrackMeshBuilder";
import { createTrackFeatureSystem } from "./TrackFeatures";
import { generateTrack } from "./TrackGenerator";
import { createSeededRng } from "../utils/seededRng";
import { RaceHud } from "../ui/RaceHud";
import { BettingSystem } from "../betting/BettingSystem";
import { createMarblePattern } from "./MarblePatterns";
import { MarbleLabelSystem } from "./MarbleLabels";
import { assignRacerNames, RacerIdentity } from "./RacerIdentity";
import { FeatureUpdateStats, RaceTelemetry } from "./RaceTelemetry";
import { MarbleVisuals } from "../visual/MarbleVisuals";
import { RaceEffectsSystem } from "../visual/RaceEffectsSystem";
import { RaceDirectorSystem } from "../visual/RaceDirectorSystem";
import { RailVisualHandle } from "../visual/RailVisuals";
import { PackVisualization } from "../visual/PackVisualization";
import { TrackFeedbackVisuals } from "../visual/TrackFeedbackVisuals";
import { TrackAmbientPulseSystem } from "../visual/TrackAmbientPulseSystem";
import { TrackSurfaceVisuals } from "../visual/TrackSurfaceVisuals";
import { TrackWallColorCycle } from "../visual/TrackWallColorCycle";
import { VisualIntensitySystem } from "../visual/VisualIntensitySystem";
import { VisualSettings } from "../visual/VisualSettings";
import { FloatingLightParticles } from "../visual/FloatingLightParticles";
import { VerticalLightStreaks } from "../visual/VerticalLightStreaks";
import { DepthArenaDecor } from "../visual/DepthArenaDecor";
import { gameAudio } from "../audio/GameAudio";

export interface RaceScene {
  root: Scene;
  update: (deltaTime: number, camera: PerspectiveCamera) => void;
}

export async function createRaceScene(): Promise<RaceScene> {
  const trackSeed = getTrackSeed();
  const raceSeed = getRaceSeed(trackSeed);
  const machineSeed = getMachineSeed(trackSeed);
  const rng = createSeededRng(`${raceSeed}:race-scene`);
  const root = new Scene();
  root.background = new Color(0x05070b);
  root.fog = new Fog(0x0a1020, 24, 118);
  const visualSettings = new VisualSettings();

  addLights(root);

  const physics = new PhysicsWorld(RAPIER);
  const generatedTrack = generateTrack(trackSeed);
  const trackPath = generatedTrack.path;
  const track = buildTrackMesh(trackPath, physics);
  root.add(track);
  addDebugReplayMarker(root);

  const featureSystem = createTrackFeatureSystem(RAPIER, physics, trackPath, machineSeed);
  root.add(featureSystem.root);

  const { marbles, launchVelocities, racerIdentities } = createMarbles(RAPIER, physics, rng, trackPath.samples, generatedTrack.seed);
  for (const marble of marbles) {
    root.add(marble.mesh);
  }

  const race = new RaceController(marbles, trackPath, {
    launchVelocities,
    seed: raceSeed,
  });
  const telemetry = new RaceTelemetry(marbles, trackPath, featureSystem.validationTelemetry);
  let hud: RaceHud;
  let updateMarbleBetLabels = (): void => {};
  const betting = new BettingSystem(
    marbles.map((marble) => marble.id).sort(),
    raceSeed,
    () => {
      hud.update();
      updateMarbleBetLabels();
    },
  );
  hud = new RaceHud(race, betting, racerIdentities, telemetry, visualSettings);
  const marbleLabels = new MarbleLabelSystem(marbles, racerIdentities);
  marbleLabels.updateBets(betting.bets);
  marbleLabels.updatePositions(marbles);
  updateMarbleBetLabels = (): void => marbleLabels.updateBets(betting.bets);
  root.add(marbleLabels.root);
  const followCamera = new FollowCamera(trackPath);
  const marbleVisuals = new MarbleVisuals(marbles, visualSettings.value);
  const railVisuals = (track.userData.railVisuals ?? null) as RailVisualHandle | null;
  const trackWallMaterials = (track.userData.trackWallMaterials ?? []) as MeshStandardMaterial[];
  const raceEffects = new RaceEffectsSystem(race, telemetry, railVisuals, followCamera, visualSettings.value);
  const raceDirector = new RaceDirectorSystem(trackPath);
  const visualIntensity = new VisualIntensitySystem();
  const trackFeedbackVisuals = new TrackFeedbackVisuals(trackPath, featureSystem.validationTelemetry, visualSettings.value);
  const packVisualization = new PackVisualization(visualSettings.value);
  const trackAmbientPulse = new TrackAmbientPulseSystem(trackPath, visualSettings.value);
  const trackSurfaceVisuals = new TrackSurfaceVisuals(trackPath, featureSystem.validationTelemetry, trackSeed, visualSettings.value);
  const trackWallColorCycle = new TrackWallColorCycle(trackWallMaterials, visualSettings.value);
  const floatingLights = new FloatingLightParticles(trackPath, trackSeed);
  const verticalLightStreaks = new VerticalLightStreaks(trackPath, trackSeed);
  const depthArenaDecor = new DepthArenaDecor(trackPath, trackSeed);
  let elapsedVisualTime = 0;
  visualSettings.subscribe((settings) => {
    marbleVisuals.setSettings(settings);
    raceEffects.setSettings(settings);
    trackFeedbackVisuals.setSettings(settings);
    packVisualization.setSettings(settings);
    trackAmbientPulse.setSettings(settings);
    trackSurfaceVisuals.setSettings(settings);
    trackWallColorCycle.setSettings(settings);
    followCamera.setCameraShakeEnabled(settings.cameraShake);
    hud.setUiAnimationEnabled(settings.uiAnimation);
  });
  root.add(marbleVisuals.root);
  root.add(raceEffects.root);
  root.add(trackFeedbackVisuals.root);
  root.add(packVisualization.root);
  root.add(trackSurfaceVisuals.root);
  root.add(trackAmbientPulse.root);
  root.add(depthArenaDecor.root);
  root.add(floatingLights.root);
  root.add(verticalLightStreaks.root);
  let previousRaceState = race.state;
  let previousCountdownLabel = race.getCountdownLabel();

  return {
    root,
    update: (deltaTime: number, camera: PerspectiveCamera): void => {
      let featureStats: FeatureUpdateStats = {
        slowZoneHits: 0,
        forceZoneHits: 0,
        variableSlowdownHits: 0,
        speedBoostHits: 0,
        speedVarianceSamples: [],
        paddleContacts: 0,
        paddleLeaderContacts: 0,
        sectionContactCounts: {},
        antiStallNudges: 0,
        antiStallDiagnostics: [],
      };

      if (race.state === "RUNNING") {
        featureStats = featureSystem.update(marbles, deltaTime);
        physics.step(deltaTime);
      }

      for (const marble of marbles) {
        marble.syncMesh();
      }
      marbleLabels.updatePositions(marbles);

      race.update(deltaTime);
      const countdownLabel = race.getCountdownLabel();
      if (race.state === "COUNTDOWN" && countdownLabel !== previousCountdownLabel && /^[1-3]$/.test(countdownLabel)) {
        gameAudio.playTick();
      }
      if (previousRaceState !== "RUNNING" && race.state === "RUNNING") {
        gameAudio.playGo();
      }
      if (previousRaceState !== "FINISHED" && race.state === "FINISHED") {
        gameAudio.playGo();
      }
      previousRaceState = race.state;
      previousCountdownLabel = countdownLabel;
      telemetry.update(race, deltaTime, featureStats);
      elapsedVisualTime += deltaTime;
      const intensity = visualIntensity.update(deltaTime, race, telemetry);
      hud.setRaceHeat(intensity.heat);
      const directorState = raceDirector.update(deltaTime, race, telemetry, marbles, intensity, followCamera);
      const directorEvents = raceDirector.consumeEvents();
      hud.setDirectorState(directorState);
      marbleVisuals.update(deltaTime, race, betting.bets);
      raceEffects.update(deltaTime, elapsedVisualTime, intensity, directorEvents);
      trackFeedbackVisuals.update(deltaTime, telemetry, intensity, directorState);
      packVisualization.update(race, marbles, intensity);
      trackSurfaceVisuals.update(elapsedVisualTime);
      trackAmbientPulse.update(elapsedVisualTime);
      depthArenaDecor.update(elapsedVisualTime);
      trackWallColorCycle.update(elapsedVisualTime);
      floatingLights.update(elapsedVisualTime);
      verticalLightStreaks.update(elapsedVisualTime);
      railVisuals?.setCountdown(race.getCountdownLabel());
      if (race.state === "FINISHED" && !betting.hasSettled) {
        const bankrollBeforeSettlement = hud.consumePendingBankrollBeforeSettlement();
        betting.settle(race.results);
        hud.captureRecap(bankrollBeforeSettlement);
      }

      hud.update();
      followCamera.update(camera, race.rankings, deltaTime, race.state, race.runningTime);
    },
  };
}

function addLights(root: Scene): void {
  root.add(new AmbientLight(0xb8d7ff, 0.42));

  const keyLight = new DirectionalLight(0xffffff, 2.6);
  keyLight.position.set(5, 7, 3);
  root.add(keyLight);

  const fillLight = new DirectionalLight(0x58e4ff, 0.95);
  fillLight.position.set(-5, 3, -4);
  root.add(fillLight);

  const rimLight = new DirectionalLight(0xff4fd8, 0.55);
  rimLight.position.set(0, 5, 8);
  root.add(rimLight);
}

function createMarbles(
  RAPIERApi: typeof RAPIER,
  physics: PhysicsWorld,
  rng: ReturnType<typeof createSeededRng>,
  samples: { point: Vector3; tangent: Vector3; width: number }[],
  seed: string,
): { marbles: Marble[]; launchVelocities: Map<string, Vector3>; racerIdentities: RacerIdentity[] } {
  const marbles: Marble[] = [];
  const launchVelocities = new Map<string, Vector3>();
  const previewUrls = new Map<string, string>();
  const radius = 0.34;
  const lateralOffsets = [-1.45, -0.5, 0.5, 1.45];
  const baseSample = samples[4];
  const rowForwardOffsets = [-0.42, 0.42];
  const startSlotIds = shuffleStartSlotIds(rng);
  let marbleIndex = 1;

  for (let row = 0; row < rowForwardOffsets.length; row += 1) {
    const sample = baseSample;
    const tangent = sample.tangent.clone().normalize();
    const lateral = new Vector3().crossVectors(new Vector3(0, 1, 0), tangent).normalize();

    for (let column = 0; column < lateralOffsets.length; column += 1) {
      const id = startSlotIds[marbleIndex - 1];
      const patternIndex = Number.parseInt(id.replace(/\D/g, ""), 10) - 1;
      const pattern = createMarblePattern(seed, patternIndex);
      const position = sample.point
        .clone()
        .addScaledVector(lateral, lateralOffsets[column])
        .addScaledVector(tangent, rowForwardOffsets[row])
        .add(new Vector3(0, radius + 0.12 + row * 0.04, 0));
      const marble = new Marble(RAPIERApi, physics.world, {
        id,
        color: pattern.baseColor,
        texture: pattern.texture,
        position,
        radius,
      });
      const launchSpeed = rng.nextBetween(1.4, 2.1);
      launchVelocities.set(id, tangent.clone().multiplyScalar(launchSpeed));
      previewUrls.set(id, pattern.previewUrl);
      marbles.push(marble);
      marbleIndex += 1;
    }
  }

  return {
    marbles,
    launchVelocities,
    racerIdentities: assignRacerNames(seed, marbles.map((marble) => marble.id).sort(), previewUrls),
  };
}

function shuffleStartSlotIds(rng: ReturnType<typeof createSeededRng>): string[] {
  const ids = Array.from({ length: 8 }, (_, index) => `M${(index + 1).toString().padStart(2, "0")}`);

  for (let i = ids.length - 1; i > 0; i -= 1) {
    const swapIndex = rng.nextInt(0, i);
    [ids[i], ids[swapIndex]] = [ids[swapIndex], ids[i]];
  }

  return ids;
}

function getTrackSeed(): string {
  const params = new URLSearchParams(window.location.search);
  const seed = params.get("trackSeed") ?? params.get("seed");

  return seed?.trim() || createLiveSeed("track");
}

function getRaceSeed(trackSeed: string): string {
  const seed = new URLSearchParams(window.location.search).get("raceSeed");

  return seed?.trim() || `${trackSeed}:${createLiveSeed("race")}`;
}

function getMachineSeed(trackSeed: string): string {
  const seed = new URLSearchParams(window.location.search).get("machineSeed");

  return seed?.trim() || `${trackSeed}:machines`;
}

function createLiveSeed(label: string): string {
  const random =
    typeof crypto !== "undefined" && "getRandomValues" in crypto
      ? crypto.getRandomValues(new Uint32Array(1))[0].toString(36)
      : Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(36);

  return `stone-horses-${label}-${Date.now().toString(36)}-${random}`;
}

function addDebugReplayMarker(root: Scene): void {
  const params = new URLSearchParams(window.location.search);
  const x = Number.parseFloat(params.get("debugX") ?? "");
  const y = Number.parseFloat(params.get("debugY") ?? "");
  const z = Number.parseFloat(params.get("debugZ") ?? "");

  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return;
  }

  const marker = new Mesh(
    new SphereGeometry(0.42, 16, 12),
    new MeshBasicMaterial({
      color: 0xff3b30,
      transparent: true,
      opacity: 0.85,
    }),
  );

  marker.position.set(x, y + 0.7, z);
  root.add(marker);
}
