import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../data/tuning.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  create(data) {
    this.scene.start('DebriefScene', data);
  }
}
