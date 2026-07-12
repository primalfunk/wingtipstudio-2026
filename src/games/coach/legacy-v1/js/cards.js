/* Ultra-simple SVG card renderer. Swappable with image assets later:
 * just replace cardSVG() output with <img src="assets/cards/As.png"> etc.
 */
(function (global) {
  "use strict";

  const SUIT_GLYPH = { s: "\u2660", h: "\u2665", d: "\u2666", c: "\u2663" };
  const SUIT_COLOR = { s: "#111", c: "#111", h: "#c0392b", d: "#c0392b" };

  function displayRank(r) { return r === "T" ? "10" : r; }

  function cardSVG(card, opts) {
    opts = opts || {};
    const w = opts.width || 58;
    const h = opts.height || 82;

    if (!card || opts.faceDown) {
      return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h +
        '" viewBox="0 0 58 82" class="card back">' +
          '<rect x="1" y="1" width="56" height="80" rx="6" fill="#1a3a5c" stroke="#0b1c30" stroke-width="1.5"/>' +
          '<rect x="5" y="5" width="48" height="72" rx="3" fill="none" stroke="#3a6a9c" stroke-width="1.2" stroke-dasharray="3 3"/>' +
          '<text x="29" y="48" text-anchor="middle" font-family="serif" font-size="22" fill="#3a6a9c" font-style="italic">&#9824;</text>' +
        "</svg>"
      );
    }

    const r = card[0];
    const s = card[1];
    const glyph = SUIT_GLYPH[s] || "?";
    const color = SUIT_COLOR[s] || "#111";
    const rankTxt = displayRank(r);
    const isTen = rankTxt === "10";
    // "10" needs a smaller font to fit the same corner footprint as single-char ranks.
    const cornerRankSize = isTen ? 12 : 15;
    const cornerSuitSize = 11;
    const centerGlyphSize = 34;

    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h +
      '" viewBox="0 0 58 82" class="card face">' +
        '<rect x="1" y="1" width="56" height="80" rx="6" fill="#fafafa" stroke="#222" stroke-width="1"/>' +
        // Top-left: rank above suit
        '<text x="6" y="17" font-family="system-ui, sans-serif" font-size="' + cornerRankSize +
          '" font-weight="700" fill="' + color + '">' + rankTxt + "</text>" +
        '<text x="6" y="30" font-family="system-ui, sans-serif" font-size="' + cornerSuitSize +
          '" fill="' + color + '">' + glyph + "</text>" +
        // Center suit glyph, larger
        '<text x="29" y="55" text-anchor="middle" font-family="system-ui, sans-serif" font-size="' + centerGlyphSize +
          '" fill="' + color + '">' + glyph + "</text>" +
        // Bottom-right: rotated 180° so the card reads the same from either end
        '<g transform="rotate(180 29 41)">' +
          '<text x="6" y="17" font-family="system-ui, sans-serif" font-size="' + cornerRankSize +
            '" font-weight="700" fill="' + color + '">' + rankTxt + "</text>" +
          '<text x="6" y="30" font-family="system-ui, sans-serif" font-size="' + cornerSuitSize +
            '" fill="' + color + '">' + glyph + "</text>" +
        "</g>" +
      "</svg>"
    );
  }

  global.POKER = global.POKER || {};
  global.POKER.cardSVG = cardSVG;
})(window);
