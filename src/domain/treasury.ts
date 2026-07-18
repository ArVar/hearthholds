import { toBaseCurrency } from "./currency";
import type { Building, EditorDocument, TreasuryLedgerEntry } from "./types";
import {
  getCyclePayroll,
  getWorkerCount,
  isBuildingOperational,
} from "./workforce";

export type TreasuryCycleBalance = {
  incomeBaseUnits: number;
  expenseBaseUnits: number;
  netBaseUnits: number;
  affordable: boolean;
};

export function getBuildingIncomeBaseUnits(
  document: EditorDocument,
  building: Building,
): number {
  const operation = building.operation;
  if (
    !operation
    || !operation.enabled
    || !isBuildingOperational(building)
    || getWorkerCount(operation.workforce) < operation.workforce.minWorkers
  ) return 0;
  return toBaseCurrency(
    document.ruleset,
    operation.incomePerCycle,
    operation.incomeCurrencyId,
  );
}

export function getCycleIncome(document: EditorDocument): number {
  return document.map.buildings.reduce(
    (total, building) => total + getBuildingIncomeBaseUnits(document, building),
    0,
  );
}

export function getTreasuryCycleBalance(
  document: EditorDocument,
): TreasuryCycleBalance {
  const incomeBaseUnits = getCycleIncome(document);
  const expenseBaseUnits = getCyclePayroll(document);
  return {
    incomeBaseUnits,
    expenseBaseUnits,
    netBaseUnits: incomeBaseUnits - expenseBaseUnits,
    affordable:
      document.treasury.balanceBaseUnits + incomeBaseUnits >= expenseBaseUnits,
  };
}

export function applyTreasuryCycle(document: EditorDocument): boolean {
  const balance = getTreasuryCycleBalance(document);
  if (!balance.affordable) return false;
  const cycle = document.campaignCycle + 1;
  const entries: TreasuryLedgerEntry[] = document.map.buildings.flatMap((building) => {
    const amountBaseUnits = getBuildingIncomeBaseUnits(document, building);
    return amountBaseUnits > 0
      ? [{
          id: `${cycle}-${building.id}-income`,
          cycle,
          type: "income" as const,
          sourceId: building.id,
          label: building.name,
          amountBaseUnits,
        }]
      : [];
  });
  if (balance.expenseBaseUnits > 0) {
    entries.push({
      id: `${cycle}-payroll-expense`,
      cycle,
      type: "expense",
      sourceId: "payroll",
      label: "Payroll",
      amountBaseUnits: balance.expenseBaseUnits,
    });
  }
  document.treasury.balanceBaseUnits += balance.netBaseUnits;
  document.treasury.ledger.push(...entries);
  return true;
}
