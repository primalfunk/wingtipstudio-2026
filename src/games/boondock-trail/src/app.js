import { DAY_PHASES } from "./constants/gameConstants.js";
import { defaultSetupSelection } from "./state/gameContent.js";
import {
  applyDebugPreset,
  applyPatchToGameState,
  createDefaultGameState,
  cycleComfortPolicy,
  cycleTravelMode,
  resetRun,
  setComfortPolicy,
  setPhase,
  setTravelMode
} from "./state/gameState.js";
import {
  advanceToNextDay,
  beginCampDecisionPhase,
  beginDayDecisionPhase,
  beginOvernightResolution,
  resolveOvernightStay
} from "./systems/dayLoop.js";
import {
  canTurnInForNight,
  performCampAction,
  selectOvernightCampsite
} from "./systems/campLoop.js";
import {
  confirmLandmarkPreparation,
  enterLandmarkStop,
  leaveLandmarkStop,
  performLandmarkAction,
  toggleLandmarkPreparationAction
} from "./systems/landmarkStopLoop.js";
import {
  chooseRouteChoiceOption,
  enterRouteChoiceStop,
  leaveRouteChoiceStop
} from "./systems/routeChoiceLoop.js";
import {
  finalizeActiveEvent,
  queueForcedEventForPhase,
  resolveActiveEvent
} from "./systems/events/eventEngine.js";
import {
  advanceTravelSession,
  canResumeTravelSession,
  continueAfterTravelUtilityStop,
  finalizeTravelSession,
  getActiveTravelUtilityStop,
  getTravelFlavorBeat,
  getForcedTravelInterruptionEventId,
  hasTravelInterruptionPendingEvent,
  isTravelSessionComplete,
  isTravelSessionPausedForAuthoredObstacle,
  isTravelSessionPausedForUtilityStop,
  isTravelSessionAwaitingInterruptionResolution,
  isTravelSessionPausedForEvent,
  markTravelAuthoredObstacleVisited,
  markTravelInterruptionEventQueued,
  resolveTravelInterruptionSlot,
  resolveTravelUtilityStop,
  resumeTravelSession,
  startTravelSession,
  syncTravelSessionAfterRouteStopState
} from "./systems/travelSession.js";
import {
  buildTownContinueDrivingTravelOptions,
  buildTownDestinationTravelOptions,
  canEnterTown,
  enterTown,
  performTownAction,
  leaveTown,
  selectTownDestination
} from "./systems/townLoop.js";
import {
  prepareGeneratedStopOptions,
  pushPastGeneratedStops,
  selectGeneratedStop
} from "./systems/generatedStops.js";
import { getActiveRouteStop } from "./systems/routeStopState.js";
import { createAudioController } from "./audio/audioController.js";
import { renderScreen, syncScenicBackdrops } from "./ui/screens.js";
import { buildTravelInterludeState } from "./ui/travelInterlude.js";
import { getTravelApproachPose } from "./ui/travelApproachPose.js";

const INTRO_STEP_COUNT = 3;
const SCREEN_FADE_MS = 260;
const OPENING_TRIP_SCREEN_FADE_MS = 700;
const TRAVEL_DISTANCE_STEP_TARGET_MS = 500;

