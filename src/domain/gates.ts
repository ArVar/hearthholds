import type { EditorDocument, Gate, Palisade } from "./types";

function toGlobalGate(gate: Gate, palisade: Palisade): Gate {
  const angle = (palisade.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    ...gate,
    position: {
      x: palisade.center.x + gate.position.x * cos - gate.position.y * sin,
      y: palisade.center.y + gate.position.x * sin + gate.position.y * cos,
    },
    rotation: gate.rotation + palisade.rotation,
    style: gate.style ?? palisade.style ?? "palisade",
    notes: gate.notes ?? "",
  };
}

export function normalizeLegacyGates(document: EditorDocument): EditorDocument {
  const knownGateIds = new Set(document.map.gates.map((gate) => gate.id));

  for (const palisade of document.map.palisades) {
    for (const gate of palisade.gates) {
      if (knownGateIds.has(gate.id)) continue;
      document.map.gates.push(toGlobalGate(gate, palisade));
      knownGateIds.add(gate.id);
    }
    palisade.gates = [];
  }

  return document;
}
