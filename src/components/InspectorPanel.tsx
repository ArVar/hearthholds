import {
  AlertTriangle,
  Box,
  BrickWall,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Coins,
  CornerDownRight,
  DoorOpen,
  Fence,
  Flame,
  Group as GroupIcon,
  Hammer,
  House,
  LockKeyhole,
  MapPin,
  Minus,
  PackageOpen,
  Plus,
  Route,
  Spline,
  Sprout,
  Ungroup,
  Unlock,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { getCurrencyProfile } from "../domain/currency";
import {
  canReserveCurrentPhase,
  getBuildPlan,
  getCurrentPhase,
  getMissingPrerequisites,
  getPhaseResourceStates,
  hasRequiredProjectWorkforce,
} from "../domain/construction";
import { palisadeLength, pathLength } from "../domain/geometry";
import { getSceneObjects, isSceneObjectLocked } from "../domain/scene";
import {
  getPathAnchors,
  setPathAnchorMode,
  splitPathSegment,
  syncPathGeometry,
} from "../domain/pathGeometry";
import { constructionStages, forestDensityRange } from "../domain/types";
import type {
  BuildPhaseDefinition,
  BuildingStatus,
  BuildingUpgradeTier,
  Gate,
  MapDecoration,
  MapGrid,
  MapMarker,
  MapPath,
  MapZone,
} from "../domain/types";
import { getBuildingAssetManifest } from "../domain/visualAssets";
import {
  getAssignableResidentWorkers,
  getBuildingProduction,
  getBuildingProductionBreakdown,
  getWorkerCount,
  getWorkplaceStatus,
  isBuildingOperational,
  setProductionOutputAllocation,
} from "../domain/workforce";
import { useI18n } from "../i18n/I18nProvider";
import {
  localizePhaseDescription,
  localizePhaseName,
  localizePrerequisite,
  localizeResourceName,
  localizeResourceUnit,
} from "../i18n/domainLabels";
import type { TranslationKey } from "../i18n/messages";
import { useEditorStore } from "../store/editorStore";
import { IconButton } from "./IconButton";

const statusKeys: Record<BuildingStatus, TranslationKey> = {
  existing: "status.existing",
  planned: "status.planned",
  construction: "status.construction",
  complete: "status.complete",
  damaged: "status.damaged",
};

const upgradeTierKeys: Record<BuildingUpgradeTier, TranslationKey> = {
  base: "tier.base",
  extended: "tier.extended",
  master: "tier.master",
};

const pathTypeKeys: Record<MapPath["kind"], TranslationKey> = {
  road: "path.road",
  river: "path.river",
  bridge: "path.bridge",
};

const markerTypeKeys: Record<MapMarker["type"], TranslationKey> = {
  well: "marker.well",
  fire: "marker.fire",
};

const zoneTypeKeys: Record<MapZone["type"], TranslationKey> = {
  field: "zone.field",
  forest: "zone.forest",
  property: "zone.property",
};

function formatMetricDimension(value: number, grid: MapGrid): string {
  return String(Math.round((value / grid.size) * grid.distance * 100) / 100);
}

function DimensionFields({
  width,
  height,
  grid,
  lockAspectRatio = false,
  onCommit,
}: {
  width: number;
  height: number;
  grid: MapGrid;
  lockAspectRatio?: boolean;
  onCommit: (dimensions: { width: number; height: number }) => void;
}) {
  const { t } = useI18n();
  const [draftWidth, setDraftWidth] = useState(() => formatMetricDimension(width, grid));
  const [draftHeight, setDraftHeight] = useState(() => formatMetricDimension(height, grid));

  useEffect(() => {
    setDraftWidth(formatMetricDimension(width, grid));
    setDraftHeight(formatMetricDimension(height, grid));
  }, [grid, height, width]);

  const aspectRatio = width / height;

  const updateWidth = (nextWidth: string) => {
    setDraftWidth(nextWidth);
    const numericWidth = Number(nextWidth);
    if (lockAspectRatio && numericWidth > 0) {
      setDraftHeight(String(Math.round((numericWidth / aspectRatio) * 100) / 100));
    }
  };

  const updateHeight = (nextHeight: string) => {
    setDraftHeight(nextHeight);
    const numericHeight = Number(nextHeight);
    if (lockAspectRatio && numericHeight > 0) {
      setDraftWidth(String(Math.round(numericHeight * aspectRatio * 100) / 100));
    }
  };

  const commit = () => {
    const widthMeters = Number(draftWidth);
    const heightMeters = Number(draftHeight);
    if (!(widthMeters > 0) || !(heightMeters > 0)) {
      setDraftWidth(formatMetricDimension(width, grid));
      setDraftHeight(formatMetricDimension(height, grid));
      return;
    }
    onCommit({
      width: (widthMeters / grid.distance) * grid.size,
      height: (heightMeters / grid.distance) * grid.size,
    });
  };

  return (
    <div className="dimension-fields">
      <label className="form-field">
        <span>{t("inspector.widthMeters")}</span>
        <input
          type="number"
          min={0.1}
          step={0.1}
          value={draftWidth}
          onChange={(event) => updateWidth(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      </label>
      <label className="form-field">
        <span>{t("inspector.heightMeters")}</span>
        <input
          type="number"
          min={0.1}
          step={0.1}
          value={draftHeight}
          onChange={(event) => updateHeight(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      </label>
      {lockAspectRatio && (
        <div className="aspect-ratio-note">
          <LockKeyhole size={12} aria-hidden="true" />
          <span>{t("inspector.aspectRatioLocked")}</span>
        </div>
      )}
    </div>
  );
}

type MapAssetSelection =
  | { kind: "zone"; value: MapZone }
  | { kind: "marker"; value: MapMarker }
  | { kind: "decoration"; value: MapDecoration };

function MapAssetInspector({ selected }: { selected: MapAssetSelection }) {
  const { t } = useI18n();
  const select = useEditorStore((state) => state.select);
  const updateZone = useEditorStore((state) => state.updateZone);
  const updateMarker = useEditorStore((state) => state.updateMarker);
  const updateDecoration = useEditorStore((state) => state.updateDecoration);
  const rotateSelected = useEditorStore((state) => state.rotateSelected);
  const grid = useEditorStore((state) => state.document.map.grid);
  const value = selected.value;
  const position = selected.kind === "zone"
    ? { x: selected.value.x, y: selected.value.y }
    : selected.value.position;
  const typeLabel = selected.kind === "zone"
    ? t(zoneTypeKeys[selected.value.type])
    : selected.kind === "marker"
      ? t(markerTypeKeys[selected.value.type])
      : t("map.decoration");

  const updateName = (name: string) => {
    if (selected.kind === "zone") updateZone(value.id, { name });
    else if (selected.kind === "marker") updateMarker(value.id, { name });
    else updateDecoration(value.id, { name });
  };

  return (
    <aside className="inspector" key={value.id}>
      <div className="inspector-header">
        <div className="object-type-icon">
          {selected.kind === "zone" ? (
            <Sprout size={19} />
          ) : selected.kind === "marker" && selected.value.type === "fire" ? (
            <Flame size={19} />
          ) : selected.kind === "decoration" ? (
            <PackageOpen size={19} />
          ) : (
            <MapPin size={19} />
          )}
        </div>
        <div>
          <span>{typeLabel}</span>
          <strong>{value.name}</strong>
        </div>
        <IconButton label={t("inspector.closeSelection")} onClick={() => select(null)}>
          <X size={17} />
        </IconButton>
      </div>

      <div className="inspector-scroll">
        <section className="form-section">
          <h2>{t("inspector.properties")}</h2>
          <label className="form-field">
            <span>{t("inspector.name")}</span>
            <input
              defaultValue={value.name}
              onBlur={(event) => {
                if (event.target.value !== value.name) updateName(event.target.value);
              }}
            />
          </label>
        </section>

        <section className="form-section">
          <h2>{t("inspector.geometry")}</h2>
          {selected.kind !== "marker" && (
            <div className="rotation-control">
              <IconButton label={t("inspector.rotateCounterclockwise")} onClick={() => rotateSelected(-15)}>
                <ChevronLeft size={17} />
              </IconButton>
              <div>
                <strong>{Math.round(selected.value.rotation)}°</strong>
                <span>{t("inspector.rotationGrid")}</span>
              </div>
              <IconButton label={t("inspector.rotateClockwise")} onClick={() => rotateSelected(15)}>
                <ChevronRight size={17} />
              </IconButton>
            </div>
          )}
          <div className="metric-grid">
            <div>
              <span>{t("inspector.position")}</span>
              <strong>{Math.round(position.x)} / {Math.round(position.y)}</strong>
            </div>
          </div>
          <DimensionFields
            width={selected.value.width}
            height={selected.value.height}
            grid={grid}
            lockAspectRatio={selected.kind !== "zone"}
            onCommit={(dimensions) => {
              if (selected.kind === "zone") updateZone(value.id, dimensions);
              else if (selected.kind === "marker") updateMarker(value.id, dimensions);
              else updateDecoration(value.id, dimensions);
            }}
          />
          {selected.kind === "zone" && selected.value.type === "forest" && (
            <label className="form-field forest-density-field">
              <span>
                {t("inspector.forestDensity")}
                <strong>{Math.round((selected.value.density ?? 1) * 100)} %</strong>
              </span>
              <input
                type="range"
                min={forestDensityRange.min * 100}
                max={forestDensityRange.max * 100}
                step={forestDensityRange.step * 100}
                value={(selected.value.density ?? 1) * 100}
                aria-valuetext={`${Math.round((selected.value.density ?? 1) * 100)} %`}
                onChange={(event) => updateZone(value.id, {
                  density: Number(event.target.value) / 100,
                })}
              />
              <span className="range-hints">
                <small>{t("inspector.forestDensitySparse")}</small>
                <small>{t("inspector.forestDensityDense")}</small>
              </span>
            </label>
          )}
        </section>
      </div>
    </aside>
  );
}

function GateInspector({ gate }: { gate: Gate }) {
  const { t } = useI18n();
  const grid = useEditorStore((state) => state.document.map.grid);
  const select = useEditorStore((state) => state.select);
  const updateGate = useEditorStore((state) => state.updateGate);
  const rotateSelected = useEditorStore((state) => state.rotateSelected);
  const widthMeters = formatMetricDimension(gate.width, grid);

  return (
    <aside className="inspector" key={gate.id}>
      <div className="inspector-header">
        <div className="object-type-icon">
          <DoorOpen size={19} />
        </div>
        <div>
          <span>{t("gate.fortificationGate")}</span>
          <strong>{gate.name}</strong>
        </div>
        <IconButton label={t("inspector.closeSelection")} onClick={() => select(null)}>
          <X size={17} />
        </IconButton>
      </div>

      <div className="inspector-scroll">
        <section className="form-section">
          <h2>{t("inspector.properties")}</h2>
          <label className="form-field">
            <span>{t("inspector.name")}</span>
            <input
              defaultValue={gate.name}
              onBlur={(event) => {
                if (event.target.value !== gate.name) {
                  updateGate(gate.id, { name: event.target.value });
                }
              }}
            />
          </label>
          <label className="form-field">
            <span>{t("inspector.constructionType")}</span>
            <select
              value={gate.style ?? "palisade"}
              onChange={(event) =>
                updateGate(gate.id, {
                  style: event.target.value as NonNullable<Gate["style"]>,
                })
              }
            >
              <option value="palisade">{t("gate.wooden")}</option>
              <option value="wall">{t("gate.stone")}</option>
            </select>
          </label>
          <label className="form-field">
            <span>{t("inspector.gateType")}</span>
            <select
              value={gate.kind}
              onChange={(event) =>
                updateGate(gate.id, { kind: event.target.value as Gate["kind"] })
              }
            >
              <option value="main">{t("gate.main")}</option>
              <option value="service">{t("gate.service")}</option>
            </select>
          </label>
        </section>

        <section className="form-section">
          <h2>{t("inspector.geometry")}</h2>
          <div className="rotation-control">
            <IconButton
              label={t("inspector.rotateCounterclockwise")}
              onClick={() => rotateSelected(-15)}
            >
              <ChevronLeft size={17} />
            </IconButton>
            <div>
              <strong>{Math.round(gate.rotation)}°</strong>
              <span>{t("inspector.rotationGrid")}</span>
            </div>
            <IconButton
              label={t("inspector.rotateClockwise")}
              onClick={() => rotateSelected(15)}
            >
              <ChevronRight size={17} />
            </IconButton>
          </div>
          <div className="metric-grid">
            <div>
              <span>{t("inspector.position")}</span>
              <strong>
                {Math.round(gate.position.x)} / {Math.round(gate.position.y)}
              </strong>
            </div>
          </div>
          <label className="form-field geometry-width-field">
            <span>{t("inspector.widthMeters")}</span>
            <input
              key={`${gate.id}-${gate.width}-${grid.size}-${grid.distance}`}
              type="number"
              min={0.5}
              step={0.1}
              defaultValue={widthMeters}
              onBlur={(event) => {
                const meters = Number(event.target.value);
                if (!(meters > 0)) return;
                updateGate(gate.id, {
                  width: (meters / grid.distance) * grid.size,
                });
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
          </label>
        </section>

        <section className="form-section">
          <h2>{t("inspector.notes")}</h2>
          <textarea
            rows={4}
            defaultValue={gate.notes ?? ""}
            onBlur={(event) => {
              if (event.target.value !== (gate.notes ?? "")) {
                updateGate(gate.id, { notes: event.target.value });
              }
            }}
          />
        </section>
      </div>
    </aside>
  );
}

export function InspectorPanel() {
  const { localize, t } = useI18n();
  const selectedId = useEditorStore((state) => state.selectedId);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const selectedPathAnchorIndex = useEditorStore(
    (state) => state.selectedPathAnchorIndex,
  );
  const document = useEditorStore((state) => state.document);
  const currencyProfile = getCurrencyProfile(document.ruleset);
  const updateBuilding = useEditorStore((state) => state.updateBuilding);
  const updatePalisade = useEditorStore((state) => state.updatePalisade);
  const updatePath = useEditorStore((state) => state.updatePath);
  const rotateSelected = useEditorStore((state) => state.rotateSelected);
  const reserveProjectPhase = useEditorStore((state) => state.reserveProjectPhase);
  const completeProjectPhase = useEditorStore((state) => state.completeProjectPhase);
  const updateProjectWorkforce = useEditorStore(
    (state) => state.updateProjectWorkforce,
  );
  const setProjectPrerequisite = useEditorStore((state) => state.setProjectPrerequisite);
  const select = useEditorStore((state) => state.select);
  const groupSelected = useEditorStore((state) => state.groupSelected);
  const ungroupSelected = useEditorStore((state) => state.ungroupSelected);
  const setSelectedLocked = useEditorStore((state) => state.setSelectedLocked);
  const selectPathAnchor = useEditorStore((state) => state.selectPathAnchor);
  const building = document.map.buildings.find((item) => item.id === selectedId);
  const palisade = document.map.palisades.find((item) => item.id === selectedId);
  const gate = document.map.gates.find((item) => item.id === selectedId);
  const path = document.map.paths.find((item) => item.id === selectedId);
  const zone = document.map.zones.find((item) => item.id === selectedId);
  const marker = document.map.markers.find((item) => item.id === selectedId);
  const decoration = document.map.decorations.find((item) => item.id === selectedId);
  const selectedObjects = getSceneObjects(document).filter((object) =>
    selectedIds.includes(object.id),
  );
  const allSelectedLocked = selectedIds.length > 0 && selectedIds.every((id) =>
    isSceneObjectLocked(document, id),
  );
  const selectedGroupExists = document.map.scene.groups.some((group) =>
    group.objectIds.some((id) => selectedIds.includes(id)),
  );
  const mapAssetSelected: MapAssetSelection | null = zone
    ? { kind: "zone", value: zone }
    : marker
      ? { kind: "marker", value: marker }
      : decoration
        ? { kind: "decoration", value: decoration }
        : null;

  if (selectedIds.length > 1) {
    return (
      <aside className="inspector multi-selection-inspector">
        <div className="inspector-header">
          <div className="object-type-icon">
            <GroupIcon size={19} />
          </div>
          <div>
            <span>{t("scene.multiSelection")}</span>
            <strong>{t("scene.selectedCount", { count: selectedIds.length })}</strong>
          </div>
          <IconButton label={t("inspector.closeSelection")} onClick={() => select(null)}>
            <X size={17} />
          </IconButton>
        </div>
        <div className="inspector-scroll">
          <section className="form-section multi-selection-actions">
            <h2>{t("inspector.properties")}</h2>
            <button
              type="button"
              onClick={() => groupSelected(t("scene.newGroup", { count: document.map.scene.groups.length + 1 }))}
            >
              <GroupIcon size={16} /> {t("scene.group")}
            </button>
            <button type="button" disabled={!selectedGroupExists} onClick={ungroupSelected}>
              <Ungroup size={16} /> {t("scene.ungroup")}
            </button>
            <button type="button" onClick={() => setSelectedLocked(!allSelectedLocked)}>
              {allSelectedLocked ? <Unlock size={16} /> : <LockKeyhole size={16} />}
              {allSelectedLocked ? t("scene.unlockSelection") : t("scene.lockSelection")}
            </button>
          </section>
          <section className="form-section">
            <h2>{t("scene.selectedObjects")}</h2>
            <div className="multi-selection-list">
              {selectedObjects.map((object) => (
                <span key={object.id}>{object.name}</span>
              ))}
            </div>
            <p className="aspect-ratio-note">{t("scene.multiSelectionHint")}</p>
          </section>
        </div>
      </aside>
    );
  }

  if (gate) {
    return <GateInspector gate={gate} />;
  }
  const selected = building
    ? ({ kind: "building", value: building } as const)
    : palisade
      ? ({ kind: "palisade", value: palisade } as const)
      : path
        ? ({ kind: "path", value: path } as const)
        : null;
  const project = building
    ? document.projects.find((item) => item.buildingId === building.id)
    : undefined;
  const plan = project ? getBuildPlan(document, project) : undefined;
  const phase = project ? getCurrentPhase(document, project) : undefined;
  const resourceStates = project && phase
    ? getPhaseResourceStates(document, project)
    : [];
  const missingPrerequisites = project && phase
    ? getMissingPrerequisites(project, phase)
    : [];
  const lacksResources = resourceStates.some((state) => !state.sufficient);
  const buildingAssetManifest = getBuildingAssetManifest(building?.assetTypeId);
  const operation = building?.operation;
  const buildingOperational = building ? isBuildingOperational(building) : false;
  const operationStatus = operation
    ? getWorkplaceStatus(operation.enabled && buildingOperational, operation.workforce)
    : undefined;
  const operationAssignableResidents = operation
    ? getAssignableResidentWorkers(document, operation.workforce.residentWorkers)
    : 0;
  const projectAssignableResidents = project
    ? getAssignableResidentWorkers(document, project.workforce.residentWorkers)
    : 0;
  const projectWorkforceSufficient = project && phase
    ? hasRequiredProjectWorkforce(project, phase)
    : true;
  const formatRequirementSummary = (item: BuildPhaseDefinition) => {
    const materials = item.requirements
      .map((requirement) => {
        const resource = document.resources.find(
          (candidate) => candidate.id === requirement.resourceId,
        );
        return `${requirement.amount} ${resource ? localizeResourceName(resource, t) : requirement.resourceId}`;
      })
      .join(" · ");
    return [materials, `${item.workersRequired} ${t("resources.workers")}`]
      .filter(Boolean)
      .join(" · ");
  };

  if (mapAssetSelected) {
    return <MapAssetInspector selected={mapAssetSelected} />;
  }

  if (!selected) {
    return (
      <aside className="inspector empty-inspector">
        <MapPin size={24} />
        <strong>{t("inspector.noSelection")}</strong>
        <span>{t("inspector.selectObject")}</span>
      </aside>
    );
  }

  const value = selected.value;

  return (
    <aside className="inspector" key={selectedId}>
      <div className="inspector-header">
        <div className="object-type-icon">
          {"type" in value ? (
            <Box size={19} />
          ) : "points" in value ? (
            <Route size={19} />
          ) : value.style === "wall" ? (
            <BrickWall size={19} />
          ) : (
            <Fence size={19} />
          )}
        </div>
        <div>
          <span>
            {"type" in value
              ? buildingAssetManifest
                ? localize(buildingAssetManifest.label)
                : value.type
              : "points" in value
                ? t(pathTypeKeys[value.kind])
                : value.style === "wall"
                  ? t("barrier.wall")
                  : t("barrier.palisade")}
          </span>
          <strong>{value.name}</strong>
        </div>
        <IconButton label={t("inspector.closeSelection")} onClick={() => select(null)}>
          <X size={17} />
        </IconButton>
      </div>

      <div className="inspector-scroll">
        <section className="form-section">
          <h2>{t("inspector.properties")}</h2>
          <label className="form-field">
            <span>{t("inspector.name")}</span>
            <input
              defaultValue={value.name}
              onBlur={(event) => {
                if (event.target.value === value.name) return;
                if ("type" in value) {
                  updateBuilding(value.id, { name: event.target.value });
                } else if ("segments" in value) {
                  updatePalisade(value.id, { name: event.target.value });
                } else {
                  updatePath(value.id, { name: event.target.value });
                }
              }}
            />
          </label>

          {"type" in value && (
            <>
              <label className="form-field">
                <span>{t("inspector.status")}</span>
                <select
                  value={value.status}
                  onChange={(event) =>
                    updateBuilding(value.id, {
                      status: event.target.value as BuildingStatus,
                    })
                  }
                >
                  {Object.entries(statusKeys).map(([status, key]) => (
                    <option key={status} value={status}>
                      {t(key)}
                    </option>
                  ))}
                </select>
              </label>

              {buildingAssetManifest && buildingAssetManifest.variants.length > 1 && (
                <label className="form-field">
                  <span>{t("inspector.appearance")}</span>
                  <select
                    value={value.visualVariant ?? buildingAssetManifest.variants[0]}
                    onChange={(event) =>
                      updateBuilding(value.id, { visualVariant: event.target.value })
                    }
                  >
                    {buildingAssetManifest.variants.map((variant, index) => (
                      <option key={variant} value={variant}>
                        {t("inspector.variant", { number: index + 1 })}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {buildingAssetManifest && buildingAssetManifest.upgradeTiers.length > 1 && (
                <label className="form-field">
                  <span>{t("inspector.upgradeTier")}</span>
                  <select
                    value={value.upgradeTier}
                    disabled={document.mode !== "setup"}
                    onChange={(event) =>
                      updateBuilding(value.id, {
                        upgradeTier: event.target.value as BuildingUpgradeTier,
                      })
                    }
                  >
                    {buildingAssetManifest.upgradeTiers.map((tier) => (
                      <option key={tier} value={tier}>
                        {t(upgradeTierKeys[tier])}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}

          {"segments" in value && (
            <>
              <label className="form-field">
                <span>{t("inspector.constructionType")}</span>
                <select
                  value={value.style ?? "palisade"}
                  onChange={(event) =>
                    updatePalisade(value.id, {
                      style: event.target.value as "palisade" | "wall",
                    })
                  }
                >
                  <option value="palisade">{t("barrier.woodenPalisade")}</option>
                  <option value="wall">{t("barrier.stoneWall")}</option>
                </select>
              </label>
              <label className="form-field">
                <span>{t("inspector.status")}</span>
                <select
                  value={value.status}
                  onChange={(event) =>
                    updatePalisade(value.id, {
                      status: event.target.value as typeof value.status,
                    })
                  }
                >
                  <option value="existing">{t("status.existing")}</option>
                  <option value="planned">{t("status.planned")}</option>
                  <option value="construction">{t("status.construction")}</option>
                  <option value="damaged">{t("status.damaged")}</option>
                </select>
              </label>
            </>
          )}

          {"points" in value && (
            <>
              <label className="form-field">
                <span>{t("inspector.type")}</span>
                <select
                  value={value.kind}
                  onChange={(event) =>
                    updatePath(value.id, { kind: event.target.value as MapPath["kind"] })
                  }
                >
                  <option value="road">{t("path.road")}</option>
                  <option value="river">{t("path.river")}</option>
                  <option value="bridge">{t("path.bridge")}</option>
                </select>
              </label>
              <label className="form-field">
                <span>{t("inspector.color")}</span>
                <input
                  type="color"
                  value={value.color}
                  onChange={(event) => updatePath(value.id, { color: event.target.value })}
                />
              </label>
            </>
          )}
        </section>

        <section className="form-section">
          <h2>{t("inspector.geometry")}</h2>
          {!("points" in value) && (
            <div className="rotation-control">
              <IconButton label={t("inspector.rotateCounterclockwise")} onClick={() => rotateSelected(-15)}>
                <ChevronLeft size={17} />
              </IconButton>
              <div>
                <strong>{Math.round(value.rotation)}°</strong>
                <span>{t("inspector.rotationGrid")}</span>
              </div>
              <IconButton label={t("inspector.rotateClockwise")} onClick={() => rotateSelected(15)}>
                <ChevronRight size={17} />
              </IconButton>
            </div>
          )}

          {"type" in value ? (
            <>
              <div className="metric-grid">
                <div>
                  <span>{t("inspector.position")}</span>
                  <strong>
                    {Math.round(value.x)} / {Math.round(value.y)}
                  </strong>
                </div>
              </div>
              <DimensionFields
                width={value.width}
                height={value.height}
                grid={document.map.grid}
                lockAspectRatio
                onCommit={(dimensions) => updateBuilding(value.id, dimensions)}
              />
            </>
          ) : "segments" in value ? (
            <div className="metric-grid">
              <div>
                <span>{t("inspector.course")}</span>
                <strong>{value.segments.length} {t("common.segments")}</strong>
              </div>
              <div>
                <span>{t("inspector.length")}</span>
                <strong>{Math.round(palisadeLength(value))} {t("common.units")}</strong>
              </div>
              <div>
                <span>{t("inspector.thickness")}</span>
                <strong>{value.thickness}</strong>
              </div>
            </div>
          ) : (
            <>
              <label className="form-field geometry-width-field">
                <span>{t("inspector.width")}</span>
                <input
                  type="number"
                  min={2}
                  max={240}
                  value={Math.round(value.width)}
                  onChange={(event) =>
                    updatePath(value.id, { width: Math.max(2, Number(event.target.value)) })
                  }
                />
              </label>
              <div className="metric-grid">
                <div>
                  <span>{t("inspector.controlPoints")}</span>
                  <strong>{getPathAnchors(value).length}</strong>
                </div>
                <div>
                  <span>{t("inspector.length")}</span>
                  <strong>{Math.round(pathLength(value))} {t("common.units")}</strong>
                </div>
              </div>
              {selectedPathAnchorIndex !== null &&
                getPathAnchors(value)[selectedPathAnchorIndex] && (
                  <div className="node-mode-control" role="group" aria-label={t("inspector.nodeType")}>
                    <button
                      type="button"
                      className={
                        getPathAnchors(value)[selectedPathAnchorIndex].mode === "corner"
                          ? "is-active"
                          : ""
                      }
                      onClick={() =>
                        updatePath(
                          value.id,
                          syncPathGeometry(
                            setPathAnchorMode(
                              getPathAnchors(value),
                              selectedPathAnchorIndex,
                              "corner",
                            ),
                          ),
                        )
                      }
                    >
                      <CornerDownRight size={15} />
                      {t("inspector.corner")}
                    </button>
                    <button
                      type="button"
                      className={
                        getPathAnchors(value)[selectedPathAnchorIndex].mode === "smooth"
                          ? "is-active"
                          : ""
                      }
                      onClick={() =>
                        updatePath(
                          value.id,
                          syncPathGeometry(
                            setPathAnchorMode(
                              getPathAnchors(value),
                              selectedPathAnchorIndex,
                              "smooth",
                            ),
                          ),
                        )
                      }
                    >
                      <Spline size={15} />
                      {t("inspector.smooth")}
                    </button>
                  </div>
                )}
              <div className="geometry-actions">
                <button
                  type="button"
                  onClick={() => {
                    const anchors = getPathAnchors(value);
                    let longestIndex = 0;
                    let longestLength = -1;
                    for (let index = 0; index < anchors.length - 1; index += 1) {
                      const length = Math.hypot(
                        anchors[index + 1].x - anchors[index].x,
                        anchors[index + 1].y - anchors[index].y,
                      );
                      if (length > longestLength) {
                        longestLength = length;
                        longestIndex = index;
                      }
                    }
                    updatePath(
                      value.id,
                      syncPathGeometry(splitPathSegment(anchors, longestIndex)),
                    );
                    selectPathAnchor(longestIndex + 1);
                  }}
                >
                  <Plus size={15} />
                  {t("inspector.point")}
                </button>
                <button
                  type="button"
                  disabled={getPathAnchors(value).length <= 2}
                  onClick={() => {
                    const anchors = getPathAnchors(value);
                    const removeIndex =
                      selectedPathAnchorIndex !== null &&
                      selectedPathAnchorIndex > 0 &&
                      selectedPathAnchorIndex < anchors.length - 1
                        ? selectedPathAnchorIndex
                        : anchors.length - 2;
                    anchors.splice(removeIndex, 1);
                    updatePath(value.id, syncPathGeometry(anchors));
                    selectPathAnchor(null);
                  }}
                >
                  <Minus size={15} />
                  {t("inspector.point")}
                </button>
              </div>
            </>
          )}

          {"segments" in value && (
            <label className="form-field geometry-width-field">
              <span>{t("inspector.thickness")}</span>
              <input
                type="number"
                min={4}
                max={60}
                value={Math.round(value.thickness)}
                onChange={(event) =>
                  updatePalisade(value.id, {
                    thickness: Math.max(4, Number(event.target.value)),
                  })
                }
              />
            </label>
          )}
        </section>

        {"type" in value && (
          <section className="form-section workforce-section">
            <h2>
              <House size={15} />
              {t("resources.housingAndOperation")}
            </h2>
            <label className="form-field">
              <span>{t("resources.housingCapacity")}</span>
              <input
                type="number"
                min={0}
                value={value.housingCapacity}
                onChange={(event) => updateBuilding(value.id, {
                  housingCapacity: Number(event.target.value),
                })}
              />
            </label>

            {value.operation && operation && operationStatus && (
              <>
                <div className={`workplace-state is-${operationStatus}`}>
                  <span>
                    <Users size={15} />
                    {t(`resources.workplaceStatus.${operationStatus}`)}
                  </span>
                  <strong>
                    {getWorkerCount(operation.workforce)}/{operation.workforce.maxWorkers}
                  </strong>
                </div>
                <label className="form-field">
                  <span>{t("resources.operationStatus")}</span>
                  <select
                    value={operation.enabled ? "enabled" : "disabled"}
                    onChange={(event) => updateBuilding(value.id, {
                      operation: {
                        ...operation,
                        enabled: event.target.value === "enabled",
                      },
                    })}
                  >
                    <option value="enabled">{t("resources.enabled")}</option>
                    <option value="disabled">{t("resources.disabled")}</option>
                  </select>
                </label>
                <div className="resource-source-number-grid">
                  <label className="form-field">
                    <span>{t("resources.minimumWorkers")}</span>
                    <input
                      type="number"
                      min={0}
                      max={operation.workforce.maxWorkers}
                      value={operation.workforce.minWorkers}
                      onChange={(event) => updateBuilding(value.id, {
                        operation: {
                          ...operation,
                          workforce: {
                            ...operation.workforce,
                            minWorkers: Number(event.target.value),
                          },
                        },
                      })}
                    />
                  </label>
                  <label className="form-field">
                    <span>{t("resources.maximumWorkers")}</span>
                    <input
                      type="number"
                      min={operation.workforce.minWorkers}
                      value={operation.workforce.maxWorkers}
                      onChange={(event) => updateBuilding(value.id, {
                        operation: {
                          ...operation,
                          workforce: {
                            ...operation.workforce,
                            maxWorkers: Number(event.target.value),
                          },
                        },
                      })}
                    />
                  </label>
                  <label className="form-field">
                    <span>{t("resources.residentWorkers")}</span>
                    <input
                      type="number"
                      min={0}
                      disabled={!buildingOperational}
                      max={Math.min(operation.workforce.maxWorkers, operationAssignableResidents)}
                      value={operation.workforce.residentWorkers}
                      onChange={(event) => updateBuilding(value.id, {
                        operation: {
                          ...operation,
                          workforce: {
                            ...operation.workforce,
                            residentWorkers: Number(event.target.value),
                          },
                        },
                      })}
                    />
                  </label>
                  <label className="form-field">
                    <span>{t("resources.hiredWorkers")}</span>
                    <input
                      type="number"
                      min={0}
                      disabled={!buildingOperational}
                      max={operation.workforce.maxWorkers - operation.workforce.residentWorkers}
                      value={operation.workforce.hiredWorkers}
                      onChange={(event) => updateBuilding(value.id, {
                        operation: {
                          ...operation,
                          workforce: {
                            ...operation.workforce,
                            hiredWorkers: Number(event.target.value),
                          },
                        },
                      })}
                    />
                  </label>
                  <label className="form-field">
                    <span>{t("resources.dailyWage")}</span>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={operation.workforce.wagePerCycle}
                      onChange={(event) => updateBuilding(value.id, {
                        operation: {
                          ...operation,
                          workforce: {
                            ...operation.workforce,
                            wagePerCycle: Number(event.target.value),
                          },
                        },
                      })}
                    />
                  </label>
                  <label className="form-field">
                    <span>{t("resources.wageCurrency")}</span>
                    <select
                      value={operation.workforce.wageCurrencyId}
                      onChange={(event) => updateBuilding(value.id, {
                        operation: {
                          ...operation,
                          workforce: {
                            ...operation.workforce,
                            wageCurrencyId: event.target.value,
                          },
                        },
                      })}
                    >
                      {currencyProfile.denominations.map((currency) => (
                        <option key={currency.id} value={currency.id}>{currency.symbol}</option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>{t("resources.incomePerCycle")}</span>
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={operation.incomePerCycle}
                      onChange={(event) => updateBuilding(value.id, {
                        operation: { ...operation, incomePerCycle: Number(event.target.value) },
                      })}
                    />
                  </label>
                  <label className="form-field">
                    <span>{t("resources.incomeCurrency")}</span>
                    <select
                      value={operation.incomeCurrencyId}
                      onChange={(event) => updateBuilding(value.id, {
                        operation: { ...operation, incomeCurrencyId: event.target.value },
                      })}
                    >
                      {currencyProfile.denominations.map((currency) => (
                        <option key={currency.id} value={currency.id}>{currency.symbol}</option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>{t("resources.maximumProduction")}</span>
                    <input
                      type="number"
                      min={0}
                      disabled={operation.outputs.length === 0}
                      value={operation.maxProduction}
                      onChange={(event) => updateBuilding(value.id, {
                        operation: {
                          ...operation,
                          maxProduction: Number(event.target.value),
                        },
                      })}
                    />
                  </label>
                </div>
                {operation.outputs.length === 0 ? (
                  <label className="form-field">
                    <span>{t("resources.productionResource")}</span>
                    <select
                      value=""
                      onChange={(event) => {
                        if (!event.target.value) return;
                        updateBuilding(value.id, {
                          operation: {
                            ...operation,
                            outputs: [{
                              resourceId: event.target.value,
                              allocation: 1,
                              carry: 0,
                            }],
                          },
                        });
                      }}
                    >
                      <option value="">{t("resources.noProductionResource")}</option>
                      {document.resources.map((resource) => (
                        <option key={resource.id} value={resource.id}>
                          {localizeResourceName(resource, t)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="production-output-list">
                    <h3>{t("resources.productionDistribution")}</h3>
                    {operation.outputs.map((output, outputIndex) => (
                      <div className="production-output-row" key={`${output.resourceId}-${outputIndex}`}>
                        <label className="form-field">
                          <span>{t("resources.productionResource")}</span>
                          <select
                            value={output.resourceId}
                            onChange={(event) => updateBuilding(value.id, {
                              operation: {
                                ...operation,
                                outputs: operation.outputs.map((candidate, index) =>
                                  index === outputIndex
                                    ? { ...candidate, resourceId: event.target.value, carry: 0 }
                                    : candidate,
                                ),
                              },
                            })}
                          >
                            {document.resources.map((resource) => (
                              <option key={resource.id} value={resource.id}>
                                {localizeResourceName(resource, t)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="form-field">
                          <span>{t("resources.productionShare")}</span>
                          <div className="unit-input">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              disabled={operation.outputs.length === 1}
                              value={Math.round(output.allocation * 100)}
                              onChange={(event) => updateBuilding(value.id, {
                                operation: {
                                  ...operation,
                                  outputs: setProductionOutputAllocation(
                                    operation.outputs,
                                    outputIndex,
                                    Number(event.target.value) / 100,
                                  ),
                                },
                              })}
                            />
                            <span>%</span>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
                {operation.outputs.length > 0 && (
                  <p className="aspect-ratio-note">
                    {t("resources.currentProduction")}: {getBuildingProduction(value)} / {t("resources.dayShort")}
                    {getBuildingProductionBreakdown(value).map((output) => {
                      const resource = document.resources.find(
                        (candidate) => candidate.id === output.resourceId,
                      );
                      return resource
                        ? ` · ${localizeResourceName(resource, t)} ${output.amount}`
                        : ` · ${output.resourceId} ${output.amount}`;
                    })}
                  </p>
                )}
              </>
            )}
          </section>
        )}

        {"type" in value && project && plan && phase && (
          <section className="form-section project-section">
            <h2>
              <Hammer size={15} />
              {t("inspector.activeProject")}
            </h2>
            <div className="project-phase">
              <div className="phase-number">
                {constructionStages.indexOf(project.currentStage) + 1}
              </div>
              <div>
                <strong>{localizePhaseName(project.currentStage, phase, t)}</strong>
                <span>
                  {t("inspector.phaseOf", {
                    current: constructionStages.indexOf(project.currentStage) + 1,
                    total: constructionStages.length,
                  })}
                </span>
              </div>
            </div>
            <p className="phase-description">
              {localizePhaseDescription(plan.id, project.currentStage, phase, t)}
            </p>
            <div className="project-workforce">
              <h3>{t("resources.constructionCrew")}</h3>
              <div className="workplace-state">
                <span><Users size={15} /> {t("resources.workers")}</span>
                <strong>
                  {getWorkerCount(project.workforce)}/{phase.workersRequired}
                </strong>
              </div>
              <div className="resource-source-number-grid">
                <label className="form-field">
                  <span>{t("resources.residentWorkers")}</span>
                  <input
                    type="number"
                    min={0}
                    max={Math.min(project.workforce.maxWorkers, projectAssignableResidents)}
                    value={project.workforce.residentWorkers}
                    onChange={(event) => updateProjectWorkforce(project.id, {
                      ...project.workforce,
                      residentWorkers: Number(event.target.value),
                    })}
                  />
                </label>
                <label className="form-field">
                  <span>{t("resources.hiredWorkers")}</span>
                  <input
                    type="number"
                    min={0}
                    max={project.workforce.maxWorkers - project.workforce.residentWorkers}
                    value={project.workforce.hiredWorkers}
                    onChange={(event) => updateProjectWorkforce(project.id, {
                      ...project.workforce,
                      hiredWorkers: Number(event.target.value),
                    })}
                  />
                </label>
                <label className="form-field">
                  <span>{t("resources.dailyWage")}</span>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={project.workforce.wagePerCycle}
                    onChange={(event) => updateProjectWorkforce(project.id, {
                      ...project.workforce,
                      wagePerCycle: Number(event.target.value),
                    })}
                  />
                </label>
                <label className="form-field">
                  <span>{t("resources.wageCurrency")}</span>
                  <select
                    value={project.workforce.wageCurrencyId}
                    onChange={(event) => updateProjectWorkforce(project.id, {
                      ...project.workforce,
                      wageCurrencyId: event.target.value,
                    })}
                  >
                    {currencyProfile.denominations.map((currency) => (
                      <option key={currency.id} value={currency.id}>{currency.symbol}</option>
                    ))}
                  </select>
                </label>
              </div>
              {!projectWorkforceSufficient && (
                <div className="warning-box">
                  <AlertTriangle size={17} />
                  <span>{t("resources.insufficientConstructionCrew", {
                    count: phase.workersRequired,
                  })}</span>
                </div>
              )}
            </div>
            <div
              className="progress-track"
              aria-label={t("inspector.constructionProgress", {
                progress: project.phaseProgress,
              })}
            >
              <span style={{ width: `${project.phaseProgress}%` }} />
            </div>
            <div className="progress-label">
              <span>{t("inspector.phaseProgress")}</span>
              <strong>{project.phaseProgress}%</strong>
            </div>

            <div className="phase-resources">
              <h3>{t("inspector.phaseRequirements")}</h3>
              {resourceStates.map((state) => (
                <div
                  className={`phase-resource-row ${state.sufficient ? "is-sufficient" : "is-missing"}`}
                  key={state.resource.id}
                >
                  {state.sufficient ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  <div>
                    <strong>{localizeResourceName(state.resource, t)}</strong>
                    <span>
                      {state.secured
                        ? t("inspector.reservedAmount", {
                            amount: state.requirement.amount,
                            unit: localizeResourceUnit(state.resource, t),
                          })
                        : t("inspector.requiredAvailable", {
                            required: state.requirement.amount,
                            available: state.available,
                          })}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {phase.prerequisites.length > 0 && (
              <div className="phase-prerequisites">
                <h3>{t("inspector.prerequisites")}</h3>
                {phase.prerequisites.map((prerequisite) => (
                  <label key={prerequisite.id}>
                    <input
                      type="checkbox"
                      checked={project.fulfilledPrerequisiteIds.includes(prerequisite.id)}
                      onChange={(event) =>
                        setProjectPrerequisite(
                          project.id,
                          prerequisite.id,
                          event.target.checked,
                        )
                      }
                    />
                    <span>{localizePrerequisite(prerequisite, t)}</span>
                  </label>
                ))}
              </div>
            )}

            {project.resourcesReserved ? (
              <div className="project-state is-ready">
                <Check size={16} />
                <span>{t("inspector.requirementsReserved")}</span>
              </div>
            ) : missingPrerequisites.length > 0 ? (
              <div className="warning-box">
                <LockKeyhole size={17} />
                <span>
                  {t("inspector.missing", {
                    items: missingPrerequisites
                      .map((item) => localizePrerequisite(item, t))
                      .join(", "),
                  })}
                </span>
              </div>
            ) : lacksResources ? (
              <div className="warning-box">
                <AlertTriangle size={17} />
                <span>{t("inspector.insufficientResources")}</span>
              </div>
            ) : null}

            {project.status !== "complete" && (
              <button
                type="button"
                className="project-action"
                disabled={
                  project.resourcesReserved
                    ? !projectWorkforceSufficient
                    : !canReserveCurrentPhase(document, project)
                }
                onClick={() =>
                  project.resourcesReserved
                    ? completeProjectPhase(project.id)
                    : reserveProjectPhase(project.id)
                }
              >
                {project.resourcesReserved ? <Check size={16} /> : <LockKeyhole size={16} />}
                {project.resourcesReserved
                  ? t("inspector.completePhase")
                  : t("inspector.reserveRequirements")}
              </button>
            )}

            <div className="phase-overview">
              <h3>{t("inspector.allPhases")}</h3>
              {constructionStages.map((stage, index) => {
                const item = plan.phases[stage];
                const currentStageIndex = constructionStages.indexOf(project.currentStage);
                const complete = index < currentStageIndex || project.status === "complete";
                const current = index === currentStageIndex && project.status !== "complete";
                return (
                  <div
                    className={`phase-overview-row ${complete ? "is-complete" : ""} ${current ? "is-current" : ""}`}
                    key={stage}
                  >
                    <span className="phase-status-icon">
                      {complete ? <Check size={13} /> : current ? <Hammer size={13} /> : <CircleDashed size={13} />}
                    </span>
                    <div>
                      <strong>{index + 1}. {localizePhaseName(stage, item, t)}</strong>
                      <span>{formatRequirementSummary(item)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="form-section">
          <h2>{t("inspector.notes")}</h2>
          <textarea
            rows={4}
            defaultValue={value.notes}
            onBlur={(event) => {
              if (event.target.value === value.notes) return;
              if ("type" in value) {
                updateBuilding(value.id, { notes: event.target.value });
              } else if ("segments" in value) {
                updatePalisade(value.id, { notes: event.target.value });
              } else {
                updatePath(value.id, { notes: event.target.value });
              }
            }}
          />
        </section>
      </div>
    </aside>
  );
}
