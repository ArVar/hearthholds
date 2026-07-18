import type {
  ArcSegment,
  BezierSegment,
  MapPath,
  Palisade,
  PalisadeNodeMode,
  PalisadeSegment,
  Point,
} from "./types";
import { cubicBezierPoint, getPathAnchors } from "./pathGeometry";

const FULL_CIRCLE = Math.PI * 2;

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function snapAngle(angle: number, step = 15): number {
  const snapped = Math.round(angle / step) * step;
  return ((snapped % 360) + 360) % 360;
}

export function distance(from: Point, to: Point): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function pointsMatch(left: Point, right: Point): boolean {
  return distance(left, right) < 0.5;
}

function lerpPoint(from: Point, to: Point, amount: number): Point {
  return {
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount,
  };
}

export function palisadeBezierPoint(
  segment: BezierSegment,
  amount: number,
): Point {
  const inverse = 1 - amount;
  return {
    x:
      inverse ** 3 * segment.from.x +
      3 * inverse ** 2 * amount * segment.handleFrom.x +
      3 * inverse * amount ** 2 * segment.handleTo.x +
      amount ** 3 * segment.to.x,
    y:
      inverse ** 3 * segment.from.y +
      3 * inverse ** 2 * amount * segment.handleFrom.y +
      3 * inverse * amount ** 2 * segment.handleTo.y +
      amount ** 3 * segment.to.y,
  };
}

export function arcSweepRadians(arc: ArcSegment): number {
  const start = degreesToRadians(arc.startAngle);
  const end = degreesToRadians(arc.endAngle);
  const raw = arc.counterClockwise ? start - end : end - start;
  return ((raw % FULL_CIRCLE) + FULL_CIRCLE) % FULL_CIRCLE;
}

export function segmentLength(segment: PalisadeSegment): number {
  if (segment.kind === "line") {
    return distance(segment.from, segment.to);
  }

  if (segment.kind === "bezier") {
    let total = 0;
    let previous = segment.from;
    for (let sample = 1; sample <= 24; sample += 1) {
      const point = palisadeBezierPoint(segment, sample / 24);
      total += distance(previous, point);
      previous = point;
    }
    return total;
  }

  return arcSweepRadians(segment) * segment.radius;
}

export function palisadeLength(palisade: Palisade): number {
  return palisade.segments.reduce(
    (total, segment) => total + segmentLength(segment),
    0,
  );
}

export function pathLength(path: MapPath): number {
  const anchors = getPathAnchors(path);
  let total = 0;
  for (let index = 0; index < anchors.length - 1; index += 1) {
    let previous = { x: anchors[index].x, y: anchors[index].y };
    for (let sample = 1; sample <= 16; sample += 1) {
      const point = cubicBezierPoint(anchors[index], anchors[index + 1], sample / 16);
      total += distance(previous, point);
      previous = point;
    }
  }
  return total;
}

type EditableEndpoint = {
  index: number;
  segment: Exclude<PalisadeSegment, ArcSegment>;
  side: "from" | "to";
  outer: Point;
};

function arcEndpoint(arc: ArcSegment, side: "start" | "end"): Point {
  const angle = degreesToRadians(side === "start" ? arc.startAngle : arc.endAngle);
  return {
    x: arc.center.x + Math.cos(angle) * arc.radius,
    y: arc.center.y + Math.sin(angle) * arc.radius,
  };
}

function arcToBezierSegments(arc: ArcSegment): BezierSegment[] {
  const sweep = arcSweepRadians(arc);
  const direction = arc.counterClockwise ? -1 : 1;
  const segmentCount = Math.max(1, Math.ceil(sweep / (Math.PI / 2)));
  const step = (direction * sweep) / segmentCount;

  return Array.from({ length: segmentCount }, (_, index) => {
    const startAngle = degreesToRadians(arc.startAngle) + step * index;
    const endAngle = startAngle + step;
    const handleScale = (4 / 3) * Math.tan(Math.abs(step) / 4) * arc.radius;
    const signedHandleScale = handleScale * Math.sign(step);
    const from = {
      x: arc.center.x + Math.cos(startAngle) * arc.radius,
      y: arc.center.y + Math.sin(startAngle) * arc.radius,
    };
    const to = {
      x: arc.center.x + Math.cos(endAngle) * arc.radius,
      y: arc.center.y + Math.sin(endAngle) * arc.radius,
    };
    return {
      kind: "bezier",
      from,
      to,
      handleFrom: {
        x: from.x - Math.sin(startAngle) * signedHandleScale,
        y: from.y + Math.cos(startAngle) * signedHandleScale,
      },
      handleTo: {
        x: to.x + Math.sin(endAngle) * signedHandleScale,
        y: to.y - Math.cos(endAngle) * signedHandleScale,
      },
      fromMode: index === 0 ? "corner" : "smooth",
      toMode: index === segmentCount - 1 ? "corner" : "smooth",
    };
  });
}

