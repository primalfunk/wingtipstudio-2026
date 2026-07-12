import {
  formatDisplayDate,
  getDerivedStatus,
  getForecastSummary,
  getLossLabel,
  getPhaseLabel,
  getWarningLabel
} from "../state/gameState.js";
import { DAY_PHASES, STATUS_THRESHOLDS } from "../constants/gameConstants.js";
import {
  getComfortPolicyOption,
  getSettingExplanation,
  getTravelModeOption
} from "../state/gameContent.js";
import { getCampContext } from "../systems/campLoop.js";
import { calculateOvernightResolution } from "../systems/overnightResolution.js";
import { getActiveRouteStop, ROUTE_STOP_TYPES } from "../systems/routeStopState.js";
import { renderSceneIllustration } from "./illustrations.js";
import {
  getRouteMarkerIcon,
  getWarningIcon,
  renderAssetIcon
} from "./assetCatalog.js";

export function renderShell({
  state,
  screenId,
  eyebrow,
  title,
  lead,
  sceneVariant,
  sceneCaption,
  primaryHtml,
  secondaryHtml,
  secondaryTitle = "More",
  secondaryMode = "disclosure",
  secondaryOpen = false,
  showSceneIllustration = true,
  headerGraphicHtml = "",
  extraPanelsHtml = "",
  actions = [],
  actionHeading = actions.length > 1 ? "Menu" : "Continue",
  footerNote,
  showStatus = true,
  allowStatusOverlay = showStatus,
  statusHtml = "",
  backgroundHtml = "",
  showTitleReturn = screenId !== "title"
}) {
  const sceneHtml = showSceneIllustration
    ? `
        <div class="frame-scene-visual">
          ${renderSceneIllustration(sceneVariant, sceneCaption)}
        </div>
      `
    : "";

  return `
    <div class="app-shell screen-${screenId} ${showStatus ? "app-shell--with-status" : "app-shell--no-status"} ${showTitleReturn ? "app-shell--with-return" : ""}">
      ${showTitleReturn ? renderTitleReturnButton() : ""}
      ${showStatus ? (statusHtml || renderStatusBand(state)) : ""}
      <section class="panel gameplay-frame gameplay-frame--shell ${backgroundHtml ? "gameplay-frame--scenic" : ""}">
        ${backgroundHtml}
        <div class="frame-scene ${showSceneIllustration ? "frame-scene--with-illustration" : "frame-scene--title-only"}">
          <div class="frame-scene-card">
            <header class="screen-header ${headerGraphicHtml ? "screen-header--graphic" : ""}">
              ${
                headerGraphicHtml
                  ? `<div class="screen-header-media">${headerGraphicHtml}</div>`
                  : ""
              }
              <div class="screen-header-copy">
                <h1>${title}</h1>
              </div>
            </header>
            ${sceneHtml}
          </div>
        </div>
        <div class="frame-body">
          <div class="frame-content-card frame-content-card--primary">
            ${primaryHtml}
          </div>
        </div>
        ${
          secondaryHtml
            ? `
              <aside class="frame-support">
                <div class="frame-content-card frame-content-card--support">
                  ${secondaryHtml}
                </div>
              </aside>
            `
            : ""
        }
        ${
          actions.length > 0
            ? `
              <div class="frame-actions">
                <div class="action-stack ${actions.length === 1 ? "action-stack--single" : ""}">
                  ${actions.map((action) => renderButton(action)).join("")}
                </div>
              </div>
            `
            : ""
        }
      </section>
      ${renderActiveOverlay(state, { showStatus: allowStatusOverlay })}
      ${extraPanelsHtml}
      ${
        footerNote
          ? `
            <section class="panel frame-footer-note">
              ${footerNote}
            </section>
          `
          : ""
      }
    </div>
  `;
}

