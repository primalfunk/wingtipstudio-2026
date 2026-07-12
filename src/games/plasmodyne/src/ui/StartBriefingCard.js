import { UI_THEME } from './UiTheme.js';
import { DroidNumerals } from './fonts/DroidNumerals.js';
import { AUDIO_KEYS } from '../systems/GameAudio.js';
import { getDroidAnimationKey } from '../graphics/droidAnimationAssets.js';
import { drawDroidSignalSlotEffect } from './effects/DroidSignalSlotEffect.js';
import { TYPOGRAPHY } from './theme/Typography.js';
import { LOGO_KEYS } from './LogoAssets.js';

const TYPE_INTERVAL_MS = 24;
const TYPING_VOLUME = 0.18;

export class StartBriefingCard {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(1650);
    this.container.setVisible(false);
    this.iconState = { angle: 0, pulse: 0 };
    this.fullText = '';
    this.visibleChars = 0;
    this.typingComplete = true;
    this.nextTypeAt = 0;
    this.typingSound = null;

    this.backdrop = scene.add.rectangle(0, 0, 1, 1, 0x010405, 1).setOrigin(0);
    this.panelGlow = scene.add.rectangle(0, 0, 1, 1, 0x78f0ff, 0.03);
    this.panel = scene.add.rectangle(0, 0, 1, 1, 0x02070a, 0.92);
    this.panel.setStrokeStyle(2, 0x78f0ff, 0.7);
    this.innerPanel = scene.add.rectangle(0, 0, 1, 1, 0x102533, 0.9);
    this.innerPanel.setStrokeStyle(1, 0xb7f6ff, 0.42);
    this.header = scene.add.rectangle(0, 0, 1, 32, 0xd8f4f8, 1);
    this.header.setStrokeStyle(2, 0x78f0ff, 0.95);
    this.headerLeft = scene.add.text(0, 0, 'Game on!', {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '14px',
      color: '#15313c'
    }).setOrigin(0, 0);
    this.brand = scene.add.text(0, 0, 'PLASMODYNE', {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '13px',
      color: '#16313d'
    }).setOrigin(0.5, 0);
    this.brandLogo = scene.add.image(0, 0, LOGO_KEYS.white)
      .setOrigin(0.5)
      .setDisplaySize(96, 26);
    this.brandLogo.setAlpha(scene.textures.exists(LOGO_KEYS.white) ? 1 : 0);
    this.brand.setAlpha(this.brandLogo.alpha > 0 ? 0 : 1);
    this.headerDot = scene.add.text(0, 0, '001', {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '14px',
      color: '#16313d'
    }).setOrigin(0.5, 0);

    this.scanlines = scene.add.graphics();
    this.cornerMarks = scene.add.graphics();
    this.unitIcon = scene.add.graphics();
    this.topLogoGold = scene.add.image(0, 0, LOGO_KEYS.gold).setOrigin(0.5);
    this.bottomLogoGold = scene.add.image(0, 0, LOGO_KEYS.gold).setOrigin(0.5);
    for (const logo of [this.topLogoGold, this.bottomLogoGold]) {
      logo.setAlpha(scene.textures.exists(logo.texture.key) ? 1 : 0);
    }
    this.unitSprite = scene.add.sprite(0, 0, 'droid-series-0-sheet', 0);
    this.unitSprite.setScrollFactor(0);
    this.unitSprite.play(getDroidAnimationKey(0));
    this.unitActivity = scene.add.graphics();
    this.unitId = new DroidNumerals(scene, 0, 0, '001', {
      size: 48,
      color: 0xd8f7ff,
      shadowColor: 0x4f6f76,
      depth: 1651,
      fitWidth: 106,
      fitHeight: 56,
      scrollFactor: 0
    });
    this.title = scene.add.text(0, 0, 'MISSION', {
      fontFamily: UI_THEME.titleFontFamily,
      fontSize: '32px',
      color: '#ffd36a',
      fontStyle: '900'
    }).setOrigin(0.5, 0.5);
    this.title.setShadow(0, 0, '#ffd36a', 10, true, true);
    this.body = scene.add.text(0, 0, '', {
      fontFamily: TYPOGRAPHY.terminal.family,
      fontSize: '28px',
      color: '#d8f7ff',
      fontStyle: '900',
      align: 'center',
      lineSpacing: 18,
      wordWrap: { width: 620 }
    }).setOrigin(0.5, 0.5);
    this.body.setShadow(0, 0, '#78f0ff', 9, true, true);
    this.prompt = scene.add.text(0, 0, '[ CLICK / PRESS ANY KEY ]', {
      fontFamily: UI_THEME.fontFamily,
      fontSize: '13px',
      color: '#8ff0ff'
    }).setOrigin(0.5, 0.5);
    this.prompt.setShadow(0, 0, '#78f0ff', 6, true, true);

