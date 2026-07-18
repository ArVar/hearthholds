import {
  getBuildPlan,
  getMissingPrerequisites,
  hasRequiredProjectWorkforce,
} from "./construction";
import { getEffectiveProduction } from "./resourceSources";
import {
  getBuildingProduction,
  getBuildingProductionBreakdown,
} from "./workforce";
import { applyTreasuryCycle } from "./treasury";
import { constructionStages } from "./types";
import type {
  ConstructionProject,
  EditorDocument,
  ResourceRequirement,
} from "./types";

export type PhaseCompletionForecast = {
  cycles: number | null;
  blockedResourceIds: string[];
  workforceBlocked: boolean;
};

export function getCycleProduction(
  document: EditorDocument,
  resourceId: string,
): number {
  const externalProduction = document.resourceSources
    .filter((source) => source.resourceId === resourceId)
    .reduce((total, source) => total + getEffectiveProduction(source), 0);
  const buildingProduction = document.map.buildings
    .flatMap((building) => getBuildingProductionBreakdown(building))
    .filter((output) => output.resourceId === resourceId)
    .reduce((total, output) => total + output.amount, 0);
  return externalProduction + buildingProduction;
}

function produceCycleResources(document: EditorDocument): Map<string, number> {
  const production = new Map<string, number>();
  const add = (resourceId: string, amount: number) => {
    production.set(resourceId, (production.get(resourceId) ?? 0) + amount);
  };

  for (const source of document.resourceSources) {
    add(source.resourceId, getEffectiveProduction(source));
  }
  for (const building of document.map.buildings) {
    if (!building.operation) continue;
    const total = getBuildingProduction(building);
    if (total <= 0) continue;
    for (const output of building.operation.outputs) {
      const rawAmount = total * output.allocation + output.carry;
      const amount = Math.floor(rawAmount);
      output.carry = rawAmount - amount;
      add(output.resourceId, amount);
    }
  }
  return production;
}

export function getPhaseCompletionForecast(
  document: EditorDocument,
  project: ConstructionProject,
): PhaseCompletionForecast {
  const phase = getBuildPlan(document, project)?.phases[project.currentStage];
  if (!phase || project.status === "complete") {
    return { cycles: 0, blockedResourceIds: [], workforceBlocked: false };
  }
  if (getMissingPrerequisites(project, phase).length > 0) {
    return { cycles: null, blockedResourceIds: [], workforceBlocked: false };
  }
  const workforceBlocked = !hasRequiredProjectWorkforce(project, phase);
  if (project.resourcesReserved) {
    return {
      cycles: workforceBlocked ? null : 1,
      blockedResourceIds: [],
      workforceBlocked,
    };
  }

  let cycles = 1;
  const blockedResourceIds: string[] = [];
  for (const requirement of phase.requirements) {
    const resource = document.resources.find(
      (candidate) => candidate.id === requirement.resourceId,
    );
    const available = resource ? resource.total - resource.reserved : 0;
    const shortfall = Math.max(0, requirement.amount - available);
    if (shortfall === 0) continue;
    const cycleProduction = getCycleProduction(document, requirement.resourceId);
    if (cycleProduction <= 0) {
      blockedResourceIds.push(requirement.resourceId);
      continue;
    }
    cycles = Math.max(cycles, Math.ceil(shortfall / cycleProduction));
  }

  return {
    cycles: blockedResourceIds.length > 0 || workforceBlocked ? null : cycles,
    blockedResourceIds,
    workforceBlocked,
  };
}

function requirementsAvailable(
  document: EditorDocument,
  requirements: ResourceRequirement[],
): boolean {
  return requirements.every((requirement) => {
    const resource = document.resources.find(
      (candidate) => candidate.id === requirement.resourceId,
    );
    return resource && resource.total - resource.reserved >= requirement.amount;
  });
}

