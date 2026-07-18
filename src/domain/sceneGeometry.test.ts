import { describe, expect, it } from "vitest";
import { createDefaultDocument } from "../persistence/bundledDocuments";
import {
  getSceneSelectionBounds,
  sceneBoundsIntersect,
  transformSceneSelection,
} from "./sceneGeometry";

describe("scene selection geometry", () => {
  it("combines rotated object bounds and detects intersections", () => {
    const document = createDefaultDocument();
    const bounds = getSceneSelectionBounds(document, ["forge", "carpentry"]);

    expect(bounds).not.toBeNull();
    expect(bounds?.width).toBeGreaterThan(100);
    expect(sceneBoundsIntersect(bounds!, {
      x: 900,
      y: 350,
      width: 200,
      height: 200,
    })).toBe(true);
    expect(sceneBoundsIntersect(bounds!, { x: 0, y: 0, width: 10, height: 10 }))
      .toBe(false);
  });

  it("transforms mixed selections around a shared origin", () => {
    const document = createDefaultDocument();
    const forge = document.map.buildings.find((item) => item.id === "forge")!;
    const well = document.map.markers.find((item) => item.id === "village-well")!;
    const road = document.map.paths.find((item) => item.id === "main-road")!;
    const originalForge = { ...forge };
    const originalWell = { ...well, position: { ...well.position } };
    const originalRoadPoint = road.points[0];

    transformSceneSelection(document, ["forge", "village-well", "main-road"], {
      origin: { x: 0, y: 0 },
      center: { x: 10, y: 20 },
      scale: 2,
      rotation: 0,
    });

    expect(forge).toMatchObject({
      x: originalForge.x * 2 + 10,
      y: originalForge.y * 2 + 20,
      width: originalForge.width * 2,
      height: originalForge.height * 2,
    });
    expect(well.position).toEqual({
      x: originalWell.position.x * 2 + 10,
      y: originalWell.position.y * 2 + 20,
    });
    expect(road.width).toBe(40);
    expect(road.points[0]).toBe(originalRoadPoint * 2 + 10);
  });
});
