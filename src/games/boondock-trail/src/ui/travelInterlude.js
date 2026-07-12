import {
  formatDisplayDate,
  getDerivedStatus,
  getForecastSummary
} from "../state/gameState.js";
import { getRoutePreset, getTownDefinitionForRoutePoint } from "../state/gameContent.js";
import { canEnterTown } from "../systems/townLoop.js";
import {
  renderRouteRibbon,
  renderStatusOverlay,
  renderTitleReturnButton
} from "./components.js";
import { getTravelChunkPreview } from "../systems/travelSession.js";
import { getTravelApproachPose } from "./travelApproachPose.js";

const DAY_CLOCK_START_MINUTES = 7 * 60;
const DAY_CLOCK_END_MINUTES = 19 * 60;
const SUN_ARC = Object.freeze({
  startX: 72,
  startY: 246,
  peakY: 72,
  endX: 888,
  endY: 246
});
const MOON_ARC = Object.freeze({
  startX: 620,
  startY: 88,
  peakY: 54,
  endX: 850,
  endY: 82
});
const SKY_COLOR_KEYFRAMES = Object.freeze([
  [0.0, [8, 12, 45]],
  [0.15, [22, 55, 130]],
  [0.3, [55, 125, 195]],
  [0.5, [105, 185, 245]],
  [0.68, [75, 150, 215]],
  [0.8, [200, 130, 55]],
  [0.88, [210, 65, 18]],
  [0.94, [95, 18, 10]],
  [1.0, [5, 5, 15]]
]);
const DISTANT_LAYER_STEP = 1210;
const MIDGROUND_LAYER_STEP = 1280;
const FOREGROUND_LAYER_STEP = 980;
const LAYER_REPEAT_RANGE = Object.freeze([-1, 0, 1, 2, 3, 4, 5, 6]);

export function buildTravelInterludeState(run) {
  const chunk = getTravelChunkPreview(run);

  if (!chunk) {
    return null;
  }

  const departurePoint =
    findRoutePoint(run.journey.routePoints, run.journey.currentRoutePointId) ??
    getCurrentOrLastPoint(run.journey.routePoints, run.journey.milesTraveled);
  const targetPoint =
    findRoutePoint(run.journey.routePoints, run.journey.nextWaypointId) ??
    getFirstUpcomingPoint(run.journey.routePoints, run.journey.milesTraveled) ??
    getLastRoutePoint(run.journey.routePoints);
  const dayClockStartMinutes = chunk.dayClockStartMinutes ?? DAY_CLOCK_START_MINUTES;
  const dayClockEndMinutes = chunk.dayClockEndMinutes ?? DAY_CLOCK_END_MINUTES;
  const isNightPush =
    run.day.travelSession?.travelPeriod === "night_push" ||
    run.day.travelSession?.activeLeg?.nightDriveFromTown === true;

  return {
    id: chunk.id,
    durationMs: chunk.durationMs,
    dayClockStartMinutes,
    dayClockEndMinutes,
    sunArc: isNightPush ? MOON_ARC : SUN_ARC,
    displayRun: run,
    routePresetId: run.metadata.routePresetId,
    startLocationName: run.journey.currentLocationName,
    routeLine: targetPoint
      ? `${departurePoint?.name ?? run.journey.currentLocationName} to ${targetPoint.name}`
      : run.journey.currentLocationName,
    endLocationName: run.journey.currentLocationName,
    segmentLabel: run.journey.currentSegmentLabel,
    segmentSummary: run.journey.currentSegmentSummary,
    targetName: targetPoint?.name ?? run.journey.destinationName,
    targetTag: targetPoint?.tag ?? "destination",
    milesDriven: chunk.miles,
    startDistance: chunk.startDistance,
    endDistance: chunk.endDistance,
    startMilesRemaining: chunk.startMilesRemaining,
    endMilesRemaining: chunk.endMilesRemaining,
    stops: [...run.journey.stops],
    currentStopIndex: run.journey.currentStopIndex,
    legId: chunk.legId,
    legTotalMiles: chunk.legTotalMiles,
    legCompletedMilesStart: chunk.legCompletedMilesStart,
    legCompletedMilesEnd: chunk.legCompletedMilesEnd,
    legMilesRemainingStart: chunk.legMilesRemainingStart,
    legMilesRemainingEnd: chunk.legMilesRemainingEnd,
    legProgressStart: clampPercentNumber(chunk.legProgressStart),
    legProgressEnd: clampPercentNumber(chunk.legProgressEnd),
    approachProps: buildInterludeApproachProps(chunk.approachProps, chunk.legProgressStart),
    totalProgressStart: getTotalProgress(run),
    totalProgressEnd: clampPercentNumber(
      (Math.max(0, Number(run.journey.milesTraveled) || 0) + chunk.miles) /
        Math.max(1, Number(run.journey.totalMilesToDestination) || 1)
    ),
    isLocalDestination: Boolean(chunk.isLocalDestination),
    departureContext: getDepartureContext(run, departurePoint),
    eventPending: chunk.reason === "interruption",
    chunkReason: chunk.reason,
    presentationMode: chunk.presentationMode ?? "normal",
    isNightPush,
    travelDayProgressStart: getSkyProgressForClockMinutes(dayClockStartMinutes),
    travelDayProgressEnd: getSkyProgressForClockMinutes(dayClockEndMinutes),
    statusLine: buildStatusLine(run, targetPoint?.name ?? run.journey.destinationName, chunk.reason, chunk.presentationMode),
    timePressureLine: buildTimePressureLine(run, chunk)
  };
}

export function renderTravelInterludeScreen(state) {
  const interlude = buildTravelInterludeState(state.run);

  if (!interlude) {
    return renderRoadDayScreen(state);
  }

  return renderActiveTravelInterludeScreen(state, interlude);
}

function renderRoadDayScreen(state) {
  const run = state.run;
  const derived = getDerivedStatus(run);
  const routeSummary = derived.routeProgressSummary;
  const currentPoint =
    findRoutePoint(run.journey.routePoints, run.journey.currentRoutePointId) ??
    getCurrentOrLastPoint(run.journey.routePoints, run.journey.milesTraveled);
  const town = getTownDefinitionForRoutePoint(currentPoint);
  const townAvailable = town && canEnterTown(run);

  return `
    <div class="app-shell app-shell--no-status app-shell--with-return screen-interlude screen-interlude--ready">
      ${renderTitleReturnButton()}
      <section class="panel road-day-frame road-day-frame--ready">
        ${renderRoadDayTopline({
          dayLabel: `Day ${run.dayNumber} | ${formatDisplayDate(run.day.currentDate)}`,
          title: run.journey.currentLocationName,
          routeLine: routeSummary.routeLine,
          showTools: true
        })}
        <section class="road-day-summary-card">
          <p class="road-day-distance">${routeSummary.nextWaypointMilesAway} miles ahead</p>
          <p class="road-day-mood">${buildRoadDayMoodLine(run, routeSummary)}</p>
        </section>
        <div class="road-day-actions">
          ${
            !townAvailable
              ? `
                <button class="title-menu-button title-menu-button--primary road-day-button" data-action="commit-travel">
                  <span>Drive</span>
                </button>
              `
              : ""
          }
          ${
            townAvailable
              ? `
                <button class="title-menu-button road-day-button" data-action="enter-town">
                  <span>Spend Time In Town</span>
                </button>
              `
              : ""
          }
        </div>
      </section>
      ${state.ui.overlay === "status" ? renderStatusOverlay(state) : ""}
    </div>
  `;
}

