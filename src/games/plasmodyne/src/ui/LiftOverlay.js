import { ARCADE_UI } from './theme/ArcadeUiTheme.js';
import { BrandedInfoFrame } from './components/BrandedInfoFrame.js';
import { getDeckInfo } from '../data/deckNames.js';
import { createElevatorMapModel } from './maps/ElevatorMapModel.js';
import { createElevatorMenuLayout } from './maps/ElevatorMenuLayout.js';
import { getElevatorShaftColor } from './ElevatorShaftColors.js';

const LEVEL_COLORS = {
  current: 0xc9c1a4,
  currentDisabled: 0x5b5547,
  travel: 0x8e77da,
  selected: 0xffd36a,
  unvisited: 0x4b2c20,
  visited: 0x9f6232,
  cleared: 0x79f2c0,
  uncleared: 0xff6f61,
  neutral: 0x5c3a2b
};

export class LiftOverlay {
  constructor(scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(1500);
    this.container.setVisible(false);

    this.frame = new BrandedInfoFrame(scene, { width: 820, height: 560, title: 'LIFT ACCESS', status: 'SHAFT', panelAlpha: 0.96 });
    this.graphics = scene.add.graphics();
    this.labels = scene.add.container(0, 0);
    this.footer = scene.add.text(0, 244, 'W/S or ARROWS: select shaft stop    ENTER/SPACE/CLICK: travel    ESC: cancel', {
      fontFamily: ARCADE_UI.fontFamily,
      fontSize: '13px',
      color: '#fff1a8'
    }).setOrigin(0.5);

    this.container.add([this.frame.container, this.graphics, this.labels, this.footer]);
    this.hitZones = [];
    this.confirmZones = [];
    this.reachableLevels = [];
    this.selectedLevelId = null;
    this.hoverLevelId = null;
    this.pendingDestination = null;
    this.selectionPulseUntil = 0;
    this.confirmPulseUntil = 0;
    this.pointerMoveHandler = (pointer) => this.handlePointerMove(pointer);
    this.pointerDownHandler = (pointer) => this.handlePointerDown(pointer);
    scene.input.on('pointermove', this.pointerMoveHandler);
    scene.input.on('pointerdown', this.pointerDownHandler);
    this.handleResize();
    scene.scale.on('resize', this.handleResize, this);
  }

  applyCabinetStyle() {
    this.frame.panel.setStrokeStyle(2, 0xfff1a8, 0.86);
    this.frame.panel.setFillStyle(0xcdbf73, 0.96);
    this.frame.header.setFillStyle(0xf8f3d0, 1);
    this.frame.header.setStrokeStyle(1, 0x8a4f26, 0.72);
    this.frame.leftText.setColor('#b94f37');
    this.frame.brand.setColor('#b94f37');
    this.frame.rightText.setColor('#b94f37');
  }

  show(lift, destinationDecks = [], context = {}) {
    this.lift = lift;
    this.destinationDecks = destinationDecks;
    this.ship = context.ship ?? this.scene.ship;
    this.currentDeck = context.currentDeck ?? this.scene.currentDeck;
    this.currentLevelId = lift.regionId ?? this.currentDeck?.regions?.find((region) => region.liftRoomIds?.includes(lift.liftRoomId))?.id ?? null;
    this.model = createElevatorMapModel(this.ship, context.validation ?? null, {
      deckId: this.currentDeck?.id,
      levelId: this.currentLevelId
    });
    this.currentShaftId = lift.networkId;
    this.frame.setStatus((lift.networkId ?? 'SHAFT').replace('-shaft', '').replaceAll('-', ' ').toUpperCase());
    this.rebuildReachableLevels();
    this.selectedLevelId = this.reachableLevels[0]?.level.levelId ?? null;
    this.hoverLevelId = null;
    this.pendingDestination = null;
    this.selectionPulseUntil = this.scene.time.now + 260;
    this.container.setVisible(true);
    this.render(this.scene.time.now);
  }

