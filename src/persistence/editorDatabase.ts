import Dexie, { type EntityTable } from "dexie";
import { parseEditorDocument } from "../domain/documentImport";
import { editorDocumentSchema } from "../domain/schema";
import type { EditorDocument } from "../domain/types";
import {
  DocumentStorageError,
  toDocumentStorageError,
} from "./storageReliability";

type StoredDocument = {
  id: string;
  document: unknown;
  updatedAt: number;
  kind?: DocumentKind;
  sourceTemplateId?: string;
};

type StoredSetting = {
  key: string;
  value: string;
};

export type DocumentKind = "template" | "settlement";

export type DocumentSummary = {
  id: string;
  name: string;
  ruleset: string;
  kind: DocumentKind;
  sourceTemplateId?: string;
  updatedAt: number;
  readable: boolean;
};

export type DocumentMetadata = {
  kind: DocumentKind;
  sourceTemplateId?: string;
};

type DocumentSummarySource = Pick<
  StoredDocument,
  "id" | "document" | "updatedAt" | "kind" | "sourceTemplateId"
>;

const ACTIVE_DOCUMENT_KEY = "active-document-id";

const database = new Dexie("pnp-settlement") as Dexie & {
  documents: EntityTable<StoredDocument, "id">;
  settings: EntityTable<StoredSetting, "key">;
};

database.version(1).stores({
  documents: "id, updatedAt",
});

// Persist local documents across development schema iterations. Invalid records
// are ignored by parseStoredDocument instead of deleting every saved map.
database.version(8).stores({
  documents: "id, kind, updatedAt",
  settings: "key",
});

function parseStoredDocument(value: unknown): EditorDocument | null {
  try {
    return parseEditorDocument(value);
  } catch {
    return null;
  }
}

export function summarizeStoredDocument(stored: DocumentSummarySource): DocumentSummary {
  const document = parseStoredDocument(stored.document);
  const raw = stored.document && typeof stored.document === "object"
    ? stored.document as { settlementName?: unknown; ruleset?: unknown }
    : null;
  return {
    id: stored.id,
    name: document?.settlementName
      ?? (typeof raw?.settlementName === "string" ? raw.settlementName : stored.id),
    ruleset: document?.ruleset
      ?? (typeof raw?.ruleset === "string" ? raw.ruleset : "—"),
    kind: stored.kind ?? "settlement",
    sourceTemplateId: stored.sourceTemplateId,
    updatedAt: stored.updatedAt,
    readable: Boolean(document),
  };
}

export async function loadDocument(id: string): Promise<EditorDocument | null> {
  const stored = await database.documents.get(id);
  if (!stored) {
    return null;
  }

  return parseStoredDocument(stored.document);
}

export async function saveDocument(
  document: EditorDocument,
  metadata?: Partial<DocumentMetadata>,
): Promise<void> {
  if (!editorDocumentSchema.safeParse(document).success) {
    throw new DocumentStorageError("validation");
  }
  try {
    const existing = await database.documents.get(document.id);
    await database.documents.put({
      id: document.id,
      document,
      updatedAt: Date.now(),
      kind: metadata?.kind ?? existing?.kind ?? "settlement",
      sourceTemplateId: metadata?.sourceTemplateId ?? existing?.sourceTemplateId,
    });
  } catch (error) {
    throw toDocumentStorageError(error);
  }
}

export async function listDocuments(): Promise<DocumentSummary[]> {
  const storedDocuments = await database.documents.toArray();
  return storedDocuments
    .map(summarizeStoredDocument)
    .sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === "template" ? -1 : 1;
      return right.updatedAt - left.updatedAt;
    });
}

export async function loadRawDocument(id: string): Promise<unknown | null> {
  return (await database.documents.get(id))?.document ?? null;
}

export async function loadActiveDocumentId(): Promise<string | null> {
  return (await database.settings.get(ACTIVE_DOCUMENT_KEY))?.value ?? null;
}

export async function saveActiveDocumentId(id: string): Promise<void> {
  await database.settings.put({ key: ACTIVE_DOCUMENT_KEY, value: id });
}

export async function deleteDocument(id: string): Promise<void> {
  await database.documents.delete(id);
}
