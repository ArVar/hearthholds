import { describe, expect, it } from "vitest";
import { createDefaultDocument } from "../persistence/bundledDocuments";
import {
  getEffectiveProduction,
  getResourceFlowBreakdown,
  isResourceVisibleInHud,
  resourceSourceCatalog,
} from "./resourceSources";

describe("resource sources", () => {
  it("caps daily production by transport and respects inactive sources", () => {
    const source = createDefaultDocument().resourceSources[0];

    expect(getEffectiveProduction({
      ...source,
      maxProduction: 12,
      transportCapacity: 8,
      workforce: { ...source.workforce, maxWorkers: source.workforce.residentWorkers },
    })).toBe(8);
    expect(getEffectiveProduction({ ...source, enabled: false })).toBe(0);
    expect(getEffectiveProduction({
      ...source,
      workforce: { ...source.workforce, residentWorkers: 0 },
    })).toBe(0);
  });

  it("breaks production and phase consumption down by source and project", () => {
    const document = createDefaultDocument();
    const wood = getResourceFlowBreakdown(document, "wood");

    expect(wood.production).toEqual([
      expect.objectContaining({ label: "Umliegender Wald", amount: 4 }),
    ]);
    expect(wood.productionTotal).toBe(4);
    expect(wood.consumption).toEqual([
      expect.objectContaining({ label: "Dorfschmiede errichten", amount: 4 }),
    ]);
    expect(wood.consumptionTotal).toBe(4);
  });

  it("scales production between minimum and maximum staffing", () => {
    const document = createDefaultDocument();
    const source = document.resourceSources[0];
    source.workforce = {
      ...source.workforce,
      minWorkers: 2,
      maxWorkers: 4,
      residentWorkers: 3,
    };
    source.maxProduction = 8;
    source.transportCapacity = 8;

    expect(getEffectiveProduction(source)).toBe(6);
  });

  it("hides empty resources without a current production source from the HUD", () => {
    const document = createDefaultDocument();

    expect(isResourceVisibleInHud(document, "grain")).toBe(true);
    expect(isResourceVisibleInHud(document, "hops")).toBe(false);

    const farmhouse = document.map.buildings.find(
      (building) => building.assetTypeId === "farmhouse",
    )!;
    farmhouse.operation!.enabled = false;
    expect(isResourceVisibleInHud(document, "grain")).toBe(false);

    document.resources.find((resource) => resource.id === "hops")!.total = 1;
    expect(isResourceVisibleInHud(document, "hops")).toBe(true);
  });

  it("offers distinct external sources for each supported ore", () => {
    expect(resourceSourceCatalog).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "ironMine",
        resource: expect.objectContaining({ id: "ironOre" }),
      }),
      expect.objectContaining({
        type: "copperMine",
        resource: expect.objectContaining({ id: "copperOre" }),
      }),
      expect.objectContaining({
        type: "goldMine",
        resource: expect.objectContaining({ id: "goldOre" }),
      }),
    ]));
  });
});
