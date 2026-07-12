import { SIGNALS } from '../data/tuning.js';

export default class RoadSign {
  constructor(scene, x, y, text) {
    this.scene = scene;
    this.container = scene.add.container(x, y).setDepth(9);
    this.post = scene.add.rectangle(0, 28, 4, 34, 0xb8b49a);
    this.panel = scene.add.rectangle(0, 0, 74, 34, 0x1d2d27).setStrokeStyle(2, 0xd6d0aa);
    this.label = scene.add.text(0, 0, text, {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '11px',
      color: '#f4edd0',
      align: 'center',
      wordWrap: { width: 64 },
    }).setOrigin(0.5);

    this.container.add([this.post, this.panel, this.label]);
  }

  update(delta) {
    this.container.y += (SIGNALS.roadSignSpeed * delta) / 1000;
  }

  get y() {
    return this.container.y;
  }

  destroy() {
    this.container.destroy(true);
  }
}
