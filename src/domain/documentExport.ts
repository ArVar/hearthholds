import type { EditorDocument } from "./types";

function toFileStem(name: string): string {
  const stem = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return stem || "siedlung";
}

export function getDocumentExportName(document: EditorDocument): string {
  return `${toFileStem(document.settlementName)}.schema-v${document.schemaVersion}.json`;
}

export function serializeEditorDocument(document: EditorDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function downloadEditorDocument(document: EditorDocument): void {
  downloadJson(serializeEditorDocument(document), getDocumentExportName(document));
}

export function downloadRawDocument(value: unknown, id: string): void {
  downloadJson(`${JSON.stringify(value, null, 2)}\n`, `${toFileStem(id)}.recovery.json`);
}

function downloadJson(json: string, fileName: string): void {
  const blob = new Blob([json], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  window.document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
