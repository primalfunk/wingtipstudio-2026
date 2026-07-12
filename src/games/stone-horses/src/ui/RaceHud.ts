import { BettingSystem, BetType, getRequiredSelectionCount, resetBankroll } from "../betting/BettingSystem";
import { RacerIdentity } from "../world/RacerIdentity";
import { MarbleRaceStatus, RaceController } from "../world/RaceController";
import { RaceTelemetry } from "../world/RaceTelemetry";
import { DirectorState } from "../visual/RaceDirectorSystem";
import { VisualSettings, VisualSettingsState } from "../visual/VisualSettings";

export class RaceHud {
  private readonly root = document.createElement("aside");
  private readonly overlayRoot = document.createElement("div");
  private readonly returnMenuButton = document.createElement("button");
  private lastRenderKey = "";
  private message = "";
  private countdownLabel = "";
  private recap: RaceRecap | null = null;
  private pendingBankrollBeforeSettlement: number | null = null;
  private selectedBetCategory: BetCategory = "Basic";
  private selectedType: BetType = "win";
  private selectedMarbleId = "M01";
  private selectedSecondMarbleId = "M02";
  private selectedThirdMarbleId = "M03";
  private selectedFourthMarbleId = "M04";
  private isBetConfirmOpen = false;
  private bettingStep: 1 | 2 | 3 = 1;
  private activeSelectionSlot = 0;
  private oddsView: "win" | "place" | "show" = "win";
  private stake = 25;
  private isCollapsed = false;
  private uiAnimationEnabled = true;
  private raceHeat = 0;
  private directorState: DirectorState | null = null;
  private readonly betSizes = [10, 25, 50, 100, 250];

  constructor(
    private readonly race: RaceController,
    private readonly betting: BettingSystem,
    racerIdentities: RacerIdentity[],
    private readonly telemetry: RaceTelemetry,
    private readonly visualSettings?: VisualSettings,
  ) {
    this.racersById = new Map(racerIdentities.map((racer) => [racer.id, racer]));
    this.root.className = "race-hud";
    this.overlayRoot.className = "race-alert-layer";
    this.returnMenuButton.className = "race-hud__return-menu";
    this.returnMenuButton.type = "button";
    this.returnMenuButton.textContent = "Return to Menu";
    this.returnMenuButton.addEventListener("click", this.handleReturnToMenu);
    document.body.append(this.root);
    document.body.append(this.overlayRoot);
    document.body.append(this.returnMenuButton);
    this.root.addEventListener("input", this.handleInput);
    this.root.addEventListener("change", this.handleChange);
    this.root.addEventListener("click", this.handleClick);
    this.overlayRoot.addEventListener("click", this.handleClick);
    this.update(true);
  }

  private readonly racersById: Map<string, RacerIdentity>;

  update(force = false): void {
    const renderKey = this.getRenderKey();

    if (!force && renderKey === this.lastRenderKey) {
      return;
    }

    this.lastRenderKey = renderKey;
    const leader = this.race.rankings[0];
    const rows =
      this.race.state === "FINISHED"
        ? this.race.results
            .map((result) => {
              const suffix = result.forced ? "Did Not Finish" : "";

              return `<li class="${result.place === 1 ? "is-leader" : ""} ${result.forced ? "is-dnf" : "is-finished"}"><span>${result.place}</span>${this.renderRacer(result.marbleId, suffix)}<em>${result.forced ? "Did Not Finish" : `${result.finishTime.toFixed(2)}s`}</em></li>`;
            })
            .join("")
        : this.race.rankings
            .map(
              (status) => {
                const statusClass = status.finished ? (status.forced ? "is-dnf" : "is-finished") : "";
                const suffix = status.finished ? (status.forced ? "Did Not Finish" : "Finished") : "";
                const metric = status.finished
                  ? status.forced
                    ? "DNF"
                    : `${status.finishTime?.toFixed(2) ?? "-"}s`
                  : `${Math.round(status.progress)}m`;

                return `<li class="${status.rank === 1 ? "is-leader" : ""} ${statusClass}"><span>${status.rank}</span>${this.renderRacer(status.marble.id, suffix)}<em>${metric}</em></li>`;
              },
            )
            .join("");

    this.root.className = `race-hud ${this.isCollapsed ? "is-collapsed" : ""} ${this.uiAnimationEnabled ? "" : "no-ui-animation"}`.trim();
    this.root.innerHTML = `
      ${this.renderPanelHeader(leader)}
      <div class="race-hud__body">
        <div class="race-hud__bankroll">
          <span>Bankroll</span>
          <strong>$${this.betting.bankroll.toFixed(2)}</strong>
        </div>
        <div class="race-hud__leader">
          <span>${this.race.state === "FINISHED" ? "Winner" : "Leader"}</span>
          ${this.renderLeader(this.race.state === "FINISHED" ? this.race.results[0]?.marbleId : leader?.marble.id)}
          <em>${this.race.state === "RUNNING" ? `${Math.round(leader?.progress ?? 0)}m` : this.race.state === "PRE_RACE" ? "At gate" : "Official"}</em>
        </div>
        <div class="race-hud__section">
          <h2>Order</h2>
          <ol>${rows}</ol>
        </div>
        ${this.renderRaceHeatPanel()}
        ${this.renderVisualControls()}
        ${this.renderSimPanel()}
      </div>
    `;
    this.overlayRoot.innerHTML = `${this.renderBettingModal()}${this.renderBetConfirmModal()}${this.renderCountdownOverlay()}${this.renderFinalStretchOverlay()}${this.renderRaceRecap()}`;
    this.bindRenderedControls();
  }

