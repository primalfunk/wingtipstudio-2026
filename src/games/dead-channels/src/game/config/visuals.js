export const visualConfig = {
  colors: {
    background: 0x040711,
    panel: 0x07131f,
    cyan: 0x35dfff,
    cyanText: '#9bf4ff',
    gold: 0xfff2a6,
    red: 0xff4966,
    green: 0x43f7b2,
    greenText: '#43f7b2',
    text: '#f5fbff',
    mutedText: '#8fb8c7'
  },
  routeColors: {
    safe: 0x69f0ae,
    reward: 0xffd166,
    repair: 0x64d8ff,
    archive: 0xb388ff,
    corruption: 0xff5c77
  },
  streamRoleColors: {
    primary: '#9bf4ff',
    hazard: '#ff5c77',
    repair: '#64d8ff',
    reward: '#ffd166',
    archive: '#b388ff'
  },
  biomeAccents: {
    signalArchive: { color: 0x64d8ff, textColor: '#9bf4ff', glyphs: ['A', 'R', 'C', '0', '1'], lineAlpha: 0.18 },
    staticBloom: { color: 0xff5c77, textColor: '#ff9aaa', glyphs: ['#', '%', '~', '+', '*'], lineAlpha: 0.22 },
    mirrorConduit: { color: 0xb388ff, textColor: '#d7c2ff', glyphs: ['/', '\\', '=', '|', ':'], lineAlpha: 0.20 },
    deadRelay: { color: 0xffd166, textColor: '#ffe3a3', glyphs: ['!', '.', '-', '0', '_'], lineAlpha: 0.13 },
    coreStream: { color: 0x43f7b2, textColor: '#9cffd5', glyphs: ['>', '<', '^', '1', '0'], lineAlpha: 0.25 }
  },
  glow: {
    textShadow: '0 0 8px #35dfff',
    strongTextShadow: '0 0 12px #fff2a6',
    panelAlpha: 0.74,
    lineAlpha: 0.28
  },
  flow: {
    pulseThreshold: 12,
    highThreshold: 28,
    maxBackgroundBoost: 0.18
  },
  hazards: {
    edgeStaticAlpha: 0.18,
    scanlineAlpha: 0.08,
    jitterScale: 0.72,
    multiStreamHazardScale: 0.55
  },
  terminal: {
    titleGlitchChance: 0.006,
    frameFlickerChance: 0.02,
    scanlineOpacity: 0.055,
    noiseOpacity: 0.045,
    backgroundLabelOpacity: 0.11,
    waveformOpacity: 0.14,
    commandTypingSpeedMs: 72,
    commandCorruptChance: 0.08,
    crimsonPulseIntervalMs: 5200
  },
  accessibilityDefaults: {
    reduceMotion: false,
    reduceGlow: false,
    highContrast: false,
    textScale: 1,
    screenShake: true,
      difficultyMode: 'beginner'
  }
};
