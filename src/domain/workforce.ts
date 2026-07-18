import type {
  Building,
  BuildingOperation,
  ConstructionProject,
  EditorDocument,
  ExternalResourceSource,
  WorkforceAllocation,
  WorkplaceStatus,
} from "./types";
import { toBaseCurrency } from "./currency";

export type BuildingProductionOutput = {
  resourceId: string;
  amount: number;
};

export type WorkforceSummary = {
  residents: number;
  workingResidents: number;
  assignedResidents: number;
  freeResidents: number;
  hiredWorkers: number;
  totalWorkers: number;
  housingCapacity: number;
  freeHousing: number;
  cyclePayrollBaseUnits: number;
  treasuryBalanceBaseUnits: number;
  payrollAffordable: boolean;
};

export function normalizeWorkforce(
  allocation: WorkforceAllocation,
): WorkforceAllocation {
  const minWorkers = Math.max(0, Math.round(allocation.minWorkers));
  const maxWorkers = Math.max(minWorkers, Math.round(allocation.maxWorkers));
  const residentWorkers = Math.min(
    maxWorkers,
    Math.max(0, Math.round(allocation.residentWorkers)),
  );
  const hiredWorkers = Math.min(
    Math.max(0, maxWorkers - residentWorkers),
    Math.max(0, Math.round(allocation.hiredWorkers)),
  );
  return {
    minWorkers,
    maxWorkers,
    residentWorkers,
    hiredWorkers,
    wagePerCycle: Math.max(0, allocation.wagePerCycle),
    wageCurrencyId: allocation.wageCurrencyId,
  };
}

export function getWorkerCount(allocation: WorkforceAllocation): number {
  return allocation.residentWorkers + allocation.hiredWorkers;
}

export function getWorkplaceStatus(
  enabled: boolean,
  allocation: WorkforceAllocation,
): WorkplaceStatus {
  if (!enabled) return "inactive";
  const workers = getWorkerCount(allocation);
  if (workers < allocation.minWorkers) return "understaffed";
  if (workers < allocation.maxWorkers) return "limited";
  return "full";
}

export function getWorkforceProduction(
  enabled: boolean,
  maxProduction: number,
  allocation: WorkforceAllocation,
): number {
  const workers = getWorkerCount(allocation);
  if (
    !enabled ||
    workers < allocation.minWorkers ||
    allocation.maxWorkers <= 0 ||
    maxProduction <= 0
  ) {
    return 0;
  }
  return Math.floor(
    Math.max(0, maxProduction) * Math.min(workers, allocation.maxWorkers)
      / allocation.maxWorkers,
  );
}

export function isBuildingOperational(building: Building): boolean {
  return building.status === "existing" || building.status === "complete";
}

export function getBuildingProduction(building: Building): number {
  if (!building.operation || !isBuildingOperational(building)) return 0;
  return getWorkforceProduction(
    building.operation.enabled,
    building.operation.maxProduction,
    building.operation.workforce,
  );
}

export function getBuildingProductionBreakdown(
  building: Building,
): BuildingProductionOutput[] {
  const total = getBuildingProduction(building);
  if (!building.operation || total <= 0) {
    return building.operation?.outputs.map(({ resourceId }) => ({ resourceId, amount: 0 }))
      ?? [];
  }
  return building.operation.outputs.map((output) => ({
    resourceId: output.resourceId,
    amount: Math.floor(total * output.allocation + output.carry),
  }));
}

export function normalizeProductionOutputs(
  outputs: BuildingOperation["outputs"],
): BuildingOperation["outputs"] {
  const valid = outputs
    .filter((output) => output.resourceId)
    .map((output) => ({
      ...output,
      allocation: Math.max(0, output.allocation),
      carry: Math.min(0.999999, Math.max(0, output.carry)),
    }));
  if (valid.length === 0) return [];
  const allocationTotal = valid.reduce(
    (total, output) => total + output.allocation,
    0,
  );
  if (allocationTotal <= 0) {
    const equalShare = 1 / valid.length;
    return valid.map((output) => ({ ...output, allocation: equalShare }));
  }
  return valid.map((output) => ({
    ...output,
    allocation: output.allocation / allocationTotal,
  }));
}

export function setProductionOutputAllocation(
  outputs: BuildingOperation["outputs"],
  outputIndex: number,
  allocation: number,
): BuildingOperation["outputs"] {
  if (outputs.length <= 1) {
    return outputs.map((output) => ({ ...output, allocation: 1 }));
  }
  const target = Math.min(1, Math.max(0, allocation));
  const otherTotal = outputs.reduce(
    (total, output, index) =>
      index === outputIndex ? total : total + output.allocation,
    0,
  );
  const remaining = 1 - target;
  return outputs.map((output, index) => {
    if (index === outputIndex) return { ...output, allocation: target };
    return {
      ...output,
      allocation:
        otherTotal > 0
          ? (output.allocation / otherTotal) * remaining
          : remaining / (outputs.length - 1),
    };
  });
}

