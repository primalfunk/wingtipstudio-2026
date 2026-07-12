export const WORLD_NARRATIVE = {
  'world-1': {
    preDeploymentTransmissions: {
      '1-1': {
        id: 'world-1-before-1-1',
        worldId: 'world-1',
        missionId: '1-1',
        heading: 'ROUTE AUTHORIZATION',
        lines: [
          'APEX DEPLOYMENT CHANNEL OPEN',
          'INTERSTATE SECTOR W1 ACCEPTING NORTHBOUND TRAFFIC',
          'MAINTAIN ASSIGNED ROUTE',
          'AWAIT CHECKPOINT CONFIRMATION',
        ],
      },
    },
    missionTransmissions: {
      '1-1': {
        id: 'world-1-after-1-1',
        worldId: 'world-1',
        missionId: '1-1',
        heading: 'SECTOR UPDATE',
        lines: [
          'ROUTE AUTHORIZATION ACTIVE',
          'INTERSTATE SECTOR W1 OPEN',
          'MAINTAIN NORTHBOUND MOVEMENT',
          'CIVILIAN TRAFFIC NORMAL',
        ],
      },
      '1-2': {
        id: 'world-1-after-1-2',
        worldId: 'world-1',
        missionId: '1-2',
        heading: 'FREIGHT NOTICE',
        lines: [
          'FREIGHT PRIORITY CORRIDORS EXPANDED',
          'EXPECT INCREASED ENFORCEMENT ACTIVITY',
          'UNAUTHORIZED STOPS DISCOURAGED',
        ],
      },
      '1-3': {
        id: 'world-1-after-1-3',
        worldId: 'world-1',
        missionId: '1-3',
        heading: 'CHECKPOINT STATUS',
        lines: [
          'REGIONAL CHECKPOINT NETWORK ONLINE',
          'THROUGH-TRAFFIC SUBJECT TO REDIRECTION',
          'EXPECT TEMPORARY LANE CONTROLS',
        ],
      },
      '1-4': {
        id: 'world-1-after-1-4',
        worldId: 'world-1',
        missionId: '1-4',
        heading: 'ROUTING AUTHORITY',
        lines: [
          'RIVER TRANSPORT CHANNELS NOW FALL UNDER',
          'CENTRAL ROUTING AUTHORITY',
          'UNMARKED VESSELS MAY BE INTERDICTED',
        ],
      },
      '1-5': {
        id: 'world-1-after-1-5',
        worldId: 'world-1',
        missionId: '1-5',
        heading: 'SIGNAL WATCH',
        lines: [
          'CIVILIAN TRAFFIC VOLUME BELOW EXPECTED THRESHOLD',
          'MAINTAIN ASSIGNED CORRIDOR',
          'REPORT UNAUTHORIZED SIGNALS',
        ],
      },
      '1-6': {
        id: 'world-1-after-1-6',
        worldId: 'world-1',
        missionId: '1-6',
        heading: 'ACCESS REVISION',
        lines: [
          'SECTOR TRANSIT RESTRICTIONS INCREASED',
          'LONG-RANGE FREIGHT MOVEMENT PRIORITIZED',
          'SECONDARY ACCESS ROUTES REMOVED',
        ],
      },
      '1-7': {
        id: 'world-1-after-1-7',
        worldId: 'world-1',
        missionId: '1-7',
        heading: 'DIRECTIVE UPDATE',
        lines: [
          'MULTIPLE INTERSTATE SEGMENTS NOW OPERATE',
          'UNDER AUTOMATED TRAFFIC DIRECTIVE',
          'MANUAL OVERRIDE DISCONTINUED',
        ],
      },
      '1-8': {
        id: 'world-1-after-1-8',
        worldId: 'world-1',
        missionId: '1-8',
        heading: 'CONTAINMENT NOTICE',
        lines: [
          'UNREGISTERED VEHICLES OBSERVED',
          'OUTSIDE DESIGNATED MOVEMENT CHANNELS',
          'CONTAINMENT MEASURES ACTIVE',
        ],
      },
      '1-9': {
        id: 'world-1-after-1-9',
        worldId: 'world-1',
        missionId: '1-9',
        heading: 'MOBILITY AUTHORITY',
        lines: [
          'ALL NORTHERN CORRIDORS NOW FALL UNDER',
          'CENTRAL MOBILITY AUTHORITY',
          'THROUGH-TRAFFIC SUBJECT TO CONTINUOUS TRACKING',
        ],
      },
    },
    worldCompleteTransmission: {
      id: 'world-1-complete',
      worldId: 'world-1',
      heading: 'NETWORK STATUS',
      lines: [
        'TRANSPORTATION INFRASTRUCTURE STATUS:',
        'UNIFIED',
        'ROUTING COMPLIANCE:',
        'MANDATORY',
        'ALL MOVEMENT NOW OCCURS',
        'WITHIN THE NETWORK',
      ],
    },
  },
};

export function getTransmission(transmissionId) {
  for (const worldNarrative of Object.values(WORLD_NARRATIVE)) {
    const preDeploymentTransmission = Object.values(worldNarrative.preDeploymentTransmissions ?? {})
      .find((transmission) => transmission.id === transmissionId);
    if (preDeploymentTransmission) {
      return preDeploymentTransmission;
    }

    const missionTransmission = Object.values(worldNarrative.missionTransmissions)
      .find((transmission) => transmission.id === transmissionId);
    if (missionTransmission) {
      return missionTransmission;
    }

    if (worldNarrative.worldCompleteTransmission.id === transmissionId) {
      return worldNarrative.worldCompleteTransmission;
    }
  }

  return null;
}

export function getPreDeploymentTransmission(worldId, missionId) {
  return WORLD_NARRATIVE[worldId]?.preDeploymentTransmissions?.[missionId] ?? null;
}

export function getMissionTransmission(worldId, missionId) {
  return WORLD_NARRATIVE[worldId]?.missionTransmissions?.[missionId] ?? null;
}

export function getWorldCompleteTransmission(worldId) {
  return WORLD_NARRATIVE[worldId]?.worldCompleteTransmission ?? null;
}