  private renderPanelHeader(leader: MarbleRaceStatus | undefined): string {
    const leaderId = this.race.state === "FINISHED" ? this.race.results[0]?.marbleId : leader?.marble.id;
    const leaderLabel = leaderId ? this.getRacerLabel(leaderId) : "-";

    return `
      <div class="race-hud__meta">
        <div>
          <strong>${this.race.state}</strong>
          <span title="${this.race.seed}">${this.race.seed}</span>
        </div>
        <button class="race-hud__collapse" data-action="toggle-panel" type="button" aria-expanded="${!this.isCollapsed}">
          ${this.isCollapsed ? "Show" : "Hide"}
        </button>
      </div>
      <div class="race-hud__collapsed-summary" aria-hidden="${!this.isCollapsed}">
        <strong>$${this.betting.bankroll.toFixed(0)}</strong>
        <span>${leaderLabel}</span>
      </div>
    `;
  }

  private renderBettingModal(): string {
    if (this.race.state !== "PRE_RACE") {
      return "";
    }

    const selectedOddsValue = this.getSelectedOddsValue();
    const possiblePayout = this.stake * selectedOddsValue;

    return `
      <section class="race-alert race-alert--betting">
        <div class="race-alert__head">
          <div>
            <h2>Race Book</h2>
            <span>${this.message || this.renderBetHelpText()}</span>
          </div>
          <strong>$${this.betting.bankroll.toFixed(2)}</strong>
        </div>
        <div class="race-book__layout">
          <div class="race-book__main">
            ${this.renderCompactBetBuilder()}
          </div>
          <div class="race-book__side">
            ${this.renderTicketBuilderSummary(selectedOddsValue, possiblePayout)}
            ${this.renderTicketsPanel()}
            <button class="race-book__run" data-action="start-race" type="button">Run Race</button>
          </div>
        </div>
      </section>
    `;
  }

  private renderCompactBetBuilder(): string {
    const categoryDefinitions = betDefinitions.filter((definition) => definition.category === this.selectedBetCategory);

    return `
      <div class="race-book__stage race-book__stage--compact">
        <div class="race-book__categories" aria-label="Bet categories">
          ${(["Basic", "Intermediate", "Advanced"] as const)
            .map(
              (category) =>
                `<button class="${this.selectedBetCategory === category ? "is-selected" : ""}" data-action="select-bet-category" data-bet-category="${category}" type="button">${category}</button>`,
            )
            .join("")}
        </div>
        <div class="race-book__type-strip">
          ${categoryDefinitions.map((definition) => this.renderBetTypeCard(definition)).join("")}
        </div>
        <div class="race-book__picker-head">
          <h2>Racer Selection</h2>
          <div>
            ${(["win", "place", "show"] as const)
              .map((view) => `<button class="${this.oddsView === view ? "is-selected" : ""}" data-action="set-odds-view" data-odds-view="${view}" type="button">${view}</button>`)
              .join("")}
          </div>
        </div>
        <div class="race-book__selects">
          ${this.getSelectionSlots()
            .map(
              (slot, index) => `
                <div class="race-book__racer-menu">
                  <span>${slot.label}</span>
                  <details>
                    <summary>${this.renderRacer(slot.marbleId)}</summary>
                    <div>
                      ${this.renderRacerMenuOptions(index)}
                    </div>
                  </details>
                </div>
              `,
            )
            .join("")}
        </div>
        <div class="race-book__odds-summary">
          <div><span>Selected odds</span><strong>${this.oddsView.toUpperCase()} ${this.getDisplayedOdds().toFixed(1)}</strong></div>
          <div><span>Ticket odds</span><strong>${this.getSelectedOddsValue().toFixed(1)}</strong></div>
        </div>
        <div class="race-book__stage-actions race-book__stage-actions--compact">
          <button class="race-book__place" data-action="place-bet" type="button" ${this.isSelectionValid() ? "" : "disabled"}>Place Bet</button>
        </div>
      </div>
    `;
  }

  private renderBetConfirmModal(): string {
    if (!this.isBetConfirmOpen || this.race.state !== "PRE_RACE") {
      return "";
    }

    const selectedOddsValue = this.getSelectedOddsValue();
    const possiblePayout = this.stake * selectedOddsValue;

    return `
      <section class="race-alert race-alert--bet-confirm" role="dialog" aria-modal="true">
        <div class="race-alert__head">
          <h2>Confirm Bet</h2>
          <button data-action="cancel-bet-confirm" type="button">Close</button>
        </div>
        <div class="race-book__confirm">
          <div><span>Bet</span><strong>${getBetDefinition(this.selectedType).name}</strong></div>
          <div><span>Racer${this.getSelectedMarbleIds().length > 1 ? "s" : ""}</span><strong>${this.getBetSelectionLabel()}</strong></div>
          <div><span>Odds</span><strong>${selectedOddsValue.toFixed(1)}</strong></div>
          <div><span>Return</span><strong>$${possiblePayout.toFixed(2)}</strong></div>
        </div>
        <div class="race-book__stakes">
          <span>Bet Size</span>
          ${this.betSizes
            .map(
              (size) =>
                `<button class="${this.stake === size ? "is-selected" : ""}" data-action="select-stake" data-stake="${size}" type="button">$${size}</button>`,
            )
            .join("")}
        </div>
        <div class="race-book__stage-actions">
          <button data-action="cancel-bet-confirm" type="button">Cancel</button>
          <button class="race-book__place" data-action="confirm-place-bet" type="button">Confirm $${this.stake}</button>
        </div>
      </section>
    `;
  }

  private renderStepPill(step: 1 | 2 | 3, label: string): string {
    return `<button class="${this.bettingStep === step ? "is-active" : ""}" data-action="set-betting-step" data-step="${step}" type="button">${step}. ${label}</button>`;
  }

