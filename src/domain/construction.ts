import type {
  BuildPhaseDefinition,
  BuildPlan,
  Building,
  ConstructionProject,
  EditorDocument,
  ResourceRequirement,
  ResourceSummary,
} from "./types";

export const standardBuildPlanId = "standard-building";

export const standardBuildPlan: BuildPlan = {
  id: standardBuildPlanId,
  name: "Standardbauplan",
  buildingType: "*",
  phases: {
    foundation: {
      name: "Fundament",
      description: "Baugrund vorbereiten und ein tragfähiges Fundament anlegen.",
      requirements: [
        { resourceId: "wood", amount: 2 },
        { resourceId: "stone", amount: 4 },
      ],
      workersRequired: 2,
      prerequisites: [],
    },
    masonry: {
      name: "Mauerwerk",
      description: "Tragende Wände, Stützen und Öffnungen errichten.",
      requirements: [
        { resourceId: "wood", amount: 5 },
        { resourceId: "stone", amount: 8 },
      ],
      workersRequired: 3,
      prerequisites: [],
    },
    completion: {
      name: "Dach & Fertigstellung",
      description: "Dach schließen und das Gebäude gebrauchsfertig ausbauen.",
      requirements: [
        { resourceId: "wood", amount: 12 },
        { resourceId: "stone", amount: 2 },
      ],
      workersRequired: 3,
      prerequisites: [],
    },
  },
};

export type PhaseResourceState = {
  requirement: ResourceRequirement;
  resource: ResourceSummary;
  available: number;
  secured: boolean;
  sufficient: boolean;
};

export function getBuildPlan(
  document: EditorDocument,
  project: ConstructionProject,
): BuildPlan | undefined {
  return (
    document.buildPlans.find((plan) => plan.id === project.buildPlanId) ??
    (project.buildPlanId === standardBuildPlanId ? standardBuildPlan : undefined)
  );
}

export function getBuildPlanForBuilding(
  document: EditorDocument,
  building: Building,
): BuildPlan {
  const buildingTypeIds = [building.assetTypeId, building.type].filter(
    (id): id is string => Boolean(id),
  );
  return (
    document.buildPlans.find(
      (plan) =>
        plan.id !== standardBuildPlanId && buildingTypeIds.includes(plan.buildingType),
    ) ??
    document.buildPlans.find((plan) => plan.id === standardBuildPlanId) ??
    standardBuildPlan
  );
}

export function createConstructionProject(
  document: EditorDocument,
  building: Building,
): ConstructionProject {
  const plan = getBuildPlanForBuilding(document, building);
  return {
    id: `${building.id}-construction`,
    name: building.name,
    buildingId: building.id,
    buildPlanId: plan.id,
    status: "planned",
    currentStage: "foundation",
    phaseProgress: 0,
    resourcesReserved: false,
    workforce: {
      minWorkers: plan.phases.foundation.workersRequired,
      maxWorkers: Math.max(1, plan.phases.foundation.workersRequired * 2),
      residentWorkers: 0,
      hiredWorkers: 0,
      wagePerCycle: document.treasury.defaultWagePerCycle,
      wageCurrencyId: document.treasury.defaultWageCurrencyId,
    },
    fulfilledPrerequisiteIds: [],
  };
}

export function getCurrentPhase(
  document: EditorDocument,
  project: ConstructionProject,
): BuildPhaseDefinition | undefined {
  return getBuildPlan(document, project)?.phases[project.currentStage];
}

export function getPhaseResourceStates(
  document: EditorDocument,
  project: ConstructionProject,
): PhaseResourceState[] {
  const phase = getCurrentPhase(document, project);
  if (!phase) return [];

  return phase.requirements.flatMap((requirement) => {
    const resource = document.resources.find((item) => item.id === requirement.resourceId);
    if (!resource) return [];

    const secured = project.resourcesReserved;
    const available = secured ? requirement.amount : resource.total - resource.reserved;

    return [
      {
        requirement,
        resource,
        available,
        secured,
        sufficient: secured || available >= requirement.amount,
      },
    ];
  });
}

export function getMissingPrerequisites(
  project: ConstructionProject,
  phase: BuildPhaseDefinition,
) {
  return phase.prerequisites.filter(
    (prerequisite) => !project.fulfilledPrerequisiteIds.includes(prerequisite.id),
  );
}

export function canReserveCurrentPhase(
  document: EditorDocument,
  project: ConstructionProject,
): boolean {
  const phase = getCurrentPhase(document, project);
  if (!phase || project.resourcesReserved || project.status === "complete") return false;

  return (
    getMissingPrerequisites(project, phase).length === 0 &&
    getPhaseResourceStates(document, project).every((state) => state.sufficient)
  );
}

export function hasRequiredProjectWorkforce(
  project: ConstructionProject,
  phase: BuildPhaseDefinition,
): boolean {
  return (
    project.workforce.residentWorkers + project.workforce.hiredWorkers
    >= phase.workersRequired
  );
}

export function formatRequirementSummary(
  document: EditorDocument,
  phase: BuildPhaseDefinition,
): string {
  const materials = phase.requirements
    .map((requirement) => {
      const resource = document.resources.find((item) => item.id === requirement.resourceId);
      return `${requirement.amount} ${resource?.name ?? requirement.resourceId}`;
    })
    .join(" · ");
  return [materials, `${phase.workersRequired} Arbeitskräfte`]
    .filter(Boolean)
    .join(" · ");
}
