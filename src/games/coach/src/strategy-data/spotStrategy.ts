import type { SpotStrategyRecord } from "../core/types";

export const SPOT_STRATEGY_RECORDS: SpotStrategyRecord[] = [
  {
    key: "preflop_btn_open_hu",
    label: "Preflop BTN Open HU",
    summary: "Heads-up button opens are wide because position drives the hand.",
    objective: "Attack the big blind with a broad opening range while keeping trash out of the mix.",
    defaultNotes: [
      "Teach the spot first: this is a position-driven open, not only a hand-strength decision.",
      "Hands that realize equity well become profitable opens far more often heads-up."
    ],
    commonMistakes: [
      "Folding too much on the button because the hand looks weak in absolute terms.",
      "Using limp-heavy passivity instead of claiming initiative."
    ],
    sizingFamilies: ["medium"],
    confidence: "high",
    relatedConcepts: ["position", "initiative", "opening range"],
    relatedDrillSetIds: ["spot-preflop_btn_open_hu"]
  },
  {
    key: "preflop_bb_defend_hu",
    label: "Preflop BB Defend HU",
    summary: "Big blind defense is wide in heads-up, but out-of-position play still matters.",
    objective: "Defend enough against the button without overcalling hands that realize poorly.",
    defaultNotes: [
      "Great pot odds widen the defend range, but postflop realization is worse out of position.",
      "Better hands can mix between call and 3-bet."
    ],
    commonMistakes: [
      "Overfolding because the hand is only medium strength.",
      "Calling too much with dominated offsuit trash instead of folding or 3-betting better candidates."
    ],
    sizingFamilies: ["medium", "large"],
    confidence: "high",
    relatedConcepts: ["defense frequency", "realization", "3-bet pressure"],
    relatedDrillSetIds: ["spot-preflop_bb_defend_hu"]
  },
  {
    key: "flop_srp_ip_cbet",
    label: "Flop SRP IP C-Bet",
    summary: "Single-raised-pot in-position c-bet spots reward range advantage and pressure.",
    objective: "Separate hands that want thin denial or value from hands that prefer checking back.",
    defaultNotes: [
      "Dry high-card boards support more small betting.",
      "Dynamic textures require more selectivity and better sizing discipline."
    ],
    commonMistakes: [
      "Auto-betting every flop because you were the preflop raiser.",
      "Using big sizes on boards where small bets already pressure enough of villain's range."
    ],
    sizingFamilies: ["small", "medium", "large"],
    confidence: "medium",
    relatedConcepts: ["range advantage", "board texture", "denial"],
    relatedDrillSetIds: ["spot-flop_srp_ip_cbet"]
  },
  {
    key: "flop_srp_oop_defend_vs_cbet",
    label: "Flop SRP OOP Defend vs C-Bet",
    summary: "Out-of-position defense is about keeping enough continues without overplaying marginal bluff-catchers.",
    objective: "Defend hands that keep enough equity or can improve while folding the weakest continues.",
    defaultNotes: [
      "One-pair bluff-catchers and draws usually carry the continue weight.",
      "Raises should come from stronger value or higher-quality draws, not random frustration."
    ],
    commonMistakes: [
      "Folding too many medium-strength pairs on routine textures.",
      "Turning every draw into a raise instead of preserving calls."
    ],
    sizingFamilies: ["small", "medium", "large"],
    confidence: "medium",
    relatedConcepts: ["defending range", "bluff-catching", "draw realization"],
    relatedDrillSetIds: ["spot-flop_srp_oop_defend_vs_cbet"]
  },
  {
    key: "turn_barrel_after_flop_call",
    label: "Turn Barrel After Flop Call",
    summary: "After a flop bet gets called, turn play asks whether pressure should continue or slow down.",
    objective: "Keep barreling with hands that gain fold equity, value, or strong draw leverage.",
    defaultNotes: [
      "Blank turns preserve the preflop aggressor's pressure more often.",
      "Large turn bets should represent a more polar range than flop small c-bets."
    ],
    commonMistakes: [
      "Giving up too often on turns that still favor the aggressor.",
      "Firing large with medium showdown hands that prefer checking."
    ],
    sizingFamilies: ["medium", "large"],
    confidence: "medium",
    relatedConcepts: ["second barrel", "polarization", "fold equity"],
    relatedDrillSetIds: ["spot-turn_barrel_after_flop_call"]
  },
  {
    key: "turn_checkback_after_cbet",
    label: "Turn Checkback After C-Bet",
    summary: "Turn check-backs protect medium-strength hands and manage risk on textures that fight back.",
    objective: "Preserve showdown value and avoid overbarreling thin hands into sticky ranges.",
    defaultNotes: [
      "Checking back keeps medium-strength hands in range and protects future checks.",
      "Draw-heavy or pairing turns often reduce the need to keep blasting."
    ],
    commonMistakes: [
      "Barreling every turn after a flop c-bet gets called.",
      "Checking back too many strong draws that still want fold equity."
    ],
    sizingFamilies: ["small", "medium"],
    confidence: "medium",
    relatedConcepts: ["pot control", "range protection", "showdown value"],
    relatedDrillSetIds: ["spot-turn_checkback_after_cbet"]
  },
  {
    key: "river_bluffcatch_vs_bet",
    label: "River Bluffcatch vs Bet",
    summary: "River bluff-catching is mostly about price, polarization, and blockers.",
    objective: "Separate bluff-catchers worth continuing from hands that lose too often versus value.",
    defaultNotes: [
      "Large river bets tend to be more polarized than flop or turn bets.",
      "Blockers and unblockers matter more once draws have either arrived or missed."
    ],
    commonMistakes: [
      "Calling too often just because top pair feels strong.",
      "Overfolding when the line still leaves natural missed draws."
    ],
    sizingFamilies: ["medium", "large", "all_in"],
    confidence: "medium",
    relatedConcepts: ["polarization", "blockers", "pot odds"],
    relatedDrillSetIds: ["spot-river_bluffcatch_vs_bet"]
  },
  {
    key: "river_value_bet_opportunity",
    label: "River Value Bet Opportunity",
    summary: "River value bets target capped, bluff-catching ranges without paying off only better hands.",
    objective: "Choose sizes that still get called by worse hands and avoid turning medium hands into bluffs.",
    defaultNotes: [
      "Thin value improves against capped passive ranges.",
      "Bigger sizes should come from stronger value or more polar intentions."
    ],
    commonMistakes: [
      "Checking back too many value hands because the river feels scary.",
      "Betting too large with hands that only get called by better."
    ],
    sizingFamilies: ["small", "medium", "large"],
    confidence: "medium",
    relatedConcepts: ["thin value", "targeting bluff-catchers", "river sizing"],
    relatedDrillSetIds: []
  }
];
