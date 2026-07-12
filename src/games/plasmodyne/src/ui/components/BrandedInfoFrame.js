import { ARCADE_UI } from '../theme/ArcadeUiTheme.js';
import { LOGO_KEYS } from '../LogoAssets.js';

export class BrandedInfoFrame {
  constructor(scene, {
    width = 520,
    height = 270,
    title = 'SYSTEM',
    status = '',
    depth = ARCADE_UI.z.overlay,
    panelAlpha = ARCADE_UI.alpha.panel
  } = {}) {
    this.scene = scene;
    this.width = width;
    this.height = height;
    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(depth);

    this.panel = scene.add.rectangle(0, 0, width, height, ARCADE_UI.colors.panel, panelAlpha);
    this.panel.setStrokeStyle(1, ARCADE_UI.colors.cyan, ARCADE_UI.alpha.border);
    this.header = scene.add.rectangle(0, -height / 2 + 26, width - 18, 42, ARCADE_UI.colors.header, ARCADE_UI.alpha.header);
    this.header.setStrokeStyle(1, ARCADE_UI.colors.cyan, 0.48);
    this.leftText = scene.add.text(-width / 2 + 24, -height / 2 + 14, title, {
      fontFamily: ARCADE_UI.fontFamily,
      fontSize: '15px',
      color: ARCADE_UI.colors.cyanText
    }).setOrigin(0, 0);
    this.brand = scene.add.text(0, -height / 2 + 10, 'PLASMODYNE', {
      fontFamily: ARCADE_UI.titleFontFamily,
      fontSize: '18px',
      color: ARCADE_UI.colors.white
    }).setOrigin(0.5, 0);
    this.brand.setShadow(0, 0, ARCADE_UI.glow.cyan, 5, true, true);
    this.brandLogo = scene.add.image(0, -height / 2 + 26, LOGO_KEYS.white)
      .setOrigin(0.5);
    this.brandLogo.setAlpha(scene.textures.exists(LOGO_KEYS.white) ? 1 : 0);
    this.fitBrandLogo(124, 34);
    this.brand.setAlpha(this.brandLogo.alpha > 0 ? 0 : 1);
    this.rightText = scene.add.text(width / 2 - 24, -height / 2 + 14, status, {
      fontFamily: ARCADE_UI.fontFamily,
      fontSize: '13px',
      color: ARCADE_UI.colors.amber
    }).setOrigin(1, 0);
    this.container.add([this.panel, this.header, this.leftText, this.brand, this.brandLogo, this.rightText]);
  }

  setTitle(title) {
    this.leftText.setText(title);
  }

  setStatus(status) {
    this.rightText.setText(status);
  }

  setPosition(x, y) {
    this.container.setPosition(x, y);
  }

  setVisible(value) {
    this.container.setVisible(value);
  }

  fitBrandLogo(maxWidth = 124, maxHeight = 34) {
    if (!this.brandLogo || !this.scene.textures.exists(LOGO_KEYS.white)) {
      return;
    }
    const source = this.brandLogo.texture.getSourceImage();
    const aspect = source?.width && source?.height ? source.width / source.height : 1;
    const widthFromHeight = maxHeight * aspect;
    const width = Math.min(maxWidth, widthFromHeight);
    const height = width / aspect;
    this.brandLogo.setDisplaySize(width, height);
  }

  destroy() {
    this.container.destroy(true);
  }
}
