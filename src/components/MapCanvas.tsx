import Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { Maximize2, Minus, Plus, Spline, Square, Trash2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Circle,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Shape,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import {
  arcSweepRadians,
  canRemovePalisadeJunction,
  canSetPalisadeJunctionMode,
  degreesToRadians,
  findClosestPalisadeSegment,
  getPalisadeJunctionHandles,
  getPalisadeJunctionMode,
  movePalisadeJunctionHandle,
  palisadeBezierPoint,
  removePalisadeJunction,
  segmentLength,
  setPalisadeJunctionMode,
  snapAngle,
  splitPalisadeSegment,
} from "../domain/geometry";
import {
  cubicBezierPoint,
  findClosestPathSegment,
  getPathAnchors,
  movePathAnchor,
  movePathHandle,
  removePathAnchor,
  setPathAnchorMode,
  splitPathSegment,
  syncPathGeometry,
  translatePathAnchors,
} from "../domain/pathGeometry";
import {
  getOrderedLayerObjects,
  getSceneObjects,
  isSceneObjectLocked,
  isSceneObjectVisible,
} from "../domain/scene";
import {
  getSceneSelectionBounds,
  getSelectableObjectBounds,
  sceneBoundsIntersect,
  type SceneBounds,
} from "../domain/sceneGeometry";
import { terrainStyles } from "../domain/terrain";
import { constructionStages, defaultGridAppearance } from "../domain/types";
import type {
  ArcSegment,
  Building,
  Gate,
  MapDecoration,
  MapMarker,
  MapPath,
  MapZone,
  Palisade,
  PalisadeNodeMode,
  PalisadeSegment,
  PathAnchor,
  Point,
  TerrainStroke,
} from "../domain/types";
import {
  getBuildingDisplayStage,
  getBuildingDisplayVisualAssetId,
  getVisualAsset,
} from "../domain/visualAssets";
import { useI18n } from "../i18n/I18nProvider";
import { useEditorStore } from "../store/editorStore";
import { BuildingArtwork } from "./BuildingArtwork";
import { IconButton } from "./IconButton";

const MAP_BACKGROUND = "#69704a";
const PALISADE_DARK = "#5f4634";
const PALISADE_LIGHT = "#a97748";

type Viewport = {
  x: number;
  y: number;
  scale: number;
};

type MarqueeSelection = {
  start: Point;
  current: Point;
  baseIds: string[];
};

function getSelectionMode(event: KonvaEventObject<Event>): "replace" | "toggle" {
  const nativeEvent = event.evt as Event & {
    shiftKey?: boolean;
    metaKey?: boolean;
    ctrlKey?: boolean;
  };
  return nativeEvent.shiftKey || nativeEvent.metaKey || nativeEvent.ctrlKey
    ? "toggle"
    : "replace";
}

type RightPan = {
  clientX: number;
  clientY: number;
  viewport: Viewport;
  moved: boolean;
};

type CanvasContextTarget =
  | { kind: "path-anchor"; pathId: string; anchorIndex: number }
  | { kind: "path-segment"; pathId: string; segmentIndex: number; amount: number }
  | { kind: "palisade-junction"; palisadeId: string; junction: Point }
  | {
      kind: "palisade-segment";
      palisadeId: string;
      segmentIndex: number;
      amount: number;
      point: Point;
    };

type CanvasContextMenu = CanvasContextTarget & { left: number; top: number };

type OpenCanvasContextMenu = (
  target: CanvasContextTarget,
  event: KonvaEventObject<PointerEvent>,
) => void;

function snapCoordinate(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

function MapGridLine({
  points,
  major,
  color,
  opacity,
}: {
  points: number[];
  major: boolean;
  color: string;
  opacity: number;
}) {
  return (
    <Line
      points={points}
      stroke={color}
      strokeWidth={major ? 2.1 : 1.1}
      strokeScaleEnabled={false}
      opacity={opacity * (major ? 1 : 0.68)}
      perfectDrawEnabled={false}
      listening={false}
    />
  );
}

function TerrainStrokeArtwork({ stroke }: { stroke: TerrainStroke }) {
  const style = terrainStyles[stroke.type];
  return (
    <Group listening={false}>
      <Line
        points={stroke.points}
        stroke={style.edge}
        strokeWidth={stroke.width * 1.08}
        opacity={style.opacity * 0.42}
        lineCap="round"
        lineJoin="round"
        tension={0.18}
      />
      <Line
        points={stroke.points}
        stroke={style.color}
        strokeWidth={stroke.width}
        opacity={style.opacity}
        lineCap="round"
        lineJoin="round"
        tension={0.18}
      />
      <Line
        points={stroke.points}
        stroke={style.detail}
        strokeWidth={Math.max(2, stroke.width * 0.12)}
        dash={[stroke.width * 0.32, stroke.width * 0.42]}
        opacity={0.24}
        lineCap="round"
        lineJoin="round"
        tension={0.18}
      />
    </Group>
  );
}

function pointsMatch(left: Point, right: Point, tolerance = 0.5): boolean {
  return Math.abs(left.x - right.x) <= tolerance && Math.abs(left.y - right.y) <= tolerance;
}

function arcPoint(arc: ArcSegment, endpoint: "start" | "end"): Point {
  const angle = degreesToRadians(endpoint === "start" ? arc.startAngle : arc.endAngle);
  return {
    x: arc.center.x + Math.cos(angle) * arc.radius,
    y: arc.center.y + Math.sin(angle) * arc.radius,
  };
}

function replaceSegmentJunctions(
  segments: PalisadeSegment[],
  previous: Point,
  next: Point,
): PalisadeSegment[] {
  const delta = { x: next.x - previous.x, y: next.y - previous.y };
  return segments.map((segment) => {
    if (segment.kind === "arc") return segment;
    const fromMatches = pointsMatch(segment.from, previous);
    const toMatches = pointsMatch(segment.to, previous);
    if (segment.kind === "line") {
      return {
        ...segment,
        from: fromMatches ? next : segment.from,
        to: toMatches ? next : segment.to,
      };
    }
    return {
      ...segment,
      from: fromMatches ? next : segment.from,
      to: toMatches ? next : segment.to,
      handleFrom: fromMatches
        ? { x: segment.handleFrom.x + delta.x, y: segment.handleFrom.y + delta.y }
        : segment.handleFrom,
      handleTo: toMatches
        ? { x: segment.handleTo.x + delta.x, y: segment.handleTo.y + delta.y }
        : segment.handleTo,
    };
  });
}

function movePalisadeJunction(
  segments: PalisadeSegment[],
  previous: Point,
  requested: Point,
): PalisadeSegment[] {
  const connectedArc = segments.find(
    (segment): segment is ArcSegment =>
      segment.kind === "arc" &&
      (pointsMatch(arcPoint(segment, "start"), previous) ||
        pointsMatch(arcPoint(segment, "end"), previous)),
  );
  const target = connectedArc
    ? (() => {
        const angle = Math.atan2(
          requested.y - connectedArc.center.y,
          requested.x - connectedArc.center.x,
        );
        return {
          x: connectedArc.center.x + Math.cos(angle) * connectedArc.radius,
          y: connectedArc.center.y + Math.sin(angle) * connectedArc.radius,
        };
      })()
    : requested;

  return replaceSegmentJunctions(
    segments.map((segment) => {
      if (segment.kind !== "arc") return segment;
      const startMatches = pointsMatch(arcPoint(segment, "start"), previous);
      const endMatches = pointsMatch(arcPoint(segment, "end"), previous);
      if (!startMatches && !endMatches) return segment;
      const angle = (Math.atan2(target.y - segment.center.y, target.x - segment.center.x) * 180) /
        Math.PI;
      return {
        ...segment,
        startAngle: startMatches ? angle : segment.startAngle,
        endAngle: endMatches ? angle : segment.endAngle,
      };
    }),
    previous,
    target,
  );
}

function uniquePalisadeJunctions(segments: PalisadeSegment[]): Point[] {
  const candidates = segments.flatMap((segment) =>
    segment.kind === "arc"
      ? [arcPoint(segment, "start"), arcPoint(segment, "end")]
      : [segment.from, segment.to],
  );
  return candidates.filter(
    (candidate, index) =>
      candidates.findIndex((other) => pointsMatch(candidate, other)) === index,
  );
}

function useRasterImage(source: string | undefined) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!source) {
      setImage(null);
      return;
    }
    const element = new window.Image();
    element.onload = () => setImage(element);
    element.src = source;
    return () => {
      element.onload = null;
    };
  }, [source]);

  return image;
}

function BuildingNode({
  building,
  mapScale,
  controlsOnly = false,
}: {
  building: Building;
  mapScale: number;
  controlsOnly?: boolean;
}) {
  const groupRef = useRef<Konva.Group>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const selectedId = useEditorStore((state) => state.selectedId);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const locked = useEditorStore((state) =>
    isSceneObjectLocked(state.document, building.id),
  );
  const snapEnabled = useEditorStore((state) => state.snapEnabled);
  const gridSize = useEditorStore((state) => state.document.map.grid.size);
  const labelsVisible = useEditorStore((state) => state.visibleLayers.labels);
  const select = useEditorStore((state) => state.select);
  const updateBuilding = useEditorStore((state) => state.updateBuilding);
  const nudgeSelected = useEditorStore((state) => state.nudgeSelected);
  const projectStage = useEditorStore((state) =>
    state.document.projects.find(
      (project) => project.buildingId === building.id,
    )?.currentStage,
  );
  const displayStage = getBuildingDisplayStage(building, projectStage);
  const displayVisualAssetId = getBuildingDisplayVisualAssetId(building, projectStage);
  const constructionStageIndex = displayStage
    ? constructionStages.indexOf(displayStage)
    : undefined;
  const selected = selectedIds.includes(building.id);
  const primarySelected = selectedId === building.id;

  useEffect(() => {
    if (!transformerRef.current || !groupRef.current) return;
    transformerRef.current.nodes(selected ? [groupRef.current] : []);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selected]);

  const onDragEnd = (event: KonvaEventObject<DragEvent>) => {
    const rawX = event.target.x();
    const rawY = event.target.y();
    const x = snapEnabled ? snapCoordinate(rawX, gridSize) : rawX;
    const y = snapEnabled ? snapCoordinate(rawY, gridSize) : rawY;
    event.target.position({ x, y });
    if (selectedIds.length > 1 && selected) {
      nudgeSelected({ x: x - building.x, y: y - building.y });
    } else {
      updateBuilding(building.id, { x, y });
    }
  };

  const onTransformEnd = () => {
    const node = groupRef.current;
    if (!node) return;
    const rotation = snapAngle(node.rotation());
    const scale = Math.max(Math.abs(node.scaleX()), Math.abs(node.scaleY()));
    const aspectRatio = building.width / building.height;
    let width = Math.max(
      10,
      snapEnabled
        ? snapCoordinate(building.width * scale, gridSize)
        : building.width * scale,
    );
    let height = width / aspectRatio;
    if (height < 10) {
      height = 10;
      width = height * aspectRatio;
    }
    const x = snapEnabled ? snapCoordinate(node.x(), gridSize) : node.x();
    const y = snapEnabled ? snapCoordinate(node.y(), gridSize) : node.y();
    node.scale({ x: 1, y: 1 });
    node.position({ x, y });
    node.rotation(rotation);
    updateBuilding(building.id, { x, y, rotation, width, height });
  };

  return (
    <>
      <Group
        ref={groupRef}
        x={building.x}
        y={building.y}
        rotation={building.rotation}
        draggable={!controlsOnly && !locked}
        listening={!controlsOnly && !locked}
        onClick={controlsOnly ? undefined : (event) => {
          event.cancelBubble = true;
          select(building.id, getSelectionMode(event));
        }}
        onTap={controlsOnly ? undefined : (event) => {
          event.cancelBubble = true;
          select(building.id, getSelectionMode(event));
        }}
        onDragStart={controlsOnly ? undefined : () => {
          if (!selected) select(building.id);
        }}
        onDragEnd={controlsOnly ? undefined : onDragEnd}
        onTransformEnd={onTransformEnd}
      >
        {controlsOnly ? (
          <Rect
            x={-building.width / 2}
            y={-building.height / 2}
            width={building.width}
            height={building.height}
            fill="rgba(255,255,255,0.001)"
            listening={false}
          />
        ) : (
          <BuildingArtwork
            building={building}
            selected={selected}
            overrideAssetId={displayVisualAssetId}
          />
        )}

        {!controlsOnly && building.status === "construction" && (
          <Group
            x={building.width / 2 - 8}
            y={-building.height / 2 + 8}
            rotation={-building.rotation}
            listening={false}
          >
            <Circle radius={13} fill="#d1892f" stroke="#ffffff" strokeWidth={2} />
            <Text
              x={-8}
              y={-7}
              width={16}
              text={String((constructionStageIndex ?? 0) + 1)}
              align="center"
              fontFamily="Inter, system-ui, sans-serif"
              fontSize={12}
              fontStyle="bold"
              fill="#ffffff"
            />
          </Group>
        )}
      </Group>
      {!controlsOnly && labelsVisible && (
        <Group
          x={building.x}
          y={building.y + building.height / 2 + 13}
          listening={false}
        >
          <Text
            x={-96}
            width={192}
            text={building.name}
            align="center"
            fontFamily="Inter, system-ui, sans-serif"
            fontSize={14}
            fontStyle="bold"
            fill="#263437"
          />
          {mapScale >= 0.68 && (
            <Text
              x={-106}
              y={18}
              width={212}
              text={building.subtitle}
              align="center"
              fontFamily="Inter, system-ui, sans-serif"
              fontSize={11}
              fill="#536366"
            />
          )}
        </Group>
      )}
      {primarySelected && controlsOnly && !locked && (
        <Transformer
          ref={transformerRef}
          resizeEnabled
          rotateEnabled
          enabledAnchors={[
            "top-left",
            "top-right",
            "bottom-left",
            "bottom-right",
          ]}
          keepRatio
          boundBoxFunc={(previous, next) =>
            Math.abs(next.width) < 10 || Math.abs(next.height) < 10 ? previous : next
          }
          rotationSnaps={Array.from({ length: 24 }, (_, index) => index * 15)}
          rotationSnapTolerance={7}
          rotateAnchorOffset={34}
          anchorSize={10}
          anchorFill="#ffffff"
          anchorStroke="#167f86"
          borderStroke="#167f86"
          borderStrokeWidth={2}
        />
      )}
    </>
  );
}

