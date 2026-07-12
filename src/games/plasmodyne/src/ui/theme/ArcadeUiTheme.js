import { UI_THEME } from '../UiTheme.js';

export const ARCADE_UI = {
  fontFamily: UI_THEME.fontFamily,
  titleFontFamily: UI_THEME.titleFontFamily ?? UI_THEME.fontFamily,
  colors: {
    panel: 0x061018,
    panelAlt: 0x0d1b25,
    header: 0x102532,
    cyan: 0x78f0ff,
    cyanText: '#baf7ff',
    softText: '#9fc6d2',
    white: '#ffffff',
    amber: '#ffd36a',
    danger: '#ff6f61',
    dark: 0x020507
  },
  alpha: {
    panel: 0.92,
    header: 0.86,
    border: 0.82
  },
  glow: {
    cyan: '#78f0ff',
    amber: '#ffd36a'
  },
  timing: {
    alertFadeIn: 250,
    alertHold: 2100,
    alertFadeOut: 500,
    liftFade: 380
  },
  z: {
    hud: 1000,
    score: 1010,
    alert: 1600,
    overlay: 1700
  }
};
