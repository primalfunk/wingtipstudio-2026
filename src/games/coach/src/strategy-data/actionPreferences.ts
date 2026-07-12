import type { ActionPreferenceRecord } from "../core/types";

export const ACTION_PREFERENCE_RECORDS: ActionPreferenceRecord[] = [
  {
    id: "btn-open-premium",
    spotKey: "preflop_btn_open_hu",
    handClass: "premium_value",
    preferredActions: ["raise"],
    fallbackActions: ["call"],
    preferredSizing: "medium",
    note: "Premium hands want to open aggressively and start building the pot immediately.",
    caution: "Avoid slow-playing by open-limping this bucket too often.",
    confidence: "high"
  },
  {
    id: "btn-open-medium",
    spotKey: "preflop_btn_open_hu",
    handClass: "medium_showdown",
    preferredActions: ["raise"],
    fallbackActions: ["call", "fold"],
    preferredSizing: "medium",
    note: "Medium-strength heads-up opens still benefit from initiative and position.",
    caution: "Do not confuse medium heads-up opens with full-ring trash folds.",
    confidence: "high"
  },
  {
    id: "bb-defend-strong",
    spotKey: "preflop_bb_defend_hu",
    handClass: "strong_value",
    preferredActions: ["raise", "call"],
    fallbackActions: ["fold"],
    preferredSizing: "large",
    note: "Better defend candidates can pressure the button with 3-bets instead of only calling.",
    caution: "Calling everything strong leaves the initiative entirely with villain.",
    confidence: "high"
  },
  {
    id: "bb-defend-weak",
    spotKey: "preflop_bb_defend_hu",
    handClass: "weak_showdown",
    preferredActions: ["call", "fold"],
    fallbackActions: ["raise"],
    preferredSizing: "medium",
    note: "Marginal defend hands mostly call at good prices or fold when realization is poor.",
    caution: "Do not overdefend dominated offsuit junk just because the pot odds exist.",
    confidence: "medium"
  },
  {
    id: "flop-ip-air",
    spotKey: "flop_srp_ip_cbet",
    handClass: "air",
    preferredActions: ["bet", "check"],
    fallbackActions: [],
    preferredSizing: "small",
    note: "Air prefers small c-bets more often on dry boards where range advantage does the work.",
    caution: "Large c-bets with no equity get expensive quickly on dynamic boards.",
    confidence: "medium"
  },
  {
    id: "flop-ip-strong-draw",
    spotKey: "flop_srp_ip_cbet",
    handClass: "strong_draw",
    preferredActions: ["bet"],
    fallbackActions: ["check"],
    preferredSizing: "medium",
    note: "Strong draws want pressure plus equity realization, so betting is the default.",
    caution: "Purely checking strong draws gives up fold equity too easily.",
    confidence: "medium"
  },
  {
    id: "flop-ip-medium-showdown",
    spotKey: "flop_srp_ip_cbet",
    handClass: "medium_showdown",
    preferredActions: ["check", "bet"],
    fallbackActions: [],
    preferredSizing: "small",
    note: "Medium showdown hands can mix between cheap denial and pot control.",
    caution: "Avoid inflating the pot with large bets when the hand mainly wants realization.",
    confidence: "medium"
  },
  {
    id: "flop-oop-bluffcatch",
    spotKey: "flop_srp_oop_defend_vs_cbet",
    handClass: "medium_showdown",
    preferredActions: ["call"],
    fallbackActions: ["fold", "raise"],
    preferredSizing: "medium",
    note: "One-pair bluff-catchers usually continue by calling rather than raising.",
    caution: "Check-raising too many bluff-catchers strips your range of easy turn continues.",
    confidence: "medium"
  },
  {
    id: "flop-oop-draw",
    spotKey: "flop_srp_oop_defend_vs_cbet",
    handClass: "strong_draw",
    preferredActions: ["call", "raise"],
    fallbackActions: ["fold"],
    preferredSizing: "large",
    note: "Good draws can continue aggressively or passively depending on price and texture.",
    caution: "Not every draw needs a raise; preserve calls too.",
    confidence: "medium"
  },
  {
    id: "turn-barrel-value",
    spotKey: "turn_barrel_after_flop_call",
    handClass: "strong_value",
    preferredActions: ["bet"],
    fallbackActions: ["check"],
    preferredSizing: "large",
    note: "Strong value hands can lean into polar sizing on the turn after villain calls flop.",
    caution: "If the range you target is mostly weak, medium sizing may keep more worse hands in.",
    confidence: "medium"
  },
  {
    id: "turn-barrel-draw",
    spotKey: "turn_barrel_after_flop_call",
    handClass: "strong_draw",
    preferredActions: ["bet"],
    fallbackActions: ["check"],
    preferredSizing: "large",
    note: "Strong draws keep barreling well because they combine fold equity with real outs.",
    caution: "Weak one-pair hands should not copy this aggressive plan.",
    confidence: "medium"
  },
  {
    id: "turn-checkback-medium",
    spotKey: "turn_checkback_after_cbet",
    handClass: "medium_showdown",
    preferredActions: ["check"],
    fallbackActions: ["bet"],
    preferredSizing: "small",
    note: "Medium showdown hands often prefer checking back to preserve equity and control the pot.",
    caution: "Do not auto-barrel medium showdown just because you still have initiative.",
    confidence: "medium"
  },
  {
    id: "turn-checkback-weak-draw",
    spotKey: "turn_checkback_after_cbet",
    handClass: "weak_draw",
    preferredActions: ["check"],
    fallbackActions: ["bet"],
    preferredSizing: "small",
    note: "Weak draws often slow down when fold equity is fading and showdown value is scarce.",
    caution: "Barrel only when the board and range interaction still generate enough folds.",
    confidence: "low"
  },
  {
    id: "river-bluffcatcher",
    spotKey: "river_bluffcatch_vs_bet",
    handClass: "bluffcatcher",
    preferredActions: ["call", "fold"],
    fallbackActions: [],
    preferredSizing: "large",
    note: "Bluff-catchers live on pot odds, blockers, and how polarized villain's line looks.",
    caution: "A bluff-catcher is not a value hand; raising is rarely the default.",
    confidence: "medium"
  },
  {
    id: "river-value-strong",
    spotKey: "river_value_bet_opportunity",
    handClass: "strong_value",
    preferredActions: ["bet"],
    fallbackActions: ["check"],
    preferredSizing: "medium",
    note: "Strong river value hands should usually bet when villain's line is capped.",
    caution: "Choose a size that worse hands can still call.",
    confidence: "medium"
  },
  {
    id: "river-value-medium",
    spotKey: "river_value_bet_opportunity",
    handClass: "medium_showdown",
    preferredActions: ["check", "bet"],
    fallbackActions: [],
    preferredSizing: "small",
    note: "Thin value lives in the small-size family more often than the large one.",
    caution: "Large river bets with medium showdown hands often isolate against better.",
    confidence: "medium"
  }
];
