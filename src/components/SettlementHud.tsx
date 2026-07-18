import * as Tooltip from "@radix-ui/react-tooltip";
import { Coins, House, UserPlus, Users } from "lucide-react";
import { formatBaseCurrency } from "../domain/currency";
import {
  getResourceFlowBreakdown,
  isResourceVisibleInHud,
} from "../domain/resourceSources";
import {
  resourceCategoryDefinitions,
  type ResourceCategoryDefinition,
} from "../domain/resourceCategories";
import type { EditorDocument, ResourceSummary } from "../domain/types";
import { getTreasuryCycleBalance } from "../domain/treasury";
import { useI18n } from "../i18n/I18nProvider";
import { localizeResourceName } from "../i18n/domainLabels";
import { getWorkforceSummary } from "../domain/workforce";
import { useEditorStore } from "../store/editorStore";
import { ResourceArtwork } from "./ResourceArtwork";

function ResourceTooltipContent({
  document,
  resource,
}: {
  document: EditorDocument;
  resource: ResourceSummary;
}) {
  const { t } = useI18n();
  const flow = getResourceFlowBreakdown(document, resource.id);

  return (
    <Tooltip.Portal>
      <Tooltip.Content
        className="tooltip resource-flow-tooltip"
        sideOffset={8}
        collisionPadding={8}
      >
        <header>
          <strong>{localizeResourceName(resource, t)}</strong>
          <span>
            {resource.total - resource.reserved} {t("resources.available")}
          </span>
        </header>
        <div className="resource-tooltip-stock">
          <span>{t("resources.total")} <strong>{resource.total}</strong></span>
          <span>{t("resources.reservedShort")} <strong>{resource.reserved}</strong></span>
        </div>
        <section>
          <h3>
            {t("resources.production")} <strong>+{flow.productionTotal} / {t("resources.dayShort")}</strong>
          </h3>
          {flow.production.length > 0 ? flow.production.map((entry) => (
            <div key={entry.id}>
              <span>{entry.label}</span>
              {entry.amount !== undefined && <strong>+{entry.amount}</strong>}
            </div>
          )) : <small>{t("resources.noProduction")}</small>}
        </section>
        <section>
          <h3>
            {t("resources.consumption")} <strong>−{flow.consumptionTotal}</strong>
          </h3>
          {flow.consumption.length > 0 ? flow.consumption.map((entry) => (
            <div key={entry.id}>
              <span>{entry.label || t("resources.otherReservations")}</span>
              {entry.amount !== undefined && <strong>−{entry.amount}</strong>}
            </div>
          )) : <small>{t("resources.noConsumption")}</small>}
        </section>
        <Tooltip.Arrow className="tooltip-arrow" />
      </Tooltip.Content>
    </Tooltip.Portal>
  );
}

function ResourceCategoryTooltipContent({
  document,
  category,
  resources,
}: {
  document: EditorDocument;
  category: ResourceCategoryDefinition;
  resources: ResourceSummary[];
}) {
  const { t, localize } = useI18n();
  const resourceFlows = resources.map((resource) => ({
    resource,
    flow: getResourceFlowBreakdown(document, resource.id),
  }));
  const producedResources = resourceFlows.filter(
    ({ flow }) => flow.production.length > 0,
  );
  const availableTotal = resources.reduce(
    (total, resource) => total + resource.total - resource.reserved,
    0,
  );

  return (
    <Tooltip.Portal>
      <Tooltip.Content
        className="tooltip resource-flow-tooltip resource-category-tooltip"
        sideOffset={8}
        collisionPadding={8}
      >
        <header>
          <strong>{localize(category.label)}</strong>
          <span>{availableTotal} {t("resources.available")}</span>
        </header>
        <section>
          <h3>
            {t("resources.production")}
            <strong>
              +{producedResources.reduce(
                (total, { flow }) => total + flow.productionTotal,
                0,
              )} / {t("resources.dayShort")}
            </strong>
          </h3>
          {producedResources.length > 0 ? producedResources.map(({ resource, flow }) => (
            <div key={resource.id}>
              <span>{localizeResourceName(resource, t)}</span>
              <strong>+{flow.productionTotal}</strong>
            </div>
          )) : <small>{t("resources.noProduction")}</small>}
        </section>
        <section className="resource-category-stock">
          <h3>{t("resources.stock")}</h3>
          {resources.map((resource) => (
            <div key={resource.id}>
              <span>{localizeResourceName(resource, t)}</span>
              <strong>
                {resource.total - resource.reserved}
                {resource.reserved > 0 ? ` (−${resource.reserved})` : ""}
              </strong>
            </div>
          ))}
        </section>
        <Tooltip.Arrow className="tooltip-arrow" />
      </Tooltip.Content>
    </Tooltip.Portal>
  );
}

