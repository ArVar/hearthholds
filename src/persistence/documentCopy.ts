import type { EditorDocument } from "../domain/types";

function getCopyName(
  sourceName: string,
  existingNames: string[],
  copyLabel: string,
): string {
  const escapedLabel = copyLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const baseName = sourceName.replace(
    new RegExp(` - ${escapedLabel}(?: \\d+)?$`),
    "",
  );
  const usedNames = new Set(existingNames);
  const firstCopyName = `${baseName} - ${copyLabel}`;
  if (!usedNames.has(firstCopyName)) return firstCopyName;

  let number = 2;
  while (usedNames.has(`${firstCopyName} ${number}`)) number += 1;
  return `${firstCopyName} ${number}`;
}

export function createDocumentCopy(
  source: EditorDocument,
  existingNames: string[],
  copyLabel: string,
  id = `settlement-${crypto.randomUUID()}`,
): EditorDocument {
  return {
    ...structuredClone(source),
    id,
    settlementName: getCopyName(source.settlementName, existingNames, copyLabel),
    updatedAt: new Date().toISOString(),
  };
}

function getAvailableName(baseName: string, existingNames: string[]): string {
  const usedNames = new Set(existingNames);
  if (!usedNames.has(baseName)) return baseName;

  let number = 2;
  while (usedNames.has(`${baseName} ${number}`)) number += 1;
  return `${baseName} ${number}`;
}

export function createEmptyDocument(
  source: EditorDocument,
  existingNames: string[],
  baseName: string,
  id = `settlement-${crypto.randomUUID()}`,
): EditorDocument {
  return {
    ...structuredClone(source),
    id,
    settlementName: getAvailableName(baseName, existingNames),
    campaignCycle: 0,
    population: {
      permanent: 0,
      named: 0,
      workingResidents: 0,
      temporaryLabel: "",
    },
    treasury: {
      ...structuredClone(source.treasury),
      balanceBaseUnits: 0,
      ledger: [],
    },
    map: {
      width: source.map.width,
      height: source.map.height,
      grid: structuredClone(source.map.grid),
      scene: {
        layers: structuredClone(source.map.scene.layers),
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
    },
    resources: source.resources.map((resource) => ({
      ...structuredClone(resource),
      total: 0,
      reserved: 0,
      source: "",
    })),
    resourceSources: [],
    projects: [],
    updatedAt: new Date().toISOString(),
  };
}