function renderActiveTravelInterludeScreen(state, interlude) {
  const displayRun = interlude.displayRun ?? state.run;
  const visual = getTravelVisual(interlude);
  const routeLine = interlude.routeLine;
  const nextActionAriaLabel = getInterludeActionLabel(interlude);

  return `
    <div class="app-shell app-shell--no-status app-shell--with-return screen-interlude screen-interlude--traveling">
      ${renderTitleReturnButton()}
      <section class="panel road-day-frame road-day-frame--traveling">
        ${renderRoadDayTopline({
          dayLabel: `Day ${displayRun.dayNumber} | ${formatDisplayDate(displayRun.day.currentDate)}`,
          title: displayRun.journey.currentLocationName,
          routeLine,
          showTools: true
        })}
        <div class="road-day-scene-panel road-day-scene-panel--animated">
          <button
            class="travel-interlude-window"
            data-action="advance-travel-chunk"
            aria-label="${nextActionAriaLabel}"
            style="--interlude-duration: ${interlude.durationMs}ms;"
          >
            ${renderTravelScene(interlude, visual, { animated: true })}
          </button>
        </div>
        <section class="road-day-summary-card road-day-summary-card--traveling">
          <p class="road-day-distance">
            <span class="road-day-distance-label">Miles to ${interlude.targetName}:</span>
            <span
              class="road-day-distance-value"
              data-travel-distance
              data-distance-start="${interlude.startDistance}"
              data-distance-end="${interlude.endDistance}"
              data-distance-duration-ms="${interlude.durationMs}"
            >
              ${interlude.startDistance}
            </span>
          </p>
          <p class="road-day-mood">${interlude.statusLine}</p>
          <p class="road-day-mood">${interlude.timePressureLine}</p>
        </section>
        ${renderTravelProgress(interlude)}
        <div class="road-day-actions road-day-actions--single">
          <button class="title-menu-button title-menu-button--primary road-day-button" data-action="advance-travel-chunk">
            <span>${getInterludeButtonLabel(interlude)}</span>
          </button>
        </div>
      </section>
      ${state.ui.overlay === "status" ? renderStatusOverlay(state) : ""}
    </div>
  `;
}

function renderRoadDayTopline({ dayLabel, title, routeLine, showTools }) {
  return `
    <div class="road-day-topline">
      <div class="road-day-topline-copy">
        <p class="eyebrow road-day-day">${dayLabel}</p>
        <h1>${title}</h1>
        <p class="road-day-route">${routeLine}</p>
      </div>
      ${
        showTools
          ? `
            <div class="road-day-topline-actions">
              <button class="status-open-button" data-action="open-map">
                Journey Status
              </button>
              <button class="status-open-button" data-action="open-overlay" data-overlay="status">
                Look Closer
              </button>
            </div>
          `
          : ""
      }
    </div>
  `;
}

function renderTravelScene(interlude, visual, options = {}) {
  const animated = options.animated ?? false;
  const showClock = options.showClock ?? animated;
  const ariaLabel = options.ariaLabel ??
    (interlude.isNightPush
      ? `A stylized after-dark RV drive toward ${interlude.targetName}`
      : `A stylized day of RV travel toward ${interlude.targetName}`);
  const frameStateClass = animated ? "travel-interlude-frame--active" : "travel-interlude-frame--ready";
  const startingSkyColor = formatRgb(getSkyColorForProgress(interlude.travelDayProgressStart ?? 0));

  return `
    <span class="travel-interlude-frame ${frameStateClass} travel-theme--${visual.themeClass}">
      <svg
        class="travel-interlude-svg"
        viewBox="0 0 960 340"
        role="img"
        aria-label="${ariaLabel}"
      >
        <defs>
          <radialGradient id="travel-day-sun-${visual.gradientKey}" cx="48%" cy="45%" r="56%">
            <stop offset="0%" stop-color="#fff8b7" />
            <stop offset="48%" stop-color="${visual.sunColor}" />
            <stop offset="100%" stop-color="#ff9f36" />
          </radialGradient>
          <radialGradient id="travel-night-moon-${visual.gradientKey}" cx="42%" cy="38%" r="62%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="52%" stop-color="${visual.moonColor}" />
            <stop offset="100%" stop-color="#9fb3d4" />
          </radialGradient>
        </defs>
        ${interlude.isNightPush ? renderNightMoon(interlude, visual) : renderDaySun(interlude, visual)}
        ${renderRepeatedTravelLayer({
          className: "travel-layer travel-layer--distant",
          fill: visual.distantFill,
          step: DISTANT_LAYER_STEP,
          content: renderDistantBand()
        })}
        <g class="travel-horizon-mask" fill="${visual.horizonMaskFill}">
          <path d="M-80 224 C46 200 150 214 250 204 C370 191 478 213 596 205 C720 197 836 210 1040 202 V270 H-80 Z" />
          <path d="M-80 242 C122 222 296 235 474 226 C646 216 816 226 1040 218 V270 H-80 Z" opacity="0.58" />
        </g>
        ${
          visual.departureContext !== "none"
            ? `
              <g class="travel-context-layer travel-context-layer--${visual.departureContext}" fill="${visual.contextFill}" stroke="${visual.contextStroke}" stroke-width="4">
                ${renderDepartureContext(visual.departureContext)}
              </g>
            `
            : ""
        }
        ${renderRepeatedTravelLayer({
          className: "travel-layer travel-layer--midground",
          fill: visual.midgroundFill,
          step: MIDGROUND_LAYER_STEP,
          content: renderMidgroundShape(visual.themeClass)
        })}
        ${renderRepeatedTravelLayer({
          className: "travel-layer travel-layer--foreground",
          fill: visual.foregroundFill,
          stroke: visual.foregroundStroke,
          strokeWidth: 4,
          step: FOREGROUND_LAYER_STEP,
          content: renderForegroundObjects(visual.themeClass)
        })}
        ${renderTravelApproachProps(interlude, visual)}
        <g class="travel-rv">
          ${renderTravelRv()}
        </g>
      </svg>
      <span
        class="travel-lighting-overlay"
        data-travel-lighting
        data-lighting-progress-start="${Number(interlude.travelDayProgressStart ?? 0).toFixed(3)}"
        data-lighting-progress-end="${Number(interlude.travelDayProgressEnd ?? 1).toFixed(3)}"
        style="background: ${startingSkyColor};"
        aria-hidden="true"
      ></span>
      ${showClock ? renderDayClock(interlude) : ""}
    </span>
  `;
}

function buildRoadDayPreview(run) {
  const departurePoint =
    findRoutePoint(run.journey.routePoints, run.journey.currentRoutePointId) ??
    getCurrentOrLastPoint(run.journey.routePoints, run.journey.milesTraveled);
  const targetPoint =
    findRoutePoint(run.journey.routePoints, run.journey.nextWaypointId) ??
    getFirstUpcomingPoint(run.journey.routePoints, run.journey.milesTraveled) ??
    getLastRoutePoint(run.journey.routePoints);

  return {
    routePresetId: run.metadata.routePresetId,
    startLocationName: run.journey.currentLocationName,
    routeLine: targetPoint
      ? `${departurePoint?.name ?? run.journey.currentLocationName} to ${targetPoint.name}`
      : run.journey.currentLocationName,
    targetName: targetPoint?.name ?? run.journey.destinationName,
    targetTag: targetPoint?.tag ?? "destination",
    segmentLabel: run.journey.currentSegmentLabel,
    segmentSummary: run.journey.currentSegmentSummary,
    dayClockStartMinutes: DAY_CLOCK_START_MINUTES,
    dayClockEndMinutes: DAY_CLOCK_END_MINUTES,
    sunArc: SUN_ARC,
    totalProgressStart: getTotalProgress(run),
    totalProgressEnd: getTotalProgress(run),
    departureContext: getDepartureContext(run, departurePoint),
    eventPending: false,
    isNightPush: false,
    travelDayProgressStart: getSkyProgressForClockMinutes(DAY_CLOCK_START_MINUTES),
    travelDayProgressEnd: getSkyProgressForClockMinutes(DAY_CLOCK_END_MINUTES)
  };
}

