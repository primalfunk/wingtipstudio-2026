import Phaser from 'phaser';
import RoadSign from '../entities/RoadSign.js';
import { ROAD, SIGNALS } from '../data/tuning.js';
import { ROAD_SIGN_TEMPLATES } from '../data/roadSignTemplates.js';

export default class RoadSignSystem {
  constructor(scene) {
    this.scene = scene;
    this.activeSigns = [];
    this.nextRoadSignAt = scene.time.now + SIGNALS.firstSignalDelayMs + 4200;
  }

  update(time, delta) {
    if (time >= this.nextRoadSignAt) {
      this.spawnRoadSign();
      this.nextRoadSignAt = time + 7000 + Phaser.Math.Between(1500, 4200);
    }

    for (let index = this.activeSigns.length - 1; index >= 0; index -= 1) {
      const sign = this.activeSigns[index];
      sign.update(delta);
      if (sign.y > SIGNALS.roadSignDespawnY) {
        this.activeSigns.splice(index, 1);
        sign.destroy();
      }
    }
  }

  spawnRoadSign(template = Phaser.Utils.Array.GetRandom(ROAD_SIGN_TEMPLATES)) {
    const onRightShoulder = Phaser.Math.Between(0, 1) === 1;
    const x = onRightShoulder ? ROAD.right + 46 : ROAD.left - 46;
    const sign = new RoadSign(this.scene, x, -48, template.text);
    this.activeSigns.push(sign);
  }
}