export function renderDramaticShell({
  state,
  screenId,
  eyebrow,
  title,
  lead,
  sceneVariant,
  sceneCaption = "",
  messageHtml,
  ledgerRows = [],
  actions = [],
  actionHeading = actions.length > 1 ? "Pick One" : "Continue",
  backgroundHtml = "",
  showSceneIllustration = true,
  showTitleReturn = screenId !== "title"
}) {
  return `
    <div class="app-shell app-shell--no-status app-shell--dramatic screen-${screenId} ${showTitleReturn ? "app-shell--with-return" : ""}">
      ${showTitleReturn ? renderTitleReturnButton() : ""}
      <section class="panel gameplay-frame dramatic-frame dramatic-frame--shell ${backgroundHtml ? "gameplay-frame--scenic dramatic-frame--scenic" : ""}">
        ${backgroundHtml}
        ${
          showSceneIllustration
            ? `
              <div class="dramatic-scene">
                <div class="dramatic-scene-card">
                  ${renderSceneIllustration(sceneVariant, sceneCaption)}
                </div>
              </div>
            `
            : ""
        }
        <section class="dramatic-message">
          <h1>${title}</h1>
          <div class="dramatic-message-body">
            ${messageHtml}
          </div>
        </section>
        ${
          ledgerRows.length > 0
            ? `
              <section class="dramatic-ledger" aria-label="Trip state">
                ${renderLedger(ledgerRows)}
              </section>
            `
            : ""
        }
        ${
          actions.length > 0
            ? `
              <div class="frame-actions dramatic-actions">
                <div class="action-stack">
                  ${actions.map((action) => renderButton(action)).join("")}
                </div>
              </div>
            `
            : ""
        }
      </section>
    </div>
  `;
}

export function renderStatusBand(state, options = {}) {
  const run = options.displayRun ?? state.run;
  const derived = getDerivedStatus(run);
  const routeSummary = options.routeSummary ?? derived.routeProgressSummary;
  const warnings = derived.warnings.slice(0, 2);
  const warningOverflow = Math.max(0, derived.warnings.length - warnings.length);
  const showResources = options.showResources ?? true;
  const showWarnings = options.showWarnings ?? true;
  const compactClass = !showResources && !showWarnings ? " status-band--compact" : "";
  const statusRows = [
    { label: "Electric", value: `${derived.electricPercent}%`, tone: getMeterTone(derived.electricPercent) },
    { label: "Water", value: `${derived.waterPercent}%`, tone: getMeterTone(derived.waterPercent) },
    { label: "Waste", value: `${derived.wastePercent}%`, tone: getWasteTone(derived.wastePercent) },
    { label: "Solar Outlook", value: derived.solarOutlook, tone: getSolarTone(derived.solarOutlook) },
    { label: "Trip Feel", value: getTripFeelLabel(run, derived), tone: getScoreTone(derived.baseScore) },
    { label: "Outlook", value: derived.moraleDescriptor, tone: getBandTone(derived.moraleBand) }
  ];

  return `
    <section class="panel status-band${compactClass}">
      <div class="status-topline">
        <div class="status-journey">
          <p class="status-kicker">Day ${run.dayNumber} | ${formatDisplayDate(run.day.currentDate)}</p>
          <h2>${options.journeyTitle ?? run.journey.currentLocationName}</h2>
          <p>${options.journeyLine ?? `Next ${routeSummary.nextWaypointName} in ${routeSummary.nextWaypointMilesAway} mi - ${run.journey.milesRemaining} to go`}</p>
        </div>
        <div class="status-side">
          <div class="status-phase-label">${options.phaseLabel ?? getPhaseLabel(run.currentPhase)}</div>
          <div class="status-actions">
            <button class="status-open-button" data-action="open-map">
              Journey Status
            </button>
            <button class="status-open-button" data-action="open-overlay" data-overlay="status">
              Closer Look
            </button>
          </div>
        </div>
      </div>
      ${
        showResources
          ? `
            <div class="status-grid" aria-label="Core trip status">
              ${statusRows.map((row) => renderStatusCell(row)).join("")}
            </div>
          `
          : ""
      }
      ${
        showWarnings
          ? `
            <div class="warning-strip warning-strip--plain">
              ${
                warnings.length > 0
                  ? `${warnings.map((flag) => renderWarningChip(flag)).join("")}${
                      warningOverflow > 0
                        ? `<span class="warning-line">+${warningOverflow} more</span>`
                        : ""
                    }`
                  : '<span class="warning-line">Nothing urgent right now</span>'
              }
            </div>
          `
          : ""
      }
    </section>
  `;
}