  private renderBettingStep(): string {
    if (this.bettingStep === 1) {
      return this.renderBetTypeSelection();
    }

    if (this.bettingStep === 2) {
      return this.renderSelectionBuilder();
    }

    return this.renderWagerConfirmation();
  }

  private renderBetTypeSelection(): string {
    return `
      <div class="race-book__stage">
        <div class="race-book__stage-head">
          <h2>Choose Bet Type</h2>
          <p>Start simple, or browse the advanced menu to learn what is coming next.</p>
        </div>
        <div class="race-book__type-grid">
          ${betDefinitions.map((definition) => this.renderBetTypeCard(definition)).join("")}
        </div>
      </div>
    `;
  }

  private renderBetTypeCard(definition: BetDefinition): string {
    const selected = definition.type === this.selectedType;

    return `
      <button class="race-book__type-card ${selected ? "is-selected" : ""}" data-action="select-bet-type" data-bet-type="${definition.id}" type="button">
        <span>${definition.category}</span>
        <strong>${definition.name}</strong>
        <em>${definition.shortDescription}</em>
        <small>${definition.difficulty} / ${definition.payout}</small>
      </button>
    `;
  }

  private renderSelectionBuilder(): string {
    return `
      <div class="race-book__stage">
        <div class="race-book__stage-head">
          <h2>Build Your Bet</h2>
          <p>${this.getSelectionHint()}</p>
        </div>
        <div class="race-book__slots">
          ${this.getSelectionSlots()
            .map(
              (slot, index) => `
                <button class="${this.activeSelectionSlot === index ? "is-active" : ""}" data-action="select-slot" data-slot="${index}" type="button">
                  <span>${slot.label}</span>
                  ${this.renderRacer(slot.marbleId)}
                </button>
              `,
            )
            .join("")}
        </div>
        <div class="race-book__picker-head">
          <h2>Racer Picker</h2>
          <div>
            ${(["win", "place", "show"] as const)
              .map((view) => `<button class="${this.oddsView === view ? "is-selected" : ""}" data-action="set-odds-view" data-odds-view="${view}" type="button">${view}</button>`)
              .join("")}
          </div>
        </div>
        <div class="race-book__odds race-book__odds--simple">
          ${this.renderBettingOddsCards()}
        </div>
        <div class="race-book__stage-actions">
          <button data-action="set-betting-step" data-step="1" type="button">Back</button>
          <button data-action="set-betting-step" data-step="3" type="button" ${this.isSelectionValid() ? "" : "disabled"}>Set Wager</button>
        </div>
      </div>
    `;
  }

  private renderWagerConfirmation(): string {
    const selectedOddsValue = this.getSelectedOddsValue();
    const possiblePayout = this.stake * selectedOddsValue;

    return `
      <div class="race-book__stage">
        <div class="race-book__stage-head">
          <h2>Confirm Ticket</h2>
          <p>Review the ticket before placing it. Bets lock when the race starts.</p>
        </div>
        <div class="race-book__confirm">
          <div><span>Bet</span><strong>${getBetDefinition(this.selectedType).name}</strong></div>
          <div><span>Selection</span><strong>${this.getBetSelectionLabel()}</strong></div>
          <div><span>Odds</span><strong>${selectedOddsValue.toFixed(1)}</strong></div>
          <div><span>Potential return</span><strong>$${possiblePayout.toFixed(2)}</strong></div>
        </div>
        <div class="race-book__stakes">
          <span>Wager</span>
          ${this.betSizes
            .map(
              (size) =>
                `<button class="${this.stake === size ? "is-selected" : ""}" data-action="select-stake" data-stake="${size}" type="button">$${size}</button>`,
            )
            .join("")}
        </div>
        <div class="race-book__stage-actions">
          <button data-action="set-betting-step" data-step="2" type="button">Back</button>
          <button class="race-book__place" data-action="place-bet" type="button">Place Bet</button>
        </div>
        <p class="race-hud__message">${this.message || this.renderBetHelpText()}</p>
      </div>
    `;
  }

  private renderBettingOddsCards(): string {
    return this.betting.odds
      .map(
        (odds) => {
          const selectedIds = this.getSelectionSlots().map((slot) => slot.marbleId);
          const isSelected = selectedIds.includes(odds.marbleId);
          const isInvalidDuplicate = this.isDuplicateSelection(odds.marbleId);

          return `
          <button class="race-book__odds-card ${isSelected ? "is-selected" : ""}" data-action="select-marble" data-marble-id="${odds.marbleId}" type="button" title="Win ${odds.win.toFixed(1)} / Place ${odds.place.toFixed(1)} / Show ${odds.show.toFixed(1)}" ${isInvalidDuplicate ? "disabled" : ""}>
            ${this.renderRacer(odds.marbleId)}
            <span>${this.oddsView.toUpperCase()} ${odds[this.oddsView].toFixed(1)}</span>
          </button>
        `;
        },
      )
      .join("");
  }

  private renderRacerMenuOptions(slotIndex: number): string {
    return this.betting.odds
      .map((odds) => {
        const disabled = this.getSelectionSlots().some((slot, index) => index !== slotIndex && slot.marbleId === odds.marbleId);

        return `
          <button data-action="select-slot-racer" data-slot="${slotIndex}" data-marble-id="${odds.marbleId}" type="button" ${disabled ? "disabled" : ""}>
            ${this.renderRacer(odds.marbleId)}
            <em>${this.oddsView.toUpperCase()} ${odds[this.oddsView].toFixed(1)}</em>
          </button>
        `;
      })
      .join("");
  }

  private renderCountdownOverlay(): string {
    return "";
  }