function updateWaitingProgress(
  document: EditorDocument,
  project: ConstructionProject,
  requirements: ResourceRequirement[],
): void {
  if (requirements.length === 0) {
    project.phaseProgress = 99;
    return;
  }
  const coverage = requirements.map((requirement) => {
    const resource = document.resources.find(
      (candidate) => candidate.id === requirement.resourceId,
    );
    const available = resource ? resource.total - resource.reserved : 0;
    return requirement.amount === 0 ? 1 : Math.min(1, available / requirement.amount);
  });
  project.phaseProgress = Math.min(99, Math.round(Math.min(...coverage) * 100));
  const building = document.map.buildings.find(
    (candidate) => candidate.id === project.buildingId,
  );
  if (building) {
    const phase = getBuildPlan(document, project)?.phases[project.currentStage];
    if (phase) building.subtitle = `${phase.name} · ${project.phaseProgress}%`;
  }
}

function completePhase(document: EditorDocument, project: ConstructionProject): void {
  const plan = getBuildPlan(document, project);
  const phase = plan?.phases[project.currentStage];
  if (!plan || !phase) return;

  for (const requirement of phase.requirements) {
    const resource = document.resources.find(
      (candidate) => candidate.id === requirement.resourceId,
    );
    if (!resource) continue;
    if (project.resourcesReserved) {
      resource.reserved = Math.max(0, resource.reserved - requirement.amount);
    }
    if (resource.consumable) {
      resource.total = Math.max(0, resource.total - requirement.amount);
    }
  }

  const stageIndex = constructionStages.indexOf(project.currentStage);
  const isFinalPhase = stageIndex === constructionStages.length - 1;
  project.resourcesReserved = false;
  const building = document.map.buildings.find(
    (candidate) => candidate.id === project.buildingId,
  );

  if (isFinalPhase) {
    project.status = "complete";
    project.phaseProgress = 100;
    project.workforce.residentWorkers = 0;
    project.workforce.hiredWorkers = 0;
    if (building) {
      building.status = "complete";
      building.upgradeTier = "base";
      building.subtitle = `${phase.name} · 100%`;
    }
    return;
  }

  const nextStage = constructionStages[stageIndex + 1];
  if (!nextStage) return;
  project.currentStage = nextStage;
  project.phaseProgress = 0;
  const nextPhase = plan.phases[nextStage];
  project.workforce.minWorkers = nextPhase.workersRequired;
  project.workforce.maxWorkers = Math.max(
    nextPhase.workersRequired,
    nextPhase.workersRequired * 2,
  );
  project.workforce.residentWorkers = Math.min(
    project.workforce.residentWorkers,
    project.workforce.maxWorkers,
  );
  project.workforce.hiredWorkers = Math.min(
    project.workforce.hiredWorkers,
    project.workforce.maxWorkers - project.workforce.residentWorkers,
  );
  const missingPrerequisites = getMissingPrerequisites(project, nextPhase);
  project.status = missingPrerequisites.length > 0 ? "blocked" : "active";
  if (building) {
    building.status = "construction";
    building.subtitle = `${nextPhase.name} · 0%`;
  }
}

export function advanceDocumentCycle(document: EditorDocument): boolean {
  if (!applyTreasuryCycle(document)) return false;
  document.campaignCycle += 1;

  const cycleProduction = produceCycleResources(document);
  for (const resource of document.resources) {
    resource.total += cycleProduction.get(resource.id) ?? 0;
  }

  for (const project of document.projects) {
    if (project.status === "complete" || project.status === "planned") continue;
    const phase = getBuildPlan(document, project)?.phases[project.currentStage];
    if (
      !phase ||
      getMissingPrerequisites(project, phase).length > 0 ||
      !hasRequiredProjectWorkforce(project, phase)
    ) {
      project.status = "blocked";
      continue;
    }
    if (project.resourcesReserved || requirementsAvailable(document, phase.requirements)) {
      completePhase(document, project);
    } else {
      project.status = "active";
      updateWaitingProgress(document, project, phase.requirements);
    }
  }
  return true;
}
