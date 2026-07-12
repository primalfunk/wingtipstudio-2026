import type { SizingFamilyDefinition } from "../core/types";

export const SIZING_FAMILIES: SizingFamilyDefinition[] = [
  {
    key: "small",
    label: "Small",
    thresholdDescription: "Roughly up to 40% pot.",
    teachingNote: "Small sizing leans on range advantage, thin value, and cheap denial.",
    typicalUseCases: ["dry ace-high c-bets", "range bets", "thin river value"]
  },
  {
    key: "medium",
    label: "Medium",
    thresholdDescription: "Roughly 40% to 80% pot.",
    teachingNote: "Medium sizing pressures one-pair hands while still getting called by worse holdings.",
    typicalUseCases: ["default value bets", "turn barrels", "river bluff-catches facing standard bets"]
  },
  {
    key: "large",
    label: "Large",
    thresholdDescription: "Roughly 80% pot or larger.",
    teachingNote: "Large bets polarize the range and ask medium-strength hands to continue for a real price.",
    typicalUseCases: ["polar turn barrels", "river value with strong hands", "river bluffs against capped ranges"]
  },
  {
    key: "all_in",
    label: "All-in",
    thresholdDescription: "Effective stack committed.",
    teachingNote: "All-in sizing is the most polar family and should reflect clear value or high-leverage pressure.",
    typicalUseCases: ["short-stack jams", "river polar shove", "preflop stack-off range"]
  }
];
