import { createElevatorMapModel } from '../ui/maps/ElevatorMapModel.js';
import { createElevatorMenuLayout } from '../ui/maps/ElevatorMenuLayout.js';

export class ElevatorAccessMapRenderer {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.graphics = scene.add.graphics();
    this.labels = scene.add.container(0, 0);
    this.container.add([this.graphics, this.labels]);
  }

  render(ship, validation, selectedDeckId, options = {}) {
    this.graphics.clear();
    this.labels.removeAll(true);
    const { width, height } = this.scene.scale;
    const x = options.x ?? width * 0.69;
    const y = options.y ?? 78;
    const w = options.width ?? width * 0.29;
    const h = options.height ?? height - 150;
    const model = createElevatorMapModel(ship, validation, { deckId: selectedDeckId });
    const layout = createElevatorMenuLayout(model, { x, y, width: w, height: h });

    this.graphics.fillStyle(0x071018, 0.94);
    this.graphics.fillRect(x, y - 34, w, h + 84);
    this.graphics.lineStyle(1, 0x78f0ff, 0.6);
    this.graphics.strokeRect(x, y - 34, w, h + 84);
    this.addLabel('ELEVATOR ACCESS', x + 14, y - 26, '#baf7ff', '14px');

    const rowByDeck = layout.rowYByDeck;
    const levelRects = layout.levelRects;
    model.deckRows.forEach((row) => {
      const rowY = rowByDeck.get(row.deckId);
      this.graphics.lineStyle(1, 0x214b5a, 0.22);
      this.graphics.lineBetween(x + 12, rowY, x + w - 16, rowY);
    });

    model.deckRows.forEach((row) => {
      const rowY = rowByDeck.get(row.deckId);
      const active = row.deckId === selectedDeckId;
      for (const level of row.levels) {
        const rect = levelRects.get(level.levelId);
        if (!rect) continue;
        this.drawLevelSlice(rect.x, rect.centerY, rect.width, rect.height, active || level.current);
        if (row.levels.length > 1) {
          this.graphics.lineStyle(2, 0x03070c, 0.9);
          this.graphics.lineBetween(rect.x - 4, rect.centerY - rect.height * 0.5, rect.x - 4, rect.centerY + rect.height * 0.5);
          this.graphics.lineBetween(rect.x + rect.width + 4, rect.centerY - rect.height * 0.5, rect.x + rect.width + 4, rect.centerY + rect.height * 0.5);
        }
        if (options.showDebug && level.levelId) {
          this.addLabel(level.levelId.replace(`deck-${row.deckId}-`, ''), rect.x + 2, rect.y + rect.height + 2, '#5db8cf', '8px');
        }
      }
      const deck = ship.decks.find((item) => item.id === row.deckId);
      const hostiles = deck?.droids?.filter((droid) => !droid.neutralized).length ?? 0;
      const accessCount = deck?.lifts?.length ?? 0;
      this.addLabel(`D${row.deckNumber} ${row.deckName} ${hostiles}H ${accessCount}L`, x + w - 132, rowY - 8, active ? '#ffffff' : '#9fc6d2', '10px');
    });

    model.shafts.forEach((shaft, index) => {
      const shaftX = layout.shaftXById.get(shaft.shaftId) ?? this.getShaftX(x, w, shaft, index);
      const color = shaft.color ?? (shaft.isMainPath ? 0x79f2c0 : 0xc18cff);
      const stops = shaft.stops.map((stop) => ({
        ...stop,
        rect: levelRects.get(stop.levelId),
        y: levelRects.get(stop.levelId)?.centerY ?? rowByDeck.get(stop.deckId)
      })).filter((stop) => stop.y !== undefined);
      if (stops.length) {
        this.drawShaftColumn(shaftX, Math.min(...stops.map((stop) => stop.y)), Math.max(...stops.map((stop) => stop.y)), color);
      }
      for (const stop of shaft.stops) {
        const rect = levelRects.get(stop.levelId);
        const stopY = rect?.centerY ?? rowByDeck.get(stop.deckId);
        if (stopY === undefined) continue;
        this.drawStopAttachment(shaftX, stopY, rect, color);
      }
      const ys = shaft.stops.map((stop) => rowByDeck.get(stop.deckId)).filter((value) => value !== undefined);
      if (ys.length) this.addLabel(shaft.shaftId, shaftX - 18, Math.min(...ys) - 18, shaft.shaftType === 'main' ? '#79f2c0' : '#d9b8ff', '10px');
    });
  }

  getShaftX(x, w, shaft, index) {
    const normalizedX = shaft.xBand ?? (0.18 + index * 0.17);
    return x + w * 0.08 + normalizedX * (w * 0.78);
  }

  drawLevelSlice(x, centerY, width, height, active) {
    const y = centerY - height / 2;
    const fill = active ? 0xa9b1ff : 0x777bd8;
    const shadow = active ? 0x36406f : 0x22294f;
    const stroke = active ? 0xffffff : 0xd8f8ff;
    this.graphics.fillStyle(shadow, 0.95);
    this.graphics.fillRect(x + 3, y + 4, width, height);
    this.graphics.fillStyle(fill, 1);
    this.graphics.lineStyle(2, stroke, active ? 1 : 0.82);
    this.graphics.fillRect(x, y, width, height);
    this.graphics.strokeRect(x, y, width, height);
    this.graphics.lineStyle(1, 0xffffff, active ? 0.82 : 0.45);
    this.graphics.lineBetween(x + 2, y + 3, x + width - 3, y + 3);
    this.graphics.lineStyle(1, 0x202747, 0.8);
    this.graphics.lineBetween(x + 2, y + height - 3, x + width - 3, y + height - 3);
  }

  drawShaftColumn(x, y1, y2, color) {
    const top = y1 - 5;
    const height = y2 - y1 + 10;
    this.graphics.fillStyle(0x020508, 0.98);
    this.graphics.fillRect(x - 7, top, 14, height);
    this.graphics.lineStyle(1, color, 0.82);
    this.graphics.strokeRect(x - 7, top, 14, height);
    this.graphics.lineStyle(1, 0xe5f8ff, 0.55);
    for (let rungY = top + 4; rungY < top + height - 3; rungY += 7) {
      this.graphics.lineBetween(x - 5, rungY, x + 5, rungY);
    }
  }

  drawStopAttachment(shaftX, y, rect, color) {
    if (!rect) return;
    const inside = shaftX >= rect.x && shaftX <= rect.x + rect.width;
    const attachX = Math.max(rect.x + 5, Math.min(rect.x + rect.width - 5, shaftX));
    if (!inside) return;
    this.graphics.fillStyle(color, 0.58);
    this.graphics.fillRect(attachX - 6, y - 6, 12, 12);
    this.graphics.lineStyle(1, 0xffffff, 0.75);
    this.graphics.strokeRect(attachX - 7, y - 7, 14, 14);
  }

  addLabel(text, x, y, color, fontSize) {
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
