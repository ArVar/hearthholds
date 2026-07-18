export type Point = {
  x: number;
  y: number;
};

export const mapLayerIds = [
  "background",
  "reference",
  "terrain",
  "infrastructure",
  "buildings",
  "markers",
  "zones",
  "labels",
  "gm",
] as const;

export type MapLayerId = (typeof mapLayerIds)[number];

export type MapLayerState = {
  id: MapLayerId;
  visible: boolean;
  locked: boolean;
};

export type MapObjectState = {
  id: string;
  visible: boolean;
  locked: boolean;
};

export type MapObjectGroup = {
  id: string;
  name: string;
  objectIds: string[];
  visible: boolean;
  locked: boolean;
};

export type MapSceneState = {
  layers: MapLayerState[];
  objects: MapObjectState[];
  groups: MapObjectGroup[];
  objectOrder: string[];
};

export const forestDensityRange = {
  min: 0.1,
  max: 1,
  step: 0.05,
} as const;

export const terrainTypes = ["grass", "dirt", "mud", "stone", "sand"] as const;

export type TerrainType = (typeof terrainTypes)[number];

export type TerrainBrushSettings = {
  type: TerrainType;
  sizeMeters: number;
};

export type TerrainStroke = {
  id: string;
  type: TerrainType;
  points: number[];
  width: number;
};

export type BuildingStatus =
  | "existing"
  | "planned"
  | "construction"
  | "complete"
  | "damaged";

export type BuildingShape = "rect" | "circle";

export type BuildingUpgradeTier = "base" | "extended" | "master";

export type WorkforceAllocation = {
  minWorkers: number;
  maxWorkers: number;
  residentWorkers: number;
  hiredWorkers: number;
  wagePerCycle: number;
  wageCurrencyId: string;
};

export type ProductionOutput = {
  resourceId: string;
  allocation: number;
  carry: number;
};

export type BuildingOperation = {
  enabled: boolean;
  maxProduction: number;
  outputs: ProductionOutput[];
  incomePerCycle: number;
  incomeCurrencyId: string;
  workforce: WorkforceAllocation;
};

export const constructionStages = [
  "foundation",
  "masonry",
  "completion",
] as const;

export type ConstructionStage = (typeof constructionStages)[number];

export type Building = {
  id: string;
  name: string;
  type: string;
  status: BuildingStatus;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  shape: BuildingShape;
  color: string;
  subtitle: string;
  notes: string;
  assetTypeId?: string;
  visualVariant?: string;
  upgradeTier: BuildingUpgradeTier;
  housingCapacity: number;
  operation?: BuildingOperation;
};

export type LineSegment = {
  kind: "line";
  from: Point;
  to: Point;
};

export type ArcSegment = {
  kind: "arc";
  center: Point;
  radius: number;
  startAngle: number;
  endAngle: number;
  counterClockwise: boolean;
};

export type PalisadeNodeMode = "corner" | "smooth";

export type BezierSegment = {
  kind: "bezier";
  from: Point;
  to: Point;
  handleFrom: Point;
  handleTo: Point;
  fromMode: PalisadeNodeMode;
  toMode: PalisadeNodeMode;
};

export type PalisadeSegment = LineSegment | ArcSegment | BezierSegment;

export type Gate = {
  id: string;
  name: string;
  position: Point;
  rotation: number;
  width: number;
  kind: "main" | "service";
  style?: "palisade" | "wall";
  notes?: string;
};

export type Palisade = {
  id: string;
  name: string;
  status: "existing" | "planned" | "construction" | "damaged";
  center: Point;
  rotation: number;
  thickness: number;
  style?: "palisade" | "wall";
  segments: PalisadeSegment[];
  gates: Gate[];
  notes: string;
};

export type MapZone = {
  id: string;
  name: string;
  type: "field" | "forest" | "property";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  density?: number;
};

export type PathAnchor = {
  x: number;
  y: number;
  mode: "corner" | "smooth";
  handleIn?: Point;
  handleOut?: Point;
};

export type MapPath = {
  id: string;
  name: string;
  kind: "road" | "river" | "bridge";
  points: number[];
  width: number;
  color: string;
  notes?: string;
  anchors?: PathAnchor[];
};

export type MapMarker = {
  id: string;
  name: string;
  type: "well" | "fire";
  position: Point;
  width: number;
  height: number;
};

