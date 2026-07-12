/* Monte Carlo equity vs a range.
 * equityVsRange(hero, board, rangeCombos, iters) -> number in [0,1]
 * rangeCombos: array of 2-card combos [[c1,c2], ...]
 */
(function (global) {
  "use strict";

  const createDeck = global.POKER.createDeck;
  const evaluate = global.POKER.evaluate;
  const compare = global.POKER.compareHands;

  function equityVsRange(hero, board, rangeCombos, iters) {
    iters = iters || 1500;
    if (!rangeCombos || rangeCombos.length === 0) return 0.5;
    const dead = new Set(hero.concat(board));

    // Pre-filter the range to combos that don't collide with known cards.
    const usable = [];
    for (const combo of rangeCombos) {
      if (!dead.has(combo[0]) && !dead.has(combo[1])) usable.push(combo);
    }
    if (usable.length === 0) return 0.5;

    const fullDeck = createDeck();
    let wins = 0, ties = 0, total = 0;

    for (let i = 0; i < iters; i++) {
      const opp = usable[(Math.random() * usable.length) | 0];
      const blocked = new Set(dead);
      blocked.add(opp[0]);
      blocked.add(opp[1]);

      // Remaining deck for this trial.
      const rem = [];
      for (const c of fullDeck) if (!blocked.has(c)) rem.push(c);

      const needed = 5 - board.length;
      const runout = board.slice();
      for (let n = 0; n < needed; n++) {
        const idx = (Math.random() * rem.length) | 0;
        runout.push(rem[idx]);
        rem[idx] = rem[rem.length - 1];
        rem.pop();
      }

      const hs = evaluate(hero.concat(runout));
      const os = evaluate(opp.concat(runout));
      const cmp = compare(hs, os);
      if (cmp > 0) wins++;
      else if (cmp === 0) ties++;
      total++;
    }
    if (total === 0) return 0.5;
    return (wins + ties / 2) / total;
  }

  global.POKER = global.POKER || {};
  global.POKER.equityVsRange = equityVsRange;
})(window);
