export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"] as const;
export const SUITS = ["s", "h", "d", "c"] as const;

export type Rank = (typeof RANKS)[number];
export type Suit = (typeof SUITS)[number];
export type Card = `${Rank}${Suit}`;

export type Actor = "hero" | "bot";
export type Street = "idle" | "preflop" | "flop" | "turn" | "river" | "showdown";
export type BotStyle =
  | "passive"
  | "balanced"
  | "aggressive"
  | "station"
  | "nit"
  | "maniac"
  | "fit_or_fold"
  | "straightforward_reg"
  | "tricky_reg";
export type EngineAction = "fold" | "check" | "call" | "bet" | "raise";
export type UiAction = "fold" | "check-call" | "bet-raise";
export type OutcomeTone = "good" | "mixed" | "bad";
export type DeckKey = "classic" | "deadman" | "egyptian" | "karnival" | "phoenix" | "ufo";
export type AppMode = "live" | "drill";
export type HistoryListFilter = "all" | "bookmarked";
export type StudyTag = "mistake" | "interesting" | "review_later" | "bookmarked";
export type StrategyConfidence = "high" | "medium" | "low" | "experimental";
export type SizingFamilyKey = "small" | "medium" | "large" | "all_in";
export type ConceptId =
  | "preflop_opening"
  | "preflop_defending"
  | "flop_cbet"
  | "flop_defend_vs_cbet"
  | "turn_barrel"
  | "turn_checkback"
  | "river_bluffcatch"
  | "river_value_bet"
  | "bet_sizing"
  | "bluff_selection"
  | "overfold_tendency"
  | "overcall_tendency";
export type CoachHandClass =
  | "premium_value"
  | "strong_value"
  | "top_pair_good_kicker"
  | "medium_showdown"
  | "weak_showdown"
  | "strong_draw"
  | "weak_draw"
  | "air"
  | "bluffcatcher";
export type SpotTag =
  | "unknown"
  | "preflop_btn_open_hu"
  | "preflop_bb_defend_hu"
  | "flop_srp_ip_cbet"
  | "flop_srp_oop_defend_vs_cbet"
  | "turn_barrel_after_flop_call"
  | "turn_checkback_after_cbet"
  | "river_bluffcatch_vs_bet"
  | "river_value_bet_opportunity";
export type BoardClass = "dry_high" | "low_connected" | "paired" | "two_tone" | "monotone" | "neutral" | "unknown";
export type BetSizeBand = "none" | "small" | "medium" | "large" | "unknown";
export type PositionLabel = "ip" | "oop" | "button" | "big_blind" | "unknown";
export type PotType = "unopened" | "srp" | "3bet_plus" | "limped" | "unknown";
export type FacingAction = "none" | "check" | "bet" | "raise" | "unknown";
export type ReviewTag =
  | "bookmarked"
  | "showdown"
  | "all_in_preflop"
  | "hero_folded"
  | "villain_folded"
  | "coach_disagreement"
  | "coach_mixed"
  | "coach_aligned";
export type HandHistorySpotTag =
  | "single_raised_pot"
  | "limped_pot"
  | "3bet_pot"
  | "flop_cbet_spot"
  | "turn_barrel_spot"
  | "river_bluffcatch_spot"
  | "showdown"
  | "all_in_preflop";
export type HandHistoryEventType = "action" | "street_transition" | "showdown";

export interface ActionHistoryEntry {
  street: Street;
  actor: Actor;
  action: EngineAction;
  amount?: number;
}

export interface HandResult {
  winner: Actor | "tie";
  amount: number;
  reason: "fold" | "showdown";
  heroHandName?: string;
  botHandName?: string;
}

export interface GameState {
  sb: number;
  bb: number;
  startingStack: number;
  heroStack: number;
  botStack: number;
  heroHole: Card[];
  botHole: Card[];
  board: Card[];
  deck: Card[];
  pot: number;
  heroCommitted: number;
  botCommitted: number;
  currentBet: number;
  minRaiseAmount: number;
  street: Street;
  toAct: Actor | null;
  heroHasActed: boolean;
  botHasActed: boolean;
  lastAggressor: Actor | null;
  heroIsButton: boolean;
  handOver: boolean;
  result: HandResult | null;
  actionHistory: ActionHistoryEntry[];
  handNumber: number;
}

