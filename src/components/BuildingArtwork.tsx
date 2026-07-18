import { useEffect, useState } from "react";
import { Circle, Group, Image as KonvaImage, Line, Rect } from "react-konva";
import type { Building } from "../domain/types";
import { getBuildingVisualAssetId, getVisualAsset } from "../domain/visualAssets";

type BuildingArtworkProps = {
  building: Building;
  selected: boolean;
  overrideAssetId?: string;
};

const OUTLINE = "#43382f";
const SELECTED = "#167f86";

function useRasterImage(source: string | undefined) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    setImage(null);
    if (!source) return;

    let active = true;
    const element = new window.Image();
    element.onload = () => {
      if (active) setImage(element);
    };
    element.onerror = () => {
      if (active) setImage(null);
    };
    element.src = source;
    return () => {
      active = false;
      element.onload = null;
      element.onerror = null;
    };
  }, [source]);

  return image;
}

function SelectionFrame({ building, selected }: BuildingArtworkProps) {
  return (
    <Rect
      x={-building.width / 2 - 5}
      y={-building.height / 2 - 5}
      width={building.width + 10}
      height={building.height + 10}
      fill="rgba(255,255,255,0.001)"
      stroke={selected ? SELECTED : "rgba(0,0,0,0)"}
      strokeWidth={2}
      dash={selected ? [7, 4] : undefined}
      cornerRadius={building.shape === "circle" ? Math.min(building.width, building.height) : 7}
    />
  );
}

function BuildingFallback({ building }: { building: Building }) {
  const underConstruction = building.status === "construction";
  const fill = underConstruction ? "#c4b9aa" : building.color;
  const dash = underConstruction ? [9, 5] : undefined;

  if (building.shape === "circle") {
    return (
      <Circle
        radius={Math.min(building.width, building.height) / 2}
        scaleX={building.width / Math.min(building.width, building.height)}
        scaleY={building.height / Math.min(building.width, building.height)}
        fill={fill}
        opacity={underConstruction ? 0.65 : 1}
        stroke={OUTLINE}
        strokeWidth={3}
        dash={dash}
      />
    );
  }

  const halfWidth = building.width / 2;
  const halfHeight = building.height / 2;
  return (
    <Group opacity={underConstruction ? 0.65 : 1}>
      <Rect
        x={-halfWidth}
        y={-halfHeight}
        width={building.width}
        height={building.height}
        fill={fill}
        stroke={OUTLINE}
        strokeWidth={3}
        dash={dash}
        cornerRadius={5}
      />
      <Line
        points={[-halfWidth + 8, 0, 0, -halfHeight + 8, halfWidth - 8, 0]}
        stroke={OUTLINE}
        strokeWidth={3}
        opacity={0.7}
      />
      <Line
        points={[-halfWidth + 8, 0, 0, halfHeight - 8, halfWidth - 8, 0]}
        stroke={OUTLINE}
        strokeWidth={3}
        opacity={0.45}
      />
    </Group>
  );
}

export function BuildingArtwork({
  building,
  selected,
  overrideAssetId,
}: BuildingArtworkProps) {
  const resolvedAssetId = overrideAssetId ?? getBuildingVisualAssetId(building);
  const asset = getVisualAsset(resolvedAssetId);
  const image = useRasterImage(asset?.albedoUrl);
  const damageAsset = getVisualAsset(
    building.status === "damaged" ? "environment/overlay/building-damage" : undefined,
  );
  const damageImage = useRasterImage(damageAsset?.albedoUrl);
  const width = asset ? building.width * asset.footprintScale.x : building.width;
  const height = asset ? building.height * asset.footprintScale.y : building.height;

  return (
    <Group opacity={building.status === "planned" ? 0.66 : 1}>
      {asset && image ? (
        <KonvaImage
          image={image}
          x={-width / 2}
          y={-height / 2}
          width={width}
          height={height}
          listening={false}
        />
      ) : (
        <BuildingFallback building={building} />
      )}
      {damageImage && (
        <KonvaImage
          image={damageImage}
          x={-width / 2}
          y={-height / 2}
          width={width}
          height={height}
          listening={false}
        />
      )}
      <SelectionFrame building={building} selected={selected} />
    </Group>
  );
}