  private renderFinalStretchOverlay(): string {
    if (this.race.state !== "RUNNING" || this.race.results.length === 0) {
      return "";
    }

    return `
      <div class="race-alert race-alert--final-stretch" aria-live="polite">
        <span>Final Stretch</span>
      </div>
    `;
  }

  private renderRaceRecap(): string {
    if (!this.recap || this.race.state !== "FINISHED") {
      return "";
    }

    const bankrollDelta = this.recap.bankrollAfter - this.recap.bankrollBefore;
    const resultClass = bankrollDelta >= 0 ? "is-win" : "is-loss";
    const rows = this.recap.results
      .map(
        (result) =>
          `<li><span>${result.place}</span>${this.renderRacer(result.marbleId, result.forced ? "Did Not Finish" : "")}<em>${result.forced ? "Did Not Finish" : `${result.finishTime.toFixed(2)}s`}</em></li>`,
      )
      .join("");
    const ticketRows = this.recap.settledBets
      .map((bet) => {
        const detail = bet.marbleIds.length > 1 ? bet.marbleIds.map((marbleId) => this.getRacerLabel(marbleId)).join(" / ") : this.getRacerLabel(bet.marbleId);

        return `<li class="${bet.won ? "is-win" : ""}"><span>${bet.type.toUpperCase()}</span><strong>${detail}</strong><em>$${bet.stake} @ ${bet.odds.toFixed(1)} / ${bet.won ? `+$${bet.payout.toFixed(2)}` : "$0.00"}</em></li>`;
      })
      .join("");

    return `
      <section class="race-alert race-alert--recap">
        <div class="race-alert__head">
          <h2>Race Recap</h2>
          <button data-action="dismiss-recap" type="button">Close</button>
        </div>
        <div class="race-alert__bank ${resultClass}">
          <span>Bankroll</span>
          <strong>${bankrollDelta >= 0 ? "+" : "-"}$${Math.abs(bankrollDelta).toFixed(2)}</strong>
          <em>$${this.recap.bankrollBefore.toFixed(2)} -> $${this.recap.bankrollAfter.toFixed(2)}</em>
        </div>
        <h2>Results</h2>
        <ol>${rows}</ol>
        <h2>Tickets</h2>
        <ol>${ticketRows || "<li><strong>No bets placed</strong></li>"}</ol>
        <div class="race-alert__actions">
          <button class="race-alert__next" data-action="next-race" type="button">Next Race</button>
        </div>
      </section>
    `;
  }

  private getSelectedOdds(): { win: number; place: number; show: number } {
    return this.betting.odds.find((odds) => odds.marbleId === this.selectedMarbleId) ?? { win: 1, place: 1, show: 1 };
  }

  private getSelectedOddsValue(): number {
    return this.betting.getBetOdds(this.selectedType, this.getSelectedMarbleIds());
  }

  private getDisplayedOdds(): number {
    return this.betting.getOdds(this.getSelectionSlots()[this.activeSelectionSlot]?.marbleId ?? this.selectedMarbleId, this.oddsView);
  }

  private getBetSelectionLabel(): string {
    return this.getSelectedMarbleIds().map((marbleId) => this.getRacerLabel(marbleId)).join(" / ");
  }

  private renderBetHelpText(): string {
    if (this.selectedType === "win") {
      return "Win pays if your racer finishes first.";
    }

    if (this.selectedType === "place") {
      return "Place pays for a top-two finish.";
    }

    if (this.selectedType === "show") {
      return "Show pays for a top-three finish.";
    }

    return getBetDefinition(this.selectedType).longDescription;
  }

  private renderTicketBuilderSummary(selectedOddsValue: number, possiblePayout: number): string {
    return `
      <div class="race-book__ticket-summary">
        <h2>Current Ticket</h2>
        <dl>
          <dt>Type</dt><dd>${getBetDefinition(this.selectedType).name}</dd>
          <dt>Pick</dt><dd>${this.getBetSelectionLabel()}</dd>
          <dt>Wager</dt><dd>$${this.stake}</dd>
          <dt>Odds</dt><dd>${selectedOddsValue.toFixed(1)}</dd>
          <dt>Return</dt><dd>$${possiblePayout.toFixed(2)}</dd>
        </dl>
      </div>
    `;
  }

  private renderTicketsPanel(): string {
    const activeTickets = this.betting.bets
      .map((bet) => {
        const detail =
          bet.marbleIds.length > 1
            ? bet.marbleIds.map((marbleId) => this.getRacerLabel(marbleId)).join(" -> ")
            : this.getRacerLabel(bet.marbleId);

        return `<li><span>$${bet.stake}</span><strong>${bet.type.toUpperCase()}: ${detail}</strong><em>@ ${bet.odds.toFixed(1)}</em></li>`;
      })
      .join("");

    return `
      <div class="race-book__tickets">
        <h2>Tickets</h2>
        <ol>${activeTickets || "<li><strong>No bets placed</strong></li>"}</ol>
        <p>Total stake: $${this.betting.totalStaked.toFixed(2)}</p>
      </div>
    `;
  }

  private getStepLabel(): string {
    if (this.bettingStep === 1) return "Step 1: choose a bet type.";
    if (this.bettingStep === 2) return "Step 2: select only what this bet needs.";
    return "Step 3: set wager and confirm.";
  }

  private getSelectionHint(): string {
    const slots = this.getSelectionSlots();
    const active = slots[this.activeSelectionSlot];

    return active ? `Choose ${active.label.toLowerCase()}.` : getBetDefinition(this.selectedType).shortDescription;
  }

  private getSelectionSlots(): { label: string; marbleId: string }[] {
    const labels = getSlotLabels(this.selectedType);
    const selections = this.getSelectedMarbleIds();

    return labels.map((label, index) => ({ label, marbleId: selections[index] }));
  }

