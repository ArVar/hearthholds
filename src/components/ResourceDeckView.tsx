import {
  ArrowLeft,
  BrickWall,
  CalendarDays,
  Clock3,
  Coins,
  House,
  Layers3,
  Pickaxe,
  Plus,
  Trees,
  Truck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import copperMineArtwork from "../../assets/resource-sources/copper-mine.jpg";
import forestArtwork from "../../assets/resource-sources/forest.jpg";
import goldMineArtwork from "../../assets/resource-sources/gold-mine.jpg";
import ironMineArtwork from "../../assets/resource-sources/iron-mine.jpg";
import quarryArtwork from "../../assets/resource-sources/quarry.jpg";
import {
  formatBaseCurrency,
  fromBaseCurrency,
  getCurrencyProfile,
  toBaseCurrency,
} from "../domain/currency";
import { getPhaseCompletionForecast } from "../domain/dailyCycle";
import {
  getEffectiveProduction,
  getResourceSourceStatus,
  getResourceFlowBreakdown,
  resourceSourceCatalog,
} from "../domain/resourceSources";
import type {
  ExternalResourceSource,
  ResourceSourceType,
} from "../domain/types";
import { getTreasuryCycleBalance } from "../domain/treasury";
import {
  canRecruitResidents,
  getAssignableResidentWorkers,
  getWorkerCount,
  getWorkforceSummary,
} from "../domain/workforce";
import { localizeResourceName } from "../i18n/domainLabels";
import { useI18n } from "../i18n/I18nProvider";
import { useEditorStore } from "../store/editorStore";
import { ResourceArtwork } from "./ResourceArtwork";
import { IconButton } from "./IconButton";

const sourceIcons: Record<ResourceSourceType, LucideIcon> = {
  forest: Trees,
  quarry: BrickWall,
  ironMine: Pickaxe,
  copperMine: Pickaxe,
  goldMine: Pickaxe,
};

const sourceArtwork: Record<ResourceSourceType, string> = {
  forest: forestArtwork,
  quarry: quarryArtwork,
  ironMine: ironMineArtwork,
  copperMine: copperMineArtwork,
  goldMine: goldMineArtwork,
};

function makeSourceId(type: ResourceSourceType): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${type}-${Date.now()}`;
}

function ResourceSourceCard({ source }: { source: ExternalResourceSource }) {
  const { t } = useI18n();
  const document = useEditorStore((state) => state.document);
  const currencyProfile = getCurrencyProfile(document.ruleset);
  const resource = document.resources.find(
    (candidate) => candidate.id === source.resourceId,
  );
  const updateResourceSource = useEditorStore((state) => state.updateResourceSource);
  const removeResourceSource = useEditorStore((state) => state.removeResourceSource);
  const SourceIcon = sourceIcons[source.type];
  const status = getResourceSourceStatus(source);
  const workerCount = getWorkerCount(source.workforce);
  const assignableResidents = getAssignableResidentWorkers(
    document,
    source.workforce.residentWorkers,
  );
  const updateWorkforce = (
    changes: Partial<ExternalResourceSource["workforce"]>,
  ) => updateResourceSource(source.id, {
    workforce: { ...source.workforce, ...changes },
  });

  return (
    <article className={`resource-source-card is-${source.type}`}>
      <header>
        <span className="resource-source-icon">
          <SourceIcon size={20} aria-hidden="true" />
        </span>
        <span>
          <strong>{source.name}</strong>
          <small>{resource ? localizeResourceName(resource, t) : source.resourceId}</small>
        </span>
        <span className={`resource-source-status is-${status}`}>
          {t(`resources.workplaceStatus.${status}`)}
        </span>
      </header>

      <div className="resource-source-artwork">
        <img src={sourceArtwork[source.type]} alt="" />
        <span>
          <strong>+{getEffectiveProduction(source)}</strong>
          {t("resources.perDay")}
        </span>
      </div>

      <div className="resource-source-facts">
        <span title={t("resources.workers")}>
          <Users size={15} aria-hidden="true" /> {workerCount}/{source.workforce.maxWorkers}
        </span>
        <span title={t("resources.travelTime")}>
          <Clock3 size={15} aria-hidden="true" /> {source.travelTime || "–"}
        </span>
        <span title={t("resources.transportCapacity")}>
          <Truck size={15} aria-hidden="true" /> {source.transportCapacity}
        </span>
      </div>

      {source.notes && <p className="resource-source-notes">{source.notes}</p>}

      <details className="resource-source-editor">
        <summary>{t("resources.editSource")}</summary>
        <div>
          <label className="form-field">
            <span>{t("inspector.name")}</span>
            <input
              defaultValue={source.name}
              onBlur={(event) => {
                if (event.target.value !== source.name) {
                  updateResourceSource(source.id, { name: event.target.value });
                }
              }}
            />
          </label>
          <label className="form-field">
            <span>{t("resources.sourceStatus")}</span>
            <select
              value={source.enabled ? "enabled" : "disabled"}
              onChange={(event) =>
                updateResourceSource(source.id, {
                  enabled: event.target.value === "enabled",
                })
              }
            >
              <option value="enabled">{t("resources.enabled")}</option>
              <option value="disabled">{t("resources.disabled")}</option>
            </select>
          </label>
          <div className="resource-source-number-grid">
            <label className="form-field">
              <span>{t("resources.maximumProduction")}</span>
              <input
                type="number"
                min={0}
                value={source.maxProduction}
                onChange={(event) =>
                  updateResourceSource(source.id, {
                    maxProduction: Number(event.target.value),
                  })
                }
              />
            </label>
            <label className="form-field">
              <span>{t("resources.transportCapacity")}</span>
              <input
                type="number"
                min={0}
                value={source.transportCapacity}
                onChange={(event) =>
                  updateResourceSource(source.id, {
                    transportCapacity: Number(event.target.value),
                  })
                }
              />
            </label>
            <label className="form-field">
              <span>{t("resources.minimumWorkers")}</span>
              <input
                type="number"
                min={0}
                max={source.workforce.maxWorkers}
                value={source.workforce.minWorkers}
                onChange={(event) => updateWorkforce({
                  minWorkers: Number(event.target.value),
                })}
              />
            </label>
            <label className="form-field">
              <span>{t("resources.maximumWorkers")}</span>
              <input
                type="number"
                min={source.workforce.minWorkers}
                value={source.workforce.maxWorkers}
                onChange={(event) => updateWorkforce({
                  maxWorkers: Number(event.target.value),
                })}
              />
            </label>
            <label className="form-field">
              <span>{t("resources.residentWorkers")}</span>
              <input
                type="number"
                min={0}
                max={Math.min(source.workforce.maxWorkers, assignableResidents)}
                value={source.workforce.residentWorkers}
                onChange={(event) => updateWorkforce({
                  residentWorkers: Number(event.target.value),
                })}
              />
            </label>
            <label className="form-field">
              <span>{t("resources.hiredWorkers")}</span>
              <input
                type="number"
                min={0}
                max={source.workforce.maxWorkers - source.workforce.residentWorkers}
                value={source.workforce.hiredWorkers}
                onChange={(event) => updateWorkforce({
                  hiredWorkers: Number(event.target.value),
                })}
              />
            </label>
            <label className="form-field">
              <span>{t("resources.dailyWage")}</span>
              <div className="currency-input">
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={source.workforce.wagePerCycle}
                  onChange={(event) => updateWorkforce({
                    wagePerCycle: Number(event.target.value),
                  })}
                />
                <select
                  aria-label={t("resources.currency")}
                  value={source.workforce.wageCurrencyId}
                  onChange={(event) => updateWorkforce({
                    wageCurrencyId: event.target.value,
                  })}
                >
                  {currencyProfile.denominations.map((currency) => (
                    <option key={currency.id} value={currency.id}>{currency.symbol}</option>
                  ))}
                </select>
              </div>
            </label>
            <label className="form-field">
              <span>{t("resources.travelTime")}</span>
              <input
                value={source.travelTime}
                onChange={(event) =>
                  updateResourceSource(source.id, { travelTime: event.target.value })
                }
              />
            </label>
          </div>
          <label className="form-field">
            <span>{t("inspector.notes")}</span>
            <textarea
              rows={2}
              value={source.notes}
              onChange={(event) =>
                updateResourceSource(source.id, { notes: event.target.value })
              }
            />
          </label>
          <button
            type="button"
            className="resource-source-remove"
            onClick={() => removeResourceSource(source.id)}
          >
            <X size={14} aria-hidden="true" />
            {t("resources.removeSource")}
          </button>
        </div>
      </details>
    </article>
  );
}

export function ResourceDeckView({
  selectedResourceId,
  onSelectResource,
  onClose,
}: {
  selectedResourceId: string | null;
  onSelectResource: (resourceId: string | null) => void;
  onClose: () => void;
}) {
  const { localize, t } = useI18n();
  const document = useEditorStore((state) => state.document);
  const addResourceSource = useEditorStore((state) => state.addResourceSource);
  const advanceCycle = useEditorStore((state) => state.advanceCycle);
  const updatePopulation = useEditorStore((state) => state.updatePopulation);
  const updateTreasury = useEditorStore((state) => state.updateTreasury);
  const recruitResidents = useEditorStore((state) => state.recruitResidents);
  const [recruitCount, setRecruitCount] = useState(1);
  const [recruitWorkers, setRecruitWorkers] = useState(1);
  const workforce = getWorkforceSummary(document);
  const currencyProfile = getCurrencyProfile(document.ruleset);
  const cycleBalance = getTreasuryCycleBalance(document);
  const recruitmentPossible = canRecruitResidents(
    document,
    recruitCount,
    recruitWorkers,
  );
  const selectedResource = document.resources.find(
    (resource) => resource.id === selectedResourceId,
  );
  const visibleSources = selectedResourceId
    ? document.resourceSources.filter(
        (source) => source.resourceId === selectedResourceId,
      )
    : document.resourceSources;
  const selectedFlow = selectedResource
    ? getResourceFlowBreakdown(document, selectedResource.id)
    : null;

  const addSourceFromCatalog = (type: ResourceSourceType) => {
    const entry = resourceSourceCatalog.find((candidate) => candidate.type === type);
    if (!entry) return;
    const source: ExternalResourceSource = {
      id: makeSourceId(type),
      name: localize(entry.label),
      type,
      resourceId: entry.resource.id,
      ...entry.defaults,
      workforce: {
        ...entry.defaults.workforce,
        wagePerCycle: document.treasury.defaultWagePerCycle,
        wageCurrencyId: document.treasury.defaultWageCurrencyId,
      },
      notes: "",
    };
    const resource = document.resources.some(
      (candidate) => candidate.id === entry.resource.id,
    )
      ? undefined
      : {
          id: entry.resource.id,
          name: localize(entry.resource.name),
          total: 0,
          reserved: 0,
          unit: localize(entry.resource.unit),
          source: "",
          consumable: entry.resource.consumable,
        };
    addResourceSource(source, resource);
    onSelectResource(entry.resource.id);
  };

  return (
    <main className="resource-deck-view" aria-label={t("resources.menu")}>
      <header className="resource-deck-header">
        <button type="button" className="resource-deck-back" onClick={onClose}>
          <ArrowLeft size={18} aria-hidden="true" />
          {t("resources.backToMap")}
        </button>
        <span>
          <small>{t("resources.management")}</small>
          <strong>{t("resources.menu")}</strong>
        </span>
        <IconButton label={t("common.close")} onClick={onClose}>
          <X size={18} />
        </IconButton>
      </header>

      <div className="resource-deck-layout">
        <aside className="resource-deck-controls">
          <section className="resource-control-section workforce-control-section">
            <h2>{t("resources.populationAndWorkforce")}</h2>
            <div className="workforce-overview-grid">
              <span>
                <Users size={15} />
                {t("resources.residents")}
                <strong>{workforce.residents}</strong>
              </span>
              <span>
                <House size={15} />
                {t("resources.housing")}
                <strong>{workforce.residents}/{workforce.housingCapacity}</strong>
              </span>
              <span>
                <Users size={15} />
                {t("resources.assignedWorkers")}
                <strong>{workforce.assignedResidents}/{workforce.workingResidents}</strong>
              </span>
              <span>
                <UserPlus size={15} />
                {t("resources.hiredWorkers")}
                <strong>+{workforce.hiredWorkers}</strong>
              </span>
            </div>
            <div className="resource-source-number-grid workforce-gm-fields">
              <label className="form-field">
                <span>{t("resources.residents")}</span>
                <input
                  type="number"
                  min={workforce.assignedResidents}
                  value={document.population.permanent}
                  onChange={(event) => updatePopulation({
                    permanent: Number(event.target.value),
                  })}
                />
              </label>
              <label className="form-field">
                <span>{t("resources.workingResidents")}</span>
                <input
                  type="number"
                  min={workforce.assignedResidents}
                  max={document.population.permanent}
                  value={document.population.workingResidents}
                  onChange={(event) => updatePopulation({
                    workingResidents: Number(event.target.value),
                  })}
                />
              </label>
            </div>
            <div className={`treasury-control ${cycleBalance.affordable ? "" : "is-short"}`}>
              <span>
                <Coins size={17} />
                <span>
                  <small>{t("resources.treasury")}</small>
                  <strong>{formatBaseCurrency(document.ruleset, document.treasury.balanceBaseUnits, document.treasury.displayCurrencyId)}</strong>
                </span>
              </span>
              <small>
                {t("resources.dailyPayroll")}: {formatBaseCurrency(document.ruleset, workforce.cyclePayrollBaseUnits)}
              </small>
            </div>
            <div className="resource-source-number-grid workforce-gm-fields">
              <label className="form-field">
                <span>{t("resources.treasuryBalance")}</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={fromBaseCurrency(
                    document.ruleset,
                    document.treasury.balanceBaseUnits,
                    document.treasury.displayCurrencyId,
                  )}
                  onChange={(event) => updateTreasury({
                    balanceBaseUnits: toBaseCurrency(
                      document.ruleset,
                      Number(event.target.value),
                      document.treasury.displayCurrencyId,
                    ),
                  })}
                />
              </label>
              <label className="form-field">
                <span>{t("resources.currency")}</span>
                <select
                  value={document.treasury.displayCurrencyId}
                  onChange={(event) => updateTreasury({ displayCurrencyId: event.target.value })}
                >
                  {currencyProfile.denominations.map((currency) => (
                    <option key={currency.id} value={currency.id}>{currency.symbol}</option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>{t("resources.defaultDailyWage")}</span>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={document.treasury.defaultWagePerCycle}
                  onChange={(event) => updateTreasury({
                    defaultWagePerCycle: Number(event.target.value),
                  })}
                />
              </label>
              <label className="form-field">
                <span>{t("resources.wageCurrency")}</span>
                <select
                  value={document.treasury.defaultWageCurrencyId}
                  onChange={(event) => updateTreasury({ defaultWageCurrencyId: event.target.value })}
                >
                  {currencyProfile.denominations.map((currency) => (
                    <option key={currency.id} value={currency.id}>{currency.symbol}</option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>{t("resources.recruitmentCost")}</span>
                <input
                  type="number"
                  min={0}
                  value={document.treasury.recruitmentCostPerResident}
                  onChange={(event) => updateTreasury({
                    recruitmentCostPerResident: Number(event.target.value),
                  })}
                />
              </label>
              <label className="form-field">
                <span>{t("resources.recruitmentCurrency")}</span>
                <select
                  value={document.treasury.recruitmentCurrencyId}
                  onChange={(event) => updateTreasury({ recruitmentCurrencyId: event.target.value })}
                >
                  {currencyProfile.denominations.map((currency) => (
                    <option key={currency.id} value={currency.id}>{currency.symbol}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="treasury-cycle-balance">
              <span>{t("resources.cycleIncome")}<strong>+{formatBaseCurrency(document.ruleset, cycleBalance.incomeBaseUnits)}</strong></span>
              <span>{t("resources.cycleExpenses")}<strong>−{formatBaseCurrency(document.ruleset, cycleBalance.expenseBaseUnits)}</strong></span>
              <span>{t("resources.cycleNet")}<strong>{cycleBalance.netBaseUnits >= 0 ? "+" : "−"}{formatBaseCurrency(document.ruleset, Math.abs(cycleBalance.netBaseUnits))}</strong></span>
            </div>
            {document.treasury.ledger.length > 0 && (
              <details className="treasury-ledger">
                <summary>{t("resources.ledger")}</summary>
                <div>
                  {document.treasury.ledger.slice(-8).reverse().map((entry) => (
                    <span key={entry.id}>
                      <small>{t("resources.cycleNumber", { cycle: entry.cycle })} · {entry.label}</small>
                      <strong className={`is-${entry.type}`}>
                        {entry.type === "income" ? "+" : "−"}{formatBaseCurrency(document.ruleset, entry.amountBaseUnits)}
                      </strong>
                    </span>
                  ))}
                </div>
              </details>
            )}
            <div className="recruitment-control">
              <label>
                <span>{t("resources.newResidents")}</span>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, workforce.freeHousing)}
                  value={recruitCount}
                  onChange={(event) => {
                    const count = Math.max(1, Number(event.target.value));
                    setRecruitCount(count);
                    setRecruitWorkers((workers) => Math.min(workers, count));
                  }}
                />
              </label>
              <label>
                <span>{t("resources.newWorkers")}</span>
                <input
                  type="number"
                  min={0}
                  max={recruitCount}
                  value={recruitWorkers}
                  onChange={(event) => setRecruitWorkers(Number(event.target.value))}
                />
              </label>
              <button
                type="button"
                disabled={!recruitmentPossible}
                onClick={() => recruitResidents(recruitCount, recruitWorkers)}
              >
                <UserPlus size={14} />
                {t("resources.recruit")}
              </button>
            </div>
          </section>

          <section className="resource-control-section daily-cycle-section">
            <h2>{t("resources.dailyCycle")}</h2>
            <div className="daily-cycle-control">
              <span>
                <CalendarDays size={18} aria-hidden="true" />
                <span>
                  <small>{t("resources.campaignTime")}</small>
                  <strong>{t("resources.dayNumber", { day: document.campaignCycle })}</strong>
                </span>
              </span>
              <button
                type="button"
                disabled={!cycleBalance.affordable}
                title={cycleBalance.affordable ? undefined : t("resources.payrollShortfall")}
                onClick={advanceCycle}
              >
                {t("resources.nextDay")}
              </button>
            </div>
            <div className="daily-project-forecast">
              {document.projects
                .filter((project) => project.status !== "complete")
                .map((project) => {
                  const forecast = getPhaseCompletionForecast(document, project);
                  return (
                    <div key={project.id}>
                      <span>{project.name}</span>
                      <strong className={forecast.cycles === null ? "is-blocked" : undefined}>
                        {forecast.cycles === null
                          ? t("resources.blocked")
                          : t("resources.daysRemaining", { count: forecast.cycles })}
                      </strong>
                    </div>
                  );
                })}
            </div>
          </section>

          <section className="resource-control-section">
            <h2>{t("resources.stock")}</h2>
            <div className="resource-filter-list" role="group" aria-label={t("resources.filter")}>
              <button
                type="button"
                className={selectedResourceId === null ? "is-active" : undefined}
                aria-pressed={selectedResourceId === null}
                onClick={() => onSelectResource(null)}
              >
                <Layers3 size={15} aria-hidden="true" />
                <span>{t("resources.all")}</span>
                <strong>{document.resources.length}</strong>
              </button>
              {document.resources.map((resource) => (
                <button
                  type="button"
                  key={resource.id}
                  className={selectedResourceId === resource.id ? "is-active" : undefined}
                  aria-pressed={selectedResourceId === resource.id}
                  aria-label={`${localizeResourceName(resource, t)}: ${resource.total - resource.reserved}`}
                  onClick={() => onSelectResource(resource.id)}
                >
                  <ResourceArtwork
                    resourceId={resource.id}
                    label={localizeResourceName(resource, t)}
                    size="small"
                  />
                  <strong>{resource.total - resource.reserved}</strong>
                </button>
              ))}
            </div>
            {selectedResource && selectedFlow && (
              <div className="resource-flow-summary">
                <span>
                  {t("resources.total")} <strong>{selectedResource.total}</strong>
                </span>
                <span>
                  {t("resources.production")} <strong>+{selectedFlow.productionTotal}</strong>
                </span>
                <span>
                  {t("resources.consumption")} <strong>−{selectedFlow.consumptionTotal}</strong>
                </span>
              </div>
            )}
          </section>

          <section className="resource-control-section">
            <h2>{t("resources.addSource")}</h2>
            <div className="resource-source-catalog">
              {resourceSourceCatalog.map((entry) => {
                const SourceIcon = sourceIcons[entry.type];
                return (
                  <button
                    key={entry.type}
                    type="button"
                    title={localize(entry.description)}
                    onClick={() => addSourceFromCatalog(entry.type)}
                  >
                    <SourceIcon size={18} aria-hidden="true" />
                    <span>{localize(entry.label)}</span>
                    <Plus size={13} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </section>
        </aside>

        <section className="resource-source-deck-section">
          <div className="resource-source-deck-heading">
            <span>
              <small>{t("resources.deckHint")}</small>
              <strong>{t("resources.externalSources")}</strong>
            </span>
            <b>{visibleSources.length}</b>
          </div>
          <div className="resource-source-deck">
            {visibleSources.map((source) => (
              <ResourceSourceCard key={source.id} source={source} />
            ))}
            {visibleSources.length === 0 && (
              <p className="resource-source-empty">{t("resources.noSources")}</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
