import { RANK_VALUE, handLabel } from "../core/deck";
import { evaluate } from "../core/evaluator";
import type {
  ActionHistoryEntry,
  Actor,
  BetSizeBand,
  BlockerInsight,
  Card,
  EngineAction,
  GameState,
  InferredRangeSummary,
  RangeClass,
  RangeInfo,
  RangeSeedMetadata,
  RangeStructureFlags,
  Rank
} from "../core/types";
import {
  allHandLabels,
  bbCallLabels,
  bbThreeBetLabels,
  expandLabel,
  handStrengthFromLabel,
  labelsToCombos,
  sbOpenLabels
} from "./ranges";

const RANGE_CLASSES: RangeClass[] = [
  "nutted_made",
  "strong_value",
  "medium_showdown",
  "weak_showdown",
  "strong_draw",
  "weak_draw",
  "air"
];

type WeightedCombo = {
  combo: [Card, Card];
  weight: number;
  handClass: RangeClass;
};

interface TextureHooks {
  paired: boolean;
  monotone: boolean;
  twoTone: boolean;
  rainbow: boolean;
  highCardDry: boolean;
  lowConnected: boolean;
  coordinated: boolean;
  dynamic: boolean;
}

interface ActionSizingContext {
  action: EngineAction;
  street: GameState["street"];
  actor: Actor;
  amount?: number;
  sizing: BetSizeBand;
  checkRaise: boolean;
}

type RangeSeed = RangeInfo & {
  seed: RangeSeedMetadata;
};

function createEmptyWeights(): Record<RangeClass, number> {
  return {
    nutted_made: 0,
    strong_value: 0,
    medium_showdown: 0,
    weak_showdown: 0,
    strong_draw: 0,
    weak_draw: 0,
    air: 0
  };
}

function normalizeWeights(weights: Record<RangeClass, number>): Record<RangeClass, number> {
  const total = RANGE_CLASSES.reduce((sum, key) => sum + Math.max(0, weights[key]), 0);
  if (total <= 0) {
    const fallback = 1 / RANGE_CLASSES.length;
    return RANGE_CLASSES.reduce(
      (next, key) => {
        next[key] = fallback;
        return next;
      },
      createEmptyWeights()
    );
  }

  return RANGE_CLASSES.reduce(
    (next, key) => {
      next[key] = Math.max(0, weights[key]) / total;
      return next;
    },
    createEmptyWeights()
  );
}

function topBoardRanks(board: Card[]): number[] {
  return [...new Set(board.map((card) => RANK_VALUE[card[0] as Rank]))].sort((a, b) => b - a);
}

function boardTextureHooks(board: Card[]): TextureHooks {
  if (!board.length) {
    return {
      paired: false,
      monotone: false,
      twoTone: false,
      rainbow: false,
      highCardDry: false,
      lowConnected: false,
      coordinated: false,
      dynamic: false
    };
  }

  const ranks = board.map((card) => RANK_VALUE[card[0] as Rank]).sort((a, b) => b - a);
  const suits = board.map((card) => card[1]);
  const suitCounts = suits.reduce<Record<string, number>>((counts, suit) => {
    counts[suit] = (counts[suit] || 0) + 1;
    return counts;
  }, {});
  const maxSuit = Math.max(...Object.values(suitCounts));
  const paired = new Set(ranks).size < ranks.length;
  const span = ranks[0] - ranks[ranks.length - 1];
  const connected = !paired && span <= 4;
  const monotone = board.length >= 3 && maxSuit === board.length;
  const twoTone = board.length >= 3 && maxSuit >= 2 && !monotone;
  const highCardDry = board.length >= 3 && !paired && !twoTone && !monotone && ranks[0] >= 12 && span > 4;
  const lowConnected = ranks[0] <= 10 && connected;
  const coordinated = connected || twoTone || monotone || paired;

  return {
    paired,
    monotone,
    twoTone,
    rainbow: !twoTone && !monotone,
    highCardDry,
    lowConnected,
    coordinated,
    dynamic: coordinated && !highCardDry
  };
}

