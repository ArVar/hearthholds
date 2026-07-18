import { snapAngle } from "./geometry";
import { getPathAnchors, syncPathGeometry } from "./pathGeometry";
import { getSceneObjects } from "./scene";
import type {
  EditorDocument,
  PalisadeSegment,
  Point,
  SelectableMapObject,
} from "./types";

export type SceneBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SceneTransform = {
  origin: Point;
  center: Point;
  scale: number;
  rotation: number;
};

function rotatePoint(point: Point, angle: number): Point {
  const radians = (angle * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: point.x * cosine - point.y * sine,
    y: point.x * sine + point.y * cosine,
  };
}

function transformPoint(point: Point, transform: SceneTransform): Point {
  const relative = rotatePoint(
    {
      x: (point.x - transform.origin.x) * transform.scale,
      y: (point.y - transform.origin.y) * transform.scale,
    },
    transform.rotation,
  );
  return {
    x: transform.center.x + relative.x,
    y: transform.center.y + relative.y,
  };
}

function boundsFromPoints(points: Point[], padding = 0): SceneBounds | null {
  if (points.length === 0) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs) - padding;
  const minY = Math.min(...ys) - padding;
  const maxX = Math.max(...xs) + padding;
  const maxY = Math.max(...ys) + padding;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function rotatedRectangleBounds(
  center: Point,
  width: number,
  height: number,
  rotation: number,
): SceneBounds {
  const corners = [
    { x: -width / 2, y: -height / 2 },
    { x: width / 2, y: -height / 2 },
    { x: width / 2, y: height / 2 },
    { x: -width / 2, y: height / 2 },
  ].map((point) => {
    const rotated = rotatePoint(point, rotation);
    return { x: center.x + rotated.x, y: center.y + rotated.y };
  });
  return boundsFromPoints(corners)!;
}

function palisadePoints(segments: PalisadeSegment[]): Point[] {
  return segments.flatMap((segment) => {
    if (segment.kind === "line") return [segment.from, segment.to];
    if (segment.kind === "bezier") {
      return [segment.from, segment.to, segment.handleFrom, segment.handleTo];
    }
    return [
      { x: segment.center.x - segment.radius, y: segment.center.y - segment.radius },
      { x: segment.center.x + segment.radius, y: segment.center.y + segment.radius },
    ];
  });
}

export function getSelectableObjectBounds(
  object: SelectableMapObject,
): SceneBounds | null {
  if (object.kind === "building") {
    return rotatedRectangleBounds(
      { x: object.value.x, y: object.value.y },
      object.value.width,
      object.value.height,
      object.value.rotation,
    );
  }
  if (object.kind === "zone") {
    return rotatedRectangleBounds(
      { x: object.value.x, y: object.value.y },
      object.value.width,
      object.value.height,
      object.value.rotation,
    );
  }
  if (object.kind === "decoration") {
    return rotatedRectangleBounds(
      object.value.position,
      object.value.width,
      object.value.height,
      object.value.rotation,
    );
  }
  if (object.kind === "marker") {
    return rotatedRectangleBounds(
      object.value.position,
      object.value.width,
      object.value.height,
      0,
    );
  }
  if (object.kind === "gate") {
    return rotatedRectangleBounds(
      object.value.position,
      object.value.width,
      Math.max(12, object.value.width * 0.32),
      object.value.rotation,
    );
  }
  if (object.kind === "path") {
    const anchors = getPathAnchors(object.value);
    const points = anchors.flatMap((anchor) => [
      { x: anchor.x, y: anchor.y },
      ...(anchor.handleIn ? [anchor.handleIn] : []),
      ...(anchor.handleOut ? [anchor.handleOut] : []),
    ]);
    return boundsFromPoints(points, object.value.width / 2);
  }
  const points = palisadePoints(object.value.segments).map((point) => {
    const rotated = rotatePoint(point, object.value.rotation);
    return {
      x: object.value.center.x + rotated.x,
      y: object.value.center.y + rotated.y,
    };
  });
  return boundsFromPoints(points, object.value.thickness / 2);
}

export function getSceneObjectBounds(
  document: EditorDocument,
  objectId: string,
): SceneBounds | null {
  const object = getSceneObjects(document).find((candidate) => candidate.id === objectId);
  return object ? getSelectableObjectBounds(object) : null;
}

