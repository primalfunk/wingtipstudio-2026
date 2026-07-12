import Phaser from 'phaser';
import { getDroidVisualKeys } from '../graphics/droidAnimationAssets.js';
import { DroidVisual } from './DroidVisual.js';
import { TYPOGRAPHY } from '../ui/theme/Typography.js';
import { getWeapon } from '../data/weaponTypes.js';

export class PlayerController {
  constructor(scene, x, y, bodyData, config) {
    this.scene = scene;
    this.bodyData = { ...bodyData };
    this.config = config;
    this.facingAngle = 0;
    this.aiControlEnabled = false;
    this.aiMove = new Phaser.Math.Vector2(0, 0);

    const visualKeys = getDroidVisualKeys(bodyData.rank);
    this.sprite = scene.physics.add.sprite(x, y, visualKeys.textureKey, 0);
    this.sprite.play(visualKeys.animationKey);
    this.sprite.setDisplaySize(config.radius * 2, config.radius * 2);
    this.applyCollisionCircle();
    this.sprite.setCollideWorldBounds(false);
    this.sprite.setDamping(false);
    this.sprite.setBounce(0);
    this.sprite.setMaxVelocity(bodyData.speed);
    this.sprite.body.setAllowGravity(false);
    this.sprite.setDepth(9);
    this.visual = new DroidVisual(scene, this.sprite, {
      displayId: bodyData.displayId,
      radius: config.radius,
      fontSize: 19,
      strokeThickness: 3,
      textDepth: 15,
      capDepth: 13,
      ringDepth: 12,
      ringAlpha: 0.44,
      ringTint: 0xd2f8ff,
      numberColor: TYPOGRAPHY.droidNumerals.playerColor,
      numberShadowColor: TYPOGRAPHY.droidNumerals.playerShadow
    });
    this.visual.setWeaponDefinition(getWeapon(bodyData.weaponType));

    this.keys = scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      arrowUp: Phaser.Input.Keyboard.KeyCodes.UP,
      arrowDown: Phaser.Input.Keyboard.KeyCodes.DOWN,
      arrowLeft: Phaser.Input.Keyboard.KeyCodes.LEFT,
      arrowRight: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT,
      esc: Phaser.Input.Keyboard.KeyCodes.ESC
    });
  }

  update(delta) {
    const body = this.sprite.body;
    const keyboardMove = new Phaser.Math.Vector2(
      Number(this.keys.right.isDown || this.keys.arrowRight.isDown) - Number(this.keys.left.isDown || this.keys.arrowLeft.isDown),
      Number(this.keys.down.isDown || this.keys.arrowDown.isDown) - Number(this.keys.up.isDown || this.keys.arrowUp.isDown)
    );
    const move = this.aiControlEnabled ? this.aiMove.clone() : keyboardMove.clone();
    const pointer = this.scene.input.activePointer;

    if (!this.aiControlEnabled && pointer.rightButtonDown()) {
      const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const thrust = new Phaser.Math.Vector2(worldPoint.x - this.sprite.x, worldPoint.y - this.sprite.y);
      if (thrust.lengthSq() > 1) {
        move.add(thrust.normalize());
      }
    }

    const precision = this.keys.shift.isDown ? this.bodyData.precisionMultiplier : 1;
    const maxSpeed = this.bodyData.speed * precision;
    const acceleration = this.bodyData.acceleration * precision;
    body.setMaxVelocity(maxSpeed);

    if (move.lengthSq() > 0) {
      move.normalize().scale(acceleration);
      body.setAcceleration(move.x, move.y);
      this.applyActiveInputLateralDrag(move, delta);
    } else {
      body.setAcceleration(0, 0);
      const speed = body.velocity.length();
      const decel = this.bodyData.drag * (delta / 1000);
      if (speed <= decel) {
        body.setVelocity(0, 0);
      } else {
        const nextVelocity = body.velocity.clone().normalize().scale(speed - decel);
        body.setVelocity(nextVelocity.x, nextVelocity.y);
      }
    }

    if (!this.aiControlEnabled) {
      const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.facingAngle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, worldPoint.x, worldPoint.y);
    } else if (move.lengthSq() > 0) {
      this.facingAngle = Phaser.Math.Angle.Between(0, 0, move.x, move.y);
    }
    this.visual.update(this.sprite.x, this.sprite.y, this.bodyData.displayId, 0, this.facingAngle);
  }

  applyActiveInputLateralDrag(accelerationVector, delta) {
    const body = this.sprite.body;
    if (!body?.velocity || accelerationVector.lengthSq() <= 0) {
      return;
    }
    const desired = accelerationVector.clone().normalize();
    const velocity = body.velocity.clone();
    const along = desired.clone().scale(velocity.dot(desired));
    const lateral = velocity.subtract(along);
    const lateralSpeed = lateral.length();
    if (lateralSpeed <= 0.01) {
      return;
    }
    const lateralDecel = this.bodyData.drag * (delta / 1000);
    if (lateralSpeed <= lateralDecel) {
      body.setVelocity(along.x, along.y);
      return;
    }
    const reducedLateral = lateral.normalize().scale(lateralSpeed - lateralDecel);
    body.setVelocity(along.x + reducedLateral.x, along.y + reducedLateral.y);
  }

  hasMovementInput() {
    const pointer = this.scene.input.activePointer;
    return this.aiMove.lengthSq() > 0 ||
      this.keys.right.isDown ||
      this.keys.arrowRight.isDown ||
      this.keys.left.isDown ||
      this.keys.arrowLeft.isDown ||
      this.keys.down.isDown ||
      this.keys.arrowDown.isDown ||
      this.keys.up.isDown ||
      this.keys.arrowUp.isDown ||
      pointer.rightButtonDown();
  }

  applyBodyData(bodyData) {
    this.bodyData = { ...bodyData };
    this.visual.setVisible(true);
    const visualKeys = getDroidVisualKeys(bodyData.rank);
    this.sprite.setTexture(visualKeys.textureKey, 0);
    this.sprite.play(visualKeys.animationKey);
    this.sprite.setDisplaySize(this.config.radius * 2, this.config.radius * 2);
    this.applyCollisionCircle();
    this.sprite.setBounce(0);
    this.sprite.body.setMaxVelocity(this.bodyData.speed);
    this.visual.setDroidNumberColor(TYPOGRAPHY.droidNumerals.playerColor, TYPOGRAPHY.droidNumerals.playerShadow);
    this.visual.setWeaponDefinition(getWeapon(bodyData.weaponType));
    this.visual.update(this.sprite.x, this.sprite.y, this.bodyData.displayId, 0, this.facingAngle);
  }

  applyCollisionCircle() {
    const collisionRadius = this.config.collisionRadius ?? this.config.radius;
    const frameWidth = this.sprite.frame?.realWidth ?? this.sprite.width;
    const frameHeight = this.sprite.frame?.realHeight ?? this.sprite.height;
    const scaleX = this.sprite.displayWidth / Math.max(1, frameWidth);
    const scaleY = this.sprite.displayHeight / Math.max(1, frameHeight);
    const scale = Math.max(0.0001, Math.min(scaleX, scaleY));
    const sourceRadius = collisionRadius / scale;
    const offsetX = Math.max(0, frameWidth / 2 - sourceRadius);
    const offsetY = Math.max(0, frameHeight / 2 - sourceRadius);
    this.sprite.setCircle(sourceRadius, offsetX, offsetY);
    this.sprite.body?.setBounce(0, 0);
  }

  setAiControlEnabled(enabled) {
    this.aiControlEnabled = enabled;
    if (!enabled) {
      this.clearAiControl();
    }
  }

  setAiControl(move) {
    this.aiControlEnabled = true;
    this.aiMove.set(move?.x ?? 0, move?.y ?? 0);
  }

  clearAiControl() {
    this.aiMove.set(0, 0);
    this.aiControlEnabled = false;
    this.sprite.body?.setAcceleration(0, 0);
  }
}
