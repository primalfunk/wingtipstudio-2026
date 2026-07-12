/* Jargon glossary with desktop hover tooltips.
 *
 * Exposes POKER.glossary:
 *   annotate(html)   -> html with the first occurrence of each known term
 *                       wrapped in <span class="term" data-term=KEY>.
 *                       Skips content inside existing HTML tags and already-
 *                       wrapped terms. Uses non-letter boundaries so "50bb"
 *                       and "3-bet" match cleanly.
 *   initTooltips()   -> binds delegated mouseover/focus listeners to show a
 *                       single shared popover. Desktop-only (no click-to-pin).
 *   terms            -> the raw map so UI can render a full glossary panel.
 */
(function (global) {
  "use strict";

  const GLOSSARY = {
    // -- Positions & blinds --
    sb: {
      label: "Small Blind (SB)",
      short: "The smaller of the two forced bets posted before cards are dealt. In heads-up, the SB sits on the button — first to act preflop, last on every later street."
    },
    bb: {
      label: "Big Blind (BB)",
      short: "The larger of the two forced bets. \"BB\" is also used as a unit of stack size — \"50bb\" means 50 big blinds deep."
    },
    button: {
      label: "Button",
      short: "The dealer position. In heads-up, the button is always the small blind — first to act preflop, last postflop (a big advantage)."
    },
    blinds: {
      label: "Blinds",
      short: "The forced bets posted each hand. They keep action moving — without them, folding every hand would be free."
    },
    headsup: {
      label: "Heads-up (HU)",
      short: "A two-player game. Ranges widen because there are fewer hands that can beat you, and position matters every street."
    },

    // -- Streets --
    preflop: {
      label: "Preflop",
      short: "Before any community cards are dealt. Action begins with the SB in heads-up."
    },
    flop: {
      label: "Flop",
      short: "The first three community cards, dealt face-up together after preflop betting."
    },
    turn: {
      label: "Turn",
      short: "The fourth community card. Pot sizes usually grow here since players have a clearer read on their equity."
    },
    river: {
      label: "River",
      short: "The fifth and final community card. Every hand is fully realized — no more outs, only made hands."
    },
    showdown: {
      label: "Showdown",
      short: "When all betting is done and remaining players reveal their hole cards to decide the winner."
    },

    // -- Pot / odds / equity --
    pot: {
      label: "Pot",
      short: "The total chips being contested in the current hand — it's what the winner takes."
    },
    potodds: {
      label: "Pot odds",
      short: "The price you're getting on a call: amount to call \u00f7 (pot + amount to call). If your equity is higher than your pot-odds %, calling is profitable."
    },
    equity: {
      label: "Equity",
      short: "Your share of the pot if the hand were run out many times from here — essentially your chance of winning at showdown."
    },
    range: {
      label: "Range",
      short: "The full set of hands a player could have in this spot, not one specific holding. Good play is balanced across a range, not optimized for any single hand."
    },

    // -- Actions --
    fold: {
      label: "Fold",
      short: "Give up the hand. You lose whatever you've already put in, but avoid further risk."
    },
    check: {
      label: "Check",
      short: "Pass the action without betting. Only legal when there's no bet to call."
    },
    call: {
      label: "Call",
      short: "Match the current bet to stay in the hand."
    },
    bet: {
      label: "Bet",
      short: "Put chips in when no one has bet yet on this street. If someone has already bet, increasing it is called a raise."
    },
    raise: {
      label: "Raise",
      short: "Increase an existing bet. A legal raise must be at least the size of the previous bet or raise on this street."
    },
    threebet: {
      label: "3-bet",
      short: "A reraise preflop. The BB is the 1-bet, the opening raise is the 2-bet, so reraising is a 3-bet."
    },
    allin: {
      label: "All-in",
      short: "Betting or calling with your entire remaining stack. Once everyone's all-in, remaining cards just run out to showdown."
    },
    cbet: {
      label: "Continuation bet (c-bet)",
      short: "When the preflop aggressor bets again on the flop. Works because a raiser's range has lots of overcards and big pairs that hit many flops."
    },
    checkraise: {
      label: "Check-raise",
      short: "Check to the opponent, then raise when they bet. A strong line that represents a made hand or a powerful semi-bluff."
    },
    minraise: {
      label: "Min-raise",
      short: "The smallest legal raise — exactly doubling the previous bet."
    },

    // -- Position --
    position: {
      label: "Position",
      short: "Where you sit in the betting order. \"In position\" means you act last — a big edge because you see opponents' actions before you decide."
    },
    ip: {
      label: "In position (IP)",
      short: "Acting last on the current street — you see the opponent's action before deciding."
    },
    oop: {
      label: "Out of position (OOP)",
      short: "Acting first on the current street — you have to act blind to the opponent's move."
    },

    // -- Hand shapes --
    suited: {
      label: "Suited",
      short: "Two hole cards of the same suit, written with an \"s\" like AKs. Suited hands flop flushes and flush draws more often."
    },
    offsuit: {
      label: "Offsuit",
      short: "Two hole cards of different suits, written with an \"o\" like AKo. A bit weaker than the suited version because you miss flush potential."
    },
    connector: {
      label: "Connector",
      short: "Two adjacent-rank cards (like 87 or JT). They make straights on more board textures than gapped hands."
    },
    gapper: {
      label: "Gapper",
      short: "Two hole cards with a small rank gap (like 97 or T7). Still playable because they can make straights, just with fewer connecting cards."
    },
    broadway: {
      label: "Broadway",
      short: "The high cards: Ten, Jack, Queen, King, Ace. \"Broadway hands\" are two broadway cards like KQ or QT."
    },
    pocketpair: {
      label: "Pocket pair",
      short: "Two hole cards of the same rank, like 99. Strong starting hands because they already make a pair — the board just needs to behave."
    },
    overpair: {
      label: "Overpair",
      short: "A pocket pair higher than every card on the board — e.g. QQ on a J-7-3 flop. Usually a big value hand."
    },
    toppair: {
      label: "Top pair",
      short: "Pairing the highest card on the board with one of your hole cards. Strength depends heavily on the kicker."
    },
    overcards: {
      label: "Overcards",
      short: "Hole cards higher than any card on the board. No pair yet, but each overcard gives 3 outs to make top pair."
    },
    premium: {
      label: "Premium",
      short: "The strongest starting hands: AA, KK, QQ, AK (and sometimes JJ, AQs). Always happy to get chips in preflop."
    },

    // -- Draws / outs --
    flushdraw: {
      label: "Flush draw",
      short: "Four cards of the same suit, needing one more to complete a flush. About 36% equity to complete by the river from the flop."
    },
    straightdraw: {
      label: "Straight draw",
      short: "Four consecutive ranks needing one more to make a straight. \"Open-ended\" has 8 outs; a \"gutshot\" has 4."
    },
    draw: {
      label: "Draw",
      short: "A hand that isn't made yet but can improve on later streets — most commonly a straight or flush draw."
    },
    outs: {
      label: "Outs",
      short: "The specific unseen cards that improve your hand to the likely winner. Rule of thumb: outs \u00d7 2 per street remaining \u2248 your equity %."
    },

    // -- Board texture --
    drytexture: {
      label: "Dry board",
      short: "A flop with few draws and little coordination (e.g. K-7-2 rainbow). Favors whoever already has a made hand."
    },
    wettexture: {
      label: "Wet board",
      short: "A flop loaded with straight and flush possibilities (e.g. 9h-8h-7d). More action, more swings."
    },
    pairedboard: {
      label: "Paired board",
      short: "A board where two community cards match rank (e.g. K-K-4). Reduces the number of combos each player can have."
    },
    monotone: {
      label: "Monotone board",
      short: "A board where every visible card shares one suit. A single matching card is already a flush draw."
    },
    rainbow: {
      label: "Rainbow board",
      short: "A board where every card is a different suit. Flushes are very unlikely to come in."
    },
    twotone: {
      label: "Two-tone board",
      short: "A board with exactly two suits present, creating the possibility of flush draws."
    },

    // -- Bet types --
    valuebet: {
      label: "Value bet",
      short: "A bet made expecting to be called by worse hands. You're betting to get paid, not to fold anyone out."
    },
    bluff: {
      label: "Bluff",
      short: "Betting or raising with a weak hand trying to make a better hand fold."
    },
    semibluff: {
      label: "Semi-bluff",
      short: "A bluff with backup equity — e.g. betting a flush draw. If called, you can still improve on later streets."
    },

    // -- Stack depth --
    stack: {
      label: "Stack",
      short: "The chips a player has in front of them, available to bet."
    },
    deepstack: {
      label: "Deep stack",
      short: "Stacks much larger than the blinds (100bb+). Postflop play matters more because there's lots of room to maneuver."
    },
    shortstack: {
      label: "Short stack",
      short: "Stacks small relative to the blinds (under ~25bb). Play simplifies — mostly all-in-or-fold decisions preflop."
    }
  };

  // Which phrases map to each term key. Each term may have multiple phrases;
  // they are matched case-insensitively. Longer phrases are preferred first
  // within a term's regex.
  const PHRASES = {
    sb: ["small blind", "SB"],
    bb: ["big blind", "BB"],
    button: ["on the button", "dealer button", "the button", "button"],
    blinds: ["blinds"],
    headsup: ["heads-up", "heads up"],
    preflop: ["preflop", "pre-flop"],
    flop: ["flop"],
    turn: ["turn"],
    river: ["river"],
    showdown: ["showdown"],
    pot: ["pot"],
    potodds: ["pot odds"],
    equity: ["equity"],
    range: ["defending range", "opening range", "range"],
    fold: ["fold"],
    check: ["check"],
    call: ["call"],
    bet: ["bet"],
    raise: ["raise"],
    threebet: ["3-bet", "3bet", "three-bet"],
    allin: ["all-in", "all in"],
    cbet: ["continuation bet", "c-bet", "cbet"],
    checkraise: ["check-raise", "check raise"],
    minraise: ["min-raise", "minimum raise"],
    position: ["in position", "out of position", "position"],
    ip: ["IP"],
    oop: ["OOP"],
    suited: ["suited"],
    offsuit: ["offsuit"],
    connector: ["suited connector", "offsuit connector", "connector"],
    gapper: ["suited gapper", "gapper"],
    broadway: ["broadway"],
    pocketpair: ["pocket pair"],
    overpair: ["overpair"],
    toppair: ["top pair"],
    overcards: ["overcards"],
    premium: ["premium"],
    flushdraw: ["flush draw"],
    straightdraw: ["straight draw"],
    draw: ["draw"],
    outs: ["outs"],
    drytexture: ["dry board", "dry"],
    wettexture: ["wet board", "wet"],
    pairedboard: ["paired board", "paired"],
    monotone: ["monotone"],
    rainbow: ["rainbow"],
    twotone: ["two-tone"],
    valuebet: ["value bet", "for value"],
    bluff: ["bluff"],
    semibluff: ["semi-bluff"],
    stack: ["stack"],
    deepstack: ["deep stack"],
    shortstack: ["short stack"]
  };

  // -- Regex pre-compilation ------------------------------------------------

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  const TERM_KEYS = Object.keys(PHRASES);
  const TERM_RX = {};       // key -> compiled regex
  const LONGEST_PHRASE = {}; // key -> number (chars in longest phrase)
  TERM_KEYS.forEach(function (k) {
    const sorted = PHRASES[k].slice().sort(function (a, b) { return b.length - a.length; });
    const pattern = sorted.map(escapeRegex).join("|");
    // Allow an optional trailing "s" for common plurals (stacks, ranges,
    // pots, bets, raises, calls, folds, rivers, flops, bluffs, draws, …).
    TERM_RX[k] = new RegExp("(?<![A-Za-z])(?:" + pattern + ")s?(?![A-Za-z])", "i");
    LONGEST_PHRASE[k] = sorted[0].length;
  });

  // Process terms in order of their longest phrase, descending — ensures
  // multi-word phrases like "pot odds" match before the single word "pot".
  const ORDERED_KEYS = TERM_KEYS.slice().sort(function (a, b) {
    return LONGEST_PHRASE[b] - LONGEST_PHRASE[a];
  });

  // -- Annotator ------------------------------------------------------------

  function annotate(html) {
    if (!html) return html;
    const used = {};

    for (let t = 0; t < ORDERED_KEYS.length; t++) {
      const key = ORDERED_KEYS[t];
      if (used[key]) continue;
      const rx = TERM_RX[key];

      // Re-split each pass: previously injected spans become their own tag
      // parts so we never re-enter them.
      const parts = html.split(/(<[^>]*>)/g);
      let found = false;
      let termDepth = 0;

      for (let i = 0; i < parts.length && !found; i++) {
        const seg = parts[i];
        if (!seg) continue;

        if (seg.charAt(0) === "<") {
          // Tag: track whether we're inside an already-wrapped term span.
          if (seg.indexOf("<span") === 0 && seg.indexOf('class="term"') !== -1) {
            termDepth++;
          } else if (/^<\/span>/i.test(seg) && termDepth > 0) {
            termDepth--;
          }
          continue;
        }

        if (termDepth > 0) continue;

        const m = rx.exec(seg);
        if (!m) continue;
        const matched = m[0];
        const idx = m.index;
        parts[i] = seg.slice(0, idx) +
          '<span class="term" data-term="' + key + '" tabindex="0">' +
          matched +
          "</span>" +
          seg.slice(idx + matched.length);
        found = true;
      }

      if (found) {
        used[key] = true;
        html = parts.join("");
      }
    }

    return html;
  }

  // -- Tooltip presentation -------------------------------------------------

  let tipEl = null;

  function ensureTip() {
    if (tipEl) return tipEl;
    tipEl = document.createElement("div");
    tipEl.className = "term-tooltip";
    tipEl.setAttribute("role", "tooltip");
    tipEl.style.display = "none";
    document.body.appendChild(tipEl);
    return tipEl;
  }

  function show(anchor) {
    const key = anchor.getAttribute("data-term");
    const entry = GLOSSARY[key];
    if (!entry) return;
    const t = ensureTip();
    t.innerHTML =
      '<div class="term-label">' + entry.label + "</div>" +
      '<div class="term-short">' + entry.short + "</div>";
    position(anchor, t);
  }

  function hide() {
    if (tipEl) tipEl.style.display = "none";
  }

  function position(anchor, t) {
    const rect = anchor.getBoundingClientRect();
    // Display hidden-but-laid-out so we can measure.
    t.style.visibility = "hidden";
    t.style.display = "block";
    const tw = t.offsetWidth;
    const th = t.offsetHeight;
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const vw = document.documentElement.clientWidth || window.innerWidth;

    let top = rect.bottom + scrollY + 8;
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < th + 16 && rect.top > th + 16) {
      top = rect.top + scrollY - th - 8;
    }
    let left = rect.left + scrollX + rect.width / 2 - tw / 2;
    const minLeft = 8 + scrollX;
    const maxLeft = vw - tw - 8 + scrollX;
    if (left < minLeft) left = minLeft;
    if (left > maxLeft) left = maxLeft;

    t.style.top = top + "px";
    t.style.left = left + "px";
    t.style.visibility = "";
  }

  function initTooltips() {
    document.addEventListener("mouseover", function (e) {
      const t = e.target && e.target.closest ? e.target.closest(".term") : null;
      if (t) show(t);
    });
    document.addEventListener("mouseout", function (e) {
      const t = e.target && e.target.closest ? e.target.closest(".term") : null;
      if (t) hide();
    });
    document.addEventListener("focusin", function (e) {
      const t = e.target && e.target.closest ? e.target.closest(".term") : null;
      if (t) show(t);
    });
    document.addEventListener("focusout", function (e) {
      const t = e.target && e.target.closest ? e.target.closest(".term") : null;
      if (t) hide();
    });
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
  }

  // -- Export ---------------------------------------------------------------
  global.POKER = global.POKER || {};
  global.POKER.glossary = {
    annotate: annotate,
    initTooltips: initTooltips,
    terms: GLOSSARY
  };
})(window);
