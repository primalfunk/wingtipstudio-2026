export function gridToBoundaryX(cellX, cellSize, originX = 0) {
  return originX + cellX * cellSize;
}

export function gridToBoundaryY(cellY, cellSize, originY = 0) {
  return originY + cellY * cellSize;
}

export function gridToCenterX(cellX, cellSize, originX = 0) {
  return gridToBoundaryX(cellX, cellSize, originX) + cellSize / 2;
}

export function gridToCenterY(cellY, cellSize, originY = 0) {
  return gridToBoundaryY(cellY, cellSize, originY) + cellSize / 2;
}

export function cellRect(cellX, cellY, widthCells, heightCells, cellSize, originX = 0, originY = 0) {
  return {
    x: gridToBoundaryX(cellX, cellSize, originX),
    y: gridToBoundaryY(cellY, cellSize, originY),
    width: widthCells * cellSize,
    height: heightCells * cellSize
  };
}

export function getCellCenter(cellX, cellY, cellSize, originX = 0, originY = 0) {
  return {
    x: gridToCenterX(cellX, cellSize, originX),
    y: gridToCenterY(cellY, cellSize, originY)
  };
}

export function getCellBounds(cellX, cellY, cellSize, originX = 0, originY = 0) {
  return cellRect(cellX, cellY, 1, 1, cellSize, originX, originY);
}

export function footprintToWorldRect(footprint, cellSize, originX = 0, originY = 0) {
  return cellRect(
    footprint.gridX ?? footprint.x,
    footprint.gridY ?? footprint.y,
    footprint.widthCells ?? footprint.width,
    footprint.heightCells ?? footprint.height,
    cellSize,
    originX,
    originY
  );
}
