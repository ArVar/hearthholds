import { produce } from "immer";
import { create } from "zustand";
import {
  canReserveCurrentPhase,
  createConstructionProject,
  getCurrentPhase,
  hasRequiredProjectWorkforce,
  standardBuildPlan,
  standardBuildPlanId,
} from "../domain/construction";
import { advanceDocumentCycle } from "../domain/dailyCycle";
import { toBaseCurrency } from "../domain/currency";
import { snapAngle } from "../domain/geometry";
import { resizeDocumentMap, type MapResizeAnchor } from "../domain/mapResize";
import { getPathAnchors, syncPathGeometry, translatePathAnchors } from "../domain/pathGeometry";
import {
  getLayerState,
  getLayerVisibility,
  isSceneObjectLocked,
  reorderSceneObject,
  upsertObjectState,
} from "../domain/scene";
import {
  getSceneSelectionBounds,
  transformSceneSelection,
  type SceneTransform,
} from "../domain/sceneGeometry";
import { constructionStages, forestDensityRange } from "../domain/types";
import { getBuildingOperationDefaults } from "../domain/visualAssets";
import {
  canRecruitResidents,
  getAssignedResidentWorkers,
  getAssignableResidentWorkers,
  isBuildingOperational,
  normalizeProductionOutputs,
  normalizeWorkforce,
} from "../domain/workforce";
import { createDefaultDocument } from "../persistence/bundledDocuments";
import type {
  Building,
  EditorDocument,
  ExternalResourceSource,
  Gate,
  MapLayerId,
  MapGrid,
  MapDecoration,
  MapMarker,
  MapPath,
  MapZone,
  Palisade,
  PlaceableMapObject,
  ResourceSummary,
  SelectableMapObject,
  TerrainBrushSettings,
  TerrainStroke,
  Treasury,
  WorkforceAllocation,
} from "../domain/types";

const HISTORY_LIMIT = 80;

type EditorState = {
  document: EditorDocument;
  past: EditorDocument[];
  future: EditorDocument[];
  selectedId: string | null;
  selectedIds: string[];
  selectedPathAnchorIndex: number | null;
  visibleLayers: Record<MapLayerId, boolean>;
  presentationMode: boolean;
  gridVisible: boolean;
  snapEnabled: boolean;
  activeTerrainBrush: TerrainBrushSettings | null;
  hydrated: boolean;
  dirty: boolean;
  select: (id: string | null, mode?: "replace" | "add" | "toggle") => void;
  selectMany: (ids: string[]) => void;
  selectPathAnchor: (index: number | null) => void;
  setLayerVisible: (layer: MapLayerId, visible: boolean) => void;
  setLayerLocked: (layer: MapLayerId, locked: boolean) => void;
  setObjectVisible: (id: string, visible: boolean) => void;
  setObjectLocked: (id: string, locked: boolean) => void;
  setSelectedLocked: (locked: boolean) => void;
  setGroupVisible: (id: string, visible: boolean) => void;
  setGroupLocked: (id: string, locked: boolean) => void;
  groupSelected: (name?: string) => void;
  ungroupSelected: () => void;
  renameGroup: (id: string, name: string) => void;
  reorderObject: (id: string, beforeId: string | null) => void;
  setPresentationMode: (enabled: boolean) => void;
  setGridVisible: (visible: boolean) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setActiveTerrainBrush: (brush: TerrainBrushSettings | null) => void;
  hydrate: (document: EditorDocument | null) => void;
  markSaved: (documentVersion: string) => void;
  updateBuilding: (id: string, changes: Partial<Building>) => void;
  updatePalisade: (id: string, changes: Partial<Palisade>) => void;
  updateGate: (id: string, changes: Partial<Gate>) => void;
  updatePath: (id: string, changes: Partial<MapPath>) => void;
  updateZone: (id: string, changes: Partial<MapZone>) => void;
  updateMarker: (id: string, changes: Partial<MapMarker>) => void;
  updateDecoration: (id: string, changes: Partial<MapDecoration>) => void;
  addResourceSource: (
    source: ExternalResourceSource,
    resource?: ResourceSummary,
  ) => void;
  updateResourceSource: (
    id: string,
    changes: Partial<ExternalResourceSource>,
  ) => void;
  removeResourceSource: (id: string) => void;
  updatePopulation: (changes: Partial<EditorDocument["population"]>) => void;
  updateTreasury: (changes: Partial<Treasury>) => void;
  recruitResidents: (residents: number, workingResidents: number) => void;
  updateProjectWorkforce: (
    projectId: string,
    workforce: WorkforceAllocation,
  ) => void;
  advanceCycle: () => void;
  updateMapGrid: (changes: Partial<MapGrid>) => void;
  updateMapSize: (
    changes: Partial<Pick<EditorDocument["map"], "width" | "height">>,
    anchor?: MapResizeAnchor,
  ) => void;
  rotateSelected: (delta: number) => void;
  nudgeSelected: (delta: { x: number; y: number }) => void;
  transformSelected: (transform: SceneTransform) => void;
  addBuilding: (building: Building) => void;
  addPalisade: (palisade: Palisade) => void;
  addPath: (path: MapPath) => void;
  addMapObject: (object: PlaceableMapObject) => void;
  addTerrainStroke: (stroke: TerrainStroke) => void;
  reserveProjectPhase: (projectId: string) => void;
  completeProjectPhase: (projectId: string) => void;
  setProjectPrerequisite: (projectId: string, prerequisiteId: string, fulfilled: boolean) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  getSelectedObject: () => SelectableMapObject | null;
  getSelectedObjects: () => SelectableMapObject[];
};