function MapMarkerNode({
  marker,
  image,
  labelsVisible,
  selected,
  locked,
  onSelect,
  onMove,
}: {
  marker: MapMarker;
  image: HTMLImageElement | null;
  labelsVisible: boolean;
  selected: boolean;
  locked: boolean;
  onSelect: (mode?: "replace" | "toggle") => void;
  onMove: (position: Point) => void;
}) {
  const { x, y } = marker.position;
  const imageWidth = marker.width;
  const imageHeight = marker.height;

  return (
    <Group
      x={x}
      y={y}
      draggable={!locked}
      listening={!locked}
      onClick={(event) => {
        event.cancelBubble = true;
        onSelect(getSelectionMode(event));
      }}
      onTap={(event) => {
        event.cancelBubble = true;
        onSelect(getSelectionMode(event));
      }}
      onDragStart={() => {
        if (!selected) onSelect();
      }}
      onDragEnd={(event) => onMove(event.target.position())}
    >
      <Rect
        x={-imageWidth / 2}
        y={-imageHeight / 2}
        width={imageWidth}
        height={imageHeight}
        fill="rgba(255,255,255,0.001)"
        stroke={selected ? "#167f86" : undefined}
        strokeWidth={2}
        dash={[7, 4]}
        cornerRadius={5}
      />
      {image ? (
        <KonvaImage
          image={image}
          x={-imageWidth / 2}
          y={-imageHeight / 2}
          width={imageWidth}
          height={imageHeight}
        />
      ) : marker.type === "well" ? (
        <>
          <Circle radius={20} fill="#b8aaa0" stroke="#57504b" strokeWidth={3} />
          <Circle radius={13} fill="#477f91" stroke="#d5cbc2" strokeWidth={4} />
          <Line points={[-22, -19, 22, -19]} stroke="#5b4232" strokeWidth={5} />
          <Line points={[-15, -20, -15, 10]} stroke="#694b36" strokeWidth={4} />
          <Line points={[15, -20, 15, 10]} stroke="#694b36" strokeWidth={4} />
        </>
      ) : (
        <>
          {Array.from({ length: 9 }, (_, index) => {
            const angle = (index / 9) * Math.PI * 2;
            return (
              <Circle
                key={index}
                x={Math.cos(angle) * 17}
                y={Math.sin(angle) * 17}
                radius={5}
                fill="#77716b"
                stroke="#4c4844"
                strokeWidth={1}
              />
            );
          })}
          <Circle radius={12} fill="#d97b2d" />
          <Circle x={3} y={-3} radius={6} fill="#f2c24c" />
        </>
      )}
      {labelsVisible && (
        <Text
          x={-70}
          y={marker.type === "well" ? 34 : 38}
          width={140}
          text={marker.name}
          align="center"
          fontFamily="Inter, system-ui, sans-serif"
          fontSize={11}
          fontStyle="bold"
          fill="#344143"
        />
      )}
    </Group>
  );
}

function MapDecorationNode({
  decoration,
  selected,
  locked,
  snapEnabled,
  gridSize,
  onSelect,
  onChange,
  controlsOnly = false,
}: {
  decoration: MapDecoration;
  selected: boolean;
  locked: boolean;
  snapEnabled: boolean;
  gridSize: number;
  onSelect: (mode?: "replace" | "toggle") => void;
  onChange: (changes: Partial<MapDecoration>) => void;
  controlsOnly?: boolean;
}) {
  const groupRef = useRef<Konva.Group>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const image = useRasterImage(getVisualAsset(decoration.assetId)?.albedoUrl);

  useEffect(() => {
    if (!transformerRef.current || !groupRef.current) return;
    transformerRef.current.nodes(selected ? [groupRef.current] : []);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selected]);

  const onTransformEnd = () => {
    const node = groupRef.current;
    if (!node) return;
    const scale = Math.max(Math.abs(node.scaleX()), Math.abs(node.scaleY()));
    const aspectRatio = decoration.width / decoration.height;
    let width = Math.max(
      10,
      snapEnabled
        ? snapCoordinate(decoration.width * scale, gridSize)
        : decoration.width * scale,
    );
    let height = width / aspectRatio;
    if (height < 10) {
      height = 10;
      width = height * aspectRatio;
    }
    const x = snapEnabled ? snapCoordinate(node.x(), gridSize) : node.x();
    const y = snapEnabled ? snapCoordinate(node.y(), gridSize) : node.y();
    const rotation = snapAngle(node.rotation());
    node.scale({ x: 1, y: 1 });
    node.position({ x, y });
    node.rotation(rotation);
    onChange({ position: { x, y }, width, height, rotation });
  };

  return (
    <>
      <Group
        ref={groupRef}
        x={decoration.position.x}
        y={decoration.position.y}
        rotation={decoration.rotation}
        draggable={!controlsOnly && !locked}
        listening={!controlsOnly && !locked}
        onClick={controlsOnly ? undefined : (event) => {
          event.cancelBubble = true;
          onSelect(getSelectionMode(event));
        }}
        onTap={controlsOnly ? undefined : (event) => {
          event.cancelBubble = true;
          onSelect(getSelectionMode(event));
        }}
        onDragStart={controlsOnly ? undefined : () => {
          if (!selected) onSelect();
        }}
        onDragEnd={controlsOnly ? undefined : (event) => {
          const position = event.target.position();
          const x = snapEnabled ? snapCoordinate(position.x, gridSize) : position.x;
          const y = snapEnabled ? snapCoordinate(position.y, gridSize) : position.y;
          event.target.position({ x, y });
          onChange({ position: { x, y } });
        }}
        onTransformEnd={onTransformEnd}
      >
        {!controlsOnly && image && (
          <KonvaImage
            image={image}
            x={-decoration.width / 2}
            y={-decoration.height / 2}
            width={decoration.width}
            height={decoration.height}
            listening={false}
          />
        )}
        <Rect
          x={-decoration.width / 2}
          y={-decoration.height / 2}
          width={decoration.width}
          height={decoration.height}
          fill="rgba(255,255,255,0.001)"
          stroke={!controlsOnly && selected ? "#167f86" : undefined}
          strokeWidth={2}
          dash={[7, 4]}
          cornerRadius={5}
        />
      </Group>
      {selected && controlsOnly && !locked && (
        <Transformer
          ref={transformerRef}
          resizeEnabled
          rotateEnabled
          enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
          keepRatio
          boundBoxFunc={(previous, next) =>
            Math.abs(next.width) < 10 || Math.abs(next.height) < 10 ? previous : next
          }
          rotationSnaps={Array.from({ length: 24 }, (_, index) => index * 15)}
          rotationSnapTolerance={7}
          rotateAnchorOffset={34}
          anchorSize={10}
          anchorFill="#ffffff"
          anchorStroke="#167f86"
          borderStroke="#167f86"
          borderStrokeWidth={2}
        />
      )}
    </>
  );
}

function seededValue(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43_758.5453;
  return value - Math.floor(value);
}

function ForestCanopy({ zone, image }: { zone: MapZone; image: HTMLImageElement }) {
  const seed = [...zone.id].reduce((total, character) => total + character.charCodeAt(0), 0);
  const count = Math.max(
    2,
    Math.round(((zone.width * zone.height) / 2_200) * (zone.density ?? 1)),
  );
  const cellWidth = image.naturalWidth / 3;
  const cellHeight = image.naturalHeight / 2;

  return (
    <>
      {Array.from({ length: count }, (_, index) => {
        const x = (seededValue(seed + index * 7) - 0.5) * Math.max(20, zone.width - 34);
        const y = (seededValue(seed + index * 11) - 0.5) * Math.max(20, zone.height - 34);
        const size = 52 + seededValue(seed + index * 17) * 38;
        const variant = Math.floor(seededValue(seed + index * 23) * 6);
        return (
          <Group key={`${zone.id}-tree-${index}`} listening={false}>
            <Circle
              x={x + size * 0.08}
              y={y + size * 0.18}
              radius={size * 0.34}
              scaleY={0.62}
              fill="#1d2b20"
              opacity={0.2}
              shadowColor="#18221a"
              shadowBlur={8}
            />
            <KonvaImage
              image={image}
              crop={{
                x: (variant % 3) * cellWidth,
                y: Math.floor(variant / 3) * cellHeight,
                width: cellWidth,
                height: cellHeight,
              }}
              x={x - size / 2}
              y={y - size / 2}
              width={size}
              height={size}
              rotation={Math.round(seededValue(seed + index * 31) * 12) * 30}
              opacity={0.98}
            />
          </Group>
        );
      })}
    </>
  );
}

