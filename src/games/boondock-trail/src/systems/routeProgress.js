import { getInteractiveRouteStopForRoutePoint } from "../state/gameContent.js";

export function normalizeRoutePoints(
  routePoints,
  totalMiles,
  fallbackStops = [],
  originName = "Start",
  destinationName = "Destination"
) {
  const sourcePoints =
    Array.isArray(routePoints) && routePoints.length > 0
      ? routePoints
      : buildFallbackRoutePoints(totalMiles, fallbackStops, originName, destinationName);

  const sortedPoints = sourcePoints
    .map((point, index) => ({
      ...point,
      mileMarker: Number(point.mileMarker)
    }))
    .sort((left, right) => (left.mileMarker || 0) - (right.mileMarker || 0));

  return sortedPoints.map((point, index, points) => {
    const isFirst = index === 0;
    const isLast = index === points.length - 1;
    const nextPoint = points[index + 1] ?? null;

    return {
      ...point,
      id: point.id || `route_point_${index}`,
      name: point.name || (isFirst ? originName : isLast ? destinationName : `Stop ${index}`),
      mileMarker: isFirst ? 0 : isLast ? totalMiles : clampMileMarker(point.mileMarker, totalMiles),
      kind: point.kind || (isFirst ? "origin" : isLast ? "destination" : "waypoint"),
      tag: point.tag || "route_point",
      description:
        point.description ||
        (isLast
          ? "This is the end of the road."
          : "A named stop on the road."),
      arrivalText:
        point.arrivalText ||
        (isLast
          ? `You come into ${point.name || destinationName} and finish the road.`
          : `${point.name || `Stop ${index}`} marks the end of another stretch.`),
      nextLegLabel:
        !isLast
          ? point.nextLegLabel || `${point.name || originName} To ${nextPoint?.name || destinationName}`
          : null,
      nextLegSummary:
        !isLast
          ? point.nextLegSummary ||
            `The road goes from ${point.name || originName} to ${nextPoint?.name || destinationName}.`
          : "The road is done.",
      index
    };
  });
}

export function getCurrentRoutePoint(journey) {
  const routePoints = getRoutePoints(journey);
  const milesTraveled = Number(journey.milesTraveled) || 0;

  return (
    [...routePoints].reverse().find((point) => point.mileMarker <= milesTraveled) ?? routePoints[0]
  );
}

export function getNextWaypoint(journey) {
  const routePoints = getRoutePoints(journey);
  const milesTraveled = Number(journey.milesTraveled) || 0;

  return routePoints.find((point) => point.mileMarker > milesTraveled) ?? null;
}

export function getCurrentRouteSegment(journey) {
  const routePoints = getRoutePoints(journey);
  const currentPoint = getCurrentRoutePoint(journey);
  const nextWaypoint = getNextWaypoint(journey);

  if (!nextWaypoint) {
    return {
      id: `${currentPoint.id}_arrival`,
      label: "Arrival",
      summary: `${currentPoint.name} is the end of the road.`,
      fromPoint: currentPoint,
      toPoint: null,
      segmentIndex: routePoints.length - 1,
      totalSegments: Math.max(1, routePoints.length - 1)
    };
  }

  return {
    id: `${currentPoint.id}_to_${nextWaypoint.id}`,
    label: currentPoint.nextLegLabel || `${currentPoint.name} To ${nextWaypoint.name}`,
    summary:
      currentPoint.nextLegSummary ||
      `The road goes from ${currentPoint.name} to ${nextWaypoint.name}.`,
    fromPoint: currentPoint,
    toPoint: nextWaypoint,
    segmentIndex: currentPoint.index,
    totalSegments: Math.max(1, routePoints.length - 1)
  };
}

export function getReachedRoutePoints(journey, previousMiles, nextMiles) {
  const routePoints = getRoutePoints(journey);
  const startMiles = Number(previousMiles) || 0;
  const endMiles = Number(nextMiles) || 0;

  if (endMiles <= startMiles) {
    return [];
  }

  return routePoints.filter(
    (point) =>
      point.kind !== "origin" &&
      point.mileMarker > startMiles &&
      point.mileMarker <= endMiles
  );
}

