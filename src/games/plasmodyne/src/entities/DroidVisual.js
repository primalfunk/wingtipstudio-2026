import Phaser from 'phaser';
import { DroidNumerals } from '../ui/fonts/DroidNumerals.js';
import { TYPOGRAPHY } from '../ui/theme/Typography.js';
import { drawWeaponBarrels, getWeaponEmitterGeometry } from '../rendering/weapons/WeaponEmitterRenderer.js';
import { drawDroidSignalSlotEffect } from '../ui/effects/DroidSignalSlotEffect.js';

export class DroidVisual {
  constructor(scene, sprite, {
    displayId,
    radius,
    fontSize,
    strokeThickness,
    textDepth,
    capDepth,
    numberColor = TYPOGRAPHY.droidNumerals.defaultColor,
    numberShadowColor = TYPOGRAPHY.droidNumerals.defaultShadow
  }) {
    this.scene = scene;
    this.sprite = sprite;
    this.displayId = displayId;
    this.radius = radius;
    this.weapon = null;
    this.weaponAngle = 0;

    this.shadow = scene.add.circle(sprite.x, sprite.y + radius * 0.18, radius * 0.74, 0x000000, 0.18);
    this.shadow.setScale(1, 0.58);
    this.shadow.setDepth(sprite.depth - 1.5);

    this.topHighlight = scene.add.sprite(sprite.x, sprite.y, sprite.texture.key, sprite.frame.name);
    this.bottomHighlight = scene.add.sprite(sprite.x, sprite.y, sprite.texture.key, sprite.frame.name);
    for (const highlight of [this.topHighlight, this.bottomHighlight]) {
      highlight.setOrigin(sprite.originX, sprite.originY);
      highlight.setDisplaySize(sprite.displayWidth, sprite.displayHeight);
      highlight.setBlendMode(Phaser.BlendModes.ADD);
      highlight.setDepth(sprite.depth + 0.05);
    }
    this.topHighlight.setAlpha(0.1);
    this.bottomHighlight.setAlpha(0.4);
    this.applyShellCrops();
    this.syncHighlightAnimation();

    this.signalActivity = scene.add.graphics();
    this.signalActivity.setDepth(sprite.depth + 0.12);

    this.idText = new DroidNumerals(scene, sprite.x, sprite.y - 0.5, displayId, {
      size: fontSize,
      color: numberColor,
      shadowColor: numberShadowColor,
      depth: textDepth,
      fitWidth: radius * 1.71,
      fitHeight: radius * 0.74,
      yOffset: radius * -0.015
    });

    this.weaponGraphics = scene.add.graphics();
    this.weaponGraphics.setDepth(sprite.depth + 0.2);
  }

  update(x, y, displayId = this.displayId, ringRotationDelta = 0, weaponAngle = this.weaponAngle) {
    this.displayId = displayId;
    this.weaponAngle = weaponAngle;
    const pulse = 0.5 + Math.sin(this.scene.time.now * 0.0032 + this.radius) * 0.5;
    this.idText.setAlpha(0.82 + pulse * 0.18);
    this.shadow.setPosition(x, y + this.radius * 0.16);
    for (const highlight of [this.topHighlight, this.bottomHighlight]) {
      highlight.setPosition(x, y);
      highlight.setDisplaySize(this.sprite.displayWidth, this.sprite.displayHeight);
    }
    this.syncHighlightAnimation();
    this.idText.setText(displayId);
    this.idText.setPosition(x, y - 0.5);
    this.drawSignalActivity(x, y, pulse);
    this.drawWeaponEmitter(x, y);
  }

  drawSignalActivity(x, y, pulse) {
    drawDroidSignalSlotEffect(this.signalActivity, this.scene.time.now, {
      x,
      y: y - this.radius * 0.04,
      width: this.radius * 1.48,
      height: this.radius * 0.62,
      pulse,
      alpha: 0.78,
      showBackground: false,
      showOutline: false,
      orientation: 'vertical'
    });
  }

  setWeaponDefinition(weapon) {
    this.weapon = weapon?.type === 'none' ? null : weapon;
    if (!this.weapon) {
      this.weaponGraphics?.clear();
    }
  }

  drawWeaponEmitter(x, y) {
    const g = this.weaponGraphics;
    g.clear();
    const weapon = this.weapon;
    if (!weapon || weapon.emitterCount <= 0) {
      return;
    }

    drawWeaponBarrels(g, getWeaponEmitterGeometry({ x, y, radius: this.radius, angle: this.weaponAngle, weapon }), weapon);
  }

  applyShellCrops() {
    const frameWidth = this.sprite.frame.width;
    const frameHeight = this.sprite.frame.height;
    this.topHighlight.setCrop(0, 0, frameWidth, Math.round(frameHeight * 0.34));
    this.bottomHighlight.setCrop(0, Math.round(frameHeight * 0.66), frameWidth, Math.round(frameHeight * 0.34));
  }

  syncHighlightAnimation() {
    const animationKey = this.sprite.anims.currentAnim?.key;
    for (const highlight of [this.topHighlight, this.bottomHighlight]) {
      if (highlight.texture.key !== this.sprite.texture.key) {
        highlight.setTexture(this.sprite.texture.key, this.sprite.frame.name);
        this.applyShellCrops();
      }
      if (animationKey && highlight.anims.currentAnim?.key !== animationKey) {
        highlight.play(animationKey);
      }
      if (highlight.anims.currentFrame?.index !== this.sprite.anims.currentFrame?.index) {
        highlight.anims.setCurrentFrame(this.sprite.anims.currentFrame);
      }
    }
  }

  setRingAlpha(alpha) {
  }

  setRingTint(color) {
  }

  setDroidNumberColor(color, shadowColor = TYPOGRAPHY.droidNumerals.defaultShadow) {
    this.idText.setColor(color, shadowColor);
  }

  setVisible(value) {
    this.shadow.setVisible(value);
    this.topHighlight.setVisible(value);
    this.bottomHighlight.setVisible(value);
    this.signalActivity?.setVisible(value);
    this.idText.container?.setVisible(value);
    this.weaponGraphics?.setVisible(value);
  }

  setAggroState(isAggro, baseColor, aggroColor, flashColor, shadowColor = TYPOGRAPHY.droidNumerals.defaultShadow) {
    if (!isAggro) {
      this.setDroidNumberColor(baseColor, shadowColor);
      return;
    }
    const flashOn = Math.floor(this.scene.time.now / 130) % 2 === 0;
    this.setDroidNumberColor(flashOn ? aggroColor : flashColor, shadowColor);
  }

  destroy() {
    for (const object of [this.shadow, this.topHighlight, this.bottomHighlight, this.signalActivity, this.weaponGraphics, this.idText]) {
      if (object?.active || object instanceof DroidNumerals) {
        object.destroy();
      }
    }
  }
}
