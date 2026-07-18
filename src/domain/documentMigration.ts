import {
  getBuildingAssetManifest,
  getBuildingOperationDefaults,
} from "./visualAssets";
import { currentSchemaVersion } from "./types";
import {
  getCurrencyProfile,
  getLegacyCurrencyId,
  toBaseCurrency,
} from "./currency";

type MutableRecord = Record<string, any>;

const sourceWorkforceDefaults: Record<string, { min: number; max: number }> = {
  forest: { min: 1, max: 4 },
  quarry: { min: 2, max: 5 },
  oreMine: { min: 2, max: 6 },
  ironMine: { min: 2, max: 6 },
  copperMine: { min: 3, max: 7 },
  goldMine: { min: 3, max: 8 },
};

function buildingGameplay(building: MutableRecord) {
  const gameplay = getBuildingAssetManifest(building.assetTypeId)?.gameplay;
  return {
    housingCapacity: gameplay?.housingCapacity ?? 0,
    operation: getBuildingOperationDefaults(
      building.assetTypeId,
      building.upgradeTier ?? "base",
    ),
  };
}

const generatedResources: Record<string, { name: string; unit: string }> = {
  grain: { name: "Getreide", unit: "Einheiten" },
  hops: { name: "Hopfen", unit: "Einheiten" },
};

const removedGenericResourceIds = new Set(["food", "goods"]);

function ensureOperationResources(source: MutableRecord): void {
  const resourceIds = new Set<string>(
    (source.map?.buildings ?? [])
      .flatMap((building: MutableRecord) => building.operation?.outputs ?? [])
      .map((output: MutableRecord) => output.resourceId)
      .filter(Boolean),
  );
  if (
    (source.map?.buildings ?? []).some(
      (building: MutableRecord) => building.assetTypeId === "farmhouse",
    )
  ) {
    resourceIds.add("grain");
    resourceIds.add("hops");
  }
  for (const resourceId of resourceIds) {
    if (source.resources.some((resource: MutableRecord) => resource.id === resourceId)) {
      continue;
    }
    const definition = generatedResources[String(resourceId)];
    if (!definition) continue;
    source.resources.push({
      id: resourceId,
      name: definition.name,
      total: 0,
      reserved: 0,
      unit: definition.unit,
      source: "",
      consumable: true,
    });
  }
}

function migrateSchema10(source: MutableRecord): void {
  const legacyLabor = source.resources?.find(
    (resource: MutableRecord) => resource.id === "labor",
  );
  source.resources = (source.resources ?? []).filter(
    (resource: MutableRecord) => resource.id !== "labor",
  );

  source.map.buildings = (source.map?.buildings ?? []).map(
    (building: MutableRecord) => ({ ...building, ...buildingGameplay(building) }),
  );
  ensureOperationResources(source);

  source.resourceSources = (source.resourceSources ?? []).map(
    (resourceSource: MutableRecord) => {
      const workers = Math.max(0, Math.round(resourceSource.workers ?? 0));
      const defaults = sourceWorkforceDefaults[resourceSource.type] ?? {
        min: Math.min(1, workers),
        max: Math.max(1, workers),
      };
      const {
        status,
        production,
        workers: _legacyWorkers,
        ...remainingSource
      } = resourceSource;
      return {
        ...remainingSource,
        enabled: status !== "inactive",
        maxProduction: Math.max(0, production ?? 0),
        workforce: {
          minWorkers: defaults.min,
          maxWorkers: Math.max(defaults.max, workers),
          residentWorkers: workers,
          hiredWorkers: 0,
          dailyWage: 1,
        },
      };
    },
  );

  source.buildPlans = (source.buildPlans ?? []).map((plan: MutableRecord) => ({
    ...plan,
    phases: Object.fromEntries(
      Object.entries(plan.phases ?? {}).map(([stage, phaseValue]) => {
        const phase = phaseValue as MutableRecord;
        const laborRequirement = (phase.requirements ?? []).find(
          (requirement: MutableRecord) => requirement.resourceId === "labor",
        );
        return [
          stage,
          {
            ...phase,
            requirements: (phase.requirements ?? []).filter(
              (requirement: MutableRecord) => requirement.resourceId !== "labor",
            ),
            workersRequired: Math.max(0, Math.round(laborRequirement?.amount ?? 0)),
          },
        ];
      }),
    ),
  }));

  const plans = new Map<string, MutableRecord>(
    (source.buildPlans ?? []).map(
      (plan: MutableRecord): [string, MutableRecord] => [plan.id, plan],
    ),
  );
  source.projects = (source.projects ?? []).map((project: MutableRecord) => {
    const phase = plans.get(project.buildPlanId)?.phases?.[project.currentStage];
    const required = Math.max(0, Math.round(phase?.workersRequired ?? 0));
    return {
      ...project,
      workforce: {
        minWorkers: required,
        maxWorkers: Math.max(required, required * 2),
        residentWorkers: project.status === "active" ? required : 0,
        hiredWorkers: 0,
        dailyWage: 1,
      },
    };
  });

  const assignedSourceResidents = (source.resourceSources ?? []).reduce(
    (total: number, resourceSource: MutableRecord) =>
      total + resourceSource.workforce.residentWorkers,
    0,
  );
  const assignedProjectResidents = (source.projects ?? []).reduce(
    (total: number, project: MutableRecord) =>
      total + (project.status === "complete" ? 0 : project.workforce.residentWorkers),
    0,
  );
  source.population.workingResidents = Math.min(
    source.population.permanent,
    assignedSourceResidents
      + Math.max(legacyLabor?.total ?? 0, assignedProjectResidents),
  );
  source.treasury = {
    balance: 100,
    currency: "Silber",
    defaultDailyWage: 1,
    recruitmentCostPerResident: 5,
  };
  source.schemaVersion = 11;
}

