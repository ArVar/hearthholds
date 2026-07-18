import type {
  BuildPhaseDefinition,
  ConstructionStage,
  PhasePrerequisite,
  ResourceSummary,
} from "../domain/types";
import type { Translate } from "./I18nProvider";
import type { TranslationKey } from "./messages";

const resourceNameKeys: Partial<Record<string, TranslationKey>> = {
  wood: "resource.wood",
  stone: "resource.stone",
  metal: "resource.metal",
  ironOre: "resource.ironOre",
  copperOre: "resource.copperOre",
  goldOre: "resource.goldOre",
  grain: "resource.grain",
  hops: "resource.hops",
};

const resourceUnitKeys: Partial<Record<string, TranslationKey>> = {
  wood: "resourceUnit.units",
  stone: "resourceUnit.units",
  metal: "resourceUnit.units",
  ironOre: "resourceUnit.units",
  copperOre: "resourceUnit.units",
  goldOre: "resourceUnit.units",
  grain: "resourceUnit.units",
  hops: "resourceUnit.units",
};

const constructionStageKeys: Record<ConstructionStage, TranslationKey> = {
  foundation: "stage.foundation",
  masonry: "stage.masonry",
  completion: "stage.completion",
};

const simpleForgeDescriptionKeys: Record<ConstructionStage, TranslationKey> = {
  foundation: "plan.simpleForge.foundationDescription",
  masonry: "plan.simpleForge.masonryDescription",
  completion: "plan.simpleForge.completionDescription",
};

const standardDescriptionKeys: Record<ConstructionStage, TranslationKey> = {
  foundation: "plan.standard.foundationDescription",
  masonry: "plan.standard.masonryDescription",
  completion: "plan.standard.completionDescription",
};

const prerequisiteKeys: Partial<Record<string, TranslationKey>> = {
  "smith-available": "prerequisite.smithAvailable",
};

export function localizeResourceName(resource: ResourceSummary, t: Translate): string {
  const key = resourceNameKeys[resource.id];
  return key ? t(key) : resource.name;
}

export function localizeResourceUnit(resource: ResourceSummary, t: Translate): string {
  const key = resourceUnitKeys[resource.id];
  return key ? t(key) : resource.unit;
}

export function localizePhaseName(
  stage: ConstructionStage,
  phase: BuildPhaseDefinition,
  t: Translate,
): string {
  return t(constructionStageKeys[stage]) || phase.name;
}

export function localizePhaseDescription(
  planId: string,
  stage: ConstructionStage,
  phase: BuildPhaseDefinition,
  t: Translate,
): string {
  if (planId === "simple-forge") return t(simpleForgeDescriptionKeys[stage]);
  if (planId === "standard-building") return t(standardDescriptionKeys[stage]);
  return phase.description;
}

export function localizePrerequisite(
  prerequisite: PhasePrerequisite,
  t: Translate,
): string {
  const key = prerequisiteKeys[prerequisite.id];
  return key ? t(key) : prerequisite.label;
}
