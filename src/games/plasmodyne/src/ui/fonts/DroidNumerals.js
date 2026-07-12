import { TYPOGRAPHY } from '../theme/Typography.js';

const DIGIT_SEGMENTS = {
  0: ['a', 'b', 'c', 'd', 'e', 'f'],
  1: ['b', 'c'],
  2: ['a', 'b', 'g', 'e', 'd'],
  3: ['a', 'b', 'g', 'c', 'd'],
  4: ['f', 'g', 'b', 'c'],
  5: ['a', 'f', 'g', 'c', 'd'],
  6: ['a', 'f', 'g', 'e', 'c', 'd'],
  7: ['a', 'b', 'c'],
  8: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  9: ['a', 'b', 'c', 'd', 'f', 'g']
};

const SEGMENT_RECTS = {
  a: [0.18, 0.04, 0.64, 0.12],
  b: [0.75, 0.12, 0.13, 0.34],
  c: [0.75, 0.54, 0.13, 0.34],
  d: [0.18, 0.84, 0.64, 0.12],
  e: [0.12, 0.54, 0.13, 0.34],
  f: [0.12, 0.12, 0.13, 0.34],
  g: [0.2, 0.44, 0.6, 0.12]
};

export class DroidNumerals {
  constructor(scene, x, y, text, options = {}) {
    this.scene = scene;
    this.text = String(text).padStart(3, '0');
    this.size = options.size ?? 18;
    this.color = options.color ?? 0xb7bcc0;
    this.shadowColor = options.shadowColor ?? 0x4f565c;
    this.align = options.align ?? 'center';
    this.spacing = options.spacing ?? this.size * 0.16;
    this.renderer = options.renderer ?? 'font';
    this.fitWidth = options.fitWidth ?? null;
    this.fitHeight = options.fitHeight ?? null;
    this.yOffset = options.yOffset ?? 0;
    this.container = scene.add.container(x, y);
    this.container.setDepth(options.depth ?? 0);
    this.container.setScrollFactor(options.scrollFactor ?? 1);

    if (this.renderer === 'font') {
      this.shadowText = scene.add.text(1.5, 1.5, this.text, this.getTextStyle(this.shadowColor, 0.2)).setOrigin(0.5);
      this.fontText = scene.add.text(0, 0, this.text, this.getTextStyle(this.color, 1)).setOrigin(0.5);
      this.shadowText.setAlpha(0.2);
      this.container.add([this.shadowText, this.fontText]);
    } else {
      this.graphics = scene.add.graphics();
      this.container.add(this.graphics);
    }
    this.redraw();
  }

  getTextStyle(color, alpha = 1) {
    return {
      fontFamily: TYPOGRAPHY.droidNumerals.family,
      fontSize: `${this.size}px`,
      color: this.numberToCss(color),
      alpha,
      align: 'center'
    };
  }

  setText(text) {
    const next = String(text).padStart(3, '0');
    if (next === this.text) {
      return;
    }
    this.text = next;
    this.redraw();
  }

  setPosition(x, y) {
    this.container.setPosition(x, y);
  }

  setDepth(depth) {
    this.container.setDepth(depth);
  }

  setColor(color, shadowColor = this.shadowColor) {
    if (color === this.color && shadowColor === this.shadowColor) {
      return;
    }
    this.color = color;
    this.shadowColor = shadowColor;
    this.redraw();
  }

  setVisible(visible) {
    this.container.setVisible(visible);
  }

  setAlpha(alpha) {
    this.container.setAlpha(alpha);
  }

  destroy() {
    this.container.destroy(true);
  }

  redraw() {
    if (this.renderer === 'font') {
      this.shadowText.setText(this.text);
      this.fontText.setText(this.text);
      this.shadowText.setStyle(this.getTextStyle(this.shadowColor, 0.2));
      this.fontText.setStyle(this.getTextStyle(this.color, 1));
      this.shadowText.setAlpha(0.2);
      this.fontText.setAlpha(1);
      this.applyFontFit();
      return;
    }

    const digitWidth = this.size * 0.72;
    const totalWidth = this.text.length * digitWidth + (this.text.length - 1) * this.spacing;
    const startX = this.align === 'center' ? -totalWidth / 2 : 0;

    this.graphics.clear();
    this.graphics.fillStyle(this.shadowColor, 0.2);
    this.drawText(startX + 1.5, -this.size / 2 + 1.5, digitWidth);
    this.graphics.fillStyle(this.color, 1);
    this.drawText(startX, -this.size / 2, digitWidth);
  }

  applyFontFit() {
    if (!this.fitWidth && !this.fitHeight) {
      return;
    }
    this.fontText.setScale(1);
    this.shadowText.setScale(1);
    this.fontText.setPosition(0, this.yOffset);
    this.shadowText.setPosition(1.5, 1.5 + this.yOffset);
    const rawWidth = Math.max(1, this.fontText.width);
    const rawHeight = Math.max(1, this.fontText.height);
    const scaleX = this.fitWidth ? this.fitWidth / rawWidth : 1;
    const scaleY = this.fitHeight ? this.fitHeight / rawHeight : 1;
    this.fontText.setScale(scaleX, scaleY);
    this.shadowText.setScale(scaleX, scaleY);
  }

  drawText(startX, startY, digitWidth) {
    for (let i = 0; i < this.text.length; i += 1) {
      const digit = this.text[i];
      const x = startX + i * (digitWidth + this.spacing);
      this.drawDigit(x, startY, digitWidth, this.size, DIGIT_SEGMENTS[digit] ?? DIGIT_SEGMENTS[0]);
    }
  }

  drawDigit(x, y, width, height, segments) {
    for (const segment of segments) {
      const rect = SEGMENT_RECTS[segment];
      this.drawChamferedRect(
        x + rect[0] * width,
        y + rect[1] * height,
        rect[2] * width,
        rect[3] * height,
        Math.max(1.5, this.size * 0.055)
      );
    }
  }

  drawChamferedRect(x, y, width, height, cut) {
    this.graphics.fillPoints([
      { x: x + cut, y },
      { x: x + width - cut, y },
      { x: x + width, y: y + cut },
      { x: x + width - cut, y: y + height },
      { x: x + cut, y: y + height },
      { x, y: y + height - cut },
      { x, y: y + cut }
    ], true);
  }

  numberToCss(color) {
    return `#${color.toString(16).padStart(6, '0')}`;
  }
}
