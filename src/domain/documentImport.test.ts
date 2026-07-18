import { describe, expect, it } from "vitest";
import { createDefaultDocument } from "../persistence/bundledDocuments";
import { parseEditorDocumentJson } from "./documentImport";
import { currentSchemaVersion } from "./types";

describe("document import", () => {
  it("parses a current exported document", () => {
    const source = createDefaultDocument();

    const imported = parseEditorDocumentJson(JSON.stringify(source));

    expect(imported).toEqual(source);
    expect(imported).not.toBe(source);
  });

  it("migrates older documents before validation", () => {
    const source = structuredClone(createDefaultDocument()) as any;
    source.schemaVersion = 12;
    source.resources.push({
      id: "goods",
      name: "Handwerkswaren",
      total: 3,
      reserved: 0,
      unit: "Einheiten",
      source: "",
      consumable: true,
    });

    const imported = parseEditorDocumentJson(JSON.stringify(source));

    expect(imported.schemaVersion).toBe(currentSchemaVersion);
    expect(imported.resources.some((resource) => resource.id === "goods"))
      .toBe(false);
  });

  it.each([
    ["invalidJson", "{"],
    ["invalidDocument", JSON.stringify({ schemaVersion: currentSchemaVersion })],
    ["unsupportedVersion", JSON.stringify({ schemaVersion: currentSchemaVersion + 1 })],
  ] as const)("reports %s imports", (code, json) => {
    expect(() => parseEditorDocumentJson(json)).toThrowError(
      expect.objectContaining({ code }),
    );
  });
});
