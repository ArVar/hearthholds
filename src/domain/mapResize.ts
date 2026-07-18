import type { EditorDocument, Point } from "./types";

export const mapResizeAnchors = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;

export type MapResizeAnchor = (typeof mapResizeAnchors)[number];

const anchorFactors: Record<MapResizeAnchor, Point> = {
  "top-left": { x: 0, y: 0 },
  "top-center": { x: 0.5, y: 0 },
  "top-right": { x: 1, y: 0 },
  "middle-left": { x: 0, y: 0.5 },
  center: { x: 0.5, y: 0.5 },
  "middle-right": { x: 1, y: 0.5 },
  "bottom-left": { x: 0, y: 1 },
  "bottom-center": { x: 0.5, y: 1 },
  "bottom-right": { x: 1, y: 1 },
};

function translatePoint(point: Point, offset: Point): Point {
  return { x: point.x + offset.x, y: point.y + offset.y };
}

export function resizeDocumentMap(
  document: EditorDocument,
  dimensions: Partial<Pick<EditorDocument["map"], "width" | "height">>,
  anchor: MapResizeAnchor,
): void {
  const width = Math.max(1, dimensions.width ?? document.map.width);
  const height = Math.max(1, dimensions.height ?? document.map.height);
  const factor = anchorFactors[anchor];
  const offset = {
    x: (width - document.map.width) * factor.x,
    y: (height - document.map.height) * factor.y,
  };

  document.map.width = width;
  document.map.height = height;

  if (offset.x === 0 && offset.y === 0) return;

  for (const building of document.map.buildings) {
    building.x += offset.x;
    building.y += offset.y;
  }
  for (const palisade of document.map.palisades) {
    palisade.center = translatePoint(palisade.center, offset);
  }
  for (const gate of document.map.gates) {
    gate.position = translatePoint(gate.position, offset);
  }
  for (const zone of document.map.zones) {
    zone.x += offset.x;
    zone.y += offset.y;
  }
  for (const path of document.map.paths) {
    path.points = path.points.map((coordinate, index) =>
      coordinate + (index % 2 === 0 ? offset.x : offset.y),
    );
    path.anchors = path.anchors?.map((pathAnchor) => ({
      ...pathAnchor,
      x: pathAnchor.x + offset.x,
      y: pathAnchor.y + offset.y,
      handleIn: pathAnchor.handleIn
        ? translatePoint(pathAnchor.handleIn, offset)
        : undefined,
      handleOut: pathAnchor.handleOut
        ? translatePoint(pathAnchor.handleOut, offset)
        : undefined,
    }));
  }
  for (const marker of document.map.markers) {
    marker.position = translatePoint(marker.position, offset);
  }
  for (const decoration of document.map.decorations) {
    decoration.position = translatePoint(decoration.position, offset);
  }
  for (const stroke of document.map.terrainStrokes) {
    stroke.points = stroke.points.map((coordinate, index) =>
      coordinate + (index % 2 === 0 ? offset.x : offset.y),
    );
  }
}
