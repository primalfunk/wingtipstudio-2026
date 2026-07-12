import LayoutSystem from '../systems/LayoutSystem.js';

export default class Hud {
  constructor(scene, missionState) {
    this.scene = scene;
    this.missionState = missionState;
    const layout = LayoutSystem.current();
    this.text = scene.add.text(14, 14, '', {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '14px',
      color: '#d7e0df',
      backgroundColor: '#11191d',
      padding: { x: 8, y: 6 },
    }).setDepth(100).setScrollFactor(0);

    this.status = scene.add.text(layout.safe.right, layout.safe.top, 'FUEL 100  AMMO 40', {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '14px',
      color: '#f6e7a8',
      backgroundColor: '#11191d',
      padding: { x: 8, y: 6 },
    }).setOrigin(1, 0).setDepth(100).setScrollFactor(0);

    this.alert = scene.add.text(layout.centerX, 96, '', {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '13px',
      color: '#d8ecff',
      backgroundColor: '#12345a',
      padding: { x: 10, y: 5 },
    }).setOrigin(0.5).setDepth(100).setScrollFactor(0).setVisible(false);
    this.alertEvent = null;
    LayoutSystem.onResize(scene, () => this.refreshLayout());
  }

  update() {
    const maxLife = this.missionState.maxPlayerDamage ?? 3;
    const life = Math.max(0, maxLife - this.missionState.playerDamage);
    const lifeDiamonds = this.formatLifeDiamonds(life, maxLife);
    this.text.setText(
      `SCORE ${this.missionState.score}\nDIST ${Math.floor(this.missionState.distance)} MI\nMODE ${(this.missionState.playerMode ?? 'car').toUpperCase()}\nHP ${lifeDiamonds}\nLIVES ${this.formatLives()}\nSEG ${this.missionState.currentSegment?.label ?? 'UNKNOWN'}`,
    );
    this.status.setText(`FUEL ${Math.ceil(this.missionState.playerFuel)}  AMMO ${this.missionState.playerAmmo}/${this.missionState.maxPlayerAmmo}`);
    this.refreshLayout();
  }

  refreshLayout() {
    const layout = LayoutSystem.current();
    this.text.setPosition(layout.safe.left, layout.safe.top);
    this.status.setPosition(layout.safe.right, layout.safe.top);
    this.alert.setPosition(layout.centerX, Math.max(78, layout.safe.top + 82));
  }

  formatLives() {
    return `x${this.missionState.playerLives ?? 3}`;
  }

  formatLifeDiamonds(life, maxLife) {
    const slots = Math.ceil(maxLife);
    const filled = Math.max(0, Math.ceil(life));
    return Array.from({ length: slots }, (_, index) => (index < filled ? '◆' : '◇')).join(' ');
  }

  flashAlert(message, durationMs = 2100) {
    this.alert.setText(message);
    this.alert.setVisible(true);
    if (this.alertEvent) {
      this.alertEvent.remove(false);
    }
    this.alertEvent = this.scene.time.delayedCall(durationMs, () => {
      this.alert.setVisible(false);
    });
  }
}
