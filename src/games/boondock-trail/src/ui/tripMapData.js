export const MAP_VIEWBOX = Object.freeze({
  width: 1000,
  height: 620
});

export const MAP_ROUTE_LAYOUT = Object.freeze({
  coastal_run_v2: {
    routeClass: "coast",
    coordinates: [
      { x: 92, y: 454, labelAnchor: "start", labelDy: 34 },
      { x: 208, y: 420, labelAnchor: "middle", labelDy: -30 },
      { x: 332, y: 378, labelAnchor: "middle", labelDy: -30 },
      { x: 444, y: 334, labelAnchor: "middle", labelDy: 34 },
      { x: 560, y: 292, labelAnchor: "middle", labelDy: -30 },
      { x: 680, y: 242, labelAnchor: "middle", labelDy: 34 },
      { x: 806, y: 182, labelAnchor: "middle", labelDy: -30 },
      { x: 920, y: 132, labelAnchor: "end", labelDy: -30 }
    ]
  },
  rain_coast: {
    routeClass: "coast",
    coordinates: [
      { x: 120, y: 500, labelAnchor: "start", labelDy: 34 },
      { x: 300, y: 438, labelAnchor: "middle", labelDy: 34 },
      { x: 500, y: 352, labelAnchor: "middle", labelDy: -30 },
      { x: 695, y: 258, labelAnchor: "middle", labelDy: 34 },
      { x: 875, y: 168, labelAnchor: "end", labelDy: -30 }
    ]
  },
  mesa_redwoods: {
    routeClass: "mesa",
    coordinates: [
      { x: 100, y: 330, labelAnchor: "start", labelDy: -30 },
      { x: 294, y: 312, labelAnchor: "middle", labelDy: 34 },
      { x: 506, y: 280, labelAnchor: "middle", labelDy: -30 },
      { x: 710, y: 224, labelAnchor: "middle", labelDy: 34 },
      { x: 870, y: 124, labelAnchor: "end", labelDy: -30 }
    ]
  },
  basin_lakes: {
    routeClass: "mountain",
    coordinates: [
      { x: 132, y: 168, labelAnchor: "start", labelDy: -30 },
      { x: 326, y: 196, labelAnchor: "middle", labelDy: -30 },
      { x: 522, y: 190, labelAnchor: "middle", labelDy: 34 },
      { x: 700, y: 140, labelAnchor: "middle", labelDy: -30 },
      { x: 850, y: 74, labelAnchor: "end", labelDy: 34 }
    ]
  }
});

export function getRouteLayout(routeId) {
  return MAP_ROUTE_LAYOUT[routeId] ?? null;
}

export function getRouteCoordinates(route, layout) {
  const routePointCoordinates = Array.isArray(route?.routePoints)
    ? route.routePoints.map((point) => point?.mapPosition ?? null)
    : [];

  if (
    routePointCoordinates.length > 0 &&
    routePointCoordinates.every(
      (point) =>
        point &&
        Number.isFinite(Number(point.x)) &&
        Number.isFinite(Number(point.y))
    )
  ) {
    return routePointCoordinates;
  }

  return Array.isArray(layout?.coordinates) ? layout.coordinates : [];
}

export function buildRoutePath(coordinates) {
  return coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

export function buildTraveledPath(route, layout, milesTraveled) {
  const coordinates = getRouteCoordinates(route, layout);
  const routePoints = route.routePoints;
  const clampedMiles = Math.max(0, Math.min(route.totalMiles, Number(milesTraveled) || 0));
  const pathPoints = [];

  for (let index = 0; index < routePoints.length; index += 1) {
    const routePoint = routePoints[index];
    const coordinate = coordinates[index];

    if (!coordinate) {
      continue;
    }

    if (routePoint.mileMarker <= clampedMiles) {
      pathPoints.push(coordinate);
      continue;
    }

    const previousRoutePoint = routePoints[index - 1];
    const previousCoordinate = coordinates[index - 1];

    if (previousRoutePoint && previousCoordinate) {
      const progress = getLegProgress(previousRoutePoint, routePoint, clampedMiles);
      pathPoints.push(interpolatePoint(previousCoordinate, coordinate, progress));
    }

    break;
  }

  if (pathPoints.length === 1) {
    pathPoints.push(pathPoints[0]);
  }

  return pathPoints.length > 0 ? buildRoutePath(pathPoints) : "";
}

export function interpolateRoutePosition(route, layout, milesTraveled) {
  const coordinates = getRouteCoordinates(route, layout);
  const clampedMiles = Math.max(0, Math.min(route.totalMiles, Number(milesTraveled) || 0));

  for (let index = 1; index < route.routePoints.length; index += 1) {
    const previousRoutePoint = route.routePoints[index - 1];
    const nextRoutePoint = route.routePoints[index];

    if (clampedMiles <= nextRoutePoint.mileMarker) {
      return interpolatePoint(
        layout.coordinates[index - 1],
        layout.coordinates[index],
        getLegProgress(previousRoutePoint, nextRoutePoint, clampedMiles)
      );
    }
  }

  return coordinates[coordinates.length - 1];
}

function getLegProgress(previousRoutePoint, nextRoutePoint, milesTraveled) {
  const legMiles = Math.max(1, nextRoutePoint.mileMarker - previousRoutePoint.mileMarker);
  return Math.max(0, Math.min(1, (milesTraveled - previousRoutePoint.mileMarker) / legMiles));
}

function interpolatePoint(start, end, progress) {
  return {
    x: Number((start.x + (end.x - start.x) * progress).toFixed(1)),
    y: Number((start.y + (end.y - start.y) * progress).toFixed(1))
  };
}
