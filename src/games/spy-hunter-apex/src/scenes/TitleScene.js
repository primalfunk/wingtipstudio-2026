import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../data/tuning.js';
import { DIFFICULTY_PRESETS } from '../systems/DifficultySystem.js';
import AudioSystem from '../systems/AudioSystem.js';
import StorageSystem from '../systems/StorageSystem.js';
import LayoutSystem from '../systems/LayoutSystem.js';

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    window.requestAnimationFrame(() => window.parent?.postMessage({ type: 'wingtip:game-ready' }, window.location.origin));
    LayoutSystem.restartOnResize(this);
    this.layout = LayoutSystem.screen(this);
    this.records = StorageSystem.loadRecords();
    this.settings = StorageSystem.loadSettings();
    this.menuObjects = [];
    this.titleFx = {
      roadMarkers: [],
      roadsideObjects: [],
      enemySprites: [],
      elapsed: 0,
      nextEnemyAt: 0,
    };
    this.audioSystem = new AudioSystem(this);
    this.audioSystem.playMainMenuMusic();

    this.scene.launch('GameScene', {
      aiControlled: true,
      attract: true,
    });
    this.scene.bringToTop();

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05080a, 0.34)
      .setDepth(50);
    this.createArcadeEnergyLayer();

    this.titleText = this.add.text(GAME_WIDTH / 2, this.layout.titleY, 'Spy Hunter: Apex', {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '34px',
      color: '#d6f7ef',
    }).setOrigin(0.5).setDepth(60);
    this.titleGlow = this.add.rectangle(GAME_WIDTH / 2, this.layout.titleY + 5, Math.min(330, GAME_WIDTH * 0.64), 42, 0x8fb9bd, 0.06)
      .setStrokeStyle(1, 0x8fb9bd, 0.26)
      .setDepth(59);

    this.add.text(GAME_WIDTH / 2, this.layout.titleY + 54, 'NORTHBOUND ROUTE AUTHORIZED', {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '14px',
      color: '#7f9695',
    }).setOrigin(0.5).setDepth(60);

    this.add.text(
      GAME_WIDTH / 2,
      this.layout.titleY + 126,
      `BEST SCORE ${this.records.bestScore}\nBEST DISTANCE ${Math.floor(this.records.bestDistance)} MI\nRUNS ${this.records.totalRuns}`,
      {
        fontFamily: 'Consolas, Courier, monospace',
        fontSize: '14px',
        color: '#b5c5c3',
        align: 'center',
        lineSpacing: 7,
      },
    ).setOrigin(0.5).setDepth(60);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 28, 'ARROWS / WASD OR DRAG TO STEER   SPACE TO FIRE', {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '13px',
      color: '#96a8a7',
    }).setOrigin(0.5).setDepth(60);

    this.showMainMenu();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.stop('GameScene');
    });
  }

  update(time, delta) {
    const dt = delta / 1000;
    this.titleFx.elapsed += dt;
    this.updateRoadMotion(delta);
    this.updateTitleFlicker(time);
    this.updateEnemyPressure(time, delta);
  }

  createArcadeEnergyLayer() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x061014, 0.18)
      .setDepth(51);

    for (let index = 0; index < 10; index += 1) {
      const marker = this.add.rectangle(GAME_WIDTH / 2, index * 82 - 40, 3, 36, 0xd6ded6, 0.18)
        .setDepth(52);
      this.titleFx.roadMarkers.push(marker);
    }

    for (let index = 0; index < 12; index += 1) {
      const left = index % 2 === 0;
      const edgeInset = Math.max(54, GAME_WIDTH * 0.12);
      const object = this.add.rectangle(left ? edgeInset : GAME_WIDTH - edgeInset, index * 70, left ? 4 : 5, 24, 0x9fb1a7, 0.22)
        .setDepth(52);
      object.side = left ? -1 : 1;
      this.titleFx.roadsideObjects.push(object);
    }

    this.scanline = this.add.rectangle(GAME_WIDTH / 2, -8, GAME_WIDTH, 2, 0x9ee7f5, 0.12)
      .setDepth(63);
    this.tweens.add({
      targets: this.scanline,
      y: GAME_HEIGHT + 8,
      duration: 3300,
      repeat: -1,
      ease: 'Linear',
    });

    this.radarSweep = this.add.rectangle(74, 92, 52, 1, 0x4eb6d6, 0.28)
      .setOrigin(0, 0.5)
      .setDepth(56);
    this.add.circle(74, 92, 34, 0x000000, 0)
      .setStrokeStyle(1, 0x4eb6d6, 0.24)
      .setDepth(55);
    this.tweens.add({
      targets: this.radarSweep,
      angle: 360,
      duration: 2400,
      repeat: -1,
      ease: 'Linear',
    });

    this.add.text(22, 132, 'GRID LIVE\nROUTE LOCK\nPURSUIT WAKE', {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '9px',
      color: '#71979a',
      lineSpacing: 4,
    }).setDepth(56);
  }

  updateRoadMotion(delta) {
    const speed = delta * 0.16;
    for (const marker of this.titleFx.roadMarkers) {
      marker.y += speed;
      marker.alpha = 0.14 + Math.sin((marker.y + this.titleFx.elapsed * 120) * 0.035) * 0.04;
      if (marker.y > GAME_HEIGHT + 42) {
        marker.y = -42;
      }
    }

    for (const object of this.titleFx.roadsideObjects) {
      object.y += speed * 1.35;
      object.x += Math.sin((object.y * 0.03) + this.titleFx.elapsed) * 0.06 * object.side;
      if (object.y > GAME_HEIGHT + 36) {
        object.y = -36;
      }
    }
  }

  updateTitleFlicker(time) {
    if (!this.titleText || !this.titleGlow) {
      return;
    }
    const pulse = 0.82 + Math.sin(time * 0.006) * 0.08;
    this.titleText.setAlpha(pulse);
    this.titleGlow.setAlpha(0.045 + Math.sin(time * 0.004) * 0.02);
  }

  updateEnemyPressure(time, delta) {
    if (time > this.titleFx.nextEnemyAt && this.titleFx.enemySprites.length < 3) {
      this.spawnTitleEnemy(time);
    }

    for (let index = this.titleFx.enemySprites.length - 1; index >= 0; index -= 1) {
      const enemy = this.titleFx.enemySprites[index];
      enemy.y += enemy.speed * (delta / 1000);
      enemy.x += Math.sin((enemy.y + enemy.seed) * 0.032) * 0.28;
      enemy.setAlpha(Phaser.Math.Clamp(enemy.alpha + 0.01, 0.18, 0.34));
      if (enemy.y > GAME_HEIGHT + 70) {
        enemy.destroy();
        this.titleFx.enemySprites.splice(index, 1);
      }
    }
  }

  spawnTitleEnemy(time) {
    const laneWidth = (GAME_WIDTH * 0.46) / 4;
    const roadLeft = GAME_WIDTH / 2 - laneWidth * 2;
    const laneXs = Array.from({ length: 4 }, (_, index) => roadLeft + laneWidth * (index + 0.5));
    const texture = Phaser.Utils.Array.GetRandom(['enemy-pursuit-interceptor', 'enemy-rammer', 'enemy-turret-gunner']);
    const enemy = this.add.sprite(Phaser.Utils.Array.GetRandom(laneXs), -54, texture)
      .setDisplaySize(25, 50)
      .setDepth(54)
      .setAlpha(0.18)
      .setTint(0x9fb4b8);
    enemy.speed = Phaser.Math.Between(92, 145);
    enemy.seed = Phaser.Math.Between(0, 1000);
    this.titleFx.enemySprites.push(enemy);
    this.titleFx.nextEnemyAt = time + Phaser.Math.Between(1500, 2800);
  }

  showMainMenu() {
    this.clearMenu();
    this.layout = LayoutSystem.screen(this);
    const startY = this.layout.menuStartY;
    const gap = GAME_HEIGHT < 700 ? 42 : 48;
    this.createButton(GAME_WIDTH / 2, startY, 'START GAME', () => this.startGame());
    this.createButton(GAME_WIDTH / 2, startY + gap, 'AUTOPILOT', () => this.startAutopilot());
    this.createButton(GAME_WIDTH / 2, startY + gap * 2, 'OPTIONS', () => this.showOptions());
    this.createButton(GAME_WIDTH / 2, startY + gap * 3, 'RETURN TO ARCADE', () => this.returnToArcade());
  }

  showOptions() {
    this.clearMenu();
    this.settings = StorageSystem.loadSettings();
    const difficultyKeys = Object.keys(DIFFICULTY_PRESETS);
    const difficultyIndex = difficultyKeys.indexOf(this.settings.difficulty);
    const currentDifficulty = DIFFICULTY_PRESETS[this.settings.difficulty] ?? DIFFICULTY_PRESETS.medium;

    this.layout = LayoutSystem.screen(this);
    const startY = this.layout.menuStartY - 10;
    this.menuObjects.push(this.add.text(GAME_WIDTH / 2, startY, 'OPTIONS', {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '18px',
      color: '#d6f7ef',
    }).setOrigin(0.5).setDepth(62));

    this.createButton(GAME_WIDTH / 2, startY + 52, `DIFFICULTY: ${currentDifficulty.label}`, () => {
      const nextKey = difficultyKeys[(Math.max(0, difficultyIndex) + 1) % difficultyKeys.length];
      StorageSystem.saveSettings({ difficulty: nextKey });
      this.showOptions();
    }, { width: 220 });

    this.createSlider(startY + 104, 'MAIN', 'mainVolume');
    this.createSlider(startY + 150, 'MUSIC', 'musicVolume');
    this.createSlider(startY + 196, 'SFX', 'sfxVolume');
    this.createButton(GAME_WIDTH / 2, GAME_HEIGHT - 74, 'BACK', () => this.showMainMenu(), { width: 150 });
  }

  startGame() {
    this.scene.stop('GameScene');
    this.scene.start('OverworldScene', { autopilot: false });
  }

  startAutopilot() {
    this.scene.stop('GameScene');
    this.scene.start('OverworldScene', { autopilot: true });
  }

  returnToArcade() {
    window.parent?.postMessage({ type: 'wingtip:back-to-arcade' }, window.location.origin);
  }

  createButton(x, y, label, onSelect, config = {}) {
    const width = config.width ?? 190;
    const disabled = Boolean(config.disabled);
    const fill = disabled ? 0x11181b : 0x14242b;
    const stroke = disabled ? 0x334045 : 0x8fb9bd;
    const color = disabled ? '#59686b' : '#d6f7ef';
    const rect = this.add.rectangle(x, y, width, 34, fill, 0.92)
      .setStrokeStyle(1, stroke, disabled ? 0.35 : 0.85)
      .setDepth(61);
    const text = this.add.text(x, y, label, {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '14px',
      color,
    }).setOrigin(0.5).setDepth(62);

    this.menuObjects.push(rect, text);
    if (disabled) {
      return;
    }

    rect.setInteractive({ useHandCursor: true });
    rect.on('pointerover', () => rect.setFillStyle(0x1d3942, 0.96));
    rect.on('pointerout', () => rect.setFillStyle(fill, 0.92));
    rect.on('pointerdown', () => {
      this.audioSystem.playConfirm();
      onSelect();
    });
  }

  createSlider(y, label, settingKey) {
    const settings = StorageSystem.loadSettings();
    const x = GAME_WIDTH / 2;
    const width = 190;
    const value = Phaser.Math.Clamp(settings[settingKey] ?? 1, 0, 1);
    const labelText = this.add.text(x - 136, y, label, {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '13px',
      color: '#b5c5c3',
    }).setOrigin(0, 0.5).setDepth(62);
    const track = this.add.rectangle(x + 30, y, width, 5, 0x314047, 1).setDepth(61);
    const fill = this.add.rectangle(x + 30 - width / 2, y, width * value, 5, 0x8fb9bd, 1)
      .setOrigin(0, 0.5)
      .setDepth(62);
    const knob = this.add.circle(x + 30 - width / 2 + width * value, y, 8, 0xd6f7ef, 1).setDepth(63);
    const valueText = this.add.text(x + 146, y, `${Math.round(value * 100)}%`, {
      fontFamily: 'Consolas, Courier, monospace',
      fontSize: '12px',
      color: '#d6f7ef',
    }).setOrigin(0.5).setDepth(62);
    const hit = this.add.rectangle(x + 30, y, width + 20, 28, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true })
      .setDepth(64);

    const setValue = (pointer) => {
      const nextValue = Phaser.Math.Clamp((pointer.x - (x + 30 - width / 2)) / width, 0, 1);
      StorageSystem.saveSettings({ [settingKey]: nextValue });
      fill.width = width * nextValue;
      knob.x = x + 30 - width / 2 + width * nextValue;
      valueText.setText(`${Math.round(nextValue * 100)}%`);
      this.audioSystem.refreshSettings();
      if (settingKey !== 'sfxVolume') {
        this.audioSystem.playMainMenuMusic();
      }
    };

    hit.on('pointerdown', setValue);
    hit.on('pointermove', (pointer) => {
      if (pointer.isDown) {
        setValue(pointer);
      }
    });
    hit.on('pointerup', () => {
      if (settingKey === 'sfxVolume') {
        this.audioSystem.playConfirm();
      }
    });
    this.menuObjects.push(labelText, track, fill, knob, valueText, hit);
  }

  clearMenu() {
    for (const object of this.menuObjects) {
      object.destroy();
    }
    this.menuObjects = [];
  }
}
