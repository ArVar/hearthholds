import { describe, expect, it } from "vitest";
import { createDefaultDocument } from "../persistence/bundledDocuments";
import { resizeDocumentMap } from "./mapResize";

describe("resizeDocumentMap", () => {
  it("keeps content fixed when the top-left anchor is selected", () => {
    const document = createDefaultDocument();
    const building = structuredClone(document.map.buildings[0]);

    resizeDocumentMap(
      document,
      { width: document.map.width + 200, height: document.map.height + 100 },
      "top-left",
    );

    expect(document.map.buildings[0]).toMatchObject({ x: building.x, y: building.y });
  });

  it("moves all coordinate-based content around the fixed center", () => {
    const document = createDefaultDocument();
    document.map.terrainStrokes = [
      { id: "stroke", type: "grass", points: [10, 20, 30, 40], width: 12 },
    ];
    document.map.paths[0].anchors = [
      {
        x: 10,
        y: 20,
        mode: "smooth",
        handleOut: { x: 30, y: 40 },
      },
      {
        x: 50,
        y: 60,
        mode: "smooth",
        handleIn: { x: 35, y: 45 },
      },
    ];
    const building = structuredClone(document.map.buildings[0]);
    const palisade = structuredClone(document.map.palisades[0]);
    const gate = structuredClone(document.map.gates[0]);
    const zone = structuredClone(document.map.zones[0]);
    const marker = structuredClone(document.map.markers[0]);
    const decoration = structuredClone(document.map.decorations[0]);
    const path = structuredClone(document.map.paths[0]);
    const previousWidth = document.map.width;
    const previousHeight = document.map.height;

    resizeDocumentMap(
      document,
      { width: previousWidth + 200, height: previousHeight - 100 },
      "center",
    );

    expect(document.map.buildings[0]).toMatchObject({
      x: building.x + 100,
      y: building.y - 50,
    });
    expect(document.map.markers[0].position).toEqual({
      x: marker.position.x + 100,
      y: marker.position.y - 50,
    });
    expect(document.map.palisades[0].center).toEqual({
      x: palisade.center.x + 100,
      y: palisade.center.y - 50,
    });
    expect(document.map.gates[0].position).toEqual({
      x: gate.position.x + 100,
      y: gate.position.y - 50,
    });
    expect(document.map.zones[0]).toMatchObject({
      x: zone.x + 100,
      y: zone.y - 50,
    });
    expect(document.map.decorations[0].position).toEqual({
      x: decoration.position.x + 100,
      y: decoration.position.y - 50,
    });
    expect(document.map.paths[0].points).toEqual(
      path.points.map((coordinate, index) => coordinate + (index % 2 === 0 ? 100 : -50)),
    );
    expect(document.map.paths[0].anchors).toEqual([
      {
        x: 110,
        y: -30,
        mode: "smooth",
        handleOut: { x: 130, y: -10 },
      },
      {
        x: 150,
        y: 10,
        mode: "smooth",
        handleIn: { x: 135, y: -5 },
      },
    ]);
    expect(document.map.terrainStrokes[0].points).toEqual([110, -30, 130, -10]);
  });

  it("keeps the bottom-right content anchor fixed", () => {
    const document = createDefaultDocument();
    const building = structuredClone(document.map.buildings[0]);

    resizeDocumentMap(
      document,
      { width: document.map.width - 100, height: document.map.height - 80 },
      "bottom-right",
    );

    expect(document.map.buildings[0]).toMatchObject({
      x: building.x - 100,
      y: building.y - 80,
    });
  });
});
