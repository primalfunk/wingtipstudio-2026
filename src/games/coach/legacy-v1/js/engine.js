/* Heads-up NLHE game state machine.
 * Actors: 'hero' and 'bot'. In HU, the SB is the button and acts first preflop.
 *
 * State shape (mutated in place):
 * {
 *   sb, bb, startingStack,
 *   heroStack, botStack,
 *   heroHole[2], botHole[2],
 *   board[], deck[],
 *   pot,                 // locked-in from prior streets
 *   heroCommitted,       // chips forward THIS street
 *   botCommitted,
 *   currentBet,          // max committed THIS street (facing amount)
 *   minRaiseAmount,      // smallest legal raise increment
 *   street,              // preflop|flop|turn|river|showdown
 *   toAct,               // 'hero'|'bot'|null
 *   heroHasActed, botHasActed,
 *   lastAggressor,       // 'hero'|'bot'|null
 *   heroIsButton,        // alternates each hand
 *   handOver, result,
 *   actionHistory[]
 * }
 */
(function (global) {
  "use strict";

  const createDeck = global.POKER.createDeck;
  const shuffle = global.POKER.shuffle;

  function createState(opts) {
    opts = opts || {};
    return {
      sb: opts.sb || 10,
      bb: opts.bb || 20,
      startingStack: opts.startingStack || 1000,
      heroStack: opts.startingStack || 1000,
      botStack: opts.startingStack || 1000,
      heroHole: [], botHole: [],
      board: [], deck: [],
      pot: 0,
      heroCommitted: 0, botCommitted: 0,
      currentBet: 0,
      minRaiseAmount: opts.bb || 20,
      street: "idle",
      toAct: null,
      heroHasActed: false, botHasActed: false,
      lastAggressor: null,
      heroIsButton: opts.heroIsButton !== undefined ? !!opts.heroIsButton : true,
      handOver: false,
      result: null,
      actionHistory: [],
      handNumber: 0
    };
  }

  function startHand(state) {
    state.handNumber++;
    // Reset if a player is busted — replenish for training purposes.
    if (state.heroStack < state.bb) state.heroStack = state.startingStack;
    if (state.botStack < state.bb) state.botStack = state.startingStack;

    state.deck = shuffle(createDeck());
    state.heroHole = [state.deck.pop(), state.deck.pop()];
    state.botHole = [state.deck.pop(), state.deck.pop()];
    state.board = [];
    state.pot = 0;
    state.heroCommitted = 0;
    state.botCommitted = 0;
    state.minRaiseAmount = state.bb;
    state.heroHasActed = false;
    state.botHasActed = false;
    state.lastAggressor = null;
    state.handOver = false;
    state.result = null;
    state.actionHistory = [];
    state.street = "preflop";

    // Post blinds: SB is the button.
    if (state.heroIsButton) {
      postBlind(state, "hero", state.sb);
      postBlind(state, "bot", state.bb);
    } else {
      postBlind(state, "bot", state.sb);
      postBlind(state, "hero", state.bb);
    }
    state.currentBet = state.bb;
    state.toAct = state.heroIsButton ? "hero" : "bot";
  }

  function postBlind(state, actor, amount) {
    const stackKey = actor + "Stack";
    const commitKey = actor + "Committed";
    const amt = Math.min(amount, state[stackKey]);
    state[stackKey] -= amt;
    state[commitKey] += amt;
  }

  function potTotal(state) {
    return state.pot + state.heroCommitted + state.botCommitted;
  }

  function toCall(state, actor) {
    return state.currentBet - state[actor + "Committed"];
  }

  function legalActions(state) {
    if (state.handOver || !state.toAct) return {};
    const actor = state.toAct;
    const owe = toCall(state, actor);
    const stack = state[actor + "Stack"];
    const actions = {};

    if (owe > 0) actions.fold = true;
    if (owe === 0) actions.check = true;
    if (owe > 0) actions.call = { amount: Math.min(owe, stack) };

    // Bet/raise
    if (stack > 0) {
      if (owe === 0) {
        const minBet = Math.min(state.bb, stack);
        const maxBet = stack;
        if (maxBet >= minBet) actions.bet = { min: minBet, max: maxBet };
      } else if (stack > owe) {
        // Can raise
        const minRaiseTo = Math.min(state.currentBet + state.minRaiseAmount, state[actor + "Committed"] + stack);
        const maxRaiseTo = state[actor + "Committed"] + stack;
        if (maxRaiseTo > state.currentBet) {
          actions.raise = { min: minRaiseTo, max: maxRaiseTo };
        }
      }
    }
    return actions;
  }

  function applyAction(state, actor, action, amount) {
    if (state.handOver) throw new Error("Hand is over");
    if (state.toAct !== actor) throw new Error("Not your turn");

    const commitKey = actor + "Committed";
    const stackKey = actor + "Stack";
    const hasActedKey = actor + "HasActed";
    const oppHasActedKey = (actor === "hero" ? "bot" : "hero") + "HasActed";

    if (action === "fold") {
      state.actionHistory.push({ street: state.street, actor: actor, action: "fold" });
      const winner = actor === "hero" ? "bot" : "hero";
      const total = potTotal(state);
      state[winner + "Stack"] += total;
      state.handOver = true;
      state.result = { winner: winner, amount: total, reason: "fold" };
      state.toAct = null;
      return;
    }

    if (action === "check") {
      if (toCall(state, actor) > 0) throw new Error("Cannot check, must call or fold");
      state.actionHistory.push({ street: state.street, actor: actor, action: "check" });
      state[hasActedKey] = true;
    } else if (action === "call") {
      const owe = toCall(state, actor);
      const callAmt = Math.min(owe, state[stackKey]);
      state[stackKey] -= callAmt;
      state[commitKey] += callAmt;
      state.actionHistory.push({ street: state.street, actor: actor, action: "call", amount: callAmt });
      state[hasActedKey] = true;

      // If this call is short (actor all-in), refund excess to the other player.
      const opp = actor === "hero" ? "bot" : "hero";
      if (state[commitKey] < state[opp + "Committed"]) {
        const refund = state[opp + "Committed"] - state[commitKey];
        state[opp + "Committed"] -= refund;
        state[opp + "Stack"] += refund;
        state.currentBet = state[commitKey];
      }
    } else if (action === "bet" || action === "raise") {
      if (amount === undefined || amount === null || !isFinite(amount)) {
        throw new Error("Bet/raise requires a valid numeric amount");
      }
      const newTotal = Math.round(amount);
      const diff = newTotal - state[commitKey];
      if (diff <= 0) throw new Error("Raise must be larger than current commitment");
      if (diff > state[stackKey]) throw new Error("Not enough chips");
      const raiseIncrement = newTotal - state.currentBet;
      const allIn = diff === state[stackKey];
      if (raiseIncrement < state.minRaiseAmount && !allIn) {
        throw new Error("Raise must be at least to " + (state.currentBet + state.minRaiseAmount));
      }
      state[stackKey] -= diff;
      state[commitKey] = newTotal;
      state.currentBet = newTotal;
      if (raiseIncrement >= state.minRaiseAmount) state.minRaiseAmount = raiseIncrement;
      state.lastAggressor = actor;
      state.actionHistory.push({
        street: state.street, actor: actor, action: action, amount: newTotal
      });
      state[hasActedKey] = true;
      state[oppHasActedKey] = false; // reopen for opponent
    } else {
      throw new Error("Unknown action: " + action);
    }

    // Check if the street closes.
    const equal = state.heroCommitted === state.botCommitted;
    const bothActed = state.heroHasActed && state.botHasActed;
    const someoneAllIn = state.heroStack === 0 || state.botStack === 0;

    if (equal && (bothActed || (someoneAllIn && state[hasActedKey]))) {
      advanceStreet(state);
    } else {
      state.toAct = actor === "hero" ? "bot" : "hero";
    }
  }

  function advanceStreet(state) {
    state.pot += state.heroCommitted + state.botCommitted;
    state.heroCommitted = 0;
    state.botCommitted = 0;
    state.currentBet = 0;
    state.minRaiseAmount = state.bb;
    state.heroHasActed = false;
    state.botHasActed = false;
    state.lastAggressor = null;

    const order = ["preflop", "flop", "turn", "river", "showdown"];
    const next = order[order.indexOf(state.street) + 1];
    state.street = next;

    if (next === "flop") state.board = [state.deck.pop(), state.deck.pop(), state.deck.pop()];
    else if (next === "turn") state.board.push(state.deck.pop());
    else if (next === "river") state.board.push(state.deck.pop());
    else if (next === "showdown") { resolveShowdown(state); return; }

    // If anyone is all-in, run out remaining streets immediately.
    if (state.heroStack === 0 || state.botStack === 0) {
      state.heroHasActed = true;
      state.botHasActed = true;
      advanceStreet(state);
      return;
    }

    // BB acts first postflop (out of position).
    state.toAct = state.heroIsButton ? "bot" : "hero";
  }

  function resolveShowdown(state) {
    const evaluate = global.POKER.evaluate;
    const compare = global.POKER.compareHands;
    const describe = global.POKER.describeHand;

    const hs = evaluate(state.heroHole.concat(state.board));
    const bs = evaluate(state.botHole.concat(state.board));
    const cmp = compare(hs, bs);
    state.handOver = true;
    state.toAct = null;

    const pot = state.pot;
    if (cmp > 0) {
      state.heroStack += pot;
      state.result = {
        winner: "hero", amount: pot, reason: "showdown",
        heroHandName: describe(hs), botHandName: describe(bs)
      };
    } else if (cmp < 0) {
      state.botStack += pot;
      state.result = {
        winner: "bot", amount: pot, reason: "showdown",
        heroHandName: describe(hs), botHandName: describe(bs)
      };
    } else {
      const half = Math.floor(pot / 2);
      const odd = pot - half * 2;
      state.heroStack += half;
      state.botStack += half + odd; // odd chip to BB by convention; simplified here
      state.result = {
        winner: "tie", amount: pot, reason: "showdown",
        heroHandName: describe(hs), botHandName: describe(bs)
      };
    }
  }

  function switchButton(state) {
    state.heroIsButton = !state.heroIsButton;
  }

  global.POKER = global.POKER || {};
  global.POKER.engine = {
    createState: createState,
    startHand: startHand,
    applyAction: applyAction,
    legalActions: legalActions,
    potTotal: potTotal,
    toCall: toCall,
    switchButton: switchButton
  };
})(window);