function PopulationTooltipContent({ document }: { document: EditorDocument }) {
  const { t } = useI18n();
  const summary = getWorkforceSummary(document);
  return (
    <Tooltip.Portal>
      <Tooltip.Content
        className="tooltip resource-flow-tooltip population-flow-tooltip"
        sideOffset={8}
        collisionPadding={8}
      >
        <header>
          <strong>{t("resources.populationAndWorkforce")}</strong>
          <span>{summary.freeResidents} {t("resources.freeWorkers")}</span>
        </header>
        <section>
          <div><span><Users size={13} /> {t("resources.residents")}</span><strong>{summary.residents}</strong></div>
          <div><span><House size={13} /> {t("resources.housing")}</span><strong>{summary.residents}/{summary.housingCapacity}</strong></div>
          <div><span><Users size={13} /> {t("resources.assignedWorkers")}</span><strong>{summary.assignedResidents}/{summary.workingResidents}</strong></div>
          <div><span><UserPlus size={13} /> {t("resources.hiredWorkers")}</span><strong>+{summary.hiredWorkers}</strong></div>
          <div><span><Coins size={13} /> {t("resources.dailyPayroll")}</span><strong>{formatBaseCurrency(document.ruleset, summary.cyclePayrollBaseUnits)}</strong></div>
        </section>
        <Tooltip.Arrow className="tooltip-arrow" />
      </Tooltip.Content>
    </Tooltip.Portal>
  );
}

function TreasuryTooltipContent({ document }: { document: EditorDocument }) {
  const { t } = useI18n();
  const cycleBalance = getTreasuryCycleBalance(document);
  return (
    <Tooltip.Portal>
      <Tooltip.Content
        className="tooltip resource-flow-tooltip treasury-flow-tooltip"
        sideOffset={8}
        collisionPadding={8}
      >
        <header>
          <strong>{t("resources.treasury")}</strong>
          <span>{formatBaseCurrency(
            document.ruleset,
            document.treasury.balanceBaseUnits,
            document.treasury.displayCurrencyId,
          )}</span>
        </header>
        <section>
          <div>
            <span>{t("resources.cycleIncome")}</span>
            <strong>+{formatBaseCurrency(document.ruleset, cycleBalance.incomeBaseUnits)}</strong>
          </div>
          <div>
            <span>{t("resources.cycleExpenses")}</span>
            <strong>−{formatBaseCurrency(document.ruleset, cycleBalance.expenseBaseUnits)}</strong>
          </div>
          <div>
            <span>{t("resources.cycleNet")}</span>
            <strong>
              {cycleBalance.netBaseUnits >= 0 ? "+" : "−"}
              {formatBaseCurrency(document.ruleset, Math.abs(cycleBalance.netBaseUnits))}
            </strong>
          </div>
        </section>
        <Tooltip.Arrow className="tooltip-arrow" />
      </Tooltip.Content>
    </Tooltip.Portal>
  );
}

