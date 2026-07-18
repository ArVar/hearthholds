import { z } from "zod";
import bridgeUrl from "../../assets/environment/herzdorf/bridge.webp";
import treeAtlasUrl from "../../assets/environment/herzdorf/tree-atlas.webp";
import genericFoundationUrl from "../../assets/environment/construction/foundation.webp";
import genericMasonryUrl from "../../assets/environment/construction/masonry.webp";
import firePitUrl from "../../assets/environment/markers/fire-pit.webp";
import wellUrl from "../../assets/environment/markers/well.webp";
import buildingDamageUrl from "../../assets/environment/overlays/building-damage.webp";
import pastureUrl from "../../assets/environment/props/pasture.webp";
import timberStackUrl from "../../assets/environment/props/timber-stack.webp";
import villageUtilityUrl from "../../assets/environment/props/village-utility.webp";
import woodpileUrl from "../../assets/environment/props/woodpile.webp";
import groundTextureUrl from "../../assets/environment/terrain/ground.png";
import riverTextureUrl from "../../assets/environment/terrain/river.png";
import roadTextureUrl from "../../assets/environment/terrain/road.png";
import wheatFieldUrl from "../../assets/environment/zones/wheat-field.webp";
import type { LocalizedText } from "../i18n/types";
import type { Building, ConstructionStage } from "./types";

export type VisualAssetDefinition = {
  id: string;
  albedoUrl: string;
  footprintScale: { x: number; y: number };
};

const paletteIconSchema = z.enum(["home", "hammer", "castle", "sprout"]);
const buildingCatalogCategorySchema = z.enum([
  "buildings.housing",
  "buildings.craft",
  "buildings.supply",
  "buildings.community",
  "buildings.defense",
]);
const localizedTextSchema = z.object({ de: z.string().min(1), en: z.string().min(1) });
const productionOutputSchema = z.object({
  resourceId: z.string().min(1),
  allocation: z.number().min(0).max(1),
});
const productionOutputsSchema = z.array(productionOutputSchema).refine(
  (outputs) =>
    outputs.length === 0
    || Math.abs(outputs.reduce((total, output) => total + output.allocation, 0) - 1)
      < 0.000001,
  "Production output allocations must total 1.",
);
const operationTierSchema = z.object({
  minWorkers: z.number().int().nonnegative(),
  maxWorkers: z.number().int().positive(),
  maxProduction: z.number().nonnegative(),
  outputs: productionOutputsSchema,
  incomePerCycle: z.number().nonnegative().optional(),
  incomeCurrencyId: z.string().min(1).optional(),
});
const buildingGameplaySchema = z.object({
  housingCapacity: z.number().int().nonnegative(),
  operation: operationTierSchema.extend({
    tierOverrides: z.object({
      extended: operationTierSchema.partial().optional(),
      master: operationTierSchema.partial().optional(),
    }).optional(),
  }).optional(),
});

const buildingAssetManifestFileSchema = z.object({
  label: localizedTextSchema,
  footprintScale: z.object({
    x: z.number().positive(),
    y: z.number().positive(),
  }),
  variants: z.array(z.string().min(1)).min(1),
  upgradeTiers: z.array(z.enum(["base", "extended", "master"])).min(1),
  gameplay: buildingGameplaySchema,
  palette: z
    .object({
      order: z.number(),
      category: buildingCatalogCategorySchema,
      tags: z.array(localizedTextSchema),
      icon: paletteIconSchema,
      width: z.number().positive(),
      height: z.number().positive(),
      shape: z.enum(["rect", "circle"]),
      color: z.string().min(1),
      subtitle: localizedTextSchema,
    })
    .optional(),
});

export type BuildingPaletteIcon = z.infer<typeof paletteIconSchema>;
export type BuildingCatalogCategory = z.infer<typeof buildingCatalogCategorySchema>;
export type BuildingAssetManifest = z.infer<typeof buildingAssetManifestFileSchema> & {
  id: string;
};
export type BuildingPaletteTemplate = Pick<
  Building,
  | "width"
  | "height"
  | "shape"
  | "color"
  | "visualVariant"
  | "upgradeTier"
  | "housingCapacity"
  | "operation"