  hide() {
    this.container.setVisible(false);
    this.lift = null;
    this.destinationDecks = [];
    this.ship = null;
    this.model = null;
    this.hitZones = [];
    this.confirmZones = [];
    this.reachableLevels = [];
    this.selectedLevelId = null;
    this.hoverLevelId = null;
    this.pendingDestination = null;
    this.graphics.clear();
    this.labels.removeAll(true);
  }

  isVisible() {
    return this.container.visible;
  }

  update(time) {
    if (!this.isVisible()) return;
    this.render(time);
  }

  rebuildReachableLevels() {
    const shaft = this.model?.shafts?.find((item) => item.shaftId === this.currentShaftId);
    const stopLevelIds = new Set((shaft?.stops ?? [])
      .filter((stop) => stop.levelId !== this.currentLevelId)
      .map((stop) => stop.levelId));
    const deckById = new Map(this.ship?.decks?.map((deck) => [deck.id, deck]) ?? []);
    const levels = [];
    for (const row of this.model?.deckRows ?? []) {
      for (const level of row.levels) {
        if (!stopLevelIds.has(level.levelId)) continue;
        const deck = deckById.get(level.deckId);
        if (!deck) continue;
        levels.push({ row, level, deck });
      }
    }
    this.reachableLevels = levels.sort((a, b) => a.row.yIndex - b.row.yIndex);
  }

