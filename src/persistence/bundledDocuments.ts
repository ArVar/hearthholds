import mapCatalog from "../data/map-catalog.json";
import { parseEditorDocument } from "../domain/documentImport";
import type { EditorDocument } from "../domain/types";

const bundledSources = import.meta.glob("../data/maps/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

export const defaultDocumentId = mapCatalog.defaultDocumentId;

export function parseBundledDocument(value: unknown): EditorDocument {
  return parseEditorDocument(value);
}

export function createBundledDocument(id: string): EditorDocument {
  const entry = Object.entries(bundledSources).find(([path]) =>
    path.endsWith(`/${id}.json`),
  );
  if (!entry) throw new Error(`Bundled settlement not found: ${id}`);
  return parseBundledDocument(entry[1]);
}

export function createDefaultDocument(): EditorDocument {
  return createBundledDocument(defaultDocumentId);
}
