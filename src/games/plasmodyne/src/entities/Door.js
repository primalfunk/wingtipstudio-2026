export class Door {
  constructor(scene, doorData, palette) {
    this.scene = scene;
    this.data = doorData;
    this.palette = palette;
    this.openAmount = doorData.open ? 1 : 0;
    this.holdUntil = 0;
    this.motionSoundState = this.openAmount > 0 ? 'open' : 'closed';

    this.container = scene.add.container(doorData.x + doorData.width / 2, doorData.y + doorData.height / 2);
    this.container.setDepth(6);
    const panel = this.getPanelSize();
    this.panelA = scene.add.rectangle(0, 0, panel.width, panel.height, this.getColor(), 0.82);
    this.panelB = scene.add.rectangle(0, 0, panel.width, panel.height, this.getColor(), 0.48);
    this.light = scene.add.rectangle(0, 0, doorData.width, doorData.height, this.getColor(), 0.08);
    this.container.add([this.light, this.panelA, this.panelB]);

    this.maskShape = scene.add.graphics();
    this.maskShape.fillStyle(0xffffff, 1);
    this.maskShape.fillRect(doorData.x, doorData.y, doorData.width, doorData.height);
    this.maskShape.setVisible(false);
    this.panelMask = this.maskShape.createGeometryMask();
    this.panelA.setMask(this.panelMask);
    this.panelB.setMask(this.panelMask);

    this.blocker = scene.add.rectangle(
      doorData.x + doorData.width / 2,
      doorData.y + doorData.height / 2,
      doorData.width,
      doorData.height,
      0x000000,
      0
    );
    scene.physics.add.existing(this.blocker, true);
    this.blocker.body.setSize(doorData.width, doorData.height);
    this.blocker.body.updateFromGameObject();
    this.blocker.setData('doorEntity', this);
    this.applyVisuals();
  }

  getColor() {
    return this.palette.accent;
  }

  getPanelSize() {
    if (this.data.orientation === 'vertical') {
      return {
        width: Math.max(5, this.data.width * 0.28),
        height: this.data.height
      };
    }
    return {
      width: this.data.width,
      height: Math.max(5, this.data.height * 0.28)
    };
  }

  update(time, player, droids = []) {
    this.data.locked = false;
    this.data.clearanceRequirement = 0;
    const shouldOpen = this.hasEntityNearby(player, droids);
    if (shouldOpen) {
      this.holdUntil = time + this.data.autoCloseDelay;
      this.beginOpening();
    } else if (time > this.holdUntil && this.openAmount > 0) {
      this.beginClosing();
    }

    const target = (this.data.animationState === 'opening' || time <= this.holdUntil) ? 1 : 0;
    const speed = 0.12;
    this.openAmount += Math.sign(target - this.openAmount) * Math.min(Math.abs(target - this.openAmount), speed);
    this.data.open = this.openAmount > 0.62;
    this.data.isOpen = this.data.open;
    this.data.animationState = this.data.open ? 'open' : this.openAmount > 0 ? this.data.animationState : 'closed';
    if (this.openAmount >= 0.98) {
      this.motionSoundState = 'open';
    } else if (this.openAmount <= 0.02) {
      this.motionSoundState = 'closed';
    }
    this.applyVisuals();
  }

  forceOpen(time, duration = 1200) {
    this.holdUntil = Math.max(this.holdUntil, time + duration);
    this.beginOpening();
  }

  beginOpening() {
    if (this.motionSoundState !== 'opening' && this.openAmount < 0.95) {
      this.scene.audio?.playDoorOpen();
      this.motionSoundState = 'opening';
    }
    this.data.animationState = 'opening';
  }

  beginClosing() {
    if (this.motionSoundState !== 'closing' && this.openAmount > 0.05) {
      this.scene.audio?.playDoorClose();
      this.motionSoundState = 'closing';
    }
    this.data.animationState = 'closing';
  }

  hasEntityNearby(player, droids) {
    if (this.entityNearSprite(player.sprite, 78)) {
      return true;
    }
    return droids.some((droid) => !droid.data.neutralized && this.entityNearSprite(droid.sprite, 56));
  }

  entityNearSprite(sprite, range) {
    const cx = this.data.x + this.data.width / 2;
    const cy = this.data.y + this.data.height / 2;
    return Math.abs(sprite.x - cx) <= range && Math.abs(sprite.y - cy) <= range;
  }

  applyVisuals() {
    const color = this.getColor();
    this.panelA.setFillStyle(color, 0.88);
    this.panelB.setFillStyle(0xffffff, 0.42);
    this.light.setFillStyle(color, Math.max(0, 0.08 * (1 - this.openAmount)));
    this.light.setSize(this.data.width, this.data.height);
    const panel = this.getPanelSize();

    const slide = this.openAmount * (this.data.orientation === 'vertical'
      ? this.data.height + 12
      : this.data.width + 12);
    if (this.data.orientation === 'vertical') {
      this.panelA.setSize(panel.width, panel.height);
      this.panelB.setSize(Math.max(2, panel.width * 0.55), panel.height);
      this.panelA.setPosition(0, -slide);
      this.panelB.setPosition(0, -slide + 4);
      this.panelB.setVisible(this.openAmount < 0.98);
    } else {
      this.panelA.setSize(panel.width, panel.height);
      this.panelB.setSize(panel.width, Math.max(2, panel.height * 0.55));
      this.panelA.setPosition(-slide, 0);
      this.panelB.setPosition(-slide + 4, 0);
      this.panelB.setVisible(this.openAmount < 0.98);
    }

    if (this.blocker.body) {
      this.blocker.body.enable = !this.data.open;
    }
  }

  destroy() {
    this.container.destroy(true);
    this.maskShape.destroy();
    this.blocker.destroy();
  }
}
