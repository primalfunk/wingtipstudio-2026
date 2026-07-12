export function createElevatorMapModel(ship, validation = null, current = {}) {
  const levels = ship.decks.flatMap((deck) => deck.levels?.length ? deck.levels : deck.regions ?? []);
  const maxWidthCells = Math.max(1, ...levels.map((level) => level.widthCells ?? 1));
  const maxHeightCells = Math.max(1, ...levels.map((level) => level.heightCells ?? 1));
  const maxWalkable = Math.max(1, ...levels.map((level) => level.walkableCellCount ?? 1));
  const sizeClassWeight = {
    tiny: 0.2,
    small: 0.38,
    regular: 0.58,
    large: 0.78,
    huge: 1
  };

  const deckRows = ship.decks.map((deck, index) => ({
    deckId: deck.id,
    deckNumber: String(deck.id).padStart(2, '0'),
    deckName: deck.deckInfo?.shortName ?? deck.name,
    yIndex: index,
    discovered: deck.discovered ?? false,
    hostileCount: (deck.droids ?? []).filter((droid) => !droid.neutralized).length,
    cleared: deck.cleared || (deck.droids ?? []).every((droid) => droid.neutralized),
    levels: (deck.levels?.length ? deck.levels : deck.regions ?? []).map((level) => {
      const hostileCount = (deck.droids ?? []).filter((droid) => !droid.neutralized).length;
      const widthRatio = (level.widthCells ?? 1) / maxWidthCells;
      const areaRatio = Math.sqrt((level.walkableCellCount ?? 1) / maxWalkable);
      const classRatio = sizeClassWeight[level.sizeClass] ?? 0.58;
      const thicknessRatio = ((level.heightCells ?? 1) / maxHeightCells) * 0.62 +
        ((level.walkableCellCount ?? 1) / maxWalkable) * 0.18 +
        classRatio * 0.2;
      return {
        levelId: level.levelId ?? level.id,
        deckId: deck.id,
        boundsCells: level.boundsCells,
        widthCells: level.widthCells,
        heightCells: level.heightCells,
        walkableCellCount: level.walkableCellCount,
        sizeClass: level.sizeClass ?? 'regular',
        xBand: level.xBand ?? 0.5,
        connectedShaftIds: level.connectedShaftIds ?? [],
        liftStopIds: level.liftRoomIds ?? [],
        shapeProfile: level.shapeProfile ?? level.levelShapeProfile ?? 'RECT',
        hostileCount,
        cleared: deck.cleared || hostileCount === 0,
        deckDiscovered: deck.discovered ?? false,
        visualSlice: {
          widthRatio: widthRatio * 0.5 + areaRatio * 0.22 + classRatio * 0.28,
          thicknessRatio,
          xBand: level.xBand ?? 0.5
        },
        discovered: level.discovered ?? deck.discovered ?? false,
        current: current.deckId === deck.id && (!current.levelId || current.levelId === (level.levelId ?? level.id))
      };
    })
  }));

  const shafts = (validation?.shafts ?? ship.elevatorShafts ?? []).map((shaft) => ({
    shaftId: shaft.id,
    shaftType: shaft.shaftType,
    xBand: shaft.xBand ?? 0.5,
    color: shaft.color,
    stops: (shaft.stops ?? []).map((stop) => ({
      deckId: stop.deckId,
      levelId: stop.regionId,
      liftRoomId: stop.liftRoomId
    }))
  }));

  return {
    shipId: ship.id ?? 'plasmodyne-ship',
    seed: ship.seed,
    deckRows,
    shafts,
    metrics: validation?.metrics ?? null
  };
}
