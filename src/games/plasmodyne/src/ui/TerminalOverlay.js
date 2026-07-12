import { UI_THEME } from './UiTheme.js';
import { BrandedInfoFrame } from './components/BrandedInfoFrame.js';
import { getDeckInfo } from '../data/deckNames.js';
import { getDroidVisualKeys } from '../graphics/droidAnimationAssets.js';
import { DroidNumerals } from './fonts/DroidNumerals.js';
import { LOGO_KEYS } from './LogoAssets.js';

export class TerminalOverlay {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(1700);
    this.container.setVisible(false);
    this.bounds = { x: 0, y: 0, width: 0, height: 0 };

    this.background = scene.add.rectangle(0, 0, 1, 1, 0x020507, 0.94).setOrigin(0);
    this.frame = new BrandedInfoFrame(scene, { width: 760, height: 430, title: 'CONSOLE', status: 'DECK', depth: 1701, panelAlpha: 0.96 });
    this.headerTitle = scene.add.text(0, 0, 'CONSOLE', {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '15px',
      color: '#b94f37'
    }).setOrigin(0, 0.5);
    this.headerStatus = scene.add.text(0, 0, 'DECK', {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '13px',
      color: '#b94f37'
    }).setOrigin(1, 0.5);
    this.headerLogo = scene.add.image(0, 0, LOGO_KEYS.blue).setOrigin(0.5);
    this.panel = scene.add.rectangle(0, 0, 690, 260, 0x8a4f26, 0.88);
    this.panel.setStrokeStyle(2, 0xfff4bb, 0.72);
    this.body = scene.add.text(0, 0, '', {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '19px',
      color: '#fff1a8',
      lineSpacing: 7,
      wordWrap: { width: 520 }
    });
    this.footer = scene.add.text(0, 0, 'F / Esc: close console', {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '13px',
      color: '#fff1a8'
    }).setOrigin(0.5);
    this.footer.setPadding(0, 4, 0, 4);
    this.closeButton = scene.add.container(0, 0);
    this.closeBox = scene.add.rectangle(0, 0, 34, 28, 0x8a4f26, 0.92)
      .setStrokeStyle(1, 0xfff1a8, 0.82);
    this.closeText = scene.add.text(0, -1, 'X', {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '16px',
      color: '#fff1a8'
    }).setOrigin(0.5);
    this.closeButton.add([this.closeBox, this.closeText]);
    this.closeButton.setSize(34, 28);
    this.closeButton.setInteractive({ useHandCursor: true });
    this.closeButton.on('pointerdown', (pointer) => {
      pointer?.event?.stopPropagation?.();
      this.hide();
    });
    this.icons = ['droid', 'deck', 'ship'].map((type) => this.createIcon(type));
    this.container.add([
      this.background,
      this.frame.container,
      this.headerTitle,
      this.headerStatus,
      this.headerLogo,
      this.panel,
      this.body,
      this.footer,
      this.closeButton,
      ...this.icons.map((icon) => icon.container)
    ]);
    this.handleResize();
    scene.scale.on('resize', this.handleResize, this);
  }

  createIcon(type) {
    const container = this.scene.add.container(0, 0);
    const graphic = this.scene.add.graphics();
    const droidSprite = type === 'droid'
      ? this.scene.add.sprite(0, -4, 'droid-series-0-sheet', 0).setVisible(false)
      : null;
    const droidId = type === 'droid'
      ? new DroidNumerals(this.scene, 0, -2, '001', {
          size: 21,
          depth: 1702,
          scrollFactor: 0,
          fitWidth: 58,
          fitHeight: 22,
          color: 0xf4f4ef,
          shadowColor: 0x343a40
        })
      : null;
    const label = this.scene.add.text(0, 50, this.iconLabel(type), {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '12px',
      color: '#fff1a8'
    }).setOrigin(0.5);
    container.add([graphic]);
    if (droidSprite) container.add(droidSprite);
    if (droidId) container.add(droidId.container);
    container.add(label);
    container.setSize(96, 96);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerdown', (pointer) => {
      pointer?.event?.stopPropagation?.();
      this.select(type);
    });
    return { type, container, graphic, label, droidSprite, droidId };
  }

  iconLabel(type) {
    if (type === 'droid') return 'DROID';
    if (type === 'deck') return 'DECK';
    return 'ALERT';
  }

  showConsole({ terminal, playerBody, deck, ship }) {
    this.terminal = terminal;
    this.playerBody = playerBody;
    this.deck = deck;
    this.ship = ship;
    const info = getDeckInfo(deck.id);
    this.frame.setStatus(`DECK ${info.displayNumber}`);
    this.headerStatus.setText(`DECK ${info.displayNumber}`);
    this.container.setVisible(true);
    this.handleResize();
    this.scene.input.off('pointerdown', this.handlePointerDown, this);
    this.scene.input.on('pointerdown', this.handlePointerDown, this);
    this.select(terminal?.terminalType === 'ship-alert' ? 'ship' : terminal?.terminalType === 'local-map' ? 'deck' : 'droid');
  }

  show(title, lines) {
    this.container.setVisible(true);
    this.body.setText([title, '', ...(Array.isArray(lines) ? lines : [lines])].join('\n'));
  }

  select(type) {
    if (type === 'droid') {
      const body = this.playerBody;
      this.body.setText([
        `Unit type ${body.displayId} - ${body.chassisClass}`,
        `Access granted.`,
        '',
        `Integrity : ${Math.ceil(body.integrity)} / ${body.maxIntegrity}`,
        `Weapon    : ${body.weaponType}`,
        `Clearance : ${body.clearanceLevel}`,
        `Speed     : ${Math.round(body.speed)}`
      ].join('\n'));
    } else if (type === 'deck') {
      const hostiles = this.deck.droids?.filter((droid) => !droid.neutralized).length ?? 0;
      this.body.setText([
        `Ship : PLASMODYNE`,
        `Deck : ${getDeckInfo(this.deck.id).name}`,
        `Rooms: ${this.deck.rooms.length}`,
        `Doors: ${this.deck.doors.length}`,
        `Hostile signals: ${hostiles}`,
        '',
        `Local map uploaded.`
      ].join('\n'));
      for (const room of this.deck.rooms) room.discovered = true;
      for (const corridor of this.deck.corridors) corridor.discovered = true;
      for (const lift of this.deck.lifts) lift.discovered = true;
    } else {
      const lines = this.ship.decks.map((deck) => {
        const hostiles = deck.droids?.filter((droid) => !droid.neutralized).length ?? 0;
        const info = getDeckInfo(deck.id);
        return `Deck ${info.displayNumber} ${info.shortName}: ${deck.cleared ? 'POWER DOWN' : `${hostiles} hostile signals`}`;
      });
      this.body.setText(['Ship map / alert state', '', ...lines].join('\n'));
    }
    this.drawIcons(type);
  }

  drawIcons(activeType = null) {
    for (const icon of this.icons) {
      const g = icon.graphic;
      const active = icon.type === activeType;
      g.clear();
      icon.droidSprite?.setVisible(false);
      icon.droidId?.setVisible(false);
      g.lineStyle(3, active ? 0xfff36d : 0xfff1a8, 1);
      g.fillStyle(active ? 0x5c2f18 : 0x8a4f26, 1);
      if (icon.type === 'droid') {
        const body = this.playerBody ?? { displayId: '001', rank: 1 };
        const visual = getDroidVisualKeys(body.rank ?? Number.parseInt(body.displayId, 10) ?? 0);
        g.fillStyle(active ? 0x5c2f18 : 0x3c281b, active ? 0.78 : 0.42);
        g.fillCircle(0, -4, 32);
        g.strokeCircle(0, -4, 32);
        if (icon.droidSprite) {
          icon.droidSprite.setTexture(visual.textureKey, 0);
          icon.droidSprite.setDisplaySize(70, 70);
          icon.droidSprite.setPosition(0, -8);
          icon.droidSprite.setAlpha(active ? 1 : 0.72);
          icon.droidSprite.play(visual.animationKey, true);
          icon.droidSprite.setVisible(true);
        }
        if (icon.droidId) {
          icon.droidId.setText(body.displayId ?? '001');
          icon.droidId.setColor(active ? 0xf4f4ef : 0xd5dde4, active ? 0x2d343a : 0x24292d);
          icon.droidId.setPosition(0, -1);
          icon.droidId.setAlpha(active ? 1 : 0.82);
          icon.droidId.setVisible(true);
        }
      } else if (icon.type === 'deck') {
        g.strokeRect(-35, -26, 70, 52);
        for (let x = -18; x <= 18; x += 18) g.lineBetween(x, -26, x, 26);
        for (let y = -9; y <= 9; y += 18) g.lineBetween(-35, y, 35, y);
      } else {
        g.fillStyle(active ? 0xff6f61 : 0xf4f4ef, 1);
        g.fillTriangle(0, -34, 34, 28, -34, 28);
        g.fillStyle(0x6d6d68, 1);
        g.fillRect(-4, -12, 8, 22);
        g.fillCircle(0, 20, 4);
      }
    }
  }

  hide() {
    this.container.setVisible(false);
    this.scene.input.off('pointerdown', this.handlePointerDown, this);
  }

  isVisible() {
    return this.container.visible;
  }

  handlePointerDown(pointer) {
    if (!this.isVisible()) {
      return;
    }
    const inside = pointer.x >= this.bounds.x &&
      pointer.x <= this.bounds.x + this.bounds.width &&
      pointer.y >= this.bounds.y &&
      pointer.y <= this.bounds.y + this.bounds.height;
    if (!inside) {
      pointer.event?.stopPropagation?.();
      this.hide();
    }
  }

  handleResize() {
    const { width, height } = this.scene.scale;
    const safeInset = 5;
    this.background.setSize(width, height);
    const marginX = safeInset;
    const marginTop = safeInset;
    const marginBottom = safeInset;
    const frameWidth = Math.max(320, width - marginX * 2);
    const frameHeight = Math.max(320, height - marginTop - marginBottom);
    const cx = width / 2;
    const cy = marginTop + frameHeight / 2;
    this.frame.width = frameWidth;
    this.frame.height = frameHeight;
    this.frame.panel.setSize(frameWidth, frameHeight);
    this.frame.header.setSize(frameWidth - 22, 48);
    this.frame.panel.setStrokeStyle(2, 0xfff1a8, 0.86);
    this.frame.panel.setFillStyle(0xcdbf73, 0.96);
    this.frame.header.setFillStyle(0xf8f3d0, 1);
    this.frame.header.setStrokeStyle(1, 0x8a4f26, 0.72);
    this.frame.leftText.setColor('#b94f37');
    this.frame.brand.setColor('#b94f37');
    this.frame.rightText.setColor('#b94f37');
    this.frame.leftText.setVisible(false);
    this.frame.brand.setVisible(false);
    this.frame.brandLogo?.setVisible(false);
    this.frame.rightText.setVisible(false);
    this.frame.setPosition(cx, cy);
    this.frame.header.setPosition(0, -frameHeight / 2 + 38);

    const headerCenterY = marginTop + 38;
    this.headerTitle.setPosition(marginX + 28, headerCenterY);
    this.headerStatus.setPosition(width - marginX - 76, headerCenterY);
    this.fitHeaderLogo(width / 2, headerCenterY, 68, 30);
    this.closeButton.setPosition(cx + frameWidth / 2 - 34, cy - frameHeight / 2 + 38);
    this.bounds = {
      x: cx - frameWidth / 2,
      y: cy - frameHeight / 2,
      width: frameWidth,
      height: frameHeight
    };

    const panelWidth = frameWidth - 118;
    const panelHeight = frameHeight - 184;
    this.panel.setSize(panelWidth, panelHeight);
    this.panel.setPosition(cx, cy + 32);
    const panelLeft = cx - panelWidth / 2;
    const panelTop = cy + 32 - panelHeight / 2;
    const contentScale = Phaser.Math.Clamp(Math.min(panelHeight / 360, panelWidth / 780), 0.78, 1.18);
    this.body.setFontSize(Math.round(19 * contentScale));
    this.body.setLineSpacing(Math.round(7 * contentScale));
    this.body.setPosition(panelLeft + 210 * contentScale, panelTop + 48 * contentScale);
    this.body.setWordWrapWidth(Math.max(240, panelWidth - 270 * contentScale));
    this.footer.setText('ESC: close console');
    this.footer.setPosition(cx, cy + frameHeight / 2 - 34);
    const iconX = panelLeft + 108 * contentScale;
    const iconStartY = panelTop + 70 * contentScale;
    const iconEndY = panelTop + panelHeight - 82 * contentScale;
    const iconSpacing = this.icons.length > 1 ? (iconEndY - iconStartY) / (this.icons.length - 1) : 0;
    this.icons.forEach((icon, index) => {
      icon.container.setScale(contentScale);
      icon.container.setPosition(iconX, iconStartY + index * iconSpacing);
    });
    this.drawIcons();
  }

  fitHeaderLogo(x, y, maxWidth, maxHeight) {
    if (!this.headerLogo || !this.scene.textures.exists(LOGO_KEYS.blue)) {
      this.headerLogo?.setAlpha(0);
      return;
    }
    const source = this.headerLogo.texture.getSourceImage();
    const aspect = source?.width && source?.height ? source.width / source.height : 1;
    const displayWidth = Math.min(maxWidth, maxHeight * aspect);
    const displayHeight = displayWidth / aspect;
    this.headerLogo.setPosition(x, y);
    this.headerLogo.setDisplaySize(displayWidth, displayHeight);
    this.headerLogo.setAlpha(1);
  }

  destroy() {
    this.scene.input.off('pointerdown', this.handlePointerDown, this);
    this.scene.scale.off('resize', this.handleResize, this);
    this.container.destroy(true);
  }
}
