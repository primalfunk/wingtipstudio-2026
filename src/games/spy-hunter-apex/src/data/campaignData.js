const GRID = {
  left: 92,
  center: 204,
  right: 316,
  top: 184,
  middle: 330,
  bottom: 492,
};

const STANDARD_PACING = [
  { type: 'opening', at: 0, duration: 12, label: 'OPENING', spawnProfile: { traffic: 0.72, enemies: 0.38 } },
  { type: 'build', at: 12, duration: 14, label: 'BUILD', spawnProfile: { traffic: 0.98, enemies: 0.82 } },
  { type: 'pressure', at: 26, duration: 13, label: 'PRESSURE', forceSpawn: { enemies: true } },
  { type: 'release', at: 39, duration: 9, label: 'RELEASE', spawnProfile: { traffic: 0.55, enemies: 0.45, support: 1.16 } },
  { type: 'setpiece', at: 48, duration: 15, label: 'SETPIECE', forceSpawn: { enemies: true } },
  { type: 'recovery', at: 63, duration: 8, label: 'RECOVERY', spawnProfile: { traffic: 0.58, enemies: 0.55, support: 1.05 } },
  { type: 'finale', at: 71, duration: 14, label: 'FINALE', forceSpawn: { enemies: true } },
];

function mission({
  id,
  label,
  name,
  type = 'road',
  terrain = 'highway',
  environmentProfile = 'domestic_interstate',
  x,
  y,
  next,
  lengthSeconds = 85,
  segmentIds,
  briefing,
  endType = 'checkpoint',
  pacing = STANDARD_PACING,
  beats = [],
  transitions = [],
}) {
  return {
    id,
    label,
    name,
    type,
    terrain,
    environmentProfile,
    x,
    y,
    lengthSeconds,
    next,
    segmentIds,
    pacing,
    beats,
    transitions,
    briefing,
    endType,
  };
}

