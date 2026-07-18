import { describe, expect, it } from "vitest";
import { createDefaultDocument } from "../persistence/bundledDocuments";
import { normalizeLegacyGates } from "./gates";

describe("normalizeLegacyGates", () => {
  it("moves nested gates into global map coordinates", () => {
    const document = createDefaultDocument();
    const palisade = document.map.palisades[0];
    document.map.gates = [];
    palisade.center = { x: 100, y: 200 };
    palisade.rotation = 90;
    palisade.style = "wall";
    palisade.gates = [
      {
        id: "legacy-gate",
        name: "Legacy gate",
        position: { x: 20, y: 10 },
        rotation: 15,
        width: 40,
        kind: "service",
      },
    ];

    normalizeLegacyGates(document);

    expect(palisade.gates).toEqual([]);
    expect(document.map.gates).toEqual([
      expect.objectContaining({
        id: "legacy-gate",
        position: { x: 90, y: 220 },
        rotation: 105,
        style: "wall",
        notes: "",
      }),
    ]);
  });
});
