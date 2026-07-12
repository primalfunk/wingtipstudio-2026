import type { SpotDefinition } from "../core/types";

export const SPOT_TAXONOMY: SpotDefinition[] = [
  {
    tag: "preflop_btn_open_hu",
    label: "Preflop BTN Open HU",
    description: "Hero is on the heads-up button in an unopened pot."
  },
  {
    tag: "preflop_bb_defend_hu",
    label: "Preflop BB Defend HU",
    description: "Hero is in the big blind facing a heads-up button open."
  },
  {
    tag: "flop_srp_ip_cbet",
    label: "Flop SRP IP C-Bet",
    description: "Hero is the in-position aggressor in a single-raised pot with a flop c-bet opportunity."
  },
  {
    tag: "flop_srp_oop_defend_vs_cbet",
    label: "Flop SRP OOP Defend vs C-Bet",
    description: "Hero is out of position in a single-raised pot facing a flop c-bet."
  },
  {
    tag: "turn_barrel_after_flop_call",
    label: "Turn Barrel After Flop Call",
    description: "Hero bet flop, got called, and now decides whether to continue on the turn."
  },
  {
    tag: "turn_checkback_after_cbet",
    label: "Turn Checkback After C-Bet",
    description: "Hero c-bet flop, got called, and now chooses whether to check back the turn."
  },
  {
    tag: "river_bluffcatch_vs_bet",
    label: "River Bluffcatch vs Bet",
    description: "Hero is facing a river bet with a bluff-catching decision."
  },
  {
    tag: "river_value_bet_opportunity",
    label: "River Value Bet Opportunity",
    description: "Hero reaches the river with no bet to face and can consider value betting."
  },
  {
    tag: "unknown",
    label: "Unknown Spot",
    description: "The current state is not yet covered by the starter taxonomy."
  }
];

export function spotLabel(tag: SpotDefinition["tag"]): string {
  return SPOT_TAXONOMY.find((spot) => spot.tag === tag)?.label || "Unknown Spot";
}
