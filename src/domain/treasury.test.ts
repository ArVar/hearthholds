import { describe, expect, it } from "vitest";
import { createDefaultDocument } from "../persistence/bundledDocuments";
import { advanceDocumentCycle } from "./dailyCycle";
import { getTreasuryCycleBalance } from "./treasury";

describe("treasury cycle", () => {
  it("books configurable staffed building income into the treasury", () => {
    const document = createDefaultDocument();
    const initialBalance = document.treasury.balanceBaseUnits;
    document.projects = [];
    document.resourceSources = [];
    const farmhouse = document.map.buildings.find(
      (building) => building.assetTypeId === "farmhouse",
    )!;
    farmhouse.operation!.workforce.residentWorkers = 2;

    expect(farmhouse.operation).toMatchObject({
      incomePerCycle: 2,
      incomeCurrencyId: "gp",
    });
    expect(getTreasuryCycleBalance(document)).toMatchObject({
      incomeBaseUnits: 200,
      expenseBaseUnits: 0,
      netBaseUnits: 200,
      affordable: true,
    });

    expect(advanceDocumentCycle(document)).toBe(true);
    expect(document.treasury.balanceBaseUnits).toBe(initialBalance + 200);
    expect(document.treasury.ledger).toContainEqual(expect.objectContaining({
      cycle: 1,
      type: "income",
      sourceId: farmhouse.id,
      amountBaseUnits: 200,
    }));
  });

  it("allows income from the same cycle to cover payroll", () => {
    const document = createDefaultDocument();
    document.projects = [];
    document.resourceSources = [];
    document.treasury.balanceBaseUnits = 0;
    const farmhouse = document.map.buildings.find(
      (building) => building.assetTypeId === "farmhouse",
    )!;
    farmhouse.operation!.workforce.residentWorkers = 1;
    farmhouse.operation!.workforce.hiredWorkers = 1;
    farmhouse.operation!.workforce.wagePerCycle = 15;
    farmhouse.operation!.workforce.wageCurrencyId = "sp";

    expect(getTreasuryCycleBalance(document)).toMatchObject({
      incomeBaseUnits: 200,
      expenseBaseUnits: 150,
      netBaseUnits: 50,
      affordable: true,
    });
    expect(advanceDocumentCycle(document)).toBe(true);
    expect(document.treasury.balanceBaseUnits).toBe(50);
    expect(document.treasury.ledger.map(({ type }) => type)).toEqual(["income", "expense"]);
  });
});