export function renderActiveOverlay(state, options = {}) {
  const overlayId = state.ui.overlay;
  const showStatus = options.showStatus ?? true;

  if (overlayId === "status") {
    return showStatus ? renderStatusOverlay(state) : "";
  }

  if (typeof overlayId === "string" && overlayId.startsWith("setting-help:")) {
    return renderSettingExplanationOverlay(state, overlayId.slice("setting-help:".length));
  }

  return "";
}

export function renderStatusOverlay(state) {
  const run = state.run;
  const derived = getDerivedStatus(run);
  const travelMode = getTravelModeOption(run.policies.drivingStyle ?? run.policies.travelMode);
  const comfortPolicy = getComfortPolicyOption(run.policies.comfortPolicy);
  const overlayView = buildStatusOverlayView(state, derived, travelMode, comfortPolicy);

  return renderOverlayCard({
    ariaLabel: "Trip Notes",
    kicker: overlayView.kicker ?? "Closer Look",
    title: overlayView.title,
    lead: overlayView.lead,
    bodyClassName: "overlay-body--notes",
    bodyHtml: overlayView.sections.join("")
  });
}

function buildStatusOverlayView(state, derived, travelMode, comfortPolicy) {
  const run = state.run;

  if (state.ui.screen === "end" || run.gameOver) {
    return buildEndOverlayView(run, derived);
  }

  switch (run.currentPhase) {
    case DAY_PHASES.ROUTE_STOP:
      return getActiveRouteStop(run)?.stopType === ROUTE_STOP_TYPES.TOWN
        ? buildTownOverlayView(run, derived, travelMode, comfortPolicy)
        : buildRoadOverlayView(run, derived, travelMode, comfortPolicy);
    case DAY_PHASES.TOWN_STOP:
      return buildTownOverlayView(run, derived, travelMode, comfortPolicy);
    case DAY_PHASES.CAMP_DECISION:
    case DAY_PHASES.OVERNIGHT_RESOLUTION:
      return buildCampOverlayView(run, derived, travelMode, comfortPolicy);
    case DAY_PHASES.DAY_END:
      return buildEveningOverlayView(run, derived);
    case DAY_PHASES.PLAYER_DECISION:
    case DAY_PHASES.MORNING_REVIEW:
    case DAY_PHASES.TRAVEL_RESOLUTION:
    default:
      return buildRoadOverlayView(run, derived, travelMode, comfortPolicy);
  }
}

function renderSettingExplanationOverlay(state, settingId) {
  const explanation = getSettingExplanation(settingId);

  if (!explanation) {
    return "";
  }

  const currentOptionId = state.run?.policies?.[settingId] ?? null;

  return renderOverlayCard({
    ariaLabel: `${explanation.displayName} help`,
    cardClassName: "overlay-card--setting-help",
    kicker: "What Does That Mean?",
    title: explanation.displayName,
    lead: explanation.generalExplanation,
    bodyClassName: "overlay-body--setting-help",
    bodyHtml: `
      <div class="setting-help-option-list">
        ${explanation.options
          .map((option) => renderSettingHelpOption(option, option.id === currentOptionId))
          .join("")}
      </div>
      ${
        explanation.closingLine
          ? `<p class="setting-help-tradeoff">${explanation.closingLine}</p>`
          : ""
      }
    `
  });
}

function renderSettingHelpOption(option, isCurrent) {
  return `
    <section class="setting-help-option${isCurrent ? " is-current" : ""}">
      <div class="setting-help-option-head">
        <h3>${option.label}</h3>
        ${isCurrent ? '<span class="setting-help-option-state">Current</span>' : ""}
      </div>
      <p>${option.description}</p>
    </section>
  `;
}

