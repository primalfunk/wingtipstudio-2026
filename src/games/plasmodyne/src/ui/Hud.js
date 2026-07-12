import { COLORS, DEBUG } from '../data/constants.js';
import { UI_THEME } from './UiTheme.js';
import { getDeckInfo } from '../data/deckNames.js';

export class Hud {
  constructor(scene, bodyData, deckName) {
    this.scene = scene;
    this.bodyData = bodyData;
    this.deckName = deckName;
    this.roomName = 'Unknown';
    this.prompt = '';
    this.hostilesDeck = 0;
    this.hostilesShip = 0;

    this.panel = scene.add.rectangle(18, 76, 350, 118, 0x061018, 0.62);
    this.panel.setOrigin(0, 0);
    this.panel.setScrollFactor(0);
    this.panel.setDepth(999);
    this.panel.setStrokeStyle(1, 0x78f0ff, 0.22);

    this.text = scene.add.text(30, 86, '', {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '15px',
      color: COLORS.hudText,
      lineSpacing: 4,
      wordWrap: { width: 322 }
    });
    this.text.setScrollFactor(0);
    this.text.setDepth(1000);
    this.text.setShadow(0, 0, COLORS.hudAccent, 4);
    this.update();
  }

  update() {
    const deck = this.getDeckLabel();
    const lines = [
      `BODY: ${this.bodyData.displayId}`,
      `INTEGRITY: ${this.bodyData.integrity} / ${this.bodyData.maxIntegrity}`,
      deck,
      this.roomName
    ];

    if (DEBUG.showHudDetails) {
      lines.splice(1, 0,
        `CLASS: ${this.bodyData.chassisClass}`,
        `STABILITY: ${this.getStabilityText()}`,
        `WEAPON: ${this.bodyData.weaponType}`,
        `CLEARANCE: ${this.bodyData.clearanceLevel ?? 0}`
      );
      lines.push(
        `HOSTILES DECK: ${this.hostilesDeck}`,
        `HOSTILES SHIP: ${this.hostilesShip}`
      );
    }

    lines.push(
      this.prompt
    );
    this.text.setText(lines);
    this.panel.setSize(350, DEBUG.showHudDetails ? 244 : 118);
  }

  getDeckLabel() {
    const match = /DECK\s+(\d+)/i.exec(this.deckName);
    const deckId = match ? Number.parseInt(match[1], 10) : null;
    if (!deckId) {
      return this.deckName;
    }
    const deck = getDeckInfo(deckId);
    return `DECK ${deck.displayNumber}: ${deck.shortName}`;
  }

  getStabilityText() {
    if (!this.bodyData.stabilityMax) {
      return 'STABLE';
    }
    const state = this.bodyData.bodyFailureState && this.bodyData.bodyFailureState !== 'normal'
      ? ` ${this.bodyData.bodyFailureState.toUpperCase()}`
      : '';
    return `${Math.ceil(this.bodyData.stabilityCurrent)} / ${this.bodyData.stabilityMax}${state}`;
  }

  setDeck(deckName) {
    if (deckName !== this.deckName) {
      this.deckName = deckName;
      this.update();
    }
  }

  setRoom(room) {
    const nextName = room ? room.label.toUpperCase() : 'CORRIDOR';
    if (nextName !== this.roomName) {
      this.roomName = nextName;
      this.update();
    }
  }

  setPrompt(prompt) {
    const nextPrompt = prompt ? prompt.toUpperCase() : '';
    if (nextPrompt !== this.prompt) {
      this.prompt = nextPrompt;
      this.update();
    }
  }

  setHostiles(deckCount, shipCount) {
    if (deckCount !== this.hostilesDeck || shipCount !== this.hostilesShip) {
      this.hostilesDeck = deckCount;
      this.hostilesShip = shipCount;
      this.update();
    }
  }
}