  render(time = 0) {
    this.graphics.clear();
    this.labels.removeAll(true);
    this.hitZones = [];
    this.confirmZones = [];
    if (!this.model) return;

    const viewWidth = this.scene.scale.width;
    const viewHeight = this.scene.scale.height;
    const outer = Math.max(56, Math.min(86, viewWidth * 0.06));
    const top = Math.max(92, viewHeight * 0.13);
    const bottomBandHeight = 96;
    const bottomBandTop = viewHeight - bottomBandHeight - 42;
    const bottom = bottomBandTop - 24;
    const labelGutter = viewWidth < 900 ? 66 : 118;
    const contentLeft = outer + Math.max(0, labelGutter - 86);
    const contentRight = viewWidth - outer;
    const contentWidth = Math.max(1, contentRight - contentLeft);
    const height = Math.max(220, bottom - top);
    const railWidth = viewWidth < 900 ? 196 : Math.min(270, Math.max(230, contentWidth * 0.22));
    const gutter = viewWidth < 900 ? 18 : 30;
    const mapRect = {
      x: contentLeft,
      y: top,
      width: contentWidth - railWidth - gutter,
      height
    };
    const railRect = {
      x: mapRect.x + mapRect.width + gutter,
      y: top,
      width: railWidth,
      height
    };
    const rowLabelWidth = labelGutter;
    const layout = createElevatorMenuLayout(this.model, {
      x: mapRect.x + rowLabelWidth,
      y: mapRect.y + 8,
      width: Math.max(220, mapRect.width - rowLabelWidth - 14),
      height: Math.max(260, mapRect.height - 16)
    });
    const rowByDeck = layout.rowYByDeck;
    const levelRects = layout.levelRects;

    this.graphics.fillStyle(0x8a4f26, 0.88);
    this.graphics.fillRect(mapRect.x, mapRect.y, mapRect.width, mapRect.height);
    this.graphics.lineStyle(2, 0xfff4bb, 0.72);
    this.graphics.strokeRect(mapRect.x, mapRect.y, mapRect.width, mapRect.height);
    this.graphics.fillStyle(0x6e3b20, 0.56);
    this.graphics.fillRect(railRect.x, railRect.y, railRect.width, railRect.height);
    this.graphics.lineStyle(1, 0xfff4bb, 0.46);
    this.graphics.strokeRect(railRect.x, railRect.y, railRect.width, railRect.height);
    this.graphics.fillStyle(0xcdbf73, 0.5);
    this.graphics.fillRect(contentLeft, bottomBandTop, contentWidth, bottomBandHeight - 10);
    this.graphics.lineStyle(1, 0xfff4bb, 0.34);
    this.graphics.strokeRect(contentLeft, bottomBandTop, contentWidth, bottomBandHeight - 10);
    this.confirmZones.push(
      { x: railRect.x, y: railRect.y, width: railRect.width, height: railRect.height },
      { x: contentLeft, y: bottomBandTop, width: contentWidth, height: bottomBandHeight - 10 }
    );

    for (const row of this.model.deckRows) {
      const rowY = rowByDeck.get(row.deckId);
      this.graphics.lineStyle(1, 0xfff1a8, 0.22);
      this.graphics.lineBetween(mapRect.x + rowLabelWidth, rowY, mapRect.x + mapRect.width - 12, rowY);
      const info = getDeckInfo(row.deckId);
      const rowColor = row.deckId === this.currentDeck?.id
        ? '#ffffff'
        : row.cleared ? '#79f2c0' : row.discovered ? '#fff1a8' : '#9f7352';
      const status = row.cleared ? 'CLEAR' : `${row.hostileCount} SIG`;
      const label = viewWidth < 900 ? row.deckNumber : `${row.deckNumber} ${info.shortName ?? row.deckName}`;
      this.addLabel(label, mapRect.x + 14, rowY - 7, rowColor, viewWidth < 900 ? '10px' : '11px', 0, 0);
      if (row.deckId === this.currentDeck?.id) {
        this.addLabel('CURRENT', mapRect.x + 14, rowY + 7, '#ffffff', '9px', 0, 0);
      } else if (viewWidth >= 1050) {
        this.addLabel(status, mapRect.x + 14, rowY + 7, rowColor, '9px', 0, 0);
      }
    }

    for (const levelRect of levelRects.values()) {
      const state = this.getLevelState(levelRect.level);
      this.drawLevelSlice(levelRect, state, time);
    }

    for (const shaft of this.model.shafts) {
      this.drawShaft(shaft, layout, rowByDeck, levelRects, time);
    }

    for (const shaft of this.model.shafts) {
      this.drawShaftStops(shaft, layout, rowByDeck, levelRects, time);
    }

    for (const levelRect of levelRects.values()) {
      const state = this.getLevelState(levelRect.level);
      if (state.selectable) {
        this.hitZones.push({
          ...levelRect,
          x: levelRect.x - 8,
          y: levelRect.y - 8,
          width: levelRect.width + 16,
          height: levelRect.height + 16,
          deck: this.ship.decks.find((deck) => deck.id === levelRect.level.deckId)
        });
      }
      if (state.current || state.selected || state.hovered) {
        this.drawSelectionGlow(levelRect, state, time);
      }
    }

    const selected = this.reachableLevels.find((item) => item.level.levelId === this.selectedLevelId);
    const selectedInfo = selected ? getDeckInfo(selected.deck.id) : null;
    this.addLabel(
      selectedInfo ? `DESTINATION: DECK ${selectedInfo.displayNumber} ${selectedInfo.name}` : 'NO REACHABLE STOPS ON CURRENT SHAFT',
      contentLeft + 22,
      bottomBandTop + 16,
      selectedInfo ? '#fff1a8' : '#ff9b42',
      viewWidth < 900 ? '13px' : '16px',
      0,
      0
    );
    this.drawRail(railRect, selected, selectedInfo);
    this.footer.setPosition(viewWidth / 2, bottomBandTop + 58);
    this.footer.setFontSize(viewWidth < 900 ? 10 : 13);
    this.footer.setWordWrapWidth(Math.max(1, contentWidth - 36));
  }

