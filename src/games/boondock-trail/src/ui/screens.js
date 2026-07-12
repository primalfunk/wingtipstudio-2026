import { COMFORT_POLICIES, DAY_PHASES } from "../constants/gameConstants.js";
import {
  getCampsiteOption,
  getComfortPolicyOption,
  getRoutePreset,
  getTownDefinitionForRoutePoint,
  getTravelModeOption
} from "../state/gameContent.js";
import {
  checkLossConditions,
  formatDisplayDate,
  getDerivedStatus,
  getForecastSummary,
  getLossLabel,
  getPhaseLabel,
  getStateInspectorSnapshot,
  getWarningLabel
} from "../state/gameState.js";
import {
  getAvailableLandmarkActions,
  getLandmarkQuirkNotes,
  getLandmarkStopContext
} from "../systems/landmarkStopLoop.js";
import {
  canEnterTown,
  getEffectiveTownDestination,
  getAvailableTownActions,
  getAvailableTownDestinations,
  getTownContext
} from "../systems/townLoop.js";
import { getAvailableCampActions, getCampContext } from "../systems/campLoop.js";
import { getGeneratedStopOptions } from "../systems/generatedStops.js";
import { getActiveTravelUtilityStop } from "../systems/travelSession.js";
import { getSelectedCampsiteType } from "../systems/overnightContext.js";
import { calculateOvernightResolution } from "../systems/overnightResolution.js";
import { getActiveRouteStop, ROUTE_STOP_TYPES } from "../systems/routeStopState.js";
import {
  canLeaveRouteChoiceStop,
  getAvailableRouteChoiceOptions,
  getRouteChoiceContext
} from "../systems/routeChoiceLoop.js";
import {
  renderBulletList,
  renderChoiceGrid,
  renderDramaticShell,
  renderDisclosurePanel,
  renderLedger,
  renderMiniActionGrid,
  renderPreformatted,
  renderRouteRibbon,
  renderSection,
  renderShell,
  renderStatusBand,
  renderStatusOverlay,
  renderTitleReturnButton
} from "./components.js";
import {
  getResourceIcon,
  getRouteMarkerIcon,
  getTownActionIcon,
  renderAssetIcon,
  renderTitleMark
} from "./assetCatalog.js";
import { renderSceneIllustration } from "./illustrations.js";
import { renderTravelInterludeScreen } from "./travelInterlude.js";
import { renderTripMapScreen } from "./tripMap.js";
import { renderTownRouteGraph } from "./townRouteGraph.js";
import roadScrolling from "../../assets/scenes/road_scrolling.webp";
import startScrolling from "../../assets/scenes/start_scrolling.webp";
import campGeneralScrolling from "../../assets/images/camp_general_scrolling.webp";
import dayByDayScrolling from "../../assets/images/day_by_day_scrolling.webp";
import landmarkForestScrolling from "../../assets/images/landmark_forest_scrolling.webp";
import landmarkServiceScrolling from "../../assets/images/landmark_service_scrolling.webp";
import landmarkWashScrolling from "../../assets/images/landmark_wash_scrolling.webp";
import readTheRoadScrolling from "../../assets/images/read_the_road_scrolling.webp";
import setOutScrolling from "../../assets/images/set_out_scrolling.webp";
import summaryCampScrolling from "../../assets/images/summary_camp_scrolling.webp";
import titleScrollingDesert from "../../assets/images/title_scrolling_desert.webp";
import townHubScrolling from "../../assets/images/town_hub_scrolling.webp";
import goodSomethingScrolling from "../../assets/images/good_something_scrolling.png.webp";
import neutralSomethingScrolling from "../../assets/images/neutral_something_scrolling.png.webp";
import badSomethingScrolling from "../../assets/images/bad_something_scrolling.png.webp";
import packageManifest from "../../package.json";

const TITLE_SCREEN_VERSION = `Version ${packageManifest.version}`;

export function renderScreen(state) {
  const screens = {
    audio_gate: renderAudioGateScreen,
    title: renderTitleScreen,
    intro: renderIntroScreen,
    help: renderHelpScreen,
    setup: renderSetupScreen,
    turn_card: renderTurnCardScreen,
    interlude: renderTravelInterludeScreen,
    stop_discovery: renderStopDiscoveryScreen,
    midday_stop: renderMiddayStopScreen,
    incident_prompt: renderIncidentPromptScreen,
    travel_beat: renderTravelBeatScreen,
    trip_map: renderTripMapScreen,
    travel: renderTravelScreen,
    camp: renderCampScreen,
    camp_actions: renderCampScreen,
    destination_arrival: renderDestinationArrivalScreen,
    event: renderEventScreen,
    route_choice: renderRouteChoiceScreen,
    landmark: renderLandmarkScreen,
    town_arrival: renderTownArrivalScreen,
    town: renderTownScreen,
    summary: renderSummaryScreen,
    end: renderEndScreen
  };

  return (screens[state.ui.screen] ?? renderTravelScreen)(state);
}

const introCards = [
  {
    eyebrow: "Intro 1 Of 3",
    title: "Set Out",
    sceneVariant: "intro_set_out",
    lead: "You are setting out on a long road trip.",
    scenicBackdrop: {
      src: setOutScrolling,
      width: 2176,
      height: 544,
      loopMode: "mirror"
    },
    body: [
      "You are not racing north.",
      "You are shaping the kind of trip this becomes."
    ]
  },
  {
    eyebrow: "Intro 2 Of 3",
    title: "Take It Day By Day",
    sceneVariant: "intro_live_day_to_day",
    lead: "The trip comes together one day and one stop at a time.",
    scenicBackdrop: {
      src: dayByDayScrolling,
      width: 2176,
      height: 544,
      loopMode: "mirror"
    },
    body: [
      "Where you stop matters more than how far you go.",
      "A good rhythm is worth more than one hard push."
    ]
  },
  {
    eyebrow: "Intro 3 Of 3",
    title: "Find Your Rhythm",
    sceneVariant: "intro_read_the_band",
    lead: "How you travel shapes how the trip feels.",
    scenicBackdrop: {
      src: readTheRoadScrolling,
      width: 2176,
      height: 544,
      loopMode: "mirror"
    },
    body: [
      "Some days call for an easy hand. Some ask you to keep moving.",
      "The best trips leave room to settle in, rest well, and keep going."
    ]
  }
];

function renderAudioGateScreen(state) {
  return `
    <div class="app-shell app-shell--no-status screen-audio_gate">
      <section class="panel gameplay-frame title-screen-panel audio-gate-panel">
        ${renderScrollingScenicBackdrop({
          src: titleScrollingDesert,
          width: 2176,
          height: 544,
          loopMode: "mirror"
        })}
        <div class="audio-gate-content">
          <article class="audio-gate-card" aria-label="Audio start">
            <p class="eyebrow audio-gate-kicker">Sound</p>
            <h1>Enter The Trail</h1>
            <p class="audio-gate-lead">Click once to wake the soundtrack, then step into the main menu.</p>
            <button
              class="title-menu-button title-screen-menu-button title-menu-button--primary audio-gate-button"
              data-action="arm-audio"
            >
              <span>Enter</span>
            </button>
          </article>
        </div>
      </section>
    </div>
  `;
}

function renderTitleScreen(state) {
  return `
    <div class="app-shell app-shell--no-status screen-title">
      <section class="panel gameplay-frame title-screen-panel">
        ${renderScrollingScenicBackdrop({
          src: titleScrollingDesert,
          width: 2176,
          height: 544,
          loopMode: "mirror"
        })}
        <div class="title-screen-content">
          <article class="title-screen-stack" aria-label="Boondock Trail v2 title">
            <div class="title-screen-lockup">
              ${renderTitleMark()}
              <h1 class="title-screen-title">Boondock Trail v2</h1>
              <p class="title-screen-tagline">A road trip shaped one stop at a time.</p>
            </div>
            <div class="title-screen-menu" role="group" aria-label="Title Menu">
              <button
                class="title-menu-button title-screen-menu-button title-menu-button--primary"
                data-action="begin-trip"
              >
                <span>Start Trip</span>
              </button>
              <button
                class="title-menu-button title-screen-menu-button"
                data-action="open-help"
                data-panel="how_to_play"
              >
                <span>Help</span>
              </button>
            </div>
          </article>
          <p class="title-screen-footer">${TITLE_SCREEN_VERSION}</p>
        </div>
      </section>
    </div>
  `;
}

function renderIntroScreen(state) {
  const card = introCards[state.ui.introStep] ?? introCards[0];
  const bodyHtml = card.body
    .map((paragraph) => `<p class="intro-story-paragraph">${paragraph}</p>`)
    .join("");

  return `
    <div class="app-shell app-shell--no-status screen-intro">
      <section class="panel gameplay-frame intro-screen-panel ${card.scenicBackdrop ? "intro-screen-panel--scenic" : ""}">
        ${card.scenicBackdrop ? renderScrollingScenicBackdrop(card.scenicBackdrop) : ""}
        <div class="intro-screen-content">
          <article class="intro-story-card">
            <header class="intro-story-header">
              <p class="eyebrow intro-story-kicker">${card.eyebrow}</p>
              <h1 class="intro-story-title">${card.title}</h1>
              <p class="intro-story-lead">${card.lead}</p>
            </header>
            ${
              state.ui.introStep === 2
                ? `
                  <section class="intro-story-note" aria-label="Keep This In Mind">
                    <h2>Keep This In Mind</h2>
                    <div class="intro-story-body">
                      ${bodyHtml}
                    </div>
                  </section>
                `
                : `
                  <div class="intro-story-body">
                    ${bodyHtml}
                  </div>
                `
            }
            <div class="intro-screen-menu" role="group" aria-label="Intro Menu">
              <button class="title-menu-button title-menu-button--primary intro-screen-button" data-action="intro-next">
                <span>Continue</span>
              </button>
              ${
                state.ui.introStep === 0
                  ? `
                    <button class="title-menu-button intro-screen-button" data-action="skip-intro">
                      <span>Skip Intro</span>
                    </button>
                  `
                  : ""
              }
            </div>
          </article>
        </div>
      </section>
    </div>
  `;
}

function renderScrollingScenicBackdrop({
  src,
  width,
  height,
  loopMode = "mirror"
}) {
  return `
    <div
      class="scenic-backdrop"
      aria-hidden="true"
      data-scenic-src="${src}"
      data-scenic-width="${width}"
      data-scenic-height="${height}"
      data-scenic-loop="${loopMode}"
    >
      <div class="scenic-backdrop-track"></div>
      <div class="scenic-backdrop-overlay"></div>
    </div>
  `;
}

function buildScenicBackdrop(src) {
  if (!src) {
    return null;
  }

  return {
    src,
    width: 2176,
    height: 544,
    loopMode: "mirror"
  };
}

function getLandmarkScenicBackdrop(notice, latestPoint) {
  if (notice?.id === "del_norte_grove" || latestPoint?.tag === "timber" || latestPoint?.tag === "camp") {
    return buildScenicBackdrop(landmarkForestScrolling);
  }

  if (latestPoint?.tag === "service") {
    return buildScenicBackdrop(landmarkServiceScrolling);
  }

  if (latestPoint?.tag === "wash") {
    return buildScenicBackdrop(landmarkWashScrolling);
  }

  return buildScenicBackdrop(neutralSomethingScrolling);
}

function getTownScenicBackdrop(state) {
  const activeRouteStop = getActiveRouteStop(state.run);
  if (
    (state.run.currentPhase === DAY_PHASES.ROUTE_STOP &&
      activeRouteStop?.stopType === ROUTE_STOP_TYPES.TOWN) ||
    state.run.currentPhase === DAY_PHASES.TOWN_STOP ||
    state.ui.screen === "town_arrival"
  ) {
    return buildScenicBackdrop(townHubScrolling);
  }

  return null;
}

function getCampScenicBackdrop() {
  return buildScenicBackdrop(campGeneralScrolling);
}

function getSummaryScenicBackdrop(run) {
  return run.day.dailyMilesDriven === 0 && run.day.townActionsTaken.length > 0
    ? buildScenicBackdrop(townHubScrolling)
    : buildScenicBackdrop(summaryCampScrolling);
}

export function syncScenicBackdrops(root = document) {
  root.querySelectorAll(".scenic-backdrop").forEach((backdrop) => {
    const track = backdrop.querySelector(".scenic-backdrop-track");

    if (!track) {
      return;
    }

    const src = backdrop.dataset.scenicSrc;
    const sourceWidth = Number(backdrop.dataset.scenicWidth) || 1;
    const sourceHeight = Number(backdrop.dataset.scenicHeight) || 1;
    const loopMode = backdrop.dataset.scenicLoop ?? "mirror";
    const visibleWidth = Math.max(backdrop.clientWidth, window.innerWidth || 0);
    const visibleHeight = Math.max(backdrop.clientHeight, 1);
    const tileWidth = Math.max(1, Math.ceil((visibleHeight * sourceWidth) / sourceHeight));
    const cycleWidth = tileWidth * 2;
    const tileCount = Math.max(6, Math.ceil(visibleWidth / tileWidth) + 4);
    const signature = [src, sourceWidth, sourceHeight, loopMode, tileCount, cycleWidth].join("|");

    if (track.dataset.signature === signature) {
      track.style.setProperty("--scenic-cycle-width", `${cycleWidth}px`);
      return;
    }

    const tiles = Array.from({ length: tileCount }, (_, index) => {
      const mirrored = loopMode === "mirror" && index % 2 === 0;
      const tileClass = mirrored
        ? "scenic-backdrop-segment scenic-backdrop-segment--mirrored"
        : "scenic-backdrop-segment";

      return `
        <img
          class="${tileClass}"
          src="${src}"
          alt=""
          width="${sourceWidth}"
          height="${sourceHeight}"
          decoding="async"
        />
      `;
    }).join("");

    track.innerHTML = tiles;
    track.dataset.signature = signature;
    track.style.setProperty("--scenic-cycle-width", `${cycleWidth}px`);
    track.style.setProperty("--scenic-tile-width", `${tileWidth}px`);
  });
}

function renderHelpScreen(state) {
  const helpReturnScreen = state.ui.helpReturnScreen ?? null;
  const backAction =
    helpReturnScreen === "setup"
      ? {
          label: "Back To Setup",
          variant: "primary",
          data: { action: "navigate", screen: "setup" }
        }
      : helpReturnScreen === "title"
        ? {
            label: "Back To Title",
            variant: "primary",
            data: { action: "navigate", screen: "title" }
          }
        : null;
  const panel =
    state.ui.titlePanel === "about"
      ? {
          title: "About Boondock Trail V2",
          lead: "A quiet road trip about choosing good stops and keeping the trip in a good place.",
          sections: [
            renderSection(
              "What This Is",
              renderBulletList([
                "You travel north by choosing where to stop and how to handle each day.",
                "Good stops, steady choices, and a decent rhythm matter more than rushing.",
                "The game stays simple on the surface and lets the trip build over time."
              ])
            )
          ]
        }
      : {
          title: "How To Play",
          lead: "Check what feels tight, choose the next step, and keep the trip steady.",
          sections: [
            renderSection(
              "A Typical Day",
              renderBulletList([
                "Start by seeing where you are and what the trip needs next.",
                "Set your day tone and living policy, then head out.",
                "The stop you choose can matter as much as the road itself."
              ])
            ),
            renderSection(
              "What To Watch",
              renderBulletList([
                "Journey Status keeps electric, water, waste, trip score, weather, and settings close by.",
                "Warnings help you spot what may start to feel tight.",
                "Open the closer look when you want more context."
              ])
            )
        ]
        };

  return renderShell({
    state,
    screenId: "help",
    eyebrow: "Help",
    title: panel.title,
    lead: panel.lead,
    sceneVariant: "summary",
    sceneCaption: "Help is here when you need it.",
    showStatus: false,
    primaryHtml: panel.sections.join(""),
    actions: [
      ...(backAction ? [backAction] : []),
      {
        label: "How To Play",
        variant: state.ui.titlePanel === "how_to_play" ? "accent" : "secondary",
        data: { action: "title-panel", panel: "how_to_play" }
      },
      {
        label: "About",
        variant: state.ui.titlePanel === "about" ? "accent" : "secondary",
        data: { action: "title-panel", panel: "about" }
      }
    ]
  });
}

