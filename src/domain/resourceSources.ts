import type { LocalizedText } from "../i18n/types";
import { getBuildPlan } from "./construction";
import type {
  EditorDocument,
  ExternalResourceSource,
  ResourceSourceType,
  ResourceSummary,
} from "./types";
import {
  getBuildingProductionBreakdown,
  getWorkforceProduction,
  getWorkplaceStatus,
  isBuildingOperational,
} from "./workforce";

export type ResourceSourceCatalogEntry = {
  type: ResourceSourceType;
  label: LocalizedText;
  description: LocalizedText;
  resource: {
    id: string;
    name: LocalizedText;
    unit: LocalizedText;
    consumable: ResourceSummary["consumable"];
  };
  defaults: Pick<
    ExternalResourceSource,
    "enabled" | "maxProduction" | "workforce" | "travelTime" | "transportCapacity"
  >;
};

export const resourceSourceCatalog: ResourceSourceCatalogEntry[] = [
  {
    type: "forest",
    label: { de: "Wald", en: "Forest" },
    description: { de: "Quelle für Bau- und Brennholz", en: "Source of timber and firewood" },
    resource: {
      id: "wood",
      name: { de: "Holz", en: "Wood" },
      unit: { de: "Einheiten", en: "units" },
      consumable: true,
    },
    defaults: {
      enabled: true,
      maxProduction: 8,
      workforce: { minWorkers: 1, maxWorkers: 4, residentWorkers: 0, hiredWorkers: 0, wagePerCycle: 1, wageCurrencyId: "sp" },
      travelTime: "20 Min.",
      transportCapacity: 8,
    },
  },
  {
    type: "quarry",
    label: { de: "Steinbruch", en: "Quarry" },
    description: { de: "Quelle für Bruch- und Werkstein", en: "Source of rubble and cut stone" },
    resource: {
      id: "stone",
      name: { de: "Stein", en: "Stone" },
      unit: { de: "Einheiten", en: "units" },
      consumable: true,
    },
    defaults: {
      enabled: true,
      maxProduction: 6,
      workforce: { minWorkers: 2, maxWorkers: 5, residentWorkers: 0, hiredWorkers: 0, wagePerCycle: 1, wageCurrencyId: "sp" },
      travelTime: "30 Min.",
      transportCapacity: 6,
    },
  },
  {
    type: "ironMine",
    label: { de: "Eisenerzmine", en: "Iron mine" },
    description: { de: "Quelle für Eisenerz", en: "Source of iron ore" },
    resource: {
      id: "ironOre",
      name: { de: "Eisenerz", en: "Iron ore" },
      unit: { de: "Einheiten", en: "units" },
      consumable: true,
    },
    defaults: {
      enabled: true,
      maxProduction: 4,
      workforce: { minWorkers: 2, maxWorkers: 6, residentWorkers: 0, hiredWorkers: 0, wagePerCycle: 1, wageCurrencyId: "sp" },
      travelTime: "45 Min.",
      transportCapacity: 4,
    },
  },
  {
    type: "copperMine",
    label: { de: "Kupfermine", en: "Copper mine" },
    description: { de: "Quelle für Kupfererz", en: "Source of copper ore" },
    resource: {
      id: "copperOre",
      name: { de: "Kupfererz", en: "Copper ore" },
      unit: { de: "Einheiten", en: "units" },
      consumable: true,
    },
    defaults: {
      enabled: true,
      maxProduction: 3,
      workforce: {
        minWorkers: 3,
        maxWorkers: 7,
        residentWorkers: 0,
        hiredWorkers: 0,
        wagePerCycle: 1,
        wageCurrencyId: "sp",
      },
      travelTime: "60 Min.",
      transportCapacity: 3,
    },
  },
  {
    type: "goldMine",
    label: { de: "Goldmine", en: "Gold mine" },
    description: { de: "Quelle für Golderz", en: "Source of gold ore" },
    resource: {
      id: "goldOre",
      name: { de: "Golderz", en: "Gold ore" },
      unit: { de: "Einheiten", en: "units" },
      consumable: true,
    },
    defaults: {
      enabled: true,
      maxProduction: 2,
      workforce: {
        minWorkers: 3,
        maxWorkers: 8,
        residentWorkers: 0,
        hiredWorkers: 0,
        wagePerCycle: 1,
        wageCurrencyId: "sp",
      },
      travelTime: "90 Min.",
      transportCapacity: 2,
    },
  },
];

export function getEffectiveProduction(source: ExternalResourceSource): number {
  return Math.min(
    getWorkforceProduction(
      source.enabled,
      source.maxProduction,
      source.workforce,
    ),
    source.transportCapacity,
  );
}

export function getResourceSourceStatus(source: ExternalResourceSource) {
  return getWorkplaceStatus(source.enabled, source.workforce);
}

export function isResourceVisibleInHud(
  document: EditorDocument,
  resourceId: string,
): boolean {
  const resource = document.resources.find(
    (candidate) => candidate.id === resourceId,
  );
  if (resource && (resource.total > 0 || resource.reserved > 0)) return true;
  if (
    document.resourceSources.some(
      (source) => source.enabled && source.resourceId === resourceId,
    )
  ) {
    return true;
  }
  return document.map.buildings.some((building) =>
    building.operation?.enabled
    && isBuildingOperational(building)
    && building.operation.outputs.some(
      (output) => output.resourceId === resourceId,
    ),
  );
}

export type ResourceFlowEntry = {
  id: string;
  label: string;
  amount?: number;
};

export type ResourceFlowBreakdown = {
  production: ResourceFlowEntry[];
  consumption: ResourceFlowEntry[];
  productionTotal: number;
  consumptionTotal: number;
};

export function getResourceFlowBreakdown(
  document: EditorDocument,
  resourceId: string,
): ResourceFlowBreakdown {
  const resource = document.resources.find((candidate) => candidate.id === resourceId);
  const production: ResourceFlowEntry[] = document.resourceSources
    .filter((source) => source.resourceId === resourceId)
    .map((source) => ({
      id: source.id,
      label: source.name,
      amount: getEffectiveProduction(source),
    }));

  production.push(
    ...document.map.buildings.flatMap<ResourceFlowEntry>((building) =>
      getBuildingProductionBreakdown(building)
        .filter((output) => output.resourceId === resourceId)
        .map((output) => ({
          id: `${building.id}-${resourceId}`,
          label: building.name,
          amount: output.amount,
        })),
    ),
  );

  if (production.length === 0 && resource?.source) {
    production.push({ id: `legacy-${resourceId}`, label: resource.source });
  }

  const consumption = document.projects.flatMap<ResourceFlowEntry>((project) => {
    if (project.status === "complete" || project.status === "planned") return [];
    const requirement = getBuildPlan(document, project)
      ?.phases[project.currentStage].requirements
      .find((candidate) => candidate.resourceId === resourceId);
    return requirement
      ? [{ id: project.id, label: project.name, amount: requirement.amount }]
      : [];
  });
  const attributedConsumption = consumption.reduce(
    (total, entry) => total + (entry.amount ?? 0),
    0,
  );
  const unassigned = Math.max(0, (resource?.reserved ?? 0) - attributedConsumption);
  if (unassigned > 0) {
    consumption.push({ id: `other-${resourceId}`, label: "", amount: unassigned });
  }

  return {
    production,
    consumption,
    productionTotal: production.reduce((total, entry) => total + (entry.amount ?? 0), 0),
    consumptionTotal: consumption.reduce((total, entry) => total + (entry.amount ?? 0), 0),
  };
}