  getLevelState(level) {
    const selectable = this.reachableLevels.some((item) => item.level.levelId === level.levelId);
    return {
      current: level.levelId === this.currentLevelId,
      selectable,
      selected: selectable && level.levelId === this.selectedLevelId,
      hovered: selectable && level.levelId === this.hoverLevelId,
      sameShaft: level.connectedShaftIds?.includes(this.currentShaftId),
      visited: Boolean(level.discovered || level.deckDiscovered),
      cleared: Boolean(level.cleared || level.hostileCount === 0),
      hostileCount: level.hostileCount ?? 0
    };
  }

  drawLevelSlice(rect, state, time) {
    const active = state.current || state.selected || state.hovered;
    const alpha = state.current ? 0.92 : state.selectable ? 0.9 : state.visited ? 0.58 : 0.28;
    const fill = state.current
      ? LEVEL_COLORS.currentDisabled
      : state.selected || state.hovered ? LEVEL_COLORS.selected
        : state.selectable ? LEVEL_COLORS.travel
          : state.visited ? LEVEL_COLORS.visited
            : LEVEL_COLORS.unvisited;
    const stroke = state.current ? LEVEL_COLORS.current : state.selected || state.hovered ? 0xffffff : state.cleared ? LEVEL_COLORS.cleared : LEVEL_COLORS.uncleared;
    const shadow = state.selectable ? 0x2f1b38 : 0x2b160f;
    this.graphics.fillStyle(shadow, 0.92 * alpha);
    this.graphics.fillRect(rect.x + 4, rect.y + 5, rect.width, rect.height);
    this.graphics.fillStyle(fill, alpha);
    this.graphics.lineStyle(state.current ? 3 : active ? 3 : 1, stroke, state.current ? 0.85 : 0.78 * alpha);
    this.graphics.fillRect(rect.x, rect.y, rect.width, rect.height);
    this.graphics.strokeRect(rect.x, rect.y, rect.width, rect.height);

    this.graphics.lineStyle(1, 0xffffff, state.current ? 0.16 : 0.34 * alpha);
    this.graphics.lineBetween(rect.x + 4, rect.y + 4, rect.x + rect.width - 4, rect.y + 4);
    if (state.current || state.selected || state.hovered || state.selectable) {
      const bandColor = state.current ? LEVEL_COLORS.current : state.selected || state.hovered ? 0xffffff : state.cleared ? LEVEL_COLORS.cleared : LEVEL_COLORS.uncleared;
      const bandAlpha = state.current ? 0.28 : state.selected || state.hovered ? 0.54 : 0.28;
      const bandHeight = Math.max(5, Math.min(12, rect.height * 0.24));
      this.graphics.fillStyle(bandColor, bandAlpha);
      this.graphics.fillRect(rect.x + 7, rect.centerY - bandHeight / 2, rect.width - 14, bandHeight);
    }
    this.graphics.fillStyle(state.cleared ? LEVEL_COLORS.cleared : LEVEL_COLORS.uncleared, state.visited || state.current ? 0.95 : 0.42);
    this.graphics.fillCircle(rect.x + rect.width - 9, rect.y + 9, 4);
    if (state.current) {
      const pulse = 0.7 + Math.sin(time * 0.006) * 0.25;
      this.graphics.lineStyle(2, LEVEL_COLORS.current, 0.5 + pulse * 0.18);
      this.graphics.strokeRect(rect.x - 5, rect.y - 5, rect.width + 10, rect.height + 10);
      this.graphics.lineStyle(2, 0x000000, 0.58);
      this.graphics.strokeRect(rect.x - 2, rect.y - 2, rect.width + 4, rect.height + 4);
      this.graphics.lineStyle(2, 0x1e1b15, 0.62);
      this.graphics.lineBetween(rect.x + 10, rect.centerY, rect.x + rect.width - 10, rect.centerY);
      this.addLabel('CURRENT', rect.x + rect.width / 2, rect.centerY, '#f8f3d0', '9px', 0.5, 0.5);
    }
  }