function MapZoneNode({
  zone,
  selected,
  labelsVisible,
  snapEnabled,
  gridSize,
  wheatFieldImage,
  treeAtlasImage,
  locked,
  onSelect,
  onChange,
  controlsOnly = false,
}: {
  zone: MapZone;
  selected: boolean;
  labelsVisible: boolean;
  snapEnabled: boolean;
  gridSize: number;
  wheatFieldImage: HTMLImageElement | null;
  treeAtlasImage: HTMLImageElement | null;
  locked: boolean;
  onSelect: (mode?: "replace" | "toggle") => void;
  onChange: (changes: Partial<MapZone>) => void;
  controlsOnly?: boolean;
}) {
  const groupRef = useRef<Konva.Group>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (!transformerRef.current || !groupRef.current) return;
    transformerRef.current.nodes(selected ? [groupRef.current] : []);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selected]);

  const onTransformEnd = () => {
    const node = groupRef.current;
    if (!node) return;
    const rawWidth = zone.width * Math.abs(node.scaleX());
    const rawHeight = zone.height * Math.abs(node.scaleY());
    const width = Math.max(20, snapEnabled ? snapCoordinate(rawWidth, gridSize) : rawWidth);
    const height = Math.max(20, snapEnabled ? snapCoordinate(rawHeight, gridSize) : rawHeight);
    const x = snapEnabled ? snapCoordinate(node.x(), gridSize) : node.x();
    const y = snapEnabled ? snapCoordinate(node.y(), gridSize) : node.y();
    const rotation = snapAngle(node.rotation());
    node.scale({ x: 1, y: 1 });
    node.position({ x, y });
    node.rotation(rotation);
    onChange({ x, y, width, height, rotation });
  };

  return (
    <>
      <Group
        ref={groupRef}
        x={zone.x}
        y={zone.y}
        rotation={zone.rotation}
        draggable={!controlsOnly && !locked}
        listening={!controlsOnly && !locked}
        onClick={controlsOnly ? undefined : (event) => {
          event.cancelBubble = true;
          onSelect(getSelectionMode(event));
        }}
        onTap={controlsOnly ? undefined : (event) => {
          event.cancelBubble = true;
          onSelect(getSelectionMode(event));
        }}
        onDragStart={controlsOnly ? undefined : () => {
          if (!selected) onSelect();
        }}
        onDragEnd={controlsOnly ? undefined : (event) => {
          const position = event.target.position();
          const x = snapEnabled ? snapCoordinate(position.x, gridSize) : position.x;
          const y = snapEnabled ? snapCoordinate(position.y, gridSize) : position.y;
          event.target.position({ x, y });
          onChange({ x, y });
        }}
        onTransformEnd={onTransformEnd}
      >
        {controlsOnly ? (
          <Rect
            x={-zone.width / 2}
            y={-zone.height / 2}
            width={zone.width}
            height={zone.height}
            fill="rgba(255,255,255,0.001)"
            listening={false}
          />
        ) : (
          <>
        <Rect
          x={-zone.width / 2}
          y={-zone.height / 2}
          width={zone.width}
          height={zone.height}
          fill={zone.color}
          opacity={zone.type === "forest" ? 0.28 : zone.type === "property" ? 0.14 : 0.12}
          stroke={selected ? "#167f86" : zone.color}
          strokeWidth={selected ? 3 : 2}
          dash={selected ? [7, 4] : zone.type === "forest" ? undefined : [9, 5]}
          cornerRadius={zone.type === "forest" ? 22 : 2}
        />
        {zone.type === "field" && wheatFieldImage && (
          <KonvaImage
            image={wheatFieldImage}
            x={-zone.width * 0.59}
            y={-zone.height * 0.62}
            width={zone.width * 1.18}
            height={zone.height * 1.24}
          />
        )}
        {zone.type === "property" && (
          <>
            <Rect
              x={-zone.width / 2}
              y={-zone.height / 2}
              width={zone.width}
              height={zone.height}
              stroke="#64472f"
              strokeWidth={4}
              cornerRadius={2}
            />
            <Line
              points={[0, -zone.height / 2, 0, zone.height / 2]}
              stroke="#775639"
              strokeWidth={3}
              dash={[18, 7]}
            />
            {Array.from({ length: 22 }, (_, index) => {
              const horizontal = index < 14;
              const sideIndex = horizontal ? index % 7 : (index - 14) % 4;
              const secondSide = horizontal ? index >= 7 : index >= 18;
              const x = horizontal
                ? -zone.width / 2 + (sideIndex / 6) * zone.width
                : secondSide ? zone.width / 2 : -zone.width / 2;
              const y = horizontal
                ? secondSide ? zone.height / 2 : -zone.height / 2
                : -zone.height / 2 + (sideIndex / 3) * zone.height;
              return (
                <Circle
                  key={index}
                  x={x}
                  y={y}
                  radius={4}
                  fill="#775033"
                  stroke="#4d3828"
                  strokeWidth={1}
                />
              );
            })}
          </>
        )}
        {zone.type === "forest" && treeAtlasImage && (
          <ForestCanopy zone={zone} image={treeAtlasImage} />
        )}
        {labelsVisible && zone.type !== "forest" && (
          <Text
            x={-zone.width / 2}
            y={zone.height / 2 + 9}
            width={zone.width}
            text={zone.name}
            align="center"
            fontFamily="Inter, system-ui, sans-serif"
            fontSize={12}
            fontStyle="bold"
            fill="#3c4a43"
          />
        )}
          </>
        )}
      </Group>
      {selected && controlsOnly && !locked && (
        <Transformer
          ref={transformerRef}
          resizeEnabled
          rotateEnabled
          keepRatio={false}
          enabledAnchors={[
            "top-left",
            "top-center",
            "top-right",
            "middle-left",
            "middle-right",
            "bottom-left",
            "bottom-center",
            "bottom-right",
          ]}
          boundBoxFunc={(previous, next) =>
            Math.abs(next.width) < 20 || Math.abs(next.height) < 20 ? previous : next
          }
          rotationSnaps={Array.from({ length: 24 }, (_, index) => index * 15)}
          rotationSnapTolerance={7}
          rotateAnchorOffset={34}
          anchorSize={10}
          anchorFill="#ffffff"
          anchorStroke="#167f86"
          borderStroke="#167f86"
          borderStrokeWidth={2}
        />
      )}
    </>
  );
}

function BridgeArtwork({ path, image }: { path: MapPath; image: HTMLImageElement | null }) {
  const [startX, startY] = path.points;
  const endX = path.points.at(-2) ?? startX;
  const endY = path.points.at(-1) ?? startY;
  const length = Math.hypot(endX - startX, endY - startY);
  const angle = (Math.atan2(endY - startY, endX - startX) * 180) / Math.PI;

  if (!image) {
    return (
      <Group listening={false}>
        <Line points={path.points} stroke="#4f3b2d" strokeWidth={path.width + 8} />
        <Line points={path.points} stroke={path.color} strokeWidth={path.width} dash={[5, 4]} />
      </Group>
    );
  }

  return (
    <Group
      x={(startX + endX) / 2}
      y={(startY + endY) / 2}
      rotation={angle - 90}
      listening={false}
    >
      <KonvaImage
        image={image}
        x={-(path.width * 1.9) / 2}
        y={-(length * 1.16) / 2}
        width={path.width * 1.9}
        height={length * 1.16}
      />
    </Group>
  );
}

function PathNode({
  path,
  bridgeImage,
  riverTexture,
  roadTexture,
  onOpenContextMenu,
  controlsOnly = false,
}: {
  path: MapPath;
  bridgeImage: HTMLImageElement | null;
  riverTexture: HTMLImageElement | null;
  roadTexture: HTMLImageElement | null;
  onOpenContextMenu: OpenCanvasContextMenu;
  controlsOnly?: boolean;
}) {
  const groupRef = useRef<Konva.Group>(null);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const locked = useEditorStore((state) =>
    isSceneObjectLocked(state.document, path.id),
  );
  const selectedAnchorIndex = useEditorStore((state) => state.selectedPathAnchorIndex);
  const snapEnabled = useEditorStore((state) => state.snapEnabled);
  const gridSize = useEditorStore((state) => state.document.map.grid.size);
  const select = useEditorStore((state) => state.select);
  const selectPathAnchor = useEditorStore((state) => state.selectPathAnchor);
  const updatePath = useEditorStore((state) => state.updatePath);
  const nudgeSelected = useEditorStore((state) => state.nudgeSelected);
  const selected = selectedIds.includes(path.id);
  const [previewAnchors, setPreviewAnchors] = useState(() => getPathAnchors(path));

  useEffect(() => setPreviewAnchors(getPathAnchors(path)), [path]);

  const drawPath = useCallback(
    (context: Konva.Context, shape: Konva.Shape) => {
      const first = previewAnchors[0];
      if (!first) return;
      context.beginPath();
      context.moveTo(first.x, first.y);
      for (let index = 0; index < previewAnchors.length - 1; index += 1) {
        const start = previewAnchors[index];
        const end = previewAnchors[index + 1];
        const out = start.handleOut ?? start;
        const incoming = end.handleIn ?? end;
        context.bezierCurveTo(out.x, out.y, incoming.x, incoming.y, end.x, end.y);
      }
      context.strokeShape(shape);
    },
    [previewAnchors],
  );

  const drawTexturedPath = useCallback(
    (context: Konva.Context, texture: HTMLImageElement, opacity: number) => {
      const first = previewAnchors[0];
      if (!first) return;
      context.save();
      context.beginPath();
      context.moveTo(first.x, first.y);
      for (let index = 0; index < previewAnchors.length - 1; index += 1) {
        const start = previewAnchors[index];
        const end = previewAnchors[index + 1];
        const out = start.handleOut ?? start;
        const incoming = end.handleIn ?? end;
        context.bezierCurveTo(out.x, out.y, incoming.x, incoming.y, end.x, end.y);
      }
      context.strokeStyle = context.createPattern(texture, "repeat") ?? path.color;
      context.lineWidth = path.width;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.globalAlpha = opacity;
      context.stroke();
      context.restore();
    },
    [path.color, path.width, previewAnchors],
  );

  const commitAnchors = (anchors: PathAnchor[]) => {
    setPreviewAnchors(anchors);
    updatePath(path.id, syncPathGeometry(anchors));
  };

  const onGroupDragEnd = (event: KonvaEventObject<DragEvent>) => {
    if (event.target !== event.currentTarget) return;
    const deltaX = event.target.x();
    const deltaY = event.target.y();
    event.target.position({ x: 0, y: 0 });
    if (selectedIds.length > 1 && selected) {
      nudgeSelected({ x: deltaX, y: deltaY });
    } else {
      commitAnchors(translatePathAnchors(previewAnchors, { x: deltaX, y: deltaY }));
    }
  };

  const bridgePath = {
    ...path,
    points: previewAnchors.flatMap((anchor) => [anchor.x, anchor.y]),
  };
  const activeAnchor =
    selectedAnchorIndex === null ? undefined : previewAnchors[selectedAnchorIndex];

  return (
    <Group
      ref={groupRef}
      draggable={selected && !controlsOnly && !locked}
      listening={!locked || controlsOnly}
      onClick={controlsOnly ? undefined : (event) => {
        event.cancelBubble = true;
        select(path.id, getSelectionMode(event));
      }}
      onTap={controlsOnly ? undefined : (event) => {
        event.cancelBubble = true;
        select(path.id, getSelectionMode(event));
      }}
      onDragStart={controlsOnly ? undefined : () => {
        if (!selected) select(path.id);
      }}
      onDragEnd={controlsOnly ? undefined : onGroupDragEnd}
      onContextMenu={controlsOnly || locked ? undefined : (event) => {
        event.evt.preventDefault();
        event.cancelBubble = true;
        const pointer = groupRef.current?.getRelativePointerPosition();
        const hit = pointer ? findClosestPathSegment(previewAnchors, pointer) : null;
        if (!hit) return;
        onOpenContextMenu(
          {
            kind: "path-segment",
            pathId: path.id,
            segmentIndex: hit.segmentIndex,
            amount: hit.amount,
          },
          event,
        );
      }}
    >
      {!controlsOnly && (path.kind === "river" ? (
        <Group listening={false}>
          <Shape
            sceneFunc={drawPath}
            stroke={selected ? "#147c83" : "#364333"}
            strokeWidth={path.width + (selected ? 20 : 18)}
            lineCap="round"
            lineJoin="round"
            opacity={selected ? 0.94 : 0.42}
          />
          <Shape
            sceneFunc={drawPath}
            stroke="#657052"
            strokeWidth={path.width + 12}
            lineCap="round"
            lineJoin="round"
            opacity={0.94}
          />
          <Shape
            sceneFunc={drawPath}
            stroke="#304847"
            strokeWidth={path.width + 5}
            lineCap="round"
            lineJoin="round"
            opacity={0.92}
          />
          {riverTexture ? (
            <Shape
              sceneFunc={(context) => drawTexturedPath(context, riverTexture, 0.9)}
              listening={false}
            />
          ) : (
            <Shape sceneFunc={drawPath} stroke={path.color} strokeWidth={path.width} lineCap="round" lineJoin="round" opacity={0.92} />
          )}
          <Shape sceneFunc={drawPath} stroke="#98b5aa" strokeWidth={2.1} lineCap="round" dash={[48, 42]} opacity={0.34} />
          <Shape sceneFunc={drawPath} stroke="#c5d2c5" strokeWidth={1.2} lineCap="round" dash={[18, 68]} dashOffset={24} opacity={0.3} />
        </Group>
      ) : path.kind === "road" ? (
        <Group listening={false}>
          <Shape
            sceneFunc={drawPath}
            stroke={selected ? "#147c83" : "#4d5138"}
            strokeWidth={path.width + (selected ? 13 : 12)}
            lineCap="round"
            lineJoin="round"
            opacity={selected ? 0.92 : 0.38}
          />
          <Shape sceneFunc={drawPath} stroke="#806947" strokeWidth={path.width + 6} lineCap="round" lineJoin="round" opacity={0.55} />
          {roadTexture ? (
            <Shape
              sceneFunc={(context) => drawTexturedPath(context, roadTexture, 0.94)}
              listening={false}
            />
          ) : (
            <Shape sceneFunc={drawPath} stroke={path.color} strokeWidth={path.width} lineCap="round" lineJoin="round" opacity={0.84} />
          )}
          <Shape sceneFunc={drawPath} stroke="#dbc38f" strokeWidth={1.4} lineCap="round" lineJoin="round" dash={[23, 19]} opacity={0.34} />
        </Group>
      ) : (
        <BridgeArtwork path={bridgePath} image={bridgeImage} />
      ))}

      {!controlsOnly && <Shape
        sceneFunc={drawPath}
        stroke="rgba(255,255,255,0.001)"
        strokeWidth={Math.max(28, path.width + 16)}
        lineCap="round"
        lineJoin="round"
      />}

      {selected && controlsOnly &&
        previewAnchors.flatMap((anchor, anchorIndex) => {
          const isActive = selectedAnchorIndex === anchorIndex;
          return [
            anchor.mode === "corner" ? (
              <Rect
                key={`anchor-${anchorIndex}`}
                x={anchor.x - 7}
                y={anchor.y - 7}
                width={14}
                height={14}
                fill={isActive ? "#fff4e8" : "#ffffff"}
                stroke={isActive ? "#c46b24" : "#147c83"}
                strokeWidth={3}
                draggable
                onClick={(event) => {
                  event.cancelBubble = true;
                  selectPathAnchor(anchorIndex);
                }}
                onDragStart={(event) => {
                  event.cancelBubble = true;
                  selectPathAnchor(anchorIndex);
                }}
                onDragMove={(event) => {
                  event.cancelBubble = true;
                  setPreviewAnchors(
                    movePathAnchor(previewAnchors, anchorIndex, {
                      x: event.target.x() + 7,
                      y: event.target.y() + 7,
                    }),
                  );
                }}
                onDragEnd={(event) => {
                  event.cancelBubble = true;
                  const rawX = event.target.x() + 7;
                  const rawY = event.target.y() + 7;
                  commitAnchors(
                    movePathAnchor(previewAnchors, anchorIndex, {
                      x: snapEnabled ? snapCoordinate(rawX, gridSize) : rawX,
                      y: snapEnabled ? snapCoordinate(rawY, gridSize) : rawY,
                    }),
                  );
                }}
                onDblClick={(event) => {
                  event.cancelBubble = true;
                  commitAnchors(setPathAnchorMode(previewAnchors, anchorIndex, "smooth"));
                }}
                onContextMenu={(event) => {
                  event.evt.preventDefault();
                  event.cancelBubble = true;
                  onOpenContextMenu(
                    { kind: "path-anchor", pathId: path.id, anchorIndex },
                    event,
                  );
                }}
              />
            ) : (
              <Circle
                key={`anchor-${anchorIndex}`}
                x={anchor.x}
                y={anchor.y}
                radius={7}
                fill={isActive ? "#fff4e8" : "#ffffff"}
                stroke={isActive ? "#c46b24" : "#147c83"}
                strokeWidth={3}
                draggable
                onClick={(event) => {
                  event.cancelBubble = true;
                  selectPathAnchor(anchorIndex);
                }}
                onDragStart={(event) => {
                  event.cancelBubble = true;
                  selectPathAnchor(anchorIndex);
                }}
                onDragMove={(event) => {
                  event.cancelBubble = true;
                  setPreviewAnchors(
                    movePathAnchor(previewAnchors, anchorIndex, {
                      x: event.target.x(),
                      y: event.target.y(),
                    }),
                  );
                }}
                onDragEnd={(event) => {
                  event.cancelBubble = true;
                  const rawX = event.target.x();
                  const rawY = event.target.y();
                  commitAnchors(
                    movePathAnchor(previewAnchors, anchorIndex, {
                      x: snapEnabled ? snapCoordinate(rawX, gridSize) : rawX,
                      y: snapEnabled ? snapCoordinate(rawY, gridSize) : rawY,
                    }),
                  );
                }}
                onDblClick={(event) => {
                  event.cancelBubble = true;
                  commitAnchors(setPathAnchorMode(previewAnchors, anchorIndex, "corner"));
                }}
                onContextMenu={(event) => {
                  event.evt.preventDefault();
                  event.cancelBubble = true;
                  onOpenContextMenu(
                    { kind: "path-anchor", pathId: path.id, anchorIndex },
                    event,
                  );
                }}
              />
            ),
            anchorIndex < previewAnchors.length - 1 ? (
              <Circle
                key={`midpoint-${anchorIndex}`}
                {...cubicBezierPoint(anchor, previewAnchors[anchorIndex + 1], 0.5)}
                radius={4.5}
                fill="#d9f0ee"
                stroke="#147c83"
                strokeWidth={1.5}
                onClick={(event) => {
                  event.cancelBubble = true;
                  commitAnchors(splitPathSegment(previewAnchors, anchorIndex));
                  selectPathAnchor(anchorIndex + 1);
                }}
                onTap={(event) => {
                  event.cancelBubble = true;
                  commitAnchors(splitPathSegment(previewAnchors, anchorIndex));
                  selectPathAnchor(anchorIndex + 1);
                }}
                onContextMenu={(event) => {
                  event.evt.preventDefault();
                  event.cancelBubble = true;
                  onOpenContextMenu(
                    {
                      kind: "path-segment",
                      pathId: path.id,
                      segmentIndex: anchorIndex,
                      amount: 0.5,
                    },
                    event,
                  );
                }}
              />
            ) : null,
          ];
        })}

      {selected && controlsOnly && activeAnchor && (
        <Group listening>
          {activeAnchor.handleIn && (
            <>
              <Line points={[activeAnchor.x, activeAnchor.y, activeAnchor.handleIn.x, activeAnchor.handleIn.y]} stroke="#c46b24" strokeWidth={2} listening={false} />
              <Circle
                x={activeAnchor.handleIn.x}
                y={activeAnchor.handleIn.y}
                radius={6}
                fill="#fff4e8"
                stroke="#c46b24"
                strokeWidth={2}
                draggable
                onDragStart={(event) => {
                  event.cancelBubble = true;
                }}
                onDragMove={(event) => {
                  event.cancelBubble = true;
                  setPreviewAnchors(
                    movePathHandle(previewAnchors, selectedAnchorIndex!, "in", {
                      x: event.target.x(),
                      y: event.target.y(),
                    }),
                  );
                }}
                onDragEnd={(event) => {
                  event.cancelBubble = true;
                  commitAnchors(
                    movePathHandle(previewAnchors, selectedAnchorIndex!, "in", {
                      x: event.target.x(),
                      y: event.target.y(),
                    }),
                  );
                }}
              />
            </>
          )}
          {activeAnchor.handleOut && (
            <>
              <Line points={[activeAnchor.x, activeAnchor.y, activeAnchor.handleOut.x, activeAnchor.handleOut.y]} stroke="#c46b24" strokeWidth={2} listening={false} />
              <Circle
                x={activeAnchor.handleOut.x}
                y={activeAnchor.handleOut.y}
                radius={6}
                fill="#fff4e8"
                stroke="#c46b24"
                strokeWidth={2}
                draggable
                onDragStart={(event) => {
                  event.cancelBubble = true;
                }}
                onDragMove={(event) => {
                  event.cancelBubble = true;
                  setPreviewAnchors(
                    movePathHandle(previewAnchors, selectedAnchorIndex!, "out", {
                      x: event.target.x(),
                      y: event.target.y(),
                    }),
                  );
                }}
                onDragEnd={(event) => {
                  event.cancelBubble = true;
                  commitAnchors(
                    movePathHandle(previewAnchors, selectedAnchorIndex!, "out", {
                      x: event.target.x(),
                      y: event.target.y(),
                    }),
                  );
                }}
              />
            </>
          )}
        </Group>
      )}
    </Group>
  );
}

