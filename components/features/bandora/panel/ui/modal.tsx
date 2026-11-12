import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useT } from "@/src/i18n";

const FOCUSABLE = "a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Bottom sheet on phones either way; `dialog` is centred on wide screens. */
  variant?: "sheet" | "dialog";
};

/** Accessible modal: Escape and backdrop close, Tab stays inside, focus returns to the opener. */
export function Modal({ open, onClose, title, children, variant = "sheet" }: ModalProps) {
  const { t } = useT();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = panel.current;
    const first = root?.querySelector<HTMLElement>("input:not(:disabled), select:not(:disabled), a[href], button:not(:disabled)");
    first?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !root) return;
      const items = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const head = items[0];
      const tail = items[items.length - 1];
      if (!head || !tail) return;
      if (event.shiftKey && document.activeElement === head) {
        event.preventDefault();
        tail.focus();
      } else if (!event.shiftKey && document.activeElement === tail) {
        event.preventDefault();
        head.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <button type="button" className="bd-backdrop" aria-label={t("common.close")} tabIndex={-1} onClick={onClose} />
      <div ref={panel} className={`bd-modal bd-modal--${variant}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="bd-modal__head">
          <h2 id={titleId} className="bd-modal__title">{title}</h2>
          <button type="button" className="bd-iconbtn" aria-label={t("common.close")} onClick={onClose}>
            <X size={18} strokeWidth={1.6} aria-hidden />
          </button>
        </div>
        <div className="bd-modal__body">{children}</div>
      </div>
    </>
  );
}
