import { renderCardMarkup } from "../core/cards";
import { applyAction, cloneState, createState, legalActions, potTotal, startHand, switchButton, toCall } from "../core/engine";
import type {
  AppMode,
  BotStyle,
  ConceptProgressSummary,
  CoachRecommendation,
  DeckKey,
  DrillRecommendation,
  DrillPack,
  DrillSession,
  EngineAction,
  GameState,
  HandHistoryEvent,
  HistoryListFilter,
  SavedDecisionRecord,
  SavedDrillAttempt,
  SavedHandHistory,
  SavedSessionSummary,
  SessionStats,
  UiAction
} from "../core/types";
import { DEFAULT_DECK, DECKS } from "../content/decks";
import { annotateGlossary, glossaryTerms, initGlossaryTooltips } from "../content/glossary";
import {
  archetypeDebugLabel,
  buildArchetypeCoachNote,
  getBotArchetype,
  getBotArchetypes,
  normalizeBotStyle
} from "../bot/archetypes";
import {
  advanceDrillSession,
  createDrillSession,
  getDrillPacks,
  recordDrillResult,
  scenarioToState
} from "../drills/runner";
import {
  clearSavedHands,
  createLiveHandRecorder,
  deleteSavedHand,
  finalizeLiveHand,
  listSavedHands,
  loadSavedHand,
  recordAppliedAction,
  recordShowdown,
  recordStreetTransition,
  rememberHeroRecommendation,
  saveCompletedHand,
  updateSavedHandBookmark,
  type LiveHandRecorder
} from "../history/history";
import { createDecisionRecord, createDrillAttemptRecord, createSessionSummary, bumpSessionSummary } from "../history/studyMemory";
import {
  getDecisionById,
  getDecisionsForHand,
  getDrillAttemptById,
  getRecentDecisions,
  getRecentDrillAttempts,
  getSessionSummaries,
  saveDecisionRecord,
  saveDrillAttemptRecord,
  upsertSessionSummary
} from "../history/studyStore";
import {
  buildDecisionReview,
  buildDrillReview,
  buildHandReviewDetails,
  collectNeedsReview,
  findReplayCursorForDecision
} from "../history/review";
import {
  createReplaySession,
  getReplayFrame,
  jumpReplayStreetBackward,
  jumpReplayStreetForward,
  jumpReplayToEnd,
  jumpReplayToStart,
  moveReplayCursor,
  stepReplay,
  type ReplaySession
} from "../history/replay";
import {
  getAllStoredConceptSummaries,
  getDrillRecommendations,
  progressDebugEnabled
} from "../progress/progressTracker";
import { decide } from "../strategy/bot";
import { evaluateAction, recommend } from "../strategy/coach";
import { inferRangeDebugEnabled } from "../strategy/rangeInference";
import { classifySpot, spotDebugLabel } from "../strategy/spot";

interface AppState {
  mode: AppMode;
  state: GameState;
  botStyle: BotStyle;
  lastRecommendation: CoachRecommendation | null;
  revealOpponentCards: boolean;
  coachLog: string[];
  session: SessionStats;
  pendingBotTimer: number | null;
  selectedDeck: DeckKey;
  drillPacks: DrillPack[];
  drillSession: DrillSession | null;
  currentHandRecorder: LiveHandRecorder | null;
  currentHandSaved: boolean;
  savedHands: SavedHandHistory[];
  recentDecisions: SavedDecisionRecord[];
  recentDrillAttempts: SavedDrillAttempt[];
  recentSessions: SavedSessionSummary[];
  conceptSummaries: ConceptProgressSummary[];
  drillRecommendations: DrillRecommendation[];
  historyFilter: HistoryListFilter;
  selectedHistoryId: string | null;
  replaySession: ReplaySession | null;
  selectedReview:
    | { kind: "hand"; id: string }
    | { kind: "decision"; id: string }
    | { kind: "drill"; id: string }
    | null;
  liveStudySession: SavedSessionSummary | null;
  drillStudySession: SavedSessionSummary | null;
  raiseControlsOpen: boolean;
  payoutAnimatedHand: number | null;
}

const defaultSession = (): SessionStats => ({
  hands: 0,
  heroWins: 0,
  botWins: 0,
  ties: 0,
  netChips: 0,
  startingStack: 0,
  goodChoices: 0,
  mixedChoices: 0,
  badChoices: 0
});

const CHIP_DENOMINATIONS = [100, 25, 10, 5, 1] as const;
type ChipDenomination = typeof CHIP_DENOMINATIONS[number];

export function initApp(documentRef: Document): void {
  const app = createAppController(documentRef);
  app.init();
}

