export const MENU_THEME = {
  titleColor: '#ff335f',
  titleGlow: '#ff6f9d',
  promptColor: '#ffdf6e',
  sublabelColor: '#9db8c5',
  lowTierColor: 0x79f2ff,
  midTierColor: 0xffd36a,
  highTierColor: 0xff7b4f,
  dangerRed: 0xff263f,
  eliteMagenta: 0xd66dff,
  cyanSignal: 0x78f0ff,
  scanlineAlpha: 0.035,
  vignetteAlpha: 0.18,
  bootDuration: 2100,
  attractBurstIntervalMin: 8000,
  attractBurstIntervalMax: 15000,
  titlePulseSpeed: 0.0016,
  promptPulseSpeed: 0.0042,
  droidAnchors: [
    { id: '042', x: 0.185, y: 0.748, radius: 38, tier: 'low', pulseOffset: 0.1, bobStrength: 2.2 },
    { id: '210', x: 0.262, y: 0.455, radius: 42, tier: 'low', pulseOffset: 1.2, bobStrength: 1.8 },
    { id: '524', x: 0.392, y: 0.39, radius: 46, tier: 'mid', pulseOffset: 2.4, bobStrength: 2.4 },
    { id: '985', x: 0.515, y: 0.43, radius: 62, tier: 'elite', pulseOffset: 3.0, bobStrength: 3.2 },
    { id: '302', x: 0.706, y: 0.755, radius: 42, tier: 'mid', pulseOffset: 0.6, bobStrength: 2.0 },
    { id: '621', x: 0.782, y: 0.472, radius: 45, tier: 'high', pulseOffset: 1.8, bobStrength: 2.6 },
    { id: '739', x: 0.856, y: 0.312, radius: 43, tier: 'high', pulseOffset: 2.9, bobStrength: 2.8 }
  ],
  systemLabels: [
    { text: 'HOST SIGNAL DETECTED', x: 0.06, y: 0.13 },
    { text: 'TRANSFER BUS ARMED', x: 0.69, y: 0.16 },
    { text: '985 RESISTANCE HIGH', x: 0.62, y: 0.59 },
    { text: 'AUTONOMOUS SYSTEMS ACTIVE', x: 0.06, y: 0.88 }
  ]
};

export function colorForDroidTier(tier) {
  if (tier === 'elite') return MENU_THEME.dangerRed;
  if (tier === 'high') return MENU_THEME.highTierColor;
  if (tier === 'mid') return MENU_THEME.midTierColor;
  return MENU_THEME.lowTierColor;
}
