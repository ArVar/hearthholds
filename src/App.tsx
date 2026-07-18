import * as Tooltip from "@radix-ui/react-tooltip";
import {
  AlertTriangle,
  Download,
  EyeOff,
  Grid3X3,
  Maximize2,
  Minimize2,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconButton } from "./components/IconButton";
import {
  DocumentImportDialog,
  type DocumentImportDialogState,
} from "./components/DocumentImportDialog";
import { DocumentRecoveryDialog } from "./components/DocumentRecoveryDialog";
import { MapCanvas } from "./components/MapCanvas";
import { PwaStatusBanner } from "./components/PwaStatusBanner";
import { ResourceDeckView } from "./components/ResourceDeckView";
import { RightSidebar } from "./components/RightSidebar";
import { SettlementHud } from "./components/SettlementHud";
import { ToolPalette } from "./components/ToolPalette";
import { TopBar, type ActiveEditorView } from "./components/TopBar";
import { fullProductName, productIconUrl } from "./config/brand";
import {
  DocumentImportError,
  parseEditorDocumentJson,
} from "./domain/documentImport";
import { downloadEditorDocument, downloadRawDocument } from "./domain/documentExport";
import type { EditorDocument } from "./domain/types";
import { useI18n } from "./i18n/I18nProvider";
import {
  createDefaultDocument,
  defaultDocumentId,
} from "./persistence/bundledDocuments";
import { createDocumentCopy, createEmptyDocument } from "./persistence/documentCopy";
import {
  listDocuments,
  loadActiveDocumentId,
  loadDocument,
  loadRawDocument,
  saveActiveDocumentId,
  saveDocument,
  type DocumentSummary,
} from "./persistence/editorDatabase";
import {
  requestPersistentStorage,
  type StorageFailureCode,
  toDocumentStorageError,
} from "./persistence/storageReliability";
import { useEditorStore } from "./store/editorStore";
import {
  applyPwaUpdate,
  promptPwaInstall,
  usePwaStatus,
} from "./pwa/serviceWorker";

const storageFailureMessageKeys: Record<StorageFailureCode, "storage.error.quota" | "storage.error.validation" | "storage.error.write"> = {
  quota: "storage.error.quota",
  validation: "storage.error.validation",
  write: "storage.error.write",
};

