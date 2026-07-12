/* UI glue. Renders the table, handles input, drives the game loop. */
(function (global) {
  "use strict";

  const cardSVG = global.POKER.cardSVG;
  const engine = global.POKER.engine;
  const coach = global.POKER.coach;
  const bot = global.POKER.bot;
  const glossary = global.POKER.glossary;

  // -- App state -------------------------------------------------------------
  const ui = {
    state: null,
    botStyle: "balanced",
    lastRec: null,           // coach rec shown to the hero while they decide
    reveal: false,           // show bot cards (at showdown)
    coachLog: [],            // messages to render (per hand)
    session: {
      hands: 0,
      heroWins: 0,
      botWins: 0,
      ties: 0,
      netChips: 0,
      startingStack: 0,
      goodChoices: 0,
      mixedChoices: 0,
      badChoices: 0
    },
    pendingBotTimer: null
  };

  // -- Handy selectors -------------------------------------------------------
  const $ = function (id) { return document.getElementById(id); };

  // -- Initialization --------------------------------------------------------
  function init() {
    const bb = parseInt($("bb-size").value, 10) || 20;
    const startBB = parseInt($("starting-bb").value, 10) || 50;
    ui.state = engine.createState({
      sb: Math.floor(bb / 2),
      bb: bb,
      startingStack: bb * startBB,
      heroIsButton: true
    });
    ui.session.startingStack = bb * startBB;
    ui.botStyle = $("bot-style").value;

    wireEvents();
    if (glossary) {
      glossary.initTooltips();
      renderGlossaryList();
    }
    startNewHand();
  }

  function renderGlossaryList() {
    const el = $("glossary-list");
    if (!el || !glossary || !glossary.terms) return;
    const keys = Object.keys(glossary.terms).sort(function (a, b) {
      return glossary.terms[a].label.localeCompare(glossary.terms[b].label);
    });
    const parts = [];
    for (const k of keys) {
      const t = glossary.terms[k];
      parts.push(
        "<dt>" + esc(t.label) + "</dt>" +
        "<dd>" + esc(t.short) + "</dd>"
      );
    }
    el.innerHTML = parts.join("");
  }

  function wireEvents() {
    // Action buttons
    document.querySelectorAll(".action-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const a = btn.dataset.action;
        if (!a) return;
        handleHeroAction(a);
      });
    });
    // Sizing presets
    document.querySelectorAll(".sizing-preset").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const size = btn.dataset.size;
        applySizingPreset(size);
      });
    });
    // Slider
    $("bet-slider").addEventListener("input", function () {
      updateBetDisplay();
    });
    // Next hand button
    $("next-hand-btn").addEventListener("click", function () {
      engine.switchButton(ui.state);
      startNewHand();
    });
    // Settings
    $("bot-style").addEventListener("change", function (e) {
      ui.botStyle = e.target.value;
      logCoach("<p class='tip'>Opponent style set to <strong>" + capitalize(ui.botStyle) + "</strong>.</p>");
    });
    $("new-session").addEventListener("click", function () {
      resetSession();
    });
  }

  function resetSession() {
    if (ui.pendingBotTimer) clearTimeout(ui.pendingBotTimer);
    ui.session = {
      hands: 0, heroWins: 0, botWins: 0, ties: 0,
      netChips: 0, startingStack: 0,
      goodChoices: 0, mixedChoices: 0, badChoices: 0
    };
    init();
  }

  // -- Hand flow -------------------------------------------------------------
  function startNewHand() {
    ui.reveal = false;
    ui.coachLog = [];
    ui.lastRec = null;
    updateCoachMetrics(null);
    engine.startHand(ui.state);
    $("hand-summary-body").innerHTML = "<p>Hand in progress…</p>";
    $("next-hand-btn").hidden = true;
    logCoach(handIntroMessage());
    render();
    tick();
  }

  function handIntroMessage() {
    const heroIsBtn = ui.state.heroIsButton;
    return "<p><strong>Hand #" + ui.state.handNumber + ".</strong> " +
      "You are " + (heroIsBtn ? "on the button (SB)." : "in the big blind.") + " " +
      "Blinds are " + ui.state.sb + "/" + ui.state.bb + ". " +
      "Stacks around " + Math.round(ui.state.heroStack / ui.state.bb) + "bb.</p>";
  }

  // The central pump: advances the game by letting whoever's turn it is act.
  function tick() {
    render();
    if (ui.state.handOver) {
      finishHand();
      return;
    }
    if (ui.state.toAct === "bot") {
      disableActions();
      if (ui.pendingBotTimer) clearTimeout(ui.pendingBotTimer);
      ui.pendingBotTimer = setTimeout(runBotTurn, 700);
    } else if (ui.state.toAct === "hero") {
      showHeroRecommendation();
      updateActionBar();
    }
  }

  function runBotTurn() {
    const decision = bot.decide(ui.state, ui.botStyle);
    try {
      engine.applyAction(ui.state, "bot", decision.action, decision.amount);
    } catch (err) {
      // Safety net: fall back to check/fold
      const legal = engine.legalActions(ui.state);
      if (legal.check) engine.applyAction(ui.state, "bot", "check");
      else if (legal.fold) engine.applyAction(ui.state, "bot", "fold");
    }
    logCoach(describeBotAction(decision));
    tick();
  }

  function describeBotAction(decision) {
    const a = decision.action;
    let line = "<p><em>Opponent ";
    if (a === "fold") line += "folds.";
    else if (a === "check") line += "checks.";
    else if (a === "call") line += "calls.";
    else if (a === "bet") line += "bets " + decision.amount + ".";
    else if (a === "raise") line += "raises to " + decision.amount + ".";
    else line += a + ".";
    line += "</em></p>";
    return line;
  }

  function showHeroRecommendation() {
    const rec = coach.recommend(ui.state, "hero");
    ui.lastRec = rec;
    updateCoachMetrics(rec);
    if (!rec) return;
    const r = rec.reasoning;
    let html = "<div class='coach-block'>";
    html += "<p>" + esc(r.situation) + "</p>";
    html += "<p>" + esc(r.hand) + "</p>";
    if (r.analysis) html += "<p>" + esc(r.analysis) + "</p>";
    html += "<p>" + esc(r.recommendation) + "</p>";
    html += renderMixBars(rec.probs);
    if (r.tip) html += "<div class='tip'>" + esc(r.tip) + "</div>";
    html += "</div>";
    logCoach(html);
  }

  function handleHeroAction(uiAction) {
    if (ui.state.toAct !== "hero" || ui.state.handOver) return;

    const legal = engine.legalActions(ui.state);
    let engineAction, amount;

    if (uiAction === "fold") {
      if (!legal.fold) return;
      engineAction = "fold";
    } else if (uiAction === "check-call") {
      if (legal.check) engineAction = "check";
      else if (legal.call) engineAction = "call";
      else return;
    } else if (uiAction === "bet-raise") {
      const dollars = parseInt($("bet-amount-display").textContent.replace(/[^0-9]/g, ""), 10) || 0;
      if (legal.bet) { engineAction = "bet"; amount = dollars; }
      else if (legal.raise) { engineAction = "raise"; amount = dollars; }
      else return;
      // Clamp
      if (amount) {
        const rg = legal[engineAction];
        if (rg && rg.min !== undefined) amount = Math.max(rg.min, Math.min(rg.max, amount));
      }
    } else {
      return;
    }

    // Evaluate against the recommendation we showed.
    if (ui.lastRec) {
      const ev = coach.evaluate(engineAction, ui.lastRec);
      if (ev.tone === "good") ui.session.goodChoices++;
      else if (ev.tone === "mixed") ui.session.mixedChoices++;
      else ui.session.badChoices++;
      logCoach(renderVerdict(ev, engineAction, amount));
    }

    try {
      engine.applyAction(ui.state, "hero", engineAction, amount);
    } catch (err) {
      logCoach("<p class='tip'>Couldn't apply action: " + esc(err.message) + "</p>");
      return;
    }
    ui.lastRec = null;
    tick();
  }

  function renderVerdict(ev, action, amount) {
    const toneClass = ev.tone === "good" ? "" : (ev.tone === "mixed" ? "mixed" : "bad");
    let text = "<div class='coach-block'>";
    text += "<p class='coach-verdict " + toneClass + "'>Your action: " + esc(describeAction(action, amount)) +
            " &middot; " + esc(ev.verdict) + "</p>";
    text += "<p>" + esc(ev.explanation) + " (Recommendation weight: " +
            Math.round(ev.probability * 100) + "%.)</p>";
    text += "</div>";
    return text;
  }

  function describeAction(action, amount) {
    if (action === "fold") return "Fold";
    if (action === "check") return "Check";
    if (action === "call") return "Call";
    if (action === "bet") return "Bet " + amount;
    if (action === "raise") return "Raise to " + amount;
    return action;
  }

  // -- Action bar updates ----------------------------------------------------

  function updateActionBar() {
    const legal = engine.legalActions(ui.state);
    const foldBtn = document.querySelector("[data-action='fold']");
    const callBtn = document.querySelector("[data-action='check-call']");
    const betBtn = document.querySelector("[data-action='bet-raise']");

    foldBtn.disabled = !legal.fold;

    if (legal.check) {
      callBtn.textContent = "Check";
      callBtn.disabled = false;
    } else if (legal.call) {
      callBtn.textContent = "Call " + engine.toCall(ui.state, "hero");
      callBtn.disabled = false;
    } else {
      callBtn.textContent = "Check";
      callBtn.disabled = true;
    }

    const range = legal.bet || legal.raise;
    betBtn.textContent = legal.bet ? "Bet" : "Raise";
    betBtn.disabled = !range;
    if (range) {
      const slider = $("bet-slider");
      slider.min = range.min;
      slider.max = range.max;
      if (parseInt(slider.value, 10) < range.min || parseInt(slider.value, 10) > range.max) {
        slider.value = Math.min(range.max, Math.max(range.min, suggestedSize()));
      }
      updateBetDisplay();
      document.querySelectorAll(".sizing-preset").forEach(function (b) { b.disabled = false; });
    } else {
      document.querySelectorAll(".sizing-preset").forEach(function (b) { b.disabled = true; });
      $("bet-amount-display").textContent = "—";
    }
  }

  function suggestedSize() {
    if (!ui.lastRec || !ui.lastRec.sizing) return 0;
    return Math.round(ui.lastRec.sizing.bet || ui.lastRec.sizing.raise || 0);
  }

  function applySizingPreset(preset) {
    const legal = engine.legalActions(ui.state);
    const range = legal.bet || legal.raise;
    if (!range) return;
    const fracs = { third: 1 / 3, half: 0.5, "three-quarter": 0.75, pot: 1 };
    const pot = engine.potTotal(ui.state);
    const owe = engine.toCall(ui.state, "hero");
    const basePot = pot + owe; // pot after our call (a standard reference)
    let target;
    if (preset === "allin") {
      target = range.max;
    } else if (legal.bet) {
      target = Math.round(basePot * (fracs[preset] || 0.5));
    } else {
      // Raising: pot-fraction refers to the raise increment ON TOP of a call.
      target = ui.state.currentBet + Math.round(basePot * (fracs[preset] || 0.5));
    }
    target = Math.max(range.min, Math.min(range.max, target));
    $("bet-slider").value = target;
    updateBetDisplay();
  }

  function updateBetDisplay() {
    $("bet-amount-display").textContent = $("bet-slider").value;
  }

  function disableActions() {
    document.querySelectorAll(".action-btn").forEach(function (b) { b.disabled = true; });
    document.querySelectorAll(".sizing-preset").forEach(function (b) { b.disabled = true; });
  }

  // -- Hand finish -----------------------------------------------------------

  function finishHand() {
    ui.reveal = true;
    updateCoachMetrics(null);
    render();

    const r = ui.state.result;
    const heroDelta = (ui.state.heroStack - ui.session.startingStack) -
                      ui.session.netChips;
    // Note: netChips tracks total hero net vs startingStack reference.
    updateSessionStatsFromHand();

    const summary = buildHandSummary(r);
    logCoach(summary);
    $("hand-summary-body").innerHTML = summary;
    $("next-hand-btn").hidden = false;
    updateActionBar();
    disableActions();
    $("next-hand-btn").disabled = false;
    renderSessionSummary();
  }

  function buildHandSummary(r) {
    let html = "<p><strong>Hand result:</strong> ";
    if (!r) html += "n/a";
    else if (r.reason === "fold") {
      html += (r.winner === "hero" ? "You win " : "Opponent wins ") + r.amount + " (opponent folded).";
    } else {
      html += (r.winner === "hero" ? "You win " : r.winner === "bot" ? "Opponent wins " : "Split pot, ") +
              r.amount + " at showdown.<br>";
      html += "Your hand: " + esc(r.heroHandName) + "<br>";
      html += "Opponent's hand: " + esc(r.botHandName);
    }
    html += "</p>";
    html += "<p>Stacks: You " + ui.state.heroStack + " / Opponent " + ui.state.botStack + ".</p>";
    return html;
  }

  function updateSessionStatsFromHand() {
    const s = ui.session;
    s.hands++;
    const r = ui.state.result;
    if (r) {
      if (r.winner === "hero") s.heroWins++;
      else if (r.winner === "bot") s.botWins++;
      else s.ties++;
    }
    s.netChips = ui.state.heroStack - s.startingStack;
  }

  function renderSessionSummary() {
    const s = ui.session;
    const total = s.goodChoices + s.mixedChoices + s.badChoices;
    const agreement = total ? Math.round((s.goodChoices / total) * 100) : 0;
    const netBB = Math.round(s.netChips / ui.state.bb);
    const html = "<dl>" +
      "<dt>Hands played</dt><dd>" + s.hands + "</dd>" +
      "<dt>Won / Lost / Tied</dt><dd>" + s.heroWins + " / " + s.botWins + " / " + s.ties + "</dd>" +
      "<dt>Net</dt><dd>" + (netBB >= 0 ? "+" : "") + netBB + " bb (" + s.netChips + " chips)</dd>" +
      "<dt>Coach agreement</dt><dd>" + agreement + "% (" + s.goodChoices + " solid, " +
          s.mixedChoices + " mixed, " + s.badChoices + " off)</dd>" +
    "</dl>";
    $("session-summary").innerHTML = html;
  }

  // -- Rendering the table ---------------------------------------------------

  function render() {
    const s = ui.state;

    // Stacks
    $("hero-stack").textContent = s.heroStack + " (" + Math.round(s.heroStack / s.bb) + " bb)";
    $("opp-stack").textContent = s.botStack + " (" + Math.round(s.botStack / s.bb) + " bb)";

    // Chips committed this street
    $("hero-commit").textContent = s.heroCommitted ? ("+" + s.heroCommitted) : "";
    $("opp-commit").textContent = s.botCommitted ? ("+" + s.botCommitted) : "";

    // Pot
    $("pot-amount").textContent = s.pot + (s.heroCommitted || s.botCommitted ? " (+" + (s.heroCommitted + s.botCommitted) + ")" : "");

    // Street label
    $("street-label").textContent = labelForStreet(s.street) + (s.heroIsButton ? " · You are Button (SB)" : " · Opponent is Button (SB)");

    // Cards
    $("hero-cards").innerHTML = renderHole(s.heroHole, false);
    $("opp-cards").innerHTML = renderHole(s.botHole, !ui.reveal);
    $("board").innerHTML = renderBoard(s.board);

    // Whose turn highlight (simple: change avatar color via class)
    $("seat-hero").classList.toggle("is-turn", s.toAct === "hero");
    $("seat-opponent").classList.toggle("is-turn", s.toAct === "bot");

    // Dealer button: in heads-up the SB (button) is either hero or bot.
    $("hero-avatar").classList.toggle("has-button", !!s.heroIsButton);
    $("opp-avatar").classList.toggle("has-button", !s.heroIsButton);
  }

  function renderHole(cards, faceDown) {
    if (!cards || !cards.length) {
      return cardSVG(null, { faceDown: true }) + cardSVG(null, { faceDown: true });
    }
    return cards.map(function (c) { return cardSVG(c, { faceDown: faceDown }); }).join("");
  }

  function renderBoard(board) {
    const slots = [];
    for (let i = 0; i < 5; i++) {
      if (board[i]) slots.push(cardSVG(board[i]));
      else slots.push('<div class="card-slot" style="width:58px;height:82px;"></div>');
    }
    return slots.join("");
  }

  function labelForStreet(s) {
    return { preflop: "Preflop", flop: "Flop", turn: "Turn", river: "River", showdown: "Showdown", idle: "" }[s] || s;
  }

  // -- Coach log rendering ---------------------------------------------------

  function logCoach(html) {
    // Auto-annotate jargon terms in coach output.
    if (glossary && typeof glossary.annotate === "function") {
      html = glossary.annotate(html);
    }
    ui.coachLog.push(html);
    if (ui.coachLog.length > 12) ui.coachLog.shift();
    const body = $("coach-body");
    body.innerHTML = ui.coachLog.join("");
    body.scrollTop = body.scrollHeight;
  }

  function updateCoachMetrics(rec) {
    const el = $("coach-metrics");
    if (!el) return;
    if (!rec || rec.equity === undefined) {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }
    const parts = [];
    if (rec.pot !== undefined) {
      parts.push('<span class="metric"><label>Pot</label><b>' + rec.pot + "</b></span>");
    }
    if (rec.owe !== undefined && rec.owe > 0) {
      parts.push('<span class="metric"><label>To call</label><b>' + rec.owe + "</b></span>");
    }
    parts.push('<span class="metric highlight"><label>Equity</label><b>' +
      Math.round((rec.equity || 0) * 100) + "%</b></span>");
    if (rec.potOdds !== undefined && rec.owe > 0) {
      parts.push('<span class="metric"><label>Pot odds</label><b>' +
        Math.round(rec.potOdds * 100) + "%</b></span>");
    }
    el.innerHTML = parts.join("");
    el.hidden = false;
  }

  function renderMixBars(probs) {
    const order = ["fold", "check", "call", "bet", "raise"];
    let html = "<div class='mix-bars'>";
    for (const k of order) {
      if (probs[k] !== undefined && probs[k] > 0) {
        const cls = (k === "fold") ? "mix-fold" : (k === "raise" || k === "bet" ? "mix-raise" : "mix-call");
        html += "<span class='" + cls + "'>" + capitalize(k) + " " + Math.round(probs[k] * 100) + "%</span>";
      }
    }
    html += "</div>";
    return html;
  }

  function esc(s) {
    if (s === null || s === undefined) return "";
    return String(s).replace(/[&<>"]/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
    });
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // -- Boot ------------------------------------------------------------------

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  global.POKER = global.POKER || {};
  global.POKER.ui = ui;
})(window);
