import {
  getMissionTransmission,
  getPreDeploymentTransmission,
  getTransmission,
  getWorldCompleteTransmission,
} from '../data/transmissionData.js';

export default class TransmissionManager {
  static normalizeCampaignState(campaignState) {
    return {
      ...campaignState,
      unlockedTransmissionIds: [...(campaignState.unlockedTransmissionIds ?? [])],
      viewedTransmissionIds: [...(campaignState.viewedTransmissionIds ?? [])],
    };
  }

  static unlockForMission(campaignState, mission) {
    const nextState = TransmissionManager.normalizeCampaignState(campaignState);
    const unlocked = new Set(nextState.unlockedTransmissionIds);
    const missionTransmission = getMissionTransmission(mission.worldId ?? nextState.currentWorldId, mission.id);
    if (missionTransmission) {
      unlocked.add(missionTransmission.id);
    }

    if (nextState.campaignComplete) {
      const worldCompleteTransmission = getWorldCompleteTransmission(mission.worldId ?? nextState.currentWorldId);
      if (worldCompleteTransmission) {
        unlocked.add(worldCompleteTransmission.id);
      }
    }

    return {
      ...nextState,
      unlockedTransmissionIds: [...unlocked],
    };
  }

  static unlockPreDeployment(campaignState, mission) {
    const nextState = TransmissionManager.normalizeCampaignState(campaignState);
    const preDeploymentTransmission = getPreDeploymentTransmission(mission.worldId ?? nextState.currentWorldId, mission.id);
    if (!preDeploymentTransmission) {
      return nextState;
    }

    const unlocked = new Set(nextState.unlockedTransmissionIds);
    unlocked.add(preDeploymentTransmission.id);
    return {
      ...nextState,
      unlockedTransmissionIds: [...unlocked],
    };
  }

  static getUnviewedPreDeploymentId(campaignState, mission) {
    const nextState = TransmissionManager.normalizeCampaignState(campaignState);
    const preDeploymentTransmission = getPreDeploymentTransmission(mission.worldId ?? nextState.currentWorldId, mission.id);
    if (!preDeploymentTransmission || nextState.viewedTransmissionIds.includes(preDeploymentTransmission.id)) {
      return null;
    }

    return preDeploymentTransmission.id;
  }

  static markViewed(campaignState, transmissionId) {
    const nextState = TransmissionManager.normalizeCampaignState(campaignState);
    const viewed = new Set(nextState.viewedTransmissionIds);
    viewed.add(transmissionId);
    return {
      ...nextState,
      viewedTransmissionIds: [...viewed],
    };
  }

  static buildTransmissionQueue(campaignState, mission) {
    const nextState = TransmissionManager.normalizeCampaignState(campaignState);
    const viewed = new Set(nextState.viewedTransmissionIds);
    const queue = [];
    const missionTransmission = getMissionTransmission(mission.worldId ?? nextState.currentWorldId, mission.id);
    if (missionTransmission && !viewed.has(missionTransmission.id)) {
      queue.push(missionTransmission.id);
    }

    if (nextState.campaignComplete) {
      const worldCompleteTransmission = getWorldCompleteTransmission(mission.worldId ?? nextState.currentWorldId);
      if (worldCompleteTransmission && !viewed.has(worldCompleteTransmission.id)) {
        queue.push(worldCompleteTransmission.id);
      }
    }

    return queue;
  }

  static hasTransmission(transmissionId) {
    return Boolean(getTransmission(transmissionId));
  }
}
