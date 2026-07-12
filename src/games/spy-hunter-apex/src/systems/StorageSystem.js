import { DEFAULT_CAMPAIGN_STATE } from '../data/campaignData.js';

const STORAGE_KEY = 'signalHunter.records.v1';
const DEFAULT_RECORDS = {
  bestScore: 0,
  bestDistance: 0,
  longestRunSeconds: 0,
  totalRuns: 0,
  decoysIdentified: 0,
};
const SETTINGS_KEY = 'signalHunter.settings.v1';
const CAMPAIGN_KEY = 'signalHunter.campaign.v1';
const DEFAULT_SETTINGS = {
  audioEnabled: true,
  difficulty: 'medium',
  mainVolume: 1,
  musicVolume: 1,
  sfxVolume: 1,
};

export default class StorageSystem {
  static loadRecords() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULT_RECORDS, ...JSON.parse(raw) } : { ...DEFAULT_RECORDS };
    } catch {
      return { ...DEFAULT_RECORDS };
    }
  }

  static saveRun(summary) {
    const records = StorageSystem.loadRecords();
    const nextRecords = {
      bestScore: Math.max(records.bestScore, summary.score),
      bestDistance: Math.max(records.bestDistance, summary.distance),
      longestRunSeconds: Math.max(records.longestRunSeconds, summary.elapsedTime),
      totalRuns: records.totalRuns + 1,
      decoysIdentified: records.decoysIdentified + summary.decoysIdentified,
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
    } catch {
      // Persistence is optional; browser storage restrictions should not break a run.
    }

    return nextRecords;
  }

  static loadSettings() {
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  static saveSettings(settings) {
    const nextSettings = { ...StorageSystem.loadSettings(), ...settings };
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
    } catch {
      // Settings are optional for restricted storage environments.
    }

    return nextSettings;
  }

  static loadCampaign() {
    try {
      const raw = window.localStorage.getItem(CAMPAIGN_KEY);
      return raw ? { ...DEFAULT_CAMPAIGN_STATE, ...JSON.parse(raw) } : { ...DEFAULT_CAMPAIGN_STATE };
    } catch {
      return { ...DEFAULT_CAMPAIGN_STATE };
    }
  }

  static saveCampaign(campaignState) {
    const nextCampaignState = { ...DEFAULT_CAMPAIGN_STATE, ...campaignState };
    try {
      window.localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(nextCampaignState));
    } catch {
      // Campaign persistence is optional; restricted storage should not block play.
    }

    return nextCampaignState;
  }

  static resetCampaign() {
    return StorageSystem.saveCampaign({
      ...DEFAULT_CAMPAIGN_STATE,
      unlockedNodeIds: [...DEFAULT_CAMPAIGN_STATE.unlockedNodeIds],
      completedNodeIds: [...DEFAULT_CAMPAIGN_STATE.completedNodeIds],
      unlockedTransmissionIds: [...DEFAULT_CAMPAIGN_STATE.unlockedTransmissionIds],
      viewedTransmissionIds: [...DEFAULT_CAMPAIGN_STATE.viewedTransmissionIds],
      bestMissionScores: { ...DEFAULT_CAMPAIGN_STATE.bestMissionScores },
    });
  }
}