  private setSlotSelection(marbleId: string): void {
    const selections = this.getSelectedMarbleIds();
    selections[this.activeSelectionSlot] = marbleId;
    this.setSelectedMarbleIds(selections);
  }

  private isDuplicateSelection(marbleId: string): boolean {
    return this.getSelectionSlots().some((slot, index) => index !== this.activeSelectionSlot && slot.marbleId === marbleId);
  }

  private isSelectionValid(): boolean {
    const selections = this.getSelectedMarbleIds();

    return selections.length === getRequiredSelectionCount(this.selectedType) && new Set(selections).size === selections.length;
  }

  private getSelectedMarbleIds(): string[] {
    return [this.selectedMarbleId, this.selectedSecondMarbleId, this.selectedThirdMarbleId, this.selectedFourthMarbleId].slice(
      0,
      getRequiredSelectionCount(this.selectedType),
    );
  }

  private setSelectedMarbleIds(selections: string[]): void {
    const fallbackIds = this.betting.odds.map((odds) => odds.marbleId);
    const unique = selections.map((id, index) => {
      if (!selections.slice(0, index).includes(id)) {
        return id;
      }

      return fallbackIds.find((fallbackId) => !selections.slice(0, index).includes(fallbackId) && !selections.slice(index + 1).includes(fallbackId)) ?? id;
    });

    [this.selectedMarbleId, this.selectedSecondMarbleId, this.selectedThirdMarbleId, this.selectedFourthMarbleId] = [
      unique[0] ?? fallbackIds[0] ?? "M01",
      unique[1] ?? fallbackIds[1] ?? "M02",
      unique[2] ?? fallbackIds[2] ?? "M03",
      unique[3] ?? fallbackIds[3] ?? "M04",
    ];
  }

  private renderVisualControls(): string {
    if (!this.visualSettings) {
      return "";
    }

    const settings = this.visualSettings.value;

    return `
      <div class="race-hud__section race-hud__visuals">
        <h2>Visuals</h2>
        ${this.renderVisualToggle("trackTheme", "Theme", settings)}
        ${this.renderVisualToggle("trackPulse", "Pulse", settings)}
        ${this.renderVisualToggle("reactiveLighting", "Lighting", settings)}
        ${this.renderVisualToggle("cameraShake", "Shake", settings)}
        ${this.renderVisualToggle("uiAnimation", "UI motion", settings)}
      </div>
    `;
  }

  private renderRaceHeatPanel(): string {
    const heatPercent = Math.round(this.raceHeat * 100);
    const activeSection = this.getMostActiveSectionLabel();

    return `
      <div class="race-hud__section race-hud__heat">
        <h2>Race Heat</h2>
        <div class="race-hud__heat-meter"><span style="width: ${heatPercent}%"></span></div>
        <dl>
          <dt>Intensity</dt><dd>${heatPercent}%</dd>
          <dt>Camera</dt><dd>${this.directorState?.cameraMode ?? "pack"}</dd>
          <dt>Event</dt><dd>${this.directorState?.activeEvent ?? "None"}</dd>
          <dt>Section</dt><dd>${this.directorState?.sectionRole ?? activeSection}</dd>
          <dt>Overtakes</dt><dd>${this.telemetry.overtakes}</dd>
        </dl>
        <ol>${(this.directorState?.eventFeed ?? []).map((event) => `<li><strong>${event}</strong></li>`).join("") || "<li><strong>No major events yet</strong></li>"}</ol>
      </div>
    `;
  }

  private renderVisualToggle(key: keyof VisualSettingsState, label: string, settings: VisualSettingsState): string {
    return `
      <label>
        <input data-field="visual-toggle" data-visual-key="${key}" type="checkbox" ${settings[key] ? "checked" : ""} />
        <span>${label}</span>
      </label>
    `;
  }

  private renderSimPanel(): string {
    const validation = this.telemetry.validation;

    return `
      <div class="race-hud__section race-hud__sim">
        <h2>Sim Layer</h2>
        <dl>
          <dt>Safety</dt><dd class="is-${this.telemetry.safetyStatus.toLowerCase()}">${this.telemetry.safetyStatus}</dd>
          <dt>Machines</dt><dd>${validation.machineCount}</dd>
          <dt>Obstacles</dt><dd>${validation.obstacleCount}</dd>
          <dt>Repairs</dt><dd>${validation.repairedObstacleCount}</dd>
          <dt>Removed</dt><dd>${validation.removedObstacleCount}</dd>
          <dt>Overtakes</dt><dd>${this.telemetry.overtakes}</dd>
          <dt>Leader changes</dt><dd>${this.telemetry.leaderChanges}</dd>
          <dt>Order changes</dt><dd>${this.telemetry.orderChanges}</dd>
          <dt>Feature hits</dt><dd>${this.telemetry.slowZoneHits + this.telemetry.forceZoneHits}</dd>
          <dt>Variable slow</dt><dd>${this.telemetry.variableSlowdownHits}</dd>
          <dt>Speed boosts</dt><dd>${this.telemetry.speedBoostHits}</dd>
          <dt>Paddle contacts</dt><dd>${this.telemetry.paddleContacts}</dd>
          <dt>Speed variance</dt><dd>${this.telemetry.speedVarianceDelta.toFixed(3)}</dd>
          <dt>Anti-stall</dt><dd>${this.telemetry.antiStallNudges}</dd>
          <dt>Max stall</dt><dd>${this.telemetry.maxLowProgressSeconds.toFixed(1)}s</dd>
        </dl>
      </div>
    `;
  }

  private readonly handleChange = (event: Event): void => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const field = target.dataset.field;