function segmentTouchesJunction(segment: PalisadeSegment, junction: Point): boolean {
  if (segment.kind === "arc") {
    return (
      pointsMatch(arcEndpoint(segment, "start"), junction) ||
      pointsMatch(arcEndpoint(segment, "end"), junction)
    );
  }
  return pointsMatch(segment.from, junction) || pointsMatch(segment.to, junction);
}

function editableEndpoints(
  segments: PalisadeSegment[],
  junction: Point,
): EditableEndpoint[] {
  return segments.flatMap<EditableEndpoint>((segment, index) => {
    if (segment.kind === "arc") return [];
    if (pointsMatch(segment.from, junction)) {
      return [{ index, segment, side: "from" as const, outer: segment.to }];
    }
    if (pointsMatch(segment.to, junction)) {
      return [{ index, segment, side: "to" as const, outer: segment.from }];
    }
    return [];
  });
}

function lineToBezier(segment: Extract<PalisadeSegment, { kind: "line" }>): BezierSegment {
  return {
    kind: "bezier",
    from: segment.from,
    to: segment.to,
    handleFrom: lerpPoint(segment.from, segment.to, 1 / 3),
    handleTo: lerpPoint(segment.to, segment.from, 1 / 3),
    fromMode: "corner",
    toMode: "corner",
  };
}

function setBezierEndpoint(
  segment: BezierSegment,
  side: "from" | "to",
  handle: Point,
  mode: PalisadeNodeMode,
): BezierSegment {
  return side === "from"
    ? { ...segment, handleFrom: handle, fromMode: mode }
    : { ...segment, handleTo: handle, toMode: mode };
}

export function canSetPalisadeJunctionMode(
  segments: PalisadeSegment[],
  junction: Point,
): boolean {
  const connectedCount = segments.filter((segment) =>
    segmentTouchesJunction(segment, junction),
  ).length;
  return connectedCount >= 1 && connectedCount <= 2;
}

export function getPalisadeJunctionMode(
  segments: PalisadeSegment[],
  junction: Point,
): PalisadeNodeMode {
  const endpoints = editableEndpoints(segments, junction);
  if (endpoints.length === 0) return "corner";
  return endpoints.every(({ segment, side }) =>
    segment.kind === "bezier"
      ? (side === "from" ? segment.fromMode : segment.toMode) === "smooth"
      : false,
  )
    ? "smooth"
    : "corner";
}

export function setPalisadeJunctionMode(
  segments: PalisadeSegment[],
  junction: Point,
  mode: PalisadeNodeMode,
): PalisadeSegment[] {
  if (!canSetPalisadeJunctionMode(segments, junction)) {
    return segments;
  }

  const expanded = segments.flatMap((segment) =>
    segment.kind === "arc" && segmentTouchesJunction(segment, junction)
      ? arcToBezierSegments(segment)
      : [segment],
  );
  const endpoints = editableEndpoints(expanded, junction);
  if (endpoints.length === 0 || endpoints.length > 2) return segments;

  if (endpoints.length === 1) {
    const endpoint = endpoints[0];
    const bezier =
      endpoint.segment.kind === "bezier"
        ? endpoint.segment
        : lineToBezier(endpoint.segment);
    const next = [...expanded];
    next[endpoint.index] = setBezierEndpoint(
      bezier,
      endpoint.side,
      lerpPoint(junction, endpoint.outer, 1 / 3),
      mode,
    );
    return next;
  }

  const direction = {
    x: endpoints[1].outer.x - endpoints[0].outer.x,
    y: endpoints[1].outer.y - endpoints[0].outer.y,
  };
  const directionLength = Math.hypot(direction.x, direction.y) || 1;
  const unit = { x: direction.x / directionLength, y: direction.y / directionLength };
  const next = [...expanded];

  endpoints.forEach((endpoint, endpointIndex) => {
    const bezier =
      endpoint.segment.kind === "bezier"
        ? endpoint.segment
        : lineToBezier(endpoint.segment);
    const handleLength = distance(junction, endpoint.outer) / 3;
    const handle =
      mode === "smooth"
        ? {
            x: junction.x + unit.x * handleLength * (endpointIndex === 0 ? -1 : 1),
            y: junction.y + unit.y * handleLength * (endpointIndex === 0 ? -1 : 1),
          }
        : lerpPoint(junction, endpoint.outer, 1 / 3);
    next[endpoint.index] = setBezierEndpoint(bezier, endpoint.side, handle, mode);
  });

  return next;
}

