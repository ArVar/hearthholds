import { z } from "zod";
import {
  currentSchemaVersion,
  forestDensityRange,
  mapLayerIds,
  resourceSourceTypes,
  terrainTypes,
} from "./types";
import { defaultMapLayerStates } from "./scene";

const pointSchema = z.object({ x: z.number(), y: z.number() });
const constructionStageSchema = z.enum(["foundation", "masonry", "completion"]);
const workforceSchema = z.object({
  minWorkers: z.number().int().nonnegative(),
  maxWorkers: z.number().int().nonnegative(),
  residentWorkers: z.number().int().nonnegative(),
  hiredWorkers: z.number().int().nonnegative(),
  wagePerCycle: z.number().nonnegative(),
  wageCurrencyId: z.string().min(1),
}).superRefine((workforce, context) => {
  if (workforce.minWorkers > workforce.maxWorkers) {
    context.addIssue({
      code: "custom",
      path: ["minWorkers"],
      message: "Minimum workforce must not exceed maximum workforce",
    });
  }
  if (workforce.residentWorkers + workforce.hiredWorkers > workforce.maxWorkers) {
    context.addIssue({
      code: "custom",
      path: ["residentWorkers"],
      message: "Assigned workforce must not exceed maximum workforce",
    });
  }
});

const productionOutputsSchema = z.array(z.object({
  resourceId: z.string().min(1),
  allocation: z.number().min(0).max(1),
  carry: z.number().min(0).max(1),
})).refine(
  (outputs) =>
    outputs.length === 0
    || Math.abs(outputs.reduce((total, output) => total + output.allocation, 0) - 1)
      < 0.000001,
  "Production output allocations must total 1.",
);

const treasuryLedgerEntrySchema = z.object({
  id: z.string().min(1),
  cycle: z.number().int().nonnegative(),
  type: z.enum(["income", "expense"]),
  sourceId: z.string().min(1),
  label: z.string().min(1),
  amountBaseUnits: z.number().int().nonnegative(),
});

const buildPhaseSchema = z.object({
  name: z.string(),
  description: z.string(),
  requirements: z.array(
    z.object({
      resourceId: z.string(),
      amount: z.number().nonnegative(),
    }),
  ),
  workersRequired: z.number().int().nonnegative(),
  prerequisites: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
    }),
  ),
});

const pathAnchorSchema = z.object({
  x: z.number(),
  y: z.number(),
  mode: z.enum(["corner", "smooth"]),
  handleIn: pointSchema.optional(),
  handleOut: pointSchema.optional(),
});

const buildingSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  status: z.enum(["existing", "planned", "construction", "complete", "damaged"]),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number(),
  shape: z.enum(["rect", "circle"]),
  color: z.string(),
  subtitle: z.string(),
  notes: z.string(),
  assetTypeId: z.string().optional(),
  visualVariant: z.string().optional(),
  upgradeTier: z.enum(["base", "extended", "master"]),
  housingCapacity: z.number().int().nonnegative(),
  operation: z.object({
    enabled: z.boolean(),
    maxProduction: z.number().nonnegative(),
    incomePerCycle: z.number().nonnegative(),
    incomeCurrencyId: z.string().min(1),
    outputs: productionOutputsSchema,
    workforce: workforceSchema,
  }).optional(),
});

const segmentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("line"), from: pointSchema, to: pointSchema }),
  z.object({
    kind: z.literal("bezier"),
    from: pointSchema,
    to: pointSchema,
    handleFrom: pointSchema,
    handleTo: pointSchema,
    fromMode: z.enum(["corner", "smooth"]),
    toMode: z.enum(["corner", "smooth"]),
  }),
  z.object({
    kind: z.literal("arc"),
    center: pointSchema,
    radius: z.number().positive(),
    startAngle: z.number(),
    endAngle: z.number(),
    counterClockwise: z.boolean(),
  }),
]);

const gateSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: pointSchema,
  rotation: z.number(),
  width: z.number().positive(),
  kind: z.enum(["main", "service"]),
  style: z.enum(["palisade", "wall"]).optional(),
  notes: z.string().optional(),
});

const palisadeSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["existing", "planned", "construction", "damaged"]),
  center: pointSchema,
  rotation: z.number(),
  thickness: z.number().positive(),
  style: z.enum(["palisade", "wall"]).optional(),
  segments: z.array(segmentSchema),
  gates: z.array(gateSchema),
  notes: z.string(),
});