    if (field === "type") {
      this.selectedType = target.value as BetType;
    } else if (field === "second") {
      this.selectedSecondMarbleId = target.value;
    } else if (field === "stake") {
      this.stake = Number(target.value);
    } else if (field === "slot-racer") {
      this.activeSelectionSlot = Number(target.dataset.slot ?? 0);
      this.setSlotSelection(target.value);
      this.message = "";
    } else if (field === "visual-toggle" && this.visualSettings) {
      const key = target.dataset.visualKey as keyof VisualSettingsState | undefined;

      if (key) {
        this.visualSettings.set(key, (target as HTMLInputElement).checked);
      }
    }

    this.update(true);
  };

  private readonly handleInput = (event: Event): void => {
    const target = event.target as HTMLInputElement;

    if (target.dataset.field === "stake") {
      this.stake = Number(target.value);
    }
  };

  private readonly handleClick = (event: MouseEvent): void => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");

    if (!target) {
      return;
    }

    const action = target.dataset.action;

    if (action === "toggle-panel") {
      this.isCollapsed = !this.isCollapsed;
    } else if (action === "select-bet-category") {
      const category = target.dataset.betCategory as BetCategory | undefined;

      if (category === "Basic" || category === "Intermediate" || category === "Advanced") {
        this.selectedBetCategory = category;
        const categoryDefault = betDefinitions.find((definition) => definition.category === category && definition.type)?.type;
        if (categoryDefault) {
          this.selectedType = categoryDefault;
          this.activeSelectionSlot = 0;
          this.setSelectedMarbleIds(this.getSelectedMarbleIds());
        }
        this.message = "";
      }
    } else if (action === "set-betting-step") {
      const step = Number(target.dataset.step);
      if (step === 1 || step === 2 || (step === 3 && this.isSelectionValid())) {
        this.bettingStep = step;
        this.message = "";
      }
    } else if (action === "select-bet-type") {
      const definition = betDefinitions.find((entry) => entry.id === target.dataset.betType);

      if (definition?.type) {
        this.selectedBetCategory = definition.category;
        this.selectedType = definition.type;
        this.activeSelectionSlot = 0;
        this.bettingStep = 2;
        this.message = "";
        this.setSelectedMarbleIds(this.getSelectedMarbleIds());
      }
    } else if (action === "select-slot") {
      this.activeSelectionSlot = Number(target.dataset.slot ?? 0);
      this.message = "";
    } else if (action === "set-odds-view") {
      const view = target.dataset.oddsView as "win" | "place" | "show" | undefined;
      if (view === "win" || view === "place" || view === "show") {
        this.oddsView = view;
      }
    } else if (action === "select-slot-racer") {
      this.activeSelectionSlot = Number(target.dataset.slot ?? 0);
      this.setSlotSelection(target.dataset.marbleId ?? this.selectedMarbleId);
      this.message = "";
    } else if (action === "select-marble") {
      this.setSlotSelection(target.dataset.marbleId ?? this.selectedMarbleId);
      this.message = "";
    } else if (action === "select-stake") {
      this.stake = Number(target.dataset.stake ?? this.stake);
      this.message = "";
    } else if (action === "place-bet") {
      if (this.isSelectionValid()) {
        this.isBetConfirmOpen = true;
        this.message = "";
      }
    } else if (action === "cancel-bet-confirm") {
      this.isBetConfirmOpen = false;
    } else if (action === "confirm-place-bet") {
      const error = this.betting.placeBet(
        this.selectedType,
        this.selectedMarbleId,
        this.selectedSecondMarbleId,
        this.stake,
        this.getSelectedMarbleIds(),
      );
      this.message = error ?? "Bet placed.";
      if (!error) {
        this.isBetConfirmOpen = false;
        this.bettingStep = 2;
      }
    } else if (action === "start-race") {
      this.pendingBankrollBeforeSettlement = this.betting.bankroll;
      this.recap = null;
      this.betting.lockBets();
      this.race.startRace();
      this.message = "Bets locked. Race starts now.";
    } else if (action === "dismiss-recap") {
      this.recap = null;
    } else if (action === "next-race") {
      const trackSeed = createLiveSeed("track");
      const raceSeed = createLiveSeed("race");
      window.location.search = `?trackSeed=${encodeURIComponent(trackSeed)}&raceSeed=${encodeURIComponent(raceSeed)}&autostart=1`;
      return;
    }

    this.update(true);
  };

  private bindRenderedControls(): void {
    const collapseButton = this.root.querySelector<HTMLButtonElement>(".race-hud__collapse");

    collapseButton?.addEventListener("click", this.handleTogglePanel);
  }

  private readonly handleTogglePanel = (event: MouseEvent): void => {
    event.stopPropagation();
    this.isCollapsed = !this.isCollapsed;
    this.update(true);
  };

  private readonly handleReturnToMenu = (): void => {
    resetBankroll();
    window.location.href = window.location.pathname;
  };

  private renderRacer(marbleId: string, suffix = ""): string {
    const racer = this.racersById.get(marbleId);
    const label = this.getRacerLabel(marbleId, suffix);

    return `
      <strong class="race-hud__racer">
        <img src="${racer?.previewUrl ?? ""}" alt="" />
        <span>${label}</span>
      </strong>
    `;
  }

  private renderLeader(marbleId: string | undefined): string {
    if (!marbleId) {
      return "<strong>-</strong>";
    }

    const racer = this.racersById.get(marbleId);

    return `
      <strong class="race-hud__leader-racer">
        <img src="${racer?.previewUrl ?? ""}" alt="" />
        <span>${this.getRacerLabel(marbleId)}</span>
      </strong>
    `;
  }

  private getRacerLabel(marbleId: string, suffix = ""): string {
    const racer = this.racersById.get(marbleId);

    return `${racer?.name ?? marbleId} ${suffix}`.trim();
  }

  private getMostActiveSectionLabel(): string {
    const active = Object.entries(this.telemetry.sectionContactCounts).sort((a, b) => b[1] - a[1])[0];

    if (!active) {
      return "Gate";
    }

    return active[0].replace(/-\d+.*$/, "").replace(/-/g, " ");
  }

  private getRenderKey(): string {
    this.countdownLabel = this.race.getCountdownLabel();
    const orderKey =
      this.race.state === "FINISHED"
        ? this.race.results.map((result) => `${result.place}:${result.marbleId}:${result.finishTime.toFixed(2)}:${result.forced}`).join("|")
        : this.race.rankings
            .map((status) => `${status.rank}:${status.marble.id}:${Math.round(status.progress)}`)
            .join("|");
    const betsKey = this.betting.bets
      .map((bet) => `${bet.id}:${bet.type}:${bet.marbleIds.join(",")}:${bet.stake}:${bet.odds}`)
      .join("|");
    const settledKey = this.betting.settledBets
      .map((bet) => `${bet.id}:${bet.won}:${bet.payout}`)
      .join("|");

    return [
      this.race.state,
      this.race.seed,
      this.countdownLabel,
      this.recap ? `${this.recap.bankrollBefore}:${this.recap.bankrollAfter}:${this.recap.results.length}` : "",
      this.betting.bankroll.toFixed(2),
      this.betting.isLocked,
      this.betting.hasSettled,
      this.selectedBetCategory,
      this.selectedType,
      this.selectedMarbleId,
      this.selectedSecondMarbleId,
      this.selectedThirdMarbleId,
      this.selectedFourthMarbleId,
      this.bettingStep,
      this.activeSelectionSlot,
      this.oddsView,
      this.stake,
      this.isBetConfirmOpen,
      this.message,
      orderKey,
      betsKey,
      settledKey,
      this.telemetry.safetyStatus,
      this.telemetry.overtakes,
      this.telemetry.leaderChanges,
      this.telemetry.orderChanges,
      this.telemetry.slowZoneHits,
      this.telemetry.forceZoneHits,
      this.telemetry.variableSlowdownHits,
      this.telemetry.speedBoostHits,
      this.telemetry.paddleContacts,
      this.telemetry.speedVarianceDelta.toFixed(3),
      this.telemetry.antiStallNudges,
      this.telemetry.maxLowProgressSeconds.toFixed(1),
      this.raceHeat.toFixed(2),
      this.directorState ? `${this.directorState.cameraMode}:${this.directorState.activeEvent}:${this.directorState.sectionRole}:${this.directorState.eventFeed.join("|")}` : "",
      this.isCollapsed,
      this.uiAnimationEnabled,
      this.visualSettings ? JSON.stringify(this.visualSettings.value) : "",
    ].join(";");
  }

  setUiAnimationEnabled(enabled: boolean): void {
    this.uiAnimationEnabled = enabled;
    this.update(true);
  }

  setRaceHeat(heat: number): void {
    if (Math.abs(this.raceHeat - heat) < 0.02) {
      return;
    }

    this.raceHeat = heat;
    this.update();
  }

  setDirectorState(state: DirectorState): void {
    const key = `${state.cameraMode}:${state.activeEvent}:${state.sectionRole}:${state.eventFeed.join("|")}`;
    const previousKey = this.directorState
      ? `${this.directorState.cameraMode}:${this.directorState.activeEvent}:${this.directorState.sectionRole}:${this.directorState.eventFeed.join("|")}`
      : "";
    this.directorState = state;

    if (key !== previousKey) {
      this.update();
    }
  }

  captureRecap(bankrollBefore: number): void {
    this.recap = {
      bankrollBefore,
      bankrollAfter: this.betting.bankroll,
      results: this.race.results,
      settledBets: this.betting.settledBets,
    };
    this.pendingBankrollBeforeSettlement = null;
    this.update(true);
  }

  consumePendingBankrollBeforeSettlement(): number {
    const value = this.pendingBankrollBeforeSettlement ?? this.betting.bankroll;
    this.pendingBankrollBeforeSettlement = null;

    return value;
  }
}

