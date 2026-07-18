import { describe, expect, it } from "vitest";
import { createDefaultDocument } from "../persistence/bundledDocuments";
import {
  getLayerVisibility,
  getOrderedLayerObjects,
  getSceneObjects,
  isSceneObjectLocked,
  isSceneObjectVisible,
  reorderSceneObject,
} from "./scene";

describe("scene hierarchy", () => {
  it("maps every selectable object to its browser layer", () => {
    const document = createDefaultDocument();
    const objects = getSceneObjects(document);

    expect(objects.find((object) => object.id === "forge")?.layerId).toBe("buildings");
    expect(objects.find((object) => object.id === "main-road")?.layerId).toBe("infrastructure");
    expect(objects.find((object) => object.id === "river")?.layerId).toBe("terrain");
    expect(objects.find((object) => object.id === "village-well")?.layerId).toBe("markers");
  });

  it("inherits visibility and locks from groups and layers", () => {
    const document = createDefaultDocument();
    document.map.scene.groups.push({
      id: "group-1",
      name: "Group",
      objectIds: ["forge"],
      visible: false,
      locked: true,
    });

    expect(isSceneObjectVisible(document, "forge")).toBe(false);
    expect(isSceneObjectLocked(document, "forge")).toBe(true);

    document.map.scene.groups[0].visible = true;
    document.map.scene.groups[0].locked = false;
    document.map.scene.layers.find((layer) => layer.id === "buildings")!.locked = true;
    expect(isSceneObjectVisible(document, "forge")).toBe(true);
    expect(isSceneObjectLocked(document, "forge")).toBe(true);
    expect(getLayerVisibility(document).reference).toBe(false);
  });

  it("persists a front-to-back order within a layer", () => {
    const document = createDefaultDocument();

    reorderSceneObject(document, "carpentry", "forge");

    const buildings = getOrderedLayerObjects(document, "buildings");
    expect(buildings.findIndex((object) => object.id === "carpentry"))
      .toBeLessThan(buildings.findIndex((object) => object.id === "forge"));
    expect(document.map.scene.objectOrder).toContain("carpentry");
  });
});