  drawSelectionGlow(rect, state, time) {
    if (state.current) {
      return;
    }
    const color = state.current ? LEVEL_COLORS.current : LEVEL_COLORS.selected;
    const pulse = state.selected || state.hovered ? 0.7 + Math.sin(time * 0.01) * 0.22 : 0.52;
    this.graphics.lineStyle(state.current ? 5 : 3, color, pulse);
    this.graphics.strokeRect(rect.x - 6, rect.y - 6, rect.width + 12, rect.height + 12);
  }

  drawRail(rect, selected, selectedInfo) {
    const currentInfo = this.currentDeck ? getDeckInfo(this.currentDeck.id) : null;
    const selectedDeck = selected?.deck ?? null;
    const currentHostiles = this.currentDeck?.droids?.filter((droid) => !droid.neutralized).length ?? 0;
    const selectedHostiles = selectedDeck?.droids?.filter((droid) => !droid.neutralized).length ?? 0;
    const pad = 16;
    const x = rect.x + pad;
    let y = rect.y + 18;
    this.addLabel('FLOOR STATUS', x, y, '#ffffff', '12px', 0, 0);
    y += 24;
    if (currentInfo) {
      this.addLabel(`CURRENT: ${currentInfo.displayNumber} ${currentInfo.shortName ?? currentInfo.name}`, x, y, '#ffffff', '11px', 0, 0);
      y += 18;
      this.addLabel(currentHostiles === 0 ? 'CLEARED' : `${currentHostiles} HOSTILE SIGNALS`, x, y, currentHostiles === 0 ? '#79f2c0' : '#ff6f61', '10px', 0, 0);
      y += 28;
    }
    if (selectedInfo) {
      this.addLabel(`SELECTED: ${selectedInfo.displayNumber} ${selectedInfo.shortName ?? selectedInfo.name}`, x, y, '#ffd36a', '11px', 0, 0);
      y += 18;
      this.addLabel(selectedHostiles === 0 ? 'CLEARED' : `${selectedHostiles} HOSTILE SIGNALS`, x, y, selectedHostiles === 0 ? '#79f2c0' : '#ff6f61', '10px', 0, 0);
      y += 30;
    }
    this.graphics.lineStyle(1, 0xfff1a8, 0.25);
    this.graphics.lineBetween(rect.x + 12, y, rect.x + rect.width - 12, y);
    this.drawLegend(x, y + 18, rect.width - pad * 2);
  }

  drawLegend(x, y, width = 172) {
    const items = [
      ['CURRENT FLOOR', LEVEL_COLORS.current],
      ['TRAVELLABLE', LEVEL_COLORS.travel],
      ['SELECTED STOP', LEVEL_COLORS.selected],
      ['VISITED', LEVEL_COLORS.visited],
      ['NOT VISITED', LEVEL_COLORS.unvisited],
      ['CLEARED / 0 DROIDS', LEVEL_COLORS.cleared],
      ['HOSTILES REMAIN', LEVEL_COLORS.uncleared]
    ];
    const rowHeight = 18;
    const height = 30 + items.length * rowHeight;
    const background = this.scene.add.rectangle(x - 8, y - 8, width, height, 0x2d180e, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0xfff1a8, 0.5);
    this.labels.add(background);
    this.addLabel('LEGEND', x, y, '#ffffff', '12px', 0, 0);
    items.forEach(([label, color], index) => {
      const yy = y + 22 + index * rowHeight;
      this.graphics.fillStyle(color, 0.94);
      this.graphics.fillRect(x, yy + 2, 16, 9);
      this.graphics.lineStyle(1, 0xffffff, 0.38);
      this.graphics.strokeRect(x, yy + 2, 16, 9);
      this.addLabel(label, x + 24, yy - 1, '#fff1a8', width < 210 ? '9px' : '10px', 0, 0);
    });
  }

