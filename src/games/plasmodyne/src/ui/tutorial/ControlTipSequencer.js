import { ControlTipPanel } from './ControlTipPanel.js';

const CONTROL_TIPS = [
  {
    id: 'move',
    iconIds: ['wasd', 'arrows', 'mouse-right'],
    title: 'MOVE',
    lines: ['WASD / ARROWS', 'or HOLD RIGHT MOUSE'],
    durationMs: 5200
  },
  {
    id: 'fire',
    iconIds: ['mouse-left', 'laser'],
    title: 'FIRE LASER',
    lines: ['LEFT CLICK', 'IF ARMED'],
    durationMs: 4800
  },
  {
    id: 'interact',
    iconIds: ['mouse-hold', 'signal'],
    title: 'INTERACT',
    lines: ['HOLD LEFT MOUSE', 'ELEVATORS / CONSOLES / DROIDS'],
    durationMs: 5600
  },
  {
    id: 'takeover',
    iconIds: ['droid', 'signal', 'mouse-hold'],
    title: 'HOST ACQUISITION',
    lines: ['HOLD LEFT ON DROID'],
    durationMs: 5000
  },
  {
    id: 'objective',
    iconIds: ['objective', 'droid'],
    title: 'CLEAR THE SHIP',
    lines: ['TERMINATE HOSTILE NODES'],
    durationMs: 5200
  }
];

export class ControlTipSequencer {
  constructor(scene) {
    this.scene = scene;
    this.panel = new ControlTipPanel(scene);
    this.started = false;
    this.index = 0;
    this.timer = null;
    this.scene.scale.on('resize', this.reflow, this);
  }

  start() {
    if (this.started) {
      return;
    }
    this.started = true;
    this.index = 0;
    this.showCurrent();
  }

  showCurrent() {
    const tip = CONTROL_TIPS[this.index];
    if (!tip) {
      this.panel.hide();
      return;
    }
    this.panel.show(tip);
    this.timer = this.scene.time.delayedCall(tip.durationMs, () => {
      this.panel.hide(() => {
        this.index += 1;
        this.showCurrent();
      });
    });
  }

  reflow() {
    this.panel.reflow();
  }

  destroy() {
    this.timer?.remove(false);
    this.scene.scale.off('resize', this.reflow, this);
    this.panel.destroy();
  }
}