function buildRoadOverlayView(run, derived, travelMode, comfortPolicy) {
  const routeSummary = derived.routeProgressSummary;
  const warningNote = buildRoadWarningNote(derived);
  const sections = [
    renderSection(
      "Ahead",
      `
        <p class="body-copy">${routeSummary.currentPositionSentence} ${routeSummary.nextWaypointName} is ${routeSummary.nextWaypointMilesAway} miles ahead. ${run.journey.currentSegmentSummary}</p>
        <p class="body-copy">Sky: ${getPrimaryForecastLine(run)}. Keeping the trip on track asks for about ${derived.requiredMilesPerDay} miles a day, which feels ${derived.schedulePressure.toLowerCase()} right now.</p>
      `,
      "section-block--note"
    ),
    renderSection(
      "Inside The RV",
      `<p class="body-copy">Today is set to ${travelMode.label.toLowerCase()}. ${travelMode.description} Living policy is ${comfortPolicy.label.toLowerCase()}. ${comfortPolicy.summary} ${derived.moralePressureSummary}</p>`,
      "section-block--note"
    )
  ];

  if (warningNote) {
    sections.push(
      renderSection(
        "Watch For",
        `<p class="body-copy">${warningNote}</p>`,
        "section-block--note"
      )
    );
  }

  return {
    kicker: "Closer Look",
    title: "Road Notes",
    lead: "A quick look before you get back on the road.",
    sections
  };
}

function renderOverlayCard({
  ariaLabel,
  kicker,
  title,
  lead = "",
  bodyHtml,
  bodyClassName = "",
  cardClassName = ""
}) {
  return `
    <div class="frame-overlay" role="dialog" aria-modal="true" aria-label="${escapeHtml(ariaLabel)}">
      <section class="panel overlay-card ${cardClassName}">
        <header class="overlay-header">
          <div class="overlay-header-copy">
            ${kicker ? `<p class="eyebrow">${kicker}</p>` : ""}
            <h2>${title}</h2>
            ${lead ? `<p class="overlay-lead">${lead}</p>` : ""}
          </div>
        </header>
        <div class="overlay-body ${bodyClassName}">
          ${bodyHtml}
        </div>
        <footer class="overlay-footer">
          <button class="action-button action-button--secondary" data-action="close-overlay">
            <span>Back</span>
          </button>
        </footer>
      </section>
    </div>
  `;
}

function buildTownOverlayView(run, derived) {
  const routeSummary = derived.routeProgressSummary;

  return {
    title: "Town Notes",
    lead: "Town is a good place to steady up and choose what comes next.",
    sections: [
      renderSection(
        "What Town Helps With",
        renderBulletList([
          "Town helps you choose the kind of stop the trip needs next.",
          "A practical stop can steady things. A better stop can help the trip feel better too."
        ]),
        "section-block--compact"
      ),
      renderSection(
        "What Needs Attention",
        renderBulletList(buildTownNeedLines(run, derived)),
        "section-block--compact"
      ),
      renderSection(
        "Next Up",
        renderBulletList([
          `Next stop: ${routeSummary.nextWaypointName}.`,
          `${routeSummary.nextWaypointMilesAway} miles ahead when you leave town.`,
          `Sky: ${getPrimaryForecastLine(run)}.`
        ]),
        "section-block--compact"
      ),
      renderSection(
        "What To Keep In Mind",
        renderBulletList(buildWarningLines(derived)),
        "section-block--compact"
      )
    ]
  };
}