export default function App() {
  const { t } = useI18n();
  const document = useEditorStore((state) => state.document);
  const dirty = useEditorStore((state) => state.dirty);
  const hydrated = useEditorStore((state) => state.hydrated);
  const presentationMode = useEditorStore((state) => state.presentationMode);
  const gridVisible = useEditorStore((state) => state.gridVisible);
  const selectedId = useEditorStore((state) => state.selectedId);
  const hydrate = useEditorStore((state) => state.hydrate);
  const markSaved = useEditorStore((state) => state.markSaved);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const rotateSelected = useEditorStore((state) => state.rotateSelected);
  const groupSelected = useEditorStore((state) => state.groupSelected);
  const ungroupSelected = useEditorStore((state) => state.ungroupSelected);
  const select = useEditorStore((state) => state.select);
  const setPresentationMode = useEditorStore((state) => state.setPresentationMode);
  const setGridVisible = useEditorStore((state) => state.setGridVisible);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [storageFailure, setStorageFailure] = useState<StorageFailureCode | null>(null);
  const [recoveryDocument, setRecoveryDocument] = useState<DocumentSummary | null>(null);
  const [importDialog, setImportDialog] = useState<DocumentImportDialogState | null>(null);
  const [pendingImport, setPendingImport] = useState<{
    document: EditorDocument;
    fileName: string;
    existing: DocumentSummary;
  } | null>(null);
  const [activePanel, setActivePanel] = useState<ActiveEditorView>("inspector");
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(
    Boolean(globalThis.document.fullscreenElement),
  );
  const pwaStatus = usePwaStatus();
  const [pwaBusy, setPwaBusy] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);
  const [offlineReadyDismissed, setOfflineReadyDismissed] = useState(false);
  const presentationOwnsFullscreen = useRef(false);
  const saveInFlight = useRef<Promise<void> | null>(null);
  const fullscreenSupported = Boolean(
    globalThis.document.fullscreenEnabled &&
      globalThis.document.documentElement.requestFullscreen,
  );

  useEffect(() => {
    const syncFullscreenState = () =>
      setIsFullscreen(Boolean(globalThis.document.fullscreenElement));
    globalThis.document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => globalThis.document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  const enterFullscreen = useCallback(async () => {
    if (globalThis.document.fullscreenElement) return true;
    if (
      !globalThis.document.fullscreenEnabled ||
      !globalThis.document.documentElement.requestFullscreen
    ) {
      return false;
    }
    try {
      await globalThis.document.documentElement.requestFullscreen({ navigationUI: "hide" });
      return true;
    } catch {
      return false;
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (globalThis.document.fullscreenElement) {
      await globalThis.document.exitFullscreen().catch(() => undefined);
      return;
    }
    await enterFullscreen();
  }, [enterFullscreen]);

  const startPresentation = useCallback(async () => {
    const wasFullscreen = Boolean(globalThis.document.fullscreenElement);
    presentationOwnsFullscreen.current = !wasFullscreen && await enterFullscreen();
    setPresentationMode(true);
  }, [enterFullscreen, setPresentationMode]);

  const exitPresentation = useCallback(async () => {
    setPresentationMode(false);
    if (presentationOwnsFullscreen.current && globalThis.document.fullscreenElement) {
      await globalThis.document.exitFullscreen().catch(() => undefined);
    }
    presentationOwnsFullscreen.current = false;
  }, [setPresentationMode]);

  useEffect(() => {
    if (selectedId) {
      setActivePanel((current) => current === "scene" ? current : "inspector");
    }
  }, [selectedId]);

  const refreshDocuments = useCallback(async () => {
    setDocuments(await listDocuments());
  }, []);

  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const fallback = createDefaultDocument();
      try {
        const storedTemplate = await loadDocument(defaultDocumentId);
        const template = storedTemplate ?? fallback;
        await saveDocument(template, { kind: "template" });

        const activeDocumentId = await loadActiveDocumentId();
        const stored = activeDocumentId
          ? await loadDocument(activeDocumentId)
          : template;
        const nextDocument = stored ?? template;
        await saveActiveDocumentId(nextDocument.id);
        if (!active) return;
        hydrate(nextDocument);
        await refreshDocuments();
      } catch (error) {
        if (!active) return;
        setStorageFailure(toDocumentStorageError(error).code);
        setSaveStatus("error");
        hydrate(fallback);
      }
    })();
    return () => {
      active = false;
    };
  }, [hydrate, refreshDocuments]);

  const saveCurrentDocument = useCallback(async (): Promise<boolean> => {
    if (saveInFlight.current) {
      await saveInFlight.current.catch(() => undefined);
    }
    const state = useEditorStore.getState();
    if (!state.dirty) {
      if (!storageFailure) setSaveStatus("saved");
      return true;
    }
    const version = state.document.updatedAt;
    setSaveStatus("saving");
    const operation = saveDocument(state.document);
    saveInFlight.current = operation;
    try {
      await operation;
      state.markSaved(version);
      setStorageFailure(null);
      setSaveStatus(useEditorStore.getState().dirty ? "saving" : "saved");
      return true;
    } catch (error) {
      setStorageFailure(toDocumentStorageError(error).code);
      setSaveStatus("error");
      return false;
    } finally {
      if (saveInFlight.current === operation) saveInFlight.current = null;
    }
  }, [storageFailure]);

  const installPwa = useCallback(async () => {
    setPwaBusy(true);
    try {
      await promptPwaInstall();
      setInstallDismissed(true);
    } finally {
      setPwaBusy(false);
    }
  }, []);

  const updatePwa = useCallback(async () => {
    setPwaBusy(true);
    const activated = await applyPwaUpdate(async () => {
      const saved = await saveCurrentDocument();
      return saved && !useEditorStore.getState().dirty;
    });
    if (!activated) setPwaBusy(false);
  }, [saveCurrentDocument]);

  useEffect(() => {
    if (!hydrated || !dirty || saveStatus === "error") return;
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      void saveCurrentDocument();
    }, 450);
    return () => window.clearTimeout(timer);
  }, [dirty, document.updatedAt, hydrated, saveCurrentDocument, saveStatus]);

  useEffect(() => {
    const flushPendingSave = () => {
      if (globalThis.document.visibilityState === "hidden") {
        void saveCurrentDocument();
      }
    };
    const flushBeforePageHide = () => void saveCurrentDocument();
    globalThis.document.addEventListener("visibilitychange", flushPendingSave);
    window.addEventListener("pagehide", flushBeforePageHide);
    return () => {
      globalThis.document.removeEventListener("visibilitychange", flushPendingSave);
      window.removeEventListener("pagehide", flushBeforePageHide);
    };
  }, [saveCurrentDocument]);

  const switchDocument = useCallback(
    async (id: string) => {
      if (id === document.id || documentBusy) return;
      setDocumentBusy(true);
      try {
        if (!await saveCurrentDocument()) return;
        const summary = documents.find((candidate) => candidate.id === id);
        if (summary && !summary.readable) {
          setRecoveryDocument(summary);
          return;
        }
        const stored = await loadDocument(id);
        if (!stored) return;
        await saveActiveDocumentId(stored.id);
        hydrate(stored);
        await refreshDocuments();
      } finally {
        setDocumentBusy(false);
      }
    },
    [document.id, documentBusy, documents, hydrate, refreshDocuments, saveCurrentDocument],
  );

  const duplicateDocument = useCallback(async () => {
    if (documentBusy) return;
    setDocumentBusy(true);
    try {
      if (!await saveCurrentDocument()) return;
      const currentDocument = useEditorStore.getState().document;
      const source = documents.find((candidate) => candidate.id === currentDocument.id);
      const copy = createDocumentCopy(
        currentDocument,
        documents.map((candidate) => candidate.name),
        t("common.copy"),
      );
      await saveDocument(copy, {
        kind: "settlement",
        sourceTemplateId:
          source?.kind === "template" ? source.id : source?.sourceTemplateId,
      });
      await saveActiveDocumentId(copy.id);
      hydrate(copy);
      await refreshDocuments();
    } finally {
      setDocumentBusy(false);
    }
  }, [documentBusy, documents, hydrate, refreshDocuments, saveCurrentDocument, t]);

  const createBlankDocument = useCallback(async () => {
    if (documentBusy) return;
    setDocumentBusy(true);
    try {
      if (!await saveCurrentDocument()) return;
      const currentDocument = useEditorStore.getState().document;
      const source = documents.find((candidate) => candidate.id === currentDocument.id);
      const blank = createEmptyDocument(
        currentDocument,
        documents.map((candidate) => candidate.name),
        t("document.newSettlement"),
      );
      await saveDocument(blank, {
        kind: "settlement",
        sourceTemplateId:
          source?.kind === "template" ? source.id : source?.sourceTemplateId,
      });
      await saveActiveDocumentId(blank.id);
      hydrate(blank);
      await refreshDocuments();
    } finally {
      setDocumentBusy(false);
    }
  }, [documentBusy, documents, hydrate, refreshDocuments, saveCurrentDocument, t]);

  const activateImportedDocument = useCallback(
    async (
      importedDocument: EditorDocument,
      metadata: { kind: "template" | "settlement"; sourceTemplateId?: string },
    ) => {
      if (!await saveCurrentDocument()) return false;
      await saveDocument(importedDocument, metadata);
      await saveActiveDocumentId(importedDocument.id);
      hydrate(importedDocument);
      setActivePanel("inspector");
      setSelectedResourceId(null);
      await refreshDocuments();
      return true;
    },
    [hydrate, refreshDocuments, saveCurrentDocument],
  );

  const importDocument = useCallback(async (file: File) => {
    if (documentBusy) return;
    setDocumentBusy(true);
    try {
      const importedDocument = parseEditorDocumentJson(await file.text());
      const existing = documents.find(
        (candidate) => candidate.id === importedDocument.id,
      );
      if (existing) {
        setPendingImport({ document: importedDocument, fileName: file.name, existing });
        setImportDialog({
          kind: "conflict",
          fileName: file.name,
          documentName: importedDocument.settlementName,
          existingKind: existing.kind,
        });
        return;
      }
      await activateImportedDocument(importedDocument, { kind: "settlement" });
    } catch (error) {
      setPendingImport(null);
      setImportDialog({
        kind: "error",
        code: error instanceof DocumentImportError ? error.code : "unexpected",
        fileName: file.name,
      });
    } finally {
      setDocumentBusy(false);
    }
  }, [activateImportedDocument, documentBusy, documents]);

  const resolveImportConflict = useCallback(async (mode: "copy" | "replace") => {
    if (!pendingImport || documentBusy) return;
    setDocumentBusy(true);
    try {
      if (mode === "copy") {
        const copy = createDocumentCopy(
          pendingImport.document,
          documents.map((candidate) => candidate.name),
          t("common.copy"),
        );
        if (!await activateImportedDocument(copy, {
          kind: "settlement",
          sourceTemplateId:
            pendingImport.existing.kind === "template"
              ? pendingImport.existing.id
              : pendingImport.existing.sourceTemplateId,
        })) return;
      } else {
        if (!await activateImportedDocument(pendingImport.document, {
          kind: pendingImport.existing.kind,
          sourceTemplateId: pendingImport.existing.sourceTemplateId,
        })) return;
      }
      setPendingImport(null);
      setImportDialog(null);
    } catch {
      setPendingImport(null);
      setImportDialog({
        kind: "error",
        code: "unexpected",
        fileName: pendingImport.fileName,
      });
    } finally {
      setDocumentBusy(false);
    }
  }, [activateImportedDocument, documentBusy, documents, pendingImport, t]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (importDialog) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select")) return;

      const commandKey = event.metaKey || event.ctrlKey;
      if (commandKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (commandKey && event.key.toLowerCase() === "g") {
        event.preventDefault();
        if (event.shiftKey) ungroupSelected();
        else {
          const groupCount = useEditorStore.getState().document.map.scene.groups.length;
          groupSelected(t("scene.newGroup", { count: groupCount + 1 }));
        }
        return;
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        rotateSelected(event.shiftKey ? -15 : 15);
        return;
      }
      if (event.key.toLowerCase() === "g") {
        event.preventDefault();
        setGridVisible(!useEditorStore.getState().gridVisible);
        return;
      }
      if (event.key === "Escape") {
        if (presentationMode) void exitPresentation();
        else if (activePanel !== "inspector") setActivePanel("inspector");
        else select(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePanel, exitPresentation, groupSelected, importDialog, presentationMode, redo, rotateSelected, select, setGridVisible, t, undo, ungroupSelected]);

  return (
    <Tooltip.Provider>
      <div className={`app-shell ${presentationMode ? "is-presenting" : ""}`}>
        {!presentationMode && (
          <TopBar
            documents={documents}
            documentBusy={documentBusy}
            saveStatus={saveStatus}
            activePanel={activePanel}
            fullscreenSupported={fullscreenSupported}
            isFullscreen={isFullscreen}
            selectedResourceId={selectedResourceId}
            onCreateBlankDocument={createBlankDocument}
            onDuplicateDocument={duplicateDocument}
            onImportDocument={(file) => void importDocument(file)}
            onOpenResources={(resourceId) => {
              setSelectedResourceId(resourceId);
              setActivePanel("resources");
            }}
            onPresent={() => void startPresentation()}
            onToggleFullscreen={() => void toggleFullscreen()}
            onTogglePanel={(panel) =>
              setActivePanel((current) => current === panel ? "inspector" : panel)
            }
            onSwitchDocument={switchDocument}
          />
        )}
        {!presentationMode && storageFailure && (
          <div className="storage-warning" role="alert">
            <AlertTriangle size={17} aria-hidden="true" />
            <span>{t(storageFailureMessageKeys[storageFailure])}</span>
            <button type="button" onClick={() => void saveCurrentDocument()}>
              <RefreshCw size={14} aria-hidden="true" />
              {t("storage.retry")}
            </button>
            <button type="button" onClick={() => downloadEditorDocument(document)}>
              <Download size={14} aria-hidden="true" />
              {t("storage.export")}
            </button>
          </div>
        )}
        {!presentationMode && !storageFailure && pwaStatus.updateAvailable && (
          <PwaStatusBanner
            kind="update"
            message={t(dirty ? "pwa.updateSaveMessage" : "pwa.updateMessage")}
            actionLabel={t(dirty ? "pwa.saveAndUpdate" : "pwa.updateNow")}
            busy={pwaBusy}
            onAction={() => void updatePwa()}
          />
        )}
        {!presentationMode
          && !storageFailure
          && !pwaStatus.updateAvailable
          && pwaStatus.installAvailable
          && !installDismissed && (
          <PwaStatusBanner
            kind="install"
            message={t("pwa.installMessage")}
            actionLabel={t("pwa.install")}
            busy={pwaBusy}
            closeLabel={t("common.close")}
            onAction={() => void installPwa()}
            onClose={() => setInstallDismissed(true)}
          />
        )}
        {!presentationMode
          && !storageFailure
          && !pwaStatus.updateAvailable
          && !pwaStatus.installAvailable
          && pwaStatus.offlineReady
          && !offlineReadyDismissed && (
          <PwaStatusBanner
            kind="offline"
            message={t("pwa.offlineReady")}
            closeLabel={t("common.close")}
            onClose={() => setOfflineReadyDismissed(true)}
          />
        )}
        {!presentationMode && activePanel === "resources" ? (
          <ResourceDeckView
            selectedResourceId={selectedResourceId}
            onSelectResource={setSelectedResourceId}
            onClose={() => setActivePanel("inspector")}
          />
        ) : (
          <>
            {!presentationMode && <ToolPalette />}
            <MapCanvas />
          </>
        )}
        {!presentationMode && activePanel !== "resources" && (
          <RightSidebar
            panel={activePanel}
            onClosePanel={() => setActivePanel("inspector")}
          />
        )}

        {presentationMode && (
          <header className="presentation-top-bar">
            <div className="presentation-document">
              <div
                className="brand-mark"
                role="img"
                aria-label={fullProductName}
                title={fullProductName}
              >
                <img src={productIconUrl} alt="" />
              </div>
              <span>
                <strong>{document.settlementName}</strong>
                <small>{document.ruleset}</small>
              </span>
            </div>
            <SettlementHud presentation />
            <div className="presentation-actions">
              <IconButton
                label={gridVisible ? t("top.hideGrid") : t("top.showGrid")}
                className={`presentation-grid-toggle ${gridVisible ? "is-active" : ""}`}
                aria-pressed={gridVisible}
                onClick={() => setGridVisible(!gridVisible)}
              >
                <Grid3X3 size={17} />
              </IconButton>
              <IconButton
                label={t(isFullscreen ? "top.exitFullscreen" : "top.enterFullscreen")}
                className="presentation-fullscreen-toggle"
                active={isFullscreen}
                disabled={!fullscreenSupported}
                onClick={() => void toggleFullscreen()}
              >
                {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
              </IconButton>
              <button
                type="button"
                className="exit-presentation"
                onClick={() => void exitPresentation()}
              >
                <EyeOff size={17} />
                {t("app.exitPresentation")}
              </button>
            </div>
          </header>
        )}
        {!presentationMode && importDialog && (
          <DocumentImportDialog
            state={importDialog}
            busy={documentBusy}
            onCancel={() => {
              if (documentBusy) return;
              setPendingImport(null);
              setImportDialog(null);
            }}
            onCopy={() => void resolveImportConflict("copy")}
            onReplace={() => void resolveImportConflict("replace")}
          />
        )}
        {!presentationMode && recoveryDocument && (
          <DocumentRecoveryDialog
            documentName={recoveryDocument.name}
            onClose={() => setRecoveryDocument(null)}
            onExport={() => {
              void loadRawDocument(recoveryDocument.id).then((value) => {
                if (value !== null) downloadRawDocument(value, recoveryDocument.id);
              });
            }}
          />
        )}
      </div>
    </Tooltip.Provider>
  );
}
