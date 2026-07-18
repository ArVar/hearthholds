import { describe, expect, it } from "vitest";
import { createDefaultDocument } from "../persistence/bundledDocuments";
import { advanceDocumentCycle } from "./dailyCycle";
import {
  canRecruitResidents,
  getBuildingProduction,
  getBuildingProductionBreakdown,
  getWorkforceProduction,
  getWorkforceSummary,
  getWorkplaceStatus,
  setProductionOutputAllocation,
} from "./workforce";

describe("settlement workforce", () => {
  it("combines residents, housing, assignments and hired labor", () => {
    const document = createDefaultDocument();
    const source = document.resourceSources[0];
    source.workforce.hiredWorkers = 1;
    source.workforce.wagePerCycle = 2;

    expect(getWorkforceSummary(document)).toMatchObject({
      residents: 30,
      workingResidents: 20,
      assignedResidents: 18,
      freeResidents: 2,
      hiredWorkers: 1,
      housingCapacity: 48,
      freeHousing: 18,
      cyclePayrollBaseUnits: 200,
      payrollAffordable: true,
    });
  });

  it("gates production at minimum staffing and scales to the maximum", () => {
    const document = createDefaultDocument();
    const farmhouse = document.map.buildings.find(
      (building) => building.assetTypeId === "farmhouse",
    )!;
    const operation = farmhouse.operation!;
    operation.workforce.residentWorkers = 0;
    operation.workforce.hiredWorkers = 0;

    expect(getWorkplaceStatus(true, operation.workforce)).toBe("understaffed");
    expect(getBuildingProduction(farmhouse)).toBe(0);

    operation.workforce.residentWorkers = 3;
    expect(getWorkplaceStatus(true, operation.workforce)).toBe("limited");
    expect(getBuildingProduction(farmhouse)).toBe(5);

    operation.workforce.residentWorkers = 6;
    expect(getWorkforceProduction(true, 10, operation.workforce)).toBe(10);
    expect(getWorkplaceStatus(true, operation.workforce)).toBe("full");
  });

  it("requires housing and treasury funds when recruiting residents", () => {
    const document = createDefaultDocument();

    expect(canRecruitResidents(document, 2, 1)).toBe(true);
    document.treasury.balanceBaseUnits = 0;
    expect(canRecruitResidents(document, 2, 1)).toBe(false);
  });

  it("keeps configurable multi-output shares normalized", () => {
    const outputs = setProductionOutputAllocation([
      { resourceId: "grain", allocation: 0.75, carry: 0 },
      { resourceId: "hops", allocation: 0.25, carry: 0 },
    ], 0, 0.6);

    expect(outputs.map((output) => output.allocation)).toEqual([0.6, 0.4]);
    const document = createDefaultDocument();
    const farmhouse = document.map.buildings.find(
      (building) => building.assetTypeId === "farmhouse",
    )!;
    farmhouse.operation!.outputs = outputs;
    farmhouse.operation!.workforce.residentWorkers = 6;
    expect(getBuildingProductionBreakdown(farmhouse)).toEqual([
      { resourceId: "grain", amount: 6 },
      { resourceId: "hops", amount: 4 },
    ]);
  });

  it("blocks the day change when hired-worker wages cannot be paid", () => {
    const document = createDefaultDocument();
    const source = document.resourceSources[0];
    source.workforce.hiredWorkers = 2;
    source.workforce.wagePerCycle = 10;
    document.treasury.balanceBaseUnits = 5;

    expect(advanceDocumentCycle(document)).toBe(false);
    expect(document.campaignCycle).toBe(0);
    expect(document.treasury.balanceBaseUnits).toBe(5);
  });
});