export type PalisadeJunctionHandle = {
  segmentIndex: number;
  point: Point;
};

export function getPalisadeJunctionHandles(
  segments: PalisadeSegment[],
  junction: Point,
): PalisadeJunctionHandle[] {
  return editableEndpoints(segments, junction).flatMap(({ index, segment, side }) =>
    segment.kind === "bezier"
      ? [{ segmentIndex: index, point: side === "from" ? segment.handleFrom : segment.handleTo }]
      : [],
  );
}

export function movePalisadeJunctionHandle(
  segments: PalisadeSegment[],
  junction: Point,
  segmentIndex: number,
  position: Point,
): PalisadeSegment[] {
  const selected = segments[segmentIndex];
  if (selected?.kind !== "bezier") return segments;
  const side = pointsMatch(selected.from, junction)
    ? "from"
    : pointsMatch(selected.to, junction)
      ? "to"
      : null;
  if (!side) return segments;

  const next = [...segments];
  next[segmentIndex] = setBezierEndpoint(
    selected,
    side,
    position,
    side === "from" ? selected.fromMode : selected.toMode,
  );

  if (getPalisadeJunctionMode(segments, junction) !== "smooth") return next;
  const opposite = editableEndpoints(segments, junction).find(
    (endpoint) => endpoint.index !== segmentIndex && endpoint.segment.kind === "bezier",
  );
  if (!opposite || opposite.segment.kind !== "bezier") return next;
  const moved = { x: position.x - junction.x, y: position.y - junction.y };
  const movedLength = Math.hypot(moved.x, moved.y) || 1;
  const oppositeHandle =
    opposite.side === "from"
      ? opposite.segment.handleFrom
      : opposite.segment.handleTo;
  const oppositeLength = distance(junction, oppositeHandle);
  next[opposite.index] = setBezierEndpoint(
    opposite.segment,
    opposite.side,
    {
      x: junction.x - (moved.x / movedLength) * oppositeLength,
      y: junction.y - (moved.y / movedLength) * oppositeLength,
    },
    "smooth",
  );
  return next;
}

export function splitPalisadeSegment(
  segments: PalisadeSegment[],
  segmentIndex: number,
  position: Point,
): PalisadeSegment[] {
  const segment = segments[segmentIndex];
  if (!segment) return segments;
  const next = [...segments];
  if (segment.kind === "line") {
    const lengthSquared =
      (segment.to.x - segment.from.x) ** 2 + (segment.to.y - segment.from.y) ** 2;
    const amount = lengthSquared
      ? ((position.x - segment.from.x) * (segment.to.x - segment.from.x) +
          (position.y - segment.from.y) * (segment.to.y - segment.from.y)) /
        lengthSquared
      : 0.5;
    const clamped = Math.min(0.98, Math.max(0.02, amount));
    const point = {
      x: segment.from.x + (segment.to.x - segment.from.x) * clamped,
      y: segment.from.y + (segment.to.y - segment.from.y) * clamped,
    };
    next.splice(
      segmentIndex,
      1,
      { kind: "line", from: segment.from, to: point },
      { kind: "line", from: point, to: segment.to },
    );
    return next;
  }

  if (segment.kind === "bezier") {
    let splitAmount = 0.5;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (let sample = 1; sample < 96; sample += 1) {
      const amount = sample / 96;
      const samplePoint = palisadeBezierPoint(segment, amount);
      const sampleDistance = distance(samplePoint, position);
      if (sampleDistance < closestDistance) {
        closestDistance = sampleDistance;
        splitAmount = amount;
      }
    }
    const q0 = lerpPoint(segment.from, segment.handleFrom, splitAmount);
    const q1 = lerpPoint(segment.handleFrom, segment.handleTo, splitAmount);
    const q2 = lerpPoint(segment.handleTo, segment.to, splitAmount);
    const r0 = lerpPoint(q0, q1, splitAmount);
    const r1 = lerpPoint(q1, q2, splitAmount);
    const point = lerpPoint(r0, r1, splitAmount);
    next.splice(
      segmentIndex,
      1,
      {
        ...segment,
        to: point,
        handleFrom: q0,
        handleTo: r0,
        toMode: "smooth",
      },
      {
        ...segment,
        from: point,
        handleFrom: r1,
        handleTo: q2,
        fromMode: "smooth",
      },
    );
    return next;
  }

  const angle =
    (Math.atan2(position.y - segment.center.y, position.x - segment.center.x) * 180) /
    Math.PI;
  next.splice(
    segmentIndex,
    1,
    { ...segment, endAngle: angle },
    { ...segment, startAngle: angle },
  );
  return next;
}

