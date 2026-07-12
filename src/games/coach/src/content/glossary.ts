export interface GlossaryEntry {
  label: string;
  short: string;
}

const GLOSSARY: Record<string, GlossaryEntry> = {
  sb: {
    label: "Small Blind (SB)",
    short: "The smaller of the two forced bets posted before cards are dealt. In heads-up, the SB sits on the button - first to act preflop, last on every later street."
  },
  bb: {
    label: "Big Blind (BB)",
    short: "The larger of the two forced bets. BB is also used as a unit of stack size - 50bb means 50 big blinds deep."
  },
  button: {
    label: "Button",
    short: "The dealer position. In heads-up, the button is always the small blind - first to act preflop, last postflop."
  },
  blinds: {
    label: "Blinds",
    short: "The forced bets posted each hand. They keep action moving."
  },
  headsup: {
    label: "Heads-up (HU)",
    short: "A two-player game. Ranges widen because there are fewer hands that can beat you, and position matters every street."
  },
  preflop: {
    label: "Preflop",
    short: "Before any community cards are dealt. Action begins with the SB in heads-up."
  },
  flop: {
    label: "Flop",
    short: "The first three community cards, dealt face-up together after preflop betting."
  },
  turn: {
    label: "Turn",
    short: "The fourth community card."
  },
  river: {
    label: "River",
    short: "The fifth and final community card. Every hand is fully realized."
  },
  showdown: {
    label: "Showdown",
    short: "When all betting is done and remaining players reveal their hole cards to decide the winner."
  },
  pot: {
    label: "Pot",
    short: "The total chips being contested in the current hand."
  },
  potodds: {
    label: "Pot odds",
    short: "The price you're getting on a call: amount to call divided by pot plus amount to call."
  },
  equity: {
    label: "Equity",
    short: "Your share of the pot if the hand were run out many times from here."
  },
  range: {
    label: "Range",
    short: "The full set of hands a player could have in this spot, not one specific holding."
  },
  fold: {
    label: "Fold",
    short: "Give up the hand and avoid further risk."
  },
  check: {
    label: "Check",
    short: "Pass the action without betting. Only legal when there's no bet to call."
  },
  call: {
    label: "Call",
    short: "Match the current bet to stay in the hand."
  },
  bet: {
    label: "Bet",
    short: "Put chips in when no one has bet yet on this street."
  },
  raise: {
    label: "Raise",
    short: "Increase an existing bet."
  },
  threebet: {
    label: "3-bet",
    short: "A reraise preflop."
  },
  allin: {
    label: "All-in",
    short: "Betting or calling with your entire remaining stack."
  },
  cbet: {
    label: "Continuation bet (c-bet)",
    short: "When the preflop aggressor bets again on the flop."
  },
  checkraise: {
    label: "Check-raise",
    short: "Check to the opponent, then raise when they bet."
  },
  minraise: {
    label: "Min-raise",
    short: "The smallest legal raise."
  },
  position: {
    label: "Position",
    short: "Where you sit in the betting order. Acting last is a major edge."
  },
  ip: {
    label: "In position (IP)",
    short: "Acting last on the current street."
  },
  oop: {
    label: "Out of position (OOP)",
    short: "Acting first on the current street."
  },
  suited: {
    label: "Suited",
    short: "Two hole cards of the same suit."
  },
  offsuit: {
    label: "Offsuit",
    short: "Two hole cards of different suits."
  },
  connector: {
    label: "Connector",
    short: "Two adjacent-rank cards like 87 or JT."
  },
  gapper: {
    label: "Gapper",
    short: "Two hole cards with a small rank gap."
  },
  broadway: {
    label: "Broadway",
    short: "The high cards: Ten, Jack, Queen, King, Ace."
  },
  pocketpair: {
    label: "Pocket pair",
    short: "Two hole cards of the same rank, like 99."
  },
  overpair: {
    label: "Overpair",
    short: "A pocket pair higher than every card on the board."
  },
  toppair: {
    label: "Top pair",
    short: "Pairing the highest card on the board with one of your hole cards."
  },
  overcards: {
    label: "Overcards",
    short: "Hole cards higher than any card on the board."
  },
  premium: {
    label: "Premium",
    short: "The strongest starting hands."
  },
  flushdraw: {
    label: "Flush draw",
    short: "Four cards of the same suit, needing one more to complete a flush."
  },
  straightdraw: {
    label: "Straight draw",
    short: "Four consecutive ranks needing one more to make a straight."
  },
  draw: {
    label: "Draw",
    short: "A hand that isn't made yet but can improve on later streets."
  },
  outs: {
    label: "Outs",
    short: "The unseen cards that improve your hand to the likely winner."
  },
  drytexture: {
    label: "Dry board",
    short: "A flop with few draws and little coordination."
  },
  wettexture: {
    label: "Wet board",
    short: "A flop loaded with straight and flush possibilities."
  },
  pairedboard: {
    label: "Paired board",
    short: "A board where two community cards match rank."
  },
  monotone: {
    label: "Monotone board",
    short: "A board where every visible card shares one suit."
  },
  rainbow: {
    label: "Rainbow board",
    short: "A board where every card is a different suit."
  },
  twotone: {
    label: "Two-tone board",
    short: "A board with exactly two suits present."
  },
  valuebet: {
    label: "Value bet",
    short: "A bet made expecting to be called by worse hands."
  },
  bluff: {
    label: "Bluff",
    short: "Betting or raising with a weak hand trying to make a better hand fold."
  },
  semibluff: {
    label: "Semi-bluff",
    short: "A bluff with backup equity."
  },
  stack: {
    label: "Stack",
    short: "The chips a player has in front of them, available to bet."
  },
  deepstack: {
    label: "Deep stack",
    short: "Stacks much larger than the blinds."
  },
  shortstack: {
    label: "Short stack",
    short: "Stacks small relative to the blinds."
  }
};