function GateNode({ gate, controlsOnly = false }: { gate: Gate; controlsOnly?: boolean }) {
  const groupRef = useRef<Konva.Group>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const selectedId = useEditorStore((state) => state.selectedId);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const locked = useEditorStore((state) =>
    isSceneObjectLocked(state.document, gate.id),
  );
  const presentationMode = useEditorStore((state) => state.presentationMode);
  const snapEnabled = useEditorStore((state) => state.snapEnabled);
  const gridSize = useEditorStore((state) => state.document.map.grid.size);
  const labelsVisible = useEditorStore((state) => state.visibleLayers.labels);
  const select = useEditorStore((state) => state.select);
  const updateGate = useEditorStore((state) => state.updateGate);
  const nudgeSelected = useEditorStore((state) => state.nudgeSelected);
  const selected = !presentationMode && selectedIds.includes(gate.id);
  const primarySelected = selectedId === gate.id;
  const isWallGate = gate.style === "wall";
  const height = gate.kind === "main" ? 30 : 24;
  const leafHeight = height - 8;

  useEffect(() => {
    if (!transformerRef.current || !groupRef.current) return;
    transformerRef.current.nodes(selected ? [groupRef.current] : []);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selected]);

  const onTransformEnd = () => {
    const node = groupRef.current;
    if (!node) return;
    const width = Math.max(12, gate.width * Math.abs(node.scaleX()));
    const rotation = snapAngle(node.rotation());
    node.scale({ x: 1, y: 1 });
    node.rotation(rotation);
    updateGate(gate.id, {
      width,
      rotation,
      position: { x: node.x(), y: node.y() },
    });
  };

  return (
    <>
      <Group
        ref={groupRef}
        x={gate.position.x}
        y={gate.position.y}
        rotation={gate.rotation}
        draggable={selected && !controlsOnly && !locked}
        listening={!locked || controlsOnly}
        onClick={controlsOnly ? undefined : (event) => {
          event.cancelBubble = true;
          select(gate.id, getSelectionMode(event));
        }}
        onTap={controlsOnly ? undefined : (event) => {
          event.cancelBubble = true;
          select(gate.id, getSelectionMode(event));
        }}
        onDragStart={controlsOnly ? undefined : () => {
          if (!selected) select(gate.id);
        }}
        onDragEnd={controlsOnly ? undefined : (event) => {
          event.cancelBubble = true;
          const raw = event.target.position();
          const position = snapEnabled
            ? {
                x: snapCoordinate(raw.x, gridSize),
                y: snapCoordinate(raw.y, gridSize),
              }
            : raw;
          event.target.position(position);
          if (selectedIds.length > 1 && selected) {
            nudgeSelected({
              x: position.x - gate.position.x,
              y: position.y - gate.position.y,
            });
          } else {
            updateGate(gate.id, { position });
          }
        }}
        onTransformEnd={onTransformEnd}
      >
        {controlsOnly ? (
          <Rect
            x={-gate.width / 2 - 7}
            y={-height / 2}
            width={gate.width + 14}
            height={height}
            fill="rgba(255,255,255,0.001)"
            listening={false}
          />
        ) : (
          <>
            <Rect
              x={-gate.width / 2}
              y={-leafHeight / 2}
              width={gate.width}
              height={leafHeight}
              fill={gate.kind === "main" ? "#83542f" : "#9a6a3d"}
              stroke={selected ? "#167f86" : "#4a3426"}
              strokeWidth={selected ? 3 : 2}
              shadowColor="#172320"
              shadowBlur={5}
              shadowOpacity={0.32}
            />
            <Line
              points={[0, -leafHeight / 2, 0, leafHeight / 2]}
              stroke="#4a3426"
              strokeWidth={2}
              listening={false}
            />
            {[-0.25, 0.25].map((offset) => (
              <Line
                key={offset}
                points={[
                  gate.width * offset,
                  -leafHeight / 2 + 2,
                  gate.width * offset,
                  leafHeight / 2 - 2,
                ]}
                stroke="#b88752"
                strokeWidth={1.4}
                opacity={0.72}
                listening={false}
              />
            ))}
            <Line
              points={[-gate.width / 2 + 4, leafHeight / 2 - 4, -3, -leafHeight / 2 + 4]}
              stroke="#553925"
              strokeWidth={3}
              listening={false}
            />
            <Line
              points={[3, -leafHeight / 2 + 4, gate.width / 2 - 4, leafHeight / 2 - 4]}
              stroke="#553925"
              strokeWidth={3}
              listening={false}
            />
            <Circle x={-4} radius={2.2} fill="#d0ad61" listening={false} />
            <Circle x={4} radius={2.2} fill="#d0ad61" listening={false} />
            <Rect
              x={-gate.width / 2 - (isWallGate ? 9 : 5)}
              y={-height / 2}
              width={isWallGate ? 14 : 8}
              height={height}
              cornerRadius={isWallGate ? 2 : 4}
              fill={isWallGate ? "#969990" : "#65472f"}
              stroke={isWallGate ? "#565957" : "#3f3024"}
              strokeWidth={2}
              listening={false}
            />
            <Rect
              x={gate.width / 2 - (isWallGate ? 5 : 3)}
              y={-height / 2}
              width={isWallGate ? 14 : 8}
              height={height}
              cornerRadius={isWallGate ? 2 : 4}
              fill={isWallGate ? "#969990" : "#65472f"}
              stroke={isWallGate ? "#565957" : "#3f3024"}
              strokeWidth={2}
              listening={false}
            />
            {isWallGate && (
              <>
                <Line
                  points={[-gate.width / 2 - 7, -3, -gate.width / 2 + 5, -3]}
                  stroke="#c1c2ba"
                  strokeWidth={2}
                  listening={false}
                />
                <Line
                  points={[gate.width / 2 - 5, 3, gate.width / 2 + 7, 3]}
                  stroke="#c1c2ba"
                  strokeWidth={2}
                  listening={false}
                />
              </>
            )}
            {labelsVisible && (
              <Group y={height / 2 + 7} rotation={-gate.rotation} listening={false}>
                <Text
                  x={-Math.max(54, gate.width)}
                  width={Math.max(108, gate.width * 2)}
                  text={gate.name}
                  align="center"
                  fontFamily="Inter, system-ui, sans-serif"
                  fontSize={11}
                  fontStyle="bold"
                  fill="#263437"
                />
              </Group>
            )}
          </>
        )}
      </Group>
      {primarySelected && controlsOnly && !locked && (
        <Transformer
          ref={transformerRef}
          resizeEnabled
          rotateEnabled
          keepRatio={false}
          enabledAnchors={["middle-left", "middle-right"]}
          boundBoxFunc={(previous, next) =>
            Math.abs(next.width) < 18 ? previous : next
          }
          rotationSnaps={Array.from({ length: 24 }, (_, index) => index * 15)}
          rotationSnapTolerance={7}
          rotateAnchorOffset={32}
          anchorSize={10}
          anchorFill="#ffffff"
          anchorStroke="#167f86"
          borderStroke="#167f86"
          borderStrokeWidth={2}
        />
      )}
    </>
  );
}

