import {
  getComfortPolicyOption,
  getTravelModeOption,
  routePresets
} from "../state/gameContent.js";
import {
  formatDisplayDate,
  getForecastSummary,
  getDerivedStatus,
  getWarningLabel
} from "../state/gameState.js";
import {
  renderActiveOverlay,
  renderBulletList,
  renderLedger,
  renderSection,
  renderTitleReturnButton
} from "./components.js";
import {
  MAP_VIEWBOX,
  buildRoutePath,
  buildTraveledPath,
  getRouteCoordinates,
  getRouteLayout,
  interpolateRoutePosition
} from "./tripMapData.js";

export function renderTripMapScreen(state) {
  const run = state.run;
  const derived = getDerivedStatus(run);
  const routeSummary = derived.routeProgressSummary;
  const drivingStyle = getTravelModeOption(run.policies.drivingStyle ?? run.policies.travelMode);
  const comfortPolicy = getComfortPolicyOption(run.policies.comfortPolicy);

  return `
    <div class="app-shell app-shell--no-status app-shell--with-return screen-trip_map">
      ${renderTitleReturnButton()}
      <section class="panel journey-status-frame">
        <header class="journey-status-header">
          <div class="journey-status-header-copy">
            <h1>Journey Status</h1>
            <p class="journey-status-lead">Where you are, what you have, and how today is set to feel.</p>
          </div>
        </header>
        <div class="journey-status-body">
          <section class="journey-status-map-stage">
            ${renderTripMap(run)}
            <div class="journey-status-note-card journey-status-note-card--position">
              ${renderSection(
                "Journey Position",
                renderLedger([
                  { label: "Today", value: `Day ${run.dayNumber} | ${formatDisplayDate(run.day.currentDate)}` },
                  { label: "Here", value: run.journey.currentLocationName },
                  { label: "Next stop", value: `${routeSummary.nextWaypointName} | ${routeSummary.nextWaypointMilesAway} mi` },
                  { label: "Miles left", value: `${run.journey.milesRemaining}` },
                  { label: "Coastal line", value: run.journey.routeName }
                ]),
                "section-block--compact"
              )}
            </div>
          </section>
          <aside class="journey-status-sidebar">
            <div class="journey-status-note-card">
              ${renderSection(
                "Trip Resources",
                `
                  ${renderLedger([
                    { label: "Electric", value: `${run.v2.resources.electric.charge}/${run.v2.resources.electric.capacity}` },
                    { label: "Water", value: `${run.v2.resources.water.current}/${run.v2.resources.water.capacity}` },
                    { label: "Waste", value: `${run.v2.resources.waste.current}/${run.v2.resources.waste.capacity}` },
                    { label: "Trip Feel", value: run.gameOver || run.victory ? `${(run.score?.finalScore ?? derived.finalScore ?? 0).toFixed(1)} / 10` : "In progress" },
                    { label: "Solar Outlook", value: derived.solarOutlook },
                    { label: "Outlook", value: derived.moraleDescriptor }
                  ])}
                  ${renderSection(
                    "Trip Settings",
                    `
                      <div class="journey-status-setting-stack">
                        <div class="journey-status-setting-row">
                          <div class="journey-status-setting-copy">
                            <p class="choice-kicker">Day Tone</p>
                            <strong>${drivingStyle.label}</strong>
                            <p class="choice-detail">${drivingStyle.description}</p>
                          </div>
                          <div class="journey-status-setting-actions">
                            <button class="status-open-button journey-status-setting-button" data-action="cycle" data-target="travel-mode">
                              Change Tone
                            </button>
                            <button class="status-open-button journey-status-setting-button journey-status-setting-button--quiet" data-action="open-overlay" data-overlay="setting-help:travelMode">
                              What Does That Mean?
                            </button>
                          </div>
                        </div>
                        <div class="journey-status-setting-row">
                          <div class="journey-status-setting-copy">
                            <p class="choice-kicker">Living Policy</p>
                            <strong>${comfortPolicy.label}</strong>
                            <p class="choice-detail">${comfortPolicy.description}</p>
                          </div>
                          <div class="journey-status-setting-actions">
                            <button class="status-open-button journey-status-setting-button" data-action="cycle" data-target="comfort-policy">
                              Change Policy
                            </button>
                            <button class="status-open-button journey-status-setting-button journey-status-setting-button--quiet" data-action="open-overlay" data-overlay="setting-help:comfortPolicy">
                              What Does That Mean?
                            </button>
                          </div>
                        </div>
                      </div>
                    `,
                    "section-block--compact section-block--journey-settings"
                  )}
                `,
                "section-block--compact journey-status-section-stack"
              )}
            </div>
            <div class="journey-status-note-card">
              ${renderSection(
                "Road Watch",
                renderBulletList([
                  `Sky: ${getForecastSummary(run)}.`,
                  `This stretch: ${routeSummary.currentSegmentSummary}.`,
                  derived.warnings.length > 0
                    ? `Watch for: ${derived.warnings.slice(0, 2).map(getWarningLabel).join(", ")}.`
                    : "Nothing urgent is pressing right now."
                ]),
                "section-block--compact"
              )}
            </div>
          </aside>
        </div>
        <div class="journey-status-actions">
          <button class="title-menu-button title-menu-button--primary journey-status-button" data-action="close-map">
            <span>Back</span>
          </button>
        </div>
      </section>
      ${renderActiveOverlay(state, { showStatus: false })}
    </div>
  `;
}