export function createApp(root) {
  const state = createAppState();
  const audioController = createAudioController();
  let travelInterludeTimer = null;
  let travelDayAnimationFrame = null;
  let screenSwapTimer = null;
  let renderToken = 0;
  const prefersReducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const handleResize = () => {
    syncScenicBackdrops(root);
  };

  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");

    if (!button) {
      return;
    }

    const audioEvent = buildAudioEventContext(state, button);

    if (button.dataset.action === "arm-audio") {
      audioController.arm();
    }

    const actionCue = getActionCue(audioEvent);

    if (actionCue) {
      audioController.playSfx(actionCue);
      audioEvent.didPlayActionCue = true;
    }

    const renderMode = dispatch(button.dataset);
    render({ animate: renderMode === "advance", audioEvent });
  });

  render({ immediate: true });
  window.addEventListener("resize", handleResize);

  function render(options = {}) {
    clearTravelInterludeTimer();
    clearTravelDayAnimation();
    clearScreenTransitionTimers();

    const nextMarkup = renderScreen(state);
    const token = ++renderToken;
    const screenFadeMs = getScreenFadeMs(options.audioEvent);
    const shouldAnimate =
      options.animate === true && !prefersReducedMotion && root.innerHTML.trim() !== "";

    root.style.setProperty("--screen-fade-ms", `${screenFadeMs}ms`);

    if (options.immediate || !shouldAnimate) {
      root.classList.remove("app-root--swapping");
      root.innerHTML = nextMarkup;
      syncScenicBackdrops(root);
      scheduleTravelInterludeAdvance();
      syncAudio(options.audioEvent);
      return;
    }

    root.classList.add("app-root--swapping");

    screenSwapTimer = window.setTimeout(() => {
      if (token !== renderToken) {
        return;
      }

      root.innerHTML = nextMarkup;
      syncScenicBackdrops(root);
      root.classList.remove("app-root--swapping");
      scheduleTravelInterludeAdvance();
      syncAudio(options.audioEvent);
      screenSwapTimer = null;
    }, screenFadeMs);
  }

  function dispatch(dataset) {
    let renderMode = "advance";

    if (dataset.action !== "open-overlay" && dataset.action !== "close-overlay") {
      state.ui.overlay = null;
    }

    switch (dataset.action) {
      case "arm-audio":
        state.ui.screen = "title";
        renderMode = "immediate";
        break;
      case "navigate":
        state.ui.screen = dataset.screen;
        if (dataset.screen !== "trip_map") {
          state.ui.mapReturnScreen = null;
        }
        if (dataset.screen !== "help") {
          state.ui.helpReturnScreen = null;
        }
        break;
      case "open-overlay":
        state.ui.overlay = dataset.overlay ?? null;
        renderMode = "immediate";
        break;
      case "close-overlay":
        state.ui.overlay = null;
        renderMode = "immediate";
        break;
      case "open-map":
        state.ui.mapReturnScreen =
          state.ui.screen === "trip_map" ? state.ui.mapReturnScreen ?? "interlude" : state.ui.screen;
        state.ui.screen = "trip_map";
        break;
      case "close-map":
        state.ui.screen = state.ui.mapReturnScreen ?? "interlude";
        state.ui.mapReturnScreen = null;
        break;
      case "open-help":
        state.ui.titlePanel = dataset.panel ?? "how_to_play";
        state.ui.helpReturnScreen = state.ui.screen === "help" ? state.ui.helpReturnScreen : state.ui.screen;
        state.ui.screen = "help";
        break;
      case "title-panel":
        state.ui.titlePanel = dataset.panel;
        renderMode = "immediate";
        break;
      case "set-road-plan":
        state.run = setTravelMode(state.run, dataset.mode);
        state.run = setComfortPolicy(state.run, dataset.policy);
        renderMode = "immediate";
        break;
      case "set-policy":
        if (dataset.group === "travelMode") {
          state.run = setTravelMode(state.run, dataset.value);
          state.ui.travelView = "pace";
        }
        if (dataset.group === "comfortPolicy") {
          state.run = setComfortPolicy(state.run, dataset.value);
          state.ui.travelView = "pace";
        }
        renderMode = "immediate";
        break;
      case "open-travel-speed":
        state.ui.travelView = "speed";
        renderMode = "immediate";
        break;
      case "close-travel-speed":
        state.ui.travelView = "pace";
        renderMode = "immediate";
        break;
      case "open-cabin-feel":
        state.ui.travelView = "cabin";
        renderMode = "immediate";
        break;
      case "close-cabin-feel":
        state.ui.travelView = "pace";
        renderMode = "immediate";
        break;
      case "begin-trip":
        state.ui.hasStartedTripOnce = true;
        state.ui.introStep = 0;
        state.ui.screen = "intro";
        state.ui.endingPreview = "live";
        state.ui.travelInterlude = null;
        state.ui.landmarkNoticeId = null;
        state.ui.landmarkView = "menu";
        state.ui.landmarkActionId = null;
        state.ui.incidentPromptKey = null;
        state.ui.mapReturnScreen = null;
        state.ui.travelView = "pace";
        state.ui.campPickerOpen = false;
        state.ui.townDestinationId = null;
        state.ui.townGraphExpandedGroupId = null;
        state.ui.townStopDisclosureId = null;
        state.ui.townNightPushConfirm = false;
        break;
      case "intro-next":
        if (state.ui.introStep >= INTRO_STEP_COUNT - 1) {
          state.ui.screen = "setup";
        } else {
          state.ui.introStep += 1;
          state.ui.screen = "intro";
        }
        break;
      case "skip-intro":
        state.ui.introStep = 0;
        state.ui.screen = "setup";
        break;
      case "start-run":
        state.run = resetRun(state.setup);
        state.run = beginDayDecisionPhase(state.run);
        state.ui.screen = "turn_card";
        state.ui.endingPreview = "live";
        state.ui.travelInterlude = null;
        state.ui.landmarkNoticeId = null;
        state.ui.landmarkView = "menu";
        state.ui.landmarkActionId = null;
        state.ui.incidentPromptKey = null;
        state.ui.mapReturnScreen = null;
        state.ui.travelView = "pace";
        state.ui.campPickerOpen = false;
        state.ui.townDestinationId = null;
        state.ui.townStopDisclosureId = null;
        state.ui.townNightPushConfirm = false;
        break;
      case "continue-turn-card":
        state.run = beginDayDecisionPhase(state.run);
        state.ui.travelView = "pace";
        state.ui.screen = "turn_card";
        break;
      case "enter-town":
        if (canEnterTown(state.run)) {
          state.run = enterTown(state.run, {
            entryReason: "location",
            returnPhase: DAY_PHASES.PLAYER_DECISION
          });
          state.ui.townDestinationId = null;
          state.ui.townGraphExpandedGroupId = null;
          state.ui.townStopDisclosureId = null;
          state.ui.townNightPushConfirm = false;
          state.ui.screen = "town";
        }
        break;
      case "open-town-destination":
        state.run = selectTownDestination(state.run, dataset.value);
        state.ui.townDestinationId = dataset.value ?? null;
        state.ui.townGraphExpandedGroupId = null;
        state.ui.townNightPushConfirm = false;
        state.ui.screen = "town";
        renderMode = "immediate";
        break;
      case "toggle-town-stop-disclosure":
        state.ui.townStopDisclosureId =
          state.ui.townStopDisclosureId === (dataset.value ?? null) ? null : dataset.value ?? null;
        state.ui.screen = "town";
        renderMode = "immediate";
        break;
      case "open-town-night-push-confirm":
        state.ui.townNightPushConfirm = true;
        state.ui.screen = "town";
        renderMode = "immediate";
        break;
      case "cancel-town-night-push":
        state.ui.townNightPushConfirm = false;
        state.ui.screen = "town";
        renderMode = "immediate";
        break;
      case "continue-town-arrival":
        state.ui.screen = "town";
        renderMode = "immediate";
        break;
      case "continue-destination-arrival":
        state.ui.screen = "camp";
        renderMode = "immediate";
        break;
      case "open-town-graph-group":
        state.ui.townGraphExpandedGroupId =
          state.ui.townGraphExpandedGroupId === dataset.value ? null : dataset.value ?? null;
        state.ui.screen = "town";
        renderMode = "immediate";
        break;
      case "continue-landmark-arrival":
        state.ui.landmarkView = "menu";
        state.ui.landmarkActionId = null;
        state.ui.screen = "landmark";
        renderMode = "immediate";
        break;
      case "open-landmark-action":
        state.ui.landmarkView = dataset.view ?? "menu";
        state.ui.landmarkActionId = dataset.value ?? null;
        state.ui.screen = "landmark";
        renderMode = "immediate";
        break;
      case "open-landmark-choices":
        state.ui.landmarkView = "choices";
        state.ui.landmarkActionId = null;
        state.ui.screen = "landmark";
        renderMode = "immediate";
        break;
      case "close-landmark-action":
        state.ui.landmarkView = state.ui.landmarkView === "choices" ? "choices" : "menu";
        state.ui.landmarkActionId = null;
        state.ui.screen = "landmark";
        renderMode = "immediate";
        break;
      case "close-landmark-choices":
        state.ui.landmarkView = "menu";
        state.ui.landmarkActionId = null;
        state.ui.screen = "landmark";
        renderMode = "immediate";
        break;
      case "cycle":
        if (dataset.target === "travel-mode") {
          state.run = cycleTravelMode(state.run);
        }
        if (dataset.target === "comfort-policy") {
          state.run = cycleComfortPolicy(state.run);
        }
        renderMode = "immediate";
        break;
      case "set-camp":
        state.run = selectOvernightCampsite(state.run, dataset.value);
        state.ui.campPickerOpen = false;
        renderMode = "immediate";
        break;
      case "open-camp-picker":
        state.ui.campPickerOpen = true;
        renderMode = "immediate";
        break;
      case "close-camp-picker":
        state.ui.campPickerOpen = false;
        renderMode = "immediate";
        break;
      case "open-actions-screen":
        state.ui.screen = "camp";
        renderMode = "immediate";
        break;
      case "confirm-evening-plan":
      case "prepare-overnight":
        if (!canTurnInForNight(state.run)) {
          break;
        }
        state.ui.campPickerOpen = false;
        state.ui.campActionsConfirmed = false;
        state.run = beginOvernightResolution(state.run);
        if (state.run.events.activeEvent) {
          routeToActiveEventScreen();
        } else {
          state.run = resolveOvernightStay(state.run);
          state.ui.screen = "summary";
        }
        break;
      case "camp-action":
        state.run = performCampAction(state.run, dataset.value);
        renderMode = "immediate";
        break;
      case "town-service":
        state.run = performTownAction(state.run, dataset.value);
        renderMode = "immediate";
        break;
      case "select-generated-stop":
        state.run = selectGeneratedStop(state.run, dataset.value);
        state.ui.campPickerOpen = false;
        state.ui.screen = "destination_arrival";
        break;
      case "push-generated-stops":
        state.run = pushPastGeneratedStops(state.run);
        state.ui.campPickerOpen = false;
        state.ui.screen = state.run.day.overnightContext ? "destination_arrival" : "stop_discovery";
        break;
      case "launch-town-destination":
        {
          const travelOptions = buildTownDestinationTravelOptions(state.run);

          if (!travelOptions) {
            break;
          }

          state.run = leaveTown(state.run);
          state.run = startTravelSession(state.run, travelOptions);
          state.ui.screen = "interlude";
        }
        break;
      case "continue-town-driving":
        {
          const travelOptions = buildTownContinueDrivingTravelOptions(state.run);

          if (!travelOptions) {
            break;
          }

          state.run = leaveTown(state.run);
          state.run.v2.stay.selectedDestinationId = null;
          state.run.v2.journey.currentDestinationId = null;
          state.run.v2.journey.arrivalState = "not_arrived";
          state.ui.townDestinationId = null;
          state.ui.townGraphExpandedGroupId = null;
          state.ui.townStopDisclosureId = null;
          state.ui.townNightPushConfirm = false;
          state.run = startTravelSession(state.run, travelOptions);
          state.ui.screen = "interlude";
        }
        break;
      case "landmark-action":
        state.run = performLandmarkAction(state.run, dataset.value);
        state.ui.landmarkView =
          getActiveRouteStop(state.run)?.stopType === "landmark" &&
          getActiveRouteStop(state.run)?.stateFlags?.includes("obstacle_resolved") &&
          getActiveRouteStop(state.run)?.returnPhase === DAY_PHASES.CAMP_DECISION
            ? "result"
            : "menu";
        state.ui.landmarkActionId = dataset.value ?? null;
        state.ui.screen = "landmark";
        renderMode = "immediate";
        break;
      case "toggle-landmark-action":
        state.run = toggleLandmarkPreparationAction(state.run, dataset.value);
        state.ui.screen = "landmark";
        renderMode = "immediate";
        break;
      case "confirm-landmark-plan":
        {
          const isMidLegObstacle = isTravelSessionPausedForAuthoredObstacle(state.run);

          state.run = confirmLandmarkPreparation(state.run);
          state.ui.landmarkView = "menu";
          state.ui.landmarkActionId = null;

          if (!isMidLegObstacle) {
            state.ui.screen = "landmark";
            renderMode = "immediate";
            break;
          }

          state.run = markTravelAuthoredObstacleVisited(state.run);
          state.run = leaveLandmarkStop(state.run);
          state.run = syncTravelSessionAfterRouteStopState(state.run);

          if (canResumeTravelSession(state.run)) {
            state.run = resumeTravelSession(state.run);
            state.ui.screen = "interlude";
            break;
          }

          if (isTravelSessionComplete(state.run)) {
            state.run = finalizeTravelSession(state.run);
            routeAfterTravel();
            break;
          }

          state.ui.screen = "interlude";
        }
        break;
      case "route-choice":
        state.run = chooseRouteChoiceOption(state.run, dataset.value);
        state.ui.screen = "route_choice";
        renderMode = "immediate";
        break;
      case "leave-town":
        {
          const returnPhase =
            getActiveRouteStop(state.run)?.returnPhase ?? DAY_PHASES.PLAYER_DECISION;
          state.run = leaveTown(state.run);
          state.ui.townDestinationId = null;
          state.ui.townGraphExpandedGroupId = null;
          routeAfterLeavingRouteStop(returnPhase);
        }
        break;
      case "leave-landmark":
        {
          const returnPhase =
            getActiveRouteStop(state.run)?.returnPhase ?? DAY_PHASES.PLAYER_DECISION;
          state.run = leaveLandmarkStop(state.run);
          state.ui.landmarkView = "menu";
          state.ui.landmarkActionId = null;
          routeAfterLeavingRouteStop(returnPhase);
        }
        break;
      case "leave-route-choice":
        {
          const returnPhase =
            getActiveRouteStop(state.run)?.returnPhase ?? DAY_PHASES.PLAYER_DECISION;
          state.run = leaveRouteChoiceStop(state.run);
          routeAfterLeavingRouteStop(returnPhase);
        }
        break;
      case "commit-travel":
        state.run = startTravelSession(state.run);
        state.ui.screen = "interlude";
        break;
      case "advance-travel-chunk":
        state.run = advanceTravelSession(state.run);

        if (isTravelSessionAwaitingInterruptionResolution(state.run)) {
          state.run = resolveTravelInterruptionSlot(state.run);

          if (hasTravelInterruptionPendingEvent(state.run)) {
            state.run = queueForcedEventForPhase(state.run, DAY_PHASES.TRAVEL_RESOLUTION, {
              eventId: getForcedTravelInterruptionEventId(state.run),
              respectDailyCap: true
            });

            if (state.run.events.activeEvent !== null) {
              state.run = markTravelInterruptionEventQueued(state.run);
              state.ui.incidentPromptKey = getActiveEventPromptKey(state.run);
              routeToActiveEventScreen();
              break;
            }
          }

          if (getTravelFlavorBeat(state.run) !== null) {
            state.ui.screen = "travel_beat";
            break;
          }

          state.run = resumeTravelSession(state.run);
          state.ui.screen = "interlude";
          break;
        }

        if (isTravelSessionPausedForAuthoredObstacle(state.run)) {
          state.run = enterLandmarkStop(state.run, {
            stopId: state.run.day.travelSession?.activeLeg?.authoredObstacle?.landmarkStopId ?? null,
            pointId: state.run.journey.currentRoutePointId,
            returnPhase: DAY_PHASES.PLAYER_DECISION
          });
          state.ui.landmarkView = "menu";
          state.ui.landmarkActionId = null;
          state.ui.screen = "landmark";
          break;
        }

        if (isTravelSessionPausedForUtilityStop(state.run)) {
          state.ui.screen = "midday_stop";
          break;
        }

        if (isTravelSessionPausedForEvent(state.run)) {
          state.run = queueForcedEventForPhase(state.run, DAY_PHASES.TRAVEL_RESOLUTION, {
            eventId: getForcedTravelInterruptionEventId(state.run),
            respectDailyCap: true
          });

          if (state.run.events.activeEvent !== null) {
            state.run = markTravelInterruptionEventQueued(state.run);
            state.ui.incidentPromptKey = getActiveEventPromptKey(state.run);
            routeToActiveEventScreen();
            break;
          }

          state.run = resumeTravelSession(state.run);
          state.ui.screen = "interlude";
          break;
        }

        if (isTravelSessionComplete(state.run)) {
          state.run = finalizeTravelSession(state.run);
          routeAfterTravel();
          break;
        }

        state.ui.screen = "interlude";
        break;
      case "resolve-midday-stop":
        state.run = resolveTravelUtilityStop(state.run, dataset.choice);
        state.ui.screen = "midday_stop";
        break;
      case "continue-after-midday-stop":
        state.run = continueAfterTravelUtilityStop(state.run);
        if (canResumeTravelSession(state.run)) {
          state.run = resumeTravelSession(state.run);
          state.ui.screen = "interlude";
          break;
        }
        if (isTravelSessionComplete(state.run)) {
          state.run = finalizeTravelSession(state.run);
          routeAfterTravel();
          break;
        }
        state.ui.screen = "interlude";
        break;
      case "continue-after-travel-beat":
        if (canResumeTravelSession(state.run)) {
          state.run = resumeTravelSession(state.run);
          state.ui.screen = "interlude";
          break;
        }
        routeAfterTravel();
        break;
      case "reveal-incident":
        state.ui.incidentPromptKey = getActiveEventPromptKey(state.run);
        routeToActiveEventScreen();
        break;
      case "continue-landmark":
        state.ui.landmarkView = "menu";
        state.ui.landmarkActionId = null;
        routeAfterTravel();
        break;
      case "open-active-event":
        if (state.run.events.activeEvent !== null) {
          routeToActiveEventScreen();
        }
        break;
      case "resolve-event":
        state.run = resolveActiveEvent(state.run, dataset.choice);
        state.ui.screen = "event";
        break;
      case "continue-after-event": {
        const phase = state.run.currentPhase;
        state.run = finalizeActiveEvent(state.run);

        if (phase === DAY_PHASES.MORNING_REVIEW) {
          state.run = beginDayDecisionPhase(state.run);
          state.ui.travelView = "pace";
          state.ui.campPickerOpen = false;
          state.ui.screen = "turn_card";
          break;
        }

        if (phase === DAY_PHASES.TRAVEL_RESOLUTION) {
          if (canResumeTravelSession(state.run)) {
            state.run = resumeTravelSession(state.run);
            state.ui.screen = "interlude";
            break;
          }

          if (isTravelSessionComplete(state.run)) {
            state.run = finalizeTravelSession(state.run);
          }

          routeAfterTravel();
          break;
        }

        if (phase === DAY_PHASES.CAMP_DECISION) {
          state.ui.campPickerOpen = false;
          state.ui.screen = "camp";
          break;
        }

        if (phase === DAY_PHASES.OVERNIGHT_RESOLUTION) {
          state.run = resolveOvernightStay(state.run);
          state.ui.screen = "summary";
          break;
        }

        state.ui.screen = "turn_card";
        break;
      }
      case "set-ending-preview":
        state.ui.endingPreview = dataset.variant;
        state.ui.screen = "end";
        break;
      case "open-end":
        state.ui.endingPreview = "live";
        state.ui.screen = "end";
        break;
      case "advance-day":
        state.run = advanceToNextDay(state.run);
        state.ui.travelInterlude = null;
        state.ui.landmarkNoticeId = null;
        state.ui.landmarkView = "menu";
        state.ui.landmarkActionId = null;
        state.ui.incidentPromptKey = null;
        state.ui.mapReturnScreen = null;
        state.ui.travelView = "pace";
        state.ui.campPickerOpen = false;
        state.ui.townDestinationId = null;
        state.ui.townGraphExpandedGroupId = null;
        if (state.run.gameOver) {
          state.ui.endingPreview = state.run.victory ? "victory" : "failure";
          state.ui.screen = "end";
        } else {
          state.run = beginDayDecisionPhase(state.run);
          state.ui.screen = "turn_card";
        }
        break;
      case "reset-run":
        state.run = resetRun(state.setup);
        state.ui.screen = dataset.screen === "travel" || !dataset.screen ? "turn_card" : dataset.screen;
        state.ui.endingPreview = "live";
        state.ui.travelInterlude = null;
        state.ui.landmarkNoticeId = null;
        state.ui.landmarkView = "menu";
        state.ui.landmarkActionId = null;
        state.ui.incidentPromptKey = null;
        state.ui.mapReturnScreen = null;
        state.ui.travelView = "pace";
        state.ui.campPickerOpen = false;
        state.ui.townDestinationId = null;
        state.ui.townGraphExpandedGroupId = null;
        state.ui.townStopDisclosureId = null;
        break;
      case "debug-preset":
        state.run = applyDebugPreset(state.run, dataset.preset);
        renderMode = "immediate";
        break;
      case "debug-adjust":
        state.run = applyPatchToGameState(
          state.run,
          buildDebugAdjustmentPatch(state.run, dataset)
        );
        renderMode = "immediate";
        break;
      default:
        break;
    }

    return renderMode;
  }

  function routeAfterTravel() {
    if (isTravelSessionComplete(state.run)) {
      state.run = finalizeTravelSession(state.run);
    }

    if (state.run.events.activeEvent !== null) {
      routeToActiveEventScreen();
      return;
    }

    if (state.run.day.travelSession?.activeLeg?.nightDriveFromTown === true) {
      state.run = beginCampDecisionPhase(state.run, { forcedRoadsideSleep: true });
      if (state.run.events.activeEvent) {
        routeToActiveEventScreen();
      } else {
        state.ui.screen = "camp";
      }
      return;
    }

    if (state.run.gameOver) {
      state.run = setPhase(state.run, DAY_PHASES.DAY_END);
      state.ui.screen = "summary";
      return;
    }

    if (
      state.run.day.routeArrivalNotice &&
      state.ui.landmarkNoticeId !== state.run.day.routeArrivalNotice.id
    ) {
      state.ui.landmarkNoticeId = state.run.day.routeArrivalNotice.id;
      if (state.run.day.routeArrivalNotice.kind === "destination") {
        state.ui.landmarkView = "menu";
        state.ui.landmarkActionId = null;
        state.ui.townDestinationId = null;
        state.ui.townGraphExpandedGroupId = null;
        state.ui.townStopDisclosureId = null;
        state.ui.townNightPushConfirm = false;
        state.ui.screen = "landmark";
        return;
      }
      state.run = prepareGeneratedStopOptions(state.run);
      state.ui.screen = "stop_discovery";
      return;
      if (state.run.day.routeArrivalNotice.isTownStop) {
        state.run = enterTown(state.run, {
          entryReason: "arrival",
          returnPhase: DAY_PHASES.CAMP_DECISION
        });
        state.ui.townDestinationId = null;
        state.ui.townGraphExpandedGroupId = null;
        state.ui.townStopDisclosureId = null;
        state.ui.townNightPushConfirm = false;
        state.ui.screen = "town";
        return;
      }
      if (
        state.run.day.routeArrivalNotice.isInteractiveStop &&
        state.run.day.routeArrivalNotice.routeStopType === "route_choice"
      ) {
        state.run = enterRouteChoiceStop(state.run, {
          entryReason: "arrival",
          returnPhase: DAY_PHASES.CAMP_DECISION
        });
        state.ui.screen = "route_choice";
        return;
      }
      if (
        state.run.day.routeArrivalNotice.isInteractiveStop &&
        state.run.day.routeArrivalNotice.routeStopType === "landmark"
      ) {
        state.run = enterLandmarkStop(state.run, {
          entryReason: "arrival",
          returnPhase: DAY_PHASES.CAMP_DECISION
        });
        state.ui.landmarkView = "arrival";
        state.ui.landmarkActionId = null;
        state.ui.screen = "landmark";
        return;
      }
      if (state.run.day.routeArrivalNotice.isDestinationChoice === true) {
        state.run = beginCampDecisionPhase(state.run);
        if (state.run.events.activeEvent) {
          routeToActiveEventScreen();
        } else {
          state.ui.campPickerOpen = false;
          state.ui.screen = "destination_arrival";
        }
        return;
      }
      state.ui.landmarkView = "menu";
      state.ui.landmarkActionId = null;
      state.ui.screen = "landmark";
      return;
    }

    if (state.run.day.overnightContext === null) {
      state.run = prepareGeneratedStopOptions(state.run);
      state.ui.screen = "stop_discovery";
      return;
    }

    state.run = beginCampDecisionPhase(state.run);
    if (state.run.events.activeEvent) {
      routeToActiveEventScreen();
    } else {
      state.ui.screen = "camp";
    }
  }

  function routeAfterLeavingRouteStop(returnPhase) {
    if (returnPhase === DAY_PHASES.PLAYER_DECISION) {
      state.ui.travelView = "pace";
      state.ui.screen = "turn_card";
      return;
    }

    if (returnPhase === DAY_PHASES.CAMP_DECISION) {
      state.run = beginCampDecisionPhase(state.run);
      if (state.run.events.activeEvent) {
        routeToActiveEventScreen();
      } else {
        state.ui.campPickerOpen = false;
        state.ui.screen = "camp";
      }
      return;
    }

    state.ui.screen = "summary";
  }

  function routeToActiveEventScreen() {
    const activeEvent = state.run.events.activeEvent;

    if (activeEvent === null) {
      return;
    }

    if (shouldShowIncidentPrompt()) {
      state.ui.screen = "incident_prompt";
      return;
    }

    if (activeEvent.state === "prompt" && activeEvent.type === "automatic") {
      state.run = resolveActiveEvent(state.run);
    }

    state.ui.screen = "event";
  }

  function shouldShowIncidentPrompt() {
    const promptKey = getActiveEventPromptKey(state.run);

    return promptKey !== null && state.ui.incidentPromptKey !== promptKey;
  }

  function scheduleTravelInterludeAdvance() {
    if (state.ui.screen !== "interlude" || state.ui.overlay !== null) {
      return;
    }

    const interlude = buildTravelInterludeState(state.run);

    if (!interlude) {
      return;
    }

    const interludeId = interlude.id;
    const durationMs = Math.max(1, Number(interlude.durationMs) || 0);

    travelInterludeTimer = window.setTimeout(() => {
      const latestInterlude = buildTravelInterludeState(state.run);

      if (state.ui.screen !== "interlude" || latestInterlude === null || latestInterlude.id !== interludeId) {
        return;
      }

      const audioEvent = buildAudioEventContext(state, null, {
        action: "advance-travel-chunk",
        synthetic: true
      });
      dispatch({ action: "advance-travel-chunk" });
      render({ audioEvent });
    }, durationMs);

    startTravelDayAnimation(durationMs);
  }

  function syncAudio(audioEvent = null) {
    audioController.syncMusic(getDesiredMusicCue(state), {
      openingTripStart: audioEvent?.isFirstTripStart === true
    });

    const resolvedEventCue = getResolvedEventCue(
      state.run,
      audioEvent?.previousResolvedEventKey ?? null
    );

    if (resolvedEventCue) {
      audioController.playSfx(resolvedEventCue);
      return;
    }

    const actionCue = audioEvent?.didPlayActionCue ? null : getActionCue(audioEvent);

    if (actionCue) {
      audioController.playSfx(actionCue);
    }
  }

  function clearTravelInterludeTimer() {
    if (travelInterludeTimer !== null) {
      window.clearTimeout(travelInterludeTimer);
      travelInterludeTimer = null;
    }
  }

  function startTravelDayAnimation(durationMs) {
    const clockElement = root.querySelector("[data-travel-clock]");
    const sunElement = root.querySelector("[data-travel-sun]");
    const distanceElement = root.querySelector("[data-travel-distance]");
    const approachPropElements = Array.from(root.querySelectorAll("[data-travel-approach-prop]"));

    if (!clockElement && !sunElement && !distanceElement && approachPropElements.length === 0) {
      return;
    }

    const startMinutes = readNumber(clockElement?.dataset.clockStartMinutes, 7 * 60);
    const endMinutes = readNumber(clockElement?.dataset.clockEndMinutes, 19 * 60);
    const clockDurationMs = Math.max(
      1,
      readNumber(clockElement?.dataset.clockDurationMs, durationMs)
    );
    const sunArc = {
      startX: readNumber(sunElement?.dataset.sunStartX, 72),
      startY: readNumber(sunElement?.dataset.sunStartY, 246),
      peakY: readNumber(sunElement?.dataset.sunPeakY, 72),
      endX: readNumber(sunElement?.dataset.sunEndX, 888),
      endY: readNumber(sunElement?.dataset.sunEndY, 246)
    };
    const startDistance = readNumber(distanceElement?.dataset.distanceStart, 0);
    const endDistance = readNumber(distanceElement?.dataset.distanceEnd, startDistance);
    const lightingElement = root.querySelector("[data-travel-lighting]");
    const lightingProgressStart = readNumber(lightingElement?.dataset.lightingProgressStart, 0);
    const lightingProgressEnd = readNumber(lightingElement?.dataset.lightingProgressEnd, 1);
    let middayFired = false;
    const startedAt = window.performance.now();

    function updateTravelDay(now) {
      const progress = prefersReducedMotion
        ? 1
        : Math.min(1, Math.max(0, (now - startedAt) / clockDurationMs));

      updateTravelClock(clockElement, startMinutes, endMinutes, progress);
      updateTravelSun(sunElement, sunArc, progress);
      updateTravelDistance(distanceElement, startDistance, endDistance, progress);
      updateTravelApproachProps(approachPropElements, progress);
      updateTravelLighting(lightingElement, lightingProgressStart, lightingProgressEnd, progress);

      if (!middayFired && !prefersReducedMotion) {
        const dayProgress = lightingProgressStart + (lightingProgressEnd - lightingProgressStart) * progress;

        if (dayProgress >= 0.5 && lightingProgressStart < 0.5) {
          middayFired = true;
          fireSunMiddayPulse(sunElement);
        }
      }

      if (progress < 1) {
        travelDayAnimationFrame = window.requestAnimationFrame(updateTravelDay);
      } else {
        travelDayAnimationFrame = null;
      }
    }

    travelDayAnimationFrame = window.requestAnimationFrame(updateTravelDay);
  }

  function clearTravelDayAnimation() {
    if (travelDayAnimationFrame !== null) {
      window.cancelAnimationFrame(travelDayAnimationFrame);
      travelDayAnimationFrame = null;
    }
  }

  function clearScreenTransitionTimers() {
    if (screenSwapTimer !== null) {
      window.clearTimeout(screenSwapTimer);
      screenSwapTimer = null;
    }
  }

  function getScreenFadeMs(audioEvent = null) {
    if (audioEvent?.isFirstTripStart === true) {
      return OPENING_TRIP_SCREEN_FADE_MS;
    }

    return SCREEN_FADE_MS;
  }
}