function renderTurnCardScreen(state) {
  const run = state.run;
  const turnCard = buildTurnCard(run);
  const derived = getDerivedStatus(run);
  const routeSummary = derived.routeProgressSummary;
  const drivingStyle = getTravelModeOption(run.policies.drivingStyle ?? run.policies.travelMode);
  const moodLine = [routeSummary.currentSegmentSummary, getForecastSummary(run)]
    .filter(Boolean)
    .join(" ");
  const townContext = getTownContext(run);
  const hasTownOption = townContext !== null && canEnterTown(run);
  const activeRumor = run.routeIntel?.activeRumor;
  const nextLegIntel = run.routeIntel?.nextLegIntel;
  const intelLines = buildTurnCardIntelLines(activeRumor, nextLegIntel);

  return `
    <div class="app-shell app-shell--no-status app-shell--with-return screen-turn_card">
      ${renderTitleReturnButton()}
      <section class="panel chapter-screen-panel chapter-screen-panel--location">
        ${renderScrollingScenicBackdrop(turnCard.scenicBackdrop)}
        <div class="chapter-screen-content chapter-screen-content--decision">
          <p class="eyebrow chapter-screen-kicker">Day ${run.dayNumber} | ${run.journey.routeName}</p>
          <p class="chapter-screen-date">${turnCard.dateLabel}</p>
          <h1 class="chapter-screen-title">${turnCard.placeName}</h1>
          <p class="chapter-screen-route">${routeSummary.routeLine}</p>
          <div class="chapter-screen-tools">
            <button class="status-open-button" data-action="open-map">
              Journey Status
            </button>
            <button class="status-open-button" data-action="open-overlay" data-overlay="status">
              Closer Look
            </button>
          </div>
          <div class="chapter-screen-description">
            <p class="road-day-distance">${routeSummary.nextWaypointMilesAway} miles ahead</p>
            <p class="road-day-mood">${moodLine}</p>
            <p class="road-day-mood">Day tone: ${drivingStyle.label}. ${drivingStyle.description}</p>
            ${intelLines.map((line) => `<p class="road-day-intel">${line}</p>`).join("")}
          </div>
          <div class="chapter-screen-menu chapter-screen-menu--decision ${hasTownOption ? "" : "chapter-screen-menu--single"}">
            ${
              !hasTownOption
                ? `
                  <button class="title-menu-button title-menu-button--primary chapter-screen-button" data-action="commit-travel">
                    <span>Drive</span>
                  </button>
                `
                : ""
            }
            ${
              hasTownOption
                ? `
                  <button class="title-menu-button chapter-screen-button" data-action="enter-town">
                    <span>Spend Time In Town</span>
                  </button>
                  <button class="title-menu-button title-menu-button--primary chapter-screen-button" data-action="commit-travel">
                    <span>Start The Next Road Day</span>
                  </button>
                `
                : ""
            }
          </div>
        </div>
      </section>
      ${state.ui.overlay === "status" ? renderStatusOverlay(state) : ""}
    </div>
  `;
}

function buildTurnCardIntelLines(activeRumor, nextLegIntel) {
  const lines = [];

  if (activeRumor?.label) {
    const source = activeRumor.sourceName
      ? `${activeRumor.sourceName}: `
      : "";
    lines.push(`${source}${activeRumor.label} — ${activeRumor.effectSummary}`);
  }

  if (nextLegIntel?.label) {
    const ahead = nextLegIntel.targetPointName
      ? `Past ${nextLegIntel.targetPointName}: `
      : "Further ahead: ";
    lines.push(`${ahead}${nextLegIntel.label} — ${nextLegIntel.effectSummary}`);
  }

  return lines;
}