  drawShaft(shaft, layout, rowByDeck, levelRects, time) {
    const stops = shaft.stops.map((stop) => ({
      ...stop,
      y: levelRects.get(stop.levelId)?.centerY ?? rowByDeck.get(stop.deckId)
    })).filter((stop) => stop.y !== undefined);
    if (!stops.length) return;
    const x = layout.shaftXById.get(shaft.shaftId) ?? this.getShaftX(shaft);
    const color = this.getShaftColor(shaft);
    const active = shaft.shaftId === this.currentShaftId;
    const y1 = Math.min(...stops.map((stop) => stop.y)) - 4;
    const y2 = Math.max(...stops.map((stop) => stop.y)) + 4;
    const columnWidth = active ? 15 : 12;
    this.graphics.fillStyle(0x020508, 0.98);
    this.graphics.fillRect(x - columnWidth / 2, y1, columnWidth, y2 - y1);
    this.graphics.lineStyle(1, color, active ? 0.9 : 0.42);
    this.graphics.strokeRect(x - columnWidth / 2, y1, columnWidth, y2 - y1);
    this.graphics.lineStyle(1, 0xe5f8ff, active ? 0.74 : 0.38);
    for (let rungY = y1 + 5; rungY < y2 - 3; rungY += 7) {
      this.graphics.lineBetween(x - columnWidth * 0.36, rungY, x + columnWidth * 0.36, rungY);
    }
    this.graphics.lineStyle(1, color, active ? 0.62 : 0.24);
    this.graphics.lineBetween(x - 2, y1 + 1, x - 2, y2 - 1);
    if (active) {
      const sweep = y1 + ((time * 0.08) % Math.max(1, y2 - y1));
      this.graphics.lineStyle(2, 0xffffff, 0.58);
      this.graphics.lineBetween(x - columnWidth * 0.44, sweep, x + columnWidth * 0.44, sweep);
    }
  }

  drawShaftStops(shaft, layout, rowByDeck, levelRects, time) {
    const x = layout.shaftXById.get(shaft.shaftId) ?? this.getShaftX(shaft);
    const color = this.getShaftColor(shaft);
    const activeShaft = shaft.shaftId === this.currentShaftId;
    for (const stop of shaft.stops) {
      const rect = levelRects.get(stop.levelId);
      const y = rect?.centerY ?? rowByDeck.get(stop.deckId);
      if (y === undefined) continue;
      const isCurrent = stop.levelId === this.currentLevelId;
      const isSelected = stop.levelId === this.selectedLevelId;
      const alpha = activeShaft ? 1 : 0.34;
      this.drawShaftStopAttachment(x, y, rect, color, alpha, isCurrent || isSelected);
      if (isSelected) {
        this.graphics.lineStyle(2, 0xffffff, 0.5 + Math.sin(time * 0.01) * 0.25);
        this.graphics.strokeRect(x - 11, y - 11, 22, 22);
      }
    }
  }

  drawShaftStopAttachment(shaftX, y, rect, color, alpha, emphasized) {
    if (!rect) {
      this.graphics.fillStyle(color, alpha);
      this.graphics.fillRect(shaftX - 5, y - 4, 10, 8);
      return;
    }
    const inside = shaftX >= rect.x && shaftX <= rect.x + rect.width;
    const attachX = Math.max(rect.x + 5, Math.min(rect.x + rect.width - 5, shaftX));
    if (!inside) return;
    this.graphics.fillStyle(color, emphasized ? alpha * 0.72 : alpha * 0.46);
    this.graphics.fillRect(attachX - 6, y - 6, 12, 12);
    this.graphics.lineStyle(emphasized ? 2 : 1, 0xffffff, emphasized ? 1 : alpha * 0.62);
    this.graphics.strokeRect(attachX - 7, y - 7, 14, 14);
  }

  getShaftX(shaft) {
    return -344 + (shaft.xBand ?? 0.5) * 580;
  }

  getShaftColor(shaft) {
    return getElevatorShaftColor(shaft, ARCADE_UI.colors.cyan);
  }

