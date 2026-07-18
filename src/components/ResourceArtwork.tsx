const artworkCells: Record<string, string> = {
  population: "population",
  treasury: "treasury",
  wood: "wood",
  stone: "stone",
  metal: "metal",
  mining: "metal",
  ironOre: "metal",
  copperOre: "metal",
  goldOre: "metal",
  agriculture: "harvest",
  grain: "harvest",
  hops: "harvest",
};

export function ResourceArtwork({
  resourceId,
  label,
  size = "normal",
}: {
  resourceId: string;
  label: string;
  size?: "small" | "normal";
}) {
  const cell = artworkCells[resourceId] ?? "fallback";

  return (
    <span
      className={`resource-artwork is-${cell} ${size === "small" ? "is-small" : ""}`}
      role="img"
      aria-label={label}
    />
  );
}
