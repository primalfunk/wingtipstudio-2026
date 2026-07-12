import type { BotArchetypeProfile, BotStyle, CoachRecommendation, GameState } from "../core/types";

const ARCHETYPE_PROFILES: BotArchetypeProfile[] = [
  {
    id: "station",
    label: "Station",
    description: "Calls too often, folds too little, and rarely runs large bluffs.",
    preflopLooseness: 1.18,
    aggressionLevel: 0.78,
    bluffFrequencyBias: 0.7,
    callingTendency: 1.35,
    foldingTendency: 0.72,
    cBetFrequencyBias: 0.88,
    raiseFrequencyBias: 0.7,
    coachNote: "This archetype overcalls and underbluffs, so value betting and thinner calls improve while pure bluffs lose some punch."
  },
  {
    id: "nit",
    label: "Nit",
    description: "Tight ranges, cautious continuations, and low bluff frequency.",
    preflopLooseness: 0.72,
    aggressionLevel: 0.82,
    bluffFrequencyBias: 0.68,
    callingTendency: 0.8,
    foldingTendency: 1.32,
    cBetFrequencyBias: 0.9,
    raiseFrequencyBias: 0.8,
    coachNote: "Nits overfold marginal continues and underrepresent bluffs, so pressure works well while bluff-catching needs more discipline."
  },
  {
    id: "maniac",
    label: "Maniac",
    description: "Wide preflop range, constant pressure, and too many bluffs and raises.",
    preflopLooseness: 1.32,
    aggressionLevel: 1.38,
    bluffFrequencyBias: 1.45,
    callingTendency: 0.92,
    foldingTendency: 0.72,
    cBetFrequencyBias: 1.28,
    raiseFrequencyBias: 1.35,
    coachNote: "Maniacs apply pressure too often, so bluff-catching and trapping improve while marginal bluffs lose value."
  },
  {
    id: "fit_or_fold",
    label: "Fit-or-Fold",
    description: "Shows resistance only when connected, but gives up quickly without it.",
    preflopLooseness: 0.9,
    aggressionLevel: 0.88,
    bluffFrequencyBias: 0.74,
    callingTendency: 0.82,
    foldingTendency: 1.26,
    cBetFrequencyBias: 0.96,
    raiseFrequencyBias: 0.82,
    coachNote: "Fit-or-fold players surrender too many weak continues, so small-pressure lines and c-bets pick up extra folds."
  },
  {
    id: "straightforward_reg",
    label: "Straightforward Reg",
    description: "Reasonably solid, balanced baseline with clear value/bluff separation.",
    preflopLooseness: 1,
    aggressionLevel: 1,
    bluffFrequencyBias: 1,
    callingTendency: 1,
    foldingTendency: 1,
    cBetFrequencyBias: 1,
    raiseFrequencyBias: 1,
    coachNote: "This is the baseline training profile, so default heuristics and standard exploit assumptions apply."
  },
  {
    id: "tricky_reg",
    label: "Tricky Reg",
    description: "Balanced baseline with more delayed aggression, floats, and selective pressure.",
    preflopLooseness: 1.04,
    aggressionLevel: 1.08,
    bluffFrequencyBias: 1.12,
    callingTendency: 1.04,
    foldingTendency: 0.94,
    cBetFrequencyBias: 0.96,
    raiseFrequencyBias: 1.14,
    coachNote: "Tricky regs defend and bluff a bit more than baseline, so autopilot c-bets and thin bluff-catches need more care."
  }
];

const LEGACY_STYLE_MAP: Record<Extract<BotStyle, "passive" | "balanced" | "aggressive">, BotStyle> = {
  passive: "fit_or_fold",
  balanced: "straightforward_reg",
  aggressive: "maniac"
};

export function normalizeBotStyle(style: BotStyle | string | null | undefined): BotStyle {
  if (!style) return "straightforward_reg";
  if (style in LEGACY_STYLE_MAP) {
    return LEGACY_STYLE_MAP[style as keyof typeof LEGACY_STYLE_MAP];
  }
  if (ARCHETYPE_PROFILES.some((profile) => profile.id === style)) {
    return style as BotStyle;
  }
  return "straightforward_reg";
}

export function getBotArchetypes(): BotArchetypeProfile[] {
  return ARCHETYPE_PROFILES;
}

export function getBotArchetype(style: BotStyle | string | null | undefined): BotArchetypeProfile {
  const normalized = normalizeBotStyle(style);
  return ARCHETYPE_PROFILES.find((profile) => profile.id === normalized) ?? ARCHETYPE_PROFILES[4];
}

export function archetypeDebugLabel(style: BotStyle | string | null | undefined): string {
  const profile = getBotArchetype(style);
  return [
    `preflop:${profile.preflopLooseness.toFixed(2)}`,
    `agg:${profile.aggressionLevel.toFixed(2)}`,
    `bluff:${profile.bluffFrequencyBias.toFixed(2)}`,
    `call:${profile.callingTendency.toFixed(2)}`,
    `fold:${profile.foldingTendency.toFixed(2)}`,
    `cbet:${profile.cBetFrequencyBias.toFixed(2)}`,
    `raise:${profile.raiseFrequencyBias.toFixed(2)}`
  ].join(" | ");
}

export function buildArchetypeCoachNote(
  style: BotStyle | string | null | undefined,
  recommendation: CoachRecommendation | null,
  state: GameState
): string {
  const profile = getBotArchetype(style);
  if (!recommendation) return profile.coachNote;

  if (recommendation.owe && recommendation.owe > 0) {
    if (profile.id === "station") {
      return `${profile.coachNote} Facing this type, thin value improves and pure river bluffs should tighten.`;
    }
    if (profile.id === "maniac") {
      return `${profile.coachNote} When the line is aggressive, bluff-catching becomes more valuable than against baseline.`;
    }
    if (profile.id === "nit") {
      return `${profile.coachNote} Big bets from this profile skew stronger, so hero-calls need better blockers and clearer price.`;
    }
  } else if (state.street !== "preflop") {
    if (profile.id === "fit_or_fold") {
      return `${profile.coachNote} This makes routine flop and turn pressure more attractive.`;
    }
    if (profile.id === "tricky_reg") {
      return `${profile.coachNote} Expect a few more floats and delayed bluffs than the default profile.`;
    }
  }

  return profile.coachNote;
}