  selectNext(direction) {
    if (!this.reachableLevels.length) return;
    const currentIndex = Math.max(0, this.reachableLevels.findIndex((item) => item.level.levelId === this.selectedLevelId));
    const nextIndex = (currentIndex + direction + this.reachableLevels.length) % this.reachableLevels.length;
    this.selectedLevelId = this.reachableLevels[nextIndex].level.levelId;
    this.selectionPulseUntil = this.scene.time.now + 260;
    this.render(this.scene.time.now);
  }

  confirmSelection() {
    const target = this.reachableLevels.find((item) => item.level.levelId === this.selectedLevelId);
    if (!target) return null;
    this.pendingDestination = target.deck;
    this.confirmPulseUntil = this.scene.time.now + 240;
    return target.deck;
  }

  consumePendingDestination() {
    const destination = this.pendingDestination;
    this.pendingDestination = null;
    return destination;
  }

  getDestinationForKey(keyCode) {
    if (!this.isVisible()) return null;
    const index = keyCode - 49;
    return this.reachableLevels[index]?.deck ?? null;
  }

  handlePointerMove(pointer) {
    if (!this.isVisible()) return;
    const local = this.toLocal(pointer);
    const hit = this.hitZones.find((zone) => this.pointInRect(local, zone));
    const nextHover = hit?.level.levelId ?? null;
    if (nextHover !== this.hoverLevelId) {
      this.hoverLevelId = nextHover;
      if (hit) {
        this.selectedLevelId = hit.level.levelId;
      }
      this.render(this.scene.time.now);
    }
  }

  handlePointerDown(pointer) {
    if (!this.isVisible() || pointer.rightButtonDown()) return;
    const local = this.toLocal(pointer);
    const hit = this.hitZones.find((zone) => this.pointInRect(local, zone));
    if (hit) {
      this.selectedLevelId = hit.level.levelId;
    }
    this.confirmSelection();
    this.render(this.scene.time.now);
  }

  toLocal(pointer) {
    return {
      x: pointer.x - this.container.x,
      y: pointer.y - this.container.y
    };
  }

  pointInRect(point, rect) {
    return point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height;
  }

  addLabel(text, x, y, color, fontSize, originX = 0.5, originY = 0.5) {
    const label = this.scene.add.text(x, y, text, {
      fontFamily: ARCADE_UI.fontFamily,
      fontSize,
      color
    }).setOrigin(originX, originY);
    this.labels.add(label);
    return label;
  }

  handleResize() {
    const { width, height } = this.scene.scale;
    const frameWidth = Math.max(320, width - 12);
    const frameHeight = Math.max(320, height - 12);
    this.container.setPosition(0, 0);
    this.frame.width = frameWidth;
    this.frame.height = frameHeight;
    this.frame.panel.setSize(frameWidth, frameHeight);
    this.frame.header.setSize(frameWidth - 18, 48);
    this.frame.header.setPosition(0, -frameHeight / 2 + 30);
    this.frame.leftText.setPosition(-frameWidth / 2 + 24, -frameHeight / 2 + 18);
    this.frame.brand.setPosition(0, -frameHeight / 2 + 13);
    this.frame.brandLogo?.setPosition(0, -frameHeight / 2 + 30);
    this.frame.fitBrandLogo?.(54, 36);
    this.frame.rightText.setPosition(frameWidth / 2 - 24, -frameHeight / 2 + 18);
    this.frame.setPosition(width / 2, height / 2);
    this.footer.setPosition(width / 2, height - 34);
    this.applyCabinetStyle();
    if (this.isVisible()) {
      this.render(this.scene.time.now);
    }
  }

  destroy() {
    this.scene.input.off('pointermove', this.pointerMoveHandler);
    this.scene.input.off('pointerdown', this.pointerDownHandler);
    this.scene.scale.off('resize', this.handleResize, this);
    this.container.destroy(true);
  }
}