function lastPreflopAction(state: GameState, actor: Actor) {
  let lastAction: ActionHistoryEntry | null = null;
  for (const entry of state.actionHistory) {
    if (entry.street === "preflop" && entry.actor === actor) {
      lastAction = entry;
    }
  }
  return lastAction;
}

function isButton(state: GameState, actor: Actor): boolean {
  return (actor === "hero") === state.heroIsButton;
}

function inferPreflopRangeSeed(state: GameState, actor: Actor): RangeSeed {
  const opponent: Actor = actor === "hero" ? "bot" : "hero";
  const opponentIsButton = !isButton(state, actor);
  const lastAction = lastPreflopAction(state, opponent);

  if (!lastAction) {
    return {
      combos: labelsToCombos([...bbCallLabels(), ...bbThreeBetLabels()]),
      label: "full defending range",
      seed: {
        sourcePreflopLine: "unknown defend",
        position: opponentIsButton ? "button" : "big_blind",
        initiative: "unknown"
      }
    };
  }

  if (opponentIsButton) {
    if (lastAction.action === "raise" || lastAction.action === "bet") {
      return {
        combos: labelsToCombos(sbOpenLabels()),
        label: "SB opening range (~65% of hands)",
        seed: {
          sourcePreflopLine: "button open",
          position: "button",
          initiative: opponent
        }
      };
    }
    if (lastAction.action === "call") {
      const limpRange = allHandLabels().filter((label) => {
        const strength = handStrengthFromLabel(label);
        return strength >= 3 && strength < 6;
      });
      return {
        combos: labelsToCombos(limpRange),
        label: "limping range (mid-tier hands)",
        seed: {
          sourcePreflopLine: "button limp",
          position: "button",
          initiative: "neutral"
        }
      };
    }
  } else {
    if (lastAction.action === "raise") {
      return {
        combos: labelsToCombos(bbThreeBetLabels()),
        label: "BB 3-bet range (~top 10%)",
        seed: {
          sourcePreflopLine: "big blind 3-bet",
          position: "big_blind",
          initiative: opponent
        }
      };
    }
    if (lastAction.action === "call") {
      return {
        combos: labelsToCombos(bbCallLabels()),
        label: "BB flatting range",
        seed: {
          sourcePreflopLine: "big blind flat",
          position: "big_blind",
          initiative: actor
        }
      };
    }
    if (lastAction.action === "check") {
      return {
        combos: labelsToCombos(allHandLabels()),
        label: "BB's full range (checked option)",
        seed: {
          sourcePreflopLine: "big blind check option",
          position: "big_blind",
          initiative: "neutral"
        }
      };
    }
  }

  return {
    combos: labelsToCombos(allHandLabels()),
    label: "full range",
    seed: {
      sourcePreflopLine: "full range",
      position: opponentIsButton ? "button" : "big_blind",
      initiative: "unknown"
    }
  };
}

function comboBlocked(combo: [Card, Card], board: Card[], heroHole: Card[]): boolean {
  const deadCards = new Set([...board, ...heroHole]);
  return deadCards.has(combo[0]) || deadCards.has(combo[1]);
}