export interface GameStateOptions {
  sb?: number;
  bb?: number;
  startingStack?: number;
  heroIsButton?: boolean;
}

export interface BetRange {
  min: number;
  max: number;
}

export interface LegalActions {
  fold?: true;
  check?: true;
  call?: { amount: number };
  bet?: BetRange;
  raise?: BetRange;
}

export interface RangeInfo {
  combos: Array<[Card, Card]>;
  label: string;
}

export type RangeClass =
  | "nutted_made"
  | "strong_value"
  | "medium_showdown"
  | "weak_showdown"
  | "strong_draw"
  | "weak_draw"
  | "air";

export interface RangeSeedMetadata {
  sourcePreflopLine: string;
  position: PositionLabel;
  initiative: Actor | "neutral" | "unknown";
}

export interface RangeStructureFlags {
  polarized: boolean;
  condensed: boolean;
  capped: boolean;
  drawHeavy: boolean;
  showdownHeavy: boolean;
}

export interface BlockerInsight {
  kind: "value" | "bluff" | "showdown";
  direction: "blocks" | "unblocks";
  label: string;
}

export interface InferredRangeSummary {
  seed: RangeSeedMetadata;
  classWeights: Record<RangeClass, number>;
  flags: RangeStructureFlags;
  emphasis: string[];
  shapeLabel: string;
  summaryLabel: string;
  actionNotes: string[];
  blockerNotes: BlockerInsight[];
  debugLabel: string;
}

export interface BoardTexture {
  label: string;
  detail: string;
  flushRisk: boolean;
  straightRisk: boolean;
}

export interface SizingFamilyDefinition {
  key: SizingFamilyKey;
  label: string;
  thresholdDescription: string;
  teachingNote: string;
  typicalUseCases: string[];
}

export interface SpotStrategyRecord {
  key: SpotTag;
  label: string;
  summary: string;
  objective: string;
  defaultNotes: string[];
  commonMistakes: string[];
  sizingFamilies: SizingFamilyKey[];
  confidence: StrategyConfidence;
  relatedConcepts?: string[];
  relatedDrillSetIds?: string[];
}

export interface ActionPreferenceRecord {
  id: string;
  spotKey: SpotTag;
  handClass: CoachHandClass;
  preferredActions: string[];
  fallbackActions: string[];
  preferredSizing?: SizingFamilyKey;
  note: string;
  caution?: string;
  confidence: StrategyConfidence;
}

export interface StrategySelectionDebug {
  spotKey: SpotTag;
  handClass: CoachHandClass;
  confidence: StrategyConfidence | "fallback";
  sizingFamily?: SizingFamilyKey;
  spotSummary?: string;
  preferenceId?: string;
}

export interface ProgressConceptDefinition {
  id: ConceptId;
  label: string;
  description: string;
  relatedSpotKeys: SpotTag[];
  drillPackIds?: string[];
}

export interface ConceptDecisionLink {
  conceptId: ConceptId;
  decisionId: string;
  timestamp: string;
  tone: OutcomeTone;
  userAction: EngineAction;
  spotKey: SpotTag;
}

export interface ConceptProgressSummary {
  conceptId: ConceptId;
  label: string;
  description: string;
  totalAttempts: number;
  correctCount: number;
  acceptableCount: number;
  mistakeCount: number;
  successRate: number;
  mistakeRate: number;
  recentSuccessRate: number | null;
  trendDelta: number | null;
  trendLabel: "improving" | "flat" | "slipping" | "insufficient_data";
  weakestSignals: string[];
  relatedSpotKeys: SpotTag[];
  recommendedDrillPackIds: string[];
}

export interface DrillRecommendation {
  conceptId: ConceptId;
  label: string;
  drillPackIds: string[];
}

export interface BotArchetypeProfile {
  id: BotStyle;
  label: string;
  description: string;
  preflopLooseness: number;
  aggressionLevel: number;
  bluffFrequencyBias: number;
  callingTendency: number;
  foldingTendency: number;
  cBetFrequencyBias: number;
  raiseFrequencyBias: number;
  coachNote: string;
}

