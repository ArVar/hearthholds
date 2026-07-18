import type { MapPath, PathAnchor, Point } from "./types";

function lerpPoint(from: Point, to: Point, amount: number): Point {
  return {
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount,
  };
}

function pointDistance(from: Point, to: Point): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function defaultAnchor(points: Point[], index: number, mode: PathAnchor["mode"]): PathAnchor {
  const point = points[index];
  const previous = points[index - 1];
  const next = points[index + 1];
  const anchor: PathAnchor = { ...point, mode };

  if (mode === "corner") return anchor;
  if (previous && next) {
    anchor.handleIn = {
      x: point.x - (next.x - previous.x) / 6,
      y: point.y - (next.y - previous.y) / 6,
    };
    anchor.handleOut = {
      x: point.x + (next.x - previous.x) / 6,
      y: point.y + (next.y - previous.y) / 6,
    };
  } else if (next) {
    anchor.handleOut = lerpPoint(point, next, 1 / 3);
  } else if (previous) {
    anchor.handleIn = lerpPoint(point, previous, 1 / 3);
  }
  return anchor;
}

export function getPathAnchors(path: MapPath): PathAnchor[] {
  if (path.anchors?.length) return path.anchors.map((anchor) => ({ ...anchor }));
  const points: Point[] = [];
  for (let index = 0; index < path.points.length; index += 2) {
    points.push({ x: path.points[index], y: path.points[index + 1] });
  }
  const mode = path.kind === "bridge" ? "corner" : "smooth";
  return points.map((_, index) => defaultAnchor(points, index, mode));
}

export function syncPathGeometry(anchors: PathAnchor[]): Pick<MapPath, "anchors" | "points"> {
  return {
    anchors,
    points: anchors.flatMap((anchor) => [anchor.x, anchor.y]),
  };
}

export function movePathAnchor(
  anchors: PathAnchor[],
  index: number,
  position: Point,
): PathAnchor[] {
  return anchors.map((anchor, anchorIndex) => {
    if (anchorIndex !== index) return anchor;
    const delta = { x: position.x - anchor.x, y: position.y - anchor.y };
    return {
      ...anchor,
      x: position.x,
      y: position.y,
      handleIn: anchor.handleIn
        ? { x: anchor.handleIn.x + delta.x, y: anchor.handleIn.y + delta.y }
        : undefined,
      handleOut: anchor.handleOut
        ? { x: anchor.handleOut.x + delta.x, y: anchor.handleOut.y + delta.y }
        : undefined,
    };
  });
}

export function movePathHandle(
  anchors: PathAnchor[],
  index: number,
  side: "in" | "out",
  position: Point,
): PathAnchor[] {
  return anchors.map((anchor, anchorIndex) => {
    if (anchorIndex !== index) return anchor;
    const next = {
      ...anchor,
      [side === "in" ? "handleIn" : "handleOut"]: position,
    };
    const oppositeKey = side === "in" ? "handleOut" : "handleIn";
    const opposite = anchor[oppositeKey];
    if (anchor.mode !== "smooth" || !opposite) return next;

    const length = pointDistance(anchor, opposite);
    const direction = { x: position.x - anchor.x, y: position.y - anchor.y };
    const movedLength = Math.hypot(direction.x, direction.y) || 1;
    next[oppositeKey] = {
      x: anchor.x - (direction.x / movedLength) * length,
      y: anchor.y - (direction.y / movedLength) * length,
    };
    return next;
  });
}

export function setPathAnchorMode(
  anchors: PathAnchor[],
  index: number,
  mode: PathAnchor["mode"],
): PathAnchor[] {
  if (mode === "corner") {
    return anchors.map((anchor, anchorIndex) =>
      anchorIndex === index ? { ...anchor, mode } : anchor,
    );
  }

  const points = anchors.map(({ x, y }) => ({ x, y }));
  const smooth = defaultAnchor(points, index, "smooth");
  return anchors.map((anchor, anchorIndex) =>
    anchorIndex === index ? { ...anchor, ...smooth } : anchor,
  );
}