export type MapGrid = {
  size: number;
  distance: number;
  unit: "m";
  majorEvery: number;
  color?: string;
  opacity?: number;
};

export const defaultGridAppearance = {
  color: "#d8e2ca",
  opacity: 0.5,
} as const;

export type MapDecoration = {
  id: string;
  name: string;
  assetId: string;
  position: Point;
  width: number;
  height: number;
  rotation: number;
};

export type ResourceSummary = {
  id: string;
  name: string;
  total: number;
  reserved: number;
  unit: string;
  source: string;
  consumable: boolean;
};

export const resourceSourceTypes = [
  "forest",
  "quarry",
  "ironMine",
  "copperMine",
  "goldMine",
] as const;
export type ResourceSourceType = (typeof resourceSourceTypes)[number];
export type WorkplaceStatus = "inactive" | "understaffed" | "limited" | "full";

export type ExternalResourceSource = {
  id: string;
  name: string;
  type: ResourceSourceType;
  resourceId: string;
  enabled: boolean;
  maxProduction: number;
  workforce: WorkforceAllocation;
  travelTime: string;
  transportCapacity: number;
  notes: string;
};

export type ResourceRequirement = {
  resourceId: string;
  amount: number;
};

export type PhasePrerequisite = {
  id: string;
  label: string;
};

export type BuildPhaseDefinition = {
  name: string;
  description: string;
  requirements: ResourceRequirement[];
  workersRequired: number;
  prerequisites: PhasePrerequisite[];
};

export type BuildPlan = {
  id: string;
  name: string;
  buildingType: string;
  phases: Record<ConstructionStage, BuildPhaseDefinition>;
};

export type ConstructionProject = {
  id: string;
  name: string;
  buildingId: string;
  buildPlanId: string;
  status: "active" | "blocked" | "planned" | "complete";
  currentStage: ConstructionStage;
  phaseProgress: number;
  resourcesReserved: boolean;
  workforce: WorkforceAllocation;
  fulfilledPrerequisiteIds: string[];
};

export type Treasury = {
  balanceBaseUnits: number;
  displayCurrencyId: string;
  defaultWagePerCycle: number;
  defaultWageCurrencyId: string;
  recruitmentCostPerResident: number;
  recruitmentCurrencyId: string;
  ledger: TreasuryLedgerEntry[];
};

export type TreasuryLedgerEntry = {
  id: string;
  cycle: number;
  type: "income" | "expense";
  sourceId: string;
  label: string;
  amountBaseUnits: number;
};

export const currentSchemaVersion = 16 as const;

export type EditorDocument = {
  schemaVersion: typeof currentSchemaVersion;
  id: string;
  settlementName: string;
  ruleset: string;
  mode: "setup" | "campaign";
  campaignCycle: number;
  population: {
    permanent: number;
    named: number;
    workingResidents: number;
    temporaryLabel: string;
  };
  treasury: Treasury;
  map: {
    width: number;
    height: number;
    grid: MapGrid;
    scene: MapSceneState;
    referenceAssetId?: string;
    terrainStrokes: TerrainStroke[];
    buildings: Building[];
    palisades: Palisade[];
    gates: Gate[];
    zones: MapZone[];
    paths: MapPath[];
    markers: MapMarker[];
    decorations: MapDecoration[];
  };
  resources: ResourceSummary[];
  resourceSources: ExternalResourceSource[];
  buildPlans: BuildPlan[];
  projects: ConstructionProject[];
  updatedAt: string;
};

export type SelectableMapObject =
  | { kind: "building"; value: Building }
  | { kind: "palisade"; value: Palisade }
  | { kind: "gate"; value: Gate }
  | { kind: "path"; value: MapPath }
  | { kind: "zone"; value: MapZone }
  | { kind: "marker"; value: MapMarker }
  | { kind: "decoration"; value: MapDecoration };

export type PlaceableMapObject =
  | { kind: "building"; value: Building }
  | { kind: "barrier"; value: Palisade }
  | { kind: "gate"; value: Gate }
  | { kind: "path"; value: MapPath }
  | { kind: "zone"; value: MapZone }
  | { kind: "marker"; value: MapMarker }
  | { kind: "decoration"; value: MapDecoration };
