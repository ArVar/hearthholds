import {
  BrickWall,
  CircleDot,
  DoorOpen,
  Eye,
  EyeOff,
  Fence,
  Folder,
  GripVertical,
  Group as GroupIcon,
  Home,
  Layers3,
  Lock,
  Maximize2,
  Minimize2,
  PackageOpen,
  Route,
  Search,
  Sprout,
  Ungroup,
  Unlock,
  X,
} from "lucide-react";
import type { DragEvent, MouseEvent, ReactNode } from "react";
import { useState } from "react";
import {
  getLayerState,
  getObjectGroups,
  getObjectState,
  getOrderedSceneObjects,
  isSceneObjectLocked,
  isSceneObjectVisible,
  type SceneObjectEntry,
} from "../domain/scene";
import { mapLayerIds, type MapLayerId } from "../domain/types";
import { useI18n } from "../i18n/I18nProvider";
import { useEditorStore } from "../store/editorStore";
import { IconButton } from "./IconButton";

const browserLayers: MapLayerId[] = [
  "gm",
  "labels",
  "markers",
  "buildings",
  "infrastructure",
  "zones",
  "terrain",
  "reference",
  "background",
];

function ObjectIcon({ object }: { object: SceneObjectEntry }) {
  if (object.kind === "building") return <Home size={15} />;
  if (object.kind === "palisade") {
    return object.value.style === "wall" ? <BrickWall size={15} /> : <Fence size={15} />;
  }
  if (object.kind === "gate") return <DoorOpen size={15} />;
  if (object.kind === "path") return <Route size={15} />;
  if (object.kind === "zone") return <Sprout size={15} />;
  if (object.kind === "decoration") return <PackageOpen size={15} />;
  return <CircleDot size={15} />;
}

