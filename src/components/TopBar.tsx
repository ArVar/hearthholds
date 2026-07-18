import {
  AlertTriangle,
  Copy,
  Download,
  Eye,
  FilePlus2,
  Grid3X3,
  Layers3,
  Maximize2,
  Minimize2,
  Redo2,
  RotateCcw,
  Settings2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import {
  fullProductName,
  productIconUrl,
  productName,
  productTagline,
} from "../config/brand";
import { downloadEditorDocument } from "../domain/documentExport";
import { useI18n } from "../i18n/I18nProvider";
import type { DocumentSummary } from "../persistence/editorDatabase";
import { useEditorStore } from "../store/editorStore";
import { IconButton } from "./IconButton";
import type { RightPanel } from "./RightSidebar";
import { SettlementHud } from "./SettlementHud";

export type ActiveEditorView = RightPanel | "resources";

type TopBarProps = {
  documents: DocumentSummary[];
  documentBusy: boolean;
  saveStatus: "saved" | "saving" | "error";
  activePanel: ActiveEditorView;
  fullscreenSupported: boolean;
  isFullscreen: boolean;
  selectedResourceId: string | null;
  onCreateBlankDocument: () => void;
  onDuplicateDocument: () => void;
  onImportDocument: (file: File) => void;
  onOpenResources: (resourceId: string | null) => void;
  onPresent: () => void;
  onToggleFullscreen: () => void;
  onTogglePanel: (panel: Exclude<RightPanel, "inspector">) => void;
  onSwitchDocument: (id: string) => void;
};

export function TopBar({
  documents,
  documentBusy,
  saveStatus,
  activePanel,
  fullscreenSupported,
  isFullscreen,
  selectedResourceId,
  onCreateBlankDocument,
  onDuplicateDocument,
  onImportDocument,
  onOpenResources,
  onPresent,
  onToggleFullscreen,
  onTogglePanel,
  onSwitchDocument,
}: TopBarProps) {
  const { t } = useI18n();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [dismissedTemplateId, setDismissedTemplateId] = useState<string | null>(null);
  const document = useEditorStore((state) => state.document);
  const dirty = useEditorStore((state) => state.dirty);
  const pastCount = useEditorStore((state) => state.past.length);
  const futureCount = useEditorStore((state) => state.future.length);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const reset = useEditorStore((state) => state.reset);
  const currentSummary = documents.find((candidate) => candidate.id === document.id);
  const documentOptions = currentSummary
    ? documents
    : [
        {
          id: document.id,
          name: document.settlementName,
          ruleset: document.ruleset,
          kind: "template" as const,
          updatedAt: 0,
          readable: true,
        },
        ...documents,
      ];
  const isTemplate = currentSummary?.kind === "template";
  const showTemplateWarning = isTemplate && dismissedTemplateId !== document.id;

  return (
    <header className="top-bar">
      <div className="brand-block">
        <div
          className="brand-mark"
          role="img"
          aria-label={fullProductName}
          title={fullProductName}
        >
          <img src={productIconUrl} alt="" />
        </div>
        <div className="brand-identity">
          <strong>{productName}</strong>
          <span>{productTagline}</span>
        </div>
        <div className="brand-copy">
          <select
            className="document-select"
            aria-label={t("top.document")}
            value={document.id}
            disabled={documentBusy}
            onChange={(event) => onSwitchDocument(event.target.value)}
          >
            {documentOptions.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {!candidate.readable ? "⚠ " : ""}
                {candidate.name}
                {candidate.kind === "template" ? ` (${t("common.template")})` : ""}
              </option>
            ))}
          </select>
          <span>
            {currentSummary?.kind === "settlement"
              ? t("common.copy")
              : t("common.template")}
            {` · ${document.ruleset}`}
          </span>
        </div>
        <IconButton
          label={
            currentSummary?.kind === "settlement"
              ? t("top.duplicateCopy")
              : t("top.editCopy")
          }
          onClick={onDuplicateDocument}
          disabled={documentBusy}
        >
          <Copy size={16} />
        </IconButton>
        <IconButton
          label={t("top.newBlankMap")}
          onClick={onCreateBlankDocument}
          disabled={documentBusy}
        >
          <FilePlus2 size={16} />
        </IconButton>
      </div>

      <SettlementHud
        activeResourceId={activePanel === "resources" ? selectedResourceId : null}
        onOpenResources={onOpenResources}
      />

      <div className="top-actions">
        <span className={`save-state ${dirty ? "is-dirty" : ""} ${saveStatus === "error" ? "is-error" : ""}`}>
          {documentBusy
            ? t("top.switchingDocument")
            : saveStatus === "error"
              ? t("top.saveFailed")
              : dirty || saveStatus === "saving"
              ? t("top.saving")
              : t("top.savedLocally")}
        </span>
        <div className="toolbar-group history-actions" aria-label={t("top.history")}>
          <IconButton label={t("top.undo")} onClick={undo} disabled={pastCount === 0}>
            <Undo2 size={17} />
          </IconButton>
          <IconButton label={t("top.redo")} onClick={redo} disabled={futureCount === 0}>
            <Redo2 size={17} />
          </IconButton>
          <IconButton label={t("top.reset")} onClick={reset}>
            <RotateCcw size={17} />
          </IconButton>
          <IconButton
            label={t("top.export")}
            onClick={() => downloadEditorDocument(document)}
          >
            <Download size={17} />
          </IconButton>
          <IconButton
            label={t("top.import")}
            onClick={() => importInputRef.current?.click()}
            disabled={documentBusy}
          >
            <Upload size={17} />
          </IconButton>
          <input
            ref={importInputRef}
            className="sr-only"
            type="file"
            accept=".json,application/json"
            aria-label={t("top.import")}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onImportDocument(file);
            }}
          />
        </div>
        <div className="toolbar-group panel-actions" aria-label={t("top.panels")}>
          <IconButton
            label={t("top.sceneBrowser")}
            active={activePanel === "scene"}
            aria-pressed={activePanel === "scene"}
            onClick={() => onTogglePanel("scene")}
          >
            <Layers3 size={17} />
          </IconButton>
          <IconButton
            label={t("top.gridSettings")}
            active={activePanel === "grid"}
            aria-pressed={activePanel === "grid"}
            onClick={() => onTogglePanel("grid")}
          >
            <Grid3X3 size={17} />
          </IconButton>
          <IconButton
            label={t("top.settings")}
            active={activePanel === "settings"}
            aria-pressed={activePanel === "settings"}
            onClick={() => onTogglePanel("settings")}
          >
            <Settings2 size={17} />
          </IconButton>
          <IconButton
            label={t(
              fullscreenSupported
                ? isFullscreen
                  ? "top.exitFullscreen"
                  : "top.enterFullscreen"
                : "top.fullscreenUnavailable",
            )}
            active={isFullscreen}
            disabled={!fullscreenSupported}
            onClick={onToggleFullscreen}
          >
            {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </IconButton>
        </div>
        <button
          type="button"
          className="presentation-button"
          onClick={onPresent}
        >
          <Eye size={17} />
          <span>{t("top.present")}</span>
        </button>
      </div>
      {showTemplateWarning && (
        <div className="template-warning" role="status">
          <AlertTriangle size={17} aria-hidden="true" />
          <span>{t("top.templateWarning")}</span>
          <button type="button" onClick={onDuplicateDocument} disabled={documentBusy}>
            <Copy size={14} aria-hidden="true" />
            {t("top.saveAsCopy")}
          </button>
          <IconButton
            label={t("top.dismissTemplateWarning")}
            onClick={() => setDismissedTemplateId(document.id)}
          >
            <X size={15} />
          </IconButton>
        </div>
      )}
    </header>
  );
}
