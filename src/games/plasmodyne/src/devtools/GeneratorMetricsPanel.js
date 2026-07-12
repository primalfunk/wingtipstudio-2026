export class GeneratorMetricsPanel {
  constructor(scene) {
    this.scene = scene;
    this.text = scene.add.text(12, 12, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#d8f8ff',
      backgroundColor: '#061018',
      padding: { x: 10, y: 8 },
      lineSpacing: 4
    }).setDepth(50).setScrollFactor(0);
  }

  render({ seed, ship, deck, validation }) {
    const deckMetrics = validation.metrics.decks.find((item) => item.deckId === deck.id);
    const status = validation.isValid ? 'PASS' : 'FAIL';
    const warnings = validation.warnings.length;
    const errors = validation.errors.length;
    this.text.setColor(validation.isValid ? '#79f2c0' : '#ff6f61');
    this.text.setText([
      `SEED: ${seed}`,
      `STATUS: ${status}  ERR ${errors}  WARN ${warnings}`,
      `SHIP: ${ship.decks.length} decks / ${validation.metrics.totalRooms} rooms / ${validation.metrics.totalDroids} droids`,
      `SHAFTS: ${validation.metrics.elevatorShaftCount}  REACHABLE: ${validation.metrics.reachableDeckCount}/${ship.decks.length}`,
      `LEVELS: ${validation.metrics.totalLevels}  SIZE RATIO: ${validation.metrics.largestSmallestMeaningfulLevelRatio}x`,
      `SPLIT DECKS: ${validation.metrics.splitDeckCount}  INTERCHANGE: ${validation.metrics.interchangeDeckCount}`,
      `CLEARANCE MAX: ${validation.metrics.highestRequiredClearance}`,
      '',
      `DECK ${deck.id}: ${deck.name}`,
      `LEVELS ${deckMetrics.levelCount}`,
      `ROOMS ${deckMetrics.roomCount}  CORR ${deckMetrics.corridorCount}  DOORS ${deckMetrics.doorCount}`,
      `LIFTS ${deckMetrics.liftCount}  TERMS ${deckMetrics.terminalCount}  DROIDS ${deckMetrics.droidCount}`,
      `WALK ${deckMetrics.walkableCoveragePercent}%  ROOM ${deckMetrics.roomFloorPercent}%  CORR ${deckMetrics.corridorFloorPercent}%`,
      `SOLID ${deckMetrics.solidVoidPercent}%  BIG SOLID ${deckMetrics.largestInteriorSolidRegion}`,
      `DEADENDS ${deckMetrics.deadEndCount}  AVG ROOM ${deckMetrics.averageRoomSize}`,
      `MIN/MAX ROOM ${deckMetrics.minRoomSize}/${deckMetrics.maxRoomSize}`,
      `BAD DOORS ${deckMetrics.invalidDoorCount}  NO-DOOR ROOMS ${deckMetrics.roomsWithoutDoors}`,
      `LOCKED ROOMS ${deckMetrics.clearanceLockedRoomCount}`,
      '',
      'Left/Right deck  R random  Enter regen',
      'E access map  F floor  D overlays  M metrics',
      'S export PNGs via browser snapshot'
    ].join('\n'));
  }

  setVisible(value) {
    this.text.setVisible(value);
  }

  destroy() {
    this.text.destroy();
  }
}
