import { describe, expect, it } from "vitest";
import herzdorfJson from "../data/maps/herzdorf.json";
import {
  createBundledDocument,
  createDefaultDocument,
  defaultDocumentId,
  parseBundledDocument,
} from "./bundledDocuments";

describe("bundled documents", () => {
  it("loads the reference map from a schema-valid JSON document", () => {
    const document = createDefaultDocument();

    expect(document.id).toBe("herzdorf");
    expect(document.map.buildings).toHaveLength(11);
    expect(document.map.paths.find((path) => path.id === "river")).toBeDefined();
    expect(document.map.grid).toEqual({
      size: 20,
      distance: 1.5,
      unit: "m",
      majorEvery: 5,
      opacity: 0.2,
    });
    expect(document.map.terrainStrokes).toHaveLength(4);
    expect(document.map.referenceAssetId).toBeUndefined();
    expect(document.map.markers.find((marker) => marker.id === "village-well")).toMatchObject({
      width: 88,
      height: 66,
    });
    expect(document.map.zones.find((zone) => zone.id === "west-forest")).toMatchObject({
      density: 1,
    });
    expect(defaultDocumentId).toBe("herzdorf");
    expect(createBundledDocument("herzdorf").settlementName).toBe("Herzdorf");
  });

  it("loads the bundled schema-v16 map with its workforce model", () => {
    const document = createDefaultDocument();

    expect(herzdorfJson.schemaVersion).toBe(16);
    expect(document.schemaVersion).toBe(16);
    expect(document.resources.some((resource) => resource.id === "labor")).toBe(false);
    expect(document.resources.map((resource) => resource.id)).toEqual(
      expect.arrayContaining(["wood", "stone", "grain", "hops"]),
    );
    expect(document.resources.map((resource) => resource.id)).not.toEqual(
      expect.arrayContaining(["food", "goods"]),
    );
    expect(document.population.workingResidents).toBe(20);
    expect(document.treasury).toEqual({
      balanceBaseUnits: 10000,
      displayCurrencyId: "gp",
      defaultWagePerCycle: 0.1,
      defaultWageCurrencyId: "gp",
      recruitmentCostPerResident: 5,
      recruitmentCurrencyId: "gp",
      ledger: [],
    });
    expect(document.resourceSources[0].workforce).toMatchObject({
      minWorkers: 1,
      maxWorkers: 4,
      residentWorkers: 2,
      hiredWorkers: 0,
    });
    expect(document.map.buildings.find((building) => building.assetTypeId === "forge"))
      .toMatchObject({
        housingCapacity: 4,
        operation: {
          maxProduction: 0,
          outputs: [],
        },
      });
  });

  it("returns independent document instances", () => {
    const first = createDefaultDocument();
    first.map.buildings[0].x = -1;

    expect(createDefaultDocument().map.buildings[0].x).not.toBe(-1);
  });

  it("validates bundled maps with the editor document schema", () => {
    expect(() =>
      parseBundledDocument({ ...herzdorfJson, schemaVersion: 99 }),
    ).toThrow();
  });
});