function buildRoadDayMoodLine(run, routeSummary) {
  return [routeSummary.currentSegmentSummary, getForecastSummary(run)]
    .filter(Boolean)
    .join(" ");
}

function renderDaySun(interlude, visual) {
  const arc = interlude.sunArc ?? SUN_ARC;
  const startPosition = getSunPositionForProgress(
    arc,
    Number(interlude.travelDayProgressStart) || 0
  );

  return `
    <g
      class="travel-day-sun"
      data-travel-sun
      data-sun-start-x="${arc.startX}"
      data-sun-start-y="${arc.startY}"
      data-sun-peak-y="${arc.peakY}"
      data-sun-end-x="${arc.endX}"
      data-sun-end-y="${arc.endY}"
      data-sun-progress-start="${interlude.travelDayProgressStart ?? 0}"
      data-sun-progress-end="${interlude.travelDayProgressEnd ?? 1}"
      transform="translate(${startPosition.x} ${startPosition.y})"
      aria-hidden="true"
    >
      <circle class="travel-day-sun-aura" cx="0" cy="0" r="78" fill="${visual.sunColor}" />
      <circle class="travel-day-sun-glow" cx="0" cy="0" r="54" fill="${visual.sunColor}" />
      <circle cx="0" cy="0" r="31" fill="url(#travel-day-sun-${visual.gradientKey})" />
      <circle cx="-9" cy="-10" r="8" fill="#fff8c5" opacity="0.78" />
    </g>
  `;
}

function renderNightMoon(interlude, visual) {
  const arc = interlude.sunArc ?? MOON_ARC;
  const startPosition = getSunPositionForProgress(
    arc,
    Number(interlude.travelDayProgressStart) || 1
  );

  return `
    <g
      class="travel-day-sun travel-day-moon"
      data-travel-sun
      data-sun-start-x="${arc.startX}"
      data-sun-start-y="${arc.startY}"
      data-sun-peak-y="${arc.peakY}"
      data-sun-end-x="${arc.endX}"
      data-sun-end-y="${arc.endY}"
      data-sun-progress-start="${interlude.travelDayProgressStart ?? 1}"
      data-sun-progress-end="${interlude.travelDayProgressEnd ?? 1}"
      transform="translate(${startPosition.x} ${startPosition.y})"
      aria-hidden="true"
    >
      <circle class="travel-day-moon-aura" cx="0" cy="0" r="62" fill="${visual.moonColor}" />
      <circle class="travel-day-moon-glow" cx="0" cy="0" r="42" fill="${visual.moonColor}" />
      <circle cx="0" cy="0" r="26" fill="url(#travel-night-moon-${visual.gradientKey})" />
      <circle cx="9" cy="-7" r="21" fill="#05050f" opacity="0.82" />
    </g>
  `;
}

function renderDayClock(interlude) {
  return `
    <span class="travel-day-clock" aria-label="Travel day clock">
      <span class="travel-day-clock-label">${interlude.isNightPush ? "After Dark" : "Daylight"}</span>
      <span
        class="travel-day-clock-time"
        data-travel-clock
        data-clock-start-minutes="${interlude.dayClockStartMinutes}"
        data-clock-end-minutes="${interlude.dayClockEndMinutes}"
        data-clock-duration-ms="${interlude.durationMs}"
      >
        ${formatClockMinutes(interlude.dayClockStartMinutes)}
      </span>
    </span>
  `;
}

function renderTravelProgress(interlude) {
  return `
    <div class="travel-progress-card">
      <div class="travel-progress-summary">
        <div class="travel-progress-stop">
          <span class="choice-kicker">Start Today</span>
          <strong>${interlude.startLocationName}</strong>
        </div>
        <div class="travel-progress-stop">
          <span class="choice-kicker">Next Stop</span>
          <strong>${interlude.targetName}</strong>
        </div>
      </div>
      <div class="travel-progress-meter">
        <div class="travel-progress-meter-head">
          <span>This Leg</span>
          <strong>
            ${interlude.legCompletedMilesStart} to ${interlude.legCompletedMilesEnd} of
            ${interlude.legTotalMiles} miles
          </strong>
        </div>
        <div class="travel-progress-track">
          <span
            class="travel-progress-fill travel-progress-fill--animated"
            style="--travel-progress-start:${interlude.legProgressStart}; --travel-progress-end:${interlude.legProgressEnd}; --travel-progress-duration:${interlude.durationMs}ms;"
          ></span>
          <span
            class="travel-progress-marker travel-progress-marker--animated"
            style="--travel-progress-start:${interlude.legProgressStart}; --travel-progress-end:${interlude.legProgressEnd}; --travel-progress-duration:${interlude.durationMs}ms;"
            aria-hidden="true"
          ></span>
        </div>
      </div>
      <div class="travel-progress-meter">
        <div class="travel-progress-meter-head">
          <span>To The End</span>
          <strong>${interlude.startMilesRemaining} to ${interlude.endMilesRemaining} miles</strong>
        </div>
        <div class="travel-progress-track travel-progress-track--total">
          <span
            class="travel-progress-fill travel-progress-fill--animated"
            style="--travel-progress-start:${interlude.totalProgressStart}; --travel-progress-end:${interlude.totalProgressEnd}; --travel-progress-duration:${interlude.durationMs}ms;"
          ></span>
        </div>
      </div>
      <div class="travel-progress-foot">
        <span>${interlude.milesDriven} miles this stretch</span>
        <span>${getTravelProgressFootLabel(interlude)}</span>
      </div>
      ${renderRouteRibbon(interlude.stops, interlude.currentStopIndex)}
    </div>
  `;
}

function renderTravelRv() {
  const body = "#d7e2ff";
  const bodyStroke = "#18336a";
  const windowFill = "#49dbff";
  const doorFill = "#adc4ff";
  const stripe = "#ff4f7b";
  const panelFill = "#1ad0ff";
  const panelStroke = "#0e69c5";
  const ventFill = "#274785";
  const tireFill = "#12192d";
  const hubFill = "#9caeff";

  return `
    <g transform="translate(216 210)">
      <ellipse cx="86" cy="96" rx="116" ry="10" fill="rgba(2, 6, 16, 0.3)" />
      <rect x="0" y="24" width="170" height="66" rx="12" fill="${body}" stroke="${bodyStroke}" stroke-width="4" />
      <path d="M20 20 H100 L130 38 H20 Z" fill="${body}" stroke="${bodyStroke}" stroke-width="4" />
      <rect x="28" y="32" width="38" height="24" rx="4" fill="${windowFill}" />
      <rect x="74" y="32" width="28" height="24" rx="4" fill="${windowFill}" />
      <rect x="122" y="44" width="28" height="46" rx="3" fill="${doorFill}" />
      <rect x="18" y="58" width="122" height="10" fill="${stripe}" opacity="0.96" />
      <rect x="52" y="10" width="76" height="16" transform="skewX(-18)" fill="${panelFill}" stroke="${panelStroke}" stroke-width="3" />
      <rect x="108" y="11" width="12" height="10" rx="2" fill="${ventFill}" />
      <circle cx="42" cy="96" r="18" fill="${tireFill}" />
      <circle cx="132" cy="96" r="18" fill="${tireFill}" />
      <circle cx="42" cy="96" r="8" fill="${hubFill}" />
      <circle cx="132" cy="96" r="8" fill="${hubFill}" />
    </g>
  `;
}

function renderRepeatedTravelLayer({ className, fill, stroke = null, strokeWidth = null, step, content }) {
  return `
    <g class="${className}" fill="${fill}" ${
      stroke ? `stroke="${stroke}"` : ""
    } ${strokeWidth ? `stroke-width="${strokeWidth}"` : ""}>
      ${LAYER_REPEAT_RANGE.map(
        (multiplier) => `
          <g transform="translate(${step * multiplier} 0)">
            ${content}
          </g>
        `
      ).join("")}
    </g>
  `;
}

