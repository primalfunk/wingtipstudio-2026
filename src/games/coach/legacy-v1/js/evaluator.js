/* 7-card Texas Hold'em hand evaluator.
 * Returns a comparable score array [category, tiebreakers...] — higher is better.
 * Categories: 0 high card, 1 pair, 2 two pair, 3 trips, 4 straight,
 *             5 flush, 6 full house, 7 quads, 8 straight flush.
 */
(function (global) {
  "use strict";

  const RV = global.POKER.RANK_VALUE;

  const CATEGORY_NAMES = [
    "high card", "pair", "two pair", "three of a kind",
    "straight", "flush", "full house", "four of a kind", "straight flush"
  ];

  function findStraight(values) {
    // values: array of numeric rank values (may contain duplicates)
    const uniq = Array.from(new Set(values)).sort(function (a, b) { return b - a; });
    if (uniq.indexOf(14) !== -1) uniq.push(1); // wheel
    for (let i = 0; i <= uniq.length - 5; i++) {
      if (uniq[i] - uniq[i + 4] === 4) return uniq[i];
    }
    return 0;
  }

  function evaluate(cards) {
    // cards: array of strings like "As"
    const values = cards.map(function (c) { return RV[c[0]]; });
    const suits = cards.map(function (c) { return c[1]; });

    const counts = {};
    for (const v of values) counts[v] = (counts[v] || 0) + 1;

    const bySuit = { s: [], h: [], d: [], c: [] };
    for (const c of cards) bySuit[c[1]].push(RV[c[0]]);

    // Flush detection
    let flushSuit = null;
    for (const s of ["s", "h", "d", "c"]) {
      if (bySuit[s].length >= 5) { flushSuit = s; break; }
    }

    // Straight flush
    if (flushSuit) {
      const sfHigh = findStraight(bySuit[flushSuit]);
      if (sfHigh) return [8, sfHigh];
    }

    // Sort rank groups: by count desc, then by rank desc
    const groups = Object.keys(counts)
      .map(function (k) { return [parseInt(k, 10), counts[k]]; })
      .sort(function (a, b) {
        if (b[1] !== a[1]) return b[1] - a[1];
        return b[0] - a[0];
      });

    const topCount = groups[0][1];
    const secondCount = groups[1] ? groups[1][1] : 0;

    // Four of a kind
    if (topCount === 4) {
      const q = groups[0][0];
      const kicker = Math.max.apply(null, values.filter(function (v) { return v !== q; }));
      return [7, q, kicker];
    }

    // Full house (trips + pair or trips)
    if (topCount === 3 && secondCount >= 2) {
      return [6, groups[0][0], groups[1][0]];
    }

    // Flush
    if (flushSuit) {
      const top5 = bySuit[flushSuit].slice().sort(function (a, b) { return b - a; }).slice(0, 5);
      return [5].concat(top5);
    }

    // Straight
    const stHigh = findStraight(values);
    if (stHigh) return [4, stHigh];

    // Three of a kind
    if (topCount === 3) {
      const t = groups[0][0];
      const kickers = values
        .filter(function (v) { return v !== t; })
        .sort(function (a, b) { return b - a; })
        .slice(0, 2);
      return [3, t].concat(kickers);
    }

    // Two pair
    if (topCount === 2 && secondCount === 2) {
      const hi = groups[0][0], lo = groups[1][0];
      const kicker = Math.max.apply(
        null,
        values.filter(function (v) { return v !== hi && v !== lo; })
      );
      return [2, hi, lo, kicker];
    }

    // Pair
    if (topCount === 2) {
      const p = groups[0][0];
      const kickers = values
        .filter(function (v) { return v !== p; })
        .sort(function (a, b) { return b - a; })
        .slice(0, 3);
      return [1, p].concat(kickers);
    }

    // High card
    const top5 = values.slice().sort(function (a, b) { return b - a; }).slice(0, 5);
    return [0].concat(top5);
  }

  function compare(a, b) {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const av = a[i] || 0, bv = b[i] || 0;
      if (av !== bv) return av - bv;
    }
    return 0;
  }

  function describe(score) {
    const cat = score[0];
    const name = CATEGORY_NAMES[cat];
    const rankName = function (v) {
      const map = {2:"Twos",3:"Threes",4:"Fours",5:"Fives",6:"Sixes",7:"Sevens",
                   8:"Eights",9:"Nines",10:"Tens",11:"Jacks",12:"Queens",13:"Kings",14:"Aces"};
      return map[v] || String(v);
    };
    if (cat === 8) return "Straight flush";
    if (cat === 7) return "Four " + rankName(score[1]);
    if (cat === 6) return "Full house, " + rankName(score[1]) + " over " + rankName(score[2]);
    if (cat === 5) return "Flush";
    if (cat === 4) return "Straight";
    if (cat === 3) return "Three " + rankName(score[1]);
    if (cat === 2) return "Two pair, " + rankName(score[1]) + " and " + rankName(score[2]);
    if (cat === 1) return "Pair of " + rankName(score[1]);
    return "High card " + rankName(score[1]);
  }

  global.POKER = global.POKER || {};
  global.POKER.evaluate = evaluate;
  global.POKER.compareHands = compare;
  global.POKER.describeHand = describe;
  global.POKER.CATEGORY_NAMES = CATEGORY_NAMES;
})(window);
