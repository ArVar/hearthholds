import type { LocalizedText } from "../i18n/types";
import type { EditorDocument, PlaceableMapObject } from "./types";
import {
  getBuildingPaletteTemplates,
  getVisualAsset,
  type BuildingCatalogCategory,
  type BuildingPaletteIcon,
} from "./visualAssets";

export type CatalogCategoryId =
  | BuildingCatalogCategory
  | "infrastructure.paths"
  | "infrastructure.fortifications"
  | "areas.agriculture"
  | "areas.nature"
  | "areas.properties"
  | "equipment.utilities"
  | "equipment.decorations";

export type CatalogIcon =
  | BuildingPaletteIcon
  | "route"
  | "fence"
  | "door-open"
  | "trees"
  | "map-pin"
  | "flame"
  | "package";

export type ObjectCatalogVariant = {
  id: string;
  label: LocalizedText;
  thumbnailUrl?: string;
  swatch?: string;
};

export type ObjectCatalogContext = {
  document: EditorDocument;
  localize: (text: LocalizedText) => string;
};

export type ObjectCatalogItem = {
  id: string;
  categoryId: CatalogCategoryId;
  label: LocalizedText;
  description: LocalizedText;
  tags: LocalizedText[];
  icon: CatalogIcon;
  variants: ObjectCatalogVariant[];
  create: (context: ObjectCatalogContext, variantId: string) => PlaceableMapObject;
};

export const objectCatalogCategories: Array<{
  id: CatalogCategoryId;
  label: LocalizedText;
}> = [
  { id: "buildings.housing", label: { de: "Wohnen", en: "Housing" } },
  { id: "buildings.craft", label: { de: "Handwerk", en: "Craft" } },
  { id: "buildings.supply", label: { de: "Versorgung", en: "Supply" } },
  { id: "buildings.community", label: { de: "Gemeinschaft", en: "Community" } },
  { id: "buildings.defense", label: { de: "Verteidigung", en: "Defense" } },
  { id: "infrastructure.paths", label: { de: "Wege", en: "Paths" } },
  {
    id: "infrastructure.fortifications",
    label: { de: "Befestigungen", en: "Fortifications" },
  },
  { id: "areas.agriculture", label: { de: "Landwirtschaft", en: "Agriculture" } },
  { id: "areas.nature", label: { de: "Natur", en: "Nature" } },
  { id: "areas.properties", label: { de: "Grundstücke", en: "Properties" } },
  { id: "equipment.utilities", label: { de: "Dorf-Ausstattung", en: "Village utilities" } },
  { id: "equipment.decorations", label: { de: "Dekoration", en: "Decoration" } },
];