export function buildRouteProgressSummary(journey) {
  const currentPoint = getCurrentRoutePoint(journey);
  const nextWaypoint = getNextWaypoint(journey);
  const segment = getCurrentRouteSegment(journey);
  const milesTraveled = Number(journey.milesTraveled) || 0;
  const nextWaypointMilesAway = nextWaypoint
    ? Math.max(0, nextWaypoint.mileMarker - milesTraveled)
    : 0;
  const isBetweenWaypoints =
    nextWaypoint !== null &&
    milesTraveled > currentPoint.mileMarker &&
    milesTraveled < nextWaypoint.mileMarker;
  const currentLocationName = isBetweenWaypoints
    ? `Between ${currentPoint.name} and ${nextWaypoint.name}`
    : currentPoint.name;
  const routeLine = nextWaypoint ? `${currentPoint.name} to ${nextWaypoint.name}` : currentPoint.name;
  const currentPositionSentence = isBetweenWaypoints
    ? `You are between ${currentPoint.name} and ${nextWaypoint.name}.`
    : `You are at ${currentPoint.name}.`;

  return {
    currentPointId: currentPoint.id,
    currentPointName: currentPoint.name,
    currentLocationName,
    currentPointTag: currentPoint.tag,
    fromPointName: currentPoint.name,
    nextWaypointId: nextWaypoint?.id ?? null,
    nextWaypointName: nextWaypoint?.name ?? currentPoint.name,
    nextWaypointMilesAway,
    currentSegmentId: segment.id,
    currentSegmentLabel: segment.label,
    currentSegmentSummary: segment.summary,
    routeLine,
    currentPositionSentence,
    isBetweenWaypoints,
    routePointCount: getRoutePoints(journey).length,
    reachedPointCount: currentPoint.index + 1,
    isComplete: nextWaypoint === null,
    summaryText:
      nextWaypoint === null
        ? `${currentPoint.name} is the end of the road.`
        : `${currentLocationName}. Next: ${nextWaypoint.name} in ${nextWaypointMilesAway} miles.`
  };
}

export function syncJourneyRouteProgress(runState, options = {}) {
  const previousMiles = options.previousMiles;
  const recordDayNotes = options.recordDayNotes ?? false;
  const summary = buildRouteProgressSummary(runState.journey);

  runState.journey.stops = getRoutePoints(runState.journey).map((point) => point.name);
  runState.journey.currentStopIndex = getCurrentRoutePoint(runState.journey).index;
  runState.journey.currentLocationName = summary.currentLocationName;
  runState.journey.currentRoutePointId = summary.currentPointId;
  runState.journey.nextStopName = summary.nextWaypointName;
  runState.journey.nextWaypointId = summary.nextWaypointId;
  runState.journey.currentSegmentId = summary.currentSegmentId;
  runState.journey.currentSegmentLabel = summary.currentSegmentLabel;
  runState.journey.currentSegmentSummary = summary.currentSegmentSummary;
  runState.journey.routeProgressSummary = summary.summaryText;

  if (previousMiles === null || previousMiles === undefined) {
    return [];
  }

  const reachedPoints = getReachedRoutePoints(
    runState.journey,
    previousMiles,
    runState.journey.milesTraveled
  );

  if (reachedPoints.length === 0) {
    return [];
  }

  const existingIds = new Set((runState.day.reachedRoutePoints ?? []).map((point) => point.id));
  const newPoints = reachedPoints.filter((point) => !existingIds.has(point.id));

  if (newPoints.length === 0) {
    return [];
  }

  runState.day.reachedRoutePoints = [
    ...(runState.day.reachedRoutePoints ?? []),
    ...newPoints.map(toReachedRoutePointRecord)
  ];
  runState.day.routeArrivalNotice = buildRouteArrivalNotice(newPoints);

  if (recordDayNotes) {
    runState.day.summaryNotes = [...(runState.day.summaryNotes ?? []), ...buildReachedRouteNotes(newPoints)];
  }

  return newPoints;
}