function renderSetupScreen(state) {
  const route = getRoutePreset(state.setup.routePresetId);
  const travelWindow = Math.max(1, Number(route.deadlineAdjustmentDays ?? 0) + 14);

  return `
    <div class="app-shell app-shell--no-status app-shell--with-return screen-setup">
      ${renderTitleReturnButton()}
      <section class="panel gameplay-frame prestart-screen-panel prestart-screen-panel--road">
        ${renderScrollingScenicBackdrop({
          src: roadScrolling,
          width: 2176,
          height: 544,
          loopMode: "mirror"
        })}
        <div class="prestart-screen-content">
          <header class="prestart-screen-header">
            <p class="eyebrow prestart-screen-kicker">Coastal Departure</p>
            <h1 class="prestart-screen-title">Set Out Along The Coast</h1>
            <p class="prestart-screen-mood">One coastal route, a handful of places to know, and better nights when you read the road well.</p>
          </header>
          <div class="prestart-screen-body">
            ${renderPrestartFeatureCard({
              sectionLabel: "The Journey",
              title: route.label,
              subtitle: `${route.originName} to ${route.destinationName}`,
              description: "You are taking one authored coastal route through town hubs, weather shifts, off-grid stays, and choices about where the night should land.",
              note: "Keep an eye on electric, water, waste, weather, and trip score. The group's outlook matters too, even when it is not shown as a number.",
              mediaHtml: `
                <div class="prestart-feature-media">
                  ${renderSceneIllustration("setup_rain_coast", "")}
                </div>
              `,
              metadata: [
                { label: "From", value: route.originName },
                { label: "To", value: route.destinationName },
                { label: "Distance", value: `${route.totalMiles} miles` },
                { label: "Window", value: `${travelWindow} days` },
                { label: "Focus", value: "Electric | Water | Waste | Trip Score" }
              ],
              commandLabel: "Open Trip Guide",
              commandAction: "open-help"
            })}
          </div>
          <div class="prestart-screen-menu">
            ${[
              { label: "Begin The Journey", variant: "primary", data: { action: "start-run" } }
            ].map((action) => renderPrestartCommandButton(action)).join("")}
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderTravelScreen(state) {
  return renderTravelInterludeScreen(state);
}

function renderRouteChoiceScreen(state) {
  const run = state.run;
  const derived = getDerivedStatus(run);
  const routeSummary = derived.routeProgressSummary;
  const routeChoiceContext = getRouteChoiceContext(run);
  const routeChoice = routeChoiceContext?.routeChoice ?? null;
  const activeRouteStop = routeChoiceContext?.activeRouteStop ?? getActiveRouteStop(run);
  const availableOptions = getAvailableRouteChoiceOptions(run);
  const selectedOption = routeChoiceContext?.selectedOption ?? null;
  const canContinue = canLeaveRouteChoiceStop(run);
  const latestResult =
    run.day.lastRouteStopActionResult?.stopType === ROUTE_STOP_TYPES.ROUTE_CHOICE &&
    run.day.lastRouteStopActionResult?.stopId === routeChoice?.id
      ? run.day.lastRouteStopActionResult
      : null;
  const routeChoiceStatusHtml =
    routeChoice && activeRouteStop
      ? renderStatusBand(state, {
          phaseLabel: "Route Choice",
          journeyTitle: routeChoice.name,
          journeyLine: selectedOption
            ? `${selectedOption.label}. Next ${routeSummary.nextWaypointName} in ${routeSummary.nextWaypointMilesAway} mi.`
            : `${routeChoice.subtitle} Choose how to go on.`,
          showWarnings: false
        })
      : "";

  if (
    !routeChoice ||
    run.currentPhase !== DAY_PHASES.ROUTE_STOP ||
    activeRouteStop?.stopType !== ROUTE_STOP_TYPES.ROUTE_CHOICE
  ) {
    return renderTravelScreen(state);
  }

  const optionItems = availableOptions.map((option) => ({
    kicker: option.kicker,
    label: option.label,
    detail: [option.detail, option.effectSummary].filter(Boolean).join(" "),
    stateLabel: option.stateLabel,
    active: option.selected,
    data: { action: "route-choice", value: option.id },
    disabled: !option.canUse
  }));

  return renderShell({
    state,
    screenId: "route_choice",
    eyebrow: "Route Choice",
    title: routeChoice.name,
    lead: routeChoice.subtitle,
    sceneVariant: "travel",
    sceneCaption: "",
    backgroundHtml: renderScrollingScenicBackdrop(buildScenicBackdrop(roadScrolling)),
    showSceneIllustration: false,
    statusHtml: routeChoiceStatusHtml,
    primaryHtml: selectedOption
      ? `
          ${renderSection(
            "Chosen Route",
            renderLedger([
              { label: "Line", value: selectedOption.label },
              { label: "Next Stop", value: `${routeSummary.nextWaypointName} | ${routeSummary.nextWaypointMilesAway} mi` },
              { label: "Miles Left", value: `${run.journey.milesRemaining}` },
              { label: "Route Total", value: `${run.journey.totalMilesToDestination}` }
            ])
          )}
          ${renderSection(
            "What You Chose",
            `
              <p class="body-copy">${selectedOption.detail}</p>
              <p class="body-copy">${selectedOption.effectSummary}</p>
            `
          )}
          ${
            latestResult
              ? renderSection("Immediate Result", renderRouteStopResultCopy(latestResult))
              : ""
          }
        `
      : `
          ${renderSection(
            "The Split",
            `
              <p class="body-copy">${routeChoice.description}</p>
              <p class="body-copy">This junction sets the next stretch of road and shapes which kinds of places stay available over the next leg.</p>
            `
          )}
          ${renderSection("Your Options", renderChoiceGrid(optionItems))}
        `,
    secondaryHtml: selectedOption
      ? `
          <p class="body-copy">The chosen line is now marked and will shape the next stretch until the road folds back together.</p>
          <p class="body-copy">${selectedOption.resultText}</p>
        `
      : `
          <p class="body-copy">Read the road, pick the line you can live with, and keep the coastal run moving.</p>
          <p class="body-copy">${
            activeRouteStop.actionsRemaining > 0
              ? "You still have to choose a line before you can move on."
              : "This junction is waiting on a decision."
          }</p>
        `,
    secondaryTitle: selectedOption ? "Carry-Through" : "Decision",
    actions: canContinue
      ? [{ label: "Continue On", variant: "primary", data: { action: "leave-route-choice" } }]
      : []
  });
}

function renderPrestartFeatureCard({
  sectionLabel,
  title,
  subtitle = "",
  description = "",
  note = "",
  metadata = [],
  mediaHtml = "",
  commandLabel,
  commandAction
}) {
  return `
    <article class="prestart-feature-card">
      <div class="prestart-feature-copy">
        <p class="choice-kicker prestart-feature-kicker">${sectionLabel}</p>
        <h2 class="prestart-feature-title">${title}</h2>
        ${subtitle ? `<p class="prestart-feature-subtitle">${subtitle}</p>` : ""}
      </div>
      ${mediaHtml}
      ${
        metadata.length > 0
          ? `
            <div class="prestart-feature-meta">
              ${metadata
                .map(
                  (item) => `
                    <div class="prestart-feature-stat">
                      <span class="prestart-feature-stat-label">${item.label}</span>
                      <strong>${item.value}</strong>
                    </div>
                  `
                )
                .join("")}
            </div>
          `
          : ""
      }
      ${description ? `<p class="prestart-feature-description">${description}</p>` : ""}
      ${note ? `<p class="prestart-feature-note">${note}</p>` : ""}
      <div class="prestart-command-row">
        <button class="title-menu-button prestart-command-button" data-action="${commandAction}">
          <span>${commandLabel}</span>
        </button>
      </div>
    </article>
  `;
}

function renderPrestartCommandButton({ label, variant = "secondary", data = {} }) {
  const variantClass = variant === "primary" ? " title-menu-button--primary" : "";

  return `
    <button class="title-menu-button prestart-command-button${variantClass}" ${dataAttributes(data)}>
      <span>${label}</span>
    </button>
  `;
}

function dataAttributes(data) {
  return Object.entries(data)
    .map(([key, value]) => `data-${key}="${String(value)}"`)
    .join(" ");
}

function startCaseLabel(value) {
  return String(value)
    .replaceAll(/[_-]+/g, " ")
    .replaceAll(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatStopKindLabel(value) {
  return startCaseLabel(value || "landmark");
}

function buildTurnCard(run) {
  const currentPoint =
    run.journey.routePoints.find((point) => point.id === run.journey.currentRoutePointId) ??
    run.journey.routePoints[run.journey.currentStopIndex] ??
    run.journey.routePoints[0] ??
    null;

  return {
    dateLabel: formatDisplayDate(run.day.currentDate),
    placeName: run.journey.currentLocationName,
    sceneVariant: run.dayNumber === 1 ? "setup" : "travel",
    scenicBackdrop: {
      src: run.dayNumber === 1 ? startScrolling : roadScrolling,
      width: 2176,
      height: 544,
      loopMode: "mirror"
    },
    atmosphereLine:
      currentPoint?.description ??
      run.journey.currentSegmentSummary ??
      "Morning is here, and the road is waiting."
  };
}

function renderCompactSelection({
  kicker = "",
  label,
  detail,
  buttonLabel,
  action = "",
  buttonData = null
}) {
  const buttonAttrs = buttonData ? dataAttributes(buttonData) : `data-action="${action}"`;

  return `
    <div class="compact-picker-card">
      <div class="compact-picker-copy">
        ${kicker ? `<span class="choice-kicker">${kicker}</span>` : ""}
        <strong>${label}</strong>
        ${detail ? `<p class="choice-detail">${detail}</p>` : ""}
      </div>
      <button class="action-button action-button--secondary compact-picker-button" ${buttonAttrs}>
        <span>${buttonLabel}</span>
      </button>
    </div>
  `;
}

function buildPolicyChoiceDetail(run, action, options = {}) {
  if (options.usedText) {
    return options.usedText;
  }

  return [
    action.description,
    action.effectSummary,
    getLivingPolicyChoiceHint(run.policies.comfortPolicy, action.category)
  ]
    .filter(Boolean)
    .join(" ");
}

function getLivingPolicyChoiceHint(comfortPolicy, category) {
  if (comfortPolicy === COMFORT_POLICIES.FRUGAL) {
    if (category === "comfort") {
      return "Especially helpful if the frugal plan has started to wear on people.";
    }

    if (["fuel", "water", "utility", "practical", "repair", "advice"].includes(category)) {
      return "Fits a frugal road plan.";
    }
  }

  if (isComfortFirstPolicy(comfortPolicy)) {
    if (category === "comfort") {
      return "Fits a comfort-first road plan.";
    }

    if (["fuel", "water", "utility"].includes(category)) {
      return "Higher day-to-day use makes this stop more tempting.";
    }
  }

  return "";
}

function renderCampScreen(state) {
  const run = state.run;
  const campContext = getCampContext(run);
  const overnightContext = campContext?.overnightContext ?? null;
  const selectedChoice = overnightContext?.actionsTaken?.find((entry) => entry.category === "stay_style") ?? null;
  const canResolveStay = Boolean(overnightContext);
  const scenicBackdrop = getCampScenicBackdrop();
  const weatherLine = getPrimaryForecastLine(run) || run.environment.currentWeather;
  const forcedRoadsideSleep = overnightContext?.actionsTaken?.some((entry) => entry.id === "forced_roadside_sleep");
  const availableChoices = forcedRoadsideSleep ? [] : getAvailableCampActions(run);
  const styleChoices = availableChoices.filter((action) => action.category === "stay_style");
  const serviceChoices = availableChoices.filter((action) => action.category === "service");
  const mapCampChoice = (action) => ({
    kicker: startCaseLabel(action.category),
    label: action.label,
    detail: `${action.description} ${action.effectSummary ? ` ${action.effectSummary}` : ""} ${buildCampActionLegibilityHint(action, run)}`,
    stateLabel: action.used ? "Chosen" : action.stateLabel,
    iconHtml: renderAssetIcon(getTownActionIcon(action.id), "choice-icon"),
    data: { action: "camp-action", value: action.id },
    active: action.used,
    disabled: !action.canUse
  });
  const styleItems = styleChoices.map(mapCampChoice);
  const serviceItems = serviceChoices.map(mapCampChoice);

  const settingText = [overnightContext?.stayLead, overnightContext?.locationSetupLine]
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
  const supportText = [
    overnightContext?.staySummary,
    overnightContext?.supportSummary,
    buildStayServiceLine(overnightContext)
  ]
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
  const stayLabel = forcedRoadsideSleep
    ? "Pull Over For The Night"
    : selectedChoice
      ? "Let The Night Begin"
      : "Choose How To Settle In";
  const choiceLead = forcedRoadsideSleep
    ? "The day has run too long. This is a rough fallback, but it gets everyone off the road."
    : selectedChoice?.effectSummary ?? "How do you want to settle in for the night?";

  return `
    <div class="app-shell app-shell--no-status screen-camp app-shell--with-return">
      ${renderTitleReturnButton()}
      <section class="panel camp-hub-panel${scenicBackdrop ? " camp-hub-panel--scenic" : ""}">
        ${scenicBackdrop ? renderScrollingScenicBackdrop(scenicBackdrop) : ""}
        <div class="camp-hub-header">
          <div class="camp-hub-title">
            <p class="eyebrow">${overnightContext?.stayLabel ?? "Location Stay"}</p>
            <h1 class="camp-hub-name">${overnightContext?.locationName ?? run.journey.currentLocationName}</h1>
          </div>
          <div class="camp-hub-tools">
            <button class="status-open-button" data-action="open-map">Journey Status</button>
            <button class="status-open-button" data-action="open-overlay" data-overlay="status">Closer Look</button>
          </div>
        </div>
        <div class="camp-status-strip" role="status" aria-label="Stay summary">
          <span>${overnightContext?.locationName ?? run.journey.currentLocationName}</span>
          <span class="camp-status-divider" aria-hidden="true">·</span>
          <span>${selectedChoice ? selectedChoice.label : "The evening is still open"}</span>
          <span class="camp-status-divider" aria-hidden="true">·</span>
          <span>${weatherLine}</span>
        </div>
        <div class="camp-evening-layout">
          <div class="camp-evening-copy">
            <div class="camp-evening-card">
              <p class="camp-hub-card-label">Where You Landed</p>
              <p class="camp-hub-card-text">${settingText || "The stop is ready to carry the night."}</p>
            </div>
            <div class="camp-evening-card">
              <p class="camp-hub-card-label">What This Place Is Like</p>
              <p class="camp-hub-card-text">${supportText || "The place will mostly carry the night on its own."}</p>
            </div>
          </div>
          <div class="camp-evening-card camp-evening-card--choices">
            <div class="camp-evening-card-head">
              <p class="camp-hub-card-label">Stay Style</p>
              <p class="camp-evening-choice-line">${choiceLead}</p>
            </div>
            ${
              forcedRoadsideSleep
                ? `<p class="body-copy">There is no real evening plan left. Everyone needs sleep more than another decision.</p>`
                : styleItems.length > 0
                ? renderChoiceGrid(styleItems)
                : `<p class="body-copy">This stop does not ask much from you. Let the place carry the night.</p>`
            }
          </div>
          ${
            serviceItems.length > 0
              ? `<div class="camp-evening-card camp-evening-card--choices">
                  <div class="camp-evening-card-head">
                    <p class="camp-hub-card-label">Take Care Of Supplies</p>
                    <p class="camp-evening-choice-line">Services are practical fixes. They can make tomorrow easier, but they spend time that the night could use.</p>
                  </div>
                  ${renderChoiceGrid(serviceItems)}
                </div>`
              : ""
          }
        </div>
        <div class="camp-hub-footer">
          <button
            class="title-menu-button title-menu-button--primary camp-hub-sleep-button"
            data-action="prepare-overnight"
            ${!canResolveStay || !selectedChoice ? "disabled" : ""}
          >
            <span>${stayLabel}</span>
          </button>
        </div>
        ${state.ui.overlay === "status" ? renderStatusOverlay(state) : ""}
      </section>
    </div>
  `;
}

function renderStopDiscoveryScreen(state) {
  const run = state.run;
  const options = getGeneratedStopOptions(run);
  const derived = getDerivedStatus(run);
  const latestTime = options[0]?.discoveredAtTime ?? "evening";
  const pushed = run.day.generatedStops?.pushedPastGoodStops === true;
  const discoveryCount = Number(run.day.generatedStops?.discoveryCount) || 0;
  const scenicBackdrop = getCampScenicBackdrop();
  const items = options.map((stop) => ({
    kicker: `${formatGeneratedStopType(stop)} | ${formatGeneratedStopTier(stop)}`,
    label: stop.name,
    detail: `${stop.description} ${buildGeneratedStopSignal(stop)} ${buildGeneratedStopPressureLine(stop, derived)}`,
    stateLabel: buildGeneratedStopStateLabel(stop),
    iconHtml: renderAssetIcon(getGeneratedStopIcon(stop), "choice-icon"),
    data: { action: "select-generated-stop", value: stop.id }
  }));
  const keepLookingCopy = buildKeepLookingCopy(run, latestTime, discoveryCount, derived);

  return renderShell({
    state,
    screenId: "stop_discovery",
    eyebrow: `Late Day | ${latestTime}`,
    title: "Somewhere To Land",
    lead: pushed
      ? "The road is getting darker, and every passed stop makes the next choice a little thinner."
      : "By late afternoon, you start watching for somewhere to spend the night while there is still enough light to choose well.",
    sceneVariant: "camp",
    backgroundHtml: scenicBackdrop ? renderScrollingScenicBackdrop(scenicBackdrop) : "",
    showSceneIllustration: !scenicBackdrop,
    showStatus: false,
    sceneCaption: derived.warnings.length
      ? `Watch: ${derived.warnings.slice(0, 2).map(getWarningLabel).join(", ")}.`
      : "The day has gone far enough to make tonight's stop matter.",
    primaryHtml: `
      ${renderSection(
        "Options Before Dark",
        options.length > 0
          ? renderChoiceGrid(items)
          : "<p class=\"body-copy\">No good stop has surfaced yet. You can keep looking, but the day is getting thin.</p>",
        "section-block--town-graph"
      )}
      ${renderSection(
        "Keep Going?",
        `<p class="body-copy">${keepLookingCopy.body}</p><p class="body-copy">${keepLookingCopy.riskLabel}: ${keepLookingCopy.risk}</p>`
      )}
    `,
    secondaryHtml: `
      ${renderSection(
        "What Matters Now",
        renderLedger([
          { label: "Electric", value: `${run.v2.resources.electric.charge}/${run.v2.resources.electric.capacity}` },
          { label: "Water", value: `${run.v2.resources.water.current}/${run.v2.resources.water.capacity}` },
          { label: "Waste", value: `${run.v2.resources.waste.current}/${run.v2.resources.waste.capacity}` },
          { label: "Outlook", value: derived.moraleDescriptor }
        ]),
        "section-block--compact"
      )}
      <p class="body-copy">${buildEveningResourcePressureLine(derived)}</p>
      <p class="body-copy">Safer stops protect the night. More memorable stops can lift the trip, but they usually ask more from water, waste, power, or daylight.</p>
    `,
    secondaryTitle: "Evening Read",
    actions: [
      {
        label: "Keep Looking",
        variant: "accent",
        data: { action: "push-generated-stops" }
      }
    ]
  });
}

function formatGeneratedStopType(stop) {
  return {
    roadside_pullout: "Roadside Pullout",
    public_land_camp: "Public Land",
    boondock_site: "Boondock Site",
    town_lot: "Town Edge",
    campground: "Campground",
    motel_paid: "Paid Stay",
    service_stop: "Service Stop",
    scenic_inconvenient: "Scenic Turnoff"
  }[stop.type] ?? "Evening Stop";
}

function buildGeneratedStopSignal(stop) {
  const service =
    stop.serviceAccess === "full"
      ? "Full services nearby."
      : stop.serviceAccess === "partial"
        ? "Some services nearby."
        : "No formal services.";
  const quality = getGeneratedStopTierPhrase(stop);
  const risk = stop.riskTags?.includes("late_day")
    ? "Late arrival narrows the margin."
    : stop.riskTags?.includes("forced")
      ? "This is a fallback, not a chosen night."
      : stop.serviceAccess === "none"
        ? "Supplies need to carry the night."
        : "It can steady supplies before morning.";
  return `${quality}. ${service} Comfort: ${startCaseText(stop.comfort ?? "low")}. ${risk}`;
}

function formatGeneratedStopTier(stop) {
  return {
    rough: "Rough",
    basic: "Basic",
    decent: "Decent",
    good: "Good",
    premium: "Premium",
    standout: "Standout"
  }[stop.valueTier ?? stop.qualityTier ?? stop.quality] ?? "Unknown Quality";
}

function getGeneratedStopTierPhrase(stop) {
  return {
    rough: "A rough place to land",
    basic: "Good enough for the night",
    decent: "A decent place to settle",
    good: "A good stop if you can spare the time",
    premium: "Comfortable and memorable",
    standout: "A rare find"
  }[stop.valueTier ?? stop.qualityTier ?? stop.quality] ?? "A place to land";
}

function buildGeneratedStopStateLabel(stop) {
  const time = stop.discoveredAtTime ?? "Evening";
  const tier = formatGeneratedStopTier(stop);
  if (stop.riskTags?.includes("late_day")) {
    return `${time} | Late ${tier}`;
  }
  return `${time} | ${tier}`;
}

function buildGeneratedStopPressureLine(stop, derived) {
  if (derived.warnings.length > 0 && stop.serviceAccess === "none") {
    return "This keeps the night memorable, but it will not fix the warning signs.";
  }
  if (derived.warnings.length > 0 && stop.serviceAccess !== "none") {
    return "This gives you a practical chance to answer the warning signs before morning.";
  }
  if (stop.valueTier === "standout" || stop.valueTier === "premium") {
    return "High upside if the supplies and mood can afford it.";
  }
  if (stop.valueTier === "rough") {
    return "Expect a harder night and more pressure tomorrow.";
  }
  return "A workable choice for where the day lands.";
}

function buildKeepLookingCopy(run, latestTime, discoveryCount, derived) {
  const pressure = Number(run.pressure) || 0;
  const riskParts = [];
  if (derived.warnings.length > 0) {
    riskParts.push("warnings are already active");
  }
  if (pressure >= 55) {
    riskParts.push("the cabin pressure is high");
  }
  if (discoveryCount >= 2) {
    riskParts.push("you have already passed several chances");
  }
  const riskMeta = getKeepLookingRiskMeta(discoveryCount, pressure, derived.warnings.length);

  if (discoveryCount <= 0) {
    return {
      body: `At ${latestTime}, one more look may reveal a better place, but it spends daylight you cannot get back.`,
      ...riskMeta,
      risk: riskParts.length
        ? `Because ${riskParts.join(" and ")}, pushing on is starting to carry real risk.`
        : "The first push is tempting. The second one is where the day can start turning against you."
    };
  }

  if (discoveryCount === 1) {
    return {
      body: `It is already ${latestTime}. Another search may improve the story, or leave you choosing from whatever remains.`,
      ...riskMeta,
      risk: riskParts.length
        ? `With ${riskParts.join(" and ")}, this can turn into a rough fallback fast.`
        : "Another pass raises pressure and makes rough stops more likely."
    };
  }

  return {
    body: `At ${latestTime}, the good window is mostly gone.`,
    ...riskMeta,
    risk: "Keeping on from here can force a roadside fallback, strain morale, and push water or waste into trouble."
  };
}

function getKeepLookingRiskMeta(discoveryCount, pressure, warningCount) {
  const score = discoveryCount * 2 + (pressure >= 70 ? 2 : pressure >= 50 ? 1 : 0) + Math.min(2, warningCount);

  if (score >= 5) {
    return { riskLabel: "Very High Risk", riskTone: "danger" };
  }
  if (score >= 3) {
    return { riskLabel: "High Risk", riskTone: "danger" };
  }
  if (score >= 1) {
    return { riskLabel: "Rising Risk", riskTone: "warning" };
  }
  return { riskLabel: "Low Risk", riskTone: "quiet" };
}

function buildEveningResourcePressureLine(derived) {
  if (derived.warnings.length === 0) {
    return "Supplies look workable for now, so the question is how much comfort or memorability you want to spend them on.";
  }
  return `This is getting tight: ${derived.warnings.slice(0, 3).map(formatWarningPressurePhrase).join(" ")} A practical stop can steady the night; a scenic one may still be worth it, but it asks more from the cabin.`;
}

function getGeneratedStopIcon(stop) {
  if (stop.electricAccess) {
    return getResourceIcon("battery");
  }
  if (stop.waterAccess) {
    return getResourceIcon("water");
  }
  if (stop.wasteAccess) {
    return getTownActionIcon("dump_waste");
  }
  return getTownActionIcon("take_in_the_sky");
}

function buildStayServiceLine(overnightContext) {
  if (!overnightContext?.services) {
    return "";
  }

  const supports = [
    overnightContext.services.electricHookup ? "electric support" : null,
    overnightContext.services.waterFill ? "water access" : null,
    overnightContext.services.wasteDump ? "waste handling" : null
  ].filter(Boolean);

  if (supports.length === 0) {
    return "Practical support is limited here.";
  }

  return `Support here includes ${supports.join(", ")}.`;
}

function buildCampActionLegibilityHint(action, run) {
  const id = String(action.id ?? "");
  const category = String(action.category ?? "");
  const derived = getDerivedStatus(run);

  if (category === "stay_style") {
    if (id.includes("conserve")) {
      return "Saves water and power, but everyone feels the strain by morning.";
    }
    if (id.includes("comfort")) {
      return "Better rest can help the cabin recover, though it asks more from water and electric.";
    }
    return "Ordinary use keeps the night simple without leaning hard either way.";
  }

  if (category === "service") {
    if (id.includes("dump")) {
      return "This can make tomorrow easier, especially before waste becomes hard to ignore.";
    }
    if (id.includes("water") || id.includes("refill")) {
      return "A little time here can keep the next stretch from feeling tight.";
    }
    if (id.includes("charge") || id.includes("electric") || id.includes("power")) {
      return "Shore power steadies the rig, but it is a practical stop, not a memory-maker.";
    }
    return "It helps the trip stay manageable, though the evening has less room afterward.";
  }

  return "";
}

function formatWarningPressurePhrase(flag) {
  const text = String(flag ?? "").toLowerCase();

  if (text.includes("water")) {
    return "Water's running lower than you'd like.";
  }
  if (text.includes("waste")) {
    return "Waste is becoming harder to ignore.";
  }
  if (text.includes("power") || text.includes("battery") || text.includes("electric")) {
    return "Solar and electric are not keeping up with the day.";
  }
  if (text.includes("morale") || text.includes("cabin") || text.includes("outlook")) {
    return "Everyone could use an easier night.";
  }

  return `${getWarningLabel(flag)} is worth watching.`;
}

function renderEventScreen(state) {
  if (!state.run.events.activeEvent) {
    return renderTravelScreen(state);
  }

  return renderActiveEventScreen(state);
}

function renderTravelBeatScreen(state) {
  const beat = state.run.day.travelSession?.travelFlavorBeat ?? null;

  if (!beat) {
    return renderTravelScreen(state);
  }

  return renderEventBeatScreen({
    state,
    screenId: "travel_beat",
    kicker: `Roadside Beat | ${beat.routeLabel}`,
    title: beat.title,
    body: beat.body,
    consequence: `The road keeps moving toward ${beat.nextStopName}.`,
    sceneVariant: beat.tone === "lift" ? "event_easy_road" : "event_roadside_encounter",
    tone: beat.tone ?? "neutral",
    actions: [{ label: "Continue", variant: "primary", data: { action: "continue-after-travel-beat" } }]
  });
}

function renderMiddayStopScreen(state) {
  const stop = getActiveTravelUtilityStop(state.run);

  if (!stop) {
    return renderTravelScreen(state);
  }

  const resolved = stop.state === "resolved";
  const body = resolved ? stop.resolvedText : stop.body;
  const consequence = resolved
    ? buildResolvedMiddayStopConsequence(stop)
    : buildMiddayStopPreview(stop);

  return renderEventBeatScreen({
    state,
    screenId: "midday_stop",
    kicker: `Midday Stop | ${stop.routeLabel ?? state.run.journey.currentSegmentLabel}`,
    title: stop.title,
    body,
    consequence,
    sceneVariant: stop.tone === "lift" ? "event_easy_road" : "event_roadside_encounter",
    tone: stop.tone ?? "neutral",
    actions: resolved
      ? [{ label: "Keep Driving", variant: "primary", data: { action: "continue-after-midday-stop" } }]
      : [
          { label: stop.stopLabel ?? "Stop Briefly", variant: "primary", data: { action: "resolve-midday-stop", choice: "stop" } },
          { label: stop.skipLabel ?? "Keep Driving", variant: "secondary", data: { action: "resolve-midday-stop", choice: "skip" } }
        ]
  });
}

function buildMiddayStopPreview(stop) {
  const pieces = [];
  const effects = stop.effects ?? {};

  if ((Number(effects.water) || 0) > 0) pieces.push("a little water");
  if ((Number(effects.waste) || 0) < 0) pieces.push("some waste relief");
  if ((Number(effects.hiddenMorale ?? effects.passengerMorale) || 0) > 0) pieces.push("a better cabin mood");
  if ((Number(effects.pressure) || 0) < 0) pieces.push("less pressure");

  const benefit = pieces.length > 0 ? pieces.join(", ") : "a short reset";
  const time = Number(stop.timeMinutes) || 0;
  const timeCopy = time > 0
    ? `It will cost about ${time} minutes of daylight.`
    : "It will cost a little daylight.";
  return `${timeCopy} It may give you ${benefit}, but it will not replace a proper evening stop.`;
}

function buildResolvedMiddayStopConsequence(stop) {
  if (stop.selectedChoice === "stop") {
    return "The break helps the middle of the day, but the evening stop still has to carry the night.";
  }
  const skipEffects = stop.skipEffects ?? {};
  if ((Number(skipEffects.pressure) || 0) > 0 || (Number(skipEffects.hiddenMorale ?? skipEffects.passengerMorale) || 0) < 0) {
    return "You saved daylight, but the skipped pause leaves a little more pressure in the cabin.";
  }
  return "You saved the daylight and folded back into the drive.";
}

function renderIncidentPromptScreen(state) {
  const run = state.run;
  const activeEvent = run.events.activeEvent;

  if (!activeEvent) {
    return renderTravelScreen(state);
  }

  const derived = getDerivedStatus(run);
  const prompt = buildIncidentPromptCopy(run, activeEvent, derived);

  return renderEventBeatScreen({
    state,
    screenId: "incident_prompt",
    kicker: `Roadside Moment | ${run.journey.currentSegmentLabel}`,
    title: prompt.title,
    body: prompt.body,
    sceneVariant: getEventSceneVariant(activeEvent),
    tone: getEventTone(activeEvent),
    actions: [{ label: "Continue", variant: "primary", data: { action: "reveal-incident" } }]
  });
}

function renderActiveEventScreen(state) {
  const run = state.run;
  const activeEvent = run.events.activeEvent;
  const resolved = activeEvent.state === "resolved";
  const copy = buildEventCopy(activeEvent, resolved);

  return renderEventBeatScreen({
    state,
    screenId: "event",
    kicker: formatEventEyebrow(run, activeEvent),
    title: activeEvent.title,
    body: copy.body,
    consequence: copy.consequence,
    sceneVariant: getEventSceneVariant(activeEvent),
    tone: getEventTone(activeEvent, resolved),
    actions: resolved
      ? [{ label: "Continue", variant: "primary", data: { action: "continue-after-event" } }]
      : activeEvent.type === "choice"
        ? activeEvent.choices.map((choice, index) => ({
            label: choice.label,
            variant: index === 0 ? "primary" : "secondary",
            data: { action: "resolve-event", choice: choice.id }
          }))
        : [{ label: "Continue", variant: "primary", data: { action: "resolve-event" } }]
  });
}

function getEventBeatBackdrop(tone) {
  if (tone === "lift") {
    return buildScenicBackdrop(goodSomethingScrolling);
  }

  if (tone === "uneasy") {
    return buildScenicBackdrop(badSomethingScrolling);
  }

  return buildScenicBackdrop(neutralSomethingScrolling);
}

function renderEventBeatScreen({
  state,
  screenId,
  kicker,
  title,
  body,
  consequence = "",
  sceneVariant,
  tone = "neutral",
  actions = []
}) {
  const backdrop = getEventBeatBackdrop(tone);

  return `
    <div class="app-shell app-shell--no-status app-shell--with-return screen-${screenId} screen-event-beat screen-event-beat--${tone}">
      ${renderTitleReturnButton()}
      <section class="panel event-beat-frame">
        ${renderScrollingScenicBackdrop(backdrop)}
        <section class="event-beat-panel">
          <div class="event-beat-copy">
            <p class="eyebrow event-beat-kicker">${kicker}</p>
            <h1>${title}</h1>
            <p class="event-beat-body">${body}</p>
            ${consequence ? `<p class="event-beat-consequence">${consequence}</p>` : ""}
          </div>
        </section>
        ${
          actions.length > 0
            ? `
              <div class="frame-actions event-beat-actions">
                <div class="action-stack ${actions.length === 1 ? "action-stack--single" : ""}">
                  ${actions.map((action) => renderEventBeatButton(action)).join("")}
                </div>
              </div>
            `
            : ""
        }
      </section>
    </div>
  `;
}

function renderEventBeatButton({ label, variant = "secondary", data = {}, disabled = false }) {
  const disabledAttr = disabled ? "disabled" : "";

  return `
    <button class="action-button action-button--${variant}" ${dataAttributes(data)} ${disabledAttr}>
      <span>${label}</span>
    </button>
  `;
}

function buildEventCopy(activeEvent, resolved) {
  const body = resolved
    ? activeEvent.resolvedBodyText ?? activeEvent.resolvedText ?? activeEvent.bodyText
    : activeEvent.bodyText;
  const consequence = resolved
    ? getEventConsequenceLine(activeEvent, body)
    : "";

  return {
    body,
    consequence
  };
}

function getEventConsequenceLine(activeEvent, currentBody) {
  const candidate = (activeEvent.resolvedText ?? "").trim();

  if (!candidate) {
    return "";
  }

  if (normalizeCopy(candidate) === normalizeCopy(currentBody)) {
    return "";
  }

  return candidate;
}

function getEventSceneVariant(activeEvent) {
  const family = activeEvent.artFamily ?? deriveEventArtFamily(activeEvent);
  return `event_${family}`;
}

function getEventTone(activeEvent, resolved = false) {
  const family = activeEvent.artFamily ?? deriveEventArtFamily(activeEvent);

  if (family === "tailwind_road" || family === "easy_road") {
    return "lift";
  }

  if (family === "roadside_encounter") {
    return activeEvent.presentation === "human_trouble" ? "uneasy" : "encounter";
  }

  if (family === "rough_road" || family === "ominous_road" || family === "dusty_road") {
    return resolved && activeEvent.category === "recovery" ? "encounter" : "uneasy";
  }

  return "neutral";
}

function deriveEventArtFamily(activeEvent) {
  if (activeEvent.presentation === "human_trouble") {
    return "roadside_encounter";
  }

  if (activeEvent.category === "travel") {
    return "neutral_road";
  }

  if (activeEvent.category === "rv_condition") {
    return "rough_road";
  }

  if (activeEvent.category === "energy") {
    return "ominous_road";
  }

  if (activeEvent.category === "recovery") {
    return "easy_road";
  }

  return "neutral_road";
}

function normalizeCopy(value) {
  return String(value)
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();
}

function isObstacleLandmarkStop(landmarkStop) {
  return landmarkStop?.presentation === "obstacle" && landmarkStop?.obstacle;
}

function isLandmarkObstacleResolved(activeRouteStop) {
  return activeRouteStop?.stateFlags?.includes("obstacle_resolved") ?? false;
}

function renderRouteStopResultCopy(resultRecord) {
  if (!resultRecord) {
    return "";
  }

  const lines = [];

  if (resultRecord.resultText) {
    lines.push(`<p class="body-copy">${resultRecord.resultText}</p>`);
  }

  if (
    resultRecord.effectSummary &&
    normalizeCopy(resultRecord.effectSummary) !== normalizeCopy(resultRecord.resultText)
  ) {
    lines.push(`<p class="body-copy">${resultRecord.effectSummary}</p>`);
  }

  if (
    resultRecord.intel?.text &&
    normalizeCopy(resultRecord.intel.text) !== normalizeCopy(resultRecord.resultText)
  ) {
    lines.push(`<p class="body-copy">${resultRecord.intel.text}</p>`);
  }

  if (
    resultRecord.intel?.effectSummary &&
    normalizeCopy(resultRecord.intel.effectSummary) !== normalizeCopy(resultRecord.effectSummary)
  ) {
    lines.push(`<p class="body-copy">${resultRecord.intel.effectSummary}</p>`);
  }

  return lines.join("");
}

function renderLandmarkScreen(state) {
  const run = state.run;
  const notice = run.day.routeArrivalNotice;
  const derived = getDerivedStatus(run);
  const routeSummary = derived.routeProgressSummary;
  const landmarkContext = getLandmarkStopContext(run);
  const landmarkStop = landmarkContext?.landmarkStop ?? null;
  const activeRouteStop = landmarkContext?.activeRouteStop ?? getActiveRouteStop(run);
  const isObstacleStop = isObstacleLandmarkStop(landmarkStop);
  const obstacle = isObstacleStop ? landmarkStop.obstacle : null;
  const obstacleResolved = isLandmarkObstacleResolved(activeRouteStop);
  const isTravelInterruptionObstacle =
    isObstacleStop && activeRouteStop?.returnPhase === DAY_PHASES.PLAYER_DECISION;
  const isInteractiveLandmarkStop =
    notice?.isInteractiveStop === true &&
    notice?.routeStopType === ROUTE_STOP_TYPES.LANDMARK &&
    landmarkStop !== null &&
    activeRouteStop?.stopType === ROUTE_STOP_TYPES.LANDMARK &&
    run.currentPhase === DAY_PHASES.ROUTE_STOP;
  const latestPoint =
    run.journey.routePoints.find((point) => point.id === notice?.id) ??
    run.day.reachedRoutePoints[run.day.reachedRoutePoints.length - 1] ??
    null;
  const arrivalEyebrow =
    notice?.kind === "destination"
      ? "Arrival"
      : latestPoint?.tag === "service"
        ? "Town Stop"
        : latestPoint?.tag === "ferry"
          ? "Ferry Crossing"
          : "Road Stop";
  const arrivalLead = buildArrivalLead(notice, latestPoint);
  const alsoPassed =
    Array.isArray(run.day.reachedRoutePoints) && run.day.reachedRoutePoints.length > 1
      ? run.day.reachedRoutePoints
          .filter((point) => point.id !== notice?.id)
          .map((point) => point.name)
      : [];
  const scenicBackdrop = getLandmarkScenicBackdrop(notice, latestPoint);

  if (!notice) {
    return renderTravelScreen(state);
  }

  if (notice.isTownStop) {
    return renderTownArrivalScreen(state);
  }

  if (!isInteractiveLandmarkStop) {
    return renderDramaticShell({
      state,
      screenId: "landmark",
      eyebrow: arrivalEyebrow,
      title: notice.title,
      lead: arrivalLead,
      sceneVariant: "landmark",
      sceneCaption: "",
      backgroundHtml: scenicBackdrop ? renderScrollingScenicBackdrop(scenicBackdrop) : "",
      showSceneIllustration: !scenicBackdrop,
      messageHtml: `
        <p class="dramatic-copy">${notice.body}</p>
        ${
          alsoPassed.length > 0
            ? `<p class="dramatic-consequence">You also passed ${alsoPassed.join(", ")} on this stretch.</p>`
            : ""
        }
      `,
      ledgerRows: buildGroundedLedgerRows(run, derived, routeSummary, { placeValue: notice.title }),
      actionHeading: "Continue",
      actions: [
        {
          label: "Continue",
          variant: "primary",
          data: { action: "continue-landmark" }
        }
      ]
    });
  }

  const availableActions = getAvailableLandmarkActions(run);
  const selectedAction =
    availableActions.find((action) => action.id === state.ui.landmarkActionId) ?? null;
  const latestResult =
    run.day.lastRouteStopActionResult?.stopType === ROUTE_STOP_TYPES.LANDMARK &&
    run.day.lastRouteStopActionResult?.stopId === landmarkStop.id
      ? run.day.lastRouteStopActionResult
      : null;
  const latestResultHtml = renderRouteStopResultCopy(latestResult);
  const quirkNotes = getLandmarkQuirkNotes(landmarkStop);
  const selectedObstacleActionIds = activeRouteStop?.pendingActionIds ?? [];
  const actionCount = run.day.routeStopActionsTaken.filter(
    (entry) =>
      entry.stopType === ROUTE_STOP_TYPES.LANDMARK && entry.stopId === landmarkStop.id
  ).length;
  const landmarkStatusHtml = renderStatusBand(state, {
    phaseLabel: isObstacleStop ? "Handling Obstacle" : "At Landmark Stop",
    journeyTitle: landmarkStop.name,
    journeyLine: `${
      isObstacleStop ? obstacle.title : landmarkStop.subtitle
    }. Next ${routeSummary.nextWaypointName} in ${routeSummary.nextWaypointMilesAway} mi.`,
    showWarnings: false
  });
  const canLeaveStop = !isObstacleStop || obstacleResolved;

  if (state.ui.landmarkView === "arrival") {
    return renderDramaticShell({
      state,
      screenId: "landmark",
      eyebrow: isObstacleStop
        ? `Obstacle | ${formatStopKindLabel(landmarkStop.stopKind)}`
        : `${formatStopKindLabel(landmarkStop.stopKind)} Stop`,
      title: landmarkStop.name,
      lead: isObstacleStop ? obstacle.title : landmarkStop.subtitle,
      sceneVariant: "landmark",
      sceneCaption: "",
      backgroundHtml: scenicBackdrop ? renderScrollingScenicBackdrop(scenicBackdrop) : "",
      showSceneIllustration: !scenicBackdrop,
      messageHtml: `
        <p class="dramatic-copy">${notice.body}</p>
        <p class="dramatic-consequence">${isObstacleStop ? obstacle.description : landmarkStop.flavor}</p>
        ${
          isObstacleStop
            ? `<p class="dramatic-trouble-note">${obstacle.stakes}</p>`
            : ""
        }
        <p class="dramatic-consequence">
          ${
            isObstacleStop
              ? isTravelInterruptionObstacle
                ? "Choose up to 2 actions before you attempt the obstacle."
                : "Choose how you want to handle the obstacle."
              : `You have ${activeRouteStop.actionsRemaining} action${
                  activeRouteStop.actionsRemaining === 1 ? "" : "s"
                } to use before you leave this stop.`
          }
        </p>
        ${
          alsoPassed.length > 0
            ? `<p class="dramatic-consequence">You also passed ${alsoPassed.join(", ")} on this stretch.</p>`
            : ""
        }
      `,
      ledgerRows: isObstacleStop
        ? [
            { label: "Place", value: landmarkStop.name },
            { label: "Obstacle", value: obstacle.title },
            { label: "Status", value: obstacleResolved ? "Handled" : "Decision needed" }
          ]
        : [
            { label: "Place", value: landmarkStop.name },
            { label: "Stop Kind", value: formatStopKindLabel(landmarkStop.stopKind) },
            { label: "Actions", value: `${activeRouteStop.actionsRemaining} left` }
          ],
      actionHeading: isObstacleStop ? "Obstacle" : "Landmark",
      actions: [
        {
          label: isTravelInterruptionObstacle
            ? "Prepare For Obstacle"
            : isObstacleStop
              ? "Handle The Obstacle"
              : "Look Around",
          variant: "primary",
          data: { action: "continue-landmark-arrival" }
        }
      ]
    });
  }

  if (selectedAction && !isTravelInterruptionObstacle) {
    const selectedAvailabilityCopy = selectedAction.used
      ? isObstacleStop
        ? "You already used this choice at this obstacle."
        : "You already used this stop during this visit."
      : selectedAction.canUse
        ? isObstacleStop
          ? "You can still choose this line through the obstacle."
          : "You can still take this stop before you leave."
        : selectedAction.stateLabel ||
          (isObstacleStop
            ? "This choice is not available right now."
            : "This stop is not available right now.");
    const selectedActionLabel = selectedAction.used
      ? "Already Used"
      : selectedAction.canUse
        ? isObstacleStop
          ? "Choose This Line"
          : "Use This Stop"
        : selectedAction.stateLabel || "Unavailable";

    return renderShell({
      state,
      screenId: "landmark",
      eyebrow: isObstacleStop
        ? `Obstacle Choice | ${landmarkStop.name}`
        : `${formatStopKindLabel(landmarkStop.stopKind)} Stop | ${landmarkStop.name}`,
      title: selectedAction.label,
      lead: selectedAction.description,
      sceneVariant: "landmark",
      sceneCaption: "",
      backgroundHtml: scenicBackdrop ? renderScrollingScenicBackdrop(scenicBackdrop) : "",
      showSceneIllustration: !scenicBackdrop,
      statusHtml: landmarkStatusHtml,
      primaryHtml: isObstacleStop
        ? `
            ${renderSection(
              "The Obstacle",
              `
                <p class="body-copy">${obstacle.description}</p>
                <p class="body-copy">${obstacle.stakes}</p>
              `
            )}
            ${renderSection(
              "This Choice",
              renderLedger([
                { label: "Action Use", value: selectedAction.budgetLabel },
                { label: "Effect", value: selectedAction.effectSummary },
                { label: "Status", value: obstacleResolved ? "Handled" : "Decision needed" }
              ])
            )}
            ${renderSection(
              "What It Means",
              `
                <p class="body-copy">${selectedAction.description}</p>
                <p class="body-copy">${selectedAvailabilityCopy}</p>
              `
            )}
            ${
              selectedAction.usedRecord
                ? renderSection("What Happened", renderRouteStopResultCopy(selectedAction.usedRecord))
                : ""
            }
          `
        : `
            ${renderSection(
              "This Stop",
              renderLedger([
                { label: "Action Use", value: selectedAction.budgetLabel },
                { label: "Effect", value: selectedAction.effectSummary },
                { label: "Place", value: landmarkStop.name }
              ])
            )}
            ${renderSection(
              "What It Offers",
              `
                <p class="body-copy">${selectedAction.description}</p>
                <p class="body-copy">${selectedAvailabilityCopy}</p>
              `
            )}
            ${
              selectedAction.usedRecord
                ? renderSection("What Happened", renderRouteStopResultCopy(selectedAction.usedRecord))
                : ""
            }
          `,
      secondaryHtml: isObstacleStop
        ? `
            <p class="body-copy">${
              obstacleResolved ? "The obstacle is handled." : "The obstacle is still waiting on a decision."
            }</p>
            <p class="body-copy">${activeRouteStop.actionsRemaining} action${
              activeRouteStop.actionsRemaining === 1 ? "" : "s"
            } remain at this stop.</p>
          `
        : `
            <p class="body-copy">${activeRouteStop.actionsRemaining} action${
              activeRouteStop.actionsRemaining === 1 ? "" : "s"
            } remain at this stop.</p>
          `,
      actions: [
        {
          label: selectedActionLabel,
          variant: "primary",
          data: { action: "landmark-action", value: selectedAction.id },
          disabled: !selectedAction.canUse
        },
        {
          label: isObstacleStop ? "Obstacle Choices" : "Landmark Stops",
          variant: "secondary",
          data: { action: "close-landmark-action" }
        },
        {
          label: canLeaveStop ? (isObstacleStop ? "Continue On" : "Leave Stop") : "Handle Obstacle First",
          variant: canLeaveStop ? "accent" : "secondary",
          data: { action: "leave-landmark" },
          disabled: !canLeaveStop
        }
      ]
    });
  }

  const landmarkActionItems = availableActions.map((action) => ({
    kicker: isTravelInterruptionObstacle
      ? `${action.budgetLabel} action | Obstacle Choice`
      : `${action.budgetLabel} action | ${startCaseLabel(action.category)}`,
    label: action.label,
    detail: buildPolicyChoiceDetail(run, action, {
      usedText: action.used && action.usedRecord ? action.usedRecord.resultText : ""
    }),
    stateLabel: action.stateLabel,
    iconHtml: renderAssetIcon(getResourceIcon(action.iconId), "choice-icon"),
    data: {
      action: isTravelInterruptionObstacle ? "toggle-landmark-action" : "open-landmark-action",
      value: action.id,
      view: isTravelInterruptionObstacle ? "choices" : "menu"
    },
    active: isTravelInterruptionObstacle ? action.selected : false
  }));

  if (isTravelInterruptionObstacle) {
    const selectedCount = selectedObstacleActionIds.length;
    const selectedActions = availableActions.filter((action) =>
      selectedObstacleActionIds.includes(action.id)
    );
    const hasResolvingAction = selectedActions.some((action) =>
      action.stateChanges?.setFlags?.includes("obstacle_resolved")
    );
    const canConfirmObstaclePlan = selectedCount > 0 && hasResolvingAction;

    return `
      <div class="app-shell app-shell--with-status app-shell--with-return screen-landmark">
        ${renderTitleReturnButton()}
        ${landmarkStatusHtml}
        <section class="panel camp-actions-panel${scenicBackdrop ? " camp-actions-panel--scenic" : ""}">
          ${scenicBackdrop ? renderScrollingScenicBackdrop(scenicBackdrop) : ""}
          <div class="camp-actions-header">
            <h1>Obstacle Actions</h1>
            <p class="camp-actions-subtext">Choose up to 2 actions, then confirm the obstacle attempt.</p>
          </div>
          <div class="camp-actions-body">
            <div class="camp-actions-result">
              <p>${obstacle.title}</p>
              <p>${obstacle.description}</p>
              <p>${obstacle.stakes}</p>
              <p>Select up to 2 actions. At least one selected action must actually get you through the obstacle.</p>
            </div>
            ${
              landmarkActionItems.length > 0
                ? renderChoiceGrid(
                    landmarkActionItems.map((action) => ({
                      ...action,
                      stateLabel: action.active ? "Selected" : action.stateLabel
                    }))
                  )
                : `<p class="body-copy">The obstacle is already handled.</p>`
            }
            ${
              quirkNotes.length > 0
                ? renderSection("What Matters Here", renderBulletList(quirkNotes))
                : ""
            }
          </div>
          <div class="camp-actions-footer">
            <button
              class="title-menu-button title-menu-button--primary"
              data-action="confirm-landmark-plan"
              ${!canConfirmObstaclePlan ? "disabled" : ""}
            >
              <span>Confirm Obstacle Plan</span>
            </button>
          </div>
          ${state.ui.overlay === "status" ? renderStatusOverlay(state) : ""}
        </section>
      </div>
    `;
  }

  if (false && isObstacleStop && state.ui.landmarkView === "choices") {
    return `
      <div class="app-shell app-shell--with-status app-shell--with-return screen-landmark">
        ${renderTitleReturnButton()}
        ${landmarkStatusHtml}
        <section class="panel camp-actions-panel${scenicBackdrop ? " camp-actions-panel--scenic" : ""}">
          ${scenicBackdrop ? renderScrollingScenicBackdrop(scenicBackdrop) : ""}
          <div class="camp-actions-header">
            <h1>Obstacle Choices</h1>
            <p class="camp-actions-subtext">${obstacle.title} · ${activeRouteStop.actionsRemaining} action${
              activeRouteStop.actionsRemaining === 1 ? "" : "s"
            } left</p>
          </div>
          <div class="camp-actions-body">
            ${
              latestResultHtml
                ? `
                  <div class="camp-actions-result">
                    ${latestResultHtml}
                  </div>
                `
                : `
                  <div class="camp-actions-result">
                    <p>${obstacle.description}</p>
                    <p>${obstacle.stakes}</p>
                  </div>
                `
            }
            ${
              landmarkActionItems.length > 0
                ? renderChoiceGrid(landmarkActionItems)
                : `<p class="body-copy">The obstacle is already handled.</p>`
            }
          </div>
          <div class="camp-actions-footer">
            <button class="title-menu-button title-menu-button--primary" data-action="close-landmark-choices">
              <span>Back To Obstacle</span>
            </button>
          </div>
          ${state.ui.overlay === "status" ? renderStatusOverlay(state) : ""}
        </section>
      </div>
    `;
  }

  if (false && isObstacleStop) {
    return `
      <div class="app-shell app-shell--with-status app-shell--with-return screen-landmark">
        ${renderTitleReturnButton()}
        ${landmarkStatusHtml}
        <section class="panel camp-hub-panel${scenicBackdrop ? " camp-hub-panel--scenic" : ""}">
          ${scenicBackdrop ? renderScrollingScenicBackdrop(scenicBackdrop) : ""}
          <div class="camp-hub-header">
            <div class="camp-hub-title">
              <p class="eyebrow">Obstacle At ${formatStopKindLabel(landmarkStop.stopKind)}</p>
              <h1 class="camp-hub-name">${landmarkStop.name}</h1>
            </div>
          </div>
          <div class="camp-hub-cards">
            <div class="camp-hub-card camp-hub-card--setting">
              <p class="camp-hub-card-label">The Obstacle</p>
              <div class="camp-hub-card-body">
                <strong class="camp-hub-card-name">${obstacle.title}</strong>
                <p class="camp-hub-card-text">${obstacle.description}</p>
              </div>
            </div>
            <div class="camp-hub-card camp-hub-card--camp">
              <p class="camp-hub-card-label">Decision Status</p>
              <div class="camp-hub-card-body">
                <span class="camp-hub-card-subtext">${obstacle.stakes}</span>
                <span class="camp-hub-card-plan-count">${obstacleResolved ? "Obstacle handled" : "Decision needed"}</span>
                <span class="camp-hub-card-plan-item">${activeRouteStop.actionsRemaining} action${
                  activeRouteStop.actionsRemaining === 1 ? "" : "s"
                } left</span>
                <span class="camp-hub-card-plan-item">Next stop: ${routeSummary.nextWaypointName} | ${routeSummary.nextWaypointMilesAway} mi</span>
              </div>
            </div>
            <div class="camp-hub-card camp-hub-card--plan">
              <p class="camp-hub-card-label">${latestResult ? "Latest Result" : "Your Choice"}</p>
              <div class="camp-hub-card-body${latestResult ? "" : " camp-hub-card-body--empty"}">
                ${
                  latestResult
                    ? latestResultHtml
                    : `
                      <span class="camp-hub-card-empty-label">No choice committed yet</span>
                      <span class="camp-hub-card-subtext">Inspect first if you want a better read, but the road still wants a real line through.</span>
                    `
                }
              </div>
              <button class="camp-hub-card-button" data-action="open-landmark-choices">
                <span>${latestResult ? "Review Choices" : "Choose A Line"}</span>
              </button>
            </div>
          </div>
          <div class="camp-hub-footer">
            <button
              class="title-menu-button${canLeaveStop ? " title-menu-button--primary" : ""} camp-hub-sleep-button"
              data-action="leave-landmark"
              ${!canLeaveStop ? "disabled" : ""}
            >
              <span>${canLeaveStop ? "Continue On" : "Handle Obstacle First"}</span>
            </button>
          </div>
          ${state.ui.overlay === "status" ? renderStatusOverlay(state) : ""}
        </section>
      </div>
    `;
  }

  return renderShell({
    state,
    screenId: "landmark",
    eyebrow: isObstacleStop
      ? `Obstacle At ${formatStopKindLabel(landmarkStop.stopKind)}`
      : `At ${formatStopKindLabel(landmarkStop.stopKind)}`,
    title: landmarkStop.name,
    lead: isObstacleStop ? obstacle.title : landmarkStop.subtitle,
    sceneVariant: "landmark",
    sceneCaption: "",
    backgroundHtml: scenicBackdrop ? renderScrollingScenicBackdrop(scenicBackdrop) : "",
    showSceneIllustration: !scenicBackdrop,
    statusHtml: landmarkStatusHtml,
    primaryHtml: isObstacleStop
      ? `
          ${renderSection(
            "The Obstacle",
            `
              <p class="body-copy">${obstacle.description}</p>
              <p class="body-copy">${obstacle.stakes}</p>
              ${
                quirkNotes.length > 0
                  ? renderBulletList(quirkNotes)
                  : ""
              }
            `
          )}
          ${renderSection(
            "Decision Status",
            renderLedger([
              { label: "Status", value: obstacleResolved ? "Handled" : "Decision Needed" },
              { label: "Actions Left", value: `${activeRouteStop.actionsRemaining}` },
              { label: "Next Stop", value: `${routeSummary.nextWaypointName} | ${routeSummary.nextWaypointMilesAway} mi` }
            ])
          )}
          ${renderSection(
            "Your Choices",
            landmarkActionItems.length > 0
              ? renderChoiceGrid(landmarkActionItems)
              : `<p class="body-copy">The obstacle is already handled.</p>`
          )}
        `
      : `
          ${renderSection(
            "Place Mood",
            `
              <p class="body-copy">${landmarkStop.flavor}</p>
              ${
                quirkNotes.length > 0
                  ? renderBulletList(quirkNotes)
                  : ""
              }
            `
          )}
          ${renderSection(
            "Visit Budget",
            renderLedger([
              { label: "Actions Left", value: `${activeRouteStop.actionsRemaining}` },
              { label: "Visit Size", value: `${activeRouteStop.visitBudget}` },
              { label: "Next Stop", value: `${routeSummary.nextWaypointName} | ${routeSummary.nextWaypointMilesAway} mi` }
            ])
          )}
          ${renderSection(
            "Stop Actions",
            landmarkActionItems.length > 0
              ? renderChoiceGrid(landmarkActionItems)
              : `<p class="body-copy">This stop is quiet enough that there is nothing practical to do here now.</p>`
          )}
        `,
    secondaryHtml: latestResult
      ? `
          ${latestResultHtml}
          <p class="body-copy">${
            actionCount > 0
              ? `${actionCount} landmark stop${actionCount === 1 ? "" : "s"} used this visit.`
              : "No stop actions used yet."
          }</p>
        `
      : `
          <p class="body-copy">${
            isObstacleStop
              ? "Pick how to get through this place. Inspect first if you want a better read, but the road still wants a real choice."
              : "Take one or two small place-specific actions, then leave when the road is ready to move again."
          }</p>
          <p class="body-copy">${
            actionCount > 0
              ? `${actionCount} landmark stop${actionCount === 1 ? "" : "s"} used this visit.`
              : "No stop actions used yet."
          }</p>
        `,
    secondaryTitle: isObstacleStop
      ? latestResult
        ? "Latest Result"
        : "Decision"
      : latestResult?.intel
        ? "Latest Tip"
        : "Latest Stop",
    actions: [
      {
        label: canLeaveStop ? (isObstacleStop ? "Continue On" : "Leave Stop") : "Handle Obstacle First",
        variant: "primary",
        data: { action: "leave-landmark" },
        disabled: !canLeaveStop
      }
    ]
  });
}

function renderTownArrivalScreen(state) {
  return renderTownScreen(state);
}

function renderTownScreen(state) {
  const run = state.run;
  const notice = run.day.routeArrivalNotice;
  const townContext = getTownContext(run);
  const activeRouteStop = townContext?.activeRouteStop ?? getActiveRouteStop(run);
  const inTown =
    run.currentPhase === DAY_PHASES.ROUTE_STOP &&
    activeRouteStop?.stopType === ROUTE_STOP_TYPES.TOWN;
  const scenicBackdrop = getTownScenicBackdrop(state);
  const town = townContext?.town ?? null;
  const availableDestinations = getAvailableTownDestinations(run);
  const townServices = getAvailableTownActions(run);
  const continueDrivingDestination = availableDestinations.find((entry) => entry.isForwardSpine) ?? null;
  const selectedDestination =
    availableDestinations.find((entry) => entry.id === state.ui.townDestinationId) ??
    getEffectiveTownDestination(run);
  const selectedDestinationIsStay = Boolean(selectedDestination) && !selectedDestination.isForwardSpine;
  const forwardTravelCopy = getTownForwardTravelCopy(activeRouteStop);
  const isNightPushOption = activeRouteStop?.returnPhase === DAY_PHASES.CAMP_DECISION;
  const confirmingNightPush = isNightPushOption && state.ui.townNightPushConfirm === true;
  if (!inTown || !town || !activeRouteStop) {
    return renderTravelScreen(state);
  }
  const graphHtml =
    availableDestinations.length > 0
      ? renderTownRouteGraph({
          town,
          destinations: availableDestinations,
          selectedDestinationId: selectedDestination?.id ?? null,
          expandedGroupId: state.ui.townGraphExpandedGroupId ?? null
        })
      : `<p class="body-copy">No onward stops are ready from this hub yet.</p>`;
  const townToolsHtml = `
    <div class="town-screen-tools" aria-label="Town tools">
      <button class="status-open-button" data-action="open-map">Journey Details</button>
      <button class="status-open-button" data-action="open-overlay" data-overlay="status">Closer Look</button>
    </div>
  `;
  const openTownDisclosureId = state.ui.townStopDisclosureId ?? null;
  const serviceHtml = townServices.length > 0
    ? renderTownStopDisclosure(
        "service_options",
        "Take Care Of Supplies",
        renderChoiceGrid(
          townServices.map((action) => ({
            kicker: action.budgetLabel,
            label: action.label,
            detail: `${action.description} ${action.effectSummary ? action.effectSummary : ""}`,
            stateLabel: action.used ? "Used" : action.stateLabel,
            iconHtml: renderAssetIcon(getTownActionIcon(action.id), "choice-icon"),
            data: { action: "town-service", value: action.id },
            active: action.used,
            disabled: !action.canUse
          }))
        ),
        openTownDisclosureId === "service_options"
      )
    : "";
  const detailHtml = selectedDestination
    ? `
        <section class="town-stop-summary" aria-label="Selected stop">
          <div class="town-stop-summary-head">
            <div class="town-stop-summary-copy">
              <p class="eyebrow">Where Tonight Could Go</p>
              <h2 class="town-stop-summary-title">${selectedDestination.label}</h2>
              <p class="town-stop-summary-line">${
                selectedDestination.isForwardSpine
                  ? forwardTravelCopy.summaryLine
                  : buildTownDestinationSummaryLine(selectedDestination)
              }</p>
            </div>
            <div class="town-stop-summary-distance">${selectedDestination.distanceMiles} mi</div>
          </div>
          <div class="town-stop-summary-meta">
            <span>${formatTownDestinationType(selectedDestination)}</span>
            <span>Road Risk ${startCaseText(selectedDestination.risk ?? "low")}</span>
            ${
              selectedDestination.isForwardSpine
                ? '<span>Northbound</span>'
                : ""
            }
          </div>
        </section>
        ${renderTownStopDisclosure(
          "more_about",
          "What This Stop Feels Like",
          `
            <p class="body-copy">${selectedDestination.description ?? selectedDestination.subtitle}</p>
            <p class="body-copy">${selectedDestination.arrivalText ?? "The next leg carries you straight there."}</p>
          `,
          openTownDisclosureId === "more_about"
        )}
        ${renderTownStopDisclosure(
          "trip_signals",
          "Trip Signals",
          renderLedger([
            {
              label: "Water",
              value: selectedDestination.resourceEffects?.water ?? "Steady draw"
            },
            {
              label: "Power",
              value: selectedDestination.resourceEffects?.power ?? "Balanced road use"
            },
            {
              label: "Waste",
              value: selectedDestination.resourceEffects?.waste ?? "Normal buildup"
            }
          ]),
          openTownDisclosureId === "trip_signals"
        )}
        ${renderTownStopDisclosure(
          "why_it_works",
          "Why It Could Work",
          `
            <p class="body-copy">${selectedDestination.recommendationReason ?? buildTownDestinationLaunchLine(selectedDestination)}</p>
            <p class="body-copy">${buildTownDestinationLaunchLine(selectedDestination)}</p>
          `,
          openTownDisclosureId === "why_it_works"
        )}
        ${serviceHtml}
      `
    : `
        <section class="town-stop-summary" aria-label="Selected stop">
          <p class="eyebrow">Where Tonight Could Go</p>
          <p class="body-copy">No stop is chosen yet. If you keep the route moving north from here, that line will be used.</p>
        </section>
        ${serviceHtml}
      `;

  return renderShell({
    state,
    screenId: "town",
    eyebrow: "You've Reached",
    title: town.name,
    lead: town.subtitle,
    sceneVariant: "town",
    backgroundHtml: scenicBackdrop ? renderScrollingScenicBackdrop(scenicBackdrop) : "",
    showSceneIllustration: !scenicBackdrop,
    showStatus: false,
    sceneCaption:
      availableDestinations.length > 0
        ? `${availableDestinations.length} stop${availableDestinations.length === 1 ? "" : "s"} can be reached from here.`
        : "No onward stops are ready from this hub yet.",
    primaryHtml: confirmingNightPush
      ? `${townToolsHtml}${renderTownNightPushWarning(town, continueDrivingDestination)}`
      : `${townToolsHtml}${renderSection("City Map", graphHtml, "section-block--town-graph")}`,
    secondaryHtml: confirmingNightPush ? detailHtml : detailHtml,
    secondaryTitle: confirmingNightPush ? "What This Means" : selectedDestination ? "Tonight's Option" : "Town Hub",
    actions: confirmingNightPush
      ? [
          {
            label: "Push On After Dark",
            variant: "accent",
            data: { action: "continue-town-driving" },
            disabled: !continueDrivingDestination
          },
          {
            label: "Stay In Town",
            variant: "primary",
            data: { action: "cancel-town-night-push" }
          }
        ]
      : [
          {
            label: selectedDestinationIsStay ? "Stay Here Tonight" : "Choose A Place For Tonight",
            variant: "primary",
            data: { action: "launch-town-destination" },
            disabled: availableDestinations.length === 0 || !selectedDestinationIsStay
          },
          {
            label: forwardTravelCopy.actionLabel,
            variant: isNightPushOption ? "accent" : "secondary",
            data: { action: isNightPushOption ? "open-town-night-push-confirm" : "continue-town-driving" },
            disabled: !continueDrivingDestination
          }
        ]
  });
}

function renderTownNightPushWarning(town, continueDrivingDestination) {
  return `
    ${renderSection(
      "Push On After Dark",
      `
        <p class="body-copy">${town.name} has places to stop. Leaving now means giving up the evening and turning this arrival into an after-dark push.</p>
        <p class="body-copy">Visibility gets worse, everyone gets quieter, and the night may end at the first shoulder that feels safe enough.</p>
      `
    )}
    ${renderSection(
      "What It Will Likely Cost",
      renderLedger([
        { label: "Rest", value: "A rough roadside night", className: "delta-down" },
        { label: "Outlook", value: "The mood takes a hard hit", className: "delta-down" },
        { label: "RV", value: "More wear after dark", className: "delta-down" },
        {
          label: "Target",
          value: continueDrivingDestination
            ? `${continueDrivingDestination.label} remains the northbound line`
            : "No northbound line is ready right now"
        }
      ])
    )}
  `;
}

function getTownForwardTravelCopy(activeRouteStop) {
  if (activeRouteStop?.returnPhase === DAY_PHASES.CAMP_DECISION) {
    return {
      actionLabel: "Keep Driving Tonight",
      summaryLine: "You will keep moving north, but you are giving up a proper stay for tonight."
    };
  }

  return {
    actionLabel: "Keep Driving Today",
    summaryLine: "You will keep moving north without choosing a stay here."
  };
}

function renderTownStopDisclosure(id, title, body, isOpen = false) {
  return `
    <section class="panel disclosure-panel town-stop-disclosure${isOpen ? " is-open" : ""}">
      <button
        class="town-stop-disclosure-toggle"
        data-action="toggle-town-stop-disclosure"
        data-value="${id}"
        aria-expanded="${isOpen ? "true" : "false"}"
      >
        <span>${title}</span>
        <span class="town-stop-disclosure-mark" aria-hidden="true">${isOpen ? "−" : "+"}</span>
      </button>
      ${
        isOpen
          ? `
              <div class="disclosure-body">
                ${body}
              </div>
            `
          : ""
      }
    </section>
  `;
}

function renderDestinationArrivalScreen(state) {
  const run = state.run;
  const campContext = getCampContext(run);
  const overnightContext = campContext?.overnightContext ?? run.day.overnightContext ?? null;
  const scenicBackdrop = getCampScenicBackdrop();

  if (!overnightContext || run.currentPhase !== DAY_PHASES.CAMP_DECISION) {
    return renderCampScreen(state);
  }

  const arrivalLines = buildDestinationArrivalLines(run, overnightContext);

  return renderDramaticShell({
    state,
    screenId: "destination_arrival",
    eyebrow: "Arrival",
    title: overnightContext.locationName,
    lead: overnightContext.locationLabel,
    sceneVariant: "camp",
    sceneCaption: "",
    backgroundHtml: scenicBackdrop ? renderScrollingScenicBackdrop(scenicBackdrop) : "",
    showSceneIllustration: !scenicBackdrop,
    messageHtml: arrivalLines.map((line, index) => `<p class="${index === 0 ? "dramatic-copy" : "dramatic-consequence"}">${line}</p>`).join(""),
    actions: [
      {
        label: "Settle In For The Night",
        variant: "primary",
        data: { action: "continue-destination-arrival" }
      }
    ]
  });
}

function formatTownDestinationType(destination) {
  return {
    premium_boondock: "Premium Boondock",
    poor_boondock: "Poor Boondock",
    gas_station: "Gas Station",
    rv_park: "RV Park",
    scenic_stop: "Scenic Stop",
    route_connector: "Continue Route",
    destination: "Final Stop"
  }[destination.category] ?? "Destination";
}

function buildTownDestinationSummaryLine(destination) {
  if (destination.recommendationReason) {
    return destination.recommendationReason;
  }

  if (destination.isForwardSpine) {
    return "Keeps the trip on the main coastal line.";
  }

  return "A named stop with a direct leg out of town.";
}

function startCaseText(value) {
  return String(value)
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function buildTownDestinationLaunchLine(destination) {
  if (destination.isForwardSpine) {
    return "This keeps the trip on the main coastal line and starts the next northbound leg.";
  }

  return "This starts a direct leg out of town toward this named destination.";
}

function buildTownDescriptorLine(town, notice) {
  const descriptor = typeof town?.subtitle === "string" && town.subtitle.trim().length > 0
    ? town.subtitle.trim()
    : notice?.body ?? "A coastal stop where the side roads start to matter.";

  return descriptor.endsWith(".") ? descriptor : `${descriptor}.`;
}

function buildTownContextHint(town, availableDestinations) {
  const forwardDestination = availableDestinations.find((entry) => entry.isForwardSpine) ?? availableDestinations[0] ?? null;

  if (forwardDestination) {
    return `Stop here, or continue north toward ${forwardDestination.label}.`;
  }

  return `${town?.name ?? "This town"} opens the next leg of the trip.`;
}

function buildDestinationArrivalLines(run, overnightContext) {
  const weatherType = run.environment.weatherProfile?.weatherType ?? "";
  const weatherShelter = overnightContext.weatherShelter ?? "moderate";
  const scenicValue = Number(overnightContext.scenicValue) || 0;
  const siteQuality = overnightContext.siteQuality ?? "steady";
  const siteCategory = overnightContext.siteCategory ?? "";

  const lines = [];

  if (siteCategory === "rv_park" || overnightContext.locationType === "campground") {
    lines.push("You ease into the site, level out, and let the noise of the road fall away.");
  } else if (siteCategory === "gas_station" || overnightContext.locationType === "service_edge") {
    lines.push("You pull in near the lights, get parked, and give the rig a practical place to rest.");
  } else if (siteQuality === "rough" || siteCategory === "roadside_fallback") {
    lines.push("You get parked, do a quick look around, and make peace with the stop for what it is.");
  } else if (scenicValue >= 3 || siteQuality === "premium" || siteQuality === "good") {
    lines.push("You pull in with enough light left to look around before dark and take in where you landed.");
  } else {
    lines.push("You pull off, get settled into place, and let the day come down a notch.");
  }

  if (weatherType === "rain") {
    lines.push(weatherShelter === "high" ? "It feels sheltered once the engine is off and the doors are shut." : "The weather keeps you moving with a little more purpose than usual.");
  } else if (weatherShelter === "high") {
    lines.push("Once you step out, the place feels sheltered enough to make the night seem manageable.");
  } else if (scenicValue >= 3) {
    lines.push("The air stays open around you, and the place gives you a real reason to be outside for a bit.");
  } else if (siteQuality === "rough" || siteCategory === "roadside_fallback") {
    lines.push("It is not much to look at, but it will hold for the night.");
  } else {
    lines.push("The place is quiet enough, and that is enough to start from.");
  }

  return lines.slice(0, 2);
}

function renderNarrativeParagraphs(lines) {
  return lines
    .filter((line) => typeof line === "string" && line.trim().length > 0)
    .map((line) => `<p class="body-copy">${line}</p>`)
    .join("");
}

function renderSummaryScreen(state) {
  const run = state.run;
  const derived = getDerivedStatus(run);
  const townOnlyDay = run.day.dailyMilesDriven === 0 && run.day.townActionsTaken.length > 0;
  const routeSummary = derived.routeProgressSummary;
  const scenicBackdrop = getSummaryScenicBackdrop(run);
  const eyebrow = townOnlyDay ? "Evening In Town" : `Nightfall | ${run.journey.currentLocationName}`;
  const title = townOnlyDay ? "A Town Day" : "By Morning";
  const lead = townOnlyDay
    ? "Town helped steady things, though the road had to wait."
    : "Morning is here. Here is what the night changed, and how the road feels now.";
  const summaryRows = townOnlyDay
    ? [
        { label: "Electric", value: formatSigned(run.day.dailyBatteryDelta), className: getDeltaClass(run.day.dailyBatteryDelta) },
        { label: "Water", value: formatSigned(run.day.dailyWaterDelta), className: getDeltaClass(run.day.dailyWaterDelta) },
        { label: "Waste", value: formatSigned(run.day.dailyWasteDelta ?? 0), className: getDeltaClass(run.day.dailyWasteDelta ?? 0) },
        { label: "Trip Feel", value: getDailyTripFeelLine(run) }
      ]
    : [
        { label: "Miles driven", value: `${run.day.dailyMilesDriven}`, className: getDeltaClass(run.day.dailyMilesDriven) },
        { label: "Electric", value: formatSigned(run.day.dailyBatteryDelta), className: getDeltaClass(run.day.dailyBatteryDelta) },
        { label: "Water", value: formatSigned(run.day.dailyWaterDelta), className: getDeltaClass(run.day.dailyWaterDelta) },
        { label: "Waste", value: formatSigned(run.day.dailyWasteDelta ?? 0), className: getDeltaClass(run.day.dailyWasteDelta ?? 0) },
        { label: "Trip Feel", value: getDailyTripFeelLine(run) }
      ];
  const highlights = [
    ...buildTravelCauseEffectLines(run, derived),
    ...getDailyExplainerLines(run),
    ...(run.day.townActionsTaken ?? []).map((entry) => `${entry.label}: ${entry.resultText}`),
    ...(run.day.overnightContext?.actionsTaken ?? []).map(
      (entry) => `${entry.label}: ${entry.resultText}`
    ),
    ...(run.day.eventLog ?? []).map((entry) => `${entry.title}: ${entry.resultText}`),
    ...(run.day.summaryNotes ?? [])
  ].slice(0, 4);
  const overnightNarrative = !townOnlyDay && run.day.overnightNarrative ? run.day.overnightNarrative : null;
  const stackedTroubleLine = buildStackedTroubleLine(run, derived);
  const actions = run.gameOver
    ? [
        { label: "Continue", variant: "primary", data: { action: "open-end" } },
        { label: "Restart Trip", variant: "secondary", data: { action: "reset-run", screen: "travel" } }
      ]
    : [{ label: "Continue", variant: "primary", data: { action: "advance-day" } }];

  return renderShell({
    state,
    screenId: "summary",
    eyebrow,
    title,
    lead,
    sceneVariant: "summary",
    sceneCaption: "",
    backgroundHtml: scenicBackdrop ? renderScrollingScenicBackdrop(scenicBackdrop) : "",
    showSceneIllustration: !scenicBackdrop,
    primaryHtml: `
      ${
        townOnlyDay
          ? `
              ${renderSection("Today", `<p class="body-copy">${run.day.summaryHeadline}</p>`)}
              ${
                stackedTroubleLine
                  ? renderSection("Still Tight", `<p class="body-copy">${stackedTroubleLine}</p>`)
                  : ""
              }
              ${renderSection("What Changed", renderLedger(summaryRows))}
              ${renderSection(
                "What Mattered",
                highlights.length > 0
                  ? renderBulletList(highlights)
                  : "<p class=\"body-copy\">The day settled without much drama.</p>"
              )}
            `
          : `
              ${renderSection(
                "Tonight",
                renderNarrativeParagraphs(overnightNarrative?.tonight ?? [run.day.summaryHeadline])
              )}
              ${renderSection(
                "By Morning",
                renderNarrativeParagraphs(
                  overnightNarrative?.morning ?? ["The morning comes quietly and the trip moves on."]
                )
              )}
              ${renderSection("Tomorrow's Read", `<p class="body-copy">${buildEndOfDayReadLine(run, derived)}</p>`)}
              ${
                stackedTroubleLine
                  ? renderSection("Still Tight", `<p class="body-copy">${stackedTroubleLine}</p>`)
                  : ""
              }
              ${renderSection(
                "What Mattered",
                highlights.length > 0
                  ? renderBulletList(highlights)
                  : "<p class=\"body-copy\">The day settled without much drama.</p>"
              )}
            `
      }
    `,
    secondaryHtml: `
      ${renderRouteRibbon(run.journey.stops, run.journey.currentStopIndex)}
      ${renderSection("What Changed", renderLedger(summaryRows), "section-block--compact")}
      <p class="body-copy">Next: ${routeSummary.nextWaypointName} in ${routeSummary.nextWaypointMilesAway} miles. ${run.journey.milesRemaining} miles remain on the road.</p>
    `,
    actions
  });
}

function buildTravelCauseEffectLines(run, derived) {
  const lines = [];
  const selectedStop = run.day.selectedGeneratedStop;
  const discoveryCount = Number(run.day.generatedStops?.discoveryCount) || 0;

  if (discoveryCount > 0) {
    lines.push(
      discoveryCount === 1
        ? "Keeping on past the first evening options spent daylight and raised the pressure before camp."
        : "Repeatedly keeping on made the night riskier and left fewer good places to land."
    );
  }

  if (selectedStop) {
    const tier = formatGeneratedStopTier(selectedStop);
    if (selectedStop.valueTier === "standout" || selectedStop.valueTier === "premium") {
      lines.push(`${selectedStop.name} was a ${tier.toLowerCase()} stop, which helped the trip feel more memorable.`);
    } else if (selectedStop.valueTier === "rough" || selectedStop.category === "roadside_fallback") {
      lines.push(`${selectedStop.name} was rough, so the night protected the route less than a better stop would have.`);
    } else if (selectedStop.serviceAccess !== "none") {
      lines.push(`${selectedStop.name} gave practical support, trading some trip texture for stability.`);
    }
  }

  if (run.day.dailyWaterDelta <= -18) {
    lines.push("Water took a real hit today, so refilling soon will matter.");
  }
  if ((run.day.dailyWasteDelta ?? 0) >= 20) {
    lines.push("Waste built up enough today that ignoring it will make tomorrow tighter.");
  }
  if (derived.warnings.length > 0) {
    lines.push(`The warning signs are now visible: ${derived.warnings.slice(0, 2).map(formatWarningPressurePhrase).join(" ")}`);
  }

  return lines;
}

function buildEndOfDayReadLine(run, derived) {
  const selectedStop = run.day.selectedGeneratedStop;
  const stayName = selectedStop?.name ?? run.day.overnightContext?.locationName ?? run.journey.currentLocationName;
  const tierPhrase = selectedStop ? getGeneratedStopTierPhrase(selectedStop).toLowerCase() : "a place to let the night settle";
  const benefit = getStopBenefitLine(selectedStop);
  const cost = getStopCostLine(selectedStop, derived);
  const outlook = getTomorrowOutlookLine(derived);

  return `You landed at ${stayName}, ${tierPhrase}. ${benefit} ${cost} ${outlook}`;
}

function getStopBenefitLine(stop) {
  if (!stop) {
    return "The night gives everyone a chance to reset.";
  }
  if (stop.valueTier === "standout" || stop.valueTier === "premium") {
    return "It gave the trip a memorable lift.";
  }
  if (stop.serviceAccess === "full" || stop.serviceAccess === "partial") {
    return "The practical support helped steady the supplies.";
  }
  if (stop.type === "public_land_camp" || stop.type === "boondock_site" || stop.type === "scenic_inconvenient") {
    return "It gave everyone some space to breathe.";
  }
  if (stop.valueTier === "rough" || stop.category === "roadside_fallback") {
    return "There was space to sleep, which mattered after a long day.";
  }
  return "It carried the night well enough.";
}

function getStopCostLine(stop, derived) {
  if (!stop) {
    return derived.warnings.length > 0
      ? "Some supply worries are still riding with you."
      : "Nothing about it solved every future worry, but it did enough for tonight.";
  }
  if (stop.valueTier === "rough" || stop.category === "roadside_fallback") {
    return "There was not much comfort or recovery to carry into morning.";
  }
  if (stop.serviceAccess === "none") {
    return "There was not much help for water, waste, or electric.";
  }
  if (stop.valueTier === "premium" || stop.valueTier === "standout") {
    return "It asked more from daylight and supplies than a purely practical stop would have.";
  }
  return "The tradeoff was smaller than some stops, but the road still asks for attention.";
}

function getTomorrowOutlookLine(derived) {
  if (derived.warnings.length >= 2) {
    return `Tomorrow starts with a few things to watch: ${derived.warnings.slice(0, 2).map(formatWarningPressurePhrase).join(" ")}`;
  }
  if (derived.warnings.length === 1) {
    return `Tomorrow can still work, though ${formatWarningPressurePhrase(derived.warnings[0]).toLowerCase()}`;
  }
  if (derived.moralePressureScore >= 3) {
    return "Tomorrow starts steady enough, but everyone could use an easier stretch soon.";
  }
  return "Tomorrow starts steady.";
}

function renderEndScreen(state) {
  const run = state.run;
  const isVictory =
    state.ui.endingPreview === "live" ? run.victory : state.ui.endingPreview === "victory";
  const lossConditions = checkLossConditions(run);
  const derived = getDerivedStatus(run);
  const routeSummary = derived.routeProgressSummary;
  const destinationPoint = run.journey.routePoints[run.journey.routePoints.length - 1];
  const summary = isVictory
    ? destinationPoint?.arrivalText ??
      "You reached the end. The score tells the story of how well the trip held together."
    : lossConditions.length
      ? buildFailureSummary(run, lossConditions, derived)
      : "The road was still ahead when the trip had to stop.";
  const outcomeExplainers = isVictory
    ? buildScoreExplainerLines(run, derived)
    : buildFailureExplainerLines(run, lossConditions, derived);
  const runDistinction = isVictory ? buildRunDistinction(run, derived) : null;

  const endBackdrop = buildScenicBackdrop(isVictory ? goodSomethingScrolling : badSomethingScrolling);

  return renderShell({
    state,
    screenId: "end",
    eyebrow: `${isVictory ? "Arrival" : "Journey's End"} | ${run.journey.destinationName}`,
    title: isVictory ? run.journey.destinationName : "The Road Ends Here",
    lead: isVictory
      ? "You made it. Take in the finish for a moment."
      : "The trip ended before the finish. Here is what caught up with you.",
    sceneVariant: isVictory ? "victory" : "failure",
    sceneCaption: "",
    backgroundHtml: renderScrollingScenicBackdrop(endBackdrop),
    showSceneIllustration: false,
    primaryHtml: `
      ${renderSection(
        isVictory ? "Arrival" : "What Stopped The Trip",
        `<p class="body-copy">${summary}</p>`
      )}
      ${
        runDistinction
          ? renderSection(
              "Run Distinction",
              `
                <p class="body-copy"><strong>${runDistinction.title}</strong></p>
                <p class="body-copy">${runDistinction.body}</p>
              `
            )
          : ""
      }
      ${renderSection(
        isVictory ? "Why The Score Landed Here" : "What Led To This",
        outcomeExplainers.length > 0
          ? renderBulletList(outcomeExplainers)
          : "<p class=\"body-copy\">The final result mostly came from the condition of the trip at the end.</p>"
      )}
      ${renderSection(
        "Trip Record",
        renderLedger([
          { label: "Days", value: `${run.dayNumber}` },
          { label: "Miles traveled", value: `${run.journey.milesTraveled}` },
          { label: "Electric", value: `${run.v2.resources.electric.charge}/${run.v2.resources.electric.capacity}` },
          { label: "Water", value: `${run.v2.resources.water.current}/${run.v2.resources.water.capacity}` },
          { label: "Waste", value: `${run.v2.resources.waste.current}/${run.v2.resources.waste.capacity}` },
          { label: "Trip Score", value: `${(run.score?.finalScore ?? derived.finalScore ?? 0).toFixed(1)} / 10` },
          { label: "Outlook", value: derived.moraleDescriptor }
        ])
      )}
      ${renderSection(
        "Breakdown",
        renderLedger([
          { label: "Experience", value: `${(run.score?.experience ?? 0).toFixed(1)}` },
          { label: "Efficiency", value: `${(run.score?.efficiency ?? 0).toFixed(1)}` },
          { label: "Resource Stability", value: `${(run.score?.resources ?? 0).toFixed(1)}` },
          { label: "Decision Making", value: `${(run.score?.decisions ?? 0).toFixed(1)}` },
          { label: "Morale", value: derived.moraleScoreBand?.label ?? derived.moraleDescriptor },
          { label: "Final Score", value: `${(run.score?.finalScore ?? derived.finalScore ?? 0).toFixed(1)}` }
        ])
      )}
    `,
    secondaryHtml: `
      ${renderRouteRibbon(run.journey.stops, run.journey.currentStopIndex)}
      ${renderSection(
        isVictory ? "The Finish" : "What Stopped The Trip",
        renderBulletList(
          lossConditions.length ? lossConditions.map(getLossLabel) : ["Nothing stopped the trip."]
        )
      )}
      ${
        isVictory
          ? `<p class="body-copy">${run.journey.originName} to ${run.journey.destinationName} took ${run.dayNumber} days.</p>`
          : ""
      }
    `,
    secondaryTitle: "The Finish",
    actionHeading: "Menu",
    actions: [
      { label: "Restart Trip", variant: "primary", data: { action: "reset-run", screen: "travel" } }
    ]
  });
}

function buildRunDistinction(run, derived) {
  const score = run.score ?? {};
  const finalScore = Number(score.finalScore ?? derived?.finalScore ?? 0) || 0;

  if (score.legendaryRunBonusApplied) {
    return {
      title: "Legendary Run",
      body: "This run found the full arc: rare memorable stops, controlled risk, timely recovery, and a strong finish."
    };
  }

  if (finalScore >= 9) {
    return {
      title: "Excellent Run",
      body: "This was an exceptional finish built on strong choices and final condition. It did not need a timely recovery after things got tight, so it did not become a Legendary Run."
    };
  }

  if (finalScore >= 8) {
    return {
      title: "Strong Run",
      body: "This was a strong finish, but the trip did not combine rare discoveries, controlled risk, recovery, and final condition all at once."
    };
  }

  return null;
}

function getPrimaryForecastLine(run) {
  const firstForecast = run.environment.forecast?.[0] ?? null;
  const solarOutlook = run.v2?.currentConditions?.solarOutlook ?? "Fair";
  return firstForecast?.forecast ?? (firstForecast?.label ? `Solar outlook: ${solarOutlook}. ${firstForecast.label}` : "");
}

function buildIncidentPromptCopy(run, activeEvent, derived) {
  if (activeEvent.presentation === "human_trouble") {
    return {
      title: "Someone Needs You",
      body: "Something inside the RV matters more than the miles for a moment."
    };
  }

  if (activeEvent.category === "rv_condition") {
    return {
      title: "Something Feels Wrong",
      body: "A rough sound moves through the rig, and you ease off to listen."
    };
  }

  if (activeEvent.category === "energy") {
    return {
      title: "A Gauge Catches Your Eye",
      body: "Something about the light, the weather, or the pull of the road stops feeling simple."
    };
  }

  if (derived.warnings.length >= 2) {
    return {
      title: "The Road Tightens",
      body: "More than one worry is riding with you now, and the day suddenly feels narrower."
    };
  }

  return {
    title: "The Day Takes A Turn",
    body: `Something interrupts the road toward ${run.journey.nextStopName}, and it wants your full eye.`
  };
}

function buildGroundedLedgerRows(run, derived, routeSummary, options = {}) {
  const troubleLine = buildStackedTroubleLedgerLine(run, derived);
  const rows = [
    { label: "Today", value: `Day ${run.dayNumber} | ${formatDisplayDate(run.day.currentDate)}` },
    { label: "Here", value: options.placeValue ?? run.journey.currentLocationName },
    {
      label: "Ahead",
      value:
        routeSummary.nextWaypointMilesAway > 0
          ? `${routeSummary.nextWaypointName} | ${routeSummary.nextWaypointMilesAway} mi`
          : "End of the road"
    },
    {
      label: "Resources",
      value: `Electric ${derived.electricPercent}% | Water ${derived.waterPercent}% | Waste ${derived.wastePercent}%`
    },
    {
      label: "Trip",
      value: `${getTripFeelLine(run, derived)} | Solar ${derived.solarOutlook} | Outlook ${derived.moraleDescriptor}`
    }
  ];

  if (troubleLine) {
    rows.push({
      label: derived.warnings.length >= 2 ? "Trouble" : "Watch",
      value: troubleLine,
      className: derived.warnings.length >= 2 ? "delta-down" : ""
    });
  }

  return rows;
}

function getTripFeelLine(run, derived) {
  if (run.gameOver || run.victory) {
    return `Score ${(run.score?.finalScore ?? derived.finalScore ?? 0).toFixed(1)} / 10`;
  }

  if (run.resourcePressure?.lowPower || run.resourcePressure?.lowWater || run.resourcePressure?.highWaste) {
    return "Getting tight";
  }

  if ((run.score?.experience ?? 0) >= 2) {
    return "The trip is finding its shape";
  }

  return "Trip still taking shape";
}

function getDailyTripFeelLine(run) {
  const delta = Number(run.day?.dailyTripScoreDelta) || 0;

  if (run.resourcePressure?.lowPower || run.resourcePressure?.lowWater || run.resourcePressure?.highWaste) {
    return "This is getting tight.";
  }

  if (delta > 0) {
    return "That stop gave the trip something worth remembering.";
  }

  if (delta < 0) {
    return "That choice made the trip harder.";
  }

  return "The score held steady.";
}

function getDailyExplainerLines(run, limit = 3) {
  return getRankedExplainers(run?.explainers?.recent ?? [])
    .filter((entry) => entry.day === run.dayNumber)
    .slice(0, limit)
    .map(formatExplainerLine);
}

function buildScoreExplainerLines(run, derived, limit = 5) {
  const lines = getRankedExplainers(run?.explainers?.major ?? [])
    .slice(0, limit)
    .map(formatExplainerLine);
  const score = run.score ?? {};

  if (lines.length < limit && (score.experience ?? 0) >= 8) {
    lines.push("Stop quality: Memorable places gave the trip real texture, not just miles.");
  } else if (lines.length < limit && (score.experience ?? 0) < 5) {
    lines.push("Stop quality: You reached the finish, but fewer nights became strong memories.");
  }

  if (lines.length < limit && (score.resources ?? 0) < 6) {
    lines.push("Resource stability: A few supply worries stacked up before the trip could fully settle.");
  } else if (lines.length < limit && (score.resources ?? 0) >= 8) {
    lines.push("Resource stability: Water, waste, and electric stayed in a workable range most of the way.");
  }

  if (lines.length < limit && (score.efficiency ?? 0) < 6) {
    lines.push("Route efficiency: Extra time, late searches, or recovery stops cost the route some pace.");
  } else if (lines.length < limit && (score.efficiency ?? 0) >= 8) {
    lines.push("Route efficiency: The trip kept moving without losing many days to recovery.");
  }

  if (lines.length < limit && (score.decisions ?? 0) >= 8) {
    lines.push("Service timing: You handled tight moments early enough that they did not take over the trip.");
  } else if (lines.length < limit && (score.decisions ?? 0) < 5) {
    lines.push("Service timing: Some fixes came late, after the day was already narrow.");
  }

  if (lines.length < limit && derived?.moraleScoreBand?.label) {
    lines.push(`Morale outlook: The cabin finished ${derived.moraleScoreBand.label}, and that shaped how well the final score held together.`);
  }

  return dedupeStrings(lines).slice(0, limit);
}

function buildFailureExplainerLines(run, lossConditions, derived, limit = 5) {
  const lines = getRankedExplainers(run?.explainers?.major ?? [])
    .filter((entry) => entry.tone === "negative" || entry.tone === "warning")
    .slice(0, limit - 1)
    .map(formatExplainerLine);

  if (lossConditions.includes("waste_overflow")) {
    lines.push("Waste backed up too far for the trip to keep going comfortably.");
  } else if (lossConditions.includes("water_depleted")) {
    lines.push("Water ran out before the trip could recover.");
  } else if (lossConditions.includes("battery_depleted")) {
    lines.push("Electric ran out and the RV could not keep going safely.");
  } else if (lossConditions.includes("morale_collapsed")) {
    lines.push("The cabin stayed under too much strain for too long.");
  } else if (lossConditions.includes("deadline_missed")) {
    lines.push(`The route still had ${run.journey.milesRemaining} miles left when the deadline ran out.`);
  } else if (derived?.lossConditions?.length > 0) {
    lines.push(`The final condition was ${derived.lossConditions.map(getLossLabel).join(", ")}.`);
  }

  return dedupeStrings(lines).slice(0, limit);
}

function getRankedExplainers(entries) {
  return Array.isArray(entries)
    ? [...entries]
        .filter((entry) => typeof entry?.text === "string" && entry.text.trim().length > 0)
        .sort((left, right) => (Number(right.weight) || 0) - (Number(left.weight) || 0) || (Number(right.day) || 0) - (Number(left.day) || 0))
    : [];
}

function formatExplainerLine(entry) {
  const label = {
    experience: "Experience",
    resources: "Resources",
    morale: "Morale",
    decision: "Decision",
    efficiency: "Efficiency",
    failure: "What Stopped You"
  }[entry.category] ?? "Trip";

  return `${label}: ${entry.text}`;
}

function buildStackedTroubleLine(run, derived = getDerivedStatus(run)) {
  if (derived.warnings.length >= 3) {
    return `Trouble is stacking up: ${formatWarningList(derived.warnings, 3)}.`;
  }

  if (derived.warnings.length >= 2) {
    return `Two worries are pressing at once: ${formatWarningList(derived.warnings, 2)}.`;
  }

  if (derived.moralePressureScore >= 3) {
    return "The trip is carrying strain from recent hard days.";
  }

  return "";
}

function buildStackedTroubleLedgerLine(run, derived = getDerivedStatus(run)) {
  if (derived.warnings.length > 0) {
    return formatWarningList(derived.warnings, 3);
  }

  if (derived.moralePressureScore >= 3) {
    return "Living strain";
  }

  return "";
}

function formatWarningList(warnings, limit) {
  const shown = warnings.slice(0, limit).map(getWarningLabel);
  const overflow = warnings.length - shown.length;

  return `${shown.join(" | ")}${overflow > 0 ? ` | +${overflow} more` : ""}`;
}

function dedupeStrings(values) {
  const seen = new Set();
  const output = [];

  for (const value of values) {
    const text = String(value ?? "").trim();

    if (!text || seen.has(text)) {
      continue;
    }

    seen.add(text);
    output.push(text);
  }

  return output;
}

function buildArrivalLead(notice, latestPoint) {
  if (notice?.kind === "destination") {
    return "The road has carried you to the end.";
  }

  if (notice?.isTownStop || typeof latestPoint?.townId === "string") {
    return "A useful stop comes into reach, with help close at hand.";
  }

  if (latestPoint?.tag === "ferry") {
    return "The road pauses at a crossing before the next stretch.";
  }

  if (latestPoint?.tag === "camp") {
    return "A stay-worthy place marks the next chapter of the road.";
  }

  return "A named place marks this chapter of the road.";
}

function isComfortFirstPolicy(comfortPolicy) {
  return (
    comfortPolicy === COMFORT_POLICIES.COMFORTABLE ||
    comfortPolicy === COMFORT_POLICIES.INDULGENT
  );
}

function formatEventEyebrow(run, activeEvent) {
  if (activeEvent.presentation === "human_trouble") {
    return `${formatEventPhase(activeEvent.phase)} | People In The RV`;
  }

  if (activeEvent.phase === DAY_PHASES.TRAVEL_RESOLUTION) {
    return `Something On The Road | ${run.journey.currentSegmentLabel}`;
  }

  return `${formatEventPhase(activeEvent.phase)} | ${formatEventCategory(activeEvent.category)}`;
}

function renderDeveloperDisclosure(state) {
  return renderDisclosurePanel(
    "Developer Tools",
    renderDebugPanel(state),
    {
      className: "developer-disclosure",
      summaryLabel: "Developer Tools"
    }
  );
}

function renderDebugPanel(state) {
  const run = state.run;
  const derived = getDerivedStatus(run);
  const snapshot = JSON.stringify(getStateInspectorSnapshot(run), null, 2);
  const recentEventLabels =
    run.events.recentEvents.length > 0
      ? run.events.recentEvents.map((entry) => entry.id).join(", ")
      : "None";

  return `
    <div class="debug-panel">
      <div class="debug-grid">
        <div class="debug-column">
          ${renderSection(
            "State Inspector",
            `
              <p class="body-copy">Developer tools for phase flow, warnings, schedule pressure, morale strain, town recovery, and day deltas.</p>
              ${renderLedger([
                { label: "Run ID", value: run.runId },
                { label: "Phase", value: getPhaseLabel(run.currentPhase) },
                { label: "Active event", value: run.events.activeEvent ? run.events.activeEvent.id : "None" },
                { label: "Events today", value: `${run.day.eventsResolvedCount}` },
                { label: "Recent events", value: recentEventLabels },
                { label: "Current route point", value: run.journey.currentLocationName },
                { label: "Current leg", value: run.journey.currentSegmentLabel },
                { label: "Next waypoint", value: run.journey.nextStopName },
                { label: "Reached today", value: `${run.day.reachedRoutePoints.length}` },
                { label: "Town services", value: `${run.day.townActionsTaken.length}` },
                {
                  label: "Campsite",
                  value: getSelectedCampsiteType(run)
                    ? getCampsiteOption(getSelectedCampsiteType(run)).label
                    : "None"
                },
                { label: "Warnings", value: derived.warnings.length ? derived.warnings.map(getWarningLabel).join(", ") : "None" },
                { label: "Morale descriptor", value: derived.moraleDescriptor },
                { label: "Pressure score", value: `${derived.moralePressureScore}` },
                { label: "Frugal streak", value: `${run.passengerPressure.recentFrugalDays}` },
                { label: "Push streak", value: `${run.passengerPressure.recentPushMilesDays}` },
                { label: "Poor rest streak", value: `${run.passengerPressure.poorRestStreak}` },
                { label: "Recovery momentum", value: `${run.passengerPressure.recoveryMomentum}` },
                { label: "Battery net today", value: formatSigned(run.day.dailyBatteryDelta), className: getDeltaClass(run.day.dailyBatteryDelta) },
                { label: "Event battery shift", value: formatSigned(run.day.energy.total.eventAdjustment), className: getDeltaClass(run.day.energy.total.eventAdjustment) },
                { label: "Loss conditions", value: derived.lossConditions.length ? derived.lossConditions.map(getLossLabel).join(", ") : "None" },
                { label: "Victory", value: derived.victoryEligible ? "Yes" : "No" }
              ])}
            `
          )}
          ${renderSection(
            "Edge Cases",
            renderMiniActionGrid([
              { label: "Low Electric", data: { action: "debug-preset", preset: "low_battery" } },
              { label: "Low Water", data: { action: "debug-preset", preset: "low_water" } },
              { label: "High Waste", data: { action: "debug-preset", preset: "high_waste" } },
              { label: "Low Outlook", data: { action: "debug-preset", preset: "low_outlook" } },
              { label: "Strain Build", data: { action: "debug-preset", preset: "strain_building" } },
              { label: "Recovered Cabin", data: { action: "debug-preset", preset: "recovered_cabin" } },
              { label: "Near Milestone", data: { action: "debug-preset", preset: "milestone_ready" } },
              { label: "Near Arrival", data: { action: "debug-preset", preset: "destination_approach" } },
              { label: "Victory Ready", data: { action: "debug-preset", preset: "victory_ready" } },
              { label: "Empty Placeholders", data: { action: "debug-preset", preset: "clear_placeholders" } },
              { label: "Reset Run", variant: "accent", data: { action: "reset-run", screen: "travel" } }
            ])
          )}
          ${renderSection(
            "Resource Nudges",
            renderMiniActionGrid([
              { label: "Electric -25", data: { action: "debug-adjust", field: "battery", delta: "-25" } },
              { label: "Water -25", data: { action: "debug-adjust", field: "water", delta: "-25" } },
              { label: "Waste +25", data: { action: "debug-adjust", field: "waste", delta: "25" } },
              { label: "Outlook -25", data: { action: "debug-adjust", field: "outlook", delta: "-25" } },
              { label: "Score +5", data: { action: "debug-adjust", field: "score", delta: "5" } }
            ])
          )}
        </div>
        <div class="debug-column">
          ${renderSection("Canonical Run JSON", renderPreformatted(snapshot, "state-json"))}
        </div>
      </div>
    </div>
  `;
}

function renderReachedRouteSection(run, title) {
  if (!Array.isArray(run.day.reachedRoutePoints) || run.day.reachedRoutePoints.length === 0) {
    return "";
  }

  return renderSection(
    title,
    renderBulletList(
      run.day.reachedRoutePoints.map(
        (point) =>
          `${renderAssetIcon(getRouteMarkerIcon(point.kind === "destination"), "route-inline-icon")}${point.name}: ${point.arrivalText}`
      ),
      "bullet-list--icon"
    )
  );
}

function formatSigned(value) {
  return `${value > 0 ? "+" : ""}${value}`;
}

function getDeltaClass(value) {
  if (value > 0) {
    return "delta-up";
  }
  if (value < 0) {
    return "delta-down";
  }
  return "delta-flat";
}

function formatRestQuality(restQuality) {
  return {
    poor: "Poor",
    steady: "Steady",
    good: "Good",
    strong: "Strong"
  }[restQuality] ?? "Steady";
}

function getRestQualityClass(restQuality) {
  if (restQuality === "good" || restQuality === "strong") {
    return "delta-up";
  }

  if (restQuality === "poor") {
    return "delta-down";
  }

  return "delta-flat";
}

function renderEnergyLedger(breakdown) {
  if (!breakdown) {
    return "<p class=\"body-copy\">No power notes yet.</p>";
  }

  return renderLedger([
    { label: "Solar", value: formatSigned(breakdown.solarGain), className: getDeltaClass(breakdown.solarGain) },
    { label: "Power used", value: formatSigned(-breakdown.loadUse), className: getDeltaClass(-breakdown.loadUse) },
    { label: "Drive effect", value: formatSigned(breakdown.travelImpact), className: getDeltaClass(breakdown.travelImpact) },
    { label: "Plug-in help", value: formatSigned(breakdown.hookupSupport), className: getDeltaClass(breakdown.hookupSupport) },
    { label: "Event change", value: formatSigned(breakdown.eventAdjustment), className: getDeltaClass(breakdown.eventAdjustment) },
    { label: "Battery change", value: formatSigned(breakdown.netBatteryDelta), className: getDeltaClass(breakdown.netBatteryDelta) }
  ]);
}

function buildFailureSummary(run, lossConditions, derived) {
  if (lossConditions.includes("deadline_missed")) {
    return `Time ran out with ${run.journey.milesRemaining} miles still ahead. By the end, the trip needed ${derived.requiredMilesPerDay} miles a day to catch up.`;
  }

  return `The trip had to stop because ${lossConditions.map(getLossLabel).join(", ")}.`;
}

function formatEventPhase(phase) {
  return {
    [DAY_PHASES.MORNING_REVIEW]: "Morning",
    [DAY_PHASES.TRAVEL_RESOLUTION]: "On The Road",
    [DAY_PHASES.CAMP_DECISION]: "At Camp",
    [DAY_PHASES.OVERNIGHT_RESOLUTION]: "At Night"
  }[phase] ?? "Roadside";
}

function formatEventCategory(category) {
  return {
    energy: "Power",
    travel: "Road",
    rv_condition: "Roadside",
    morale: "Outlook",
    recovery: "Rest"
  }[category] ?? "Roadside";
}

function buildEventLead(run, activeEvent, resolved) {
  switch (activeEvent.phase) {
    case DAY_PHASES.TRAVEL_RESOLUTION:
      return resolved
        ? `You steady the day and keep moving toward ${run.journey.nextStopName}.`
        : `While heading toward ${run.journey.nextStopName}, something on the road breaks the rhythm.`;
    case DAY_PHASES.CAMP_DECISION:
      return resolved
        ? "The evening settles again once the moment has passed."
        : "As the driving day winds down, something interrupts the search for a place to stay.";
    case DAY_PHASES.OVERNIGHT_RESOLUTION:
      return resolved
        ? "By morning, the night shows what it changed."
        : "During the night, something changes around the stay.";
    case DAY_PHASES.MORNING_REVIEW:
      return resolved
        ? "The morning steadies, and the day moves on."
        : "Before the miles begin, the day asks for a little attention.";
    default:
      return resolved
        ? "The moment passes, and the trip keeps moving."
        : "Something interrupts the trip for a little while.";
  }
}
