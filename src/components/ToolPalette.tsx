import {
  Castle,
  CircleDot,
  DoorOpen,
  Fence,
  Flame,
  Hammer,
  Home,
  Plus,
  PackageOpen,
  Paintbrush,
  Route,
  Search,
  Sprout,
  Trees,
  Warehouse,
} from "lucide-react";
import { useState } from "react";
import {
  getObjectCatalogItems,
  objectCatalogCategories,
  type CatalogIcon,
  type ObjectCatalogItem,
  type ObjectCatalogVariant,
} from "../domain/objectCatalog";
import { getLayerState } from "../domain/scene";
import type { TerrainType } from "../domain/types";
import { terrainStyles } from "../domain/terrain";
import { useI18n } from "../i18n/I18nProvider";
import type { TranslationKey } from "../i18n/messages";
import { useEditorStore } from "../store/editorStore";

const catalogIcons = {
  home: Home,
  hammer: Hammer,
  castle: Castle,
  sprout: Sprout,
  route: Route,
  fence: Fence,
  "door-open": DoorOpen,
  trees: Trees,
  "map-pin": CircleDot,
  flame: Flame,
  package: PackageOpen,
} satisfies Record<CatalogIcon, typeof Home>;

const catalogItems = getObjectCatalogItems();

const terrainTypeKeys: Record<TerrainType, TranslationKey> = {
  grass: "terrain.grass",
  dirt: "terrain.dirt",
  mud: "terrain.mud",
  stone: "terrain.stone",
  sand: "terrain.sand",
};

const terrainBrushTypes = Object.keys(terrainTypeKeys) as TerrainType[];
const terrainBrushSizes = [3, 6, 12, 24];

function CatalogPreview({ item, variant }: { item: ObjectCatalogItem; variant: ObjectCatalogVariant }) {
  const Icon = catalogIcons[item.icon];

  if (variant.thumbnailUrl) {
    return <img src={variant.thumbnailUrl} alt="" loading="lazy" />;
  }

  return (
    <span className="catalog-icon-preview" style={variant.swatch ? { background: variant.swatch } : undefined}>
      <Icon size={22} />
    </span>
  );
}

