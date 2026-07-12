import type { DrillPack, SpotTag } from "../../core/types";
import { DRILL_SCENARIOS } from "../scenarioData";

function buildSpotPack(spotKey: SpotTag, title: string, description: string): DrillPack {
  return {
    id: `spot-${spotKey}`,
    title,
    description,
    spotKey,
    scenarios: DRILL_SCENARIOS.filter((scenario) => scenario.spotKey === spotKey)
  };
}

export const STARTER_SCENARIO_PACKS: DrillPack[] = [
  {
    id: "starter-mixed-pack",
    title: "Starter Mixed Spot Pack",
    description: "A compact rotation of repeatable heads-up spots across preflop, flop, turn, and river.",
    spotKey: "mixed",
    scenarios: DRILL_SCENARIOS
  },
  buildSpotPack("preflop_btn_open_hu", "Preflop Open Drill", "Button opening spots for rapid preflop repetition."),
  buildSpotPack("preflop_bb_defend_hu", "Preflop Defend Drill", "Big blind defense spots against button opens."),
  buildSpotPack("flop_srp_ip_cbet", "Flop C-Bet Drill", "Single-raised-pot in-position c-bet spots."),
  buildSpotPack("flop_srp_oop_defend_vs_cbet", "Flop Defend vs C-Bet Drill", "Out-of-position flop defense practice."),
  buildSpotPack("turn_barrel_after_flop_call", "Turn Barrel Drill", "Turn follow-up betting after a flop c-bet gets called."),
  buildSpotPack("turn_checkback_after_cbet", "Turn Checkback Drill", "Turn slowdown spots after a flop c-bet gets called."),
  buildSpotPack("river_bluffcatch_vs_bet", "River Bluff-Catcher Drill", "River bluff-catching decisions against bets.")
];