function renderDistantBand() {
  return `
    <path d="M-200 206 H-120 C40 170 170 152 288 178 C364 194 470 154 582 172 C702 191 838 168 1090 206 H1200 V340 H-200 Z" />
    <path d="M780 188 C830 154 892 149 958 182 V340 H780 Z" opacity="0.88" />
  `;
}

function renderTravelApproachProps(interlude, visual) {
  if (!Array.isArray(interlude.approachProps) || interlude.approachProps.length === 0) {
    return "";
  }

  return `
    <g class="travel-approach-prop-layer">
      ${interlude.approachProps.map((prop) => renderTravelApproachProp(interlude, visual, prop)).join("")}
    </g>
  `;
}

function renderTravelApproachProp(interlude, visual, prop) {
  const pose = prop.initialPose ?? getTravelApproachPose(prop, interlude.legProgressStart);

  return `
    <g
      class="travel-approach-prop travel-approach-prop--${prop.kind}"
      data-travel-approach-prop
      data-prop-kind="${prop.kind}"
      data-leg-progress-start="${interlude.legProgressStart}"
      data-leg-progress-end="${interlude.legProgressEnd}"
      data-prop-spawn-progress="${prop.spawnProgress}"
      data-prop-end-progress="${prop.endProgress}"
      data-prop-x-start="${prop.xStart}"
      data-prop-x-end="${prop.xEnd}"
      data-prop-y-base="${prop.yBase}"
      data-prop-scale-start="${prop.scaleStart}"
      data-prop-scale-end="${prop.scaleEnd}"
      transform="translate(${pose.x} ${pose.y}) scale(${pose.scale})"
      style="opacity:${pose.opacity};"
      fill="${visual.approachPropFill}"
      stroke="${visual.approachPropStroke}"
      stroke-width="4"
      stroke-linejoin="round"
      stroke-linecap="round"
      aria-hidden="true"
    >
      ${renderTravelApproachPropShape(prop, visual)}
    </g>
  `;
}

function renderTravelApproachPropShape(prop, visual) {
  switch (prop.kind) {
    case "campfire":
      return `
        <ellipse class="travel-approach-prop-shadow" cx="0" cy="0" rx="42" ry="11" />
        <path d="M-16 0 L-2 -14 L10 0" fill="${visual.approachPropAccent}" stroke="none" opacity="0.72" />
        <path d="M-6 -2 C-2 -18 8 -26 16 -10 C20 -2 14 8 2 10 C-10 10 -12 2 -6 -2 Z" fill="${visual.approachPropGlow}" stroke="none" />
        <path d="M-18 4 L2 -4" />
        <path d="M18 4 L-2 -4" />
        <circle cx="-24" cy="6" r="4" fill="${visual.approachPropAccent}" stroke="none" opacity="0.6" />
        <circle cx="24" cy="6" r="4" fill="${visual.approachPropAccent}" stroke="none" opacity="0.6" />
      `;
    case "roadside_sign":
      return `
        <ellipse class="travel-approach-prop-shadow" cx="0" cy="0" rx="44" ry="10" />
        <path d="M0 -2 V-46" />
        <rect x="-34" y="-76" width="68" height="28" rx="6" fill="${visual.approachPropAccent}" />
        <path d="M-20 -62 H20" opacity="0.78" />
      `;
    case "small_cabin":
      return `
        <ellipse class="travel-approach-prop-shadow" cx="0" cy="2" rx="56" ry="12" />
        <rect x="-34" y="-52" width="68" height="46" rx="4" />
        <path d="M-44 -52 L0 -82 L44 -52 Z" fill="${visual.approachPropAccent}" />
        <rect x="-10" y="-30" width="20" height="24" rx="2" fill="${visual.approachPropWindow}" />
        <rect x="-28" y="-36" width="12" height="12" rx="2" fill="${visual.approachPropWindow}" />
        <rect x="16" y="-36" width="12" height="12" rx="2" fill="${visual.approachPropWindow}" />
      `;
    case "ranger_station":
      return `
        <ellipse class="travel-approach-prop-shadow" cx="0" cy="2" rx="62" ry="12" />
        <rect x="-42" y="-56" width="84" height="50" rx="4" />
        <path d="M-52 -56 L0 -88 L52 -56 Z" fill="${visual.approachPropAccent}" />
        <rect x="-12" y="-38" width="24" height="32" rx="2" fill="${visual.approachPropWindow}" />
        <rect x="-56" y="-78" width="18" height="72" rx="2" />
        <path d="M-47 -88 V-102" />
        <path d="M-60 -92 H-34" stroke="${visual.approachPropGlow}" />
      `;
    case "gas_station":
      return `
        <ellipse class="travel-approach-prop-shadow" cx="0" cy="2" rx="60" ry="12" />
        <rect x="-44" y="-42" width="88" height="36" rx="4" />
        <rect x="-52" y="-72" width="104" height="16" rx="4" fill="${visual.approachPropAccent}" />
        <path d="M-34 -56 V-6" />
        <path d="M34 -56 V-6" />
        <rect x="-18" y="-34" width="20" height="20" rx="2" fill="${visual.approachPropWindow}" />
        <rect x="12" y="-36" width="14" height="26" rx="2" fill="${visual.approachPropGlow}" />
      `;
    case "radio_tower":
      return `
        <ellipse class="travel-approach-prop-shadow" cx="0" cy="2" rx="46" ry="10" />
        <path d="M0 -92 L-28 0 H28 Z" fill="none" />
        <path d="M-20 -30 H20" />
        <path d="M-14 -54 H14" />
        <path d="M-8 -76 H8" />
        <circle cx="0" cy="-102" r="8" fill="${visual.approachPropGlow}" stroke="none" />
      `;
    case "windmill":
      return `
        <ellipse class="travel-approach-prop-shadow" cx="0" cy="2" rx="46" ry="10" />
        <path d="M0 -86 L-16 0 H16 Z" />
        <circle cx="0" cy="-92" r="7" fill="${visual.approachPropAccent}" />
        <path d="M0 -116 V-74" />
        <path d="M-24 -92 H24" />
        <path d="M-18 -110 L18 -74" />
        <path d="M-18 -74 L18 -110" />
      `;
    case "scenic_landmark":
      return `
        <ellipse class="travel-approach-prop-shadow" cx="0" cy="4" rx="72" ry="14" />
        <g transform="translate(-10 -12)">
          ${renderScenicLandmarkShape(visual.landmarkClass)}
        </g>
      `;
    case "wash_crossing":
      return `
        <ellipse class="travel-approach-prop-shadow" cx="0" cy="8" rx="86" ry="16" />
        <path d="M-92 10 C-70 -8 -42 -18 -16 -18 H48 C62 -18 74 -14 90 -6" />
        <path d="M-90 22 C-56 8 -20 4 18 4 C46 4 72 8 98 18 V28 H-90 Z" fill="${visual.approachPropGlow}" opacity="0.22" stroke="none" />
        <path d="M-76 8 C-56 -12 -36 -24 -10 -30" />
        <path d="M54 -26 C68 -22 82 -12 94 0" />
        <path d="M-18 -18 L12 10" stroke="${visual.approachPropAccent}" />
        <path d="M22 -18 L50 10" stroke="${visual.approachPropAccent}" />
        <rect x="-60" y="-18" width="18" height="12" rx="3" fill="${visual.approachPropAccent}" stroke="none" opacity="0.8" />
        <rect x="58" y="-10" width="16" height="10" rx="3" fill="${visual.approachPropAccent}" stroke="none" opacity="0.72" />
      `;
    case "creek_crossing":
      return `
        <ellipse class="travel-approach-prop-shadow" cx="0" cy="4" rx="76" ry="14" />
        <path d="M-80 0 C-44 -18 -8 -20 82 -4" />
        <path d="M-90 16 C-38 6 12 8 96 20 V28 H-90 Z" fill="${visual.approachPropGlow}" opacity="0.26" stroke="none" />
        <path d="M-62 -14 L-16 -52" />
        <path d="M22 -54 L66 -18" />
        <circle cx="-6" cy="-2" r="6" fill="${visual.approachPropAccent}" stroke="none" opacity="0.7" />
      `;
    case "camp_pullout":
      return `
        <ellipse class="travel-approach-prop-shadow" cx="0" cy="4" rx="72" ry="14" />
        <rect x="-56" y="-18" width="112" height="18" rx="9" fill="${visual.approachPropAccent}" opacity="0.18" stroke="none" />
        <path d="M-34 -12 V-62" />
        <rect x="-66" y="-88" width="64" height="24" rx="6" fill="${visual.approachPropAccent}" />
        <path d="M12 -10 L12 -64" />
        <path d="M-10 -50 L16 -80 L42 -50 Z" fill="${visual.approachPropAccent}" />
        <rect x="0" y="-48" width="32" height="34" rx="3" />
      `;
    case "pass_cut":
      return `
        <ellipse class="travel-approach-prop-shadow" cx="0" cy="4" rx="78" ry="14" />
        <path d="M-90 18 L-44 -34 L-8 -6 L26 -52 L90 18 Z" />
        <path d="M-16 -10 H18" stroke="${visual.approachPropGlow}" />
        <path d="M24 -14 H46" stroke="${visual.approachPropAccent}" />
      `;
    case "shelf_overlook":
      return `
        <ellipse class="travel-approach-prop-shadow" cx="0" cy="4" rx="82" ry="14" />
        <path d="M-92 18 L-20 18 L20 -26 L94 -26" />
        <path d="M16 -54 L16 -24" />
        <rect x="-6" y="-78" width="44" height="20" rx="5" fill="${visual.approachPropAccent}" />
        <path d="M-34 6 H4" stroke="${visual.approachPropGlow}" />
      `;
    case "town_silhouette":
      return `
        <ellipse class="travel-approach-prop-shadow" cx="0" cy="4" rx="74" ry="14" />
        <rect x="-62" y="-18" width="124" height="20" rx="8" fill="${visual.approachPropAccent}" opacity="0.22" stroke="none" />
        <rect x="-56" y="-44" width="24" height="44" rx="3" />
        <rect x="-26" y="-58" width="30" height="58" rx="3" />
        <rect x="12" y="-48" width="22" height="48" rx="3" />
        <rect x="42" y="-72" width="14" height="72" rx="3" />
        <circle cx="49" cy="-80" r="8" fill="${visual.approachPropAccent}" stroke="none" />
        <path d="M-12 -8 H8" stroke="${visual.approachPropGlow}" />
        <path d="M-52 -24 H-36" stroke="${visual.approachPropWindow}" />
        <path d="M18 -26 H28" stroke="${visual.approachPropWindow}" />
      `;
    default:
      return `
        <ellipse class="travel-approach-prop-shadow" cx="0" cy="2" rx="46" ry="10" />
        <rect x="-20" y="-40" width="40" height="34" rx="3" />
      `;
  }
}