export function SettlementHud({
  presentation = false,
  activeResourceId = null,
  onOpenResources,
}: {
  presentation?: boolean;
  activeResourceId?: string | null;
  onOpenResources?: (resourceId: string | null) => void;
}) {
  const { t, localize } = useI18n();
  const document = useEditorStore((state) => state.document);
  const { population } = document;
  const visibleResources = document.resources.filter((resource) =>
    isResourceVisibleInHud(document, resource.id),
  );
  const resourceCategories = resourceCategoryDefinitions.flatMap((category) => {
    const resources = visibleResources.filter((resource) =>
      category.resourceIds.includes(resource.id),
    );
    return resources.length > 0 ? [{ category, resources }] : [];
  });
  const categorizedResourceIds = new Set(
    resourceCategoryDefinitions.flatMap((category) => category.resourceIds),
  );
  const resources = visibleResources.filter(
    (resource) => !categorizedResourceIds.has(resource.id),
  );
  const populationContent = (
    <>
      <ResourceArtwork resourceId="population" label={t("resources.populationAndWorkforce")} />
      <strong>{population.permanent}</strong>
    </>
  );

  return (
    <section
      className={`settlement-hud ${presentation ? "is-presentation" : ""}`}
      aria-label={t("resources.overview")}
    >
      <Tooltip.Root delayDuration={250}>
        <Tooltip.Trigger asChild>
          {onOpenResources ? (
            <button
              type="button"
              className="settlement-hud-item is-population"
              aria-label={t("resources.populationAndWorkforce")}
              onClick={() => onOpenResources(null)}
            >
              {populationContent}
            </button>
          ) : (
            <div className="settlement-hud-item is-population">
              {populationContent}
            </div>
          )}
        </Tooltip.Trigger>
        <PopulationTooltipContent document={document} />
      </Tooltip.Root>
      <Tooltip.Root delayDuration={250}>
        <Tooltip.Trigger asChild>
          {onOpenResources ? (
            <button
              type="button"
              className="settlement-hud-item is-treasury"
              aria-label={t("resources.treasury")}
              onClick={() => onOpenResources(null)}
            >
              <ResourceArtwork resourceId="treasury" label={t("resources.treasury")} />
              <strong>{formatBaseCurrency(document.ruleset, document.treasury.balanceBaseUnits, document.treasury.displayCurrencyId)}</strong>
            </button>
          ) : (
            <div className="settlement-hud-item is-treasury" aria-label={t("resources.treasury")}>
              <ResourceArtwork resourceId="treasury" label={t("resources.treasury")} />
              <strong>{formatBaseCurrency(document.ruleset, document.treasury.balanceBaseUnits, document.treasury.displayCurrencyId)}</strong>
            </div>
          )}
        </Tooltip.Trigger>
        <TreasuryTooltipContent document={document} />
      </Tooltip.Root>
      {resourceCategories.map(({ category, resources: categoryResources }) => {
        const categoryLabel = localize(category.label);
        const categoryActive = activeResourceId !== null
          && category.resourceIds.includes(activeResourceId);
        const categoryAvailable = categoryResources.reduce(
          (total, resource) => total + resource.total - resource.reserved,
          0,
        );
        const content = (
          <>
            <ResourceArtwork resourceId={category.id} label={categoryLabel} />
            <strong>{categoryAvailable}</strong>
          </>
        );

        return (
          <Tooltip.Root key={category.id} delayDuration={250}>
            <Tooltip.Trigger asChild>
              {onOpenResources ? (
                <button
                  type="button"
                  className={`settlement-hud-item ${categoryActive ? "is-active" : ""}`}
                  aria-label={`${categoryLabel}: ${categoryAvailable} ${t("resources.available")}`}
                  onClick={() => onOpenResources(null)}
                >
                  {content}
                </button>
              ) : (
                <div
                  className="settlement-hud-item"
                  aria-label={`${categoryLabel}: ${categoryAvailable} ${t("resources.available")}`}
                >
                  {content}
                </div>
              )}
            </Tooltip.Trigger>
            <ResourceCategoryTooltipContent
              document={document}
              category={category}
              resources={categoryResources}
            />
          </Tooltip.Root>
        );
      })}
      {resources.map((resource) => {
        const available = resource.total - resource.reserved;
        const resourceLabel = localizeResourceName(resource, t);
        const content = (
          <>
            <ResourceArtwork resourceId={resource.id} label={resourceLabel} />
            <strong>{available}</strong>
          </>
        );

        return (
          <Tooltip.Root key={resource.id} delayDuration={250}>
            <Tooltip.Trigger asChild>
              {onOpenResources ? (
                <button
                  type="button"
                  className={`settlement-hud-item ${activeResourceId === resource.id ? "is-active" : ""}`}
                  aria-label={`${resourceLabel}: ${available} ${t("resources.available")}`}
                  onClick={() => onOpenResources(resource.id)}
                >
                  {content}
                </button>
              ) : (
                <div
                  className="settlement-hud-item"
                  aria-label={`${resourceLabel}: ${available} ${t("resources.available")}`}
                >
                  {content}
                </div>
              )}
            </Tooltip.Trigger>
            <ResourceTooltipContent document={document} resource={resource} />
          </Tooltip.Root>
        );
      })}
    </section>
  );
}
