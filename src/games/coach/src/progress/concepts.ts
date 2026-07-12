import type { ProgressConceptDefinition } from "../core/types";

export const PROGRESS_CONCEPTS: ProgressConceptDefinition[] = [
  {
    id: "preflop_opening",
    label: "Preflop Opening",
    description: "How well the user handles heads-up button opening spots.",
    relatedSpotKeys: ["preflop_btn_open_hu"],
    drillPackIds: ["spot-preflop_btn_open_hu"]
  },
  {
    id: "preflop_defending",
    label: "Preflop Defending",
    description: "Big blind defense decisions versus the button open.",
    relatedSpotKeys: ["preflop_bb_defend_hu"],
    drillPackIds: ["spot-preflop_bb_defend_hu"]
  },
  {
    id: "flop_cbet",
    label: "Flop C-Bet",
    description: "Single-raised-pot in-position c-bet decisions.",
    relatedSpotKeys: ["flop_srp_ip_cbet"],
    drillPackIds: ["spot-flop_srp_ip_cbet"]
  },
  {
    id: "flop_defend_vs_cbet",
    label: "Flop Defend vs C-Bet",
    description: "Out-of-position decisions facing a flop c-bet.",
    relatedSpotKeys: ["flop_srp_oop_defend_vs_cbet"],
    drillPackIds: ["spot-flop_srp_oop_defend_vs_cbet"]
  },
  {
    id: "turn_barrel",
    label: "Turn Barrel",
    description: "Follow-up aggression after the flop c-bet gets called.",
    relatedSpotKeys: ["turn_barrel_after_flop_call"],
    drillPackIds: ["spot-turn_barrel_after_flop_call"]
  },
  {
    id: "turn_checkback",
    label: "Turn Checkback",
    description: "Turn slowdowns after a flop c-bet gets called.",
    relatedSpotKeys: ["turn_checkback_after_cbet"],
    drillPackIds: ["spot-turn_checkback_after_cbet"]
  },
  {
    id: "river_bluffcatch",
    label: "River Bluff-Catch",
    description: "River bluff-catching decisions facing a bet.",
    relatedSpotKeys: ["river_bluffcatch_vs_bet"],
    drillPackIds: ["spot-river_bluffcatch_vs_bet"]
  },
  {
    id: "river_value_bet",
    label: "River Value Bet",
    description: "River value-bet opportunities when checked to.",
    relatedSpotKeys: ["river_value_bet_opportunity"],
    drillPackIds: []
  },
  {
    id: "bet_sizing",
    label: "Bet Sizing",
    description: "How well the user chooses betting and raising sizes.",
    relatedSpotKeys: [
      "flop_srp_ip_cbet",
      "flop_srp_oop_defend_vs_cbet",
      "turn_barrel_after_flop_call",
      "turn_checkback_after_cbet",
      "river_bluffcatch_vs_bet",
      "river_value_bet_opportunity"
    ],
    drillPackIds: ["starter-mixed-pack"]
  },
  {
    id: "bluff_selection",
    label: "Bluff Selection",
    description: "Aggressive decisions in spots where bluffs must be chosen carefully.",
    relatedSpotKeys: ["flop_srp_ip_cbet", "turn_barrel_after_flop_call", "river_bluffcatch_vs_bet"],
    drillPackIds: ["spot-flop_srp_ip_cbet", "spot-turn_barrel_after_flop_call"]
  },
  {
    id: "overfold_tendency",
    label: "Overfold Tendency",
    description: "Folds that appear too tight versus the coach recommendation.",
    relatedSpotKeys: ["preflop_bb_defend_hu", "flop_srp_oop_defend_vs_cbet", "river_bluffcatch_vs_bet"],
    drillPackIds: ["spot-preflop_bb_defend_hu", "spot-flop_srp_oop_defend_vs_cbet", "spot-river_bluffcatch_vs_bet"]
  },
  {
    id: "overcall_tendency",
    label: "Overcall Tendency",
    description: "Calls that appear too loose or under-selective.",
    relatedSpotKeys: ["preflop_bb_defend_hu", "flop_srp_oop_defend_vs_cbet", "river_bluffcatch_vs_bet"],
    drillPackIds: ["spot-flop_srp_oop_defend_vs_cbet", "spot-river_bluffcatch_vs_bet"]
  }
];

export function getConceptDefinition(id: ProgressConceptDefinition["id"]): ProgressConceptDefinition | undefined {
  return PROGRESS_CONCEPTS.find((concept) => concept.id === id);
}