export interface CoachReasoning {
  situation: string;
  hand: string;
  analysis: string | null;
  recommendation: string;
  tip: string;
  mixLabel: string;
}

export interface CoachRecommendation {
  phase: "preflop" | "postflop";
  probs: Partial<Record<EngineAction, number>>;
  sizing: Partial<Record<"bet" | "raise", number>>;
  spot?: SpotClassification;
  equity?: number;
  potOdds?: number;
  pot?: number;
  owe?: number;
  oppRange?: RangeInfo;
  inferredRange?: InferredRangeSummary;
  texture?: BoardTexture;
  strategySelection?: StrategySelectionDebug;
  reasoning: CoachReasoning;
}

export interface CoachEvaluation {
  verdict: string;
  tone: OutcomeTone;
  explanation: string;
  probability: number;
}

export interface BotDecision {
  action: EngineAction;
  amount?: number;
}

export interface SessionStats {
  hands: number;
  heroWins: number;
  botWins: number;
  ties: number;
  netChips: number;
  startingStack: number;
  goodChoices: number;
  mixedChoices: number;
  badChoices: number;
}

export interface ReplayStateSnapshot {
  street: Street;
  board: Card[];
  pot: number;
  heroStack: number;
  botStack: number;
  heroCommitted: number;
  botCommitted: number;
  currentBet: number;
  minRaiseAmount: number;
  toAct: Actor | null;
  heroHasActed: boolean;
  botHasActed: boolean;
  lastAggressor: Actor | null;
  handOver: boolean;
  result: HandResult | null;
}

export interface SpotMetadata {
  street: Street;
  potType: PotType;
  position: PositionLabel;
  initiative: Actor | "neutral" | "unknown";
  facingAction: FacingAction;
  texture: BoardClass | null;
  priorActionPattern: string;
  facingBetSize: BetSizeBand;
}

export interface SpotClassification {
  key: SpotTag;
  label: string;
  street: Street;
  position: PositionLabel;
  potType: PotType;
  initiative: Actor | "neutral" | "unknown";
  facingAction: FacingAction;
  texture: BoardClass | null;
  priorActionPattern: string;
  metadata: SpotMetadata;
}

export interface SpotDefinition {
  tag: SpotTag;
  label: string;
  description: string;
}

export interface DrillScenario {
  id: string;
  spotKey: SpotTag;
  title: string;
  teachingNote?: string;
  focusArea?: string;
  effectiveStackBb: number;
  blinds: {
    sb: number;
    bb: number;
  };
  heroPosition: "button" | "big_blind";
  villainPosition: "button" | "big_blind";
  heroHole: Card[];
  board: Card[];
  pot: number;
  heroCommitted: number;
  botCommitted: number;
  heroStack: number;
  botStack: number;
  currentBet: number;
  minRaiseAmount?: number;
  street: Exclude<Street, "idle" | "showdown">;
  toAct: Actor;
  actionHistory: ActionHistoryEntry[];
  legalActions: EngineAction[];
}

export interface DrillPack {
  id: string;
  title: string;
  description: string;
  spotKey: SpotTag | "mixed";
  scenarios: DrillScenario[];
}

export interface DrillResult {
  scenarioId: string;
  spotKey: SpotTag;
  action: EngineAction;
  amount?: number;
  tone: OutcomeTone;
  verdict: string;
  explanation: string;
  recommendedMix?: string;
}

export interface DrillSession {
  pack: DrillPack;
  index: number;
  current: DrillScenario;
  results: DrillResult[];
  awaitingAdvance: boolean;
}

export interface SavedCoachEvaluation {
  verdict: string;
  tone: OutcomeTone;
  explanation: string;
  probability: number;
}

export interface SavedCoachSnapshot {
  spotKey: SpotTag;
  spotLabel: string;
  recommendation: CoachRecommendation;
}

export interface HandHistoryActionEvent {
  type: "action";
  index: number;
  street: Street;
  actor: Actor;
  action: EngineAction;
  amount?: number;
  potBefore: number;
  potAfter: number;
  boardAfter: Card[];
  stateAfter: ReplayStateSnapshot;
  isHeroDecision: boolean;
  coachSnapshot?: SavedCoachSnapshot;
  agreement?: SavedCoachEvaluation;
}