function renderScenicLandmarkShape(landmarkClass) {
  switch (landmarkClass) {
    case "coast":
      return `
        <path d="M-54 -8 C-38 -52 -4 -72 28 -58 C44 -52 58 -36 64 -10 H-64 C-62 -12 -58 -8 -54 -8 Z" />
        <path d="M-70 12 C-24 4 22 4 74 12 V26 H-70 Z" fill="#5de5ff" opacity="0.22" stroke="none" />
      `;
    case "town":
      return `
        <rect x="-46" y="-44" width="18" height="44" rx="2" />
        <rect x="-20" y="-52" width="24" height="52" rx="2" />
        <rect x="12" y="-36" width="20" height="36" rx="2" />
        <rect x="42" y="-58" width="12" height="58" rx="2" />
        <circle cx="48" cy="-64" r="8" />
      `;
    case "forest":
      return `
        <path d="M-46 0 L-20 -56 L6 0 Z" />
        <path d="M-4 0 L28 -72 L60 0 Z" />
        <path d="M42 0 L72 -48 L102 0 Z" />
        <rect x="-26" y="0" width="8" height="18" />
        <rect x="24" y="0" width="8" height="18" />
        <rect x="70" y="0" width="8" height="18" />
      `;
    case "ridge":
      return `
        <path d="M-72 8 C-44 -12 -24 -54 2 -56 C24 -58 50 -20 82 -6 L104 20 H-84 Z" />
      `;
    case "lake":
      return `
        <path d="M-60 -8 C-36 -38 -2 -50 34 -42 C62 -36 82 -20 98 8 H-74 C-72 4 -66 -2 -60 -8 Z" />
        <path d="M-84 12 C-22 6 28 6 102 14 V28 H-84 Z" fill="#7de9ff" opacity="0.28" stroke="none" />
      `;
    default:
      return `
        <path d="M-68 12 C-44 -18 -10 -42 28 -48 C54 -52 82 -40 104 -14 V24 H-82 Z" />
      `;
  }
}

function renderMidgroundShape(themeClass) {
  switch (themeClass) {
    case "town":
      return `
        <path d="M-160 246 C16 232 110 232 210 224 C314 216 424 222 534 234 C660 248 790 244 1120 238 V308 H-160 Z" />
        <g transform="translate(-46 0)">
          <rect x="14" y="182" width="110" height="54" rx="4" />
          <path d="M14 182 H124 L142 196 V236 H14 Z" />
          <rect x="160" y="174" width="84" height="62" rx="4" />
          <path d="M160 174 L202 146 L244 174 Z" />
          <rect x="280" y="166" width="66" height="70" rx="4" />
          <rect x="362" y="186" width="124" height="50" rx="4" />
          <path d="M376 186 H472 L494 198 V236 H362 Z" />
          <rect x="526" y="176" width="92" height="60" rx="4" />
          <path d="M526 176 L572 150 L618 176 Z" />
          <rect x="660" y="182" width="102" height="54" rx="4" />
          <rect x="790" y="168" width="72" height="68" rx="4" />
          <path d="M880 236 H982 V188 H926 V160 H896 V182 H880 Z" />
        </g>
      `;
    case "coast":
      return `
        <path d="M-160 238 C10 218 110 226 210 212 C314 198 418 208 520 224 C640 242 764 220 1120 230 V308 H-160 Z" />
      `;
    case "mesa":
      return `
        <path d="M-160 234 C40 208 122 206 206 196 C288 186 382 198 464 214 C582 238 724 236 1120 226 V308 H-160 Z" />
      `;
    case "mountain":
      return `
        <path d="M-160 240 C32 216 146 218 228 198 C312 176 396 192 484 210 C600 234 740 232 1120 230 V308 H-160 Z" />
      `;
    default:
      return `
        <path d="M-160 238 C20 220 126 220 226 206 C324 192 430 202 530 220 C654 242 786 236 1120 228 V308 H-160 Z" />
      `;
  }
}