export function canRemovePalisadeJunction(
  segments: PalisadeSegment[],
  junction: Point,
): boolean {
  return (
    canSetPalisadeJunctionMode(segments, junction) &&
    editableEndpoints(segments, junction).length === 2
  );
}

export function removePalisadeJunction(
  segments: PalisadeSegment[],
  junction: Point,
): PalisadeSegment[] {
  const endpoints = editableEndpoints(segments, junction);
  if (!canRemovePalisadeJunction(segments, junction) || endpoints.length !== 2) {
    return segments;
  }
  const firstIndex = Math.min(endpoints[0].index, endpoints[1].index);
  const secondIndex = Math.max(endpoints[0].index, endpoints[1].index);
  const outerControl = (endpoint: EditableEndpoint) => {
    if (endpoint.segment.kind === "line") {
      return {
        handle: lerpPoint(endpoint.outer, junction, 1 / 3),
        mode: "corner" as const,
      };
    }
    return endpoint.side === "from"
      ? { handle: endpoint.segment.handleTo, mode: endpoint.segment.toMode }
      : { handle: endpoint.segment.handleFrom, mode: endpoint.segment.fromMode };
  };
  const firstControl = outerControl(endpoints[0]);
  const secondControl = outerControl(endpoints[1]);
  const next = [...segments];
  next[firstIndex] = endpoints.every((endpoint) => endpoint.segment.kind === "line")
    ? { kind: "line", from: endpoints[0].outer, to: endpoints[1].outer }
    : {
        kind: "bezier",
        from: endpoints[0].outer,
        to: endpoints[1].outer,
        handleFrom: firstControl.handle,
        handleTo: secondControl.handle,
        fromMode: firstControl.mode,
        toMode: secondControl.mode,
      };
  next.splice(secondIndex, 1);
  return next;
}

export type PalisadeSegmentHit = {
  segmentIndex: number;
  amount: number;
  point: Point;
  distance: number;
};

export function findClosestPalisadeSegment(
  segments: PalisadeSegment[],
  position: Point,
): PalisadeSegmentHit | null {
  let closest: PalisadeSegmentHit | null = null;
  const consider = (segmentIndex: number, amount: number, point: Point) => {
    const candidateDistance = distance(point, position);
    if (!closest || candidateDistance < closest.distance) {
      closest = { segmentIndex, amount, point, distance: candidateDistance };
    }
  };

  segments.forEach((segment, segmentIndex) => {
    if (segment.kind === "line") {
      const delta = {
        x: segment.to.x - segment.from.x,
        y: segment.to.y - segment.from.y,
      };
      const lengthSquared = delta.x ** 2 + delta.y ** 2;
      const amount = lengthSquared
        ? Math.min(
            1,
            Math.max(
              0,
              ((position.x - segment.from.x) * delta.x +
                (position.y - segment.from.y) * delta.y) /
                lengthSquared,
            ),
          )
        : 0;
      consider(segmentIndex, amount, {
        x: segment.from.x + delta.x * amount,
        y: segment.from.y + delta.y * amount,
      });
      return;
    }

    if (segment.kind === "bezier") {
      for (let sample = 0; sample <= 96; sample += 1) {
        const amount = sample / 96;
        consider(segmentIndex, amount, palisadeBezierPoint(segment, amount));
      }
      return;
    }

    const sweep = arcSweepRadians(segment);
    const direction = segment.counterClockwise ? -1 : 1;
    const sampleCount = Math.max(24, Math.ceil((segment.radius * sweep) / 8));
    for (let sample = 0; sample <= sampleCount; sample += 1) {
      const angle =
        degreesToRadians(segment.startAngle) +
        direction * sweep * (sample / sampleCount);
      consider(segmentIndex, sample / sampleCount, {
        x: segment.center.x + Math.cos(angle) * segment.radius,
        y: segment.center.y + Math.sin(angle) * segment.radius,
      });
    }
  });

  return closest;
}
