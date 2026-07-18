import { describe, expect, it } from "vitest";
import { createDefaultDocument } from "../persistence/bundledDocuments";
import { migrateEditorDocument } from "./documentMigration";
import { editorDocumentSchema } from "./schema";

describe("editor document migration", () => {
  it.each([10, 11, 12, 13, 14, 15, 16])(
    "keeps the published schema-v%s migration path valid and immutable",
    (schemaVersion) => {
      const source = structuredClone(createDefaultDocument()) as any;
      source.schemaVersion = schemaVersion;
      const before = structuredClone(source);

      const migrated = editorDocumentSchema.parse(migrateEditorDocument(source));

      expect(migrated.schemaVersion).toBe(16);
      expect(source).toEqual(before);
    },
  );

  it("migrates schema-v11 building production to normalized outputs", () => {
    const legacy = structuredClone(createDefaultDocument()) as any;
    legacy.schemaVersion = 11;
    legacy.resources = legacy.resources.filter(
      (resource: { id: string }) => resource.id !== "grain" && resource.id !== "hops",
    );
    const farmhouse = legacy.map.buildings.find(
      (building: { assetTypeId?: string }) => building.assetTypeId === "farmhouse",
    );
    farmhouse.operation = {
      enabled: true,
      resourceId: "food",
      maxProduction: 10,
      workforce: farmhouse.operation.workforce,
    };

    const migrated = editorDocumentSchema.parse(migrateEditorDocument(legacy));
    expect(migrated.schemaVersion).toBe(16);
    expect(migrated.resources.map((resource) => resource.id)).toEqual(
      expect.arrayContaining(["grain", "hops"]),
    );
    expect(
      migrated.map.buildings.find((building) => building.assetTypeId === "farmhouse")
        ?.operation,
    ).toMatchObject({
      maxProduction: 10,
      outputs: [{ resourceId: "grain", allocation: 1, carry: 0 }],
    });
  });

  it("removes generic food and craft-good stocks from schema-v12 documents", () => {
    const legacy = structuredClone(createDefaultDocument()) as any;
    legacy.schemaVersion = 12;
    legacy.resources.push(
      { id: "food", name: "Nahrung", total: 12, reserved: 0, unit: "Einheiten", source: "", consumable: true },
      { id: "goods", name: "Handwerkswaren", total: 8, reserved: 0, unit: "Einheiten", source: "", consumable: true },
    );
    const forge = legacy.map.buildings.find(
      (building: { assetTypeId?: string }) => building.assetTypeId === "forge",
    );
    forge.operation.maxProduction = 6;
    forge.operation.outputs = [
      { resourceId: "goods", allocation: 1, carry: 0 },
    ];

    const migrated = editorDocumentSchema.parse(migrateEditorDocument(legacy));
    expect(migrated.resources.map((resource) => resource.id)).not.toEqual(
      expect.arrayContaining(["food", "goods"]),
    );
    expect(
      migrated.map.buildings.find((building) => building.assetTypeId === "forge")
        ?.operation,
    ).toMatchObject({ maxProduction: 0, outputs: [] });
  });

  it("migrates the generic schema-v13 ore mine to an iron ore source", () => {
    const legacy = structuredClone(createDefaultDocument()) as any;
    legacy.schemaVersion = 13;
    legacy.resources.push({
      id: "metal",
      name: "Metall",
      total: 5,
      reserved: 2,
      unit: "Einheiten",
      source: "Erzmine",
      consumable: true,
    });
    legacy.resourceSources.push({
      id: "old-ore-mine",
      name: "Erzmine",
      type: "oreMine",
      resourceId: "metal",
      enabled: true,
      maxProduction: 4,
      workforce: {
        minWorkers: 2,
        maxWorkers: 6,
        residentWorkers: 2,
        hiredWorkers: 0,
        dailyWage: 1,
      },
      travelTime: "45 Min.",
      transportCapacity: 4,
      notes: "",
    });

    const migrated = editorDocumentSchema.parse(migrateEditorDocument(legacy));

    expect(migrated.schemaVersion).toBe(16);
    expect(migrated.resources).toContainEqual(expect.objectContaining({
      id: "ironOre",
      name: "Eisenerz",
      total: 5,
      reserved: 2,
    }));
    expect(migrated.resources.some((resource) => resource.id === "metal")).toBe(false);
    expect(migrated.resourceSources).toContainEqual(expect.objectContaining({
      id: "old-ore-mine",
      name: "Eisenerzmine",
      type: "ironMine",
      resourceId: "ironOre",
    }));
  });

  it("restores the free village workers lost by schema-v14 documents", () => {
    const legacy = structuredClone(createDefaultDocument()) as any;
    legacy.schemaVersion = 14;
    legacy.population.workingResidents = 9;
    const farmhouse = legacy.map.buildings.find(
      (building: { assetTypeId?: string }) => building.assetTypeId === "farmhouse",
    );
    farmhouse.operation.workforce.residentWorkers = 0;

    const migrated = editorDocumentSchema.parse(migrateEditorDocument(legacy));

    expect(migrated.schemaVersion).toBe(16);
    expect(migrated.population.workingResidents).toBe(18);
  });

  it("migrates schema-v15 day, wages and treasury values to cycle base units", () => {
    const legacy = structuredClone(createDefaultDocument()) as any;
    legacy.schemaVersion = 15;
    legacy.campaignDay = 3;
    delete legacy.campaignCycle;
    legacy.treasury = {
      balance: 100,
      currency: "Silber",
      defaultDailyWage: 2,
      recruitmentCostPerResident: 5,
    };
    const workforces = [
      ...legacy.map.buildings.flatMap((building: any) =>
        building.operation ? [building.operation.workforce] : []),
      ...legacy.resourceSources.map((source: any) => source.workforce),
      ...legacy.projects.map((project: any) => project.workforce),
    ];
    for (const workforce of workforces) {
      workforce.dailyWage = workforce.wagePerCycle;
      delete workforce.wagePerCycle;
      delete workforce.wageCurrencyId;
    }
    for (const building of legacy.map.buildings) {
      if (!building.operation) continue;
      delete building.operation.incomePerCycle;
      delete building.operation.incomeCurrencyId;
    }

    const migrated = editorDocumentSchema.parse(migrateEditorDocument(legacy));
    const farmhouse = migrated.map.buildings.find(
      (building) => building.assetTypeId === "farmhouse",
    )!;

    expect(migrated).toMatchObject({
      schemaVersion: 16,
      campaignCycle: 3,
      treasury: {
        balanceBaseUnits: 1000,
        defaultWagePerCycle: 2,
        defaultWageCurrencyId: "sp",
        recruitmentCurrencyId: "sp",
        ledger: [],
      },
    });
    expect(farmhouse.operation).toMatchObject({
      incomePerCycle: 2,
      incomeCurrencyId: "gp",
    });
  });
});