    this.container.add([
      this.backdrop,
      this.panelGlow,
      this.panel,
      this.innerPanel,
      this.header,
      this.scanlines,
      this.cornerMarks,
      this.headerLeft,
      this.brand,
      this.brandLogo,
      this.headerDot,
      this.unitIcon,
      this.topLogoGold,
      this.bottomLogoGold,
      this.unitSprite,
      this.unitActivity,
      this.unitId.container,
      this.title,
      this.body,
      this.prompt
    ]);
    this.dismissPointer = (pointer) => {
      pointer?.event?.stopPropagation?.();
      this.dismiss();
    };
    this.dismissKey = () => this.dismiss();
    this.handleResize();
    scene.scale.on('resize', this.handleResize, this);
  }

  show() {
    this.fullText = [
      'UNIT TYPE 001 - INFLUENCE DEVICE',
      'THIS IS THE UNIT YOU CURRENTLY CONTROL.',
      '',
      'ELIMINATE ALL ROGUE DROIDS',
      'ON THIS SHIP.'
    ].join('\n');
    this.visibleChars = 0;
    this.typingComplete = false;
    this.nextTypeAt = this.scene.time.now;
    this.body.setText('');
    this.container.setVisible(true);
    this.scene.input.off('pointerdown', this.dismissPointer);
    this.scene.input.keyboard.off('keydown', this.dismissKey);
    this.scene.input.on('pointerdown', this.dismissPointer);
    this.scene.input.keyboard.on('keydown', this.dismissKey);
    this.drawIcon();
    this.drawFrameDetails();
    this.promptTween?.stop();
    this.iconTween?.stop();
    this.iconPulseTween?.stop();
    this.prompt.setAlpha(1);
    this.promptTween = this.scene.tweens.add({
      targets: this.prompt,
      alpha: 0.35,
      duration: 520,
      yoyo: true,
      repeat: -1
    });
    this.iconTween = this.scene.tweens.add({
      targets: this.iconState,
      angle: Math.PI * 2,
      duration: 1400,
      repeat: -1,
      onUpdate: () => this.drawIcon()
    });
    this.iconPulseTween = this.scene.tweens.add({
      targets: this.iconState,
      pulse: 1,
      duration: 620,
      yoyo: true,
      repeat: -1,
      onUpdate: () => this.drawIcon()
    });
    this.startTypingSound();
  }

  dismiss() {
    if (!this.container.visible) return;
    if (!this.typingComplete) {
      this.completeTyping();
      return;
    }
    this.container.setVisible(false);
    this.stopTypingSound();
    this.promptTween?.stop();
    this.iconTween?.stop();
    this.iconPulseTween?.stop();
    this.promptTween = null;
    this.iconTween = null;
    this.iconPulseTween = null;
    this.prompt.setAlpha(1);
    this.scene.input.off('pointerdown', this.dismissPointer);
    this.scene.input.keyboard.off('keydown', this.dismissKey);
    this.scene.onStartBriefingDismissed?.();
  }

  isVisible() {
    return this.container.visible;
  }

  update(time) {
    if (!this.container.visible || this.typingComplete || time < this.nextTypeAt) {
      return;
    }
    this.visibleChars += 1;
    this.body.setText(this.fullText.slice(0, this.visibleChars));
    this.nextTypeAt = time + TYPE_INTERVAL_MS;
    this.drawIcon(time);
    if (this.visibleChars >= this.fullText.length) {
      this.completeTyping();
    }
  }

  completeTyping() {
    this.visibleChars = this.fullText.length;
    this.body.setText(this.fullText);
    this.typingComplete = true;
    this.stopTypingSound();
  }

  startTypingSound() {
    if (this.typingComplete) {
      return;
    }
    if (!this.typingSound) {
      this.typingSound = this.scene.sound.add(AUDIO_KEYS.typing, { loop: true, volume: TYPING_VOLUME });
    }
    this.typingSound.setMute(false);
    if (!this.typingSound.isPlaying) {
      this.typingSound.play();
    }
  }

  stopTypingSound() {
    if (!this.typingSound) {
      return;
    }
    this.typingSound.setMute(true);
    this.typingSound.stop();
  }

  drawIcon(time = this.scene.time.now) {
    const g = this.unitIcon;
    const pulse = this.iconState.pulse ?? 0;
    g.clear();
    const scale = this.iconScale ?? 1;
    g.lineStyle(2, 0x78f0ff, 0.16 + pulse * 0.16);
    g.strokeCircle(0, 0, (58 + pulse * 4) * scale);
    g.lineStyle(1, 0xc8fbff, 0.72);
    g.strokeCircle(0, 0, 46 * scale);
    g.lineStyle(1, 0xffd36a, 0.38);
    g.lineBetween(-82 * scale, 0, -55 * scale, 0);
    g.lineBetween(55 * scale, 0, 82 * scale, 0);
    g.lineBetween(0, -82 * scale, 0, -55 * scale);
    g.lineBetween(0, 55 * scale, 0, 82 * scale);

    this.unitSprite.setDisplaySize(142 * scale, 142 * scale);
    drawDroidSignalSlotEffect(this.unitActivity, time, {
      x: this.unitSprite.x,
      y: this.unitSprite.y - 2 * scale,
      width: 96 * scale,
      height: 36 * scale,
      pulse,
      showBackground: false,
      showOutline: false,
      orientation: 'vertical'
    });
  }

  drawFrameDetails() {
    const { width, height } = this.scene.scale;
    const margin = 28;
    const contentTop = 98;
    const contentBottom = height - 136;
    const contentHeight = Math.max(260, contentBottom - contentTop);
    const contentWidth = width - margin * 2;
    const left = margin;
    const right = width - margin;
    const top = contentTop;
    const bottom = contentTop + contentHeight;
    const textLeft = width * 0.38;
    const textTop = contentTop + 42;
    const textWidth = Math.min(650, width * 0.55);
    const textBottom = contentBottom - 42;

    const marks = this.cornerMarks;
    marks.clear();
    marks.lineStyle(1, 0x1a626c, 0.08);
    for (let x = 0; x <= width; x += 72) {
      marks.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y <= height; y += 54) {
      marks.lineBetween(0, y, width, y);
    }
    marks.lineStyle(1, 0x78f0ff, 0.08);
    for (let y = 16; y <= height; y += 5) {
      marks.lineBetween(0, y, width, y);
    }

    marks.lineStyle(2, 0xffd36a, 0.75);
    marks.lineBetween(left + 16, top + 16, left + 48, top + 16);
    marks.lineBetween(left + 16, top + 16, left + 16, top + 48);
    marks.lineBetween(right - 16, top + 16, right - 48, top + 16);
    marks.lineBetween(right - 16, top + 16, right - 16, top + 48);
    marks.lineStyle(2, 0x78f0ff, 0.55);
    marks.lineBetween(left + 16, bottom - 16, left + 48, bottom - 16);
    marks.lineBetween(left + 16, bottom - 16, left + 16, bottom - 48);
    marks.lineBetween(right - 16, bottom - 16, right - 48, bottom - 16);
    marks.lineBetween(right - 16, bottom - 16, right - 16, bottom - 48);
    marks.fillStyle(0xffd36a, 0.28);
    for (let i = 0; i < 8; i += 1) {
      marks.fillRect(textLeft + 20 + i * 12, bottom - 66, 7, 2);
    }

    const scan = this.scanlines;
    scan.clear();
    scan.lineStyle(1, 0x78f0ff, 0.055);
    for (let y = textTop + 10; y <= textBottom - 10; y += 10) {
      scan.lineBetween(textLeft + 12, y, Math.min(width - 58, textLeft + textWidth - 12), y);
    }
    scan.lineStyle(1, 0xffd36a, 0.18);
    scan.lineBetween(textLeft + 20, textTop + 16, textLeft + textWidth - 24, textTop + 16);
    scan.lineBetween(textLeft + 20, textBottom - 16, textLeft + textWidth - 24, textBottom - 16);
  }

  handleResize() {
    const { width, height } = this.scene.scale;
    const margin = 28;
    const headerWidth = Math.min(620, width - 60);
    const contentTop = 98;
    const contentBottom = height - 136;
    const contentHeight = Math.max(260, contentBottom - contentTop);
    const contentWidth = width - margin * 2;
    const textLeft = width * 0.38;
    const textTop = contentTop + 42;
    const textWidth = Math.min(650, width * 0.55);
    const textHeight = Math.max(180, contentHeight - 84);
    const iconX = width * 0.22;
    const iconY = contentTop + contentHeight * 0.5;

    this.backdrop.setSize(width, height);
    this.backdrop.setPosition(0, 0);
    this.panelGlow.setPosition(width / 2, contentTop + contentHeight / 2);
    this.panelGlow.setSize(contentWidth + 12, contentHeight + 12);
    this.panel.setPosition(width / 2, contentTop + contentHeight / 2);
    this.panel.setSize(contentWidth, contentHeight);
    this.innerPanel.setPosition(textLeft + textWidth / 2, textTop + textHeight / 2);
    this.innerPanel.setSize(textWidth, textHeight);
    this.header.setPosition(width / 2, 44);
    this.header.setSize(headerWidth, 32);
    this.headerLeft.setPosition(width / 2 - headerWidth / 2 + 18, 34);
    this.brand.setPosition(width / 2, 32);
    this.brandLogo.setPosition(width / 2, 45);
    this.headerDot.setPosition(width / 2 + headerWidth / 2 - 24, 34);
    this.unitIcon.setPosition(iconX, iconY);
    this.iconScale = Math.max(0.9, Math.min(1.45, width / 900));
    this.unitSprite.setPosition(iconX, iconY);
    this.unitId.setPosition(iconX, iconY + this.iconScale);
    this.title.setPosition(textLeft + textWidth / 2, textTop + 70);
    this.body.setPosition(textLeft + textWidth / 2, textTop + textHeight / 2 + 18);
    this.body.setWordWrapWidth(Math.max(320, textWidth - 72));
    this.prompt.setPosition(width / 2, height - 88);
    this.container.setPosition(0, 0);
    const textCenterX = textLeft + textWidth / 2;
    const topLogoY = textTop + 48;
    const titleY = textTop + 104;
    const bottomLogoY = textTop + textHeight - 42;
    this.title.setPosition(textCenterX, titleY);
    this.body.setPosition(textCenterX, textTop + textHeight / 2 + 14);
    this.body.setFontSize(Math.max(21, Math.min(28, textHeight * 0.052)));
    this.body.setLineSpacing(Math.max(10, Math.min(18, textHeight * 0.03)));
    this.fitLogo(this.topLogoGold, textCenterX, topLogoY, 74, 38, 0.92);
    this.fitLogo(this.bottomLogoGold, textCenterX, bottomLogoY, 62, 32, 0.86);
    this.drawIcon();
    this.drawFrameDetails();
  }

  fitLogo(logo, x, y, maxWidth, maxHeight, alpha = 1) {
    if (!logo || !this.scene.textures.exists(logo.texture.key)) {
      logo?.setAlpha(0);
      return;
    }
    const source = logo.texture.getSourceImage();
    const aspect = source?.width && source?.height ? source.width / source.height : 1;
    const width = Math.min(maxWidth, maxHeight * aspect);
    const height = width / aspect;
    logo.setPosition(x, y);
    logo.setDisplaySize(width, height);
    logo.setAlpha(alpha);
  }

  destroy() {
    this.scene.scale.off('resize', this.handleResize, this);
    this.stopTypingSound();
    this.typingSound?.destroy();
    this.typingSound = null;
    this.promptTween?.stop();
    this.iconTween?.stop();
    this.iconPulseTween?.stop();
    this.promptTween = null;
    this.iconTween = null;
    this.iconPulseTween = null;
    this.container.destroy(true);
  }
}