export const editorDocumentSchema = z.object({
  schemaVersion: z.literal(currentSchemaVersion),
  id: z.string(),
  settlementName: z.string(),
  ruleset: z.string(),
  mode: z.enum(["setup", "campaign"]),
  campaignCycle: z.number().int().nonnegative().default(0),
  population: z.object({
    permanent: z.number().int().nonnegative(),
    named: z.number().int().nonnegative(),
    workingResidents: z.number().int().nonnegative(),
    temporaryLabel: z.string(),
  }),
  treasury: z.object({
    balanceBaseUnits: z.number().int().nonnegative(),
    displayCurrencyId: z.string().min(1),
    defaultWagePerCycle: z.number().nonnegative(),
    defaultWageCurrencyId: z.string().min(1),
    recruitmentCostPerResident: z.number().nonnegative(),
    recruitmentCurrencyId: z.string().min(1),
    ledger: z.array(treasuryLedgerEntrySchema),
  }),
  map: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    grid: z.object({
      size: z.number().positive(),
      distance: z.number().positive(),
      unit: z.literal("m"),
      majorEvery: z.number().int().positive(),
      color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
      opacity: z.number().min(0.1).max(1).optional(),
    }),
    scene: z.object({
      layers: z.array(z.object({
        id: z.enum(mapLayerIds),
        visible: z.boolean(),
        locked: z.boolean(),
      })).default(defaultMapLayerStates),
      objects: z.array(z.object({
        id: z.string(),
        visible: z.boolean(),
        locked: z.boolean(),
      })).default([]),
      groups: z.array(z.object({
        id: z.string(),
        name: z.string(),
        objectIds: z.array(z.string()),
        visible: z.boolean(),
        locked: z.boolean(),
      })).default([]),
      objectOrder: z.array(z.string()).default([]),
    }).default({
      layers: defaultMapLayerStates,
      objects: [],
      groups: [],
      objectOrder: [],
    }),
    referenceAssetId: z.string().optional(),
    terrainStrokes: z.array(
      z.object({
        id: z.string(),
        type: z.enum(terrainTypes),
        points: z.array(z.number()).min(4),
        width: z.number().positive(),
      }),
    ),
    buildings: z.array(buildingSchema),
    palisades: z.array(palisadeSchema),
    gates: z.array(gateSchema).default([]),
    zones: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.enum(["field", "forest", "property"]),
        x: z.number(),
        y: z.number(),
        width: z.number().positive(),
        height: z.number().positive(),
        rotation: z.number(),
        color: z.string(),
        density: z.number()
          .min(forestDensityRange.min)
          .max(forestDensityRange.max)
          .optional(),
      }),
    ),
    paths: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        kind: z.enum(["road", "river", "bridge"]),
        points: z.array(z.number()),
        width: z.number().positive(),
        color: z.string(),
        notes: z.string().optional(),
        anchors: z.array(pathAnchorSchema).optional(),
      }),
    ),
    markers: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.enum(["well", "fire"]),
        position: pointSchema,
        width: z.number().positive(),
        height: z.number().positive(),
      }),
    ),
    decorations: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        assetId: z.string(),
        position: pointSchema,
        width: z.number().positive(),
        height: z.number().positive(),
        rotation: z.number(),
      }),
    ),
  }),
  resources: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      total: z.number(),
      reserved: z.number(),
      unit: z.string(),
      source: z.string(),
      consumable: z.boolean(),
    }),
  ),
  resourceSources: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum(resourceSourceTypes),
      resourceId: z.string(),
      enabled: z.boolean(),
      maxProduction: z.number().nonnegative(),
      workforce: workforceSchema,
      travelTime: z.string(),
      transportCapacity: z.number().nonnegative(),
      notes: z.string(),
    }),
  ).default([]),
  buildPlans: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      buildingType: z.string(),
      phases: z.object({
        foundation: buildPhaseSchema,
        masonry: buildPhaseSchema,
        completion: buildPhaseSchema,
      }),
    }),
  ),
  projects: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      buildingId: z.string(),
      buildPlanId: z.string(),
      status: z.enum(["active", "blocked", "planned", "complete"]),
      currentStage: constructionStageSchema,
      phaseProgress: z.number().min(0).max(100),
      resourcesReserved: z.boolean(),
      workforce: workforceSchema,
      fulfilledPrerequisiteIds: z.array(z.string()),
    }),
  ),
  updatedAt: z.string(),
});
