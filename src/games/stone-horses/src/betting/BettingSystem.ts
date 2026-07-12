import { createSeededRng } from "../utils/seededRng";
import { RaceResult } from "../world/RaceController";

export type BetType =
  | "win"
  | "place"
  | "show"
  | "across"
  | "exacta"
  | "exacta-box"
  | "quinella"
  | "trifecta"
  | "trifecta-box"
  | "superfecta"
  | "superfecta-box"
  | "daily-double"
  | "pick-3";

export interface MarbleOdds {
  marbleId: string;
  win: number;
  place: number;
  show: number;
}

export interface BetSlip {
  id: string;
  type: BetType;
  marbleId: string;
  secondMarbleId: string | null;
  marbleIds: string[];
  stake: number;
  odds: number;
}

export interface SettledBet extends BetSlip {
  won: boolean;
  payout: number;
}

const bankrollStorageKey = "stone-horses-bankroll";
const defaultBankroll = 1000;

export class BettingSystem {
  bankroll: number;
  readonly odds: MarbleOdds[];
  readonly bets: BetSlip[] = [];
  settledBets: SettledBet[] = [];
  private locked = false;
  private settled = false;

  constructor(
    marbleIds: string[],
    seed: string,
    private readonly onChange: () => void,
  ) {
    this.bankroll = readBankroll();
    this.odds = createOdds(marbleIds, seed);
  }

  get isLocked(): boolean {
    return this.locked;
  }

  get hasSettled(): boolean {
    return this.settled;
  }

  get totalStaked(): number {
    return this.bets.reduce((total, bet) => total + bet.stake, 0);
  }

  placeBet(type: BetType, marbleId: string, secondMarbleId: string | null, stake: number, marbleIds = [marbleId]): string | null {
    if (this.locked) {
      return "Bets are locked.";
    }

    if (!Number.isFinite(stake) || stake <= 0) {
      return "Enter a valid stake.";
    }

    if (stake > this.bankroll) {
      return "Stake exceeds bankroll.";
    }

    const requiredSelections = getRequiredSelectionCount(type);
    const selections = normalizeSelections(marbleIds, marbleId, secondMarbleId).slice(0, requiredSelections);

    if (selections.length < requiredSelections) {
      return `${getBetLabel(type)} needs ${requiredSelections} selections.`;
    }

    if (new Set(selections).size !== selections.length) {
      return `${getBetLabel(type)} needs different marbles.`;
    }

    const odds = this.getBetOdds(type, selections);

    this.bankroll -= stake;
    this.bets.push({
      id: `B${this.bets.length + 1}`,
      type,
      marbleId: selections[0],
      secondMarbleId: selections[1] ?? null,
      marbleIds: selections,
      stake,
      odds,
    });
    writeBankroll(this.bankroll);
    this.onChange();

    return null;
  }

  lockBets(): void {
    this.locked = true;
    this.onChange();
  }

  settle(results: RaceResult[]): void {
    if (this.settled) {
      return;
    }

    this.locked = true;
    this.settled = true;
    this.settledBets = this.bets.map((bet) => settleBet(bet, results));
    this.bankroll += this.settledBets.reduce((total, bet) => total + bet.payout, 0);
    writeBankroll(this.bankroll);
    this.onChange();
  }

  getOdds(marbleId: string, type: "win" | "place" | "show"): number {
    const odds = this.odds.find((entry) => entry.marbleId === marbleId);

    if (!odds) {
      return 1;
    }

    return odds[type];
  }

  getExactaOdds(firstMarbleId: string, secondMarbleId: string): number {
    const first = this.getOdds(firstMarbleId, "win");
    const second = this.getOdds(secondMarbleId, "place");

    return roundOdds(first * second * 0.72 + 4);
  }

  getBetOdds(type: BetType, marbleIds: string[]): number {
    const [first, second, third, fourth] = marbleIds;

    if (type === "win" || type === "place" || type === "show") {
      return this.getOdds(first, type);
    }

    if (type === "across") {
      return roundOdds((this.getOdds(first, "win") + this.getOdds(first, "place") + this.getOdds(first, "show")) / 3);
    }

    if (type === "exacta") {
      return this.getExactaOdds(first, second);
    }

    if (type === "exacta-box") {
      return roundOdds(this.getExactaOdds(first, second) * 0.58);
    }

    if (type === "quinella") {
      return roundOdds(this.getExactaOdds(first, second) * 0.46);
    }

    if (type === "trifecta" || type === "daily-double" || type === "pick-3") {
      return roundOdds(this.getExactaOdds(first, second) * this.getOdds(third, "show") * 0.64 + 8);
    }

    if (type === "trifecta-box") {
      return roundOdds(this.getExactaOdds(first, second) * this.getOdds(third, "show") * 0.18 + 5);
    }

    if (type === "superfecta") {
      return roundOdds(this.getExactaOdds(first, second) * this.getOdds(third, "show") * this.getOdds(fourth, "show") * 0.42 + 14);
    }

    return roundOdds(this.getExactaOdds(first, second) * this.getOdds(third, "show") * this.getOdds(fourth, "show") * 0.06 + 7);
  }
}