export const CAMPAIGN_WORLDS = [
  {
    id: 'world-1',
    label: 'WORLD 1: Domestic Interstate',
    theme: 'highway',
    nodes: [
      mission({
        id: '1-1',
        label: '1',
        name: 'Open Highway',
        x: GRID.left,
        y: GRID.top,
        next: ['1-2'],
        lengthSeconds: 70,
        segmentIds: ['straight_civilian_light', 'watched_commuter_run', 'bridge_crossing'],
        beats: [
          { at: 4, type: 'alert', label: 'opening', message: 'MISSION: Civilian route. Hold formation.' },
          { at: 10, type: 'trafficBurst', label: 'commuter flow', count: 3, spacingMs: 320 },
          { at: 22, type: 'enemyWave', label: 'first contact', enemyTypeIds: ['pursuit-interceptor'], count: 1 },
          { at: 48, type: 'support', label: 'first support', spawnTarget: 'player_side', serviceType: 'repair' },
          { at: 62, type: 'roadSign', label: 'checkpoint sign', text: 'CHECKPOINT 1 MI' },
        ],
        briefing: 'Maintain route through civilian traffic. Reach checkpoint one.',
      }),
      mission({
        id: '1-2',
        label: '2',
        name: 'Checkpoint Run',
        type: 'intercept',
        environmentProfile: 'watched_grid',
        x: GRID.center,
        y: GRID.top,
        next: ['1-3'],
        segmentIds: ['watched_commuter_run', 'checkpoint_gate', 'straight_civilian_light'],
        beats: [
          { at: 14, type: 'enemyWave', label: 'scout screen', enemyTypeIds: ['scout-bike', 'assassin-bike'], count: 2, spacingMs: 520 },
          { at: 34, type: 'trafficBurst', label: 'gate traffic', count: 3, spacingMs: 260 },
          { at: 58, type: 'enemyWave', label: 'lane pressure', enemyTypeIds: ['turret-gunner', 'armored-sedan'], count: 2, spacingMs: 420 },
        ],
        briefing: 'Push through checkpoint traffic under observation.',
      }),
      mission({
        id: '1-3',
        label: '3',
        name: 'North Corridor',
        environmentProfile: 'support_corridor',
        x: GRID.right,
        y: GRID.top,
        next: ['1-4'],
        segmentIds: ['support_corridor', 'bridge_crossing', 'hostile_clear_lanes'],
        beats: [
          { at: 12, type: 'support', label: 'ammo support', spawnTarget: 'player_side', serviceType: 'ammo' },
          { at: 32, type: 'enemyWave', label: 'support interdiction', enemyTypeIds: ['rammer', 'turret-gunner'], count: 2, spacingMs: 420 },
          { at: 60, type: 'enemyWave', label: 'corridor close', enemyTypeIds: ['cannon-car', 'pursuit-interceptor'], count: 2, spacingMs: 520 },
        ],
        briefing: 'Use the support corridor before hostile vehicles close it.',
      }),
      mission({
        id: '1-4',
        label: '4',
        name: 'Construction Diversion',
        environmentProfile: 'domestic_interstate',
        x: GRID.right,
        y: GRID.middle,
        next: ['1-5'],
        segmentIds: ['construction_diversion', 'watched_commuter_run', 'cloverleaf_interchange'],
        beats: [
          { at: 8, type: 'roadSign', label: 'roadwork sign', text: 'LANE CLOSURE' },
          { at: 24, type: 'enemyWave', label: 'diversion pressure', enemyTypeIds: ['rammer', 'turret-gunner'], count: 2, spacingMs: 420 },
          { at: 52, type: 'trafficBurst', label: 'merge traffic', count: 4, spacingMs: 280 },
        ],
        briefing: 'Navigate construction lanes and keep the route open.',
      }),
      mission({
        id: '1-5',
        label: '5',
        name: 'Divided Interstate',
        type: 'intercept',
        environmentProfile: 'watched_grid',
        x: GRID.center,
        y: GRID.middle,
        next: ['1-6'],
        lengthSeconds: 90,
        segmentIds: ['divided_interstate_entry', 'divided_guardrail_run', 'divided_support_median', 'divided_interstate_exit'],
        beats: [
          { at: 18, type: 'trafficBurst', label: 'opposite flow', spawnTarget: 'opposite_side', atmospheric: true, count: 3, spacingMs: 300 },
          { at: 36, type: 'enemyWave', label: 'median trap', enemyTypeIds: ['mine-layer', 'missile-launcher'], count: 2, spacingMs: 620 },
          { at: 62, type: 'support', label: 'median support', spawnTarget: 'player_side' },
        ],
        briefing: 'Enter the split interstate. No crossover is authorized.',
      }),
      mission({
        id: '1-6',
        label: '6',
        name: 'Flood Channel',
        type: 'river',
        terrain: 'hybrid',
        environmentProfile: 'river_access',
        x: GRID.left,
        y: GRID.middle,
        next: ['1-7'],
        lengthSeconds: 92,
        segmentIds: ['river_approach', 'flood_channel', 'river_run', 'bridge_crossing', 'river_exit'],
        transitions: [
          { atSeconds: 28, mode: 'boat', label: 'LAUNCH RAMP' },
          { atSeconds: 66, mode: 'car', label: 'DOCK EXIT' },
        ],
        beats: [
          { at: 6, type: 'roadSign', label: 'river approach sign', text: 'RIVER ACCESS' },
          { at: 18, type: 'enemyWave', label: 'ramp guards', enemyTypeIds: ['pursuit-interceptor', 'turret-gunner'], count: 2, spacingMs: 380 },
          { at: 32, type: 'enemyWave', label: 'skiff pursuit', enemyTypeIds: ['attack-skiff', 'gunboat'], count: 2, spacingMs: 520 },
          { at: 46, type: 'enemyWave', label: 'river mines', enemyTypeIds: ['mine-boat', 'rocket-hydrofoil'], count: 2, spacingMs: 620 },
          { at: 64, type: 'alert', label: 'dock return', message: 'DOCK EXIT: Prepare vehicle transfer.' },
          { at: 76, type: 'enemyWave', label: 'dock ambush', enemyTypeIds: ['rammer', 'cannon-car'], count: 2, spacingMs: 460 },
        ],
        briefing: 'Road access converts to river route mid-mission. Keep moving.',
        endType: 'port',
      }),
      mission({
        id: '1-7',
        label: '7',
        name: 'Industrial Corridor',
        type: 'intercept',
        environmentProfile: 'fortified_border',
        x: GRID.left,
        y: GRID.bottom,
        next: ['1-8'],
        lengthSeconds: 90,
        segmentIds: ['industrial_corridor', 'cloverleaf_interchange', 'construction_diversion', 'hostile_clear_lanes'],
        beats: [
          { at: 16, type: 'enemyWave', label: 'freight escort', enemyTypeIds: ['armored-sedan', 'turret-gunner'], count: 2, spacingMs: 520 },
          { at: 34, type: 'trafficBurst', label: 'freight compression', count: 4, spacingMs: 340 },
          { at: 58, type: 'enemyWave', label: 'heavy push', enemyTypeIds: ['command-car', 'cannon-car'], count: 2, spacingMs: 620 },
        ],
        briefing: 'Cross the freight corridor and break the heavy escort line.',
      }),
      mission({
        id: '1-8',
        label: '8',
        name: 'Tunnel Battery',
        type: 'intercept',
        environmentProfile: 'watched_grid',
        x: GRID.center,
        y: GRID.bottom,
        next: ['1-9'],
        lengthSeconds: 92,
        segmentIds: ['tunnel_run', 'hostile_clear_lanes', 'checkpoint_gate'],
        beats: [
          { at: 10, type: 'alert', label: 'tunnel entry', message: 'TUNNEL: Maneuver room reduced.' },
          { at: 24, type: 'enemyWave', label: 'tunnel fight', enemyTypeIds: ['rammer', 'turret-gunner'], count: 2, spacingMs: 360 },
          { at: 50, type: 'support', label: 'last tunnel support', spawnTarget: 'player_side' },
          { at: 68, type: 'enemyWave', label: 'bike strike', enemyTypeIds: ['assassin-bike', 'rocket-bike', 'scout-bike'], count: 3, spacingMs: 360 },
        ],
        briefing: 'Fight through a compressed tunnel battery before the final sector.',
      }),
      mission({
        id: '1-9',
        label: '9',
        name: 'Relay Station',
        type: 'fortress',
        environmentProfile: 'fortified_border',
        x: GRID.right,
        y: GRID.bottom,
        next: [],
        lengthSeconds: 105,
        segmentIds: ['hostile_clear_lanes', 'industrial_corridor', 'divided_interstate_entry', 'divided_guardrail_run', 'divided_interstate_exit', 'tunnel_run', 'checkpoint_gate'],
        beats: [
          { at: 14, type: 'enemyWave', label: 'command escort', enemyTypeIds: ['command-car', 'turret-gunner'], count: 2, spacingMs: 480 },
          { at: 32, type: 'enemyWave', label: 'mine denial', enemyTypeIds: ['mine-layer', 'missile-launcher'], count: 2, spacingMs: 620 },
          { at: 46, type: 'support', label: 'last support', spawnTarget: 'player_side' },
          { at: 74, type: 'enemyWave', label: 'heavy battery', enemyTypeIds: ['rocket-salvo', 'cannon-car'], count: 2, spacingMs: 760 },
          { at: 94, type: 'alert', label: 'final gate', message: 'RELAY GATE: Hold the road.' },
        ],
        briefing: 'Final World 1 checkpoint. Survive the fortified relay approach.',
        endType: 'fortress',
      }),
    ],
  },
];