function PalisadeNode({
  palisade,
  onOpenContextMenu,
  controlsOnly = false,
}: {
  palisade: Palisade;
  onOpenContextMenu: OpenCanvasContextMenu;
  controlsOnly?: boolean;
}) {
  const groupRef = useRef<Konva.Group>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [activeJunction, setActiveJunction] = useState<Point | null>(null);
  const selectedId = useEditorStore((state) => state.selectedId);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const locked = useEditorStore((state) =>
    isSceneObjectLocked(state.document, palisade.id),
  );
  const snapEnabled = useEditorStore((state) => state.snapEnabled);
  const gridSize = useEditorStore((state) => state.document.map.grid.size);
  const labelsVisible = useEditorStore((state) => state.visibleLayers.labels);
  const select = useEditorStore((state) => state.select);
  const updatePalisade = useEditorStore((state) => state.updatePalisade);
  const nudgeSelected = useEditorStore((state) => state.nudgeSelected);
  const selected = selectedIds.includes(palisade.id);
  const primarySelected = selectedId === palisade.id;
  const isWall = palisade.style === "wall";
  const junctions = uniquePalisadeJunctions(palisade.segments);
  const activeJunctionHandles = activeJunction
    ? getPalisadeJunctionHandles(palisade.segments, activeJunction)
    : [];
  const labelX = junctions.length
    ? (Math.min(...junctions.map((point) => point.x)) +
        Math.max(...junctions.map((point) => point.x))) /
      2
    : 0;
  const labelY = junctions.length
    ? Math.max(...junctions.map((point) => point.y)) + 16
    : 24;
  const posts = palisade.segments.flatMap((segment, segmentIndex) => {
    if (segment.kind === "line") {
      const length = Math.hypot(segment.to.x - segment.from.x, segment.to.y - segment.from.y);
      const count = Math.max(1, Math.ceil(length / 21));
      return Array.from({ length: count + 1 }, (_, index) => {
        const progress = index / count;
        return {
          id: `${segmentIndex}-${index}`,
          x: segment.from.x + (segment.to.x - segment.from.x) * progress,
          y: segment.from.y + (segment.to.y - segment.from.y) * progress,
        };
      });
    }

    if (segment.kind === "bezier") {
      const count = Math.max(1, Math.ceil(segmentLength(segment) / 21));
      return Array.from({ length: count + 1 }, (_, index) => ({
        id: `${segmentIndex}-${index}`,
        ...palisadeBezierPoint(segment, index / count),
      }));
    }

    const sweep = arcSweepRadians(segment);
    const count = Math.max(1, Math.ceil((segment.radius * sweep) / 21));
    const direction = segment.counterClockwise ? -1 : 1;
    return Array.from({ length: count + 1 }, (_, index) => {
      const angle = degreesToRadians(segment.startAngle) + direction * sweep * (index / count);
      return {
        id: `${segmentIndex}-${index}`,
        x: segment.center.x + Math.cos(angle) * segment.radius,
        y: segment.center.y + Math.sin(angle) * segment.radius,
      };
    });
  });

  useEffect(() => {
    if (!selected) setActiveJunction(null);
    if (!transformerRef.current || !groupRef.current) return;
    transformerRef.current.nodes(selected ? [groupRef.current] : []);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selected]);

  const drawPalisade = useCallback(
    (context: Konva.Context, shape: Konva.Shape) => {
      palisade.segments.forEach((segment) => {
        context.beginPath();
        if (segment.kind === "line") {
          context.moveTo(segment.from.x, segment.from.y);
          context.lineTo(segment.to.x, segment.to.y);
        } else if (segment.kind === "bezier") {
          context.moveTo(segment.from.x, segment.from.y);
          context.bezierCurveTo(
            segment.handleFrom.x,
            segment.handleFrom.y,
            segment.handleTo.x,
            segment.handleTo.y,
            segment.to.x,
            segment.to.y,
          );
        } else {
          context.arc(
            segment.center.x,
            segment.center.y,
            segment.radius,
            degreesToRadians(segment.startAngle),
            degreesToRadians(segment.endAngle),
            segment.counterClockwise,
          );
        }
        context.strokeShape(shape);
      });
    },
    [palisade.segments],
  );

  const onTransformEnd = () => {
    const node = groupRef.current;
    if (!node) return;
    const rotation = snapAngle(node.rotation());
    node.rotation(rotation);
    updatePalisade(palisade.id, { rotation });
  };

  const onDragEnd = (event: KonvaEventObject<DragEvent>) => {
    if (event.target !== event.currentTarget) return;
    const rawX = event.target.x();
    const rawY = event.target.y();
    const x = snapEnabled ? snapCoordinate(rawX, gridSize) : rawX;
    const y = snapEnabled ? snapCoordinate(rawY, gridSize) : rawY;
    event.target.position({ x, y });
    if (selectedIds.length > 1 && selected) {
      nudgeSelected({ x: x - palisade.center.x, y: y - palisade.center.y });
    } else {
      updatePalisade(palisade.id, { center: { x, y } });
    }
  };

  const updateArc = (segmentIndex: number, nextArc: ArcSegment) => {
    const previousArc = palisade.segments[segmentIndex];
    if (previousArc.kind !== "arc") return;
    let nextSegments = palisade.segments.map((segment, index) =>
      index === segmentIndex ? nextArc : segment,
    );
    nextSegments = replaceSegmentJunctions(
      nextSegments,
      arcPoint(previousArc, "start"),
      arcPoint(nextArc, "start"),
    );
    nextSegments = replaceSegmentJunctions(
      nextSegments,
      arcPoint(previousArc, "end"),
      arcPoint(nextArc, "end"),
    );
    updatePalisade(palisade.id, { segments: nextSegments });
  };

  return (
    <>
      <Group
        ref={groupRef}
        x={palisade.center.x}
        y={palisade.center.y}
        rotation={palisade.rotation}
        draggable={selected && !controlsOnly && !locked}
        listening={(!controlsOnly || selected) && !locked}
        onClick={controlsOnly ? undefined : (event) => {
          event.cancelBubble = true;
          select(palisade.id, getSelectionMode(event));
        }}
        onTap={controlsOnly ? undefined : (event) => {
          event.cancelBubble = true;
          select(palisade.id, getSelectionMode(event));
        }}
        onDragStart={controlsOnly ? undefined : () => {
          if (!selected) select(palisade.id);
        }}
        onDragEnd={controlsOnly ? undefined : onDragEnd}
        onTransformEnd={onTransformEnd}
        onContextMenu={controlsOnly || locked ? undefined : (event) => {
          event.evt.preventDefault();
          event.cancelBubble = true;
          const pointer = groupRef.current?.getRelativePointerPosition();
          const hit = pointer
            ? findClosestPalisadeSegment(palisade.segments, pointer)
            : null;
          if (!hit) return;
          onOpenContextMenu(
            {
              kind: "palisade-segment",
              palisadeId: palisade.id,
              segmentIndex: hit.segmentIndex,
              amount: hit.amount,
              point: hit.point,
            },
            event,
          );
        }}
      >
        <Shape
          visible={!controlsOnly}
          sceneFunc={drawPalisade}
          stroke={selected ? "#147c83" : isWall ? "#565957" : PALISADE_DARK}
          strokeWidth={palisade.thickness + (selected ? 5 : 3)}
          lineCap="round"
          lineJoin="round"
          shadowColor="#24302d"
          shadowBlur={4}
          shadowOpacity={0.2}
          hitStrokeWidth={28}
        />
        <Shape
          visible={!controlsOnly}
          sceneFunc={drawPalisade}
          stroke={isWall ? "#a4a59e" : PALISADE_LIGHT}
          strokeWidth={palisade.thickness - 3}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />

        {!controlsOnly && !isWall && posts.map((post) => (
          <Group key={post.id} x={post.x} y={post.y} listening={false}>
            <Circle radius={3.8} fill="#815731" stroke="#493625" strokeWidth={1.2} />
            <Circle x={-0.9} y={-0.9} radius={1} fill="#c39257" opacity={0.68} />
          </Group>
        ))}

        {!controlsOnly && isWall && (
          <Shape
            sceneFunc={drawPalisade}
            stroke="#747873"
            strokeWidth={2}
            dash={[14, 5]}
            lineCap="butt"
            listening={false}
          />
        )}

        {selected && controlsOnly &&
          junctions.map((junction, index) => {
            const arcConnected = palisade.segments.some(
              (segment) =>
                segment.kind === "arc" &&
                (pointsMatch(arcPoint(segment, "start"), junction) ||
                  pointsMatch(arcPoint(segment, "end"), junction)),
            );
            const smooth =
              getPalisadeJunctionMode(palisade.segments, junction) === "smooth";
            const dragProps = {
              x: junction.x,
              y: junction.y,
              fill: "#ffffff",
              stroke: "#147c83",
              strokeWidth: 3,
              draggable: true,
              onDragStart: (event: KonvaEventObject<DragEvent>) => {
                event.cancelBubble = true;
                setActiveJunction(junction);
              },
              onDragEnd: (event: KonvaEventObject<DragEvent>) => {
                event.cancelBubble = true;
                const rawX = event.target.x();
                const rawY = event.target.y();
                const requested = {
                  x: snapEnabled ? snapCoordinate(rawX, gridSize) : rawX,
                  y: snapEnabled ? snapCoordinate(rawY, gridSize) : rawY,
                };
                updatePalisade(palisade.id, {
                  segments: movePalisadeJunction(palisade.segments, junction, requested),
                });
                setActiveJunction(requested);
              },
              onClick: (event: KonvaEventObject<MouseEvent>) => {
                event.cancelBubble = true;
                setActiveJunction(junction);
              },
              onTap: (event: KonvaEventObject<TouchEvent>) => {
                event.cancelBubble = true;
                setActiveJunction(junction);
              },
              onContextMenu: (event: KonvaEventObject<PointerEvent>) => {
                event.evt.preventDefault();
                event.cancelBubble = true;
                setActiveJunction(junction);
                onOpenContextMenu(
                  { kind: "palisade-junction", palisadeId: palisade.id, junction },
                  event,
                );
              },
            };
            return arcConnected || smooth ? (
              <Circle key={`junction-${index}`} {...dragProps} radius={9} />
            ) : (
              <Rect
                key={`junction-${index}`}
                {...dragProps}
                width={16}
                height={16}
                offsetX={8}
                offsetY={8}
              />
            );
          })}

        {selected && controlsOnly && activeJunction &&
          activeJunctionHandles.map((handle) => (
            <Group key={`bezier-handle-${handle.segmentIndex}`}>
              <Line
                points={[
                  activeJunction.x,
                  activeJunction.y,
                  handle.point.x,
                  handle.point.y,
                ]}
                stroke="#c46b24"
                strokeWidth={2}
                listening={false}
              />
              <Circle
                x={handle.point.x}
                y={handle.point.y}
                radius={6}
                fill="#fff4e8"
                stroke="#c46b24"
                strokeWidth={2}
                draggable
                onDragStart={(event) => {
                  event.cancelBubble = true;
                }}
                onDragEnd={(event) => {
                  event.cancelBubble = true;
                  const position = {
                    x: snapEnabled
                      ? snapCoordinate(event.target.x(), gridSize)
                      : event.target.x(),
                    y: snapEnabled
                      ? snapCoordinate(event.target.y(), gridSize)
                      : event.target.y(),
                  };
                  updatePalisade(palisade.id, {
                    segments: movePalisadeJunctionHandle(
                      palisade.segments,
                      activeJunction,
                      handle.segmentIndex,
                      position,
                    ),
                  });
                }}
              />
            </Group>
          ))}

        {selected && controlsOnly &&
          palisade.segments.map((segment, segmentIndex) => {
            if (segment.kind !== "arc") return null;
            const sweep = arcSweepRadians(segment);
            const direction = segment.counterClockwise ? -1 : 1;
            const midpointAngle =
              degreesToRadians(segment.startAngle) + direction * sweep * 0.5;
            const radiusPoint = {
              x: segment.center.x + Math.cos(midpointAngle) * segment.radius,
              y: segment.center.y + Math.sin(midpointAngle) * segment.radius,
            };
            return (
              <Group key={`arc-controls-${segmentIndex}`}>
                <Line
                  points={[
                    segment.center.x,
                    segment.center.y,
                    radiusPoint.x,
                    radiusPoint.y,
                  ]}
                  stroke="#c46b24"
                  strokeWidth={1.5}
                  dash={[5, 4]}
                  listening={false}
                />
                <Rect
                  x={segment.center.x - 7}
                  y={segment.center.y - 7}
                  width={14}
                  height={14}
                  fill="#147c83"
                  stroke="#ffffff"
                  strokeWidth={2}
                  draggable
                  onDragStart={(event) => {
                    event.cancelBubble = true;
                  }}
                  onDragEnd={(event) => {
                    event.cancelBubble = true;
                    const x = snapEnabled
                      ? snapCoordinate(event.target.x() + 7, gridSize)
                      : event.target.x() + 7;
                    const y = snapEnabled
                      ? snapCoordinate(event.target.y() + 7, gridSize)
                      : event.target.y() + 7;
                    updateArc(segmentIndex, { ...segment, center: { x, y } });
                  }}
                />
                <Circle
                  x={radiusPoint.x}
                  y={radiusPoint.y}
                  radius={7}
                  fill="#d9f0ee"
                  stroke="#147c83"
                  strokeWidth={2}
                  draggable
                  onDragStart={(event) => {
                    event.cancelBubble = true;
                  }}
                  onDragEnd={(event) => {
                    event.cancelBubble = true;
                    const radius = Math.max(
                      gridSize,
                      Math.hypot(
                        event.target.x() - segment.center.x,
                        event.target.y() - segment.center.y,
                      ),
                    );
                    updateArc(segmentIndex, {
                      ...segment,
                      radius: snapEnabled ? snapCoordinate(radius, gridSize) : radius,
                    });
                  }}
                />
              </Group>
            );
          })}

        {!controlsOnly && labelsVisible && (
          <Group
            x={labelX}
            y={labelY}
            rotation={-palisade.rotation}
            listening={false}
          >
            <Rect x={-88} width={176} height={28} fill="#25383a" cornerRadius={3} />
            <Text
              x={-82}
              y={8}
              width={164}
              text={palisade.name}
              align="center"
              fontFamily="Inter, system-ui, sans-serif"
              fontSize={12}
              fontStyle="bold"
              fill="#ffffff"
            />
          </Group>
        )}
      </Group>
      {primarySelected && controlsOnly && !locked && (
        <Transformer
          ref={transformerRef}
          resizeEnabled={false}
          rotateEnabled
          rotationSnaps={Array.from({ length: 24 }, (_, index) => index * 15)}
          rotationSnapTolerance={7}
          rotateAnchorOffset={30}
          anchorSize={10}
          anchorFill="#ffffff"
          anchorStroke="#167f86"
          borderStroke="#167f86"
          borderStrokeWidth={2}
        />
      )}
    </>
  );
}

