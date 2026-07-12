/* Bot decision engine. Uses the coach's recommendation, sampled with
 * an aggression skew ('passive' | 'balanced' | 'aggressive').
 */
(function (global) {
  "use strict";

  const coach = global.POKER.coach;
  const engine = global.POKER.engine;

  function skewProbs(probs, style) {
    const p = Object.assign({}, probs);
    if (style === "passive") {
      const shiftOut = (p.raise || 0) * 0.55 + (p.bet || 0) * 0.40;
      if (p.raise) p.raise *= 0.45;
      if (p.bet) p.bet *= 0.60;
      if (p.call !== undefined) p.call = (p.call || 0) + shiftOut * 0.7;
      if (p.check !== undefined) p.check = (p.check || 0) + shiftOut * 0.3;
      else if (p.fold !== undefined) p.fold = (p.fold || 0) + shiftOut * 0.3;
    } else if (style === "aggressive") {
      const liftFromCall = (p.call || 0) * 0.35;
      const liftFromCheck = (p.check || 0) * 0.35;
      const liftFromFold = (p.fold || 0) * 0.20;
      if (p.call !== undefined) p.call = (p.call || 0) - liftFromCall;
      if (p.check !== undefined) p.check = (p.check || 0) - liftFromCheck;
      if (p.fold !== undefined) p.fold = (p.fold || 0) - liftFromFold;
      if (p.raise !== undefined) p.raise = (p.raise || 0) + liftFromCall + liftFromFold;
      else if (p.bet !== undefined) p.bet = (p.bet || 0) + liftFromCall + liftFromCheck + liftFromFold;
    }
    // Normalize
    let total = 0;
    for (const k in p) total += p[k];
    if (total > 0) for (const k in p) p[k] /= total;
    return p;
  }

  function sample(probs) {
    const r = Math.random();
    let cum = 0;
    for (const [k, v] of Object.entries(probs)) {
      cum += v;
      if (r <= cum) return k;
    }
    // Fallback
    return Object.keys(probs)[0];
  }

  function decide(state, style) {
    style = style || "balanced";
    const rec = coach.recommend(state, "bot");
    if (!rec) return { action: "fold" };

    const legal = engine.legalActions(state);
    const probs = skewProbs(rec.probs, style);

    // Filter to only legal action keys.
    const legalKeys = Object.keys(legal);
    const filtered = {};
    let total = 0;
    for (const k of legalKeys) {
      if (probs[k] !== undefined) {
        filtered[k] = probs[k];
        total += probs[k];
      }
    }
    // If we have a 'bet' prob but only 'raise' is legal (or vice versa), remap.
    if (probs.bet !== undefined && !("bet" in filtered) && legal.raise) {
      filtered.raise = (filtered.raise || 0) + probs.bet;
      total += probs.bet;
    }
    if (probs.raise !== undefined && !("raise" in filtered) && legal.bet) {
      filtered.bet = (filtered.bet || 0) + probs.raise;
      total += probs.raise;
    }
    if (total === 0) {
      // No overlap — pick the safest legal action.
      if (legal.check) return { action: "check" };
      if (legal.call) return { action: "call" };
      if (legal.fold) return { action: "fold" };
      return { action: Object.keys(legal)[0] };
    }
    for (const k in filtered) filtered[k] /= total;

    const chosen = sample(filtered);
    const out = { action: chosen };
    if (chosen === "bet") out.amount = rec.sizing && rec.sizing.bet;
    if (chosen === "raise") out.amount = rec.sizing && rec.sizing.raise;
    // Clamp sizes to legal range; fall back to min-legal if missing.
    if (chosen === "bet" || chosen === "raise") {
      const legalRange = legal[chosen];
      if (!legalRange) {
        // Shouldn't happen after filtering, but be defensive.
        if (legal.check) return { action: "check" };
        if (legal.call) return { action: "call" };
        return { action: "fold" };
      }
      if (out.amount === undefined || out.amount === null || !isFinite(out.amount)) {
        out.amount = legalRange.min;
      }
      out.amount = Math.max(legalRange.min, Math.min(legalRange.max, Math.round(out.amount)));
    }
    return out;
  }

  global.POKER = global.POKER || {};
  global.POKER.bot = { decide: decide };
})(window);