export const DEFAULT_CAMPAIGN_STATE = {
  currentWorldId: 'world-1',
  cursorNodeId: '1-1',
  unlockedNodeIds: ['1-1'],
  completedNodeIds: [],
  unlockedTransmissionIds: [],
  viewedTransmissionIds: [],
  bestMissionScores: {},
  campaignComplete: false,
};

export function getWorld(worldId = 'world-1') {
  return CAMPAIGN_WORLDS.find((world) => world.id === worldId) ?? CAMPAIGN_WORLDS[0];
}

export function getMissionNode(nodeId, worldId = 'world-1') {
  const world = getWorld(worldId);
  return world.nodes.find((node) => node.id === nodeId) ?? world.nodes[0];
}

export function completeMission(campaignState, nodeId, score) {
  const world = getWorld(campaignState.currentWorldId);
  const node = world.nodes.find((candidate) => candidate.id === nodeId);
  const unlocked = new Set(campaignState.unlockedNodeIds);
  const completed = new Set(campaignState.completedNodeIds);
  completed.add(nodeId);

  for (const nextNodeId of node?.next ?? []) {
    unlocked.add(nextNodeId);
  }

  const campaignComplete = world.nodes.every((candidate) => completed.has(candidate.id));

  return {
    ...campaignState,
    cursorNodeId: node?.next?.[0] ?? nodeId,
    unlockedNodeIds: [...unlocked],
    completedNodeIds: [...completed],
    campaignComplete,
    bestMissionScores: {
      ...campaignState.bestMissionScores,
      [nodeId]: Math.max(campaignState.bestMissionScores[nodeId] ?? 0, score),
    },
  };
}