function buildCampOverlayView(run, derived, travelMode, comfortPolicy) {
  const campContext = getCampContext(run);
  const overnightContext = campContext?.overnightContext ?? null;
  const selectedCamp = campContext?.selectedCampsite ?? null;
  const overnightPreview = selectedCamp ? calculateOvernightResolution(run) : null;
  const selectedChoice = overnightContext?.actionsTaken?.[0] ?? null;

  return {
    title: "Stay Notes",
    lead: "The place you chose shapes how the night goes.",
    sections: [
      renderSection(
        "Tonight",
        renderBulletList([
          overnightContext
            ? `${overnightContext.stayLabel ?? overnightContext.locationLabel} at ${overnightContext.locationName}.`
            : `At ${run.journey.currentLocationName}.`,
          overnightContext?.locationSetupLine ?? "The stay is settling in for the night.",
          selectedCamp
            ? `Overnight setup: ${selectedCamp.label}.`
            : "This stop will mostly speak for itself tonight.",
          selectedChoice
            ? `Evening choice: ${selectedChoice.label}.`
            : "The evening is still open.",
          `Sky: ${getPrimaryForecastLine(run)}.`,
          `Living policy: ${comfortPolicy.label}.`
        ]),
        "section-block--compact"
      ),
      renderSection(
        "By Morning",
        overnightPreview
          ? renderLedger([
              {
                label: "Electric by dawn",
                value: formatSignedValue(overnightPreview.changes.dailyBatteryDelta)
              },
              {
                label: "Water across stay",
                value: formatSignedValue(overnightPreview.changes.dailyWaterDelta)
              },
              {
                label: "Waste across stay",
                value: formatSignedValue(overnightPreview.v2Changes?.wasteDelta ?? 0)
              },
              {
                label: "Trip feel",
                value:
                  (overnightPreview.v2Changes?.tripScoreDelta ?? 0) > 0
                    ? "That stop gave the trip something worth remembering."
                    : "The score held steady."
              },
              {
                label: "Mood outlook",
                value: formatRestQuality(overnightPreview.restQuality)
              }
            ])
          : `<p class="body-copy">Morning notes will appear once the stay is set.</p>`,
        "section-block--compact"
      ),
      renderSection(
        "Your Evening",
        selectedChoice
          ? renderBulletList(
              [
                selectedChoice.effectSummary
                  ? `${selectedChoice.label}: ${selectedChoice.effectSummary}.`
                  : `${selectedChoice.label}: ${selectedChoice.resultText}`
              ]
            )
          : `<p class="body-copy">No evening direction is set yet.</p>`,
        "section-block--compact"
      ),
      renderSection(
        "Inside The RV",
        `<p class="body-copy">Today followed a ${travelMode.label.toLowerCase()} tone. ${travelMode.description} ${derived.moralePressureSummary}</p>`,
        "section-block--compact"
      ),
      renderSection(
        "What May Carry Over",
        renderBulletList(buildWarningLines(derived)),
        "section-block--compact"
      )
    ]
  };
}

function buildEveningOverlayView(run, derived) {
  const routeSummary = derived.routeProgressSummary;

  return {
    title: "Evening Notes",
    lead: "A quick look at what changed today and what may carry into tomorrow.",
    sections: [
      renderSection(
        "Today",
        renderLedger([
          { label: "Miles driven", value: `${run.day.dailyMilesDriven}` },
          { label: "Electric", value: formatSignedValue(run.day.dailyBatteryDelta) },
          { label: "Water", value: formatSignedValue(run.day.dailyWaterDelta) },
          { label: "Waste", value: formatSignedValue(run.day.dailyWasteDelta ?? 0) },
          { label: "Trip feel", value: getDailyTripFeelLine(run) }
        ]),
        "section-block--compact"
      ),
      renderSection(
        "How It Feels",
        `<p class="body-copy">${derived.moralePressureSummary}</p>`,
        "section-block--compact"
      ),
      renderSection(
        "Road Position",
        renderBulletList([
          routeSummary.currentPositionSentence,
          `${routeSummary.nextWaypointName} is ${routeSummary.nextWaypointMilesAway} miles ahead.`,
          `${run.journey.milesRemaining} miles remain on the road.`
        ]),
        "section-block--compact"
      ),
      renderSection(
        "Still Tight",
        renderBulletList(buildWarningLines(derived)),
        "section-block--compact"
      )
    ]
  };
}

