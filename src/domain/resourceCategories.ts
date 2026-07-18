import type { LocalizedText } from "../i18n/types";

export type ResourceCategoryDefinition = {
  id: string;
  label: LocalizedText;
  resourceIds: readonly string[];
};

export const resourceCategoryDefinitions: ResourceCategoryDefinition[] = [
  {
    id: "agriculture",
    label: { de: "Landwirtschaft", en: "Agriculture" },
    resourceIds: ["grain", "hops"],
  },
  {
    id: "mining",
    label: { de: "Bergbau", en: "Mining" },
    resourceIds: ["ironOre", "copperOre", "goldOre"],
  },
];

export function getResourceCategory(
  resourceId: string,
): ResourceCategoryDefinition | undefined {
  return resourceCategoryDefinitions.find((category) =>
    category.resourceIds.includes(resourceId),
  );
}