export function buildReachedRouteNotes(reachedPoints) {
  return reachedPoints.map((point) =>
    point.kind === "destination"
      ? `You have reached ${point.name}. ${point.arrivalText}`
      : `${point.name} comes into view. ${point.arrivalText}`
  );
}

export function checkForRouteCompletion(runState) {
  return buildRouteProgressSummary(runState.journey).isComplete;
}

function getRoutePoints(journey) {
  return Array.isArray(journey.routePoints) ? journey.routePoints : [];
}

function toReachedRoutePointRecord(point) {
  const interactiveStop = getInteractiveRouteStopForRoutePoint(point);

  return {
    id: point.id,
    name: point.name,
    kind: point.kind,
    tag: point.tag,
    townId: typeof point.townId === "string" ? point.townId : null,
    townType: typeof point.townType === "string" ? point.townType : null,
    landmarkStopId: typeof point.landmarkStopId === "string" ? point.landmarkStopId : null,
    routeStopType: interactiveStop?.stopType ?? null,
    routeStopId: interactiveStop?.stopId ?? null,
    approachVisual: typeof point.approachVisual === "string" ? point.approachVisual : null,
    mileMarker: point.mileMarker,
    description: point.description,
    arrivalText: point.arrivalText
  };
}

function buildRouteArrivalNotice(reachedPoints) {
  const latestPoint = reachedPoints[reachedPoints.length - 1];
  const townId = typeof latestPoint.townId === "string" ? latestPoint.townId : null;
  const interactiveStop = getInteractiveRouteStopForRoutePoint(latestPoint);

  return {
    id: latestPoint.id,
    title:
      latestPoint.kind === "destination"
        ? `${latestPoint.name}`
        : `${latestPoint.name}`,
    body: latestPoint.arrivalText,
    kind: latestPoint.kind,
    tag: latestPoint.tag ?? null,
    townId,
    townType: typeof latestPoint.townType === "string" ? latestPoint.townType : null,
    landmarkStopId: typeof latestPoint.landmarkStopId === "string" ? latestPoint.landmarkStopId : null,
    routeStopType: interactiveStop?.stopType ?? null,
    routeStopId: interactiveStop?.stopId ?? null,
    routeStopTitle: interactiveStop?.name ?? latestPoint.name,
    routeStopSubtitle: interactiveStop?.subtitle ?? "",
    approachVisual:
      typeof latestPoint.approachVisual === "string" ? latestPoint.approachVisual : null,
    isTownStop: townId !== null,
    isInteractiveStop: interactiveStop !== null,
    points: reachedPoints.map((point) => ({
      id: point.id,
      name: point.name,
      kind: point.kind,
      townId: typeof point.townId === "string" ? point.townId : null,
      landmarkStopId:
        typeof point.landmarkStopId === "string" ? point.landmarkStopId : null
    }))
  };
}

function buildFallbackRoutePoints(totalMiles, fallbackStops, originName, destinationName) {
  const stops =
    Array.isArray(fallbackStops) && fallbackStops.length >= 2
      ? fallbackStops
      : [originName, "Stop", destinationName];

  const segmentCount = Math.max(1, stops.length - 1);

  return stops.map((name, index) => ({
    id: `route_point_${index}`,
    name,
    mileMarker: Math.round((totalMiles / segmentCount) * index),
    kind: index === 0 ? "origin" : index === stops.length - 1 ? "destination" : "waypoint",
    tag: index === 0 ? "origin" : index === stops.length - 1 ? "destination" : "waypoint",
    description: `${name} is a named stop on the road.`
  }));
}

function clampMileMarker(value, totalMiles) {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.min(totalMiles, numericValue));
}
