import { describe, expect, it } from "vitest";
import { createDefaultDocument } from "../persistence/bundledDocuments";
import {
  advanceDocumentCycle,
  getPhaseCompletionForecast,
} from "./dailyCycle";

describe("resource cycle", () => {
  it("uses the slowest resource shortfall to forecast a phase", () => {
    const document = createDefaultDocument();
    const project = document.projects[0];
    const phase = document.buildPlans.find((plan) => plan.id === project.buildPlanId)!
      .phases[project.currentStage];
    phase.requirements = [
      { resourceId: "wood", amount: 20 },
      { resourceId: "stone", amount: 20 },
    ];
    phase.workersRequired = 4;
    project.workforce.residentWorkers = 4;
    project.resourcesReserved = false;
    document.resources.find((resource) => resource.id === "wood")!.total = 4;
    document.resources.find((resource) => resource.id === "wood")!.reserved = 0;
    document.resources.find((resource) => resource.id === "stone")!.total = 10;
    document.resources.find((resource) => resource.id === "stone")!.reserved = 0;
    const quarry = document.resourceSources.find((source) => source.resourceId === "stone")!;
    quarry.maxProduction = 5;
    quarry.transportCapacity = 5;
    quarry.workforce.maxWorkers = quarry.workforce.residentWorkers;

    expect(getPhaseCompletionForecast(document, project)).toEqual({
      cycles: 4,
      blockedResourceIds: [],
      workforceBlocked: false,
    });
  });

  it("produces resources daily and completes a phase when every need is met", () => {
    const document = createDefaultDocument();
    const project = document.projects[0];
    const phase = document.buildPlans.find((plan) => plan.id === project.buildPlanId)!
      .phases[project.currentStage];
    phase.requirements = [{ resourceId: "stone", amount: 20 }];
    phase.workersRequired = 2;
    project.workforce.residentWorkers = 2;
    project.resourcesReserved = false;
    document.resources.find((resource) => resource.id === "stone")!.total = 10;
    document.resources.find((resource) => resource.id === "stone")!.reserved = 0;
    const quarry = document.resourceSources.find((source) => source.resourceId === "stone")!;
    quarry.maxProduction = 5;
    quarry.transportCapacity = 5;
    quarry.workforce.maxWorkers = quarry.workforce.residentWorkers;

    advanceDocumentCycle(document);
    expect(document.campaignCycle).toBe(1);
    expect(project.currentStage).toBe("masonry");
    expect(document.resources.find((resource) => resource.id === "stone")!.total).toBe(15);

    advanceDocumentCycle(document);
    expect(document.campaignCycle).toBe(2);
    expect(project.currentStage).toBe("completion");
    expect(document.resources.find((resource) => resource.id === "stone")!.total).toBe(0);
  });

  it("marks a forecast as blocked without the required construction crew", () => {
    const document = createDefaultDocument();
    const project = document.projects[0];
    project.resourcesReserved = false;
    project.workforce.residentWorkers = 0;
    project.workforce.hiredWorkers = 0;

    expect(getPhaseCompletionForecast(document, project)).toMatchObject({
      cycles: null,
      blockedResourceIds: [],
      workforceBlocked: true,
    });
  });

  it("carries fractional multi-output production across cycles", () => {
    const document = createDefaultDocument();
    document.projects = [];
    const farmhouse = document.map.buildings.find(
      (building) => building.assetTypeId === "farmhouse",
    )!;
    farmhouse.operation!.workforce.residentWorkers = 6;
    farmhouse.operation!.outputs = [
      { resourceId: "grain", allocation: 0.75, carry: 0 },
      { resourceId: "hops", allocation: 0.25, carry: 0 },
    ];
    const grain = document.resources.find((resource) => resource.id === "grain")!;
    const hops = document.resources.find((resource) => resource.id === "hops")!;

    advanceDocumentCycle(document);
    expect({ grain: grain.total, hops: hops.total }).toEqual({ grain: 7, hops: 2 });
    expect(farmhouse.operation!.outputs.map((output) => output.carry)).toEqual([0.5, 0.5]);

    advanceDocumentCycle(document);
    expect({ grain: grain.total, hops: hops.total }).toEqual({ grain: 15, hops: 5 });
    expect(farmhouse.operation!.outputs.map((output) => output.carry)).toEqual([0, 0]);
  });
});