function createLiveSeed(label: string): string {
  const random =
    typeof crypto !== "undefined" && "getRandomValues" in crypto
      ? crypto.getRandomValues(new Uint32Array(1))[0].toString(36)
      : Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(36);

  return `stone-horses-${label}-${Date.now().toString(36)}-${random}`;
}

interface RaceRecap {
  bankrollBefore: number;
  bankrollAfter: number;
  results: RaceController["results"];
  settledBets: BettingSystem["settledBets"];
}

interface BetDefinition {
  id: string;
  type?: BetType;
  supported: boolean;
  category: BetCategory;
  name: string;
  shortDescription: string;
  longDescription: string;
  difficulty: string;
  payout: string;
  example: string;
  slotLabel: string;
}

type BetCategory = "Basic" | "Intermediate" | "Advanced";

const betDefinitions: BetDefinition[] = [
  {
    id: "win",
    type: "win",
    supported: true,
    category: "Basic",
    name: "Win",
    shortDescription: "Pick the winner.",
    longDescription: "Win is the cleanest bet: choose one marble and get paid only if it finishes first.",
    difficulty: "Easy",
    payout: "Low-Medium",
    example: "Pepper Flick finishes 1st.",
    slotLabel: "1st Place",
  },
  {
    id: "place",
    type: "place",
    supported: true,
    category: "Basic",
    name: "Place",
    shortDescription: "Pick a top-two finisher.",
    longDescription: "Place is more forgiving than Win. Your selected marble pays if it finishes first or second.",
    difficulty: "Easy",
    payout: "Low",
    example: "Pepper Flick finishes 1st or 2nd.",
    slotLabel: "Top 2",
  },
  {
    id: "show",
    type: "show",
    supported: true,
    category: "Basic",
    name: "Show",
    shortDescription: "Pick a top-three finisher.",
    longDescription: "Show is the safest basic bet. Your selected marble pays if it finishes anywhere in the top three.",
    difficulty: "Easy",
    payout: "Low",
    example: "Pepper Flick finishes 1st, 2nd, or 3rd.",
    slotLabel: "Top 3",
  },
  {
    id: "across",
    type: "across",
    supported: true,
    category: "Basic",
    name: "Across the Board",
    shortDescription: "Covers Win, Place, and Show.",
    longDescription: "Across the Board splits a wager across Win, Place, and Show on the same marble.",
    difficulty: "Easy",
    payout: "Layered",
    example: "$30 becomes $10 Win, $10 Place, $10 Show.",
    slotLabel: "Runner",
  },
  {
    id: "exacta",
    type: "exacta",
    supported: true,
    category: "Intermediate",
    name: "Exacta",
    shortDescription: "Pick 1st and 2nd in order.",
    longDescription: "Exacta pays when both selected marbles finish first and second in the exact order you choose.",
    difficulty: "Medium",
    payout: "High",
    example: "Pepper Flick 1st, Lemon Drift 2nd.",
    slotLabel: "Ordered Pair",
  },
  {
    id: "exacta-box",
    type: "exacta-box",
    supported: true,
    category: "Intermediate",
    name: "Exacta Box",
    shortDescription: "Pick two marbles in any order.",
    longDescription: "Exacta Box covers both possible first-second orders for two selected marbles.",
    difficulty: "Medium",
    payout: "Medium-High",
    example: "Pepper/Lemon or Lemon/Pepper.",
    slotLabel: "Two Runners",
  },
  {
    id: "quinella",
    type: "quinella",
    supported: true,
    category: "Intermediate",
    name: "Quinella",
    shortDescription: "Two marbles finish 1st/2nd, any order.",
    longDescription: "Quinella pays when your two marbles occupy the top two positions in either order.",
    difficulty: "Medium",
    payout: "Medium",
    example: "Pepper and Lemon are the top two.",
    slotLabel: "Two Runners",
  },
  {
    id: "trifecta",
    type: "trifecta",
    supported: true,
    category: "Intermediate",
    name: "Trifecta",
    shortDescription: "Pick 1st, 2nd, and 3rd exactly.",
    longDescription: "Trifecta is a precise three-slot bet with a much higher payout profile.",
    difficulty: "Hard",
    payout: "Very High",
    example: "Pepper 1st, Lemon 2nd, Cinder 3rd.",
    slotLabel: "Three Slots",
  },
  {
    id: "trifecta-box",
    type: "trifecta-box",
    supported: true,
    category: "Intermediate",
    name: "Trifecta Box",
    shortDescription: "Pick three marbles in any order.",
    longDescription: "Trifecta Box covers all finish orders for three selected marbles.",
    difficulty: "Hard",
    payout: "High",
    example: "Any order among Pepper, Lemon, Cinder.",
    slotLabel: "Three Runners",
  },
  {
    id: "superfecta",
    type: "superfecta",
    supported: true,
    category: "Advanced",
    name: "Superfecta",
    shortDescription: "Pick 1st through 4th exactly.",
    longDescription: "Superfecta requires the first four finishers in exact order and pays like a long shot.",
    difficulty: "Hard",
    payout: "Extreme",
    example: "Four exact finish positions.",
    slotLabel: "Four Slots",
  },
  {
    id: "superfecta-box",
    type: "superfecta-box",
    supported: true,
    category: "Advanced",
    name: "Superfecta Box",
    shortDescription: "Pick four marbles in any order.",
    longDescription: "Superfecta Box covers all orders for four selected marbles at a larger ticket cost.",
    difficulty: "Hard",
    payout: "Very High",
    example: "Any order among four selected marbles.",
    slotLabel: "Four Runners",
  },
  {
    id: "daily-double",
    type: "daily-double",
    supported: true,
    category: "Advanced",
    name: "Daily Double",
    shortDescription: "Pick winners of two races.",
    longDescription: "Daily Double links the winner of this race with the winner of the next race.",
    difficulty: "Hard",
    payout: "High",
    example: "Race 1 winner plus Race 2 winner.",
    slotLabel: "Two Races",
  },
  {
    id: "pick-3",
    type: "pick-3",
    supported: true,
    category: "Advanced",
    name: "Pick 3",
    shortDescription: "Pick winners of three races.",
    longDescription: "Pick 3 is a multi-race wager for selecting three winners in sequence.",
    difficulty: "Hard",
    payout: "Extreme",
    example: "Winners across three consecutive races.",
    slotLabel: "Three Races",
  },
];

function getBetDefinition(type: BetType): BetDefinition {
  return betDefinitions.find((definition) => definition.type === type) ?? betDefinitions[0];
}

function getSlotLabels(type: BetType): string[] {
  if (type === "exacta" || type === "trifecta" || type === "superfecta" || type === "daily-double" || type === "pick-3") {
    return ["1st", "2nd", "3rd", "4th"].slice(0, getRequiredSelectionCount(type));
  }

  if (type === "exacta-box" || type === "quinella") {
    return ["Runner A", "Runner B"];
  }

  if (type === "trifecta-box") {
    return ["Runner A", "Runner B", "Runner C"];
  }

  if (type === "superfecta-box") {
    return ["Runner A", "Runner B", "Runner C", "Runner D"];
  }

  return [getBetDefinition(type).slotLabel];
}