> & {
  assetTypeId: string;
  label: LocalizedText;
  subtitle: LocalizedText;
  icon: BuildingPaletteIcon;
  order: number;
  category: BuildingCatalogCategory;
  tags: LocalizedText[];
  catalogVariants: Array<{
    id: string;
    thumbnailUrl: string;
  }>;
};

const manifestModules = import.meta.glob("../../assets/buildings/*/manifest.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

const buildingImageModules = import.meta.glob(
  "../../assets/buildings/**/*.{png,jpg,jpeg,webp}",
  { eager: true, import: "default", query: "?url" },
) as Record<string, string>;

const buildingManifests = new Map<string, BuildingAssetManifest>();

Object.entries(manifestModules).forEach(([path, value]) => {
  const folderId = path.match(/\/buildings\/([^/]+)\/manifest\.json$/)?.[1];
  if (!folderId) throw new Error(`Cannot derive building type from manifest path: ${path}`);
  if (buildingManifests.has(folderId)) {
    throw new Error(`Duplicate building asset manifest for "${folderId}".`);
  }
  buildingManifests.set(folderId, {
    ...buildingAssetManifestFileSchema.parse(value),
    id: folderId,
  });
});

const buildingDefinitions = Object.entries(buildingImageModules).map(
  ([path, albedoUrl]): VisualAssetDefinition => {
    const match = path.match(
      /\/buildings\/([^/]+)\/(.+)\.(?:png|jpe?g|webp)$/i,
    );
    if (!match) throw new Error(`Cannot derive building asset id from path: ${path}`);

    const [, buildingTypeId, relativeAssetId] = match;
    const manifest = buildingManifests.get(buildingTypeId);
    if (!manifest) {
      throw new Error(`Missing manifest for building assets in "${buildingTypeId}".`);
    }

    return {
      id: `building/${buildingTypeId}/${relativeAssetId}`,
      albedoUrl,
      footprintScale: manifest.footprintScale,
    };
  },
);

const environmentDefinitions: VisualAssetDefinition[] = [
  ["environment/tree-atlas", treeAtlasUrl],
  ["environment/bridge", bridgeUrl],
  ["environment/ground-texture", groundTextureUrl],
  ["environment/river-texture", riverTextureUrl],
  ["environment/road-texture", roadTextureUrl],
  ["environment/marker/well", wellUrl],
  ["environment/marker/fire", firePitUrl],
  ["environment/construction/foundation", genericFoundationUrl],
  ["environment/construction/masonry", genericMasonryUrl],
  ["environment/overlay/building-damage", buildingDamageUrl],
  ["environment/zone/wheat-field", wheatFieldUrl],
  ["environment/prop/pasture", pastureUrl],
  ["environment/prop/timber-stack", timberStackUrl],
  ["environment/prop/village-utility", villageUtilityUrl],
  ["environment/prop/woodpile", woodpileUrl],
].map(([id, albedoUrl]) => ({
  id,
  albedoUrl,
  footprintScale: { x: 1, y: 1 },
}));

export const visualAssets = new Map(
  [...buildingDefinitions, ...environmentDefinitions].map((asset) => [asset.id, asset]),
);

function tierAssetId(
  manifest: BuildingAssetManifest,
  tier: Building["upgradeTier"],
  variant: string,
): string {
  const suffix = variant === "default" ? "" : `-${variant}`;
  return `building/${manifest.id}/tiers/${tier}${suffix}`;
}

buildingManifests.forEach((manifest) => {
  manifest.upgradeTiers.forEach((tier) => {
    manifest.variants.forEach((variant) => {
      const id = tierAssetId(manifest, tier, variant);
      if (!visualAssets.has(id)) {
        throw new Error(`Missing declared building asset "${id}".`);
      }
    });
  });

  if (manifest.palette && manifest.palette.category !== "buildings.housing") {
    (["foundation", "masonry"] as const).forEach((stage) => {
      const id = `building/${manifest.id}/construction/${stage}`;
      if (!visualAssets.has(id)) {
        throw new Error(
          `Functional building "${manifest.id}" requires construction asset "${id}".`,
        );
      }
    });
  }
});

export function getVisualAsset(id: string | undefined): VisualAssetDefinition | undefined {
  return id ? visualAssets.get(id) : undefined;
}

export function getBuildingAssetManifest(
  buildingTypeId: string | undefined,
): BuildingAssetManifest | undefined {
  return buildingTypeId ? buildingManifests.get(buildingTypeId) : undefined;
}

export function getBuildingOperationDefaults(
  buildingTypeId: string | undefined,
  tier: Building["upgradeTier"],
): Building["operation"] {
  const operation = getBuildingAssetManifest(buildingTypeId)?.gameplay.operation;
  if (!operation) return undefined;
  const override = tier === "base" ? undefined : operation.tierOverrides?.[tier];
  const profile = { ...operation, ...override };
  return {
    enabled: true,
    maxProduction: profile.maxProduction,
    outputs: profile.outputs.map((output) => ({ ...output, carry: 0 })),
    incomePerCycle: profile.incomePerCycle ?? 0,
    incomeCurrencyId: profile.incomeCurrencyId ?? "gp",
    workforce: {
      minWorkers: profile.minWorkers,
      maxWorkers: profile.maxWorkers,
      residentWorkers: 0,
      hiredWorkers: 0,
      wagePerCycle: 1,
      wageCurrencyId: "sp",
    },
  };
}

export function getBuildingPaletteTemplates(): BuildingPaletteTemplate[] {
  return [...buildingManifests.values()]
    .flatMap<BuildingPaletteTemplate>((manifest) => {
      if (!manifest.palette) return [];
      return [
        {
          ...manifest.palette,
          label: manifest.label,
          assetTypeId: manifest.id,
          visualVariant:
            manifest.variants[0] === "default" ? undefined : manifest.variants[0],
          upgradeTier: "base",
          housingCapacity: manifest.gameplay.housingCapacity,
          operation: getBuildingOperationDefaults(manifest.id, "base"),
          catalogVariants: manifest.variants.map((variant) => ({
            id: variant,
            thumbnailUrl: visualAssets.get(tierAssetId(manifest, "base", variant))!.albedoUrl,
          })),
        },
      ];
    })
    .sort((left, right) => left.order - right.order);
}

export function getBuildingVisualAssetId(building: Building): string | undefined {
  const manifest = getBuildingAssetManifest(building.assetTypeId);
  if (!manifest) return undefined;

  const tier = manifest.upgradeTiers.includes(building.upgradeTier)
    ? building.upgradeTier
    : "base";
  const requestedVariant = building.visualVariant ?? manifest.variants[0];
  const variant = manifest.variants.includes(requestedVariant)
    ? requestedVariant
    : manifest.variants[0];
  return tierAssetId(manifest, tier, variant);
}

export function getBuildingConstructionVisualAssetId(
  building: Building,
  stage: ConstructionStage,
): string | undefined {
  if (stage === "completion") {
    return getBuildingVisualAssetId({ ...building, upgradeTier: "base" });
  }
  const buildingSpecificId = building.assetTypeId
    ? `building/${building.assetTypeId}/construction/${stage}`
    : undefined;
  if (buildingSpecificId && visualAssets.has(buildingSpecificId)) {
    return buildingSpecificId;
  }
  return `environment/construction/${stage}`;
}

export function getBuildingDisplayStage(
  building: Building,
  projectStage?: ConstructionStage,
): ConstructionStage | undefined {
  if (building.status === "planned") return "foundation";
  if (building.status === "construction") return projectStage ?? "masonry";
  return undefined;
}

export function getBuildingDisplayVisualAssetId(
  building: Building,
  projectStage?: ConstructionStage,
): string | undefined {
  const constructionStage = getBuildingDisplayStage(building, projectStage);
  return constructionStage
    ? getBuildingConstructionVisualAssetId(building, constructionStage)
    : getBuildingVisualAssetId(building);
}