function updateTravelClock(clockElement, startMinutes, endMinutes, progress) {
  if (!clockElement) {
    return;
  }

  const minuteSpan = endMinutes - startMinutes;
  const roundedMinutes = Math.round((startMinutes + minuteSpan * progress) / 5) * 5;

  clockElement.textContent = formatClockMinutes(roundedMinutes);
}

function updateTravelSun(sunElement, sunArc, progress) {
  if (!sunElement) {
    return;
  }

  const startProgress = readNumber(sunElement.dataset.sunProgressStart, 0);
  const endProgress = readNumber(sunElement.dataset.sunProgressEnd, 1);
  const travelProgress = startProgress + (endProgress - startProgress) * progress;
  const x = sunArc.startX + (sunArc.endX - sunArc.startX) * travelProgress;
  const baseY = sunArc.startY + (sunArc.endY - sunArc.startY) * travelProgress;
  const peakLift =
    ((sunArc.startY + sunArc.endY) / 2 - sunArc.peakY) *
    4 *
    travelProgress *
    (1 - travelProgress);
  const y = baseY - peakLift;

  sunElement.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
}

function updateTravelDistance(distanceElement, startDistance, endDistance, progress) {
  if (!distanceElement) {
    return;
  }

  const totalStepCount = Math.max(
    1,
    Math.round(
      readNumber(distanceElement.dataset.distanceDurationMs, TRAVEL_DISTANCE_STEP_TARGET_MS) /
        TRAVEL_DISTANCE_STEP_TARGET_MS
    )
  );
  const completedStepCount =
    progress >= 1 ? totalStepCount : Math.floor(progress * totalStepCount);
  const steppedProgress = completedStepCount / totalStepCount;
  const nextValue = Math.max(
    0,
    Math.round(startDistance + (endDistance - startDistance) * steppedProgress)
  );
  const currentValue = Number(distanceElement.dataset.currentValue ?? "");

  if (currentValue === nextValue) {
    return;
  }

  distanceElement.textContent = `${nextValue}`;
  distanceElement.dataset.currentValue = `${nextValue}`;
  distanceElement.classList.remove("road-day-distance-value--tick");
  void distanceElement.offsetWidth;
  distanceElement.classList.add("road-day-distance-value--tick");
}

