import Phaser from 'phaser';
import LayoutSystem from '../systems/LayoutSystem.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    LayoutSystem.updateFromScale(this.scale);
    this.registry.set('bestScore', 0);
    this.scene.start('PreloadScene');
  }
}
