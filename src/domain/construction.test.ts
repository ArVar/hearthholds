import { describe, expect, it } from "vitest";
import { createDefaultDocument } from "../persistence/bundledDocuments";
import {
  canReserveCurrentPhase,
  createConstructionProject,
  formatRequirementSummary,
  getBuildPlan,
  getBuildPlanForBuilding,
  getCurrentPhase,
  getPhaseResourceStates,
} from "./construction";

describe("construction planning", () => {
  it("derives the current forge phase and its secured resource demand", () => {
    const document = createDefaultDocument();
    const project = document.projects[0];
    const plan = getBuildPlan(document, project);
    const phase = getCurrentPhase(document, project);

    expect(Object.keys(plan!.phases)).toEqual(["foundation", "masonry", "completion"]);
    expect(phase?.name).toBe("Mauerwerk");
    expect(formatRequirementSummary(document, phase!)).toBe(
      "4 Holz · 12 Stein · 4 Arbeitskräfte",
    );
    expect(getPhaseResourceStates(document, project).every((state) => state.secured))
      .toBe(true);
    expect(canReserveCurrentPhase(document, project)).toBe(false);
  });

  it("detects an uncovered unreserved phase", () => {
    const document = createDefaultDocument();
    const project = document.projects[0];
    project.currentStage = "completion";
    project.resourcesReserved = false;
    project.fulfilledPrerequisiteIds = ["smith-available"];
    document.resources.find((resource) => resource.id === "wood")!.reserved = 30;

    const wood = getPhaseResourceStates(document, project).find(
      (state) => state.resource.id === "wood",
    );

    expect(wood?.available).toBe(4);
    expect(wood?.sufficient).toBe(false);
    expect(canReserveCurrentPhase(document, project)).toBe(false);
  });

  it("selects a specific plan before falling back to the standard plan", () => {
    const document = createDefaultDocument();
    const forge = document.map.buildings.find((building) => building.id === "forge")!;
    const cottage = document.map.buildings.find(
      (building) => building.assetTypeId === "cottage",
    )!;

    expect(getBuildPlanForBuilding(document, forge).id).toBe("simple-forge");
    expect(getBuildPlanForBuilding(document, cottage).id).toBe("standard-building");
    expect(createConstructionProject(document, cottage)).toMatchObject({
      buildingId: cottage.id,
      buildPlanId: "standard-building",
      status: "planned",
      currentStage: "foundation",
      phaseProgress: 0,
    });
  });

  it("provides the standard fallback even for documents that do not store it yet", () => {
    const document = createDefaultDocument();
    document.buildPlans = document.buildPlans.filter(
      (plan) => plan.id !== "standard-building",
    );
    const cottage = document.map.buildings.find(
      (building) => building.assetTypeId === "cottage",
    )!;

    expect(getBuildPlanForBuilding(document, cottage).id).toBe("standard-building");
  });
});