function migrateSchema11(source: MutableRecord): void {
  source.map.buildings = (source.map?.buildings ?? []).map(
    (building: MutableRecord) => {
      if (!building.operation) return building;
      if (Array.isArray(building.operation.outputs)) {
        return {
          ...building,
          operation: {
            ...building.operation,
            outputs: building.operation.outputs.map((output: MutableRecord) => ({
              ...output,
              carry: Math.min(0.999999, Math.max(0, output.carry ?? 0)),
            })),
          },
        };
      }
      const legacyResourceId = building.operation.resourceId;
      const resourceId =
        building.assetTypeId === "farmhouse" && legacyResourceId === "food"
          ? "grain"
          : legacyResourceId;
      const { resourceId: _legacyResourceId, ...operation } = building.operation;
      return {
        ...building,
        operation: {
          ...operation,
          outputs: resourceId
            ? [{ resourceId, allocation: 1, carry: 0 }]
            : [],
        },
      };
    },
  );
  ensureOperationResources(source);
  source.schemaVersion = 12;
}

function migrateSchema12(source: MutableRecord): void {
  source.resources = (source.resources ?? []).filter(
    (resource: MutableRecord) => !removedGenericResourceIds.has(resource.id),
  );
  source.resourceSources = (source.resourceSources ?? []).filter(
    (resourceSource: MutableRecord) =>
      !removedGenericResourceIds.has(resourceSource.resourceId),
  );
  source.map.buildings = (source.map?.buildings ?? []).map(
    (building: MutableRecord) => {
      if (!building.operation) return building;
      const outputs = (building.operation.outputs ?? []).filter(
        (output: MutableRecord) =>
          !removedGenericResourceIds.has(output.resourceId),
      );
      const allocationTotal = outputs.reduce(
        (total: number, output: MutableRecord) => total + output.allocation,
        0,
      );
      return {
        ...building,
        operation: {
          ...building.operation,
          maxProduction:
            outputs.length === 0 ? 0 : building.operation.maxProduction,
          outputs: outputs.map((output: MutableRecord) => ({
            ...output,
            allocation:
              allocationTotal > 0
                ? output.allocation / allocationTotal
                : 1 / outputs.length,
          })),
        },
      };
    },
  );
  source.buildPlans = (source.buildPlans ?? []).map((plan: MutableRecord) => ({
    ...plan,
    phases: Object.fromEntries(
      Object.entries(plan.phases ?? {}).map(([stage, phaseValue]) => {
        const phase = phaseValue as MutableRecord;
        return [
          stage,
          {
            ...phase,
            requirements: (phase.requirements ?? []).filter(
              (requirement: MutableRecord) =>
                !removedGenericResourceIds.has(requirement.resourceId),
            ),
          },
        ];
      }),
    ),
  }));
  source.schemaVersion = 13;
}

function migrateSchema13(source: MutableRecord): void {
  source.resources = (source.resources ?? []).map((resource: MutableRecord) => {
    if (resource.id !== "metal") return resource;
    return {
      ...resource,
      id: "ironOre",
      name: resource.name === "Metal" ? "Iron ore" : "Eisenerz",
      source:
        resource.source === "Ore mine"
          ? "Iron mine"
          : resource.source === "Erzmine"
            ? "Eisenerzmine"
            : resource.source,
    };
  });
  source.resourceSources = (source.resourceSources ?? []).map(
    (resourceSource: MutableRecord) => ({
      ...resourceSource,
      type: resourceSource.type === "oreMine" ? "ironMine" : resourceSource.type,
      resourceId:
        resourceSource.resourceId === "metal"
          ? "ironOre"
          : resourceSource.resourceId,
      name:
        resourceSource.name === "Ore mine"
          ? "Iron mine"
          : resourceSource.name === "Erzmine"
            ? "Eisenerzmine"
            : resourceSource.name,
    }),
  );
  source.map.buildings = (source.map?.buildings ?? []).map(
    (building: MutableRecord) => {
      if (!building.operation) return building;
      return {
        ...building,
        operation: {
          ...building.operation,
          outputs: (building.operation.outputs ?? []).map(
            (output: MutableRecord) => ({
              ...output,
              resourceId:
                output.resourceId === "metal" ? "ironOre" : output.resourceId,
            }),
          ),
        },
      };
    },
  );
  source.buildPlans = (source.buildPlans ?? []).map((plan: MutableRecord) => ({
    ...plan,
    phases: Object.fromEntries(
      Object.entries(plan.phases ?? {}).map(([stage, phaseValue]) => {
        const phase = phaseValue as MutableRecord;
        return [
          stage,
          {
            ...phase,
            requirements: (phase.requirements ?? []).map(
              (requirement: MutableRecord) => ({
                ...requirement,
                resourceId:
                  requirement.resourceId === "metal"
                    ? "ironOre"
                    : requirement.resourceId,
              }),
            ),
          },
        ];
      }),
    ),
  }));
  source.schemaVersion = 14;
}

