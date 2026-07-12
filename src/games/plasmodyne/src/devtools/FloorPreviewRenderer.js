import { TILE_TYPES } from '../data/tileTypes.js';
import { brightenColor, getDeckPalette } from '../graphics/deckPalettes.js';

export class FloorPreviewRenderer {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.graphics = scene.add.graphics();
    this.labels = scene.add.container(0, 0);
    this.container.add([this.graphics, this.labels]);
  }

  render(deck, validation, options = {}) {
    this.graphics.clear();
    this.labels.removeAll(true);
    this.deck = deck;
    const { width, height } = this.scene.scale;
    const previewWidth = options.width ?? width * 0.68;
    const previewHeight = options.height ?? height - 96;
    const margin = 28;
    this.scale = Math.min((previewWidth - margin * 2) / deck.bounds.width, (previewHeight - margin * 2) / deck.bounds.height);
    this.offsetX = margin;
    this.offsetY = 74 + (previewHeight - deck.bounds.height * this.scale) / 2;
    this.palette = getDeckPalette(deck.id);

    this.drawDeckBase(deck);
    this.drawTiles(deck);
    this.drawWalls(deck);
    this.drawDoors(deck);
    this.drawFixtures(deck);
    this.drawLifts(deck);
    this.drawTerminals(deck);
    this.drawDroids(deck);
    this.drawStart(deck);
    if (options.debug) this.drawLabels(deck);
  }

  worldToPreview(x, y) {
    return { x: this.offsetX + x * this.scale, y: this.offsetY + y * this.scale };
  }

  drawDeckBase(deck) {
    const p = this.worldToPreview(deck.bounds.x, deck.bounds.y);
    this.graphics.fillStyle(0x05080c, 1);
    this.graphics.fillRect(p.x, p.y, deck.bounds.width * this.scale, deck.bounds.height * this.scale);
    const fp = this.worldToPreview(deck.footprint.x, deck.footprint.y);
    this.graphics.lineStyle(2, this.palette.wallHighlight, 0.9);
    this.graphics.strokeRect(fp.x, fp.y, deck.footprint.width * this.scale, deck.footprint.height * this.scale);
  }

  drawTiles(deck) {
    const tileSize = deck.tileMap.tileSize;
    for (const row of deck.tileMap.tiles) {
      for (const tile of row) {
        const color = this.tileColor(tile.tileType);
        if (color === null) continue;
        const p = this.worldToPreview(tile.x * tileSize, tile.y * tileSize);
        this.graphics.fillStyle(color, tile.tileType === TILE_TYPES.CORRIDOR_FLOOR ? 0.74 : 0.9);
        this.graphics.fillRect(p.x, p.y, tileSize * this.scale + 0.5, tileSize * this.scale + 0.5);
      }
    }
  }

  tileColor(type) {
    if (type === TILE_TYPES.ROOM_FLOOR || type === TILE_TYPES.LIFT_ROOM_FLOOR || type === TILE_TYPES.LIFT_PAD || type === TILE_TYPES.TERMINAL || type === TILE_TYPES.ALERT_BOX || type === TILE_TYPES.REPAIR_PAD) return this.palette.floorBase;
    if (type === TILE_TYPES.CORRIDOR_FLOOR) return this.palette.floorLine;
    if (type === TILE_TYPES.BLOCKED || type === TILE_TYPES.OBSTACLE) return this.palette.wallBase;
    return null;
  }

  drawWalls(deck) {
    const tileSize = deck.tileMap.tileSize;
    this.graphics.lineStyle(Math.max(1, tileSize * this.scale * 0.18), this.palette.wallBase, 1);
    for (const row of deck.tileMap.tiles) {
      for (const tile of row) {
        if (!this.tileColor(tile.tileType) || tile.tileType === TILE_TYPES.BLOCKED) continue;
        const x = tile.x * tileSize;
        const y = tile.y * tileSize;
        for (const [dx, dy, side] of [[0, -1, 'n'], [1, 0, 'e'], [0, 1, 's'], [-1, 0, 'w']]) {
          if (this.tileColor(deck.tileMap.tiles[tile.y + dy]?.[tile.x + dx]?.tileType)) continue;
          const a = this.worldToPreview(x + (side === 'e' ? tileSize : 0), y + (side === 's' ? tileSize : 0));
          const b = this.worldToPreview(x + (side === 'w' || side === 'e' ? (side === 'e' ? tileSize : 0) : tileSize), y + (side === 'n' || side === 's' ? (side === 's' ? tileSize : 0) : tileSize));
          this.graphics.lineBetween(a.x, a.y, b.x, b.y);
        }
      }
    }
  }

  drawDoors(deck) {
    for (const door of deck.doors) {
      const p = this.worldToPreview(door.x, door.y);
      const w = door.width * this.scale;
      const h = door.height * this.scale;
      this.graphics.lineStyle(Math.max(1, 2 * this.scale), 0x7defff, 0.92);
      if (door.orientation === 'vertical') {
        const cx = p.x + w / 2;
        this.graphics.lineBetween(cx - 4 * this.scale, p.y, cx - 4 * this.scale, p.y + h);
        this.graphics.lineBetween(cx + 4 * this.scale, p.y, cx + 4 * this.scale, p.y + h);
      } else {
        const cy = p.y + h / 2;
        this.graphics.lineBetween(p.x, cy - 4 * this.scale, p.x + w, cy - 4 * this.scale);
        this.graphics.lineBetween(p.x, cy + 4 * this.scale, p.x + w, cy + 4 * this.scale);
      }
    }
  }

  drawFixtures(deck) {
    for (const fixture of deck.fixtures ?? []) {
      const p = this.worldToPreview(fixture.x, fixture.y);
      if (fixture.type === 'repair-pad') {
        this.graphics.fillStyle(0xffffff, 0.95);
        this.graphics.fillCircle(p.x, p.y, Math.max(3, 8 * this.scale));
        this.graphics.lineStyle(1, 0xffffff, 0.8);
        this.graphics.strokeCircle(p.x, p.y, Math.max(6, 22 * this.scale));
      } else {
        this.graphics.fillStyle(0xbfc4c4, 0.95);
        this.graphics.fillRect(p.x - 8 * this.scale, p.y - 8 * this.scale, 16 * this.scale, 16 * this.scale);
      }
    }
  }

  drawLifts(deck) {
    for (const lift of deck.lifts) {
      const p = this.worldToPreview(lift.x, lift.y);
      const size = Math.max(10, deck.tileMap.tileSize * this.scale * 0.82);
      const glyphColor = lift.clearanceRequirement > 0 ? this.palette.hazard : brightenColor(this.palette.accent, 0.38);
      this.graphics.fillStyle(this.palette.wallShadow, 0.76);
      this.graphics.fillRect(p.x - size / 2, p.y - size / 2, size, size);
      this.graphics.lineStyle(Math.max(1, size * 0.08), 0xffffff, 0.8);
      this.graphics.strokeRect(p.x - size / 2, p.y - size / 2, size, size);
      this.graphics.fillStyle(glyphColor, 0.92);
      for (let i = 0; i < 4; i += 1) {
        const angle = i * Math.PI / 2 + Math.PI / 4;
        this.graphics.fillCircle(p.x + Math.cos(angle) * size * 0.16, p.y + Math.sin(angle) * size * 0.16, Math.max(2, size * 0.13));
      }
      this.graphics.lineStyle(Math.max(1, size * 0.08), this.palette.wallShadow, 0.92);
      this.graphics.lineBetween(p.x - size * 0.34, p.y, p.x + size * 0.34, p.y);
      this.graphics.lineBetween(p.x, p.y - size * 0.34, p.x, p.y + size * 0.34);
      this.addLabel(lift.networkId.replace('-lift', ''), p.x + 8, p.y - 8, '#baf7ff', '10px');
    }
  }

  drawTerminals(deck) {
    for (const terminal of deck.terminals) {
      const p = this.worldToPreview(terminal.x, terminal.y);
      const color = terminal.terminalType === 'ship-alert' ? 0xff6f61 : 0x79f2c0;
      const side = terminal.wallSide ?? terminal.orientation ?? 'north';
      const size = 12;
      const thick = 3;
      this.graphics.lineStyle(2, color, 0.95);
      if (side === 'north' || side === 'horizontal') {
        this.graphics.lineBetween(p.x - size / 2, p.y - size / 2, p.x + size / 2, p.y - size / 2);
        this.graphics.lineBetween(p.x - size / 2, p.y - size / 2, p.x - size / 2, p.y + size / 2);
        this.graphics.lineBetween(p.x + size / 2, p.y - size / 2, p.x + size / 2, p.y + size / 2);
      } else if (side === 'south') {
        this.graphics.lineBetween(p.x - size / 2, p.y + size / 2, p.x + size / 2, p.y + size / 2);
        this.graphics.lineBetween(p.x - size / 2, p.y - size / 2, p.x - size / 2, p.y + size / 2);
        this.graphics.lineBetween(p.x + size / 2, p.y - size / 2, p.x + size / 2, p.y + size / 2);
      } else if (side === 'west' || side === 'vertical') {
        this.graphics.lineBetween(p.x - size / 2, p.y - size / 2, p.x - size / 2, p.y + size / 2);
        this.graphics.lineBetween(p.x - size / 2, p.y - size / 2, p.x + size / 2, p.y - size / 2);
        this.graphics.lineBetween(p.x - size / 2, p.y + size / 2, p.x + size / 2, p.y + size / 2);
      } else {
        this.graphics.lineBetween(p.x + size / 2, p.y - size / 2, p.x + size / 2, p.y + size / 2);
        this.graphics.lineBetween(p.x - size / 2, p.y - size / 2, p.x + size / 2, p.y - size / 2);
        this.graphics.lineBetween(p.x - size / 2, p.y + size / 2, p.x + size / 2, p.y + size / 2);
      }
      this.graphics.fillStyle(color, 0.95);
      this.graphics.fillRect(p.x - thick / 2, p.y - thick / 2, thick, thick);
    }
  }

  drawDroids(deck) {
    for (const droid of deck.droids ?? []) {
      const p = this.worldToPreview(droid.x, droid.y);
      this.graphics.fillStyle(droid.rank >= 700 ? 0xff6f61 : droid.rank >= 400 ? 0xffd36a : 0x9df7ff, 1);
      this.graphics.fillCircle(p.x, p.y, 3.5);
    }
  }

  drawStart(deck) {
    const room = deck.rooms.find((item) => item.id === deck.startRoomId);
    if (!room) return;
    const p = this.worldToPreview(room.centerX, room.centerY);
    this.graphics.lineStyle(2, 0xffffff, 1);
    this.graphics.strokeCircle(p.x, p.y, 9);
    this.graphics.lineBetween(p.x - 11, p.y, p.x + 11, p.y);
    this.graphics.lineBetween(p.x, p.y - 11, p.x, p.y + 11);
  }

  drawLabels(deck) {
    for (const room of deck.rooms) {
      const p = this.worldToPreview(room.x + 8, room.y + 8);
      this.addLabel(`${room.id} ${room.type}`, p.x, p.y, '#ffffff', '9px');
    }
  }

  addLabel(text, x, y, color = '#ffffff', fontSize = '11px') {
    const label = this.scene.add.text(x, y, text, { fontFamily: 'monospace', fontSize, color }).setDepth(10);
    this.labels.add(label);
  }

  setVisible(value) {
    this.container.setVisible(value);
  }

  destroy() {
    this.container.destroy(true);
  }
}
