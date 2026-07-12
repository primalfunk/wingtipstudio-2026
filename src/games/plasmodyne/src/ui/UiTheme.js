import { TYPOGRAPHY } from './theme/Typography.js';

export const UI_THEME = {
  backgroundDark: 0x05080c,
  panelDark: 0x061018,
  panelLight: 0x102532,
  primaryAccent: 0x78f0ff,
  warningAccent: 0xffd36a,
  dangerAccent: 0xff6f61,
  successAccent: 0x79f2c0,
  disabledAccent: 0x50616b,
  textPrimary: '#ffffff',
  textMuted: '#7fa7b5',
  textAccent: '#baf7ff',
  gridLine: 0x14202b,
  hostileColor: 0xff6f61,
  playerColor: 0xffffff,
  neutralizedColor: 0x50616b,
  fontFamily: TYPOGRAPHY.ui.family,
  titleFontFamily: TYPOGRAPHY.title.family,
  terminalFontFamily: TYPOGRAPHY.terminal.family,
  headingSize: TYPOGRAPHY.sizes.heading,
  bodySize: TYPOGRAPHY.sizes.body,
  smallSize: TYPOGRAPHY.sizes.small,
  panelPadding: 18,
  borderThickness: 1,
  cornerRadius: 8,
  glowStrength: 7
};

export function cssColor(color) {
  return `#${color.toString(16).padStart(6, '0')}`;
}