function MultiSelectionTransformer({ bounds }: { bounds: SceneBounds }) {
  const groupRef = useRef<Konva.Group>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const nudgeSelected = useEditorStore((state) => state.nudgeSelected);
  const transformSelected = useEditorStore((state) => state.transformSelected);
  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };

  useEffect(() => {
    if (!groupRef.current || !transformerRef.current) return;
    transformerRef.current.nodes([groupRef.current]);
    transformerRef.current.getLayer()?.batchDraw();
  }, [bounds.height, bounds.width, bounds.x, bounds.y]);

  return (
    <>
      <Group
        ref={groupRef}
        x={center.x}
        y={center.y}
        draggable
        onDragEnd={(event) => {
          const delta = {
            x: event.target.x() - center.x,
            y: event.target.y() - center.y,
          };
          event.target.position(center);
          nudgeSelected(delta);
        }}
        onTransformEnd={() => {
          const node = groupRef.current;
          if (!node) return;
          const scale = Math.max(Math.abs(node.scaleX()), Math.abs(node.scaleY()));
          const nextCenter = { x: node.x(), y: node.y() };
          const rotation = snapAngle(node.rotation());
          node.scale({ x: 1, y: 1 });
          node.rotation(0);
          node.position(center);
          transformSelected({ origin: center, center: nextCenter, scale, rotation });
        }}
      >
        <Rect
          x={-bounds.width / 2}
          y={-bounds.height / 2}
          width={Math.max(10, bounds.width)}
          height={Math.max(10, bounds.height)}
          fill="rgba(255,255,255,0.001)"
        />
      </Group>
      <Transformer
        ref={transformerRef}
        resizeEnabled
        rotateEnabled
        enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
        keepRatio
        boundBoxFunc={(previous, next) =>
          Math.abs(next.width) < 20 || Math.abs(next.height) < 20 ? previous : next
        }
        rotationSnaps={Array.from({ length: 24 }, (_, index) => index * 15)}
        rotationSnapTolerance={7}
        rotateAnchorOffset={38}
        anchorSize={11}
        anchorFill="#ffffff"
        anchorStroke="#167f86"
        borderStroke="#167f86"
        borderStrokeWidth={2}
      />
    </>
  );
}

