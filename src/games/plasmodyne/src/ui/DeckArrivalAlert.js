import { ARCADE_UI } from './theme/ArcadeUiTheme.js';
import { getDeckInfo } from '../data/deckNames.js';

export class DeckArrivalAlert {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(Math.max(ARCADE_UI.z.alert, ARCADE_UI.z.overlay + 20));
    this.container.setAlpha(0);
    this.panel = scene.add.rectangle(0, 0, 420, 86, ARCADE_UI.colors.panel, 0.88);
    this.panel.setStrokeStyle(1, ARCADE_UI.colors.cyan, 0.72);
    this.title = scene.add.text(0, -24, '', {
      fontFamily: ARCADE_UI.fontFamily,
      fontSize: '17px',
      color: ARCADE_UI.colors.cyanText
    }).setOrigin(0.5);
    this.name = scene.add.text(0, 8, '', {
      fontFamily: ARCADE_UI.titleFontFamily,
      fontSize: '24px',
      color: ARCADE_UI.colors.white
    }).setOrigin(0.5);
    this.name.setShadow(0, 0, ARCADE_UI.glow.cyan, 6, true, true);
    this.container.add([this.panel, this.title, this.name]);
    this.handleResize();
    scene.scale.on('resize', this.handleResize, this);
  }

  show(deckId) {
    const info = getDeckInfo(deckId);
    this.showMessage(`ARRIVAL: DECK ${info.displayNumber}`, info.name);
  }

  showTraveling(deckId) {
    const info = getDeckInfo(deckId);
    this.showMessage('TRAVELING TO', info.name);
  }

  showMessage(title, name) {
    this.title.setText(title);
    this.name.setText(name);
    this.scene.tweens.killTweensOf(this.container);
    this.container.setAlpha(0);
    this.container.setVisible(true);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: ARCADE_UI.timing.alertFadeIn,
      onComplete: () => {
        this.scene.time.delayedCall(ARCADE_UI.timing.alertHold, () => {
          this.scene.tweens.add({
            targets: this.container,
            alpha: 0,
            duration: ARCADE_UI.timing.alertFadeOut
          });
        });
      }
    });
  }

  handleResize() {
    const panelHeight = this.panel.height ?? 86;
    const minCenterY = panelHeight / 2 + 16;
    const preferredY = 108;
    this.container.setPosition(this.scene.scale.width / 2, Math.max(minCenterY, preferredY));
  }

  destroy() {
    this.scene.scale.off('resize', this.handleResize, this);
    this.container.destroy(true);
  }
}
