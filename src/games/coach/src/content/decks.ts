import type { Card, DeckKey } from "../core/types";

export interface DeckDefinition {
  key: DeckKey;
  label: string;
  kind: "svg" | "image";
  assetBaseName?: string;
}

export const DECKS: DeckDefinition[] = [
  { key: "classic", label: "Classic SVG", kind: "svg" },
  { key: "deadman", label: "Deadman", kind: "image", assetBaseName: "deadman" },
  { key: "egyptian", label: "Egyptian", kind: "image", assetBaseName: "egyptian" },
  { key: "karnival", label: "Karnival", kind: "image", assetBaseName: "karnival" },
  { key: "phoenix", label: "Phoenix", kind: "image", assetBaseName: "phoenix" },
  { key: "ufo", label: "UFO", kind: "image", assetBaseName: "ufo" }
];

const SUIT_SUFFIX: Record<string, string> = {
  s: "S",
  h: "H",
  d: "D",
  c: "C"
};

export const DEFAULT_DECK: DeckKey = "classic";

const deckImageUrls = import.meta.glob("../assets/decks/**/*.jpg", {
  eager: true,
  query: "?url",
  import: "default"
}) as Record<string, string>;

const assetUrl = (path: string): string | null => {
  return deckImageUrls[`../assets/${path}`] ?? null;
};

export function getDeck(deckKey: DeckKey): DeckDefinition {
  return DECKS.find((deck) => deck.key === deckKey) || DECKS[0];
}

export function getDeckImageUrl(deckKey: DeckKey, card: Card | null, faceDown: boolean): string | null {
  const deck = getDeck(deckKey);
  if (deck.kind !== "image" || !deck.assetBaseName) {
    return null;
  }

  if (faceDown || !card) {
    return assetUrl(`decks/${deck.key}/${deck.assetBaseName}back.jpg`);
  }

  const rank = card[0];
  const suit = card[1];
  return assetUrl(`decks/${deck.key}/${deck.assetBaseName}${rank}_${SUIT_SUFFIX[suit]}.jpg`);
}