export function MapCanvas() {
  const { locale, t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const didInitialFit = useRef(false);
  const rightPanRef = useRef<RightPan | null>(null);
  const suppressContextMenuRef = useRef(false);
  const terrainStrokeRef = useRef<TerrainStroke | null>(null);
  const document = useEditorStore((state) => state.document);
  const referenceImage = useRasterImage(
    getVisualAsset(document.map.referenceAssetId)?.albedoUrl,
  );
  const treeAtlasImage = useRasterImage(
    getVisualAsset("environment/tree-atlas")?.albedoUrl,
  );
  const bridgeImage = useRasterImage(getVisualAsset("environment/bridge")?.albedoUrl);
  const groundTextureImage = useRasterImage(
    getVisualAsset("environment/ground-texture")?.albedoUrl,
  );
  const riverTextureImage = useRasterImage(
    getVisualAsset("environment/river-texture")?.albedoUrl,
  );
  const roadTextureImage = useRasterImage(
    getVisualAsset("environment/road-texture")?.albedoUrl,
  );
  const wellImage = useRasterImage(getVisualAsset("environment/marker/well")?.albedoUrl);
  const fireImage = useRasterImage(getVisualAsset("environment/marker/fire")?.albedoUrl);
  const wheatFieldImage = useRasterImage(
    getVisualAsset("environment/zone/wheat-field")?.albedoUrl,
  );
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const [rightPanning, setRightPanning] = useState(false);
  const [marquee, setMarquee] = useState<MarqueeSelection | null>(null);
  const [draftTerrainStroke, setDraftTerrainStroke] = useState<TerrainStroke | null>(null);
  const [contextMenu, setContextMenu] = useState<CanvasContextMenu | null>(null);
  const selectedId = useEditorStore((state) => state.selectedId);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const visibleLayers = useEditorStore((state) => state.visibleLayers);
  const gridVisible = useEditorStore((state) => state.gridVisible);
  const snapEnabled = useEditorStore((state) => state.snapEnabled);
  const presentationMode = useEditorStore((state) => state.presentationMode);
  const activeTerrainBrush = useEditorStore((state) => state.activeTerrainBrush);
  const select = useEditorStore((state) => state.select);
  const selectMany = useEditorStore((state) => state.selectMany);
  const selectPathAnchor = useEditorStore((state) => state.selectPathAnchor);
  const updatePath = useEditorStore((state) => state.updatePath);
  const updatePalisade = useEditorStore((state) => state.updatePalisade);
  const updateZone = useEditorStore((state) => state.updateZone);
  const updateMarker = useEditorStore((state) => state.updateMarker);
  const updateDecoration = useEditorStore((state) => state.updateDecoration);
  const nudgeSelected = useEditorStore((state) => state.nudgeSelected);
  const addTerrainStroke = useEditorStore((state) => state.addTerrainStroke);
  const selectedPath = document.map.paths.find((path) => path.id === selectedId);
  const selectedPalisade = document.map.palisades.find(
    (palisade) => palisade.id === selectedId,
  );
  const selectedGate = document.map.gates.find((gate) => gate.id === selectedId);
  const selectedBuilding = document.map.buildings.find(
    (building) => building.id === selectedId,
  );
  const selectedZone = document.map.zones.find((zone) => zone.id === selectedId);
  const selectedDecoration = document.map.decorations.find(
    (decoration) => decoration.id === selectedId,
  );

  const openContextMenu = useCallback<OpenCanvasContextMenu>(
    (target, event) => {
      if (suppressContextMenuRef.current) return;
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const menuWidth = 212;
      const menuHeight =
        target.kind === "path-anchor" || target.kind === "palisade-junction"
          ? 164
          : 54;
      setContextMenu({
        ...target,
        left: Math.max(8, Math.min(event.evt.clientX - bounds.left, bounds.width - menuWidth - 8)),
        top: Math.max(8, Math.min(event.evt.clientY - bounds.top, bounds.height - menuHeight - 8)),
      });
      if (target.kind === "path-anchor" || target.kind === "path-segment") {
        select(target.pathId);
        selectPathAnchor(target.kind === "path-anchor" ? target.anchorIndex : null);
      } else {
        select(target.palisadeId);
      }
    },
    [select, selectPathAnchor],
  );

  useEffect(() => {
    if (!contextMenu) return;
    const closeOutside = (event: PointerEvent) => {
      const element = event.target instanceof Element ? event.target : null;
      if (!element?.closest(".canvas-context-menu")) setContextMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [contextMenu]);

  const finishRightPan = useCallback(() => {
    const pan = rightPanRef.current;
    if (!pan) return;
    suppressContextMenuRef.current = pan.moved;
    rightPanRef.current = null;
    setRightPanning(false);
    window.setTimeout(() => {
      suppressContextMenuRef.current = false;
    }, 0);
  }, []);

  const finishTerrainStroke = useCallback(() => {
    const stroke = terrainStrokeRef.current;
    if (!stroke) return;
    terrainStrokeRef.current = null;
    setDraftTerrainStroke(null);
    addTerrainStroke(stroke);
  }, [addTerrainStroke]);

  useEffect(() => {
    window.addEventListener("mouseup", finishRightPan);
    window.addEventListener("mouseup", finishTerrainStroke);
    return () => {
      window.removeEventListener("mouseup", finishRightPan);
      window.removeEventListener("mouseup", finishTerrainStroke);
    };
  }, [finishRightPan, finishTerrainStroke]);

  const setContextPathMode = (mode: PathAnchor["mode"]) => {
    if (!contextMenu || contextMenu.kind !== "path-anchor") return;
    const path = document.map.paths.find((candidate) => candidate.id === contextMenu.pathId);
    if (!path) return;
    updatePath(
      path.id,
      syncPathGeometry(
        setPathAnchorMode(getPathAnchors(path), contextMenu.anchorIndex, mode),
      ),
    );
    selectPathAnchor(contextMenu.anchorIndex);
    setContextMenu(null);
  };

  const setContextPalisadeMode = (mode: PalisadeNodeMode) => {
    if (!contextMenu || contextMenu.kind !== "palisade-junction") return;
    const palisade = document.map.palisades.find(
      (candidate) => candidate.id === contextMenu.palisadeId,
    );
    if (!palisade) return;
    updatePalisade(palisade.id, {
      segments: setPalisadeJunctionMode(
        palisade.segments,
        contextMenu.junction,
        mode,
      ),
    });
    setContextMenu(null);
  };

  const removeContextPoint = () => {
    if (!contextMenu) return;
    if (contextMenu.kind === "path-anchor") {
      const path = document.map.paths.find((candidate) => candidate.id === contextMenu.pathId);
      if (!path) return;
      updatePath(
        path.id,
        syncPathGeometry(removePathAnchor(getPathAnchors(path), contextMenu.anchorIndex)),
      );
      selectPathAnchor(null);
    } else if (contextMenu.kind === "palisade-junction") {
      const palisade = document.map.palisades.find(
        (candidate) => candidate.id === contextMenu.palisadeId,
      );
      if (!palisade) return;
      updatePalisade(palisade.id, {
        segments: removePalisadeJunction(palisade.segments, contextMenu.junction),
      });
    }
    setContextMenu(null);
  };

  const insertContextPoint = () => {
    if (!contextMenu) return;
    if (contextMenu.kind === "path-segment") {
      const path = document.map.paths.find((candidate) => candidate.id === contextMenu.pathId);
      if (!path) return;
      updatePath(
        path.id,
        syncPathGeometry(
          splitPathSegment(
            getPathAnchors(path),
            contextMenu.segmentIndex,
            contextMenu.amount,
          ),
        ),
      );
      selectPathAnchor(contextMenu.segmentIndex + 1);
    } else if (contextMenu.kind === "palisade-segment") {
      const palisade = document.map.palisades.find(
        (candidate) => candidate.id === contextMenu.palisadeId,
      );
      if (!palisade) return;
      updatePalisade(palisade.id, {
        segments: splitPalisadeSegment(
          palisade.segments,
          contextMenu.segmentIndex,
          contextMenu.point,
        ),
      });
    }
    setContextMenu(null);
  };

  const fitMap = useCallback(() => {
    const contentBounds = {
      x: 0,
      y: 0,
      width: document.map.width,
      height: document.map.height,
    };
    const scale = Math.min(
      (size.width - 48) / contentBounds.width,
      (size.height - 48) / contentBounds.height,
    );
    setViewport({
      scale,
      x: (size.width - contentBounds.width * scale) / 2 - contentBounds.x * scale,
      y:
        size.width < 600
          ? 16 - contentBounds.y * scale
          : (size.height - contentBounds.height * scale) / 2 - contentBounds.y * scale,
    });
  }, [document.map.height, document.map.width, size.height, size.width]);

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.max(320, entry.contentRect.width),
        height: Math.max(300, entry.contentRect.height),
      });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!didInitialFit.current && size.width > 0 && size.height > 0) {
      fitMap();
      didInitialFit.current = true;
    }
  }, [fitMap, size]);

  useEffect(() => {
    if (!presentationMode || size.width <= 0 || size.height <= 0) return;
    const frame = window.requestAnimationFrame(fitMap);
    return () => window.cancelAnimationFrame(frame);
  }, [fitMap, presentationMode, size.height, size.width]);

  useEffect(() => {
    const fitAfterFullscreenChange = () => {
      window.requestAnimationFrame(fitMap);
    };
    globalThis.document.addEventListener("fullscreenchange", fitAfterFullscreenChange);
    return () =>
      globalThis.document.removeEventListener(
        "fullscreenchange",
        fitAfterFullscreenChange,
      );
  }, [fitMap]);

  const setZoom = (nextScale: number, focalPoint = { x: size.width / 2, y: size.height / 2 }) => {
    const scale = Math.min(2.4, Math.max(0.35, nextScale));
    const worldPoint = {
      x: (focalPoint.x - viewport.x) / viewport.scale,
      y: (focalPoint.y - viewport.y) / viewport.scale,
    };
    setViewport({
      scale,
      x: focalPoint.x - worldPoint.x * scale,
      y: focalPoint.y - worldPoint.y * scale,
    });
  };

  const onWheel = (event: KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    if (event.evt.ctrlKey || event.evt.metaKey) {
      const pointer = stageRef.current?.getPointerPosition();
      if (!pointer) return;
      setZoom(viewport.scale * Math.exp(-event.evt.deltaY * 0.01), pointer);
      return;
    }
    setViewport((current) => ({
      ...current,
      x: current.x - event.evt.deltaX,
      y: current.y - event.evt.deltaY,
    }));
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.matches("input, textarea, select") ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      const direction = {
        arrowleft: { x: -1, y: 0 },
        a: { x: -1, y: 0 },
        arrowright: { x: 1, y: 0 },
        d: { x: 1, y: 0 },
        arrowup: { x: 0, y: -1 },
        w: { x: 0, y: -1 },
        arrowdown: { x: 0, y: 1 },
        s: { x: 0, y: 1 },
      }[event.key.toLowerCase()];
      if (!direction) return;
      event.preventDefault();
      const multiplier = event.shiftKey ? 5 : 1;
      if (selectedId && !presentationMode) {
        const step = document.map.grid.size * multiplier;
        nudgeSelected({ x: direction.x * step, y: direction.y * step });
      } else {
        const step = 40 * multiplier;
        setViewport((current) => ({
          ...current,
          x: current.x + direction.x * step,
          y: current.y + direction.y * step,
        }));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [document.map.grid.size, nudgeSelected, presentationMode, selectedId]);

  const gridLines = [];
  if (gridVisible) {
    for (
      let column = 0, x = 0;
      x <= document.map.width;
      column += 1, x = column * document.map.grid.size
    ) {
      const major = column % document.map.grid.majorEvery === 0;
      gridLines.push(
        <MapGridLine
          key={`grid-x-${x}`}
          points={[x, 0, x, document.map.height]}
          major={major}
          color={document.map.grid.color ?? defaultGridAppearance.color}
          opacity={document.map.grid.opacity ?? defaultGridAppearance.opacity}
        />,
      );
    }
    for (
      let row = 0, y = 0;
      y <= document.map.height;
      row += 1, y = row * document.map.grid.size
    ) {
      const major = row % document.map.grid.majorEvery === 0;
      gridLines.push(
        <MapGridLine
          key={`grid-y-${y}`}
          points={[0, y, document.map.width, y]}
          major={major}
          color={document.map.grid.color ?? defaultGridAppearance.color}
          opacity={document.map.grid.opacity ?? defaultGridAppearance.opacity}
        />,
      );
    }
  }

  const contextPath =
    contextMenu?.kind === "path-anchor" || contextMenu?.kind === "path-segment"
      ? document.map.paths.find((path) => path.id === contextMenu.pathId)
      : undefined;
  const contextAnchor =
    contextMenu?.kind === "path-anchor" && contextPath
      ? getPathAnchors(contextPath).at(contextMenu.anchorIndex)
      : undefined;
  const contextPalisade =
    contextMenu?.kind === "palisade-junction" ||
    contextMenu?.kind === "palisade-segment"
      ? document.map.palisades.find(
          (palisade) => palisade.id === contextMenu.palisadeId,
        )
      : undefined;
  const canRemoveContextPoint =
    contextMenu?.kind === "path-anchor"
      ? Boolean(contextPath && getPathAnchors(contextPath).length > 2)
      : contextMenu?.kind === "palisade-junction" && contextPalisade
        ? canRemovePalisadeJunction(contextPalisade.segments, contextMenu.junction)
        : false;
  const canSetContextPalisadeMode =
    contextMenu?.kind === "palisade-junction" && contextPalisade
      ? canSetPalisadeJunctionMode(contextPalisade.segments, contextMenu.junction)
      : false;
  const contextPalisadeMode =
    contextMenu?.kind === "palisade-junction" && contextPalisade
      ? getPalisadeJunctionMode(contextPalisade.segments, contextMenu.junction)
      : undefined;
  const terrainBrushActive = Boolean(activeTerrainBrush && !presentationMode);
  const allSelectedObjectsTransformable = selectedIds.length > 1
    && selectedIds.every(
      (id) => isSceneObjectVisible(document, id) && !isSceneObjectLocked(document, id),
    );
  const multiSelectionBounds = allSelectedObjectsTransformable
    ? getSceneSelectionBounds(document, selectedIds)
    : null;

  const getClampedMapPointer = (): Point | null => {
    const pointer = stageRef.current?.getRelativePointerPosition();
    if (!pointer) return null;
    return {
      x: Math.max(0, Math.min(document.map.width, pointer.x)),
      y: Math.max(0, Math.min(document.map.height, pointer.y)),
    };
  };

  const startMarqueeSelection = (event: KonvaEventObject<MouseEvent>) => {
    if (presentationMode || terrainBrushActive || event.evt.button !== 0) return;
    const isSelectionSurface = event.target === event.currentTarget
      || event.target.name() === "map-selection-surface";
    if (!isSelectionSurface) return;
    const pointer = stageRef.current?.getRelativePointerPosition();
    if (
      !pointer
      || pointer.x < 0
      || pointer.y < 0
      || pointer.x > document.map.width
      || pointer.y > document.map.height
    ) return;
    const additive = event.evt.shiftKey || event.evt.ctrlKey || event.evt.metaKey;
    setMarquee({
      start: pointer,
      current: pointer,
      baseIds: additive ? selectedIds : [],
    });
  };

  const finishMarqueeSelection = () => {
    if (!marquee) return;
    const pointer = getClampedMapPointer() ?? marquee.current;
    const selectionBounds: SceneBounds = {
      x: Math.min(marquee.start.x, pointer.x),
      y: Math.min(marquee.start.y, pointer.y),
      width: Math.abs(pointer.x - marquee.start.x),
      height: Math.abs(pointer.y - marquee.start.y),
    };
    const minimumSize = 3 / viewport.scale;
    const intersectingIds = selectionBounds.width < minimumSize
      && selectionBounds.height < minimumSize
      ? []
      : getSceneObjects(document)
          .filter(
            (object) => isSceneObjectVisible(document, object.id)
              && !isSceneObjectLocked(document, object.id),
          )
          .filter((object) => {
            const bounds = getSelectableObjectBounds(object);
            return bounds ? sceneBoundsIntersect(selectionBounds, bounds) : false;
          })
          .map((object) => object.id);
    selectMany([...new Set([...marquee.baseIds, ...intersectingIds])]);
    setMarquee(null);
  };

  useEffect(() => {
    if (!marquee) return;
    window.addEventListener("mouseup", finishMarqueeSelection);
    return () => window.removeEventListener("mouseup", finishMarqueeSelection);
  }, [marquee]);

  const startTerrainStroke = () => {
    if (!activeTerrainBrush) return;
    const pointer = stageRef.current?.getRelativePointerPosition();
    if (!pointer) return;
    if (
      pointer.x < 0 ||
      pointer.y < 0 ||
      pointer.x > document.map.width ||
      pointer.y > document.map.height
    ) {
      return;
    }
    const { x, y } = pointer;
    const stroke: TerrainStroke = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `terrain-${Date.now()}`,
      type: activeTerrainBrush.type,
      points: [x, y, x, y],
      width:
        (activeTerrainBrush.sizeMeters / document.map.grid.distance) *
        document.map.grid.size,
    };
    terrainStrokeRef.current = stroke;
    setDraftTerrainStroke(stroke);
  };

  const extendTerrainStroke = () => {
    const stroke = terrainStrokeRef.current;
    const pointer = stageRef.current?.getRelativePointerPosition();
    if (!stroke || !pointer) return;
    const x = Math.max(0, Math.min(document.map.width, pointer.x));
    const y = Math.max(0, Math.min(document.map.height, pointer.y));
    const previousX = stroke.points.at(-2) ?? x;
    const previousY = stroke.points.at(-1) ?? y;
    if (Math.hypot(x - previousX, y - previousY) < stroke.width * 0.05) return;
    const next = { ...stroke, points: [...stroke.points, x, y] };
    terrainStrokeRef.current = next;
    setDraftTerrainStroke(next);
  };

  return (
    <main
      className={`map-workspace ${rightPanning ? "is-panning" : ""} ${terrainBrushActive ? "is-painting" : ""} ${marquee ? "is-selecting" : ""}`}
      ref={containerRef}
      data-viewport-x={viewport.x}
      data-viewport-y={viewport.y}
    >
      <Stage
        ref={stageRef}
        width={size.width || 320}
        height={size.height || 300}
        x={viewport.x}
        y={viewport.y}
        scaleX={viewport.scale}
        scaleY={viewport.scale}
        draggable={false}
        onDragEnd={(event) => {
          if (event.target !== event.currentTarget) return;
          setViewport((current) => ({
            ...current,
            x: event.target.x(),
            y: event.target.y(),
          }));
        }}
        onWheel={onWheel}
        onMouseDown={(event) => {
          if (terrainBrushActive && event.evt.button === 0) {
            event.evt.preventDefault();
            startTerrainStroke();
            return;
          }
          if (event.evt.button === 0) {
            startMarqueeSelection(event);
            return;
          }
          if (event.evt.button !== 2) return;
          event.evt.preventDefault();
          rightPanRef.current = {
            clientX: event.evt.clientX,
            clientY: event.evt.clientY,
            viewport,
            moved: false,
          };
          setRightPanning(true);
        }}
        onMouseMove={(event) => {
          if (terrainStrokeRef.current) {
            event.evt.preventDefault();
            extendTerrainStroke();
            return;
          }
          if (marquee) {
            const pointer = getClampedMapPointer();
            if (pointer) setMarquee((current) => current ? { ...current, current: pointer } : null);
            return;
          }
          const pan = rightPanRef.current;
          if (!pan) return;
          const deltaX = event.evt.clientX - pan.clientX;
          const deltaY = event.evt.clientY - pan.clientY;
          if (Math.hypot(deltaX, deltaY) > 3) pan.moved = true;
          setViewport({
            ...pan.viewport,
            x: pan.viewport.x + deltaX,
            y: pan.viewport.y + deltaY,
          });
        }}
        onMouseUp={(event) => {
          if (event.evt.button === 0 && terrainStrokeRef.current) {
            finishTerrainStroke();
            return;
          }
          if (event.evt.button === 2) finishRightPan();
        }}
        onContextMenu={(event) => event.evt.preventDefault()}
      >
        <Layer>
          <Group
            clipX={0}
            clipY={0}
            clipWidth={document.map.width}
            clipHeight={document.map.height}
          >
          {visibleLayers.background && (
            <Group>
              <Rect
                name="map-selection-surface"
                x={0}
                y={0}
                width={document.map.width}
                height={document.map.height}
                fill={MAP_BACKGROUND}
                stroke="#829187"
                strokeWidth={2}
              />
              {groundTextureImage && (
                <Rect
                  x={0}
                  y={0}
                  width={document.map.width}
                  height={document.map.height}
                  fillPatternImage={groundTextureImage}
                  fillPatternRepeat="repeat"
                  fillPatternScaleX={0.62}
                  fillPatternScaleY={0.62}
                  opacity={0.78}
                  listening={false}
                />
              )}
            </Group>
          )}

          {visibleLayers.terrain &&
            document.map.terrainStrokes.map((stroke) => (
              <TerrainStrokeArtwork key={stroke.id} stroke={stroke} />
            ))}
          {visibleLayers.terrain && draftTerrainStroke && (
            <TerrainStrokeArtwork stroke={draftTerrainStroke} />
          )}

          {visibleLayers.reference && referenceImage && (
            <KonvaImage
              image={referenceImage}
              x={0}
              y={0}
              width={document.map.width}
              height={document.map.height}
              opacity={0.72}
              listening={false}
            />
          )}

          {visibleLayers.terrain &&
            [...getOrderedLayerObjects(document, "terrain")]
              .reverse()
              .filter((object) =>
                object.kind === "path"
                && object.value.kind === "river"
                && isSceneObjectVisible(document, object.id),
              )
              .map((object) => object.kind === "path" && (
                <PathNode
                  key={object.id}
                  path={object.value}
                  bridgeImage={bridgeImage}
                  riverTexture={riverTextureImage}
                  roadTexture={roadTextureImage}
                  onOpenContextMenu={openContextMenu}
                />
              ))}

          {visibleLayers.zones && [...getOrderedLayerObjects(document, "zones")]
            .reverse()
            .filter((object) => isSceneObjectVisible(document, object.id))
            .map((object) => {
              if (object.kind === "zone") {
                const zone = object.value;
                return (
                  <MapZoneNode
                    key={zone.id}
                    zone={zone}
                    selected={selectedIds.includes(zone.id)}
                    labelsVisible={visibleLayers.labels}
                    snapEnabled={snapEnabled}
                    gridSize={document.map.grid.size}
                    wheatFieldImage={wheatFieldImage}
                    treeAtlasImage={treeAtlasImage}
                    locked={isSceneObjectLocked(document, zone.id)}
                    onSelect={(mode) => select(zone.id, mode)}
                    onChange={(changes) => {
                      if (
                        selectedIds.length > 1
                        && selectedIds.includes(zone.id)
                        && changes.x !== undefined
                        && changes.y !== undefined
                      ) {
                        nudgeSelected({ x: changes.x - zone.x, y: changes.y - zone.y });
                      } else updateZone(zone.id, changes);
                    }}
                  />
                );
              }
              if (object.kind === "decoration") {
                const decoration = object.value;
                return (
                  <MapDecorationNode
                    key={decoration.id}
                    decoration={decoration}
                    selected={selectedIds.includes(decoration.id)}
                    locked={isSceneObjectLocked(document, decoration.id)}
                    snapEnabled={snapEnabled}
                    gridSize={document.map.grid.size}
                    onSelect={(mode) => select(decoration.id, mode)}
                    onChange={(changes) => {
                      if (
                        changes.position
                        && selectedIds.length > 1
                        && selectedIds.includes(decoration.id)
                      ) {
                        nudgeSelected({
                          x: changes.position.x - decoration.position.x,
                          y: changes.position.y - decoration.position.y,
                        });
                      } else updateDecoration(decoration.id, changes);
                    }}
                  />
                );
              }
              return null;
            })}

          {gridLines}

          {visibleLayers.infrastructure && [...getOrderedLayerObjects(document, "infrastructure")]
            .reverse()
            .filter((object) => isSceneObjectVisible(document, object.id))
            .map((object) => {
              if (object.kind === "path") {
                return (
                  <PathNode
                    key={object.id}
                    path={object.value}
                    bridgeImage={bridgeImage}
                    riverTexture={riverTextureImage}
                    roadTexture={roadTextureImage}
                    onOpenContextMenu={openContextMenu}
                  />
                );
              }
              if (object.kind === "palisade") {
                return (
                  <PalisadeNode
                    key={object.id}
                    palisade={object.value}
                    onOpenContextMenu={openContextMenu}
                  />
                );
              }
              if (object.kind === "gate") {
                return <GateNode key={object.id} gate={object.value} />;
              }
              return null;
            })}

          {visibleLayers.buildings && [...getOrderedLayerObjects(document, "buildings")]
            .reverse()
            .filter((object) => object.kind === "building" && isSceneObjectVisible(document, object.id))
            .map((object) => object.kind === "building" && (
              <BuildingNode
                key={object.id}
                building={object.value}
                mapScale={viewport.scale}
              />
            ))}

          {visibleLayers.markers && [...getOrderedLayerObjects(document, "markers")]
            .reverse()
            .filter((object) => object.kind === "marker" && isSceneObjectVisible(document, object.id))
            .map((object) => {
              if (object.kind !== "marker") return null;
              const marker = object.value;
              return (
                <MapMarkerNode
                  key={marker.id}
                  marker={marker}
                  image={marker.type === "well" ? wellImage : fireImage}
                  labelsVisible={visibleLayers.labels}
                  selected={selectedIds.includes(marker.id)}
                  locked={isSceneObjectLocked(document, marker.id)}
                  onSelect={(mode) => select(marker.id, mode)}
                  onMove={(position) => {
                    const x = snapEnabled ? snapCoordinate(position.x, document.map.grid.size) : position.x;
                    const y = snapEnabled ? snapCoordinate(position.y, document.map.grid.size) : position.y;
                    if (selectedIds.length > 1 && selectedIds.includes(marker.id)) {
                      nudgeSelected({ x: x - marker.position.x, y: y - marker.position.y });
                    } else updateMarker(marker.id, { position: { x, y } });
                  }}
                />
              );
            })}

          {visibleLayers.gm && (
            <Group listening={false}>
              <Circle
                x={document.map.width * 0.61}
                y={document.map.height * 0.86}
                radius={26}
                fill="#8f4e78"
                opacity={0.72}
              />
              <Text
                x={document.map.width * 0.61 - 26}
                y={document.map.height * 0.86 - 7}
                width={52}
                text="GM"
                align="center"
                fontFamily="Inter, system-ui, sans-serif"
                fontSize={12}
                fontStyle="bold"
                fill="#ffffff"
              />
            </Group>
          )}
          {terrainBrushActive && (
            <Rect
              x={0}
              y={0}
              width={document.map.width}
              height={document.map.height}
              fill="rgba(255, 255, 255, 0.001)"
            />
          )}
          </Group>

          {marquee && (
            <Rect
              x={Math.min(marquee.start.x, marquee.current.x)}
              y={Math.min(marquee.start.y, marquee.current.y)}
              width={Math.abs(marquee.current.x - marquee.start.x)}
              height={Math.abs(marquee.current.y - marquee.start.y)}
              fill="rgba(22, 127, 134, 0.14)"
              stroke="#167f86"
              strokeWidth={1.5 / viewport.scale}
              dash={[7 / viewport.scale, 4 / viewport.scale]}
              listening={false}
            />
          )}
          {!presentationMode && multiSelectionBounds && (
            <MultiSelectionTransformer bounds={multiSelectionBounds} />
          )}

          {!presentationMode && selectedIds.length === 1 && selectedBuilding && visibleLayers.buildings && isSceneObjectVisible(document, selectedBuilding.id) && (
            <BuildingNode
              building={selectedBuilding}
              mapScale={viewport.scale}
              controlsOnly
            />
          )}
          {!presentationMode && selectedIds.length === 1 && selectedZone && visibleLayers.zones && isSceneObjectVisible(document, selectedZone.id) && (
            <MapZoneNode
              zone={selectedZone}
              selected
              labelsVisible={visibleLayers.labels}
              snapEnabled={snapEnabled}
              gridSize={document.map.grid.size}
              wheatFieldImage={wheatFieldImage}
              treeAtlasImage={treeAtlasImage}
              locked={isSceneObjectLocked(document, selectedZone.id)}
              onSelect={(mode) => select(selectedZone.id, mode)}
              onChange={(changes) => updateZone(selectedZone.id, changes)}
              controlsOnly
            />
          )}
          {!presentationMode && selectedIds.length === 1 && selectedDecoration && visibleLayers.zones && isSceneObjectVisible(document, selectedDecoration.id) && (
            <MapDecorationNode
              decoration={selectedDecoration}
              selected
              locked={isSceneObjectLocked(document, selectedDecoration.id)}
              snapEnabled={snapEnabled}
              gridSize={document.map.grid.size}
              onSelect={(mode) => select(selectedDecoration.id, mode)}
              onChange={(changes) => updateDecoration(selectedDecoration.id, changes)}
              controlsOnly
            />
          )}
          {!presentationMode && selectedIds.length === 1 && selectedPath && isSceneObjectVisible(document, selectedPath.id) &&
            ((selectedPath.kind === "river" && visibleLayers.terrain) ||
              (selectedPath.kind !== "river" && visibleLayers.infrastructure)) && (
              <PathNode
                path={selectedPath}
                bridgeImage={bridgeImage}
                riverTexture={riverTextureImage}
                roadTexture={roadTextureImage}
                onOpenContextMenu={openContextMenu}
                controlsOnly
              />
            )}
          {!presentationMode && selectedIds.length === 1 && selectedPalisade && visibleLayers.infrastructure && isSceneObjectVisible(document, selectedPalisade.id) && (
            <PalisadeNode
              palisade={selectedPalisade}
              onOpenContextMenu={openContextMenu}
              controlsOnly
            />
          )}
          {!presentationMode && selectedIds.length === 1 && selectedGate && visibleLayers.infrastructure && isSceneObjectVisible(document, selectedGate.id) && (
            <GateNode gate={selectedGate} controlsOnly />
          )}
        </Layer>
      </Stage>

      {contextMenu && !presentationMode && (
        <div
          className="canvas-context-menu"
          role="menu"
          aria-label={t("canvas.editGeometry")}
          style={{ left: contextMenu.left, top: contextMenu.top }}
          onContextMenu={(event) => event.preventDefault()}
        >
          {contextMenu.kind === "path-anchor" ? (
            <>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={contextAnchor?.mode === "corner"}
                className={contextAnchor?.mode === "corner" ? "is-active" : undefined}
                onClick={() => setContextPathMode("corner")}
              >
                <Square size={15} /> {t("canvas.cornerPoint")}
              </button>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={contextAnchor?.mode === "smooth"}
                className={contextAnchor?.mode === "smooth" ? "is-active" : undefined}
                onClick={() => setContextPathMode("smooth")}
              >
                <Spline size={15} /> {t("canvas.smoothPoint")}
              </button>
              <span className="canvas-context-separator" />
              <button
                type="button"
                role="menuitem"
                className="is-danger"
                disabled={!canRemoveContextPoint}
                onClick={removeContextPoint}
              >
                <Trash2 size={15} /> {t("canvas.deletePoint")}
              </button>
            </>
          ) : contextMenu.kind === "path-segment" ? (
            <button type="button" role="menuitem" onClick={insertContextPoint}>
              <Plus size={15} /> {t("canvas.insertPoint")}
            </button>
          ) : contextMenu.kind === "palisade-segment" ? (
            <button type="button" role="menuitem" onClick={insertContextPoint}>
              <Plus size={15} /> {t("canvas.insertNode")}
            </button>
          ) : (
            <>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={contextPalisadeMode === "corner"}
                className={contextPalisadeMode === "corner" ? "is-active" : undefined}
                disabled={!canSetContextPalisadeMode}
                onClick={() => setContextPalisadeMode("corner")}
              >
                <Square size={15} /> {t("canvas.cornerNode")}
              </button>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={contextPalisadeMode === "smooth"}
                className={contextPalisadeMode === "smooth" ? "is-active" : undefined}
                disabled={!canSetContextPalisadeMode}
                onClick={() => setContextPalisadeMode("smooth")}
              >
                <Spline size={15} /> {t("canvas.smoothNode")}
              </button>
              <span className="canvas-context-separator" />
              <button
                type="button"
                role="menuitem"
                className="is-danger"
                disabled={!canRemoveContextPoint}
                onClick={removeContextPoint}
              >
                <Trash2 size={15} /> {t("canvas.removeNode")}
              </button>
            </>
          )}
        </div>
      )}

      {!presentationMode && (
        <div className="map-controls" aria-label={t("canvas.viewport")}>
          <span className="map-scale">
            {t("grid.scaleSummary", {
              distance: document.map.grid.distance.toLocaleString(locale),
            })}
          </span>
          <IconButton label={t("canvas.zoomIn")} onClick={() => setZoom(viewport.scale * 1.15)}>
            <Plus size={17} />
          </IconButton>
          <span>{Math.round(viewport.scale * 100)}%</span>
          <IconButton label={t("canvas.zoomOut")} onClick={() => setZoom(viewport.scale / 1.15)}>
            <Minus size={17} />
          </IconButton>
          <IconButton label={t("canvas.fitMap")} onClick={fitMap}>
            <Maximize2 size={17} />
          </IconButton>
        </div>
      )}

      {!presentationMode && (
        <div className="map-legend">
          <span><i className="legend-existing" /> {t("status.existing")}</span>
          <span><i className="legend-construction" /> {t("status.construction")}</span>
          <span><i className="legend-planned" /> {t("status.planned")}</span>
        </div>
      )}
    </main>
  );
}
