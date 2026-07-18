import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultDocument } from "../persistence/bundledDocuments";
import { getOrderedLayerObjects } from "../domain/scene";
import { getWorkforceSummary } from "../domain/workforce";
import { useEditorStore } from "./editorStore";

describe("editor history", () => {
  beforeEach(() => {
    useEditorStore.setState({
      document: createDefaultDocument(),
      past: [],
      future: [],
      selectedId: "forge",
      selectedIds: ["forge"],
      selectedPathAnchorIndex: null,
      dirty: false,
    });
  });

  it("rotates the selected building in 15 degree steps", () => {
    const initialRotation = useEditorStore.getState().document.map.buildings.find(
      (building) => building.id === "forge",
    )!.rotation;
    useEditorStore.getState().rotateSelected(15);
    const forge = useEditorStore
      .getState()
      .document.map.buildings.find((building) => building.id === "forge");

    expect(forge?.rotation).toBe((initialRotation + 15) % 360);
    expect(useEditorStore.getState().past).toHaveLength(1);
    expect(useEditorStore.getState().dirty).toBe(true);
  });

  it("applies tier-specific farmhouse production defaults", () => {
    const farmhouse = useEditorStore.getState().document.map.buildings.find(
      (building) => building.assetTypeId === "farmhouse",
    )!;

    useEditorStore.getState().updateBuilding(farmhouse.id, { upgradeTier: "extended" });
    expect(
      useEditorStore.getState().document.map.buildings.find(
        (building) => building.id === farmhouse.id,
      ),
    ).toMatchObject({
      upgradeTier: "extended",
      operation: {
        maxProduction: 16,
        workforce: { minWorkers: 2, maxWorkers: 9 },
        outputs: [
          { resourceId: "grain", allocation: 0.75, carry: 0 },
          { resourceId: "hops", allocation: 0.25, carry: 0 },
        ],
      },
    });
  });

  it("assigns the free resident workforce to the farmhouse", () => {
    const farmhouse = useEditorStore.getState().document.map.buildings.find(
      (building) => building.assetTypeId === "farmhouse",
    )!;

    useEditorStore.getState().updateBuilding(farmhouse.id, {
      operation: {
        ...farmhouse.operation!,
        workforce: {
          ...farmhouse.operation!.workforce,
          residentWorkers: 2,
        },
      },
    });

    expect(
      useEditorStore.getState().document.map.buildings.find(
        (building) => building.id === farmhouse.id,
      )?.operation?.workforce.residentWorkers,
    ).toBe(2);
  });

  it("undoes and redoes a committed map action", () => {
    const initialX = useEditorStore.getState().document.map.buildings.find(
      (item) => item.id === "forge",
    )!.x;
    useEditorStore.getState().updateBuilding("forge", { x: 700, y: 600 });
    expect(
      useEditorStore.getState().document.map.buildings.find((item) => item.id === "forge")
        ?.x,
    ).toBe(700);

    useEditorStore.getState().undo();
    expect(
      useEditorStore.getState().document.map.buildings.find((item) => item.id === "forge")
        ?.x,
    ).toBe(initialX);

    useEditorStore.getState().redo();
    expect(
      useEditorStore.getState().document.map.buildings.find((item) => item.id === "forge")
        ?.x,
    ).toBe(700);
  });

  it("edits path control points and supports undo", () => {
    const original = useEditorStore.getState().document.map.paths.find(
      (path) => path.id === "main-road",
    );
    const points = [...(original?.points ?? [])];
    points[0] = 1_300;

    useEditorStore.getState().updatePath("main-road", { points, width: 24 });
    expect(
      useEditorStore.getState().document.map.paths.find((path) => path.id === "main-road"),
    ).toMatchObject({ points, width: 24 });

    useEditorStore.getState().undo();
    expect(
      useEditorStore.getState().document.map.paths.find((path) => path.id === "main-road"),
    ).toMatchObject({ points: original?.points, width: original?.width });
  });

  it("moves map assets through undoable editor actions", () => {
    const initialDecorationPosition = structuredClone(
      useEditorStore.getState().document.map.decorations.find(
        (item) => item.id === "pasture-supplies",
      )!.position,
    );
    useEditorStore.getState().updateMarker("village-well", {
      position: { x: 520, y: 320 },
    });
    useEditorStore.getState().updateZone("wheat-field", { x: 140, y: 620 });
    useEditorStore.getState().updateDecoration("pasture-supplies", {
      position: { x: 1_040, y: 280 },
    });

    const moved = useEditorStore.getState().document.map;
    expect(moved.markers.find((item) => item.id === "village-well")?.position).toEqual({
      x: 520,
      y: 320,
    });
    expect(moved.zones.find((item) => item.id === "wheat-field")).toMatchObject({
      x: 140,
      y: 620,
    });
    expect(
      moved.decorations.find((item) => item.id === "pasture-supplies")?.position,
    ).toEqual({ x: 1_040, y: 280 });

    useEditorStore.getState().undo();
    expect(
      useEditorStore
        .getState()
        .document.map.decorations.find((item) => item.id === "pasture-supplies")
        ?.position,
    ).toEqual(initialDecorationPosition);
  });

  it("rotates selectable zones and decorations", () => {
    useEditorStore.getState().select("wheat-field");
    useEditorStore.getState().rotateSelected(15);
    expect(
      useEditorStore.getState().document.map.zones.find((item) => item.id === "wheat-field")
        ?.rotation,
    ).toBe(30);

    useEditorStore.getState().select("pasture-supplies");
    useEditorStore.getState().rotateSelected(15);
    expect(
      useEditorStore
        .getState()
        .document.map.decorations.find((item) => item.id === "pasture-supplies")
        ?.rotation,
    ).toBe(15);
  });

  it("edits forest dimensions and density through undoable actions", () => {
    const initialForest = structuredClone(
      useEditorStore.getState().document.map.zones.find(
        (zone) => zone.id === "west-forest",
      )!,
    );
    useEditorStore.getState().updateZone("west-forest", { width: 180, density: 0.75 });

    expect(
      useEditorStore.getState().document.map.zones.find((zone) => zone.id === "west-forest"),
    ).toMatchObject({ width: 180, height: initialForest.height, density: 0.75 });

    useEditorStore.getState().undo();
    expect(
      useEditorStore.getState().document.map.zones.find((zone) => zone.id === "west-forest"),
    ).toMatchObject(initialForest);
  });

  it("clamps forest density to the supported ten-to-one-hundred-percent range", () => {
    useEditorStore.getState().updateZone("west-forest", { density: 2 });
    expect(
      useEditorStore.getState().document.map.zones.find((zone) => zone.id === "west-forest")
        ?.density,
    ).toBe(1);

    useEditorStore.getState().updateZone("west-forest", { density: 0 });
    expect(
      useEditorStore.getState().document.map.zones.find((zone) => zone.id === "west-forest")
        ?.density,
    ).toBe(0.1);
  });

  it("nudges selected objects by a map delta", () => {
    const initialForge = structuredClone(
      useEditorStore.getState().document.map.buildings.find(
        (building) => building.id === "forge",
      )!,
    );
    useEditorStore.getState().nudgeSelected({ x: 20, y: -20 });
    expect(
      useEditorStore.getState().document.map.buildings.find((building) => building.id === "forge"),
    ).toMatchObject({ x: initialForge.x + 20, y: initialForge.y - 20 });

    useEditorStore.getState().select("main-road");
    const before = useEditorStore.getState().document.map.paths.find(
      (path) => path.id === "main-road",
    )?.points;
    useEditorStore.getState().nudgeSelected({ x: -20, y: 20 });
    const after = useEditorStore.getState().document.map.paths.find(
      (path) => path.id === "main-road",
    )?.points;
    expect(after?.[0]).toBe((before?.[0] ?? 0) - 20);
    expect(after?.[1]).toBe((before?.[1] ?? 0) + 20);
  });

  it("selects, groups and moves multiple objects in one history action", () => {
    const initialForge = structuredClone(
      useEditorStore.getState().document.map.buildings.find(
        (building) => building.id === "forge",
      )!,
    );
    const initialWell = structuredClone(
      useEditorStore.getState().document.map.markers.find(
        (marker) => marker.id === "village-well",
      )!,
    );
    useEditorStore.getState().select("forge");
    useEditorStore.getState().select("village-well", "add");
    expect(useEditorStore.getState().selectedIds).toEqual(["forge", "village-well"]);

    useEditorStore.getState().groupSelected("Werkstattgruppe");
    expect(useEditorStore.getState().document.map.scene.groups).toEqual([
      expect.objectContaining({
        name: "Werkstattgruppe",
        objectIds: ["forge", "village-well"],
      }),
    ]);

    const historyBeforeMove = useEditorStore.getState().past.length;
    useEditorStore.getState().nudgeSelected({ x: 20, y: 20 });
    const map = useEditorStore.getState().document.map;
    expect(map.buildings.find((building) => building.id === "forge")).toMatchObject({
      x: initialForge.x + 20,
      y: initialForge.y + 20,
    });
    expect(map.markers.find((marker) => marker.id === "village-well")?.position).toEqual({
      x: initialWell.position.x + 20,
      y: initialWell.position.y + 20,
    });
    expect(useEditorStore.getState().past).toHaveLength(historyBeforeMove + 1);
  });

  it("scales and rotates a mixed selection in one history action", () => {
    const initialForge = structuredClone(
      useEditorStore.getState().document.map.buildings.find(
        (building) => building.id === "forge",
      )!,
    );
    const initialWell = structuredClone(
      useEditorStore.getState().document.map.markers.find(
        (marker) => marker.id === "village-well",
      )!,
    );
    useEditorStore.getState().selectMany(["forge", "village-well"]);
    const historyBeforeTransform = useEditorStore.getState().past.length;

    useEditorStore.getState().transformSelected({
      origin: { x: 0, y: 0 },
      center: { x: 10, y: 20 },
      scale: 2,
      rotation: 15,
    });

    const map = useEditorStore.getState().document.map;
    expect(map.buildings.find((building) => building.id === "forge")).toMatchObject({
      width: initialForge.width * 2,
      height: initialForge.height * 2,
      rotation: (initialForge.rotation + 15) % 360,
    });
    expect(map.markers.find((marker) => marker.id === "village-well")).toMatchObject({
      width: initialWell.width * 2,
      height: initialWell.height * 2,
    });
    expect(useEditorStore.getState().past).toHaveLength(historyBeforeTransform + 1);
  });

  it("persists front-to-back object ordering in one history action", () => {
    useEditorStore.getState().reorderObject("carpentry", "forge");

    const document = useEditorStore.getState().document;
    const buildings = getOrderedLayerObjects(document, "buildings");
    expect(buildings.findIndex((object) => object.id === "carpentry"))
      .toBeLessThan(buildings.findIndex((object) => object.id === "forge"));
    expect(document.map.scene.objectOrder).toContain("carpentry");
    expect(useEditorStore.getState().past).toHaveLength(1);
  });

  it("persists object and layer locks and blocks modifications", () => {
    const initialForgeX = useEditorStore.getState().document.map.buildings.find(
      (building) => building.id === "forge",
    )!.x;
    const initialWellPosition = structuredClone(
      useEditorStore.getState().document.map.markers.find(
        (marker) => marker.id === "village-well",
      )!.position,
    );
    useEditorStore.getState().setObjectLocked("forge", true);
    useEditorStore.getState().updateBuilding("forge", { x: 100 });
    expect(
      useEditorStore.getState().document.map.buildings.find((building) => building.id === "forge")?.x,
    ).toBe(initialForgeX);

    useEditorStore.getState().setLayerLocked("markers", true);
    useEditorStore.getState().updateMarker("village-well", {
      position: { x: 100, y: 100 },
    });
    expect(
      useEditorStore.getState().document.map.markers.find((marker) => marker.id === "village-well")?.position,
    ).toEqual(initialWellPosition);
  });

  it("adds one undoable terrain stroke", () => {
    const initialTerrainStrokes = structuredClone(
      useEditorStore.getState().document.map.terrainStrokes,
    );
    useEditorStore.getState().addTerrainStroke({
      id: "terrain-test",
      type: "dirt",
      points: [100, 100, 140, 120],
      width: 80,
    });
    expect(useEditorStore.getState().document.map.terrainStrokes).toEqual([
      ...initialTerrainStrokes,
      expect.objectContaining({ id: "terrain-test", type: "dirt", width: 80 }),
    ]);
    expect(useEditorStore.getState().past).toHaveLength(1);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.map.terrainStrokes).toEqual(
      initialTerrainStrokes,
    );
  });

  it("updates the metric grid model and supports undo", () => {
    const initialGrid = structuredClone(useEditorStore.getState().document.map.grid);
    useEditorStore.getState().updateMapGrid({
      size: 25,
      distance: 5,
      majorEvery: 10,
      color: "#e0b24b",
      opacity: 0.75,
    });

    expect(useEditorStore.getState().document.map.grid).toEqual({
      size: 25,
      distance: 5,
      unit: "m",
      majorEvery: 10,
      color: "#e0b24b",
      opacity: 0.75,
    });

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.map.grid).toEqual(initialGrid);
  });

  it("updates the map size and supports undo", () => {
    const initialSize = {
      width: useEditorStore.getState().document.map.width,
      height: useEditorStore.getState().document.map.height,
    };
    useEditorStore.getState().updateMapSize({ width: 1_200, height: 600 });

    expect(useEditorStore.getState().document.map).toMatchObject({
      width: 1_200,
      height: 600,
    });

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.map).toMatchObject(initialSize);
  });

  it("adds selectable wall infrastructure", () => {
    useEditorStore.getState().addPalisade({
      id: "new-wall",
      name: "Neue Mauer",
      status: "planned",
      center: { x: 400, y: 300 },
      rotation: 0,
      thickness: 16,
      style: "wall",
      segments: [{ kind: "line", from: { x: -50, y: 0 }, to: { x: 50, y: 0 } }],
      gates: [],
      notes: "",
    });

    expect(useEditorStore.getState().selectedId).toBe("new-wall");
    expect(useEditorStore.getState().getSelectedObject()).toMatchObject({
      kind: "palisade",
      value: { id: "new-wall", style: "wall" },
    });
  });

  it("adds catalog objects through one undoable action", () => {
    const initialMarkerCount = useEditorStore.getState().document.map.markers.length;
    useEditorStore.getState().addMapObject({
      kind: "marker",
      value: {
        id: "catalog-well",
        name: "Neuer Dorfbrunnen",
        type: "well",
        position: { x: 400, y: 300 },
        width: 54,
        height: 54,
      },
    });

    expect(useEditorStore.getState().selectedId).toBe("catalog-well");
    expect(useEditorStore.getState().document.map.markers).toHaveLength(initialMarkerCount + 1);

    useEditorStore.getState().undo();
    expect(useEditorStore.getState().document.map.markers).toHaveLength(initialMarkerCount);
  });

  it("adds and edits an independently selectable gate", () => {
    const initialGateCount = useEditorStore.getState().document.map.gates.length;
    useEditorStore.getState().addMapObject({
      kind: "gate",
      value: {
        id: "catalog-gate",
        name: "Neues Tor",
        position: { x: 400, y: 300 },
        rotation: 0,
        width: 48,
        kind: "main",
        style: "wall",
        notes: "",
      },
    });

    expect(useEditorStore.getState().selectedId).toBe("catalog-gate");
    expect(useEditorStore.getState().document.map.gates).toHaveLength(initialGateCount + 1);
    expect(useEditorStore.getState().getSelectedObject()).toMatchObject({
      kind: "gate",
      value: { id: "catalog-gate", style: "wall" },
    });

    useEditorStore.getState().rotateSelected(15);
    useEditorStore.getState().nudgeSelected({ x: 20, y: -20 });
    expect(
      useEditorStore.getState().document.map.gates.find((gate) => gate.id === "catalog-gate"),
    ).toMatchObject({ rotation: 15, position: { x: 420, y: 280 } });
  });

  it("advances the daily resource cycle as one undoable action", () => {
    useEditorStore.getState().advanceCycle();

    const state = useEditorStore.getState();
    expect(state.document.campaignCycle).toBe(1);
    expect(state.document.projects[0].currentStage).toBe("completion");
    expect(state.document.resources.find((resource) => resource.id === "wood"))
      .toMatchObject({ total: 34, reserved: 0 });
    expect(state.past).toHaveLength(1);

    state.undo();
    expect(useEditorStore.getState().document.campaignCycle).toBe(0);
    expect(useEditorStore.getState().document.projects[0].currentStage).toBe("masonry");
  });

  it("creates a standard construction project for every added building", () => {
    const document = createDefaultDocument();
    document.buildPlans = document.buildPlans.filter(
      (plan) => plan.id !== "standard-building",
    );
    useEditorStore.getState().hydrate(document);
    const cottage = document.map.buildings.find(
      (building) => building.assetTypeId === "cottage",
    )!;

    useEditorStore.getState().addMapObject({
      kind: "building",
      value: {
        ...cottage,
        id: "catalog-cottage",
        name: "Neues Wohnhaus",
        status: "planned",
      },
    });

    const state = useEditorStore.getState();
    expect(state.document.buildPlans.some((plan) => plan.id === "standard-building"))
      .toBe(true);
    expect(state.document.projects.find((project) => project.buildingId === "catalog-cottage"))
      .toMatchObject({
        id: "catalog-cottage-construction",
        buildPlanId: "standard-building",
        status: "planned",
        currentStage: "foundation",
      });

    useEditorStore.getState().reserveProjectPhase("catalog-cottage-construction");
    expect(
      useEditorStore
        .getState()
        .document.map.buildings.find((building) => building.id === "catalog-cottage"),
    ).toMatchObject({ status: "construction", subtitle: "Fundament · 0%" });

    useEditorStore.getState().undo();
    expect(
      useEditorStore
        .getState()
        .document.map.buildings.find((building) => building.id === "catalog-cottage"),
    ).toMatchObject({ status: "planned" });
  });

  it("uses a building-specific construction plan when one exists", () => {
    const document = createDefaultDocument();
    const forge = document.map.buildings.find((building) => building.id === "forge")!;

    useEditorStore.getState().addBuilding({
      ...forge,
      id: "second-forge",
      name: "Neue Schmiede",
      status: "planned",
    });

    expect(
      useEditorStore
        .getState()
        .document.projects.find((project) => project.buildingId === "second-forge"),
    ).toMatchObject({ buildPlanId: "simple-forge", currentStage: "foundation" });
  });

  it("resets a copy without changing its document identity", () => {
    const copy = {
      ...createDefaultDocument(),
      id: "herzdorf-copy",
      settlementName: "Herzdorf - Kopie",
      map: {
        ...createDefaultDocument().map,
        buildings: createDefaultDocument().map.buildings.map((building) =>
          building.id === "forge" ? { ...building, x: 20 } : building,
        ),
      },
    };
    useEditorStore.getState().hydrate(copy);

    useEditorStore.getState().reset();

    const reset = useEditorStore.getState().document;
    expect(reset.id).toBe("herzdorf-copy");
    expect(reset.settlementName).toBe("Herzdorf - Kopie");
    expect(reset.map.buildings.find((building) => building.id === "forge")?.x).toBe(
      createDefaultDocument().map.buildings.find((building) => building.id === "forge")?.x,
    );
  });

  it("consumes materials while retaining the construction crew for the next phase", () => {
    useEditorStore.getState().completeProjectPhase("forge-project");
    const document = useEditorStore.getState().document;
    const project = document.projects[0];

    expect(project.currentStage).toBe("completion");
    expect(project.phaseProgress).toBe(0);
    expect(project.resourcesReserved).toBe(false);
    expect(document.map.buildings.find((item) => item.id === "forge")?.subtitle).toBe(
      "Dach & Fertigstellung · 0%",
    );
    expect(document.resources.find((item) => item.id === "wood")).toMatchObject({
      total: 30,
      reserved: 0,
    });
    expect(document.resources.find((item) => item.id === "stone")).toMatchObject({
      total: 10,
      reserved: 0,
    });
    expect(document.resources.find((item) => item.id === "labor")).toBeUndefined();
    expect(project.workforce).toMatchObject({
      minWorkers: 4,
      residentWorkers: 4,
    });
  });

  it("keeps the population capacity above active assignments", () => {
    const assignedResidents = getWorkforceSummary(
      useEditorStore.getState().document,
    ).assignedResidents;
    useEditorStore.getState().updatePopulation({
      permanent: 1,
      workingResidents: 0,
    });

    expect(useEditorStore.getState().document.population).toMatchObject({
      permanent: assignedResidents,
      workingResidents: assignedResidents,
    });
  });

  it("releases a source workforce when the source is disabled", () => {
    const sourceId = useEditorStore.getState().document.resourceSources[0].id;
    useEditorStore.getState().updateResourceSource(sourceId, {
      enabled: false,
    });

    const source = useEditorStore.getState().document.resourceSources.find(
      (candidate) => candidate.id === sourceId,
    );
    expect(source).toMatchObject({
      enabled: false,
      workforce: { residentWorkers: 0, hiredWorkers: 0 },
    });
  });

  it("allows setup mode to prepare an upgrade tier while construction is active", () => {
    useEditorStore.getState().updateBuilding("forge", { upgradeTier: "master" });

    expect(
      useEditorStore.getState().document.map.buildings.find((item) => item.id === "forge")
        ?.upgradeTier,
    ).toBe("master");
  });

  it("finishes new construction at the base tier", () => {
    const document = createDefaultDocument();
    const forge = document.map.buildings.find((building) => building.id === "forge")!;
    forge.upgradeTier = "master";
    useEditorStore.getState().hydrate(document);

    useEditorStore.getState().completeProjectPhase("forge-project");
    useEditorStore
      .getState()
      .setProjectPrerequisite("forge-project", "smith-available", true);
    useEditorStore.getState().reserveProjectPhase("forge-project");
    useEditorStore.getState().completeProjectPhase("forge-project");

    const completed = useEditorStore
      .getState()
      .document.map.buildings.find((building) => building.id === "forge");
    expect(completed).toMatchObject({
      status: "complete",
      subtitle: "Dach & Fertigstellung · 100%",
      upgradeTier: "base",
    });
  });

  it("reserves the next phase and supports undo", () => {
    useEditorStore.getState().completeProjectPhase("forge-project");
    useEditorStore
      .getState()
      .setProjectPrerequisite("forge-project", "smith-available", true);
    useEditorStore.getState().reserveProjectPhase("forge-project");

    expect(
      useEditorStore.getState().document.resources.find((item) => item.id === "wood")
        ?.reserved,
    ).toBe(16);

    useEditorStore.getState().undo();
    expect(
      useEditorStore.getState().document.resources.find((item) => item.id === "wood")
        ?.reserved,
    ).toBe(0);
  });

  it("blocks completion until a smith is available", () => {
    const store = useEditorStore.getState();
    store.completeProjectPhase("forge-project");
    useEditorStore.getState().reserveProjectPhase("forge-project");
    useEditorStore.getState().completeProjectPhase("forge-project");

    expect(useEditorStore.getState().document.projects[0].status).toBe("blocked");
    useEditorStore
      .getState()
      .setProjectPrerequisite("forge-project", "smith-available", true);
    expect(useEditorStore.getState().document.projects[0].status).toBe("active");
  });
});
