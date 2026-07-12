export const DROID_SERIES_DIGIT_COLORS = {
  0: 0xd9f4ff,
  1: 0x8ff0ff,
  2: 0x6fffc2,
  3: 0x32ffd2,
  4: 0xc6ff52,
  5: 0xffd447,
  6: 0xff9b42,
  7: 0xb66bff,
  8: 0xff5bea,
  9: 0xf3d9ff
};

export const DROID_STATE_DIGIT_COLORS = {
  player: 0xffffff,
  playerShadow: 0x27444c,
  aggro: 0xff3b3b,
  aggroFlash: 0xffffff,
  shadow: 0x151a1f
};

export function getDroidSeries(rank) {
  return Math.max(0, Math.min(9, Math.floor(rank / 100)));
}

export function getSeriesDigitColor(rank) {
  return DROID_SERIES_DIGIT_COLORS[getDroidSeries(rank)] ?? DROID_SERIES_DIGIT_COLORS[0];
}