function RowAction({
  label,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="scene-row-action"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

function SceneObjectRow({
  object,
  dragging,
  dropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  object: SceneObjectEntry;
  dragging: boolean;
  dropTarget: boolean;
  onDragStart: (event: DragEvent<HTMLDivElement>, object: SceneObjectEntry) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>, object: SceneObjectEntry) => void;
  onDrop: (event: DragEvent<HTMLDivElement>, object: SceneObjectEntry) => void;
}) {
  const { t } = useI18n();
  const document = useEditorStore((state) => state.document);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const select = useEditorStore((state) => state.select);
  const setObjectVisible = useEditorStore((state) => state.setObjectVisible);
  const setObjectLocked = useEditorStore((state) => state.setObjectLocked);
  const directState = getObjectState(document, object.id);
  const effectiveVisible = isSceneObjectVisible(document, object.id);
  const effectiveLocked = isSceneObjectLocked(document, object.id);
  const groups = getObjectGroups(document, object.id);
  const inheritedLock = effectiveLocked && !directState.locked;

  const selectObject = (event: MouseEvent<HTMLButtonElement>) => {
    select(
      object.id,
      event.metaKey || event.ctrlKey || event.shiftKey ? "toggle" : "replace",
    );
  };

  return (
    <div
      className={`scene-object-row ${selectedIds.includes(object.id) ? "is-selected" : ""} ${dragging ? "is-dragging" : ""} ${dropTarget ? "is-drop-target" : ""}`}
      draggable={!effectiveLocked}
      title={effectiveLocked ? undefined : t("scene.dragToReorder")}
      onDragStart={(event) => onDragStart(event, object)}
      onDragEnd={onDragEnd}
      onDragOver={(event) => onDragOver(event, object)}
      onDrop={(event) => onDrop(event, object)}
    >
      <button type="button" className="scene-object-select" onClick={selectObject}>
        <GripVertical className="scene-drag-handle" size={13} aria-hidden="true" />
        <ObjectIcon object={object} />
        <span>
          <strong>{object.name}</strong>
          <small>
            {object.kind === "building"
              ? object.value.subtitle
              : t(`scene.kind.${object.kind}`)}
          </small>
        </span>
      </button>
      <RowAction
        label={effectiveVisible ? t("scene.hideObject") : t("scene.showObject")}
        disabled={!effectiveVisible && groups.some((group) => !group.visible)}
        onClick={() => setObjectVisible(object.id, !directState.visible)}
      >
        {effectiveVisible ? <Eye size={14} /> : <EyeOff size={14} />}
      </RowAction>
      <RowAction
        label={effectiveLocked ? t("scene.unlockObject") : t("scene.lockObject")}
        disabled={inheritedLock}
        onClick={() => setObjectLocked(object.id, !directState.locked)}
      >
        {effectiveLocked ? <Lock size={14} /> : <Unlock size={14} />}
      </RowAction>
    </div>
  );
}

export function SceneBrowserPanel({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const document = useEditorStore((state) => state.document);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const selectMany = useEditorStore((state) => state.selectMany);
  const setLayerVisible = useEditorStore((state) => state.setLayerVisible);
  const setLayerLocked = useEditorStore((state) => state.setLayerLocked);
  const setGroupVisible = useEditorStore((state) => state.setGroupVisible);
  const setGroupLocked = useEditorStore((state) => state.setGroupLocked);
  const groupSelected = useEditorStore((state) => state.groupSelected);
  const ungroupSelected = useEditorStore((state) => state.ungroupSelected);
  const renameGroup = useEditorStore((state) => state.renameGroup);
  const reorderObject = useEditorStore((state) => state.reorderObject);
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const allObjects = getOrderedSceneObjects(document);
  const groupedIds = new Set(
    document.map.scene.groups.flatMap((group) => group.objectIds),
  );
  const matchesSearch = (object: SceneObjectEntry) =>
    !normalizedSearch || object.name.toLocaleLowerCase().includes(normalizedSearch);
  const startObjectDrag = (
    event: DragEvent<HTMLDivElement>,
    object: SceneObjectEntry,
  ) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", object.id);
    setDraggingId(object.id);
  };
  const finishObjectDrag = () => {
    setDraggingId(null);
    setDropTargetId(null);
  };
  const dropObjectBefore = (
    event: DragEvent<HTMLDivElement>,
    target: SceneObjectEntry,
  ) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("text/plain") || draggingId;
    const source = allObjects.find((object) => object.id === sourceId);
    if (source && source.id !== target.id && source.layerId === target.layerId) {
      const layerObjects = allObjects.filter((object) => object.layerId === target.layerId);
      const targetIndex = layerObjects.findIndex((object) => object.id === target.id);
      const dropAfterTarget = event.clientY > event.currentTarget.getBoundingClientRect().top
        + event.currentTarget.getBoundingClientRect().height / 2;
      const beforeId = dropAfterTarget
        ? layerObjects.at(targetIndex + 1)?.id ?? null
        : target.id;
      reorderObject(source.id, beforeId);
    }
    finishObjectDrag();
  };
  const dragObjectOver = (
    event: DragEvent<HTMLDivElement>,
    target: SceneObjectEntry,
  ) => {
    const source = allObjects.find((object) => object.id === draggingId);
    if (!source || source.layerId !== target.layerId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetId(target.id);
  };
  const objectRow = (object: SceneObjectEntry) => (
    <SceneObjectRow
      key={object.id}
      object={object}
      dragging={draggingId === object.id}
      dropTarget={dropTargetId === object.id}
      onDragStart={startObjectDrag}
      onDragEnd={finishObjectDrag}
      onDragOver={dragObjectOver}
      onDrop={dropObjectBefore}
    />
  );

  return (
    <aside
      className={`inspector scene-browser-panel ${expanded ? "is-expanded" : ""}`}
      aria-label={t("scene.browser")}
    >
      <div className="inspector-header">
        <div className="object-type-icon">
          <Layers3 size={19} />
        </div>
        <div>
          <span>{t("scene.mapStructure")}</span>
          <strong>{t("scene.browser")}</strong>
        </div>
        <IconButton
          label={expanded ? t("scene.collapse") : t("scene.expand")}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </IconButton>
        <IconButton label={t("common.close")} onClick={onClose}>
          <X size={17} />
        </IconButton>
      </div>

      <div className="scene-browser-toolbar">
        <label className="scene-browser-search">
          <Search size={15} />
          <input
            type="search"
            value={search}
            placeholder={t("scene.search")}
            aria-label={t("scene.search")}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={selectedIds.length < 2}
          onClick={() => groupSelected(t("scene.newGroup", { count: document.map.scene.groups.length + 1 }))}
        >
          <GroupIcon size={15} /> {t("scene.group")}
        </button>
        <button
          type="button"
          disabled={!document.map.scene.groups.some((group) =>
            group.objectIds.some((id) => selectedIds.includes(id)),
          )}
          onClick={ungroupSelected}
        >
          <Ungroup size={15} /> {t("scene.ungroup")}
        </button>
      </div>

      <div className="inspector-scroll scene-browser-tree">
        {document.map.scene.groups.map((group) => {
          const groupObjects = allObjects.filter(
            (object) => group.objectIds.includes(object.id) && matchesSearch(object),
          );
          if (normalizedSearch && groupObjects.length === 0) return null;
          return (
            <details className="scene-tree-section is-group" key={group.id} open>
              <summary>
                <Folder size={15} />
                <input
                  aria-label={t("scene.groupName")}
                  defaultValue={group.name}
                  onClick={(event) => event.stopPropagation()}
                  onBlur={(event) => {
                    const name = event.target.value.trim();
                    if (name && name !== group.name) renameGroup(group.id, name);
                  }}
                />
                <span className="count-badge">{group.objectIds.length}</span>
                <RowAction
                  label={group.visible ? t("scene.hideGroup") : t("scene.showGroup")}
                  onClick={() => setGroupVisible(group.id, !group.visible)}
                >
                  {group.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </RowAction>
                <RowAction
                  label={group.locked ? t("scene.unlockGroup") : t("scene.lockGroup")}
                  onClick={() => setGroupLocked(group.id, !group.locked)}
                >
                  {group.locked ? <Lock size={14} /> : <Unlock size={14} />}
                </RowAction>
              </summary>
              <button
                type="button"
                className="scene-select-group"
                onClick={() => selectMany(group.objectIds)}
              >
                {t("scene.selectGroup")}
              </button>
              <div className="scene-tree-children">
                {groupObjects.map(objectRow)}
              </div>
            </details>
          );
        })}

        {browserLayers.filter((layer) =>
          mapLayerIds.includes(layer)
          && (layer !== "reference" || Boolean(document.map.referenceAssetId))
        ).map((layerId) => {
          const layer = getLayerState(document, layerId);
          const objects = allObjects.filter(
            (object) => object.layerId === layerId && !groupedIds.has(object.id) && matchesSearch(object),
          );
          if (normalizedSearch && objects.length === 0) return null;
          return (
            <details className="scene-tree-section" key={layerId} open={objects.length > 0 || undefined}>
              <summary>
                <Layers3 size={15} />
                <strong>{t(`layer.${layerId}`)}</strong>
                <span className="count-badge">{objects.length}</span>
                <RowAction
                  label={layer.visible ? t("scene.hideLayer") : t("scene.showLayer")}
                  onClick={() => setLayerVisible(layerId, !layer.visible)}
                >
                  {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </RowAction>
                <RowAction
                  label={layer.locked ? t("scene.unlockLayer") : t("scene.lockLayer")}
                  onClick={() => setLayerLocked(layerId, !layer.locked)}
                >
                  {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
                </RowAction>
              </summary>
              {objects.length > 0 && (
                <div className="scene-tree-children">
                  {objects.map(objectRow)}
                </div>
              )}
            </details>
          );
        })}
      </div>
    </aside>
  );
}
