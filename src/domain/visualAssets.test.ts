import { describe, expect, it } from "vitest";
import { createDefaultDocument } from "../persistence/bundledDocuments";
import {
  getBuildingAssetManifest,
  getBuildingConstructionVisualAssetId,
  getBuildingDisplayStage,
  getBuildingDisplayVisualAssetId,
  getBuildingPaletteTemplates,
  getBuildingVisualAssetId,
  getVisualAsset,
} from "./visualAssets";

describe("building visual assets", () => {
  it("discovers building images from their manifests and folders", () => {
    expect(getVisualAsset("building/cottage/tiers/base-01")?.footprintScale).toEqual({
      x: 1.18,
      y: 1.18,
    });
    expect(getVisualAsset("building/forge/construction/foundation")).toBeDefined();
    expect(getVisualAsset("environment/marker/well")).toBeDefined();
    expect(getVisualAsset("environment/marker/fire")).toBeDefined();
    expect(getVisualAsset("environment/overlay/building-damage")).toBeDefined();
    expect(getBuildingAssetManifest("forge")?.upgradeTiers).toEqual([
      "base",
      "extended",
      "master",
    ]);
  });

  it("resolves residential variants without storing file paths in documents", () => {
    const cottages = createDefaultDocument().map.buildings.filter(
      (building) => building.assetTypeId === "cottage",
    );

    expect(cottages.map(getBuildingVisualAssetId)).toEqual([
      "building/cottage/tiers/base-01",
      "building/cottage/tiers/base-02",
      "building/cottage/tiers/base-03",
    ]);
  });

  it("resolves construction and completed upgrade art from building state", () => {
    const forge = createDefaultDocument().map.buildings.find(
      (building) => building.id === "forge",
    )!;

    expect(getBuildingConstructionVisualAssetId(forge, "masonry")).toBe(
      "building/forge/construction/masonry",
    );
    expect(getBuildingVisualAssetId({ ...forge, upgradeTier: "master" })).toBe(
      "building/forge/tiers/master",
    );
    const cottage = createDefaultDocument().map.buildings.find(
      (building) => building.assetTypeId === "cottage",
    )!;
    expect(getBuildingConstructionVisualAssetId(cottage, "foundation")).toBe(
      "environment/construction/foundation",
    );
    expect(getBuildingConstructionVisualAssetId(cottage, "masonry")).toBe(
      "environment/construction/masonry",
    );
    expect(getVisualAsset("building/carpentry/tiers/extended")).toBeDefined();
    expect(getVisualAsset("building/hunting-lodge/tiers/master")).toBeDefined();
  });

  it("prioritizes build status and then the selected upgrade tier", () => {
    const forge = createDefaultDocument().map.buildings.find(
      (building) => building.id === "forge",
    )!;
    const masterForge = { ...forge, upgradeTier: "master" as const };

    expect(
      getBuildingDisplayVisualAssetId(
        { ...masterForge, status: "planned" },
        "masonry",
      ),
    ).toBe("building/forge/construction/foundation");
    expect(
      getBuildingDisplayVisualAssetId(
        { ...masterForge, status: "construction" },
        "masonry",
      ),
    ).toBe("building/forge/construction/masonry");
    expect(
      getBuildingDisplayVisualAssetId({ ...masterForge, status: "complete" }, "masonry"),
    ).toBe("building/forge/tiers/master");
    expect(
      getBuildingDisplayVisualAssetId({ ...masterForge, status: "existing" }, "masonry"),
    ).toBe("building/forge/tiers/master");
    expect(getBuildingDisplayStage({ ...masterForge, status: "construction" })).toBe(
      "masonry",
    );
  });

  it("builds a validated, ordered palette from asset manifests", () => {
    expect(
      getBuildingPaletteTemplates().map(({ label, icon, assetTypeId }) => ({
        label,
        icon,
        assetTypeId,
      })),
    ).toEqual([
      {
        label: { de: "Wohnhaus", en: "Cottage" },
        icon: "home",
        assetTypeId: "cottage",
      },
      {
        label: { de: "Anwesen", en: "Manor" },
        icon: "home",
        assetTypeId: "manor",
      },
      {
        label: { de: "Schreinerei", en: "Carpentry" },
        icon: "hammer",
        assetTypeId: "carpentry",
      },
      {
        label: { de: "Schmiede", en: "Forge" },
        icon: "hammer",
        assetTypeId: "forge",
      },
      {
        label: { de: "Wachturm", en: "Watchtower" },
        icon: "castle",
        assetTypeId: "watchtower",
      },
      {
        label: { de: "Bauernhof", en: "Farmhouse" },
        icon: "sprout",
        assetTypeId: "farmhouse",
      },
      {
        label: { de: "Vorratshaus", en: "Storehouse" },
        icon: "sprout",
        assetTypeId: "storehouse",
      },
      {
        label: { de: "Jägerhof", en: "Hunting lodge" },
        icon: "sprout",
        assetTypeId: "hunting-lodge",
      },
      {
        label: { de: "Gemeinschaftshaus", en: "Community hall" },
        icon: "home",
        assetTypeId: "community-hall",
      },
    ]);
    expect(getBuildingPaletteTemplates().every((template) => template.catalogVariants[0].thumbnailUrl)).toBe(true);
  });

  it("provides building-specific construction art for every functional building", () => {
    const functionalBuildings = getBuildingPaletteTemplates().filter(
      (template) => template.category !== "buildings.housing",
    );

    expect(functionalBuildings.map((template) => template.assetTypeId)).toEqual([
      "carpentry",
      "forge",
      "watchtower",
      "farmhouse",
      "storehouse",
      "hunting-lodge",
      "community-hall",
    ]);
    functionalBuildings.forEach((template) => {
      expect(
        getVisualAsset(`building/${template.assetTypeId}/construction/foundation`),
      ).toBeDefined();
      expect(
        getVisualAsset(`building/${template.assetTypeId}/construction/masonry`),
      ).toBeDefined();
    });
  });
});
