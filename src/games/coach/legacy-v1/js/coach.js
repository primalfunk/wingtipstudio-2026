/* Coach: produces recommendations and verbose beginner-friendly explanations.
 *
 * Exposed:
 *   POKER.coach.recommend(state, actor) -> {
 *     probs: { fold?, check?, call?, bet?, raise? },
 *     sizing: { bet?, raise? }, // total-to amounts
 *     equity?, potOdds?, pot?, owe?,
 *     reasoning: { situation, hand, analysis, recommendation, tip, mixLabel },
 *     phase: 'preflop' | 'postflop'
 *   }
 *   POKER.coach.evaluate(action, amount, rec, state) -> { verdict, tone, explanation }
 */
(function (global) {
  "use strict";

  const RV = global.POKER.RANK_VALUE;
  const labelsToCombos = global.POKER.labelsToCombos;
  const allHandLabels = global.POKER.allHandLabels;
  const handStrength = global.POKER.handStrength;
  const handStrengthFromLabel = global.POKER.handStrengthFromLabel;
  const describeHandClass = global.POKER.describeHandClass;
  const equityVsRange = global.POKER.equityVsRange;
  const engine = global.POKER.engine;
  const handLabel = global.POKER.handLabel;
  const sbOpenLabels = global.POKER.sbOpenLabels;
  const bbThreeBetLabels = global.POKER.bbThreeBetLabels;
  const bbCallLabels = global.POKER.bbCallLabels;

  function isButton(state, actor) {
    return (actor === "hero") === state.heroIsButton;
  }

  function lastPreflopAction(state, actor) {
    let last = null;
    for (const h of state.actionHistory) {
      if (h.street === "preflop" && h.actor === actor) last = h;
    }
    return last;
  }

  // Infer opponent's range from preflop action history.
  function inferOppPreflopRange(state, heroActor) {
    const opp = heroActor === "hero" ? "bot" : "hero";
    const oppIsBtn = !isButton(state, heroActor);
    const last = lastPreflopAction(state, opp);

    if (!last) {
      // Opponent hasn't acted preflop yet (they may be BB still facing our open).
      // Reasonable default: all hands they'd continue with.
      return { combos: labelsToCombos(bbCallLabels().concat(bbThreeBetLabels())), label: "full defending range" };
    }

    if (oppIsBtn) {
      // Opp was SB; last preflop action is the opener action.
      if (last.action === "raise" || last.action === "bet") {
        return { combos: labelsToCombos(sbOpenLabels()), label: "SB opening range (~65% of hands)" };
      }
      if (last.action === "call") {
        // SB limp — unusual; estimate a mid-tier range
        const limpRange = allHandLabels().filter(function (l) {
          const s = handStrengthFromLabel(l);
          return s >= 3 && s < 6;
        });
        return { combos: labelsToCombos(limpRange), label: "limping range (mid-tier hands)" };
      }
    } else {
      // Opp was BB; last action defines their defend range.
      if (last.action === "raise") {
        return { combos: labelsToCombos(bbThreeBetLabels()), label: "BB 3-bet range (~top 10%)" };
      }
      if (last.action === "call") {
        return { combos: labelsToCombos(bbCallLabels()), label: "BB flatting range" };
      }
      if (last.action === "check") {
        return { combos: labelsToCombos(allHandLabels()), label: "BB's full range (checked option)" };
      }
    }
    return { combos: labelsToCombos(allHandLabels()), label: "full range" };
  }

  // -- Board texture ---------------------------------------------------------

  function describeBoard(board) {
    if (!board.length) return { label: "", detail: "", flushRisk: false, straightRisk: false };
    const ranks = board.map(function (c) { return RV[c[0]]; }).sort(function (a, b) { return b - a; });
    const suits = board.map(function (c) { return c[1]; });
    const suitCounts = {};
    suits.forEach(function (s) { suitCounts[s] = (suitCounts[s] || 0) + 1; });
    const maxSuit = Math.max.apply(null, Object.values(suitCounts));
    const uniqueRanks = new Set(ranks).size;
    const paired = uniqueRanks < ranks.length;
    const high = ranks[0];
    const lowestSpan = ranks[0] - ranks[ranks.length - 1];

    const parts = [];
    if (paired) parts.push("paired");
    if (maxSuit === board.length && board.length >= 3) parts.push("monotone");
    else if (maxSuit >= 2) parts.push("two-tone");
    else parts.push("rainbow");

    if (!paired && lowestSpan <= 4) parts.push("connected");
    if (high >= 12) parts.push("high-card");
    else if (high <= 9) parts.push("low");

    const label = parts.join(", ");
    const flushRisk = maxSuit >= (board.length < 5 ? 2 : 3);
    const straightRisk = !paired && lowestSpan <= 4;

    let detail = "";
    if (maxSuit >= 3) detail = "Three cards of the same suit — flushes are possible.";
    else if (maxSuit === 2) detail = "Two cards of the same suit — flush draws are in play.";
    if (paired) detail += (detail ? " " : "") + "A paired board makes full houses and trips possible.";
    if (straightRisk) detail += (detail ? " " : "") + "Cards are close in rank — straights and draws are common.";
    if (high >= 13 && !paired && maxSuit < 3) detail += (detail ? " " : "") + "A dry high-card board usually favors the preflop aggressor.";

    return { label: label, detail: detail, flushRisk: flushRisk, straightRisk: straightRisk };
  }

  // -- Preflop recommendation ------------------------------------------------

  function preflopRecommendation(state, actor) {
    const hole = state[actor + "Hole"];
    const label = handLabel(hole[0], hole[1]);
    const strength = handStrengthFromLabel(label);
    const handClass = describeHandClass(hole);
    const btn = isButton(state, actor);
    const positionName = btn ? "small blind (button)" : "big blind";
    const stackBB = Math.round((state[actor + "Stack"] + state[actor + "Committed"]) / state.bb);
    const owe = engine.toCall(state, actor);
    const facingRaise = owe > state.bb; // more than just completing the SB

    let probs, sizing;
    let recText;
    let handText;
    let tip;

    if (!facingRaise) {
      // Opening decision (we're first to act from the SB, or BB with only a completion to call).
      if (strength >= 11) {
        probs = { fold: 0, call: 0.05, raise: 0.95 };
        handText = "This is a premium hand — one of the strongest starting hands in hold'em.";
      } else if (strength >= 8) {
        probs = { fold: 0, call: 0.10, raise: 0.90 };
        handText = "This is a strong hand that plays well as an open-raise.";
      } else if (strength >= 6) {
        probs = { fold: 0.05, call: 0.15, raise: 0.80 };
        handText = "This hand is clearly playable — in heads-up it raises for value.";
      } else if (strength >= 5) {
        probs = { fold: 0.15, call: 0.20, raise: 0.65 };
        handText = "This is a borderline hand. In heads-up 50bb, we still usually raise to apply pressure.";
      } else if (strength >= 3) {
        probs = { fold: 0.55, call: 0.20, raise: 0.25 };
        handText = "This hand is below the standard opening threshold — a mixed decision.";
      } else {
        probs = { fold: 0.9, call: 0.05, raise: 0.05 };
        handText = "This is one of the weakest starting hands — we mostly fold.";
      }
      const openSize = Math.min(state.bb * 2 + state.sb, state[actor + "Stack"] + state[actor + "Committed"]);
      sizing = { raise: Math.round(openSize) };
      recText = "Our recommended mix is " + mixLabel(probs) + ". A typical open-size is " +
                "about 2.5x the big blind (" + sizing.raise + " chips).";
      tip = btn
        ? "In heads-up poker the small blind IS the button — you act first preflop but " +
          "have position on every later street. That's why the opening range is so wide " +
          "(about 65% of hands): having position is a big edge."
        : "You have the option to complete (call) or raise since only " + owe + " is owed. " +
          "Raising (a 'squeeze' from the BB) pressures a wide SB range with a stronger hand.";
    } else {
      // Facing a raise (BB defending vs SB open).
      if (strength >= 13) {
        probs = { fold: 0, call: 0.20, raise: 0.80 };
        handText = "A premium hand — we happily re-raise for value.";
      } else if (strength >= 10) {
        probs = { fold: 0.05, call: 0.50, raise: 0.45 };
        handText = "A strong hand that can 3-bet or call in a mixed strategy.";
      } else if (strength >= 7) {
        probs = { fold: 0.15, call: 0.75, raise: 0.10 };
        handText = "A solid defending hand — call most of the time, 3-bet occasionally.";
      } else if (strength >= 5) {
        probs = { fold: 0.40, call: 0.55, raise: 0.05 };
        handText = "A marginal defend — playable but borderline.";
      } else if (strength >= 3) {
        probs = { fold: 0.75, call: 0.25, raise: 0 };
        handText = "This hand is below the standard calling threshold most of the time.";
      } else {
        probs = { fold: 0.95, call: 0.05, raise: 0 };
        handText = "A very weak hand — usually fold.";
      }
      const raiseTo = state.currentBet;
      const threeBetSize = Math.min(raiseTo * 3, state[actor + "Stack"] + state[actor + "Committed"]);
      sizing = { raise: Math.round(threeBetSize) };
      recText = "Our mix is " + mixLabel(probs) + ". A standard 3-bet is about 3x the raise " +
                "(" + sizing.raise + " chips).";
      tip = "You're in the big blind facing a raise. In HU you get great pot odds to defend " +
            "a lot of hands — but you'll be out of position postflop, so 3-betting your " +
            "better hands keeps the aggression on your side.";
    }

    const situation = "You're in the " + positionName + " with " + stackBB + "bb. " +
                      (btn ? "You act first preflop, but will have position postflop. "
                           : "You're last to act preflop, first to act postflop. ");

    return {
      phase: "preflop",
      probs: probs,
      sizing: sizing,
      reasoning: {
        situation: situation,
        hand: "Your hand: " + cardsStr(hole) + " (" + handClass + "). " + handText,
        analysis: null,
        recommendation: recText,
        tip: tip,
        mixLabel: mixLabel(probs)
      }
    };
  }

  // -- Postflop recommendation ----------------------------------------------

  function postflopRecommendation(state, actor) {
    const hole = state[actor + "Hole"];
    const board = state.board;
    const pot = engine.potTotal(state);
    const owe = engine.toCall(state, actor);
    const potAfterCall = pot + owe;
    const potOdds = owe > 0 ? owe / potAfterCall : 0;
    const texture = describeBoard(board);

    const oppRangeInfo = inferOppPreflopRange(state, actor);
    const iters = 1500;
    const equity = equityVsRange(hole, board, oppRangeInfo.combos, iters);
    const stack = state[actor + "Stack"];
    const committed = state[actor + "Committed"];

    let probs, sizing, recText, analysis, tip;

    if (owe > 0) {
      // Facing a bet.
      if (equity > potOdds + 0.18) {
        probs = { fold: 0.05, call: 0.55, raise: 0.40 };
      } else if (equity > potOdds + 0.07) {
        probs = { fold: 0.10, call: 0.80, raise: 0.10 };
      } else if (equity > potOdds) {
        probs = { fold: 0.30, call: 0.65, raise: 0.05 };
      } else if (equity > potOdds - 0.05) {
        probs = { fold: 0.70, call: 0.25, raise: 0.05 };
      } else {
        probs = { fold: 0.92, call: 0.05, raise: 0.03 };
      }
      const raiseTarget = state.currentBet + Math.round(potAfterCall * 1.2);
      sizing = {
        raise: Math.min(raiseTarget, committed + stack)
      };
      analysis = "You have about " + pct(equity) + " equity against what we estimate is " +
                 oppRangeInfo.label + ". You owe " + owe + " into a pot of " + pot +
                 ", needing " + pct(potOdds) + " equity to break even on a call.";
      recText = "Our mix: " + mixLabel(probs) + ".";
      if (equity > potOdds + 0.15) {
        tip = "When your equity clearly beats the price, raising some of the time extracts " +
              "more value and denies free cards. With medium equity, calling is usually enough.";
      } else if (equity > potOdds) {
        tip = "Pot odds are the percentage of the new pot you're risking. If you have MORE " +
              "equity than that percentage, a call is profitable in the long run.";
      } else {
        tip = "Your equity is below the price being offered — every call loses chips on " +
              "average. Save the chips for a better spot.";
      }
    } else {
      // No bet to call — check or bet.
      if (equity > 0.72) {
        probs = { check: 0.10, bet: 0.90 };
      } else if (equity > 0.58) {
        probs = { check: 0.30, bet: 0.70 };
      } else if (equity > 0.42) {
        probs = { check: 0.60, bet: 0.40 };
      } else {
        probs = { check: 0.85, bet: 0.15 };
      }
      const betFrac = equity > 0.7 ? 0.75 : equity > 0.5 ? 0.5 : 0.33;
      const betAmount = Math.max(state.bb, Math.round(pot * betFrac));
      sizing = { bet: Math.min(betAmount, stack) };
      analysis = "You have about " + pct(equity) + " equity against " + oppRangeInfo.label + ". " +
                 "No bet to face, so the decision is check or bet.";
      recText = "Our mix: " + mixLabel(probs) + ". A reasonable bet size here is " +
                sizing.bet + " (~" + Math.round(betFrac * 100) + "% pot).";
      if (equity > 0.6) {
        tip = "With strong equity you should bet for value — you're ahead often enough that " +
              "getting chips in now earns money over time.";
      } else if (equity > 0.42) {
        tip = "Medium equity is tricky: you may prefer to check and see a free card, or bet " +
              "small to deny equity to opponent's overcards. Either is defensible.";
      } else {
        tip = "When you're behind, betting turns your hand into a bluff. Sometimes worth it " +
              "(especially in position on boards that favor your range), but often a check is fine.";
      }
    }

    return {
      phase: "postflop",
      probs: probs,
      sizing: sizing,
      equity: equity,
      potOdds: potOdds,
      pot: pot,
      owe: owe,
      oppRange: oppRangeInfo,
      texture: texture,
      reasoning: {
        situation: "We're on the " + state.street + ". Board: " + cardsStr(board) +
                   " (" + (texture.label || "texture n/a") + "). " +
                   (texture.detail ? texture.detail + " " : "") +
                   "Pot is " + pot + ".",
        hand: "Your hand: " + cardsStr(hole) + ".",
        analysis: analysis,
        recommendation: recText,
        tip: tip,
        mixLabel: mixLabel(probs)
      }
    };
  }

  // -- Public dispatcher -----------------------------------------------------

  function recommend(state, actor) {
    if (state.handOver) return null;
    if (state.street === "preflop") return preflopRecommendation(state, actor);
    return postflopRecommendation(state, actor);
  }

  // -- Evaluating the hero's choice ------------------------------------------

  function evaluate(action, rec) {
    // Normalize: treat 'bet' and 'raise' as aggression for comparison purposes.
    const probs = rec.probs;
    let p;
    if (action === "bet" && probs.raise !== undefined) p = probs.raise;
    else if (action === "raise" && probs.bet !== undefined) p = probs.bet;
    else if (action === "check" && probs.call !== undefined && probs.check === undefined) p = probs.call;
    else p = probs[action];
    p = p || 0;

    let verdict, tone, explanation;
    if (p >= 0.55) { verdict = "Solid play."; tone = "good"; explanation = "This matches the most common line here."; }
    else if (p >= 0.30) { verdict = "Reasonable."; tone = "good"; explanation = "This is a secondary but defensible option."; }
    else if (p >= 0.12) { verdict = "Close — not the top choice."; tone = "mixed"; explanation = "Playable, but a different line is usually a touch better."; }
    else if (p >= 0.04) { verdict = "Thin."; tone = "mixed"; explanation = "This play exists in a balanced mix but shouldn't be your default here."; }
    else { verdict = "Suboptimal."; tone = "bad"; explanation = "We'd almost always choose differently in this spot."; }

    return { verdict: verdict, tone: tone, explanation: explanation, probability: p };
  }

  // -- Helpers ---------------------------------------------------------------

  function cardsStr(cards) {
    return cards.map(function (c) {
      const r = c[0] === "T" ? "10" : c[0];
      const sMap = { s: "\u2660", h: "\u2665", d: "\u2666", c: "\u2663" };
      return r + sMap[c[1]];
    }).join(" ");
  }

  function pct(x) { return (x * 100).toFixed(0) + "%"; }

  function mixLabel(probs) {
    const parts = [];
    const order = ["fold", "check", "call", "bet", "raise"];
    for (const k of order) {
      if (probs[k] !== undefined && probs[k] > 0) {
        parts.push(cap(k) + " " + pct(probs[k]));
      }
    }
    return parts.join(" / ");
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // -- Export ----------------------------------------------------------------

  global.POKER = global.POKER || {};
  global.POKER.coach = {
    recommend: recommend,
    evaluate: evaluate,
    describeBoard: describeBoard,
    cardsStr: cardsStr,
    pct: pct
  };
})(window);