function updateTravelApproachProps(propElements, progress) {
  if (!Array.isArray(propElements) || propElements.length === 0) {
    return;
  }

  for (const propElement of propElements) {
    const legProgressStart = readNumber(propElement.dataset.legProgressStart, 0);
    const legProgressEnd = readNumber(propElement.dataset.legProgressEnd, legProgressStart);
    const legProgress = legProgressStart + (legProgressEnd - legProgressStart) * progress;
    const spawnProgress = readNumber(propElement.dataset.propSpawnProgress, 0);
    const authoredEndProgress = readNumber(propElement.dataset.propEndProgress, 1);
    const propKind = propElement.dataset.propKind;
    const endProgress = Math.max(
      spawnProgress + 0.001,
      propKind === "town_silhouette" ? Math.min(authoredEndProgress, legProgressEnd) : authoredEndProgress,
      propKind === "town_silhouette" ? spawnProgress + 0.001 : legProgressEnd
    );
    const pose = getTravelApproachPose(
      {
        kind: propKind,
        spawnProgress,
        endProgress,
        xStart: readNumber(propElement.dataset.propXStart, 0),
        xEnd: readNumber(propElement.dataset.propXEnd, 0),
        yBase: readNumber(propElement.dataset.propYBase, 0),
        scaleStart: readNumber(propElement.dataset.propScaleStart, 0.5),
        scaleEnd: readNumber(propElement.dataset.propScaleEnd, 1)
      },
      legProgress
    );

    propElement.style.opacity = `${pose.opacity}`;
    propElement.setAttribute(
      "transform",
      `translate(${pose.x.toFixed(1)} ${pose.y.toFixed(1)}) scale(${pose.scale.toFixed(3)})`
    );
  }
}

