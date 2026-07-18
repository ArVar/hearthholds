import { describe, expect, it } from "vitest";
import { createDefaultDocument } from "./bundledDocuments";
import { createDocumentCopy, createEmptyDocument } from "./documentCopy";

describe("document copies", () => {
  it("creates an independent settlement document", () => {
    const template = createDefaultDocument();
    const copy = createDocumentCopy(template, ["Herzdorf"], "Kopie", "copy-1");

    expect(copy.id).toBe("copy-1");
    expect(copy.settlementName).toBe("Herzdorf - Kopie");
    copy.map.buildings[0].name = "Geändertes Haus";
    expect(template.map.buildings[0].name).not.toBe("Geändertes Haus");
  });

  it("numbers additional copies without stacking name suffixes", () => {
    const source = {
      ...createDefaultDocument(),
      settlementName: "Herzdorf - Kopie",
    };
    const copy = createDocumentCopy(
      source,
      ["Herzdorf", "Herzdorf - Kopie", "Herzdorf - Kopie 2"],
      "Kopie",
      "copy-3",
    );

    expect(copy.settlementName).toBe("Herzdorf - Kopie 3");
  });
});

describe("createEmptyDocument", () => {
  it("keeps map settings and build plans but removes settlement content", () => {
    const source = createDefaultDocument();
    const empty = createEmptyDocument(source, ["Neue Siedlung"], "Neue Siedlung", "empty-1");

    expect(empty).toMatchObject({
      id: "empty-1",
      settlementName: "Neue Siedlung 2",
      population: { permanent: 0, named: 0, temporaryLabel: "" },
      projects: [],
    });
    expect(empty.map).toEqual({
      width: source.map.width,
      height: source.map.height,
      grid: source.map.grid,
      scene: {
        layers: source.map.scene.layers,
        objects: [],
        groups: [],
        objectOrder: [],
      },
      terrainStrokes: [],
      buildings: [],
      palisades: [],
      gates: [],
      zones: [],
      paths: [],
      markers: [],
      decorations: [],
    });
    expect(empty.buildPlans).toEqual(source.buildPlans);
    expect(empty.resourceSources).toEqual([]);
    expect(empty.resources.every((resource) => resource.total === 0)).toBe(true);
  });
});