export interface HandHistoryStreetTransitionEvent {
  type: "street_transition";
  index: number;
  fromStreet: Street;
  toStreet: Street;
  boardAfter: Card[];
  stateAfter: ReplayStateSnapshot;
}

export interface HandHistoryShowdownEvent {
  type: "showdown";
  index: number;
  street: "showdown";
  boardAfter: Card[];
  stateAfter: ReplayStateSnapshot;
}

export type HandHistoryEvent =
  | HandHistoryActionEvent
  | HandHistoryStreetTransitionEvent
  | HandHistoryShowdownEvent;

export interface SavedHandPlayerInfo {
  heroName: string;
  villainName: string;
  heroSeat: "button_sb" | "big_blind";
  villainSeat: "button_sb" | "big_blind";
}

export interface SavedHandInitialState {
  heroHole: Card[];
  villainHole: Card[];
  board: Card[];
  state: ReplayStateSnapshot;
}

export interface SavedHandSummary {
  outcome: "hero_win" | "villain_win" | "split";
  resultReason: HandResult["reason"] | "unknown";
  showdown: boolean;
  allIn: boolean;
  winner: HandResult["winner"] | "unknown";
  finalPot: number;
  heroDeltaChips: number;
  villainDeltaChips: number;
  heroDeltaBb: number;
  villainDeltaBb: number;
  heroFinalStack: number;
  villainFinalStack: number;
  heroHandName?: string;
  villainHandName?: string;
  coachAgreement: {
    good: number;
    mixed: number;
    bad: number;
  };
}

export interface SavedHandTags {
  bookmarked: boolean;
  spotTags: HandHistorySpotTag[];
  reviewTags: ReviewTag[];
}

export interface SavedHandHistory {
  id: string;
  version: number;
  timestamp: string;
  table: {
    bigBlind: number;
    smallBlind: number;
    startingStack: number;
    startingStackBb: number;
    botStyle: BotStyle;
  };
  players: SavedHandPlayerInfo;
  initial: SavedHandInitialState;
  events: HandHistoryEvent[];
  actionLog: ActionHistoryEntry[];
  summary: SavedHandSummary;
  tags: SavedHandTags;
}

export interface HandHistoryStore {
  version: number;
  hands: SavedHandHistory[];
}

export interface SavedDecisionRecord {
  id: string;
  version: number;
  timestamp: string;
  sourceType: "live" | "drill";
  handId?: string;
  scenarioId?: string;
  drillSetId?: string;
  street: Street;
  spotKey: SpotTag;
  heroPosition: PositionLabel;
  board: Card[];
  heroHand: Card[];
  potSize: number;
  effectiveStack: number;
  actionOptions: EngineAction[];
  userAction: EngineAction;
  sizingChosen?: number;
  coachRecommendation: {
    mixLabel: string;
    actionText: string;
  };
  coachEvaluation: SavedCoachEvaluation;
  explanationSnapshot: string;
  inferredRangeSummary?: InferredRangeSummary;
  tags: StudyTag[];
}

export interface SavedDrillAttempt {
  id: string;
  version: number;
  timestamp: string;
  scenarioId: string;
  drillSetId?: string;
  spotKey: SpotTag;
  userAction: EngineAction;
  sizingChosen?: number;
  coachEvaluation: SavedCoachEvaluation;
  explanationSnapshot: string;
  recommendedMix?: string;
  tags: StudyTag[];
}

export interface SavedSessionSummary {
  id: string;
  version: number;
  timestampStart: string;
  timestampEnd: string;
  mode: "live" | "drill";
  handsPlayed: number;
  decisionsTracked: number;
  drillAttempts: number;
  mistakesFlagged: number;
  spotBreakdown: Partial<Record<SpotTag, number>>;
}

export interface StudyStore {
  version: number;
  hands: SavedHandHistory[];
  decisions: SavedDecisionRecord[];
  drillAttempts: SavedDrillAttempt[];
  sessions: SavedSessionSummary[];
}
