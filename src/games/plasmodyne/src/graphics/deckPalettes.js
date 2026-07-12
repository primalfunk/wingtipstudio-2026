const BASE_PALETTES = [
  {
    floorBase: 0x102333,
    floorLine: 0x23465a,
    wallBase: 0x0b1a26,
    wallHighlight: 0x84dfff,
    wallShadow: 0x07121c,
    accent: 0x9ddfff,
    hazard: 0xff6f61,
    terminalGlow: 0x79f2c0
  },
  {
    floorBase: 0x0f2a24,
    floorLine: 0x236353,
    wallBase: 0x092019,
    wallHighlight: 0x80f4cf,
    wallShadow: 0x061711,
    accent: 0x9cffd7,
    hazard: 0xffc35c,
    terminalGlow: 0x6fffe8
  },
  {
    floorBase: 0x2a2011,
    floorLine: 0x654d25,
    wallBase: 0x1f170b,
    wallHighlight: 0xffc46d,
    wallShadow: 0x151008,
    accent: 0xffd36a,
    hazard: 0xff6f61,
    terminalGlow: 0xffe49a
  },
  {
    floorBase: 0x20172e,
    floorLine: 0x514070,
    wallBase: 0x160f22,
    wallHighlight: 0xc8a7ff,
    wallShadow: 0x0f0a18,
    accent: 0xd9b8ff,
    hazard: 0xff6f9d,
    terminalGlow: 0x8ff5ff
  },
  {
    floorBase: 0x2a121a,
    floorLine: 0x603044,
    wallBase: 0x1e0b12,
    wallHighlight: 0xff84a8,
    wallShadow: 0x14070d,
    accent: 0xff9abc,
    hazard: 0xffd36a,
    terminalGlow: 0xff6f9d
  },
  {
    floorBase: 0x1d2914,
    floorLine: 0x465f2e,
    wallBase: 0x141e0d,
    wallHighlight: 0xb8ef7c,
    wallShadow: 0x0d1508,
    accent: 0xcfff93,
    hazard: 0xff8b5c,
    terminalGlow: 0x8ff5a3
  },
  {
    floorBase: 0x171f36,
    floorLine: 0x35486e,
    wallBase: 0x0f1628,
    wallHighlight: 0xa8c4ff,
    wallShadow: 0x0a0f1c,
    accent: 0xb8d4ff,
    hazard: 0xff6f61,
    terminalGlow: 0xa56bff
  }
];

export function getDeckPalette(deckId = 1) {
  if (deckId <= BASE_PALETTES.length) {
    return BASE_PALETTES[deckId - 1];
  }

  const hue = ((deckId - 5) * 47) % 360;
  return {
    floorBase: hslToNumber(hue, 38, 13),
    floorLine: hslToNumber(hue, 42, 28),
    wallBase: hslToNumber(hue, 42, 9),
    wallHighlight: hslToNumber(hue, 72, 68),
    wallShadow: hslToNumber(hue, 48, 6),
    accent: hslToNumber((hue + 16) % 360, 78, 70),
    hazard: hslToNumber((hue + 152) % 360, 82, 62),
    terminalGlow: hslToNumber((hue + 80) % 360, 82, 70)
  };
}

export function getClearedDeckPalette() {
  return {
    floorBase: 0xb8bec1,
    floorLine: 0x8f979b,
    wallBase: 0x9ca4a8,
    wallHighlight: 0xe6ecef,
    wallShadow: 0x747c80,
    accent: 0xd8dde0,
    hazard: 0x8a8f92,
    terminalGlow: 0xdfe6e9
  };
}

export function numberToCss(color) {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function mutedColor(color, amount = 0.55) {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  const grey = (r + g + b) / 3;
  return (
    (Math.round(r * amount + grey * (1 - amount)) << 16) |
    (Math.round(g * amount + grey * (1 - amount)) << 8) |
    Math.round(b * amount + grey * (1 - amount))
  );
}

export function brightenColor(color, amount = 0.34) {
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  return (
    (Math.round(r + (255 - r) * amount) << 16) |
    (Math.round(g + (255 - g) * amount) << 8) |
    Math.round(b + (255 - b) * amount)
  );
}

function hslToNumber(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return (
    (Math.round(255 * f(0)) << 16) |
    (Math.round(255 * f(8)) << 8) |
    Math.round(255 * f(4))
  );
}