function buildEndOverlayView(run, derived) {
  return {
    title: "Journey Notes",
    lead: run.victory
      ? "The trip is done. Here is what it left behind."
      : "The trip ended here. These are the things that mattered most.",
    sections: [
      renderSection(
        "Trip Record",
        renderLedger([
          { label: "Days", value: `${run.dayNumber}` },
          { label: "Miles traveled", value: `${run.journey.milesTraveled}` },
          { label: "Electric", value: `${run.v2.resources.electric.charge}/${run.v2.resources.electric.capacity}` },
          { label: "Water", value: `${run.v2.resources.water.current}/${run.v2.resources.water.capacity}` },
          { label: "Waste", value: `${run.v2.resources.waste.current}/${run.v2.resources.waste.capacity}` },
          { label: "Trip score", value: `${(run.score?.finalScore ?? derived.finalScore ?? 0).toFixed(1)} / 10` },
          { label: "Outlook", value: `${derived.moraleDescriptor}` }
        ]),
        "section-block--compact"
      ),
      renderSection(
        run.victory ? "What Stayed With You" : "What Brought It To A Stop",
        run.victory
          ? renderBulletList([
              `${run.journey.originName} to ${run.journey.destinationName} took ${run.dayNumber} days.`,
              "You kept enough in reserve to finish well."
            ])
          : renderBulletList(
              derived.lossConditions.length > 0
                ? derived.lossConditions.map(getLossLabel)
                : ["The trip ended before the finish."]
            ),
        "section-block--compact"
      ),
      renderSection(
        "Road Position",
        renderBulletList([
          `Start: ${run.journey.originName}.`,
          `Finish: ${run.journey.destinationName}.`,
          `${run.journey.milesRemaining} miles were left when the run closed.`
        ]),
        "section-block--compact"
      )
    ]
  };
}

function buildCoreSupplyRows(run, derived) {
  return [
    { label: "Electric", value: `${run.v2.resources.electric.charge}/${run.v2.resources.electric.capacity}` },
    { label: "Water", value: `${run.v2.resources.water.current}/${run.v2.resources.water.capacity}` },
    { label: "Waste", value: `${run.v2.resources.waste.current}/${run.v2.resources.waste.capacity}` },
    { label: "Solar Outlook", value: `${derived.solarOutlook}` },
    { label: "Trip Feel", value: getTripFeelLabel(run, derived) },
    { label: "Outlook", value: `${derived.moraleDescriptor}` }
  ];
}

function buildTownNeedLines(run, derived) {
  const lines = [];

  if (derived.waterPercent <= 40) {
    lines.push("Water is starting to feel tight. A refill would help.");
  }
  if (derived.electricPercent <= 40) {
    lines.push("Electric is getting tight. A steadier stop would help.");
  }
  if (derived.solarOutlook === "Weak") {
    lines.push("The sky is not helping much. Charging may stay weak for a bit.");
  }
  if (derived.wastePercent >= STATUS_THRESHOLDS.highWastePercent) {
    lines.push("Waste is building up. A stop with disposal would help soon.");
  }
  if (derived.moraleBand !== "high") {
    lines.push("Everyone could use a kinder stop before the next stretch.");
  }
  if ((run.score?.experience ?? 0) <= Math.max(0, run.dayNumber - 1) * 0.2) {
    lines.push("The trip could use a better stop soon. A stronger stay would help.");
  }

  if (lines.length === 0) {
    lines.push("Nothing feels too tight right now. This is a good chance to choose well.");
  }

  return lines.slice(0, 3);
}

function buildWarningLines(derived) {
  if (derived.warnings.length === 0) {
    return ["Nothing feels too pressing right now."];
  }

  return derived.warnings.slice(0, 3).map((flag) => getWarningLabel(flag));
}

function buildRoadWarningNote(derived) {
  if (derived.warnings.length === 0) {
    return "";
  }

  const labels = derived.warnings.slice(0, 3).map((flag) => getWarningLabel(flag).toLowerCase());

  if (labels.length === 1) {
    return `One thing is starting to feel tight: ${labels[0]}.`;
  }

  return `A few things are starting to feel tight: ${formatNaturalList(labels)}.`;
}