const PHRASES: Record<string, string[]> = {
  sb: ["small blind", "SB"],
  bb: ["big blind", "BB"],
  button: ["on the button", "dealer button", "the button", "button"],
  blinds: ["blinds"],
  headsup: ["heads-up", "heads up"],
  preflop: ["preflop", "pre-flop"],
  flop: ["flop"],
  turn: ["turn"],
  river: ["river"],
  showdown: ["showdown"],
  pot: ["pot"],
  potodds: ["pot odds"],
  equity: ["equity"],
  range: ["defending range", "opening range", "range"],
  fold: ["fold"],
  check: ["check"],
  call: ["call"],
  bet: ["bet"],
  raise: ["raise"],
  threebet: ["3-bet", "3bet", "three-bet"],
  allin: ["all-in", "all in"],
  cbet: ["continuation bet", "c-bet", "cbet"],
  checkraise: ["check-raise", "check raise"],
  minraise: ["min-raise", "minimum raise"],
  position: ["in position", "out of position", "position"],
  ip: ["IP"],
  oop: ["OOP"],
  suited: ["suited"],
  offsuit: ["offsuit"],
  connector: ["suited connector", "offsuit connector", "connector"],
  gapper: ["suited gapper", "gapper"],
  broadway: ["broadway"],
  pocketpair: ["pocket pair"],
  overpair: ["overpair"],
  toppair: ["top pair"],
  overcards: ["overcards"],
  premium: ["premium"],
  flushdraw: ["flush draw"],
  straightdraw: ["straight draw"],
  draw: ["draw"],
  outs: ["outs"],
  drytexture: ["dry board", "dry"],
  wettexture: ["wet board", "wet"],
  pairedboard: ["paired board", "paired"],
  monotone: ["monotone"],
  rainbow: ["rainbow"],
  twotone: ["two-tone"],
  valuebet: ["value bet", "for value"],
  bluff: ["bluff"],
  semibluff: ["semi-bluff"],
  stack: ["stack"],
  deepstack: ["deep stack"],
  shortstack: ["short stack"]
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const orderedKeys = Object.keys(PHRASES).sort((left, right) => {
  const leftLongest = Math.max(...PHRASES[left].map((phrase) => phrase.length));
  const rightLongest = Math.max(...PHRASES[right].map((phrase) => phrase.length));
  return rightLongest - leftLongest;
});

const phraseRegexes = Object.fromEntries(
  orderedKeys.map((key) => {
    const pattern = PHRASES[key]
      .slice()
      .sort((left, right) => right.length - left.length)
      .map(escapeRegex)
      .join("|");
    return [key, new RegExp(`(?<![A-Za-z])(?:${pattern})s?(?![A-Za-z])`, "i")];
  })
);

let tooltipElement: HTMLDivElement | null = null;

export const glossaryTerms = GLOSSARY;

export function annotateGlossary(html: string): string {
  if (!html) {
    return html;
  }

  let nextHtml = html;
  const used: Record<string, boolean> = {};

  for (const key of orderedKeys) {
    if (used[key]) continue;
    const parts = nextHtml.split(/(<[^>]*>)/g);
    let found = false;
    let termDepth = 0;

    for (let index = 0; index < parts.length && !found; index += 1) {
      const segment = parts[index];
      if (!segment) continue;

      if (segment.startsWith("<")) {
        if (segment.startsWith("<span") && segment.includes('class="term"')) termDepth += 1;
        else if (/^<\/span>/i.test(segment) && termDepth > 0) termDepth -= 1;
        continue;
      }

      if (termDepth > 0) continue;

      const match = phraseRegexes[key].exec(segment);
      if (!match) continue;

      parts[index] =
        segment.slice(0, match.index) +
        `<span class="term" data-term="${key}" tabindex="0">${match[0]}</span>` +
        segment.slice(match.index + match[0].length);
      found = true;
    }

    if (found) {
      used[key] = true;
      nextHtml = parts.join("");
    }
  }

  return nextHtml;
}

function ensureTooltip(): HTMLDivElement {
  if (tooltipElement) {
    return tooltipElement;
  }

  tooltipElement = document.createElement("div");
  tooltipElement.className = "term-tooltip";
  tooltipElement.setAttribute("role", "tooltip");
  tooltipElement.style.display = "none";
  document.body.appendChild(tooltipElement);
  return tooltipElement;
}

function positionTooltip(anchor: HTMLElement, tooltip: HTMLDivElement): void {
  const rect = anchor.getBoundingClientRect();
  tooltip.style.visibility = "hidden";
  tooltip.style.display = "block";

  const tooltipWidth = tooltip.offsetWidth;
  const tooltipHeight = tooltip.offsetHeight;
  const scrollX = window.scrollX || window.pageXOffset || 0;
  const scrollY = window.scrollY || window.pageYOffset || 0;
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;

  let top = rect.bottom + scrollY + 8;
  const spaceBelow = window.innerHeight - rect.bottom;
  if (spaceBelow < tooltipHeight + 16 && rect.top > tooltipHeight + 16) {
    top = rect.top + scrollY - tooltipHeight - 8;
  }

  let left = rect.left + scrollX + rect.width / 2 - tooltipWidth / 2;
  const minLeft = scrollX + 8;
  const maxLeft = scrollX + viewportWidth - tooltipWidth - 8;
  if (left < minLeft) left = minLeft;
  if (left > maxLeft) left = maxLeft;

  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
  tooltip.style.visibility = "";
}

function showTooltip(anchor: HTMLElement): void {
  const key = anchor.getAttribute("data-term") || "";
  const entry = GLOSSARY[key];
  if (!entry) {
    return;
  }

  const tooltip = ensureTooltip();
  tooltip.innerHTML =
    `<div class="term-label">${entry.label}</div>` +
    `<div class="term-short">${entry.short}</div>`;
  positionTooltip(anchor, tooltip);
}

function hideTooltip(): void {
  if (tooltipElement) {
    tooltipElement.style.display = "none";
  }
}

export function initGlossaryTooltips(): void {
  document.addEventListener("mouseover", (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest(".term") : null;
    if (target instanceof HTMLElement) {
      showTooltip(target);
    }
  });

  document.addEventListener("mouseout", (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest(".term") : null;
    if (target instanceof HTMLElement) {
      hideTooltip();
    }
  });

  document.addEventListener("focusin", (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest(".term") : null;
    if (target instanceof HTMLElement) {
      showTooltip(target);
    }
  });

  document.addEventListener("focusout", (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest(".term") : null;
    if (target instanceof HTMLElement) {
      hideTooltip();
    }
  });

  window.addEventListener("scroll", hideTooltip, true);
  window.addEventListener("resize", hideTooltip);
}
