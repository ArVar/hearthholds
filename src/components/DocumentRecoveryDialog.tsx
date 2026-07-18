import { Download, FileWarning, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useI18n } from "../i18n/I18nProvider";

export function DocumentRecoveryDialog({
  documentName,
  onClose,
  onExport,
}: {
  documentName: string;
  onClose: () => void;
  onExport: () => void;
}) {
  const { t } = useI18n();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="document-import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-recovery-title"
      >
        <header>
          <span className="document-import-icon" aria-hidden="true">
            <FileWarning size={22} />
          </span>
          <div>
            <h2 id="document-recovery-title">{t("recovery.title")}</h2>
            <span>{documentName}</span>
          </div>
          <button
            type="button"
            className="document-import-close"
            aria-label={t("common.close")}
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </header>
        <div className="document-import-content">
          <p>{t("recovery.description")}</p>
        </div>
        <footer>
          <button ref={closeButtonRef} type="button" onClick={onClose}>
            {t("common.close")}
          </button>
          <button type="button" className="button-primary" onClick={onExport}>
            <Download size={15} aria-hidden="true" />
            {t("recovery.export")}
          </button>
        </footer>
      </section>
    </div>
  );
}
