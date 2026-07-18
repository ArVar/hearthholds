import { CheckCircle2, Download, RefreshCw, X } from "lucide-react";
import { IconButton } from "./IconButton";

export function PwaStatusBanner({
  actionLabel,
  busy = false,
  closeLabel,
  kind,
  message,
  onAction,
  onClose,
}: {
  actionLabel?: string;
  busy?: boolean;
  closeLabel?: string;
  kind: "install" | "offline" | "update";
  message: string;
  onAction?: () => void;
  onClose?: () => void;
}) {
  const Icon = kind === "install" ? Download : kind === "update" ? RefreshCw : CheckCircle2;
  return (
    <div className={`pwa-status-banner is-${kind}`} role="status">
      <Icon size={17} aria-hidden="true" />
      <span>{message}</span>
      {actionLabel && onAction && (
        <button type="button" disabled={busy} onClick={onAction}>
          {kind === "install" ? <Download size={14} /> : <RefreshCw size={14} />}
          {actionLabel}
        </button>
      )}
      {onClose && (
        <IconButton label={closeLabel ?? "Close"} onClick={onClose}>
          <X size={15} />
        </IconButton>
      )}
    </div>
  );
}
