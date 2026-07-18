import { AlertTriangle, Copy, FileWarning, Replace, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { DocumentImportErrorCode } from "../domain/documentImport";
import { useI18n } from "../i18n/I18nProvider";
import type { TranslationKey } from "../i18n/messages";
import type { DocumentKind } from "../persistence/editorDatabase";

export type DocumentImportDialogState =
  | {
      kind: "error";
      code: DocumentImportErrorCode | "unexpected";
      fileName: string;
    }
  | {
      kind: "conflict";
      fileName: string;
      documentName: string;
      existingKind: DocumentKind;
    };

const errorMessageKeys: Record<
  Extract<DocumentImportDialogState, { kind: "error" }>["code"],
  TranslationKey
> = {
  invalidJson: "import.error.invalidJson",
  invalidDocument: "import.error.invalidDocument",
  unsupportedVersion: "import.error.unsupportedVersion",
  unexpected: "import.error.unexpected",
};

export function DocumentImportDialog({
  state,
  busy,
  onCancel,
  onCopy,
  onReplace,
}: {
  state: DocumentImportDialogState;
  busy: boolean;
  onCancel: () => void;
  onCopy: () => void;
  onReplace: () => void;
}) {
  const { t } = useI18n();
  const primaryButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    primaryButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || busy) return;
      event.preventDefault();
      onCancel();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [busy, onCancel]);

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="document-import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-import-title"
      >
        <header>
          <span className="document-import-icon" aria-hidden="true">
            {state.kind === "error" ? (
              <FileWarning size={22} />
            ) : (
              <AlertTriangle size={22} />
            )}
          </span>
          <div>
            <h2 id="document-import-title">
              {t(state.kind === "error" ? "import.errorTitle" : "import.conflictTitle")}
            </h2>
            <span>{state.fileName}</span>
          </div>
          <button
            type="button"
            className="document-import-close"
            aria-label={t("common.close")}
            disabled={busy}
            onClick={onCancel}
          >
            <X size={17} />
          </button>
        </header>

        <div className="document-import-content">
          {state.kind === "error" ? (
            <p>{t(errorMessageKeys[state.code])}</p>
          ) : (
            <>
              <p>
                {t("import.conflictDescription", { name: state.documentName })}
              </p>
              {state.existingKind === "template" && (
                <p className="document-import-template-note">
                  <AlertTriangle size={15} aria-hidden="true" />
                  {t("import.templateConflict")}
                </p>
              )}
            </>
          )}
        </div>

        <footer>
          {state.kind === "error" ? (
            <button
              ref={primaryButtonRef}
              type="button"
              className="button-primary"
              onClick={onCancel}
            >
              {t("common.close")}
            </button>
          ) : (
            <>
              <button type="button" onClick={onCancel} disabled={busy}>
                {t("import.cancel")}
              </button>
              <button type="button" onClick={onReplace} disabled={busy}>
                <Replace size={15} aria-hidden="true" />
                {t("import.replace")}
              </button>
              <button
                ref={primaryButtonRef}
                type="button"
                className="button-primary"
                onClick={onCopy}
                disabled={busy}
              >
                <Copy size={15} aria-hidden="true" />
                {t("import.asCopy")}
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