export function getSceneSelectionBounds(
  document: EditorDocument,
  objectIds: string[],
): SceneBounds | null {
  const bounds = objectIds
    .map((id) => getSceneObjectBounds(document, id))
    .filter((item): item is SceneBounds => Boolean(item));
  if (bounds.length === 0) return null;
  const minX = Math.min(...bounds.map((item) => item.x));
  const minY = Math.min(...bounds.map((item) => item.y));
  const maxX = Math.max(...bounds.map((item) => item.x + item.width));
  const maxY = Math.max(...bounds.map((item) => item.y + item.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function sceneBoundsIntersect(a: SceneBounds, b: SceneBounds): boolean {
  return (
    a.x <= b.x + b.width
    && a.x + a.width >= b.x
    && a.y <= b.y + b.height
    && a.y + a.height >= b.y
  );
}

function scaleLocalPoint(point: Point, scale: number): Point {
  return { x: point.x * scale, y: point.y * scale };
}

function transformPalisadeSegment(
  segment: PalisadeSegment,
  scale: number,
): PalisadeSegment {
  if (segment.kind === "line") {
    return {
      ...segment,
      from: scaleLocalPoint(segment.from, scale),
      to: scaleLocalPoint(segment.to, scale),
    };
  }
  if (segment.kind === "bezier") {
    return {
      ...segment,
      from: scaleLocalPoint(segment.from, scale),
      to: scaleLocalPoint(segment.to, scale),
      handleFrom: scaleLocalPoint(segment.handleFrom, scale),
      handleTo: scaleLocalPoint(segment.handleTo, scale),
    };
  }
  return {
    ...segment,
    center: scaleLocalPoint(segment.center, scale),
    radius: Math.max(1, segment.radius * scale),
  };
}

export function transformSceneSelection(
  document: EditorDocument,
  objectIds: string[],
  transform: SceneTransform,
): void {
  const selectedIds = new Set(objectIds);
  const scale = Math.max(0.05, Math.abs(transform.scale));
  const normalizedTransform = { ...transform, scale };

  document.map.buildings.filter((item) => selectedIds.has(item.id)).forEach((item) => {
    const position = transformPoint({ x: item.x, y: item.y }, normalizedTransform);
    item.x = position.x;
    item.y = position.y;
    item.width = Math.max(10, item.width * scale);
    item.height = Math.max(10, item.height * scale);
    item.rotation = snapAngle(item.rotation + transform.rotation);
  });
  document.map.zones.filter((item) => selectedIds.has(item.id)).forEach((item) => {
    const position = transformPoint({ x: item.x, y: item.y }, normalizedTransform);
    item.x = position.x;
    item.y = position.y;
    item.width = Math.max(10, item.width * scale);
    item.height = Math.max(10, item.height * scale);
    item.rotation = snapAngle(item.rotation + transform.rotation);
  });
  document.map.decorations.filter((item) => selectedIds.has(item.id)).forEach((item) => {
    item.position = transformPoint(item.position, normalizedTransform);
    item.width = Math.max(10, item.width * scale);
    item.height = Math.max(10, item.height * scale);
    item.rotation = snapAngle(item.rotation + transform.rotation);
  });
  document.map.markers.filter((item) => selectedIds.has(item.id)).forEach((item) => {
    item.position = transformPoint(item.position, normalizedTransform);
    item.width = Math.max(10, item.width * scale);
    item.height = Math.max(10, item.height * scale);
  });
  document.map.gates.filter((item) => selectedIds.has(item.id)).forEach((item) => {
    item.position = transformPoint(item.position, normalizedTransform);
    item.width = Math.max(10, item.width * scale);
    item.rotation = snapAngle(item.rotation + transform.rotation);
  });
  document.map.paths.filter((item) => selectedIds.has(item.id)).forEach((item) => {
    const anchors = getPathAnchors(item).map((anchor) => ({
      ...anchor,
      ...transformPoint(anchor, normalizedTransform),
      handleIn: anchor.handleIn ? transformPoint(anchor.handleIn, normalizedTransform) : undefined,
      handleOut: anchor.handleOut ? transformPoint(anchor.handleOut, normalizedTransform) : undefined,
    }));
    Object.assign(item, syncPathGeometry(anchors));
    item.width = Math.max(1, item.width * scale);
  });
  document.map.palisades.filter((item) => selectedIds.has(item.id)).forEach((item) => {
    item.center = transformPoint(item.center, normalizedTransform);
    item.rotation = snapAngle(item.rotation + transform.rotation);
    item.thickness = Math.max(1, item.thickness * scale);
    item.segments = item.segments.map((segment) => transformPalisadeSegment(segment, scale));
  });
}
