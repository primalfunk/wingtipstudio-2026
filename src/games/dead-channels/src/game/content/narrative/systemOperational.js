export const systemOperational = [
  { text: 'relay drift increasing', difficulty: 1, tone: 'operational' },
  { text: 'restore unstable carrier', difficulty: 1, tone: 'operational' },
  { text: 'checksum failure detected', difficulty: 2, tone: 'warning' },
  { text: 'archive node unreachable', difficulty: 2, tone: 'operational' },
  { text: 'memory sector degraded', difficulty: 2, tone: 'operational' },
  { text: 'carrier synchronization failed', difficulty: 3, tone: 'warning' },
  { text: 'no signal beyond the floodplain', difficulty: 2, tone: 'report' },
  { text: 'archive recovery postponed indefinitely', difficulty: 4, tone: 'report' },
  { text: 'static bloom detected offshore', difficulty: 3, tone: 'warning' },
  { text: 'signal lock requires manual entry', difficulty: 2, tone: 'command' },
  { text: 'diagnostic trace returning empty', difficulty: 3, tone: 'report' },
  { text: 'carrier path narrowed to one voice', difficulty: 4, tone: 'warning' }
];