function migrateSchema14(source: MutableRecord): void {
  const activeBuildingOperations = (source.map?.buildings ?? []).flatMap(
    (building: MutableRecord) =>
      building.operation?.enabled
      && (building.status === "existing" || building.status === "complete")
        ? [building.operation]
        : [],
  );
  const assignedResidents = [
    ...activeBuildingOperations.map(
      (operation: MutableRecord) => operation.workforce.residentWorkers,
    ),
    ...(source.resourceSources ?? [])
      .filter((resourceSource: MutableRecord) => resourceSource.enabled)
      .map((resourceSource: MutableRecord) => resourceSource.workforce.residentWorkers),
    ...(source.projects ?? [])
      .filter((project: MutableRecord) => project.status !== "complete")
      .map((project: MutableRecord) => project.workforce.residentWorkers),
  ].reduce((total, workers) => total + workers, 0);
  const productiveBuildingGap = activeBuildingOperations.reduce(
    (total: number, operation: MutableRecord) =>
      operation.outputs?.length > 0
        ? total + Math.max(
            0,
            operation.workforce.minWorkers
              - operation.workforce.residentWorkers,
          )
        : total,
    0,
  );
  if (source.population.workingResidents <= assignedResidents) {
    source.population.workingResidents = Math.min(
      source.population.permanent,
      assignedResidents + productiveBuildingGap,
    );
  }
  source.schemaVersion = 15;
}

function migrateSchema15(source: MutableRecord): void {
  const profile = getCurrencyProfile(source.ruleset ?? "");
  const legacyCurrencyId = getLegacyCurrencyId(
    source.ruleset ?? "",
    source.treasury?.currency,
  );
  const migrateWorkforce = (workforce: MutableRecord | undefined) => {
    if (!workforce) return;
    workforce.wagePerCycle = Math.max(0, workforce.dailyWage ?? 0);
    workforce.wageCurrencyId = legacyCurrencyId;
    delete workforce.dailyWage;
  };

  source.campaignCycle = Math.max(0, Math.round(source.campaignDay ?? 0));
  delete source.campaignDay;
  source.treasury = {
    balanceBaseUnits: toBaseCurrency(
      source.ruleset ?? "",
      source.treasury?.balance ?? 0,
      legacyCurrencyId,
    ),
    displayCurrencyId: profile.defaultDisplayCurrencyId,
    defaultWagePerCycle: Math.max(0, source.treasury?.defaultDailyWage ?? 0),
    defaultWageCurrencyId: legacyCurrencyId,
    recruitmentCostPerResident: Math.max(
      0,
      source.treasury?.recruitmentCostPerResident ?? 0,
    ),
    recruitmentCurrencyId: legacyCurrencyId,
    ledger: [],
  };

  for (const building of source.map?.buildings ?? []) {
    if (!building.operation) continue;
    building.operation.incomePerCycle =
      building.operation.incomePerCycle
      ?? (building.assetTypeId === "farmhouse" ? 2 : 0);
    building.operation.incomeCurrencyId =
      building.operation.incomeCurrencyId
      ?? profile.defaultIncomeCurrencyId;
    migrateWorkforce(building.operation.workforce);
  }
  for (const resourceSource of source.resourceSources ?? []) {
    migrateWorkforce(resourceSource.workforce);
  }
  for (const project of source.projects ?? []) {
    migrateWorkforce(project.workforce);
  }
  source.schemaVersion = currentSchemaVersion;
}

export function migrateEditorDocument(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const source = structuredClone(value) as MutableRecord;
  if (source.schemaVersion === 10) migrateSchema10(source);
  if (source.schemaVersion === 11) migrateSchema11(source);
  if (source.schemaVersion === 12) migrateSchema12(source);
  if (source.schemaVersion === 13) migrateSchema13(source);
  if (source.schemaVersion === 14) migrateSchema14(source);
  if (source.schemaVersion === 15) migrateSchema15(source);
  return source;
}
