export const CANONICAL_DECKS = [
  {
    id: 1,
    displayNumber: '01',
    name: 'TRANSFER BAY',
    shortName: 'TRANSFER',
    role: 'signal recovery and host reconstruction',
    paletteHint: 'muted blue/grey',
    expectedThreatSeries: '0xx-2xx'
  },
  {
    id: 2,
    displayNumber: '02',
    name: 'SERVICE RING',
    shortName: 'SERVICE',
    role: 'maintenance and low-tier machine support',
    paletteHint: 'green/teal',
    expectedThreatSeries: '1xx-3xx'
  },
  {
    id: 3,
    displayNumber: '03',
    name: 'CARGO SPINE',
    shortName: 'CARGO',
    role: 'cargo movement and worker systems',
    paletteHint: 'amber/orange',
    expectedThreatSeries: '2xx-4xx'
  },
  {
    id: 4,
    displayNumber: '04',
    name: 'RELAY GALLERIA',
    shortName: 'RELAY',
    role: 'signal routing and mobile courier traffic',
    paletteHint: 'violet/purple',
    expectedThreatSeries: '3xx-5xx'
  },
  {
    id: 5,
    displayNumber: '05',
    name: 'SECURITY CONCOURSE',
    shortName: 'SECURITY',
    role: 'patrol command and defensive screening',
    paletteHint: 'cold cyan',
    expectedThreatSeries: '4xx-6xx'
  },
  {
    id: 6,
    displayNumber: '06',
    name: 'ASSAULT LOCKS',
    shortName: 'ASSAULT',
    role: 'combat shell deployment and breach control',
    paletteHint: 'warning gold',
    expectedThreatSeries: '5xx-7xx'
  },
  {
    id: 7,
    displayNumber: '07',
    name: 'FOUNDRY CORE',
    shortName: 'FOUNDRY',
    role: 'industrial armor and thermal machinery',
    paletteHint: 'burnt orange',
    expectedThreatSeries: '6xx-8xx'
  },
  {
    id: 8,
    displayNumber: '08',
    name: 'HUNTER GRID',
    shortName: 'HUNTER',
    role: 'pursuit systems and active threat tracking',
    paletteHint: 'violet',
    expectedThreatSeries: '7xx-8xx'
  },
  {
    id: 9,
    displayNumber: '09',
    name: 'DOMINION VAULT',
    shortName: 'DOMINION',
    role: 'elite autonomy and command storage',
    paletteHint: 'magenta',
    expectedThreatSeries: '8xx-9xx'
  },
  {
    id: 10,
    displayNumber: '10',
    name: 'NULL CATHEDRAL',
    shortName: 'NULL',
    role: 'core intelligence and terminal authority',
    paletteHint: 'white-violet',
    expectedThreatSeries: '9xx'
  }
];

export function getDeckInfo(deckId) {
  return CANONICAL_DECKS.find((deck) => deck.id === deckId) ?? {
    id: deckId,
    displayNumber: String(deckId).padStart(2, '0'),
    name: `DECK ${String(deckId).padStart(2, '0')}`,
    shortName: `D${deckId}`,
    role: 'unknown machine sector',
    paletteHint: 'generated',
    expectedThreatSeries: 'unknown'
  };
}

export function formatDeckTitle(deckId) {
  const deck = getDeckInfo(deckId);
  return `DECK ${deck.displayNumber} - ${deck.name}`;
}