export function translatePathAnchors(
  anchors: PathAnchor[],
  delta: Point,
): PathAnchor[] {
  return anchors.map((anchor) => ({
    ...anchor,
    x: anchor.x + delta.x,
    y: anchor.y + delta.y,
    handleIn: anchor.handleIn
      ? { x: anchor.handleIn.x + delta.x, y: anchor.handleIn.y + delta.y }
      : undefined,
    handleOut: anchor.handleOut
      ? { x: anchor.handleOut.x + delta.x, y: anchor.handleOut.y + delta.y }
      : undefined,
  }));
}

export function splitPathSegment(
  anchors: PathAnchor[],
  index: number,
  amount = 0.5,
): PathAnchor[] {
  const start = anchors[index];
  const end = anchors[index + 1];
  if (!start || !end) return anchors;
  const p0 = { x: start.x, y: start.y };
  const p1 = start.handleOut ?? p0;
  const p3 = { x: end.x, y: end.y };
  const p2 = end.handleIn ?? p3;
  const splitAmount = Math.min(0.98, Math.max(0.02, amount));
  const q0 = lerpPoint(p0, p1, splitAmount);
  const q1 = lerpPoint(p1, p2, splitAmount);
  const q2 = lerpPoint(p2, p3, splitAmount);
  const r0 = lerpPoint(q0, q1, splitAmount);
  const r1 = lerpPoint(q1, q2, splitAmount);
  const point = lerpPoint(r0, r1, splitAmount);
  const next = anchors.map((anchor) => ({ ...anchor }));
  next[index] = { ...start, handleOut: q0 };
  next[index + 1] = { ...end, handleIn: q2 };
  next.splice(index + 1, 0, {
    ...point,
    mode: "smooth",
    handleIn: r0,
    handleOut: r1,
  });
  return next;
}

export function removePathAnchor(anchors: PathAnchor[], index: number): PathAnchor[] {
  if (anchors.length <= 2 || index < 0 || index >= anchors.length) return anchors;
  const next = anchors.filter((_, anchorIndex) => anchorIndex !== index);
  next[0] = { ...next[0], handleIn: undefined };
  next[next.length - 1] = { ...next[next.length - 1], handleOut: undefined };
  return next;
}

export type PathSegmentHit = {
  segmentIndex: number;
  amount: number;
  point: Point;
  distance: number;
};

export function findClosestPathSegment(
  anchors: PathAnchor[],
  position: Point,
): PathSegmentHit | null {
  let closest: PathSegmentHit | null = null;
  for (let segmentIndex = 0; segmentIndex < anchors.length - 1; segmentIndex += 1) {
    for (let sample = 1; sample < 48; sample += 1) {
      const amount = sample / 48;
      const point = cubicBezierPoint(
        anchors[segmentIndex],
        anchors[segmentIndex + 1],
        amount,
      );
      const distance = pointDistance(point, position);
      if (!closest || distance < closest.distance) {
        closest = { segmentIndex, amount, point, distance };
      }
    }
  }
  return closest;
}

export function cubicBezierPoint(start: PathAnchor, end: PathAnchor, amount: number): Point {
  const p0 = { x: start.x, y: start.y };
  const p1 = start.handleOut ?? p0;
  const p3 = { x: end.x, y: end.y };
  const p2 = end.handleIn ?? p3;
  const inverse = 1 - amount;
  return {
    x:
      inverse ** 3 * p0.x +
      3 * inverse ** 2 * amount * p1.x +
      3 * inverse * amount ** 2 * p2.x +
      amount ** 3 * p3.x,
    y:
      inverse ** 3 * p0.y +
      3 * inverse ** 2 * amount * p1.y +
      3 * inverse * amount ** 2 * p2.y +
      amount ** 3 * p3.y,
  };
}
