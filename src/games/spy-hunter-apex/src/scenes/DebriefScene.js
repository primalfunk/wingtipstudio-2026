import Phaser from 'phaser';
import { completeMission, getMissionNode } from '../data/campaignData.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../data/tuning.js';
import AudioSystem from '../systems/AudioSystem.js';
import StorageSystem from '../systems/StorageSystem.js';
import LayoutSystem from '../systems/LayoutSystem.js';
import TransmissionManager from '../systems/TransmissionManager.js';

export default class DebriefScene extends Phaser.Scene {
  constructor() {
    super('DebriefScene');
  }

  create(data) {
    LayoutSystem.restartOnResize(this, data);
    const layout = LayoutSystem.screen(this);
    this.audioSystem = new AudioSystem(this);
    this.audioSystem.stopDrivingMusic();
    const eventHistory = data.eventHistory ?? [];
    const mission = getMissionNode(data.missionId ?? '1-1', data.worldId ?? 'world-1');
    const missionWorldId = mission.worldId ?? data.worldId ?? 'world-1';
    const missionWithWorld = { ...mission, worldId: missionWorldId };
    const distance = Math.floor(data.distance ?? 0);
    const enemiesDestroyed = data.enemiesDestroyed ?? 0;
    const supportContacts = eventHistory.filter((event) => {
      return event.type === 'supportCollected' || event.type === 'decoySupportAccepted';
    }).length;
    const decoysIdentified = eventHistory.filter((event) => event.type === 'decoySupportDestroyed').length;
    let nextSceneKey = 'OverworldScene';
    let nextScenePayload = data.autopilot ? { autopilot: true } : {};
    const records = StorageSystem.saveRun({
      score: data.score ?? 0,
      distance,
      elapsedTime: data.elapsedTime ?? 0,
      decoysIdentified,
    });
    if (data.missionComplete) {
      const campaignState = StorageSystem.loadCampaign();
      const completedCampaignState = completeMission(campaignState, mission.id, data.score ?? 0);
      const nextCampaignState = StorageSystem.saveCampaign(
        TransmissionManager.unlockForMission(completedCampaignState, missionWithWorld),
      );
      if (nextCampaignState.campaignComplete) {
        nextSceneKey = 'VictoryScene';
        nextScenePayload = {
          ...data,
          worldId: missionWorldId,
        };
      }

      const transmissionQueue = TransmissionManager.buildTransmissionQueue(nextCampaignState, missionWithWorld);
      if (transmissionQueue.length > 0) {
        const [transmissionId, ...remainingTransmissionIds] = transmissionQueue;
        const finalSceneKey = nextSceneKey;
        const finalScenePayload = nextScenePayload;
        nextSceneKey = 'TransmissionScene';
        nextScenePayload = {
          transmissionId,
          remainingTransmissionIds,
          nextSceneKey: finalSceneKey,
          nextScenePayload: finalScenePayload,
        };
      }
    }

    const titleY = layout.marginTop + 38;
    this.add.text(GAME_WIDTH / 2, titleY, data.missionComplete ? 'MISSION COMPLETE' : 'DEBRIEF', {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '28px',
      color: '#d6f7ef',
    }).setOrigin(0.5);

    this.add.text(
      GAME_WIDTH / 2,
      titleY + Math.max(76, layout.height * 0.11),
      `${mission.label} // ${mission.name}\nSCORE ${data.score ?? 0}\nDISTANCE ${distance} MI\nHOSTILES DESTROYED ${enemiesDestroyed}\nSUPPORT CONTACTS ${supportContacts}`,
      {
        fontFamily: 'Consolas, Courier, monospace',
        fontSize: layout.isNarrow ? '14px' : '16px',
        color: '#d7e0df',
        align: 'center',
        lineSpacing: 9,
      },
    ).setOrigin(0.5);

    const notes = this.buildNotes(eventHistory, data.playerTendencies ?? {});
    this.add.text(GAME_WIDTH / 2, titleY + Math.max(230, layout.height * 0.32), notes.join('\n'), {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '13px',
      color: '#b9c8c6',
      align: 'left',
      lineSpacing: 10,
      wordWrap: { width: Math.min(520, layout.contentWidth - 28) },
    }).setOrigin(0.5, 0);

    this.add.text(
      GAME_WIDTH / 2,
      layout.safe.bottom - Math.max(118, layout.height * 0.15),
      `RECORD SCORE ${records.bestScore}   RECORD DIST ${Math.floor(records.bestDistance)} MI`,
      {
        fontFamily: 'Consolas, Courier, monospace',
        fontSize: '13px',
        color: '#8fa4a2',
      },
    ).setOrigin(0.5);

    this.nextSceneKey = nextSceneKey;
    this.nextScenePayload = nextScenePayload;
    this.proceeding = false;
    const prompt = nextSceneKey === 'TransmissionScene'
      ? 'PRESS ENTER / CLICK FOR TRANSMISSION'
      : nextSceneKey === 'VictoryScene'
      ? 'PRESS ENTER / CLICK FOR FINAL DEBRIEF'
      : 'PRESS ENTER / CLICK TO MAP';
    this.add.text(GAME_WIDTH / 2, layout.safe.bottom - Math.max(68, layout.height * 0.09), prompt, {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '15px',
      color: '#f6e7a8',
    }).setOrigin(0.5);

    this.input.keyboard.on('keydown-ENTER', this.proceed, this);
    this.input.on('pointerdown', this.proceed, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdownInputHandlers, this);
  }

  proceed() {
    if (this.proceeding) {
      return;
    }

    this.proceeding = true;
    this.audioSystem.playConfirm();
    this.scene.start(this.nextSceneKey, this.nextScenePayload);
  }

  shutdownInputHandlers() {
    this.input.keyboard.off('keydown-ENTER', this.proceed, this);
    this.input.off('pointerdown', this.proceed, this);
  }

  buildNotes(eventHistory, tendencies) {
    const notes = [];
    const decoyAccepted = eventHistory.some((event) => event.type === 'decoySupportAccepted');
    const decoyDestroyed = eventHistory.some((event) => event.type === 'decoySupportDestroyed');
    const realSupportDestroyed = eventHistory.some((event) => event.type === 'realSupportDestroyed');

    if (decoyAccepted) {
      notes.push('Support-marked vehicle delivered compromised cargo.');
    } else if (decoyDestroyed) {
      notes.push('Destroyed support-marked vehicle matched hostile decoy profile.');
    }

    if (realSupportDestroyed) {
      notes.push('Authorized support asset was lost to friendly fire.');
    }

    if ((tendencies.supportCompliance ?? 0) > 0.65) {
      notes.push('Support compliance pattern is becoming predictable.');
    } else if ((tendencies.attacksSupportVans ?? 0) > 0) {
      notes.push('Support engagement pattern is aggressive. Future assets may keep distance.');
    }

    if (notes.length === 0) {
      notes.push('Civilian and support behavior remained within expected range.');
    }

    return notes.slice(0, 6).map((note) => `- ${note}`);
  }
}