export function renderTripMap(run) {
  const activeRouteId = run.metadata.routePresetId;
  const activePreset = routePresets.find((route) => route.id === activeRouteId) ?? routePresets[0];
  const activeRoute = {
    ...activePreset,
    totalMiles: run.journey.totalMilesToDestination,
    routePoints: run.journey.routePoints
  };
  const activeLayout = getRouteLayout(activeRoute.id);
  const currentMarker =
    activeLayout && activeRoute
      ? interpolateRoutePosition(activeRoute, activeLayout, run.journey.milesTraveled)
      : null;

  return `
    <div class="trip-map-card">
      <div class="trip-map-viewport">
        <svg
          class="trip-map-svg"
          viewBox="0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}"
          role="img"
          aria-label="${escapeHtml(`Trip map showing ${activeRoute.label} progress`)}"
        >
          <defs>
            <linearGradient id="trip-map-sky" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#07142f" />
              <stop offset="48%" stop-color="#16224b" />
              <stop offset="100%" stop-color="#451b45" />
            </linearGradient>
            <filter id="trip-map-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect class="trip-map-bg" width="1000" height="620" rx="34" fill="url(#trip-map-sky)" />
          <circle class="trip-map-sun" cx="830" cy="122" r="44" />
          <path class="trip-map-range trip-map-range--back" d="M24 194 C170 104 250 158 352 98 C492 18 592 104 740 62 C856 30 928 50 1016 16 V0 H24 Z" />
          <path class="trip-map-range" d="M-30 526 C132 430 214 486 354 396 C520 290 638 372 790 262 C884 194 936 206 1036 158 V620 H-30 Z" />
          ${routePresets
            .map((route) => renderMapRoute(route.id === activeRouteId ? activeRoute : route, run))
            .join("")}
          ${
            currentMarker
              ? renderCurrentMarker(currentMarker, activeRoute)
              : ""
          }
        </svg>
      </div>
      <div class="trip-map-legend">
        <span><i class="trip-map-legend-key trip-map-legend-key--passed"></i>Passed</span>
        <span><i class="trip-map-legend-key trip-map-legend-key--current"></i>Here now</span>
        <span><i class="trip-map-legend-key trip-map-legend-key--ahead"></i>Ahead</span>
      </div>
    </div>
  `;
}

function renderMapRoute(route, run) {
  const layout = getRouteLayout(route.id);

  if (!layout) {
    return "";
  }

  const active = route.id === run.metadata.routePresetId;
  const routeStateClass = active ? "is-active" : "is-muted";
  const coordinates = getRouteCoordinates(route, layout);
  const linePath = buildRoutePath(coordinates);
  const traveledPath = active ? buildTraveledPath(route, layout, run.journey.milesTraveled) : "";

  return `
    <g class="trip-map-route trip-map-route--${layout.routeClass} ${routeStateClass}">
      <path class="trip-map-route-line" d="${linePath}" />
      ${traveledPath ? `<path class="trip-map-route-line trip-map-route-line--traveled" d="${traveledPath}" />` : ""}
      ${renderRoutePoints(route, coordinates, run, active)}
      <text
        class="trip-map-route-label"
        x="${coordinates[0].x}"
        y="${coordinates[0].y - 58}"
        text-anchor="start"
      >${escapeHtml(route.label)}</text>
    </g>
  `;
}

function renderRoutePoints(route, coordinates, run, active) {
  return route.routePoints
    .map((point, index) => {
      const coordinate = coordinates[index];

      if (!coordinate) {
        return "";
      }

      const pointState = getPointState(route, point, run, active);
      const pointType = getPointType(point);
      const labelY = coordinate.y + coordinate.labelDy;

      return `
        <g class="trip-map-place trip-map-place--${pointType} trip-map-place--${pointState}">
          <circle class="trip-map-place-halo" cx="${coordinate.x}" cy="${coordinate.y}" r="19" />
          <circle class="trip-map-place-dot" cx="${coordinate.x}" cy="${coordinate.y}" r="${pointType === "destination" ? 10 : pointType === "origin" ? 8 : 7}" />
          <text
            class="trip-map-place-label"
            x="${coordinate.x}"
            y="${labelY}"
            text-anchor="${coordinate.labelAnchor}"
          >${escapeHtml(point.name)}</text>
        </g>
      `;
    })
    .join("");
}

function renderCurrentMarker(marker, route) {
  return `
    <g class="trip-map-current-marker" transform="translate(${marker.x} ${marker.y})" filter="url(#trip-map-glow)">
      <circle class="trip-map-current-pulse" cx="0" cy="0" r="24" />
      <path class="trip-map-current-rv-shadow" d="M-24 17 H25" />
      <rect class="trip-map-current-rv" x="-22" y="-13" width="44" height="24" rx="6" />
      <rect class="trip-map-current-window" x="-14" y="-7" width="13" height="8" rx="2" />
      <rect class="trip-map-current-window" x="4" y="-7" width="12" height="8" rx="2" />
      <circle class="trip-map-current-wheel" cx="-12" cy="13" r="5" />
      <circle class="trip-map-current-wheel" cx="13" cy="13" r="5" />
      <text class="trip-map-current-label" x="0" y="-32" text-anchor="middle">${escapeHtml(route.label)}</text>
    </g>
  `;
}

function getPointState(route, point, run, active) {
  if (!active) {
    return "inactive";
  }

  if (point.id === run.journey.currentRoutePointId) {
    return "current";
  }

  if (point.mileMarker < run.journey.milesTraveled) {
    return "passed";
  }

  return "ahead";
}

function getPointType(point) {
  if (point.kind === "origin") {
    return "origin";
  }

  if (point.kind === "destination") {
    return "destination";
  }

  return point.tag ?? "waypoint";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