export function ToolPalette() {
  const { localize, t } = useI18n();
  const [tab, setTab] = useState<"objects" | "terrain">("objects");
  const [brushSizeMeters, setBrushSizeMeters] = useState(6);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [variantItemId, setVariantItemId] = useState<string | null>(null);
  const document = useEditorStore((state) => state.document);
  const activeTerrainBrush = useEditorStore((state) => state.activeTerrainBrush);
  const addMapObject = useEditorStore((state) => state.addMapObject);
  const setLayerVisible = useEditorStore((state) => state.setLayerVisible);
  const setActiveTerrainBrush = useEditorStore((state) => state.setActiveTerrainBrush);

  const normalizedSearch = catalogSearch.trim().toLocaleLowerCase();
  const terrainLocked = getLayerState(document, "terrain").locked;
  const visibleCatalogItems = catalogItems.filter((item) => {
    if (!normalizedSearch) return true;
    return [item.label, item.description, ...item.tags, ...item.variants.map((variant) => variant.label)]
      .map(localize)
      .join(" ")
      .toLocaleLowerCase()
      .includes(normalizedSearch);
  });

  const placeCatalogItem = (item: ObjectCatalogItem, variant: ObjectCatalogVariant) => {
    addMapObject(item.create({ document, localize }, variant.id));
    setVariantItemId(null);
  };

  return (
    <aside className="tool-palette">
      <div className="panel-tabs" role="tablist" aria-label={t("palette.label")}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "objects"}
          className={tab === "objects" ? "is-active" : ""}
          onClick={() => setTab("objects")}
        >
          <Warehouse size={16} />
          {t("palette.objects")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "terrain"}
          className={tab === "terrain" ? "is-active" : ""}
          onClick={() => setTab("terrain")}
        >
          <Paintbrush size={16} />
          {t("palette.terrain")}
        </button>
      </div>

      {tab === "objects" ? (
        <div className="palette-content">
          <section>
            <div className="section-heading">
              <span>{t("palette.add")}</span>
              <Plus size={14} />
            </div>
            <label className="catalog-search">
              <Search size={15} />
              <input
                type="search"
                value={catalogSearch}
                onChange={(event) => {
                  setCatalogSearch(event.target.value);
                  setVariantItemId(null);
                }}
                placeholder={t("catalog.searchPlaceholder")}
                aria-label={t("catalog.search")}
              />
            </label>
            <div className="catalog-browser">
              {objectCatalogCategories.map((category) => {
                const categoryItems = visibleCatalogItems.filter(
                  (item) => item.categoryId === category.id,
                );
                if (categoryItems.length === 0) return null;

                return (
                  <details className="catalog-category" key={category.id} open={Boolean(normalizedSearch) || undefined}>
                    <summary>
                      <span>{localize(category.label)}</span>
                      <span className="count-badge">{categoryItems.length}</span>
                    </summary>
                    <div className="catalog-grid">
                      {categoryItems.map((item) => {
                        const previewVariant = item.variants[0];
                        const showsVariants = item.variants.length > 1;
                        return (
                          <div className="catalog-entry" key={item.id}>
                            <button
                              type="button"
                              className={`catalog-card ${variantItemId === item.id ? "is-active" : ""}`}
                              aria-label={localize(item.label)}
                              title={localize(item.description)}
                              onClick={() => {
                                if (showsVariants) setVariantItemId((current) => current === item.id ? null : item.id);
                                else placeCatalogItem(item, previewVariant);
                              }}
                            >
                              <span className="catalog-thumbnail">
                                <CatalogPreview item={item} variant={previewVariant} />
                                {showsVariants && <small>{item.variants.length}</small>}
                              </span>
                              <span>{localize(item.label)}</span>
                            </button>
                            {showsVariants && variantItemId === item.id && (
                              <div className="catalog-variant-picker" role="group" aria-label={t("catalog.chooseVariant")}>
                                {item.variants.map((variant) => (
                                  <button
                                    type="button"
                                    key={variant.id}
                                    aria-label={localize(variant.label)}
                                    title={localize(variant.label)}
                                    onClick={() => placeCatalogItem(item, variant)}
                                  >
                                    <CatalogPreview item={item} variant={variant} />
                                    <span>{localize(variant.label)}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
              {visibleCatalogItems.length === 0 && (
                <p className="catalog-empty">{t("catalog.noResults")}</p>
              )}
            </div>
          </section>

        </div>
      ) : (
        <div className="palette-content terrain-brush-panel">
          <section>
            <div className="section-heading">
              <span>{t("terrain.paint")}</span>
              <Paintbrush size={14} />
            </div>
            <div className="terrain-preset-grid">
              {terrainBrushTypes.map((type) => (
                <button
                  type="button"
                  key={type}
                  disabled={terrainLocked}
                  className={activeTerrainBrush?.type === type ? "is-active" : ""}
                  aria-pressed={activeTerrainBrush?.type === type}
                  onClick={() => {
                    setLayerVisible("terrain", true);
                    setActiveTerrainBrush({ type, sizeMeters: brushSizeMeters });
                  }}
                >
                  <i
                    aria-hidden="true"
                    style={{
                      background: `linear-gradient(135deg, ${terrainStyles[type].detail}, ${terrainStyles[type].color})`,
                      borderColor: terrainStyles[type].edge,
                    }}
                  />
                  <span>{t(terrainTypeKeys[type])}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <label className="brush-size-field">
              <span>{t("terrain.brushSize")}</span>
              <select
                value={brushSizeMeters}
                onChange={(event) => {
                  const sizeMeters = Number(event.target.value);
                  setBrushSizeMeters(sizeMeters);
                  if (activeTerrainBrush) {
                    setActiveTerrainBrush({ ...activeTerrainBrush, sizeMeters });
                  }
                }}
              >
                {terrainBrushSizes.map((size) => (
                  <option key={size} value={size}>
                    {t("terrain.meters", { size })}
                  </option>
                ))}
              </select>
            </label>
            <p className="terrain-brush-hint">{t("terrain.hint")}</p>
            {activeTerrainBrush && (
              <button
                type="button"
                className="terrain-brush-stop"
                onClick={() => setActiveTerrainBrush(null)}
              >
                {t("terrain.stopPainting")}
              </button>
            )}
          </section>
        </div>
      )}
    </aside>
  );
}