function makeId(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}`;
}

function centerOf(document: EditorDocument) {
  return { x: document.map.width / 2, y: document.map.height / 2 };
}

const defaultVariant = (thumbnailUrl?: string): ObjectCatalogVariant => ({
  id: "default",
  label: { de: "Standard", en: "Default" },
  thumbnailUrl,
});

function getStaticCatalogItems(): ObjectCatalogItem[] {
  const wheatFieldUrl = getVisualAsset("environment/zone/wheat-field")?.albedoUrl;
  const wellUrl = getVisualAsset("environment/marker/well")?.albedoUrl;
  const fireUrl = getVisualAsset("environment/marker/fire")?.albedoUrl;
  const pastureUrl = getVisualAsset("environment/prop/pasture")?.albedoUrl;
  const timberStackUrl = getVisualAsset("environment/prop/timber-stack")?.albedoUrl;
  const utilityUrl = getVisualAsset("environment/prop/village-utility")?.albedoUrl;
  const woodpileUrl = getVisualAsset("environment/prop/woodpile")?.albedoUrl;

  return [
    {
      id: "road",
      categoryId: "infrastructure.paths",
      label: { de: "Weg", en: "Road" },
      description: { de: "Editierbarer Straßen- oder Wegverlauf", en: "Editable road or path" },
      tags: [{ de: "Straße Pfad Infrastruktur", en: "street trail infrastructure" }],
      icon: "route",
      variants: [defaultVariant()],
      create: ({ document, localize }) => {
        const center = centerOf(document);
        return {
          kind: "path",
          value: {
            id: makeId("path"),
            name: localize({ de: "Neuer Weg", en: "New road" }),
            kind: "road",
            points: [center.x - 100, center.y, center.x, center.y, center.x + 100, center.y + 40],
            width: 14,
            color: "#aa906d",
            notes: "",
          },
        };
      },
    },
    {
      id: "fortification",
      categoryId: "infrastructure.fortifications",
      label: { de: "Befestigung", en: "Fortification" },
      description: { de: "Lineare Schutzanlage mit Toren", en: "Linear defensive structure with gates" },
      tags: [{ de: "Palisade Mauer Wall Zaun", en: "palisade wall fence" }],
      icon: "fence",
      variants: [
        { id: "palisade", label: { de: "Holzpalisade", en: "Wooden palisade" }, swatch: "#8d623f" },
        { id: "wall", label: { de: "Steinmauer", en: "Stone wall" }, swatch: "#74797a" },
      ],
      create: ({ document, localize }, variantId) => {
        const style = variantId === "wall" ? "wall" : "palisade";
        return {
          kind: "barrier",
          value: {
            id: makeId(style),
            name: localize(
              style === "wall"
                ? { de: "Neue Steinmauer", en: "New stone wall" }
                : { de: "Neue Holzpalisade", en: "New wooden palisade" },
            ),
            status: "planned",
            center: centerOf(document),
            rotation: 0,
            thickness: style === "wall" ? 16 : 12,
            style,
            segments: [{ kind: "line", from: { x: -100, y: 0 }, to: { x: 100, y: 0 } }],
            gates: [],
            notes: "",
          },
        };
      },
    },
    {
      id: "gate",
      categoryId: "infrastructure.fortifications",
      label: { de: "Tor", en: "Gate" },
      description: {
        de: "Frei platzierbares und editierbares Befestigungstor",
        en: "Freely placeable and editable fortification gate",
      },
      tags: [{ de: "Tor Eingang Palisade Mauer", en: "gate entrance palisade wall" }],
      icon: "door-open",
      variants: [
        { id: "palisade", label: { de: "Holztor", en: "Wooden gate" }, swatch: "#8d623f" },
        { id: "wall", label: { de: "Steintor", en: "Stone gate" }, swatch: "#74797a" },
      ],
      create: ({ document, localize }, variantId) => ({
        kind: "gate",
        value: {
          id: makeId("gate"),
          name: localize({ de: "Neues Tor", en: "New gate" }),
          position: centerOf(document),
          rotation: 0,
          width: 48,
          kind: "main",
          style: variantId === "wall" ? "wall" : "palisade",
          notes: "",
        },
      }),
    },
    {
      id: "field",
      categoryId: "areas.agriculture",
      label: { de: "Feld", en: "Field" },
      description: { de: "Editierbare landwirtschaftliche Fläche", en: "Editable agricultural area" },
      tags: [{ de: "Acker Weizen Ernte", en: "farmland wheat harvest" }],
      icon: "sprout",
      variants: [defaultVariant(wheatFieldUrl)],
      create: ({ document, localize }) => {
        const center = centerOf(document);
        return {
          kind: "zone",
          value: {
            id: makeId("field"), name: localize({ de: "Neues Feld", en: "New field" }), type: "field",
            x: center.x, y: center.y, width: 180, height: 120, rotation: 0, color: "#b8a34a",
          },
        };
      },
    },
    {
      id: "forest",
      categoryId: "areas.nature",
      label: { de: "Waldgebiet", en: "Forest area" },
      description: { de: "Editierbare Waldzone mit einstellbarer Dichte", en: "Editable forest zone with adjustable density" },
      tags: [{ de: "Wald Bäume Gehölz", en: "forest trees woodland" }],
      icon: "trees",
      variants: [{ ...defaultVariant(), swatch: "#5f7c45" }],
      create: ({ document, localize }) => {
        const center = centerOf(document);
        return {
          kind: "zone",
          value: {
            id: makeId("forest"), name: localize({ de: "Neues Waldgebiet", en: "New forest area" }), type: "forest",
            x: center.x, y: center.y, width: 220, height: 160, rotation: 0, color: "#507043", density: 0.55,
          },
        };
      },
    },
    {
      id: "property",
      categoryId: "areas.properties",
      label: { de: "Grundstück", en: "Property" },
      description: { de: "Abgegrenzte Planungs- oder Besitzfläche", en: "Delimited planning or ownership area" },
      tags: [{ de: "Parzelle Bauplatz Grenze", en: "plot lot boundary" }],
      icon: "map-pin",
      variants: [{ ...defaultVariant(), swatch: "#9d8356" }],
      create: ({ document, localize }) => {
        const center = centerOf(document);
        return {
          kind: "zone",
          value: {
            id: makeId("property"), name: localize({ de: "Neues Grundstück", en: "New property" }), type: "property",
            x: center.x, y: center.y, width: 180, height: 130, rotation: 0, color: "#9d8356",
          },
        };
      },
    },
    {
      id: "well",
      categoryId: "equipment.utilities",
      label: { de: "Dorfbrunnen", en: "Village well" },
      description: { de: "Zentraler Brunnen der Siedlung", en: "Settlement well" },
      tags: [{ de: "Wasser Versorgung Brunnen", en: "water supply well" }],
      icon: "map-pin",
      variants: [defaultVariant(wellUrl)],
      create: ({ document, localize }) => ({
        kind: "marker",
        value: { id: makeId("well"), name: localize({ de: "Neuer Dorfbrunnen", en: "New village well" }), type: "well", position: centerOf(document), width: 54, height: 54 },
      }),
    },
    {
      id: "fire-pit",
      categoryId: "equipment.utilities",
      label: { de: "Feuerstelle", en: "Fire pit" },
      description: { de: "Gemeinschaftliche Feuerstelle", en: "Communal fire pit" },
      tags: [{ de: "Feuer Lagerfeuer Treffpunkt", en: "fire campfire gathering" }],
      icon: "flame",
      variants: [defaultVariant(fireUrl)],
      create: ({ document, localize }) => ({
        kind: "marker",
        value: { id: makeId("fire"), name: localize({ de: "Neue Feuerstelle", en: "New fire pit" }), type: "fire", position: centerOf(document), width: 58, height: 58 },
      }),
    },
    {
      id: "pasture",
      categoryId: "equipment.decorations",
      label: { de: "Weide", en: "Pasture" },
      description: { de: "Dekorative Weidefläche mit Tieren", en: "Decorative pasture with livestock" },
      tags: [{ de: "Tiere Vieh Weide", en: "animals livestock pasture" }],
      icon: "package",
      variants: [defaultVariant(pastureUrl)],
      create: ({ document, localize }) => ({
        kind: "decoration",
        value: { id: makeId("pasture"), name: localize({ de: "Neue Weide", en: "New pasture" }), assetId: "environment/prop/pasture", position: centerOf(document), width: 140, height: 100, rotation: 0 },
      }),
    },
    {
      id: "village-utility",
      categoryId: "equipment.decorations",
      label: { de: "Dorfzubehör", en: "Village props" },
      description: { de: "Karren, Fässer und Alltagsgegenstände", en: "Carts, barrels and everyday props" },
      tags: [{ de: "Karren Fässer Zubehör", en: "cart barrels props" }],
      icon: "package",
      variants: [defaultVariant(utilityUrl)],
      create: ({ document, localize }) => ({
        kind: "decoration",
        value: { id: makeId("utility"), name: localize({ de: "Neues Dorfzubehör", en: "New village props" }), assetId: "environment/prop/village-utility", position: centerOf(document), width: 120, height: 90, rotation: 0 },
      }),
    },
    {
      id: "woodpile",
      categoryId: "equipment.decorations",
      label: { de: "Holzstapel", en: "Woodpile" },
      description: {
        de: "Gestapelte Baumstämme für Hof, Lager oder Werkstatt",
        en: "Stacked logs for a yard, storehouse, or workshop",
      },
      tags: [{ de: "Holz Baumstämme Brennholz Lager", en: "wood logs firewood storage" }],
      icon: "package",
      variants: [
        {
          id: "short-logs",
          label: { de: "Kurzholz", en: "Short logs" },
          thumbnailUrl: woodpileUrl,
        },
        {
          id: "long-timber",
          label: { de: "Langholz", en: "Long timber" },
          thumbnailUrl: timberStackUrl,
        },
      ],
      create: ({ document, localize }, variantId) => {
        const isLongTimber = variantId === "long-timber";
        return {
          kind: "decoration",
          value: {
            id: makeId("woodpile"),
            name: localize(
              isLongTimber
                ? { de: "Neuer Langholzstapel", en: "New timber stack" }
                : { de: "Neuer Holzstapel", en: "New woodpile" },
            ),
            assetId: isLongTimber
              ? "environment/prop/timber-stack"
              : "environment/prop/woodpile",
            position: centerOf(document),
            width: isLongTimber ? 180 : 120,
            height: 90,
            rotation: 0,
          },
        };
      },
    },
  ];
}

export function getObjectCatalogItems(): ObjectCatalogItem[] {
  const buildings: ObjectCatalogItem[] = getBuildingPaletteTemplates().map((template) => ({
    id: `building-${template.assetTypeId}`,
    categoryId: template.category,
    label: template.label,
    description: template.subtitle,
    tags: template.tags,
    icon: template.icon,
    variants: template.catalogVariants.map((variant, index) => ({
      ...variant,
      label:
        template.catalogVariants.length === 1
          ? { de: "Standard", en: "Default" }
          : { de: `Variante ${index + 1}`, en: `Variant ${index + 1}` },
    })),
    create: ({ document, localize }, variantId) => ({
      kind: "building",
      value: {
        id: makeId(template.assetTypeId),
        name: localize({ de: `Neues ${template.label.de}`, en: `New ${template.label.en}` }),
        type: template.assetTypeId,
        status: "planned",
        x: document.map.width / 2,
        y: document.map.height / 2,
        width: template.width,
        height: template.height,
        rotation: 0,
        shape: template.shape,
        color: template.color,
        subtitle: localize(template.subtitle),
        notes: "",
        assetTypeId: template.assetTypeId,
        visualVariant: variantId === "default" ? undefined : variantId,
        upgradeTier: template.upgradeTier,
        housingCapacity: template.housingCapacity,
        operation: template.operation ? structuredClone(template.operation) : undefined,
      },
    }),
  }));

  return [...buildings, ...getStaticCatalogItems()];
}
