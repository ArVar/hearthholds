import type { TerrainType } from "./types";

export type TerrainStyle = {
  color: string;
  edge: string;
  detail: string;
  opacity: number;
};

export const terrainStyles: Record<TerrainType, TerrainStyle> = {
  grass: { color: "#4f7742", edge: "#263f2b", detail: "#9db76c", opacity: 0.64 },
  dirt: { color: "#8a633c", edge: "#4e3425", detail: "#c49a62", opacity: 0.78 },
  mud: { color: "#594a35", edge: "#302a23", detail: "#857251", opacity: 0.82 },
  stone: { color: "#727773", edge: "#3d4645", detail: "#aeb4aa", opacity: 0.76 },
  sand: { color: "#b59658", edge: "#6f5936", detail: "#dac481", opacity: 0.72 },
};
