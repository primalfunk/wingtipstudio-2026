import Phaser from 'phaser';
import { BackgroundRenderer } from '../systems/BackgroundRenderer.js';
import { InputManager } from '../systems/InputManager.js';
import { VisualSettings } from '../systems/VisualSettings.js';
import { GAME_HEIGHT, GAME_WIDTH } from '../config.js';
import { fontConfig } from '../config/fonts.js';

const STEPS = [
  {
    title: 'TYPE THE STREAM',
    lines: [
      'Type the highlighted phrase. The bracketed character is your next target.',
      'Correct typing builds Flow. Mistakes add Instability.'
    ]
  },
  {
    title: 'CHOOSE FORKS BY TYPING',
    lines: [
      'Forks are not menus. Begin typing a branch phrase to commit to that route.',
      'SAFE is modest, REPAIR restores integrity, CORRUPTION pays more but bites back.'
    ]
  },
  {
    title: 'PRIORITIZE STREAMS',
    lines: [
      'Multi-stream encounters create competing lanes.',
      'Press Tab to switch focus. Typing only affects the focused stream.'
    ]
  },
  {
    title: 'USE RUN TOOLS',
    lines: [
      'Number keys 1, 2, and 3 activate active powerups when you have them.',
      'Upgrade and powerup choices appear between encounters.'
    ]
  },
  {
    title: 'STABILIZE THE RUN',
    lines: [
      'Survive the encounter sequence and finish the finale to stabilize the stream.',
      'If Integrity reaches zero, the signal is lost. Press Enter to start a run.'
    ]
  }
];

export class TutorialScene extends Phaser.Scene {
  constructor() {
    super('TutorialScene');
    this.inputManager = null;
    this.backgroundRenderer = null;
    this.audioManager = null;
    this.stepIndex = 0;
    this.panelText = null;
  }

  create() {
    this.cameras.main.setBackgroundColor('#05070d');
    this.audioManager = this.registry.get('audioManager');
    this.audioManager?.playMusic(this, 'menu');
    this.backgroundRenderer = new BackgroundRenderer(this, { depth: -30 });
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 980, 470, 0x07131f, 0.86)
      .setStrokeStyle(2, 0x35dfff, 0.48);
    this.panelText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', {
      fontFamily: fontConfig.ui,
      fontSize: `${Math.round(22 * VisualSettings.textScale)}px`,
      color: VisualSettings.highContrast ? '#ffffff' : '#f5fbff',
      align: 'center',
      lineSpacing: 8,
      wordWrap: { width: 820 }
    }).setOrigin(0.5).setShadow(0, 0, '#35dfff', VisualSettings.reduceGlow ? 0 : 7);

    this.inputManager = new InputManager(this);
    this.inputManager.onSpecialKey('Enter', () => {
      this.audioManager?.unlock(this);
      this.audioManager?.playSfx(this, 'uiConfirm');
      this.advance();
    });
    this.inputManager.onSpecialKey('Escape', () => {
      this.audioManager?.unlock(this);
      this.audioManager?.playSfx(this, 'uiCancel');
      this.scene.start('MainMenuScene');
    });
    this.inputManager.onTypedCharacter((character) => {
      this.audioManager?.unlock(this);
      if (character.toLowerCase() === 's') {
        this.audioManager?.playSfx(this, 'uiConfirm');
        this.startRun();
      }
    });
    this.renderStep();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdownInput());
  }

  update(_time, delta) {
    this.backgroundRenderer?.update({ biome: 'signalArchive', flow: 18, instability: 6 }, delta);
  }

  advance() {
    if (this.stepIndex >= STEPS.length - 1) {
      this.startRun();
      return;
    }
    this.stepIndex += 1;
    this.renderStep();
  }

  startRun() {
    const profileManager = this.registry.get('profileManager');
    const kitId = profileManager?.profile.lastSelectedKit ?? 'flow_runner';
    this.scene.start('GameScene', { kitId });
  }

  renderStep() {
    const step = STEPS[this.stepIndex];
    this.panelText.setText([
      'QUICK START TUTORIAL',
      '',
      `${this.stepIndex + 1}/${STEPS.length}  ${step.title}`,
      '',
      ...step.lines,
      '',
      this.stepIndex === STEPS.length - 1 ? 'Enter: Start Run' : 'Enter: Next',
      'S: Skip to Run   Escape: Menu'
    ]);
  }

  shutdownInput() {
    this.backgroundRenderer?.destroy();
    this.backgroundRenderer = null;
    this.inputManager?.destroy();
    this.inputManager = null;
  }
}