function createAppController(documentRef: Document) {
  let eventsWired = false;
  let glossaryInitialized = false;
  let audioUnlocked = false;
  let opponentAlertTimer: number | null = null;
  const assetUrl = (path: string): string => `${import.meta.env.BASE_URL}${path}`;

  const audio = {
    music: new Audio(assetUrl("audio/cards_track.mp3")),
    tick: new Audio(assetUrl("audio/clean_tick.mp3")),
    go: new Audio(assetUrl("audio/clean_go.mp3"))
  };

  audio.music.loop = true;
  audio.music.volume = 0.15;
  audio.tick.volume = 1;
  audio.go.volume = 1;

  const getById = <T extends HTMLElement>(id: string): T => {
    const element = documentRef.getElementById(id);
    if (!element) {
      throw new Error(`Missing required element #${id}`);
    }
    return element as T;
  };

  const stateful: AppState = {
    mode: "live",
    state: createState(),
    botStyle: "straightforward_reg",
    lastRecommendation: null,
    revealOpponentCards: false,
    coachLog: [],
    session: defaultSession(),
    pendingBotTimer: null,
    selectedDeck: DEFAULT_DECK,
    drillPacks: getDrillPacks(),
    drillSession: null,
    currentHandRecorder: null,
    currentHandSaved: false,
    savedHands: listSavedHands(),
    recentDecisions: getRecentDecisions(),
    recentDrillAttempts: getRecentDrillAttempts(),
    recentSessions: getSessionSummaries(),
    conceptSummaries: [],
    drillRecommendations: [],
    historyFilter: "all",
    selectedHistoryId: null,
    replaySession: null,
    selectedReview: null,
    liveStudySession: null,
    drillStudySession: null,
    raiseControlsOpen: false,
    payoutAnimatedHand: null
  };

  function init(): void {
    if (stateful.pendingBotTimer !== null) {
      window.clearTimeout(stateful.pendingBotTimer);
      stateful.pendingBotTimer = null;
    }

    const bigBlind = Number.parseInt(getById<HTMLInputElement>("bb-size").value, 10) || 20;
    const startingBigBlinds = Number.parseInt(getById<HTMLInputElement>("starting-bb").value, 10) || 50;
    stateful.mode = "live";
    stateful.drillSession = null;
    stateful.drillStudySession = null;
    stateful.state = createState({
      sb: Math.floor(bigBlind / 2),
      bb: bigBlind,
      startingStack: bigBlind * startingBigBlinds,
      heroIsButton: true
    });
    stateful.session.startingStack = bigBlind * startingBigBlinds;
    stateful.botStyle = loadSelectedBotStyle();
    stateful.selectedDeck = loadSelectedDeck();

    if (!eventsWired) {
      wireEvents();
      eventsWired = true;
    }
    renderDeckOptions();
    renderBotOptions();
    renderDrillOptions();
    refreshSavedHands();
    refreshStudyMemory();
    stateful.liveStudySession = createSessionSummary("live");
    upsertSessionSummary(stateful.liveStudySession);
    renderHistoryPanel();
    renderRecentStudy();
    renderProgressPanel();
    if (!glossaryInitialized) {
      initGlossaryTooltips();
      glossaryInitialized = true;
    }
    renderGlossaryList();
    startNewHand();
  }

  function wireEvents(): void {
    documentRef.addEventListener("pointerdown", unlockAudio, { once: true });
    documentRef.addEventListener("keydown", unlockAudio, { once: true });

    getById<HTMLButtonElement>("start-game-button").addEventListener("click", () => {
      playTickSound();
      documentRef.body.classList.remove("is-menu");
      documentRef.body.classList.add("is-game");
    });
    getById<HTMLButtonElement>("hand-summary-toast-dismiss").addEventListener("click", () => {
      playTickSound();
      hideHandSummaryToast();
    });
    const coachPanel = getById<HTMLDetailsElement>("coach-panel");
    const reviewPanel = documentRef.querySelector<HTMLDetailsElement>(".secondary-panel");
    coachPanel.addEventListener("toggle", syncSidePanelWidths);
    reviewPanel?.addEventListener("toggle", syncSidePanelWidths);
    syncSidePanelWidths();

    documentRef.querySelectorAll<HTMLButtonElement>(".action-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.action as UiAction | undefined;
        if (action) {
          handleHeroAction(action);
        }
      });
    });

    documentRef.querySelectorAll<HTMLButtonElement>(".sizing-preset").forEach((button) => {
      button.addEventListener("click", () => {
        const preset = button.dataset.size;
        if (preset) {
          playTickSound();
          applySizingPreset(preset);
        }
      });
    });

    getById<HTMLInputElement>("bet-slider").addEventListener("input", updateBetDisplay);

    getById<HTMLButtonElement>("next-hand-btn").addEventListener("click", () => {
      playTickSound();
      if (stateful.mode === "drill") {
        advanceDrill();
        return;
      }
      switchButton(stateful.state);
      startNewHand();
    });

    getById<HTMLSelectElement>("bot-style").addEventListener("change", (event) => {
      playTickSound();
      const target = event.target as HTMLSelectElement;
      stateful.botStyle = normalizeBotStyle(target.value);
      persistSelectedBotStyle(stateful.botStyle);
      renderBotOptions();
      const archetype = getBotArchetype(stateful.botStyle);
      logCoach(`<p class="tip">Opponent archetype set to <strong>${escapeHtml(archetype.label)}</strong>.</p>`);
    });

    getById<HTMLSelectElement>("card-deck").addEventListener("change", (event) => {
      playTickSound();
      const target = event.target as HTMLSelectElement;
      stateful.selectedDeck = target.value as DeckKey;
      persistSelectedDeck(stateful.selectedDeck);
      render();
      logCoach(`<p class="tip">Card deck set to <strong>${escapeHtml(deckLabel(stateful.selectedDeck))}</strong>.</p>`);
    });

    getById<HTMLButtonElement>("new-session").addEventListener("click", () => {
      playTickSound();
      resetSession();
    });
    getById<HTMLButtonElement>("start-drill").addEventListener("click", () => {
      playTickSound();
      startDrill();
    });
    getById<HTMLButtonElement>("drill-show-answer").addEventListener("click", () => {
      playTickSound();
      showDrillAnswer();
    });
    getById<HTMLButtonElement>("exit-drill").addEventListener("click", () => {
      playTickSound();
      exitDrill();
    });
    getById<HTMLSelectElement>("history-filter").addEventListener("change", (event) => {
      playTickSound();
      stateful.historyFilter = (event.target as HTMLSelectElement).value as HistoryListFilter;
      renderHistoryPanel();
    });
    getById<HTMLButtonElement>("history-clear").addEventListener("click", () => {
      playTickSound();
      clearSavedHands();
      refreshSavedHands();
      refreshStudyMemory();
      stateful.selectedHistoryId = null;
      stateful.replaySession = null;
      stateful.selectedReview = null;
      renderHistoryPanel();
      renderRecentStudy();
      renderProgressPanel();
    });
  }

  function syncSidePanelWidths(): void {
    const coachPanel = getById<HTMLDetailsElement>("coach-panel");
    const reviewPanel = documentRef.querySelector<HTMLDetailsElement>(".secondary-panel");
    documentRef.body.style.setProperty("--coach-panel-w", coachPanel.open ? "clamp(520px, 32vw, 680px)" : "74px");
    documentRef.body.style.setProperty("--review-panel-w", reviewPanel?.open ? "clamp(300px, 18vw, 430px)" : "74px");
  }

  function unlockAudio(): void {
    if (audioUnlocked) {
      return;
    }
    audioUnlocked = true;
    void audio.music.play().catch(() => {
      audioUnlocked = false;
    });
  }

  function playOneShot(sound: HTMLAudioElement): void {
    unlockAudio();
    const clone = sound.cloneNode() as HTMLAudioElement;
    clone.volume = sound.volume;
    void clone.play().catch(() => undefined);
  }

  function playTickSound(): void {
    playOneShot(audio.tick);
  }

  function playCommitSound(): void {
    playOneShot(audio.go);
  }

  function resetSession(): void {
    stateful.session = defaultSession();
    init();
  }

  function refreshStudyMemory(): void {
    stateful.recentDecisions = getRecentDecisions(8);
    stateful.recentDrillAttempts = getRecentDrillAttempts(8);
    stateful.recentSessions = getSessionSummaries(6);
    stateful.conceptSummaries = getAllStoredConceptSummaries();
    stateful.drillRecommendations = getDrillRecommendations(getRecentDecisions(300), 3);
  }

  function findScenarioById(id: string) {
    for (const pack of stateful.drillPacks) {
      const scenario = pack.scenarios.find((entry) => entry.id === id);
      if (scenario) return scenario;
    }
    return null;
  }

  function drillPackTitle(packId: string): string {
    return stateful.drillPacks.find((pack) => pack.id === packId)?.title || packId;
  }

  function openHandReview(handId: string, cursor?: number): void {
    const hand = loadSavedHand(handId);
    stateful.selectedHistoryId = hand?.id ?? null;
    stateful.selectedReview = hand ? { kind: "hand", id: hand.id } : null;
    stateful.replaySession = hand ? createReplaySession(hand) : null;
    if (stateful.replaySession && cursor !== undefined) {
      stateful.replaySession = moveReplayCursor(stateful.replaySession, cursor);
    }
  }

  function openDecisionReview(decisionId: string): void {
    const decision = getDecisionById(decisionId);
    if (!decision) {
      stateful.selectedReview = null;
      return;
    }
    if (decision.handId) {
      const hand = loadSavedHand(decision.handId);
      if (hand) {
        const cursor = findReplayCursorForDecision(hand, decision.id, getDecisionsForHand(hand.id));
        openHandReview(hand.id, cursor >= 0 ? cursor : undefined);
        return;
      }
    }
    stateful.selectedHistoryId = null;
    stateful.replaySession = null;
    stateful.selectedReview = { kind: "decision", id: decision.id };
  }

  function openDrillReview(drillId: string): void {
    const attempt = getDrillAttemptById(drillId);
    stateful.selectedHistoryId = null;
    stateful.replaySession = null;
    stateful.selectedReview = attempt ? { kind: "drill", id: attempt.id } : null;
  }

  function renderGlossaryList(): void {
    const glossaryList = getById<HTMLDListElement>("glossary-list");
    const glossaryKeys = Object.keys(glossaryTerms).sort((left, right) =>
      glossaryTerms[left].label.localeCompare(glossaryTerms[right].label)
    );
    glossaryList.innerHTML = glossaryKeys
      .map((key) => `<dt>${escapeHtml(glossaryTerms[key].label)}</dt><dd>${escapeHtml(glossaryTerms[key].short)}</dd>`)
      .join("");
  }

  function renderDeckOptions(): void {
    const deckSelect = getById<HTMLSelectElement>("card-deck");
    deckSelect.innerHTML = DECKS.map((deck) => `<option value="${deck.key}">${escapeHtml(deck.label)}</option>`).join("");
    deckSelect.value = stateful.selectedDeck;
  }

  function renderBotOptions(): void {
    const styleSelect = getById<HTMLSelectElement>("bot-style");
    const description = getById("bot-style-description");
    const archetypes = getBotArchetypes();
    styleSelect.innerHTML = archetypes
      .map((profile) => `<option value="${profile.id}">${escapeHtml(profile.label)}</option>`)
      .join("");
    styleSelect.value = normalizeBotStyle(stateful.botStyle);

    const active = getBotArchetype(stateful.botStyle);
    description.innerHTML =
      `<p><strong>${escapeHtml(active.label)}.</strong> ${escapeHtml(active.description)}</p>` +
      (window.localStorage.getItem("coach.debugArchetypes") === "1"
        ? `<p><code>${escapeHtml(archetypeDebugLabel(active.id))}</code></p>`
        : "");
  }

  function renderDrillOptions(): void {
    const drillSelect = getById<HTMLSelectElement>("drill-pack");
    drillSelect.innerHTML = stateful.drillPacks
      .map((pack) => `<option value="${pack.id}">${escapeHtml(pack.title)}</option>`)
      .join("");
    renderDrillProgress();
  }

  function renderDrillProgress(): void {
    const progress = getById("drill-progress");
    const exitButton = getById<HTMLButtonElement>("exit-drill");
    const answerButton = getById<HTMLButtonElement>("drill-show-answer");
    if (!stateful.drillSession) {
      progress.textContent = "Drill mode inactive.";
      exitButton.hidden = true;
      answerButton.hidden = true;
      return;
    }

    const { pack, index, results } = stateful.drillSession;
    const lastResult = results.at(-1);
    progress.textContent =
      `${pack.title}: scenario ${index + 1}/${pack.scenarios.length} · ${results.length} completed` +
      (lastResult ? ` · last: ${lastResult.tone}` : "");
    exitButton.hidden = false;
    answerButton.hidden = stateful.drillSession.awaitingAdvance;
  }

  function startNewHand(): void {
    stateful.mode = "live";
    stateful.revealOpponentCards = false;
    stateful.coachLog = [];
    stateful.lastRecommendation = null;
    stateful.raiseControlsOpen = false;
    stateful.payoutAnimatedHand = null;
    stateful.currentHandSaved = false;
    updateCoachMetrics(null);
    hideHandSummaryToast();
    startHand(stateful.state);
    stateful.currentHandRecorder = createLiveHandRecorder(stateful.state, stateful.botStyle);
    getById("hand-summary-body").innerHTML = "<p>Hand in progress...</p>";
    getById("coach-hint").textContent = "Read the table, then act when it is your turn.";
    const nextButton = getById<HTMLButtonElement>("next-hand-btn");
    nextButton.hidden = true;
    nextButton.textContent = "Next hand →";
    logCoach(handIntroMessage());
    render();
    tick();
  }

  function startDrill(): void {
    const selectedPackId = getById<HTMLSelectElement>("drill-pack").value;
    const pack = stateful.drillPacks.find((entry) => entry.id === selectedPackId) || stateful.drillPacks[0];
    stateful.mode = "drill";
    stateful.drillSession = createDrillSession(pack);
    stateful.drillStudySession = createSessionSummary("drill");
    upsertSessionSummary(stateful.drillStudySession);
    loadCurrentDrillScenario();
  }

  function exitDrill(): void {
    if (stateful.drillStudySession) {
      upsertSessionSummary(stateful.drillStudySession);
    }
    stateful.drillSession = null;
    stateful.drillStudySession = null;
    stateful.mode = "live";
    renderDrillProgress();
    refreshStudyMemory();
    renderRecentStudy();
    renderProgressPanel();
    init();
  }

  function showDrillAnswer(): void {
    if (stateful.mode !== "drill" || !stateful.lastRecommendation || !stateful.drillSession) {
      return;
    }
    logCoach(
      `<div class="tip"><strong>Recommended mix:</strong> ${escapeHtml(
        stateful.lastRecommendation.reasoning.mixLabel
      )}. ${escapeHtml(stateful.lastRecommendation.reasoning.recommendation)}</div>`
    );
  }

  function loadCurrentDrillScenario(): void {
    if (!stateful.drillSession) {
      return;
    }

    const scenario = stateful.drillSession.current;
    stateful.state = scenarioToState(scenario);
    stateful.revealOpponentCards = false;
    stateful.coachLog = [];
    stateful.lastRecommendation = null;
    stateful.raiseControlsOpen = false;
    updateCoachMetrics(null);

    const nextButton = getById<HTMLButtonElement>("next-hand-btn");
    nextButton.hidden = true;
    nextButton.textContent =
      stateful.drillSession.index === stateful.drillSession.pack.scenarios.length - 1 ? "Finish drill →" : "Next scenario →";
    getById("hand-summary-body").innerHTML = `<p><strong>Scenario:</strong> ${escapeHtml(scenario.title)}</p>`;
    getById("coach-hint").textContent = `Drill: ${scenario.title}`;
    renderDrillProgress();

    logCoach(buildDrillIntroMessage());
    render();
    tick();
  }

  function buildDrillIntroMessage(): string {
    if (!stateful.drillSession) {
      return "";
    }
    const scenario = stateful.drillSession.current;
    const spot = classifySpot(stateful.state);
    let html =
      `<p><strong>Drill scenario ${stateful.drillSession.index + 1}.</strong> ${escapeHtml(scenario.title)}.</p>` +
      `<p>${escapeHtml(spot.label)} <code>${spot.key}</code>${spot.texture ? ` (${escapeHtml(spot.texture)})` : ""}.</p>` +
      `<p><strong>Scenario spot:</strong> <code>${escapeHtml(scenario.spotKey)}</code>.</p>`;
    if (scenario.teachingNote) {
      html += `<div class="tip">${escapeHtml(scenario.teachingNote)}</div>`;
    }
    return html;
  }

  function advanceDrill(): void {
    if (!stateful.drillSession) {
      return;
    }

    const nextSession = advanceDrillSession(stateful.drillSession);
    if (!nextSession) {
      const results = stateful.drillSession.results;
      const solid = results.filter((result) => result.tone === "good").length;
      const mixed = results.filter((result) => result.tone === "mixed").length;
      const off = results.filter((result) => result.tone === "bad").length;
      logCoach(`<p><strong>Drill complete.</strong> ${solid} solid, ${mixed} mixed, ${off} off-plan.</p>`);
      const nextButton = getById<HTMLButtonElement>("next-hand-btn");
      nextButton.hidden = true;
      renderDrillProgress();
      return;
    }

    stateful.drillSession = nextSession;
    loadCurrentDrillScenario();
  }

  function handIntroMessage(): string {
    return `<p><strong>Hand #${stateful.state.handNumber}.</strong> You are ${
      stateful.state.heroIsButton ? "on the button (SB)." : "in the big blind."
    } Blinds are ${stateful.state.sb}/${stateful.state.bb}. Stacks around ${Math.round(
      stateful.state.heroStack / stateful.state.bb
    )}bb.</p>`;
  }

  function tick(): void {
    render();

    if (stateful.mode === "drill") {
      if (stateful.drillSession?.awaitingAdvance) {
        disableActions();
        return;
      }
      if (stateful.state.toAct === "hero") {
        showHeroRecommendation();
        updateActionBar();
      } else {
        disableActions();
      }
      return;
    }

    if (stateful.state.handOver) {
      finishHand();
      return;
    }
    if (stateful.state.toAct === "bot") {
      disableActions();
      if (stateful.pendingBotTimer !== null) {
        window.clearTimeout(stateful.pendingBotTimer);
      }
      stateful.pendingBotTimer = window.setTimeout(runBotTurn, 700);
    } else if (stateful.state.toAct === "hero") {
      showHeroRecommendation();
      updateActionBar();
    }
  }

  function runBotTurn(): void {
    const decision = decide(stateful.state, stateful.botStyle);
    const beforeState = cloneState(stateful.state);
    let appliedAction = decision.action;
    let appliedAmount = decision.amount;
    try {
      applyAction(stateful.state, "bot", decision.action, decision.amount, {
        onStreetAdvanced: (fromStreet, toStreet, snapshot) => recordStreetTransition(stateful.currentHandRecorder, fromStreet, toStreet, snapshot),
        onShowdown: (snapshot) => recordShowdown(stateful.currentHandRecorder, snapshot)
      });
      animateCommittedChips("bot", beforeState.botStack - stateful.state.botStack);
      recordAppliedAction(stateful.currentHandRecorder, {
        beforeState,
        afterState: stateful.state,
        actor: "bot",
        action: decision.action,
        amount: decision.amount
      });
    } catch {
      const actions = legalActions(stateful.state);
      if (actions.check) {
        const fallbackBefore = cloneState(stateful.state);
        appliedAction = "check";
        appliedAmount = undefined;
        applyAction(stateful.state, "bot", "check", undefined, {
          onStreetAdvanced: (fromStreet, toStreet, snapshot) => recordStreetTransition(stateful.currentHandRecorder, fromStreet, toStreet, snapshot),
          onShowdown: (snapshot) => recordShowdown(stateful.currentHandRecorder, snapshot)
        });
        animateCommittedChips("bot", fallbackBefore.botStack - stateful.state.botStack);
        recordAppliedAction(stateful.currentHandRecorder, {
          beforeState: fallbackBefore,
          afterState: stateful.state,
          actor: "bot",
          action: "check"
        });
      } else if (actions.fold) {
        const fallbackBefore = cloneState(stateful.state);
        appliedAction = "fold";
        appliedAmount = undefined;
        applyAction(stateful.state, "bot", "fold", undefined, {
          onStreetAdvanced: (fromStreet, toStreet, snapshot) => recordStreetTransition(stateful.currentHandRecorder, fromStreet, toStreet, snapshot),
          onShowdown: (snapshot) => recordShowdown(stateful.currentHandRecorder, snapshot)
        });
        animateCommittedChips("bot", fallbackBefore.botStack - stateful.state.botStack);
        recordAppliedAction(stateful.currentHandRecorder, {
          beforeState: fallbackBefore,
          afterState: stateful.state,
          actor: "bot",
          action: "fold"
        });
      }
    }
    showOpponentActionAlert(describeBotActionText(appliedAction, appliedAmount));
    logCoach(describeBotAction(appliedAction, appliedAmount));
    tick();
  }

  function showOpponentActionAlert(message: string): void {
    const alert = getById("opponent-action-alert");
    alert.textContent = message;
    alert.hidden = false;
    alert.classList.remove("is-visible");
    void alert.offsetWidth;
    alert.classList.add("is-visible");
    if (opponentAlertTimer !== null) {
      window.clearTimeout(opponentAlertTimer);
    }
    opponentAlertTimer = window.setTimeout(() => {
      alert.classList.remove("is-visible");
      alert.hidden = true;
      opponentAlertTimer = null;
    }, 3000);
  }

  function describeBotActionText(action: EngineAction, amount?: number): string {
    if (action === "fold") return "Opponent folds";
    if (action === "check") return "Opponent checks";
    if (action === "call") return "Opponent calls";
    if (action === "bet") return `Opponent bets ${amount}`;
    if (action === "raise") return `Opponent raises to ${amount}`;
    return `Opponent ${action}`;
  }

  function describeBotAction(action: EngineAction, amount?: number): string {
    return `<p><em>${escapeHtml(describeBotActionText(action, amount))}.</em></p>`;
  }

  function showHeroRecommendation(): void {
    const recommendation = recommend(stateful.state, "hero");
    stateful.lastRecommendation = recommendation;
    updateCoachMetrics(recommendation);
    if (!recommendation) {
      return;
    }
    rememberHeroRecommendation(stateful.currentHandRecorder, stateful.state, recommendation, classifySpot(stateful.state));

    const reasoning = recommendation.reasoning;
    let detailsHtml = "";
    detailsHtml += `<p>${escapeHtml(reasoning.situation)}</p>`;
    detailsHtml += `<p>${escapeHtml(reasoning.hand)}</p>`;
    if (reasoning.analysis) {
      detailsHtml += `<p>${escapeHtml(reasoning.analysis)}</p>`;
    }
    if (recommendation.inferredRange) {
      detailsHtml += `<p><strong>Range read:</strong> ${escapeHtml(recommendation.inferredRange.summaryLabel)}. ${escapeHtml(
        recommendation.inferredRange.emphasis.join(", ")
      )}.</p>`;
      if (recommendation.inferredRange.blockerNotes.length) {
        detailsHtml += `<p><strong>Blockers:</strong> ${escapeHtml(
          recommendation.inferredRange.blockerNotes.map((note) => note.label).join(" ")
        )}</p>`;
      }
      if (inferRangeDebugEnabled()) {
        detailsHtml += `<div class="tip"><strong>Range debug.</strong> ${escapeHtml(recommendation.inferredRange.debugLabel)}</div>`;
      }
    }
    if (recommendation.strategySelection && window.localStorage.getItem("coach.debugStrategy") === "1") {
      detailsHtml +=
        `<div class="tip"><strong>Strategy debug.</strong> ` +
        `spot ${escapeHtml(recommendation.strategySelection.spotKey)} · ` +
        `hand class ${escapeHtml(recommendation.strategySelection.handClass)} · ` +
        `confidence ${escapeHtml(recommendation.strategySelection.confidence)}${recommendation.strategySelection.sizingFamily ? ` · sizing ${escapeHtml(recommendation.strategySelection.sizingFamily)}` : ""}` +
        `${recommendation.strategySelection.preferenceId ? ` · pref ${escapeHtml(recommendation.strategySelection.preferenceId)}` : ""}` +
        `</div>`;
    }
    if (stateful.mode === "live") {
      detailsHtml += `<div class="tip"><strong>Opponent archetype:</strong> ${escapeHtml(
        buildArchetypeCoachNote(stateful.botStyle, recommendation, stateful.state)
      )}</div>`;
    }
    detailsHtml += `<p>${escapeHtml(reasoning.recommendation)}</p>`;
    if (reasoning.tip) {
      detailsHtml += `<div class="tip">${escapeHtml(reasoning.tip)}</div>`;
    }
    logCoach(renderCoachDecisionCard(recommendation, detailsHtml));
  }

  function handleHeroAction(uiAction: UiAction): void {
    if (stateful.state.toAct !== "hero" || (stateful.mode === "live" && stateful.state.handOver)) {
      return;
    }

    const actions = legalActions(stateful.state);
    let action: EngineAction | null = null;
    let amount: number | undefined;

    if (uiAction === "fold") {
      if (!actions.fold) return;
      action = "fold";
    } else if (uiAction === "check-call") {
      if (actions.check) action = "check";
      else if (actions.call) action = "call";
      else return;
    } else if (uiAction === "bet-raise") {
      if (!stateful.raiseControlsOpen) {
        playTickSound();
        stateful.raiseControlsOpen = true;
        updateActionBar();
        return;
      }
      const displayedAmount = Number.parseInt(
        getById("bet-amount-display").textContent?.replace(/[^0-9]/g, "") || "0",
        10
      );
      if (actions.bet) {
        action = "bet";
        amount = displayedAmount;
      } else if (actions.raise) {
        action = "raise";
        amount = displayedAmount;
      } else {
        return;
      }
      const range = actions[action];
      if (amount && range && "min" in range) {
        amount = Math.max(range.min, Math.min(range.max, amount));
      }
    }

    if (!action) {
      return;
    }

    if (!stateful.lastRecommendation) {
      return;
    }

    playCommitSound();
    const evaluation = evaluateAction(action, stateful.lastRecommendation);
    if (stateful.mode === "live") {
      if (evaluation.tone === "good") stateful.session.goodChoices += 1;
      else if (evaluation.tone === "mixed") stateful.session.mixedChoices += 1;
      else stateful.session.badChoices += 1;
    }
    logCoach(renderVerdict(evaluation, action, amount));
    persistHeroDecisionRecord(action, amount, evaluation);

    if (stateful.mode === "drill") {
      completeDrillAction(action, amount, evaluation);
      return;
    }

    const beforeState = cloneState(stateful.state);
    try {
      applyAction(stateful.state, "hero", action, amount, {
        onStreetAdvanced: (fromStreet, toStreet, snapshot) => recordStreetTransition(stateful.currentHandRecorder, fromStreet, toStreet, snapshot),
        onShowdown: (snapshot) => recordShowdown(stateful.currentHandRecorder, snapshot)
      });
      animateCommittedChips("hero", beforeState.heroStack - stateful.state.heroStack);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      logCoach(`<p class="tip">Couldn't apply action: ${escapeHtml(message)}</p>`);
      return;
    }
    recordAppliedAction(stateful.currentHandRecorder, {
      beforeState,
      afterState: stateful.state,
      actor: "hero",
      action,
      amount,
      agreement: evaluation
    });

    stateful.lastRecommendation = null;
    stateful.raiseControlsOpen = false;
    tick();
  }

  function persistHeroDecisionRecord(
    action: EngineAction,
    amount: number | undefined,
    evaluation: ReturnType<typeof evaluateAction>
  ): void {
    if (!stateful.lastRecommendation) {
      return;
    }

    const decision = createDecisionRecord({
      sourceType: stateful.mode === "drill" ? "drill" : "live",
      state: stateful.state,
      recommendation: stateful.lastRecommendation,
      evaluation,
      action,
      amount,
      handId: stateful.mode === "live" ? stateful.currentHandRecorder?.id : undefined,
      scenarioId: stateful.mode === "drill" ? stateful.drillSession?.current.id : undefined,
      drillSetId: stateful.mode === "drill" ? stateful.drillSession?.pack.id : undefined
    });
    saveDecisionRecord(decision);

    if (stateful.mode === "live" && stateful.liveStudySession) {
      stateful.liveStudySession = bumpSessionSummary(stateful.liveStudySession, {
        spotKey: decision.spotKey,
        decisionsTracked: 1,
        mistakesFlagged: decision.tags.includes("mistake") ? 1 : 0
      });
      upsertSessionSummary(stateful.liveStudySession);
    }
    if (stateful.mode === "drill" && stateful.drillStudySession) {
      stateful.drillStudySession = bumpSessionSummary(stateful.drillStudySession, {
        spotKey: decision.spotKey,
        decisionsTracked: 1,
        mistakesFlagged: decision.tags.includes("mistake") ? 1 : 0
      });
      upsertSessionSummary(stateful.drillStudySession);
    }

    refreshStudyMemory();
    renderRecentStudy();
    renderProgressPanel();
  }

  function completeDrillAction(
    action: EngineAction,
    amount: number | undefined,
    evaluation: ReturnType<typeof evaluateAction>
  ): void {
    if (!stateful.drillSession) {
      return;
    }

    stateful.drillSession = recordDrillResult(stateful.drillSession, {
      scenarioId: stateful.drillSession.current.id,
      spotKey: stateful.drillSession.current.spotKey,
      action,
      amount,
      tone: evaluation.tone,
      verdict: evaluation.verdict,
      explanation: evaluation.explanation,
      recommendedMix: stateful.lastRecommendation?.reasoning.mixLabel
    });
    if (stateful.lastRecommendation) {
      const drillAttempt = createDrillAttemptRecord({
        scenario: stateful.drillSession.current,
        drillSetId: stateful.drillSession.pack.id,
        recommendation: stateful.lastRecommendation,
        evaluation,
        action,
        amount
      });
      saveDrillAttemptRecord(drillAttempt);
      if (stateful.drillStudySession) {
        stateful.drillStudySession = bumpSessionSummary(stateful.drillStudySession, {
          spotKey: drillAttempt.spotKey,
          drillAttempts: 1,
          mistakesFlagged: drillAttempt.tags.includes("mistake") ? 1 : 0
        });
        upsertSessionSummary(stateful.drillStudySession);
      }
      refreshStudyMemory();
      renderRecentStudy();
      renderProgressPanel();
    }

    const scenario = stateful.drillSession.current;
    const nextButton = getById<HTMLButtonElement>("next-hand-btn");
    nextButton.hidden = false;
    nextButton.textContent =
      stateful.drillSession.index === stateful.drillSession.pack.scenarios.length - 1 ? "Finish drill →" : "Next scenario →";

    if (scenario.teachingNote) {
      logCoach(`<div class="tip">${escapeHtml(scenario.teachingNote)}</div>`);
    }
    if (scenario.focusArea) {
      logCoach(`<p><strong>Focus area:</strong> ${escapeHtml(scenario.focusArea)}.</p>`);
    }
    logCoach(
      `<p><strong>Scenario tag:</strong> <code>${escapeHtml(scenario.spotKey)}</code> · <strong>Recommendation:</strong> ${escapeHtml(
        stateful.lastRecommendation?.reasoning.mixLabel || "n/a"
      )}</p>`
    );

    disableActions();
    stateful.lastRecommendation = null;
    renderDrillProgress();
    getById("hand-summary-body").innerHTML = `<p><strong>Scenario complete:</strong> ${escapeHtml(scenario.title)}</p>`;
  }

  function renderVerdict(
    evaluation: ReturnType<typeof evaluateAction>,
    action: EngineAction,
    amount?: number
  ): string {
    const toneClass = evaluation.tone === "good" ? "" : evaluation.tone === "mixed" ? "mixed" : "bad";
    return (
      '<div class="coach-block">' +
        `<p class="coach-verdict ${toneClass}">Your action: ${escapeHtml(describeAction(action, amount))} &middot; ${escapeHtml(
          evaluation.verdict
        )}</p>` +
        `<p>${escapeHtml(evaluation.explanation)} (Recommendation weight: ${Math.round(evaluation.probability * 100)}%.)</p>` +
      "</div>"
    );
  }

  function describeAction(action: EngineAction, amount?: number): string {
    if (action === "fold") return "Fold";
    if (action === "check") return "Check";
    if (action === "call") return "Call";
    if (action === "bet") return `Bet ${amount}`;
    if (action === "raise") return `Raise to ${amount}`;
    return action;
  }

  function updateActionBar(): void {
    if (stateful.mode === "drill" && stateful.drillSession?.awaitingAdvance) {
      disableActions();
      return;
    }

    const actions = legalActions(stateful.state);
    const foldButton = documentRef.querySelector<HTMLButtonElement>("[data-action='fold']");
    const callButton = documentRef.querySelector<HTMLButtonElement>("[data-action='check-call']");
    const betButton = documentRef.querySelector<HTMLButtonElement>("[data-action='bet-raise']");
    if (!foldButton || !callButton || !betButton) return;

    foldButton.disabled = !actions.fold;

    if (actions.check) {
      callButton.textContent = "Check";
      callButton.disabled = false;
    } else if (actions.call) {
      callButton.textContent = `Call ${toCall(stateful.state, "hero")}`;
      callButton.disabled = false;
    } else {
      callButton.textContent = "Check";
      callButton.disabled = true;
    }

    const range = actions.bet || actions.raise;
    betButton.textContent = stateful.raiseControlsOpen && range ? `${actions.bet ? "Bet" : "Raise"} ${getById("bet-amount-display").textContent || ""}` : "Raise";
    betButton.disabled = !range;

    if (range) {
      const slider = getById<HTMLInputElement>("bet-slider");
      slider.min = String(range.min);
      slider.max = String(range.max);
      const sliderValue = Number.parseInt(slider.value, 10);
      if (sliderValue < range.min || sliderValue > range.max) {
        slider.value = String(Math.min(range.max, Math.max(range.min, suggestedSize())));
      }
      updateBetDisplay();
      documentRef.querySelectorAll<HTMLButtonElement>(".sizing-preset").forEach((button) => {
        button.disabled = false;
      });
    } else {
      stateful.raiseControlsOpen = false;
      documentRef.querySelectorAll<HTMLButtonElement>(".sizing-preset").forEach((button) => {
        button.disabled = true;
      });
      getById("bet-amount-display").textContent = "—";
    }
    getById("action-bar").classList.toggle("raise-open", stateful.raiseControlsOpen && !!range);
  }

  function suggestedSize(): number {
    if (!stateful.lastRecommendation?.sizing) {
      return 0;
    }
    return Math.round(stateful.lastRecommendation.sizing.bet || stateful.lastRecommendation.sizing.raise || 0);
  }

  function applySizingPreset(preset: string): void {
    const actions = legalActions(stateful.state);
    const range = actions.bet || actions.raise;
    if (!range) {
      return;
    }

    const fractions: Record<string, number> = { third: 1 / 3, half: 0.5, "three-quarter": 0.75, pot: 1 };
    const pot = potTotal(stateful.state);
    const owe = toCall(stateful.state, "hero");
    const basePot = pot + owe;
    let target = 0;

    if (preset === "allin") {
      target = range.max;
    } else if (actions.bet) {
      target = Math.round(basePot * (fractions[preset] || 0.5));
    } else {
      target = stateful.state.currentBet + Math.round(basePot * (fractions[preset] || 0.5));
    }

    target = Math.max(range.min, Math.min(range.max, target));
    getById<HTMLInputElement>("bet-slider").value = String(target);
    updateBetDisplay();
  }

  function updateBetDisplay(): void {
    getById("bet-amount-display").textContent = getById<HTMLInputElement>("bet-slider").value;
    const actions = legalActions(stateful.state);
    const betButton = documentRef.querySelector<HTMLButtonElement>("[data-action='bet-raise']");
    if (betButton && stateful.raiseControlsOpen && (actions.bet || actions.raise)) {
      betButton.textContent = `${actions.bet ? "Bet" : "Raise"} ${getById("bet-amount-display").textContent}`;
    }
  }

  function disableActions(): void {
    stateful.raiseControlsOpen = false;
    getById("action-bar").classList.remove("raise-open");
    documentRef.querySelectorAll<HTMLButtonElement>(".action-btn").forEach((button) => {
      button.disabled = true;
    });
    documentRef.querySelectorAll<HTMLButtonElement>(".sizing-preset").forEach((button) => {
      button.disabled = true;
    });
  }

  function finishHand(): void {
    stateful.revealOpponentCards = true;
    updateCoachMetrics(null);
    render();
    updateSessionStatsFromHand();
    maybeSaveCompletedHand();

    const summary = buildHandSummary();
    logCoach(summary);
    getById("hand-summary-body").innerHTML = summary;
    showHandSummaryToast(summary);
    animatePotPayout();
    const nextButton = getById<HTMLButtonElement>("next-hand-btn");
    nextButton.hidden = false;
    nextButton.textContent = "Next hand →";
    updateActionBar();
    disableActions();
    nextButton.disabled = false;
    renderSessionSummary();
    renderHistoryPanel();
  }

  function showHandSummaryToast(summary: string): void {
    const toast = getById("hand-summary-toast");
    getById("hand-summary-toast-body").innerHTML = summary;
    toast.hidden = false;
    toast.classList.remove("is-visible");
    void toast.offsetWidth;
    toast.classList.add("is-visible");
  }

  function hideHandSummaryToast(): void {
    const toast = getById("hand-summary-toast");
    toast.classList.remove("is-visible");
    toast.hidden = true;
  }

  function animateCommittedChips(actor: "hero" | "bot", amount: number): void {
    if (amount <= 0) {
      return;
    }
    animateChipTransfer(
      actor === "hero" ? "hero-commit" : "opp-commit",
      "pot-graphic",
      amount
    );
  }

  function animatePotPayout(): void {
    const result = stateful.state.result;
    if (!result || stateful.payoutAnimatedHand === stateful.state.handNumber) {
      return;
    }
    stateful.payoutAnimatedHand = stateful.state.handNumber;
    if (result.winner === "tie") {
      animateChipTransfer("pot-graphic", "seat-hero", Math.ceil(result.amount / 2), 120);
      animateChipTransfer("pot-graphic", "seat-opponent", Math.floor(result.amount / 2), 180);
      return;
    }
    animateChipTransfer("pot-graphic", result.winner === "hero" ? "seat-hero" : "seat-opponent", result.amount, 140);
  }

  function animateChipTransfer(fromId: string, toId: string, amount: number, delay = 0): void {
    const layer = getById("chip-animation-layer");
    const from = getById(fromId);
    const to = getById(toId);
    const layerRect = layer.getBoundingClientRect();
    const fromCenter = elementCenter(from, layerRect);
    const toCenter = elementCenter(to, layerRect);
    const flyingChips = chipsForAmount(amount).slice(0, 7);
    flyingChips.forEach((denomination, index) => {
      const flyer = documentRef.createElement("span");
      flyer.className = "chip-flyer";
      flyer.innerHTML = renderChip(denomination, 0);
      const jitter = (index - Math.floor(flyingChips.length / 2)) * 7;
      flyer.style.setProperty("--chip-start-x", `${fromCenter.x + jitter}px`);
      flyer.style.setProperty("--chip-start-y", `${fromCenter.y + (index % 2) * 5}px`);
      flyer.style.setProperty("--chip-end-x", `${toCenter.x - jitter * 0.35}px`);
      flyer.style.setProperty("--chip-end-y", `${toCenter.y + (index % 3) * 4}px`);
      flyer.style.animationDelay = `${delay + index * 55}ms`;
      layer.appendChild(flyer);
      window.setTimeout(() => flyer.remove(), delay + 900 + index * 55);
    });
  }

  function elementCenter(element: HTMLElement, layerRect: DOMRect): { x: number; y: number } {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left - layerRect.left + rect.width / 2,
      y: rect.top - layerRect.top + rect.height / 2
    };
  }

  function buildHandSummary(): string {
    const result = stateful.state.result;
    let html = "<p><strong>Hand result:</strong> ";
    if (!result) {
      html += "n/a";
    } else if (result.reason === "fold") {
      html += `${result.winner === "hero" ? "You win " : "Opponent wins "}${result.amount} (opponent folded).`;
    } else {
      html += `${result.winner === "hero" ? "You win " : result.winner === "bot" ? "Opponent wins " : "Split pot, "}${result.amount} at showdown.<br>`;
      html += `Your hand: ${escapeHtml(result.heroHandName || "")}<br>`;
      html += `Opponent's hand: ${escapeHtml(result.botHandName || "")}`;
    }
    html += `</p><p>Stacks: You ${stateful.state.heroStack} / Opponent ${stateful.state.botStack}.</p>`;
    return html;
  }

  function updateSessionStatsFromHand(): void {
    stateful.session.hands += 1;
    const result = stateful.state.result;
    if (result) {
      if (result.winner === "hero") stateful.session.heroWins += 1;
      else if (result.winner === "bot") stateful.session.botWins += 1;
      else stateful.session.ties += 1;
    }
    stateful.session.netChips = stateful.state.heroStack - stateful.session.startingStack;
  }

  function renderSessionSummary(): void {
    const totalChoices = stateful.session.goodChoices + stateful.session.mixedChoices + stateful.session.badChoices;
    const agreement = totalChoices ? Math.round((stateful.session.goodChoices / totalChoices) * 100) : 0;
    const netBigBlinds = Math.round(stateful.session.netChips / stateful.state.bb);
    getById("session-summary").innerHTML =
      "<dl>" +
        `<dt>Hands played</dt><dd>${stateful.session.hands}</dd>` +
        `<dt>Won / Lost / Tied</dt><dd>${stateful.session.heroWins} / ${stateful.session.botWins} / ${stateful.session.ties}</dd>` +
        `<dt>Net</dt><dd>${netBigBlinds >= 0 ? "+" : ""}${netBigBlinds} bb (${stateful.session.netChips} chips)</dd>` +
        `<dt>Coach agreement</dt><dd>${agreement}% (${stateful.session.goodChoices} solid, ${stateful.session.mixedChoices} mixed, ${stateful.session.badChoices} off)</dd>` +
      "</dl>";
  }

  function refreshSavedHands(): void {
    stateful.savedHands = listSavedHands();
    if (stateful.selectedHistoryId && !stateful.savedHands.some((hand) => hand.id === stateful.selectedHistoryId)) {
      stateful.selectedHistoryId = null;
      stateful.replaySession = null;
      if (stateful.selectedReview?.kind === "hand") {
        stateful.selectedReview = null;
      }
    }
    if (stateful.selectedHistoryId) {
      const selected = loadSavedHand(stateful.selectedHistoryId);
      stateful.replaySession = selected ? createReplaySession(selected) : null;
    }
    renderRecentStudy();
  }

  function filteredHands(): SavedHandHistory[] {
    return stateful.historyFilter === "bookmarked"
      ? stateful.savedHands.filter((hand) => hand.tags.bookmarked)
      : stateful.savedHands;
  }

  function maybeSaveCompletedHand(): void {
    if (stateful.mode !== "live" || stateful.currentHandSaved || !stateful.state.handOver) {
      return;
    }
    const saved = finalizeLiveHand(stateful.currentHandRecorder, stateful.state);
    if (!saved) {
      return;
    }
    saveCompletedHand(saved);
    stateful.currentHandSaved = true;
    stateful.currentHandRecorder = null;
    if (stateful.liveStudySession) {
      stateful.liveStudySession = bumpSessionSummary(stateful.liveStudySession, { handsPlayed: 1 });
      upsertSessionSummary(stateful.liveStudySession);
    }
    refreshSavedHands();
    refreshStudyMemory();
    renderRecentStudy();
    renderProgressPanel();
  }

  function renderHistoryPanel(): void {
    getById<HTMLSelectElement>("history-filter").value = stateful.historyFilter;
    const listBody = getById("history-list");
    const replayBody = getById("history-replay");
    const hands = filteredHands();

    if (!hands.length) {
      listBody.innerHTML = "<p>No saved hands yet.</p>";
    } else {
      listBody.innerHTML = hands
        .map((hand) => {
          const selectedClass =
            stateful.selectedReview?.kind === "hand" && hand.id === stateful.selectedReview.id
              ? "history-item selected"
              : "history-item";
          const delta = hand.summary.heroDeltaBb >= 0 ? `+${hand.summary.heroDeltaBb}` : `${hand.summary.heroDeltaBb}`;
          const tags = [...hand.tags.spotTags, ...hand.tags.reviewTags].slice(0, 4);
          return (
            `<div class="${selectedClass}">` +
              `<button class="ghost history-open" type="button" data-history-open="${hand.id}">${escapeHtml(
                new Date(hand.timestamp).toLocaleString()
              )}</button>` +
              `<div><strong>${escapeHtml(hand.summary.outcome.replace(/_/g, " "))}</strong> · ${delta} bb</div>` +
              `<div class="history-tags">${tags.map((tag) => `<span class="context-pill subtle">${escapeHtml(tag)}</span>`).join("")}</div>` +
              `<div class="history-actions">` +
                `<button class="ghost" type="button" data-history-bookmark="${hand.id}">${hand.tags.bookmarked ? "Unbookmark" : "Bookmark"}</button>` +
                `<button class="ghost" type="button" data-history-delete="${hand.id}">Delete</button>` +
              `</div>` +
            `</div>`
          );
        })
        .join("");
    }

    replayBody.innerHTML = renderReplayPanel();

    documentRef.querySelectorAll<HTMLButtonElement>("[data-history-open]").forEach((button) => {
      button.addEventListener("click", () => {
        playTickSound();
        const id = button.dataset.historyOpen;
        if (!id) return;
        openHandReview(id);
        renderHistoryPanel();
      });
    });
    documentRef.querySelectorAll<HTMLButtonElement>("[data-history-bookmark]").forEach((button) => {
      button.addEventListener("click", () => {
        playTickSound();
        const id = button.dataset.historyBookmark;
        if (!id) return;
        const hand = loadSavedHand(id);
        if (!hand) return;
        updateSavedHandBookmark(id, !hand.tags.bookmarked);
        refreshSavedHands();
        renderHistoryPanel();
      });
    });
    documentRef.querySelectorAll<HTMLButtonElement>("[data-history-delete]").forEach((button) => {
      button.addEventListener("click", () => {
        playTickSound();
        const id = button.dataset.historyDelete;
        if (!id) return;
        deleteSavedHand(id);
        refreshSavedHands();
        renderHistoryPanel();
      });
    });
    documentRef.querySelectorAll<HTMLButtonElement>("[data-replay-nav]").forEach((button) => {
      button.addEventListener("click", () => {
        playTickSound();
        if (!stateful.replaySession || stateful.selectedReview?.kind !== "hand") return;
        const nav = button.dataset.replayNav;
        if (nav === "start") stateful.replaySession = jumpReplayToStart(stateful.replaySession);
        if (nav === "prevStreet") stateful.replaySession = jumpReplayStreetBackward(stateful.replaySession);
        if (nav === "prev") stateful.replaySession = stepReplay(stateful.replaySession, -1);
        if (nav === "next") stateful.replaySession = stepReplay(stateful.replaySession, 1);
        if (nav === "nextStreet") stateful.replaySession = jumpReplayStreetForward(stateful.replaySession);
        if (nav === "end") stateful.replaySession = jumpReplayToEnd(stateful.replaySession);
        renderHistoryPanel();
      });
    });
    documentRef.querySelectorAll<HTMLButtonElement>("[data-replay-step]").forEach((button) => {
      button.addEventListener("click", () => {
        playTickSound();
        if (!stateful.replaySession || stateful.selectedReview?.kind !== "hand") return;
        const value = Number.parseInt(button.dataset.replayStep || "", 10);
        if (Number.isNaN(value)) return;
        stateful.replaySession = moveReplayCursor(stateful.replaySession, value);
        renderHistoryPanel();
      });
    });
  }

  function renderRecentStudyLegacy(): void {
    const body = getById("recent-study");
    if (!stateful.savedHands.length && !stateful.recentDecisions.length && !stateful.recentDrillAttempts.length && !stateful.recentSessions.length) {
      body.innerHTML = "<p>No saved study records yet.</p>";
      return;
    }

    const handItems = stateful.savedHands
      .slice(0, 5)
      .map((hand) => `<li>${escapeHtml(new Date(hand.timestamp).toLocaleString())} · ${escapeHtml(hand.summary.outcome.replace(/_/g, " "))}</li>`)
      .join("");
    const decisionItems = stateful.recentDecisions
      .map(
        (record) =>
          `<li>${escapeHtml(new Date(record.timestamp).toLocaleString())} · <code>${escapeHtml(record.spotKey)}</code> · ${escapeHtml(
            describeAction(record.userAction, record.sizingChosen)
          )} · ${escapeHtml(record.coachEvaluation.verdict)}</li>`
      )
      .join("");
    const drillItems = stateful.recentDrillAttempts
      .map(
        (attempt) =>
          `<li>${escapeHtml(new Date(attempt.timestamp).toLocaleString())} · <code>${escapeHtml(attempt.spotKey)}</code> · ${escapeHtml(
            describeAction(attempt.userAction, attempt.sizingChosen)
          )} · ${escapeHtml(attempt.coachEvaluation.verdict)}</li>`
      )
      .join("");
    const sessionItems = stateful.recentSessions
      .map(
        (session) =>
          `<li>${escapeHtml(session.mode)} · ${escapeHtml(new Date(session.timestampStart).toLocaleString())} · hands ${session.handsPlayed} · decisions ${session.decisionsTracked} · drills ${session.drillAttempts}</li>`
      )
      .join("");

    body.innerHTML =
      `<p><strong>Recent hands</strong></p>${handItems ? `<ul>${handItems}</ul>` : "<p>No hands saved.</p>"}` +
      `<p><strong>Recent decisions</strong></p>${decisionItems ? `<ul>${decisionItems}</ul>` : "<p>No decisions saved.</p>"}` +
      `<p><strong>Recent drill attempts</strong></p>${drillItems ? `<ul>${drillItems}</ul>` : "<p>No drill attempts saved.</p>"}` +
      `<p><strong>Recent sessions</strong></p>${sessionItems ? `<ul>${sessionItems}</ul>` : "<p>No session summaries saved.</p>"}`;
  }

  function renderRecentStudy(): void {
    const body = getById("recent-study");
    if (!stateful.savedHands.length && !stateful.recentDecisions.length && !stateful.recentDrillAttempts.length && !stateful.recentSessions.length) {
      body.innerHTML = "<p>No saved study records yet.</p>";
      return;
    }

    const needsReview = collectNeedsReview(stateful.recentDecisions, stateful.recentDrillAttempts, 6);
    const handItems = stateful.savedHands
      .slice(0, 5)
      .map(
        (hand) =>
          `<li>${escapeHtml(new Date(hand.timestamp).toLocaleString())} · ${escapeHtml(hand.summary.outcome.replace(/_/g, " "))} ` +
          `<button class="ghost" type="button" data-review-kind="hand" data-review-id="${hand.id}">Review</button></li>`
      )
      .join("");
    const decisionItems = stateful.recentDecisions
      .map(
        (record) =>
          `<li>${escapeHtml(new Date(record.timestamp).toLocaleString())} · <code>${escapeHtml(record.spotKey)}</code> · ${escapeHtml(
            describeAction(record.userAction, record.sizingChosen)
          )} · ${escapeHtml(record.coachEvaluation.verdict)} ` +
          `<button class="ghost" type="button" data-review-kind="decision" data-review-id="${record.id}">Review</button></li>`
      )
      .join("");
    const drillItems = stateful.recentDrillAttempts
      .map(
        (attempt) =>
          `<li>${escapeHtml(new Date(attempt.timestamp).toLocaleString())} · <code>${escapeHtml(attempt.spotKey)}</code> · ${escapeHtml(
            describeAction(attempt.userAction, attempt.sizingChosen)
          )} · ${escapeHtml(attempt.coachEvaluation.verdict)} ` +
          `<button class="ghost" type="button" data-review-kind="drill" data-review-id="${attempt.id}">Review</button></li>`
      )
      .join("");
    const sessionItems = stateful.recentSessions
      .map(
        (session) =>
          `<li>${escapeHtml(session.mode)} · ${escapeHtml(new Date(session.timestampStart).toLocaleString())} · hands ${session.handsPlayed} · decisions ${session.decisionsTracked} · drills ${session.drillAttempts}</li>`
      )
      .join("");
    const reviewItems = needsReview
      .map(
        (item) =>
          `<li><code>${escapeHtml(item.label)}</code> · ${escapeHtml(item.verdict)} · ${escapeHtml(item.tone)} ` +
          `<button class="ghost" type="button" data-review-kind="${item.kind}" data-review-id="${item.id}">Open</button></li>`
      )
      .join("");

    body.innerHTML =
      `<p><strong>Needs review</strong></p>${reviewItems ? `<ul>${reviewItems}</ul>` : "<p>No tagged mistakes yet.</p>"}` +
      `<p><strong>Recent hands</strong></p>${handItems ? `<ul>${handItems}</ul>` : "<p>No hands saved.</p>"}` +
      `<p><strong>Recent decisions</strong></p>${decisionItems ? `<ul>${decisionItems}</ul>` : "<p>No decisions saved.</p>"}` +
      `<p><strong>Recent drill attempts</strong></p>${drillItems ? `<ul>${drillItems}</ul>` : "<p>No drill attempts saved.</p>"}` +
      `<p><strong>Recent sessions</strong></p>${sessionItems ? `<ul>${sessionItems}</ul>` : "<p>No session summaries saved.</p>"}`;

    body.querySelectorAll<HTMLButtonElement>("[data-review-kind]").forEach((button) => {
      button.addEventListener("click", () => {
        playTickSound();
        const kind = button.dataset.reviewKind;
        const id = button.dataset.reviewId;
        if (!kind || !id) return;
        if (kind === "hand") openHandReview(id);
        if (kind === "decision") openDecisionReview(id);
        if (kind === "drill") openDrillReview(id);
        renderHistoryPanel();
      });
    });
  }

  function renderProgressPanel(): void {
    const body = getById("progress-panel");
    const attempted = stateful.conceptSummaries.filter((summary) => summary.totalAttempts > 0);
    if (!attempted.length) {
      body.innerHTML = "<p>No concept data yet. Play hands or run drills to start tracking progress.</p>";
      return;
    }

    const sorted = [...attempted].sort((left, right) => {
      if (right.mistakeRate !== left.mistakeRate) return right.mistakeRate - left.mistakeRate;
      return right.totalAttempts - left.totalAttempts;
    });
    const topConcepts = sorted.slice(0, 8);
    const strongest = [...attempted]
      .sort((left, right) => {
        if (right.successRate !== left.successRate) return right.successRate - left.successRate;
        return right.totalAttempts - left.totalAttempts;
      })
      .slice(0, 3);

    const conceptItems = topConcepts
      .map((summary) => {
        const status =
          summary.mistakeRate >= 0.4 ? "Needs work" : summary.mistakeRate >= 0.22 ? "Mixed" : "Stable";
        const trend =
          summary.trendLabel === "insufficient_data"
            ? "trend n/a"
            : `${summary.trendLabel}${summary.recentSuccessRate !== null ? ` (${Math.round(summary.recentSuccessRate * 100)}% recent)` : ""}`;
        return (
          `<li>` +
          `<strong>${escapeHtml(summary.label)}</strong> · ${status} · success ${Math.round(summary.successRate * 100)}% · mistakes ${Math.round(
            summary.mistakeRate * 100
          )}% · attempts ${summary.totalAttempts}` +
          `${summary.weakestSignals.length ? `<br />${escapeHtml(summary.weakestSignals.join("; "))}` : ""}` +
          `<br />${escapeHtml(trend)}` +
          `</li>`
        );
      })
      .join("");

    const strongestItems = strongest
      .map(
        (summary) =>
          `<li>${escapeHtml(summary.label)} · success ${Math.round(summary.successRate * 100)}% across ${summary.totalAttempts} spots</li>`
      )
      .join("");

    const recommendationItems = stateful.drillRecommendations
      .map(
        (recommendation) =>
          `<li>${escapeHtml(recommendation.label)}: ${escapeHtml(
            recommendation.drillPackIds.map((packId) => drillPackTitle(packId)).join(", ")
          )}</li>`
      )
      .join("");

    body.innerHTML =
      `<p><strong>Concept performance</strong></p><ul>${conceptItems}</ul>` +
      `<p><strong>Strongest areas</strong></p>${strongestItems ? `<ul>${strongestItems}</ul>` : "<p>Need more volume.</p>"}` +
      `<p><strong>Suggested drills</strong></p>${recommendationItems ? `<ul>${recommendationItems}</ul>` : "<p>No drill recommendation yet.</p>"}`;

    if (progressDebugEnabled()) {
      body.innerHTML +=
        `<p><strong>Progress debug</strong></p><pre>${escapeHtml(
          JSON.stringify(
            topConcepts.map((summary) => ({
              concept: summary.conceptId,
              attempts: summary.totalAttempts,
              successRate: Number(summary.successRate.toFixed(2)),
              mistakeRate: Number(summary.mistakeRate.toFixed(2)),
              trend: summary.trendLabel
            })),
            null,
            2
          )
        )}</pre>`;
    }
  }

  function renderReplayPanelLegacy(): string {
    if (!stateful.replaySession) {
      return "<p>Select a saved hand to replay it.</p>";
    }
    const hand = stateful.replaySession.hand;
    const frame = getReplayFrame(hand, stateful.replaySession.cursor);
    const eventLabel = (() => {
      if (!frame.currentEvent) return "Hand start";
      if (frame.currentEvent.type === "action") return describeReplayEvent(frame.currentEvent);
      if (frame.currentEvent.type === "street_transition") return `${capitalize(frame.currentEvent.toStreet)} dealt`;
      return "Showdown";
    })();

    const historyRows = hand.events
      .map((event, index) => {
        const selected = index === frame.cursor ? "replay-step selected" : "replay-step";
        const label = event.type === "action" ? describeReplayEvent(event) : event.type === "street_transition" ? `${capitalize(event.toStreet)} dealt` : "Showdown";
        return `<button class="${selected}" type="button" data-replay-step="${index}">${index + 1}. ${escapeHtml(label)}</button>`;
      })
      .join("");

    let coachBlock = "";
    if (frame.heroDecisionEvent?.coachSnapshot) {
      const agreement = frame.heroDecisionEvent.agreement;
      coachBlock =
        `<div class="replay-coach">` +
          `<p><strong>${escapeHtml(frame.heroDecisionEvent.coachSnapshot.spotLabel)}</strong> <code>${escapeHtml(
            frame.heroDecisionEvent.coachSnapshot.spotKey
          )}</code></p>` +
          (frame.heroDecisionEvent.coachSnapshot.recommendation.inferredRange
            ? `<p><strong>Range read:</strong> ${escapeHtml(
                frame.heroDecisionEvent.coachSnapshot.recommendation.inferredRange.summaryLabel
              )}.</p>`
            : "") +
          `<p>${escapeHtml(frame.heroDecisionEvent.coachSnapshot.recommendation.reasoning.recommendation)}</p>` +
          `<p><strong>Hero action:</strong> ${escapeHtml(describeAction(frame.heroDecisionEvent.action, frame.heroDecisionEvent.amount))}</p>` +
          (agreement
            ? `<p><strong>Agreement:</strong> ${escapeHtml(agreement.verdict)} ${escapeHtml(agreement.explanation)}</p>`
            : "") +
        `</div>`;
    }

    return (
      `<div class="replay-summary">` +
        `<p><strong>${escapeHtml(new Date(hand.timestamp).toLocaleString())}</strong> · ${escapeHtml(hand.summary.outcome.replace(/_/g, " "))} · ${hand.summary.heroDeltaBb >= 0 ? "+" : ""}${hand.summary.heroDeltaBb} bb</p>` +
        `<p>Current step: ${frame.cursor + 1}/${frame.totalSteps} · ${escapeHtml(eventLabel)}</p>` +
        `<p>Pot ${frame.state.pot}${frame.state.heroCommitted || frame.state.botCommitted ? ` (+${frame.state.heroCommitted + frame.state.botCommitted})` : ""} · Hero ${frame.state.heroStack} · Villain ${frame.state.botStack}</p>` +
        `<p>Street: ${escapeHtml(labelForStreet(frame.currentStreet))}${frame.state.toAct ? ` · To act: ${frame.state.toAct === "hero" ? "Hero" : "Villain"}` : ""}</p>` +
      `</div>` +
      `<div class="replay-table">` +
        `<div><strong>Villain</strong>${renderHole(hand.initial.villainHole, false)}</div>` +
        `<div><strong>Board</strong>${renderBoard(frame.shownBoard)}</div>` +
        `<div><strong>Hero</strong>${renderHole(hand.initial.heroHole, false)}</div>` +
      `</div>` +
      `<div class="history-actions">` +
        `<button class="ghost" type="button" data-replay-nav="start">|&lt;</button>` +
        `<button class="ghost" type="button" data-replay-nav="prevStreet">&lt;&lt; street</button>` +
        `<button class="ghost" type="button" data-replay-nav="prev">&lt; step</button>` +
        `<button class="ghost" type="button" data-replay-nav="next">step &gt;</button>` +
        `<button class="ghost" type="button" data-replay-nav="nextStreet">street &gt;&gt;</button>` +
        `<button class="ghost" type="button" data-replay-nav="end">&gt;|</button>` +
      `</div>` +
      `${coachBlock}` +
      `<div class="replay-log"><strong>Actions so far</strong>${renderReplayActionHistory(frame.actionHistory)}</div>` +
      `<div class="replay-steps">${historyRows || "<p>No events.</p>"}</div>`
    );
  }

  function renderReplayPanel(): string {
    if (!stateful.selectedReview) {
      return "<p>Select a saved hand, decision, or drill attempt to review it.</p>";
    }

    if (stateful.selectedReview.kind === "decision") {
      const decision = getDecisionById(stateful.selectedReview.id);
      if (!decision) {
        return "<p>Saved decision not found.</p>";
      }
      return (
        `<div class="replay-summary">` +
          `<p><strong>${escapeHtml(new Date(decision.timestamp).toLocaleString())}</strong> · Saved decision review</p>` +
          `<p><code>${escapeHtml(decision.spotKey)}</code> · ${escapeHtml(labelForStreet(decision.street))}</p>` +
        `</div>` +
        renderDecisionReviewCard(buildDecisionReview(decision))
      );
    }

    if (stateful.selectedReview.kind === "drill") {
      const attempt = getDrillAttemptById(stateful.selectedReview.id);
      if (!attempt) {
        return "<p>Saved drill attempt not found.</p>";
      }
      const scenario = findScenarioById(attempt.scenarioId);
      const review = buildDrillReview(attempt, scenario ?? undefined);
      return (
        `<div class="replay-summary">` +
          `<p><strong>${escapeHtml(new Date(review.timestamp).toLocaleString())}</strong> · Drill review</p>` +
          `<p><strong>${escapeHtml(review.scenarioTitle)}</strong> <code>${escapeHtml(review.spotKey)}</code></p>` +
        `</div>` +
        `<div class="replay-table">` +
          `<div><strong>Hero</strong>${review.heroHand.length ? renderHole(review.heroHand, false) : "<p>Not saved.</p>"}</div>` +
          `<div><strong>Board</strong>${renderBoard(review.board)}</div>` +
          `<div><strong>Context</strong><p>Pot ${review.potSize} · ${review.effectiveStackBb} bb effective</p></div>` +
        `</div>` +
        (review.teachingNote ? `<div class="tip">${escapeHtml(review.teachingNote)}</div>` : "") +
        (review.focusArea ? `<p><strong>Focus area:</strong> ${escapeHtml(review.focusArea)}</p>` : "") +
        renderSimpleActionHistory(review.actionHistory, "Scenario line") +
        renderDrillReviewCard(review)
      );
    }

    if (!stateful.replaySession) {
      return "<p>Select a saved hand to replay it.</p>";
    }

    const hand = stateful.replaySession.hand;
    const frame = getReplayFrame(hand, stateful.replaySession.cursor);
    const details = buildHandReviewDetails(hand, stateful.replaySession.cursor, getDecisionsForHand(hand.id));
    const eventLabel = (() => {
      if (!frame.currentEvent) return "Hand start";
      if (frame.currentEvent.type === "action") return describeReplayEvent(frame.currentEvent);
      if (frame.currentEvent.type === "street_transition") return `${capitalize(frame.currentEvent.toStreet)} dealt`;
      return "Showdown";
    })();

    const historyRows = details.timeline
      .map((entry) => {
        const selected = entry.index === frame.cursor ? "replay-step selected" : "replay-step";
        const suffix =
          entry.isHeroDecision && entry.spotKey
            ? ` · ${entry.spotKey}${entry.verdict ? ` · ${entry.verdict}` : ""}`
            : "";
        return `<button class="${selected}" type="button" data-replay-step="${entry.index}">${entry.index + 1}. ${escapeHtml(
          entry.label
        )}${escapeHtml(suffix)}</button>`;
      })
      .join("");

    return (
      `<div class="replay-summary">` +
        `<p><strong>${escapeHtml(new Date(hand.timestamp).toLocaleString())}</strong> · ${escapeHtml(hand.summary.outcome.replace(/_/g, " "))} · ${hand.summary.heroDeltaBb >= 0 ? "+" : ""}${hand.summary.heroDeltaBb} bb</p>` +
        `<p>Current step: ${frame.cursor + 1}/${frame.totalSteps} · ${escapeHtml(eventLabel)}</p>` +
        `<p>Pot ${frame.state.pot}${frame.state.heroCommitted || frame.state.botCommitted ? ` (+${frame.state.heroCommitted + frame.state.botCommitted})` : ""} · Hero ${frame.state.heroStack} · Villain ${frame.state.botStack}</p>` +
        `<p>Street: ${escapeHtml(labelForStreet(frame.currentStreet))}${frame.state.toAct ? ` · To act: ${frame.state.toAct === "hero" ? "Hero" : "Villain"}` : ""}</p>` +
      `</div>` +
      `<div class="replay-table">` +
        `<div><strong>Villain</strong>${renderHole(hand.initial.villainHole, false)}</div>` +
        `<div><strong>Board</strong>${renderBoard(frame.shownBoard)}</div>` +
        `<div><strong>Hero</strong>${renderHole(hand.initial.heroHole, false)}</div>` +
      `</div>` +
      `<div class="history-actions">` +
        `<button class="ghost" type="button" data-replay-nav="start">|&lt;</button>` +
        `<button class="ghost" type="button" data-replay-nav="prevStreet">&lt;&lt; street</button>` +
        `<button class="ghost" type="button" data-replay-nav="prev">&lt; step</button>` +
        `<button class="ghost" type="button" data-replay-nav="next">step &gt;</button>` +
        `<button class="ghost" type="button" data-replay-nav="nextStreet">street &gt;&gt;</button>` +
        `<button class="ghost" type="button" data-replay-nav="end">&gt;|</button>` +
      `</div>` +
      `${details.currentDecision ? renderDecisionReviewCard(details.currentDecision, details.needsReview ? "Needs review" : undefined) : ""}` +
      `<div class="replay-log"><strong>Actions so far</strong>${renderReplayActionHistory(frame.actionHistory)}</div>` +
      `<div class="replay-steps">${historyRows || "<p>No events.</p>"}</div>`
    );
  }

  void renderRecentStudyLegacy;
  void renderReplayPanelLegacy;

  function renderReplayActionHistory(actions: ReturnType<typeof getReplayFrame>["actionHistory"]): string {
    if (!actions.length) {
      return "<p>Pre-action state.</p>";
    }
    return `<ol>${actions
      .map((entry) => `<li>${escapeHtml(describeReplayActionEntry(entry))}</li>`)
      .join("")}</ol>`;
  }

  function renderSimpleActionHistory(actions: { street: string; actor: "hero" | "bot"; action: EngineAction; amount?: number }[], title: string): string {
    if (!actions.length) {
      return `<div class="replay-log"><strong>${escapeHtml(title)}</strong><p>No prior actions saved.</p></div>`;
    }
    return `<div class="replay-log"><strong>${escapeHtml(title)}</strong><ol>${actions
      .map((entry) => `<li>${escapeHtml(describeReplayActionEntry(entry as ReturnType<typeof getReplayFrame>["actionHistory"][number]))}</li>`)
      .join("")}</ol></div>`;
  }

  function renderStudyTags(tags: string[]): string {
    if (!tags.length) return "";
    return `<p>${tags.map((tag) => `<span class="context-pill subtle">${escapeHtml(tag)}</span>`).join(" ")}</p>`;
  }

  function renderDecisionReviewCard(
    review: ReturnType<typeof buildDecisionReview>,
    title?: string
  ): string {
    const range = review.inferredRangeSummary;
    return (
      `<div class="replay-coach">` +
        `<p><strong>${escapeHtml(title ?? "Hero decision review")}</strong></p>` +
        `<p><code>${escapeHtml(review.spotKey)}</code> · ${escapeHtml(labelForStreet(review.street))}</p>` +
        `<p><strong>Hero action:</strong> ${escapeHtml(describeAction(review.userAction, review.sizingChosen))}</p>` +
        `<p><strong>Coach recommendation:</strong> ${escapeHtml(review.coachRecommendation.actionText)}</p>` +
        `<p><strong>Evaluation:</strong> ${escapeHtml(review.coachEvaluation.verdict)} ${escapeHtml(review.coachEvaluation.explanation)}</p>` +
        `<p><strong>Context:</strong> Pot ${review.potSize} · Effective stack ${review.effectiveStack}</p>` +
        (review.actionOptions.length ? `<p><strong>Options shown:</strong> ${escapeHtml(review.actionOptions.join(", "))}</p>` : "") +
        (review.explanationSnapshot ? `<p>${escapeHtml(review.explanationSnapshot)}</p>` : "") +
        (range
          ? `<p><strong>Saved range read:</strong> ${escapeHtml(range.summaryLabel)}. ${escapeHtml(range.emphasis.join(", "))}</p>`
          : "") +
        (review.blockerNotes.length ? `<p><strong>Blockers:</strong> ${escapeHtml(review.blockerNotes.join(" "))}</p>` : "") +
        renderStudyTags(review.tags) +
      `</div>`
    );
  }

  function renderDrillReviewCard(review: ReturnType<typeof buildDrillReview>): string {
    return (
      `<div class="replay-coach">` +
        `<p><strong>Drill attempt review</strong></p>` +
        `<p><strong>Action taken:</strong> ${escapeHtml(describeAction(review.userAction, review.sizingChosen))}</p>` +
        (review.recommendedMix ? `<p><strong>Recommended mix:</strong> ${escapeHtml(review.recommendedMix)}</p>` : "") +
        `<p><strong>Evaluation:</strong> ${escapeHtml(review.coachEvaluation.verdict)} ${escapeHtml(review.coachEvaluation.explanation)}</p>` +
        (review.explanationSnapshot ? `<p>${escapeHtml(review.explanationSnapshot)}</p>` : "") +
        renderStudyTags(review.tags) +
      `</div>`
    );
  }

  function describeReplayActionEntry(entry: ReturnType<typeof getReplayFrame>["actionHistory"][number]): string {
    const actor = entry.actor === "hero" ? "Hero" : "Villain";
    if (entry.action === "bet") return `${actor} bet ${entry.amount}`;
    if (entry.action === "raise") return `${actor} raised to ${entry.amount}`;
    if (entry.action === "call") return `${actor} called ${entry.amount}`;
    return `${actor} ${entry.action}`;
  }

  function describeReplayEvent(event: HandHistoryEvent): string {
    if (event.type !== "action") {
      return event.type === "street_transition" ? `${capitalize(event.toStreet)} dealt` : "Showdown";
    }
    return describeReplayActionEntry({
      street: event.street,
      actor: event.actor,
      action: event.action,
      amount: event.amount
    });
  }

  function render(): void {
    getById("hero-stack").textContent = `${stateful.state.heroStack} (${Math.round(stateful.state.heroStack / stateful.state.bb)} bb)`;
    getById("opp-stack").textContent = `${stateful.state.botStack} (${Math.round(stateful.state.botStack / stateful.state.bb)} bb)`;
    getById("hero-stack-rack").innerHTML = renderPlayerStackRack(stateful.state.heroStack);
    getById("opp-stack-rack").innerHTML = renderPlayerStackRack(stateful.state.botStack);
    getById("hero-commit").innerHTML = renderCommittedChips(stateful.state.heroCommitted);
    getById("opp-commit").innerHTML = renderCommittedChips(stateful.state.botCommitted);
    const totalPot = potTotal(stateful.state);
    getById("pot-chip-stack").innerHTML = renderChipStack(totalPot, "pot");
    getById("pot-amount").textContent = String(totalPot);

    getById("street-label").textContent =
      `${labelForStreet(stateful.state.street)} · ` +
      (stateful.state.heroIsButton ? "You are Button (SB)" : "Opponent is Button (SB)");

    getById("hero-cards").innerHTML = renderHole(stateful.state.heroHole, false);
    getById("opp-cards").innerHTML = renderHole(stateful.state.botHole, !stateful.revealOpponentCards);
    getById("board").innerHTML = renderBoard(stateful.state.board);

    getById("seat-hero").classList.toggle("is-turn", stateful.state.toAct === "hero");
    getById("seat-opponent").classList.toggle("is-turn", stateful.state.toAct === "bot");
    getById("hero-avatar").classList.toggle("has-button", stateful.state.heroIsButton);
    getById("opp-avatar").classList.toggle("has-button", !stateful.state.heroIsButton);
    renderCoachContext();
    renderDrillProgress();
  }

  function renderCoachContext(): void {
    const context = getById("coach-context");
    const spot = classifySpot(stateful.state);
    const parts = [
      `<span class="context-pill">${stateful.mode === "drill" ? "Drill" : "Live play"}</span>`,
      `<span class="context-pill">${escapeHtml(spot.label)}</span>`,
      `<span class="context-pill subtle">${escapeHtml(spot.key)}</span>`
    ];
    if (stateful.mode === "live") {
      parts.push(`<span class="context-pill">${escapeHtml(getBotArchetype(stateful.botStyle).label)}</span>`);
    }
    if (window.localStorage.getItem("coach.debugSpots") === "1") {
      parts.push(`<span class="context-pill subtle">${escapeHtml(spotDebugLabel(spot))}</span>`);
    }
    if (window.localStorage.getItem("coach.debugArchetypes") === "1") {
      parts.push(`<span class="context-pill subtle">${escapeHtml(archetypeDebugLabel(stateful.botStyle))}</span>`);
    }
    if (stateful.drillSession) {
      parts.push(`<span class="context-pill">${escapeHtml(stateful.drillSession.current.title)}</span>`);
    }
    context.innerHTML = parts.join("");
  }

  function renderHole(cards: GameState["heroHole"], faceDown: boolean): string {
    if (!cards.length) {
      return (
        renderCardMarkup(null, { faceDown: true, deck: stateful.selectedDeck }) +
        renderCardMarkup(null, { faceDown: true, deck: stateful.selectedDeck })
      );
    }
    return cards.map((card) => renderCardMarkup(card, { faceDown, deck: stateful.selectedDeck })).join("");
  }

  function renderBoard(board: GameState["board"]): string {
    const slots: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      if (board[index]) {
        slots.push(renderCardMarkup(board[index], { deck: stateful.selectedDeck }));
      } else {
        slots.push('<div class="card-slot"></div>');
      }
    }
    return slots.join("");
  }

  function renderCommittedChips(amount: number): string {
    if (!amount) {
      return "";
    }
    return `${renderChipStack(amount, "commit")}<span class="chip-amount-label">In pot ${amount}</span>`;
  }

  function renderChipStack(amount: number, variant: "commit" | "pot" | "fly"): string {
    if (amount <= 0) {
      return "";
    }
    const chips = chipsForAmount(amount).slice(0, 10);
    const hiddenCount = Math.max(0, chipsForAmount(amount).length - chips.length);
    return (
      `<span class="chip-stack chip-stack-${variant}" aria-hidden="true">` +
        chips
          .map((denomination, index) => renderChip(denomination, index))
          .join("") +
        (hiddenCount ? `<span class="chip-more">+${hiddenCount}</span>` : "") +
      `</span>`
    );
  }

  function renderPlayerStackRack(amount: number): string {
    const counts = chipCountsForAmount(amount);
    return CHIP_DENOMINATIONS
      .filter((denomination) => counts[denomination] > 0)
      .map((denomination) => {
        const visible = Math.min(counts[denomination], 7);
        const chips = Array.from({ length: visible }, (_, index) => renderChip(denomination, index)).join("");
        return (
          `<span class="stack-column stack-column-${denomination}">` +
            `<span class="chip-stack stack-rack-stack">${chips}</span>` +
            `<span class="stack-column-count">${counts[denomination]} x ${denomination}</span>` +
          `</span>`
        );
      })
      .join("");
  }

  function chipCountsForAmount(amount: number): Record<ChipDenomination, number> {
    const counts = Object.fromEntries(CHIP_DENOMINATIONS.map((denomination) => [denomination, 0])) as Record<ChipDenomination, number>;
    for (const chip of chipsForAmount(amount)) {
      counts[chip] += 1;
    }
    return counts;
  }

  function renderChip(denomination: ChipDenomination, index: number): string {
    const offset = Math.min(index, 9) * 3;
    return `<span class="chip chip-${denomination}" style="--chip-offset:${offset}px"><span>${denomination}</span></span>`;
  }

  function chipsForAmount(amount: number): ChipDenomination[] {
    const chips: ChipDenomination[] = [];
    let remaining = Math.max(0, Math.floor(amount));
    for (const denomination of CHIP_DENOMINATIONS) {
      while (remaining >= denomination) {
        chips.push(denomination);
        remaining -= denomination;
      }
    }
    return chips;
  }

  function labelForStreet(street: GameState["street"]): string {
    const labels: Record<GameState["street"], string> = {
      idle: "",
      preflop: "Preflop",
      flop: "Flop",
      turn: "Turn",
      river: "River",
      showdown: "Showdown"
    };
    return labels[street];
  }

  function logCoach(html: string): void {
    stateful.coachLog.push(annotateGlossary(html));
    if (stateful.coachLog.length > 12) {
      stateful.coachLog.shift();
    }
    const coachBody = getById("coach-body");
    coachBody.innerHTML = stateful.coachLog.join("");
    coachBody.scrollTop = coachBody.scrollHeight;
  }

  function renderCoachDecisionCard(recommendation: CoachRecommendation, detailsHtml: string): string {
    const action = primaryActionLabel(recommendation);
    const confidence = recommendation.strategySelection?.confidence || confidenceFromMix(recommendation);
    const confidenceText = confidenceLabel(confidence);
    const reason = firstSentence(recommendation.reasoning.recommendation, 170);
    getById("coach-hint").textContent = `${action} - ${confidenceText} - ${reason}`;
    return (
      `<article class="decision-card">` +
        `<div class="decision-card-head">` +
          `<span><label>Recommended action</label><strong>${escapeHtml(action)}</strong></span>` +
          `<span><label>Confidence</label><strong>${escapeHtml(confidenceText)}</strong></span>` +
        `</div>` +
        renderMixBars(recommendation.probs) +
        `<p class="decision-reason">${escapeHtml(reason)}</p>` +
        `<details class="why-panel">` +
          `<summary>Why?</summary>` +
          `<div>${detailsHtml}</div>` +
        `</details>` +
      `</article>`
    );
  }

  function primaryActionLabel(recommendation: CoachRecommendation): string {
    const entries = Object.entries(recommendation.probs) as [EngineAction, number][];
    const [action] = entries.reduce<[EngineAction, number]>(
      (best, entry) => (entry[1] > best[1] ? entry : best),
      ["fold", -1]
    );
    if (action === "check") return "Check";
    if (action === "bet") return recommendation.sizing.bet ? `Bet ${recommendation.sizing.bet}` : "Bet";
    if (action === "raise") return recommendation.sizing.raise ? `Raise ${recommendation.sizing.raise}` : "Raise";
    return capitalize(action);
  }

  function confidenceFromMix(recommendation: CoachRecommendation): string {
    const top = Math.max(0, ...Object.values(recommendation.probs).map((value) => value || 0));
    if (top >= 0.72) return "high";
    if (top >= 0.48) return "medium";
    return "low";
  }

  function confidenceLabel(confidence: string): string {
    if (confidence === "high") return "High";
    if (confidence === "medium") return "Medium";
    if (confidence === "low") return "Mixed";
    return capitalize(confidence);
  }

  function firstSentence(value: string, maxLength: number): string {
    const sentence = value.match(/^[^.!?]+[.!?]/)?.[0] || value;
    if (sentence.length <= maxLength) return sentence;
    return `${sentence.slice(0, maxLength - 1).trim()}...`;
  }

  function updateCoachMetrics(recommendation: CoachRecommendation | null): void {
    const metrics = getById("coach-metrics");
    if (!recommendation || recommendation.equity === undefined) {
      metrics.hidden = true;
      metrics.innerHTML = "";
      return;
    }

    const parts: string[] = [];
    if (recommendation.pot !== undefined) {
      parts.push(`<span class="metric"><label>Pot</label><b>${recommendation.pot}</b></span>`);
    }
    if (recommendation.owe !== undefined && recommendation.owe > 0) {
      parts.push(`<span class="metric"><label>To call</label><b>${recommendation.owe}</b></span>`);
    }
    parts.push(`<span class="metric highlight"><label>Equity</label><b>${Math.round((recommendation.equity || 0) * 100)}%</b></span>`);
    if (recommendation.potOdds !== undefined && (recommendation.owe || 0) > 0) {
      parts.push(`<span class="metric"><label>Pot odds</label><b>${Math.round(recommendation.potOdds * 100)}%</b></span>`);
    }
    if (recommendation.inferredRange) {
      parts.push(
        `<span class="metric"><label>Range shape</label><b>${escapeHtml(recommendation.inferredRange.shapeLabel)}</b></span>`
      );
    }

    metrics.innerHTML = parts.join("");
    metrics.hidden = false;
  }

  function renderMixBars(probabilities: CoachRecommendation["probs"]): string {
    const keys: EngineAction[] = ["fold", "check", "call", "bet", "raise"];
    let html = '<div class="mix-bars">';
    for (const key of keys) {
      if ((probabilities[key] ?? 0) > 0) {
        const className = key === "fold" ? "mix-fold" : key === "raise" || key === "bet" ? "mix-raise" : "mix-call";
        html += `<span class="${className}">${capitalize(key)} ${Math.round((probabilities[key] || 0) * 100)}%</span>`;
      }
    }
    html += "</div>";
    return html;
  }

  function escapeHtml(value: string): string {
    return value.replace(/[&<>"]/g, (character) => {
      const replacements: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;"
      };
      return replacements[character];
    });
  }

  function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function loadSelectedDeck(): DeckKey {
    const stored = window.localStorage.getItem("coach.cardDeck");
    if (stored && DECKS.some((deck) => deck.key === stored)) {
      return stored as DeckKey;
    }
    return DEFAULT_DECK;
  }

  function persistSelectedDeck(deck: DeckKey): void {
    window.localStorage.setItem("coach.cardDeck", deck);
  }

  function loadSelectedBotStyle(): BotStyle {
    return normalizeBotStyle(window.localStorage.getItem("coach.botArchetype"));
  }

  function persistSelectedBotStyle(style: BotStyle): void {
    window.localStorage.setItem("coach.botArchetype", normalizeBotStyle(style));
  }

  function deckLabel(deck: DeckKey): string {
    return DECKS.find((entry) => entry.key === deck)?.label || deck;
  }

  return { init };
}
