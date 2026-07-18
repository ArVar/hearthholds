import type {
  EditorDocument,
  MapLayerId,
  MapLayerState,
  MapObjectGroup,
  MapObjectState,
  SelectableMapObject,
} from "./types";

export const defaultMapLayerStates: MapLayerState[] = [
  { id: "background", visible: true, locked: false },
  { id: "reference", visible: false, locked: false },
  { id: "terrain", visible: true, locked: false },
  { id: "infrastructure", visible: true, locked: false },
  { id: "buildings", visible: true, locked: false },
  { id: "markers", visible: true, locked: false },
  { id: "zones", visible: true, locked: false },
  { id: "labels", visible: true, locked: false },
  { id: "gm", visible: false, locked: false },
];

export type SceneObjectEntry = SelectableMapObject & {
  id: string;
  name: string;
  layerId: MapLayerId;
};

export function getSceneObjects(document: EditorDocument): SceneObjectEntry[] {
  return [
    ...document.map.paths.map((value) => ({
      id: value.id,
      name: value.name,
      layerId: value.kind === "river" ? "terrain" as const : "infrastructure" as const,
      kind: "path" as const,
      value,
    })),
    ...document.map.palisades.map((value) => ({
      id: value.id,
      name: value.name,
      layerId: "infrastructure" as const,
      kind: "palisade" as const,
      value,
    })),
    ...document.map.gates.map((value) => ({
      id: value.id,
      name: value.name,
      layerId: "infrastructure" as const,
      kind: "gate" as const,
      value,
    })),
    ...document.map.markers.map((value) => ({
      id: value.id,
      name: value.name,
      layerId: "markers" as const,
      kind: "marker" as const,
      value,
    })),
    ...document.map.buildings.map((value) => ({
      id: value.id,
      name: value.name,
      layerId: "buildings" as const,
      kind: "building" as const,
      value,
    })),
    ...document.map.zones.map((value) => ({
      id: value.id,
      name: value.name,
      layerId: "zones" as const,
      kind: "zone" as const,
      value,
    })),
    ...document.map.decorations.map((value) => ({
      id: value.id,
      name: value.name,
      layerId: "zones" as const,
      kind: "decoration" as const,
      value,
    })),
  ];
}

/** Returns objects from visually frontmost to backmost. */
export function getOrderedSceneObjects(document: EditorDocument): SceneObjectEntry[] {
  const objects = getSceneObjects(document);
  const byId = new Map(objects.map((object) => [object.id, object]));
  const explicitIds = [...new Set(
    document.map.scene.objectOrder.filter((id) => byId.has(id)),
  )];
  const orderedIds = [
    ...explicitIds,
    ...objects.map((object) => object.id).reverse().filter(
      (id) => !explicitIds.includes(id),
    ),
  ];
  return orderedIds.map((id) => byId.get(id)).filter(
    (object): object is SceneObjectEntry => Boolean(object),
  );
}

export function getOrderedLayerObjects(
  document: EditorDocument,
  layerId: MapLayerId,
): SceneObjectEntry[] {
  return getOrderedSceneObjects(document).filter((object) => object.layerId === layerId);
}

export function reorderSceneObject(
  document: EditorDocument,
  objectId: string,
  beforeObjectId: string | null,
): void {
  const objects = getSceneObjects(document);
  const source = objects.find((object) => object.id === objectId);
  const target = beforeObjectId
    ? objects.find((object) => object.id === beforeObjectId)
    : null;
  if (!source || (target && source.layerId !== target.layerId)) return;

  const orderedIds = getOrderedSceneObjects(document).map((object) => object.id);
  const withoutSource = orderedIds.filter((id) => id !== objectId);
  const targetIndex = beforeObjectId ? withoutSource.indexOf(beforeObjectId) : -1;
  if (targetIndex >= 0) withoutSource.splice(targetIndex, 0, objectId);
  else {
    const sameLayerIndices = withoutSource
      .map((id, index) => ({ object: objects.find((item) => item.id === id), index }))
      .filter(({ object }) => object?.layerId === source.layerId)
      .map(({ index }) => index);
    const insertionIndex = sameLayerIndices.length > 0
      ? sameLayerIndices.at(-1)! + 1
      : withoutSource.length;
    withoutSource.splice(insertionIndex, 0, objectId);
  }
  if (
    withoutSource.length !== document.map.scene.objectOrder.length
    || withoutSource.some((id, index) => document.map.scene.objectOrder[index] !== id)
  ) {
    document.map.scene.objectOrder = withoutSource;
  }
}

export function getLayerState(
  document: EditorDocument,
  layerId: MapLayerId,
): MapLayerState {
  return document.map.scene.layers.find((layer) => layer.id === layerId)
    ?? defaultMapLayerStates.find((layer) => layer.id === layerId)
    ?? { id: layerId, visible: true, locked: false };
}

export function getObjectState(
  document: EditorDocument,
  objectId: string,
): MapObjectState {
  return document.map.scene.objects.find((object) => object.id === objectId)
    ?? { id: objectId, visible: true, locked: false };
}

export function getObjectGroups(
  document: EditorDocument,
  objectId: string,
): MapObjectGroup[] {
  return document.map.scene.groups.filter((group) => group.objectIds.includes(objectId));
}

export function isSceneObjectVisible(
  document: EditorDocument,
  objectId: string,
): boolean {
  const object = getSceneObjects(document).find((candidate) => candidate.id === objectId);
  if (!object || !getLayerState(document, object.layerId).visible) return false;
  if (!getObjectState(document, objectId).visible) return false;
  return getObjectGroups(document, objectId).every((group) => group.visible);
}

export function isSceneObjectLocked(
  document: EditorDocument,
  objectId: string,
): boolean {
  const object = getSceneObjects(document).find((candidate) => candidate.id === objectId);
  if (!object) return false;
  if (getLayerState(document, object.layerId).locked) return true;
  if (getObjectState(document, objectId).locked) return true;
  return getObjectGroups(document, objectId).some((group) => group.locked);
}

export function getLayerVisibility(
  document: EditorDocument,
): Record<MapLayerId, boolean> {
  return Object.fromEntries(
    defaultMapLayerStates.map((layer) => [
      layer.id,
      getLayerState(document, layer.id).visible,
    ]),
  ) as Record<MapLayerId, boolean>;
}

export function upsertObjectState(
  document: EditorDocument,
  objectId: string,
  changes: Partial<Omit<MapObjectState, "id">>,
): void {
  const current = document.map.scene.objects.find((object) => object.id === objectId);
  if (current) Object.assign(current, changes);
  else document.map.scene.objects.push({ id: objectId, visible: true, locked: false, ...changes });
}
