import { streamConfig } from '../config/streams.js';
import { signalPanelConfig } from '../config/signalPanels.js';
import { visualConfig } from '../config/visuals.js';
import { VisualSettings } from '../systems/VisualSettings.js';
import { fontConfig } from '../config/fonts.js';

const TEXT_STYLE = {
  fontFamily: fontConfig.typing,
  fontSize: '27px'
};

export class MultiStreamView {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(210);
    this.streamViews = new Map();
  }

  update(manager, hazardState = null) {
    const activeIds = new Set(manager.streams.map((stream) => stream.id));
    for (const [id, view] of this.streamViews.entries()) {
      if (!activeIds.has(id)) {
        view.container.destroy();
        this.streamViews.delete(id);
      }
    }

    const layout = this.getLayoutPositions(manager.streams);
    for (const stream of manager.streams) {
      const isFocused = manager.getFocusedStream()?.id === stream.id;
      const view = this.getOrCreateView(stream);
      this.updateView(view, stream, isFocused, hazardState, layout.get(stream.id));
    }
  }

  clear() {
    for (const view of this.streamViews.values()) {
      view.container.destroy();
    }
    this.streamViews.clear();
  }

  getOrCreateView(stream) {
    if (this.streamViews.has(stream.id)) {
      return this.streamViews.get(stream.id);
    }

    const container = this.scene.add.container(stream.x, stream.y).setAlpha(0);
    const panel = this.scene.add.graphics();
    const focus = this.scene.add.text(-352, -50, '', {
      fontFamily: fontConfig.prompt,
      fontSize: '24px',
      color: '#fff2a6'
    }).setOrigin(0.5);
    const label = this.scene.add.text(0, -50, '', {
      fontFamily: fontConfig.ui,
      fontSize: '16px',
      color: '#ffffff',
      letterSpacing: 1
    }).setOrigin(0.5);
    const phrase = this.scene.add.text(0, 0, '', TEXT_STYLE).setOrigin(0.5);
    const footer = this.scene.add.text(0, 44, '', {
      fontFamily: fontConfig.ui,
      fontSize: '14px',
      color: '#8fa6b2',
      letterSpacing: 1
    }).setOrigin(0.5);

    container.add([panel, focus, label, phrase, footer]);
    this.container.add(container);

    this.scene.tweens.add({
      targets: container,
      alpha: 1,
      duration: VisualSettings.reduceMotion ? 1 : 180,
      ease: 'Sine.easeOut'
    });

    const view = { container, panel, focus, label, phrase, footer };
    this.streamViews.set(stream.id, view);
    return view;
  }

  updateView(view, stream, isFocused, hazardState, layoutPosition = null) {
    const style = streamConfig.roleStyles[stream.role];
    const progress = stream.getProgress();
    const current = isFocused && progress.currentCharacter ? `[${progress.currentCharacter}]` : progress.currentCharacter;
    const jitter = Math.min(0.7, (hazardState?.letterJitterIntensity ?? 0) * visualConfig.hazards.multiStreamHazardScale);
    const jitterX = jitter ? Math.sin(this.scene.time.now / 120 + stream.priority) * jitter * 2 : 0;
    const jitterY = jitter ? Math.cos(this.scene.time.now / 130 + stream.priority) * jitter : 0;

    view.container
      .setPosition((layoutPosition?.x ?? stream.x) + jitterX, (layoutPosition?.y ?? stream.y) + jitterY)
      .setAlpha(isFocused ? 1 : streamConfig.unfocusedStreamAlpha)
      .setScale(isFocused ? streamConfig.focusedStreamVisualScale : 1);
    view.focus.setText(isFocused ? 'LOCK' : '');
    view.label.setText(`${style.label} FEED // ${stream.integrity}%`).setColor(style.color);
    view.phrase
      .setText(`${progress.typedPrefix}${current}${progress.remainingText}`)
      .setColor(VisualSettings.highContrast && isFocused ? '#ffffff' : isFocused ? '#e8fbff' : '#9fb4bd')
      .setShadow(0, 0, style.color, VisualSettings.reduceGlow ? 0 : isFocused ? 7 : 2);
    view.footer.setText(isFocused ? this.getFooterText(stream) : 'TAB TO LOCK SIGNAL');
    this.drawPanel(view, stream, style, isFocused);
  }

  getLayoutPositions(streams) {
    const positions = new Map();
    const primary = streams.find((stream) => stream.role === 'primary');
    const secondary = streams.filter((stream) => stream.role !== 'primary');

    if (streams.length <= 2) {
      for (const stream of secondary) {
        positions.set(stream.id, { x: 640, y: 285 });
      }
      if (primary) {
        positions.set(primary.id, { x: 640, y: 475 });
      }
      return positions;
    }

    const secondaryYs = secondary.length > 1 ? [220, 590] : [245];
    secondary.forEach((stream, index) => {
      positions.set(stream.id, { x: 640, y: secondaryYs[index] ?? 590 + (index - 1) * 135 });
    });
    if (primary) {
      positions.set(primary.id, { x: 640, y: 405 });
    }
    return positions;
  }

  drawPanel(view, stream, style, isFocused) {
    const color = Number.parseInt(style.color.slice(1), 16);
    const width = Math.min(850, Math.max(560, stream.phrase.length * 18 + 170));
    const height = 116;
    const decay = stream.getDecayRatio();
    const accent = decay > signalPanelConfig.corruption.criticalThreshold ? visualConfig.colors.red : color;

    view.panel.clear();
    view.panel.fillStyle(0x020810, isFocused ? 0.84 : 0.68);
    view.panel.fillRect(-width / 2, -height / 2, width, height);
    view.panel.lineStyle(isFocused ? 2 : 1, accent, isFocused ? 0.68 : 0.34);
    view.panel.strokeRect(-width / 2, -height / 2, width, height);
    view.panel.lineStyle(2, accent, isFocused ? 0.52 : 0.25);
    view.panel.lineBetween(-width / 2 + 16, -height / 2 + 28, width / 2 - 16, -height / 2 + 28);
    view.panel.lineStyle(3, decay > signalPanelConfig.corruption.warningThreshold ? visualConfig.colors.red : visualConfig.colors.gold, isFocused ? 0.72 : 0.42);
    view.panel.lineBetween(-width / 2 + 16, height / 2 - 12, -width / 2 + 16 + (width - 32) * (1 - decay), height / 2 - 12);
  }

  getFooterText(stream) {
    if (stream.role === 'hazard') return 'CONTAIN TO REDUCE STATIC';
    if (stream.role === 'repair') return 'RESTORES CORE SIGNAL';
    if (stream.role === 'archive') return 'FRAGILE ARCHIVE WINDOW';
    if (stream.role === 'reward') return 'OPTIONAL SIGNAL CACHE';
    return 'PRIMARY RECOVERY CHANNEL';
  }
}
