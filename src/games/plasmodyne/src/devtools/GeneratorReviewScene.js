import Phaser from 'phaser';
import { DEBUG, SHIP_GENERATION } from '../data/constants.js';
import { ShipGenerator } from '../systems/ShipGenerator.js';
import { DroidFactory } from '../systems/DroidFactory.js';
import { ShipGeneratorValidator } from '../systems/ShipGeneratorValidator.js';
import { FloorPreviewRenderer } from './FloorPreviewRenderer.js';
import { ElevatorAccessMapRenderer } from './ElevatorAccessMapRenderer.js';
import { GeneratorMetricsPanel } from './GeneratorMetricsPanel.js';

export class GeneratorReviewScene extends Phaser.Scene {
  constructor() {
    super('GeneratorReviewScene');
  }

  create(data = {}) {
    this.cameras.main.setBackgroundColor('#05080c');
    this.generator = new ShipGenerator();
    this.droidFactory = new DroidFactory();
    this.validator = new ShipGeneratorValidator();
    const params = new URLSearchParams(window.location.search);
    this.seed = data.seed ?? params.get('seed') ?? SHIP_GENERATION.seed;
    this.selectedDeckIndex = 0;
    this.showFloor = true;
    this.showAccess = true;
    this.showDebug = false;
    this.showMetrics = true;

    this.floorPreview = new FloorPreviewRenderer(this);
    this.accessMap = new ElevatorAccessMapRenderer(this);
    this.metricsPanel = new GeneratorMetricsPanel(this);
    this.title = this.add.text(12, this.scale.height - 30, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#baf7ff'
    }).setDepth(60);

    this.bindKeys();
    this.generate();
    this.scale.on('resize', this.render, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  bindKeys() {
    this.leftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.rightKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.rKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.enterKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.eKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.fKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    this.dKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.mKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.sKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.leftKey)) this.cycleDeck(-1);
    if (Phaser.Input.Keyboard.JustDown(this.rightKey)) this.cycleDeck(1);
    if (Phaser.Input.Keyboard.JustDown(this.rKey)) {
      this.seed = `review-${Date.now()}`;
      this.generate();
    }
    if (Phaser.Input.Keyboard.JustDown(this.enterKey)) this.generate();
    if (Phaser.Input.Keyboard.JustDown(this.eKey)) {
      this.showAccess = !this.showAccess;
      this.render();
    }
    if (Phaser.Input.Keyboard.JustDown(this.fKey)) {
      this.showFloor = !this.showFloor;
      this.render();
    }
    if (Phaser.Input.Keyboard.JustDown(this.dKey)) {
      this.showDebug = !this.showDebug;
      this.render();
    }
    if (Phaser.Input.Keyboard.JustDown(this.mKey)) {
      this.showMetrics = !this.showMetrics;
      this.render();
    }
    if (Phaser.Input.Keyboard.JustDown(this.sKey)) this.exportCanvasSnapshot();
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) this.scene.start('MainMenuScene');
  }

  generate() {
    this.ship = this.generator.generateShip(this.seed);
    this.droidFactory.populateShip(this.ship);
    this.validation = this.validator.validate(this.ship);
    this.selectedDeckIndex = Phaser.Math.Clamp(this.selectedDeckIndex, 0, this.ship.decks.length - 1);
    this.render();
  }

  cycleDeck(direction) {
    this.selectedDeckIndex = Phaser.Math.Wrap(this.selectedDeckIndex + direction, 0, this.ship.decks.length);
    this.render();
  }

  render() {
    if (!this.ship) return;
    const deck = this.ship.decks[this.selectedDeckIndex];
    this.floorPreview.setVisible(this.showFloor);
    this.accessMap.setVisible(this.showAccess);
    this.metricsPanel.setVisible(this.showMetrics);
    if (this.showFloor) this.floorPreview.render(deck, this.validation, { debug: this.showDebug });
    if (this.showAccess) this.accessMap.render(this.ship, this.validation, deck.id);
    if (this.showMetrics) this.metricsPanel.render({ seed: this.seed, ship: this.ship, deck, validation: this.validation });
    this.title.setPosition(12, this.scale.height - 30);
    this.title.setText(`Generator Review  //  ${DEBUG.showHudDetails ? 'DEBUG' : 'DEV'}  //  floor ${deck.id}/${this.ship.decks.length}`);
  }

  exportCanvasSnapshot() {
    this.game.renderer.snapshot((image) => {
      const link = document.createElement('a');
      link.download = `plasmodyne_${this.seed}_floor_${this.ship.decks[this.selectedDeckIndex].id}.png`;
      link.href = image.src;
      link.click();
    }, 'image/png');
  }

  shutdown() {
    this.scale.off('resize', this.render, this);
    this.floorPreview?.destroy();
    this.accessMap?.destroy();
    this.metricsPanel?.destroy();
  }
}