function updateTravelLighting(lightingEl, progressStart, progressEnd, chunkProgress) {
  if (!lightingEl) {
    return;
  }

  const dayProgress = progressStart + (progressEnd - progressStart) * chunkProgress;

  // Sky color keyframes: [progress, [r, g, b]]
  // Dawn dark → morning blue → bright noon sky → afternoon → golden hour → sunset → dusk → night black
  const keyframes = [
    [0.00, [8, 12, 45]],     // pre-dawn: deep dark navy
    [0.15, [22, 55, 130]],   // early morning: dark blue
    [0.30, [55, 125, 195]],  // morning: medium blue
    [0.50, [105, 185, 245]], // noon: bright light sky blue
    [0.68, [75, 150, 215]],  // afternoon: medium blue
    [0.80, [200, 130, 55]],  // golden hour: warm amber
    [0.88, [210, 65, 18]],   // sunset: orange-red
    [0.94, [95, 18, 10]],    // dusk: deep red
    [1.00, [5, 5, 15]],      // night: near black
  ];

  let lower = keyframes[0];
  let upper = keyframes[keyframes.length - 1];

  for (let i = 0; i < keyframes.length - 1; i++) {
    if (dayProgress >= keyframes[i][0] && dayProgress <= keyframes[i + 1][0]) {
      lower = keyframes[i];
      upper = keyframes[i + 1];
      break;
    }
  }

  const range = upper[0] - lower[0];
  const t = range > 0 ? (dayProgress - lower[0]) / range : 0;
  const r = Math.round(lower[1][0] + (upper[1][0] - lower[1][0]) * t);
  const g = Math.round(lower[1][1] + (upper[1][1] - lower[1][1]) * t);
  const b = Math.round(lower[1][2] + (upper[1][2] - lower[1][2]) * t);

  lightingEl.style.background = `rgb(${r},${g},${b})`;
}