function renderForegroundObjects(themeClass) {
  if (themeClass === "town") {
    return `
      <g transform="translate(-48 0)">
        <path d="M14 286 H102 V258 H62 V226 H34 V240 H14 Z" />
        <rect x="124" y="248" width="94" height="38" rx="3" />
        <path d="M140 248 H206 L226 260 H124 Z" />
        <rect x="248" y="242" width="18" height="44" rx="2" />
        <rect x="278" y="238" width="96" height="48" rx="3" />
        <rect x="300" y="252" width="24" height="18" rx="2" fill="#b8f3ff" stroke="none" opacity="0.72" />
        <rect x="336" y="252" width="18" height="18" rx="2" fill="#b8f3ff" stroke="none" opacity="0.62" />
        <rect x="398" y="244" width="84" height="42" rx="3" />
        <path d="M412 244 H470 L492 258 H398 Z" />
        <rect x="520" y="236" width="18" height="50" rx="2" />
        <path d="M528 222 V198" />
        <path d="M512 204 H544" />
        <path d="M568 286 H636 V254 H602 V230 H568 Z" />
        <rect x="660" y="250" width="78" height="36" rx="3" />
        <rect x="764" y="246" width="88" height="40" rx="3" />
        <path d="M778 246 H838 L860 258 H764 Z" />
        <path d="M100 238 L100 286 M94 248 H106 M206 232 L206 286 M200 244 H212 M620 226 L620 286 M614 236 H626 M892 234 L892 286 M886 244 H898" />
        <path d="M-20 286 H960" stroke-width="3" opacity="0.24" />
      </g>
    `;
  }

  if (themeClass === "mountain") {
    return `
      <g transform="translate(-40 0)">
        <path d="M84 240 L84 286" />
        <path d="M72 256 H96" />
        <path d="M206 246 L206 292" />
        <path d="M190 258 H222" />
        <path d="M318 252 L318 294" />
        <path d="M304 264 H332" />
        <path d="M454 240 L482 196 L510 240 Z" fill="#1ec9a9" stroke="none" />
        <rect x="474" y="240" width="8" height="18" fill="#193765" stroke="none" />
        <path d="M646 246 L672 204 L698 246 Z" fill="#1ec9a9" stroke="none" />
        <rect x="668" y="246" width="8" height="18" fill="#193765" stroke="none" />
        <path d="M824 242 L824 290" />
        <path d="M808 254 H840" />
      </g>
    `;
  }

  if (themeClass === "coast") {
    return `
      <g transform="translate(-40 0)">
        <path d="M88 274 C96 254 118 254 126 274 Z" fill="#1ec9a9" stroke="none" />
        <path d="M180 248 L180 292" />
        <path d="M172 256 H188" />
        <path d="M310 274 C318 254 340 254 348 274 Z" fill="#1ec9a9" stroke="none" />
        <path d="M430 250 L430 294" />
        <path d="M422 258 H438" />
        <path d="M614 274 C622 252 644 252 652 274 Z" fill="#1ec9a9" stroke="none" />
        <path d="M792 248 L792 292" />
        <path d="M784 256 H800" />
      </g>
    `;
  }

  return `
    <g transform="translate(-40 0)">
      <path d="M72 274 C84 252 102 252 114 274 Z" fill="#1ec9a9" stroke="none" />
      <path d="M170 248 L170 292" />
      <path d="M158 260 H182" />
      <path d="M298 274 C312 250 334 250 348 274 Z" fill="#1ec9a9" stroke="none" />
      <path d="M414 252 L414 294" />
      <path d="M404 264 H424" />
      <path d="M560 274 C572 252 592 252 604 274 Z" fill="#1ec9a9" stroke="none" />
      <path d="M716 248 L716 292" />
      <path d="M704 260 H728" />
      <path d="M860 274 C874 252 896 252 910 274 Z" fill="#1ec9a9" stroke="none" />
    </g>
  `;
}

function getTravelVisual(interlude) {
  const route = getRoutePreset(interlude.routePresetId);
  const themeClass = interlude.isLocalDestination ? "town" : getThemeClass(interlude.routePresetId);
  const landmarkClass = getLandmarkClass(interlude.routePresetId, interlude.targetTag);
  const tripProgress = getInterludeTripProgress(interlude);
  const terrainTint = interpolateHexColor(
    route.startTerrainTint ?? "#8f744d",
    route.endTerrainTint ?? "#6a7f90",
    tripProgress
  );

  const themePalette = {
    town: {
      skyTop: "#0b1730",
      skyBottom: "#335d7d",
      sunColor: "#ffc76b",
      distantFill: "#35566d",
      horizonMaskFill: "#2e4e67",
      midgroundFill: "#55708a",
      roadFill: "#141a2c",
      roadEdge: "#ffd28a",
      foregroundFill: "#263f59",
      foregroundStroke: "#17253f",
      landmarkFill: "#ef8a62"
    },
    coast: {
      skyTop: "#07142f",
      skyBottom: "#173d73",
      sunColor: "#ffb64c",
      distantFill: "#1a4468",
      horizonMaskFill: "#143b63",
      midgroundFill: "#10636f",
      roadFill: "#10182e",
      roadEdge: "#56ddff",
      foregroundFill: "#155161",
      foregroundStroke: "#11315a",
      landmarkFill: "#2ee0cb"
    },
    mesa: {
      skyTop: "#0f1532",
      skyBottom: "#7c2e4b",
      sunColor: "#ff9552",
      distantFill: "#5a3d75",
      horizonMaskFill: "#6d3863",
      midgroundFill: "#943f63",
      roadFill: "#151125",
      roadEdge: "#ffc95d",
      foregroundFill: "#1d897f",
      foregroundStroke: "#15355a",
      landmarkFill: "#ff6f82"
    },
    mountain: {
      skyTop: "#07152d",
      skyBottom: "#1f4f72",
      sunColor: "#ffd45d",
      distantFill: "#224967",
      horizonMaskFill: "#1b4567",
      midgroundFill: "#2a6177",
      roadFill: "#0f162a",
      roadEdge: "#6be8ff",
      foregroundFill: "#19627a",
      foregroundStroke: "#122d4c",
      landmarkFill: "#82d7ff"
    }
  };

  const basePalette = themePalette[themeClass];

  if (interlude.isNightPush) {
    return {
      skyTop: "#02030a",
      skyBottom: "#05050f",
      sunColor: "#d8e6ff",
      moonColor: "#d8e6ff",
      distantFill: mixHexColors(basePalette.distantFill, "#030612", 0.74),
      horizonMaskFill: mixHexColors(basePalette.horizonMaskFill, "#030612", 0.78),
      midgroundFill: mixHexColors(basePalette.midgroundFill, "#030612", 0.7),
      roadFill: "#050814",
      roadEdge: mixHexColors(basePalette.roadEdge, "#9fb3d4", 0.46),
      foregroundFill: mixHexColors(basePalette.foregroundFill, "#02040c", 0.68),
      foregroundStroke: "#02040c",
      landmarkFill: mixHexColors(basePalette.landmarkFill, "#111a33", 0.62),
      approachPropFill: mixHexColors(basePalette.landmarkFill, "#091024", 0.58),
      approachPropStroke: "#02040c",
      approachPropAccent: mixHexColors(basePalette.roadEdge, "#d8e6ff", 0.34),
      approachPropGlow: "#d8e6ff",
      approachPropWindow: "#d8e6ff",
      contextFill: mixHexColors(basePalette.midgroundFill, "#030612", 0.72),
      contextStroke: "#02040c",
      terrainTintTop: "#18223a",
      terrainTintMid: "#091024",
      terrainTintDeep: "#02040c",
      gradientKey: `${themeClass}-${route.id}-night-${Math.round(tripProgress * 1000)}`,
      themeClass,
      landmarkClass,
      departureContext: interlude.departureContext ?? "none"
    };
  }

  return {
    skyTop: mixHexColors(basePalette.skyTop, terrainTint, 0.16),
    skyBottom: mixHexColors(basePalette.skyBottom, terrainTint, 0.22),
    sunColor: basePalette.sunColor,
    moonColor: "#d8e6ff",
    distantFill: mixHexColors(basePalette.distantFill, terrainTint, 0.32),
    horizonMaskFill: mixHexColors(basePalette.horizonMaskFill, terrainTint, 0.4),
    midgroundFill: mixHexColors(basePalette.midgroundFill, terrainTint, 0.24),
    roadFill: basePalette.roadFill,
    roadEdge: mixHexColors(basePalette.roadEdge, terrainTint, 0.12),
    foregroundFill: mixHexColors(basePalette.foregroundFill, terrainTint, 0.16),
    foregroundStroke: basePalette.foregroundStroke,
    landmarkFill: mixHexColors(basePalette.landmarkFill, terrainTint, 0.16),
    approachPropFill: mixHexColors(basePalette.landmarkFill, terrainTint, 0.12),
    approachPropStroke: mixHexColors(basePalette.foregroundStroke, terrainTint, 0.24),
    approachPropAccent: mixHexColors(basePalette.roadEdge, terrainTint, 0.18),
    approachPropGlow: mixHexColors(basePalette.sunColor, "#fff2b5", 0.36),
    approachPropWindow: mixHexColors(basePalette.roadEdge, "#e9f6ff", 0.42),
    contextFill: mixHexColors(basePalette.midgroundFill, terrainTint, 0.18),
    contextStroke: mixHexColors(basePalette.foregroundStroke, terrainTint, 0.12),
    terrainTintTop: mixHexColors(terrainTint, "#ffffff", 0.42),
    terrainTintMid: terrainTint,
    terrainTintDeep: mixHexColors(terrainTint, "#0b1125", 0.34),
    gradientKey: `${themeClass}-${route.id}-${Math.round(tripProgress * 1000)}`,
    themeClass,
    landmarkClass,
    departureContext: interlude.departureContext ?? "none"
  };
}

