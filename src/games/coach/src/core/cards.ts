import { getDeck, getDeckImageUrl } from "../content/decks";
import type { Card, DeckKey, Suit } from "./types";

const SUIT_GLYPH: Record<Suit, string> = {
  s: "♠",
  h: "♥",
  d: "♦",
  c: "♣"
};

const SUIT_COLOR: Record<Suit, string> = {
  s: "#111",
  c: "#111",
  h: "#c0392b",
  d: "#c0392b"
};

function displayRank(rank: string): string {
  return rank === "T" ? "10" : rank;
}

export function cardSvg(card: Card | null, opts: { faceDown?: boolean; width?: number; height?: number } = {}): string {
  const width = opts.width ?? 58;
  const height = opts.height ?? 82;

  if (!card || opts.faceDown) {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 58 82" class="card back">` +
        '<rect x="1" y="1" width="56" height="80" rx="6" fill="#1a3a5c" stroke="#0b1c30" stroke-width="1.5"/>' +
        '<rect x="5" y="5" width="48" height="72" rx="3" fill="none" stroke="#3a6a9c" stroke-width="1.2" stroke-dasharray="3 3"/>' +
        '<text x="29" y="48" text-anchor="middle" font-family="serif" font-size="22" fill="#3a6a9c" font-style="italic">&#9824;</text>' +
      "</svg>"
    );
  }

  const rank = card[0];
  const suit = card[1] as Suit;
  const glyph = SUIT_GLYPH[suit];
  const color = SUIT_COLOR[suit];
  const rankText = displayRank(rank);
  const cornerRankSize = rankText === "10" ? 12 : 15;
  const cornerSuitSize = 11;
  const centerGlyphSize = 34;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 58 82" class="card face">` +
      '<rect x="1" y="1" width="56" height="80" rx="6" fill="#fafafa" stroke="#222" stroke-width="1"/>' +
      `<text x="6" y="17" font-family="system-ui, sans-serif" font-size="${cornerRankSize}" font-weight="700" fill="${color}">${rankText}</text>` +
      `<text x="6" y="30" font-family="system-ui, sans-serif" font-size="${cornerSuitSize}" fill="${color}">${glyph}</text>` +
      `<text x="29" y="55" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${centerGlyphSize}" fill="${color}">${glyph}</text>` +
      '<g transform="rotate(180 29 41)">' +
        `<text x="6" y="17" font-family="system-ui, sans-serif" font-size="${cornerRankSize}" font-weight="700" fill="${color}">${rankText}</text>` +
        `<text x="6" y="30" font-family="system-ui, sans-serif" font-size="${cornerSuitSize}" fill="${color}">${glyph}</text>` +
      "</g>" +
    "</svg>"
  );
}

export function renderCardMarkup(
  card: Card | null,
  opts: { faceDown?: boolean; width?: number; height?: number; deck?: DeckKey } = {}
): string {
  const deckKey = opts.deck ?? "classic";
  const deck = getDeck(deckKey);
  const imageUrl = getDeckImageUrl(deckKey, card, !!opts.faceDown);
  const width = opts.width ?? 58;
  const height = opts.height ?? 82;

  if (deck.kind === "image" && imageUrl) {
    const alt = opts.faceDown || !card ? `${deck.label} card back` : `${deck.label} ${card}`;
    return `<img class="card-image" src="${imageUrl}" alt="${alt}" width="${width}" height="${height}" loading="eager" decoding="async" />`;
  }

  return cardSvg(card, opts);
}
