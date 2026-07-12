export const signalPanelConfig = {
  singlePanel: {
    x: 640,
    y: 400,
    minWidth: 620,
    maxWidth: 1040,
    height: 150,
    headerHeight: 34,
    speedToWpmDivisor: 4.3,
    wordUnitChars: 5,
    timingBufferMultiplier: 1.1,
    minimumWordUnits: 2.5,
    minimumDecayMs: 2400,
    completionGraceMs: 260
  },
  streams: {
    speedToWpmDivisor: 4.3,
    wordUnitChars: 5,
    timingBufferMultiplier: 1.08,
    minimumWordUnits: 2.25,
    minimumDecayMs: 2200,
    completionGraceMs: 180,
    roleDecayMultiplier: {
      primary: 1,
      hazard: 0.92,
      repair: 1.08,
      reward: 1.05,
      archive: 1.16
    }
  },
  corruption: {
    warningThreshold: 0.55,
    criticalThreshold: 0.82,
    glyphs: ['_', '|']
  }
};

export function calculateDecayDurationFromWpm({ text = '', speed = 0, config, durationMultiplier = 1 }) {
  const effectiveWpm = Math.max(1, speed / config.speedToWpmDivisor);
  const wordUnits = Math.max(config.minimumWordUnits, text.length / config.wordUnitChars);
  const baseDurationMs = (wordUnits / effectiveWpm) * 60000;

  return Math.max(
    config.minimumDecayMs,
    baseDurationMs * config.timingBufferMultiplier * durationMultiplier + (config.completionGraceMs ?? 0)
  );
}
