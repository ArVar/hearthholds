import { describe, expect, it } from "vitest";
import { editorDocumentSchema } from "./schema";
import { createDefaultDocument } from "../persistence/bundledDocuments";
import { getDocumentExportName, serializeEditorDocument } from "./documentExport";
import { getPathAnchors } from "./pathGeometry";

describe("document export", () => {
  it("serializes a schema-valid, readable settlement definition", () => {
    const document = createDefaultDocument();
    document.map.paths[0].anchors = getPathAnchors(document.map.paths[0]);
    const json = serializeEditorDocument(document);
    const parsed = JSON.parse(json) as unknown;

    expect(json).toContain('\n  "map": {');
    expect(editorDocumentSchema.safeParse(parsed).success).toBe(true);
    expect(json).toContain('"mode": "smooth"');
    expect(getDocumentExportName(document)).toBe("herzdorf.schema-v16.json");
  });
});