function withTimestamp(document: EditorDocument): EditorDocument {
  return { ...document, updatedAt: new Date().toISOString() };
}

function getInitialSelection(document: EditorDocument): string | null {
  return (
    document.projects.find((project) => project.status === "active")?.buildingId ??
    document.map.buildings[0]?.id ??
    document.map.palisades[0]?.id ??
    document.map.gates[0]?.id ??
    document.map.paths[0]?.id ??
    null
  );
}

function findSelectableMapObject(
  document: EditorDocument,
  id: string | null,
): SelectableMapObject | null {
  if (!id) return null;
  const building = document.map.buildings.find((item) => item.id === id);
  if (building) return { kind: "building", value: building };
  const palisade = document.map.palisades.find((item) => item.id === id);
  if (palisade) return { kind: "palisade", value: palisade };
  const gate = document.map.gates.find((item) => item.id === id);
  if (gate) return { kind: "gate", value: gate };
  const path = document.map.paths.find((item) => item.id === id);
  if (path) return { kind: "path", value: path };
  const zone = document.map.zones.find((item) => item.id === id);
  if (zone) return { kind: "zone", value: zone };
  const marker = document.map.markers.find((item) => item.id === id);
  if (marker) return { kind: "marker", value: marker };
  const decoration = document.map.decorations.find((item) => item.id === id);
  if (decoration) return { kind: "decoration", value: decoration };
  return null;
}