function rankFrequency(cards: Card[]): Record<number, number> {
  return cards.reduce<Record<number, number>>((counts, card) => {
    const value = RANK_VALUE[card[0] as Rank];
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function suitFrequency(cards: Card[]): Record<string, number> {
  return cards.reduce<Record<string, number>>((counts, card) => {
    counts[card[1]] = (counts[card[1]] || 0) + 1;
    return counts;
  }, {});
}

function straightDrawState(cards: Card[]): { openEnded: boolean; gutshot: boolean } {
  const values = [...new Set(cards.map((card) => RANK_VALUE[card[0] as Rank]))].sort((a, b) => a - b);
  if (values.includes(14)) {
    values.unshift(1);
  }

  let openEnded = false;
  let gutshot = false;
  for (let high = 14; high >= 5; high -= 1) {
    const run = [high - 4, high - 3, high - 2, high - 1, high];
    const present = run.filter((value) => values.includes(value));
    if (present.length === 4) {
      const missing = run.find((value) => !values.includes(value));
      if (missing === run[0] || missing === run[4]) {
        openEnded = true;
      } else {
        gutshot = true;
      }
    }
  }
  return { openEnded, gutshot };
}

function classifyPairStrength(hole: [Card, Card], board: Card[], category: number): RangeClass | null {
  if (category !== 1 && category !== 2 && category !== 3) {
    return null;
  }

  const allCards = [...hole, ...board];
  const boardRanks = topBoardRanks(board);
  const counts = rankFrequency(allCards);
  const holeValues = hole.map((card) => RANK_VALUE[card[0] as Rank]).sort((a, b) => b - a);
  const pairRanks = Object.entries(counts)
    .filter(([, count]) => count >= 2)
    .map(([value]) => Number(value))
    .sort((a, b) => b - a);
  const topPair = pairRanks[0] ?? 0;
  const secondBoard = boardRanks[1] ?? boardRanks[0] ?? 0;

  if (category >= 3) {
    if (topPair >= boardRanks[0]) {
      return "strong_value";
    }
    return "medium_showdown";
  }

  if (category === 2) {
    if (topPair >= boardRanks[0] && pairRanks[1] >= secondBoard) {
      return "strong_value";
    }
    return "medium_showdown";
  }

  const pocketPair = holeValues[0] === holeValues[1];
  const topBoard = boardRanks[0] ?? 0;
  if (pocketPair && holeValues[0] > topBoard) {
    return "strong_value";
  }
  if (topPair >= topBoard) {
    return holeValues[0] >= secondBoard ? "strong_value" : "medium_showdown";
  }
  if (topPair >= secondBoard) {
    return "medium_showdown";
  }
  return "weak_showdown";
}

function classifyComboAgainstBoard(combo: [Card, Card], board: Card[]): RangeClass {
  if (!board.length) {
    const label = handLabel(combo[0], combo[1]);
    const strength = handStrengthFromLabel(label);
    if (strength >= 9) return "strong_value";
    if (strength >= 6) return "medium_showdown";
    if (strength >= 4) return "weak_showdown";
    return "air";
  }

  const allCards = [...combo, ...board];
  const score = evaluate(allCards);
  const category = score[0];
  const texture = boardTextureHooks(board);
  const suits = suitFrequency(allCards);
  const flushMade = category >= 5;
  const flushDraw = !flushMade && board.length < 5 && Object.values(suits).some((count) => count === 4);
  const straightMade = category === 4 || category === 8;
  const straightDraw = !straightMade && board.length < 5 ? straightDrawState(allCards) : { openEnded: false, gutshot: false };
  const pairClass = classifyPairStrength(combo, board, category);

  if (category >= 6) {
    return "nutted_made";
  }
  if (category === 5 || category === 4) {
    return texture.coordinated ? "nutted_made" : "strong_value";
  }
  if (pairClass) {
    if (pairClass === "weak_showdown" && (flushDraw || straightDraw.openEnded)) {
      return "strong_draw";
    }
    return pairClass;
  }

  const strongDraw = (flushDraw && (straightDraw.openEnded || straightDraw.gutshot)) || flushDraw || straightDraw.openEnded;
  if (strongDraw) {
    return "strong_draw";
  }
  if (straightDraw.gutshot) {
    return "weak_draw";
  }

  const holeValues = combo.map((card) => RANK_VALUE[card[0] as Rank]).sort((a, b) => b - a);
  const boardTop = topBoardRanks(board)[0] ?? 0;
  if (holeValues[0] > boardTop && board.length < 5) {
    return "weak_draw";
  }

  return "air";
}

function sizingBandFromRatio(ratio: number): BetSizeBand {
  if (ratio <= 0) return "none";
  if (ratio < 0.4) return "small";
  if (ratio < 0.8) return "medium";
  return "large";
}

function buildActionContexts(state: GameState): ActionSizingContext[] {
  const contexts: ActionSizingContext[] = [];
  let street: GameState["street"] = "preflop";
  let pot = 0;
  let heroCommitted = state.heroIsButton ? state.sb : state.bb;
  let botCommitted = state.heroIsButton ? state.bb : state.sb;
  let checksThisStreet: Partial<Record<Actor, boolean>> = {};

  const settleStreet = (nextStreet: GameState["street"]) => {
    pot += heroCommitted + botCommitted;
    heroCommitted = 0;
    botCommitted = 0;
    checksThisStreet = {};
    street = nextStreet;
  };

  for (const entry of state.actionHistory) {
    if (entry.street !== street) {
      settleStreet(entry.street);
    }

    const potBefore = pot + heroCommitted + botCommitted;
    const actorCommitted = entry.actor === "hero" ? heroCommitted : botCommitted;
    const amount = entry.amount;
    let ratio = 0;
    if ((entry.action === "bet" || entry.action === "raise") && amount !== undefined) {
      const add = Math.max(0, amount - actorCommitted);
      ratio = add / Math.max(1, potBefore);
    } else if (entry.action === "call" && amount !== undefined) {
      ratio = amount / Math.max(1, potBefore);
    }

    const checkRaise =
      (entry.action === "raise" || entry.action === "bet") &&
      checksThisStreet[entry.actor] === true &&
      checksThisStreet[entry.actor === "hero" ? "bot" : "hero"] !== undefined;

    contexts.push({
      action: entry.action,
      street: entry.street,
      actor: entry.actor,
      amount,
      sizing: sizingBandFromRatio(ratio),
      checkRaise
    });

    if (entry.action === "check") {
      checksThisStreet[entry.actor] = true;
      continue;
    }

    if (entry.action === "call" && amount !== undefined) {
      if (entry.actor === "hero") heroCommitted += amount;
      else botCommitted += amount;
      continue;
    }

    if ((entry.action === "bet" || entry.action === "raise") && amount !== undefined) {
      if (entry.actor === "hero") heroCommitted = amount;
      else botCommitted = amount;
      checksThisStreet = {};
    }
  }

  return contexts;
}

function multiplierTemplate(): Record<RangeClass, number> {
  return {
    nutted_made: 1,
    strong_value: 1,
    medium_showdown: 1,
    weak_showdown: 1,
    strong_draw: 1,
    weak_draw: 1,
    air: 1
  };
}

function actionMultipliers(
  context: ActionSizingContext,
  opponent: Actor,
  texture: TextureHooks,
  seed: RangeSeedMetadata
): Record<RangeClass, number> {
  const next = multiplierTemplate();
  if (context.actor !== opponent) {
    return next;
  }

  const onDynamicBoard = texture.dynamic || texture.lowConnected;
  const onRiver = context.street === "river";
  const hasInitiative = seed.initiative === opponent;

  if (context.action === "check") {
    next.nutted_made *= hasInitiative ? 0.78 : 0.88;
    next.strong_value *= 0.82;
    next.medium_showdown *= 1.18;
    next.weak_showdown *= 1.12;
    next.strong_draw *= onDynamicBoard && !onRiver ? 0.95 : 0.78;
    next.weak_draw *= onRiver ? 0.45 : 0.82;
    next.air *= hasInitiative ? 0.72 : 0.88;
    return next;
  }

  if (context.action === "call") {
    next.nutted_made *= 0.86;
    next.strong_value *= onRiver ? 0.78 : 0.92;
    next.medium_showdown *= 1.28;
    next.weak_showdown *= onRiver ? 1.1 : 1.04;
    next.strong_draw *= onRiver ? 0.25 : onDynamicBoard ? 1.35 : 1.12;
    next.weak_draw *= onRiver ? 0.18 : onDynamicBoard ? 1.1 : 0.92;
    next.air *= 0.42;
    return next;
  }

  if (context.action === "bet" || context.action === "raise") {
    if (context.checkRaise) {
      next.nutted_made *= 1.5;
      next.strong_value *= 1.35;
      next.medium_showdown *= 0.62;
      next.weak_showdown *= 0.32;
      next.strong_draw *= onRiver ? 0.38 : 1.45;
      next.weak_draw *= onRiver ? 0.08 : 0.66;
      next.air *= onRiver ? 0.95 : 0.88;
      return next;
    }

    if (context.sizing === "small") {
      next.nutted_made *= 0.95;
      next.strong_value *= 1.08;
      next.medium_showdown *= 1.1;
      next.weak_showdown *= 0.88;
      next.strong_draw *= onDynamicBoard ? 1.12 : 0.98;
      next.weak_draw *= onDynamicBoard ? 1.06 : 0.9;
      next.air *= hasInitiative ? 0.96 : 0.78;
      return next;
    }

    if (context.sizing === "medium") {
      next.nutted_made *= 1.08;
      next.strong_value *= 1.18;
      next.medium_showdown *= 0.9;
      next.weak_showdown *= 0.62;
      next.strong_draw *= onRiver ? 0.38 : 1.24;
      next.weak_draw *= onRiver ? 0.12 : 0.8;
      next.air *= hasInitiative ? 1.02 : 0.9;
      return next;
    }

    next.nutted_made *= 1.3;
    next.strong_value *= 1.3;
    next.medium_showdown *= 0.56;
    next.weak_showdown *= 0.18;
    next.strong_draw *= onRiver ? 0.3 : 1.32;
    next.weak_draw *= onRiver ? 0.08 : 0.42;
    next.air *= onRiver ? 1.24 : 1.08;
    return next;
  }

  if (context.action === "fold") {
    return RANGE_CLASSES.reduce(
      (acc, key) => {
        acc[key] = 0;
        return acc;
      },
      multiplierTemplate()
    );
  }

  return next;
}

function applyContextToCombos(
  combos: WeightedCombo[],
  context: ActionSizingContext,
  opponent: Actor,
  texture: TextureHooks,
  seed: RangeSeedMetadata
): WeightedCombo[] {
  const multipliers = actionMultipliers(context, opponent, texture, seed);
  return combos.map((entry) => ({
    ...entry,
    weight: entry.weight * multipliers[entry.handClass]
  }));
}

function weightsFromCombos(combos: WeightedCombo[]): Record<RangeClass, number> {
  const weights = combos.reduce((acc, entry) => {
    acc[entry.handClass] += entry.weight;
    return acc;
  }, createEmptyWeights());
  return normalizeWeights(weights);
}

function describeEmphasis(weights: Record<RangeClass, number>): string[] {
  const notes: string[] = [];
  if (weights.medium_showdown >= 0.23) notes.push("many one-pair and bluff-catching hands");
  if (weights.strong_draw + weights.weak_draw >= 0.3) notes.push("significant draw density");
  if (weights.nutted_made + weights.strong_value <= 0.22) notes.push("few truly nutted hands");
  if (weights.air >= 0.18) notes.push("some natural bluffs");
  if (!notes.length) notes.push("a mix of medium-strength hands");
  return notes.slice(0, 3);
}

function inferFlags(
  weights: Record<RangeClass, number>,
  lastOpponentAction: ActionSizingContext | undefined
): RangeStructureFlags {
  const valueMass = weights.nutted_made + weights.strong_value;
  const showdownMass = weights.medium_showdown + weights.weak_showdown;
  const drawMass = weights.strong_draw + weights.weak_draw;
  const aggressiveLarge =
    !!lastOpponentAction &&
    (lastOpponentAction.action === "bet" || lastOpponentAction.action === "raise") &&
    lastOpponentAction.sizing === "large";
  const aggressiveMediumPlus =
    !!lastOpponentAction &&
    (lastOpponentAction.action === "bet" || lastOpponentAction.action === "raise") &&
    (lastOpponentAction.sizing === "medium" || lastOpponentAction.sizing === "large");
  const riverPolarBet = aggressiveLarge && lastOpponentAction?.street === "river";
  const polarized =
    (valueMass + weights.air >= 0.56 && showdownMass <= 0.34) ||
    (aggressiveLarge && valueMass + weights.air >= 0.46 && showdownMass <= 0.42) ||
    (aggressiveMediumPlus && (weights.air >= 0.08 || valueMass >= 0.28) && showdownMass <= 0.5) ||
    riverPolarBet;
  const condensed = showdownMass + drawMass >= 0.66 && weights.air <= 0.16 && weights.nutted_made <= 0.12;
  const passiveAction = lastOpponentAction?.action === "check" || lastOpponentAction?.action === "call";
  const capped = passiveAction === true && weights.nutted_made <= 0.1 && weights.strong_value <= 0.2;

  return {
    polarized,
    condensed,
    capped,
    drawHeavy: drawMass >= 0.32,
    showdownHeavy: showdownMass >= 0.48
  };
}

function shapeLabel(flags: RangeStructureFlags): string {
  if (flags.polarized) return "polarized";
  if (flags.capped) return "capped";
  if (flags.showdownHeavy) return "showdown-heavy";
  if (flags.condensed) return "condensed";
  if (flags.drawHeavy) return "draw-heavy";
  return "mixed";
}

function summaryLabel(weights: Record<RangeClass, number>, flags: RangeStructureFlags): string {
  const shape = shapeLabel(flags);
  if (shape === "polarized") return "polarized betting range";
  if (shape === "condensed") return "condensed continuing range";
  if (shape === "showdown-heavy") return "showdown-heavy passive range";
  if (shape === "draw-heavy") return "draw-heavy continuing range";
  if (shape === "capped") return "capped passive range";
  if (weights.medium_showdown >= weights.strong_value) return "medium-strength continuing range";
  return "mixed continuing range";
}

function actionNotes(
  weights: Record<RangeClass, number>,
  flags: RangeStructureFlags,
  lastOpponentAction: ActionSizingContext | undefined
): string[] {
  const notes: string[] = [];
  if (!lastOpponentAction) {
    return notes;
  }

  if (lastOpponentAction.action === "call") {
    if (weights.medium_showdown >= 0.22) notes.push("Villain's call keeps many one-pair hands.");
    if (weights.strong_draw + weights.weak_draw >= 0.25) notes.push("That calling line still holds a lot of draws.");
  } else if (lastOpponentAction.action === "check") {
    if (flags.capped || flags.showdownHeavy) notes.push("The passive line leaves villain more capped and showdown-heavy.");
  } else if (lastOpponentAction.action === "bet" || lastOpponentAction.action === "raise") {
    if (flags.polarized) notes.push("This aggressive line makes villain more polarized.");
    if (flags.drawHeavy && lastOpponentAction.street !== "river") notes.push("The betting range can still contain strong draws.");
  }

  if (!notes.length) {
    notes.push(`Villain now looks ${summaryLabel(weights, flags)}.`);
  }
  return notes.slice(0, 2);
}

function blockerNotes(heroHole: Card[], board: Card[], weights: Record<RangeClass, number>): BlockerInsight[] {
  if (!board.length) {
    return [];
  }

  const notes: BlockerInsight[] = [];
  const boardRanks = topBoardRanks(board);
  const heroRanks = heroHole.map((card) => RANK_VALUE[card[0] as Rank]);
  const topRank = boardRanks[0];
  const secondRank = boardRanks[1];

  if (heroRanks.includes(topRank)) {
    notes.push({ kind: "value", direction: "blocks", label: "You block top-pair value hands." });
  } else if (secondRank && heroRanks.includes(secondRank)) {
    notes.push({ kind: "showdown", direction: "blocks", label: "You block some second-pair bluff-catchers." });
  }

  const boardSuits = suitFrequency(board);
  const drawSuit = Object.entries(boardSuits).find(([, count]) => count === 2)?.[0];
  if (drawSuit && board.length < 5) {
    const heroDrawSuit = heroHole.some((card) => card[1] === drawSuit);
    if (heroDrawSuit) {
      notes.push({ kind: "bluff", direction: "blocks", label: "You block natural flush-draw bluffs." });
    } else if (weights.strong_draw + weights.weak_draw >= 0.24) {
      notes.push({ kind: "bluff", direction: "unblocks", label: "You unblock missed flush draws." });
    }
  }

  const connectedBoard = boardTextureHooks(board).lowConnected || boardTextureHooks(board).coordinated;
  if (connectedBoard) {
    const heroHigh = Math.max(...heroRanks);
    if (heroHigh >= (topRank ?? 0) - 1) {
      notes.push({ kind: "bluff", direction: "blocks", label: "Your cards block some straight-draw bluffs." });
    }
  }

  return notes.slice(0, 2);
}

function debugLabel(weights: Record<RangeClass, number>, flags: RangeStructureFlags): string {
  const parts = RANGE_CLASSES.map((key) => `${key}:${Math.round(weights[key] * 100)}%`);
  const flagBits = Object.entries(flags)
    .filter(([, value]) => value)
    .map(([key]) => key)
    .join(", ");
  return `${parts.join(" | ")}${flagBits ? ` | flags:${flagBits}` : ""}`;
}

function weightedCombosFromSeed(seed: RangeSeed, board: Card[], heroHole: Card[]): WeightedCombo[] {
  return seed.combos
    .filter((combo) => !comboBlocked(combo, board, heroHole))
    .map((combo) => ({
      combo,
      weight: 1,
      handClass: classifyComboAgainstBoard(combo, board)
    }));
}

export function weightedRangeCombos(summary: InferredRangeSummary, combos: Array<[Card, Card]>, board: Card[], heroHole: Card[]): Array<[Card, Card]> {
  const classified = combos
    .filter((combo) => !comboBlocked(combo, board, heroHole))
    .map((combo) => ({
      combo,
      handClass: classifyComboAgainstBoard(combo, board),
      weight: summary.classWeights[classifyComboAgainstBoard(combo, board)]
    }));

  const expanded: Array<[Card, Card]> = [];
  for (const entry of classified) {
    const copies = Math.max(1, Math.min(4, Math.round(entry.weight * 6)));
    for (let index = 0; index < copies; index += 1) {
      expanded.push(entry.combo);
    }
  }
  return expanded.length ? expanded : combos;
}

export function inferOpponentRangeSummary(state: GameState, actor: Actor): { range: RangeSeed; summary: InferredRangeSummary } {
  const opponent: Actor = actor === "hero" ? "bot" : "hero";
  const heroHole = actor === "hero" ? state.heroHole : state.botHole;
  const seed = inferPreflopRangeSeed(state, actor);
  const texture = boardTextureHooks(state.board);
  let combos = weightedCombosFromSeed(seed, state.board, heroHole);
  const actionContexts = buildActionContexts(state);
  const opponentActions = actionContexts.filter((entry) => entry.actor === opponent && entry.street !== "preflop");

  for (const context of opponentActions) {
    combos = applyContextToCombos(combos, context, opponent, texture, seed.seed);
  }

  const weights = weightsFromCombos(combos);
  const lastOpponentAction = opponentActions[opponentActions.length - 1];
  const flags = inferFlags(weights, lastOpponentAction);
  const emphasis = describeEmphasis(weights);
  const notes = actionNotes(weights, flags, lastOpponentAction);
  const blocker = blockerNotes(heroHole, state.board, weights);

  return {
    range: seed,
    summary: {
      seed: seed.seed,
      classWeights: weights,
      flags,
      emphasis,
      shapeLabel: shapeLabel(flags),
      summaryLabel: summaryLabel(weights, flags),
      actionNotes: notes,
      blockerNotes: blocker,
      debugLabel: debugLabel(weights, flags)
    }
  };
}

export function inferRangeDebugEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem("coach.debugRanges") === "1";
}

export function buildRangeDeveloperNote(): string {
  return [
    "Range state uses seven coarse classes: nutted_made, strong_value, medium_showdown, weak_showdown, strong_draw, weak_draw, air.",
    "Seeds come from the existing preflop assumptions, then every opponent postflop action applies explicit class multipliers by street, sizing bucket, and board texture.",
    "Sizing buckets are none, small (<40% pot), medium (<80% pot), and large (80%+ pot).",
    "This model is descriptive and heuristic. It is not solver-accurate, combo-perfect, or player-adaptive."
  ].join(" ");
}

export function expandLabelToClassWeights(label: string, board: Card[]): Record<RangeClass, number> {
  const weights = createEmptyWeights();
  for (const combo of expandLabel(label)) {
    weights[classifyComboAgainstBoard(combo, board)] += 1;
  }
  return normalizeWeights(weights);
}
