/* Deck utilities. Cards are strings like "As", "Td", "2c".
 * Ranks: 2 3 4 5 6 7 8 9 T J Q K A
 * Suits: s (spades), h (hearts), d (diamonds), c (clubs)
 */
(function (global) {
  "use strict";

  const RANKS = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"];
  const SUITS = ["s","h","d","c"];

  const RANK_VALUE = {
    "2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,
    "T":10,"J":11,"Q":12,"K":13,"A":14
  };

  function createDeck() {
    const d = [];
    for (const r of RANKS) for (const s of SUITS) d.push(r + s);
    return d;
  }

  // Fisher-Yates shuffle, in place.
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // "AsKh" -> "AKs" canonical preflop combo label.
  function handLabel(c1, c2) {
    const r1 = c1[0], s1 = c1[1];
    const r2 = c2[0], s2 = c2[1];
    const v1 = RANK_VALUE[r1], v2 = RANK_VALUE[r2];
    // Higher rank first
    const [hi, lo] = v1 >= v2 ? [r1, r2] : [r2, r1];
    if (r1 === r2) return hi + lo; // pair like "AA"
    const suited = (s1 === s2);
    return hi + lo + (suited ? "s" : "o");
  }

  global.POKER = global.POKER || {};
  global.POKER.RANKS = RANKS;
  global.POKER.SUITS = SUITS;
  global.POKER.RANK_VALUE = RANK_VALUE;
  global.POKER.createDeck = createDeck;
  global.POKER.shuffle = shuffle;
  global.POKER.handLabel = handLabel;
})(window);
