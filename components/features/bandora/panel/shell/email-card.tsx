import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/src/lib/api-client";
import { useAuth } from "@/src/auth/auth-provider";
import { useT } from "@/src/i18n";
import { EmailCardDialog } from "@/components/features/bandora/panel/shell/email-card-dialog";

/**
 * The dismissible "add a second way to sign in" card. Hidden once an email is set
 * or the card was dismissed; the dismissal is stored on the server.
 */
export function EmailCard() {
  const { t } = useT();
  const { me, setMe } = useAuth();
  const [open, setOpen] = useState(false);
  if (!me || me.user.email || me.emailCardDismissed) return null;

  async function dismiss() {
    try {
      await api.post("/api/account/email-card/dismiss");
      setMe((current) => (current ? { ...current, emailCardDismissed: true } : current));
    } catch {
      toast.error(t("emailCard.dismissError"));
    }
  }

  return (
    <>
      <aside className="bd-emailcard" aria-labelledby="emailcard-title">
        <button type="button" className="bd-iconbtn bd-emailcard__close" aria-label={t("emailCard.dismiss")} onClick={() => void dismiss()}>
          <X size={16} strokeWidth={1.6} aria-hidden />
        </button>
        <h2 id="emailcard-title" className="bd-emailcard__title">{t("emailCard.title")}</h2>
        <p className="bd-hint">{t("emailCard.body")}</p>
        <button type="button" className="bd-btn bd-btn--outline" onClick={() => setOpen(true)}>
          {t("emailCard.add")}
        </button>
      </aside>
      <EmailCardDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