function getThemeClass(routePresetId) {
  if (routePresetId === "rain_coast") {
    return "coast";
  }
  if (routePresetId === "basin_lakes") {
    return "mountain";
  }
  return "mesa";
}

function getLandmarkClass(routePresetId, targetTag) {
  const tagMap = {
    wash: "mesa",
    water: "lake",
    service: "town",
    ferry: "town",
    timber: "forest",
    camp: "forest",
    shelf: "ridge",
    pass: "ridge",
    destination:
      routePresetId === "rain_coast"
        ? "coast"
        : routePresetId === "basin_lakes"
          ? "lake"
          : "forest"
  };

  return tagMap[targetTag] ?? (routePresetId === "basin_lakes" ? "ridge" : "mesa");
}

function buildStatusLine(run, targetName, chunkReason = "day_complete", presentationMode = "normal") {
  const isLocalDestination = Boolean(run.day.travelSession?.activeLeg?.progressionMode === "local_destination");
  const isNightPush =
    run.day.travelSession?.travelPeriod === "night_push" ||
    run.day.travelSession?.activeLeg?.nightDriveFromTown === true;

  if (presentationMode === "tiny_approach") {
    return `${targetName} comes up almost right away.`;
  }

  if (presentationMode === "short_approach") {
    return `${targetName} is just down the road now.`;
  }

  if (isNightPush) {
    if (chunkReason === "arrival") {
      return `${targetName} is closer, but this is no longer a proper night stop.`;
    }
    if (chunkReason === "interruption") {
      return "The road asks for attention at the worst time of day.";
    }
    return "You push north after dark, trading a real evening for risky miles.";
  }

  if (chunkReason === "interruption") {
    return `Something comes up on the road as you head toward ${targetName}.`;
  }

  if (chunkReason === "arrival") {
    if (isLocalDestination) {
      return `${targetName} is close now as the town streets narrow around you.`;
    }
    return `${targetName} is just ahead now.`;
  }

  if (run.day.routeArrivalNotice?.kind === "destination") {
    return `${run.journey.destinationName} is finally close at hand.`;
  }

  if (run.day.routeArrivalNotice) {
    return `${run.day.routeArrivalNotice.title}.`;
  }

  if (run.day.dailyConditionDelta <= -8) {
    return "The road is wearing on the RV today.";
  }

  if (run.day.dailyBatteryDelta <= -8) {
    return "Power is slipping as the miles add up.";
  }

  if (run.day.dailyMoraleDelta <= -3) {
    return "The cabin feels tighter as the day wears on.";
  }

  if (run.day.dailyMilesDriven >= 520) {
    return `The RV is covering ground toward ${targetName}.`;
  }

  return isLocalDestination ? `You work through town toward ${targetName}.` : `Driving toward ${targetName}.`;
}

function buildTimePressureLine(run, chunk) {
  const endMinutes = Number(chunk.dayClockEndMinutes) || DAY_CLOCK_END_MINUTES;
  const derived = getDerivedStatus(run);
  const warningText = derived.warnings?.length
    ? ` ${derived.warnings.slice(0, 2).map(formatTravelWarningPhrase).join(" ")}`
    : "";

  if (chunk.presentationMode === "tiny_approach") {
    return `Closing Stretch: This is only a handoff to the stop, not a full travel beat.${warningText}`;
  }

  if (chunk.presentationMode === "short_approach") {
    return `Closing Stretch: Only a few miles remain, so the road should feel quick from here.${warningText}`;
  }

  if (run.day.travelSession?.travelPeriod === "night_push") {
    return `Too Late To Count On Good Options: Every mile now makes the stop rougher.${warningText}`;
  }

  if (chunk.reason === "fuel_stop") {
    return "Midday: A quick stop can steady the day, but it spends daylight before evening choices.";
  }

  if (endMinutes < 12 * 60) {
    return `Morning: The day is still open.${warningText}`;
  }

  if (endMinutes < 15 * 60) {
    return `Midday: Small choices can protect the evening.${warningText}`;
  }

  if (endMinutes < 17 * 60) {
    return `Afternoon: The day is starting to slip by. Soon you will be choosing where the night lands.${warningText}`;
  }

  if (endMinutes < 19 * 60) {
    return `Evening: This is the good stop window. Waiting may improve the story, but it raises the risk.${warningText}`;
  }

  return `Getting Late: The best daylight is gone. Good stops get rarer from here.${warningText}`;
}

