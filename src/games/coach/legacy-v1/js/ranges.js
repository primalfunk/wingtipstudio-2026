/* Preflop strength scoring and hand/range expansion.
 * Uses a Chen-style formula with minor tweaks for HU 50bb play.
 *
 * Exposed:
 *  handStrength(hole) -> number (higher = stronger, AA ~20, 72o ~-1.5)
 *  handLabel already on POKER from deck.js
 *  describeHandClass(hole) -> "pocket Aces", "suited connector", etc.
 *  expandLabel(label) -> array of combos ["As","Ks"] ...
 *  sbOpenLabels() -> labels the SB opens in HU 50bb
 *  bbThreeBetLabels()
 *  bbCallLabels()
 *  labelsToCombos(labels)
 */
(function (global) {
  "use strict";

  const RV = global.POKER.RANK_VALUE;
  const RANKS = global.POKER.RANKS; // ascending: 2..A
  const SUITS = global.POKER.SUITS;

  // -- Strength scoring ------------------------------------------------------

  function handStrengthFromLabel(label) {
    const r1 = label[0], r2 = label[1];
    const v1 = RV[r1], v2 = RV[r2];
    const hi = Math.max(v1, v2), lo = Math.min(v1, v2);
    const pair = v1 === v2;
    const suited = !pair && label[2] === "s";

    let s;
    if (hi === 14) s = 10;
    else if (hi === 13) s = 8;
    else if (hi === 12) s = 7;
    else if (hi === 11) s = 6;
    else s = hi / 2;

    if (pair) s = Math.max(s * 2, 5);
    if (suited) s += 2;

    if (!pair) {
      const gap = hi - lo - 1;
      if (gap === 1) s -= 1;
      else if (gap === 2) s -= 2;
      else if (gap === 3) s -= 4;
      else if (gap >= 4) s -= 5;

      // Low straight draw bonus
      if (gap <= 1 && hi <= 11) s += 1;
      // Suited ace bonus — very playable at HU
      if (suited && hi === 14) s += 1.5;
    }
    return Math.round(s * 10) / 10;
  }

  function handStrength(hole) {
    return handStrengthFromLabel(global.POKER.handLabel(hole[0], hole[1]));
  }

  // -- Label expansion -------------------------------------------------------

  function expandLabel(label) {
    const r1 = label[0], r2 = label[1];
    const out = [];
    if (r1 === r2) {
      for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
          out.push([r1 + SUITS[i], r2 + SUITS[j]]);
        }
      }
    } else {
      const suited = label[2] === "s";
      if (suited) {
        for (const s of SUITS) out.push([r1 + s, r2 + s]);
      } else {
        for (const a of SUITS) {
          for (const b of SUITS) {
            if (a !== b) out.push([r1 + a, r2 + b]);
          }
        }
      }
    }
    return out;
  }

  function labelsToCombos(labels) {
    const out = [];
    for (const l of labels) {
      const combos = expandLabel(l);
      for (const c of combos) out.push(c);
    }
    return out;
  }

  // -- All 169 hands ---------------------------------------------------------

  function allHandLabels() {
    const labels = [];
    // Pairs
    for (let i = RANKS.length - 1; i >= 0; i--) labels.push(RANKS[i] + RANKS[i]);
    // Non-pairs, suited + offsuit
    for (let i = RANKS.length - 1; i >= 0; i--) {
      for (let j = i - 1; j >= 0; j--) {
        labels.push(RANKS[i] + RANKS[j] + "s");
        labels.push(RANKS[i] + RANKS[j] + "o");
      }
    }
    return labels;
  }

  const ALL_LABELS = allHandLabels();

  function labelsWithStrengthAtLeast(threshold) {
    return ALL_LABELS.filter(function (l) {
      return handStrengthFromLabel(l) >= threshold;
    });
  }

  function labelsInStrengthRange(lo, hi) {
    return ALL_LABELS.filter(function (l) {
      const s = handStrengthFromLabel(l);
      return s >= lo && s < hi;
    });
  }

  // -- HU 50bb reference ranges ---------------------------------------------
  // Thresholds chosen to produce roughly the frequencies a solid HU reg uses
  // (wide SB open, moderate BB 3bet, moderate BB call).
  function sbOpenLabels() { return labelsWithStrengthAtLeast(4); }          // ~50% combos
  function bbThreeBetLabels() { return labelsWithStrengthAtLeast(9); }      // ~12% combos
  function bbCallLabels() { return labelsInStrengthRange(4, 9); }           // ~40%

  // -- Plain-English description --------------------------------------------

  function describeHandClass(hole) {
    const label = global.POKER.handLabel(hole[0], hole[1]);
    const r1 = label[0], r2 = label[1];
    const v1 = RV[r1], v2 = RV[r2];
    const hi = Math.max(v1, v2), lo = Math.min(v1, v2);
    const pair = v1 === v2;
    const suited = !pair && label[2] === "s";

    const rankName = {
      2:"Twos",3:"Threes",4:"Fours",5:"Fives",6:"Sixes",7:"Sevens",
      8:"Eights",9:"Nines",10:"Tens",11:"Jacks",12:"Queens",13:"Kings",14:"Aces"
    };

    if (pair) {
      if (hi >= 13) return "pocket " + rankName[hi] + " (premium pair)";
      if (hi >= 10) return "pocket " + rankName[hi] + " (strong pair)";
      if (hi >= 7)  return "pocket " + rankName[hi] + " (mid pair)";
      return "small pocket pair (" + rankName[hi] + ")";
    }

    const suffix = suited ? "suited" : "offsuit";
    if (hi === 14) {
      if (lo >= 11) return "big ace " + suffix + " (" + r1 + r2 + suffix[0] + ")";
      if (suited) return "suited ace (A" + r2 + "s)";
      return "weak offsuit ace (A" + r2 + "o)";
    }
    if (hi >= 12 && lo >= 10) return "broadway " + suffix;
    const gap = hi - lo - 1;
    if (gap === 0 && suited) return "suited connector (" + r1 + r2 + "s)";
    if (gap === 0) return "offsuit connector (" + r1 + r2 + "o)";
    if (gap <= 2 && suited) return "suited gapper (" + r1 + r2 + "s)";
    return "unconnected " + suffix;
  }

  // -- Export ----------------------------------------------------------------

  global.POKER = global.POKER || {};
  global.POKER.handStrength = handStrength;
  global.POKER.handStrengthFromLabel = handStrengthFromLabel;
  global.POKER.describeHandClass = describeHandClass;
  global.POKER.expandLabel = expandLabel;
  global.POKER.labelsToCombos = labelsToCombos;
  global.POKER.allHandLabels = function () { return ALL_LABELS.slice(); };
  global.POKER.sbOpenLabels = sbOpenLabels;
  global.POKER.bbThreeBetLabels = bbThreeBetLabels;
  global.POKER.bbCallLabels = bbCallLabels;
})(window);
