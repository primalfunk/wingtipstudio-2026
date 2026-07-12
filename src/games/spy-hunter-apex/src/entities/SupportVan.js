import Vehicle from './Vehicle.js';
import { SUPPORT } from '../data/tuning.js';
import { pickNpcTint } from '../data/npcTints.js';

const TRUCK_DISPLAY_WIDTH = 44;
const TRUCK_DISPLAY_HEIGHT = 154;
const RAMP_TEXTURE_KEY = 'support-truck-ramp';
const RAMP_TEXTURE_WIDTH = 28;
const RAMP_TEXTURE_HEIGHT = 44;
const RAMP_DISPLAY_WIDTH = 28;
const RAMP_DISPLAY_HEIGHT = 44;
const RAMP_REAR_OVERLAP = 8;

function ensureRampTexture(scene) {
  if (scene.textures.exists(RAMP_TEXTURE_KEY)) {
    return;
  }

  const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
  graphics.fillStyle(0x1b2020, 1);
  graphics.fillRoundedRect(0, 0, RAMP_TEXTURE_WIDTH, RAMP_TEXTURE_HEIGHT, 3);
  graphics.lineStyle(2, 0x566063, 1);
  graphics.strokeRoundedRect(1, 1, RAMP_TEXTURE_WIDTH - 2, RAMP_TEXTURE_HEIGHT - 2, 3);
  graphics.lineStyle(2, 0x2f3638, 1);
  graphics.lineBetween(6, 12, RAMP_TEXTURE_WIDTH / 2, 20);
  graphics.lineBetween(RAMP_TEXTURE_WIDTH - 6, 12, RAMP_TEXTURE_WIDTH / 2, 20);
  graphics.lineBetween(6, 25, RAMP_TEXTURE_WIDTH / 2, 33);
  graphics.lineBetween(RAMP_TEXTURE_WIDTH - 6, 25, RAMP_TEXTURE_WIDTH / 2, 33);
  graphics.lineStyle(1, 0x95d9ff, 0.7);
  graphics.lineBetween(4, 41, 9, 41);
  graphics.lineBetween(RAMP_TEXTURE_WIDTH - 9, 41, RAMP_TEXTURE_WIDTH - 4, 41);
  graphics.generateTexture(RAMP_TEXTURE_KEY, RAMP_TEXTURE_WIDTH, RAMP_TEXTURE_HEIGHT);
  graphics.destroy();
}

