import { describe, expect, it } from "vitest";
import { createDefaultDocument } from "./bundledDocuments";
import { summarizeStoredDocument } from "./editorDatabase";

describe("stored document summaries", () => {
  it("keeps unreadable documents visible for recovery", () => {
    expect(summarizeStoredDocument({
      id: "damaged-map",
      document: {
        schemaVersion: 999,
        settlementName: "Beschädigte Karte",
        ruleset: "D&D 5e",
      },
      updatedAt: 42,
      kind: "settlement",
    })).toEqual(expect.objectContaining({
      id: "damaged-map",
      name: "Beschädigte Karte",
      ruleset: "D&D 5e",
      readable: false,
    }));
  });

  it("marks migrated documents as readable", () => {
    const document = createDefaultDocument();
    expect(summarizeStoredDocument({
      id: document.id,
      document,
      updatedAt: 42,
      kind: "template",
    })).toEqual(expect.objectContaining({
      name: document.settlementName,
      readable: true,
    }));
  });
});
