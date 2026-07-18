import { describe, expect, it } from "vitest";
import { createDefaultDocument } from "../persistence/bundledDocuments";
import { getObjectCatalogItems, objectCatalogCategories } from "./objectCatalog";

const localize = (text: { de: string; en: string }) => text.de;

describe("object catalog", () => {
  it("groups all objects in registered categories", () => {
    const categoryIds = new Set(objectCatalogCategories.map((category) => category.id));
    const items = getObjectCatalogItems();

    expect(items.length).toBeGreaterThanOrEqual(18);
    expect(items.every((item) => categoryIds.has(item.categoryId))).toBe(true);
    expect(items.every((item) => item.variants.length > 0)).toBe(true);
  });

  it("uses bitmap thumbnails selectively for visual objects", () => {
    const items = getObjectCatalogItems();

    expect(items.find((item) => item.id === "building-cottage")?.variants).toHaveLength(3);
    expect(items.find((item) => item.id === "building-forge")?.variants[0].thumbnailUrl).toBeTruthy();
    expect(items.find((item) => item.id === "well")?.variants[0].thumbnailUrl).toBeTruthy();
    expect(items.find((item) => item.id === "woodpile")?.variants).toHaveLength(2);
    expect(
      items.find((item) => item.id === "woodpile")?.variants.every((variant) => variant.thumbnailUrl),
    ).toBe(true);
    expect(items.find((item) => item.id === "road")?.variants[0].thumbnailUrl).toBeUndefined();
  });

  it("creates a placeable woodpile decoration", () => {
    const woodpile = getObjectCatalogItems().find((item) => item.id === "woodpile")!;
    const object = woodpile.create(
      { document: createDefaultDocument(), localize },
      "short-logs",
    );

    expect(woodpile.categoryId).toBe("equipment.decorations");
    expect(object).toMatchObject({
      kind: "decoration",
      value: {
        name: "Neuer Holzstapel",
        assetId: "environment/prop/woodpile",
        width: 120,
        height: 90,
      },
    });

    expect(
      woodpile.create({ document: createDefaultDocument(), localize }, "long-timber"),
    ).toMatchObject({
      kind: "decoration",
      value: {
        name: "Neuer Langholzstapel",
        assetId: "environment/prop/timber-stack",
        width: 180,
        height: 90,
      },
    });
  });

  it("models palisades and walls as variants of one fortification", () => {
    const fortification = getObjectCatalogItems().find((item) => item.id === "fortification")!;
    const context = { document: createDefaultDocument(), localize };

    expect(fortification.variants.map((variant) => variant.id)).toEqual(["palisade", "wall"]);
    expect(fortification.create(context, "palisade")).toMatchObject({
      kind: "barrier",
      value: { style: "palisade", thickness: 12 },
    });
    expect(fortification.create(context, "wall")).toMatchObject({
      kind: "barrier",
      value: { style: "wall", thickness: 16 },
    });
  });

  it("creates wooden and stone gates as independent fortification objects", () => {
    const gate = getObjectCatalogItems().find((item) => item.id === "gate")!;
    const context = { document: createDefaultDocument(), localize };

    expect(gate.categoryId).toBe("infrastructure.fortifications");
    expect(gate.variants.map((variant) => variant.id)).toEqual(["palisade", "wall"]);
    expect(gate.create(context, "palisade")).toMatchObject({
      kind: "gate",
      value: { style: "palisade", kind: "main", width: 48 },
    });
    expect(gate.create(context, "wall")).toMatchObject({
      kind: "gate",
      value: { style: "wall", kind: "main", width: 48 },
    });
  });
});