export const useEditorStore = create<EditorState>((set, get) => {
  const defaultDocument = createDefaultDocument();
  const commit = (nextDocument: EditorDocument) => {
    const current = get().document;
    if (nextDocument === current) {
      return;
    }

    set((state) => ({
      document: withTimestamp(nextDocument),
      visibleLayers: getLayerVisibility(nextDocument),
      past: [...state.past, current].slice(-HISTORY_LIMIT),
      future: [],
      dirty: true,
    }));
  };

  return {
    document: defaultDocument,
    past: [],
    future: [],
    selectedId: getInitialSelection(defaultDocument),
    selectedIds: [getInitialSelection(defaultDocument)].filter(
      (id): id is string => Boolean(id),
    ),
    selectedPathAnchorIndex: null,
    visibleLayers: getLayerVisibility(defaultDocument),
    presentationMode: false,
    gridVisible: true,
    snapEnabled: true,
    activeTerrainBrush: null,
    hydrated: false,
    dirty: false,
    select: (selectedId, mode = "replace") =>
      set((state) => {
        if (!selectedId) {
          return {
            selectedId: null,
            selectedIds: [],
            selectedPathAnchorIndex: null,
          };
        }
        const alreadySelected = state.selectedIds.includes(selectedId);
        const selectedIds = mode === "add"
          ? alreadySelected ? state.selectedIds : [...state.selectedIds, selectedId]
          : mode === "toggle"
            ? alreadySelected
              ? state.selectedIds.filter((id) => id !== selectedId)
              : [...state.selectedIds, selectedId]
            : [selectedId];
        const primarySelectedId = selectedIds.includes(selectedId)
          ? selectedId
          : selectedIds.at(-1) ?? null;
        return {
          selectedId: primarySelectedId,
          selectedIds,
          activeTerrainBrush: null,
          selectedPathAnchorIndex:
            primarySelectedId === state.selectedId && selectedIds.length === 1
              ? state.selectedPathAnchorIndex
              : null,
        };
      }),
    selectMany: (selectedIds) => {
      const uniqueIds = [...new Set(selectedIds)];
      set({
        selectedIds: uniqueIds,
        selectedId: uniqueIds.at(-1) ?? null,
        selectedPathAnchorIndex: null,
        activeTerrainBrush: null,
      });
    },
    selectPathAnchor: (selectedPathAnchorIndex) => set({ selectedPathAnchorIndex }),
    setLayerVisible: (layer, visible) => {
      const next = produce(get().document, (draft) => {
        const layerState = draft.map.scene.layers.find(
          (candidate) => candidate.id === layer,
        );
        if (layerState) layerState.visible = visible;
        else draft.map.scene.layers.push({ id: layer, visible, locked: false });
      });
      commit(next);
    },
    setLayerLocked: (layer, locked) => {
      const next = produce(get().document, (draft) => {
        const layerState = draft.map.scene.layers.find(
          (candidate) => candidate.id === layer,
        );
        if (layerState) layerState.locked = locked;
        else draft.map.scene.layers.push({ id: layer, visible: true, locked });
      });
      commit(next);
      if (layer === "terrain" && locked) set({ activeTerrainBrush: null });
    },
    setObjectVisible: (id, visible) => {
      const next = produce(get().document, (draft) => {
        upsertObjectState(draft as EditorDocument, id, { visible });
      });
      commit(next);
    },
    setObjectLocked: (id, locked) => {
      const next = produce(get().document, (draft) => {
        upsertObjectState(draft as EditorDocument, id, { locked });
      });
      commit(next);
    },
    setSelectedLocked: (locked) => {
      const ids = get().selectedIds;
      if (ids.length === 0) return;
      const next = produce(get().document, (draft) => {
        for (const id of ids) {
          upsertObjectState(draft as EditorDocument, id, { locked });
        }
      });
      commit(next);
    },
    setGroupVisible: (id, visible) => {
      const next = produce(get().document, (draft) => {
        const group = draft.map.scene.groups.find((candidate) => candidate.id === id);
        if (group) group.visible = visible;
      });
      commit(next);
    },
    setGroupLocked: (id, locked) => {
      const next = produce(get().document, (draft) => {
        const group = draft.map.scene.groups.find((candidate) => candidate.id === id);
        if (group) group.locked = locked;
      });
      commit(next);
    },
    groupSelected: (name) => {
      const ids = get().selectedIds;
      if (ids.length < 2) return;
      const next = produce(get().document, (draft) => {
        for (const group of draft.map.scene.groups) {
          group.objectIds = group.objectIds.filter((id) => !ids.includes(id));
        }
        draft.map.scene.groups = draft.map.scene.groups.filter(
          (group) => group.objectIds.length > 0,
        );
        draft.map.scene.groups.push({
          id: typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `group-${Date.now()}`,
          name: name ?? `Group ${draft.map.scene.groups.length + 1}`,
          objectIds: [...ids],
          visible: true,
          locked: false,
        });
      });
      commit(next);
    },
    ungroupSelected: () => {
      const ids = get().selectedIds;
      if (ids.length === 0) return;
      const next = produce(get().document, (draft) => {
        draft.map.scene.groups = draft.map.scene.groups.filter(
          (group) => !group.objectIds.some((id) => ids.includes(id)),
        );
      });
      commit(next);
    },
    renameGroup: (id, name) => {
      const next = produce(get().document, (draft) => {
        const group = draft.map.scene.groups.find((candidate) => candidate.id === id);
        if (group) group.name = name;
      });
      commit(next);
    },
    reorderObject: (id, beforeId) => {
      const next = produce(get().document, (draft) => {
        reorderSceneObject(draft as EditorDocument, id, beforeId);
      });
      commit(next);
    },
    setPresentationMode: (presentationMode) =>
      set((state) => ({
        presentationMode,
        activeTerrainBrush: presentationMode ? null : state.activeTerrainBrush,
      })),
    setGridVisible: (gridVisible) => set({ gridVisible }),
    setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
    setActiveTerrainBrush: (activeTerrainBrush) =>
      set((state) => ({
        activeTerrainBrush,
        selectedId: activeTerrainBrush ? null : state.selectedId,
        selectedIds: activeTerrainBrush ? [] : state.selectedIds,
        selectedPathAnchorIndex: activeTerrainBrush ? null : state.selectedPathAnchorIndex,
      })),
    hydrate: (document) => {
      const nextDocument = document ?? createDefaultDocument();
      set({
        document: nextDocument,
        past: [],
        future: [],
        selectedId: getInitialSelection(nextDocument),
        selectedIds: [getInitialSelection(nextDocument)].filter(
          (id): id is string => Boolean(id),
        ),
        visibleLayers: getLayerVisibility(nextDocument),
        selectedPathAnchorIndex: null,
        activeTerrainBrush: null,
        hydrated: true,
        dirty: false,
      });
    },
    markSaved: (documentVersion) =>
      set((state) =>
        state.document.updatedAt === documentVersion ? { dirty: false } : state,
      ),
    updateBuilding: (id, changes) => {
      if (isSceneObjectLocked(get().document, id)) return;
      const current = get().document;
      const previousBuilding = current.map.buildings.find(
        (candidate) => candidate.id === id,
      );
      const previousResidentWorkers =
        previousBuilding?.operation?.enabled && isBuildingOperational(previousBuilding)
          ? previousBuilding.operation.workforce.residentWorkers
          : 0;
      const next = produce(current, (draft) => {
        const building = draft.map.buildings.find((candidate) => candidate.id === id);
        if (building) {
          const { upgradeTier, ...unrestrictedChanges } = changes;
          const canChangeUpgradeTier = draft.mode === "setup";
          if (upgradeTier !== undefined && canChangeUpgradeTier) {
            const previousOperation = building.operation;
            const defaults = getBuildingOperationDefaults(
              building.assetTypeId,
              upgradeTier,
            );
            building.upgradeTier = upgradeTier;
            if (defaults) {
              building.operation = {
                ...defaults,
                enabled: previousOperation?.enabled ?? defaults.enabled,
                workforce: {
                  ...defaults.workforce,
                  residentWorkers:
                    previousOperation?.workforce.residentWorkers ?? 0,
                  hiredWorkers: previousOperation?.workforce.hiredWorkers ?? 0,
                  wagePerCycle:
                    previousOperation?.workforce.wagePerCycle
                    ?? defaults.workforce.wagePerCycle,
                  wageCurrencyId:
                    previousOperation?.workforce.wageCurrencyId
                    ?? defaults.workforce.wageCurrencyId,
                },
              };
            }
          }
          Object.assign(building, unrestrictedChanges);
          building.housingCapacity = Math.max(
            0,
            Math.round(building.housingCapacity),
          );
          if (building.operation) {
            const availableResidents = getAssignableResidentWorkers(
              current,
              previousResidentWorkers,
            );
            building.operation.maxProduction = Math.max(
              0,
              building.operation.maxProduction,
            );
            building.operation.outputs = normalizeProductionOutputs(
              building.operation.outputs,
            );
            building.operation.workforce = normalizeWorkforce(
              building.operation.workforce,
            );
            if (!building.operation.enabled || !isBuildingOperational(building)) {
              building.operation.workforce.residentWorkers = 0;
              building.operation.workforce.hiredWorkers = 0;
            } else {
              building.operation.workforce.residentWorkers = Math.min(
                building.operation.workforce.residentWorkers,
                availableResidents,
              );
            }
          }
          building.rotation = snapAngle(building.rotation);
        }
      });
      commit(next);
    },
    updatePalisade: (id, changes) => {
      if (isSceneObjectLocked(get().document, id)) return;
      const next = produce(get().document, (draft) => {
        const palisade = draft.map.palisades.find((candidate) => candidate.id === id);
        if (palisade) {
          Object.assign(palisade, changes);
          palisade.rotation = snapAngle(palisade.rotation);
        }
      });
      commit(next);
    },
    updateGate: (id, changes) => {
      if (isSceneObjectLocked(get().document, id)) return;
      const next = produce(get().document, (draft) => {
        const gate = draft.map.gates.find((candidate) => candidate.id === id);
        if (gate) {
          Object.assign(gate, changes);
          gate.rotation = snapAngle(gate.rotation);
          gate.width = Math.max(12, gate.width);
        }
      });
      commit(next);
    },
    updatePath: (id, changes) => {
      if (isSceneObjectLocked(get().document, id)) return;
      const next = produce(get().document, (draft) => {
        const path = draft.map.paths.find((candidate) => candidate.id === id);
        if (path) Object.assign(path, changes);
      });
      commit(next);
    },
    updateZone: (id, changes) => {
      if (isSceneObjectLocked(get().document, id)) return;
      const next = produce(get().document, (draft) => {
        const zone = draft.map.zones.find((candidate) => candidate.id === id);
        if (zone) {
          Object.assign(zone, changes);
          zone.rotation = snapAngle(zone.rotation);
          if (zone.type === "forest") {
            zone.density = Math.min(
              forestDensityRange.max,
              Math.max(forestDensityRange.min, zone.density ?? forestDensityRange.max),
            );
          }
        }
      });
      commit(next);
    },
    updateMarker: (id, changes) => {
      if (isSceneObjectLocked(get().document, id)) return;
      const next = produce(get().document, (draft) => {
        const marker = draft.map.markers.find((candidate) => candidate.id === id);
        if (marker) Object.assign(marker, changes);
      });
      commit(next);
    },
    updateDecoration: (id, changes) => {
      if (isSceneObjectLocked(get().document, id)) return;
      const next = produce(get().document, (draft) => {
        const decoration = draft.map.decorations.find((candidate) => candidate.id === id);
        if (decoration) {
          Object.assign(decoration, changes);
          decoration.rotation = snapAngle(decoration.rotation);
        }
      });
      commit(next);
    },
    addResourceSource: (source, resource) => {
      const next = produce(get().document, (draft) => {
        if (resource && !draft.resources.some((candidate) => candidate.id === resource.id)) {
          draft.resources.push(resource);
        }
        draft.resourceSources.push(source);
      });
      commit(next);
    },
    updateResourceSource: (id, changes) => {
      const current = get().document;
      const previousSource = current.resourceSources.find(
        (candidate) => candidate.id === id,
      );
      const previousWorkers = previousSource?.enabled
        ? previousSource.workforce.residentWorkers
        : 0;
      const next = produce(current, (draft) => {
        const source = draft.resourceSources.find((candidate) => candidate.id === id);
        if (!source) return;
        Object.assign(source, changes);
        const availableResidents = getAssignableResidentWorkers(
          current,
          previousWorkers,
        );
        source.maxProduction = Math.max(0, source.maxProduction);
        source.workforce = normalizeWorkforce(source.workforce);
        if (!source.enabled) {
          source.workforce.residentWorkers = 0;
          source.workforce.hiredWorkers = 0;
        } else {
          source.workforce.residentWorkers = Math.min(
            source.workforce.residentWorkers,
            availableResidents,
          );
        }
        source.transportCapacity = Math.max(0, source.transportCapacity);
      });
      commit(next);
    },
    removeResourceSource: (id) => {
      const next = produce(get().document, (draft) => {
        draft.resourceSources = draft.resourceSources.filter(
          (candidate) => candidate.id !== id,
        );
      });
      commit(next);
    },
    updatePopulation: (changes) => {
      const current = get().document;
      const assignedResidents = getAssignedResidentWorkers(current);
      const next = produce(current, (draft) => {
        Object.assign(draft.population, changes);
        draft.population.permanent = Math.max(
          assignedResidents,
          Math.round(draft.population.permanent),
        );
        draft.population.named = Math.min(
          draft.population.permanent,
          Math.max(0, Math.round(draft.population.named)),
        );
        draft.population.workingResidents = Math.min(
          draft.population.permanent,
          Math.max(
            assignedResidents,
            Math.round(draft.population.workingResidents),
          ),
        );
      });
      commit(next);
    },
    updateTreasury: (changes) => {
      const next = produce(get().document, (draft) => {
        Object.assign(draft.treasury, changes);
        draft.treasury.balanceBaseUnits = Math.max(
          0,
          Math.round(draft.treasury.balanceBaseUnits),
        );
        draft.treasury.defaultWagePerCycle = Math.max(
          0,
          draft.treasury.defaultWagePerCycle,
        );
        draft.treasury.recruitmentCostPerResident = Math.max(
          0,
          draft.treasury.recruitmentCostPerResident,
        );
      });
      commit(next);
    },
    recruitResidents: (residents, workingResidents) => {
      const current = get().document;
      if (!canRecruitResidents(current, residents, workingResidents)) return;
      const count = Math.max(0, Math.round(residents));
      const workers = Math.max(0, Math.round(workingResidents));
      const next = produce(current, (draft) => {
        draft.population.permanent += count;
        draft.population.workingResidents += workers;
        const cost = count * toBaseCurrency(
          draft.ruleset,
          draft.treasury.recruitmentCostPerResident,
          draft.treasury.recruitmentCurrencyId,
        );
        draft.treasury.balanceBaseUnits -= cost;
        draft.treasury.ledger.push({
          id: `${draft.campaignCycle}-recruitment-${Date.now()}`,
          cycle: draft.campaignCycle,
          type: "expense",
          sourceId: "recruitment",
          label: "Recruitment",
          amountBaseUnits: cost,
        });
      });
      commit(next);
    },
    updateProjectWorkforce: (projectId, workforce) => {
      const current = get().document;
      const currentWorkers = current.projects.find(
        (project) => project.id === projectId,
      )?.workforce.residentWorkers ?? 0;
      const availableResidents = getAssignableResidentWorkers(
        current,
        currentWorkers,
      );
      const next = produce(current, (draft) => {
        const project = draft.projects.find((candidate) => candidate.id === projectId);
        if (!project || project.status === "complete") return;
        project.workforce = normalizeWorkforce(workforce);
        project.workforce.residentWorkers = Math.min(
          project.workforce.residentWorkers,
          availableResidents,
        );
      });
      commit(next);
    },
    advanceCycle: () => {
      const next = produce(get().document, (draft) => {
        advanceDocumentCycle(draft as EditorDocument);
      });
      commit(next);
    },
    updateMapGrid: (changes) => {
      const next = produce(get().document, (draft) => {
        Object.assign(draft.map.grid, changes);
      });
      commit(next);
    },
    updateMapSize: (changes, anchor = "top-left") => {
      const next = produce(get().document, (draft) => {
        resizeDocumentMap(draft as EditorDocument, changes, anchor);
      });
      commit(next);
    },
    rotateSelected: (delta) => {
      if (get().selectedIds.length > 1) {
        const bounds = getSceneSelectionBounds(get().document, get().selectedIds);
        if (!bounds) return;
        get().transformSelected({
          origin: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
          center: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
          scale: 1,
          rotation: delta,
        });
        return;
      }
      const selected = get().getSelectedObject();
      if (!selected) {
        return;
      }

      if (selected.kind === "building") {
        get().updateBuilding(selected.value.id, {
          rotation: snapAngle(selected.value.rotation + delta),
        });
      } else if (selected.kind === "palisade") {
        get().updatePalisade(selected.value.id, {
          rotation: snapAngle(selected.value.rotation + delta),
        });
      } else if (selected.kind === "gate") {
        get().updateGate(selected.value.id, {
          rotation: snapAngle(selected.value.rotation + delta),
        });
      } else if (selected.kind === "zone") {
        get().updateZone(selected.value.id, {
          rotation: snapAngle(selected.value.rotation + delta),
        });
      } else if (selected.kind === "decoration") {
        get().updateDecoration(selected.value.id, {
          rotation: snapAngle(selected.value.rotation + delta),
        });
      }
    },
    nudgeSelected: (delta) => {
      const ids = get().selectedIds.filter(
        (id) => !isSceneObjectLocked(get().document, id),
      );
      if (ids.length === 0) return;
      const next = produce(get().document, (draft) => {
        for (const id of ids) {
          const building = draft.map.buildings.find((item) => item.id === id);
          if (building) {
            building.x += delta.x;
            building.y += delta.y;
            continue;
          }
          const palisade = draft.map.palisades.find((item) => item.id === id);
          if (palisade) {
            palisade.center.x += delta.x;
            palisade.center.y += delta.y;
            continue;
          }
          const gate = draft.map.gates.find((item) => item.id === id);
          if (gate) {
            gate.position.x += delta.x;
            gate.position.y += delta.y;
            continue;
          }
          const path = draft.map.paths.find((item) => item.id === id);
          if (path) {
            Object.assign(
              path,
              syncPathGeometry(translatePathAnchors(getPathAnchors(path), delta)),
            );
            continue;
          }
          const zone = draft.map.zones.find((item) => item.id === id);
          if (zone) {
            zone.x += delta.x;
            zone.y += delta.y;
            continue;
          }
          const marker = draft.map.markers.find((item) => item.id === id);
          if (marker) {
            marker.position.x += delta.x;
            marker.position.y += delta.y;
            continue;
          }
          const decoration = draft.map.decorations.find((item) => item.id === id);
          if (decoration) {
            decoration.position.x += delta.x;
            decoration.position.y += delta.y;
          }
        }
      });
      commit(next);
    },
    transformSelected: (transform) => {
      const ids = get().selectedIds;
      if (
        ids.length < 2
        || ids.some((id) => isSceneObjectLocked(get().document, id))
      ) return;
      const next = produce(get().document, (draft) => {
        transformSceneSelection(draft as EditorDocument, ids, transform);
      });
      commit(next);
    },
    addBuilding: (building) => {
      const project = createConstructionProject(get().document, building);
      const next = produce(get().document, (draft) => {
        draft.map.buildings.push(building);
        draft.map.scene.objectOrder = [
          building.id,
          ...draft.map.scene.objectOrder.filter((id) => id !== building.id),
        ];
        if (
          project.buildPlanId === standardBuildPlanId &&
          !draft.buildPlans.some((plan) => plan.id === standardBuildPlanId)
        ) {
          draft.buildPlans.push(structuredClone(standardBuildPlan));
        }
        draft.projects.push(project);
      });
      commit(next);
      set({ selectedId: building.id, selectedIds: [building.id], selectedPathAnchorIndex: null });
    },
    addPalisade: (palisade) => {
      const next = produce(get().document, (draft) => {
        draft.map.palisades.push(palisade);
        draft.map.scene.objectOrder = [
          palisade.id,
          ...draft.map.scene.objectOrder.filter((id) => id !== palisade.id),
        ];
      });
      commit(next);
      set({ selectedId: palisade.id, selectedIds: [palisade.id], selectedPathAnchorIndex: null });
    },
    addPath: (path) => {
      const next = produce(get().document, (draft) => {
        draft.map.paths.push(path);
        draft.map.scene.objectOrder = [
          path.id,
          ...draft.map.scene.objectOrder.filter((id) => id !== path.id),
        ];
      });
      commit(next);
      set({ selectedId: path.id, selectedIds: [path.id], selectedPathAnchorIndex: null });
    },
    addMapObject: (object) => {
      const project =
        object.kind === "building"
          ? createConstructionProject(get().document, object.value)
          : undefined;
      const next = produce(get().document, (draft) => {
        draft.map.scene.objectOrder = [
          object.value.id,
          ...draft.map.scene.objectOrder.filter((id) => id !== object.value.id),
        ];
        if (object.kind === "building") {
          draft.map.buildings.push(object.value);
          if (
            project?.buildPlanId === standardBuildPlanId &&
            !draft.buildPlans.some((plan) => plan.id === standardBuildPlanId)
          ) {
            draft.buildPlans.push(structuredClone(standardBuildPlan));
          }
          if (project) draft.projects.push(project);
        } else if (object.kind === "barrier") draft.map.palisades.push(object.value);
        else if (object.kind === "gate") draft.map.gates.push(object.value);
        else if (object.kind === "path") draft.map.paths.push(object.value);
        else if (object.kind === "zone") draft.map.zones.push(object.value);
        else if (object.kind === "marker") draft.map.markers.push(object.value);
        else draft.map.decorations.push(object.value);
      });
      commit(next);
      set({
        selectedId: object.value.id,
        selectedIds: [object.value.id],
        selectedPathAnchorIndex: null,
        activeTerrainBrush: null,
      });
    },
    addTerrainStroke: (stroke) => {
      if (getLayerState(get().document, "terrain").locked) return;
      const next = produce(get().document, (draft) => {
        draft.map.terrainStrokes.push(stroke);
      });
      commit(next);
    },
    reserveProjectPhase: (projectId) => {
      const current = get().document;
      const project = current.projects.find((item) => item.id === projectId);
      if (!project || !canReserveCurrentPhase(current, project)) return;

      const phase = getCurrentPhase(current, project);
      if (!phase) return;

      const next = produce(current, (draft) => {
        const draftProject = draft.projects.find((item) => item.id === projectId);
        if (!draftProject) return;

        phase.requirements.forEach((requirement) => {
          const resource = draft.resources.find((item) => item.id === requirement.resourceId);
          if (resource) resource.reserved += requirement.amount;
        });
        draftProject.resourcesReserved = true;
        draftProject.status = "active";
        const building = draft.map.buildings.find(
          (item) => item.id === draftProject.buildingId,
        );
        if (building) {
          building.status = "construction";
          building.subtitle = `${phase.name} · ${draftProject.phaseProgress}%`;
        }
      });
      commit(next);
    },
    completeProjectPhase: (projectId) => {
      const current = get().document;
      const project = current.projects.find((item) => item.id === projectId);
      const phase = project ? getCurrentPhase(current, project) : undefined;
      const plan = project
        ? current.buildPlans.find((item) => item.id === project.buildPlanId)
        : undefined;
      if (
        !project ||
        !phase ||
        !plan ||
        !project.resourcesReserved ||
        !hasRequiredProjectWorkforce(project, phase)
      ) return;

      const next = produce(current, (draft) => {
        const draftProject = draft.projects.find((item) => item.id === projectId);
        if (!draftProject) return;

        phase.requirements.forEach((requirement) => {
          const resource = draft.resources.find((item) => item.id === requirement.resourceId);
          if (!resource) return;
          resource.reserved = Math.max(0, resource.reserved - requirement.amount);
          if (resource.consumable) {
            resource.total = Math.max(0, resource.total - requirement.amount);
          }
        });

        const stageIndex = constructionStages.indexOf(draftProject.currentStage);
        const isFinalPhase = stageIndex === constructionStages.length - 1;
        draftProject.resourcesReserved = false;
        if (isFinalPhase) {
          draftProject.status = "complete";
          draftProject.phaseProgress = 100;
          draftProject.workforce.residentWorkers = 0;
          draftProject.workforce.hiredWorkers = 0;
          const building = draft.map.buildings.find(
            (item) => item.id === draftProject.buildingId,
          );
          if (building) {
            building.status = "complete";
            building.upgradeTier = "base";
            building.subtitle = `${phase.name} · 100%`;
          }
          return;
        }

        const nextStage = constructionStages[stageIndex + 1];
        if (!nextStage) return;
        draftProject.currentStage = nextStage;
        draftProject.phaseProgress = 0;
        const nextPhase = plan.phases[nextStage];
        draftProject.workforce.minWorkers = nextPhase.workersRequired;
        draftProject.workforce.maxWorkers = Math.max(
          nextPhase.workersRequired,
          nextPhase.workersRequired * 2,
        );
        draftProject.workforce.residentWorkers = Math.min(
          draftProject.workforce.residentWorkers,
          draftProject.workforce.maxWorkers,
        );
        draftProject.workforce.hiredWorkers = Math.min(
          draftProject.workforce.hiredWorkers,
          draftProject.workforce.maxWorkers
            - draftProject.workforce.residentWorkers,
        );
        const building = draft.map.buildings.find(
          (item) => item.id === draftProject.buildingId,
        );
        if (building) building.subtitle = `${nextPhase.name} · 0%`;
        const hasMissingPrerequisite = nextPhase.prerequisites.some(
          (prerequisite) =>
            !draftProject.fulfilledPrerequisiteIds.includes(prerequisite.id),
        );
        draftProject.status = hasMissingPrerequisite ? "blocked" : "active";
      });
      commit(next);
    },
    setProjectPrerequisite: (projectId, prerequisiteId, fulfilled) => {
      const next = produce(get().document, (draft) => {
        const project = draft.projects.find((item) => item.id === projectId);
        if (!project) return;

        if (fulfilled && !project.fulfilledPrerequisiteIds.includes(prerequisiteId)) {
          project.fulfilledPrerequisiteIds.push(prerequisiteId);
        }
        if (!fulfilled) {
          project.fulfilledPrerequisiteIds = project.fulfilledPrerequisiteIds.filter(
            (id) => id !== prerequisiteId,
          );
        }

        const plan = draft.buildPlans.find((item) => item.id === project.buildPlanId);
        const phase = plan?.phases[project.currentStage];
        if (phase && !project.resourcesReserved) {
          const blocked = phase.prerequisites.some(
            (prerequisite) =>
              !project.fulfilledPrerequisiteIds.includes(prerequisite.id),
          );
          project.status = blocked ? "blocked" : "active";
        }
      });
      commit(next);
    },
    undo: () => {
      const { past, document } = get();
      const previous = past.at(-1);
      if (!previous) {
        return;
      }
      set({
        document: previous,
        visibleLayers: getLayerVisibility(previous),
        past: past.slice(0, -1),
        future: [document, ...get().future],
        dirty: true,
      });
    },
    redo: () => {
      const { future, document } = get();
      const next = future[0];
      if (!next) {
        return;
      }
      set({
        document: next,
        visibleLayers: getLayerVisibility(next),
        past: [...get().past, document].slice(-HISTORY_LIMIT),
        future: future.slice(1),
        dirty: true,
      });
    },
    reset: () => {
      const currentDocument = get().document;
      const bundledDocument = createDefaultDocument();
      const resetDocument = {
        ...bundledDocument,
        id: currentDocument.id,
        settlementName:
          currentDocument.id === bundledDocument.id
            ? bundledDocument.settlementName
            : currentDocument.settlementName,
      };
      commit(resetDocument);
      set({
        selectedId: getInitialSelection(resetDocument),
        selectedIds: [getInitialSelection(resetDocument)].filter(
          (id): id is string => Boolean(id),
        ),
        visibleLayers: getLayerVisibility(resetDocument),
        selectedPathAnchorIndex: null,
      });
    },
    getSelectedObject: () => {
      const { selectedId, document } = get();
      return findSelectableMapObject(document, selectedId);
    },
    getSelectedObjects: () => {
      const { selectedIds, document } = get();
      return selectedIds.flatMap((id) => {
        const selected = findSelectableMapObject(document, id);
        return selected ? [selected] : [];
      });
    },
  };
});
