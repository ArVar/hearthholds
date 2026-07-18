import { Grid3X3, Magnet, X } from "lucide-react";
import { useState } from "react";
import {
  mapResizeAnchors,
  type MapResizeAnchor,
} from "../domain/mapResize";
import { defaultGridAppearance } from "../domain/types";
import { useI18n } from "../i18n/I18nProvider";
import { useEditorStore } from "../store/editorStore";
import { IconButton } from "./IconButton";

export function GridSettingsPanel({ onClose }: { onClose: () => void }) {
  const { locale, t } = useI18n();
  const [mapResizeAnchor, setMapResizeAnchor] = useState<MapResizeAnchor>("center");
  const document = useEditorStore((state) => state.document);
  const gridVisible = useEditorStore((state) => state.gridVisible);
  const snapEnabled = useEditorStore((state) => state.snapEnabled);
  const setGridVisible = useEditorStore((state) => state.setGridVisible);
  const setSnapEnabled = useEditorStore((state) => state.setSnapEnabled);
  const updateMapGrid = useEditorStore((state) => state.updateMapGrid);
  const updateMapSize = useEditorStore((state) => state.updateMapSize);
  const gridColor = document.map.grid.color ?? defaultGridAppearance.color;
  const gridOpacity = document.map.grid.opacity ?? defaultGridAppearance.opacity;
  const formatMetric = (value: number) =>
    value.toLocaleString(locale, { maximumFractionDigits: 1 });
  const mapUnitsToMeters = (value: number) =>
    Math.round((value / document.map.grid.size) * document.map.grid.distance * 10) / 10;
  const updateMetricMapSize = (dimension: "width" | "height", value: string) => {
    const meters = Number(value);
    if (!(meters > 0)) return;
    updateMapSize(
      {
        [dimension]: (meters / document.map.grid.distance) * document.map.grid.size,
      },
      mapResizeAnchor,
    );
  };

  return (
    <aside className="inspector grid-settings-panel" aria-label={t("top.gridSettings")}>
      <div className="inspector-header">
        <div className="object-type-icon">
          <Grid3X3 size={19} />
        </div>
        <div>
          <span>{t("panel.map")}</span>
          <strong>{t("top.gridSettings")}</strong>
        </div>
        <IconButton label={t("common.close")} onClick={onClose}>
          <X size={17} />
        </IconButton>
      </div>

      <div className="inspector-scroll">
        <section className="form-section">
          <h2>{t("grid.behavior")}</h2>
          <label className="panel-toggle-row">
            <Grid3X3 size={17} aria-hidden="true" />
            <span>
              <strong>{t("grid.visibility")}</strong>
              <small>{t("grid.visibilityHint")}</small>
            </span>
            <input
              type="checkbox"
              checked={gridVisible}
              onChange={(event) => setGridVisible(event.target.checked)}
            />
          </label>
          <label className="panel-toggle-row">
            <Magnet size={17} aria-hidden="true" />
            <span>
              <strong>{t("top.snapToGrid")}</strong>
              <small>{t("grid.snapHint")}</small>
            </span>
            <input
              type="checkbox"
              checked={snapEnabled}
              onChange={(event) => setSnapEnabled(event.target.checked)}
            />
          </label>
        </section>

        <section className="form-section grid-panel-fields">
          <h2>{t("grid.scaleAndStructure")}</h2>
          <label className="form-field">
            <span>{t("grid.spacing")}</span>
            <input
              type="number"
              min={5}
              max={100}
              step={5}
              value={document.map.grid.size}
              onChange={(event) =>
                updateMapGrid({ size: Math.max(5, Number(event.target.value)) })
              }
            />
          </label>
          <label className="form-field">
            <span>{t("grid.scale")}</span>
            <select
              value={document.map.grid.distance}
              onChange={(event) => updateMapGrid({ distance: Number(event.target.value) })}
            >
              {[1, 1.5, 2, 5, 10, 25].map((distance) => (
                <option key={distance} value={distance}>
                  {t("grid.metersPerCell", {
                    distance: distance.toLocaleString(locale),
                  })}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>{t("grid.majorLines")}</span>
            <select
              value={document.map.grid.majorEvery}
              onChange={(event) => updateMapGrid({ majorEvery: Number(event.target.value) })}
            >
              {[5, 10].map((count) => (
                <option key={count} value={count}>
                  {t("grid.everyCells", { count })}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="form-section grid-panel-fields">
          <h2>{t("grid.appearance")}</h2>
          <label className="form-field grid-color-field">
            <span>{t("grid.color")}</span>
            <input
              type="color"
              value={gridColor}
              onChange={(event) => updateMapGrid({ color: event.target.value })}
            />
          </label>
          <label className="form-field">
            <span>
              {t("grid.opacity")} · {Math.round(gridOpacity * 100)} %
            </span>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={gridOpacity}
              onChange={(event) => updateMapGrid({ opacity: Number(event.target.value) })}
            />
          </label>
        </section>

        <section className="form-section grid-panel-fields">
          <h2>{t("grid.mapSize")}</h2>
          <div className="grid-size-fields">
            <label>
              <span>{t("grid.mapWidth")}</span>
              <input
                key={`width-${document.map.width}-${document.map.grid.size}-${document.map.grid.distance}`}
                type="number"
                min={1}
                step={0.5}
                defaultValue={mapUnitsToMeters(document.map.width)}
                onBlur={(event) => updateMetricMapSize("width", event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
              />
            </label>
            <label>
              <span>{t("grid.mapHeight")}</span>
              <input
                key={`height-${document.map.height}-${document.map.grid.size}-${document.map.grid.distance}`}
                type="number"
                min={1}
                step={0.5}
                defaultValue={mapUnitsToMeters(document.map.height)}
                onBlur={(event) => updateMetricMapSize("height", event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
              />
            </label>
          </div>
          <fieldset className="map-resize-anchor">
            <legend>{t("grid.resizeAnchor")}</legend>
            <div className="map-resize-anchor-grid">
              {mapResizeAnchors.map((anchor) => (
                <button
                  key={anchor}
                  type="button"
                  aria-label={t(`grid.anchor.${anchor}`)}
                  aria-pressed={mapResizeAnchor === anchor}
                  title={t(`grid.anchor.${anchor}`)}
                  className={mapResizeAnchor === anchor ? "is-active" : undefined}
                  onClick={() => setMapResizeAnchor(anchor)}
                >
                  <span />
                </button>
              ))}
            </div>
            <span>{t("grid.resizeAnchorHint")}</span>
          </fieldset>
          <div className="grid-map-size">
            <span>{t("grid.mapExtent")}</span>
            <strong>
              {formatMetric((document.map.width / document.map.grid.size) * document.map.grid.distance)}
              {" × "}
              {formatMetric((document.map.height / document.map.grid.size) * document.map.grid.distance)}
              {" m"}
            </strong>
          </div>
        </section>
      </div>
    </aside>
  );
}