function formatTravelWarningPhrase(flag) {
  const text = String(flag ?? "").toLowerCase();

  if (text.includes("water")) {
    return "Water is running lower than you would like.";
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

  return `${String(flag ?? "Something").replaceAll("_", " ")} is worth watching.`;
}

function getInterludeActionLabel(interlude) {
  if (interlude.presentationMode === "tiny_approach" || interlude.presentationMode === "short_approach") {
    return `Reach ${interlude.targetName}`;
  }

  if (interlude.isNightPush) {
    if (interlude.chunkReason === "arrival") {
      return `Reach ${interlude.targetName} After Dark`;
    }
    if (interlude.chunkReason === "interruption") {
      return "Handle The Night Road";
    }
    return "Find Somewhere To Pull Over";
  }

  if (interlude.chunkReason === "interruption") {
    return "Pause For The Road Event";
  }

  if (interlude.chunkReason === "fuel_stop") {
    return "Consider The Midday Stop";
  }

  if (interlude.chunkReason === "arrival") {
    if (interlude.isLocalDestination) {
      return `Pull In At ${interlude.targetName}`;
    }
    return `Arrive At ${interlude.targetName}`;
  }

  return "Stop For Camp";
}

function getInterludeButtonLabel(interlude) {
  if (interlude.presentationMode === "tiny_approach" || interlude.presentationMode === "short_approach") {
    return "Arrive";
  }

  return "Continue";
}

function getTravelProgressFootLabel(interlude) {
  if (interlude.presentationMode === "tiny_approach") {
    return "The stop comes up almost right away";
  }

  if (interlude.presentationMode === "short_approach") {
    return "A short approach carries you into the stop";
  }

  if (interlude.isNightPush) {
    return "A forced roadside sleep comes after this push";
  }

  if (interlude.chunkReason === "interruption") {
    return "Travel pauses as soon as the road changes";
  }

  if (interlude.chunkReason === "fuel_stop") {
    return "A short stop could help, but it costs daylight";
  }

  if (interlude.chunkReason === "arrival") {
    if (interlude.isLocalDestination) {
      return `${interlude.targetName} ends this town stretch`;
    }
    return `${interlude.targetName} ends this stretch`;
  }

  return "Camp comes after this stretch";
}

function renderDepartureContext(context) {
  if (context === "town_edge") {
    return `
      <g transform="translate(-24 0)">
        <path d="M12 286 H132 V244 H84 V222 H48 V236 H12 Z" />
        <rect x="144" y="236" width="72" height="50" rx="2" />
        <path d="M144 236 L180 214 L216 236 Z" />
        <rect x="236" y="248" width="48" height="38" rx="2" />
        <rect x="294" y="204" width="18" height="82" rx="2" />
        <circle cx="303" cy="192" r="16" />
        <path d="M334 286 H398 V252 H366 V230 H334 Z" />
        <rect x="424" y="244" width="88" height="42" rx="3" />
        <path d="M440 244 H496 L516 258 H424 Z" />
        <path d="M80 214 L80 286 M74 228 H86 M152 198 L152 286 M146 210 H158 M228 214 L228 286 M222 226 H234 M548 204 L548 286 M542 216 H554" />
        <path d="M0 286 H600" stroke-width="3" opacity="0.35" />
      </g>
    `;
  }

  return "";
}

function getDepartureContext(run, currentPoint) {
  if (!currentPoint) {
    return "none";
  }

  if (
    currentPoint.kind === "origin" ||
    currentPoint.tag === "service" ||
    currentPoint.tag === "ferry" ||
    typeof currentPoint.townId === "string"
  ) {
    return "town_edge";
  }

  return "none";
}

function buildInterludeApproachProps(approachProps, legProgressStart) {
  if (!Array.isArray(approachProps)) {
    return [];
  }

  return approachProps.map((entry) => ({
    ...entry,
    initialPose: getTravelApproachPose(entry, legProgressStart)
  }));
}

function getInterludeTripProgress(interlude) {
  const start = Number(interlude.totalProgressStart ?? 0);
  const end = Number(interlude.totalProgressEnd ?? start);

  return Math.max(0, Math.min(1, (start + end) / 2));
}

function mixHexColors(baseHex, blendHex, amount) {
  const base = parseHexColor(baseHex);
  const blend = parseHexColor(blendHex);
  const weight = Math.max(0, Math.min(1, Number(amount) || 0));

  return toHexColor({
    r: Math.round(base.r + (blend.r - base.r) * weight),
    g: Math.round(base.g + (blend.g - base.g) * weight),
    b: Math.round(base.b + (blend.b - base.b) * weight)
  });
}

function interpolateHexColor(startHex, endHex, progress) {
  return mixHexColors(startHex, endHex, progress);
}

function parseHexColor(hex) {
  const clean = String(hex).replace("#", "").trim();
  const normalized =
    clean.length === 3
      ? clean
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : clean.padStart(6, "0").slice(0, 6);

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16) || 0,
    g: Number.parseInt(normalized.slice(2, 4), 16) || 0,
    b: Number.parseInt(normalized.slice(4, 6), 16) || 0
  };
}

function toHexColor({ r, g, b }) {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0"))
    .join("")}`;
}

function getTotalProgress(run) {
  return clampPercentNumber(
    (Math.max(0, Number(run.journey.milesTraveled) || 0) /
      Math.max(1, Number(run.journey.totalMilesToDestination) || 1))
  );
}

function lerp(start, end, progress) {
  return start + (end - start) * (Number(progress) || 0);
}

function clampPercentNumber(value) {
  return Math.max(0, Math.min(1, Number(value) || 0)).toFixed(3);
}

function getSunPositionForProgress(arc, rawProgress) {
  const progress = Math.max(0, Math.min(1, Number(rawProgress) || 0));
  const x = arc.startX + (arc.endX - arc.startX) * progress;
  const baseY = arc.startY + (arc.endY - arc.startY) * progress;
  const peakLift = ((arc.startY + arc.endY) / 2 - arc.peakY) * 4 * progress * (1 - progress);

  return {
    x: x.toFixed(1),
    y: (baseY - peakLift).toFixed(1)
  };
}

function getSkyProgressForClockMinutes(totalMinutes) {
  const normalizedMinutes = ((Math.round(Number(totalMinutes) || 0) % 1440) + 1440) % 1440;

  if (normalizedMinutes < 5 * 60) {
    return 0;
  }

  if (normalizedMinutes < 7 * 60) {
    return lerp(0, 0.18, (normalizedMinutes - 5 * 60) / (2 * 60));
  }

  if (normalizedMinutes < 12 * 60) {
    return lerp(0.18, 0.5, (normalizedMinutes - 7 * 60) / (5 * 60));
  }

  if (normalizedMinutes < 16.5 * 60) {
    return lerp(0.5, 0.72, (normalizedMinutes - 12 * 60) / (4.5 * 60));
  }

  if (normalizedMinutes < 18 * 60) {
    return lerp(0.72, 0.88, (normalizedMinutes - 16.5 * 60) / (1.5 * 60));
  }

  if (normalizedMinutes < 19 * 60) {
    return lerp(0.88, 0.98, (normalizedMinutes - 18 * 60) / 60);
  }

  return 1;
}

function getSkyColorForProgress(rawProgress) {
  const progress = Math.max(0, Math.min(1, Number(rawProgress) || 0));
  let lower = SKY_COLOR_KEYFRAMES[0];
  let upper = SKY_COLOR_KEYFRAMES[SKY_COLOR_KEYFRAMES.length - 1];

  for (let index = 0; index < SKY_COLOR_KEYFRAMES.length - 1; index += 1) {
    if (progress >= SKY_COLOR_KEYFRAMES[index][0] && progress <= SKY_COLOR_KEYFRAMES[index + 1][0]) {
      lower = SKY_COLOR_KEYFRAMES[index];
      upper = SKY_COLOR_KEYFRAMES[index + 1];
      break;
    }
  }

  const range = upper[0] - lower[0];
  const t = range > 0 ? (progress - lower[0]) / range : 0;

  return [
    Math.round(lower[1][0] + (upper[1][0] - lower[1][0]) * t),
    Math.round(lower[1][1] + (upper[1][1] - lower[1][1]) * t),
    Math.round(lower[1][2] + (upper[1][2] - lower[1][2]) * t)
  ];
}

function formatRgb([r, g, b]) {
  return `rgb(${r},${g},${b})`;
}

function formatClockMinutes(totalMinutes) {
  const normalizedMinutes = Math.max(0, Math.round(Number(totalMinutes) || 0));
  const hours = Math.floor(normalizedMinutes / 60) % 24;
  const minutes = normalizedMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function findRoutePoint(routePoints, pointId) {
  if (!Array.isArray(routePoints) || !pointId) {
    return null;
  }

  return routePoints.find((point) => point.id === pointId) ?? null;
}

function getFirstUpcomingPoint(routePoints, milesTraveled) {
  if (!Array.isArray(routePoints)) {
    return null;
  }

  return routePoints.find((point) => point.mileMarker > milesTraveled) ?? null;
}

function getCurrentOrLastPoint(routePoints, milesTraveled) {
  if (!Array.isArray(routePoints) || routePoints.length === 0) {
    return null;
  }

  let currentPoint = routePoints[0];

  for (const point of routePoints) {
    if (point.mileMarker <= milesTraveled) {
      currentPoint = point;
      continue;
    }

    break;
  }

  return currentPoint;
}

function getLastRoutePoint(routePoints) {
  if (!Array.isArray(routePoints) || routePoints.length === 0) {
    return null;
  }

  return routePoints[routePoints.length - 1];
}
