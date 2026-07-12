import { UI_THEME } from './UiTheme.js';

export class Panel {
  constructor(scene, width, height, title, context = '') {
    this.scene = scene;
    this.width = width;
    this.height = height;
    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(0);

    this.background = scene.add.rectangle(0, 0, width, height, UI_THEME.panelDark, 0.96);
    this.background.setStrokeStyle(UI_THEME.borderThickness, UI_THEME.primaryAccent, 1);
    this.inner = scene.add.rectangle(0, 0, width - 14, height - 14, UI_THEME.panelDark, 0);
    this.inner.setStrokeStyle(1, UI_THEME.gridLine, 0.9);
    this.header = scene.add.rectangle(0, -height / 2 + 24, width - 16, 38, UI_THEME.panelLight, 0.8);
    this.title = scene.add.text(-width / 2 + 24, -height / 2 + 13, title, {
      fontFamily: UI_THEME.fontFamily,
      fontSize: UI_THEME.headingSize,
      color: UI_THEME.textPrimary
    });
    this.context = scene.add.text(width / 2 - 24, -height / 2 + 17, context, {
      fontFamily: UI_THEME.fontFamily,
      fontSize: UI_THEME.smallSize,
      color: UI_THEME.textMuted
    }).setOrigin(1, 0);

    this.container.add([this.background, this.inner, this.header, this.title, this.context]);
  }

  add(items) {
    this.container.add(items);
  }

  setPosition(x, y) {
    this.container.setPosition(x, y);
  }

  setDepth(depth) {
    this.container.setDepth(depth);
  }

  setVisible(visible) {
    this.container.setVisible(visible);
  }

  destroy() {
    this.container.destroy(true);
  }
}