export default class SupportVan extends Vehicle {
  constructor(scene, x, y, config = {}) {
    const isDecoy = Boolean(config.isDecoy);
    const serviceType = ['ammo', 'upgrade'].includes(config.serviceType) ? config.serviceType : 'repair';
    const label = isDecoy ? 'SUPP0RT' : serviceType === 'ammo' ? 'AMMO' : serviceType === 'upgrade' ? 'UPGRADE' : 'REPAIR';
    super(scene, x, y, 'upgrade-truck-closed', {
      ...config,
      type: isDecoy ? 'decoyVan' : 'supportVan',
      faction: isDecoy ? 'hostile' : 'support',
      role: isDecoy ? 'bait' : serviceType,
      isSupport: true,
      hiddenRole: isDecoy ? 'tracker' : null,
      tint: config.tint ?? pickNpcTint(isDecoy ? 'decoy' : 'support', config.tintIndex ?? 0),
      speed: SUPPORT.speed,
      damageOnCollision: 0,
      displayWidth: 44,
      displayHeight: 154,
      bodyWidth: 28,
      bodyHeight: 132,
      depth: 13,
      immovable: true,
    });

    this.isDecoy = isDecoy;
    this.serviceType = serviceType;
    this.isCollected = false;
    this.isDocking = false;
    this.isReceding = false;
    this.isDestroyed = false;
    ensureRampTexture(scene);
    this.rampSprite = scene.add.image(x, y, RAMP_TEXTURE_KEY)
      .setOrigin(0.5, 0)
      .setDisplaySize(RAMP_DISPLAY_WIDTH, RAMP_DISPLAY_HEIGHT)
      .setDepth(12.9)
      .setVisible(false);

    this.sprite.setTint(isDecoy ? 0xaeb8ff : serviceType === 'ammo' ? 0xd6dde7 : serviceType === 'upgrade' ? 0x9ee7ff : 0xffc061);

    this.label = scene.add.text(x, y - 86, label, {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '10px',
      color: isDecoy ? '#e6e8ff' : serviceType === 'ammo' ? '#eef4ff' : serviceType === 'upgrade' ? '#dff9ff' : '#fff0c2',
      backgroundColor: isDecoy ? '#243057' : serviceType === 'ammo' ? '#27303a' : serviceType === 'upgrade' ? '#16445a' : '#5a3612',
      padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(14);
  }

  update(laneCenters = [], hazards = []) {
    if (this.isReceding) {
      this.applyAvoidance(laneCenters, hazards, -SUPPORT.speed * 1.65);
      return;
    }

    if (this.scene.time.now < this.bounceUntil) {
      this.label.setPosition(this.sprite.x, this.sprite.y - 86);
      return;
    }

    if (!this.isCollected) {
      super.update();
      this.applyAvoidance(laneCenters, hazards, SUPPORT.speed);
    }
    this.label.setPosition(this.sprite.x, this.sprite.y - 86);
    this.syncRampSprite();
  }

  applyAvoidance(laneCenters, hazards, yVelocity) {
    const blocking = hazards.find((hazard) => {
      if (!hazard.sprite?.active) {
        return false;
      }
      const dy = hazard.sprite.y - this.sprite.y;
      return Math.abs(dy) < 170 && Math.abs(hazard.sprite.x - this.sprite.x) < 34;
    });

    if (!blocking || laneCenters.length === 0) {
      this.sprite.body.setVelocity(0, yVelocity);
      return;
    }

    const currentLane = this.findNearestLane(this.sprite.x, laneCenters);
    const candidates = [currentLane - 1, currentLane + 1]
      .filter((lane) => lane >= 0 && lane < laneCenters.length)
      .sort((a, b) => Math.abs(laneCenters[a] - this.sprite.x) - Math.abs(laneCenters[b] - this.sprite.x));
    const openLane = candidates.find((lane) => {
      return !hazards.some((hazard) => {
        return hazard.sprite?.active
          && Math.abs(hazard.sprite.y - this.sprite.y) < 190
          && Math.abs(hazard.sprite.x - laneCenters[lane]) < 34;
      });
    });

    const targetX = laneCenters[openLane ?? currentLane];
    const xVelocity = Math.abs(targetX - this.sprite.x) < 8
      ? 0
      : Math.sign(targetX - this.sprite.x) * SUPPORT.avoidanceSpeed;
    this.sprite.body.setVelocity(xVelocity, yVelocity);
  }

  findNearestLane(x, laneCenters) {
    let bestLane = 0;
    let bestDistance = Infinity;
    for (let lane = 0; lane < laneCenters.length; lane += 1) {
      const distance = Math.abs(laneCenters[lane] - x);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestLane = lane;
      }
    }
    return bestLane;
  }

  openDoors() {
    if (!this.canMutateSprite()) {
      return false;
    }
    this.isCollected = true;
    this.isDocking = true;
    if (!this.setDoorsOpen()) {
      return false;
    }
    this.sprite.body?.setImmovable(true);
    this.sprite.body?.setVelocity(0, 0);
    return true;
  }

  setDoorsOpen() {
    if (!this.canMutateSprite()) {
      return false;
    }
    this.sprite.setTexture('upgrade-truck-closed');
    this.clearSpriteCrop();
    this.sprite.setDisplaySize(TRUCK_DISPLAY_WIDTH, TRUCK_DISPLAY_HEIGHT);
    this.sprite.body?.setSize(28, 132, true);
    this.syncRampSprite();
    this.rampSprite
      ?.setVisible(true)
      .setScale(1, 0.08);
    this.scene.tweens.add({
      targets: this.rampSprite,
      scaleY: 1,
      duration: 180,
      ease: 'Sine.easeOut',
    });
    this.label?.setText(this.isDecoy ? 'SUPP0RT' : 'OPEN');
    return true;
  }

  setDoorsClosed() {
    if (!this.canMutateSprite()) {
      return false;
    }
    this.sprite.setTexture('upgrade-truck-closed');
    this.clearSpriteCrop();
    this.sprite.setDisplaySize(TRUCK_DISPLAY_WIDTH, TRUCK_DISPLAY_HEIGHT);
    this.sprite.body?.setSize(28, 132, true);
    this.rampSprite?.setVisible(false);
    this.label?.setText(this.isDecoy ? 'SUPP0RT' : this.serviceType === 'ammo' ? 'AMMO' : this.serviceType === 'upgrade' ? 'UPGRADE' : 'REPAIR');
    return true;
  }

  recede() {
    if (!this.canMutateSprite()) {
      return;
    }
    this.isDocking = false;
    this.isReceding = true;
    this.setDoorsClosed();
    this.sprite.body.enable = true;
    this.sprite.body.setVelocity(0, -SUPPORT.speed * 1.65);
    this.sprite.setDepth(13);
    this.rampSprite?.setDepth(12.9);
    this.label.setVisible(false);
  }

  setRampDepth(depth) {
    this.rampSprite?.setDepth(depth);
  }

  syncRampSprite() {
    if (!this.rampSprite || !this.sprite?.active) {
      return;
    }
    this.rampSprite
      .setPosition(this.sprite.x, this.sprite.y + this.sprite.displayHeight / 2 - RAMP_REAR_OVERLAP)
      .setAngle(this.sprite.angle)
      .setAlpha(this.sprite.alpha);
  }

  clearSpriteCrop() {
    if (typeof this.sprite.resetCrop === 'function') {
      this.sprite.resetCrop();
    } else {
      this.sprite.setCrop();
    }
  }

  canMutateSprite() {
    return !this.isDestroyed
      && this.sprite
      && this.sprite.active
      && this.sprite.scene
      && this.sprite.scene.sys;
  }

  destroy() {
    this.isDestroyed = true;
    this.label?.destroy();
    this.rampSprite?.destroy();
    super.destroy();
  }
}
