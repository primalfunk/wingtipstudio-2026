export const TYPOGRAPHY = {
  title: {
    family: '"Arbedo", "Grisha", "MoonRunner", "VakultaTrial", "Ethnocentric", "Ethnocentric Local", "Neuropol", "Orbitron", sans-serif',
    primary: 'Arbedo',
    fallback: '"Orbitron", sans-serif',
    tracking: 4,
    glow: '#78f0ff'
  },
  ui: {
    family: '"Michroma", "Michroma Local", "Orbitron", "Eurostile", "Bank Gothic", sans-serif',
    primary: 'Michroma',
    fallback: '"Orbitron", "Consolas", monospace',
    glow: '#78f0ff'
  },
  terminal: {
    family: '"Orbitron", "Orbitron Local", "Michroma", "Consolas", monospace',
    primary: 'Orbitron',
    fallback: '"Consolas", monospace'
  },
  droidNumerals: {
    family: '"RocketCommand", "RocketCommandCondensed", "MoonRunner", "Arbedo", monospace',
    defaultColor: 0x929da2,
    defaultShadow: 0x343c42,
    playerColor: 0xaeb8bd,
    playerShadow: 0x4a545a
  },
  sizes: {
    title: '46px',
    heading: '22px',
    body: '16px',
    small: '13px',
    hud: '14px'
  }
};

export function titleTextStyle(overrides = {}) {
  return {
    fontFamily: TYPOGRAPHY.title.family,
    fontSize: TYPOGRAPHY.sizes.title,
    color: '#ffffff',
    ...overrides
  };
}

export function uiTextStyle(overrides = {}) {
  return {
    fontFamily: TYPOGRAPHY.ui.family,
    fontSize: TYPOGRAPHY.sizes.body,
    color: '#baf7ff',
    ...overrides
  };
}

export function terminalHeaderStyle(overrides = {}) {
  return {
    fontFamily: TYPOGRAPHY.terminal.family,
    fontSize: TYPOGRAPHY.sizes.heading,
    color: '#ffffff',
    ...overrides
  };
}