function fireSunMiddayPulse(sunEl) {
  if (!sunEl) {
    return;
  }

  sunEl.classList.add("travel-day-sun--midday-pulse");
  window.setTimeout(() => sunEl.classList.remove("travel-day-sun--midday-pulse"), 700);
}

function formatClockMinutes(totalMinutes) {
  const normalizedMinutes = Math.max(0, Math.round(Number(totalMinutes) || 0));
  const hours = Math.floor(normalizedMinutes / 60) % 24;
  const minutes = normalizedMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function readNumber(value, fallback) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function buildAudioEventContext(state, button = null, overrides = {}) {
  const action = overrides.action ?? button?.dataset?.action ?? "";

  return {
    action,
    buttonLabel: overrides.buttonLabel ?? getButtonLabel(button),
    buttonTone: overrides.buttonTone ?? getButtonTone(button),
    isFirstTripStart:
      overrides.isFirstTripStart ??
      (action === "begin-trip" && state.ui.hasStartedTripOnce !== true),
    previousResolvedEventKey: getResolvedEventAudioKey(state.run),
    previousScreen: state.ui.screen,
    synthetic: overrides.synthetic ?? false,
    targetScreen: overrides.targetScreen ?? button?.dataset?.screen ?? ""
  };
}

function getDesiredMusicCue(state) {
  if (state.ui.screen === "audio_gate") {
    return null;
  }

  if (state.ui.screen === "title" || state.ui.screen === "intro") {
    return "main_theme";
  }

  if (
    state.ui.screen === "interlude" &&
    state.ui.overlay === null &&
    buildTravelInterludeState(state.run) !== null
  ) {
    return "road_music";
  }

  return "menu_music";
}

function getActionCue(audioEvent) {
  if (!audioEvent?.action) {
    return null;
  }

  if (audioEvent.synthetic || audioEvent.action === "debug-preset" || audioEvent.action === "debug-adjust") {
    return null;
  }

  if (audioEvent.action === "arm-audio") {
    return null;
  }

  return audioEvent.buttonTone === "gold" ? "select" : "click";
}

function getResolvedEventCue(runState, previousResolvedEventKey = null) {
  const activeEvent = runState.events.activeEvent;
  const currentKey = getResolvedEventAudioKey(runState);

  if (!currentKey || currentKey === previousResolvedEventKey || activeEvent?.state !== "resolved") {
    return null;
  }

  switch (activeEvent.resolvedAudioTone) {
    case "success":
      return "success";
    case "bad_fail":
      return "bad_fail";
    case "neutral":
    default:
      return "neutral";
  }
}

function getResolvedEventAudioKey(runState) {
  const activeEvent = runState.events.activeEvent;

  if (!activeEvent || activeEvent.state !== "resolved") {
    return null;
  }

  return [
    runState.dayNumber,
    runState.day.eventsResolvedCount,
    activeEvent.id,
    activeEvent.resolvedChoiceId ?? "automatic",
    activeEvent.resolvedAudioTone ?? "neutral"
  ].join("|");
}

function getButtonLabel(button) {
  return button?.textContent?.trim().toLowerCase() ?? "";
}

function getButtonTone(button) {
  if (!button?.classList) {
    return "default";
  }

  if (
    button.classList.contains("title-menu-button--primary") ||
    button.classList.contains("action-button--primary")
  ) {
    return "gold";
  }

  return "default";
}

function createAppState() {
  return {
      ui: {
        screen: "audio_gate",
        titlePanel: "how_to_play",
        introStep: 0,
        hasStartedTripOnce: false,
        travelView: "pace",
        campPickerOpen: false,
        campActionsConfirmed: false,
        townDestinationId: null,
        townGraphExpandedGroupId: null,
        townStopDisclosureId: null,
        townNightPushConfirm: false,
        landmarkView: "menu",
      landmarkActionId: null,
      overlay: null,
      endingPreview: "live",
      travelInterlude: null,
      landmarkNoticeId: null,
      incidentPromptKey: null,
      mapReturnScreen: null,
      helpReturnScreen: null
    },
    setup: {
      ...defaultSetupSelection
    },
    run: createDefaultGameState(defaultSetupSelection)
  };
}

function shouldUseIncidentPrompt(runState) {
  return (
    runState.events.activeEvent !== null &&
    runState.events.activeEvent.phase === DAY_PHASES.TRAVEL_RESOLUTION &&
    runState.events.activeEvent.state === "prompt" &&
    runState.events.activeEvent.showPrompt === true
  );
}

function getActiveEventPromptKey(runState) {
  if (!shouldUseIncidentPrompt(runState)) {
    return null;
  }

  return [
    runState.runId,
    runState.dayNumber,
    runState.currentPhase,
    runState.events.activeEvent.id,
    runState.day.eventsResolvedCount
  ].join("|");
}

function buildDebugAdjustmentPatch(runState, dataset) {
  const delta = Number(dataset.delta) || 0;
  const nextValues = {
    battery: runState.resources.batteryCharge + delta,
    water: runState.resources.water + delta,
    waste: runState.v2.resources.waste.current + delta,
    outlook: runState.v2.hiddenMorale + delta,
    score: runState.v2.resources.tripScore + delta
  };

  if (!(dataset.field in nextValues)) {
    return {};
  }

  const resourceKeys = {
    battery: "batteryCharge",
    water: "water"
  };

  if (dataset.field === "waste") {
    return {
      v2: {
        resources: {
          waste: {
            current: nextValues.waste
          }
        }
      }
    };
  }

  if (dataset.field === "outlook") {
    return {
      v2: {
        hiddenMorale: nextValues.outlook
      },
      resources: {
        passengerMorale: nextValues.outlook
      }
    };
  }

  if (dataset.field === "score") {
    return {
      v2: {
        resources: {
          tripScore: nextValues.score
        }
      }
    };
  }

  return {
    resources: {
      [resourceKeys[dataset.field]]: nextValues[dataset.field]
    }
  };
}