export function resetBankroll(): void {
  writeBankroll(defaultBankroll);
}

function createOdds(marbleIds: string[], seed: string): MarbleOdds[] {
  const rng = createSeededRng(`${seed}:odds`);
  const strengths = marbleIds.map((marbleId) => ({
    marbleId,
    strength: rng.nextBetween(0.75, 1.35),
  }));
  const strengthTotal = strengths.reduce((total, entry) => total + entry.strength, 0);

  return strengths.map((entry) => {
    const winProbability = entry.strength / strengthTotal;
    const win = roundOdds(0.9 / winProbability);

    return {
      marbleId: entry.marbleId,
      win,
      place: roundOdds(Math.max(1.25, win * 0.42)),
      show: roundOdds(Math.max(1.1, win * 0.25)),
    };
  });
}

function settleBet(bet: BetSlip, results: RaceResult[]): SettledBet {
  const completedResults = results.filter((result) => !result.forced);
  const finishOrder = completedResults.map((result) => result.marbleId);
  const resultIndex = finishOrder.indexOf(bet.marbleId);
  const selected = bet.marbleIds.length > 0 ? bet.marbleIds : [bet.marbleId, bet.secondMarbleId].filter((id): id is string => Boolean(id));
  const won = didBetWin(bet.type, selected, finishOrder, resultIndex);
  const payout = bet.type === "across" ? settleAcrossBoard(bet, finishOrder) : won ? roundMoney(bet.stake * bet.odds) : 0;

  return {
    ...bet,
    won: won || payout > 0,
    payout,
  };
}

export function getRequiredSelectionCount(type: BetType): number {
  if (type === "exacta" || type === "exacta-box" || type === "quinella") return 2;
  if (type === "trifecta" || type === "trifecta-box" || type === "daily-double" || type === "pick-3") return 3;
  if (type === "superfecta" || type === "superfecta-box") return 4;

  return 1;
}

function normalizeSelections(marbleIds: string[], marbleId: string, secondMarbleId: string | null): string[] {
  return [...marbleIds, marbleId, secondMarbleId].filter((id): id is string => Boolean(id)).filter((id, index, ids) => ids.indexOf(id) === index);
}

function getBetLabel(type: BetType): string {
  return type
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function didBetWin(type: BetType, selected: string[], finishOrder: string[], resultIndex: number): boolean {
  if (type === "win") return resultIndex === 0;
  if (type === "place") return resultIndex >= 0 && resultIndex <= 1;
  if (type === "show") return resultIndex >= 0 && resultIndex <= 2;
  if (type === "across") return resultIndex >= 0 && resultIndex <= 2;
  if (type === "exacta") return finishOrder[0] === selected[0] && finishOrder[1] === selected[1];
  if (type === "exacta-box" || type === "quinella") return selected.every((id) => finishOrder.slice(0, 2).includes(id));
  if (type === "trifecta" || type === "daily-double" || type === "pick-3") {
    return finishOrder[0] === selected[0] && finishOrder[1] === selected[1] && finishOrder[2] === selected[2];
  }
  if (type === "trifecta-box") return selected.every((id) => finishOrder.slice(0, 3).includes(id));
  if (type === "superfecta") {
    return finishOrder[0] === selected[0] && finishOrder[1] === selected[1] && finishOrder[2] === selected[2] && finishOrder[3] === selected[3];
  }

  return selected.every((id) => finishOrder.slice(0, 4).includes(id));
}

function settleAcrossBoard(bet: BetSlip, finishOrder: string[]): number {
  const index = finishOrder.indexOf(bet.marbleId);
  const legStake = bet.stake / 3;
  let payout = 0;

  if (index === 0) payout += legStake * bet.odds;
  if (index >= 0 && index <= 1) payout += legStake * Math.max(1.2, bet.odds * 0.45);
  if (index >= 0 && index <= 2) payout += legStake * Math.max(1.1, bet.odds * 0.28);

  return roundMoney(payout);
}

function readBankroll(): number {
  const value = Number(window.sessionStorage.getItem(bankrollStorageKey));

  return Number.isFinite(value) && value > 0 ? value : defaultBankroll;
}

function writeBankroll(bankroll: number): void {
  window.sessionStorage.setItem(bankrollStorageKey, roundMoney(bankroll).toString());
}

function roundOdds(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