function formatNaturalList(items) {
  if (items.length <= 1) {
    return items[0] ?? "";
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function getPrimaryForecastLine(run) {
  const solarOutlook = run.v2?.currentConditions?.solarOutlook ?? "Fair";
  const firstForecast = Array.isArray(run.environment.forecast)
    ? run.environment.forecast[0]
    : null;

  return firstForecast?.forecast ?? `Solar outlook: ${solarOutlook}. ${firstForecast?.label ?? getForecastSummary(run)}`;
}

function getSolarTone(value) {
  if (value === "Strong") {
    return "good";
  }
  if (value === "Weak") {
    return "danger";
  }
  return "warning";
}

function formatSignedValue(value, prefix = "") {
  const numericValue = Number(value) || 0;
  const sign = numericValue > 0 ? "+" : numericValue < 0 ? "-" : "";
  const magnitude = Math.abs(numericValue);

  return `${sign}${prefix}${magnitude}`;
}

function formatRestQuality(restQuality) {
  return {
    poor: "Poor",
    steady: "Steady",
    good: "Good",
    strong: "Strong"
  }[restQuality] ?? "Steady";
}

export function renderRouteRibbon(stops, stopIndex) {
  return `
    <div class="route-ribbon" aria-label="Road progress">
      ${stops
        .map((stop, index) => {
          const tone =
            index < stopIndex
              ? "route-stop--past"
              : index === stopIndex
                ? "route-stop--current"
                : index === stopIndex + 1
                  ? "route-stop--next"
                  : "";
          const stateLabel =
            index < stopIndex
              ? "Passed"
              : index === stopIndex
                ? "Here"
                : index === stopIndex + 1
                  ? "Next"
                  : "Ahead";

          return `
            <div class="route-stop ${tone}">
              ${renderAssetIcon(getRouteMarkerIcon(index === stops.length - 1), "route-stop-icon")}
              <div class="route-stop-copy">
                <span class="route-state-label">${stateLabel}</span>
                <strong>${stop}</strong>
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

export function renderSection(title, body, extraClass = "") {
  return `
    <section class="section-block ${extraClass}">
      ${title ? `<h2>${title}</h2>` : ""}
      ${body}
    </section>
  `;
}

export function renderDisclosurePanel(title, body, options = {}) {
  const openAttr = options.open ? "open" : "";
  const className = options.className ?? "";
  const summaryLabel = options.summaryLabel ?? title;
  const nameAttr = options.name ? ` name="${options.name}"` : "";

  return `
    <details class="panel disclosure-panel ${className}" ${openAttr}${nameAttr}>
      <summary>${summaryLabel}</summary>
      <div class="disclosure-body">
        ${title !== summaryLabel ? `<p class="eyebrow">${title}</p>` : ""}
        ${body}
      </div>
    </details>
  `;
}

export function renderChoiceGrid(items) {
  return renderMenuList(items);
}

export function renderMenuList(items) {
  return `
    <div class="menu-list">
      ${items
        .map((item) => {
          const attrs = dataAttributes(item.data ?? {});
          const activeClass = item.active ? " is-active" : "";
          const disabledAttr = item.disabled ? "disabled" : "";
          const stateLabel = item.stateLabel ?? (item.active ? "Selected" : "");

          return `
            <button class="menu-option${activeClass}" ${attrs} ${disabledAttr}>
              <div class="menu-option-main">
                ${
                  item.iconHtml
                    ? `<div class="menu-option-media">${item.iconHtml}</div>`
                    : ""
                }
                <div class="menu-option-copy">
                  ${item.kicker ? `<span class="choice-kicker">${item.kicker}</span>` : ""}
                  <strong>${item.label}</strong>
                  ${item.detail ? `<span class="choice-detail">${item.detail}</span>` : ""}
                </div>
              </div>
              ${stateLabel ? `<span class="menu-option-state">${stateLabel}</span>` : ""}
            </button>
          `;
        })
        .join("")}
    </div>
  `;
}

export function renderLedger(rows) {
  return `
    <dl class="ledger">
      ${rows
        .map(
          (row) => `
            <div class="ledger-row">
              <dt>
                ${row.iconHtml ? `<span class="ledger-icon">${row.iconHtml}</span>` : ""}
                <span>${row.label}</span>
              </dt>
              <dd class="${row.className ?? ""}">${row.value}</dd>
            </div>
          `
        )
        .join("")}
    </dl>
  `;
}

export function renderBulletList(items, className = "") {
  return `
    <ul class="bullet-list ${className}">
      ${items.map((item) => `<li>${item}</li>`).join("")}
    </ul>
  `;
}

export function renderPreformatted(text, className = "") {
  return `<pre class="preformatted-block ${className}">${escapeHtml(text)}</pre>`;
}

export function renderMiniActionGrid(actions) {
  return `
    <div class="mini-action-grid">
      ${actions.map((action) => renderButton(action)).join("")}
    </div>
  `;
}

function renderSecondaryBlock(secondaryHtml, secondaryTitle, secondaryMode, secondaryOpen) {
  if (!secondaryHtml) {
    return "";
  }

  if (secondaryMode === "panel") {
    return `
      <section class="panel detail-panel detail-panel--supporting">
        <div class="panel-heading">
          <p class="eyebrow">More</p>
          <h2>${secondaryTitle}</h2>
        </div>
        ${secondaryHtml}
      </section>
    `;
  }

  return renderDisclosurePanel(secondaryTitle, secondaryHtml, {
    open: secondaryOpen,
    summaryLabel: secondaryTitle
  });
}

function renderStatusCell(stat) {
  return `
    <div class="status-cell status-cell--${stat.tone}">
      <span class="status-cell-label">${stat.label}</span>
      <strong class="status-cell-value">${stat.value}</strong>
    </div>
  `;
}

function renderWarningChip(flag) {
  const label = getWarningLabel(flag);

  return `
    <span class="warning-line">
      ${renderAssetIcon(getWarningIcon(flag), "warning-icon")}
      <span>${label}</span>
    </span>
  `;
}

function renderButton({ label, variant = "secondary", data = {}, disabled = false, iconHtml = "" }) {
  const disabledAttr = disabled ? "disabled" : "";
  return `
    <button class="action-button action-button--${variant}" ${dataAttributes(data)} ${disabledAttr}>
      ${iconHtml ? `<span class="action-button-icon">${iconHtml}</span>` : ""}
      <span>${label}</span>
    </button>
  `;
}

export function renderTitleReturnButton() {
  return `
    <button
      class="title-return-button"
      data-action="navigate"
      data-screen="title"
      aria-label="Go To Title"
      title="Go To Title"
    >
      <span aria-hidden="true">QUIT</span>
    </button>
  `;
}

function dataAttributes(data) {
  return Object.entries(data)
    .map(([key, value]) => `data-${key}="${String(value)}"`)
    .join(" ");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function getMeterTone(value) {
  if (value >= 65) {
    return "steady";
  }
  if (value >= 35) {
    return "warning";
  }
  return "danger";
}

function getWasteTone(value) {
  if (value >= STATUS_THRESHOLDS.criticalWastePercent) {
    return "danger";
  }
  if (value >= STATUS_THRESHOLDS.highWastePercent) {
    return "warning";
  }
  return "good";
}

function getScoreTone(score) {
  if (score >= 7) {
    return "good";
  }
  if (score >= 4) {
    return "warning";
  }
  return "danger";
}

function getTripFeelLabel(run, derived) {
  if (run.gameOver || run.victory) {
    return `${(run.score?.finalScore ?? derived.finalScore ?? 0).toFixed(1)} / 10`;
  }

  if (run.resourcePressure?.lowPower || run.resourcePressure?.lowWater || run.resourcePressure?.highWaste) {
    return "Cutting it close";
  }

  if ((run.score?.experience ?? 0) >= 2) {
    return "Memorable";
  }

  return "Taking shape";
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

function describeReserve(percent) {
  if (percent >= 65) {
    return "Ready";
  }
  if (percent >= 35) {
    return "Holding";
  }
  return "Thin";
}

function describeCondition(band) {
  if (band === "good") {
    return "Ready";
  }
  if (band === "worn") {
    return "Worn";
  }
  if (band === "poor") {
    return "Rough";
  }
  return "Failing";
}

function describeMorale(band, descriptor) {
  if (band === "high") {
    return descriptor ?? "Upbeat";
  }
  if (band === "steady") {
    return descriptor ?? "Steady";
  }
  if (band === "low") {
    return descriptor ?? "Tense";
  }
  return descriptor ?? "Shaken";
}

function getBandTone(band) {
  if (band === "good" || band === "high") {
    return "steady";
  }
  if (band === "worn" || band === "steady") {
    return "warning";
  }
  return "danger";
}

function clampGaugeScale(value) {
  const percent = Math.max(0, Math.min(100, Number(value) || 0));
  return (percent / 100).toFixed(3);
}
