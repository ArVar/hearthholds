import { standardBuildPlan, standardBuildPlanId } from "./construction";
import { migrateEditorDocument } from "./documentMigration";
import { normalizeLegacyGates } from "./gates";
import { editorDocumentSchema } from "./schema";
import { currentSchemaVersion, type EditorDocument } from "./types";

export type DocumentImportErrorCode =
  | "invalidJson"
  | "invalidDocument"
  | "unsupportedVersion";

export class DocumentImportError extends Error {
  constructor(public readonly code: DocumentImportErrorCode) {
    super(code);
    this.name = "DocumentImportError";
  }
}

function withRequiredDefaults(document: EditorDocument): EditorDocument {
  if (!document.buildPlans.some((plan) => plan.id === standardBuildPlanId)) {
    document.buildPlans.unshift(structuredClone(standardBuildPlan));
  }
  return document;
}

export function parseEditorDocument(value: unknown): EditorDocument {
  const sourceVersion =
    value && typeof value === "object" && "schemaVersion" in value
      ? (value as { schemaVersion?: unknown }).schemaVersion
      : undefined;
  if (
    typeof sourceVersion === "number"
    && sourceVersion > currentSchemaVersion
  ) {
    throw new DocumentImportError("unsupportedVersion");
  }

  const parsed = editorDocumentSchema.safeParse(migrateEditorDocument(value));
  if (!parsed.success) throw new DocumentImportError("invalidDocument");
  return withRequiredDefaults(normalizeLegacyGates(parsed.data));
}

export function parseEditorDocumentJson(json: string): EditorDocument {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new DocumentImportError("invalidJson");
  }
  return parseEditorDocument(value);
}