export function getHousingCapacity(document: EditorDocument): number {
  return document.map.buildings.reduce(
    (total, building) =>
      total + (isBuildingOperational(building) ? building.housingCapacity : 0),
    0,
  );
}

function activeBuildingOperations(document: EditorDocument): BuildingOperation[] {
  return document.map.buildings.flatMap((building) =>
    building.operation && building.operation.enabled && isBuildingOperational(building)
      ? [building.operation]
      : [],
  );
}

function activeSources(document: EditorDocument): ExternalResourceSource[] {
  return document.resourceSources.filter((source) => source.enabled);
}

function activeProjects(document: EditorDocument): ConstructionProject[] {
  return document.projects.filter((project) => project.status !== "complete");
}

export function getAssignedResidentWorkers(document: EditorDocument): number {
  return [
    ...activeBuildingOperations(document).map(
      (operation) => operation.workforce.residentWorkers,
    ),
    ...activeSources(document).map((source) => source.workforce.residentWorkers),
    ...activeProjects(document).map((project) => project.workforce.residentWorkers),
  ].reduce((total, workers) => total + workers, 0);
}

export function getHiredWorkers(document: EditorDocument): number {
  return [
    ...activeBuildingOperations(document).map(
      (operation) => operation.workforce.hiredWorkers,
    ),
    ...activeSources(document).map((source) => source.workforce.hiredWorkers),
    ...activeProjects(document).map((project) => project.workforce.hiredWorkers),
  ].reduce((total, workers) => total + workers, 0);
}

export function getCyclePayroll(document: EditorDocument): number {
  return [
    ...activeBuildingOperations(document).map(
      (operation) => operation.workforce.hiredWorkers * toBaseCurrency(
        document.ruleset,
        operation.workforce.wagePerCycle,
        operation.workforce.wageCurrencyId,
      ),
    ),
    ...activeSources(document).map(
      (source) => source.workforce.hiredWorkers * toBaseCurrency(
        document.ruleset,
        source.workforce.wagePerCycle,
        source.workforce.wageCurrencyId,
      ),
    ),
    ...activeProjects(document).map(
      (project) => project.workforce.hiredWorkers * toBaseCurrency(
        document.ruleset,
        project.workforce.wagePerCycle,
        project.workforce.wageCurrencyId,
      ),
    ),
  ].reduce((total, amount) => total + amount, 0);
}

export function getWorkforceSummary(document: EditorDocument): WorkforceSummary {
  const assignedResidents = getAssignedResidentWorkers(document);
  const hiredWorkers = getHiredWorkers(document);
  const housingCapacity = getHousingCapacity(document);
  const cyclePayrollBaseUnits = getCyclePayroll(document);
  return {
    residents: document.population.permanent,
    workingResidents: document.population.workingResidents,
    assignedResidents,
    freeResidents: Math.max(0, document.population.workingResidents - assignedResidents),
    hiredWorkers,
    totalWorkers: assignedResidents + hiredWorkers,
    housingCapacity,
    freeHousing: Math.max(0, housingCapacity - document.population.permanent),
    cyclePayrollBaseUnits,
    treasuryBalanceBaseUnits: document.treasury.balanceBaseUnits,
    payrollAffordable: document.treasury.balanceBaseUnits >= cyclePayrollBaseUnits,
  };
}

export function getAssignableResidentWorkers(
  document: EditorDocument,
  currentAssignment: number,
): number {
  const assignedElsewhere = Math.max(
    0,
    getAssignedResidentWorkers(document) - currentAssignment,
  );
  return Math.max(0, document.population.workingResidents - assignedElsewhere);
}

export function canRecruitResidents(
  document: EditorDocument,
  residents: number,
  workingResidents: number,
): boolean {
  const count = Math.max(0, Math.round(residents));
  const workers = Math.max(0, Math.round(workingResidents));
  const summary = getWorkforceSummary(document);
  const cost = count * toBaseCurrency(
    document.ruleset,
    document.treasury.recruitmentCostPerResident,
    document.treasury.recruitmentCurrencyId,
  );
  return (
    count > 0 &&
    workers <= count &&
    count <= summary.freeHousing &&
    cost <= document.treasury.balanceBaseUnits
  );
}
